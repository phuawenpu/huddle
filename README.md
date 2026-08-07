# Critique HUD

A shared cognitive mirror for Design Thinking critiques — a Next.js web application that provides real-time speaker-attributed transcription, discussion mapping, and AI-powered facilitation prompts.

## Overview

The Critique HUD supports two modes:

- **Live Mode** — Room microphone → AssemblyAI streaming ASR → live diarized transcript → SSE-driven HUD display + private facilitator controls
- **Simulated Mode** — LLM-generated multi-speaker critique scripts → per-turn TTS → mixed audio stream → tested acoustically (sim C) or via audio injection (sim B)

Both modes drive the same pipeline: audio → worklet → PCM16 → ASR → transcript → analysis → SSE → display.

## Current Status

**Prototype stage.** All API routes, frontend pages, database schema, core libraries, and stubs are scaffolded and functional in stub mode. 74 unit tests passing. The app runs fully offline with stubs enabled — no API keys needed for development.

### Stub Mode (current)

With `LLM_STUB=1 TTS_STUB=1 ASR_STUB=1`, the entire pipeline works end-to-end:
- Topic suggestions, scenario generation, turn analysis, and budget estimation use deterministic stubs
- TTS produces placeholder WAV files
- The ASR stub speaks the AssemblyAI protocol in-process
- All 10 frontend routes render and connect to the API

### What's Implemented

| Layer | Status | Details |
|---|---|---|
| **Database schema** | ✅ Complete | SQLite via Prisma, 14 models, all indexes including idempotency constraint |
| **Type system** | ✅ Complete | Full TypeScript types matching spec v5 |
| **Core libraries** | ✅ Complete | Prompt guard, budget validation, overlap rules, metrics, alignment/evaluation, SSE, utilities |
| **Stubs** | ✅ Complete | Deterministic OpenAI stub (topics, generation, analysis, budget), AssemblyAI protocol stub server |
| **API routes** | ✅ Scaffolded | 30+ routes: sessions, scenarios, runs, items, turns, prompts, participants, speaker mappings, exports, assets |
| **Frontend pages** | ✅ Scaffolded | Home, sessions/new, facilitator, display, scenarios (list/new/detail), simulator, results |
| **Mobile-first CSS** | ✅ Complete | Dark HUD theme, safe-area insets, dvh, ≥44px touch targets, overscroll-behavior, viewport-fit |
| **SSE** | ✅ Complete | Snapshot + patch, heartbeat every 15s, Last-Event-ID support |
| **Deployment** | ✅ Configured | Dockerfile (multi-stage), docker-compose, fly.toml for huddle-ti5ikw |
| **Unit tests** | ✅ 74 passing | Budget (13), guard (11), overlap (7), stubs (16), utils (27) |

### What Remains (by build stage)

See `hud-spec-v5.md` §27 for the full build order.

| Stage | Area | Status |
|---|---|---|
| **1** | Speech proof — AudioWorklet, getUserMedia, live transcript, wake lock, sendBeacon | 🔴 Not started |
| **2** | Diarization — speaker labels, calibration, UNKNOWN handling, SpeakerRevision | 🔴 Not started |
| **3** | Scenario + injection — Sim B audio pipeline, fixture WAV, Playwright E2E setup | 🟡 Partial |
| **4** | HUD — Real-time SSE patches (pub/sub), reconnect UX | 🟡 Partial |
| **5** | TTS + mixing — OpenAI TTS, hash caching, ffmpeg mixing, overlap schedule, IR convolution, simulator audio | 🟡 Partial |
| **6** | Critique intelligence — LLM batched turn analysis, evidence/rationale, discussion map | 🔴 Not started |
| **7** | Facilitation — Window analysis, agreement/minority, correction/dismissal audit | 🟡 Partial |
| **8** | Evaluation — LLM judge, eval thresholds, Playwright E2E, mobile emulation, real-device smoke | 🟡 Partial |

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client and create database
npx prisma generate
npx prisma db push

# Start development server (stubs on — zero API cost)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With all stubs enabled, you can:
1. Generate a scenario from the topic library
2. Review its script and speaker casting
3. Synthesize and approve it
4. Launch a simulated run from the scenario library
5. Watch the simulator playback controller
6. Navigate to the facilitator view to see the HUD
7. Evaluate the run and view results

## Configuration

Copy `.env` and configure:

| Variable | Purpose | Default |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | AssemblyAI streaming ASR | (required for live mode) |
| `ASSEMBLYAI_SPEECH_MODEL` | ASR model | `universal-3-5-pro` |
| `OPENAI_API_KEY` | OpenAI for analysis, generation, TTS | (required for non-stub) |
| `ANALYSIS_MODEL` | LLM model for analysis | `gpt-5-mini-2025-08-07` |
| `TTS_MODEL` | TTS model | `gpt-4o-mini-tts` |
| `DATABASE_URL` | SQLite database path | `file:./data/app.db` |
| `ASSET_DIR` | Audio asset storage | `./data/audio` |
| `ROOM_IR_DIR` | Room IR files | `./data/ir` |
| `LLM_STUB` | Use deterministic stubs | `1` |
| `TTS_STUB` | Use tone-based TTS stubs | `1` |
| `ASR_STUB` | Use in-process ASR stub | `1` |
| `IDLE_TERMINATE_SECONDS` | Auto-terminate idle ASR | `120` |
| `TOPIC_SUGGESTION_TTL_SECONDS` | Cache TTL for topics | `3600` |

## Routes

