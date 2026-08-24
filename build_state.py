#!/usr/bin/env python3
"""
Generalized version of build.py for the extra inbox-state snapshots
(list / row-selected / ticket-open). Each source .mhtml gets its own
self-contained output folder under prototype/states/<slug>/ with its
own index.html + assets/, since each capture is a separate page load
with its own asset hashes.

Usage: python3 build_state.py
(edit SOURCES below to add more snapshots later)
"""
import email
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(ROOT, "..")

SOURCES = [
    ("Inbox - Serviceform - list.mhtml", "list"),
    ("Inbox - Serviceform - selected.mhtml", "selected"),
    ("Inbox - Serviceform - open ticket.mhtml", "open-ticket"),
]

# States that get the redesigned ticket-list row (icon -> hover checkbox ->
# selected checkbox). Per the design brief this is the "List" state only.
ROW_STYLE_V2_SLUGS = {"list"}

# Domains that are unrelated third-party noise picked up by the page
# capture (a call-widget iframe and a couple of browser-extension
# overlays) -- never worth extracting.
EXCLUDED_LOCATION_PREFIXES = (
    "https://workspace.aircall.io",
    "chrome-extension://",
)


def walk(m):
    if m.is_multipart():
        for p in m.get_payload():
            yield from walk(p)
    else:
        yield m


def sniff_image_ext(data, content_type):
    if content_type == "image/svg+xml":
        return "svg"
    if content_type == "image/x-icon":
        return "ico"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return "bin"


def classify_css(data):
    """Best-effort friendly filename for a CSS blob, based on content
    fingerprints rather than the (per-capture-random) cid/hash it came
    in under -- keeps the same real chunk recognizable across snapshots."""
    if len(data) > 1_000_000:
        # The full bundled app stylesheet is large enough to contain
        # near-random substring matches for the smaller fragments' marker
        # strings below (e.g. it repeats the same keyframes) -- check size
        # first so it isn't misclassified as one of them.
        return "app-main.css"
    head = data[:4000]
    if b"--gray-1:" in head or b"--gray-a1:" in head:
        return "radix-ui-theme.css"
    if b"data-sonner-toaster" in head:
        return "sonner-toast.css"
    if b"ActivityLog_list" in data:
        return "app-activity-log.css"
    if b".image-uploading" in data:
        return "app-image-upload.css"
    if b".ql-container" in head:
        return "app-editor.css"
    if b"chrome-extension://" in data and b"@font-face" in data:
        return "fonts.css"
    if head.startswith(b'@charset "utf-8";\n\nhtml { font-family: Inter'):
        return "base-font.css"
    if b"resolveCountdown" in data:
        return "misc-keyframes.css"
    if b"go2264125279" in data:
        return "toast-animations.css"
    if b"@keyframes spin" in head and len(data) < 300:
        return "spin-keyframe.css"
    return None  # caller falls back to a numbered name


