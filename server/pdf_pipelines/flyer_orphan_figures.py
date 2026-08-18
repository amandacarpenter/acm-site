"""
Detect and fix "orphaned" figures: content streams that wrap an image or
drawing in `BDC /Figure <<>>` (or `BDC /Image <<>>`) with NO /MCID entry in
the properties dictionary.

This is a distinct, more serious defect than a /Figure struct element with
a missing/empty /Alt. An orphaned BDC has no /MCID at all, so it can never
be discovered by walking /StructTreeRoot (there is no struct element and
no ParentTree slot pointing at it) -- the content is 100% invisible to any
process that starts from the struct tree, including this pipeline's other
two passes. It's common output from design tools (Illustrator/InDesign/
Canva PDF export via certain "tagged PDF" settings) that mark a layer or
group as a Figure role without actually building the struct tree entry.

This module runs BEFORE the main extract/apply passes (which operate on
struct-tree Figures) and handles orphaned BDCs directly at the content
stream + XObject level, walking into nested Form XObjects (same traversal
approach as flyer_bbox_extract.py, since pikepdf.parse_content_stream does
not recurse into Form XObjects on its own).

Usage:
  Pass 1: python3 flyer_orphan_figures.py extract <input.pdf>
    -> JSON: {"page_text": ..., "orphans": [{"orphan_id": 0, "bbox": [...], "crop_b64": "..."}]}

  Pass 2 (caller does Claude Vision classification, same as main flow)

  Pass 3: python3 flyer_orphan_figures.py apply <input.pdf> <output.pdf> <decisions.json>
    decisions.json: [{"orphan_id": 0, "decorative": bool, "alt_text": ""}]
    - decorative: rewrite that BDC's tag name in place from /Figure (or
      /Image) to /Artifact. No struct tree changes needed.
    - meaningful: assign the next free MCID, rewrite the BDC's properties
      dict to include it, insert a new /Figure struct element (with /Alt)
      into /StructTreeRoot at the correct position, and extend the page's
      ParentTree array so the new MCID resolves back to the new element.
"""

import sys
import json
import base64
import pikepdf
import pymupdf as fitz

fitz.TOOLS.mupdf_display_errors(False)

IDENTITY = (1, 0, 0, 1, 0, 0)


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


def _has_mcid(props):
    return isinstance(props, pikepdf.Dictionary) and "/MCID" in props


