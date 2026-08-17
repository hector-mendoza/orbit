/* Prototype: planet + orbiting moon.
 *
 * Standalone — does not touch the live orb. The idea being tested: the moon's orbital
 * speed carries the status, so activity is readable from across the room without
 * relying on colour alone. The moon passes BEHIND the planet on the far half of its
 * orbit and IN FRONT on the near half; that occlusion is what makes it read as depth
 * rather than a dot sliding around a circle.
 */

const GRID_W = 88;
const GRID_H = 64;
const SCALE = 3;

const PLANET_R = 15;
const CX = 44;
const CY = 31;

// A circle seen at an angle. The vertical radius has to clear the planet (r=15) or
// the whole back half of the orbit is swallowed by the planet's own silhouette —
// at ORBIT_RY 9 the moon simply vanished for half of every revolution.
const ORBIT_RX = 26;
const ORBIT_RY = 17;

const PALETTE = {
  core: "#fbf8f2",
  ink: "#4a4250",
  blush: "#f0b3aa",
  lit: "#fffdf8",
};

const STATES = {
  working: { glow: "#7aa2f7", mid: "#dbe3f7", rim: "#8fb0f9", period: 1800 },
  waiting: { glow: "#f0a63c", mid: "#f6e3c6", rim: "#f0ac4c", period: null },
  done: { glow: "#5ed69a", mid: "#d2ecdd", rim: "#63d69f", period: 900 },
  idle: { glow: "#8b8b96", mid: "#e3e1e6", rim: "#a5a5b0", period: 9000 },
};

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
  const octx = off.getContext("2d");
  const vctx = view.getContext("2d");
  vctx.imageSmoothingEnabled = false;

  return { state, octx, vctx, view, off };
}

