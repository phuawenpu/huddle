import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await prisma.session.create({
      data: {
        title: body.title || "Untitled Session",
        objective: body.objective || "",
        phase: body.phase || "frame",
        criteria: JSON.stringify(body.criteria || []),
        speakerCount: body.speakerCount || 4,
        status: "setup",
        runMode: body.runMode || "live",
        scenarioId: body.scenarioId || null,
      },
    });
    return NextResponse.json(serializeSession(session), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(sessions.map(serializeSession));
  } catch (error) {
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
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
