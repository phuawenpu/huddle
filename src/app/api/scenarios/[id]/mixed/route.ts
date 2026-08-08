import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";
import {
  hasValidatedScenarioAudio,
  scenarioAudioDirectory,
} from "@/lib/scenario-audio";
import { transcriptFingerprint } from "@/lib/scenario-transcript";
import type { ScenarioSpeaker, ScenarioTurn } from "@/lib/types";


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return serveAudio(request, context, false);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return serveAudio(request, context, true);
}

async function serveAudio(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  headOnly: boolean
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "wav";
  const isMp3 = format === "mp3";
  const ext = isMp3 ? "mp3" : "wav";
  const scenarioDir = scenarioAudioDirectory(id);
  const filePath = join(scenarioDir, `mixed.${ext}`);

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }
  const speakers = safeParse<ScenarioSpeaker[]>(scenario.speakersJson, []);
  const turns = safeParse<ScenarioTurn[]>(scenario.turnsJson, []);
  const expectedFingerprint = transcriptFingerprint(speakers, turns);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Audio not synthesized yet. Run synthesis first." }, { status: 404 });
  }
  if (!hasValidatedScenarioAudio(id, expectedFingerprint)) {
    return NextResponse.json(
      {
        error:
          "This is legacy or unvalidated audio. Re-synthesize the scenario before playback.",
      },
      { status: 409 }
    );
  }

  const stat = statSync(filePath);
  const contentType = isMp3 ? "audio/mpeg" : "audio/wav";
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    const buffer = headOnly
      ? null
      : readFileSync(filePath).subarray(start, end + 1);

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(chunkSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const buffer = headOnly ? null : readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="mixed.${ext}"`,
    },
  });
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
