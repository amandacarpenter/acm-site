"""Generates the 1200x630 Open Graph / Twitter Card preview image for
Remedy508. Run once; output is committed to client/public/og-image.png so
it ships with the static build like favicon.ico etc.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
NAVY = (30, 41, 59)       # #1e293b-ish, matches brand navy
NAVY_DARK = (17, 24, 39)
GOLD = (250, 191, 36)     # accessibility icon gold
WHITE = (255, 255, 255)
MUTED = (203, 213, 225)

img = Image.new("RGB", (W, H), NAVY)
draw = ImageDraw.Draw(img)

# Subtle vertical gradient navy -> darker navy for depth
for y in range(H):
    t = y / H
    r = int(NAVY[0] * (1 - t) + NAVY_DARK[0] * t)
    g = int(NAVY[1] * (1 - t) + NAVY_DARK[1] * t)
    b = int(NAVY[2] * (1 - t) + NAVY_DARK[2] * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Load accessibility icon logo, mask to a circle so the flat white
# background behind the navy disc doesn't show as a sticker/square.
logo = Image.open("client/public/logo.png").convert("RGBA")
# Crop tight to the navy disc (source has ~14% white margin per side)
logo = logo.crop((144, 144, 880, 880))
logo_size = 140
logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
circle_mask = Image.new("L", (logo_size, logo_size), 0)
mask_draw = ImageDraw.Draw(circle_mask)
mask_draw.ellipse([0, 0, logo_size, logo_size], fill=255)
img.paste(logo, (80, 80), circle_mask)

clash_bold = ImageFont.truetype("/tmp/ogfonts/clash-bold.ttf", 92)
gs_semibold = ImageFont.truetype("/tmp/ogfonts/gs-semibold.ttf", 40)
gs_medium = ImageFont.truetype("/tmp/ogfonts/gs-medium.ttf", 34)

# Brand wordmark next to logo
draw.text((240, 108), "Remedy508", font=clash_bold, fill=WHITE)

# Headline
draw.text((80, 280), "AI Accessibility Remediation", font=gs_semibold, fill=WHITE)
draw.text((80, 335), "for Higher Education", font=gs_semibold, fill=GOLD)

# Supporting line
draw.text((80, 420), "Fix PDFs & docs  \u00b7  Alt text  \u00b7  Canvas HTML  \u00b7  Video captions", font=gs_medium, fill=MUTED)

# WCAG badge pill bottom-left
badge_text = "WCAG 2.1 AA"
badge_font = gs_medium
bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
pad_x, pad_y = 28, 16
bx, by = 80, 500
draw.rounded_rectangle([bx, by, bx + tw + pad_x * 2, by + th + pad_y * 2], radius=28, fill=GOLD)
draw.text((bx + pad_x, by + pad_y - bbox[1]), badge_text, font=badge_font, fill=NAVY_DARK)

img.save("client/public/og-image.png", "PNG", optimize=True)
print("Saved client/public/og-image.png", img.size)
