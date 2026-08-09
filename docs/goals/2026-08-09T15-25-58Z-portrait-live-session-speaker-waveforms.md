# Goal: portrait-first live meeting intelligence with speaker waveforms

**Created:** 2026-08-09T15:25:58Z  
**Status:** proposed  
**Supersedes:** the 2026-08-09T15:09:39Z live-session goal retained in Git
history  
**Research basis:**
[`08-meeting-dynamics-visualization.md`](../research/08-meeting-dynamics-visualization.md)  
**Scope:** the portrait smartphone demo, live audio visualization, speaker
identity, transcript, meeting-dynamics analysis, event contracts, latency,
grounding, and evaluation. This document is a plan, not a claim that the changes
below are implemented.

## Goal

Make the vertical smartphone experience feel like a compelling live instrument:
a substantial, speaker-colored waveform makes turn-taking and conversational
rhythm visible immediately; a compact “Now” lens describes source-grounded topic
and response dynamics; and the transcript remains the authoritative record. The
interface should update continuously without inferring emotion, attention, or
speaker quality, and nothing should reach the shared display without facilitator
review.

## Design decision

The earlier AR concept's colored speaker waveforms are promoted from decorative
status feedback to a first-class part of the mobile experience. The research does
not require every visualization to be tiny; it requires a clear attention
hierarchy. Huddle will give visual space to the waveform because it is immediate,
observable, and legible, while moving dense semantic graphs and comparison views
behind deliberate inspection.

The live screen has three layers:

1. **Hear it:** a visually prominent live waveform and recent speaker-colored
   audio history, derived from captured audio and diarization—not an LLM.
2. **Understand it:** one compact, source-grounded Now lens describing the current
   topic, branches, responses, and open loop.
3. **Inspect it:** transcript-first scrolling, with the relation map, sources,
   stances, and actions available in bottom sheets.

## What was studied

The plan combines:

- the implemented 40-pixel, single-cyan `AudioVisualizer` and live
  `AnalyserNode` path in `src/lib/client/audio-visualizer.tsx`,
  `audio-capture.ts`, and the facilitator page;
- current active-speaker, word-level diarization, overlap, speaker-remapping, and
  transcript-turn data;
- the facilitator HUD, shared display, SSE events, metrics, rolling-window model
  path, and whole-transcript meeting-state analysis;
- the [AR HUD concept](../../workspace/AR-HUD.png), especially its large colored
  speaker signals, glass surfaces, and clear sense of “live analysis”; and
- the [non-AR concept](../../workspace/Non-AR-Analysis.png), especially its
  transcript annotations and inspectable relationship view.

## Current-state finding

### Keep

- capture and transcript updates independent of semantic synthesis;
- active-speaker labels, finalized word-level speaker segmentation, possible
  overlap flags, and manual speaker correction;
- exact source trails, uncertainty, typed meeting relations, and target-specific
  stances;
- private facilitator actions with explicit edit/publish controls; and
- audience-filtered SSE separating private and shared information.

### Fix

- The current audio visualization is only 40 pixels high, uses 56 cyan frequency
  bars, and changes neither color nor history by speaker.
- It visualizes the mixed microphone spectrum at the current instant; it does not
  retain a time-aligned waveform that can later adopt finalized diarization.
- The analysis HUD can occupy `60dvh` before the transcript and presents up to 30
  cards in three lanes. It competes with both the waveform and transcript.
- Existing meeting-state relations and stances are not visually exposed.
- The server emits `intelligence`, `prompt.show`, and `prompt.clear`, but the
  facilitator client does not render them; rich metrics are reduced to streaming
  minutes.
- Rolling-window analysis runs after five analyzed turns or 20 seconds, receives
  its 20 turns newest-first, and produces only a temporary prompt without
  supporting turn IDs. Its state is neither persisted nor visualized.
- Full meeting-state synthesis is manual and increasingly expensive because it
  reprocesses the whole substantive transcript in sequential chunks.
- Queue timers and the live event bus are process-local, so restart/redeploy can
  lose scheduled analysis and reconnect has no durable revision replay.

## Portrait target

