// ============================================
// Critique HUD — Shared Types
// ============================================

export type RunMode = "live" | "sim_acoustic" | "sim_injected";
export type SessionStatus = "setup" | "active" | "paused" | "terminated";
export type ScenarioStatus = "draft" | "generated" | "ready" | "approved" | "archived";
export type RunStatus = "created" | "playing" | "completed" | "incomplete" | "evaluated";
export type CrossTalkLevel = "none" | "occasional" | "frequent";
export type Difficulty = "simple" | "realistic" | "challenging";
export type WorkshopType = "concept_critique" | "design_review" | "retrospective" | "brainstorming" | "other";
export type DiscussionCategory = "evidence" | "questions" | "positions" | "decisions" | "actions" | "themes";
export type ParticipationProfile = "even" | "dominant_facilitator" | "mixed";

export interface TurnAnalysis {
  category: DiscussionCategory;
  confidence: number;
  evidence?: string;
  rationale?: string;
  intent?: string;
  stance?: string;
  theme?: string;
  isDistortion?: boolean;
  distortionSourcePhrase?: string;
  distortionConfidence?: number;
}

export interface WordsJson {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface SessionData {
  id: string;
  title: string;
  objective: string;
  phase: string;
  criteria: string[];
  speakerCount: number;
  status: SessionStatus;
  runMode: RunMode;
  scenarioId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptTurnData {
  id: string;
  sessionId: string;
  providerSessionId: string;
  providerTurnOrder: number;
  segmentIndex: number;
  providerSpeakerLabel: string;
  originalProviderSpeakerLabel: string;
  participantId?: string;
  startMs: number;
  endMs: number;
  receivedAtMs: number;
  originalText: string;
  currentText: string;
  wordsJson?: WordsJson[];
  isCalibration: boolean;
  isFinal: boolean;
  isSubstantive: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
  wasSpeakerRevised: boolean;
  isManuallyCorrected: boolean;
  analysis?: TurnAnalysis;
  analysisReceivedAtMs?: number;
}

export interface SpeakerMappingData {
  id: string;
  sessionId: string;
  speakerLabel: string;
  participantId?: string;
  participantName?: string;
}

export interface ParticipantData {
  id: string;
  sessionId: string;
  displayName: string;
  role: string;
  isHidden: boolean;
}

export interface DiscussionItemData {
  id: string;
  sessionId: string;
  category: DiscussionCategory;
  text: string;
  status: "open" | "resolved";
  turnIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptRecordData {
  id: string;
  sessionId: string;
  text: string;
  supportingTurnIds: string[];
  confidence: number;
  shown: boolean;
  dismissed: boolean;
  guardRejected: boolean;
  rejectReason?: string;
}

export interface ScenarioData {
  id: string;
  title: string;
  description: string;
  topic: string;
  domain: string;
  workshopType: WorkshopType;
  objective: string;
  phase: string;
  criteria: string[];
  language: string;
  durationMinutes: number;
  speakerCount: number;
  difficulty: Difficulty;
  crossTalkLevel: CrossTalkLevel;
  participationProfile: ParticipationProfile;
  budget?: ScenarioBudget;
  realizedDurationMs?: number;
  overlapRatioPct?: number;
  speakers?: ScenarioSpeaker[];
  turns?: ScenarioTurn[];
  status: ScenarioStatus;
  preflight?: PreflightResult;
  approvedAt?: string;
}

export interface ScenarioBudget {
  estimatedTurns: number;
  estimatedCharacters: number;
  estimatedCostUsd: number;
  characterBudget: number;
  turnBudget: number;
}

export interface ScenarioSpeaker {
  index: number;
  name: string;
  voiceId: string;
  accent: string;
  timbreClass: string;
  previewClipPath?: string;
}

export interface ScenarioTurn {
  index: number;
  speakerIndex: number;
  text: string;
  expectedCategory?: DiscussionCategory;
  startMs?: number;
  endMs?: number;
  overlapWith?: number[];
  hash?: string;
}

export interface PreflightResult {
  passed: boolean;
  mergedPairs: Array<[number, number]>;
  distinctnessScores: number[];
}

export interface RunData {
  id: string;
  sessionId: string;
  scenarioId?: string;
  mode: RunMode;
  stubbed: boolean;
  status: RunStatus;
  playbackEvents?: PlaybackEvent[];
  evaluation?: EvaluationResult;
  deviations: string[];
}

export interface PlaybackEvent {
  type: "turn" | "pause" | "marker";
  turnIndex?: number;
  durationMs: number;
  atMs: number;
}

export interface EvaluationResult {
  speakerAccuracyExcludingOverlaps: number;
  overlapOnlyAccuracy: number;
  unknownSubstantiveRate: number;
  lostFinalizedTurns: number;
  guardViolationsDisplayed: number;
  realizedVsRequestedDurationPct: number;
  perFieldAgreement: Record<string, number>;
  latencyPercentiles: LatencyPercentiles;
  scenarioProfile: ScenarioProfile;
}

export interface LatencyPercentiles {
  partialP50: number;
  partialP95: number;
  finalP50: number;
  finalP95: number;
  analysisP50: number;
  analysisP95: number;
  hudP95: number;
}

export interface ScenarioProfile {
  durationMinutes: number;
  speakerCount: number;
  crossTalkLevel: CrossTalkLevel;
}

export interface SSEPatch {
  type: "turn.final" | "turn.updated" | "metrics" | "map.patch" | "prompt.show" | "prompt.clear" | "status" | "playback" | "snapshot";
  data: unknown;
  id?: string;
}

export interface SessionMetrics {
  turnCount: number;
  substantiveTurnCount: number;
  totalDurationMs: number;
  talkShare: Record<string, number>;
  categoryCounts: Record<string, number>;
  streamingMinutesUsed: number;
  analysisLatencyMs: number[];
}

export interface TopicSuggestion {
  topic: string;
  domain: string;
  description: string;
}

export interface IntentData {
  id: string;
  sessionId: string;
  objective?: string;
  phase?: string;
  criteria?: string[];
  createdAt: string;
}

export interface CorrectionData {
  id: string;
  sessionId: string;
  turnId?: string;
  field: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
}
