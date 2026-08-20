/* Skin: wisp — ethereal ink flame (smooth / HD).
 *
 * Flowing multi-tongue silhouette (bloub-grade Path2D), soft aurora, drifting
 * ember motes, and glowing capsule eyes. Same dark-body / light-eye language.
 */

SKINS.wisp = (() => {
  const CX = 44;
  const CY = 32;
  const BASE_R = 19;
  const INK = "#100e16";
  const EYE = "#eef6ff";

  // Layered flame tongues as one closed organic path.
  const BODY_D =
    "M2,56 C18,48 30,34 34,16 C38,-2 30,-22 18,-36 C10,-44 4,-52 0,-60 " +
    "C-2,-52 -4,-46 -8,-40 C-14,-48 -20,-44 -18,-34 C-16,-24 -22,-14 -28,-4 " +
    "C-36,10 -38,28 -28,42 C-20,52 -8,58 2,56 Z";

  // Softer outer veil, drawn under the core for depth.
  const VEIL_D =
    "M4,52 C22,42 36,26 38,6 C40,-12 28,-30 14,-42 C6,-48 2,-56 0,-64 " +
    "C-4,-54 -8,-48 -14,-42 C-24,-50 -32,-40 -30,-28 C-28,-16 -36,-4 -40,10 " +
    "C-44,28 -36,44 -22,52 C-10,58 0,56 4,52 Z";

  const body = new Path2D(BODY_D);
  const veil = new Path2D(VEIL_D);
  const SRC_R = 62;
  const SRC_CX = 0;
  const SRC_CY = 0;

  function drawAurora(ctx, cx, cy, r, cfg, state, now) {
    const flicker = 0.9 + Math.sin(now / 180) * 0.06 + Math.sin(now / 410) * 0.04;
    const rad = r * 1.35 * flicker;
    const g = ctx.createRadialGradient(cx, cy - r * 0.15, 0, cx, cy, rad);
    const a = state === "idle" ? 0.07 : state === "waiting" ? 0.22 : 0.14;
    const hex = Math.round(a * 255).toString(16).padStart(2, "0");
    g.addColorStop(0, `${cfg.rim}${hex}`);
    g.addColorStop(0.55, `${cfg.rim}22`);
    g.addColorStop(1, `${cfg.rim}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad * 0.72, rad, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEmbers(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const n = state === "working" ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const t = (now / 1800 + i * 0.19) % 1;
      const sway = Math.sin(i * 1.7 + now / 900) * r * 0.28;
      const ex = cx + sway;
      const ey = cy + r * 0.15 - t * r * 1.45;
      const er = (0.6 + (1 - t) * 1.4) * (0.7 + (i % 3) * 0.15);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.75;
      ctx.fillStyle = cfg.rim;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.35;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - er * 0.2, ey - er * 0.2, er * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGhostTrail(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    for (let i = 0; i < 3; i++) {
      const phase = now / 1600 + i * 0.45;
      const tx = cx + Math.sin(phase * 1.4 + i) * r * 0.22;
      const ty = cy + r * 0.25 + ((phase * 0.5) % 1) * r * 0.7;
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(phase) * 0.04;
      ctx.fillStyle = cfg.rim;
      ctx.beginPath();
      ctx.ellipse(tx, ty, r * (0.14 - i * 0.02), r * (0.22 - i * 0.03), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    label: "Wisp (spirit)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale * 1.15],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const k = r / SRC_R;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;
      const sway = Math.sin(now / 1000) * (state === "working" ? 0.045 : 0.02);

      drawAurora(ctx, cx, cy, r, cfg, state, now);
      drawGhostTrail(ctx, cx, cy, r, cfg, state, now);

      const breathe = state === "idle" ? 0.005 : 0.013;
      const sx = (1 + Math.sin(now / 1500) * breathe + sway) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1500) * breathe) * pose.squash;

      // Veil layer — translucent outer flame for depth.
      ctx.save();
      ctx.globalAlpha = 0.35;
      smoothBody(
        ctx, veil, cx, cy, k * 1.04, sx, sy, SRC_CX, SRC_CY, INK, cfg.rim,
        1.1 / (k * Math.max(sx, 0.01)),
        { haloBlur: 10, halo: true },
      );
      ctx.restore();

      smoothShadow(ctx, cx, cy + r * 0.78, r * 0.42, r * 0.11, 0.24);
      smoothBody(
        ctx, body, cx, cy, k, sx, sy, SRC_CX, SRC_CY, INK, cfg.rim,
        1.55 / (k * Math.max(sx, 0.01)),
        { haloBlur: state === "working" ? 24 : 16 },
      );

      smoothSheen(ctx, cx - r * 0.1, cy - r * 0.15, r * 0.22, r * 0.3, -0.2, 0.12);
      drawEmbers(ctx, cx, cy, r, cfg, state, now);

      ctx.save();
      ctx.shadowColor = cfg.rim;
      ctx.shadowBlur = state === "working" ? 8 : 4;
      smoothEyes(ctx, cx, cy + r * 0.02, r * 0.86, cfg, state, now, pose, {
        eyeColor: EYE,
        bias: 0.05,
        sep: 0.23,
        wScale: 0.24,
        hScale: 0.5,
      });
      ctx.restore();
    },
  };
})();
