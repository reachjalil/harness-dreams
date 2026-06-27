import { type ReactElement, useState } from "react";

import { Button, Field, Section, Segmented, Toggle } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

export default function Settings({ hd }: { hd: HarnessDreams }): ReactElement {
  const { config, patch, actions } = hd;
  const [tested, setTested] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!config) return <p className="card-hint">Loading…</p>;

  function sendTest(): void {
    void actions.testNotification();
    setTested(true);
    window.setTimeout(() => setTested(false), 3000);
  }

  return (
    <>
      <Section
        title="Schedule"
        hint="When the overnight dream runs. Idle nights only — never mid-task."
      >
        <Segmented
          ariaLabel="Schedule"
          value={config.schedule.mode}
          onChange={(mode) => patch({ schedule: { mode } })}
          options={[
            { value: "nightly", label: "Every night" },
            { value: "manual", label: "Only when I ask" },
          ]}
        />
        {config.schedule.mode === "nightly" ? (
          <Field label="Dream time">
            <input
              type="time"
              className="time-input"
              value={config.schedule.time}
              onChange={(e) => patch({ schedule: { time: e.target.value } })}
            />
          </Field>
        ) : (
          <p className="card-hint sched-note">
            Start a dream anytime from the menu bar.
          </p>
        )}
      </Section>

      <Section
        title="Privacy"
        hint="Local-only keeps everything on this Mac. Cloud sends redacted excerpts for richer insight."
      >
        <Segmented
          ariaLabel="Privacy mode"
          value={config.privacyMode}
          onChange={(privacyMode) => patch({ privacyMode })}
          options={[
            { value: "local", label: "Local-only" },
            { value: "cloud", label: "Cloud (opt-in)" },
          ]}
        />
        {config.privacyMode === "cloud" ? (
          <p className="card-hint sched-note">
            Secrets are scrubbed and you'll preview exactly what's sent before
            anything leaves your Mac.
          </p>
        ) : null}
      </Section>

      <Section
        title="Analysis depth"
        hint="How thorough the dream is. Deeper finds more but costs more."
      >
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
      </Section>

      <Section
        title="Connectors"
        hint="Which harnesses Harness Dreams reflects on."
      >
        <Toggle
          label="Claude Code"
          hint="Reads ~/.claude/projects — transcripts, usage, config."
          checked={config.connectors.claudeCode}
          onChange={(claudeCode) => patch({ connectors: { claudeCode } })}
        />
        <Toggle
          label="Codex"
          hint="Coming soon."
          checked={config.connectors.codex}
          disabled
          onChange={() => undefined}
        />
        <Toggle
          label="Cursor"
          hint="Coming soon."
          checked={config.connectors.cursor}
          disabled
          onChange={() => undefined}
        />
      </Section>

      <Section title="Notifications">
        <Toggle
          label="Morning notification"
          hint="A single nudge when a fresh dream is ready."
          checked={config.notifications}
          onChange={(notifications) => patch({ notifications })}
        />
        <div className="row">
          <Button onClick={sendTest}>
            {tested ? "Sent ✓ — check the corner" : "Send a test notification"}
          </Button>
        </div>
      </Section>

      <Section title="Appearance & startup">
        <Toggle
          label="Reduce motion"
          hint="Calm the dreaming pulse and transitions."
          checked={config.reduceMotion}
          onChange={(reduceMotion) => patch({ reduceMotion })}
        />
        <Toggle
          label="Launch at login"
          hint="Start Harness Dreams quietly in the menu bar."
          checked={config.launchAtLogin}
          onChange={(value) => void actions.setLaunchAtLogin(value)}
        />
      </Section>

      <Section
        title="Data"
        hint="Everything is a single local file. You own it; you can wipe it."
      >
        <div className="row">
          <Button onClick={() => void actions.revealData()}>
            Show config in Finder
          </Button>
          <Button onClick={() => void actions.resetOnboarding()}>
            Replay onboarding
          </Button>
        </div>
        <div className="row">
          {confirmReset ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  void actions.resetAll();
                  setConfirmReset(false);
                }}
              >
                Yes, reset everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset all data…
            </Button>
          )}
        </div>
      </Section>

      <Section title="Try it" hint="Simulate an overnight dream right now.">
        <div className="row">
          <Button variant="accent" onClick={() => void actions.dreamNow()}>
            Dream now
          </Button>
        </div>
      </Section>

      <div className="footer">
        Harness Dreams v0.1.0 · local-first · mock build
        <br />
        <a href="https://github.com/reachjalil/harness-dreams">
          github.com/reachjalil/harness-dreams
        </a>
        {" · "}
        <button
          type="button"
          className="linkbtn"
          onClick={() => void actions.quit()}
        >
          Quit
        </button>
      </div>
    </>
  );
}
