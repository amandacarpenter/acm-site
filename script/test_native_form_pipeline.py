#!/usr/bin/env python3
"""Exercise the native one-page form pipeline without external AI calls.

Usage: python script/test_native_form_pipeline.py SOURCE.pdf
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf as fitz


ROOT = Path(__file__).resolve().parents[1]
PIPELINES = ROOT / "server" / "pdf_pipelines"
GENERIC_CHECKBOX_RE = re.compile(r"^(check\s*box|checkbox|button)\s*\d*$", re.I)


def helper(name: str, *args: object) -> dict:
    command = [sys.executable, str(PIPELINES / name), *(str(arg) for arg in args)]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    for line in reversed(result.stdout.splitlines()):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise AssertionError(f"{name} returned no JSON: {result.stdout!r}")


def widget_count(document: fitz.Document) -> int:
    return sum(len(list(page.widgets() or [])) for page in document)


def widget_signature(document: fitz.Document) -> list[tuple]:
    signature = []
    for page_number, page in enumerate(document):
        for widget in page.widgets() or []:
            signature.append(
                (
                    page_number,
                    widget.field_type_string,
                    widget.field_name,
                    widget.field_value,
                    tuple(round(value, 4) for value in widget.rect),
                )
            )
    return signature


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: test_native_form_pipeline.py SOURCE.pdf [OUTPUT.pdf]")
    source = Path(sys.argv[1]).resolve()

    with tempfile.TemporaryDirectory(prefix="native-form-test-") as work:
        work_dir = Path(work)
        annots = work_dir / "annots.pdf"
        orphaned = work_dir / "orphaned.pdf"
        tagged = work_dir / "tagged.pdf"
        background = work_dir / "background.pdf"
        forms = work_dir / "forms.pdf"
        reordered = work_dir / "reordered.pdf"
        titled = work_dir / "titled.pdf"

        helper("flyer_fix_annots.py", source, annots)
        extracted = helper("flyer_extract_figures.py", annots)
        figures = extracted.get("figures", [])

        orphans = helper("flyer_orphan_figures.py", "extract", annots).get(
            "orphans", []
        )
        figure_decisions = work_dir / "figure-decisions.json"
        orphan_decisions = work_dir / "orphan-decisions.json"
        background_decisions = work_dir / "background-decisions.json"
        figure_decisions.write_text(
            json.dumps(
                [
                    {
                        "mcid": figure["mcid"],
                        "decorative": False,
                        "alt_text": figure.get("existing_alt") or "Image",
                    }
                    for figure in figures
                ]
            ),
            encoding="utf-8",
        )
        orphan_decisions.write_text(
            json.dumps(
                [
                    {
                        "orphan_id": orphan["orphan_id"],
                        "decorative": False,
                        "alt_text": "Image",
                    }
                    for orphan in orphans
                ]
            ),
            encoding="utf-8",
        )

        helper(
            "flyer_orphan_figures.py",
            "apply",
            annots,
            orphaned,
            orphan_decisions,
        )
        helper(
            "flyer_apply_tags.py",
            orphaned,
            tagged,
            figure_decisions,
        )

        candidates = helper(
            "flyer_background_images.py", "extract", tagged
        ).get("candidates", [])
        background_decisions.write_text(
            json.dumps(
                [
                    {
                        "cand_id": candidate["cand_id"],
                        "decorative": False,
                        "alt_text": "Image",
                    }
                    for candidate in candidates
                ]
            ),
            encoding="utf-8",
        )
        helper(
            "flyer_background_images.py",
            "apply",
            tagged,
            background,
            background_decisions,
        )
        form_result = helper("flyer_fix_forms.py", background, forms)
        helper("flyer_reading_order.py", forms, reordered)
        title_result = helper("flyer_fix_title.py", reordered, titled)
        output = titled if title_result.get("changed") else reordered

        original_doc = fitz.open(source)
        output_doc = fitz.open(output)
        assert len(original_doc) == len(output_doc), "Page count changed"
        assert widget_count(original_doc) == widget_count(output_doc), (
            "AcroForm widget count changed"
        )
        assert widget_signature(original_doc) == widget_signature(output_doc), (
            "AcroForm field type, name, value, or geometry changed"
        )
        assert form_result["widgets_tagged"] == widget_count(output_doc), (
            "Every widget must be associated with a /Form structure element"
        )
        assert form_result["tab_order"] == "structure"
        for page_number in range(len(original_doc)):
            original_page = original_doc[page_number]
            output_page = output_doc[page_number]
            assert original_page.rect == output_page.rect, "Page geometry changed"
            original_pixels = original_page.get_pixmap(alpha=False).samples
            output_pixels = output_page.get_pixmap(alpha=False).samples
            assert original_pixels == output_pixels, "Visible page pixels changed"

        visible_text = "\n".join(page.get_text() for page in output_doc).casefold()
        assert "image of" not in visible_text, "Alt description leaked into page text"
        assert "logo showing" not in visible_text, "Alt description leaked into page text"
        assert output_doc.metadata.get("title") == (
            "Cal Grant B Remaining Eligibility 200% or Less"
        ), "Document title was not derived from the visible main heading"
        structure_text = subprocess.run(
            ["pdfinfo", "-struct-text", str(output)],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        assert (
            'H1 (block)\n    "Cal Grant B Remaining Eligibility 200% or Less '
            in structure_text
        ), "Visible document title is not the H1 in the tag tree"
        output_pdf = __import__("pikepdf").open(output)
        assert str(output_pdf.Root.Lang) == "en-US"
        assert bool(output_pdf.Root.ViewerPreferences.DisplayDocTitle)
        for page in output_pdf.pages:
            assert str(page.Tabs) == "/S"
            for annot in page.get("/Annots", []):
                if str(annot.get("/Subtype", "")) != "/Widget":
                    continue
                assert str(annot.get("/TU", "")).strip(), "Widget lacks a tooltip"
                assert "/StructParent" in annot, "Widget is absent from the structure tree"
        checkbox_labels = [
            str(annot.get("/TU", ""))
            for page in output_pdf.pages
            for annot in page.get("/Annots", [])
            if str(annot.get("/Subtype", "")) == "/Widget"
            and str(annot.get("/FT", "")) == "/Btn"
        ]
        assert all(not GENERIC_CHECKBOX_RE.match(label) for label in checkbox_labels)
        output_pdf.close()
        print(
            json.dumps(
                {
                    "pages": len(output_doc),
                    "widgets": widget_count(output_doc),
                    "visible_pixels_changed": False,
                    "alt_description_visible": False,
                }
            )
        )
        if len(sys.argv) == 3:
            shutil.copy2(output, Path(sys.argv[2]).resolve())


if __name__ == "__main__":
    main()
