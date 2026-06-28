import { type ReactElement, useState } from "react";

import {
  Button,
  Field,
  PageHeader,
  Segmented,
  SettingsGroup,
  StatusChip,
  Toggle,
} from "./components";
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

  if (!config) return <p className="card-hint">Loading…</p>;

  function sendTest(): void {
    void actions.testNotification();
    setTested(true);
    window.setTimeout(() => setTested(false), 3000);
  }

  const connectorCount = Object.values(config.connectors).filter(
    Boolean
  ).length;
  const nightly = config.schedule.mode === "nightly";

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

        <SettingsGroup title="Privacy" icon={<Icon name="privacy" size={16} />}>
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
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-label">Redacted excerpts</div>
                <div className="settings-row-hint">
                  Secrets are scrubbed; you preview exactly what's sent before
                  anything leaves your Mac.
                </div>
              </div>
            </div>
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
          <div className="connector-row soon">
            <div className="connector-row-main">
              <div className="connector-row-label">Codex</div>
              <div className="connector-row-hint">Coming soon.</div>
            </div>
            <span className="connector-row-tag">Soon</span>
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
          title="Notifications"
          icon={<Icon name="notifications" size={16} />}
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
