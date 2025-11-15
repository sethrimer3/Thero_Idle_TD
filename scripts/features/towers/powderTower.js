/**
 * Powder tower simulation utilities and shared mote palette helpers.
 *
 * This module packages the powder basin rendering math so other systems can
 * reuse the same palette rules without depending on the main bundle.
 */

// Reuse the extracted palette and normalization helpers to shrink this bundle.
import {
  DEFAULT_MOTE_PALETTE,
  clampUnitInterval,
  cloneMoteColor,
  colorToRgbaString,
  computeMotePaletteFromTheme,
  mergeMotePalette,
  mixRgbColors,
  normalizeFiniteInteger,
  normalizeFiniteNumber,
  parseCssColor,
  resolvePaletteColorStops,
} from './powderPaletteUtils.js';

// Re-export the helpers so existing imports from powderTower remain valid.
export {
  DEFAULT_MOTE_PALETTE,
  clampUnitInterval,
  cloneMoteColor,
  colorToRgbaString,
  computeMotePaletteFromTheme,
  mergeMotePalette,
  mixRgbColors,
  normalizeFiniteInteger,
  normalizeFiniteNumber,
  parseCssColor,
  resolvePaletteColorStops,
} from './powderPaletteUtils.js';

// Guarantee each mote lane cell remains legible on compact viewports.
export const MIN_MOTE_LANE_CELL_PX = 4;

export const POWDER_CELL_SIZE_PX = 1;
// Render and collide motes at their base cell footprint so each grain appears one-third the previous size.
export const MOTE_RENDER_SCALE = 1;
export const MOTE_COLLISION_SCALE = 1;

