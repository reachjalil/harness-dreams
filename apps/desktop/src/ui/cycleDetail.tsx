import type { ReactElement } from "react";

import type {
  ActionCategory,
  ConfigPatchPreview,
  CycleWindow,
  Experiment,
  ExperimentVerdict,
  Finding,
  ProjectInsight,
} from "../shared/types";
import { band, categorize } from "./components";
import { Icon, type IconName } from "./icons";

/**
 * Report-page detail components that surface the Sleep Cycle engine's richer
 * output: the activity window it reviewed, a recommendation-by-target map, the
 * per-project breakdown, and the concrete file patch a recommendation applies.
 * Kept in their own module so the report page can compose them without bloating
 * the wizard.
 */

const CATEGORY_ICON: Record<ActionCategory, IconName> = {
  agentsmd: "agentsmd",
  claudemd: "claudemd",
  contextdoc: "contextdoc",
  prompthabit: "prompthabit",
  skill: "skill",
};

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  agentsmd: "AGENTS.md",
  claudemd: "CLAUDE.md",
  skill: "Skills",
  contextdoc: "Context",
  prompthabit: "Prompt habit",
};

const CATEGORY_ORDER: ActionCategory[] = [
  "agentsmd",
  "claudemd",
  "skill",
  "contextdoc",
  "prompthabit",
];

function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactChars(chars: number): string {
  if (chars >= 1000) return `${Math.round(chars / 1000)}k`;
  return `${chars}`;
}

/** A banner stating exactly what slice of activity this cycle reviewed. */
export function CycleWindowBanner({
  info,
}: {
  info: CycleWindow;
}): ReactElement {
  const basis =
    info.basis === "since-last-cycle"
      ? "since your last Sleep Cycle"
      : "last 24 hours (max)";
  return (
    <div className="cycle-window">
      <span className="cycle-window-icon">
        <Icon name="cycle" size={18} />
      </span>
      <div className="cycle-window-main">
        <span className="cycle-window-label">{info.label}</span>
        <span className="cycle-window-sub">
          {info.sessionsInWindow} session
          {info.sessionsInWindow === 1 ? "" : "s"} · {info.turnsInWindow} turns
          reviewed · {basis}
        </span>
      </div>
      <span className="cycle-window-range tnum">
        {fmtClock(info.start)} → {fmtClock(info.end)}
      </span>
    </div>
  );
}

