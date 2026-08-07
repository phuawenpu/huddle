# Diagram exports

These five diagrams correspond to the five highest-ranked system versions in [`../04-system-versions.md`](../04-system-versions.md).

| PDF | System version | Page |
|---|---|---|
| [`01-live-critique-mirror.pdf`](01-live-critique-mirror.pdf) | Live Critique Mirror | A3 landscape, vector |
| [`02-intent-ledger.pdf`](02-intent-ledger.pdf) | Intent Ledger | A3 landscape, vector |
| [`03-studio-commons.pdf`](03-studio-commons.pdf) | Agency-Preserving Studio Commons | A3 landscape, vector |
| [`04-jury-bridge.pdf`](04-jury-bridge.pdf) | Jury Bridge | A3 landscape, vector |
| [`05-reflective-twin.pdf`](05-reflective-twin.pdf) | Reflective Twin | A3 landscape, vector |

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
python docs/research/diagrams/generate_diagrams.py
```

The generated PDFs are committed so readers do not need Python to view them.
