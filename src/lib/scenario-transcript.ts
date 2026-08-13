import { createHash } from "crypto";
import type {
  DiscussionCategory,
  ScenarioDelivery,
  ScenarioOverlap,
  ScenarioSpeaker,
  ScenarioTurn,
  TranscriptQualityReport,
} from "./types";

export const TRANSCRIPT_FORMAT_VERSION = 2;
export const MIN_PLANNED_WORDS_PER_MINUTE = 105;
export const MAX_PLANNED_WORDS_PER_MINUTE = 185;

const CATEGORIES: DiscussionCategory[] = [
  "evidence",
  "questions",
  "positions",
  "decisions",
  "actions",
  "themes",
];
const CATEGORY_SET = new Set<string>(CATEGORIES);
const OVERLAP_KINDS = new Set([
  "interruption",
  "eager_agreement",
  "backchannel",
]);
const OVERLAP_RESOLUTIONS = new Set(["yield", "continue", "backchannel"]);
const PACES = new Set(["slow", "natural", "quick"]);
const VOLUMES = new Set(["soft", "normal", "raised"]);
const DISFLUENCIES = new Set(["none", "light", "cut_off"]);

export interface EditableTranscriptDocument {
  version: 2;
  timeUnit: "ms";
  topic: string;
  objective: string;
  sessionContext: {
    targetDurationMinutes: number | null;
    phase: string;
    criteria: string[];
    difficulty: string;
    crossTalkLevel: string;
    participationProfile: string;
  };
  speakers: Array<{
    index: number;
    name: string;
    role: string;
    viewpoint: string;
    discourseStyle: string;
  }>;
  turns: EditableTranscriptTurn[];
}

export interface EditableTranscriptTurn {
  id: string;
  order: number;
  speakerIndex: number;
  speakerName: string;
  text: string;
  calibration: boolean;
  timing: {
    gapBeforeMs: number;
    overlap: null | {
      withTurnId: string;
      startBeforeEndMs: number;
      kind: "interruption" | "eager_agreement" | "backchannel";
      resolution: "yield" | "continue" | "backchannel";
    };
    realizedStartMs: number | null;
    realizedEndMs: number | null;
  };
  delivery: ScenarioDelivery;
  dialogue: {
    act: DiscussionCategory;
    substantive: boolean;
    respondsToTurnId: string | null;
    intent: string;
  };
}

export interface TranscriptRevisionOptions {
  instruction: string;
  pass: number;
  totalPasses: number;
  preset: "naturalize" | "timing" | "custom";
}

export function getOverlapLeadMs(overlap?: ScenarioOverlap): number {
  if (!overlap) return 0;
  return clamp(
    Number(overlap.startBeforeEndMs ?? overlap.startOffsetMs) || 0,
    overlap.kind === "backchannel" ? 120 : 250,
    1500,
  );
}

export function normalizeScenarioTurns(
  source: unknown,
  speakerCount: number,
): ScenarioTurn[] {
  const input = Array.isArray(source) ? source : [];
  const usedIds = new Set<string>();
  const originalToNormalized = new Map<string, string>();
  const ids = input.map((value: any, index) => {
    const requested = cleanId(value?.id) || `t${index}`;
    const id = usedIds.has(requested) ? `t${index}` : requested;
    usedIds.add(id);
    if (value?.id && !originalToNormalized.has(String(value.id))) {
      originalToNormalized.set(String(value.id), id);
    }
    return id;
  });

  return input
    .map((value: any, index): ScenarioTurn | null => {
      const text = cleanText(value?.text);
      if (!text) return null;
      const speakerIndex = clamp(
        Number(value?.speakerIndex) || 0,
        0,
        Math.max(0, speakerCount - 1),
      );
      const isCalibration = Boolean(value?.isCalibration ?? value?.calibration);
      const rawCategory = value?.expectedCategory ?? value?.expected?.category;
      const expectedCategory = CATEGORY_SET.has(rawCategory)
        ? (rawCategory as DiscussionCategory)
        : "positions";
      const previousId = index > 0 ? ids[index - 1] : undefined;
      const overlap = isCalibration
        ? undefined
        : normalizeOverlap(
            value?.overlap ?? value?.timing?.overlap,
            previousId,
            originalToNormalized,
          );
      const rawReaction =
        value?.expected?.reactsToTurnId ??
        value?.dialogue?.respondsToTurnId ??
        value?.reactsToTurnId;
      const reactsToTurnId = normalizeEarlierReference(
        rawReaction,
        index,
        ids,
        originalToNormalized,
      );

      return {
        id: ids[index],
        index,
        speakerIndex,
        text,
        expectedCategory,
        expected: {
          substantive: isCalibration
            ? false
            : (value?.expected?.substantive ??
              value?.dialogue?.substantive ??
              wordCount(text) >= 4),
          category: expectedCategory,
          potentialSignal:
            cleanText(value?.expected?.potentialSignal) ||
            cleanText(value?.dialogue?.intent) ||
            "none",
          reactsToTurnId: isCalibration ? undefined : reactsToTurnId,
        },
        isCalibration,
        pauseBeforeMs: overlap
          ? 0
          : clamp(
              Number(
                value?.pauseBeforeMs ??
                  value?.timing?.gapBeforeMs ??
                  (isCalibration ? 1000 : 320),
              ) || 0,
              0,
              5000,
            ),
        overlap,
        delivery: normalizeDelivery(value?.delivery, overlap, expectedCategory),
        startMs: finiteOrUndefined(
          value?.startMs ?? value?.timing?.realizedStartMs,
        ),
        endMs: finiteOrUndefined(value?.endMs ?? value?.timing?.realizedEndMs),
        hash: typeof value?.hash === "string" ? value.hash : undefined,
      };
    })
    .filter((turn): turn is ScenarioTurn => turn !== null)
    .map((turn, index) => ({ ...turn, index }));
}

