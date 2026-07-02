import { describe, expect, it } from 'vitest';

function ringRatio(value: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.max(0, value / goal);
}

describe('ringRatio', () => {
  it('calculates normal progress', () => {
    expect(ringRatio(30, 60)).toBe(0.5);
  });

  it('supports overflow', () => {
    expect(ringRatio(90, 60)).toBe(1.5);
  });

  it('guards invalid goals', () => {
    expect(ringRatio(90, 0)).toBe(0);
  });
});
