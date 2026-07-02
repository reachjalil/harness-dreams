from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
GENERATED = ROOT / "generated"
OUT = ROOT / "final"

W, H = 1632, 2112
FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
FONT_BLACK = Path("/System/Library/Fonts/Supplemental/Arial Black.ttf")


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    source = {
        "regular": FONT_REGULAR,
        "bold": FONT_BOLD,
        "black": FONT_BLACK,
    }[weight]
    return ImageFont.truetype(str(source), size=size)


F = {
    "kicker": font(28, "black"),
    "title": font(70, "black"),
    "subtitle": font(31, "bold"),
    "h2": font(34, "black"),
    "callout": font(30, "black"),
    "body": font(25, "bold"),
    "small": font(21, "bold"),
    "stat": font(52, "black"),
    "flow": font(25, "black"),
}

COLORS = {
    "ink": (15, 23, 42),
    "body": (61, 75, 94),
    "muted": (100, 116, 139),
    "line": (207, 216, 228),
    "white": (255, 255, 255),
    "panel": (248, 250, 252),
    "navy": (15, 23, 42),
}


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*color, alpha)


def tint(color: tuple[int, int, int], amount: float = 0.14) -> tuple[int, int, int]:
    return tuple(round(255 - (255 - channel) * amount) for channel in color)


def text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    fill: tuple[int, int, int] = COLORS["ink"],
    font_name: str = "body",
    max_width: int | None = None,
    line_gap: int = 6,
) -> int:
    x, y = xy
    face = F[font_name]
    if max_width is None:
        draw.text((x, y), value, fill=fill, font=face)
        return y + draw.textbbox((x, y), value, font=face)[3] - y

    words = value.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=face) > max_width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)

    line_height = face.size + line_gap
    for line in lines:
        draw.text((x, y), line, fill=fill, font=face)
        y += line_height
    return y


def rounded_paste(
    base: Image.Image,
    img: Image.Image,
    box: tuple[int, int, int, int],
    radius: int = 30,
) -> None:
    x, y, w, h = box
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    base.paste(img, (x, y), mask)


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    w, h = img.size
    tw, th = size
    scale = max(tw / w, th / h)
    nw, nh = round(w * scale), round(h * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def background() -> Image.Image:
    bg = Image.open(GENERATED / "coolguide-background.png").convert("RGB")
    bg = cover(bg, (W, H)).filter(ImageFilter.GaussianBlur(radius=0.6))
    bg = ImageEnhance.Color(bg).enhance(0.78)
    bg = ImageEnhance.Contrast(bg).enhance(0.86)
    page = bg.convert("RGBA")
    veil = Image.new("RGBA", (W, H), (255, 255, 255, 116))
    page.alpha_composite(veil)
    d = ImageDraw.Draw(page)
    d.rounded_rectangle((58, 58, W - 58, H - 58), radius=48, outline=COLORS["line"], width=2)
    return page


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, accent: tuple[int, int, int]) -> None:
    width = max(215, int(draw.textlength(label.upper(), font=F["kicker"]) + 54))
    draw.rounded_rectangle((x, y, x + width, y + 58), radius=29, fill=tint(accent, 0.13), outline=accent, width=2)
    draw.text((x + 27, y + 13), label.upper(), fill=accent, font=F["kicker"])


def header(draw: ImageDraw.ImageDraw, page: dict) -> None:
    pill(draw, 92, 84, page["deck"], page["accent"])
    title_bottom = text(draw, (92, 168), page["title"], font_name="title", max_width=1460, line_gap=8)
    text(draw, (96, title_bottom + 26), page["subtitle"], fill=COLORS["body"], font_name="subtitle", max_width=1220, line_gap=7)


