import { z } from "zod";

export const VERSION = "0.1.0";
export const RTC_PROTOCOL_VERSION = 1;
export const DEFAULT_SIGNAL_API_BASE_URL = "http://127.0.0.1:8787";
export const HARNESS_HEALTH_RTC_BASE_PATH = "/api/rtc/harness-health/v1";
export const MAX_SIGNAL_FRAME_BYTES = 64 * 1024;
export const SIGNAL_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const PEER_MESSAGE_SCHEMA_VERSION = 1;
export const SNAPSHOT_BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_PACKAGE_BYTES = 2 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const companionDeviceKindSchema = z.enum(["iphone", "ipad", "watch"]);
export type CompanionDeviceKind = z.infer<typeof companionDeviceKindSchema>;

export const pairingLinkV1Schema = z.object({
  version: z.literal(RTC_PROTOCOL_VERSION),
  signalUrl: z.string().url(),
  cloudUserId: z.string().min(1),
  pairingId: z.string().min(1),
  deviceName: z.string().min(1),
  expiresAt: z.number().int().positive(),
  pairingSecret: z.string().min(24),
  backupEnabled: z.boolean().optional(),
  backupEpochId: z.string().min(1).optional(),
  backupKeyId: z.string().min(1).max(128).optional(),
  backupKey: z.string().min(24).optional(),
});
export type PairingLinkV1 = z.infer<typeof pairingLinkV1Schema>;

export const signalEnvelopeKindSchema = z.enum([
  "desktop.online",
  "pair.request",
  "pair.accept",
  "peer.offer",
  "peer.answer",
  "peer.ice",
  "peer.close",
]);
export type SignalEnvelopeKind = z.infer<typeof signalEnvelopeKindSchema>;

export const signalEnvelopeV1Schema = z.object({
  version: z.literal(RTC_PROTOCOL_VERSION),
  id: z.string().min(1).max(128),
  cloudUserId: z.string().min(1).max(128),
  pairingId: z.string().min(1).max(128).optional(),
  fromDeviceId: z.string().min(1).max(128),
  toDeviceId: z.string().min(1).max(128).optional(),
  kind: signalEnvelopeKindSchema,
  createdAt: z.number().int().positive(),
  nonce: z.string().min(12),
  ciphertext: z.string().min(1),
});
export type SignalEnvelopeV1 = z.infer<typeof signalEnvelopeV1Schema>;

export const signalPlaintextV1Schema = z.object({
  version: z.literal(RTC_PROTOCOL_VERSION),
  kind: signalEnvelopeKindSchema,
  deviceId: z.string().min(1),
  deviceName: z.string().min(1).optional(),
  deviceKind: z.enum(["desktop", "iphone", "ipad", "watch"]).optional(),
  sdp: z.string().optional(),
  ice: z.unknown().optional(),
  pairedDeviceSecret: z.string().min(24).optional(),
  accepted: z.boolean().optional(),
  reason: z.string().optional(),
});
export type SignalPlaintextV1 = z.infer<typeof signalPlaintextV1Schema>;

export const peerReportSnapshotV1Schema = z.object({
  schemaVersion: z.literal(PEER_MESSAGE_SCHEMA_VERSION),
  desktopDeviceId: z.string().min(1),
  desktopDeviceName: z.string().min(1),
  revision: z.number().int().nonnegative(),
  reports: z.array(z.unknown()),
  createdAt: z.number().int().positive(),
});
export type PeerReportSnapshotV1 = z.infer<typeof peerReportSnapshotV1Schema>;

export const peerReviewDecisionBatchV1Schema = z.object({
  schemaVersion: z.literal(PEER_MESSAGE_SCHEMA_VERSION),
  sourceDeviceId: z.string().min(1),
  sourceDeviceName: z.string().min(1).optional(),
  revision: z.number().int().nonnegative(),
  decisions: z.array(
    z.object({
      reportId: z.string().min(1),
      findingId: z.string().min(1),
      state: z.enum(["accepted", "rejected", "queued", "snoozed"]),
      updatedAt: z.number().int().positive(),
      sourceDeviceId: z.string().min(1),
      sourceDeviceName: z.string().optional(),
    })
  ),
  createdAt: z.number().int().positive(),
});
export type PeerReviewDecisionBatchV1 = z.infer<
  typeof peerReviewDecisionBatchV1Schema
