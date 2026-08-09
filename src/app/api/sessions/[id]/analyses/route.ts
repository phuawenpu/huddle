import { NextRequest, NextResponse } from "next/server";
import { prisma, databaseReady } from "@/lib/db";
import { analyzeFullTranscript } from "@/lib/live-analysis";
import { serializeLiveAnalysis } from "@/lib/live-analysis-record";
import { publish } from "@/lib/pubsub";
import { liveAnalysisPatch } from "@/lib/sse";

const PHASES = new Set([
  "frame",
  "empathize",
  "define",
  "ideate",
  "evaluate",
  "decide",
  "plan_experiment",
  "reflect",
]);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await databaseReady;
  const limit = Math.max(
    1,
    Math.min(25, Number(request.nextUrl.searchParams.get("limit")) || 10),
  );
  try {
    const analyses = await prisma.liveAnalysis.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(analyses.map(serializeLiveAnalysis));
  } catch (error) {
    console.error("Failed to list live analyses:", error);
    return NextResponse.json(
      { error: "Failed to list live analyses" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await databaseReady;
  try {
    const body = await request.json();
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        transcriptTurns: {
          where: {
            isFinal: true,
            isSubstantive: true,
            isCalibration: false,
          },
          orderBy: [{ receivedAtMs: "asc" }, { providerTurnOrder: "asc" }],
        },
        visualEvidence: { orderBy: { capturedAtMs: "asc" } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const objective = boundedRequiredText(
      body.objective ?? session.objective,
      "objective",
      500,
    );
    const phase = String(body.phase ?? session.phase);
    if (!PHASES.has(phase)) {
      return NextResponse.json(
        { error: "Choose a supported critique phase." },
        { status: 400 },
      );
    }
    const criteria = normalizeCriteria(
      body.criteria ?? safeParseJson(session.criteria, []),
    );
    const turns = session.transcriptTurns;
    if (turns.length === 0) {
      return NextResponse.json(
        { error: "No finalized substantive transcript is available yet." },
        { status: 409 },
      );
    }

    // Intent changes and analysis runs are explicit historical events. Updating
    // this metadata never pauses or reinitializes the audio/ASR connection.
    await prisma.$transaction([
      prisma.session.update({
        where: { id },
        data: { objective, phase, criteria: JSON.stringify(criteria) },
      }),
      prisma.intentRevision.create({
        data: {
          id: crypto.randomUUID(),
          sessionId: id,
          objective,
          phase,
          criteria: JSON.stringify(criteria),
        },
      }),
    ]);

    const transcriptThroughMs = Math.max(...turns.map((turn) => turn.endMs));
    const evidenceInScope = session.visualEvidence.filter(
      (evidence) => evidence.capturedAtMs <= transcriptThroughMs,
    );
    const result = await analyzeFullTranscript(
      turns.map((turn) => ({
        id: turn.id,
        speakerLabel: turn.providerSpeakerLabel || "Unassigned",
        text: turn.currentText,
        startMs: turn.startMs,
        endMs: turn.endMs,
      })),
      evidenceInScope.map((evidence) => {
        const analysis = safeParseJson(evidence.analysisJson, {});
        return {
          id: evidence.id,
          capturedAtMs: evidence.capturedAtMs,
          note: evidence.note ?? undefined,
          caption: analysis.caption,
          observations: analysis.observations,
        };
      }),
      { objective, phase, criteria },
    );

    const record = await prisma.liveAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: id,
        objective,
        phase,
        criteria: JSON.stringify(criteria),
        transcriptTurnCount: turns.length,
        transcriptWordCount: turns.reduce(
          (count, turn) => count + wordCount(turn.currentText),
          0,
        ),
        transcriptThroughMs,
        firstTurnId: turns[0].id,
        lastTurnId: turns.at(-1)!.id,
        visualEvidenceCount: evidenceInScope.length,
        resultJson: JSON.stringify(result),
      },
    });
    const snapshot = serializeLiveAnalysis(record);
    publish(id, liveAnalysisPatch(snapshot));
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("Invalid ")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Live analysis failed:", message);
    return NextResponse.json(
      { error: "Failed to analyze the transcript" },
      { status: 500 },
    );
  }
}

function boundedRequiredText(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${field}: enter a value before analyzing.`);
  }
  return value.trim().slice(0, max);
}

function normalizeCriteria(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid criteria: expected a list.");
  }
  return [
    ...new Set(
      value
        .filter(
          (criterion): criterion is string => typeof criterion === "string",
        )
        .map((criterion) => criterion.trim().slice(0, 240))
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function safeParseJson(value: string | null, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
