# Archived diagram exports

## Detailed system atlas

The detailed-system generator produces the complete 11-page atlas that preceded
the shorter current-facing brief. Generated PDF output is intentionally not tracked.
It retains the executive spine, signal compiler, live sequence, Critique Ledger,
evaluation twin, experience/governance model, production architecture, business
wedge, investor gates, repository traceability, and source guide.

Rebuild it with:

```bash
python docs/research/archive/diagrams-2026-08-07/generate_critique_intelligence_system_detailed.py
```

Its generator writes the PDF in this archive directory.

## Earlier five-diagram exploration

These five diagrams correspond to the five highest-ranked system versions in [`../../04-system-versions.md`](../../04-system-versions.md).

They were archived on 2026-08-07 because they blend the source-paper concepts with an earlier, narrower interpretation of the application. They are retained for research history and should not be treated as the current product architecture or roadmap.

| System version                   | Page                 |
| -------------------------------- | -------------------- |
| Live Critique Mirror             | A3 landscape, vector |
| Intent Ledger                    | A3 landscape, vector |
| Agency-Preserving Studio Commons | A3 landscape, vector |
| Jury Bridge                      | A3 landscape, vector |
| Reflective Twin                  | A3 landscape, vector |

## Quality

- one page per file;
- 1190.551 × 841.890 PDF points (A3 landscape);
- vector shapes and text, with no embedded raster image;
- page compression enabled;
- title, subject, and author metadata embedded.

Because the artwork is vector, “high resolution” is not tied to a fixed DPI. It can be printed at A3 or rasterized at 300/600 DPI without the source becoming pixelated.

## Rebuild

The generator depends on `reportlab`:

```bash
python -m pip install reportlab
python docs/research/archive/diagrams-2026-08-07/generate_diagrams.py
```

The generated PDFs are committed so readers do not need Python to view them.
