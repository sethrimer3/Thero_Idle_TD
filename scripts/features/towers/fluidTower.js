/**
 * Fluid tower simulation module extracted from the powder tower bundle.
 * Provides the shallow-water style drop simulation used by the Fluid Study.
 */
import {
  DEFAULT_MOTE_PALETTE,
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
    this.onWallMetricsChange =
      typeof options.onWallMetricsChange === 'function' ? options.onWallMetricsChange : null;

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

    this.columnHeights = [];
    this.columnVelocities = [];
    this.flowBuffer = [];
    this.drops = [];
    this.pendingDrops = [];
    this.idleBank = 0;
    this.idleAccumulator = 0;
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

    const fallbackPalette = options.fallbackMotePalette || DEFAULT_MOTE_PALETTE;
    this.motePalette = mergeMotePalette(options.motePalette || fallbackPalette);
    this.defaultProfile = {
      dropSizes: [...this.dropSizes],
      idleDrainRate: Number.isFinite(options.idleDrainRate) ? options.idleDrainRate : 1.2,
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

    this.idleDrainRate = Number.isFinite(options.idleDrainRate) ? Math.max(0.1, options.idleDrainRate) : 1.2;
    this.flowOffset = 0;

    this.heightInfo = {
      normalizedHeight: 0,
      duneGain: 0,
      largestGrain: 0,
      visibleHeight: 0,
      totalHeight: 0,
      totalNormalized: 0,
      crestPosition: 1,
    };

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

    const styleWidth = `${Math.max(200, measuredWidth)}px`;
    const styleHeight = `${Math.max(260, measuredHeight)}px`;
    if (this.canvas.style.width !== styleWidth) {
      this.canvas.style.width = styleWidth;
    }
    if (this.canvas.style.height !== styleHeight) {
      this.canvas.style.height = styleHeight;
    }

    const targetWidth = Math.max(1, Math.floor(measuredWidth * ratio));
    const targetHeight = Math.max(1, Math.floor(measuredHeight * ratio));
    if (this.canvas.width !== targetWidth) {
      this.canvas.width = targetWidth;
    }
    if (this.canvas.height !== targetHeight) {
      this.canvas.height = targetHeight;
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);

    this.width = Math.max(200, measuredWidth);
    this.height = Math.max(260, measuredHeight);
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
      gapPixels: Math.max(0, this.width - this.wallInsetLeftCells * this.cellSize - this.wallInsetRightCells * this.cellSize),
      wallGapReferenceWidth: this.wallGapReferenceWidth,
      wallGapReferenceCols: this.wallGapReferenceCols,
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
    this.wallGapTargetUnits = Math.max(1, Math.round(units));
    this.notifyWallMetricsChange();
  }

  updateMaxDropSize() {
    this.maxDropSize = Math.max(1, Math.floor(Math.max(this.width, this.height) / 40));
    this.maxDropRadius = this.maxDropSize;
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
  }

  convertIdleBank(deltaMs) {
    if (this.idleBank <= 0 || deltaMs <= 0) {
      return;
    }
    const drainRate = Math.max(0.1, this.idleDrainRate);
    const drainAmount = Math.min(this.idleBank, (drainRate * deltaMs) / 1000);
    this.idleBank -= drainAmount;
    const spawnInterval = Math.max(30, this.baseSpawnInterval * 0.8);
    const dropCount = Math.max(1, Math.round((drainAmount * 1000) / spawnInterval));
    for (let index = 0; index < dropCount; index += 1) {
      const dropSize = this.dropSizes[Math.floor(Math.random() * this.dropSizes.length)] || 1;
      const offset = (index / dropCount - 0.5) * this.width * 0.3;
      this.addDrop(this.width / 2 + offset, dropSize);
    }
  }

  addIdleVolume(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.idleBank += amount;
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
    const amount = Math.max(1, drop.size);
    this.columnHeights[index] = Math.max(0, (this.columnHeights[index] || 0) + amount);
    this.columnVelocities[index] = Math.max(0, this.columnVelocities[index] || 0);
    this.largestDrop = Math.max(this.largestDrop, amount);
    this.pendingDrops.push({
      x: drop.x + (Math.random() - 0.5) * this.cellSize,
      y: -drop.radius * 0.5,
      size: Math.max(1, Math.round(amount * 0.7)),
      radius: drop.radius * 0.7,
      velocity: 0,
    });
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
    const spawnBudget = Math.max(1, Math.ceil(deltaMs / Math.max(30, this.baseSpawnInterval / 4)));
    this.spawnPendingDrops(spawnBudget);
    this.updateDrops(deltaMs);
    this.simulateFluid(deltaMs);
    this.updateHeightInfo();
    this.render();
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

    const info = {
      normalizedHeight: normalized,
      duneGain: Math.min(this.maxDuneGain, normalized * this.maxDuneGain),
      largestGrain: this.largestDrop,
      scrollOffset: 0,
      visibleHeight,
      totalHeight: visibleHeight,
      totalNormalized: normalized,
      crestPosition,
      rows: this.rows,
      cols: this.cols,
      cellSize: this.cellSize,
      highestNormalized: normalized,
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
