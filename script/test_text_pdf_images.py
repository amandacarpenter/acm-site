"""Image-placement regression tests for the shared HTML-to-PDF renderer."""
import base64
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class TextPdfImageTests(unittest.TestCase):
    def render(self, html, directory):
        output = Path(directory) / "result.pdf"
        result = subprocess.run(
            ["python3", str(ROOT / "server/pdf_pipelines/text_pdf_tag.py"), str(output)],
            input=json.dumps({"html": html, "title": "Image regression"}),
            capture_output=True, text=True, timeout=60,
        )
        return result, output

    def test_repeated_pictures_and_font_symbol(self):
        buffer = io.BytesIO()
        Image.new("RGB", (400, 200), "#01696f").save(buffer, format="PNG")
        src = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
        picture = f'<img src="{src}" width="120" height="60" alt="Teal test picture">'
        with tempfile.TemporaryDirectory() as directory:
            result, output = self.render(
                "<h1>Picture preservation</h1><p>Calendar symbol: 📅</p>"
                + f"<p>{picture}</p><p>{picture}</p>"
                + f"<table><tr><th>Picture</th></tr><tr><td>{picture}</td></tr></table>",
                directory,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            with fitz.open(output) as pdf:
                pictures = [item for page in pdf for item in page.get_image_info()
                            if item["width"] == 400 and item["height"] == 200]
                self.assertEqual(len(pictures), 3)
                for item in pictures:
                    self.assertLessEqual(fitz.Rect(item["bbox"]).width, 91)

    def test_external_image_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.render('<p><img src="https://example.invalid/image.png"></p>', directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("external or unsupported images are blocked", result.stderr)

    def test_seven_column_table_uses_landscape_and_contains_long_words(self):
        row = "<tr>" + "".join("<td><p>" + ("LongWord" * 12) + "</p></td>" for _ in range(7)) + "</tr>"
        with tempfile.TemporaryDirectory() as directory:
            result, output = self.render("<h2>Schedule</h2><table>" + row * 4 + "</table>", directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            with fitz.open(output) as pdf:
                self.assertTrue(any(page.rect.width > page.rect.height for page in pdf))
                for page in pdf:
                    for block in page.get_text("blocks"):
                        self.assertLessEqual(block[2], page.rect.width - 20)

    def test_invalid_embedded_image_is_not_silently_omitted(self):
        with tempfile.TemporaryDirectory() as directory:
            result, _ = self.render('<p><img src="data:image/png;base64,aW52YWxpZA==" alt="Bad data"></p>', directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("image-preservation check failed", result.stderr)


if __name__ == "__main__":
    unittest.main()
