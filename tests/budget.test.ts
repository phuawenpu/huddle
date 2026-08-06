import { describe, it, expect } from "vitest";
import { validateScenarioParams, estimateBudget, isDurationInRange } from "@/lib/budget";

describe("validateScenarioParams", () => {
  it("accepts valid params", () => {
    const result = validateScenarioParams({
      durationMinutes: 8,
      speakerCount: 4,
      crossTalkLevel: "occasional",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects duration below 3", () => {
    const result = validateScenarioParams({
      durationMinutes: 2,
      speakerCount: 4,
      crossTalkLevel: "occasional",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Duration"))).toBe(true);
  });

  it("rejects duration above 15", () => {
    const result = validateScenarioParams({
      durationMinutes: 20,
      speakerCount: 4,
      crossTalkLevel: "occasional",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Duration"))).toBe(true);
  });

  it("rejects speaker count below 3", () => {
    const result = validateScenarioParams({
      durationMinutes: 8,
      speakerCount: 2,
      crossTalkLevel: "occasional",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Speaker"))).toBe(true);
  });

  it("rejects speaker count above 6", () => {
    const result = validateScenarioParams({
      durationMinutes: 8,
      speakerCount: 7,
      crossTalkLevel: "occasional",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Speaker"))).toBe(true);
  });

  it("rejects invalid cross-talk level", () => {
    const result = validateScenarioParams({
      durationMinutes: 8,
      speakerCount: 4,
      crossTalkLevel: "extreme" as any,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("cross-talk"))).toBe(true);
  });

  it("accepts all valid cross-talk levels", () => {
    for (const level of ["none", "occasional", "frequent"] as const) {
      const result = validateScenarioParams({
        durationMinutes: 8,
        speakerCount: 4,
        crossTalkLevel: level,
      });
      expect(result.valid).toBe(true);
    }
  });
});

describe("estimateBudget", () => {
  it("returns a budget with expected fields", () => {
    const budget = estimateBudget(8, 4, "occasional");
    expect(budget.estimatedTurns).toBeGreaterThan(0);
    expect(budget.estimatedCharacters).toBeGreaterThan(0);
    expect(budget.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(budget.characterBudget).toBeGreaterThan(budget.estimatedCharacters);
    expect(budget.turnBudget).toBeGreaterThan(budget.estimatedTurns);
  });

  it("longer durations produce more turns", () => {
    const short = estimateBudget(3, 4, "none");
    const long = estimateBudget(15, 4, "none");
    expect(long.estimatedTurns).toBeGreaterThan(short.estimatedTurns);
    expect(long.estimatedCharacters).toBeGreaterThan(short.estimatedCharacters);
  });
});

describe("isDurationInRange", () => {
  it("returns true for exact match", () => {
    expect(isDurationInRange(60000, 60000)).toBe(true);
  });

  it("returns true within 20%", () => {
    expect(isDurationInRange(60000, 70000)).toBe(true); // +16.7%
    expect(isDurationInRange(60000, 50000)).toBe(true); // -16.7%
  });

  it("returns false outside 20%", () => {
    expect(isDurationInRange(60000, 80000)).toBe(false); // +33%
    expect(isDurationInRange(60000, 40000)).toBe(false); // -33%
  });

  it("returns true at exactly 20% boundary", () => {
    expect(isDurationInRange(60000, 72000)).toBe(true); // exactly +20%
    expect(isDurationInRange(60000, 48000)).toBe(true); // exactly -20%
  });
});
