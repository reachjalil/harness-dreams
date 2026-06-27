/**
 * @harness-dreams/core
 *
 * Shared primitives for the harness-dreams monorepo.
 */

export const VERSION = "0.1.0";

export function greet(name: string): string {
  return `Hello, ${name}, from @harness-dreams/core`;
}
