"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DesignThinkingPhase =
  | "frame" | "empathize" | "define" | "ideate"
  | "evaluate" | "decide" | "plan_experiment" | "reflect";

const PHASES: { value: DesignThinkingPhase; label: string }[] = [
  { value: "frame", label: "Frame" },
  { value: "empathize", label: "Empathize" },
  { value: "define", label: "Define" },
  { value: "ideate", label: "Ideate" },
  { value: "evaluate", label: "Evaluate" },
  { value: "decide", label: "Decide" },
  { value: "plan_experiment", label: "Plan Experiment" },
  { value: "reflect", label: "Reflect" },
];

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [phase, setPhase] = useState<DesignThinkingPhase>("evaluate");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [speakerCount, setSpeakerCount] = useState(4);
  const [participants, setParticipants] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateParticipant = (idx: number, value: string) => {
    const next = [...participants];
    next[idx] = value;
    setParticipants(next);
  };

  const updateCriterion = (idx: number, value: string) => {
    const next = [...criteria];
    next[idx] = value;
    setCriteria(next);
  };

  const addCriterion = () => setCriteria([...criteria, ""]);
  const removeCriterion = (idx: number) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const handleSpeakerCountChange = (count: number) => {
    setSpeakerCount(count);
    setParticipants(prev => {
      const next = [...prev];
      while (next.length < count) next.push("");
      return next.slice(0, count);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Design Critique",
          objective,
          phase,
          criteria: criteria.filter(Boolean),
          speakerCount,
          runMode: "live",
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");
      const session = await res.json();

      // Create participants
      for (const name of participants.filter(Boolean)) {
        await fetch("/api/sessions/" + session.id + "/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, role: "reviewer" }),
        }).catch(() => {});
      }

      router.push(`/facilitator/${session.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="flex items-center gap-3 pt-4">
          <button
            onClick={() => router.push("/")}
            className="text-hud-muted hover:text-hud-text transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Back"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-hud-text">New Session</h1>
            <p className="text-hud-muted text-sm">Live critique setup</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Design Critique"
              className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text placeholder:text-hud-muted
                focus:outline-none focus:border-hud-accent transition-colors"
              style={{ minHeight: 48 }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">Objective</label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="What are we evaluating? e.g., 'Evaluate the new user onboarding flow for clarity and completion rate.'"
              rows={3}
              className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text placeholder:text-hud-muted
                focus:outline-none focus:border-hud-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">Phase</label>
            <div className="grid grid-cols-2 gap-2">
              {PHASES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPhase(p.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all touch-manipulation
                    ${phase === p.value
                      ? "bg-hud-accent text-white border-hud-accent"
                      : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                    }`}
                  style={{ minHeight: 44 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">
              Criteria ({criteria.filter(Boolean).length})
            </label>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={c}
                    onChange={e => updateCriterion(i, e.target.value)}
                    placeholder={`Criterion ${i + 1}`}
                    className="flex-1 px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text placeholder:text-hud-muted
                      focus:outline-none focus:border-hud-accent transition-colors"
                    style={{ minHeight: 44 }}
                  />
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(i)}
                      className="px-3 text-hud-muted hover:text-hud-danger transition-colors touch-manipulation"
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {criteria.length < 3 && (
                <button
                  type="button"
                  onClick={addCriterion}
                  className="text-sm text-hud-accent hover:text-hud-text transition-colors touch-manipulation"
                  style={{ minHeight: 44 }}
                >
                  + Add criterion
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">
              Speakers: {speakerCount}
            </label>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSpeakerCountChange(n)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all touch-manipulation
                    ${speakerCount === n
                      ? "bg-hud-accent text-white border-hud-accent"
                      : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                    }`}
                  style={{ minHeight: 44 }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-hud-text mb-1">Participants (optional)</label>
            <div className="space-y-2">
              {participants.map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  onChange={e => updateParticipant(i, e.target.value)}
                  placeholder={`Participant ${i + 1}`}
                  className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text placeholder:text-hud-muted
                    focus:outline-none focus:border-hud-accent transition-colors"
                  style={{ minHeight: 44 }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-hud-danger/10 border border-hud-danger/30 rounded-xl text-hud-danger text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-hud-accent text-white rounded-xl font-semibold text-lg
              hover:bg-hud-accent-dim active:scale-[0.98] transition-all touch-manipulation
              disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: 56 }}
          >
            {loading ? "Creating…" : "Start Session"}
          </button>
        </form>
      </div>
    </main>
  );
}
