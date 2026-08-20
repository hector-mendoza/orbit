/* Skin: wisp — ethereal flame spirit (smooth).
 *
 * Teardrop flame silhouette with trailing ghost wisps and a flickering aura.
 * Eyes glow softly; working state adds upward drifting embers.
 */

SKINS.wisp = (() => {
  const CX = 44;
  const CY = 32;
  const BASE_R = 18;
  const INK = "#100e16";
  const EYE = "#e8f4ff";

  function flamePath(sway) {
    const p = new Path2D();
    p.moveTo(0, 38);
    p.bezierCurveTo(-28 + sway * 4, 18, -22 + sway * 6, -18, -8 + sway * 3, -36);
    p.bezierCurveTo(-3, -44, 3, -44, 8 + sway * 3, -36);
    p.bezierCurveTo(22 + sway * 6, -18, 28 + sway * 4, 18, 0, 38);
    p.closePath();
    return p;
  }

  function drawTrail(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const trails = state === "working" ? 4 : 2;
    for (let i = 0; i < trails; i++) {
      const phase = now / 1400 + i * 0.55;
      const tx = cx + Math.sin(phase * 1.7 + i) * r * 0.35;
      const ty = cy + r * 0.15 + ((now / 2000 + i * 0.4) % 1) * r * 0.9;
      const tr = r * (0.12 - i * 0.02);
      ctx.globalAlpha = 0.12 + Math.sin(phase) * 0.06;
      ctx.fillStyle = cfg.rim;
      ctx.beginPath();
      ctx.ellipse(tx, ty, tr * 0.7, tr, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx, cx, cy, r, cfg, state, now) {
    if (state !== "working") return;
    for (let i = 0; i < 6; i++) {
      const t = (now / 1600 + i * 0.23) % 1;
      const ex = cx + Math.sin(i * 1.4 + now / 3000) * r * 0.4;
      const ey = cy - r * 0.3 - t * r * 1.2;
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.fillStyle = cfg.rim;
      ctx.beginPath();
      ctx.arc(ex, ey, 0.8 + (1 - t) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAura(ctx, cx, cy, r, cfg, state, now) {
    const flicker = 0.85 + Math.sin(now / 180) * 0.08 + Math.sin(now / 430) * 0.05;
    const rad = r * 1.25 * flicker;
    const g = ctx.createRadialGradient(cx, cy - r * 0.1, 0, cx, cy, rad);
    const a = state === "idle" ? 0.05 : state === "waiting" ? 0.18 : 0.12;
    g.addColorStop(0, cfg.rim + Math.round(a * 255).toString(16).padStart(2, "0"));
    g.addColorStop(0.7, cfg.rim + "00");
    g.addColorStop(1, cfg.rim + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad * 0.75, rad, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    label: "Wisp (spirit)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale * 1.1],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;
      const sway = Math.sin(now / 1000) * (state === "working" ? 1 : 0.5);

      drawAura(ctx, cx, cy, r, cfg, state, now);
      drawTrail(ctx, cx, cy, r, cfg, state, now);

      const breathe = state === "idle" ? 0.005 : 0.012;
      const sx = (1 + Math.sin(now / 1500) * breathe) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1500) * breathe) * pose.squash;

      const path = flamePath(sway);
      smoothBody(ctx, path, cx, cy, r / 38, sx, sy, 0, 0, INK, cfg.rim, 1.3 / (r / 38));

      drawEmbers(ctx, cx, cy, r, cfg, state, now);

      // Glowing eyes
      ctx.save();
      ctx.shadowColor = cfg.rim;
      ctx.shadowBlur = state === "working" ? 6 : 3;
      smoothEyes(ctx, cx, cy, r * 0.9, cfg, state, now, pose, {
        eyeColor: EYE,
        bias: 0.05,
        sep: 0.24,
        wScale: 0.24,
        hScale: 0.5,
      });
      ctx.restore();
    },
  };
})();
