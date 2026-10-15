(function () {
  "use strict";

  //course names & prefixes
  const OWN_PREFIX = {
    "Super Mario Kart": "SNES", "Mario Kart 64": "N64", "Mario Kart: Super Circuit": "GBA",
    "Mario Kart: Double Dash!!": "GCN", "Mario Kart DS": "DS", "Mario Kart Wii": "Wii",
    "Mario Kart 7": "3DS", "Mario Kart 8": "8DX", "Mario Kart 8 Deluxe": "8DX",
    "Mario Kart Tour": "Tour", "Mario Kart World": "NS2",
  };
  const ORIGIN_OVERRIDES = { "Ninja Hideaway": "Tour", "Merry Mountain": "Tour", "Piranha Plant Cove": "Tour" };
  const PREFIXES = ["MK Live", "Wii U", "SNES", "N64", "GBA", "GCN", "3DS", "8DX", "NS2", "DS", "Wii", "Tour", "RMX"];
  const fixPrefix = t => t.replace(/^NS /, "8DX ").replace(/^World /, "NS2 ");

  //game short names
  const GAMES = [
    ["Super Mario Kart", "SNES"], ["Mario Kart 64", "N64"], ["Mario Kart: Super Circuit", "GBA"],
    ["Mario Kart: Double Dash!!", "GCN"], ["Mario Kart DS", "DS"], ["Mario Kart Wii", "Wii"],
    ["Mario Kart 7", "3DS"], ["Mario Kart 8", "8"], ["Mario Kart 8 Deluxe", "8 / 8 Deluxe"],
    ["Mario Kart Tour", "Tour"], ["Mario Kart World", "NS2"],
  ];
  const ORDER = GAMES.map(g => g[0]);
  const SHORT = Object.fromEntries(GAMES);

  const norm = s => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const hasPrefix = track => PREFIXES.some(p => track.startsWith(p + " "));

  //one answer per course
  function baseName(track, game) {
    track = fixPrefix(track);
    if (hasPrefix(track) || track.includes(" – ")) return track;
    const origin = (game === "Mario Kart 8 Deluxe" && ORIGIN_OVERRIDES[track]) || OWN_PREFIX[game] || "";
    return origin ? `${origin} ${track}` : track;
  }
  const keyOf = (track, game) => norm(baseName(track, game));

  function buildOptions(entries) {
    const groups = new Map();
    for (const e of entries) {
      const key = keyOf(e.track, e.game);
      if (!groups.has(key)) groups.set(key, { key, name: baseName(e.track, e.game), games: new Set(), consoles: new Set(), retroName: null });
      const g = groups.get(key);
      g.games.add(e.game); g.consoles.add(e.console);
      const t = fixPrefix(e.track);
      if (hasPrefix(t) && !g.retroName) g.retroName = t;
    }
    return [...groups.values()].map(g => {
      const games = [...g.games].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const name = g.retroName || g.name;
      return { key: g.key, name, games,
               search: norm(`${name} ${games.join(" ")} ${games.map(x => SHORT[x] || "").join(" ")} ${[...g.consoles].join(" ")}`) };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  //bonus question (courses that have more than one version)
  function askBonus(slotId, question, games, onPick, label = g => [SHORT[g] || g, g]) {
    const slot = document.getElementById(slotId);
    clearSlot(slotId);
    const panel = document.createElement("div");
    panel.className = "bonus-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Bonus question");
    panel.innerHTML = `<p class="bonus-tag"><img class="star-ico" src="icons/bonus-star.webp" alt=""> Correct course!</p><h2></h2><div class="bonus-options"></div>`;
    panel.querySelector("h2").textContent = question;
    const box = panel.querySelector(".bonus-options");
    for (const game of games) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "bonus-btn";
      const [big, small] = label(game);
      b.innerHTML = `<b>${big}</b><small>${small}</small>`;
      b.addEventListener("click", () => { panel.remove(); onPick(game); });
      box.appendChild(b);
    }
    slot.appendChild(panel);
    if (!slot.closest("[hidden]")) box.firstChild?.focus({ preventScroll: true });
  }

  //play another one?
  function showNext(slotId, label, onClick) {
    if (PRACTICE) return;
    const slot = document.getElementById(slotId);
    const side = rightSide(slotId);
    if (slot.querySelector(".bonus-panel") || side.querySelector(".next-panel")) return;
    const panel = document.createElement("div");
    panel.className = "next-panel";
    panel.innerHTML = `<h2>Ready for the next race?</h2><button type="button" class="go-btn next-btn"></button><small>or press Enter</small>`;
    const btn = panel.querySelector("button");
    btn.textContent = label;
    btn.addEventListener("click", () => { clearSlot(slotId); onClick(); });
    side.appendChild(panel);
    if (!slot.closest("[hidden]")) btn.focus({ preventScroll: true });
  }

  //item box random track (freeplay)
  function itemBox(hudId, onClick) {
    if (!FREE || PRACTICE) return;
    const hud = document.getElementById(hudId);
    const head = (hud.closest(".game") || document).querySelector(".mode-head") || hud.parentElement;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "item-box"; btn.dataset.tip = "Randomize Track";
    btn.setAttribute("aria-label", "Randomize Track");
    btn.innerHTML = `<img src="menu/item-box.webp" alt="">`;
    btn.addEventListener("click", () => { btn.classList.remove("spin"); void btn.offsetWidth; btn.classList.add("spin"); onClick(); });
    btn.addEventListener("animationend", e => { if (e.animationName === "item-spin") btn.classList.remove("spin"); });
    head.appendChild(btn);
  }

  //seen minimaps (kartography counter)
  const SEEN_KEY = "minimapped-seen";
  function seen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { return new Set(); } }
  function markSeen(id) {
    if (!id) return; const s = seen(); if (s.has(id)) return;
    s.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch {}
  }
  const rightSide = slotId => { const slot = document.getElementById(slotId); return slot.closest(".stage")?.querySelector(".side-right") || slot; };
  function clearSlot(slotId) {
    document.getElementById(slotId).querySelectorAll(".bonus-panel, .next-panel").forEach(n => n.remove());
    rightSide(slotId).querySelectorAll(".next-panel").forEach(n => n.remove());
  }

  //clicking enter lets you play another round as well
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.repeat) return;
    const btn = [...document.querySelectorAll(".next-panel .next-btn")].find(b => !b.closest("[hidden]"));
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.value;
    if (btn && !typing && document.activeElement !== btn) { e.preventDefault(); btn.click(); }
  });

  //freeplay / practice check
  const FREE = /^#(free|pr-)/.test(location.hash);
  const PRACTICE = /^#pr-/.test(location.hash);
  if (FREE) document.documentElement.classList.add("is-free");

  //freeplay stats
  const FREE_KEY = "minimapped-free-stats";
  function addFree(mode, change) {
    if (PRACTICE) return;
    let all; try { all = JSON.parse(localStorage.getItem(FREE_KEY)) || {}; } catch { all = {}; }
    all[mode] = all[mode] || {}; change(all[mode]);
    try { localStorage.setItem(FREE_KEY, JSON.stringify(all)); } catch {}
  }

  //game logos + colors
  const LOGOS = {
    "Super Mario Kart":          ["SNES.webp",  "#a99cff"],
    "Mario Kart 64":             ["N64.webp",   "#8fd136"],
    "Mario Kart: Super Circuit": ["GBA.webp",   "#ffb11f"],
    "Mario Kart: Double Dash!!": ["GCN.webp",   "#ff7a1a"],
    "Mario Kart DS":             ["DS.webp",    "#e3262b"],
    "Mario Kart Wii":            ["Wii.webp",   "#3fb8ec"],
    "Mario Kart 7":              ["3DS.webp",   "#ff3b2f"],
    "Mario Kart 8":              ["8-8DX.webp", "#ff5fb0"],
    "Mario Kart 8 Deluxe":       ["8-8DX.webp", "#ff5fb0"],
    "Mario Kart Tour":           ["Tour.webp",  "#ef2b2d"],
    "Mario Kart World":          ["World.webp", "#ffc531"],
  };
  function logoEl(game) {
    const wrap = document.createElement("span");
    wrap.className = "meta-logo";
    const logo = (LOGOS[game] || [])[0];
    if (logo) { const img = document.createElement("img"); img.src = "logos/" + logo; img.alt = game; wrap.appendChild(img); }
    else wrap.textContent = game;
    return wrap;
  }

  const PREFIX_GAME = Object.fromEntries(Object.entries(OWN_PREFIX).map(([g, p]) => [p, g]));
  Object.assign(PREFIX_GAME, { "8DX": "Mario Kart 8 Deluxe", "RMX": "Mario Kart Tour", "Wii U": "Mario Kart 8" });
  const splitPrefix = name => {
    const p = PREFIXES.find(x => name.startsWith(x + " "));
    return p ? [p, name.slice(p.length + 1)] : ["", name];
  };

  //search + abbreviations
  function abbrs(name) {
    const [p, rest] = splitPrefix(name);
    const words = norm(rest.replace(/[-–]/g, " ")).split(" ").filter(Boolean);
    const init = words.map(w => (/^\d+$/.test(w) ? w : w[0])).join("");
    const keepCaps = rest.split(/[\s-]+/).map(w => (/^[A-Z]{2,}$/.test(w) ? w.toLowerCase() : /^\d+$/.test(w) ? w : norm(w)[0] || "")).join("");
    const pre = norm(p).replace(/ /g, "");
    const out = new Set([init, keepCaps]);
    if (pre) { out.add(pre[0] + init); out.add(pre + init); out.add(pre + keepCaps); }
    return [...out].filter(a => a.length >= 2);
  }
  function searchOptions(query, options, guessed) {
    const words = norm(query).split(" ").filter(Boolean);
    if (!words.length) return { hits: [], used: [] };
    const compact = words.join("");
    const hits = [], used = [];
    options.forEach((o, i) => {
      if (!o._abbr) o._abbr = abbrs(o.name);
      const nm = norm(o.name);
      const viaAbbr = w => w.length >= 2 && o._abbr.some(a => a.startsWith(w));
      const ok = words.every(w => o.search.includes(w) || viaAbbr(w)) || (compact.length >= 2 && viaAbbr(compact));
      if (!ok) return;
      let s = 0;
      if (o._abbr.includes(compact)) s += 30;
      else if (viaAbbr(compact)) s += 12;
      s += words.filter(w => nm.split(" ").some(x => x.startsWith(w))).length * 4;
      s += words.filter(w => nm.includes(w)).length * 2;
      if (nm.startsWith(norm(query))) s += 6;
      (guessed.has(o.key) ? used : hits).push({ o, i, s, words, compact });
    });
    const by = (a, b) => b.s - a.s || a.i - b.i;
    return { hits: hits.sort(by).slice(0, 40), used: used.sort(by).slice(0, 6) };
  }

  //autofill suggestions
  const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function inkFor(hex) {
    const [r, g, b] = (hex || "#888888").match(/\w\w/g).map(h => parseInt(h, 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#1b1d2b" : "#fff";
  }
  const chip = (label, game) => {
    const col = (LOGOS[game] || [])[1] || "#888888";
    return `<span class="g-chip" style="--c:${col};--ci:${inkFor(col)}">${escHtml(label)}</span>`;
  };
  function highlight(text, words, compact, o) {
    const lower = text.toLowerCase(), mark = new Array(text.length).fill(false);
    let any = false;
    for (const w of words) {
      let at = lower.indexOf(w);
      while (at >= 0 && mark[at]) at = lower.indexOf(w, at + 1);
      if (at >= 0) { for (let k = at; k < at + w.length; k++) mark[k] = true; any = true; }
    }
    if (!any && o && o._abbr.some(a => a.startsWith(compact))) {
      text.replace(/\d+|[A-Za-z]+/g, (m, at) => { if (/^\d+$/.test(m)) for (let k = 0; k < m.length; k++) mark[at + k] = true; else mark[at] = true; return m; });
    }
    let out = "", open = false;
    for (let k = 0; k < text.length; k++) {
      if (mark[k] !== open) { out += mark[k] ? "<mark>" : "</mark>"; open = mark[k]; }
      out += escHtml(text[k]);
    }
    return out + (open ? "</mark>" : "");
  }
  function suggestionHTML(hit, usedRow) {
    const { o, words, compact } = hit;
    const [p, rest] = splitPrefix(o.name);
    const head = p ? chip(p, PREFIX_GAME[p]) + " " : "";
    const body = o.name.includes(" – ") ? escHtml(o.name) : highlight(rest, words, compact, o);
    return `<span class="sg-name">${head}${body}</span>`;
  }

  //race counter
  const FLAG = `<img class="hud-flag" src="flag.webp" alt="">`;
  function setHud(id, { mode, big, of, unit = "", sub = "" }) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<span class="hud-mode"></span>
      <span class="hud-main">${FLAG}<span class="hud-big">${big}${of !== undefined ? `<small>/${of}</small>` : unit ? `<small>${unit}</small>` : ""}</span></span>
      <span class="hud-sub"></span>`;
    el.querySelector(".hud-mode").textContent = mode;
    el.querySelector(".hud-sub").textContent = sub;
    const tag = document.getElementById(id + "-tag");
    if (tag) tag.textContent = mode;
  }

  //cup icons 8dx only cuz they have all base cups + its unique dlc stuff
  const CUP_ICONS = new Set(["mushroom", "flower", "star", "special", "shell", "banana", "leaf", "lightning", "egg", "crossing", "triforce", "bell",
    "golden-dash", "lucky-cat", "turnip", "propeller", "rock", "moon", "boomerang", "fruit", "feather", "cherry", "spiny", "acorn"]);
  function cupIcon(cup) {
    const s = String(cup || "").toLowerCase().replace(/^extra /, "").replace(/ cup$/, "").replace(/[^a-z0-9]+/g, "-");
    return CUP_ICONS.has(s) ? `<img class="cup-ico" src="icons/cups/${s}.webp" alt="">` : "";
  }

  //shared stuff
  //og mk8 cups were on wii u too, booster courses & battle are switch only
  const WIIU_CUPS = ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup", "Shell Cup", "Banana Cup", "Leaf Cup", "Lightning Cup",
                     "Egg Cup", "Triforce Cup", "Crossing Cup", "Bell Cup"];
  const consoleOf = m => /^Mario Kart 8/.test(m.game) && WIIU_CUPS.includes(m.cup) ? "Wii U / Switch" : m.console;

  window.MinimappedCourses = { consoleOf, baseName, keyOf, buildOptions, askBonus, setHud, showNext, itemBox, seen, markSeen, clearSlot, FREE, PRACTICE, addFree, LOGOS, logoEl, searchOptions, suggestionHTML, short: g => SHORT[g] || g, norm, ORDER, cupIcon };
})();