def build_one(mhtml_name, slug):
    src_path = os.path.join(PROJECT_ROOT, mhtml_name)
    out_dir = os.path.join(ROOT, "states", slug)
    css_dir = os.path.join(out_dir, "assets", "css")
    img_dir = os.path.join(out_dir, "assets", "img")
    os.makedirs(css_dir, exist_ok=True)
    os.makedirs(img_dir, exist_ok=True)

    with open(src_path, "rb") as f:
        msg = email.message_from_binary_file(f)
    parts = list(walk(msg))

    main_part = parts[0]
    assert main_part.get_content_type() == "text/html"
    html = main_part.get_payload(decode=True).decode("utf-8")
    original_html = html  # only pull in resources this document actually references

    def referenced(loc, cid):
        if loc and (loc in original_html or loc.replace("&", "&amp;") in original_html):
            return True
        if cid and f'cid:{cid.strip("<>")}' in original_html:
            return True
        return False

    used_css_names = set()
    used_img_names = set()
    replacements = []  # (original_string, local_relative_path)
    css_counter = 0
    img_counter = 0

    for part in parts[1:]:
        loc = part.get("Content-Location", "") or ""
        cid = part.get("Content-ID", "") or ""
        if any(loc.startswith(p) for p in EXCLUDED_LOCATION_PREFIXES):
            continue
        # A handful of CSS/image parts belong to nested third-party iframes
        # (the Aircall widget, a couple of browser-extension overlays) but
        # carry a bare `cid:` Content-Location of their own rather than an
        # identifiable domain, so the prefix check above can't catch them.
        # They were never linked from *this* document, so skip anything our
        # own (pre-rewrite) HTML doesn't actually reference.
        if not referenced(loc, cid):
            continue

        ctype = part.get_content_type()
        data = part.get_payload(decode=True)
        if data is None:
            continue

        if ctype == "text/css":
            name = classify_css(data)
            if name is None or name in used_css_names:
                css_counter += 1
                name = f"inline-{css_counter}.css"
            used_css_names.add(name)
            if name == "fonts.css":
                data = re.sub(
                    rb"@font-face\s*\{[^}]*chrome-extension://[^}]*\}\s*", b"", data
                ).strip() + b"\n"
            with open(os.path.join(css_dir, name), "wb") as f:
                f.write(data)
            local = f"assets/css/{name}"
        elif ctype in ("image/png", "image/svg+xml", "image/x-icon", "application/octet-stream"):
            ext = sniff_image_ext(data, ctype)
            img_counter += 1
            name = f"img-{img_counter}.{ext}"
            used_img_names.add(name)
            with open(os.path.join(img_dir, name), "wb") as f:
                f.write(data)
            local = f"assets/img/{name}"
        else:
            # text/html frames from other origins we haven't excluded,
            # or anything unexpected -- skip, nothing else shows up today.
            continue

        if loc:
            replacements.append((loc, local))
        cid = part.get("Content-ID", "")
        if cid:
            replacements.append((f"cid:{cid.strip('<>')}", local))

    for original, local in replacements:
        html = html.replace(f'"{original}"', f'"{local}"')
        html = html.replace(original, local)
        html = html.replace(original.replace("&", "&amp;"), local)

    # Neutralize the (already-hidden) Aircall call-widget iframe and drop
    # the invisible browser-extension utility iframes entirely -- both are
    # unrelated to the inbox itself. Identify them dynamically by their
    # Content-Location rather than hardcoding per-capture cid values.
    for part in parts[1:]:
        loc = part.get("Content-Location", "") or ""
        cid = (part.get("Content-ID", "") or "").strip("<>")
        if not cid:
            continue
        if loc.startswith("https://workspace.aircall.io/login"):
            html = re.sub(
                rf'src="cid:{re.escape(cid)}"',
                'src="about:blank" data-note="Aircall workspace iframe stubbed out for the prototype"',
                html,
            )
        elif loc.startswith("chrome-extension://"):
            html = re.sub(
                rf'<iframe[^>]*src="cid:{re.escape(cid)}"[^>]*></iframe>', "", html
            )

    font_link = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400..700;1,400..700&'
        'family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">'
    )
    html = html.replace("<title", font_link + "<title", 1)
    html = html.replace(
        "</head>", '<link rel="stylesheet" href="../../assets/css/prototype.css">\n</head>', 1
    )
    html = html.replace(
        "</body>", '<script src="../../assets/js/app.js" defer></script>\n</body>', 1
    )

    # The redesigned list-item (icon -> hover checkbox -> selected checkbox,
    # see app.js) only applies where this attribute is present -- today
    # that's just the "List" state, per the design brief.
    if slug in ROW_STYLE_V2_SLUGS:
        html = re.sub(r"<body([ >])", r'<body data-row-style="v2"\1', html, count=1)

    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[{slug}] wrote index.html ({len(html)} bytes), "
          f"{len(used_css_names)} css files, {img_counter} images")


if __name__ == "__main__":
    for mhtml_name, slug in SOURCES:
        build_one(mhtml_name, slug)
