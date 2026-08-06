import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const participant = await prisma.participant.create({
      data: {
        sessionId: id,
        displayName: body.displayName || `Speaker ${Date.now()}`,
        role: body.role || "reviewer",
        isHidden: body.isHidden || false,
      },
    });
    return NextResponse.json(participant, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create participant" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const participants = await prisma.participant.findMany({
      where: { sessionId: id },
    });
    return NextResponse.json(participants);
  } catch {
    return NextResponse.json({ error: "Failed to list participants" }, { status: 500 });
  }
}