function px(octx, x, y, w, h, color) {
  octx.fillStyle = color;
  octx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function ellipseHalf(row, cy, rx, ry) {
  const dy = (row + 0.5 - cy) / ry;
  if (Math.abs(dy) >= 1) return null;
  return Math.sqrt(1 - dy * dy) * rx;
}

/** Filled circle, used for both the planet and the moon. */
function disc(octx, cx, cy, r, color) {
  for (let row = Math.floor(cy - r); row < Math.ceil(cy + r); row++) {
    const half = ellipseHalf(row, cy, r, r);
    if (half === null) continue;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    if (x1 > x0) px(octx, x0, row, x1 - x0, 1, color);
  }
}

function drawPlanet(octx, cx, cy, r, cfg, squash) {
  const rx = r / Math.sqrt(squash);
  const ry = r * squash;
  const lx = cx - 1.4;
  const ly = cy - 1.8;
  const lrx = rx - 2.4;
  const lry = ry - 2.4;
  const rimTop = cy - ry * 0.45;

  for (let row = Math.floor(cy - ry); row < Math.ceil(cy + ry); row++) {
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
      if (c1 > c0) px(octx, c0, row, c1 - c0, 1, PALETTE.core);
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

  px(octx, Math.round(cx - rx * 0.48), Math.round(cy - ry * 0.55), 3, 1, PALETTE.lit);
  px(octx, Math.round(cx - rx * 0.48), Math.round(cy - ry * 0.55) + 1, 2, 1, PALETTE.lit);

  // Sparse surface patches, kept away from the face so they read as terrain.
  octx.globalAlpha = 0.5;
  px(octx, Math.round(cx - rx * 0.62), Math.round(cy + ry * 0.34), 4, 2, cfg.rim);
  px(octx, Math.round(cx + rx * 0.1), Math.round(cy - ry * 0.68), 3, 1, cfg.rim);
  octx.globalAlpha = 1;
}

function drawFace(octx, cx, cy, ry, kind, eyeDx) {
  const ink = PALETTE.ink;
  const eyeY = Math.round(cy - ry * 0.18);
  const lx = Math.round(cx) - 7 + eyeDx;
  const rx2 = Math.round(cx) + 3 + eyeDx;
  const fcx = Math.round(cx);

  px(octx, fcx - 12, eyeY + 4, 2, 1, PALETTE.blush);
  px(octx, fcx + 10, eyeY + 4, 2, 1, PALETTE.blush);

  const dot = (x, y) => {
    px(octx, x + 1, y, 2, 1, ink);
    px(octx, x, y + 1, 4, 2, ink);
    px(octx, x + 1, y + 3, 2, 1, ink);
    px(octx, x + 2, y + 1, 1, 1, PALETTE.lit);
  };
  const wide = (x, y) => {
    px(octx, x + 1, y, 3, 1, ink);
    px(octx, x, y + 1, 5, 3, ink);
    px(octx, x + 1, y + 4, 3, 1, ink);
    px(octx, x + 3, y + 1, 1, 1, PALETTE.lit);
    px(octx, x + 2, y + 1, 1, 1, PALETTE.lit);
  };
  const sparkle = (x, y) => {
    px(octx, x + 1, y, 2, 1, ink);
    px(octx, x, y + 1, 4, 2, ink);
    px(octx, x + 1, y + 3, 2, 1, ink);
    px(octx, x + 2, y, 1, 3, PALETTE.lit);
    px(octx, x + 1, y + 1, 3, 1, PALETTE.lit);
  };
  const blink = (x, y) => {
    px(octx, x, y + 1, 1, 1, ink);
    px(octx, x + 1, y + 2, 2, 1, ink);
    px(octx, x + 3, y + 1, 1, 1, ink);
  };

  if (kind === "wide") { wide(lx - 1, eyeY - 1); wide(rx2 - 1, eyeY - 1); }
  else if (kind === "sparkle") { sparkle(lx, eyeY); sparkle(rx2, eyeY); }
  else if (kind === "blink") { blink(lx, eyeY); blink(rx2, eyeY); }
  else { dot(lx, eyeY); dot(rx2, eyeY); }

  // mouth
  const my = eyeY + 6;
  if (kind === "wide") px(octx, fcx - 1, my, 2, 2, ink);
  else if (kind === "sparkle") {
    px(octx, fcx - 3, my, 1, 1, ink);
    px(octx, fcx + 2, my, 1, 1, ink);
    px(octx, fcx - 2, my + 1, 4, 1, ink);
    px(octx, fcx - 1, my + 2, 2, 1, ink);
  } else if (kind === "blink" || kind === "flat") px(octx, fcx - 1, my + 1, 2, 1, ink);
  else {
    px(octx, fcx - 2, my, 1, 1, ink);
    px(octx, fcx + 1, my, 1, 1, ink);
    px(octx, fcx - 1, my + 1, 2, 1, ink);
  }
}

/** Faint dotted ellipse showing the moon's path. */
function drawOrbitPath(octx, color) {
  octx.globalAlpha = 0.22;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    px(octx, Math.round(CX + Math.cos(a) * ORBIT_RX), Math.round(CY + Math.sin(a) * ORBIT_RY), 1, 1, color);
  }
  octx.globalAlpha = 1;
}

function drawMoon(octx, angle, cfg) {
  const mx = CX + Math.cos(angle) * ORBIT_RX;
  const my = CY + Math.sin(angle) * ORBIT_RY;
  const behind = Math.sin(angle) < 0;
  // Farther away on the back half, so it shrinks and dims a little.
  const r = behind ? 2.4 : 3.1;
  octx.globalAlpha = behind ? 0.75 : 1;
  disc(octx, mx, my, r, cfg.rim);
  if (!behind) px(octx, Math.round(mx) - 1, Math.round(my) - 1, 1, 1, PALETTE.lit);
  octx.globalAlpha = 1;
}

// ------------------------------------------------------------------- confetti

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

// ----------------------------------------------------------------- main loop

const cells = ["working", "waiting", "done", "idle"].map(makeCell);
for (const c of cells) {
  c.angle = Math.PI * 0.25;
  c.confetti = [];
  c.nextBurst = 0;
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now;

  for (const c of cells) {
    const cfg = STATES[c.state];
    const octx = c.octx;
    octx.clearRect(0, 0, GRID_W, GRID_H);

    // --- motion per state ---
    let squash = 1;
    let eyeDx = 0;
    let face = "dot";
    let bob = 0;

    if (c.state === "working") {
      c.angle += (Math.PI * 2 * dt) / cfg.period;
      bob = -Math.round(Math.abs(Math.sin(now / 900)) * 2);
      const cyc = now % 3400;
      if (cyc < 420) eyeDx = 1;
      else if (cyc > 1700 && cyc < 2120) eyeDx = -1;
    } else if (c.state === "waiting") {
      // Moon parks overhead and bobs, like it's tapping its foot.
      c.angle = -Math.PI / 2 + Math.sin(now / 260) * 0.22;
      face = "wide";
      const cyc = now % 1700;
      if (cyc < 460) bob = -Math.round(Math.abs(Math.sin(cyc / 92)) * 2);
    } else if (c.state === "done") {
      c.angle += (Math.PI * 2 * dt) / cfg.period;
      face = "sparkle";
      const hop = Math.abs(Math.sin(now / 320));
      bob = -Math.round(hop * 4);
      squash = 1 - hop * 0.06;
      if (now > c.nextBurst) {
        celebrate(c.confetti, CX, CY - PLANET_R - 3);
        c.nextBurst = now + 2600;
      }
    } else {
      c.angle += (Math.PI * 2 * dt) / cfg.period;
      face = now % 4200 < 130 ? "blink" : "flat";
    }

    const cy = CY + bob;

    drawOrbitPath(octx, cfg.rim);
    if (Math.sin(c.angle) < 0) drawMoon(octx, c.angle, cfg); // behind the planet
    drawPlanet(octx, CX, cy, PLANET_R, cfg, squash);
    drawFace(octx, CX, cy, PLANET_R * squash, face, eyeDx);
    if (Math.sin(c.angle) >= 0) drawMoon(octx, c.angle, cfg); // in front

    stepConfetti(c.confetti, dt);
    drawConfetti(octx, c.confetti);

    c.vctx.clearRect(0, 0, c.view.width, c.view.height);
    c.vctx.drawImage(c.off, 0, 0, GRID_W, GRID_H, 0, 0, c.view.width, c.view.height);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
