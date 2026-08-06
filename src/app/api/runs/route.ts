import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const run = await prisma.run.create({
      data: {
        sessionId: body.sessionId,
        scenarioId: body.scenarioId || null,
        mode: body.mode || "sim_injected",
        stubbed: process.env.ASR_STUB === "1" || process.env.LLM_STUB === "1",
        status: "created",
      },
    });
    return NextResponse.json(serializeRun(run), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    const where: any = {};
    if (sessionId) where.sessionId = sessionId;

    const runs = await prisma.run.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(runs.map(serializeRun));
  } catch {
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
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
