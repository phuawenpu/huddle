// ============================================
// Critique Analysis Engine
// ============================================
// Handles batched LLM turn analysis, window analysis,
// discussion map generation, and facilitation prompts.

import type {
  TurnAnalysis,
  DiscussionCategory,
  WindowAnalysis,
  PromptData,
} from "./types";
import { normalizeTurnAnalysis } from "./critique-intelligence";
import { openAiFetch } from "./openai-client";
import { UNTRUSTED_INPUT_POLICY } from "./prompt-security";

export interface AnalysisConfig {
  sessionObjective: string;
  sessionPhase: string;
  sessionCriteria: string[];
  runMode: string;
}

export interface TurnContext {
  id: string;
  speakerLabel: string;
  text: string;
  category?: DiscussionCategory;
  isSubstantive: boolean;
}

interface LLMTurnAnalysisResponse {
  category: DiscussionCategory;
  confidence: number;
  evidence?: string;
  rationale?: string;
  intent?: string;
  stance?: string;
  theme?: string;
}

interface LLMWindowResponse {
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
  agreementState: string;
  minorityPosition?: string;
}

const DEFAULT_ANALYSIS_TIMEOUT_MS = 12_000;

function configuredAnalysisTimeoutMs(): number {
  const configured = Number(process.env.ANALYSIS_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured < 1_000) {
    return DEFAULT_ANALYSIS_TIMEOUT_MS;
  }
  return Math.min(configured, 60_000);
}

async function fetchAnalysis(
  input: string,
  init: RequestInit,
  operation: "turn-analysis" | "window-analysis",
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    configuredAnalysisTimeoutMs(),
  );
  try {
    return await openAiFetch(
      input,
      { ...init, signal: controller.signal },
      { operation, timeoutMs: configuredAnalysisTimeoutMs() },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyze a batch of turns using the OpenAI LLM.
 */
export async function analyzeTurnBatch(
  turns: TurnContext[],
  config: AnalysisConfig,
): Promise<Map<string, TurnAnalysis>> {
  const isStub = process.env.LLM_STUB === "1";

  if (isStub) {
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(
        turn.id,
        normalizeTurnAnalysis(
          stubAnalyzeTurn(
            turn.text,
            config.sessionObjective,
            [],
            turn.text.length,
          ),
          turn.text,
          config.sessionCriteria,
        ),
      );
    }
    return results;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Use stubs as fallback
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(
        turn.id,
        normalizeTurnAnalysis(
          stubAnalyzeTurn(
            turn.text,
            config.sessionObjective,
            [],
            turn.text.length,
          ),
          turn.text,
          config.sessionCriteria,
        ),
      );
    }
    return results;
  }

  try {
    const turnContexts = turns.map((t) => ({
      id: t.id,
      speaker: t.speakerLabel,
      text: t.text,
    }));

    const prompt = `${UNTRUSTED_INPUT_POLICY}

Analyze the Design Thinking critique turns supplied in the user message.

For each turn, determine:
- category: one of "evidence", "questions", "positions", "decisions", "actions", "themes"
- confidence: 0.0-1.0
- evidence: specific evidence cited (if any)
- rationale: reasoning behind the statement
- intent: what the speaker is trying to achieve
- stance: "supports", "opposes", "qualifies", "requests_evidence", "alternative", "neutral", "unclear"
- theme: one-line theme summary
- signals: at most 3 critique-relevant signals, each with:
  - kind: "observation", "evidence", "question", "concern", "position", "alternative", "constraint", "decision", "action", or "reference"
  - summary: a concise description of the critique move
  - sourceQuote: an exact verbatim substring from this turn
  - target: the design element, experience, assumption, or issue being discussed
  - criterion: one exact criterion from the session list, or omit it
  - stance: "supports", "challenges", "qualifies", or "neutral"
  - evidenceBasis: "direct_observation", "reported_evidence", "inference", or "none"
  - confidence: 0.0-1.0

Return JSON: { "analyses": [{ "id": "<turn_id>", ... }] }`;

    const res = await fetchAnalysis(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
          messages: [
            { role: "system", content: prompt },
            {
              role: "user",
              content: JSON.stringify({
                session: {
                  objective: config.sessionObjective,
                  phase: config.sessionPhase,
                  criteria: config.sessionCriteria,
                },
                turns: turnContexts,
              }),
            },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
          reasoning_effort: process.env.ANALYSIS_REASONING_EFFORT || "minimal",
        }),
      },
      "turn-analysis",
    );

    if (!res.ok) throw new Error(`Model service returned ${res.status}`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from analysis model");

    const parsed = JSON.parse(content);
    const results = new Map<string, TurnAnalysis>();

    const analyses = parsed.analyses || [];
    for (const a of analyses) {
      if (a.id) {
        const sourceTurn = turns.find((turn) => turn.id === a.id);
        if (!sourceTurn) continue;
        results.set(
          a.id,
          normalizeTurnAnalysis(a, sourceTurn.text, config.sessionCriteria),
        );
      }
    }

    return results;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("aborted"))
    ) {
      console.warn(
        "Turn analysis deadline exceeded; using bounded local fallback.",
      );
    } else {
      console.error(
        "Turn analysis failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    // Fall back to stubs
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(
        turn.id,
        normalizeTurnAnalysis(
          stubAnalyzeTurn(
            turn.text,
            config.sessionObjective,
            [],
            turn.text.length,
          ),
          turn.text,
          config.sessionCriteria,
        ),
      );
    }
    return results;
  }
}

