"""
Standalone tagged-PDF builder for the fast (text-extraction) Remedy Docs path.

This is a SEPARATE, purpose-built script for the "Keep as PDF" option -- it
does not modify or import from the existing handleComplexPdfFix WeasyPrint
pipeline in routes.ts. It is a trimmed adaptation of that same proven
approach (WeasyPrint pdf_tags=True + pikepdf post-processing for PDF/UA
compliance), simplified for a single already-structured HTML blob with no
embedded figures/images and no multi-page merge logic, since the fast path
never extracts images and already returns one assembled HTML document.

Usage: python3 text_pdf_tag.py <output.pdf>
Reads JSON from stdin: {"html": "<div lang=\"en\">...</div>", "title": "..."}
Writes a tagged, PDF/UA-flagged PDF to <output.pdf>.
Prints "ok" to stdout on success.
"""

import sys
import json
import os
import re
import traceback as _tb

import pikepdf
from bs4 import BeautifulSoup
from weasyprint import HTML
from weasyprint.formatting_structure import boxes as _wp_boxes
import weasyprint.pdf.tags as _wp_tags
import pydyf as _pydyf

data = json.loads(sys.stdin.read())
output_path = sys.argv[1]
source_html = data["html"]
doc_title = data.get("title") or "Document"


def clean_html(raw_html: str) -> str:
    soup = BeautifulSoup(raw_html, "html.parser")
    for tag in soup.find_all(["style", "script"]):
        tag.decompose()

    # Strip tables/rows with no real content -- same WeasyPrint "Table
    # wrapper without a table" crash guard used by the vision pipeline.
    for table in soup.find_all("table"):
        if not table.find_all("tr"):
            table.unwrap()
    for orphan in soup.find_all(["tr", "thead", "tbody", "tfoot", "td", "th"]):
        if not orphan.find_parent("table"):
            orphan.unwrap()

    # Pad short rows so every row in a table has the same column count
    # (colspan is not supported by WeasyPrint's tagged-PDF struct builder).
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            for cell in row.find_all(["td", "th"], recursive=False):
                try:
                    span = int(cell.get("colspan", 1))
                except (TypeError, ValueError):
                    span = 1
                if span > 1:
                    del cell["colspan"]
                    for _ in range(span - 1):
                        filler = soup.new_tag(cell.name)
                        filler.string = ""
                        cell.insert_after(filler)

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        def row_width(row):
            width = 0
            for cell in row.find_all(["td", "th"], recursive=False):
                try:
                    width += int(cell.get("colspan", 1))
                except (TypeError, ValueError):
                    width += 1
            return width

        widths = [row_width(r) for r in rows]
        max_width = max(widths) if widths else 0
        for row, w in zip(rows, widths):
            for _ in range(max_width - w):
                filler = soup.new_tag("td")
                filler.string = ""
                row.append(filler)
        if not table.find("th"):
            first_row = rows[0]
            for cell in first_row.find_all("td"):
                cell.name = "th"
                cell["scope"] = "col"
        thead = table.find("thead")
        header_row = thead.find("tr") if thead else rows[0]
        for row in rows:
            cells = row.find_all(["td", "th"], recursive=False)
            if not cells:
                continue
            first_cell = cells[0]
            if first_cell.name == "th" and not first_cell.get("scope") and row is not header_row:
                first_cell["scope"] = "row"
        for th in table.find_all("th"):
            if not th.get("scope"):
                th["scope"] = "col"

    return str(soup)


cleaned = clean_html(source_html)

css_rules = [
    "@page { size: letter; margin: 1in; }",
    "body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }",
    "h1 { font-size: 18pt; font-weight: bold; margin: 12pt 0 6pt 0; }",
    "h2 { font-size: 15pt; font-weight: bold; margin: 10pt 0 5pt 0; }",
    "h3 { font-size: 13pt; font-weight: bold; margin: 8pt 0 4pt 0; }",
    "h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: 6pt 0 3pt 0; }",
    "p { margin: 0 0 6pt 0; }",
    "ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }",
    "li { margin-bottom: 2pt; }",
    "table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }",
    "th { background: #f0f0f0; border: 1px solid #999; padding: 4pt 6pt; text-align: left; font-weight: bold; }",
    "td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }",
    "blockquote { margin: 6pt 0 6pt 24pt; border-left: 2pt solid #999; padding-left: 8pt; }",
]
css = "\n".join(css_rules)

