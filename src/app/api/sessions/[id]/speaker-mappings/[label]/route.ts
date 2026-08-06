import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; label: string }> }
) {
  const { id, label } = await context.params;
  try {
    const body = await request.json();
    const mapping = await prisma.speakerMapping.update({
      where: { sessionId_speakerLabel: { sessionId: id, speakerLabel: label } },
      data: { participantId: body.participantId || null },
    });
    return NextResponse.json(mapping);
  } catch {
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}
