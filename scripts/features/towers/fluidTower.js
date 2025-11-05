/**
 * Fluid tower simulation module extracted from the powder tower bundle.
 * Provides the shallow-water style drop simulation used by the Bet Spire.
 */
import {
  DEFAULT_MOTE_PALETTE,
  MIN_MOTE_LANE_CELL_PX,
  POWDER_CELL_SIZE_PX,
  clampUnitInterval,
  colorToRgbaString,
  mergeMotePalette,
  resolvePaletteColorStops,
} from './powderTower.js'; // Reuse shared palette helpers from the powder tower module.

/**
 * Fluid simulation for the late-game mote basin.
 *
 * Rather than rendering discrete sand grains, this variant uses a
 * shallow-water inspired column model so drops merge into a continuous
 * surface that ripples and equalizes over time.
 */
export class FluidSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    const baseCellSize = Number.isFinite(options.cellSize) && options.cellSize > 0
      ? options.cellSize
      : POWDER_CELL_SIZE_PX;
    const deviceScale = window.devicePixelRatio || 1;
    this.cellSize = Math.max(1, Math.round(baseCellSize * deviceScale));
    this.deviceScale = deviceScale;

    this.onHeightChange = typeof options.onHeightChange === 'function' ? options.onHeightChange : null;
    this.onIdleBankChange = typeof options.onIdleBankChange === 'function' ? options.onIdleBankChange : null;
    this.onWallMetricsChange =
      typeof options.onWallMetricsChange === 'function' ? options.onWallMetricsChange : null;
    this.onViewTransformChange =
      typeof options.onViewTransformChange === 'function' ? options.onViewTransformChange : null;

    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.rows = 0;

    this.wallInsetLeftPx = Number.isFinite(options.wallInsetLeft) ? Math.max(0, options.wallInsetLeft) : 0;
    this.wallInsetRightPx = Number.isFinite(options.wallInsetRight) ? Math.max(0, options.wallInsetRight) : 0;
    this.wallInsetLeftCells = 0;
    this.wallInsetRightCells = 0;
    const attrWidth = this.canvas ? Number.parseFloat(this.canvas.getAttribute('width')) || 0 : 0;
    const referenceWidth = Number.isFinite(options.wallReferenceWidth)
      ? Math.max(options.wallReferenceWidth, this.cellSize)
      : attrWidth || 240;
    this.wallGapReferenceWidth = referenceWidth;
    this.wallGapReferenceCols = Math.max(1, Math.round(referenceWidth / this.cellSize));
    this.wallGapTargetUnits = Number.isFinite(options.wallGapCells)
      ? Math.max(1, options.wallGapCells)
      : null;
    const normalizedBaseGap = Number.isFinite(options.wallGapCells)
      ? Math.max(1, Math.round(options.wallGapCells))
      : 15;
    this.baseGapUnits = normalizedBaseGap;
    this.gapWidthRatio = Number.isFinite(options.gapWidthRatio) && options.gapWidthRatio > 0
      ? Math.max(0.05, Math.min(0.95, options.gapWidthRatio))
      : null;

    this.columnHeights = [];
    this.columnVelocities = [];
    this.flowBuffer = [];
    this.drops = [];
    this.pendingDrops = [];
    this.idleBank = 0;
    this.idleAccumulator = 0; // Track fractional idle drain progress so 1/sec stays 1/sec instead of 60/sec.
    this.idleDropBuffer = 0; // Converted idle volume waiting to be emitted as visible droplets.
    this.idleDropAccumulator = 0; // Release cadence timer for buffered droplets.
    this.rippleCarryover = 0; // Preserve fractional ripple volume so splash loops eventually settle.
    this.maxDropSize = 1;
    this.maxDropRadius = 1;
    this.largestDrop = 0;

    this.baseSpawnInterval = options.baseSpawnInterval && options.baseSpawnInterval > 0
      ? options.baseSpawnInterval
      : 160;
    this.spawnAccumulator = 0;

    this.waveStiffness = Number.isFinite(options.waveStiffness) ? Math.max(0.001, options.waveStiffness) : 0.18;
    this.waveDamping = Number.isFinite(options.waveDamping) ? Math.max(0, options.waveDamping) : 0.015;
    this.sideFlowRate = Number.isFinite(options.sideFlowRate) ? Math.max(0, options.sideFlowRate) : 0.45;
    this.rippleFrequency = Number.isFinite(options.rippleFrequency) ? Math.max(0, options.rippleFrequency) : 0.9;
    this.rippleAmplitude = Number.isFinite(options.rippleAmplitude) ? Math.max(0, options.rippleAmplitude) : 0.5;
    this.rippleTimer = 0;

    this.dropSizes = Array.isArray(options.dropSizes)
      ? options.dropSizes.filter((size) => Number.isFinite(size) && size > 0)
      : [1, 1, 2];
    if (!this.dropSizes.length) {
      this.dropSizes = [1, 1, 2];
    }
    this.dropVolumeScale = Number.isFinite(options.dropVolumeScale) ? Math.max(0.2, options.dropVolumeScale) : 0.75;

    this.maxDuneGain = Number.isFinite(options.maxDuneGain) ? Math.max(0, options.maxDuneGain) : 1;

    const fallbackPalette = options.fallbackMotePalette || DEFAULT_MOTE_PALETTE;
    this.motePalette = mergeMotePalette(options.motePalette || fallbackPalette);
    this.defaultProfile = {
      dropSizes: [...this.dropSizes],
      idleDrainRate: Number.isFinite(options.idleDrainRate) ? options.idleDrainRate : 0.2,
      baseSpawnInterval: this.baseSpawnInterval,
      waveStiffness: this.waveStiffness,
      waveDamping: this.waveDamping,
      sideFlowRate: this.sideFlowRate,
      rippleFrequency: this.rippleFrequency,
      rippleAmplitude: this.rippleAmplitude,
      dropVolumeScale: this.dropVolumeScale,
      maxDuneGain: this.maxDuneGain,
      palette: {
        ...this.motePalette,
        stops: Array.isArray(this.motePalette.stops)
          ? this.motePalette.stops.map((stop) => ({ ...stop }))
          : [],
      },
    };

    this.idleDrainRate = Number.isFinite(options.idleDrainRate) ? Math.max(0.2, options.idleDrainRate) : 0.2;
    this.flowOffset = 0;

    this.scrollThreshold = Number.isFinite(options.scrollThreshold)
      ? Math.max(0.2, Math.min(0.95, options.scrollThreshold))
      : 0.5;
    this.scrollOffset = 0;

    this.heightInfo = {
      normalizedHeight: 0,
      duneGain: 0,
      largestGrain: 0,
      visibleHeight: 0,
      totalHeight: 0,
      totalNormalized: 0,
      crestPosition: 1,
    };

    this.viewScale = 1;
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };

    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;

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
    const wasRunning = this.running;
    this.configureCanvas();
    if (!wasRunning) {
      this.render();
      this.updateHeightInfo(true);
    }
  }

  configureCanvas() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ratio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1;
    const rect = typeof this.canvas.getBoundingClientRect === 'function'
      ? this.canvas.getBoundingClientRect()
      : null;
    const parent = this.canvas.parentElement;
    const parentRect = parent && typeof parent.getBoundingClientRect === 'function'
      ? parent.getBoundingClientRect()
      : null;

    const measuredWidth = parentRect?.width || rect?.width || this.canvas.clientWidth || 240;
    const measuredHeight = parentRect?.height || rect?.height || this.canvas.clientHeight || 320;

    // Make the simulation square by using the smaller dimension for both width and height
    const squareDimension = Math.min(measuredWidth, measuredHeight);

    // Use consistent minimum of 200px for both dimensions to maintain square aspect ratio
    const styleWidth = `${Math.max(200, squareDimension)}px`;
    const styleHeight = `${Math.max(200, squareDimension)}px`;
    if (this.canvas.style.width !== styleWidth) {
      this.canvas.style.width = styleWidth;
    }
    if (this.canvas.style.height !== styleHeight) {
      this.canvas.style.height = styleHeight;
    }

    const targetWidth = Math.max(1, Math.floor(squareDimension * ratio));
    const targetHeight = Math.max(1, Math.floor(squareDimension * ratio));
    if (this.canvas.width !== targetWidth) {
      this.canvas.width = targetWidth;
    }
    if (this.canvas.height !== targetHeight) {
      this.canvas.height = targetHeight;
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);

    // Both dimensions use the same minimum (200px) to maintain square canvas
    this.width = Math.max(200, squareDimension);
    this.height = Math.max(200, squareDimension);

    if (!Number.isFinite(this.baseGapUnits) || this.baseGapUnits <= 0) {
      const fallbackGapUnits = Number.isFinite(this.wallGapTargetUnits)
        ? Math.max(1, Math.round(this.wallGapTargetUnits))
        : 15;
      this.baseGapUnits = fallbackGapUnits;
    }

    if (!Number.isFinite(this.gapWidthRatio) || this.gapWidthRatio <= 0) {
      const inferredGapWidth = Math.max(0, this.width - this.wallInsetLeftPx - this.wallInsetRightPx);
      const ratioCandidate = this.width > 0 ? inferredGapWidth / this.width : 0;
      this.gapWidthRatio = Math.max(0.1, Math.min(0.9, ratioCandidate || 0.6));
    }

    // Keep the fluid mote lane consistent with the sand view by enforcing the shared cell floor.
    const minimumGapCellSize = MIN_MOTE_LANE_CELL_PX;
    // Scale the lane using the viewport ratio but never shrink below the readable width threshold.
    const ratioDerivedCellSize = Math.max(
      1,
      Math.round((this.width * this.gapWidthRatio) / Math.max(1, this.baseGapUnits)),
    );
    let desiredCellSize = Math.max(minimumGapCellSize, ratioDerivedCellSize);
    // Avoid overflowing the viewport when the widened gap approaches the canvas bounds.
    const maximumCellSize = Math.max(1, Math.floor(this.width / Math.max(1, this.baseGapUnits)));
    desiredCellSize = Math.min(desiredCellSize, maximumCellSize);
    // Synchronize the walkway width with the resolved cell size so the DOM walls stay aligned.
    const walkwayWidth = Math.max(1, desiredCellSize * this.baseGapUnits);
    this.cellSize = desiredCellSize;
    this.wallGapReferenceWidth = walkwayWidth;
    this.wallGapReferenceCols = Math.max(1, Math.round(this.wallGapReferenceWidth / this.cellSize));

    this.cols = Math.max(8, Math.floor(this.width / this.cellSize));
    this.rows = Math.max(8, Math.floor(this.height / this.cellSize));

    const leftUnits = Math.max(0, Math.floor(this.wallInsetLeftPx / this.cellSize));
    const rightUnits = Math.max(0, Math.floor(this.wallInsetRightPx / this.cellSize));
    this.wallInsetLeftCells = Math.min(Math.max(0, leftUnits), this.cols - 1);
    this.wallInsetRightCells = Math.min(Math.max(0, rightUnits), this.cols - 1);

    this.columnHeights = new Array(this.cols).fill(0);
    this.columnVelocities = new Array(this.cols).fill(0);
    this.flowBuffer = new Array(this.cols).fill(0);

    this.updateMaxDropSize();
    this.notifyWallMetricsChange();
    this.updateHeightInfo(true);
    this.notifyViewTransformChange();
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
      gapPixels: Math.max(0, this.width - this.wallInsetLeftCells * this.cellSize - this.wallInsetRightCells * this.cellSize),
      wallGapReferenceWidth: this.wallGapReferenceWidth,
      wallGapReferenceCols: this.wallGapReferenceCols,
      cellSize: this.cellSize,
      rows: this.rows,
      cols: this.cols,
      width: this.width,
      height: this.height,
    };
  }

  setWallInset(leftPixels, rightPixels) {
    const left = Number.isFinite(leftPixels) ? Math.max(0, leftPixels) : 0;
    const right = Number.isFinite(rightPixels) ? Math.max(0, rightPixels) : 0;
    if (left === this.wallInsetLeftPx && right === this.wallInsetRightPx) {
      return;
    }
    this.wallInsetLeftPx = left;
    this.wallInsetRightPx = right;
    this.configureCanvas();
    this.notifyWallMetricsChange();
  }

  setWallGapReferenceWidth(width) {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    this.wallGapReferenceWidth = width;
    this.wallGapReferenceCols = Math.max(1, Math.round(width / this.cellSize));
    this.notifyWallMetricsChange();
  }

  setWallGapTargetUnits(units) {
    if (!Number.isFinite(units) || units <= 0) {
      this.wallGapTargetUnits = null;
      this.notifyWallMetricsChange();
      return;
    }
    this.setWallGapTarget(units);
  }

  // Re-balance the interior lane so DOM walls track the simulation gap.
  setWallGapTarget(gapCells, options = {}) {
    if (!Number.isFinite(gapCells) || gapCells <= 0) {
      this.wallGapTargetUnits = null;
      return false;
    }

    const targetUnits = Math.max(1, Math.round(gapCells));
    const previousLeft = this.wallInsetLeftCells;
    const previousRight = this.wallInsetRightCells;

    const activeCols = Math.max(1, this.cols || Math.round(this.width / Math.max(1, this.cellSize)) || targetUnits);
    const clampedGap = Math.max(1, Math.min(targetUnits, activeCols));
    const totalInset = Math.max(0, activeCols - clampedGap);
    const nextLeft = Math.floor(totalInset / 2);
    const nextRight = totalInset - nextLeft;

    this.wallGapTargetUnits = clampedGap;
    this.baseGapUnits = clampedGap;
    this.wallGapReferenceCols = clampedGap;
    this.wallGapReferenceWidth = clampedGap * this.cellSize;

    this.wallInsetLeftCells = nextLeft;
    this.wallInsetRightCells = nextRight;
    this.wallInsetLeftPx = nextLeft * this.cellSize;
    this.wallInsetRightPx = nextRight * this.cellSize;

    this.updateMaxDropSize();

    const changed = nextLeft !== previousLeft || nextRight !== previousRight;

    if (options?.skipRebuild) {
      this.notifyWallMetricsChange();
      return changed;
    }

    this.updateHeightInfo(true);
    this.render();
    this.notifyWallMetricsChange();
    return changed;
  }

  updateMaxDropSize() {
    this.maxDropSize = Math.max(1, Math.floor(Math.max(this.width, this.height) / 40));
    this.maxDropRadius = this.maxDropSize;
  }

  // Compute the pixel span between the inner walls for spawning droplets.
  getGapBounds() {
    const start = this.wallInsetLeftCells * this.cellSize;
    const end = Math.max(start, this.width - this.wallInsetRightCells * this.cellSize);
    return { start, end };
  }

  addDrop(x, size = 1) {
    const radius = Math.max(1, Math.min(this.maxDropRadius, size)) * this.cellSize * 0.5;
    const drop = {
      x: Math.max(0, Math.min(this.width, x ?? this.width * Math.random())),
      y: -radius,
      size: Math.max(1, Math.min(this.maxDropSize, Math.round(size))),
      radius,
      velocity: 0,
    };
    this.pendingDrops.push(drop);
  }

  // Accept queued drops from the host UI and translate them into falling droplets.
  queueDrop(dropLike) {
    if (dropLike === null || dropLike === undefined) {
      return;
    }
    const sizeValue = typeof dropLike === 'number'
      ? dropLike
      : Number.isFinite(dropLike.size)
        ? dropLike.size
        : 1;
    const size = Math.max(1, Math.round(sizeValue));
    const bounds = this.getGapBounds();
    const span = Math.max(1, bounds.end - bounds.start);
    const requestedX = typeof dropLike === 'object' && dropLike !== null && Number.isFinite(dropLike.x)
      ? dropLike.x
      : null;
    const dropX = requestedX === null
      ? bounds.start + Math.random() * span
      : Math.max(bounds.start, Math.min(bounds.end, requestedX));
    this.addDrop(dropX, size);
  }

  spawnPendingDrops(limit = Infinity) {
    if (!this.pendingDrops.length) {
      return;
    }
    const count = Math.min(limit, this.pendingDrops.length);
    for (let index = 0; index < count; index += 1) {
      const drop = this.pendingDrops.shift();
      if (!drop) {
        continue;
      }
      const scaledRadius = Math.max(1, drop.radius * this.dropVolumeScale);
      this.drops.push({
        x: drop.x,
        y: drop.y,
        radius: scaledRadius,
        size: drop.size,
        velocity: drop.velocity,
      });
    }
  }

  clearDrops() {
    this.drops.length = 0;
    this.pendingDrops.length = 0;
    this.rippleCarryover = 0; // Flush splash residue so new runs start with a calm surface.
  }

  convertIdleBank(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return 0;
    }
    if (this.idleBank <= 0) {
      if (this.idleDropBuffer <= 0) {
        this.idleAccumulator = 0;
      }
      return 0;
    }

    const ratePerMs = Math.max(0, this.idleDrainRate) / 1000;
    if (ratePerMs <= 0) {
      return 0;
    }

    this.idleAccumulator += deltaMs * ratePerMs;
    const availableBank = Math.floor(Math.max(0, this.idleBank));
    const toQueue = Math.max(0, Math.min(availableBank, Math.floor(this.idleAccumulator)));

    if (toQueue <= 0) {
      return 0;
    }

    this.idleAccumulator -= toQueue;
    this.idleBank = Math.max(0, this.idleBank - toQueue);
    if (this.idleBank < 1e-6) {
      this.idleBank = 0;
    }
    this.notifyIdleBankChange();
    this.idleDropBuffer = Math.max(0, this.idleDropBuffer + toQueue);
    return toQueue;
  }

  releaseIdleDrops(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return 0;
    }

    const availableBuffer = Math.floor(Math.max(0, this.idleDropBuffer));
    if (availableBuffer <= 0) {
      if (this.idleDropBuffer <= 0 && this.idleBank <= 0) {
        this.idleDropAccumulator = 0;
      }
      return 0;
    }

    // Use a fixed slower release interval to prevent exponential spawn from double rate application
    // Calculate interval from idleDrainRate: if rate is 0.2 drops/sec, interval is 5000ms per drop
    const drainRate = Math.max(0.05, this.idleDrainRate);
    const baseReleaseInterval = Math.max(1000, 1000 / drainRate);
    
    this.idleDropAccumulator += deltaMs;
    
    if (this.idleDropAccumulator < baseReleaseInterval) {
      return 0;
    }

    // Release one drop per interval
    const intervalsElapsed = Math.floor(this.idleDropAccumulator / baseReleaseInterval);
    const toRelease = Math.max(0, Math.min(availableBuffer, intervalsElapsed));

    if (toRelease <= 0) {
      return 0;
    }

    // Use modulo to prevent timing drift across multiple intervals
    this.idleDropAccumulator %= baseReleaseInterval;
    this.idleDropBuffer = Math.max(0, this.idleDropBuffer - toRelease);

    const bounds = this.getGapBounds();
    const span = Math.max(1, bounds.end - bounds.start);
    const center = bounds.start + span / 2;
    const jitterRange = span * 0.3;

    for (let index = 0; index < toRelease; index += 1) {
      const dropSize = this.dropSizes[Math.floor(Math.random() * this.dropSizes.length)] || 1;
      const normalizedIndex = toRelease > 1 ? index / (toRelease - 1) : 0.5;
      const jitter = (normalizedIndex - 0.5) * jitterRange + (Math.random() - 0.5) * jitterRange * 0.2;
      const dropX = Math.max(bounds.start, Math.min(bounds.end, center + jitter));
      this.addDrop(dropX, dropSize);
    }

    return toRelease;
  }

  // Emit natural droplets using the reservoir buffer without exceeding the idle drain cadence.
  spawnAmbientDrops(deltaMs, releasedThisFrame = 0) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return;
    }

    const availableReservoir = Math.floor(Math.max(0, this.idleDropBuffer));
    if (availableReservoir <= 0 || releasedThisFrame > 0) {
      this.spawnAccumulator = 0;
      return;
    }

    const drainRate = Math.max(0, this.idleDrainRate);
    if (drainRate <= 0) {
      return;
    }

    const baseInterval = Math.max(480, this.baseSpawnInterval * 2);
    const rateInterval = 1000 / drainRate;
    const interval = Math.max(baseInterval, rateInterval);

    this.spawnAccumulator += deltaMs;
    if (this.spawnAccumulator < interval) {
      return;
    }

    this.spawnAccumulator -= interval;

    const bounds = this.getGapBounds();
    const dropSize = this.dropSizes[Math.floor(Math.random() * this.dropSizes.length)] || 1;
    const span = Math.max(1, bounds.end - bounds.start);
    const dropX = bounds.start + Math.random() * span;
    this.addDrop(dropX, dropSize);

    this.idleDropBuffer = Math.max(0, this.idleDropBuffer - 1);
    this.idleDropAccumulator = Math.max(0, this.idleDropAccumulator - 1);
  }

  addIdleVolume(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.idleBank += amount;
    this.notifyIdleBankChange();
  }

  // Mirror the sand simulation API so idle banks hydrate the Bet Spire.
  addIdleMotes(amount) {
    this.addIdleVolume(amount);
  }

  updateDrops(deltaMs) {
    if (!this.drops.length) {
      return;
    }
    const gravity = Math.max(50, Math.min(400, this.height * 1.5));
    for (const drop of this.drops) {
      drop.velocity += (gravity * deltaMs) / 1000;
      drop.y += (drop.velocity * deltaMs) / 1000;
      const surfaceY = this.getSurfaceHeightAt(drop.x);
      if (drop.y + drop.radius >= surfaceY) {
        this.depositDrop(drop);
      }
    }
    this.drops = this.drops.filter((drop) => drop.y - drop.radius < this.height);
  }

  getSurfaceHeightAt(x) {
    if (this.cols <= 0) {
      return this.height;
    }
    const index = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
    const height = this.columnHeights[index] || 0;
    return Math.max(0, this.height - height * this.cellSize);
  }

  depositDrop(drop) {
    if (!drop || !Number.isFinite(drop.x)) {
      return;
    }
    const index = Math.max(0, Math.min(this.cols - 1, Math.floor(drop.x / this.cellSize)));
    // Add the drop's volume to the water column exactly once
    const amount = Math.max(0.1, drop.size * this.dropVolumeScale);
    this.columnHeights[index] = Math.max(0, (this.columnHeights[index] || 0) + amount);
    this.columnVelocities[index] = Math.max(0, this.columnVelocities[index] || 0);
    this.largestDrop = Math.max(this.largestDrop, drop.size);

    // Ripple drop spawning disabled to prevent exponential multiplication
    // The ripple effect is handled through wave physics in simulateFluid()
    // instead of spawning new drops that would create feedback loops
  }

  simulateFluid(deltaMs) {
    if (this.cols <= 0) {
      return;
    }
    const dt = Math.min(0.25, Math.max(0.016, deltaMs / 1000));
    const stiffness = Math.max(0.001, this.waveStiffness);
    const damping = Math.max(0, this.waveDamping);
    const sideFlow = Math.max(0, this.sideFlowRate);
    const rippleFrequency = Math.max(0, this.rippleFrequency);
    const rippleAmplitude = Math.max(0, this.rippleAmplitude);

    const activeStart = this.wallInsetLeftCells;
    const activeEnd = this.cols - this.wallInsetRightCells - 1;
    if (activeEnd <= activeStart) {
      return;
    }

    this.flowBuffer.fill(0);

    for (let index = activeStart; index <= activeEnd; index += 1) {
      const leftIndex = Math.max(activeStart, index - 1);
      const rightIndex = Math.min(activeEnd, index + 1);
      const leftHeight = this.columnHeights[leftIndex] || 0;
      const rightHeight = this.columnHeights[rightIndex] || 0;
      const currentHeight = this.columnHeights[index] || 0;

      const leftDelta = leftHeight - currentHeight;
      const rightDelta = rightHeight - currentHeight;
      const acceleration = (leftDelta + rightDelta) * stiffness;
      const velocity = (this.columnVelocities[index] || 0) + acceleration * dt;
      const dampedVelocity = velocity * (1 - damping);

      const ripple = Math.sin((this.rippleTimer + index * 0.2) * rippleFrequency) * rippleAmplitude;
      const flow = (leftDelta + rightDelta) * sideFlow + ripple;

      this.columnVelocities[index] = dampedVelocity;
      this.flowBuffer[index] = (dampedVelocity + flow) * dt;
    }

    this.rippleTimer += dt;

    for (let index = activeStart; index <= activeEnd; index += 1) {
      this.columnHeights[index] = Math.max(0, (this.columnHeights[index] || 0) + this.flowBuffer[index]);
    }
  }

  update(deltaMs) {
    if (!this.ctx) {
      return;
    }
    this.convertIdleBank(deltaMs);
    const releasedDrops = this.releaseIdleDrops(deltaMs);
    // Disabled spawnAmbientDrops as it creates duplicate drops beyond the configured rate
    // this.spawnAmbientDrops(deltaMs, releasedDrops);
    const spawnBudget = Math.max(1, Math.ceil(deltaMs / Math.max(30, this.baseSpawnInterval / 4)));
    this.spawnPendingDrops(spawnBudget);
    this.updateDrops(deltaMs);
    this.simulateFluid(deltaMs);
    this.applyScrollIfNeeded();
    this.updateHeightInfo();
    this.render();
  }

  applyScrollIfNeeded() {
    const activeStart = this.wallInsetLeftCells;
    const activeEnd = this.cols - this.wallInsetRightCells - 1;
    if (activeEnd <= activeStart) {
      return;
    }

    let highest = 0;
    for (let index = activeStart; index <= activeEnd; index += 1) {
      highest = Math.max(highest, this.columnHeights[index] || 0);
    }

    if (highest <= 0 || this.rows <= 0) {
      return;
    }

    const threshold = Math.max(0.2, Math.min(0.95, this.scrollThreshold));
    const targetFromTop = this.rows * (1 - threshold);
    const currentFromTop = this.rows - highest;

    if (currentFromTop < targetFromTop) {
      const shift = targetFromTop - currentFromTop;
      this.scrollOffset = Math.max(0, this.scrollOffset + shift);
    }
  }

  updateHeightInfo(force = false) {
    const activeStart = this.wallInsetLeftCells;
    const activeEnd = this.cols - this.wallInsetRightCells - 1;
    let highest = 0;
    for (let index = activeStart; index <= activeEnd; index += 1) {
      highest = Math.max(highest, this.columnHeights[index] || 0);
    }
    const visibleHeight = highest;
    const normalized = this.rows > 0 ? Math.min(1, visibleHeight / this.rows) : 0;
    const crestIndex = (() => {
      if (highest <= 0) {
        return activeEnd;
      }
      let candidate = activeStart;
      let bestHeight = -Infinity;
      for (let index = activeStart; index <= activeEnd; index += 1) {
        const height = this.columnHeights[index] || 0;
        if (height > bestHeight) {
          bestHeight = height;
          candidate = index;
        }
      }
      return candidate;
    })();
    const crestPosition = this.cols > 0 ? Math.max(0, Math.min(1, crestIndex / this.cols)) : 0;

    const totalHeight = visibleHeight + this.scrollOffset;
    const totalNormalized = this.rows > 0 ? Math.min(2, totalHeight / this.rows) : 0;

    const info = {
      normalizedHeight: normalized,
      duneGain: Math.min(this.maxDuneGain, normalized * this.maxDuneGain),
      largestGrain: this.largestDrop,
      scrollOffset: this.scrollOffset,
      visibleHeight,
      totalHeight,
      totalNormalized,
      crestPosition,
      rows: this.rows,
      cols: this.cols,
      cellSize: this.cellSize,
      highestNormalized: totalNormalized,
    };

    const previous = this.heightInfo || {};
    const changed =
      previous.normalizedHeight !== info.normalizedHeight ||
      previous.duneGain !== info.duneGain ||
      previous.largestGrain !== info.largestGrain ||
      previous.visibleHeight !== info.visibleHeight;
    this.heightInfo = info;
    if (this.onHeightChange && (force || changed)) {
      this.onHeightChange(info);
    }
  }

  render() {
    if (!this.ctx) {
      return;
    }
    const palette = this.getEffectiveMotePalette();
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, palette.backgroundTop || '#07111f');
    gradient.addColorStop(1, palette.backgroundBottom || '#0d1b2e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const gapStart = this.wallInsetLeftCells * this.cellSize;
    const gapEnd = this.width - this.wallInsetRightCells * this.cellSize;

    // Draw visible walls on left and right sides
    const wallColor = 'rgba(180, 180, 180, 0.3)'; // Light gray chalk-like color
    // Left wall
    if (this.wallInsetLeftCells > 0) {
      this.ctx.fillStyle = wallColor;
      this.ctx.fillRect(0, 0, gapStart, this.height);
    }
    // Right wall
    if (this.wallInsetRightCells > 0) {
      this.ctx.fillStyle = wallColor;
      this.ctx.fillRect(gapEnd, 0, this.width - gapEnd, this.height);
    }
    const waterGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    const stops = resolvePaletteColorStops(palette);
    const restAlpha = clampUnitInterval(palette.restAlpha ?? 0.8);
    const freefallAlpha = clampUnitInterval(palette.freefallAlpha ?? 0.55);
    waterGradient.addColorStop(0, colorToRgbaString({ ...stops[stops.length - 1], a: restAlpha }));
    waterGradient.addColorStop(1, colorToRgbaString({ ...stops[0], a: restAlpha }));

    this.ctx.beginPath();
    this.ctx.moveTo(gapStart, this.height);
    for (let x = gapStart; x <= gapEnd; x += this.cellSize) {
      const surfaceY = this.getSurfaceHeightAt(x);
      this.ctx.lineTo(x, surfaceY);
    }
    this.ctx.lineTo(gapEnd, this.height);
    this.ctx.closePath();
    this.ctx.fillStyle = waterGradient;
    this.ctx.fill();

    this.ctx.strokeStyle = colorToRgbaString({ ...stops[stops.length - 1], a: Math.max(restAlpha, 0.85) });
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    let first = true;
    for (let x = gapStart; x <= gapEnd; x += Math.max(1, this.cellSize / 2)) {
      const surfaceY = this.getSurfaceHeightAt(x);
      if (first) {
        this.ctx.moveTo(x, surfaceY);
        first = false;
      } else {
        this.ctx.lineTo(x, surfaceY);
      }
    }
    this.ctx.stroke();

    const dropColor = colorToRgbaString({ ...stops[stops.length - 1], a: freefallAlpha });
    for (const drop of this.drops) {
      if (drop.y - drop.radius > this.height || drop.y + drop.radius < 0) {
        continue;
      }
      this.ctx.beginPath();
      this.ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = dropColor;
      this.ctx.fill();
    }
  }

  // Provide a stable camera interface so powder UI overlays can reuse shared gestures.
  getViewCenterWorld() {
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    const center = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    return {
      x: width * center.x,
      y: height * center.y,
    };
  }

  // Report the active camera transform (static for the Bet Spire) to the host UI.
  getViewTransform() {
    const width = this.width || this.canvas?.clientWidth || 0;
    const height = this.height || this.canvas?.clientHeight || 0;
    return {
      width,
      height,
      scale: this.viewScale,
      center: this.getViewCenterWorld(),
      normalizedCenter: { ...(this.viewCenterNormalized || { x: 0.5, y: 0.5 }) },
    };
  }

  // Synchronize transform updates with the powder UI bridge.
  notifyViewTransformChange() {
    if (typeof this.onViewTransformChange === 'function') {
      this.onViewTransformChange(this.getViewTransform());
    }
  }

  // Accept normalized camera centers even though the Bet Spire keeps a static viewpoint.
  setViewCenterNormalized(normalized) {
    const next = {
      x: Number.isFinite(normalized?.x) ? Math.max(0, Math.min(1, normalized.x)) : 0.5,
      y: Number.isFinite(normalized?.y) ? Math.max(0, Math.min(1, normalized.y)) : 0.5,
    };
    if (
      this.viewCenterNormalized &&
      Math.abs(this.viewCenterNormalized.x - next.x) < 0.0001 &&
      Math.abs(this.viewCenterNormalized.y - next.y) < 0.0001
    ) {
      return;
    }
    this.viewCenterNormalized = next;
    this.notifyViewTransformChange();
  }

  // Translate world-space coordinates into normalized camera positions.
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

  // Maintain API parity with the sand basin while clamping to a limited zoom window.
  applyZoomFactor(factor) {
    if (!Number.isFinite(factor) || factor <= 0) {
      return false;
    }
    const previous = Number.isFinite(this.viewScale) && this.viewScale > 0 ? this.viewScale : 1;
    const next = Math.max(0.5, Math.min(1.5, previous * factor));
    if (Math.abs(next - previous) < 0.0001) {
      return false;
    }
    this.viewScale = next;
    this.notifyViewTransformChange();
    return true;
  }

  // Persist reservoir state so mode switches and reloads restore the water profile.
  exportState() {
    return {
      version: 1,
      columns: Array.isArray(this.columnHeights) ? [...this.columnHeights] : [],
      velocities: Array.isArray(this.columnVelocities) ? [...this.columnVelocities] : [],
      idleBank: Math.max(0, this.idleBank || 0),
      pendingDrops: Array.isArray(this.pendingDrops)
        ? this.pendingDrops.map((drop) => ({ ...drop }))
        : [],
      drops: Array.isArray(this.drops) ? this.drops.map((drop) => ({ ...drop })) : [],
      baseGapUnits: this.baseGapUnits,
      wallInsetLeftCells: this.wallInsetLeftCells,
      wallInsetRightCells: this.wallInsetRightCells,
      scrollOffset: this.scrollOffset || 0,
      motePalette: this.motePalette
        ? {
            ...this.motePalette,
            stops: Array.isArray(this.motePalette.stops)
              ? this.motePalette.stops.map((stop) => ({ ...stop }))
              : [],
          }
        : null,
    };
  }

  // Restore a serialized reservoir snapshot captured during mode swaps or saves.
  importState(state) {
    if (!state || typeof state !== 'object') {
      return false;
    }

    let applied = false;

    if (Array.isArray(state.columns) && state.columns.length && Array.isArray(this.columnHeights)) {
      const limit = Math.min(this.columnHeights.length, state.columns.length);
      for (let index = 0; index < limit; index += 1) {
        this.columnHeights[index] = Math.max(0, state.columns[index] || 0);
      }
      for (let index = limit; index < this.columnHeights.length; index += 1) {
        this.columnHeights[index] = Math.max(0, this.columnHeights[index] || 0);
      }
      applied = true;
    }

    if (Array.isArray(state.velocities) && state.velocities.length && Array.isArray(this.columnVelocities)) {
      const limit = Math.min(this.columnVelocities.length, state.velocities.length);
      for (let index = 0; index < limit; index += 1) {
        this.columnVelocities[index] = Number.isFinite(state.velocities[index])
          ? state.velocities[index]
          : this.columnVelocities[index];
      }
      applied = true;
    }

    if (Array.isArray(state.pendingDrops)) {
      this.pendingDrops = state.pendingDrops
        .map((drop) => ({ ...drop }))
        .filter((drop) => Number.isFinite(drop?.size) && drop.size > 0);
      applied = true;
    }

    if (Array.isArray(state.drops)) {
      this.drops = state.drops
        .map((drop) => ({ ...drop }))
        .filter((drop) => Number.isFinite(drop?.size) && drop.size > 0);
      applied = true;
    }

    if (Number.isFinite(state.idleBank)) {
      this.idleBank = Math.max(0, state.idleBank);
      this.notifyIdleBankChange();
      applied = true;
    }

    if (Number.isFinite(state.baseGapUnits) && state.baseGapUnits > 0) {
      this.setWallGapTarget(state.baseGapUnits, { skipRebuild: true });
      applied = true;
    }

    if (Number.isFinite(state.wallInsetLeftCells) || Number.isFinite(state.wallInsetRightCells)) {
      const left = Number.isFinite(state.wallInsetLeftCells) ? Math.max(0, state.wallInsetLeftCells) : this.wallInsetLeftCells;
      const right = Number.isFinite(state.wallInsetRightCells) ? Math.max(0, state.wallInsetRightCells) : this.wallInsetRightCells;
      this.wallInsetLeftCells = left;
      this.wallInsetRightCells = right;
      this.wallInsetLeftPx = left * this.cellSize;
      this.wallInsetRightPx = right * this.cellSize;
      applied = true;
    }

    if (state.motePalette) {
      this.setMotePalette(state.motePalette);
      applied = true;
    }

    if (Number.isFinite(state.scrollOffset)) {
      this.scrollOffset = Math.max(0, state.scrollOffset);
      applied = true;
    }

    if (applied) {
      this.notifyWallMetricsChange();
      this.updateHeightInfo(true);
      this.render();
      this.notifyViewTransformChange();
    }

    return applied;
  }

  getEffectiveMotePalette() {
    if (!this.motePalette) {
      this.motePalette = mergeMotePalette(DEFAULT_MOTE_PALETTE);
    }
    return this.motePalette;
  }

  getStatus() {
    return this.heightInfo;
  }

  applyProfile(profile = {}) {
    if (!profile || typeof profile !== 'object') {
      return;
    }
    if (Array.isArray(profile.dropSizes) && profile.dropSizes.length) {
      this.dropSizes = profile.dropSizes
        .map((size) => (Number.isFinite(size) && size > 0 ? Math.round(size) : null))
        .filter((size) => Number.isFinite(size) && size > 0);
      if (!this.dropSizes.length) {
        this.dropSizes = [1, 1, 2];
      }
    }
    if (Number.isFinite(profile.dropVolumeScale) && profile.dropVolumeScale > 0) {
      this.dropVolumeScale = Math.max(0.2, profile.dropVolumeScale);
    }
    if (Number.isFinite(profile.idleDrainRate) && profile.idleDrainRate > 0) {
      this.idleDrainRate = profile.idleDrainRate;
    }
    if (Number.isFinite(profile.baseSpawnInterval) && profile.baseSpawnInterval > 0) {
      this.baseSpawnInterval = profile.baseSpawnInterval;
    }
    if (Number.isFinite(profile.maxDuneGain) && profile.maxDuneGain >= 0) {
      this.maxDuneGain = profile.maxDuneGain;
    }
    if (Number.isFinite(profile.waveStiffness) && profile.waveStiffness > 0) {
      this.waveStiffness = profile.waveStiffness;
    }
    if (Number.isFinite(profile.waveDamping) && profile.waveDamping >= 0) {
      this.waveDamping = profile.waveDamping;
    }
    if (Number.isFinite(profile.sideFlowRate) && profile.sideFlowRate >= 0) {
      this.sideFlowRate = profile.sideFlowRate;
    }
    if (Number.isFinite(profile.rippleFrequency) && profile.rippleFrequency >= 0) {
      this.rippleFrequency = profile.rippleFrequency;
    }
    if (Number.isFinite(profile.rippleAmplitude) && profile.rippleAmplitude >= 0) {
      this.rippleAmplitude = profile.rippleAmplitude;
    }
    if (profile.palette) {
      this.setMotePalette(profile.palette);
    }
    this.updateMaxDropSize();
  }

  getDefaultProfile() {
    if (!this.defaultProfile) {
      return null;
    }
    const {
      dropSizes,
      idleDrainRate,
      baseSpawnInterval,
      waveStiffness,
      waveDamping,
      sideFlowRate,
      rippleFrequency,
      rippleAmplitude,
      dropVolumeScale,
      maxDuneGain,
      palette,
    } = this.defaultProfile;
    return {
      dropSizes: Array.isArray(dropSizes) ? [...dropSizes] : null,
      idleDrainRate,
      baseSpawnInterval,
      waveStiffness,
      waveDamping,
      sideFlowRate,
      rippleFrequency,
      rippleAmplitude,
      dropVolumeScale,
      maxDuneGain,
      palette: palette
        ? {
            ...palette,
            stops: Array.isArray(palette.stops) ? palette.stops.map((stop) => ({ ...stop })) : [],
          }
        : null,
    };
  }

  setMotePalette(palette) {
    this.motePalette = mergeMotePalette(palette);
  }

  setFlowOffset(offset) {
    if (!Number.isFinite(offset)) {
      return;
    }
    this.flowOffset = Math.max(0, offset);
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
}
