import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSSEResponse, snapshotPatch } from "@/lib/sse";
import { subscribe } from "@/lib/pubsub";
import {
  buildCritiqueIntelligence,
  isSourceLinkedDiscussionItem,
  normalizeCriteria,
  normalizeTurnAnalysis,
} from "@/lib/critique-intelligence";
import { calculateMetrics } from "@/lib/metrics";
import { serializeLiveAnalysis } from "@/lib/live-analysis-record";
import { serializeVisualEvidence } from "@/lib/visual-evidence";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
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
            liveAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
            visualEvidence: {
              orderBy: { capturedAtMs: "desc" },
              take: 12,
            },
          },
        });

        if (!session) {
          close();
          return;
        }

        const criteria = normalizeCriteria(safeParseJson(session.criteria, []));
        const serializedTurns = session.transcriptTurns.map((turn) =>
          serializeTurn(turn, criteria),
        );
        const serializedItems = session.discussionItems.map(serializeItem);
        send(
          snapshotPatch(id, {
            session: serializeSession(session),
            participants: session.participants,
            speakerMappings: session.speakerMappings,
            turns: serializedTurns,
            items: serializedItems.filter((item) =>
              isSourceLinkedDiscussionItem(item, serializedTurns),
            ),
            intent: session.intentRevisions[0] || null,
            liveAnalysis: session.liveAnalyses[0]
              ? serializeLiveAnalysis(session.liveAnalyses[0])
              : null,
            visualEvidence: session.visualEvidence.map(serializeVisualEvidence),
            metrics: calculateMetrics(serializedTurns),
            intelligence: buildCritiqueIntelligence(serializedTurns, criteria),
          }),
          String(++sequenceId),
        );
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
  const {
    participants,
    speakerMappings,
    transcriptTurns,
    discussionItems,
    intentRevisions,
    liveAnalyses,
    visualEvidence,
    ...session
  } = s;
  return {
    ...session,
    criteria: normalizeCriteria(safeParseJson(session.criteria, [])),
    createdAt: session.createdAt?.toISOString(),
    updatedAt: session.updatedAt?.toISOString(),
  };
}

function serializeTurn(t: any, criteria: string[]) {
  const rawAnalysis = safeParseJson(t.analysisJson, null);
  return {
    ...t,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysis: rawAnalysis
      ? normalizeTurnAnalysis(rawAnalysis, t.currentText, criteria)
      : null,
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
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
