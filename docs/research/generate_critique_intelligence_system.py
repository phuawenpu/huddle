#!/usr/bin/env python3
"""Generate the Critique Intelligence System multi-page vector diagram."""

from __future__ import annotations

from math import atan2, cos, pi, sin
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


OUT = Path(__file__).with_name("critique-intelligence-system-2026-08-07.pdf")
W, H = landscape(A3)

BG = HexColor("#07111F")
PANEL = HexColor("#0E1B2D")
PANEL_2 = HexColor("#12233A")
INK = HexColor("#F4F7FB")
MUTED = HexColor("#9FB0C7")
FAINT = HexColor("#60738D")
GRID = HexColor("#233650")
BLUE = HexColor("#5B8CFF")
CYAN = HexColor("#35D5E8")
MINT = HexColor("#41D49A")
AMBER = HexColor("#FFBE55")
MAGENTA = HexColor("#D779FF")
RED = HexColor("#FF6F7E")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#02060D")

CURRENT = MINT
NEXT = BLUE
HUMAN = AMBER
RISK = RED
MARKET = MAGENTA


def wrap_lines(
    value: str,
    width: float,
    font: str = "Helvetica",
    size: float = 10,
) -> list[str]:
    lines: list[str] = []
    for raw in value.split("\n"):
        words = raw.split()
        if not words:
            lines.append("")
            continue
        line = words[0]
        for word in words[1:]:
            candidate = f"{line} {word}"
            if stringWidth(candidate, font, size) <= width:
                line = candidate
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def paragraph(
    c: canvas.Canvas,
    value: str,
    x: float,
    top: float,
    width: float,
    size: float = 10,
    leading: float | None = None,
    color=MUTED,
    font: str = "Helvetica",
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.28
    lines = wrap_lines(value, width, font, size)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        tail = lines[-1]
        while tail and stringWidth(f"{tail}...", font, size) > width:
            tail = tail[:-1]
        lines[-1] = f"{tail}..."
    c.setFillColor(color)
    c.setFont(font, size)
    y = top
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def label(
    c: canvas.Canvas,
    value: str,
    x: float,
    y: float,
    size: float = 8,
    color=MUTED,
    font: str = "Helvetica-Bold",
) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, value)


