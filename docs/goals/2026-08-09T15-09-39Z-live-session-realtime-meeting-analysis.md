# Goal: a legible, continuously updated live meeting view

**Created:** 2026-08-09T15:09:39Z  
**Status:** proposed  
**Research basis:** [`08-meeting-dynamics-visualization.md`](../research/08-meeting-dynamics-visualization.md)  
**Scope:** facilitator and shared live-session UI, analysis orchestration, event
contracts, latency, grounding, and evaluation. This is a plan, not a claim that
the changes below are implemented.

## Goal

Make Huddle's live session understandable at a glance and meaningfully dynamic:
the transcript remains primary, a compact view explains whether the captured
conversation is concentrated, branching, integrating, or settling, and the
meaning map updates from source-grounded deltas within seconds. Preserve the
existing human authority boundary: AI interpretation is private by default and
nothing reaches the shared display without facilitator review.

## What was studied

The audit covered:

- the implemented facilitator screen in
  `src/app/facilitator/[sessionId]/page.tsx` and `live-analysis-hud.tsx`;
- the shared display in `src/app/display/[sessionId]/page.tsx`;
- SSE snapshots and audience filtering in
  `src/app/api/sessions/[id]/events/route.ts`;
- turn, rolling-window, prompt, and full-transcript model paths in
  `src/lib/analysis-queue.ts`, `analysis.ts`, and `live-analysis.ts`;
- existing semantic types, metrics, and deterministic intelligence in
  `src/lib/types.ts`, `metrics.ts`, and `critique-intelligence.ts`; and
- the [non-AR analysis concept](../../workspace/Non-AR-Analysis.png) and
  [AR HUD concept](../../workspace/AR-HUD.png).

## Current-state finding

The implemented product has a stronger safety and evidence contract than the
raster concepts, but the most useful live data is fragmented across the stack.

### Keep

- resilient capture and live transcript updates independent of synthesis;
- exact source trails, confidence/uncertainty, speaker correction, and remapping;
- typed meeting nodes, relations, target-specific stances, and agreements;
- private facilitator actions plus explicit edit/publish controls; and
- audience-filtered SSE so private analysis is not sent to the shared display.

### Fix

- The analysis HUD can occupy `60dvh` before the transcript and presents up to 30
  cards in three vertical lanes. It competes with the primary live artifact.
- The “meaning map” renders semantic buckets but not the relations or stances
  already present in `MeetingState`; it has no temporal view of the discussion.
- The server emits `intelligence`, `prompt.show`, and `prompt.clear`, and includes
  intelligence in the facilitator snapshot, but the facilitator client does not
  subscribe to or render those events.
- The client receives rich metrics but currently uses only streaming minutes.
- Rolling-window analysis runs after five analyzed turns or 20 seconds, fetches
  the last 20 turns newest-first, and uses its result only for a 15-second prompt.
  The analysis itself is not persisted or rendered, and generated prompts have no
  supporting turn IDs.
- Full meeting synthesis is manual. It processes all substantive turns in
  sequential chunks and may make a final synthesis call, so its latency and cost
  grow with the meeting.
- Queue timers and the live event bus are process-local; restart/redeploy can lose
  scheduled work and there is no durable revision replay for a reconnecting UI.

### Interpret the concepts selectively

The raster concepts contribute useful ideas—speaker-linked captions, a visible
analysis state, spatial anchors, topic continuity, and actions—but should not be
copied literally. Their floating-panel density would split attention in a live
room. Sentiment labels, speaker radar/scores, fallacy counters, and binary
“verified” claims also conflict with Huddle's source-grounded, non-scoring model.

## Target experience

```text
┌ Live controls ─ connection ─ captured/analyzed-through freshness ┐
├ Dynamics ribbon: topic bands · speakers · branches · returns · phase ┤
├ Transcript (primary, flexible height) ─────┬ Meaning / evidence drawer ┤
│ live partial + finalized turns             │ selected nodes + relations │
│ source-linked annotations                  │ stances + exact sources     │
├────────────────────────────────────────────┴───────────────────────────┤
│ Private cue: one grounded observation or question · dismiss · use     │
└────────────────────────────────────────────────────────────────────────┘
```

The default desktop view should keep at least two thirds of usable vertical space
for transcript and controls. The map becomes a collapsible/right-side drawer (or
bottom sheet on mobile). The shared display continues to show only reviewed
cards, with optional reviewed dynamics summaries added later.

## Realtime analysis loop

The UI should update in four independently paced tiers. “Realtime” means that a
validated small patch arrives quickly; it does not mean streaming unvalidated
model tokens into the interface.

| Tier               | Trigger and target                                                                      | Computation / model call                                                                                                                                                                                                                               | Durable output                                                            |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 0 — capture        | Every partial/final event; UI target under 250 ms after receipt                         | No LLM. Transcript, overlap, turn timing, pending count, capture confidence, and analysis freshness                                                                                                                                                    | Existing turns plus `dynamics.patch` sequence                             |
| 1 — turn delta     | 1.5 s debounce over finalized substantive turns; target p50 under 3 s and p95 under 7 s | Extend the existing fast `analyzeTurnBatch` call. Return exact-source signals plus stable topic ID, new-topic probability, response/addressee turn, and proposed target-specific stance                                                                | Turn analysis and source-validated `meeting.delta`                        |
| 2 — rolling window | Every 3 substantive turns or 8–12 s while active; one call in flight per session        | Run `analyzeWindow` on 12–20 turns in chronological order, compact previous window state, and only new deltas. Return active topics, split/merge/return events, response links, open loops, phase-relative state, uncertainty, and supporting turn IDs | Persisted `window.analysis` revision and optional grounded private prompt |
| 3 — reconciliation | Background after 8–12 new substantive turns, 30–45 s, or an intent/phase change         | Add a delta form of `analyzeFullTranscript`: previous `MeetingState` + turns after its cutoff + compact relevant older sources. Run the current exhaustive whole-transcript reconciliation every ~5 minutes, at meeting end, or on explicit refresh    | Source-validated `live.analysis` revision with immutable cutoff           |

