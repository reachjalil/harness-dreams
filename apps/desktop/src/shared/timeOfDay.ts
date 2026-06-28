/**
 * Time-of-day awareness — the spine of the calm daily companion. Pure helpers
 * (the caller passes the Date) so they are trivially testable and can be
 * overridden by the Demo Mode time switcher.
 */

export type TimeOfDay = "morning" | "midday" | "evening" | "night";

/**
 * Bucket a clock time into a part of the day. Midday is the lunch/nap zone.
 * morning 5–11 · midday 11–16 · evening 16–22 · night otherwise.
 */
export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "midday";
  if (hour >= 16 && hour < 22) return "evening";
  return "night";
}

/** Midnight (local) for the day containing `ms`. Used as the nap window start. */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Synthetic "sessions since the last cycle" for Demo Mode, scaled by time of
 * day so flipping the demo switcher actually triggers the matching moment: a
 * quiet morning, a lunch worth a nap, a full evening worth a sleep cycle.
 */
export function demoActivityFor(tod: TimeOfDay): number {
  switch (tod) {
    case "morning":
      return 2;
    case "midday":
      return 4;
    case "evening":
      return 9;
    case "night":
      return 1;
  }
}
