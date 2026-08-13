import { NextRequest, NextResponse } from "next/server";
import { stubTopicSuggestions } from "@/lib/stubs/openai";
import { openAiFetch } from "@/lib/openai-client";
import { UNTRUSTED_INPUT_POLICY } from "@/lib/prompt-security";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const seed = parseInt(url.searchParams.get("seed") || "0", 10);
  const excludeStr = url.searchParams.get("exclude") || "";
  const count = Math.max(
    1,
    Math.min(10, parseInt(url.searchParams.get("count") || "5", 10) || 5),
  );
  const exclude = excludeStr
    ? excludeStr
        .split(",")
        .map((value) => value.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const isStub = process.env.LLM_STUB === "1";

  if (isStub) {
    const suggestions = stubTopicSuggestions(
      seed,
      exclude,
      Math.min(count, 10),
    );
    return NextResponse.json({ suggestions, stubbed: true });
  }

  // In production, call OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Model service is not configured." },
      { status: 503 },
    );
  }

  try {
    const res = await openAiFetch(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
          messages: [
            {
              role: "system",
              content: `${UNTRUSTED_INPUT_POLICY}\n\nYou generate Design Thinking workshop topics for critique sessions. Return one JSON object with a topics array containing exactly the requested number of objects. Each object has only topic, domain, and description. Each topic must suit a group critique lasting 3-15 minutes.`,
            },
            {
              role: "user",
              content: `Generate ${count} fresh Design Thinking critique topics.${exclude.length ? ` Exclude: ${exclude.join(", ")}` : ""}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
      { operation: "topic-suggestions", timeoutMs: 20_000 },
    );

    if (!res.ok) throw new Error(`Topic service returned ${res.status}.`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const suggestions = content
      ? JSON.parse(content).topics || JSON.parse(content).suggestions || []
      : [];

    return NextResponse.json({ suggestions, stubbed: false });
  } catch {
    // Fall back to stubs on failure
    const suggestions = stubTopicSuggestions(
      seed,
      exclude,
      Math.min(count, 10),
    );
    return NextResponse.json({ suggestions, stubbed: true, degraded: true });
  }
}
