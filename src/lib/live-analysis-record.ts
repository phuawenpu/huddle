import type { LiveAnalysisSnapshot } from "./types";

export function serializeLiveAnalysis(record: any): LiveAnalysisSnapshot {
  return {
    id: record.id,
    sessionId: record.sessionId,
    objective: record.objective,
    phase: record.phase,
    criteria: safeParseJson(record.criteria, []),
    transcriptTurnCount: record.transcriptTurnCount,
    transcriptWordCount: record.transcriptWordCount,
    transcriptThroughMs: record.transcriptThroughMs,
    firstTurnId: record.firstTurnId,
    lastTurnId: record.lastTurnId,
    visualEvidenceCount: record.visualEvidenceCount,
    result: safeParseJson(record.resultJson, {}),
    createdAt: record.createdAt.toISOString(),
  };
}

function safeParseJson(value: string | null, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
