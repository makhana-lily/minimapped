(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch { return fb; } };
  const launch = (window.MINIMAPPED || {}).launch || "2026-10-14";
  function dayNumber(date) {
    const [y, m, d] = launch.split("-").map(Number);
    return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(y, m - 1, d)) / 86400000) + 1;
  }
  const PUZZLE = Math.max(1, dayNumber(new Date()));
  const live = s => (s.last >= PUZZLE - 1 ? s.streak || 0 : 0);
  const pct = (a, b) => (b ? Math.round(100 * (a || 0) / b) : 0);

  //stat tiles + bars
  const tiles = items => `<div class="stats-row" style="grid-template-columns:repeat(${items.length},1fr)">` +
    items.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join("") + `</div>`;
  function bars(title, labels, counts, today) {
    const max = Math.max(1, ...counts);
    return `<h3>${title}</h3><div class="dist">` + counts.map((n, i) =>
      `<div class="dist-row"><span class="dist-label">${labels[i]}</span><div class="dist-bar${i === today ? " today" : ""}"
        style="width:${8 + 92 * n / max}%">${n}</div></div>`).join("") + `</div>`;
  }
  const note = t => `<p class="stats-note">${t}</p>`;
  const STAR = '<img class="star-ico" src="icons/bonus-star.webp" alt="">';

  //tabs
  const TABS = {
    guess() {
      const s = load("minimapped-stats", { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: 0 });
      const st = load("minimapped-state", {});
      const today = st.puzzle === PUZZLE && st.done && st.won ? st.guesses.length - 1 : -1;
      return tiles([[s.played, "Played"], [pct(s.wins, s.played), "Win %"], [live(s), "Streak"], [s.best, "Best"], [s.bonus || 0, "Bonus " + STAR]]) +
             bars("Guess distribution", [1, 2, 3, 4, 5, 6], s.dist || [0, 0, 0, 0, 0, 0], today);
    },
    draw() {
      const s = load("minimapped-draw-stats", { played: 0, streak: 0, best: 0, last: 0 });
      const d = load("minimapped-draw-daily", {});
      const avg = s.scored ? Math.round(s.total / s.scored) + "%" : "–";
      const t = d.puzzle === PUZZLE && d.done ? d.pct : null;
      const today = t == null ? -1 : t >= 90 ? 0 : t >= 75 ? 1 : t >= 50 ? 2 : t >= 25 ? 3 : 4;
      return tiles([[s.played, "Played"], [live(s), "Streak"], [s.best, "Best"], [avg, "Average"], [s.top ? s.top + "%" : "–", "Top score"]]) +
             (s.bands ? bars("Score distribution", ["90%+", "75–89", "50–74", "25–49", "0–24"], s.bands, today)
                      : note("Your score breakdown starts with your next daily drawing."));
    },
    music() {
      const s = load("minimapped-music-stats", { played: 0, wins: 0, streak: 0, best: 0, last: 0 });
      const st = load("minimapped-music-state", {});
      const today = st.puzzle === PUZZLE && st.done && st.won ? Math.min(5, st.guesses.length - 1) : -1;
      return tiles([[s.played, "Played"], [pct(s.wins, s.played), "Win %"], [live(s), "Streak"], [s.best, "Best"], [s.bonus || 0, "Bonus " + STAR]]) +
             (s.dist ? bars("Solved at", ["2s", "3s", "4s", "6s", "8s", "10s"], s.dist, today)
                     : note("Your solve-time breakdown starts with your next daily song."));
    },
    free() {
      const f = load("minimapped-free-stats", {});
      const g = f.guess || {}, m = f.music || {}, d = f.draw || {};
      return `<h3>Guess</h3>` + tiles([[g.played || 0, "Played"], [g.won || 0, "Solved"], [pct(g.won, g.played), "Solve %"], [g.bonus || 0, "Bonus " + STAR]]) +
             `<h3>Draw</h3>` + tiles([[d.played || 0, "Drawn"], [d.played ? Math.round(d.total / d.played) + "%" : "–", "Average"], [d.top ? d.top + "%" : "–", "Top score"]]) +
             `<h3>Music</h3>` + tiles([[m.played || 0, "Played"], [m.won || 0, "Solved"], [pct(m.won, m.played), "Solve %"], [m.bonus || 0, "Bonus " + STAR]]);
    },
  };

  //pick a tab
  function current() {
    const h = location.hash;
    if (/^#free/.test(h)) return "free";
    return h === "#draw" ? "draw" : h === "#music" ? "music" : "guess";
  }
  function render(tab) {
    tab = TABS[tab] ? tab : current();
    for (const b of document.querySelectorAll(".stats-tab")) b.setAttribute("aria-selected", b.dataset.tab === tab);
    $("stats-body").innerHTML = TABS[tab]();
  }

  //buttons
  for (const b of document.querySelectorAll(".stats-tab")) b.addEventListener("click", () => render(b.dataset.tab));
  $("stats-btn").addEventListener("click", () => { render(); $("stats-dialog").showModal(); });
  $("stats-dialog").addEventListener("toggle", e => { if (e.newState === "open") render(); });

  //pop up after all dailies are done
  function allDailiesDone() {
    const today = (key, has) => !has || (s => s.puzzle === PUZZLE && s.done)(load(key, {}));
    return today("minimapped-state", true) &&
           today("minimapped-draw-daily", Object.keys(window.MINIMAPPED_DRAW || {}).length) &&
           today("minimapped-music-state", ((window.MINIMAPPED_MUSIC || {}).schedule || []).length);
  }
  function dailyDone() {
    setTimeout(() => { if (allDailiesDone() && !$("stats-dialog").open) { render(); $("stats-dialog").showModal(); } }, 1200);
  }
  window.MinimappedStats = { render, dailyDone };
})();