def round_rect(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill=PANEL,
    stroke=GRID,
    radius: float = 10,
    line_width: float = 0.8,
) -> None:
    c.setLineWidth(line_width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def chip(
    c: canvas.Canvas,
    x: float,
    y: float,
    value: str,
    color=BLUE,
    text_color=WHITE,
    width: float | None = None,
    height: float = 20,
    size: float = 7.4,
) -> float:
    width = width or stringWidth(value, "Helvetica-Bold", size) + 18
    c.setFillColor(color)
    c.setStrokeColor(color)
    c.roundRect(x, y, width, height, height / 2, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", size)
    c.drawCentredString(x + width / 2, y + (height - size) / 2 + 1.4, value)
    return width


def panel(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    subtitle: str = "",
    accent=BLUE,
) -> None:
    round_rect(c, x, y, w, h)
    c.setFillColor(accent)
    c.roundRect(x, y, 6, h, 3, fill=1, stroke=0)
    label(c, title.upper(), x + 18, y + h - 25, 9, INK)
    if subtitle:
        paragraph(c, subtitle, x + 18, y + h - 42, w - 34, 7.8, 10, MUTED)


def node(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str = "",
    accent=BLUE,
    tag: str | None = None,
    fill=PANEL_2,
    title_size: float = 9.2,
) -> None:
    round_rect(c, x, y, w, h, fill=fill, stroke=accent, radius=8, line_width=1)
    c.setFillColor(accent)
    c.rect(x, y + h - 4, w, 4, fill=1, stroke=0)
    label(c, title, x + 12, y + h - 21, title_size, INK)
    if tag:
        tw = stringWidth(tag, "Helvetica-Bold", 6.2) + 12
        chip(c, x + w - tw - 8, y + h - 25, tag, accent, BLACK, tw, 14, 6.2)
    if body:
        paragraph(c, body, x + 12, y + h - 38, w - 24, 7.6, 9.7, MUTED)


def arrow(
    c: canvas.Canvas,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    color=BLUE,
    width: float = 1.4,
    dashed: bool = False,
) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    if dashed:
        c.setDash(5, 4)
    c.line(x1, y1, x2, y2)
    angle = atan2(y2 - y1, x2 - x1)
    length = 8
    spread = pi / 7
    points = [
        (x2, y2),
        (
            x2 - length * cos(angle - spread),
            y2 - length * sin(angle - spread),
        ),
        (
            x2 - length * cos(angle + spread),
            y2 - length * sin(angle + spread),
        ),
    ]
    path = c.beginPath()
    path.moveTo(*points[0])
    path.lineTo(*points[1])
    path.lineTo(*points[2])
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    c.restoreState()


def elbow_arrow(
    c: canvas.Canvas,
    points: list[tuple[float, float]],
    color=BLUE,
    dashed: bool = False,
) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(1.3)
    if dashed:
        c.setDash(5, 4)
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        c.line(x1, y1, x2, y2)
    c.restoreState()
    arrow(c, *points[-2], *points[-1], color=color, dashed=dashed)


def page_base(
    c: canvas.Canvas,
    number: int,
    kicker: str,
    title: str,
    subtitle: str,
) -> None:
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(GRID)
    c.setLineWidth(0.35)
    for x in range(40, int(W), 40):
        c.line(x, 42, x, H - 92)
    for y in range(42, int(H - 92), 40):
        c.line(38, y, W - 38, y)

    label(c, kicker.upper(), 40, H - 40, 8.5, CYAN)
    label(c, title, 40, H - 69, 22, INK)
    paragraph(c, subtitle, 430, H - 48, W - 530, 8.5, 11, MUTED, max_lines=3)
    c.setStrokeColor(GRID)
    c.line(40, H - 86, W - 40, H - 86)
    chip(c, W - 86, H - 64, f"{number:02d}", BLUE, WHITE, 44, 24, 8)


def footer(c: canvas.Canvas, variant: str) -> None:
    c.setStrokeColor(GRID)
    c.line(40, 34, W - 40, 34)
    label(c, "CRITIQUE INTELLIGENCE SYSTEM / 2026-08-07", 40, 18, 6.8, FAINT)
    label(c, variant, W - 280, 18, 6.8, FAINT)


def legend(c: canvas.Canvas, x: float, y: float) -> None:
    pos = x
    for value, color in [
        ("IMPLEMENTED", CURRENT),
        ("NEXT SYSTEM", NEXT),
        ("HUMAN AUTHORITY", HUMAN),
        ("RISK / GATE", RISK),
        ("MARKET", MARKET),
    ]:
        pos += chip(c, pos, y, value, color, BLACK, height=17, size=6.3) + 7


def explanation(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    title: str,
    body: str,
    accent=CYAN,
) -> None:
    round_rect(c, x, y, w, 57, fill=BLACK, stroke=accent, radius=8)
    label(c, title.upper(), x + 14, y + 38, 7, accent)
    paragraph(c, body, x + 14, y + 24, w - 28, 7.2, 9, MUTED, max_lines=3)


def title_page(c: canvas.Canvas) -> None:
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    for i, color in enumerate([BLUE, CYAN, MINT, AMBER, MAGENTA]):
        c.setStrokeColor(color)
        c.setLineWidth(2.2)
        c.circle(170 + i * 38, H - 180 - i * 20, 68 + i * 20, fill=0, stroke=1)

    label(c, "SYSTEM EVOLUTION / INVESTOR EDITION", 52, H - 62, 9, CYAN)
    paragraph(
        c,
        "CRITIQUE\nINTELLIGENCE\nSYSTEM",
        52,
        H - 130,
        610,
        40,
        45,
        INK,
        "Helvetica-Bold",
    )
    paragraph(
        c,
        "A source-linked architecture for turning live or simulated design-review audio into evidence, alternatives, decisions, actions, and revision rationale.",
        56,
        H - 295,
        560,
        15,
        20,
        MUTED,
        max_lines=4,
    )
    chip(c, 56, H - 385, "CAPTURE", CYAN, BLACK, 92, 26, 8)
    arrow(c, 150, H - 372, 184, H - 372, FAINT)
    chip(c, 190, H - 385, "COMPILE", BLUE, WHITE, 92, 26, 8)
    arrow(c, 284, H - 372, 318, H - 372, FAINT)
    chip(c, 324, H - 385, "MIRROR", MINT, BLACK, 92, 26, 8)
    arrow(c, 418, H - 372, 452, H - 372, FAINT)
    chip(c, 458, H - 385, "COMMIT", AMBER, BLACK, 92, 26, 8)
    arrow(c, 552, H - 372, 586, H - 372, FAINT)
    chip(c, 592, H - 385, "LEARN", MAGENTA, BLACK, 92, 26, 8)

    round_rect(c, 730, 95, 408, 610, fill=PANEL, stroke=GRID, radius=16)
    label(c, "MAP OF VARIATIONS", 758, 665, 9, CYAN)
    items = [
        ("A", "System spine", "end-to-end value and authority", MINT),
        ("B", "Signal compiler", "audio-to-critique extraction contract", BLUE),
        ("C", "Live sequence", "fast/slow lanes, latency and recovery", CYAN),
        ("D", "Critique ledger", "project memory and artifact revision", AMBER),
        ("E", "Evaluation twin", "simulation, faults and measurable gates", MAGENTA),
        ("F", "Experience & governance", "before/during/after surfaces", MINT),
        ("G", "Production architecture", "trust boundaries and scale path", BLUE),
        ("H", "Business wedge", "market seam, moat and investor gates", MAGENTA),
    ]
    y = 615
    for letter, name, body, color in items:
        chip(c, 758, y - 15, letter, color, BLACK, 28, 24, 8)
        label(c, name, 800, y, 10, INK)
        paragraph(c, body, 800, y - 15, 290, 7.6, 9.4, MUTED, max_lines=2)
        c.setStrokeColor(GRID)
        c.line(758, y - 37, 1106, y - 37)
        y -= 65

    explanation(
        c,
        56,
        92,
        628,
        "How to read this document",
        "Green is implemented in the repository. Blue is the next product boundary. Amber marks decisions that remain human-authoritative. Red names a risk or evidence gate. Purple marks market logic, not validated demand.",
    )
    label(c, "11 PAGES / VECTOR PDF / SOURCE INCLUDED", 56, 53, 7.5, FAINT)
    footer(c, "TITLE + CONTENTS")
    c.showPage()


def page_system_spine(c: canvas.Canvas) -> None:
    page_base(
        c,
        2,
        "Variation A / executive system map",
        "The critique intelligence spine",
        "A live cognitive mirror is only the visible edge. The durable product is a correctable chain from source speech to artifact revision.",
    )
    legend(c, 40, H - 116)

    steps = [
        ("1 / CAPTURE", "Live mic\nUploaded audio\nSimulated room", CYAN, "CURRENT"),
        ("2 / COMPILE", "Final source turn\n10 signal types\nExact quote anchor", BLUE, "CURRENT"),
        ("3 / MIRROR", "Criteria coverage\nOpen loops / options\nEvidence gaps", MINT, "CURRENT"),
        ("4 / COMMIT", "Correct / confirm\nHuman disposition\nOwner + deadline", AMBER, "NEXT"),
        ("5 / LINK", "Artifact region\nIssue / approval\nRevision response", MAGENTA, "NEXT"),
        ("6 / LEARN", "Later review context\nEvaluation corpus\nWorkflow memory", BLUE, "NEXT"),
    ]
    x0, y, w, h, gap = 42, 515, 168, 126, 18
    centers: list[tuple[float, float]] = []
    for i, (title, body, color, tag) in enumerate(steps):
        x = x0 + i * (w + gap)
        node(c, x, y, w, h, title, body, color, tag)
        centers.append((x + w / 2, y + h / 2))
        if i:
            arrow(c, x - gap + 3, y + h / 2, x - 4, y + h / 2, color)

    panel(
        c,
        42,
        236,
        344,
        236,
        "Input contract",
        "Three sources, one ingestion boundary",
        CYAN,
    )
    inputs = [
        ("LIVE", "AudioWorklet -> PCM16 -> streaming ASR", CURRENT),
        ("INJECTED", "Synthetic finalized turns -> same queue", CURRENT),
        ("ACOUSTIC", "TTS voices -> mixed WAV/MP3 -> browser playback -> ASR", CURRENT),
        ("FUTURE", "Upload/past recording -> chunked ASR with replayable events", NEXT),
    ]
    iy = 403
    for title, body, color in inputs:
        chip(c, 62, iy - 12, title, color, BLACK, 62, 19, 6.3)
        paragraph(c, body, 134, iy, 225, 7.5, 9.3, MUTED, max_lines=2)
        iy -= 45

    panel(
        c,
        405,
        236,
        365,
        236,
        "Authority contract",
        "The model proposes; people govern meaning and consequence",
        HUMAN,
    )
    auth = [
        ("AUTOMATIC", "quote anchors, candidate signals, criteria coverage, suspected gaps", CURRENT),
        ("CONFIRM", "decision, action owner, deadline, identity, artifact target", HUMAN),
        ("DISPOSITION", "accept / adapt / defer / reject / unresolved", HUMAN),
        ("PROHIBITED", "personality, competence, engagement, or participant ranking", RISK),
    ]
    ay = 403
    for title, body, color in auth:
        chip(c, 426, ay - 12, title, color, BLACK, 78, 19, 6.2)
        paragraph(c, body, 516, ay, 224, 7.5, 9.3, MUTED, max_lines=2)
        ay -= 45

    panel(
        c,
        789,
        236,
        359,
        236,
        "Compounding value",
        "What becomes more useful across reviews",
        MAGENTA,
    )
    value = [
        ("NOW", "source-linked Radar reduces meeting-memory loss", CURRENT),
        ("NEXT", "corrections and dispositions produce trusted project state", NEXT),
        ("THEN", "claim -> decision -> action -> revision explains why work changed", NEXT),
        ("MOAT TEST", "teams return because the graph matters, not because recording is easy", RISK),
    ]
    vy = 403
    for title, body, color in value:
        chip(c, 810, vy - 12, title, color, BLACK, 72, 19, 6.2)
        paragraph(c, body, 894, vy, 222, 7.5, 9.3, MUTED, max_lines=2)
        vy -= 45

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "A system of record for design-review reasoning, not an AI reviewer. The live HUD earns attention; the ledger earns retention. The unproven commercial step is whether teams will perform lightweight confirmation and link critique to the artifact workflow.",
    )
    footer(c, "VARIATION A / SYSTEM SPINE")
    c.showPage()


def page_compiler(c: canvas.Canvas) -> None:
    page_base(
        c,
        3,
        "Variation B / extraction architecture",
        "The critique signal compiler",
        "Untrusted audio and model output are compiled through explicit types, source constraints, and failure gates before anything reaches the public Radar.",
    )
    legend(c, 40, H - 116)

    # Left: concrete example
    panel(c, 42, 484, 348, 214, "One turn in", "Concrete source event", CYAN)
    chip(c, 62, 642, "SOURCE TURN T-104", CYAN, BLACK, 116, 21, 6.8)
    paragraph(
        c,
        '"In three kiosk tests, the recovery screen revealed the account email before verification."',
        62,
        612,
        298,
        12,
        16,
        INK,
        "Helvetica-Bold",
        max_lines=4,
    )
    paragraph(
        c,
        "speaker: provisional A  |  18.2s-22.4s  |  final  |  session-relative clock",
        62,
        538,
        298,
        7.2,
        9,
        MUTED,
        max_lines=2,
    )
    node(
        c,
        42,
        258,
        348,
        196,
        "BOUNDED OUTPUT",
        "",
        CURRENT,
        "VALID",
    )
    fields = [
        ("kind", "evidence"),
        ("summary", "Kiosk recovery exposes identity too early"),
        ("sourceQuote", "exact full sentence above"),
        ("target", "recovery screen / identity reveal"),
        ("criterion", "privacy in shared settings"),
        ("stance", "challenges"),
        ("evidenceBasis", "reported_evidence"),
        ("confidence", "0.90, private diagnostic"),
    ]
    fy = 412
    for key, value in fields:
        label(c, key, 62, fy, 6.8, CYAN)
        paragraph(c, value, 144, fy, 218, 7.1, 8.5, INK, max_lines=1)
        fy -= 19

    # Center: compiler gates
    panel(
        c,
        411,
        258,
        365,
        440,
        "Compiler stages",
        "Every stage narrows authority",
        BLUE,
    )
    stages = [
        ("01", "INGEST", "final turn + timing + provisional speaker", CYAN),
        ("02", "CONTEXT", "objective + phase + facilitator criteria + recent turns", BLUE),
        ("03", "EXTRACT", "max 3 candidates across a 10-kind critique grammar", BLUE),
        ("04", "VALIDATE", "exact quote substring; known criterion; bounded lengths", CURRENT),
        ("05", "NORMALIZE", "confidence clamp; safe enum; dedupe; deterministic fallback", CURRENT),
        ("06", "PROJECT", "Radar counts + source traces + legacy discussion-map adapter", MINT),
    ]
    sy = 625
    for n, title, body, color in stages:
        chip(c, 431, sy - 16, n, color, BLACK, 28, 25, 7)
        label(c, title, 472, sy, 8.2, INK)
        paragraph(c, body, 472, sy - 15, 270, 7.1, 8.8, MUTED, max_lines=2)
        if n != "06":
            arrow(c, 445, sy - 35, 445, sy - 53, FAINT, 1)
        sy -= 62

    # Right: ontology and rejection paths
    panel(c, 797, 427, 351, 271, "Critique grammar", "Signals, not summaries", MAGENTA)
    kinds = [
        ("OBSERVE", "what is present", CYAN),
        ("EVIDENCE", "test/data/reference", MINT),
        ("QUESTION", "information gap", BLUE),
        ("CONCERN", "risk or failure mode", RED),
        ("POSITION", "preferred direction", MAGENTA),
        ("ALTERNATIVE", "competing option", AMBER),
        ("CONSTRAINT", "boundary/trade-off", RED),
        ("DECISION", "confirmed commitment", MINT),
        ("ACTION", "owner / next step", AMBER),
        ("REFERENCE", "precedent / source", CYAN),
    ]
    for i, (title, body, color) in enumerate(kinds):
        col, row = i % 2, i // 2
        x = 817 + col * 155
        y = 627 - row * 41
        chip(c, x, y - 12, title, color, BLACK, 70, 18, 5.9)
        paragraph(c, body, x + 77, y, 70, 6.3, 7.6, MUTED, max_lines=2)

    panel(c, 797, 258, 351, 146, "Reject / degrade safely", "", RISK)
    rejection = [
        ("QUOTE MISS", "discard candidate", RISK),
        ("UNKNOWN CRITERION", "remove criterion link", RISK),
        ("BAD ENUM / LENGTH", "normalize or bound", RISK),
        ("PROVIDER 4XX / DEADLINE", "local exact-quote fallback", AMBER),
    ]
    ry = 366
    for title, body, color in rejection:
        chip(c, 817, ry - 11, title, color, BLACK, 98, 17, 5.8)
        paragraph(c, body, 925, ry, 190, 6.8, 8.2, MUTED, max_lines=1)
        ry -= 27

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "A compiler, not a free-form prompt. The repository implements the green gates today. The next quality jump is a corrected gold set, explicit provider/fallback provenance, and human confirmation for consequential decision/action claims.",
    )
    footer(c, "VARIATION B / SIGNAL COMPILER")
    c.showPage()