>;

export const peerAckV1Schema = z.object({
  schemaVersion: z.literal(PEER_MESSAGE_SCHEMA_VERSION),
  ackId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  accepted: z.boolean(),
  createdAt: z.number().int().positive(),
});
export type PeerAckV1 = z.infer<typeof peerAckV1Schema>;

export const peerSyncMessageV1Schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    schemaVersion: z.literal(PEER_MESSAGE_SCHEMA_VERSION),
    messageId: z.string().min(1),
    deviceId: z.string().min(1),
    deviceName: z.string().min(1),
    deviceKind: z.enum(["desktop", "iphone", "ipad", "watch"]),
    lastKnownRevision: z.number().int().nonnegative(),
    createdAt: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("request.snapshot"),
    schemaVersion: z.literal(PEER_MESSAGE_SCHEMA_VERSION),
    messageId: z.string().min(1),
    lastKnownRevision: z.number().int().nonnegative(),
    createdAt: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("report.snapshot"),
    messageId: z.string().min(1),
    payload: peerReportSnapshotV1Schema,
  }),
  z.object({
    type: z.literal("review.decisions"),
    messageId: z.string().min(1),
    payload: peerReviewDecisionBatchV1Schema,
  }),
  z.object({
    type: z.literal("ack"),
    messageId: z.string().min(1),
    payload: peerAckV1Schema,
  }),
]);
export type PeerSyncMessageV1 = z.infer<typeof peerSyncMessageV1Schema>;

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof iceServerSchema>;

export const iceResponseV1Schema = z.object({
  version: z.literal(RTC_PROTOCOL_VERSION),
  iceServers: z.array(iceServerSchema),
});
export type IceResponseV1 = z.infer<typeof iceResponseV1Schema>;

export const snapshotBackupTableSchema = z.enum(["reports", "meta"]);
export type SnapshotBackupTable = z.infer<typeof snapshotBackupTableSchema>;

export const snapshotBackupRowV1Schema = z.object({
  id: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  json: z.string().min(1),
});
export type SnapshotBackupRowV1 = z.infer<typeof snapshotBackupRowV1Schema>;

export const snapshotBackupOpV1Schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("replaceTable"),
    table: z.literal("reports"),
    rows: z.array(snapshotBackupRowV1Schema),
  }),
  z.object({
    op: z.literal("setMeta"),
    key: z.string().min(1),
    value: z.string(),
  }),
]);
export type SnapshotBackupOpV1 = z.infer<typeof snapshotBackupOpV1Schema>;

export const snapshotBackupPayloadV1Schema = z.object({
  schemaVersion: z.literal(SNAPSHOT_BACKUP_SCHEMA_VERSION),
  cloudUserId: z.string().min(1),
  epochId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  desktopDeviceId: z.string().min(1),
  desktopDeviceName: z.string().min(1),
  ops: z.array(snapshotBackupOpV1Schema),
  createdAt: z.number().int().positive(),
});
export type SnapshotBackupPayloadV1 = z.infer<
  typeof snapshotBackupPayloadV1Schema
>;

export const encryptedSnapshotPackageV1Schema = z.object({
  version: z.literal(SNAPSHOT_BACKUP_SCHEMA_VERSION),
  cloudUserId: z.string().min(1).max(128),
  epochId: z.string().min(1).max(128),
  revision: z.number().int().nonnegative(),
  baseRevision: z.number().int().nonnegative(),
  kind: z.literal("snapshot.update"),
  authorDeviceId: z.string().min(1).max(128),
  keyId: z.string().min(1).max(128).default("snapshot-v1"),
  nonce: z.string().min(12),
  ciphertext: z.string().min(1),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});
export type EncryptedSnapshotPackageV1 = z.infer<
  typeof encryptedSnapshotPackageV1Schema
>;

export const snapshotBackupPullResponseV1Schema = z.object({
  version: z.literal(SNAPSHOT_BACKUP_SCHEMA_VERSION),
  package: encryptedSnapshotPackageV1Schema.nullable(),
});
export type SnapshotBackupPullResponseV1 = z.infer<
  typeof snapshotBackupPullResponseV1Schema
>;

