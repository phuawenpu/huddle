# Critique HUD — Consolidated Coder Specification v5

**Status:** standalone and buildable as written. Supersedes v1–v4.
**Target:** one web application, one server process, one repo. Runs in modern evergreen browsers on **any device** — Windows/Linux/macOS laptops, Android phones and tablets, iPhone, iPad. No operating-system-specific features. No external documents required.
**Providers:** exactly two — **AssemblyAI** (streaming speech-to-text + diarization) and **OpenAI** (topic suggestions, scenario generation, critique analysis, evaluation judge, and text-to-speech).

---

## 0. What this is

A Next.js web application that:

1. **Live mode** — listens to a Design Thinking critique through one shared microphone (a phone's built-in mic is fully sufficient), transcribes it with live speaker diarization, classifies each turn by critique function, and renders a read-only HUD on a large display while the facilitator controls everything from a private browser view.
2. **Simulated mode** — generates multi-speaker critique discussions with an LLM, renders them to speech one turn at a time with a distinct OpenAI voice per simulated participant, mixes those turns into **one continuous audio stream with realistic pauses and occasional overlapping speech**, and tests the pipeline two ways: played aloud from a single device into the microphone (**sim C**), or fed directly into the browser audio pipeline (**sim B**). Observed output is scored against the scenario's embedded ground truth. The facilitator chooses **discussion length (3–15 minutes) and speaker count (3–6)**, and picks from **dynamically suggested topics** — never a hardcoded list.

There is no synthetic-event mode: every simulated run passes real audio through the real capture pipeline. The only permitted shortcut is stubbing the *remote services* behind their existing interfaces for cost-free CI.

The product is a **shared cognitive mirror**, not a grading or surveillance system.

The demo must never claim: biometric speaker identification · separation of simultaneous speech · definitive bias detection · personality, emotion, competence, deception, or creativity scoring · automated assessment.

---

## 1. Non-negotiable principles

1. **Describe language, never people.** "Direct instruction detected" — yes. "Authoritarian speaker" — never.
2. **Every AI output is provisional.** The facilitator can correct or dismiss anything.
3. **Restraint:** max three labels per turn, max one public prompt at a time, no public confidence percentages.
4. **Preserve dissent.** Minority positions stay visible.
5. **Transcription survives analysis failure.** LLM down ⇒ transcript continues unannotated.
6. **Intent belongs to the facilitator.** Alignment is measured against a human-authored, live-editable objective.
7. **Every distortion alert cites a visible source phrase** and carries internal confidence ≥ 0.70, or it is not shown.
8. **Simulated sessions are unmistakably labelled** on the public display. This also satisfies the TTS provider's requirement to disclose that a voice is AI-generated.
9. **The headline end-to-end test is sim C** — physical loudspeaker playback into the microphone. Sim B is for deterministic development and CI; its results are labelled and never quoted as demo performance.
10. **No platform or browser lock-in.** Standards-only web APIs, feature-detected; works in Chromium, Firefox, and WebKit/Safari (iOS ≥ 16.4). Anything unsupported degrades with a clear notice, never a silent failure.
11. **Mobile is a first-class client, not a fallback.** Every route is usable one-handed on a phone; `/simulator` is expected to run on a phone in the common case.
12. **Real audio path always.** Simulated runs exercise the same decode → worklet → PCM16 → WebSocket path as live capture.

---

## 2. Efficiency requirements (binding constraints)

### 2.1 Infrastructure minimalism

- **One process.** Next.js serves UI, API routes, SSE, and background work. No worker fleet, no broker, no Redis. In-process queues only.
- **SQLite via Prisma** (`file:./data/app.db`, WAL). The schema avoids Postgres-only features so a later swap is a config change.
- **Local filesystem for audio** (`./data/audio/{scenarioId}/…`), served by a Range-capable route, behind one `AssetStore` interface.
- **No client state library.** SSE snapshot + patches into one reducer per route.

### 2.2 Cost control

- **ASR** bills for the whole time the socket is open, including silence. Auto-terminate after `IDLE_TERMINATE_SECONDS` outside `live` state; always terminate on stop, route change, and page unload (`navigator.sendBeacon`). Show a live "streaming minutes used" counter.
- **LLM turn analysis:** only finalized substantive turns (≥ 4 words or ≥ 1.2 s, not a bare acknowledgement). Batch turns finalizing within 1.5 s into one request. Concurrency 2, timeout 3 s, one retry, then skip.
- **LLM window analysis:** every 20 s **or** after 5 new substantive turns — skipped entirely when no new substantive turn arrived.
- **TTS:** hash-cached per turn (§17.4). Unchanged turns are never re-rendered. A full 10-minute scenario costs well under a dollar and is rendered once.
- **Scenario generation:** one LLM call (chunked only for the longest durations, §16.4). Topic suggestions are one small cached call.
- **LLM judge:** all gist comparisons for a run batched into ≤ 3 calls.
- **CI cost is zero:** sim B with all three provider stubs (§21).
- **Token discipline:** turn analysis = session frame + last 5 turns + target(s). Window analysis = last 20 substantive turns, map items as `{id, category, text}` only.

### 2.3 Runtime efficiency

- **SSE, not polling.** One `EventSource` per route: full snapshot first, then named patches (`turn.final`, `turn.updated`, `metrics`, `map.patch`, `prompt.show`, `prompt.clear`, `status`, `playback`). Diffs only. Coalesce `metrics` to ≤ 1/s. Emit an SSE comment heartbeat every 15 s so mobile proxies don't close idle connections, and set `Last-Event-ID` handling so a reconnect after a network switch resumes rather than restarts.
- **Display route renders at most** 3 transcript turns, 4 items per map category, 6 participation bars, 1 prompt. Memoized cards; CSS-transform animations only (transform/opacity — never animate layout properties, which stutter badly on mobile).
- **AudioWorklet** does resampling, Int16 conversion, and framing off the main thread; the main thread forwards transferred `ArrayBuffer`s.
- **Idempotent ingestion** keyed by `providerSessionId + providerTurnOrder + segmentIndex` (unique index).

### 2.4 Development-loop efficiency

- **Sim B with stubs is the daily driver:** full session end-to-end through the real audio pipeline at zero API cost, deterministic.
- **Build the simulator before the HUD** (§26).
- `npm run dev` with self-signed HTTPS is the only command needed.

---

## 3. Modes

| Mode | `run.mode` | Audio path | ASR | Purpose | Reportable? |
|---|---|---|---|---|---|
| Live | `live` | room → mic → worklet | real | real workshops | yes |
| **Sim C — Acoustic** | `sim_acoustic` | one device's speaker → room → mic → worklet | real | **the** end-to-end test | yes (as simulated) |
| **Sim B — Injection** | `sim_injected` | mixed WAV → decode → worklet | real **or stubbed** | development, regression, CI | dev only |

Both simulated modes write identical `TranscriptTurn` rows and drive identical routes. Runs against the ASR stub are marked `stubbed` and never compared to real-ASR thresholds.

---

## 4. Physical setup

**Capture station:** any device with a modern browser — laptop, Android phone or tablet, iPhone, iPad · whatever microphone the device has (built-in is fully sufficient) · placed centrally so speakers are roughly equidistant · stable internet · HTTPS · screen kept awake (§5.3).

**Display:** `/display` is a browser consuming SSE, so **any networked device can be the conference screen** — smart TV browser, tablet on a stand, second laptop, projector-connected machine. No display cable is required.

**Simulator playback (sim C):** the discussion is **one mixed audio stream** played from **one device** — typically a phone — at `/simulator/[runId]`, or from any media player using the downloadable WAV. Speaker at **70–85% volume** (maximum clips and ruins diarization), **1–3 m** from the microphone.

**Echo-cancellation trap:** if playback and capture run on the *same* device, echo cancellation suppresses the playback as "echo". Use a separate device. If unavoidable, request `echoCancellation: false` (plus noise suppression and AGC off) — noting iOS may ignore the constraint — and record the deviation.

**HTTPS on LAN:** mic access and `AudioWorklet` need a secure context, and other devices must reach the app. Options: (a) a tunnel with a publicly trusted certificate — easiest for mixed-device rooms; (b) `mkcert` with the root CA installed **and explicitly trusted** on each device (iOS/iPadOS requires a separate trust toggle after install); (c) desktop-only on `localhost`.

---

## 5. Browser and mobile support

### 5.1 Matrix

Chromium (Chrome/Edge) desktop + Android · Firefox desktop · Safari/WebKit on iOS 16.4+, iPadOS 16.4+, macOS. **On iOS every browser is WebKit underneath**, so WebKit is a first-class target.

Standards-only APIs, feature-detected at runtime: `getUserMedia`, `AudioWorklet`, `AudioContext`/`decodeAudioData`, binary WebSocket, `EventSource`, `sendBeacon`, Screen Wake Lock. Feature-gate, don't UA-sniff; on a missing capability name the capability and suggest a current browser. UA strings only phrase the message.

### 5.2 Mobile layout rules (apply to every route)

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Never `user-scalable=no`.
- **Use `dvh`, not `vh`.** iOS Safari's collapsing toolbar makes `100vh` overflow; full-height panes use `100dvh` with a `vh` fallback.
- **Respect safe-area insets** (`env(safe-area-inset-*)`) so controls clear the notch and the home indicator. `/display` in particular must not put the clock under a notch.
- **Touch targets ≥ 44 × 44 px** with ≥ 8 px separation. This is binding for the dense controls: turn-speaker correction, label dismissal, and map-item moves.
- **No hover-only affordances.** Every action reachable on hover must also be reachable by tap; dismiss and edit controls are always visible on touch, not revealed on hover.
- **`overscroll-behavior: contain`** on scrollable panes and `none` on `/display` and `/simulator`, so pull-to-refresh can't reload mid-session.
- **`touch-action: manipulation`** on controls to remove the 300 ms tap delay and prevent double-tap zoom on rapid corrections.
- **Type scales with viewport** (`clamp()`), so `/display` is legible on a 1080p screen at 5 m *and* on a 10-inch tablet at 1 m.
- **No drag-only interactions.** Moving a discussion-map item between categories offers a tap → "move to…" menu alongside any drag affordance.
- **Bottom-anchored primary actions** on phones (thumb reach): Start/Stop capture, Start/Stop playback, End session.
- **Landscape and portrait both supported.** `/display` assumes landscape but must not break in portrait; `/facilitator` and `/simulator` are portrait-first.

### 5.3 Mobile audio and lifecycle (the parts that actually break)

- **AudioContext starts suspended** on iOS; `resume()` must run inside a user gesture. Both capture-start and playback-start are explicit taps — never auto-start either.
- **Hardware sample rate is fixed** on iOS (44.1/48 kHz) and a requested `sampleRate` may be ignored. The worklet **always resamples from `context.sampleRate` to 16 kHz**; never assume the context rate anywhere.
- **Constraints may be ignored.** Always read back `track.getSettings()` and display reality. Hide the device picker when only one input exists (the normal phone case).
- **Backgrounding suspends audio.** Acquire a **Screen Wake Lock** on capture start and on playback start; re-acquire on `visibilitychange`; show a persistent "keep this screen on" hint where wake lock is unavailable. On interruption (call, lock, tab switch), show "audio was interrupted — tap to resume"; for sim C mark the run `incomplete`.
- **Interruptions from phone calls and other apps** must be handled as a normal state, not a crash: `statechange` on the context and `ended`/`mute` on the track both surface the same recoverable UI.
- **Low Power Mode throttles timers.** Never rely on `setInterval` for audio scheduling — playback uses absolute Web Audio times; the heartbeat tolerates jitter.
- **Network switches (Wi-Fi ↔ cellular) drop sockets.** The ASR socket requires an explicit Reconnect (fresh token, §9.1); `EventSource` reconnects automatically and resumes via `Last-Event-ID`.
- **Fullscreen API is unavailable for arbitrary elements on iPhone** (available on iPadOS). `/display` must look correct without it: minimal chrome, dark background, "add to home screen for full screen" hint.
- **Data use:** the mixed WAV can be tens of MB. `/simulator` shows the download size before preloading and offers an MP3 variant on metered connections (WAV remains the sim-B and evaluation source of truth).
- **Battery:** cap `/display` animation to opacity/transform, avoid continuous canvas rendering, and never poll.

### 5.4 Compatibility testing

Playwright runs UI suites against `chromium`, `firefox`, and `webkit`, plus **device emulation profiles** (iPhone portrait, Android phone portrait, iPad landscape) asserting: no horizontal overflow, all interactive targets ≥ 44 px, primary actions inside the safe area, and `/display` legible at tablet width. Chromium-only fake-mic flags cover the capture branch. A manual smoke on one real iPhone and one real Android device is in the pre-demo checklist — emulation does not catch WebKit audio-lifecycle behaviour.

---

## 6. Routes

| Route | Typical device | Purpose | Mic |
|---|---|---|---|
| `/` | any | start live critique · generate simulated discussion · scenario library · runs | no |
| `/sessions/new` | any | session setup form | no |
| `/facilitator/[sessionId]` | laptop or phone (private) | capture, all controls, full transcript | **yes** |
| `/display/[sessionId]` | any networked screen | read-only HUD | no |
| `/scenarios` | any | library: filter, duplicate, regenerate, approve, delete, launch | no |
| `/scenarios/new` | any | generation form: topic, **length**, **speakers**, difficulty | no |
| `/scenarios/[scenarioId]` | any | review script, voice casting, expected labels, audio readiness | no |
| `/simulator/[runId]` | **one playback device, usually a phone** | plays the single mixed stream | no |
| `/runs/[runId]/results` | laptop or tablet | ground-truth comparison, latency, export | no |

Only `/facilitator` requests microphone permission.

---

## 7. Architecture

```text
            LIVE                        SIM C                         SIM B
     room participants        one device playing the              mixed WAV
                              mixed discussion stream
            ↓                           ↓                             ↓
                  microphone (room acoustics)                  decodeAudioData
            ↓                           ↓                             ↓
        getUserMedia ─────────────────────────────────────────► AudioWorklet
                                                                      ↓
                                          PCM16 · mono · 16 kHz · 50 ms frames
                                                                      ↓
                                    ASR WebSocket — AssemblyAI, or the in-process
                                    stub speaking the same protocol (CI/dev)
                                                                      ↓
                                    Begin / Turn / SpeakerRevision / Termination
                                                                      ↓
                                    ingest (idempotent)
                                    ├── persist turns · split segments
                                    ├── resolve mapping · metrics
                                    ├── queue turn analysis (batched)
                                    ├── window analysis (20 s / 5 turns)
                                    └── discussion map · prompt guard
                                                   ↓ SSE (snapshot + patches)
                              /facilitator     /display     /simulator     /runs/results
```

---

## 8. Browser audio capture

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
    channelCount: 1,
    echoCancellation: true,   // request only; verify via getSettings()
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
});
```

UI shows: actual device from `getSettings()` (picker hidden when only one), live level meter, silence warning, clipping warning, disconnect warning, wake-lock status, start/stop. Permission denial gets browser-appropriate, OS-agnostic guidance.

**AudioWorklet** (never `MediaRecorder` as the streaming source — it does not emit PCM16):

1. receive Float32 at `context.sampleRate` (**never assume 16 kHz**); 2. mixdown to mono; 3. resample to 16 kHz; 4. convert to Int16 (clamp ±32767); 5. frame ~50 ms (800 samples); 6. `postMessage` with transferred `ArrayBuffer`; 7. stop cleanly.

Main thread sends binary WebSocket frames at real-time pace. Buffer while not `OPEN`; drop with a visible warning past 5 s backlog.

```typescript
type AudioSource =
  | { kind: "microphone"; deviceId?: string }
  | { kind: "file"; url: string };   // sim B: decoded, fed to the worklet, NOT to speakers
