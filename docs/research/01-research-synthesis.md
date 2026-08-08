# Research synthesis: from AI production tool to critique infrastructure

## Sources and relationship between the studies

The local research corpus contains two complementary studies:

1. **Student Perceptions of Large Language Models Use in Self-Reflection and Design Critique in Architecture Studio**
   Mixed-methods study with 22 SUTD architecture students, including three surveys and seven follow-up interviews.

2. **Designing the dialogue: A participatory study to develop AI-mediated architecture critiques**
   Participatory-design study with 22 students using ideation, affinity mapping, prioritization, role play, and low-fidelity paper prototypes.

The source-paper PDFs are intentionally not retained in this repository.

The first paper establishes the problem and desired roles from students’ reported experience. The second converts those needs into interaction patterns and a proposed platform, Studioboard. Together they form a progression:

`lived critique problems → desired AI role → co-designed interface features → functional system hypothesis`

The studies do not yet provide a high-fidelity deployment or causal evaluation of learning outcomes. The current codebase is an attempt to operationalize part of that hypothesis.

## The research problem

Architecture studio critique is pedagogically important but simultaneously:

- **ephemeral** — complex verbal feedback disappears or survives as fragmented notes;
- **cognitively dense** — students listen, defend, interpret references, and plan changes at once;
- **socially risky** — peer feedback is softened by fear of offending, while juries amplify power asymmetry;
- **context-dependent** — generic feedback misses the project’s design intent, constraints, visual evidence, and studio history;
- **discontinuous** — comments in one review are rarely connected to later design revisions;
- **identity-laden** — critique of an artifact can be experienced as judgment of the person.

The proposed intervention is therefore not merely an improved chatbot. It is an information system that changes how critique is captured, represented, governed, revisited, and acted upon.

## Empirical findings that should govern the system

### 1. Students want a discussion partner, not an automated juror

In the perception study, 58% described the preferred LLM role as a discussion partner, compared with 16% as a tutor and 6% as a critic. Eighty-six percent preferred a balance of guidance and freedom. The system should therefore provoke reasoning, expose structure, and invite correction; it should not assign architectural truth or final quality.

**Design consequence:** use questions, comparisons, and traceable interpretations. Avoid grades, personality labels, definitive bias claims, or unqualified design verdicts.

### 2. The value of AI changes by critique mode

The three feedback domains have different information needs.

| Mode | Primary problem | Appropriate AI role | Inappropriate AI role |
|---|---|---|---|
| Self-reflection | Uncertainty about what to examine; “blank page” | Structured reflection, vocabulary, intent mirror, Socratic prompts | Supplying a design solution before the learner attempts reflection |
| Peer critique | Lack of confidence, vocabulary gaps, fear of offending, conflicting opinions | Optional articulation aid, audience/identity controls, synthesis, reciprocal clarification | Mandatory real-time moderator or personality/bias judge |
| Professor/jury critique | Cognitive overload, unfamiliar references, abstract comments, conflicting jurors | Speaker-attributed record, terminology/precedent linking, post-critique synthesis and action paths | Replacement for professor judgment or automated assessment |

This mode-dependence is an important contribution. A single undifferentiated chat interface conflicts with the findings.

### 3. AI is strongest as cognitive offloading and translation

The perception study reports that 97% found LLMs helpful for structuring thoughts and 92% said they prompted new questions. Students particularly valued turning scattered or abstract feedback into a coherent record and actionable next steps. In professor-led critique, 95% identified a post-critique reflection-partner role as ideal in one item, while another role-choice item placed post-critique support clearly ahead of preparation and real-time moderation.

**Design consequence:** the product’s center of gravity should be capture, synthesis, explanation, and revision planning—not content generation.

### 4. Context and specificity are the central technical weakness

Students reported generic feedback and misunderstanding of design intent across modes. In peer critique, over-generalized feedback and lack of context were the dominant AI limitations. Participants also emphasized weak spatial and visual understanding.

**Design consequence:** every interpretation should be grounded in an editable project frame:

- declared design intent;
- audience and user;
- project phase;
- criteria and constraints;
- referenced artifact or region;
- prior critique and revisions;
- speaker role and source utterance.

### 5. Identity and pacing are core architecture, not optional polish

Nearly every participatory-design wireframe included identity protection. Students proposed nicknames, anonymous showcases, private clarification, audience selection, and time to reflect before responding. The paper treats anonymity as system-wide rather than a simple on/off meeting preference.

**Design consequence:** identity, visibility, and timing must be represented in the data model and enforced for every artifact, utterance, comment, summary, and analytic view.

### 6. Intent alignment protects agency

