"""Large-output-only list tag repair. Never changes page content or images."""
import pikepdf


def normalize_list_bodies(pdf):
    """Wrap bare structure elements under LI in LBody, preserving their order."""
    changed = 0
    seen = set()

    def walk(node):
        nonlocal changed
        if isinstance(node, pikepdf.Array):
            for child in node:
                walk(child)
            return
        if not isinstance(node, pikepdf.Dictionary):
            return
        if node.is_indirect:
            if node.objgen in seen:
                return
            seen.add(node.objgen)
        kids = node.get("/K")
        if str(node.get("/S", "")) == "/LI" and kids is not None:
            original = list(kids) if isinstance(kids, pikepdf.Array) else [kids]
            normalized, pending = [], []
            before = changed

            def flush():
                nonlocal changed
                if not pending:
                    return
                body = pdf.make_indirect(pikepdf.Dictionary(
                    Type=pikepdf.Name("/StructElem"), S=pikepdf.Name("/LBody"),
                    P=node, K=pikepdf.Array(pending)))
                for child in pending:
                    child["/P"] = body
                normalized.append(body)
                pending.clear()
                changed += 1

            for child in original:
                if (isinstance(child, pikepdf.Dictionary) and "/S" in child
                        and str(child["/S"]) not in ("/Lbl", "/LBody")):
                    pending.append(child)
                else:
                    flush()
                    normalized.append(child)
            flush()
            if changed != before:
                node["/K"] = pikepdf.Array(normalized)
            kids = node.get("/K")
        if kids is not None:
            walk(kids)

    walk(pdf.Root.get("/StructTreeRoot"))
    return changed


if __name__ == "__main__":
    import sys
    with pikepdf.open(sys.argv[1]) as document:
        print("List body wrappers added:", normalize_list_bodies(document))
        document.save(sys.argv[2])
