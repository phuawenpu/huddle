import { hungarianMatch, normalizeAsrWords, wordErrorStats } from "./utils";
import type { WordErrorStats } from "./utils";

const UNKNOWN_LABELS = new Set(["", "UNKNOWN", "PENDING"]);

export interface SpeechReferenceTurn {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startMs: number;
  endMs: number;
  isCalibration?: boolean;
}

export interface SpeechHypothesisWord {
  word?: string;
  text?: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface SpeechHypothesisTurn {
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  words?: SpeechHypothesisWord[] | null;
}

export interface SpeechEvaluationOptions {
  startMs?: number;
  endMs?: number;
  collarMs?: number;
  includeCalibration?: boolean;
  useCalibrationForMapping?: boolean;
  hypothesisTimeOffsetMs?: number;
}

export type SpeechWordMetrics = WordErrorStats;

export interface DiarizationMetrics {
  errorRate: number | null;
  missedSpeechMs: number;
  falseAlarmMs: number;
  speakerConfusionMs: number;
  totalErrorMs: number;
  referenceSpeakerMs: number;
  scoredTimelineMs: number;
}

export interface SpeechEvaluationReport {
  version: 1;
  window: {
    startMs: number;
    endMs: number;
    collarMs: number;
    calibrationExcluded: boolean;
    hypothesisTimeOffsetMs: number;
  };
  reference: {
    turnCount: number;
    speakerCount: number;
    wordCount: number;
    overlapIntervals: Array<{ startMs: number; endMs: number }>;
    overlapSpeakerMs: number;
  };
  hypothesis: {
    turnCount: number;
    speakerLabelCount: number;
    wordCount: number;
    unknownWordCount: number;
  };
  speakerMapping: Array<{
    hypothesisLabel: string;
    referenceSpeakerId: string;
    referenceSpeakerName: string;
    overlappedMs: number;
  }>;
  unmappedHypothesisLabels: string[];
  wordError: {
    overall: SpeechWordMetrics;
    speakerAttributed: SpeechWordMetrics;
    nonOverlap: SpeechWordMetrics;
    overlap: SpeechWordMetrics;
    overlapSpeakerAttributed: SpeechWordMetrics;
    perSpeaker: Array<{
      speakerId: string;
      speakerName: string;
      metrics: SpeechWordMetrics;
    }>;
  };
  diarization: {
    excludingOverlap: DiarizationMetrics;
    includingOverlap: DiarizationMetrics;
  };
  notes: string[];
}

interface Segment {
  startMs: number;
  endMs: number;
  key: string;
}

interface TimedToken {
  token: string;
  startMs: number;
  endMs: number;
  speakerKey: string;
  stableOrder: number;
}

export function evaluateSpeechRecognition(
  referenceTurns: SpeechReferenceTurn[],
  hypothesisTurns: SpeechHypothesisTurn[],
  options: SpeechEvaluationOptions = {},
): SpeechEvaluationReport {
  const validReference = referenceTurns.filter(validReferenceTurn);
  const validHypothesis = hypothesisTurns.filter(validHypothesisTurn);
  if (validReference.length === 0) {
    throw new Error("Speech evaluation requires realized reference turns.");
  }

  const naturalStart = Math.min(...validReference.map((turn) => turn.startMs));
  const naturalEnd = Math.max(...validReference.map((turn) => turn.endMs));
  const startMs = finiteOr(options.startMs, naturalStart);
  const endMs = finiteOr(options.endMs, naturalEnd);
  if (startMs < 0 || endMs <= startMs) {
    throw new Error("Speech evaluation requires a positive evaluation window.");
  }
  const collarMs = clamp(finiteOr(options.collarMs, 250), 0, 2000);
  const includeCalibration = Boolean(options.includeCalibration);
  const useCalibrationForMapping = options.useCalibrationForMapping !== false;
  const hypothesisTimeOffsetMs = finiteOr(options.hypothesisTimeOffsetMs, 0);

  const shiftedHypothesis = validHypothesis.map((turn) => ({
    ...turn,
    startMs: turn.startMs + hypothesisTimeOffsetMs,
    endMs: turn.endMs + hypothesisTimeOffsetMs,
    words: turn.words?.map((word) => ({
      ...word,
      start: word.start + hypothesisTimeOffsetMs,
      end: word.end + hypothesisTimeOffsetMs,
    })),
  }));
  const calibrationIntervals = includeCalibration
    ? []
    : mergeIntervals(
        validReference
          .filter((turn) => turn.isCalibration)
          .map((turn) => clipInterval(turn, startMs, endMs))
          .filter(isInterval),
      );
  const scoringReference = validReference.filter(
    (turn) => includeCalibration || !turn.isCalibration,
  );
  const mappingReference = validReference.filter(
    (turn) => useCalibrationForMapping || !turn.isCalibration,
  );
  const referenceSegments = toReferenceSegments(
    scoringReference,
    startMs,
    endMs,
  );
  const mappingSegments = toReferenceSegments(mappingReference, startMs, endMs);
  const hypothesisSegments = toHypothesisSegments(
    shiftedHypothesis,
    startMs,
    endMs,
  );
  const speakerNames = new Map(
    validReference.map((turn) => [turn.speakerId, turn.speakerName]),
  );
  const mapping = mapHypothesisSpeakers(mappingSegments, hypothesisSegments);
  const overlapIntervals = findReferenceOverlapIntervals(
    referenceSegments,
    startMs,
    endMs,
    calibrationIntervals,
  );

  const referenceTokens = timedReferenceTokens(scoringReference).filter(
    (token) => tokenInScoreWindow(token, startMs, endMs, calibrationIntervals),
  );
  const hypothesisTokens = timedHypothesisTokens(shiftedHypothesis).filter(
    (token) => tokenInScoreWindow(token, startMs, endMs, calibrationIntervals),
  );
  const referenceOverlapTokens = referenceTokens.filter((token) =>
    pointInIntervals(midpoint(token), overlapIntervals),
  );
  const hypothesisOverlapTokens = hypothesisTokens.filter((token) =>
    pointInIntervals(midpoint(token), overlapIntervals),
  );
  const referenceNonOverlapTokens = referenceTokens.filter(
    (token) => !pointInIntervals(midpoint(token), overlapIntervals),
  );
  const hypothesisNonOverlapTokens = hypothesisTokens.filter(
    (token) => !pointInIntervals(midpoint(token), overlapIntervals),
  );

  const speakerIds = [
    ...new Set(referenceTokens.map((token) => token.speakerKey)),
  ];
  const perSpeaker = speakerIds.map((speakerId) => ({
    speakerId,
    speakerName: speakerNames.get(speakerId) || speakerId,
    metrics: scoreWords(
      referenceTokens.filter((token) => token.speakerKey === speakerId),
      hypothesisTokens.filter(
        (token) => mapping.get(token.speakerKey) === speakerId,
      ),
    ),
  }));
  const speakerMapping = [...mapping.entries()]
    .map(([hypothesisLabel, referenceSpeakerId]) => ({
      hypothesisLabel,
      referenceSpeakerId,
      referenceSpeakerName:
        speakerNames.get(referenceSpeakerId) || referenceSpeakerId,
      overlappedMs: pairwiseOverlapMs(
        mappingSegments.filter((segment) => segment.key === referenceSpeakerId),
        hypothesisSegments.filter((segment) => segment.key === hypothesisLabel),
      ),
    }))
    .sort((a, b) => a.hypothesisLabel.localeCompare(b.hypothesisLabel));
  const hypothesisLabels = [
    ...new Set(
      hypothesisSegments
        .map((segment) => normalizeSpeakerLabel(segment.key))
        .filter((label) => !isUnknownLabel(label)),
    ),
  ];
  const unmappedHypothesisLabels = hypothesisLabels.filter(
    (label) => !mapping.has(label),
  );

  return {
    version: 1,
    window: {
      startMs,
      endMs,
      collarMs,
      calibrationExcluded: !includeCalibration,
      hypothesisTimeOffsetMs,
    },
    reference: {
      turnCount: scoringReference.filter((turn) =>
        intervalsIntersect(turn, { startMs, endMs }),
      ).length,
      speakerCount: speakerIds.length,
      wordCount: referenceTokens.length,
      overlapIntervals,
      overlapSpeakerMs: scoreReferenceOverlapMs(
        referenceSegments,
        overlapIntervals,
      ),
    },
    hypothesis: {
      turnCount: shiftedHypothesis.filter((turn) =>
        intervalsIntersect(turn, { startMs, endMs }),
      ).length,
      speakerLabelCount: hypothesisLabels.length,
      wordCount: hypothesisTokens.length,
      unknownWordCount: hypothesisTokens.filter((token) =>
        isUnknownLabel(token.speakerKey),
      ).length,
    },
    speakerMapping,
    unmappedHypothesisLabels,
    wordError: {
      overall: scoreWords(referenceTokens, hypothesisTokens),
      speakerAttributed: scoreSpeakerAttributedWords(
        referenceTokens,
        hypothesisTokens,
        mapping,
      ),
      nonOverlap: scoreWords(
        referenceNonOverlapTokens,
        hypothesisNonOverlapTokens,
      ),
      overlap: scoreWords(referenceOverlapTokens, hypothesisOverlapTokens),
      overlapSpeakerAttributed: scoreSpeakerAttributedWords(
        referenceOverlapTokens,
        hypothesisOverlapTokens,
        mapping,
      ),
      perSpeaker,
    },
    diarization: {
      excludingOverlap: scoreDiarization(
        referenceSegments,
        hypothesisSegments,
        mapping,
        {
          startMs,
          endMs,
          collarMs,
          includeOverlap: false,
          excludedIntervals: calibrationIntervals,
        },
      ),
      includingOverlap: scoreDiarization(
        referenceSegments,
        hypothesisSegments,
        mapping,
        {
          startMs,
          endMs,
          collarMs,
          includeOverlap: true,
          excludedIntervals: calibrationIntervals,
        },
      ),
    },
    notes: [
      "Provider speaker labels are mapped to reference speakers by maximum temporal overlap.",
      "Reference word times are uniformly estimated within each realized TTS utterance; hypothesis word times use provider timestamps when available.",
      "Overlap word error is scored inside intervals where at least two reference speakers are active.",
      "Diarization error is (missed speaker-time + false-alarm speaker-time + confused speaker-time) / reference speaker-time.",
    ],
  };
}

function scoreWords(
  reference: TimedToken[],
  hypothesis: TimedToken[],
): SpeechWordMetrics {
  return wordErrorStats(orderedWords(reference), orderedWords(hypothesis));
}

function scoreSpeakerAttributedWords(
  reference: TimedToken[],
  hypothesis: TimedToken[],
  mapping: Map<string, string>,
): SpeechWordMetrics {
  const speakerIds = [...new Set(reference.map((token) => token.speakerKey))];
  const totals: WordErrorStats = {
    substitutions: 0,
    deletions: 0,
    insertions: 0,
    errors: 0,
    referenceWords: 0,
    hypothesisWords: 0,
    rate: 0,
  };
  for (const speakerId of speakerIds) {
    addWordStats(
      totals,
      wordErrorStats(
        orderedWords(
          reference.filter((token) => token.speakerKey === speakerId),
        ),
        orderedWords(
          hypothesis.filter(
            (token) => mapping.get(token.speakerKey) === speakerId,
          ),
        ),
      ),
    );
  }
  const unmappedWords = hypothesis.filter(
    (token) => !mapping.has(token.speakerKey),
  ).length;
  totals.insertions += unmappedWords;
  totals.errors += unmappedWords;
  totals.hypothesisWords += unmappedWords;
  totals.rate =
    totals.referenceWords > 0
      ? totals.errors / totals.referenceWords
      : totals.errors === 0
        ? 0
        : null;
  return totals;
}

function addWordStats(target: WordErrorStats, value: WordErrorStats) {
  target.substitutions += value.substitutions;
  target.deletions += value.deletions;
  target.insertions += value.insertions;
  target.errors += value.errors;
  target.referenceWords += value.referenceWords;
  target.hypothesisWords += value.hypothesisWords;
}

function scoreDiarization(
  reference: Segment[],
  hypothesis: Segment[],
  mapping: Map<string, string>,
  options: {
    startMs: number;
    endMs: number;
    collarMs: number;
    includeOverlap: boolean;
    excludedIntervals: Array<{ startMs: number; endMs: number }>;
  },
): DiarizationMetrics {
  const collarIntervals = buildCollarIntervals(
    reference,
    options.collarMs,
    options.startMs,
    options.endMs,
  );
  const boundaries = uniqueSorted([
    options.startMs,
    options.endMs,
    ...reference.flatMap((segment) => [segment.startMs, segment.endMs]),
    ...hypothesis.flatMap((segment) => [segment.startMs, segment.endMs]),
    ...options.excludedIntervals.flatMap((interval) => [
      interval.startMs,
      interval.endMs,
    ]),
    ...collarIntervals.flatMap((interval) => [
      interval.startMs,
      interval.endMs,
    ]),
  ]).filter((value) => value >= options.startMs && value <= options.endMs);

  let missedSpeechMs = 0;
  let falseAlarmMs = 0;
  let speakerConfusionMs = 0;
  let referenceSpeakerMs = 0;
  let scoredTimelineMs = 0;
  for (let index = 1; index < boundaries.length; index++) {
    const intervalStart = boundaries[index - 1];
    const intervalEnd = boundaries[index];
    const duration = intervalEnd - intervalStart;
    if (duration <= 0) continue;
    const point = intervalStart + duration / 2;
    if (
      pointInIntervals(point, options.excludedIntervals) ||
      pointInIntervals(point, collarIntervals)
    ) {
      continue;
    }
    const activeReference = activeKeys(reference, point);
    const activeHypothesis = activeKeys(hypothesis, point);
    if (!options.includeOverlap && activeReference.size > 1) continue;
    if (activeReference.size === 0 && activeHypothesis.size === 0) continue;

    const mappedHypothesis = new Set(
      [...activeHypothesis]
        .map((label) => mapping.get(label))
        .filter((speaker): speaker is string => Boolean(speaker)),
    );
    const correct = [...mappedHypothesis].filter((speaker) =>
      activeReference.has(speaker),
    ).length;
    const referenceCount = activeReference.size;
    const hypothesisCount = activeHypothesis.size;
    const miss = Math.max(0, referenceCount - hypothesisCount);
    const falseAlarm = Math.max(0, hypothesisCount - referenceCount);
    const confusion = Math.max(
      0,
      Math.min(referenceCount, hypothesisCount) - correct,
    );
    missedSpeechMs += miss * duration;
    falseAlarmMs += falseAlarm * duration;
    speakerConfusionMs += confusion * duration;
    referenceSpeakerMs += referenceCount * duration;
    scoredTimelineMs += duration;
  }
  const totalErrorMs = missedSpeechMs + falseAlarmMs + speakerConfusionMs;
  return {
    errorRate:
      referenceSpeakerMs > 0 ? totalErrorMs / referenceSpeakerMs : null,
    missedSpeechMs: roundMs(missedSpeechMs),
    falseAlarmMs: roundMs(falseAlarmMs),
    speakerConfusionMs: roundMs(speakerConfusionMs),
    totalErrorMs: roundMs(totalErrorMs),
    referenceSpeakerMs: roundMs(referenceSpeakerMs),
    scoredTimelineMs: roundMs(scoredTimelineMs),
  };
}

function mapHypothesisSpeakers(
  reference: Segment[],
  hypothesis: Segment[],
): Map<string, string> {
  const referenceKeys = [...new Set(reference.map((segment) => segment.key))];
  const hypothesisKeys = [
    ...new Set(
      hypothesis
        .map((segment) => normalizeSpeakerLabel(segment.key))
        .filter((label) => !isUnknownLabel(label)),
    ),
  ];
  if (referenceKeys.length === 0 || hypothesisKeys.length === 0) {
    return new Map();
  }
  const size = Math.max(referenceKeys.length, hypothesisKeys.length);
  const weights = Array.from({ length: size }, (_, referenceIndex) =>
    Array.from({ length: size }, (_, hypothesisIndex) => {
      if (
        referenceIndex >= referenceKeys.length ||
        hypothesisIndex >= hypothesisKeys.length
      ) {
        return 0;
      }
      return pairwiseOverlapMs(
        reference.filter(
          (segment) => segment.key === referenceKeys[referenceIndex],
        ),
        hypothesis.filter(
          (segment) =>
            normalizeSpeakerLabel(segment.key) ===
            hypothesisKeys[hypothesisIndex],
        ),
      );
    }),
  );
  const maximum = Math.max(0, ...weights.flat());
  const assignments = hungarianMatch(
    weights.map((row) => row.map((weight) => maximum - weight)),
  );
  const mapping = new Map<string, string>();
  assignments.forEach((hypothesisIndex, referenceIndex) => {
    if (
      referenceIndex < referenceKeys.length &&
      hypothesisIndex >= 0 &&
      hypothesisIndex < hypothesisKeys.length &&
      weights[referenceIndex][hypothesisIndex] > 0
    ) {
      mapping.set(
        hypothesisKeys[hypothesisIndex],
        referenceKeys[referenceIndex],
      );
    }
  });
  return mapping;
}

function timedReferenceTokens(turns: SpeechReferenceTurn[]): TimedToken[] {
  let stableOrder = 0;
  return turns.flatMap((turn) =>
    distributeTokens(
      normalizeAsrWords(turn.text),
      turn.startMs,
      turn.endMs,
      turn.speakerId,
      () => stableOrder++,
    ),
  );
}

function timedHypothesisTokens(turns: SpeechHypothesisTurn[]): TimedToken[] {
  let stableOrder = 0;
  return turns.flatMap((turn) => {
    if (turn.words?.length) {
      return turn.words.flatMap((word) =>
        distributeTokens(
          normalizeAsrWords(String(word.word || word.text || "")),
          finiteOr(word.start, turn.startMs),
          finiteOr(word.end, turn.endMs),
          normalizeSpeakerLabel(word.speaker || turn.speakerLabel),
          () => stableOrder++,
        ),
      );
    }
    return distributeTokens(
      normalizeAsrWords(turn.text),
      turn.startMs,
      turn.endMs,
      normalizeSpeakerLabel(turn.speakerLabel),
      () => stableOrder++,
    );
  });
}

function distributeTokens(
  tokens: string[],
  startMs: number,
  endMs: number,
  speakerKey: string,
  nextOrder: () => number,
): TimedToken[] {
  if (tokens.length === 0) return [];
  const duration = Math.max(0, endMs - startMs);
  return tokens.map((token, index) => ({
    token,
    startMs: startMs + (duration * index) / tokens.length,
    endMs: startMs + (duration * (index + 1)) / tokens.length,
    speakerKey,
    stableOrder: nextOrder(),
  }));
}

function toReferenceSegments(
  turns: SpeechReferenceTurn[],
  startMs: number,
  endMs: number,
): Segment[] {
  return turns
    .map((turn) => {
      const clipped = clipInterval(turn, startMs, endMs);
      return clipped ? { ...clipped, key: turn.speakerId } : null;
    })
    .filter((segment): segment is Segment => Boolean(segment));
}

function toHypothesisSegments(
  turns: SpeechHypothesisTurn[],
  startMs: number,
  endMs: number,
): Segment[] {
  return turns
    .map((turn) => {
      const clipped = clipInterval(turn, startMs, endMs);
      return clipped
        ? {
            ...clipped,
            key: normalizeSpeakerLabel(turn.speakerLabel),
          }
        : null;
    })
    .filter((segment): segment is Segment => Boolean(segment));
}

function findReferenceOverlapIntervals(
  reference: Segment[],
  startMs: number,
  endMs: number,
  excludedIntervals: Array<{ startMs: number; endMs: number }>,
) {
  const boundaries = uniqueSorted([
    startMs,
    endMs,
    ...reference.flatMap((segment) => [segment.startMs, segment.endMs]),
  ]);
  const intervals: Array<{ startMs: number; endMs: number }> = [];
  for (let index = 1; index < boundaries.length; index++) {
    const interval = {
      startMs: boundaries[index - 1],
      endMs: boundaries[index],
    };
    const point = midpoint(interval);
    if (
      interval.endMs > interval.startMs &&
      !pointInIntervals(point, excludedIntervals) &&
      activeKeys(reference, point).size >= 2
    ) {
      intervals.push(interval);
    }
  }
  return mergeIntervals(intervals);
}

function scoreReferenceOverlapMs(
  reference: Segment[],
  overlapIntervals: Array<{ startMs: number; endMs: number }>,
) {
  return roundMs(
    overlapIntervals.reduce((total, interval) => {
      const point = midpoint(interval);
      return (
        total +
        (interval.endMs - interval.startMs) * activeKeys(reference, point).size
      );
    }, 0),
  );
}

function buildCollarIntervals(
  reference: Segment[],
  collarMs: number,
  startMs: number,
  endMs: number,
) {
  if (collarMs <= 0) return [];
  return mergeIntervals(
    uniqueSorted(
      reference.flatMap((segment) => [segment.startMs, segment.endMs]),
    )
      .filter((boundary) => boundary > startMs && boundary < endMs)
      .map((boundary) => ({
        startMs: Math.max(startMs, boundary - collarMs),
        endMs: Math.min(endMs, boundary + collarMs),
      })),
  );
}

function pairwiseOverlapMs(left: Segment[], right: Segment[]) {
  let total = 0;
  const mergedLeft = mergeIntervals(left);
  const mergedRight = mergeIntervals(right);
  for (const a of mergedLeft) {
    for (const b of mergedRight) {
      total += Math.max(
        0,
        Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs),
      );
    }
  }
  return roundMs(total);
}

