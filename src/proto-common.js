/* Shared scaffolding for the concept prototypes.
 *
 * Each proto-*.js file defines only its creature; everything here (canvas setup, the
 * shared three-tone shading, faces, confetti, and the per-state timing) is common so
 * the concepts differ by design rather than by implementation accident.
 */

const GRID_W = 88;
const GRID_H = 64;
const SCALE = 3;

const P = {
  core: "#fbf8f2",
  ink: "#4a4250",
  blush: "#f0b3aa",
  lit: "#fffdf8",
  shadow: "rgba(18, 16, 22, 0.28)",
};

const STATES = {
  working: { glow: "#7aa2f7", mid: "#dbe3f7", rim: "#8fb0f9" },
  waiting: { glow: "#f0a63c", mid: "#f6e3c6", rim: "#f0ac4c" },
  done: { glow: "#5ed69a", mid: "#d2ecdd", rim: "#63d69f" },
  idle: { glow: "#8b8b96", mid: "#e3e1e6", rim: "#a5a5b0" },
};

const ORDER = ["working", "waiting", "done", "idle"];

// ------------------------------------------------------------------- plumbing

function makeCell(state) {
  const cell = document.createElement("div");
  cell.className = "cell";

  const view = document.createElement("canvas");
  view.style.width = `${GRID_W * SCALE}px`;
  view.style.height = `${GRID_H * SCALE}px`;
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  view.width = GRID_W * SCALE * dpr;
  view.height = GRID_H * SCALE * dpr;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = state;

  cell.append(view, label);
  document.getElementById("grid").append(cell);

  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;

  return {
    state,
    cfg: STATES[state],
    octx: off.getContext("2d"),
    vctx: view.getContext("2d"),
    view,
    off,
    confetti: [],
    nextBurst: 0,
    t: 0,
  };
}

