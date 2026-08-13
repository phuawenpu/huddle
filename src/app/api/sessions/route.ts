import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await prisma.session.create({
      data: {
        title: boundedText(body.title, "Untitled Session", 200),
        objective: boundedText(body.objective, "", 500),
        phase: boundedText(body.phase, "frame", 40),
        criteria: JSON.stringify(normalizeCriteria(body.criteria)),
        speakerCount: Math.max(2, Math.min(10, Number(body.speakerCount) || 4)),
        status: "setup",
        runMode: body.runMode || "live",
        scenarioId: body.scenarioId || null,
      },
    });
    return NextResponse.json(serializeSession(session), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}

function boundedText(value: unknown, fallback: string, max: number) {
  return (typeof value === "string" ? value.trim() : fallback).slice(0, max);
}

function normalizeCriteria(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 12)
    : [];
}

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(sessions.map(serializeSession));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 },
    );
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
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
