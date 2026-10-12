"""Inventory active DOCX pictures, ignoring duplicate AlternateContent fallbacks.
Reads DOCX bytes on stdin; never extracts ZIP paths or fetches external resources.
"""
import sys, io, json, hashlib, posixpath
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from PIL import Image, ImageOps

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
      "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006"}
def local(e): return e.tag.rsplit("}", 1)[-1]
def active(e):
    if local(e) == "AlternateContent":
        branch = e.find("mc:Choice", NS)
        if branch is None: branch = e.find("mc:Fallback", NS)
        if branch is not None: yield from active(branch)
    else:
        yield e
        for c in e: yield from active(c)

def manifest(payload):
    images = []
    with ZipFile(io.BytesIO(payload)) as z:
        if sum(i.file_size for i in z.infolist()) > 100 * 1024 * 1024:
            raise ValueError("Expanded Word document exceeds the safe processing limit.")
        for name in z.namelist():
            if name.startswith("word/") and name.endswith(".xml") and name.split("/")[-1].startswith(("header", "footer", "footnotes", "endnotes")):
                if any(local(e) in ("blip", "imagedata") for e in active(ET.fromstring(z.read(name)))):
                    raise ValueError("Images in headers, footers, or notes are not yet supported. No image-preserving output was generated.")
        root = ET.fromstring(z.read("word/document.xml"))
        if any(local(e) in ("chart", "relIds", "OLEObject") for e in active(root)):
            raise ValueError("Embedded charts, SmartArt, or objects need manual review. Convert them to embedded pictures before using image-preserving remediation.")
        parents = {c:p for p in root.iter() for c in p}
        relationships = {e.get("Id"):e for e in ET.fromstring(z.read("word/_rels/document.xml.rels"))}
        for e in active(root):
            if local(e) not in ("blip", "imagedata"): continue
            rid = e.get("{%s}embed" % NS["r"]) or e.get("{%s}id" % NS["r"])
            rel = relationships.get(rid)
            if rel is None or rel.get("TargetMode") == "External":
                raise ValueError("A linked/external Word image cannot be preserved safely. Embed it in Word and try again.")
            target = posixpath.normpath(posixpath.join("word", rel.get("Target", "")))
            if not target.startswith("word/"): raise ValueError("Invalid image relationship.")
            raw = z.read(target)
            ancestor, picture, drawing = e, None, None
            while ancestor in parents:
                ancestor = parents[ancestor]
                if local(ancestor) == "pic" and picture is None: picture = ancestor
                if local(ancestor) in ("drawing", "pict"):
                    drawing = ancestor
                    break
            container = picture if picture is not None else drawing
            alt = ""
            if drawing is not None:
                props = drawing.find(".//wp:docPr", NS)
                if props is not None: alt = props.get("descr") or props.get("title") or ""
            crop = container.find(".//a:srcRect", NS) if container is not None else None
            transform = container.find(".//a:xfrm", NS) if container is not None else None
            with Image.open(io.BytesIO(raw)) as im:
                if im.width * im.height > 40_000_000: raise ValueError("Word image exceeds the safe pixel limit.")
                if getattr(im, "n_frames", 1) > 1: raise ValueError("Animated Word images need manual review; refusing to flatten them silently.")
                im.load()
                fmt, converted = im.format, False
                if fmt not in ("PNG", "JPEG"): converted = True
                if crop is not None and any(int(v) for v in crop.attrib.values()):
                    vals = [int(crop.get(k, "0")) / 100000 for k in ("l", "t", "r", "b")]
                    if any(v < 0 or v >= 1 for v in vals) or vals[0]+vals[2] >= 1 or vals[1]+vals[3] >= 1:
                        raise ValueError("Unsupported image crop; refusing to change the picture silently.")
                    im = im.crop((round(im.width*vals[0]), round(im.height*vals[1]),
                                  round(im.width*(1-vals[2])), round(im.height*(1-vals[3]))))
                    converted = True
                if transform is not None:
                    if transform.get("flipH") in ("1", "true"): im = ImageOps.mirror(im); converted = True
                    if transform.get("flipV") in ("1", "true"): im = ImageOps.flip(im); converted = True
                    angle = int(transform.get("rot", "0")) / 60000
                    if angle: im = im.rotate(-angle, expand=True); converted = True
                width, height = im.size
                ext = transform.find("a:ext", NS) if transform is not None else None
                if ext is None and drawing is not None: ext = drawing.find(".//wp:extent", NS)
                if ext is not None:
                    width, height = float(ext.get("cx", "0"))/9525, float(ext.get("cy", "0"))/9525
                if width <= 0 or height <= 0: width, height = im.size
                scale = min(1, 624/width, 720/height)
                if converted:
                    out = io.BytesIO(); im.save(out, format="PNG"); data, mime = out.getvalue(), "image/png"
                else: data, mime = raw, "image/png" if fmt == "PNG" else "image/jpeg"
            import base64
            images.append({"sourceHash":hashlib.sha256(raw).hexdigest(), "data":base64.b64encode(data).decode(),
                           "mime":mime, "width":max(1,round(width*scale)), "height":max(1,round(height*scale)),
                           "alt":alt.strip(), "transformed":converted})
            if len(images) > 500 or sum(len(i["data"]) for i in images) > 64 * 1024 * 1024:
                raise ValueError("Embedded images exceed the safe processing limit. Split the document into smaller sections.")
    return images

if __name__ == "__main__":
    try: print(json.dumps(manifest(sys.stdin.buffer.read())))
    except Exception as e:
        print("Word image preservation stopped: "+str(e), file=sys.stderr)
        sys.exit(1)
