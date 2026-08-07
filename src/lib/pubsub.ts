// ============================================
// In-Memory Pub/Sub for SSE Event Distribution
// ============================================
// Routes push patches here; connected SSE clients receive them.
// Session-scoped: each sessionId has its own subscriber set.

import type { SSEPatch } from "./types";

type Subscriber = {
  send(patch: SSEPatch, eventId?: string): void;
  close(): void;
};

const sessions = new Map<string, Set<Subscriber>>();

/**
 * Subscribe to SSE patches for a session. Returns an unsubscribe function.
 */
export function subscribe(sessionId: string, subscriber: Subscriber): () => void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set());
  }
  sessions.get(sessionId)!.add(subscriber);

  return () => {
    const subs = sessions.get(sessionId);
    if (subs) {
      subs.delete(subscriber);
      if (subs.size === 0) sessions.delete(sessionId);
    }
  };
}

/**
 * Publish a patch to all subscribers of a session.
 */
export function publish(sessionId: string, patch: SSEPatch, eventId?: string): void {
  const subs = sessions.get(sessionId);
  if (!subs) return;
  for (const sub of subs) {
    try {
      sub.send(patch, eventId);
    } catch {
      subs.delete(sub);
    }
  }
}

/**
 * Close all subscriber connections for a session.
 */
export function closeSession(sessionId: string): void {
  const subs = sessions.get(sessionId);
  if (!subs) return;
  for (const sub of subs) {
    try { sub.close(); } catch { /* ignore */ }
  }
  sessions.delete(sessionId);
}

/**
 * Number of active subscriber sets (sessions with connected clients).
 */
export function activeSessions(): number {
  return sessions.size;
}

/**
 * Number of total subscribers across all sessions.
 */
export function totalSubscribers(): number {
  let count = 0;
  for (const subs of sessions.values()) {
    count += subs.size;
  }
  return count;
}
