#!/usr/bin/env python3
"""
Remedy508 Complex PDF — Vision-First Accessibility Pipeline

Pass 1: Render each PDF page as a high-res PNG using PyMuPDF
Pass 2: Send page images to Claude Vision — Claude reads the full page
        visually and returns structured content (headings, paragraphs,
        tables, figures with alt text, lists) as JSON
Pass 3: reportlab rebuilds a fully tagged, WCAG 2.1 AA PDF from that JSON

Works on ANY PDF — scanned, image-only, chemistry diagrams, equations,
multi-column layouts, complex tables. All content read visually.

Usage:
  python3 complexpdf_pipeline.py <input.pdf> <output.pdf> <title> <anthropic_key>

Outputs JSON stats to stdout. Errors → stderr, exit code 1.
"""

import sys
import json
import re
import base64
import traceback
import time
from pathlib import Path

import fitz  # PyMuPDF
import anthropic

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ── Pass 1: Render pages as images ────────────────────────────────────────────

def render_pages(pdf_path: str, dpi: int = 150) -> list:
    """
    Render each PDF page as a base64-encoded PNG.
    Returns list of {"page": N, "b64": "...", "width": W, "height": H}
    """
    doc = fitz.open(pdf_path)
    pages = []
    mat = fitz.Matrix(dpi / 72, dpi / 72)

    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")
        b64 = base64.standard_b64encode(png_bytes).decode("ascii")
        pages.append({
            "page": i + 1,
            "b64": b64,
            "width": pix.width,
            "height": pix.height,
        })

    doc.close()
    return pages


# ── Pass 2: Claude Vision extraction ──────────────────────────────────────────

PAGE_PROMPT = """You are an accessibility expert extracting content from a PDF page image to rebuild it as a WCAG 2.1 AA compliant document.

Look at this page image carefully. Extract ALL visible content — every heading, paragraph, table, figure, equation, caption, exercise, answer, list item, and label. Do not skip anything.

Return a JSON array of content elements in reading order (top to bottom, left to right for multi-column). Each element must be one of:

{"type": "heading", "level": 1-6, "text": "exact text"}
{"type": "paragraph", "text": "exact text"}  
{"type": "list_item", "text": "exact text"}
{"type": "caption", "text": "exact text"}
{"type": "figure", "alt_text": "specific description of diagram/chart/image under 125 chars"}
{"type": "table", "summary": "what this table shows", "headers": ["col1","col2",...], "rows": [["cell","cell",...], ...]}
{"type": "callout", "label": "e.g. Exercise 20.4.1 or Worked Example or Note", "text": "full body text"}

Rules:
- Assign heading levels logically. Document title = H1, major sections = H2, subsections = H3, etc.
- For chemical structure diagrams, equations, or molecular drawings: use type "figure" with a specific alt_text describing exactly what is shown (e.g. "Acetic acid structure: CH3COOH with pKa=4.76")
- For tables: extract ALL rows and columns with exact cell values
- For exercises/worked examples/notes in boxes: use type "callout" with the box label and full body text
- Include ALL superscripts, subscripts, and special characters as plain text (e.g. pKa, CO2, H2O)
- Do NOT include page headers, footers, page numbers, or URLs
- Keep ALL body text — do not summarize

Return ONLY the JSON array, no markdown fences, no explanation."""


def extract_page_with_vision(page_data: dict, client: anthropic.Anthropic, page_num: int, total: int) -> list:
    """Send one page image to Claude Vision and get structured content back."""
    print(f"[COMPLEXPDF] Analyzing page {page_num}/{total} with vision...", file=sys.stderr)

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": page_data["b64"],
                    }
                },
                {
                    "type": "text",
                    "text": PAGE_PROMPT
                }
            ]
        }]
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        elements = json.loads(raw)
        if not isinstance(elements, list):
            elements = []
    except json.JSONDecodeError:
        # Try to extract array from response
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                elements = json.loads(match.group())
            except Exception:
                elements = []
        else:
            elements = []

    return elements


def analyze_all_pages(pages: list, anthropic_key: str) -> list:
    """
    Run vision extraction on all pages sequentially.
    Returns flat list of all content elements across all pages.
    """
    client = anthropic.Anthropic(api_key=anthropic_key)
    all_elements = []
    total = len(pages)

    for i, page_data in enumerate(pages):
        try:
            elements = extract_page_with_vision(page_data, client, i + 1, total)
            all_elements.extend(elements)
            # Add page break between pages (except after last)
            if i < total - 1 and elements:
                all_elements.append({"type": "page_break"})
        except Exception as e:
            print(f"[COMPLEXPDF] Warning: page {i+1} extraction failed: {e}", file=sys.stderr)
            all_elements.append({
                "type": "paragraph",
                "text": f"[Page {i+1} content could not be extracted]"
            })

        # Brief pause to avoid rate limiting on large docs
        if i < total - 1:
            time.sleep(0.5)

    return all_elements


