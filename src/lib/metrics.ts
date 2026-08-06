// ============================================
// Session Metrics Calculator
// ============================================

import type { SessionMetrics, TranscriptTurnData } from "./types";

/**
 * Calculate session metrics from finalized turns.
 */
export function calculateMetrics(turns: TranscriptTurnData[]): SessionMetrics {
  const finalized = turns.filter(t => t.isFinal);
  const substantive = finalized.filter(t => t.isSubstantive);
  const nonCalibration = finalized.filter(t => !t.isCalibration);

  // Talk share: total duration per speaker label
  const talkShare: Record<string, number> = {};
  let totalDurationMs = 0;
  for (const turn of nonCalibration) {
    const duration = turn.endMs - turn.startMs;
    const label = turn.participantId || turn.providerSpeakerLabel;
    talkShare[label] = (talkShare[label] || 0) + duration;
    totalDurationMs += duration;
  }

  // Normalize to percentages
  if (totalDurationMs > 0) {
    for (const key of Object.keys(talkShare)) {
      talkShare[key] = Math.round((talkShare[key] / totalDurationMs) * 1000) / 10;
    }
  }

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const turn of substantive) {
    if (turn.analysis?.category) {
      categoryCounts[turn.analysis.category] = (categoryCounts[turn.analysis.category] || 0) + 1;
    }
  }

  // Analysis latency
  const analysisLatencyMs: number[] = [];
  for (const turn of substantive) {
    if (turn.analysisReceivedAtMs != null) {
      analysisLatencyMs.push(turn.analysisReceivedAtMs - turn.receivedAtMs);
    }
  }

  // Streaming minutes (rough estimate from first to last turn)
  let streamingMinutesUsed = 0;
  if (finalized.length > 0) {
    const firstMs = finalized[0].receivedAtMs;
    const lastMs = finalized[finalized.length - 1].receivedAtMs;
    streamingMinutesUsed = Math.round(((lastMs - firstMs) / 60000) * 10) / 10;
  }

  return {
    turnCount: finalized.length,
    substantiveTurnCount: substantive.length,
    totalDurationMs,
    talkShare,
    categoryCounts,
    streamingMinutesUsed,
    analysisLatencyMs,
  };
}