```

---

## 9. ASR integration (AssemblyAI)

### 9.1 Token endpoint (server-side; the permanent key never reaches the browser)

```http
GET /api/providers/assemblyai/token
```

Server: `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=7200` with `Authorization: <ASSEMBLYAI_API_KEY>`. Tokens are **single-use**; every connection and reconnect needs a fresh one. With `ASR_STUB=1` this returns a stub token and the stub's WebSocket base — the client path is identical.

### 9.2 Connection

```typescript
const params = new URLSearchParams({
  token,
  sample_rate: "16000",
  speech_model: cfg.speechModel,                       // env: universal-3-5-pro
  speaker_labels: "true",
  max_speakers: String(Math.min(speakerCount + 1, 10)),
  voice_focus: "far-field",
  mode: "balanced",
});
const ws = new WebSocket(`${cfg.asrWsBase}/v3/ws?${params}`);
```

`max_speakers` is a **hard cap**: beyond it new voices merge into existing labels; set too high and labels over-split. Use the scenario's or session's `speakerCount + 1`, capped at 10.

**Vocabulary prompting** via `prompt` / `keyterms_prompt` (URL-encoded): *Design Thinking, Double Diamond, How Might We, affinity mapping, user journey, prototype, desirability, feasibility, viability, divergence, convergence*, plus participant names. Improves spelling only — does not identify voices.

### 9.3 Events

`Begin` · `SpeechStarted` · `Turn` (partial/final) · `SpeakerRevision` · `Termination` · error/close.

**Partial:** provisional text in the facilitator view, optionally faint on display; never persisted, analyzed, or counted.
**Final:** store `turn_order` + word-level labels/timings; resolve mapping; idempotent upsert; update metrics; queue analysis if substantive; broadcast.
**Word-level splitting:** if one provider turn contains meaningful stretches (≥ ~1 s or ≥ 4 words) from multiple speakers, split into segments sharing `providerTurnOrder` with incremented `segmentIndex`; leave uncertain fragments unassigned.
**`SpeakerRevision`:** preserve `originalProviderSpeakerLabel`; apply revised labels by `turn_order`; reapply mappings; recalculate participation; mark `wasSpeakerRevised`.
**Termination:** send `{"type":"Terminate"}`, await `Termination`, close audio, run one final window analysis, enable export. `sendBeacon` on unload.

### 9.4 Known limitations (state them; do not engineer around them)

Labels are generic and session-scoped · early labels can be unstable · turns < ~1 s ("yeah") may return `UNKNOWN` and must display as **"Unassigned speaker"**, never auto-attached · one mixed channel means overlapping speech is assigned imperfectly · reverberation, noise, and similar voices reduce accuracy · revisions may arrive only at stream end.

---

## 10. Session setup and calibration

Fields: title · objective · phase · 1–3 criteria · speaker count · participant names (+ roles) · microphone · consent (live) · optional linked scenario.

```typescript
type DesignThinkingPhase =
  | "frame" | "empathize" | "define" | "ideate"
  | "evaluate" | "decide" | "plan_experiment" | "reflect";
