#!/usr/bin/env python3
"""Generate visual explainer PNGs from the product Markdown docs."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MD_DIR = ROOT / "md"
OUT_DIR = ROOT / "md-explainers"

WIDTH = 1800
MARGIN = 96
GUTTER = 44
CARD_RADIUS = 18

INK = "#0D1B2A"
DUSK_BLUE = "#4A6CF7"
PALE_TEAL = "#A7DAD3"
CLOUD = "#F4F6F8"
MIST = "#D6DCE3"
SLATE = "#39424E"
MUTED = "#667180"
PAPER = CLOUD
PANEL = "#FFFFFF"
LINE = MIST
WHITE = "#ffffff"

PALETTE = [
    INK,
    DUSK_BLUE,
    "#59BDBB",
    "#8D6BE8",
    "#6D7D8D",
    "#263B59",
    "#78CFC7",
    SLATE,
]

FONT_PATHS = {
    "display": [
        "/System/Library/Fonts/NewYork.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    ],
    "regular": [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ],
    "bold": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ],
    "mono": [
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ],
}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_PATHS[kind]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


FONTS = {
    "kicker": font("bold", 23),
    "brand": font("display", 46),
    "title": font("display", 76),
    "subtitle": font("regular", 32),
    "h": font("bold", 32),
    "body": font("regular", 26),
    "small": font("regular", 22),
    "small_bold": font("bold", 22),
    "label": font("bold", 25),
    "mono": font("mono", 22),
}


@dataclass
class Section:
    title: str
    items: list[str]


@dataclass
class Doc:
    path: Path
    title: str
    intro: str
    sections: list[Section]


def clean_inline(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^>\s*", "", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = text.replace("*", "")
    text = text.replace("→", "->").replace("—", "-").replace("–", "-")
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    text = text.replace("·", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -")


def is_table_row(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return False
    cells = [c.strip() for c in stripped.strip("|").split("|")]
    return not all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def is_table_separator(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return False
    cells = [c.strip() for c in stripped.strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def table_to_item(line: str) -> str:
    cells = [clean_inline(c) for c in line.strip().strip("|").split("|")]
    cells = [c for c in cells if c]
    if len(cells) >= 2:
        return f"{cells[0]}: {'; '.join(cells[1:])}"
    return " - ".join(cells)


def read_doc(path: Path) -> Doc:
    title = path.stem
    intro_parts: list[str] = []
    sections: list[Section] = []
    current: Section | None = None
    in_code = False

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        stripped = re.sub(r"^>\s*", "", stripped)
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            if current and stripped and len(current.items) < 8:
                current.items.append(clean_inline(stripped))
            continue
        if not stripped:
            continue
        if clean_inline(stripped).lower().startswith("status:"):
            continue
        if is_table_separator(stripped):
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = clean_inline(heading.group(2))
            if level == 1:
                title = text
                continue
            if level in (2, 3):
                current = Section(text, [])
                sections.append(current)
            elif current and len(current.items) < 8:
                current.items.append(text)
            continue

        bullet = re.match(r"^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$", stripped)
        ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if bullet or ordered:
            item = clean_inline((bullet or ordered).group(1))
            if current:
                current.items.append(item)
            elif len(intro_parts) < 3:
                intro_parts.append(item)
            continue

        if is_table_row(stripped):
            item = table_to_item(stripped)
            if item and current:
                current.items.append(item)
            continue

        paragraph = clean_inline(stripped)
        if current:
            if len(current.items) < 8:
                current.items.append(paragraph)
        elif len(intro_parts) < 3:
            intro_parts.append(paragraph)

    sections = [Section(s.title, compact_items(s.items)) for s in sections]
    substantive_sections = [s for s in sections if s.items]
    if substantive_sections:
        sections = substantive_sections
    if not sections:
        sections = [Section("Core ideas", compact_items(intro_parts))]
    intro = " ".join(intro_parts[:2])
    if not intro and sections and sections[0].items:
        intro = sections[0].items[0]
    if not intro and sections:
        intro = "A focused visual breakdown of the concepts, decisions, and product implications in this document."
    return Doc(path=path, title=title, intro=intro, sections=sections)


def compact_items(items: list[str]) -> list[str]:
    seen: set[str] = set()
    compacted: list[str] = []
    for item in items:
        item = clean_inline(item)
        if not item or len(item) < 3:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        compacted.append(item)
    return compacted[:7]


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: str,
    tracking: int = 9,
) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=fnt, fill=fill)
        x += text_size(draw, char, fnt)[0] + tracking


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, width: int, max_lines: int | None = None) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if text_size(draw, trial, fnt)[0] <= width:
            current = trial
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and text_size(draw, lines[-1] + "...", fnt)[0] > width:
            lines[-1] = lines[-1].rsplit(" ", 1)[0] if " " in lines[-1] else lines[-1][:-1]
        lines[-1] = lines[-1].rstrip(" .,;:") + "..."
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    fnt: ImageFont.FreeTypeFont,
    fill: str,
    width: int,
    line_gap: int = 8,
    max_lines: int | None = None,
) -> int:
    x, y = xy
    lines = wrap(draw, text, fnt, width, max_lines)
    line_h = text_size(draw, "Ag", fnt)[1] + line_gap
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, outline: str | None = None, radius: int = CARD_RADIUS, width: int = 2) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_brand_mark(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: int, surface: str = PANEL) -> None:
    x, y = center
    r = size // 2
    draw.ellipse((x - r, y - r, x + r, y + r), fill=INK)
    draw.ellipse((x - r // 4, y - r + 4, x + r + r // 2, y + r - 6), fill=surface)
    draw.pieslice((x - r + 8, y - r + 4, x + r - 6, y + r - 4), 88, 272, fill=INK)
    orbit = (x - r - 24, y - r // 2 - 8, x + r + 34, y + r // 2 + 18)
    draw.arc(orbit, 188, 28, fill="#73C9C7", width=max(3, size // 18))
    dot_r = max(5, size // 12)
    draw.ellipse((x + r - 4, y - r // 2 - dot_r, x + r - 4 + dot_r * 2, y - r // 2 + dot_r), fill="#59BDBB")


def draw_icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], color: str, variant: int) -> None:
    x, y = center
    r = 30
    draw.ellipse((x - r, y - r, x + r, y + r), fill="#EEF7F7", outline="#D8E7EA", width=2)
    if variant % 6 == 0:
        draw.line((x - 15, y, x + 15, y), fill=color, width=5)
        draw.line((x, y - 15, x, y + 15), fill=color, width=5)
    elif variant % 6 == 1:
        draw.rectangle((x - 14, y - 14, x + 14, y + 14), outline=color, width=5)
    elif variant % 6 == 2:
        draw.arc((x - 18, y - 18, x + 18, y + 18), 30, 330, fill=color, width=5)
        draw.polygon([(x + 16, y - 5), (x + 27, y - 4), (x + 20, y + 6)], fill=color)
    elif variant % 6 == 3:
        draw.line((x - 14, y + 12, x - 4, y - 2, x + 5, y + 6, x + 17, y - 14), fill=color, width=5)
    elif variant % 6 == 4:
        for offset in (-12, 0, 12):
            draw.line((x - 16, y + offset, x + 16, y + offset), fill=color, width=4)
    else:
        draw.polygon([(x, y - 17), (x + 17, y + 12), (x - 17, y + 12)], outline=color, width=5)


def card_height(draw: ImageDraw.ImageDraw, section: Section, card_w: int) -> int:
    inner = card_w - 60
    height = 96
    height += len(wrap(draw, section.title, FONTS["h"], inner, 2)) * 41
    selected = section.items[:4] if section.items else ["Captures the essential decisions and implications from this part of the document."]
    for item in selected:
        height += len(wrap(draw, item, FONTS["body"], inner - 34, 3)) * 34 + 18
    return max(350, min(610, height + 24))


def build_layout_height(doc: Doc) -> int:
    scratch = Image.new("RGB", (WIDTH, 200), PAPER)
    draw = ImageDraw.Draw(scratch)
    card_w = (WIDTH - 2 * MARGIN - GUTTER) // 2
    heights = [card_height(draw, s, card_w) for s in doc.sections]
    rows = [max(heights[i : i + 2]) for i in range(0, len(heights), 2)]
    return 690 + 280 + sum(rows) + GUTTER * max(0, len(rows) - 1) + 180


def draw_header(draw: ImageDraw.ImageDraw, doc: Doc) -> int:
    y = 72
    stem = doc.path.stem.replace("-", " ").upper()
    draw_tracked(draw, (MARGIN, y), "HARNESS DREAMS VISUAL GUIDE", FONTS["kicker"], DUSK_BLUE, tracking=7)
    pill = (WIDTH - MARGIN - 388, y - 14, WIDTH - MARGIN, y + 46)
    rounded(draw, pill, INK, radius=30)
    draw.text((pill[0] + 28, y + 1), stem[:30], font=FONTS["small_bold"], fill=WHITE)
    y += 74

    draw_brand_mark(draw, (WIDTH - MARGIN - 130, y + 70), 128, PAPER)
    draw.text((WIDTH - MARGIN - 330, y + 148), "Harness Dreams", font=FONTS["brand"], fill=INK)

    title_width = WIDTH - 2 * MARGIN - 440
    title_lines = wrap(draw, doc.title, FONTS["title"], title_width, 3)
    for line in title_lines:
        draw.text((MARGIN, y), line, font=FONTS["title"], fill=INK)
        y += 82
    y += 14
    y = draw_wrapped(draw, doc.intro, (MARGIN, y), FONTS["subtitle"], SLATE, title_width, line_gap=12, max_lines=4)
    y += 28
    draw.line((MARGIN, y, WIDTH - MARGIN, y), fill=LINE, width=2)
    y += 42

    box = (MARGIN, y, WIDTH - MARGIN, y + 176)
    rounded(draw, box, WHITE, outline=LINE, radius=18)
    draw.rectangle((MARGIN, y, MARGIN + 8, y + 176), fill=PALE_TEAL)
    draw.text((MARGIN + 34, y + 26), "How to read this guide", font=FONTS["label"], fill=INK)
    quick = "Top band explains the concept. The flow strip shows the system path. Cards break down the major product, data, design, or engineering ideas."
    draw_wrapped(draw, quick, (MARGIN + 34, y + 70), FONTS["body"], MUTED, WIDTH - 2 * MARGIN - 68, max_lines=3)
    return y + 222


def draw_flow(draw: ImageDraw.ImageDraw, doc: Doc, y: int) -> int:
    draw_tracked(draw, (MARGIN, y), "CONCEPT FLOW", FONTS["kicker"], INK, tracking=8)
    y += 62
    items = [s.title for s in doc.sections[:5]]
    if len(items) < 3:
        items = [doc.title, *items, "Outcome"][:5]
    box_w = (WIDTH - 2 * MARGIN - 4 * 24) // 5
    box_h = 130
    for i, item in enumerate(items[:5]):
        x = MARGIN + i * (box_w + 24)
        color = PALETTE[i % len(PALETTE)]
        rounded(draw, (x, y, x + box_w, y + box_h), WHITE, outline=LINE, radius=18)
        draw_icon(draw, (x + 48, y + 44), color, i)
        draw_wrapped(draw, item, (x + 88, y + 24), FONTS["small_bold"], INK, box_w - 110, line_gap=5, max_lines=3)
        if i < len(items[:5]) - 1:
            ax = x + box_w + 5
            ay = y + box_h // 2
            draw.line((ax, ay, ax + 14, ay), fill=MIST, width=4)
            draw.polygon([(ax + 14, ay), (ax + 5, ay - 7), (ax + 5, ay + 7)], fill=MIST)
    return y + box_h + 60


def draw_section_card(draw: ImageDraw.ImageDraw, section: Section, x: int, y: int, w: int, h: int, idx: int) -> None:
    accent = PALETTE[idx % len(PALETTE)]
    shadow = (x + 4, y + 8, x + w + 4, y + h + 8)
    rounded(draw, shadow, "#E8ECF0", radius=18)
    rounded(draw, (x, y, x + w, y + h), PANEL, outline=LINE, radius=18)
    draw.rounded_rectangle((x, y, x + w, y + 12), radius=8, fill=accent)
    draw_icon(draw, (x + 50, y + 62), accent, idx)
    draw.text((x + 94, y + 35), f"{idx + 1:02d}", font=FONTS["mono"], fill=DUSK_BLUE)
    title_y = draw_wrapped(draw, section.title, (x + 94, y + 66), FONTS["h"], INK, w - 130, line_gap=4, max_lines=2)
    cy = max(y + 140, title_y + 10)
    items = section.items[:4] if section.items else ["Captures the essential decisions and implications from this document section."]
    for item in items:
        if cy > y + h - 60:
            break
        draw.ellipse((x + 35, cy + 10, x + 45, cy + 20), fill=accent)
        cy = draw_wrapped(draw, item, (x + 62, cy), FONTS["body"], SLATE, w - 94, line_gap=7, max_lines=3)
        cy += 16


def draw_cards(draw: ImageDraw.ImageDraw, doc: Doc, y: int) -> int:
    draw_tracked(draw, (MARGIN, y), "BREAKDOWN", FONTS["kicker"], INK, tracking=8)
    y += 64
    card_w = (WIDTH - 2 * MARGIN - GUTTER) // 2
    heights = [card_height(draw, s, card_w) for s in doc.sections]
    for row_start in range(0, len(doc.sections), 2):
        row_sections = doc.sections[row_start : row_start + 2]
        row_heights = heights[row_start : row_start + 2]
        row_h = max(row_heights)
        for col, section in enumerate(row_sections):
            x = MARGIN + col * (card_w + GUTTER)
            draw_section_card(draw, section, x, y, card_w, row_h, row_start + col)
        y += row_h + GUTTER
    return y + 28


def draw_footer(draw: ImageDraw.ImageDraw, doc: Doc, y: int) -> None:
    draw.line((MARGIN, y, WIDTH - MARGIN, y), fill=LINE, width=2)
    draw_brand_mark(draw, (MARGIN + 30, y + 64), 44, PAPER)
    draw_tracked(draw, (MARGIN + 112, y + 50), "HARNESS DREAMS", FONTS["small_bold"], INK, tracking=8)
    footer = f"Source: {doc.path.as_posix()}  |  Generated from Markdown headings, bullets, tables, and prose."
    draw_wrapped(draw, footer, (MARGIN, y + 98), FONTS["small"], MUTED, WIDTH - 2 * MARGIN, max_lines=2)


def render_doc(doc: Doc, out_path: Path) -> None:
    height = build_layout_height(doc)
    img = Image.new("RGB", (WIDTH, height), PAPER)
    draw = ImageDraw.Draw(img)

    for i in range(0, height, 120):
        color = "#FBFCFD" if (i // 120) % 2 == 0 else PAPER
        draw.rectangle((0, i, WIDTH, min(height, i + 120)), fill=color)

    draw.rectangle((0, 0, 10, height), fill=INK)
    draw.rectangle((10, 0, 16, height), fill=PALE_TEAL)

    y = draw_header(draw, doc)
    y = draw_flow(draw, doc, y)
    y = draw_cards(draw, doc, y)
    draw_footer(draw, doc, y)
    img.save(out_path, "PNG", optimize=True)


def make_index(outputs: list[Path], out_dir: Path) -> None:
    lines = [
        "# Markdown Explainer Images",
        "",
        "Generated PNG guides for every Markdown document in `md/`.",
        "",
    ]
    for path in outputs:
        lines.append(f"- [{path.name}]({path.name})")
    (out_dir / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--md-dir", type=Path, default=MD_DIR)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for md_path in sorted(args.md_dir.glob("*.md")):
        doc = read_doc(md_path)
        out_path = args.out_dir / f"{md_path.stem}.png"
        render_doc(doc, out_path)
        outputs.append(out_path)
        print(out_path.relative_to(ROOT))
    make_index(outputs, args.out_dir)


if __name__ == "__main__":
    main()
