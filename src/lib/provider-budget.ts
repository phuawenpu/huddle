import { createHash } from "crypto";
import { databaseReady, prisma } from "./db";

export type ProviderName = "openai" | "assemblyai";

export class ProviderBudgetExceededError extends Error {
  constructor() {
    super(
      "Provider request budget reached. Try again after the budget window resets.",
    );
    this.name = "ProviderBudgetExceededError";
  }
}

const OPENAI_MINUTE_LIMITS: Record<string, number> = {
  "turn-analysis": 60,
  "window-analysis": 12,
  "full-analysis": 10,
  "visual-analysis": 10,
  "topic-suggestions": 10,
  "scenario-generation": 8,
  "scenario-revision": 10,
  "speech-synthesis": 120,
  "audio-validation": 30,
};

export async function assertProviderBudget(
  provider: ProviderName,
  operation: string,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await databaseReady;

  const minuteLimit =
    provider === "openai" ? OPENAI_MINUTE_LIMITS[operation] || 30 : 10;
  const dailyLimit = configuredDailyLimit(provider);
  const nowSeconds = Math.floor(Date.now() / 1000);

  await consumeWindow(
    provider,
    operation,
    "minute",
    Math.floor(nowSeconds / 60) * 60,
    minuteLimit,
  );
  await consumeWindow(
    provider,
    "all",
    "day",
    Math.floor(nowSeconds / 86_400) * 86_400,
    dailyLimit,
  );
}

async function consumeWindow(
  provider: ProviderName,
  operation: string,
  windowKind: "minute" | "day",
  windowStart: number,
  limit: number,
) {
  const id = createHash("sha256")
    .update(`${provider}\0${operation}\0${windowKind}\0${windowStart}`)
    .digest("hex");
  const usage = await prisma.providerUsageWindow.upsert({
    where: { id },
    create: {
      id,
      provider,
      operation,
      windowKind,
      windowStart,
      count: 1,
    },
    update: { count: { increment: 1 } },
  });
  if (usage.count > limit) throw new ProviderBudgetExceededError();
}

function configuredDailyLimit(provider: ProviderName): number {
  const variable =
    provider === "openai"
      ? process.env.OPENAI_DAILY_REQUEST_LIMIT
      : process.env.ASSEMBLYAI_DAILY_SESSION_LIMIT;
  const fallback = provider === "openai" ? 1_500 : 100;
  const parsed = Number(variable);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(100_000, Math.round(parsed)))
    : fallback;
}
