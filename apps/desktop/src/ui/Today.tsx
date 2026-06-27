import { type ReactElement, useEffect, useState } from "react";

import type { Confidence, Finding, FindingType } from "../shared/types";
import { Button, Pill, Rings, RingLegend, Section, Stat } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

const TYPE_ICON: Record<FindingType, string> = {
  win: "✓",
  mistake: "!",
  opportunity: "✦",
  risk: "⚠",
};

const CONFIDENCE_TONE: Record<Confidence, "good" | "accent" | "neutral"> = {
  high: "good",
  medium: "accent",
  low: "neutral",
};

function FindingCard({ finding }: { finding: Finding }): ReactElement {
  const [accepted, setAccepted] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  return (
    <div className={`finding ${finding.type}${snoozed ? " snoozed" : ""}`}>
      <div className="finding-top">
        <span className={`finding-icon ${finding.type}`}>
          {TYPE_ICON[finding.type]}
        </span>
        <span className="finding-title">{finding.title}</span>
        <Pill tone={CONFIDENCE_TONE[finding.confidence]}>
          {finding.confidence}
        </Pill>
      </div>
      <p className="finding-body">{finding.body}</p>
      <div className="finding-evi">
        <span className="finding-proj">{finding.project}</span>
        <span className="finding-dot">·</span>
        {finding.evidence}
      </div>
      {accepted ? (
        <div className="finding-done">✓ {finding.action} — done</div>
      ) : snoozed ? (
        <div className="finding-done muted">Snoozed</div>
      ) : (
        <div className="row">
          <Button variant="accent" onClick={() => setAccepted(true)}>
            {finding.action}
          </Button>
          <Button variant="ghost" onClick={() => setSnoozed(true)}>
            Snooze
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Today({ hd }: { hd: HarnessDreams }): ReactElement {
  const { report, state, actions } = hd;

  // Opening Today clears the "unreviewed dream" badge.
  useEffect(() => {
    void window.hd.actions.markReviewed();
  }, []);

  if (!report || !state) return <p className="card-hint">Loading report…</p>;

  const dreaming = state.phase === "dreaming";

  return (
    <>
      <section className="card hero">
        <div className="hero-head">
          <div>
            <div className="hero-eyebrow">{report.rangeLabel}</div>
            <div className="hero-meta">
              {report.harness} · {report.projects} projects
            </div>
          </div>
          <Button
            variant="accent"
            disabled={dreaming}
            onClick={() => void actions.dreamNow()}
          >
            {dreaming ? "Dreaming…" : "Dream now"}
          </Button>
        </div>
        {dreaming ? (
          <div className="progress">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
        ) : (
          <p className="digest">{report.digest}</p>
        )}
      </section>

      <section className="card">
        <div className="rings-row">
          <Rings rings={report.rings} />
          <RingLegend rings={report.rings} />
        </div>
      </section>

      <Section title="Vitals" hint="Compared with your two-week median.">
        <div className="stats">
          {report.metrics.map((metric) => (
            <Stat key={metric.key} metric={metric} />
          ))}
        </div>
      </Section>

      <Section
        title="Findings"
        hint="What it noticed — accept what's useful, snooze the rest."
      >
        <div className="findings">
          {report.findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      </Section>

      <div className="footer">
        Mock data · the Dream Engine isn't wired up yet
        <br />
        Reflect each morning · accept · experiment
      </div>
    </>
  );
}
