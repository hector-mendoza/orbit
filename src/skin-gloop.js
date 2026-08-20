/* Skin: gloop — wobbly slime blob (smooth).
 *
 * A cousin of bloub: same dark-body / light-eye language, but a softer amoeba silhouette
 * with dripping tendrils and floating bubble particles when working.
 */

SKINS.gloop = (() => {
  const CX = 44;
  const CY = 30;
  const BASE_R = 18;
  const INK = "#121018";
  const GLOW_INK = "#1a1524";

  /** Soft blob centred at origin in a 100-unit box. */
  function blobPath(wobble) {
    const p = new Path2D();
    const pts = 12;
    p.moveTo(0, -42 + wobble * 3);
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const wob =
        1 +
        Math.sin(a * 3 + wobble * 2) * 0.08 +
        Math.sin(a * 5 - wobble) * 0.05;
      const rx = 38 * wob;
      const ry = 34 * (1 + Math.sin(a * 2 + wobble) * 0.06);
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  }

  /** Small drip hanging off the bottom edge. */
  function drawDrip(ctx, cx, cy, r, now, i, state) {
    if (state === "idle") return;
    const phase = now / 900 + i * 1.7;
    const hang = r * (0.35 + (Math.sin(phase) + 1) * 0.12);
    const dx = (i - 1) * r * 0.28;
    const dropY = cy + r * 0.55 + hang * 0.5;
    const dropR = r * (0.07 + Math.sin(phase * 1.3) * 0.02);

    ctx.beginPath();
    ctx.moveTo(cx + dx - dropR * 0.6, cy + r * 0.45);
    ctx.quadraticCurveTo(cx + dx, dropY, cx + dx + dropR * 0.6, cy + r * 0.45);
    ctx.fillStyle = INK;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + dx, dropY + dropR * 0.8, dropR, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Rising bubbles when the session is active. */
  function drawBubbles(ctx, cx, cy, r, cfg, state, now) {
    if (state !== "working" && state !== "waiting") return;
    const count = state === "working" ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const t = (now / 1800 + i * 0.31) % 1;
      const bx = cx + Math.sin(i * 2.1 + now / 2400) * r * 0.55;
      const by = cy + r * 0.2 - t * r * 1.1;
      const br = r * (0.04 + (i % 2) * 0.015);
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = cfg.rim;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return {
    label: "Gloop (slime)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale * 0.7],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;
      const wobble = Math.sin(now / 1100) * (state === "working" ? 1.2 : 0.6);

      const breathe = state === "idle" ? 0.006 : 0.015;
      const sx = (1 + Math.sin(now / 1300) * breathe) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1300) * breathe) * pose.squash;

      const path = blobPath(wobble);
      smoothBody(ctx, path, cx, cy, r / 38, sx, sy, 0, 0, INK, cfg.rim, 1.5 / (r / 38));

      // Inner sheen
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = GLOW_INK;
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.15, cy - r * 0.2, r * 0.35, r * 0.25, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawDrip(ctx, cx, cy, r, now, 0, state);
      drawDrip(ctx, cx, cy, r, now, 1, state);
      drawDrip(ctx, cx, cy, r, now, 2, state);
      drawBubbles(ctx, cx, cy, r, cfg, state, now);
      smoothEyes(ctx, cx, cy, r, cfg, state, now, pose);
    },
  };
})();
