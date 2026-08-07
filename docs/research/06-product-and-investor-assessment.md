# Product and investor assessment: from meeting notes to a critique ledger

**Assessment date:** 2026-08-07  
**Evidence standard:** current product documentation, vendor pricing, the local
research corpus, source-code audit, automated tests, and a live Fly.io probe.

## Independent verdict

**Status: promising problem and credible technical wedge; not yet an investable
company.**

The repository should not be positioned as another AI meeting notetaker. That
market already has well-financed platform incumbents, low-cost specialists, and
feature-rich free tiers. The better product thesis is:

> Turn a spoken design review into a correctable, source-linked critique graph
> that survives the meeting and explains why an artifact changed.

This is narrower than “meeting intelligence” and more valuable than a summary.
It connects two workflows that are still commonly separated:

1. the spoken review, where criteria, evidence, concerns, alternatives,
   decisions, and commitments emerge; and
2. the artifact workflow, where comments, versions, issues, approvals, and
   revisions are managed.

The current code now proves the first half of that bridge: live or simulated
turns become bounded critique signals with exact source quotes; the public HUD
shows criterion coverage, open loops, alternatives, decisions, actions, and
evidence gaps. It does not yet prove the second half: there is no artifact
region, disposition, revision link, organizational permission model, or
multi-session project memory.

An investor should fund discovery only after paid design partners demonstrate
that this bridge changes review behavior and is used again. The next financing
gate is not a more elaborate demo. It is repeated, paid workflow adoption.

## What the market evidence does and does not establish

### Evidence that meeting capture is demanded — and commoditized

