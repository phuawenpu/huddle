import { NextRequest, NextResponse } from "next/server";
import {
  authenticationConfigured,
  createSessionToken,
  secureStringEqual,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth-session";

const attempts = new Map<string, { count: number; resetsAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!authenticationConfigured()) {
    return NextResponse.json(
      { error: "Access control is not configured." },
      { status: 503 },
    );
  }

  const client = clientIdentifier(request);
  const attempt = consumeAttempt(client);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(attempt.retryAfterSeconds) },
      },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) {
    return NextResponse.json(
      { error: "Invalid sign-in request." },
      { status: 413 },
    );
  }

  let accessCode = "";
  try {
    const body = await request.json();
    accessCode = typeof body?.accessCode === "string" ? body.accessCode : "";
  } catch {
    // Use the same response as an incorrect credential.
  }

  const valid = await secureStringEqual(
    accessCode.slice(0, 512),
    process.env.HUD_ACCESS_CODE!,
  );
  if (!valid) {
    return NextResponse.json(
      { error: "The access code is not valid." },
      { status: 401 },
    );
  }

  attempts.delete(client);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: await createSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function clientIdentifier(request: NextRequest): string {
  return (
    request.headers.get("fly-client-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function consumeAttempt(key: string) {
  const now = Date.now();
  const existing = attempts.get(key);
  const current =
    !existing || existing.resetsAt <= now
      ? { count: 0, resetsAt: now + WINDOW_MS }
      : existing;
  current.count++;
  attempts.set(key, current);
  if (attempts.size > 10_000) {
    for (const [client, entry] of attempts) {
      if (entry.resetsAt <= now) attempts.delete(client);
    }
    while (attempts.size > 10_000) {
      const oldestClient = attempts.keys().next().value;
      if (!oldestClient) break;
      attempts.delete(oldestClient);
    }
  }
  return {
    allowed: current.count <= MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
  };
}
