import type { VisualEvidenceAnalysis, VisualEvidenceData } from "./types";

export interface VisualEvidenceContext {
  objective: string;
  phase: string;
  note?: string;
  recentTurns: Array<{ id: string; speakerLabel: string; text: string }>;
}

export async function analyzeVisualEvidence(
  bytes: Buffer,
  contentType: string,
  context: VisualEvidenceContext,
): Promise<VisualEvidenceAnalysis> {
  const fallback = fallbackVisualAnalysis(context);
  if (process.env.LLM_STUB === "1" || !process.env.OPENAI_API_KEY) {
    return fallback;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:
          process.env.VISUAL_ANALYSIS_MODEL ||
          process.env.ANALYSIS_MODEL ||
          "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content:
              "Describe only visible, discussion-relevant evidence in this deliberately captured frame. Do not identify people, infer sensitive traits, read hidden information, or treat the image as proof of a spoken claim. Return JSON: {caption, observations: string[], relevance, confidence}.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  objective: context.objective,
                  phase: context.phase,
                  facilitatorNote: context.note || "",
                  recentTranscript: context.recentTurns,
                }),
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${bytes.toString("base64")}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 700,
        reasoning_effort: process.env.ANALYSIS_REASONING_EFFORT || "minimal",
      }),
    });
    if (!response.ok) {
      throw new Error(`visual analysis provider returned ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content)
      throw new Error("visual analysis provider returned no content");
    const raw = JSON.parse(content) as Record<string, unknown>;
    return {
      caption: boundedString(raw.caption, fallback.caption, 240),
      observations: Array.isArray(raw.observations)
        ? raw.observations
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().slice(0, 220))
            .filter(Boolean)
            .slice(0, 5)
        : [],
      relevance: boundedString(raw.relevance, fallback.relevance, 320),
      confidence: boundedConfidence(raw.confidence),
      engine: "model",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Visual evidence analysis fell back locally: ${detail}`);
    return {
      ...fallback,
      warning: `Image model unavailable; the frame remains captured for facilitator review (${detail.slice(0, 120)}).`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function serializeVisualEvidence(record: any): VisualEvidenceData {
  return {
    id: record.id,
    sessionId: record.sessionId,
    capturedAtMs: record.capturedAtMs,
    nearestTurnId: record.nearestTurnId ?? undefined,
    note: record.note ?? undefined,
    contentType: record.contentType,
    byteSize: record.byteSize,
    imageUrl: `/api/sessions/${record.sessionId}/visual-evidence/${record.id}`,
    analysis: safeParseJson(record.analysisJson, {}),
    createdAt: record.createdAt.toISOString(),
  };
}

function fallbackVisualAnalysis(
  context: VisualEvidenceContext,
): VisualEvidenceAnalysis {
  return {
    caption: context.note?.trim()
      ? `Facilitator-captured visual evidence: ${context.note.trim().slice(0, 180)}`
      : "Facilitator-captured visual evidence awaiting human description.",
    observations: context.note?.trim()
      ? [context.note.trim().slice(0, 220)]
      : [],
    relevance: `Captured during ${context.phase.replaceAll("_", " ")} for “${context.objective.slice(0, 160)}”.`,
    confidence: context.note?.trim() ? 0.55 : 0.25,
    engine: "deterministic-fallback",
  };
}

function boundedString(value: unknown, fallback: string, max: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function boundedConfidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.5;
}

function safeParseJson(value: string | null, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
