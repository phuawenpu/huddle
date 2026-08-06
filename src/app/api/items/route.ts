import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = await prisma.discussionItem.create({
      data: {
        sessionId: body.sessionId,
        category: body.category || "evidence",
        text: body.text || "",
        status: body.status || "open",
        turnIds: JSON.stringify(body.turnIds || []),
      },
    });
    return NextResponse.json(serializeItem(item), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
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
