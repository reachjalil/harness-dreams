import { describe, expect, test } from "vitest";

import type { HealthReport } from "../shared/types";
import { decideMoment } from "./moment";

const pending = { id: "pending" } as HealthReport;

describe("decideMoment", () => {
  test("a running review beats everything else", () => {
    expect(
      decideMoment({
        tod: "morning",
        phase: "running",
        pending,
        activity: 9,
        scheduleMode: "manual",
      }).kind
    ).toBe("running");
  });

  test("a pending report becomes the review moment", () => {
    expect(
      decideMoment({
        tod: "evening",
        phase: "ready",
        pending,
        activity: 9,
        scheduleMode: "daily",
      })
    ).toEqual({ kind: "review", ctaKind: "review" });
  });

  test("midday with enough activity suggests a quick review", () => {
    expect(
      decideMoment({
        tod: "midday",
        phase: "ready",
        pending: null,
        activity: 4,
        scheduleMode: "manual",
      })
    ).toEqual({ kind: "quick", ctaKind: "quick" });
  });

  test("midday below the threshold stays restful", () => {
    expect(
      decideMoment({
        tod: "midday",
        phase: "ready",
        pending: null,
        activity: 1,
        scheduleMode: "manual",
      }).kind
    ).toBe("rest");
  });

  test("a full evening suggests a health review", () => {
    expect(
      decideMoment({
        tod: "evening",
        phase: "ready",
        pending: null,
        activity: 9,
        scheduleMode: "manual",
      })
    ).toEqual({ kind: "full", ctaKind: "full" });
  });

  test("night on a daily schedule goes to standby", () => {
    expect(
      decideMoment({
        tod: "night",
        phase: "ready",
        pending: null,
        activity: 0,
        scheduleMode: "daily",
      }).kind
    ).toBe("standby");
  });

  test("a quiet morning rests", () => {
    expect(
      decideMoment({
        tod: "morning",
        phase: "ready",
        pending: null,
        activity: 2,
        scheduleMode: "daily",
      }).kind
    ).toBe("rest");
  });
});
