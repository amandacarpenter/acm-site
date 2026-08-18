#!/usr/bin/env python3
"""Adversarial checks for figure alt/caption normalization."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server" / "pdf_pipelines"))

from figure_html_normalize import normalize_figures  # noqa: E402


PIXEL = "data:image/png;base64,test"


class FigureHtmlNormalizeTests(unittest.TestCase):
    def normalize(self, html: str, source_text: str = "") -> BeautifulSoup:
        soup = BeautifulSoup(html, "html.parser")
        normalize_figures(soup, source_text, PIXEL)
        return soup

    def test_generated_caption_paragraph_and_bare_text_are_removed(self) -> None:
        soup = self.normalize(
            '<figure data-alt="College logo">'
            '<img src="cid:logo"><figcaption>Blue circular college logo</figcaption>'
            "<p>Blue circular college logo</p>Blue circular college logo"
            "</figure>",
            "Student eligibility form",
        )
        figure = soup.figure
        self.assertEqual(figure.get_text(" ", strip=True), "")
        self.assertIsNone(figure.figcaption)
        self.assertIsNone(figure.p)
        self.assertEqual(figure.img["alt"], "College logo")

    def test_marker_cannot_preserve_generated_caption(self) -> None:
        soup = self.normalize(
            '<figure data-alt="Logo"><img src="cid:logo">'
            '<figcaption data-source-caption="true">Generated description</figcaption>'
            "</figure>",
            "Actual form text only",
        )
        self.assertIsNone(soup.figcaption)

    def test_unmarked_real_source_caption_is_preserved(self) -> None:
        soup = self.normalize(
            '<figure data-alt="Map"><img src="cid:map">'
            "<p>Figure 1. Remaining Cal Grant eligibility by term.</p>"
            "</figure>",
            "Introduction\nFigure 1. Remaining Cal Grant eligibility by term.\nInstructions",
        )
        self.assertEqual(
            soup.figcaption.get_text(strip=True),
            "Figure 1. Remaining Cal Grant eligibility by term.",
        )
        self.assertIsNone(soup.p)

    def test_real_caption_survives_minor_ocr_errors(self) -> None:
        soup = self.normalize(
            '<figure data-alt="Chart"><img src="cid:chart">'
            "<p>Figure 1. Remaining Cal Grant eligibility by term.</p>"
            "</figure>",
            "CAL GRANT REMAINING ELIGIBILITY\n"
            "Figure 1. Remaining CalGrant eligibitity\nby term.",
        )
        self.assertEqual(
            soup.figcaption.get_text(strip=True),
            "Figure 1. Remaining Cal Grant eligibility by term.",
        )

    def test_vector_figure_receives_non_visible_placeholder(self) -> None:
        soup = self.normalize(
            '<figure data-alt="Flowchart showing three approval steps">'
            "<p>Flowchart showing three approval steps</p></figure>",
            "Application instructions",
        )
        self.assertEqual(soup.figure.get_text(" ", strip=True), "")
        self.assertEqual(soup.img["src"], PIXEL)
        self.assertEqual(soup.img["alt"], "Flowchart showing three approval steps")

    def test_native_and_ocr_raster_captions_both_survive(self) -> None:
        soup = self.normalize(
            '<figure data-alt="Map"><img src="cid:map">'
            "<p>Figure 1. Native campus map legend.</p></figure>"
            '<figure data-alt="Schedule"><img src="cid:schedule">'
            "<p>Figure 2. Rasterized scholarship award schedule.</p></figure>",
            "Figure 1. Native campus map legend.\n"
            "Figure2. Rasterized scholarship award scheduie.",
        )
        captions = [
            caption.get_text(strip=True)
            for caption in soup.find_all("figcaption")
        ]
        self.assertEqual(
            captions,
            [
                "Figure 1. Native campus map legend.",
                "Figure 2. Rasterized scholarship award schedule.",
            ],
        )


if __name__ == "__main__":
    unittest.main()
