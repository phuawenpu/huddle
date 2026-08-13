import { NextRequest, NextResponse } from "next/server";
import {
  authenticationConfigured,
  developmentAuthDisabled,
  SESSION_COOKIE_NAME,
  verifyApiToken,
  verifySessionToken,
} from "@/lib/auth-session";

interface RateState {
  count: number;
  resetsAt: number;
}

const globalForSecurity = globalThis as typeof globalThis & {
  huddleRateLimits?: Map<string, RateState>;
};
const rateLimits =
  globalForSecurity.huddleRateLimits || new Map<string, RateState>();
globalForSecurity.huddleRateLimits = rateLimits;

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/time"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const apiTokenValid = await verifyApiToken(
    request.headers.get("authorization"),
  );

  if (developmentAuthDisabled()) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (!SAFE_METHODS.has(request.method) && !apiTokenValid) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (
      !isSameOrigin(request, origin) ||
      (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site")
    ) {
      return securedJson({ error: "Cross-site request rejected." }, 403);
    }
  }

  if (!authenticationConfigured()) {
    if (isPublic) return withSecurityHeaders(NextResponse.next());
    if (pathname.startsWith("/api/")) {
      return securedJson({ error: "Service access is not configured." }, 503);
    }
    if (pathname !== "/login") {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/login", request.url)),
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const cookieValid = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const authenticated = cookieValid || apiTokenValid;

  if (pathname === "/login" && authenticated) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/", request.url)),
    );
  }

  if (!isPublic && !authenticated) {
    if (pathname.startsWith("/api/")) {
      return securedJson({ error: "Authentication required." }, 401);
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(login));
  }

  if (pathname.startsWith("/api/") && authenticated) {
    const client = clientIdentifier(request);
    const policy = costPolicy(pathname, request.method);
    const result = consumeRateLimit(
      `${client}:${policy.name}`,
      policy.limit,
      policy.windowMs,
    );
    if (!result.allowed) {
      const response = securedJson(
        { error: "Request limit reached. Try again later." },
        429,
      );
      response.headers.set("Retry-After", String(result.retryAfterSeconds));
      return response;
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

function isSameOrigin(request: NextRequest, origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const publicHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      request.nextUrl.host;
    const publicProtocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      request.nextUrl.protocol.replace(":", "");
    return (
      parsed.host === publicHost && parsed.protocol === `${publicProtocol}:`
    );
  } catch {
    return false;
  }
}

function costPolicy(pathname: string, method: string) {
  if (method === "GET" && pathname === "/api/providers/assemblyai/token") {
    return { name: "asr-token", limit: 10, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname.endsWith("/synthesize")) {
    return { name: "synthesis", limit: 3, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname.endsWith("/validate-audio")) {
    return { name: "audio-validation", limit: 6, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname.endsWith("/revise")) {
    return { name: "scenario-revision", limit: 20, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname === "/api/scenarios/generate") {
    return { name: "scenario-generation", limit: 15, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname.endsWith("/analyses")) {
    return { name: "full-analysis", limit: 30, windowMs: 60 * 60 * 1000 };
  }
  if (method === "POST" && pathname.endsWith("/visual-evidence")) {
    return { name: "visual-analysis", limit: 30, windowMs: 60 * 60 * 1000 };
  }
  if (method === "GET" && pathname === "/api/scenarios/topic-suggestions") {
    return { name: "topic-suggestions", limit: 30, windowMs: 60 * 60 * 1000 };
  }
  return { name: "api", limit: 300, windowMs: 60 * 1000 };
}

function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateLimits.get(key);
  const state =
    !existing || existing.resetsAt <= now
      ? { count: 0, resetsAt: now + windowMs }
      : existing;
  state.count++;
  rateLimits.set(key, state);
  if (rateLimits.size > 10_000) {
    for (const [entryKey, entry] of rateLimits) {
      if (entry.resetsAt <= now) rateLimits.delete(entryKey);
    }
    while (rateLimits.size > 10_000) {
      const oldestKey = rateLimits.keys().next().value;
      if (!oldestKey) break;
      rateLimits.delete(oldestKey);
    }
  }
  return {
    allowed: state.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((state.resetsAt - now) / 1000)),
  };
}

function clientIdentifier(request: NextRequest): string {
  return (
    request.headers.get("fly-client-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function securedJson(body: Record<string, string>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return withSecurityHeaders(response);
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self)",
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
