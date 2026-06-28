import type { ReactElement } from "react";

import type {
  ActionCategory,
  ActionQueueEntry,
  DreamReport,
  Finding,
} from "../shared/types";
import { Button, PageHeader, Pill, Section } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  agentsmd: "AGENTS.md rule",
  claudemd: "CLAUDE.md rule",
  contextdoc: "Project context",
  prompthabit: "Prompt habit",
  skill: "Skill file",
};

interface ConfigUpdate {
  report: DreamReport;
  entry: ActionQueueEntry;
  finding: Finding | null;
}

function updatesFromReports(reports: DreamReport[]): ConfigUpdate[] {
  return reports.flatMap((report) =>
    (report.reviewDecisions ?? [])
      .filter((entry) => entry.state === "accepted" && entry.patch)
      .map((entry) => ({
        report,
        entry,
        finding:
          report.findings.find((finding) => finding.id === entry.findingId) ??
          null,
      }))
  );
}

function changedFiles(entry: ActionQueueEntry): string[] {
  return (
    entry.reviewBranch?.changedFiles ??
    entry.reviewBranch?.previousFiles?.map((file) => file.relativePath) ??
    (entry.patch ? [entry.patch.label] : [])
  );
}

function updateStatus(entry: ActionQueueEntry): ReactElement {
  const result = entry.reviewBranch;
  if (result?.revertedAt) return <Pill tone="neutral">Reverted</Pill>;
  if (result?.mode === "direct" && result.appliedDirectly) {
    return <Pill tone="good">Applied locally</Pill>;
  }
  if (result?.mode === "branch" && result.prUrl) {
    return <Pill tone="accent">PR branch</Pill>;
  }
  if (result?.error) return <Pill tone="warn">Needs review</Pill>;
  return <Pill tone="neutral">Recorded</Pill>;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function ConfigUpdateCard({
  update,
  onRevert,
}: {
  update: ConfigUpdate;
  onRevert: (reportId: string, findingId: string) => void;
}): ReactElement {
  const { report, entry, finding } = update;
  const result = entry.reviewBranch;
  const canRevert =
    result?.mode === "direct" &&
    result.appliedDirectly &&
    !result.revertedAt &&
    Boolean(result.previousFiles?.length);
  const files = changedFiles(entry);
  return (
    <article className="card config-update-card">
      <div className="goal-card-head">
        <div>
          <div className="finding-benefit-eyebrow">Edit request</div>
          <h3 className="card-title">
            {entry.patch ? CATEGORY_LABEL[entry.category] : "Config update"}
          </h3>
        </div>
        {updateStatus(entry)}
      </div>

      <p className="card-hint">
        {finding?.configGap ?? finding?.body ?? entry.action}
      </p>

      <div className="config-update-files">
        {files.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>

      <div className="finding-watch">
        <b>Rule/edit applied:</b> {entry.action}
        <br />
        {entry.project} · accepted{" "}
        {shortDate(entry.decidedAt ?? report.timestamp)}
      </div>

      {result?.error ? (
        <p className="goal-verdict danger">{result.error}</p>
      ) : null}

      <div className="finding-controls goal-controls">
        <span className="spacer" />
        {canRevert ? (
          <Button
            variant="ghost"
            onClick={() => onRevert(report.id, entry.findingId)}
          >
            Revert local edit
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function ConfigUpdates({
  hd,
  reports,
}: {
  hd: HarnessDreams;
  reports: DreamReport[];
}): ReactElement {
  const updates = updatesFromReports(reports);
  const active = updates.filter(
    (update) => !update.entry.reviewBranch?.revertedAt
  );
  const reverted = updates.length - active.length;

  function revert(reportId: string, findingId: string): void {
    void hd.actions.revertConfigUpdate(reportId, findingId).then((next) => {
      // The real app receives the same reports through the event stream; this
      // makes preview mode update immediately.
      void next;
    });
  }

  return (
    <div className="scroll-inner">
      <PageHeader
        eyebrow="Config Updates"
        title="Local file edits"
        subtitle="Rules, markdown files, and skills changed from accepted Sleep Cycle edit requests. Goals measure outcomes; Config Updates are the file changes."
      />

      <div className="card goal-summary-card">
        <div className="flat-strip flat-strip-divided">
          <div className="summary-card">
            <div className="summary-eyebrow">Applied locally</div>
            <div className="summary-value tnum">{active.length}</div>
            <div className="summary-sub">Direct edits currently in place.</div>
          </div>
          <div className="summary-card">
            <div className="summary-eyebrow">Reverted</div>
            <div className="summary-value tnum">{reverted}</div>
            <div className="summary-sub">
              Local edits restored from snapshots.
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-eyebrow">Files touched</div>
            <div className="summary-value tnum">
              {
                new Set(updates.flatMap((update) => changedFiles(update.entry)))
                  .size
              }
            </div>
            <div className="summary-sub">
              AGENTS.md, CLAUDE.md, rules, or skills.
            </div>
          </div>
        </div>
      </div>

      <Section
        title="Config updates"
        hint="These are edit requests applied to local configuration files. Reverting restores the captured previous file contents."
      >
        {updates.length > 0 ? (
          <div className="goal-stack">
            {updates.map((update) => (
              <ConfigUpdateCard
                key={`${update.report.id}-${update.entry.findingId}`}
                update={update}
                onRevert={revert}
              />
            ))}
          </div>
        ) : (
          <p className="empty">
            No config updates yet. Accept an edit request during Sleep Cycle
            review to apply a local AGENTS.md, CLAUDE.md, rules, or skill
            change.
          </p>
        )}
      </Section>
    </div>
  );
}
