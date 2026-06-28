import { type ReactElement, useEffect, useMemo, useState } from "react";

import type {
  AnalysisProject,
  DiscoveredProject,
  PrivacyMode,
  RemRunnerProvider,
  ScheduleMode,
} from "../shared/types";
import {
  CLOUD_SYNC_CADENCE,
  CLOUD_SYNC_PRICE,
  CLOUD_SYNC_TAGLINE,
} from "./cloudSync";
import { BrandMark, Button, Field } from "./components";
import { Icon } from "./icons";
import type { HarnessDreams } from "./useHarnessDreams";

const PRIVACY_OPTIONS: { value: PrivacyMode; title: string; sub: string }[] = [
  {
    value: "local",
    title: "Local-only",
    sub: "Everything stays on your Mac. Vitals & trends, no cloud.",
  },
  {
    value: "cloud",
    title: "Cloud analysis (opt-in)",
    sub: "Send redacted excerpts for richer insights. You can preview redaction first.",
  },
];

const SCHEDULE_OPTIONS: { value: ScheduleMode; title: string; sub: string }[] =
  [
    {
      value: "nightly",
      title: "Every night",
      sub: "Dream automatically at 3:00 AM when your harness is idle.",
    },
    {
      value: "manual",
      title: "Only when I ask",
      sub: "No automatic dreams — start one from the menu bar anytime.",
    },
  ];

