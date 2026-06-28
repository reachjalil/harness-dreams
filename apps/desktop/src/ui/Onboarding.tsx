import { type ReactElement, useEffect, useMemo, useState } from "react";

import type {
  AnalysisProject,
  DiscoveredProject,
  PrivacyMode,
  RemRunnerProvider,
  ScheduleMode,
} from "../shared/types";
import { CLOUD_SYNC_TAGLINE } from "./cloudSync";
import { BrandMark, Button, Field, Segmented } from "./components";
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
    sub: "Use a local CLI pass for richer insights while private details stay on this Mac.",
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

type ProjectSourceFilter = "all" | "claude-code" | "codex" | "code";

export default function Onboarding({
  hd,
}: {
  hd: HarnessDreams;
}): ReactElement {
  const { actions, patch, projects } = hd;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(hd.config?.userName ?? "");
  const [privacy, setPrivacy] = useState<PrivacyMode>("local");
  const [remProvider, setRemProvider] = useState<RemRunnerProvider>("codex");
  const [remModel, setRemModel] = useState(
    hd.config?.remRunner.model ?? "gpt-5.5"
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
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSourceFilter, setProjectSourceFilter] =
    useState<ProjectSourceFilter>("all");
  const [scanning, setScanning] = useState(false);
  const lastStep = 4;

  useEffect(() => {
    if (step !== 2 || discovered.length > 0 || scanning) return;
    setScanning(true);
    void projects
      .discover()
      .then((items) => {
        const top = items.slice(0, 3);
        setDiscovered(items);
        setSelected(Object.fromEntries(top.map((item) => [item.path, true])));
      })
      .finally(() => setScanning(false));
  }, [discovered.length, projects, scanning, step]);

  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return discovered.filter((project) => {
      const sourceMatch =
        projectSourceFilter === "all" ||
        project.sources.includes(projectSourceFilter);
      if (!sourceMatch) return false;
      if (!query) return true;
      return [
        project.name,
        project.path,
        project.sources.join(" "),
        `${project.sessionCount}`,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [discovered, projectSearch, projectSourceFilter]);

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
      userName: name.trim(),
      demoMode: false,
      privacyMode: privacy,
      remRunner: {
        provider: remProvider,
        model:
          remModel.trim() || (remProvider === "codex" ? "gpt-5.5" : "opus"),
        claudePath: remClaudePath.trim() || "claude",
        codexPath: remCodexPath.trim() || "codex",
        timeoutMs: Math.max(1, Math.round(remTimeoutSeconds)) * 1000,
      },
      schedule: { mode: schedule },
      cloudSyncInterest: cloudSync,
      cloudSync: { enabled: cloudSync },
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

  function back(): void {
    if (step === 0) return;
    setStep(step - 1);
  }

  return (
    <div className={`onb${step === 2 ? " project-step" : ""}`}>
      <div className="titlebar" />
      <div
        className={`onb-body${step === 2 ? " project-step" : ""}${
          step === 3 ? " sync-step" : ""
        }`}
      >
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
            <div className="onb-name">
              <Field label="First, what should I call you?">
                <input
                  type="text"
                  value={name}
                  placeholder="Your name"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") next();
                  }}
                />
              </Field>
            </div>
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
            <div className="onb-project-shell">
              <div className="onb-project-toolbar">
                <div className="onb-project-count">
                  {selectedProjects.length} selected
                  {discovered.length > 0
                    ? ` · ${visibleProjects.length} shown`
                    : ""}
                </div>
                <div className="onb-project-controls">
                  <label className="onb-project-search">
                    <Icon name="search" size={14} />
                    <input
                      type="search"
                      value={projectSearch}
                      placeholder="Search projects"
                      aria-label="Search projects"
                      onChange={(event) => setProjectSearch(event.target.value)}
                    />
                  </label>
                  <Segmented<ProjectSourceFilter>
                    ariaLabel="Filter projects by source"
                    value={projectSourceFilter}
                    onChange={setProjectSourceFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "claude-code", label: "Claude" },
                      { value: "codex", label: "Codex" },
                      { value: "code", label: "Code" },
                    ]}
                  />
                </div>
              </div>
              <div className="choices project-choices">
                {scanning ? (
                  <div className="choice project-empty">
                    Scanning local data...
                  </div>
                ) : null}
                {!scanning && discovered.length === 0 ? (
                  <div className="choice project-empty">
                    No Claude or Codex projects found yet.
                  </div>
                ) : null}
                {!scanning &&
                discovered.length > 0 &&
                visibleProjects.length === 0 ? (
                  <div className="choice project-empty">
                    No projects match this search.
                  </div>
                ) : null}
                {visibleProjects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    className={`choice project-choice${selected[project.path] ? " selected" : ""}`}
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
                    <div className="choice-sub project-path">
                      {project.path}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>Privacy &amp; sync</h2>
            <p>
              Choose what leaves your Mac for analysis, and whether your cycle
              syncs to your phone and watch.
            </p>
            <div className="onb-subhead">Where analysis runs</div>
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
                      Runs `claude -p` locally with the prepared REM payload.
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`choice${remProvider === "codex" ? " selected" : ""}`}
                    onClick={() => setRemProvider("codex")}
                  >
                    <div className="choice-title">Codex CLI</div>
                    <div className="choice-sub">
                      Runs `codex exec` locally with the prepared REM payload.
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
                        remProvider === "codex" ? remCodexPath : remClaudePath
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

            <div className="onb-subhead">Sync to iPhone &amp; Apple Watch</div>
            <p className="onb-subnote">{CLOUD_SYNC_TAGLINE}</p>
            <div className="choices">
              <button
                type="button"
                className={`choice${cloudSync ? " selected" : ""}`}
                onClick={() => setCloudSync(true)}
              >
                <div className="choice-title">
                  <Icon name="cloudsync" size={15} />
                  Cloud Sync
                  <span className="choice-tag">Atlas</span>
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
                <b>Cloud Sync is one start action.</b> Add your sync settings
                and start the desktop connection from Settings.
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
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
          {Array.from({ length: lastStep + 1 }, (_, index) => index).map(
            (index) => (
              <span key={index} className={index === step ? "active" : ""} />
            )
          )}
        </div>
        {step > 0 ? (
          <Button variant="ghost" onClick={back}>
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
