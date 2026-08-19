#!/usr/bin/env python3
"""Classify Remedy Docs uploads without modifying the source PDF."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pymupdf as fitz


def detect(pdf_path: Path) -> dict[str, object]:
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    sample_limit = min(total_pages, 8)
    step = max(1, total_pages // sample_limit) if sample_limit else 1

    sampled = 0
    ocr_pages = 0
    table_pages = 0
    image_pages = 0

    for index in range(0, total_pages, step):
        if sampled >= sample_limit:
            break
        sampled += 1
        page = doc[index]
        text = page.get_text().strip()
        if len(text) < 50:
            ocr_pages += 1
            continue
        try:
            tables = page.find_tables()
            real_tables = [
                table
                for table in tables.tables
                if table.row_count >= 3 and table.col_count >= 2
            ]
            if real_tables:
                page_area = page.rect.width * page.rect.height
                biggest = max(
                    real_tables,
                    key=lambda table: (
                        (table.bbox[2] - table.bbox[0])
                        * (table.bbox[3] - table.bbox[1])
                    ),
                )
                table_area = (biggest.bbox[2] - biggest.bbox[0]) * (
                    biggest.bbox[3] - biggest.bbox[1]
                )
                coverage = table_area / page_area if page_area > 0 else 0
                if coverage >= 0.3:
                    table_pages += 1
        except Exception:
            pass

    # Image placement is inexpensive enough to inspect on every page. Full-page
    # scan layers, hairlines, and tiny artifacts do not count as content images.
    for page in doc:
        try:
            has_real_image = False
            image_list = page.get_images(full=True)
            page_area = page.rect.get_area()
            for image_info in image_list:
                xref = image_info[0]
                bpc = int(image_info[4] or 0) if len(image_info) > 4 else 0
                rects = [
                    rect
                    for rect in page.get_image_rects(xref)
                    if not rect.is_empty
                ]
                if not rects:
                    continue
                largest = max(rects, key=lambda rect: rect.get_area())
                coverage = (
                    largest.get_area() / page_area if page_area > 0 else 0
                )
                if coverage >= 0.75 and (bpc <= 1 or len(image_list) > 1):
                    continue
                width, height = abs(largest.width), abs(largest.height)
                if width < 8 or height < 8:
                    continue
                aspect = (
                    max(width / height, height / width)
                    if min(width, height) > 0
                    else 999
                )
                if aspect > 12 and min(width, height) < 12:
                    continue
                has_real_image = True
                break
            if has_real_image:
                image_pages += 1
        except Exception:
            pass

    is_tagged = False
    has_acroform = False
    is_canva = False
    try:
        import pikepdf

        with pikepdf.open(pdf_path) as pdf:
            is_tagged = "/StructTreeRoot" in pdf.Root
            has_acroform = "/AcroForm" in pdf.Root
            creator = str(pdf.docinfo.get("/Creator", "")).lower()
            producer = str(pdf.docinfo.get("/Producer", "")).lower()
            is_canva = "canva" in creator or "canva" in producer
    except Exception:
        pass

    result: dict[str, object] = {
        "totalPages": total_pages,
        "sampled": sampled,
        "ocrPages": ocr_pages,
        "tablePages": table_pages,
        "imagePages": image_pages,
        "isTagged": is_tagged,
        "hasAcroform": has_acroform,
        "isCanva": is_canva,
    }

    if sampled == 0:
        result.update(useVision=False, reason="empty-doc")
        return result

    # The native helpers are currently page-1 scoped. One-page tagged forms and
    # one-page tagged Canva designs can be repaired in place without reflowing
    # their fields, cards, QR codes, typography, or other visual composition.
    if is_tagged and has_acroform and total_pages == 1:
        result.update(
            useVision=False,
            preserveNative=True,
            reason="tagged-one-page-acroform-native",
        )
        return result
    if (
        is_tagged
        and is_canva
        and total_pages == 1
        and ocr_pages == 0
        and table_pages == 0
    ):
        result.update(
            useVision=False,
            preserveNative=True,
            reason="tagged-one-page-canva-native",
        )
        return result

    ocr_ratio = ocr_pages / sampled
    table_ratio = table_pages / sampled
    if ocr_ratio >= 0.5:
        result.update(useVision=True, reason=f"ocr-ratio-{ocr_ratio:.2f}")
        return result
    if table_ratio >= 0.5:
        result.update(useVision=True, reason=f"table-ratio-{table_ratio:.2f}")
        return result
    if image_pages > 0:
        result.update(
            useVision=True,
            reason=f"has-content-images-{image_pages}-of-{sampled}",
        )
        return result

    result.update(useVision=False, reason="plain-text-fast-path")
    return result


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: pdf_route_detect.py input.pdf")
    print(json.dumps(detect(Path(sys.argv[1]))))


if __name__ == "__main__":
    main()