function orderedWords(tokens: TimedToken[]) {
  return [...tokens]
    .sort(
      (a, b) =>
        midpoint(a) - midpoint(b) ||
        a.speakerKey.localeCompare(b.speakerKey) ||
        a.stableOrder - b.stableOrder,
    )
    .map((token) => token.token);
}

function activeKeys(segments: Segment[], point: number) {
  return new Set(
    segments
      .filter((segment) => point >= segment.startMs && point < segment.endMs)
      .map((segment) => segment.key),
  );
}

function tokenInScoreWindow(
  token: TimedToken,
  startMs: number,
  endMs: number,
  excludedIntervals: Array<{ startMs: number; endMs: number }>,
) {
  const point = midpoint(token);
  return (
    point >= startMs &&
    point <= endMs &&
    !pointInIntervals(point, excludedIntervals)
  );
}

function pointInIntervals(
  point: number,
  intervals: Array<{ startMs: number; endMs: number }>,
) {
  return intervals.some(
    (interval) => point >= interval.startMs && point < interval.endMs,
  );
}

function mergeIntervals<T extends { startMs: number; endMs: number }>(
  intervals: T[],
): Array<{ startMs: number; endMs: number }> {
  const sorted = intervals
    .filter(isInterval)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, interval.endMs);
    } else {
      merged.push({ startMs: interval.startMs, endMs: interval.endMs });
    }
  }
  return merged;
}

