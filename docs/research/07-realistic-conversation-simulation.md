# Realistic multi-party conversation simulation

This note records the research decisions behind the scenario transcript and
audio pipeline. It is intentionally narrower than a general conversation-
analysis survey: every point below has a concrete implication for Huddle.

## Evidence used

- Sacks, Schegloff, and Jefferson's turn-taking model treats one speaker at a
  time, minimized gaps, and minimized overlap as an interactional achievement,
  not as a rigid round-robin schedule. Potential turn-completion points and
  speaker self-selection explain why transitions can be fast without being
  uniform. [A simplest systematics for the organization of turn-taking for
  conversation](https://www.conversationanalysis.org/schegloff-media-archive/simplest-systematics-for-turn-taking-language-1974/)
- Stivers et al. measured question-response transitions across ten languages.
  All showed avoidance of overlap and minimization of silence, with language
  means varying within roughly 250 ms of the cross-language mean. Responses
  that resist a question's terms can be delayed by up to about a second. This
  supports short but varied ordinary gaps and longer, meaningful hesitation.
  [Universals and cultural variation in turn-taking in
  conversation](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705608/)
- Heldner and Edlund show that pauses, gaps, and overlaps have distributions,
  not one precise duration. The simulator should sample or author a range and
  preserve the distinction between within-speaker pauses, between-speaker gaps,
  and overlap. [Pauses, gaps and overlaps in
  conversations](https://doi.org/10.1016/j.wocn.2010.08.002)
- Schegloff's analysis shows that most overlap is brief, normally involves two
  speakers, and is resolved quickly. Backchannels and collaborative completions
  are not equivalent to competitive interruptions; overlap can produce cutoffs,
  restarts, louder delivery, or one participant yielding. [Overlapping talk and
  the organization of turn-taking for
  conversation](https://doi.org/10.1017/S0047404500001019)
- OpenAI Structured Outputs constrain model output to a JSON Schema, but the
  application must still handle incomplete responses/refusals and apply domain
  validation. Clear field names and descriptions improve generation quality.
  [Structured model
  outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- The Speech API accepts per-utterance delivery instructions. That makes a
  separate clip per utterance useful: speaker identity, overlap type, pace, and
  conversational function can inform delivery before measured clips are mixed.
  [Text to
  speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- AssemblyAI's current streaming diarization contract requires the
  `u3-rt-pro` speech model plus `speaker_labels=true`; `max_speakers` can
  constrain the expected cast. Speaker identity appears at both Turn and word
  level. Very short speech may remain `UNKNOWN`, and simultaneous voices are
  assigned to one speaker rather than separated acoustically. The application
  must preserve this uncertainty instead of presenting diarization as ground
  truth. [Streaming speaker
  diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
- Streaming audio must be mono PCM16 at the declared sample rate, sent in
  50–1000 ms chunks and no faster than real time. Begin, partial/final Turn,
  and Termination messages form a stateful sequence; connection and server
  activation therefore need explicit timeout and rollback behavior.
  [Streaming message
  sequence](https://www.assemblyai.com/docs/streaming/message-sequence)

## Transcript model

The editable transcript is a versioned event document, not a screenplay and
not an audio manifest. Each utterance has:

- a stable utterance ID and order;
- a speaker index plus the speaker's name and role in the editable document;
- exact spoken text;
- dialogue function and the earlier utterance it responds to;
- a planned gap before speech, or an overlap anchored to an earlier utterance;
- overlap kind (`backchannel`, `eager_agreement`, or `interruption`) and
  resolution (`backchannel`, `yield`, or `continue`);
- delivery guidance (pace, tone, volume, and disfluency); and
- optional realized start/end times measured after speech synthesis.

Planned and realized timing must remain separate. An LLM can author a natural
transition such as "start 650 ms before t18 ends," but it cannot know the exact
duration of a future TTS clip. After synthesis, the mixer measures every clip,
resolves the relative transition against the anchor's measured end, and writes
absolute `startMs`/`endMs` values back to the transcript.

## Authoring rules

- Speaker choice follows conversational causality, not modulo arithmetic.
- Most transitions are one-at-a-time with varied short gaps. A difficult,
  resistant, or consequential response may use a noticeably longer gap.
- Overlap is sparse and locally motivated. It normally involves adjacent turns
  and two speakers. A backchannel is short and non-substantive; an interruption
  must say whether the prior speaker yields or continues.
- Exact duplicate substantive lines are invalid. Repeated sentence frames,
  perfectly equal turn counts, and near-total round-robin order are quality
  warnings because they usually reveal template generation.
- Agreement must add, qualify, repair, challenge, redirect, or make a
  consequence explicit. The transcript should include misunderstandings,
  self-repair, unresolved concerns, and changing positions without sprinkling
  fillers into every turn.
- Calibration utterances are kept outside the critique arc and never overlap.

## Revision and synthesis lifecycle

1. Generation or migration produces a normalized version-2 transcript.
2. A user may run one to three sequential LLM revision passes. Every pass gets
   the complete versioned transcript and the result of the preceding pass.
3. Structured output is normalized and checked for speaker references, stable
   IDs, reaction links, duplicate speech, overlap bounds, self-overlap, and
   participation pathologies before it can replace the saved script.
4. A successful text or timing revision marks the scenario as draft, clears
   approval/preflight/realized timing, and invalidates the mixed audio and
   validation report. Unchanged per-utterance clips remain cacheable.
5. TTS renders each utterance with speaker and turn-level delivery directions.
   The mixer measures clips, schedules them from planned transitions, validates
   the concrete overlap graph, and writes the realized timeline and manifest.
6. Independent ASR validation, preflight, and approval operate on that exact
   mix. Playback never serves a mix whose transcript fingerprint is stale.

## Live-session demo path

A synthesized discussion should be injectable into the same PCM16-to-ASR path
as a microphone. The browser decodes the validated mix, routes it through the
same resampling AudioWorklet, and sends identical 16 kHz PCM frames to the ASR
client. The only difference is the source node (audio buffer rather than media
stream). This is a stronger pipeline test than playing the file in a separate
simulator because it exercises capture framing, WebSocket streaming, turn
ingestion, diarization updates, analysis, SSE, and the facilitator/display UI.

The client persists contiguous word-level speaker runs as separate segments of
one provider Turn. A mixed-label Turn is flagged as possible overlap rather
than silently attributed to its dominant label. This recovers brief speaker
changes that the provider can identify, while retaining `UNKNOWN` for speech
too short or ambiguous to assign reliably.
