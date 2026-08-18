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
import re
import sys
import time
from typing import Any

import pymupdf as fitz
from PIL import Image


CAPTION_OCR_DPI = 180
CAPTION_OCR_BUDGET_SECONDS = 45.0
NATIVE_CAPTION_PATTERN = re.compile(
    r"(?im)^\s*(?:figure|fig\.?|image|photo|chart|diagram|illustration)"
    r"\s*(?:\d+|[A-Z])?\s*[:.\-]"
)


def _merge_novel_ocr_text(native_text: str, ocr_text: str) -> str:
    """Append only OCR lines that are not already in the native text layer."""

    native_lines = {
        re.sub(r"\s+", " ", line).strip().casefold()
        for line in native_text.splitlines()
        if line.strip()
    }
    novel_lines: list[str] = []
    for line in ocr_text.splitlines():
        normalized = re.sub(r"\s+", " ", line).strip()
        if not normalized or normalized.casefold() in native_lines:
            continue
        novel_lines.append(normalized)
        native_lines.add(normalized.casefold())
    return "\n".join(part for part in (native_text, "\n".join(novel_lines)) if part)


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

    A one-bit image covering most of a page is almost always the scanned text
    background.  A page-sized image with another image layered on top is also a
    background candidate even when its encoding reports more than one bit.
    A lone full-page photograph or poster is retained.
    """

    return coverage >= 0.75 and (
        bits_per_component <= 1 or images_on_page > 1
    )


def _is_structural_sliver(rect: fitz.Rect | None) -> bool:
    if rect is None:
        return True
    width = abs(rect.width)
    height = abs(rect.height)
    if width < 8 or height < 8:
        return True
    aspect = max(width / height, height / width) if min(width, height) > 0 else float("inf")
    return aspect > 12 and min(width, height) < 12


def _all_meaningful_images_have_nearby_native_captions(
    page: fitz.Page,
    image_list: list[tuple[Any, ...]],
) -> bool:
    """Return true only after one-to-one native-caption/image association."""

    meaningful_rects: list[fitz.Rect] = []
    for image_info in image_list:
        xref = image_info[0]
        bits_per_component = int(image_info[4] or 0) if len(image_info) > 4 else 0
        _, largest_rect, coverage = _placement_stats(page, xref)
        if _is_page_scan_background(
            coverage=coverage,
            bits_per_component=bits_per_component,
            images_on_page=len(image_list),
        ) or _is_structural_sliver(largest_rect):
            continue
        if largest_rect is None:
            return False
        meaningful_rects.append(largest_rect)

    if not meaningful_rects:
        return False

    caption_rects: list[fitz.Rect] = []
    for block in page.get_text("blocks"):
        block_text = str(block[4] or "").strip()
        if NATIVE_CAPTION_PATTERN.search(block_text):
            caption_rects.append(fitz.Rect(block[0], block[1], block[2], block[3]))

    if len(caption_rects) < len(meaningful_rects):
        return False

    assigned_images: set[int] = set()
    for caption_rect in caption_rects:
        candidates: list[tuple[float, int]] = []
        for image_index, image_rect in enumerate(meaningful_rects):
            horizontal_gap = max(
                0.0,
                image_rect.x0 - caption_rect.x1,
                caption_rect.x0 - image_rect.x1,
            )
            if caption_rect.y0 >= image_rect.y1:
                # Captions conventionally sit below their image, so prefer this
                # direction when a caption falls between two nearby figures.
                vertical_gap = caption_rect.y0 - image_rect.y1
                direction_penalty = 0.0
            elif caption_rect.y1 <= image_rect.y0:
                vertical_gap = image_rect.y0 - caption_rect.y1
                direction_penalty = 25.0
            else:
                vertical_gap = 0.0
                direction_penalty = 10.0
            score = vertical_gap + horizontal_gap + direction_penalty
            if vertical_gap <= 80 and horizontal_gap <= 30:
                candidates.append((score, image_index))
        if candidates:
            _, nearest_image = min(candidates)
            assigned_images.add(nearest_image)

    return len(assigned_images) == len(meaningful_rects)


def extract_pdf(input_path: str, work_dir: str) -> dict[str, Any]:
    extraction_started = time.monotonic()
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
        "caption_ocr_pages": 0,
        "caption_ocr_native_caption_skips": 0,
        "caption_ocr_budget_skips": 0,
    }

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        image_list = page.get_images(full=True)
        source_text = page.get_text().strip()
        all_images_have_native_captions = (
            _all_meaningful_images_have_nearby_native_captions(page, image_list)
            if image_list
            else False
        )
        caption_ocr_budget_available = (
            time.monotonic() - extraction_started < CAPTION_OCR_BUDGET_SECONDS
        )
        if image_list and all_images_have_native_captions:
            diagnostics["caption_ocr_native_caption_skips"] += 1
        elif image_list and caption_ocr_budget_available:
            try:
                # Partial OCR merges native text with text found inside raster
                # images. This covers mixed pages whose header/footer has a
                # text layer while a genuine figure caption is rasterized.
                # The lower DPI and document-wide budget keep extraction inside
                # the route's pre-Vision deadline on large mixed PDFs.
                text_page = page.get_textpage_ocr(
                    language="eng",
                    dpi=CAPTION_OCR_DPI,
                    full=False,
                )
                ocr_text = page.get_text(textpage=text_page).strip()
                if ocr_text:
                    source_text = _merge_novel_ocr_text(source_text, ocr_text)
                diagnostics["caption_ocr_pages"] += 1
            except Exception:
                # OCR is a best-effort caption-validation aid. The downstream
                # normalizer fails closed and removes unverified visible
                # figure text when OCR is unavailable.
                pass
        elif image_list:
            diagnostics["caption_ocr_budget_skips"] += 1
        elif not source_text:
            try:
                text_page = page.get_textpage_ocr(
                    language="eng",
                    dpi=200,
                    full=True,
                )
                source_text = page.get_text(textpage=text_page).strip()
            except Exception:
                source_text = ""

        screenshot = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        screenshot_path = os.path.join(work_dir, f"page_{page_num:03d}_screen.png")
        screenshot.save(screenshot_path)

        page_images: list[dict[str, Any]] = []
        for image_idx, image_info in enumerate(image_list):
            xref = image_info[0]
            soft_mask_xref = image_info[1]
            bits_per_component = int(image_info[4] or 0) if len(image_info) > 4 else 0

            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = str(base_image["ext"]).lower()
                image_width = int(base_image.get("width", 0) or 0)
                image_height = int(base_image.get("height", 0) or 0)
                rects, largest_rect, coverage = _placement_stats(page, xref)

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

                image_hash = hashlib.md5(image_bytes).hexdigest()

                # Composite a soft mask onto white before saving. Some PDFs
                # store the visible artwork primarily in the alpha channel.
                if soft_mask_xref:
                    try:
                        mask_image = doc.extract_image(soft_mask_xref)
                        color = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                        mask = Image.open(io.BytesIO(mask_image["image"])).convert("L")
                        if mask.size != color.size:
                            mask = mask.resize(color.size)
                        white = Image.new("RGB", color.size, (255, 255, 255))
                        composited = Image.composite(color, white, mask)
                        buffer = io.BytesIO()
                        composited.save(buffer, format="PNG")
                        image_bytes = buffer.getvalue()
                        image_ext = "png"
                    except Exception:
                        pass

                # Claude accepts PNG/JPEG/GIF/WebP image blocks. Convert other
                # encodings so every retained candidate can be shown alongside
                # its stable ID instead of leaving the model to guess.
                if image_ext not in {"png", "jpg", "jpeg", "gif", "webp"}:
                    pixmap = fitz.Pixmap(doc, xref)
                    if pixmap.alpha:
                        pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
                    image_bytes = pixmap.tobytes("png")
                    image_ext = "png"

                image_filename = f"page_{page_num:03d}_img_{image_idx:02d}.{image_ext}"
                image_path = os.path.join(work_dir, image_filename)
                with open(image_path, "wb") as image_file:
                    image_file.write(image_bytes)

                # Keep the original extraction for final PDF embedding, but send
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
            except Exception:
                diagnostics["extraction_failures"] += 1

        result.append(
            {
                "page": page_num,
                "screenshot": screenshot_path,
                "images": page_images,
                "source_text": source_text,
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
