import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json(serializeRun(run));
  } catch {
    return NextResponse.json({ error: "Failed to get run" }, { status: 500 });
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
    if (body.status !== undefined) data.status = body.status;
    if (body.playbackEvents !== undefined) data.playbackEventsJson = JSON.stringify(body.playbackEvents);
    if (body.evaluation !== undefined) data.evaluationJson = JSON.stringify(body.evaluation);
    if (body.deviations !== undefined) data.deviationsJson = JSON.stringify(body.deviations);

    const run = await prisma.run.update({ where: { id }, data });
    return NextResponse.json(serializeRun(run));
  } catch {
    return NextResponse.json({ error: "Failed to update run" }, { status: 500 });
  }
}

function serializeRun(r: any) {
  return {
    ...r,
    playbackEvents: safeParseJson(r.playbackEventsJson, null),
    evaluation: safeParseJson(r.evaluationJson, null),
    deviations: safeParseJson(r.deviationsJson, []),
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