```text
┌──────────────────────────────┐
│ HUDDLE        ● LIVE    04:21│
│ Captured now · analysis 2s   │
├─ LIVE AUDIO ─────────────────┤
│ MAYA  ● cyan                 │
│      ▁▃▆█▅▂▂▅▇▃▁▅██▆▂        │
│ ─────────────────────── NOW  │
│ A ▂▅██▂  B ▃▆█▅  A ▂▇██      │
│   cyan     amber    cyan     │
│ 30 seconds · tap a segment   │
├─ NOW LENS ───────────────────┤
│ ACCESS · comparing           │
│ Existing door ↔ new ramp     │
│ 1 unanswered question       │
├─ LIVE TRANSCRIPT ────────────┤
│┃ MAYA                        │
│┃ “The existing entrance…”    │
│                              │
│┆ LEO                         │
│┆ “What would that cost?”     │
│┆  ? open question            │
│                              │
│┃ MAYA                    ↩   │
│┃ “We could retain…”          │
│┃  ↳ responds to Leo          │
├──────────────────────────────┤
│ [Transcript] [Map] [Actions] │
└──────────────────────────────┘
```

On typical portrait phones the waveform stage should use
`clamp(140px, 22dvh, 200px)`: large enough to remain visually expressive without
removing the transcript. The Now lens uses roughly one compact card. The meaning
map opens as a bottom sheet rather than occupying the live viewport.

## Speaker-colored waveform contract

### Two coordinated waveform views

1. **Live signal:** a large, fluid amplitude/frequency visualization for the
   current mixed microphone signal. It reacts immediately and uses the current
   attributed speaker's color when known.
2. **Recent speaker history:** a persistent 20–30 second waveform strip on one
   shared time axis. Finalized segments are colored by diarized speaker so
   turn-taking, pauses, short interjections, returns, and observed overlap remain
   visible after the live animation passes.

This retains the visual energy of the AR image without pretending that a single
room microphone provides separate raw audio channels for every person.

### Stable speaker colors

- Assign color deterministically from the session speaker/participant ID, not
  from speaking amount or model judgment.
- Use a dark-theme palette selected for perceptual separation and adequate text
  and stroke contrast: cyan, amber, violet, lime, pink, and blue are candidates;
  validate the final palette under common color-vision deficiencies.
- Reuse the same speaker color in the waveform, transcript rail, speaker label,
  response links, and map selection.
- Always pair color with a short speaker label, avatar/glyph, lane marker, or
  pattern. Color must never be the only identity channel.
- A corrected speaker mapping must recolor all affected finalized segments and
  transcript marks consistently.

### Attribution states

- **Unknown/live pending:** render the signal in neutral cyan/gray with an
  “identifying speaker” label; do not guess.
- **Active speaker known:** transition the live signal to the stable speaker
  color without clearing or jumping the waveform.
- **Finalized diarization:** lock historical color to the word/turn intervals
  returned by STT.
- **Possible overlap:** show a dual outline, hatch, or two stacked strokes only
  when the provider supplies evidence. Never blend colors as if the proportions
  were known.
- **Backchannel/interjection:** retain its speaker color and true duration rather
  than absorbing it visually into the surrounding speaker.
- **Manual correction:** animate a short, non-flashing recolor and mark the segment
  as corrected on inspection.

### Meaning boundary

Waveform height represents measured audio energy, not confidence, importance,
emotion, dominance, or topic relevance. Speaker color represents identity only.
Do not derive “aggressive,” “calm,” “engaged,” or performance labels from volume,
pitch, waveform shape, speaking time, or color.

## Realtime data and analysis loop

The waveform and semantic analysis operate at different speeds so an LLM can
never delay the live instrument.

| Tier               | Trigger and target                                                                              | Computation / model call                                                                                                    | Visible result                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0 — audio          | Every animation frame; smoothness target tested on representative phones                        | No LLM. Web Audio analyser drives the large live signal; retain a bounded downsampled amplitude history                     | Immediate waveform in neutral or active-speaker color                                                         |
| 0b — diarization   | Partial and finalized STT speaker events; UI target under 250 ms after receipt                  | No LLM. Apply provider speaker/word labels, mapping revision, unknown and overlap state                                     | Speaker-colored historical segments and transcript rails                                                      |
| 1 — turn delta     | 1.5 s debounce over finalized substantive turns; initial target p50 under 3 s and p95 under 7 s | Extend `analyzeTurnBatch` with exact-source topic, response, semantic-node, relation, and target-specific stance candidates | Transcript annotations and source-validated `meeting.delta`                                                   |
| 2 — rolling window | Every 3 substantive turns or 8–12 s; one call in flight per session                             | Run `analyzeWindow` chronologically on 12–20 turns with compact previous state and only new deltas                          | Now lens: active topic, branch/return/integration state, open loops, uncertainty, and grounded private prompt |
| 3 — reconciliation | After 8–12 new substantive turns, 30–45 s, phase change, meeting end, or explicit refresh       | Delta meeting-state synthesis with periodic exhaustive reconciliation                                                       | Stable, source-validated meaning-map revision                                                                 |

