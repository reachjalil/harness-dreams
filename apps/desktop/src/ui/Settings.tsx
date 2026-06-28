import { type ReactElement, useEffect, useState } from "react";

import type { DiscoveredProject, RemRunnerProvider } from "../shared/types";
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

  useEffect(() => {
    setScanning(true);
    void hd.projects
      .discover()
      .then(setDiscovered)
      .finally(() => setScanning(false));
  }, [hd.projects]);

  if (!config) return <p className="card-hint">Loading…</p>;
  const cfg = config;

  function sendTest(): void {
    void actions.testNotification();
    setTested(true);
    window.setTimeout(() => setTested(false), 3000);
  }

  const connectorCount = Object.values(cfg.connectors).filter(Boolean).length;
  const projectCount = cfg.projects.filter((project) => project.enabled).length;
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
          label={`Depth · ${config.analysisDepth}`}
          on={config.analysisDepth !== "light"}
        />
      </div>

      <div className="settings-grid">
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
                Sleep Cycles read local Claude and Codex data for enabled
                projects.
              </div>
            </div>
            <Button
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
          {config.projects.length === 0 ? (
            <p className="settings-empty">
              No projects selected yet. Add one from discovered local activity.
            </p>
          ) : (
            <div className="project-list">
              {config.projects.map((project) => (
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
                    onChange={(enabled) => toggleProject(project.path, enabled)}
                  />
                </div>
              ))}
            </div>
          )}
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
                Local-first · mock build ·{" "}
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
