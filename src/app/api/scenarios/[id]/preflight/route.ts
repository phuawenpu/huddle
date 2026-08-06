import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Distinctness preflight: checks that no two voices in the cast
 * share the same timbre class or are expected to "merge."
 * In stub mode, always passes.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

    const speakers = safeParseJson(scenario.speakersJson, null);
    if (!speakers || speakers.length < 2) {
      return NextResponse.json({
        preflight: { passed: true, mergedPairs: [], distinctnessScores: [] },
      });
    }

    const isStub = process.env.TTS_STUB === "1";
    if (isStub) {
      // Stub: always passes
      const preflight = {
        passed: true,
        mergedPairs: [] as Array<[number, number]>,
        distinctnessScores: speakers.map(() => 0.95),
      };
      await prisma.scenario.update({
        where: { id },
        data: {
          preflightJson: JSON.stringify(preflight),
          status: speakers.length >= 3 ? "ready" : "generated",
        },
      });
      return NextResponse.json({ preflight });
    }

    // Check for duplicate timbre classes
    const mergedPairs: Array<[number, number]> = [];
    const timbreMap = new Map<string, number[]>();
    for (let i = 0; i < speakers.length; i++) {
      const tc = speakers[i].timbreClass;
      if (!timbreMap.has(tc)) timbreMap.set(tc, []);
      timbreMap.get(tc)!.push(i);
    }

    for (const [, indices] of timbreMap) {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          mergedPairs.push([indices[i], indices[j]]);
        }
      }
    }

    const passed = mergedPairs.length === 0;
    const preflight = {
      passed,
      mergedPairs,
      distinctnessScores: speakers.map(() => 0.95),
    };

    await prisma.scenario.update({
      where: { id },
      data: {
        preflightJson: JSON.stringify(preflight),
        status: passed ? "ready" : scenario.status,
      },
    });

    return NextResponse.json({ preflight });
  } catch {
    return NextResponse.json({ error: "Preflight failed" }, { status: 500 });
  }
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
