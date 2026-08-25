/*
 * app.js
 * ---------------------------------------------------------------
 * This page started life as a static snapshot of the real Serviceform
 * Lite inbox (captured as .mhtml, rebuilt into plain HTML/CSS by
 * build.py). None of the original React app is here -- every button,
 * row and toggle below is inert markup until we wire it up ourselves.
 *
 * This file restores just enough basic chrome interactivity (sidebar
 * collapse, row selection) so the page doesn't feel completely dead.
 * The actual hover-behaviour work devs are meant to build lives here.
 *
 * Written to work whether this document holds one inbox page or -- as
 * in inbox-prototype.html -- several captured states sitting side by
 * side as `.state-panel` sections. Every lookup below is scoped to the
 * row/button's nearest `.state-panel` (or `document` if there isn't
 * one) so the panels never cross-wire each other.
 * ---------------------------------------------------------------
 */
(function () {
  "use strict";

  function scopeOf(el) {
    return el.closest(".state-panel") || document;
  }

  // --- Sidebar collapse toggle -------------------------------------------
  document.querySelectorAll(".lite-collapse-btn").forEach(function (btn) {
    var sidebar = scopeOf(btn).querySelector(".lite-sidebar");
    if (!sidebar) return;
    btn.addEventListener("click", function () {
      sidebar.classList.toggle("lite-sidebar-collapsed");
    });
  });

  // --- Ticket list row selection ------------------------------------------
  // Real app drives aria-selected / .tli--active from React state. Here we
  // just fake "clicking a row selects it" so the list doesn't look frozen.
  // Single-select, but clicking an already-selected row toggles it back off.
  //
  // Skips [data-row-style="v2"] rows (today: the "List" state) -- those get
  // their own multi-select-via-checkbox-only handling further down, where
  // clicking anywhere else on the row is deliberately a no-op.
  document.querySelectorAll(".tli").forEach(function (row) {
    if (row.closest('[data-row-style="v2"]')) return;
    row.addEventListener("click", function () {
      var wasActive = row.classList.contains("tli--active");
      scopeOf(row).querySelectorAll(".tli").forEach(function (r) {
        r.classList.remove("tli--active");
        r.setAttribute("aria-selected", "false");
      });
      if (!wasActive) {
        row.classList.add("tli--active");
        row.setAttribute("aria-selected", "true");
      }
    });
  });

  // --- Row hover behaviour --------------------------------------------
  // Placeholder hook point: the production CSS already has a plain
  // `.tli:hover` background rule. Add hover-revealed quick actions,
  // read/unread toggles, snooze, etc. here and in prototype.css.
  // e.g.
  // document.querySelectorAll(".tli").forEach(function (row) {
  //   row.addEventListener("mouseenter", function () { ... });
  //   row.addEventListener("mouseleave", function () { ... });
  // });
})();

/*
 * --- List-row redesign: icon -> hover checkbox -> selected checkbox ------
 * Gmail-style: a ticket shows its real channel icon (Email/Instagram/
 * WhatsApp/...) normally; hovering the row swaps that icon for a plain
 * checkbox outline; clicking fills the checkbox in (using the app's own
 * --lite-accent colour, not Gmail's blue) and the row stays selected.
 *
 * Icons are Phosphor (github.com/phosphor-icons/core, MIT), fetched
 * verbatim -- nothing here is hand-drawn.
 *
 * Only rewrites rows inside a `[data-row-style="v2"]` container, which
 * today is just the "List" state -- see build_state.py / build_single.py.
 * Structure is pulled from the Figma list-item wireframes (icon + a
 * two-line name/subject block); every colour still comes from the app's
 * real CSS variables (--lite-text-primary, --lite-accent, etc.), not the
 * wireframe's placeholder greys or Gmail's blue.
 * ---------------------------------------------------------------
 */
