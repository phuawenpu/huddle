import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";

function audioRoot() {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}

export async function GET() {
  try {
    const scenarios = await prisma.scenario.findMany({
      where: { 
        status: { in: ["generated", "ready", "approved"] },
        turnsJson: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        speakerCount: true,
        crossTalkLevel: true,
        difficulty: true,
        status: true,
        speakersJson: true,
        turnsJson: true,
        createdAt: true,
      },
    });

    const recordings = scenarios.map(s => {
      const hasAudio = hasValidatedAudio(s.id);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        durationMinutes: s.durationMinutes,
        speakerCount: s.speakerCount,
        crossTalkLevel: s.crossTalkLevel,
        difficulty: s.difficulty,
        status: hasAudio ? s.status : "incomplete",
        speakers: safeParse(s.speakersJson),
        turnCount: safeParse(s.turnsJson)?.length || 0,
        createdAt: s.createdAt,
        mixedUrl: hasAudio
          ? `/api/scenarios/${s.id}/mixed?format=wav`
          : null,
      };
    });

    // Also include uploaded recordings
    const uploads = await prisma.scenario.findMany({
      where: { topic: "uploaded_recording" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        status: true,
      },
    });

    const uploadedRecordings = uploads.map(u => ({
      id: u.id,
      title: u.title,
      description: u.description,
      durationMinutes: 0,
      speakerCount: 0,
      crossTalkLevel: "none",
      difficulty: "simple",
      status: u.status,
      speakers: [],
      turnCount: 0,
      createdAt: u.createdAt,
      mixedUrl: `/api/assets/uploads/${u.id}`,
      source: "upload",
    }));

    return NextResponse.json([...recordings, ...uploadedRecordings]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to list recordings" }, { status: 500 });
  }
}

function safeParse(val: any) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return null; }
}

function hasValidatedAudio(id: string) {
  const dir = join(audioRoot(), id);
  if (
    !existsSync(join(dir, "mixed.wav")) ||
    !existsSync(join(dir, "manifest.json"))
  ) {
    return false;
  }
  try {
    const validation = JSON.parse(
      readFileSync(join(dir, "validation.json"), "utf8")
    );
    return process.env.TTS_STUB === "1"
      ? validation?.method === "tone_fixture"
      : validation?.method === "independent_asr" &&
          validation?.speechExpected === true &&
          validation?.passed === true;
  } catch {
    return false;
  }
}
