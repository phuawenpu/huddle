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

/**
 * Resolve the speaker nearest the live edge of a streaming Turn. The provider's
 * turn-level label describes the dominant speaker, so it can remain `A` when a
 * second speaker enters near the end of the same Turn. Final word labels are
 * temporally precise and therefore take precedence for the current-speaker UI.
 */
export function latestAttributedSpeakerLabel(
  turn: Pick<TurnEvent, "speakerLabel" | "words">,
): string | null {
  const latestWordLabel = [...(turn.words || [])]
    .reverse()
    .find(
      (word) => word.wordIsFinal && !isUnknownSpeakerLabel(word.speaker),
    )?.speaker;
  if (latestWordLabel) return latestWordLabel.trim();
  return isUnknownSpeakerLabel(turn.speakerLabel)
    ? null
    : String(turn.speakerLabel).trim();
}

export interface WordEvent {
  text: string;
  start: number;
  end: number;
  confidence: number;
  wordIsFinal: boolean;
  speaker?: string;
}

function isUnknownSpeakerLabel(label: string | undefined): boolean {
  const normalized = String(label || "")
    .trim()
    .toUpperCase();
  return !normalized || normalized === "UNKNOWN" || normalized === "PENDING";
}

function persistedSpeakerLabel(label: string | undefined): string {
  const normalized = String(label || "").trim();
  return isUnknownSpeakerLabel(normalized) ? "UNKNOWN" : normalized;
}

function normalizeWord(word: any): WordEvent {
  return {
    text: String(word?.text || word?.word || ""),
    start: Number(word?.start) || 0,
    end: Number(word?.end) || 0,
    confidence: Number(word?.confidence) || 0,
    wordIsFinal: Boolean(word?.wordIsFinal ?? word?.word_is_final ?? true),
    speaker: word?.speaker ? String(word.speaker) : undefined,
  };
}

