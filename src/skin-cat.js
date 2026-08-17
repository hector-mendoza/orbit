/* Skin: cat loaf.
 *
 * Ears and tail carry the state — at this resolution they say far more than a face
 * can. Perked ears and a flicking tail while working; ears pinned flat when it wants
 * you; tail straight up when pleased; ears half-folded and eyes shut when idle.
 */

SKINS.cat = (() => {
  const CX = 44;
  const BASE = 48; // y of the loaf's flat bottom
  const BODY_RX = 17;
  const BODY_RY = 13;

  /** Triangular ear. `droop` 0 = perked, 1 = flattened sideways. */
  function ear(octx, x, baseY, dir, droop, cfg, sc = 1) {
    const h = Math.max(2, Math.round((6 - droop * 3.5) * sc));
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, h - i);
      const lean = Math.round(droop * i * 1.4) * dir;
      px(octx, x + lean - (dir < 0 ? w - 1 : 0), baseY - i, w, 1, cfg.mid);
    }
    if (droop < 0.5) px(octx, x + (dir < 0 ? -1 : 0), baseY - 1, 1, 1, P.blush);
  }

  /** Tail curving out to the right; `lift` raises the tip, `wag` swings it. */
  function tail(octx, x, y, lift, wag, cfg, sc = 1) {
    let tx = x;
    let ty = y;
    const seg = Math.max(1, Math.round(2 * sc));
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      tx = x + Math.round(i * 1.5 * sc);
      ty =
        y -
        Math.round(lift * t * t * 9 * sc) +
        Math.round(Math.sin(wag + t * 2.2) * (1 + t * 2.5) * sc);
      px(octx, tx, ty, seg, seg, cfg.mid);
    }
    px(octx, tx, ty, seg, seg, cfg.rim);
  }

  return {
    label: "Cat loaf",
    burstOrigin: (scale) => [CX, BASE - BODY_RY * 2 * scale - 5],

    draw(octx, cfg, state, now, dt, pose) {
      const sc = pose.scale;
      const RX = BODY_RX * sc;
      const RY = BODY_RY * sc;
      // Bottom stays planted on the ground line, so a small cat sits rather than floats.
      const cy = BASE - RY + pose.bob;
      const cx = CX + pose.shake;

      let droop = 0;
      let lift = 0;
      let wag = 0;
      let face = pose.face;

      if (state === "working") {
        wag = now / 260;
        lift = 0.15;
      } else if (state === "waiting") {
        droop = 1; // ears pinned back
        wag = now / 120; // agitated
      } else if (state === "done") {
        lift = 1; // tail straight up = pleased cat
        wag = now / 400;
        face = "happy";
      } else {
        droop = 0.55; // half-folded, dozing
        wag = now / 1400;
        lift = -0.15;
        face = now % 5200 < 4600 ? "closed" : "dot";
      }

      groundShadow(octx, CX, BASE + 4, Math.round(28 * sc), Math.abs(pose.bob));

      const rx = RX / Math.sqrt(pose.squash);
      const ry = RY * pose.squash;

      tail(octx, Math.round(cx + rx - 3), Math.round(cy + ry * 0.55), lift, wag, cfg, sc);

      // Ears go before the body so their bases are hidden under the loaf.
      const earBase = Math.round(cy - ry) + Math.max(1, Math.round(3 * sc));
      ear(octx, Math.round(cx - rx * 0.55), earBase, -1, droop, cfg, sc);
      ear(octx, Math.round(cx + rx * 0.55), earBase, 1, droop, cfg, sc);

      // Loaf: an ellipse with its bottom flattened where it meets the ground.
      shadedEllipse(octx, cx, cy, rx, ry, cfg, {
        clipBottom: BASE + pose.bob,
        highlight: false,
      });
      px(octx, Math.round(cx - rx * 0.72), BASE + pose.bob, Math.round(rx * 1.44), 1, cfg.rim);

      const eyeY = Math.round(cy - ry * 0.1);
      drawFaceSized(octx, cx, eyeY, face, pose.eyeDx, RY);
      if (RY >= 10) px(octx, Math.round(cx), eyeY + 5, 1, 1, P.blush); // muzzle

      // Front paws peeking out from under the loaf.
      const paw = Math.max(2, Math.round(4 * sc));
      px(octx, Math.round(cx) - paw - 3, BASE + pose.bob - 2, paw, 2, P.core);
      px(octx, Math.round(cx) + 3, BASE + pose.bob - 2, paw, 2, P.core);
    },
  };
})();
