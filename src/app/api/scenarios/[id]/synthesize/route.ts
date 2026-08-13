import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { synthesizeScenarioAudio } from "@/lib/audio-pipeline";
import { validateRenderedSpeech } from "@/lib/audio-validation";
import {
  normalizeScenarioTurns,
  validateTranscriptForRevision,
} from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 },
      );
    }
    const storedTurns = safeParse<ScenarioTurn[]>(scenario.turnsJson, []);
    const speakers = safeParse<ScenarioSpeaker[]>(scenario.speakersJson, []);
    if (!storedTurns.length || !speakers.length) {
      return NextResponse.json(
        {
          error:
            "Scenario needs a complete script and voice cast before synthesis.",
        },
        { status: 400 },
      );
    }
    const turns = normalizeScenarioTurns(storedTurns, speakers.length);
    validateTranscriptForRevision(turns, speakers, {
      targetDurationMinutes: scenario.durationMinutes,
      crossTalkLevel: scenario.crossTalkLevel,
      requireTargetDurationFit: true,
    });

    await prisma.scenario.update({
      where: { id },
      data: {
        status: "synthesizing",
        preflightJson: null,
        approvedAt: null,
      },
    });

    const manifest = await synthesizeScenarioAudio({
      scenarioId: id,
      speakers,
      turns,
    });
    const validation = await validateRenderedSpeech(manifest);
    if (!validation.passed) {
      throw new Error(
        validation.reason ||
          "Independent speech-to-text validation did not match the source dialogue.",
      );
    }
    const updatedTurns = turns.map((turn, index) => {
      const rendered = manifest.turns[index];
      return {
        ...turn,
        id: rendered.id,
        hash: rendered.renderKey,
        startMs: rendered.scheduledStartMs,
        endMs: rendered.scheduledEndMs,
      };
    });

    await prisma.scenario.update({
      where: { id },
      data: {
        status: "rendered",
        turnsJson: JSON.stringify(updatedTurns),
        realizedDurationMs: manifest.durationMs,
        overlapRatioPct: manifest.overlapRatioPct,
      },
    });

    return NextResponse.json({
      synthesized: true,
      status: "rendered",
      turnCount: turns.length,
      speakerCount: speakers.length,
      realizedDurationMs: manifest.durationMs,
      durationSec: Math.round(manifest.durationMs / 1000),
      overlapRatioPct: manifest.overlapRatioPct,
      mixedUrl: `/api/scenarios/${id}/mixed?format=wav`,
      outputs: manifest.outputs,
      stubbed: manifest.stubbed,
      audioValidation: validation,
    });
  } catch (error: any) {
    console.error("Synthesis error:", error?.message || error);
    await prisma.scenario
      .update({
        where: { id },
        data: {
          status: "incomplete",
          preflightJson: JSON.stringify({
            passed: false,
            mergedPairs: [],
            distinctnessScores: [],
            audioAvailable: false,
            reason: error?.message || "Speech synthesis failed",
            checkedAt: new Date().toISOString(),
          }),
        },
      })
      .catch(() => {});
    return NextResponse.json(
      {
        error: error?.message || "Speech synthesis failed",
        synthesized: false,
      },
      { status: 500 },
    );
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
