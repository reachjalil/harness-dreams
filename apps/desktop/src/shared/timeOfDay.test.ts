import { describe, expect, test } from "vitest";

import { demoActivityFor, startOfDay, timeOfDay } from "./timeOfDay";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 5, 28, hour, minute, 0, 0);
}

describe("timeOfDay", () => {
  test("buckets by hour at the boundaries", () => {
    expect(timeOfDay(at(4, 59))).toBe("night");
    expect(timeOfDay(at(5, 0))).toBe("morning");
    expect(timeOfDay(at(10, 59))).toBe("morning");
    expect(timeOfDay(at(11, 0))).toBe("midday");
    expect(timeOfDay(at(15, 59))).toBe("midday");
    expect(timeOfDay(at(16, 0))).toBe("evening");
    expect(timeOfDay(at(21, 59))).toBe("evening");
    expect(timeOfDay(at(22, 0))).toBe("night");
    expect(timeOfDay(at(0, 30))).toBe("night");
  });
});

describe("startOfDay", () => {
  test("zeroes the clock and never moves forward", () => {
    const noon = at(13, 45);
    const start = new Date(startOfDay(noon.getTime()));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(noon.getDate());
    expect(startOfDay(noon.getTime())).toBeLessThanOrEqual(noon.getTime());
  });
});

describe("demoActivityFor", () => {
  test("midday clears the nap threshold, evening clears sleep, morning is quiet", () => {
    expect(demoActivityFor("midday")).toBeGreaterThanOrEqual(3);
    expect(demoActivityFor("evening")).toBeGreaterThanOrEqual(5);
    expect(demoActivityFor("morning")).toBeLessThan(3);
  });
});
