/* Concept: ghost blob.
 *
 * No legs — a dome with a rippling scalloped hem, floating free. The hem's wave speed
 * and the body's stretch carry the state, which makes this the most fluid of the
 * concepts and the simplest silhouette to read at small sizes.
 */

const CX = 44;
const CY = 30;
const BODY_RX = 16;
const BODY_RY = 17;

/**
 * Dome on top, straight sides, scalloped bottom hem.
 * Drawn span-by-span so the three-tone shading matches the other concepts.
 */
function drawGhost(octx, cx, cy, rx, ry, cfg, wavePhase, waveAmp) {
  const top = Math.round(cy - ry);
  const hemY = Math.round(cy + ry * 0.55);
  const lx = cx - 1.4;
  const ly = cy - 2.2;
  const lrx = rx - 2.4;
  const lry = ry - 2.4;

  for (let row = top; row < hemY + 7; row++) {
    let half;
    if (row < cy) {
      // Dome.
      half = ellipseHalf(row, cy, rx, ry);
      if (half === null) continue;
    } else {
      half = rx; // straight sides below the midline
    }

    let x0 = Math.round(cx - half);
    let x1 = Math.round(cx + half);

    // Below the hem line, only the scallop bumps remain.
    if (row >= hemY) {
      const depth = row - hemY;
      const cols = [];
      for (let x = x0; x < x1; x++) {
        // Three bumps across the hem; the wave travels sideways over time.
        const u = (x - x0) / (x1 - x0);
        const bump = Math.sin(u * Math.PI * 3 - wavePhase) * 0.5 + 0.5;
        const reach = 1 + bump * (4 + waveAmp);
        if (depth < reach) cols.push(x);
      }
      for (const x of cols) {
        px(octx, x, row, 1, 1, cfg.mid);
        if (x > cx + rx * 0.35) px(octx, x, row, 1, 1, cfg.rim);
      }
      continue;
    }

    px(octx, x0, row, x1 - x0, 1, cfg.mid);

    const litHalf = ellipseHalf(row, ly, lrx, lry * 1.4);
    if (litHalf !== null) {
      const c0 = Math.max(x0, Math.round(lx - litHalf));
      const c1 = Math.min(x1, Math.round(lx + litHalf));
      if (c1 > c0) px(octx, c0, row, c1 - c0, 1, P.core);
    }

    if (row + 0.5 > cy - ry * 0.45) {
      const innerHalf = row < cy ? ellipseHalf(row, cy, rx - 1, ry - 1) : rx - 1;
      if (innerHalf !== null) {
        const i1 = Math.round(cx + innerHalf);
        if (i1 < x1) px(octx, i1, row, x1 - i1, 1, cfg.rim);
      }
    }
  }

  px(octx, Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.5), 3, 1, P.lit);
  px(octx, Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.5) + 1, 2, 1, P.lit);
}

run((cell, now) => {
  const { octx, cfg, state } = cell;
  const pose = basePose(state, now);

  // Ghosts float rather than bob against the ground.
  let waveSpeed = 900;
  let waveAmp = 0;
  let stretch = 1;
  let float = Math.sin(now / 1300) * 2;

  if (state === "working") {
    waveSpeed = 420;
  } else if (state === "waiting") {
    waveSpeed = 180;
    waveAmp = 1.5;
    stretch = 1.1; // rears up to get your attention
    float = Math.sin(now / 300) * 1.2;
  } else if (state === "done") {
    waveSpeed = 260;
    stretch = pose.squash;
    float = Math.sin(now / 320) * -3;
  } else {
    waveSpeed = 1800;
    float = Math.sin(now / 2600) * 2.5;
  }

  const cy = CY + Math.round(float) + (state === "done" ? pose.bob : 0);
  const cx = CX + pose.shake;

  maybeCelebrate(cell, now, CX, cy - BODY_RY - 4);

  groundShadow(octx, CX, 58, 22, 2 + Math.abs(Math.round(float)));

  drawGhost(
    octx,
    cx,
    cy,
    BODY_RX / Math.sqrt(stretch),
    BODY_RY * stretch,
    cfg,
    now / waveSpeed,
    waveAmp
  );

  drawFace(octx, cx, Math.round(cy - BODY_RY * stretch * 0.18), pose.face, pose.eyeDx, 7);
});
