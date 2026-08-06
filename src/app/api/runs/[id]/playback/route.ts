import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    await prisma.run.update({
      where: { id },
      data: { status: "playing" },
    });

    return NextResponse.json({ status: "playing", runId: id });
  } catch {
    return NextResponse.json({ error: "Failed to start playback" }, { status: 500 });
  }
}