export function toEditableTranscript(
  topic: string,
  objective: string,
  speakers: ScenarioSpeaker[],
  turns: ScenarioTurn[],
  context: {
    targetDurationMinutes?: number | null;
    phase?: string;
    criteria?: string[];
    difficulty?: string;
    crossTalkLevel?: string;
    participationProfile?: string;
  } = {},
): EditableTranscriptDocument {
  const normalized = normalizeScenarioTurns(turns, speakers.length);
  return {
    version: TRANSCRIPT_FORMAT_VERSION,
    timeUnit: "ms",
    topic,
    objective,
    sessionContext: {
      targetDurationMinutes:
        Number.isFinite(Number(context.targetDurationMinutes)) &&
        Number(context.targetDurationMinutes) > 0
          ? Number(context.targetDurationMinutes)
          : null,
      phase: cleanText(context.phase) || "evaluate",
      criteria: (context.criteria || [])
        .map(cleanText)
        .filter(Boolean)
        .slice(0, 20),
      difficulty: cleanText(context.difficulty) || "realistic",
      crossTalkLevel: cleanText(context.crossTalkLevel) || "occasional",
      participationProfile: cleanText(context.participationProfile) || "even",
    },
    speakers: speakers.map((speaker) => ({
      index: speaker.index,
      name: speaker.name,
      role: speaker.role || "participant",
      viewpoint: speaker.viewpoint || "",
      discourseStyle: speaker.discourseStyle || "conversational",
    })),
    turns: normalized.map((turn) => {
      const speaker = speakers.find(
        (candidate) => candidate.index === turn.speakerIndex,
      );
      const overlap = turn.overlap
        ? {
            withTurnId: turn.overlap.withTurnId,
            startBeforeEndMs: getOverlapLeadMs(turn.overlap),
            kind: turn.overlap.kind,
            resolution: normalizeResolution(
              turn.overlap.resolution,
              turn.overlap.kind,
            ),
          }
        : null;
      return {
        id: turn.id || `t${turn.index}`,
        order: turn.index,
        speakerIndex: turn.speakerIndex,
        speakerName: speaker?.name || `Speaker ${turn.speakerIndex + 1}`,
        text: turn.text,
        calibration: Boolean(turn.isCalibration),
        timing: {
          gapBeforeMs: overlap ? 0 : Math.max(0, turn.pauseBeforeMs || 0),
          overlap,
          realizedStartMs: finiteOrNull(turn.startMs),
          realizedEndMs: finiteOrNull(turn.endMs),
        },
        delivery: normalizeDelivery(
          turn.delivery,
          turn.overlap,
          turn.expectedCategory,
        ),
        dialogue: {
          act: turn.expectedCategory || "positions",
          substantive: turn.expected?.substantive !== false,
          respondsToTurnId: turn.expected?.reactsToTurnId || null,
          intent:
            turn.expected?.potentialSignal &&
            turn.expected.potentialSignal !== "none"
              ? turn.expected.potentialSignal
              : inferIntent(turn),
        },
      };
    }),
  };
}