def page_sequence(c: canvas.Canvas) -> None:
    page_base(
        c,
        4,
        "Variation C / live operating model",
        "Two clocks, three lanes, one recoverable room",
        "Transcript immediacy, critique interpretation, and durable project state should not share one latency or authority budget.",
    )
    legend(c, 40, H - 116)

    lanes = [
        (621, "FAST / 0-2s", "partial transcript, room confidence", CYAN),
        (460, "INTERPRET / 1-15s", "final turns, signals, safe fallback", BLUE),
        (285, "DURABLE / after + next review", "confirmation, disposition, revision", AMBER),
    ]
    for y, name, body, color in lanes:
        c.setFillColor(BLACK)
        c.setStrokeColor(color)
        c.roundRect(42, y - 20, 1106, 112, 10, fill=1, stroke=1)
        chip(c, 54, y + 58, name, color, BLACK, 116, 19, 6.2)
        paragraph(c, body, 54, y + 39, 125, 7, 8.5, MUTED, max_lines=3)

    actors = [
        ("ROOM", CYAN),
        ("BROWSER", CYAN),
        ("ASR", BLUE),
        ("INGEST", MINT),
        ("QUEUE", BLUE),
        ("MODEL", MAGENTA),
        ("RADAR", MINT),
        ("HUMAN", AMBER),
        ("LEDGER", BLUE),
    ]
    x0, col_w, top, bottom = 210, 105, 680, 190
    xs: list[float] = []
    for i, (name, color) in enumerate(actors):
        x = x0 + i * col_w
        xs.append(x)
        chip(c, x - 36, top, name, color, BLACK, 72, 21, 6.5)
        c.setStrokeColor(GRID)
        c.setDash(3, 4)
        c.line(x, top - 8, x, bottom)
        c.setDash()

    events = [
        (0, 1, 656, "speech / mixed playback", CYAN, False),
        (1, 2, 625, "PCM16 frames", CYAN, False),
        (2, 1, 594, "partials + speaker", CYAN, False),
        (2, 3, 545, "final turn", MINT, False),
        (3, 4, 514, "immutable source event", MINT, False),
        (4, 5, 483, "bounded batch + criteria", BLUE, False),
        (5, 4, 447, "JSON or provider failure", MAGENTA, False),
        (4, 6, 416, "validated signals / fallback", MINT, False),
        (6, 7, 335, "request confirmation", AMBER, False),
        (7, 8, 304, "correct + disposition + link", AMBER, False),
        (8, 6, 255, "continuity at next review", BLUE, True),
    ]
    for src, dst, y, text_value, color, dashed in events:
        direction = 1 if dst > src else -1
        arrow(
            c,
            xs[src] + direction * 8,
            y,
            xs[dst] - direction * 8,
            y,
            color,
            1.4,
            dashed,
        )
        mid = (xs[src] + xs[dst]) / 2
        text_w = min(abs(xs[dst] - xs[src]) - 18, 260)
        paragraph(c, text_value, mid - text_w / 2, y + 10, text_w, 6.6, 8, INK, max_lines=1)

    # Failure/recovery notes
    note_data = [
        (48, 146, 252, "ASR LOSS", "keep room UI honest; no fabricated transcript", RISK),
        (316, 146, 252, "MODEL 4XX", "bounded local signal; mark provenance", AMBER),
        (584, 146, 252, "DEADLINE", "abort provider; persist fallback; measure rate", AMBER),
        (852, 146, 296, "SSE RECONNECT", "snapshot + event replay next", NEXT),
    ]
    for x, y, w, title, body, color in note_data:
        node(c, x, y, w, 64, title, body, color, None, BLACK, 7.5)

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "The public screen must never wait for perfect intelligence. Current code separates transcript and analysis, validates SSE framing, and falls back on model failure/deadline. The next production step is a durable event log so reconnects and late enrichment cannot lose state.",
    )
    footer(c, "VARIATION C / LIVE SEQUENCE")
    c.showPage()