export function signalApiUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/u, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${HARNESS_HEALTH_RTC_BASE_PATH}${cleanPath}`;
}

export function snapshotBackupApiUrl(baseUrl: string, path: string): string {
  return signalApiUrl(baseUrl, path);
}

export async function snapshotBackupAuthToken(input: {
  backupKey: string;
  cloudUserId: string;
}): Promise<string> {
  return sha256Base64Url(
    `harness-health:backup-auth:v1:${input.cloudUserId}:${input.backupKey}`
  );
}

export function signalWebSocketUrl(input: {
  signalUrl: string;
  cloudUserId: string;
  deviceId: string;
  role: "desktop" | "device";
  pairingId?: string;
}): string {
  const url = new URL(
    signalApiUrl(
      input.signalUrl,
      `/users/${encodeURIComponent(input.cloudUserId)}/ws`
    )
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("deviceId", input.deviceId);
  url.searchParams.set("role", input.role);
  if (input.pairingId) url.searchParams.set("pairingId", input.pairingId);
  return url.toString();
}

export function encodePairingLink(input: PairingLinkV1): string {
  const parsed = pairingLinkV1Schema.parse(input);
  const params = new URLSearchParams({
    v: String(parsed.version),
    signalUrl: parsed.signalUrl,
    cloudUserId: parsed.cloudUserId,
    pairingId: parsed.pairingId,
    deviceName: parsed.deviceName,
    expiresAt: String(parsed.expiresAt),
  });
  if (parsed.backupEnabled) params.set("backupEnabled", "1");
  if (parsed.backupEpochId) params.set("backupEpochId", parsed.backupEpochId);
  if (parsed.backupKeyId) params.set("backupKeyId", parsed.backupKeyId);
  const fragment = new URLSearchParams({
    pairingSecret: parsed.pairingSecret,
  });
  if (parsed.backupKey) fragment.set("backupKey", parsed.backupKey);
  return `harnesshealth://pair?${params.toString()}#${fragment.toString()}`;
}

