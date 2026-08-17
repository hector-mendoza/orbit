/* Concept: cat loaf.
 *
 * A sitting cat. Ears and tail do the emotional work — at this resolution they carry
 * far more state than a face can: perked and flicking while working, flattened when
 * it wants attention, straight up when pleased, folded down asleep when idle.
 */

const CX = 44;
const BASE = 46; // y of the loaf's flat bottom
const BODY_RX = 17;
const BODY_RY = 13;

/** Triangular ear. `droop` 0 = perked, 1 = flattened sideways. */
function drawEar(octx, x, baseY, dir, droop, cfg) {
  const h = Math.round(6 - droop * 3.5);
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, h - i);
    // As it flattens the ear also leans outward.
    const lean = Math.round(droop * i * 1.4) * dir;
    px(octx, x + lean - (dir < 0 ? w - 1 : 0), baseY - i, w, 1, cfg.mid);
  }
  // Inner ear.
  if (droop < 0.5) px(octx, x + (dir < 0 ? -1 : 0), baseY - 1, 1, 1, P.blush);
}

/** Tail curving out to the right; `lift` raises the tip, `wag` swings it. */
function drawTail(octx, x, y, lift, wag, cfg) {
  let px_ = x;
  let py = y;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    px_ = x + Math.round(i * 1.5);
    py = y - Math.round(lift * t * t * 9) + Math.round(Math.sin(wag + t * 2.2) * (1 + t * 2.5));
    px(octx, px_, py, 2, 2, cfg.mid);
  }
  px(octx, px_, py, 2, 2, cfg.rim);
}

run((cell, now) => {
  const { octx, cfg, state } = cell;
  const pose = basePose(state, now);
  const cy = BASE - BODY_RY + pose.bob;
  const cx = CX + pose.shake;

  maybeCelebrate(cell, now, CX, cy - BODY_RY - 6);

  groundShadow(octx, CX, 50, 28, Math.abs(pose.bob));

  // --- ear and tail behaviour per state ---
  let droop = 0;
  let tailLift = 0;
  let wag = 0;
  let face = pose.face;

  if (state === "working") {
    wag = now / 260; // steady flick
    tailLift = 0.15;
  } else if (state === "waiting") {
    droop = 1; // ears pinned back
    wag = now / 120; // agitated
    tailLift = 0;
  } else if (state === "done") {
    tailLift = 1; // tail straight up = pleased cat
    wag = now / 400;
    face = "happy";
  } else {
    droop = 0.55; // half-folded, dozing
    wag = now / 1400;
    tailLift = -0.15;
    face = now % 5200 < 4600 ? "closed" : "dot";
  }

  const rx = BODY_RX / Math.sqrt(pose.squash);
  const ry = BODY_RY * pose.squash;

  drawTail(octx, Math.round(cx + rx - 3), Math.round(cy + ry * 0.55), tailLift, wag, cfg);

  // Ears sit on top of the loaf, drawn before the body so their bases are hidden.
  drawEar(octx, Math.round(cx - rx * 0.55), Math.round(cy - ry) + 3, -1, droop, cfg);
  drawEar(octx, Math.round(cx + rx * 0.55), Math.round(cy - ry) + 3, 1, droop, cfg);

  // Loaf: an ellipse with its bottom flattened where it meets the ground.
  shadedEllipse(octx, cx, cy, rx, ry, cfg, { clipBottom: BASE + pose.bob, highlight: false });
  px(octx, Math.round(cx - rx * 0.72), BASE + pose.bob, Math.round(rx * 1.44), 1, cfg.rim);

  // Face, plus a little muzzle.
  const eyeY = Math.round(cy - ry * 0.1);
  drawFace(octx, cx, eyeY, face, pose.eyeDx, 7);
  px(octx, Math.round(cx), eyeY + 5, 1, 1, P.blush);

  // Front paws peeking out from under the loaf.
  px(octx, Math.round(cx) - 7, BASE + pose.bob - 2, 4, 2, P.core);
  px(octx, Math.round(cx) + 3, BASE + pose.bob - 2, 4, 2, P.core);
});