def page_ledger(c: canvas.Canvas) -> None:
    page_base(
        c,
        5,
        "Variation D / durable information model",
        "The Critique Ledger: what survives the meeting",
        "A graph of evidence and human judgment should replace the disposable AI summary as the durable unit of design review.",
    )
    legend(c, 40, H - 116)

    # Project graph
    panel(c, 42, 224, 746, 476, "Project critique graph", "Typed lineage across sessions", AMBER)
    nodes = {
        "intent": (78, 574, 150, 74, "INTENT v3", "goal + criteria + constraints", BLUE, "NEXT"),
        "turn": (78, 397, 150, 74, "SOURCE TURN", "exact phrase + speaker + time", CURRENT, "CURRENT"),
        "signal": (286, 483, 160, 80, "CRITIQUE SIGNAL", "concern / alternative / evidence", CURRENT, "CURRENT"),
        "criterion": (286, 594, 160, 62, "CRITERION", "privacy in shared settings", CURRENT, "CURRENT"),
        "tension": (504, 546, 160, 78, "TENSION", "privacy vs recognition speed", NEXT, "NEXT"),
        "decision": (504, 416, 160, 78, "DECISION", "human-confirmed commitment", AMBER, "NEXT"),
        "action": (504, 286, 160, 78, "ACTION", "owner + deadline + status", AMBER, "NEXT"),
        "revision": (680, 416, 84, 130, "ARTIFACT", "revision + region + diff + rationale", MAGENTA, "NEXT"),
    }
    for _, (x, y, w, h, title, body, color, tag) in nodes.items():
        node(c, x, y, w, h, title, body, color, tag, title_size=8.2)

    relations = [
        ("turn", "signal", "DERIVES", CURRENT),
        ("signal", "criterion", "ADDRESSES", CURRENT),
        ("signal", "tension", "CHALLENGES / SUPPORTS", NEXT),
        ("intent", "tension", "FRAMES", NEXT),
        ("tension", "decision", "RESOLVED BY", AMBER),
        ("decision", "action", "COMMITS", AMBER),
        ("action", "revision", "IMPLEMENTED IN", MAGENTA),
        ("revision", "intent", "SUPERSEDES / REFRAMES", NEXT),
    ]
    for src, dst, rel, color in relations:
        sx, sy, sw, sh, *_ = nodes[src]
        dx, dy, dw, dh, *_ = nodes[dst]
        x1, y1 = sx + sw / 2, sy + sh / 2
        x2, y2 = dx + dw / 2, dy + dh / 2
        arrow(c, x1, y1, x2, y2, color, 1.1, src == "revision")
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        c.setFillColor(BLACK)
        c.roundRect(mx - 43, my - 7, 86, 14, 5, fill=1, stroke=0)
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 5.4)
        c.drawCentredString(mx, my - 2, rel)

    # Right side lifecycle
    panel(c, 810, 224, 338, 476, "Human disposition loop", "The learner/team owns the epistemic move", HUMAN)
    disposition = [
        ("ACCEPT", "Adopt the concern or direction", MINT),
        ("ADAPT", "Keep the concern, change the response", BLUE),
        ("DEFER", "Preserve it for a later test", AMBER),
        ("REJECT", "Decline with a rationale", RED),
        ("UNRESOLVED", "Keep competing positions visible", MAGENTA),
    ]
    dy = 627
    for title, body, color in disposition:
        node(c, 832, dy - 34, 294, 48, title, body, color, "HUMAN", BLACK, 7.8)
        dy -= 59

    round_rect(c, 832, 242, 294, 83, fill=BLACK, stroke=AMBER, radius=8)
    label(c, "NEXT REVIEW OPENS WITH", 846, 301, 7, AMBER)
    paragraph(
        c,
        "addressed claims • intentional non-changes • unresolved alternatives • changed intent • evidence still missing",
        846,
        283,
        266,
        7.4,
        10,
        MUTED,
        max_lines=4,
    )

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "The green source-turn and signal nodes exist today. The investable product requires the amber and purple chain: confirmation, disposition, action ownership, artifact region, revision response, and continuity in the next review.",
    )
    footer(c, "VARIATION D / CRITIQUE LEDGER")
    c.showPage()


