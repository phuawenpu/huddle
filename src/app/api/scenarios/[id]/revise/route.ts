import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invalidateScenarioAudioMix } from "@/lib/scenario-audio";
import { requestStructuredJson } from "@/lib/openai-structured";
import { safeParseJson, serializeScenarioRecord } from "@/lib/scenario-serialization";
import {
  buildTranscriptRevisionPrompts,
  EDITABLE_TRANSCRIPT_JSON_SCHEMA,
  normalizeScenarioTurns,
  toEditableTranscript,
  turnsFromEditableTranscript,
  validateTranscriptForRevision,
  type EditableTranscriptDocument,
} from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";

export const maxDuration = 300;

type RevisionPreset = "naturalize" | "timing" | "custom";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const passes = clamp(Number(body.passes) || 1, 1, 3);
    const preset: RevisionPreset = ["naturalize", "timing", "custom"].includes(
      body.preset
    )
      ? body.preset
      : "naturalize";
    const instruction = String(body.instruction || "").trim().slice(0, 5000);
    if (preset === "custom" && !instruction) {
      return NextResponse.json(
        { error: "Describe the transcript change for a custom revision." },
        { status: 400 }
      );
    }

    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    const speakers = safeParseJson<ScenarioSpeaker[]>(scenario.speakersJson, []);
    let turns = normalizeScenarioTurns(
      safeParseJson<ScenarioTurn[]>(scenario.turnsJson, []),
      speakers.length
    );
    if (!speakers.length || !turns.length) {
      return NextResponse.json(
        { error: "Scenario needs a speaker cast and transcript before revision." },
        { status: 400 }
      );
    }

    const isStub = process.env.LLM_STUB === "1";
    const apiKey = process.env.OPENAI_API_KEY;
    if (!isStub && !apiKey) {
      return NextResponse.json(
        { error: "Transcript revision is unavailable because OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const summaries: string[] = [];
    for (let pass = 1; pass <= passes; pass++) {
      const document = toEditableTranscript(
        scenario.topic,
        scenario.objective,
        speakers,
        turns
      );
      const prompts = buildTranscriptRevisionPrompts(document, {
        instruction,
        pass,
        totalPasses: passes,
        preset,
      });
      const revised = isStub
        ? stubRevision(document, pass)
        : await requestStructuredJson<{
            version: 2;
            timeUnit: "ms";
            turns: unknown[];
            changeSummary: string;
          }>({
            apiKey: apiKey!,
            model:
              process.env.SCENARIO_EDIT_MODEL ||
              process.env.SCENARIO_MODEL ||
              "gpt-5.6-terra",
            system: prompts.system,
            user: prompts.user,
            schema: EDITABLE_TRANSCRIPT_JSON_SCHEMA,
          });
      turns = turnsFromEditableTranscript(revised, speakers);
      summaries.push(
        String((revised as any).changeSummary || `Completed revision pass ${pass}.`)
      );
    }

    const quality = validateTranscriptForRevision(turns, speakers);
    const updated = await prisma.scenario.update({
      where: { id },
      data: {
        turnsJson: JSON.stringify(turns),
        status: "draft",
        realizedDurationMs: null,
        overlapRatioPct: null,
        preflightJson: null,
        approvedAt: null,
      },
    });
    await invalidateScenarioAudioMix(id);

    return NextResponse.json({
      scenario: serializeScenarioRecord(updated),
      callsCompleted: passes,
      changeSummaries: summaries,
      quality,
      audioInvalidated: true,
    });
  } catch (error: any) {
    console.error("Transcript revision failed:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Transcript revision failed" },
      { status: 500 }
    );
  }
}

function stubRevision(document: EditableTranscriptDocument, pass: number) {
  const turns = document.turns.map((turn, index) => ({
    ...turn,
    order: index,
    timing: {
      ...turn.timing,
      gapBeforeMs: turn.timing.overlap
        ? 0
        : turn.calibration
          ? 1000
          : 180 + ((index * 137 + pass * 53) % 620),
      realizedStartMs: null,
      realizedEndMs: null,
    },
  }));
  return {
    version: 2 as const,
    timeUnit: "ms" as const,
    turns,
    changeSummary: "Normalized conversational timing with the deterministic development editor.",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
