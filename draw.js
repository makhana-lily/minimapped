(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const DATA = window.MINIMAPPED;
  const DRAW = Object.assign({}, window.MINIMAPPED_DRAW_PRACTICE || {}, window.MINIMAPPED_DRAW);
  const byId = Object.fromEntries(DATA.maps.concat(window.MINIMAPPED_DRAW_MAPS || []).map(m => [m.map_id, m]));

  const GRID = 128, BOX = 112;
  const C_ = window.MinimappedCourses;
  const courseName = m => C_ ? C_.baseName(m.track, m.game) : m.track;

  const LOGOS = C_.LOGOS;

  //daily number
  function dayNumber(date) {
    const [y, m, d] = DATA.launch.split("-").map(Number);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((today - Date.UTC(y, m - 1, d)) / 86400000) + 1;
  }
  const PUZZLE = Math.max(1, dayNumber(new Date()));
  const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch { return fb; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const UNLIMITED = !!(C_ && C_.FREE);

  //daily save
  const DAILY_KEY = "minimapped-draw-daily", DSTATS_KEY = "minimapped-draw-stats";
  let daily = load(DAILY_KEY, null);
  if (!daily || daily.puzzle !== PUZZLE) daily = { puzzle: PUZZLE, strokes: [], peeksUsed: 0, done: false };
  let dstats = load(DSTATS_KEY, { played: 0, streak: 0, best: 0, last: 0 });
  function persist() {
    if (UNLIMITED || finished || !current) return;
    daily.strokes = strokes; daily.times = times; daily.peeksUsed = peeksUsed; daily.started = daily.started || ready; save(DAILY_KEY, daily);
  }

  window.addEventListener("minimapped:mode", e => {
    if (e.detail === "draw") { resizePad(); if (!current) startRound(); else fitTitle(); }
  });

  //start round
  function startRound() {
    if (UNLIMITED) return nextTrack();
    const DSCHED = (window.MINIMAPPED_DRAW_SCHEDULE || []).filter(id => DRAW[id] && byId[id]);
    setTrack(DSCHED[(PUZZLE - 1) % DSCHED.length]);
    strokes = daily.strokes || []; times = Array.isArray(daily.times) ? daily.times : []; clock0 = null; peeksUsed = daily.peeksUsed || 0;
    if (daily.started || daily.done || strokes.length) { ready = true; $("pad-play").hidden = true; }
    updatePeekButton(); redraw();
    if (daily.done) { finishDrawing(true); if (C_ && !C_.PRACTICE) C_.markSeen(current.map_id); }
  }

  //freeplay pool
  const POOL = Object.keys(window.MINIMAPPED_DRAW).filter(id => byId[id]);
  const recent = [];
  let current = null, target = null, finished = false;
  let ready = false, previewRaf = 0;

  function nextTrack(forced) {
    if (C_) C_.clearSlot("draw-bonus-slot");
    let id = typeof forced === "string" ? forced : null;
    if (!id) do { id = POOL[Math.floor(Math.random() * POOL.length)]; }
    while (recent.includes(id) && recent.length < POOL.length);
    recent.push(id); if (recent.length > 30) recent.shift();
    setTrack(id);
  }

  //load a track
  function setTrack(id) {
    current = byId[id];
    target = decodePoints(DRAW[id].pts);
    $("draw-track").textContent = courseName(current); fitTitle();
    $("draw-game-name").textContent = current.game;
    const [logo, colour] = LOGOS[current.game] || [null, ""];
    const img = $("draw-game-logo");
    img.hidden = !logo; img.alt = current.game;
    if (logo) img.src = "logos/" + logo; else img.removeAttribute("src");
    $("draw-game-name").hidden = !!logo;
    $("draw-game").style.setProperty("--game", colour || "var(--hint)");
    const sec = $("draw");
    sec.style.setProperty("--game", colour || "var(--accent)");
    const [r, g, b] = (colour || "#e52521").match(/\w\w/g).map(h => parseInt(h, 16));
    sec.style.setProperty("--game-ink", 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#1b1d2b" : "#fff");
    $("draw-game-console").textContent = window.MinimappedCourses.consoleOf(current);
    $("draw-game-note").textContent = current.note || ""; $("draw-game-note").hidden = !current.note;
    strokes = []; times = []; clock0 = null; finished = false; resultOverlay = null;
    cancelAnimationFrame(replayRaf); replayWaiting = false; $("draw-replay").hidden = true;
    cancelAnimationFrame(previewRaf); ready = false; $("pad-play").hidden = false; $("pad-timer").hidden = true;
    $("draw-result").hidden = true;
    $("draw-tools").hidden = false;
    resetPeeks();
    redraw();
  }

  function fitTitle() {
    const el = $("draw-track"); el.style.fontSize = "";
    let px = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && px > 13) el.style.fontSize = (px -= 1) + "px";
  }
  window.addEventListener("resize", () => { if (current) fitTitle(); });

  function decodePoints(b64) {
    const bin = atob(b64), pts = [];
    for (let i = 0; i < bin.length; i += 2) pts.push([bin.charCodeAt(i), bin.charCodeAt(i + 1)]);
    return pts;
  }

  //drawing pad
  const pad = $("pad"), ctx = pad.getContext("2d");
  let strokes = [], drawing = false;

  //live replay timing
  let times = [], clock0 = null, replayRaf = 0, replayWaiting = false;
  function stamp() {
    const t = performance.now();
    if (clock0 === null) clock0 = t - (times.length ? times[times.length - 1].at(-1) + 400 : 0);
    return Math.round(t - clock0);
  }
  let resultOverlay = null;

  function resizePad() {
    const r = pad.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    pad.width = Math.round(r.width * dpr); pad.height = Math.round(r.height * dpr);
    if (resultOverlay) redraw(tintedOverlay(resultOverlay.img, resultOverlay.n, resultOverlay.fit));
    else redraw();
  }
  window.addEventListener("resize", resizePad);

  function pointFrom(e) {
    const r = pad.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  //brushy stabilizer
  const STAB_KEY = "minimapped-stabilizer", STAB_PX = { off: 0, low: 9, high: 20 };
  let stab = (() => { try { return localStorage.getItem(STAB_KEY) || "low"; } catch { return "low"; } })();
  if (!(stab in STAB_PX)) stab = "low";
  function showStab() {
    for (const b of document.querySelectorAll("#draw-stab [data-stab]")) b.setAttribute("aria-checked", b.dataset.stab === stab);
  }
  $("draw-stab").addEventListener("click", e => {
    const b = e.target.closest("[data-stab]"); if (!b) return;
    stab = b.dataset.stab; showStab();
    try { localStorage.setItem(STAB_KEY, stab); } catch {}
  });
  showStab();
  let brush = null, pointer = null;
  function follow(p) {
    pointer = p;
    const R = STAB_PX[stab] / (pad.getBoundingClientRect().width || 1);
    const dx = p[0] - brush[0], dy = p[1] - brush[1], d = Math.hypot(dx, dy);
    if (d <= R) return false;
    brush = [brush[0] + dx * (d - R) / d, brush[1] + dy * (d - R) / d];
    return true;
  }

  //drawing
  pad.addEventListener("pointerdown", e => {
    if (finished || !ready) return;
    drawing = true; pad.setPointerCapture(e.pointerId);
    brush = pointer = pointFrom(e);
    strokes.push([brush]); times.push([stamp()]); redraw();
  });
  pad.addEventListener("pointermove", e => {
    if (!drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) if (follow(pointFrom(ev))) { strokes[strokes.length - 1].push(brush); times[times.length - 1].push(stamp()); }
    redraw();
  });
  const stop = () => { if (drawing) persist(); drawing = false; brush = pointer = null; if (strokes.length) redraw(); };
  pad.addEventListener("pointerup", stop);
  pad.addEventListener("pointercancel", stop);

  //undo / clear / skip
  $("draw-undo").addEventListener("click", () => { strokes.pop(); times.pop(); redraw(); persist(); });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !$("draw").hidden &&
        !finished && strokes.length && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); strokes.pop(); times.pop(); redraw(); persist();
    }
  });
  $("draw-clear").addEventListener("click", () => { strokes = []; times = []; clock0 = null; redraw(); persist(); });
  $("draw-skip").addEventListener("click", () => nextTrack());

  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  //3 peeks!
  const MAX_PEEKS = 3;
  const peekBtn = $("draw-peek");
  if (matchMedia("(hover: none)").matches) document.querySelector("#draw-peek .peek-label").textContent = "Hold to peek";
  let peeksUsed = 0, peeking = false, peekImg = null, peekFailed = false;

  function resetPeeks() {
    peeksUsed = 0; peeking = false; peekImg = null; peekFailed = false;
    const img = new Image();
    const forId = current.map_id;
    img.onload = () => { if (current.map_id === forId) peekImg = img; };
    img.onerror = () => { if (current.map_id === forId) peekFailed = true; };
    img.src = "maps/" + current.map_id + ".png";
    updatePeekButton();
  }
  function updatePeekButton() {
    const left = MAX_PEEKS - peeksUsed;
    $("draw-peek-card").hidden = finished;
    peekBtn.disabled = !ready || (left <= 0 && !peeking);
    $("draw-peek-left").textContent = left > 0 ? `${left} peek${left === 1 ? "" : "s"} left` : "no peeks left";
  }
  function startPeek() {
    if (finished || !ready || peeking || peeksUsed >= MAX_PEEKS || !peekImg) return;
    peeking = true; peeksUsed++; persist();
    peekBtn.classList.add("peeking");
    updatePeekButton();
    redraw();
  }
  function endPeek() {
    if (!peeking) return;
    peeking = false;
    peekBtn.classList.remove("peeking");
    updatePeekButton();
    redraw();
  }
  peekBtn.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") startPeek(); });
  peekBtn.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") endPeek(); });
  peekBtn.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { e.preventDefault(); startPeek(); } });
  ["pointerup", "pointercancel"].forEach(t =>
    peekBtn.addEventListener(t, e => { if (e.pointerType !== "mouse") endPeek(); }));
  peekBtn.addEventListener("contextmenu", e => e.preventDefault());

  let inkCache = null;
  function inkMap() {
    const key = current.map_id + pad.width + "x" + pad.height + cssVar("--ink");
    if (inkCache && inkCache.key === key) return inkCache.canvas;
    const out = document.createElement("canvas");
    out.width = pad.width; out.height = pad.height;
    const o = out.getContext("2d");
    o.drawImage(peekImg, 0, 0, out.width, out.height);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = cssVar("--ink");
    o.fillRect(0, 0, out.width, out.height);
    inkCache = { key, canvas: out };
    return out;
  }
  function fadedMap(alpha = 0.22) {
    const faded = document.createElement("canvas");
    faded.width = pad.width; faded.height = pad.height;
    const f = faded.getContext("2d");
    f.globalAlpha = alpha;
    f.drawImage(inkMap(), 0, 0);
    return faded;
  }

  //track preview at the start
  const POP_MS = 180, HOLD_MS = 1100, FADE_MS = 1300;
  function startPreview() {
    if (ready || finished || $("pad-play").hidden) return;
    $("pad-play").hidden = true;
    if (!UNLIMITED) { daily.started = true; save(DAILY_KEY, daily); }
    playPreview();
  }
  function playPreview() {
    if (peekFailed) { ready = true; updatePeekButton(); redraw(); return; }
    if (!peekImg) { setTimeout(playPreview, 60); return; }
    const t0 = performance.now(), TOTAL = POP_MS + HOLD_MS + FADE_MS;
    const timer = $("pad-timer"), ring = $("pad-timer-ring"), num = $("pad-timer-num");
    timer.hidden = false;
    const frame = () => {
      const t = Math.max(0, performance.now() - t0);
      const alpha = t < POP_MS ? t / POP_MS : t < POP_MS + HOLD_MS ? 1 : 1 - (t - POP_MS - HOLD_MS) / FADE_MS;
      const left = Math.max(0, 1 - t / TOTAL);
      ring.style.strokeDashoffset = (94.25 * (1 - left)).toFixed(2);
      num.textContent = Math.ceil((TOTAL - t) / 1000) || "";
      if (alpha > 0) { redraw(fadedMap(alpha)); previewRaf = requestAnimationFrame(frame); }
      else { timer.hidden = true; ready = true; updatePeekButton(); redraw(); }
    };
    previewRaf = requestAnimationFrame(frame);
  }
  $("pad-play").addEventListener("click", startPreview);

  //redraw
  function redraw(overlay) {
    const W = pad.width, H = pad.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!overlay && peeking && peekImg) overlay = fadedMap();
    if (overlay) ctx.drawImage(overlay, 0, 0);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = 4 * (window.devicePixelRatio || 1);
    ctx.strokeStyle = cssVar("--ink");
    for (const s of strokes) {
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * W, y * H));
      if (s.length === 1) ctx.lineTo(s[0][0] * W + 0.1, s[0][1] * H);
      ctx.stroke();
    }
    if (drawing && brush && pointer && STAB_PX[stab]) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save(); ctx.globalAlpha = .45; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(brush[0] * W, brush[1] * H); ctx.lineTo(pointer[0] * W, pointer[1] * H); ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(pointer[0] * W, pointer[1] * H, 3 * dpr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    $("pad-hint").hidden = !ready || strokes.length > 0 || !!overlay;
    $("draw-undo").disabled = $("draw-clear").disabled = finished || !strokes.length;
    $("draw-done").disabled = finished || !strokes.length;
  }

  //scoring
  const TOL_MIN = 3, TOL_MAX = 4.5;
  const HALF_DIST = 2.8;
  const STEEPNESS = 2.5;
  const FIT_SCALE = 0.15, FIT_SHIFT = 8;
  const INK_MAX = 2;
  function normaliser() {
    const all = strokes.flat();
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    const s = BOX / Math.max(w, h, 1e-6);
    return { x0, y0, w, h, s, ox: (GRID - w * s) / 2, oy: (GRID - h * s) / 2 };
  }

  function rasterise(n) {
    const cells = new Set();
    const mark = (x, y) => cells.add(Math.round(x) + "," + Math.round(y));
    for (const s of strokes) {
      const g = s.map(([x, y]) => [(x - n.x0) * n.s + n.ox, (y - n.y0) * n.s + n.oy]);
      mark(...g[0]);
      for (let i = 1; i < g.length; i++) {
        const [ax, ay] = g[i - 1], [bx, by] = g[i];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let k = 1; k <= steps; k++) mark(ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps);
      }
    }
    return [...cells].map(c => c.split(",").map(Number));
  }

  function distanceMap(points) {
    const D = new Float32Array(GRID * GRID).fill(1e6), R2 = Math.SQRT2;
    for (const [x, y] of points) if (x >= 0 && y >= 0 && x < GRID && y < GRID) D[y * GRID + x] = 0;
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      let v = D[y * GRID + x];
      if (x > 0) v = Math.min(v, D[y * GRID + x - 1] + 1);
      if (y > 0) {
        v = Math.min(v, D[(y - 1) * GRID + x] + 1);
        if (x > 0) v = Math.min(v, D[(y - 1) * GRID + x - 1] + R2);
        if (x < GRID - 1) v = Math.min(v, D[(y - 1) * GRID + x + 1] + R2);
      }
      D[y * GRID + x] = v;
    }
    for (let y = GRID - 1; y >= 0; y--) for (let x = GRID - 1; x >= 0; x--) {
      let v = D[y * GRID + x];
      if (x < GRID - 1) v = Math.min(v, D[y * GRID + x + 1] + 1);
      if (y < GRID - 1) {
        v = Math.min(v, D[(y + 1) * GRID + x] + 1);
        if (x < GRID - 1) v = Math.min(v, D[(y + 1) * GRID + x + 1] + R2);
        if (x > 0) v = Math.min(v, D[(y + 1) * GRID + x - 1] + R2);
      }
      D[y * GRID + x] = v;
    }
    return D;
  }
  function lookup(D, x, y) {
    const cx = Math.min(GRID - 1, Math.max(0, Math.round(x)));
    const cy = Math.min(GRID - 1, Math.max(0, Math.round(y)));
    return D[cy * GRID + cx] + Math.hypot(x - cx, y - cy);
  }

  const C = GRID / 2;
  function misfit(mine, Dtrack, Dmine, f, tol) {
    let a = 0, b = 0;
    for (const [x, y] of mine)
      a += Math.max(0, lookup(Dtrack, C + (x - C) * f.sx + f.dx, C + (y - C) * f.sy + f.dy) - tol);
    for (const [x, y] of target)
      b += Math.max(0, lookup(Dmine, C + (x - C - f.dx) / f.sx, C + (y - C - f.dy) / f.sy) - tol);
    return (a / mine.length + b / target.length) / 2;
  }

  function bestFit(mine, Dtrack, Dmine, tol) {
    let best = { sx: 1, sy: 1, dx: 0, dy: 0 };
    let bestD = misfit(mine, Dtrack, Dmine, best, tol);
    let ds = FIT_SCALE / 3, dd = FIT_SHIFT / 2;
    for (let round = 0; round < 4; round++) {
      const base = best;
      for (const a of [-3, -2, -1, 0, 1, 2, 3]) for (const b of [-3, -2, -1, 0, 1, 2, 3])
        for (const c of [-2, -1, 0, 1, 2]) for (const e of [-2, -1, 0, 1, 2]) {
          const f = { sx: base.sx + a * ds, sy: base.sy + b * ds, dx: base.dx + c * dd, dy: base.dy + e * dd };
          if (Math.abs(f.sx - 1) > FIT_SCALE || Math.abs(f.sy - 1) > FIT_SCALE ||
              Math.abs(f.dx) > FIT_SHIFT || Math.abs(f.dy) > FIT_SHIFT) continue;
          const d = misfit(mine, Dtrack, Dmine, f, tol);
          if (d < bestD) { bestD = d; best = f; }
        }
      ds /= 3; dd /= 2;
    }
    return { fit: best, d: bestD };
  }

  let trackMap = null;
  function score() {
    const n = normaliser();
    const mine = rasterise(n);
    if (!trackMap || trackMap.id !== current.map_id) trackMap = { id: current.map_id, D: distanceMap(target) };
    const tol = Math.min(TOL_MAX, Math.max(TOL_MIN, DRAW[current.map_id].w || TOL_MIN));
    const { fit, d } = bestFit(mine, trackMap.D, distanceMap(mine), tol);
    let pct = 100 / (1 + (d / HALF_DIST) ** STEEPNESS);
    const ink = mine.length / target.length;
    if (ink > INK_MAX) pct *= (INK_MAX / ink) ** 2;
    return { pct: Math.round(pct), n, fit };
  }

  //done button
  $("draw-done").addEventListener("click", () => {
    const length = strokes.flat().length;
    const n0 = normaliser();
    if (length < 8 || Math.max(n0.w, n0.h) < 0.15) return toast("Draw the whole track first");
    finishDrawing(false);
  });

  //results
  function finishDrawing(restoring) {
    const { pct, n, fit } = score();
    endPeek();
    finished = true;
    updatePeekButton();
    let best;
    if (restoring) best = { newBest: false, value: Math.max(pct, (load(KEY, {}).best || {})[current.map_id] || 0) };
    else {
      best = saveResult(current.map_id, pct);
      if (!UNLIMITED) {
        Object.assign(daily, { strokes, times, peeksUsed, done: true, pct }); save(DAILY_KEY, daily);
        window.MinimappedStats?.dailyDone();
        if (C_) C_.markSeen(current.map_id);
        if (dstats.last !== PUZZLE) {
          dstats.played++;
          dstats.streak = dstats.last === PUZZLE - 1 ? dstats.streak + 1 : 1;
          dstats.best = Math.max(dstats.best, dstats.streak); dstats.last = PUZZLE;
          dstats.total = (dstats.total || 0) + pct; dstats.scored = (dstats.scored || 0) + 1;
          dstats.top = Math.max(dstats.top || 0, pct);
          dstats.bands = dstats.bands || [0, 0, 0, 0, 0];
          dstats.bands[pct >= 90 ? 0 : pct >= 75 ? 1 : pct >= 50 ? 2 : pct >= 25 ? 3 : 4]++;
          save(DSTATS_KEY, dstats);
        }
      } else if (C_) {
        C_.addFree("draw", f => { f.played = (f.played || 0) + 1; f.total = (f.total || 0) + pct; f.top = Math.max(f.top || 0, pct); });
      }
    }
    drawHud();

    $("draw-score").textContent = pct + "%";
    $("draw-verdict").textContent =
      pct >= 97 ? "Pixel perfect!" : pct >= 85 ? "Great memory!" : pct >= 65 ? "Recognizable!" :
      pct >= 40 ? "Getting there" : "Is that the same track?";
    const peekNote = peeksUsed ? ` · ${peeksUsed} peek${peeksUsed === 1 ? "" : "s"} used` : " · no peeks!";
    $("draw-best").textContent = (best.newBest
      ? "New personal best for this track!" : `Your best on this track: ${best.value}%`) + peekNote;
    $("draw-result").hidden = false;
    $("draw-result").dataset.outcome = pct >= 50 ? "win" : "lose";
    $("draw-tools").hidden = true;
    $("draw-replay").hidden = !(times.length === strokes.length && times.every((t, i) => Array.isArray(t) && t.length === strokes[i].length && t.every(Number.isFinite)));
    if (UNLIMITED && C_) C_.showNext("draw-bonus-slot", "Lets-a go!", () => nextTrack());
    else countdown();
    lastShare = C_.shareHead("Draw", PUZZLE, UNLIMITED) + `\n${courseName(current)} (${current.game}): ${pct}% accurate!` +
                `\n${peeksUsed ? `👀 ${peeksUsed} peek${peeksUsed === 1 ? "" : "s"} used.` : "🙈 no peeks used."}` + C_.SHARE_LINK;

    const img = new Image(), forId = current.map_id;
    img.onload = () => {
      if (!finished || current.map_id !== forId) return;
      resultOverlay = { img, n, fit };
      redraw(tintedOverlay(img, n, fit));
      if (replayWaiting) playReplay();
    };
    img.src = "maps/" + current.map_id + ".png";
  }

  //watch ur live replay
  function playReplay() {
    if (!finished) return;
    if (!resultOverlay) { replayWaiting = true; return; }
    replayWaiting = false;
    cancelAnimationFrame(replayRaf);
    const bg = tintedOverlay(resultOverlay.img, resultOverlay.n, resultOverlay.fit);
    const full = strokes, start = times[0][0], total = Math.max(1, times[times.length - 1].at(-1) - start);
    const timer = $("pad-timer"), ring = $("pad-timer-ring"), num = $("pad-timer-num"), forId = current.map_id;
    timer.hidden = false;
    const t0 = performance.now();
    const frame = () => {
      if (!finished || current.map_id !== forId) { timer.hidden = true; return; }
      const t = performance.now() - t0, done = t >= total;
      strokes = full.map((s, i) => s.filter((_, k) => times[i][k] - start <= t)).filter(s => s.length);
      redraw(bg);
      strokes = full;
      ring.style.strokeDashoffset = (94.25 * Math.min(1, t / total)).toFixed(2);
      num.textContent = done ? "" : Math.ceil((total - t) / 1000);
      if (done) { timer.hidden = true; redraw(bg); }
      else replayRaf = requestAnimationFrame(frame);
    };
    replayRaf = requestAnimationFrame(frame);
  }
  $("draw-replay").addEventListener("click", playReplay);

  //countdown
  function countdown() {
    const el = $("draw-countdown");
    if (UNLIMITED) { el.textContent = ""; return; }
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const t = Math.floor((next - now) / 1000), p = v => String(v).padStart(2, "0");
    el.textContent = `Next track in ${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
  }
  setInterval(() => { if (finished && !UNLIMITED) countdown(); }, 1000);

  //freeplay extras
  $("draw-skip").hidden = !UNLIMITED || !!(C_ && C_.PRACTICE);
  if (C_ && C_.itemBox) C_.itemBox("draw-hud", () => { resizePad(); nextTrack(); });
  (window.MinimappedPlay = window.MinimappedPlay || {}).draw = id => {
    if (!DRAW[id] || !byId[id]) return;
    resizePad(); nextTrack(id);
  };

  //real track overlay
  function tintedOverlay(img, n, fit) {
    const tint = document.createElement("canvas");
    tint.width = img.width; tint.height = img.height;
    const t = tint.getContext("2d");
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = getComputedStyle($("draw")).getPropertyValue("--game").trim() || cssVar("--accent");
    t.fillRect(0, 0, tint.width, tint.height);

    const [ts, tx, ty] = DRAW[current.map_id].map;
    const kx = ts / (fit.sx * n.s), ky = ts / (fit.sy * n.s);
    const ex = (C + (tx - C - fit.dx) / fit.sx - n.ox) / n.s + n.x0;
    const ey = (C + (ty - C - fit.dy) / fit.sy - n.oy) / n.s + n.y0;

    const out = document.createElement("canvas");
    out.width = pad.width; out.height = pad.height;
    const o = out.getContext("2d");
    o.globalAlpha = 0.45;
    o.setTransform(kx * pad.width, 0, 0, ky * pad.height, ex * pad.width, ey * pad.height);
    o.drawImage(tint, 0, 0);
    return out;
  }

  //best scores
  const KEY = "minimapped-draw";
  function saveResult(id, pct) {
    let data; try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { data = {}; }
    data.best = data.best || {}; data.played = (data.played || 0) + 1; data.total = (data.total || 0) + pct;
    const prev = data.best[id];
    const newBest = prev === undefined || pct > prev;
    if (newBest) data.best[id] = pct;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
    return { newBest: newBest && prev !== undefined, value: prev === undefined ? pct : Math.max(prev, pct) };
  }

  //hud
  function drawHud() {
    if (!C_) return;
    let data; try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { data = {}; }
    const n = data.played || 0;
    if (!UNLIMITED) {
      const streak = dstats.last >= PUZZLE - 1 ? dstats.streak : 0;
      return C_.setHud("draw-hud", { mode: `Daily #${PUZZLE}`, big: streak, sub: `day streak · best ${dstats.best}` });
    }
    C_.setHud("draw-hud", { mode: C_.PRACTICE ? "Kartography" : "Freeplay", big: n ? Math.round(data.total / n) : 0, unit: "%",
                            sub: n ? `average · ${n} drawn` : "no drawings yet" });
  }
  drawHud();

  //share
  let lastShare = "";
  $("draw-share").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(lastShare); toast("Copied to clipboard"); }
    catch { prompt("Copy your result:", lastShare); }
  });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
  }

})();