export function turnsFromEditableTranscript(
  raw: unknown,
  speakers: ScenarioSpeaker[],
): ScenarioTurn[] {
  const rawTurns = (raw as any)?.turns;
  if (!Array.isArray(rawTurns)) {
    throw new Error("The model response did not contain transcript turns.");
  }
  const rawIds = rawTurns.map((turn: any) => cleanId(turn?.id));
  if (
    rawIds.some((id: string) => !id) ||
    new Set(rawIds).size !== rawIds.length
  ) {
    throw new Error(
      "The model response contains missing or duplicate turn IDs.",
    );
  }
  for (let index = 0; index < rawTurns.length; index++) {
    const turn = rawTurns[index];
    if (Number(turn?.order) !== index) {
      throw new Error(
        "The model response must use contiguous transcript order.",
      );
    }
    if (
      !speakers.some((speaker) => speaker.index === Number(turn?.speakerIndex))
    ) {
      throw new Error(
        `Turn ${turn?.id || index} references an unknown speaker.`,
      );
    }
  }
  const turns = normalizeScenarioTurns((raw as any)?.turns, speakers.length);
  return turns.map((turn) => ({
    ...turn,
    startMs: undefined,
    endMs: undefined,
    overlapWith: undefined,
    hash: undefined,
  }));
}