def page_twin(c: canvas.Canvas) -> None:
    page_base(
        c,
        6,
        "Variation E / verification architecture",
        "The Critique Twin: simulate the room, test the same path",
        "A business-worthy system needs an evaluation twin that can reproduce acoustic stress, provider failure, extraction error, and safe degradation.",
    )
    legend(c, 40, H - 116)

    panel(c, 42, 442, 1106, 255, "One pathway, three sources", "No simulator-only analysis shortcut", CYAN)
    sources = [
        (66, "LIVE ROOM", "shared mic\nhuman overlap\nambient noise", CYAN, "CURRENT"),
        (265, "INJECTED TURNS", "deterministic text\nfast UI/E2E\nno acoustic claim", MINT, "CURRENT"),
        (464, "ACOUSTIC TWIN", "TTS voices\ncross-talk schedule\nWAV + MP3 playback", MAGENTA, "CURRENT"),
    ]
    for x, title, body, color, tag in sources:
        node(c, x, 515, 165, 116, title, body, color, tag)
        arrow(c, x + 165, 573, 696, 573, color, 1.2)
    node(
        c,
        696,
        515,
        183,
        116,
        "SHARED INGEST",
        "AudioWorklet / ASR / turns API / queue",
        BLUE,
        "CURRENT",
    )
    arrow(c, 879, 573, 905, 573, BLUE)
    node(
        c,
        905,
        515,
        215,
        116,
        "CRITIQUE COMPILER",
        "source anchors + signals + Radar + export",
        CURRENT,
        "CURRENT",
    )

    # Fault injection matrix
    panel(c, 42, 216, 530, 194, "Fault injection deck", "Controlled failure, observable recovery", RISK)
    faults = [
        ("ROOM", "noise / reverb / distance / overlap", "WER, DER, final-turn delay"),
        ("ASR", "disconnect / partial revision / label swap", "reconnect, correction, loss"),
        ("MODEL", "4XX / malformed JSON / slow response", "fallback, source validity"),
        ("DELIVERY", "SSE disconnect / duplicate event", "snapshot, replay, dedupe"),
        ("HUMAN", "mis-confirm / late correction", "supersession, audit trail"),
    ]
    fy = 358
    for layer, fault, evidence in faults:
        chip(c, 62, fy - 11, layer, RISK, BLACK, 56, 18, 5.8)
        paragraph(c, fault, 130, fy, 190, 6.8, 8.2, INK, max_lines=1)
        paragraph(c, evidence, 330, fy, 216, 6.8, 8.2, MUTED, max_lines=1)
        fy -= 29

    panel(c, 591, 216, 557, 194, "Evaluation scorecard", "Quality, latency, trust, adoption", MAGENTA)
    metrics = [
        ("CAPTURE", "WER / DER / overlap recall / final-turn latency", CYAN),
        ("COMPILER", "signal precision/recall / exact-anchor rate / false decision", BLUE),
        ("RECOVERY", "fallback rate / state loss / duplicate suppression", MINT),
        ("HUMAN", "correction time / confirmation rate / disputed claims", AMBER),
        ("PRODUCT", "revision-link rate / recurring review capture / retention", MAGENTA),
    ]
    my = 358
    for layer, body, color in metrics:
        chip(c, 611, my - 11, layer, color, BLACK, 68, 18, 5.8)
        paragraph(c, body, 691, my, 425, 6.9, 8.2, MUTED, max_lines=1)
        my -= 29

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "The current simulator is more than demo machinery: it can become the release gate for the live product. Injected turns prove interface behavior; acoustic playback tests the audio path; natural-review gold sets must still validate semantic extraction.",
    )
    footer(c, "VARIATION E / EVALUATION TWIN")
    c.showPage()


