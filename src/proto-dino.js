/* Concept: dino.
 *
 * Side-on chunky body, back spikes, thick tail, stub legs. The tail is the status
 * channel — wagging while working, still and stiff when waiting, whipping when done.
 * Busiest silhouette of the five, and the hardest to read at small sizes.
 */

const CX = 46;
const BASE = 46; // ground line
const BODY_RX = 13;
const BODY_RY = 10;

/** Thick tapering tail sweeping back and to the left. */
function drawTail(octx, x, y, wag, cfg) {
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const w = Math.max(2, Math.round(7 - t * 5));
    const tx = Math.round(x - i * 2.1);
    const ty = Math.round(y + Math.sin(wag + t * 1.8) * (t * 4));
    px(octx, tx - w, ty - Math.floor(w / 2), w, w, i > 5 ? cfg.rim : cfg.mid);
  }
}

/** Row of back spikes following the curve of the body. */
function drawSpikes(octx, cx, cy, rx, ry, cfg) {
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const a = Math.PI * (1.15 + t * 0.5); // along the upper-left arc
    const sx = Math.round(cx + Math.cos(a) * rx * 0.95);
    const sy = Math.round(cy + Math.sin(a) * ry * 0.95);
    const h = 3 - Math.abs(i - 1.5);
    for (let j = 0; j < h; j++) px(octx, sx + j, sy - j - 1, Math.max(1, h - j), 1, cfg.rim);
  }
}

run((cell, now) => {
  const { octx, cfg, state } = cell;
  const pose = basePose(state, now);
  const cy = BASE - BODY_RY - 3 + pose.bob;
  const cx = CX + pose.shake;

  maybeCelebrate(cell, now, CX, cy - BODY_RY - 8);

  let wag = 0;
  let face = pose.face;
  if (state === "working") wag = now / 200;
  else if (state === "waiting") wag = 0;
  else if (state === "done") wag = now / 110;
  else wag = now / 900;

  groundShadow(octx, CX - 2, 50, 30, Math.abs(pose.bob));

  const rx = BODY_RX / Math.sqrt(pose.squash);
  const ry = BODY_RY * pose.squash;

  drawTail(octx, Math.round(cx - rx * 0.8), Math.round(cy + ry * 0.35), wag, cfg);

  // Back legs, then body, then front legs, so the body sits between them.
  px(octx, Math.round(cx - 6), BASE - 6, 5, 6, cfg.rim);
  shadedEllipse(octx, cx, cy, rx, ry, cfg, { highlight: false });
  drawSpikes(octx, cx, cy, rx, ry, cfg);

  // Head: a smaller lobe up and to the right, overlapping the body.
  const hx = Math.round(cx + rx * 0.72);
  const hy = Math.round(cy - ry * 0.72);
  shadedEllipse(octx, hx, hy, 9, 8, cfg, { highlight: false });
  // Snout.
  px(octx, hx + 4, hy + 1, 6, 5, cfg.mid);
  px(octx, hx + 4, hy + 6, 6, 1, cfg.rim);
  px(octx, hx + 8, hy + 2, 1, 1, P.ink); // nostril

  // Legs in front.
  const step = state === "working" ? Math.round(Math.sin(now / 200) * 1) : 0;
  px(octx, Math.round(cx + 3) + step, BASE - 7, 5, 7, cfg.mid);
  px(octx, Math.round(cx + 3) + step, BASE - 1, 6, 1, cfg.rim);

  // Tiny arm.
  px(octx, hx + 1, hy + 7, 3, 2, cfg.rim);

  // One eye — a side-on face can't use the shared two-eye helper.
  const ey = hy - 1;
  const ex = hx + 2;
  if (face === "closed") {
    px(octx, ex, ey + 1, 4, 1, P.ink);
  } else if (face === "sparkle") {
    px(octx, ex, ey, 4, 3, P.ink);
    px(octx, ex + 1, ey + 1, 2, 1, P.lit);
  } else if (face === "wide") {
    px(octx, ex - 1, ey - 1, 5, 5, P.ink);
    px(octx, ex + 1, ey, 1, 1, P.lit);
  } else {
    px(octx, ex + pose.eyeDx, ey, 3, 3, P.ink);
    px(octx, ex + 1 + pose.eyeDx, ey, 1, 1, P.lit);
  }

  // Mouth line on the snout; open and chomping on "done".
  const chomp = state === "done" && Math.sin(now / 160) > 0;
  if (chomp) px(octx, hx + 5, hy + 4, 5, 2, P.ink);
  else px(octx, hx + 5, hy + 4, 5, 1, P.ink);
});
