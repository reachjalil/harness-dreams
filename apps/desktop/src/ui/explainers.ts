/**
 * One plain-language vocabulary for the whole app. Every tooltip pulls its copy
 * from here so the language stays coherent — a term means the same thing on the
 * dashboard, in a Sleep Cycle, and in Goals. Keep each entry to a sentence or
 * two; tooltips explain, they don't lecture.
 */

import type {
  ActionCategory,
  AlignmentBand,
  Confidence,
  FindingType,
  FrictionType,
  RingKey,
} from "../shared/types";

export interface Explainer {
  title: string;
  text: string;
}

/** The three headline rings — the spine of every report. */
export const RING_TIP: Record<RingKey, Explainer> = {
  alignment: {
    title: "Alignment",
    text: "How closely the agent's actions matched what you actually wanted — higher means fewer corrections and re-steers.",
  },
  efficiency: {
    title: "Efficiency",
    text: "How economically the work got done: tokens and cost spent per accepted change.",
  },
  effectiveness: {
    title: "Effectiveness",
    text: "How often work actually landed — code delivered with less back-and-forth.",
  },
};

/** Headline vitals in the metric strips, keyed by Metric.key. */
export const METRIC_TIP: Record<string, string> = {
  tokens_per_change:
    "Average tokens spent for each accepted change. Lower means leaner sessions.",
  cost: "Estimated model spend across the sessions in this cycle. Lower is better.",
  reask:
    "How often you had to restate or correct a request. Lower means the agent understood you the first time.",
  cache:
    "Share of context served from cache instead of re-read — higher trims cost and latency.",
  tool_success:
    "Share of the agent's tool calls that succeeded on the first try.",
  sessions: "Number of work sessions folded into this Sleep Cycle.",
};

/** Where an accepted action actually lands. */
export const CATEGORY_TIP: Record<ActionCategory, string> = {
  agentsmd:
    "Lands as a patch to AGENTS.md / harness memory before your next session.",
  claudemd:
    "Lands as a patch to CLAUDE.md before your next Claude Code session.",
  contextdoc: "Saved as durable project context that future agents can cite.",
  prompthabit: "Surfaces as a prompt checkpoint when similar work begins.",
  skill: "Routes the work to a more specific skill, or adds one.",
};

/** What each finding type signals. */
export const FINDING_TIP: Record<FindingType, string> = {
  win: "Something that went well and is worth reinforcing.",
  mistake: "A wrong turn the agent took that cost you time.",
  opportunity: "A change that could measurably improve future sessions.",
  risk: "A pattern that could cause trouble if left unaddressed.",
};

/** The collaboration spectrum a cycle's alignment falls into. */
export const BAND_TIP: Record<AlignmentBand, string> = {
  collaborating:
    "Collaborating (80+): you and the agent moved as one, with little correcting.",
  friction: "Friction (45–79): workable, but with noticeable back-and-forth.",
  fighting:
    "Fighting (under 45): heavy correcting — intent and actions kept diverging.",
};

/** What each kind of human ↔ agent friction means. */
export const FRICTION_TIP: Record<FrictionType, string> = {
  "config-conflict":
    "Your settings or instructions pulled against each other, so the agent got mixed signals.",
  "missing-skill":
    "The task needed a capability the harness didn't have, so it improvised.",
  "wrong-domain":
    "The agent reached for the wrong domain knowledge or tool for the task.",
  "unclear-prompt":
    "The request was ambiguous, so the agent had to guess your intent.",
};

/** How much to trust a finding. */
export const CONFIDENCE_TIP: Record<Confidence, string> = {
  low: "Low confidence — seen once or twice; treat it as a hint.",
  medium: "Medium confidence — a recurring pattern worth acting on.",
  high: "High confidence — a strong, repeated signal across sessions.",
};

/** Standalone terms surfaced as headline numbers and section eyebrows. */
export const TERM = {
  sleepCycle:
    "A quiet-period analysis run that replays your work, scores the day, and turns friction into suggested goals you can accept.",
  dreamScore:
    "Your three rings — Efficiency, Effectiveness, and Alignment — blended into one 0–100 score.",
  composite:
    "Efficiency, Effectiveness, and Alignment combined into one 0–100 score.",
  alignmentBand: "Bands: Collaborating 80+, Friction 45–79, Fighting under 45.",
  suggestedGoals:
    "Patterns the Sleep Cycle found that you can accept as goals to carry forward — or reject.",
  frictionPoints:
    "Moments where your intent and the agent's actions diverged: repeated corrections, re-asks, or wrong turns.",
  goals:
    "Suggestions you accepted. The next Sleep Cycle measures each one to see whether it actually helped.",
  beingMeasured:
    "Accepted goals currently in effect — the next Sleep Cycle is watching whether they move the numbers.",
  concluded: "Goals with enough evidence to retire or keep.",
  accepted: "These move into Goals to be measured by the next Sleep Cycle.",
  rejected: "Retired with this Sleep Cycle — they won't come back.",
  open: "Not decided yet. Step through the suggested goals to accept or reject each one.",
} as const;

/** What each Settings section governs, keyed by group title. */
export const SETTINGS_TIP = {
  schedule:
    "When a Sleep Cycle runs — automatically on idle nights, or only when you start one.",
  privacy:
    "Where your sessions are analyzed and how much, if anything, ever leaves this Mac.",
  connectors: "Which coding harnesses Harness Dreams reads sessions from.",
  projects:
    "Which local projects are included when a Sleep Cycle analyzes your work.",
  notifications:
    "Whether Harness Dreams nudges you when a fresh Sleep Cycle is ready.",
  data: "Your data is a single local file — reveal it, replay onboarding, or wipe it.",
} as const;
