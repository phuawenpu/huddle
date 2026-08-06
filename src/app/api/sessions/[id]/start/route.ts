import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await prisma.session.update({
      where: { id },
      data: { status: "active" },
    });
    return NextResponse.json({
      ...session,
      criteria: safeParseJson(session.criteria, []),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      status: "active",
    });
  } catch {
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
