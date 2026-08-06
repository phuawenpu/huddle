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
    if (body.category !== undefined) data.category = body.category;
    if (body.text !== undefined) data.text = body.text;
    if (body.status !== undefined) data.status = body.status;
    if (body.turnIds !== undefined) data.turnIds = JSON.stringify(body.turnIds);

    const item = await prisma.discussionItem.update({ where: { id }, data });
    return NextResponse.json(serializeItem(item));
  } catch {
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    await prisma.discussionItem.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}

function serializeItem(i: any) {
  return {
    ...i,
    turnIds: safeParseJson(i.turnIds, []),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
