/* Corner/side docking — shrinks the orb at screen edges to reclaim desktop space.
 *
 * When dragged near an edge, the window snaps partially off-screen. Hovering peeks it
 * back out; clicking restores full size. Preferences persist via Tauri config.
 */

const DOCK = {
  /** Logical CSS px — converted with monitor scale when measuring. */
  snapPx: 48,
  peekPx: 36,
  dockScale: 0.55,
  hoverScale: 0.85,
  normalW: 190,
  normalH: 152,
  compactW: 148,
  compactH: 118,
};

/** @typedef {"none"|"left"|"right"|"top"|"bottom"|"top-left"|"top-right"|"bottom-left"|"bottom-right"} DockEdge */

let dockEdge = /** @type {DockEdge} */ ("none");
let dockHovered = false;
let dockExpanded = false;
let compactMode = false;
let hideProject = false;

/** Ignore move events caused by our own setPosition/setSize. */
let suppressMoves = 0;
let dragPollTimer = null;
let settleTimer = null;
let lastPosKey = "";

const dockRoot = document.documentElement;
const stageEl = () => document.getElementById("stage");

function dockScale() {
  if (dockExpanded || dockEdge === "none") return 1;
  return dockHovered ? DOCK.hoverScale : DOCK.dockScale;
}

function applyDockClasses() {
  const s = stageEl();
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

function tauriApi() {
  return window.__TAURI__ || null;
}

function currentWin() {
  const t = tauriApi();
  return t ? t.window.getCurrentWindow() : null;
}

function physicalPosition(x, y) {
  const t = tauriApi();
  if (t?.dpi?.PhysicalPosition) return new t.dpi.PhysicalPosition(x, y);
  // Fallback shape some webview builds accept.
  return { type: "Physical", x, y };
}

function physicalSize(w, h) {
  const t = tauriApi();
  if (t?.dpi?.PhysicalSize) return new t.dpi.PhysicalSize(w, h);
  return { type: "Physical", width: w, height: h };
}

async function withSuppressedMoves(fn) {
  suppressMoves += 1;
  try {
    await fn();
  } finally {
    // Keep suppression briefly so the resulting onMoved callbacks are ignored.
    setTimeout(() => {
      suppressMoves = Math.max(0, suppressMoves - 1);
    }, 280);
  }
}

async function getMonitor() {
  const win = currentWin();
  if (!win) return null;
  const monitor = await win.currentMonitor();
  if (!monitor) return null;
  return {
    x: monitor.position.x,
    y: monitor.position.y,
    w: monitor.size.width,
    h: monitor.size.height,
    scale: monitor.scaleFactor || 1,
  };
}

async function getBounds() {
  const win = currentWin();
  if (!win) return null;
  const pos = await win.outerPosition();
  const size = await win.outerSize();
  return { x: pos.x, y: pos.y, w: size.width, h: size.height };
}

/** Pick the nearest edge/corner within snap range. */
function detectEdge(bounds, mon) {
  const snap = DOCK.snapPx * mon.scale;
  const left = bounds.x - mon.x;
  const top = bounds.y - mon.y;
  const right = mon.x + mon.w - (bounds.x + bounds.w);
  const bottom = mon.y + mon.h - (bounds.y + bounds.h);

  const nearLeft = left < snap;
  const nearRight = right < snap;
  const nearTop = top < snap;
  const nearBottom = bottom < snap;

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

async function setWinPos(x, y) {
  const win = currentWin();
  if (!win) return;
  await withSuppressedMoves(async () => {
    await win.setPosition(physicalPosition(Math.round(x), Math.round(y)));
  });
}

/** Position window so only a sliver remains visible at the chosen edge. */
async function snapToEdge(edge) {
  if (!edge || edge === "none") return;

  const mon = await getMonitor();
  const bounds = await getBounds();
  if (!mon || !bounds) return;

  const peek = Math.round(DOCK.peekPx * mon.scale);
  let x = bounds.x;
  let y = bounds.y;

  if (edge.includes("left") || edge === "left") {
    x = mon.x - bounds.w + peek;
  } else if (edge.includes("right") || edge === "right") {
    x = mon.x + mon.w - peek;
  }

  if (edge.includes("top") || edge === "top") {
    y = mon.y - bounds.h + peek;
  } else if (edge.includes("bottom") || edge === "bottom") {
    y = mon.y + mon.h - peek;
  }

  // Side-only docks keep the current Y, but clamp so the peek stays on-screen.
  if (edge === "left" || edge === "right") {
    const margin = Math.round(12 * mon.scale);
    y = Math.min(
      Math.max(y, mon.y + margin),
      mon.y + mon.h - bounds.h - margin,
    );
  }
  if (edge === "top" || edge === "bottom") {
    const margin = Math.round(12 * mon.scale);
    x = Math.min(
      Math.max(x, mon.x + margin),
      mon.x + mon.w - bounds.w - margin,
    );
  }

  await setWinPos(x, y);
}

async function undock(inward = true) {
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
      if (x < mon.x + margin) x = mon.x + margin;
      if (y < mon.y + margin) y = mon.y + margin;
      if (x + bounds.w > mon.x + mon.w - margin) {
        x = mon.x + mon.w - bounds.w - margin;
      }
      if (y + bounds.h > mon.y + mon.h - margin) {
        y = mon.y + mon.h - bounds.h - margin;
      }
      await setWinPos(x, y);
    }
  }

  persistDock("none");
}

