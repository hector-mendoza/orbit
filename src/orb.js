/* Orbit — pixel-art desktop pet for Claude Code session status.
 *
 * This file is the driver: canvas setup, reading the status file, deciding the current
 * state, and running the frame loop. The creature itself comes from a skin (skin-*.js),
 * chosen from the tray menu or by right-clicking the window.
 */

// ---------------------------------------------------------------- canvas setup

const view = document.getElementById("orb");
const off = document.createElement("canvas");
off.width = GRID_W;
off.height = GRID_H;
const octx = off.getContext("2d");

const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
const cssW = GRID_W * SCALE;
const cssH = GRID_H * SCALE;
view.style.width = `${cssW}px`;
view.style.height = `${cssH}px`;
view.width = cssW * dpr;
view.height = cssH * dpr;
const vctx = view.getContext("2d");
vctx.imageSmoothingEnabled = false;

// ------------------------------------------------------------------ skin state

let skinName = DEFAULT_SKIN;

function activeSkin() {
  return SKINS[skinName] ?? SKINS[DEFAULT_SKIN];
}

function setSkin(name) {
  if (!SKINS[name] || name === skinName) return;
  skinName = name;
  particles.length = 0; // a half-finished burst from the old skin would look wrong
}

// ------------------------------------------------------------------ main frame

const particles = [];

// Growth eases toward its target rather than snapping, so you actually see the
// creature grow when a burst of tokens lands instead of it just teleporting bigger.
let targetScale = scaleFromGrowth(0);
let currentScale = targetScale;

let currentState = "idle";
let enteredAt = performance.now();
let lastFrame = performance.now();

// Click feedback: a brief squash so the creature visibly reacts to being poked.
const POKE_MS = 320;
let pokeAt = -Infinity;

function poke() {
  pokeAt = performance.now();
}

function render(now) {
  const dt = Math.min(64, now - lastFrame);
  lastFrame = now;

  const cfg = STATES[currentState] ?? STATES.idle;
  const pose = basePose(currentState, now);

  currentScale += (targetScale - currentScale) * (1 - Math.exp(-dt / 500));
  pose.scale = currentScale;

  const pokeT = (now - pokeAt) / POKE_MS;
  if (pokeT >= 0 && pokeT <= 1) {
    // Squash down and back up over the poke's duration.
    pose.squash *= 1 - Math.sin(pokeT * Math.PI) * 0.14;
    pose.bob += Math.round(Math.sin(pokeT * Math.PI) * 2);
  }

  const skin = activeSkin();

  if (skin.smooth) {
    // Smooth skins draw straight onto the visible canvas at device resolution, with a
    // transform so they can still think in logical grid units. Routing them through the
    // low-res offscreen buffer is exactly what would pixelate them.
    vctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
    vctx.clearRect(0, 0, GRID_W, GRID_H);
    vctx.imageSmoothingEnabled = true;
    skin.draw(vctx, cfg, currentState, now, dt, pose);
    stepConfetti(particles, dt);
    drawConfetti(vctx, particles);
    vctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    octx.clearRect(0, 0, GRID_W, GRID_H);
    skin.draw(octx, cfg, currentState, now, dt, pose);

    stepConfetti(particles, dt);
    drawConfetti(octx, particles);

    vctx.imageSmoothingEnabled = false;
    vctx.clearRect(0, 0, view.width, view.height);
    vctx.drawImage(off, 0, 0, GRID_W, GRID_H, 0, 0, view.width, view.height);
  }

  requestAnimationFrame(render);
}

// ------------------------------------------------------------------- status IO

const root = document.documentElement;
const hudProject = document.getElementById("project");
const hudState = document.getElementById("state");
const hudTokens = document.getElementById("tokens");

let newestTs = 0; // guards against out-of-order writes from concurrent sessions
let lastEventKey = "";

function applyState(state, project) {
  if (state !== currentState) {
    currentState = state;
    enteredAt = performance.now();
    const cfg = STATES[state];
    root.style.setProperty("--glow-color", cfg.glow);
    root.style.setProperty("--glow-strength", String(cfg.strength));
  }
  hudProject.textContent = project || "no session";
  hudState.textContent = state;
}

function applyTokens(tokens) {
  const n = Number(tokens) || 0;
  targetScale = scaleFromGrowth(growthFromTokens(n));
  hudTokens.textContent = formatTokens(n);
}

