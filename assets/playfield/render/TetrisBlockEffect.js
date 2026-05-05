/**
 * TetrisBlockEffect
 *
 * Ambient background effect for Chapter 5 (the red/dark-crimson chapter).
 * Renders a slowly "walking" cluster of grid-aligned square blocks that fade
 * in and out.  The connected group of visible blocks drifts in a smoothly
 * changing random direction: new blocks appear (fade in) at the frontier
 * closest to the drift heading while the oldest trailing blocks fade out.
 * Nothing actually translates – only the set of visible cells changes –
 * creating an organic, Tetris-like polyomino that wanders across the screen.
 *
 * All positions are in logical CSS pixel screen-space so the effect stays
 * fixed to the viewport regardless of camera pan / zoom.
 */

// ─── Tuning constants ─────────────────────────────────────────────────────────

// Size of each square block in logical pixels.
const CELL_SIZE = 48;

// Target size of the visible cluster (cells that are fading-in or fully visible).
const TARGET_CLUSTER = 42;

// Number of cells to maintain as the minimum before growth is forced.
const MIN_CLUSTER = 24;

// How long a single cell takes to fully appear or disappear (milliseconds).
const FADE_DURATION_MS = 1600;

// How frequently the algorithm adds/removes one cell (milliseconds).
const STEP_INTERVAL_MS = 520;

// How often the drift heading is nudged toward a new random direction (ms).
const DRIFT_CHANGE_INTERVAL_MS = 3800;

// Fraction of the drift-aligned frontier considered when picking which cell
// to add next.  Lower = more directional; higher = more scattered.
const FRONTIER_TOP_FRACTION = 0.35;

// Fill alpha for a fully-visible cell (0–1).
const BLOCK_FILL_ALPHA = 0.13;

// Stroke alpha for a fully-visible cell border (0–1).
const BLOCK_STROKE_ALPHA = 0.07;

// Base block color (dark crimson matching Chapter 5's palette).
const BLOCK_COLOR_R = 168;
const BLOCK_COLOR_G = 22;
const BLOCK_COLOR_B = 22;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Encode a grid column + row into a compact string key. */
function cellKey(col, row) {
  return `${col},${row}`;
}

/** Return the four orthogonal neighbours of a grid cell. */
function neighbours(col, row) {
  return [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ];
}

/**
 * Grow a connected seed cluster via random BFS so the initial shape
 * is an organic polyomino rather than a rectangle.
 *
 * @param {number} centerCol  Starting column.
 * @param {number} centerRow  Starting row.
 * @param {number} targetSize Desired cell count.
 * @param {number} gridCols   Grid column count (bounds check).
 * @param {number} gridRows   Grid row count (bounds check).
 * @returns {Array<{col:number,row:number}>}
 */