def screenshot_frame(
    canvas: Image.Image,
    shot: str,
    box: tuple[int, int, int, int],
    caption: str,
) -> None:
    x, y, w, h = box
    d = ImageDraw.Draw(canvas)
    shadow = Image.new("RGBA", (w + 54, h + 64), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((18, 18, w + 18, h + 18), radius=38, fill=(15, 23, 42, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=12))
    canvas.alpha_composite(shadow, (x - 26, y - 20))
    d.rounded_rectangle((x - 8, y - 8, x + w + 8, y + h + 8), radius=38, fill=(255, 255, 255, 238), outline=(148, 163, 184), width=4)
    img = Image.open(SCREENSHOTS / shot).convert("RGB")
    rounded_paste(canvas, cover(img, (w, h)).convert("RGBA"), (x, y, w, h), radius=30)
    d.rounded_rectangle((x, y, x + w, y + h), radius=30, outline=(15, 23, 42, 90), width=4)
    d.text((x + 18, y + h + 20), caption, fill=COLORS["muted"], font=F["small"])


def callouts(draw: ImageDraw.ImageDraw, page: dict, x: int, y: int, width: int, step: int = 150) -> None:
    for index, item in enumerate(page["callouts"]):
        title, body = item
        yy = y + index * step
        accent = page["accent"] if index % 2 == 0 else page["accent2"]
        draw.ellipse((x, yy, x + 50, yy + 50), fill=accent)
        draw.text((x + 18, yy + 10), str(index + 1), fill=COLORS["white"], font=F["small"])
        title_bottom = text(draw, (x + 68, yy - 3), title, fill=COLORS["ink"], font_name="callout", max_width=width, line_gap=0)
        text(draw, (x + 68, title_bottom + 8), body, fill=COLORS["body"], font_name="body", max_width=width, line_gap=5)


def stats(
    draw: ImageDraw.ImageDraw,
    page: dict,
    x: int,
    y: int,
    cols: int = 2,
    card_w: int = 214,
    card_h: int = 116,
    gap_x: int = 28,
    gap_y: int = 26,
) -> None:
    for index, item in enumerate(page["stats"]):
        value, label = item
        col = index % cols
        row = index // cols
        sx = x + col * (card_w + gap_x)
        sy = y + row * (card_h + gap_y)
        accent = page["accent2"] if index % 2 else page["accent"]
        draw.rounded_rectangle((sx, sy, sx + card_w, sy + card_h), radius=24, fill=(255, 255, 255), outline=COLORS["line"], width=2)
        if len(value) > 8:
            value_font = font(34, "black")
            value_y = sy + 28
        elif len(value) > 5:
            value_font = font(40, "black")
            value_y = sy + 24
        else:
            value_font = F["stat"]
            value_y = sy + 17
        draw.text((sx + 24, value_y), value, fill=accent, font=value_font)
        text(draw, (sx + 24, sy + 72), label, fill=COLORS["body"], font_name="small", max_width=card_w - 44, line_gap=2)


def flow(draw: ImageDraw.ImageDraw, page: dict) -> None:
    x0, y = 92, 1662
    draw.text((x0, y - 62), "The loop judges can verify", fill=COLORS["ink"], font=F["h2"])
    items = [
        ("Sessions", "Claude Code + Codex"),
        ("Health Review", "score + friction"),
        ("Recommendation", "AGENTS.md / skill"),
        ("Next Review", "helped / worse"),
    ]
    card_w, gap = 284, 90
    for index, (title, body) in enumerate(items):
        x = x0 + index * (card_w + gap)
        draw.rounded_rectangle((x, y, x + card_w, y + 142), radius=28, fill=(255, 255, 255), outline=COLORS["line"], width=2)
        accent = page["accent"] if index % 2 == 0 else page["accent2"]
        draw.ellipse((x + 24, y + 28, x + 68, y + 72), fill=accent)
        draw.text((x + 39, y + 36), str(index + 1), fill=COLORS["white"], font=F["small"])
        draw.text((x + 84, y + 33), title, fill=COLORS["ink"], font=F["flow"])
        draw.text((x + 34, y + 88), body, fill=COLORS["body"], font=F["small"])
        if index < len(items) - 1:
            ax = x + card_w + 18
            ay = y + 70
            draw.line((ax, ay, ax + 46, ay), fill=accent, width=7)
            draw.polygon([(ax + 46, ay), (ax + 28, ay - 14), (ax + 28, ay + 14)], fill=accent)


def proof(draw: ImageDraw.ImageDraw, page: dict) -> None:
    x, y, w, h = 92, 1908, W - 184, 124
    draw.rounded_rectangle((x, y, x + w, y + h), radius=28, fill=COLORS["navy"])
    draw.text((x + 34, y + 24), "JUDGE PROOF", fill=page["accent2"], font=F["small"])
    text(draw, (x + 34, y + 63), page["footer"], fill=(226, 232, 240), font_name="body", max_width=w - 68, line_gap=4)


def draw_page(page: dict) -> Image.Image:
    canvas = background()
    draw = ImageDraw.Draw(canvas)
    header(draw, page)
    if page.get("second_screen"):
        screenshot_frame(canvas, page["screen"], (76, 420, 698, 520), page["screen_caption"])
        screenshot_frame(canvas, page["second_screen"], (858, 420, 698, 520), page["second_caption"])
        callouts(draw, page, 104, 1030, 690, step=128 if len(page["callouts"]) > 3 else 150)
        stats(draw, page, 930, 1128, cols=2)
    else:
        screen_y = page.get("screen_y", 420)
        callout_y = page.get("callout_y", screen_y + 18)
        screenshot_frame(canvas, page["screen"], (78, screen_y, 1060, 692), page["screen_caption"])
        callouts(draw, page, 1178, callout_y, 330, step=216)
        stats(draw, page, 1240, 1164, cols=1, card_w=250, card_h=106, gap_y=18)
    flow(draw, page)
    proof(draw, page)
    return canvas.convert("RGB")


PAGES = [
    {
        "slug": "01-overview",
        "deck": "Harness Health",
        "title": "A health review for coding agents",
        "subtitle": "Harness Health reads real local Claude Code and Codex sessions, finds collaboration friction, and turns it into measurable repo improvements.",
        "accent": (59, 130, 246),
        "accent2": (34, 197, 94),
        "screen": "01-home-dashboard.png",
        "screen_caption": "Actual Home dashboard screenshot from demo mode",
        "callouts": [
            ("Local session window", "Counts the latest work window before judging anything."),
            ("Health dashboard", "Scores efficiency, effectiveness, and alignment from reviewed reviews."),
            ("Improvement loop", "Accepted changes, review branches, and verdicts stay visible."),
        ],
        "stats": [("7", "sessions"), ("3", "projects"), ("2", "PR links"), ("61", "alignment")],
        "footer": "Open Home, then open the latest Health Review behind the dashboard numbers.",
    },
    {
        "slug": "02-health-review",
        "deck": "Health Review Review",
        "title": "The report is grounded in actual friction",
        "subtitle": "The Health Review review names the project window, quotes the correction, and measures whether earlier accepted guidance helped.",
        "accent": (239, 68, 68),
        "accent2": (245, 158, 11),
        "screen": "03-health-review-detail.png",
        "screen_y": 470,
        "callout_y": 470,
        "screen_caption": "Actual Health Review detail screenshot",
        "callouts": [
            ("Verbatim evidence", "Quotes the moment of friction instead of summarizing vibes."),
            ("Config gap", "Names the missing AGENTS.md, CLAUDE.md, or skill instruction."),
            ("Measured loop", "This demo verdict shows Helped with a +14 alignment delta."),
        ],
        "stats": [("61", "turns"), ("7", "sessions"), ("3", "projects"), ("+14", "delta")],
        "footer": "Show the evidence quote and the Did your last changes help panel.",
    },
    {
        "slug": "03-apply-ready-recommendations",
        "deck": "Recommendations",
        "title": "From quote to apply-ready change",
        "subtitle": "Every accepted recommendation becomes one branchable artifact: an AGENTS.md block, CLAUDE.md edit, or skill scaffold.",
        "accent": (139, 92, 246),
        "accent2": (6, 182, 212),
        "screen": "04-recommendation-agentsmd.png",
        "second_screen": "05-recommendation-skill.png",
        "screen_caption": "AGENTS.md recommendation screenshot",
        "second_caption": "Skill scaffold recommendation screenshot",
        "callouts": [
            ("Quote", "The user correction is kept verbatim and linked to a source file."),
            ("Gap", "The app explains what guidance was missing or conflicting."),
            ("Diff", "Accept prepares a managed block or SKILL.md scaffold on a review branch."),
        ],
        "stats": [("AGENTS.md", "managed block"), ("SKILL.md", "scaffold"), ("PR", "compare link"), ("1", "decision click")],
        "footer": "Accept a finding, then show the branch and PR link instead of editing the current checkout.",
    },
    {
        "slug": "04-privacy-and-runner",
        "deck": "Privacy",
        "title": "Local by default. Cloud only by opt-in.",
        "subtitle": "Settings show the boundary. Local mode keeps analysis on this Mac; Cloud mode exposes the CLI runner, model, timeout, and redaction note.",
        "accent": (20, 184, 166),
        "accent2": (249, 115, 22),
        "screen": "06-settings-local.png",
        "second_screen": "07-settings-cloud-runner.png",
        "screen_caption": "Settings in local-only mode",
        "second_caption": "Settings after Cloud opt-in",
        "callouts": [
            ("Local-first", "Demo mode and local mode do not call an LLM or write repos."),
            ("No agent SDK", "Cloud Insight uses the configured Claude Code or Codex CLI command."),
            ("Redaction", "Sensitive excerpts are scrubbed before the Insight payload is sent."),
        ],
        "stats": [("~/.claude", "connector"), ("~/.codex", "connector"), ("CLI", "runner path"), ("180s", "timeout")],
        "footer": "Toggle Cloud in Settings and point at runner command plus redacted excerpts.",
    },
    {
        "slug": "05-demo-walkthrough",
        "deck": "Hackathon Demo",
        "title": "Three-minute judge walkthrough",
        "subtitle": "Start with the dashboard, open the latest health review, inspect a recommendation, then show the measured outcome.",
        "accent": (37, 99, 235),
        "accent2": (234, 179, 8),
        "screen": "01-home-dashboard.png",
        "second_screen": "04-recommendation-agentsmd.png",
        "screen_caption": "Home dashboard screenshot",
        "second_caption": "Apply-ready recommendation screenshot",
        "callouts": [
            ("Home", "Show the self-improvement loop and PR-ready branch counters."),
            ("Health Review", "Show sessions, projects, quotes, and the config gap."),
            ("Accept", "Show the generated AGENTS.md block or skill scaffold."),
            ("Outcome", "Show Helped / no-change / worse after the next review."),
        ],
        "stats": [("3", "demo reviews"), ("2", "recommendations"), ("+14", "helped delta"), ("0", "mock claims")],
        "footer": "Close with: Harness Health turns agent friction into measurable repo guidance.",
    },
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for page in PAGES:
        out = OUT / f"{page['slug']}.png"
        draw_page(page).save(out, optimize=True)
        print(out)


if __name__ == "__main__":
    main()
