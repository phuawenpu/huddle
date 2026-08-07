#!/usr/bin/env python3
"""Generate the one-page business feasibility brief for Critique Intelligence."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

from generate_critique_intelligence_system import (
    AMBER,
    BG,
    BLACK,
    BLUE,
    CYAN,
    FAINT,
    GRID,
    H,
    INK,
    MAGENTA,
    MINT,
    MUTED,
    PANEL,
    PANEL_2,
    RED,
    W,
    chip,
    label,
    rounded,
    text,
)


OUT = Path(__file__).with_name("business-feasibility-one-pager-2026-08-07.pdf")
WHITE = HexColor("#FFFFFF")


def bullet(
    c: canvas.Canvas,
    x: float,
    top: float,
    width: float,
    title_value: str,
    body: str,
    color=CYAN,
) -> float:
    c.setFillColor(color)
    c.circle(x + 4, top - 3, 3.2, fill=1, stroke=0)
    label(c, title_value.upper(), x + 16, top, 7.2, INK)
    return text(c, body, x + 16, top - 16, width - 16, 7.0, MUTED, max_lines=3) - 8


def tag_row(
    c: canvas.Canvas,
    x: float,
    top: float,
    width: float,
    tag: str,
    statement: str,
    color,
    lines: int = 2,
) -> float:
    chip(c, x, top - 14, tag, color, BLACK, 72, 18, 6.2)
    y = text(
        c,
        statement,
        x + 86,
        top,
        width - 86,
        7.0,
        MUTED,
        max_lines=lines,
    )
    return min(y - 9, top - 30)


def section(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title_value: str,
    subtitle: str,
    accent,
) -> None:
    rounded(c, x, y, w, h, PANEL, GRID, 10, 0.9)
    c.setFillColor(accent)
    c.roundRect(x, y, 6, h, 3, fill=1, stroke=0)
    label(c, title_value.upper(), x + 18, y + h - 24, 9.2, INK)
    text(c, subtitle, x + 18, y + h - 41, w - 36, 7.0, MUTED, max_lines=2)


def draw_page(c: canvas.Canvas) -> None:
    c.setTitle("Critique Intelligence — Business Feasibility One-Pager")
    c.setAuthor("Code Huddle")
    c.setSubject("Independent investor assessment and 90-day feasibility gates")

    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(GRID)
    c.setLineWidth(0.3)
    for x in range(40, int(W), 40):
        c.line(x, 40, x, H - 94)
    for y in range(40, int(H - 94), 40):
        c.line(40, y, W - 40, y)

    label(c, "BUSINESS FEASIBILITY / INDEPENDENT REVIEW", 42, H - 36, 8, CYAN)
    label(c, "Critique Intelligence", 42, H - 69, 24, INK)
    text(
        c,
        "Turn spoken design-review reasoning into confirmed, source-linked project state—not another meeting summary.",
        350,
        H - 49,
        700,
        9,
        MUTED,
        max_lines=2,
    )
    chip(c, W - 102, H - 64, "ONE PAGE", BLUE, WHITE, 62, 24, 6.8)
    c.setStrokeColor(GRID)
    c.line(42, H - 88, W - 42, H - 88)

    rounded(c, 42, 661, W - 84, 78, BLACK, AMBER, 12, 1.3)
    chip(c, 60, 700, "VERDICT", AMBER, BLACK, 76, 22, 6.8)
    label(
        c,
        "Promising workflow wedge; invest only in paid design-partner discovery.",
        154,
        704,
        15.5,
        INK,
    )
    text(
        c,
        "The code proves a usable extraction spine. It does not yet prove natural-review accuracy, repeated use, willingness to pay, retention, or a defensible data advantage.",
        60,
        682,
        W - 120,
        8.1,
        MUTED,
        max_lines=2,
    )

    left_x, left_w = 42, 340
    mid_x, mid_w = 397, 355
    right_x, right_w = 767, W - 809
    body_y, body_h = 294, 350

    section(
        c,
        left_x,
        body_y,
        left_w,
        body_h,
        "1 / Market opening",
        "A real seam, inside a crowded category",
        MAGENTA,
    )
    y = 590
    y = bullet(
        c,
        left_x + 18,
        y,
        left_w - 36,
        "Initial customer / hypothesis",
        "20–200 person product-design teams and agencies running recurring, consequential reviews.",
        MAGENTA,
    )
    y = bullet(
        c,
        left_x + 18,
        y,
        left_w - 36,
        "Job to be done",
        "Preserve why a design changed: evidence, competing positions, confirmed decisions, owners, and the later artifact revision.",
        CYAN,
    )
    y = bullet(
        c,
        left_x + 18,
        y,
        left_w - 36,
        "Competitive fact",
        "Teams, Read, Granola, and Fathom already cover notes and actions. Figma, Filestage, Autodesk, and Dovetail own adjacent artifact or evidence workflows.",
        RED,
    )
    y = bullet(
        c,
        left_x + 18,
        y,
        left_w - 36,
        "Opening / inference",
        "The under-served seam is spoken critique → human-confirmed decision → exact artifact region or issue → observable revision.",
        MINT,
    )
    bullet(
        c,
        left_x + 18,
        y,
        left_w - 36,
        "Positioning rule",
        "Sell the Critique Ledger workflow. Do not compete as a broad AI meeting assistant.",
        AMBER,
    )

    section(
        c,
        mid_x,
        body_y,
        mid_w,
        body_h,
        "2 / Product and proof",
        "Useful vertical slice; incomplete business",
        CYAN,
    )
    y = 590
    y = tag_row(
        c,
        mid_x + 18,
        y,
        mid_w - 36,
        "VERIFIED",
        "Live or simulated final turns flow through ingest, a bounded 10-signal compiler, exact-quote validation, safe fallback, SSE, and the Critique Radar.",
        MINT,
        3,
    )
    y = tag_row(
        c,
        mid_x + 18,
        y,
        mid_w - 36,
        "VERIFIED",
        "93 unit tests; 54 browser cases; TypeScript and production build pass; public Fly deployment is healthy.",
        MINT,
        2,
    )
    y = tag_row(
        c,
        mid_x + 18,
        y,
        mid_w - 36,
        "OBSERVED",
        "A public three-turn probe produced exact-quote critique signals in 12.1 s. This is a smoke test—not an accuracy study.",
        BLUE,
        2,
    )
    y = tag_row(
        c,
        mid_x + 18,
        y,
        mid_w - 36,
        "BUILD",
        "Human confirmation/disposition, artifact-region or issue links, revision responses, tenant auth, retention/deletion, durable jobs, and production Postgres.",
        AMBER,
        3,
    )
    tag_row(
        c,
        mid_x + 18,
        y,
        mid_w - 36,
        "AUTHORITY",
        "The model may propose structure. People alone confirm decisions, meaning, ownership, and consequence. Never rank participants.",
        RED,
        3,
    )

    section(
        c,
        right_x,
        body_y,
        right_w,
        body_h,
        "3 / Commercial test",
        "Prices are hypotheses; gates decide",
        AMBER,
    )
    y = 590
    y = tag_row(
        c,
        right_x + 18,
        y,
        right_w - 36,
        "HYPOTHESIS",
        "$5k–$15k paid implementation pilot; then $300–$1,000/month per workspace, adjusted by review volume and integrations.",
        MAGENTA,
        3,
    )
    label(c, "90-DAY PASS GATES", right_x + 18, y, 7.4, INK)
    y -= 16
    gates = [
        "6/10 teams complete ≥4 natural reviews",
        "≥50% of eligible reviews captured",
        "≥70% valid exact-source anchors",
        "<5% false confirmed decisions",
        "median correction time <20 seconds",
        "≥40% important claims linked to an artifact",
        "≥3 teams pay to continue",
    ]
    for gate in gates:
        c.setFillColor(AMBER)
        c.circle(right_x + 22, y + 2, 2.5, fill=1, stroke=0)
        text(c, gate, right_x + 32, y + 6, right_w - 52, 6.9, MUTED, max_lines=1)
        y -= 21
    rounded(
        c,
        right_x + 18,
        body_y + 18,
        right_w - 36,
        66,
        BLACK,
        RED,
        8,
        1,
    )
    label(c, "STOP IF", right_x + 32, body_y + 63, 7.2, RED)
    text(
        c,
        "Teams export summaries but ignore the ledger; linking feels clerical; founder facilitation is required; or buyers only pay generic note-taker prices.",
        right_x + 32,
        body_y + 46,
        right_w - 64,
        6.8,
        MUTED,
        max_lines=3,
    )

    bottom_y, bottom_h = 94, 183
    section(
        c,
        42,
        bottom_y,
        530,
        bottom_h,
        "90-day allocation",
        "Three coupled workstreams; no autonomy theater",
        MINT,
    )
    rows = [
        (
            "WEEKS 1–4",
            "Trust extraction",
            "Natural-review corpus, gold labels, correction UI, signal and decision quality.",
            MINT,
        ),
        (
            "WEEKS 3–8",
            "Close one workflow",
            "Disposition + one Figma/Linear-style link + revision response; 6–10 design partners.",
            MAGENTA,
        ),
        (
            "WEEKS 6–12",
            "Make operable",
            "Tenant auth, retention/deletion, durable jobs, Postgres, replay, paid continuations.",
            BLUE,
        ),
    ]
    y = 218
    for phase, name, body, color in rows:
        chip(c, 60, y - 13, phase, color, BLACK, 78, 18, 5.8)
        label(c, name, 151, y, 7.5, INK)
        text(c, body, 248, y, 302, 6.7, MUTED, max_lines=2)
        y -= 41

    section(
        c,
        587,
        bottom_y,
        W - 629,
        bottom_h,
        "Investor diligence",
        "What is known, what can still kill the thesis",
        RED,
    )
    label(c, "UPSIDE IF PROVEN", 605, 219, 7.2, MINT)
    text(
        c,
        "A proprietary, permissioned critique-to-revision graph can improve retrieval, workflow automation, evaluation, and switching cost.",
        605,
        202,
        245,
        6.8,
        MUTED,
        max_lines=3,
    )
    label(c, "PRIMARY RISKS", 869, 219, 7.2, RED)
    text(
        c,
        "Crowded substitutes; transcription/diarization error; surveillance concerns; integration friction; weak repeat use; no evidence of willingness to pay.",
        869,
        202,
        267,
        6.8,
        MUTED,
        max_lines=3,
    )
    label(c, "SECURITY / RELEASE GATE", 605, 154, 7.2, AMBER)
    text(
        c,
        "No tenant auth, production retention controls, or durable state yet. Three high transitive Next.js dependency findings remain; a major upgrade is required.",
        605,
        137,
        531,
        6.8,
        MUTED,
        max_lines=3,
    )

    c.setStrokeColor(GRID)
    c.line(42, 76, W - 42, 76)
    text(
        c,
        "MARKET EVIDENCE: Microsoft Teams Facilitator · Read Meeting Reports & pricing · Figma comments & 2026 AI report · Autodesk design collaboration · Dovetail research repository",
        42,
        61,
        786,
        5.9,
        FAINT,
        max_lines=1,
    )
    text(
        c,
        "Detailed source links and reasoning: docs/research/06-product-and-investor-assessment.md",
        843,
        61,
        305,
        5.9,
        FAINT,
        max_lines=1,
    )
    label(c, "FACTS ≠ HYPOTHESES ≠ GATES", 42, 43, 6.2, AMBER)
    text(
        c,
        "Assessment date: 2026-08-07 · repository and market conditions can change",
        868,
        43,
        280,
        5.9,
        FAINT,
        max_lines=1,
    )


def render() -> None:
    pdf = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    draw_page(pdf)
    pdf.showPage()
    pdf.save()
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    render()
