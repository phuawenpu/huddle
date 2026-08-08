import {
  analyzeTranscriptQuality,
  normalizeScenarioTurns,
  TRANSCRIPT_FORMAT_VERSION,
} from "./scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "./types";

export function serializeScenarioRecord(scenario: any) {
  const speakers = safeParseJson<ScenarioSpeaker[]>(scenario.speakersJson, []);
  const turns = normalizeScenarioTurns(
    safeParseJson<ScenarioTurn[]>(scenario.turnsJson, []),
    speakers.length || scenario.speakerCount || 0
  );
  return {
    ...scenario,
    criteria: safeParseJson(scenario.criteria, []),
    budget: safeParseJson(scenario.budgetJson, null),
    speakers: scenario.speakersJson ? speakers : null,
    turns: scenario.turnsJson ? turns : null,
    transcriptVersion: TRANSCRIPT_FORMAT_VERSION,
    transcriptQuality:
      speakers.length && turns.length
        ? analyzeTranscriptQuality(turns, speakers)
        : null,
    expectedWindowOutcome: safeParseJson(
      scenario.expectedWindowOutcomeJson,
      null
    ),
    preflight: safeParseJson(scenario.preflightJson, null),
    createdAt: scenario.createdAt?.toISOString(),
    updatedAt: scenario.updatedAt?.toISOString(),
    approvedAt: scenario.approvedAt?.toISOString() || null,
  };
}

export function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
