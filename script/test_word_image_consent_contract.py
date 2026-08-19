#!/usr/bin/env python3
"""Regression checks for consent-gated complex PDF to Word conversion."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTES = (ROOT / "server" / "routes.ts").read_text(encoding="utf-8")
TOOLS = (ROOT / "client" / "src" / "pages" / "ToolsPage.tsx").read_text(
    encoding="utf-8"
)

server_requirements = [
    'req.body?.mode === "docx"',
    'req.body?.allowImageRemoval === "true"',
    'code: "COMPLEX_PDF_REQUIRES_PDF"',
    'code: "INTERACTIVE_PDF_REQUIRES_PDF"',
    'code: "WORD_TEXT_UNAVAILABLE"',
    '"blocked-native-form-docx"',
    'rawText.trim().length < Math.max(80, 80 * docPageCount)',
    '"X-Remedy-Docs-Images-Removed", "true"',
    '"fast-docx-images-removed"',
    "&& !allowImageRemoval",
    "return handleDocumentFix(req, res);",
    "route.preserveNative && !allowImageRemoval",
    "route.preserveNative && allowImageRemoval",
    "const routeWasChecked = res.locals.remedyDocsRouteChecked === true",
    '(!routeWasChecked || req.body?.mode === "docx")',
    "if (isPdfWordRequest && !allowImageRemoval && !routeWasChecked)",
    "const route = await detectDocsRoute(req.file.buffer, ext)",
    "res.locals.remedyDocsRouteChecked = true",
    '"X-Remedy-Docs-Form-Fields-Removed", "true"',
    '"fast-docx-form-fields-removed"',
    "2026-08-19-word-form-consent-v7",
]

client_requirements = [
    "PDF is needed to preserve this document",
    "I understand that the Word version will be text-only",
    "Any images will be removed",
    "Create Word without images",
    "No credits were used to show this choice.",
    'fd.append("allowImageRemoval", "true")',
    'resp.headers.get("X-Remedy-Docs-Images-Removed") === "true"',
    "Word conversion completed in text-only mode",
    'data-testid="checkbox-word-image-removal"',
    'data.code === "INTERACTIVE_PDF_REQUIRES_PDF"',
    'setWordConversionConsentKind("interactive-form")',
    "PDF is needed to preserve the form fields",
    "Continue to Word",
    "Interactive form fields and any images were removed with your approval",
    'resp.headers.get("X-Remedy-Docs-Form-Fields-Removed") === "true"',
]

missing_server = [item for item in server_requirements if item not in ROUTES]
missing_client = [item for item in client_requirements if item not in TOOLS]

if missing_server or missing_client:
    raise AssertionError(
        f"Missing Word image-removal consent safeguards: "
        f"server={missing_server}, client={missing_client}"
    )

print("Word image-removal consent is enforced in the client and server.")
