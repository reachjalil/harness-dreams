import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  History,
  Info,
  Lightbulb,
  ListPlus,
  Lock,
  type LucideIcon,
  MessageSquareText,
  Minus,
  Moon,
  MoonStar,
  Palette,
  Pause,
  Play,
  Plug,
  Power,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Workflow,
} from "lucide-react";
import type { ReactElement } from "react";

/**
 * One semantic icon vocabulary for the whole app, backed by Lucide (a clean,
 * consistent, SF-Symbols-adjacent set). UI references *meaning* — "finding-win",
 * "action-queue" — never a raw icon name, so the language stays coherent.
 */
const ICONS = {
  // Navigation
  dashboard: Activity,
  cycle: MoonStar,
  improvements: Target,
  history: History,
  settings: Settings,
  // Finding types
  "finding-win": CircleCheck,
  "finding-mistake": CircleAlert,
  "finding-opportunity": Lightbulb,
  "finding-risk": ShieldAlert,
  // Action categories
  agentsmd: FileCode2,
  contextdoc: BookOpen,
  prompthabit: MessageSquareText,
  skill: Workflow,
  // Action decisions
  accept: Check,
  snooze: Clock,
  queue: ListPlus,
  // Alignment + friction
  human: UserRound,
  agent: Bot,
  friction: TriangleAlert,
  // Trends
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  // Status / controls
  dream: Moon,
  play: Play,
  pause: Pause,
  notifications: Bell,
  privacy: Lock,
  connectors: Plug,
  appearance: Palette,
  data: Database,
  reset: RotateCcw,
  about: Info,
  depth: Cpu,
  chevron: ChevronRight,
  external: ExternalLink,
  quit: Power,
  sparkle: Sparkles,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Inline, currentColor-tinted icon. Decorative by default; pass `label` to name it. */
export function Icon({
  name,
  size = 16,
  strokeWidth = 1.9,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}): ReactElement {
  const Glyph = ICONS[name];
  return (
    <Glyph
      className={className ? `icon ${className}` : "icon"}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
