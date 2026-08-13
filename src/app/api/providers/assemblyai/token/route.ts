import { NextRequest, NextResponse } from "next/server";
import { STUB_ASR_PORT } from "@/lib/stubs/assemblyai";
import { assertProviderBudget } from "@/lib/provider-budget";
import { secureStringEqual } from "@/lib/auth-session";

const DEFAULT_SPEECH_MODEL = "u3-rt-pro";

/**
 * AssemblyAI token endpoint.
 * In stub mode, returns a dummy token pointing to the stub server.
 * In production, calls the AssemblyAI token API with the API key.
 */
export async function GET(request: NextRequest) {
  const internalSecret = process.env.HUD_INTERNAL_PROXY_SECRET;
  const suppliedSecret = request.headers.get("x-huddle-internal-proxy") || "";
  if (
    !internalSecret ||
    !(await secureStringEqual(suppliedSecret, internalSecret))
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isStub = process.env.ASR_STUB === "1";
  const requestedSpeakers = Number(
    request.nextUrl.searchParams.get("max_speakers") || "6",
  );
  const maxSpeakers = Number.isFinite(requestedSpeakers)
    ? Math.max(2, Math.min(10, Math.round(requestedSpeakers)))
    : 6;
  const speechModel =
    process.env.ASSEMBLYAI_SPEECH_MODEL || DEFAULT_SPEECH_MODEL;
  const connectionParams = new URLSearchParams({
    sample_rate: "16000",
    speech_model: speechModel,
    format_turns: "true",
    speaker_labels: "true",
    max_speakers: String(maxSpeakers),
  });

  if (isStub) {
    connectionParams.set("token", "stub-token");
    return NextResponse.json({
      token: "stub-token",
      wsBase: `ws://localhost:${STUB_ASR_PORT}`,
      wsUrl: `ws://localhost:${STUB_ASR_PORT}/v3/ws?${connectionParams.toString()}`,
      speechModel,
      speakerLabels: true,
      maxSpeakers,
      stubbed: true,
    });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Live transcription is not configured." },
      { status: 503 },
    );
  }

  try {
    await assertProviderBudget("assemblyai", "streaming-session");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let tokenRes: Response;
    try {
      tokenRes = await fetch(
        "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=7200",
        {
          headers: { Authorization: apiKey },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Failed to start live transcription." },
        { status: 502 },
      );
    }

    const { token } = (await tokenRes.json()) as { token: string };
    connectionParams.set("token", token);
    const wsBase = process.env.ASR_WS_BASE || "wss://streaming.assemblyai.com";

    return NextResponse.json({
      token,
      wsBase,
      wsUrl: `${wsBase}/v3/ws?${connectionParams.toString()}`,
      speechModel,
      speakerLabels: true,
      maxSpeakers,
      stubbed: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Live transcription is temporarily unavailable." },
      { status: 502 },
    );
  }
}
