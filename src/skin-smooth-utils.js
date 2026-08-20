/* Shared helpers for smooth vector skins (bloub family). */

/** Rounded-end capsule eye, matching bloub's style. */
function smoothCapsule(ctx, cx, cy, w, h, color) {
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + r, cy - h / 2);
  ctx.arcTo(cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, r);
  ctx.arcTo(cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2, r);
  ctx.arcTo(cx - w / 2, cy + h / 2, cx - w / 2, cy - h / 2, r);
  ctx.arcTo(cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Standard attentive eye pair used by most smooth skins. */
function smoothEyes(ctx, cx, cy, r, cfg, state, now, pose, opts = {}) {
  const ink = opts.eyeColor ?? "#f9f9f9";
  const bias = r * (opts.bias ?? 0.1);
  const sep = r * (opts.sep ?? 0.25);
  const eyeCy = cy - r * (opts.eyeOffset ?? 0.08);

  let w = r * (opts.wScale ?? 0.26);
  let h = r * (opts.hScale ?? 0.54);

  const driftL = Math.sin(now / 1900) * (r * 0.05);
  const driftR = Math.sin(now / 2300 + 1.1) * (r * 0.05);
  const driftY = Math.sin(now / 2700) * (r * 0.04);

  let blink = 1;
  if (state === "working") {
    if (now % 3900 < 130) blink = 0.22;
  } else if (state === "waiting") {
    w = r * 0.32;
    h = r * 0.66;
  } else if (state === "done") {
    h = r * 0.2;
    w = r * 0.34;
  } else {
    h = r * 0.34;
    if (now % 5200 < 200) blink = 0.2;
  }

  const hh = Math.max(r * 0.06, h * blink);
  smoothCapsule(ctx, cx + bias - sep + driftL + pose.eyeDx, eyeCy + driftY, w, hh, ink);
  smoothCapsule(ctx, cx + bias + sep + driftR + pose.eyeDx, eyeCy + driftY, w, hh, ink);

  if (state === "done") {
    const sxp = cx + bias + sep + r * 0.5;
    const syp = cy - r * 0.45;
    ctx.fillStyle = cfg.rim;
    ctx.fillRect(sxp - 0.4, syp - 1.6, 0.8, 3.2);
    ctx.fillRect(sxp - 1.6, syp - 0.4, 3.2, 0.8);
  }
}

/** Rim-stroked filled path with breathing squash. */
function smoothBody(ctx, path, cx, cy, k, sx, sy, srcCx, srcCy, fill, rim, lineW) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k * sx, k * sy);
  ctx.translate(-srcCx, -srcCy);
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.strokeStyle = rim;
  ctx.lineWidth = lineW;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.restore();
}
