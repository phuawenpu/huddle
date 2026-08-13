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
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const turns = await prisma.transcriptTurn.findMany({
      where: { sessionId: id },
      orderBy: { receivedAtMs: "asc" },
    });
    return NextResponse.json(
      turns.map((t) => ({
        ...t,
        wordsJson: safeParseJson(t.wordsJson, null),
        analysis: safeParseJson(t.analysisJson, null),
        analysisJson: undefined,
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch turns" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await context.params;
  try {
    const body = await request.json();
    const providerSessionId = String(body.providerSessionId || "").trim();
    const revisions = Array.isArray(body.revisions) ? body.revisions : [];
    if (!providerSessionId || revisions.length === 0) {
      return NextResponse.json(
        { error: "A provider session and speaker revisions are required." },
        { status: 400 },
      );
    }

    const updatedTurns: any[] = [];
    for (const revision of revisions) {
      const providerTurnOrder = Number(revision?.turnOrder);
      if (!Number.isInteger(providerTurnOrder) || providerTurnOrder < 0) {
        continue;
      }
      const turns = await prisma.transcriptTurn.findMany({
        where: { sessionId, providerSessionId, providerTurnOrder },
        orderBy: { segmentIndex: "asc" },
      });
      for (const turn of turns) {
        const revisedWords = wordsWithinTurn(revision?.words, turn);
        const revisedLabel =
          dominantSpeakerLabel(revisedWords) ||
          normalizeSpeakerLabel(revision?.speakerLabel);
        const mapping = await prisma.speakerMapping.findUnique({
          where: {
            sessionId_speakerLabel: {
              sessionId,
              speakerLabel: revisedLabel,
            },
          },
        });
        const updated = await prisma.transcriptTurn.update({
          where: { id: turn.id },
          data: {
            providerSpeakerLabel: revisedLabel,
            participantId: mapping?.participantId ?? null,
            wordsJson:
              revisedWords.length > 0
                ? JSON.stringify(revisedWords)
                : turn.wordsJson,
            isUnknownSpeaker: isUnknownSpeakerLabel(revisedLabel),
            wasSpeakerRevised: true,
          },
        });
        updatedTurns.push(updated);
        broadcast(sessionId, turnUpdatedPatch(serializeTurn(updated)));
      }
    }

    if (updatedTurns.length > 0) await broadcastMetrics(sessionId);
    return NextResponse.json({ turns: updatedTurns.map(serializeTurn) });
  } catch (error) {
    console.error("Speaker revision persistence failed", {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to persist speaker revisions" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await context.params;
  try {
    const body = await request.json();
    const providerSessionId = String(body.providerSessionId || "").trim();
    const providerTurnOrder = Number(body.providerTurnOrder);
    const segmentIndex = Number(body.segmentIndex || 0);
    const suppliedText = String(body.currentText || body.originalText || "");
    if (
      !providerSessionId ||
      providerSessionId.length > 200 ||
      !Number.isInteger(providerTurnOrder) ||
      providerTurnOrder < 0 ||
      providerTurnOrder > 2_000_000 ||
      !Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      segmentIndex > 100
    ) {
      return NextResponse.json(
        { error: "Invalid transcription turn identifiers." },
        { status: 400 },
      );
    }
    if (suppliedText.length > 12_000) {
      return NextResponse.json(
        { error: "Transcription turn is too large." },
        { status: 413 },
      );
    }
    if (Array.isArray(body.wordsJson) && body.wordsJson.length > 1_000) {
      return NextResponse.json(
        { error: "Transcription word detail is too large." },
        { status: 413 },
      );
    }
    body.providerSessionId = providerSessionId;
    body.providerTurnOrder = providerTurnOrder;
    body.segmentIndex = segmentIndex;
    body.providerSpeakerLabel = String(body.providerSpeakerLabel || "")
      .trim()
      .slice(0, 64);
    body.currentText = suppliedText;
    body.originalText = suppliedText;

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
        const durationMs =
          (body.endMs || existing.endMs) - (body.startMs || existing.startMs);

        const updated = await prisma.transcriptTurn.update({
          where: { id: existing.id },
          data: {
            isFinal: true,
            currentText: text,
            wordsJson: body.wordsJson
              ? JSON.stringify(body.wordsJson)
              : existing.wordsJson,
            endMs: body.endMs || existing.endMs,
            isSubstantive: isSubstantiveTurn(text, durationMs),
          },
        });

        broadcast(sessionId, turnUpdatedPatch(serializeTurn(updated)));
        // Enqueue if newly substantive
        if (updated.isSubstantive && updated.isFinal) {
          enqueueTurn({
            id: updated.id,
            sessionId,
            speakerLabel: updated.providerSpeakerLabel,
            text: updated.currentText,
            receivedAtMs: updated.receivedAtMs,
            enqueuedAtEpochMs: Date.now(),
          });
        }
        broadcastMetrics(sessionId);
        return NextResponse.json(serializeTurn(updated));
      }
      return NextResponse.json(serializeTurn(existing));
    }

    const text = body.currentText || body.originalText || "";
    const durationMs = (body.endMs || 0) - (body.startMs || 0);
    const receivedAtMs = sessionRelativeMs(body.receivedAtMs, body.endMs || 0);

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
        receivedAtMs,
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
        enqueueTurn({
          id: turn.id,
          sessionId,
          speakerLabel: turn.providerSpeakerLabel,
          text: turn.currentText,
          receivedAtMs: turn.receivedAtMs,
          enqueuedAtEpochMs: Date.now(),
        });
        startWindowAnalysis(sessionId);
      }
      broadcastMetrics(sessionId);
    }

    return NextResponse.json(serializeTurn(turn), { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ ingested: true, duplicate: true });
    }
    console.error("Turn ingest failed", {
      sessionId,
      code: error?.code,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to ingest turn" },
      { status: 500 },
    );
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

    const typedTurns = turns.map((t) => ({
      ...t,
      participantId: t.participantId ?? undefined,
      wordsJson: safeParseJson(t.wordsJson, undefined) as any,
      analysis: safeParseJson(t.analysisJson, undefined) as any,
      analysisReceivedAtMs: t.analysisReceivedAtMs ?? undefined,
    })) as any;

    const metrics = calculateMetrics(typedTurns);
    publish(sessionId, metricsPatch(metrics), String(++eventIdCounter));
  } catch {
    /* metrics are best-effort */
  }
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
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function sessionRelativeMs(value: unknown, fallback: number): number {
  const numeric = value == null ? fallback : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 2_147_483_647) {
    throw new Error(
      "receivedAtMs must be non-negative session-relative milliseconds",
    );
  }
  return Math.round(numeric);
}

function normalizeSpeakerLabel(value: unknown): string {
  const label = String(value || "").trim();
  return label || "UNKNOWN";
}

function isUnknownSpeakerLabel(value: unknown): boolean {
  const label = normalizeSpeakerLabel(value).toUpperCase();
  return label === "UNKNOWN" || label === "PENDING" || label === "UNASSIGNED";
}

function wordsWithinTurn(
  words: unknown,
  turn: { startMs: number; endMs: number },
) {
  if (!Array.isArray(words)) return [];
  return words
    .map((word) => ({
      text: String(word?.text || word?.word || ""),
      start: Number(word?.start) || 0,
      end: Number(word?.end) || 0,
      confidence: Number(word?.confidence) || 0,
      wordIsFinal: true,
      speaker: normalizeSpeakerLabel(word?.speaker),
    }))
    .filter(
      (word) =>
        word.text && word.end >= turn.startMs && word.start <= turn.endMs,
    );
}

function dominantSpeakerLabel(
  words: Array<{ speaker: string }>,
): string | null {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (isUnknownSpeakerLabel(word.speaker)) continue;
    counts.set(word.speaker, (counts.get(word.speaker) || 0) + 1);
  }
  return (
    [...counts.entries()].sort(
      ([leftLabel, leftCount], [rightLabel, rightCount]) =>
        rightCount - leftCount || leftLabel.localeCompare(rightLabel),
    )[0]?.[0] || null
  );
}
