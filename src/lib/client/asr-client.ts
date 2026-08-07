"use client";

/**
 * ASR WebSocket Client — connects to AssemblyAI v3 (or stub)
 * 
 * Manages connection lifecycle, audio streaming, and message handling.
 */

export interface ASRClientOptions {
  wsUrl: string;
  onTurn?: (turn: TurnEvent) => void;
  onSpeechStarted?: (event: SpeechStartedEvent) => void;
  onSpeakerRevision?: (revision: SpeakerRevisionEvent) => void;
  onTermination?: (event: TerminationEvent) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  /** Send a Turn to the server for ingestion */
  onTurnIngest?: (turn: IngestTurnData) => Promise<void>;
}

export interface TurnEvent {
  turnOrder: number;
  endOfTurn: boolean;
  transcript: string;
  speakerLabel?: string;
  words?: WordEvent[];
  languageCode?: string;
  languageConfidence?: number;
}

export interface WordEvent {
  text: string;
  start: number;
  end: number;
  confidence: number;
  wordIsFinal: boolean;
  speaker?: string;
}

export interface SpeechStartedEvent {
  timestamp: number;
  speakerLabel?: string;
}

export interface SpeakerRevisionEvent {
  revisions: Array<{
    turnOrder: number;
    speakerLabel: string;
    words: Array<{ text: string; start: number; end: number; confidence: number; speaker: string }>;
  }>;
}

export interface TerminationEvent {
  audioDurationSeconds: number;
  sessionDurationSeconds: number;
}

export interface IngestTurnData {
  providerSessionId: string;
  providerTurnOrder: number;
  segmentIndex: number;
  providerSpeakerLabel: string;
  startMs: number;
  endMs: number;
  receivedAtMs: number;
  originalText: string;
  currentText: string;
  wordsJson?: WordEvent[];
  isFinal: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
}

export interface ASRClientState {
  connected: boolean;
  sessionId: string | null;
  turnCount: number;
  streamingMinutes: number;
  lastError: string | null;
}

export function createASRClient(options: ASRClientOptions) {
  const {
    wsUrl,
    onTurn,
    onSpeechStarted,
    onSpeakerRevision,
    onTermination,
    onError,
    onConnectionChange,
    onTurnIngest,
  } = options;

  let ws: WebSocket | null = null;
  let sessionId: string | null = null;
  let turnCount = 0;
  let connectTime = 0;
  let streamingTimer: ReturnType<typeof setInterval> | null = null;
  let audioBuffer: ArrayBuffer[] = [];
  let bufferByteLength = 0;
  const MAX_BUFFER_BYTES = 5 * 32000; // 5s of audio at 16kHz mono

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => resolve());
        return;
      }

      try {
        ws = new WebSocket(wsUrl);
      } catch (err: any) {
        reject(new Error(`WebSocket creation failed: ${err.message}`));
        return;
      }

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        connectTime = Date.now();
        onConnectionChange?.(true);

        // Drain audio buffer
        while (audioBuffer.length > 0) {
          const chunk = audioBuffer.shift();
          if (chunk && ws?.readyState === WebSocket.OPEN) {
            ws.send(chunk);
          }
        }
        bufferByteLength = 0;

        // Streaming minutes counter
        streamingTimer = setInterval(() => {
          if (connectTime > 0) {
            const mins = (Date.now() - connectTime) / 60000;
            onConnectionChange?.(true); // triggers re-render with updated time
          }
        }, 5000);

        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          
          switch (msg.type) {
            case "Begin":
              sessionId = msg.id;
              break;
            
            case "SpeechStarted":
              onSpeechStarted?.({
                timestamp: msg.timestamp,
                speakerLabel: msg.speaker_label,
              });
              break;
            
            case "Turn": {
              turnCount++;
              const turn: TurnEvent = {
                turnOrder: msg.turn_order,
                endOfTurn: msg.end_of_turn,
                transcript: msg.transcript || "",
                speakerLabel: msg.speaker_label,
                words: msg.words,
                languageCode: msg.language_code,
                languageConfidence: msg.language_confidence,
              };
              onTurn?.(turn);

              // If final, ingest to server
              if (msg.end_of_turn && onTurnIngest && sessionId) {
                const words = msg.words || [];
                const startMs = words.length > 0 ? words[0].start : 0;
                const endMs = words.length > 0 ? words[words.length - 1].end : 0;
                
                onTurnIngest({
                  providerSessionId: sessionId,
                  providerTurnOrder: msg.turn_order,
                  segmentIndex: 0,
                  providerSpeakerLabel: msg.speaker_label || "",
                  startMs,
                  endMs,
                  receivedAtMs: Date.now() - connectTime,
                  originalText: msg.transcript,
                  currentText: msg.transcript,
                  wordsJson: words,
                  isFinal: true,
                  isUnknownSpeaker: !msg.speaker_label,
                  possibleOverlap: false,
                }).catch(() => {});
              }
              break;
            }
            
            case "SpeakerRevision":
              onSpeakerRevision?.(msg);
              break;
            
            case "Termination":
              if (streamingTimer) clearInterval(streamingTimer);
              onTermination?.(msg);
              break;

            case "Error":
              onError?.(new Error(msg.error));
              break;
          }
        } catch (err: any) {
          onError?.(new Error(`Failed to parse ASR message: ${err.message}`));
        }
      };

      ws.onerror = (event) => {
        onError?.(new Error("ASR WebSocket error"));
      };

      ws.onclose = (event) => {
        ws = null;
        sessionId = null;
        if (streamingTimer) clearInterval(streamingTimer);
        onConnectionChange?.(false);

        // Auto-reconnect on abnormal close (not clean termination)
        if (event.code !== 1000 && event.code !== 1005) {
          setTimeout(() => {
            connect().catch(() => {});
          }, 2000);
        }
      };
    });
  }

  function sendAudio(pcm16Buffer: ArrayBuffer) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(pcm16Buffer);
    } else {
      // Buffer while connecting
      if (bufferByteLength < MAX_BUFFER_BYTES) {
        audioBuffer.push(pcm16Buffer);
        bufferByteLength += pcm16Buffer.byteLength;
      }
    }
  }

  function terminate() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "Terminate" }));
      // Wait for Termination message, then close
      setTimeout(() => {
        ws?.close(1000, "User terminated");
        ws = null;
        if (streamingTimer) clearInterval(streamingTimer);
      }, 2000);
    } else {
      if (streamingTimer) clearInterval(streamingTimer);
    }
  }

  function disconnect() {
    if (ws) {
      ws.onclose = null; // Prevent auto-reconnect
      ws.close(1000, "User disconnected");
      ws = null;
    }
    if (streamingTimer) clearInterval(streamingTimer);
    sessionId = null;
    audioBuffer = [];
    bufferByteLength = 0;
  }

  function sendBeaconTerminate(sessionId_param?: string) {
    // Best-effort termination via sendBeacon
    const body = JSON.stringify({ 
      type: "Terminate",
      sessionId: sessionId_param || sessionId,
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/sessions/terminate-beacon", body);
    }
  }

  function getStreamingMinutes(): number {
    if (connectTime === 0) return 0;
    return (Date.now() - connectTime) / 60000;
  }

  function getState(): ASRClientState {
    return {
      connected: ws?.readyState === WebSocket.OPEN,
      sessionId,
      turnCount,
      streamingMinutes: getStreamingMinutes(),
      lastError: null,
    };
  }

  return {
    connect,
    sendAudio,
    terminate,
    disconnect,
    sendBeaconTerminate,
    getStreamingMinutes,
    getState,
  };
}

export type ASRClient = ReturnType<typeof createASRClient>;