/** Counts recommendations by where they land (AGENTS.md / skill / …). */
export function RecommendationMap({
  findings,
}: {
  findings: Finding[];
}): ReactElement {
  const counts = findings.reduce<Record<string, number>>((acc, finding) => {
    const category = categorize(finding);
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="rec-map">
      {CATEGORY_ORDER.map((category) => (
        <div
          key={category}
          className={`rec-map-cell ${category}${counts[category] ? " has" : ""}`}
        >
          <Icon name={CATEGORY_ICON[category]} size={16} />
          <span className="rec-map-count tnum">{counts[category] ?? 0}</span>
          <span className="rec-map-label">{CATEGORY_LABEL[category]}</span>
        </div>
      ))}
    </div>
  );
}

/** Per-project rollup: activity, friction, alignment, and config status. */
export function ProjectBreakdown({
  insights,
}: {
  insights: ProjectInsight[];
}): ReactElement {
  return (
    <div className="proj-breakdown">
      {insights.map((project) => (
        <div key={project.path} className="proj-ins">
          <div className="proj-ins-head">
            <span className="proj-ins-name">{project.name}</span>
            <span className="proj-ins-scores">
              {project.contextHealth ? (
                <span
                  className={`proj-ins-context ${project.contextHealth.status}`}
                  title={project.contextHealth.risks.join(" · ")}
                >
                  Context {project.contextHealth.score}
                </span>
              ) : null}
              <span className={`proj-ins-align ${band(project.alignment)}`}>
                {project.alignment}
              </span>
            </span>
          </div>
          <div className="proj-ins-meta">
            <span>
              {project.sessions} session{project.sessions === 1 ? "" : "s"}
            </span>
            <span>{project.turns} turns</span>
            <span>{project.corrections} corrections</span>
            {project.contextHealth ? (
              <span>
                {compactChars(project.contextHealth.totalChars)} context chars
              </span>
            ) : null}
            {project.toolFailures > 0 ? (
              <span>{project.toolFailures} tool errors</span>
            ) : null}
            {project.hedges > 0 ? <span>{project.hedges} hedges</span> : null}
          </div>
          <div className="proj-ins-tags">
            <span className={`proj-tag ${project.hasAgentsMd ? "on" : "off"}`}>
              {project.hasAgentsMd ? "AGENTS.md ✓" : "No AGENTS.md"}
            </span>
            <span className={`proj-tag ${project.hasClaudeMd ? "on" : "off"}`}>
              {project.hasClaudeMd ? "CLAUDE.md ✓" : "No CLAUDE.md"}
            </span>
            <span className={`proj-tag ${project.hasRulesMd ? "on" : "off"}`}>
              {project.hasRulesMd ? "rules.md ✓" : "No rules.md"}
            </span>
            <span className="proj-tag">
              {project.skillCount} skill{project.skillCount === 1 ? "" : "s"}
            </span>
            {project.contextHealth ? (
              <>
                <span className="proj-tag">
                  {project.contextHealth.memoryFiles} memory
                  {project.contextHealth.memoryFiles === 1 ? "" : " files"}
                </span>
                {project.contextHealth.risks.slice(0, 2).map((risk) => (
                  <span key={risk} className="proj-risk">
                    {risk}
                  </span>
                ))}
              </>
            ) : null}
            {project.topics.slice(0, 3).map((topic) => (
              <span key={topic} className="proj-topic">
                {topic}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const VERDICT_LABEL: Record<ExperimentVerdict, string> = {
  helped: "Helped",
  "no-change": "No change",
  worse: "Worse",
};

/**
 * Closes the loop: goals accepted in earlier cycles, measured against this one.
 * This is the product's third promise — "the next cycle measures whether it
 * helped" — made visible.
 */
export function MeasuredGoals({
  experiments,
}: {
  experiments: Experiment[];
}): ReactElement | null {
  const measured = experiments.filter(
    (experiment) =>
      experiment.status === "running" || experiment.status === "concluded"
  );
  if (measured.length === 0) return null;
  return (
    <div className="measured-goals">
      {measured.map((experiment) => {
        const concluded =
          experiment.status === "concluded" && experiment.verdict;
        return (
          <div key={experiment.id} className="measured-goal">
            <div className="measured-goal-head">
              <span className="measured-goal-title">{experiment.title}</span>
              {concluded && experiment.verdict ? (
                <span className={`measured-verdict ${experiment.verdict}`}>
                  {VERDICT_LABEL[experiment.verdict]}
                </span>
              ) : (
                <span className="measured-verdict running">
                  Measuring · {experiment.progressLabel ?? "in progress"}
                </span>
              )}
            </div>
            {experiment.verdictNote ? (
              <div className="measured-goal-note">{experiment.verdictNote}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function shortPath(file: string): string {
  const parts = file.split("/");
  return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : file;
}

/** Shows the exact file change a recommendation would apply if accepted. */
export function PatchPreview({
  patch,
}: {
  patch: ConfigPatchPreview;
}): ReactElement {
  return (
    <div className="patch-preview">
      <div className="patch-head">
        <Icon
          name={
            patch.target === "skill"
              ? "skill"
              : patch.target === "claudemd"
                ? "claudemd"
                : "agentsmd"
          }
          size={14}
        />
        <span className="patch-label">{patch.label}</span>
        <span className={`patch-op ${patch.creates ? "create" : "update"}`}>
          {patch.creates ? "creates file" : "updates file"}
        </span>
      </div>
      <code className="patch-file">{shortPath(patch.file)}</code>
      <pre className="patch-snippet">{patch.snippet.trim()}</pre>
    </div>
  );
}
