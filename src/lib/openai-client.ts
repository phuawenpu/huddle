const OPENAI_API_BASE = "https://api.openai.com";
const ALLOWED_PATHS = new Set([
  "/v1/chat/completions",
  "/v1/audio/speech",
  "/v1/audio/transcriptions",
]);

export interface OpenAiRequestOptions {
  operation: string;
  timeoutMs?: number;
}

/**
 * The only outbound OpenAI transport. Browser code calls Huddle routes; this
 * server-only boundary adds credentials, enforces budgets, and restricts which
 * upstream endpoints the application can reach.
 */
export async function openAiFetch(
  path: string,
  init: RequestInit,
  options: OpenAiRequestOptions,
): Promise<Response> {
  if (!ALLOWED_PATHS.has(path)) throw new Error("Unsupported model operation.");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Model service is not configured.");

  if (process.env.NODE_ENV !== "test") {
    const { assertProviderBudget } = await import("./provider-budget");
    await assertProviderBudget("openai", options.operation);
  }
  const controller = new AbortController();
  const timeoutMs = Math.max(
    1_000,
    Math.min(300_000, options.timeoutMs || 30_000),
  );
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  headers.delete("Authorization");
  headers.set("Authorization", `Bearer ${apiKey}`);

  try {
    return await fetch(`${OPENAI_API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: init.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
