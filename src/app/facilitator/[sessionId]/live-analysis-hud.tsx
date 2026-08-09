"use client";

import type {
  CritiqueIntelligenceSnapshot,
  LiveAnalysisSnapshot,
} from "@/lib/types";

interface HudTurn {
  id: string;
  providerSpeakerLabel: string;
  isSubstantive: boolean;
  isCalibration: boolean;
  analysis?: { category?: string };
}

interface LiveAnalysisHudProps {
  analysis: LiveAnalysisSnapshot | null;
  intelligence: CritiqueIntelligenceSnapshot | null;
  turns: HudTurn[];
  objective: string;
  phase: string;
  criteriaText: string;
  analyzing: boolean;
  ready: boolean;
  onObjectiveChange: (value: string) => void;
  onPhaseChange: (value: string) => void;
  onCriteriaChange: (value: string) => void;
  onAnalyze: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  frame: "Frame",
  empathize: "Empathize",
  define: "Define",
  ideate: "Ideate",
  evaluate: "Evaluate",
  decide: "Decide",
  plan_experiment: "Plan experiment",
  reflect: "Reflect",
};

const SIGNAL_COLORS: Record<string, string> = {
  evidence: "bg-cyan-400",
  questions: "bg-violet-400",
  positions: "bg-orange-400",
  decisions: "bg-emerald-400",
  actions: "bg-amber-300",
  themes: "bg-pink-400",
};

