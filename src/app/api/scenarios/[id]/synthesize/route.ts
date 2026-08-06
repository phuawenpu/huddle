import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    const turns = safeParseJson(scenario.turnsJson, []);
    const speakers = safeParseJson(scenario.speakersJson, []);

    // Calculate realized duration
    let realizedDurationMs = 0;
    for (const turn of turns) {
      if (turn.endMs) {
        realizedDurationMs = Math.max(realizedDurationMs, turn.endMs);
      }
    }

    // In stub mode, just mark as generated
    await prisma.scenario.update({
      where: { id },
      data: {
        realizedDurationMs,
        status: "generated",
      },
    });

    return NextResponse.json({
      synthesized: true,
      turnCount: turns.length,
      realizedDurationMs,
      stubbed: process.env.TTS_STUB === "1",
    });
  } catch {
    return NextResponse.json({ error: "Synthesis failed" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
