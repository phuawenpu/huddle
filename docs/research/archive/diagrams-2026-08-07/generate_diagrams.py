#!/usr/bin/env python3
"""Generate five publication-quality vector PDF system diagrams.

The output uses A3 landscape pages and vector primitives throughout. No raster
assets are embedded, so lines and text remain sharp at any zoom level.
"""

from pathlib import Path
from textwrap import wrap

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


OUT = Path(__file__).resolve().parent
PAGE_W, PAGE_H = landscape(A3)

BG = HexColor("#F5F1E8")
INK = HexColor("#17202A")
MUTED = HexColor("#59636E")
LINE = HexColor("#B8B1A5")
NAVY = HexColor("#173B57")
BLUE = HexColor("#2F6F8F")
CYAN = HexColor("#52A7A5")
TEAL = HexColor("#287F76")
GREEN = HexColor("#4D8061")
GOLD = HexColor("#C8943D")
ORANGE = HexColor("#D66B3D")
RED = HexColor("#B84A4A")
PURPLE = HexColor("#73558F")
PINK = HexColor("#B66378")
WHITE = HexColor("#FFFFFF")
PALE_BLUE = HexColor("#E4EEF2")
PALE_TEAL = HexColor("#E3F0ED")
PALE_GOLD = HexColor("#F5EBD8")
PALE_RED = HexColor("#F3E2DE")
PALE_PURPLE = HexColor("#ECE5F2")
PALE_GREEN = HexColor("#E5EEE6")


def setup(filename: str, title: str, subtitle: str):
    c = canvas.Canvas(str(OUT / filename), pagesize=landscape(A3), pageCompression=1)
    c.setTitle(title)
    c.setSubject(subtitle)
    c.setAuthor("Critique HUD research design study")
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    header(c, title, subtitle)
    return c


def header(c, title: str, subtitle: str, version: str | None = None):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 92, PAGE_W, 92, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(42, PAGE_H - 44, title)
    c.setFont("Helvetica", 10.5)
    c.setFillColor(HexColor("#D6E5ED"))
    c.drawString(43, PAGE_H - 67, subtitle)
    if version:
        pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, version, GOLD, WHITE)


def footer(c, text: str):
    c.setStrokeColor(LINE)
    c.line(42, 34, PAGE_W - 42, 34)
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(42, 20, text)
    c.drawRightString(PAGE_W - 42, 20, "Vector A3 | generated 2026-08-07")


def text(
    c,
    value: str,
    x: float,
    y: float,
    width: float,
    size: float = 10,
    color=INK,
    font="Helvetica",
    leading: float | None = None,
    max_lines: int | None = None,
    align: str = "left",
):
    leading = leading or size * 1.25
    avg = max(1, int(width / (size * 0.52)))
    lines = []
    for paragraph in value.split("\n"):
        lines.extend(wrap(paragraph, avg) or [""])
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(".") + "..."
    c.setFont(font, size)
    c.setFillColor(color)
    cursor = y
    for line in lines:
        if align == "center":
            c.drawCentredString(x + width / 2, cursor, line)
        elif align == "right":
            c.drawRightString(x + width, cursor, line)
        else:
            c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def rounded_box(
    c,
    x,
    y,
    w,
    h,
    title,
    body="",
    fill=WHITE,
    stroke=LINE,
    title_color=NAVY,
    body_color=INK,
    accent=None,
    radius=10,
    title_size=12,
    body_size=9,
):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)
    if accent:
        c.setFillColor(accent)
        c.roundRect(x, y, 7, h, 4, stroke=0, fill=1)
    pad = 14 if accent else 11
    text(c, title, x + pad, y + h - 20, w - pad - 9, title_size, title_color, "Helvetica-Bold", max_lines=2)
    if body:
        text(c, body, x + pad, y + h - 40, w - pad - 9, body_size, body_color, max_lines=7)


def lane(c, x, y, w, h, label, fill=WHITE, label_fill=NAVY):
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 9, stroke=1, fill=1)
    c.setFillColor(label_fill)
    c.roundRect(x, y, 112, h, 9, stroke=0, fill=1)
    c.setFillColor(WHITE)
    text(
        c,
        label.upper(),
        x + 10,
        y + h / 2 + 8,
        92,
        8.2,
        WHITE,
        "Helvetica-Bold",
        leading=10,
        max_lines=3,
        align="center",
    )


