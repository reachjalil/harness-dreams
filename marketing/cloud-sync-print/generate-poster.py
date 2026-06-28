from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "cloud-sync-artwork.png"
OUT = ROOT / "final" / "cloud-sync-poster.png"

W, H = 2400, 3000
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


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    w, h = img.size
    tw, th = size
    scale = max(tw / w, th / h)
    resized = img.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    max_width: int,
    line_gap: int,
) -> int:
    x, y = xy
    line = ""
    lines: list[str] = []
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=face) > max_width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)

    for line in lines:
        draw.text((x, y), line, fill=fill, font=face)
        y += face.size + line_gap
    return y


def pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    label: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    text_fill: tuple[int, int, int, int],
) -> int:
    x, y = xy
    pad_x, pad_y = 28, 16
    bbox = draw.textbbox((0, 0), label, font=face)
    w = bbox[2] - bbox[0] + pad_x * 2
    h = bbox[3] - bbox[1] + pad_y * 2
    draw.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=fill, outline=outline, width=2)
    draw.text((x + pad_x, y + pad_y - 2), label, font=face, fill=text_fill)
    return w


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    art = cover(Image.open(SOURCE).convert("RGB"), (W, H))
    art = ImageEnhance.Color(art).enhance(1.04)
    art = ImageEnhance.Contrast(art).enhance(1.03)
    canvas = art.convert("RGBA")

    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for i in range(W):
        strength = max(0, 175 - int(i * 0.09))
        if strength:
            sd.line((i, 0, i, H), fill=(8, 22, 46, strength))
    for y in range(H):
        bottom = max(0, int((y - H * 0.66) / (H * 0.34) * 105))
        if bottom:
            sd.line((0, y, W, y), fill=(8, 22, 46, bottom))
    canvas.alpha_composite(shade.filter(ImageFilter.GaussianBlur(radius=0.4)))

    draw = ImageDraw.Draw(canvas)
    white = (255, 255, 255, 248)
    soft = (225, 239, 255, 222)
    teal = (129, 245, 230, 255)
    line = (255, 255, 255, 72)

    kicker = font(42, "black")
    title = font(146, "black")
    subtitle = font(55, "bold")
    body = font(38, "bold")
    small = font(30, "bold")

    x = 132
    y = 166

    draw.text((x, y), "HARNESS DREAMS", font=kicker, fill=teal)
    y += 112
    y = draw_wrapped(
        draw,
        (x, y),
        "Harness health on every screen.",
        title,
        white,
        1160,
        10,
    )
    y += 48
    y = draw_wrapped(
        draw,
        (x, y),
        "Cloud Sync brings your coding-agent sleep cycle to iPhone and Apple Watch for $5/month.",
        subtitle,
        soft,
        1000,
        12,
    )

    y += 58
    offset = 0
    for label in ("Mac stays local", "Scores · Findings · Goals", "$5/month"):
        offset += pill(
            draw,
            (x + offset, y),
            label,
            small,
            (4, 16, 32, 142),
            (129, 245, 230, 136),
            (236, 252, 255, 242),
        ) + 18

    footer_y = H - 330
    draw.rounded_rectangle((x, footer_y, 1140, footer_y + 190), radius=36, fill=(4, 16, 32, 154), outline=line, width=2)
    draw.text((x + 42, footer_y + 36), "Code and transcripts stay on your Mac.", font=body, fill=white)
    draw_wrapped(
        draw,
        (x + 42, footer_y + 94),
        "Cloud Sync mirrors only the cycle signal: scores, findings, and goals.",
        small,
        soft,
        940,
        8,
    )

    draw.text((x, H - 104), "harnessdreams.com", font=small, fill=(255, 255, 255, 214))
    draw.text((W - 560, H - 104), "Optional Cloud Sync", font=small, fill=(255, 255, 255, 196))

    canvas.convert("RGB").save(OUT, quality=96, dpi=(300, 300))
    print(OUT)


if __name__ == "__main__":
    main()