(function () {
  "use strict";

  var PHOSPHOR_ICONS = {
    // Channel icons, keyed by the same `title` the app already puts on
    // .lite-channel-icon (Email/Instagram/WhatsApp/<bot name>).
    Email:
      '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"/></svg>',
    Instagram:
      '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"/></svg>',
    WhatsApp:
      '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.61-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>',
  };
  // Anything not Email/Instagram/WhatsApp (chat-widget bot names, etc.)
  // falls back to a generic chat bubble rather than guessing a logo.
  var CHAT_FALLBACK_ICON =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"/></svg>';
  var SQUARE_ICON =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Z"/></svg>';
  var CHECK_SQUARE_ICON =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM224,48V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM208,208V48H48V208H208Z"/></svg>';

  function makeEl(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // Splits the existing `.tli__preview` node (plain subject text followed
  // by a `.tli__preview-dimmed` span) into "<b>subject</b> + dimmed preview"
  // HTML, bolding the subject to match the wireframe's two-tier text.
  function subjectAndPreviewHtml(previewEl) {
    if (!previewEl) return "";
    var dimmed = previewEl.querySelector(".tli__preview-dimmed");
    if (!dimmed) return previewEl.innerHTML;
    var clone = previewEl.cloneNode(true);
    var dimmedClone = clone.querySelector(".tli__preview-dimmed");
    var dimmedHtml = dimmedClone.outerHTML;
    dimmedClone.remove();
    return '<span class="tli2-subject">' + clone.innerHTML + "</span>" + dimmedHtml;
  }

  // --- Agent avatar stack (bottom-right corner) --------------------------
  // Shows who's in the conversation: up to 2 avatars, then a "+N" circle
  // for however many more agents there are beyond those two.
  //
  // Real data only ever has a single assignee per ticket in this capture
  // (`.tli__assignee-dot`, read below) -- not enough to show the 2+/overflow
  // cases devs actually need to look at, so a handful of rows (picked by
  // index in DEMO_AGENT_OVERRIDES) get synthetic extra agents layered on
  // for demonstration. Those synthetic agents render as initials circles,
  // not photos: this prototype doesn't have a file-system path to the
  // headshot supplied in chat -- see makeAgentAvatar() for where to plug
  // in a real `assets/img/...` path once that file is added to the repo.
  var DEMO_AGENT_OVERRIDES = {
    2: ["Anna Koskinen", "Jere Salo"], // 2 agents, no overflow badge
    5: ["Anna Koskinen", "Jere Salo", "Liisa Virtanen", "Marko Nieminen"], // -> +2
    6: ["Anna Koskinen", "Jere Salo", "Liisa Virtanen", "Marko Nieminen"], // Samu Suominen row -> +2
  };

  function initials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) {
        return w[0].toUpperCase();
      })
      .join("");
  }

  function colorForName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return "hsl(" + (Math.abs(hash) % 360) + ", 42%, 52%)";
  }

  // Real per-row assignees, from the app's own `.tli__assignee-dot`
  // elements (name in data-tooltip, avatar as a background-image).
  function getRealAssignees(row) {
    return Array.prototype.map.call(row.querySelectorAll(".tli__assignee-dot"), function (dot) {
      var bg = getComputedStyle(dot).backgroundImage;
      var match = /url\(["']?([^"')]+)["']?\)/.exec(bg || "");
      return { name: dot.getAttribute("data-tooltip") || "", avatarUrl: match ? match[1] : null };
    });
  }

  function makeAgentAvatar(agent) {
    var el = makeEl("span", "tli2-agent-avatar");
    // data-tooltip, not title: the app already ships a styled
    // `[data-tooltip]:hover::after` tooltip (dark bubble, see
    // app-main.css) used for exactly this elsewhere (e.g. the real
    // .tli__assignee-dot) -- reusing it keeps this looking the same as
    // the rest of the app instead of a native browser tooltip.
    el.setAttribute("data-tooltip", agent.name || "");
    if (agent.avatarUrl) {
      el.style.backgroundImage = 'url("' + agent.avatarUrl + '")';
    } else {
      el.classList.add("tli2-agent-avatar--initials");
      el.style.background = colorForName(agent.name || "?");
      el.textContent = initials(agent.name || "?");
    }
    return el;
  }

  function buildAgentStack(agents) {
    if (!agents.length) return null;
    var stack = makeEl("div", "tli2-agents");
    agents.slice(0, 2).forEach(function (agent) {
      stack.appendChild(makeAgentAvatar(agent));
    });
    if (agents.length > 2) {
      var more = makeEl("span", "tli2-agent-more");
      more.textContent = "+" + (agents.length - 2);
      more.setAttribute(
        "data-tooltip",
        agents
          .slice(2)
          .map(function (a) {
            return a.name;
          })
          .join(", ")
      );
      stack.appendChild(more);
    }
    return stack;
  }

  function redesignRow(row, index) {
    if (row.dataset.rowRedesigned) return;
    row.dataset.rowRedesigned = "true";

    var channelEl = row.querySelector(".lite-channel-icon");
    var channelName = channelEl ? channelEl.getAttribute("title") || "" : "";
    // Reuse the channel badge's own inline color/background -- these are
    // the real per-channel colours already in the captured markup.
    var channelColor = channelEl ? channelEl.style.color : "";
    var channelBg = channelEl ? channelEl.style.background : "";
    var iconSvg = PHOSPHOR_ICONS[channelName] || CHAT_FALLBACK_ICON;

    var nameText = row.querySelector(".tli__name") ? row.querySelector(".tli__name").textContent : "";
    var mailboxText = row.querySelector(".tli__mailbox") ? row.querySelector(".tli__mailbox").textContent : "";
    var timeEl = row.querySelector(".tli__time");
    var timeText = timeEl ? timeEl.textContent : "";
    var datetimeAttr = timeEl ? timeEl.getAttribute("datetime") : null;
    var previewHtml = subjectAndPreviewHtml(row.querySelector(".tli__preview"));

    // Set as custom properties, not `color`/`background` directly -- the
    // default state reads them via var(), but the hover/selected rules in
    // prototype.css set `background`/`color` themselves, and an inline
    // style on those exact properties would beat any stylesheet rule
    // regardless of specificity.
    var icon = makeEl("div", "tli2-icon");
    icon.style.setProperty("--tli2-channel-color", channelColor || "inherit");
    icon.style.setProperty("--tli2-channel-bg", channelBg || "transparent");
    icon.appendChild(makeEl("span", "tli2-icon-channel", iconSvg));
    icon.appendChild(makeEl("span", "tli2-icon-hover", SQUARE_ICON));
    icon.appendChild(makeEl("span", "tli2-icon-selected", CHECK_SQUARE_ICON));

    var line1 = makeEl("div", "tli2-line1");
    var nameSpan = makeEl("span", "tli2-name");
    nameSpan.textContent = nameText;
    line1.appendChild(nameSpan);
    if (mailboxText) {
      var mailSpan = makeEl("span", "tli2-mailbox");
      mailSpan.textContent = mailboxText;
      line1.appendChild(mailSpan);
    }
    if (timeText) {
      // Top-right corner of the row, same spot the real .tli__time sits in
      // the unredesigned rows -- pushed there via margin-left: auto in CSS.
      var timeSpan = makeEl("time", "tli2-time");
      timeSpan.textContent = timeText;
      if (datetimeAttr) timeSpan.setAttribute("datetime", datetimeAttr);
      line1.appendChild(timeSpan);
    }

    var demoNames = DEMO_AGENT_OVERRIDES[index];
    var agents = demoNames
      ? demoNames.map(function (name) {
          return { name: name, avatarUrl: null };
        })
      : getRealAssignees(row);
    var agentStack = buildAgentStack(agents);

    // Line 2 is [subject/preview text, flexes+truncates] + [agent avatar
    // stack] side by side in one flex row, so the avatars are vertically
    // centered against that text by the same flexbox rule that centers
    // everything else here -- not nudged into place with absolute
    // positioning against the row as a whole.
    var line2 = makeEl("div", "tli2-line2");
    line2.appendChild(makeEl("div", "tli2-line2-text", previewHtml));
    if (agentStack) line2.appendChild(agentStack);

    var body = makeEl("div", "tli2-body");
    body.appendChild(line1);
    body.appendChild(line2);

    row.innerHTML = "";
    row.appendChild(icon);
    row.appendChild(body);
  }

  document.querySelectorAll('[data-row-style="v2"] .tli').forEach(redesignRow);

  // --- One resolved ticket, near the end of the list ----------------------
  // Demo content for what a resolved ticket looks like in this redesign:
  // its text struck through. There's no real per-row status data in the
  // captured markup to drive this off of, so it's just the last row in
  // the list -- swap which row by adjusting the selector below.
  document.querySelectorAll('[data-row-style="v2"]').forEach(function (scope) {
    var rowsForResolved = scope.querySelectorAll(".tli");
    var lastRow = rowsForResolved[rowsForResolved.length - 1];
    if (lastRow) lastRow.classList.add("tli--resolved");
  });

  // --- Snoozed state, on a couple of demo rows ----------------------------
  // No badge/tag -- the row's own text just goes muted (name/subject drop
  // to the same muted grey + regular weight the app already uses for read
  // messages elsewhere, not full strikethrough like .tli--resolved), and a
  // small bell-z (Phosphor, github.com/phosphor-icons/core, MIT) sits at
  // the bottom-right of the card, right after the agent avatar stack. No
  // real per-row snooze data to drive this off of, so it's targeted by
  // name -- add/remove rows by adjusting this list.
  var SNOOZE_ROWS = [/Kippis Heinola DGP World/, /Samu Suominen/];
  var SNOOZE_BELL_ICON =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M152,144a8,8,0,0,1-8,8H112a8,8,0,0,1-6.65-12.44L129.05,104H112a8,8,0,0,1,0-16h32a8,8,0,0,1,6.65,12.44L127,136h17A8,8,0,0,1,152,144Zm69.84,48A15.8,15.8,0,0,1,208,200H167.19a40,40,0,0,1-78.38,0H48a16,16,0,0,1-13.8-24.06C39.75,166.38,48,139.34,48,104a80,80,0,1,1,160,0c0,35.33,8.26,62.38,13.81,71.94A15.89,15.89,0,0,1,221.84,192Zm-71.22,8H105.38a24,24,0,0,0,45.24,0ZM208,184c-7.73-13.27-16-43.95-16-80a64,64,0,1,0-128,0c0,36.06-8.28,66.74-16,80Z"/></svg>';
  document.querySelectorAll('[data-row-style="v2"] .tli').forEach(function (row) {
    var label = row.getAttribute("aria-label") || "";
    if (!SNOOZE_ROWS.some(function (re) { return re.test(label); })) return;
    row.classList.add("tli--snoozed");
    var line2 = row.querySelector(".tli2-line2");
    if (!line2) return;
    line2.appendChild(makeEl("span", "tli2-snooze-icon", SNOOZE_BELL_ICON));
  });

  // --- Unsnoozed state, on the top card ------------------------------------
  // A plain bell (Phosphor, github.com/phosphor-icons/core, MIT -- the
  // un-modified "Bell" glyph, not the bell-z used for the snoozed tag
  // above) paired with a "3 mins ago" label inside the same tag/badge --
  // icon on the left, text on the right. Targeted at whichever row is
  // first in the list (no real per-row snooze-history data to drive this
  // off of).
  var PLAIN_BELL_ICON =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M221.84,192A15.8,15.8,0,0,1,208,200H167.19a40,40,0,0,1-78.38,0H48a16,16,0,0,1-13.8-24.06C39.75,166.38,48,139.34,48,104a80,80,0,1,1,160,0c0,35.33,8.26,62.38,13.81,71.94ZM150.62,200H105.38a24,24,0,0,0,45.24,0ZM208,184c-7.73-13.27-16-43.95-16-80a64,64,0,1,0-128,0c0,36.06-8.28,66.74-16,80Z"/></svg>';
  document.querySelectorAll('[data-row-style="v2"]').forEach(function (scope) {
    var topRow = scope.querySelector(".tli");
    if (!topRow) return;
    var line2 = topRow.querySelector(".tli2-line2");
    if (!line2) return;
    var tag = makeEl("span", "tli2-snooze-icon tli2-snooze-icon--unsnoozed", "");
    tag.appendChild(makeEl("span", "tli2-snooze-icon-glyph", PLAIN_BELL_ICON));
    tag.appendChild(makeEl("span", "tli2-snooze-icon-text", "3 mins ago"));
    line2.appendChild(tag);
  });

  /*
   * --- Multi-select + bulk-action bar --------------------------------
   * Selection only happens by clicking the checkbox (the .tli2-icon,
   * once it's showing the checkbox rather than the channel icon) --
   * clicking anywhere else on the row opens the ticket instead (see the
   * "Opening a ticket" block further down) and never selects it. Any
   * number of rows can be checked at once, independent of which single
   * row (if any) is currently open.
   *
   * Checked state lives in `.tli--checked`, deliberately NOT the real
   * app's `.tli--active` -- that class is reserved for "this row's
   * ticket is open", which needs to stay independent of the checkboxes.
   *
   * The bar itself is the app's own real `.ticket-bulk-bar` markup
   * (copied verbatim from the "Row selected" capture), inserted here at
   * runtime rather than baked into every build script's HTML output --
   * same real classes, so it needs no new CSS of its own, just JS to
   * show/hide it and keep the count in sync.
   */
  var BULK_BAR_HTML =
    '<div class="ticket-bulk-bar" hidden>' +
      '<div class="lite-checkbox"><div class="lite-checkbox__box lite-checkbox__box--checked">' +
        '<svg class="lite-checkbox__check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
      '</div></div>' +
      '<button type="button" class="ticket-bulk-bar__select-all">Select all</button>' +
      '<span class="ticket-bulk-bar__count">0 selected</span>' +
      '<button type="button" title="Clear selection" data-bulk-action="clear" class="lite-icon-button lite-icon-button--ghost lite-icon-button--mini">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</button>' +
      '<div class="ticket-bulk-bar__spacer"></div>' +
      '<button type="button" data-bulk-action="status" class="lite-button lite-button--secondary lite-button--mini"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>Status</button>' +
      '<span class="tli-bulkbar-divider" aria-hidden="true"></span>' +
      '<button type="button" data-bulk-action="assignee" class="lite-button lite-button--secondary lite-button--mini"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>Assignee</button>' +
      '<button type="button" data-bulk-action="folder" class="lite-button lite-button--secondary lite-button--mini"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>Folder</button>' +
      '<button type="button" data-bulk-action="snooze" class="lite-button lite-button--secondary lite-button--mini"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Snooze</button>' +
      '<button type="button" data-bulk-action="export" class="lite-button lite-button--secondary lite-button--mini"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Export</button>' +
    "</div>";

  document.querySelectorAll('[data-row-style="v2"]').forEach(function (scopeRoot) {
    var rows = scopeRoot.querySelectorAll(".tli");
    if (!rows.length) return;

    var searchBar = scopeRoot.querySelector(".lite-autocomplete");

    // A build script may have already grafted the real `.ticket-bulk-bar`
    // markup in next to the search box (see build_single.py) -- reuse it
    // if so, rather than inserting a second one.
    var bulkBar = scopeRoot.querySelector(".ticket-bulk-bar");
    if (!bulkBar) {
      var wrapper = makeEl("div");
      wrapper.innerHTML = BULK_BAR_HTML;
      bulkBar = wrapper.firstElementChild;
    }
    bulkBar.hidden = true;

    // Mount the bar right after the search box, inside the ticket list
    // column -- it sits above the list only, at the list column's own
    // width (which narrows to 340px once a ticket opens, same as the
    // real "Row selected" capture does), not full page width. An earlier
    // pass instead moved the bar out above the reading pane + contact
    // panel too (full width); that was reverted per explicit direction
    // to go back to "on top of the list of tickets, not full width",
    // wrapping onto multiple rows if the buttons don't fit (the real
    // `.ticket-bulk-bar` CSS already sets `flex-wrap: wrap`).
    //
    // isConnected, NOT parentElement: a freshly created bar's parent is
    // the throwaway `wrapper` div above, which is truthy but was never
    // attached to the document -- checking parentElement alone made this
    // look "already mounted" and silently skipped the real insertion.
    if (searchBar && !bulkBar.isConnected) {
      searchBar.insertAdjacentElement("afterend", bulkBar);
    }

    // The search box and the "N of M conversations" toolbar row below it
    // share one padded wrapper div (on the standalone states/list page,
    // the bulk bar itself lives in there too, as a third child -- see the
    // fallback branch above). Only the toolbar row gets swapped out for
    // the bulk bar -- the search box itself stays put and visible, same
    // as the real "Row selected" capture (the bar appears right under
    // the still-visible search field, not in place of it).
    var searchWrap = searchBar ? searchBar.parentElement : null;
    var defaultToolbar = null;
    if (searchWrap) {
      Array.prototype.forEach.call(searchWrap.children, function (el) {
        if (el !== searchBar && !el.classList.contains("ticket-bulk-bar") && !defaultToolbar) {
          defaultToolbar = el;
        }
      });
    }

    // Redundant now that hovering any row already reveals its own checkbox
    // -- the old "enter selection mode" toggle from the captured toolbar.
    var selectTicketsBtn = scopeRoot.querySelector('[title="Select tickets"]');
    if (selectTicketsBtn) selectTicketsBtn.remove();

    var countEl = bulkBar.querySelector(".ticket-bulk-bar__count");

    function selectedRows() {
      return Array.from(rows).filter(function (r) {
        return r.classList.contains("tli--checked");
      });
    }

    function setRowSelected(row, selected) {
      row.classList.toggle("tli--checked", selected);
    }

    function refresh() {
      var n = selectedRows().length;
      bulkBar.hidden = n === 0;
      if (defaultToolbar) defaultToolbar.hidden = n > 0;
      countEl.textContent = n + (n === 1 ? " selected" : " selected");
    }

    rows.forEach(function (row) {
      var icon = row.querySelector(".tli2-icon");
      if (!icon) return;
      icon.addEventListener("click", function (e) {
        e.stopPropagation();
        setRowSelected(row, !row.classList.contains("tli--checked"));
        refresh();
      });
    });

    bulkBar.querySelector(".ticket-bulk-bar__select-all").addEventListener("click", function () {
      var selectAll = selectedRows().length < rows.length;
      rows.forEach(function (row) {
        setRowSelected(row, selectAll);
      });
      refresh();
    });

    bulkBar.querySelector('[title="Clear selection"]').addEventListener("click", function () {
      rows.forEach(function (row) {
        setRowSelected(row, false);
      });
      refresh();
    });

    refresh();

    /*
     * --- Opening a ticket (borrowed from the real "Ticket open" capture) -
     * Clicking a row anywhere outside its checkbox opens that ticket:
     * single-select via the real `.tli--active` class (only one row is
     * ever "open", same as the real app), reveals the reading pane +
     * contact panel grafted onto this state at build time (see
     * build_single.py's enhance_list_panel -- single-file build only; the
     * standalone states/list/index.html has no ticket detail to show),
     * and updates just the header's name/subject text to match the
     * clicked row. The rest of the conversation is the one real ticket
     * this prototype has full detail for, not per-row data -- clicking a
     * different row swaps the header text but not the timeline below it.
     */
    var readingPane = scopeRoot.querySelector(".tli-reading-pane");
    var heading = readingPane ? readingPane.querySelector(".ticket-subject-hero") : null;
    var senderName = readingPane ? readingPane.querySelector(".ticket-sender-name") : null;

    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        if (!readingPane) return; // standalone states/list page: nothing to open

        // Clicking the ticket that's already open closes it again, back to
        // the plain list view -- clicking any other row (open or not)
        // always opens that one instead.
        var wasOpen = row.classList.contains("tli--active");
        rows.forEach(function (r) {
          r.classList.remove("tli--active");
          r.setAttribute("aria-selected", "false");
        });
        if (wasOpen) {
          scopeRoot.classList.remove("tli-ticket-open");
          return;
        }

        row.classList.add("tli--active");
        row.setAttribute("aria-selected", "true");
        scopeRoot.classList.add("tli-ticket-open");
        // Opening a ticket reads it -- the real app's `.tli--unread` left
        // border accent should disappear, same as the real inbox. Stays
        // off even after the ticket is closed again (real "unread" isn't
        // toggled back on by closing a tab either).
        row.classList.remove("tli--unread");

        var nameEl = row.querySelector(".tli2-name");
        var subjectEl = row.querySelector(".tli2-subject");
        if (heading && subjectEl) heading.textContent = subjectEl.textContent;
        if (senderName && nameEl) senderName.textContent = nameEl.textContent;
      });
    });
  });
})();

