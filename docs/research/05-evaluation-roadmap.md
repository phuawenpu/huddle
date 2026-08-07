# Evaluation and implementation roadmap

## Evaluation principle

The system should be evaluated as a socio-technical intervention, not only as an AI model. Accuracy matters, but the research claim concerns:

- student agency;
- critical reflection;
- cognitive load;
- social safety;
- feedback quality;
- preservation of alternatives;
- continuity from critique to revision.

A high model-agreement score cannot establish those outcomes. Some desirable behaviors—such as reasoned rejection of feedback—may lower agreement while improving learning.

## Research hypotheses

### H1 — Provenance

Students using Intent Ledger will create more revisions with explicit source and rationale links than students using a transcript-plus-summary system.

### H2 — Cognitive offloading

Jury Bridge will improve delayed recall and action-plan specificity without reducing visible engagement during critique.

### H3 — Agency

An evidence-gated, correctable public mirror will produce higher perceived control and fewer accepted unsupported AI interpretations than an unconstrained AI facilitator.

### H4 — Dissent

Explicit alternative and unresolved states will preserve more material minority positions through later revisions than consensus-oriented summaries.

### H5 — Peer safety

Transparent pseudonymity with staged reveal and private articulation support will increase feedback specificity and willingness to clarify without increasing incivility.

### H6 — Reflective transfer

Reflective Twin’s first-attempt and Socratic modes will improve unaided transfer to a new design problem relative to direct multimodal AI critique.

### H7 — Non-homogenization

Intent-grounded, question-first AI support will maintain greater between-project design diversity than solution-generating AI critique.

## Evaluation layers

### Layer 1 — Component validity

Before classroom use, establish that each technical component behaves within known bounds.

| Component | Measure | Minimum gate |
|---|---|---|
| ASR | WER by room/noise/device | Report by condition; no single aggregate |
| Diarization | DER and turn-level attribution | Separate overlap/non-overlap |
| Speaker revision | exact revision persistence | 100% integration-test correctness |
| Source anchoring | phrase-span precision/recall | human-coded validation |
| Discourse relation | macro F1 by relation | include “insufficient evidence” |
| Intent relation | agreement with student and educator | do not treat educator as sole truth |
| Reference linker | entity precision and verified-link rate | prioritize precision over recall |
| Prompt guard | prohibited-output escape rate | zero in adversarial test set |
| Permission propagation | unauthorized visibility | zero |
| Event recovery | missing/duplicate events | zero after defined reconnection cases |
| Correction audit | derivation lineage | 100% traceability |

### Layer 2 — Interaction validity

Use scenario-based usability studies before live graded studios.

Tasks:

- correct a speaker revision;
- revise project intent without losing the prior version;
- trace a map node to its phrase and artifact region;
- reject an AI interpretation with rationale;
- preserve two contradictory juror positions;
- submit pseudonymous peer feedback and understand reveal limits;
- delete or withdraw a contribution;
- recover after network interruption.

Measure:

- task completion;
- error rate;
- time;
- correction comprehension;
- visibility-policy comprehension;
- perceived agency;
- trust calibration;
- accessibility barriers.

### Layer 3 — Controlled critique study

Recommended within-subject counterbalanced conditions:

1. **Baseline:** ordinary critique and student notes.
2. **Transcript:** speaker-attributed transcript and post-session summary.
3. **Ledger:** full source-linked intent/disposition/revision workflow.

Use the same design task class and balance order to reduce project and novelty effects.

Immediate measures:

- NASA-TLX or a justified cognitive-load measure;
- state anxiety or social-evaluative threat with an approved instrument;
- number and specificity of critique claims;
- interruptions and speaking distribution;
- screen attention versus speaker attention;
- clarification questions;
- unsupported AI claims noticed/corrected.

Delayed measures:

- recall after 24–72 hours;
- quality and diversity of revisions;
- traceability of design decisions;
- transfer to a new brief;
- dependence after AI support is removed.

### Layer 4 — Semester field deployment

Deploy only after privacy and reliability gates pass.

Study:

- repeated intent revisions;
- feedback-to-revision cycles;
- student dispositions;
- follow-up by tutors;
- design diversity;
- voluntary usage and abandonment;
- correction patterns;
- differences by year level and language background;
- privacy and power effects.

Do not rank students. Aggregate only with participant consent and minimum cohort sizes.

## Condition-specific evaluation

### Live Critique Mirror

Compare sparse and rich public views:

- no display;
- captions only;
- captions + compact source-linked map;
- captions + map + guarded prompt.

Key question: at what point does the mirror stop reducing cognitive load and start competing with the conversation?

### Intent Ledger

Blindly code revision rationales for:

- source specificity;
- alternative consideration;
- relationship to intent;
- evidence quality;
- student ownership;
- unresolved uncertainty.

Track whether the student uses accept/adapt/defer/reject meaningfully rather than mechanically.

### Studio Commons

Use named, pseudonymous, and staged-reveal conditions. Participants must be able to explain who can reveal identity and when. “Anonymous” is not an acceptable label if the institution retains identity.

### Jury Bridge

Evaluate reference linking with a curated set of known names, ambiguous names, and unknown references. False confident matches are more harmful than missed matches.

### Reflective Twin

Create an expert-coded artifact set with region-level observations and multiple legitimate interpretations. Score:

