import type { ReactElement } from "react";

import { Button, Section, Segmented, Toggle } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

export default function Settings({ hd }: { hd: HarnessDreams }): ReactElement {
  const { config, patch, actions } = hd;

  if (!config) return <p className="card-hint">Loading…</p>;

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
          <p className="card-hint sched-note">
            Runs around {config.schedule.time} when idle.
          </p>
        ) : null}
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

      <Section title="App">
        <Toggle
          label="Morning notification"
          hint="A single nudge when a fresh dream is ready."
          checked={config.notifications}
          onChange={(notifications) => patch({ notifications })}
        />
        <Toggle
          label="Launch at login"
          checked={config.launchAtLogin}
          onChange={(value) => void actions.setLaunchAtLogin(value)}
        />
      </Section>

      <Section
        title="Try it"
        hint="Simulate an overnight dream right now (mock data)."
      >
        <div className="row">
          <Button variant="accent" onClick={() => void actions.dreamNow()}>
            Dream now
          </Button>
        </div>
      </Section>

      <div className="footer">
        Local-first · you stay in control · mock build
        <br />
        <button
          type="button"
          className="linkbtn"
          onClick={() => void actions.quit()}
        >
          Quit Harness Dreams
        </button>
      </div>
    </>
  );
}
