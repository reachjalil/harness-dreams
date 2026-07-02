import { appendFileSync, mkdirSync } from "node:fs";
import { inspect } from "node:util";
import path from "node:path";

import { app } from "electron";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_FILE = "harness-health-main.log";

function safeLogsDir(): string {
  try {
    return app.getPath("logs");
  } catch {
    return path.join(process.cwd(), ".harness-health-logs");
  }
}

function serialize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  if (typeof value === "string") return value;
  return inspect(value, { depth: 5, breakLength: 120 });
}

function write(level: LogLevel, message: string, details: unknown[]): void {
  try {
    const dir = safeLogsDir();
    mkdirSync(dir, { recursive: true });
    const suffix =
      details.length > 0 ? ` ${details.map(serialize).join(" ")}` : "";
    appendFileSync(
      path.join(dir, LOG_FILE),
      `${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}\n`,
      "utf8"
    );
  } catch {
    // Logging must never disturb app startup, shutdown, or telemetry ingestion.
  }
}

export const logger = {
  debug(message: string, ...details: unknown[]): void {
    write("debug", message, details);
  },
  info(message: string, ...details: unknown[]): void {
    write("info", message, details);
  },
  warn(message: string, ...details: unknown[]): void {
    write("warn", message, details);
  },
  error(message: string, ...details: unknown[]): void {
    write("error", message, details);
  },
};
