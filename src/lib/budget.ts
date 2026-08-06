// ============================================
// Scenario Budgeting — Length, speaker count,
// and cross-talk level validation.
// ============================================

import type { CrossTalkLevel, ScenarioBudget } from "./types";
import { stubEstimateScenario } from "./stubs/openai";

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
  return stubEstimateScenario(durationMinutes, speakerCount, crossTalkLevel);
}

/**
 * Check if realized duration is within 20% of requested.
 */
export function isDurationInRange(requestedMs: number, realizedMs: number): boolean {
  const ratio = realizedMs / requestedMs;
  return ratio >= 0.8 && ratio <= 1.2;
}
