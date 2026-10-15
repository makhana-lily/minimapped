(function () {
  "use strict";

  //home menu map rain PHYSICS!
  const hero = document.getElementById("home-hero");
  if (!hero) return;
  const DATA = window.MINIMAPPED;
  const STAR = "world-mario-circuit-1-world";
  const COUNT = 22;
  const SHOW_LAKITU = false;
  //lakitu turned off rn. if on (true), he floats around, looks cluttered

  const box = document.createElement("div");
  box.className = "hp-physics";
  box.innerHTML = `<canvas></canvas><img class="hp-lakitu" src="menu/lakitu.webp" alt="">`;
  const card = hero.querySelector(".hero-card.main");
  (card || hero).appendChild(box);
  const canvas = box.querySelector("canvas"), ctx = canvas.getContext("2d"), lakitu = box.querySelector(".hp-lakitu");
  const cache = {};
  const img = id => cache[id] || (cache[id] = Object.assign(new Image(), { src: "maps/" + id + ".png" }));
  const pool = DATA.maps.filter(m => m.type === "race" && m.map_id !== STAR).map(m => m.map_id);

  let bodies = [], raf = 0, running = false, spawnTimer = 0, settledAt = 0, W = 0, H = 0, dpr = 1;

  //setup
  function size() {
    const r = box.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  function start() {
    if (running) return;
    running = true; box.classList.add("on"); lakitu.classList.remove("in");
    size();
    const ids = pool.slice().sort(() => Math.random() - 0.5).slice(0, COUNT);
    const base = Math.min(W, H);
    const pad = 34, full = (base - 2 * pad) / 2, small = base * 0.085;
    const mc1 = { id: STAR, star: true, r: full, x: W / 2, y: H / 2, vx: 0, vy: 0, a: 0, va: 0.01, m: small * small,
                  shrink: { t0: performance.now(), from: full, to: small, ms: 450 } };
    bodies = [mc1]; img(STAR);
    let i = 0;
    setTimeout(() => {
      if (!running) return;
      spawnTimer = setInterval(() => {
        if (i >= ids.length) { clearInterval(spawnTimer); return; }
        const id = ids[i++], r = base * (0.065 + Math.random() * 0.03);
        bodies.push({ id, r, x: r + Math.random() * (W - 2 * r), y: -r,
                      vx: (Math.random() - 0.5) * 2, vy: 0, a: (Math.random() - 0.5) * 0.8, va: (Math.random() - 0.5) * 0.08, m: r * r });
        img(id);
      }, 70);
    }, 300);
    settledAt = 0;
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(2, (now - last) / 16.67); last = now;
      step(dt); draw();
      if (SHOW_LAKITU && !lakitu.classList.contains("in") && i >= ids.length) {
        settledAt = settledAt || now;
        if (now - settledAt > 1200) lakitu.classList.add("in");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false; box.classList.remove("on"); lakitu.classList.remove("in");
    cancelAnimationFrame(raf); clearInterval(spawnTimer); bodies = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  //physics
  const G = 0.32, BOUNCE = 0.32, FRICTION = 0.9;
  function step(dt) {
    for (const b of bodies) {
      if (b.shrink) {
        const k = Math.min(1, (performance.now() - b.shrink.t0) / b.shrink.ms), e = 1 - (1 - k) ** 3;
        b.r = b.shrink.from + (b.shrink.to - b.shrink.from) * e;
        if (k >= 1) b.shrink = null;
        continue;
      }
      b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt; b.va *= 0.985;
      if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * BOUNCE; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * BOUNCE; }
      if (b.y > H - b.r) { b.y = H - b.r; b.vy = -b.vy * BOUNCE; b.vx *= FRICTION; b.va = b.va * 0.8 + b.vx / b.r * 0.2; }
    }
    for (let it = 0; it < 4; it++)
      for (let p = 0; p < bodies.length; p++) for (let q = p + 1; q < bodies.length; q++) {
        const A = bodies[p], B = bodies[q];
        if (A.shrink || B.shrink) continue;
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01, min = (A.r + B.r) * 0.92;
        if (d >= min) continue;
        const nx = dx / d, ny = dy / d, push = (min - d), wa = B.m / (A.m + B.m), wb = A.m / (A.m + B.m);
        A.x -= nx * push * wa; A.y -= ny * push * wa; B.x += nx * push * wb; B.y += ny * push * wb;
        const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rel < 0) {
          const j = -(1 + BOUNCE) * rel / (1 / A.m + 1 / B.m);
          A.vx -= j * nx / A.m; A.vy -= j * ny / A.m; B.vx += j * nx / B.m; B.vy += j * ny / B.m;
          A.va += (Math.random() - 0.5) * 0.02; B.va += (Math.random() - 0.5) * 0.02;
        }
      }
  }

  //draw
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of bodies) {
      const im = cache[b.id]; if (!im || !im.complete || !im.naturalWidth) continue;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      const s = b.r * 2;
      ctx.globalAlpha = b.star ? 1 : 0.9;
      ctx.drawImage(im, -b.r, -b.r, s, s);
      ctx.restore();
    }
  }

  const backs = [...hero.querySelectorAll(".hero-card.back img")];
  function shuffleBacks() {
    const pick = pool.slice().sort(() => Math.random() - 0.5).slice(0, backs.length);
    backs.forEach((im, k) => { im.src = "maps/" + pick[k] + ".png"; });
  }

  //music park easter egg
  const track = hero.querySelector(".hp-track"), MC1_SRC = track && track.getAttribute("src");
  const EGG_SRC = "maps/mk7-11-track.png", EGG_CHANCE = 1 / 5;
  if (track) new Image().src = EGG_SRC;
  function musicEgg(on) {
    if (!track) return;
    const egg = on && Math.random() < EGG_CHANCE;
    track.setAttribute("src", egg ? EGG_SRC : MC1_SRC);
    hero.classList.toggle("hp-egg", egg);
  }

  //start/stop on hover
  let lastPreview = hero.dataset.preview;
  new MutationObserver(() => {
    const now = hero.dataset.preview;
    if (now === "free" && lastPreview !== "free") shuffleBacks();
    if ((now === "music") !== (lastPreview === "music")) musicEgg(now === "music");
    if (now === "kart") start(); else stop();
    lastPreview = now;
  }).observe(hero, { attributes: true, attributeFilter: ["data-preview"] });
  window.addEventListener("resize", () => { if (running) size(); });
})();
