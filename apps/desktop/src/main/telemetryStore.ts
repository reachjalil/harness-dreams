import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

import type {
  HarnessKind,
  IngestCursor,
  LiveTelemetrySource,
  NormalizedEvent,
} from "../shared/types";

export interface TelemetryEventFilter {
  source?: HarnessKind;
  projectPath?: string;
  model?: string;
}

interface EventRow {
  id: string;
  source: HarnessKind;
  connector_version: string;
  session_id: string;
  project_path: string;
  project_name: string;
  ts: number | string;
  seq: number | string;
  kind: NormalizedEvent["kind"];
  role: NormalizedEvent["role"] | null;
  model: string | null;
  tokens_in: number | string | null;
  tokens_out: number | string | null;
  cache_read_tokens: number | string | null;
  cache_create_tokens: number | string | null;
  tool_name: string | null;
  mcp_server: string | null;
  mcp_tool: string | null;
  tool_outcome: NormalizedEvent["toolOutcome"] | null;
  permission_mode: string | null;
  latency_ms: number | string | null;
  speed: number | string | null;
  iterations: number | string | null;
  raw_path: string;
  raw_line: number | string;
}

interface CursorRow {
  file_path: string;
  source: HarnessKind;
  connector_version: string;
  size: number | string;
  mtime_ms: number | string;
  line_offset: number | string;
  byte_offset: number | string | null;
  updated_at: number | string;
}

interface SourceSummaryRow {
  source: HarnessKind;
  files: number | string;
  events: number | string;
  sessions: number | string;
  last_activity_at: number | string | null;
}

const EVENT_COLUMNS = [
  "id",
  "source",
  "connector_version",
  "session_id",
  "project_path",
  "project_name",
  "ts",
  "seq",
  "kind",
  "role",
  "model",
  "tokens_in",
  "tokens_out",
  "cache_read_tokens",
  "cache_create_tokens",
  "tool_name",
  "mcp_server",
  "mcp_tool",
  "tool_outcome",
  "permission_mode",
  "latency_ms",
  "speed",
  "iterations",
  "raw_path",
  "raw_line",
] as const;

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventToValues(event: NormalizedEvent): unknown[] {
  return [
    event.id,
    event.source,
    event.connectorVersion,
    event.sessionId,
    event.projectPath,
    event.projectName,
    Math.round(event.ts),
    event.seq,
    event.kind,
    event.role ?? null,
    event.model ?? null,
    event.tokensIn ?? 0,
    event.tokensOut ?? 0,
    event.cacheReadTokens ?? 0,
    event.cacheCreateTokens ?? 0,
    event.toolName ?? null,
    event.mcpServer ?? null,
    event.mcpTool ?? null,
    event.toolOutcome ?? null,
    event.permissionMode ?? null,
    event.latencyMs ?? null,
    event.speed ?? null,
    event.iterations ?? null,
    event.rawPath,
    event.rawLine,
  ];
}

function rowToEvent(row: EventRow): NormalizedEvent {
  return {
    id: row.id,
    source: row.source,
    connectorVersion: row.connector_version,
    sessionId: row.session_id,
    projectPath: row.project_path,
    projectName: row.project_name,
    ts: num(row.ts),
    seq: num(row.seq),
    kind: row.kind,
    role: row.role ?? undefined,
    model: row.model ?? undefined,
    tokensIn: num(row.tokens_in),
    tokensOut: num(row.tokens_out),
    cacheReadTokens: num(row.cache_read_tokens),
    cacheCreateTokens: num(row.cache_create_tokens),
    toolName: row.tool_name ?? undefined,
    mcpServer: row.mcp_server ?? undefined,
    mcpTool: row.mcp_tool ?? undefined,
    toolOutcome: row.tool_outcome ?? undefined,
    permissionMode: row.permission_mode ?? undefined,
    latencyMs: row.latency_ms == null ? undefined : num(row.latency_ms),
    speed: row.speed == null ? undefined : num(row.speed),
    iterations: row.iterations == null ? undefined : num(row.iterations),
    rawPath: row.raw_path,
    rawLine: num(row.raw_line),
  };
}

