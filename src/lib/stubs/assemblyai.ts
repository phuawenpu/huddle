// ============================================
// AssemblyAI Stub — In-process WebSocket server
// that speaks the AssemblyAI v3 streaming protocol.
// ============================================

import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";

export const STUB_ASR_PORT = 9876;

export interface StubASRConfig {
  port?: number;
  /** Pre-defined sequence of events to emit */
  events?: ASRStubEvent[];
  /** Simulated latency per event in ms */
  latencyMs?: number;
  /** Whether to validate incoming audio */
  validateAudio?: boolean;
  /** Fault injection configuration */
  faults?: StubFaultConfig;
}

export interface StubFaultConfig {
  labelSwapRate?: number;
  unknownRate?: number;
  wordErrorRate?: number;
  droppedTurnRate?: number;
  duplicateEventRate?: number;
  overlapMisattributionRate?: number;
  disconnectAtMs?: number;
  analysisTimeoutRate?: number;
  emitSpeakerRevision?: boolean;
  seed?: number;
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

// v3 protocol message types
interface BeginMessage {
  type: "Begin";
  id: string;
  expires_at: string;
}

interface SpeechStartedMessage {
  type: "SpeechStarted";
  timestamp: number;
  confidence: number;
  speaker_label?: string;
}

interface TurnMessage {
  type: "Turn";
  turn_order: number;
  end_of_turn: boolean;
  turn_is_formatted: boolean;
  transcript: string;
  end_of_turn_confidence: number;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    word_is_final: boolean;
    speaker?: string;
  }>;
  utterance?: string;
  speaker_label?: string;
  language_code?: string;
  language_confidence?: number;
}

interface SpeakerRevisionMessage {
  type: "SpeakerRevision";
  revisions: Array<{
    turn_order: number;
    speaker_label: string;
    words: Array<{ text: string; start: number; end: number; confidence: number; speaker: string }>;
  }>;
}

interface TerminationMessage {
  type: "Termination";
  audio_duration_seconds: number;
  session_duration_seconds: number;
}

interface ErrorMessage {
  type: "Error";
  error: string;
}

interface UpdateConfigMessage {
  type: "UpdateConfiguration";
  prompt?: string;
  keyterms_prompt?: string[];
  agent_context?: string;
  min_turn_silence?: number;
  max_turn_silence?: number;
  vad_threshold?: number;
  interruption_delay?: number;
}

let stubServer: WebSocketServer | null = null;

/**
 * Start an in-process AssemblyAI v3 stub WebSocket server.
 */
