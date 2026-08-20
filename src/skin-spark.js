/* Skin: spark — radiant star creature (smooth).
 *
 * Five-pointed star body with rotating light rays when working and a pulsing
 * corona that breathes with session state.
 */

SKINS.spark = (() => {
  const CX = 44;
  const CY = 30;
  const BASE_R = 17;
  const INK = "#14121c";
  const EYE = "#faf8f2";

  function starPath(outer, inner, rotation) {
    const p = new Path2D();
    const n = 5;
    for (let i = 0; i < n * 2; i++) {
      const a = rotation + (i * Math.PI) / n - Math.PI / 2;
      const rad = i % 2 === 0 ? outer : inner;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  }

  function drawRays(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const count = state === "working" ? 8 : state === "waiting" ? 6 : 5;
    const spin = now / (state === "working" ? 2200 : 3500);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const len = r * (1.15 + Math.sin(now / 600 + i) * 0.12);
      const alpha =
        state === "done"
          ? 0.35 + Math.sin(now / 400 + i) * 0.15
          : state === "working"
            ? 0.25 + Math.sin(now / 500 + i * 0.8) * 0.2
            : 0.18;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = cfg.rim;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawCorona(ctx, cx, cy, r, cfg, state, now) {
    const pulse = 1 + Math.sin(now / 900) * (state === "waiting" ? 0.08 : 0.04);
    const rad = r * 1.35 * pulse;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, rad);
    const strength = state === "idle" ? 0.06 : state === "working" ? 0.22 : 0.16;
    g.addColorStop(0, cfg.rim + "00");
    g.addColorStop(0.55, cfg.rim + Math.round(strength * 255).toString(16).padStart(2, "0"));
    g.addColorStop(1, cfg.rim + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    label: "Spark (star)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;

      drawCorona(ctx, cx, cy, r, cfg, state, now);
      drawRays(ctx, cx, cy, r, cfg, state, now);

      const spin = Math.sin(now / 4000) * 0.08;
      const outer = 36 * (1 + Math.sin(now / 1200) * 0.04);
      const inner = 16 * pose.squash;
      const path = starPath(outer, inner, spin);

      smoothBody(ctx, path, cx, cy, r / 36, 1, 1, 0, 0, INK, cfg.rim, 1.4 / (r / 36));

      // Sparkle dots on points when done
      if (state === "done") {
        for (let i = 0; i < 5; i++) {
          const a = spin + (i * Math.PI * 2) / 5 - Math.PI / 2;
          const px = cx + Math.cos(a) * r * 0.95;
          const py = cy + Math.sin(a) * r * 0.95;
          ctx.fillStyle = cfg.rim;
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      smoothEyes(ctx, cx, cy, r * 0.85, cfg, state, now, pose, {
        eyeColor: EYE,
        bias: 0.06,
        sep: 0.22,
      });
    },
  };
})();
