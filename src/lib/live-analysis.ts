import type {
  LiveAnalysisEvidence,
  LiveAnalysisFinding,
  LiveAnalysisResult,
} from "./types";

export interface LiveAnalysisTurn {
  id: string;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface LiveAnalysisVisualContext {
  id: string;
  capturedAtMs: number;
  note?: string;
  caption?: string;
  observations?: string[];
}

export interface LiveAnalysisConfig {
  objective: string;
  phase: string;
  criteria: string[];
}

const MAX_CHUNK_CHARACTERS = 28_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Analyze every finalized substantive turn available at one immutable cutoff.
 * Long discussions are exhaustively chunked before a final synthesis; no turn
 * is silently dropped to fit a "recent turns" window.
 */
export async function analyzeFullTranscript(
  turns: LiveAnalysisTurn[],
  visualEvidence: LiveAnalysisVisualContext[],
  config: LiveAnalysisConfig,
): Promise<LiveAnalysisResult> {
  if (turns.length === 0) {
    throw new Error("At least one substantive transcript turn is required.");
  }

  if (process.env.LLM_STUB === "1" || !process.env.OPENAI_API_KEY) {
    return fallbackAnalysis(turns, visualEvidence, config);
  }

  try {
    const chunks = partitionTranscript(turns);
    const chunkResults: unknown[] = [];
    for (let index = 0; index < chunks.length; index++) {
      chunkResults.push(
        await requestAnalysis({
          objective: config.objective,
          phase: config.phase,
          criteria: config.criteria,
          coverage: {
            chunk: index + 1,
            chunkCount: chunks.length,
            firstTurnId: chunks[index][0].id,
            lastTurnId: chunks[index].at(-1)!.id,
            totalTranscriptTurns: turns.length,
          },
          transcript: chunks[index].map(serializeTurn),
          visualEvidence:
            index === chunks.length - 1 ? visualEvidence : undefined,
        }),
      );
    }

    const raw =
      chunkResults.length === 1
        ? chunkResults[0]
        : await requestAnalysis({
            objective: config.objective,
            phase: config.phase,
            criteria: config.criteria,
            coverage: {
              chunkCount: chunks.length,
              firstTurnId: turns[0].id,
              lastTurnId: turns.at(-1)!.id,
              totalTranscriptTurns: turns.length,
              instruction:
                "Synthesize every chunk result. Preserve source turn IDs and do not treat later chunks as more important merely because they are recent.",
            },
            chunkResults,
            visualEvidence,
          });

    return normalizeAnalysis(raw, turns, config, "model");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Whole-transcript analysis fell back locally: ${detail}`);
    return {
      ...fallbackAnalysis(turns, visualEvidence, config),
      warning: `Model analysis was unavailable; showing deterministic transcript coverage instead (${detail.slice(0, 140)}).`,
    };
  }
}

export function partitionTranscript(
  turns: LiveAnalysisTurn[],
  maxCharacters = MAX_CHUNK_CHARACTERS,
): LiveAnalysisTurn[][] {
  const chunks: LiveAnalysisTurn[][] = [];
  let current: LiveAnalysisTurn[] = [];
  let currentCharacters = 0;

  for (const turn of turns) {
    const turnCharacters = JSON.stringify(serializeTurn(turn)).length;
    if (
      current.length > 0 &&
      currentCharacters + turnCharacters > maxCharacters
    ) {
      chunks.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(turn);
    currentCharacters += turnCharacters;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function requestAnalysis(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = configuredTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content: `You are the live synthesis layer for a design critique HUD. Analyze the supplied transcript against the facilitator's current intent. Every supplied transcript turn is in scope.

Return one JSON object with:
- headline: one concise intent-specific conclusion
- summary: a compact synthesis of the discussion
- keyFindings: up to 6 {title, text, supportingTurnIds}
- criteria: one {criterion, status, text, supportingTurnIds} for every supplied criterion; status is unaddressed, discussed, or evidenced
- openQuestions, decisions, actions: arrays of {text, supportingTurnIds}
- phaseAllocation: {problemAndEvidence, ideas, evaluation, decisionsAndActions}, totaling 100
- agreementState: consensus, majority, divided, or emerging
- minorityPosition: optional string

Only cite turn IDs supplied in the payload. Keep disagreements and uncertainty visible. A visual-evidence caption is context, not proof of a participant's claim.`,
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2400,
        reasoning_effort: process.env.ANALYSIS_REASONING_EFFORT || "minimal",
      }),
    });
    if (!response.ok) {
      throw new Error(`analysis provider returned ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("analysis provider returned no content");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAnalysis(
  raw: unknown,
  turns: LiveAnalysisTurn[],
  config: LiveAnalysisConfig,
  engine: LiveAnalysisResult["engine"],
): LiveAnalysisResult {
  const fallback = fallbackAnalysis(turns, [], config);
  if (!isRecord(raw)) return fallback;
  const turnIds = new Set(turns.map((turn) => turn.id));
  const keyFindings = normalizeFindings(raw.keyFindings, turnIds);
  const criteriaValues = Array.isArray(raw.criteria) ? raw.criteria : [];
  const agreementStates: LiveAnalysisResult["agreementState"][] = [
    "consensus",
    "majority",
    "divided",
    "emerging",
  ];

  return {
    headline: boundedString(raw.headline, fallback.headline, 160),
    summary: boundedString(raw.summary, fallback.summary, 900),
    keyFindings: keyFindings.length > 0 ? keyFindings : fallback.keyFindings,
    criteria: config.criteria.map((criterion) => {
      const candidate = criteriaValues.find(
        (value) =>
          isRecord(value) &&
          typeof value.criterion === "string" &&
          value.criterion.trim().toLowerCase() === criterion.toLowerCase(),
      );
      if (!isRecord(candidate)) {
        return {
          criterion,
          status: "unaddressed" as const,
          text: "No source-linked coverage was returned for this criterion.",
          supportingTurnIds: [],
        };
      }
      const status = ["unaddressed", "discussed", "evidenced"].includes(
        String(candidate.status),
      )
        ? (candidate.status as "unaddressed" | "discussed" | "evidenced")
        : "unaddressed";
      return {
        criterion,
        status,
        text: boundedString(candidate.text, "", 360),
        supportingTurnIds: validTurnIds(candidate.supportingTurnIds, turnIds),
      };
    }),
    openQuestions: normalizeEvidence(raw.openQuestions, turnIds),
    decisions: normalizeEvidence(raw.decisions, turnIds),
    actions: normalizeEvidence(raw.actions, turnIds),
    phaseAllocation: normalizePhaseAllocation(raw.phaseAllocation),
    agreementState:
      typeof raw.agreementState === "string" &&
      agreementStates.includes(
        raw.agreementState as LiveAnalysisResult["agreementState"],
      )
        ? (raw.agreementState as LiveAnalysisResult["agreementState"])
        : "emerging",
    minorityPosition:
      typeof raw.minorityPosition === "string"
        ? boundedString(raw.minorityPosition, "", 360)
        : undefined,
    engine,
  };
}

function fallbackAnalysis(
  turns: LiveAnalysisTurn[],
  visualEvidence: LiveAnalysisVisualContext[],
  config: LiveAnalysisConfig,
): LiveAnalysisResult {
  const first = turns[0];
  const last = turns.at(-1)!;
  const questionTurns = turns
    .filter((turn) => turn.text.includes("?"))
    .slice(-4);
  const decisionTurns = turns
    .filter((turn) =>
      /\b(decide|decided|agree|agreed|will test)\b/i.test(turn.text),
    )
    .slice(-4);
  const actionTurns = turns
    .filter((turn) =>
      /\b(i will|i'll|we will|we'll|action|next step)\b/i.test(turn.text),
    )
    .slice(-4);

  return {
    headline: `${humanizePhase(config.phase)} view · ${config.objective}`.slice(
      0,
      160,
    ),
    summary: `Analyzed all ${turns.length} substantive turns from ${first.speakerLabel} through ${last.speakerLabel}${
      visualEvidence.length
        ? `, together with ${visualEvidence.length} captured visual evidence ${visualEvidence.length === 1 ? "item" : "items"}`
        : ""
    }. This deterministic view preserves coverage while model synthesis is unavailable.`,
    keyFindings: uniqueTurns([
      first,
      turns[Math.floor(turns.length / 2)],
      last,
    ]).map((turn, index) => ({
      title:
        index === 0
          ? "Opening context"
          : index === 1
            ? "Midpoint signal"
            : "Latest state",
      text: turn.text.slice(0, 320),
      supportingTurnIds: [turn.id],
    })),
    criteria: config.criteria.map((criterion) => {
      const words = criterion.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
      const matches = turns
        .filter((turn) =>
          words.some((word) => turn.text.toLowerCase().includes(word)),
        )
        .slice(-3);
      return {
        criterion,
        status:
          matches.length > 0
            ? ("discussed" as const)
            : ("unaddressed" as const),
        text:
          matches.length > 0
            ? "Related language appears in the source turns."
            : "No direct keyword coverage found in the transcript.",
        supportingTurnIds: matches.map((turn) => turn.id),
      };
    }),
    openQuestions: questionTurns.map(toEvidence),
    decisions: decisionTurns.map(toEvidence),
    actions: actionTurns.map(toEvidence),
    phaseAllocation: {
      problemAndEvidence: 30,
      ideas: 25,
      evaluation: 30,
      decisionsAndActions: 15,
    },
    agreementState: "emerging",
    engine: "deterministic-fallback",
  };
}

function serializeTurn(turn: LiveAnalysisTurn) {
  return {
    id: turn.id,
    speaker: turn.speakerLabel,
    text: turn.text,
    startMs: turn.startMs,
    endMs: turn.endMs,
  };
}

function normalizeFindings(
  value: unknown,
  allowedIds: Set<string>,
): LiveAnalysisFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      title: boundedString(item.title, "Finding", 100),
      text: boundedString(item.text, "", 420),
      supportingTurnIds: validTurnIds(item.supportingTurnIds, allowedIds),
    }))
    .filter((item) => item.text.length > 0 && item.supportingTurnIds.length > 0)
    .slice(0, 6);
}

function normalizeEvidence(
  value: unknown,
  allowedIds: Set<string>,
): LiveAnalysisEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      text: boundedString(item.text, "", 360),
      supportingTurnIds: validTurnIds(item.supportingTurnIds, allowedIds),
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 8);
}

function validTurnIds(value: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && allowedIds.has(id),
      ),
    ),
  ].slice(0, 12);
}

function normalizePhaseAllocation(value: unknown) {
  const phase = isRecord(value) ? value : {};
  const raw = [
    boundedNumber(phase.problemAndEvidence, 30),
    boundedNumber(phase.ideas, 25),
    boundedNumber(phase.evaluation, 30),
    boundedNumber(phase.decisionsAndActions, 15),
  ];
  const total = raw.reduce((sum, current) => sum + current, 0) || 100;
  const normalized = raw.map((current) => Math.round((current / total) * 100));
  normalized[3] += 100 - normalized.reduce((sum, current) => sum + current, 0);
  return {
    problemAndEvidence: normalized[0],
    ideas: normalized[1],
    evaluation: normalized[2],
    decisionsAndActions: normalized[3],
  };
}

function boundedString(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function boundedNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, number))
    : fallback;
}

function configuredTimeoutMs(): number {
  const value = Number(process.env.LIVE_ANALYSIS_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1_000
    ? Math.min(120_000, value)
    : DEFAULT_TIMEOUT_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toEvidence(turn: LiveAnalysisTurn): LiveAnalysisEvidence {
  return { text: turn.text.slice(0, 360), supportingTurnIds: [turn.id] };
}

function uniqueTurns(turns: LiveAnalysisTurn[]): LiveAnalysisTurn[] {
  return turns.filter(
    (turn, index) =>
      turns.findIndex((candidate) => candidate.id === turn.id) === index,
  );
}

function humanizePhase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
