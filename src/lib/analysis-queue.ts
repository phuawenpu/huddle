// ============================================
// Analysis Queue — Batched LLM turn analysis
// ============================================
// Collects finalized substantive turns and batches them
// for analysis. Window analysis runs every 10s or after
// 3 new analyzed substantive turns.

import { prisma } from "./db";
import { analyzeTurnBatch, analyzeWindow, generatePrompt } from "./analysis";
import { publish } from "./pubsub";
import {
  turnUpdatedPatch,
  promptShowPatch,
  metricsPatch,
  intelligencePatch,
  promptClearPatch,
  windowAnalysisPatch,
} from "./sse";
import { checkPromptGuard } from "./guard";
import { calculateMetrics } from "./metrics";
import {
  buildCritiqueIntelligence,
  discussionItemsForAnalysis,
  normalizeCriteria,
} from "./critique-intelligence";

const BATCH_WINDOW_MS = 1500;
const WINDOW_INTERVAL_MS = 10000;
const WINDOW_TURN_THRESHOLD = 3;
const MAX_CONCURRENCY = 2;

interface PendingTurn {
  id: string;
  sessionId: string;
  speakerLabel: string;
  text: string;
  receivedAtMs: number;
  enqueuedAtEpochMs: number;
}

// Per-session state
const sessionQueues = new Map<
  string,
  {
    pending: PendingTurn[];
    timer: ReturnType<typeof setTimeout> | null;
    windowTimer: ReturnType<typeof setInterval> | null;
    analyzedSinceWindow: number;
    activeAnalyses: number;
    lastPromptId: string | null;
    promptTimer: ReturnType<typeof setTimeout> | null;
    windowAnalysisInFlight: boolean;
    lastWindowThroughTurnId: string | null;
  }
>();

function getSessionQueue(sessionId: string) {
  if (!sessionQueues.has(sessionId)) {
    sessionQueues.set(sessionId, {
      pending: [],
      timer: null,
      windowTimer: null,
      analyzedSinceWindow: 0,
      activeAnalyses: 0,
      lastPromptId: null,
      promptTimer: null,
      windowAnalysisInFlight: false,
      lastWindowThroughTurnId: null,
    });
  }
  return sessionQueues.get(sessionId)!;
}

/**
 * Enqueue a finalized substantive turn for analysis.
 */
export function enqueueTurn(turn: PendingTurn): void {
  const q = getSessionQueue(turn.sessionId);
  q.pending.push(turn);

  // Reset batch timer
  if (q.timer) clearTimeout(q.timer);
  q.timer = setTimeout(() => flushBatch(turn.sessionId), BATCH_WINDOW_MS);
}

/**
 * Start the window analysis interval for a session.
 */
export function startWindowAnalysis(sessionId: string): void {
  const q = getSessionQueue(sessionId);
  if (q.windowTimer) return;

  q.windowTimer = setInterval(
    () => runWindowAnalysis(sessionId),
    WINDOW_INTERVAL_MS,
  );
}

/**
 * Stop window analysis for a session.
 */
export function stopWindowAnalysis(sessionId: string): void {
  const q = sessionQueues.get(sessionId);
  if (!q) return;
  if (q.windowTimer) clearInterval(q.windowTimer);
  if (q.timer) clearTimeout(q.timer);
  if (q.promptTimer) clearTimeout(q.promptTimer);
  sessionQueues.delete(sessionId);
}

