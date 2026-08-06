import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateRun, calculateLatencyPercentiles } from "@/lib/alignment";
import type { CrossTalkLevel } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const run = await prisma.run.findUnique({
      where: { id },
      include: { session: { include: { transcriptTurns: { where: { isFinal: true } } } } },
    });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const scenario = run.scenarioId
      ? await prisma.scenario.findUnique({ where: { id: run.scenarioId } })
      : null;

    const turns = safeParseJson(scenario?.turnsJson, []);
    const actualTurns = run.session.transcriptTurns.map(t => ({
      ...t,
      wordsJson: safeParseJson(t.wordsJson, null),
      analysis: safeParseJson(t.analysisJson, null),
      isSubstantive: t.isSubstantive,
      isUnknownSpeaker: t.isUnknownSpeaker,
      possibleOverlap: t.possibleOverlap,
      participantId: t.participantId,
    }));

    const latencies = calculateLatencyPercentiles(
      actualTurns
        .filter(t => t.analysisReceivedAtMs != null)
        .map(t => t.analysisReceivedAtMs! - t.receivedAtMs)
    );

    const evaluation = evaluateRun(
      actualTurns as any,
      turns,
      {
        durationMinutes: scenario?.durationMinutes || 8,
        speakerCount: scenario?.speakerCount || 4,
        crossTalkLevel: (scenario?.crossTalkLevel || "occasional") as CrossTalkLevel,
      },
      latencies
    );

    await prisma.run.update({
      where: { id },
      data: {
        status: "evaluated",
        evaluationJson: JSON.stringify(evaluation),
      },
    });

    return NextResponse.json({ evaluation });
  } catch {
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
