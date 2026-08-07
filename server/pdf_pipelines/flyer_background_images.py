"""
Detect large/full-bleed raster images that the SOURCE PDF already wraps in
`BDC /Artifact <</Type /Background>>` (or any /Artifact with no /Figure
ancestor). Design tools (Canva, PowerPoint export, etc.) routinely mark a
big photo as a "background" layer purely based on its z-order/placement,
NOT based on whether it's actually decorative. A large, specific, editorial
photo (e.g. a hero photo of a garden club activity) can carry real
information a screen-reader user would otherwise miss -- being marked
/Artifact by the authoring tool doesn't make that true.

This pass finds these already-tagged-decorative candidates that are big
enough to plausibly be real content (>= 40% of page area) and sends them
back through the same vision classification step as ordinary orphan
figures, so a human-quality judgment call is made instead of blindly
trusting the source file's own artifact/background designation.

Distinct from flyer_orphan_figures.py, which finds BDC /Figure or /Image
blocks with NO /MCID -- those have not been tagged with any role yet. Here
the source file HAS already made a decorative decision; we're offering a
second opinion, not filling in a missing one.

Usage:
  Pass 1: python3 flyer_background_images.py extract <input.pdf>
    -> JSON: {"page_text": ..., "candidates": [{"cand_id": 0, "bbox": [...], "crop_b64": "...", "is_full_bleed": true}]}

  Pass 2 (caller does Claude Vision classification, same shape as orphans)

  Pass 3: python3 flyer_background_images.py apply <input.pdf> <output.pdf> <decisions.json>
    decisions.json: [{"cand_id": 0, "decorative": bool, "alt_text": ""}]
    - decorative: leave the BDC tag as /Artifact, no changes.
    - meaningful: rewrite the BDC tag from /Artifact to /Figure, assign a
      free MCID, insert a new /Figure struct element (with /Alt) into
      /StructTreeRoot, and extend the page's ParentTree array.
"""

import sys
import json
import base64
import pikepdf
import fitz

fitz.TOOLS.mupdf_display_errors(False)

IDENTITY = (1, 0, 0, 1, 0, 0)
MIN_AREA_FRACTION = 0.40  # candidate must cover at least this fraction of page area


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


def find_background_candidates(page, top_resources, page_area):
    """Walk page + nested Form XObjects. Returns list of dicts:
    {cand_id, path, instr_index, bbox_user_space} -- one per BDC /Artifact
    block (with no /Figure ancestor already) that directly wraps a Do call
    on an Image XObject covering >= MIN_AREA_FRACTION of the page."""
    candidates = []
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
        artifact_stack = []  # stack of dicts or None (non-artifact BDC/BMC)
        q_index_stack = []  # parallel stack of instruction indices for each "q"

        def expand_active(x, y):
            for a in artifact_stack:
                if a is None:
                    continue
                if a["bbox"] is None:
                    a["bbox"] = [x, y, x, y]
                else:
                    b = a["bbox"]
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
                q_index_stack.append(i)
            elif op == "Q":
                if gs_stack:
                    cur_ctm = gs_stack.pop()
                if q_index_stack:
                    popped_q_index = q_index_stack.pop()
                    for frame in reversed(artifact_stack):
                        if frame is not None and frame["do_q_start"] == popped_q_index and frame["do_q_end"] is None:
                            frame["do_q_end"] = i
                            break
            elif op == "cm":
                vals = [float(v) for v in ops]
                cur_ctm = mat_mul(tuple(vals), cur_ctm)
            elif op == "BDC":
                tag = str(ops[0]) if ops else ""
                if tag == "/Artifact":
                    cid = counter[0]
                    counter[0] += 1
                    artifact_stack.append({
                        "cand_id": cid,
                        "path": list(path),
                        "instr_index": i,
                        "bbox": None,
                        "image_bbox": None,
                        "has_image": False,
                        "has_nested_artifact_image": False,
                        "do_instr_index": None,
                        "do_q_start": None,
                        "do_q_end": None,
                    })
                else:
                    artifact_stack.append(None)
            elif op == "BMC":
                artifact_stack.append(None)
            elif op == "EMC":
                if artifact_stack:
                    finished = artifact_stack.pop()
                    if finished is not None and finished["bbox"] is not None and finished["has_image"]:
                        x0, y0, x1, y1 = finished["bbox"]
                        area = max(0, x1 - x0) * max(0, y1 - y0)
                        if page_area > 0 and (area / page_area) >= MIN_AREA_FRACTION:
                            candidates.append(finished)
            elif op == "Do":
                name = str(ops[0]) if ops else None
                for corner in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                    px, py = apply_mat(cur_ctm, *corner)
                    expand_active(px, py)
                if name and resources is not None and "/XObject" in resources and name in resources.XObject:
                    xobj = resources.XObject[name]
                    subtype = str(xobj.get("/Subtype", ""))
                    if subtype == "/Image":
                        # Mark the nearest enclosing Artifact frame, even if
                        # intervening BDC/BMC frames (e.g. /OC optional-content
                        # groups) sit directly on top of it in the stack.
                        # Track the image's own unit-square draw extent
                        # separately from the frame's full bbox (which may
                        # also include decorative vector shapes) so the
                        # vision crop can focus tightly on the photo itself.
                        img_corners = [apply_mat(cur_ctm, *c) for c in [(0, 0), (1, 0), (0, 1), (1, 1)]]
                        ixs = [p[0] for p in img_corners]
                        iys = [p[1] for p in img_corners]
                        img_bbox = [min(ixs), min(iys), max(ixs), max(iys)]
                        for frame in reversed(artifact_stack):
                            if frame is not None:
                                frame["has_image"] = True
                                if frame["image_bbox"] is None:
                                    frame["image_bbox"] = img_bbox
                                else:
                                    b = frame["image_bbox"]
                                    b[0] = min(b[0], img_bbox[0])
                                    b[1] = min(b[1], img_bbox[1])
                                    b[2] = max(b[2], img_bbox[2])
                                    b[3] = max(b[3], img_bbox[3])
                                # Record the tightest q..Q pair (if any) that
                                # directly wraps this Do call, and this Do's own
                                # instruction index, so a promotion to /Figure can
                                # later be scoped to ONLY this image draw instead
                                # of the whole (possibly much larger) artifact
                                # frame, which may also contain unrelated
                                # decorative vector shapes drawn before/after it.
                                if frame["do_instr_index"] is None:
                                    frame["do_instr_index"] = i
                                    if q_index_stack:
                                        frame["do_q_start"] = q_index_stack[-1]
                                break
                    elif subtype == "/Form":
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

    walk(page, top_resources, IDENTITY, [], 0)
    return candidates