```

Objective, phase, and criteria are **editable mid-session**; each edit writes an `IntentRevision`. Intent alignment uses the latest revision.

**Calibration:** each participant — or each simulated voice — speaks alone for 8–12 s with 1.5–2.5 s of silence between speakers, and calibration turns **never overlap**. The facilitator maps labels to names. Calibration turns are flagged `isCalibration` and **excluded from all critique metrics and talk share**. Mapping is session-specific, not biometric.

---

## 11. Public HUD (`/display`)

**16:9 at 1920 × 1080, responsive to tablets and phones · no scrolling · readable at ~5 m on a large screen · four regions max · body ≥ 24 px and metrics ≥ 32 px at 1080p, scaled with `clamp()` · no editing controls · no confidence values · correct without the Fullscreen API · safe-area aware.**

```text
DESIGN CRITIQUE HUD                                          18:42
OBJECTIVE  Evaluate first-time user onboarding
PHASE      Evaluate            STATE   Comparing alternatives
FOCUS      Assisted versus self-directed onboarding
```

Simulated runs add: `◆ SIMULATION — synthetic AI voices, not a live discussion`.

**Transcript panel (~55–60% width):** latest **three** finalized substantive turns, ≤ 3 labels each. Vocabulary: observation · question · concern · suggestion · preference · evidence · challenge · synthesis · decision · action · supports intent · challenges intent · requests evidence · rationale provided · rationale unclear.

**Discussion map (right):** EVIDENCE · OPEN QUESTIONS · POSITIONS · DECISIONS/ACTIONS. Max 4 visible per category; stable ids; facilitator-editable.

**Metric strip (bottom):** active speakers · questions · evidence · open issues · talk share. **Visually neutral**: one colour family, no rankings, no warning colours, calibration excluded, `UNKNOWN` excluded from the denominator but shown as `unattributed` in the facilitator view.

**Prompt banner:** one neutral banner, auto-dismiss after 10–15 s.

---

## 12. Metrics

**Deterministic:** speaking time · talk share · turn count · average turn length · active speakers · zero-turn participants · unattributed ms/% · long turns (> 60 s) · rapid speaker changes · audio health · socket health · streaming minutes.

**Per-turn (LLM):** feedback function · evidence status · rationale status · intent relationship · theme · stance · potential signal.

**Window (LLM):** theme · discussion state · phase allocation · open questions · positions · decisions · actions · agreement state · minority position · ≤ 1 prompt.

---

## 13. Analysis contracts

```typescript
type FeedbackType =
  | "observation" | "question" | "concern" | "suggestion" | "preference"
  | "challenge" | "synthesis" | "decision" | "action" | "other";

type PotentialSignal =
  | "none" | "preference_as_requirement" | "unsupported_certainty"
  | "personal_directed_language" | "authority_closure" | "premature_consensus"
  | "repeated_claim_without_new_support" | "solution_before_problem";

interface TurnAnalysisInput {
  session: { objective: string; phase: string; criteria: string[] };
  currentTheme?: string;
  recentTurns: Array<{ id: string; speaker: string; text: string }>; // last 5
  targetTurns: Array<{ id: string; speaker: string; text: string }>; // batched
}

type TurnAnalysis = {
  turnId: string;
  feedbackTypes: FeedbackType[];
  theme: string;
  evidenceStatus: "provided" | "requested" | "absent" | "not_applicable";
  rationaleStatus: "provided" | "unclear" | "absent" | "not_applicable";
  intentRelationship: "supports" | "challenges" | "new_criterion" | "possible_drift" | "unclear";
  stance: "supports" | "opposes" | "qualifies" | "requests_evidence" | "alternative" | "neutral" | "unclear";
  potentialSignal: PotentialSignal;
  sourcePhrases: string[];   // verbatim substrings; required if potentialSignal ≠ "none"
  displayLabels: string[];   // ≤ 3
  confidence: number;
};
```

Analyzer rules: ≤ 3 labels from the permitted vocabulary · never infer emotion, personality, motive, competence, intelligence, or protected attributes · weak evidence is not false evidence · never call a person biased · `none` unless the pattern is explicit, with `sourcePhrases` quoting it · JSON only.

```typescript
type WindowAnalysis = {
  currentTheme: string;
  discussionState:
    | "exploring_problem" | "seeking_evidence" | "generating_alternatives"
    | "comparing_alternatives" | "resolving_disagreement"
    | "making_decision" | "planning_action";
  phaseAllocation: { problemAndEvidence: number; ideas: number; evaluation: number; decisionsAndActions: number };
  openQuestions: DiscussionItem[]; positions: DiscussionItem[];
  decisions: DiscussionItem[]; actions: DiscussionItem[];
  agreementState: "broad_agreement" | "provisional_agreement" | "mixed_positions" | "active_disagreement" | "insufficient_discussion";
  minorityPosition?: string;
  facilitatorPrompt?: { text: string; supportingTurnIds: string[]; confidence: number; expiresAfterSeconds: number };
};
```

---

## 14. Distortion signals and the prompt guard

**No speaker bias score, ever.** Observable language patterns only:

preference as requirement (*"It has to be blue."*) · unsupported certainty (*"Users will obviously understand this."*) · personal-directed language (*"You never explain things clearly."*) · authority closure (*"The professor already decided, so stop discussing it."*) · premature consensus · repeated claim without new support · solution before problem.

Public wording is tentative and language-directed.

**Server-side prompt guard — mechanical, mandatory.** Reject before SSE if the prompt: contains a participant display name · matches second-person accusation patterns (`you always`, `you never`, `you are`) · contains a blocklisted trait word (aggressive, insecure, passive, manipulative, confused, biased, dominant, dominating, incompetent, emotional, defensive, ineffective, lazy, hostile, arrogant) · confidence < 0.70 · lacks a supporting turn id · (signals) lacks a `sourcePhrases` entry that is a verbatim substring of the cited turn. Rejections are logged, never displayed, and counted in the evaluation report.

---

## 15. Facilitator controls

Microphone choice (when >1) · level test · start/stop streaming · map and re-map labels · correct a turn's speaker · edit transcript text (original preserved) · edit/dismiss any AI label · move/edit/confirm/resolve/dismiss map items · confirm decisions and actions · revise objective/phase/criteria · hide participation from display · pause public prompts · pause the HUD · toggle control↔display preview · terminate and export.

Every correction writes a `Correction` audit row. AI annotations never overwrite source text. **On phones all controls live in a bottom sheet with ≥ 44 px targets; the transcript list stays scrollable behind it; primary actions are bottom-anchored.**

---

## 16. Simulated discussion generation

### 16.1 Generation form (`/scenarios/new`)

| Field | Control | Values |
|---|---|---|
| Topic | **dynamic suggestion chips** (§16.2) + optional free text | — |
| **Length** | **selector** | **3, 5, 8, 10, 12, 15 minutes** (default 8) |
| **Speakers** | **selector** | **3, 4, 5, 6** (default 4) |
| Workshop type | select | see enum |
| Objective | text, auto-drafted from topic | editable |
| Phase | select | `DesignThinkingPhase` |
| Criteria | 1–3 chips, auto-drafted | editable |
| Difficulty | select | `clean` · `realistic` · `challenging` · `stress_test` |
| Disagreement level | select | low · moderate · high |
| Evidence quality | select | weak · mixed · strong |
| Facilitation quality | select | absent · light · active |
| **Cross-talk level** | select | **none · occasional · frequent** (§16.5) |
| Language | select | default English |
| Patterns to include | multi-select | `PotentialSignal` values |

```typescript
type WorkshopType =
  | "concept_critique" | "user_research_synthesis" | "prototype_review"
  | "service_design_critique" | "problem_framing" | "ideation_review"
  | "prioritization" | "retrospective";

