import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    // In stub mode, generate a minimal WAV header
    const isStub = process.env.TTS_STUB === "1";
    const isMp3 = request.url.includes(".mp3");

    if (isStub) {
      // Generate a minimal valid WAV file (1 second of silence, 16kHz mono 16-bit)
      const sampleRate = 16000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const durationSec = 1;
      const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * durationSec;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      // WAV header
      writeString(view, 0, "RIFF");
      view.setUint32(4, 36 + dataSize, true);
      writeString(view, 8, "WAVE");
      writeString(view, 12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
      view.setUint16(32, numChannels * (bitsPerSample / 8), true);
      view.setUint16(34, bitsPerSample, true);
      writeString(view, 36, "data");
      view.setUint32(40, dataSize, true);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": isMp3 ? "audio/mpeg" : "audio/wav",
          "Content-Disposition": `attachment; filename="${scenario.title.replace(/[^a-zA-Z0-9]/g, "_")}.${isMp3 ? "mp3" : "wav"}"`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    return NextResponse.json({ error: "Mixed audio not available (TTS stub not active)" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to get mixed audio" }, { status: 500 });
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
