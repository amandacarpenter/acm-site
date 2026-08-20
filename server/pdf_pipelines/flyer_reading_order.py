"""
flyer_reading_order.py

Fixes a real, distinct defect found in Canva/Illustrator/InDesign PDF exports:
the /StructTreeRoot's flat list of child struct elements (/Figure, /P, etc.)
is not necessarily in the same order as the elements actually appear VISUALLY
on the page. MCIDs are assigned correctly and each element's own tagging
(/Alt text, decorative-vs-meaningful) can be entirely correct, but a screen
reader -- and critically, click-and-drag text *selection*/highlighting in
Acrobat, Preview, and browsers -- both walk the struct tree's /K array in
document order to determine reading order, not the page's visual layout. If
the struct tree's array doesn't match top-to-bottom/left-to-right visual
flow, a screen reader announces things in a scrambled, confusing sequence
even though every individual tag is fine.

IMPORTANT: the sort key here is real 2D page geometry (bounding box top-Y,
then left-X, grouped into visually-overlapping rows), NOT content-stream
drawing sequence. An earlier version of this module sorted by content-stream
order instead, on the theory that "the order things are drawn roughly matches
reading order." That assumption is wrong for Canva/Illustrator/InDesign
exports: these tools serialize objects in LAYER-CREATION order (whichever
z-order layer a designer added first, e.g. background photo, then logo, then
whichever text box happened to be typed 6th), which has no reliable
relationship to on-page position. Confirmed on the reported flyer: elements
near the visual TOP of the page (e.g. the "Garden Club" wordmark, the event
date/time) had HIGH content-stream sequence numbers, while elements near the
BOTTOM (e.g. the RSVP block) had LOW ones -- sorting by content-stream order
therefore produced a reading order that visibly jumped around the page
(confirmed via a user screenshot of Acrobat's Reading Order tool showing tag
numbers completely out of visual sequence, e.g. the "Water" hexagon column
labeled before "Plant", and the date/time block labeled last despite being
near the top).

This module runs as the FINAL step of the flyer pipeline (after both
flyer_orphan_figures.py apply and flyer_apply_tags.py apply_tags have run),
since it needs to see the complete, final set of MCIDs including any newly
added by the orphan-figure and background-image passes. It:

1. Walks the page's content stream (recursing into nested Form XObjects) and
   tracks the current transformation matrix (CTM) plus text-positioning
   operators (BT/Tm/Td/TD) to compute a real page-space bounding box for
   every MCID's marked-content span -- covering both text (Tj/TJ/'/") and
   image (Do) content.
2. Walks the struct tree to find the flat array of the actual content
   container's children (see _find_reorder_target) and re-sorts that array
   using each element's own bounding box (or, for elements with multiple
   MCIDs, the union of all of them) as the sort key: primarily top-to-bottom
   by the box's top edge, but elements whose vertical extent clearly overlaps
   (i.e. they sit in the same visual "row", like side-by-side hexagon icons
   or multi-column layouts) are instead ordered left-to-right within that
   row. Elements with no resolvable bounding box are kept in their original
   relative order and placed at the end, never dropped.

This is a pure struct-tree reorder -- no MCIDs, /Alt text, or page content
are changed, and the visual page render is unaffected.
"""

import sys
import json
import pikepdf


def _mat_mult(a, b):
    """2x3 affine matrix multiply, PDF convention: result = a x b."""
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]


