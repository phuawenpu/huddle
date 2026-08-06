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

    const body = await request.json();
    const speakers = safeParseJson(scenario.speakersJson, []);

    // Update voice casting for specified speakers
    if (body.casting && Array.isArray(body.casting)) {
      for (const cast of body.casting) {
        const idx = speakers.findIndex((s: any) => s.index === cast.index);
        if (idx >= 0) {
          speakers[idx].voiceId = cast.voiceId || speakers[idx].voiceId;
          speakers[idx].accent = cast.accent || speakers[idx].accent;
          speakers[idx].timbreClass = cast.timbreClass || speakers[idx].timbreClass;
        }
      }
    }

    await prisma.scenario.update({
      where: { id },
      data: {
        speakersJson: JSON.stringify(speakers),
        status: "generated", // Reset to force re-synthesis
        preflightJson: null,
      },
    });

    return NextResponse.json({ speakers });
  } catch {
    return NextResponse.json({ error: "Failed to recast scenario" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
