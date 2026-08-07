import { estimateBudget, expectedOverlapCount } from "./budget";
import { createDefaultCasting } from "./voice-casting";
import type {
  CrossTalkLevel,
  ScenarioBudget,
  ScenarioSpeaker,
  ScenarioTurn,
} from "./types";

export interface ScenarioGenerationInput {
  topic: string;
  durationMinutes: number;
  speakerCount: number;
  difficulty: string;
  crossTalkLevel: CrossTalkLevel;
  workshopType?: string;
  objective?: string;
  criteria?: string[];
  disagreementLevel?: string;
  evidenceQuality?: string;
  facilitationQuality?: string;
  language?: string;
}
export interface GeneratedScenario {
  title: string;
  description: string;
  objective: string;
  criteria: string[];
  speakers: ScenarioSpeaker[];
  turns: ScenarioTurn[];
  budget: ScenarioBudget;
  generationWarnings: string[];
}

const CATEGORY_VALUES = new Set([
  "evidence",
  "questions",
  "positions",
  "decisions",
  "actions",
  "themes",
]);

export function buildDiscussionPrompts(input: ScenarioGenerationInput): {
  system: string;
  user: string;
  budget: ScenarioBudget;
} {
  const budget = estimateBudget(
    input.durationMinutes,
    input.speakerCount,
    input.crossTalkLevel
  );
  const overlapCount = expectedOverlapCount(
    input.durationMinutes,
    input.crossTalkLevel
  );
  const backchannelCount = Math.max(
    2,
    Math.round((input.durationMinutes / 5) * input.speakerCount)
  );

  const system = `You write realistic transcripts of live design-critique workshops for an audio simulation. Return one JSON object only.

The transcript must feel like one evolving conversation, not a sequence of independent mini-speeches.

CONVERSATIONAL CAUSALITY
- Every main turn after the first must respond to a specific earlier claim, question, example, or tension. Put that earlier turn's id in expected.reactsToTurnId.
- Speakers may agree, but they must add, qualify, repair, challenge, redirect, or make an implication explicit. Ban empty phrases such as "That's a great point", "I agree", and "Building on that" unless immediately followed by specific content.
- Let participants misunderstand and repair each other occasionally. Use pronouns and references such as "that constraint", "the second option", and "what Casey just described" when their referent is clear.
- Decisions must emerge from the discussion. Do not announce phase changes, list generic pros and cons, or close with a polished summary.
- Keep one material minority concern unresolved. Do not manufacture consensus.

SPEAKER CONTINUITY
- Exactly ${input.speakerCount} speakers. Give each a role, viewpoint, discourseStyle, and habitualMove that remain stable without becoming caricatures.
- People should not speak in round-robin order. Allow a speaker to respond twice before a quieter participant returns, while meeting minimum participation.
- Each speaker must remember and revise their own earlier position at least once across discussions longer than 5 minutes.
- Names appear rarely in dialogue.

SPOKEN LANGUAGE
- Natural ${input.language || "English"} with contractions, fragments, interruptions, occasional false starts, and sparse fillers.
- Most turns are 4–24 words. Some are 1–3 word backchannels; a few are 25–45 words. No turn exceeds 45 words.
- Avoid essay prose, fake citations, invented percentages, corporate filler, and repeated sentence frames.
- Evidence must be plausible and specific but must not invent formal studies, exact metrics, or named authorities unless supplied by the user.

ARC
- Start from the actual artifact and user situation, then let evidence, assumptions, alternatives, constraints, and consequences become entangled naturally.
- Include at least two genuine points of disagreement, one repaired misunderstanding, one idea that changes because of critique, one decision, and one owned next action.
- The facilitator participates lightly and does not dominate.

CALIBRATION
- Begin with exactly one calibration turn per speaker. Each is 20–30 words, isCalibration:true, and introduces their role and what they will listen for.
- Calibration turns do not react, overlap, or carry critique labels.

OUTPUT SHAPE
{
  "title": string,
  "description": string,
  "objective": string,
  "criteria": string[],
  "speakers": [{
    "index": number, "name": string, "role": string, "viewpoint": string,
    "discourseStyle": string, "habitualMove": string, "accent": string,
    "targetTalkShare": number
  }],
  "turns": [{
    "id": "t<number>", "index": number, "speakerIndex": number, "text": string,
    "isCalibration": boolean, "pauseBeforeMs": number,
    "expectedCategory": "evidence"|"questions"|"positions"|"decisions"|"actions"|"themes",
    "expected": {
      "substantive": boolean,
      "category": "evidence"|"questions"|"positions"|"decisions"|"actions"|"themes",
      "potentialSignal": string,
      "reactsToTurnId": string
    },
    "overlap": null | {
      "withTurnId": "t<number>",
      "startOffsetMs": number,
      "kind": "interruption"|"eager_agreement"|"backchannel"
    }
  }]
}

TARGETS
- ${budget.targetTurns} main turns plus ${input.speakerCount} calibration turns.
- About ${budget.targetCharacters} main-discussion characters, within 15%.
- At least ${budget.minTurnsPerSpeaker} main turns per speaker.
- Exactly ${overlapCount} overlap starts and about ${backchannelCount} non-substantive backchannels.
- Overlap only the immediately preceding main turn, never the first two main turns, never the same speaker, 300–1500 ms, and no consecutive overlap starts.
- pauseBeforeMs is normally 180–850 ms; use 900–1600 ms after a difficult question or before a consequential response; overlap turns use 0.

Fill every field. JSON only.`;

  const user = `Create the discussion.
Topic/artifact: ${input.topic}
Workshop type: ${input.workshopType || "concept critique"}
Objective: ${input.objective || `Evaluate ${input.topic} and agree on the next test without erasing unresolved concerns.`}
Criteria: ${(input.criteria || []).join("; ") || "user value; feasibility; accessibility; testability"}
Requested length: ${input.durationMinutes} minutes
Difficulty: ${input.difficulty}
Disagreement: ${input.disagreementLevel || "moderate"}
Evidence quality: ${input.evidenceQuality || "mixed"}
Facilitation quality: ${input.facilitationQuality || "light"}
Cross-talk: ${input.crossTalkLevel}`;

  return { system, user, budget };
}

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGeneratedScenario(
  raw: any,
  input: ScenarioGenerationInput,
  budget = estimateBudget(
    input.durationMinutes,
    input.speakerCount,
    input.crossTalkLevel
  )
): GeneratedScenario {
  const warnings: string[] = [];
  const speakers = createDefaultCasting(
    input.speakerCount,
    Array.isArray(raw?.speakers) ? raw.speakers : []
  );
  const sourceTurns = Array.isArray(raw?.turns) ? raw.turns : [];
  const turns: ScenarioTurn[] = sourceTurns
    .map((source: any, index: number): ScenarioTurn | null => {
      const text = cleanText(source?.text);
      if (!text) return null;
      const speakerIndex = Math.min(
        input.speakerCount - 1,
        Math.max(0, Number(source?.speakerIndex) || 0)
      );
      const id = `t${index}`;
      const expectedCategory = CATEGORY_VALUES.has(source?.expectedCategory)
        ? source.expectedCategory
        : CATEGORY_VALUES.has(source?.expected?.category)
          ? source.expected.category
          : "positions";
      const isCalibration = index < input.speakerCount;
      const overlap =
        !isCalibration && source?.overlap
          ? {
              withTurnId: `t${Math.max(0, index - 1)}`,
              startOffsetMs: Math.min(
                1500,
                Math.max(300, Number(source.overlap.startOffsetMs) || 500)
              ),
              kind: ["interruption", "eager_agreement", "backchannel"].includes(
                source.overlap.kind
              )
                ? source.overlap.kind
                : "interruption",
            }
          : undefined;
      return {
        id,
        index,
        speakerIndex,
        text,
        isCalibration,
        pauseBeforeMs: overlap
          ? 0
          : Math.min(
              1800,
              Math.max(
                isCalibration ? 1200 : 120,
                Number(source?.pauseBeforeMs) || (isCalibration ? 1200 : 420)
              )
            ),
        expectedCategory,
        expected: {
          substantive:
            isCalibration ? false : source?.expected?.substantive !== false,
          category: expectedCategory,
          potentialSignal: cleanText(source?.expected?.potentialSignal) || "none",
          reactsToTurnId:
            isCalibration || index === input.speakerCount
              ? undefined
              : normalizeReactionId(source?.expected?.reactsToTurnId, index),
        },
        overlap,
      };
    })
    .filter((turn: ScenarioTurn | null): turn is ScenarioTurn => turn !== null);

  if (turns.length < input.speakerCount + 3) {
    throw new Error("Generated discussion is too short to form a coherent critique.");
  }

  for (let index = 0; index < Math.min(input.speakerCount, turns.length); index++) {
    turns[index].speakerIndex = index;
    turns[index].isCalibration = true;
    turns[index].overlap = undefined;
    turns[index].expected = {
      substantive: false,
      category: turns[index].expectedCategory,
      potentialSignal: "none",
    };
  }

  const mainTurns = turns.slice(input.speakerCount);
  const mainCharacters = mainTurns.reduce((sum, turn) => sum + turn.text.length, 0);
  if (
    mainCharacters < (budget.targetCharacters || 0) * 0.8 ||
    mainCharacters > (budget.targetCharacters || 0) * 1.2
  ) {
    warnings.push(
      `Dialogue length is ${mainCharacters.toLocaleString()} characters versus a ${(budget.targetCharacters || 0).toLocaleString()} target.`
    );
  }

  for (const speaker of speakers) {
    const count = mainTurns.filter(
      (turn) => turn.speakerIndex === speaker.index
    ).length;
    if (count < (budget.minTurnsPerSpeaker || 4)) {
      warnings.push(
        `${speaker.name} has ${count} main turns; target minimum is ${budget.minTurnsPerSpeaker}.`
      );
    }
  }

  return {
    title: cleanText(raw?.title) || `${input.topic} — Critique`,
    description:
      cleanText(raw?.description) ||
      `A simulated ${input.durationMinutes}-minute critique of ${input.topic}.`,
    objective:
      cleanText(raw?.objective) ||
      input.objective ||
      `Evaluate ${input.topic} and identify the next test.`,
    criteria:
      Array.isArray(raw?.criteria) && raw.criteria.length
        ? raw.criteria.map(cleanText).filter(Boolean).slice(0, 5)
        : input.criteria || ["User value", "Feasibility", "Testability"],
    speakers,
    turns,
    budget,
    generationWarnings: warnings,
  };
}

function normalizeReactionId(value: unknown, currentIndex: number): string {
  const match = String(value || "").match(/(\d+)/);
  const parsed = match ? Number(match[1]) : currentIndex - 1;
  return `t${Math.min(currentIndex - 1, Math.max(0, parsed))}`;
}
