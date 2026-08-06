import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    return NextResponse.json(serializeScenario(scenario));
  } catch {
    return NextResponse.json({ error: "Failed to get scenario" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.topic !== undefined) data.topic = body.topic;
    if (body.objective !== undefined) data.objective = body.objective;
    if (body.phase !== undefined) data.phase = body.phase;
    if (body.criteria !== undefined) data.criteria = JSON.stringify(body.criteria);
    if (body.speakers !== undefined) data.speakersJson = JSON.stringify(body.speakers);
    if (body.turns !== undefined) data.turnsJson = JSON.stringify(body.turns);
    if (body.budget !== undefined) data.budgetJson = JSON.stringify(body.budget);
    if (body.status !== undefined) data.status = body.status;
    if (body.realizedDurationMs !== undefined) data.realizedDurationMs = body.realizedDurationMs;
    if (body.overlapRatioPct !== undefined) data.overlapRatioPct = body.overlapRatioPct;
    if (body.preflight !== undefined) data.preflightJson = JSON.stringify(body.preflight);

    const scenario = await prisma.scenario.update({ where: { id }, data });
    return NextResponse.json(serializeScenario(scenario));
  } catch {
    return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete scenario" }, { status: 500 });
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