def pill(c, x, y, w, h, label, fill, color=WHITE, stroke=None, size=8.5):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, h / 2, stroke=1 if stroke else 0, fill=1)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    c.drawCentredString(x + w / 2, y + (h - size) / 2 + 1.5, label)


def arrow(c, x1, y1, x2, y2, color=BLUE, width=1.8, dashed=False, label=None):
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    if dashed:
        c.setDash(5, 4)
    c.line(x1, y1, x2, y2)
    import math

    angle = math.atan2(y2 - y1, x2 - x1)
    length = 9
    spread = 0.5
    p1 = (
        x2 - length * math.cos(angle - spread),
        y2 - length * math.sin(angle - spread),
    )
    p2 = (
        x2 - length * math.cos(angle + spread),
        y2 - length * math.sin(angle + spread),
    )
    c.line(x2, y2, *p1)
    c.line(x2, y2, *p2)
    c.restoreState()
    if label:
        tw = stringWidth(label, "Helvetica-Bold", 8)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        c.setFillColor(BG)
        c.rect(mx - tw / 2 - 5, my - 6, tw + 10, 14, stroke=0, fill=1)
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(mx, my - 2, label)


def section_label(c, label, x, y, w, color=NAVY):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y, label.upper())
    c.setStrokeColor(color)
    c.setLineWidth(1)
    c.line(x, y - 5, x + w, y - 5)


def numbered_circle(c, cx, cy, number, fill=BLUE):
    c.setFillColor(fill)
    c.circle(cx, cy, 13, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(cx, cy - 3.5, str(number))


def callout(c, x, y, w, h, title, body, fill=PALE_GOLD, accent=GOLD):
    c.setFillColor(fill)
    c.setStrokeColor(accent)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 10, stroke=1, fill=1)
    c.setFillColor(accent)
    c.circle(x + 17, y + h - 17, 5, stroke=0, fill=1)
    text(c, title, x + 31, y + h - 20, w - 41, 10.5, NAVY, "Helvetica-Bold", max_lines=1)
    text(c, body, x + 14, y + h - 40, w - 28, 8.5, INK, max_lines=5)


