import sys
from pathlib import Path
import pikepdf
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"server/pdf_pipelines"))
from heading_structure import normalize_heading_tags

nodes = [pikepdf.Dictionary(S=pikepdf.Name(f"/H{n}")) for n in [2,2,1,3,4,3,1,6]]
root=pikepdf.Dictionary(K=pikepdf.Array(nodes))
assert normalize_heading_tags(root) == 6
assert [str(n.S) for n in root.K] == ["/H1","/H1","/H1","/H2","/H3","/H2","/H1","/H2"]
assert normalize_heading_tags(root) == 0
print("PASS PDF tag normalization preserves sibling and descendant hierarchy; repeat run unchanged")
