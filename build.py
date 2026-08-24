#!/usr/bin/env python3
"""
One-off build script: extracts the Serviceform Lite inbox snapshot out of
`../Inbox - Serviceform.mhtml` into a plain, editable HTML/CSS/JS prototype
in this folder. Not meant to be wired into any real build pipeline -- just
run once to (re)generate index.html + assets/ from the source .mhtml.
"""
import email
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
MHTML_PATH = os.path.join(ROOT, "..", "Inbox - Serviceform.mhtml")

with open(MHTML_PATH, "rb") as f:
    msg = email.message_from_binary_file(f)


def walk(m):
    if m.is_multipart():
        for p in m.get_payload():
            yield from walk(p)
    else:
        yield m


parts = list(walk(msg))


def find_part(pred):
    for p in parts:
        if pred(p):
            return p
    raise LookupError("part not found")


def loc_is(url):
    return lambda p: p.get("Content-Location", "") == url


# ---------------------------------------------------------------------------
# 1. Main document
# ---------------------------------------------------------------------------
main_part = find_part(
    lambda p: p.get_content_type() == "text/html"
    and "dash.serviceform.com/lite/inbox" in p.get("Content-Location", "")
)
html = main_part.get_payload(decode=True).decode("utf-8")

# ---------------------------------------------------------------------------
# 2. CSS assets -> assets/css/, with friendly names
# ---------------------------------------------------------------------------
CSS_DIR = os.path.join(ROOT, "assets", "css")
os.makedirs(CSS_DIR, exist_ok=True)

css_files = {
    # original URL/cid -> local filename
    "https://dash.serviceform.com/_next/static/css/e1691a30858e44b0.css": "app-main.css",
    "https://dash.serviceform.com/_next/static/css/8aee48eb52f4c731.css": "app-editor.css",
    "https://dash.serviceform.com/_next/static/css/6cc90be2462d4393.css": "app-image-upload.css",
    "https://dash.serviceform.com/_next/static/css/6524556eeba886f8.css": "app-activity-log.css",
    "cid:css-a3591ee9-95e2-4b35-a80d-18c65ab75a80@mhtml.blink": "base-font.css",
    "cid:css-b5533838-762b-4884-b1f3-f3534525db5e@mhtml.blink": "toast-animations.css",
    "cid:css-0a55037b-884e-4c77-a642-0d3050c66aae@mhtml.blink": "fonts.css",
    "cid:css-ed1eba93-5ec0-4b66-9aa8-15c6a134ff7f@mhtml.blink": "misc-keyframes.css",
    "cid:css-7d793b6c-f746-495a-8495-2481efa69cb8@mhtml.blink": "spin-keyframe.css",
}

url_to_local = {}
for url, fname in css_files.items():
    part = find_part(loc_is(url))
    data = part.get_payload(decode=True)
    with open(os.path.join(CSS_DIR, fname), "wb") as f:
        f.write(data)
    url_to_local[url] = f"assets/css/{fname}"

# fonts.css references a browser extension's local font files
# (chrome-extension://.../font-*.woff2) that were captured by mistake --
# that extension injected fake @font-face rules into the live page. Strip
# them and load real Inter / Roboto Mono from Google Fonts instead.
fonts_css_path = os.path.join(CSS_DIR, "fonts.css")
with open(fonts_css_path, encoding="utf-8") as f:
    fonts_css = f.read()
fonts_css = re.sub(r'@font-face\s*\{[^}]*chrome-extension://[^}]*\}\s*', "", fonts_css)
with open(fonts_css_path, "w", encoding="utf-8") as f:
    f.write(fonts_css.strip() + "\n")

# ---------------------------------------------------------------------------
# 3. Image assets -> assets/img/
# ---------------------------------------------------------------------------
IMG_DIR = os.path.join(ROOT, "assets", "img")
os.makedirs(IMG_DIR, exist_ok=True)

img_files = {
    "https://www.serviceform.com/images/serviceform-logo-white.svg": "logo-white.svg",
    "https://dash.serviceform.com/favicon.ico": "favicon.ico",
    "https://firebasestorage.googleapis.com/v0/b/leadpixel-33e21.appspot.com/o/images%2FW2CsjbufdyPRhGRtIWRS7apq9023?alt=media&token=292480c4-ade9-44e7-ae57-19b246b96ebb": "avatar-1.jpg",
    "https://firebasestorage.googleapis.com/v0/b/leadpixel-33e21.appspot.com/o/images%2F85FD6bOA2XUDgZigjDQ2ggJbqMn2?alt=media&token=699fef02-0c48-4e50-bccf-c0421e9073b6": "avatar-2.jpg",
    "https://firebasestorage.googleapis.com/v0/b/leadpixel-33e21.appspot.com/o/images%2F3Pri4SFaKYQAVHzDB7qNWHiCtj52?alt=media&token=fd259fbe-5d5b-4418-8630-6c3d38004b93": "avatar-3.jpg",
}

for url, fname in img_files.items():
    part = find_part(loc_is(url))
    data = part.get_payload(decode=True)
    with open(os.path.join(IMG_DIR, fname), "wb") as f:
        f.write(data)
    url_to_local[url] = f"assets/img/{fname}"

# The inline chat attachment thumbnail carries a long, expiring signed-URL
# query string that isn't worth hardcoding -- match it by prefix instead.
chat_attachment_part = find_part(
    lambda p: p.get("Content-Location", "").startswith(
        "https://storage.googleapis.com/leadpixel-33e21.appspot.com/chat/attachments/"
    )
)
chat_attachment_url = chat_attachment_part.get("Content-Location")
with open(os.path.join(IMG_DIR, "chat-attachment.png"), "wb") as f:
    f.write(chat_attachment_part.get_payload(decode=True))
url_to_local[chat_attachment_url] = "assets/img/chat-attachment.png"

# ---------------------------------------------------------------------------
# 4. Rewrite the document
# ---------------------------------------------------------------------------
for url, local in url_to_local.items():
    html = html.replace(f'"{url}"', f'"{local}"')
    html = html.replace(url, local)
    # The same URLs also show up HTML-entity-escaped, inside inline
    # style="background:url(&quot;...&amp;token=...&quot;)" attributes.
    html = html.replace(url.replace("&", "&amp;"), local)

# The Aircall call-widget iframe would try to load a cid: URL that no
# longer resolves. The widget's outer container is already collapsed
# (opacity:0, visibility:hidden) in this snapshot, so just point the
# iframe somewhere inert instead of trying to rebuild the whole
# third-party workspace.
html = re.sub(
    r'src="cid:frame-67A2547DB433809AF59765A0ADF14BCF@mhtml\.blink"',
    'src="about:blank" data-note="Aircall workspace iframe stubbed out for the prototype"',
    html,
)

# Bring in real Inter / Roboto Mono instead of the extension-injected fonts.
font_link = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400..700;1,400..700&'
    'family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">'
)
html = html.replace("<title", font_link + "<title", 1)

# Hook in the prototype's own stylesheet + script, loaded after the real
# production CSS so devs can override/extend without touching app-main.css.
html = html.replace(
    "</head>",
    '<link rel="stylesheet" href="assets/css/prototype.css">\n</head>',
    1,
)
html = html.replace(
    "</body>",
    '<script src="assets/js/app.js" defer></script>\n</body>',
    1,
)

with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("Wrote index.html:", len(html), "bytes")
print("CSS files:", len(css_files))
print("Image files:", len(img_files))