/**
 * Perform window analysis on recent turns.
 * Called every 10s or after 3 new substantive turns.
 */
export async function analyzeWindow(
  recentTurns: TurnContext[],
  _existingItems: Array<{ id: string; category: string; text: string }>,
  config: AnalysisConfig,
): Promise<WindowAnalysis> {
  const isStub = process.env.LLM_STUB === "1";

  if (isStub || !process.env.OPENAI_API_KEY) {
    return stubWindowAnalysis(recentTurns, config);
  }

  try {
    const res = await fetchAnalysis(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
          messages: [
            {
              role: "system",
              content: `${UNTRUSTED_INPUT_POLICY}

Analyze this window of a Design Thinking critique discussion.

Return JSON with:
- theme: overarching theme of this window
- discussionState: current state description
- phaseAllocation: { problemAndEvidence, ideas, evaluation, decisionsAndActions } - percentages 0-100
- openQuestions: array of open questions
- positions: array of { label, gist } for distinct positions
- decisions: array of decisions made
- actions: array of action items
- agreementState: "consensus" | "majority" | "divided" | "emerging"
- minorityPosition: a minority view that should be preserved, or null
- supportingTurnIds: up to 3 supplied turn IDs that most directly support the current state/open question. Never invent an ID.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                session: {
                  objective: config.sessionObjective,
                  phase: config.sessionPhase,
                  criteria: config.sessionCriteria,
                },
                recentTurns: recentTurns.map((turn) => ({
                  id: turn.id,
                  speaker: turn.speakerLabel,
                  text: turn.text,
                  category: turn.category,
                })),
              }),
            },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1500,
          reasoning_effort: process.env.ANALYSIS_REASONING_EFFORT || "minimal",
        }),
      },
      "window-analysis",
    );

    if (!res.ok) throw new Error(`Window analysis failed: ${res.status}`);

    const data = await res.json();
    return normalizeWindowAnalysis(
      JSON.parse(data.choices?.[0]?.message?.content || "{}"),
      recentTurns,
      config,
    );
  } catch {
    return stubWindowAnalysis(recentTurns, config);
  }
}

function normalizeWindowAnalysis(
  raw: unknown,
  turns: TurnContext[],
  config: AnalysisConfig,
): WindowAnalysis {
  const fallback = stubWindowAnalysis(turns, config);
  if (!isRecord(raw)) return fallback;
  const phase = isRecord(raw.phaseAllocation) ? raw.phaseAllocation : {};
  const agreementStates: WindowAnalysis["agreementState"][] = [
    "consensus",
    "majority",
    "divided",
    "emerging",
  ];

  return {
    theme: boundedString(raw.theme, fallback.theme),
    discussionState: boundedString(
      raw.discussionState,
      fallback.discussionState,
    ),
    phaseAllocation: {
      problemAndEvidence: boundedPercentage(
        phase.problemAndEvidence,
        fallback.phaseAllocation.problemAndEvidence,
      ),
      ideas: boundedPercentage(phase.ideas, fallback.phaseAllocation.ideas),
      evaluation: boundedPercentage(
        phase.evaluation,
        fallback.phaseAllocation.evaluation,
      ),
      decisionsAndActions: boundedPercentage(
        phase.decisionsAndActions,
        fallback.phaseAllocation.decisionsAndActions,
      ),
    },
    openQuestions: boundedStringArray(raw.openQuestions),
    positions: Array.isArray(raw.positions)
      ? raw.positions
          .filter(isRecord)
          .map((position) => ({
            label: boundedString(position.label, "Unattributed"),
            gist: boundedString(position.gist, ""),
          }))
          .filter((position) => position.gist)
          .slice(0, 6)
      : [],
    // These summaries can inform a private window model, but the queue never
    // persists them as decisions/actions. Durable map items require an exact
    // turn-level source signal.
    decisions: boundedStringArray(raw.decisions),
    actions: boundedStringArray(raw.actions),
    agreementState:
      typeof raw.agreementState === "string" &&
      agreementStates.includes(
        raw.agreementState as WindowAnalysis["agreementState"],
      )
        ? (raw.agreementState as WindowAnalysis["agreementState"])
        : fallback.agreementState,
    minorityPosition:
      typeof raw.minorityPosition === "string"
        ? boundedString(raw.minorityPosition, "")
        : undefined,
    supportingTurnIds: normalizeSupportingTurnIds(
      raw.supportingTurnIds,
      turns,
      fallback.supportingTurnIds,
    ),
  };
}

function stubWindowAnalysis(
  turns: TurnContext[],
  config: AnalysisConfig,
): WindowAnalysis {
  const categories = turns.map((t) => t.category || "themes");
  const themeCounts: Record<string, number> = {};
  for (const c of categories) {
    themeCounts[c] = (themeCounts[c] || 0) + 1;
  }
  const dominantTheme =
    Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";

  return {
    theme: `${dominantTheme} — ${config.sessionObjective.slice(0, 50)}`,
    discussionState: turns.length >= 10 ? "mid-discussion" : "opening",
    phaseAllocation: {
      problemAndEvidence: 30,
      ideas: 25,
      evaluation: 25,
      decisionsAndActions: 20,
    },
    openQuestions: ["What evidence supports the main claims?"],
    positions: turns
      .slice(0, 3)
      .map((t) => ({ label: t.speakerLabel, gist: t.text.slice(0, 60) })),
    decisions: [],
    actions: [],
    agreementState: "emerging",
    supportingTurnIds: turns.slice(-3).map((turn) => turn.id),
  };
}

function boundedString(
  value: unknown,
  fallback: string,
  maxLength = 240,
): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function boundedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => boundedString(item, ""))
    .filter(Boolean)
    .slice(0, 8);
}

function boundedPercentage(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Generate a discussion map update from analyzed turns.
 */
export function generateDiscussionMap(
  turns: Array<TurnContext & { analysis?: TurnAnalysis }>,
): Array<{ category: DiscussionCategory; text: string; turnIds: string[] }> {
  const items: Array<{
    category: DiscussionCategory;
    text: string;
    turnIds: string[];
  }> = [];
  const seen = new Set<string>();

  for (const turn of turns) {
    if (!turn.analysis?.category) continue;
    const cat = turn.analysis.category;
    const text =
      turn.analysis.evidence ||
      turn.analysis.rationale ||
      turn.text.slice(0, 100);
    const key = `${cat}:${text.slice(0, 40)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      category: cat,
      text: text.length > 120 ? text.slice(0, 117) + "…" : text,
      turnIds: [turn.id],
    });
  }

  return items;
}

/**
 * Generate a facilitation prompt from window analysis.
 * Returns null if no prompt should be shown.
 */
export function generatePrompt(
  windowAnalysis: WindowAnalysis,
  config: AnalysisConfig,
): PromptData | null {
  // Only generate prompts when there are open questions or minority positions
  if (windowAnalysis.openQuestions.length > 0) {
    return {
      text: windowAnalysis.openQuestions[0],
      supportingTurnIds: windowAnalysis.supportingTurnIds,
      confidence: 0.8,
      category: "questions",
    };
  }
  return null;
}

function normalizeSupportingTurnIds(
  value: unknown,
  turns: TurnContext[],
  fallback: string[],
) {
  if (!Array.isArray(value)) return fallback;
  const suppliedIds = new Set(turns.map((turn) => turn.id));
  return [
    ...new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && suppliedIds.has(candidate),
      ),
    ),
  ].slice(0, 3);
}
