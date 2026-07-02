import { useEffect, useMemo, useState } from "react";

import type { ActionState, HealthReport } from "../../shared/types";

export type Decisions = Record<string, ActionState>;

export const OVERVIEW_ID = "__overview";
export const QUEUE_ID = "__queue";

function decisionsFromReport(report: HealthReport | null): Decisions {
  return Object.fromEntries(
    (report?.reviewDecisions ?? []).map((entry) => [
      entry.findingId,
      entry.state,
    ])
  );
}

export function useReviewWizard(report: HealthReport | null): {
  activeId: string;
  setActiveId: (id: string) => void;
  decisions: Decisions;
  decisionCount: number;
  acceptedGoalCount: number;
  onOverview: boolean;
  onQueue: boolean;
  decide: (findingId: string, next: ActionState) => void;
  undo: (findingId: string) => void;
} {
  const [activeId, setActiveId] = useState<string>(OVERVIEW_ID);
  const [decisions, setDecisions] = useState<Decisions>({});

  useEffect(() => {
    setActiveId(OVERVIEW_ID);
    setDecisions(decisionsFromReport(report));
  }, [report]);

  const decisionCount = useMemo(
    () => Object.values(decisions).filter((state) => state !== "open").length,
    [decisions]
  );
  const acceptedGoalCount = useMemo(
    () =>
      Object.values(decisions).filter((state) => state === "accepted").length,
    [decisions]
  );

  function decide(findingId: string, next: ActionState): void {
    setDecisions((prev) => ({
      ...prev,
      [findingId]: prev[findingId] === next ? "open" : next,
    }));
  }

  function undo(findingId: string): void {
    setDecisions((prev) => ({ ...prev, [findingId]: "open" }));
  }

  return {
    activeId,
    setActiveId,
    decisions,
    decisionCount,
    acceptedGoalCount,
    onOverview: activeId === OVERVIEW_ID,
    onQueue: activeId === QUEUE_ID,
    decide,
    undo,
  };
}
