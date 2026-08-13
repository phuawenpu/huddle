import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticationConfigured,
  createSessionToken,
  secureStringEqual,
  verifyApiToken,
  verifySessionToken,
} from "@/lib/auth-session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("private deployment sessions", () => {
  it("fails configuration checks for short deployment secrets", () => {
    vi.stubEnv("HUD_ACCESS_CODE", "short");
    vi.stubEnv("HUD_SESSION_SECRET", "also-short");
    expect(authenticationConfigured()).toBe(false);
  });

  it("signs, verifies, expires, and rejects tampered cookies", async () => {
    vi.stubEnv("HUD_ACCESS_CODE", "a-long-private-access-code");
    vi.stubEnv(
      "HUD_SESSION_SECRET",
      "session-secret-with-at-least-32-characters",
    );
    const now = Date.UTC(2026, 7, 13, 3, 0, 0);
    const token = await createSessionToken(now);

    expect(authenticationConfigured()).toBe(true);
    expect(await verifySessionToken(token, now + 1_000)).toBe(true);
    expect(
      await verifySessionToken(`${token.slice(0, -1)}x`, now + 1_000),
    ).toBe(false);
    expect(await verifySessionToken(token, now + 13 * 60 * 60 * 1_000)).toBe(
      false,
    );
  });

  it("compares access codes and optional automation tokens safely", async () => {
    vi.stubEnv(
      "HUD_API_TOKEN",
      "automation-token-with-at-least-thirty-two-characters",
    );
    expect(await secureStringEqual("same", "same")).toBe(true);
    expect(await secureStringEqual("same", "different")).toBe(false);
    expect(
      await verifyApiToken(
        "Bearer automation-token-with-at-least-thirty-two-characters",
      ),
    ).toBe(true);
    expect(
      await verifyApiToken("Bearer incorrect-token-value-that-is-long"),
    ).toBe(false);
  });
});
