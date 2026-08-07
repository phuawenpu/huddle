import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VOICE_CASTING_POOL } from "@/lib/voice-casting";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    const speakers = safeParseJson(scenario.speakersJson, null);
    if (!speakers) {
      return NextResponse.json({ voices: VOICE_CASTING_POOL, cast: null });
    }

    // Return current cast plus available voices
    const usedVoiceIds = new Set(speakers.map((s: any) => s.voiceId));
    const availableVoices = VOICE_CASTING_POOL.filter(v => !usedVoiceIds.has(v.voiceId));

    return NextResponse.json({
      cast: speakers,
      availableVoices,
      allVoices: VOICE_CASTING_POOL,
    });
  } catch {
    return NextResponse.json({ error: "Failed to get voices" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
