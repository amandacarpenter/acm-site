#!/usr/bin/env python3
"""Regression tests for Remedy Docs PDF routing."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import pikepdf
import pymupdf as fitz


ROOT = Path(__file__).resolve().parents[1]
DETECTOR = ROOT / "server" / "pdf_pipelines" / "pdf_route_detect.py"


def tag_pdf(
    path: Path,
    *,
    creator: str = "",
    producer: str = "",
    form: bool = False,
) -> None:
    with pikepdf.open(path, allow_overwriting_input=True) as pdf:
        pdf.Root.StructTreeRoot = pikepdf.Dictionary(
            Type=pikepdf.Name.StructTreeRoot,
            K=pikepdf.Array(),
            ParentTree=pikepdf.Dictionary(Nums=pikepdf.Array()),
            ParentTreeNextKey=0,
        )
        pdf.Root.MarkInfo = pikepdf.Dictionary(Marked=True)
        if form:
            pdf.Root.AcroForm = pikepdf.Dictionary(Fields=pikepdf.Array())
        if creator:
            pdf.docinfo["/Creator"] = creator
        if producer:
            pdf.docinfo["/Producer"] = producer
        pdf.save()


def make_text_pdf(
    path: Path,
    *,
    pages: int = 1,
    creator: str = "",
    producer: str = "",
    form: bool = False,
) -> None:
    document = fitz.open()
    for page_number in range(pages):
        page = document.new_page(width=612, height=792)
        page.insert_text(
            fitz.Point(48, 72),
            f"Student technology resources and support information, page {page_number + 1}.",
            fontsize=12,
        )
    document.save(path)
    document.close()
    tag_pdf(path, creator=creator, producer=producer, form=form)


def make_scanlike_pdf(path: Path, *, producer: str) -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 600, 780))
    pixmap.set_rect(pixmap.irect, (200, 210, 220))
    page.insert_image(fitz.Rect(6, 6, 606, 786), pixmap=pixmap)
    document.save(path)
    document.close()
    tag_pdf(path, producer=producer)


def make_table_pdf(path: Path, *, producer: str) -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    top, left, rows, columns = 80, 50, 8, 4
    row_height, column_width = 70, 128
    for row in range(rows + 1):
        y = top + row * row_height
        page.draw_line(
            fitz.Point(left, y),
            fitz.Point(left + columns * column_width, y),
        )
    for column in range(columns + 1):
        x = left + column * column_width
        page.draw_line(
            fitz.Point(x, top),
            fitz.Point(x, top + rows * row_height),
        )
    for row in range(rows):
        for column in range(columns):
            page.insert_text(
                fitz.Point(
                    left + column * column_width + 6,
                    top + row * row_height + 22,
                ),
                f"Cell {row}-{column} data value",
                fontsize=9,
            )
    document.save(path)
    document.close()
    tag_pdf(path, producer=producer)


def route(path: Path) -> dict[str, object]:
    completed = subprocess.run(
        ["python3", str(DETECTOR), str(path)],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    for line in reversed(completed.stdout.splitlines()):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise AssertionError(f"Detector returned no JSON: {completed.stdout!r}")


class PdfRouteDetectorTests(unittest.TestCase):
    def test_tagged_one_page_canva_design_preserves_native_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "canva-handout.pdf"
            make_text_pdf(path, creator="Canva")
            result = route(path)
        self.assertTrue(result["preserveNative"])
        self.assertFalse(result["useVision"])
        self.assertEqual(result["reason"], "tagged-one-page-canva-native")

    def test_tagged_one_page_acroform_still_preserves_native_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "form.pdf"
            make_text_pdf(path, creator="Microsoft Word", form=True)
            result = route(path)
        self.assertTrue(result["preserveNative"])
        self.assertEqual(result["reason"], "tagged-one-page-acroform-native")

    def test_multi_page_canva_pdf_does_not_enter_page_one_native_route(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "multi-page.pdf"
            make_text_pdf(path, creator="Canva", pages=2)
            result = route(path)
        self.assertFalse(result.get("preserveNative", False))

    def test_non_canva_tagged_pdf_is_not_assumed_to_be_designed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "ordinary.pdf"
            make_text_pdf(path, creator="Microsoft Word")
            result = route(path)
        self.assertFalse(result.get("preserveNative", False))

    def test_canva_producer_metadata_is_recognized(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "canva-producer.pdf"
            make_text_pdf(path, producer="Canva")
            result = route(path)
        self.assertTrue(result["preserveNative"])

    def test_scanned_canva_page_still_routes_to_ocr(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "scanned-canva.pdf"
            make_scanlike_pdf(path, producer="Canva")
            result = route(path)
        self.assertFalse(result.get("preserveNative", False))
        self.assertTrue(result["useVision"])
        self.assertEqual(result["reason"], "ocr-ratio-1.00")

    def test_table_dominated_canva_page_still_routes_to_vision(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "table-canva.pdf"
            make_table_pdf(path, producer="Canva")
            result = route(path)
        self.assertFalse(result.get("preserveNative", False))
        self.assertTrue(result["useVision"])
        self.assertEqual(result["reason"], "table-ratio-1.00")


if __name__ == "__main__":
    unittest.main()