type ScenarioDifficulty = "clean" | "realistic" | "challenging" | "stress_test";
type CrossTalkLevel = "none" | "occasional" | "frequent";
```

The form shows a live estimate as the selectors change: *"≈ 92 turns · ≈ 9,400 characters · ≈ 3 overlaps · est. TTS cost $0.19 · est. render time 2–4 min."*

### 16.2 Dynamic topic suggestions (no hardcoded list)

- On load the client calls `GET /api/scenarios/topic-suggestions`; render 6–10 chips.
- **"More topics"** fetches a fresh batch with prior suggestions passed as `exclude`.
- Optional **seed** ("something about…") biases the batch.
- Selecting a chip drafts objective, criteria, and title (one small LLM call, editable).
- Free text remains possible; suggestions are the primary path.
- Cached per `(seed, excludeHash)` for `TOPIC_SUGGESTION_TTL_SECONDS` (default 3600); "More topics" bypasses cache.
- `LLM_STUB=1` returns deterministic fixtures.

```typescript
interface TopicSuggestionInput { seed?: string; exclude?: string[]; count?: number; language?: string }
type TopicSuggestion = {
  topic: string; domain: string;
  suggestedObjective: string; suggestedCriteria: string[];
  workshopTypeHint: WorkshopType;
};
```

Topic-suggestion system prompt (verbatim):

```text
You suggest discussion topics for simulated Design Thinking critique
workshops used to test a transcription and analysis system.

Return the requested number of topics as JSON matching the schema.
- Topics are concrete, critiquable design artifacts or concepts (a service,
  a prototype, a flow, a policy proposal with a designed touchpoint), never
  abstract themes like "innovation".
- Span diverse domains: public services, health, education, mobility,
  finance, sustainability, culture, workplace tools, consumer products.
- If a seed is given, all topics relate to it while staying varied.
- Never repeat anything in the exclude list, including close paraphrases.
- Each suggestedObjective is one evaluable sentence a facilitator could
  state; each criteria list has 2-3 short, distinct criteria.
- No real company or product names; no real people; nothing requiring
  specialized domain knowledge to critique.
JSON only.
```

### 16.3 Length and speaker budgeting

Speech planning constants (measured against the TTS voices at rate 1.0 and corrected after the first render):

- **≈ 135 spoken words per minute**, **≈ 5.6 characters per word** ⇒ **≈ 750 characters of speech per minute**.
- **≈ 11 turns per minute** of main discussion (mixed short and long turns).
- **Calibration overhead** = `speakerCount × 10 s` speech + `(speakerCount − 1) × 2 s` gaps + 2 s lead-in.
- **Inter-turn pause budget** ≈ 0.45 s average ⇒ ~8% of wall-clock is silence.

```typescript
function budget(durationMinutes: number, speakerCount: number) {
  const totalMs = durationMinutes * 60_000;
  const calibrationMs = speakerCount * 10_000 + (speakerCount - 1) * 2_000 + 2_000;
  const mainMs = totalMs - calibrationMs;
  const speechMs = mainMs * 0.92;                       // 8% pauses
  const targetTurns = Math.round((speechMs / 60_000) * 11);
  const targetCharacters = Math.round((speechMs / 60_000) * 750);
  const minTurnsPerSpeaker = Math.max(4, Math.floor((targetTurns * 0.6) / speakerCount));
  return { calibrationMs, targetTurns, targetCharacters, minTurnsPerSpeaker };
}
```

Reference grid (main-discussion turns, excluding calibration):

| Length | 3 speakers | 4 | 5 | 6 |
|---|---|---|---|---|
| 3 min | ~28 | ~26 | ~25 | ~23 |
| 5 min | ~48 | ~47 | ~45 | ~44 |
| 8 min | ~79 | ~77 | ~76 | ~74 |
| 10 min | ~99 | ~98 | ~96 | ~95 |
| 12 min | ~120 | ~118 | ~117 | ~115 |
| 15 min | ~150 | ~149 | ~147 | ~146 |

**Rules:**
- **3-minute scenarios are structurally constrained.** With 6 speakers there is barely room for calibration plus a decision. The form warns when `durationMinutes ≤ 3 && speakerCount ≥ 5`: *"Short discussions with many speakers leave little room for evidence and decisions — consider 5 minutes or fewer speakers."* It does not block.
- **Talk share is derived, not free.** Each speaker gets a `targetTalkShare` summing to 100, skewed per the participation profile (`even` or `uneven`); the generator is given per-speaker turn targets, not just a total.
- **Long scenarios are generated in chunks.** Above ~110 target turns (12 and 15 minutes), generate in two passes: pass 1 produces the arc and first half; pass 2 receives the arc plus the last 10 turns and continues to the decision. Both use the same schema; ids are renumbered on merge.
- **Post-generation validation:** if realized character count deviates > 20% from `targetCharacters`, the scenario is marked `draft` with a "shorter/longer than requested" notice and a one-click regenerate. After synthesis, actual audio duration is stored as `realizedDurationMs`, and the planning constants are re-fit from the last 20 renders.
- `speakerCount` propagates to `max_speakers = speakerCount + 1` on every run created from the scenario.

### 16.4 Discussion-generator system prompt (verbatim)

```text
You write realistic transcripts of design-critique workshops for testing a
transcription and analysis system. Produce JSON matching the supplied schema.

TARGETS (must be met):
- Exactly {speakerCount} speakers.
- About {targetTurns} main-discussion turns, {targetCharacters} characters
  of spoken text total (±15%).
- Each speaker has at least {minTurnsPerSpeaker} turns; per-speaker share
  approximates the supplied targetTalkShare values.
- Begin with one calibration turn per speaker: each introduces themselves
  alone for 8-12 seconds (roughly 20-30 words), marked isCalibration:true.
  Calibration turns never overlap and carry no expected critique labels.

STYLE:
- Natural spoken English (or the requested language): contractions,
  occasional false starts and self-corrections, short backchannels. Not
  essay prose. Filler words sparse.
- Each speaker has a consistent role, vocabulary level, discourse style,
  and habitual move (one asks for evidence, one asserts preferences, one
  synthesizes, one stays quiet then makes a strong point).
- Turns are 3-45 words; vary length; most turns short. Include enough
  uninterrupted stretches per speaker for diarization to work: at least
  half of each speaker's turns are 12 words or longer.
- Names appear in dialogue only occasionally; the system must not be able
  to infer speakers by hearing names.

CONTENT:
- The discussion progresses: problem, evidence, alternatives, evaluation,
  and at least one decision or action before the end.
- Express the requested target behaviours through realistic language, never
  announced. Nobody says "I am claiming consensus."
- One minority position remains unresolved at the end.
- Include {backchannelCount} backchannel turns under 4 words, marked
  expected.substantive:false.
- Mark exactly {overlapCount} turns with an overlap object per the
  cross-talk rules given; overlaps are interruptions or eager agreements,
  and the interrupted turn still reads as complete text.

LABELS:
- Fill `expected` for every turn as a careful human annotator would.
  potentialSignal is "none" unless the pattern is explicit in that turn's
  own words. Ground every expected label in the actual wording.
- No demographic stereotypes. Never state a person's personality,
  competence, or emotional state as fact.