def _apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def _get_mcid_bboxes(pdf: pikepdf.Pdf, page) -> dict:
    """Returns {mcid: [x0, y0, x1, y1]} in page space (PDF coords, origin
    bottom-left) by walking the page's content stream -- recursing into
    nested Form XObjects -- and tracking the CTM plus text-line matrix.

    Text-showing operators (Tj/TJ/'/") only give us the ORIGIN point of each
    glyph run via the text matrix -- they carry no explicit width or height.
    Treating that origin as a zero-size point is a real bug: it makes every
    text element a single point, which breaks any "do these two elements
    visually overlap in this row" check (two points essentially never
    coincide), silently defeating left-to-right column ordering for
    side-by-side text blocks (e.g. three icon captions in a row). To avoid
    this, each text-showing call estimates a real bounding box:
      - height: derived from the active font size (Tf) scaled by the text
        matrix's vertical scale, using standard typographic conventions
        (ascent above baseline, descent below) so single-line boxes have
        sensible extent instead of zero.
      - width: derived by advancing an x-cursor per character shown, using
        the average glyph width from the font's /Widths array (or a
        reasonable fallback fraction of the font size when unavailable),
        scaled by the text matrix's horizontal scale.
    This is an approximation (not exact glyph metrics/kerning), but it is
    sufficient to correctly detect "these elements sit in the same visual
    row" and "this element is to the left/right of that one" -- the only
    two comparisons the reading-order sort actually needs.

    Image-drawing (Do of a non-Form XObject) still uses the exact unit
    square mapped through the CTM, which is already a real bounding box.
    """
    bboxes: dict[int, list[float]] = {}

    def record_box(mcid, x0, y0, x1, y1):
        lo_x, hi_x = (x0, x1) if x0 <= x1 else (x1, x0)
        lo_y, hi_y = (y0, y1) if y0 <= y1 else (y1, y0)
        b = bboxes.get(mcid)
        if b is None:
            bboxes[mcid] = [lo_x, lo_y, hi_x, hi_y]
        else:
            if lo_x < b[0]:
                b[0] = lo_x
            if lo_y < b[1]:
                b[1] = lo_y
            if hi_x > b[2]:
                b[2] = hi_x
            if hi_y > b[3]:
                b[3] = hi_y

    # Typographic constants for estimating a single-line text box from font
    # size alone, expressed as fractions of the font size (standard values
    # used by most Latin text faces).
    ASCENT_FRAC = 0.75
    DESCENT_FRAC = 0.25
    FALLBACK_AVG_CHAR_WIDTH_FRAC = 0.5  # fraction of font size, if no /Widths

    def _avg_glyph_width_frac(resources, font_name):
        """Best-effort average glyph width as a fraction of font size, from
        the font's /Widths array (simple fonts) when resolvable. Falls back
        to a fixed fraction when the font/array can't be resolved.
        """
        try:
            if not (font_name and resources and "/Font" in resources):
                return FALLBACK_AVG_CHAR_WIDTH_FRAC
            font = resources.Font.get(font_name)
            if font is None:
                return FALLBACK_AVG_CHAR_WIDTH_FRAC
            widths = font.get("/Widths")
            if isinstance(widths, pikepdf.Array) and len(widths) > 0:
                vals = [float(w) for w in widths if isinstance(w, (int, float, pikepdf.Object))]
                vals = [v for v in vals if v > 0]
                if vals:
                    # /Widths values are in 1000-units-per-em glyph space.
                    return (sum(vals) / len(vals)) / 1000.0
        except Exception:
            pass
        return FALLBACK_AVG_CHAR_WIDTH_FRAC

    def walk(content_obj, resources, base_ctm):
        try:
            instrs = pikepdf.parse_content_stream(content_obj)
        except Exception:
            return
        gs_stack = []
        cur_ctm = base_ctm
        mc_stack = []  # stack of mcid-or-None
        tm = [1, 0, 0, 1, 0, 0]
        tlm = [1, 0, 0, 1, 0, 0]
        font_size = 12.0
        font_name = None

        def show_text_box(mcid, num_chars):
            if mcid is None or num_chars <= 0:
                return
            full_m = _mat_mult(tm, cur_ctm)
            avg_w_frac = _avg_glyph_width_frac(resources, font_name)
            text_w = num_chars * avg_w_frac * font_size
            x0, y0 = _apply(full_m, 0, -DESCENT_FRAC * font_size)
            x1, y1 = _apply(full_m, text_w, ASCENT_FRAC * font_size)
            record_box(mcid, x0, y0, x1, y1)

        for instr in instrs:
            op = str(instr.operator)
            if op == "q":
                gs_stack.append(cur_ctm)
            elif op == "Q":
                if gs_stack:
                    cur_ctm = gs_stack.pop()
            elif op == "cm":
                try:
                    ops = [float(x) for x in instr.operands]
                    cur_ctm = _mat_mult(ops, cur_ctm)
                except Exception:
                    pass
            elif op == "BDC":
                mcid = None
                props = instr.operands[1] if len(instr.operands) > 1 else None
                if isinstance(props, pikepdf.Dictionary) and "/MCID" in props:
                    try:
                        mcid = int(props["/MCID"])
                    except Exception:
                        mcid = None
                mc_stack.append(mcid)
            elif op == "BMC":
                mc_stack.append(None)
            elif op == "EMC":
                if mc_stack:
                    mc_stack.pop()
            elif op == "BT":
                tm = [1, 0, 0, 1, 0, 0]
                tlm = [1, 0, 0, 1, 0, 0]
            elif op == "Tf":
                try:
                    font_name = "/" + str(instr.operands[0]).lstrip("/")
                    font_size = float(instr.operands[1])
                except Exception:
                    pass
            elif op == "Tm":
                try:
                    tm = [float(x) for x in instr.operands]
                    tlm = list(tm)
                except Exception:
                    pass
            elif op in ("Td", "TD"):
                try:
                    tx, ty = float(instr.operands[0]), float(instr.operands[1])
                    tlm = _mat_mult([1, 0, 0, 1, tx, ty], tlm)
                    tm = list(tlm)
                except Exception:
                    pass
            elif op == "T*":
                tlm = _mat_mult([1, 0, 0, 1, 0, 0], tlm)
                tm = list(tlm)
            elif op in ("Tj", "'", '"'):
                active = next((m for m in reversed(mc_stack) if m is not None), None)
                if active is not None and instr.operands:
                    try:
                        n = len(bytes(instr.operands[-1]))
                    except Exception:
                        n = 1
                    show_text_box(active, max(n, 1))
            elif op == "TJ":
                active = next((m for m in reversed(mc_stack) if m is not None), None)
                if active is not None and instr.operands:
                    n = 0
                    try:
                        for item in instr.operands[0]:
                            if isinstance(item, pikepdf.String):
                                n += len(bytes(item))
                    except Exception:
                        n = 1
                    show_text_box(active, max(n, 1))
            elif op == "Do":
                name = str(instr.operands[0]) if instr.operands else None
                xobj = None
                if name and resources and "/XObject" in resources:
                    xobj = resources.XObject.get(name)
                if xobj is not None and xobj.get("/Subtype") == pikepdf.Name("/Form"):
                    sub_res = xobj.get("/Resources", resources)
                    walk(xobj, sub_res, cur_ctm)
                else:
                    active = next((m for m in reversed(mc_stack) if m is not None), None)
                    if active is not None:
                        corners = [_apply(cur_ctm, x, y) for x, y in [(0, 0), (1, 0), (0, 1), (1, 1)]]
                        xs = [c[0] for c in corners]
                        ys = [c[1] for c in corners]
                        record_box(active, min(xs), min(ys), max(xs), max(ys))

    walk(page, page.Resources, [1, 0, 0, 1, 0, 0])
    return bboxes


