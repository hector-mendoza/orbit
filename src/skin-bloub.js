/* Skin: bloub — ink cloud (smooth).
 *
 * Unlike the other skins this one is NOT pixel art: it fills the actual path from the
 * reference SVG (bloub-nuage-attentif-encre-anime.svg) with antialiasing, so the cloud
 * lobes stay smooth at any size. It declares `smooth: true`, which makes the driver draw
 * it straight onto the visible canvas at device resolution instead of going through the
 * low-res offscreen buffer the pixel-art skins use.
 *
 * Faithful to the source:
 *   - the real cloud silhouette, as vector path data
 *   - body renders DARK with LIGHT eyes (the SVG achieves this by masking an ink rect)
 *   - eye capsules 0.24 x 0.51 of the body radius, drifting independently, blinking by
 *     collapsing vertically (the source animates scaleY 0.99 -> 0.22)
 *   - the eye pair sits slightly right of centre, which is what makes it look attentive
 *
 * Added, because the source is a static avatar and this is a status widget: a rim light
 * in the state colour. A near-black cloud would otherwise disappear on a dark desktop.
 */

SKINS.bloub = (() => {
  const CX = 44;
  const CY = 30;
  const BASE_R = 19; // half the cloud's mean width in logical px

  const INK = "#14131a";
  const EYE = "#f9f9f9";

  // Path data lifted verbatim from the SVG, in its own 250-unit viewBox coordinates.
  const CLOUD_D =
    "M91.76 0.33C93.06 3.31 94.09 6.47 94.78 9.65C95.47 12.82 95.86 16.12 95.92 19.37C95.98 22.62 95.71 25.93 95.13 29.13C94.56 32.33 93.65 35.53 92.46 38.55C91.27 41.57 89.75 44.53 87.99 47.26C86.23 49.99 84.17 52.6 81.91 54.93C79.65 57.27 77.12 59.42 74.45 61.27C71.77 63.12 68.87 64.74 65.89 66.03C62.91 67.32 59.74 68.34 56.56 69.02C53.38 69.7 49.48 68.96 46.83 70.13C44.18 71.31 42.86 74.23 40.67 76.06C38.47 77.9 36.12 79.62 33.66 81.14C31.2 82.65 28.59 84.02 25.92 85.17C23.25 86.32 20.46 87.3 17.64 88.05C14.81 88.81 11.9 89.36 8.99 89.69C6.08 90.03 3.11 90.15 0.19 90.05C-2.74 89.95 -5.69 89.63 -8.56 89.11C-11.43 88.59 -14.29 87.84 -17.04 86.91C-19.78 85.98 -22.49 84.84 -25.05 83.53C-27.62 82.22 -30.07 80.66 -32.42 79.06C-34.78 77.46 -36.4 74.8 -39.16 73.94C-41.91 73.07 -45.7 74.19 -48.95 73.87C-52.2 73.55 -55.49 72.92 -58.64 72.01C-61.79 71.1 -64.93 69.87 -67.88 68.39C-70.82 66.91 -73.69 65.12 -76.32 63.12C-78.95 61.11 -81.45 58.82 -83.67 56.36C-85.89 53.9 -87.92 51.18 -89.65 48.35C-91.38 45.51 -92.87 42.47 -94.05 39.36C-95.23 36.26 -96.13 32.99 -96.71 29.72C-97.29 26.46 -97.57 23.08 -97.54 19.77C-97.51 16.46 -97.17 13.09 -96.53 9.85C-95.89 6.61 -94.93 3.38 -93.72 0.33C-92.5 -2.73 -90.97 -5.71 -89.23 -8.48C-87.48 -11.24 -85.45 -13.88 -83.25 -16.27C-81.05 -18.65 -77.97 -20.6 -76.03 -22.79C-74.09 -24.98 -72.47 -26.93 -71.62 -29.41C-70.77 -31.89 -71.4 -34.96 -70.93 -37.68C-70.46 -40.41 -69.74 -43.15 -68.8 -45.77C-67.86 -48.39 -66.67 -50.97 -65.28 -53.4C-63.89 -55.82 -62.25 -58.16 -60.45 -60.31C-58.66 -62.46 -56.63 -64.49 -54.48 -66.29C-52.33 -68.09 -49.98 -69.72 -47.55 -71.12C-45.12 -72.51 -42.52 -73.71 -39.89 -74.65C-37.26 -75.6 -34.5 -76.32 -31.75 -76.78C-29.01 -77.25 -26.18 -77.47 -23.41 -77.46C-20.64 -77.44 -17.83 -77.17 -15.13 -76.68C-12.43 -76.18 -9.74 -75.44 -7.18 -74.5C-4.63 -73.56 -2.14 -72.38 0.19 -71.04C2.51 -69.71 4.63 -67.64 6.77 -66.47C8.9 -65.3 10.71 -64.02 12.98 -64.01C15.26 -64 17.89 -65.83 20.43 -66.41C22.98 -66.98 25.63 -67.34 28.26 -67.45C30.89 -67.56 33.59 -67.43 36.21 -67.06C38.83 -66.69 41.47 -66.07 43.99 -65.23C46.51 -64.39 49.01 -63.3 51.34 -62C53.68 -60.71 55.93 -59.18 58 -57.48C60.06 -55.78 62 -53.86 63.72 -51.81C65.44 -49.76 66.99 -47.52 68.31 -45.19C69.62 -42.86 70.74 -40.37 71.61 -37.85C72.48 -35.32 73.12 -32.68 73.51 -30.04C73.9 -27.41 72.77 -24.44 73.96 -22.05C75.14 -19.65 78.45 -17.98 80.62 -15.67C82.79 -13.37 85.12 -10.89 86.98 -8.22C88.84 -5.55 90.46 -2.65 91.76 0.33Z";

  const cloud = new Path2D(CLOUD_D);
  // The source path spans ~194 x 168 units centred near (-0.8, 6.3); normalise so our
  // own centre and radius control placement rather than the artwork's coordinate system.
  const SRC_R = 96;
  const SRC_CX = -0.79;
  const SRC_CY = 6.34;

  /** Rounded-end capsule, matching the eye shape in the source. */
  function capsule(ctx, cx, cy, w, h, color) {
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

  return {
    label: "Bloub (ink)",
    smooth: true,
    burstOrigin: (scale) => [CX, CY - BASE_R * scale * 0.85],

    draw(ctx, cfg, state, now, dt, pose) {
      const r = BASE_R * pose.scale;
      const k = r / SRC_R;
      const cx = CX + pose.shake;
      const cy = CY + pose.bob;

      // A slow breathing squash keeps the ink alive without deforming the lobes.
      const breathe = state === "idle" ? 0.004 : 0.012;
      const sx = (1 + Math.sin(now / 1400) * breathe) / Math.sqrt(pose.squash);
      const sy = (1 - Math.sin(now / 1400) * breathe) * pose.squash;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k * sx, k * sy);
      ctx.translate(-SRC_CX, -SRC_CY);

      ctx.fillStyle = INK;
      ctx.fill(cloud);

      // Rim light, so a near-black body still separates from a dark desktop.
      ctx.strokeStyle = cfg.rim;
      ctx.lineWidth = 1.6 / (k * sx);
      ctx.lineJoin = "round";
      ctx.stroke(cloud);
      ctx.restore();

      // --- eyes ---
      let w = r * 0.26;
      let h = r * 0.54;
      // The source's pair sits ~0.10r right of centre; that slight offset is what reads
      // as "attentive" rather than blank, so it's kept.
      const bias = r * 0.1;
      const sep = r * 0.25;
      const eyeCy = cy - r * 0.08;

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
        h = r * 0.2; // happy squint
        w = r * 0.34;
      } else {
        h = r * 0.34; // heavy lids
        if (now % 5200 < 200) blink = 0.2;
      }

      const hh = Math.max(r * 0.06, h * blink);
      capsule(ctx, cx + bias - sep + driftL + pose.eyeDx, eyeCy + driftY, w, hh, EYE);
      capsule(ctx, cx + bias + sep + driftR + pose.eyeDx, eyeCy + driftY, w, hh, EYE);

      // Sparkle when pleased, in place of the pixel skins' sparkle eye.
      if (state === "done") {
        const sxp = cx + bias + sep + r * 0.5;
        const syp = cy - r * 0.45;
        ctx.fillStyle = cfg.rim;
        ctx.fillRect(sxp - 0.4, syp - 1.6, 0.8, 3.2);
        ctx.fillRect(sxp - 1.6, syp - 0.4, 3.2, 0.8);
      }
    },
  };
})();
