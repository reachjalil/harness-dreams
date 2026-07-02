import { type ReactElement, useEffect, useMemo, useState } from "react";

import type {
  AnalysisProject,
  DiscoveredProject,
  PrivacyMode,
  InsightRunnerProvider,
  ScheduleMode,
} from "../shared/types";
import { CLOUD_SYNC_TAGLINE } from "./cloudSync";
import { BrandMark, Button, Field, Segmented } from "./components";
import { Icon } from "./icons";
import type { HarnessHealth } from "./useHarnessHealth";

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
      value: "daily",
      title: "Every night",
      sub: "Run a Health Review at 3:00 AM when your harness is idle.",
    },
    {
      value: "manual",
      title: "Only when I ask",
      sub: "No automatic reviews — start one from the menu bar anytime.",
    },
  ];

type ProjectSourceFilter = "all" | "claude-code" | "codex" | "code";

export default function Onboarding({
  hd,
}: {
  hd: HarnessHealth;
}): ReactElement {
  const { actions, patch, projects } = hd;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(hd.config?.userName ?? "");
  const [privacy, setPrivacy] = useState<PrivacyMode>("local");
  const [insightProvider, setRemProvider] =
    useState<InsightRunnerProvider>("codex");
  const [insightModel, setRemModel] = useState(
    hd.config?.insightRunner.model ?? "gpt-5.5"
  );
  const [insightClaudePath, setRemClaudePath] = useState(
    hd.config?.insightRunner.claudePath ?? "claude"
  );
  const [insightCodexPath, setRemCodexPath] = useState(
    hd.config?.insightRunner.codexPath ?? "codex"
  );
  const [insightTimeoutSeconds, setRemTimeoutSeconds] = useState(
    Math.round((hd.config?.insightRunner.timeoutMs ?? 180_000) / 1000)
  );
  const [schedule, setSchedule] = useState<ScheduleMode>("daily");
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
      insightRunner: {
        provider: insightProvider,
        model:
          insightModel.trim() ||
          (insightProvider === "codex" ? "gpt-5.5" : "opus"),
        claudePath: insightClaudePath.trim() || "claude",
        codexPath: insightCodexPath.trim() || "codex",
        timeoutMs: Math.max(1, Math.round(insightTimeoutSeconds)) * 1000,
      },
      schedule: { mode: schedule },
      companionSyncInterest: cloudSync,
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
            <h2>Harness Health</h2>
            <p>
              A local-first health app for your AI coding harness. It watches
              live usage, explains patterns, and teaches the habits that make
              better sessions repeatable.
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
            <h2>Build a healthier harness</h2>
            <p>One daily loop for signals, habits, and review.</p>
            <ul className="onb-list">
              <li>
                <span className="num">1</span>
                <div>
                  <b>Measure.</b> Claude and Codex activity becomes local
                  vitals: tokens, tools, context, model mix, and source health.
                </div>
              </li>
              <li>
                <span className="num">2</span>
                <div>
                  <b>Learn.</b> Deterministic insights explain what changed and
                  which healthy harness habit would help next.
                </div>
              </li>
              <li>
                <span className="num">3</span>
                <div>
                  <b>Review.</b> Periodic Health Reviews turn friction into
                  goals you can accept, measure, and keep or retire.
                </div>
              </li>
            </ul>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>Add projects</h2>
            <p>
              Choose the local projects Harness Health should measure and teach
              from.
            </p>
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
              Choose what leaves your Mac for analysis, and whether your review
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
                    className={`choice${insightProvider === "claude-code" ? " selected" : ""}`}
                    onClick={() => setRemProvider("claude-code")}
                  >
                    <div className="choice-title">Claude Code CLI</div>
                    <div className="choice-sub">
                      Runs `claude -p` locally with the prepared insight
                      payload.
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`choice${insightProvider === "codex" ? " selected" : ""}`}
                    onClick={() => setRemProvider("codex")}
                  >
                    <div className="choice-title">Codex CLI</div>
                    <div className="choice-sub">
                      Runs `codex exec` locally with the prepared insight
                      payload.
                    </div>
                  </button>
                </div>
                <div className="onb-insight-fields">
                  <Field
                    label={
                      insightProvider === "codex"
                        ? "Codex command"
                        : "Claude command"
                    }
                  >
                    <input
                      type="text"
                      value={
                        insightProvider === "codex"
                          ? insightCodexPath
                          : insightClaudePath
                      }
                      onChange={(e) =>
                        insightProvider === "codex"
                          ? setRemCodexPath(e.target.value)
                          : setRemClaudePath(e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Insight model">
                    <input
                      type="text"
                      value={insightModel}
                      onChange={(e) => setRemModel(e.target.value)}
                    />
                  </Field>
                  <Field label="Timeout seconds">
                    <input
                      type="number"
                      min={1}
                      value={insightTimeoutSeconds}
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
                  Private Device Sync
                  <span className="choice-tag">WebRTC</span>
                </div>
                <div className="choice-sub">
                  Read your health review, scores, and goals on iPhone &amp;
                  Apple Watch. Cloudflare only helps devices find each other
                  while pairing.
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
                <b>Private Device Sync starts from Settings.</b> Show the QR,
                scan it with your iPhone, and this Mac stays the sync owner.
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2>When should reviews run?</h2>
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
          {step >= lastStep ? "Enter Harness Health" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