export function decodePairingLink(value: string): PairingLinkV1 {
  const url = new URL(value);
  const fragment = new URLSearchParams(url.hash.replace(/^#/u, ""));
  return pairingLinkV1Schema.parse({
    version: Number(url.searchParams.get("v") ?? RTC_PROTOCOL_VERSION),
    signalUrl: url.searchParams.get("signalUrl"),
    cloudUserId: url.searchParams.get("cloudUserId"),
    pairingId: url.searchParams.get("pairingId"),
    deviceName: url.searchParams.get("deviceName"),
    expiresAt: Number(url.searchParams.get("expiresAt")),
    pairingSecret: fragment.get("pairingSecret"),
    backupEnabled: url.searchParams.get("backupEnabled") === "1",
    backupEpochId: url.searchParams.get("backupEpochId") ?? undefined,
    backupKeyId: url.searchParams.get("backupKeyId") ?? undefined,
    backupKey: fragment.get("backupKey") ?? undefined,
  });
}

export function assertPairingSecretNotInUrl(pairingUrl: string): void {
  const url = new URL(pairingUrl);
  if (url.searchParams.has("pairingSecret")) {
    throw new Error("Pairing secret must be carried in the URL fragment only.");
  }
  if (url.searchParams.has("backupKey")) {
    throw new Error("Backup key must be carried in the URL fragment only.");
  }
}

export function signalFrameSize(value: unknown): number {
  return textEncoder.encode(JSON.stringify(value)).byteLength;
}

export function isFreshSignal(createdAt: number, now = Date.now()): boolean {
  return Math.abs(now - createdAt) <= SIGNAL_REPLAY_WINDOW_MS;
}

export function messageId(prefix = "msg"): string {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${base64UrlEncode(randomBytes(16))}`;
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateSecret(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

export function utf8Bytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function utf8String(value: Uint8Array): string {
  return textDecoder.decode(value);
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  const bufferConstructor = globalThis as typeof globalThis & {
    Buffer?: {
      from(input: Uint8Array): { toString(encoding: "base64"): string };
    };
  };
  if (bufferConstructor.Buffer) {
    return bufferConstructor.Buffer.from(bytes)
      .toString("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const bufferConstructor = globalThis as typeof globalThis & {
    Buffer?: { from(input: string, encoding: "base64"): Uint8Array };
  };
  if (bufferConstructor.Buffer) {
    return new Uint8Array(bufferConstructor.Buffer.from(padded, "base64"));
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    arrayBufferFromBytes(utf8Bytes(value))
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export async function deriveSignalKey(input: {
  secret: string;
  cloudUserId: string;
  pairingId?: string;
}): Promise<CryptoKey> {
  if (!crypto.subtle) {
    throw new Error("WebCrypto subtle crypto is required for signaling E2EE.");
  }
  const root = await crypto.subtle.importKey(
    "raw",
    arrayBufferFromBytes(utf8Bytes(input.secret)),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: arrayBufferFromBytes(
        utf8Bytes(`harness-health:rtc:v1:${input.cloudUserId}`)
      ),
      info: arrayBufferFromBytes(utf8Bytes(input.pairingId ?? "reconnect")),
    },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function deriveSnapshotBackupKey(input: {
  backupKey: string;
  cloudUserId: string;
  epochId: string;
}): Promise<CryptoKey> {
  if (!crypto.subtle) {
    throw new Error("WebCrypto subtle crypto is required for snapshot backup.");
  }
  const root = await crypto.subtle.importKey(
    "raw",
    arrayBufferFromBytes(utf8Bytes(input.backupKey)),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: arrayBufferFromBytes(
        utf8Bytes(`harness-health:snapshot:v1:${input.cloudUserId}`)
      ),
      info: arrayBufferFromBytes(utf8Bytes(input.epochId)),
    },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function signalAad(
  envelope: Omit<SignalEnvelopeV1, "nonce" | "ciphertext">
): string {
  return [
    envelope.version,
    envelope.id,
    envelope.cloudUserId,
    envelope.pairingId ?? "",
    envelope.fromDeviceId,
    envelope.toDeviceId ?? "",
    envelope.kind,
    envelope.createdAt,
  ].join("\n");
}

export async function encryptSignalEnvelope(input: {
  secret: string;
  cloudUserId: string;
  pairingId?: string;
  fromDeviceId: string;
  toDeviceId?: string;
  kind: SignalEnvelopeKind;
  payload: SignalPlaintextV1;
  createdAt?: number;
}): Promise<SignalEnvelopeV1> {
  const createdAt = input.createdAt ?? Date.now();
  const envelopeMeta: Omit<SignalEnvelopeV1, "nonce" | "ciphertext"> = {
    version: RTC_PROTOCOL_VERSION,
    id: messageId("sig"),
    cloudUserId: input.cloudUserId,
    pairingId: input.pairingId,
    fromDeviceId: input.fromDeviceId,
    toDeviceId: input.toDeviceId,
    kind: input.kind,
    createdAt,
  };
  const nonce = randomBytes(12);
  const key = await deriveSignalKey({
    secret: input.secret,
    cloudUserId: input.cloudUserId,
    pairingId: input.pairingId,
  });
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: arrayBufferFromBytes(nonce),
      additionalData: arrayBufferFromBytes(utf8Bytes(signalAad(envelopeMeta))),
    },
    key,
    arrayBufferFromBytes(
      utf8Bytes(JSON.stringify(signalPlaintextV1Schema.parse(input.payload)))
    )
  );
  return signalEnvelopeV1Schema.parse({
    ...envelopeMeta,
    nonce: base64UrlEncode(nonce),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  });
}

export async function decryptSignalEnvelope(input: {
  secret: string;
  envelope: SignalEnvelopeV1;
}): Promise<SignalPlaintextV1> {
  const envelope = signalEnvelopeV1Schema.parse(input.envelope);
  if (!isFreshSignal(envelope.createdAt)) {
    throw new Error("Signal envelope is outside the replay window.");
  }
  const key = await deriveSignalKey({
    secret: input.secret,
    cloudUserId: envelope.cloudUserId,
    pairingId: envelope.pairingId,
  });
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: arrayBufferFromBytes(base64UrlDecode(envelope.nonce)),
      additionalData: arrayBufferFromBytes(utf8Bytes(signalAad(envelope))),
    },
    key,
    arrayBufferFromBytes(base64UrlDecode(envelope.ciphertext))
  );
  return signalPlaintextV1Schema.parse(
    JSON.parse(utf8String(new Uint8Array(plaintext)))
  );
}

export function validatePeerSyncMessage(input: unknown): PeerSyncMessageV1 {
  return peerSyncMessageV1Schema.parse(input);
}

function snapshotBackupAad(
  pkg: Omit<EncryptedSnapshotPackageV1, "nonce" | "ciphertext">
): string {
  return [
    pkg.version,
    pkg.cloudUserId,
    pkg.epochId,
    pkg.revision,
    pkg.baseRevision,
    pkg.kind,
    pkg.authorDeviceId,
    pkg.keyId,
    pkg.createdAt,
    pkg.expiresAt,
  ].join("\n");
}

export async function encryptSnapshotBackupPackage(input: {
  backupKey: string;
  cloudUserId: string;
  epochId: string;
  revision: number;
  baseRevision?: number;
  authorDeviceId: string;
  payload: SnapshotBackupPayloadV1;
  keyId?: string;
  createdAt?: number;
  expiresAt?: number;
}): Promise<EncryptedSnapshotPackageV1> {
  const createdAt = input.createdAt ?? Date.now();
  const pkgMeta: Omit<EncryptedSnapshotPackageV1, "nonce" | "ciphertext"> = {
    version: SNAPSHOT_BACKUP_SCHEMA_VERSION,
    cloudUserId: input.cloudUserId,
    epochId: input.epochId,
    revision: input.revision,
    baseRevision: input.baseRevision ?? 0,
    kind: "snapshot.update",
    authorDeviceId: input.authorDeviceId,
    keyId: input.keyId ?? "snapshot-v1",
    createdAt,
    expiresAt: input.expiresAt ?? createdAt + 30 * 24 * 60 * 60 * 1000,
  };
  const nonce = randomBytes(12);
  const key = await deriveSnapshotBackupKey({
    backupKey: input.backupKey,
    cloudUserId: input.cloudUserId,
    epochId: input.epochId,
  });
  const payload = snapshotBackupPayloadV1Schema.parse(input.payload);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: arrayBufferFromBytes(nonce),
      additionalData: arrayBufferFromBytes(
        utf8Bytes(snapshotBackupAad(pkgMeta))
      ),
    },
    key,
    arrayBufferFromBytes(utf8Bytes(JSON.stringify(payload)))
  );
  return encryptedSnapshotPackageV1Schema.parse({
    ...pkgMeta,
    nonce: base64UrlEncode(nonce),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  });
}

export async function decryptSnapshotBackupPackage(input: {
  backupKey: string;
  package: EncryptedSnapshotPackageV1;
}): Promise<SnapshotBackupPayloadV1> {
  const pkg = encryptedSnapshotPackageV1Schema.parse(input.package);
  if (pkg.expiresAt <= Date.now()) {
    throw new Error("Encrypted snapshot backup package is expired.");
  }
  const key = await deriveSnapshotBackupKey({
    backupKey: input.backupKey,
    cloudUserId: pkg.cloudUserId,
    epochId: pkg.epochId,
  });
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: arrayBufferFromBytes(base64UrlDecode(pkg.nonce)),
      additionalData: arrayBufferFromBytes(utf8Bytes(snapshotBackupAad(pkg))),
    },
    key,
    arrayBufferFromBytes(base64UrlDecode(pkg.ciphertext))
  );
  return snapshotBackupPayloadV1Schema.parse(
    JSON.parse(utf8String(new Uint8Array(plaintext)))
  );
}

export interface SnapshotBackupKeyCandidate {
  keyId?: string;
  backupKey: string;
}

export async function decryptSnapshotBackupPackageWithKeys(input: {
  keys: SnapshotBackupKeyCandidate[];
  package: EncryptedSnapshotPackageV1;
}): Promise<SnapshotBackupPayloadV1> {
  const pkg = encryptedSnapshotPackageV1Schema.parse(input.package);
  const preferred = input.keys.filter((candidate) =>
    candidate.keyId
      ? candidate.keyId === pkg.keyId
      : pkg.keyId === "snapshot-v1"
  );
  const candidates = preferred.length > 0 ? preferred : input.keys;
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await decryptSnapshotBackupPackage({
        backupKey: candidate.backupKey,
        package: pkg,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Encrypted snapshot backup could not be decrypted.");
}
