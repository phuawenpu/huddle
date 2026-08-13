import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HUD_BIND_ADDRESS || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const proxyPath = "/api/realtime/transcription";
const internalProxySecret =
  process.env.HUD_INTERNAL_PROXY_SECRET ||
  randomBytes(32).toString("base64url");
process.env.HUD_INTERNAL_PROXY_SECRET = internalProxySecret;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();
const handleUpgrade = app.getUpgradeHandler();

const server = createServer((request, response) => handle(request, response));
const bridgeServer = new WebSocketServer({
  noServer: true,
  maxPayload: 1024 * 1024,
});
const activeByClient = new Map();
const hourlyConnections = new Map();
let activeConnections = 0;

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`,
  );
  if (url.pathname !== proxyPath) {
    handleUpgrade(request, socket, head);
    return;
  }

  if (
    !requestIsSameOrigin(request) ||
    !authenticated(request) ||
    !allowConnection(request)
  ) {
    rejectUpgrade(socket, 401, "Connection rejected");
    return;
  }

  bridgeServer.handleUpgrade(request, socket, head, (browserSocket) => {
    void bridgeTranscription(browserSocket, request, url).catch(() => {
      closeSocket(browserSocket, 1011, "Transcription unavailable");
    });
  });
});

server.listen(port, hostname, () => {
  console.log(`Critique HUD listening on ${hostname}:${port}`);
});

async function bridgeTranscription(browserSocket, request, requestUrl) {
  const client = clientIdentifier(request);
  activeConnections++;
  activeByClient.set(client, (activeByClient.get(client) || 0) + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeConnections = Math.max(0, activeConnections - 1);
    const remaining = Math.max(0, (activeByClient.get(client) || 1) - 1);
    if (remaining) activeByClient.set(client, remaining);
    else activeByClient.delete(client);
  };
  let upstream;
  const pending = [];
  let pendingBytes = 0;
  const maxPendingBytes = 5 * 32_000;

  browserSocket.on("message", (data, isBinary) => {
    if (upstream?.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
      return;
    }
    const size =
      typeof data === "string" ? Buffer.byteLength(data) : data.length;
    if (pendingBytes + size <= maxPendingBytes) {
      pending.push({ data, isBinary });
      pendingBytes += size;
    }
  });
  browserSocket.on("close", () => {
    if (upstream) closeSocket(upstream, 1000, "Client disconnected");
    release();
  });
  browserSocket.on("error", () => {
    if (upstream) closeSocket(upstream, 1011, "Client connection failed");
    release();
  });

  const maxSpeakers = Math.max(
    2,
    Math.min(
      10,
      Math.round(Number(requestUrl.searchParams.get("max_speakers")) || 6),
    ),
  );
  const tokenResponse = await fetch(
    `http://127.0.0.1:${port}/api/providers/assemblyai/token?max_speakers=${maxSpeakers}`,
    {
      headers: {
        cookie: request.headers.cookie || "",
        "x-huddle-internal-proxy": internalProxySecret,
      },
      cache: "no-store",
    },
  );
  if (!tokenResponse.ok) {
    release();
    throw new Error("Transcription session could not be created.");
  }
  const tokenData = await tokenResponse.json();
  if (typeof tokenData.wsUrl !== "string") {
    release();
    throw new Error("Transcription session configuration was invalid.");
  }
  if (browserSocket.readyState !== WebSocket.OPEN) {
    release();
    return;
  }

  try {
    upstream = new WebSocket(tokenData.wsUrl, {
      maxPayload: 1024 * 1024,
      handshakeTimeout: 12_000,
    });
  } catch (error) {
    release();
    throw error;
  }

  upstream.on("open", () => {
    for (const message of pending) {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(message.data, { binary: message.isBinary });
      }
    }
    pending.length = 0;
    pendingBytes = 0;
  });
  upstream.on("message", (data, isBinary) => {
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(data, { binary: isBinary });
    }
  });
  upstream.on("error", () => {
    closeSocket(browserSocket, 1011, "Transcription unavailable");
  });
  upstream.on("close", () => {
    closeSocket(browserSocket, 1000, "Transcription ended");
    release();
  });
}

function requestIsSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const publicHost = String(
      request.headers["x-forwarded-host"] || request.headers.host || "",
    )
      .split(",")[0]
      .trim();
    const publicProtocol = String(
      request.headers["x-forwarded-proto"] ||
        (request.socket.encrypted ? "https" : "http"),
    )
      .split(",")[0]
      .trim();
    return (
      parsed.host === publicHost && parsed.protocol === `${publicProtocol}:`
    );
  } catch {
    return false;
  }
}

function authenticated(request) {
  if (dev && process.env.AUTH_DISABLED === "1") return true;
  const secret = process.env.HUD_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const cookies = Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([name, value]) => name && value),
  );
  const token = cookies.huddle_session;
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const now = Math.floor(Date.now() / 1000);
    return parsed.v === 1 && parsed.iat <= now + 60 && parsed.exp > now;
  } catch {
    return false;
  }
}

function allowConnection(request) {
  const client = clientIdentifier(request);
  if (activeConnections >= 20 || (activeByClient.get(client) || 0) >= 3)
    return false;
  const now = Date.now();
  const existing = hourlyConnections.get(client);
  const state =
    !existing || existing.resetsAt <= now
      ? { count: 0, resetsAt: now + 60 * 60 * 1000 }
      : existing;
  state.count++;
  hourlyConnections.set(client, state);
  if (hourlyConnections.size > 10_000) {
    for (const [key, entry] of hourlyConnections) {
      if (entry.resetsAt <= now) hourlyConnections.delete(key);
    }
    while (hourlyConnections.size > 10_000) {
      const oldestClient = hourlyConnections.keys().next().value;
      if (!oldestClient) break;
      hourlyConnections.delete(oldestClient);
    }
  }
  return state.count <= 10;
}

function clientIdentifier(request) {
  return (
    request.headers["fly-client-ip"] ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function rejectUpgrade(socket, status, message) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

function closeSocket(socket, code, reason) {
  if (
    socket.readyState === WebSocket.OPEN ||
    socket.readyState === WebSocket.CONNECTING
  ) {
    try {
      socket.close(code, reason);
    } catch {
      socket.terminate();
    }
  }
}
