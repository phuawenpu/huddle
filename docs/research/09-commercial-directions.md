# Commercial directions: matching the implemented system to evidenced demand

**Date:** 2026-08-11
**Evidence standard:** peer-reviewed literature is weighted above vendor
marketing. Every demand claim below is anchored either to a peer-reviewed
source (with DOI) or to the vendor pricing/packaging evidence already
collected in
[06-product-and-investor-assessment.md](06-product-and-investor-assessment.md).
Market-size figures from analyst firms are deliberately excluded: they are
not peer-reviewed, are rarely reproducible, and are not needed for the
directional conclusions here.

## What the system provably does today

From the codebase audit
([02-codebase-audit.md](02-codebase-audit.md)):

- live room capture → streaming ASR + diarization → persisted, correctable,
  speaker-attributed transcript;
- a dual surface: private facilitator control + restrained public display;
- intent-scoped, whole-transcript synthesis with exact-quote grounding and a
  deterministic fallback;
- consent-driven visual evidence capture linked to the timeline;
- a scenario → TTS → mixed-audio simulation harness with WER/DER scoring;
- single-process deployment (Next.js + SQLite) that one customer can
  self-host.

## Demand signals with peer-reviewed weight

1. **Meetings are a measured cost center with known failure modes.**
   Rogelberg et al. (2006, *Journal of Applied Psychology*,
   <https://doi.org/10.1037/0021-9010.91.1.83>) link meeting time demands to
   employee well-being, and workplace-meeting science (Mroz et al., 2018,
   *Current Directions in Psychological Science*) shows effectiveness depends
   on design, facilitation, and follow-through — precisely the surfaces this
   product instruments.
2. **Shared, non-judgmental displays change group behavior.** A direct
   experimental lineage — shared participation displays (DiMicco et al.,
   2004, <https://doi.org/10.1145/1031607.1031713>), face-to-face awareness
   (DiMicco et al., 2007, <https://doi.org/10.1080/07370020701307781>),
   sociometric feedback (Meeting Mediator, Kim et al., 2008, CSCW),
   peripheral audio visualization (Conversation Clock, 2007,
   <https://doi.org/10.1109/hicss.2007.151>), and language-behavior feedback
   (GroupMeter, 2009, <https://doi.org/10.1145/1518701.1518784>) — shows
   participation and self-regulation shift when discourse structure is made
   visible without scoring people. That is exactly the product's public
   display contract.
3. **Verbal feedback has a documented uptake problem.** Feedback improves
   outcomes only under specific conditions (Gibbs & Simpson, 2005), and
   uptake depends on receiver feedback literacy (Carless & Boud, 2018,
   <https://doi.org/10.1080/02602938.2018.1463354>). A system that makes
   feedback persistent, specific, source-linked, and revisit-able targets
   the mechanism, not the symptom.
4. **Design critique is structured and teachable.** Oh et al. (2012,
   *Design Studies*, <https://doi.org/10.1016/j.destud.2012.08.004>) provide
   a framework of critiquing moves the extraction schema can target, and
   design thinking has a peer-reviewed practice review (Micheli et al.,
   2018, <https://doi.org/10.1111/jpim.12466>).
5. **Structured short sync meetings have evidence in safety-critical
   industries.** Multidisciplinary healthcare huddles show measured
   effectiveness (*Journal of Multidisciplinary Healthcare*, 2022,
   <https://doi.org/10.2147/jmdh.s384554>), and their documentation and
   follow-up burden is a recognized gap.
6. **The technical risks are also peer-reviewed.** Diarization degrades with
   overlap, short turns, distant mics, and 3+ speakers (Anguera et al.,
   2012, <https://doi.org/10.1109/tasl.2011.2125954>; Park et al., 2021,
   <https://doi.org/10.1016/j.csl.2021.101317>), and AI-mediated
   communication redistributes agency (Hancock et al., 2020, JCMC). These
   are the product's guardrails and its evaluation harness, not footnotes.

## Ranked commercial directions

### 1. Design and architecture education (current home) — defend and productize

- **Fit today:** live/simulated critique HUD, scenario library for teaching
  facilitation, grounded synthesis, mobile-first display.
- **Buyer:** design schools, architecture programs, university teaching
  centers.
- **Extend:** artifact anchoring (pin claims to images/boards), longitudinal
  critique-to-revision provenance across a semester, cohort analytics for
  educators, LMS export.
- **Evidence anchors:** Oh et al. 2012; Carless & Boud 2018; GenAI-feedback
  review 2024 (<https://doi.org/10.24059/olj.v28i3.4593>); adjacent systems
  (Critsly; MeetMap) as positioning, not blockers.
- **Revenue shape:** per-program annual license + self-hosted option. Low
  ARPU, high credibility; the reference customer for every other vertical.

### 2. Professional design reviews in AEC and product-design firms

- **Fit today:** a design crit and an internal design review are the same
  conversational form; intent = project brief; criteria = review checklist.
- **Buyer:** architecture/engineering studios, product design agencies.
- **Extend:** artifact region anchoring, action/decision export into issue
  trackers (the "second half of the bridge" from the investor assessment),
  firm-wide review memory, SSO/retention controls for procurement.
- **Evidence anchors:** design-review practice (Micheli et al. 2018);
  artifact-review workflow occupancy (Figma comments — see 06).
- **Revenue shape:** per-seat SaaS; this is the strongest near-term revenue
  vertical because reviews recur weekly and feedback-to-action continuity is
  directly billable time saved.

### 3. Facilitated workshops: design sprints, retrospectives, requirements workshops

- **Fit today:** intent-scoped analysis, open loops, decisions, actions, and
  dissent preservation map directly onto facilitation artifacts; the
  dialogue-mapping lineage (gIBIS, Conklin & Begeman 1988,
  <https://doi.org/10.1145/58566.59297>) is literally rooted in requirements
  and policy deliberation; facilitator agents are a studied category (Itō et
  al., 2021, <https://doi.org/10.1007/s10726-021-09765-8>).
- **Buyer:** independent facilitators, consultancies, corporate L&D.
- **Extend:** session templates per method (sprint, retro, IBIS mapping),
  branded client deliverables (PDF/Notion export), multi-session engagement
  memory.
- **Revenue shape:** per-facilitator subscription; viral pull-through when
  participants see the shared display.

### 4. Healthcare team huddles and safety briefings

- **Fit today:** short, structured, recurring spoken syncs with follow-up
  items — the open-loops and commitments extraction is the core value;
  effectiveness is already peer-reviewed (J. Multidisciplinary Healthcare,
  2022) while documentation burden remains manual.
- **Buyer:** hospital units, clinic groups.
- **Extend:** strict on-prem/self-host deployment (the single-process SQLite
  architecture is an asset here), retention policies, EHR-adjacent export,
  and a formal compliance review before any clinical claims. No diagnostic
  or patient-record features.
- **Revenue shape:** per-site license; long procurement, high retention.

### 5. Qualitative research and focus groups

- **Fit today:** speaker-attributed capture with correction and grounded
  thematic extraction addresses the transcription/coding burden; argument
  mining is a surveyed field (Lawrence & Reed, 2019,
  <https://doi.org/10.1162/coli_a_00364>).
- **Buyer:** market-research agencies, UX research teams.
- **Extend:** multi-session corpus analysis, codebook editing, QDA-tool
  export, stronger diarization for larger groups (the peer-reviewed weak
  point).
- **Revenue shape:** per-project pricing.

### 6. Facilitation-skills training and meeting coaching

- **Fit today:** talk-share, turn structure, and prompt history are feedback
  material for training facilitators — grounded in the shared-display
  self-regulation evidence (signal 2).
- **Buyer:** L&D departments, facilitation academies.
- **Extend:** post-session review timelines, cohort progress, rubric-based
  (human-scored) overlays. Care needed: keep analytics descriptive, never
  evaluative of persons, per the product's own guardrails.

## Directions to avoid

- **Generic meeting notetaking.** Teams Facilitator, Read AI, Granola, and
  Fathom occupy it at $5–$29/user/month (see 06). No peer-reviewed or
  market evidence supports entering head-on.
- **Automated assessment, sentiment, or personality analytics.** Contradicts
  the guardrails and the AI-mediated-communication ethics literature; also
  the least defensible legally.
- **Claims of bias detection or emotion inference.** Unsupported by the
  speech literature and prohibited by the product spec.

## Capability extensions ranked by commercial leverage

1. **Artifact anchoring + disposition workflow** — converts conversations
   into tracked work; unlocks verticals 2 and 3.
2. **Multi-session project memory** — converts single meetings into a
   durable record; unlocks retention pricing everywhere.
3. **Self-host / on-prem packaging** — unlocks vertical 4 and enterprise
   procurement; the architecture already supports it.
4. **Diarization robustness for 3–6 speakers** — the peer-reviewed weak
   point; gate marketing claims on the evaluation harness, and consider a
   post-session batch reconciliation pass as a paid accuracy tier.
5. **Export surface** (PDF brief, Notion/Linear/Jira, CSV) — low cost, high
   perceived value.

## Licensing and commercial model

The repository is licensed **AGPL-3.0 with an attribution additional term
(section 7(b)) plus a separate commercial-licensing option** (see
LICENSE.md). This is the copyleft dual-licensing model:

- anyone may use, modify, and deploy the software — including commercially —
  as long as they keep attribution and release their modified source,
  including for hosted/SaaS deployments (the AGPL network clause);
- organizations that want closed-source or obligation-free commercial use
  buy a commercial license from the maintainer.

Revenue therefore comes from four sources: commercial licenses for
proprietary use, the hosted SaaS operated by the maintainer, enterprise
features and support (SSO, retention, audit, deployment assistance), and the
fact that the maintained, evaluated, trademarked version remains the
canonical one. AGPL also acts as a competitive moat: a large vendor cannot
absorb the codebase into a closed competing product.

## Falsifiable gates before scaling spend

1. Five paying pilot customers in one vertical, using the system in real
   sessions ≥ 4 times in 60 days.
2. Facilitator correction burden under an agreed threshold per session
   (measure; do not assume).
3. Grounded-extraction acceptance rate after publish-review ≥ agreed
   threshold on real, not simulated, sessions.
4. At least one deployment where a decision or action extracted from a
   session is verifiably completed afterward (the provenance-loop proof).
5. Security review passed for the target vertical's procurement
   (dependencies, access control, retention).
