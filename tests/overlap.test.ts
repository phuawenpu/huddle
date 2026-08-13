import { describe, it, expect } from "vitest";
import { validateOverlapRules } from "@/lib/overlap";
import type { ScenarioTurn } from "@/lib/types";

function makeTurn(
  index: number,
  startMs: number,
  endMs: number,
  overlaps?: number[],
): ScenarioTurn {
  return {
    index,
    speakerIndex: index % 4,
    text: `Turn ${index}`,
    startMs,
    endMs,
    overlapWith: overlaps,
  };
}

describe("validateOverlapRules", () => {
  it("passes valid non-overlapping turns", () => {
    const turns = [
      makeTurn(0, 0, 5000),
      makeTurn(1, 6000, 11000),
      makeTurn(2, 12000, 17000),
    ];
    const result = validateOverlapRules(turns);
    expect(result.valid).toBe(true);
  });

  it("passes valid overlap at boundaries", () => {
    const turns = [
      makeTurn(0, 0, 5000, [1]),
      makeTurn(1, 4800, 10000, [0]), // 200ms overlap at end of turn 0
    ];
    const result = validateOverlapRules(turns);
    expect(result.valid).toBe(true);
  });

  it("rejects overlap by the same speaker", () => {
    const turns = [
      { ...makeTurn(0, 0, 5000, [1]), speakerIndex: 2 },
      { ...makeTurn(1, 4800, 9000, [0]), speakerIndex: 2 },
    ];
    const result = validateOverlapRules(turns);
    expect(result.violations.some((v) => v.rule === "no_self_overlap")).toBe(
      true,
    );
  });

  it("rejects overlap longer than 60% of the shorter clip", () => {
    const turns = [makeTurn(0, 0, 5000, [1]), makeTurn(1, 3800, 5600, [0])];
    const result = validateOverlapRules(turns);
    expect(
      result.violations.some((v) => v.rule === "max_overlap_60_percent"),
    ).toBe(true);
  });

  it("rejects overlap > 1500ms", () => {
    const turns = [
      makeTurn(0, 0, 5000, [1]),
      makeTurn(1, 3000, 10000, [0]), // 2000ms overlap
    ];
    const result = validateOverlapRules(turns);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === "max_overlap_1500ms")).toBe(
      true,
    );
  });

  it("rejects three-way overlap", () => {
    const turns = [
      makeTurn(0, 0, 6000, [1]),
      makeTurn(1, 5000, 11000, [0, 2]),
      makeTurn(2, 5500, 6500, [1]),
    ];
    const result = validateOverlapRules(turns);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.rule === "no_three_way_overlap"),
    ).toBe(true);
  });

  it("rejects calibration overlap", () => {
    const turns = [makeTurn(0, 0, 5000, [1]), makeTurn(1, 4500, 10000, [0])];
    // Mark turn 0 as calibration
    const result = validateOverlapRules(turns, [0]);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.rule === "no_calibration_overlap"),
    ).toBe(true);
  });

  it("rejects overlap between the first two main-discussion turns", () => {
    const turns = [
      { ...makeTurn(0, 0, 3000), isCalibration: true },
      makeTurn(1, 3500, 8500, [2]),
      makeTurn(2, 8000, 13000, [1]),
    ];
    const result = validateOverlapRules(turns, [0]);

    expect(result.violations.some((v) => v.rule === "no_early_overlap")).toBe(
      true,
    );
  });

  it("allows a minimal overlap from the third main turn into the second", () => {
    const turns = [
      { ...makeTurn(0, 0, 3000), isCalibration: true },
      makeTurn(1, 3500, 8500),
      makeTurn(2, 9000, 14000, [3]),
      makeTurn(3, 13480, 18000, [2]),
    ];
    const result = validateOverlapRules(turns, [0]);

    expect(result.valid).toBe(true);
  });

  it("rejects mid-turn overlap (not at boundary)", () => {
    const turns = [
      makeTurn(0, 0, 10000, [1]),
      makeTurn(1, 2000, 4000, [0]), // overlap completely in the middle of turn 0
    ];
    const result = validateOverlapRules(turns);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.rule === "boundary_only_overlap"),
    ).toBe(true);
  });

  it("passes empty turn list", () => {
    const result = validateOverlapRules([]);
    expect(result.valid).toBe(true);
  });
});
