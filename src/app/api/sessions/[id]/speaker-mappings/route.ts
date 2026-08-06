import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const mappings = await prisma.speakerMapping.findMany({
      where: { sessionId: id },
    });
    return NextResponse.json(mappings);
  } catch {
    return NextResponse.json({ error: "Failed to get mappings" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const mapping = await prisma.speakerMapping.create({
      data: {
        sessionId: id,
        speakerLabel: body.speakerLabel,
        participantId: body.participantId || null,
      },
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
  }
}
