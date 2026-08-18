#!/usr/bin/env python3
"""Keep PDF figure alternatives in metadata and source captions visible.

Vision-generated HTML is untrusted. A model may put an image description in a
figcaption, paragraph, div, or bare text node even when instructed not to. This
module rebuilds each figure from its image elements and only restores one
visible caption when that exact normalized text was present in the source PDF
text (or OCR). Everything else stays exclusively in the image's alt metadata.
"""

from __future__ import annotations

import unicodedata
from difflib import SequenceMatcher
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag


def _normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = (
        value.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
    return " ".join(value.split()).casefold()


def _node_text(node: Any) -> str:
    if isinstance(node, NavigableString):
        return " ".join(str(node).split())
    if isinstance(node, Tag):
        return " ".join(node.get_text(" ", strip=True).split())
    return ""


def _matches_source(candidate: str, normalized_source: str) -> bool:
    normalized_candidate = _normalize_text(candidate)
    if not normalized_candidate or not normalized_source:
        return False
    if normalized_candidate in normalized_source:
        return True
    # OCR can join words, split lines, or misread a few letters. Compare the
    # candidate with similarly-sized token windows rather than trusting the
    # model marker. Short labels remain exact-only to avoid false positives.
    if len(normalized_candidate) < 12:
        return False
    candidate_tokens = normalized_candidate.split()
    source_tokens = normalized_source.split()
    minimum = max(1, len(candidate_tokens) - 2)
    maximum = min(len(source_tokens), len(candidate_tokens) + 2)
    for window_size in range(minimum, maximum + 1):
        for start in range(0, len(source_tokens) - window_size + 1):
            window = " ".join(source_tokens[start : start + window_size])
            if SequenceMatcher(None, normalized_candidate, window).ratio() >= 0.78:
                return True
    return False


def normalize_figures(
    soup: BeautifulSoup,
    source_text: str,
    transparent_pixel: str,
) -> None:
    """Normalize every figure in ``soup`` in place.

    A caption is retained only when its normalized text is a substring of the
    normalized source-page text. The model's data-source-caption marker is not
    trusted by itself.
    """

    normalized_source = _normalize_text(source_text)

    for figure in soup.find_all("figure"):
        data_alt = " ".join(str(figure.get("data-alt", "")).split())[:500]
        images = [image.extract() for image in figure.find_all("img")]

        verified_caption = ""
        for child in list(figure.contents):
            candidate = _node_text(child)
            if (
                not verified_caption
                and _matches_source(candidate, normalized_source)
            ):
                verified_caption = candidate

        figure.clear()
        if not images:
            placeholder = soup.new_tag(
                "img",
                src=transparent_pixel,
                alt=data_alt or "Figure",
            )
            images = [placeholder]

        for image in images:
            if data_alt:
                image["alt"] = data_alt
            elif not image.get("alt"):
                image["alt"] = "Figure"
            figure.append(image)

        if verified_caption:
            caption = soup.new_tag("figcaption")
            caption.string = verified_caption
            figure.append(caption)

        figure.attrs.pop("data-alt", None)
        figure.attrs.pop("data-extracted", None)
