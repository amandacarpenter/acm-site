"""
Fix placeholder/missing document title metadata.

Design tools (Canva, in particular) ship flyer templates with a stand-in
document title baked into both the classic docinfo /Title entry and the
XMP dc:title field -- e.g. "Title of your event" -- that is never updated
by whoever fills in the template with real content. Our pipeline has
never touched title/metadata for any flyer processed: the actual visible
flyer content is fixed, but assistive tech, browser tabs, and PDF viewer
window titles all continue to announce the leftover placeholder instead
of anything describing the document.

This module detects a missing or placeholder-looking title and replaces
it with a real one derived from the flyer's own visible text: prefer the
largest/most heading-like line of text on the page (via /H1 or /H2
struct elements, resolved through direct text-position tracking rather
than pikepdf's raw Tj/TJ operands, which do not decode custom/subsetted
font encodings), falling back to the first substantial line of plain page
text if no heading is tagged.

Usage:
  python3 flyer_fix_title.py <input.pdf> <output.pdf>

Prints JSON: {"was_placeholder": bool, "old_title": str, "new_title": str, "changed": bool}
"""

import sys
import json
import re
import pikepdf
import pymupdf as fitz

fitz.TOOLS.mupdf_display_errors(False)

from flyer_fix_annots import _mcid_text_bboxes, _text_near_point

# Deliberately narrow set of known template placeholder titles/patterns,
# plus the generic "missing" cases (empty, or literally the filename).
PLACEHOLDER_RE = re.compile(
    r"^(title of your event|your title here|untitled|title here|"
    r"add a title|enter title|document\d*|flyer\d*|new document|"
    r"name of financial aid a(?:pplicant)?(?:\s*\(please print\))?)$",
    re.IGNORECASE,
)


def _is_placeholder(title: str, input_path: str) -> bool:
    if not title:
        return True
    t = title.strip()
    if not t:
        return True
    if PLACEHOLDER_RE.match(t):
        return True
    # A title that's just the source filename (minus extension) is also
    # not a real descriptive title -- Canva/export tools sometimes fall
    # back to this instead of a placeholder string.
    import os

    stem = os.path.splitext(os.path.basename(input_path))[0]
    if t.lower() == stem.lower():
        return True
    return False


def _heading_text(pdf, page, input_path, page_index=0):
    """Return the text of the first /H1 or /H2 struct element found (H1
    preferred), extracted via text-position tracking + PyMuPDF CMap
    decoding. Returns None if no heading struct element exists or its
    text can't be resolved."""
    headings = {"/H1": None, "/H2": None}

    def walk(node):
        if isinstance(node, pikepdf.Array):
            for x in node:
                walk(x)
            return
        if not isinstance(node, pikepdf.Dictionary):
            return
        s = str(node.get("/S", ""))
        k = node.get("/K")
        if s in ("/H1", "/H2") and isinstance(k, int) and headings.get(s) is None:
            headings[s] = k
        if k is not None and not isinstance(k, int):
            walk(k)

    st = pdf.Root.get("/StructTreeRoot")
    if st is not None:
        walk(st.get("/K"))

    if headings["/H1"] is None and headings["/H2"] is None:
        return None

    points = _mcid_text_bboxes(page, page.get("/Resources"))
    candidates = []
    for tag in ("/H1", "/H2"):
        mcid = headings[tag]
        if mcid is None:
            continue
        box = points.get(mcid)
        if not box:
            continue
        point = (box[0], box[3])
        text = _text_near_point(input_path, page_index, point, radius=20)
        # The clip region can pick up trailing unrelated lines below the
        # heading; keep only the first non-empty line.
        for line in text.splitlines():
            line = line.strip()
            if line:
                candidates.append((tag, line))
                break

    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0][1]

    # Some source files mis-tag which line is /H1 vs /H2 (seen in the
    # wild), so don't blindly trust tag order. Prefer the candidate that
    # looks most like an actual title: short, no sentence-ending
    # punctuation, not a call-to-action phrase, not an email/contact line.
    def score(tag, line):
        s = 0
        if len(line) <= 40:
            s += 2
        if not re.search(r"[.:!?]$", line):
            s += 1
        if not re.search(r"@|rsvp|email|reserve|today", line, re.IGNORECASE):
            s += 2
        if tag == "/H1":
            s += 1  # mild tiebreaker only, not a hard preference
        return s

    candidates.sort(key=lambda c: -score(*c))
    return candidates[0][1]