full_html = (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    "<title>" + doc_title + "</title>"
    "<style>" + css + "</style></head><body>"
    + cleaned
    + "</body></html>"
)

tmp_html = output_path + ".html"
with open(tmp_html, "w", encoding="utf-8") as f:
    f.write(full_html)


def _find_table_wrapper_culprit(html_source):
    for m in re.finditer(r"<table[^>]*>.*?</table>", html_source, re.DOTALL):
        frag = m.group(0)
        if not re.search(r"<tr[\s>]", frag):
            return frag[:300]
    return None


# Same WeasyPrint bug workarounds used by the vision pipeline's builder --
# see routes.ts handleComplexPdfFix for the full rationale on each patch.
def _patched_get_wrapped_table(self):
    for child in self.children:
        if isinstance(child, _wp_boxes.TableBox):
            return child
    synthetic = _wp_boxes.TableBox.anonymous_from(self, [])
    synthetic.is_table_wrapper = False
    return synthetic


_wp_boxes.ParentBox.get_wrapped_table = _patched_get_wrapped_table

_original_build_box_tree = _wp_tags._build_box_tree


def _patched_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
    for element in _original_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
        try:
            if element.get("S") == "/TH" and box.element is not None:
                scope_attr = box.element.attrib.get("scope")
                pdf_scope = "Row" if scope_attr == "row" else "Column"
                element["A"] = _pydyf.Dictionary({"O": "/Table", "Scope": f"/{pdf_scope}"})
        except Exception:
            pass
        yield element


_wp_tags._build_box_tree = _patched_build_box_tree

try:
    HTML(filename=tmp_html).write_pdf(output_path, pdf_tags=True)
except ValueError as wp_val_err:
    culprit = _find_table_wrapper_culprit(full_html) if "table" in str(wp_val_err).lower() else None
    try:
        os.unlink(tmp_html)
    except Exception:
        pass
    detail = (" Suspect table fragment: " + culprit) if culprit else ""
    raise RuntimeError("WeasyPrint tagged-PDF generation failed: " + str(wp_val_err) + detail)
except Exception as wp_err:
    try:
        os.unlink(tmp_html)
    except Exception:
        pass
    raise RuntimeError("WeasyPrint failed: " + str(wp_err) + " | " + _tb.format_exc()[-500:])

pp = pikepdf.open(output_path, allow_overwriting_input=True)
if "/StructTreeRoot" not in pp.Root:
    pp.close()
    raise RuntimeError(
        "WeasyPrint produced a PDF with no StructTreeRoot (tagging silently "
        "did not happen despite pdf_tags=True and no exception). Aborting "
        "instead of returning a falsely-successful untagged file."
    )
if "/ViewerPreferences" not in pp.Root:
    pp.Root["/ViewerPreferences"] = pikepdf.Dictionary()
pp.Root["/ViewerPreferences"]["/DisplayDocTitle"] = pikepdf.Boolean(True)

with pp.open_metadata() as _pp_meta:
    _pp_meta.load_from_docinfo(pp.docinfo, delete_missing=False)
    if not _pp_meta.get("dc:title"):
        _pp_meta["dc:title"] = doc_title
    _pp_meta["pdfuaid:part"] = "1"
if "/MarkInfo" not in pp.Root:
    pp.Root["/MarkInfo"] = pikepdf.Dictionary()
pp.Root["/MarkInfo"]["/Marked"] = pikepdf.Boolean(True)
if "/Info" not in pp.trailer:
    pp.trailer["/Info"] = pikepdf.Dictionary()
pp.trailer["/Info"]["/Title"] = pikepdf.String(doc_title)


# Table Headers + IDTree repair passes -- identical logic to the vision
# pipeline's builder (see routes.ts for full rationale).
def _pp_get_S(elem):
    s = elem.get("/S")
    return str(s) if s is not None else None


def _pp_get_kids(elem):
    kids = elem.get("/K")
    if kids is None:
        return []
    if isinstance(kids, pikepdf.Array):
        return [k for k in kids if isinstance(k, pikepdf.Dictionary)]
    if isinstance(kids, pikepdf.Dictionary):
        return [kids]
    return []


