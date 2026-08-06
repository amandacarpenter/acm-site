"""
Pass 2 of the flyer tagging pipeline: given the input PDF and a JSON list of
per-figure classification decisions (from Claude Vision), apply the actual
PDF edits:

  - decorative figures: rewrite BDC /Figure <</MCID n>> -> BDC /Artifact <<>>
    in the content stream (pixels untouched), remove the struct element from
    the tree, null its ParentTree slot.
  - meaningful figures: keep the struct element, set /Alt to the AI-written
    description.

Also ensures /MarkInfo /Marked and /Lang are set on the document root.

Usage:
  python3 flyer_apply_tags.py <input.pdf> <output.pdf> <decisions.json>

decisions.json format:
  [{"mcid": 26, "decorative": true, "alt_text": ""}, ...]
"""

import sys
import json
import pikepdf


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


def strip_figure_tags_from_content_stream(pdf: pikepdf.Pdf, page, mcids_to_artifact: set) -> None:
    instructions = pikepdf.parse_content_stream(page)
    new_instructions = []

    for instr in instructions:
        operator = str(instr.operator)
        if operator == "BDC":
            ops = instr.operands
            tag_name = str(ops[0]) if ops else ""
            props = ops[1] if len(ops) > 1 else None
            mcid = None
            if isinstance(props, pikepdf.Dictionary) and "/MCID" in props:
                mcid = int(props["/MCID"])
            if tag_name == "/Figure" and mcid is not None and mcid in mcids_to_artifact:
                new_instructions.append(
                    pikepdf.ContentStreamInstruction(
                        [pikepdf.Name("/Artifact"), pikepdf.Dictionary({})],
                        pikepdf.Operator("BDC"),
                    )
                )
                continue
        new_instructions.append(instr)

    new_stream = pikepdf.unparse_content_stream(new_instructions)
    page.Contents = pdf.make_stream(new_stream)


def remove_struct_elements(pdf: pikepdf.Pdf, objgens_to_remove: set) -> None:
    def filter_kids(kids):
        if isinstance(kids, pikepdf.Array):
            survivors = []
            for k in kids:
                if isinstance(k, pikepdf.Dictionary):
                    if k.objgen in objgens_to_remove:
                        continue
                    if "/K" in k:
                        k.K = filter_kids(k.K)
                        sub = k.get("/K")
                        is_empty = (isinstance(sub, pikepdf.Array) and len(sub) == 0)
                        if str(k.get("/S", "")) == "/Group" and is_empty:
                            continue
                    survivors.append(k)
                else:
                    survivors.append(k)
            return pikepdf.Array(survivors)
        return kids

    st = pdf.Root.StructTreeRoot
    st.K = filter_kids(st.K)


def null_parent_tree_entries(pdf: pikepdf.Pdf, mcids: set) -> None:
    st = pdf.Root.StructTreeRoot
    pt = st.get("/ParentTree")
    if pt is None:
        return
    nums = pt.get("/Nums")
    if nums is None:
        return
    for i in range(0, len(nums), 2):
        arr = nums[i + 1]
        if isinstance(arr, pikepdf.Array):
            for mcid in mcids:
                if 0 <= mcid < len(arr):
                    arr[mcid] = None


def apply_tags(input_path: str, output_path: str, decisions: list, page_index: int = 0) -> dict:
    pdf = pikepdf.open(input_path)
    figure_mcids = collect_figure_mcids(pdf)

    decorative_mcids = set()
    decorative_objgens = set()
    meaningful_count = 0

    decisions_by_mcid = {d["mcid"]: d for d in decisions}

    for mcid, element in figure_mcids.items():
        decision = decisions_by_mcid.get(mcid)
        if decision is None:
            # No decision provided (e.g. vision call failed) -- fail safe by
            # keeping the figure as-is with whatever /Alt it already had,
            # rather than silently dropping potentially meaningful content.
            continue
        if decision.get("decorative"):
            decorative_mcids.add(mcid)
            decorative_objgens.add(element.objgen)
        else:
            alt_text = str(decision.get("alt_text") or "").strip()
            if alt_text:
                element.Alt = alt_text
            meaningful_count += 1

    page = pdf.pages[page_index]
    strip_figure_tags_from_content_stream(pdf, page, decorative_mcids)
    remove_struct_elements(pdf, decorative_objgens)
    null_parent_tree_entries(pdf, decorative_mcids)

    root = pdf.Root
    if "/MarkInfo" not in root:
        root.MarkInfo = pikepdf.Dictionary({"/Marked": True})
    else:
        root.MarkInfo.Marked = True
    if "/Lang" not in root:
        root.Lang = "en-US"

    pdf.save(output_path)
    pdf.close()

    return {
        "total_figures": len(figure_mcids),
        "decorative_removed": len(decorative_mcids),
        "meaningful_kept": meaningful_count,
    }


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    decisions_path = sys.argv[3]
    with open(decisions_path) as f:
        decisions = json.load(f)
    result = apply_tags(input_path, output_path, decisions)
    print(json.dumps(result))