def _first_mcid(elem) -> int | None:
    """Recursively find the first MCID referenced anywhere under a struct
    element's /K, in document order (depth-first), for use as a fallback
    sort key when a bounding box can't be resolved.
    """
    k = elem.get("/K") if isinstance(elem, pikepdf.Dictionary) else elem
    if isinstance(k, int):
        return int(k)
    if isinstance(k, pikepdf.Array):
        for item in k:
            found = _first_mcid(item) if isinstance(item, pikepdf.Dictionary) else (
                int(item) if isinstance(item, int) else None
            )
            if found is not None:
                return found
        return None
    if isinstance(k, pikepdf.Dictionary):
        return _first_mcid(k)
    return None


def _all_mcids(elem) -> list[int]:
    """Recursively collect every MCID referenced anywhere under a struct
    element's /K, in document order, so multi-MCID elements (e.g. a
    /TextBox containing several /P children) get a bounding box spanning
    ALL of their content, not just the first child.
    """
    out: list[int] = []
    k = elem.get("/K") if isinstance(elem, pikepdf.Dictionary) else elem
    if isinstance(k, int):
        out.append(int(k))
    elif isinstance(k, pikepdf.Array):
        for item in k:
            if isinstance(item, pikepdf.Dictionary):
                out.extend(_all_mcids(item))
            elif isinstance(item, int):
                out.append(int(item))
    elif isinstance(k, pikepdf.Dictionary):
        out.extend(_all_mcids(k))
    return out