export function analyzeTranscriptQuality(
  turns: ScenarioTurn[],
  speakers: ScenarioSpeaker[],
  context: {
    targetDurationMinutes?: number | null;
    crossTalkLevel?: string;
  } = {},
): TranscriptQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized = normalizeScenarioTurns(turns, speakers.length);
  const mainTurns = normalized.filter((turn) => !turn.isCalibration);
  const duplicateMap = new Map<string, ScenarioTurn[]>();
  for (const turn of mainTurns) {
    if (turn.expected?.substantive === false || wordCount(turn.text) < 4)
      continue;
    const key = normalizeSpokenText(turn.text);
    const group = duplicateMap.get(key) || [];
    group.push(turn);
    duplicateMap.set(key, group);
  }
  const duplicateGroups = [...duplicateMap.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedText, group]) => ({
      normalizedText,
      turnIds: group.map((turn) => turn.id || `t${turn.index}`),
      speakerNames: group.map(
        (turn) =>
          speakers.find((speaker) => speaker.index === turn.speakerIndex)
            ?.name || `Speaker ${turn.speakerIndex + 1}`,
      ),
    }));
  if (duplicateGroups.length) {
    errors.push(
      `${duplicateGroups.length} exact duplicate substantive line${duplicateGroups.length === 1 ? "" : "s"} found.`,
    );
  }

  const idToIndex = new Map(
    normalized.map((turn, index) => [turn.id || `t${index}`, index]),
  );
  const overlapStarts = new Set<number>();
  let overlapCount = 0;
  for (const turn of normalized) {
    if (!turn.overlap) continue;
    overlapCount++;
    overlapStarts.add(turn.index);
    const anchorIndex = idToIndex.get(turn.overlap.withTurnId);
    if (anchorIndex === undefined || anchorIndex >= turn.index) {
      errors.push(`Turn ${turn.id} overlaps an unknown or later utterance.`);
      continue;
    }
    if (turn.index - anchorIndex !== 1) {
      errors.push(
        `Turn ${turn.id} must overlap the immediately preceding utterance.`,
      );
    }
    const anchor = normalized[anchorIndex];
    if (anchor.speakerIndex === turn.speakerIndex) {
      errors.push(`Turn ${turn.id} overlaps the same speaker.`);
    }
    if (turn.isCalibration || anchor.isCalibration) {
      errors.push(`Calibration speech cannot overlap at turn ${turn.id}.`);
    }
    if (getOverlapLeadMs(turn.overlap) > 1500) {
      errors.push(`Turn ${turn.id} exceeds the 1500 ms overlap limit.`);
    }
    if (overlapStarts.has(turn.index - 1)) {
      errors.push(
        `Consecutive overlap starts at turn ${turn.id} could create three-way speech.`,
      );
    }
  }

  let roundRobinMatches = 0;
  for (let index = 1; index < mainTurns.length; index++) {
    if (
      mainTurns[index].speakerIndex ===
      (mainTurns[index - 1].speakerIndex + 1) % Math.max(1, speakers.length)
    ) {
      roundRobinMatches++;
    }
  }
  const roundRobinRatio =
    mainTurns.length > 1 ? roundRobinMatches / (mainTurns.length - 1) : 0;
  if (mainTurns.length >= 12 && roundRobinRatio >= 0.95) {
    errors.push(
      "Speaker order is effectively round-robin rather than conversational.",
    );
  } else if (mainTurns.length >= 12 && roundRobinRatio >= 0.75) {
    warnings.push("Speaker order is unusually close to round-robin.");
  }

  const reactionCandidates = mainTurns.slice(1);
  const reactionCount = reactionCandidates.filter(
    (turn) => turn.expected?.reactsToTurnId,
  ).length;
  const reactionCoverage = reactionCandidates.length
    ? reactionCount / reactionCandidates.length
    : 1;
  if (mainTurns.length >= 8 && reactionCoverage < 0.75) {
    warnings.push(
      "Too few utterances identify the earlier point they respond to.",
    );
  }

  const realizedTimingCount = normalized.filter(
    (turn) => Number.isFinite(turn.startMs) && Number.isFinite(turn.endMs),
  ).length;
  const realizedTimingCoverage = normalized.length
    ? realizedTimingCount / normalized.length
    : 0;
  const crossTalkLevel = cleanText(context.crossTalkLevel).toLowerCase();
  if (crossTalkLevel === "none" && overlapCount > 0) {
    errors.push(
      `Transcript contains ${overlapCount} overlap start${overlapCount === 1 ? "" : "s"}, but cross-talk is configured as none.`,
    );
  } else if (
    crossTalkLevel !== "none" &&
    overlapCount === 0 &&
    mainTurns.length >= 30
  ) {
    warnings.push(
      "Long discussion contains no authored overlap or backchannel.",
    );
  }

  const targetDurationMinutes = Number(context.targetDurationMinutes);
  const mainWordCount = mainTurns.reduce(
    (sum, turn) => sum + wordCount(turn.text),
    0,
  );
  const plannedWordsPerMinute =
    Number.isFinite(targetDurationMinutes) && targetDurationMinutes > 0
      ? roundTo(mainWordCount / targetDurationMinutes, 1)
      : null;
  if (
    mainTurns.length >= 8 &&
    plannedWordsPerMinute !== null &&
    (plannedWordsPerMinute < MIN_PLANNED_WORDS_PER_MINUTE ||
      plannedWordsPerMinute > MAX_PLANNED_WORDS_PER_MINUTE)
  ) {
    warnings.push(
      `Planned dialogue density is ${plannedWordsPerMinute} words per requested minute; target roughly 105–185 after allowing for pauses.`,
    );
  }

  const speakerTurnCounts = speakers.map((speaker) => {
    const speakerTurns = mainTurns.filter(
      (turn) => turn.speakerIndex === speaker.index,
    );
    return {
      speakerIndex: speaker.index,
      speakerName: speaker.name,
      turns: speakerTurns.length,
      words: speakerTurns.reduce((sum, turn) => sum + wordCount(turn.text), 0),
    };
  });
  const activeCounts = speakerTurnCounts.map((entry) => entry.turns);
  if (
    mainTurns.length >= speakers.length * 6 &&
    activeCounts.length > 1 &&
    Math.max(...activeCounts) - Math.min(...activeCounts) <= 1
  ) {
    warnings.push("Participation is implausibly even by turn count.");
  }

  const score = clamp(
    100 -
      duplicateGroups.reduce(
        (sum, group) => sum + group.turnIds.length * 4,
        0,
      ) -
      errors.length * 12 -
      warnings.length * 4,
    0,
    100,
  );

  return {
    score,
    errors: unique(errors),
    warnings: unique(warnings),
    duplicateGroups,
    roundRobinRatio: roundTo(roundRobinRatio, 3),
    reactionCoverage: roundTo(reactionCoverage, 3),
    overlapCount,
    realizedTimingCoverage: roundTo(realizedTimingCoverage, 3),
    plannedWordsPerMinute,
    speakerTurnCounts,
  };
}

