/* Cell + loop scaffolding for the prototype pages.
 *
 * render-core.js deliberately excludes this — the shipped window has exactly one canvas
 * and doesn't need a grid of demo cells. Load after config.js + render-core.js.
 */

const ORDER = ["working", "waiting", "done", "idle"];
const PROTO_SCALE = 3;

function makeCell(state) {
  const cell = document.createElement("div");
  cell.className = "cell";

  const view = document.createElement("canvas");
  view.style.width = `${GRID_W * PROTO_SCALE}px`;
  view.style.height = `${GRID_H * PROTO_SCALE}px`;
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  view.width = GRID_W * PROTO_SCALE * dpr;
  view.height = GRID_H * PROTO_SCALE * dpr;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = state;

  cell.append(view, label);
  document.getElementById("grid").append(cell);

  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;
  const vctx = view.getContext("2d");
  vctx.imageSmoothingEnabled = false;

  return {
    state,
    cfg: STATES[state],
    octx: off.getContext("2d"),
    vctx,
    view,
    off,
    confetti: [],
    nextBurst: 0,
  };
}

function run(drawFn) {
  const cells = ORDER.map(makeCell);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;
    for (const c of cells) {
      c.octx.clearRect(0, 0, GRID_W, GRID_H);
      drawFn(c, now, dt);
      stepConfetti(c.confetti, dt);
      drawConfetti(c.octx, c.confetti);
      c.vctx.clearRect(0, 0, c.view.width, c.view.height);
      c.vctx.drawImage(c.off, 0, 0, GRID_W, GRID_H, 0, 0, c.view.width, c.view.height);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return cells;
}
