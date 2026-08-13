import { NextRequest, NextResponse } from "next/server";
import { stubGenerateScenario } from "@/lib/stubs/openai";
import { validateScenarioParams } from "@/lib/budget";
import {
  buildDiscussionPrompts,
  GENERATED_SCENARIO_JSON_SCHEMA,
  normalizeGeneratedScenario,
  type ScenarioGenerationInput,
} from "@/lib/scenario-generation";
import type { CrossTalkLevel } from "@/lib/types";
import { requestStructuredJson } from "@/lib/openai-structured";
import { analyzeTranscriptQuality } from "@/lib/scenario-transcript";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      durationMinutes,
      speakerCount,
      difficulty,
      crossTalkLevel,
      seed,
    } = body;

    const validation = validateScenarioParams({
      durationMinutes: Number(durationMinutes) || 8,
      speakerCount: Number(speakerCount) || 4,
      crossTalkLevel: (crossTalkLevel || "occasional") as CrossTalkLevel,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join("; ") },
        { status: 400 },
      );
    }

    const input: ScenarioGenerationInput = {
      topic: boundedText(topic, "Design Thinking topic", 500),
      durationMinutes: Number(durationMinutes) || 8,
      speakerCount: Number(speakerCount) || 4,
      difficulty: difficulty || "realistic",
      crossTalkLevel: (crossTalkLevel || "occasional") as CrossTalkLevel,
      workshopType: boundedText(body.workshopType, "concept critique", 80),
      objective: boundedText(body.objective, "", 500) || undefined,
      criteria: Array.isArray(body.criteria)
        ? body.criteria
            .filter(
              (value: unknown): value is string => typeof value === "string",
            )
            .map((value: string) => value.trim().slice(0, 240))
            .filter(Boolean)
            .slice(0, 12)
        : [],
      disagreementLevel: boundedText(body.disagreementLevel, "moderate", 40),
      evidenceQuality: boundedText(body.evidenceQuality, "mixed", 40),
      facilitationQuality: boundedText(body.facilitationQuality, "light", 40),
      language: boundedText(body.language, "English", 40),
    };
    const prompts = buildDiscussionPrompts(input);
    const isStub = process.env.LLM_STUB === "1";

    if (isStub) {
      const raw = stubGenerateScenario({
        seed: seed || 42,
        topic: input.topic,
        durationMinutes: input.durationMinutes,
        speakerCount: input.speakerCount,
        difficulty: input.difficulty,
        crossTalkLevel: input.crossTalkLevel,
      });
      const generated = normalizeGeneratedScenario(raw, input, prompts.budget);
      return NextResponse.json({ ...generated, stubbed: true });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Dialogue generation is unavailable because the model service is not configured.",
        },
        { status: 503 },
      );
    }

    let qualityFeedback = "";
    for (let qualityAttempt = 0; qualityAttempt < 2; qualityAttempt++) {
      const content = await requestStructuredJson<any>({
        model: process.env.SCENARIO_MODEL || "gpt-5.6-terra",
        system: prompts.system,
        user: `${prompts.user}${qualityFeedback}`,
        schema: GENERATED_SCENARIO_JSON_SCHEMA,
        maxCompletionTokens: 32_000,
        operation: "scenario-generation",
      });
      const generated = normalizeGeneratedScenario(
        content,
        input,
        prompts.budget,
      );
      const quality = analyzeTranscriptQuality(
        generated.turns,
        generated.speakers,
        {
          targetDurationMinutes: input.durationMinutes,
          crossTalkLevel: input.crossTalkLevel,
        },
      );
      if (!quality.errors.length) {
        return NextResponse.json({
          ...generated,
          transcriptQuality: quality,
          stubbed: false,
        });
      }
      qualityFeedback = `\n\nThe previous draft was rejected. Regenerate the complete scenario and fix these exact issues: ${quality.errors.join(" ")}`;
    }
    throw new Error(
      "The dialogue model could not produce a transcript that passed realism checks after two attempts.",
    );
  } catch (error: any) {
    console.error("Scenario generation failed:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate scenario" },
      { status: 500 },
    );
  }
}

function boundedText(value: unknown, fallback: string, maximum: number) {
  return (
    (typeof value === "string" ? value : fallback)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maximum) || fallback
  );
}
