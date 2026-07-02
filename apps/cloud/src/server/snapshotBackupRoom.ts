import {
  MAX_BACKUP_PACKAGE_BYTES,
  encryptedSnapshotPackageV1Schema,
  sha256Base64Url,
  snapshotBackupPullResponseV1Schema,
} from "@harness-health/core";
import { DurableObject } from "cloudflare:workers";

import { json, jsonError } from "./http";
import type { Env } from "./types";

const RETAINED_PACKAGE_COUNT = 20;

interface MetaRow {
  value: string;
}

interface SnapshotRow {
  package_json: string;
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
}

export class SnapshotBackupRoom extends DurableObject<Env> {
  private schemaReady = false;

  async fetch(request: Request): Promise<Response> {
    this.ensureSchema();
    const token = bearerToken(request);
    if (!token) return jsonError("missing backup authorization", 401);

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/snapshots")) {
      return this.storeSnapshot(request, token);
    }
    if (request.method === "GET" && url.pathname.endsWith("/latest")) {
      return this.latestSnapshot(token);
    }
    if (request.method === "DELETE") {
      return this.clearBackup(token);
    }
    return jsonError("backup route not found", 404);
  }

  async alarm(): Promise<void> {
    this.ensureSchema();
    this.deleteExpiredSnapshots();
  }

  private ensureSchema(): void {
    if (this.schemaReady) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        revision INTEGER PRIMARY KEY,
        package_json TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS snapshots_expiry_idx
      ON snapshots (expires_at)
    `);
    this.schemaReady = true;
  }

  private async authHash(token: string): Promise<string> {
    return sha256Base64Url(`harness-health:stored-backup-auth:v1:${token}`);
  }

  private storedAuthHash(): string {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM meta WHERE key = ? LIMIT 1", "auth_hash")
      .toArray()[0] as unknown as MetaRow | undefined;
    return row?.value ?? "";
  }

  private setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      `
      INSERT INTO meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
      key,
      value
    );
  }

  private async authorize(token: string, claim = false): Promise<boolean> {
    const nextHash = await this.authHash(token);
    const currentHash = this.storedAuthHash();
    if (!currentHash && claim) {
      this.setMeta("auth_hash", nextHash);
      return true;
    }
    return currentHash === nextHash;
  }

  private deleteExpiredSnapshots(now = Date.now()): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM snapshots WHERE expires_at <= ?",
      now
    );
  }

  private async scheduleExpiryAlarm(expiresAt: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (!current || expiresAt < current) {
      await this.ctx.storage.setAlarm(expiresAt + 1000);
    }
  }

  private async storeSnapshot(
    request: Request,
    token: string
  ): Promise<Response> {
    if (!(await this.authorize(token, true))) {
      return jsonError("invalid backup authorization", 403);
    }
    const text = await request.text();
    const size = new TextEncoder().encode(text).byteLength;
    if (size > MAX_BACKUP_PACKAGE_BYTES) {
      return jsonError("encrypted snapshot package is too large", 413);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return jsonError("invalid json", 400);
    }
    const parsed = encryptedSnapshotPackageV1Schema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("invalid encrypted snapshot package", 400, parsed.error);
    }
    const pkg = parsed.data;
    if (pkg.cloudUserId !== this.ctx.id.name) {
      return jsonError("snapshot package room mismatch", 400);
    }
    if (pkg.expiresAt <= Date.now()) {
      return jsonError("snapshot package is expired", 400);
    }

    this.ctx.storage.sql.exec(
      `
      INSERT INTO snapshots (revision, package_json, size, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(revision) DO UPDATE SET
        package_json = excluded.package_json,
        size = excluded.size,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `,
      pkg.revision,
      JSON.stringify(pkg),
      size,
      pkg.createdAt,
      pkg.expiresAt
    );
    this.setMeta("current_revision", String(pkg.revision));
    this.deleteExpiredSnapshots();
    this.ctx.storage.sql.exec(
      `
      DELETE FROM snapshots
      WHERE revision NOT IN (
        SELECT revision FROM snapshots
        ORDER BY revision DESC
        LIMIT ?
      )
    `,
      RETAINED_PACKAGE_COUNT
    );
    await this.scheduleExpiryAlarm(pkg.expiresAt);
    return json({ ok: true, revision: pkg.revision });
  }

  private async latestSnapshot(token: string): Promise<Response> {
    if (!this.storedAuthHash()) {
      return json(
        snapshotBackupPullResponseV1Schema.parse({
          version: 1,
          package: null,
        })
      );
    }
    if (!(await this.authorize(token))) {
      return jsonError("invalid backup authorization", 403);
    }
    this.deleteExpiredSnapshots();
    const row = this.ctx.storage.sql
      .exec(
        `
      SELECT package_json
      FROM snapshots
      WHERE expires_at > ?
      ORDER BY revision DESC
      LIMIT 1
    `,
        Date.now()
      )
      .toArray()[0] as unknown as SnapshotRow | undefined;
    const pkg = row
      ? encryptedSnapshotPackageV1Schema.parse(JSON.parse(row.package_json))
      : null;
    return json(
      snapshotBackupPullResponseV1Schema.parse({
        version: 1,
        package: pkg,
      })
    );
  }

  private async clearBackup(token: string): Promise<Response> {
    if (!(await this.authorize(token))) {
      return jsonError("invalid backup authorization", 403);
    }
    this.ctx.storage.sql.exec("DELETE FROM snapshots");
    this.ctx.storage.sql.exec("DELETE FROM meta");
    await this.ctx.storage.deleteAlarm();
    return json({ ok: true });
  }
}