def draw_live_mirror():
    c = setup(
        "01-live-critique-mirror.pdf",
        "Version 1 | Live Critique Mirror",
        "Co-present speech becomes a restrained, correctable public/private cognitive mirror",
    )
    pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, "SELECTED 4/5", GOLD, WHITE)
    top = PAGE_H - 128
    section_label(c, "Evidence pipeline", 42, top, PAGE_W - 84)

    boxes = [
        (42, "ROOM CRITIQUE", "Student, peers and jurors\nOne shared microphone", PALE_GOLD, GOLD),
        (224, "AUDIO + ASR", "Worklet PCM16\nSpeaker-attributed turns", PALE_BLUE, BLUE),
        (406, "SOURCE RECORD", "Immutable turn\nCorrections as revisions", PALE_TEAL, TEAL),
        (588, "DERIVATION", "Claims, questions, alternatives\nEvidence anchors", PALE_PURPLE, PURPLE),
        (770, "INTERVENTION GATE", "Intent relevance\nSource + safety + timing", PALE_RED, RED),
    ]
    for i, (x, title, body, fill, accent) in enumerate(boxes):
        rounded_box(c, x, top - 132, 154, 96, title, body, fill, accent, accent=accent, title_size=10.5)
        if i < len(boxes) - 1:
            arrow(c, x + 154, top - 84, boxes[i + 1][0] - 8, top - 84)

    # fork to surfaces
    fork_x = 955
    arrow(c, 924, top - 84, fork_x, top - 84)
    c.setStrokeColor(BLUE)
    c.setLineWidth(2)
    c.line(fork_x, top - 84, fork_x, top - 282)
    arrow(c, fork_x, top - 145, 990, top - 145)
    arrow(c, fork_x, top - 270, 990, top - 270)
    rounded_box(
        c,
        990,
        top - 190,
        158,
        90,
        "PUBLIC MIRROR",
        "Sparse transcript\nMap + one prompt\nNo confidence scores",
        PALE_BLUE,
        BLUE,
        accent=BLUE,
        title_size=10.5,
    )
    rounded_box(
        c,
        990,
        top - 315,
        158,
        90,
        "PRIVATE CONTROL",
        "Uncertainty + corrections\nVisibility + suppression\nGuard audit",
        PALE_TEAL,
        TEAL,
        accent=TEAL,
        title_size=10.5,
    )

    # Agency budget
    section_label(c, "Public intervention contract", 42, top - 198, 870)
    contracts = [
        ("1", "Relevant", "Current student-authored critique question"),
        ("2", "Grounded", "Visible source phrases and artifact evidence"),
        ("3", "Non-personal", "Describes discourse, never competence or character"),
        ("4", "Restrained", "One prompt, timed, interruptible, optional"),
        ("5", "Correctable", "Human revision supersedes AI derivation"),
    ]
    for i, (n, title, body) in enumerate(contracts):
        x = 42 + i * 174
        numbered_circle(c, x + 13, top - 242, n, [BLUE, TEAL, PURPLE, GOLD, GREEN][i])
        text(c, title, x + 33, top - 238, 125, 9.5, NAVY, "Helvetica-Bold", max_lines=1)
        text(c, body, x + 33, top - 254, 128, 8, MUTED, max_lines=3)

    # Outcome band
    y = 90
    c.setFillColor(NAVY)
    c.roundRect(42, y, PAGE_W - 84, 122, 12, stroke=0, fill=1)
    text(c, "THE MIRROR DOES NOT DECIDE", 64, y + 91, 230, 13, WHITE, "Helvetica-Bold", max_lines=1)
    text(
        c,
        "It makes the critique legible while the student, peers and professor retain judgment.",
        64,
        y + 67,
        260,
        9,
        HexColor("#D6E5ED"),
        max_lines=3,
    )
    outcomes = [
        ("PRESENCE", "Less note-taking during critique"),
        ("TRACE", "Every map item returns to source"),
        ("DISSENT", "Alternatives remain visible"),
        ("AGENCY", "People correct, suppress and decide"),
    ]
    for i, (title, body) in enumerate(outcomes):
        x = 360 + i * 190
        c.setFillColor(WHITE)
        c.roundRect(x, y + 22, 165, 75, 9, stroke=0, fill=1)
        text(c, title, x + 12, y + 76, 141, 9, [BLUE, TEAL, ORANGE, PURPLE][i], "Helvetica-Bold", max_lines=1)
        text(c, body, x + 12, y + 55, 141, 8.2, INK, max_lines=3)

    footer(c, "Novelty boundary: not a new transcript or meeting map; the contribution is the studio-specific two-surface authority contract.")
    c.showPage()
    c.save()


