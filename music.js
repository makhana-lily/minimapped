(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const DATA = window.MINIMAPPED_MUSIC || { songs: [], schedule: [], launch: "2026-10-01" };

  if (!DATA.schedule.length) {
    $("music-empty").hidden = false; $("music-body").hidden = true; $("music-no").textContent = "";
    return;
  }

  //snippet lengths
  const STEPS = [2, 3, 4, 6, 8, 10];
  const WINDOW = STEPS[STEPS.length - 1];
  const MAX = STEPS.length;
  const byId = Object.fromEntries(DATA.songs.map(s => [s.id, s]));

  //non-mario kart songs (freeroam mkworld)
  const NONMK_KEY = "minimapped-music-nonmk";
  const INCLUDE_NONMK = /^#pr-/.test(location.hash) || (() => { try { return localStorage.getItem(NONMK_KEY) === "1"; } catch { return false; } })();
  const inPool = s => s && (INCLUDE_NONMK || s.group !== "non-mk");
  const POOL = DATA.songs.filter(inPool);
  const SCHEDULE = DATA.schedule.filter(id => inPool(byId[id]));
  const DAILY_SCHEDULE = DATA.schedule.filter(id => byId[id] && byId[id].group !== "non-mk");

  //daily number
  function dayNumber(date) {
    const [y, m, d] = DATA.launch.split("-").map(Number);
    return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(y, m - 1, d)) / 86400000) + 1;
  }
  const PUZZLE = Math.max(1, dayNumber(new Date()));

  const UNLIMITED = window.MinimappedCourses.FREE;
  const randomSong = () => byId[SCHEDULE[Math.floor(Math.random() * SCHEDULE.length)]];
  let SONG = UNLIMITED ? randomSong() : byId[DAILY_SCHEDULE[(PUZZLE - 1) % DAILY_SCHEDULE.length]];
  const session = { played: 0, won: 0 };

  //answers
  const C = window.MinimappedCourses;
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
  const OPTIONS = C.buildOptions(POOL);
  const OPT_BY_KEY = Object.fromEntries(OPTIONS.map(o => [o.key, o]));
  const KEY = s => C.keyOf(s.track, s.game);

  //tracks that share a song
  const SHARED = [
    ["N64 Luigi Raceway", "N64 Royal Raceway", "N64 Mario Raceway", "N64 Wario Stadium"],
    ["N64 Moo Moo Farm", "N64 Yoshi Valley"],
    ["N64 Frappe Snowland", "N64 Sherbet Land"],
    ["GBA Peach Circuit", "GBA Luigi Circuit", "GBA Mario Circuit"],
    ["GBA Shy Guy Beach", "GBA Cheep-Cheep Island"],
    ["GBA Boo Lake", "GBA Broken Pier"],
    ["GCN Luigi Circuit", "GCN Mario Circuit", "GCN Yoshi Circuit"],
    ["GCN Peach Beach", "GCN Daisy Cruiser"],
    ["GCN Mushroom Bridge", "GCN Mushroom City"],
    ["GCN Waluigi Stadium", "GCN Wario Colosseum"],
    ["GCN DK Mountain", "GCN Dino Dino Jungle"],
    ["DS Figure-8 Circuit", "DS Mario Circuit"],
    ["DS Waluigi Pinball", "DS Wario Stadium"],
    ["Wii Luigi Circuit", "Wii Mario Circuit"],
    ["3DS Toad Circuit", "3DS Mario Circuit"],
    ["3DS Maka Wuhu", "3DS Wuhu Loop"],
    ["N64 Battle Course", "N64 Big Donut", "N64 Block Fort", "N64 Double Deck", "N64 Skyscraper"],
    ["GCN Battle Course", "GCN Block City", "GCN Cookie Land", "GCN Nintendo GameCube", "GCN Pipe Plaza", "GCN Tilt-A-Kart"],
    ["DS Battle Course", "DS Nintendo DS", "DS Palm Shore", "DS Tart Top", "DS Twilight House"],
  ];
  const FAMILY = {};
  for (const names of SHARED) {
    const keys = names.map(C.norm);
    if (!keys.some(k => OPT_BY_KEY[k])) continue;
    names.forEach((name, i) => {
      if (!OPT_BY_KEY[keys[i]]) OPTIONS.push(OPT_BY_KEY[keys[i]] = { key: keys[i], name, games: [], search: C.norm(name) });
      FAMILY[keys[i]] = keys;
    });
  }
  //mk7 battle courses, any of the 3 counts then the bonus asks which one
  const MK7_BATTLE = ["3DS Wuhu Town", "3DS Honeybee Hive", "3DS Sherbet Rink"];
  const MK7_KEYS = ["3DS Battle Course", ...MK7_BATTLE].map(C.norm);
  if (!OPT_BY_KEY[MK7_KEYS[0]]) OPTIONS.push(OPT_BY_KEY[MK7_KEYS[0]] = { key: MK7_KEYS[0], name: "3DS Battle Course", games: [], search: MK7_KEYS[0] });
  const mk7Battle = () => SONG.game === "Mario Kart 7" && MK7_KEYS.includes(KEY(SONG));
  OPTIONS.sort((a, b) => a.name.localeCompare(b.name));
  const isRight = g => g === KEY(SONG) || (mk7Battle() ? MK7_KEYS : FAMILY[KEY(SONG)] || []).includes(g);
  const bonusGames = () => [...new Set((FAMILY[KEY(SONG)] || [KEY(SONG)]).flatMap(k => OPT_BY_KEY[k].games))]
    .sort((a, b) => C.ORDER.indexOf(a) - C.ORDER.indexOf(b));

  //victory burst!! every minimap of the course pops out of the middle (all versions so it doesnt spoil the bonus)
  const ALL_MAPS = [...(window.MINIMAPPED?.maps || []), ...(window.MINIMAPPED_DRAW_MAPS || []), ...(window.MINIMAPPED_KART_MAPS || [])];
  const mapKey = m => C.keyOf(m.track.replace(/\s*\([^)]*\)/g, ""), m.game);
  function burst() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const keys = mk7Battle() ? MK7_KEYS : FAMILY[KEY(SONG)] || [KEY(SONG)];
    const ids = [...new Set(ALL_MAPS.filter(m => { const k = mapKey(m); return keys.includes(k) || keys.includes(k.replace(/ \d+$/, "")); }).map(m => m.map_id))]
      .sort(() => Math.random() - 0.5);
    if (!ids.length) return;
    const layer = document.createElement("div");
    layer.className = "victory-burst";
    const N = 14, imgs = [];
    for (let i = 0; i < N; i++) {
      const img = new Image(); img.alt = ""; const id = ids[i % ids.length];
      img.src = /^n64-/.test(id) ? `maps/${id}.png` : `maps-raw/${id}.webp`;   //n64 bursts the white map, not the color one
      layer.appendChild(img); imgs.push(img);
    }
    document.body.appendChild(layer);
    const go = () => imgs.forEach((img, i) => {
      //fountain arc: shoots up, peaks, then curves down to the side
      const side = i % 2 ? 1 : -1, dx = side * (90 + Math.random() * 280);
      const h = 110 + Math.random() * 90, peak = 0.4 + Math.random() * 0.08;
      const path = [];
      for (let f = 0; f <= 20; f++) {
        const t = f / 20, x = dx * t, y = -h * (2 * t / peak - (t / peak) ** 2);
        path.push({ translate: `${x}px ${y}px` });
      }
      const opt = { duration: 1500, fill: "forwards" };
      img.animate(path, opt);
      const spin = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 25);
      img.animate([{ rotate: "0deg" }, { rotate: `${spin}deg` }], opt);
      img.animate([{ scale: 0.5 }, { scale: 1, offset: 0.2 }, { scale: 1 }], { ...opt, easing: "ease-out" });
      img.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { ...opt, easing: "ease-in" });
    });
    //wait a sec for the maps to load so they all pop together
    Promise.race([Promise.all(imgs.map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 500))]).then(go);
    setTimeout(() => layer.remove(), 2100);
  }

  //save data
  const STATE_KEY = "minimapped-music-state", STATS_KEY = "minimapped-music-stats";
  const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const freshState = () => ({ puzzle: PUZZLE, song: SONG.id, guesses: [], done: false, won: false });
  let state = UNLIMITED ? null : load(STATE_KEY, null);
  if (!state || state.puzzle !== PUZZLE || (state.song && state.song !== SONG.id) ||
      state.guesses.some(g => g.includes("|"))) state = freshState();

  function ensureOffset() {
    if (typeof state.offset !== "number" || state.offset > SONG.dur - WINDOW) {
      state.offset = Math.random() * Math.max(0, SONG.dur - WINDOW - 2);
      if (!UNLIMITED) save(STATE_KEY, state);
    }
  }
  ensureOffset();
  const windowStart = () => state.offset;
  let stats = load(STATS_KEY, { played: 0, wins: 0, streak: 0, best: 0, last: 0 });

  const unlocked = () => state.done ? WINDOW : STEPS[Math.min(state.guesses.length, MAX - 1)];
  const nextGain = () => STEPS[Math.min(state.guesses.length + 1, MAX - 1)] - unlocked();

  //player
  const audio = new Audio("audio/" + SONG.id + ".mp3");
  audio.preload = "auto";
  let playing = false, from = 0, len = 0;

  function play() {
    len = unlocked(); from = windowStart();
    audio.volume = 1;
    const go = () => audio.play()
      .then(() => { playing = true; $("music-play").classList.add("playing"); tick(); })
      .catch(() => toast("Couldn't play the audio file"));
    audio.currentTime = from;
    if (Math.abs(audio.currentTime - from) < 0.05) go();
    else audio.addEventListener("seeked", go, { once: true });
  }
  function stop() {
    audio.pause(); playing = false;
    $("music-play").classList.remove("playing");
    $("music-play").innerHTML = "&#9654;";
    drawTimeline(0);
  }
  function tick() {
    if (!playing) return;
    const t = Math.max(0, audio.currentTime - from);
    if (t >= len || audio.ended) return stop();
    audio.volume = Math.max(0, Math.min(1, (len - t) / 0.25));
    $("music-play").innerHTML = "&#9632;";
    drawTimeline(t);
    requestAnimationFrame(tick);
  }
  $("music-play").addEventListener("click", () => playing ? stop() : play());
  audio.addEventListener("timeupdate", () => { if (playing && audio.currentTime - from >= len) stop(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) stop(); });

  //timeline
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  for (const st of STEPS.slice(0, -1)) {
    const mark = document.createElement("i");
    mark.className = "tl-tick"; mark.style.left = (100 * st / WINDOW) + "%";
    $("music-timeline").appendChild(mark);
  }
  function drawTimeline(t) {
    $("tl-unlocked").style.width = (100 * unlocked() / WINDOW) + "%";
    $("tl-progress").style.width = (100 * t / WINDOW) + "%";
    $("music-time").textContent = `${fmt(t)} / ${fmt(unlocked())}`;
  }

  //suggestions
  const input = $("music-input"), list = $("music-suggestions");
  let matches = [], active = -1, chosen = null;
  let hitRows = [], usedRows = [];
  function suggest() {
    chosen = null;
    if (!input.value.trim()) return hide();
    const r = C.searchOptions(input.value, OPTIONS, new Set(state.guesses));
    matches = r.hits.map(h => h.o); hitRows = r.hits; usedRows = r.used;
    active = matches.length ? 0 : -1;
    renderList();
  }
  function renderList() {
    list.innerHTML = matches.length || usedRows.length ? "" : '<li aria-disabled="true"><small>No song matches that</small></li>';
    hitRows.forEach((h, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option"); li.setAttribute("aria-selected", i === active);
      li.innerHTML = C.suggestionHTML(h);
      li.addEventListener("mousedown", e => { e.preventDefault(); pick(h.o); });
      list.appendChild(li);
    });
    usedRows.forEach(h => {
      const li = document.createElement("li");
      li.className = "used"; li.setAttribute("aria-disabled", "true");
      li.innerHTML = C.suggestionHTML(h, true);
      list.appendChild(li);
    });
    list.hidden = false; input.setAttribute("aria-expanded", "true");
    list.children[active]?.scrollIntoView({ block: "nearest" });
  }
  function hide() { list.hidden = true; matches = []; active = -1; input.setAttribute("aria-expanded", "false"); }
  function pick(o) { chosen = o; input.value = o.name; hide(); input.focus(); }
  input.addEventListener("input", suggest);
  input.addEventListener("blur", () => setTimeout(hide, 100));
  input.addEventListener("keydown", e => {
    if (e.key === "Escape" && !list.hidden) return hide();
    if (list.hidden || !matches.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % matches.length; renderList(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; renderList(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { pick(matches[active]); e.preventDefault(); }
  });

  //guessing
  $("music-form").addEventListener("submit", e => {
    e.preventDefault();
    if (state.done) return;
    if (!chosen) {
      chosen = OPTIONS.find(o => norm(o.name) === norm(input.value));
      if (!chosen) return toast("Pick a song from the list");
    }
    if (state.guesses.includes(chosen.key)) return toast("Already guessed");
    attempt(chosen.key);
    input.value = ""; chosen = null;
  });
  $("music-skip").addEventListener("click", () => { if (!state.done) attempt("skip"); });

  function attempt(key) {
    stop();
    state.guesses.push(key);
    if (isRight(key)) {
      burst();
      if (mk7Battle() || bonusGames().length > 1) { state.bonusPending = true; askBonus(); }
      else finish(true);
    }
    else if (state.guesses.length >= MAX) finish(false);
    else toast(`Now ${unlocked()} seconds unlocked`);
    if (!UNLIMITED) save(STATE_KEY, state);
    render();
  }

  //bonus
  function askBonus() {
    if (mk7Battle()) return C.askBonus("music-bonus-slot", "Which battle course is it exactly?", MK7_BATTLE, pick => {
      state.bonusPending = false;
      state.bonus = { pick, right: C.norm(pick) === KEY(SONG), course: true };
      finish(true);
      if (!UNLIMITED) save(STATE_KEY, state);
      render();
    }, n => [n.replace(/^3DS /, ""), "Mario Kart 7"]);
    C.askBonus("music-bonus-slot", "Which Mario Kart game does this particular song play in?", bonusGames(), pick => {
      state.bonusPending = false;
      state.bonus = { pick, right: pick === SONG.game };
      finish(true);
      if (!UNLIMITED) save(STATE_KEY, state);
      render();
    });
  }

  //end of round
  function finish(won) {
    state.done = true; state.won = won;
    if (UNLIMITED) {
      session.played++; if (won) session.won++;
      C.addFree("music", f => { f.played = (f.played || 0) + 1; if (won) f.won = (f.won || 0) + 1;
                                if (won && state.bonus?.right) f.bonus = (f.bonus || 0) + 1; });
      return;
    }
    if (stats.last !== PUZZLE) {
      stats.played++;
      stats.dist = stats.dist || [0, 0, 0, 0, 0, 0];
      if (won) stats.dist[Math.min(5, state.guesses.length - 1)]++;
      if (won) { stats.wins++; if (state.bonus?.right) stats.bonus = (stats.bonus || 0) + 1; stats.streak = stats.last === PUZZLE - 1 ? stats.streak + 1 : 1; stats.best = Math.max(stats.best, stats.streak); }
      else stats.streak = 0;
      stats.last = PUZZLE;
      save(STATS_KEY, stats);
    }
    window.MinimappedStats?.dailyDone();
  }

  //render
  function render() {
    $("music-no").textContent = UNLIMITED
      ? `Unlimited · ${session.won}/${session.played} solved this visit` : `Song #${PUZZLE}`;
    const streak = stats.last >= PUZZLE - 1 ? stats.streak : 0;
    C.setHud("music-hud", UNLIMITED
      ? { mode: C.PRACTICE ? "Kartography" : "Freeplay", big: session.won, of: session.played, sub: "solved this visit" }
      : { mode: `Daily song #${PUZZLE}`, big: streak, sub: `day streak · best ${stats.best}` });
    if (UNLIMITED && state.done) C.showNext("music-bonus-slot", "Lets-a go!", nextSong);
    const ol = $("music-guesses"); ol.innerHTML = "";
    for (let i = 0; i < MAX; i++) {
      const li = document.createElement("li"), g = state.guesses[i];
      if (!g) { li.className = "empty"; li.innerHTML = `<small>${STEPS[i]}s</small>`; }
      else if (g === "skip") { li.className = "skipped"; li.innerHTML = `<span>Skipped</span><small>${STEPS[i]}s</small>`; }
      else {
        const right = isRight(g);
        li.className = right ? "right" : "wrong";
        li.innerHTML = `<span>${esc(OPT_BY_KEY[g]?.name || g)}</span><span class="mark">${right ? "✓" : "✗"}</span>`;
      }
      ol.appendChild(li);
    }
    input.disabled = $("music-guess").disabled = $("music-skip").disabled = state.done || !!state.bonusPending;
    $("music-skip").textContent = state.done ? "Skip" :
      state.guesses.length >= MAX - 1 ? "Give up" : `Skip (+${nextGain()}s)`;
    $("music-result").hidden = !state.done;
    $("music-result").dataset.outcome = state.won ? "win" : "lose";
    if (state.done) {
      $("music-result-title").textContent = state.won ? `Got it in ${state.guesses.length}/${MAX}!` : "Out of attempts";
      const last = state.guesses[state.guesses.length - 1];
      $("music-answer").textContent = OPT_BY_KEY[KEY(SONG)].name +
        (state.won && last !== KEY(SONG) ? ` (same song as ${OPT_BY_KEY[last].name})` : "");
      const b = state.bonus;
      $("music-bonus").hidden = !b;
      if (b) {
        $("music-bonus").textContent = b.course
          ? (b.right ? `You knew it was ${OPT_BY_KEY[KEY(SONG)].name}!` : `Bonus missed: you said ${b.pick}, it was ${OPT_BY_KEY[KEY(SONG)].name}.`)
          : b.right
          ? `You knew it was the ${C.short(SONG.game)} version!`
          : `Bonus missed: you said it was ${C.short(b.pick)}, it was ${C.short(SONG.game)}.`;
        $("music-bonus").classList.toggle("right", b.right);
        $("music-bonus").classList.toggle("wrong", !b.right);
      }
      const sub = document.createElement("span");
      sub.className = "meta-sub";
      sub.textContent = `Your snippet came from ${fmt(state.offset)}–${fmt(state.offset + WINDOW)} of the song`;
      $("music-meta").replaceChildren(C.logoEl(SONG.game), sub);
      if (UNLIMITED) $("music-next").textContent = ""; else countdown();
    }
    drawTimeline(0);
  }

  //countdown
  function countdown() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const s = Math.floor((next - now) / 1000), p = n => String(n).padStart(2, "0");
    $("music-next").textContent = `Next song in ${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
  setInterval(() => { if (state.done && !UNLIMITED) countdown(); }, 1000);

  //next song (freeplay)
  function nextSong(forced) {
    C.clearSlot("music-bonus-slot");
    stop();
    let next = forced && forced.id ? forced : null;
    if (!next) do { next = randomSong(); } while (next === SONG && SCHEDULE.length > 1);
    SONG = next; state = freshState(); ensureOffset();
    audio.src = "audio/" + SONG.id + ".mp3";
    render(); input.focus();
  }
  C.itemBox("music-hud", () => nextSong());
  (window.MinimappedPlay = window.MinimappedPlay || {}).music = id => byId[id] && nextSong(byId[id]);

  //non-mk toggle
  $("music-nonmk").checked = INCLUDE_NONMK;
  $("music-nonmk").closest(".mode-switch").hidden = !UNLIMITED;
  $("music-nonmk").addEventListener("change", e => {
    try { localStorage.setItem(NONMK_KEY, e.target.checked ? "1" : "0"); } catch {}
    location.reload();
  });

  //share
  $("music-share").addEventListener("click", async () => {
    const boxes = C.shareBoxes(state.guesses.map(g => g === "skip" ? "⬜" : isRight(g) ? "🟩" : "🟥"), MAX);
    const text = C.shareHead("Music", PUZZLE, UNLIMITED) + "\n" +
      (state.won ? `Guessed it in: ${state.guesses.length}/${MAX}! (${STEPS[state.guesses.length - 1]} sec)` : `Didn't get it! X/${MAX}`) +
      `\n${boxes}` + C.shareBonus(state.bonus);
    try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
    catch { prompt("Copy your result:", text); }
  });

  window.addEventListener("minimapped:mode", e => { if (e.detail !== "music" && playing) stop(); });

  //helpers
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
  }
  function esc(s) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  //start
  render();
  if (state.bonusPending) askBonus();
})();
