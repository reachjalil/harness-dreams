import type {
  AnalysisSource,
  HealthReviewKind,
  HealthReport,
  InsightRunnerConfig,
  PrivacyMode,
} from "../../shared/types";
import type { ProjectConfig } from "../agentConfig";
import type { LocalSession } from "../localIngest";

export interface SessionSignals {
  session: LocalSession;
  windowTurns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  frustration: string[];
  toolFailures: string[];
  hedges: string[];
  topics: Set<string>;
}

export interface ProjectAgg {
  path: string;
  name: string;
  sources: Set<AnalysisSource>;
  config: ProjectConfig;
  sessions: number;
  turns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  toolFailures: number;
  hedges: number;
  frustrationQuotes: string[];
  toolFailQuotes: string[];
  hedgeQuotes: string[];
  topicFreq: Map<string, number>;
  topicSessions: Map<string, number>;
}

export interface Totals {
  sessions: number;
  turns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  toolFailures: number;
  hedges: number;
}

export interface ReviewOptions {
  /** Epoch ms of the previous review, if any (window start, capped at 24h). */
  since?: number | null;
  now?: number;
  prev?: HealthReport | null;
  privacyMode?: PrivacyMode;
  analysisDepth?: "light" | "standard" | "deep";
  insightRunner?: InsightRunnerConfig;
  /**
   * "full" (default) is the full daily pass. "quick" is a fast same-day
   * check-in capped to the top couple of nudges.
   */
  kind?: HealthReviewKind;
}
