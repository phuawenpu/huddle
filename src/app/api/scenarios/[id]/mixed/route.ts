import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const AUDIO_DIR = "/data/audio";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "wav";
  const isMp3 = format === "mp3";
  const ext = isMp3 ? "mp3" : "wav";
  const filePath = join(AUDIO_DIR, id, `mixed.${ext}`);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Audio not synthesized yet. Run synthesis first." }, { status: 404 });
  }

  const stat = statSync(filePath);
  const contentType = isMp3 ? "audio/mpeg" : "audio/wav";
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    const buffer = readFileSync(filePath).subarray(start, end + 1);

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

  const buffer = readFileSync(filePath);
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
