// ============================================
// Critique HUD — Shared Types
// ============================================

export type RunMode = "live" | "sim_acoustic" | "sim_injected";
export type SessionStatus = "setup" | "active" | "paused" | "terminated";
export type ScenarioStatus =
  | "draft"
  | "generated"
  | "synthesizing"
  | "incomplete"
  | "rendered"
  | "ready"
  | "approved"
  | "archived";
export type RunStatus =
  "created" | "playing" | "completed" | "incomplete" | "evaluated";
export type CrossTalkLevel = "none" | "occasional" | "frequent";
export type Difficulty = "simple" | "realistic" | "challenging";
export type WorkshopType =
  | "concept_critique"
  | "design_review"
  | "retrospective"
  | "brainstorming"
  | "other";
export type DiscussionCategory =
  "evidence" | "questions" | "positions" | "decisions" | "actions" | "themes";
export type ParticipationProfile = "even" | "dominant_facilitator" | "mixed";
export type CritiqueSignalKind =
  | "observation"
  | "evidence"
  | "question"
  | "concern"
  | "position"
  | "alternative"
  | "constraint"
  | "decision"
  | "action"
  | "reference";
export type EvidenceBasis =
  "direct_observation" | "reported_evidence" | "inference" | "none";

export interface CritiqueSignal {
  kind: CritiqueSignalKind;
  summary: string;
  sourceQuote: string;
  target?: string;
  criterion?: string;
  stance?: "supports" | "challenges" | "qualifies" | "neutral";
  evidenceBasis: EvidenceBasis;
  confidence: number;
}

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
  signals?: CritiqueSignal[];
  targetCriteria?: string[];
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
  /** Milliseconds since the ASR/session connection began (never Unix epoch). */
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
  /** Session-relative milliseconds, in the same clock domain as receivedAtMs. */
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
  transcriptVersion?: number;
  transcriptQuality?: TranscriptQualityReport;
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
  calibrationMs?: number;
  targetTurns?: number;
  targetCharacters?: number;
  minTurnsPerSpeaker?: number;
  overlapCount?: number;
}

export interface ScenarioSpeaker {
  index: number;
  name: string;
  voiceId: string;
  accent: string;
  timbreClass: string;
  role?: string;
  viewpoint?: string;
  discourseStyle?: string;
  habitualMove?: string;
  instructions?: string;
  speakingRate?: number;
  targetTalkShare?: number;
  previewClipPath?: string;
}

export interface ScenarioOverlap {
  withTurnId: string;
  /** Milliseconds before the anchor utterance ends that this utterance starts. */
  startBeforeEndMs?: number;
  /** Legacy alias retained while stored version-1 transcripts are migrated. */
  startOffsetMs?: number;
  kind: "interruption" | "eager_agreement" | "backchannel";
  resolution?: "yield" | "continue" | "backchannel";
}

export interface ScenarioDelivery {
  pace: "slow" | "natural" | "quick";
  tone: string;
  volume: "soft" | "normal" | "raised";
  disfluency: "none" | "light" | "cut_off";
}

export interface ScenarioTurn {
  id?: string;
  index: number;
  speakerIndex: number;
  text: string;
  expectedCategory?: DiscussionCategory;
  expected?: {
    substantive?: boolean;
    category?: DiscussionCategory;
    potentialSignal?: string;
    reactsToTurnId?: string;
  };
  isCalibration?: boolean;
  pauseBeforeMs?: number;
  overlap?: ScenarioOverlap;
  delivery?: ScenarioDelivery;
  startMs?: number;
  endMs?: number;
  overlapWith?: number[];
  hash?: string;
}

export interface TranscriptDuplicateGroup {
  normalizedText: string;
  turnIds: string[];
  speakerNames: string[];
}

export interface TranscriptQualityReport {
  score: number;
  errors: string[];
  warnings: string[];
  duplicateGroups: TranscriptDuplicateGroup[];
  roundRobinRatio: number;
  reactionCoverage: number;
  overlapCount: number;
  realizedTimingCoverage: number;
  speakerTurnCounts: Array<{
    speakerIndex: number;
    speakerName: string;
    turns: number;
    words: number;
  }>;
}

export interface PreflightResult {
  passed: boolean;
  mergedPairs: Array<[number, number]>;
  distinctnessScores: number[];
  audioAvailable?: boolean;
  checkedAt?: string;
  reason?: string;
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
  type:
    | "turn.final"
    | "turn.updated"
    | "metrics"
    | "intelligence"
    | "map.patch"
    | "prompt.show"
    | "prompt.clear"
    | "status"
    | "playback"
    | "snapshot";
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

export interface CritiqueTrace {
  turnId: string;
  speakerLabel: string;
  summary: string;
  sourceQuote: string;
  criterion?: string;
}

export interface CriterionCoverage {
  criterion: string;
  status: "unaddressed" | "discussed" | "evidenced";
  signalCount: number;
  sourceTurnIds: string[];
}

export interface CritiqueIntelligenceSnapshot {
  analyzedTurnCount: number;
  lastUpdatedAtMs: number | null;
  signalCounts: Record<CritiqueSignalKind, number>;
  criteriaCoverage: CriterionCoverage[];
  openLoops: CritiqueTrace[];
  alternatives: CritiqueTrace[];
  decisions: CritiqueTrace[];
  actions: CritiqueTrace[];
  evidenceGaps: CritiqueTrace[];
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

export interface WindowAnalysis {
  theme: string;
  discussionState: string;
  phaseAllocation: {
    problemAndEvidence: number;
    ideas: number;
    evaluation: number;
    decisionsAndActions: number;
  };
  openQuestions: string[];
  positions: Array<{ label: string; gist: string }>;
  decisions: string[];
  actions: string[];
  agreementState: "consensus" | "majority" | "divided" | "emerging";
  minorityPosition?: string;
}

export interface PromptData {
  text: string;
  supportingTurnIds: string[];
  confidence: number;
  category: string;
}
