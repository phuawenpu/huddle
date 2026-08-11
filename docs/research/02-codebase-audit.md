# Codebase audit: what the prototype is, how it works, and what remains unproven

**Snapshot:** `main` at `52796dc`, audited 2026-08-07.

## Executive assessment

Critique HUD is a coherent Next.js prototype with two substantial technical paths:

1. a live microphone-to-transcript-to-HUD path; and
2. a scenario-to-multi-speaker-audio simulation path.

Its best implemented information-system idea is the **dual surface**: a private facilitator view can capture and correct information while a restrained public display mirrors selected discourse structure. Its strongest engineering idea is the **provider-stubbed acoustic evaluation harness**, including cached per-turn TTS, overlap scheduling, mixed audio, and independent speech validation.

The code does not yet implement the full target system described in the research program. It lacks artifact context, real identity/visibility governance, longitudinal critique-to-revision provenance, post-jury workflows, and reliable correction/revision propagation. Several README stage claims describe intended or scaffolded behavior as completed. The report therefore uses four labels:

- **Implemented** — present in source and covered by a meaningful verification path.
- **Partial** — a visible path exists, but important semantics or end-to-end behavior are missing.
- **Scaffolded** — schema, endpoint, or UI shell exists without a complete workflow.
- **Absent** — no material implementation found.

## Repository profile

| Measure | Verified value |
|---|---:|
| Next.js application pages | 9 |
| API route files | 39 |
| Prisma models | 11 |
| `src/app` source lines | about 5,361 |
| `src/lib` source lines | about 4,533 |
| Unit tests | 79 in 7 files |
| E2E tests | 9 Playwright cases in 1 file |
| External runtime providers | AssemblyAI and OpenAI |
| Persistent application store | SQLite through Prisma |
| Live transport | browser WebSocket to ASR; server-sent events from app |
| Audio store | local filesystem |

Baseline verification:

```text
npm test           79/79 passed
npx tsc --noEmit   passed
npm run build      passed
```

The E2E suite was inspected but is not evidence of the live audio pipeline. Most cases only assert that pages render, and several key actions are guarded by conditional checks that allow the test to pass without exercising the action.

## System topology

### Live path

```text
room speech
  ↓ browser getUserMedia
AudioContext → AudioWorklet resample/mono/PCM16/50 ms frames
  ↓ binary WebSocket
AssemblyAI v3 streaming ASR
  ↓ final Turn event in browser
POST /api/sessions/{id}/turns
  ↓
SQLite TranscriptTurn
  ├─→ in-memory analysis queue → OpenAI/stub → analysis + DiscussionItem
  ├─→ metrics
  └─→ in-memory pub/sub → SSE
                         ├─→ private facilitator surface
                         └─→ public HUD surface
```

### Simulation path

```text
scenario parameters
  ↓ OpenAI/stub dialogue generation
speaker cast + grounded turn script + expected labels
  ↓ per-turn OpenAI TTS or tone fixture
cached WAV clips
  ↓ ffmpeg delay + mix + limiter + loudness normalization
mixed WAV + MP3 + manifest
  ↓ independent ASR validation for real speech
browser audio player
```

The code produces natural speech when real TTS is enabled and tone fixtures when `TTS_STUB=1`. The README’s statement that the system only uses sine-wave placeholder audio is stale after commit `07c309c`.

### Intended—but not implemented—simulated injection path

The specification requires:

```text
mixed WAV → decode → AudioWorklet → PCM16 → the same ASR WebSocket → turn ingest
```

The current simulator uses an `HTMLAudioElement` for audible playback. It does not decode the file into the capture worklet, does not send it to the ASR client, and does not update the `Run` through the playback endpoint. Therefore:

- **sim C acoustic playback is possible manually** with a second capture device;
- **sim B audio injection is absent** as an end-to-end flow;
- the claim that both simulation modes traverse the real capture path is not currently true.

## Component analysis

### 1. Browser audio capture — implemented with gaps

Evidence:

- `src/lib/client/audio-capture.ts`
- `public/worklets/pcm-resampler.js`
- `src/lib/client/asr-client.ts`
- `src/app/facilitator/[sessionId]/page.tsx`

Implemented:

- standards-based `getUserMedia`;
- feature detection for microphone, AudioContext, and AudioWorklet;
- readback of actual media-track settings;
- hardware-rate AudioContext with worklet resampling to 16 kHz;
- mono PCM16 frames;
- live level meter;
- wake lock;
- bounded five-second pre-connection audio buffer;
- best-effort termination on page exit.

Gaps:

- no user-facing indication when the five-second audio buffer drops frames;
- no idle auto-termination despite `IDLE_TERMINATE_SECONDS` being present in `.env`;
- no device picker;
- no requested-vs-actual settings warning;
- no silence, clipping, or device-disconnect warning;
- session server state can be set active before ASR or microphone startup succeeds;
- stop changes database state but does not publish an SSE status patch;
- server termination does not call `stopWindowAnalysis`.

