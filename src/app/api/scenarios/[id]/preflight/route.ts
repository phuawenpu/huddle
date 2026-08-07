import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";
import type { ScenarioSpeaker } from "@/lib/types";

function audioRoot() {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const speakers = safeParse<ScenarioSpeaker[]>(scenario.speakersJson, []);
    const scenarioDir = join(audioRoot(), id);
    const audioAvailable =
      existsSync(join(scenarioDir, "mixed.wav")) &&
      existsSync(join(scenarioDir, "manifest.json"));
    const validation = safeReadJson(join(scenarioDir, "validation.json"));
    const mergedPairs: Array<[number, number]> = [];

    for (let left = 0; left < speakers.length; left++) {
      for (let right = left + 1; right < speakers.length; right++) {
        const a = speakers[left];
        const b = speakers[right];
        const duplicateVoice = a.voiceId === b.voiceId;
        const sameClassWithoutSeparation =
          a.timbreClass === b.timbreClass &&
          (Math.abs((a.speakingRate || 1) - (b.speakingRate || 1)) < 0.08 ||
            a.accent === b.accent);
        if (duplicateVoice || sameClassWithoutSeparation) {
          mergedPairs.push([left, right]);
        }
      }
    }

    const speechValidationPassed =
      process.env.TTS_STUB === "1"
        ? validation?.method === "tone_fixture"
        : validation?.method === "independent_asr" && validation?.passed === true;
    const reason = !audioAvailable
      ? "The mixed WAV and manifest must exist before preflight."
      : !speechValidationPassed
        ? "Independent audio-to-transcript validation has not passed."
      : mergedPairs.length
        ? "The current voice cast is not acoustically separated enough."
        : undefined;
    const passed =
      speakers.length === scenario.speakerCount &&
      speakers.length >= 3 &&
      audioAvailable &&
      speechValidationPassed &&
      mergedPairs.length === 0;
    const preflight = {
      passed,
      mergedPairs,
      distinctnessScores: speakers.map((speaker, index) => {
        const collided = mergedPairs.some((pair) => pair.includes(index));
        return collided ? 0.45 : 0.9;
      }),
      audioAvailable,
      checkedAt: new Date().toISOString(),
      reason,
      speechValidation: validation
        ? {
            method: validation.method,
            passed: validation.passed,
            sampledTurnCount: validation.sampledTurnCount,
            averageWordErrorRate: validation.averageWordErrorRate,
          }
        : null,
      method:
        process.env.TTS_STUB === "1"
          ? "deterministic_stub_cast"
          : "render_and_cast_gate",
    };

    await prisma.scenario.update({
      where: { id },
      data: {
        preflightJson: JSON.stringify(preflight),
        status: passed ? "ready" : audioAvailable ? "rendered" : "incomplete",
      },
    });
    return NextResponse.json({ preflight });
  } catch (error: any) {
    console.error("Preflight failed:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Preflight failed" },
      { status: 500 }
    );
  }
}

function safeReadJson(file: string): any {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