These latency values are initial service objectives to measure and tune, not
claims about the current deployment.

## Model-call contracts

### Fast turn extraction

Input only newly finalized turns, the facilitator intent/version, and the compact
topic/node registry needed for stable assignment. Require structured output with
exact source spans and IDs, topic confidence, response/addressee target, semantic
candidates, relations, and target-specific stance. Cache by normalized text,
speaker-mapping revision, and intent version. Reject invented quotes or IDs before
persistence.

The model must not choose waveform color or determine speaker identity. If a
speaker correction changes an identity label but not the text, rebind the visual
identity and invalidate only analysis whose meaning depended on that identity.

### Rolling-window dynamics

Correct the current newest-first ordering. Send a compact previous window plus
only unincorporated turns. Return observable discussion structure—not attention or
emotion—with confidence and supporting turn IDs. Prompts must be private,
source-grounded, guarded, rate-limited, and dismissible. Cancel or discard
superseded responses by input revision.

### Meeting-state reconciliation

Use stable IDs and patch semantics so unchanged nodes do not move. Validate every
source quote and relation before committing a revision. Preserve unresolved and
minority positions, and never silently overwrite human-edited nodes. Use delta
passes for responsiveness and periodic whole-transcript passes to repair drift.

## UI and event contract

First wire the existing `intelligence` and `prompt.*` events; this creates visible
value without a new LLM call. Add revisioned events with a monotonic sequence,
input cutoff, generated time, and status:

- `waveform.segment` — bounded time/amplitude samples with provisional or final
  speaker attribution, overlap, and mapping revision;
- `dynamics.patch` — deterministic turn timing, speaker, pending, and freshness
  changes;
- `meeting.delta` — validated node/relation/stance changes;
- `window.analysis` — topic/response dynamics for the Now lens; and
- `analysis.status` — queued, running, current, delayed, fallback, or failed.

Persist finalized waveform envelopes rather than raw high-resolution samples when
history is needed; keep the payload bounded and never put raw audio in SSE.
Display separate **captured through**, **speaker-attributed through**,
**turn-analyzed through**, and **map-reconciled through** cutoffs.

## Implementation sequence

1. **Build the waveform stage.** Add a portrait-first component around the current
   analyser, a bounded scrolling amplitude history, deterministic accessible
   speaker palette, neutral pending state, finalized recoloring, overlap/correction
   treatment, and performance tests on 360-, 390-, and 430-pixel viewports.
2. **Restore the attention hierarchy.** Replace the `60dvh` card wall with the
   waveform stage, compact Now lens, transcript, and bottom-sheet inspection.
   Wire existing intelligence and private prompt events with freshness.
3. **Make dynamics genuinely live.** Correct window chronology, persist rolling
   revisions, add source-grounded topic/response deltas, and instrument latency,
   queue depth, battery/main-thread load, and model cost.
4. **Make the meaning map incremental.** Render existing relations and selected
   target stances with stable IDs/layout, grounding rejection, cancellation,
   caching, and backpressure.
5. **Add durable orchestration and evaluate.** Persist jobs/revisions for replay,
   define human-edit merge rules, run annotated/offline and live usability tests,
   and prototype spatial AR only after the portrait hierarchy succeeds.

## Acceptance criteria

- The waveform remains visually prominent and smooth on the target demo phone
  without causing transcript, capture, or touch interaction jank.
- Known speakers retain one accessible color across live signal, finalized
  history, transcript, and map; unknown, overlap, and corrected states are
  accurate and never encoded by color alone.
- A speaker correction recolors affected history without changing the underlying
  timing or losing the audit trail.
- Topic, branch, response, and open-loop labels are traceable to turns;
  unsupported outputs remain pending or visibly uncertain.
- Reconnect/redeploy restores the latest semantic revisions and cutoffs without
  presenting stale analysis as current.
- Facilitator edits survive later model revisions, private cues remain private,
  and shared content always requires review.
- Evaluation reports diarization attribution accuracy, overlap behavior,
  waveform rendering performance, source grounding, topic/response
  precision/recall, latency p50/p95, revision churn, correction burden,
  cognitive load, and model cost per meeting minute.

## Explicit non-goals

- speaker-source separation from a mixed microphone when the capture/provider
  does not supply separate channels;
- emotion, engagement, dominance, personality, or quality inference from audio;
- one alignment, sentiment, or meeting-quality score;
- equal-airtime enforcement or participant rankings;
- automatic public interventions or unvalidated streamed model output; or
- a dense AR cockpit before the portrait experience has evidence of usefulness.
