import { NextRequest, NextResponse } from "next/server";
import { stubGenerateScenario } from "@/lib/stubs/openai";
import { validateScenarioParams } from "@/lib/budget";
import {
  buildDiscussionPrompts,
  normalizeGeneratedScenario,
  type ScenarioGenerationInput,
} from "@/lib/scenario-generation";
import type { CrossTalkLevel } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, durationMinutes, speakerCount, difficulty, crossTalkLevel, seed } = body;

    const validation = validateScenarioParams({
      durationMinutes: Number(durationMinutes) || 8,
      speakerCount: Number(speakerCount) || 4,
      crossTalkLevel: (crossTalkLevel || "occasional") as CrossTalkLevel,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const input: ScenarioGenerationInput = {
      topic: String(topic || "Design Thinking topic"),
      durationMinutes: Number(durationMinutes) || 8,
      speakerCount: Number(speakerCount) || 4,
      difficulty: difficulty || "realistic",
      crossTalkLevel: (crossTalkLevel || "occasional") as CrossTalkLevel,
      workshopType: body.workshopType,
      objective: body.objective,
      criteria: body.criteria,
      disagreementLevel: body.disagreementLevel,
      evidenceQuality: body.evidenceQuality,
      facilitationQuality: body.facilitationQuality,
      language: body.language || "English",
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
            "Dialogue generation is unavailable because OPENAI_API_KEY is not configured. Set LLM_STUB=1 explicitly for deterministic development fixtures.",
        },
        { status: 503 }
      );
    }

    const content = await generateDialogue(apiKey, prompts.system, prompts.user);
    const generated = normalizeGeneratedScenario(content, input, prompts.budget);
    return NextResponse.json({ ...generated, stubbed: false });
  } catch (error: any) {
    console.error("Scenario generation failed:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate scenario" },
      { status: 500 }
    );
  }
}

async function generateDialogue(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  let lastError = "OpenAI dialogue generation failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.SCENARIO_MODEL || process.env.ANALYSIS_MODEL || "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("The dialogue model returned no content.");
      return JSON.parse(text);
    }
    const detail = await res.text();
    lastError = `Dialogue model returned ${res.status}: ${detail.slice(0, 300)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
  }
  throw new Error(lastError);
}
