#!/usr/bin/env python3
"""
Combines everything already produced by build.py / build_state.py into
ONE self-contained inbox-prototype.html: all four captured states as
switchable panels, all CSS/JS/images inlined. No server, no asset
folder -- just open the file.

Run this AFTER build.py and build_state.py have (re)generated
index.html / states/*/index.html + their assets/.
"""
import base64
import mimetypes
import os
import re

from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.abspath(__file__))

STATES = [
    # slug, source index.html (relative to ROOT), css group ("dash" | "dev"), label
    ("baseline", "index.html", "dash", "Baseline"),
    ("list", "states/list/index.html", "dev", "1. List"),
    ("selected", "states/selected/index.html", "dev", "2. Row selected"),
    ("open-ticket", "states/open-ticket/index.html", "dev", "3. Ticket open"),
]

# States that get the redesigned ticket-list row (icon -> hover checkbox ->
# selected checkbox, see assets/js/app.js). Keep in sync with the same
# constant in build_state.py -- per the design brief this is "List" only.
ROW_STYLE_V2_SLUGS = {"list"}

# The only state actually shipped in the output (see main()): no more
# state-switcher tab bar, so there's nothing to enter on besides this one.
ENTRY_SLUG = "list"

CSS_GROUPS = {
    "dash": [
        "assets/css/base-font.css",
        "assets/css/fonts.css",
        "assets/css/misc-keyframes.css",
        "assets/css/spin-keyframe.css",
        "assets/css/toast-animations.css",
        "assets/css/app-editor.css",
        "assets/css/app-image-upload.css",
        "assets/css/app-activity-log.css",
        "assets/css/app-main.css",
    ],
    "dev": [
        "states/list/assets/css/base-font.css",
        "states/list/assets/css/fonts.css",
        "states/list/assets/css/misc-keyframes.css",
        "states/list/assets/css/toast-animations.css",
        "states/list/assets/css/sonner-toast.css",
        "states/list/assets/css/app-activity-log.css",
        "states/list/assets/css/app-main.css",
    ],
}

# ids in the captured DOM that are meant to be page-unique -- duplicated
# once per embedded state, so give each state's copy a unique suffix.
DEDUP_IDS = ["__next", "aircall-everywhere-phone", "__next-route-announcer__"]


def data_uri_for(path):
    ctype, _ = mimetypes.guess_type(path)
    ctype = ctype or "application/octet-stream"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{ctype};base64,{b64}"


def extract_panel(slug, rel_html_path):
    path = os.path.join(ROOT, rel_html_path)
    base_dir = os.path.dirname(path)
    html = open(path, encoding="utf-8").read()
    soup = BeautifulSoup(html, "html.parser")

    # Inline every local image this page references (img src, favicon
    # links, inline style="background:url(...)").
    local_img_paths = set()
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if src and not src.startswith(("http://", "https://", "data:")):
            local_img_paths.add(src)
    for link in soup.find_all("link"):
        href = link.get("href", "")
        if href and not href.startswith(("http://", "https://")) and re.search(r"\.(ico|png|svg|jpg|jpeg)$", href):
            local_img_paths.add(href)
    for tag in soup.find_all(style=True):
        for m in re.findall(r'url\(&quot;([^&]+)&quot;\)|url\("([^"]+)"\)|url\(([^)"\']+)\)', tag["style"]):
            candidate = next((g for g in m if g), None)
            if candidate and not candidate.startswith(("http://", "https://", "data:")):
                local_img_paths.add(candidate)

    # Each source page already carries its own <script src=".../app.js">
    # (added by build.py / build_state.py) -- drop it here since one
    # shared inline copy is appended once for the whole assembled file.
    for script in soup.find_all("script", src=True):
        if script["src"].endswith("assets/js/app.js"):
            script.decompose()

    body_html = "".join(str(c) for c in soup.body.contents) if soup.body else html

    for rel in local_img_paths:
        abs_path = os.path.normpath(os.path.join(base_dir, rel))
        if os.path.isfile(abs_path):
            uri = data_uri_for(abs_path)
            body_html = body_html.replace(f'"{rel}"', f'"{uri}"')
            body_html = body_html.replace(f"url({rel})", f"url({uri})")
            body_html = body_html.replace(f"url(&quot;{rel}&quot;)", f"url(&quot;{uri}&quot;)")

    # Give this state's normally-page-unique ids a per-state suffix so
    # four copies can coexist as sibling panels without id collisions.
    for the_id in DEDUP_IDS:
        body_html = body_html.replace(f'id="{the_id}"', f'id="{the_id}--{slug}"')

    return body_html


