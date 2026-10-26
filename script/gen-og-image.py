"""Generate the current 1200x630 sharing card using the approved logo unchanged.

Run from any directory: python script/gen-og-image.py
Keep the versioned filename in sync with shared/seo.ts. The legacy filename is
also refreshed for clients that still have the previous metadata cached.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
SLATE = "#3a485b"
TEAL = "#0f766e"

image = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(image)

# Preserve the supplied high-resolution logo, including its wordmark and colors.
logo = Image.open(ROOT / "client/src/assets/logo.png").convert("RGB")
logo.thumbnail((960, 280), Image.Resampling.LANCZOS)
image.paste(logo, ((W - logo.width) // 2, (380 - logo.height) // 2))

draw.rectangle((0, 380, W, H), fill=SLATE)
draw.rectangle((0, 380, W, 387), fill=TEAL)
font = ImageFont.truetype(str(ROOT / "fonts/GeneralSans-Semibold.ttf"), 60)
tagline = "Accessibility Made Easy"
bounds = draw.textbbox((0, 0), tagline, font=font)
assert bounds[2] - bounds[0] <= W - 160, "Tagline exceeds the safe area."
draw.text(
    ((W - (bounds[2] - bounds[0])) / 2 - bounds[0],
     505 - (bounds[3] - bounds[1]) / 2 - bounds[1]),
    tagline, font=font, fill="white",
)

for name in ("remedy508-share-2026-10.png", "og-image.png"):
    destination = ROOT / "client/public" / name
    image.save(destination, "PNG", optimize=True)
    print(f"Saved {destination.name}: {image.size}")
