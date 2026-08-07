import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

    // Generate mock WAV file for each scenario
    const audioDir = join(process.cwd(), process.env.ASSET_DIR || "./data/audio", scenario.id);
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    // Create a proper WAV file from the scenario data
    // In stub mode: generate synthetic audio based on turn durations
    const sampleRate = 16000;
    const bitsPerSample = 16;
    const numChannels = 1;
    
    // For stub: create silence-based WAV with correct duration
    const totalSamples = Math.max(16000, Math.floor((realizedDurationMs / 1000) * sampleRate));
    const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
    const headerSize = 44;
    const buffer = Buffer.alloc(headerSize + dataSize);

    // WAV header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Fill with stereo test tone pattern to make it recognizable
    const toneFreqs = [220, 330, 440, 550, 660, 880]; // A3, E4, A4, C#5, E5, A5
    for (let i = 0; i < totalSamples; i++) {
      const turnIdx = turns.findIndex((t: any) => 
        i >= (t.startMs / 1000) * sampleRate && i <= (t.endMs / 1000) * sampleRate
      );
      const spkIdx = turnIdx >= 0 ? (turns[turnIdx].speakerIndex || 0) : 0;
      const freq = toneFreqs[spkIdx % toneFreqs.length];
      const t = i / sampleRate;
      const amplitude = 0.15; // Low volume to avoid clipping
      const sample = Math.sin(2 * Math.PI * freq * t) * amplitude * 32767;
      buffer.writeInt16LE(Math.round(sample), headerSize + i * 2);
    }

    // Write WAV file
    const wavPath = join(audioDir, "mixed.wav");
    await writeFile(wavPath, buffer);

    // Also create an MP3-style naming for metered connections (just a copy for stub)
    const mp3Path = join(audioDir, "mixed.mp3");
    await writeFile(mp3Path, buffer);

    // Create manifest
    const manifest = {
      scenarioId: id,
      title: scenario.title,
      speakerCount: speakers.length,
      turnCount: turns.length,
      durationMs: realizedDurationMs,
      sampleRate,
      format: "PCM16",
      channels: numChannels,
      mixedUrl: `/api/assets/${scenario.id}/mixed.wav`,
      mp3Url: `/api/assets/${scenario.id}/mixed.mp3`,
      synthesizedAt: new Date().toISOString(),
      stubbed: process.env.TTS_STUB === "1",
    };
    await writeFile(join(audioDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Update scenario status
    await prisma.scenario.update({
      where: { id },
      data: {
        realizedDurationMs,
        status: "ready",
      },
    });

    return NextResponse.json({
      synthesized: true,
      turnCount: turns.length,
      speakerCount: speakers.length,
      realizedDurationMs,
      durationSec: Math.round(realizedDurationMs / 1000),
      mixedUrl: manifest.mixedUrl,
      mp3Url: manifest.mp3Url,
      fileSize: buffer.length,
      stubbed: process.env.TTS_STUB === "1",
    });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json({ error: "Synthesis failed" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