function joinWordText(words: WordEvent[]): string {
  return words
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Split a finalized provider turn whenever word-level diarization changes
 * speaker. AssemblyAI can put a brief interjection and the surrounding speech
 * in one Turn, so persisting the whole Turn under its dominant label loses a
 * participant even when the word labels are present.
 */
export function segmentFinalTurn(
  turn: TurnEvent,
  providerSessionId: string,
  receivedAtMs: number,
): IngestTurnData[] {
  const words = (turn.words || []).map(normalizeWord);
  if (words.length === 0) {
    const label = persistedSpeakerLabel(turn.speakerLabel);
    return [
      {
        providerSessionId,
        providerTurnOrder: turn.turnOrder,
        segmentIndex: 0,
        providerSpeakerLabel: label,
        startMs: 0,
        endMs: 0,
        receivedAtMs,
        originalText: turn.transcript,
        currentText: turn.transcript,
        isFinal: true,
        isUnknownSpeaker: isUnknownSpeakerLabel(label),
        possibleOverlap: false,
      },
    ];
  }

  // The provider can temporarily emit PENDING on early final words while the
  // rest of the same turn already has a stable label. Treat it as unattributed,
  // and fold it into the sole known speaker when that is unambiguous.
  const knownWordLabels = new Set(
    words
      .map((word) => String(word.speaker || "").trim())
      .filter((label) => !isUnknownSpeakerLabel(label)),
  );
  const soleKnownWordLabel =
    knownWordLabels.size === 1 ? [...knownWordLabels][0] : undefined;
  const knownTurnLabel = isUnknownSpeakerLabel(turn.speakerLabel)
    ? undefined
    : String(turn.speakerLabel).trim();
  const fallbackLabel = knownTurnLabel || soleKnownWordLabel;
  const attributedWords = words.map((word) => {
    const suppliedLabel = String(word.speaker || "").trim();
    const label =
      !suppliedLabel || suppliedLabel.toUpperCase() === "PENDING"
        ? fallbackLabel || "UNKNOWN"
        : persistedSpeakerLabel(suppliedLabel);
    return { ...word, speaker: label };
  });

  const groups: Array<{ label: string; words: WordEvent[] }> = [];
  for (const word of attributedWords) {
    const label = word.speaker || "UNKNOWN";
    const previous = groups.at(-1);
    if (previous && previous.label === label) {
      previous.words.push(word);
    } else {
      groups.push({ label, words: [word] });
    }
  }

  const hasCrossSpeakerTimingCollision = groups.some((group, index) => {
    if (index === 0) return false;
    const previous = groups[index - 1];
    const previousEnd = previous.words.at(-1)?.end ?? 0;
    const currentStart = group.words[0]?.start ?? previousEnd;
    const gapMs = currentStart - previousEnd;
    return (
      group.label !== previous.label &&
      (gapMs < 0 ||
        (gapMs <= 120 &&
          !isUnknownSpeakerLabel(group.label) &&
          !isUnknownSpeakerLabel(previous.label)))
    );
  });

  return groups.map((group, segmentIndex) => ({
    providerSessionId,
    providerTurnOrder: turn.turnOrder,
    segmentIndex,
    providerSpeakerLabel: group.label,
    startMs: group.words[0].start,
    endMs: group.words[group.words.length - 1].end,
    receivedAtMs,
    originalText: joinWordText(group.words),
    currentText: joinWordText(group.words),
    wordsJson: group.words,
    isFinal: true,
    isUnknownSpeaker: isUnknownSpeakerLabel(group.label),
    possibleOverlap: hasCrossSpeakerTimingCollision,
  }));
}

export interface SpeechStartedEvent {
  timestamp: number;
  speakerLabel?: string;
}

export interface SpeakerRevisionEvent {
  revisions: Array<{
    turnOrder: number;
    speakerLabel: string;
    words: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
      speaker: string;
    }>;
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
  let intentionallyClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_BUFFER_BYTES = 5 * 32000; // 5s of audio at 16kHz mono

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => resolve(), { once: true });
        return;
      }

      intentionallyClosed = false;
      let settled = false;
      let opened = false;
      const settleResolve = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectionTimeout);
        resolve();
      };
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectionTimeout);
        reject(error);
      };
      const connectionTimeout = setTimeout(() => {
        intentionallyClosed = true;
        ws?.close(1000, "Connection timeout");
        ws = null;
        settleReject(new Error("ASR connection timed out after 12 seconds."));
      }, 12_000);

      try {
        ws = new WebSocket(wsUrl);
      } catch (err: any) {
        settleReject(new Error(`WebSocket creation failed: ${err.message}`));
        return;
      }

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        opened = true;
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

        settleResolve();
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
              const words = Array.isArray(msg.words)
                ? msg.words.map(normalizeWord)
                : [];
              const turn: TurnEvent = {
                turnOrder: msg.turn_order,
                endOfTurn: msg.end_of_turn,
                transcript: msg.transcript || "",
                speakerLabel: msg.speaker_label,
                words,
                languageCode: msg.language_code,
                languageConfidence: msg.language_confidence,
              };
              onTurn?.(turn);

              // If final, ingest to server
              if (msg.end_of_turn && onTurnIngest && sessionId) {
                const segments = segmentFinalTurn(
                  turn,
                  sessionId,
                  Date.now() - connectTime,
                );
                void (async () => {
                  for (const segment of segments) {
                    await onTurnIngest(segment);
                  }
                })().catch((error) => {
                  onError?.(
                    error instanceof Error
                      ? error
                      : new Error("Final ASR turn could not be ingested."),
                  );
                });
              }
              break;
            }

            case "SpeakerRevision":
              onSpeakerRevision?.({
                revisions: (msg.revisions || []).map((revision: any) => ({
                  turnOrder: revision.turn_order ?? revision.turnOrder,
                  speakerLabel:
                    revision.speaker_label ?? revision.speakerLabel ?? "",
                  words: (revision.words || []).map((word: any) => ({
                    text: String(word?.text || word?.word || ""),
                    start: Number(word?.start) || 0,
                    end: Number(word?.end) || 0,
                    confidence: Number(word?.confidence) || 0,
                    speaker: word?.speaker ? String(word.speaker) : "",
                  })),
                })),
              });
              break;

            case "Termination":
              if (streamingTimer) clearInterval(streamingTimer);
              onTermination?.({
                audioDurationSeconds:
                  msg.audio_duration_seconds ?? msg.audioDurationSeconds ?? 0,
                sessionDurationSeconds:
                  msg.session_duration_seconds ??
                  msg.sessionDurationSeconds ??
                  0,
              });
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
        const error = new Error("ASR WebSocket connection failed");
        onError?.(error);
        settleReject(error);
      };

      ws.onclose = (event) => {
        const wasOpen = opened;
        ws = null;
        sessionId = null;
        if (streamingTimer) clearInterval(streamingTimer);
        onConnectionChange?.(false);
        if (!wasOpen) {
          settleReject(
            new Error(
              `ASR connection closed before it opened (code ${event.code || "unknown"}).`,
            ),
          );
        }

        // Auto-reconnect on abnormal close (not clean termination)
        if (
          wasOpen &&
          !intentionallyClosed &&
          event.code !== 1000 &&
          event.code !== 1005
        ) {
          reconnectTimer = setTimeout(() => {
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
    intentionallyClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
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
    intentionallyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
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
