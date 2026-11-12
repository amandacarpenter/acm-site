"""Regression checks for preserved PDF artwork and fail-closed image output."""
import base64
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf as fitz
from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageStat
from weasyprint import HTML

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/pdf_pipelines"))
from complex_pdf_extract import extract_pdf
from complex_pdf_images import embed_page_images, validate_rendered_images
from figure_html_normalize import normalize_figures


def raster(mode="RGB"):
    image = Image.new(mode, (100, 100), "white")
    for x in range(100):
        for y in range(100):
            image.putpixel((x, y), int(x * 255 / 99) if mode == "L" else (x * 2, y * 2, 100))
    buf = io.BytesIO()
    image.save(buf, "PNG")
    return buf.getvalue()


class ImageFidelityTests(unittest.TestCase):
    def extract(self, directory, kind="plain"):
        document = fitz.open()
        page = document.new_page(width=300, height=300)
        box = fitz.Rect(50, 50, 150, 150)
        xref = page.insert_image(box, stream=raster("L" if kind in {"spot", "decode"} else "RGB"))
        if kind == "spot":
            function = document.get_new_xref()
            document.update_object(function, "<< /FunctionType 2 /Domain [0 1] "
                "/C0 [0 0 0 0] /C1 [0 0 0 1] /N 1 >>")
            document.xref_set_key(xref, "ColorSpace", f"[/DeviceN [/Black] /DeviceCMYK {function} 0 R]")
        elif kind == "decode":
            document.xref_set_key(xref, "ColorSpace", "/DeviceGray")
            document.xref_set_key(xref, "Decode", "[1 0]")
        elif kind == "repeat":
            page.insert_image(fitz.Rect(160, 50, 260, 150), xref=xref)
        source = str(Path(directory) / "source.pdf")
        document.save(source)
        reference = page.get_pixmap(clip=box, alpha=False)
        reference_image = Image.frombytes("RGB", (reference.width, reference.height), reference.samples)
        document.close()
        return extract_pdf(source, str(Path(directory) / "extract")), reference_image

    def test_spot_and_decode_colors_match_rendered_original(self):
        for kind in ("spot", "decode"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                result, reference = self.extract(directory, kind)
                image = Image.open(result["pages"][0]["images"][0]["path"]).convert("RGB")
                error = max(ImageStat.Stat(ImageChops.difference(image, reference)).mean)
                self.assertLess(error, 2, f"{kind} must match source-page colors, not raw JPEG tones")

    def test_large_color_cover_plus_small_image_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            document = fitz.open()
            page = document.new_page(width=300, height=300)
            page.insert_image(page.rect, stream=raster())
            page.insert_image(fitz.Rect(20, 20, 80, 80), stream=raster("L"))
            path = str(Path(directory) / "cover.pdf")
            document.save(path)
            result = extract_pdf(path, str(Path(directory) / "extract"))
            self.assertEqual(len(result["pages"][0]["images"]), 2)
            self.assertEqual(result["diagnostics"]["page_backgrounds_skipped"], 0)

    def test_repeated_placements_on_one_page_are_not_deduplicated(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory, "repeat")
            images = result["pages"][0]["images"]
            self.assertEqual(len(images), 2)
            self.assertNotEqual(images[0]["id"], images[1]["id"])

    def test_soft_mask_color_and_rotated_placement_match_source(self):
        for rotate in (0, 90):
            with self.subTest(rotate=rotate), tempfile.TemporaryDirectory() as directory:
                image = Image.open(io.BytesIO(raster())).convert("RGBA")
                image.putalpha(Image.open(io.BytesIO(raster("L"))))
                buffer = io.BytesIO()
                image.save(buffer, "PNG")
                document = fitz.open()
                page = document.new_page(width=300, height=300)
                box = fitz.Rect(50, 50, 150, 150)
                page.insert_image(box, stream=buffer.getvalue(), rotate=rotate)
                reference_pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=box, alpha=False)
                reference = Image.frombytes("RGB", (200, 200), reference_pixmap.samples)
                path = str(Path(directory) / "mask.pdf")
                document.save(path)
                result = extract_pdf(path, str(Path(directory) / "extract"))
                actual = Image.open(result["pages"][0]["images"][0]["path"]).convert("RGB").resize((200, 200))
                self.assertLess(max(ImageStat.Stat(ImageChops.difference(actual, reference)).mean), 3)

    def test_restores_omitted_image_with_explicit_review_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory)
            images = result["pages"][0]["images"]
            soup = BeautifulSoup("<section><p>Original text.</p></section>", "html.parser")
            recovered = embed_page_images(soup, images)
            self.assertEqual(recovered, [images[0]["id"]])
            self.assertEqual(soup.img["data-remedy-image-review"], "true")
            self.assertIn("require review", soup.img["alt"])
            self.assertIn("width: 100.000pt", soup.img["style"])
            self.assertIn("Original text.", soup.get_text())
            output = str(Path(directory) / "output.pdf")
            HTML(string=str(soup)).write_pdf(output)
            validate_rendered_images(str(soup), output)
            blank = str(Path(directory) / "blank.pdf")
            HTML(string="<p>No image</p>").write_pdf(blank)
            with self.assertRaisesRegex(ValueError, "lost or altered"):
                validate_rendered_images(str(soup), blank)

    def test_unknown_reference_and_missing_image_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory)
            images = result["pages"][0]["images"]
            for html in ['<img src="cid:unknown">', '<figure data-alt="Unknown"></figure>']:
                with self.subTest(html=html), self.assertRaisesRegex(ValueError, "Image-preservation"):
                    embed_page_images(BeautifulSoup(html, "html.parser"), images)
            os.unlink(images[0]["path"])
            with self.assertRaises(OSError):
                embed_page_images(BeautifulSoup("<p>Text</p>", "html.parser"), images)

    def test_duplicate_model_reference_is_repaired_without_losing_source_caption(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory)
            images = result["pages"][0]["images"]
            image_id = images[0]["id"]
            soup = BeautifulSoup(
                f'<section><figure><img src="cid:{image_id}" alt="Original gradient"></figure>'
                f'<figure data-bbox="0,0,1000,1000"><img src="cid:{image_id}" alt="Repeated gradient">'
                '<figcaption>Source caption.</figcaption></figure><p>Body text.</p></section>',
                "html.parser",
            )
            embed_page_images(soup, images)
            normalize_figures(soup, "Source caption. Body text.")
            self.assertEqual(len(soup.find_all("img")), 1)
            self.assertEqual(soup.img["alt"], "Original gradient")
            self.assertEqual(soup.img["data-remedy-image-review"], "true")
            self.assertIn("Source caption.", soup.get_text())
            self.assertIn("Body text.", soup.get_text())
            self.assertTrue(all(f.find("img") for f in soup.find_all("figure")))
            output = str(Path(directory) / "deduplicated.pdf")
            HTML(string=str(soup)).write_pdf(output)
            validate_rendered_images(str(soup), output)
            with fitz.open(output) as pdf:
                self.assertEqual(sum(len(p.get_image_info()) for p in pdf), 1)

    def test_repair_keeps_real_repeat_and_recovers_omitted_id(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory, "repeat")
            images = result["pages"][0]["images"]
            image_id = images[0]["id"]
            for same_figure in (True, False):
                duplicate = f'<img src="cid:{image_id}" alt="Generated description">'
                html = (f'<figure><img src="cid:{image_id}" alt="Logo">{duplicate}</figure>'
                        if same_figure else
                        f'<figure><img src="cid:{image_id}" alt="Logo"></figure>'
                        f'<figure>{duplicate}<figcaption>Generated description</figcaption></figure>')
                soup = BeautifulSoup(html, "html.parser")
                recovered = embed_page_images(soup, images)
                normalize_figures(soup, "")
                self.assertEqual(recovered, [images[1]["id"]])
                self.assertEqual([img["data-remedy-image-id"] for img in soup.find_all("img")],
                                 [image["id"] for image in images])
                self.assertEqual(soup.get_text(strip=True), "")
                output = str(Path(directory) / "repeated.pdf")
                HTML(string=str(soup)).write_pdf(output)
                validate_rendered_images(str(soup), output)
                with fitz.open(output) as pdf:
                    self.assertEqual(sum(len(p.get_image_info()) for p in pdf), 2)

    def test_corrupt_inventory_and_forged_repair_marker_still_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory)
            images = result["pages"][0]["images"]
            with self.assertRaisesRegex(ValueError, "duplicate source image IDs"):
                embed_page_images(BeautifulSoup("", "html.parser"), images + images)
            with self.assertRaisesRegex(ValueError, "Image-preservation"):
                embed_page_images(BeautifulSoup(
                    '<figure data-remedy-duplicate-image="true">Missing image</figure>',
                    "html.parser"), images)

    def test_actual_standard_and_large_renderers_accept_repaired_duplicates(self):
        # Execute the exact standard route's Python template, not a copied
        # approximation, and the shared large-document PDF/Word preparation.
        import pikepdf
        from docx import Document
        from large_document_word import render_word
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory, "repeat")
            page = result["pages"][0]
            image_id = page["images"][0]["id"]
            payload = {
                "title": "Duplicate-reference regression fixture",
                "pages": [{
                    "html": '<section><h1>Regression fixture</h1><p>Body text.</p>'
                            f'<figure><img src="cid:{image_id}" alt="Gradient"></figure>'
                            f'<figure><img src="cid:{image_id}" alt="Repeated gradient">'
                            '<figcaption>Source caption.</figcaption></figure></section>',
                    "images": page["images"], "sourceText": "Body text. Source caption.",
                    "screenshot": page["screenshot"], "pageWidth": 300, "pageHeight": 300,
                    "pageNum": 1,
                }],
            }
            template = subprocess.run(["node", "-e", """
const fs = require('fs');
const source = fs.readFileSync('server/routes.ts', 'utf8');
const start = source.indexOf('const pyPdf = `');
if (start < 0) throw Error('Standard renderer template not found');
const valueStart = source.indexOf('`', start);
const end = source.indexOf('\\n`;', valueStart);
if (end < 0) throw Error('Standard renderer template end not found');
process.stdout.write(JSON.stringify(new Function('return ' + source.slice(valueStart, end + 2))()));
"""], cwd=ROOT, capture_output=True, text=True, check=True)
            standard = Path(directory) / "standard.py"
            standard.write_text(json.loads(template.stdout))
            pipeline = ROOT / "server/pdf_pipelines"
            for label, script in (("standard", standard),
                                  ("large", pipeline / "large_document_render.py")):
                output = Path(directory) / f"{label}.pdf"
                rendered = subprocess.run([sys.executable, str(script), str(output), str(pipeline)],
                    input=json.dumps(payload), text=True, capture_output=True, timeout=60)
                self.assertEqual(rendered.returncode, 0, rendered.stderr)
                with fitz.open(output) as pdf:
                    self.assertEqual(sum(len(p.get_image_info()) for p in pdf), 2)
                    self.assertIn("Body text.", "".join(p.get_text() for p in pdf))
                    self.assertIn("Source caption.", "".join(p.get_text() for p in pdf))
                with pikepdf.open(output) as pdf:
                    self.assertIn("/StructTreeRoot", pdf.Root)
            prepared = Path(directory) / "prepared.html"
            payload["prepareOnly"] = True
            preparation = subprocess.run([sys.executable, str(pipeline / "large_document_render.py"),
                str(prepared), str(pipeline)], input=json.dumps(payload), text=True,
                capture_output=True, timeout=60)
            self.assertEqual(preparation.returncode, 0, preparation.stderr)
            word = Path(directory) / "large.docx"
            render_word(prepared.read_text(), word, payload["title"])
            self.assertEqual(len(Document(word).inline_shapes), 2)

    def test_vector_figure_uses_real_crop_not_placeholder(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.extract(directory)
            page = result["pages"][0]
            soup = BeautifulSoup(
                '<figure data-alt="Artwork" data-bbox="166.667,166.667,500,500"></figure>',
                "html.parser",
            )
            embed_page_images(soup, [], page["screenshot"], 300, 300)
            normalize_figures(soup, "")
            image = Image.open(io.BytesIO(base64.b64decode(soup.img["src"].split(",")[1])))
            self.assertGreater(min(image.size), 100)
            self.assertEqual(soup.img["alt"], "Artwork")
            self.assertEqual(soup.get_text(), "")
            for bbox in ("", "nan,0,100,100", "-1,0,10,10", "500,0,100,100"):
                with self.subTest(bbox=bbox), self.assertRaisesRegex(ValueError, "valid source-page crop"):
                    embed_page_images(BeautifulSoup(f'<figure data-bbox="{bbox}"></figure>', "html.parser"),
                        [], page["screenshot"], 300, 300)

    def test_caption_normalizer_cannot_reintroduce_blank_figures(self):
        with self.assertRaisesRegex(ValueError, "no actual image"):
            normalize_figures(BeautifulSoup("<figure>Missing</figure>", "html.parser"), "")

    def test_validator_detects_color_change_with_identical_image_samples(self):
        with tempfile.TemporaryDirectory() as directory:
            html = '<img alt="Gradient" src="data:image/png;base64,' + base64.b64encode(raster("L")).decode() + '">'
            output = str(Path(directory) / "normal.pdf")
            HTML(string=html).write_pdf(output)
            validate_rendered_images(html, output)
            document = fitz.open(output)
            xref = document[0].get_images()[0][0]
            digest_before = document[0].get_image_info(hashes=True)[0]["digest"]
            function = document.get_new_xref()
            document.update_object(function, "<< /FunctionType 2 /Domain [0 1] "
                "/C0 [0 0 0 0] /C1 [0 0 0 1] /N 1 >>")
            document.xref_set_key(xref, "ColorSpace", f"[/DeviceN [/Black] /DeviceCMYK {function} 0 R]")
            inverted = str(Path(directory) / "inverted.pdf")
            document.save(inverted)
            document.close()
            with fitz.open(inverted) as bad:
                self.assertEqual(digest_before, bad[0].get_image_info(hashes=True)[0]["digest"])
            with self.assertRaisesRegex(ValueError, "lost or altered"):
                validate_rendered_images(html, inverted)


if __name__ == "__main__":
    unittest.main()
