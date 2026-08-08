"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useParams } from "next/navigation";

interface ScenarioData {
  id: string;
  title: string;
  description: string;
  topic: string;
  durationMinutes: number;
  speakerCount: number;
  crossTalkLevel: string;
  difficulty: string;
  status: string;
  objective: string;
  criteria: string[];
  budget?: any;
  transcriptVersion?: number;
  transcriptQuality?: {
    score: number;
    errors: string[];
    warnings: string[];
    duplicateGroups: Array<{ turnIds: string[]; speakerNames: string[] }>;
    roundRobinRatio: number;
    reactionCoverage: number;
    overlapCount: number;
    realizedTimingCoverage: number;
    speakerTurnCounts: Array<{ speakerName: string; turns: number; words: number }>;
  };
  speakers?: Array<{
    index: number;
    name: string;
    voiceId: string;
    accent: string;
    timbreClass: string;
    role?: string;
    viewpoint?: string;
  }>;
  turns?: Array<{
    id?: string;
    index: number;
    speakerIndex: number;
    text: string;
    expectedCategory?: string;
    expected?: { substantive?: boolean; reactsToTurnId?: string; potentialSignal?: string };
    pauseBeforeMs?: number;
    startMs?: number;
    endMs?: number;
    isCalibration?: boolean;
    overlap?: {
      withTurnId: string;
      startBeforeEndMs?: number;
      startOffsetMs?: number;
      kind: string;
      resolution?: string;
    };
    delivery?: { pace: string; tone: string; volume: string; disfluency: string };
  }>;
  preflight?: {
    passed: boolean;
    mergedPairs: Array<[number, number]>;
    audioAvailable?: boolean;
    reason?: string;
    speechValidation?: {
      method: string;
      passed: boolean;
      sampledTurnCount: number;
      averageWordErrorRate: number | null;
    } | null;
  };
  approvedAt?: string;
  realizedDurationMs?: number;
}

