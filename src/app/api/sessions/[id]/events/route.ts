import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSSEResponse, snapshotPatch } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  return createSSEResponse((send, close) => {
    // Send initial snapshot
    (async () => {
      try {
        const session = await prisma.session.findUnique({
          where: { id },
          include: {
            participants: true,
            speakerMappings: true,
            transcriptTurns: {
              where: { isFinal: true },
              orderBy: { receivedAtMs: "asc" },
              take: 100,
            },
            discussionItems: true,
            intentRevisions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        });

        if (!session) {
          close();
          return;
        }

        send(snapshotPatch(id, {
          session: serializeSession(session),
          participants: session.participants,
          speakerMappings: session.speakerMappings,
          turns: session.transcriptTurns.map(serializeTurn),
          items: session.discussionItems,
          intent: session.intentRevisions[0] || null,
        }));
      } catch {
        close();
      }
    })();

    // Keep connection alive; patches are sent from other API routes
    // via a simple in-memory pub/sub (not implemented in stub mode)
    const interval = setInterval(() => {
      // Heartbeat is handled by createSSEResponse
    }, 30000);

    return () => clearInterval(interval);
  });
}

function serializeSession(s: any) {
  return {
    id: s.id, title: s.title, objective: s.objective, phase: s.phase,
    criteria: safeParseJson(s.criteria, []), speakerCount: s.speakerCount,
    status: s.status, runMode: s.runMode, scenarioId: s.scenarioId,
    createdAt: s.createdAt?.toISOString(), updatedAt: s.updatedAt?.toISOString(),
  };
}

function serializeTurn(t: any) {
  return {
    ...t,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysisJson: safeParseJson(t.analysisJson, null),
    createdAt: t.createdAt?.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