Return JSON only.
```

Scenarios are reviewable and editable at `/scenarios/[id]`; **approve** is required before a run is reportable.

### 16.5 Overlapping speech

No TTS API emits true simultaneous speech. Overlap is produced **at the mixing stage** (§17.6) by scheduling one turn to begin before the previous one ends — which is also how the speech-research community builds multi-talker test material.

**Overlap budget by `crossTalkLevel`** (calibration excluded from all counts):

| Level | Overlap events | Overlap duration | Overlapped speech as % of total | Typical difficulty |
|---|---|---|---|---|
| `none` | 0 | — | 0% | `clean` |
| `occasional` | 2–4 per 10 min, scaled by length | 300–900 ms | ≤ 3% | `realistic` (default) |
| `frequent` | 8–12 per 10 min | 400–1500 ms | 6–10% | `challenging` / `stress_test` |

```typescript
type ScenarioOverlap = {
  withTurnId: string;      // the turn being overlapped (always the immediately previous turn)
  startOffsetMs: number;   // ms BEFORE the previous turn ends that this turn begins
  kind: "interruption" | "eager_agreement" | "backchannel";
};
```

**Hard rules — enforced in code at synthesis, not left to the generator:**
1. **Never overlap two calibration turns**, and never overlap the first two main turns (early diarization is already unstable).
2. **Never more than two concurrent speakers.** Reject any schedule where three clips sound at once.
3. **Same speaker cannot overlap themselves.**
4. **Overlap ≤ 1500 ms** and ≤ 60% of the shorter clip.
5. **Overlap only at turn boundaries** — the tail of one turn against the head of the next. No mid-turn interjections in v1.
6. Overlapped turns are flagged `possibleOverlap` on both sides.

**Evaluation consequences, which must be stated in the report:**
- Overlapped turns are **excluded from the headline speaker-accuracy figure** and reported separately, because the ASR cannot separate concurrent speakers by design (§9.4).
- Raising overlap degrades diarization more than it degrades transcription — the two metrics move in opposite directions, so a scenario tuned to stress ASR will make diarization look worse than it is. Keep `occasional` as the default and reserve `frequent` for `diarization_stress`.
- `overlapRatioPct` (overlapped speech ÷ total speech) is recorded on every run so results are comparable only across matching ratios.

### 16.6 Required library (regenerable configs, not canned transcripts)

`npm run scenarios:seed` generates these through the normal pipeline:

| Config | Length / speakers / cross-talk | Must trigger |
|---|---|---|
| `clean_evidence_led` | 8 min · 4 · none | clean turn-taking, one decision + one action — the calibration reference |
| `preference_vs_requirement` | 8 min · 4 · occasional | `preference_as_requirement`, evidence requested vs provided |
| `minority_position` | 10 min · 5 · occasional | minority preserved, `premature_consensus` |
| `premature_convergence` | 8 min · 4 · occasional | "evaluation began after only one alternative" |
| `uneven_participation` | 10 min · 5 · occasional | participation prompt, neutral styling |
| `authority_closure` | 8 min · 4 · occasional | `authority_closure`, mild `personal_directed_language` |
| `short_standup` | 3 min · 3 · none | shortest viable run; verifies budgeting at the low end |
| `long_session` | 15 min · 6 · occasional | chunked generation, session-length stability, `max_speakers = 7` |
| `diarization_stress` | 10 min · 6 · frequent | documented degradation under heavy overlap |

One frozen scenario JSON plus its rendered fixture WAV is committed for CI.

---

## 17. Speech synthesis (OpenAI)

### 17.1 Provider

```text
POST https://api.openai.com/v1/audio/speech
model:           gpt-4o-mini-tts        (env TTS_MODEL)
voice:           one of the built-in voices (§17.2)
input:           the turn text
instructions:    per-speaker persona and accent direction (§17.3)
response_format: wav
```

Why this model: it accepts a natural-language `instructions` field controlling accent, tone, pace, and delivery, which is how distinct personas are cast from a preset voice set. Its known constraints all fall outside our usage pattern — preset voices only (we don't clone), a ~2,000-token input cap (we render one 3–45-word turn per call), and drift on outputs beyond 1–2 minutes (our longest clip is a ~12-second calibration turn). Long-form instability is precisely why this spec renders **per turn** and mixes locally rather than requesting a whole discussion in one call.

**Always request `wav`.** MP3 introduces encoder padding that shifts clip boundaries by tens of milliseconds — fatal for a manifest whose timings become evaluation ground truth. MP3 is generated once, at the end, only as an optional lower-bandwidth download for the simulator on metered connections.

**Disclosure:** the provider's usage policy requires telling end users a voice is AI-generated. The SIMULATION badge (§11), the simulator header, and the results page satisfy this; none of them may be suppressed for simulated runs.

### 17.2 Voice casting

Built-in voices: `alloy` · `ash` · `ballad` · `coral` · `echo` · `fable` · `nova` · `onyx` · `sage` · `shimmer` · `verse` · `marin` · `cedar`. `marin` and `cedar` are the current quality-first choices and should be cast first.

The casting rule that matters more than any other: **two similar voices collapse into one diarization label and invalidate the entire run.** Casting therefore maximizes acoustic distance, not pleasantness.

```typescript
type VoiceCasting = {
  voiceId: string;
  timbreClass: "low" | "mid_low" | "mid" | "mid_high" | "high";
  instructions: string;      // persona + accent + pace
  speakingRate: number;      // 0.9–1.1, distinct per adjacent timbre class
};
```

Rules:
1. **No voice is reused within a scenario.**
2. **No two speakers share a `timbreClass`.** With 6 speakers all five classes are used and the duplicate pair is separated by ≥ 0.08 in `speakingRate` plus clearly different accent instructions.
3. **Default casting order** (extend as speaker count grows): `cedar` (low) → `marin` (mid_high) → `sage` (mid) → `shimmer` (high) → `onyx` (mid_low) → `nova` (mid_high, distinct accent + rate).
4. Casting is stored on the scenario and shown in the review screen with a **preview button per speaker**, so a bad cast is caught before a full render.
5. Casting is **regenerable** — "recast voices" re-renders only the affected turns (hash change).

### 17.3 Accent and persona instructions

Accent variety is a deliberate test input, not decoration: non-native and regionally accented English is where ASR degrades, and a harness that only ever hears one accent overstates accuracy.

The `instructions` field carries the accent because the built-in voices are English-optimized and quality varies by accent and proper noun. Verify each cast by ear at the preview step rather than trusting the instruction.

The scenario generator assigns each speaker an `accentHint` from a rotating set (e.g. *neutral North American · southern British · Indian English · Nigerian English · German-accented English · Singaporean English · Brazilian-Portuguese-accented English*), and the server composes:

```text
Speak as {role}, a participant in a design critique meeting.
Accent: {accentHint}. Delivery: {discourseStyle} — {styleDirection}.
Conversational meeting register, moderate pace, no announcer or narration
tone. Do not add words that are not in the text.
```

`styleDirection` per discourse style, e.g. `questioning` → "curious and probing, rising intonation on questions"; `directive` → "brisk and declarative, little hedging"; `quiet` → "measured, slightly lower volume, unhurried".

Rules: at least **two distinct accents** in any scenario with ≥ 4 speakers · no caricature, and no accent paired with a role in a way that implies competence · no imitation of real people · the same `instructions` string is part of the render hash, so changing a persona re-renders only that speaker's turns.

### 17.4 Per-turn rendering and caching

```typescript
renderKey = sha256([
  turn.text, casting.voiceId, casting.instructions,
  casting.speakingRate, format, ttsModel
].join("\u0000"));
```

- One request per turn, concurrency 4, exponential backoff on 429/5xx, 3 attempts.
- Store `./data/audio/{scenarioId}/{turnId}.wav`, plus `durationMs` (measured from the decoded PCM, never estimated) and a checksum.
- **Loudness normalize every clip to −3 dBFS peak** so no voice dominates the mix and level differences don't become a diarization cue the room wouldn't provide.
- Trim leading/trailing silence to < 80 ms before measuring duration, so scheduled gaps mean what they say.
- Unchanged turns are never re-rendered; editing one line re-renders one clip.
- Failure marks the scenario incomplete, lists failed turns, allows selective regeneration, and **blocks playback**.

Cost at ~750 characters per minute of speech: a 10-minute scenario is ~7,500 characters, rendered once and cached — cents, not dollars. The form's estimate line makes this visible before generation.

### 17.5 Voice-distinctness preflight (blocking)

Before a scenario becomes `ready`, the server mixes the calibration section alone and streams it through the ASR (real provider, or the stub when configured) with `max_speakers = speakerCount + 1`, then asserts:

- the number of distinct labels equals `speakerCount`;
- no single label holds > 45% of calibration speech;
- no speaker's calibration turn is split across more than two labels.

Failure blocks `ready` and reports which two speakers merged, with a one-click **recast** that changes the offending voice and re-renders only those turns. This is the cheapest possible place to catch the failure that silently corrupts every downstream metric.

### 17.6 Mixing into one stream

```text
per-turn WAV clips
    → schedule: scheduledStartMs from durations, pauses, and overlaps
    → ffmpeg: adelay per clip → amix (inputs=N, normalize=0) → alimiter
    → optional: afir room impulse response  (sim-B realism)
    → optional: low-level room-noise bed at −40 dBFS (stress runs)
    → loudnorm → 16 kHz mono WAV  (the single discussion stream)
    → optional MP3 variant for metered mobile connections
```

- **`scheduledStartMs`** for turn *n* = end of turn *n−1* + `pauseBeforeMs` − `overlap.startOffsetMs` (0 when absent). Overlap rules from §16.5 are validated here and the render fails loudly on violation.
- **Room impulse response.** Injected audio is otherwise unrealistically clean and flatters diarization; convolving the mix with a small meeting-room IR makes sim B behave more like sim C. Ship two IRs (small room, medium room), selectable per scenario, defaulting to small-room for `sim_injected` and none for the committed CI fixture (determinism).
- Output is **16 kHz mono** — matching the capture path exactly, so sim B introduces no resampling difference.
- The manifest records `scheduledStartMs`, `durationMs`, `overlapMs`, and the applied IR/noise settings for every turn. This manifest is the evaluation ground truth.

### 17.7 `TtsProvider` interface

```typescript
interface TtsProvider {
  synthesize(input: {
    text: string; voiceId: string; instructions?: string;
    speakingRate?: number; format: "wav" | "mp3";
  }): Promise<{ bytes: Buffer; durationMs: number; contentType: string }>;
  listVoices(): Promise<Array<{ id: string; label: string; timbreClass?: string }>>;
}
```

`TTS_STUB=1` returns ffmpeg-generated tones at correct durations, with a distinct fundamental frequency per `voiceId` so the distinctness preflight and diarization stub remain meaningful offline.

---

## 18. Scenario data model

```typescript
type Scenario = {
  id: string; title: string; description: string;
  topic: string; domain: string;
  workshopType: WorkshopType;
  objective: string; phase: DesignThinkingPhase; criteria: string[];
  language: string;
  durationMinutes: 3 | 5 | 8 | 10 | 12 | 15;
  speakerCount: 3 | 4 | 5 | 6;
  difficulty: ScenarioDifficulty;
  crossTalkLevel: CrossTalkLevel;
  participationProfile: "even" | "uneven";
  budget: { targetTurns: number; targetCharacters: number; calibrationMs: number };
  realizedDurationMs?: number;
  overlapRatioPct?: number;
  speakers: ScenarioSpeaker[];
  turns: ScenarioTurn[];
  expectedWindowOutcome: {
    finalTheme: string;
    finalDiscussionState: WindowAnalysis["discussionState"];
    agreementState: WindowAnalysis["agreementState"];
    minorityPositionPresent: boolean;
    expectedItems: Array<{ category: "evidence" | "question" | "position" | "decision" | "action"; gist: string }>;
    expectedPromptCategories: string[];
  };
  status: "draft" | "generating" | "synthesizing_audio" | "preflight" | "ready" | "failed";
  preflight?: { passed: boolean; labelsDetected: number; mergedSpeakers?: [string, string]; ranAt: Date };
  approvedAt?: Date;
};