function buildSeedCluster(centerCol, centerRow, targetSize, gridCols, gridRows) {
  const result = [];
  const visited = new Set();
  const queue = [{ col: centerCol, row: centerRow }];
  visited.add(cellKey(centerCol, centerRow));

  while (result.length < targetSize && queue.length > 0) {
    // Pick a random element from the queue (not just FIFO) for an organic shape.
    const idx = Math.floor(Math.random() * queue.length);
    const { col, row } = queue.splice(idx, 1)[0];

    // Stay within the grid.
    if (col < 0 || row < 0 || col >= gridCols || row >= gridRows) {
      continue;
    }

    result.push({ col, row });

    for (const nb of neighbours(col, row)) {
      const k = cellKey(nb.col, nb.row);
      if (
        !visited.has(k) &&
        nb.col >= 0 && nb.col < gridCols &&
        nb.row >= 0 && nb.row < gridRows
      ) {
        visited.add(k);
        queue.push(nb);
      }
    }
  }

  return result;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new TetrisBlockEffect instance.
 *
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createTetrisBlockEffect() {
  /**
   * Live cell registry.
   * key   = cellKey(col, row)
   * value = { col, row, state: 'fadingIn'|'visible'|'fadingOut', alpha: 0–1, addedAt: ms }
   */
  const cells = new Map();

  // Drift state – the heading (radians) slowly wanders.
  let driftAngle = Math.random() * Math.PI * 2;

  // Timestamps (ms) for the last periodic step and the last drift change.
  let lastStepMs = -1;
  let lastDriftChangeMs = -1;
  let lastTimestampMs = -1;

  // Grid dimensions (updated on first draw call or resize).
  let gridCols = 0;
  let gridRows = 0;

  // Last dimensions at which initialize() was called.  Used to detect when
  // the viewport has changed significantly and a re-initialisation is needed.
  let _initW = 0;
  let _initH = 0;

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Derive grid dimensions from the current logical-pixel viewport size. */
  function computeGrid(viewWidth, viewHeight) {
    gridCols = Math.ceil(viewWidth / CELL_SIZE) + 2;
    gridRows = Math.ceil(viewHeight / CELL_SIZE) + 2;
  }

  /** Pixel x-coordinate of the left edge of a column. */
  function cellX(col) {
    return col * CELL_SIZE;
  }

  /** Pixel y-coordinate of the top edge of a row. */
  function cellY(row) {
    return row * CELL_SIZE;
  }

  /** True when a grid position is within bounds. */
  function inBounds(col, row) {
    return col >= 0 && row >= 0 && col < gridCols && row < gridRows;
  }

  /**
   * Collect cells on the growth frontier: positions adjacent to the live
   * cluster that are not yet occupied.
   */
  function getFrontier() {
    const frontier = [];
    const occupiedKeys = new Set(cells.keys());

    for (const [_key, cell] of cells) {
      if (cell.state === 'fadingOut') continue;
      for (const nb of neighbours(cell.col, cell.row)) {
        const k = cellKey(nb.col, nb.row);
        if (!occupiedKeys.has(k) && inBounds(nb.col, nb.row)) {
          frontier.push(nb);
        }
      }
    }

    return frontier;
  }

  /** Count live cells (not fading-out). */
  function liveCount() {
    let n = 0;
    for (const cell of cells.values()) {
      if (cell.state !== 'fadingOut') n += 1;
    }
    return n;
  }

  /** Cosine of the angle between the drift vector and the direction to (col, row) from origin. */
  function driftScore(col, row) {
    return col * Math.cos(driftAngle) + row * Math.sin(driftAngle);
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  function initialize(viewWidth, viewHeight, nowMs) {
    cells.clear();
    computeGrid(viewWidth, viewHeight);

    // Choose a random starting position so the cluster does not always appear
    // at the same spot when entering the chapter.  A margin keeps it away from
    // the very edges where growth room would be limited.
    const margin    = 3;
    const startCol  = margin + Math.floor(Math.random() * Math.max(1, gridCols - 2 * margin));
    const startRow  = margin + Math.floor(Math.random() * Math.max(1, gridRows - 2 * margin));

    const seed = buildSeedCluster(
      startCol, startRow,
      TARGET_CLUSTER,
      gridCols, gridRows,
    );

    for (const { col, row } of seed) {
      cells.set(cellKey(col, row), {
        col, row,
        state: 'visible',
        alpha: 1,
        addedAt: nowMs,
      });
    }

    lastStepMs = nowMs;
    lastDriftChangeMs = nowMs;
    lastTimestampMs = nowMs;
  }

  // ─── Per-step logic ─────────────────────────────────────────────────────────

  function step(nowMs) {
    // 1. Possibly nudge the drift direction.
    if (nowMs - lastDriftChangeMs >= DRIFT_CHANGE_INTERVAL_MS) {
      // Rotate the heading by a small random amount (±90° range, biased small).
      driftAngle += (Math.random() - 0.5) * Math.PI * 0.55;
      lastDriftChangeMs = nowMs;
    }

    // 2. Add one frontier cell biased toward the drift heading.
    const frontier = getFrontier();
    if (frontier.length > 0) {
      // Score each frontier cell by its alignment with the drift direction.
      frontier.sort((a, b) => driftScore(b.col, b.row) - driftScore(a.col, a.row));
      const topN = Math.max(1, Math.floor(frontier.length * FRONTIER_TOP_FRACTION));
      const pick = frontier[Math.floor(Math.random() * topN)];
      const k = cellKey(pick.col, pick.row);
      if (!cells.has(k)) {
        cells.set(k, {
          col: pick.col, row: pick.row,
          state: 'fadingIn',
          alpha: 0,
          addedAt: nowMs,
        });
      }
    }

    // 3. Remove one old cell biased against the drift heading (trailing removal).
    const live = liveCount();
    if (live >= MIN_CLUSTER) {
      // Collect visible cells (not already fading out).
      const removable = [];
      for (const cell of cells.values()) {
        if (cell.state === 'visible') {
          removable.push(cell);
        }
      }
      if (removable.length > 0) {
        // Cells most behind the drift direction are removed first.
        removable.sort((a, b) => driftScore(a.col, a.row) - driftScore(b.col, b.row));
        const topN = Math.max(1, Math.floor(removable.length * FRONTIER_TOP_FRACTION));
        const pick = removable[Math.floor(Math.random() * topN)];
        pick.state = 'fadingOut';
      }
    }

    lastStepMs = nowMs;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Advance the effect simulation.
   *
   * @param {number} nowMs      Current timestamp from performance.now() (ms).
   * @param {number} viewWidth  Viewport logical width in CSS pixels.
   * @param {number} viewHeight Viewport logical height in CSS pixels.
   */
  function update(nowMs, viewWidth, viewHeight) {
    // Re-initialize on first call, after reset, or when the viewport dimensions
    // have changed significantly (e.g. the canvas was measured at a small interim
    // size during initial layout before stabilizing at its true dimensions).
    if (cells.size === 0 ||
        Math.abs(viewWidth  - _initW) > 100 ||
        Math.abs(viewHeight - _initH) > 100) {
      _initW = viewWidth;
      _initH = viewHeight;
      initialize(viewWidth, viewHeight, nowMs);
    }

    // Recompute grid in case the viewport was resized.
    computeGrid(viewWidth, viewHeight);

    const dt = lastTimestampMs < 0 ? 0 : Math.min(nowMs - lastTimestampMs, 200);
    lastTimestampMs = nowMs;

    // Advance fade animations.
    const fadeRate = 1 / (FADE_DURATION_MS / 1000); // per-second
    const dtSec = dt / 1000;

    for (const [key, cell] of cells) {
      if (cell.state === 'fadingIn') {
        cell.alpha = Math.min(1, cell.alpha + fadeRate * dtSec);
        if (cell.alpha >= 1) {
          cell.state = 'visible';
          cell.alpha = 1;
        }
      } else if (cell.state === 'fadingOut') {
        cell.alpha = Math.max(0, cell.alpha - fadeRate * dtSec);
        if (cell.alpha <= 0) {
          cells.delete(key);
        }
      }
    }

    // Periodic growth / removal step.
    if (lastStepMs < 0 || nowMs - lastStepMs >= STEP_INTERVAL_MS) {
      step(nowMs);
    }
  }

  /**
   * Render the block cluster onto the provided canvas context.
   * The context should currently be in screen-space (pixelRatio transform only)
   * so that blocks remain fixed to the viewport.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!ctx || cells.size === 0) {
      return;
    }

    ctx.save();

    for (const cell of cells.values()) {
      if (cell.alpha <= 0.004) continue;

      const x = cellX(cell.col);
      const y = cellY(cell.row);
      const inner = CELL_SIZE - 1;

      // Filled block.
      ctx.globalAlpha = cell.alpha * BLOCK_FILL_ALPHA;
      ctx.fillStyle = `rgb(${BLOCK_COLOR_R},${BLOCK_COLOR_G},${BLOCK_COLOR_B})`;
      ctx.fillRect(x, y, inner, inner);

      // Subtle border.
      ctx.globalAlpha = cell.alpha * BLOCK_STROKE_ALPHA;
      ctx.strokeStyle = `rgb(${BLOCK_COLOR_R + 40},${BLOCK_COLOR_G + 20},${BLOCK_COLOR_B + 20})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, inner - 1, inner - 1);
    }

    ctx.restore();
  }

  /**
   * Fully reset the effect state so it reinitializes on the next update call.
   * Call when the player leaves Chapter 5 so the cluster is fresh on re-entry.
   */
  function reset() {
    cells.clear();
    _initW = 0;
    _initH = 0;
    lastStepMs = -1;
    lastDriftChangeMs = -1;
    lastTimestampMs = -1;
  }

  return { update, draw, reset };
}