def draw_intent_ledger():
    c = setup(
        "02-intent-ledger.pdf",
        "Version 2 | Intent Ledger",
        "The durable record is the learner-governed lineage from intent and critique to action and revision",
    )
    pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, "CORE SYSTEM", GREEN, WHITE)
    top = PAGE_H - 126
    section_label(c, "Longitudinal provenance loop", 42, top, PAGE_W - 84)

    nodes = [
        ("1", "INTENT REVISION", "What should the design do?\nConstraints + uncertainties", 50, top - 150, PALE_GOLD, GOLD),
        ("2", "ARTIFACT REVISION", "Drawing, model or region\nStudent first claim", 242, top - 150, PALE_BLUE, BLUE),
        ("3", "CRITIQUE EVENT", "Speaker-attributed source\nHuman feedback claim", 434, top - 150, PALE_TEAL, TEAL),
        ("4", "TYPED RELATION", "Aligns / challenges / reframes\nAlternative / execution", 626, top - 150, PALE_PURPLE, PURPLE),
        ("5", "STUDENT DISPOSITION", "Accept / adapt / defer / reject\nor leave unresolved", 818, top - 150, PALE_RED, RED),
        ("6", "REVISION RESPONSE", "Owned action + rationale\nLinked artifact change", 1010, top - 150, PALE_GREEN, GREEN),
    ]
    for i, (n, title, body, x, y, fill, accent) in enumerate(nodes):
        rounded_box(c, x, y, 160, 104, title, body, fill, accent, accent=accent, title_size=9.5, body_size=8.3)
        numbered_circle(c, x + 145, y + 89, n, accent)
        if i < len(nodes) - 1:
            arrow(c, x + 160, y + 52, nodes[i + 1][3] - 8, y + 52, accent)

    # feedback loop down and back
    c.setStrokeColor(GREEN)
    c.setLineWidth(2.2)
    c.line(1090, top - 150, 1090, top - 224)
    c.line(1090, top - 224, 130, top - 224)
    arrow(c, 130, top - 224, 130, top - 160, GREEN, label="NEXT CRITIQUE")

    # Central relation card
    card_y = top - 410
    rounded_box(
        c,
        42,
        card_y,
        530,
        150,
        "ONE CLAIM, FULL LINEAGE",
        "",
        WHITE,
        NAVY,
        accent=NAVY,
        title_size=12,
    )
    quote = '"The threshold feels abrupt from the east approach."'
    text(c, quote, 66, card_y + 102, 470, 11, INK, "Helvetica-Oblique", max_lines=2)
    pill(c, 66, card_y + 54, 84, 22, "CHALLENGES", PURPLE)
    pill(c, 159, card_y + 54, 66, 22, "ADAPT", RED)
    text(c, "Source turn 31 -> intent v2 -> action A7 -> section revision r5", 66, card_y + 34, 470, 8.5, MUTED, max_lines=1)

    # Derivation/audit stack
    rounded_box(
        c,
        592,
        card_y,
        278,
        150,
        "AI DERIVATION RECORD",
        "model + prompt version\ninput source IDs\nprivate confidence\nhuman correction\nsupersedes / superseded by",
        PALE_BLUE,
        BLUE,
        accent=BLUE,
        title_size=10.5,
        body_size=8.5,
    )
    rounded_box(
        c,
        890,
        card_y,
        280,
        150,
        "PROTECTED STATES",
        "Reasoned rejection is valid.\nUnresolved is not failure.\nContradiction is not averaged away.\nPrivate reflection stays private.",
        PALE_GOLD,
        GOLD,
        accent=GOLD,
        title_size=10.5,
        body_size=8.5,
    )

    # Main claim
    callout(
        c,
        42,
        68,
        PAGE_W - 84,
        98,
        "PRIMARY NOVELTY HYPOTHESIS",
        "The learner's disposition and revision response - not the AI summary - become the durable unit of record. This makes critique continuity inspectable without turning disagreement into a score.",
        PALE_GREEN,
        GREEN,
    )
    footer(c, "Closest overlap: Critsly's board context and action planning. Differentiation: typed, versioned spoken-feedback-to-revision lineage.")
    c.showPage()
    c.save()


