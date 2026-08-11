# Research synthesis: from meeting capture to governed critique intelligence

## Evidence base

This synthesis is grounded in peer-reviewed literature across HCI/CSCW,
design studies, the learning sciences, speech processing, and management
science. Key sources verified at writing time:

- Conklin & Begeman (1988), *gIBIS: a hypertext tool for exploratory policy
  discussion*, ACM Transactions on Information Systems.
  <https://doi.org/10.1145/58566.59297>
- DiMicco et al. (2004), *Influencing group participation with a shared
  display*, CSCW. <https://doi.org/10.1145/1031607.1031713>
- DiMicco et al. (2007), *The impact of increased awareness while
  face-to-face*, Human–Computer Interaction.
  <https://doi.org/10.1080/07370020701307781>
- Bergstrom & Karahalios (2007), *Conversation Clock: Visualizing audio
  patterns in co-located groups*, HICSS.
  <https://doi.org/10.1109/hicss.2007.151>
- Leshed et al. (2009), *Visualizing real-time language-based feedback on
  teamwork behavior* (GroupMeter), CHI.
  <https://doi.org/10.1145/1518701.1518784>
- Kim et al. (2008), *Meeting Mediator: enhancing group collaboration using
  sociometric feedback*, CSCW.
- Rogelberg et al. (2006), *"Not Another Meeting!" Are meeting time demands
  related to employee well-being?*, Journal of Applied Psychology.
  <https://doi.org/10.1037/0021-9010.91.1.83>
- Mroz, Allen, Verhoeven & Shuffler (2018), *Do we really need another
  meeting? The science of workplace meetings*, Current Directions in
  Psychological Science.
- Oh, Ishizaki, Gross & Do (2012), *A theoretical framework of design
  critiquing in architecture studios*, Design Studies.
  <https://doi.org/10.1016/j.destud.2012.08.004>
- Carless & Boud (2018), *The development of student feedback literacy:
  enabling uptake of feedback*, Assessment & Evaluation in Higher Education.
  <https://doi.org/10.1080/02602938.2018.1463354>
- Gibbs & Simpson (2005), *Conditions under which assessment supports
  students' learning*, Learning and Teaching in Higher Education.
- Micheli et al. (2018), *Doing Design Thinking: Conceptual Review,
  Synthesis, and Research Agenda*, Journal of Product Innovation Management.
  <https://doi.org/10.1111/jpim.12466>
- Lawrence & Reed (2019), *Argument Mining: A Survey*, Computational
  Linguistics. <https://doi.org/10.1162/coli_a_00364>
- Anguera et al. (2012), *Speaker Diarization: A Review of Recent Research*,
  IEEE TASLP. <https://doi.org/10.1109/tasl.2011.2125954>
- Park et al. (2021), *A review of speaker diarization: Recent advances with
  deep learning*, Computer Speech & Language.
  <https://doi.org/10.1016/j.csl.2021.101317>
- Hancock, Naaman & Levy (2020), *AI-Mediated Communication: Definition,
  Research Agenda, and Ethical Considerations*, Journal of
  Computer-Mediated Communication.
- Itō et al. (2021), *An Agent that Facilitates Crowd Discussion*, Group
  Decision and Negotiation. <https://doi.org/10.1007/s10726-021-09765-8>
- *The Effectiveness of Multidisciplinary Team Huddles in Healthcare*
  (2022), Journal of Multidisciplinary Healthcare.
  <https://doi.org/10.2147/jmdh.s384554>
- MeetMap (2025), *Real-Time Collaborative Dialogue Mapping with LLMs in
  Online Meetings*, Proceedings of the ACM on Human-Computer Interaction.
  <https://doi.org/10.1145/3711030>
- *Harnessing Generative AI for Automated Feedback in Higher Education*
  (2024), Online Learning. <https://doi.org/10.24059/olj.v28i3.4593>

## The research problem

Design critique, design review, and facilitated workshop conversations are
professionally important but structurally lossy:

- **ephemeral** — complex verbal feedback disappears or survives as
  fragmented notes;
- **cognitively dense** — participants listen, defend, interpret references,
  and plan changes at once;
- **socially risky** — peer feedback is softened by fear of offending, while
  expert-led reviews amplify power asymmetry;
- **context-dependent** — generic feedback misses the project's intent,
  constraints, visual evidence, and history;
- **discontinuous** — comments in one review are rarely connected to later
  revisions;
- **identity-laden** — critique of an artifact can be experienced as
  judgment of the person.

The intervention studied here is therefore not an improved chatbot. It is an
information system that changes how spoken critique is captured,
represented, governed, revisited, and acted upon.

## What the peer-reviewed literature establishes

### 1. Meetings are expensive and frequently ineffective

Meeting science shows that meetings consume a large share of professional
time, that time demands correlate with employee well-being concerns
(Rogelberg et al. 2006), and that design, facilitation, and follow-up
practices — not meeting volume alone — determine effectiveness (Mroz et al.
2018). Any system that improves capture, structure, and follow-through of
consequential meetings addresses a measured organizational problem rather
than a hypothetical one.

### 2. Shared real-time displays measurably change participation