def _element_bbox(elem, mcid_bboxes: dict) -> list[float] | None:
    """Union bounding box (page space) of every MCID under this element."""
    box = None
    for mcid in _all_mcids(elem):
        b = mcid_bboxes.get(mcid)
        if b is None:
            continue
        if box is None:
            box = list(b)
        else:
            box[0] = min(box[0], b[0])
            box[1] = min(box[1], b[1])
            box[2] = max(box[2], b[2])
            box[3] = max(box[3], b[3])
    return box


def _find_reorder_target(st):
    """Find the flat array of children to reorder. Different export tools
    produce different top-level tree shapes:
      - This pipeline's own prior output / some tools: /Document > /Part > [children]
      - Canva exports: StructTreeRoot.K = [/Annot, /Slide, /Annot] at the
        ROOT, with the real content children living inside /Slide's own /K.
        A naive walk that only recognizes /Document would silently reorder
        the meaningless 3-item root array instead of /Slide's real children.
    General approach: find the struct element anywhere in the tree (searched
    breadth-first, up to 4 levels deep) that itself has the most
    MCID-resolvable /K children -- that is almost certainly the actual
    content container, regardless of its /S tag name.
    """

    def _resolvable_child_count(elem) -> int:
        k = elem.get("/K") if isinstance(elem, pikepdf.Dictionary) else None
        if not isinstance(k, pikepdf.Array):
            return 0
        count = 0
        for child in k:
            mcid = _first_mcid(child) if isinstance(child, pikepdf.Dictionary) else (
                int(child) if isinstance(child, int) else None
            )
            if mcid is not None:
                count += 1
        return count

    def _collect_candidates(elem, depth=0, max_depth=4):
        if depth > max_depth:
            return
        if isinstance(elem, pikepdf.Array):
            for item in elem:
                yield from _collect_candidates(item, depth, max_depth)
            return
        if not isinstance(elem, pikepdf.Dictionary):
            return
        yield (elem, _resolvable_child_count(elem))
        k = elem.get("/K")
        if isinstance(k, pikepdf.Array):
            for child in k:
                yield from _collect_candidates(child, depth + 1, max_depth)
        elif isinstance(k, pikepdf.Dictionary):
            yield from _collect_candidates(k, depth + 1, max_depth)

    candidates = list(_collect_candidates(st.K))
    target = None
    if candidates:
        target, best_count = max(candidates, key=lambda pair: pair[1])
        if best_count < 2:
            target = None
    if target is None:
        top_k = st.K
        doc_elem = top_k[0] if isinstance(top_k, pikepdf.Array) and len(top_k) == 1 else top_k
        if isinstance(doc_elem, pikepdf.Dictionary) and str(doc_elem.get("/S", "")) == "/Document":
            inner_k = doc_elem.get("/K")
            if (
                isinstance(inner_k, pikepdf.Array)
                and len(inner_k) >= 1
                and isinstance(inner_k[0], pikepdf.Dictionary)
                and str(inner_k[0].get("/S", "")) == "/Part"
            ):
                target = inner_k[0]
            else:
                target = doc_elem
        else:
            target = st
    return target


