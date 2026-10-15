(function () {
  "use strict";

  //settings
  const MAX_GUESSES = 6;
  const HINTS_AFTER = 3;
  const DATA = window.MINIMAPPED;
  const byId = Object.fromEntries(DATA.maps.map(m => [m.map_id, m]));

  const C = window.MinimappedCourses;
  const OPTIONS = C.buildOptions(DATA.maps);
  const OPT_BY_KEY = Object.fromEntries(OPTIONS.map(o => [o.key, o]));

  function normalise(s) { return s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, ""); }

  const $ = id => document.getElementById(id);

  //daily number
  function dayNumber(date) {
    const [y, m, d] = DATA.launch.split("-").map(Number);
    const launch = Date.UTC(y, m - 1, d);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((today - launch) / 86400000) + 1;
  }
  const PUZZLE = Math.max(1, dayNumber(new Date()));

  const UNLIMITED = C.FREE;
  const randomMap = () => byId[DATA.schedule[Math.floor(Math.random() * DATA.schedule.length)]];
  let ANSWER = UNLIMITED ? randomMap() : byId[DATA.schedule[(PUZZLE - 1) % DATA.schedule.length]];
  const session = { played: 0, won: 0 };
  const answerKey = () => C.keyOf(ANSWER.track, ANSWER.game);
  const answerOpt = () => OPT_BY_KEY[answerKey()];
  const isAnswer = opt => opt.key === answerKey();

  //save data
  const STATE_KEY = "minimapped-state", STATS_KEY = "minimapped-stats";
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  const freshState = () => ({ puzzle: PUZZLE, guesses: [], hints: { console: false, cup: false }, done: false, won: false });
  let state = UNLIMITED ? null : load(STATE_KEY, null);
  if (!state || state.puzzle !== PUZZLE || state.guesses.some(g => g.includes("|"))) {
    state = freshState();
  }
  if (!UNLIMITED && state.done) C.markSeen(ANSWER.map_id);
  let stats = load(STATS_KEY, { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: 0 });

  //minimap
  function drawMap(colour) {
    const canvas = $("map"), ctx = canvas.getContext("2d");
    canvas.closest(".map-frame").classList.toggle("battle", ANSWER.type === "battle");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (ANSWER.type === "battle") return;
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = "maps/" + ANSWER.map_id + ".png";
  }
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  //suggestions
  const input = $("guess-input"), list = $("suggestions");
  let matches = [], active = -1, chosen = null;

  let usedRows = [];
  function updateSuggestions() {
    chosen = null;
    if (!input.value.trim()) return hideSuggestions();
    const r = C.searchOptions(input.value, OPTIONS, new Set(state.guesses));
    matches = r.hits.map(h => h.o); hitRows = r.hits; usedRows = r.used;
    active = matches.length ? 0 : -1;
    renderSuggestions();
  }
  let hitRows = [];
  function renderSuggestions() {
    list.innerHTML = "";
    if (!matches.length && !usedRows.length) list.innerHTML = '<li aria-disabled="true"><small>No track matches that</small></li>';
    hitRows.forEach((h, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === active);
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
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    const sel = list.children[active];
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function hideSuggestions() {
    list.hidden = true; matches = []; active = -1;
    input.setAttribute("aria-expanded", "false");
  }
  function pick(option) {
    chosen = option;
    input.value = option.name;
    hideSuggestions();
    input.focus();
  }
  input.addEventListener("input", updateSuggestions);
  input.addEventListener("blur", () => setTimeout(hideSuggestions, 100));
  input.addEventListener("keydown", e => {
    if (e.key === "Escape" && !list.hidden) return hideSuggestions();
    if (list.hidden || !matches.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % matches.length; renderSuggestions(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; renderSuggestions(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { pick(matches[active]); e.preventDefault(); }
  });

  //guessing
  $("guess-form").addEventListener("submit", e => {
    e.preventDefault();
    if (state.done) return;
    if (!chosen) {
      const exact = OPTIONS.find(o => normalise(o.name) === normalise(input.value));
      if (!exact) return toast("Pick a track from the list");
      chosen = exact;
    }
    if (state.guesses.includes(chosen.key)) return toast("Already guessed");
    state.guesses.push(chosen.key);
    if (isAnswer(chosen)) {
      if (answerOpt().games.length > 1) { state.bonusPending = true; askBonus(); }
      else finish(true);
    }
    else if (state.guesses.length >= MAX_GUESSES) finish(false);
    if (!UNLIMITED) save(STATE_KEY, state);
    input.value = ""; chosen = null;
    render();
  });

  const wrongCount = () => state.guesses.filter(k => k !== answerKey()).length;

  //bonus
  function askBonus() {
    C.askBonus("daily-bonus-slot", "Which Mario Kart game does this particular minimap appear in?", answerOpt().games, pick => {
      state.bonusPending = false;
      state.bonus = { pick, right: pick === ANSWER.game };
      finish(true);
      if (!UNLIMITED) save(STATE_KEY, state);
      render();
    });
  }

  //hints
  function reveal(which) {
    if (state.done || wrongCount() < HINTS_AFTER) return;
    state.hints[which] = true;
    if (!UNLIMITED) save(STATE_KEY, state);
    render();
  }
  $("hint-console").addEventListener("click", () => reveal("console"));
  $("hint-cup").addEventListener("click", () => reveal("cup"));

  //end of round
  function finish(won) {
    state.done = true; state.won = won;
    if (!UNLIMITED) C.markSeen(ANSWER.map_id);
    if (UNLIMITED) {
      session.played++; if (won) session.won++;
      C.addFree("guess", f => { f.played = (f.played || 0) + 1; if (won) f.won = (f.won || 0) + 1;
                                if (won && state.bonus?.right) f.bonus = (f.bonus || 0) + 1; });
      $("map").parentElement.classList.add("reveal");
      return;
    }
    if (stats.last !== PUZZLE) {
      stats.played++;
      if (won) {
        stats.wins++; stats.dist[state.guesses.length - 1]++;
        if (state.bonus?.right) stats.bonus = (stats.bonus || 0) + 1;
        stats.streak = stats.last === PUZZLE - 1 ? stats.streak + 1 : 1;
        stats.best = Math.max(stats.best, stats.streak);
      } else stats.streak = 0;
      stats.last = PUZZLE;
      save(STATS_KEY, stats);
    }
    $("map").parentElement.classList.add("reveal");
    window.MinimappedStats?.dailyDone();
  }

  //render
  function render() {
    $("puzzle-no").textContent = UNLIMITED
      ? `Unlimited · ${session.won}/${session.played} solved this visit` : `Puzzle #${PUZZLE}`;
    const streak = stats.last >= PUZZLE - 1 ? stats.streak : 0;
    C.setHud("daily-hud", UNLIMITED
      ? { mode: C.PRACTICE ? "Kartography" : "Freeplay", big: session.won, of: session.played, sub: "solved this visit" }
      : { mode: `Daily #${PUZZLE}`, big: streak, sub: `day streak · best ${stats.best}` });
    if (UNLIMITED && state.done) C.showNext("daily-bonus-slot", "Lets-a go!", nextMap);

    const ol = $("guesses"); ol.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
      const li = document.createElement("li");
      const key = state.guesses[i];
      if (!key) { li.className = "empty"; li.innerHTML = "&nbsp;"; }
      else {
        const right = key === answerKey();
        li.className = right ? "right" : "wrong";
        li.innerHTML = `<span>${escapeHtml(OPT_BY_KEY[key]?.name || key)}</span>
                        <span class="mark">${right ? "✓" : "✗"}</span>`;
      }
      ol.appendChild(li);
    }

    const unlocked = wrongCount() >= HINTS_AFTER || state.done;
    for (const [which, value] of [["console", C.consoleOf(ANSWER)], ["cup", ANSWER.cup]]) {
      const btn = $("hint-" + which), shown = state.hints[which] || state.done;
      btn.disabled = !unlocked || shown;
      btn.classList.toggle("shown", shown);
      $(`hint-${which}-value`).innerHTML = shown ? (which === "cup" ? C.cupIcon(value) : "") + escapeHtml(value) : unlocked ? "Tap to reveal" : "🔒";
    }
    const left = HINTS_AFTER - wrongCount();
    $("hint-note").textContent = state.done ? "" :
      left > 0 ? `Hints unlock after ${left} more wrong guess${left === 1 ? "" : "es"}.` : "Hints unlocked.";

    input.disabled = $("guess-btn").disabled = state.done || !!state.bonusPending;
    $("result").hidden = !state.done;
    $("result").dataset.outcome = state.won ? "win" : "lose";
    if (state.done) {
      $("result-title").textContent = state.won ? `Solved in ${state.guesses.length}/${MAX_GUESSES}!` : "Out of guesses";
      $("result-answer").textContent = answerOpt().name;
      $("result-meta").replaceChildren(C.logoEl(ANSWER.game));
      const b = state.bonus;
      $("result-bonus").hidden = !b;
      if (b) {
        $("result-bonus").textContent = b.right
          ? `You knew it was the ${C.short(ANSWER.game)} version!`
          : `Bonus missed: you said it was ${C.short(b.pick)}, it was ${C.short(ANSWER.game)}.`;
        $("result-bonus").classList.toggle("right", b.right);
        $("result-bonus").classList.toggle("wrong", !b.right);
      }
      if (UNLIMITED) $("next-puzzle").textContent = "";
      else tickCountdown();
    }
    drawMap(cssVar(state.done ? (state.won ? "--good" : "--accent") : "--map"));
    $("map").parentElement.classList.toggle("won", state.done && state.won);
  }

  //countdown
  function tickCountdown() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const s = Math.floor((next - now) / 1000);
    const pad = n => String(n).padStart(2, "0");
    $("next-puzzle").textContent =
      `Next puzzle in ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  setInterval(() => { if (state.done && !UNLIMITED) tickCountdown(); }, 1000);

  //next map (freeplay)
  function nextMap(forced) {
    C.clearSlot("daily-bonus-slot");
    let next = forced && forced.map_id ? forced : null;
    if (!next) do { next = randomMap(); } while (next === ANSWER && DATA.schedule.length > 1);
    ANSWER = next; state = freshState();
    $("map").parentElement.classList.remove("reveal");
    input.value = ""; render(); input.focus();
  }
  C.itemBox("daily-hud", () => nextMap());
  (window.MinimappedPlay = window.MinimappedPlay || {}).guess = id => byId[id] && nextMap(byId[id]);

  //share
  function shareText() {
    const squares = state.guesses.map(k => k === answerKey() ? "🟩" : "🟥").join("") +
                    (state.bonus ? (state.bonus.right ? " ⭐" : " ✩") : "");
    const used = ["console", "cup"].filter(h => state.hints[h]);
    return `Minimapped ${UNLIMITED ? "(freeplay)" : "#" + PUZZLE} ${state.won ? state.guesses.length : "X"}/${MAX_GUESSES}\n${squares}` +
           (used.length ? `\n💡 ${used.join(" + ")}` : "");
  }
  $("share-btn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareText()); toast("Copied to clipboard"); }
    catch { prompt("Copy your result:", shareText()); }
  });

  //helpers
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  //popups
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => {
    const r = d.getBoundingClientRect();
    if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close();
  }));

  //start
  render();
  if (state.bonusPending) askBonus();
})();
