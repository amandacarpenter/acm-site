"""Normalize heading tag levels without altering page content or image assets."""
import re
import pikepdf


def normalize_heading_tags(root):
    stack = []
    changed = 0
    def visit(node):
        nonlocal changed
        if isinstance(node, pikepdf.Array):
            for child in node:
                visit(child)
        elif isinstance(node, pikepdf.Dictionary):
            match = re.fullmatch(r"/H([1-6])", str(node.get("/S", "")))
            if match:
                source = int(match[1])
                while stack and stack[-1][0] >= source:
                    stack.pop()
                output = min(6, (stack[-1][1] if stack else 0) + 1)
                stack.append((source, output))
                if source != output:
                    node["/S"] = pikepdf.Name(f"/H{output}")
                    changed += 1
            if "/K" in node:
                visit(node["/K"])
    visit(root)
    return changed