type ScenarioSpeaker = {
  id: string; displayName: string;
  role: "facilitator" | "presenter" | "reviewer" | "researcher" | "stakeholder" | "observer";
  discourseStyle: "questioning" | "evidence_oriented" | "directive" | "supportive" | "skeptical" | "synthesizing" | "quiet";
  accentHint: string;
  casting: VoiceCasting;
  targetTalkShare: number;
};

type ScenarioTurn = {
  id: string; order: number; speakerId: string; text: string;
  isCalibration: boolean;
  pauseBeforeMs: number; pauseAfterMs: number;
  overlap?: ScenarioOverlap;
  expected: {
    substantive: boolean;
    feedbackTypes: FeedbackType[];
    evidenceStatus: TurnAnalysis["evidenceStatus"];
    rationaleStatus: TurnAnalysis["rationaleStatus"];
    intentRelationship: TurnAnalysis["intentRelationship"];
    stance: TurnAnalysis["stance"];
    potentialSignal: PotentialSignal;
    themeGist: string;
  };
  audio?: { assetKey: string; durationMs: number; checksum: string; scheduledStartMs: number };
};
```

---

## 19. Simulator route (`/simulator/[runId]`)

A **single-device player of the mixed stream**, expected to run on a phone.

**Controls:** Preload · Start · Pause · Resume · Restart · Stop · playback speed · script visibility. All bottom-anchored, ≥ 44 px, safe-area aware.

**Playback modes:** Normal (1.0×, mixed stream as rendered) · Fast rehearsal (1.15–1.30×, per-turn scheduling with shortened pauses and overlaps disabled) · Stress test (as rendered, with the noise bed enabled).

**Implementation:**

- One `AudioContext`, created/resumed inside the Start tap. Default path decodes the **mixed WAV** and plays it as one buffer — gap-proof and cheapest on a phone. Per-turn scheduling with absolute `AudioBufferSourceNode.start(contextTime + offset)` engages only for speed/overlap-toggle modes. Never chain `<audio>.play()` calls.
- Show the download size and offer the MP3 variant on a metered connection; decode and preload fully before enabling Start.
- Display current turn and speaker from the manifest, remaining time, a large Stop, and a device-volume reminder (browsers cannot read system volume — guidance, not a fake meter).
- **Wake lock** on Start; re-acquire on `visibilitychange`; handle interruption with "playback interrupted — tap to resume from the beginning" and mark the run `incomplete`.
- **Clock sync:** 3 round-trips against `GET /api/time` on load; store the median offset; correct all timestamps; record residual uncertainty.
- **Playback events** to `POST /api/runs/{id}/playback`: `playback_started`, `turn_started {turnId, offsetMs}`, `turn_ended`, `paused`, `resumed`, `playback_stopped`. Heartbeat every 5 s.
- Persistent **SIMULATION** header; never renders the dashboard.

**External-player fallback:** the mixed WAV is downloadable; playing it from any media player still exercises the acoustic path, with evaluation falling back to a facilitator-entered start time (flagged in `deviations`).

**Run coordination:** facilitator starts capture and waits for `Begin` → simulator plays calibration → facilitator maps labels → main discussion continues (countdown, or facilitator release via SSE `go`).

---

## 20. Runs, injection, and the ASR stub

```text
Scenario ↔ Run ↔ Session ↔ TranscriptTurns ↔ EvaluationResult
```

Creating a run copies objective, phase, criteria, participant names, `speakerCount`, and `durationMinutes` into a new session. Expected labels are **never** sent to the HUD or the analysis LLM.

**Sim B:** the browser fetches the mixed WAV, decodes it, and feeds the worklet at **real-time rate** against the real provider (never faster). Alignment uses manifest `scheduledStartMs` directly.

**ASR stub (`ASR_STUB=1`):** in-process WebSocket server speaking the provider protocol on the real transport. It **validates incoming audio** (rate, cadence, energy against the manifest) so a broken worklet fails loudly; emits `Begin`, partials, finals, and `Termination` paced to the received audio clock; supports accelerated pacing (stub only); and supports fault injection:

```typescript
type StubFaultConfig = {
  labelSwapRate: number; unknownRate: number; wordErrorRate: number;
  droppedTurnRate: number; duplicateEventRate: number;
  overlapMisattributionRate: number;   // applied only to turns flagged possibleOverlap
  disconnectAtMs?: number;
  analysisTimeoutRate: number;
  emitSpeakerRevision: boolean;
  seed: number;
};
```

---

## 21. Evaluation

**Alignment.** Each scenario turn is an interval `[scheduledStartMs, +durationMs]` in session time (corrected playback start for sim C; manifest for sim B). Match observed turns by greatest temporal overlap (≥ 40% of the shorter interval); ties by normalized text similarity. Unmatched observed = `spurious`; unmatched expected = `missed`. Calibration excluded from critique metrics.

**Speaker scoring.** Best one-to-one assignment (Hungarian) over the overlap-duration matrix, then: speaker-turn accuracy · **accuracy excluding overlapped turns (the headline figure)** · accuracy on overlapped turns only · `UNKNOWN` rate · over-splits · merges · DER where word timings allow · revision improvement.

```typescript
type EvaluationResult = {
  runId: string; scenarioId: string; mode: RunMode;
  stubbed: boolean; scenarioApproved: boolean;
  scenarioProfile: { durationMinutes: number; speakerCount: number; crossTalkLevel: CrossTalkLevel; overlapRatioPct: number; roomIr?: string };
  transcript: { medianWER: number; missedTurnRate: number; duplicateTurnRate: number; spuriousTurnCount: number; keyTermAccuracy: number; lostFinalTurns: number };
  speakers: { turnAccuracyPct: number; excludingOverlapsPct: number; overlapOnlyAccuracyPct: number; unknownRatePct: number; overSplits: number; merges: number; der?: number; revisionImprovementPct: number; labelsDetected: number; labelsExpected: number };
  classification: {
    perField: Record<"feedbackTypes" | "evidenceStatus" | "rationaleStatus" | "intentRelationship" | "stance" | "potentialSignal",
      { agreementPct: number; confusion: Array<{ expected: string; actual: string; n: number }> }>;
    themeSimilarityMean: number;
  };
  discussionMap: { expectedItemsFoundPct: number; spuriousItems: number; minorityPreserved: boolean };
  prompts: { shown: number; expectedCategoriesHitPct: number; guardRejected: number; maxSimultaneous: number };
  latencyMs: { partialP50: number; partialP95: number; finalP50: number; finalP95: number; analysisP50: number; analysisP95: number; hudP95: number };
  safety: { forbiddenTermOccurrences: number; participantNamedInPrompt: number };
  clockSkewUncertaintyMs?: number;
  deviations: string[];
};
```

`scenarioProfile` exists so results are only compared across matching length, speaker count, and overlap ratio — a 6-speaker `frequent` run and a 3-speaker `none` run are not comparable numbers.

The LLM judge sees only expected/actual string pairs, batched into ≤ 3 calls. The results page shows per-turn expected vs actual with mismatches highlighted and the matched clip playable; exports JSON and CSV.

---

## 22. Headless testing

All headless simulation is **sim B**: real audio decoded through the real worklet into the (stub or real) ASR socket.

### 22.1 Dependencies

| Dependency | Version | Used for |
|---|---|---|
| **Node.js** | ≥ 20 LTS | server, scripts, tests |
| **npm** / pnpm | current | packages, scripts |
| **TypeScript + tsx** | current | typed scripts |
| **Vitest** | current | unit + integration (guard, ingest, budgeting, overlap validation, alignment, metrics) |
| **Playwright** | current, `chromium firefox webkit --with-deps` | three-engine E2E plus mobile device emulation |
| **Prisma CLI** | matching app | ephemeral SQLite per run |
| **ffmpeg** | ≥ 6 | clip measurement, loudness normalization, **mixing and overlap scheduling**, IR convolution, fixture WAVs |
| **mkcert** *(local only)* | current | trusted HTTPS for real devices; not needed headlessly |
| **No OS audio stack** | — | audio enters via `decodeAudioData` or Chromium fake-capture flags |

```bash
LLM_STUB=1   # deterministic topics, scenarios, analyses, judge
TTS_STUB=1   # ffmpeg tones, distinct fundamental per voiceId, correct durations
ASR_STUB=1   # in-process WebSocket server speaking the provider protocol
```

### 22.2 Tiers

```bash
npm run test:unit       # pure functions: substantive-turn rule, prompt guard, idempotent
                        # ingest, segment splitting, LENGTH/SPEAKER BUDGETING, OVERLAP RULE
                        # VALIDATION (no 3-way overlap, no calibration overlap, caps),
                        # alignment, Hungarian matching, WER, metrics, SSE reducers. <30 s.

