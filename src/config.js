/* Shared constants for the orb window. Loaded before everything else. */

// The grid is wider than it is tall: the planet skin needs room for the moon's orbit,
// and every skin needs somewhere for confetti to arc into.
const GRID_W = 88;
const GRID_H = 64;
const SCALE = 2; // logical pixel -> CSS px

const POLL_MS = 700; // how often we re-read status.json
const IDLE_AFTER_MS = 5 * 60 * 1000; // no update in this long -> "idle"

const VALID_STATES = new Set(["working", "waiting", "done", "idle"]);

const P = {
  // Bright, near-white centre shared by every state; the tint lives in the mid/rim.
  core: "#fbf8f2",
  lit: "#fffdf8",
  // Warm near-black rather than a cold one — softer face at this size.
  ink: "#4a4250",
  blush: "#f0b3aa",
  shadow: "rgba(18, 16, 22, 0.28)",
};

// Each state paints the body as three tones — a bright core, a tinted mid, and a
// saturated rim light along the shaded edge. The tonal spread is what makes it read
// as a lit, rounded form instead of a flat pale shape.
const STATES = {
  working: { glow: "#7aa2f7", strength: 0.45, mid: "#dbe3f7", rim: "#8fb0f9" },
  waiting: { glow: "#f0a63c", strength: 0.9, mid: "#f6e3c6", rim: "#f0ac4c" },
  done: { glow: "#5ed69a", strength: 0.85, mid: "#d2ecdd", rim: "#63d69f" },
  idle: { glow: "#8b8b96", strength: 0.2, mid: "#e3e1e6", rim: "#a5a5b0" },
};

// ------------------------------------------------------------------- growth
//
// The creature grows with tokens spent. Growth is logarithmic: linear scaling would
// leave it microscopic for a whole day and then peg at maximum forever after.
//
// "total"   — lifetime tokens across every session (a pet that grows as you use it)
// "session" — resets each session, so it grows as the current session gets expensive
const GROWTH_SOURCE = "total";

// Calibrated against real transcripts: one long working session runs to well over a
// million tokens, so a lifetime scale has to span far more than a session scale or the
// creature is fully grown after a single afternoon.
const GROWTH_RANGE = {
  total: { min: 50_000, max: 100_000_000 },
  session: { min: 10_000, max: 2_000_000 },
};

const SIZE_MIN = 0.34; // fraction of full size at the low end

/** tokens -> 0..1 */
function growthFromTokens(tokens) {
  const { min, max } = GROWTH_RANGE[GROWTH_SOURCE] ?? GROWTH_RANGE.total;
  if (!tokens || tokens <= min) return 0;
  const t = Math.log(tokens / min) / Math.log(max / min);
  return Math.max(0, Math.min(1, t));
}

/** 0..1 -> body scale multiplier */
function scaleFromGrowth(g) {
  return SIZE_MIN + (1 - SIZE_MIN) * g;
}

/** 1234567 -> "1.2M", for the readout. */
function formatTokens(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return String(n);
}

// Skins register themselves here; see skin-*.js.
const SKINS = {};
const DEFAULT_SKIN = "planet";
