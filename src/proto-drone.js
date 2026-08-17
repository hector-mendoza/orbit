/* Concept: companion drone.
 *
 * A single wide visor instead of two eyes, and an antenna whose light is a second
 * status channel independent of colour — it pulses while working, blinks urgently
 * when waiting, and droops when idle. Hovers; never touches the ground.
 */

const CX = 44;
const CY = 34;
const BODY_RX = 17;
const BODY_RY = 13;

function drawVisor(octx, cx, cy, cfg, state, now, pose) {
  const w = 22;
  const h = 9;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);

  // Dark glass panel with clipped corners.
  px(octx, x + 2, y, w - 4, 1, P.ink);
  px(octx, x, y + 1, w, h - 2, P.ink);
  px(octx, x + 2, y + h - 1, w - 4, 1, P.ink);

  if (state === "done") {
    // Two happy arcs on the glass.
    for (const ox of [-6, 4]) {
      px(octx, cx + ox, cy + 1, 1, 1, cfg.rim);
      px(octx, cx + ox + 1, cy - 1, 2, 1, cfg.rim);
      px(octx, cx + ox + 3, cy + 1, 1, 1, cfg.rim);
    }
    return;
  }

  if (state === "idle") {
    // Standby: a thin dim line rather than an active pupil.
    px(octx, cx - 5, cy, 10, 1, cfg.rim);
    return;
  }

  // Scanning pupil. Sweeps while working, locks onto you when waiting.
  let dx;
  if (state === "waiting") dx = Math.round(Math.sin(now / 150) * 1);
  else dx = Math.round(Math.sin(now / 700) * 6);
  const pw = state === "waiting" ? 5 : 4;
  px(octx, Math.round(cx + dx - pw / 2), cy - 2, pw, 4, cfg.rim);
  px(octx, Math.round(cx + dx - pw / 2) + 1, cy - 1, 1, 1, P.lit);

  // Visor sheen.
  px(octx, x + 3, y + 1, 3, 1, "rgba(255,255,255,0.20)");
}

function drawAntenna(octx, cx, topY, cfg, state, now) {
  const droop = state === "idle" ? 2 : 0;
  const stalkH = 6 - droop;
  px(octx, cx - 1, topY - stalkH, 1, stalkH, cfg.rim);

  // The light: pulses when working, blinks fast when waiting, steady dim when idle.
  let on = true;
  let r = 2;
  if (state === "working") on = Math.sin(now / 320) > -0.4;
  else if (state === "waiting") on = now % 420 < 240;
  else if (state === "idle") on = now % 4200 > 3900;
  else r = 2.4;

  if (!on) {
    disc(octx, cx - 1 + droop, topY - stalkH - 1, r, cfg.mid);
    return;
  }
  disc(octx, cx - 1 + droop, topY - stalkH - 1, r, cfg.rim);
  px(octx, cx - 1 + droop, topY - stalkH - 2, 1, 1, P.lit);
}

run((cell, now) => {
  const { octx, cfg, state } = cell;
  const pose = basePose(state, now);
  // Drones hover — a slow float on top of the shared pose so it never sits still.
  const hover = Math.sin(now / 1100) * 1.5;
  const cy = CY + pose.bob + Math.round(hover);
  const cx = CX + pose.shake;

  maybeCelebrate(cell, now, CX, CY - BODY_RY - 6);

  // Hover shadow: always small and soft, since it never lands.
  groundShadow(octx, CX, 56, 20, 2 + Math.abs(pose.bob));

  const rx = BODY_RX / Math.sqrt(pose.squash);
  const ry = BODY_RY * pose.squash;

  // Thruster nacelles either side, drawn under the body.
  for (const s of [-1, 1]) {
    px(octx, Math.round(cx + s * (rx - 1)) - (s < 0 ? 3 : 0), Math.round(cy + ry * 0.35), 4, 5, cfg.mid);
    px(octx, Math.round(cx + s * (rx - 1)) - (s < 0 ? 3 : 0), Math.round(cy + ry * 0.35) + 5, 4, 1, cfg.rim);
  }

  shadedEllipse(octx, cx, cy, rx, ry, cfg, { highlight: false });
  drawAntenna(octx, cx, Math.round(cy - ry), cfg, state, now);
  drawVisor(octx, cx, cy - 1, cfg, state, now, pose);
});
