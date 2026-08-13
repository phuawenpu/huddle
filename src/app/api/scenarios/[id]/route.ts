import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invalidateScenarioAudioMix } from "@/lib/scenario-audio";
import {
  safeParseJson,
  serializeScenarioRecord,
} from "@/lib/scenario-serialization";
import {
  normalizeScenarioTurns,
  validateTranscriptForRevision,
} from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";
import { isPreconfiguredScenarioId } from "@/lib/preconfigured-scenarios";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario)
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 },
      );
    return NextResponse.json(serializeScenarioRecord(scenario));
  } catch {
    return NextResponse.json(
      { error: "Failed to get scenario" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const existing = await prisma.scenario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 },
      );
    }
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.topic !== undefined) data.topic = body.topic;
    if (body.objective !== undefined) data.objective = body.objective;
    if (body.phase !== undefined) data.phase = body.phase;
    if (body.criteria !== undefined)
      data.criteria = JSON.stringify(body.criteria);
    if (body.crossTalkLevel !== undefined) {
      if (
        !new Set(["none", "occasional", "frequent"]).has(body.crossTalkLevel)
      ) {
        throw new Error(
          "crossTalkLevel must be none, occasional, or frequent.",
        );
      }
      data.crossTalkLevel = body.crossTalkLevel;
    }
    if (body.difficulty !== undefined) {
      if (
        !new Set(["simple", "realistic", "challenging"]).has(body.difficulty)
      ) {
        throw new Error(
          "difficulty must be simple, realistic, or challenging.",
        );
      }
      data.difficulty = body.difficulty;
    }
    if (body.participationProfile !== undefined) {
      if (
        !new Set(["even", "dominant_facilitator", "mixed"]).has(
          body.participationProfile,
        )
      ) {
        throw new Error(
          "participationProfile must be even, dominant_facilitator, or mixed.",
        );
      }
      data.participationProfile = body.participationProfile;
    }
    const speakers =
      body.speakers !== undefined
        ? (body.speakers as ScenarioSpeaker[])
        : safeParseJson<ScenarioSpeaker[]>(existing.speakersJson, []);
    if (body.speakers !== undefined) {
      data.speakersJson = JSON.stringify(speakers);
      data.status = "draft";
      data.realizedDurationMs = null;
      data.overlapRatioPct = null;
      data.preflightJson = null;
      data.approvedAt = null;
    }
    if (body.turns !== undefined) {
      const turns = normalizeScenarioTurns(
        body.turns as ScenarioTurn[],
        speakers.length,
      );
      validateTranscriptForRevision(turns, speakers, {
        targetDurationMinutes: existing.durationMinutes,
        crossTalkLevel: body.crossTalkLevel ?? existing.crossTalkLevel,
      });
      data.turnsJson = JSON.stringify(turns);
      data.status = "draft";
      data.realizedDurationMs = null;
      data.overlapRatioPct = null;
      data.preflightJson = null;
      data.approvedAt = null;
    }
    if (body.budget !== undefined)
      data.budgetJson = JSON.stringify(body.budget);
    const changesTranscript =
      body.turns !== undefined || body.speakers !== undefined;
    if (!changesTranscript && body.status !== undefined)
      data.status = body.status;
    if (!changesTranscript && body.realizedDurationMs !== undefined)
      data.realizedDurationMs = body.realizedDurationMs;
    if (!changesTranscript && body.overlapRatioPct !== undefined)
      data.overlapRatioPct = body.overlapRatioPct;
    if (!changesTranscript && body.preflight !== undefined)
      data.preflightJson = JSON.stringify(body.preflight);

    const scenario = await prisma.scenario.update({ where: { id }, data });
    if (changesTranscript) {
      await invalidateScenarioAudioMix(id);
    }
    return NextResponse.json(serializeScenarioRecord(scenario));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update scenario" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    if (isPreconfiguredScenarioId(id)) {
      return NextResponse.json(
        {
          error:
            "Preconfigured scenarios are retained as reusable examples. Duplicate this scenario to create a removable copy.",
        },
        { status: 409 },
      );
    }
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete scenario" },
      { status: 500 },
    );
  }
}
