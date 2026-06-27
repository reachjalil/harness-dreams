import { type ReactElement, useState } from "react";

import type { Experiment, ExperimentStatus } from "../shared/types";
import { Button, Pill, Section } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

const STATUS_TONE: Record<ExperimentStatus, "neutral" | "accent" | "good"> = {
  proposed: "neutral",
  running: "accent",
  concluded: "good",
};

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  proposed: "Proposed",
  running: "Running",
  concluded: "Concluded",
};

function ExperimentCard({
  experiment,
  enabled,
  onEnable,
}: {
  experiment: Experiment;
  enabled: boolean;
  onEnable: () => void;
}): ReactElement {
  const running = experiment.status === "running" || enabled;
  return (
    <div className="xp">
      <div className="xp-top">
        <span className="xp-title">{experiment.title}</span>
        <Pill tone={running ? "accent" : STATUS_TONE[experiment.status]}>
          {running && experiment.status === "proposed"
            ? "Enabled"
            : STATUS_LABEL[experiment.status]}
        </Pill>
      </div>
      <p className="xp-hyp">{experiment.hypothesis}</p>
      <div className="xp-metric">Measures: {experiment.metric}</div>

      {experiment.status === "running" && experiment.progress != null ? (
        <>
          <div className="progress sm">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(experiment.progress * 100)}%` }}
            />
          </div>
          <div className="xp-progress-label">{experiment.progressLabel}</div>
        </>
      ) : null}

      {experiment.status === "proposed" ? (
        enabled ? (
          <div className="finding-done">
            ✓ Enabled — next dream will grade it
          </div>
        ) : (
          <div className="row">
            <Button variant="accent" onClick={onEnable}>
              Enable experiment
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function Lab({ hd }: { hd: HarnessDreams }): ReactElement {
  const { report } = hd;
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  if (!report) return <p className="card-hint">Loading…</p>;

  const proposed = report.experiments.filter((x) => x.status === "proposed");
  const running = report.experiments.filter((x) => x.status === "running");

  function enable(id: string): void {
    setEnabled((prev) => new Set(prev).add(id));
  }

  return (
    <>
      <section className="card hero">
        <div className="hero-eyebrow">The Lab</div>
        <p className="digest">
          Experiments are testable changes to how you work. Enable one, and the
          next dream measures whether it actually helped.
        </p>
      </section>

      <Section
        title="Running"
        hint="In effect now — graded once enough sessions land."
      >
        {running.length === 0 ? (
          <p className="card-hint">No experiments running yet.</p>
        ) : (
          <div className="findings">
            {running.map((x) => (
              <ExperimentCard
                key={x.id}
                experiment={x}
                enabled={false}
                onEnable={() => undefined}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Proposed"
        hint="Suggested from your data. Try one or two."
      >
        <div className="findings">
          {proposed.map((x) => (
            <ExperimentCard
              key={x.id}
              experiment={x}
              enabled={enabled.has(x.id)}
              onEnable={() => enable(x.id)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}
