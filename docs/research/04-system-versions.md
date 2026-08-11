# Seven versions of the novel information system

## How the versions were generated

Each version emphasizes a different unit of information and a different intervention point. They are not release numbers in a single linear roadmap; they are design alternatives that can be combined after their individual hypotheses are tested.

### Selection criteria

Each version is scored from 0–3 on:

1. **research fit** — directly answers needs in the two local studies;
2. **interaction distinctiveness** — offers more than a generic chatbot/dashboard;
3. **agency and governance** — gives people meaningful control;
4. **provenance value** — creates durable, inspectable information;
5. **technical/research method** — enables a specific evaluable contribution;
6. **prior-art differentiation** — remains distinctive after the targeted comparison.

Maximum score: 18. Scores express design judgment, not proof of novelty.

## Version 1 — Live Critique Mirror

**Selected for a diagram**
**Score: 15/18**

### Thesis

A co-present critique needs a shared cognitive mirror, not an AI participant that dominates the room. The system listens through one shared microphone, attributes turns provisionally, structures the dialogue, and exposes different information on private and public surfaces.

### Primary users

- student whose work is being critiqued;
- peers and jurors in the room;
- facilitator operating the private surface;
- observers viewing the public surface.

### How it works

#### Before critique

1. The student enters a concise, editable intent:
   - intended experience or claim;
   - current phase;
   - constraints;
   - questions they want the critique to address.
2. The facilitator sets:
   - participant labels;
   - public naming policy;
   - session retention;
   - whether facilitation prompts are allowed.
3. All participants see a recording/AI disclosure and consent state.

#### During critique

1. Audio is converted to PCM16 in the browser and streamed to ASR.
2. Finalized turns become immutable source events; later corrections create new revisions.
3. AI derives provisional discourse moves:
   - observation/evidence;
   - question;
   - position;
   - alternative;
   - decision;
   - action;
   - unresolved tension.
4. Each derived item links back to source phrases.
5. The public mirror shows:
   - the latest few turns;
   - a compact issue/position/action map;
   - participation balance without ranking;
   - at most one evidence-linked prompt.
6. The private facilitator surface shows:
   - raw and corrected transcript;
   - speaker uncertainty;
   - rejected AI outputs;
   - correction controls;
   - audience controls.
7. AI remains silent unless an intervention policy passes:
   - directly relevant to the stated critique question;
   - supported by visible source turns;
   - no person-level inference;
   - no active prompt;
   - sufficient time since the last prompt;
   - facilitator has not paused prompting.

#### After critique

The student receives an editable bundle of:

- source transcript;
- issue/position/action map;
- unresolved alternatives;
- terms or precedents to investigate;
- candidate actions.

No action becomes “accepted” until the student responds.

### Information model

```text
CritiqueSession
  ├─ ConsentPolicy
  ├─ IntentRevision[]
  ├─ SourceTurn[] → SourceTurnRevision[]
  ├─ DerivedClaim[] → EvidenceAnchor[]
  ├─ Relation[] (supports/challenges/alternative/depends-on)
  ├─ FacilitationIntervention[] → GuardDecision
  └─ ParticipantVisibilityPolicy[]
```

### Public/private contract

| Public mirror | Private facilitator |
|---|---|
| provisional names or role labels | provider labels and mapping confidence |
| no confidence percentages | diagnostic uncertainty |
| discourse, not person traits | correction and suppression controls |
| source-linked prompt | rejected prompts and guard reasons |
| compact map | full transcript and derivation history |
| no raw consent/private notes | consent and audience administration |

### Why it may be novel

MeetMap already provides real-time dialogue mapping, and CoDialogue Space provides live AI facilitation. The differentiation is the combined **co-present studio setting, two-surface authority model, design-intent grounding, source-gated public prompts, and person-inference prohibition**.

### Main risk

The public display may add cognitive load or alter critique behavior. It could also turn talk share into surveillance. The HUD must be sparse, optional, and evaluated against a transcript-only display and no-display baseline.

### Implementation delta from current code

- fix speaker revision and correction propagation;
- add real event replay or explicit snapshot semantics;
- add source anchors and relations;
- pass participants into guards;
- add facilitator approval/suppression;
- add consent and visibility policy;
- replace flat item list with an editable relation map;
- create a post-session student review.

