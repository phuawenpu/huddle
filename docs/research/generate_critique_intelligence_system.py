#!/usr/bin/env python3
"""Generate the concise, codebase-aligned Critique Intelligence System brief."""

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
PANEL_2 = HexColor("#13253C")
INK = HexColor("#F4F7FB")
MUTED = HexColor("#9FB0C7")
FAINT = HexColor("#60738D")
GRID = HexColor("#263A55")
BLUE = HexColor("#5B8CFF")
CYAN = HexColor("#35D5E8")
MINT = HexColor("#41D49A")
AMBER = HexColor("#FFBE55")
MAGENTA = HexColor("#D779FF")
RED = HexColor("#FF6F7E")
BLACK = HexColor("#02060D")


def wrap(value: str, width: float, font: str, size: float) -> list[str]:
    result: list[str] = []
    for raw in value.split("\n"):
        words = raw.split()
        if not words:
            result.append("")
            continue
        line = words[0]
        for word in words[1:]:
            candidate = f"{line} {word}"
            if stringWidth(candidate, font, size) <= width:
                line = candidate
            else:
                result.append(line)
                line = word
        result.append(line)
    return result


def text(
    c: canvas.Canvas,
    value: str,
    x: float,
    top: float,
    width: float,
    size: float = 9,
    color=MUTED,
    font: str = "Helvetica",
    leading: float | None = None,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.25
    lines = wrap(value, width, font, size)
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
    color=INK,
    font: str = "Helvetica-Bold",
) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, value)


