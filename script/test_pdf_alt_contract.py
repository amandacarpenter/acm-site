#!/usr/bin/env python3
"""Regression checks for the Remedy Docs image-description contract."""

from pathlib import Path


ROUTES = Path(__file__).resolve().parents[1] / "server" / "routes.ts"
source = ROUTES.read_text(encoding="utf-8")
NORMALIZER = ROUTES.parent / "pdf_pipelines" / "figure_html_normalize.py"
normalizer_source = NORMALIZER.read_text(encoding="utf-8")
DETECTOR = ROUTES.parent / "pdf_pipelines" / "pdf_route_detect.py"
detector_source = DETECTOR.read_text(encoding="utf-8")

required = [
    'data-alt="specific description"',
    'data-source-caption="true"',
    "Alternative text is metadata for assistive technology and MUST NOT be emitted as visible page text.",
    "normalize_figures(soup, source_text, TRANSPARENT_PIXEL)",
    "sourceText: p.sourceText || \"\"",
    '"pdf_route_detect.py"',
]

missing = [item for item in required if item not in source]
if missing:
    raise AssertionError(f"Missing PDF alt/native-routing safeguards: {missing}")

native_route_required = [
    "preserveNative=True",
    'reason="tagged-one-page-acroform-native"',
    'reason="tagged-one-page-canva-native"',
]
missing_native_routes = [
    item for item in native_route_required if item not in detector_source
]
if missing_native_routes:
    raise AssertionError(
        f"Missing required native PDF routing safeguards: {missing_native_routes}"
    )

for forbidden in [
    "Always include a <figcaption>",
    "alt text is the figcaption content",
    "rely on the <figcaption> alone",
]:
    if forbidden in source:
        raise AssertionError(f"Legacy visible-alt behavior remains: {forbidden}")

normalizer_required = [
    'images = [image.extract() for image in figure.find_all("img")]',
    "_matches_source(candidate, normalized_source)",
    "figure.clear()",
    'caption = soup.new_tag("figcaption")',
]
missing_normalizer = [
    item for item in normalizer_required if item not in normalizer_source
]
if missing_normalizer:
    raise AssertionError(
        f"Missing deterministic figure normalization safeguards: {missing_normalizer}"
    )

print("PDF alt-text visibility and native-form routing safeguards are present.")
