import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.currentText !== undefined) {
      data.currentText = body.currentText;
      data.isManuallyCorrected = true;
    }
    if (body.participantId !== undefined) data.participantId = body.participantId;

    const turn = await prisma.transcriptTurn.update({ where: { id }, data });
    return NextResponse.json(serializeTurn(turn));
  } catch {
    return NextResponse.json({ error: "Failed to update turn" }, { status: 500 });
  }
}

function serializeTurn(t: any) {
  return {
    ...t,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysisJson: safeParseJson(t.analysisJson, null),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
