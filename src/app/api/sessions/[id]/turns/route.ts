import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    })));
  } catch {
    return NextResponse.json({ error: "Failed to fetch turns" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