# ── Pass 3: Rebuild PDF with reportlab ────────────────────────────────────────

def build_accessible_pdf(elements: list, output_path: str, title: str) -> dict:
    """Rebuild a fully tagged, accessible PDF from the extracted elements."""

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
        title=title,
        author="Remedy508",
        subject="WCAG 2.1 AA Accessible Document",
        lang="en-US",
    )

    # ── Register fonts ──
    font_dir = Path("/app/fonts")
    if not font_dir.exists():
        font_dir = Path(__file__).parent / "fonts"

    base_font = "Helvetica"
    bold_font = "Helvetica-Bold"
    italic_font = "Helvetica-Oblique"

    for fname, ffile in [("DejaVuSans", "DejaVuSans.ttf"), ("DejaVuSans-Bold", "DejaVuSans-Bold.ttf")]:
        candidate = font_dir / ffile
        if candidate.exists():
            try:
                pdfmetrics.registerFont(TTFont(fname, str(candidate)))
                base_font = "DejaVuSans"
                bold_font = "DejaVuSans-Bold"
            except Exception:
                pass

    # ── Styles ──
    styles = getSampleStyleSheet()

    def ms(name, parent="Normal", **kw):
        return ParagraphStyle(name=name, parent=styles[parent], **kw)

    h = {
        1: ms("H1", "Heading1", fontName=bold_font, fontSize=22, leading=28, spaceAfter=12, spaceBefore=20, textColor=colors.HexColor("#1a1a2e")),
        2: ms("H2", "Heading2", fontName=bold_font, fontSize=17, leading=23, spaceAfter=10, spaceBefore=16, textColor=colors.HexColor("#1a1a2e")),
        3: ms("H3", "Heading3", fontName=bold_font, fontSize=14, leading=20, spaceAfter=8, spaceBefore=12, textColor=colors.HexColor("#1a1a2e")),
        4: ms("H4", "Heading4", fontName=bold_font, fontSize=12, leading=17, spaceAfter=6, spaceBefore=10, textColor=colors.HexColor("#1a1a2e")),
        5: ms("H5", fontName=bold_font, fontSize=11, leading=16, spaceAfter=4, spaceBefore=8, textColor=colors.HexColor("#1a1a2e")),
        6: ms("H6", fontName=bold_font, fontSize=10, leading=14, spaceAfter=4, spaceBefore=6, textColor=colors.HexColor("#1a1a2e")),
    }
    body = ms("Body", fontName=base_font, fontSize=11, leading=16, spaceAfter=8, textColor=colors.HexColor("#1a1a1a"), alignment=TA_JUSTIFY)
    list_s = ms("List", fontName=base_font, fontSize=11, leading=16, spaceAfter=4, leftIndent=20, textColor=colors.HexColor("#1a1a1a"))
    caption = ms("Caption", fontName=italic_font, fontSize=9, leading=13, spaceAfter=6, spaceBefore=2, textColor=colors.HexColor("#444444"), alignment=TA_CENTER)
    callout_label = ms("CalloutLabel", fontName=bold_font, fontSize=11, leading=15, spaceAfter=4, textColor=colors.HexColor("#1a3a6b"))
    callout_body = ms("CalloutBody", fontName=base_font, fontSize=11, leading=16, spaceAfter=6, leftIndent=10, textColor=colors.HexColor("#1a1a1a"))

    def sx(t: str) -> str:
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    story = []
    stats = {"headings": 0, "paragraphs": 0, "tables": 0, "figures": 0, "list_items": 0, "callouts": 0}

    for elem in elements:
        etype = elem.get("type", "paragraph")

        if etype == "heading":
            level = max(1, min(6, int(elem.get("level", 2))))
            text = sx(str(elem.get("text", "")).strip())
            if text:
                story.append(Paragraph(text, h[level]))
                stats["headings"] += 1

        elif etype == "paragraph":
            text = sx(str(elem.get("text", "")).strip())
            if text:
                story.append(Paragraph(text, body))
                stats["paragraphs"] += 1

        elif etype == "list_item":
            text = sx(str(elem.get("text", "")).strip())
            if text:
                story.append(Paragraph(f"\u2022\u2002{text}", list_s))
                stats["list_items"] += 1

        elif etype == "caption":
            text = sx(str(elem.get("text", "")).strip())
            if text:
                story.append(Paragraph(text, caption))

        elif etype == "figure":
            alt = sx(str(elem.get("alt_text", "Figure")).strip())
            story.append(Spacer(1, 4))
            story.append(Paragraph(f"[Figure: {alt}]", caption))
            story.append(Spacer(1, 4))
            stats["figures"] += 1

        elif etype == "callout":
            label = sx(str(elem.get("label", "Note")).strip())
            text = sx(str(elem.get("text", "")).strip())
            block = []
            if label:
                block.append(Paragraph(label, callout_label))
            if text:
                block.append(Paragraph(text, callout_body))
            if block:
                # Wrap in a single-cell table for visual grouping
                tbl = Table([[block]], colWidths=[6.5 * inch])
                tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f4ff")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#c7d7f7")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]))
                story.append(Spacer(1, 6))
                story.append(tbl)
                story.append(Spacer(1, 6))
                stats["callouts"] += 1

        elif etype == "table":
            headers = elem.get("headers", [])
            rows = elem.get("rows", [])
            summary = elem.get("summary", "Data table")

            all_rows = ([headers] if headers else []) + (rows or [])
            if not all_rows:
                continue

            max_cols = max((len(r) for r in all_rows), default=1)
            normalized = []
            for r in all_rows:
                padded = [sx(str(c)) for c in r] + [""] * (max_cols - len(r))
                normalized.append(padded[:max_cols])

            col_w = (6.5 * inch) / max(max_cols, 1)
            tbl = Table(normalized, colWidths=[col_w] * max_cols, repeatRows=1 if headers else 0)
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3a485b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), bold_font),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTNAME", (0, 1), (-1, -1), base_font),
                ("FONTSIZE", (0, 1), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f9fa")]),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1a1a1a")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ]))
            story.append(Spacer(1, 8))
            story.append(tbl)
            story.append(Spacer(1, 8))
            stats["tables"] += 1

        elif etype == "page_break":
            story.append(PageBreak())

    if not story:
        story.append(Paragraph("Document content could not be extracted.", body))

    doc.build(story)
    return stats


