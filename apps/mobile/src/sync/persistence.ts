import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import {
  decodePairingLink,
  type PeerSyncMessageV1,
  type SnapshotBackupPayloadV1,
} from "@harness-health/core";
import type { Pairing, Snapshot } from "../domain/types";
import { normalizeReport } from "./normalization";
import { numberValue, recordValue, stringValue } from "./normalization";

const PAIRING_KEY = "harness-health-pairing";
const SNAPSHOT_DB_NAME = "harness-health-snapshots.db";

interface LocalReportRow {
  id: string;
  updated_at: number;
  json: string;
}

interface LocalMetaRow {
  value: string;
}

let snapshotDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function parsePairingUrl(input: string): Pairing | null {
  try {
    const decoded = decodePairingLink(input);
    if (decoded.expiresAt <= Date.now()) return null;
    return {
      cloudUserId: decoded.cloudUserId,
      signalUrl: decoded.signalUrl,
      pairingId: decoded.pairingId,
      pairingSecret: decoded.pairingSecret,
      deviceId: Crypto.randomUUID(),
      deviceName: "iPhone",
      lastRevision: 0,
      pendingDecisions: [],
      backupEnabled: decoded.backupEnabled,
      backupEpochId: decoded.backupEpochId,
      backupKeyId: decoded.backupKeyId,
      backupKey: decoded.backupKey,
    };
  } catch {
    return null;
  }
}

export async function loadPairing(): Promise<Pairing | null> {
  const stored = await SecureStore.getItemAsync(PAIRING_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored) as Partial<Pairing>;
  if (!parsed.cloudUserId || !parsed.signalUrl) return null;
  return {
    ...parsed,
    cloudUserId: parsed.cloudUserId,
    signalUrl: parsed.signalUrl,
    deviceId: parsed.deviceId || Crypto.randomUUID(),
    deviceName: parsed.deviceName || "iPhone",
    lastRevision: parsed.lastRevision ?? 0,
    pendingDecisions: parsed.pendingDecisions ?? [],
    backupRetainedKeys: parsed.backupRetainedKeys ?? [],
  };
}

export async function savePairing(pairing: Pairing): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(pairing));
}

export async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}

async function snapshotDb(): Promise<SQLite.SQLiteDatabase> {
  snapshotDbPromise ??= SQLite.openDatabaseAsync(SNAPSHOT_DB_NAME);
  const db = await snapshotDbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL,
      updated_at INTEGER NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return db;
}

async function setLocalMeta(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `,
    key,
    value
  );
}

export async function applySnapshotPayloadToSqlite(
  pairing: Pairing,
  payload: SnapshotBackupPayloadV1
): Promise<Snapshot | null> {
  const db = await snapshotDb();
  await db.execAsync("BEGIN IMMEDIATE TRANSACTION");
  try {
    for (const op of payload.ops) {
      if (op.op === "replaceTable" && op.table === "reports") {
        await db.runAsync("DELETE FROM reports");
        for (const row of op.rows) {
          await db.runAsync(
            `
            INSERT INTO reports (id, updated_at, json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              updated_at = excluded.updated_at,
              json = excluded.json
          `,
            row.id,
            row.updatedAt,
            row.json
          );
        }
      } else if (op.op === "setMeta") {
        await setLocalMeta(db, op.key, op.value);
      }
    }
    await setLocalMeta(db, "revision", String(payload.revision));
    await setLocalMeta(db, "desktopDeviceId", payload.desktopDeviceId);
    await setLocalMeta(db, "desktopDeviceName", payload.desktopDeviceName);
    await db.execAsync("COMMIT");
  } catch (error) {
    await db.execAsync("ROLLBACK");
    throw error;
  }
  return loadSnapshotFromSqlite({
    ...pairing,
    desktopDeviceId: payload.desktopDeviceId,
    desktopDeviceName: payload.desktopDeviceName,
    lastRevision: payload.revision,
  });
}

export async function savePeerSnapshotToSqlite(
  pairing: Pairing,
  message: Extract<PeerSyncMessageV1, { type: "report.snapshot" }>
): Promise<void> {
  await applySnapshotPayloadToSqlite(pairing, {
    schemaVersion: 1,
    cloudUserId: pairing.cloudUserId,
    epochId: pairing.backupEpochId ?? "peer-live",
    revision: message.payload.revision,
    desktopDeviceId: message.payload.desktopDeviceId,
    desktopDeviceName: message.payload.desktopDeviceName,
    ops: [
      {
        op: "replaceTable",
        table: "reports",
        rows: message.payload.reports.map((report) => {
          const record = recordValue(report);
          return {
            id: stringValue(record.id, Crypto.randomUUID()),
            updatedAt: numberValue(record.timestamp, Date.now()),
            json: JSON.stringify(report),
          };
        }),
      },
    ],
    createdAt: Date.now(),
  });
}

export async function loadSnapshotFromSqlite(
  pairing: Pairing
): Promise<Snapshot | null> {
  const db = await snapshotDb();
  const row = await db.getFirstAsync<LocalReportRow>(
    "SELECT id, updated_at, json FROM reports ORDER BY updated_at DESC LIMIT 1"
  );
  if (!row) return null;
  const revisionRow = await db.getFirstAsync<LocalMetaRow>(
    "SELECT value FROM meta WHERE key = ?",
    "revision"
  );
  const desktopNameRow = await db.getFirstAsync<LocalMetaRow>(
    "SELECT value FROM meta WHERE key = ?",
    "desktopDeviceName"
  );
  const desktopIdRow = await db.getFirstAsync<LocalMetaRow>(
    "SELECT value FROM meta WHERE key = ?",
    "desktopDeviceId"
  );
  return {
    userId: pairing.cloudUserId,
    desktopDeviceId:
      desktopIdRow?.value ?? pairing.desktopDeviceId ?? "harness-health-mac",
    desktopDeviceName:
      desktopNameRow?.value ??
      pairing.desktopDeviceName ??
      "Harness Health Desktop",
    deviceId: pairing.deviceId,
    revision: Number(revisionRow?.value ?? pairing.lastRevision ?? 0),
    report: normalizeReport(JSON.parse(row.json)),
  };
}

export async function clearSnapshotDb(): Promise<void> {
  const db = await snapshotDb();
  await db.runAsync("DELETE FROM reports");
  await db.runAsync("DELETE FROM meta");
}
