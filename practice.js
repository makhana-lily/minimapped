(function () {
  "use strict";
  const C = window.MinimappedCourses;
  const $ = id => document.getElementById(id);
  const DATA = window.MINIMAPPED;
  const DRAW = window.MINIMAPPED_DRAW || {}, DRAW_EXTRA = window.MINIMAPPED_DRAW_PRACTICE || {};

  //notes
  const NOTES_KEY = "minimapped-notes";
  const notes = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; } catch { return {}; } };
  let noteTimer = 0;
  document.addEventListener("input", e => {
    const t = e.target; if (t.id !== "pr-notes-text") return;
    const status = t.parentElement.querySelector(".pr-notes-status"); status.textContent = "Saving...";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const all = notes(), v = t.value.trim();
      if (v) all[t.dataset.id] = t.value; else delete all[t.dataset.id];
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); status.textContent = v ? "Saved on this device" : "Only you can see this"; }
      catch { status.textContent = "Couldn't save (storage is full or blocked)"; }
    }, 400);
  });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROOT = "#kartography";

  //the mk games featured. arcade games later?
  const GAMES = [
    { slug: "snes",  games: ["Super Mario Kart"] },
    { slug: "n64",   games: ["Mario Kart 64"] },
    { slug: "gba",   games: ["Mario Kart: Super Circuit"] },
    { slug: "gcn",   games: ["Mario Kart: Double Dash!!"] },
    { slug: "ds",    games: ["Mario Kart DS"] },
    { slug: "wii",   games: ["Mario Kart Wii"] },
    { slug: "3ds",   games: ["Mario Kart 7"] },
    { slug: "8dx",   games: ["Mario Kart 8 Deluxe", "Mario Kart 8"] },
    { slug: "tour",  games: ["Mario Kart Tour"] },
    { slug: "world", games: ["Mario Kart World"] },
  ];
  const slugOf = key => key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  //build the track list
  const catalog = {}, backOf = {};
  for (const g of GAMES) catalog[g.slug] = new Map();
  const gameSlug = game => (GAMES.find(g => g.games.includes(game)) || {}).slug;
  const CROWN = { "world-crowncity-mushroom-cup": "Mushroom Cup", "world-crowncity-shell-cup": "Shell Cup",
                  "world-crown-city-route-4": "Route 4", "world-crowncity-vs-only": "VS Only" };
  const layoutLabel = (v, k) => CROWN[v.id] || v.src.note || v.src.cup || "Version " + (k + 1);
  function add(m) {
    const gs = gameSlug(m.game); if (!gs) return;
    const track = m.map_id in CROWN ? "Crown City" : m.track;
    const cs = slugOf(C.keyOf(track, m.game)), list = catalog[gs];
    if (!list.has(cs)) list.set(cs, { slug: cs, name: C.baseName(track, m.game), game: m.game, maps: [] });
    list.get(cs).maps.push({ id: m.map_id, src: m, draw: !!DRAW[m.map_id] || !!DRAW_EXTRA[m.map_id], secret: !DRAW[m.map_id] && !!DRAW_EXTRA[m.map_id] && !DRAW_EXTRA[m.map_id].quiet });
    backOf[m.map_id] = `${ROOT}/${gs}/${cs}`;
  }
  DATA.maps.forEach(add);
  (window.MINIMAPPED_DRAW_MAPS || []).forEach(add);
  (window.MINIMAPPED_KART_MAPS || []).forEach(add);
  for (const c of catalog.world.values())
    if (c.maps.some(v => v.id in CROWN)) c.maps.sort((a, b) => Object.keys(CROWN).indexOf(a.id) - Object.keys(CROWN).indexOf(b.id));

  //random track button
  const itemBtn = `<button type="button" class="item-box pr-random" data-tip="Randomize Track" aria-label="Randomize Track"><img src="menu/item-box.webp" alt=""></button>`;
  function randomCourse() {
    const all = [];
    for (const g of GAMES) for (const c of catalog[g.slug].values()) c.maps.forEach((m, i) => all.push(`${ROOT}/${g.slug}/${c.slug}${i ? "/" + i : ""}`));
    let pick; do { pick = all[Math.floor(Math.random() * all.length)]; } while (pick === location.hash && all.length > 1);
    location.hash = pick;
  }
  document.addEventListener("click", e => { if (e.target.closest(".pr-random")) randomCourse(); });
  const headRow = html => `<div class="pr-headrow">${html}${itemBtn}</div>`;
  const local = c => {
    const own = C.baseName("x", c.game).slice(0, -1);
    let n = own && c.name.startsWith(own) ? c.name.slice(own.length) : c.name;
    if (c.game === "Mario Kart Tour") n = n.replace(/^8DX (?=Sky-High Sundae$|Yoshi's Island$|Squeaky Clean Sprint$)/, "");
    return n;
  };
  const isTitle = note => /^(SNES|N64|GBA|GCN|DS|Wii|3DS|8DX|Tour|RMX|NS2) /.test(note || "");
  const mapTitle = (c, m) => isTitle(m.src.note) ? m.src.note : local(c);
  const logo = game => {
    const l = (C.LOGOS[game] || [])[0];
    return l ? `<img src="logos/${l}" alt="${esc(game)}">` : `<b>${esc(game)}</b>`;
  };
  const colour = game => (C.LOGOS[game] || [])[1] || "#888888";

  //game picker
  function renderGames() {
    return `<div class="pr-titlewrap"><div class="pr-titleblock"><h1 class="pr-title">Kartography</h1><p class="pr-sub">Refresh your minimap knowledge!</p>${itemBtn}</div></div>
      ${progressBar()}
      <div class="pr-games">` + GAMES.map(g => {
        const n = [...catalog[g.slug].values()].reduce((t, c) => t + c.maps.length, 0), p = gameProgress(g.slug);
        return `<a class="pr-game" href="${ROOT}/${g.slug}" style="--game:${colour(g.games[0])}">
          ${logo(g.games[0])}<small>${n} map${n === 1 ? "" : "s"}</small>
          ${p.total ? `<small class="pr-game-seen">&#10003; ${p.seen} / ${p.total} seen</small>` : ""}</a>`;
      }).join("") + `</div>` + renderFavs();
  }

  //seen in dailies
  const DAILY_IDS = new Set([...(DATA.schedule || []), ...(window.MINIMAPPED_DRAW_SCHEDULE || [])]);
  const collectable = id => DAILY_IDS.has(id) && where[id];
  const isSeen = id => C.seen().has(id);
  function gameProgress(gs) {
    let total = 0, got = 0; const s = C.seen();
    for (const c of catalog[gs].values()) for (const m of c.maps) if (collectable(m.id)) { total++; if (s.has(m.id)) got++; }
    return { total, seen: got };
  }
  function progressBar() {
    const s = C.seen(); let total = 0, got = 0;
    for (const id of DAILY_IDS) if (where[id]) { total++; if (s.has(id)) got++; }
    const pct = total ? Math.round(100 * got / total) : 0;
    return `<div class="pr-progress" role="button" tabindex="0" title="See which maps you've collected" aria-haspopup="dialog">
      <div class="pr-progress-top"><b>Seen in Dailies</b><span><strong>${got}</strong> / ${total} maps</span></div>
      <div class="pr-progress-bar"><i style="width:${Math.max(pct, got ? 1 : 0)}%"></i></div>
      <p class="pr-progress-note">Only minimaps you finish in <b>Daily Guess</b> or <b>Daily Draw</b> count here. Collect them all!</p>
    </div>`;
  }

  //favorites
  const FAV_KEY = "minimapped-favorites";
  const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } };
  const saveFavs = f => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {} };
  const where = {};
  for (const g of GAMES) for (const c of catalog[g.slug].values())
    c.maps.forEach((m, i) => { where[m.id] = { gs: g.slug, c, i, href: `${ROOT}/${g.slug}/${c.slug}${i ? "/" + i : ""}` }; });
  const FLIP_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="pr-flip-a" x="3" y="7" width="8.5" height="12.5" rx="1.6"/><rect x="12.5" y="7" width="8.5" height="12.5" rx="1.6"/><path d="M7 4.2c3-2 7-2 10 0"/><path d="M15.2 2.6l1.9 1.6-1.4 1.9"/></svg>`;
  const STAR_SVG = `<svg class="pr-fav-empty" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
  function favBtn(id) {
    const on = loadFavs().includes(id);
    return `<button type="button" class="pr-fav${on ? " on" : ""}" data-id="${esc(id)}" aria-pressed="${on}" title="${on ? "Remove from favorites" : "Add to favorites"}">
      ${STAR_SVG}<img class="pr-fav-full" src="menu/super-star.webp" alt=""></button>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".pr-fav"); if (!b) return;
    const id = b.dataset.id, favs = loadFavs(), on = !favs.includes(id);
    saveFavs(on ? favs.concat(id) : favs.filter(x => x !== id));
    b.classList.remove("spin"); void b.offsetWidth; b.classList.add("spin");
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
    b.title = on ? "Remove from favorites" : "Add to favorites";
  });
  document.addEventListener("click", e => {
    const x = e.target.closest(".pr-favx"); if (!x || x.classList.contains("pr-modal-x")) return;
    e.preventDefault();
    const item = x.closest(".pr-favitem"); if (item.classList.contains("gone")) return;
    saveFavs(loadFavs().filter(id => id !== x.dataset.id));
    item.classList.add("gone");
    setTimeout(() => {
      const grid = item.parentElement, others = [...grid.children].filter(el => el !== item);
      const before = new Map(others.map(el => [el, el.getBoundingClientRect()]));
      item.remove();
      if (!others.length) { const sec = document.querySelector(".pr-favs"); if (sec) sec.outerHTML = renderFavs(); return; }
      for (const el of others) {
        const a = before.get(el), b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.3,.7,.3,1)" });
      }
    }, 340);
  });
  document.addEventListener("animationend", e => { if (e.target.closest && e.target.closest(".pr-fav.spin")) e.target.closest(".pr-fav").classList.remove("spin"); });
  //fav switchers, flips snes & n64 cards to the white map
  const FAV_MONO_KEY = "minimapped-fav-mono";
  const favMono = (() => { try { return JSON.parse(localStorage.getItem(FAV_MONO_KEY)) || {}; } catch { return {}; } })();
  const flippable = id => { const w = where[id]; return w && (w.gs === "snes" || w.gs === "n64") && w.c.maps[w.i].src.type !== "battle"; };
  const isMono = id => flippable(id) && !!(favMono[id] ?? favMono[where[id].gs]);
  const favSrc = id => isMono(id) ? `maps/${id}.png` : `maps-raw/${id}.webp`;
  document.addEventListener("click", e => {
    const b = e.target.closest(".pr-favflip"); if (!b) return;
    e.preventDefault();
    const id = b.dataset.id; favMono[id] = !isMono(id);
    try { localStorage.setItem(FAV_MONO_KEY, JSON.stringify(favMono)); } catch {}
    b.setAttribute("aria-pressed", favMono[id]);
    const img = b.closest(".pr-favitem")?.querySelector(".pr-favcard-map img"); if (!img) return;
    img.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: 160, easing: "ease-in" }).onfinish = () => {
      img.src = favSrc(id); img.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 160, easing: "ease-out" });
    };
  });
  function renderFavs() {
    const favs = loadFavs().filter(id => where[id]);
    const cards = favs.map(id => {
      const w = where[id], game = w.c.game, m = w.c.maps[w.i];
      const name = isTitle(m.src.note) ? m.src.note : local(w.c) + (w.c.maps.length > 1 ? ` (${layoutLabel(m, w.i)})` : "");
      return `<div class="pr-favitem"><a class="pr-favcard" href="${w.href}" style="--game:${colour(game)}">
        <span class="pr-favcard-map"><img src="${favSrc(id)}" alt="" loading="lazy"></span>
        <span class="pr-favcard-name">${esc(name)}</span>${logo(game)}</a>
        <button type="button" class="pr-favx" data-id="${esc(id)}" title="Remove from favorites" aria-label="Remove ${esc(name)} from favorites"><i></i><i></i></button>${flippable(id) ? `
        <button type="button" class="pr-favflip" data-id="${esc(id)}" style="--game:${colour(game)}" aria-pressed="${isMono(id)}" title="Flip map: color or one-color" aria-label="Flip the ${esc(name)} map">${FLIP_ICON}</button>` : ""}</div>`;
    }).join("");
    return `<section class="pr-favs"><h2 class="pr-favs-title"><img src="menu/super-star.webp" alt="">Favorites</h2>` +
      (cards ? `<div class="pr-favgrid">${cards}</div>` : `<p class="pr-favs-empty">Tap the star on any track to save it here.</p>`) + `</section>`;
  }

  //seen maps popup
  function seenCard(id) {
    const w = where[id], game = w.c.game, m = w.c.maps[w.i];
    const name = isTitle(m.src.note) ? m.src.note : local(w.c) + (w.c.maps.length > 1 ? ` (${layoutLabel(m, w.i)})` : "");
    return `<div class="pr-favitem"><a class="pr-favcard" href="${w.href}" style="--game:${colour(game)}">
      <span class="pr-favcard-map"><img src="maps-raw/${esc(id)}.webp" alt="" loading="lazy"></span>
      <span class="pr-favcard-name">${esc(name)}</span>${logo(game)}</a></div>`;
  }
  function openSeen() {
    closeSeen();
    const s = C.seen(), order = [];
    for (const g of GAMES) for (const c of catalog[g.slug].values()) for (const m of c.maps) if (s.has(m.id) && collectable(m.id)) order.push(m.id);
    const total = [...DAILY_IDS].filter(id => where[id]).length;
    const box = document.createElement("div");
    box.className = "pr-modal"; box.id = "pr-seen-modal";
    box.innerHTML = `<div class="pr-modal-card" role="dialog" aria-modal="true" aria-labelledby="pr-seen-title">
      <button type="button" class="pr-favx pr-modal-x" title="Close" aria-label="Close"><i></i><i></i></button>
      <h2 class="pr-favs-title" id="pr-seen-title">Seen in Dailies <small>${order.length} / ${total}</small></h2>
      ${order.length ? `<div class="pr-favgrid">${order.map(seenCard).join("")}</div>`
        : `<p class="pr-favs-empty">Nothing yet! Finish a <b>Daily Guess</b> or <b>Daily Draw</b> and its minimap will show up here.</p>`}
    </div>`;
    document.body.appendChild(box);
    document.body.classList.add("pr-modal-open");
    requestAnimationFrame(() => box.classList.add("in"));
    box.querySelector(".pr-modal-x").focus();
  }
  function closeSeen() {
    const box = document.querySelector(".pr-modal"); if (!box) return;
    box.remove(); document.body.classList.remove("pr-modal-open");
  }
  document.addEventListener("click", e => {
    if (e.target.closest(".pr-progress")) return openSeen();
    if (e.target.closest(".menu-credits")) { e.preventDefault(); return openCredits(); }
    const box = document.querySelector(".pr-modal"); if (!box) return;
    if (e.target.closest(".pr-modal-x")) {
      const x = e.target.closest(".pr-modal-x"); x.closest(".pr-modal-card").classList.add("closing");
      box.classList.remove("in"); setTimeout(closeSeen, 260); return;
    }
    if (e.target === box) { box.classList.remove("in"); setTimeout(closeSeen, 200); }
    if (e.target.closest(".pr-favcard")) closeSeen();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.querySelector(".pr-modal")) closeSeen();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("pr-progress")) { e.preventDefault(); openSeen(); }
  });
  window.addEventListener("hashchange", closeSeen);

  //credits
  function openCredits() {
    closeSeen();
    const box = document.createElement("div");
    box.className = "pr-modal"; box.id = "pr-credits-modal";
    box.innerHTML = `<div class="pr-modal-card credits-card" role="dialog" aria-modal="true" aria-labelledby="pr-credits-title">
      <button type="button" class="pr-favx pr-modal-x" title="Close" aria-label="Close"><i></i><i></i></button>
      <h2 class="pr-favs-title" id="pr-credits-title">Credits</h2>
      <ul class="credits-list">
        <li>Racers Delight font by @ImWhoreHay</li>
        <li>Minimaps and Mario Kart World stickers sourced from the Super Mario Wiki</li>
        <li>Inspired by Wordle, Worldle, Heardle, and all the amazing "-dle" games out there!</li>
        <li>Developed by Makhana, please email me with any comments, questions, or suggestions!</li>
      </ul>
      <p class="credits-contact">Contact me! <a href="mailto:pricklywaterlilies@gmail.com">pricklywaterlilies@gmail.com</a></p>
    </div>`;
    document.body.appendChild(box);
    document.body.classList.add("pr-modal-open");
    requestAnimationFrame(() => box.classList.add("in"));
    box.querySelector(".pr-modal-x").focus();
  }

  //cups per game
  const NITRO_CUPS = ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup", "Shell Cup", "Banana Cup", "Leaf Cup", "Lightning Cup"];
  const CUPS = {
    snes: ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup"],
    n64: ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup"],
    gba: ["Mushroom Cup", "Flower Cup", "Lightning Cup", "Star Cup", "Special Cup",
          "Extra Mushroom Cup", "Extra Flower Cup", "Extra Lightning Cup", "Extra Star Cup", "Extra Special Cup"],
    gcn: ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup"],
    ds: NITRO_CUPS, wii: NITRO_CUPS, "3ds": NITRO_CUPS,
    world: ["Mushroom Cup", "Flower Cup", "Star Cup", "Shell Cup", "Banana Cup", "Leaf Cup", "Lightning Cup", "Special Cup"],
    "8dx": NITRO_CUPS.concat(["Egg Cup", "Triforce Cup", "Crossing Cup", "Bell Cup", "Golden Dash Cup", "Lucky Cat Cup",
      "Turnip Cup", "Propeller Cup", "Rock Cup", "Moon Cup", "Fruit Cup", "Boomerang Cup", "Feather Cup", "Cherry Cup",
      "Acorn Cup", "Spiny Cup"]),
  };

  //track order
  const ORDER = {
    //super mario kart tracks
    snes: ["Mario Circuit 1", "Donut Plains 1", "Ghost Valley 1", "Bowser Castle 1", "Mario Circuit 2",
           "Choco Island 1", "Ghost Valley 2", "Donut Plains 2", "Bowser Castle 2", "Mario Circuit 3",
           "Koopa Beach 1", "Choco Island 2", "Vanilla Lake 1", "Bowser Castle 3", "Mario Circuit 4",
           "Donut Plains 3", "Koopa Beach 2", "Ghost Valley 3", "Vanilla Lake 2", "Rainbow Road"],

    //wii tracks
    wii: ["Luigi Circuit", "Moo Moo Meadows", "Mushroom Gorge", "Toad's Factory", "Mario Circuit", "Coconut Mall", "DK Summit",
          "Wario's Gold Mine", "Daisy Circuit", "Koopa Cape", "Maple Treeway", "Grumble Volcano", "Dry Dry Ruins",
          "Moonview Highway", "Bowser's Castle", "Rainbow Road", "GCN Peach Beach", "DS Yoshi Falls", "SNES Ghost Valley 2",
          "N64 Mario Raceway", "N64 Sherbet Land", "GBA Shy Guy Beach", "DS Delfino Square", "GCN Waluigi Stadium",
          "DS Desert Hills", "GBA Bowser Castle 3", "N64 DK's Jungle Parkway", "GCN Mario Circuit", "SNES Mario Circuit 3",
          "DS Peach Gardens", "GCN DK Mountain", "N64 Bowser's Castle"],

    //mario kart 7 tracks
    "3ds": ["Toad Circuit", "Daisy Hills", "Cheep Cheep Lagoon", "Shy Guy Bazaar", "Wuhu Loop", "Mario Circuit", "Music Park",
            "Rock Rock Mountain", "Piranha Plant Slide", "Wario Shipyard", "Neo Bowser City", "Maka Wuhu", "DK Jungle",
            "Rosalina's Ice World", "Bowser's Castle", "Rainbow Road", "N64 Luigi Raceway", "GBA Bowser Castle 1",
            "Wii Mushroom Gorge", "DS Luigi's Mansion", "N64 Koopa Troopa Beach", "SNES Mario Circuit 2", "Wii Coconut Mall",
            "DS Waluigi Pinball", "N64 Kalimari Desert", "DS DK Pass", "GCN Daisy Cruiser", "Wii Maple Treeway", "Wii Koopa Cape",
            "GCN Dino Dino Jungle", "DS Airship Fortress", "SNES Rainbow Road"],

    //8 deluxe tracks (+ booster course)
    "8dx": ["Mario Kart Stadium", "Water Park", "Sweet Sweet Canyon", "Thwomp Ruins", "Mario Circuit", "Toad Harbor",
            "Twisted Mansion", "Shy Guy Falls", "Sunshine Airport", "Dolphin Shoals", "Electrodrome", "Mount Wario",
            "Cloudtop Cruise", "Bone-Dry Dunes", "Bowser's Castle", "Rainbow Road", "Wii Moo Moo Meadows", "GBA Mario Circuit",
            "DS Cheep Cheep Beach", "N64 Toad's Turnpike", "GCN Dry Dry Desert", "SNES Donut Plains 3", "N64 Royal Raceway",
            "3DS DK Jungle", "DS Wario Stadium", "GCN Sherbet Land", "3DS Music Park", "N64 Yoshi Valley", "DS Tick-Tock Clock",
            "3DS Piranha Plant Slide", "Wii Grumble Volcano", "N64 Rainbow Road", "GCN Yoshi Circuit", "Excitebike Arena",
            "Dragon Driftway", "Mute City", "Wii Wario's Gold Mine", "SNES Rainbow Road", "Ice Ice Outpost", "Hyrule Circuit",
            "GCN Baby Park", "GBA Cheese Land", "Wild Woods", "Animal Crossing", "3DS Neo Bowser City", "GBA Ribbon Road",
            "Super Bell Subway", "Big Blue", "Tour Paris Promenade", "3DS Toad Circuit", "N64 Choco Mountain", "Wii Coconut Mall",
            "Tour Tokyo Blur", "DS Shroom Ridge", "GBA Sky Garden", "Ninja Hideaway", "Tour New York Minute", "SNES Mario Circuit 3",
            "N64 Kalimari Desert", "DS Waluigi Pinball", "Tour Sydney Sprint", "GBA Snow Land", "Wii Mushroom Gorge",
            "Sky-High Sundae", "Tour London Loop", "GBA Boo Lake", "3DS Rock Rock Mountain", "Wii Maple Treeway",
            "Tour Berlin Byways", "DS Peach Gardens", "Merry Mountain", "3DS Rainbow Road", "Tour Amsterdam Drift",
            "GBA Riverside Park", "Wii DK Summit", "Yoshi's Island", "Tour Bangkok Rush", "DS Mario Circuit", "GCN Waluigi Stadium",
            "Tour Singapore Speedway", "Tour Athens Dash", "GCN Daisy Cruiser", "Wii Moonview Highway", "Squeaky Clean Sprint",
            "Tour Los Angeles Laps", "GBA Sunset Wilds", "Wii Koopa Cape", "Tour Vancouver Velocity", "Tour Rome Avanti",
            "GCN DK Mountain", "Wii Daisy Circuit", "Piranha Plant Cove", "Tour Madrid Drive", "3DS Rosalina's Ice World",
            "SNES Bowser Castle 3", "Wii Rainbow Road"],

    //world tracks
    world: ["Mario Bros. Circuit", "Crown City (Mushroom Cup)", "Whistlestop Summit", "DK Spaceport", "DS Desert Hills",
            "3DS Shy Guy Bazaar", "N64 Wario Stadium", "DS Airship Fortress", "DS DK Pass", "Starview Peak", "8DX Sky-High Sundae",
            "3DS Wario Shipyard", "SNES Koopa Beach 2", "Faraway Oasis", "Crown City (Shell Cup)", "Peach Stadium",
            "GCN Peach Beach", "Salty Salty Speedway", "GCN Dino Dino Jungle", "Great ? Block Ruins", "Cheep Cheep Falls",
            "Dandelion Depths", "Boo Cinema", "Dry Bones Burnout", "Wii Moo Moo Meadows", "N64 Choco Mountain",
            "Wii Toad's Factory", "Bowser's Castle", "Acorn Heights", "SNES Mario Circuit", "Peach Stadium@Special Cup", "Rainbow Road"],
  };

  //tour tracks
  const TOUR_CITIES = ["New York Minute", "Tokyo Blur", "Paris Promenade", "London Loop", "Vancouver Velocity", "Los Angeles Laps",
    "Berlin Byways", "Sydney Sprint", "Singapore Speedway", "Amsterdam Drift", "Bangkok Rush", "Athens Dash", "Rome Avanti",
    "Madrid Drive", "Piranha Plant Cove"];
  const TOUR_NEW = ["Merry Mountain", "Ninja Hideaway", "Sky-High Sundae", "Yoshi's Island", "Piranha Plant Pipeline", "Squeaky Clean Sprint"];
  const TOUR_RETRO = ["SNES", "N64", "GBA", "GCN", "DS", "Wii", "3DS"];
  const EXTRA_IDS = new Set(["world-crown-city-route-4"]);

  //group tracks into cups
  function groupOf(gs, m) {
    if (m.type === "battle") return "Battle";
    if (gs === "tour") {
      if (/^RMX /.test(m.track)) return "RMX";
      const city = m.track.replace(/ \d+$/, "");
      if (TOUR_CITIES.includes(city)) return city;
      const bare = m.track.replace(/^(Tour|8DX) /, "");
      if (TOUR_NEW.includes(bare)) return bare;
      const pf = (m.track.match(/^(SNES|N64|GBA|GCN|DS|Wii|3DS) /) || [])[1];
      return pf || "Extras";
    }
    if (gs === "world" && m.map_id in CROWN && !["Mushroom Cup", "Shell Cup"].includes(CROWN[m.map_id])) return "Extras";
    if (EXTRA_IDS.has(m.map_id) || !(CUPS[gs] || []).includes(m.cup)) return gs === "world" && /^SNES /.test(m.track) ? "SNES Extras" : "Extras";
    return m.cup;
  }
  function cupsFor(gs) {
    const groups = new Map();
    let n = 0;
    for (const c of catalog[gs].values())
      c.maps.forEach((v, i) => {
        const gname = groupOf(gs, v.src), key = gname + "|" + c.slug + (gname === "Extras" ? "|" + i : "");
        if (!groups.has(gname)) groups.set(gname, new Map());
        if (!groups.get(gname).has(key)) groups.get(gname).set(key, { c, i, track: v.src.track, n: n++ });
      });
    const order = gs === "tour" ? TOUR_CITIES.concat(TOUR_NEW, ["RMX"], TOUR_RETRO) : (CUPS[gs] || []);
    const az = name => gs === "tour" && TOUR_RETRO.includes(name);
    const rank = name => { const k = order.indexOf(name); return k >= 0 ? k : name === "Battle" ? 900 : name === "SNES Extras" ? 950 : name === "Extras" ? 999 : 500; };
    const trackRank = (e, cup) => { const o = ORDER[gs] || [], c = o.indexOf(e.track + "@" + cup), k = c >= 0 ? c : o.indexOf(e.track); return k >= 0 ? k : 1000 + e.n; };
    return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([name, m]) => [name, [...m.values()].sort((a, b) => (az(name) ? 0 : trackRank(a, name) - trackRank(b, name)) ||
        local(a.c).localeCompare(local(b.c), undefined, { numeric: true, sensitivity: "base" }))]);
  }

  //TOUR section, have old game's logos
  const RETRO_LOGO = { SNES: "Super Mario Kart", N64: "Mario Kart 64", GBA: "Mario Kart: Super Circuit",
    GCN: "Mario Kart: Double Dash!!", DS: "Mario Kart DS", Wii: "Mario Kart Wii", "3DS": "Mario Kart 7" };
  function headIcon(gs, cup) {
    const game = gs === "tour" && RETRO_LOGO[cup], file = game && (C.LOGOS[game] || [])[0];
    return file ? `<img class="cup-logo" src="logos/${file}" alt="">` : C.cupIcon(cup);
  }

  //track list
  function renderTracks(gs) {
    const g = GAMES.find(x => x.slug === gs); if (!g) return renderGames();
    return headRow(`<div class="pr-head" style="--game:${colour(g.games[0])}">${logo(g.games[0])}</div>`) + `
      <div class="pr-cups" style="--game:${colour(g.games[0])}">` + cupsFor(gs).map(([cup, list]) =>
        `<section class="pr-cup"><h3>${headIcon(gs, cup)}<span>${esc(cup)}</span></h3><ol>` + list.map(e =>
          `<li><a class="pr-track${isSeen(e.c.maps[e.i].id) ? " seen" : ""}" href="${ROOT}/${gs}/${e.c.slug}${e.i ? "/" + e.i : ""}"${isSeen(e.c.maps[e.i].id) ? ' title="Seen in a Daily"' : ""}>${esc(local(e.c) + (cup === "Extras" && e.c.maps.length > 1 ? ` (${layoutLabel(e.c.maps[e.i], e.i)})` : ""))}</a></li>`).join("") +
        `</ol></section>`).join("") + `</div>` + (GAME_NOTE[gs] ? `<ul class="pr-gamenote" style="--game:${colour(g.games[0])}"><li>${GAME_NOTE[gs]}</li></ul>` : "") + gameArrows(gs);
  }
  const GAME_NOTE = { snes: "Note: SNES minimaps are traced from larger, colored maps to preserve quality.", n64: "Note: N64 minimaps traced from larger, colored maps to preserve quality." };

  //prev/next game arrows
  function gameArrows(gs) {
    const k = GAMES.findIndex(x => x.slug === gs), prev = GAMES[k - 1], next = GAMES[k + 1];
    const arrow = (g, side, ch) => g
      ? `<a class="pr-gamearrow ${side}" href="${ROOT}/${g.slug}" style="--game:${colour(g.games[0])}" title="${esc(g.games[g.games.length > 1 ? 1 : 0])}" aria-label="${side === "left" ? "Previous" : "Next"} game: ${esc(g.games[0])}">${ch}</a>`
      : `<span class="pr-gamearrow ${side}" aria-disabled="true">${ch}</span>`;
    return arrow(prev, "left", "&lsaquo;") + arrow(next, "right", "&rsaquo;");
  }
  document.addEventListener("keydown", e => {
    if (!/^#kartography\/[^/]+$/.test(location.hash) || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ""))) return;
    const a = document.querySelector(`a.pr-gamearrow.${e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : "none"}`);
    if (a) { e.preventDefault(); location.hash = a.getAttribute("href"); }
  });

  let shown = { gs: null, cs: null, i: 0 };

  //track page
  function renderCourse(gs, cs, i = 0) {
    const c = catalog[gs] && catalog[gs].get(cs); if (!c) return renderTracks(gs);
    i = Math.min(i, c.maps.length - 1); shown = { gs, cs, i };
    const m = c.maps[i];
    const variants = c.maps.length > 1 ? `<div class="pr-variants">` + c.maps.map((v, k) =>
      `<button type="button" class="pr-variant" data-i="${k}" aria-pressed="${k === i}">${esc(layoutLabel(v, k))}</button>`).join("") + `</div>` : "";
    const battle = !((gs === "snes" || gs === "n64") && m.src.type !== "battle");
    const drawBtn = m.draw
      ? `<a class="pr-draw${m.secret ? " pr-secret" : ""}" href="#pr-draw:${encodeURIComponent(m.id)}" title="Practice drawing it from memory">
           <span aria-hidden="true">&#9998;</span> ${m.secret ? `<img class="star-ico" src="icons/secret-star.webp" alt=""> Draw the whole ${/Piranha Plant Cove/.test(m.src.track) ? "cove" : "city"}!` : "Draw it from memory"}</a>`
      : "";
    return headRow(`<a class="pr-head pr-head-link" href="${ROOT}/${gs}" style="--game:${colour(c.game)}" title="All ${esc(c.game)} tracks" aria-label="All ${esc(c.game)} tracks">${logo(c.game)}</a>`) + `
      <h2 class="pr-course">${esc(mapTitle(c, m))}</h2>
      ${collectable(m.id) ? (isSeen(m.id) ? `<p class="pr-seen-badge on">&#10003; Seen in a Daily</p>` : `<p class="pr-seen-badge">Not seen in a Daily yet</p>`) : ""}${variants}
      <div class="pr-view" style="--game:${colour(c.game)}">
        <div class="pr-mapcol">
          <div class="pr-map${flip && !battle ? " mono" : ""}"><div class="pr-card"><img class="pr-face" src="maps-raw/${esc(m.id)}.webp" alt="${esc(mapTitle(c, m))} minimap">${battle ? "" : `<img class="pr-face pr-back" src="maps/${esc(m.id)}.png" alt="" loading="lazy">`}</div>${favBtn(m.id)}${battle ? "" : FLIP_BTN}${drawBtn}</div>
          ${seqNav(gs, cs, i)}
        </div>
        <aside class="pr-notes">
          <label class="side-tag" for="pr-notes-text">Notes:</label>
          <textarea id="pr-notes-text" data-id="${esc(m.id)}" maxlength="2000" spellcheck="true"
            placeholder="Write your thoughts on this track...">${esc(notes()[m.id] || "")}</textarea>
          <small class="pr-notes-status" aria-live="polite">${notes()[m.id] ? "Saved on this device" : "Only you can see this"}</small>
        </aside>
      </div>${similar(gs, cs)}`;
  }

  //turn card (snes & n64)
  const FLIP_KEY = "minimapped-kart-mono";
  let flip = (() => { try { return localStorage.getItem(FLIP_KEY) === "1"; } catch { return false; } })();
  const FLIP_BTN = `<button type="button" class="pr-flip" title="Turn card" aria-label="Turn card: color or one-color map">
    ${FLIP_ICON}</button>`;
  document.addEventListener("click", e => {
    const b = e.target.closest(".pr-flip"); if (!b) return;
    const card = b.closest(".pr-map"), inner = card.querySelector(".pr-card");
    flip = card.classList.toggle("mono");
    const turns = (+inner.dataset.turns || (flip ? 0 : 1)) + 1;
    inner.dataset.turns = turns; inner.style.transform = `rotateY(${turns * -180}deg)`;
    try { localStorage.setItem(FLIP_KEY, flip ? "1" : "0"); } catch {}
  });

  //prev/next track
  let SEQ = null;
  function sequence() {
    if (SEQ) return SEQ;
    SEQ = [];
    for (const g of GAMES) for (const [, list] of cupsFor(g.slug)) for (const e of list)
      SEQ.push({ gs: g.slug, cs: e.c.slug, i: e.i, name: mapTitle(e.c, e.c.maps[e.i]), game: e.c.game, href: `${ROOT}/${g.slug}/${e.c.slug}${e.i ? "/" + e.i : ""}` });
    return SEQ;
  }
  function seqNav(gs, cs, i) {
    const seq = sequence();
    let k = seq.findIndex(e => e.gs === gs && e.cs === cs && e.i === i);
    if (k < 0) k = seq.findIndex(e => e.gs === gs && e.cs === cs);
    const prev = k > 0 ? seq[k - 1] : null, next = k >= 0 && k < seq.length - 1 ? seq[k + 1] : null;
    const btn = (e, cls, label) => e
      ? `<a class="pr-seq-btn ${cls}" href="${e.href}" title="${esc(e.name)} (${esc(C.short(e.game))})">${label}</a>`
      : `<span class="pr-seq-btn ${cls}" aria-disabled="true">${label}</span>`;
    return `<nav class="pr-seq" aria-label="Track order">${btn(prev, "pr-seq-prev", "&lsaquo; Previous Track")}${btn(next, "pr-seq-next", "Next Track &rsaquo;")}</nav>`;
  }

  //similar tracks
  function similar(gs, cs) {
    const others = GAMES.filter(g => g.slug !== gs && catalog[g.slug].has(cs));
    if (!others.length) return "";
    return `<div class="pr-similar"><p class="side-tag">See similar tracks:</p><div class="pr-similar-list">` +
      others.map(g => {
        const game = catalog[g.slug].get(cs).game;
        return `<a class="pr-game pr-sim" href="${ROOT}/${g.slug}/${cs}" style="--game:${colour(game)}" title="${esc(game)}">${logo(game)}</a>`;
      }).join("") + `</div></div>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".pr-variant"); if (!b) return;
    $("practice-body").innerHTML = renderCourse(shown.gs, shown.cs, +b.dataset.i);
    const k = +b.dataset.i;
    history.replaceState(null, "", `${ROOT}/${shown.gs}/${shown.cs}${k ? "/" + k : ""}`);
  });

  //routing
  function render(parts) {
    const p = Array.isArray(parts) ? parts : [];
    const rawGs = p[0], rawCs = p[1], rawVi = p[2];

    const gs = typeof rawGs === "string" && catalog[rawGs] ? rawGs : "";
    const cs = gs && typeof rawCs === "string" && catalog[gs].has(rawCs) ? rawCs : "";

    let vi = 0;
    if (cs) {
      const c = catalog[gs].get(cs);
      const n = Number.parseInt(rawVi, 10);
      vi = Number.isFinite(n) ? Math.max(0, Math.min(n, c.maps.length - 1)) : 0;
    }

    $("practice-body").innerHTML = cs ? renderCourse(gs, cs, vi) : gs ? renderTracks(gs) : renderGames();
    if (gs && !cs) fitCups();
    return cs ? `${ROOT}/${gs}` : gs ? ROOT : "#";
  }
  function fitCups() {
    const go = () => document.querySelectorAll(".pr-cup h3 span").forEach(sp => {
      sp.style.fontSize = ""; sp.style.whiteSpace = "nowrap";
      let px = parseFloat(getComputedStyle(sp).fontSize); const min = px * .75;
      while (sp.scrollWidth > sp.clientWidth + 1 && px > min) sp.style.fontSize = (px -= .5) + "px";
      if (sp.scrollWidth > sp.clientWidth + 1) { sp.style.whiteSpace = ""; sp.style.fontSize = ""; }
    });
    go(); if (document.fonts) document.fonts.ready.then(go);
  }
  window.addEventListener("resize", () => { if (document.querySelector(".pr-cups")) fitCups(); });
  function back() {
    const m = location.hash.match(/^#pr-(?:guess|draw|music):(.+)$/);
    return m ? backOf[decodeURIComponent(m[1])] || ROOT : ROOT;
  }
  window.MinimappedPractice = { render, back };
})();