_SKIP_LINE_RE = re.compile(
    r"^(\d+(\.\d+)*\.?|page \d+|https?://\S+|\d{1,2}/\d{1,2}/\d{2,4})$",
    re.IGNORECASE,
)


def _fallback_first_line(input_path, page_index=0) -> str:
    """Choose the most title-like visible line, preferring larger type."""
    doc = fitz.open(input_path)
    page = doc[page_index]
    candidates = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(span.get("text", "") for span in spans).strip()
            if len(text) < 6 or len(text) > 120 or _SKIP_LINE_RE.match(text):
                continue
            if re.search(r"@|https?://|phone:|fax:|return to:", text, re.I):
                continue
            size = max((float(span.get("size", 0)) for span in spans), default=0)
            y0 = float(line.get("bbox", [0, 0, 0, 0])[1])
            score = size * 10
            if 8 <= len(text.split()) <= 14:
                score += 8
            if text.endswith(":"):
                score -= 12
            if re.search(r"\b(name|student id|academic year).*(print|_+|:)", text, re.I):
                score -= 30
            score -= y0 / 1000
            candidates.append((score, text))
    doc.close()
    if candidates:
        candidates.sort(reverse=True)
        return candidates[0][1]
    return "Untitled document"


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _promote_visible_title_to_h1(
    pdf, page, input_path: str, title: str, page_index: int = 0
) -> bool:
    """Promote the struct element containing the visible title to /H1."""
    wanted = _normalize_text(title)
    if not wanted:
        return False
    fitz_doc = fitz.open(input_path)
    fitz_page = fitz_doc[page_index]
    title_anchor = None
    for block in fitz_page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            text = "".join(
                span.get("text", "") for span in line.get("spans", [])
            )
            if _normalize_text(text) == wanted:
                x0, _, _, y1 = line["bbox"]
                title_anchor = (float(x0), float(fitz_page.rect.height - y1))
                break
        if title_anchor is not None:
            break
    fitz_doc.close()
    points = _mcid_text_bboxes(page, page.get("/Resources"))
    matches = []
    for mcid, box in points.items():
        nearby = _normalize_text(
            _text_near_point(input_path, page_index, (box[0], box[3]), radius=12)
        )
        if wanted in nearby:
            distance = (
                abs(box[0] - title_anchor[0]) + abs(box[3] - title_anchor[1])
                if title_anchor is not None
                else 0
            )
            matches.append((distance, int(mcid)))
    if not matches:
        return False
    target_mcid = min(matches)[1]

    target = None
    existing_h1 = []

    def walk(node):
        nonlocal target
        if isinstance(node, pikepdf.Array):
            for child in node:
                walk(child)
            return
        if not isinstance(node, pikepdf.Dictionary):
            return
        if str(node.get("/S", "")) == "/H1":
            existing_h1.append(node)
        k = node.get("/K")
        if isinstance(k, int) and int(k) == target_mcid:
            target = node
        elif isinstance(k, (pikepdf.Array, pikepdf.Dictionary)):
            walk(k)

    st = pdf.Root.get("/StructTreeRoot")
    if st is None:
        return False
    walk(st.get("/K"))
    if target is None:
        return False

    changed = str(target.get("/S", "")) != "/H1"
    target.S = pikepdf.Name("/H1")
    for heading in existing_h1:
        if heading is not target:
            heading.S = pikepdf.Name("/P")
            changed = True
    return changed


def fix_title(input_path: str, output_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]

    old_title = str(pdf.docinfo.get("/Title", "")) if "/Title" in pdf.docinfo else ""
    is_placeholder = _is_placeholder(old_title, input_path)

    result = {
        "was_placeholder": is_placeholder,
        "old_title": old_title,
        "new_title": old_title,
        "changed": False,
        "title_changed": False,
        "heading_fixed": False,
    }

    new_title = old_title.strip()
    if is_placeholder:
        new_title = _fallback_first_line(input_path, page_index).strip()[:120]
        pdf.docinfo["/Title"] = new_title
        with pdf.open_metadata() as meta:
            meta["dc:title"] = new_title
        result["title_changed"] = True

    heading_fixed = _promote_visible_title_to_h1(
        pdf, page, input_path, new_title, page_index
    )
    result["new_title"] = new_title
    result["heading_fixed"] = heading_fixed
    result["changed"] = bool(result["title_changed"] or heading_fixed)
    if result["changed"]:
        pdf.save(output_path)
    pdf.close()
    return result


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    result = fix_title(input_path, output_path)
    print(json.dumps(result))