def _spatial_sort(children: list, boxes: list) -> list[int]:
    """Return a permutation of indices into `children` sorted into visual
    reading order: primarily top-to-bottom (by each box's top edge, i.e.
    largest y1 first since PDF y grows upward), but elements that clearly
    sit in the same horizontal "row" as an already-placed element (their
    vertical extents overlap by a meaningful fraction) are instead ordered
    left-to-right relative to each other within that row. This correctly
    handles both simple single-column flyers and multi-column layouts (e.g.
    three side-by-side hexagon icon+caption blocks).

    Elements with no resolvable box are appended at the end, in their
    original relative order.
    """
    indexed = [(i, boxes[i]) for i in range(len(children))]
    with_box = [(i, b) for i, b in indexed if b is not None]
    without_box = [i for i, b in indexed if b is None]

    # Sort primarily by top edge (descending y1 = higher on page first).
    with_box.sort(key=lambda pair: -pair[1][3])

    # Group into rows: walk in top-edge order, and start a new row whenever
    # the next box's vertical span doesn't meaningfully overlap the current
    # row's shared vertical band.
    rows: list[list[tuple[int, list[float]]]] = []
    for i, box in with_box:
        placed = False
        if rows:
            row = rows[-1]
            # Compute overlap between this box and the row's current
            # (intersected) vertical band.
            row_y0 = max(b[1] for _, b in row)
            row_y1 = min(b[3] for _, b in row)
            overlap = min(row_y1, box[3]) - max(row_y0, box[1])
            row_height = min(row_y1 - row_y0, box[3] - box[1]) if row_y1 > row_y0 else (box[3] - box[1])
            # Require the overlap to cover a meaningful fraction of the
            # smaller element's own height to count as "same row" -- avoids
            # merging a tall block with something that only barely grazes
            # its edge.
            this_height = box[3] - box[1]
            threshold = 0.35 * max(this_height, 1.0)
            if overlap >= threshold and overlap > 0:
                row.append((i, box))
                placed = True
        if not placed:
            rows.append([(i, box)])

    ordered: list[int] = []
    for row in rows:
        row.sort(key=lambda pair: pair[1][0])  # left-to-right by x0
        ordered.extend(i for i, _ in row)

    ordered.extend(without_box)
    return ordered


def fix_reading_order(input_path: str, output_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]

    if "/StructTreeRoot" not in pdf.Root:
        pdf.save(output_path)
        pdf.close()
        return {"reordered": False, "reason": "no_struct_tree"}

    st = pdf.Root.StructTreeRoot
    mcid_bboxes = _get_mcid_bboxes(pdf, page)
    target = _find_reorder_target(st)

    existing_k = target.get("/K")
    if not isinstance(existing_k, pikepdf.Array) or len(existing_k) < 2:
        pdf.save(output_path)
        pdf.close()
        return {"reordered": False, "reason": "no_reorderable_children"}

    children = list(existing_k)
    boxes = [_element_bbox(c, mcid_bboxes) if isinstance(c, pikepdf.Dictionary) else None for c in children]

    perm = _spatial_sort(children, boxes)
    reordered = [children[i] for i in perm]

    was_already_sorted = perm == list(range(len(children)))
    new_arr = pikepdf.Array(reordered)
    target.K = new_arr

    pdf.save(output_path)
    pdf.close()

    return {
        "reordered": not was_already_sorted,
        "children_count": len(children),
        "resolved_bbox_count": sum(1 for b in boxes if b is not None),
    }


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    result = fix_reading_order(input_path, output_path)
    print(json.dumps(result))
