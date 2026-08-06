import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key } = await context.params;
  const assetPath = join(process.cwd(), process.env.ASSET_DIR || "./data/audio", ...key);

  try {
    if (!existsSync(assetPath)) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const stat = statSync(assetPath);
    const rangeHeader = request.headers.get("range");

    // Determine content type
    const ext = assetPath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      wav: "audio/wav",
      mp3: "audio/mpeg",
      json: "application/json",
      txt: "text/plain",
    };
    const contentType = mimeTypes[ext || ""] || "application/octet-stream";

    if (rangeHeader) {
      const parts = rangeHeader.replace("bytes=", "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const buffer = readFileSync(assetPath);
      const slice = buffer.subarray(start, end + 1);

      return new NextResponse(slice, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
        },
      });
    }

    const buffer = readFileSync(assetPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve asset" }, { status: 500 });
  }
}
