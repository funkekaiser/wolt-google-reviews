"""Renders the extension icons into static/icons/. Run: python3 scripts/make-icons.py

Deliberately generic (amber star on a dark tile): no Google or Wolt marks or
colors, which the Chrome Web Store would reject as brand impersonation.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

SS = 1024  # draw large, then downsample for anti-aliasing
OUT = Path(__file__).resolve().parent.parent / "static" / "icons"


def star(cx, cy, r_outer, r_inner):
    pts = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def render(size, padding=0.0):
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    inset = SS * padding
    tile = (inset, inset, SS - inset, SS - inset)
    w = tile[2] - tile[0]
    d.rounded_rectangle(tile, radius=w * 0.22, fill=(28, 32, 44, 255))
    c = SS / 2
    d.polygon(star(c, c + w * 0.03, w * 0.36, w * 0.15), fill=(245, 166, 35, 255))
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
render(16).save(OUT / "icon16.png")
render(48).save(OUT / "icon48.png")
# Store guideline: 128px icon with a 96px artwork and transparent padding.
render(128, padding=16 / 128).save(OUT / "icon128.png")
print("wrote", *sorted(p.name for p in OUT.glob("*.png")))