| Route | Typical Device | Purpose |
|---|---|---|
| `/` | any | Home — start live critique, browse scenarios, generate |
| `/sessions/new` | any | Session setup form |
| `/facilitator/[sessionId]` | laptop or phone (private) | Facilitator controls, full transcript, mic capture |
| `/display/[sessionId]` | any networked screen | Read-only HUD for shared display |
| `/scenarios` | any | Scenario library — filter, duplicate, launch |
| `/scenarios/new` | any | Generate scenario with dynamic topic suggestions |
| `/scenarios/[scenarioId]` | any | Review script, speaker casting, voice preview |
| `/simulator/[runId]` | one playback device | Simulated playback controller with SIMULATION badge |
| `/runs/[runId]/results` | laptop or tablet | Evaluation results, transcript, export |

## API Surface

See `hud-spec-v5.md` §24 for the complete API reference. Key endpoints:

```
Sessions:    POST/GET /api/sessions    GET/PATCH/DELETE /api/sessions/{id}
             POST /api/sessions/{id}/start    POST /api/sessions/{id}/terminate
             GET /api/sessions/{id}/events (SSE)
             POST/GET /api/sessions/{id}/speaker-mappings
             PATCH /api/sessions/{id}/speaker-mappings/{label}
             GET/POST /api/sessions/{id}/participants
             GET /api/sessions/{id}/turns    GET /api/sessions/{id}/items
             GET /api/sessions/{id}/export

Scenarios:   GET/POST /api/scenarios    GET/PATCH/DELETE /api/scenarios/{id}
             GET /api/scenarios/topic-suggestions
             POST /api/scenarios/estimate    POST /api/scenarios/generate
             GET /api/scenarios/{id}/voices
             POST /api/scenarios/{id}/recast    POST /api/scenarios/{id}/synthesize
             POST /api/scenarios/{id}/preflight    POST /api/scenarios/{id}/approve
             GET /api/scenarios/{id}/mixed

Runs:        POST/GET /api/runs    GET/PATCH /api/runs/{id}
             POST /api/runs/{id}/playback    POST /api/runs/{id}/evaluate
             GET /api/runs/{id}/results    GET /api/runs/{id}/export

Providers:   GET /api/providers/assemblyai/token
             GET /api/time
Assets:      GET /api/assets/{...key}    (Range-capable)
```

## Testing

```bash
# Run all unit tests (74 tests, stub mode, no API keys needed)
npm test

# Type check
npx tsc --noEmit

# Test categories:
#   tests/budget.test.ts   — parameter validation, cost estimation, duration checks
#   tests/guard.test.ts    — prompt guard rules (names, traits, forbidden terms)
#   tests/overlap.test.ts  — overlap rule validation (3-way, calibration, boundaries)
#   tests/stubs.test.ts    — topic suggestions, scenario generation, turn analysis
#   tests/utils.test.ts    — substantive turn, WER, Hungarian match, seeded RNG
```

Planned but not yet implemented:
- `npm run test:e2e` — Playwright × {chromium, firefox, webkit} × {desktop, mobile}
- `npm run test:e2e:mic` — Chromium fake-capture flags
- `npm run eval` — Full library sim B evaluation with profile-keyed thresholds
- `npm run test:smoke` — Real API key smoke tests

## Deployment

### Fly.io

The app is deployed at `huddle-ti5ikw.fly.dev`.

```bash
# Deploy
flyctl deploy --app huddle-ti5ikw

# Set secrets for production (required for non-stub mode)
flyctl secrets set \
  ASSEMBLYAI_API_KEY=your_assemblyai_key \
  OPENAI_API_KEY=your_openai_key \
  --app huddle-ti5ikw

# Optional overrides
flyctl secrets set \
  ASSEMBLYAI_SPEECH_MODEL=universal-3-5-pro \
  ANALYSIS_MODEL=gpt-5-mini-2025-08-07 \
  TTS_MODEL=gpt-4o-mini-tts \
  --app huddle-ti5ikw

# Check secrets
flyctl secrets list --app huddle-ti5ikw
```

For the Sprite environment specifically, API keys should be obtained through the Sprites API Gateway at `api.sprites.dev`. Run `curl -s https://api.sprites.dev/v1/gateway/list` to discover available connections. If no gateway connections are configured yet, you can also set keys directly as Fly.io secrets.

### Docker

```bash
docker compose up -d
```

## Architecture

- **One process**: Next.js serves UI, API routes, SSE, and background work
- **SQLite via Prisma** (WAL mode, `file:./data/app.db`)
- **Local filesystem** for audio assets (`./data/audio/`)
- **SSE** with snapshot+patch, 15s heartbeat, `Last-Event-ID` reconnect
- **Two external providers**: AssemblyAI (ASR) and OpenAI (LLM + TTS)
- **Stub mode**: All three providers have in-process stubs for zero-cost development

## Design Principles

1. **Describe language, never people.** "Direct instruction detected" — yes. "Authoritarian speaker" — never.
2. **Every AI output is correctable.** The facilitator can dismiss anything.
3. **Restraint:** max 3 labels per turn, max 1 prompt at a time, no confidence percentages on the public display.
4. **Preserve dissent.** Minority positions stay visible.
5. **Transcription survives analysis failure.** LLM down ⇒ transcript continues unannotated.
6. **Simulated sessions are unmistakably labelled** with the ◆ SIMULATION badge.
7. **Mobile is first-class.** Every route works one-handed on a phone.
8. **Real audio path always.** Simulated runs exercise the same decode → worklet → PCM16 → WebSocket path.

## License

MIT