export function LiveAnalysisHud({
  analysis,
  intelligence,
  turns,
  objective,
  phase,
  criteriaText,
  analyzing,
  ready,
  onObjectiveChange,
  onPhaseChange,
  onCriteriaChange,
  onAnalyze,
}: LiveAnalysisHudProps) {
  const substantiveTurns = turns.filter(
    (turn) => turn.isSubstantive && !turn.isCalibration,
  );
  const analyzedTurnCount = intelligence?.analyzedTurnCount || 0;
  const pendingTurnAnalysis = Math.max(
    0,
    substantiveTurns.length - analyzedTurnCount,
  );
  const newSinceSnapshot = analysis
    ? Math.max(0, substantiveTurns.length - analysis.transcriptTurnCount)
    : substantiveTurns.length;
  const signalCounts = substantiveTurns.reduce<Record<string, number>>(
    (counts, turn) => {
      const category = turn.analysis?.category;
      if (category) counts[category] = (counts[category] || 0) + 1;
      return counts;
    },
    {},
  );
  const maxSignalCount = Math.max(1, ...Object.values(signalCounts));

  return (
    <section
      data-testid="live-analysis-hud"
      className="max-h-[46dvh] shrink-0 overflow-y-auto border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_42%),linear-gradient(110deg,rgba(20,20,31,0.98),rgba(10,10,15,0.98))] px-3 py-3 sm:px-4"
      aria-label="Running transcript analysis"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <div className="min-w-0 rounded-2xl border border-cyan-300/20 bg-black/20 p-3 shadow-[inset_0_1px_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                  Live synthesis
                </h2>
              </div>
              <p className="mt-1 text-[11px] text-hud-muted">
                {analyzedTurnCount}/{substantiveTurns.length} turns classified
                {pendingTurnAnalysis > 0
                  ? ` · ${pendingTurnAnalysis} processing`
                  : substantiveTurns.length > 0
                    ? " · current"
                    : ""}
              </p>
            </div>
            {analysis && (
              <div className="flex flex-wrap justify-end gap-1.5 text-[10px]">
                <span className="rounded-full border border-hud-border bg-hud-bg/70 px-2 py-1 text-hud-muted">
                  {analysis.result.engine === "model" ? "Model" : "Fallback"}
                </span>
                <span className="rounded-full border border-hud-border bg-hud-bg/70 px-2 py-1 text-hud-muted">
                  {analysis.transcriptTurnCount} turns ·{" "}
                  {analysis.transcriptWordCount} words
                </span>
                {analysis.result.grounding && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                    {analysis.result.grounding.validatedSourceCount} exact quote
                    anchors
                  </span>
                )}
                <span className="rounded-full border border-hud-border bg-hud-bg/70 px-2 py-1 text-hud-muted">
                  through {formatSessionTime(analysis.transcriptThroughMs)}
                </span>
                {analysis.visualEvidenceCount > 0 && (
                  <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-1 text-fuchsia-200">
                    {analysis.visualEvidenceCount} visual
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="min-w-0" aria-live="polite">
              <p className="text-[10px] uppercase tracking-wider text-hud-muted">
                {analysis
                  ? `Intent · ${analysis.objective}`
                  : "Awaiting an intent snapshot"}
              </p>
              <h3 className="mt-1 text-base font-semibold leading-snug text-white sm:text-lg">
                {analyzing
                  ? `Analyzing all ${substantiveTurns.length} turns…`
                  : analysis?.result.headline ||
                    "Turn-level signals will accumulate here as the discussion develops."}
              </h3>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-hud-text/75 sm:text-sm">
                {analysis?.result.summary ||
                  "Set an intent and run a whole-transcript synthesis. Audio capture and transcription continue while it runs."}
              </p>
              {analysis?.result.warning && (
                <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
                  {analysis.result.warning}
                </p>
              )}
              {analysis && newSinceSnapshot > 0 && (
                <p className="mt-2 inline-flex rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-200">
                  {newSinceSnapshot} new{" "}
                  {newSinceSnapshot === 1 ? "turn" : "turns"} since this
                  snapshot
                </p>
              )}
            </div>

            <div
              className="grid grid-cols-2 gap-1.5"
              aria-label="Live signal mix"
            >
              {Object.entries(SIGNAL_COLORS).map(([category, color]) => {
                const count = signalCounts[category] || 0;
                return (
                  <div
                    key={category}
                    className="rounded-lg border border-hud-border/70 bg-hud-bg/60 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="capitalize text-hud-muted">
                        {category}
                      </span>
                      <span className="tabular-nums text-hud-text">
                        {count}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${color}`}
                        style={{ width: `${(count / maxSignalCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {analysis && (
            <div className="mt-3">
              <PhaseBand allocation={analysis.result.phaseAllocation} />
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-cyan-200 marker:hidden">
                  <span className="group-open:hidden">
                    Explore findings and sources +
                  </span>
                  <span className="hidden group-open:inline">
                    Hide findings −
                  </span>
                </summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {analysis.result.keyFindings.slice(0, 4).map((finding) => (
                    <article
                      key={`${finding.title}-${finding.supportingTurnIds.join("-")}`}
                      className="rounded-lg border border-hud-border/70 bg-hud-bg/60 p-2"
                    >
                      <h4 className="text-xs font-semibold text-hud-text">
                        {finding.title}
                      </h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-hud-muted">
                        {finding.text}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-cyan-300/70">
                        {finding.supportingTurnIds.length} source{" "}
                        {finding.supportingTurnIds.length === 1
                          ? "turn"
                          : "turns"}
                      </p>
                      {finding.sourceQuotes?.slice(0, 2).map((source) => (
                        <blockquote
                          key={`${source.turnId}-${source.quote}`}
                          className="mt-1 border-l border-cyan-300/30 pl-2 text-[10px] italic text-hud-muted/80"
                        >
                          “{source.quote}”
                        </blockquote>
                      ))}
                    </article>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        <form
          className="rounded-2xl border border-hud-border bg-hud-surface/75 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAnalyze();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-hud-muted">
                Analysis intent
              </h3>
              <p className="mt-0.5 text-[10px] text-hud-muted/80">
                Every run covers the full transcript through now.
              </p>
            </div>
            <span className="rounded-full bg-hud-bg px-2 py-1 text-[10px] text-hud-muted">
              {PHASE_LABELS[phase] || phase}
            </span>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Analysis objective</span>
            <input
              value={objective}
              disabled={!ready}
              onChange={(event) => onObjectiveChange(event.target.value)}
              placeholder="What should this analysis clarify?"
              className="min-h-11 w-full rounded-lg border border-hud-border bg-hud-bg/80 px-3 py-2 text-sm text-hud-text outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
            />
          </label>
          <div className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
            <label>
              <span className="sr-only">Critique phase</span>
              <select
                value={phase}
                disabled={!ready}
                onChange={(event) => onPhaseChange(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-hud-border bg-hud-bg/80 px-2 py-2 text-xs text-hud-text outline-none focus:border-cyan-300/60"
              >
                {Object.entries(PHASE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={
                !ready ||
                analyzing ||
                substantiveTurns.length === 0 ||
                !objective.trim() ||
                !phase
              }
              className="min-h-11 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/30 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {analyzing
                ? "Synthesizing…"
                : `Analyze all ${substantiveTurns.length} ${substantiveTurns.length === 1 ? "turn" : "turns"}`}
            </button>
          </div>
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[10px] text-hud-muted marker:hidden">
              <span className="group-open:hidden">
                Edit evaluation criteria +
              </span>
              <span className="hidden group-open:inline">Hide criteria −</span>
            </summary>
            <textarea
              value={criteriaText}
              disabled={!ready}
              onChange={(event) => onCriteriaChange(event.target.value)}
              placeholder="One criterion per line"
              rows={3}
              className="mt-2 w-full rounded-lg border border-hud-border bg-hud-bg/80 px-3 py-2 text-xs text-hud-text outline-none focus:border-cyan-300/60"
            />
          </details>
        </form>
      </div>
    </section>
  );
}

function PhaseBand({
  allocation,
}: {
  allocation: LiveAnalysisSnapshot["result"]["phaseAllocation"];
}) {
  const phases = [
    ["Problem + evidence", allocation.problemAndEvidence, "bg-cyan-400"],
    ["Ideas", allocation.ideas, "bg-violet-400"],
    ["Evaluation", allocation.evaluation, "bg-orange-400"],
    ["Decisions + actions", allocation.decisionsAndActions, "bg-emerald-400"],
  ] as const;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
        {phases.map(([label, value, color]) => (
          <div
            key={label}
            title={`${label}: ${value}%`}
            className={`${color} transition-[width] duration-700`}
            style={{ width: `${value}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-hud-muted">
        {phases.map(([label, value, color]) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
            {label} {value}%
          </span>
        ))}
      </div>
    </div>
  );
}

function formatSessionTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
