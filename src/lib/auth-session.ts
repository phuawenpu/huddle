const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "huddle_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
}

export function authenticationConfigured(): boolean {
  return Boolean(
    process.env.HUD_ACCESS_CODE &&
    process.env.HUD_ACCESS_CODE.length >= 12 &&
    process.env.HUD_SESSION_SECRET &&
    process.env.HUD_SESSION_SECRET.length >= 32,
  );
}

export function developmentAuthDisabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.AUTH_DISABLED === "1"
  );
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = requiredSessionSecret();
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !process.env.HUD_SESSION_SECRET) return false;
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return false;

  const expectedSignature = await sign(
    encodedPayload,
    process.env.HUD_SESSION_SECRET,
  );
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as Partial<SessionPayload>;
    const current = Math.floor(now / 1000);
    return (
      payload.v === 1 &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= current + 60 &&
      payload.exp > current
    );
  } catch {
    return false;
  }
}

export async function secureStringEqual(
  supplied: string,
  expected: string,
): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return constantTimeEqualBytes(new Uint8Array(left), new Uint8Array(right));
}

export async function verifyApiToken(
  authorization: string | null,
): Promise<boolean> {
  const expected = process.env.HUD_API_TOKEN;
  if (
    !expected ||
    expected.length < 32 ||
    !authorization?.startsWith("Bearer ")
  ) {
    return false;
  }
  return secureStringEqual(authorization.slice(7), expected);
}

function requiredSessionSecret(): string {
  const secret = process.env.HUD_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Authentication is not configured.");
  }
  return secret;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  return constantTimeEqualBytes(encoder.encode(left), encoder.encode(right));
}

function constantTimeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
