// ============================================
// Scenario Budgeting — Length, speaker count,
// and cross-talk level validation.
// ============================================

import type { CrossTalkLevel, ScenarioBudget } from "./types";

const TTS_INPUT_COST_PER_MILLION_CHARS = 15;

export function expectedOverlapCount(
  durationMinutes: number,
  crossTalkLevel: CrossTalkLevel
): number {
  if (crossTalkLevel === "none") return 0;
  const perTenMinutes = crossTalkLevel === "frequent" ? 10 : 3;
  return Math.max(1, Math.round((durationMinutes / 10) * perTenMinutes));
}

/**
 * Validate scenario parameters against allowed ranges.
 */
export function validateScenarioParams(params: {
  durationMinutes: number;
  speakerCount: number;
  crossTalkLevel: CrossTalkLevel;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.durationMinutes < 3 || params.durationMinutes > 15) {
    errors.push(`Duration must be between 3 and 15 minutes, got ${params.durationMinutes}`);
  }

  if (params.speakerCount < 3 || params.speakerCount > 6) {
    errors.push(`Speaker count must be between 3 and 6, got ${params.speakerCount}`);
  }

  const validLevels: CrossTalkLevel[] = ["none", "occasional", "frequent"];
  if (!validLevels.includes(params.crossTalkLevel)) {
    errors.push(`Invalid cross-talk level: ${params.crossTalkLevel}. Must be one of: ${validLevels.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get budget estimate for a scenario configuration.
 */
export function estimateBudget(
  durationMinutes: number,
  speakerCount: number,
  crossTalkLevel: CrossTalkLevel
): ScenarioBudget {
  const totalMs = durationMinutes * 60_000;
  const calibrationMs = speakerCount * 10_000 + (speakerCount - 1) * 2_000 + 2_000;
  const mainMs = Math.max(30_000, totalMs - calibrationMs);
  const speechMs = mainMs * 0.92;
  const targetTurns = Math.round((speechMs / 60_000) * 11);
  const targetCharacters = Math.round((speechMs / 60_000) * 750);
  const minTurnsPerSpeaker = Math.max(
    4,
    Math.floor((targetTurns * 0.6) / speakerCount)
  );
  const overlapCount = expectedOverlapCount(durationMinutes, crossTalkLevel);
  const estimatedCharacters = targetCharacters + speakerCount * 140;

  return {
    estimatedTurns: targetTurns + speakerCount,
    estimatedCharacters,
    estimatedCostUsd:
      Math.round(
        (estimatedCharacters / 1_000_000) *
          TTS_INPUT_COST_PER_MILLION_CHARS *
          100
      ) / 100,
    characterBudget: Math.round(targetCharacters * 1.15),
    turnBudget: targetTurns + speakerCount + 5,
    calibrationMs,
    targetTurns,
    targetCharacters,
    minTurnsPerSpeaker,
    overlapCount,
  };
}

/**
 * Check if realized duration is within 20% of requested.
 */
export function isDurationInRange(requestedMs: number, realizedMs: number): boolean {
  const ratio = realizedMs / requestedMs;
  return ratio >= 0.8 && ratio <= 1.2;
}