async function tryDock() {
  if (dockExpanded || suppressMoves > 0) return;
  const mon = await getMonitor();
  const bounds = await getBounds();
  if (!mon || !bounds) return;

  const edge = detectEdge(bounds, mon);
  if (edge === "none") {
    if (dockEdge !== "none") await undock(false);
    return;
  }

  if (edge === dockEdge) {
    // Already docked on this edge — just ensure peek position is correct.
    await snapToEdge(edge);
    return;
  }

  dockEdge = edge;
  dockHovered = false;
  dockExpanded = false;
  applyDockClasses();
  await snapToEdge(edge);
  persistDock(edge);
}

function persistDock(edge) {
  const t = tauriApi();
  if (t) t.core.invoke("set_dock_edge", { edge }).catch(() => {});
}

async function applyWindowSize() {
  const win = currentWin();
  if (!win) return;
  const { w, h } = windowSize();
  const scale = (await getMonitor())?.scale || window.devicePixelRatio || 1;
  try {
    await withSuppressedMoves(async () => {
      // Logical size matches tauri.conf.json units; PhysicalSize needs px * dpr.
      const t = tauriApi();
      if (t?.dpi?.LogicalSize) {
        await win.setSize(new t.dpi.LogicalSize(w, h));
      } else {
        await win.setSize(physicalSize(Math.round(w * scale), Math.round(h * scale)));
      }
    });
  } catch (err) {
    console.warn("setSize failed", err);
  }
}

/** Apply UI only — does not write config or emit (avoids tray↔JS feedback loops). */
function applyCompact(enabled) {
  const next = !!enabled;
  if (compactMode === next) {
    applyDockClasses();
    return;
  }
  compactMode = next;
  applyDockClasses();
  applyWindowSize();
}

function applyHideProject(enabled) {
  const next = !!enabled;
  if (hideProject === next) {
    applyDockClasses();
    return;
  }
  hideProject = next;
  applyDockClasses();
}

function setCompact(enabled) {
  applyCompact(enabled);
  const t = tauriApi();
  if (t) t.core.invoke("set_compact", { enabled: compactMode }).catch(() => {});
}

function setHideProject(enabled) {
  applyHideProject(enabled);
  const t = tauriApi();
  if (t) t.core.invoke("set_hide_project", { enabled: hideProject }).catch(() => {});
}

/**
 * Native startDragging swallows mouseup in the webview. Poll position until it
 * settles, then run dock detection.
 */
function notifyDragStarted() {
  clearInterval(dragPollTimer);
  clearTimeout(settleTimer);
  lastPosKey = "";
  let stableHits = 0;

  dragPollTimer = setInterval(async () => {
    if (suppressMoves > 0) return;
    try {
      const b = await getBounds();
      if (!b) return;
      const key = `${b.x},${b.y}`;
      if (key === lastPosKey) {
        stableHits += 1;
        if (stableHits >= 3) {
          clearInterval(dragPollTimer);
          dragPollTimer = null;
          tryDock();
        }
      } else {
        lastPosKey = key;
        stableHits = 0;
      }
    } catch {
      /* ignore transient IPC errors mid-drag */
    }
  }, 80);

  // Safety stop — don't poll forever if the window never settles.
  settleTimer = setTimeout(() => {
    if (dragPollTimer) {
      clearInterval(dragPollTimer);
      dragPollTimer = null;
      tryDock();
    }
  }, 4000);
}

function scheduleDockCheck() {
  if (suppressMoves > 0 || dockExpanded) return;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => tryDock(), 140);
}

function initDock() {
  const t = tauriApi();
  if (!t) return;

  const s = stageEl();
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

  // Best-effort: some builds deliver onMoved; drag-poll covers the rest.
  try {
    const win = currentWin();
    if (win && typeof win.onMoved === "function") {
      win.onMoved(() => scheduleDockCheck());
    }
  } catch {
    /* drag poll is the primary path */
  }

  Promise.all([
    t.core.invoke("get_compact").catch(() => false),
    t.core.invoke("get_hide_project").catch(() => false),
    t.core.invoke("get_dock_edge").catch(() => "none"),
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

  // Apply-only handlers — Rust already persisted; do not invoke back.
  t.event.listen("compact-changed", (e) => applyCompact(e.payload));
  t.event.listen("hide-project-changed", (e) => applyHideProject(e.payload));
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

window.OrbitDock = {
  initDock,
  handleDockClick,
  setCompact,
  setHideProject,
  notifyDragStarted,
  isDocked: () => dockEdge !== "none" && !dockExpanded,
};
