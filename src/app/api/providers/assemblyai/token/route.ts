import { NextResponse } from "next/server";

/**
 * AssemblyAI token endpoint.
 * In stub mode, returns a dummy token pointing to the stub server.
 * In production, calls the AssemblyAI token API with the API key.
 */
export async function GET() {
  const isStub = process.env.ASR_STUB === "1";

  if (isStub) {
    return NextResponse.json({
      token: "stub-token",
      wsBase: "ws://localhost:9876",
      speechModel: "universal-3-5-pro",
      stubbed: true,
    });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const tokenRes = await fetch(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=7200",
      { headers: { Authorization: apiKey } }
    );

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Failed to get AssemblyAI token" },
        { status: 502 }
      );
    }

    const { token } = (await tokenRes.json()) as { token: string };

    return NextResponse.json({
      token,
      wsBase: process.env.ASR_WS_BASE || "wss://streaming.assemblyai.com",
      speechModel: process.env.ASSEMBLYAI_SPEECH_MODEL || "universal-3-5-pro",
      stubbed: false,
    });
  } catch {
    return NextResponse.json(
      { error: "AssemblyAI token request failed" },
      { status: 502 }
    );
  }
}
