import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeParseJson } from "@/lib/scenario-serialization";
import { normalizeScenarioTurns } from "@/lib/scenario-transcript";
import {
  evaluateSpeechRecognition,
  type SpeechHypothesisWord,
} from "@/lib/speech-evaluation";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        scenario: true,
        transcriptTurns: {
          where: { isFinal: true },
          orderBy: [{ startMs: "asc" }, { providerTurnOrder: "asc" }],
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.scenario) {
      return NextResponse.json(
        { error: "Speech evaluation requires a session linked to a scenario." },
        { status: 409 },
      );
    }

    const speakers = safeParseJson<ScenarioSpeaker[]>(
      session.scenario.speakersJson,
      [],
    );
    const turns = normalizeScenarioTurns(
      safeParseJson<ScenarioTurn[]>(session.scenario.turnsJson, []),
      speakers.length,
    );
    if (
      speakers.length === 0 ||
      turns.length === 0 ||
      turns.some(
        (turn) =>
          !Number.isFinite(turn.startMs) || !Number.isFinite(turn.endMs),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Speech evaluation requires a synthesized scenario with realized turn timing.",
        },
        { status: 409 },
      );
    }

    const startMs = optionalNumber(request.nextUrl.searchParams.get("startMs"));
    const endMs = optionalNumber(request.nextUrl.searchParams.get("endMs"));
    const collarMs = optionalNumber(
      request.nextUrl.searchParams.get("collarMs"),
    );
    const hypothesisTimeOffsetMs = optionalNumber(
      request.nextUrl.searchParams.get("hypothesisTimeOffsetMs"),
    );
    const includeCalibration =
      request.nextUrl.searchParams.get("includeCalibration") === "1";
    const speakerByIndex = new Map(
      speakers.map((speaker) => [speaker.index, speaker]),
    );
    const report = evaluateSpeechRecognition(
      turns.map((turn) => {
        const speaker = speakerByIndex.get(turn.speakerIndex);
        return {
          id: turn.id || `t${turn.index}`,
          speakerId: String(turn.speakerIndex),
          speakerName: speaker?.name || `Speaker ${turn.speakerIndex + 1}`,
          text: turn.text,
          startMs: turn.startMs!,
          endMs: turn.endMs!,
          isCalibration: turn.isCalibration,
        };
      }),
      session.transcriptTurns.map((turn) => ({
        speakerLabel: turn.providerSpeakerLabel,
        text: turn.currentText,
        startMs: turn.startMs,
        endMs: turn.endMs,
        words: safeParseJson<SpeechHypothesisWord[] | null>(
          turn.wordsJson,
          null,
        ),
      })),
      {
        startMs,
        endMs,
        collarMs,
        includeCalibration,
        hypothesisTimeOffsetMs,
      },
    );

    return NextResponse.json({
      sessionId: session.id,
      scenarioId: session.scenario.id,
      scenarioTitle: session.scenario.title,
      sessionStatus: session.status,
      generatedAt: new Date().toISOString(),
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to evaluate speech recognition" },
      { status: 400 },
    );
  }
}

function optionalNumber(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Expected a finite numeric query value, received ${value}.`,
    );
  }
  return parsed;
}
