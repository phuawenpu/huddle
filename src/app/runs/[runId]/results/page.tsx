"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface RunData {
  id: string;
  sessionId: string;
  scenarioId?: string;
  mode: string;
  stubbed: boolean;
  status: string;
  evaluation?: {
    speakerAccuracyExcludingOverlaps: number;
    overlapOnlyAccuracy: number;
    unknownSubstantiveRate: number;
    lostFinalizedTurns: number;
    guardViolationsDisplayed: number;
    realizedVsRequestedDurationPct: number;
    perFieldAgreement: Record<string, number>;
    latencyPercentiles: any;
    scenarioProfile: any;
  };
  deviations?: string[];
}

interface TurnData {
  id: string;
  providerSpeakerLabel: string;
  currentText: string;
  startMs: number;
  endMs: number;
  isSubstantive: boolean;
  isCalibration: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
  analysis?: { category?: string };
  wordsJson?: any[];
}

interface ScenarioData {
  id: string;
  title: string;
  speakers?: Array<{ index: number; name: string }>;
  turns?: Array<{ index: number; speakerIndex: number; text: string; expectedCategory?: string }>;
}

export default function ResultsPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [run, setRun] = useState<RunData | null>(null);
  const [turns, setTurns] = useState<TurnData[]>([]);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) throw new Error("Failed to load run");
        const data = await res.json();
        setRun(data);
        if (data.sessionId) {
          const tRes = await fetch(`/api/sessions/${data.sessionId}/turns`);
          if (tRes.ok) setTurns(await tRes.json());
        }
        if (data.scenarioId) {
          const sRes = await fetch(`/api/scenarios/${data.scenarioId}`);
          if (sRes.ok) setScenario(await sRes.json());
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [runId]);

  const handleEvaluate = async () => {
    await fetch(`/api/runs/${runId}/evaluate`, { method: "POST" });
    // Reload
    const res = await fetch(`/api/runs/${runId}`);
    if (res.ok) setRun(await res.json());
  };

  const handleExportJSON = async () => {
    const res = await fetch(`/api/runs/${runId}/export.json`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${runId}.json`;
    a.click();
  };

  const handleExportCSV = async () => {
    const res = await fetch(`/api/runs/${runId}/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${runId}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-hud-muted animate-pulse">Loading results…</div>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-hud-danger">Run not found</div>
      </main>
    );
  }

  const eval_ = run.evaluation;
  const substantiveTurns = turns.filter(t => t.isSubstantive && !t.isCalibration);
  const unknownCount = substantiveTurns.filter(t => t.isUnknownSpeaker).length;

  const formatPct = (n: number) => `${Math.round(n * 100)}%`;
  const formatMs = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

  return (
    <main className="min-h-dvh p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-3 pt-4">
          <button
            onClick={() => router.push(`/simulator/${runId}`)}
            className="text-hud-muted hover:text-hud-text transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-hud-text">Results</h1>
            <p className="text-hud-muted text-sm">
              {run.mode} · {run.stubbed ? "stubbed" : "live"} · {run.status}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEvaluate}
              className="px-3 py-2 text-xs bg-hud-accent text-white rounded-lg touch-manipulation"
              style={{ minHeight: 40 }}
            >
              {eval_ ? "Re-Evaluate" : "Evaluate"}
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 text-xs bg-hud-surface border border-hud-border rounded-lg text-hud-text touch-manipulation"
              style={{ minHeight: 40 }}
            >
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs bg-hud-surface border border-hud-border rounded-lg text-hud-text touch-manipulation"
              style={{ minHeight: 40 }}
            >
              CSV
            </button>
          </div>
        </header>

        {eval_ ? (
          <>
            {/* Accuracy */}
            <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-hud-muted uppercase mb-3">Speaker Accuracy</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Excluding Overlaps (headline)</div>
                  <div className="text-2xl font-bold text-hud-text font-mono">
                    {formatPct(eval_.speakerAccuracyExcludingOverlaps)}
                  </div>
                </div>
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Overlap Only</div>
                  <div className="text-2xl font-bold text-hud-text font-mono">
                    {formatPct(eval_.overlapOnlyAccuracy)}
                  </div>
                </div>
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Unknown Rate</div>
                  <div className="text-2xl font-bold text-hud-text font-mono">
                    {formatPct(eval_.unknownSubstantiveRate)}
                  </div>
                </div>
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Lost Turns</div>
                  <div className="text-2xl font-bold text-hud-text font-mono">
                    {eval_.lostFinalizedTurns}
                  </div>
                </div>
              </div>
            </div>

            {/* Latency */}
            <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-hud-muted uppercase mb-3">Latency</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {eval_.latencyPercentiles && Object.entries(eval_.latencyPercentiles).map(([k, v]) => (
                  <div key={k} className="bg-hud-bg rounded-lg p-3">
                    <div className="text-xs text-hud-muted">{k}</div>
                    <div className="font-mono text-hud-text">{formatMs(v as number)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-Field Agreement */}
            <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-hud-muted uppercase mb-3">Classification</h2>
              <div className="space-y-2">
                {eval_.perFieldAgreement && Object.entries(eval_.perFieldAgreement).map(([field, pct]) => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="text-xs text-hud-text w-24">{field}</span>
                    <div className="flex-1 bg-hud-bg rounded-full h-2">
                      <div
                        className="h-full bg-hud-accent rounded-full transition-all"
                        style={{ width: `${(pct as number) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-hud-muted w-12 text-right">
                      {formatPct(pct as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety */}
            <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-hud-muted uppercase mb-3">Safety</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Guard Violations</div>
                  <div className={`text-xl font-bold font-mono ${
                    eval_.guardViolationsDisplayed === 0 ? "text-hud-success" : "text-hud-danger"
                  }`}>
                    {eval_.guardViolationsDisplayed}
                  </div>
                </div>
                <div className="bg-hud-bg rounded-lg p-3">
                  <div className="text-xs text-hud-muted">Duration Match</div>
                  <div className="text-xl font-bold font-mono text-hud-text">
                    {Math.round(eval_.realizedVsRequestedDurationPct)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Deviations */}
            {run.deviations?.length ? (
              <div className="bg-hud-warn/10 border border-hud-warn/30 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-hud-warn uppercase mb-2">Deviations</h2>
                <ul className="space-y-1">
                  {run.deviations.map((d, i) => (
                    <li key={i} className="text-sm text-hud-text">{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-8 text-center">
            <p className="text-hud-muted mb-4">No evaluation yet</p>
            <button
              onClick={handleEvaluate}
              className="px-6 py-3 bg-hud-accent text-white rounded-xl font-semibold touch-manipulation"
              style={{ minHeight: 48 }}
            >
              Run Evaluation
            </button>
          </div>
        )}

        {/* Transcript Table */}
        <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-hud-muted uppercase mb-3">
            Transcript ({substantiveTurns.length} substantive turns)
          </h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {substantiveTurns.map(t => {
              const scenarioTurn = scenario?.turns?.find((_, i) => i === turns.indexOf(t));
              return (
                <div key={t.id} className="flex gap-2 py-1.5 border-b border-hud-border/30 last:border-0 text-xs">
                  <span className={`font-mono w-10 flex-shrink-0 ${
                    t.isUnknownSpeaker ? "text-hud-warn" : "text-hud-accent"
                  }`}>
                    {t.providerSpeakerLabel}
                  </span>
                  <span className="flex-1 text-hud-text truncate">{t.currentText}</span>
                  <span className="text-hud-muted font-mono w-14 text-right">
                    {((t.endMs - t.startMs) / 1000).toFixed(1)}s
                  </span>
                  {t.analysis?.category && (
                    <span className="px-1.5 py-0.5 bg-hud-accent/10 text-hud-accent rounded text-[10px]">
                      {t.analysis.category}
                    </span>
                  )}
                  {t.possibleOverlap && (
                    <span className="px-1.5 py-0.5 bg-hud-warn/10 text-hud-warn rounded text-[10px]">
                      overlap
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
