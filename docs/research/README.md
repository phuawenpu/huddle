# Critique HUD research, product evolution, and system diagrams

**Audit date:** 2026-08-09
**Scope:** two source studies (whose PDFs are not retained in the repository), the current `main` codebase, and targeted online reviews of product prior art, live meeting dynamics, visualization, and mixed reality.

This folder separates four questions that should not be collapsed:

1. **What the research contributes** — the empirical and participatory-design findings.
2. **What the current prototype actually implements** — verified from source and tests.
3. **What a defensible next-generation information system could contribute** — seven design iterations, with an earlier five-diagram interpretation retained in the archive.
4. **Whether the repository can become a business** — tested against current meeting-intelligence, artifact-review, AEC-coordination, and research-repository products.

## Deliverables

| Artifact                                                                                         | Purpose                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [`06-product-and-investor-assessment.md`](06-product-and-investor-assessment.md)                 | Detailed demand evidence, competitive boundary, beachhead, moat, risks, pricing hypotheses, sources, and falsifiable gates   |
| [`07-realistic-conversation-simulation.md`](07-realistic-conversation-simulation.md)             | Realistic multi-party STT simulation, WER/diarization scoring, fixtures, limitations, and repeatable evaluation procedure     |
| [`08-meeting-dynamics-visualization.md`](08-meeting-dynamics-visualization.md)                   | Evidence-weighted design vocabulary for topic dynamics, response structure, participation, meeting tools, and AR             |
| [`01-research-synthesis.md`](01-research-synthesis.md)                                           | Novel aspects of the two studies and the design requirements they establish                                                  |
| [`02-codebase-audit.md`](02-codebase-audit.md)                                                   | Detailed architecture, data flow, implementation coverage, risks, and evidence                                               |
| [`03-novelty-landscape.md`](03-novelty-landscape.md)                                             | Targeted comparison with current research and products; novelty boundary                                                     |
| [`04-system-versions.md`](04-system-versions.md)                                                 | Seven system versions, operating models, comparisons, and ranked selection                                                   |
| [`05-evaluation-roadmap.md`](05-evaluation-roadmap.md)                                           | Research hypotheses, study designs, measures, gates, and implementation sequence                                             |
| [`generate_critique_intelligence_system.py`](generate_critique_intelligence_system.py)           | Reproducible ReportLab source for the three-page system brief                                                                |
| [`generate_business_feasibility_one_pager.py`](generate_business_feasibility_one_pager.py)       | Reproducible ReportLab source for the business feasibility one-pager                                                         |
| [`archive/diagrams-2026-08-07/`](archive/diagrams-2026-08-07/)                                   | Detailed 11-page atlas, earlier five-diagram exploration, and their generators                                               |

## Current implementation goal

The timestamped
[`live-session realtime meeting-analysis goal`](../goals/2026-08-09T15-09-39Z-live-session-realtime-meeting-analysis.md)
translates the meeting-dynamics research and the current UI/model-flow audit into
a staged implementation plan with latency, grounding, safety, and evaluation
criteria.

## Current synthesized brief

The current brief generator deliberately produces three pages rather than an encyclopedic atlas:

1. **What the repository is now** — the exact live/simulated audio-to-Critique-Radar pathway, a real source contract, code traceability, test evidence, and current boundary.
2. **One product direction** — a single Critique Ledger workflow from capture through human confirmation, disposition, artifact linking, and revision response.
3. **A 90-day proof-or-stop plan** — work, data, measures, pass gates, evidence already in hand, and explicit kill conditions.

Its visual contract is consistent on every page:

- **green** — implemented and verified in the repository;
- **blue** — the next system boundary;
- **amber** — human-authoritative interpretation or action;
- **red** — a product, safety, or evidence gate;
- **purple** — market logic or a proposed compounding advantage.

The separate business feasibility page prevents product architecture from being
mixed with the investment case. It explicitly labels verified evidence,
hypotheses, build requirements, authority rules, gates, and stop conditions.

### Regenerate and inspect

```bash
python -m pip install reportlab pymupdf
python docs/research/generate_critique_intelligence_system.py
python docs/research/generate_business_feasibility_one_pager.py
```

The generators can produce local PDF outputs beside themselves. Those generated
outputs are intentionally not tracked. ReportLab keeps the diagrams vector-based
and selectable; PyMuPDF is used only for page rendering and boundary inspection
during visual QA.

## Archived detail and earlier variations

The prior 11-page system atlas can be reproduced from
[`generate_critique_intelligence_system_detailed.py`](archive/diagrams-2026-08-07/generate_critique_intelligence_system_detailed.py).
It contains the executive spine, signal compiler, live sequence, Critique
Ledger, evaluation twin, experience/governance, production architecture,
business wedge, investor gates, and source traceability. Its source is
[`generate_critique_intelligence_system_detailed.py`](archive/diagrams-2026-08-07/generate_critique_intelligence_system_detailed.py).

These diagrams are retained as a dated research artifact rather than the current product direction. They blended findings from the two papers with an earlier reading of the application and may understate the implemented system and its broader potential.

1. Live Critique Mirror — Version 1: live, dual-surface cognitive mirror
2. Intent Ledger — Version 2: longitudinal critique-to-revision provenance
3. Studio Commons — Version 3: identity and audience-controlled peer critique
4. Jury Bridge — Version 4: accessible real-time and post-jury cognitive offloading
5. Reflective Twin — Version 5: multimodal, intent-grounded reflective twin

## Headline conclusion

The strongest defensible novelty is **not** “AI gives design feedback,” “AI transcribes critique,” or “AI creates a meeting map.” Each of those exists in prior work and generic meeting capture is now deeply commoditized. The most promising product/research contribution is an **agency-preserving Critique Ledger** that joins:

- co-present, speaker-attributed studio dialogue;
- an editable design-intent contract;
- evidence-linked, publicly restrained AI interpretation;
- private correction and audience controls;
- explicit preservation of dissent;
- feedback-to-revision lineage across the semester; and
- an acoustic simulation harness that tests the same pathway used in a real jury.

No individual component should be claimed as novel without qualification. The credible research claim is the architecture-specific interaction contract, the provenance model, and their evaluation as one socio-technical system.

The independent business conclusion is more conservative: the repository now
has a credible extraction spine and product wedge, but it is not yet an
investable company. Paid repeated use, natural-review accuracy, correction
burden, artifact integration pull, security readiness, and retention remain
unproven.

## Verification snapshot

At the time of this audit:

- 39 API route files and 9 application pages build successfully.
- The Prisma schema contains 11 models.
- The unit suite passes: 93 tests across 10 files.
- The browser suite passes: 54 cases across six desktop/mobile profiles.
- `npx tsc --noEmit` succeeds.
- `npm run build` succeeds and generates 19 static/dynamic route entries.
- The synthesized system brief was validated as a three-page A3 landscape vector document with selectable text and page-by-page rendered inspection.
- The business feasibility brief was validated as a one-page A3 landscape vector document with selectable text and rendered inspection.
- The archived detailed atlas remains an 11-page A3 landscape vector document.
- The Critique Radar and exact-quote fallback were probed on the public Fly deployment.

These checks establish repository health. They do **not** establish pedagogical efficacy, novelty, diarization quality, safety, or end-to-end live-session correctness.
