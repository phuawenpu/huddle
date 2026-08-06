// ============================================
// AssemblyAI Stub — In-process WebSocket server
// that speaks the AssemblyAI streaming protocol.
// ============================================

import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";

export interface StubASRConfig {
  port?: number;
  /** Pre-defined sequence of events to emit */
  events?: ASRStubEvent[];
  /** Simulated latency per event in ms */
  latencyMs?: number;
  /** Whether to validate incoming audio */
  validateAudio?: boolean;
}

export type ASRStubEvent =
  | { type: "Begin"; afterMs: number }
  | { type: "SpeechStarted"; afterMs: number; speakerLabel: string }
  | { type: "Turn"; afterMs: number; speakerLabel: string; text: string; isFinal: boolean; words?: WordEvent[] }
  | { type: "SpeakerRevision"; afterMs: number; fromLabel: string; toLabel: string }
  | { type: "Termination"; afterMs: number }
  | { type: "Error"; afterMs: number; message: string };

interface WordEvent {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface ASRMessage {
  message_type: string;
  // Begin
  session_id?: string;
  // SpeechStarted / Turn
  audio_start?: number;
  audio_end?: number;
  sequence_id?: number;
  confidence?: number;
  speaker_label?: string;
  text?: string;
  words?: WordEvent[];
  is_final?: boolean;
  // Errors
  error?: string;
}

let stubServer: WebSocketServer | null = null;

/**
 * Start an in-process AssemblyAI stub WebSocket server.
 */
export function startASRStub(config: StubASRConfig = {}): Promise<{ port: number; url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const port = config.port || 0;
    const latencyMs = config.latencyMs ?? 100;
    const events: ASRStubEvent[] = config.events || getDefaultEvents();
    const validateAudio = config.validateAudio ?? false;

    const wss = new WebSocketServer({ port });

    wss.on("listening", () => {
      const addr = wss.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        port: actualPort,
        url: `ws://localhost:${actualPort}`,
        close: () => new Promise<void>((res) => {
          wss.close(() => res());
          stubServer = null;
        }),
      });
    });

    wss.on("error", reject);

    wss.on("connection", (ws, _req: IncomingMessage) => {
      let sessionId = `stub-session-${Date.now()}`;
      let audioReceived = false;
      let currentSequenceId = 0;

      // Send events on a schedule
      let elapsed = 0;
      const sendNext = () => {
        if (events.length === 0) return;
        const event = events.shift()!;
        elapsed += event.afterMs;

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) return;

          switch (event.type) {
            case "Begin": {
              const msg: ASRMessage = {
                message_type: "SessionBegins",
                session_id: sessionId,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "SpeechStarted": {
              const msg: ASRMessage = {
                message_type: "SpeechStarted",
                audio_start: Math.max(0, elapsed - latencyMs),
                speaker_label: event.speakerLabel,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "Turn": {
              currentSequenceId++;
              const msg: ASRMessage = {
                message_type: "FinalTranscript",
                audio_start: Math.max(0, elapsed - latencyMs - 2000),
                audio_end: Math.max(100, elapsed - latencyMs),
                sequence_id: currentSequenceId,
                confidence: 0.92,
                speaker_label: event.speakerLabel,
                text: event.text,
                words: event.words || event.text.split(" ").map((w, i) => ({
                  word: w,
                  start: Math.max(0, elapsed - latencyMs - 2000 + i * 300),
                  end: Math.max(0, elapsed - latencyMs - 2000 + (i + 1) * 300),
                  confidence: 0.9 + Math.random() * 0.1,
                })),
                is_final: event.isFinal,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "SpeakerRevision": {
              const msg = {
                message_type: "SpeakerRevision",
                from_label: event.fromLabel,
                to_label: event.toLabel,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "Termination": {
              const msg: ASRMessage = {
                message_type: "SessionTerminated",
                session_id: sessionId,
              };
              ws.send(JSON.stringify(msg));
              // Close after a brief delay
              setTimeout(() => ws.close(), 500);
              break;
            }
            case "Error": {
              const msg: ASRMessage = {
                message_type: "Error",
                error: event.message,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
          }

          sendNext();
        }, event.afterMs);
      };

      ws.on("message", (data: Buffer) => {
        audioReceived = true;
        if (validateAudio) {
          // Verify we're receiving binary PCM16 data
          // 800 samples * 2 bytes = 1600 bytes per 50ms frame
          if (data.length % 2 !== 0) {
            ws.send(JSON.stringify({
              message_type: "Error",
              error: "Invalid PCM16 data: odd byte length",
            }));
            return;
          }
        }
      });

      ws.on("close", () => {
        // Cleanup
      });

      ws.on("error", () => {
        // Client error
      });

      // Start sending events after a brief delay
      setTimeout(sendNext, 200);
    });

    stubServer = wss;
  });
}

/**
 * Stop the stub server if running.
 */
export async function stopASRStub(): Promise<void> {
  if (stubServer) {
    return new Promise((resolve) => {
      stubServer!.close(() => {
        stubServer = null;
        resolve();
      });
    });
  }
}

function getDefaultEvents(): ASRStubEvent[] {
  return [
    { type: "Begin", afterMs: 500 },
    { type: "SpeechStarted", afterMs: 300, speakerLabel: "A" },
    { type: "Turn", afterMs: 2000, speakerLabel: "A", text: "I think we should focus on the user journey for the onboarding flow.", isFinal: true },
    { type: "SpeechStarted", afterMs: 500, speakerLabel: "B" },
    { type: "Turn", afterMs: 3000, speakerLabel: "B", text: "That's a good point. But what evidence do we have that the current flow is broken?", isFinal: true },
    { type: "SpeechStarted", afterMs: 500, speakerLabel: "C" },
    { type: "Turn", afterMs: 2500, speakerLabel: "C", text: "We ran usability tests last sprint and the drop-off rate at step three was 45 percent.", isFinal: true },
    { type: "Termination", afterMs: 1000 },
  ];
}
