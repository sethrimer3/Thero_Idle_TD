/**
 * Powder tower simulation utilities and shared mote palette helpers.
 *
 * This module packages the powder basin rendering math so other systems can
 * reuse the same palette rules without depending on the main bundle.
 */

export const DEFAULT_MOTE_PALETTE = {
  stops: [
    { r: 255, g: 222, b: 137 },
    { r: 139, g: 247, b: 255 },
    { r: 164, g: 182, b: 255 },
  ],
  restAlpha: 0.9,
  freefallAlpha: 0.6,
  backgroundTop: '#0f1018',
  backgroundBottom: '#171a27',
};

export function clampUnitInterval(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function parseHexColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  let hex = value.trim();
  if (!hex) {
    return null;
  }
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (hex.length !== 6 && hex.length !== 8) {
    return null;
  }
  const int = Number.parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(int)) {
    return null;
  }
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

function parseRgbColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value
    .trim()
    .match(/^rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s]+([0-9.]+))?\)$/i);
  if (!match) {
    return null;
  }
  const r = Number.parseFloat(match[1]);
  const g = Number.parseFloat(match[2]);
  const b = Number.parseFloat(match[3]);
  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return null;
  }
  return { r, g, b };
}

function hslToRgbColor(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnitInterval(s);
  const light = clampUnitInterval(l);
  if (sat === 0) {
    const value = Math.round(light * 255);
    return { r: value, g: value, b: value };
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const convert = (t) => {
    let temp = t;
    if (temp < 0) {
      temp += 1;
    }
    if (temp > 1) {
      temp -= 1;
    }
    if (temp < 1 / 6) {
      return p + (q - p) * 6 * temp;
    }
    if (temp < 1 / 2) {
      return q;
    }
    if (temp < 2 / 3) {
      return p + (q - p) * (2 / 3 - temp) * 6;
    }
    return p;
  };
  const r = convert(hue / 360 + 1 / 3);
  const g = convert(hue / 360);
  const b = convert(hue / 360 - 1 / 3);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function parseHslColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value
    .trim()
    .match(/^hsla?\(([-\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s]+([0-9.]+))?\)$/i);
  if (!match) {
    return null;
  }
  const h = Number.parseFloat(match[1]);
  const s = Number.parseFloat(match[2]) / 100;
  const l = Number.parseFloat(match[3]) / 100;
  if ([h, s, l].some((component) => Number.isNaN(component))) {
    return null;
  }
  return hslToRgbColor(h, s, l);
}

function parseCssColor(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return parseHexColor(value) || parseRgbColor(value) || parseHslColor(value);
  }
  if (typeof value === 'object') {
    if ('r' in value && 'g' in value && 'b' in value) {
      return {
        r: Number.isFinite(value.r) ? value.r : 0,
        g: Number.isFinite(value.g) ? value.g : 0,
        b: Number.isFinite(value.b) ? value.b : 0,
      };
    }
    if ('h' in value && 's' in value && 'l' in value) {
      return hslToRgbColor(value.h, value.s, value.l);
    }
  }
  return null;
}

function mixRgbColors(colorA, colorB, ratio) {
  const t = clampUnitInterval(ratio);
  const a = colorA || { r: 0, g: 0, b: 0 };
  const b = colorB || { r: 0, g: 0, b: 0 };
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function colorToRgbaString(color, alpha = 1) {
  const safeColor = color || { r: 0, g: 0, b: 0 };
  const r = Math.round(Math.max(0, Math.min(255, safeColor.r || 0)));
  const g = Math.round(Math.max(0, Math.min(255, safeColor.g || 0)));
  const b = Math.round(Math.max(0, Math.min(255, safeColor.b || 0)));
  const normalizedAlpha = clampUnitInterval(alpha);
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
}

export function mergeMotePalette(palette) {
  if (!palette || typeof palette !== 'object') {
    return {
      ...DEFAULT_MOTE_PALETTE,
      stops: DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop })),
    };
  }

  const stops = Array.isArray(palette.stops) && palette.stops.length
    ? palette.stops
        .map((stop) => {
          if (stop && typeof stop === 'object') {
            const color = parseCssColor(stop) || stop;
            if (color && typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
              return {
                r: Number.isFinite(color.r) ? color.r : 0,
                g: Number.isFinite(color.g) ? color.g : 0,
                b: Number.isFinite(color.b) ? color.b : 0,
              };
            }
          }
          return null;
        })
        .filter(Boolean)
    : DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop }));

  if (!stops.length) {
    stops.push(...DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop }))); // Fallback
  }

  return {
    stops,
    restAlpha: Number.isFinite(palette.restAlpha) ? palette.restAlpha : DEFAULT_MOTE_PALETTE.restAlpha,
    freefallAlpha: Number.isFinite(palette.freefallAlpha)
      ? palette.freefallAlpha
      : DEFAULT_MOTE_PALETTE.freefallAlpha,
    backgroundTop: palette.backgroundTop || DEFAULT_MOTE_PALETTE.backgroundTop,
    backgroundBottom: palette.backgroundBottom || DEFAULT_MOTE_PALETTE.backgroundBottom,
  };
}

