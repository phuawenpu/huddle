// ============================================
// Prompt Guard — Blocks prompts that name
// participants or use blocklisted traits.
// ============================================

import type { ParticipantData } from "./types";

const BLOCKLISTED_TRAITS = [
  "aggressive", "arrogant", "authoritarian", "biased",
  "charismatic", "creative", "deceptive", "dominant",
  "emotional", "empathic", "extraverted", "genius",
  "incompetent", "intelligent", "introverted", "lazy",
  "narcissistic", "neurotic", "passive", "personality",
  "smart", "stubborn", "talented", "toxic",
  "warm", "cold", "likeable", "unlikeable",
];

const BLOCKLISTED_TERMS = [
  ...BLOCKLISTED_TRAITS,
  "good speaker", "bad speaker", "best speaker", "worst speaker",
  "leader", "follower", "dominates", "dominating",
  "always right", "always wrong", "never listens",
  "talking too much", "too quiet", "shy", "outspoken",
];

const FORBIDDEN_TERMS = [
  "anxiety", "depressed", "depression", "disorder",
  "mental health", "psychological", "trauma",
];

/**
 * Check if a prompt text violates guard rules.
 * Returns { allowed: false, reason } or { allowed: true }.
 */
export function checkPromptGuard(
  promptText: string,
  participants: ParticipantData[],
  sessionObjective: string
): { allowed: boolean; reason?: string } {
  const lower = promptText.toLowerCase();

  // Rule 1: No participant names in prompt
  for (const p of participants) {
    const nameLower = p.displayName.toLowerCase();
    if (lower.includes(nameLower)) {
      return {
        allowed: false,
        reason: `Prompt references participant "${p.displayName}". Prompts must not name individual participants.`,
      };
    }
  }

  // Rule 2: No blocklisted traits
  for (const term of BLOCKLISTED_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      return {
        allowed: false,
        reason: `Prompt contains a blocklisted trait or term: "${term}". Prompts describe language patterns, never people.`,
      };
    }
  }

  // Rule 3: No forbidden terms (mental health, etc.)
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      return {
        allowed: false,
        reason: `Prompt contains a forbidden term: "${term}". Health-related language is not permitted.`,
      };
    }
  }

  // Rule 4: Prompt must relate to the session objective
  const objectiveWords = sessionObjective.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlapCount = objectiveWords.filter(w => lower.includes(w)).length;
  if (overlapCount < 2 && sessionObjective.length > 0) {
    return {
      allowed: false,
      reason: `Prompt does not appear to relate to the session objective. Please align the prompt with: "${sessionObjective}"`,
    };
  }

  return { allowed: true };
}