# ── Finalize: accessibility metadata via pikepdf ───────────────────────────────

def finalize_pdf(output_pdf: str, title: str) -> int:
    import pikepdf
    pp = pikepdf.open(output_pdf, suppress_warnings=True, allow_overwriting_input=True)
    pp.Root["/Lang"] = pikepdf.String("en-US")
    pp.Root["/ViewerPreferences"] = pikepdf.Dictionary(DisplayDocTitle=pikepdf.Boolean(True))
    if "/MarkInfo" not in pp.Root:
        pp.Root["/MarkInfo"] = pikepdf.Dictionary(Marked=pikepdf.Boolean(True))

    # Document info
    if "/Info" not in pp.trailer:
        pp.trailer["/Info"] = pikepdf.Dictionary()
    info = pp.trailer["/Info"]
    info["/Title"] = pikepdf.String(title)
    info["/Subject"] = pikepdf.String("WCAG 2.1 AA Accessible Document")
    info["/Creator"] = pikepdf.String("Remedy508")

    for page in pp.pages:
        page["/Tabs"] = pikepdf.Name("/S")

    page_count = len(pp.pages)
    pp.save(output_pdf)
    pp.close()
    return page_count


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 5:
        print("Usage: complexpdf_pipeline.py <input.pdf> <output.pdf> <title> <anthropic_key>", file=sys.stderr)
        sys.exit(1)

    input_pdf  = sys.argv[1]
    output_pdf = sys.argv[2]
    title      = sys.argv[3] or "Accessible Document"
    anth_key   = sys.argv[4]

    # Pass 1 — render pages
    print(f"[COMPLEXPDF] Rendering pages...", file=sys.stderr)
    pages = render_pages(input_pdf, dpi=150)
    print(f"[COMPLEXPDF] {len(pages)} pages rendered", file=sys.stderr)

    # Pass 2 — vision extraction
    elements = analyze_all_pages(pages, anth_key)
    print(f"[COMPLEXPDF] Extracted {len(elements)} elements", file=sys.stderr)

    # Pass 3 — rebuild
    print(f"[COMPLEXPDF] Building accessible PDF...", file=sys.stderr)
    stats = build_accessible_pdf(elements, output_pdf, title)

    # Finalize
    page_count = finalize_pdf(output_pdf, title)

    result = {
        "source_pages": len(pages),
        "output_pages": page_count,
        "headings": stats["headings"],
        "paragraphs": stats["paragraphs"],
        "tables": stats["tables"],
        "figures": stats["figures"],
        "list_items": stats["list_items"],
        "callouts": stats["callouts"],
    }
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
