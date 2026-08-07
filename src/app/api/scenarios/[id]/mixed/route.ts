import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const isMp3 = request.url.includes(".mp3");
  const ext = isMp3 ? "mp3" : "wav";

  const assetDir = process.env.ASSET_DIR || "./data/audio";
  const filePath = join(process.cwd(), assetDir, id, `mixed.${ext}`);

  try {
    if (!existsSync(filePath)) {
      console.error(`Mixed audio not found: ${filePath}`);
      return NextResponse.json({ error: "Audio not synthesized yet" }, { status: 404 });
    }

    const stat = statSync(filePath);
    const rangeHeader = request.headers.get("range");
    const contentType = isMp3 ? "audio/mpeg" : "audio/wav";

    if (rangeHeader) {
      const parts = rangeHeader.replace("bytes=", "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const buffer = readFileSync(filePath);
      const slice = buffer.subarray(start, end + 1);

      return new NextResponse(slice, {
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
  } catch (error) {
    console.error("Error serving mixed audio:", error);
    return NextResponse.json({ error: "Failed to serve audio" }, { status: 500 });
  }
}