def draw_studio_commons():
    c = setup(
        "03-studio-commons.pdf",
        "Version 3 | Agency-Preserving Studio Commons",
        "Identity, audience, pacing and accountability are designed as one peer-critique protocol",
    )
    pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, "SELECTED 5/5", PURPLE, WHITE)
    top = PAGE_H - 126

    # Policy stack
    section_label(c, "Identity is layered - not binary", 42, top, 315)
    layers = [
        ("SYSTEM IDENTITY", "Institution may know; used only for consent and abuse response", NAVY),
        ("SESSION IDENTITY", "Real name, persistent pseudonym or one-session pseudonym", BLUE),
        ("RECIPIENT VIEW", "What the presenter sees now; optional staged reveal later", PURPLE),
    ]
    for i, (title, body, accent) in enumerate(layers):
        y = top - 78 - i * 83
        rounded_box(c, 42 + i * 15, y, 300 - i * 30, 64, title, body, WHITE, accent, accent=accent, title_size=9, body_size=7.8)

    section_label(c, "Audience scopes", 388, top, 250)
    audiences = [
        ("PRIVATE", "author only", MUTED),
        ("PRESENTER", "recipient", BLUE),
        ("PRESENTER + PROFESSOR", "supported clarification", TEAL),
        ("PEER GROUP", "bounded discussion", PURPLE),
        ("COURSE", "explicit archive consent", GOLD),
    ]
    for i, (title, body, color) in enumerate(audiences):
        y = top - 44 - i * 45
        pill(c, 388, y, 110, 25, title, color, WHITE, size=7.6)
        text(c, body, 507, y + 8, 120, 8, MUTED, max_lines=1)

    # permission invariant
    callout(
        c,
        665,
        top - 248,
        505,
        228,
        "PERMISSION INVARIANT",
        "An AI summary can never widen the audience of its sources. Its maximum visibility is the intersection of every contributing source policy.",
        PALE_RED,
        RED,
    )
    # show set intersection
    for i, (cx, label, col) in enumerate([(785, "PEER", BLUE), (885, "PROFESSOR", PURPLE), (985, "PRESENTER", GOLD)]):
        c.setFillColor(col)
        c.setFillAlpha(0.35)
        c.circle(cx, top - 178, 66, stroke=0, fill=1)
        c.setFillAlpha(1)
        text(c, label, cx - 40, top - 178, 80, 8, NAVY, "Helvetica-Bold", align="center", max_lines=1)
    pill(c, 842, top - 198, 86, 22, "SAFE OUTPUT", GREEN, WHITE, size=7.5)

    # workflow lanes
    workflow_top = top - 292
    section_label(c, "Peer critique flow", 42, workflow_top, PAGE_W - 84)
    lane_y = [workflow_top - 95, workflow_top - 190, workflow_top - 285]
    labels = ["PEER REVIEWER", "AI MEDIATOR", "PRESENTER / STUDENT"]
    fills = [PALE_BLUE, PALE_PURPLE, PALE_GOLD]
    for y, label, fill in zip(lane_y, labels, fills):
        lane(c, 42, y, PAGE_W - 84, 76, label, fill)

    # lane content
    flow_boxes = [
        (175, lane_y[0] + 14, 168, "1. FIRST ATTEMPT", "Observation before AI"),
        (390, lane_y[0] + 14, 190, "3. SUBMIT", "Chosen identity + audience"),
        (855, lane_y[0] + 14, 220, "6. OPTIONAL REVEAL", "Accountability at agreed time"),
        (270, lane_y[1] + 14, 190, "2. PRIVATE SCAFFOLD", "Evidence? consequence? question?"),
        (625, lane_y[1] + 14, 190, "4. PERMISSION-AWARE", "Group duplicates; retain dissent"),
        (470, lane_y[2] + 14, 190, "5. CONTROL PACING", "Receive now, batch or clarify"),
        (760, lane_y[2] + 14, 210, "7. DISPOSITION", "Accept / adapt / defer / reject"),
    ]
    for x, y, w, title, body in flow_boxes:
        rounded_box(c, x, y, w, 48, title, body, WHITE, LINE, accent=TEAL, title_size=8.2, body_size=7.3)
    arrows = [
        (343, lane_y[0] + 38, 270, lane_y[1] + 38),
        (460, lane_y[1] + 38, 390, lane_y[0] + 38),
        (580, lane_y[0] + 38, 625, lane_y[1] + 38),
        (815, lane_y[1] + 38, 565, lane_y[2] + 62),
        (660, lane_y[2] + 38, 760, lane_y[2] + 38),
        (970, lane_y[2] + 38, 855, lane_y[0] + 38),
    ]
    for x1, y1, x2, y2 in arrows:
        arrow(c, x1, y1, x2, y2, TEAL, width=1.5)

    footer(c, "Novelty boundary: anonymity and AI-assisted peer feedback exist; the claim is layered identity plus permission-preserving derivation and disposition.")
    c.showPage()
    c.save()


