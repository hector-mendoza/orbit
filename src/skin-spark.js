/* Skin: spark — soft radiant ink star (smooth / HD).
 *
 * Not a hard geometric star: a puffy, bloub-like multi-point cloud with rounded
 * tips, a living corona, and drifting mote sparkles. Same dark ink + pale eyes.
 */

SKINS.spark = (() => {
  const CX = 44;
  const CY = 30;
  const BASE_R = 18;
  const INK = "#14121c";
  const EYE = "#faf8f2";

  // Rounded five-point puff — cubic beziers so tips stay soft like bloub's lobes.
  const BODY_D =
    "M0,-58 C8,-58 12,-48 14,-40 C18,-28 22,-22 34,-24 C46,-26 54,-14 50,-4 " +
    "C46,6 38,10 32,16 C24,24 26,34 32,44 C38,54 28,62 16,58 C6,54 2,46 0,40 " +
    "C-2,46 -6,54 -16,58 C-28,62 -38,54 -32,44 C-26,34 -24,24 -32,16 " +
    "C-38,10 -46,6 -50,-4 C-54,-14 -46,-26 -34,-24 C-22,-22 -18,-28 -14,-40 " +
    "C-12,-48 -8,-58 0,-58 Z";

  const body = new Path2D(BODY_D);
  const SRC_R = 58;
  const SRC_CX = 0;
  const SRC_CY = 0;

  function drawCorona(ctx, cx, cy, r, cfg, state, now) {
    const pulse = 1 + Math.sin(now / 900) * (state === "waiting" ? 0.07 : 0.035);
    const rad = r * 1.45 * pulse;
    const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, rad);
    const a = state === "idle" ? 0.08 : state === "working" ? 0.26 : 0.18;
    const hex = Math.round(a * 255).toString(16).padStart(2, "0");
    g.addColorStop(0, `${cfg.rim}00`);
    g.addColorStop(0.4, `${cfg.rim}${hex}`);
    g.addColorStop(1, `${cfg.rim}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRays(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const count = state === "working" ? 10 : 6;
    const spin = now / (state === "working" ? 2800 : 4200);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const len = r * (1.2 + Math.sin(now / 650 + i) * 0.1);
      ctx.globalAlpha = 0.12 + Math.sin(now / 500 + i) * 0.08;
      const grad = ctx.createLinearGradient(
        Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7,
        Math.cos(a) * len, Math.sin(a) * len,
      );
      grad.addColorStop(0, `${cfg.rim}00`);
      grad.addColorStop(0.5, cfg.rim);
      grad.addColorStop(1, `${cfg.rim}00`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMotes(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const n = state === "done" ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const ang = now / 3200 + i * ((Math.PI * 2) / n);
      const dist = r * (0.95 + Math.sin(now / 700 + i) * 0.12);
      const mx = cx + Math.cos(ang) * dist;
      const my = cy + Math.sin(ang) * dist;
      const s = 0.7 + (i % 3) * 0.35;
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(now / 400 + i) * 0.25;
      ctx.fillStyle = cfg.rim;
      ctx.fillRect(mx - 0.3 * s, my - 1.4 * s, 0.6 * s, 2.8 * s);
      ctx.fillRect(mx - 1.4 * s, my - 0.3 * s, 2.8 * s, 0.6 * s);
      ctx.restore();
    }
  }

  return {
    label: "Spark (star)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const k = r / SRC_R;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;

      const breathe = state === "idle" ? 0.004 : 0.011;
      const sx = (1 + Math.sin(now / 1400) * breathe) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1400) * breathe) * pose.squash;
      const twist = Math.sin(now / 5000) * 0.04;

      drawCorona(ctx, cx, cy, r, cfg, state, now);
      drawRays(ctx, cx, cy, r, cfg, state, now);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(twist);
      ctx.translate(-cx, -cy);
      smoothShadow(ctx, cx, cy + r * 0.7, r * 0.5, r * 0.12, 0.26);
      smoothBody(
        ctx, body, cx, cy, k, sx, sy, SRC_CX, SRC_CY, INK, cfg.rim,
        1.6 / (k * Math.max(sx, 0.01)),
        { haloBlur: state === "working" ? 22 : 14 },
      );
      ctx.restore();

      smoothSheen(ctx, cx - r * 0.12, cy - r * 0.22, r * 0.28, r * 0.18, -0.4, 0.15);
      drawMotes(ctx, cx, cy, r, cfg, state, now);
      smoothEyes(ctx, cx, cy, r * 0.88, cfg, state, now, pose, {
        eyeColor: EYE,
        bias: 0.06,
        sep: 0.22,
      });
    },
  };
})();
