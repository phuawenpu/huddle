import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const AUDIO_DIR = "/data/audio";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const { prisma } = await import("@/lib/db");
    const s = await prisma.scenario.findUnique({ where: { id } });
    if (!s) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    const turns = safeParse(s.turnsJson, []);
    const speakers = safeParse(s.speakersJson, []);

    let realizedMs = 0;
    for (const t of turns) {
      if (t.endMs) realizedMs = Math.max(realizedMs, t.endMs);
    }

    const dir = join(AUDIO_DIR, id);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    const sr = 16000;
    const samples = Math.max(sr, Math.floor((realizedMs / 1000) * sr));
    if (samples <= 0) {
      return NextResponse.json({ error: "No audio to synthesize" }, { status: 400 });
    }

    const dataBytes = samples * 2; // mono int16
    const buf = Buffer.alloc(44 + dataBytes);

    // WAV header
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataBytes, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);        // PCM
    buf.writeUInt16LE(1, 22);        // mono
    buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 2, 28);   // byte rate
    buf.writeUInt16LE(2, 32);        // block align
    buf.writeUInt16LE(16, 34);       // bits
    buf.write("data", 36);
    buf.writeUInt32LE(dataBytes, 40);

    // Distinct audible tones per speaker — loud enough to hear clearly
    const hz = [220, 330, 440, 550, 660, 880]; // A3, E4, A4, C#5, E5, A5
    const amp = 0.5; // 50% amplitude — clearly audible

    for (let i = 0; i < samples; i++) {
      const posMs = (i / sr) * 1000;
      const ti = turns.findIndex((t: any) => posMs >= (t.startMs || 0) && posMs <= (t.endMs || 0));
      let val = 0;
      if (ti >= 0) {
        const si = turns[ti].speakerIndex || 0;
        const freq = hz[si % hz.length];
        val = Math.sin(2 * Math.PI * freq * i / sr) * amp * 32767;
      }
      buf.writeInt16LE(Math.round(val), 44 + i * 2);
    }

    await writeFile(join(dir, "mixed.wav"), buf);
    await writeFile(join(dir, "mixed.mp3"), buf);

    await prisma.scenario.update({
      where: { id },
      data: { realizedDurationMs: realizedMs, status: "ready" },
    });

    return NextResponse.json({
      synthesized: true,
      turnCount: turns.length,
      speakerCount: speakers.length,
      realizedDurationMs: realizedMs,
      durationSec: Math.round(realizedMs / 1000),
      mixedUrl: `/api/scenarios/${id}/mixed?format=wav`,
      fileSize: buf.length,
    });
  } catch (e: any) {
    console.error("Synthesis error:", e?.message || e);
    return NextResponse.json({ error: `Synthesis failed: ${e?.message || "unknown"}` }, { status: 500 });
  }
}

function safeParse(val: string | null, fb: any) {
  if (!val) return fb;
  try { return JSON.parse(val); } catch { return fb; }
}
