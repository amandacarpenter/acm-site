#!/usr/bin/env python3
"""Contract check for user-selected Remedy Docs output routing."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTES = (ROOT / "server" / "routes.ts").read_text(encoding="utf-8")


def main() -> None:
    required = [
        'explicitMode === "pdf" || explicitMode === "docx"',
        'route = { useVision: false, reason: `explicit-mode-${explicitMode}` }',
        'route = await detectDocsRoute(req.file.buffer, ext)',
        '"2026-08-21-explicit-output-route-v3r1"',
    ]
    for text in required:
        assert text in ROUTES, f"missing explicit-routing contract: {text}"

    explicit_branch = ROUTES.index(
        'if (explicitMode === "pdf" || explicitMode === "docx")'
    )
    detector_call = ROUTES.index(
        "route = await detectDocsRoute(req.file.buffer, ext)", explicit_branch
    )
    else_branch = ROUTES.index("} else {", explicit_branch)
    assert else_branch < detector_call, (
        "content detection must run only when no explicit output mode is supplied"
    )

    assert 'if (explicitMode === "docx" && route.useVision)' not in ROUTES
    assert '"blocked-complex-docx"' not in ROUTES
    print("explicit output routing contract: PASS")


if __name__ == "__main__":
    main()