def find_orphans(page, top_resources):
    """Walk the page + nested Form XObjects. Returns a list of dicts:
    {orphan_id, path (list of xobject names from page down), instr_index,
     tag, bbox_user_space} -- one per BDC /Figure or /Image with no MCID
     that contains at least one Do (image) call inside it."""
    orphans = []
    counter = [0]

    def walk(content_obj, resources, ctm, path, depth):
        if depth > 12:
            return
        try:
            instructions = pikepdf.parse_content_stream(content_obj)
        except Exception:
            return

        gs_stack = []
        cur_ctm = ctm
        # Track open orphan BDC blocks as a stack of dicts with running bbox
        orphan_stack = []

        def expand_active(x, y):
            for o in orphan_stack:
                if o is None:
                    continue
                if o["bbox"] is None:
                    o["bbox"] = [x, y, x, y]
                else:
                    b = o["bbox"]
                    if x < b[0]:
                        b[0] = x
                    if y < b[1]:
                        b[1] = y
                    if x > b[2]:
                        b[2] = x
                    if y > b[3]:
                        b[3] = y

        for i, instr in enumerate(instructions):
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
            elif op == "BDC":
                tag = str(ops[0]) if ops else ""
                props = ops[1] if len(ops) > 1 else None
                if tag in ("/Figure", "/Image") and not _has_mcid(props):
                    oid = counter[0]
                    counter[0] += 1
                    orphan_stack.append({
                        "orphan_id": oid,
                        "tag": tag,
                        "path": list(path),
                        "instr_index": i,
                        "bbox": None,
                        "has_image": False,
                    })
                else:
                    orphan_stack.append(None)  # placeholder to keep EMC balance simple
            elif op == "BMC":
                orphan_stack.append(None)
            elif op == "EMC":
                if orphan_stack:
                    finished = orphan_stack.pop()
                    if finished is not None and finished["bbox"] is not None and finished["has_image"]:
                        orphans.append(finished)
            elif op == "Do":
                name = str(ops[0]) if ops else None
                for corner in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                    px, py = apply_mat(cur_ctm, *corner)
                    expand_active(px, py)
                if orphan_stack and orphan_stack[-1] is not None:
                    orphan_stack[-1]["has_image"] = True
                if name and resources is not None and "/XObject" in resources and name in resources.XObject:
                    xobj = resources.XObject[name]
                    subtype = str(xobj.get("/Subtype", ""))
                    if subtype == "/Form":
                        form_matrix = IDENTITY
                        if "/Matrix" in xobj:
                            m = [float(v) for v in xobj.Matrix]
                            if len(m) == 6:
                                form_matrix = tuple(m)
                        nested_ctm = mat_mul(form_matrix, cur_ctm)
                        nested_resources = xobj.get("/Resources", resources)
                        walk(xobj, nested_resources, nested_ctm, path + [name], depth + 1)
            elif op in ("re", "m", "l"):
                vals = [float(v) for v in ops]
                if op == "re":
                    x, y, w, h = vals
                    for corner in [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]:
                        px, py = apply_mat(cur_ctm, *corner)
                        expand_active(px, py)
                else:
                    x, y = vals[0], vals[1]
                    px, py = apply_mat(cur_ctm, x, y)
                    expand_active(px, py)

        # Any orphan BDCs left unclosed at end of stream (malformed content,
        # shouldn't normally happen) are dropped rather than guessed at.

    walk(page, top_resources, IDENTITY, [], 0)
    return orphans


def extract(input_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]
    orphans = find_orphans(page, page.get("/Resources"))
    pdf.close()

    doc = fitz.open(input_path)
    fpage = doc[page_index]
    page_h = fpage.rect.height
    page_text = fpage.get_text()

    out = []
    for o in orphans:
        x0, y0, x1, y1 = o["bbox"]
        # Clamp + pad, same convention as flyer_extract_figures.py
        is_full_bleed = (x1 - x0) >= (fpage.rect.width * 0.9) and (y1 - y0) >= (fpage.rect.height * 0.9)
        pad = 8
        rect = fitz.Rect(x0 - pad, page_h - y1 - pad, x1 + pad, page_h - y0 + pad)
        rect = rect & fpage.rect
        dpi = 120 if is_full_bleed else 200
        pix = fpage.get_pixmap(clip=rect, dpi=dpi)
        crop_b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
        out.append({
            "orphan_id": o["orphan_id"],
            "bbox": [x0, y0, x1, y1],
            "crop_b64": crop_b64,
            "is_full_bleed": is_full_bleed,
        })

    doc.close()
    return {"page_text": page_text, "orphans": out}


def _rewrite_bdc_tag(instructions, instr_index, new_tag: str, new_props=None):
    old = instructions[instr_index]
    new_ops = [pikepdf.Name(new_tag)]
    if new_props is not None:
        new_ops.append(new_props)
    elif len(old.operands) > 1:
        new_ops.append(old.operands[1])
    else:
        new_ops.append(pikepdf.Dictionary({}))
    instructions[instr_index] = pikepdf.ContentStreamInstruction(new_ops, pikepdf.Operator("BDC"))


def _find_stream_for_path(page, path):
    """path is [] for the page's own content, or a list of XObject names
    to descend through nested Form XObjects."""
    if not path:
        return page, page.get("/Resources")
    resources = page.get("/Resources")
    obj = page
    for name in path:
        obj = resources.XObject[name]
        resources = obj.get("/Resources", resources)
    return obj, resources


