# Critique HUD

A shared cognitive mirror for Design Thinking critiques — a Next.js web application that provides real-time speaker-attributed transcription, discussion mapping, and AI-powered facilitation prompts.

## Overview

The Critique HUD supports two modes:

- **Live Mode** — Room microphone → AssemblyAI streaming ASR → live diarized transcript → SSE-driven HUD display + private facilitator controls
- **Simulated Mode** — LLM-generated multi-speaker critique scripts → per-turn TTS → mixed audio stream → tested acoustically or via audio injection

### Key Features

- Speaker-attributed live transcription with diarization
- Discussion map: Evidence, Questions, Positions, Decisions, Actions
- AI-powered turn analysis and window-level insights
- Single neutral facilitation prompt at a time
- Prompt guard: blocks prompts that name participants or use personality terms
- Scenario generation with dynamic topic suggestions, variable length (3–15 min), speaker count (3–6), cross-talk levels
- Per-turn TTS with hash caching, distinct voice casting, loudness normalization
- Evaluation: speaker accuracy, classification agreement, latency percentiles
- Mobile-first UI with dark HUD theme, safe-area aware, ≥44px touch targets

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client and create database
npx prisma generate
npx prisma db push

# Start development server (with stubs — no API keys needed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy `.env` and configure:

| Variable | Purpose | Default |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | AssemblyAI streaming ASR | (required for live mode) |
| `OPENAI_API_KEY` | OpenAI for analysis, generation, TTS | (required for non-stub) |
| `DATABASE_URL` | SQLite database path | `file:./data/app.db` |
| `LLM_STUB` | Use deterministic stubs | `1` |
| `TTS_STUB` | Use tone-based TTS stubs | `1` |
| `ASR_STUB` | Use in-process ASR stub | `1` |

When all stubs are enabled (`LLM_STUB=1`, `TTS_STUB=1`, `ASR_STUB=1`), the application runs entirely offline with zero API cost.

## Routes

| Route | Purpose |
|---|---|
| `/` | Home — start live critique, browse scenarios, generate |
| `/sessions/new` | Session setup form |
| `/facilitator/[sessionId]` | Facilitator controls, full transcript, mic capture |
| `/display/[sessionId]` | Read-only HUD for shared display |
| `/scenarios` | Scenario library |
| `/scenarios/new` | Generate scenario with dynamic topic suggestions |
| `/scenarios/[scenarioId]` | Review script, speaker casting, launch |
| `/simulator/[runId]` | Simulated playback device |
| `/runs/[runId]/results` | Evaluation results and export |

## API

See `hud-spec-v5.md` §24 for the full API surface.

## Testing

```bash
# Run unit tests (stub mode, no API keys needed)
npm test

# Type check
npx tsc --noEmit
```

### Test Coverage

- **Utilities**: `isSubstantiveTurn`, `wordErrorRate`, `hungarianMatch`, `seededRandom`
- **Guard**: prompt guard rules — blocks participant names, traits, mental health terms
- **Budget**: scenario parameter validation, cost estimation, duration range checks
- **Overlap**: overlap rule validation — max duration, three-way rejection, calibration protection
- **Stubs**: topic suggestions, scenario generation, turn analysis, cost estimation

## Deployment

The application deploys as a single Next.js process with SQLite.

### Fly.io

```bash
flyctl launch
flyctl deploy
flyctl secrets set ASSEMBLYAI_API_KEY=... OPENAI_API_KEY=...
```

See `fly.toml` for configuration.

### Docker

```bash
docker compose up -d
```

## Architecture

- **One process**: Next.js serves UI, API routes, SSE, and background work
- **SQLite via Prisma** (WAL mode)
- **Local filesystem** for audio assets
- **SSE** (Server-Sent Events) with snapshot+patch, heartbeat, `Last-Event-ID` reconnect
- **Two external providers**: AssemblyAI (ASR) and OpenAI (LLM + TTS)

## Design Principles

1. Describe language, never people
2. Every AI output is correctable
3. Restraint: max 3 labels per turn, max 1 prompt at a time
4. Preserve dissent — minority positions stay visible
5. Transcription survives analysis failure
6. Simulated sessions are unmistakably labelled
7. Mobile is first-class, not a fallback

## License

MIT