### Evaluation

Compare:

1. no HUD;
2. transcript/talk-share HUD;
3. full intent-grounded mirror.

Measure recall, number of source-grounded revisions, perceived pressure, interruption frequency, public-display attention, correction rate, and minority-position retention.

## Version 2 — Intent Ledger

**Selected for a diagram**
**Score: 18/18 — recommended core system**

### Thesis

The durable unit of critique should not be the AI summary. It should be the traceable relationship between **intent, human feedback, learner judgment, action, and artifact revision**.

### Primary users

- student/project owner;
- studio professor;
- peer reviewers;
- research evaluator.

### How it works

#### Project frame

Every project begins with `IntentRevision 1`, containing:

- intended users and situation;
- desired spatial/experiential effect;
- project constraints;
- current uncertainties;
- evidence the student believes supports the design.

Intent is not a contract that critique must obey. It is a versioned statement against which feedback can be interpreted.

#### Critique capture

Every feedback claim is stored with:

- exact transcript phrase or human-written note;
- speaker role and chosen visibility;
- artifact region if referenced;
- relation to intent:
  - aligns;
  - challenges assumption;
  - reframes goal;
  - proposes alternative goal;
  - concerns execution;
  - insufficient evidence;
- relation to other claims;
- AI derivation metadata and human corrections.

#### Learner disposition

The student must make the next epistemic move. For each important claim:

- **accept** — adopt the proposed direction;
- **adapt** — retain the concern but change the response;
- **defer** — investigate or test later;
- **reject** — decline with a rationale;
- **unresolved** — preserve competing positions.

The system never equates rejection with poor learning. A reasoned rejection is valid design judgment.

#### Revision linkage

When an artifact changes, the student links a region or commit to one or more claims and adds a short reflection:

- what changed;
- what evidence motivated it;
- what remains unresolved;
- whether intent changed;
- what should be tested next.

#### Later critique

The next session begins with a neutral continuity view:

- feedback addressed;
- feedback intentionally not addressed;
- unresolved alternatives;
- intent changes;
- claims awaiting evidence.

### Information model

```text
Project
  ├─ IntentRevision
  ├─ Artifact
  │    └─ ArtifactRevision
  │          └─ ArtifactRegion
  └─ CritiqueEvent
       └─ FeedbackClaim
            ├─ SourceAnchor
            ├─ IntentRelation
            ├─ ClaimRelation
            ├─ LearnerDisposition
            ├─ Action
            └─ RevisionResponse → ArtifactRevision/Region
```

Every AI-created node also records:

```text
Derivation {
  model
  promptVersion
  inputSourceIds
  createdAt
  confidencePrivate
  correctedBy
  supersedes
}
```

### Interfaces

#### Student

- timeline of intent and artifact revisions;
- inbox of uncategorized feedback claims;
- disposition controls;
- side-by-side “source / interpretation / response / revision” view;
- unresolved-tension shelf;
- reflection prompts that fade after use.

#### Professor

- evidence of reasoning transitions, not an AI score;
- claims needing clarification;
- student-authored dispositions;
- longitudinal project map;
- no private student notes unless shared.

#### Public critique

Only current intent, selected artifact, live source-linked claims, and unresolved positions appear. Dispositions remain private until the student chooses to share.

### Why it may be novel

Critsly contains board context, critique history, action planning, and educator traces. MeetMap provides editable map nodes. The differentiated claim is the **typed, versioned provenance chain with learner disposition as the required decision point**, particularly for co-present architectural critique across multiple reviews.

### Main risk

The ledger can become bureaucratic and over-structure a fluid design process. It should support lightweight capture, batch disposition, and “leave unresolved” as a first-class state.

### Implementation delta

- add Project, Artifact, ArtifactRevision, ArtifactRegion;
- add FeedbackClaim, SourceAnchor, typed relations, LearnerDisposition, Action, RevisionResponse;
- turn current Session objective into versioned intent;
- separate immutable source from corrected/derived layers;
- build post-critique review and later-session continuity;
- add exportable provenance bundles.

### Evaluation

Primary hypothesis:

> Students using an intent ledger will produce revisions with more explicit source rationale and retain more material dissent than students using transcript-plus-summary notes.

Measure:

