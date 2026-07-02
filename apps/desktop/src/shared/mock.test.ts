import { describe, expect, test } from "vitest";

import { nextDemoReport, seedDemoReports } from "./mock";

describe("nextDemoReport", () => {
  const now = 1_790_000_000_000;

  test("a quick review is lighter and morning-framed", () => {
    const history = seedDemoReports(now);
    const fullReview = nextDemoReport(now, history[0] ?? null, "full");
    const quickReview = nextDemoReport(now, history[0] ?? null, "quick");

    expect(quickReview.kind).toBe("quick");
    expect(quickReview.findings.length).toBeLessThanOrEqual(2);
    expect(quickReview.findings.length).toBeLessThanOrEqual(
      fullReview.findings.length
    );
    expect(quickReview.sessions).toBeLessThan(fullReview.sessions);
    expect(quickReview.rangeLabel.toLowerCase()).toContain("this morning");
    expect(quickReview.window?.label).toBe("This morning");
  });

  test("a health review stays full and unmarked as quick review", () => {
    const history = seedDemoReports(now);
    const fullReview = nextDemoReport(now, history[0] ?? null, "full");
    expect(fullReview.kind ?? "full").toBe("full");
    expect(fullReview.findings.length).toBeGreaterThan(0);
  });
});