def apply_orphans(input_path: str, output_path: str, decisions: list, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]

    orphans = find_orphans(page, page.get("/Resources"))
    orphans_by_id = {o["orphan_id"]: o for o in orphans}
    decisions_by_id = {d["orphan_id"]: d for d in decisions}

    # Group orphans by which content stream (page or which nested Form
    # XObject) they live in, so we only reparse/rewrite each stream once.
    by_path_key = {}
    for oid, o in orphans_by_id.items():
        key = tuple(o["path"])
        by_path_key.setdefault(key, []).append(o)

    meaningful_added = 0
    decorative_converted = 0
    new_struct_elements = []  # (mcid, alt_text) to insert, in orphan_id order

    for path_key, group in by_path_key.items():
        stream_obj, _resources = _find_stream_for_path(page, list(path_key))
        instructions = pikepdf.parse_content_stream(stream_obj)

        # Determine next free MCID once (page-global, from ParentTree Nums length)
        for o in sorted(group, key=lambda x: x["instr_index"]):
            decision = decisions_by_id.get(o["orphan_id"])
            if decision is None:
                continue  # no decision -- leave content stream untouched (fail closed, not silently broken)
            if decision.get("decorative"):
                _rewrite_bdc_tag(instructions, o["instr_index"], "/Artifact", pikepdf.Dictionary({}))
                decorative_converted += 1
            else:
                alt_text = str(decision.get("alt_text") or "").strip() or "Image"
                mcid = _next_mcid(pdf, page_index)
                props = pikepdf.Dictionary({"/MCID": mcid})
                _rewrite_bdc_tag(instructions, o["instr_index"], "/Figure", props)
                new_struct_elements.append((mcid, alt_text))
                meaningful_added += 1

        new_stream = pikepdf.unparse_content_stream(instructions)
        if not path_key:
            # Page-level content: page.Contents may be a single stream or
            # an array of streams that parse_content_stream concatenated
            # transparently. Replace it wholesale with one fresh stream,
            # same approach flyer_apply_tags.py uses for page-level edits.
            page.Contents = pdf.make_stream(new_stream)
        else:
            # Form XObject: the object itself is the stream.
            stream_obj.write(new_stream)

    if new_struct_elements:
        _register_new_figures(pdf, page, new_struct_elements)

    pdf.save(output_path)
    pdf.close()

    return {
        "orphans_found": len(orphans),
        "meaningful_added": meaningful_added,
        "decorative_converted": decorative_converted,
    }


_mcid_counter_cache = {}


def _next_mcid(pdf, page_index):
    """Returns a fresh MCID not already used on this page, incrementing a
    per-run cache so multiple orphans on the same page get distinct ids."""
    key = id(pdf)
    if key not in _mcid_counter_cache:
        st = pdf.Root.StructTreeRoot
        pt = st.get("/ParentTree")
        max_seen = -1
        if pt is not None:
            nums = pt.get("/Nums")
            if nums is not None:
                for i in range(0, len(nums), 2):
                    idx = int(nums[i])
                    arr = nums[i + 1]
                    if isinstance(arr, pikepdf.Array):
                        max_seen = max(max_seen, idx + len(arr) - 1)
        _mcid_counter_cache[key] = max_seen + 1
    mcid = _mcid_counter_cache[key]
    _mcid_counter_cache[key] += 1
    return mcid


