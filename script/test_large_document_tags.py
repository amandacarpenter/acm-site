"""Regression for real production PDF/UA list-tag failures."""
import sys
from pathlib import Path
import pikepdf as p

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server/pdf_pipelines"))
from large_document_tags import normalize_list_bodies

with p.Pdf.new() as pdf:
    def element(kind, kids=None):
        node = pdf.make_indirect(p.Dictionary(Type=p.Name("/StructElem"), S=p.Name("/"+kind)))
        if kids is not None:
            node.K = p.Array(kids)
            for child in kids:
                child.P = node
        return node
    para1, para2 = element("P"), element("P")
    bare = element("LI", [para1, para2])
    label, body, extra = element("Lbl"), element("LBody"), element("Div")
    mixed = element("LI", [label, body, extra])
    good = element("LI", [element("Lbl"), element("LBody")])
    pdf.Root.StructTreeRoot = pdf.make_indirect(p.Dictionary(K=p.Array([bare,mixed,good])))
    assert normalize_list_bodies(pdf) == 2
    assert [str(c.S) for c in bare.K] == ["/LBody"]
    assert list(bare.K[0].K) == [para1,para2]
    assert para1.P == bare.K[0] and para2.P == bare.K[0]
    assert [str(c.S) for c in mixed.K] == ["/Lbl","/LBody","/LBody"]
    assert extra.P == mixed.K[2]
    assert [str(c.S) for c in good.K] == ["/Lbl","/LBody"]
    assert normalize_list_bodies(pdf) == 0
print("PASS: bare/mixed LI children, parent references, content order, valid lists, idempotence.")
