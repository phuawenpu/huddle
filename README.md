# Critique HUD

A shared cognitive mirror for Design Thinking critiques — a Next.js web application that provides real-time speaker-attributed transcription, discussion mapping, and AI-powered facilitation prompts.

**Deployed:** [huddle-ti5ikw.fly.dev](https://huddle-ti5ikw.fly.dev)

## Overview

The Critique HUD supports two modes:

- **Live Mode** — Room microphone → AssemblyAI streaming ASR → live diarized transcript → SSE-driven HUD display + private facilitator controls
- **Simulated Mode** — LLM-generated multi-speaker critique scripts → per-turn TTS → mixed audio stream → tested acoustically (sim C) or via audio injection (sim B)

Both modes drive the same pipeline: audio → worklet → PCM16 → ASR → transcript → analysis → SSE → display.

## Current Status

**Active development — core live capture and natural-audio simulation are implemented; research-facing correction, provenance, injected simulation, and evaluation workflows remain partial.**

| Metric            | Value                                            |
| ----------------- | ------------------------------------------------ |
| TypeScript        | 0 errors                                         |
| Unit tests        | 91/91 passing                                    |
| Browser tests     | 54/54 passing across 6 desktop/mobile profiles   |
| API routes        | 39 endpoints operational                         |
| Frontend pages    | 9 routes functional                              |
| DB schema         | 11 models, SQLite via Prisma                     |
| Test scenarios    | 11 generated and synthesized                     |
| Fly.io deployment | v22, health passing                              |
| API secrets       | `ASSEMBLYAI_API_KEY` + `OPENAI_API_KEY` deployed |

### Build Stage Progress

| Stage                         | Status         | Summary                                                                                                                                                                                                                                   |
| ----------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Speech proof**          | ✅ Implemented | AudioWorklet PCM16 resampler, `useAudioCapture` hook (getUserMedia + analyser meter + settings readback), ASR WebSocket client (AssemblyAI v3 protocol), wake lock, sendBeacon termination                                                |
| **2 — Diarization**           | 🟡 Partial     | Idempotent turn ingest, provider speaker labels, mappings, and UNKNOWN display work; late SpeakerRevision persistence/correction is incomplete.                                                                                           |
| **3 — Scenarios + stubs**     | 🟡 Partial     | ASR/LLM/TTS stubs, generated scenarios, and overlap fixtures work; sim B does not yet feed decoded audio through the worklet/ASR path.                                                                                                    |
| **4 — HUD**                   | 🟡 Partial     | In-memory SSE, talk share, flat discussion items, simulation badge, and reconnect work; event replay/`Last-Event-ID` resume is not implemented.                                                                                           |
| **5 — TTS + mixing**          | ✅ Implemented | Cached per-turn OpenAI TTS, explicit tone fixtures in stub mode, ffmpeg overlap scheduling/mixing, WAV + MP3 output, manifests, and independent ASR validation.                                                                           |
| **6 — Critique intelligence** | 🟡 Partial     | Batched turn/window analysis, bounded source-quote validation, Critique Radar, criterion coverage, open loops, commitments, and deduplicated source-linked items work; cross-turn relation persistence and human disposition remain next. |
| **7 — Facilitation**          | 🟡 Partial     | Single-prompt restraint and a lexical guard exist; correction audit, intent revision history, participant-aware guards, and SSE propagation are incomplete.                                                                               |
| **8 — Evaluation**            | 🟡 Scaffolded  | Playwright E2E config (6 device profiles) and alignment utilities exist, but several reported metrics remain placeholders and real-device smoke is pending.                                                                               |

## Research and system-design study

The research papers in `workspace/`, the current implementation, and adjacent 2023–2026 systems have been analyzed as a single design-research program. The study distinguishes empirical findings, implemented behavior, scaffolding, and future novelty claims.

- [Research artifact index](docs/research/README.md)
- [Research synthesis](docs/research/01-research-synthesis.md)
- [Detailed codebase audit](docs/research/02-codebase-audit.md)
- [Online novelty landscape](docs/research/03-novelty-landscape.md)
- [Seven system versions](docs/research/04-system-versions.md)
- [Evaluation roadmap](docs/research/05-evaluation-roadmap.md)
- [Archived conceptual diagram set](docs/research/archive/diagrams-2026-08-07/)

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

| Page                       | Features                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sessions/new`            | Three audio source modes: Live Mic, Upload File, Past Recording. Browse and select from synthesized scenarios.                                                                                                  |
| `/facilitator/[sessionId]` | Full capture pipeline: mic → AudioWorklet → ASR WebSocket. Live partial transcripts, speaker mapping (A-F labels), intent editor, corrections.                                                                  |
| `/display/[sessionId]`     | Live SSE-driven HUD: last 5 turns, Critique Radar (criterion coverage, open loops, options, decisions, actions, evidence gaps), talk-share bars, source-linked discussion map, prompt banner, SIMULATION badge. |
| `/simulator/[runId]`       | Playback controller with speed control (0.5×–2.0×), progress bar, current speaker/turn display, WAV download.                                                                                                   |
| `/scenarios`               | Library with duplicate, delete, launch-to-simulator actions.                                                                                                                                                    |

## Known Issues

### ⚠ Simulation Path

**Status: acoustic playback is implemented; injected end-to-end simulation is not.**

✅ **What works:**

- Real OpenAI TTS when configured; deterministic tones only in explicit stub mode
- Cached per-turn WAV rendering and distinct voice casting
- `ffmpeg` overlap scheduling, mixing, limiting, and WAV/MP3 output
- Independent ASR validation of sampled real-speech clips
- HTML5 audio playback and visual turn tracking for manual sim C tests

❌ **What needs fixing:**

- Sim B must decode the mixed file into the AudioWorklet and ASR WebSocket path
- Simulator actions must persist run/playback lifecycle events
- Browser/device playback needs a documented real-device test matrix
- Evaluation fields currently hardcoded or derived from proxy metrics must be replaced

### ⚠ Overlap Naturalness

**Status: deterministic stub dialogue remains mechanical.** The real scenario-generation path now prompts for conversational causality, repair, disagreement, and context-sensitive overlaps; stub mode remains a protocol fixture rather than a naturalness benchmark.

✅ **What works:**

- Overlap rules enforced at generation time
- `possibleOverlap` flag on turns
- A basic overlap-restricted transcript proxy in evaluation

❌ **What needs fixing:**

- Human evaluation of real generated conversations and overlap naturalness
- Acoustic validation across rooms, devices, distances, and background conditions
- Separate overlap WER and diarization-error measurements

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

| Variable                    | Purpose                                  | Default                  |
| --------------------------- | ---------------------------------------- | ------------------------ |
| `ASSEMBLYAI_API_KEY`        | AssemblyAI streaming ASR                 | (required for live mode) |
| `OPENAI_API_KEY`            | OpenAI for analysis, generation, TTS     | (required for non-stub)  |
| `DATABASE_URL`              | SQLite database path                     | `file:./data/app.db`     |
| `LLM_STUB`                  | Use deterministic stubs                  | `1`                      |
| `ANALYSIS_TIMEOUT_MS`       | Provider deadline before safe fallback   | `12000`                  |
| `ANALYSIS_REASONING_EFFORT` | GPT reasoning effort for live extraction | `low`                    |
| `TTS_STUB`                  | Use tone-based TTS stubs                 | `1`                      |
| `ASR_STUB`                  | Use in-process ASR stub                  | `1`                      |

## Routes

| Route                      | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `/`                        | Home — start live critique, browse scenarios                              |
| `/sessions/new`            | Session setup with audio source selection (mic / upload / past recording) |
| `/facilitator/[sessionId]` | Facilitator controls, live transcript, mic capture, speaker mapping       |
| `/display/[sessionId]`     | Read-only HUD with talk-share, discussion map, prompt banner              |
| `/scenarios`               | Scenario library                                                          |
| `/scenarios/new`           | Generate scenario with topic suggestions                                  |
| `/scenarios/[scenarioId]`  | Review script, synthesize audio, launch simulator                         |
| `/simulator/[runId]`       | Playback controller with SIMULATION badge                                 |
| `/runs/[runId]/results`    | Evaluation results, export                                                |

## Testing

```bash
npm test                    # 91 unit tests (including OpenAI deadline fallback)
npx tsc --noEmit           # TypeScript check
npm run build              # production Next.js build
npm run test:e2e           # 54 cases across Chromium, Firefox, WebKit, iPhone, Android, iPad
```

## Architecture

- **One process:** Next.js 15.5 serves UI, API routes, SSE, and background work
- **SQLite via Prisma** (11 models, WAL mode)
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
