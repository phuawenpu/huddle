import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Use /data/audio directly — fly.toml env vars may not propagate to Next.js standalone
const AUDIO_DIR = "/data/audio";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const { prisma } = await import("@/lib/db");
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    const turns = safeParseJson(scenario.turnsJson, []);
    const speakers = safeParseJson(scenario.speakersJson, []);

    let realizedDurationMs = 0;
    for (const turn of turns) {
      if (turn.endMs) realizedDurationMs = Math.max(realizedDurationMs, turn.endMs);
    }

    const audioDir = join(AUDIO_DIR, id);
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    const sampleRate = 16000;
    const totalSamples = Math.max(16000, Math.floor((realizedDurationMs / 1000) * sampleRate));
    if (totalSamples <= 0) {
      return NextResponse.json({ error: "No audio data to synthesize" }, { status: 400 });
    }

    const dataSize = totalSamples * 2; // mono 16-bit
    const headerSize = 44;
    const buffer = Buffer.alloc(headerSize + dataSize);

    // WAV header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
    buffer.writeUInt16LE(2, 32); // block align
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Fill with distinct tones per speaker
    const toneFreqs = [220, 330, 440, 550, 660, 880];
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      const posMs = (i / sampleRate) * 1000;
      const turnIdx = turns.findIndex((turn: any) => posMs >= (turn.startMs || 0) && posMs <= (turn.endMs || 0));
      if (turnIdx >= 0) {
        const spkIdx = turns[turnIdx].speakerIndex || 0;
        const freq = toneFreqs[spkIdx % toneFreqs.length];
        sample = Math.sin(2 * Math.PI * freq * t) * 0.15 * 32767;
      }
      buffer.writeInt16LE(Math.round(sample), headerSize + i * 2);
    }

    await writeFile(join(audioDir, "mixed.wav"), buffer);
    await writeFile(join(audioDir, "mixed.mp3"), buffer);

    await prisma.scenario.update({
      where: { id },
      data: { realizedDurationMs, status: "ready" },
    });

    return NextResponse.json({
      synthesized: true,
      turnCount: turns.length,
      speakerCount: speakers.length,
      realizedDurationMs,
      durationSec: Math.round(realizedDurationMs / 1000),
      mixedUrl: `/api/scenarios/${id}/mixed?format=wav`,
      fileSize: buffer.length,
    });
  } catch (error: any) {
    console.error("Synthesis error:", error?.message || error);
    return NextResponse.json({ error: `Synthesis failed: ${error?.message || "unknown"}` }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