def extract(input_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]
    mb = page.get("/MediaBox", pdf.pages[page_index].get("/MediaBox"))
    page_w = float(mb[2]) - float(mb[0])
    page_h = float(mb[3]) - float(mb[1])
    page_area = page_w * page_h
    candidates = find_background_candidates(page, page.get("/Resources"), page_area)
    pdf.close()

    doc = fitz.open(input_path)
    fpage = doc[page_index]
    fpage_h = fpage.rect.height
    page_text = fpage.get_text()

    out = []
    for c in candidates:
        # Prefer the tight image-only extent for the crop; fall back to
        # the full Artifact frame bbox if no image extent was tracked.
        crop_box = c.get("image_bbox") or c["bbox"]
        x0, y0, x1, y1 = c["bbox"]
        cx0, cy0, cx1, cy1 = crop_box
        is_full_bleed = (x1 - x0) >= (fpage.rect.width * 0.9) and (y1 - y0) >= (fpage.rect.height * 0.9)
        pad = 8
        rect = fitz.Rect(cx0 - pad, fpage_h - cy1 - pad, cx1 + pad, fpage_h - cy0 + pad)
        rect = rect & fpage.rect
        dpi = 120 if is_full_bleed else 150
        pix = fpage.get_pixmap(clip=rect, dpi=dpi)
        crop_b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
        out.append({
            "cand_id": c["cand_id"],
            "bbox": [x0, y0, x1, y1],
            "crop_b64": crop_b64,
            "is_full_bleed": is_full_bleed,
        })

    doc.close()
    return {"page_text": page_text, "candidates": out}


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
    if not path:
        return page, page.get("/Resources")
    resources = page.get("/Resources")
    xobj = None
    for name in path:
        xobj = resources.XObject[name]
        resources = xobj.get("/Resources", resources)
    return xobj, resources


def _next_free_mcid(pdf):
    max_mcid = -1

    def walk(elem):
        nonlocal max_mcid
        if isinstance(elem, pikepdf.Array):
            for x in elem:
                walk(x)
            return
        if isinstance(elem, int):
            if elem > max_mcid:
                max_mcid = elem
            return
        if isinstance(elem, pikepdf.Dictionary):
            k = elem.get("/K")
            if k is not None:
                walk(k)

    st = pdf.Root.get("/StructTreeRoot")
    if st is not None:
        walk(st.get("/K"))
    return max_mcid + 1


def _extend_parent_tree(pdf, page, mcid, struct_elem_ref):
    st = pdf.Root.StructTreeRoot
    parent_tree = st.get("/ParentTree")
    if parent_tree is None:
        return
    nums = parent_tree.get("/Nums")
    if nums is None:
        return
    entries = list(nums)
    pairs = []
    i = 0
    while i < len(entries):
        pairs.append((int(entries[i]), entries[i + 1]))
        i += 2
    pairs.append((mcid, struct_elem_ref))
    pairs.sort(key=lambda p: p[0])
    new_nums = []
    for k, v in pairs:
        new_nums.append(k)
        new_nums.append(v)
    parent_tree.Nums = pikepdf.Array(new_nums)

    struct_parents = page.get("/StructParents")
    if struct_parents is None:
        pass  # page-level StructParents indexing is a separate mechanism; not needed for MCID-based ParentTree lookups


