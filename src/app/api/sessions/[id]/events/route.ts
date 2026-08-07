import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSSEResponse, snapshotPatch } from "@/lib/sse";
import { subscribe } from "@/lib/pubsub";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let sequenceId = 0;

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
          items: session.discussionItems.map(serializeItem),
          intent: session.intentRevisions[0] || null,
        }), String(++sequenceId));
      } catch {
        close();
      }
    })();

    // Subscribe to live patches via pub/sub
    const unsub = subscribe(id, { send, close });

    return () => {
      unsub();
    };
  });
}

function serializeSession(s: any) {
  return {
    ...s,
    criteria: safeParseJson(s.criteria, []),
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
  };
}

function serializeTurn(t: any) {
  return {
    ...t,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysis: safeParseJson(t.analysisJson, null),
    session: undefined,
  };
}

function serializeItem(i: any) {
  return {
    ...i,
    turnIds: safeParseJson(i.turnIds, []),
    createdAt: i.createdAt?.toISOString(),
    updatedAt: i.updatedAt?.toISOString(),
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
