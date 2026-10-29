#!/usr/bin/env python3
"""Extract page screenshots and meaningful raster figures for Remedy Docs.

PDFs produced from scanned journals commonly contain two overlapping image
layers: a full-page monochrome scan for the text and a smaller JPEG overlay for
each photograph or diagram.  The full-page scan is useful to Vision as the page
screenshot, but it must not be offered as a figure candidate or it can be
mistaken for the smaller overlay and recreate a blank figure area.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
from typing import Any

import pymupdf as fitz
from PIL import Image


def _image_hash(doc: fitz.Document, xref: int) -> str | None:
    try:
        return hashlib.md5(doc.extract_image(xref)["image"]).hexdigest()
    except Exception:
        return None


def _placement_stats(page: fitz.Page, xref: int) -> tuple[list[fitz.Rect], fitz.Rect | None, float]:
    try:
        rects = [rect for rect in page.get_image_rects(xref) if not rect.is_empty]
    except Exception:
        rects = []
    if not rects:
        return [], None, 0.0

    largest = max(rects, key=lambda rect: rect.get_area())
    page_area = page.rect.get_area()
    coverage = largest.get_area() / page_area if page_area > 0 else 0.0
    return rects, largest, coverage


def _is_page_scan_background(
    *,
    coverage: float,
    bits_per_component: int,
    images_on_page: int,
) -> bool:
    """Return true for a page-sized scan layer, not a content figure.

    Only exclude a one-bit scan with a separate overlay. Size and the presence
    of another image do NOT establish that a color photograph is a scan.
    """

    return coverage >= 0.75 and bits_per_component == 1 and images_on_page > 1


def _portable_image(doc: fitz.Document, xref: int, mask_xref: int) -> tuple[bytes, str]:
    """Resolve PDF-only color/decode semantics before embedding in HTML.

    InDesign can encode grayscale-looking photographs as DeviceN /Black.
    Extracting their JPEG bytes loses the tint transform and inverts the image
    when a browser interprets those bytes as DeviceGray. MuPDF, not Pillow,
    must apply the PDF color space and Decode array first.
    """
    extracted = doc.extract_image(xref)
    pixmap = fitz.Pixmap(doc, xref)
    plain_color = pixmap.colorspace and pixmap.colorspace.name in {"DeviceRGB", "DeviceGray"}
    special_decode = doc.xref_get_key(xref, "Decode")[0] != "null"
    color_key_mask = doc.xref_get_key(xref, "Mask")[0] != "null"
    if plain_color and not (special_decode or mask_xref or color_key_mask or pixmap.alpha):
        if extracted["ext"].lower() in {"png", "jpg", "jpeg"}:
            return extracted["image"], extracted["ext"].lower()
    if not pixmap.colorspace:
        raise ValueError("Image stencil needs a rendered page crop")
    pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
    if mask_xref and not pixmap.alpha:
        pixmap = fitz.Pixmap(pixmap, fitz.Pixmap(doc, mask_xref))
    # Flatten transparency only after applying PDF colors and mask semantics.
    image = Image.open(io.BytesIO(pixmap.tobytes("png"))).convert("RGBA")
    background = Image.new("RGBA", image.size, "white")
    background.alpha_composite(image)
    buffer = io.BytesIO()
    background.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue(), "png"


def _is_structural_sliver(rect: fitz.Rect | None) -> bool:
    if rect is None:
        return True
    width = abs(rect.width)
    height = abs(rect.height)
    if width < 8 or height < 8:
        return True
    aspect = max(width / height, height / width) if min(width, height) > 0 else float("inf")
    return aspect > 12 and min(width, height) < 12


def extract_pdf(input_path: str, work_dir: str) -> dict[str, Any]:
    doc = fitz.open(input_path)
    os.makedirs(work_dir, exist_ok=True)

    # Repetition is metadata, not a deletion rule. A meaningful diagram can
    # legitimately appear on multiple pages and must remain available.
    hash_page_count: dict[str, int] = {}
    for page in doc:
        seen_on_page: set[str] = set()
        for image_info in page.get_images(full=True):
            image_hash = _image_hash(doc, image_info[0])
            if image_hash and image_hash not in seen_on_page:
                seen_on_page.add(image_hash)
                hash_page_count[image_hash] = hash_page_count.get(image_hash, 0) + 1

    result: list[dict[str, Any]] = []
    diagnostics = {
        "candidate_images": 0,
        "page_backgrounds_skipped": 0,
        "structural_images_skipped": 0,
        "extraction_failures": 0,
    }

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1

        screenshot = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        screenshot_path = os.path.join(work_dir, f"page_{page_num:03d}_screen.png")
        screenshot.save(screenshot_path)

        # Capture the page's native text so downstream figure normalization
        # can distinguish a genuine printed caption from a Vision-hallucinated
        # description of an image. Alt text belongs only in the /Figure /Alt
        # metadata; a figcaption is kept only when the same words are visibly
        # printed on the page.
        source_text = page.get_text().strip()

        resources = {info[0]: info for info in page.get_images(full=True)}
        # Enumerate actual placements, including inline images. get_images()
        # lists resources, not occurrences, and omits inline logos entirely.
        image_list = page.get_image_info(xrefs=True)
        page_images: list[dict[str, Any]] = []
        for image_idx, image_info in enumerate(image_list):
            xref = image_info["xref"]
            soft_mask_xref = resources.get(xref, (0, 0))[1]
            bits_per_component = int(image_info.get("bpc", 0))

            try:
                largest_rect = fitz.Rect(image_info["bbox"]) & page.rect
                coverage = largest_rect.get_area() / page.rect.get_area()

                if _is_page_scan_background(
                    coverage=coverage,
                    bits_per_component=bits_per_component,
                    images_on_page=len(image_list),
                ):
                    diagnostics["page_backgrounds_skipped"] += 1
                    continue

                if _is_structural_sliver(largest_rect):
                    diagnostics["structural_images_skipped"] += 1
                    continue

                image_hash = _image_hash(doc, xref) if xref else None
                transform = fitz.Matrix(image_info["transform"])
                needs_crop = (
                    abs(transform.b) > 0.01 or abs(transform.c) > 0.01
                    or transform.a < 0 or transform.d < 0
                    or largest_rect != fitz.Rect(image_info["bbox"])
                    or (xref and doc.xref_get_key(xref, "ImageMask")[1] == "true")
                )
                if needs_crop:
                    # Rotation, reflection, clipping and painted stencils are
                    # placement properties, not properties of extracted bytes.
                    image_bytes = page.get_pixmap(
                        matrix=fitz.Matrix(2, 2), clip=largest_rect, alpha=False
                    ).tobytes("png")
                    image_ext = "png"
                elif xref:
                    image_bytes, image_ext = _portable_image(doc, xref, soft_mask_xref)
                else:
                    # Render inline content through the PDF engine as well;
                    # its ColorSpace/Decode may not survive raw extraction.
                    image_bytes = page.get_pixmap(
                        matrix=fitz.Matrix(2, 2), clip=largest_rect, alpha=False
                    ).tobytes("png")
                    image_ext = "png"
                with Image.open(io.BytesIO(image_bytes)) as verified:
                    verified.load()
                    image_width, image_height = verified.size

                image_filename = f"page_{page_num:03d}_img_{image_idx:02d}.{image_ext}"
                image_path = os.path.join(work_dir, image_filename)
                with open(image_path, "wb") as image_file:
                    image_file.write(image_bytes)

                # Keep the color-correct extraction for final PDF embedding, but send
                # Vision a bounded JPEG copy. Large source rasters can otherwise
                # exceed request limits or make a single page disproportionately
                # expensive to analyze.
                model_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                model_image.thumbnail((1600, 1600))
                vision_filename = f"page_{page_num:03d}_img_{image_idx:02d}_vision.jpg"
                vision_path = os.path.join(work_dir, vision_filename)
                model_image.save(vision_path, format="JPEG", quality=88, optimize=True)

                image_id = f"img-p{page_num}-{image_idx}"
                bbox = None
                if largest_rect is not None:
                    bbox = [
                        round(largest_rect.x0, 2),
                        round(largest_rect.y0, 2),
                        round(largest_rect.x1, 2),
                        round(largest_rect.y1, 2),
                    ]
                page_images.append(
                    {
                        "id": image_id,
                        "path": image_path,
                        "vision_path": vision_path,
                        "width": image_width,
                        "height": image_height,
                        "format": image_ext,
                        "bits_per_component": bits_per_component,
                        "page_coverage": round(coverage, 4),
                        "bbox": bbox,
                        "repeated_on_pages": hash_page_count.get(image_hash, 1),
                    }
                )
                diagnostics["candidate_images"] += 1
            except Exception as error:
                diagnostics["extraction_failures"] += 1
                raise RuntimeError(
                    f"Image-preservation check failed on page {page_num}, image {image_idx + 1}"
                ) from error

        result.append(
            {
                "page": page_num,
                "screenshot": screenshot_path,
                "images": page_images,
                "source_text": source_text,
                "page_width": page.rect.width,
                "page_height": page.rect.height,
            }
        )

    total_pages = len(doc)
    doc.close()
    return {"pages": result, "total": total_pages, "diagnostics": diagnostics}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: complex_pdf_extract.py INPUT.pdf WORK_DIR")
    print(json.dumps(extract_pdf(sys.argv[1], sys.argv[2])))


if __name__ == "__main__":
    main()