def page_experience(c: canvas.Canvas) -> None:
    page_base(
        c,
        7,
        "Variation F / experience and governance",
        "Four surfaces, one explicit authority budget",
        "The product should reveal different information before, during, after, and at the next review—without turning participants into scores.",
    )
    legend(c, 40, H - 116)

    surfaces = [
        (
            42,
            "1 / BEFORE",
            "Session contract",
            [
                "objective + phase",
                "facilitator-authored criteria",
                "participant labels / visibility",
                "recording, retention, consent",
                "prompting on/off",
            ],
            BLUE,
            "PARTIAL",
        ),
        (
            318,
            "2 / DURING",
            "Public Critique Radar",
            [
                "latest source turns",
                "criteria: unaddressed / discussed / evidenced",
                "open loops / options / decisions / actions",
                "evidence-gap count",
                "no competence or engagement scores",
            ],
            MINT,
            "CURRENT",
        ),
        (
            594,
            "3 / FACILITATE",
            "Private control room",
            [
                "speaker uncertainty + correction",
                "raw/derived source links",
                "approve / suppress / correct",
                "rejected guard outputs",
                "pause and audience controls",
            ],
            AMBER,
            "NEXT",
        ),
        (
            870,
            "4 / AFTER",
            "Project ledger",
            [
                "confirm decision and action",
                "accept / adapt / defer / reject",
                "link artifact region / issue",
                "attach revision rationale",
                "carry unresolved views forward",
            ],
            MAGENTA,
            "NEXT",
        ),
    ]
    for x, step, title, bullets, color, tag in surfaces:
        node(c, x, 374, 254, 306, step, "", color, tag)
        label(c, title, x + 16, 624, 13, INK)
        by = 586
        for bullet in bullets:
            c.setFillColor(color)
            c.circle(x + 21, by + 2, 3, fill=1, stroke=0)
            paragraph(c, bullet, x + 33, by + 6, 194, 8.2, 10.4, MUTED, max_lines=2)
            by -= 42
        if x < 870:
            arrow(c, x + 254, 527, x + 271, 527, FAINT)

    # Audience / agency matrix
    panel(c, 42, 205, 1106, 137, "Audience and agency matrix", "Information is scoped by consequence", HUMAN)
    headers = ["INFORMATION", "PUBLIC ROOM", "FACILITATOR", "PROJECT OWNER", "ORG ADMIN"]
    widths = [260, 190, 190, 190, 190]
    x = 62
    for header, width in zip(headers, widths):
        label(c, header, x, 307, 6.8, CYAN)
        x += width
    rows = [
        ("exact source + provisional signal", "view", "correct", "correct", "policy"),
        ("confidence / provider / rejected output", "hidden", "view", "audit", "aggregate"),
        ("decision / action / disposition", "candidate", "confirm", "author", "policy"),
        ("audio retention / identity / sharing", "disclosure", "operate", "consent", "govern"),
    ]
    ry = 284
    for row in rows:
        x = 62
        for i, (cell, width) in enumerate(zip(row, widths)):
            paragraph(c, cell, x, ry, width - 14, 7, 8.2, INK if i == 0 else MUTED, max_lines=1)
            x += width
        c.setStrokeColor(GRID)
        c.line(62, ry - 10, 1124, ry - 10)
        ry -= 24

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "A deliberate separation between awareness and authority. The current public Radar is restrained and signal-based. The private correction surface, consent/retention controls, and post-review disposition workflow are prerequisites for trusted organizational use.",
    )
    footer(c, "VARIATION F / EXPERIENCE + GOVERNANCE")
    c.showPage()


def page_production(c: canvas.Canvas) -> None:
    page_base(
        c,
        8,
        "Variation G / production and trust",
        "From one healthy Fly machine to a replayable service",
        "The current vertical slice is deployable, but the production product needs durable events, tenant boundaries, asynchronous workers, and deletion guarantees.",
    )
    legend(c, 40, H - 116)

    panel(c, 42, 414, 506, 284, "Current vertical slice", "Validated on Fly.io", CURRENT)
    current_nodes = [
        (64, 584, 132, 74, "NEXT.JS UI", "facilitator / display / simulator", CURRENT),
        (222, 584, 132, 74, "ROUTE HANDLERS", "sessions / turns / SSE", CURRENT),
        (380, 584, 140, 74, "PROVIDERS", "AssemblyAI / OpenAI", CURRENT),
        (144, 460, 150, 74, "IN-MEMORY", "queues / pubsub / timers", AMBER),
        (328, 460, 150, 74, "SQLITE VOLUME", "11 models / one machine", AMBER),
    ]
    for args in current_nodes:
        node(c, *args)
    arrow(c, 196, 621, 222, 621, CURRENT)
    arrow(c, 354, 621, 380, 621, CURRENT)
    elbow_arrow(c, [(288, 584), (288, 555), (219, 534)], CURRENT)
    arrow(c, 294, 497, 328, 497, CURRENT)
    chip(c, 63, 430, "LIMIT", RISK, BLACK, 47, 18, 6)
    paragraph(
        c,
        "process-local state + SQLite prevent safe horizontal scale; no auth/tenancy/event replay",
        122,
        442,
        390,
        7.3,
        9,
        MUTED,
        max_lines=2,
    )

    panel(c, 572, 414, 576, 284, "Target service architecture", "Replayable, tenant-scoped, observable", NEXT)
    target_nodes = [
        (594, 590, 126, 65, "EDGE / AUTH", "org + role + consent", BLUE),
        (744, 590, 126, 65, "API", "idempotent commands", BLUE),
        (894, 590, 126, 65, "EVENT LOG", "source + derivations", BLUE),
        (1040, 590, 84, 65, "SSE", "replay", BLUE),
        (670, 476, 142, 65, "DURABLE WORKERS", "ASR / compiler / export", MAGENTA),
        (844, 476, 126, 65, "POSTGRES", "tenant graph", BLUE),
        (994, 476, 130, 65, "OBJECT STORE", "audio + artifacts", BLUE),
    ]
    for args in target_nodes:
        node(c, *args, title_size=7.7)
    arrow(c, 720, 622, 744, 622, BLUE)
    arrow(c, 870, 622, 894, 622, BLUE)
    arrow(c, 1020, 622, 1040, 622, BLUE)
    elbow_arrow(c, [(807, 590), (807, 558), (741, 541)], MAGENTA)
    arrow(c, 812, 508, 844, 508, BLUE)
    arrow(c, 970, 508, 994, 508, BLUE)
    elbow_arrow(c, [(907, 541), (907, 558), (957, 590)], BLUE)

    # Trust boundary
    panel(c, 42, 205, 1106, 177, "Trust boundary checklist", "Security is part of the product claim", RISK)
    trust = [
        ("IDENTITY", "SSO, org/project roles, participant alias policy", NEXT),
        ("CONSENT", "visible recording state, purpose, revocation path", NEXT),
        ("RETENTION", "per-session audio/transcript policy + tested deletion", NEXT),
        ("TENANCY", "row/object isolation; no cross-customer learning by default", NEXT),
        ("DERIVATION", "model/prompt/fallback/source IDs; correction supersedes", NEXT),
        ("OBSERVABILITY", "latency, fallback, error, reconnect, cost—no raw secrets", CURRENT),
        ("DELIVERY", "idempotent ingest + transactional outbox + replay", NEXT),
        ("EXPORT", "portable graph and evidence; customer controls lifecycle", NEXT),
    ]
    for i, (title, body, color) in enumerate(trust):
        col, row = i % 4, i // 4
        x = 62 + col * 265
        y = 324 - row * 67
        chip(c, x, y - 11, title, color, BLACK, 76, 18, 5.7)
        paragraph(c, body, x, y - 25, 238, 6.8, 8.4, MUTED, max_lines=3)

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "The Fly deployment proves a coherent slice, not production readiness. The decisive architectural move is an append-only, tenant-scoped event spine: source turns remain stable, derivations are versioned, human corrections supersede them, and clients can replay state after failure.",
    )
    footer(c, "VARIATION G / PRODUCTION ARCHITECTURE")
    c.showPage()


