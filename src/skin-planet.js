/* Skin: planet + orbiting moon.
 *
 * The moon's orbital speed is a status channel independent of colour — fast while
 * working, parked and bobbing when waiting, whipping round when done, crawling when
 * idle. It passes behind the planet on the far half of the orbit and in front on the
 * near half, which is what makes it read as depth rather than a dot on a ring.
 */

SKINS.planet = (() => {
  const CX = 44;
  const CY = 31;
  const PLANET_R = 15;

  // The orbit's vertical radius has to clear the planet (r=15) or the whole back half
  // of the path falls inside the planet's own silhouette and the moon just vanishes.
  const ORBIT_RX = 26;
  const ORBIT_RY = 17;

  const PERIOD = { working: 1800, done: 900, idle: 9000 };

  function orbitPath(octx, color, orx, ory) {
    octx.globalAlpha = 0.22;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      px(octx, Math.round(CX + Math.cos(a) * orx), Math.round(CY + Math.sin(a) * ory), 1, 1, color);
    }
    octx.globalAlpha = 1;
  }

  function moon(octx, angle, cfg, orx, ory, s) {
    const mx = CX + Math.cos(angle) * orx;
    const my = CY + Math.sin(angle) * ory;
    const behind = Math.sin(angle) < 0;
    // Farther away on the back half, so it shrinks and dims a little.
    const r = Math.max(1.4, (behind ? 2.4 : 3.1) * s);
    octx.globalAlpha = behind ? 0.75 : 1;
    disc(octx, mx, my, r, cfg.rim);
    if (!behind) px(octx, Math.round(mx) - 1, Math.round(my) - 1, 1, 1, P.lit);
    octx.globalAlpha = 1;
  }

  let angle = Math.PI * 0.25;

  return {
    label: "Planet + moon",
    burstOrigin: (scale) => [CX, CY - PLANET_R * scale - 4],

    draw(octx, cfg, state, now, dt, pose) {
      const s = pose.scale;
      const R = PLANET_R * s;
      const orx = ORBIT_RX * s;
      const ory = Math.max(R + 3, ORBIT_RY * s); // must always clear the planet

      if (state === "waiting") {
        // Parks overhead and bobs, like it's tapping a foot.
        angle = -Math.PI / 2 + Math.sin(now / 260) * 0.22;
      } else {
        angle += (Math.PI * 2 * dt) / PERIOD[state];
      }

      const cy = CY + pose.bob;
      const cx = CX + pose.shake;
      const rx = R / Math.sqrt(pose.squash);
      const ry = R * pose.squash;

      orbitPath(octx, cfg.rim, orx, ory);
      if (Math.sin(angle) < 0) moon(octx, angle, cfg, orx, ory, s); // behind

      shadedEllipse(octx, cx, cy, rx, ry, cfg);

      // Sparse surface patches, kept clear of the face so they read as terrain.
      // Skipped on a small planet, where they'd just be noise.
      if (R >= 11) {
        octx.globalAlpha = 0.5;
        px(octx, Math.round(cx - rx * 0.62), Math.round(cy + ry * 0.34), 4, 2, cfg.rim);
        px(octx, Math.round(cx + rx * 0.1), Math.round(cy - ry * 0.68), 3, 1, cfg.rim);
        octx.globalAlpha = 1;
      }

      drawFaceSized(octx, cx, Math.round(cy - ry * 0.18), pose.face, pose.eyeDx, R);

      if (Math.sin(angle) >= 0) moon(octx, angle, cfg, orx, ory, s); // in front
    },
  };
})();
