export function clampScore(value: number): number {
  return Math.max(28, Math.min(98, Math.round(value)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function quote(text: string, max = 96): string {
  const clean = text
    .replace(/<image[\s\S]*?<\/image>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function fmtDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function compactChars(chars: number): string {
  if (chars >= 1000) return `${Math.round(chars / 1000)}k chars`;
  return `${chars} chars`;
}
