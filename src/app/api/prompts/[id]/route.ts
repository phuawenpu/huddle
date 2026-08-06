import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.shown !== undefined) data.shown = body.shown;
    if (body.dismissed !== undefined) data.dismissed = body.dismissed;

    const prompt = await prisma.promptRecord.update({ where: { id }, data });
    return NextResponse.json(prompt);
  } catch {
    return NextResponse.json({ error: "Failed to update prompt" }, { status: 500 });
  }
}
