// ============================================
// SSE (Server-Sent Events) Helper
// ============================================

import type { SSEPatch } from "./types";

const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Create an SSE response with snapshot+patch semantics.
 * Handles heartbeat and Last-Event-ID.
 */
export function createSSEResponse(
  onConnect: (
    send: (patch: SSEPatch, eventId?: string) => void,
    close: () => void,
  ) => void,
): Response {
  let encoder = new TextEncoder();
  let stream: ReadableStream<Uint8Array>;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;

  stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });

  const sendPatch = (patch: SSEPatch, eventId?: string) => {
    if (closed) return;
    const lines: string[] = [];
    if (eventId) lines.push(`id: ${eventId}`);
    lines.push(`event: ${patch.type}`);
    lines.push(`data: ${JSON.stringify(patch.data)}`);
    // SSE events end with a blank line. A single trailing newline leaves the
    // browser waiting for the heartbeat before it dispatches the event.
    lines.push("", "");
    controller.enqueue(encoder.encode(lines.join("\n")));
  };

  const close = () => {
    closed = true;
    try {
      controller.close();
    } catch {
      /* already closed */
    }
  };

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (closed) {
      clearInterval(heartbeat);
      return;
    }
    try {
      controller.enqueue(encoder.encode(": heartbeat\n\n"));
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Run the connect callback
  onConnect(sendPatch, () => {
    clearInterval(heartbeat);
    close();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Format an SSE snapshot patch.
 */
export function snapshotPatch(sessionId: string, data: unknown): SSEPatch {
  return {
    type: "snapshot",
    data: { sessionId, ...(data as object) },
  };
}

/**
 * Format a turn.final patch.
 */
export function turnFinalPatch(turn: unknown): SSEPatch {
  return { type: "turn.final", data: turn };
}

/**
 * Format a turn.updated patch.
 */
export function turnUpdatedPatch(turn: unknown): SSEPatch {
  return { type: "turn.updated", data: turn };
}

/**
 * Format a metrics patch.
 */
export function metricsPatch(metrics: unknown): SSEPatch {
  return { type: "metrics", data: metrics };
}

/**
 * Format a critique-intelligence update.
 */
export function intelligencePatch(intelligence: unknown): SSEPatch {
  return { type: "intelligence", data: intelligence };
}

export function liveAnalysisPatch(analysis: unknown): SSEPatch {
  return { type: "live.analysis", data: analysis };
}

export function visualEvidencePatch(evidence: unknown): SSEPatch {
  return { type: "visual.evidence", data: evidence };
}

/**
 * Format a map.patch.
 */
export function mapPatch(item: unknown): SSEPatch {
  return { type: "map.patch", data: item };
}

/**
 * Format a prompt.show patch.
 */
export function promptShowPatch(prompt: unknown): SSEPatch {
  return { type: "prompt.show", data: prompt };
}

/**
 * Format a prompt.clear patch.
 */
export function promptClearPatch(): SSEPatch {
  return { type: "prompt.clear", data: {} };
}

/**
 * Format a status patch.
 */
export function statusPatch(status: string): SSEPatch {
  return { type: "status", data: { status } };
}

/**
 * Format a playback patch.
 */
export function playbackPatch(event: unknown): SSEPatch {
  return { type: "playback", data: event };
}
