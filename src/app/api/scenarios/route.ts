import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    return NextResponse.json(scenarios.map(serializeScenario));
  } catch {
    return NextResponse.json({ error: "Failed to list scenarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
        speakersJson: body.speakers ? JSON.stringify(body.speakers) : null,
        turnsJson: body.turns ? JSON.stringify(body.turns) : null,
        expectedWindowOutcomeJson: body.expectedWindowOutcome ? JSON.stringify(body.expectedWindowOutcome) : null,
        status: body.status || "draft",
      },
    });
    return NextResponse.json(serializeScenario(scenario), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
  }
}

function serializeScenario(s: any) {
  return {
    ...s,
    criteria: safeParseJson(s.criteria, []),
    budget: safeParseJson(s.budgetJson, null),
    speakers: safeParseJson(s.speakersJson, null),
    turns: safeParseJson(s.turnsJson, null),
    expectedWindowOutcome: safeParseJson(s.expectedWindowOutcomeJson, null),
    preflight: safeParseJson(s.preflightJson, null),
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
    approvedAt: s.approvedAt?.toISOString() || null,
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
