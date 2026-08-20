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

/** Soft elliptical shadow so ink bodies stay readable on dark desktops. */
function smoothShadow(ctx, cx, cy, rx, ry, alpha = 0.28) {
  ctx.save();
  ctx.fillStyle = `rgba(8, 6, 14, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Specular highlight blob for an HD, lit surface. */
function smoothSheen(ctx, cx, cy, rx, ry, rot = -0.5, alpha = 0.16) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.45, `rgba(255,255,255,${alpha * 0.35})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const lx = cx + bias - sep + driftL + pose.eyeDx;
  const rxEye = cx + bias + sep + driftR + pose.eyeDx;
  const ey = eyeCy + driftY;

  // Soft eye glow for HD depth.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(lx, ey, w * 0.7, hh * 0.7, 0, 0, Math.PI * 2);
  ctx.ellipse(rxEye, ey, w * 0.7, hh * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  smoothCapsule(ctx, lx, ey, w, hh, ink);
  smoothCapsule(ctx, rxEye, ey, w, hh, ink);

  if (state === "done") {
    const sxp = cx + bias + sep + r * 0.5;
    const syp = cy - r * 0.45;
    ctx.fillStyle = cfg.rim;
    ctx.fillRect(sxp - 0.4, syp - 1.6, 0.8, 3.2);
    ctx.fillRect(sxp - 1.6, syp - 0.4, 3.2, 0.8);
  }
}

/**
 * Rim-stroked filled path with breathing squash, outer halo, and sheen —
 * the same finish language as bloub.
 */
function smoothBody(ctx, path, cx, cy, k, sx, sy, srcCx, srcCy, fill, rim, lineW, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k * sx, k * sy);
  ctx.translate(-srcCx, -srcCy);

  // Soft halo behind the silhouette (reads on dark + light wallpapers).
  if (opts.halo !== false) {
    ctx.save();
    ctx.shadowColor = rim;
    ctx.shadowBlur = opts.haloBlur ?? 18;
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
  }

  ctx.fillStyle = fill;
  ctx.fill(path);

  ctx.strokeStyle = rim;
  ctx.lineWidth = lineW;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(path);
  ctx.restore();
}
