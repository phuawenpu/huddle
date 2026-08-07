import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { closeSession, publish } from "@/lib/pubsub";
import { statusPatch } from "@/lib/sse";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    
    if (sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId, status: { in: ["active", "setup"] } },
        data: { status: "terminated" },
      });

      publish(sessionId, statusPatch("terminated"));
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true });
}
