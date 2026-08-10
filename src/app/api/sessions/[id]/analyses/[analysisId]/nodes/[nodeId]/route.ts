import { NextRequest, NextResponse } from "next/server";
import { databaseReady, prisma } from "@/lib/db";
import { serializeLiveAnalysis } from "@/lib/live-analysis-record";
import { publish } from "@/lib/pubsub";
import { liveAnalysisPatch } from "@/lib/sse";
import type {
  LiveAnalysisResult,
  MeetingNodeStatus,
  MeetingStateNode,
} from "@/lib/types";

const STATUSES = new Set<MeetingNodeStatus>([
  "open",
  "exploring",
  "proposed",
  "accepted",
  "rejected",
  "committed",
  "done",
]);

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; analysisId: string; nodeId: string }>;
  },
) {
  const { id, analysisId, nodeId } = await context.params;
  await databaseReady;
  try {
    const body = await request.json();
    const source = await prisma.liveAnalysis.findFirst({
      where: { id: analysisId, sessionId: id },
    });
    if (!source) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
    const result = safeParseJson(source.resultJson, null) as LiveAnalysisResult | null;
    const state = result?.meetingState;
    const existing = state?.nodes.find((node) => node.id === nodeId);
    if (!result || !state || !existing) {
      return NextResponse.json({ error: "Meeting-state node not found" }, { status: 404 });
    }

    const updated: MeetingStateNode = {
      ...existing,
      title: boundedText(body.title, existing.title, 100),
      summary: boundedText(body.summary, existing.summary, 500),
      status: STATUSES.has(body.status) ? body.status : existing.status,
      owner:
        body.owner === null
          ? undefined
          : body.owner === undefined
            ? existing.owner
            : boundedText(body.owner, "", 80) || undefined,
      origin: "human_edit",
      confidence: 1,
    };
    const nextResult: LiveAnalysisResult = {
      ...result,
      meetingState: {
        ...state,
        revision: state.revision + 1,
        previousSnapshotId: source.id,
        nodes: state.nodes.map((node) => (node.id === nodeId ? updated : node)),
        changes: {
          addedNodeIds: [],
          retainedNodeIds: state.nodes.map((node) => node.id),
          strengthenedNodeIds: [],
          removedNodeIds: [],
          humanEditedNodeIds: [nodeId],
        },
      },
    };
    const record = await prisma.liveAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: source.sessionId,
        objective: source.objective,
        phase: source.phase,
        criteria: source.criteria,
        transcriptTurnCount: source.transcriptTurnCount,
        transcriptWordCount: source.transcriptWordCount,
        transcriptThroughMs: source.transcriptThroughMs,
        firstTurnId: source.firstTurnId,
        lastTurnId: source.lastTurnId,
        visualEvidenceCount: source.visualEvidenceCount,
        resultJson: JSON.stringify(nextResult),
      },
    });
    const snapshot = serializeLiveAnalysis(record);
    publish(id, liveAnalysisPatch(snapshot));
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error("Meeting-state edit failed:", error);
    return NextResponse.json(
      { error: "Failed to save the meeting-state revision" },
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