- observation correctness;
- unsupported inference;
- acknowledgment of ambiguity;
- diversity of questions;
- student corrections;
- downstream design convergence.

## Simulation harness

The existing scenario/audio subsystem should become a formal research instrument.

### Scenario factors

- 3–6 speakers;
- 3–15 minutes;
- quiet room / reverberant room / background speech;
- device and microphone class;
- near/equal/far speaker placement;
- accented and code-switched speech;
- even and uneven participation;
- none/occasional/frequent overlap;
- disagreement level;
- ambiguous intent;
- unknown precedent names;
- adversarial person-judging language;
- network disconnect and reconnect;
- provider delay/failure.

### Three simulation levels

1. **Deterministic service fixtures**
   Zero-cost CI. Validates protocol and state transitions, not acoustic or language performance.

2. **Injected real speech**
   Mixed WAV decoded into the exact AudioWorklet/ASR path. Reproducible regression test.

3. **Acoustic playback**
   Separate playback device, room, and capture device. Reportable as simulated physical-path performance when clearly labeled.

### Required metrics

Do not reuse one number under multiple names.

| Metric | Definition |
|---|---|
| WER | reference vs final transcript |
| DER | diarization error rate |
| turn attribution | correct speaker per aligned turn |
| overlap WER/DER | metrics restricted to overlap intervals |
| unknown rate | substantive duration without speaker assignment |
| finalized-turn loss | expected aligned turns absent from final store |
| revision correctness | late provider revisions persisted correctly |
| ingest duplication | duplicate source events after retry/reconnect |
| partial latency | audio-time to partial display |
| final latency | end-of-speech to final display |
| analysis latency | final persistence to derived output |
| HUD latency | server publish to display render |
| map precision/recall | human-coded map items and relations |
| prompt groundedness | prompt claims supported by cited turns |
| guard escape | prohibited prompt shown publicly |
| recovery gap | source events missing after network switch |
| duration error | rendered vs requested duration |

### Reproducibility record

Every run should store:

- source scenario and seed;
- provider/model versions;
- prompt versions;
- voice cast;
- audio checksums;
- room/device configuration;
- environment mode;
- network fault schedule;
- application commit;
- corrections;
- evaluation code version.

## Privacy and ethics gates

No live study should begin until:

1. participants can decline recording without academic penalty;
2. the system records consent scope and withdrawal;
3. authentication and role authorization are enforced;
4. data retention and deletion are documented and implemented;
5. audio/transcript access is private by default;
6. public display content is explicitly scoped;
7. identity/reveal claims are accurate;
8. model/provider data handling is disclosed;
9. researchers can export an audit trail without exposing unrelated participants;
10. incident response exists for misattribution, harmful output, or unintended disclosure.

## Proposed implementation sequence

### Phase 0 — truthful baseline

- update README claims;
- distinguish implemented, partial, and scaffolded paths;
- add a visible degraded/stub state;
- preserve this audit as a versioned research artifact.

### Phase 1 — trustworthy live core

- authentication, capabilities, consent, retention;
- secure asset and upload handling;
- exact speaker-revision persistence;
- audited corrections;
- SSE recovery;
- guarded source-linked prompts;
- integration tests.

**Exit gate:** zero unauthorized reads/writes in role tests; all correction/revision/reconnect cases pass.

### Phase 2 — Intent Ledger minimum viable study

- projects and artifact revisions;
- versioned intent;
- feedback claims and source anchors;
- typed intent/claim relations;
- student disposition;
- action and revision response;
- post-critique review.

**Exit gate:** a researcher can reconstruct every displayed derived claim and every student action from immutable source and revision records.

### Phase 3 — mode-specific interfaces

- peer identity/audience policies;
- Jury Bridge term/reference workflow;
- sparse public mirror;
- private facilitator controls;
- accessibility modes.

**Exit gate:** users correctly predict visibility and identity in scenario tests; no derived output widens source permissions.

### Phase 4 — Reflective Twin

- artifact uploads and region anchors;
- first-attempt capture;
- multimodal observation layer;
- Socratic modes;
- design-diversity evaluation.

**Exit gate:** observation and inference are visibly separated; unsupported inference and correction rates meet preregistered thresholds.

### Phase 5 — field and curriculum study

- semester deployment;
- optional privacy-preserving aggregate view;
- teacher and student co-interpretation;
- non-AI comparison;
- transfer and dependency measures.

## Publication strategy

The work can support three distinct contributions if evaluated separately:

1. **HCI/system paper:** dual-surface, evidence-gated live critique mirror and interaction study.
2. **Learning-sciences paper:** Intent Ledger and feedback-to-revision/agency outcomes.
3. **Systems/evaluation paper:** reproducible acoustic digital-twin harness for live AI critique systems.

Combining all claims in one early study would make causal interpretation difficult. The Intent Ledger should be the conceptual spine; the live mirror and acoustic harness can be evaluated as enabling systems.

## Success criteria for the “best system”

The project should only claim success when evidence shows:

- students remember and act on more source-grounded critique;
- alternative positions remain available;
- students correct and reject AI outputs appropriately;
- design work does not converge more than the baseline;
- public intervention does not increase cognitive load or social pressure;
- privacy and identity controls are understood;
- the system remains useful when AI analysis is unavailable;
- later revisions can be traced without turning the trace into a student score.
