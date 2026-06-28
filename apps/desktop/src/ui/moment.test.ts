import { describe, expect, test } from "vitest";

import type { DreamReport } from "../shared/types";
import { decideMoment } from "./moment";

const pending = { id: "pending" } as DreamReport;

describe("decideMoment", () => {
  test("a running cycle beats everything else", () => {
    expect(
      decideMoment({
        tod: "morning",
        phase: "dreaming",
        pending,
        activity: 9,
        scheduleMode: "manual",
      }).kind
    ).toBe("running");
  });

  test("a pending cycle becomes the review moment", () => {
    expect(
      decideMoment({
        tod: "evening",
        phase: "ready",
        pending,
        activity: 9,
        scheduleMode: "nightly",
      })
    ).toEqual({ kind: "review", ctaKind: "review" });
  });

  test("midday with enough activity suggests a nap", () => {
    expect(
      decideMoment({
        tod: "midday",
        phase: "ready",
        pending: null,
        activity: 4,
        scheduleMode: "manual",
      })
    ).toEqual({ kind: "nap", ctaKind: "nap" });
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

  test("a full evening suggests a sleep cycle", () => {
    expect(
      decideMoment({
        tod: "evening",
        phase: "ready",
        pending: null,
        activity: 9,
        scheduleMode: "manual",
      })
    ).toEqual({ kind: "sleep", ctaKind: "sleep" });
  });

  test("night on a nightly schedule goes to standby", () => {
    expect(
      decideMoment({
        tod: "night",
        phase: "ready",
        pending: null,
        activity: 0,
        scheduleMode: "nightly",
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
        scheduleMode: "nightly",
      }).kind
    ).toBe("rest");
  });
});
