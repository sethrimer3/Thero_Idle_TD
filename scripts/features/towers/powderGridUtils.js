/**
 * Grid and wall helpers extracted from powderTower.js to keep the
 * PowderSimulation class focused on simulation lifecycle and rendering.
 */

/**
 * Mark the wall columns in the grid as blocked cells so grains stay inside.
 * @param {object} simulation - Active PowderSimulation instance.
 */
export function applyWallMask(simulation) {
  if (!simulation.grid.length) {
    return;
  }
  const leftBound = Math.min(simulation.cols, simulation.wallInsetLeftCells);
  const rightStart = Math.max(leftBound, simulation.cols - simulation.wallInsetRightCells);
  for (let row = 0; row < simulation.grid.length; row += 1) {
    const gridRow = simulation.grid[row];
    for (let col = 0; col < leftBound; col += 1) {
      gridRow[col] = -1;
    }
    for (let col = rightStart; col < simulation.cols; col += 1) {
      gridRow[col] = -1;
    }
  }
}

/**
 * Clear playable cells while preserving the masked wall segments.
 * @param {object} simulation - Active PowderSimulation instance.
 */
export function clearGridPreserveWalls(simulation) {
  if (!simulation.grid.length) {
    return;
  }
  for (let row = 0; row < simulation.grid.length; row += 1) {
    const gridRow = simulation.grid[row];
    for (let col = 0; col < simulation.cols; col += 1) {
      if (gridRow[col] !== -1) {
        gridRow[col] = 0;
      }
    }
  }
}

/**
 * Rebuild the grid after resize or wall adjustments while preserving grain positions.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {object|null} previousMetrics - Cached grid metrics before the wall change.
 */
export function rebuildGridAfterWallChange(simulation, previousMetrics = null) {
  if (!simulation.rows || !simulation.cols) {
    return;
  }

  simulation.grid = Array.from({ length: simulation.rows }, () => new Array(simulation.cols).fill(0));
  applyWallMask(simulation);

  const previousCols = Number.isFinite(previousMetrics?.cols)
    ? Math.max(1, Math.round(previousMetrics.cols))
    : null;
  const previousRows = Number.isFinite(previousMetrics?.rows)
    ? Math.max(1, Math.round(previousMetrics.rows))
    : null;
  const previousLeftInset = Number.isFinite(previousMetrics?.wallInsetLeftCells)
    ? Math.max(0, Math.round(previousMetrics.wallInsetLeftCells))
    : null;
  const previousRightInset = Number.isFinite(previousMetrics?.wallInsetRightCells)
    ? Math.max(0, Math.round(previousMetrics.wallInsetRightCells))
    : null;
  const previousScrollOffset = Number.isFinite(previousMetrics?.scrollOffsetCells)
    ? Math.max(0, Math.round(previousMetrics.scrollOffsetCells))
    : null;

  const previousInteriorStart = previousLeftInset !== null ? previousLeftInset : simulation.wallInsetLeftCells;
  const previousInteriorEnd = previousCols !== null
    ? Math.max(
        previousInteriorStart,
        previousCols - (previousRightInset !== null ? previousRightInset : simulation.wallInsetRightCells),
      )
    : Math.max(previousInteriorStart, simulation.cols - simulation.wallInsetRightCells);
  const previousInteriorWidth = Math.max(1, previousInteriorEnd - previousInteriorStart);
  const interiorStart = simulation.wallInsetLeftCells;
  const interiorEnd = Math.max(interiorStart, simulation.cols - simulation.wallInsetRightCells);
  const interiorWidth = Math.max(1, interiorEnd - interiorStart);

  const columnScale = previousCols ? interiorWidth / previousInteriorWidth : 1;
  const rowScale = previousRows ? simulation.rows / previousRows : 1;

  if (previousScrollOffset !== null && rowScale !== 1) {
    simulation.scrollOffsetCells = Math.round(previousScrollOffset * rowScale);
  }

  const minX = simulation.wallInsetLeftCells;
  const maxInterior = Math.max(minX, simulation.cols - simulation.wallInsetRightCells);

  for (const grain of simulation.grains) {
    if (!Number.isFinite(grain.colliderSize) || grain.colliderSize <= 0) {
      grain.colliderSize = simulation.computeColliderSize(grain.size);
    }
    const collider = Math.max(1, Math.round(grain.colliderSize));

    if (previousCols && (columnScale !== 1 || previousInteriorStart !== interiorStart)) {
      const previousAvailable = Math.max(0, previousInteriorWidth - collider);
      const newAvailable = Math.max(0, interiorWidth - collider);
      const normalized = Math.max(0, Math.min(previousAvailable, grain.x - previousInteriorStart));
      const scaled = newAvailable > 0 ? (normalized / (previousAvailable || 1)) * newAvailable : 0;
      grain.x = Math.round(interiorStart + scaled);
    }

    if (previousRows && rowScale !== 1) {
      const previousAvailable = Math.max(0, previousRows - collider);
      const newAvailable = Math.max(0, simulation.rows - collider);
      const normalizedY = Math.max(0, Math.min(previousAvailable, grain.y));
      const scaledY = newAvailable > 0 ? (normalizedY / (previousAvailable || 1)) * newAvailable : 0;
      grain.y = Math.round(scaledY);
    }

    const maxOrigin = Math.max(minX, simulation.cols - simulation.wallInsetRightCells - collider);
    if (grain.x < minX) {
      grain.x = minX;
      grain.freefall = true;
      grain.resting = false;
    } else if (grain.x > maxOrigin) {
      grain.x = maxOrigin;
      grain.freefall = true;
      grain.resting = false;
    }
    if (grain.x + collider > maxInterior) {
      grain.x = Math.max(minX, maxInterior - collider);
    }
    grain.inGrid = false;
  }

  populateGridFromGrains(simulation);
  simulation.updateHeightFromGrains(true);
  simulation.render();
  simulation.notifyWallMetricsChange();
}

