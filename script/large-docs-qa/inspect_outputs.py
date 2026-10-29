"""Inspect downloaded QA artifacts without changing them."""
import collections
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET
import pymupdf as fitz
import pikepdf
from PIL import Image, ImageDraw

ROOT = Path("/tmp/remedy-large-production-qa")
report = {}
source = fitz.open(ROOT / "source.pdf")
source_words = set(re.findall(r"[a-z]{4,}", "\n".join(p.get_text() for p in source).lower()))

for name in ["SCC-51-Pages-Production-QA.pdf", "word-render/SCC-51-Pages-Production-QA.pdf"]:
    path = ROOT / name
    if not path.exists():
        continue
    label = "word" if "word-render" in name else "pdf"
    out = fitz.open(path)
    text = "\n".join(p.get_text() for p in out)
    words = set(re.findall(r"[a-z]{4,}", text.lower()))
    bounds, pictures, portrait_pages = [], 0, []
    render_dir = ROOT / (label + "-pages")
    render_dir.mkdir(exist_ok=True)
    for number, page in enumerate(out, 1):
        pictures += len(page.get_image_info())
        if "enrique" in page.get_text().lower():
            portrait_pages.append(number)
        for item in page.get_text("words"):
            if item[0] < -3 or item[1] < -3 or item[2] > page.rect.width+3 or item[3] > page.rect.height+3:
                bounds.append({"page": number, "text": item[4]})
        page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).save(render_dir / f"{number:03}.png")
    report[label] = {
        "pages": len(out), "placedImages": pictures, "portraitPages": portrait_pages,
        "characters": len(text), "sourceUniqueWordCoverage": round(len(source_words & words)/len(source_words), 4),
        "missingSourceWords": sorted(source_words-words), "textOutsidePage": bounds,
        "visibleFigurePlaceholders": len(re.findall(r"\[Figure\s*:", text, re.I)),
    }
    if label == "pdf":
        with pikepdf.open(path) as pdf:
            tags, missing_alt = collections.Counter(), []
            def walk(node):
                if isinstance(node, pikepdf.Array):
                    for child in node:
                        walk(child)
                elif isinstance(node, pikepdf.Dictionary):
                    kind = str(node.get("/S", ""))
                    if kind:
                        tags[kind] += 1
                    if kind == "/Figure" and not str(node.get("/Alt", "")).strip():
                        missing_alt.append(str(node.objgen))
                    if "/K" in node:
                        walk(node["/K"])
            walk(pdf.Root.get("/StructTreeRoot", {}))
            report[label].update(tagCounts=dict(tags), figuresWithoutAlt=missing_alt,
                marked=bool(pdf.Root.get("/MarkInfo", {}).get("/Marked", False)),
                language=str(pdf.Root.get("/Lang", "")), title=str(pdf.docinfo.get("/Title", "")))
    files = sorted(render_dir.glob("*.png"))
    for start in range(0, len(files), 12):
        sheet = Image.new("RGB", (1000, 1410), "#d8dadd")
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(files[start:start+12]):
            im = Image.open(f); im.thumbnail((314, 322))
            x, y = (i % 3)*333+10, (i//3)*350+24
            sheet.paste(im, (x, y))
            draw.text((x, y-17), f"{label.upper()} page {f.stem}", fill="black")
        sheet.save(ROOT / f"{label}-contact-{start//12+1:02}.jpg", quality=90)
    out.close()

word = ROOT / "SCC-51-Pages-Production-QA.docx"
if word.exists():
    with zipfile.ZipFile(word) as z:
        assert z.testzip() is None
        ns = {"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main",
              "wp":"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"}
        xml = ET.fromstring(z.read("word/document.xml"))
        props = xml.findall(".//wp:docPr", ns)
        report["docxStructure"] = {
            "mediaFiles": len([n for n in z.namelist() if n.startswith("word/media/")]),
            "drawings": len(props), "missingImageDescriptions":[p.attrib for p in props if not p.get("descr","").strip()],
            "tables":len(xml.findall(".//w:tbl",ns)),
            "headerRows":len(xml.findall(".//w:tblHeader",ns)),
            "paragraphs":len(xml.findall(".//w:p",ns)),
        }
(ROOT/"inspection.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