- trace completeness;
- proportion of revisions linked to evidence;
- quality of accept/adapt/reject rationales;
- unresolved-position survival;
- delayed recall;
- student ownership;
- professor sensemaking time;
- design diversity across the cohort.

## Version 3 — Agency-Preserving Studio Commons

**Selected for a diagram**
**Score: 14/18**

### Thesis

Peer critique improves when identity, audience, timing, and accountability are designed together. The system should reduce face threat without producing an unaccountable anonymous comment stream.

### Primary users

- presenting student;
- peer reviewers;
- professor/moderator.

### How it works

#### Identity layers

Each contribution has three separately controlled identities:

1. **system identity** — known to the institution for abuse response;
2. **session identity** — real name, role, persistent pseudonym, or one-session pseudonym;
3. **recipient identity view** — what the presenter sees now and after reveal.

The platform never claims anonymity if an educator or administrator can reveal identity.

#### Audience scopes

Every contribution chooses or inherits:

- private to author;
- private to presenter;
- presenter + professor;
- peer group;
- whole critique room;
- course archive.

AI summaries cannot expand the audience of their sources. A summary’s maximum visibility is the intersection of all source permissions.

#### Critique sequence

1. Presenter shares intent and artifact with a chosen audience.
2. Peers make a first attempt without AI.
3. Optional articulation support asks:
   - what did you observe?
   - what consequence do you infer?
   - what question or alternative follows?
4. AI can flag unsupported generalization or person-directed language privately before submission. It does not label a reviewer as biased.
5. Recipient controls pacing:
   - receive now;
   - batch after critique;
   - ask AI to group similar claims;
   - request clarification while identity remains protected.
6. Presenter dispositions feed the Intent Ledger.
7. Optional staged reveal supports accountability and later conversation.

### Information model

```text
IdentityPolicy
AudiencePolicy
FeedbackContribution
  ├─ AuthorIdentityView
  ├─ RecipientIdentityView
  ├─ VisibilityScope
  ├─ FirstAttempt
  ├─ AIArticulationSuggestion
  ├─ SubmittedRevision
  └─ RevealEvent
```

### AI role

AI may:

- help articulate an observation;
- ask for artifact evidence;
- separate observation from inference;
- group duplicate feedback;
- translate terminology;
- mediate clarification.

AI may not:

- infer motive, personality, competence, emotion, or protected attributes;
- calculate a “bias score” for a person;
- reveal identity;
- merge feedback across incompatible visibility scopes;
- generate a consensus that erases a minority claim.

### Why it may be novel

Anonymous peer review and AI writing assistance already exist, including MeetScript and Socratique. The differentiation is the **three-layer identity model, visibility-preserving AI derivation, recipient-controlled pacing, and direct handoff into critique-to-revision provenance**.

### Main risk

Anonymity can reduce care or be perceived as deceptive. The system needs transparent limits, staged reveal options, abuse handling, and explicit evaluation of trust.

### Implementation delta

The current `Participant.isHidden` flag is insufficient. Add:

- identity policy and reveal events;
- per-object visibility;
- contribution workflow;
- first-attempt capture;
- private pre-submit articulation;
- permission-aware synthesis;
- recipient pacing and clarification.

### Evaluation

Compare named, pseudonymous, and staged-reveal conditions. Measure specificity, evidence use, criticality, perceived safety, trust, incivility, willingness to clarify, and subsequent peer conversation.

## Version 4 — Jury Bridge

**Selected for a diagram**
**Score: 16/18**

### Thesis

The high-stakes jury should be supported as two linked information moments:

1. **presence during critique**, where the system minimizes note-taking and knowledge gaps; and
2. **deliberation after critique**, where the student reconstructs meaning and chooses actions.

### How it works

#### Live bridge

The public surface remains minimal. The student’s private device can provide:

- stable speaker-attributed captions;
- “save this phrase” without leaving the conversation;
- optional plain-language expansion;
- proper-noun and precedent detection;
- a quiet queue of references to review later;
- a “clarify after” marker;
- no generated answer that speaks for the student.

Reference retrieval must distinguish:

- exact identified work/person;
- possible match;
- unknown reference.

It should never invent an architect, building, or citation.

#### Post-jury bridge

After a deliberate cool-down period:

