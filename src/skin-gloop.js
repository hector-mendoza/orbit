/* Skin: gloop — glossy ink slime (smooth / HD).
 *
 * Same finish language as bloub: organic multi-lobe Path2D silhouette, dark body,
 * pale capsule eyes, state-coloured rim. Adds molten drip lobes and rising sheen
 * bubbles when the session is active.
 */

SKINS.gloop = (() => {
  const CX = 44;
  const CY = 31;
  const BASE_R = 19;
  const INK = "#14131a";
  const EYE = "#f9f9f9";

  // Hand-authored lobe cloud in a ~200-unit box, centred near origin — same approach
  // as bloub's SVG path, so antialiasing keeps the silhouette silky at any size.
  const BODY_D =
    "M-6,-48 C18,-52 42,-40 52,-22 C62,-4 58,18 46,34 C38,46 28,54 12,58 " +
    "C4,60 -2,62 -8,66 C-12,70 -10,78 -4,80 C2,82 4,88 -2,90 C-10,92 -22,86 -28,76 " +
    "C-34,66 -42,58 -54,48 C-68,36 -74,18 -70,-2 C-66,-22 -52,-40 -32,-48 " +
    "C-22,-52 -14,-50 -6,-48 Z";

  const body = new Path2D(BODY_D);
  const SRC_R = 72;
  const SRC_CX = -8;
  const SRC_CY = 16;

  function drawBubbles(ctx, cx, cy, r, cfg, state, now) {
    if (state === "idle") return;
    const n = state === "working" ? 7 : state === "waiting" ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const t = (now / 2200 + i * 0.17) % 1;
      const bx = cx + Math.sin(i * 2.3 + now / 2600) * r * 0.55;
      const by = cy + r * 0.35 - t * r * 1.35;
      const br = r * (0.045 + (i % 3) * 0.012) * (1 - t * 0.3);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = cfg.rim;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.stroke();
      // Tiny specular on each bubble.
      ctx.globalAlpha = (1 - t) * 0.35;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRipple(ctx, cx, cy, r, cfg, state, now) {
    if (state !== "working" && state !== "waiting") return;
    const pulse = ((now / 1400) % 1);
    ctx.save();
    ctx.globalAlpha = (1 - pulse) * 0.28;
    ctx.strokeStyle = cfg.rim;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * (0.7 + pulse * 0.45), r * (0.55 + pulse * 0.35), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return {
    label: "Gloop (slime)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale * 0.75],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const k = r / SRC_R;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;

      const breathe = state === "idle" ? 0.005 : 0.014;
      const wobble = Math.sin(now / 1100) * (state === "working" ? 0.03 : 0.015);
      const sx = (1 + Math.sin(now / 1300) * breathe + wobble) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1300) * breathe) * pose.squash;

      smoothShadow(ctx, cx, cy + r * 0.72, r * 0.55, r * 0.14, 0.3);
      drawRipple(ctx, cx, cy, r, cfg, state, now);

      smoothBody(
        ctx, body, cx, cy, k, sx, sy, SRC_CX, SRC_CY, INK, cfg.rim,
        1.7 / (k * Math.max(sx, 0.01)),
        { haloBlur: state === "idle" ? 12 : 20 },
      );

      smoothSheen(ctx, cx - r * 0.18, cy - r * 0.28, r * 0.32, r * 0.2, -0.55, 0.14);
      drawBubbles(ctx, cx, cy, r, cfg, state, now);
      smoothEyes(ctx, cx, cy - r * 0.06, r, cfg, state, now, pose, {
        eyeColor: EYE,
        bias: 0.08,
        sep: 0.24,
      });
    },
  };
})();
