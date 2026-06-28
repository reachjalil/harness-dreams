import { describe, expect, test } from "vitest";

import { nextDemoReport, seedDemoReports } from "./mock";

describe("nextDemoReport", () => {
  const now = 1_790_000_000_000;

  test("a nap is lighter and morning-framed", () => {
    const history = seedDemoReports(now);
    const sleep = nextDemoReport(now, history[0] ?? null, "sleep");
    const nap = nextDemoReport(now, history[0] ?? null, "nap");

    expect(nap.kind).toBe("nap");
    expect(nap.findings.length).toBeLessThanOrEqual(2);
    expect(nap.findings.length).toBeLessThanOrEqual(sleep.findings.length);
    expect(nap.sessions).toBeLessThan(sleep.sessions);
    expect(nap.rangeLabel.toLowerCase()).toContain("this morning");
    expect(nap.window?.label).toBe("This morning");
  });

  test("a sleep cycle stays full and unmarked as nap", () => {
    const history = seedDemoReports(now);
    const sleep = nextDemoReport(now, history[0] ?? null, "sleep");
    expect(sleep.kind ?? "sleep").toBe("sleep");
    expect(sleep.findings.length).toBeGreaterThan(0);
  });
});
