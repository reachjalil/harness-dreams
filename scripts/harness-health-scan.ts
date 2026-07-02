import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  HarnessKind,
  LiveTelemetrySource,
} from "../apps/desktop/src/shared/types.ts";

type AnalyticsModule =
  typeof import("../apps/desktop/src/main/telemetryAnalytics.ts");
type ConnectorsModule =
  typeof import("../apps/desktop/src/main/telemetryConnectors.ts");
type ScannerModule =
  typeof import("../apps/desktop/src/main/harnessConfigScanner.ts");
type StoreModule = typeof import("../apps/desktop/src/main/telemetryStore.ts");

const DAY = 24 * 60 * 60 * 1000;

function unwrapModule<T>(module: T & { "module.exports"?: T; default?: T }): T {
  return module["module.exports"] ?? module.default ?? module;
}

function labelFor(source: HarnessKind): string {
  return source === "claude-code" ? "Claude Code" : "Codex";
}

function mergeSources(
  summaries: LiveTelemetrySource[],
  sources: HarnessKind[],
  fileCounts: Map<HarnessKind, number>
): LiveTelemetrySource[] {
  const bySource = new Map(
    summaries.map((summary) => [summary.source, summary])
  );
  return sources.map((source) => {
    const existing = bySource.get(source);
    const files = Math.max(existing?.files ?? 0, fileCounts.get(source) ?? 0);
    return existing
      ? { ...existing, files, label: labelFor(source) }
      : {
          source,
          label: labelFor(source),
          status: files > 0 ? "watching" : "missing",
          files,
          events: 0,
          sessions: 0,
          lastActivityAt: null,
        };
  });
}

async function main(): Promise<void> {
  const analytics = unwrapModule<AnalyticsModule>(
    await import("../apps/desktop/src/main/telemetryAnalytics.ts")
  );
  const connectors = unwrapModule<ConnectorsModule>(
    await import("../apps/desktop/src/main/telemetryConnectors.ts")
  );
  const scanner = unwrapModule<ScannerModule>(
    await import("../apps/desktop/src/main/harnessConfigScanner.ts")
  );
  const storeModule = unwrapModule<StoreModule>(
    await import("../apps/desktop/src/main/telemetryStore.ts")
  );
  const now = Date.now();
  const homeDir = process.env.HARNESS_HEALTH_HOME || os.homedir();
  const projectRoot = process.env.HARNESS_HEALTH_PROJECT || process.cwd();
  const tmp = await mkdtemp(path.join(os.tmpdir(), "harness-health-"));
  const store = await storeModule.openTelemetryStore(path.join(tmp, "pglite"));
  try {
    const files = await connectors.discoverTelemetryFiles(homeDir);
    const result = await connectors.ingestTelemetryFiles(store, { files, now });
    const fileCounts = new Map<HarnessKind, number>();
    for (const file of files) {
      fileCounts.set(file.source, (fileCounts.get(file.source) ?? 0) + 1);
    }
    const sources = [...new Set(files.map((file) => file.source))];
    const [events, summaries, configArtifacts] = await Promise.all([
      store.eventsSince(now - 90 * DAY),
      store.sourceSummaries(),
      scanner.scanHarnessConfig({
        projectPaths: [projectRoot],
        workspacePath: projectRoot,
        homeDir,
        now,
      }),
    ]);
    const status = {
      state: "idle" as const,
      message: "Headless scan completed.",
      startedAt: now,
      finishedAt: Date.now(),
      filesDiscovered: result.filesDiscovered,
      filesChanged: result.filesChanged,
      eventsIngested: result.eventsIngested,
      cursorsUpdated: result.cursorsUpdated,
    };
    const snapshot = analytics.buildTelemetrySnapshot({
      events,
      sources: mergeSources(summaries, sources, fileCounts),
      configArtifacts,
      status,
      now,
    });
    process.stdout.write(`${JSON.stringify({ status, snapshot }, null, 2)}\n`);
  } finally {
    await store.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
