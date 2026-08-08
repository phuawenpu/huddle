"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ScenarioItem {
  id: string;
  title: string;
  topic: string;
  durationMinutes: number;
  speakerCount: number;
  crossTalkLevel: string;
  difficulty: string;
  status: string;
  createdAt: string;
  transcriptQuality?: { score: number; errors: string[]; warnings: string[] };
}

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/scenarios")
      .then(r => r.json())
      .then(data => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scenario?")) return;
    await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  const handleDuplicate = async (id: string) => {
    setError("");
    const res = await fetch(`/api/scenarios/${id}`);
    const scenario = await res.json();
    const newRes = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...scenario,
        title: `${scenario.title} (Copy)`,
        id: undefined,
        status: "draft",
      }),
    });
    const newScenario = await newRes.json();
    if (!newRes.ok) {
      setError(newScenario.error || "Could not duplicate scenario");
      return;
    }
    setScenarios(prev => [newScenario, ...prev]);
  };

  const handleLaunch = async (scenario: ScenarioItem) => {
    // Create session from scenario
    const sRes = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: scenario.title,
        objective: scenario.topic,
        runMode: "sim_injected",
        scenarioId: scenario.id,
        speakerCount: scenario.speakerCount,
      }),
    });
    const session = await sRes.json();

    // Create run
    const rRes = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        scenarioId: scenario.id,
        mode: "sim_injected",
      }),
    });
    const run = await rRes.json();
    router.push(`/simulator/${run.id}`);
  };

  return (
    <main className="min-h-dvh p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-hud-muted hover:text-hud-text transition-colors touch-manipulation"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Back"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-hud-text">Scenarios</h1>
              <p className="text-hud-muted text-sm">{scenarios.length} scenarios</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/scenarios/new")}
            className="px-4 py-2 bg-hud-accent text-white rounded-xl text-sm font-semibold touch-manipulation"
            style={{ minHeight: 44 }}
          >
            + New
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-hud-danger/30 bg-hud-danger/10 p-3 text-sm text-hud-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-hud-muted text-center py-12 animate-pulse">Loading…</div>
        ) : scenarios.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-hud-muted">No scenarios yet</p>
            <button
              onClick={() => router.push("/scenarios/new")}
              className="px-6 py-3 bg-hud-accent text-white rounded-xl font-semibold touch-manipulation"
              style={{ minHeight: 48 }}
            >
              Generate Your First Scenario
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {scenarios.map(s => (
              <div
                key={s.id}
                className="bg-hud-surface border border-hud-border rounded-xl p-4 hover:border-hud-accent/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/scenarios/${s.id}`)}
                style={{ minHeight: 72 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-hud-text truncate">{s.title}</h3>
                    <p className="text-sm text-hud-muted truncate">{s.topic}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      <span className="text-hud-accent">{s.durationMinutes}min</span>
                      <span className="text-hud-muted">{s.speakerCount} speakers</span>
                      <span className="text-hud-muted">{s.crossTalkLevel}</span>
                      <span className="text-hud-muted">{s.difficulty}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        s.status === "approved" ? "bg-hud-success/20 text-hud-success" :
                        s.status === "ready" ? "bg-hud-accent/20 text-hud-accent" :
                        "bg-hud-muted/20 text-hud-muted"
                      }`}>
                        {s.status}
                      </span>
                      {s.transcriptQuality && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          s.transcriptQuality.errors.length
                            ? "bg-hud-danger/20 text-hud-danger"
                            : s.transcriptQuality.warnings.length
                              ? "bg-hud-warn/20 text-hud-warn"
                              : "bg-hud-success/20 text-hud-success"
                        }`}>
                          transcript {s.transcriptQuality.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleLaunch(s)}
                      disabled={
                        !["ready", "approved"].includes(s.status) ||
                        Boolean(s.transcriptQuality?.errors.length)
                      }
                      className="px-3 py-2 text-xs bg-hud-accent text-white rounded-lg touch-manipulation disabled:opacity-35 disabled:cursor-not-allowed"
                      style={{ minHeight: 36 }}
                      title="Launch simulation"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handleDuplicate(s.id)}
                      className="px-3 py-2 text-xs bg-hud-surface border border-hud-border rounded-lg text-hud-text touch-manipulation"
                      style={{ minHeight: 36 }}
                      title="Duplicate"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-2 text-xs bg-hud-surface border border-hud-border rounded-lg text-hud-danger touch-manipulation"
                      style={{ minHeight: 36 }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
