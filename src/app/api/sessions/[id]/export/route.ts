import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        transcriptTurns: { where: { isFinal: true }, orderBy: { receivedAtMs: "asc" } },
        discussionItems: true,
        participants: true,
        speakerMappings: true,
      },
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const isJson = request.url.includes(".json");

    if (isJson) {
      return NextResponse.json({
        session: {
          id: session.id,
          title: session.title,
          objective: session.objective,
          phase: session.phase,
          criteria: safeParseJson(session.criteria, []),
          status: session.status,
          runMode: session.runMode,
          speakerCount: session.speakerCount,
          createdAt: session.createdAt.toISOString(),
        },
        participants: session.participants,
        speakerMappings: session.speakerMappings,
        turns: session.transcriptTurns.map(t => ({
          id: t.id,
          speaker: t.providerSpeakerLabel,
          text: t.currentText,
          startMs: t.startMs,
          endMs: t.endMs,
          isSubstantive: t.isSubstantive,
          category: safeParseJson(t.analysisJson, null)?.category || null,
        })),
        items: session.discussionItems.map(i => ({
          ...i,
          turnIds: safeParseJson(i.turnIds, []),
        })),
      });
    }

    // Plain text export
    const lines = [
      `# ${session.title}`,
      `Objective: ${session.objective}`,
      `Phase: ${session.phase}`,
      `Status: ${session.status}`,
      "",
      "## Transcript",
      ...session.transcriptTurns.map(t =>
        `[${t.providerSpeakerLabel}] (${msToTime(t.startMs)}-${msToTime(t.endMs)}) ${t.currentText}`
      ),
      "",
      "## Discussion Map",
      ...session.discussionItems.map(i =>
        `- [${i.category}] ${i.text} (${i.status})`
      ),
    ].join("\n");

    return new NextResponse(lines, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="session-${id}.txt"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function msToTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