npm run test:e2e        # Playwright × {chromium, firefox, webkit} × {desktop, iPhone,
                        # Android phone, iPad} — full stubbed sim-B run: fixture scenario,
                        # WAV injected through decodeAudioData → worklet → stub socket,
                        # asserts transcript, map, metrics, guard, SIMULATION badge,
                        # termination, evaluation, exports. Mobile profiles additionally
                        # assert no horizontal overflow, ≥44px targets, safe-area insets,
                        # bottom-anchored primary actions. Fault-injection variants
                        # parameterize the same suite.

npm run test:e2e:mic    # Chromium only (fake-capture flags): --use-fake-ui-for-media-stream
                        # --use-fake-device-for-media-capture
                        # --use-file-for-fake-audio-capture=./fixtures/mixed_fixture.wav
                        # verifies the getUserMedia branch: permissions, settings readback,
                        # level meter, arbitrary-context-rate resampling.

npm run eval            # full library as sim B against the stub at accelerated pacing;
                        # EvaluationResults to ./eval-runs/{timestamp}/; pass/fail against
                        # eval.config.json (thresholds keyed by scenarioProfile); non-zero
                        # exit on failure. Required before merging analyzer-prompt changes.

npm run test:smoke      # real keys only: one short real sim-B session, one real turn
                        # analysis, one real TTS clip + distinctness preflight, one topic
                        # suggestion call. Verifies provider names and parameters.
```

### 22.3 Rules

The stub validates incoming audio, so a broken pipeline fails loudly. All randomness is seeded. Accelerated pacing exists only against the stub. The simulator detects a no-output environment and still fires scheduled playback events. CI = `test:unit` + `test:e2e` + `test:e2e:mic` + `eval` on a plain Linux runner with Node, Playwright browsers, and ffmpeg.

---

## 23. Data entities

`Session · IntentRevision · Participant · SpeakerMapping · TranscriptTurn · Correction · Scenario · ScenarioSpeaker · ScenarioTurn · TopicSuggestionCache · Run · DiscussionItem · PromptRecord · EvaluationResult`

```typescript
type RunMode = "live" | "sim_acoustic" | "sim_injected";

type TranscriptTurn = {
  id: string; sessionId: string;
  providerSessionId: string;
  providerTurnOrder: number; segmentIndex: number;
  providerSpeakerLabel: string; originalProviderSpeakerLabel: string;
  participantId?: string;
  startMs: number; endMs: number; receivedAtMs: number;
  originalText: string; currentText: string;
  wordsJson: unknown;
  isCalibration: boolean; isFinal: boolean; isSubstantive: boolean;
  isUnknownSpeaker: boolean; possibleOverlap: boolean;
  wasSpeakerRevised: boolean; isManuallyCorrected: boolean;
  analysis?: TurnAnalysis; analysisReceivedAtMs?: number;
};
```

Unique index on `(providerSessionId, providerTurnOrder, segmentIndex)`.

---

## 24. API surface

```http
# Sessions
POST   /api/sessions            GET /api/sessions/{id}        PATCH /api/sessions/{id}
POST   /api/sessions/{id}/start POST /api/sessions/{id}/terminate
GET    /api/sessions/{id}/events                      # SSE, heartbeat + Last-Event-ID
POST   /api/sessions/{id}/speaker-mappings
PATCH  /api/sessions/{id}/speaker-mappings/{label}
PATCH  /api/turns/{id}
POST   /api/items   PATCH /api/items/{id}   DELETE /api/items/{id}
PATCH  /api/prompts/{id}
DELETE /api/sessions/{id}
GET    /api/sessions/{id}/export.json | export.txt

# Providers / utilities
GET    /api/providers/assemblyai/token
GET    /api/time

# Scenarios
GET    /api/scenarios
POST   /api/scenarios
GET    /api/scenarios/topic-suggestions        # ?seed=&exclude=&count=
POST   /api/scenarios/estimate                 # {durationMinutes, speakerCount, crossTalkLevel} → budget + cost
POST   /api/scenarios/generate
GET    /api/scenarios/{id}   PATCH /api/scenarios/{id}
GET    /api/scenarios/{id}/voices              # casting + per-speaker preview clips
POST   /api/scenarios/{id}/recast              # change casting, re-render affected turns
POST   /api/scenarios/{id}/synthesize          # per-turn TTS → mix → manifest → mixed WAV
POST   /api/scenarios/{id}/preflight           # blocking voice-distinctness check
POST   /api/scenarios/{id}/approve
GET    /api/scenarios/{id}/mixed.wav | mixed.mp3
DELETE /api/scenarios/{id}

# Runs
POST   /api/runs        GET /api/runs/{id}
POST   /api/runs/{id}/playback
POST   /api/runs/{id}/evaluate
GET    /api/runs/{id}/results
GET    /api/runs/{id}/export.json | export.csv