def apply_decisions(input_path: str, output_path: str, decisions: list, page_index: int = 0):
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]
    page_area_w = float(page.MediaBox[2]) - float(page.MediaBox[0])
    page_area_h = float(page.MediaBox[3]) - float(page.MediaBox[1])
    page_area = page_area_w * page_area_h

    candidates = find_background_candidates(page, page.get("/Resources"), page_area)
    by_id = {c["cand_id"]: c for c in candidates}

    decisions_by_id = {d["cand_id"]: d for d in decisions}

    # Group edits by which stream (page or nested Form XObject) they touch.
    edits_by_path = {}
    for cand_id, cand in by_id.items():
        decision = decisions_by_id.get(cand_id)
        if decision is None or decision.get("decorative", True):
            continue  # leave as /Artifact, no change
        path_key = tuple(cand["path"])
        edits_by_path.setdefault(path_key, []).append((cand["instr_index"], decision, cand))

    converted = 0
    kept_decorative = sum(1 for d in decisions_by_id.values() if d.get("decorative", True))

    st = pdf.Root.get("/StructTreeRoot")
    # Find the top-level /Slide (or first Dictionary child) to append new Figures into,
    # matching the convention used by flyer_orphan_figures.py.
    top_container = None
    if st is not None:
        k = st.get("/K")
        if isinstance(k, pikepdf.Array):
            for item in k:
                if isinstance(item, pikepdf.Dictionary) and str(item.get("/S", "")) != "/Annot":
                    top_container = item
                    break
        elif isinstance(k, pikepdf.Dictionary):
            top_container = k

    for path_key, edits in edits_by_path.items():
        stream_obj, resources = _find_stream_for_path(page, list(path_key))
        instructions = pikepdf.parse_content_stream(stream_obj)

        for instr_index, decision, cand in sorted(edits, key=lambda e: -e[0]):
            mcid = _next_free_mcid(pdf)

            # Scope the new /Figure tag to ONLY the image's own Do call (plus its
            # tightest enclosing q..Q pair, if any), not the whole original
            # /Artifact frame. Source PDFs (e.g. Canva exports) often bundle a
            # background photo together with unrelated decorative vector shapes
            # (logo glyphs, color-block fills) inside one BDC /Artifact ... EMC
            # frame. Promoting the frame's own BDC/EMC in place would tag ALL of
            # that combined content as one giant /Figure, which is structurally
            # wrong (the vector shapes are not part of the photo) and can also
            # make the tag's effective bounding region so large/oddly-shaped
            # that tools like Acrobat's Reading Order panel fail to render a
            # clean marker for it.
            do_index = cand.get("do_instr_index")
            q_start = cand.get("do_q_start")
            q_end = cand.get("do_q_end")

            if do_index is None:
                # Fallback: no Do call was tracked (shouldn't happen since only
                # has_image frames become candidates) -- promote the whole frame
                # as before rather than risk a broken split.
                _rewrite_bdc_tag(instructions, instr_index, "/Figure", new_props=pikepdf.Dictionary({"/MCID": mcid}))
            else:
                open_idx = q_start if q_start is not None else do_index
                close_idx = q_end if q_end is not None else do_index
                bdc_instr = pikepdf.ContentStreamInstruction(
                    [pikepdf.Name("/Figure"), pikepdf.Dictionary({"/MCID": mcid})],
                    pikepdf.Operator("BDC"),
                )
                emc_instr = pikepdf.ContentStreamInstruction([], pikepdf.Operator("EMC"))
                # Insert EMC first (higher index) so the earlier BDC insertion
                # doesn't shift close_idx out from under us.
                instructions.insert(close_idx + 1, emc_instr)
                instructions.insert(open_idx, bdc_instr)

            alt_text = decision.get("alt_text") or ""
            new_elem = pdf.make_indirect(pikepdf.Dictionary({
                "/Type": pikepdf.Name("/StructElem"),
                "/S": pikepdf.Name("/Figure"),
                "/P": top_container if top_container is not None else st,
                "/Pg": page.obj,
                "/K": mcid,
                "/Alt": alt_text,
            }))
            if top_container is not None:
                k = top_container.get("/K")
                if k is None:
                    top_container.K = pikepdf.Array([new_elem])
                elif isinstance(k, pikepdf.Array):
                    k.append(new_elem)
                else:
                    top_container.K = pikepdf.Array([k, new_elem])
            _extend_parent_tree(pdf, page, mcid, new_elem)
            converted += 1

        new_stream_bytes = pikepdf.unparse_content_stream(instructions)
        if path_key == ():
            page.Contents = pdf.make_stream(new_stream_bytes)
        else:
            xobj = stream_obj
            xobj.write(new_stream_bytes)

    pdf.save(output_path)
    pdf.close()
    return {"converted": converted, "kept_decorative": kept_decorative}


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "extract":
        result = extract(sys.argv[2])
        print(json.dumps(result))
    elif mode == "apply":
        input_path, output_path, decisions_path = sys.argv[2], sys.argv[3], sys.argv[4]
        with open(decisions_path) as f:
            decisions = json.load(f)
        result = apply_decisions(input_path, output_path, decisions)
        print(json.dumps(result))
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)
