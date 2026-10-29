"""Validate the real-AI catalog sample downloaded through the private preview."""
import json
from pathlib import Path
import sys
import zipfile
import pymupdf as fitz
import pikepdf
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/pdf_pipelines"))
from complex_pdf_extract import extract_pdf

qa = Path("/tmp/remedy-large-docs-qa")
source = qa / "catalog-cover-portrait-map.pdf"
extraction = extract_pdf(str(source), str(qa / "ai-source-extraction"))
portrait = fitz.Pixmap(extraction["pages"][1]["images"][0]["path"])
portrait_digest = fitz.Pixmap(fitz.csRGB, portrait).digest
cover = fitz.Pixmap(extraction["pages"][0]["screenshot"])
cover_digest = fitz.Pixmap(fitz.csRGB, cover).digest
pdf = fitz.open(qa / "catalog-ai-test.pdf")
pdf_images = [fitz.Pixmap(fitz.csRGB, fitz.Pixmap(pdf, i["xref"])).digest
              for page in pdf for i in page.get_image_info(xrefs=True) if i["xref"]]
assert portrait_digest in pdf_images, "Portrait pixels/color changed"
assert cover_digest in pdf_images, "Composite cover pixels changed"
assert len(pdf_images) == 3, "Expected cover, portrait and map"
with pikepdf.open(qa / "catalog-ai-test.pdf") as tagged:
    assert tagged.Root.MarkInfo.Marked and tagged.Root.StructTreeRoot
    seen, figures, headings = set(), [], []
    def walk(node):
        if isinstance(node, pikepdf.Array):
            for child in node:
                walk(child)
        elif isinstance(node, pikepdf.Dictionary):
            key = node.objgen
            if key != (0, 0):
                if key in seen:
                    return
                seen.add(key)
            if str(node.get("/S", "")) == "/Figure":
                figures.append(str(node.get("/Alt", "")))
            if str(node.get("/S", "")) in ["/H1", "/H2", "/H3", "/H4", "/H5", "/H6"]:
                headings.append(str(node.S))
            if "/K" in node:
                walk(node.K)
    walk(tagged.Root.StructTreeRoot)
    assert len(figures) == 3 and all(figures)
    assert headings.count("/H1") == 1
with zipfile.ZipFile(qa / "catalog-ai-test.docx") as archive:
    media = [archive.read(n) for n in archive.namelist() if n.startswith("word/media/")]
    word_images = [fitz.Pixmap(fitz.csRGB, fitz.Pixmap(raw)).digest for raw in media]
    assert portrait_digest in word_images and cover_digest in word_images
    assert len(media) == 3
    xml = etree.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
          "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"}
    descriptions = [d.get("descr") for d in xml.findall(".//wp:docPr", ns)]
    assert len(descriptions) == 3 and all(descriptions)
    styles = [s.get("{"+ns["w"]+"}val") for s in xml.findall(".//w:pStyle", ns)]
    assert "Heading1" in styles and "Heading2" in styles and "ListNumber" in styles
result = {"sourcePages": [1, 5, 6], "pdfPages": len(pdf), "pdfImages": len(pdf_images),
          "wordImages": len(media), "pdfFigureAlts": figures, "wordImageAlts": descriptions,
          "portraitPixelsMatch": True, "coverPixelsMatch": True,
          "note": "Automated and visual sample checks; not an accessibility certification."}
(qa / "ai-results.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
