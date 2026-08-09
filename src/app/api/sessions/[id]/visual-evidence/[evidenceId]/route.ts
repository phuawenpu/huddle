import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";
import { prisma, databaseReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const { id, evidenceId } = await context.params;
  await databaseReady;
  const evidence = await prisma.visualEvidence.findFirst({
    where: { id: evidenceId, sessionId: id },
  });
  if (!evidence) {
    return NextResponse.json(
      { error: "Visual evidence not found" },
      { status: 404 },
    );
  }

  const assetRoot = resolve(
    process.cwd(),
    process.env.ASSET_DIR || "./data/audio",
  );
  const path = resolve(assetRoot, evidence.storageKey);
  if (!path.startsWith(`${assetRoot}${sep}`)) {
    return NextResponse.json(
      { error: "Invalid evidence path" },
      { status: 400 },
    );
  }
  try {
    const bytes = await readFile(path);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": evidence.contentType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Visual evidence file is unavailable" },
      { status: 404 },
    );
  }
}