def page_business(c: canvas.Canvas) -> None:
    page_base(
        c,
        9,
        "Variation H / market and moat",
        "The business wedge is the seam between speech and artifact",
        "Generic notes are crowded. Artifact review is occupied. The opening is a trustworthy handoff from spoken critique to revision rationale.",
    )
    legend(c, 40, H - 116)

    # Three category columns / bridge
    panel(c, 42, 405, 325, 292, "Meeting intelligence", "Crowded / low price anchor", RISK)
    left = [
        ("TEAMS", "live notes, decisions, questions, tasks, in-person mobile"),
        ("READ", "reports, metrics, uploads; $15-$19.75 Pro; $5 EDU"),
        ("GRANOLA", "notes, templates, integrations; $14 Business"),
        ("FATHOM", "summaries and actions; free + $15-$29 tiers"),
    ]
    y = 630
    for title, body in left:
        chip(c, 62, y - 12, title, RISK, BLACK, 68, 19, 6)
        paragraph(c, body, 142, y, 198, 7, 9, MUTED, max_lines=2)
        y -= 55

    panel(c, 823, 405, 325, 292, "Artifact review", "High workflow value / owned surfaces", MAGENTA)
    right = [
        ("FIGMA", "region comments, threads, resolution, versions"),
        ("FILESTAGE", "visual review, compare, approval"),
        ("AUTODESK", "design coordination, issues, accountability"),
        ("DOVETAIL", "source-traceable qualitative evidence"),
    ]
    y = 630
    for title, body in right:
        chip(c, 843, y - 12, title, MAGENTA, BLACK, 78, 19, 6)
        paragraph(c, body, 933, y, 188, 7, 9, MUTED, max_lines=2)
        y -= 55

    round_rect(c, 391, 430, 408, 242, fill=BLACK, stroke=AMBER, radius=16, line_width=1.6)
    chip(c, 416, 625, "CRITIQUE LEDGER", AMBER, BLACK, 128, 24, 7)
    label(c, "THE WORKFLOW SEAM", 416, 599, 15, INK)
    paragraph(
        c,
        "spoken evidence + competing positions + confirmed decision + owned action + artifact region + later revision rationale",
        416,
        568,
        350,
        11,
        15,
        INK,
        "Helvetica-Bold",
        max_lines=6,
    )
    arrow(c, 367, 540, 391, 540, AMBER, 2)
    arrow(c, 799, 540, 823, 540, AMBER, 2)
    chip(c, 416, 455, "MUST INTEGRATE — NOT REPLACE", BLUE, WHITE, 206, 20, 6.2)

    # ICP and moat ladder
    panel(c, 42, 206, 538, 166, "Beachhead", "Recurring, high-value product-design reviews", MARKET)
    beach = [
        ("BUYER", "Head of Design / DesignOps / agency delivery", MARKET),
        ("EVENT", "multi-stakeholder review of valuable work", MARKET),
        ("PAIN", "evidence, dissent, and rationale detach from later change", MARKET),
        ("INTEGRATE", "Figma + Linear/Jira first; Autodesk later", NEXT),
    ]
    by = 329
    for title, body, color in beach:
        chip(c, 62, by - 11, title, color, BLACK, 68, 17, 5.7)
        paragraph(c, body, 142, by, 406, 6.9, 8.3, MUTED, max_lines=1)
        by -= 28

    panel(c, 604, 206, 544, 166, "Defensibility ladder", "Workflow and corrected graph, not the model", BLUE)
    moat = [
        ("0", "ASR / transcript / prompt", "commodity", RISK),
        ("1", "critique ontology + exact anchors", "useful contract", CURRENT),
        ("2", "corrections + disposition + revision link", "trusted workflow", NEXT),
        ("3", "multi-session project graph + integrations", "switching value", NEXT),
        ("4", "consented correction corpus + eval twin", "quality flywheel", MAGENTA),
    ]
    my = 329
    for n, body, state, color in moat:
        chip(c, 624, my - 11, n, color, BLACK, 22, 17, 6)
        paragraph(c, body, 658, my, 296, 6.8, 8.2, INK, max_lines=1)
        chip(c, 1010, my - 11, state.upper(), color, BLACK, 110, 17, 5.4)
        my -= 28

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "A narrow wedge with adjacent incumbents on both sides. The company wins only if integrations make the bridge effortless and teams repeatedly use the graph to explain or govern revisions. Education is a strong pilot channel, not the first scalable revenue thesis.",
    )
    footer(c, "VARIATION H / BUSINESS WEDGE")
    c.showPage()


def page_investor(c: canvas.Canvas) -> None:
    page_base(
        c,
        10,
        "Investor lens / falsifiable thesis",
        "Promising, not yet investable",
        "The rational next step is a milestone-bound design-partner program. More demo polish cannot substitute for paid repeated use.",
    )
    legend(c, 40, H - 116)

    # Verdict
    round_rect(c, 42, 541, 1106, 156, fill=BLACK, stroke=AMBER, radius=14, line_width=1.5)
    chip(c, 66, 648, "VERDICT", AMBER, BLACK, 82, 22, 7)
    label(c, "FUND DISCOVERY, NOT SCALE", 66, 611, 23, INK)
    paragraph(
        c,
        "The repo demonstrates a safe extraction spine and a differentiated product hypothesis. It does not demonstrate paid retention, natural-review accuracy, artifact workflow pull, or a durable moat.",
        560,
        643,
        548,
        11,
        15,
        MUTED,
        max_lines=5,
    )

    panel(c, 42, 289, 538, 222, "90-day continue gates", "Proposed management thresholds", MINT)
    gates = [
        ("6 / 10", "teams complete 4+ reviews", MINT),
        ("> 50%", "eligible recurring reviews captured", MINT),
        ("> 70%", "displayed signals have valid exact anchors", MINT),
        ("< 5%", "false 'decision made' claims", MINT),
        ("< 20s", "median correction time", MINT),
        ("> 40%", "important claims linked to action/issue/revision", MINT),
        ("3+", "paid pilots or priced continuations", MINT),
    ]
    gy = 455
    for i, (metric, body, color) in enumerate(gates):
        col, row = i % 2, i // 2
        x = 62 + col * 252
        y = gy - row * 43
        chip(c, x, y - 13, metric, color, BLACK, 58, 21, 6.3)
        paragraph(c, body, x + 70, y, 164, 7.1, 8.8, MUTED, max_lines=2)

    panel(c, 604, 289, 544, 222, "Kill or reposition if", "Evidence beats narrative", RISK)
    kills = [
        "teams export summaries and ignore the graph",
        "disposition/revision linking feels like clerical work",
        "usage requires founder or researcher facilitation",
        "reliable extraction arrives too late for live value",
        "security requirements make the first segment uneconomic",
        "buyers compare only with free notes and reject a workflow premium",
    ]
    ky = 456
    for item in kills:
        c.setFillColor(RISK)
        c.circle(626, ky + 1, 3, fill=1, stroke=0)
        paragraph(c, item, 638, ky + 5, 476, 7.5, 9.3, MUTED, max_lines=2)
        ky -= 31

    # Evidence balance
    panel(c, 42, 178, 1106, 80, "Evidence balance", "", BLUE)
    evidence = [
        ("FOR", "meeting capture and artifact review are paid workflows; provenance matters", MINT),
        ("AGAINST", "incumbents already cover notes, tasks, comments, issues, and evidence repositories", RISK),
        ("UNKNOWN", "whether spoken-critique-to-revision is painful enough to buy separately", AMBER),
    ]
    x = 62
    for title, body, color in evidence:
        chip(c, x, 218, title, color, BLACK, 70, 18, 5.8)
        paragraph(c, body, x, 204, 330, 6.9, 8.4, MUTED, max_lines=3)
        x += 355

    explanation(
        c,
        42,
        70,
        1106,
        "Read this as",
        "A falsifiable company thesis: teams will repeatedly pay to preserve evidence, alternatives, decisions, and revision rationale that meeting tools and artifact comments leave disconnected. Every gate above can invalidate that thesis.",
    )
    footer(c, "INVESTOR VERDICT + GATES")
    c.showPage()


