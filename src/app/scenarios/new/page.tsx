"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TopicSuggestion {
  topic: string;
  domain: string;
  description: string;
}

const WORKSHOP_TYPES = [
  "concept_critique",
  "user_research_synthesis",
  "prototype_review",
  "service_design_critique",
  "problem_framing",
  "ideation_review",
  "prioritization",
  "retrospective",
] as const;

export default function NewScenarioPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[]>(
    [],
  );
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [speakerCount, setSpeakerCount] = useState(4);
  const [difficulty, setDifficulty] = useState("realistic");
  const [crossTalkLevel, setCrossTalkLevel] = useState("occasional");
  const [workshopType, setWorkshopType] = useState("concept_critique");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<any>(null);
  const [generated, setGenerated] = useState<any>(null);

  // Load topic suggestions
  useEffect(() => {
    fetch("/api/scenarios/topic-suggestions")
      .then((r) => r.json())
      .then((data) => {
        if (data.suggestions) setTopicSuggestions(data.suggestions);
      })
      .catch(() => {});
  }, []);

  // Update estimate when params change
  useEffect(() => {
    fetch("/api/scenarios/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes, speakerCount, crossTalkLevel }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.budget) setEstimate(data.budget);
      })
      .catch(() => {});
  }, [durationMinutes, speakerCount, crossTalkLevel]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/scenarios/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || topicSuggestions[0]?.topic || "Design Thinking topic",
          durationMinutes,
          speakerCount,
          difficulty,
          crossTalkLevel,
          workshopType,
          disagreementLevel:
            difficulty === "clean"
              ? "low"
              : difficulty === "stress_test"
                ? "high"
                : "moderate",
          evidenceQuality: difficulty === "clean" ? "strong" : "mixed",
          facilitationQuality: "light",
          seed: Date.now(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Save the generated scenario
      const saveRes = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          topic: topic || data.topic || "Generated",
          domain: data.domain || "",
          workshopType,
          objective: data.objective,
          phase: "evaluate",
          criteria: data.criteria || [],
          durationMinutes,
          speakerCount,
          difficulty,
          crossTalkLevel,
          participationProfile: "even",
          budget: data.budget,
          speakers: data.speakers,
          turns: data.turns,
          status: "draft",
        }),
      });
      const saved = await saveRes.json();
      router.push(`/scenarios/${saved.id}`);
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const selectTopic = (suggestion: TopicSuggestion) => {
    setTopic(suggestion.topic);
    setWorkshopType(
      suggestion.description?.includes("retro")
        ? "retrospective"
        : "concept_critique",
    );
  };

  return (
    <main className="min-h-dvh p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="flex items-center gap-3 pt-4">
          <button
            onClick={() => router.push("/scenarios")}
            className="text-hud-muted hover:text-hud-text transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-hud-text">
              Generate Scenario
            </h1>
            <p className="text-hud-muted text-sm">Simulated critique setup</p>
          </div>
        </header>

        {/* Topic Suggestions */}
        <div>
          <label className="block text-sm font-medium text-hud-text mb-2">
            Choose a Topic
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {topicSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => selectTopic(s)}
                className={`px-3 py-2 rounded-lg text-xs border transition-all touch-manipulation ${
                  topic === s.topic
                    ? "bg-hud-accent text-white border-hud-accent"
                    : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                }`}
                style={{ minHeight: 36 }}
              >
                {s.topic.length > 40 ? s.topic.slice(0, 40) + "…" : s.topic}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Or type your own topic…"
            className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text placeholder:text-hud-muted
              focus:outline-none focus:border-hud-accent transition-colors text-sm"
            style={{ minHeight: 44 }}
          />
        </div>

        {/* Duration */}
        <div>
          <label
            htmlFor="scenario-duration"
            className="block text-sm font-medium text-hud-text mb-1"
          >
            Audio duration in minutes
          </label>
          <input
            id="scenario-duration"
            type="number"
            min={3}
            max={8}
            step={1}
            inputMode="numeric"
            value={durationMinutes}
            onChange={(event) =>
              setDurationMinutes(
                Math.min(8, Math.max(3, Number(event.target.value) || 3)),
              )
            }
            className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text
              focus:outline-none focus:border-hud-accent transition-colors"
            style={{ minHeight: 44 }}
          />
          <p className="mt-1 text-xs text-hud-muted">
            3–8 minutes. Transcript turn and word budgets scale with this value.
          </p>
        </div>

        {/* Speakers */}
        <div>
          <label className="block text-sm font-medium text-hud-text mb-1">
            Speakers: {speakerCount}
          </label>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpeakerCount(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all touch-manipulation ${
                  speakerCount === n
                    ? "bg-hud-accent text-white border-hud-accent"
                    : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                }`}
                style={{ minHeight: 40 }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-hud-text mb-1">
            Difficulty
          </label>
          <div className="grid grid-cols-4 gap-2">
            {["clean", "realistic", "challenging", "stress_test"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`py-2 rounded-lg text-xs font-medium border transition-all touch-manipulation ${
                  difficulty === d
                    ? "bg-hud-accent text-white border-hud-accent"
                    : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                }`}
                style={{ minHeight: 40 }}
              >
                {d.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Cross-talk */}
        <div>
          <label className="block text-sm font-medium text-hud-text mb-1">
            Cross-talk Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "occasional", "frequent"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setCrossTalkLevel(l)}
                className={`py-2 rounded-lg text-sm font-medium border transition-all touch-manipulation ${
                  crossTalkLevel === l
                    ? "bg-hud-accent text-white border-hud-accent"
                    : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
                }`}
                style={{ minHeight: 40 }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Workshop Type */}
        <div>
          <label className="block text-sm font-medium text-hud-text mb-1">
            Workshop Type
          </label>
          <select
            value={workshopType}
            onChange={(e) => setWorkshopType(e.target.value)}
            className="w-full px-4 py-3 bg-hud-surface border border-hud-border rounded-xl text-hud-text
              focus:outline-none focus:border-hud-accent transition-colors"
            style={{ minHeight: 44 }}
          >
            {WORKSHOP_TYPES.map((wt) => (
              <option key={wt} value={wt}>
                {wt.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Estimate */}
        {estimate && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">
              Estimate
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-hud-muted text-xs">Turns</span>
                <p className="text-hud-text font-mono">
                  {estimate.estimatedTurns}
                </p>
              </div>
              <div>
                <span className="text-hud-muted text-xs">Characters</span>
                <p className="text-hud-text font-mono">
                  {estimate.estimatedCharacters?.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-hud-muted text-xs">Est. Cost</span>
                <p className="text-hud-text font-mono">
                  ${estimate.estimatedCostUsd?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-hud-danger/10 border border-hud-danger/30 rounded-xl text-hud-danger text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-4 bg-hud-accent text-white rounded-xl font-semibold text-lg
            hover:bg-hud-accent-dim active:scale-[0.98] transition-all touch-manipulation
            disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 56 }}
        >
          {loading ? "Generating…" : "Generate Scenario"}
        </button>
      </div>
    </main>
  );
}
