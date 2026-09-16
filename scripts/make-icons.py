"""Rasterize Mira app icon: SVG geometry → PNG sizes + Windows ICO.

Source of truth: docs/icon-mira.svg (same coordinates/gradient).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "icons"
SVG_PATH = ROOT / "docs" / "icon-mira.svg"

# Matches icon-mira.svg viewBox 512
VB = 512
RECT_XY = (16, 16, 496, 496)
RECT_RX = 96
BASELINE = (118, 388, 394, 402)  # x1 y1 x2 y2
BASELINE_RX = 4


def lerp(a: float, b: float, t: float) -> int:
    return int(round(a + (b - a) * t))


def purple_gradient(w: int, h: int) -> Image.Image:
    """Vertical gradient #6b21a8 → #1e1b4b."""
    top = (0x6B, 0x21, 0xA8)
    bottom = (0x1E, 0x1B, 0x4B)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        color = (lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t))
        for x in range(w):
            px[x, y] = color
    return img


def draw_m(draw: ImageDraw.ImageDraw, scale: float, fill=(255, 255, 255)) -> None:
    """Letter M path simplified from SVG (outer silhouette)."""
    # SVG uses a single path; approximate with polygon in viewBox coords
    # M: 118,150 → 172,150 → 246,278 → 320,150 → 374,150 → 374,362 → 324,362 → 324,228
    #    → 246,362 → 168,228 → 168,362 → 118,362 → close
    pts = [
        (118, 150),
        (172, 150),
        (246, 278),
        (320, 150),
        (374, 150),
        (374, 362),
        (324, 362),
        (324, 228),
        (246, 362),
        (168, 228),
        (168, 362),
        (118, 362),
    ]
    scaled = [(x * scale, y * scale) for x, y in pts]
    draw.polygon(scaled, fill=fill)


def render_icon(size: int) -> Image.Image:
    """Render at `size` px with rounded square mask."""
    scale = size / VB
    # supersample for AA
    ss = 4 if size >= 64 else 2
    big = size * ss
    bg = purple_gradient(big, big)
    draw = ImageDraw.Draw(bg)

    rx = RECT_RX * (big / VB)
    rect = [RECT_XY[0] * (big / VB), RECT_XY[1] * (big / VB), RECT_XY[2] * (big / VB), RECT_XY[3] * (big / VB)]
    # Draw rounded rect as background: composite gradient with mask
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle(rect, radius=rx, fill=255)
    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)

    draw2 = ImageDraw.Draw(icon)
    draw_m(draw2, big / VB)
    # baseline
    brx = BASELINE_RX * (big / VB)
    bl = [BASELINE[0] * (big / VB), BASELINE[1] * (big / VB), BASELINE[2] * (big / VB), BASELINE[3] * (big / VB)]
    draw2.rounded_rectangle(bl, radius=brx, fill=(255, 255, 255, 242))

    return icon.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    images = {}
    for s in sizes:
        img = render_icon(s)
        path = OUT_DIR / f"icon-{s}.png"
        img.save(path, "PNG")
        images[s] = img
        print("wrote", path)

    # refresh docs/icon-mira.png master
    master = render_icon(1024)
    master_path = ROOT / "docs" / "icon-mira.png"
    master.save(master_path, "PNG")
    print("wrote", master_path)

    # Windows ICO (multi-size)
    ico_path = OUT_DIR / "icon.ico"
    master.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("wrote", ico_path)

    # also drop next to tauri icons for convenience
    tauri_ico = ROOT / "src-tauri" / "icons" / "icon.ico"
    master.save(
        tauri_ico,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("wrote", tauri_ico)
    print("svg source:", SVG_PATH)


if __name__ == "__main__":
    main()
