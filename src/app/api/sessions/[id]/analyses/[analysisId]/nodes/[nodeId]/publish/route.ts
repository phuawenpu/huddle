import { NextRequest, NextResponse } from "next/server";
import { databaseReady, prisma } from "@/lib/db";
import { publish } from "@/lib/pubsub";
import { mapPatch } from "@/lib/sse";
import type { LiveAnalysisResult } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; analysisId: string; nodeId: string }>;
  },
) {
  const { id, analysisId, nodeId } = await context.params;
  await databaseReady;
  try {
    const body = await request.json().catch(() => ({}));
    const analysis = await prisma.liveAnalysis.findFirst({
      where: { id: analysisId, sessionId: id },
    });
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
    const result = safeParseJson(analysis.resultJson, null) as LiveAnalysisResult | null;
    const node = result?.meetingState?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return NextResponse.json({ error: "Meeting-state node not found" }, { status: 404 });
    }

    if (node.origin !== "facilitator_intent") {
      const sources = await prisma.transcriptTurn.findMany({
        where: { sessionId: id, id: { in: node.supportingTurnIds } },
        select: { id: true, currentText: true },
      });
      const currentById = new Map(sources.map((turn) => [turn.id, turn.currentText]));
      const stale =
        node.sourceQuotes.length === 0 ||
        node.sourceQuotes.some(
          (source) => !currentById.get(source.turnId)?.includes(source.quote),
        );
      if (stale) {
        return NextResponse.json(
          {
            error:
              "This node no longer matches the corrected transcript. Run synthesis again before publishing.",
          },
          { status: 409 },
        );
      }
    }

    const editedText = boundedText(body.text, "", 600);
    const text = editedText || `${node.title} — ${node.summary}`;
    const item = await prisma.discussionItem.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: id,
        category: node.kind,
        text,
        status: "published",
        turnIds: JSON.stringify(node.supportingTurnIds),
      },
    });
    const serialized = {
      ...item,
      turnIds: node.supportingTurnIds,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
    publish(id, mapPatch(serialized));
    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error("Meeting-state publication failed:", error);
    return NextResponse.json(
      { error: "Failed to publish the meeting-state node" },
      { status: 500 },
    );
  }
}

function boundedText(value: unknown, fallback: string, maximum: number) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text ? text.slice(0, maximum) : fallback;
}

function safeParseJson(value: string | null, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