def _outer_children(body_html):
    """`<main class="lite-main"><div>SUBSIDEBAR, ...</div></main>` -- returns
    that outer div's direct children as a live bs4 ResultSet, plus the soup
    (so callers can serialize mutations back to a string)."""
    soup = BeautifulSoup(body_html, "html.parser")
    outer = soup.find("main", class_="lite-main").find("div", recursive=False)
    return soup, outer, outer.find_all(recursive=False)


def enhance_list_panel(panels):
    """Bolts the real "ticket open" reading pane + contact panel onto the
    List panel, so clicking a row (outside its checkbox) opens a ticket the
    same way the "Ticket open" capture does, instead of the List state's
    own (reading-pane-less) capture.

    (The bulk-select bar doesn't need this treatment -- app.js builds that
    one from a plain HTML string at runtime, since it's simple enough not
    to need borrowing real markup, and doing it in JS means it also works
    on the standalone states/list/index.html page, not just this merged
    build.)

    This graft only runs for the merged single-file build: it borrows
    already fully self-contained (images inlined as data URIs) markup
    straight out of the "open-ticket" panel's extracted HTML, which only
    exists alongside "list" in this one document.
    """
    by_slug = {slug: body for slug, _, _, body in panels}

    # --- pull the reading pane + contact panel out of "open-ticket" -------
    _, _, ot_children = _outer_children(by_slug["open-ticket"])
    # outer = [subsidebar, middle(flex row: list-col + reading-pane), contact-panel]
    ot_middle_children = ot_children[1].find_all(recursive=False)
    reading_pane = ot_middle_children[1]
    reading_pane["class"] = reading_pane.get("class", []) + ["tli-reading-pane"]
    contact_panel = ot_children[2]
    contact_panel["class"] = contact_panel.get("class", []) + ["tli-contact-panel"]

    # --- graft both into "list" --------------------------------------------
    list_soup, list_outer, list_children = _outer_children(by_slug["list"])
    list_middle = list_children[1]
    list_col = list_middle.find_all(recursive=False)[0]
    list_col["class"] = list_col.get("class", []) + ["tli-list-col"]

    list_middle.append(reading_pane)
    list_outer.append(contact_panel)

    by_slug["list"] = str(list_soup)
    return [(slug, css_group, label, by_slug[slug]) for slug, css_group, label, _ in panels]


def main():
    panels = []
    for slug, rel_path, css_group, label in STATES:
        body_html = extract_panel(slug, rel_path)
        panels.append((slug, css_group, label, body_html))

    # enhance_list_panel needs all four raw panels (it grafts the reading
    # pane + contact panel from "open-ticket" and the bulk bar from
    # "selected" into "list" at build time) -- but the *output* is just
    # the one, now fully self-contained "list" panel. Baseline/selected/
    # open-ticket were only ever useful as a dev-facing state switcher,
    # which is gone now (see ENTRY_SLUG below): there's nothing left to
    # switch to, so there's no reason to ship their markup too.
    panels = enhance_list_panel(panels)
    panels = [p for p in panels if p[0] == ENTRY_SLUG]

    used_groups = {p[1] for p in panels}
    css_blobs = {}
    for group, files in CSS_GROUPS.items():
        if group not in used_groups:
            continue
        parts = []
        for rel in files:
            with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
                parts.append(f.read())
        css_blobs[group] = "\n".join(parts)

    prototype_css = open(os.path.join(ROOT, "assets/css/prototype.css"), encoding="utf-8").read()
    app_js = open(os.path.join(ROOT, "assets/js/app.js"), encoding="utf-8").read()

    # Just one panel now (see ENTRY_SLUG above) -- no tab bar, no
    # show/hide toggling, no picking a CSS blob at click time. Its real
    # CSS goes straight into a normal <style> tag.
    row_style_attr = ' data-row-style="v2"'
    (slug, css_group, label, body) = panels[0]
    panel_div = (
        f'<div class="state-panel" id="state-{slug}"{row_style_attr}>\n{body}\n</div>'
    )
    app_css = css_blobs[css_group]

    out = f"""<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<title>Inbox hover-behaviour prototype</title>
<meta name="viewport" content="initial-scale=1.0, width=device-width">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400..700;1,400..700&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
{app_css}

{prototype_css}
</style>
</head>
<body class="sf-app not-windows">
{panel_div}

<script>
{app_js}
</script>
</body>
</html>
"""

    out_path = os.path.join(ROOT, "inbox-prototype.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print("Wrote", out_path, len(out), "bytes")


if __name__ == "__main__":
    main()
