import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeScenarioRecord } from "@/lib/scenario-serialization";
import {
  normalizeScenarioTurns,
  validateTranscriptForRevision,
} from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const scenarios = await prisma.scenario.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(scenarios.map(serializeScenarioRecord));
  } catch {
    return NextResponse.json(
      { error: "Failed to list scenarios" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const speakers = Array.isArray(body.speakers)
      ? (body.speakers as ScenarioSpeaker[])
      : [];
    const turns = Array.isArray(body.turns)
      ? normalizeScenarioTurns(body.turns as ScenarioTurn[], speakers.length)
      : [];
    if (turns.length && speakers.length) {
      validateTranscriptForRevision(turns, speakers, {
        targetDurationMinutes: body.durationMinutes || 8,
        crossTalkLevel: body.crossTalkLevel || "occasional",
      });
    }
    const scenario = await prisma.scenario.create({
      data: {
        title: body.title || "Untitled Scenario",
        description: body.description || "",
        topic: body.topic || "",
        domain: body.domain || "",
        workshopType: body.workshopType || "concept_critique",
        objective: body.objective || "",
        phase: body.phase || "evaluate",
        criteria: JSON.stringify(body.criteria || []),
        language: body.language || "en",
        durationMinutes: body.durationMinutes || 8,
        speakerCount: body.speakerCount || 4,
        difficulty: body.difficulty || "realistic",
        crossTalkLevel: body.crossTalkLevel || "occasional",
        participationProfile: body.participationProfile || "even",
        budgetJson: body.budget ? JSON.stringify(body.budget) : null,
        speakersJson: body.speakers ? JSON.stringify(speakers) : null,
        turnsJson: body.turns ? JSON.stringify(turns) : null,
        expectedWindowOutcomeJson: body.expectedWindowOutcome
          ? JSON.stringify(body.expectedWindowOutcome)
          : null,
        status: body.status || "draft",
      },
    });
    return NextResponse.json(serializeScenarioRecord(scenario), {
      status: 201,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create scenario" },
      { status: 400 },
    );
  }
}
