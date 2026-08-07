"""
flyer_reading_order.py

Fixes a real, distinct defect found in Canva/Illustrator/InDesign PDF exports:
the /StructTreeRoot's flat list of child struct elements (/Figure, /P, etc.)
is not necessarily in the same order as the elements actually appear in the
page's content stream. MCIDs are assigned correctly and each element's own
tagging (/Alt text, decorative-vs-meaningful) can be entirely correct, but a
screen reader -- and critically, click-and-drag text *selection*/highlighting
in Acrobat, Preview, and browsers -- both walk the struct tree's /K array in
document order to determine reading order, not the content stream. If the
struct tree's array is out of order, text highlighting visibly "jumps around"
even though every individual tag is fine.

This is a real defect confirmed present in the *original*, unmodified Canva
export (not introduced by any part of this pipeline): the reported flyer's
original struct tree lists MCIDs in the order
    [3, 4, 5, 10, 11, 12, 8, 9, 6, 7, 13, 0, 1, 2]
while the actual visual/content-stream order is the clean, correct
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
Canva assigns MCIDs in the order layers were created in the design tool, not
their final on-canvas position, and never reorders the struct tree to match.

This module runs as the FINAL step of the flyer pipeline (after both
flyer_orphan_figures.py apply and flyer_apply_tags.py apply_tags have run),
since it needs to see the complete, final set of MCIDs including any newly
added by the orphan-figure pass. It:

1. Walks the page's content stream (recursing into nested Form XObjects,
   exactly like flyer_apply_tags.py) to determine the true drawing-order
   sequence of every MCID that appears.
2. Walks the struct tree to find the flat array of top-level children (the
   /Part or /Document node's /K array) and re-sorts that array in place to
   match the content-stream order, using each element's own MCID (or, for
   elements with a /K array of multiple MCIDs, the first MCID encountered)
   as the sort key. Elements with no resolvable MCID (e.g. malformed/legacy
   entries) are kept in their original relative order and placed at the end,
   never dropped.

This is a pure struct-tree reorder -- no MCIDs, /Alt text, or page content
are changed, and the visual page render is unaffected.
"""

import sys
import json
import pikepdf


def _get_content_stream_order(pdf: pikepdf.Pdf, page) -> dict:
    """Returns {mcid: sequence_number} reflecting true drawing order, by
    walking the page's content stream and recursing into nested Form
    XObjects. Sequence numbers are assigned per marked-content span in the
    order its OPENING BDC is encountered (not when it closes), which is what
    actually determines reading order for spans that just wrap a single
    Do/Tj -- using the open event avoids nested-frame ordering ambiguity.
    """
    order: dict[int, int] = {}
    counter = [0]

    def walk(content_obj, resources):
        try:
            instrs = pikepdf.parse_content_stream(content_obj)
        except Exception:
            return
        mc_stack = []
        for instr in instrs:
            op = str(instr.operator)
            counter[0] += 1
            if op == "BDC":
                tag = str(instr.operands[0]) if instr.operands else None
                props = instr.operands[1] if len(instr.operands) > 1 else None
                mcid = None
                if isinstance(props, pikepdf.Dictionary) and "/MCID" in props:
                    try:
                        mcid = int(props["/MCID"])
                    except Exception:
                        mcid = None
                mc_stack.append({"mcid": mcid, "seq": counter[0]})
                if mcid is not None and mcid not in order:
                    order[mcid] = counter[0]
            elif op == "BMC":
                mc_stack.append({"mcid": None, "seq": counter[0]})
            elif op == "EMC":
                if mc_stack:
                    mc_stack.pop()
            elif op == "Do":
                name = str(instr.operands[0]) if instr.operands else None
                xobj = None
                if name and resources and "/XObject" in resources:
                    xobj = resources.XObject.get(name)
                if xobj is not None and xobj.get("/Subtype") == pikepdf.Name("/Form"):
                    sub_res = xobj.get("/Resources", resources)
                    walk(xobj, sub_res)

    walk(page, page.Resources)
    return order


def _first_mcid(elem) -> int | None:
    """Recursively find the first MCID referenced anywhere under a struct
    element's /K, in document order (depth-first), for use as its sort key.
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


def fix_reading_order(input_path: str, output_path: str, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    page = pdf.pages[page_index]

    if "/StructTreeRoot" not in pdf.Root:
        pdf.save(output_path)
        pdf.close()
        return {"reordered": False, "reason": "no_struct_tree"}

    st = pdf.Root.StructTreeRoot
    mcid_order = _get_content_stream_order(pdf, page)

    # Find the flat array of children to reorder. Different export tools
    # produce different top-level tree shapes:
    #   - This pipeline's own output / some tools: /Document > /Part > [children]
    #   - Canva exports: StructTreeRoot.K = [/Annot, /Slide, /Annot] at the
    #     ROOT, with the real content children living inside /Slide's own /K.
    #     A naive walk that only recognizes /Document would silently reorder
    #     the meaningless 3-item root array instead of /Slide's real children,
    #     making the whole reading-order fix a no-op for every Canva flyer.
    # General approach: find the single struct element in the tree (searched
    # breadth-first from StructTreeRoot.K) that itself has the largest /K
    # array of MCID-resolvable children -- that is almost certainly the
    # actual content container, regardless of its /S tag name.
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
        """Yield every struct element dict reachable within max_depth, along
        with how many of its own /K children resolve to an MCID."""
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
        # Fall back to the previous, narrower /Document > /Part convention,
        # then StructTreeRoot itself, to preserve prior behavior when no
        # richer container is found.
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

    existing_k = target.get("/K")
    if not isinstance(existing_k, pikepdf.Array) or len(existing_k) < 2:
        # Nothing meaningful to reorder (0 or 1 children).
        pdf.save(output_path)
        pdf.close()
        return {"reordered": False, "reason": "no_reorderable_children"}

    children = list(existing_k)
    before_order = [
        _first_mcid(c) if isinstance(c, pikepdf.Dictionary) else (int(c) if isinstance(c, int) else None)
        for c in children
    ]

    def sort_key(pair):
        idx, child = pair
        mcid = before_order[idx]
        if mcid is not None and mcid in mcid_order:
            return (0, mcid_order[mcid])
        # Unresolvable elements keep their original relative order, placed
        # after every resolvable one rather than dropped or reshuffled.
        return (1, idx)

    reordered_pairs = sorted(enumerate(children), key=sort_key)
    reordered = [child for _, child in reordered_pairs]

    was_already_sorted = reordered == children
    new_arr = pikepdf.Array(reordered)
    target.K = new_arr

    pdf.save(output_path)
    pdf.close()

    return {
        "reordered": not was_already_sorted,
        "children_count": len(children),
        "resolved_mcid_count": sum(1 for m in before_order if m is not None and m in mcid_order),
    }


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    result = fix_reading_order(input_path, output_path)
    print(json.dumps(result))
