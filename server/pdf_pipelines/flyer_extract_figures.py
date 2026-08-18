"""
Pass 1 of the flyer tagging pipeline: given an input PDF, find every
/Figure struct element, compute its bounding box, crop it out of the
rendered page, and emit a JSON manifest (figure crops as base64 PNG +
existing /Alt text + full page text for context) that a vision model can
use to classify each figure as decorative vs meaningful and, if
meaningful, write a real alt-text description.

Usage: python3 flyer_extract_figures.py <input.pdf>
Prints JSON to stdout: {
  "page_text": "...",
  "figures": [
    {"mcid": 26, "existing_alt": "", "bbox": [x0,y0,x1,y1], "crop_b64": "..."}
    ...
  ]
}
"""

import sys
import json
import base64
import pikepdf
import pymupdf as fitz

fitz.TOOLS.mupdf_display_errors(False)

from flyer_bbox_extract import extract_mcid_bboxes


def collect_figure_mcids(pdf: pikepdf.Pdf):
    figures = {}

    def walk(node):
        if not isinstance(node, pikepdf.Dictionary):
            return
        s_type = str(node.get("/S", ""))
        kids = node.get("/K", None)
        if s_type == "/Figure":
            if kids is not None:
                if isinstance(kids, pikepdf.Array):
                    for k in kids:
                        if isinstance(k, int):
                            figures[int(k)] = node
                elif isinstance(kids, int):
                    figures[int(kids)] = node
            return
        if kids is not None:
            if isinstance(kids, pikepdf.Array):
                for k in kids:
                    walk(k)
            else:
                walk(kids)

    st = pdf.Root.StructTreeRoot
    k = st.get("/K")
    if isinstance(k, pikepdf.Array):
        for top in k:
            walk(top)
    else:
        walk(k)
    return figures


def extract(input_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    figure_mcids = collect_figure_mcids(pdf)
    boxes = extract_mcid_bboxes(pdf, page_index)
    pdf.close()

    doc = fitz.open(input_path)
    page = doc[page_index]
    page_h = page.rect.height
    page_text = page.get_text()

    figures = []
    for mcid, element in figure_mcids.items():
        alt = str(element.get("/Alt", "")) if "/Alt" in element else ""
        box = boxes.get(mcid)
        crop_b64 = None
        bbox_out = None
        is_full_bleed = False
        if box:
            x0, y0, x1, y1 = box
            is_full_bleed = (x1 - x0) >= (page.rect.width * 0.9) and (y1 - y0) >= (page.rect.height * 0.9)
            # Full-bleed figures (hero photos, background art) are real,
            # common flyer content -- always crop and classify them too,
            # just at a lower render DPI since the crop is the whole page.
            # (Previously these were skipped entirely as "text-clip
            # artifacts", which meant real full-bleed photos silently
            # never reached classification and were left completely
            # untagged in the output PDF.)
            pad = 8
            rect = fitz.Rect(x0 - pad, page_h - y1 - pad, x1 + pad, page_h - y0 + pad)
            rect = rect & page.rect
            dpi = 120 if is_full_bleed else 200
            pix = page.get_pixmap(clip=rect, dpi=dpi)
            crop_b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
            bbox_out = [x0, y0, x1, y1]

        figures.append({
            "mcid": mcid,
            "existing_alt": alt,
            "bbox": bbox_out,
            "crop_b64": crop_b64,
            "is_full_bleed": is_full_bleed,
        })

    doc.close()

    return {"page_text": page_text, "figures": figures}


if __name__ == "__main__":
    input_path = sys.argv[1]
    result = extract(input_path)
    print(json.dumps(result))
