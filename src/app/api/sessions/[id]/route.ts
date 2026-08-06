import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(serializeSession(session));
  } catch {
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.objective !== undefined) data.objective = body.objective;
    if (body.phase !== undefined) data.phase = body.phase;
    if (body.criteria !== undefined) data.criteria = JSON.stringify(body.criteria);
    if (body.speakerCount !== undefined) data.speakerCount = body.speakerCount;
    if (body.status !== undefined) data.status = body.status;

    const session = await prisma.session.update({ where: { id }, data });
    return NextResponse.json(serializeSession(session));
  } catch {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    await prisma.session.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

function serializeSession(s: any) {
  return {
    ...s,
    criteria: safeParseJson(s.criteria, []),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