export function validateTranscriptForRevision(
  turns: ScenarioTurn[],
  speakers: ScenarioSpeaker[],
  context: {
    targetDurationMinutes?: number | null;
    crossTalkLevel?: string;
    requireTargetDurationFit?: boolean;
  } = {},
): TranscriptQualityReport {
  if (turns.length < 3)
    throw new Error("A transcript needs at least three utterances.");
  if (turns.length > 180)
    throw new Error("A transcript cannot exceed 180 utterances.");
  const ids = turns.map((turn, index) => turn.id || `t${index}`);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Every transcript utterance needs a unique stable ID.");
  }
  for (const turn of turns) {
    if (!speakers.some((speaker) => speaker.index === turn.speakerIndex)) {
      throw new Error(`Turn ${turn.id} references an unknown speaker.`);
    }
  }
  const report = analyzeTranscriptQuality(turns, speakers, context);
  const durationError = transcriptDurationFitError(report);
  const durationErrors =
    context.requireTargetDurationFit && durationError ? [durationError] : [];
  const errors = [...report.errors, ...durationErrors];
  if (errors.length) {
    throw new Error(
      `Transcript revision failed quality checks: ${errors.join(" ")}`,
    );
  }
  return report;
}

export function transcriptDurationFitError(
  report: TranscriptQualityReport,
): string | null {
  if (
    report.plannedWordsPerMinute === null ||
    (report.plannedWordsPerMinute >= MIN_PLANNED_WORDS_PER_MINUTE &&
      report.plannedWordsPerMinute <= MAX_PLANNED_WORDS_PER_MINUTE)
  ) {
    return null;
  }
  return `Transcript density is ${report.plannedWordsPerMinute} spoken words per requested minute; it must be ${MIN_PLANNED_WORDS_PER_MINUTE}–${MAX_PLANNED_WORDS_PER_MINUTE} so the rendered audio can match the target length.`;
}

export function transcriptFingerprint(
  speakers: ScenarioSpeaker[],
  turns: ScenarioTurn[],
): string {
  const normalized = normalizeScenarioTurns(turns, speakers.length).map(
    (turn) => ({
      id: turn.id,
      speakerIndex: turn.speakerIndex,
      text: turn.text,
      pauseBeforeMs: turn.pauseBeforeMs,
      overlap: turn.overlap
        ? {
            withTurnId: turn.overlap.withTurnId,
            startBeforeEndMs: getOverlapLeadMs(turn.overlap),
            kind: turn.overlap.kind,
            resolution: normalizeResolution(
              turn.overlap.resolution,
              turn.overlap.kind,
            ),
          }
        : null,
      delivery: turn.delivery,
    }),
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: TRANSCRIPT_FORMAT_VERSION,
        voices: speakers.map((speaker) => ({
          index: speaker.index,
          voiceId: speaker.voiceId,
          speakingRate: speaker.speakingRate,
        })),
        turns: normalized,
      }),
    )
    .digest("hex");
}

