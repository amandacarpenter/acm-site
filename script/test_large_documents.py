"""Offline end-to-end checks, explicitly WITHOUT AI accessibility remediation."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import zipfile
import resource
import pymupdf as fitz
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "server/pdf_pipelines"
sys.path.insert(0, str(PIPE))
from large_document_word import render_word
from large_document_worker import namespace_and_links, sanitize_model_markup

QA = Path("/tmp/remedy-large-docs-qa")
QA.mkdir(exist_ok=True)
CATALOG = Path("/home/user/.perplexity/attachments/a1c18123306e45609596b4a778c566db/SCC_2026_2027_Catalog.pdf")


def fixtures():
    with fitz.open(CATALOG) as original:
        sample = fitz.open()
        for page in [0, 4, 5]:
            sample.insert_pdf(original, from_page=page, to_page=page)
        sample.save(QA / "catalog-cover-portrait-map.pdf")
    document = fitz.open()
    for n in range(61):
        page = document.new_page()
        page.insert_text((60, 60), f"Unique source marker {n+1:03d}")
        page.insert_text((60, 85), "Sample content for section order and recovery.")
    document[0].insert_link({"kind": fitz.LINK_GOTO, "from": fitz.Rect(60, 50, 220, 65), "page": 60})
    document.save(QA / "61-pages.pdf")
    for name, count, encrypted in [("over-limit.pdf", 401, False), ("encrypted.pdf", 1, True)]:
        d = fitz.open()
        for _ in range(count):
            d.new_page()
        kwargs = dict(encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="test-owner", user_pw="test-user") if encrypted else {}
        d.save(QA / name, **kwargs)


def worker(directory, mode="pdf", fail=None):
    options = dict(title="Large-document workflow test", mode=mode, fake=True, chunkSize=20)
    if fail:
        options["failAfterSection"] = fail
    start = time.monotonic()
    result = subprocess.run([sys.executable, str(PIPE / "large_document_worker.py"), str(directory)],
        input=json.dumps(options), text=True, capture_output=True, timeout=1800)
    (directory / f"worker-{mode}.log").write_text(result.stdout + result.stderr)
    return result, round(time.monotonic() - start, 1)


def check_output(directory, expected):
    pdf = fitz.open(directory / "result.pdf")
    text = "".join(p.get_text() for p in pdf)
    assert "WORKFLOW TEST ONLY" in text
    import pikepdf
    with pikepdf.open(directory / "result.pdf") as structure:
        assert structure.Root.get("/StructTreeRoot")
        assert structure.Root.MarkInfo.Marked
    with zipfile.ZipFile(directory / "result.docx") as archive:
        xml = etree.fromstring(archive.read("word/document.xml"))
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
              "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"}
        bookmarks = [b.get("{"+ns["w"]+"}name") for b in xml.findall(".//w:bookmarkStart", ns)]
        assert all(f"source_page_{n}" in bookmarks for n in range(1, expected+1))
        assert len(bookmarks) == len(set(bookmarks))
        assert all(d.get("descr") for d in xml.findall(".//wp:docPr", ns))
        word_text = " ".join(xml.itertext())
        if expected == 61:
            for n in range(1, 62):
                assert f"Unique source marker {n:03d}" in text
                assert f"Unique source marker {n:03d}" in word_text
            assert "source_page_61" in [a.get("{"+ns["w"]+"}anchor") for a in xml.findall(".//w:hyperlink", ns)]
    return dict(pdfPages=len(pdf), sourcePages=expected, pdfBytes=(directory/"result.pdf").stat().st_size,
                wordBytes=(directory/"result.docx").stat().st_size)


def main():
    fixtures()
    if "--fixtures-only" in sys.argv:
        return
    results = {}
    for name in ["over-limit.pdf", "encrypted.pdf"]:
        r = subprocess.run([sys.executable, str(PIPE / "large_document_worker.py"), "inspect", str(QA/name)], capture_output=True)
        assert r.returncode != 0
    # Native spans, header rows, images and cross-page destinations.
    assert "url(" not in str(sanitize_model_markup('<p style="background:url(file:///etc/passwd)" onclick="x()">Safe</p>'))
    render_word('<section id="source_page_1"><h1>Test\x01 title</h1><table><thead><tr><th>A</th><th>B</th></tr></thead>'
                '<tbody><tr><td rowspan="2">One</td><td>Two</td></tr><tr><td>Three</td></tr></tbody></table>'
                '<p><a href="#source_page_2">Continue</a></p></section><section id="source_page_2"><h2>Next</h2></section>',
                QA/"native-table.docx", "Native table test")
    for name, source, count in [("recovery", QA/"61-pages.pdf", 61), ("catalog", CATALOG, 374)]:
        directory = QA/name
        shutil.rmtree(directory, ignore_errors=True)
        directory.mkdir()
        shutil.copyfile(source, directory/"source.pdf")
        if name == "recovery":
            interrupted, _ = worker(directory, fail=1)
            assert interrupted.returncode == 1 and "Injected workflow-test interruption" in interrupted.stdout
            checkpoint = directory/"sections/0000-0020.html"
            stamp = checkpoint.stat().st_mtime_ns
        pdf, seconds = worker(directory)
        assert pdf.returncode == 0, pdf.stdout[-1000:] + pdf.stderr[-1000:]
        if name == "recovery":
            assert checkpoint.stat().st_mtime_ns == stamp, "Reprocessed a completed section"
        word, word_seconds = worker(directory, "docx")
        assert word.returncode == 0, word.stdout[-1000:] + word.stderr[-1000:]
        results[name] = {**check_output(directory, count), "pdfSeconds": seconds, "wordAssemblySeconds": word_seconds}
        print(json.dumps({name: results[name]}), flush=True)
    results["peakChildRssKiB"] = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
    (QA/"results.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
