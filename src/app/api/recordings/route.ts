import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidatedScenarioAudio } from "@/lib/scenario-audio";
import { transcriptFingerprint } from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";


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
      const speakers = safeParse(s.speakersJson) as ScenarioSpeaker[] | null;
      const turns = safeParse(s.turnsJson) as ScenarioTurn[] | null;
      const fingerprint = transcriptFingerprint(speakers || [], turns || []);
      const hasAudio = hasValidatedScenarioAudio(s.id, fingerprint);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        durationMinutes: s.durationMinutes,
        speakerCount: s.speakerCount,
        crossTalkLevel: s.crossTalkLevel,
        difficulty: s.difficulty,
        status: hasAudio ? s.status : "incomplete",
        speakers,
        turnCount: turns?.length || 0,
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
        expectedWindowOutcomeJson: true,
      },
    });

    const uploadedRecordings = uploads.map(u => {
      const metadata = safeParse(u.expectedWindowOutcomeJson) || {};
      return {
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
        mixedUrl: metadata.filename
          ? `/api/assets/uploads/${encodeURIComponent(metadata.filename)}`
          : null,
        source: "upload",
      };
    });

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
