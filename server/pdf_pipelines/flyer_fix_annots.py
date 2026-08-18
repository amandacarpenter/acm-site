"""
Fix broken/dangling /Annot structure elements.

A /Annot struct element role exists in Tagged PDF specifically to represent
a real page annotation (link, form widget, etc.) in the logical structure
tree -- it is only valid when the page's /Annots array has a matching
annotation whose /StructParent back-reference resolves to it. Design tools
sometimes mis-tag plain body text as /Annot (seen in the wild: template
boilerplate/disclaimer text positioned off to the side), with no
corresponding page annotation at all. That is a structural defect on its
own, independent of the text's content:

  - A screen reader may announce this text with "link" or "annotation"
    semantics it doesn't actually have.
  - If the wrapped text is genuine flyer content, it should be a normal
    /P paragraph instead.
  - If the wrapped text is non-content scaffolding (e.g. leftover
    instructional/placeholder copy that was never meant to ship, commonly
    styled to be visually unobtrusive -- tiny, low-contrast, or blended
    into a background photo -- so sighted users don't notice it but a
    screen reader still announces it verbatim), it should be removed from
    the accessible content entirely (retagged /Artifact) rather than read
    aloud as if it were part of the flyer.

This module finds every /Annot struct element with no matching page
/Annots entry, extracts its text (by tracking the text position (Tm/Td)
directly in the content stream and cross-referencing against PyMuPDF's
CMap-decoded text spans, since embedded subsetted fonts commonly use
custom glyph encodings that pikepdf's raw Tj/TJ operand strings do not
decode -- PyMuPDF applies the font's real /ToUnicode CMap), and classifies
it as scaffolding vs. real content using a simple keyword heuristic
(deliberately narrow: only matches clear self-referential "this
document/example is..." disclaimer language, never ordinary flyer copy).
Ambiguous or unmatched cases fail safe to /P (kept, readable, correctly
non-annotation) rather than /Artifact (removed) -- silently deleting real
content is worse than leaving harmless plain text.

Usage:
  python3 flyer_fix_annots.py <input.pdf> <output.pdf>

Prints JSON: {"broken_annots_found": n, "converted_to_artifact": n, "converted_to_p": n}
"""

import sys
import json
import re
import pikepdf
import pymupdf as fitz

fitz.TOOLS.mupdf_display_errors(False)

IDENTITY = (1, 0, 0, 1, 0, 0)

# Narrow, deliberately conservative: only matches clear self-referential
# disclaimer/template language about the document itself, not generic
# flyer content (dates, addresses, event descriptions, etc.).
SCAFFOLDING_PATTERNS = [
    r"this (document|example|file|flyer|template)\s+(is|contains)\s+an?\s+example",
    r"intentional(ly)?\s+(accessibility\s+)?errors?",
    r"inaccessible\s+(flyer|document|example)",
    r"placeholder\s+text",
    r"lorem\s+ipsum",
]
SCAFFOLDING_RE = re.compile("|".join(SCAFFOLDING_PATTERNS), re.IGNORECASE)


def mat_mul(a, b):
    a0, b0, c0, d0, e0, f0 = a
    a1, b1, c1, d1, e1, f1 = b
    return (
        a0 * a1 + b0 * c1,
        a0 * b1 + b0 * d1,
        c0 * a1 + d0 * c1,
        c0 * b1 + d0 * d1,
        e0 * a1 + f0 * c1 + e1,
        e0 * b1 + f0 * d1 + f1,
    )


def apply_mat(mat, x, y):
    a, b, c, d, e, f = mat
    return (a * x + c * y + e, b * x + d * y + f)