function run(drawFn) {
  const cells = ORDER.map(makeCell);
  for (const c of cells) c.vctx.imageSmoothingEnabled = false;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;
    for (const c of cells) {
      c.octx.clearRect(0, 0, GRID_W, GRID_H);
      drawFn(c, now, dt);
      stepConfetti(c.confetti, dt);
      drawConfetti(c.octx, c.confetti);
      c.vctx.clearRect(0, 0, c.view.width, c.view.height);
      c.vctx.drawImage(c.off, 0, 0, GRID_W, GRID_H, 0, 0, c.view.width, c.view.height);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return cells;
}

// ----------------------------------------------------------------- primitives

function px(octx, x, y, w, h, color) {
  octx.fillStyle = color;
  octx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function ellipseHalf(row, cy, rx, ry) {
  const dy = (row + 0.5 - cy) / ry;
  if (Math.abs(dy) >= 1) return null;
  return Math.sqrt(1 - dy * dy) * rx;
}

function disc(octx, cx, cy, r, color) {
  for (let row = Math.floor(cy - r); row < Math.ceil(cy + r); row++) {
    const half = ellipseHalf(row, cy, r, r);
    if (half === null) continue;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    if (x1 > x0) px(octx, x0, row, x1 - x0, 1, color);
  }
}

/**
 * Three-tone body: tinted mid, brighter core offset up-left, saturated rim light on
 * the shaded edge. `rowInset` optionally narrows a row (used for flat-bottomed shapes).
 */
function shadedEllipse(octx, cx, cy, rx, ry, cfg, opts = {}) {
  const clipBottom = opts.clipBottom ?? Infinity;
  const lx = cx - 1.4;
  const ly = cy - 1.8;
  const lrx = rx - 2.4;
  const lry = ry - 2.4;
  const rimTop = cy - ry * 0.45;

  for (let row = Math.floor(cy - ry); row < Math.ceil(cy + ry); row++) {
    if (row > clipBottom) break;
    const half = ellipseHalf(row, cy, rx, ry);
    if (half === null) continue;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    if (x1 <= x0) continue;

    px(octx, x0, row, x1 - x0, 1, cfg.mid);

    const litHalf = lrx > 0 && lry > 0 ? ellipseHalf(row, ly, lrx, lry) : null;
    if (litHalf !== null) {
      const c0 = Math.max(x0, Math.round(lx - litHalf));
      const c1 = Math.min(x1, Math.round(lx + litHalf));
      if (c1 > c0) px(octx, c0, row, c1 - c0, 1, P.core);
    }

    if (row + 0.5 <= rimTop) continue;
    const innerHalf = ellipseHalf(row, cy, rx - 1, ry - 1);
    if (innerHalf === null) {
      px(octx, x0, row, x1 - x0, 1, cfg.rim);
    } else {
      const i0 = Math.round(cx - innerHalf);
      const i1 = Math.round(cx + innerHalf);
      if (i1 < x1) px(octx, i1, row, x1 - i1, 1, cfg.rim);
      if (row + 0.5 > cy + ry * 0.2 && i0 > x0) px(octx, x0, row, i0 - x0, 1, cfg.rim);
    }
  }

  if (opts.highlight !== false) {
    px(octx, Math.round(cx - rx * 0.48), Math.round(cy - ry * 0.55), 3, 1, P.lit);
    px(octx, Math.round(cx - rx * 0.48), Math.round(cy - ry * 0.55) + 1, 2, 1, P.lit);
  }
}

function groundShadow(octx, cx, y, w, lift) {
  const sw = Math.max(6, w - lift * 2);
  octx.globalAlpha = Math.max(0.25, 1 - lift * 0.16);
  px(octx, Math.round(cx - sw / 2), y, sw, 2, P.shadow);
  octx.globalAlpha = 1;
}

// ---------------------------------------------------------------------- faces

function eyeDot(octx, x, y) {
  px(octx, x + 1, y, 2, 1, P.ink);
  px(octx, x, y + 1, 4, 2, P.ink);
  px(octx, x + 1, y + 3, 2, 1, P.ink);
  px(octx, x + 2, y + 1, 1, 1, P.lit);
}
function eyeWide(octx, x, y) {
  px(octx, x + 1, y, 3, 1, P.ink);
  px(octx, x, y + 1, 5, 3, P.ink);
  px(octx, x + 1, y + 4, 3, 1, P.ink);
  px(octx, x + 3, y + 1, 1, 1, P.lit);
  px(octx, x + 2, y + 1, 1, 1, P.lit);
}
function eyeSparkle(octx, x, y) {
  px(octx, x + 1, y, 2, 1, P.ink);
  px(octx, x, y + 1, 4, 2, P.ink);
  px(octx, x + 1, y + 3, 2, 1, P.ink);
  px(octx, x + 2, y, 1, 3, P.lit);
  px(octx, x + 1, y + 1, 3, 1, P.lit);
}
function eyeClosed(octx, x, y) {
  px(octx, x, y + 1, 1, 1, P.ink);
  px(octx, x + 1, y + 2, 2, 1, P.ink);
  px(octx, x + 3, y + 1, 1, 1, P.ink);
}
function eyeHappy(octx, x, y) {
  // upward arc ^ — the "content" eye
  px(octx, x, y + 2, 1, 1, P.ink);
  px(octx, x + 1, y + 1, 2, 1, P.ink);
  px(octx, x + 3, y + 2, 1, 1, P.ink);
}

function drawMouth(octx, cx, y, kind) {
  if (kind === "o") return px(octx, cx - 1, y, 2, 2, P.ink);
  if (kind === "big") {
    px(octx, cx - 3, y, 1, 1, P.ink);
    px(octx, cx + 2, y, 1, 1, P.ink);
    px(octx, cx - 2, y + 1, 4, 1, P.ink);
    px(octx, cx - 1, y + 2, 2, 1, P.ink);
    return;
  }
  if (kind === "flat") return px(octx, cx - 1, y + 1, 2, 1, P.ink);
  px(octx, cx - 2, y, 1, 1, P.ink);
  px(octx, cx + 1, y, 1, 1, P.ink);
  px(octx, cx - 1, y + 1, 2, 1, P.ink);
}

/** Eyes + mouth + cheeks, centred on `cx`. */
function drawFace(octx, cx, eyeY, kind, eyeDx = 0, spread = 7) {
  const lx = Math.round(cx) - spread + eyeDx;
  const rx = Math.round(cx) + (spread - 4) + eyeDx;
  const fcx = Math.round(cx);

  px(octx, fcx - spread - 5, eyeY + 4, 2, 1, P.blush);
  px(octx, fcx + spread + 3, eyeY + 4, 2, 1, P.blush);

  if (kind === "wide") { eyeWide(octx, lx - 1, eyeY - 1); eyeWide(octx, rx - 1, eyeY - 1); }
  else if (kind === "sparkle") { eyeSparkle(octx, lx, eyeY); eyeSparkle(octx, rx, eyeY); }
  else if (kind === "closed") { eyeClosed(octx, lx, eyeY); eyeClosed(octx, rx, eyeY); }
  else if (kind === "happy") { eyeHappy(octx, lx, eyeY); eyeHappy(octx, rx, eyeY); }
  else { eyeDot(octx, lx, eyeY); eyeDot(octx, rx, eyeY); }

  const my = eyeY + 6;
  if (kind === "wide") drawMouth(octx, fcx, my, "o");
  else if (kind === "sparkle") drawMouth(octx, fcx, my, "big");
  else if (kind === "closed") drawMouth(octx, fcx, my, "flat");
  else drawMouth(octx, fcx, my, "smile");
}

// ---------------------------------------------------------- shared state pose

/** The motion every concept shares, so they can be compared fairly. */
function basePose(state, now) {
  const p = { bob: 0, shake: 0, squash: 1, eyeDx: 0, face: "dot" };

  if (state === "working") {
    p.bob = -Math.round(Math.abs(Math.sin(now / 900)) * 2);
    const c = now % 3400;
    if (c < 420) p.eyeDx = 1;
    else if (c > 1700 && c < 2120) p.eyeDx = -1;
  } else if (state === "waiting") {
    p.face = "wide";
    const c = now % 1700;
    if (c < 460) {
      p.shake = Math.round(Math.sin(c / 46) * 2);
      p.bob = -Math.round(Math.abs(Math.sin(c / 92)) * 2);
    }
  } else if (state === "done") {
    p.face = "sparkle";
    const hop = Math.abs(Math.sin(now / 320));
    p.bob = -Math.round(hop * 4);
    p.squash = 1 - hop * 0.06;
  } else {
    p.face = now % 4200 < 130 ? "closed" : "dot";
  }
  return p;
}

/** Fires the confetti burst on `done`, on a loop so the demo keeps showing it. */
function maybeCelebrate(cell, now, cx, cy) {
  if (cell.state !== "done" || now < cell.nextBurst) return;
  celebrate(cell.confetti, cx, cy);
  cell.nextBurst = now + 2600;
}

// -------------------------------------------------------------------- confetti

const CONFETTI_COLORS = ["#5ed69a", "#7aa2f7", "#f0a63c", "#f2778f", "#e7d55f", "#fffdf8"];

function celebrate(list, cx, cy) {
  for (let i = 0; i < 24; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = 0.038 + Math.random() * 0.018;
    list.push({
      x: cx + (Math.random() - 0.5) * 12,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.00015,
      life: 1,
      decay: 0.0005 + Math.random() * 0.00025,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      phase: Math.random() * Math.PI * 2,
      spin: 0.004 + Math.random() * 0.006,
    });
  }
}

function stepConfetti(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.phase += p.spin * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0 || p.y > GRID_H + 2) list.splice(i, 1);
  }
}

function drawConfetti(octx, list) {
  for (const p of list) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    octx.globalAlpha = Math.max(0, Math.min(1, p.life));
    const t = Math.abs(Math.sin(p.phase));
    if (t > 0.66) px(octx, x - 1, y, 3, 1, p.color);
    else if (t > 0.33) px(octx, x, y, 2, 2, p.color);
    else px(octx, x, y - 1, 1, 3, p.color);
    octx.globalAlpha = 1;
  }
}