export default function Onboarding({
  hd,
}: {
  hd: HarnessDreams;
}): ReactElement {
  const { actions, patch, projects } = hd;
  const [step, setStep] = useState(0);
  const [privacy, setPrivacy] = useState<PrivacyMode>("local");
  const [remProvider, setRemProvider] = useState<RemRunnerProvider>("claude-code");
  const [remModel, setRemModel] = useState(
    hd.config?.remRunner.model ?? "opus"
  );
  const [remClaudePath, setRemClaudePath] = useState(
    hd.config?.remRunner.claudePath ?? "claude"
  );
  const [remCodexPath, setRemCodexPath] = useState(
    hd.config?.remRunner.codexPath ?? "codex"
  );
  const [remTimeoutSeconds, setRemTimeoutSeconds] = useState(
    Math.round((hd.config?.remRunner.timeoutMs ?? 180_000) / 1000)
  );
  const [schedule, setSchedule] = useState<ScheduleMode>("nightly");
  const [cloudSync, setCloudSync] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState(false);
  const lastStep = 5;

  useEffect(() => {
    if (step !== 2 || discovered.length > 0 || scanning) return;
    setScanning(true);
    void projects
      .discover()
      .then((items) => {
        const top = items.slice(0, 8);
        setDiscovered(top);
        setSelected(
          Object.fromEntries(top.slice(0, 3).map((item) => [item.path, true]))
        );
      })
      .finally(() => setScanning(false));
  }, [discovered.length, projects, scanning, step]);

  const selectedProjects = useMemo(
    () => discovered.filter((project) => selected[project.path]),
    [discovered, selected]
  );

  function finish(): void {
    const added: AnalysisProject[] = selectedProjects.map((project) => ({
      path: project.path,
      name: project.name,
      sources: project.sources,
      enabled: true,
      addedAt: Date.now(),
    }));
    patch({
      privacyMode: privacy,
      remRunner: {
        provider: remProvider,
        model: remModel.trim() || "opus",
        claudePath: remClaudePath.trim() || "claude",
        codexPath: remCodexPath.trim() || "codex",
        timeoutMs: Math.max(1, Math.round(remTimeoutSeconds)) * 1000,
      },
      schedule: { mode: schedule },
      cloudSyncInterest: cloudSync,
      projects: added,
      connectors: {
        claudeCode: added.some((project) =>
          project.sources.includes("claude-code")
        ),
        codex: added.some((project) => project.sources.includes("codex")),
      },
    });
    void actions.completeOnboarding();
  }

  function next(): void {
    if (step >= lastStep) finish();
    else setStep(step + 1);
  }

  return (
    <div className="onb">
      <div className="titlebar" />
      <div className="onb-body">
        {step === 0 ? (
          <>
            <div className="onb-mark-wrap">
              <BrandMark size={66} />
            </div>
            <h2>Harness Dreams</h2>
            <p>
              Your harness health app. While your coding tools sleep, Harness
              Dreams reflects on the day — so you wake up a little sharper than
              you went to bed.
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2>While you sleep, it works</h2>
            <p>One quiet loop, every day.</p>
            <ul className="onb-list">
              <li>
                <span className="num">1</span>
                <div>
                  <b>Sleep.</b> Your harness writes a full diary of the day.
                </div>
              </li>
              <li>
                <span className="num">2</span>
                <div>
                  <b>Dream.</b> Overnight, it reviews sessions, finds patterns,
                  and drafts suggested goals.
                </div>
              </li>
              <li>
                <span className="num">3</span>
                <div>
                  <b>Reflect.</b> Each morning, a health report — accept useful
                  findings, track goals.
                </div>
              </li>
            </ul>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>Add projects</h2>
            <p>Choose the local projects Harness Dreams should analyze.</p>
            <div className="choices project-choices">
              {scanning ? (
                <div className="choice">Scanning local data...</div>
              ) : null}
              {!scanning && discovered.length === 0 ? (
                <div className="choice">
                  No Claude or Codex projects found yet.
                </div>
              ) : null}
              {discovered.slice(0, 8).map((project) => (
                <button
                  key={project.path}
                  type="button"
                  className={`choice${selected[project.path] ? " selected" : ""}`}
                  onClick={() =>
                    setSelected((current) => ({
                      ...current,
                      [project.path]: !current[project.path],
                    }))
                  }
                >
                  <div className="choice-title">
                    <Icon name="data" size={15} />
                    {project.name}
                  </div>
                  <div className="choice-sub">
                    {project.sources.join(" + ")} · {project.sessionCount}{" "}
                    sessions
                  </div>
                  <div className="choice-sub">{project.path}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>Private by design</h2>
            <p>
              Your transcripts hold code and secrets. You choose what leaves.
            </p>
            <div className="choices">
              {PRIVACY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice${privacy === option.value ? " selected" : ""}`}
                  onClick={() => setPrivacy(option.value)}
                >
                  <div className="choice-title">{option.title}</div>
                  <div className="choice-sub">{option.sub}</div>
                </button>
              ))}
            </div>
            {privacy === "cloud" ? (
              <>
                <div className="choices">
                  <button
                    type="button"
                    className={`choice${remProvider === "claude-code" ? " selected" : ""}`}
                    onClick={() => setRemProvider("claude-code")}
                  >
                    <div className="choice-title">Claude Code CLI</div>
                    <div className="choice-sub">
                      Runs `claude -p` locally with the redacted REM payload.
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`choice${remProvider === "codex" ? " selected" : ""}`}
                    onClick={() => setRemProvider("codex")}
                  >
                    <div className="choice-title">Codex CLI</div>
                    <div className="choice-sub">
                      Runs `codex exec` locally with the redacted REM payload.
                    </div>
                  </button>
                </div>
                <div className="onb-rem-fields">
                  <Field
                    label={
                      remProvider === "codex"
                        ? "Codex command"
                        : "Claude command"
                    }
                  >
                    <input
                      type="text"
                      value={
                        remProvider === "codex"
                          ? remCodexPath
                          : remClaudePath
                      }
                      onChange={(e) =>
                        remProvider === "codex"
                          ? setRemCodexPath(e.target.value)
                          : setRemClaudePath(e.target.value)
                      }
                    />
                  </Field>
                  <Field label="REM model">
                    <input
                      type="text"
                      value={remModel}
                      onChange={(e) => setRemModel(e.target.value)}
                    />
                  </Field>
                  <Field label="Timeout seconds">
                    <input
                      type="number"
                      min={1}
                      value={remTimeoutSeconds}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next)) setRemTimeoutSeconds(next);
                      }}
                    />
                  </Field>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2>Sync to iPhone &amp; Apple Watch</h2>
            <p>{CLOUD_SYNC_TAGLINE}</p>
            <div className="choices">
              <button
                type="button"
                className={`choice${cloudSync ? " selected" : ""}`}
                onClick={() => setCloudSync(true)}
              >
                <div className="choice-title">
                  <Icon name="cloudsync" size={15} />
                  Cloud Sync
                  <span className="choice-tag">
                    {CLOUD_SYNC_PRICE}
                    {CLOUD_SYNC_CADENCE}
                  </span>
                </div>
                <div className="choice-sub">
                  Read your sleep cycle, scores, and goals on iPhone &amp; Apple
                  Watch. Your code stays on this Mac — only the cycle signal
                  syncs.
                </div>
              </button>
              <button
                type="button"
                className={`choice${cloudSync ? "" : " selected"}`}
                onClick={() => setCloudSync(false)}
              >
                <div className="choice-title">Local only</div>
                <div className="choice-sub">
                  Everything stays on this Mac. Free forever — you can upgrade
                  anytime from the app.
                </div>
              </button>
            </div>
            {cloudSync ? (
              <div className="onb-soon">
                <b>Cloud Sync is coming soon.</b> Paid sync isn't live yet, so
                you'll start local-only. We'll save your spot and let you know
                the moment it ships.
              </div>
            ) : null}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2>When should it dream?</h2>
            <p>You can change this anytime in Settings.</p>
            <div className="choices">
              {SCHEDULE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice${schedule === option.value ? " selected" : ""}`}
                  onClick={() => setSchedule(option.value)}
                >
                  <div className="choice-title">{option.title}</div>
                  <div className="choice-sub">{option.sub}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="onb-foot">
        <div className="dots">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span key={index} className={index === step ? "active" : ""} />
          ))}
        </div>
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        <Button variant="accent" onClick={next}>
          {step >= lastStep ? "Enter Harness Dreams" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