def _mcid_text_bboxes(page, top_resources):
    """Walk the content stream tracking text-line origins (Tm/Td/TD/T*)
    for every MCID-tagged region, returning {mcid: [x0,y0,x1,y1]} covering
    just the text-drawing operators (Tj/TJ/'/"). Recurses into nested Form
    XObjects."""
    bboxes = {}

    def expand(mcid, x, y):
        if mcid is None:
            return
        b = bboxes.get(mcid)
        if b is None:
            bboxes[mcid] = [x, y, x, y]
        else:
            if x < b[0]:
                b[0] = x
            if y < b[1]:
                b[1] = y
            if x > b[2]:
                b[2] = x
            if y > b[3]:
                b[3] = y

    def walk(content_obj, resources, ctm, mc_stack, depth):
        if depth > 12:
            return
        try:
            instructions = pikepdf.parse_content_stream(content_obj)
        except Exception:
            return

        gs_stack = []
        cur_ctm = ctm
        tm = IDENTITY  # text matrix
        tlm = IDENTITY  # text line matrix

        for instr in instructions:
            op = str(instr.operator)
            ops = instr.operands

            if op == "q":
                gs_stack.append(cur_ctm)
            elif op == "Q":
                if gs_stack:
                    cur_ctm = gs_stack.pop()
            elif op == "cm":
                vals = [float(v) for v in ops]
                cur_ctm = mat_mul(tuple(vals), cur_ctm)
            elif op == "BT":
                tm = IDENTITY
                tlm = IDENTITY
            elif op == "Tm":
                vals = [float(v) for v in ops]
                tm = tuple(vals)
                tlm = tm
            elif op in ("Td", "TD"):
                x, y = [float(v) for v in ops]
                tlm = mat_mul((1, 0, 0, 1, x, y), tlm)
                tm = tlm
            elif op == "T*":
                tlm = mat_mul((1, 0, 0, 1, 0, 0), tlm)
                tm = tlm
            elif op == "BDC":
                tag = str(ops[0]) if ops else ""
                props = ops[1] if len(ops) > 1 else None
                mcid = None
                if isinstance(props, pikepdf.Dictionary) and "/MCID" in props:
                    mcid = int(props["/MCID"])
                mc_stack.append(mcid)
            elif op == "BMC":
                mc_stack.append(None)
            elif op == "EMC":
                if mc_stack:
                    mc_stack.pop()
            elif op in ("Tj", "'", '"'):
                if mc_stack and mc_stack[-1] is not None:
                    px, py = apply_mat(mat_mul(tm, cur_ctm), 0, 0)
                    expand(mc_stack[-1], px, py)
            elif op == "TJ":
                if mc_stack and mc_stack[-1] is not None:
                    px, py = apply_mat(mat_mul(tm, cur_ctm), 0, 0)
                    expand(mc_stack[-1], px, py)
            elif op == "Do":
                name = str(ops[0]) if ops else None
                if name and resources is not None and "/XObject" in resources and name in resources.XObject:
                    xobj = resources.XObject[name]
                    if str(xobj.get("/Subtype", "")) == "/Form":
                        form_matrix = IDENTITY
                        if "/Matrix" in xobj:
                            m = [float(v) for v in xobj.Matrix]
                            if len(m) == 6:
                                form_matrix = tuple(m)
                        nested_ctm = mat_mul(form_matrix, cur_ctm)
                        nested_resources = xobj.get("/Resources", resources)
                        walk(xobj, nested_resources, nested_ctm, list(mc_stack), depth + 1)

        return

    walk(page, top_resources, IDENTITY, [], 0)
    return bboxes


def _text_near_point(input_path, page_index, point, radius=40):
    """Return the PyMuPDF-decoded text within a small square region around
    a text-origin point (PDF user-space, origin bottom-left)."""
    if point is None:
        return ""
    doc = fitz.open(input_path)
    page = doc[page_index]
    page_h = page.rect.height
    x, y = point
    # Expand generously upward/rightward since (x,y) is the first
    # glyph's baseline origin, not a tight bbox around the whole run.
    rect = fitz.Rect(x - 5, page_h - y - radius, x + 400, page_h - y + 10)
    rect = rect & page.rect
    text = page.get_text("text", clip=rect)
    doc.close()
    return text


def find_broken_annots(pdf, page):
    """Returns list of (struct_elem, mcid) for /Annot struct elements with
    no matching page /Annots entry. A correctly-formed /Annot struct
    element corresponds to a real annotation in the page's /Annots array
    (linked via that annotation's /StructParent). If the page has zero
    annotations at all, every /Annot struct element is unconditionally
    dangling -- there is nothing on the page for it to represent."""
    has_page_annots = len(page.get("/Annots", [])) > 0

    broken = []

    def walk(node):
        if isinstance(node, pikepdf.Array):
            for x in node:
                walk(x)
            return
        if not isinstance(node, pikepdf.Dictionary):
            return
        s_type = str(node.get("/S", ""))
        if s_type == "/Annot":
            if not has_page_annots:
                k = node.get("/K")
                mcid = k if isinstance(k, int) else None
                broken.append((node, mcid))
            return
        kids = node.get("/K")
        if kids is not None:
            walk(kids)

    st = pdf.Root.get("/StructTreeRoot")
    if st is not None:
        walk(st.get("/K"))
    return broken


