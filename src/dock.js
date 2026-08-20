/* Corner/side docking — shrinks the orb at screen edges to reclaim desktop space.
 *
 * When dragged near an edge, the window snaps partially off-screen. Hovering peeks it
 * back out; clicking restores full size. Preferences persist via Tauri config.
 */

const DOCK = {
  snapPx: 52,
  peekPx: 28,
  dockScale: 0.52,
  hoverScale: 0.82,
  normalW: 190,
  normalH: 152,
  compactW: 148,
  compactH: 118,
};

/** @typedef {"none"|"left"|"right"|"top"|"bottom"|"top-left"|"top-right"|"bottom-left"|"bottom-right"} DockEdge */

let dockEdge = /** @type {DockEdge} */ ("none");
let dockHovered = false;
let dockExpanded = false;
let moveTimer = null;
let compactMode = false;
let hideProject = false;

const dockRoot = document.documentElement;
const stage = () => document.getElementById("stage");
const hud = () => document.getElementById("hud");

function dockScale() {
  if (dockExpanded || dockEdge === "none") return 1;
  return dockHovered ? DOCK.hoverScale : DOCK.dockScale;
}

function applyDockClasses() {
  const s = stage();
  if (!s) return;
  s.classList.toggle("docked", dockEdge !== "none" && !dockExpanded);
  s.classList.toggle("docked-hover", dockEdge !== "none" && !dockExpanded && dockHovered);
  s.classList.toggle("docked-expanded", dockExpanded);
  dockRoot.classList.toggle("compact", compactMode);
  dockRoot.classList.toggle("hide-project", hideProject);
  dockRoot.style.setProperty("--dock-scale", String(dockScale()));

  const origins = {
    left: "left center",
    right: "right center",
    top: "center top",
    bottom: "center bottom",
    "top-left": "left top",
    "top-right": "right top",
    "bottom-left": "left bottom",
    "bottom-right": "right bottom",
  };
  s.style.transformOrigin = origins[dockEdge] ?? "center center";
}

function windowSize() {
  return compactMode
    ? { w: DOCK.compactW, h: DOCK.compactH }
    : { w: DOCK.normalW, h: DOCK.normalH };
}

async function getMonitor() {
  const tauri = window.__TAURI__;
  if (!tauri) return null;
  const win = tauri.window.getCurrentWindow();
  const monitor = await win.currentMonitor();
  if (!monitor) return null;
  return {
    x: monitor.position.x,
    y: monitor.position.y,
    w: monitor.size.width,
    h: monitor.size.height,
    scale: monitor.scaleFactor,
  };
}

async function getBounds() {
  const tauri = window.__TAURI__;
  if (!tauri) return null;
  const win = tauri.window.getCurrentWindow();
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  return { x: pos.x, y: pos.y, w: size.width, h: size.height };
}

/** Pick the nearest edge/corner within snap range. */
function detectEdge(bounds, mon) {
  const left = bounds.x - mon.x;
  const top = bounds.y - mon.y;
  const right = mon.x + mon.w - (bounds.x + bounds.w);
  const bottom = mon.y + mon.h - (bounds.y + bounds.h);

  const nearLeft = left < DOCK.snapPx;
  const nearRight = right < DOCK.snapPx;
  const nearTop = top < DOCK.snapPx;
  const nearBottom = bottom < DOCK.snapPx;

  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  if (nearTop) return "top";
  if (nearBottom) return "bottom";
  return "none";
}

/** Position window so only a sliver remains visible at the chosen edge. */
async function snapToEdge(edge) {
  const tauri = window.__TAURI__;
  if (!tauri || edge === "none") return;

  const mon = await getMonitor();
  const bounds = await getBounds();
  if (!mon || !bounds) return;

  const peek = Math.round(DOCK.peekPx * mon.scale);
  let x = bounds.x;
  let y = bounds.y;

  switch (edge) {
    case "left":
    case "top-left":
    case "bottom-left":
      x = mon.x - bounds.w + peek;
      break;
    case "right":
    case "top-right":
    case "bottom-right":
      x = mon.x + mon.w - peek;
      break;
    default:
      break;
  }

  switch (edge) {
    case "top":
    case "top-left":
    case "top-right":
      y = mon.y - bounds.h + peek;
      break;
    case "bottom":
    case "bottom-left":
    case "bottom-right":
      y = mon.y + mon.h - peek;
      break;
    default:
      break;
  }

  await tauri.window.getCurrentWindow().setPosition({ x, y });
}

