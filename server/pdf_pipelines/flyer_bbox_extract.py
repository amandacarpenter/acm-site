"""
Compute a bounding box (in PDF user-space points) for each MCID-tagged
BDC/EMC marked-content region on a page, by replaying the content stream
and tracking the current transformation matrix (CTM) plus the extent of
every drawing operator (path construction, line/curve segments, inline
and XObject images) executed while inside that region.

This does NOT need to be pixel-perfect -- it only needs to produce a
reasonably tight crop rectangle so a vision model can look at "the figure"
in isolation alongside its nearby text, for classification purposes. We
never write these boxes back into the PDF and never touch the content
stream here.
"""

import sys
import json
import pikepdf


def mat_mul(a, b):
    """Multiply two PDF 2D affine matrices given as (a,b,c,d,e,f) tuples,
    representing the standard PDF transform matrix. Returns a @ b (a applied
    after b, i.e. b is applied to points first -- matches PDF `cm` semantics
    where the new CTM = new_matrix x old_CTM)."""
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


def extract_mcid_bboxes(pdf: pikepdf.Pdf, page_index: int = 0) -> dict:
    """Returns {mcid: [x0, y0, x1, y1]} in PDF user-space points (origin
    bottom-left, matching PDF page coordinate conventions)."""
    page = pdf.pages[page_index]
    instructions = pikepdf.parse_content_stream(page)

    identity = (1, 0, 0, 1, 0, 0)
    gs_stack = []
    ctm = identity

    # Stack of active marked-content mcids (None if not tracked, e.g. non-MCID BDC/BMC)
    mc_stack = []
    bboxes = {}  # mcid -> [x0,y0,x1,y1]
    cur_path_start = None
    cur_point = None

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

    def expand_for_active(x, y):
        for mcid in mc_stack:
            expand(mcid, x, y)

    def active_mcid():
        for m in reversed(mc_stack):
            if m is not None:
                return m
        return None

    for instr in instructions:
        op = str(instr.operator)
        ops = instr.operands

        if op == "q":
            gs_stack.append(ctm)
        elif op == "Q":
            if gs_stack:
                ctm = gs_stack.pop()
        elif op == "cm":
            vals = [float(v) for v in ops]
            ctm = mat_mul(tuple(vals), ctm)
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
        elif op == "re":
            x, y, w, h = [float(v) for v in ops]
            for corner in [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]:
                px, py = apply_mat(ctm, *corner)
                expand_for_active(px, py)
            cur_point = (x, y)
            cur_path_start = (x, y)
        elif op == "m":
            x, y = [float(v) for v in ops]
            px, py = apply_mat(ctm, x, y)
            expand_for_active(px, py)
            cur_point = (x, y)
            cur_path_start = (x, y)
        elif op == "l":
            x, y = [float(v) for v in ops]
            px, py = apply_mat(ctm, x, y)
            expand_for_active(px, py)
            cur_point = (x, y)
        elif op == "c":
            vals = [float(v) for v in ops]
            for i in range(0, 6, 2):
                px, py = apply_mat(ctm, vals[i], vals[i + 1])
                expand_for_active(px, py)
            cur_point = (vals[4], vals[5])
        elif op in ("v", "y"):
            vals = [float(v) for v in ops]
            for i in range(0, len(vals), 2):
                px, py = apply_mat(ctm, vals[i], vals[i + 1])
                expand_for_active(px, py)
            cur_point = (vals[-2], vals[-1])
        elif op == "h":
            if cur_path_start:
                px, py = apply_mat(ctm, *cur_path_start)
                expand_for_active(px, py)
        elif op == "Do":
            # XObject (image or form). Its unit square [0,1]x[0,1] is mapped
            # by the current CTM.
            for corner in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                px, py = apply_mat(ctm, *corner)
                expand_for_active(px, py)
        elif op in ("Tj", "TJ", "'", '"'):
            # Text drawing -- approximate with the current text position's
            # transformed origin (not tracking full text matrix here; text
            # MCIDs aren't the figures we care about for bbox purposes).
            pass

    return bboxes


if __name__ == "__main__":
    input_path = sys.argv[1]
    pdf = pikepdf.open(input_path)
    boxes = extract_mcid_bboxes(pdf)
    print(json.dumps(boxes, indent=2))
    pdf.close()
