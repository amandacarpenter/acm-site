#!/usr/bin/env python3
"""Regression tests for layered PDF figure extraction."""

from __future__ import annotations

import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "server" / "pdf_pipelines"))

from complex_pdf_extract import extract_pdf  # noqa: E402


def _background_png() -> bytes:
    image = Image.new("1", (1200, 1800), 1)
    draw = ImageDraw.Draw(image)
    for y in range(140, 850, 42):
        draw.rectangle((120, y, 1060, y + 5), fill=0)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _diagram_jpeg() -> bytes:
    image = Image.new("L", (700, 500), 255)
    draw = ImageDraw.Draw(image)
    draw.ellipse((120, 40, 580, 460), outline=0, width=10)
    draw.line((350, 45, 350, 455), fill=0, width=8)
    draw.line((125, 250, 575, 250), fill=0, width=8)
    draw.rectangle((260, 160, 440, 340), outline=0, width=8)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _make_layered_pdf(path: str, pages: int = 1) -> None:
    document = fitz.open()
    background = _background_png()
    diagram = _diagram_jpeg()
    for _ in range(pages):
        page = document.new_page(width=595, height=882)
        page.insert_image(page.rect, stream=background)
        page.insert_image(fitz.Rect(125, 390, 470, 635), stream=diagram)
    document.save(path)
    document.close()


class ComplexPdfExtractTests(unittest.TestCase):
    def test_page_scan_background_is_excluded_but_overlay_is_retained(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "layered.pdf")
            work = os.path.join(temp_dir, "work")
            _make_layered_pdf(source)

            result = extract_pdf(source, work)

            self.assertEqual(result["total"], 1)
            self.assertEqual(result["diagnostics"]["page_backgrounds_skipped"], 1)
            self.assertEqual(result["diagnostics"]["candidate_images"], 1)
            candidates = result["pages"][0]["images"]
            self.assertEqual(len(candidates), 1)
            self.assertEqual(candidates[0]["format"], "jpeg")
            self.assertLess(candidates[0]["page_coverage"], 0.25)
            self.assertTrue(os.path.exists(candidates[0]["vision_path"]))
            with Image.open(candidates[0]["vision_path"]) as model_image:
                self.assertLessEqual(max(model_image.size), 1600)
                self.assertEqual(model_image.mode, "RGB")
            self.assertLess(os.path.getsize(candidates[0]["vision_path"]), 3 * 1024 * 1024)

    def test_repeated_meaningful_diagram_is_preserved_on_each_page(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "repeated.pdf")
            work = os.path.join(temp_dir, "work")
            _make_layered_pdf(source, pages=2)

            result = extract_pdf(source, work)

            self.assertEqual(result["diagnostics"]["page_backgrounds_skipped"], 2)
            self.assertEqual(result["diagnostics"]["candidate_images"], 2)
            for page in result["pages"]:
                self.assertEqual(len(page["images"]), 1)
                self.assertEqual(page["images"][0]["repeated_on_pages"], 2)


if __name__ == "__main__":
    unittest.main()
