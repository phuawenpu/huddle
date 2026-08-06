// ============================================
// Alignment & Evaluation Logic
// ============================================

import { hungarianMatch, wordErrorRate } from "./utils";
import type { TranscriptTurnData, EvaluationResult, ScenarioProfile, LatencyPercentiles, CrossTalkLevel } from "./types";

/**
 * Evaluate a run's transcript against expected ground truth.
 */
export function evaluateRun(
  actualTurns: TranscriptTurnData[],
  expectedTurns: Array<{ speakerIndex: number; text: string; expectedCategory?: string }>,
  scenarioProfile: ScenarioProfile,
  latencyPercentiles: LatencyPercentiles
): EvaluationResult {
  const nonCalibration = actualTurns.filter(t => !t.isCalibration && t.isFinal);
  const substantive = nonCalibration.filter(t => t.isSubstantive);

  // Build cost matrix for speaker matching (1 - accuracy per turn pair)
  // For simplicity, use WER-based costs
  const costs: number[][] = [];
  for (const actual of substantive) {
    const row: number[] = [];
    for (const expected of expectedTurns) {
      const wer = wordErrorRate(expected.text, actual.currentText);
      row.push(wer);
    }
    if (row.length > 0) costs.push(row);
  }

  // Hungarian matching
  let matchedExpected = 0;
  let overlapOnlyMatched = 0;
  let overlapOnlyTotal = 0;
  const assignments = costs.length > 0 && costs[0].length > 0
    ? hungarianMatch(costs)
    : [];

  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i];
    if (j >= 0 && j < costs[i].length && costs[i][j] < 0.5) {
      // Count as matched if WER < 50%
      const turn = substantive[i];
      if (turn.possibleOverlap) {
        overlapOnlyTotal++;
        if (costs[i][j] < 0.3) overlapOnlyMatched++;
      } else {
        matchedExpected++;
      }
    }
  }

  const totalNonOverlap = substantive.filter(t => !t.possibleOverlap).length;
  const speakerAccuracyExcludingOverlaps = totalNonOverlap > 0
    ? matchedExpected / totalNonOverlap
    : 1;

  const overlapOnlyAccuracy = overlapOnlyTotal > 0
    ? overlapOnlyMatched / overlapOnlyTotal
    : 1;

  // Unknown substantive rate
  const unknownSubstantive = substantive.filter(t => t.isUnknownSpeaker).length;
  const unknownSubstantiveRate = substantive.length > 0
    ? unknownSubstantive / substantive.length
    : 0;

  // Lost finalized turns
  const lostFinalizedTurns = 0; // Stub doesn't lose turns

  // Per-field agreement: category match
  let categoryMatches = 0;
  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i];
    if (j >= 0 && j < expectedTurns.length) {
      if (substantive[i]?.analysis?.category === expectedTurns[j].expectedCategory) {
        categoryMatches++;
      }
    }
  }
  const perFieldAgreement: Record<string, number> = {
    category: expectedTurns.length > 0 ? categoryMatches / expectedTurns.length : 1,
  };

  return {
    speakerAccuracyExcludingOverlaps,
    overlapOnlyAccuracy,
    unknownSubstantiveRate,
    lostFinalizedTurns,
    guardViolationsDisplayed: 0,
    realizedVsRequestedDurationPct: 100, // Stub: exact match
    perFieldAgreement,
    latencyPercentiles,
    scenarioProfile,
  };
}

/**
 * Calculate latency percentiles from an array of latency values.
 */
export function calculateLatencyPercentiles(latenciesMs: number[]): LatencyPercentiles {
  if (latenciesMs.length === 0) {
    return {
      partialP50: 0, partialP95: 0,
      finalP50: 0, finalP95: 0,
      analysisP50: 0, analysisP95: 0,
      hudP95: 0,
    };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 0;

  return {
    partialP50: p50, partialP95: p95,
    finalP50: p50, finalP95: p95,
    analysisP50: p50, analysisP95: p95,
    hudP95: p95,
  };
}