function normalizePaletteColorStop(stop) {
  if (!stop) {
    return null;
  }

  let color = null;
  if (typeof stop === 'string') {
    color = parseCssColor(stop);
  } else if (typeof stop === 'object') {
    if ('r' in stop && 'g' in stop && 'b' in stop) {
      color = stop;
    } else {
      color = parseCssColor(stop);
    }
  }

  if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(color.r))),
    g: Math.max(0, Math.min(255, Math.round(color.g))),
    b: Math.max(0, Math.min(255, Math.round(color.b))),
  };
}

export function resolvePaletteColorStops(palette) {
  const reference = palette && typeof palette === 'object' ? palette : DEFAULT_MOTE_PALETTE;
  const stops = [];
  const pushStop = (candidate) => {
    const color = normalizePaletteColorStop(candidate);
    if (!color) {
      return;
    }
    const last = stops[stops.length - 1];
    if (last && last.r === color.r && last.g === color.g && last.b === color.b) {
      return;
    }
    stops.push(color);
  };

  pushStop(reference.backgroundTop);

  const baseStops = Array.isArray(reference.stops) && reference.stops.length
    ? reference.stops
    : DEFAULT_MOTE_PALETTE.stops;
  baseStops.forEach((stop) => pushStop(stop));

  pushStop(reference.backgroundBottom);

  if (!stops.length) {
    DEFAULT_MOTE_PALETTE.stops.forEach((stop) => pushStop(stop));
  }

  if (stops.length === 1) {
    stops.push({ ...stops[0] });
  }

  return stops;
}