function whereForFilter(
  filter: TelemetryEventFilter | undefined,
  values: unknown[]
): string {
  const clauses: string[] = [];
  if (filter?.source) {
    values.push(filter.source);
    clauses.push(`source = $${values.length}`);
  }
  if (filter?.projectPath) {
    values.push(filter.projectPath);
    clauses.push(`project_path = $${values.length}`);
  }
  if (filter?.model) {
    values.push(filter.model);
    clauses.push(`model = $${values.length}`);
  }
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}

export class TelemetryStore {
  private readonly db: PGlite;

  private constructor(db: PGlite) {
    this.db = db;
  }

  static async open(dataDir: string): Promise<TelemetryStore> {
    if (!dataDir.startsWith("memory://")) {
      await mkdir(path.dirname(dataDir), { recursive: true });
    }
    const db = dataDir.startsWith("memory://")
      ? new PGlite()
      : new PGlite(dataDir);
    await db.waitReady;
    const store = new TelemetryStore(db);
    await store.migrate();
    return store;
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  async migrate(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        connector_version TEXT NOT NULL,
        session_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        project_name TEXT NOT NULL,
        ts BIGINT NOT NULL,
        seq INTEGER NOT NULL,
        kind TEXT NOT NULL,
        role TEXT,
        model TEXT,
        tokens_in BIGINT DEFAULT 0,
        tokens_out BIGINT DEFAULT 0,
        cache_read_tokens BIGINT DEFAULT 0,
        cache_create_tokens BIGINT DEFAULT 0,
        tool_name TEXT,
        mcp_server TEXT,
        mcp_tool TEXT,
        tool_outcome TEXT,
        permission_mode TEXT,
        latency_ms BIGINT,
        speed DOUBLE PRECISION,
        iterations INTEGER,
        raw_path TEXT NOT NULL,
        raw_line INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS telemetry_events_ts_idx ON telemetry_events (ts);
      CREATE INDEX IF NOT EXISTS telemetry_events_source_idx ON telemetry_events (source);
      CREATE INDEX IF NOT EXISTS telemetry_events_project_idx ON telemetry_events (project_path);
      CREATE INDEX IF NOT EXISTS telemetry_events_metric_idx ON telemetry_events (kind, model, tool_outcome);

      CREATE TABLE IF NOT EXISTS telemetry_cursors (
        file_path TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        connector_version TEXT NOT NULL,
        size BIGINT NOT NULL,
        mtime_ms BIGINT NOT NULL,
        line_offset INTEGER NOT NULL,
        byte_offset BIGINT NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL
      );
      ALTER TABLE telemetry_cursors
        ADD COLUMN IF NOT EXISTS byte_offset BIGINT NOT NULL DEFAULT 0;
    `);
  }

  private rowToCursor(row: CursorRow): IngestCursor {
    return {
      filePath: row.file_path,
      source: row.source,
      connectorVersion: row.connector_version,
      size: num(row.size),
      mtimeMs: num(row.mtime_ms),
      lineOffset: num(row.line_offset),
      byteOffset: num(row.byte_offset),
      updatedAt: num(row.updated_at),
    };
  }

  async getCursor(filePath: string): Promise<IngestCursor | null> {
    const result = await this.db.query<CursorRow>(
      "SELECT * FROM telemetry_cursors WHERE file_path = $1",
      [filePath]
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.rowToCursor(row);
  }

  async getCursors(filePaths: string[]): Promise<Map<string, IngestCursor>> {
    const cursors = new Map<string, IngestCursor>();
    if (filePaths.length === 0) return cursors;

    const chunkSize = 500;
    for (let start = 0; start < filePaths.length; start += chunkSize) {
      const chunk = filePaths.slice(start, start + chunkSize);
      const placeholders = chunk.map((_, index) => `$${index + 1}`).join(", ");
      const result = await this.db.query<CursorRow>(
        `SELECT * FROM telemetry_cursors WHERE file_path IN (${placeholders})`,
        chunk
      );
      for (const row of result.rows) {
        cursors.set(row.file_path, this.rowToCursor(row));
      }
    }

    return cursors;
  }

  async upsertCursor(cursor: IngestCursor): Promise<void> {
    await this.upsertCursors([cursor]);
  }

  async upsertCursors(cursors: IngestCursor[]): Promise<void> {
    if (cursors.length === 0) return;

    const chunkSize = 500;
    for (let start = 0; start < cursors.length; start += chunkSize) {
      const chunk = cursors.slice(start, start + chunkSize);
      const width = 8;
      const values = chunk.flatMap((cursor) => [
        cursor.filePath,
        cursor.source,
        cursor.connectorVersion,
        Math.round(cursor.size),
        Math.round(cursor.mtimeMs),
        cursor.lineOffset,
        Math.round(cursor.byteOffset),
        cursor.updatedAt,
      ]);
      const placeholders = chunk
        .map((_, rowIndex) => {
          const base = rowIndex * width;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        })
        .join(", ");

      await this.db.query(
        `INSERT INTO telemetry_cursors (
          file_path, source, connector_version, size, mtime_ms, line_offset, byte_offset, updated_at
        ) VALUES ${placeholders}
        ON CONFLICT (file_path) DO UPDATE SET
          source = excluded.source,
          connector_version = excluded.connector_version,
          size = excluded.size,
          mtime_ms = excluded.mtime_ms,
          line_offset = excluded.line_offset,
          byte_offset = excluded.byte_offset,
          updated_at = excluded.updated_at`,
        values
      );
    }
  }

  async upsertEvents(events: NormalizedEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    let inserted = 0;
    const chunkSize = 200;
    for (let start = 0; start < events.length; start += chunkSize) {
      const chunk = events.slice(start, start + chunkSize);
      const values = chunk.flatMap(eventToValues);
      const width = EVENT_COLUMNS.length;
      const placeholders = chunk
        .map((_, rowIndex) => {
          const base = rowIndex * width;
          const cells = EVENT_COLUMNS.map(
            (__, colIndex) => `$${base + colIndex + 1}`
          );
          return `(${cells.join(", ")})`;
        })
        .join(", ");
      const result = await this.db.query<{ inserted: number | string }>(
        `WITH inserted AS (
          INSERT INTO telemetry_events (${EVENT_COLUMNS.join(", ")})
          VALUES ${placeholders}
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        )
        SELECT COUNT(*) AS inserted FROM inserted`,
        values
      );
      inserted += num(result.rows[0]?.inserted);
    }
    return inserted;
  }

  async eventsBetween(
    startAt: number,
    endAt: number,
    filter?: TelemetryEventFilter
  ): Promise<NormalizedEvent[]> {
    const values: unknown[] = [Math.round(startAt), Math.round(endAt)];
    const filterSql = whereForFilter(filter, values);
    const result = await this.db.query<EventRow>(
      `SELECT * FROM telemetry_events
       WHERE ts >= $1 AND ts < $2${filterSql}
       ORDER BY ts ASC, seq ASC`,
      values
    );
    return result.rows.map(rowToEvent);
  }

  async eventsSince(
    since: number,
    filter?: TelemetryEventFilter
  ): Promise<NormalizedEvent[]> {
    const values: unknown[] = [Math.round(since)];
    const filterSql = whereForFilter(filter, values);
    const result = await this.db.query<EventRow>(
      `SELECT * FROM telemetry_events
       WHERE ts >= $1${filterSql}
       ORDER BY ts ASC, seq ASC`,
      values
    );
    return result.rows.map(rowToEvent);
  }

  async sourceSummaries(): Promise<LiveTelemetrySource[]> {
    const result = await this.db.query<SourceSummaryRow>(`
      SELECT
        source,
        COUNT(DISTINCT raw_path) AS files,
        COUNT(*) AS events,
        COUNT(DISTINCT session_id) AS sessions,
        MAX(ts) AS last_activity_at
      FROM telemetry_events
      GROUP BY source
    `);
    return result.rows.map((row) => ({
      source: row.source,
      label: row.source === "claude-code" ? "Claude Code" : "Codex",
      status: "watching",
      files: num(row.files),
      events: num(row.events),
      sessions: num(row.sessions),
      lastActivityAt:
        row.last_activity_at == null ? null : num(row.last_activity_at),
    }));
  }
}

export async function openTelemetryStore(
  dataDir: string
): Promise<TelemetryStore> {
  return TelemetryStore.open(dataDir);
}
