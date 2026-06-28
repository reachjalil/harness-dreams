import { type ReactElement, useEffect, useState } from "react";

import { DEMO_PROJECTS } from "../shared/mock";
import type {
  CloudSyncDeviceKind,
  CloudSyncPairing,
  DiscoveredProject,
  RemRunnerProvider,
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
import type { HarnessDreams } from "./useHarnessDreams";

function syncTimeLabel(value: number | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Settings({
  hd,
  onRunSleepCycle,
}: {
  hd: HarnessDreams;
  onRunSleepCycle: () => void;
}): ReactElement {
  const { config, patch, actions } = hd;
  const [tested, setTested] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pairingName, setPairingName] = useState("Jalil's iPhone");
  const [pairingKind, setPairingKind] =
    useState<CloudSyncDeviceKind>("iphone");
  const [pairing, setPairing] = useState<CloudSyncPairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.demoMode) {
      setDiscovered([]);
      setScanning(false);
      return;
    }
    setScanning(true);
    void hd.projects
      .discover()
      .then(setDiscovered)
      .finally(() => setScanning(false));
  }, [config?.demoMode, hd.projects]);

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
  const nightly = cfg.schedule.mode === "nightly";

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

  function shortId(value: string): string {
    return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Control center"
        title="Settings"
        subtitle="Schedule, privacy, connectors, and data."
      />
      <div className="settings-status">
        <StatusChip
          label={
            nightly ? `Nightly · ${config.schedule.time}` : "Manual Sleep Cycle"
          }
          on={nightly}
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
              ? `Cloud Sync · ${cloudStatus?.state ?? "connecting"}`
              : "Cloud Sync off"
          }
          on={cloudConnected}
        />
        <StatusChip
          label={`Depth · ${config.analysisDepth}`}
          on={config.analysisDepth !== "light"}
        />
      </div>

      <div className="settings-grid">
        <SettingsGroup title="Demo Mode" icon={<Icon name="cycle" size={16} />}>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Fictional product tour</div>
              <div className="settings-row-hint">
                Swap in persisted sample projects and Sleep Cycles; no LLM, repo
                writes, or pushes run while this is on.
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
                Review choices, accepted branch links, and measured verdicts are
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
              <div className="settings-row-label">
                When the Sleep Cycle runs
              </div>
              <div className="settings-row-hint">
                Idle nights only — never mid-task.
              </div>
            </div>
            <Segmented
              ariaLabel="Schedule"
              value={config.schedule.mode}
              onChange={(mode) => patch({ schedule: { mode } })}
              options={[
                { value: "nightly", label: "Nightly" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </div>
          {nightly ? (
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-label">Sleep Cycle time</div>
                <div className="settings-row-hint">
                  The overnight review kicks off at this hour.
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
                  Start a Sleep Cycle anytime from the sidebar or menu bar.
                </div>
              </div>
              <Button variant="accent" onClick={onRunSleepCycle}>
                <Icon name="dream" size={16} />
                Run Sleep Cycle
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
          {config.privacyMode === "cloud" ? (
            <>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">REM runner</div>
                  <div className="settings-row-hint">
                    Runs the selected CLI locally; no agent SDK is used.
                  </div>
                </div>
                <Segmented<RemRunnerProvider>
                  ariaLabel="REM runner"
                  value={config.remRunner.provider}
                  onChange={(provider) => patch({ remRunner: { provider } })}
                  options={[
                    { value: "claude-code", label: "Claude Code" },
                    { value: "codex", label: "Codex" },
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
                      config.remRunner.provider === "codex"
                        ? config.remRunner.codexPath
                        : config.remRunner.claudePath
                    }
                    onChange={(e) =>
                      patch({
                        remRunner:
                          config.remRunner.provider === "codex"
                            ? { codexPath: e.target.value }
                            : { claudePath: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">REM model</div>
                  <div className="settings-row-hint">
                    Passed to the CLI with its model flag.
                  </div>
                </div>
                <Field label="">
                  <input
                    value={config.remRunner.model}
                    onChange={(e) =>
                      patch({ remRunner: { model: e.target.value } })
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
                    value={Math.round(config.remRunner.timeoutMs / 1000)}
                    onChange={(e) => {
                      const seconds = Number(e.target.value);
                      if (Number.isFinite(seconds) && seconds > 0) {
                        patch({
                          remRunner: {
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
                  <div className="settings-row-label">Redacted excerpts</div>
                  <div className="settings-row-hint">
                    Secrets are scrubbed before the configured CLI receives the
                    REM payload.
                  </div>
                </div>
              </div>
            </>
          ) : null}
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
        </SettingsGroup>

        <SettingsGroup
          title="Cloud Sync"
          icon={<Icon name="cloudsync" size={16} />}
        >
          <div className="demo-callout">
            <b>{config.cloudSync.devBypassPaidPlan ? "Dev demo enabled" : "Paid plan required"}</b>
            <span>
              Cloud Sync remains a paid-plan feature. This local build can
              bypass the paywall for demos while keeping the same desktop-owned
              access model.
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Cloud Sync access</div>
              <div className="settings-row-hint">
                The desktop owns sync credentials, device JWTs, and removals.
              </div>
            </div>
            <Toggle
              label="Cloud Sync"
              checked={config.cloudSync.enabled}
              onChange={(enabled) =>
                patch({ cloudSync: { enabled }, cloudSyncInterest: enabled })
              }
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-label">Dev paid-plan bypass</div>
              <div className="settings-row-hint">
                On for this demo; production can require the paid entitlement.
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
          {config.cloudSync.enabled ? (
            <>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Atlas URI</div>
                  <div className="settings-row-hint">
                    Leave blank to use HARNESS_DREAMS_MONGODB_URI.
                  </div>
                </div>
                <Field label="">
                  <input
                    type="password"
                    value={config.cloudSync.atlasUri}
                    placeholder="mongodb+srv://..."
                    onChange={(e) =>
                      patch({ cloudSync: { atlasUri: e.target.value } })
                    }
                  />
                </Field>
              </div>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Database</div>
                  <div className="settings-row-hint">
                    Collections: sleep_cycles, sleep_cycle_decisions,
                    sync_devices.
                  </div>
                </div>
                <Field label="">
                  <input
                    value={config.cloudSync.databaseName}
                    onChange={(e) =>
                      patch({ cloudSync: { databaseName: e.target.value } })
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
                <code className="mono-chip">{shortId(config.cloudSync.userId)}</code>
              </div>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Device name</div>
                  <div className="settings-row-hint">
                    Published to Atlas so conflicts show where a choice came
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
                  <div className="settings-row-label">Poll fallback</div>
                  <div className="settings-row-hint">
                    Change streams apply changes immediately when Atlas allows
                    them.
                  </div>
                </div>
                <Field label="">
                  <input
                    type="number"
                    min={5}
                    value={Math.round(config.cloudSync.syncIntervalMs / 1000)}
                    onChange={(e) => {
                      const seconds = Number(e.target.value);
                      if (Number.isFinite(seconds) && seconds >= 5) {
                        patch({
                          cloudSync: {
                            syncIntervalMs: Math.round(seconds) * 1000,
                          },
                        });
                      }
                    }}
                  />
                </Field>
              </div>
              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Sync status</div>
                  <div className="settings-row-hint">
                    {cloudStatus?.message ?? "Waiting for sync status."} Last
                    sync: {syncTimeLabel(cloudStatus?.lastSyncedAt)}.
                  </div>
                  <div className="settings-row-hint">
                    Device id: {config.cloudSync.deviceId}
                  </div>
                </div>
                <Button
                  disabled={!cloudReady}
                  onClick={() => void hd.cloudSync.syncNow()}
                >
                  <Icon name="sync" size={16} />
                  Sync now
                </Button>
              </div>
              <div className="device-pairing">
                <div className="device-pairing-head">
                  <div>
                    <div className="settings-row-label">Device management</div>
                    <div className="settings-row-hint">
                      Add a phone or watch with a QR code. Removing a device
                      invalidates its JWT for future reads and writes.
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
                      { value: "ipad", label: "iPad" },
                      { value: "watch", label: "Watch" },
                    ]}
                  />
                  <Button
                    variant="accent"
                    disabled={pairingBusy}
                    onClick={() => void createPairing()}
                  >
                    <Icon name="qr" size={16} />
                    {pairingBusy ? "Creating..." : "Add device"}
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
                      <div className="pairing-url">{pairing.pairingUrl}</div>
                      <div className="row">
                        <Button onClick={() => void copyPairing()}>
                          <Icon name="copy" size={15} />
                          Copy link
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setPairing(null)}
                        >
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
                <b>Cycle signal only</b>
                <span>
                  Atlas receives report summaries, scores, findings, and action
                  states. Transcript files, code, local repo paths, and patch
                  snippets stay on this Mac.
                </span>
              </div>
            </>
          ) : null}
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
                  ? "Demo cycles use fictional repos and do not read local transcripts."
                  : "Sleep Cycles read local Claude and Codex data for enabled projects."}
              </div>
            </div>
            <Button
              disabled={config.demoMode}
              onClick={() => {
                setScanning(true);
                void hd.projects
                  .discover()
                  .then(setDiscovered)
                  .finally(() => setScanning(false));
              }}
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
                A single nudge when a fresh Sleep Cycle is ready.
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
                Calm the dreaming pulse and transitions.
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
                Start Harness Dreams quietly in the menu bar.
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
                Replay the welcome flow each time Harness Dreams starts.
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
              <div className="settings-row-label">Harness Dreams v0.1.0</div>
              <div className="settings-row-hint">
                Local-first · real local sessions ·{" "}
                <a href="https://github.com/reachjalil/harness-dreams">
                  github.com/reachjalil/harness-dreams
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