### 2. AssemblyAI session and diarization — partial

The token route correctly keeps the API key server-side and returns a short-lived browser token. It uses the raw AssemblyAI authorization value rather than a bearer prefix.

Final turns are ingested idempotently with a unique compound key:

`providerSessionId + providerTurnOrder + segmentIndex`

The speaker-revision path is not correct:

- the facilitator handler loops over revisions but does not compare the persisted turn’s `providerTurnOrder` with the revision’s `turnOrder`;
- every turn from the provider session can therefore receive each revised label;
- revisions are only applied to local React state;
- no revision is persisted to `TranscriptTurn`;
- no correction/audit record or SSE patch is produced.

As a result, late diarization refinement is **scaffolded in types and UI but not reliable end to end**.

### 3. Turn ingestion — implemented core, weak validation

`src/app/api/sessions/[id]/turns/route.ts`:

- performs idempotent insert/finalization;
- computes substantive-turn status;
- persists original/current text and word data;
- broadcasts final/update and metrics patches;
- queues finalized substantive turns for analysis.

Risks:

- request bodies are unvalidated `any` data;
- a caller can submit turns for a provider session unrelated to the URL session;
- numeric values use `||`, which conflates legitimate zero values with absence;
- the route is unauthenticated;
- partial turns are supported by the route but the client only ingests finalized turns;
- metrics are recalculated by reading every finalized turn after each final, producing growth in work over session length;
- event IDs are process-local counters and are not durable.

### 4. Analysis engine — partial

`src/lib/analysis.ts` and `src/lib/analysis-queue.ts` implement:

- 1.5-second batching;
- per-session queues;
- maximum two active analyses;
- three-second timeout;
- per-turn categorization;
- 20-second or five-turn window analysis;
- discussion items;
- a single timed public prompt;
- continued transcription when analysis fails.

Important divergences from the specification and research:

- turn analysis does not include the required last five turns;
- `existingItems` is passed to window analysis but never used;
- recent window turns are fetched newest-first and not reversed;
- model output has no runtime schema validation or bounds checking;
- session data and transcript content are embedded in a system prompt without explicit injection isolation;
- a failed real model call silently falls back to deterministic stub output, which can make synthetic analysis appear real;
- the stated “one retry then skip” behavior is not implemented for turn analysis;
- a timed-out request continues in the background because it is not aborted;
- decisions and actions can be re-created every window with no deduplication;
- the `minorityPosition` output is not persisted or displayed;
- distortion-alert fields exist in types but are not generated or enforced;
- discussion items are created only when turn analysis includes an `evidence` string;
- the helper `generateDiscussionMap` is not used by the queue.

### 5. Prompt safety and restraint — partial

Strengths:

- one public prompt at a time;
- 15-second automatic clear;
- blocklist against personality, competence, mental-health, and person-judging language;
- public HUD does not show confidence percentages.

Critical gaps:

- `checkPromptGuard` is called with an empty participant list, so its participant-name rule cannot work;
- generated prompts carry empty `supportingTurnIds`, so they do not cite a visible source;
- relevance is estimated by simple word overlap with the objective;
- a generic useful question is likely to be rejected, while lexical overlap can pass a semantically unrelated prompt;
- prompt display/dismissal semantics are inconsistent: `shown` is changed to true after auto-dismiss;
- prompt dismissal endpoints do not broadcast public changes;
- there is no semantic or model-based safety layer after the blocklist.

The research principle “every distortion alert cites a visible phrase and passes a confidence threshold” is not implemented.

### 6. Intent — UI and schema scaffold, not a provenance system

The facilitator can edit objective, phase, and criteria. Analysis receives the current session values. This is a useful start.

However:

- `PATCH /api/sessions/{id}` overwrites the `Session`;
- it does not create an `IntentRevision`;
- it does not broadcast the updated intent;
- it does not record who changed the intent or why;
- no analysis result explicitly expresses alignment/challenge/alternative relative to intent;
- later feedback is not compared with a specific intent revision;
- the public display only shows the objective string.

The core participatory-design concept of intent alignment is therefore **scaffolded, not implemented**.

### 7. Human correction and audit — partial to nonfunctional

Available code:

- turn text can be edited;
- speaker mappings have endpoints;
- discussion items and prompt records have PATCH routes;
- a `Correction` model exists.

Observed gaps:

- turn edits do not create `Correction` rows;
- turn edits do not publish SSE updates;
- corrected text is not reanalyzed;
- discussion-item changes do not create audit records or publish;
- speaker-mapping creation uses `create`, not `upsert`, so remapping an existing label fails;
- facilitator speaker buttons pass `"A"`–`"F"` as `participantId`, although participant IDs are UUIDs;
- the mapping endpoint does not update existing transcript turns;
- the facilitator UI has no wired item or prompt correction workflow.