/*
 * --- Bulk-bar property dropdowns (Status/Assignee/Folder/Snooze) --------
 * Real production UI for these four buttons, per reference screenshots:
 * a small uppercase label ("CHANGE STATUS" etc.), a divider, then a list
 * of plain text rows. Content is the real content from those screenshots
 * -- except Folder, which is read live off this page's own real sidebar
 * folder list instead of being retyped, so it can never drift out of
 * sync with it. Export has no dropdown in the reference, so it's left
 * alone (still just a plain, inert button).
 *
 * Dropdowns are appended to <body> (position: fixed, anchored to the
 * button's own rect) rather than nested in the bar, so they're never
 * clipped by the `overflow: hidden` ancestors the list/reading-pane
 * layout relies on elsewhere.
 */
(function () {
  "use strict";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function closeOpenDropdown() {
    var open = document.querySelector(".tli-dropdown");
    if (open) open.remove();
    document.querySelectorAll('[data-dropdown-open="true"]').forEach(function (b) {
      b.dataset.dropdownOpen = "false";
    });
  }

  // Small local copies of the same initials/colour helpers the row's own
  // agent-avatar stack uses (see the other IIFE above) -- kept separate
  // rather than shared across closures, same as this file's other small
  // per-section helpers (e.g. each IIFE has its own makeEl/el).
  function initialsFor(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) {
        return w[0].toUpperCase();
      })
      .join("");
  }
  function colorFor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return "hsl(" + (Math.abs(hash) % 360) + ", 42%, 52%)";
  }

  // items: either plain strings (default: plain text row, e.g. Folder,
  // Snooze) or { renderItem(item) => Node, searchable: true } via options
  // for the richer Status/Assignee menus.
  function openDropdown(anchorBtn, title, items, options) {
    var wasOpen = anchorBtn.dataset.dropdownOpen === "true";
    closeOpenDropdown();
    if (wasOpen) return; // this button's own click just toggled it closed

    options = options || {};
    anchorBtn.dataset.dropdownOpen = "true";

    var menu = el("div", "tli-dropdown");
    menu.appendChild(el("div", "tli-dropdown__label", title));

    var searchInput = null;
    if (options.searchable) {
      var searchWrap = el("div", "tli-dropdown__search");
      searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search...";
      searchInput.className = "tli-dropdown__search-input";
      searchWrap.appendChild(searchInput);
      menu.appendChild(searchWrap);
    }

    menu.appendChild(el("div", "tli-dropdown__divider"));
    var list = el("div", "tli-dropdown__list");
    items.forEach(function (item) {
      var row = el("div", "tli-dropdown__item");
      row.dataset.searchText = (options.textOf ? options.textOf(item) : item).toLowerCase();
      if (options.renderItem) {
        row.appendChild(options.renderItem(item));
      } else {
        row.textContent = item;
      }
      row.addEventListener("click", function () {
        if (options.onSelect) options.onSelect(item);
        closeOpenDropdown();
      });
      list.appendChild(row);
    });
    menu.appendChild(list);
    document.body.appendChild(menu);

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var q = searchInput.value.trim().toLowerCase();
        list.querySelectorAll(".tli-dropdown__item").forEach(function (row) {
          row.hidden = q !== "" && row.dataset.searchText.indexOf(q) === -1;
        });
      });
      // Autofocus without also scrolling the page to the newly-inserted
      // dropdown -- it's already positioned in view next to its button.
      searchInput.focus({ preventScroll: true });
    }

    var rect = anchorBtn.getBoundingClientRect();
    var menuWidth = menu.getBoundingClientRect().width;
    var left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
    menu.style.top = rect.bottom + 6 + "px";
    menu.style.left = Math.max(8, left) + "px";
  }

  document.addEventListener("mousedown", function (e) {
    if (!document.querySelector(".tli-dropdown")) return;
    if (e.target.closest(".tli-dropdown") || e.target.closest('[data-dropdown-open="true"]')) return;
    closeOpenDropdown();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOpenDropdown();
  });

  function folderNamesFrom(scopeRoot) {
    var names = [];
    scopeRoot.querySelectorAll(".cdp-subsidebar-label").forEach(function (label) {
      if (label.textContent.trim() !== "Folders") return;
      label.parentElement.querySelectorAll(".cdp-nav-item").forEach(function (btn) {
        var spans = btn.querySelectorAll(":scope > span");
        if (spans[1]) names.push(spans[1].textContent.trim());
      });
    });
    return names;
  }

  // Status icons: a plain CSS-coloured dot for "active" (there's no
  // designed icon for a solid circle, it's just a filled shape), and two
  // real Phosphor icons (circle-dashed for "not started yet", check-circle
  // for "done") -- same MIT-licensed set the row redesign uses.
  var ICON_CIRCLE_DASHED =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M96.26,37.05A8,8,0,0,1,102,27.29a104.11,104.11,0,0,1,52,0,8,8,0,0,1-2,15.75,8.15,8.15,0,0,1-2-.26,88.09,88.09,0,0,0-44,0A8,8,0,0,1,96.26,37.05ZM53.79,55.14a104.05,104.05,0,0,0-26,45,8,8,0,0,0,15.42,4.27,88,88,0,0,1,22-38.09A8,8,0,0,0,53.79,55.14ZM43.21,151.55a8,8,0,1,0-15.42,4.28,104.12,104.12,0,0,0,26,45,8,8,0,0,0,11.41-11.22A88.14,88.14,0,0,1,43.21,151.55ZM150,213.22a88,88,0,0,1-44,0,8,8,0,1,0-4,15.49,104.11,104.11,0,0,0,52,0,8,8,0,0,0-4-15.49ZM222.65,146a8,8,0,0,0-9.85,5.58,87.91,87.91,0,0,1-22,38.08,8,8,0,1,0,11.42,11.21,104,104,0,0,0,26-45A8,8,0,0,0,222.65,146Zm-9.86-41.54a8,8,0,0,0,15.42-4.28,104,104,0,0,0-26-45,8,8,0,1,0-11.41,11.22A88,88,0,0,1,212.79,104.45Z"/></svg>';
  var ICON_CHECK_CIRCLE =
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>';

  var STATUS_ITEMS = [
    { label: "Open", icon: "dot", color: "#3B82F6" }, // actively being worked
    { label: "Pending", icon: ICON_CIRCLE_DASHED, color: "var(--lite-text-muted)" }, // waiting, not started
    { label: "Resolved", icon: ICON_CHECK_CIRCLE, color: "#22C55E" },
    { label: "Closed", icon: ICON_CHECK_CIRCLE, color: "var(--lite-text-muted)" }, // done, but archived not "fresh done"
  ];
  var ASSIGNEE_ITEMS = [
    "Software Test", "Derek", "Mahesh Ekanayaka", "Sandra Pacius",
    "Sathnidu Weerawardhana", "Venla Shalin", "César Rentería", "Irushi Peiris",
    "Amanda Johansson", "Alejandra Saldaña", "Adam Martinez", "David Tronco",
    "Hiruni test 2", "Kaveen Molligoda", "Jukka Rautiainen", "Hamaad Fahim",
    "Joonas Keinästö", "Pasindu Subasinghe", "Example User", "Sini Vilonen",
    "Hanna Aarnio", "Gustav Toll",
  ];
  var SNOOZE_ITEMS = ["In 3 hours", "In 3 days", "Next week", "In 2 weeks", "Tomorrow morning"];

  function renderStatusItem(status) {
    var row = el("div", "tli-dropdown__status-row");
    var iconWrap = el("span", "tli-dropdown__status-icon");
    if (status.icon === "dot") {
      var dot = el("span", "tli-dropdown__status-dot");
      dot.style.background = status.color;
      iconWrap.appendChild(dot);
    } else {
      iconWrap.innerHTML = status.icon;
      iconWrap.style.color = status.color;
    }
    row.appendChild(iconWrap);
    row.appendChild(el("span", null, status.label));
    return row;
  }

  function renderAssigneeItem(name) {
    var row = el("div", "tli-dropdown__assignee-row");
    var avatar = el("span", "tli-dropdown__assignee-avatar", initialsFor(name));
    avatar.style.background = colorFor(name);
    row.appendChild(avatar);
    row.appendChild(el("span", null, name));
    return row;
  }

  document.querySelectorAll('[data-row-style="v2"]').forEach(function (scopeRoot) {
    var bar = scopeRoot.querySelector(".ticket-bulk-bar");
    if (!bar) return;

    var configs = [
      {
        text: "Status",
        title: "CHANGE STATUS",
        items: STATUS_ITEMS,
        renderItem: renderStatusItem,
        textOf: function (s) {
          return s.label;
        },
        // Applies the picked status to every currently checked row --
        // visually, for now, just "Resolved" gets its own look (pale
        // blue background, no left accent stripe, same transparent-
        // border trick used for an opened ticket). The other statuses
        // don't have a distinct row appearance requested yet.
        onSelect: function (status) {
          scopeRoot.querySelectorAll(".tli--checked").forEach(function (row) {
            row.classList.remove("tli--status-resolved");
            if (status.label === "Resolved") row.classList.add("tli--status-resolved");
          });
        },
      },
      {
        text: "Assignee",
        title: "ADD ASSIGNEE",
        items: ASSIGNEE_ITEMS,
        renderItem: renderAssigneeItem,
        searchable: true,
      },
      { text: "Folder", title: "ADD TO FOLDER", items: folderNamesFrom(scopeRoot) },
      {
        text: "Snooze",
        title: "SNOOZE IN",
        items: SNOOZE_ITEMS,
        // Any snooze duration -> snoozed. The row's agent avatar stack
        // collapses to just one avatar while snoozed (see .tli--snoozed
        // in prototype.css) -- who's actively on a snoozed conversation
        // isn't as relevant as it is for an active one.
        onSelect: function () {
          scopeRoot.querySelectorAll(".tli--checked").forEach(function (row) {
            row.classList.add("tli--snoozed");
          });
        },
      },
    ];

    bar.querySelectorAll(".lite-button").forEach(function (btn) {
      var label = btn.textContent.trim();
      var config = configs.filter(function (c) {
        return c.text === label;
      })[0];
      if (!config) return; // Export: no dropdown in the reference
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdown(btn, config.title, config.items, {
          renderItem: config.renderItem,
          searchable: config.searchable,
          textOf: config.textOf,
          onSelect: config.onSelect,
        });
      });
    });
  });
})();
