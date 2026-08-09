# Speech evaluation pipeline

This pipeline measures recognition and speaker attribution by comparing a
synthesized scenario's realized timeline with finalized streaming-ASR turns
from a linked session. It is designed for repeatable injected-audio and fake-
microphone tests; natural-room testing still needs a human-annotated reference.

## Inputs

- **Reference:** scenario turns after synthesis, including exact utterance text,
  reference speaker, and realized `startMs`/`endMs`.
- **Hypothesis:** finalized persisted session turns, including recognized text,
  provider speaker label, turn timing, and word-level timing when available.
- **Window:** an explicit interval for a partial run, or the full realized mix
  for a complete run.

Calibration turns are excluded from reported scores by default. They are still
used to map arbitrary provider labels such as `A`, `B`, and `C` to reference
speakers by maximum temporal overlap.

## Metrics

- **Overall WER:** lexical substitutions + deletions + insertions, divided by
  reference words, without considering speaker identity.
- **Speaker-attributed WER (SA-WER):** the same edit calculation after grouping
  words by the mapped reference speaker. Words assigned to an unmapped or
  unknown label count as insertions.
- **Non-overlap WER:** WER outside intervals where two or more reference
  speakers are active.
- **Overlap WER and overlap SA-WER:** scores restricted to reference overlap
  intervals. SA-WER exposes words recovered under the wrong speaker even when
  the combined text is correct.
- **DER excluding overlap:** missed, false-alarm, and confused speaker-time on
  single-speaker reference intervals.
- **DER including overlap:** the same calculation while counting every active
  reference speaker during overlap.

DER is calculated as:

```text
(missed speaker-ms + false-alarm speaker-ms + confused speaker-ms)
-----------------------------------------------------------------
                     reference speaker-ms
```

A 250 ms reference-boundary collar is used by the production test. Both the
collar and the evaluation window are reported with the result.

Reference word times are estimated uniformly within each realized TTS
utterance because the synthesis manifest has clip-level rather than word-level
alignment. Hypothesis words use provider timestamps. This makes overlap WER a
repeatable engineering regression metric, not a substitute for manually
aligned research annotations.

## Run the deployed browser test

The test creates a production session, injects the approved Climate mix through
the exact browser AudioWorklet → PCM16 → streaming ASR path, waits through the
first authored overlap, runs two persisted whole-transcript intent snapshots
while capture remains active, audits their exact source-quote anchors,
terminates cleanly, requests a score, and applies quality gates.

```bash
RUN_PRODUCTION_LIVE=1 \
BASE_URL=https://huddle-ti5ikw.fly.dev \
PRODUCTION_LIVE_SCENARIO_ID=<approved-scenario-id> \
PRODUCTION_LIVE_AUDIO_FILE=<absolute-path-to-16khz-mono-wav> \
npx playwright test e2e/production-live.spec.ts --project=chromium-desktop
```

Default gates are:

| Metric                         | Maximum |
| ------------------------------ | ------- |
| Overall WER                    | `0.45`  |
| Speaker-attributed WER         | `0.75`  |
| DER excluding overlap          | `0.75`  |
| Speaker-attributed overlap WER | `1.50`  |

Override them with `MAX_SPEECH_WER`, `MAX_SPEAKER_ATTRIBUTED_WER`,
`MAX_NON_OVERLAP_DER`, and `MAX_OVERLAP_SA_WER`. The test always requires three
reference speakers, at least two stable hypothesis labels, a non-empty overlap
interval, and at least two successful label-to-speaker mappings.

## Validated production baseline

On 2026-08-09, Fly version 41 replayed the approved three-person Climate mix
through the deployed recorded-audio path to the first authored overlap. The
no-retry run finalized 19 transcript segments and produced two stable provider
speaker labels:

| Metric                         | Result    |
| ------------------------------ | --------- |
| Overall WER                    | `0.016`   |
| Speaker-attributed WER         | `0.626`   |
| Overlap WER                    | `1.000`   |
| Speaker-attributed overlap WER | `0.333`   |
| DER excluding overlap          | `0.326`   |
| DER including overlap          | `0.327`   |
| Missed speaker-time            | `3.213s`  |
| False-alarm speaker-time       | `0.165s`  |
| Confused speaker-time          | `30.991s` |

The combined words were highly accurate, but the two-label hypothesis merged
one of the three reference speakers. The resulting speaker confusion explains
the much higher SA-WER and DER and establishes a concrete baseline for future
diarization improvements.

The same run created live-analysis snapshots at 18 turns/337 words and 19
turns/362 words without stopping capture. Both used model synthesis and passed
an exact-substring source audit. See
[Live Critique verification](live-critique-verification.md) for the interaction
and grounding procedure and its interpretation limits.

## Score an existing session

The session must be linked to a synthesized scenario. A full-run report uses
the complete realized scenario timeline:

```bash
curl -fsS \
  "https://huddle-ti5ikw.fly.dev/api/sessions/<session-id>/speech-evaluation?collarMs=250"
```

For a partial capture, set the reference-aligned boundary explicitly so that
unplayed future dialogue is not counted as deleted speech:

```bash
curl -fsS \
  "https://huddle-ti5ikw.fly.dev/api/sessions/<session-id>/speech-evaluation?startMs=0&endMs=126188&collarMs=250"
```

Available query parameters are `startMs`, `endMs`, `collarMs`,
`includeCalibration=1`, and `hypothesisTimeOffsetMs`. The time offset should
remain zero for browser-injected audio because the reference and streaming ASR
timestamps share the audio clock. It exists for imported captures with a known
leading offset; it should not be tuned merely to improve a score.

## Interpreting results

- Low overall WER with high SA-WER or DER means the words were recovered but
  assigned to the wrong participant.
- A large missed-speech component during overlap usually means the provider
  represented two simultaneous voices as one speaker stream.
- A large confusion component means speech was detected at the right time but
  mapped to the wrong speaker.
- A large false-alarm component indicates recognized speech outside the
  reference speech regions or duplicate/extended hypothesis segments.

For publishable evaluation, run the complete mix and add human-corrected word
and speaker boundaries. Report injected, fake-microphone, room, device,
distance, noise, and reverberation conditions separately.