export default function ScenarioDetailPage() {
  const params = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [revisionPreset, setRevisionPreset] = useState<"naturalize" | "timing" | "custom">("naturalize");
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisionPasses, setRevisionPasses] = useState(2);
  const [revisionSummary, setRevisionSummary] = useState<string[]>([]);

  const loadScenario = async () => {
    try {
      const res = await fetch(`/api/scenarios/${params.scenarioId}`);
      if (res.ok) setScenario(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadScenario(); }, [params.scenarioId]);

  const handleApprove = async () => {
    await runAction("Approving", "approve");
  };

  const handleSynthesize = async () => {
    await runAction("Rendering speech and mixing audio", "synthesize");
  };

  const handlePreflight = async () => {
    await runAction("Checking audio readiness", "preflight");
  };

  const handleRevise = async () => {
    setAction(`Revising transcript with ${revisionPasses} LLM call${revisionPasses === 1 ? "" : "s"}`);
    setActionError("");
    setRevisionSummary([]);
    try {
      const response = await fetch(`/api/scenarios/${params.scenarioId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: revisionPreset,
          instruction: revisionInstruction,
          passes: revisionPasses,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Transcript revision failed");
      setScenario(body.scenario);
      setRevisionSummary(body.changeSummaries || []);
    } catch (error: any) {
      setActionError(error?.message || "Transcript revision failed");
    } finally {
      setAction("");
    }
  };

  const runAction = async (label: string, endpoint: string) => {
    setAction(label);
    setActionError("");
    try {
      const response = await fetch(
        `/api/scenarios/${params.scenarioId}/${endpoint}`,
        { method: "POST" }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `${label} failed`);
      await loadScenario();
    } catch (error: any) {
      setActionError(error?.message || `${label} failed`);
    } finally {
      setAction("");
    }
  };

  const handleLaunch = async () => {
    const sRes = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: scenario!.title,
        objective: scenario!.objective,
        runMode: "sim_injected",
        scenarioId: scenario!.id,
        speakerCount: scenario!.speakerCount,
      }),
    });
    const session = await sRes.json();
    const rRes = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        scenarioId: scenario!.id,
        mode: "sim_injected",
      }),
    });
    const run = await rRes.json();
    router.push(`/simulator/${run.id}`);
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-hud-muted animate-pulse">Loading…</div>
      </main>
    );
  }

  if (!scenario) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-hud-danger">Scenario not found</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-3 pt-4">
          <button
            onClick={() => router.push("/scenarios")}
            className="text-hud-muted hover:text-hud-text transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-hud-text">{scenario.title}</h1>
            <div className="flex gap-3 text-xs text-hud-muted mt-1">
              <span>{scenario.durationMinutes}min</span>
              <span>{scenario.speakerCount} speakers</span>
              <span>{scenario.crossTalkLevel}</span>
              <span className={`px-2 py-0.5 rounded-full ${
                scenario.status === "approved" ? "bg-hud-success/20 text-hud-success" :
                scenario.status === "ready" ? "bg-hud-accent/20 text-hud-accent" :
                "bg-hud-muted/20 text-hud-muted"
              }`}>{scenario.status}</span>
            </div>
          </div>
        </header>

        {/* Objective */}
        <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-hud-muted uppercase mb-1">Objective</h3>
          <p className="text-hud-text">{scenario.objective}</p>
        </div>

        {/* Criteria */}
        {scenario.criteria?.length > 0 && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">Criteria</h3>
            <ul className="space-y-1">
              {scenario.criteria.map((c, i) => (
                <li key={i} className="text-sm text-hud-text flex gap-2">
                  <span className="text-hud-accent">•</span> {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Speakers */}
        {scenario.speakers != null && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">
              Speakers ({(scenario.speakers?.length ?? 0)})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {scenario.speakers?.map(s => (
                <div key={s.index} className="bg-hud-bg rounded-lg p-3">
                  <div className="font-medium text-hud-text text-sm">{s.name}</div>
                  <div className="text-xs text-hud-muted">
                    {s.voiceId} · {s.accent} · {s.timbreClass}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget */}
        {scenario.budget && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">Budget</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-hud-muted text-xs">Turns</span><p className="text-hud-text font-mono">{scenario.budget.estimatedTurns}</p></div>
              <div><span className="text-hud-muted text-xs">Characters</span><p className="text-hud-text font-mono">{scenario.budget.estimatedCharacters?.toLocaleString()}</p></div>
              <div><span className="text-hud-muted text-xs">Cost</span><p className="text-hud-text font-mono">${scenario.budget.estimatedCostUsd?.toFixed(2)}</p></div>
            </div>
          </div>
        )}

        {/* Transcript quality */}
        {scenario.transcriptQuality && (
          <div className={`rounded-xl border p-4 ${
            scenario.transcriptQuality.errors.length
              ? "border-hud-danger/30 bg-hud-danger/10"
              : scenario.transcriptQuality.warnings.length
                ? "border-hud-warn/30 bg-hud-warn/10"
                : "border-hud-success/30 bg-hud-success/10"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase text-hud-muted">
                  Transcript quality · format v{scenario.transcriptVersion || 2}
                </h3>
                <p className="text-2xl font-mono text-hud-text mt-1">
                  {scenario.transcriptQuality.score}<span className="text-sm text-hud-muted">/100</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-right">
                <div><span className="text-hud-muted">Overlap</span><p className="text-hud-text">{scenario.transcriptQuality.overlapCount}</p></div>
                <div><span className="text-hud-muted">Reaction links</span><p className="text-hud-text">{Math.round(scenario.transcriptQuality.reactionCoverage * 100)}%</p></div>
                <div><span className="text-hud-muted">Round-robin</span><p className="text-hud-text">{Math.round(scenario.transcriptQuality.roundRobinRatio * 100)}%</p></div>
              </div>
            </div>
            {(scenario.transcriptQuality.errors.length > 0 || scenario.transcriptQuality.warnings.length > 0) && (
              <ul className="mt-3 space-y-1 text-sm">
                {scenario.transcriptQuality.errors.map((message, index) => (
                  <li key={`error-${index}`} className="text-hud-danger">• {message}</li>
                ))}
                {scenario.transcriptQuality.warnings.map((message, index) => (
                  <li key={`warning-${index}`} className="text-hud-warn">• {message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Preflight */}
        {scenario.preflight && (
          <div className={`rounded-xl p-4 border ${
            scenario.preflight.passed
              ? "bg-hud-success/10 border-hud-success/30"
              : "bg-hud-warn/10 border-hud-warn/30"
          }`}>
            <h3 className="text-xs font-semibold uppercase mb-1"
              style={{ color: scenario.preflight.passed ? "var(--color-hud-success)" : "var(--color-hud-warn)" }}>
              Preflight: {scenario.preflight.passed ? "Passed ✓" : "Failed ✗"}
            </h3>
            {!scenario.preflight.passed && scenario.preflight.mergedPairs?.length > 0 && (
              <p className="text-sm text-hud-text">
                Merged speakers: {scenario.preflight.mergedPairs.map(([a, b]) =>
                  `${scenario.speakers?.[a]?.name || a} ↔ ${scenario.speakers?.[b]?.name || b}`
                ).join(", ")}
              </p>
            )}
            {scenario.preflight.reason && (
              <p className="text-sm text-hud-text mt-1">{scenario.preflight.reason}</p>
            )}
            {scenario.preflight.speechValidation && (
              <p className="text-xs text-hud-muted mt-2">
                Audio check: {scenario.preflight.speechValidation.method.replace(/_/g, " ")}
                {scenario.preflight.speechValidation.sampledTurnCount > 0 && (
                  <> · {scenario.preflight.speechValidation.sampledTurnCount} clips · average WER {
                    Math.round((scenario.preflight.speechValidation.averageWordErrorRate || 0) * 100)
                  }%</>
                )}
              </p>
            )}
          </div>
        )}

        {/* LLM transcript workshop */}
        {scenario.turns != null && scenario.speakers != null && (
          <section className="bg-hud-surface border border-hud-border rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-hud-muted uppercase">Transcript workshop</h3>
              <p className="text-sm text-hud-muted mt-1">
                Run one focused pass or chain up to three calls. Each call receives the full speaker-, timing-, reaction-, and overlap-aware transcript plus the preceding result.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <div>
                <label className="block text-xs text-hud-muted mb-1">Revision focus</label>
                <select
                  value={revisionPreset}
                  onChange={(event) => setRevisionPreset(event.target.value as typeof revisionPreset)}
                  className="w-full bg-hud-bg border border-hud-border rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="naturalize">Naturalize dialogue</option>
                  <option value="timing">Timing and overlap</option>
                  <option value="custom">Custom instruction</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-hud-muted mb-1">Sequential LLM calls</label>
                <select
                  value={revisionPasses}
                  onChange={(event) => setRevisionPasses(Number(event.target.value))}
                  className="w-full bg-hud-bg border border-hud-border rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value={1}>1 call</option>
                  <option value={2}>2 calls</option>
                  <option value={3}>3 calls</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-hud-muted mb-1">
                {revisionPreset === "custom" ? "Required instruction" : "Additional direction (optional)"}
              </label>
              <textarea
                value={revisionInstruction}
                onChange={(event) => setRevisionInstruction(event.target.value)}
                rows={3}
                placeholder={revisionPreset === "custom"
                  ? "e.g. Make the service owner more skeptical, preserve the accessibility decision, and add one repaired misunderstanding."
                  : "Preserve any details that must not change…"}
                className="w-full bg-hud-bg border border-hud-border rounded-lg px-3 py-2.5 text-sm resize-y"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRevise}
                disabled={Boolean(action) || (revisionPreset === "custom" && !revisionInstruction.trim())}
                className="px-4 py-3 bg-hud-accent text-white rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ minHeight: 48 }}
              >
                Revise transcript
              </button>
              <p className="text-xs text-hud-warn">
                A successful edit invalidates the old mix; synthesize and preflight again.
              </p>
            </div>
            {revisionSummary.length > 0 && (
              <div className="rounded-lg border border-hud-success/30 bg-hud-success/10 p-3">
                <p className="text-xs font-semibold text-hud-success uppercase">Revision complete</p>
                <ol className="mt-1 space-y-1 text-sm text-hud-text">
                  {revisionSummary.map((summary, index) => <li key={index}>{index + 1}. {summary}</li>)}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Timed transcript */}
        {scenario.turns != null && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">
              Timed transcript ({scenario.turns?.length ?? 0} utterances)
            </h3>
            <div className="space-y-1 max-h-[38rem] overflow-y-auto">
              {scenario.turns?.map(t => {
                const speaker = scenario.speakers?.find(s => s.index === t.speakerIndex);
                const anchor = t.overlap
                  ? scenario.turns?.find(candidate => (candidate.id || `t${candidate.index}`) === t.overlap?.withTurnId)
                  : null;
                const anchorSpeaker = anchor
                  ? scenario.speakers?.find(candidate => candidate.index === anchor.speakerIndex)
                  : null;
                return (
                  <div key={t.id || t.index} className="grid grid-cols-[76px_1fr] gap-3 py-3 border-b border-hud-border/30 last:border-0">
                    <div className="text-xs font-mono">
                      <p className="text-hud-accent">{speaker?.name || `S${t.speakerIndex}`}</p>
                      <p className="text-hud-muted mt-1">{formatTurnTime(t)}</p>
                      <p className="text-hud-muted">{t.id || `t${t.index}`}</p>
                    </div>
                    <div>
                      <p className="text-sm text-hud-text leading-relaxed">{t.text}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]">
                        {t.isCalibration && <span className="text-hud-muted">calibration</span>}
                        {t.expectedCategory && <span className="text-hud-accent">{t.expectedCategory}</span>}
                        {t.expected?.reactsToTurnId && <span className="text-hud-muted">↳ responds to {t.expected.reactsToTurnId}</span>}
                        {t.overlap && (
                          <span className="text-hud-warn">
                            ⟷ {t.overlap.kind} · starts {t.overlap.startBeforeEndMs ?? t.overlap.startOffsetMs ?? 0}ms before {anchorSpeaker?.name || t.overlap.withTurnId} ends · {t.overlap.resolution || "resolves"}
                          </span>
                        )}
                        {t.delivery && (
                          <span className="text-hud-muted">
                            {t.delivery.pace} · {t.delivery.volume} · {t.delivery.disfluency.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pb-8">
          {(action || actionError) && (
            <div className={`w-full rounded-xl border p-3 text-sm ${
              actionError
                ? "border-hud-danger/30 bg-hud-danger/10 text-hud-danger"
                : "border-hud-accent/30 bg-hud-accent/10 text-hud-text"
            }`}>
              {actionError || `${action}… This can take several minutes.`}
            </div>
          )}
          <button
            onClick={handleSynthesize}
            disabled={Boolean(action)}
            className="px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-sm font-medium
              hover:border-hud-accent transition-all touch-manipulation disabled:opacity-50"
            style={{ minHeight: 48 }}
          >
            {scenario.realizedDurationMs ? "Re-synthesize Audio" : "Synthesize Audio"}
          </button>
          {(scenario.status === "rendered" || scenario.status === "ready") && (
            <button
              onClick={handlePreflight}
              disabled={Boolean(action)}
              className="px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-sm font-medium
                hover:border-hud-accent transition-all touch-manipulation disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              Run Preflight
            </button>
          )}
          {scenario.status === "ready" && (
            <button
              onClick={handleApprove}
              disabled={Boolean(action)}
              className="px-4 py-3 bg-hud-accent text-white rounded-xl text-sm font-medium
                hover:bg-hud-accent-dim transition-all touch-manipulation disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              Approve
            </button>
          )}
          <button
            onClick={handleLaunch}
            disabled={
              Boolean(action) ||
              !["ready", "approved"].includes(scenario.status) ||
              !scenario.preflight?.passed ||
              !scenario.preflight?.audioAvailable
            }
            className="px-4 py-3 bg-hud-success text-white rounded-xl text-sm font-medium
              hover:opacity-90 transition-all touch-manipulation ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: 48 }}
          >
            ▶ Launch Simulation
          </button>
        </div>
      </div>
    </main>
  );
}

function formatTurnTime(turn: NonNullable<ScenarioData["turns"]>[number]) {
  if (Number.isFinite(turn.startMs) && Number.isFinite(turn.endMs)) {
    return `${formatMs(turn.startMs!)}–${formatMs(turn.endMs!)}`;
  }
  if (turn.overlap) return "planned overlap";
  return `+${turn.pauseBeforeMs || 0}ms gap`;
}

function formatMs(value: number) {
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const milliseconds = Math.floor(value % 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
