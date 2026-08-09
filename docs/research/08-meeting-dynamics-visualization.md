# Visualizing live meeting dynamics without scoring people

**Research date:** 2026-08-09  
**Evidence scope:** peer-reviewed group-interaction, visualization, NLP, and
mixed-reality research, supplemented by current meeting-product patterns.  
**Design question:** how can Huddle show whether a conversation is concentrated,
branching, converging, or failing to connect while preserving uncertainty and
participant agency?

## Executive conclusion

Huddle should visualize **observable coordination**, not presumed concentration,
engagement, emotion, or meeting quality. A safe and useful live view combines:

1. a short-horizon **dynamics ribbon** showing topic continuity, branches,
   returns, speaker transitions, and process phase over time;
2. an evidence-linked **meaning map** showing issues, proposals, criteria,
   questions, responses, tensions, decisions, and actions; and
3. a compact **participation and response view** showing whose contributions are
   entering the conversation and whether they receive responses.

No single score can distinguish productive exploration from confusion. The same
surface pattern can mean different things in divergent ideation, evaluation, and
decision phases. The interface therefore needs multiple transparent measures,
phase-aware language, source access, uncertainty, and a human-controlled public
boundary.

## What can and cannot be inferred

“Are speakers concentrating on the same topic?” has two meanings:

- **Cognitive attention** is an internal state. Transcript, gaze, prosody, and
  turn-taking are imperfect proxies and do not justify claims that a person is
  attentive, disengaged, emotional, or performing well.
- **Conversational concentration** is observable. Huddle can estimate whether
  recent turns share a topic, respond to one another, reference the same proposal,
  or form separate branches. It should label these as properties of the captured
  conversation, not properties of people.

This distinction matters because automated emotion recognition remains contested
across contexts and cultures. The system should not revive that problem through a
friendlier label such as “focus,” “energy,” or “engagement.” The existing Huddle
contract—exact source quotes, target-specific stance, visible uncertainty, no
person scoring, and facilitator review—is the right foundation.

## A measurement vocabulary for live dynamics

| Question | Observable measure | Suitable visual | Unsafe shortcut to avoid |
| --- | --- | --- | --- |
| Are recent turns about the same subject? | Topic concentration, active-topic share, topic-switch rate, and return-to-topic events over a rolling window | Colored topic bands in a time ribbon, with explicit branch and return markers | “Everyone is focused” |
| Are people responding to one another? | Response-link coverage, unresolved questions, ignored proposals, and cross-speaker reference chains | Thin arcs or edge counts; select to reveal turn evidence | A global cohesion score |
| Is the conversation exploring or settling? | Idea birth rate, branch count, comparison activity, decision/action emergence, and phase-relative trend | Phase-aware label such as “exploring: three active branches” | Treating all divergence as failure |
| Are positions different? | Target-specific support, challenge, qualification, and uncertainty attached to a proposal or decision | Stance marks around the selected target | Participant sentiment or a meeting-wide agreement meter |
| Is participation broadly distributed? | Recent speaking-time share, turn-entry opportunities, interruption/overlap estimates, and response received | Small multiples with an explicit time window | Ranking speakers or prescribing equal airtime |
| Is evidence being connected to claims? | Source-grounded support/challenge relations and unresolved evidence needs | Evidence edges and open-loop markers | Binary “verified” badges for conversational claims |
| Is the group attending to the same artifact? | Explicit references, selections, annotations, and—only with consent—shared gaze regions | Shared pointers or spatial landmarks | Inferring intent from gaze alone |

Every measure should expose its time window and confidence. “Last 90 seconds:
two active topic branches” is interpretable; “alignment 63” is not.

## Three kinds of divergence

The interface must keep three phenomena separate:

1. **Topic divergence** — turns form multiple semantic branches or switch away
   from the current subject.
2. **Position divergence** — speakers support, challenge, or qualify the same
   proposal.
3. **Process divergence** — the discussion pattern differs from the facilitator's
   current phase or goal, such as opening new alternatives during a decision pass.

Productive design work intentionally alternates divergence and convergence.
Research on collaborative design describes these transitions as iterative rather
than a one-way march, and studies of productive disciplinary engagement show that
divergent ideas can be resources for later integration. Huddle should therefore
use neutral state descriptions—“branching,” “comparing,” “returning,” “settling,”
and “unresolved”—instead of traffic-light judgments.

## What adjacent fields contribute

### Conversation and group-dynamics displays