def page_traceability(c: canvas.Canvas) -> None:
    page_base(
        c,
        11,
        "Traceability / evidence ledger",
        "What exists, what is proposed, what was verified",
        "A final map from diagram claims back to repository evidence, live validation, and the current market scan.",
    )
    legend(c, 40, H - 116)

    panel(c, 42, 363, 1106, 335, "Repository capability matrix", "Evidence as of 2026-08-07", CURRENT)
    headers = ["CAPABILITY", "STATE", "REPOSITORY EVIDENCE", "VERIFICATION / NEXT GATE"]
    widths = [230, 95, 405, 336]
    x = 62
    for header, width in zip(headers, widths):
        label(c, header, x, 651, 6.7, CYAN)
        x += width
    rows = [
        ("live browser audio -> ASR", "current", "facilitator mic + AudioWorklet + AssemblyAI token path", "build/E2E; natural-room WER/DER still needed"),
        ("simulated/injected turns", "current", "scenario, run, playback, shared turns route", "54 browser-profile cases"),
        ("acoustic simulation", "current", "TTS, mix schedule, WAV/MP3 assets, audio validation", "unit audio-pipeline test; expand fault deck"),
        ("bounded critique signals", "current", "critique-intelligence.ts + normalized analysis contract", "exact quote/criterion/enum/length tests"),
        ("Critique Radar over SSE", "current", "display page + initial snapshot + intelligence patch", "public Fly screenshot and source-linked probe"),
        ("provider-safe degradation", "current", "4XX fallback + configurable deadline abort/fallback", "public 13.5s deadline-safe probe"),
        ("human signal correction", "next", "not implemented", "median correction time < 20s"),
        ("disposition + artifact link", "next", "not implemented", "> 40% important claims linked"),
        ("durable replay + tenancy", "next", "SQLite + in-memory state today", "Postgres/outbox/object store/auth/deletion tests"),
    ]
    ry = 625
    for capability, state, evidence, gate in rows:
        x = 62
        values = [capability, state.upper(), evidence, gate]
        for i, (value, width) in enumerate(zip(values, widths)):
            color = CURRENT if state == "current" and i == 1 else NEXT if i == 1 else MUTED
            paragraph(c, value, x, ry, width - 12, 6.8, 8.2, color, "Helvetica-Bold" if i == 1 else "Helvetica", max_lines=2)
            x += width
        c.setStrokeColor(GRID)
        c.line(62, ry - 20, 1126, ry - 20)
        ry -= 31

    panel(c, 42, 178, 538, 153, "Test and deployment snapshot", "", MINT)
    snapshot = [
        ("UNIT", "91 / 91 passing at diagram phase"),
        ("BROWSER", "54 / 54 across Chromium, Firefox, WebKit, phones, tablet"),
        ("TYPE / BUILD", "TypeScript clean; 19-route-entry Next production build"),
        ("FLY", "machine healthy; public Critique Radar inspected"),
        ("PUBLIC PROBE", "exact quotes persisted through provider 4XX and deadline"),
        ("PACKAGE AUDIT", "3 high transitive findings remain; Next major migration gate"),
    ]
    sy = 292
    for title, body in snapshot:
        chip(c, 62, sy - 11, title, CURRENT, BLACK, 70, 17, 5.8)
        paragraph(c, body, 144, sy, 402, 6.9, 8.3, MUTED, max_lines=1)
        sy -= 21

    panel(c, 604, 178, 544, 153, "Current market evidence", "", MARKET)
    sources = [
        "Microsoft Teams Facilitator — live notes, decisions, tasks, in-person mobile",
        "Read / Granola / Fathom — commodity feature and price anchors",
        "Figma / Filestage / Autodesk — artifact review and issue workflow",
        "Dovetail — source traceability as adjacent trust property",
        "Figma 2026 report — collaborative decision quality is increasingly salient",
    ]
    sy = 292
    for item in sources:
        c.setFillColor(MARKET)
        c.circle(624, sy + 1, 3, fill=1, stroke=0)
        paragraph(c, item, 636, sy + 5, 478, 6.9, 8.3, MUTED, max_lines=1)
        sy -= 24

    explanation(
        c,
        42,
        70,
        1106,
        "Source guide",
        "Detailed links, pricing caveats, investor reasoning, risks, and go/no-go gates are in 06-product-and-investor-assessment.md. Architecture and novelty background remain in 01-05. The PDF source is generate_critique_intelligence_system.py.",
    )
    footer(c, "TRACEABILITY + SOURCE GUIDE")
    c.showPage()


def render() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Critique Intelligence System — System Evolution and Investor Edition")
    c.setAuthor("Critique HUD research evolution")
    c.setSubject(
        "Detailed architecture variations for source-linked critique intelligence"
    )
    c.setKeywords(
        "critique intelligence, live audio, design review, provenance, diagram"
    )

    title_page(c)
    page_system_spine(c)
    page_compiler(c)
    page_sequence(c)
    page_ledger(c)
    page_twin(c)
    page_experience(c)
    page_production(c)
    page_business(c)
    page_investor(c)
    page_traceability(c)
    c.save()
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    render()
