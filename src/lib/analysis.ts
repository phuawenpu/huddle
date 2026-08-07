// ============================================
// Critique Analysis Engine
// ============================================
// Handles batched LLM turn analysis, window analysis,
// discussion map generation, and facilitation prompts.

import type { TurnAnalysis, DiscussionCategory, SSEPatch, WindowAnalysis, PromptData } from "./types";

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

/**
 * Analyze a batch of turns using the OpenAI LLM.
 */
export async function analyzeTurnBatch(
  turns: TurnContext[],
  config: AnalysisConfig
): Promise<Map<string, TurnAnalysis>> {
  const isStub = process.env.LLM_STUB === "1";
  
  if (isStub) {
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(turn.id, stubAnalyzeTurn(turn.text, config.sessionObjective, [], turn.text.length));
    }
    return results;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Use stubs as fallback
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(turn.id, stubAnalyzeTurn(turn.text, config.sessionObjective, [], turn.text.length));
    }
    return results;
  }

  try {
    const turnContexts = turns.map(t => ({
      id: t.id,
      speaker: t.speakerLabel,
      text: t.text,
    }));

    const prompt = `Analyze these Design Thinking critique turns. Session context:
Objective: ${config.sessionObjective}
Phase: ${config.sessionPhase}
Criteria: ${config.sessionCriteria.join(", ")}

For each turn, determine:
- category: one of "evidence", "questions", "positions", "decisions", "actions", "themes"
- confidence: 0.0-1.0
- evidence: specific evidence cited (if any)
- rationale: reasoning behind the statement
- intent: what the speaker is trying to achieve
- stance: "supports", "opposes", "qualifies", "requests_evidence", "alternative", "neutral", "unclear"
- theme: one-line theme summary

Return JSON: { "analyses": [{ "id": "<turn_id>", ... }] }`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify({ turns: turnContexts }) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from analysis model");

    const parsed = JSON.parse(content);
    const results = new Map<string, TurnAnalysis>();
    
    const analyses = parsed.analyses || [];
    for (const a of analyses) {
      if (a.id) {
        results.set(a.id, {
          category: a.category || "themes",
          confidence: a.confidence || 0.5,
          evidence: a.evidence,
          rationale: a.rationale,
          intent: a.intent,
          stance: a.stance,
          theme: a.theme,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Turn analysis failed:", error);
    // Fall back to stubs
    const { stubAnalyzeTurn } = await import("@/lib/stubs/openai");
    const results = new Map<string, TurnAnalysis>();
    for (const turn of turns) {
      results.set(turn.id, stubAnalyzeTurn(turn.text, config.sessionObjective, [], turn.text.length));
    }
    return results;
  }
}

/**
 * Perform window analysis on recent turns.
 * Called every 20s or after 5 new substantive turns.
 */
export async function analyzeWindow(
  recentTurns: TurnContext[],
  existingItems: Array<{ id: string; category: string; text: string }>,
  config: AnalysisConfig
): Promise<WindowAnalysis> {
  const isStub = process.env.LLM_STUB === "1";
  
  if (isStub || !process.env.OPENAI_API_KEY) {
    return stubWindowAnalysis(recentTurns, config);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content: `Analyze this window of a Design Thinking critique discussion.
Session: ${config.sessionObjective} (${config.sessionPhase})
Recent turns: ${JSON.stringify(recentTurns.map(t => ({ speaker: t.speakerLabel, text: t.text, category: t.category })))}

Return JSON with:
- theme: overarching theme of this window
- discussionState: current state description
- phaseAllocation: { problemAndEvidence, ideas, evaluation, decisionsAndActions } - percentages 0-100
- openQuestions: array of open questions
- positions: array of { label, gist } for distinct positions
- decisions: array of decisions made
- actions: array of action items
- agreementState: "consensus" | "majority" | "divided" | "emerging"
- minorityPosition: a minority view that should be preserved, or null`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });

    if (!res.ok) throw new Error(`Window analysis failed: ${res.status}`);
    
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return stubWindowAnalysis(recentTurns, config);
  }
}

function stubWindowAnalysis(turns: TurnContext[], config: AnalysisConfig): WindowAnalysis {
  const categories = turns.map(t => t.category || "themes");
  const themeCounts: Record<string, number> = {};
  for (const c of categories) {
    themeCounts[c] = (themeCounts[c] || 0) + 1;
  }
  const dominantTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";

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
    positions: turns.slice(0, 3).map(t => ({ label: t.speakerLabel, gist: t.text.slice(0, 60) })),
    decisions: [],
    actions: [],
    agreementState: "emerging",
  };
}

/**
 * Generate a discussion map update from analyzed turns.
 */
export function generateDiscussionMap(
  turns: Array<TurnContext & { analysis?: TurnAnalysis }>
): Array<{ category: DiscussionCategory; text: string; turnIds: string[] }> {
  const items: Array<{ category: DiscussionCategory; text: string; turnIds: string[] }> = [];
  const seen = new Set<string>();

  for (const turn of turns) {
    if (!turn.analysis?.category) continue;
    const cat = turn.analysis.category;
    const text = turn.analysis.evidence || turn.analysis.rationale || turn.text.slice(0, 100);
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
  config: AnalysisConfig
): PromptData | null {
  // Only generate prompts when there are open questions or minority positions
  if (windowAnalysis.openQuestions.length > 0) {
    return {
      text: windowAnalysis.openQuestions[0],
      supportingTurnIds: [],
      confidence: 0.8,
      category: "questions",
    };
  }
  return null;
}