def draw_jury_bridge():
    c = setup(
        "04-jury-bridge.pdf",
        "Version 4 | Jury Bridge",
        "A two-tempo system protects presence during critique and supports deliberation afterward",
    )
    pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, "SELECTED 3/5", ORANGE, WHITE)
    top = PAGE_H - 126
    section_label(c, "Two tempos, one source record", 42, top, PAGE_W - 84)

    # timeline
    line_y = top - 88
    c.setStrokeColor(NAVY)
    c.setLineWidth(4)
    c.line(85, line_y, PAGE_W - 85, line_y)
    stages = [
        (105, "BEFORE", "Intent + critique questions", GOLD),
        (310, "LIVE JURY", "Presence, captions, save moments", BLUE),
        (555, "COOL-DOWN", "No forced response", MUTED),
        (750, "REVIEW", "Interpret + preserve conflict", PURPLE),
        (975, "NEXT STUDIO", "Student-edited action path", GREEN),
    ]
    for i, (x, title, body, color) in enumerate(stages):
        c.setFillColor(color)
        c.circle(x, line_y, 13, stroke=0, fill=1)
        text(c, title, x - 70, line_y + 40, 140, 10, color, "Helvetica-Bold", align="center", max_lines=1)
        text(c, body, x - 75, line_y - 33, 150, 8.2, MUTED, align="center", max_lines=2)

    # live layer
    live_y = top - 340
    rounded_box(
        c,
        42,
        live_y,
        510,
        185,
        "TEMPO A | STAY IN THE ROOM",
        "",
        PALE_BLUE,
        BLUE,
        accent=BLUE,
        title_size=12,
    )
    live_features = [
        ("CAPTIONS", "Stable, speaker-attributed"),
        ("SAVE PHRASE", "One tap, no note-taking"),
        ("CLARIFY LATER", "Mark without interrupting"),
        ("REFERENCE QUEUE", "Silent by default; verify later"),
    ]
    for i, (title, body) in enumerate(live_features):
        x = 70 + (i % 2) * 225
        y = live_y + 94 - (i // 2) * 62
        pill(c, x, y + 22, 92, 20, title, [BLUE, TEAL, PURPLE, GOLD][i], WHITE, size=7.4)
        text(c, body, x + 101, y + 28, 100, 7.7, INK, max_lines=2)

    # post layer
    rounded_box(
        c,
        580,
        live_y,
        590,
        185,
        "TEMPO B | RECONSTRUCT, THEN DECIDE",
        "",
        PALE_PURPLE,
        PURPLE,
        accent=PURPLE,
        title_size=12,
    )
    post = [
        ("SOURCE CLUSTERS", "Every interpretation returns to phrases"),
        ("CONTRADICTION SETS", "Juror positions stay separate"),
        ("VERIFIED REFERENCES", "Exact / possible / unknown"),
        ("CANDIDATE ACTIONS", "Student accepts, adapts or rejects"),
    ]
    for i, (title, body) in enumerate(post):
        x = 608 + (i % 2) * 270
        y = live_y + 94 - (i // 2) * 62
        pill(c, x, y + 22, 110, 20, title, [PURPLE, ORANGE, TEAL, GREEN][i], WHITE, size=7.1)
        text(c, body, x + 119, y + 28, 125, 7.7, INK, max_lines=2)

    # Reference validation
    y = 100
    section_label(c, "Reference and interpretation safeguards", 42, y + 150, PAGE_W - 84)
    cards = [
        ("EXACT MATCH", "Known architect/work + verified source", PALE_GREEN, GREEN),
        ("POSSIBLE MATCH", "Ambiguous pronunciation; show alternatives", PALE_GOLD, GOLD),
        ("UNKNOWN", "Preserve phrase; do not invent a citation", PALE_RED, RED),
        ("ABSTRACT COMMENT", "Offer candidate meanings, never a definitive translation", PALE_PURPLE, PURPLE),
    ]
    for i, (title, body, fill, accent) in enumerate(cards):
        x = 42 + i * 282
        rounded_box(c, x, y, 258, 112, title, body, fill, accent, accent=accent, title_size=9.5, body_size=8.2)

    footer(c, "Novelty boundary: meeting assistants summarize; Jury Bridge separates live presence from post-jury learner-controlled interpretation.")
    c.showPage()
    c.save()


def draw_reflective_twin():
    c = setup(
        "05-reflective-twin.pdf",
        "Version 5 | Reflective Twin",
        "A multimodal system compares intent, artifact evidence and human critique without becoming an automated juror",
    )
    pill(c, PAGE_W - 132, PAGE_H - 56, 90, 24, "SELECTED 2/5", TEAL, WHITE)
    top = PAGE_H - 126
    section_label(c, "Evidence enters from three human-grounded sources", 42, top, PAGE_W - 84)

    inputs = [
        (42, "VERSIONED INTENT", "Desired effect\nConstraints\nCurrent uncertainty", PALE_GOLD, GOLD),
        (282, "ARTIFACT + REGIONS", "Drawing / model / CAD export\nStudent annotations", PALE_BLUE, BLUE),
        (522, "HUMAN CRITIQUE", "Speaker-attributed phrases\nContradictions + questions", PALE_TEAL, TEAL),
    ]
    for x, title, body, fill, accent in inputs:
        rounded_box(c, x, top - 130, 210, 92, title, body, fill, accent, accent=accent, title_size=10.5)

    # Student first attempt gate
    rounded_box(
        c,
        790,
        top - 130,
        170,
        92,
        "FIRST ATTEMPT",
        "Student states what they see and why before AI help",
        PALE_RED,
        RED,
        accent=RED,
        title_size=10.5,
        body_size=8.3,
    )
    for start_x in [252, 492, 732]:
        arrow(c, start_x, top - 84, 782, top - 84, MUTED, width=1.2)

    rounded_box(
        c,
        990,
        top - 150,
        180,
        130,
        "EVIDENCE FIELD",
        "Observation\nInterpretation\nHuman claim\nConflict\nMissing evidence",
        NAVY,
        NAVY,
        title_color=WHITE,
        body_color=HexColor("#D6E5ED"),
        accent=GOLD,
        title_size=11,
        body_size=8.5,
    )
    arrow(c, 960, top - 84, 982, top - 84, RED)

    # Four modes
    modes_y = top - 365
    section_label(c, "Four bounded AI modes", 42, modes_y + 180, 860)
    modes = [
        ("1. MIRROR", "Restate relationships\nNo advice", PALE_BLUE, BLUE),
        ("2. QUESTION", 'Ask "what would we expect to see if...?"', PALE_TEAL, TEAL),
        ("3. COUNTER-READING", "Offer another plausible reading\nwith evidence", PALE_PURPLE, PURPLE),
        ("4. TEST DESIGN", "Define a representation or test\nto resolve uncertainty", PALE_GREEN, GREEN),
    ]
    for i, (title, body, fill, accent) in enumerate(modes):
        x = 42 + i * 215
        rounded_box(c, x, modes_y, 195, 135, title, body, fill, accent, accent=accent, title_size=10, body_size=8.5)
        if i:
            c.setStrokeColor(LINE)
            c.setDash(2, 3)
            c.line(x - 10, modes_y + 15, x - 10, modes_y + 120)
            c.setDash()

    # arrow from field to modes and modes to student judgment
    arrow(c, 1080, top - 150, 1080, modes_y + 160, NAVY)
    arrow(c, 1080, modes_y + 160, 900, modes_y + 160, NAVY)

    rounded_box(
        c,
        925,
        modes_y,
        245,
        135,
        "STUDENT JUDGMENT",
        "Correct observation\nChoose a mode\nAccept / adapt / reject\nRevise artifact or intent\nName the next uncertainty",
        PALE_GOLD,
        GOLD,
        accent=GOLD,
        title_size=10.5,
        body_size=8.3,
    )
    arrow(c, 902, modes_y + 68, 917, modes_y + 68, GOLD)

    # loop
    loop_y = 105
    c.setStrokeColor(GREEN)
    c.setLineWidth(2.4)
    c.line(1045, modes_y, 1045, loop_y + 46)
    c.line(1045, loop_y + 46, 150, loop_y + 46)
    arrow(c, 150, loop_y + 46, 150, top - 140, GREEN, label="NEXT REVISION")

    callout(
        c,
        250,
        69,
        700,
        94,
        "NON-EVALUATIVE ONTOLOGY",
        "The twin never stores a single quality score. It stores inspectable observations, multiple interpretations, source claims, conflicts, corrections and tests.",
        PALE_GREEN,
        GREEN,
    )
    footer(c, "Closest overlap: Critsly, DCAI and ArchiJury. Differentiation: first-attempt capture plus non-evaluative, longitudinal evidence comparison.")
    c.showPage()
    c.save()


def main():
    draw_live_mirror()
    draw_intent_ledger()
    draw_studio_commons()
    draw_jury_bridge()
    draw_reflective_twin()
    print("Generated:")
    for path in sorted(OUT.glob("*.pdf")):
        print(f"  {path.name} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
