import {
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { DEMO_PROJECTS } from "../shared/mock";
import type {
  CloudSyncDeviceKind,
  CloudSyncPairing,
  DiscoveredProject,
  GuidanceApplyMode,
  InsightRunnerProvider,
} from "../shared/types";
import {
  Button,
  Field,
  PageHeader,
  Segmented,
  SettingsGroup,
  StatusChip,
  Toggle,
} from "./components";
import { SETTINGS_TIP } from "./explainers";
import { Icon } from "./icons";
import type { HarnessHealth } from "./useHarnessHealth";

function syncTimeLabel(value: number | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Settings({
  hd,
  onRunHealthReview,
}: {
  hd: HarnessHealth;
  onRunHealthReview: () => void;
}): ReactElement {
  const { config, patch, actions } = hd;
  const [tested, setTested] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pairingName, setPairingName] = useState("Jalil's iPhone");
  const [pairingKind, setPairingKind] = useState<CloudSyncDeviceKind>("iphone");
  const [pairing, setPairing] = useState<CloudSyncPairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const discoveryRequest = useRef(0);

  useEffect(() => {
    if (config?.demoMode) {
      discoveryRequest.current += 1;
      setDiscovered([]);
      setScanning(false);
    }
  }, [config?.demoMode]);

  const refreshDiscovered = useCallback(() => {
    if (config?.demoMode || scanning) return;
    const requestId = discoveryRequest.current + 1;
    discoveryRequest.current = requestId;
    setScanning(true);
    void hd.projects
      .discover()
      .then((projects) => {
        if (discoveryRequest.current === requestId) setDiscovered(projects);
      })
      .finally(() => {
        if (discoveryRequest.current === requestId) setScanning(false);
      });
  }, [config?.demoMode, hd.projects, scanning]);

  if (!config) return <p className="card-hint">Loading…</p>;
  const cfg = config;
  const cloudStatus = hd.cloudSyncStatus;
  const cloudReady = cloudStatus?.configured ?? false;
  const cloudConnected = cloudStatus?.state === "watching";

  function sendTest(): void {
    void actions.testNotification();
    setTested(true);
    window.setTimeout(() => setTested(false), 3000);
  }

  const connectorCount = Object.values(cfg.connectors).filter(Boolean).length;
  const visibleProjects = cfg.demoMode ? DEMO_PROJECTS : cfg.projects;
  const projectCount = visibleProjects.filter(
    (project) => project.enabled
  ).length;
  const daily = cfg.schedule.mode === "daily";
  const priceEntries = Object.keys(config.telemetry.priceTable).length;

  function toggleProject(projectPath: string, enabled: boolean): void {
    patch({
      projects: cfg.projects.map((project) =>
        project.path === projectPath ? { ...project, enabled } : project
      ),
    });
  }

  function addDiscovered(project: DiscoveredProject): void {
    const next = {
      path: project.path,
      name: project.name,
      sources: project.sources,
      enabled: true,
      addedAt: Date.now(),
    };
    patch({
      projects: [
        next,
        ...cfg.projects.filter((item) => item.path !== project.path),
      ],
      connectors: {
        claudeCode:
          cfg.connectors.claudeCode || project.sources.includes("claude-code"),
        codex: cfg.connectors.codex || project.sources.includes("codex"),
      },
    });
    void hd.projects.add(project.path);
  }

  async function createPairing(): Promise<void> {
    setPairingBusy(true);
    setPairingError(null);
    try {
      const next = await hd.cloudSync.pairDevice({
        deviceName: pairingName,
        kind: pairingKind,
      });
      setPairing(next);
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : String(err));
    } finally {
      setPairingBusy(false);
    }
  }

  async function copyPairing(): Promise<void> {
    if (!pairing) return;
    await navigator.clipboard?.writeText(pairing.pairingUrl);
  }

  async function removeDevice(deviceId: string): Promise<void> {
    const devices = await hd.cloudSync.removeDevice(deviceId);
    patch({ cloudSync: { devices } });
    if (pairing?.device.deviceId === deviceId) setPairing(null);
  }

  function startCloudSync(): void {
    if (!config) return;
    if (!config.cloudSync.enabled) {
      patch({ cloudSync: { enabled: true }, companionSyncInterest: true });
      return;
    }
    void hd.cloudSync.syncNow();
  }

  function pairingActionLabel(): string {
    if (pairingBusy) return "Creating...";
    if (pairingKind === "watch") return "Pair Apple Watch";
    return "Pair iPhone";
  }

  function shortId(value: string): string {
    return value.length <= 12
      ? value
      : `${value.slice(0, 8)}…${value.slice(-4)}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Control center"
        title="Harness Health Settings"
        subtitle="Realtime telemetry, reviews, privacy, companion sync, and data."
      />
      <div className="settings-status">
        <StatusChip
          label={daily ? `Daily · ${config.schedule.time}` : "Manual Review"}
          on={daily}
        />
        <StatusChip
          label={config.privacyMode === "local" ? "Local-only" : "Cloud opt-in"}
          on={config.privacyMode === "local"}
        />
        <StatusChip
          label={`${connectorCount} connector${connectorCount === 1 ? "" : "s"}`}
          on={connectorCount > 0}
        />
        <StatusChip
          label={`${projectCount} project${projectCount === 1 ? "" : "s"}`}
          on={projectCount > 0}
        />
        <StatusChip
          label={
            config.notifications ? "Notifications on" : "Notifications off"
          }
          on={config.notifications}
        />
        <StatusChip
          label={config.demoMode ? "Demo data" : "Real data"}
          on={config.demoMode}
        />
        <StatusChip
          label={
            config.cloudSync.enabled
              ? `Private Sync · ${cloudStatus?.state ?? "connecting"}`
              : "Private Sync off"
          }
          on={cloudConnected}
        />
        <StatusChip
          label={`Depth · ${config.analysisDepth}`}
          on={config.analysisDepth !== "light"}
        />
      </div>

      <div className="settings-grid">
        <SettingsGroup
          title="Demo Mode"
          icon={<Icon name="review" size={16} />}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Fictional product tour</div>
              <div className="settings-row-hint">
                Swap in persisted sample projects and health reviews; no LLM,
                repo writes, or pushes run while this is on.
              </div>
            </div>
            <Toggle
              label="Demo mode"
              checked={config.demoMode}
              onChange={(demoMode) => patch({ demoMode })}
            />
          </div>
          {config.demoMode ? (
            <div className="demo-callout">
              <b>Demo mode is active</b>
              <span>
                Review choices, accepted change links, and measured verdicts are
                saved to a separate demo report file.
              </span>
            </div>
          ) : null}
        </SettingsGroup>

        <SettingsGroup
          title="Schedule"
          icon={<Icon name="settings" size={16} />}
          tip={SETTINGS_TIP.schedule}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">When Health Reviews run</div>
              <div className="settings-row-hint">
                Idle nights only — never mid-task.
              </div>
            </div>
            <Segmented
              ariaLabel="Schedule"
              value={config.schedule.mode}
              onChange={(mode) => patch({ schedule: { mode } })}
              options={[
                { value: "daily", label: "Daily" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </div>
          {daily ? (
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-label">Review time</div>
                <div className="settings-row-hint">
                  The periodic health review kicks off at this hour.
                </div>
              </div>
              <Field label="">
                <input
                  type="time"
                  value={config.schedule.time}
                  onChange={(e) =>
                    patch({ schedule: { time: e.target.value } })
                  }
                />
              </Field>
            </div>
          ) : (
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-label">Run on demand</div>
                <div className="settings-row-hint">
                  Start a Health Review anytime from the sidebar or menu bar.
                </div>
              </div>
              <Button variant="accent" onClick={onRunHealthReview}>
                <Icon name="healthReview" size={16} />
                Run Health Review
              </Button>
            </div>
          )}
        </SettingsGroup>

        <SettingsGroup
          title="Privacy"
          icon={<Icon name="privacy" size={16} />}
          tip={SETTINGS_TIP.privacy}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Analysis boundary</div>
              <div className="settings-row-hint">
                Local keeps everything on this Mac.
              </div>
            </div>
            <Segmented
              ariaLabel="Privacy mode"
              value={config.privacyMode}
              onChange={(privacyMode) => patch({ privacyMode })}
              options={[
                { value: "local", label: "Local-only" },
                { value: "cloud", label: "Cloud" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Background insight CLI</div>
              <div className="settings-row-hint">
                {config.privacyMode === "cloud"
                  ? "Runs the selected CLI locally for the insight pass."
                  : "Runs the selected CLI locally; cloud sync is separate."}
              </div>
            </div>
            <Segmented<InsightRunnerProvider>
              ariaLabel="Insight runner"
              value={config.insightRunner.provider}
              onChange={(provider) =>
                patch({
                  insightRunner: {
                    provider,
                    model: provider === "codex" ? "gpt-5.5" : "opus",
                  },
                })
              }
              options={[
                { value: "codex", label: "Codex" },
                { value: "claude-code", label: "Claude Code" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Runner command</div>
              <div className="settings-row-hint">
                Binary path used for the selected CLI runner.
              </div>
            </div>
            <Field label="">
              <input
                value={
                  config.insightRunner.provider === "codex"
                    ? config.insightRunner.codexPath
                    : config.insightRunner.claudePath
                }
                onChange={(e) =>
                  patch({
                    insightRunner:
                      config.insightRunner.provider === "codex"
                        ? { codexPath: e.target.value }
                        : { claudePath: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Insight model</div>
              <div className="settings-row-hint">
                Passed to the CLI with its model flag.
              </div>
            </div>
            <Field label="">
              <input
                value={config.insightRunner.model}
                onChange={(e) =>
                  patch({ insightRunner: { model: e.target.value } })
                }
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Runner timeout</div>
              <div className="settings-row-hint">
                Maximum seconds to wait for the local CLI analysis pass.
              </div>
            </div>
            <Field label="">
              <input
                type="number"
                min={1}
                value={Math.round(config.insightRunner.timeoutMs / 1000)}
                onChange={(e) => {
                  const seconds = Number(e.target.value);
                  if (Number.isFinite(seconds) && seconds > 0) {
                    patch({
                      insightRunner: {
                        timeoutMs: Math.round(seconds) * 1000,
                      },
                    });
                  }
                }}
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Payload privacy</div>
              <div className="settings-row-hint">
                Secrets and local-only details stay on this Mac before the CLI
                analysis pass runs.
              </div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Analysis depth</div>
              <div className="settings-row-hint">
                Deeper finds more, but costs more.
              </div>
            </div>
            <Segmented
              ariaLabel="Analysis depth"
              value={config.analysisDepth}
              onChange={(analysisDepth) => patch({ analysisDepth })}
              options={[
                { value: "light", label: "Light" },
                { value: "standard", label: "Standard" },
                { value: "deep", label: "Deep" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Accepted file changes</div>
              <div className="settings-row-hint">
                Direct local edits are the default. Branch + PR is optional for
                GitHub review workflows.
              </div>
            </div>
            <Segmented<GuidanceApplyMode>
              ariaLabel="Accepted file changes"
              value={config.guidanceApplyMode}
              onChange={(guidanceApplyMode) => patch({ guidanceApplyMode })}
              options={[
                { value: "direct", label: "Direct local" },
                { value: "branch", label: "Branch + PR" },
              ]}
            />
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Realtime Telemetry"
          icon={<Icon name="data" size={16} />}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Harness Health ingestion</div>
              <div className="settings-row-hint">
                Normalized metrics and source pointers are stored locally.
              </div>
            </div>
            <Toggle
              label="Realtime telemetry"
              checked={config.telemetry.enabled}
              onChange={(enabled) => patch({ telemetry: { enabled } })}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">File watcher</div>
              <div className="settings-row-hint">
                Watches local Claude and Codex JSONL files for new rows.
              </div>
            </div>
            <Toggle
              label="File watcher"
              checked={config.telemetry.watch}
              disabled={!config.telemetry.enabled}
              onChange={(watch) => patch({ telemetry: { watch } })}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Retention window</div>
              <div className="settings-row-hint">
                Controls local metric history kept for trends and baselines.
              </div>
            </div>
            <Field label="">
              <input
                type="number"
                min={1}
                max={365}
                value={config.telemetry.retentionDays}
                onChange={(e) => {
                  const retentionDays = Number(e.target.value);
                  if (Number.isFinite(retentionDays)) {
                    patch({
                      telemetry: {
                        retentionDays: Math.round(retentionDays),
                      },
                    });
                  }
                }}
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Raw transcript retention</div>
              <div className="settings-row-hint">
                Off by default; realtime analytics do not need transcript
                bodies.
              </div>
            </div>
            <Toggle
              label="Raw transcript retention"
              checked={config.telemetry.rawTextRetention}
              onChange={(rawTextRetention) =>
                patch({ telemetry: { rawTextRetention } })
              }
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Cost price table</div>
              <div className="settings-row-hint">
                {priceEntries} provider{" "}
                {priceEntries === 1 ? "entry" : "entries"} configured; cost
                stays zero until prices are supplied.
              </div>
            </div>
            <code className="mono-chip">local JSON</code>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Ingest status</div>
              <div className="settings-row-hint">
                {hd.ingestStatus?.message ?? "Waiting for telemetry status."}
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                void hd.telemetry.refresh();
              }}
            >
              <Icon name="sync" size={16} />
              Refresh
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Private Device Sync"
          icon={<Icon name="cloudsync" size={16} />}
        >
          <div className="demo-callout">
            <b>
              {config.cloudSync.devBypassPaidPlan
                ? "Dev demo enabled"
                : "Paid plan required"}
            </b>
            <span>
              The paid plan is only required for the iPhone and Apple Watch
              companion connection. This local build can bypass the paywall for
              demos while keeping the same desktop-owned access model.
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Private Device Sync</div>
              <div className="settings-row-hint">
                One action starts the Mac-owned companion connection.
              </div>
            </div>
            <Button
              variant={config.cloudSync.enabled ? "ghost" : "accent"}
              disabled={config.cloudSync.enabled && !cloudReady}
              onClick={startCloudSync}
            >
              <Icon name="sync" size={16} />
              {config.cloudSync.enabled ? "Refresh peers" : "Start sync"}
            </Button>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Dev paid-plan bypass</div>
              <div className="settings-row-hint">
                On for this demo; production can require the paid entitlement
                after the 2-week trial.
              </div>
            </div>
            <Toggle
              label="Dev paid-plan bypass"
              checked={config.cloudSync.devBypassPaidPlan}
              onChange={(devBypassPaidPlan) =>
                patch({ cloudSync: { devBypassPaidPlan } })
              }
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Signaling server</div>
              <div className="settings-row-hint">
                Used only while pairing or reconnecting WebRTC devices.
              </div>
            </div>
            <Field label="">
              <input
                value={config.cloudSync.cloudApiBaseUrl}
                placeholder="https://sync.example.com"
                onChange={(e) =>
                  patch({ cloudSync: { cloudApiBaseUrl: e.target.value } })
                }
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Desktop-owned user id</div>
              <div className="settings-row-hint">
                Generated locally for account-free pairing.
              </div>
            </div>
            <code className="mono-chip">
              {shortId(config.cloudSync.cloudUserId)}
            </code>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Active connections</div>
              <div className="settings-row-hint">
                WebRTC peers connected to this Mac right now.
              </div>
            </div>
            <code className="mono-chip">
              {cloudStatus?.activeConnections ?? 0}
            </code>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Device name</div>
              <div className="settings-row-hint">
                Published as metadata so conflicts show where a choice came
                from.
              </div>
            </div>
            <Field label="">
              <input
                value={config.cloudSync.deviceName}
                onChange={(e) =>
                  patch({ cloudSync: { deviceName: e.target.value } })
                }
              />
            </Field>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Connectivity</div>
              <div className="settings-row-hint">
                TURN may relay encrypted WebRTC packets when direct STUN fails.
              </div>
            </div>
            <code className="mono-chip">
              {(cloudStatus?.iceMode ?? "unknown").toUpperCase()}
            </code>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">
                Encrypted offline fallback
              </div>
              <div className="settings-row-hint">
                Optional. Stores the latest redacted snapshot as ciphertext so
                phone and watch can refresh when this Mac is offline.
              </div>
            </div>
            <Toggle
              label="Encrypted offline fallback"
              checked={config.cloudSync.backupEnabled}
              onChange={(backupEnabled) =>
                patch({
                  cloudSync: {
                    enabled: config.cloudSync.enabled || backupEnabled,
                    backupEnabled,
                  },
                  companionSyncInterest:
                    backupEnabled || config.companionSyncInterest,
                })
              }
            />
          </div>
          {config.cloudSync.backupEnabled ? (
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-label">Fallback snapshot</div>
                <div className="settings-row-hint">
                  Last encrypted backup:{" "}
                  {syncTimeLabel(cloudStatus?.lastBackedUpAt)} · revision{" "}
                  {cloudStatus?.backupRevision ?? 0}
                </div>
              </div>
              <code className="mono-chip">
                {cloudStatus?.backupConfigured ? "ON" : "SETUP"}
              </code>
            </div>
          ) : null}
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Sync status</div>
              <div className="settings-row-hint">
                {cloudStatus?.message ?? "Waiting for sync status."} Last sync:{" "}
                {syncTimeLabel(cloudStatus?.lastSyncedAt)}.
              </div>
            </div>
          </div>
          <div className="device-pairing">
            <div className="device-pairing-head">
              <div>
                <div className="settings-row-label">Companion sync</div>
                <div className="settings-row-hint">
                  Pair an iPhone or Apple Watch in one QR step.
                </div>
              </div>
            </div>
            <div className="pairing-controls">
              <Field label="Name">
                <input
                  value={pairingName}
                  onChange={(e) => setPairingName(e.target.value)}
                />
              </Field>
              <Segmented<CloudSyncDeviceKind>
                ariaLabel="Device kind"
                value={pairingKind}
                onChange={setPairingKind}
                options={[
                  { value: "iphone", label: "iPhone" },
                  { value: "watch", label: "Watch" },
                ]}
              />
              <Button
                variant="accent"
                disabled={pairingBusy}
                onClick={() => void createPairing()}
              >
                <Icon name="qr" size={16} />
                {pairingActionLabel()}
              </Button>
            </div>
            {pairing ? (
              <div className="pairing-card">
                <img
                  className="pairing-qr"
                  src={pairing.qrDataUrl}
                  alt={`Pair ${pairing.device.deviceName}`}
                />
                <div className="pairing-card-main">
                  <div className="settings-row-label">
                    {pairing.device.deviceName}
                  </div>
                  <div className="settings-row-hint">
                    Expires at {syncTimeLabel(pairing.expiresAt)} ·{" "}
                    {shortId(pairing.device.deviceId)}
                  </div>
                  <div className="pairing-url">
                    Signal: {pairing.cloudApiBaseUrl}
                  </div>
                  <div className="row">
                    <Button onClick={() => void copyPairing()}>
                      <Icon name="copy" size={15} />
                      Copy link
                    </Button>
                    <Button variant="ghost" onClick={() => setPairing(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {pairingError ? (
              <p className="settings-empty">{pairingError}</p>
            ) : null}
            {config.cloudSync.devices.length > 0 ? (
              <div className="device-list">
                {config.cloudSync.devices.map((device) => (
                  <div key={device.deviceId} className="device-row">
                    <div className="device-row-main">
                      <div className="project-row-label">
                        {device.deviceName}
                      </div>
                      <div className="project-row-hint">
                        {device.kind} · {device.status} ·{" "}
                        {shortId(device.deviceId)}
                      </div>
                      <div className="project-row-hint">
                        Last seen: {syncTimeLabel(device.lastSeenAt)}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => void removeDevice(device.deviceId)}
                    >
                      <Icon name="trash" size={15} />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-empty">No paired devices yet.</p>
            )}
          </div>
          <div className="demo-callout">
            <b>Direct by default</b>
            <span>
              Cloudflare routes encrypted signaling while devices connect. If
              encrypted fallback is enabled, it stores only ciphertext for the
              latest snapshot; your devices decrypt it locally.
            </span>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Connectors"
          icon={<Icon name="connectors" size={16} />}
          tip={SETTINGS_TIP.connectors}
        >
          <div className="connector-row">
            <div className="connector-row-main">
              <div className="connector-row-label">Claude Code</div>
              <div className="connector-row-hint">
                Reads ~/.claude/projects — transcripts, usage, config.
              </div>
            </div>
            <Toggle
              label="Claude Code"
              checked={config.connectors.claudeCode}
              onChange={(claudeCode) => patch({ connectors: { claudeCode } })}
            />
          </div>
          <div className="connector-row">
            <div className="connector-row-main">
              <div className="connector-row-label">Codex</div>
              <div className="connector-row-hint">
                Reads ~/.codex sessions and archived sessions.
              </div>
            </div>
            <Toggle
              label="Codex"
              checked={config.connectors.codex}
              onChange={(codex) => patch({ connectors: { codex } })}
            />
          </div>
          <div className="connector-row soon">
            <div className="connector-row-main">
              <div className="connector-row-label">Cursor</div>
              <div className="connector-row-hint">Coming soon.</div>
            </div>
            <span className="connector-row-tag">Soon</span>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Projects"
          icon={<Icon name="data" size={16} />}
          tip={SETTINGS_TIP.projects}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Analysis scope</div>
              <div className="settings-row-hint">
                {config.demoMode
                  ? "Demo reviews use fictional repos and do not read local transcripts."
                  : "Health Reviews read local Claude and Codex data for enabled projects."}
              </div>
            </div>
            <Button
              disabled={config.demoMode || scanning}
              onClick={refreshDiscovered}
            >
              <Icon name="reset" size={16} />
              {scanning ? "Scanning..." : "Refresh"}
            </Button>
          </div>
          {visibleProjects.length === 0 ? (
            <p className="settings-empty">
              No projects selected yet. Add one from discovered local activity.
            </p>
          ) : (
            <div className="project-list">
              {visibleProjects.map((project) => (
                <div key={project.path} className="project-row">
                  <div className="project-row-main">
                    <div className="project-row-label">{project.name}</div>
                    <div className="project-row-hint">
                      {project.sources.join(" + ")} · {project.path}
                    </div>
                  </div>
                  <Toggle
                    label={project.name}
                    checked={project.enabled}
                    disabled={config.demoMode}
                    onChange={(enabled) => toggleProject(project.path, enabled)}
                  />
                </div>
              ))}
            </div>
          )}
          {!config.demoMode ? (
            <div className="project-list">
              {discovered
                .filter(
                  (project) =>
                    !config.projects.some(
                      (current) => current.path === project.path
                    )
                )
                .slice(0, 8)
                .map((project) => (
                  <div key={project.path} className="project-row">
                    <div className="project-row-main">
                      <div className="project-row-label">{project.name}</div>
                      <div className="project-row-hint">
                        {project.sources.join(" + ")} · {project.sessionCount}{" "}
                        sessions
                      </div>
                      <div className="project-row-hint">{project.path}</div>
                    </div>
                    <Button onClick={() => addDiscovered(project)}>
                      <Icon name="queue" size={15} />
                      Add
                    </Button>
                  </div>
                ))}
            </div>
          ) : null}
        </SettingsGroup>

        <SettingsGroup
          title="Notifications"
          icon={<Icon name="notifications" size={16} />}
          tip={SETTINGS_TIP.notifications}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Morning notification</div>
              <div className="settings-row-hint">
                A single nudge when a fresh Health Review is ready.
              </div>
            </div>
            <Toggle
              label="Morning notification"
              checked={config.notifications}
              onChange={(notifications) => patch({ notifications })}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Test delivery</div>
              <div className="settings-row-hint">
                Confirm macOS notifications reach you.
              </div>
            </div>
            <Button onClick={sendTest}>
              <Icon name="notifications" size={16} />
              {tested ? (
                <>
                  Sent <Icon name="accept" size={14} />
                </>
              ) : (
                "Send a test"
              )}
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Appearance & startup"
          icon={<Icon name="appearance" size={16} />}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Reduce motion</div>
              <div className="settings-row-hint">
                Calm the review pulse and transitions.
              </div>
            </div>
            <Toggle
              label="Reduce motion"
              checked={config.reduceMotion}
              onChange={(reduceMotion) => patch({ reduceMotion })}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Launch at login</div>
              <div className="settings-row-hint">
                Start Harness Health quietly in the menu bar.
              </div>
            </div>
            <Toggle
              label="Launch at login"
              checked={config.launchAtLogin}
              onChange={(value) => void actions.setLaunchAtLogin(value)}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Show setup on launch</div>
              <div className="settings-row-hint">
                Replay the welcome flow each time Harness Health starts.
              </div>
            </div>
            <Toggle
              label="Show setup on launch"
              checked={config.showOnboardingOnLaunch}
              onChange={(showOnboardingOnLaunch) =>
                patch({ showOnboardingOnLaunch })
              }
            />
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Data"
          icon={<Icon name="data" size={16} />}
          danger
          tip={SETTINGS_TIP.data}
        >
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Local file</div>
              <div className="settings-row-hint">
                Everything is a single local file. You own it; you can wipe it.
              </div>
            </div>
            <div className="row">
              <Button onClick={() => void actions.revealData()}>
                <Icon name="external" size={16} />
                Show in Finder
              </Button>
              <Button onClick={() => void actions.resetOnboarding()}>
                <Icon name="reset" size={16} />
                Replay onboarding
              </Button>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Reset everything</div>
              <div className="settings-row-hint">
                Erase all reports and settings on this Mac.
              </div>
            </div>
            <div className="row">
              {confirmReset ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      void actions.resetAll();
                      setConfirmReset(false);
                    }}
                  >
                    <Icon name="reset" size={16} />
                    Yes, reset
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmReset(true)}>
                  <Icon name="reset" size={16} />
                  Reset all data…
                </Button>
              )}
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="About" icon={<Icon name="about" size={16} />}>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Harness Health v0.1.0</div>
              <div className="settings-row-hint">
                Local-first · real local sessions ·{" "}
                <a href="https://github.com/reachjalil/harness-health">
                  github.com/reachjalil/harness-health
                </a>
              </div>
            </div>
            <Button variant="ghost" onClick={() => void actions.quit()}>
              <Icon name="quit" size={16} />
              Quit
            </Button>
          </div>
        </SettingsGroup>
      </div>
    </>
  );
}