async function flushBatch(sessionId: string): Promise<void> {
  const q = sessionQueues.get(sessionId);
  if (!q || q.pending.length === 0) return;

  const batch = q.pending.splice(0);
  if (q.activeAnalyses >= MAX_CONCURRENCY) {
    // Re-queue for later
    q.pending.unshift(...batch);
    q.timer = setTimeout(() => flushBatch(sessionId), BATCH_WINDOW_MS);
    return;
  }

  q.activeAnalyses++;

  try {
    // Get session config
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { objective: true, phase: true, criteria: true, runMode: true },
    });

    if (!session) return;

    const config = {
      sessionObjective: session.objective,
      sessionPhase: session.phase,
      sessionCriteria: normalizeCriteria(safeParseJson(session.criteria, [])),
      runMode: session.runMode,
    };

    // Analyze turns
    const results = await analyzeTurnBatch(
      batch.map((t) => ({
        id: t.id,
        speakerLabel: t.speakerLabel,
        text: t.text,
        isSubstantive: true,
      })),
      config,
    );

    // Store results
    for (const [turnId, analysis] of results) {
      const pendingTurn = batch.find((turn) => turn.id === turnId);
      const analysisLatencyMs = pendingTurn
        ? Math.max(0, Date.now() - pendingTurn.enqueuedAtEpochMs)
        : 0;
      await prisma.transcriptTurn.update({
        where: { id: turnId },
        data: {
          analysisJson: JSON.stringify(analysis),
          // Both timestamps are session-relative milliseconds. Storing epoch
          // milliseconds in a Prisma Int overflows and makes latency invalid.
          analysisReceivedAtMs:
            (pendingTurn?.receivedAtMs ?? 0) + analysisLatencyMs,
        },
      });

      // Update discussion items from the bounded, source-linked signals.
      const turn = batch.find((t) => t.id === turnId);
      if (turn) {
        const candidates = discussionItemsForAnalysis(
          turnId,
          analysis,
          turn.text,
        );
        for (const candidate of candidates) {
          const turnIds = JSON.stringify(candidate.turnIds);
          const existing = await prisma.discussionItem.findFirst({
            where: {
              sessionId,
              category: candidate.category,
              text: candidate.text,
              turnIds,
            },
          });
          if (existing) continue;
          const item = await prisma.discussionItem.create({
            data: {
              sessionId,
              category: candidate.category,
              text: candidate.text,
              // AI-derived map items remain private drafts. Only an explicit
              // facilitator publication is sent to the shared display.
              status: "draft",
              turnIds,
            },
          });
          void item;
        }
      }

      // Broadcast turn update with analysis
      const updated = await prisma.transcriptTurn.findUnique({
        where: { id: turnId },
      });
      if (updated) {
        publish(sessionId, turnUpdatedPatch(serializeTurn(updated)));
      }
    }

    q.analyzedSinceWindow += results.size;

    // Run window analysis if threshold met
    if (q.analyzedSinceWindow >= WINDOW_TURN_THRESHOLD) {
      await runWindowAnalysis(sessionId);
    }

    // Update metrics
    const allTurns = await prisma.transcriptTurn.findMany({
      where: { sessionId, isFinal: true },
    });
    const metrics = calculateMetrics(
      allTurns.map((t) => ({
        ...t,
        participantId: t.participantId ?? undefined,
        wordsJson: safeParseJson(t.wordsJson, undefined),
        analysis: safeParseJson(t.analysisJson, undefined),
      })) as any,
    );
    publish(sessionId, metricsPatch(metrics));
    const intelligence = buildCritiqueIntelligence(
      allTurns.map((t) => ({
        ...t,
        participantId: t.participantId ?? undefined,
        wordsJson: safeParseJson(t.wordsJson, undefined),
        analysis: safeParseJson(t.analysisJson, undefined),
        analysisReceivedAtMs: t.analysisReceivedAtMs ?? undefined,
      })) as any,
      config.sessionCriteria,
    );
    publish(sessionId, intelligencePatch(intelligence));
  } catch (err) {
    console.error("Analysis batch failed:", err);
  } finally {
    q.activeAnalyses--;
    if (q.pending.length > 0) {
      q.timer = setTimeout(() => flushBatch(sessionId), BATCH_WINDOW_MS);
    }
  }
}

