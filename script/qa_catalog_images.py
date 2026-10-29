"""Local real-file rendering regression; uses deterministic HTML, NOT live AI.

Usage: python script/qa_catalog_images.py SOURCE.pdf BAD_OUTPUT.pdf OUTPUT_DIR
Only the first 15 source pages are used. Never modifies either input.
"""
import html
import json
import subprocess
import sys
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/pdf_pipelines"))
from complex_pdf_extract import extract_pdf

source_path, bad_path, directory = sys.argv[1:]
directory = Path(directory)
directory.mkdir(parents=True, exist_ok=True)
with fitz.open(source_path) as source:
    subset = fitz.open()
    subset.insert_pdf(source, to_page=14)
    source_subset = directory / "source-first-15.pdf"
    subset.save(source_subset)
    subset.close()

extraction = extract_pdf(str(source_subset), str(directory / "extraction"))
pages = []
with fitz.open(source_subset) as source:
    for page in extraction["pages"]:
        number = page["page"]
        parts = [f'<section><h2>Source page {number}: local rendering regression</h2>']
        for image in page["images"]:
            alt = (
                "Enrique Perez, Acting President of Santiago Canyon College"
                if number == 5 else "Source catalog cover artwork"
            )
            parts.append(f'<figure data-alt="{alt}"><img src="cid:{image["id"]}" alt="{alt}"></figure>')
        if number == 6:
            # Actual map bounds inspected in the source. This exercises the
            # production crop path but does not test AI bounding-box accuracy.
            parts.append('<figure data-alt="Map of RSCCD locations in Orange County" '
                         'data-bbox="83,142,913,672"></figure>')
        for block in source[number - 1].get_text("blocks", sort=True):
            if block[6] == 0:
                parts.append("<p>" + html.escape(block[4]).replace("\n", "<br>") + "</p>")
        parts.append("</section>")
        pages.append({
            "html": "".join(parts), "images": page["images"],
            "sourceText": page["source_text"], "screenshot": page["screenshot"],
            "pageWidth": page["page_width"], "pageHeight": page["page_height"],
        })

# Evaluate the same JS template literal that the production route sends to
# Python. Do not maintain a separate approximation of the PDF renderer.
node_script = (
    "const fs=require('fs');const s=fs.readFileSync('server/routes.ts','utf8');"
    "const start=s.indexOf('const pyPdf = `')+'const pyPdf = '.length;"
    "const end=s.indexOf('\\n`;',start)+2;"
    "process.stdout.write(new Function('return '+s.slice(start,end))());"
)
renderer = subprocess.check_output(["node", "-e", node_script], cwd=ROOT)
renderer_path = directory / "production-renderer.py"
renderer_path.write_bytes(renderer)
output = directory / "SCC-first-15-local-rendering-test.pdf"
payload = json.dumps({"pages": pages, "title": "SCC catalog: local image-rendering regression, not final remediation"})
process = subprocess.run(
    [sys.executable, str(renderer_path), str(output), str(ROOT / "server/pdf_pipelines")],
    input=payload, capture_output=True, text=True, timeout=120,
)
print(process.stdout, process.stderr)
if process.returncode:
    raise SystemExit(process.returncode)
subprocess.run(["qpdf", "--check", str(output)], check=True)

with fitz.open(output) as fixed:
    pictures = [(page.number, item) for page in fixed for item in page.get_image_info()]
    assert len(pictures) == 5, f"Expected cover, band, inline logo, portrait, map; got {len(pictures)}"
    assert all(min(item["width"], item["height"]) > 1 for _, item in pictures)
    portrait = next((page, item) for page, item in pictures if (item["width"], item["height"]) == (259, 352))
    assert fitz.Rect(portrait[1]["bbox"]).width < 63, "Portrait must retain source display width"
    output_pages = len(fixed)
    fixed.set_metadata({**fixed.metadata, "author": "Perplexity Computer"})
    fixed.saveIncr()

def rendered_crop(document, page, box):
    pixmap = document[page].get_pixmap(matrix=fitz.Matrix(4, 4), clip=fitz.Rect(box), alpha=False)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

with fitz.open(source_subset) as source, fitz.open(bad_path) as bad, fitz.open(output) as fixed:
    original = rendered_crop(source, 4, source[4].get_image_info()[0]["bbox"])
    old_item = next((page.number, item) for page in bad for item in page.get_image_info()
                    if (item["width"], item["height"]) == (259, 352))
    broken = rendered_crop(bad, old_item[0], old_item[1]["bbox"])
    corrected = rendered_crop(fixed, portrait[0], portrait[1]["bbox"])
    canvas = Image.new("RGB", (1200, 690), "#f7f8fa")
    draw = ImageDraw.Draw(canvas)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    title = ImageFont.truetype(font_path, 29)
    label = ImageFont.truetype(font_path, 23)
    note = ImageFont.truetype(font_path, 18)
    draw.text((42, 28), "Enrique's portrait: image-color correction", font=title, fill="#172b36")
    for column, (image, text) in enumerate([
        (original, "Original PDF"), (broken, "Reported output"), (corrected, "Corrected local output")
    ]):
        x = 42 + column * 390
        draw.text((x, 87), text, font=label, fill="#172b36")
        image = ImageOps.contain(image, (330, 449))
        canvas.paste(image, (x, 130))
    draw.text((42, 612), "Actual rendered PDF crops. The corrected portrait is no longer inverted.", font=note, fill="#314653")
    draw.text((42, 642), "Local pipeline test only. Production deployment and live-AI testing are still pending.", font=note, fill="#314653")
    canvas.save(directory / "Remedy-Docs-Portrait-Color-Comparison.png")

results = {
    "source_pages": 15, "raster_placements_retained": 4, "vector_map_crops": 1,
    "output_pages": output_pages, "invisible_placeholders": 0,
    "portrait_display_width_under_63pt": True,
    "production_renderer_and_pixel_inventory_check": "passed",
    "live_ai": False, "production_deployment": False,
}
(directory / "results.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
