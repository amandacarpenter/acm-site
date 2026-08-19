"""Repair accessibility metadata for AcroForm widgets without changing pixels.

The native PDF route preserves interactive forms, but preservation alone is
not remediation. This helper gives widgets meaningful accessible names,
associates every widget with a /Form structure element, and switches pages to
structure-based tab order. It also adds useful descriptions to link
annotations when the source omitted them.

Usage:
  python3 flyer_fix_forms.py <input.pdf> <output.pdf>
"""

from __future__ import annotations

import json
import re
import sys

import pikepdf
import pymupdf as fitz

from flyer_reading_order import _find_reorder_target


CHECK_GLYPHS_RE = re.compile(r"^[\s\u2610\u2611\u2612\u25a1\u25a0\uf071\uf0fe]+")
GENERIC_CHECKBOX_RE = re.compile(r"^(check\s*box|checkbox|button)\s*\d*$", re.I)
ENGLISH_MARKERS = {
    "the", "and", "of", "to", "in", "for", "your", "you", "is", "are",
    "this", "that", "with", "will", "have", "from", "or", "on",
}


def _page_lines(input_path: str) -> list[list[dict]]:
    doc = fitz.open(input_path)
    pages: list[list[dict]] = []
    for page in doc:
        lines = []
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                text = "".join(span.get("text", "") for span in spans).strip()
                if not text:
                    continue
                lines.append(
                    {
                        "text": text,
                        "bbox": [float(value) for value in line["bbox"]],
                    }
                )
        lines.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))
        pages.append(lines)
    doc.close()
    return pages


def _looks_english(pages: list[list[dict]]) -> bool:
    words = re.findall(
        r"[A-Za-z]+",
        " ".join(line["text"] for page in pages for line in page),
    )
    if len(words) < 20:
        return False
    hits = sum(1 for word in words if word.casefold() in ENGLISH_MARKERS)
    return hits >= 8 and hits / len(words) >= 0.04


def _widget_rect_top_left(page, annot) -> list[float]:
    x0, y0, x1, y1 = [float(value) for value in annot.Rect]
    height = float(page.MediaBox[3]) - float(page.MediaBox[1])
    return [x0, height - y1, x1, height - y0]


def _clean_option_text(text: str) -> str:
    return re.sub(r"\s+", " ", CHECK_GLYPHS_RE.sub("", text)).strip()


def _checkbox_label(lines: list[dict], rect: list[float]) -> str | None:
    center_y = (rect[1] + rect[3]) / 2
    candidates = []
    for index, line in enumerate(lines):
        x0, y0, x1, y1 = line["bbox"]
        vertical_overlap = min(rect[3], y1) - max(rect[1], y0)
        if vertical_overlap < -3:
            continue
        if x0 > rect[2] + 80 or x1 < rect[0] - 8:
            continue
        cleaned = _clean_option_text(line["text"])
        if len(cleaned) < 4:
            continue
        candidates.append((abs(((y0 + y1) / 2) - center_y), index, cleaned))
    if not candidates:
        return None

    _, index, label = min(candidates)
    # Continue a visibly wrapped option only while the sentence is incomplete.
    while label and not re.search(r"[.!?)]$", label) and index + 1 < len(lines):
        current = lines[index]
        following = lines[index + 1]
        gap = following["bbox"][1] - current["bbox"][3]
        if gap > 6 or following["bbox"][0] < current["bbox"][0] - 25:
            break
        continuation = _clean_option_text(following["text"])
        if not continuation:
            break
        label = f"{label} {continuation}"
        index += 1
    return label[:500] if label else None


def _field_type(annot) -> str:
    current = annot
    while isinstance(current, pikepdf.Dictionary):
        if "/FT" in current:
            return str(current.FT)
        current = current.get("/Parent")
    return ""


def _field_value(annot, key: str) -> str:
    current = annot
    while isinstance(current, pikepdf.Dictionary):
        if key in current:
            return str(current.get(key, "")).strip()
        current = current.get("/Parent")
    return ""


def _set_field_value(annot, key: str, value: str) -> None:
    annot[key] = value
    parent = annot.get("/Parent")
    if isinstance(parent, pikepdf.Dictionary):
        parent[key] = value


def _friendly_text_label(name: str, current: str) -> str:
    normalized = (current or name).strip()
    common = {
        "name": "Name of financial aid applicant",
        "year": "Academic year",
        "student id": "Student ID",
        "date": "Date",
    }
    return common.get(normalized.casefold(), normalized)