# Assets
GET    /api/assets/{...key}                    # Range-capable
```

---

## 25. Failure handling

| Condition | Behaviour |
|---|---|
| Mic permission denied | Browser-appropriate, OS-agnostic guidance; block start. |
| Unsupported browser/API | Name the missing capability; suggest a current browser; never fail silently. |
| Silence or clipping | Warn; block or pause a simulated run; facilitator-only banner in live sessions. |
| Socket disconnect (incl. mobile network switch) | Stop sending audio; retain finalized turns; **new** token; explicit Reconnect; never silently merge provider sessions. |
| Speaker labels unstable | "Speaker labels are still stabilizing. The facilitator can correct assignments at any time." |
| `UNKNOWN` speaker | "Unassigned speaker." Never guess. |
| LLM timeout/5xx | Transcript continues unannotated; one retry; facilitator-only "analysis degraded" chip. |
| Topic-suggestion failure | Free-text topic still works; retry; cached batch if available. |
| Prompt guard rejection | Log with reason; display nothing. |
| TTS render failure | Scenario incomplete; failed turns listed; selective regeneration; playback blocked. |
| **Preflight failure (voices merged)** | Scenario stays out of `ready`; report the merged pair; offer one-click recast. |
| **Overlap rule violation at mix time** | Render fails with the offending turn ids; never silently "fix" the schedule. |
| Simulator interruption (call, lock, backgrounding) | Wake lock mitigates; otherwise heartbeat warning, run `incomplete`, restart from beginning. |
| Clock sync failure | Approximate alignment warning; allow the run; record in `deviations`. |
| Duplicate provider events | Dropped by the idempotency index. |
| Page unload while streaming | `sendBeacon` terminate; billing stops. |

---

## 26. Configuration

```bash
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_SPEECH_MODEL=universal-3-5-pro
ASR_WS_BASE=wss://streaming.assemblyai.com     # stub URL when ASR_STUB=1
OPENAI_API_KEY=
ANALYSIS_MODEL=gpt-5-mini-2025-08-07
TTS_MODEL=gpt-4o-mini-tts
TTS_FORMAT=wav
DATABASE_URL=file:./data/app.db
ASSET_DIR=./data/audio
ROOM_IR_DIR=./data/ir                          # small_room.wav, medium_room.wav
NEXT_PUBLIC_BASE_URL=https://192.168.x.x:3000
SIMULATION_ENABLED=true
IDLE_TERMINATE_SECONDS=120
TOPIC_SUGGESTION_TTL_SECONDS=3600
LLM_STUB=0
TTS_STUB=0
ASR_STUB=0
```

Two API keys total. Verify the ASR model identifier, token endpoint, query-parameter names, and the TTS model and voice list against the providers' live documentation once at build start; all names live in config.

---

## 27. Build order

**Stage 1 — Speech proof.** Mic capture + settings readback + meter · worklet resample→PCM16 from arbitrary context rates · token route · WebSocket · live transcript · wake lock · clean termination + `sendBeacon`.
**Stage 2 — Diarization.** Labels · calibration · mapping · `UNKNOWN` · word-level splitting · `SpeakerRevision` · idempotent ingest.
**Stage 3 — Scenario + stubs + injection.** Schema · topic suggestions · **length/speaker budgeting + estimate endpoint** · generator (with chunking) · editor + approve · stubs · ASR stub with audio validation, fault injection, accelerated pacing · sim B source · fixture scenario + WAV.
**Stage 4 — HUD.** Facilitator and display routes, **mobile-first** · SSE snapshot+patch with heartbeat · transcript · talk share · header · SIMULATION badge · reconnect UX · fullscreen-free layout.
**Stage 5 — TTS + mixing + simulator.** **OpenAI per-turn synthesis, casting, accent instructions, hash caching, loudness normalization · overlap scheduling and ffmpeg mixing · IR convolution · manifest + mixed WAV (+ MP3) · blocking distinctness preflight** · `/simulator/[runId]` with wake lock, clock sync, heartbeat, playback modes · `test:e2e:mic`.
**Stage 6 — Critique intelligence.** Batched turn analysis · evidence/rationale · intent · stance · theme · discussion map · decisions/actions.
**Stage 7 — Facilitation + guard.** Window analysis with idle skip · agreement + minority · single prompt · prompt guard · correction/dismissal + audit.
**Stage 8 — Evaluation.** Alignment · Hungarian matching · overlap-segmented accuracy · per-field agreement · LLM judge · latency percentiles · results page · exports · `npm run eval` with profile-keyed thresholds · three-engine + mobile-emulation CI · real-device smoke.

---

## 28. Acceptance criteria

**Live path**
1. Runs over HTTPS in Chrome/Edge (desktop + Android), Firefox (desktop), Safari/WebKit (iOS 16.4+, iPadOS, macOS); unsupported browsers get a clear notice.
2. Capture works from a phone's built-in microphone; UI reflects `getSettings()`; picker hidden when only one device; wake lock holds the session; interruption is recoverable.
3. PCM16 mono 16 kHz at real-time pace, correctly resampled from any hardware context rate.
4. Partial ≤ ~1 s behind speech; finals appear within a few seconds.
5. Three alternating voices get distinct labels; labels map and re-map to names.
6. `UNKNOWN` stays unassigned; multi-speaker turns split into segments.
7. `SpeakerRevision` updates the final transcript while preserving original labels.
8. `/display` works on any networked device, including an iPad without the Fullscreen API and a phone in portrait.
9. ≤ 1 prompt at a time; the guard blocks any prompt naming a participant or using a blocklisted trait.
10. Every AI output correctable or dismissible by touch; corrections audited.
11. Analysis failure never stops transcription; clean termination on stop and unload; streaming minutes visible.
12. Objective/phase/criteria editable live and driving intent alignment.
13. JSON and text export; `DELETE` removes all session data.
14. The HUD never displays personality, emotion, sentiment, competence, deception, or definitive-bias content.

**Simulation path**
15. `/scenarios/new` offers LLM-generated topic chips with non-repeating "More topics" and an optional seed; selecting one drafts objective, criteria, title.
16. **Length (3–15 min) and speaker count (3–6) are selectable**, produce a live turn/character/cost estimate, drive the generator's targets, and yield a realized duration within 20% of the request — with 12- and 15-minute scenarios generated in chunks.
17. **Each speaker is cast to a different OpenAI voice with a distinct timbre class and accent instruction; per-speaker previews are available; recasting re-renders only affected turns.**
18. Per-turn WAV rendering is hash-cached, silence-trimmed, and loudness-normalized; the manifest carries measured durations.
19. **The blocking distinctness preflight detects merged voices before a scenario reaches `ready` and offers a recast.**
20. **Cross-talk level (none/occasional/frequent) produces the specified overlap counts and durations; overlap rules are enforced at mix time (no calibration overlap, never three concurrent speakers, ≤ 1500 ms, boundary-only) and violations fail the render.**
21. Mixing produces one 16 kHz mono WAV with correct scheduling, optional room-IR convolution and noise bed, and an optional MP3 for metered connections.
22. Sim B feeds the mixed WAV through decode → worklet → ASR socket at real-time pace against the real provider; the stub validates incoming audio.
23. Fault injection exercises label swaps, `UNKNOWN`, word errors, dropped and duplicate finals, mid-session disconnect, late revision, and analysis timeouts without crashes or lost turns.
24. Sim C runs from one device — including a phone — with wake lock, clock sync, heartbeat, and an external-player fallback.
25. Every simulated run shows the SIMULATION badge, satisfying AI-voice disclosure.
26. Evaluation excludes calibration, reports **speaker accuracy excluding overlaps as the headline and overlap-only accuracy separately**, records `scenarioProfile`, and gates thresholds per profile.

**Mobile + headless**
27. `test:e2e` passes on Chromium, Firefox, and WebKit **and** on iPhone, Android-phone, and iPad emulation profiles, asserting no horizontal overflow, ≥ 44 px targets, safe-area compliance, and bottom-anchored primary actions.
28. No route depends on hover, drag-only interaction, `100vh`, or the Fullscreen API.
29. `test:unit`, `test:e2e`, `test:e2e:mic`, and `eval` pass on a plain Linux runner with Node ≥ 20, Playwright browsers, and ffmpeg — no audio hardware, no display, no live keys.
30. Manual smoke completed on one real iPhone and one real Android device before any demo.

**Targets** (real-ASR runs only; compare only within a matching `scenarioProfile`)

```text
Partial transcript latency                 ~1 s
Turn analysis after finalization           ≤ 3 s (P95)
Speaker accuracy excluding overlaps, sim C ≥ 85%
Speaker accuracy excluding overlaps, sim B ≥ 90%
Overlap-only speaker accuracy              reported, not gated
Unknown substantive turns post-calibration < 10%
Lost finalized turns                       0
Guard violations displayed                 0
Realized vs requested duration             within 20%
Distinctness preflight                     must pass before `ready`
```

---

## 29. Runbooks

### 29.1 Create and run a simulated discussion (sim C — headline test)

1. `/scenarios/new`: pick a suggested topic; **set length and speaker count**; choose difficulty and cross-talk; adjust drafted objective/criteria; review the estimate; generate.
2. Review the script; **preview each speaker's voice**; recast if two sound alike; synthesize.
3. Wait for the distinctness preflight to pass, then approve.
4. Create a `sim_acoustic` run.
5. Facilitator device (laptop or phone): `/facilitator/[sessionId]`. Any screen: `/display/[sessionId]`.
6. Playback phone: `/simulator/[runId]`; Preload; 70–85% volume; 1–3 m from the mic; screen awake.
7. Start capture; wait for `Begin`; Start on the simulator.
8. Calibration plays → map labels → discussion continues.
9. Finish; wait ~3 s; Terminate; revisions apply.
10. Evaluate; open `/runs/[runId]/results`; export.

### 29.2 Deterministic regression (sim B)

Pick a `ready` scenario → create a `sim_injected` run → in `/facilitator` choose audio source "scenario file" → Start → the mixed WAV streams through the pipeline → Terminate → Evaluate → compare against the previous run of the same scenario.

### 29.3 Live demo

Display on `/display` · capture device placed centrally · facilitator route open · levels tested · screens awake → explain the system and its limits, record consent → each participant speaks alone 8–12 s → map labels → clear transcript → run the critique, demonstrating labels, evidence detection, theme, talk share, one preserved disagreement, one prompt, one speaker correction, one confirmed decision → End session → revisions → summary → export.

### 29.4 Daily development

`npm run dev` (stubs on) → create a `sim_injected` run → iterate at accelerated pacing. Before merging analyzer-prompt changes: `npm run eval`. Before releases: three-engine + mobile-emulation `test:e2e`, `test:e2e:mic`, `test:smoke`, and a real-device pass.

---

## 30. Pre-demo checklist

- [ ] Consent recorded (live) / SIMULATION badge showing (simulated).
- [ ] Prompt guard active; zero guard violations in the last eval run.
- [ ] Distinctness preflight passed for every scenario in the demo.
- [ ] Overlap ratio recorded; results quoted only against matching profiles.
- [ ] Talk share neutral and hideable; calibration excluded.
- [ ] Every annotation and prompt dismissible by touch.
- [ ] No distortion signal without a verbatim source phrase and confidence ≥ 0.70.
- [ ] Idle auto-terminate configured; terminate-on-unload verified.
- [ ] Wake locks verified on capture and simulator devices.
- [ ] `npm run eval` green; three-engine and mobile-emulation `test:e2e` green.
- [ ] Manual smoke done on one iPhone and one Android device.
- [ ] Session deletion verified to remove transcript, analysis, and audio.

---

## 31. Product statement

> The Critique HUD is a shared live dashboard that turns room discussion into a speaker-attributed transcript organized by evidence, questions, positions, decisions, actions, participation, and intent-aware facilitation prompts — with every AI interpretation correctable and nothing that profiles a person. It runs in the browser on any laptop, phone, or tablet, capturing through whatever microphone the device has. Its simulator generates complete Design Thinking critiques on freshly suggested topics, at a chosen length of 3 to 15 minutes with 3 to 6 speakers, casts each participant to a distinct AI voice and accent, mixes them into one continuous stream with realistic pauses and occasional cross-talk, and tests the system either played aloud into the room microphone or injected through the same browser audio pipeline — so every test, headless or acoustic, exercises the real path from audio to insight.
