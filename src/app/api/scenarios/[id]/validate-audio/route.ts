import { readFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { validateRenderedSpeech } from "@/lib/audio-validation";
import type { AudioManifest } from "@/lib/audio-pipeline";

export const maxDuration = 300;

function audioRoot() {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const manifest = JSON.parse(
      await readFile(join(audioRoot(), id, "manifest.json"), "utf8")
    ) as AudioManifest;
    const validation = await validateRenderedSpeech(manifest);
    return NextResponse.json({ validation });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Audio validation failed" },
      { status: 500 }
    );
  }
}