def _rewrite_mcids_to_artifact(pdf, page, mcids_to_artifact):
    resources = page.get("/Resources")

    def rewrite(content_obj, res, depth=0):
        if depth > 12:
            return
        instructions = pikepdf.parse_content_stream(content_obj)
        new_instructions = []
        changed = False
        for instr in instructions:
            op = str(instr.operator)
            if op == "BDC":
                ops = instr.operands
                props = ops[1] if len(ops) > 1 else None
                mcid = int(props["/MCID"]) if isinstance(props, pikepdf.Dictionary) and "/MCID" in props else None
                if mcid is not None and mcid in mcids_to_artifact:
                    new_instructions.append(
                        pikepdf.ContentStreamInstruction(
                            [pikepdf.Name("/Artifact"), pikepdf.Dictionary({})],
                            pikepdf.Operator("BDC"),
                        )
                    )
                    changed = True
                    continue
            elif op == "Do":
                name = str(instr.operands[0]) if instr.operands else None
                if name and res is not None and "/XObject" in res and name in res.XObject:
                    xobj = res.XObject[name]
                    if str(xobj.get("/Subtype", "")) == "/Form":
                        rewrite(xobj, xobj.get("/Resources", res), depth + 1)
            new_instructions.append(instr)
        if changed:
            new_stream = pikepdf.unparse_content_stream(new_instructions)
            if content_obj is page:
                page.Contents = pdf.make_stream(new_stream)
            else:
                content_obj.write(new_stream)

    rewrite(page, resources)


def fix_annots(input_path: str, output_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]

    broken = find_broken_annots(pdf, page)
    text_points = _mcid_text_bboxes(page, page.get("/Resources")) if broken else {}

    to_artifact_mcids = set()
    to_artifact_objgens = set()
    converted_to_p = 0
    removed_empty = 0

    for elem, mcid in broken:
        box = text_points.get(mcid) if mcid is not None else None
        point = (box[0], box[3]) if box else None  # top-left-ish origin
        text = _text_near_point(input_path, page_index, point) if point else ""
        if point is None:
            # Nothing at all was drawn inside this BDC/EMC block -- a
            # genuinely empty dangling /Annot with no content to preserve
            # or announce. Remove it outright rather than leaving an
            # empty /P behind.
            to_artifact_objgens.add(elem.objgen)
            removed_empty += 1
        elif SCAFFOLDING_RE.search(text):
            if mcid is not None:
                to_artifact_mcids.add(mcid)
            to_artifact_objgens.add(elem.objgen)
        else:
            # Fail safe: real (or unclear) content -- keep it readable,
            # just fix the role from /Annot to /P.
            elem.S = pikepdf.Name("/P")
            converted_to_p += 1

    if to_artifact_mcids:
        _rewrite_mcids_to_artifact(pdf, page, to_artifact_mcids)

        # Remove the now-artifact struct elements from the tree and null
        # their ParentTree slots (same convention as flyer_apply_tags.py).
        def filter_kids(kids):
            if isinstance(kids, pikepdf.Array):
                survivors = []
                for k in kids:
                    if isinstance(k, pikepdf.Dictionary):
                        if k.objgen in to_artifact_objgens:
                            continue
                        if "/K" in k:
                            k.K = filter_kids(k.K)
                        survivors.append(k)
                    else:
                        survivors.append(k)
                return pikepdf.Array(survivors)
            return kids

        st = pdf.Root.StructTreeRoot
        st.K = filter_kids(st.K)

        pt = st.get("/ParentTree")
        if pt is not None and "/Nums" in pt:
            nums = pt.Nums
            for i in range(0, len(nums), 2):
                arr = nums[i + 1]
                if isinstance(arr, pikepdf.Array):
                    for mcid in to_artifact_mcids:
                        if 0 <= mcid < len(arr):
                            arr[mcid] = None

    pdf.save(output_path)
    pdf.close()

    return {
        "broken_annots_found": len(broken),
        "converted_to_artifact": len(to_artifact_mcids),
        "converted_to_p": converted_to_p,
        "removed_empty": removed_empty,
    }


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    result = fix_annots(input_path, output_path)
    print(json.dumps(result))