export class PowderSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    const baseCellSize = Number.isFinite(options.cellSize) && options.cellSize > 0
      ? options.cellSize
      : POWDER_CELL_SIZE_PX;
    const deviceScale = window.devicePixelRatio || 1;
    this.cellSize = Math.max(1, Math.round(baseCellSize * deviceScale));
    this.deviceScale = deviceScale;
    this.collisionScale =
      Number.isFinite(options.collisionScale) && options.collisionScale > 0
        ? options.collisionScale
        : MOTE_COLLISION_SCALE;
    // Scale the base unit by device pixel ratio so motes stay visually consistent across screens.
    this.grainSizes = Array.isArray(options.grainSizes)
      ? options.grainSizes.filter((size) => Number.isFinite(size) && size >= 1)
      : [1]; // Default to uniform grains so ambient motes always share the same footprint.
    if (!this.grainSizes.length) {
      this.grainSizes = [1]; // Fall back to a single grain size if inputs collapse during filtering.
    }
    this.grainSizes.sort((a, b) => a - b);

    this.maxDuneGain = Number.isFinite(options.maxDuneGain)
      ? Math.max(0, options.maxDuneGain)
      : 3;
    this.maxGrainsBase = options.maxGrains && options.maxGrains > 0 ? options.maxGrains : 1600;
    this.maxGrains = this.maxGrainsBase;
    this.baseSpawnInterval = options.baseSpawnInterval && options.baseSpawnInterval > 0
      ? options.baseSpawnInterval
      : 180;

    this.onHeightChange = typeof options.onHeightChange === 'function' ? options.onHeightChange : null;
    this.onIdleBankChange = typeof options.onIdleBankChange === 'function' ? options.onIdleBankChange : null;

    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.rows = 0;
    this.grid = [];
    this.grains = [];
    this.heightInfo = { normalizedHeight: 0, duneGain: 0, largestGrain: 0 };
    this.pendingDrops = [];
    this.idleBank = 0;
    this.idleAccumulator = 0;
    this.idleDropBuffer = 0; // Track how many idle conversions still need to spawn into the basin.
    this.idleDropAccumulator = 0; // Retain fractional idle releases so drops respect the configured rate.
    const fallbackIdleDrainRate = Number.isFinite(options.fallbackIdleDrainRate)
      ? Math.max(1, options.fallbackIdleDrainRate)
      : 1;
    this.idleDrainRate = Number.isFinite(options.idleDrainRate)
      ? Math.max(1, options.idleDrainRate)
      : fallbackIdleDrainRate;
    this.maxDropSize = 1;

    // Track the camera transform so the basin view can pan and zoom smoothly.
    this.viewScale = Number.isFinite(options.viewScale) && options.viewScale > 0 ? options.viewScale : 1;
    this.minViewScale = Number.isFinite(options.minViewScale) && options.minViewScale > 0 ? options.minViewScale : 0.75;
    this.maxViewScale = Number.isFinite(options.maxViewScale) && options.maxViewScale > 0 ? options.maxViewScale : 2.5;
    // Limit how far the camera may scroll above the tower so zoomed-out views only reveal 50% extra height.
    this.maxViewTopOverscanNormalized = Number.isFinite(options.maxViewTopOverscanNormalized)
      ? Math.max(0, options.maxViewTopOverscanNormalized)
      : 0.5;
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };

    this.scrollThreshold = Number.isFinite(options.scrollThreshold)
      ? Math.max(0.2, Math.min(0.95, options.scrollThreshold))
      : 0.75;
    this.scrollOffsetCells = 0;
    this.highestTotalHeightCells = 0;

    this.wallInsetLeftPx = Number.isFinite(options.wallInsetLeft) ? Math.max(0, options.wallInsetLeft) : 0;
    this.wallInsetRightPx = Number.isFinite(options.wallInsetRight) ? Math.max(0, options.wallInsetRight) : 0;
    this.wallInsetLeftCells = 0;
    this.wallInsetRightCells = 0;
    const attrWidth = this.canvas ? Number.parseFloat(this.canvas.getAttribute('width')) || 0 : 0;
    const referenceWidth = Number.isFinite(options.wallReferenceWidth)
      ? Math.max(options.wallReferenceWidth, this.cellSize)
      : attrWidth || 240;
    this.wallGapReferenceWidth = referenceWidth; // Store the baseline basin width in CSS pixels for later scaling.
    this.wallGapReferenceCols = Math.max(1, Math.round(referenceWidth / this.cellSize));
    this.wallGapTargetUnits = Number.isFinite(options.wallGapCells)
      ? Math.max(1, Math.round(options.wallGapCells))
      : null;
    const normalizedBaseGap = Number.isFinite(options.wallGapCells)
      ? Math.max(1, Math.round(options.wallGapCells))
      : 15;
    this.baseGapUnits = normalizedBaseGap;
    this.gapWidthRatio = Number.isFinite(options.gapWidthRatio) && options.gapWidthRatio > 0
      ? Math.max(0.05, Math.min(0.95, options.gapWidthRatio))
      : null;

    this.spawnTimer = 0;
    this.lastFrame = 0;
    this.loopHandle = null;
    this.running = false;
    this.nextId = 1;
    this.stabilized = true;
    this.flowOffset = 0;
    const fallbackPalette = options.fallbackMotePalette || DEFAULT_MOTE_PALETTE;
    this.motePalette = mergeMotePalette(options.motePalette || fallbackPalette);
    this.onWallMetricsChange =
      typeof options.onWallMetricsChange === 'function' ? options.onWallMetricsChange : null;
    // Surface camera changes so UI overlays can mirror the simulation transform.
    this.onViewTransformChange =
      typeof options.onViewTransformChange === 'function' ? options.onViewTransformChange : null;

    this.defaultProfile = {
      grainSizes: [...this.grainSizes],
      idleDrainRate: this.idleDrainRate,
      baseSpawnInterval: this.baseSpawnInterval,
      palette: {
        ...this.motePalette,
        stops: Array.isArray(this.motePalette.stops)
          ? this.motePalette.stops.map((stop) => ({ ...stop }))
          : [],
      },
    };

    this.handleFrame = this.handleFrame.bind(this);
    this.handleResize = this.handleResize.bind(this);

    if (this.ctx) {
      this.configureCanvas();
    }
  }

  handleResize() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const previousRunning = this.running;
    this.configureCanvas();
    if (!previousRunning) {
      this.render();
      this.updateHeightFromGrains(true);
    }
  }

  configureCanvas() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const hadGrains = Array.isArray(this.grains) && this.grains.length > 0;
    const previousMetrics = hadGrains
      ? {
          cols: this.cols,
          rows: this.rows,
          wallInsetLeftCells: this.wallInsetLeftCells,
          wallInsetRightCells: this.wallInsetRightCells,
          scrollOffsetCells: this.scrollOffsetCells,
        }
      : null; // Cache the previous grid metrics so we can rescale grains after the resize.
    const ratio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1;
    const rect =
      typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : null;
    const parent = this.canvas.parentElement;
    const parentRect =
      parent && typeof parent.getBoundingClientRect === 'function'
        ? parent.getBoundingClientRect()
        : null;
    // Prefer measuring the basin container so the canvas remains centered within the decorative walls.
    const measuredWidth =
      parentRect && Number.isFinite(parentRect.width) && parentRect.width > 0
        ? parentRect.width
        : rect && Number.isFinite(rect.width) && rect.width > 0
          ? rect.width
          : this.canvas.clientWidth;
    // Mirror the parent height as well so the Spire column reaches the basin floor after flex resizing.
    const measuredHeight =
      parentRect && Number.isFinite(parentRect.height) && parentRect.height > 0
        ? parentRect.height
        : rect && Number.isFinite(rect.height) && rect.height > 0
          ? rect.height
          : this.canvas.clientHeight;
    const previousWidth = Number.isFinite(this.width) && this.width > 0 ? this.width : 0;
    const previousHeight = Number.isFinite(this.height) && this.height > 0 ? this.height : 0;
    const hasMeasuredWidth = Number.isFinite(measuredWidth) && measuredWidth > 0;
    const hasMeasuredHeight = Number.isFinite(measuredHeight) && measuredHeight > 0;
    const attrWidth = Number.parseFloat(this.canvas.getAttribute('width')) || 0;
    const attrHeight = Number.parseFloat(this.canvas.getAttribute('height')) || 0;
    const normalizedAttrWidth = attrWidth > 0 ? attrWidth / ratio : 0;
    const normalizedAttrHeight = attrHeight > 0 ? attrHeight / ratio : 0;

    // When layout metrics are unavailable (e.g., hidden tab), reuse cached or attribute sizes so motes keep animating.
    let displayWidth = hasMeasuredWidth
      ? measuredWidth
      : previousWidth || normalizedAttrWidth || 240;
    let displayHeight = hasMeasuredHeight
      ? measuredHeight
      : previousHeight || normalizedAttrHeight || 320;

    if (!hasMeasuredWidth && !hasMeasuredHeight && previousWidth > 0 && previousHeight > 0) {
      // Keep the previous canvas dimensions when both measurements disappear to avoid collapsing the basin during transitions.
      displayWidth = previousWidth;
      displayHeight = previousHeight;
    }

    if (displayWidth <= 0) {
      // Fall back to the intrinsic canvas width so we still create a viable grid.
      displayWidth = normalizedAttrWidth || 240;
    }
    if (displayHeight <= 0) {
      // Apply the intrinsic canvas height whenever the layout reports zero rows.
      displayHeight = normalizedAttrHeight || 320;
    }

    displayWidth = Math.max(200, displayWidth);
    
    // Maintain 3:4 aspect ratio for the simulation canvas (240:320)
    displayHeight = Math.floor(displayWidth * (4 / 3));

    // NEW: Set cell size to be exactly 1/100th of render width
    // This makes 1 cell = 1 mote width = 1/100th of width
    this.cellSize = Math.max(1, displayWidth / 100);

    if (!Number.isFinite(this.baseGapUnits) || this.baseGapUnits <= 0) {
      const fallbackGapUnits = Number.isFinite(this.wallGapTargetUnits)
        ? Math.max(1, Math.round(this.wallGapTargetUnits))
        : Number.isFinite(this.wallGapCellsTarget)
          ? Math.max(1, Math.round(this.wallGapCellsTarget))
          : 5;
      this.baseGapUnits = fallbackGapUnits;
    }

    // Calculate wall gap reference width based on baseGapUnits
    this.wallGapReferenceWidth = Math.max(1, this.cellSize * this.baseGapUnits);
    this.wallGapReferenceCols = Math.max(1, Math.round(this.wallGapReferenceWidth / this.cellSize));

    const styleWidth = `${displayWidth}px`;
    const styleHeight = `${displayHeight}px`;
    if (this.canvas.style.width !== styleWidth) {
      this.canvas.style.width = styleWidth;
    }
    if (this.canvas.style.height !== styleHeight) {
      this.canvas.style.height = styleHeight;
    }

    const targetWidth = Math.max(1, Math.floor(displayWidth * ratio));
    const targetHeight = Math.max(1, Math.floor(displayHeight * ratio));
    if (this.canvas.width !== targetWidth) {
      this.canvas.width = targetWidth;
    }
    if (this.canvas.height !== targetHeight) {
      this.canvas.height = targetHeight;
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
    this.deviceScale = ratio;

    this.width = displayWidth;
    this.height = displayHeight;
    this.cols = Math.max(4, Math.floor(this.width / this.cellSize));
    this.rows = Math.max(4, Math.floor(this.height / this.cellSize));

    const referenceWidthPx = Number.isFinite(this.wallGapReferenceWidth)
      ? this.wallGapReferenceWidth
      : this.width;
    this.wallGapReferenceCols = Math.max(
      1,
      Math.round(referenceWidthPx / this.cellSize),
    ); // Recalculate how many grid columns the reference layout represents after a resize.

    const dynamicCapacity = Math.floor((this.cols * this.rows) / 3);
    this.maxGrains = Math.max(this.maxGrainsBase, dynamicCapacity);

    this.wallInsetLeftCells = Math.max(0, Math.ceil(this.wallInsetLeftPx / this.cellSize));
    this.wallInsetRightCells = Math.max(0, Math.ceil(this.wallInsetRightPx / this.cellSize));
    const maxInset = Math.max(0, this.cols - 6);
    const insetTotal = this.wallInsetLeftCells + this.wallInsetRightCells;
    if (insetTotal > maxInset && insetTotal > 0) {
      const scale = maxInset / insetTotal;
      this.wallInsetLeftCells = Math.floor(this.wallInsetLeftCells * scale);
      this.wallInsetRightCells = Math.floor(this.wallInsetRightCells * scale);
    }

    if (Number.isFinite(this.wallGapTargetUnits)) {
      this.applyWallGapTarget({ skipRebuild: true });
    } else {
      this.updateMaxDropSize();
    }

    if (hadGrains) {
      this.rebuildGridAfterWallChange(previousMetrics);
    } else {
      this.reset();
      this.notifyWallMetricsChange();
    }
    this.applyViewConstraints();
    this.notifyViewTransformChange();
  }

  updateMaxDropSize() {
    // Since cellSize is now exactly 1/100th of render width,
    // 1 cell = 1 mote width, so maxDropSize = 1
    this.maxDropSize = 1;
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.applyWallMask();
    this.grains = [];
    this.pendingDrops = [];
    this.spawnTimer = 0;
    this.lastFrame = 0;
    this.idleDropBuffer = 0; // Remove any leftover idle conversions when the basin resets.
    this.idleDropAccumulator = 0; // Reset the idle cadence so fresh runs start cleanly.
    this.scrollOffsetCells = 0;
    this.highestTotalHeightCells = 0;
    this.heightInfo = { normalizedHeight: 0, duneGain: 0, largestGrain: 0 };
    this.notifyHeightChange(this.heightInfo, true);
  }

  applyWallMask() {
    if (!this.grid.length) {
      return;
    }
    const leftBound = Math.min(this.cols, this.wallInsetLeftCells);
    const rightStart = Math.max(leftBound, this.cols - this.wallInsetRightCells);
    for (let row = 0; row < this.grid.length; row += 1) {
      const gridRow = this.grid[row];
      for (let col = 0; col < leftBound; col += 1) {
        gridRow[col] = -1;
      }
      for (let col = rightStart; col < this.cols; col += 1) {
        gridRow[col] = -1;
      }
    }
  }

  clearGridPreserveWalls() {
    if (!this.grid.length) {
      return;
    }
    for (let row = 0; row < this.grid.length; row += 1) {
      const gridRow = this.grid[row];
      for (let col = 0; col < this.cols; col += 1) {
        if (gridRow[col] !== -1) {
          gridRow[col] = 0;
        }
      }
    }
  }

  rebuildGridAfterWallChange(previousMetrics = null) {
    if (!this.rows || !this.cols) {
      return;
    }

    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.applyWallMask();

    // Normalize the previous grid footprint so we can map grains into the resized interior.
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

    const previousInteriorStart = previousLeftInset !== null ? previousLeftInset : this.wallInsetLeftCells;
    const previousInteriorEnd = previousCols !== null
      ? Math.max(
          previousInteriorStart,
          previousCols - (previousRightInset !== null ? previousRightInset : this.wallInsetRightCells),
        )
      : Math.max(previousInteriorStart, this.cols - this.wallInsetRightCells);
    const previousInteriorWidth = Math.max(1, previousInteriorEnd - previousInteriorStart);
    const interiorStart = this.wallInsetLeftCells;
    const interiorEnd = Math.max(interiorStart, this.cols - this.wallInsetRightCells);
    const interiorWidth = Math.max(1, interiorEnd - interiorStart);

    // Derive scale factors that preserve horizontal and vertical positions across the resize.
    const columnScale = previousCols ? interiorWidth / previousInteriorWidth : 1;
    const rowScale = previousRows ? this.rows / previousRows : 1;

    if (previousScrollOffset !== null && rowScale !== 1) {
      // Preserve the crest offset so the visible powder height does not jump after the resize.
      this.scrollOffsetCells = Math.round(previousScrollOffset * rowScale);
    }

    const minX = this.wallInsetLeftCells;
    const maxInterior = Math.max(minX, this.cols - this.wallInsetRightCells);

    for (const grain of this.grains) {
      if (!Number.isFinite(grain.colliderSize) || grain.colliderSize <= 0) {
        grain.colliderSize = this.computeColliderSize(grain.size);
      }
      const collider = Math.max(1, Math.round(grain.colliderSize));

      if (previousCols && (columnScale !== 1 || previousInteriorStart !== interiorStart)) {
        const previousAvailable = Math.max(0, previousInteriorWidth - collider);
        const newAvailable = Math.max(0, interiorWidth - collider);
        const normalized = Math.max(0, Math.min(previousAvailable, grain.x - previousInteriorStart));
        const scaled = newAvailable > 0
          ? (normalized / (previousAvailable || 1)) * newAvailable
          : 0; // Scale the horizontal offset so grains stay centered between the new walls.
        grain.x = Math.round(interiorStart + scaled);
      }

      if (previousRows && rowScale !== 1) {
        const previousAvailable = Math.max(0, previousRows - collider);
        const newAvailable = Math.max(0, this.rows - collider);
        const normalizedY = Math.max(0, Math.min(previousAvailable, grain.y));
        const scaledY = newAvailable > 0
          ? (normalizedY / (previousAvailable || 1)) * newAvailable
          : 0; // Scale the vertical offset so resting grains keep their relative height.
        grain.y = Math.round(scaledY);
      }

      const maxOrigin = Math.max(minX, this.cols - this.wallInsetRightCells - collider);
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

    this.populateGridFromGrains();
    this.updateHeightFromGrains(true);
    this.render();
    this.notifyWallMetricsChange();
  }

  populateGridFromGrains() {
    if (!this.grid.length) {
      return;
    }
    for (const grain of this.grains) {
      if (grain.freefall) {
        grain.inGrid = false;
        continue;
      }
      if (!Number.isFinite(grain.colliderSize) || grain.colliderSize <= 0) {
        grain.colliderSize = this.computeColliderSize(grain.size);
      }
      const colliderSize = Math.max(1, Math.round(grain.colliderSize));
      if (grain.y >= this.rows || grain.y + colliderSize <= 0) {
        grain.inGrid = false;
        continue;
      }
      this.fillCells(grain);
      grain.inGrid = true;
    }
  }

  canPlace(x, y, size) {
    const normalizedSize = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 1;
    if (x < 0 || y < 0 || x + normalizedSize > this.cols || y + normalizedSize > this.rows) {
      return false;
    }
    for (let row = 0; row < normalizedSize; row += 1) {
      const gridRow = this.grid[y + row];
      for (let col = 0; col < normalizedSize; col += 1) {
        if (gridRow[x + col]) {
          return false;
        }
      }
    }
    return true;
  }

  fillCells(grain) {
    const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
    for (let row = 0; row < colliderSize; row += 1) {
      const y = grain.y + row;
      if (y < 0 || y >= this.rows) {
        continue;
      }
      const gridRow = this.grid[y];
      for (let col = 0; col < colliderSize; col += 1) {
        const x = grain.x + col;
        if (x < 0 || x >= this.cols) {
          continue;
        }
        gridRow[x] = grain.id;
      }
    }
  }

  clearCells(grain) {
    if (!grain.inGrid) {
      return;
    }
    const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
    for (let row = 0; row < colliderSize; row += 1) {
      const y = grain.y + row;
      if (y < 0 || y >= this.rows) {
        continue;
      }
      const gridRow = this.grid[y];
      for (let col = 0; col < colliderSize; col += 1) {
        const x = grain.x + col;
        if (x < 0 || x >= this.cols) {
          continue;
        }
        if (gridRow[x] === grain.id) {
          gridRow[x] = 0;
        }
      }
    }
    grain.inGrid = false;
  }

  getSupportDepth(column, startRow) {
    if (column < 0 || column >= this.cols) {
      return 0;
    }
    let depth = 0;
    for (let row = startRow; row < this.rows; row += 1) {
      if (this.grid[row][column]) {
        break;
      }
      depth += 1;
    }
    return depth;
  }

  getAggregateDepth(startColumn, startRow, size) {
    const normalizedSize = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 1;
    if (startColumn < 0 || startColumn + normalizedSize > this.cols) {
      return 0;
    }
    let total = 0;
    for (let offset = 0; offset < normalizedSize; offset += 1) {
      total += this.getSupportDepth(startColumn + offset, startRow);
    }
    return total / Math.max(1, normalizedSize);
  }

  getSlumpDirection(grain) {
    const colliderSize = Number.isFinite(grain.colliderSize) ? Math.max(1, Math.round(grain.colliderSize)) : 1;
    const bottom = grain.y + colliderSize;
    if (bottom >= this.rows) {
      return 0;
    }

    const span = Math.min(colliderSize, this.cols);
    const leftDepth = this.getAggregateDepth(grain.x - 1, bottom, span);
    const rightDepth = this.getAggregateDepth(grain.x + colliderSize, bottom, span);

    if (leftDepth > rightDepth + 0.6) {
      return -1;
    }
    if (rightDepth > leftDepth + 0.6) {
      return 1;
    }
    return 0;
  }

  notifyWallMetricsChange(metrics) {
    if (typeof this.onWallMetricsChange !== 'function') {
      return;
    }
    this.onWallMetricsChange(metrics || this.getWallMetrics());
  }

  notifyIdleBankChange() {
    if (typeof this.onIdleBankChange !== 'function') {
      return;
    }
    const bank = Number.isFinite(this.idleBank) ? Math.max(0, this.idleBank) : 0;
    this.onIdleBankChange(bank);
  }

  getWallMetrics() {
    return {
      leftCells: this.wallInsetLeftCells,
      rightCells: this.wallInsetRightCells,
      gapCells: Math.max(0, this.cols - this.wallInsetLeftCells - this.wallInsetRightCells),
      cellSize: this.cellSize,
      rows: this.rows,
      cols: this.cols,
      width: this.width,
      height: this.height,
    };
  }

  setWallGapTarget(gapCells, options = {}) {
    if (!Number.isFinite(gapCells) || gapCells <= 0) {
      this.wallGapCellsTarget = null;
      this.updateMaxDropSize();
      return false;
    }
    this.wallGapCellsTarget = Math.max(1, Math.round(gapCells));
    if (!this.wallGapReferenceCols && this.cols) {
      this.wallGapReferenceCols = Math.max(1, this.cols);
    }
    if (!this.cols) {
      return false;
    }
    return this.applyWallGapTarget(options);
  }

  resolveScaledWallGap() {
    if (!Number.isFinite(this.wallGapCellsTarget)) {
      return null;
    }
    const target = Math.max(1, Math.round(this.wallGapCellsTarget));
    if (!this.cols) {
      return target;
    }
    const available = Math.max(1, this.cols - this.wallInsetLeftCells - this.wallInsetRightCells);
    return Math.max(1, Math.min(target, available));
  }

  applyWallGapTarget(options = {}) {
    if (!this.cols) {
      return false;
    }

    const { skipRebuild = false } = options;
    const previousMetrics = skipRebuild
      ? null
      : {
          cols: this.cols,
          rows: this.rows,
          wallInsetLeftCells: this.wallInsetLeftCells,
          wallInsetRightCells: this.wallInsetRightCells,
          scrollOffsetCells: this.scrollOffsetCells,
        }; // Cache the current layout so restored saves can realign grains after wall spacing updates.
    const baseLargest = this.grainSizes.length
      ? Math.max(1, this.grainSizes[this.grainSizes.length - 1])
      : 1;
    const largestGrain = Math.max(1, this.computeColliderSize(baseLargest));
    let desiredGap = this.resolveScaledWallGap();
    if (!Number.isFinite(desiredGap)) {
      desiredGap = this.cols - this.wallInsetLeftCells - this.wallInsetRightCells;
    }
    if (Number.isFinite(this.wallGapCellsTarget)) {
      const baseTarget = Math.max(
        largestGrain,
        Math.min(this.cols, Math.round(this.wallGapCellsTarget)),
      );
      desiredGap = Math.max(desiredGap, baseTarget);
    }
    desiredGap = Math.max(largestGrain, Math.min(this.cols, Math.round(desiredGap)));
    const clampedGap = Math.max(largestGrain, Math.min(this.cols, desiredGap));
    const totalInset = Math.max(0, this.cols - clampedGap);
    let nextLeft = Math.floor(totalInset / 2);
    let nextRight = totalInset - nextLeft;

    if (nextLeft + nextRight >= this.cols) {
      nextLeft = Math.max(0, Math.floor((this.cols - largestGrain) / 2));
      nextRight = Math.max(0, this.cols - largestGrain - nextLeft);
    }

    const changed = nextLeft !== this.wallInsetLeftCells || nextRight !== this.wallInsetRightCells;
    this.wallInsetLeftCells = nextLeft;
    this.wallInsetRightCells = nextRight;
    this.wallInsetLeftPx = nextLeft * this.cellSize;
    this.wallInsetRightPx = nextRight * this.cellSize;
    this.updateMaxDropSize();

    if (changed) {
      if (skipRebuild) {
        return true;
      }
      this.rebuildGridAfterWallChange(previousMetrics);
    } else if (!skipRebuild) {
      this.notifyWallMetricsChange();
    }

    return changed;
  }

  handleFrame(timestamp) {
    if (!this.running) {
      return;
    }
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }
    const delta = Math.min(100, Math.max(0, timestamp - this.lastFrame));
    this.lastFrame = timestamp;
    this.update(delta);
    this.loopHandle = requestAnimationFrame(this.handleFrame);
  }

  update(delta) {
    if (!this.ctx) {
      return;
    }

    this.convertIdleBank(delta);
    this.advanceSpawnTimer(delta); // Continuously queue natural mote drops so the basin never starves between enemy events.

    const spawnBudget = Math.max(1, Math.ceil(delta / 12));
    const idleReleased = this.releaseIdleDrops(delta, spawnBudget); // Emit idle conversions using the earned rate budget.
    const remainingBudget = Math.max(0, spawnBudget - idleReleased); // Preserve headroom for combat or ambient drops.
    this.spawnPendingDrops(remainingBudget);

    const iterations = Math.max(1, Math.min(4, Math.round(delta / 16)));
    for (let i = 0; i < iterations; i += 1) {
      this.updateGrains();
    }

    this.updateHeightFromGrains();
    this.render();
  }

  convertIdleBank(delta) {
    if (!Number.isFinite(delta) || delta <= 0 || this.idleBank <= 0) {
      if (this.idleBank <= 0 && this.idleDropBuffer <= 0) {
        this.idleAccumulator = 0; // Clear fractional progress so the counter stops when the bank is empty.
      }
      return 0;
    }

    const rate = Math.max(0, this.idleDrainRate) / 1000;
    if (rate <= 0) {
      return 0;
    }

    const pending = this.idleAccumulator + delta * rate;
    const availableBank = Math.floor(Math.max(0, this.idleBank)); // Only convert whole motes so fractional rewards remain banked.
    const toQueue = Math.max(0, Math.min(availableBank, Math.floor(pending)));
    this.idleAccumulator = pending - toQueue;

    if (toQueue <= 0) {
      return 0;
    }

    this.idleBank = Math.max(0, this.idleBank - toQueue);
    if (this.idleBank < 1e-6) {
      this.idleBank = 0;
    }
    this.notifyIdleBankChange();
    this.idleDropBuffer = Math.max(0, this.idleDropBuffer + toQueue); // Store the converted motes until the release cadence emits them.
    return toQueue;
  }

  releaseIdleDrops(delta, limit = Infinity) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0;
    }

    const availableBuffer = Math.floor(Math.max(0, this.idleDropBuffer)); // Respect integer release counts to avoid over-spawning.
    if (availableBuffer <= 0) {
      if (this.idleDropBuffer <= 0 && this.idleBank <= 0) {
        this.idleDropAccumulator = 0; // Reset the release timer once all idle motes have been dispatched.
        this.idleDropBuffer = 0;
      }
      return 0;
    }

    const rate = Math.max(0, this.idleDrainRate) / 1000;
    if (rate <= 0) {
      return 0;
    }

    this.idleDropAccumulator += delta * rate;

    const allowedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : availableBuffer; // Clamp to finite release budgets while honouring the buffer.
    const allowed = Math.max(0, Math.min(availableBuffer, allowedLimit));
    let released = 0;

    while (released < allowed && this.idleDropAccumulator >= 1 && this.grains.length < this.maxGrains) {
      this.spawnGrain({ size: 1, source: 'idle' }); // Spawn idle motes through the normal grain generator for consistency.
      this.idleDropAccumulator -= 1;
      released += 1;
    }

    if (released > 0) {
      this.idleDropBuffer = Math.max(0, this.idleDropBuffer - released);
      if (this.idleDropBuffer < 1e-6) {
        this.idleDropBuffer = 0;
      }
    }

    if (this.idleDropBuffer <= 0 && this.idleBank <= 0) {
      this.idleDropAccumulator = 0; // Prevent runaway accumulation when the bank is exhausted.
      this.idleDropBuffer = 0;
    }

    return released;
  }

  advanceSpawnTimer(delta) {
    // Advance the ambient spawn clock so motes trickle into the basin even without combat drops.
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0;
    }
    this.spawnTimer += delta;

    const interval = Math.max(16, this.getSpawnInterval());
    if (interval <= 0) {
      this.spawnTimer = 0;
      return 0;
    }

    const capacity = Math.max(0, this.maxGrains - this.grains.length - this.pendingDrops.length);
    if (capacity <= 0) {
      this.spawnTimer = Math.min(this.spawnTimer, interval);
      return 0;
    }

    const idleBankPositive = Number.isFinite(this.idleBank) && this.idleBank > 1e-6;
    const ambientEnabled =
      this.flowOffset > 0 && idleBankPositive && (!Number.isFinite(this.idleDrainRate) || this.idleDrainRate <= 0);
    // Restrict ambient motes to scenarios where the idle drain is disabled so the fall rate mirrors the mote bank.

    if (!ambientEnabled) {
      this.spawnTimer = Math.min(this.spawnTimer, interval);
      return 0;
    }

    let spawned = 0;
    while (this.spawnTimer >= interval && spawned < capacity) {
      this.spawnTimer -= interval;
      this.pendingDrops.push({ size: this.chooseGrainSize(), source: 'ambient' }); // Seed natural motes using the weighted grain distribution.
      spawned += 1;
    }

    if (spawned >= capacity) {
      this.spawnTimer = Math.min(this.spawnTimer, interval);
    }

    return spawned;
  }

  spawnPendingDrops(limit = 1) {
    if (!this.pendingDrops.length || !this.cols || !this.rows) {
      return;
    }
    let remaining = Math.max(0, Math.floor(limit));
    if (remaining <= 0) {
      return;
    }
    const allowAmbient = this.flowOffset > 0 && Number.isFinite(this.idleBank) && this.idleBank > 1e-6;
    while (remaining > 0 && this.pendingDrops.length && this.grains.length < this.maxGrains) {
      const drop = this.pendingDrops[0];
      if (drop && drop.source === 'ambient' && !allowAmbient) {
        this.pendingDrops.shift(); // Discard stale ambient drops so idle pacing stays accurate.
        continue;
      }
      this.pendingDrops.shift();
      this.spawnGrain(drop);
      remaining -= 1;
    }
  }

  queueDrop(dropLike) {
    let drop = null;
    if (dropLike && typeof dropLike === 'object' && !Array.isArray(dropLike)) {
      drop = { ...dropLike };
    } else {
      drop = { size: dropLike };
    }
    if (!Number.isFinite(drop.size) || drop.size <= 0) {
      return;
    }
    const normalized = this.clampGrainSize(drop.size);
    const pendingDrop = { size: normalized };
    if (typeof drop.source === 'string') {
      pendingDrop.source = drop.source; // Preserve source metadata so ambient queues can be filtered downstream.
    }
    const color = this.normalizeDropColor(drop.color);
    if (color) {
      pendingDrop.color = color;
    }
    this.pendingDrops.push(pendingDrop);
  }

  addIdleMotes(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.idleBank = Math.max(0, this.idleBank + amount);
    this.notifyIdleBankChange();
  }

  clampGrainSize(size) {
    const normalized = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 1;
    return Math.max(1, Math.min(normalized, this.maxDropSize || normalized));
  }

  computeColliderSize(baseSize) {
    const normalized = Number.isFinite(baseSize) ? Math.max(1, Math.round(baseSize)) : 1;
    const scale = Number.isFinite(this.collisionScale) && this.collisionScale > 0 ? this.collisionScale : 1;
    const scaled = normalized * scale;
    return Math.max(1, Math.round(scaled));
  }

  getSpawnInterval() {
    if (!this.stabilized) {
      return this.baseSpawnInterval * 1.25;
    }
    return this.baseSpawnInterval / Math.max(0.6, 1 + this.flowOffset * 0.45);
  }

  getViewportTopRowCells() {
    // Translate the active camera transform into the grid row that aligns with the top of the viewport.
    if (!this.rows) {
      return 0;
    }
    const scale = Math.max(this.viewScale || 1, 0.0001);
    const center = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    const centerCells = center.y * this.rows;
    const halfViewportCells = (this.rows / scale) / 2;
    let topRow = Math.floor(centerCells - halfViewportCells);
    if (Number.isFinite(this.maxViewTopOverscanNormalized)) {
      const maxOverscanCells = Math.round(Math.max(0, this.maxViewTopOverscanNormalized) * this.rows);
      topRow = Math.max(topRow, -maxOverscanCells);
    }
    return topRow;
  }

  getTopOverscanCells(minimum = 1) {
    // Calculate how many grid cells sit above the visible viewport so motes spawn at the true zoom ceiling.
    const fallbackMinimum = Number.isFinite(minimum) ? Math.max(1, Math.round(minimum)) : 1;
    if (!this.rows) {
      return fallbackMinimum;
    }
    const topRow = this.getViewportTopRowCells();
    if (topRow >= 0) {
      return fallbackMinimum;
    }
    return Math.max(fallbackMinimum, -topRow);
  }

  spawnGrain(dropLike) {
    if (!this.cols || !this.rows) {
      return;
    }
    let drop = null;
    if (dropLike && typeof dropLike === 'object' && !Array.isArray(dropLike)) {
      drop = { ...dropLike };
    } else {
      drop = { size: dropLike };
    }
    const visualSize = this.clampGrainSize(
      typeof drop.size === 'number' ? drop.size : this.chooseGrainSize(),
    );
    const colliderSize = this.computeColliderSize(visualSize);
    const minX = this.wallInsetLeftCells;
    const maxX = Math.max(minX, this.cols - this.wallInsetRightCells - colliderSize);
    const center = Math.floor((minX + maxX) / 2);
    const scatter = Math.max(1, Math.floor((maxX - minX) / 6));
    const triangle = Math.random() - Math.random(); // Favor center-heavy mote spawns with a simple triangular distribution.
    const offset = Math.round(triangle * scatter);
    const startX = Math.min(
      maxX,
      Math.max(minX, center - Math.floor(colliderSize / 2) + offset),
    );

    // Mirror the camera overscan so drop origins line up with the hidden ledge above the play area.
    const spawnCeilingCells = this.getTopOverscanCells(colliderSize);
    const viewportTopCells = this.getViewportTopRowCells();
    const colliderClearance = Math.max(1, Math.round(colliderSize));
    let spawnY;
    // Anchor zoomed-out spawn height to the visible viewport so motes enter from the screen edge after panning.
    if (viewportTopCells >= 0) {
      const alignedSpawn = viewportTopCells - colliderClearance;
      const fallbackSpawn = -colliderClearance;
      spawnY = Math.max(fallbackSpawn, alignedSpawn);
    } else {
      spawnY = -spawnCeilingCells;
    }
    // Raise the spawn point so motes originate at the overscan ceiling and cascade through the entire visible tower.
    const grain = {
      id: this.nextId,
      x: startX,
      y: spawnY,
      size: visualSize,
      colliderSize,
      bias: Math.random() < 0.5 ? -1 : 1,
      shade: 195 - visualSize * 5 + Math.floor(Math.random() * 12),
      freefall: !this.stabilized,
      inGrid: false,
      resting: false,
      color: this.normalizeDropColor(drop.color),
    };
    this.nextId += 1;
    this.resolveSpawnOverlap(grain); // Push the fresh mote away from conflicts so it cannot freeze in place.
    this.grains.push(grain);
  }

  resolveSpawnOverlap(grain) {
    // Separate a newly spawned mote from nearby grains so none occupy the exact same launch cell.
    if (!grain || !this.grains.length) {
      return;
    }
    const colliderSize = Number.isFinite(grain.colliderSize)
      ? Math.max(1, Math.round(grain.colliderSize))
      : this.computeColliderSize(grain.size);
    const minX = this.wallInsetLeftCells;
    const maxX = Math.max(minX, this.cols - this.wallInsetRightCells - colliderSize);
    const limit = Math.max(1, this.cols);
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const overlap = this.findSpawnOverlap(grain, colliderSize); // Detect conflicting grains sharing the spawn column.
      if (!overlap) {
        break;
      }
      const otherCollider = Number.isFinite(overlap.colliderSize)
        ? Math.max(1, Math.round(overlap.colliderSize))
        : this.computeColliderSize(overlap.size);
      const grainCenter = grain.x + colliderSize / 2;
      const otherCenter = overlap.x + otherCollider / 2;
      const direction = grainCenter >= otherCenter ? 1 : -1;
      grain.x = Math.min(maxX, Math.max(minX, grain.x + direction)); // Push the mote horizontally while respecting wall bounds.
      grain.freefall = true; // Force a freefall tick so the mote drifts apart before settling into the grid.
    }
  }

  findSpawnOverlap(grain, colliderSize) {
    // Compare bounding boxes to locate the closest grain that still overlaps our spawn candidate.
    const top = grain.y;
    const bottom = grain.y + colliderSize;
    for (const other of this.grains) {
      if (other === grain) {
        continue;
      }
      const otherCollider = Number.isFinite(other.colliderSize)
        ? Math.max(1, Math.round(other.colliderSize))
        : this.computeColliderSize(other.size);
      const otherTop = other.y;
      const otherBottom = other.y + otherCollider;
      const verticalOverlap = bottom > otherTop && top < otherBottom; // Track if grains share the same vertical band.
      const horizontalOverlap = grain.x < other.x + otherCollider && grain.x + colliderSize > other.x; // Track horizontal overlap for the same band.
      if (verticalOverlap && horizontalOverlap) {
        return other;
      }
    }
    return null;
  }

  chooseGrainSize() {
    if (this.grainSizes.length === 1) {
      return this.grainSizes[0];
    }
    const weights = this.grainSizes.map((size) => 1 / Math.max(1, size - 1));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let pick = Math.random() * totalWeight;
    for (let i = 0; i < this.grainSizes.length; i += 1) {
      pick -= weights[i];
      if (pick <= 0) {
        return this.grainSizes[i];
      }
    }
    return this.grainSizes[this.grainSizes.length - 1];
  }

  updateGrains() {
    if (!this.grains.length) {
      return;
    }

    const survivors = [];
    const freefallSpeed = this.stabilized ? 2 : 3;

    this.grains.sort((a, b) => {
      const aSize = Number.isFinite(a.colliderSize) ? Math.max(1, a.colliderSize) : 1;
      const bSize = Number.isFinite(b.colliderSize) ? Math.max(1, b.colliderSize) : 1;
      return b.y + bSize - (a.y + aSize);
    });

    for (const grain of this.grains) {
      if (!Number.isFinite(grain.colliderSize) || grain.colliderSize <= 0) {
        grain.colliderSize = this.computeColliderSize(grain.size);
      }
      const colliderSize = Math.max(1, Math.round(grain.colliderSize));
      if (!this.stabilized || grain.freefall) {
        grain.freefall = true;
        grain.inGrid = false;
        grain.resting = false;
        grain.y += freefallSpeed;
        if (grain.y * this.cellSize > this.height + colliderSize * this.cellSize) {
          continue;
        }
        survivors.push(grain);
        continue;
      }

      if (grain.y < 0) {
        // Accelerate grains that are still above the basin so the higher spawn point keeps the stream feeling continuous.
        const descent = Math.max(2, freefallSpeed);
        grain.y = Math.min(grain.y + descent, 0);
        grain.resting = false;
        survivors.push(grain);
        continue;
      }

      if (grain.inGrid) {
        this.clearCells(grain);
      }

      let moved = false;

      if (this.canPlace(grain.x, grain.y + 1, colliderSize)) {
        grain.y += 1;
        moved = true;
      } else {
        const preferred = grain.bias;
        const alternate = -preferred;
        if (this.canPlace(grain.x + preferred, grain.y + 1, colliderSize)) {
          grain.x += preferred;
          grain.y += 1;
          moved = true;
        } else if (this.canPlace(grain.x + alternate, grain.y + 1, colliderSize)) {
          grain.x += alternate;
          grain.y += 1;
          moved = true;
        } else {
          const slump = this.getSlumpDirection(grain);
          if (slump && this.canPlace(grain.x + slump, grain.y, colliderSize)) {
            grain.x += slump;
            moved = true;
          }
        }
      }

      if (grain.y > this.rows - colliderSize) {
        grain.y = this.rows - colliderSize;
      }

      this.fillCells(grain);
      grain.inGrid = true;
      grain.resting = !moved;
      survivors.push(grain);
    }

    this.grains = survivors;
    this.applyScrollIfNeeded();
  }

  applyScrollIfNeeded() {
    if (!this.grains.length) {
      return;
    }

    const threshold = Math.max(0.2, Math.min(0.95, this.scrollThreshold));
    const targetTopRow = Math.max(0, Math.floor(this.rows * (1 - threshold)));
    if (targetTopRow <= 0) {
      return;
    }

    let highestTop = this.rows;
    for (const grain of this.grains) {
      if (!grain.inGrid || grain.freefall || !grain.resting) {
        continue;
      }
      highestTop = Math.min(highestTop, grain.y);
    }

    if (highestTop >= this.rows || highestTop > targetTopRow) {
      return;
    }

    const shift = Math.max(0, targetTopRow - highestTop);
    if (!shift) {
      return;
    }

    this.scrollOffsetCells += shift;
    this.clearGridPreserveWalls();

    const shifted = [];
    for (const grain of this.grains) {
      grain.y += shift;
      if (grain.y >= this.rows) {
        continue;
      }
      grain.inGrid = false;
      shifted.push(grain);
    }

    this.grains = shifted;
    this.populateGridFromGrains();
  }

  updateHeightFromGrains(force = false) {
    if (!this.rows) {
      return;
    }

    if (!this.grains.length) {
      this.highestTotalHeightCells = Math.max(this.highestTotalHeightCells, this.scrollOffsetCells);
      const totalNormalized = this.scrollOffsetCells / this.rows;
      const info = {
        normalizedHeight: 0,
        duneGain: Math.min(this.maxDuneGain, totalNormalized * this.maxDuneGain),
        largestGrain: 0,
        scrollOffset: this.scrollOffsetCells,
        visibleHeight: 0,
        totalHeight: this.scrollOffsetCells,
        totalNormalized,
        crestPosition: 1,
        rows: this.rows,
        cols: this.cols,
        cellSize: this.cellSize,
        highestNormalized: this.highestTotalHeightCells / this.rows,
      };
      this.notifyHeightChange(info, force);
      return;
    }

    let highestTop = this.rows;
    let largest = 0;
    let restingFound = false;
    for (const grain of this.grains) {
      if (!grain.inGrid || grain.freefall || !grain.resting || grain.y < 0) {
        continue;
      }
      const colliderSize = Number.isFinite(grain.colliderSize)
        ? Math.max(1, Math.round(grain.colliderSize))
        : 1;
      restingFound = true;
      highestTop = Math.min(highestTop, grain.y);
      largest = Math.max(largest, colliderSize);
    }

    let visibleHeight = 0;
    let crestPosition = 1;
    if (restingFound && highestTop < this.rows) {
      visibleHeight = Math.max(0, this.rows - highestTop);
      crestPosition = Math.max(0, Math.min(1, highestTop / this.rows));
    }

    const totalHeight = this.scrollOffsetCells + visibleHeight;
    this.highestTotalHeightCells = Math.max(this.highestTotalHeightCells, totalHeight);

    const normalized = Math.min(1, visibleHeight / this.rows);
    const totalNormalized = totalHeight / this.rows;
    const duneGain = Math.min(this.maxDuneGain, totalNormalized * this.maxDuneGain);

    const info = {
      normalizedHeight: normalized,
      duneGain,
      largestGrain: largest,
      scrollOffset: this.scrollOffsetCells,
      visibleHeight,
      totalHeight,
      totalNormalized,
      crestPosition,
      rows: this.rows,
      cols: this.cols,
      cellSize: this.cellSize,
      highestNormalized: this.highestTotalHeightCells / this.rows,
    };

    this.notifyHeightChange(info, force);
  }

  notifyHeightChange(info, force = false) {
    if (!info) {
      return;
    }
    const previous =
      this.heightInfo ||
      {
        normalizedHeight: 0,
        duneGain: 0,
        largestGrain: 0,
        scrollOffset: 0,
        totalHeight: 0,
      };
    const heightDiff = Math.abs(previous.normalizedHeight - info.normalizedHeight);
    const gainDiff = Math.abs(previous.duneGain - info.duneGain);
    const sizeChanged = previous.largestGrain !== info.largestGrain;
    const offsetChanged = previous.scrollOffset !== info.scrollOffset;
    const totalChanged = previous.totalHeight !== info.totalHeight;
    this.heightInfo = info;
    if (
      this.onHeightChange &&
      (force || heightDiff > 0.01 || gainDiff > 0.01 || sizeChanged || offsetChanged || totalChanged)
    ) {
      this.onHeightChange(info);
    }
  }

  // Ensure the stored camera center stays within the basin bounds for the active zoom level.
  applyViewConstraints() {
    this.viewCenterNormalized = this.clampViewCenterNormalized(
      this.viewCenterNormalized || { x: 0.5, y: 0.5 },
    );
  }

  // Restrict camera centers so zoomed views never leave the simulated basin.
  clampViewCenterNormalized(normalized) {
    if (!normalized) {
      return { x: 0.5, y: 0.5 };
    }
    const scale = Math.max(this.viewScale || 1, 0.0001);
    const halfX = Math.min(0.5, 0.5 / scale);
    // Measure half of the visible height in normalized tower units so zoom changes keep the floor anchored.
    const verticalHalfNormalized = Math.min(0.5 / scale, 1);
    // Reuse the overscan budget when clamping so both camera limits and spawn logic stay in sync.
    const overscanNormalized = Number.isFinite(this.maxViewTopOverscanNormalized)
      ? Math.max(0, this.maxViewTopOverscanNormalized)
      : 0;
    const clamp = (value, min, max) => {
      if (min > max) {
        return 0.5;
      }
      return Math.min(Math.max(value, min), max);
    };
    let minY = -overscanNormalized + verticalHalfNormalized;
    let maxY = 1 - verticalHalfNormalized;
    if (minY > maxY) {
      // Collapse impossible ranges (e.g., extreme debug zoom) to the midpoint so the camera stays stable.
      const midpoint = (minY + maxY) / 2;
      minY = midpoint;
      maxY = midpoint;
    }
    return {
      x: clamp(normalized.x, halfX, 1 - halfX),
      // Restrict the vertical camera range so the floor stays visible and the zoom ceiling matches the overscan budget.
      y: clamp(normalized.y, minY, maxY),
    };
  }

  // Convert the normalized camera center into basin coordinates measured in simulation units.
  getViewCenterWorld() {
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    const center = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    return {
      x: width * center.x,
      y: height * center.y,
    };
  }

  // Provide the active view transform so host UIs can synchronize overlay elements.
  getViewTransform() {
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    const scale = Number.isFinite(this.viewScale) && this.viewScale > 0 ? this.viewScale : 1;
    const center = this.getViewCenterWorld();
    const normalized = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    return {
      width,
      height,
      scale,
      center,
      normalizedCenter: { ...normalized },
    };
  }

  // Notify listeners when the camera transform changes so overlays stay aligned.
  notifyViewTransformChange() {
    if (typeof this.onViewTransformChange === 'function') {
      this.onViewTransformChange(this.getViewTransform());
    }
  }

  // Apply a new normalized camera center and immediately redraw the basin.
  setViewCenterNormalized(normalized) {
    this.viewCenterNormalized = this.clampViewCenterNormalized(normalized);
    this.render();
    this.notifyViewTransformChange();
  }

  // Update the camera center using world-space coordinates measured in simulation pixels.
  setViewCenterFromWorld(world) {
    if (!world) {
      return;
    }
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    if (!width || !height) {
      this.setViewCenterNormalized({ x: 0.5, y: 0.5 });
      return;
    }
    this.setViewCenterNormalized({ x: world.x / width, y: world.y / height });
  }

  // Translate client pointer coordinates into basin world coordinates for camera gestures.
  getWorldPointFromClient(point) {
    if (!point || !this.canvas) {
      return null;
    }
    const rect = typeof this.canvas.getBoundingClientRect === 'function'
      ? this.canvas.getBoundingClientRect()
      : null;
    const width = this.width || rect?.width || this.canvas.clientWidth || 0;
    const height = this.height || rect?.height || this.canvas.clientHeight || 0;
    if (!width || !height || !rect) {
      return null;
    }
    const scale = this.viewScale || 1;
    const center = this.getViewCenterWorld();
    const localX = point.clientX - rect.left;
    const localY = point.clientY - rect.top;
    if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
      return null;
    }
    return {
      x: (localX - width / 2) / scale + center.x,
      y: (localY - height / 2) / scale + center.y,
    };
  }

  // Apply a multiplicative zoom change anchored around an optional client coordinate.
  applyZoomFactor(factor, anchorPoint = null) {
    if (!Number.isFinite(factor) || factor <= 0) {
      return false;
    }
    return this.setZoom((this.viewScale || 1) * factor, anchorPoint);
  }

  // Update the zoom level while keeping the chosen anchor locked beneath the pointer.
  setZoom(targetScale, anchorPoint = null) {
    if (!Number.isFinite(targetScale)) {
      return false;
    }
    const minScale = Number.isFinite(this.minViewScale) && this.minViewScale > 0 ? this.minViewScale : 0.75;
    const maxScale = Number.isFinite(this.maxViewScale) && this.maxViewScale > 0 ? this.maxViewScale : 2.5;
    const clamped = Math.min(maxScale, Math.max(minScale, targetScale));
    const previousScale = this.viewScale;
    this.viewScale = clamped;
    this.applyViewConstraints();
    if (anchorPoint) {
      const anchorWorld = this.getWorldPointFromClient(anchorPoint);
      if (anchorWorld) {
        const rect = this.canvas?.getBoundingClientRect();
        const width = this.width || rect?.width || this.canvas?.clientWidth || 0;
        const height = this.height || rect?.height || this.canvas?.clientHeight || 0;
        if (width && height && rect) {
          const localX = anchorPoint.clientX - rect.left;
          const localY = anchorPoint.clientY - rect.top;
          const centerWorldX = (width / 2 - localX) / clamped + anchorWorld.x;
          const centerWorldY = (height / 2 - localY) / clamped + anchorWorld.y;
          this.setViewCenterFromWorld({ x: centerWorldX, y: centerWorldY });
        }
      }
    }
    this.applyViewConstraints();
    this.render();
    this.notifyViewTransformChange();
    return Math.abs(previousScale - this.viewScale) > 0.0001;
  }

  render() {
    if (!this.ctx) {
      return;
    }

    const ratio = Number.isFinite(this.deviceScale) && this.deviceScale > 0 ? this.deviceScale : 1;
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    if (!width || !height) {
      return;
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const palette = this.getEffectiveMotePalette();
    this.ctx.fillStyle = palette.backgroundBottom || '#171a27';
    this.ctx.fillRect(0, 0, width, height);

    const center = this.getViewCenterWorld();
    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(this.viewScale, this.viewScale);
    this.ctx.translate(-center.x, -center.y);

    const gradientTop = -height;
    const gradientHeight = height * 3;
    // Extend the tower's background gradient well above the basin so zoomed-out views never expose empty space.
    const gradient = this.ctx.createLinearGradient(0, gradientTop, 0, gradientTop + gradientHeight);
    gradient.addColorStop(0, palette.backgroundTop || '#0f1018');
    gradient.addColorStop(1, palette.backgroundBottom || '#171a27');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(-width, gradientTop, width * 3, gradientHeight);

    // Carry the wall edge highlights upward alongside the extended gradient to avoid abrupt seams at the zoom ceiling.
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.fillRect(0, gradientTop, 2, gradientHeight);
    this.ctx.fillRect(width - 2, gradientTop, 2, gradientHeight);
    this.ctx.fillRect(0, height - 2, width, 2);

    const cellSizePx = this.cellSize;
    for (const grain of this.grains) {
      const visualSize = Number.isFinite(grain.size) ? Math.max(1, grain.size) : 1;
      const colliderSize = Number.isFinite(grain.colliderSize)
        ? Math.max(1, Math.round(grain.colliderSize))
        : visualSize;
      const baseSizePx = visualSize * cellSizePx;
      const colliderSizePx = colliderSize * cellSizePx;
      const sizePx = Math.max(colliderSizePx, baseSizePx * MOTE_RENDER_SCALE);
      const offsetPx = (sizePx - colliderSizePx) / 2;
      const px = grain.x * cellSizePx - offsetPx;
      const py = grain.y * cellSizePx - offsetPx;

      if (py >= height || px >= width || py + sizePx <= 0 || px + sizePx <= 0) {
        continue;
      }

      this.ctx.fillStyle = this.getMoteColorForSize(visualSize, grain.freefall, grain.color);
      this.ctx.fillRect(px, py, sizePx, sizePx);
    }

    this.ctx.restore();
  }

  getEffectiveMotePalette() {
    if (!this.motePalette) {
      this.motePalette = mergeMotePalette(DEFAULT_MOTE_PALETTE);
    }
    return this.motePalette;
  }

  getDefaultProfile() {
    if (!this.defaultProfile) {
      return null;
    }
    const { grainSizes, idleDrainRate, baseSpawnInterval, palette } = this.defaultProfile;
    return {
      grainSizes: Array.isArray(grainSizes) ? [...grainSizes] : null,
      idleDrainRate,
      baseSpawnInterval,
      palette: palette
        ? {
            ...palette,
            stops: Array.isArray(palette.stops) ? palette.stops.map((stop) => ({ ...stop })) : [],
          }
        : null,
    };
  }

  applyProfile(profile = null) {
    const targetProfile =
      profile && typeof profile === 'object' ? profile : this.getDefaultProfile();
    if (!targetProfile) {
      return;
    }

    if (Array.isArray(targetProfile.grainSizes) && targetProfile.grainSizes.length) {
      const normalized = targetProfile.grainSizes
        .map((size) => {
          const numeric = Number.isFinite(size) ? size : Number.parseFloat(size);
          return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : null;
        })
        .filter((size) => Number.isFinite(size) && size > 0)
        .sort((a, b) => a - b);
      if (normalized.length) {
        this.grainSizes = normalized;
      }
    }

    if (Number.isFinite(targetProfile.idleDrainRate)) {
      this.idleDrainRate = Math.max(1, targetProfile.idleDrainRate);
    } else if (targetProfile.idleDrainRate === null && this.defaultProfile) {
      this.idleDrainRate = this.defaultProfile.idleDrainRate;
    }

    if (Number.isFinite(targetProfile.baseSpawnInterval) && targetProfile.baseSpawnInterval > 0) {
      this.baseSpawnInterval = targetProfile.baseSpawnInterval;
    } else if (targetProfile.baseSpawnInterval === null && this.defaultProfile) {
      this.baseSpawnInterval = this.defaultProfile.baseSpawnInterval;
    }

    if (targetProfile.palette) {
      this.setMotePalette(targetProfile.palette);
    } else if (targetProfile.palette === null && this.defaultProfile?.palette) {
      this.setMotePalette(this.defaultProfile.palette);
    }

    if (Number.isFinite(targetProfile.flowOffset)) {
      this.setFlowOffset(targetProfile.flowOffset);
    }

    this.applyWallGapTarget();
    this.render();
    this.notifyWallMetricsChange();
  }

  setMotePalette(palette) {
    this.motePalette = mergeMotePalette(palette);
  }

  normalizeDropColor(color) {
    if (!color) {
      return null;
    }
    if (typeof color === 'string') {
      return parseCssColor(color);
    }
    if (typeof color === 'object') {
      if (Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
        return {
          r: Math.max(0, Math.min(255, color.r)),
          g: Math.max(0, Math.min(255, color.g)),
          b: Math.max(0, Math.min(255, color.b)),
        };
      }
      if (
        Number.isFinite(color.hue) &&
        Number.isFinite(color.saturation) &&
        Number.isFinite(color.lightness)
      ) {
        return hslToRgbColor(
          color.hue,
          clampUnitInterval(color.saturation / 100),
          clampUnitInterval(color.lightness / 100),
        );
      }
      if (Number.isFinite(color.h) && Number.isFinite(color.s) && Number.isFinite(color.l)) {
        return hslToRgbColor(color.h, clampUnitInterval(color.s), clampUnitInterval(color.l));
      }
    }
    return null;
  }

  getMoteColorForSize(size, isFreefall, baseColor) {
    const palette = this.getEffectiveMotePalette();
    const normalizedSize = Number.isFinite(size) ? Math.max(1, size) : 1;
    const sizeRatio = clampUnitInterval((normalizedSize - 1) / Math.max(1, (this.maxDropSize || normalizedSize) - 1));
    const baseRestAlpha = Number.isFinite(palette?.restAlpha) ? palette.restAlpha : 0.9;
    const baseFreefallAlpha = Number.isFinite(palette?.freefallAlpha) ? palette.freefallAlpha : 0.6;
    const alpha = isFreefall
      ? Math.min(1, baseFreefallAlpha + 0.08)
      : Math.min(1, baseRestAlpha + 0.04);
    const resolvedColor = this.normalizeDropColor(baseColor);
    if (resolvedColor) {
      const highlight = mixRgbColors(resolvedColor, { r: 255, g: 255, b: 255 }, 0.28 + sizeRatio * 0.22);
      const shadowAnchor = mixRgbColors(resolvedColor, { r: 12, g: 8, b: 4 }, 0.35 + sizeRatio * 0.2);
      const body = mixRgbColors(shadowAnchor, highlight, 0.6 + sizeRatio * 0.25);
      return colorToRgbaString(body, alpha);
    }
    const baseSand = { r: 255, g: 222, b: 137 };
    const shadowSand = { r: 204, g: 170, b: 82 };
    const highlight = mixRgbColors(baseSand, { r: 255, g: 255, b: 255 }, 0.35 + sizeRatio * 0.15);
    const body = mixRgbColors(shadowSand, highlight, 0.68 + sizeRatio * 0.2);
    return colorToRgbaString(body, alpha);
  }

  setFlowOffset(offset) {
    const normalized = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const stabilized = normalized > 0;
    this.flowOffset = normalized;

    if (stabilized === this.stabilized) {
      this.stabilized = stabilized;
      if (!stabilized) {
        this.releaseAllGrains();
      }
      return;
    }

    this.stabilized = stabilized;
    if (!this.stabilized) {
      this.releaseAllGrains();
    }
  }

  releaseAllGrains() {
    this.clearGridPreserveWalls();
    this.grains.forEach((grain) => {
      grain.freefall = true;
      grain.inGrid = false;
      grain.resting = false;
    });
    this.scrollOffsetCells = 0;
    this.highestTotalHeightCells = 0;
    this.updateHeightFromGrains(true);
  }

  getStatus() {
    return this.heightInfo;
  }

  // Compact autosave helpers and compact-aware exportState/importState
  // Default: prefer compact autosaves (baseline + dune). Instances can override useCompactAutosave.
  useCompactAutosave = true;
  MAX_GRAINS_TO_STORE = 1500;

  computeColumnTopHeights() {
    const cols = Math.max(1, this.cols || 0);
    const tops = new Array(cols).fill(-1);
    if (Array.isArray(this.grains) && this.grains.length) {
      for (const g of this.grains) {
        const x = Number.isFinite(g.x) ? Math.round(g.x) : null;
        const y = Number.isFinite(g.y) ? Math.round(g.y) : null;
        if (x !== null && y !== null && x >= 0 && x < cols) {
          tops[x] = Math.max(tops[x], y);
        }
      }
      return tops;
    }
    if (Array.isArray(this.grid) && this.grid.length && Number.isFinite(this.rows)) {
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < (this.rows || this.grid.length); row++) {
          const cell = this.grid[row] && this.grid[row][col];
          if (cell) {
            tops[col] = Math.max(tops[col], (this.rows - row - 1));
            break;
          }
        }
      }
      return tops;
    }
    return tops;
  }

  computeBaselineLineFromTops(tops) {
    const n = tops.length;
    const points = [];
    for (let x = 0; x < n; x++) {
      if (tops[x] >= 0) points.push([x, tops[x]]);
    }
    if (!points.length) return { a: 0, b: 0 };

    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    points.forEach(([x, y]) => { sumX += x; sumY += y; sumXX += x * x; sumXY += x * y; });
    const m = points.length;
    const denom = m * sumXX - sumX * sumX;
    let b = 0;
    if (Math.abs(denom) > 1e-6) {
      b = (m * sumXY - sumX * sumY) / denom;
    }
    const a = (sumY - b * sumX) / m;

    let baselineA = a;
    for (let iter = 0; iter < 10; iter++) {
      let maxViolation = 0;
      for (let x = 0; x < n; x++) {
        if (tops[x] < 0) continue;
        const lineY = baselineA + b * x;
        if (lineY > tops[x]) maxViolation = Math.max(maxViolation, lineY - tops[x]);
      }
      if (maxViolation <= 1e-6) break;
      baselineA -= maxViolation;
    }
    return { a: Math.floor(baselineA), b };
  }

  computeCompactHeightLine() {
    const tops = this.computeColumnTopHeights();
    const cols = tops.length;
    const line = this.computeBaselineLineFromTops(tops);
    const leftBaseline = Math.round(line.a);
    const rightBaseline = Math.round(line.a + line.b * Math.max(0, cols - 1));
    let dunePeak = 0, peakCol = 0;
    for (let x = 0; x < cols; x++) {
      const t = tops[x] >= 0 ? tops[x] : leftBaseline;
      const baselineAtX = Math.floor(line.a + line.b * x);
      const diff = Math.max(0, t - baselineAtX);
      if (diff > dunePeak) { dunePeak = Math.round(diff); peakCol = x; }
    }
    return {
      leftBaseline: Math.max(0, leftBaseline),
      rightBaseline: Math.max(0, rightBaseline),
      dunePeak: Math.max(0, Math.round(dunePeak)),
      peakCol: Math.max(0, Math.round(peakCol)),
      cols
    };
  }

  _synthesizeStateFromCompact(state) {
    if (!state || typeof state !== 'object' || !state.compactHeightLine) return null;
    
    // Always use efficient rectangle restoration method (disable old mound/dune synthesis)
    return this._synthesizeRectangleState(state);
  }

  _synthesizeRectangleState(state) {
    // Rectangle-based mote restoration: Fill from the basin floor and respect wall insets.
    const savedMoteCount = Math.max(0, Math.round(state.moteCount || 0));
    const normalizedIdleBank = Math.max(0, normalizeFiniteNumber(state.idleBank, 0));
    const compactCols = Number.isFinite(state?.compactHeightLine?.cols)
      ? Math.max(0, Math.round(state.compactHeightLine.cols))
      : 0;
    const totalCols = compactCols > 0 ? compactCols : Math.max(0, Math.round(this.cols || 0));

    if (totalCols <= 0 || savedMoteCount <= 0) {
      return {
        ...state,
        grains: [],
        pendingDrops: [],
        idleBank: normalizedIdleBank,
        moteCount: 0,
      };
    }

    let leftInset = Number.isFinite(state.wallInsetLeftCells)
      ? Math.max(0, Math.round(state.wallInsetLeftCells))
      : Math.max(0, Math.round(this.wallInsetLeftCells || 0));
    let rightInset = Number.isFinite(state.wallInsetRightCells)
      ? Math.max(0, Math.round(state.wallInsetRightCells))
      : Math.max(0, Math.round(this.wallInsetRightCells || 0));

    leftInset = Math.min(leftInset, totalCols);
    rightInset = Math.min(rightInset, Math.max(0, totalCols - leftInset));

    let gapWidth = Math.max(0, totalCols - leftInset - rightInset);
    if (Number.isFinite(state.wallGapCellsTarget) && state.wallGapCellsTarget > 0) {
      gapWidth = Math.min(Math.max(1, Math.round(state.wallGapCellsTarget)), totalCols);
    }
    if (gapWidth <= 0) {
      gapWidth = totalCols;
      leftInset = 0;
    }
    const startColumn = Math.max(0, Math.min(leftInset, Math.max(0, totalCols - gapWidth)));
    const fillWidth = Math.max(0, Math.min(gapWidth, totalCols - startColumn));
    if (fillWidth <= 0) {
      return {
        ...state,
        grains: [],
        pendingDrops: [],
        idleBank: normalizedIdleBank,
        moteCount: 0,
      };
    }

    const fullRowsFromCount = Math.floor(savedMoteCount / fillWidth);
    if (fullRowsFromCount <= 0) {
      return {
        ...state,
        grains: [],
        pendingDrops: [],
        idleBank: normalizedIdleBank,
        moteCount: 0,
      };
    }

    let totalRows = Number.isFinite(this.rows) && this.rows > 0 ? Math.round(this.rows) : 0;
    if (totalRows <= 0 && Number.isFinite(state?.heightInfo?.rows)) {
      totalRows = Math.max(1, Math.round(state.heightInfo.rows));
    }
    if (totalRows <= 0) {
      totalRows = fullRowsFromCount;
    }
    totalRows = Math.max(totalRows, fullRowsFromCount);

    const rowsToFill = Math.min(fullRowsFromCount, totalRows);
    if (rowsToFill <= 0) {
      return {
        ...state,
        grains: [],
        pendingDrops: [],
        idleBank: normalizedIdleBank,
        moteCount: 0,
      };
    }

    const firstRow = Math.max(0, totalRows - rowsToFill);
    const grains = [];
    let synthesizedId = Number.isFinite(state?.nextId)
      ? Math.max(1, Math.round(state.nextId))
      : Math.max(1, this.nextId || 1);

    for (let rowOffset = 0; rowOffset < rowsToFill; rowOffset += 1) {
      const y = firstRow + rowOffset;
      for (let colOffset = 0; colOffset < fillWidth; colOffset += 1) {
        const x = startColumn + colOffset;
        if (x < 0 || x >= totalCols) {
          continue;
        }
        grains.push({
          id: synthesizedId++,
          x,
          y,
          size: 1,
          colliderSize: 1,
          bias: 1,
          shade: 180,
          freefall: false,
          inGrid: true,
          resting: true,
        });
      }
    }

    const hasCapacity = Number.isFinite(this.maxGrains) && this.maxGrains > 0;
    const capacity = hasCapacity ? Math.max(1, Math.round(this.maxGrains)) : null;
    const limitedGrains = capacity ? grains.slice(0, capacity) : grains;

    return {
      ...state,
      grains: limitedGrains,
      pendingDrops: [],
      idleBank: normalizedIdleBank,
      moteCount: limitedGrains.length,
      nextId: Math.max(synthesizedId, this.nextId || synthesizedId),
    };
  }

  exportState() {
    const palette = mergeMotePalette(this.getEffectiveMotePalette());
    const serializeGrain = (grain) => {
      if (!grain || typeof grain !== 'object') return null;
      const size = Math.max(1, normalizeFiniteInteger(grain.size, 1));
      const colliderSize = Math.max(1, normalizeFiniteInteger(grain.colliderSize || size, size));
      const id = Math.max(1, normalizeFiniteInteger(grain.id, 1));
      const biasRaw = normalizeFiniteInteger(grain.bias, 1);
      const bias = biasRaw < 0 ? -1 : 1;
      const shade = Math.max(0, Math.min(255, normalizeFiniteInteger(grain.shade, 180)));
      const x = normalizeFiniteInteger(grain.x, 0);
      const y = normalizeFiniteInteger(grain.y, 0);
      const color = cloneMoteColor(grain.color);
      return {
        id,
        x,
        y,
        size,
        colliderSize,
        bias,
        shade,
        freefall: !!grain.freefall,
        inGrid: !!grain.inGrid,
        resting: !!grain.resting,
        color,
      };
    };

    const serializeDrop = (drop) => {
      if (drop && typeof drop === 'object') {
        const size = Math.max(1, normalizeFiniteInteger(drop.size, 1));
        const color = cloneMoteColor(drop.color);
        const payload = color ? { size, color } : { size };
        if (typeof drop.source === 'string') payload.source = drop.source;
        return payload;
      }
      if (Number.isFinite(drop)) return { size: Math.max(1, Math.round(drop)) };
      return null;
    };

    const grains = Array.isArray(this.grains)
      ? this.grains.slice(0, this.maxGrains || this.grains.length).map(serializeGrain).filter(Boolean)
      : [];
    const pendingDrops = Array.isArray(this.pendingDrops)
      ? this.pendingDrops.slice(0, this.maxGrains || this.pendingDrops.length).map(serializeDrop).filter(Boolean)
      : [];

    const viewCenter = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    const heightInfo = this.heightInfo ? {
      normalizedHeight: normalizeFiniteNumber(this.heightInfo.normalizedHeight, 0),
      duneGain: normalizeFiniteNumber(this.heightInfo.duneGain, 0),
      largestGrain: normalizeFiniteInteger(this.heightInfo.largestGrain, 0),
      scrollOffset: normalizeFiniteInteger(this.heightInfo.scrollOffset, 0),
      visibleHeight: normalizeFiniteInteger(this.heightInfo.visibleHeight, 0),
      totalHeight: normalizeFiniteInteger(this.heightInfo.totalHeight, 0),
      totalNormalized: normalizeFiniteNumber(this.heightInfo.totalNormalized, 0),
      crestPosition: normalizeFiniteNumber(this.heightInfo.crestPosition, 1),
      rows: normalizeFiniteInteger(this.heightInfo.rows, this.rows),
      cols: normalizeFiniteInteger(this.heightInfo.cols, this.cols),
      cellSize: normalizeFiniteInteger(this.heightInfo.cellSize, this.cellSize),
      highestNormalized: normalizeFiniteNumber(this.heightInfo.highestNormalized, 0),
    } : null;

    const shouldCompact = !!this.useCompactAutosave || (grains.length > (this.MAX_GRAINS_TO_STORE || 1500));
    if (shouldCompact) {
      const compact = this.computeCompactHeightLine();
      return {
        idleBank: Math.max(0, normalizeFiniteNumber(this.idleBank, 0)),
        idleAccumulator: Math.max(0, normalizeFiniteNumber(this.idleAccumulator, 0)),
        idleDropBuffer: Math.max(0, normalizeFiniteInteger(this.idleDropBuffer, 0)),
        idleDropAccumulator: Math.max(0, normalizeFiniteNumber(this.idleDropAccumulator, 0)),
        spawnTimer: Math.max(0, normalizeFiniteNumber(this.spawnTimer, 0)),
        scrollOffsetCells: Math.max(0, normalizeFiniteInteger(this.scrollOffsetCells, 0)),
        highestTotalHeightCells: Math.max(0, normalizeFiniteInteger(this.highestTotalHeightCells ?? 0, 0)),
        viewScale: Math.max(0.1, normalizeFiniteNumber(this.viewScale, 1)),
        viewCenterNormalized: { x: normalizeFiniteNumber(viewCenter.x, 0.5), y: normalizeFiniteNumber(viewCenter.y, 0.5) },
        flowOffset: Math.max(0, normalizeFiniteNumber(this.flowOffset, 0)),
        stabilized: !!this.stabilized,
        nextId: Math.max(1, normalizeFiniteInteger(this.nextId, 1)),
        idleDrainRate: Math.max(0.1, normalizeFiniteNumber(this.idleDrainRate, 1)),
        baseSpawnInterval: Math.max(16, normalizeFiniteNumber(this.baseSpawnInterval, 180)),
        grainSizes: Array.isArray(this.grainSizes) ? this.grainSizes.map((size) => Math.max(1, normalizeFiniteInteger(size, 1))) : [],
        wallInsetLeftCells: Math.max(0, normalizeFiniteInteger(this.wallInsetLeftCells, 0)),
        wallInsetRightCells: Math.max(0, normalizeFiniteInteger(this.wallInsetRightCells, 0)),
        wallGapCellsTarget: Number.isFinite(this.wallGapCellsTarget) ? Math.max(1, normalizeFiniteInteger(this.wallGapCellsTarget, 1)) : null,
        wallGapTargetUnits: Number.isFinite(this.wallGapTargetUnits) ? Math.max(1, normalizeFiniteInteger(this.wallGapTargetUnits, 1)) : null,
        motePalette: palette,
        heightInfo,
        compactHeightLine: compact,
        moteCount: grains.length,
      };
    }

    return {
      grains,
      pendingDrops,
      idleBank: Math.max(0, normalizeFiniteNumber(this.idleBank, 0)),
      idleAccumulator: Math.max(0, normalizeFiniteNumber(this.idleAccumulator, 0)),
      idleDropBuffer: Math.max(0, normalizeFiniteInteger(this.idleDropBuffer, 0)),
      idleDropAccumulator: Math.max(0, normalizeFiniteNumber(this.idleDropAccumulator, 0)),
      spawnTimer: Math.max(0, normalizeFiniteNumber(this.spawnTimer, 0)),
      scrollOffsetCells: Math.max(0, normalizeFiniteInteger(this.scrollOffsetCells, 0)),
      highestTotalHeightCells: Math.max(0, normalizeFiniteInteger(this.highestTotalHeightCells ?? 0, 0)),
      viewScale: Math.max(0.1, normalizeFiniteNumber(this.viewScale, 1)),
      viewCenterNormalized: { x: normalizeFiniteNumber(viewCenter.x, 0.5), y: normalizeFiniteNumber(viewCenter.y, 0.5) },
      flowOffset: Math.max(0, normalizeFiniteNumber(this.flowOffset, 0)),
      stabilized: !!this.stabilized,
      nextId: Math.max(1, normalizeFiniteInteger(this.nextId, grains.length + 1)),
      idleDrainRate: Math.max(0.1, normalizeFiniteNumber(this.idleDrainRate, 1)),
      baseSpawnInterval: Math.max(16, normalizeFiniteNumber(this.baseSpawnInterval, 180)),
      grainSizes: Array.isArray(this.grainSizes) ? this.grainSizes.map((size) => Math.max(1, normalizeFiniteInteger(size, 1))) : [],
      wallInsetLeftCells: Math.max(0, normalizeFiniteInteger(this.wallInsetLeftCells, 0)),
      wallInsetRightCells: Math.max(0, normalizeFiniteInteger(this.wallInsetRightCells, 0)),
      wallGapCellsTarget: Number.isFinite(this.wallGapCellsTarget) ? Math.max(1, normalizeFiniteInteger(this.wallGapCellsTarget, 1)) : null,
      wallGapTargetUnits: Number.isFinite(this.wallGapTargetUnits) ? Math.max(1, normalizeFiniteInteger(this.wallGapTargetUnits, 1)) : null,
      motePalette: palette,
      heightInfo,
      moteCount: grains.length,
    };
  }

  // Rehydrate a previously serialized state so reloaded sessions resume from the same mote arrangement.
  importState(state = {}) {
    if (!state || typeof state !== 'object') {
      return false;
    }

    // If we received a compact descriptor, synthesize a conservative grains/pendingDrops state
    // so the regular import logic (which expects grains/pendingDrops) can proceed.
    if (state && typeof state === 'object' && state.compactHeightLine) {
      const synthetic = this._synthesizeStateFromCompact(state);
      if (synthetic) {
        state = synthetic;
      }
    }

    if (!this.cols || !this.rows) {
      this.handleResize();
    }

    if (!this.cols || !this.rows) {
      return false;
    }

    if (Array.isArray(state.grainSizes) && state.grainSizes.length) {
      const sizes = state.grainSizes
        .map((size) => Math.max(1, normalizeFiniteInteger(size, 1)))
        .filter((size) => Number.isFinite(size) && size > 0)
        .sort((a, b) => a - b);
      if (sizes.length) {
        this.grainSizes = sizes;
      }
    }

    if (Number.isFinite(state.idleDrainRate) && state.idleDrainRate > 0) {
      this.idleDrainRate = Math.max(0.1, state.idleDrainRate);
    }

    if (Number.isFinite(state.baseSpawnInterval) && state.baseSpawnInterval > 0) {
      this.baseSpawnInterval = Math.max(16, state.baseSpawnInterval);
    }

    if (Number.isFinite(state.wallGapCellsTarget) && state.wallGapCellsTarget > 0) {
      this.wallGapCellsTarget = Math.max(1, Math.round(state.wallGapCellsTarget));
    }
    if (Number.isFinite(state.wallGapTargetUnits) && state.wallGapTargetUnits > 0) {
      this.wallGapTargetUnits = Math.max(1, Math.round(state.wallGapTargetUnits));
    }
    // Restore heightInfo if present so glyph calculations can resume accurately
    if (state.heightInfo && typeof state.heightInfo === 'object') {
      this.heightInfo = {
        normalizedHeight: Math.max(0, normalizeFiniteNumber(state.heightInfo.normalizedHeight, 0)),
        duneGain: Math.max(0, normalizeFiniteNumber(state.heightInfo.duneGain, 0)),
        largestGrain: Math.max(0, normalizeFiniteInteger(state.heightInfo.largestGrain, 0)),
        scrollOffset: Math.max(0, normalizeFiniteInteger(state.heightInfo.scrollOffset, 0)),
        visibleHeight: Math.max(0, normalizeFiniteInteger(state.heightInfo.visibleHeight, 0)),
        totalHeight: Math.max(0, normalizeFiniteInteger(state.heightInfo.totalHeight, 0)),
        totalNormalized: Math.max(0, normalizeFiniteNumber(state.heightInfo.totalNormalized ?? state.heightInfo.highestNormalized ?? 0, 0)),
        crestPosition: normalizeFiniteNumber(state.heightInfo.crestPosition, 1),
        rows: Math.max(1, normalizeFiniteInteger(state.heightInfo.rows, this.rows)),
        cols: Math.max(1, normalizeFiniteInteger(state.heightInfo.cols, this.cols)),
        cellSize: Math.max(1, normalizeFiniteInteger(state.heightInfo.cellSize, this.cellSize)),
        highestNormalized: Math.max(0, normalizeFiniteNumber(state.heightInfo.highestNormalized ?? state.heightInfo.totalNormalized ?? 0, 0)),
      };
    }
    if (Number.isFinite(state.highestTotalHeightCells) && state.highestTotalHeightCells > 0) {
      this.highestTotalHeightCells = Math.max(0, normalizeFiniteInteger(state.highestTotalHeightCells, this.scrollOffsetCells));
    }
    this.applyWallGapTarget({ skipRebuild: true });
    this.updateMaxDropSize();

    const deserializeDrop = (drop) => {
      if (!drop) {
        return null;
      }
      if (typeof drop === 'object') {
        const size = Math.max(1, normalizeFiniteInteger(drop.size, 1));
        if (!Number.isFinite(size) || size <= 0) {
          return null;
        }
        const color = cloneMoteColor(drop.color);
        const payload = color ? { size, color } : { size };
        if (typeof drop.source === 'string') {
          payload.source = drop.source; // Restore the drop origin tag so the queue can filter ambient entries on load.
        }
        return payload;
      }
      if (Number.isFinite(drop)) {
        const size = Math.max(1, Math.round(drop));
        return { size };
      }
      return null;
    };

    const deserializeGrain = (grain) => {
      if (!grain || typeof grain !== 'object') {
        return null;
      }
      const size = Math.max(1, normalizeFiniteInteger(grain.size, 1));
      const colliderSize = Math.max(1, normalizeFiniteInteger(grain.colliderSize || size, size));
      const x = normalizeFiniteInteger(grain.x, 0);
      const y = normalizeFiniteInteger(grain.y, 0);
      const id = Math.max(1, normalizeFiniteInteger(grain.id, 1));
      const biasRaw = normalizeFiniteInteger(grain.bias, 1);
      const bias = biasRaw < 0 ? -1 : 1;
      const shade = Math.max(0, Math.min(255, normalizeFiniteInteger(grain.shade, 180)));
      const color = cloneMoteColor(grain.color);
      return {
        id,
        x,
        y,
        size,
        colliderSize,
        bias,
        shade,
        freefall: !!grain.freefall,
        inGrid: !!grain.inGrid,
        resting: !!grain.resting,
        color,
      };
    };

    const grains = Array.isArray(state.grains)
      ? state.grains.map(deserializeGrain).filter(Boolean)
      : [];
    const pendingDrops = Array.isArray(state.pendingDrops)
      ? state.pendingDrops.map(deserializeDrop).filter(Boolean)
      : [];

    if (this.maxGrains && grains.length > this.maxGrains) {
      grains.length = this.maxGrains;
    }
    if (this.maxGrains && pendingDrops.length > this.maxGrains) {
      pendingDrops.length = this.maxGrains;
    }

    this.grains = grains;
    this.pendingDrops = pendingDrops;

    // Restore captured wall offsets so the basin interior aligns with serialized grain positions.
    const savedLeftInset = Number.isFinite(state.wallInsetLeftCells)
      ? Math.max(0, Math.round(state.wallInsetLeftCells))
      : null;
    const savedRightInset = Number.isFinite(state.wallInsetRightCells)
      ? Math.max(0, Math.round(state.wallInsetRightCells))
      : null;

    let gapTarget = Number.isFinite(this.wallGapCellsTarget)
      ? Math.max(1, Math.round(this.wallGapCellsTarget))
      : null;
    if (!Number.isFinite(gapTarget) || gapTarget <= 0) {
      gapTarget = Math.max(1, this.cols - this.wallInsetLeftCells - this.wallInsetRightCells);
    }
    gapTarget = Math.min(gapTarget, Math.max(1, this.cols));

    let targetLeft = savedLeftInset;
    let targetRight = savedRightInset;

    if ((targetLeft === null || targetRight === null) && this.grains.length) {
      // Infer wall spacing from the loaded grain footprint when legacy saves lack explicit inset data.
      let minColumn = Infinity;
      let maxRightEdge = 0;
      for (const grain of this.grains) {
        if (!grain || !Number.isFinite(grain.x)) {
          continue;
        }
        const column = Math.round(grain.x);
        if (Number.isFinite(column)) {
          minColumn = Math.min(minColumn, column);
        }
        const collider = Number.isFinite(grain.colliderSize)
          ? Math.max(1, Math.round(grain.colliderSize))
          : 1;
        const rightEdge = Math.round(grain.x + collider);
        if (Number.isFinite(rightEdge)) {
          maxRightEdge = Math.max(maxRightEdge, rightEdge);
        }
      }

      if (targetLeft === null && Number.isFinite(minColumn)) {
        const maxAllowedLeft = Math.max(0, this.cols - gapTarget);
        const minAllowedLeft = Math.max(0, maxRightEdge - gapTarget);
        targetLeft = Math.max(minAllowedLeft, Math.min(minColumn, maxAllowedLeft));
      }

      if (targetRight === null && Number.isFinite(maxRightEdge)) {
        const resolvedLeft = Number.isFinite(targetLeft)
          ? targetLeft
          : Math.max(0, Math.min(maxRightEdge - gapTarget, this.cols - gapTarget));
        targetRight = Math.max(0, this.cols - gapTarget - resolvedLeft);
      }
    }

    if (targetLeft !== null || targetRight !== null) {
      // Clamp and apply the resolved wall offsets so the saved basin footprint is respected.
      let nextLeft = Number.isFinite(targetLeft)
        ? Math.max(0, Math.min(Math.round(targetLeft), Math.max(0, this.cols - gapTarget)))
        : this.wallInsetLeftCells;
      let nextRight = Number.isFinite(targetRight)
        ? Math.max(0, Math.round(targetRight))
        : this.wallInsetRightCells;
      const maxRightInset = Math.max(0, this.cols - nextLeft - 1);
      nextRight = Math.min(nextRight, maxRightInset);

      let resolvedGap = Math.max(1, this.cols - nextLeft - nextRight);
      if (!Number.isFinite(targetRight)) {
        nextRight = Math.max(0, this.cols - gapTarget - nextLeft);
        resolvedGap = Math.max(1, this.cols - nextLeft - nextRight);
      }

      const insetsChanged = nextLeft !== this.wallInsetLeftCells || nextRight !== this.wallInsetRightCells;
      this.wallInsetLeftCells = nextLeft;
      this.wallInsetRightCells = nextRight;
      this.wallInsetLeftPx = this.wallInsetLeftCells * this.cellSize;
      this.wallInsetRightPx = this.wallInsetRightCells * this.cellSize;
      if (insetsChanged) {
        this.applyWallMask(); // Reapply the static wall mask now that the inset bounds have shifted.
      }
      this.wallGapCellsTarget = resolvedGap;
      this.updateMaxDropSize();
    }

    this.idleBank = Math.max(0, normalizeFiniteNumber(state.idleBank, 0));
    this.idleAccumulator = Math.max(0, normalizeFiniteNumber(state.idleAccumulator, 0));
    this.idleDropBuffer = Math.max(0, normalizeFiniteInteger(state.idleDropBuffer, 0));
    this.idleDropAccumulator = Math.max(0, normalizeFiniteNumber(state.idleDropAccumulator, 0));
    this.spawnTimer = Math.max(0, normalizeFiniteNumber(state.spawnTimer, 0));
    this.scrollOffsetCells = Math.max(0, normalizeFiniteInteger(state.scrollOffsetCells, 0));
    this.highestTotalHeightCells = Math.max(
      this.scrollOffsetCells,
      normalizeFiniteInteger(state.highestTotalHeightCells, this.scrollOffsetCells),
    );

    if (Number.isFinite(state.flowOffset) && state.flowOffset >= 0) {
      this.flowOffset = Math.max(0, state.flowOffset);
      if (typeof state.stabilized === 'boolean') {
        this.stabilized = state.stabilized;
      } else {
        this.stabilized = this.flowOffset > 0;
      }
    }

    const viewScale = Number.isFinite(state.viewScale) && state.viewScale > 0 ? state.viewScale : this.viewScale;
    if (Number.isFinite(viewScale) && viewScale > 0) {
      const minScale = Number.isFinite(this.minViewScale) && this.minViewScale > 0 ? this.minViewScale : 0.75;
      const maxScale = Number.isFinite(this.maxViewScale) && this.maxViewScale > 0 ? this.maxViewScale : 2.5;
      this.viewScale = Math.min(maxScale, Math.max(minScale, viewScale));
    }

    if (state.viewCenterNormalized && typeof state.viewCenterNormalized === 'object') {
      this.viewCenterNormalized = {
        x: normalizeFiniteNumber(state.viewCenterNormalized.x, 0.5),
        y: normalizeFiniteNumber(state.viewCenterNormalized.y, 0.5),
      };
    }
    this.applyViewConstraints();

    if (state.motePalette) {
      this.motePalette = mergeMotePalette(state.motePalette);
    }

    if (Number.isFinite(state.nextId) && state.nextId > 0) {
      this.nextId = Math.max(1, Math.round(state.nextId));
    } else {
      const maxId = this.grains.reduce((max, grain) => Math.max(max, grain.id || 0), 0);
      this.nextId = Math.max(maxId + 1, 1);
    }

    this.clearGridPreserveWalls();
    this.populateGridFromGrains();
    this.applyScrollIfNeeded();
    this.updateHeightFromGrains(true);
    this.render();
    this.notifyWallMetricsChange();
    this.notifyIdleBankChange();
    this.notifyViewTransformChange();
    return true;
  }

  start() {
    if (!this.ctx || this.running) {
      return;
    }
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame(this.handleFrame);
    window.addEventListener('resize', this.handleResize);
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }
}