export function startASRStub(config: StubASRConfig = {}): Promise<{ port: number; url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const port = config.port || STUB_ASR_PORT;
    const latencyMs = config.latencyMs ?? 100;
    const sourceEvents: ASRStubEvent[] = config.events || getDefaultEvents();
    const validateAudio = config.validateAudio ?? false;
    const faults = config.faults;

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
      // Each WebSocket session receives an independent fixture sequence.
      // Sharing and shifting one array made every connection after the first
      // silently receive no Begin or Turn messages.
      const events = sourceEvents.map((event) => ({ ...event }));
      const sessionId = `stub-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let audioReceived = false;
      let turnOrder = 0;
      let totalAudioBytes = 0;
      const connectTime = Date.now();
      
      // Track turns for SpeakerRevision
      const finalizedTurns: Array<{ turn_order: number; speaker_label: string; words: WordEvent[] }> = [];

      // Send events on a schedule
      let elapsed = 0;
      const sendNext = () => {
        if (events.length === 0) return;
        const event = events.shift()!;
        elapsed += event.afterMs;

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) return;

          // Fault injection: simulate disconnect
          if (faults?.disconnectAtMs && elapsed >= faults.disconnectAtMs) {
            ws.close(3005, "Fault injection: simulated disconnect");
            return;
          }

          switch (event.type) {
            case "Begin": {
              const msg: BeginMessage = {
                type: "Begin",
                id: sessionId,
                expires_at: new Date(Date.now() + 7200_000).toISOString(),
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "SpeechStarted": {
              const msg: SpeechStartedMessage = {
                type: "SpeechStarted",
                timestamp: Math.max(0, elapsed - latencyMs),
                confidence: 0.9,
                speaker_label: event.speakerLabel,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
            case "Turn": {
              turnOrder++;

              // Fault injection: dropped turns
              if (faults?.droppedTurnRate && Math.random() < faults.droppedTurnRate) {
                break;
              }

              // Fault injection: duplicate events
              const emitDuplicate = faults?.duplicateEventRate && Math.random() < faults.duplicateEventRate;

              // Fault injection: label swap
              let speakerLabel = event.speakerLabel;
              if (faults?.labelSwapRate && Math.random() < faults.labelSwapRate) {
                const labels = ["A", "B", "C", "D", "E", "F"];
                const others = labels.filter(l => l !== speakerLabel);
                speakerLabel = others[Math.floor(Math.random() * others.length)];
              }

              // Fault injection: UNKNOWN speaker
              let isUnknown = false;
              if (faults?.unknownRate && Math.random() < faults.unknownRate) {
                speakerLabel = "";
                isUnknown = true;
              }

              // Fault injection: word errors
              let words = (event.words || generateWords(event.text, event.isFinal ? turnOrder - 1 : 0)).map(w => ({
                text: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
                word_is_final: event.isFinal,
                speaker: isUnknown ? undefined : speakerLabel,
              }));

              if (faults?.wordErrorRate && Math.random() < faults.wordErrorRate && words.length > 0) {
                const idx = Math.floor(Math.random() * words.length);
                words[idx] = { ...words[idx], text: "XERRX", confidence: 0.3 };
              }

              const msg: TurnMessage = {
                type: "Turn",
                turn_order: turnOrder,
                end_of_turn: event.isFinal,
                turn_is_formatted: event.isFinal,
                transcript: event.isFinal ? event.text : event.text + "...",
                end_of_turn_confidence: event.isFinal ? 1.0 : 0.0,
                words: event.isFinal ? words : undefined,
                utterance: event.isFinal ? event.text : undefined,
                speaker_label: isUnknown ? undefined : speakerLabel,
              };
              
              ws.send(JSON.stringify(msg));

              // Track finalized turns for SpeakerRevision
              if (event.isFinal && event.text) {
                finalizedTurns.push({
                  turn_order: turnOrder,
                  speaker_label: speakerLabel,
                  words: event.words || generateRawWords(event.text, turnOrder - 1),
                });
              }

              // Emit duplicate if configured
              if (emitDuplicate) {
                ws.send(JSON.stringify(msg));
              }
              break;
            }
            case "SpeakerRevision": {
              if (faults && faults.emitSpeakerRevision === false) break;

              // Revise the first finalized turn's label
              if (finalizedTurns.length > 0) {
                const revised = finalizedTurns[0];
                const newLabel = event.toLabel || "X";
                const revMsg: SpeakerRevisionMessage = {
                  type: "SpeakerRevision",
                  revisions: [{
                    turn_order: revised.turn_order,
                    speaker_label: newLabel,
                    words: (revised.words || []).map(w => ({
                      text: w.word,
                      start: w.start,
                      end: w.end,
                      confidence: w.confidence || 0.9,
                      speaker: newLabel,
                    })),
                  }],
                };
                ws.send(JSON.stringify(revMsg));
              }
              break;
            }
            case "Termination": {
              const totalSec = Math.max(0.1, (Date.now() - connectTime) / 1000);
              const audioSec = Math.max(0.1, totalAudioBytes / (16000 * 2));
              const msg: TerminationMessage = {
                type: "Termination",
                audio_duration_seconds: audioSec,
                session_duration_seconds: totalSec,
              };
              ws.send(JSON.stringify(msg));
              setTimeout(() => ws.close(), 500);
              break;
            }
            case "Error": {
              const msg: ErrorMessage = {
                type: "Error",
                error: event.message,
              };
              ws.send(JSON.stringify(msg));
              break;
            }
          }

          sendNext();
        }, event.afterMs);
      };

      ws.on("message", (raw: Buffer) => {
        // Handle text messages (commands)
        try {
          const text = raw.toString();
          if (text.startsWith("{")) {
            const cmd = JSON.parse(text);
            if (cmd.type === "Terminate") {
              // Client requested termination - emit Termination
              const totalSec = Math.max(0.1, (Date.now() - connectTime) / 1000);
              const audioSec = Math.max(0.1, totalAudioBytes / (16000 * 2));
              ws.send(JSON.stringify({
                type: "Termination",
                audio_duration_seconds: audioSec,
                session_duration_seconds: totalSec,
              }));
              setTimeout(() => ws.close(), 500);
              return;
            }
            if (cmd.type === "ForceEndpoint") {
              // Force end current turn
              turnOrder++;
              ws.send(JSON.stringify({
                type: "Turn",
                turn_order: turnOrder,
                end_of_turn: true,
                turn_is_formatted: true,
                transcript: "[forced endpoint]",
                end_of_turn_confidence: 1.0,
              }));
              return;
            }
            if (cmd.type === "KeepAlive") return;
            if (cmd.type === "UpdateConfiguration") return;
            return;
          }
        } catch { /* binary data */ }

        // Binary audio data (PCM16)
        audioReceived = true;
        totalAudioBytes += raw.length;

        if (validateAudio) {
          if (raw.length % 2 !== 0) {
            ws.send(JSON.stringify({
              type: "Error",
              error: "Invalid PCM16 data: odd byte length",
            }));
            return;
          }
          // Check chunk size: 50-1000ms at 16kHz = 1600-32000 bytes
          const chunkMs = raw.length / (16000 * 2) * 1000;
          if (chunkMs < 30 || chunkMs > 1200) {
            ws.send(JSON.stringify({
              type: "Error",
              error: `Chunk duration ${chunkMs.toFixed(0)}ms outside 30-1200ms range`,
            }));
            if (chunkMs < 50 || chunkMs > 1000) {
              ws.close(3007, "Audio chunk outside allowed range");
            }
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

function generateWords(text: string, baseOrder: number): WordEvent[] {
  return text.split(" ").map((w, i) => ({
    word: w,
    start: baseOrder * 2000 + i * 300,
    end: baseOrder * 2000 + (i + 1) * 300,
    confidence: 0.85 + Math.random() * 0.15,
  }));
}

function generateRawWords(text: string, baseOrder: number): WordEvent[] {
  return text.split(" ").map((w, i) => ({
    word: w,
    start: baseOrder * 2000 + i * 300,
    end: baseOrder * 2000 + (i + 1) * 300,
    confidence: 0.85 + Math.random() * 0.15,
  }));
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