/**
 * Place existing grains into the grid, skipping those outside the visible rows.
 * @param {object} simulation - Active PowderSimulation instance.
 */
export function populateGridFromGrains(simulation) {
  if (!simulation.grid.length) {
    return;
  }
  for (const grain of simulation.grains) {
    if (grain.freefall) {
      grain.inGrid = false;
      continue;
    }
    if (!Number.isFinite(grain.colliderSize) || grain.colliderSize <= 0) {
      grain.colliderSize = simulation.computeColliderSize(grain.size);
    }
    const colliderSize = Math.max(1, Math.round(grain.colliderSize));
    if (grain.y >= simulation.rows || grain.y + colliderSize <= 0) {
      grain.inGrid = false;
      continue;
    }
    fillCells(simulation, grain);
    grain.inGrid = true;
  }
}

/**
 * Determine if a grain can occupy the requested coordinates.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {number} x - Target grid column.
 * @param {number} y - Target grid row.
 * @param {number} size - Desired collider size.
 * @returns {boolean} Whether the placement is unobstructed.
 */
export function canPlaceGrain(simulation, x, y, size) {
  const normalizedSize = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 1;
  if (x < 0 || y < 0 || x + normalizedSize > simulation.cols || y + normalizedSize > simulation.rows) {
    return false;
  }
  for (let row = 0; row < normalizedSize; row += 1) {
    const gridRow = simulation.grid[y + row];
    for (let col = 0; col < normalizedSize; col += 1) {
      if (gridRow[x + col]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Stamp the grain ID into the grid to reserve occupied cells.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {object} grain - Grain record with x/y/id/colliderSize fields.
 */
export function fillCells(simulation, grain) {
  const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
  for (let row = 0; row < colliderSize; row += 1) {
    const y = grain.y + row;
    if (y < 0 || y >= simulation.rows) {
      continue;
    }
    const gridRow = simulation.grid[y];
    for (let col = 0; col < colliderSize; col += 1) {
      const x = grain.x + col;
      if (x < 0 || x >= simulation.cols) {
        continue;
      }
      gridRow[x] = grain.id;
    }
  }
}

/**
 * Remove a grain's cells from the grid when it moves.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {object} grain - Grain record with x/y/id/colliderSize fields.
 */
export function clearCells(simulation, grain) {
  if (!grain.inGrid) {
    return;
  }
  const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
  for (let row = 0; row < colliderSize; row += 1) {
    const y = grain.y + row;
    if (y < 0 || y >= simulation.rows) {
      continue;
    }
    const gridRow = simulation.grid[y];
    for (let col = 0; col < colliderSize; col += 1) {
      const x = grain.x + col;
      if (x < 0 || x >= simulation.cols) {
        continue;
      }
      if (gridRow[x] === grain.id) {
        gridRow[x] = 0;
      }
    }
  }
  grain.inGrid = false;
}

/**
 * Measure how many empty cells exist beneath a given column.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {number} column - Column index to inspect.
 * @param {number} startRow - Starting row offset.
 * @returns {number} Number of open cells below the starting row.
 */
export function getSupportDepth(simulation, column, startRow) {
  if (column < 0 || column >= simulation.cols) {
    return 0;
  }
  let depth = 0;
  for (let row = startRow; row < simulation.rows; row += 1) {
    if (simulation.grid[row][column]) {
      break;
    }
    depth += 1;
  }
  return depth;
}

/**
 * Average the support depth across a span to guide slumping decisions.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {number} startColumn - Leftmost column in the span.
 * @param {number} startRow - Row to begin scanning from.
 * @param {number} size - Number of columns to sample.
 * @returns {number} Mean open depth below the span.
 */
export function getAggregateDepth(simulation, startColumn, startRow, size) {
  const normalizedSize = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 1;
  if (startColumn < 0 || startColumn + normalizedSize > simulation.cols) {
    return 0;
  }
  let total = 0;
  for (let offset = 0; offset < normalizedSize; offset += 1) {
    total += getSupportDepth(simulation, startColumn + offset, startRow);
  }
  return total / Math.max(1, normalizedSize);
}

/**
 * Determine which direction a grain should slump based on nearby support depth.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {object} grain - Grain record with position and collider data.
 * @returns {number} -1 for left, 1 for right, 0 for none.
 */
export function getSlumpDirection(simulation, grain) {
  const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
  const bottom = grain.y + colliderSize;
  if (bottom >= simulation.rows) {
    return 0;
  }

  const span = Math.min(colliderSize, simulation.cols);
  const leftDepth = getAggregateDepth(simulation, grain.x - 1, bottom, span);
  const rightDepth = getAggregateDepth(simulation, grain.x + colliderSize, bottom, span);

  if (leftDepth > rightDepth + 0.6) {
    return -1;
  }
  if (rightDepth > leftDepth + 0.6) {
    return 1;
  }
  return 0;
}

/**
 * Build a wall metrics snapshot for UI overlays and consumers.
 * @param {object} simulation - Active PowderSimulation instance.
 * @returns {object} Measurements describing the basin walls and interior lane.
 */
export function getWallMetrics(simulation) {
  return {
    leftCells: simulation.wallInsetLeftCells,
    rightCells: simulation.wallInsetRightCells,
    gapCells: Math.max(0, simulation.cols - simulation.wallInsetLeftCells - simulation.wallInsetRightCells),
    leftPixels: Number.isFinite(simulation.wallInsetLeftPx)
      ? Math.max(0, simulation.wallInsetLeftPx)
      : Math.max(0, simulation.wallInsetLeftCells * simulation.cellSize),
    rightPixels: Number.isFinite(simulation.wallInsetRightPx)
      ? Math.max(0, simulation.wallInsetRightPx)
      : Math.max(0, simulation.wallInsetRightCells * simulation.cellSize),
    gapPixels: Math.max(
      0,
      simulation.width -
        (Number.isFinite(simulation.wallInsetLeftPx)
          ? simulation.wallInsetLeftPx
          : simulation.wallInsetLeftCells * simulation.cellSize) -
        (Number.isFinite(simulation.wallInsetRightPx)
          ? simulation.wallInsetRightPx
          : simulation.wallInsetRightCells * simulation.cellSize),
    ),
    cellSize: simulation.cellSize,
    rows: simulation.rows,
    cols: simulation.cols,
    width: simulation.width,
    height: simulation.height,
  };
}

/**
 * Clamp the target wall gap to the playable interior after scaling.
 * @param {object} simulation - Active PowderSimulation instance.
 * @returns {number|null} The scaled gap width in cells, or null when unset.
 */
export function resolveScaledWallGap(simulation) {
  if (!Number.isFinite(simulation.wallGapCellsTarget)) {
    return null;
  }
  const target = Math.max(1, Math.round(simulation.wallGapCellsTarget));
  if (!simulation.cols) {
    return target;
  }
  const available = Math.max(1, simulation.cols - simulation.wallInsetLeftCells - simulation.wallInsetRightCells);
  return Math.max(1, Math.min(target, available));
}

/**
 * Apply the scaled wall gap to the basin, rebalancing insets as needed.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {object} options - Optional flags such as skipRebuild.
 * @returns {boolean} Whether the wall insets changed.
 */
export function applyWallGapTarget(simulation, options = {}) {
  if (!simulation.cols) {
    return false;
  }

  const { skipRebuild = false } = options;
  const previousMetrics = skipRebuild
    ? null
    : {
        cols: simulation.cols,
        rows: simulation.rows,
        wallInsetLeftCells: simulation.wallInsetLeftCells,
        wallInsetRightCells: simulation.wallInsetRightCells,
        scrollOffsetCells: simulation.scrollOffsetCells,
      };
  const baseLargest = simulation.grainSizes.length
    ? Math.max(1, simulation.grainSizes[simulation.grainSizes.length - 1])
    : 1;
  const largestGrain = Math.max(1, simulation.computeColliderSize(baseLargest));
  let desiredGap = resolveScaledWallGap(simulation);
  if (!Number.isFinite(desiredGap)) {
    desiredGap = simulation.cols - simulation.wallInsetLeftCells - simulation.wallInsetRightCells;
  }
  if (Number.isFinite(simulation.wallGapCellsTarget)) {
    const baseTarget = Math.max(
      largestGrain,
      Math.min(simulation.cols, Math.round(simulation.wallGapCellsTarget)),
    );
    desiredGap = Math.max(desiredGap, baseTarget);
  }
  desiredGap = Math.max(largestGrain, Math.min(simulation.cols, Math.round(desiredGap)));
  const clampedGap = Math.max(largestGrain, Math.min(simulation.cols, desiredGap));
  const totalInset = Math.max(0, simulation.cols - clampedGap);
  let nextLeft = Math.floor(totalInset / 2);
  let nextRight = totalInset - nextLeft;

  if (nextLeft + nextRight >= simulation.cols) {
    nextLeft = Math.max(0, Math.floor((simulation.cols - largestGrain) / 2));
    nextRight = Math.max(0, simulation.cols - largestGrain - nextLeft);
  }

  const changed = nextLeft !== simulation.wallInsetLeftCells || nextRight !== simulation.wallInsetRightCells;
  simulation.wallInsetLeftCells = nextLeft;
  simulation.wallInsetRightCells = nextRight;
  simulation.wallInsetLeftPx = nextLeft * simulation.cellSize;
  simulation.wallInsetRightPx = nextRight * simulation.cellSize;
  simulation.updateMaxDropSize();

  if (changed) {
    if (skipRebuild) {
      return true;
    }
    rebuildGridAfterWallChange(simulation, previousMetrics);
  } else if (!skipRebuild) {
    simulation.notifyWallMetricsChange();
  }

  return changed;
}

/**
 * Public entry point for updating the preferred wall gap.
 * @param {object} simulation - Active PowderSimulation instance.
 * @param {number} gapCells - Desired gap width in cells.
 * @param {object} options - Optional flags passed to applyWallGapTarget.
 * @returns {boolean} Whether wall spacing was updated.
 */
export function setWallGapTarget(simulation, gapCells, options = {}) {
  if (!Number.isFinite(gapCells) || gapCells <= 0) {
    simulation.wallGapCellsTarget = null;
    simulation.updateMaxDropSize();
    return false;
  }
  simulation.wallGapCellsTarget = Math.max(1, Math.round(gapCells));
  if (!simulation.wallGapReferenceCols && simulation.cols) {
    simulation.wallGapReferenceCols = Math.max(1, simulation.cols);
  }
  if (!simulation.cols) {
    return false;
  }
  return applyWallGapTarget(simulation, options);
}
