#!/usr/bin/env python3
"""Ensure native PDF helpers import silently and keep stdout JSON-safe."""

from __future__ import annotations

import contextlib
import importlib.util
import io
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server" / "pdf_pipelines"))
HELPERS = [
    "flyer_background_images.py",
    "flyer_extract_figures.py",
    "flyer_fix_annots.py",
    "flyer_fix_title.py",
    "flyer_orphan_figures.py",
]


class FlyerHelperImportTests(unittest.TestCase):
    def test_helpers_do_not_emit_stdout_on_import(self) -> None:
        for name in HELPERS:
            path = ROOT / "server" / "pdf_pipelines" / name
            stdout = io.StringIO()
            with self.subTest(helper=name), contextlib.redirect_stdout(stdout):
                spec = importlib.util.spec_from_file_location(path.stem, path)
                module = importlib.util.module_from_spec(spec)
                assert spec.loader is not None
                spec.loader.exec_module(module)
                self.assertEqual(stdout.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
