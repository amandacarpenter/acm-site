"""Embed verified PDF images and reject silent image loss."""
from __future__ import annotations

import base64
import io
import math
from collections import Counter

import pymupdf as fitz
from PIL import Image


def _embed(tag, image_bytes: bytes, extension: str, bbox) -> None:
    with Image.open(io.BytesIO(image_bytes)) as image:
        image.load()
        if min(image.size) < 2:
            raise ValueError("Image-preservation check failed: invisible image placeholder")
    mime = "jpeg" if extension.lower() in {"jpg", "jpeg"} else extension.lower()
    if mime not in {"png", "jpeg"}:
        raise ValueError("Image-preservation check failed: unsupported image encoding")
    tag["src"] = f"data:image/{mime};base64," + base64.b64encode(image_bytes).decode()
    width, height = float(bbox[2]) - float(bbox[0]), float(bbox[3]) - float(bbox[1])
    if not all(math.isfinite(n) and n > 0 for n in (width, height)):
        raise ValueError("Image-preservation check failed: invalid source image dimensions")
    # PDF points, not raster pixel counts: a 300dpi portrait must not grow 3x.
    scale = min(1, 456 / width, 600 / height)
    tag["style"] = f"width: {width * scale:.3f}pt; max-width: 100%; height: auto;"
    tag.attrs.pop("width", None)
    tag.attrs.pop("height", None)


def _crop_figure(soup, figure, screenshot, page_width, page_height):
    """Use a source-page crop for vector figures, never an invisible stand-in."""
    try:
        box = [float(n.strip()) for n in str(figure.get("data-bbox", "")).split(",")]
        if len(box) != 4 or not all(math.isfinite(n) and 0 <= n <= 1000 for n in box):
            raise ValueError("invalid coordinates")
        x0, y0, x1, y1 = box
        if x1 <= x0 or y1 <= y0:
            raise ValueError("empty coordinates")
        with Image.open(screenshot) as page_image:
            crop = page_image.crop((
                math.floor(x0 * page_image.width / 1000),
                math.floor(y0 * page_image.height / 1000),
                math.ceil(x1 * page_image.width / 1000),
                math.ceil(y1 * page_image.height / 1000),
            )).convert("RGB")
            buffer = io.BytesIO()
            crop.save(buffer, format="PNG")
        tag = soup.new_tag("img")
        tag["alt"] = figure.get("data-alt") or "Source figure; alternative text requires review"
        _embed(tag, buffer.getvalue(), "png", [
            x0 * page_width / 1000, y0 * page_height / 1000,
            x1 * page_width / 1000, y1 * page_height / 1000,
        ])
        return tag
    except Exception as error:
        raise ValueError(
            "Image-preservation check failed: a figure has no verified image "
            "or valid source-page crop. No blank placeholder was substituted."
        ) from error


def embed_page_images(soup, images, screenshot=None, page_width=612, page_height=792):
    """Resolve trusted IDs, preserve omitted candidates, and crop vector artwork.

    Image paths and screenshot paths come only from our extractor, not AI HTML.
    Missing descriptions on recovered images are explicitly marked for review.
    Unknown model IDs without a valid crop fail closed.
    """
    by_id = {image["id"]: image for image in images}
    if len(by_id) != len(images):
        raise ValueError("Image-preservation check failed: duplicate source image IDs")
    matched = set()
    for tag in list(soup.find_all("img")):
        source = str(tag.get("src", ""))
        image_id = source[4:] if source.startswith("cid:") else None
        info = by_id.get(image_id)
        if info is None:
            figure = tag.find_parent("figure")
            if figure is None:
                raise ValueError("Image-preservation check failed: unknown image reference")
            tag.replace_with(_crop_figure(soup, figure, screenshot, page_width, page_height))
            continue
        if image_id in matched:
            raise ValueError("Image-preservation check failed: duplicate image reference")
        with open(info["path"], "rb") as image_file:
            _embed(tag, image_file.read(), info["format"], info["bbox"])
        tag["data-remedy-image-id"] = image_id
        tag["alt"] = tag.get("alt") or "Source image; alternative text requires review"
        matched.add(image_id)

    for figure in soup.find_all("figure"):
        if not figure.find("img"):
            figure.insert(0, _crop_figure(soup, figure, screenshot, page_width, page_height))
        figure.attrs.pop("data-bbox", None)

    recovered = []
    for info in images:
        if info["id"] in matched:
            continue
        # The model can omit an image. Restore the real pixels instead of
        # accepting its omission; flag the description/placement for review.
        figure = soup.new_tag("figure")
        tag = soup.new_tag("img")
        with open(info["path"], "rb") as image_file:
            _embed(tag, image_file.read(), info["format"], info["bbox"])
        tag["alt"] = "Source image; alternative text and reading order require review"
        tag["data-remedy-image-id"] = info["id"]
        tag["data-remedy-image-review"] = "true"
        figure.append(tag)
        container = soup.find("section") or soup.body or soup
        container.append(figure)
        recovered.append(info["id"])
    return recovered


def validate_rendered_images(html: str, output_path: str) -> None:
    """Check decoded image pixels AND occurrence counts after PDF rendering."""
    from bs4 import BeautifulSoup
    expected = Counter()
    for image in BeautifulSoup(html, "html.parser").find_all("img"):
        source = str(image.get("src", ""))
        if not source.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
            raise ValueError("Image-preservation check failed: non-embedded image")
        raw = base64.b64decode(source.split(",", 1)[1], validate=True)
        pixmap = fitz.Pixmap(raw)
        expected[fitz.Pixmap(fitz.csRGB, pixmap).digest] += 1
    with fitz.open(output_path) as document:
        actual = Counter()
        for page in document:
            for info in page.get_image_info(xrefs=True):
                if not info["xref"]:
                    continue
                pixmap = fitz.Pixmap(document, info["xref"])
                # A raw-byte digest alone missed the original DeviceN defect:
                # identical samples can mean different colors in a PDF.
                actual[fitz.Pixmap(fitz.csRGB, pixmap).digest] += 1
    if expected - actual:
        raise ValueError(
            "Image-preservation check failed: rendered PDF lost or altered image pixels"
        )