The product principle “every AI output is correctable” is not satisfied end to end.

### 8. Public HUD — implemented presentation, limited map semantics

The display provides:

- a simulation badge;
- status and connection state;
- recent transcript cards;
- category tags;
- talk-share bars;
- a list of discussion items;
- one prompt banner;
- responsive/safe-area layout.

Differences from the specification:

- it renders the last five turns, not at most three;
- it can render 20 discussion items, not four per category;
- the “discussion map” is a flat list without relations, alternatives, or source navigation;
- it does not preserve or distinguish minority positions;
- hidden participants are omitted from names and talk share, but transcript content remains;
- reconnect creates a fresh snapshot rather than replaying missed patches.

### 9. Server-sent events — functional live push, no resume guarantee

Strengths:

- named events;
- initial snapshot;
- 15-second heartbeat;
- browser reconnect/backoff.

Problems:

- `Last-Event-ID` is not read by the server;
- there is no event log or replay buffer;
- different publishers use unrelated or missing event IDs;
- the facilitator stores `lastId` but never uses it;
- the cleanup function returned by the events route’s connect callback is ignored by `createSSEResponse`;
- stream cancellation marks the stream closed but does not invoke unsubscribe, creating a subscriber-leak risk;
- the in-memory broker only works reliably in one long-lived process.

The correct current claim is **snapshot-on-reconnect**, not resumable SSE.

### 10. Scenario generation — strong implementation

The generator is one of the most thoughtful parts of the code:

- budget estimates by duration, speaker count, and overlap level;
- explicit conversational causality;
- persistent speaker viewpoints and discourse moves;
- non-round-robin participation;
- calibration turns;
- disagreement, repair, revision, decision, action, and minority-position requirements;
- ground-truth labels and reaction links;
- overlap constraints;
- normalization of model output;
- warnings for duration and participation shortfalls.

Limitations:

- user topic/objective content is interpolated directly into the model prompt;
- long scenarios are not chunked despite the specification;
- output validation is hand-written rather than schema-based;
- some generated targets are warnings rather than hard preflight gates;
- the stub generator does not establish naturalistic conversational validity.

### 11. TTS, mixing, and validation — implemented and newer than README

`src/lib/audio-pipeline.ts` and `src/lib/tts.ts` implement:

- OpenAI speech synthesis with bounded retries;
- deterministic tone fixtures only when explicitly stubbed;
- stable voice casting;
- per-turn instruction composition;
- SHA-256 cache keys;
- per-turn checksums;
- trimming, limiting, resampling, and mono conversion;
- overlap scheduling and validation;
- ffmpeg `adelay` and `amix`;
- WAV and MP3 outputs;
- a manifest with timings and sizes;
- independent ASR validation of real rendered speech;
- persistence of rendered turn start/end times.

This path has one unit test that exercises distinct clips, scheduling, and output files with fixtures. It does not prove browser playback on target devices or the real provider path.

### 12. Evaluation — scaffolded, metrics are misleading

The evaluation route aligns actual and expected text using WER and Hungarian matching, but several returned field names overstate what is measured:

- `speakerAccuracyExcludingOverlaps` counts text matches and does not compare speaker identity;
- `overlapOnlyAccuracy` also uses text WER, not overlap diarization;
- `lostFinalizedTurns` is hardcoded to zero;
- `guardViolationsDisplayed` is hardcoded to zero;
- `realizedVsRequestedDurationPct` is hardcoded to 100;
- the same latency sample is assigned to partial, final, analysis, and HUD percentiles;
- category agreement divides by all expected turns even when only a subset is assigned;
- there is no LLM judge implementation in this path;
- simulator playback events are not recorded.

Evaluation is therefore **scaffolded** and should not support performance claims.

## Research-to-code alignment matrix