1. The student reviews saved phrases and source-linked AI clusters.
2. Contradictory juror positions remain separate.
3. Abstract comments are converted into candidate interpretations, not definitive meanings.
4. Each candidate action shows:
   - source phrases;
   - relevant intent/criterion;
   - referenced artifact region;
   - uncertainty;
   - who owns the next step.
5. The student accepts/adapts/defers/rejects each material claim.
6. The system produces a student-edited action plan and questions for the next tutor meeting.

### Accessibility model

The bridge offers:

- captions with adjustable density;
- high-contrast and low-distraction modes;
- keyboard/screen-reader operation;
- plain-language and terminology views;
- transcript audio replay by source segment;
- no forced real-time response;
- export to text, visual map, and audio summary using licensed voices.

### Information model

```text
JuryEvent
  ├─ SourceTurn
  ├─ SavedMoment
  ├─ NamedEntityCandidate
  │    └─ VerifiedReference
  ├─ ClarificationMarker
  ├─ InterpretationCandidate
  ├─ ContradictionSet
  └─ StudentActionPlan
```

### Why it may be novel

Meeting assistants summarize and retrieve information, and classroom systems analyze explanations. The differentiation is the **two-tempo jury design, architecture-reference verification, explicit contradiction preservation, and student-controlled conversion from abstract critique to action**.

### Main risk

Real-time reference cards can distract from eye contact or falsely legitimize a tentative entity match. The default should save references silently for later, with live expansion only on request.

### Implementation delta

- entity/reference extraction and verified retrieval;
- transcript-span saving;
- post-jury workspace;
- contradiction sets;
- student dispositions/actions;
- accessibility evaluation;
- privacy-preserving segment replay.

### Evaluation

Compare handwritten notes, transcript-plus-summary, and Jury Bridge. Test delayed recall, correct reference identification, action-plan specificity, cognitive load, eye contact/attention, and student confidence in their own interpretation.

## Version 5 — Reflective Twin

**Selected for a diagram**
**Score: 17/18**

### Thesis

A multimodal system should not pretend to “understand” or grade architecture. It should maintain a **reflective twin**: a versioned representation of what the student says the artifact should do, what the artifact visibly contains, what critics claim, and where those sources agree or diverge.

### Inputs

- student intent;
- drawings, diagrams, renderings, models, and selected CAD/BIM exports;
- student-authored artifact-region annotations;
- critique transcript;
- verified project constraints and references;
- prior revisions.

### How it works

#### Before AI interpretation

The student annotates key artifact regions and makes a first claim:

- “This threshold should slow entry.”
- “The section should maintain visual connection while separating sound.”

The system captures the claim before offering help, preserving learner effort.

#### Reflective comparison

For a selected claim and region, the twin assembles:

- declared intent;
- observable visual/spatial cues;
- relevant human critique phrases;
- conflicting evidence;
- missing evidence.

The AI can respond in four modes:

1. **Mirror** — restate the apparent relationship without advice.
2. **Question** — ask a Socratic “what would we expect to see if…” question.
3. **Counter-reading** — present another plausible interpretation with source evidence.
4. **Test design** — help define a representation, prototype, or user test that could resolve uncertainty.

It cannot output a quality score or final design direction.

#### Revision

The student links changed artifact regions to feedback claims, records whether intent changed, and identifies the next uncertainty. The twin therefore evolves with the design rather than operating on a one-off screenshot.

### Information model

```text
ReflectiveTwin
  ├─ IntentRevision
  ├─ ArtifactRevision
  │    └─ RegionAnchor
  ├─ StudentFirstClaim
  ├─ ObservableFeature
  ├─ HumanFeedbackClaim
  ├─ EvidenceConflict
  ├─ SocraticPrompt
  ├─ TestProposal
  └─ RevisionResponse
```

### Why it may be novel

Critsly is artifact-aware, while DCAI and ArchiJury use multimodal models for design critique. The differentiation is the **non-evaluative twin ontology, required first-attempt capture, explicit separation of observation from interpretation, and longitudinal connection to human critique and revision**.

### Main risk

The system may still hallucinate spatial relations or steer students toward model-average aesthetics. Every observable feature must be inspectable, correctable, and represented as uncertain. Evaluation must include design-diversity and dependency measures.

### Implementation delta

- project/artifact/revision storage;
- region anchors;
- multimodal model adapter;
- first-attempt capture;
- observation/interpretation separation;
- twin modes and fading;
- connection to Intent Ledger.