export function computeMotePaletteFromTheme() {
  if (typeof window === 'undefined') {
    return mergeMotePalette(DEFAULT_MOTE_PALETTE);
  }
  const root = document.body || document.documentElement;
  if (!root) {
    return mergeMotePalette(DEFAULT_MOTE_PALETTE);
  }
  const styles = window.getComputedStyle(root);
  const accent = parseCssColor(styles.getPropertyValue('--accent')) || DEFAULT_MOTE_PALETTE.stops[1];
  const accentSecondary =
    parseCssColor(styles.getPropertyValue('--accent-2')) || DEFAULT_MOTE_PALETTE.stops[2];
  const accentWarm = parseCssColor(styles.getPropertyValue('--accent-3')) || DEFAULT_MOTE_PALETTE.stops[0];
  const deepBase = { r: 15, g: 16, b: 24 };
  const lowBase = { r: 23, g: 26, b: 39 };
  const stops = [
    mixRgbColors(accentWarm, { r: 255, g: 255, b: 255 }, 0.12),
    mixRgbColors(accent, accentSecondary, 0.25),
    mixRgbColors(accentSecondary, { r: 255, g: 255, b: 255 }, 0.18),
  ];

  return mergeMotePalette({
    stops,
    restAlpha: 0.9,
    freefallAlpha: 0.62,
    backgroundTop: colorToRgbaString(mixRgbColors(deepBase, accent, 0.22), 1),
    backgroundBottom: colorToRgbaString(mixRgbColors(lowBase, accentSecondary, 0.18), 1),
  });
}

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
      : [1, 2, 3];
    if (!this.grainSizes.length) {
      this.grainSizes = [1, 2, 3];
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
    const fallbackIdleDrainRate = Number.isFinite(options.fallbackIdleDrainRate)
      ? Math.max(1, options.fallbackIdleDrainRate)
      : 1;
    this.idleDrainRate = Number.isFinite(options.idleDrainRate)
      ? Math.max(1, options.idleDrainRate)
      : fallbackIdleDrainRate;
    this.maxDropSize = 1;

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
      ? Math.max(1, options.wallGapCells)
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
    // Mirror the parent height as well so the motefall column reaches the basin floor after flex resizing.
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
    displayHeight = Math.max(260, displayHeight);

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
  }

  updateMaxDropSize() {
    const usableWidth = Math.max(1, this.cols - this.wallInsetLeftCells - this.wallInsetRightCells);
    const scale = Number.isFinite(this.collisionScale) && this.collisionScale > 0 ? this.collisionScale : 1;
    const maxVisualWidth = Math.max(1, Math.floor(usableWidth / scale));
    this.maxDropSize = Math.max(1, Math.min(maxVisualWidth, this.rows));
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.applyWallMask();
    this.grains = [];
    this.spawnTimer = 0;
    this.lastFrame = 0;
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
    if (!this.cols) {
      return Math.max(1, Math.round(this.wallGapCellsTarget));
    }
    const referenceCols = Math.max(1, this.wallGapReferenceCols || this.cols);
    const ratio = this.wallGapCellsTarget / referenceCols;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return Math.max(1, Math.round(this.wallGapCellsTarget));
    }
    const scaled = ratio * this.cols;
    if (!Number.isFinite(scaled) || scaled <= 0) {
      return Math.max(1, Math.round(this.wallGapCellsTarget));
    }
    return Math.max(1, Math.round(scaled));
  }

  applyWallGapTarget(options = {}) {
    if (!this.cols) {
      return false;
    }

    const { skipRebuild = false } = options;
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
      this.rebuildGridAfterWallChange();
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

    const spawnBudget = Math.max(1, Math.ceil(delta / 12));
    this.spawnPendingDrops(spawnBudget);

    const iterations = Math.max(1, Math.min(4, Math.round(delta / 16)));
    for (let i = 0; i < iterations; i += 1) {
      this.updateGrains();
    }

    this.updateHeightFromGrains();
    this.render();
  }

  convertIdleBank(delta) {
    if (this.idleBank <= 0 || !Number.isFinite(delta)) {
      return 0;
    }
    const rate = this.idleDrainRate / 1000;
    const pending = this.idleAccumulator + delta * rate;
    const toQueue = Math.min(this.idleBank, Math.floor(pending));
    this.idleAccumulator = pending - toQueue;
    if (toQueue <= 0) {
      return 0;
    }
    for (let index = 0; index < toQueue; index += 1) {
      this.pendingDrops.push({ size: 1 });
    }
    this.idleBank = Math.max(0, this.idleBank - toQueue);
    return toQueue;
  }

  spawnPendingDrops(limit = 1) {
    if (!this.pendingDrops.length || !this.cols || !this.rows) {
      return;
    }
    let remaining = Math.max(1, Math.floor(limit));
    while (remaining > 0 && this.pendingDrops.length && this.grains.length < this.maxGrains) {
      const drop = this.pendingDrops.shift();
      this.spawnGrain(drop?.size);
      remaining -= 1;
    }
  }

  queueDrop(size) {
    if (!Number.isFinite(size) || size <= 0) {
      return;
    }
    const normalized = this.clampGrainSize(size);
    this.pendingDrops.push({ size: normalized });
  }

  addIdleMotes(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.idleBank = Math.max(0, this.idleBank + amount);
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

  spawnGrain(sizeOverride) {
    if (!this.cols || !this.rows) {
      return;
    }
    const visualSize = this.clampGrainSize(
      typeof sizeOverride === 'number' ? sizeOverride : this.chooseGrainSize(),
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

    const grain = {
      id: this.nextId,
      x: startX,
      y: -colliderSize,
      size: visualSize,
      colliderSize,
      bias: Math.random() < 0.5 ? -1 : 1,
      shade: 195 - visualSize * 5 + Math.floor(Math.random() * 12),
      freefall: !this.stabilized,
      inGrid: false,
      resting: false,
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
        grain.y += 1;
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

  render() {
    if (!this.ctx) {
      return;
    }

    const palette = this.getEffectiveMotePalette();
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, palette.backgroundTop || '#0f1018');
    gradient.addColorStop(1, palette.backgroundBottom || '#171a27');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.fillRect(0, 0, 2, this.height);
    this.ctx.fillRect(this.width - 2, 0, 2, this.height);
    this.ctx.fillRect(0, this.height - 2, this.width, 2);

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

      if (py >= this.height || px >= this.width || py + sizePx <= 0 || px + sizePx <= 0) {
        continue;
      }

      this.ctx.fillStyle = this.getMoteColorForSize(visualSize, grain.freefall);
      this.ctx.fillRect(px, py, sizePx, sizePx);
    }
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

  getMoteColorForSize(size, isFreefall) {
    // Always render idle motes as bright golden sand regardless of palette accents.
    const palette = this.getEffectiveMotePalette();
    const normalizedSize = Number.isFinite(size) ? Math.max(1, size) : 1;
    const sizeRatio = clampUnitInterval((normalizedSize - 1) / Math.max(1, (this.maxDropSize || normalizedSize) - 1));
    const baseSand = { r: 255, g: 222, b: 137 };
    const shadowSand = { r: 204, g: 170, b: 82 };
    const highlight = mixRgbColors(baseSand, { r: 255, g: 255, b: 255 }, 0.35 + sizeRatio * 0.15);
    const body = mixRgbColors(shadowSand, highlight, 0.68 + sizeRatio * 0.2);
    const baseRestAlpha = Number.isFinite(palette?.restAlpha) ? palette.restAlpha : 0.9;
    const baseFreefallAlpha = Number.isFinite(palette?.freefallAlpha) ? palette.freefallAlpha : 0.6;
    const alpha = isFreefall
      ? Math.min(1, baseFreefallAlpha + 0.08)
      : Math.min(1, baseRestAlpha + 0.04);
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
