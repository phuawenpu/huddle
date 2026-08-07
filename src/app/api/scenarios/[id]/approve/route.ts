import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const existing = await prisma.scenario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    const preflight = safeParseJson(existing.preflightJson, null);
    if (existing.status !== "ready" || !preflight?.passed || !preflight?.audioAvailable) {
      return NextResponse.json(
        {
          error:
            "Scenario cannot be approved until real audio is rendered and preflight passes.",
        },
        { status: 409 }
      );
    }
    const scenario = await prisma.scenario.update({
      where: { id },
      data: { status: "approved", approvedAt: new Date() },
    });
    return NextResponse.json(serializeScenario(scenario));
  } catch {
    return NextResponse.json({ error: "Failed to approve scenario" }, { status: 500 });
  }
}

function serializeScenario(s: any) {
  return {
    ...s,
    criteria: safeParseJson(s.criteria, []),
    budget: safeParseJson(s.budgetJson, null),
    speakers: safeParseJson(s.speakersJson, null),
    turns: safeParseJson(s.turnsJson, null),
    preflight: safeParseJson(s.preflightJson, null),
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
    approvedAt: s.approvedAt?.toISOString() || null,
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
