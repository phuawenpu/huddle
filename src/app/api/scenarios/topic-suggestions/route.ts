import { NextRequest, NextResponse } from "next/server";
import { stubTopicSuggestions } from "@/lib/stubs/openai";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const seed = parseInt(url.searchParams.get("seed") || "0", 10);
  const excludeStr = url.searchParams.get("exclude") || "";
  const count = parseInt(url.searchParams.get("count") || "5", 10);
  const exclude = excludeStr ? excludeStr.split(",") : [];

  const isStub = process.env.LLM_STUB === "1";

  if (isStub) {
    const suggestions = stubTopicSuggestions(seed, exclude, Math.min(count, 10));
    return NextResponse.json({ suggestions, stubbed: true });
  }

  // In production, call OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content: "You generate Design Thinking workshop topics for critique sessions. Return exactly 5 topics as a JSON array of objects with keys: topic, domain, description. Each topic should be suitable for a group critique lasting 3-15 minutes.",
          },
          { role: "user", content: `Generate ${count} fresh Design Thinking critique topics.${exclude.length ? ` Exclude: ${exclude.join(", ")}` : ""}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const suggestions = content ? JSON.parse(content).topics || JSON.parse(content).suggestions || [] : [];

    return NextResponse.json({ suggestions, stubbed: false });
  } catch {
    // Fall back to stubs on failure
    const suggestions = stubTopicSuggestions(seed, exclude, Math.min(count, 10));
    return NextResponse.json({ suggestions, stubbed: true, degraded: true });
  }
}