Targets are initial service objectives to measure and tune, not evidence that the
current deployment meets them.

Visual evidence remains explicit and asynchronous. A capture should become an
evidence event immediately, then join the next window or reconciliation pass; it
must never block audio capture, transcription, or transcript rendering.

## Model-call contracts

### Fast turn extraction

Input only newly finalized turns, current facilitator intent/version, and the
small topic registry needed for stable assignment. Cache by normalized turn text,
speaker mapping revision, and intent version. Require structured output with:

- category, theme/topic ID and confidence;
- exact source spans and source turn IDs;
- response/addressee turn ID when supported;
- typed semantic candidates and relation candidates;
- target-specific support/challenge/qualification only when a target exists; and
- uncertainty/no-op when the evidence is insufficient.

Reject invented quotes or IDs before persistence. Deterministic fallbacks should
leave data pending rather than manufacture a relationship.

### Rolling-window dynamics

Correct the current newest-first ordering before any visual dynamics work. Send a
compact prior window state and only the turns not yet incorporated. The response
should describe observable discussion structure, not attention or emotion. A
prompt may be emitted only when it cites recent supporting turns, passes the
existing guard, is rate-limited, and is shown privately with dismiss/use controls.

Cancel or discard superseded window responses by input revision. Under load,
increase the interval rather than build an invisible backlog.

### Meeting-state reconciliation

Use stable IDs and patch semantics so unchanged nodes do not move. Validate every
source quote and relationship against transcript turns before committing the new
revision. A delta pass should preserve unresolved and minority positions from the
prior state; the periodic exhaustive pass repairs accumulated drift. Human-edited
nodes require explicit merge rules and must never be silently overwritten.

## UI data contract

Add revisioned SSE events with `sessionId`, monotonic `sequence`, input cutoff,
generated time, and analysis status:

- `dynamics.patch` — deterministic timing/participation/freshness changes;
- `meeting.delta` — validated node/relation/stance additions or revisions;
- `window.analysis` — topic and response dynamics for the rolling ribbon;
- `analysis.status` — queued, running, current, delayed, fallback, or failed.

First, wire the existing `intelligence` and `prompt.*` events; this is the fastest
visible improvement and needs no new model call. Then persist analysis revisions
and enough event history for SSE reconnect/replay. The UI should always show three
separate cutoffs: **captured through**, **turn-analyzed through**, and **map
reconciled through**.

## Implementation sequence

1. **Expose what already exists.** Render current deterministic intelligence and
   private prompt events, all with source links and freshness. Collapse the
   existing HUD so the transcript stays primary. Add client tests for snapshot,
   reconnect, prompt expiry, and audience separation.
2. **Ship the dynamics ribbon.** Define topic/response event types, correct window
   chronology, persist window revisions, render stable topic bands and open loops,
   and instrument end-to-end latency.
3. **Make the meaning map incremental.** Render existing relations and selected
   target stances, add `meeting.delta`, stable IDs/layout, grounding rejection,
   cancellation, caching, and backpressure.
4. **Automate reconciliation safely.** Add stateful delta synthesis and automatic
   triggers, retain manual/exhaustive refresh, establish human-edit merge rules,
   and add durable jobs plus SSE replay.
5. **Evaluate before AR.** Run annotated offline tests and live usability studies.
   Prototype one shared spatial anchor and one private peripheral cue only after
   the 2D hierarchy reduces—not increases—attention switching.

## Acceptance criteria

- A newly finalized substantive turn updates the transcript immediately and a
  source-grounded live analysis patch meets the measured Tier 1 latency targets
  under the agreed test load.
- Topic bands, branches, response links, and state labels can always be traced to
  turns; unsupported outputs are rejected or visibly uncertain.
- Reconnect or redeploy restores the latest revisions and cutoffs without silently
  presenting stale analysis as current.
- The map does not reorder unchanged nodes during a small patch, and a facilitator
  edit survives later model revisions.
- The facilitator can dismiss, invoke, or ignore a private prompt; the shared
  display receives no private event and no unreviewed interpretation.
- UI labels describe observable conversational structure and never infer emotion,
  attention, personality, dominance, or participant quality.
- Evaluation reports topic-boundary and response-link precision/recall,
  source-grounding precision, latency p50/p95, revision churn, correction burden,
  usability/cognitive load, and model cost per meeting minute.

## Explicit non-goals

- one alignment, engagement, sentiment, or meeting-quality score;
- equal-airtime enforcement or participant rankings;
- automatic public facilitation interventions;
- rendering partially streamed, unvalidated model JSON; or
- an AR cockpit before the 2D interaction has evidence of usefulness.
