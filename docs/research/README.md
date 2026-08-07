# Critique HUD Research and Novel Information-System Study

**Audit date:** 2026-08-07
**Scope:** the two papers in [`workspace/`](../../workspace/), the current `main` codebase, and a targeted online prior-art review.

This folder separates three questions that should not be collapsed:

1. **What the research contributes** — the empirical and participatory-design findings.
2. **What the current prototype actually implements** — verified from source and tests.
3. **What a defensible next-generation information system could contribute** — seven design iterations, five selected for detailed diagrams.

## Deliverables

| Artifact | Purpose |
|---|---|
| [`01-research-synthesis.md`](01-research-synthesis.md) | Novel aspects of the two studies and the design requirements they establish |
| [`02-codebase-audit.md`](02-codebase-audit.md) | Detailed architecture, data flow, implementation coverage, risks, and evidence |
| [`03-novelty-landscape.md`](03-novelty-landscape.md) | Targeted comparison with current research and products; novelty boundary |
| [`04-system-versions.md`](04-system-versions.md) | Seven system versions, operating models, comparisons, and ranked selection |
| [`05-evaluation-roadmap.md`](05-evaluation-roadmap.md) | Research hypotheses, study designs, measures, gates, and implementation sequence |
| [`diagrams/`](diagrams/) | Five publication-quality vector PDF diagrams plus their generator |

## Five selected diagrams

The PDFs use vector geometry and text on an A3 landscape page. They are resolution-independent and suitable for print, zooming, and conversion to raster formats.

1. [`01-live-critique-mirror.pdf`](diagrams/01-live-critique-mirror.pdf) — Version 1: live, dual-surface cognitive mirror
2. [`02-intent-ledger.pdf`](diagrams/02-intent-ledger.pdf) — Version 2: longitudinal critique-to-revision provenance
3. [`03-studio-commons.pdf`](diagrams/03-studio-commons.pdf) — Version 3: identity and audience-controlled peer critique
4. [`04-jury-bridge.pdf`](diagrams/04-jury-bridge.pdf) — Version 4: accessible real-time and post-jury cognitive offloading
5. [`05-reflective-twin.pdf`](diagrams/05-reflective-twin.pdf) — Version 5: multimodal, intent-grounded reflective twin

## Headline conclusion

The strongest defensible novelty is **not** “AI gives design feedback,” “AI transcribes critique,” or “AI creates a meeting map.” Each of those exists in prior work. The most promising contribution is an **agency-preserving critique provenance system** that joins:

- co-present, speaker-attributed studio dialogue;
- an editable design-intent contract;
- evidence-linked, publicly restrained AI interpretation;
- private correction and audience controls;
- explicit preservation of dissent;
- feedback-to-revision lineage across the semester; and
- an acoustic simulation harness that tests the same pathway used in a real jury.

No individual component should be claimed as novel without qualification. The credible research claim is the architecture-specific interaction contract, the provenance model, and their evaluation as one socio-technical system.

## Verification snapshot

At the time of this audit:

- 39 API route files and 9 application pages build successfully.
- The Prisma schema contains 11 models.
- The unit suite passes: 79 tests across 7 files.
- `npx tsc --noEmit` succeeds.
- `npm run build` succeeds and generates 19 static/dynamic route entries.
- The five diagram PDFs are validated as one-page A3 vector documents.

These checks establish repository health. They do **not** establish pedagogical efficacy, novelty, diarization quality, safety, or end-to-end live-session correctness.