def _number_tree_pairs(parent_tree) -> list:
    if "/Nums" in parent_tree:
        return parent_tree.Nums
    kids = parent_tree.get("/Kids", [])
    if kids:
        return _number_tree_pairs(kids[-1])
    parent_tree.Nums = pikepdf.Array()
    return parent_tree.Nums


def _existing_parent_keys(parent_tree) -> list[int]:
    keys: list[int] = []

    def walk(node):
        nums = node.get("/Nums")
        if isinstance(nums, pikepdf.Array):
            keys.extend(int(nums[index]) for index in range(0, len(nums), 2))
        for child in node.get("/Kids", []):
            walk(child)

    walk(parent_tree)
    return keys


def _append_struct_form(pdf, st, target, page, annot, label: str, key: int):
    objr = pdf.make_indirect(
        pikepdf.Dictionary(
            {
                "/Type": pikepdf.Name("/OBJR"),
                "/Obj": annot,
                "/Pg": page.obj,
            }
        )
    )
    form = pdf.make_indirect(
        pikepdf.Dictionary(
            {
                "/Type": pikepdf.Name("/StructElem"),
                "/S": pikepdf.Name("/Form"),
                "/P": target,
                "/Pg": page.obj,
                "/Alt": label,
                "/K": objr,
            }
        )
    )
    kids = target.get("/K")
    if isinstance(kids, pikepdf.Array):
        kids.append(form)
    elif kids is None:
        target.K = pikepdf.Array([form])
    else:
        target.K = pikepdf.Array([kids, form])
    annot.StructParent = key
    pairs = _number_tree_pairs(st.ParentTree)
    pairs.extend([key, form])
    return form


def fix_forms(input_path: str, output_path: str) -> dict:
    source_lines = _page_lines(input_path)
    pdf = pikepdf.open(input_path)
    existing_lang = str(pdf.Root.get("/Lang", "")).strip()
    if existing_lang.casefold() == "en-us":
        pdf.Root.Lang = "en-US"
    elif not existing_lang and _looks_english(source_lines):
        pdf.Root.Lang = "en-US"
    viewer_preferences = pdf.Root.get("/ViewerPreferences")
    if not isinstance(viewer_preferences, pikepdf.Dictionary):
        viewer_preferences = pikepdf.Dictionary()
        pdf.Root.ViewerPreferences = viewer_preferences
    viewer_preferences.DisplayDocTitle = True
    st = pdf.Root.get("/StructTreeRoot")
    widgets_named = 0
    widgets_tagged = 0
    links_described = 0

    next_parent_key = 0
    target = None
    if st is not None and "/ParentTree" in st:
        keys = _existing_parent_keys(st.ParentTree)
        next_parent_key = max(keys, default=-1) + 1
        target = _find_reorder_target(st)

    for page_index, page in enumerate(pdf.pages):
        page.Tabs = pikepdf.Name("/S")
        lines = source_lines[page_index] if page_index < len(source_lines) else []
        for annot in page.get("/Annots", []):
            subtype = str(annot.get("/Subtype", ""))
            if subtype == "/Link" and not str(annot.get("/Contents", "")).strip():
                action = annot.get("/A")
                uri = str(action.get("/URI", "")).strip() if isinstance(action, pikepdf.Dictionary) else ""
                if uri:
                    annot.Contents = uri.removeprefix("mailto:")
                    links_described += 1
                continue
            if subtype != "/Widget":
                continue

            field_type = _field_type(annot)
            name = _field_value(annot, "/T")
            current_label = _field_value(annot, "/TU")
            label = current_label
            if field_type == "/Btn" and (not label or GENERIC_CHECKBOX_RE.match(label)):
                label = _checkbox_label(lines, _widget_rect_top_left(page, annot))
            elif field_type == "/Tx":
                label = _friendly_text_label(name, current_label)
            if not label:
                label = name or "Form field"
            if label != current_label:
                _set_field_value(annot, "/TU", label)
                widgets_named += 1

            if (
                st is not None
                and target is not None
                and "/ParentTree" in st
                and "/StructParent" not in annot
            ):
                _append_struct_form(
                    pdf, st, target, page, annot, label, next_parent_key
                )
                next_parent_key += 1
                widgets_tagged += 1

    if st is not None:
        st.ParentTreeNextKey = next_parent_key
    pdf.save(output_path)
    pdf.close()
    return {
        "widgets_named": widgets_named,
        "widgets_tagged": widgets_tagged,
        "links_described": links_described,
        "tab_order": "structure",
    }


if __name__ == "__main__":
    result = fix_forms(sys.argv[1], sys.argv[2])
    print(json.dumps(result))
