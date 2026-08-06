import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        session: { include: { transcriptTurns: { where: { isFinal: true }, orderBy: { receivedAtMs: "asc" } } } },
      },
    });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const isJson = request.url.includes(".json");
    const evaluation = safeParseJson(run.evaluationJson, null);

    if (isJson) {
      return NextResponse.json({
        runId: run.id,
        mode: run.mode,
        stubbed: run.stubbed,
        evaluation,
        turns: run.session.transcriptTurns.map(t => ({
          id: t.id,
          speaker: t.providerSpeakerLabel,
          text: t.currentText,
          startMs: t.startMs,
          endMs: t.endMs,
          category: safeParseJson(t.analysisJson, null)?.category || null,
          isSubstantive: t.isSubstantive,
        })),
      });
    }

    // CSV export
    const rows = [
      ["id", "speaker", "text", "startMs", "endMs", "category", "substantive"].join(","),
      ...run.session.transcriptTurns.map(t => {
        const analysis = safeParseJson(t.analysisJson, null);
        return [
          t.id,
          `"${t.providerSpeakerLabel}"`,
          `"${(t.currentText || "").replace(/"/g, '""')}"`,
          t.startMs,
          t.endMs,
          analysis?.category || "",
          t.isSubstantive,
        ].join(",");
      }),
    ].join("\n");

    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="run-${id}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