[Microsoft Teams Facilitator](https://support.microsoft.com/en-us/teams/copilot/facilitator-in-microsoft-teams-meetings)
already produces collaborative live notes, decisions, open questions, agenda
tracking, and tasks. It can capture in-person meetings from a phone with speaker
distinction and an actionable recap. This removes “works in a physical room”
from the defensible moat.

[Read AI meeting reports](https://www.read.ai/meeting-reports) include summaries,
action items, questions, transcripts, playback, participant metrics, uploads,
and in-person meeting capture. Its published plans place general meeting
intelligence in an accessible price band:
[Read Pro is listed at $19.75 monthly or $15 per month when billed annually](https://support.read.ai/hc/en-us/articles/22307341312275-What-are-the-different-paid-plans-that-Read-offers),
while [Read’s education offer starts at $5 per month on annual billing](https://www.read.ai/edu-pricing).

[Granola lists a $14 per-user monthly Business tier](https://www.granola.ai/pricing)
with shared folders, integrations, templates, and meeting history.
[Fathom lists individual and team tiers around $15–$29 per user per month](https://www.fathom.ai/pricing),
alongside a free notetaking offer.

These are vendor claims and list prices, not neutral market-share evidence.
They are still enough to reject a strategy based on transcripts, summaries,
talk-time charts, or generic action extraction.

### Evidence that artifact review is valuable — and already occupied

[Figma comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments)
are pinned to canvas regions, support replies and filtering, and can be
resolved when feedback has been addressed. Figma therefore owns the obvious
surface for asynchronous product-design feedback.

[Autodesk Forma Design Collaboration](https://www.autodesk.com/products/forma-design-collaboration/product-details)
and the surrounding Autodesk Construction Cloud workflow address design
coordination, review, issues, accountability, and project data. Autodesk’s own
discussion of
[issue resolution and clash avoidance](https://www.autodesk.com/blogs/construction/issue-resolution-clash-avoidance-autodesk-bim-collaborate/)
describes teams gathering decisions through spreadsheets, static reports, and
other tools; its
[digital project delivery material](https://www.autodesk.com/solutions/bim/research-civil-infrastructure/design-collaboration)
frames fragmented tools and files as a source of silos, miscommunication, and
rework. These are vendor-framed problems, but they point to a real budget
center: coordination failure in high-value projects.

[Filestage’s design-review comparison](https://filestage.io/blog/design-review-software/)
shows another mature category built around visual annotation, centralized
feedback, version comparison, review steps, and approval.

The product should integrate with these systems. Trying to replace their
artifact canvas, issue tracker, or approval workflow would expand the product
surface before its wedge is proven.

### Evidence that source traceability matters

[Dovetail’s research repository](https://dovetail.com/solutions/research-repository/)
positions source-linked evidence as a core trust property: AI themes and
insights can be traced back to source material. That validates provenance as a
buying criterion in adjacent qualitative-research work. It also means
“source-grounded AI” alone is not unique.

[Figma’s 2026 AI report](https://www.figma.com/blog/2026-ai-report/) reports
8,403 survey responses and 639 interviews across ten markets. It says 90% of
respondents see design as at least as important as before AI and argues that,
as production becomes easier, deciding what is worth building becomes more
important. This is a useful directional signal for decision-quality tooling,
not a demand forecast for this product.

## Competitive boundary

| Category                       | Examples                                 | What customers already get                                                           | Remaining opening                                                                     |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Meeting intelligence           | Teams Facilitator, Read, Granola, Fathom | transcript, summary, tasks, decisions, search, in-person capture                     | critique-specific structure tied to later artifact change                             |
| Artifact comments and approval | Figma, Filestage                         | region comments, threads, versions, resolution, approval                             | what was said aloud, why it mattered, and what competing view was lost                |
| AEC coordination               | Autodesk Forma/Construction Cloud        | model coordination, issues, accountability, project data                             | spoken rationale and criterion/evidence provenance at design-review time              |
| Research repositories          | Dovetail                                 | source-grounded themes and insights across qualitative evidence                      | live multi-party critique, explicit decisions/actions, artifact revision lineage      |
| Critique HUD today             | this repository                          | live/simulated audio path, source-linked critique signals, Radar, evaluation harness | artifact link, human disposition, replayable project graph, permissions, integrations |

The unoccupied-looking space is not a blank category. It is a workflow seam.
The company must prove that customers will pay to close it rather than tolerate
manual notes or wait for an incumbent integration.

## Recommended beachhead

### Primary initial customer

Target 20–200-person product-design teams and design agencies that run recurring,
multi-stakeholder reviews of valuable work.

**Economic user:** Head of Design, DesignOps lead, or agency delivery lead.  
**Daily champion:** design lead or facilitator.  
**Participants:** product designers, researchers, product managers, engineers,
clients, and accessibility specialists.  
**High-cost failure:** a decision is repeated, evidence is detached from the
claim, a dissenting risk disappears, or a later revision cannot be explained.

This segment offers:

- frequent critique events;
- native Figma/Linear/Jira workflows to integrate with;
- measurable revision cycles;
- less integration complexity than BIM;
- a buyer who can value decision quality across a team.

### Expansion segment

AEC design coordination is potentially more valuable per review because errors,
approvals, and rework are expensive. It is also harder:

- terminology and artifact references are domain-specific;
- permissions and project boundaries are stringent;
- incumbents own the model and issue workflow;
- long sales cycles and integration expectations arrive early.

Use one AEC design partner in discovery, but do not make both product design and
AEC equal launch markets.

### Role of education

Architecture studios are excellent design partners and evaluation environments.
They provide frequent critique, participant diversity, and strong research
questions about agency and learning. They are a weak first scalable market:

- budgets are low, as Read’s $5 education offer illustrates;
- consent, safeguarding, and institutional procurement add friction;
- the learner benefit is important but hard to tie to a departmental operating
  budget.

Treat studios as a research/evaluation channel, not the initial revenue thesis.

## Product thesis: the Critique Ledger

### Five verbs

1. **Capture** — accept live microphone audio, uploaded recordings, or a
   deterministic simulated room.
2. **Compile** — convert final source turns into a bounded critique grammar:
   observation, evidence, question, concern, position, alternative, constraint,
   decision, action, and reference.
3. **Mirror** — show only the smallest useful live view: criteria coverage, open
   loops, options, decisions, actions, and evidence gaps; never participant
   scores.
4. **Commit** — let humans correct signals, preserve competing positions, choose
   a disposition, and link a decision/action to an artifact region and revision.
5. **Learn** — measure which claims led to change, which remained unresolved,
   and where the compiler failed; use consented corrections for evaluation, not
   cross-customer surveillance.

### What should be automatic

- provisional speaker-attributed transcript;
- exact quote anchors;
- critique-signal candidates;
- criterion coverage;
- suspected open loops and evidence gaps;
- candidate decision and action statements;
- suggested links, clearly marked as provisional.

### What must remain human-authoritative

- participant identity;
- whether a statement is correctly interpreted;
- whether a concern is accepted, adapted, deferred, rejected, or unresolved;
- whether a decision was actually made;
- the owner and deadline of an action;
- which artifact region or revision responds to the critique;
- audience, retention, and sharing.

## Defensibility ladder

### Not a moat

- ASR;
- diarization;
- an LLM prompt;
- a transcript;
- summaries or action items;
- talk-time visualization;
- an ontology copied into a system prompt.

### Possible compounding advantages

1. **Workflow position:** the product becomes the handoff from review room to
   artifact/issue workflow.
2. **Corrected critique graph:** teams accumulate an inspectable project memory
   of claims, evidence, alternatives, decisions, actions, and revisions.
3. **Integration depth:** Figma/Linear/Jira first; Autodesk/ACC later.
4. **Evaluation harness:** the existing acoustic simulator evolves into a
   regression system for ASR, speaker attribution, extraction, latency, and
   safe degradation.
5. **Domain-specific correction data:** with explicit customer permission and
   strict tenant boundaries, corrected mappings can improve evaluation and
   models. Data accumulation is not automatically a moat and must not depend on
   hidden secondary use.

The strongest defense is a trusted workflow and its corrected project graph,
not ownership of raw meeting audio.

## Business model hypotheses — to test, not present as facts

General notetaker prices set a low anchor. Artifact review and project
coordination support higher budgets when they own approvals, accountability, or
rework reduction.

Test two packages:

1. **Design-team workspace:** $300–$1,000 per month for a review workspace,
   facilitator/editor seats, unlimited viewers, retention controls, and
   Figma/Linear integration.
2. **Paid design-partner program:** $5,000–$15,000 for an 8–12 week deployment
   with workflow mapping, success metrics, privacy review, and integration.

Do not optimize packaging until at least six teams use the product in repeated
reviews. A $39–$79 editor-seat option can be tested, but per-seat pricing may
penalize broad review participation.

## Product risks an investor should insist on measuring

| Risk               | Why it can kill the company                                 | Required evidence                                                                                |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Category collapse  | customers see a notetaker with a different taxonomy         | buyers independently describe the revision/provenance problem and pay above notetaker pricing    |
| Extraction error   | a wrong decision or action is worse than an omitted summary | source-anchor precision, signal precision/recall, correction time, false-decision rate           |
| Latency            | live intelligence arrives after the discussion has moved on | p50/p95 transcript and signal latency by acoustic condition and provider state                   |
| Workflow burden    | disposition and revision linking become clerical work       | median human touches per useful link and percentage of suggested links accepted                  |
| Incumbent response | Figma, Microsoft, Autodesk, or Dovetail closes the seam     | integration-led adoption and customer-specific corrected graph that remains useful across tools  |
| Trust/privacy      | always-on room audio triggers rejection or legal friction   | explicit consent rate, configurable retention, deletion tests, tenant isolation, security review |
| Weak retention     | the output is read once and forgotten                       | share of recurring reviews captured; later-session graph reuse; 8/12-week retained teams         |
| Unit economics     | long audio and multiple model passes erode margin           | cost per review, fallback rate, model latency, gross margin under real usage                     |

## Go/no-go gates

### 90-day design-partner gate

Continue if:

- at least 6 of 10 recruited teams complete four or more reviews;
- at least half of eligible recurring reviews are captured without researcher
  prompting;
- 70% or more of displayed signals have a valid exact source anchor;
- false “decision made” claims are below 5%;
- median correction is under 20 seconds;
- at least 40% of important critique claims are linked to an action, issue, or
  artifact revision;
- at least three teams pay for the pilot or sign a priced continuation.

These thresholds are proposed management gates, not established benchmarks.

### Kill or reposition if

- teams mainly export summaries and ignore the graph;
- users will not perform dispositions or revision links even with integrations;
- the tool is used only when a researcher/founder facilitates;
- reliable extraction requires post-meeting latency that removes the live value;
- legal/security requirements make the initial segment uneconomic;
- buyers compare it only with free meeting notes and will not pay a workflow
  premium.

## Technical readiness assessment

### Proven in the current repository

- live browser microphone path to streaming ASR;
- simulated/injected and acoustic playback paths;
- a shared ingestion route for final turns;
- bounded critique-signal types;
- exact-substring source-quote validation;
- criterion validation against facilitator-authored criteria;
- duplicate suppression;
- source-linked Critique Radar over SSE;
- deterministic fallback when a provider rejects or misses its deadline;
- 91 unit tests and 54 browser-profile cases at this assessment phase;
- successful production build and Fly.io health check;
- public Fly probe of source-linked signals.

### Not production-ready

- SQLite plus process-local queues/pubsub do not support horizontal scale;
- no authentication, tenancy, or role-based permissions;
- no immutable event log/replay;
- no audio retention/deletion control;
- no correction/disposition interface for critique signals;
- no artifact or issue-tracker integration;
- no project-level longitudinal graph;
- no calibrated extraction benchmark on natural reviews;
- provider fallback is safe but materially less semantically rich;
- live provider latency still needs measurement and model routing.
- after compatible Next.js, Prisma, and WebSocket updates, `npm audit
--omit=dev` still reports three high-severity findings through Next.js
  transitive PostCSS/Sharp dependencies; the advertised automated fix is a
  Next.js major upgrade and must be tested as a dedicated security migration.

## Recommended build sequence

### Phase A — trustworthy capture and correction

- add consent and retention policy;
- expose exact source anchors and signal correction;
- add decision confirmation and action owner/deadline confirmation;
- record derivation version and provider/fallback state;
- create a natural-review gold set;
- instrument p50/p95 latency, fallback, correction, and deletion.

### Phase B — close one workflow seam

- integrate Figma comments/regions and Linear or Jira issues;
- add accept/adapt/defer/reject/unresolved dispositions;
- link claims and actions to an artifact revision;
- begin each later review with unresolved/changed/validated continuity;
- pilot with product-design teams.

### Phase C — durable multi-session graph

- move to Postgres and a transactional outbox/event log;
- use durable workers and replayable SSE/WebSocket delivery;
- add project/organization tenancy and permissions;
- add cross-session criteria coverage and decision lineage;
- test AEC terminology and Autodesk integration with one design partner.

## Final investment position

The repository has evolved from a dashboard concept into the beginning of a
trustworthy critique compiler. That is a meaningful improvement, but it is
still a product hypothesis.

The investable claim would be:

> Teams repeatedly pay to preserve the evidence, alternatives, decisions, and
> revision rationale that ordinary meeting tools and artifact comments leave
> disconnected.

Today there is architectural plausibility and a functioning extraction spine.
There is not yet paid retention, integration pull, measured accuracy on natural
reviews, or a defensible data/workflow advantage. The rational decision is a
small, milestone-bound design-partner investment—not a broad meeting-assistant
launch and not a venture-scale valuation based on the prototype alone.