function clipInterval(
  interval: { startMs: number; endMs: number },
  startMs: number,
  endMs: number,
) {
  const clipped = {
    startMs: Math.max(startMs, interval.startMs),
    endMs: Math.min(endMs, interval.endMs),
  };
  return isInterval(clipped) ? clipped : null;
}

function intervalsIntersect(
  left: { startMs: number; endMs: number },
  right: { startMs: number; endMs: number },
) {
  return (
    Math.min(left.endMs, right.endMs) > Math.max(left.startMs, right.startMs)
  );
}

function validReferenceTurn(turn: SpeechReferenceTurn) {
  return (
    Boolean(turn.id && turn.speakerId && turn.text) &&
    Number.isFinite(turn.startMs) &&
    Number.isFinite(turn.endMs) &&
    turn.endMs > turn.startMs
  );
}

function validHypothesisTurn(turn: SpeechHypothesisTurn) {
  return (
    Boolean(turn.text) &&
    Number.isFinite(turn.startMs) &&
    Number.isFinite(turn.endMs) &&
    turn.endMs > turn.startMs
  );
}

function normalizeSpeakerLabel(label: string | undefined) {
  const normalized = String(label || "")
    .trim()
    .toUpperCase();
  return isUnknownLabel(normalized) ? "UNKNOWN" : normalized;
}

function isUnknownLabel(label: string | undefined) {
  return UNKNOWN_LABELS.has(
    String(label || "")
      .trim()
      .toUpperCase(),
  );
}

function isInterval<T extends { startMs: number; endMs: number }>(
  interval: T | null,
): interval is T {
  return Boolean(interval && interval.endMs > interval.startMs);
}

function midpoint(interval: { startMs: number; endMs: number }) {
  return interval.startMs + (interval.endMs - interval.startMs) / 2;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
}

function finiteOr(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundMs(value: number) {
  return Math.round(value * 1000) / 1000;
}