### Evaluation

Compare:

1. generic multimodal chatbot;
2. artifact-aware AI critic;
3. Reflective Twin.

Measure observation accuracy, unsupported inference, student correction, reasoning depth, design diversity, transfer without AI, and preference for human critique.

## Version 6 — Stakeholder Rehearsal Lab

**Not selected for a diagram**
**Score: 11/18**

### Thesis

Students rehearse a critique by testing their project narrative against multiple stakeholder perspectives without simulating a definitive professor or “star architect.”

### Operation

1. Student selects grounded stakeholder roles such as client, occupant, accessibility reviewer, contractor, planner, or maintenance team.
2. Each role receives only verified project context and its legitimate decision scope.
3. The role asks questions and reveals assumptions rather than issuing a score.
4. A “role boundary” panel shows what the simulated stakeholder cannot know.
5. The student must answer before seeing AI suggestions.
6. A synthesis view identifies:
   - shared constraints;
   - irreducible conflicts;
   - assumptions to verify;
   - questions for real stakeholders.

### Novelty test

Critsly already includes multi-perspective critique, stakeholder simulation appears in the participatory-design literature, and role-playing LLMs are established. The role-boundary and evidence-grounding mechanism is useful but not the strongest standalone novelty.

### Research use

Treat as a module inside Reflective Twin, not the main contribution.

## Version 7 — Critique Observatory

**Not selected for a diagram**
**Score: 10/18**

### Thesis

Educators need curriculum-level visibility into whether feedback is clarified, acted upon, or repeatedly lost—without converting students into scores or exposing private reflection.

### Operation

The observatory aggregates consented provenance events:

- feedback themes across assignments;
- time from critique to student disposition;
- unresolved questions;
- revision evidence;
- requests for clarification;
- gaps in professor follow-up;
- distribution of critique opportunities.

It does not display:

- personality, emotion, competence, creativity, or risk scores;
- raw private chats by default;
- rankings of students;
- participation as a grade proxy.

Students can inspect the same records and see why any aggregate includes them. Small-group suppression and minimum cohort thresholds reduce re-identification.

### Novelty test

CADA, meta-reflective dashboards, Critsly educator evidence views, and general learning analytics already occupy much of this space. The governance constraints and provenance focus matter, but the version is better framed as an institutional layer of Intent Ledger.

## Comparative scorecard

| Rank | Version | Research fit | Interaction | Agency | Provenance | Method | Differentiation | Total |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Intent Ledger | 3 | 3 | 3 | 3 | 3 | 3 | **18** |
| 2 | Reflective Twin | 3 | 3 | 3 | 3 | 3 | 2 | **17** |
| 3 | Jury Bridge | 3 | 3 | 3 | 3 | 2 | 2 | **16** |
| 4 | Live Critique Mirror | 3 | 3 | 3 | 2 | 2 | 2 | **15** |
| 5 | Studio Commons | 3 | 2 | 3 | 2 | 2 | 2 | **14** |
| 6 | Stakeholder Rehearsal Lab | 2 | 2 | 2 | 2 | 2 | 1 | **11** |
| 7 | Critique Observatory | 2 | 1 | 2 | 2 | 2 | 1 | **10** |

## Recommended synthesis

Build **Intent Ledger** as the durable core. Treat the other selected versions as bounded interfaces around it:

```text
Studio Commons ─┐
                ├─→ Intent Ledger ←─ Reflective Twin
Live Mirror ────┤         ↑
                └─→ Jury Bridge
```

- **Live Mirror** captures and structures the moment.
- **Studio Commons** governs peer identity, audience, and pacing.
- **Jury Bridge** supports high-stakes comprehension and post-event action.
- **Reflective Twin** connects speech and intent to artifact evidence.
- **Intent Ledger** preserves the full reasoning and revision lineage.

Stakeholder Rehearsal becomes a Reflective Twin mode. Critique Observatory becomes an optional, privacy-preserving aggregate view over the ledger.

## Recommended system name and one-sentence definition

**Huddle Critique Ledger**

> An agency-preserving information system that links co-present architecture critique to versioned design intent, student judgment, and artifact revision while keeping every AI interpretation provisional, source-traceable, audience-aware, and correctable.
