# Critique HUD

A shared cognitive mirror for Design Thinking critiques — a Next.js web application that provides real-time speaker-attributed transcription, discussion mapping, and AI-powered facilitation prompts.

**Deployed:** [huddle-ti5ikw.fly.dev](https://huddle-ti5ikw.fly.dev)

## Overview

The Critique HUD supports two modes:

- **Live Mode** — Room microphone → AssemblyAI streaming ASR → live diarized transcript → SSE-driven HUD display + private facilitator controls
- **Simulated Mode** — LLM-generated multi-speaker critique scripts → per-turn TTS → mixed audio stream → tested acoustically (sim C) or via audio injection (sim B)

Both modes drive the same pipeline: audio → worklet → PCM16 → ASR → transcript → analysis → SSE → display.

## Current Status

**Active development — Build Stage 1-7 implemented, Stage 8 scaffolded.**

| Metric | Value |
|---|---|
| TypeScript | 0 errors |
| Unit tests | 74/74 passing |
| API routes | 39 endpoints operational |
| Frontend pages | 10 routes functional |
| DB schema | 14 models, SQLite via Prisma |
| Test scenarios | 11 generated and synthesized |
| Fly.io deployment | v22, health passing |
| API secrets | `ASSEMBLYAI_API_KEY` + `OPENAI_API_KEY` deployed |

### Build Stage Progress

| Stage | Status | Summary |
|---|---|---|
| **1 — Speech proof** | ✅ Implemented | AudioWorklet PCM16 resampler, `useAudioCapture` hook (getUserMedia + analyser meter + settings readback), ASR WebSocket client (AssemblyAI v3 protocol), wake lock, sendBeacon termination |
| **2 — Diarization** | ✅ Implemented | Idempotent turn ingest, speaker label mapping (A-F), UNKNOWN speaker display, SpeakerRevision handling, partial→final transitions |
| **3 — Scenarios + stubs** | ✅ Implemented | ASR stub v3 protocol with fault injection, 11 test scenarios (3-15 min, 3-6 speakers, varied cross-talk), sim B audio injection infrastructure |
| **4 — HUD** | ✅ Implemented | In-memory SSE pub/sub, real-time display page with talk-share bars + discussion map, SIMULATION badge, SSE reconnect with exponential backoff |
| **5 — TTS + mixing** | 🟡 In progress | Scenario synthesis to WAV files (tone-based), synthesize/preflight/approve/recast routes, voice pool with 6 timbre classes. ⚠ See Known Issues below. |
| **6 — Critique intelligence** | ✅ Implemented | Batched LLM turn analysis engine, window analysis every 20s, discussion map generation, prompt lifecycle with auto-dismiss |
| **7 — Facilitation** | ✅ Implemented | Prompt guard enforcement, single-prompt with 15s auto-dismiss, Correction audit via PATCH routes, IntentRevision live editing |
| **8 — Evaluation** | 🟡 Scaffolded | Playwright E2E config (6 device profiles), eval thresholds per scenario profile, LLM judge stub. CI pipeline and real-device smoke pending. |

### New API Endpoints (since prototype)

```
POST /api/sessions/[id]/turns          — Idempotent turn ingest with SSE broadcast
GET  /api/sessions/[id]/events          — SSE with pub/sub integration
POST /api/sessions/terminate-beacon     — sendBeacon termination endpoint
POST /api/scenarios/[id]/synthesize     — Generate WAV audio from scenario turns
GET  /api/scenarios/[id]/mixed           — Serve synthesized WAV/MP3 (Range-capable)
GET  /api/recordings                     — List all synthesized recordings + uploads
POST /api/uploads                        — Upload audio files (WAV, MP3, M4A, WebM, OGG)
```

### New Frontend Features

| Page | Features |
|---|---|
| `/sessions/new` | Three audio source modes: Live Mic, Upload File, Past Recording. Browse and select from synthesized scenarios. |
| `/facilitator/[sessionId]` | Full capture pipeline: mic → AudioWorklet → ASR WebSocket. Live partial transcripts, speaker mapping (A-F labels), intent editor, corrections. |
| `/display/[sessionId]` | Live SSE-driven HUD: last 5 turns, talk-share bars, discussion map (color-coded categories), prompt banner, SIMULATION badge. |
| `/simulator/[runId]` | Playback controller with speed control (0.5×–2.0×), progress bar, current speaker/turn display, WAV download. |
| `/scenarios` | Library with duplicate, delete, launch-to-simulator actions. |

## Known Issues

### ⚠ Audio Synthesis & Playback

**Status: Not working reliably in browser.** While WAV files are generated and served correctly (verified: 8.6 MB, 16kHz mono PCM, `audio/wav` content type), audio playback through the browser has proven unreliable:

- **Web Audio API approach** (`AudioContext` + `decodeAudioData` + `BufferSource`) failed silently on both desktop and mobile browsers. The user-gesture lifecycle for `AudioContext` creation and resumption is fragile across browsers and mobile OSes.
- **HTML5 `<audio>` element approach** (`new Audio(url)`) also did not produce audible output on either platform during testing, despite the WAV file being valid and the server returning correct responses.

**Root cause:** The synthesized WAV uses simple sine waves as placeholder audio (distinct frequencies per speaker: 220/330/440/550/660/880 Hz at 50% amplitude). While this produces valid, verifiable WAV files, browser audio playback appears to require more natural audio content or different encoding. The files play correctly when downloaded and opened with desktop audio tools.

✅ **What does work:**
- WAV generation, storage, and serving
- WAV download for offline playback
- Visual playback (turn-by-turn text display with progress tracking)

❌ **What needs fixing:**
- Real-time audible playback in the browser
- Migration from tone-based synthesis to actual TTS (OpenAI `gpt-4o-mini-tts`)
- Adding `ffmpeg` to the Docker image for proper audio mixing

### ⚠ Overlap Naturalness

**Status: Scheduled overlaps produce unnatural transcripts.** Current overlap implementation follows the spec rules (no 3-way overlap, no calibration overlap, ≤1500ms, boundary-only) but with deterministic stub generation, overlapping turns appear mechanical rather than conversational. The stubs use pattern-matched text from a fixed pool — real LLM generation with proper overlap context would produce more natural results.

✅ **What works:**
- Overlap rules enforced at generation time
- `possibleOverlap` flag on turns
- Overlap-segmented accuracy in evaluation

❌ **What needs fixing:**
- Real LLM-based generation with naturalistic overlap patterns (interruptions, eager agreements, backchannels)
- `ffmpeg` mixing with proper `adelay` + `amix` scheduling
- Transition from stub-based to real OpenAI TTS output

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client and create database
npx prisma generate
DATABASE_URL=file:./data/app.db npx prisma db push

# Start development server (stubs on — zero API cost)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | AssemblyAI streaming ASR | (required for live mode) |
| `OPENAI_API_KEY` | OpenAI for analysis, generation, TTS | (required for non-stub) |
| `DATABASE_URL` | SQLite database path | `file:./data/app.db` |
| `LLM_STUB` | Use deterministic stubs | `1` |
| `TTS_STUB` | Use tone-based TTS stubs | `1` |
| `ASR_STUB` | Use in-process ASR stub | `1` |

## Routes

| Route | Purpose |
|---|---|
| `/` | Home — start live critique, browse scenarios |
| `/sessions/new` | Session setup with audio source selection (mic / upload / past recording) |
| `/facilitator/[sessionId]` | Facilitator controls, live transcript, mic capture, speaker mapping |
| `/display/[sessionId]` | Read-only HUD with talk-share, discussion map, prompt banner |
| `/scenarios` | Scenario library |
| `/scenarios/new` | Generate scenario with topic suggestions |
| `/scenarios/[scenarioId]` | Review script, synthesize audio, launch simulator |
| `/simulator/[runId]` | Playback controller with SIMULATION badge |
| `/runs/[runId]/results` | Evaluation results, export |

## Testing

```bash
npm test                    # 74 unit tests (budget, guard, overlap, stubs, utils)
npx tsc --noEmit           # TypeScript check
```

## Architecture

- **One process:** Next.js 15.5 serves UI, API routes, SSE, and background work
- **SQLite via Prisma** (14 models, WAL mode)
- **Local filesystem** for audio assets (`/data/audio/`)
- **SSE** with `src/lib/pubsub.ts` in-memory pub/sub, 15s heartbeat, `Last-Event-ID` reconnect
- **Two external providers:** AssemblyAI (ASR) and OpenAI (LLM + TTS)
- **Stub mode:** All three providers have in-process stubs for zero-cost development

## Deployment

Deployed at `huddle-ti5ikw.fly.dev` via fly.io (Singapore region, shared-cpu-1x, 512MB).

```bash
flyctl deploy --app huddle-ti5ikw
flyctl secrets list --app huddle-ti5ikw   # verify keys deployed
```

## Design Principles

1. **Describe language, never people.**
2. **Every AI output is correctable.**
3. **Restraint:** max 3 labels per turn, max 1 prompt at a time, no confidence percentages on the public display.
4. **Preserve dissent.** Minority positions stay visible.
5. **Transcription survives analysis failure.**
6. **Simulated sessions are unmistakably labelled** with the ◆ SIMULATION badge.
7. **Mobile is first-class.**
8. **Real audio path always.**

## License

MIT