Student wireframes captured design intent early and compared incoming feedback with it. This is not intended to reject criticism that conflicts with intent. Its function is to make the relationship explicit:

- aligned with intent;
- challenges an assumption inside the intent;
- proposes a different intent;
- concerns execution rather than intent;
- cannot be evaluated with available evidence.

**Design consequence:** intent is an editable, versioned object. The system must preserve both the original intent and later revisions, showing who changed what and why.

### 7. Longitudinal continuity is a first-class information need

Participants wanted curriculum mapping, progress views, task generation, and evidence that a later revision addressed earlier feedback. This changes the unit of analysis from an isolated meeting to a sequence of:

`intent → artifact → critique → interpretation → decision → revision → reflection`

**Design consequence:** the durable system object is a provenance graph, not a transcript or summary.

### 8. Accessibility is part of the contribution

Students noted that converting speech into text and visual representations could be particularly useful for auditory-processing differences or dyslexia. Plain-language explanations and delayed review also reduce the need to decode expert discourse under time pressure.

**Design consequence:** provide multiple representations, stable source links, plain-language expansion, adjustable density, keyboard and screen-reader operation, and a low-distraction public display.

## Participatory-design features

The second paper groups student concepts into six themes:

1. anonymity and identity control across modalities;
2. AI as synthesizer, translator, and multi-stakeholder simulator;
3. intent-alignment checking and structural scaffolding;
4. progress visualization and curriculum-level tracking;
5. project management and task generation;
6. reflection pacing and reduced-pressure engagement.

Its proposed Studioboard workflow adds:

- QR-based session entry;
- lecture objectives and personal learning goals;
- recording, transcription, and summaries;
- contextual comments anchored to transcript sections;
- “translate to simple terms” interaction;
- submission visibility controls;
- stakeholder-perspective critique;
- personalized exercises and weekly progress reports.

## Novel aspects of the research

The following claims are the most defensible when stated precisely.

### A. Critique mediation rather than artifact generation

Most architectural AI research has focused on ideation, image generation, form finding, technical optimization, or automated evaluation. These studies instead make the **critique ecology itself** the object of design: power, social risk, cognitive overload, feedback literacy, and continuity.

### B. One framework spanning three feedback ecologies

The research distinguishes self, peer, and professor-led critique while treating them as connected parts of one learning loop. That makes it possible to assign different AI authority, visibility, and timing in each mode.

### C. The student-authored intent contract

The system is anchored to the learner’s evolving intent rather than a fixed AI rubric. Incoming critique may align with or challenge that intent, but the AI cannot silently replace it. This is a concrete mechanism for preserving design agency.

### D. Identity control as critique infrastructure

The participatory artifacts do not treat anonymity as a generic privacy toggle. Identity control is tied to audience, modality, social risk, and accountability across devices and review stages.

### E. Critique-to-revision continuity

The curriculum-level vision connects feedback to later revisions and personal goals. This reframes analytics from measuring students as people to documenting how design reasoning and artifacts change.

### F. The “sports commentator” interaction stance

The AI makes the game legible without taking the player’s hand. In system terms, this implies descriptive, source-linked, interruptible, and low-authority outputs.

## Claims the research does not yet establish

The papers support design requirements and hypotheses. They do not yet demonstrate that the proposed system:

- improves design quality or originality;
- improves critical-thinking transfer;
- reduces anxiety in a validated causal study;
- detects bias reliably;
- understands spatial or visual architectural evidence;
- provides accurate speaker attribution in real juries;
- is preferred across institutions, cultures, or experience levels;
- prevents homogenization or dependency;
- is novel in a patent or exhaustive systematic-review sense.

The sample is small and institution-specific, all perception-study participants already used LLMs, and only seven took part in qualitative interviews. The participatory study produces low-fidelity concepts rather than a deployed system. These limitations should remain visible in every publication or demo claim.

## Derived non-negotiable system requirements

1. **Human judgment remains final.**
2. **Every AI interpretation is visibly provisional and correctable.**
3. **Every important AI claim links to source utterances and, where applicable, artifact evidence.**
4. **Design intent is versioned; disagreement with intent is preserved, not erased.**
5. **The public surface describes discourse, not people.**
6. **Identity and audience are explicit permissions, not display-only styling.**
7. **AI intervention is restrained and mode-dependent.**
8. **The system records revisions and the learner’s response to feedback.**
9. **Alternative and minority positions remain visible.**
10. **Transcription and human notes continue when AI analysis fails.**
11. **Simulation is unmistakably labeled and never reported as field performance.**
12. **Learning outcomes require comparative human studies, not only model-agreement metrics.**