async function runWindowAnalysis(sessionId: string): Promise<void> {
  const q = sessionQueues.get(sessionId);
  if (!q || q.windowAnalysisInFlight) return;
  q.windowAnalysisInFlight = true;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        objective: true,
        phase: true,
        criteria: true,
        runMode: true,
        participants: true,
      },
    });
    if (!session) return;

    // Get last 20 substantive turns
    const recentTurns = await prisma.transcriptTurn.findMany({
      where: { sessionId, isFinal: true, isSubstantive: true },
      orderBy: { receivedAtMs: "desc" },
      take: 20,
    });

    if (recentTurns.length === 0) return;

    const config = {
      sessionObjective: session.objective,
      sessionPhase: session.phase,
      sessionCriteria: normalizeCriteria(safeParseJson(session.criteria, [])),
      runMode: session.runMode,
    };

    const chronologicalTurns = [...recentTurns].reverse();
    const throughTurn = chronologicalTurns.at(-1)!;
    if (q.lastWindowThroughTurnId === throughTurn.id) return;
    const windowAnalysis = await analyzeWindow(
      chronologicalTurns.map((t) => ({
        id: t.id,
        speakerLabel: t.providerSpeakerLabel,
        text: t.currentText,
        category: safeParseJson(t.analysisJson, undefined)?.category,
        isSubstantive: t.isSubstantive,
      })),
      [],
      config,
    );

    q.lastWindowThroughTurnId = throughTurn.id;
    publish(
      sessionId,
      windowAnalysisPatch({
        ...windowAnalysis,
        throughTurnId: throughTurn.id,
        throughMs: throughTurn.endMs,
        analyzedTurnCount: chronologicalTurns.length,
        generatedAt: new Date().toISOString(),
      }),
    );

    // Generate facilitation prompt
    const prompt = generatePrompt(windowAnalysis, config);
    if (prompt) {
      // Check guard
      const guardResult = checkPromptGuard(
        prompt.text,
        session.participants.map((participant) => ({
          ...participant,
          sessionId,
        })),
        config.sessionObjective,
      );
      if (guardResult.allowed) {
        const promptRecord = await prisma.promptRecord.create({
          data: {
            sessionId,
            text: prompt.text,
            supportingTurnIds: JSON.stringify(prompt.supportingTurnIds),
            confidence: prompt.confidence,
            shown: false,
            dismissed: false,
            guardRejected: false,
            expiresAt: new Date(Date.now() + 15000), // 15s auto-dismiss
          },
        });

        // Clear any previous prompt
        if (q.lastPromptId) {
          publish(sessionId, promptClearPatch());
        }
        q.lastPromptId = promptRecord.id;

        // Show the prompt
        publish(
          sessionId,
          promptShowPatch({
            id: promptRecord.id,
            text: prompt.text,
            confidence: prompt.confidence,
            supportingTurnIds: prompt.supportingTurnIds,
          }),
        );

        // Auto-dismiss after 15s
        if (q.promptTimer) clearTimeout(q.promptTimer);
        q.promptTimer = setTimeout(async () => {
          await prisma.promptRecord.update({
            where: { id: promptRecord.id },
            data: { shown: true },
          });
          publish(sessionId, promptClearPatch());
          q.lastPromptId = null;
        }, 15000);
      } else {
        // Log rejected prompt
        await prisma.promptRecord.create({
          data: {
            sessionId,
            text: prompt.text,
            supportingTurnIds: JSON.stringify(prompt.supportingTurnIds),
            confidence: prompt.confidence,
            shown: false,
            dismissed: false,
            guardRejected: true,
            rejectReason: guardResult.reason,
          },
        });
      }
    }

    q.analyzedSinceWindow = 0;
  } catch (err) {
    console.error("Window analysis failed:", err);
  } finally {
    q.windowAnalysisInFlight = false;
  }
}

function serializeTurn(t: any) {
  return {
    ...t,
    participantId: t.participantId ?? undefined,
    wordsJson: safeParseJson(t.wordsJson, null),
    analysis: safeParseJson(t.analysisJson, null),
    analysisJson: undefined,
    session: undefined,
  };
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
