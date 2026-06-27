import { expect, test } from "vitest";

import { greet, VERSION } from "./index";

test("greet builds a scoped greeting", () => {
  expect(greet("world")).toContain("world");
});

test("exposes a version", () => {
  expect(VERSION).toBe("0.1.0");
});