A direct experimental lineage shows that ambient, non-judgmental mirrors of
discussion shape behavior: a shared participation display balanced speaking
time (DiMicco et al. 2004); awareness of sociometric signals changed
face-to-face interaction (DiMicco et al. 2007; Kim et al. 2008); peripheral
audio visualizations supported reflection in co-located groups (Bergstrom &
Karahalios 2007); and real-time language feedback altered teamwork behavior
(Leshed et al. 2009). This is the strongest published warrant for the
product's "cognitive mirror" stance: display structure, describe language,
and let humans adjust — do not score people.

### 3. Dialogue and argument mapping have a 35-year evidence lineage

IBIS-based hypertext tools (gIBIS, Conklin & Begeman 1988) established that
externalizing issues, positions, and arguments makes deliberation
inspectable. Argument mining has matured into a surveyed NLP field
(Lawrence & Reed 2019), facilitator agents have been evaluated in group
discussion (Itō et al. 2021), and LLM-driven real-time dialogue maps are an
active research area (MeetMap 2025). The gap these systems leave open is
not mapping itself but **governance**: who controls the map, how claims stay
anchored to source speech, and how disagreement survives summarization.

### 4. Design critique is a learnable practice with known structure

Design critiquing has a theoretical framework distinguishing critique types,
foci, and moves (Oh et al. 2012), and design thinking practice has been
conceptually reviewed with an explicit research agenda (Micheli et al.
2018). Feedback only improves outcomes under specific conditions — timely,
specific, actionable, and acted upon (Gibbs & Simpson 2005) — and uptake
depends on the receiver's feedback literacy (Carless & Boud 2018). Generative
AI feedback in education shows promise but documented quality, trust, and
over-reliance risks (Online Learning review, 2024). Together these imply:
the system's job is to make feedback **available, specific, source-linked,
and revisit-able**, while keeping judgment with humans.

### 5. Real-room speech technology has known, quantifiable limits

Speaker diarization reviews (Anguera et al. 2012; Park et al. 2021)
document error growth with overlapping speech, short turns, distant
microphones, and more than two speakers — exactly the conditions of a live
critique. A credible system must therefore expose attribution uncertainty,
support correction, and evaluate its own audio path against ground truth
rather than assume provider accuracy.

### 6. AI mediation shifts agency and must be designed for it

AI-mediated communication research (Hancock et al. 2020) frames the ethical
core: when AI shapes what people see of each other's communication, it
redistributes agency. The corresponding design obligations are provisional
and correctable outputs, visible provenance, restraint, and explicit human
control over publication — which this system adopts as non-negotiables.

## Derived non-negotiable system requirements

1. **Human judgment remains final.**
2. **Every AI interpretation is visibly provisional and correctable.**
3. **Every important AI claim links to source utterances and, where
   applicable, artifact evidence.**
4. **Stated intent is versioned; disagreement with intent is preserved, not
   erased.**
5. **The public surface describes discourse, not people.**
6. **Identity and audience are explicit permissions, not display-only
   styling.**
7. **AI intervention is restrained and mode-dependent.**
8. **The system records revisions and the human response to feedback.**
9. **Alternative and minority positions remain visible.**
10. **Transcription and human notes continue when AI analysis fails.**
11. **Simulation is unmistakably labeled and never reported as field
    performance.**
12. **Outcome claims require comparative human studies, not only
    model-agreement metrics.**

## Novel aspects of this research program

Stated precisely, the defensible contributions are:

### A. Critique mediation rather than artifact generation

Most applied AI work targets ideation, generation, optimization, or
automated evaluation. This program makes the **critique ecology itself** the
object of design: power, social risk, cognitive overload, feedback uptake,
and continuity.

### B. The dual-surface, agency-preserving mirror

A private facilitator surface with full capture and correction powers,
paired with a restrained public display, operationalizes the shared-display
findings (§2) under the agency obligations of AI-mediated communication (§6).

### C. The source-grounding gate

Every synthesized claim must carry exact verbatim anchors into the persisted
transcript, with deterministic fallback on invalid output. This converts the
argument-mining ambition (§3) into an auditable contract and directly
addresses documented GenAI feedback-quality risks (§4).

### D. The human-authored intent contract

Analysis runs only against a facilitator-authored, versioned objective.
Feedback is classified by its relationship to that intent; the system cannot
silently replace it. This is a concrete mechanism for preserving design
agency.

### E. The acoustic evaluation harness

Simulated multi-speaker critiques are rendered to real audio and driven
through the identical capture pipeline, then scored (WER/DER) against ground
truth. This treats the diarization limits in §5 as a measured engineering
property rather than marketing copy.

## Claims the literature does not yet establish for this system

The published evidence supports design requirements and hypotheses. It does
not yet demonstrate that this system:

- improves design quality, originality, or review outcomes;
- improves critical-thinking transfer or feedback literacy;
- reduces anxiety in a validated causal study;
- attributes speakers accurately in real rooms with 3+ overlapping voices;
- is preferred across institutions, cultures, or industries;
- prevents homogenization or dependency;
- is novel in a patent or exhaustive systematic-review sense.

These remain open empirical questions for the evaluation roadmap
([05-evaluation-roadmap.md](05-evaluation-roadmap.md)) and should stay
visible in every publication, demo, or sales claim.