def _register_new_figures(pdf, page, new_struct_elements):
    """Append new /Figure struct elements as direct children of the
    top-level /Document (or /Part) node, and extend the page's ParentTree
    Nums array so each new MCID resolves back to its element.

    NOTE: appending here is deliberately temporary/order-agnostic. Struct
    tree /K order DOES determine reading order for every element type,
    including figures -- it drives both screen-reader traversal and
    click-drag text-highlight order in viewers like Acrobat/Preview. This
    function only needs to get new figures into the tree at all; the
    flyer pipeline always runs flyer_reading_order.py as its final step
    (after this and after flyer_apply_tags.py), which re-sorts the full
    struct tree -- including these newly appended figures -- to match the
    true content-stream drawing order. Do not treat this function's
    append-at-end placement as the final position."""
    st = pdf.Root.StructTreeRoot

    # Find (or create) the array we should append new top-level kids into.
    # Prefer the existing /Part child of /Document if present (matches this
    # pipeline's existing tree shape), else fall back to /Document's own /K.
    top_k = st.K
    if isinstance(top_k, pikepdf.Array):
        doc_elem = top_k[0] if len(top_k) == 1 else None
    else:
        doc_elem = top_k

    append_target = None
    if isinstance(doc_elem, pikepdf.Dictionary) and str(doc_elem.get("/S", "")) == "/Document":
        inner_k = doc_elem.get("/K")
        if isinstance(inner_k, pikepdf.Array) and len(inner_k) >= 1 and isinstance(inner_k[0], pikepdf.Dictionary) and str(inner_k[0].get("/S", "")) == "/Part":
            append_target = inner_k[0]
        else:
            append_target = doc_elem

    if append_target is None:
        # Fall back: append directly under StructTreeRoot's own /K array.
        append_target = st

    parent_ref = pdf.make_indirect(append_target) if not isinstance(append_target, pikepdf.Object) or append_target.objgen == (0, 0) else append_target

    new_elem_refs = []
    for mcid, alt_text in sorted(new_struct_elements, key=lambda t: t[0]):
        elem = pikepdf.Dictionary({
            "/Type": pikepdf.Name("/StructElem"),
            "/S": pikepdf.Name("/Figure"),
            "/P": append_target,
            "/Pg": page.obj,
            "/K": mcid,
            "/Alt": alt_text,
        })
        elem_indirect = pdf.make_indirect(elem)
        new_elem_refs.append((mcid, elem_indirect))

    existing_k = append_target.get("/K")
    if existing_k is None:
        existing_arr = pikepdf.Array([])
    elif isinstance(existing_k, pikepdf.Array):
        existing_arr = existing_k
    else:
        existing_arr = pikepdf.Array([existing_k])
    for _mcid, ref in new_elem_refs:
        existing_arr.append(ref)
    append_target.K = existing_arr

    # Extend ParentTree /Nums entry for this page with the new MCID -> element
    # mappings. Nums is [pageStructParentsKey0, arrayForThatKey, key1, array1, ...].
    pt = st.get("/ParentTree")
    if pt is None:
        pt = pikepdf.Dictionary({"/Nums": pikepdf.Array([])})
        st.ParentTree = pt
    nums = pt.get("/Nums")
    if nums is None:
        nums = pikepdf.Array([])
        pt.Nums = nums

    struct_parents_key = int(page.get("/StructParents", 0))
    target_index = None
    for i in range(0, len(nums), 2):
        if int(nums[i]) == struct_parents_key:
            target_index = i
            break

    if target_index is None:
        # No existing entry for this page's StructParents key -- create one.
        arr = pikepdf.Array([])
        nums.append(struct_parents_key)
        nums.append(arr)
        target_arr = arr
    else:
        target_arr = nums[target_index + 1]

    for mcid, ref in new_elem_refs:
        while len(target_arr) <= mcid:
            target_arr.append(None)
        target_arr[mcid] = ref

    # Update /Limits to cover the widened range, if present.
    if "/Limits" in pt:
        lims = pt.Limits
        lo = min(int(lims[0]), struct_parents_key)
        hi = max(int(lims[1]), struct_parents_key)
        pt.Limits = pikepdf.Array([lo, hi])


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "extract":
        input_path = sys.argv[2]
        print(json.dumps(extract(input_path)))
    elif mode == "apply":
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        decisions_path = sys.argv[4]
        with open(decisions_path) as f:
            decisions = json.load(f)
        result = apply_orphans(input_path, output_path, decisions)
        print(json.dumps(result))
    else:
        print("Usage: flyer_orphan_figures.py [extract <in.pdf> | apply <in.pdf> <out.pdf> <decisions.json>]", file=sys.stderr)
        sys.exit(1)