def _pp_get_attr(elem, create=False):
    attrs = elem.get("/A")
    if attrs is None:
        if create:
            d = pikepdf.Dictionary({"/O": pikepdf.Name("/Table"), "/Headers": pikepdf.Array([])})
            elem["/A"] = d
            return elem["/A"]
        return None
    if isinstance(attrs, pikepdf.Array):
        for a in attrs:
            if isinstance(a, pikepdf.Dictionary):
                return a
        if create:
            d = pikepdf.Dictionary({"/O": pikepdf.Name("/Table"), "/Headers": pikepdf.Array([])})
            attrs.append(d)
            return attrs[-1]
        return None
    if isinstance(attrs, pikepdf.Dictionary):
        return attrs
    return None


_pp_current_headers = {}
_pp_headers_fixed = 0


def _pp_visit(elem):
    global _pp_current_headers, _pp_headers_fixed
    s = _pp_get_S(elem)
    if s == "/TR":
        cells = _pp_get_kids(elem)
        tags = [_pp_get_S(c) for c in cells]
        if cells and len(cells) > 1 and all(t == "/TH" for t in tags):
            new_map = {}
            for ci, c in enumerate(cells):
                idv = c.get("/ID")
                if idv is not None:
                    new_map[ci] = str(idv)
            if new_map:
                _pp_current_headers = new_map
        else:
            for ci, c in enumerate(cells):
                if _pp_get_S(c) != "/TD":
                    continue
                attrs = _pp_get_attr(c)
                current = attrs.get("/Headers") if attrs else None
                current_len = len(current) if current is not None else 0
                if current_len > 0:
                    continue
                th_id = _pp_current_headers.get(ci)
                if th_id is None:
                    continue
                attrs = _pp_get_attr(c, create=True)
                attrs["/Headers"] = pikepdf.Array([pikepdf.String(th_id)])
                _pp_headers_fixed += 1
        return
    for k in _pp_get_kids(elem):
        _pp_visit(k)


_pp_st = pp.Root["/StructTreeRoot"]
for _pp_k in _pp_get_kids(_pp_st):
    _pp_visit(_pp_k)
print(f"headers-repair: fixed {_pp_headers_fixed} TD elements", file=sys.stderr)

_pp_th_total = 0
_pp_th_missing_scope = 0


def _pp_verify_scope(elem):
    global _pp_th_total, _pp_th_missing_scope
    s = _pp_get_S(elem)
    if s == "/TR":
        cells = _pp_get_kids(elem)
        for c in cells:
            if _pp_get_S(c) != "/TH":
                continue
            _pp_th_total += 1
            attrs = _pp_get_attr(c)
            has_scope = attrs is not None and "/Scope" in attrs
            if not has_scope:
                _pp_th_missing_scope += 1
                attrs = _pp_get_attr(c, create=True)
                attrs["/Scope"] = pikepdf.Name("/Column")
        return
    for k in _pp_get_kids(elem):
        _pp_verify_scope(k)


for _pp_k in _pp_get_kids(_pp_st):
    _pp_verify_scope(_pp_k)
print(f"scope-verify: {_pp_th_total} TH total, {_pp_th_missing_scope} backfilled", file=sys.stderr)

_pp_id_entries = []


def _pp_collect_ids(elem):
    if isinstance(elem, pikepdf.Dictionary) and "/ID" in elem:
        _pp_id_entries.append((bytes(elem.ID), elem))
    for k in _pp_get_kids(elem):
        _pp_collect_ids(k)


for _pp_k in _pp_get_kids(_pp_st):
    _pp_collect_ids(_pp_k)

if _pp_id_entries:
    _pp_id_entries.sort(key=lambda pair: pair[0])
    _pp_names_array = pikepdf.Array()
    for _pp_id_bytes, _pp_elem in _pp_id_entries:
        _pp_names_array.append(pikepdf.String(_pp_id_bytes))
        _pp_names_array.append(_pp_elem)
    _pp_st["/IDTree"] = pikepdf.Dictionary({"/Names": _pp_names_array})
print(f"idtree-build: registered {len(_pp_id_entries)} struct element IDs into StructTreeRoot/IDTree", file=sys.stderr)

pp.save(output_path)
pp.close()

try:
    os.unlink(tmp_html)
except Exception:
    pass

print("ok")
