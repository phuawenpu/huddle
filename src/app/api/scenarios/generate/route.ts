import { NextRequest, NextResponse } from "next/server";
import { stubGenerateScenario } from "@/lib/stubs/openai";
import { validateScenarioParams } from "@/lib/budget";
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

    const isStub = process.env.LLM_STUB === "1";

    if (isStub) {
      const generated = stubGenerateScenario({
        seed: seed || Date.now(),
        topic: topic || "Design Thinking topic",
        durationMinutes: Number(durationMinutes),
        speakerCount: Number(speakerCount),
        difficulty: difficulty || "realistic",
        crossTalkLevel: crossTalkLevel as CrossTalkLevel,
      });
      return NextResponse.json({ ...generated, stubbed: true });
    }

    // In production, use OpenAI for generation
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fall back to stub
      const generated = stubGenerateScenario({
        seed: seed || Date.now(),
        topic: topic || "Design Thinking topic",
        durationMinutes: Number(durationMinutes),
        speakerCount: Number(speakerCount),
        difficulty: difficulty || "realistic",
        crossTalkLevel: crossTalkLevel as CrossTalkLevel,
      });
      return NextResponse.json({ ...generated, stubbed: true, degraded: true });
    }

    // For long scenarios (12+ min), chunk the generation
    const isLong = Number(durationMinutes) >= 12;
    const systemPrompt = `You generate realistic Design Thinking critique discussions. 
Return a JSON object with: title, description, objective, criteria (string array), 
speakers (array of {index, name, voiceId, accent, timbreClass}), 
and turns (array of {index, speakerIndex, text, expectedCategory})`;

    const userPrompt = `Generate a ${durationMinutes}-minute Design Thinking critique 
with ${speakerCount} speakers, difficulty "${difficulty}", cross-talk "${crossTalkLevel}".
Topic: ${topic}${isLong ? '. Split into two parts.' : ''}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      // Fall back to stub
      const generated = stubGenerateScenario({
        seed: seed || Date.now(),
        topic: topic || "Design Thinking topic",
        durationMinutes: Number(durationMinutes),
        speakerCount: Number(speakerCount),
        difficulty: difficulty || "realistic",
        crossTalkLevel: crossTalkLevel as CrossTalkLevel,
      });
      return NextResponse.json({ ...generated, stubbed: true, degraded: true });
    }

    const data = await res.json();
    const content = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ ...content, stubbed: false });
  } catch {
    return NextResponse.json({ error: "Failed to generate scenario" }, { status: 500 });
  }
}
