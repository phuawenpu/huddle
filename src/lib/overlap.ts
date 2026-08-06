// ============================================
// Overlap Rule Validator
// ============================================

import type { ScenarioTurn } from "./types";

export interface OverlapValidationResult {
  valid: boolean;
  violations: OverlapViolation[];
}

export interface OverlapViolation {
  rule: string;
  turnIndices: number[];
  detail: string;
}

/**
 * Validate overlap rules for a scenario's turn schedule:
 * 1. No calibration turn overlaps
 * 2. Never three concurrent speakers
 * 3. Max overlap duration ≤ 1500ms
 * 4. Overlaps only at turn boundaries (within first/last 500ms of a turn)
 */
export function validateOverlapRules(turns: ScenarioTurn[], calibrationIndices: number[] = []): OverlapValidationResult {
  const violations: OverlapViolation[] = [];
  const calibSet = new Set(calibrationIndices);

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (!turn.overlapWith || turn.overlapWith.length === 0) continue;

    for (const otherIdx of turn.overlapWith) {
      if (otherIdx <= i) continue; // Only check each pair once
      const other = turns[otherIdx];
      if (!other) continue;

      // Overlap duration
      const overlapStart = Math.max(turn.startMs!, other.startMs!);
      const overlapEnd = Math.min(turn.endMs!, other.endMs!);
      const overlapDuration = overlapEnd - overlapStart;

      if (overlapDuration <= 0) continue; // Not actually overlapping

      // Rule 1: No calibration overlap
      if (calibSet.has(i) || calibSet.has(otherIdx)) {
        violations.push({
          rule: "no_calibration_overlap",
          turnIndices: [i, otherIdx],
          detail: `Calibration turn ${calibSet.has(i) ? i : otherIdx} overlaps with another turn.`,
        });
      }

      // Rule 2: Never three concurrent speakers
      const concurrentSpeakers = new Set([i, otherIdx]);
      for (let j = 0; j < turns.length; j++) {
        if (j === i || j === otherIdx) continue;
        const t = turns[j];
        if (!t.startMs || !t.endMs) continue;
        if (t.startMs < overlapEnd && t.endMs > overlapStart) {
          concurrentSpeakers.add(j);
        }
      }
      if (concurrentSpeakers.size >= 3) {
        violations.push({
          rule: "no_three_way_overlap",
          turnIndices: [...concurrentSpeakers],
          detail: `Three or more speakers overlap concurrently: indices ${[...concurrentSpeakers].join(", ")}.`,
        });
      }

      // Rule 3: Max overlap 1500ms
      if (overlapDuration > 1500) {
        violations.push({
          rule: "max_overlap_1500ms",
          turnIndices: [i, otherIdx],
          detail: `Overlap duration ${overlapDuration}ms exceeds maximum of 1500ms.`,
        });
      }

      // Rule 4: Overlap only at boundaries (within first or last 500ms)
      const turnDuration = turn.endMs! - turn.startMs!;
      const otherDuration = other.endMs! - other.startMs!;
      const overlapFromTurnStart = overlapStart - turn.startMs!;
      const overlapFromTurnEnd = turn.endMs! - overlapEnd;
      const overlapFromOtherStart = overlapStart - other.startMs!;
      const overlapFromOtherEnd = other.endMs! - overlapEnd;

      const turnAtBoundary =
        overlapFromTurnStart <= 500 || overlapFromTurnEnd <= 500;
      const otherAtBoundary =
        overlapFromOtherStart <= 500 || overlapFromOtherEnd <= 500;

      if (!turnAtBoundary || !otherAtBoundary) {
        violations.push({
          rule: "boundary_only_overlap",
          turnIndices: [i, otherIdx],
          detail: `Overlap is not at turn boundaries. Turn ${i} boundary offsets: start=${overlapFromTurnStart}ms, end=${overlapFromTurnEnd}ms. Turn ${otherIdx} boundary offsets: start=${overlapFromOtherStart}ms, end=${overlapFromOtherEnd}ms.`,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