| Research requirement | Status | Evidence / gap |
|---|---|---|
| AI as cognitive mirror, not judge | Partial | Map/category/prompt language exists; no authority model or learner-response loop |
| Self, peer, professor modes | Absent | Product modes are live/simulated, not pedagogical critique modes |
| Real-time transcription | Implemented | Worklet, ASR client, turn ingest |
| Speaker-attributed critique | Partial | Base labels work; late revision path is incorrect and unpersisted |
| Cognitive offloading | Partial | Transcript and flat map; no robust post-jury synthesis workspace |
| Plain-language translation | Absent | No contextual “explain this phrase/reference” interaction |
| Active precedent linking | Absent | No entity/reference pipeline |
| Intent-alignment checking | Scaffolded | Session intent is editable, but no alignment relation or revision history |
| Anonymity and visibility control | Scaffolded | `isHidden` affects display; no per-object audience policy or anonymous feedback |
| Correctable AI output | Partial | endpoints exist; audit, propagation, and UI wiring are incomplete |
| Preserve dissent | Scaffolded | model can return minority position; not persisted/displayed |
| Feedback-to-revision continuity | Absent | no artifact/revision/action provenance models |
| Multimodal artifact understanding | Absent | no images, regions, CAD/BIM, or visual evidence |
| Stakeholder rehearsal | Partial | synthetic scenario personas are for testing, not a learner rehearsal workflow |
| Curriculum tracking | Absent | run/session history exists but no curriculum or learning-goal model |
| Accessibility | Partial | responsive text UI; no explicit accessibility evaluation or alternative representations |
| Restrained public intervention | Partial | one timed prompt and no confidence display; source-citation guarantee is absent |
| Simulation disclosure | Implemented | visible simulation badges |
| Real-path sim B | Absent | simulator does not feed audio into worklet/ASR |
| Acoustic sim C | Partial | mixed audio player supports manual two-device test; run capture not orchestrated |

## Data-model assessment

The schema is session-centric. It represents:

- sessions, people, speaker labels, transcript turns;
- mutable intent fields plus unused intent revisions;
- corrections;
- discussion items and prompts;
- synthetic scenarios and runs.

To realize the research, it needs explicit durable objects for:

- studio/course and project;
- artifact and artifact revision;
- intent revision with author and rationale;
- critique event and audience policy;
- feedback claim;
- evidence anchor to transcript span and artifact region;
- relation type: supports, challenges, reframes, alternative, unresolved;
- learner disposition: accept, adapt, defer, reject with rationale;
- action and action completion;
- revision response;
- learning goal and reflection;
- consent, retention, and visibility policy;
- AI derivation metadata: model, prompt version, source IDs, human correction.

## Security, privacy, and deployment risks

These are especially important because the repository README names a public deployment.

1. **No authentication or authorization.** Session, transcript, upload, edit, delete, token-minting, and export endpoints are unauthenticated.
2. **No session capability tokens.** Knowing or discovering an ID is sufficient to read or mutate records.
3. **Asset path containment is not enforced.** The catch-all asset route joins URL components to the asset directory without resolving and checking that the result remains inside the approved root.
4. **Uploads have no size limit.** File type is inferred from MIME or extension, the entire upload is buffered, and disk quota is not enforced.
5. **Raw transcripts persist without a retention policy.**
6. **No consent record.** The information system does not capture participant consent, withdrawal, or audience agreement.
7. **Public caching.** Audio responses use public cache headers even though critique recordings may be sensitive.
8. **Provider degradation can be invisible.** Real analysis may silently fall back to stubs.
9. **No rate limits or abuse controls** on paid provider endpoints.
10. **Database bootstrap duplicates schema logic** with raw SQL and can drift from Prisma migrations.

The AssemblyAI and OpenAI keys remain server-side, and `.env` is ignored by Git. Those are sound foundations, but they do not resolve application-level privacy.

## Priority correction sequence

### P0 — before any public research deployment

1. Add authentication, session capabilities, role authorization, and consent.
2. Enforce asset-root containment, upload limits, private cache policy, and retention/deletion.
3. Fix and persist speaker revisions by exact provider turn order.
4. Make all corrections audited, broadcast, and reprocessed.
5. Replace silent real-to-stub analysis fallback with explicit degraded state.
6. Implement source-linked prompt guard rules with real participant context.

### P1 — to make the current HUD scientifically testable

1. Implement event replay or revise the claim to snapshot recovery.
2. Build the real sim B decode-to-worklet path.
3. Record simulator/run lifecycle and playback events.
4. Replace placeholder evaluation fields with real measures.
5. Add integration tests for ASR messages, revision persistence, corrections, SSE, and guard enforcement.
6. Add real-device smoke tests for Chromium, Firefox, and WebKit.

### P2 — to realize the target information system

1. Introduce project/artifact/revision and feedback-provenance models.
2. Implement critique modes with different authority, timing, and visibility.
3. Implement intent versioning and typed alignment relations.
4. Add source-linked post-jury synthesis, term explanation, and precedent linking.
5. Add privacy-preserving peer critique and audience controls.
6. Add longitudinal reflection and feedback-to-revision views.
7. Add multimodal artifact anchors with Socratic, non-evaluative responses.

## Bottom line

The repository is a credible engineering prototype and a useful testbed. It is not yet a faithful implementation of the target critique-ledger system or a validated novel information system. Its path to defensible novelty is to stop treating the transcript, flat map, or LLM label as the product and instead implement the **governed provenance loop connecting intent, critique evidence, learner judgment, action, and revision**.