function ingest(payload) {
  const raw = payload && payload.status;
  const state = raw && raw.state;

  if (!raw || !VALID_STATES.has(state)) {
    applyState("idle", null);
    applyTokens(0);
    return;
  }

  const parsed = Date.parse(raw.timestamp);
  const ts = Number.isFinite(parsed) ? parsed : null;

  // Ignore a write that is older than one we've already shown — with several
  // sessions firing hooks at once, the last writer isn't always the latest event.
  if (ts !== null && ts < newestTs) return;
  if (ts !== null) newestTs = ts;

  const ageMs =
    ts !== null
      ? Math.max(0, Date.now() - ts)
      : payload.age_secs != null
        ? payload.age_secs * 1000
        : Infinity;

  if (ageMs > IDLE_AFTER_MS) {
    applyState("idle", raw.project);
    applyTokens(GROWTH_SOURCE === "session" ? raw.tokens : raw.tokens_total);
    return;
  }

  // Fire the confetti burst once per distinct "done" event.
  const key = `${state}|${raw.timestamp}|${raw.session_id}`;
  if (state === "done" && key !== lastEventKey) {
    const [bx, by] = activeSkin().burstOrigin(currentScale);
    celebrate(particles, bx, by);
  }
  lastEventKey = key;

  applyState(state, raw.project);
  applyTokens(GROWTH_SOURCE === "session" ? raw.tokens : raw.tokens_total);
}

// ------------------------------------------------------------------- wiring up

const tauri = window.__TAURI__;
const SKIN_ORDER = ["planet", "cat", "ghost", "bloub"];

async function poll() {
  try {
    ingest(await tauri.core.invoke("read_status"));
  } catch (err) {
    console.error("read_status failed", err);
    applyState("idle", null);
  }
}

/**
 * Click-vs-drag. The window used to carry `data-tauri-drag-region`, but that starts a
 * native drag on mousedown and swallows the click event, so a click could never be
 * distinguished from a drag. Instead: watch how far the pointer travels while held, and
 * only hand off to the native drag once it passes a threshold.
 */
function wirePointer(onClick) {
  const stage = document.getElementById("stage");
  const DRAG_THRESHOLD = 4; // px
  let pressX = 0;
  let pressY = 0;
  let pressed = false;
  let dragging = false;

  stage.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    pressed = true;
    dragging = false;
    pressX = e.screenX;
    pressY = e.screenY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!pressed || dragging) return;
    if (Math.hypot(e.screenX - pressX, e.screenY - pressY) > DRAG_THRESHOLD) {
      dragging = true;
      // Native drag takes over from here; the webview stops seeing pointer events, so
      // `pressed` is reset by the next mousedown rather than by a mouseup.
      if (tauri) tauri.window.getCurrentWindow().startDragging();
    }
  });

  window.addEventListener("mouseup", () => {
    if (pressed && !dragging) onClick();
    pressed = false;
  });
}

if (tauri) {
  // Right-click cycles skins, so you don't have to go to the tray for it.
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const next = SKIN_ORDER[(SKIN_ORDER.indexOf(skinName) + 1) % SKIN_ORDER.length];
    tauri.core.invoke("set_skin", { name: next });
  });

  wirePointer(async () => {
    poke();
    try {
      const opened = await tauri.core.invoke("open_project");
      // Brief confirmation; the next poll restores the real state text.
      hudState.textContent = `opening ${opened}`;
    } catch (err) {
      console.error("open_project failed", err);
      hudState.textContent = "no project";
    }
  });

  // Rust owns the persisted setting; it broadcasts whenever it changes so the tray
  // check marks and the window can never disagree.
  tauri.event.listen("skin-changed", (e) => setSkin(e.payload));
  tauri.core.invoke("get_skin").then(setSkin).catch(() => {});

  poll();
  setInterval(poll, POLL_MS);
} else {
  // Browser preview: no Tauri backend, so fake the feed.
  // `?state=working` pins one state, `?skin=cat` picks a skin; otherwise it cycles.
  const params = new URLSearchParams(location.search);
  const pinnedSkin = params.get("skin");
  if (pinnedSkin && SKINS[pinnedSkin]) skinName = pinnedSkin;

  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setSkin(SKIN_ORDER[(SKIN_ORDER.indexOf(skinName) + 1) % SKIN_ORDER.length]);
  });
  wirePointer(poke);

  const pinned = params.get("state");
  const fakeTokens = Number(params.get("tokens")) || 0;
  const fake = (s, i) =>
    ingest({
      status: {
        state: s,
        project: "orbit",
        timestamp: new Date().toISOString(),
        session_id: `demo-${i}`,
        tokens: fakeTokens,
        tokens_total: fakeTokens,
      },
    });

  if (pinned && VALID_STATES.has(pinned)) {
    fake(pinned, 0);
    // Keep re-firing so "done" keeps showing its confetti in the preview.
    if (pinned === "done") setInterval(() => fake(pinned, Math.random()), 2600);
  } else {
    const order = ["working", "waiting", "done", "idle"];
    let i = 0;
    const tick = () => fake(order[i++ % order.length], i);
    tick();
    setInterval(tick, 3500);
  }
}

requestAnimationFrame(render);