export function buildTranscriptRevisionPrompts(
  document: EditableTranscriptDocument,
  options: TranscriptRevisionOptions,
): { system: string; user: string } {
  const focus =
    options.preset === "timing"
      ? "Keep the substance, but make turn allocation, gaps, backchannels, interruptions, and overlap resolution sound naturally motivated."
      : options.preset === "custom"
        ? "Follow the user's instruction while preserving a coherent multi-party critique and valid timing semantics."
        : "Rewrite mechanical dialogue into a causally connected, specific, spontaneous multi-party critique while preserving the topic and useful decisions.";
  const passFocus =
    options.totalPasses <= 1
      ? "Perform a complete semantic, conversational, timing, and consistency pass."
      : options.pass === 1
        ? "Prioritize causal dialogue, speaker continuity, specificity, and removal of repetition."
        : options.pass === options.totalPasses
          ? "Perform the final timing, overlap, reference, duplication, and spoken-language consistency pass."
          : "Prioritize turn allocation, response timing, repair, backchannels, and overlap resolution.";

  const system = `You revise version-2 timed transcripts for a realistic audio simulation. Return one JSON object matching the supplied schema.

${focus}
${passFocus}

NON-NEGOTIABLE INVARIANTS
- Keep every speakerIndex tied to the supplied cast. speakerName is informative and must match that index.
- Keep stable turn IDs for retained utterances. New IDs, if truly needed, must be unique. order must be contiguous from 0.
- Do not include exact duplicate substantive lines or repeated generic sentence frames.
- Each non-calibration utterance after the first should respond to a specific earlier utterance via dialogue.respondsToTurnId.
- People do not speak in round-robin order and do not receive mechanically equal turn counts. They may speak twice across a response sequence, but never overlap themselves.
- Use natural spoken language: contractions, occasional fragments and self-repair, sparse fillers, and varied turn length. Do not add fake studies, invented exact metrics, or unsupported authorities.
- Most gapBeforeMs values should vary from 120–700 ms. Use roughly 750–1600 ms for a resistant answer, uncertainty, or a consequential response. Calibration may use 800–1400 ms.
- overlap is sparse, locally motivated, and normally anchors the immediately preceding utterance. startBeforeEndMs is how long before that anchor ends the new voice begins (120–1500 ms). Overlap turns have gapBeforeMs 0.
- backchannel: 1–4 words, non-substantive, soft, resolution backchannel. eager_agreement adds a specific point and usually continues. interruption must indicate whether the earlier speaker yields or continues; use delivery.disfluency cut_off when the interrupting or interrupted wording audibly breaks off.
- Never overlap calibration, the first two main utterances, consecutive new starts, or three speakers.
- Remove realizedStartMs and realizedEndMs by returning null. Those values are measured after TTS and must not be invented.
- Preserve the supplied objective and evaluation criteria. Match the target duration with substantive talk (roughly 125–165 spoken words per minute), never by padding, repeated conclusions, or generic filler.
- Preserve sessionContext.difficulty and sessionContext.participationProfile. Follow sessionContext.crossTalkLevel exactly: none means zero authored overlap; occasional means sparse motivated overlap; frequent permits more overlap but still forbids consecutive or three-speaker starts.
- Preserve an evolving argument: specific evidence, disagreement, repair, a changed idea, an emerging decision, owned action, and at least one unresolved material concern.

TIMING MEANING
- gapBeforeMs is silence after the preceding utterance ends.
- overlap.withTurnId identifies the active earlier utterance.
- overlap.startBeforeEndMs is relative to the measured end of that earlier utterance.
- realizedStartMs/realizedEndMs are post-synthesis measurements and must be null in an edit.

Return only the revised transcript object.`;
  const user = `Revision instruction: ${cleanText(options.instruction) || "Improve realism without changing the scenario's purpose."}
Pass ${options.pass} of ${options.totalPasses}.

CURRENT TRANSCRIPT
${JSON.stringify(document)}`;
  return { system, user };
}

