import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueTurn, startWindowAnalysis } from "@/lib/analysis-queue";
import { publish } from "@/lib/pubsub";
import { turnFinalPatch, turnUpdatedPatch, metricsPatch } from "@/lib/sse";
import { isSubstantiveTurn } from "@/lib/utils";
import { calculateMetrics } from "@/lib/metrics";
import type { SSEPatch } from "@/lib/types";

let eventIdCounter = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const turns = await prisma.transcriptTurn.findMany({
      where: { sessionId: id },
      orderBy: { receivedAtMs: "asc" },
    });
    return NextResponse.json(turns.map(t => ({
      ...t,
      wordsJson: safeParseJson(t.wordsJson, null),
      analysis: safeParseJson(t.analysisJson, null),
      analysisJson: undefined,
    })));
  } catch {
    return NextResponse.json({ error: "Failed to fetch turns" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params;
  try {
    const body = await request.json();

    const existing = await prisma.transcriptTurn.findUnique({
      where: {
        providerSessionId_providerTurnOrder_segmentIndex: {
          providerSessionId: body.providerSessionId,
          providerTurnOrder: body.providerTurnOrder,
          segmentIndex: body.segmentIndex || 0,
        },
      },
    });

    if (existing) {
      if (body.isFinal && !existing.isFinal) {
        const text = body.currentText || existing.currentText;
        const durationMs = (body.endMs || existing.endMs) - (body.startMs || existing.startMs);
        
        const updated = await prisma.transcriptTurn.update({
          where: { id: existing.id },
          data: {
            isFinal: true,
            currentText: text,
            wordsJson: body.wordsJson ? JSON.stringify(body.wordsJson) : existing.wordsJson,
            endMs: body.endMs || existing.endMs,
            isSubstantive: isSubstantiveTurn(text, durationMs),
          },
        });

        broadcast(sessionId, turnUpdatedPatch(serializeTurn(updated)));
        // Enqueue if newly substantive
        if (updated.isSubstantive && updated.isFinal) {
          enqueueTurn({ id: updated.id, sessionId, speakerLabel: updated.providerSpeakerLabel, text: updated.currentText });
        }
        broadcastMetrics(sessionId);
        return NextResponse.json(serializeTurn(updated));
      }
      return NextResponse.json(serializeTurn(existing));
    }

    const text = body.currentText || body.originalText || "";
    const durationMs = (body.endMs || 0) - (body.startMs || 0);

    const turn = await prisma.transcriptTurn.create({
      data: {
        sessionId,
        providerSessionId: body.providerSessionId,
        providerTurnOrder: body.providerTurnOrder,
        segmentIndex: body.segmentIndex || 0,
        providerSpeakerLabel: body.providerSpeakerLabel || "",
        originalProviderSpeakerLabel: body.providerSpeakerLabel || "",
        startMs: body.startMs || 0,
        endMs: body.endMs || 0,
        receivedAtMs: body.receivedAtMs || Date.now(),
        originalText: text,
        currentText: text,
        wordsJson: body.wordsJson ? JSON.stringify(body.wordsJson) : null,
        isCalibration: body.isCalibration || false,
        isFinal: body.isFinal || false,
        isSubstantive: isSubstantiveTurn(text, durationMs),
        isUnknownSpeaker: body.isUnknownSpeaker || false,
        possibleOverlap: body.possibleOverlap || false,
        wasSpeakerRevised: false,
        isManuallyCorrected: false,
      },
    });

    if (body.isFinal) {
      broadcast(sessionId, turnFinalPatch(serializeTurn(turn)));
    // Enqueue for LLM analysis if substantive
    if (turn.isSubstantive && turn.isFinal) {
      enqueueTurn({ id: turn.id, sessionId, speakerLabel: turn.providerSpeakerLabel, text: turn.currentText });
      startWindowAnalysis(sessionId);
    }
      broadcastMetrics(sessionId);
    }

    return NextResponse.json(serializeTurn(turn), { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ ingested: true, duplicate: true });
    }
    return NextResponse.json({ error: "Failed to ingest turn" }, { status: 500 });
  }
}

function broadcast(sessionId: string, patch: SSEPatch) {
  publish(sessionId, patch, String(++eventIdCounter));
}

async function broadcastMetrics(sessionId: string) {
  try {
    const turns = await prisma.transcriptTurn.findMany({
      where: { sessionId, isFinal: true },
    });
    
    const typedTurns = turns.map(t => ({
      ...t,
      participantId: t.participantId ?? undefined,
      wordsJson: safeParseJson(t.wordsJson, undefined) as any,
      analysis: safeParseJson(t.analysisJson, undefined) as any,
      analysisReceivedAtMs: t.analysisReceivedAtMs ?? undefined,
    })) as any;

    const metrics = calculateMetrics(typedTurns);
    publish(sessionId, metricsPatch(metrics), String(++eventIdCounter));
  } catch { /* metrics are best-effort */ }
}

function serializeTurn(t: any) {
  return {
    ...t,
    participantId: t.participantId ?? undefined,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysis: safeParseJson(t.analysisJson, null),
    analysisJson: undefined,
    session: undefined,
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
