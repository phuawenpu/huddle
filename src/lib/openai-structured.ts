import { openAiFetch } from "./openai-client";
import { UNTRUSTED_INPUT_POLICY } from "./prompt-security";

export interface StructuredJsonRequest {
  model: string;
  system: string;
  user: string;
  schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
  maxCompletionTokens?: number;
  operation?: "scenario-generation" | "scenario-revision";
}

export async function requestStructuredJson<T>(
  request: StructuredJsonRequest
): Promise<T> {
  let lastError = "Structured model request failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await openAiFetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: `${UNTRUSTED_INPUT_POLICY}\n\n${request.system}` },
          { role: "user", content: request.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: request.schema,
        },
        max_completion_tokens: request.maxCompletionTokens || 32_000,
        ...(request.model.startsWith("gpt-5")
          ? { reasoning_effort: "medium" }
          : {}),
      }),
    }, { operation: request.operation || "scenario-generation", timeoutMs: 90_000 });
    if (response.ok) {
      const body = await response.json();
      const choice = body?.choices?.[0];
      const refusal = choice?.message?.refusal;
      if (refusal) throw new Error(`The model declined the revision: ${refusal}`);
      if (choice?.finish_reason === "length") {
        throw new Error("The model response was incomplete. Try fewer passes or a shorter transcript.");
      }
      const content = choice?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("The model returned no structured transcript.");
      }
      try {
        return JSON.parse(content) as T;
      } catch {
        throw new Error("The model returned malformed structured transcript JSON.");
      }
    }
    await response.text();
    lastError = `Model request returned ${response.status}.`;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) =>
      setTimeout(resolve, 750 * 2 ** attempt + Math.random() * 200)
    );
  }
  throw new Error(lastError);
}
