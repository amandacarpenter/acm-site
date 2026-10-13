"""Run the real tagged-PDF renderer before AI work and during image builds."""
import base64
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz
import pikepdf
import weasyprint
import zxingcpp  # Fail the build if the Word QR-description dependency is absent.
from PIL import Image


def check():
    image = io.BytesIO()
    Image.new("RGB", (16, 8), "#0f766e").save(image, format="PNG")
    src = "data:image/png;base64," + base64.b64encode(image.getvalue()).decode()
    html = (
        '<h1>Renderer check</h1><p>Accessible document processing.</p>'
        f'<p><img src="{src}" width="16" height="8" alt="Test rectangle"></p>'
        '<table><tr><th scope="col">Check</th></tr><tr><td>Ready</td></tr></table>'
    )
    with tempfile.TemporaryDirectory(prefix="remedy-renderer-check-") as directory:
        output = Path(directory) / "check.pdf"
        result = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("text_pdf_tag.py")), str(output)],
            input=json.dumps({"html": html, "title": "Renderer check"}),
            capture_output=True, text=True, timeout=25,
        )
        if result.returncode:
            raise RuntimeError(result.stderr[-1600:] or f"Renderer exited {result.returncode}")
        with fitz.open(output) as pdf:
            if sum(len(page.get_image_info()) for page in pdf) != 1:
                raise RuntimeError("Renderer check did not preserve its embedded picture")
        with pikepdf.open(output) as pdf:
            if "/StructTreeRoot" not in pdf.Root:
                raise RuntimeError("Renderer check did not create a tagged structure")
    print(json.dumps({"status": "ok", "weasyprint": weasyprint.__version__, "image_preserved": True}))


if __name__ == "__main__":
    try:
        check()
    except Exception as error:
        print(f"PDF renderer self-check failed: {error}", file=sys.stderr)
        sys.exit(1)