def rounded(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill=PANEL,
    stroke=GRID,
    radius: float = 10,
    width: float = 0.8,
) -> None:
    c.setLineWidth(width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def chip(
    c: canvas.Canvas,
    x: float,
    y: float,
    value: str,
    color=BLUE,
    text_color=BLACK,
    width: float | None = None,
    height: float = 20,
    size: float = 6.6,
) -> float:
    width = width or stringWidth(value, "Helvetica-Bold", size) + 18
    c.setFillColor(color)
    c.roundRect(x, y, width, height, height / 2, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", size)
    c.drawCentredString(x + width / 2, y + (height - size) / 2 + 1.2, value)
    return width


def arrow(
    c: canvas.Canvas,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    color=BLUE,
    width: float = 1.5,
) -> None:
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    angle = atan2(y2 - y1, x2 - x1)
    length = 8
    spread = pi / 7
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(
        x2 - length * cos(angle - spread), y2 - length * sin(angle - spread)
    )
    path.lineTo(
        x2 - length * cos(angle + spread), y2 - length * sin(angle + spread)
    )
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def panel(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    subtitle: str,
    accent=BLUE,
) -> None:
    rounded(c, x, y, w, h)
    c.setFillColor(accent)
    c.roundRect(x, y, 6, h, 3, fill=1, stroke=0)
    label(c, title.upper(), x + 18, y + h - 24, 9)
    if subtitle:
        text(c, subtitle, x + 18, y + h - 41, w - 34, 7.3, MUTED, max_lines=2)


def node(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str,
    accent=BLUE,
    status: str | None = None,
) -> None:
    rounded(c, x, y, w, h, PANEL_2, accent, 8, 1)
    c.setFillColor(accent)
    c.rect(x, y + h - 4, w, 4, fill=1, stroke=0)
    label(c, title, x + 12, y + h - 22, 8.5)
    if status:
        sw = stringWidth(status, "Helvetica-Bold", 5.8) + 13
        chip(c, x + w - sw - 8, y + h - 26, status, accent, BLACK, sw, 16, 5.8)
    text(c, body, x + 12, y + h - 40, w - 24, 7.2, MUTED, max_lines=5)


def header(
    c: canvas.Canvas,
    page: int,
    kicker: str,
    title_value: str,
    subtitle: str,
) -> None:
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(GRID)
    c.setLineWidth(0.3)
    for x in range(40, int(W), 40):
        c.line(x, 42, x, H - 92)
    for y in range(42, int(H - 92), 40):
        c.line(40, y, W - 40, y)
    label(c, kicker.upper(), 42, H - 38, 8, CYAN)
    label(c, title_value, 42, H - 68, 22, INK)
    text(c, subtitle, 500, H - 47, W - 600, 8.2, MUTED, max_lines=3)
    c.setStrokeColor(GRID)
    c.line(42, H - 86, W - 42, H - 86)
    chip(c, W - 84, H - 64, f"{page}/3", BLUE, INK, 44, 24, 7)


def footer(c: canvas.Canvas, value: str) -> None:
    c.setStrokeColor(GRID)
    c.line(42, 34, W - 42, 34)
    label(c, "CRITIQUE INTELLIGENCE SYSTEM / SYNTHESIZED BRIEF", 42, 18, 6.6, FAINT)
    label(c, value, W - 310, 18, 6.6, FAINT)


def bullet(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    title_value: str,
    body: str,
    color=BLUE,
) -> None:
    c.setFillColor(color)
    c.circle(x + 4, y + 2, 3.5, fill=1, stroke=0)
    label(c, title_value, x + 16, y, 7.4, INK)
    text(c, body, x + 16, y - 15, width - 16, 7, MUTED, max_lines=3)


def page_now(c: canvas.Canvas) -> None:
    header(
        c,
        1,
        "What this repository is now",
        "Live critique audio → source-linked Critique Radar",
        "One working vertical slice converts live or simulated design-review speech into bounded, exact-quote critique signals. It is not yet a project ledger.",
    )
    chip(c, 42, H - 116, "VERIFIED IN CODE + FLY", MINT, BLACK, 132, 19, 6.3)
    chip(c, 184, H - 116, "NOT A GENERIC SUMMARY", CYAN, BLACK, 139, 19, 6.3)

    # Exact current pipeline
    steps = [
        ("AUDIO SOURCES", "live mic\nsimulated turns\nacoustic playback", CYAN),
        ("FINAL TURN", "speaker label\ntext + timing\nshared turns route", MINT),
        ("COMPILER", "10 signal kinds\nmax 3 / turn\nexact source quote", BLUE),
        ("QUALITY GATES", "known criterion\nexplicit decision words\nprovider fallback", AMBER),
        ("CRITIQUE RADAR", "criteria coverage\nopen / options\ndecisions / actions", MINT),
    ]
    x, y, w, h, gap = 42, 530, 202, 125, 23
    for index, (title_value, body, color) in enumerate(steps):
        node(c, x + index * (w + gap), y, w, h, title_value, body, color, "CURRENT")
        if index:
            start = x + index * (w + gap) - gap + 3
            arrow(c, start, y + h / 2, start + gap - 7, y + h / 2, color)

    panel(c, 42, 272, 526, 222, "Concrete source contract", "What the public probe produced", CYAN)
    chip(c, 62, 446, "SOURCE TURN", CYAN, BLACK, 92, 19, 6.1)
    text(
        c,
        '"Could we use a neutral recovery message, test it with screen-reader users, and reveal account details only after verification?"',
        62,
        414,
        480,
        11,
        INK,
        "Helvetica-Bold",
        15,
        4,
    )
    signals = [
        ("ALTERNATIVE", '"use a neutral recovery message"', "privacy in shared settings", MAGENTA),
        ("QUESTION", '"test it with screen-reader users"', "accessible interaction", BLUE),
        ("CONSTRAINT", '"reveal account details only after verification"', "clear recovery state", RED),
    ]
    sy = 337
    for kind, quote, criterion, color in signals:
        chip(c, 62, sy - 11, kind, color, BLACK, 82, 18, 5.6)
        text(c, quote, 156, sy, 215, 6.9, INK, max_lines=1)
        text(c, criterion, 378, sy, 164, 6.7, MUTED, max_lines=1)
        sy -= 29

    panel(c, 592, 272, 556, 222, "Current code path", "Specific modules and routes—not a future architecture", BLUE)
    code_rows = [
        ("capture", "useAudioCapture + AudioWorklet", "PCM16 frames"),
        ("ASR", "AssemblyAI WebSocket client", "partial/final turns"),
        ("ingest", "POST /api/sessions/[id]/turns", "idempotent source event"),
        ("analysis", "analysis-queue.ts", "batch, deadline, persistence"),
        ("contract", "critique-intelligence.ts", "validate, normalize, aggregate"),
        ("delivery", "events route + sse.ts", "snapshot + live patches"),
        ("surface", "/display/[sessionId]", "Critique Radar + source map"),
    ]
    cy = 445
    for layer, implementation, output in code_rows:
        chip(c, 612, cy - 11, layer.upper(), BLUE, BLACK, 67, 17, 5.5)
        text(c, implementation, 691, cy, 246, 6.9, INK, max_lines=1)
        text(c, output, 942, cy, 176, 6.8, MUTED, max_lines=1)
        cy -= 25

    rounded(c, 42, 78, 1106, 156, BLACK, RED, 10, 1)
    label(c, "CURRENT BOUNDARY", 62, 204, 7.4, RED)
    bounds = [
        ("WORKS", "live/simulated source turns, bounded signals, exact quotes, criteria coverage, safe fallback", MINT),
        ("DOES NOT", "confirm decisions/actions, link artifacts or revisions, preserve project state across reviews", RED),
        ("OPERATES AS", "single Next.js process + SQLite + in-memory queue/SSE on one Fly machine", AMBER),
        ("VALIDATED BY", "93 unit tests, 54 browser cases, TypeScript/build, public Fly source-signal probe", BLUE),
    ]
    by = 176
    for title_value, body, color in bounds:
        chip(c, 62, by - 11, title_value, color, BLACK, 78, 18, 5.7)
        text(c, body, 152, by, 956, 7.2, MUTED, max_lines=1)
        by -= 26
    footer(c, "PAGE 1 / CURRENT SYSTEM")
    c.showPage()


def page_direction(c: canvas.Canvas) -> None:
    header(
        c,
        2,
        "One product direction",
        "From Critique Radar to Critique Ledger",
        "Do not build a broader meeting assistant. Close one workflow seam: spoken design-review reasoning → confirmed action → artifact revision.",
    )
    chip(c, 42, H - 116, "PRODUCT THESIS", MAGENTA, BLACK, 102, 19, 6.2)
    label(
        c,
        "Preserve why the design changed—not merely what the meeting said.",
        158,
        H - 110,
        10,
        INK,
    )

    # Product flow
    stages = [
        ("1 / CAPTURE", "current\nlive or simulated review", CYAN, "CURRENT"),
        ("2 / COMPILE", "current\nsource-linked signals", MINT, "CURRENT"),
        ("3 / CONFIRM", "human\ncorrect decision/action", AMBER, "NEXT"),
        ("4 / DISPOSITION", "human\naccept / adapt / defer /\nreject / unresolved", AMBER, "NEXT"),
        ("5 / LINK", "workflow\nFigma region or issue", MAGENTA, "NEXT"),
        ("6 / RETURN", "next review\nrevision rationale +\nunresolved risks", BLUE, "NEXT"),
    ]
    x, y, w, h, gap = 42, 518, 168, 137, 18
    for i, (title_value, body, color, status) in enumerate(stages):
        node(c, x + i * (w + gap), y, w, h, title_value, body, color, status)
        if i:
            start = x + i * (w + gap) - gap + 3
            arrow(c, start, y + h / 2, start + gap - 7, y + h / 2, color)

    panel(c, 42, 268, 354, 210, "Initial customer", "One beachhead, one review workflow", MAGENTA)
    bullet(c, 62, 425, 310, "WHO", "20–200 person product-design teams and agencies", MAGENTA)
    bullet(c, 62, 372, 310, "BUYER", "Head of Design, DesignOps, or agency delivery lead", MAGENTA)
    bullet(c, 62, 319, 310, "EVENT", "recurring multi-stakeholder review of valuable work", MAGENTA)
    chip(c, 62, 286, "EXPAND LATER", BLUE, BLACK, 86, 18, 5.6)
    text(c, "AEC coordination; education remains a pilot/evaluation channel", 160, 298, 210, 6.8, MUTED, max_lines=2)

    panel(c, 418, 268, 354, 210, "Why this is different", "The opening is a seam, not an empty market", CYAN)
    bullet(c, 438, 425, 310, "MEETING TOOLS", "Teams, Read, Granola, and Fathom already own notes, actions, and in-person capture", RED)
    bullet(c, 438, 354, 310, "ARTIFACT TOOLS", "Figma, Filestage, and Autodesk already own comments, issues, and approvals", MAGENTA)
    bullet(c, 438, 283, 310, "OPENING", "link the spoken evidence and competing positions to the later change", MINT)

    panel(c, 794, 268, 354, 210, "Minimum new data", "Only add what closes the workflow", BLUE)
    records = [
        ("DERIVATION", "model/fallback + source IDs + version"),
        ("CONFIRMATION", "decision/action state + human editor"),
        ("DISPOSITION", "accept/adapt/defer/reject/unresolved"),
        ("ARTIFACT LINK", "tool + file/issue + region/version"),
        ("REVISION RESPONSE", "what changed + rationale + open risk"),
    ]
    ry = 426
    for title_value, body in records:
        chip(c, 814, ry - 11, title_value, BLUE, BLACK, 92, 17, 5.3)
        text(c, body, 918, ry, 202, 6.8, MUTED, max_lines=1)
        ry -= 31

    rounded(c, 42, 78, 1106, 150, BLACK, AMBER, 10, 1)
    label(c, "AUTHORITY RULE", 62, 198, 7.4, AMBER)
    label(c, "The model proposes structure. People decide meaning and consequence.", 62, 169, 15, INK)
    authority = [
        ("AUTOMATIC", "quote anchors, candidate signal, criterion coverage, suspected gap", MINT),
        ("HUMAN", "identity, interpretation, decision, owner/deadline, disposition, artifact link", AMBER),
        ("NEVER", "competence, personality, engagement, or participant ranking", RED),
    ]
    ax = 62
    for title_value, body, color in authority:
        chip(c, ax, 112, title_value, color, BLACK, 76, 18, 5.6)
        text(c, body, ax, 96, 326, 6.7, MUTED, max_lines=2)
        ax += 352
    footer(c, "PAGE 2 / PRODUCT DIRECTION")
    c.showPage()


def page_plan(c: canvas.Canvas) -> None:
    header(
        c,
        3,
        "Build and evidence plan",
        "90 days to prove the workflow—or stop",
        "The next phase is not more taxonomy or more diagram pages. It is a corrected natural-review benchmark plus one artifact workflow integration used repeatedly by paying design partners.",
    )
    chip(c, 42, H - 116, "MILESTONE-BOUND", AMBER, BLACK, 114, 19, 6.2)
    chip(c, 166, H - 116, "NO SCALE CLAIM YET", RED, BLACK, 112, 19, 6.2)

    workstreams = [
        (
            42,
            "1 / TRUST THE EXTRACTION",
            "Weeks 1–4",
            [
                ("BUILD", "show provider/fallback provenance; correct signals; confirm decisions/actions"),
                ("DATA", "20–30 consented natural reviews with source-anchored gold labels"),
                ("MEASURE", "signal precision/recall, false-decision rate, p50/p95 latency, correction time"),
                ("PASS", "≥70% valid anchors; <5% false decisions; median correction <20s"),
            ],
            MINT,
        ),
        (
            418,
            "2 / CLOSE ONE WORKFLOW",
            "Weeks 3–8",
            [
                ("BUILD", "disposition + Figma region + Linear/Jira issue + revision response"),
                ("PILOT", "6–10 product-design teams; four recurring reviews each"),
                ("MEASURE", "capture rate, confirmed claims, revision-link rate, human touches"),
                ("PASS", "≥50% eligible reviews captured; ≥40% important claims linked"),
            ],
            MAGENTA,
        ),
        (
            794,
            "3 / MAKE IT OPERABLE",
            "Weeks 6–12",
            [
                ("BUILD", "auth/tenant roles, retention/deletion, Postgres event log, durable worker"),
                ("FIX", "Next.js major security migration; package audit; replay and idempotency"),
                ("MEASURE", "fallback, reconnect loss, deletion completion, cost/review"),
                ("PASS", "3 paid pilots or priced continuations; no cross-tenant/state-loss defect"),
            ],
            BLUE,
        ),
    ]
    for x, title_value, timeframe, items, color in workstreams:
        panel(c, x, 355, 354, 306, title_value, timeframe, color)
        iy = 602
        for item_title, body in items:
            chip(c, x + 20, iy - 12, item_title, color, BLACK, 58, 18, 5.5)
            text(c, body, x + 90, iy, 236, 7, MUTED, max_lines=3)
            iy -= 61

    panel(c, 42, 195, 538, 126, "Evidence already in hand", "Useful proof, not market validation", MINT)
    evidence = [
        ("93 / 93", "unit tests"),
        ("54 / 54", "browser/device cases"),
        ("19", "Next route entries built"),
        ("v27", "Fly machine healthy"),
        ("12.1s", "real-model public signal result"),
        ("3", "high package findings remain"),
    ]
    ex = 62
    for metric, body in evidence:
        chip(c, ex, 250, metric, MINT if metric != "3" else RED, BLACK, 64, 22, 6.3)
        text(c, body, ex, 233, 72, 6.3, MUTED, max_lines=2)
        ex += 83

    panel(c, 604, 195, 544, 126, "Stop conditions", "What would invalidate the company thesis", RED)
    stops = [
        "teams export summaries but ignore the graph",
        "disposition/revision linking feels like clerical work",
        "usage requires founder facilitation",
        "buyers will only pay generic-notetaker prices",
    ]
    sy = 273
    for i, item in enumerate(stops):
        col, row = i % 2, i // 2
        bullet(c, 624 + col * 252, sy - row * 48, 230, f"KILL {i + 1}", item, RED)

    rounded(c, 42, 78, 1106, 80, BLACK, AMBER, 10, 1)
    chip(c, 62, 118, "DECISION", AMBER, BLACK, 76, 19, 5.8)
    label(
        c,
        "Proceed with paid design-partner discovery; do not launch as a broad meeting assistant.",
        154,
        124,
        13,
        INK,
    )
    text(
        c,
        "The business becomes credible only when teams repeatedly use the critique-to-revision chain without researcher prompting.",
        154,
        102,
        934,
        7.7,
        MUTED,
        max_lines=2,
    )
    footer(c, "PAGE 3 / 90-DAY PROOF PLAN")
    c.showPage()


def render() -> None:
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Critique Intelligence System — Synthesized Codebase and Product Brief")
    c.setAuthor("Critique HUD research evolution")
    c.setSubject("Current system, Critique Ledger direction, and 90-day proof plan")
    c.setKeywords("critique intelligence, live audio, design review, product direction")
    page_now(c)
    page_direction(c)
    page_plan(c)
    c.save()
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    render()