The [Conversation Clock](https://www.researchgate.net/publication/221179350_Conversation_Clock_Visualizing_audio_patterns_in_co-located_groups)
made turn-taking and overlap visible as a shared temporal pattern. Peripheral
feedback experiments by [Sturm and colleagues](https://research.tue.nl/en/publications/influencing-social-dynamics-in-meetings-through-a-peripheral-disp/)
showed that a simple ambient display can influence meeting behavior, while MIT's
[Meeting Mediator](https://www.media.mit.edu/publications/meeting-mediator-enhancing-group-collaboration-with-sociometric-feedback-2/)
used sociometric signals to provide real-time feedback. Together, these projects
support legible group-level feedback but also show that the display becomes an
intervention: visibility can change turn-taking and must be evaluated for social
pressure and gaming.

Work on collective intelligence found an association between group performance,
social sensitivity, and a more even distribution of conversational turn-taking
([Woolley et al., 2010](https://pubmed.ncbi.nlm.nih.gov/20929725/)). That result
does not establish an ideal airtime quota for each meeting. Speaking opportunity,
role, phase, accessibility needs, and whether contributions receive uptake are
more useful than a leaderboard.

Language-style matching research associates coordination in linguistic form with
relationship and group outcomes
([Gonzales, Hancock, and Pennebaker, 2010](https://journals.sagepub.com/doi/10.1177/0093650209351468)).
For Huddle this motivates aggregate, uncertain response-cohesion indicators—not
claims that an individual agrees or belongs.

### Topic, relation, and stance visualization

[ThemeRiver](https://www.pnnl.gov/publications/themeriver-visualizing-thematic-changes-document-collections)
demonstrated how changing thematic prominence can be shown over time. A live
meeting needs a much smaller version: stable topic colors, a 60–90 second horizon,
and explicit births, splits, merges, and returns rather than a dense global
streamgraph.

[ConToVi](https://doi.org/10.1111/cgf.12919) combines conversation structure,
topics, and sentiment in a coordinated visual analysis. Its multi-view approach
supports separating time, participants, and content, but Huddle should omit
sentiment inference and reduce analytical density for live use.

[MeetingVis](https://pubmed.ncbi.nlm.nih.gov/29723141/) uses interactive visual
analysis to expose meeting structure and content. Its strongest transferable
pattern is overview-to-evidence navigation: show a compact state, then let a user
inspect the turns that support it.

NLP research on multiparty dialogue demonstrates that thread and addressee
structure matters when conversations intertwine
([Zhang et al., 2018](https://aclanthology.org/D18-2017/)). Semantic similarity
alone can mistake adjacent but unconnected turns for convergence. Huddle's model
should combine topic continuity with response/addressee links and explicit
references.

[MeetMap](https://arxiv.org/abs/2502.01564) explores LLM-generated, dynamically
updated meeting maps. It reinforces a core interaction lesson: synchronicity and
stability matter. A map that visibly rearranges on every utterance consumes the
attention it is intended to protect. Huddle should keep node identity and layout
stable, apply small validated patches, and reserve reconciliation for slower
background passes.

### Divergence, convergence, and facilitation

Studies of [productive disciplinary engagement](https://pmc.ncbi.nlm.nih.gov/articles/PMC5668127/)
show why disagreement and diverse ideas should remain visible rather than be
compressed into consensus. Research characterizing
[divergent and convergent design cycles](https://pmc.ncbi.nlm.nih.gov/articles/PMC10320853/)
likewise supports phase-sensitive interpretation.

Early work on automatic real-time meeting feedback reports both promise and the
risk that frequent recommendations distract or over-direct participants
([Kim et al., 2020](https://arxiv.org/abs/2011.06529)). More recent CHI work asks
whether conversational systems can help groups notice if they are “on track”
([CHI 2025 paper](https://doi.org/10.1145/3706598.3714052)). The prudent product
pattern is a private facilitator cue, grounded in recent turns, with rate limits
and a dismiss/act boundary—not an AI interruption directed at the room.

### AR, mixed reality, and shared attention

Mixed-reality collaboration research shows that spatial embodiment and common
reference points can improve remote collaboration. Examples include Microsoft's
[Room2Room](https://www.microsoft.com/en-us/research/publication/room2room-enabling-life-size-telepresence-in-a-projected-augmented-reality-environment/),
studies of [awareness cues in collaborative virtual environments](https://pmc.ncbi.nlm.nih.gov/articles/PMC7805624/),
and work on [gaze awareness in mixed reality](https://doi.org/10.1145/3555564).
Research on [shared virtual landmarks](https://pure.au.dk/portal/en/publications/remote-collaboration-with-mixed-reality-displays-how-shared-virtu/)
suggests that stable spatial anchors help collaborators orient around common
objects.

The design implication is not to float every analysis around each participant.
AR should use one or two stable, shared anchors: speaker-linked captions near a
neutral shared plane, a small topic/decision landmark near the referenced
artifact, and private facilitator cues at the periphery. Gaze should be used only
as a consented awareness cue or selection signal, never as proof of attention.

### Current product patterns

Commercial tools show which interactions are becoming familiar, not which
inferences are scientifically valid:

- [Microsoft Teams intelligent recap](https://support.microsoft.com/en-us/office/recap-in-microsoft-teams-7f3f1e05-836a-4b59-a3f5-8f00bf7f9db8)
  and [Speaker Coach](https://support.microsoft.com/en-us/office/speaker-coach-in-microsoft-teams-meetings-30f50d15-5f62-4e09-b3bf-cadeb806386a)
  separate after-meeting artifacts from private speaking feedback.
- [Zoom Revenue Accelerator conversation metrics](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067351)
  illustrate demand for talk/listen and question metrics, while also illustrating
  the risks of converting context-dependent behavior into performance scores.
- [Apple Vision Pro spatial collaboration](https://www.apple.com/apple-vision-pro/)
  and [Meta Horizon Workrooms](https://forwork.meta.com/horizon-workrooms/)
  normalize spatial presence and shared work surfaces. Their reusable pattern is
  stable placement, not a cockpit of analytical overlays.

## Recommended Huddle information architecture

### 1. Dynamics ribbon: “what is changing now?”

Place a narrow, persistent 60–90 second ribbon above the transcript:

- stable topic-color bands sized by recent conversational coverage;
- speaker ticks and overlap indicators, without rank ordering;
- branch, merge, return, unresolved-question, and decision markers;
- the facilitator's current phase as context; and
- an “analyzed through” marker plus uncertainty for pending turns.

Selecting a segment should filter, not replace, the transcript. The default label
should be descriptive: “two active branches; one returned to the access issue.”

### 2. Meaning map: “how do the ideas connect?”

Use Huddle's existing typed nodes and relations, but render a stable overview:

- cluster issues/needs, proposals, evidence/criteria, and commitments;
- show supports, challenges, responds-to, depends-on, tests, and addresses edges;
- attach support/challenge/qualification to a specific selected target;
- reveal exact source quotes and confidence on demand;
- animate only the affected nodes when applying a patch; and
- retain minority and unresolved positions through revisions.

The map is a revisable interpretation, not a transcript replacement. The
facilitator remains the authority for edits and publication.

### 3. Participation and response strip: “whose input is entering the work?”

In the private facilitator view, show small multiples for a stated rolling window:

- speaking-time range and turn entries;
- questions asked and responses received;
- contributions with and without an observed response link;
- overlap/interruptions as uncertain acoustic events; and
- speaker-identification confidence and correction status.

Prefer neutral prompts such as “A proposal has not received a response” over
“Alex is disengaged.” Do not expose a participant ranking on the shared display.

## A transparent dynamics model

Huddle can compute a state vector rather than one opaque score:

```text
topic concentration  = share of recent substantive turns assigned to active topic(s)
topic switching      = topic-boundary events / eligible turn transitions
response cohesion    = grounded response links / eligible substantive turns
branch pressure      = active unresolved topic branches, weighted by recency
speaker coverage     = speakers contributing to each active branch / present speakers
resolution progress  = grounded question/proposal transitions toward decision or action
```

These values should be calibrated against annotated meetings. They are inputs to
plain-language state descriptions, not claims of truth or meeting quality. Topic
assignment and response links need confidence thresholds; low-confidence items
remain pending or visually muted.

## State vocabulary

Use composable descriptions rather than categorical verdicts:

- **Concentrated:** most recent substantive turns concern one active topic and
  contain response links.
- **Branching:** a new topic or proposal thread is sustained across multiple
  turns.
- **Parallel:** multiple branches remain active without observed cross-links.
- **Integrating:** a turn compares, connects, or synthesizes two branches.
- **Returning:** the conversation revisits an earlier branch after another topic.
- **Settling:** target-specific positions and actions/decisions are becoming more
  explicit.
- **Open loop:** a question, challenge, evidence request, or proposed action has
  not yet received an observed response.
- **Uncertain:** transcript, speaker, or semantic confidence is too low for a
  stronger description.

More than one state may apply. For example: “branching and integrating” can be a
healthy ideation pattern.

## Safety, accessibility, and governance

Research on [emotion-recognition validity](https://pmc.ncbi.nlm.nih.gov/articles/PMC6640856/)
and [workplace monitoring privacy](https://journals.sagepub.com/doi/10.1177/23294884211037009)
supports a conservative inference boundary. Huddle should:

- describe conversation structure, never diagnose emotion, intent, attention,
  competence, dominance, or personality;
- keep private coaching private and require review before public display;
- show exact sources, uncertainty, corrections, and data freshness;
- support pseudonymous or role labels and configurable retention;
- avoid color-only encoding, motion that cannot be reduced, and dense AR overlays;
- allow transcript and speaker correction to propagate through derived states;
- test for dialect, language, role, gender, disability, and cultural bias; and
- provide an immediate “analysis off” mode without stopping capture when policy
  permits the transcript to continue.

Cross-cultural research cautions against assuming that one conversational norm
fits all groups. Silence, overlap, direct disagreement, and turn distribution have
different meanings across settings; thresholds and prompts must be locally
configurable and empirically evaluated.

## Evaluation sequence

1. **Offline validity:** annotate topic boundaries, response/addressee links,
   target-specific stance, branch/merge events, and source grounding. Report
   per-class precision/recall, boundary tolerance, confidence calibration, and
   failure slices—not only aggregate accuracy.
2. **Temporal performance:** measure finalized-turn-to-patch latency, state
   freshness, revision churn, layout movement, dropped updates, and cost per
   meeting minute.
3. **Usability:** compare transcript-only, dynamics ribbon, and ribbon-plus-map
   conditions. Measure comprehension, source-checking success, interruption,
   cognitive load, and correction burden.
4. **Meeting effects:** study whether private facilitator cues improve response to
   open loops or participation opportunities without increasing conformity,
   self-censorship, anxiety, or facilitation dependency.
5. **AR only after 2D evidence:** compare shared anchor, private peripheral cue,
   and no-overlay conditions for task success, attention switching, comfort, and
   accessibility.

Pre-register which states are expected in each meeting phase. The success target
is not maximum convergence; it is faster, more accurate shared understanding of
what the group is doing and what remains unresolved.

## Design decision for Huddle

The next implementation should prioritize the 2D facilitator experience:

1. wire already-computed live intelligence and prompt events into a compact,
   collapsible surface;
2. add a topic/response dynamics ribbon with explicit freshness;
3. expose existing meeting-state relations and target-specific stances through
   stable selection interactions;
4. update the map through small, source-validated deltas; and
5. publish only facilitator-reviewed content to the shared display.

AR should follow only if this information hierarchy proves useful on a normal
screen. The two raster concepts in `workspace/` are useful explorations, but their
dense floating panels, sentiment language, speaker scoring, fallacy counters, and
binary verification motifs should not define the implemented experience.

## Selected references

Peer-reviewed and research references are weighted above product documentation.
Preprints are identified by their linked venue and should be treated as emerging
evidence.

- Bergstrom, T., and Karahalios, K. “Conversation Clock: Visualizing audio
  patterns in co-located groups.” *HICSS*, 2007.
- Sturm, J. et al. “Influencing social dynamics in meetings through a peripheral
  display.” *ICMI*, 2007.
- Kim, T. et al. “Meeting Mediator: Enhancing group collaboration using
  sociometric feedback.” *CSCW*, 2008.
- Woolley, A. W. et al. “Evidence for a collective intelligence factor in the
  performance of human groups.” *Science*, 2010.
- Gonzales, A. L., Hancock, J. T., and Pennebaker, J. W. “Language style matching
  as a predictor of social dynamics in small groups.” *Communication Research*,
  2010.
- Havre, S., Hetzler, B., and Nowell, L. “ThemeRiver: Visualizing theme changes
  over time.” *IEEE InfoVis*, 2000.
- El-Assady, M. et al. “ConToVi: Multi-party conversation exploration using topic
  space views.” *Computer Graphics Forum*, 2016.
- Shi, Y. et al. “MeetingVis: Visual narratives to assist in recalling meeting
  context and content.” *IEEE TVCG*, 2018.
- Zhang, R. et al. “A structured model for multi-party conversation.” *EMNLP*,
  2018.
- MeetMap. “Real-time collaborative dialogue mapping with LLMs.” arXiv, 2025.

