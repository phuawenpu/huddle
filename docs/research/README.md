# Critique HUD research, product evolution, and system diagrams

**Audit date:** 2026-08-07
**Scope:** the two papers in [`workspace/`](../../workspace/), the current `main` codebase, and a targeted online prior-art review.

This folder separates four questions that should not be collapsed:

1. **What the research contributes** — the empirical and participatory-design findings.
2. **What the current prototype actually implements** — verified from source and tests.
3. **What a defensible next-generation information system could contribute** — seven design iterations, with an earlier five-diagram interpretation retained in the archive.
4. **Whether the repository can become a business** — tested against current meeting-intelligence, artifact-review, AEC-coordination, and research-repository products.

## Deliverables

| Artifact                                                                                     | Purpose                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`01-research-synthesis.md`](01-research-synthesis.md)                                       | Novel aspects of the two studies and the design requirements they establish                                                                                                                                     |
| [`02-codebase-audit.md`](02-codebase-audit.md)                                               | Detailed architecture, data flow, implementation coverage, risks, and evidence                                                                                                                                  |
| [`03-novelty-landscape.md`](03-novelty-landscape.md)                                         | Targeted comparison with current research and products; novelty boundary                                                                                                                                        |
| [`04-system-versions.md`](04-system-versions.md)                                             | Seven system versions, operating models, comparisons, and ranked selection                                                                                                                                      |
| [`05-evaluation-roadmap.md`](05-evaluation-roadmap.md)                                       | Research hypotheses, study designs, measures, gates, and implementation sequence                                                                                                                                |
| [`06-product-and-investor-assessment.md`](06-product-and-investor-assessment.md)             | Current demand signals, competitive boundary, beachhead, moat, risks, pricing hypotheses, and falsifiable investor gates                                                                                        |
| [`critique-intelligence-system-2026-08-07.pdf`](critique-intelligence-system-2026-08-07.pdf) | Eleven-page vector diagram: executive spine, signal compiler, live sequence, Critique Ledger, evaluation twin, experience/governance, production architecture, business wedge, investor gates, and traceability |
| [`generate_critique_intelligence_system.py`](generate_critique_intelligence_system.py)       | Reproducible ReportLab source for the current multi-page diagram                                                                                                                                                |
| [`archive/diagrams-2026-08-07/`](archive/diagrams-2026-08-07/)                               | Archived conceptual diagram set and its generator                                                                                                                                                               |

## Current diagram set

The current PDF is a single explained system atlas rather than a collection of
isolated concept sketches. Its visual contract is consistent on every page:

- **green** — implemented and verified in the repository;
- **blue** — the next system boundary;
- **amber** — human-authoritative interpretation or action;
- **red** — a product, safety, or evidence gate;
- **purple** — market logic or a proposed compounding advantage.

The eight architecture/product variations are:

1. **The critique intelligence spine** — capture, compile, mirror, commit, link, learn.
2. **The critique signal compiler** — exact source turns become bounded critique signals through validation and safe fallback.
3. **Two clocks, three lanes** — transcript, interpretation, and durable project state have different latency and authority budgets.
4. **The Critique Ledger** — evidence, tensions, confirmed decisions, actions, and artifact revisions form a project graph.
5. **The Critique Twin** — live, injected, and acoustic sources exercise one pathway with fault injection and measurable gates.
6. **Experience and governance** — before/during/facilitator/after surfaces expose information according to consequence.
7. **Production and trust** — the current Fly vertical slice evolves toward tenant-scoped durable events, workers, Postgres, object storage, replay, and deletion.
8. **Business wedge** — the opening is the workflow seam between commoditized meeting notes and incumbent artifact-review systems.

Pages 10–11 give the independent investor verdict, go/no-go gates, repository
traceability, test evidence, and source guide.

### Regenerate and inspect

```bash
python -m pip install reportlab pymupdf
python docs/research/generate_critique_intelligence_system.py
```

The generator writes the PDF beside itself. ReportLab keeps the diagram
vector-based and selectable; PyMuPDF is used only for page rendering and
boundary inspection during visual QA.

## Superseded diagram set

These diagrams are retained as a dated research artifact rather than the current product direction. They blended findings from the two papers with an earlier reading of the application and may understate the implemented system and its broader potential.

1. [`01-live-critique-mirror.pdf`](archive/diagrams-2026-08-07/01-live-critique-mirror.pdf) — Version 1: live, dual-surface cognitive mirror
2. [`02-intent-ledger.pdf`](archive/diagrams-2026-08-07/02-intent-ledger.pdf) — Version 2: longitudinal critique-to-revision provenance
3. [`03-studio-commons.pdf`](archive/diagrams-2026-08-07/03-studio-commons.pdf) — Version 3: identity and audience-controlled peer critique
4. [`04-jury-bridge.pdf`](archive/diagrams-2026-08-07/04-jury-bridge.pdf) — Version 4: accessible real-time and post-jury cognitive offloading
5. [`05-reflective-twin.pdf`](archive/diagrams-2026-08-07/05-reflective-twin.pdf) — Version 5: multimodal, intent-grounded reflective twin

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
- The unit suite passes: 91 tests across 10 files.
- The browser suite passes: 54 cases across six desktop/mobile profiles.
- `npx tsc --noEmit` succeeds.
- `npm run build` succeeds and generates 19 static/dynamic route entries.
- The current diagram PDF was validated as an 11-page A3 landscape vector document with selectable text and page-by-page rendered inspection.
- The Critique Radar and exact-quote fallback were probed on the public Fly deployment.

These checks establish repository health. They do **not** establish pedagogical efficacy, novelty, diarization quality, safety, or end-to-end live-session correctness.