export const EDITABLE_TRANSCRIPT_JSON_SCHEMA = {
  name: "editable_timed_transcript",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "timeUnit", "turns", "changeSummary"],
    properties: {
      version: { type: "integer", enum: [TRANSCRIPT_FORMAT_VERSION] },
      timeUnit: { type: "string", enum: ["ms"] },
      changeSummary: { type: "string" },
      turns: {
        type: "array",
        minItems: 3,
        maxItems: 180,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "order",
            "speakerIndex",
            "speakerName",
            "text",
            "calibration",
            "timing",
            "delivery",
            "dialogue",
          ],
          properties: {
            id: { type: "string" },
            order: { type: "integer", minimum: 0 },
            speakerIndex: { type: "integer", minimum: 0, maximum: 5 },
            speakerName: { type: "string" },
            text: { type: "string", minLength: 1 },
            calibration: { type: "boolean" },
            timing: {
              type: "object",
              additionalProperties: false,
              required: [
                "gapBeforeMs",
                "overlap",
                "realizedStartMs",
                "realizedEndMs",
              ],
              properties: {
                gapBeforeMs: { type: "integer", minimum: 0, maximum: 5000 },
                overlap: {
                  anyOf: [
                    { type: "null" },
                    {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "withTurnId",
                        "startBeforeEndMs",
                        "kind",
                        "resolution",
                      ],
                      properties: {
                        withTurnId: { type: "string" },
                        startBeforeEndMs: {
                          type: "integer",
                          minimum: 120,
                          maximum: 1500,
                        },
                        kind: {
                          type: "string",
                          enum: [
                            "interruption",
                            "eager_agreement",
                            "backchannel",
                          ],
                        },
                        resolution: {
                          type: "string",
                          enum: ["yield", "continue", "backchannel"],
                        },
                      },
                    },
                  ],
                },
                realizedStartMs: { type: ["integer", "null"] },
                realizedEndMs: { type: ["integer", "null"] },
              },
            },
            delivery: {
              type: "object",
              additionalProperties: false,
              required: ["pace", "tone", "volume", "disfluency"],
              properties: {
                pace: { type: "string", enum: ["slow", "natural", "quick"] },
                tone: { type: "string" },
                volume: { type: "string", enum: ["soft", "normal", "raised"] },
                disfluency: {
                  type: "string",
                  enum: ["none", "light", "cut_off"],
                },
              },
            },
            dialogue: {
              type: "object",
              additionalProperties: false,
              required: ["act", "substantive", "respondsToTurnId", "intent"],
              properties: {
                act: { type: "string", enum: CATEGORIES },
                substantive: { type: "boolean" },
                respondsToTurnId: { type: ["string", "null"] },
                intent: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

function normalizeOverlap(
  value: any,
  previousId: string | undefined,
  originalToNormalized: Map<string, string>,
): ScenarioOverlap | undefined {
  if (!value || !previousId) return undefined;
  const kind = OVERLAP_KINDS.has(value.kind) ? value.kind : "interruption";
  const requestedAnchor = String(value.withTurnId || previousId);
  const withTurnId =
    originalToNormalized.get(requestedAnchor) || requestedAnchor;
  return {
    withTurnId,
    startBeforeEndMs: clamp(
      Number(value.startBeforeEndMs ?? value.startOffsetMs) ||
        (kind === "backchannel" ? 320 : 650),
      kind === "backchannel" ? 120 : 250,
      1500,
    ),
    kind,
    resolution: normalizeResolution(value.resolution, kind),
  };
}

function normalizeResolution(
  value: unknown,
  kind: ScenarioOverlap["kind"],
): "yield" | "continue" | "backchannel" {
  if (OVERLAP_RESOLUTIONS.has(String(value))) {
    return value as "yield" | "continue" | "backchannel";
  }
  return kind === "backchannel"
    ? "backchannel"
    : kind === "interruption"
      ? "yield"
      : "continue";
}

function normalizeDelivery(
  value: any,
  overlap: ScenarioOverlap | undefined,
  category: DiscussionCategory | undefined,
): ScenarioDelivery {
  return {
    pace: PACES.has(value?.pace)
      ? value.pace
      : overlap?.kind === "backchannel" || overlap?.kind === "interruption"
        ? "quick"
        : "natural",
    tone:
      cleanText(value?.tone) ||
      (overlap?.kind === "backchannel"
        ? "quiet attentive acknowledgement"
        : category === "questions"
          ? "genuinely curious"
          : category === "decisions"
            ? "tentative and collaborative"
            : "engaged and conversational"),
    volume: VOLUMES.has(value?.volume)
      ? value.volume
      : overlap?.kind === "backchannel"
        ? "soft"
        : "normal",
    disfluency: DISFLUENCIES.has(value?.disfluency)
      ? value.disfluency
      : overlap?.kind === "interruption" && overlap.resolution === "yield"
        ? "light"
        : "none",
  };
}

function normalizeEarlierReference(
  value: unknown,
  currentIndex: number,
  ids: string[],
  originalToNormalized: Map<string, string>,
): string | undefined {
  if (
    currentIndex <= 0 ||
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }
  const requested = String(value);
  const normalized = originalToNormalized.get(requested) || requested;
  const exactIndex = ids.indexOf(normalized);
  if (exactIndex >= 0 && exactIndex < currentIndex) return ids[exactIndex];
  const numeric = requested.match(/(\d+)/)?.[1];
  if (numeric) {
    return ids[clamp(Number(numeric), 0, currentIndex - 1)];
  }
  return ids[currentIndex - 1];
}

function inferIntent(turn: ScenarioTurn): string {
  if (turn.isCalibration) return "calibrate voice and introduce perspective";
  if (turn.overlap?.kind === "backchannel")
    return "acknowledge without taking the floor";
  switch (turn.expectedCategory) {
    case "questions":
      return "ask a question that can change the discussion";
    case "evidence":
      return "ground the discussion in an observation";
    case "decisions":
      return "test an emerging decision with the group";
    case "actions":
      return "take ownership of a concrete next step";
    case "themes":
      return "name a pattern or tension";
    default:
      return "advance or qualify a position";
  }
}

function normalizeSpokenText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanId(value: unknown): string {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function finiteOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function finiteOrNull(value: unknown): number | null {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
