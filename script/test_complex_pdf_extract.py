#!/usr/bin/env python3
"""Regression tests for layered PDF figure extraction."""

from __future__ import annotations

import io
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont

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


def _caption_image_png(
    caption: str = "Figure 1. Remaining Cal Grant eligibility by term.",
) -> bytes:
    image = Image.new("RGB", (1000, 220), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        28,
    )
    draw.text(
        (40, 70),
        caption,
        fill="black",
        font=font,
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
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


def _make_mixed_text_raster_caption_pdf(path: str) -> None:
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_text(
        fitz.Point(60, 55),
        "CAL GRANT REMAINING ELIGIBILITY",
        fontsize=12,
    )
    page.insert_image(
        fitz.Rect(55, 300, 540, 407),
        stream=_caption_image_png(),
    )
    document.save(path)
    document.close()


def _make_near_limit_native_caption_pdf(path: str, pages: int = 48) -> None:
    document = fitz.open()
    icon = _diagram_jpeg()
    for page_number in range(1, pages + 1):
        page = document.new_page(width=595, height=842)
        page.insert_text(
            fitz.Point(60, 55),
            f"Page {page_number}: Native document text remains available.",
            fontsize=12,
        )
        page.insert_text(
            fitz.Point(60, 210),
            f"Figure {page_number}. Embedded eligibility reference icon.",
            fontsize=10,
        )
        page.insert_image(
            fitz.Rect(60, 230, 180, 316),
            stream=icon,
        )
    document.save(path)
    document.close()


def _make_two_caption_mixed_page_pdf(path: str) -> None:
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_text(
        fitz.Point(60, 140),
        "Figure 1. Native campus map legend.",
        fontsize=10,
    )
    page.insert_image(
        fitz.Rect(60, 160, 230, 280),
        stream=_diagram_jpeg(),
    )
    page.insert_image(
        fitz.Rect(55, 500, 540, 607),
        stream=_caption_image_png(
            "Figure 2. Rasterized scholarship award schedule."
        ),
    )
    document.save(path)
    document.close()


def _make_overlapping_caption_regions_pdf(path: str) -> None:
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_image(
        fitz.Rect(60, 100, 230, 160),
        stream=_diagram_jpeg(),
    )
    page.insert_text(
        fitz.Point(60, 185),
        "Figure 1. Native campus map legend.",
        fontsize=10,
    )
    page.insert_image(
        fitz.Rect(55, 200, 540, 440),
        stream=_caption_image_png(
            "Figure 2. Rasterized scholarship award schedule."
        ),
    )
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

    def test_mixed_native_text_and_raster_caption_are_both_extracted(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "mixed-caption.pdf")
            work = os.path.join(temp_dir, "work")
            _make_mixed_text_raster_caption_pdf(source)

            result = extract_pdf(source, work)
            source_text = result["pages"][0]["source_text"]

            self.assertIn("CAL GRANT REMAINING ELIGIBILITY", source_text)
            self.assertIn("Figure 1.", source_text)
            self.assertIn("byterm.", source_text.replace(" ", "").casefold())

    def test_near_limit_native_caption_pdf_stays_inside_extraction_deadline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "near-limit.pdf")
            work = os.path.join(temp_dir, "work")
            _make_near_limit_native_caption_pdf(source)

            started = time.monotonic()
            result = extract_pdf(source, work)
            elapsed = time.monotonic() - started

            self.assertEqual(result["total"], 48)
            self.assertEqual(result["diagnostics"]["caption_ocr_pages"], 0)
            self.assertEqual(
                result["diagnostics"]["caption_ocr_native_caption_skips"],
                48,
            )
            self.assertLess(elapsed, 60.0)
            self.assertLess(
                len(__import__("json").dumps(result).encode("utf-8")),
                16 * 1024 * 1024,
            )

    def test_native_caption_does_not_hide_a_different_raster_caption(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "two-caption-mixed.pdf")
            work = os.path.join(temp_dir, "work")
            _make_two_caption_mixed_page_pdf(source)

            result = extract_pdf(source, work)
            source_text = result["pages"][0]["source_text"]

            self.assertEqual(result["diagnostics"]["caption_ocr_pages"], 1)
            self.assertEqual(
                result["diagnostics"]["caption_ocr_native_caption_skips"],
                0,
            )
            self.assertIn("Figure 1. Native campus map legend.", source_text)
            self.assertIn("Figure2.", source_text.replace(" ", ""))
            self.assertIn("scholarship", source_text.casefold())

    def test_one_native_caption_cannot_cover_two_overlapping_regions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "overlapping-caption-regions.pdf")
            work = os.path.join(temp_dir, "work")
            _make_overlapping_caption_regions_pdf(source)

            result = extract_pdf(source, work)
            source_text = result["pages"][0]["source_text"]

            self.assertEqual(result["diagnostics"]["caption_ocr_pages"], 1)
            self.assertEqual(
                result["diagnostics"]["caption_ocr_native_caption_skips"],
                0,
            )
            self.assertIn("Figure 1. Native campus map legend.", source_text)
            self.assertIn("Figure2.", source_text.replace(" ", ""))
            self.assertIn("scholarship", source_text.casefold())


if __name__ == "__main__":
    unittest.main()
