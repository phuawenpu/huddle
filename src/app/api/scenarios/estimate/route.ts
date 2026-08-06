import { NextRequest, NextResponse } from "next/server";
import { estimateBudget, validateScenarioParams } from "@/lib/budget";
import type { CrossTalkLevel } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { durationMinutes, speakerCount, crossTalkLevel } = body;

    const validation = validateScenarioParams({
      durationMinutes: Number(durationMinutes) || 8,
      speakerCount: Number(speakerCount) || 4,
      crossTalkLevel: (crossTalkLevel || "occasional") as CrossTalkLevel,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const budget = estimateBudget(
      Number(durationMinutes),
      Number(speakerCount),
      crossTalkLevel as CrossTalkLevel
    );

    return NextResponse.json({ budget });
  } catch {
    return NextResponse.json({ error: "Failed to estimate scenario" }, { status: 500 });
  }
}