async function undock(inward = true) {
  const tauri = window.__TAURI__;
  if (!tauri) return;

  dockEdge = "none";
  dockHovered = false;
  dockExpanded = false;
  applyDockClasses();

  if (inward) {
    const mon = await getMonitor();
    const bounds = await getBounds();
    if (mon && bounds) {
      const margin = Math.round(16 * mon.scale);
      let x = bounds.x;
      let y = bounds.y;
      // Nudge fully on-screen
      if (x < mon.x + margin) x = mon.x + margin;
      if (y < mon.y + margin) y = mon.y + margin;
      if (x + bounds.w > mon.x + mon.w - margin) x = mon.x + mon.w - bounds.w - margin;
      if (y + bounds.h > mon.y + mon.h - margin) y = mon.y + mon.h - bounds.h - margin;
      await tauri.window.getCurrentWindow().setPosition({ x, y });
    }
  }

  persistDock("none");
}

async function tryDock() {
  if (dockExpanded) return;
  const mon = await getMonitor();
  const bounds = await getBounds();
  if (!mon || !bounds) return;

  const edge = detectEdge(bounds, mon);
  if (edge === "none") {
    if (dockEdge !== "none") await undock(false);
    return;
  }

  dockEdge = edge;
  dockHovered = false;
  applyDockClasses();
  await snapToEdge(edge);
  persistDock(edge);
}

function persistDock(edge) {
  const tauri = window.__TAURI__;
  if (tauri) tauri.core.invoke("set_dock_edge", { edge }).catch(() => {});
}

async function applyWindowSize() {
  const tauri = window.__TAURI__;
  if (!tauri) return;
  const { w, h } = windowSize();
  try {
    const win = tauri.window.getCurrentWindow();
    await win.setSize({ width: w, height: h });
  } catch {
    // CSS compact mode still applies if native resize is unavailable.
  }
}

function setCompact(enabled) {
  compactMode = !!enabled;
  applyDockClasses();
  applyWindowSize();
  const tauri = window.__TAURI__;
  if (tauri) tauri.core.invoke("set_compact", { enabled: compactMode }).catch(() => {});
}

function setHideProject(enabled) {
  hideProject = !!enabled;
  applyDockClasses();
  const tauri = window.__TAURI__;
  if (tauri) tauri.core.invoke("set_hide_project", { enabled: hideProject }).catch(() => {});
}

function initDock() {
  const tauri = window.__TAURI__;
  if (!tauri) return;

  const s = stage();
  if (!s) return;

  s.addEventListener("mouseenter", () => {
    if (dockEdge !== "none" && !dockExpanded) {
      dockHovered = true;
      applyDockClasses();
    }
  });

  s.addEventListener("mouseleave", () => {
    if (dockEdge !== "none" && !dockExpanded) {
      dockHovered = false;
      applyDockClasses();
    }
  });

  // Debounced dock check after window moves (drag end).
  try {
    const win = tauri.window.getCurrentWindow();
    if (typeof win.onMoved === "function") {
      win.onMoved(() => {
        if (dockExpanded) return;
        clearTimeout(moveTimer);
        moveTimer = setTimeout(() => tryDock(), 120);
      });
    }
  } catch {
    // Fallback: check dock state on pointer release after drag threshold.
  }

  // Load persisted prefs
  Promise.all([
    tauri.core.invoke("get_compact").catch(() => false),
    tauri.core.invoke("get_hide_project").catch(() => false),
    tauri.core.invoke("get_dock_edge").catch(() => "none"),
  ]).then(([compact, hide, edge]) => {
    compactMode = !!compact;
    hideProject = !!hide;
    applyDockClasses();
    applyWindowSize().then(() => {
      if (edge && edge !== "none") {
        dockEdge = edge;
        applyDockClasses();
        snapToEdge(edge);
      }
    });
  });

  tauri.event.listen("compact-changed", (e) => setCompact(e.payload));
  tauri.event.listen("hide-project-changed", (e) => setHideProject(e.payload));
}

/** Call from click handler: restore full size when docked, otherwise pass through. */
function handleDockClick(onNormalClick) {
  if (dockEdge !== "none" && !dockExpanded) {
    dockExpanded = true;
    dockHovered = false;
    applyDockClasses();
    undock(true);
    return true;
  }
  return onNormalClick();
}

// Export for orb.js
window.OrbitDock = {
  initDock,
  handleDockClick,
  setCompact,
  setHideProject,
  isDocked: () => dockEdge !== "none" && !dockExpanded,
};
