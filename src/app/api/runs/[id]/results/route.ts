import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            transcriptTurns: { where: { isFinal: true }, orderBy: { receivedAtMs: "asc" } },
          },
        },
        scenario: true,
      },
    });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    return NextResponse.json({
      run: serializeRun(run),
      turns: run.session.transcriptTurns.map(serializeTurn),
      scenario: run.scenario ? serializeScenario(run.scenario) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to get results" }, { status: 500 });
  }
}

function serializeRun(r: any) {
  return {
    ...r,
    playbackEvents: safeParseJson(r.playbackEventsJson, null),
    evaluation: safeParseJson(r.evaluationJson, null),
    deviations: safeParseJson(r.deviationsJson, []),
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
    session: undefined,
    scenario: undefined,
  };
}

function serializeTurn(t: any) {
  return {
    ...t,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysisJson: safeParseJson(t.analysisJson, null),
    session: undefined,
  };
}

function serializeScenario(s: any) {
  return {
    ...s,
    criteria: safeParseJson(s.criteria, []),
    budget: safeParseJson(s.budgetJson, null),
    speakers: safeParseJson(s.speakersJson, null),
    turns: safeParseJson(s.turnsJson, null),
    preflight: safeParseJson(s.preflightJson, null),
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
