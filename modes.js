(function () {
  "use strict";
  const C = window.MinimappedCourses;
  const SECTION = { guess: "daily", draw: "draw", music: "music" };
  const SECTIONS = ["daily", "draw", "music"];
  const $ = id => document.getElementById(id);

  //which screen are we on
  function parse(hash) {
    const h = hash.replace(/^#/, "");
    if (h === "free") return { screen: "free", mode: "guess" };
    const f = h.match(/^free-(guess|draw|music)$/);
    if (f) return { screen: "free", mode: f[1] };
    if (SECTION[h]) return { screen: "daily", mode: h };
    if (h === "kartography" || h.startsWith("kartography/")) return { screen: "practice", parts: h.split("/").slice(1) };
    const p = h.match(/^pr-(draw):(.+)$/);
    if (p) return { screen: "pr", mode: p[1], id: decodeURIComponent(p[2]) };
    return { screen: "home" };
  }

  //switch screens
  function show() {
    const r = parse(location.hash);
    const playing = ["daily", "free", "pr"].includes(r.screen);
    if (playing && ((r.screen !== "daily") !== C.FREE || (r.screen === "pr") !== C.PRACTICE)) { location.reload(); return; }

    const home = r.screen === "home", menu = r.screen === "practice";
    $("practice").hidden = !menu;
    const back = $("back-btn");
    back.setAttribute("href", "#");
    if (menu) back.setAttribute("href", window.MinimappedPractice.render(r.parts));
    if (r.screen === "pr") back.setAttribute("href", window.MinimappedPractice.back());
    $("home").hidden = !home;
    $("top-logo").classList.toggle("on-home", home);
    $("screen-nav").hidden = r.screen !== "free" && r.screen !== "daily";
    $("daily-tabs").hidden = r.screen !== "daily";
    document.querySelector(".topbar-center").classList.toggle("on-home", home);
    $("free-tabs").hidden = r.screen !== "free";
    document.body.dataset.screen = r.screen;
    for (const id of SECTIONS) $(id).hidden = home || menu || id !== SECTION[r.mode];
    for (const [name, id] of Object.entries(SECTION))
      $("tab-" + id).setAttribute("aria-selected", r.screen === "free" && r.mode === name);
    for (const [name, id] of Object.entries(SECTION))
      $("dtab-" + id).setAttribute("aria-selected", r.screen === "daily" && r.mode === name);
    if (!home && !menu) window.dispatchEvent(new CustomEvent("minimapped:mode", { detail: SECTION[r.mode] }));
    else window.dispatchEvent(new CustomEvent("minimapped:mode", { detail: "home" }));
    if (r.screen === "pr") { const play = (window.MinimappedPlay || {})[r.mode]; if (play) play(r.id); }
    window.scrollTo(0, 0);
  }

  //logo easter egg, click MINIMAPPED on top for swapping colors
  const logo = $("top-logo"), SWAP_CHANCE = 1 / 8;
  logo.addEventListener("click", () => {
    if (Math.random() >= SWAP_CHANCE) return;
    logo.classList.toggle("swapped");
    logo.classList.remove("bounce"); void logo.offsetWidth; logo.classList.add("bounce");
  });
  logo.addEventListener("animationend", () => logo.classList.remove("bounce"));

  //back button
  const TRAIL = "minimapped-trail";
  const trail = () => { try { return JSON.parse(sessionStorage.getItem(TRAIL)) || []; } catch { return []; } };
  const saveTrail = t => { try { sessionStorage.setItem(TRAIL, JSON.stringify(t.slice(-60))); } catch {} };
  function track() {
    const t = trail(), h = location.hash || "#";
    if (t[t.length - 1] === h) return;
    if (t[t.length - 2] === h) t.pop(); else t.push(h);
    saveTrail(t);
  }
  track(); window.addEventListener("hashchange", track);
  $("back-btn").addEventListener("click", e => {
    e.preventDefault();
    const t = trail();
    if (t.length > 1) { history.back(); return; }
    const up = e.currentTarget.getAttribute("href") || "#";
    t[t.length - 1] = up === "#" ? "#" : up; saveTrail(t);
    history.replaceState(null, "", up === "#" ? location.pathname + location.search : up);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  //fixes bug where clicking home "blips" the screen
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.target) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href === (location.hash || "#")) { window.scrollTo(0, 0); return; }
    history.pushState(null, "", href === "#" ? location.pathname + location.search : href);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  //home menu previews
  const hero = $("home-hero");
  for (const item of document.querySelectorAll(".menu-item")) {
    const on = () => { hero.dataset.preview = item.dataset.preview; };
    const off = () => { hero.dataset.preview = "none"; };
    item.addEventListener("mouseenter", on); item.addEventListener("focus", on);
    item.addEventListener("mouseleave", off); item.addEventListener("blur", off);
  }

  //where the results box goes
  const RESULTS = [["result", "daily"], ["draw-result", "draw"], ["music-result", "music"]];
  const wide = matchMedia("(min-width: 900px)");
  const spots = RESULTS.map(([rid]) => { const r = $(rid), mark = document.createComment(rid); r.before(mark); return mark; });
  const FREE_OF = { daily: "#free-guess", draw: "#free-draw", music: "#free-music" };
  const promos = RESULTS.map(([rid, sec]) => {
    const box = document.createElement("div");
    box.className = "result free-promo";
    box.innerHTML = `<h2><span class="if-win">Victory lap?</span><span class="if-lose">Redemption race?</span></h2>
      <div class="result-actions"><a class="go-btn" href="${FREE_OF[sec]}">Try Freeplay</a></div>`;
    const r = $(rid), mirror = () => { box.hidden = r.hidden; box.dataset.outcome = r.dataset.outcome || ""; };
    new MutationObserver(mirror).observe(r, { attributes: true, attributeFilter: ["hidden", "data-outcome"] });
    mirror();
    if (!C.FREE) r.after(box);
    return box;
  });
  function placeResults() {
    const side = wide.matches;
    RESULTS.forEach(([rid, sec], i) => {
      const r = $(rid), left = $(sec).querySelector(".side-left");
      const slot = left.querySelector('[id$="-bonus-slot"]');
      if (side && r.parentNode !== left) { if (slot) slot.before(r); else left.appendChild(r); }
      if (!side && r.parentNode === left) spots[i].after(r);
      if (!C.FREE) {
        const right = $(sec).querySelector(".side-right");
        if (side && right) right.appendChild(promos[i]); else r.after(promos[i]);
        promos[i].classList.toggle("in-side", side);
      }
      r.classList.toggle("in-side", side);
    });
  }
  wide.addEventListener("change", placeResults);
  placeResults();

  //go
  window.addEventListener("hashchange", show);
  show();
})();
