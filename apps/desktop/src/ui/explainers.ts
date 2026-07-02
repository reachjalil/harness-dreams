/**
 * One plain-language vocabulary for the whole app. Every tooltip pulls its copy
 * from here so the language stays coherent — a term means the same thing on the
 * Summary, in a Health Review, and in Goals. Keep each entry to a sentence or
 * two; tooltips explain, they don't lecture.
 */

import type {
  ActionCategory,
  AlignmentBand,
  Confidence,
  FindingType,
  FrictionType,
  MomentKind,
  RingKey,
  TimeOfDay,
} from "./harness-types.js";

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
  cost: "Estimated model spend across the sessions in this review. Lower is better.",
  reask:
    "How often you had to restate or correct a request. Lower means the agent understood you the first time.",
  cache:
    "Share of context served from cache instead of re-read — higher trims cost and latency.",
  tool_success:
    "Share of the agent's tool calls that succeeded on the first try.",
  sessions: "Number of work sessions folded into this health window.",
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

/** The collaboration spectrum a review's alignment falls into. */
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
  healthReview:
    "A Health Review is the periodic analysis run that replays your work, scores the day, and turns friction into goals you can accept.",
  quickReview:
    "A faster, lighter mid-day check-in. It reviews just this morning's work and surfaces the top nudge or two.",
  healthScore:
    "Your three rings — Efficiency, Effectiveness, and Alignment — blended into one 0–100 score.",
  composite:
    "Efficiency, Effectiveness, and Alignment combined into one 0–100 score.",
  alignmentBand: "Bands: Collaborating 80+, Friction 45–79, Fighting under 45.",
  suggestedGoals:
    "Patterns the health engine found that you can accept as goals to carry forward — or reject.",
  frictionPoints:
    "Moments where your intent and the agent's actions diverged: repeated corrections, re-asks, or wrong turns.",
  goals:
    "Suggestions you accepted. Future health windows measure each one to see whether it actually helped.",
  beingMeasured:
    "Accepted goals currently in effect — the next review is watching whether they move the numbers.",
  concluded: "Goals with enough evidence to retire or keep.",
  accepted: "These move into Goals to be measured by the next Health Review.",
  rejected: "Retired with this Health Review — they won't come back.",
  open: "Not decided yet. Step through the suggested goals to accept or reject each one.",
} as const;

/** What each Settings section governs, keyed by group title. */
export const SETTINGS_TIP = {
  schedule:
    "When a Health Review runs — automatically on idle nights, or only when you start one.",
  privacy:
    "Where your sessions are analyzed and how much, if anything, ever leaves this Mac.",
  connectors: "Which coding harnesses Harness Health reads sessions from.",
  projects:
    "Which local projects are included when Harness Health analyzes your work.",
  notifications:
    "Whether Harness Health nudges you when a fresh review or insight is ready.",
  data: "Your data is a single local file — reveal it, replay onboarding, or wipe it.",
} as const;

// ── The calm daily companion — greeting + the single "moment" on Home ─────────

/** Time-of-day lead for the home greeting. */
export const GREETING: Record<TimeOfDay, string> = {
  morning: "Good morning",
  midday: "Good afternoon",
  evening: "Good evening",
  night: "Working late",
};

/** The one quiet line under the greeting — the dual-loop ethos, calmly put. */
export const LOOP_WHISPER =
  "Live harness vitals, periodic reviews, and habits that make better agent work repeatable.";

const TOD_EYEBROW: Record<TimeOfDay, string> = {
  morning: "This morning",
  midday: "This afternoon",
  evening: "This evening",
  night: "Tonight",
};

export interface MomentCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta?: string;
}

export interface MomentContext {
  tod: TimeOfDay;
  name?: string;
  /** Findings waiting (review), or sessions accumulated (quick review/full review nudges). */
  count: number;
  projects: number;
  score: number;
  /** Human-formatted daily schedule time, e.g. "3:00 AM". */
  scheduleTime: string;
  /** Whether the pending report under review is a quick review. */
  pendingIsQuickReview: boolean;
}

function nudges(count: number): string {
  return `${count} ${count === 1 ? "nudge" : "nudges"}`;
}

/** Build the copy for Home's single focal "moment" from its kind + context. */
export function momentCopy(kind: MomentKind, ctx: MomentContext): MomentCopy {
  const eyebrow = TOD_EYEBROW[ctx.tod];
  switch (kind) {
    case "running":
      return {
        eyebrow: "In progress",
        title: "Running a Harness Health review...",
        subtitle: "Checking behavior, context, tools, and habits.",
      };
    case "review":
      return ctx.pendingIsQuickReview
        ? {
            eyebrow,
            title: "Your quick health review is ready",
            subtitle: `${nudges(ctx.count)} from this morning — one quick thing for your harness, one habit for you.`,
            cta: "Review",
          }
        : {
            eyebrow,
            title: "Your Harness Health review is ready",
            subtitle: `${nudges(ctx.count)} to look over — what your harness learned, plus the habit pattern behind it.`,
            cta: "Review",
          };
    case "quick":
      return {
        eyebrow: "Midday",
        title: "Time for a quick health check?",
        subtitle:
          "You've built up a few sessions this morning. A quick review surfaces just the top nudge or two.",
        cta: "Run quick review",
      };
    case "full":
      return {
        eyebrow,
        title: "You've done a lot today.",
        subtitle: `${ctx.count} sessions across ${ctx.projects} project${ctx.projects === 1 ? "" : "s"}. Ready to reflect and wake up sharper tomorrow?`,
        cta: "Run Health Review",
      };
    case "standby":
      return {
        eyebrow: "Tonight",
        title: "Time to rest.",
        subtitle: `Your harness will run a Health Review at ${ctx.scheduleTime}.`,
      };
    default:
      return {
        eyebrow,
        title: ctx.name
          ? `Your harness is healthy, ${ctx.name}.`
          : "Your harness is healthy.",
        subtitle: `Alignment ${ctx.score}. Keep the habits that make good sessions repeatable.`,
        cta: "Run Health Review",
      };
  }
}
