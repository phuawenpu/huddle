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
  speakers?: Array<{ index: number; name: string; voiceId: string; accent: string; timbreClass: string }>;
  turns?: Array<{ index: number; speakerIndex: number; text: string; expectedCategory?: string; overlapWith?: number[] }>;
  preflight?: { passed: boolean; mergedPairs: Array<[number, number]> };
  approvedAt?: string;
  realizedDurationMs?: number;
}

export default function ScenarioDetailPage() {
  const params = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadScenario = async () => {
    try {
      const res = await fetch(`/api/scenarios/${params.scenarioId}`);
      if (res.ok) setScenario(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadScenario(); }, [params.scenarioId]);

  const handleApprove = async () => {
    await fetch(`/api/scenarios/${params.scenarioId}/approve`, { method: "POST" });
    loadScenario();
  };

  const handleSynthesize = async () => {
    await fetch(`/api/scenarios/${params.scenarioId}/synthesize`, { method: "POST" });
    loadScenario();
  };

  const handlePreflight = async () => {
    await fetch(`/api/scenarios/${params.scenarioId}/preflight`, { method: "POST" });
    loadScenario();
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
      <div className="max-w-2xl mx-auto space-y-6">
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
          </div>
        )}

        {/* Turn Script */}
        {scenario.turns != null && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">
              Script ({scenario.turns?.length ?? 0} turns)
            </h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {scenario.turns?.map(t => {
                const speaker = scenario.speakers?.find(s => s.index === t.speakerIndex);
                return (
                  <div key={t.index} className="flex gap-2 py-1 border-b border-hud-border/30 last:border-0">
                    <span className="text-xs font-mono text-hud-accent w-12 flex-shrink-0">
                      {speaker?.name || `S${t.speakerIndex}`}
                    </span>
                    <span className="text-sm text-hud-text">
                      {t.text}
                      {t.overlapWith?.length ? (
                        <span className="ml-1 text-[10px] text-hud-warn">⟷ overlap</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pb-8">
          {scenario.status !== "approved" && (
            <>
              <button
                onClick={handleSynthesize}
                className="px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-sm font-medium
                  hover:border-hud-accent transition-all touch-manipulation"
                style={{ minHeight: 48 }}
              >
                Synthesize Audio
              </button>
              <button
                onClick={handlePreflight}
                className="px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-sm font-medium
                  hover:border-hud-accent transition-all touch-manipulation"
                style={{ minHeight: 48 }}
              >
                Run Preflight
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-3 bg-hud-accent text-white rounded-xl text-sm font-medium
                  hover:bg-hud-accent-dim transition-all touch-manipulation"
                style={{ minHeight: 48 }}
              >
                Approve
              </button>
            </>
          )}
          <button
            onClick={handleLaunch}
            className="px-4 py-3 bg-hud-success text-white rounded-xl text-sm font-medium
              hover:opacity-90 transition-all touch-manipulation ml-auto"
            style={{ minHeight: 48 }}
          >
            ▶ Launch Simulation
          </button>
        </div>
      </div>
    </main>
  );
}
