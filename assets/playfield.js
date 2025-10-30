// Playfield gameplay class extracted from the main bundle for reuse across entry points.
import { createAlephChainRegistry } from '../scripts/features/towers/alephChain.js';
import { formatGameNumber } from '../scripts/core/formatting.js';
import { convertMathExpressionToPlainText } from '../scripts/core/mathText.js';
import {
  playTowerPlacementNotes,
} from './audioSystem.js';
import {
  getTowerDefinition,
  getNextTowerId,
  isTowerUnlocked,
  refreshTowerLoadoutDisplay,
  cancelTowerDrag,
  getTowerEquationBlueprint,
  getTowerLoadoutState,
  openTowerUpgradeOverlay,
} from './towersTab.js';
import {
  moteGemState,
  MOTE_GEM_COLLECTION_RADIUS,
  collectMoteGemsWithinRadius,
  collectMoteGemDrop,
  spawnMoteGemDrop,
  resetActiveMoteGems,
  resolveEnemyGemDropMultiplier,
  getGemSpriteImage,
} from './enemies.js';
import {
  registerEnemyEncounter,
  getEnemyCodexEntry,
} from './codex.js';
import { levelConfigs } from './levels.js';
import {
  getTowerVisualConfig,
  getOmegaWaveVisualConfig,
  getTowerTierValue,
} from './colorSchemeUtils.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../scripts/features/towers/powderTower.js';
import { notifyTowerPlaced } from './achievementsTab.js';
import { metersToPixels } from './gameUnits.js'; // Allow playfield interactions to convert standardized meters into pixels.

// Minimum pointer distance before the playfield interprets input as a camera drag.
const PLAYFIELD_VIEW_DRAG_THRESHOLD = 6;

// Dependency container allows the main module to provide shared helpers without creating circular imports.
const defaultDependencies = {
  alephChainUpgrades: {},
  theroSymbol: 'þ',
  calculateStartingThero: () => 0,
  updateStatusDisplays: () => {},
  notifyEnemyDefeated: () => {},
  notifyAutoAnchorUsed: () => {},
  getOmegaPatternForTier: () => [],
  isFieldNotesOverlayVisible: () => false,
  getBaseStartThero: () => 50,
  getBaseCoreIntegrity: () => 100,
  // Allows the playfield to respect the global graphics fidelity toggle.
  isLowGraphicsMode: () => false,
};

// Preload the Mind Gate sprite so the path finale mirrors the Towers tab art.
const MIND_GATE_SPRITE_URL = 'assets/images/tower-aleph-null.svg';
const mindGateSprite = new Image();
mindGateSprite.src = MIND_GATE_SPRITE_URL;
mindGateSprite.decoding = 'async';
mindGateSprite.loading = 'eager';

let playfieldDependencies = { ...defaultDependencies };

export function configurePlayfieldSystem(options = {}) {
  playfieldDependencies = { ...defaultDependencies, ...options };
}

export class SimplePlayfield {
  constructor(options) {
    this.canvas = options.canvas || null;
    this.container = options.container || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.messageEl = options.messageEl || null;
    this.waveEl = options.waveEl || null;
    this.healthEl = options.healthEl || null;
    this.energyEl = options.energyEl || null;
    this.progressEl = options.progressEl || null;
    this.startButton = options.startButton || null;
    this.speedButton = options.speedButton || null;
    this.autoAnchorButton = options.autoAnchorButton || null;
    this.autoWaveCheckbox = options.autoWaveCheckbox || null;
    this.previewOnly = Boolean(options.previewOnly);
    this.speedMultipliers =
      Array.isArray(options.speedMultipliers) && options.speedMultipliers.length
        ? options.speedMultipliers.slice()
        : [1, 1.5, 2, 3];
    this.speedIndex = 0;
    this.speedMultiplier = this.speedMultipliers[this.speedIndex];
    this.slotButtons = Array.isArray(options.slotButtons) ? options.slotButtons : [];
    this.onVictory = typeof options.onVictory === 'function' ? options.onVictory : null;
    this.onDefeat = typeof options.onDefeat === 'function' ? options.onDefeat : null;
    this.onCombatStart =
      typeof options.onCombatStart === 'function' ? options.onCombatStart : null;
    this.audio = options.audioManager || options.audio || null;

    this.dependencies = playfieldDependencies;
    this.theroSymbol = typeof this.dependencies.theroSymbol === 'string'
      ? this.dependencies.theroSymbol
      : 'þ';

    this.levelConfig = null;
    this.levelActive = false;
    this.shouldAnimate = false;
    this.combatActive = false;
    this.resolvedOutcome = null;

    this.renderWidth = this.canvas ? this.canvas.clientWidth : 0;
    this.renderHeight = this.canvas ? this.canvas.clientHeight : 0;
    this.pixelRatio = 1;

    this.arcOffset = 0;
    this.energy = 0;
    this.lives = 0;
    // Track baseline gate defense so breach previews can factor in mitigation.
    this.gateDefense = 0;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.activeWave = null;
    this.enemyIdCounter = 0;
    this.baseWaveCount = 0;
    this.currentWaveNumber = 1;
    this.maxWaveReached = 0;
    this.isEndlessMode = false;
    this.endlessCycle = 0;
    this.initialSpawnDelay = 0;
    this.autoWaveEnabled = true;
    this.autoStartLeadTime = 5;
    this.autoStartTimer = null;
    this.autoStartDeadline = 0;
    // Track the most recent endless checkpoint so defeat screens can offer a retry.
    this.endlessCheckpoint = null;
    this.endlessCheckpointUsed = false;

    // Allow callers (such as preview renderers) to override the natural orientation choice.
    this.preferredOrientationOverride =
      typeof options?.preferredOrientation === 'string'
        ? options.preferredOrientation
        : null;

    this.layoutOrientation = 'portrait';
    this.basePathPoints = [];
    this.baseAutoAnchors = [];

    this.pathSegments = [];
    this.pathPoints = [];
    this.pathLength = 0;

    this.slots = new Map();
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.availableTowers = [];
    this.draggingTowerType = null;
    this.dragPreviewOffset = { x: 0, y: 0 }; // Allow callers to nudge the preview in addition to the standardized elevation.

    // Track which lattice menu is active so clicks open option rings instead of instant selling.
    this.activeTowerMenu = null;
    // Provide stable identifiers for Delta soldiers as they spawn from multiple towers.
    this.deltaSoldierIdCounter = 0;

    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { width: 0, height: 0 };

    const upgrades = this.dependencies.alephChainUpgrades || {};
    this.alephChain = createAlephChainRegistry({ upgrades });

    this.animationId = null;
    this.lastTimestamp = 0;

    this.resizeObserver = null;
    this.resizeHandler = () => this.syncCanvasSize();

    this.towerIdCounter = 0;
    this.hoverPlacement = null;
    this.hoverEnemy = null;
    this.pointerPosition = null;
    this.focusedEnemyId = null;
    this.focusMarkerAngle = 0;
    this.anchorTolerance = 0.06;

    this.viewScale = 1;
    this.minViewScale = 0.75;
    this.maxViewScale = 2.5;
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };

    this.activePointers = new Map();
    this.pinchState = null;
    this.isPinchZooming = false;

    this.pointerMoveHandler = (event) => this.handleCanvasPointerMove(event);
    this.pointerLeaveHandler = () => this.handleCanvasPointerLeave();
    this.pointerClickHandler = (event) => this.handleCanvasClick(event);
    this.pointerDownHandler = (event) => this.handleCanvasPointerDown(event);
    this.pointerUpHandler = (event) => this.handleCanvasPointerUp(event);
    this.wheelHandler = (event) => this.handleCanvasWheel(event);

    // Track pointer-driven camera gestures so the player can pan the battlefield.
    this.viewDragState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startCenter: { x: 0.5, y: 0.5 },
      isDragging: false,
    };
    // Remember when a drag gesture should block the follow-up click event.
    this.suppressNextCanvasClick = false;

    this.developerPathMarkers = [];

    this.enemyTooltip = null;
    this.enemyTooltipNameEl = null;
    this.enemyTooltipHpEl = null;

    if (!this.previewOnly) {
      this.registerSlots();
      this.bindStartButton();
      this.bindSpeedButton();
      this.bindAutoAnchorButton();
      this.bindAutoWaveCheckbox();
      this.attachResizeObservers();
      this.attachCanvasInteractions();
      this.createEnemyTooltip();

      this.disableSlots(true);
      this.updateHud();
      this.updateProgress();
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }
  }

  // Reports whether low graphics mode is active for the current render cycle.
  isLowGraphicsMode() {
    if (typeof this.dependencies.isLowGraphicsMode === 'function') {
      try {
        return Boolean(this.dependencies.isLowGraphicsMode());
      } catch (error) {
        return false;
      }
    }
    if (typeof document !== 'undefined' && document.body) {
      return document.body.classList.contains('graphics-mode-low');
    }
    return false;
  }

  // Determine whether the current viewport favors a portrait or landscape layout.
  determinePreferredOrientation() {
    if (this.preferredOrientationOverride === 'landscape') {
      // Respect explicit landscape requests supplied by wrapper modules.
      return 'landscape';
    }
    if (this.preferredOrientationOverride === 'portrait') {
      // Respect explicit portrait requests supplied by wrapper modules.
      return 'portrait';
    }
    if (typeof window === 'undefined') {
      return 'portrait';
    }
    const width = Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
    const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
    if (width > 0 && height > 0 && width > height) {
      return 'landscape';
    }
    return 'portrait';
  }

  // Update the override and immediately re-evaluate the level orientation if active.
  setPreferredOrientation(orientation) {
    const normalized =
      orientation === 'landscape' || orientation === 'portrait' ? orientation : null;
    if (this.preferredOrientationOverride === normalized) {
      return;
    }
    this.preferredOrientationOverride = normalized;
    if (!this.levelActive) {
      return;
    }
    this.layoutOrientation = this.determinePreferredOrientation();
    this.applyLevelOrientation();
    this.applyContainerOrientationClass();
    this.syncCanvasSize();
  }

  // Update playfield container classes so CSS can size the canvas per orientation.
  applyContainerOrientationClass() {
    if (!this.container || !this.container.classList) {
      return;
    }
    if (!this.container.classList.contains('playfield')) {
      return;
    }
    if (this.layoutOrientation === 'landscape') {
      this.container.classList.add('playfield--landscape');
      this.container.classList.remove('playfield--portrait');
    } else {
      this.container.classList.add('playfield--portrait');
      this.container.classList.remove('playfield--landscape');
    }
  }

  // Clone a normalized point while constraining it to the valid 0–1 range.
  cloneNormalizedPoint(point) {
    if (!point || typeof point !== 'object') {
      return { x: 0, y: 0 };
    }
    const x = Number.isFinite(point.x) ? point.x : 0;
    const y = Number.isFinite(point.y) ? point.y : 0;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  // Rotate a normalized point 90° clockwise around the playfield center.
  rotateNormalizedPointClockwise(point) {
    const base = this.cloneNormalizedPoint(point);
    const rotated = {
      x: base.y,
      y: 1 - base.x,
    };
    return {
      x: Math.max(0, Math.min(1, rotated.x)),
      y: Math.max(0, Math.min(1, rotated.y)),
    };
  }

  // Apply the active orientation to the level's path and auto-anchor geometry.
  applyLevelOrientation() {
    if (!this.levelConfig) {
      return;
    }
    const basePath = Array.isArray(this.basePathPoints) && this.basePathPoints.length
      ? this.basePathPoints
      : Array.isArray(this.levelConfig.path)
      ? this.levelConfig.path
      : [];
    const baseAnchors = Array.isArray(this.baseAutoAnchors) ? this.baseAutoAnchors : [];
    const transform =
      this.layoutOrientation === 'landscape'
        ? (point) => this.rotateNormalizedPointClockwise(point)
        : (point) => this.cloneNormalizedPoint(point);

    this.levelConfig.path = basePath.map((point) => transform(point));
    this.levelConfig.autoAnchors = baseAnchors.length
      ? baseAnchors.map((anchor) => transform(anchor))
      : [];
  }

  // Applies a canvas shadow when high graphics fidelity is active.
  applyCanvasShadow(ctx, color, blur) {
    if (!ctx) {
      return;
    }
    if (this.isLowGraphicsMode()) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
      return;
    }
    ctx.shadowColor = color || 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = Number.isFinite(blur) ? blur : 0;
  }

  // Clears active canvas shadow configuration regardless of the fidelity mode.
  clearCanvasShadow(ctx) {
    if (!ctx) {
      return;
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = 0;
  }

  registerSlots() {
    this.slotButtons.forEach((button) => {
      const slotId = button.dataset.slotId;
      const x = Number.parseFloat(button.dataset.slotX);
      const y = Number.parseFloat(button.dataset.slotY);
      if (!slotId || Number.isNaN(x) || Number.isNaN(y)) {
        return;
      }
      const slot = {
        id: slotId,
        button,
        normalized: { x, y },
        tower: null,
      };
      this.slots.set(slotId, slot);
      button.addEventListener('click', () => this.handleSlotInteraction(slot));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.handleSlotInteraction(slot);
        }
      });
    });
  }

  setAvailableTowers(towerIds = []) {
    if (Array.isArray(towerIds)) {
      this.availableTowers = towerIds.filter(
        (towerId) => getTowerDefinition(towerId) && isTowerUnlocked(towerId),
      );
    } else {
      this.availableTowers = [];
    }
    refreshTowerLoadoutDisplay();
  }

  getActiveTowerCount(towerId) {
    if (!towerId || !Array.isArray(this.towers)) {
      return 0;
    }
    let count = 0;
    for (let index = 0; index < this.towers.length; index += 1) {
      if (this.towers[index]?.type === towerId) {
        count += 1;
      }
    }
    return count;
  }

  getCurrentTowerCost(towerId) {
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return Number.POSITIVE_INFINITY;
    }
    const activeCount = this.getActiveTowerCount(towerId);
    const exponent = 1 + Math.max(0, activeCount);
    return definition.baseCost ** exponent;
  }

  setDraggingTower(towerId) {
    this.draggingTowerType = towerId;
  }

  finishTowerDrag() {
    this.draggingTowerType = null;
  }

  previewTowerPlacement(normalized, { towerType, dragging = false } = {}) {
    if (!normalized || !towerType) {
      this.clearPlacementPreview();
      return;
    }
    this.updatePlacementPreview(normalized, { towerType, dragging });
  }

  completeTowerPlacement(normalized, { towerType } = {}) {
    if (!towerType) {
      this.clearPlacementPreview();
      return false;
    }

    let targetNormalized = normalized ? { ...normalized } : null;
    if (
      this.hoverPlacement &&
      this.hoverPlacement.towerType === towerType &&
      this.hoverPlacement.dragging &&
      this.hoverPlacement.normalized
    ) {
      targetNormalized = { ...this.hoverPlacement.normalized };
    }

    if (!targetNormalized) {
      this.clearPlacementPreview();
      return false;
    }

    const placed = this.addTowerAt(targetNormalized, { towerType });
    this.clearPlacementPreview(); // Always reset the preview once placement resolves so invalid drops do not persist.
    return placed;
  }

  bindStartButton() {
    if (!this.startButton) {
      return;
    }
    this.startButton.addEventListener('click', () => this.handleStartButton());
  }

  bindSpeedButton() {
    if (!this.speedButton) {
      return;
    }
    this.speedButton.addEventListener('click', () => {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.isInteractiveLevelActive()) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Enter an interactive level to adjust the simulation speed.';
        }
        return;
      }
      this.cycleSpeedMultiplier();
      if (this.audio) {
        this.audio.playSfx('uiToggle');
      }
    });
  }

  bindAutoAnchorButton() {
    if (!this.autoAnchorButton) {
      return;
    }
    this.autoAnchorButton.addEventListener('click', () => {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.isInteractiveLevelActive()) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Enter an interactive level to auto-lattice recommended anchors.';
        }
        return;
      }
      this.autoAnchorTowers();
    });
  }

  bindAutoWaveCheckbox() {
    if (!this.autoWaveCheckbox) {
      return;
    }
    this.autoWaveCheckbox.checked = this.autoWaveEnabled;
    this.autoWaveCheckbox.disabled = true;
    this.autoWaveCheckbox.addEventListener('change', () => {
      if (!this.autoWaveCheckbox) {
        return;
      }
      this.autoWaveEnabled = this.autoWaveCheckbox.checked;
      if (!this.levelActive || !this.levelConfig || this.combatActive) {
        if (!this.autoWaveEnabled) {
          this.cancelAutoStart();
        }
        return;
      }
      if (this.autoWaveEnabled) {
        this.scheduleAutoStart({ delay: this.autoStartLeadTime });
      } else {
        this.cancelAutoStart();
        if (this.messageEl) {
          this.messageEl.textContent =
            'Auto-start disabled—commence waves when your lattice is ready.';
        }
      }
    });
  }

  scheduleAutoStart(options = {}) {
    if (
      !this.autoWaveEnabled ||
      !this.levelActive ||
      !this.levelConfig ||
      this.combatActive
    ) {
      return;
    }
    const delay = Number.isFinite(options.delay)
      ? Math.max(0, options.delay)
      : this.autoStartLeadTime;
    this.cancelAutoStart();
    if (typeof window === 'undefined') {
      return;
    }
    this.autoStartDeadline = Date.now() + delay * 1000;
    this.autoStartTimer = window.setTimeout(() => {
      this.autoStartTimer = null;
      this.tryAutoStart();
    }, delay * 1000);
  }

  cancelAutoStart() {
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
      this.autoStartTimer = null;
    }
    this.autoStartDeadline = 0;
  }

  tryAutoStart() {
    if (
      !this.autoWaveEnabled ||
      !this.levelActive ||
      !this.levelConfig ||
      this.combatActive
    ) {
      return;
    }
    if (!this.towers.length) {
      if (this.messageEl) {
        this.messageEl.textContent =
          'Awaiting lattice placements—auto-start resumes once towers are in place.';
      }
      this.scheduleAutoStart({ delay: 1.5 });
      return;
    }
    this.autoStartDeadline = 0;
    this.handleStartButton();
  }

  attachResizeObservers() {
    if (!this.canvas) {
      return;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
      this.resizeObserver.observe(this.canvas);
    }
    this.syncCanvasSize();
  }

  attachCanvasInteractions() {
    if (!this.canvas) {
      return;
    }
    this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
    this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
    this.canvas.addEventListener('pointerleave', this.pointerLeaveHandler);
    this.canvas.addEventListener('click', this.pointerClickHandler);
    this.canvas.addEventListener('pointerup', this.pointerUpHandler);
    this.canvas.addEventListener('pointercancel', this.pointerUpHandler);
    this.canvas.addEventListener('lostpointercapture', this.pointerUpHandler);
    this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  createEnemyTooltip() {
    if (!this.container || this.enemyTooltip) {
      return;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'enemy-tooltip';

    const nameEl = document.createElement('div');
    nameEl.className = 'enemy-tooltip-name';

    const hpEl = document.createElement('div');
    hpEl.className = 'enemy-tooltip-hp';

    tooltip.append(nameEl, hpEl);
    tooltip.setAttribute('aria-hidden', 'true');

    this.container.appendChild(tooltip);
    this.enemyTooltip = tooltip;
    this.enemyTooltipNameEl = nameEl;
    this.enemyTooltipHpEl = hpEl;
  }

  syncCanvasSize() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.renderWidth = rect.width || 1;
    this.renderHeight = rect.height || 1;
    this.pixelRatio = ratio;

    this.buildPathGeometry();
    this.updateTowerPositions();
    this.ensureFloatersLayout();
    this.applyViewConstraints();
    this.draw();
  }

  buildPathGeometry() {
    if (
      !this.levelConfig ||
      !Array.isArray(this.levelConfig.path) ||
      this.levelConfig.path.length < 2 ||
      !this.ctx
    ) {
      this.pathSegments = [];
      this.pathPoints = [];
      this.pathLength = 0;
      return;
    }

    const points = this.levelConfig.path.map((node) => ({
      x: node.x * this.renderWidth,
      y: node.y * this.renderHeight,
    }));

    const smoothPoints = this.generateSmoothPathPoints(points, 14);

    const segments = [];
    let totalLength = 0;
    for (let index = 0; index < smoothPoints.length - 1; index += 1) {
      const start = smoothPoints[index];
      const end = smoothPoints[index + 1];
      const length = this.distanceBetween(start, end);
      segments.push({ start, end, length });
      totalLength += length;
    }

    this.pathPoints = smoothPoints;
    this.pathSegments = segments;
    this.pathLength = totalLength || 1;
  }

  computeFloaterCount(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return 0;
    }
    const area = Math.max(0, width * height);
    const base = Math.round(area / 24000);
    return Math.max(18, Math.min(64, base));
  }

  randomFloaterRadiusFactor() {
    return 0.0075 + Math.random() * 0.0045;
  }

  createFloater(width, height) {
    const margin = Math.min(width, height) * 0.08;
    const usableWidth = Math.max(1, width - margin * 2);
    const usableHeight = Math.max(1, height - margin * 2);
    return {
      x: margin + Math.random() * usableWidth,
      y: margin + Math.random() * usableHeight,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      ax: 0,
      ay: 0,
      radiusFactor: this.randomFloaterRadiusFactor(),
      opacity: 0,
      opacityTarget: 0,
    };
  }

  ensureFloatersLayout() {
    const width = this.renderWidth || 0;
    const height = this.renderHeight || 0;

    if (!this.levelConfig || !width || !height) {
      this.floaters = [];
      this.floaterConnections = [];
      this.floaterBounds = { width, height };
      return;
    }

    const previousWidth = this.floaterBounds?.width || width;
    const previousHeight = this.floaterBounds?.height || height;
    const scaleX = previousWidth ? width / previousWidth : 1;
    const scaleY = previousHeight ? height / previousHeight : 1;

    if (this.floaters.length && (scaleX !== 1 || scaleY !== 1)) {
      this.floaters.forEach((floater) => {
        floater.x *= scaleX;
        floater.y *= scaleY;
        floater.vx *= scaleX;
        floater.vy *= scaleY;
      });
    }

    const desired = this.computeFloaterCount(width, height);

    if (!this.floaters.length) {
      this.floaters = [];
    }

    if (this.floaters.length < desired) {
      const needed = desired - this.floaters.length;
      for (let index = 0; index < needed; index += 1) {
        this.floaters.push(this.createFloater(width, height));
      }
    } else if (this.floaters.length > desired) {
      this.floaters.length = desired;
    }

    const safeMargin = Math.min(width, height) * 0.04;
    this.floaters.forEach((floater) => {
      floater.x = Math.min(width - safeMargin, Math.max(safeMargin, floater.x));
      floater.y = Math.min(height - safeMargin, Math.max(safeMargin, floater.y));
      if (!Number.isFinite(floater.vx)) {
        floater.vx = 0;
      }
      if (!Number.isFinite(floater.vy)) {
        floater.vy = 0;
      }
      if (!Number.isFinite(floater.radiusFactor)) {
        floater.radiusFactor = this.randomFloaterRadiusFactor();
      }
      floater.opacity = Number.isFinite(floater.opacity) ? floater.opacity : 0;
      floater.opacityTarget = Number.isFinite(floater.opacityTarget)
        ? floater.opacityTarget
        : 0;
      floater.ax = Number.isFinite(floater.ax) ? floater.ax : 0;
      floater.ay = Number.isFinite(floater.ay) ? floater.ay : 0;
    });

    this.floaterBounds = { width, height };
  }

  generateSmoothPathPoints(points, subdivisions = 12) {
    if (!Array.isArray(points) || points.length < 2) {
      return Array.isArray(points) ? points.slice() : [];
    }

    const smooth = [];
    const steps = Math.max(1, subdivisions);

    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = index > 0 ? points[index - 1] : points[index];
      const current = points[index];
      const next = points[index + 1];
      const afterNext = index + 2 < points.length ? points[index + 2] : next;

      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const x = this.catmullRom(previous.x, current.x, next.x, afterNext.x, t);
        const y = this.catmullRom(previous.y, current.y, next.y, afterNext.y, t);
        const point = { x, y };
        if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], point) > 0.5) {
          smooth.push(point);
        }
      }
    }

    const lastPoint = points[points.length - 1];
    if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], lastPoint) > 0) {
      smooth.push({ ...lastPoint });
    }

    return smooth;
  }

  catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      ((2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  distanceBetween(a, b) {
    if (!a || !b) {
      return 0;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.hypot(dx, dy);
  }

  ensureLoop() {
    if (this.animationId || !this.shouldAnimate) {
      return;
    }
    this.animationId = requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.lastTimestamp = 0;
  }

  tick(timestamp) {
    if (!this.shouldAnimate) {
      this.animationId = null;
      this.lastTimestamp = 0;
      return;
    }

    const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestamp;

    const safeDelta = Math.min(delta, 0.12);
    this.update(safeDelta);
    this.draw();

    this.animationId = requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
  }

  enterLevel(level, options = {}) {
    if (!this.container) {
      return;
    }

    const levelId = level?.id;
    const config = levelId ? levelConfigs.get(levelId) : null;
    const isInteractive = Boolean(config);
    const startInEndless = Boolean(options.endlessMode || config?.forceEndlessMode);

    if (this.previewOnly && !isInteractive) {
      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.stopLoop();
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    this.cancelAutoStart();

    if (!isInteractive) {
      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.isEndlessMode = false;
      this.endlessCycle = 0;
      this.baseWaveCount = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.stopLoop();
      this.disableSlots(true);
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.energy = 0;
      this.lives = 0;
      // Reset gate defense while previewing non-interactive layouts.
      this.gateDefense = 0;
      if (this.autoWaveCheckbox) {
        this.autoWaveCheckbox.checked = this.autoWaveEnabled;
        this.autoWaveCheckbox.disabled = true;
      }
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.basePathPoints = [];
      this.baseAutoAnchors = [];
      if (this.messageEl) {
        this.messageEl.textContent = 'This level preview is not interactive yet.';
      }
      if (this.waveEl) this.waveEl.textContent = '—';
      if (this.healthEl) this.healthEl.textContent = '—';
      if (this.energyEl) this.energyEl.textContent = '—';
      if (this.progressEl) {
        this.progressEl.textContent = 'Select an unlocked level to battle.';
      }
      if (this.startButton) {
        this.startButton.textContent = 'Preview Only';
        this.startButton.disabled = true;
      }
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
      cancelTowerDrag();
      return;
    }

    const clonedConfig = {
      ...config,
      waves: config.waves.map((wave) => ({ ...wave })),
      path: config.path.map((node) => ({ ...node })),
      autoAnchors: Array.isArray(config.autoAnchors)
        ? config.autoAnchors.map((anchor) => ({ ...anchor }))
        : [],
    };

    const forceInfiniteThero = Boolean(config?.infiniteThero);
    if (forceInfiniteThero) {
      clonedConfig.infiniteThero = true;
      clonedConfig.startThero = Number.POSITIVE_INFINITY;
      clonedConfig.theroCap = Number.POSITIVE_INFINITY;
    } else {
      const calculateStartingThero = this.dependencies.calculateStartingThero;
      const getBaseStartThero = this.dependencies.getBaseStartThero;
      const baseStart =
        typeof getBaseStartThero === 'function' ? getBaseStartThero() : 0;
      const dynamicStartThero =
        typeof calculateStartingThero === 'function' ? calculateStartingThero() : 0;
      clonedConfig.startThero = Number.isFinite(dynamicStartThero)
        ? dynamicStartThero
        : baseStart;
    }
    clonedConfig.forceEndlessMode = Boolean(config?.forceEndlessMode);
    const getBaseCoreIntegrity = this.dependencies.getBaseCoreIntegrity;
    clonedConfig.lives =
      typeof getBaseCoreIntegrity === 'function' ? getBaseCoreIntegrity() : 0;

    const basePathPoints = Array.isArray(clonedConfig.path)
      ? clonedConfig.path.map((node) => this.cloneNormalizedPoint(node))
      : [];
    const baseAutoAnchors = Array.isArray(clonedConfig.autoAnchors)
      ? clonedConfig.autoAnchors.map((anchor) => this.cloneNormalizedPoint(anchor))
      : [];
    this.basePathPoints = basePathPoints;
    this.baseAutoAnchors = baseAutoAnchors;
    this.layoutOrientation = this.determinePreferredOrientation();

    this.levelActive = true;
    this.levelConfig = clonedConfig;
    this.baseWaveCount = clonedConfig.waves.length;
    this.isEndlessMode = startInEndless;
    this.endlessCycle = 0;
    this.currentWaveNumber = 1;
    this.maxWaveReached = 0;
    // Clear any stored checkpoint when a fresh state is requested.
    this.endlessCheckpoint = null;
    this.endlessCheckpointUsed = false;
    this.viewScale = 1;
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };
    this.applyViewConstraints();
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
    this.applyLevelOrientation();
    this.applyContainerOrientationClass();
    if (this.previewOnly) {
      this.combatActive = false;
      this.shouldAnimate = false;
      this.stopLoop();
      this.arcOffset = 0;
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.hoverPlacement = null;
      this.pointerPosition = null;
      this.syncCanvasSize();
      if (typeof window !== 'undefined') {
        const activeLevelId = this.levelConfig?.id;
        const attemptSync = () => {
          if (!this.previewOnly) {
            return;
          }
          if (!this.levelConfig || this.levelConfig.id !== activeLevelId) {
            return;
          }
          const rect = this.canvas ? this.canvas.getBoundingClientRect() : null;
          if (!rect || rect.width < 2 || rect.height < 2) {
            window.requestAnimationFrame(attemptSync);
            return;
          }
          this.syncCanvasSize();
        };
        window.requestAnimationFrame(attemptSync);
      }
      return;
    }

    this.setAvailableTowers(getTowerLoadoutState().selected);
    this.shouldAnimate = true;
    this.resetState();
    this.enableSlots();
    this.syncCanvasSize();
    this.ensureLoop();

    if (this.startButton) {
      this.startButton.textContent = 'Commence Wave';
      this.startButton.disabled = false;
    }
    if (this.autoWaveCheckbox) {
      this.autoWaveCheckbox.disabled = false;
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
    }
    if (this.messageEl) {
      this.messageEl.textContent = this.isEndlessMode
        ? 'Endless defense unlocked—survive as the waves loop.'
        : 'Drag glyph chips from your loadout anywhere on the plane—no fixed anchors required.';
    }
    if (this.progressEl) {
      this.progressEl.textContent = this.isEndlessMode
        ? 'Waves loop infinitely. Each completed cycle multiplies enemy strength ×10.'
        : 'Wave prep underway.';
    }
    if (this.autoWaveEnabled) {
      this.scheduleAutoStart({ delay: this.autoStartLeadTime });
    }
    this.updateHud();
    this.updateProgress();
    this.updateSpeedButton();
    this.updateAutoAnchorButton();
  }

  leaveLevel() {
    if (this.previewOnly) {
      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.stopLoop();
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.pathSegments = [];
      this.pathPoints = [];
      this.pathLength = 0;
      this.floaters = [];
      this.floaterConnections = [];
      this.arcOffset = 0;
      this.hoverPlacement = null;
      this.pointerPosition = null;
      this.developerPathMarkers = [];
      this.viewScale = 1;
      this.viewCenterNormalized = { x: 0.5, y: 0.5 };
      this.applyViewConstraints();
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
      // Reset stored geometry when leaving the preview renderer.
      this.basePathPoints = [];
      this.baseAutoAnchors = [];
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    this.levelActive = false;
    this.levelConfig = null;
    this.combatActive = false;
    this.shouldAnimate = false;
    this.cancelAutoStart();
    // Leaving the level invalidates any stored endless checkpoint data.
    this.endlessCheckpoint = null;
    this.endlessCheckpointUsed = false;
    this.stopLoop();
    this.disableSlots(true);
    this.enemies = [];
    this.projectiles = [];
    this.activeTowerMenu = null;
    this.deltaSoldierIdCounter = 0;
    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    // Clear mote gem drops whenever the battlefield resets.
    resetActiveMoteGems();
    this.towers = [];
    this.alephChain.reset();
    this.hoverPlacement = null;
    this.clearFocusedEnemy({ silent: true });
    this.energy = 0;
    this.lives = 0;
    // Drop any cached gate defense when the battlefield fully resets.
    this.gateDefense = 0;
    this.resolvedOutcome = null;
    this.arcOffset = 0;
    this.isEndlessMode = false;
    this.endlessCycle = 0;
    this.baseWaveCount = 0;
    this.currentWaveNumber = 1;
    this.maxWaveReached = 0;
    // Clear cached portrait geometry so the next level can determine orientation anew.
    this.basePathPoints = [];
    this.baseAutoAnchors = [];
    this.setAvailableTowers([]);
    cancelTowerDrag();
    this.viewScale = 1;
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };
    this.applyViewConstraints();
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.messageEl) {
      this.messageEl.textContent = 'Select a level to command the defense.';
    }
    if (this.waveEl) this.waveEl.textContent = '—';
    if (this.healthEl) this.healthEl.textContent = '—';
    if (this.energyEl) this.energyEl.textContent = '—';
    if (this.progressEl) this.progressEl.textContent = 'No active level.';
    if (this.startButton) {
      this.startButton.textContent = 'Commence Wave';
      this.startButton.disabled = true;
    }
    if (this.autoWaveCheckbox) {
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
      this.autoWaveCheckbox.disabled = true;
    }
    this.updateSpeedButton();
    this.updateAutoAnchorButton();
  }

  resetState() {
    if (!this.levelConfig) {
      this.energy = 0;
      this.lives = 0;
      // Clear defense when no active level is attached to the playfield.
      this.gateDefense = 0;
    } else {
      this.energy = this.levelConfig.startThero || 0;
      this.lives = this.levelConfig.lives;
      // Normalize any gate defense value supplied by the level configuration.
      const configuredDefense = Number.isFinite(this.levelConfig.gateDefense)
        ? this.levelConfig.gateDefense
        : Number.isFinite(this.levelConfig.coreDefense)
        ? this.levelConfig.coreDefense
        : 0;
      this.gateDefense = Math.max(0, configuredDefense);
    }
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.activeWave = null;
    this.enemyIdCounter = 0;
    this.towerIdCounter = 0;
    this.arcOffset = 0;
    this.combatActive = false;
    this.resolvedOutcome = null;
    this.endlessCycle = 0;
    this.currentWaveNumber = 1;
    this.maxWaveReached = 0;
    this.enemies = [];
    this.projectiles = [];
    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    this.towers = [];
    this.alephChain.reset();
    this.hoverPlacement = null;
    this.clearFocusedEnemy({ silent: true });
    this.slots.forEach((slot) => {
      slot.tower = null;
      if (slot.button) {
        slot.button.classList.remove('tower-built');
        slot.button.setAttribute('aria-pressed', 'false');
      }
    });
    this.updateTowerPositions();
    this.updateHud();
    this.updateProgress();
    if (this.startButton) {
      this.startButton.disabled = !this.levelConfig;
    }
    this.updateAutoAnchorButton();
    this.updateSpeedButton();
    refreshTowerLoadoutDisplay();
  }

  enableSlots() {
    this.slots.forEach((slot) => {
      if (slot.button) {
        slot.button.disabled = false;
      }
    });
  }

  disableSlots(clear = false) {
    this.slots.forEach((slot) => {
      if (!slot.button) {
        return;
      }
      slot.button.disabled = true;
      if (clear) {
        slot.tower = null;
        slot.button.classList.remove('tower-built');
        slot.button.setAttribute('aria-pressed', 'false');
      }
    });
  }

  isInteractiveLevelActive() {
    return Boolean(
      this.levelActive && this.levelConfig && levelConfigs.has(this.levelConfig.id),
    );
  }

  formatSpeedMultiplier(value) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    const formatted = value.toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  }

  cycleSpeedMultiplier() {
    if (!this.speedMultipliers.length) {
      return;
    }
    this.speedIndex = (this.speedIndex + 1) % this.speedMultipliers.length;
    this.speedMultiplier = this.speedMultipliers[this.speedIndex];
    this.updateSpeedButton();
    if (this.messageEl) {
      this.messageEl.textContent = `Simulation speed set to ×${this.formatSpeedMultiplier(
        this.speedMultiplier,
      )}.`;
    }
  }

  updateSpeedButton() {
    if (!this.speedButton) {
      return;
    }
    const label = this.formatSpeedMultiplier(this.speedMultiplier);
    this.speedButton.textContent = `Speed ×${label}`;
    const interactive = this.isInteractiveLevelActive();
    this.speedButton.disabled = !interactive;
    this.speedButton.setAttribute('aria-disabled', interactive ? 'false' : 'true');
    this.speedButton.title = interactive
      ? 'Cycle the manual defense speed multiplier.'
      : 'Simulation speed adjusts during the interactive defense.';
  }

  getAutoAnchorStatus() {
    const anchors = Array.isArray(this.levelConfig?.autoAnchors)
      ? this.levelConfig.autoAnchors
      : [];
    if (!anchors.length) {
      return { total: 0, placed: 0 };
    }
    const tolerance = this.anchorTolerance;
    let placed = 0;
    anchors.forEach((anchor) => {
      const occupied = this.towers.some((tower) => {
        const dx = tower.normalized.x - anchor.x;
        const dy = tower.normalized.y - anchor.y;
        return Math.hypot(dx, dy) <= tolerance;
      });
      if (occupied) {
        placed += 1;
      }
    });
    return { total: anchors.length, placed };
  }

  updateAutoAnchorButton() {
    if (!this.autoAnchorButton) {
      return;
    }

    this.autoAnchorButton.textContent = 'Loadout Placement';
    this.autoAnchorButton.disabled = true;
    this.autoAnchorButton.setAttribute('aria-disabled', 'true');
    this.autoAnchorButton.title = 'Drag towers from the loadout to lattice them on the field.';
  }

  autoAnchorTowers() {
    if (!this.isInteractiveLevelActive()) {
      if (this.audio) {
        this.audio.playSfx('error');
      }
      return;
    }
    const anchors = Array.isArray(this.levelConfig?.autoAnchors)
      ? this.levelConfig.autoAnchors
      : [];
    if (!anchors.length) {
      if (this.messageEl) {
        this.messageEl.textContent = 'No auto-lattice anchors configured for this level yet.';
      }
      return;
    }

    const tolerance = this.anchorTolerance;
    let placed = 0;
    let insufficientEnergy = false;

    for (const anchor of anchors) {
      const occupied = this.towers.some((tower) => {
        const dx = tower.normalized.x - anchor.x;
        const dy = tower.normalized.y - anchor.y;
        return Math.hypot(dx, dy) <= tolerance;
      });
      if (occupied) {
        continue;
      }
      if (this.energy < this.levelConfig.towerCost) {
        insufficientEnergy = true;
        break;
      }
      const success = this.addTowerAt(anchor, { silent: true });
      if (success) {
        placed += 1;
      }
    }

    const { total, placed: nowPlaced } = this.getAutoAnchorStatus();
    const remaining = Math.max(0, total - nowPlaced);

    if (typeof this.dependencies.notifyAutoAnchorUsed === 'function') {
      this.dependencies.notifyAutoAnchorUsed(nowPlaced, total);
    }

    if (this.audio && placed > 0) {
      this.audio.playSfx('towerPlace');
      playTowerPlacementNotes(this.audio, placed);
    }

    if (this.messageEl) {
      this.messageEl.textContent = 'Auto-lattice is disabled—drag towers from the loadout instead.';
    }
  }

  canRetryCurrentWave() {
    return this.isInteractiveLevelActive();
  }

  retryCurrentWave() {
    if (!this.isInteractiveLevelActive()) {
      if (this.messageEl) {
        this.messageEl.textContent = 'Enter an interactive level to retry the defense.';
      }
      return false;
    }

    if (this.audio) {
      this.audio.unlock();
    }

    if (!this.towers.length) {
      if (this.messageEl) {
        this.messageEl.textContent = 'Anchor at least one tower before retrying the wave.';
      }
      return false;
    }

    this.cancelAutoStart();
    this.combatActive = false;
    this.resolvedOutcome = null;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.enemyIdCounter = 0;
    this.activeWave = null;
    this.enemies = [];
    this.projectiles = [];
    this.floaters = [];
    this.floaterConnections = [];
    this.currentWaveNumber = 1;
    this.maxWaveReached = 0;

    if (this.startButton) {
      this.startButton.disabled = false;
      this.startButton.textContent = 'Commence Wave';
    }
    if (this.autoWaveCheckbox) {
      this.autoWaveCheckbox.disabled = false;
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
    }

    this.updateHud();
    this.updateProgress();
    this.updateSpeedButton();
    this.updateAutoAnchorButton();

    if (this.audio) {
      this.audio.playSfx('uiToggle');
    }

    this.handleStartButton();
    return true;
  }

  updateTowerPositions() {
    if (!this.levelConfig) {
      return;
    }
    this.towers.forEach((tower) => {
      const { x, y } = this.getCanvasPosition(tower.normalized);
      tower.x = x;
      tower.y = y;
      const definition = getTowerDefinition(tower.type) || tower.definition;
      const rangeFactor = definition ? definition.range : 0.24;
      tower.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      if (tower.type === 'delta') {
        this.updateDeltaAnchors(tower);
      }
    });
    if (this.hoverPlacement) {
      this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
      const definition = getTowerDefinition(this.hoverPlacement.towerType);
      const rangeFactor = definition ? definition.range : 0.24;
      this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
    }
  }

  handleCanvasPointerMove(event) {
    if (!this.levelActive || !this.levelConfig) {
      this.clearPlacementPreview();
      this.pointerPosition = null;
      this.clearEnemyHover();
      return;
    }

    const isTouchPointer = event.pointerType === 'touch';
    // Track touch samples so the same movement logic supports both pinch and one-finger pans.
    if (isTouchPointer) {
      this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (this.activePointers.size >= 2) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        this.performPinchZoom();
        this.pointerPosition = null;
        this.clearPlacementPreview();
        this.clearEnemyHover();
        return;
      }
    } else {
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
    }

    const isPanPointer =
      this.viewDragState.pointerId !== null &&
      event.pointerId === this.viewDragState.pointerId &&
      (!isTouchPointer || this.activePointers.size < 2);
    if (isPanPointer) {
      // Translate pointer movement into a clamped camera offset while dragging.
      const dx = event.clientX - this.viewDragState.startX;
      const dy = event.clientY - this.viewDragState.startY;
      const dragDistance = Math.hypot(dx, dy);
      if (!this.viewDragState.isDragging && dragDistance >= PLAYFIELD_VIEW_DRAG_THRESHOLD) {
        this.viewDragState.isDragging = true;
        this.suppressNextCanvasClick = true;
      }
      if (this.viewDragState.isDragging) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        this.pointerPosition = null;
        this.clearPlacementPreview();
        this.clearEnemyHover();
        const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 1;
        const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 1;
        const scale = this.viewScale || 1;
        const startCenter = this.viewDragState.startCenter || { x: 0.5, y: 0.5 };
        const nextCenter = {
          x: startCenter.x - dx / (scale * width),
          y: startCenter.y - dy / (scale * height),
        };
        this.viewCenterNormalized = this.clampViewCenterNormalized(nextCenter);
        this.applyViewConstraints();
        this.draw();
        return;
      }
    }

    const normalized = this.getNormalizedFromEvent(event);
    if (!normalized) {
      this.clearPlacementPreview();
      this.pointerPosition = null;
      this.clearEnemyHover();
      return;
    }

    this.pointerPosition = normalized;
    const position = this.getCanvasPosition(normalized);
    const hoveredEnemy = this.findEnemyAt(position);
    if (hoveredEnemy) {
      this.setEnemyHover(hoveredEnemy.enemy);
    } else {
      this.clearEnemyHover();
    }
    const hoveredTower = this.findTowerAt(position);
    if (!this.draggingTowerType && hoveredTower) {
      this.hoverPlacement = {
        normalized: { ...hoveredTower.normalized },
        position: { x: hoveredTower.x, y: hoveredTower.y },
        range: hoveredTower.range,
        valid: false,
        target: hoveredTower,
        towerType: hoveredTower.type,
        reason: 'Open lattice menu.',
      };
      if (!this.shouldAnimate) {
        this.draw();
      }
      return;
    }

    const activeType = this.draggingTowerType;
    if (activeType) {
      this.updatePlacementPreview(normalized, {
        towerType: activeType,
        dragging: Boolean(this.draggingTowerType),
      });
    } else {
      this.clearPlacementPreview();
    }

    if (!this.shouldAnimate) {
      this.draw();
    }
  }

  performPinchZoom() {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) {
      this.pinchState = null;
      this.isPinchZooming = false;
      return;
    }
    const [first, second] = pointers;
    const dx = first.clientX - second.clientX;
    const dy = first.clientY - second.clientY;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) {
      return;
    }
    const midpoint = {
      clientX: (first.clientX + second.clientX) / 2,
      clientY: (first.clientY + second.clientY) / 2,
    };
    const anchor = this.getCanvasRelativeFromClient(midpoint);
    if (!anchor) {
      return;
    }
    this.isPinchZooming = true;
    if (!this.pinchState || !Number.isFinite(this.pinchState.startDistance) || this.pinchState.startDistance <= 0) {
      this.pinchState = {
        startDistance: distance,
        startScale: this.viewScale,
      };
      return;
    }
    const baseDistance = this.pinchState.startDistance;
    const baseScale = this.pinchState.startScale || this.viewScale;
    if (!Number.isFinite(baseDistance) || baseDistance <= 0) {
      return;
    }
    const targetScale = (distance / baseDistance) * baseScale;
    this.setZoom(targetScale, anchor);
    this.pinchState.startScale = this.viewScale;
    this.pinchState.startDistance = distance;
  }

  handleCanvasPointerDown(event) {
    const isTouchPointer = event.pointerType === 'touch';
    if (isTouchPointer) {
      this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (this.activePointers.size < 2) {
        this.pinchState = null;
        this.isPinchZooming = false;
      } else {
        // Cancel any in-progress pan when a second touch begins a pinch gesture.
        this.viewDragState.pointerId = null;
        this.viewDragState.isDragging = false;
        this.suppressNextCanvasClick = true;
      }
    } else {
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
    }

    if (!this.levelConfig) {
      return;
    }

    const isPrimaryMouseDrag = !isTouchPointer && event.button === 0;
    const isSingleTouchDrag = isTouchPointer && this.activePointers.size < 2;
    if (!this.draggingTowerType && (isPrimaryMouseDrag || isSingleTouchDrag)) {
      // Allow both mouse input and single-finger touches to initiate camera panning.
      this.viewDragState.pointerId = event.pointerId;
      this.viewDragState.startX = event.clientX;
      this.viewDragState.startY = event.clientY;
      this.viewDragState.startCenter = { ...(this.viewCenterNormalized || { x: 0.5, y: 0.5 }) };
      this.viewDragState.isDragging = false;
      this.suppressNextCanvasClick = false;
      if (!isTouchPointer && typeof this.canvas?.setPointerCapture === 'function') {
        try {
          this.canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore pointer capture failures so mouse dragging still functions.
        }
      }
    }
  }

  handleCanvasPointerUp(event) {
    const isTouchPointer = event.pointerType === 'touch';
    if (isTouchPointer) {
      this.activePointers.delete(event.pointerId);
      if (this.activePointers.size < 2) {
        this.pinchState = null;
        this.isPinchZooming = false;
      }
    } else {
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
    }

    if (this.viewDragState.pointerId === event.pointerId) {
      if (this.viewDragState.isDragging) {
        this.suppressNextCanvasClick = true;
      }
      this.viewDragState.pointerId = null;
      this.viewDragState.isDragging = false;
    }

    if (!isTouchPointer && typeof this.canvas?.releasePointerCapture === 'function') {
      try {
        // Release mouse pointer capture so future drags start from a clean state.
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore browsers that throw if the pointer was not previously captured.
      }
    }
  }

  updatePlacementPreview(normalized, options = {}) {
    const { towerType, dragging = false } = options;
    if (!towerType || !normalized) {
      this.hoverPlacement = null;
      return;
    }

    const definition = getTowerDefinition(towerType);
    let placementNormalized = { ...normalized };
    const pointerPosition = this.getCanvasPosition(normalized);

    if (dragging) {
      const offsetX = this.dragPreviewOffset?.x || 0;
      const dragElevation = this.getPixelsForMeters(2); // Keep tower previews suspended two meters above the pointer.
      const offsetY = (this.dragPreviewOffset?.y || 0) - dragElevation;
      const adjustedPosition = {
        x: pointerPosition.x + offsetX,
        y: pointerPosition.y + offsetY,
      };
      const adjustedNormalized = this.getNormalizedFromCanvasPosition(adjustedPosition);
      if (adjustedNormalized) {
        placementNormalized = adjustedNormalized;
      }
    }

    let position = this.getCanvasPosition(placementNormalized);
    const existing = this.findTowerAt(position);
    const merging = Boolean(existing && existing.type === towerType);
    const nextId = merging ? getNextTowerId(towerType) : null;
    const nextDefinition = nextId ? getTowerDefinition(nextId) : null;

    if (merging && existing) {
      position = { x: existing.x, y: existing.y };
      const mergeNormalized = this.getNormalizedFromCanvasPosition(position);
      if (mergeNormalized) {
        placementNormalized = mergeNormalized;
      }
    }

    const validation = merging
      ? { valid: Boolean(nextDefinition), reason: nextDefinition ? '' : 'Peak tier reached.' }
      : this.validatePlacement(placementNormalized, { allowPathOverlap: false });

    if (!merging && validation.position) {
      position = validation.position;
    }

    const baseCost = this.getCurrentTowerCost(towerType);
    const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
    const actionCost = merging ? mergeCost : baseCost;
    const hasFunds = this.energy >= actionCost;

    let valid = validation.valid && hasFunds;
    let reason = '';
    const formattedCost = Math.round(actionCost);
    if (!validation.valid) {
      reason = validation.reason || 'Maintain clearance from the glyph lane.';
    } else if (!hasFunds) {
      const deficit = Math.ceil(actionCost - this.energy);
      if (merging && nextDefinition) {
        reason = `Need ${deficit} ${this.theroSymbol} to merge into ${nextDefinition.symbol}.`;
      } else if (definition) {
        reason = `Need ${deficit} ${this.theroSymbol} to lattice ${definition.symbol}.`;
      } else {
        reason = `Need ${deficit} ${this.theroSymbol} for this lattice.`;
      }
    } else if (merging && nextDefinition) {
      reason = `Merge into ${nextDefinition.symbol} for ${formattedCost} ${this.theroSymbol}.`;
    } else if (definition) {
      reason = `Anchor ${definition.symbol} for ${formattedCost} ${this.theroSymbol}.`;
    }

    const rangeFactor = definition ? definition.range : 0.24;
    this.hoverPlacement = {
      normalized: { ...placementNormalized },
      position,
      range: Math.min(this.renderWidth, this.renderHeight) * rangeFactor,
      valid,
      reason,
      towerType,
      dragging,
      mergeTarget: merging ? existing : null,
      merge: merging,
      cost: actionCost,
      symbol: definition?.symbol || '·',
      definition: definition || null,
      tier: Number.isFinite(definition?.tier) ? definition.tier : null,
    };
  }

  handleCanvasPointerLeave() {
    this.pointerPosition = null;
    this.clearPlacementPreview();
    this.clearEnemyHover();
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
    this.viewDragState.pointerId = null;
    this.viewDragState.isDragging = false;
  }

  // Attempt to gather any mote gems located near the pointer position.
  collectMoteGemsNear(position) {
    if (!position) {
      return 0;
    }
    const collected = collectMoteGemsWithinRadius(position, MOTE_GEM_COLLECTION_RADIUS, {
      reason: 'manual',
    });
    if (collected > 0 && this.audio) {
      this.audio.playSfx('uiConfirm');
    }
    return collected;
  }

  handleCanvasClick(event) {
    if (this.audio) {
      this.audio.unlock();
    }
    if (!this.levelActive || !this.levelConfig) {
      return;
    }

    if (this.suppressNextCanvasClick) {
      this.suppressNextCanvasClick = false;
      return;
    }

    if (this.isPinchZooming) {
      return;
    }

    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    const normalized = this.getNormalizedFromEvent(event);
    if (!normalized) {
      return;
    }

    const position = this.getCanvasPosition(normalized);
    const enemyTarget = this.findEnemyAt(position);
    const menuTower = this.getActiveMenuTower();
    if (enemyTarget) {
      if (menuTower && this.handleTowerMenuEnemySelection(menuTower, enemyTarget.enemy)) {
        return;
      }
      this.toggleEnemyFocus(enemyTarget.enemy);
      return;
    }

    if (this.activeTowerMenu && this.handleTowerMenuClick(position)) {
      return;
    }

    if (this.collectMoteGemsNear(position)) {
      return;
    }

    const tower = this.findTowerAt(position);
    if (tower) {
      if (this.activeTowerMenu?.towerId === tower.id) {
        this.closeTowerMenu();
      } else {
        this.openTowerMenu(tower);
      }
      return;
    }

    if (this.activeTowerMenu) {
      this.closeTowerMenu();
    }
  }

  handleCanvasWheel(event) {
    if (!this.levelActive || !this.levelConfig) {
      return;
    }
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof this.dependencies.isFieldNotesOverlayVisible === 'function' && this.dependencies.isFieldNotesOverlayVisible()) {
      return;
    }
    const anchor = this.getCanvasRelativeFromClient({ clientX: event.clientX, clientY: event.clientY });
    if (!anchor) {
      return;
    }
    const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
    const factor = Math.exp(-delta * 0.0015);
    this.applyZoomFactor(factor, anchor);
  }

  applyZoomFactor(factor, anchor) {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }
    const targetScale = this.viewScale * factor;
    this.setZoom(targetScale, anchor);
  }

  setZoom(targetScale, anchor) {
    if (!Number.isFinite(targetScale)) {
      return false;
    }
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const screenPoint = anchor || { x: width / 2, y: height / 2 };
    const anchorWorld = this.screenToWorld(screenPoint);
    const clampedScale = Math.min(this.maxViewScale, Math.max(this.minViewScale, targetScale));
    const previousScale = this.viewScale;
    this.viewScale = clampedScale;
    this.applyViewConstraints();
    if (anchorWorld) {
      const offsetX = (screenPoint.x - width / 2) / this.viewScale;
      const offsetY = (screenPoint.y - height / 2) / this.viewScale;
      this.setViewCenterFromWorld({
        x: anchorWorld.x - offsetX,
        y: anchorWorld.y - offsetY,
      });
    } else {
      this.applyViewConstraints();
    }
    this.applyViewConstraints();
    const scaleChanged = Math.abs(previousScale - this.viewScale) > 0.0001;
    this.draw();
    return scaleChanged;
  }

  clearPlacementPreview() {
    if (!this.hoverPlacement) {
      return;
    }
    this.hoverPlacement = null;
    if (!this.shouldAnimate) {
      this.draw();
    }
  }

  clearEnemyHover() {
    this.hoverEnemy = null;
    if (this.enemyTooltip) {
      this.enemyTooltip.dataset.visible = 'false';
      this.enemyTooltip.setAttribute('aria-hidden', 'true');
    }
  }

  getNormalizedFromEvent(event) {
    if (!this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.renderWidth || 0;
    const height = rect.height || this.renderHeight || 0;
    if (!width || !height) {
      return null;
    }
    const relative = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    if (!Number.isFinite(relative.x) || !Number.isFinite(relative.y)) {
      return null;
    }
    const world = this.screenToWorld(relative);
    if (!world) {
      return null;
    }
    const normalized = {
      x: world.x / (this.renderWidth || width),
      y: world.y / (this.renderHeight || height),
    };
    return this.clampNormalized(normalized);
  }

  findTowerAt(position) {
    const hitRadius = Math.max(18, Math.min(this.renderWidth, this.renderHeight) * 0.045);
    for (let index = this.towers.length - 1; index >= 0; index -= 1) {
      const tower = this.towers[index];
      const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
      if (distance <= hitRadius) {
        return tower;
      }
    }
    return null;
  }

  getEnemyHitRadius(enemy = null, metrics = null) {
    const baseRadius = Math.max(16, Math.min(this.renderWidth, this.renderHeight) * 0.05);
    if (!enemy || !metrics) {
      return baseRadius;
    }
    const { focusRadius = 0, ringRadius = 0 } = metrics;
    return Math.max(baseRadius, focusRadius || ringRadius || baseRadius);
  }

  /**
   * Locate the currently selected tower so option clicks can mutate its settings.
   */
  getActiveMenuTower() {
    if (!this.activeTowerMenu?.towerId) {
      return null;
    }
    const tower = this.towers.find((candidate) => candidate?.id === this.activeTowerMenu.towerId);
    if (!tower) {
      this.activeTowerMenu = null;
    }
    return tower || null;
  }

  /**
   * Present the radial command menu for the supplied tower.
   */
  openTowerMenu(tower, options = {}) {
    if (!tower) {
      return;
    }
    const timestamp =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    this.activeTowerMenu = { towerId: tower.id, openedAt: timestamp };
    if (this.messageEl && !options.silent) {
      const label = tower.definition?.name || `${tower.symbol || 'Tower'}`;
      this.messageEl.textContent = `${label} command lattice ready.`;
    }
  }

  /**
   * Hide any open radial tower menu.
   */
  closeTowerMenu() {
    this.activeTowerMenu = null;
  }

  /**
   * Generate option metadata for the active tower menu.
   */
  buildTowerMenuOptions(tower) {
    if (!tower) {
      return [];
    }
    const options = [];
    options.push({
      id: 'sell',
      type: 'action',
      icon: '$þ',
      label: 'Sell lattice',
    });
    // Surface the tower dossier overlay entry point directly inside the radial menu.
    options.push({
      id: 'info',
      type: 'info',
      icon: 'ℹ',
      label: 'Tower information',
    });
    const priority = tower.targetPriority || 'first';
    options.push({
      id: 'priority-first',
      type: 'priority',
      value: 'first',
      icon: '1st',
      label: 'First priority',
      selected: priority === 'first',
    });
    options.push({
      id: 'priority-strongest',
      type: 'priority',
      value: 'strongest',
      icon: 'Str',
      label: 'Strongest priority',
      selected: priority === 'strongest',
    });
    if (tower.type === 'delta') {
      const mode = tower.behaviorMode || 'pursuit';
      options.push({
        id: 'delta-pursuit',
        type: 'mode',
        value: 'pursuit',
        icon: 'Δ→',
        label: 'Pursue target',
        selected: mode === 'pursuit',
      });
      options.push({
        id: 'delta-track',
        type: 'mode',
        value: 'trackHold',
        icon: 'Δ∥',
        label: 'Hold track',
        selected: mode === 'trackHold',
      });
      options.push({
        id: 'delta-guard',
        type: 'mode',
        value: 'sentinel',
        icon: 'Δ◎',
        label: 'Guard tower',
        selected: mode === 'sentinel',
      });
    }
    return options;
  }

  /**
   * Compute the world-space layout for the radial menu options.
   */
  getTowerMenuGeometry(tower) {
    const options = this.buildTowerMenuOptions(tower);
    if (!tower || !options.length) {
      return null;
    }
    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const optionRadius = Math.max(22, minDimension * 0.04);
    const ringRadius = Math.max(optionRadius * 2.4, minDimension * 0.12);
    const startAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / options.length;
    const layout = options.map((option, index) => {
      const angle = startAngle + index * angleStep;
      return {
        ...option,
        angle,
        center: {
          x: tower.x + Math.cos(angle) * ringRadius,
          y: tower.y + Math.sin(angle) * ringRadius,
        },
      };
    });
    return { options: layout, optionRadius, ringRadius };
  }

  /**
   * Handle clicks on the radial tower command menu.
   */
  handleTowerMenuClick(position) {
    const tower = this.getActiveMenuTower();
    if (!tower) {
      return false;
    }
    const geometry = this.getTowerMenuGeometry(tower);
    if (!geometry) {
      return false;
    }
    const { options, optionRadius } = geometry;
    const hitRadius = optionRadius * 1.1;
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const dx = position.x - option.center.x;
      const dy = position.y - option.center.y;
      const distance = Math.hypot(dx, dy);
      if (distance > hitRadius) {
        continue;
      }
      this.executeTowerMenuOption(tower, option);
      return true;
    }
    return false;
  }

  /**
   * Apply the effect of a selected tower option.
   */
  executeTowerMenuOption(tower, option) {
    if (!tower || !option) {
      return;
    }
    if (option.type === 'action' && option.id === 'sell') {
      this.sellTower(tower);
      return;
    }
    if (option.type === 'info') {
      // Route the command to the tower overlay so players can review formulas mid-combat.
      if (tower?.type) {
        const contextTowers = this.towers
          .map((candidate) => ({
            id: candidate?.id,
            type: candidate?.type,
            x: candidate?.x,
            y: candidate?.y,
            range: candidate?.range,
          }))
          .filter((entry) => entry.id && Number.isFinite(entry.x) && Number.isFinite(entry.y));
        openTowerUpgradeOverlay(tower.type, {
          contextTowerId: tower.id,
          contextTower: {
            id: tower.id,
            type: tower.type,
            x: tower.x,
            y: tower.y,
            range: tower.range,
          },
          contextTowers,
        });
      }
      if (this.messageEl) {
        const label = tower.definition?.name || `${tower.symbol || 'Tower'}`;
        this.messageEl.textContent = `${label} dossier projected over the field.`;
      }
      this.closeTowerMenu();
      return;
    }
    if (option.type === 'priority' && option.value) {
      if (tower.targetPriority !== option.value) {
        tower.targetPriority = option.value;
        if (this.messageEl) {
          this.messageEl.textContent = `Target priority set to ${
            option.value === 'strongest' ? 'strongest' : 'first'
          }.`;
        }
      }
      this.openTowerMenu(tower, { silent: true });
      return;
    }
    if (option.type === 'mode' && tower.type === 'delta' && option.value) {
      if (tower.behaviorMode !== option.value) {
        this.configureDeltaBehavior(tower, option.value);
        if (this.messageEl) {
          const descriptor =
            option.value === 'trackHold'
              ? 'Holding the glyph lane.'
              : option.value === 'sentinel'
              ? 'Guarding the lattice.'
              : 'Pursuing threats.';
          this.messageEl.textContent = `Δ cohort stance updated—${descriptor}`;
        }
      }
      this.openTowerMenu(tower, { silent: true });
    }
  }

  /**
   * Allow the player to mark a manual target for sentry mode Delta soldiers.
   */
  handleTowerMenuEnemySelection(tower, enemy) {
    if (!tower || tower.type !== 'delta' || tower.behaviorMode !== 'sentinel' || !enemy) {
      return false;
    }
    const state = this.ensureDeltaState(tower);
    if (!state) {
      return false;
    }
    state.manualTargetId = enemy.id;
    if (this.messageEl) {
      const label = enemy.label || this.resolveEnemySymbol(enemy) || 'glyph';
      this.messageEl.textContent = `Δ cohort assigned to ${label}.`;
    }
    this.openTowerMenu(tower, { silent: true });
    return true;
  }

  /**
   * Ensure every tower starts with sensible defaults and required state containers.
   */
  applyTowerBehaviorDefaults(tower) {
    if (!tower) {
      return;
    }
    if (!tower.targetPriority) {
      tower.targetPriority = 'first';
    }
    if (!tower.behaviorMode) {
      tower.behaviorMode = 'pursuit';
    }
    if (tower.type === 'delta') {
      this.ensureDeltaState(tower);
      this.configureDeltaBehavior(tower, tower.behaviorMode);
    } else if (tower.deltaState) {
      this.teardownDeltaTower(tower);
    }
  }

  /**
   * Create or update the Delta state container so soldiers can be simulated.
   */
  ensureDeltaState(tower) {
    if (!tower || tower.type !== 'delta') {
      return null;
    }
    const gamma = getTowerDefinition('gamma') || {};
    const alpha = getTowerDefinition('alpha') || {};
    const rawAtk = Number.isFinite(tower.definition?.atk)
      ? tower.definition.atk
      : Number.isFinite(gamma.damage)
      ? gamma.damage
      : Math.max(1, tower.baseDamage || 0);
    const atk = Math.max(1, rawAtk);
    const rawReg = Number.isFinite(tower.definition?.reg) ? tower.definition.reg : 0.01;
    const regenPercent = rawReg > 1 ? rawReg / 100 : Math.max(0, rawReg);
    const rawTot = Number.isFinite(tower.definition?.tot) ? tower.definition.tot : 5;
    const maxSoldiers = Math.max(1, Math.round(rawTot));
    const rawDefense = Number.isFinite(tower.definition?.def)
      ? tower.definition.def
      : Number.isFinite(alpha.damage)
      ? alpha.damage
      : 0;
    const defense = Math.max(0, rawDefense);
    const deltaProduct = atk * Math.max(regenPercent, 0.0001) * maxSoldiers * Math.max(defense, 1);

    if (!tower.deltaState) {
      tower.deltaState = {
        atk,
        regenPercent,
        maxSoldiers,
        defense,
        product: deltaProduct,
        soldiers: [],
        manualTargetId: null,
        soldierCounter: 0,
        trackHoldPoint: null,
        mode: tower.behaviorMode || 'pursuit',
      };
    } else {
      tower.deltaState.atk = atk;
      tower.deltaState.regenPercent = regenPercent;
      tower.deltaState.maxSoldiers = maxSoldiers;
      tower.deltaState.defense = defense;
      tower.deltaState.product = deltaProduct;
    }
    return tower.deltaState;
  }

  /**
   * Update Delta soldier stance and anchor points when the player changes modes.
   */
  configureDeltaBehavior(tower, mode) {
    if (!tower || tower.type !== 'delta') {
      tower.behaviorMode = mode;
      return;
    }
    const state = this.ensureDeltaState(tower);
    const nextMode = mode || 'pursuit';
    tower.behaviorMode = nextMode;
    state.mode = nextMode;
    if (nextMode !== 'sentinel') {
      this.clearTowerManualTarget(tower);
    }
    this.updateDeltaAnchors(tower);
  }

  /**
   * Remove any lingering Delta data once a tower is dismantled or upgraded away.
   */
  teardownDeltaTower(tower) {
    if (!tower?.deltaState) {
      return;
    }
    tower.deltaState.soldiers = [];
    tower.deltaState.manualTargetId = null;
    tower.deltaState = null;
  }

  /**
   * Keep the cached track-hold anchor aligned with the latest path layout.
   */
  updateDeltaAnchors(tower) {
    if (!tower || tower.type !== 'delta') {
      return;
    }
    const state = this.ensureDeltaState(tower);
    if (tower.behaviorMode === 'trackHold') {
      const anchor = this.getClosestPointOnPath({ x: tower.x, y: tower.y });
      state.trackHoldPoint = anchor?.point || { x: tower.x, y: tower.y };
    }
  }

  /**
   * Clear any manual Delta target.
   */
  clearTowerManualTarget(tower) {
    if (!tower?.deltaState?.manualTargetId) {
      return false;
    }
    tower.deltaState.manualTargetId = null;
    return true;
  }

  /**
   * Retrieve the live enemy chosen for manual Delta focus.
   */
  getTowerManualTarget(tower) {
    if (!tower?.deltaState?.manualTargetId) {
      return null;
    }
    const enemy = this.enemies.find((candidate) => candidate?.id === tower.deltaState.manualTargetId);
    if (!enemy || enemy.hp <= 0) {
      this.clearTowerManualTarget(tower);
      return null;
    }
    return enemy;
  }
  getEnemyVisualMetrics(enemy) {
    if (!enemy) {
      return {
        scale: 1,
        coreRadius: 9,
        ringRadius: 12,
        focusRadius: 18,
        symbolSize: 17,
        exponentSize: 13,
      };
    }

    const moteFactor = Math.max(1, Number.isFinite(enemy.moteFactor) ? enemy.moteFactor : 1);
    const exponent = Math.max(
      1,
      Number.isFinite(enemy.hpExponent)
        ? enemy.hpExponent
        : this.calculateHealthExponent(
            Number.isFinite(enemy.hp) && enemy.hp > 0 ? enemy.hp : enemy.maxHp,
          ),
    );
    const sizeFactor = Math.max(moteFactor, exponent);
    const growth = Number.isFinite(sizeFactor) && sizeFactor > 0 ? Math.log2(sizeFactor) : 0;
    const clampedGrowth = Math.min(Math.max(growth, 0), 4);
    const scale = 1 + clampedGrowth * 0.2;

    const coreRadius = 9 * scale;
    const ringRadius = 12 * scale;
    const focusRadius = ringRadius + 6 * scale;
    const symbolSize = Math.round(Math.min(34, Math.max(16, 17 * scale)));
    const exponentSize = Math.round(Math.min(22, Math.max(9, 12 * scale * 0.62)));

    return { scale, coreRadius, ringRadius, focusRadius, symbolSize, exponentSize };
  }

  updateFocusIndicator(delta) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }
    const focusedEnemy = this.getFocusedEnemy();
    if (!focusedEnemy) {
      this.focusMarkerAngle = 0;
      return;
    }
    const spinSpeed = Math.PI * 1.2;
    this.focusMarkerAngle = (this.focusMarkerAngle + delta * spinSpeed) % (Math.PI * 2);
  }

  findEnemyAt(position) {
    if (!this.enemies.length) {
      return null;
    }
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      const enemyPosition = this.getEnemyPosition(enemy);
      const metrics = this.getEnemyVisualMetrics(enemy);
      const hitRadius = this.getEnemyHitRadius(enemy, metrics);
      const distance = Math.hypot(position.x - enemyPosition.x, position.y - enemyPosition.y);
      if (distance <= hitRadius) {
        return { enemy, position: enemyPosition };
      }
    }
    return null;
  }

  setEnemyHover(enemy) {
    if (!enemy) {
      this.clearEnemyHover();
      return;
    }
    this.hoverEnemy = { enemyId: enemy.id };
    this.renderEnemyTooltip(enemy);
  }

  getFocusedEnemy() {
    if (!this.focusedEnemyId) {
      return null;
    }
    const enemy = this.enemies.find((candidate) => candidate?.id === this.focusedEnemyId);
    if (!enemy || enemy.hp <= 0) {
      this.clearFocusedEnemy({ silent: true });
      return null;
    }
    return enemy;
  }

  setFocusedEnemy(enemy, options = {}) {
    if (!enemy) {
      this.clearFocusedEnemy(options);
      return;
    }
    const { silent = false } = options;
    this.focusedEnemyId = enemy.id;
    const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
    const descriptor = enemy.label ? enemy.label : symbol;
    this.focusMarkerAngle = 0;
    if (!silent && this.messageEl) {
      this.messageEl.textContent = `All towers focusing on ${descriptor}.`;
    }
  }

  clearFocusedEnemy(options = {}) {
    const { silent = false } = options;
    if (!this.focusedEnemyId) {
      this.focusMarkerAngle = 0;
      return false;
    }
    this.focusedEnemyId = null;
    this.focusMarkerAngle = 0;
    if (!silent && this.messageEl) {
      this.messageEl.textContent = 'Focus fire cleared—towers resume optimal targeting.';
    }
    return true;
  }

  toggleEnemyFocus(enemy) {
    if (!enemy) {
      this.clearFocusedEnemy();
      return;
    }
    if (this.focusedEnemyId === enemy.id) {
      this.clearFocusedEnemy();
    } else {
      this.setFocusedEnemy(enemy);
    }
  }

  renderEnemyTooltip(enemy) {
    if (!this.enemyTooltip || !this.pointerPosition) {
      this.clearEnemyHover();
      return;
    }

    const pointerCanvas = this.getCanvasPosition(this.pointerPosition);
    const enemyPosition = this.getEnemyPosition(enemy);
    const metrics = this.getEnemyVisualMetrics(enemy);
    const distance = Math.hypot(pointerCanvas.x - enemyPosition.x, pointerCanvas.y - enemyPosition.y);
    if (distance > this.getEnemyHitRadius(enemy, metrics)) {
      this.clearEnemyHover();
      return;
    }

    const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
    const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
    const exponent = this.calculateHealthExponent(remainingHp);
    if (this.enemyTooltipNameEl) {
      // Surface the decimal exponent in the tooltip so hover details mirror the battlefield indicators.
      this.enemyTooltipNameEl.textContent = `${symbol}^${exponent.toFixed(1)} — ${
        enemy.label || 'Glyph'
      }`;
    }
    if (this.enemyTooltipHpEl) {
      const hpText = formatGameNumber(remainingHp);
      this.enemyTooltipHpEl.textContent = `Remaining HP: 10^${exponent.toFixed(1)} (${hpText})`;
    }

    const screenPosition = this.worldToScreen(enemyPosition);
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;

    if (
      !screenPosition ||
      screenPosition.x < 0 ||
      screenPosition.y < 0 ||
      screenPosition.x > width ||
      screenPosition.y > height
    ) {
      this.enemyTooltip.dataset.visible = 'false';
      this.enemyTooltip.setAttribute('aria-hidden', 'true');
      return;
    }

    this.enemyTooltip.style.left = `${screenPosition.x}px`;
    this.enemyTooltip.style.top = `${screenPosition.y}px`;
    this.enemyTooltip.dataset.visible = 'true';
    this.enemyTooltip.setAttribute('aria-hidden', 'false');
  }

  updateEnemyTooltipPosition() {
    if (!this.hoverEnemy) {
      return;
    }

    const enemy = this.enemies.find((candidate) => candidate.id === this.hoverEnemy.enemyId);
    if (!enemy || !this.pointerPosition) {
      this.clearEnemyHover();
      return;
    }

    this.renderEnemyTooltip(enemy);
  }

  syncAlephChainStats() {
    if (!this.alephChain) {
      return;
    }

    const states = this.alephChain.getAllStates();
    const rangeMultiplier = this.alephChain.getRangeMultiplier();
    const speedMultiplier = this.alephChain.getSpeedMultiplier();
    const linkCount = this.alephChain.getLinkCount();

    this.towers.forEach((tower) => {
      const baseDamage = Number.isFinite(tower.baseDamage)
        ? tower.baseDamage
        : Number.isFinite(tower.definition?.damage)
        ? tower.definition.damage
        : tower.damage;
      const baseRate = Number.isFinite(tower.baseRate)
        ? tower.baseRate
        : Number.isFinite(tower.definition?.rate)
        ? tower.definition.rate
        : tower.rate;
      const baseRange = Number.isFinite(tower.baseRange)
        ? tower.baseRange
        : Math.min(this.renderWidth, this.renderHeight) * (tower.definition?.range ?? 0.78);

      tower.baseDamage = baseDamage;
      tower.baseRate = baseRate;
      tower.baseRange = baseRange;

      if (tower.type !== 'aleph-null') {
        if (tower.chain) {
          tower.chain = null;
          tower.damage = baseDamage;
          tower.rate = baseRate;
          tower.range = baseRange;
        }
        return;
      }

      const state = states.get(tower.id) || null;
      if (!state) {
        tower.chain = null;
        tower.damage = baseDamage;
        tower.rate = baseRate;
        tower.range = baseRange;
        return;
      }

      tower.chain = {
        index: state.index,
        totalDamage: state.totalDamage,
        rangeMultiplier,
        speedMultiplier,
        linkCount,
      };
      tower.damage = state.totalDamage;
      tower.rate = baseRate * speedMultiplier;
      tower.range = baseRange * rangeMultiplier;
    });
  }

  handleAlephTowerAdded(tower) {
    if (!tower || tower.type !== 'aleph-null' || !this.alephChain) {
      return;
    }
    this.alephChain.registerTower(tower.id, tower.baseDamage);
    this.syncAlephChainStats();
  }

  handleAlephTowerRemoved(tower) {
    if (!tower || tower.type !== 'aleph-null' || !this.alephChain) {
      return;
    }
    this.alephChain.unregisterTower(tower.id);
    this.syncAlephChainStats();
  }

  getTowerEquationScribbleText(towerType) {
    if (!towerType) {
      return '';
    }
    const blueprint = getTowerEquationBlueprint(towerType);
    if (!blueprint || !blueprint.baseEquation) {
      return '';
    }
    return convertMathExpressionToPlainText(blueprint.baseEquation);
  }

  spawnTowerEquationScribble(tower, options = {}) {
    if (!tower || !this.container) {
      return;
    }
    const { towerType = tower.type, silent = false } = options;
    if (silent) {
      return;
    }
    const equationText = this.getTowerEquationScribbleText(towerType);
    if (!equationText) {
      return;
    }
    if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return;
    }

    const effect = document.createElement('div');
    effect.className = 'tower-equation-scribble';
    effect.style.left = `${tower.x}px`;
    effect.style.top = `${tower.y}px`;

    const text = document.createElement('span');
    text.className = 'tower-equation-scribble__text';
    text.textContent = equationText;
    effect.append(text);

    const cleanup = () => {
      effect.removeEventListener('animationend', handleAnimationEnd);
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    };

    const handleAnimationEnd = (event) => {
      if (event.target === effect && event.animationName === 'tower-scribble-dissipate') {
        cleanup();
      }
    };

    effect.addEventListener('animationend', handleAnimationEnd);
    this.container.append(effect);

    setTimeout(() => {
      if (effect.parentNode) {
        cleanup();
      }
    }, 2400);
  }

  addTowerAt(normalized, options = {}) {
    const {
      slot = null,
      allowPathOverlap = false,
      silent = false,
      towerType = null,
    } = options;

    if (!this.levelConfig || !normalized) {
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const selectedType = towerType || this.draggingTowerType || this.availableTowers[0];
    const definition = getTowerDefinition(selectedType);
    if (!definition) {
      if (this.messageEl && !silent) {
        this.messageEl.textContent = 'Select a tower from your loadout to lattice it.';
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    if (!this.availableTowers.includes(selectedType)) {
      if (this.messageEl && !silent) {
        this.messageEl.textContent = `${definition.symbol} is not prepared in your loadout.`;
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const canvasPosition = this.getCanvasPosition(normalized);
    const existingTower = this.findTowerAt(canvasPosition);
    let placement = { valid: true, position: canvasPosition };
    let mergeTarget = null;
    let nextDefinition = null;
    let merging = false;

    if (existingTower && existingTower.type === selectedType) {
      const nextId = getNextTowerId(selectedType);
      if (!nextId) {
        if (this.messageEl && !silent) {
          this.messageEl.textContent = `${definition.symbol} already resonates at its peak tier.`;
        }
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }
      nextDefinition = getTowerDefinition(nextId);
      mergeTarget = existingTower;
      merging = true;
      placement.position = { x: mergeTarget.x, y: mergeTarget.y };
    } else {
      placement = this.validatePlacement(normalized, { allowPathOverlap });
      if (!placement.valid) {
        if (this.messageEl && placement.reason && !silent) {
          this.messageEl.textContent = placement.reason;
        }
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }
    }

    if (!isTowerUnlocked(selectedType)) {
      unlockTower(selectedType, { silent: true });
    }

    const baseCost = this.getCurrentTowerCost(selectedType);
    const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
    const actionCost = merging ? mergeCost : baseCost;

    if (this.energy < actionCost) {
      const needed = Math.ceil(actionCost - this.energy);
      if (this.messageEl && !silent) {
        if (merging && nextDefinition) {
          this.messageEl.textContent = `Need ${needed} ${this.theroSymbol} more to merge into ${nextDefinition.symbol}.`;
        } else {
          this.messageEl.textContent = `Need ${needed} ${this.theroSymbol} more to lattice ${definition.symbol}.`;
        }
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    this.energy = Math.max(0, this.energy - actionCost);

    if (merging && mergeTarget && nextDefinition) {
      const wasAlephNull = mergeTarget.type === 'aleph-null';
      if (wasAlephNull) {
        this.handleAlephTowerRemoved(mergeTarget);
      }

      const range = Math.min(this.renderWidth, this.renderHeight) * nextDefinition.range;
      const baseDamage = Number.isFinite(nextDefinition.damage) ? nextDefinition.damage : 0;
      const baseRate = Number.isFinite(nextDefinition.rate) ? nextDefinition.rate : 1;
      mergeTarget.type = nextDefinition.id;
      mergeTarget.definition = nextDefinition;
      mergeTarget.symbol = nextDefinition.symbol;
      mergeTarget.tier = nextDefinition.tier;
      mergeTarget.damage = baseDamage;
      mergeTarget.rate = baseRate;
      mergeTarget.range = range;
      mergeTarget.baseDamage = baseDamage;
      mergeTarget.baseRate = baseRate;
      mergeTarget.baseRange = range;
      mergeTarget.cooldown = 0;
      mergeTarget.chain = null;
      this.applyTowerBehaviorDefaults(mergeTarget);
      const nextIsAlephNull = nextDefinition.id === 'aleph-null';
      if (nextIsAlephNull) {
        this.handleAlephTowerAdded(mergeTarget);
      } else if (wasAlephNull) {
        this.syncAlephChainStats();
      }
      this.spawnTowerEquationScribble(mergeTarget, {
        towerType: nextDefinition.id,
        silent,
      });
      const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
        ? unlockTower(nextDefinition.id, { silent: true })
        : false;
      if (this.messageEl && !silent) {
        const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
        this.messageEl.textContent = `${definition.symbol} lattices fused into ${nextDefinition.symbol}.${unlockNote}`;
      }
      notifyTowerPlaced(this.towers.length);
      this.updateTowerPositions();
      this.updateHud();
      this.draw();
      refreshTowerLoadoutDisplay();
      this.dependencies.updateStatusDisplays();
      if (this.audio && !silent) {
        this.audio.playSfx('towerMerge');
      }
      return true;
    }

    const baseRange = Math.min(this.renderWidth, this.renderHeight) * definition.range;
    const baseDamage = Number.isFinite(definition.damage) ? definition.damage : 0;
    const baseRate = Number.isFinite(definition.rate) ? definition.rate : 1;
    const tower = {
      id: `tower-${(this.towerIdCounter += 1)}`,
      type: selectedType,
      definition,
      symbol: definition.symbol,
      tier: definition.tier,
      normalized: { ...normalized },
      x: placement.position.x,
      y: placement.position.y,
      range: baseRange,
      damage: baseDamage,
      rate: baseRate,
      baseRange,
      baseDamage,
      baseRate,
      cooldown: 0,
      slot,
    };

    this.applyTowerBehaviorDefaults(tower);
    this.towers.push(tower);
    this.handleAlephTowerAdded(tower);
    notifyTowerPlaced(this.towers.length);

    if (slot) {
      slot.tower = tower;
      if (slot.button) {
        slot.button.classList.add('tower-built');
        slot.button.setAttribute('aria-pressed', 'true');
      }
    }

    this.hoverPlacement = null;
    if (this.messageEl && !silent) {
      this.messageEl.textContent = `${definition.symbol} lattice anchored—harmonics align.`;
    }
    this.spawnTowerEquationScribble(tower, { towerType: selectedType, silent });
    this.updateHud();
    this.draw();
    refreshTowerLoadoutDisplay();
    this.dependencies.updateStatusDisplays();
    if (this.audio && !silent) {
      this.audio.playSfx('towerPlace');
      playTowerPlacementNotes(this.audio, 1);
    }
    return true;
  }

  sellTower(tower, { slot } = {}) {
    if (!tower) {
      return;
    }

    if (this.activeTowerMenu?.towerId === tower.id) {
      this.closeTowerMenu();
    }

    this.teardownDeltaTower(tower);
    this.handleAlephTowerRemoved(tower);

    const index = this.towers.indexOf(tower);
    if (index >= 0) {
      this.towers.splice(index, 1);
    }

    const resolvedSlot = slot || tower.slot || null;
    if (resolvedSlot) {
      resolvedSlot.tower = null;
      if (resolvedSlot.button) {
        resolvedSlot.button.classList.remove('tower-built');
        resolvedSlot.button.setAttribute('aria-pressed', 'false');
      }
    }

    if (this.levelConfig) {
      const definition = getTowerDefinition(tower.type);
      const baseRefund = definition ? definition.baseCost : this.getCurrentTowerCost(tower.type);
      const refund = Math.round(baseRefund * 0.5);
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      this.energy = Math.min(cap, this.energy + refund);
      if (this.messageEl) {
        this.messageEl.textContent = `Lattice released—refunded ${refund} ${this.theroSymbol}.`;
      }
    }

    this.updateHud();
    this.draw();
    refreshTowerLoadoutDisplay();
    this.dependencies.updateStatusDisplays();
    if (this.audio) {
      this.audio.playSfx('towerSell');
    }
  }

  validatePlacement(normalized, options = {}) {
    const { allowPathOverlap = false } = options;
    if (!this.levelConfig) {
      return { valid: false, reason: 'Activate a level first.' };
    }

    const position = this.getCanvasPosition(normalized);
    const minDimension = Math.min(this.renderWidth, this.renderHeight) || 1;
    const minSpacing = minDimension * 0.12;

    for (let index = 0; index < this.towers.length; index += 1) {
      const tower = this.towers[index];
      const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
      if (distance < minSpacing) {
        return { valid: false, reason: 'Too close to another lattice.', position };
      }
    }

    if (!allowPathOverlap) {
      const pathBuffer = minDimension * 0.06;
      const clearance = this.getDistanceToPath(position);
      if (clearance < pathBuffer) {
        return { valid: false, reason: 'Maintain clearance from the glyph lane.', position };
      }
    }

    return { valid: true, position };
  }

  getDistanceToPath(point) {
    if (!this.pathSegments.length) {
      return Infinity;
    }

    let shortest = Infinity;
    for (let index = 0; index < this.pathSegments.length; index += 1) {
      const segment = this.pathSegments[index];
      const distance = this.distancePointToSegment(point, segment.start, segment.end);
      if (distance < shortest) {
        shortest = distance;
      }
    }
    return shortest;
  }

  distancePointToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = start.x + clampedT * dx;
    const projY = start.y + clampedT * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  /**
   * Project a point onto a path segment and expose the ratio along that segment.
   */
  projectPointOntoSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return { point: { x: start.x, y: start.y }, ratio: 0 };
    }
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    return {
      point: {
        x: start.x + clamped * dx,
        y: start.y + clamped * dy,
      },
      ratio: clamped,
    };
  }

  /**
   * Find the closest point along the glyph path to the provided coordinate.
   */
  getClosestPointOnPath(point) {
    if (!point || !this.pathSegments.length) {
      return { point: point ? { ...point } : { x: 0, y: 0 }, progress: 0 };
    }
    let best = null;
    let bestDistance = Infinity;
    let traversed = 0;
    let bestProgress = 0;
    for (let index = 0; index < this.pathSegments.length; index += 1) {
      const segment = this.pathSegments[index];
      const projection = this.projectPointOntoSegment(point, segment.start, segment.end);
      const distance = Math.hypot(point.x - projection.point.x, point.y - projection.point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = projection.point;
        const segmentLength = segment.length || Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
        bestProgress = this.pathLength
          ? (traversed + segmentLength * projection.ratio) / this.pathLength
          : 0;
      }
      traversed += segment.length || 0;
    }
    return { point: best || { ...point }, progress: Math.max(0, Math.min(1, bestProgress)) };
  }

  handleSlotInteraction(slot) {
    if (this.audio) {
      this.audio.unlock();
    }
    if (!this.levelActive || !this.levelConfig) {
      if (this.audio) {
        this.audio.playSfx('error');
      }
      if (this.messageEl) {
        this.messageEl.textContent =
          'Select an unlocked defense, then etch α lattices directly onto the canvas.';
      }
      return;
    }

    if (slot.tower) {
      this.openTowerMenu(slot.tower, { viaSlot: true });
      return;
    }

    if (this.messageEl) {
      this.messageEl.textContent = 'Drag a tower chip from the loadout to lattice it here.';
    }
  }

  placeTower(slot) {
    this.addTowerAt(slot?.normalized || null, { slot, allowPathOverlap: true });
  }

  removeTower(slot) {
    this.sellTower(slot?.tower || null, { slot });
  }

  handleStartButton() {
    if (this.audio) {
      this.audio.unlock();
    }
    if (!this.levelActive || !this.levelConfig || this.combatActive) {
      return;
    }
    if (!this.towers.length) {
      if (this.messageEl) {
        this.messageEl.textContent = 'Anchor at least one tower before commencing.';
      }
      return;
    }

    if (this.audio) {
      this.audio.playSfx('uiConfirm');
    }

    this.cancelAutoStart();
    this.combatActive = true;
    this.resolvedOutcome = null;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.enemyIdCounter = 0;
    this.enemies = [];
    this.projectiles = [];
    this.activeWave = this.createWaveState(this.levelConfig.waves[0], { initialWave: true });
    this.lives = this.levelConfig.lives;
    this.markWaveStart();

    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = 'Wave Running';
    }
    if (this.messageEl) {
      this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label} advance.`;
    }
    this.updateHud();
    this.updateProgress();

    if (this.onCombatStart) {
      this.onCombatStart(this.levelConfig.id);
    }
  }

  getCycleMultiplier() {
    return this.isEndlessMode ? 10 ** this.endlessCycle : 1;
  }

  computeWaveNumber(index = this.waveIndex) {
    if (!this.levelConfig) {
      return 0;
    }
    const total = this.baseWaveCount || this.levelConfig.waves.length || 0;
    if (!this.isEndlessMode) {
      return index + 1;
    }
    return this.endlessCycle * total + index + 1;
  }

  markWaveStart() {
    const waveNumber = this.computeWaveNumber();
    this.currentWaveNumber = waveNumber > 0 ? waveNumber : 1;
    this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
  }

  createWaveState(config, options = {}) {
    if (!config) {
      return null;
    }
    const { initialWave = false } = options;
    const multiplier = this.getCycleMultiplier();
    const scaledHp = Number.isFinite(config.hp) ? config.hp * multiplier : config.hp;
    const scaledSpeed = Number.isFinite(config.speed) ? config.speed * multiplier : config.speed;
    const scaledReward = Number.isFinite(config.reward)
      ? config.reward * multiplier
      : config.reward;
    return {
      config: {
        ...config,
        hp: scaledHp,
        speed: scaledSpeed,
        reward: scaledReward,
      },
      spawned: 0,
      nextSpawn: initialWave ? this.initialSpawnDelay : 0,
      multiplier,
    };
  }

  updateFloaters(delta) {
    if (!this.floaters.length || !this.levelConfig) {
      return;
    }

    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    if (!width || !height) {
      return;
    }

    const dt = Math.max(0, Math.min(delta, 0.05));
    const minDimension = Math.min(width, height);
    if (!minDimension) {
      return;
    }

    const influenceScale = Math.max(0.6, Math.min(1.4, minDimension / 600));
    const pairDistance = minDimension * 0.28;
    const towerInfluence = minDimension * 0.3;
    const nodeInfluence = minDimension * 0.32;
    const enemyInfluence = minDimension * 0.26;
    const edgeMargin = minDimension * 0.12;

    const pairRepelStrength = 18 * influenceScale;
    const towerRepelStrength = 42 * influenceScale;
    const enemyRepelStrength = 46 * influenceScale;
    const edgeRepelStrength = 24 * influenceScale;

    const damping = dt > 0 ? Math.exp(-dt * 1.6) : 1;
    const smoothing = dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
    const maxSpeed = minDimension * 0.6;

    const floaters = this.floaters;
    const connections = [];

    const startPoint = this.pathPoints.length ? this.pathPoints[0] : null;
    const endPoint =
      this.pathPoints.length > 1 ? this.pathPoints[this.pathPoints.length - 1] : startPoint;

    const towerPositions = this.towers.map((tower) => ({ x: tower.x, y: tower.y }));
    const enemyPositions = this.enemies.map((enemy) => this.getEnemyPosition(enemy));

    for (let index = 0; index < floaters.length; index += 1) {
      const floater = floaters[index];
      floater.ax = 0;
      floater.ay = 0;
      floater.opacityTarget = 0;
    }

    for (let i = 0; i < floaters.length - 1; i += 1) {
      const a = floaters[i];
      for (let j = i + 1; j < floaters.length; j += 1) {
        const b = floaters[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance >= pairDistance) {
          continue;
        }
        const proximity = 1 - distance / pairDistance;
        const force = pairRepelStrength * proximity;
        const dirX = dx / distance;
        const dirY = dy / distance;
        a.ax -= dirX * force;
        a.ay -= dirY * force;
        b.ax += dirX * force;
        b.ay += dirY * force;
        const connectionStrength = Math.min(1, proximity);
        connections.push({ from: i, to: j, strength: connectionStrength });
        a.opacityTarget = Math.max(a.opacityTarget, proximity);
        b.opacityTarget = Math.max(b.opacityTarget, proximity);
      }
    }

    floaters.forEach((floater) => {
      if (floater.x < edgeMargin) {
        const proximity = 1 - floater.x / edgeMargin;
        floater.ax += edgeRepelStrength * proximity;
      }
      if (width - floater.x < edgeMargin) {
        const proximity = 1 - (width - floater.x) / edgeMargin;
        floater.ax -= edgeRepelStrength * proximity;
      }
      if (floater.y < edgeMargin) {
        const proximity = 1 - floater.y / edgeMargin;
        floater.ay += edgeRepelStrength * proximity;
      }
      if (height - floater.y < edgeMargin) {
        const proximity = 1 - (height - floater.y) / edgeMargin;
        floater.ay -= edgeRepelStrength * proximity;
      }

      towerPositions.forEach((towerPosition) => {
        const dx = floater.x - towerPosition.x;
        const dy = floater.y - towerPosition.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance >= towerInfluence) {
          return;
        }
        const proximity = 1 - distance / towerInfluence;
        const force = towerRepelStrength * proximity;
        floater.ax += (dx / distance) * force;
        floater.ay += (dy / distance) * force;
        floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
      });

      enemyPositions.forEach((enemyPosition) => {
        if (!enemyPosition) {
          return;
        }
        const dx = floater.x - enemyPosition.x;
        const dy = floater.y - enemyPosition.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance >= enemyInfluence) {
          return;
        }
        const proximity = 1 - distance / enemyInfluence;
        const force = enemyRepelStrength * proximity;
        floater.ax += (dx / distance) * force;
        floater.ay += (dy / distance) * force;
        floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
      });

      if (startPoint) {
        const dx = floater.x - startPoint.x;
        const dy = floater.y - startPoint.y;
        const distance = Math.hypot(dx, dy);
        if (distance < nodeInfluence) {
          const proximity = 1 - distance / nodeInfluence;
          floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
        }
      }
      if (endPoint && endPoint !== startPoint) {
        const dx = floater.x - endPoint.x;
        const dy = floater.y - endPoint.y;
        const distance = Math.hypot(dx, dy);
        if (distance < nodeInfluence) {
          const proximity = 1 - distance / nodeInfluence;
          floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
        }
      }
    });

    floaters.forEach((floater) => {
      floater.ax = Number.isFinite(floater.ax) ? floater.ax : 0;
      floater.ay = Number.isFinite(floater.ay) ? floater.ay : 0;
      floater.vx = Number.isFinite(floater.vx) ? floater.vx : 0;
      floater.vy = Number.isFinite(floater.vy) ? floater.vy : 0;

      floater.vx = (floater.vx + floater.ax * dt) * damping;
      floater.vy = (floater.vy + floater.ay * dt) * damping;

      const speed = Math.hypot(floater.vx, floater.vy);
      if (speed > maxSpeed && speed > 0) {
        const scale = maxSpeed / speed;
        floater.vx *= scale;
        floater.vy *= scale;
      }

      floater.x += floater.vx * dt;
      floater.y += floater.vy * dt;

      const softMargin = Math.min(width, height) * 0.02;
      floater.x = Math.min(width - softMargin, Math.max(softMargin, floater.x));
      floater.y = Math.min(height - softMargin, Math.max(softMargin, floater.y));

      floater.opacityTarget = Math.min(1, Math.max(0, floater.opacityTarget));
      if (!Number.isFinite(floater.opacity)) {
        floater.opacity = 0;
      }
      const blend = smoothing;
      floater.opacity += (floater.opacityTarget - floater.opacity) * blend;
      floater.opacity = Math.min(1, Math.max(0, floater.opacity));
    });

    this.floaterConnections = connections;
  }

  update(delta) {
    if (!this.levelActive || !this.levelConfig) {
      return;
    }

    const speedDelta = delta * this.speedMultiplier;
    this.updateFloaters(speedDelta);
    this.updateFocusIndicator(speedDelta);

    const arcSpeed = this.levelConfig?.arcSpeed ?? 0.2;
    const pathLength = this.pathLength || 1;
    this.arcOffset -= arcSpeed * speedDelta * pathLength;
    const wrapDistance = pathLength * 1000;
    if (this.arcOffset <= -wrapDistance) {
      this.arcOffset += wrapDistance;
    }

    if (!this.combatActive) {
      // Keep Delta garrisons alive even while waves are paused.
      this.towers.forEach((tower) => {
        if (tower.type !== 'delta') {
          return;
        }
        tower.cooldown = Math.max(0, tower.cooldown - speedDelta);
        this.updateDeltaTower(tower, speedDelta);
      });
      this.updateHud();
      this.updateProgress();
      return;
    }

    this.waveTimer += speedDelta;
    this.spawnEnemies();
    this.updateTowers(speedDelta);
    this.updateEnemies(speedDelta);
    this.updateProjectiles(speedDelta);
    // Animate mote gems so they pulse gently while waiting to be collected.
    this.updateMoteGems(speedDelta);
    this.updateProgress();
    this.updateHud();
  }

  calculateMoteFactor(config) {
    if (!config) {
      return 1;
    }
    if (Number.isFinite(config.moteFactor)) {
      return Math.max(1, Math.round(config.moteFactor));
    }
    const hp = Number.isFinite(config.hp) ? Math.max(1, config.hp) : 60;
    return Math.max(1, Math.round(hp / 60));
  }

  calculateHealthExponent(hp) {
    if (!Number.isFinite(hp) || hp <= 0) {
      return 0;
    }
    const clampedHp = Math.max(1, hp);
    const rawExponent = Math.log10(clampedHp);
    // Floor the exponent to the nearest tenth so scientific-notation tiers only advance after surpassing the threshold.
    const flooredExponent = Math.floor(rawExponent * 10) / 10;
    return Number.isFinite(flooredExponent) ? flooredExponent : 0;
  }

  // Estimate how much integrity the enemy will strip if it breaches so exponent colors telegraph threat level.
  estimateEnemyBreachDamage(enemy) {
    if (!enemy) {
      return 0;
    }
    const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
    const fallbackHp = Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : 0;
    const damageSource = remainingHp > 0 ? remainingHp : fallbackHp;
    const baseDamage = Math.max(0, Math.ceil(damageSource || 0));
    const defenseSources = [
      Number.isFinite(enemy.coreDefense) ? enemy.coreDefense : null,
      Number.isFinite(enemy.defense) ? enemy.defense : null,
      Number.isFinite(this.gateDefense) ? this.gateDefense : null,
    ];
    let defenseValue = 0;
    let defenseResolved = false;
    // Resolve the first configured defense value so breach math can respect shields or future upgrades.
    defenseSources.forEach((candidate) => {
      if (defenseResolved || candidate === null) {
        return;
      }
      defenseValue = Math.max(0, candidate);
      defenseResolved = true;
    });
    const mitigatedDamage = Math.max(0, baseDamage - defenseValue);
    if (mitigatedDamage <= 0) {
      return 0;
    }
    return Math.max(1, mitigatedDamage);
  }

  // Map breach damage to palette cues so players instantly read whether a glyph is lethal, dangerous, or harmless.
  resolveEnemyExponentColor(enemy) {
    const damage = this.estimateEnemyBreachDamage(enemy);
    if (damage <= 0) {
      return 'rgba(120, 235, 255, 0.95)';
    }
    const currentLives = Number.isFinite(this.lives) ? Math.max(0, this.lives) : 0;
    if (currentLives > 0 && damage >= currentLives) {
      return 'rgba(255, 70, 95, 0.95)';
    }
    const maxLives = Number.isFinite(this.levelConfig?.lives)
      ? Math.max(1, this.levelConfig.lives)
      : currentLives;
    if (maxLives > 0 && damage / maxLives < 0.05) {
      return 'rgba(110, 255, 176, 0.95)';
    }
    return 'rgba(255, 168, 92, 0.95)';
  }

  resolveEnemySymbol(config = {}) {
    if (config && typeof config.symbol === 'string') {
      const trimmed = config.symbol.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (config && typeof config.codexId === 'string') {
      const codexEntry = getEnemyCodexEntry(config.codexId);
      if (codexEntry && typeof codexEntry.symbol === 'string') {
        const trimmed = codexEntry.symbol.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    if (config && typeof config.label === 'string') {
      const trimmed = config.label.trim();
      if (trimmed) {
        return trimmed.charAt(0).toUpperCase();
      }
    }
    return '◈';
  }

  spawnEnemies() {
    if (!this.activeWave || !this.levelConfig) {
      return;
    }

    const { config } = this.activeWave;
    if (!config) {
      return;
    }

    while (
      this.activeWave.spawned < config.count &&
      this.waveTimer >= this.activeWave.nextSpawn
    ) {
      const pathMode = config.pathMode === 'direct' ? 'direct' : 'path';
      const symbol = this.resolveEnemySymbol(config);
      const maxHp = Number.isFinite(config.hp) ? Math.max(1, config.hp) : 1;
      const hpExponent = this.calculateHealthExponent(maxHp);
      const gemDropMultiplier = resolveEnemyGemDropMultiplier(config);
      const enemy = {
        id: this.enemyIdCounter += 1,
        progress: 0,
        hp: config.hp,
        maxHp: config.hp,
        speed: config.speed,
        reward: config.reward,
        color: config.color,
        label: config.label,
        typeId: config.codexId || null,
        pathMode,
        moteFactor: this.calculateMoteFactor(config),
        symbol,
        hpExponent,
        gemDropMultiplier,
      };
      this.enemies.push(enemy);
      this.activeWave.spawned += 1;
      this.activeWave.nextSpawn += config.interval;
      if (config.codexId) {
        registerEnemyEncounter(config.codexId);
      }
    }
  }

  updateTowers(delta) {
    this.towers.forEach((tower) => {
      tower.cooldown = Math.max(0, tower.cooldown - delta);
      if (tower.type === 'delta') {
        this.updateDeltaTower(tower, delta);
        return;
      }
      if (!this.combatActive || !this.enemies.length) {
        return;
      }
      if (tower.cooldown > 0) {
        return;
      }
      const targetInfo = this.findTarget(tower);
      if (!targetInfo) {
        return;
      }
      tower.cooldown = 1 / tower.rate;
      this.fireAtTarget(tower, targetInfo);
    });
  }

  /**
   * Advance Delta soldier timers, spawn replacements, and manage cohort AI.
   */
  updateDeltaTower(tower, delta) {
    const state = this.ensureDeltaState(tower);
    if (!state) {
      return;
    }

    state.mode = tower.behaviorMode || state.mode || 'pursuit';

    const survivors = [];
    for (let index = 0; index < state.soldiers.length; index += 1) {
      const soldier = state.soldiers[index];
      if (this.updateDeltaSoldier(tower, soldier, delta, state)) {
        survivors.push(soldier);
      }
    }
    state.soldiers = survivors;

    const spawnCap = Math.max(1, state.maxSoldiers || 1);
    if (state.soldiers.length > spawnCap) {
      // Trim excess soldiers if upgrades reduce the allowed cohort size.
      state.soldiers.length = spawnCap;
    }
    if (state.soldiers.length >= spawnCap) {
      return;
    }

    if (tower.cooldown <= 0) {
      const targetInfo = this.combatActive ? this.findTarget(tower) : null;
      this.deployDeltaSoldier(tower, targetInfo);
      const rate = Math.max(Number.isFinite(tower.rate) ? tower.rate : 1, 0.05);
      tower.cooldown = 1 / rate;
    }
  }

  /**
   * Spawn a fresh Delta soldier, optionally primed with a target assignment.
   */
  deployDeltaSoldier(tower, targetInfo = null) {
    const state = this.ensureDeltaState(tower);
    if (!state) {
      return;
    }
    const limit = Math.max(1, state.maxSoldiers || 1);
    if (state.soldiers.length >= limit) {
      return;
    }
    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const spawnRadius = Math.max(12, minDimension * 0.035);
    const collisionRadius = Math.max(12, minDimension * 0.03);
    const spawnIndex = state.soldierCounter % limit;
    state.soldierCounter += 1;
    const angle = -Math.PI / 2 + (Math.PI * 2 * spawnIndex) / limit;
    const spawnX = tower.x + Math.cos(angle) * spawnRadius;
    const spawnY = tower.y + Math.sin(angle) * spawnRadius;

    const soldier = {
      id: `delta-soldier-${(this.deltaSoldierIdCounter += 1)}`,
      towerId: tower.id,
      slotIndex: spawnIndex,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      heading: angle,
      maxHealth: state.atk,
      health: state.atk,
      regenPercent: state.regenPercent,
      defense: state.defense,
      targetId: targetInfo?.enemy?.id || null,
      collisionRadius,
      mode: tower.behaviorMode || 'pursuit',
    };

    state.soldiers.push(soldier);
  }

  /**
   * Resolve an idle waypoint for a Delta soldier based on the active stance.
   */
  resolveDeltaHoldPosition(tower, soldier, state) {
    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const index = Number.isFinite(soldier.slotIndex) ? soldier.slotIndex : 0;
    const count = Math.max(1, state.maxSoldiers || 1);
    const baseAngle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    if (tower.behaviorMode === 'trackHold' && state.trackHoldPoint) {
      const radius = Math.max(18, minDimension * 0.05);
      return {
        x: state.trackHoldPoint.x + Math.cos(baseAngle) * radius,
        y: state.trackHoldPoint.y + Math.sin(baseAngle) * radius,
      };
    }
    const sentinelRadius = tower.behaviorMode === 'sentinel'
      ? Math.max(28, minDimension * 0.07)
      : Math.max(18, minDimension * 0.045);
    return {
      x: tower.x + Math.cos(baseAngle) * sentinelRadius,
      y: tower.y + Math.sin(baseAngle) * sentinelRadius,
    };
  }

  /**
   * Step an individual Delta soldier and return whether it survives the frame.
   */
  updateDeltaSoldier(tower, soldier, delta, state) {
    if (!soldier || soldier.health <= 0) {
      return false;
    }

    const regen = Math.max(0, state.regenPercent || soldier.regenPercent || 0);
    if (regen > 0 && soldier.health < soldier.maxHealth) {
      const gain = soldier.maxHealth * regen * delta;
      soldier.health = Math.min(soldier.maxHealth, soldier.health + gain);
    }

    let target = null;
    if (soldier.targetId) {
      target = this.enemies.find((candidate) => candidate?.id === soldier.targetId) || null;
      if (!target || target.hp <= 0) {
        soldier.targetId = null;
        target = null;
      }
    }

    if (!target && this.combatActive && this.enemies.length) {
      if (tower.behaviorMode === 'sentinel') {
        const manual = this.getTowerManualTarget(tower);
        if (manual) {
          soldier.targetId = manual.id;
          target = manual;
        }
      } else {
        const candidate = this.findTarget(tower);
        if (candidate?.enemy) {
          if (tower.behaviorMode !== 'trackHold') {
            soldier.targetId = candidate.enemy.id;
            target = candidate.enemy;
          } else {
            const anchor = state.trackHoldPoint || { x: tower.x, y: tower.y };
            const targetPosition = candidate.position || this.getEnemyPosition(candidate.enemy);
            const interceptRadius = Math.max(tower.range * 0.55, soldier.collisionRadius * 6);
            const distance = targetPosition
              ? Math.hypot(targetPosition.x - anchor.x, targetPosition.y - anchor.y)
              : Infinity;
            if (distance <= interceptRadius) {
              soldier.targetId = candidate.enemy.id;
              target = candidate.enemy;
            }
          }
        }
      }
    }

    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const speed = Math.max(90, minDimension * 0.22);

    let destination = null;
    if (target) {
      destination = this.getEnemyPosition(target);
    }
    if (!destination) {
      destination = this.resolveDeltaHoldPosition(tower, soldier, state);
    }
    if (!destination) {
      destination = { x: tower.x, y: tower.y };
    }

    const dx = destination.x - soldier.x;
    const dy = destination.y - soldier.y;
    const distance = Math.hypot(dx, dy);
    const acceleration = Math.max(200, minDimension * 0.5); // Ease soldier velocity to smooth acceleration and deceleration.
    let nx = 0;
    let ny = 0;
    if (distance > 0.0001) {
      nx = dx / distance;
      ny = dy / distance;
    }
    const desiredSpeed = distance > 1 ? speed : 0;
    const desiredVx = nx * desiredSpeed;
    const desiredVy = ny * desiredSpeed;
    const deltaVx = desiredVx - soldier.vx;
    const deltaVy = desiredVy - soldier.vy;
    const deltaMagnitude = Math.hypot(deltaVx, deltaVy);
    const maxVelocityChange = acceleration * delta;
    if (deltaMagnitude > maxVelocityChange && deltaMagnitude > 0) {
      const blend = maxVelocityChange / deltaMagnitude;
      soldier.vx += deltaVx * blend;
      soldier.vy += deltaVy * blend;
    } else {
      soldier.vx = desiredVx;
      soldier.vy = desiredVy;
    }

    if (distance <= 0.0001) {
      soldier.x = destination.x;
      soldier.y = destination.y;
      if (Math.abs(soldier.vx) < 0.01) {
        soldier.vx = 0;
      }
      if (Math.abs(soldier.vy) < 0.01) {
        soldier.vy = 0;
      }
    } else {
      const stepX = soldier.vx * delta;
      const stepY = soldier.vy * delta;
      const forwardTravel = stepX * nx + stepY * ny;
      if (forwardTravel > distance) {
        soldier.x = destination.x;
        soldier.y = destination.y;
        soldier.vx = 0;
        soldier.vy = 0;
      } else {
        soldier.x += stepX;
        soldier.y += stepY;
      }
    }

    if (Number.isFinite(soldier.vx) && Number.isFinite(soldier.vy)) {
      const velocityMagnitude = Math.hypot(soldier.vx, soldier.vy);
      if (velocityMagnitude > 0.01) {
        soldier.heading = Math.atan2(soldier.vy, soldier.vx);
      }
    }

    if (target) {
      const targetPosition = this.getEnemyPosition(target);
      if (targetPosition) {
        const metrics = this.getEnemyVisualMetrics(target);
        const enemyRadius = this.getEnemyHitRadius(target, metrics);
        const contactRadius = enemyRadius + (soldier.collisionRadius || 12);
        const separation = Math.hypot(soldier.x - targetPosition.x, soldier.y - targetPosition.y);
        if (separation <= contactRadius) {
          const enemyHp = Number.isFinite(target.hp) ? Math.max(0, target.hp) : 0;
          const inflicted = Math.min(soldier.health, enemyHp);
          target.hp = Math.max(0, enemyHp - inflicted);
          const loss = Math.max(0, inflicted - (state.defense || 0));
          soldier.health = Math.max(0, soldier.health - loss);
          if (target.hp <= 0) {
            this.processEnemyDefeat(target);
            soldier.targetId = null;
          }
          if (soldier.health <= 0) {
            return false;
          }
        }
      }
    }

    return soldier.health > 0;
  }

  findTarget(tower) {
    if (!tower) {
      return null;
    }
    const manual = this.getTowerManualTarget(tower);
    if (manual) {
      const position = this.getEnemyPosition(manual);
      const distance = position
        ? Math.hypot(position.x - tower.x, position.y - tower.y)
        : Infinity;
      if (!position || distance > tower.range) {
        this.clearTowerManualTarget(tower);
      } else {
        return { enemy: manual, position };
      }
    }

    if (tower.type === 'delta' && tower.behaviorMode === 'sentinel') {
      return null;
    }

    const focusedEnemy = this.getFocusedEnemy();
    if (focusedEnemy) {
      const position = this.getEnemyPosition(focusedEnemy);
      const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
      if (distance <= tower.range) {
        return { enemy: focusedEnemy, position };
      }
    }
    let selected = null;
    const priority = tower.targetPriority || 'first';
    let bestProgress = -Infinity;
    let bestStrength = -Infinity;
    this.enemies.forEach((enemy) => {
      const position = this.getEnemyPosition(enemy);
      const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
      if (distance > tower.range) {
        return;
      }
      if (priority === 'strongest') {
        const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
        if (strength > bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
          selected = { enemy, position };
          bestStrength = strength;
          bestProgress = enemy.progress;
        }
        return;
      }
      if (enemy.progress > bestProgress) {
        selected = { enemy, position };
        bestProgress = enemy.progress;
      }
    });
    return selected;
  }

  fireAtTarget(tower, targetInfo) {
    if (tower.type === 'delta') {
      this.deployDeltaSoldier(tower, targetInfo);
      return;
    }
    if (tower.type === 'aleph-null') {
      this.fireAlephChain(tower, targetInfo);
      return;
    }
    const { enemy } = targetInfo;
    enemy.hp -= tower.damage;
    if (getTowerTierValue(tower) >= 24) {
      this.spawnOmegaWave(tower);
    }
    this.projectiles.push({
      source: { x: tower.x, y: tower.y },
      targetId: enemy.id,
      target: this.getEnemyPosition(enemy),
      lifetime: 0,
      maxLifetime: 0.24,
    });

    if (this.audio) {
      this.audio.playSfx('alphaTowerFire');
    }

    if (enemy.hp <= 0) {
      this.processEnemyDefeat(enemy);
    }
  }

  fireAlephChain(tower, targetInfo) {
    if (!targetInfo || !targetInfo.enemy) {
      return;
    }

    const chainStats =
      tower.chain || (this.alephChain ? this.alephChain.getState(tower.id) : null);
    const totalDamage = Number.isFinite(chainStats?.totalDamage)
      ? chainStats.totalDamage
      : tower.damage;
    const range = Number.isFinite(tower.range)
      ? tower.range
      : Number.isFinite(tower.baseRange)
      ? tower.baseRange
      : 0;
    const maxLinks = Math.max(1, Math.floor(chainStats?.linkCount ?? 1));

    const visited = new Set();
    const chainTargets = [];
    const firstEnemy = targetInfo.enemy;
    const firstPosition = targetInfo.position || this.getEnemyPosition(firstEnemy);
    chainTargets.push({ enemy: firstEnemy, position: firstPosition });
    visited.add(firstEnemy.id);

    let anchorPosition = firstPosition;
    let hopsRemaining = maxLinks - 1;

    while (hopsRemaining > 0 && anchorPosition) {
      let nearest = null;
      let nearestPosition = null;
      let nearestDistance = Infinity;
      this.enemies.forEach((candidate) => {
        if (!candidate || visited.has(candidate.id)) {
          return;
        }
        const candidatePosition = this.getEnemyPosition(candidate);
        const distance = Math.hypot(
          candidatePosition.x - anchorPosition.x,
          candidatePosition.y - anchorPosition.y,
        );
        if (distance <= range && distance < nearestDistance) {
          nearest = candidate;
          nearestPosition = candidatePosition;
          nearestDistance = distance;
        }
      });

      if (!nearest || !nearestPosition) {
        break;
      }

      chainTargets.push({ enemy: nearest, position: nearestPosition });
      visited.add(nearest.id);
      anchorPosition = nearestPosition;
      hopsRemaining -= 1;
    }

    let origin = { x: tower.x, y: tower.y };
    chainTargets.forEach((target) => {
      const enemy = target.enemy;
      enemy.hp -= totalDamage;
      this.projectiles.push({
        source: { ...origin },
        targetId: enemy.id,
        target: target.position,
        lifetime: 0,
        maxLifetime: 0.24,
      });
      if (enemy.hp <= 0) {
        this.processEnemyDefeat(enemy);
      }
      origin = { ...target.position };
    });

    if (getTowerTierValue(tower) >= 24) {
      this.spawnOmegaWave(tower);
    }

    if (this.audio) {
      this.audio.playSfx('alphaTowerFire');
    }
  }

  spawnOmegaWave(tower) {
    if (!tower) {
      return;
    }
    const tier = getTowerTierValue(tower);
    if (!Number.isFinite(tier) || tier < 24) {
      return;
    }
    const origin = { x: tower.x, y: tower.y };
    const getOmegaPatternForTier = this.dependencies.getOmegaPatternForTier;
    const pattern =
      typeof getOmegaPatternForTier === 'function' ? getOmegaPatternForTier(tier) : [];
    const visuals = getOmegaWaveVisualConfig(tower);
    const count = Math.max(6, Math.floor(pattern.projectileCount || 0));
    const baseSize = Math.max(3, visuals.size ?? pattern.baseSize ?? 4);
    const stage = Math.max(0, Math.floor(tier) - 24);
    const jitterStrength = 0.06 + stage * 0.02;
    const maxLifetime = Math.max(0.8, pattern.duration || 2);

    for (let index = 0; index < count; index += 1) {
      const phase = (Math.PI * 2 * index) / count;
      const ratioJitter = Math.sin(phase) * jitterStrength;
      const swirlJitter = Math.cos(phase * 1.5) * jitterStrength * 1.2;
      const radiusJitter = Math.sin(phase * 2) * stage * 4;
      const parameters = {
        ...pattern,
        ratio: pattern.ratio + ratioJitter,
        swirl: pattern.swirl + swirlJitter,
        radius: pattern.radius + radiusJitter,
        phaseShift: pattern.phaseShift + jitterStrength * 0.5,
      };

      this.projectiles.push({
        patternType: 'omegaWave',
        origin,
        position: { ...origin },
        previousPosition: { ...origin },
        lifetime: 0,
        maxLifetime,
        parameters,
        phase,
        color: visuals.color,
        trailColor: visuals.trailColor,
        size: baseSize,
        glowColor: visuals.glowColor,
        glowBlur: visuals.glowBlur,
      });
    }
  }

  updateEnemies(delta) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.progress += enemy.speed * delta;
      if (enemy.progress >= 1) {
        this.enemies.splice(index, 1);
        this.handleEnemyBreach(enemy);
      }
    }

    if (
      this.combatActive &&
      this.activeWave &&
      this.activeWave.spawned >= this.activeWave.config.count &&
      !this.enemies.length
    ) {
      this.advanceWave();
    }
  }

  updateProjectiles(delta) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.lifetime += delta;

      if (projectile.patternType === 'omegaWave') {
        const maxLifetime = projectile.maxLifetime || 0;
        if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
          this.projectiles.splice(index, 1);
          continue;
        }

        const duration = maxLifetime > 0 ? maxLifetime : 1;
        const progress = Math.max(0, Math.min(1, projectile.lifetime / duration));
        const parameters = projectile.parameters || {};
        const envelopePower = Number.isFinite(parameters.envelopePower)
          ? parameters.envelopePower
          : 1;
        const envelopeBase = Math.sin(Math.PI * progress);
        const envelope = Math.pow(Math.max(0, envelopeBase), envelopePower);
        const loops = Number.isFinite(parameters.loops) ? parameters.loops : 1.5;
        const ratio = Number.isFinite(parameters.ratio) ? parameters.ratio : 1.6;
        const radius = Number.isFinite(parameters.radius) ? parameters.radius : 60;
        const swirlFrequency = Number.isFinite(parameters.swirlFrequency)
          ? parameters.swirlFrequency
          : 2.5;
        const returnCurve = Number.isFinite(parameters.returnCurve)
          ? parameters.returnCurve
          : 0.6;
        const swirlStrength = Number.isFinite(parameters.swirl) ? parameters.swirl : 0.8;
        const phaseShift = Number.isFinite(parameters.phaseShift)
          ? parameters.phaseShift
          : 0.3;
        const baseAngle = projectile.phase || 0;
        const angle = baseAngle + Math.PI * 2 * loops * progress;
        const swirlPhase = progress * Math.PI * swirlFrequency + baseAngle * phaseShift;
        const swirlOffset = Math.sin(swirlPhase) * radius * returnCurve * envelope * swirlStrength;
        const radial = radius * envelope;
        const offsetX = (radial + swirlOffset) * Math.cos(angle);
        const offsetY =
          (radial - swirlOffset) *
          Math.sin(angle * ratio + swirlStrength * Math.sin(angle));

        projectile.previousPosition = projectile.position || { ...projectile.origin };
        projectile.position = {
          x: (projectile.origin?.x || 0) + offsetX,
          y: (projectile.origin?.y || 0) + offsetY,
        };
        continue;
      }

      if (projectile.lifetime >= projectile.maxLifetime) {
        this.projectiles.splice(index, 1);
      }
    }
  }

  // Update mote gem flight so squares drift away from the lane before entering the mote tower.
  updateMoteGems(delta) {
    if (!moteGemState.active.length || !Number.isFinite(delta)) {
      return;
    }
    const step = Math.max(0, delta);
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const minDimension =
      width > 0 && height > 0
        ? Math.max(1, Math.min(width, height))
        : Math.max(1, Math.max(width, height)); // Resolve the active scale so launch distances measured in meters stay accurate after resizes.
    const toCollect = [];

    moteGemState.active.forEach((gem) => {
      if (!Number.isFinite(gem.pulse)) {
        gem.pulse = 0;
      }
      gem.pulse += step * 2.4;

      if (!Number.isFinite(gem.lifetime)) {
        gem.lifetime = 0;
      }
      gem.lifetime += step;

      const dt = step;
      if (!Number.isFinite(gem.vx)) {
        gem.vx = (Math.random() - 0.5) * 0.08; // Provide a gentle horizontal drift for legacy gems.
      }
      if (!Number.isFinite(gem.vy)) {
        gem.vy = -0.22; // Default to an upward launch if legacy data is missing.
      }
      const gravity = Number.isFinite(gem.gravity) ? gem.gravity : 0.00045;
      gem.vy += gravity * dt;
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;

      const fadeStart = 720;
      const fadeDuration = 420;
      if (!Number.isFinite(gem.opacity)) {
        gem.opacity = 1;
      }
      if (gem.lifetime > fadeStart) {
        const fadeProgress = Math.min(1, (gem.lifetime - fadeStart) / Math.max(120, fadeDuration));
        gem.opacity = Math.max(0, 1 - fadeProgress);
      }

      const invisible = gem.opacity <= 0.01;

      const launchData = gem.launch;
      const hasDirectedLaunch =
        launchData &&
        Number.isFinite(launchData.distanceMeters) &&
        Number.isFinite(launchData.angle); // Confirm that the gem originated from the new fling system before applying the ballistic override.
      if (hasDirectedLaunch) {
        const travelDistance = metersToPixels(launchData.distanceMeters, minDimension); // Translate the stored travel distance into on-screen pixels each frame.
        launchData.elapsed = (launchData.elapsed || 0) + step;
        const duration = Number.isFinite(launchData.duration) ? Math.max(1, launchData.duration) : 600;
        const progress = Math.min(1, launchData.elapsed / duration); // Convert the elapsed travel time into a normalized flight progress value.
        const directionX = Math.cos(launchData.angle);
        const directionY = Math.sin(launchData.angle);
        const displacement = travelDistance * progress;
        const originX = Number.isFinite(launchData.startX) ? launchData.startX : gem.x;
        const originY = Number.isFinite(launchData.startY) ? launchData.startY : gem.y;
        gem.x = originX + directionX * displacement;
        gem.y = originY + directionY * displacement;

        const offscreenX = width ? gem.x < -64 || gem.x > width + 64 : false;
        const offscreenY = height ? gem.y < -96 || gem.y > height + 96 : gem.y < -96;
        const travelComplete = progress >= 1;
        if (offscreenX || offscreenY || travelComplete || invisible) {
          toCollect.push(gem);
        }
        return;
      }

      const offscreenX = width ? gem.x < -64 || gem.x > width + 64 : false;
      const offscreenY = gem.y < -96 || (height ? gem.y > height + 96 : false);
      const lifetimeExpired = gem.lifetime > 1400;
      if (offscreenX || offscreenY || lifetimeExpired || invisible) {
        toCollect.push(gem);
      }
    });

    if (toCollect.length) {
      toCollect.forEach((gem) => {
        collectMoteGemDrop(gem, { reason: 'flight' });
      });
    }
  }

  // Snapshot the minimal tower data required to rebuild a checkpoint state.
  serializeTowerForCheckpoint(tower) {
    if (!tower) {
      return null;
    }
    return {
      type: tower.type,
      normalized: this.cloneNormalizedPoint(tower.normalized),
      targetPriority: tower.targetPriority || 'first',
      behaviorMode: tower.behaviorMode || null,
      baseDamage: Number.isFinite(tower.baseDamage) ? tower.baseDamage : null,
      baseRate: Number.isFinite(tower.baseRate) ? tower.baseRate : null,
      baseRange: Number.isFinite(tower.baseRange) ? tower.baseRange : null,
      damage: Number.isFinite(tower.damage) ? tower.damage : null,
      rate: Number.isFinite(tower.rate) ? tower.rate : null,
      range: Number.isFinite(tower.range) ? tower.range : null,
      cooldown: Number.isFinite(tower.cooldown) ? tower.cooldown : 0,
      slotId: tower.slot?.id || null,
      deltaState:
        tower.type === 'delta' && tower.deltaState
          ? { manualTargetId: tower.deltaState.manualTargetId || null }
          : null,
    };
  }

  // Rebuild tower placements and behavior from a stored checkpoint snapshot.
  restoreTowersFromCheckpoint(towerSnapshots = []) {
    const snapshots = Array.isArray(towerSnapshots) ? towerSnapshots : [];
    this.towers.forEach((tower) => {
      this.teardownDeltaTower(tower);
      this.handleAlephTowerRemoved(tower);
    });
    this.towers = [];
    this.slots.forEach((slot) => {
      slot.tower = null;
      if (slot.button) {
        slot.button.classList.remove('tower-built');
        slot.button.setAttribute('aria-pressed', 'false');
      }
    });
    this.towerIdCounter = 0;

    snapshots.forEach((snapshot) => {
      if (!snapshot || !snapshot.type) {
        return;
      }
      const definition = getTowerDefinition(snapshot.type);
      if (!definition) {
        return;
      }
      const normalized = this.cloneNormalizedPoint(snapshot.normalized || {});
      const position = this.getCanvasPosition(normalized);
      const fallbackDamage = Number.isFinite(definition.damage) ? definition.damage : 0;
      const fallbackRate = Number.isFinite(definition.rate) ? definition.rate : 1;
      const fallbackRange = Math.min(this.renderWidth, this.renderHeight) * (definition.range ?? 0.24);
      const tower = {
        id: `tower-${(this.towerIdCounter += 1)}`,
        type: snapshot.type,
        definition,
        symbol: definition.symbol,
        tier: definition.tier,
        normalized,
        x: position.x,
        y: position.y,
        baseDamage: Number.isFinite(snapshot.baseDamage) ? snapshot.baseDamage : fallbackDamage,
        baseRate: Number.isFinite(snapshot.baseRate) ? snapshot.baseRate : fallbackRate,
        baseRange: Number.isFinite(snapshot.baseRange) ? snapshot.baseRange : fallbackRange,
        damage: Number.isFinite(snapshot.damage) ? snapshot.damage : fallbackDamage,
        rate: Number.isFinite(snapshot.rate) ? snapshot.rate : fallbackRate,
        range: Number.isFinite(snapshot.range) ? snapshot.range : fallbackRange,
        cooldown: Number.isFinite(snapshot.cooldown) ? snapshot.cooldown : 0,
        slot: null,
      };
      if (snapshot.slotId && this.slots.has(snapshot.slotId)) {
        const slot = this.slots.get(snapshot.slotId);
        tower.slot = slot;
        slot.tower = tower;
        if (slot.button) {
          slot.button.classList.add('tower-built');
          slot.button.setAttribute('aria-pressed', 'true');
        }
      }
      tower.targetPriority = snapshot.targetPriority || 'first';
      tower.behaviorMode = snapshot.behaviorMode || tower.behaviorMode;
      this.applyTowerBehaviorDefaults(tower);
      if (snapshot.behaviorMode && tower.type === 'delta') {
        this.configureDeltaBehavior(tower, snapshot.behaviorMode);
      }
      if (tower.type === 'delta' && snapshot.deltaState?.manualTargetId) {
        const state = this.ensureDeltaState(tower);
        if (state) {
          state.manualTargetId = snapshot.deltaState.manualTargetId;
        }
      }
      this.towers.push(tower);
      this.handleAlephTowerAdded(tower);
    });

    refreshTowerLoadoutDisplay();
  }

  // Record a fresh endless checkpoint whenever a cycle of waves concludes.
  captureEndlessCheckpoint() {
    if (!this.isEndlessMode || !this.levelConfig || !Array.isArray(this.levelConfig.waves)) {
      return;
    }
    const snapshot = {
      waveIndex: this.waveIndex,
      waveNumber: this.currentWaveNumber,
      endlessCycle: this.endlessCycle,
      energy: this.energy,
      lives: this.lives,
      autoWaveEnabled: this.autoWaveEnabled,
      availableTowers: Array.isArray(this.availableTowers)
        ? this.availableTowers.slice()
        : [],
      towers: this.towers.map((tower) => this.serializeTowerForCheckpoint(tower)).filter(Boolean),
    };
    this.endlessCheckpoint = snapshot;
    this.endlessCheckpointUsed = false;
  }

  // Surface whether a retry is available along with the stored wave number.
  getEndlessCheckpointInfo() {
    if (!this.isEndlessMode || !this.endlessCheckpoint) {
      return { available: false, waveNumber: null };
    }
    return {
      available: !this.endlessCheckpointUsed,
      waveNumber: this.endlessCheckpoint.waveNumber || null,
    };
  }

  // Restore the battlefield to the last saved checkpoint and resume combat immediately.
  retryFromEndlessCheckpoint() {
    if (
      !this.isEndlessMode ||
      !this.endlessCheckpoint ||
      this.endlessCheckpointUsed ||
      !this.levelConfig ||
      !Array.isArray(this.levelConfig.waves) ||
      !this.levelConfig.waves.length
    ) {
      return false;
    }

    const snapshot = this.endlessCheckpoint;
    const totalWaves = this.levelConfig.waves.length;
    const targetIndex = Math.max(0, Math.min(totalWaves - 1, Number(snapshot.waveIndex) || 0));

    this.cancelAutoStart();
    this.combatActive = true;
    this.resolvedOutcome = null;
    this.shouldAnimate = true;
    this.ensureLoop();

    this.waveIndex = targetIndex;
    this.waveTimer = 0;
    this.enemyIdCounter = 0;
    this.enemies = [];
    this.projectiles = [];
    this.floaters = [];
    this.floaterConnections = [];
    this.endlessCycle = Math.max(0, Number(snapshot.endlessCycle) || 0);
    this.currentWaveNumber = snapshot.waveNumber || this.computeWaveNumber(targetIndex);
    this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
    this.energy = Number.isFinite(snapshot.energy) ? snapshot.energy : this.energy;
    this.lives = Number.isFinite(snapshot.lives) ? snapshot.lives : this.lives;
    this.autoWaveEnabled = snapshot.autoWaveEnabled ?? this.autoWaveEnabled;
    if (this.autoWaveCheckbox) {
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
    }
    if (Array.isArray(snapshot.availableTowers)) {
      this.availableTowers = snapshot.availableTowers.slice();
    }

    this.alephChain.reset();
    this.restoreTowersFromCheckpoint(snapshot.towers);

    const waveConfig = this.levelConfig.waves[targetIndex];
    this.activeWave = this.createWaveState(waveConfig);
    this.markWaveStart();
    this.currentWaveNumber = snapshot.waveNumber || this.currentWaveNumber;
    this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);

    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = 'Wave Running';
    }
    if (this.messageEl && this.activeWave?.config?.label) {
      this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label}.`;
    }

    this.updateHud();
    this.updateProgress();
    this.updateSpeedButton();
    this.updateAutoAnchorButton();
    this.dependencies.updateStatusDisplays();
    this.endlessCheckpointUsed = true;

    if (this.onCombatStart && this.levelConfig?.id) {
      this.onCombatStart(this.levelConfig.id);
    }

    return true;
  }

  advanceWave() {
    if (!this.levelConfig) {
      return;
    }

    if (this.waveIndex + 1 >= this.levelConfig.waves.length) {
      if (this.isEndlessMode) {
        this.endlessCycle += 1;
        this.waveIndex = 0;
        this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
        this.waveTimer = 0;
        this.markWaveStart();
        this.captureEndlessCheckpoint();
        if (this.messageEl) {
          this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${
            this.activeWave.config.label
          }.`;
        }
        this.updateHud();
        this.updateProgress();
        return;
      }
      this.handleVictory();
      return;
    }

    this.waveIndex += 1;
    this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
    this.waveTimer = 0;
    this.markWaveStart();
    if (this.messageEl) {
      this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label}.`;
    }
    this.updateHud();
    this.updateProgress();
  }

  handleEnemyBreach(enemy) {
    const damage = this.estimateEnemyBreachDamage(enemy);
    this.lives = Math.max(0, this.lives - damage);
    if (this.audio) {
      this.audio.playSfx('enemyBreach');
      const maxLives = Number.isFinite(this.levelConfig?.lives)
        ? Math.max(1, this.levelConfig.lives)
        : null;
      if (maxLives && damage / maxLives > 0.05) {
        this.audio.playSfx('error');
      }
    }
    if (this.messageEl) {
      const label = enemy.label || 'Glyph';
      // Clarify whether a breach actually removed integrity or was fully absorbed by defenses.
      this.messageEl.textContent =
        damage > 0
          ? `${label} breached the core—Integrity −${damage}.`
          : `${label} breached the core, but the gate held firm.`;
    }
    if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
      this.clearEnemyHover();
    }
    if (this.focusedEnemyId === enemy.id) {
      this.clearFocusedEnemy({ silent: true });
    }
    if (this.lives <= 0) {
      this.handleDefeat();
    }
    this.updateHud();
    this.updateProgress();
  }

  // Create a mote gem at the fallen enemy's position so it can be collected later.
  spawnMoteGemFromEnemy(enemy) {
    if (!enemy) {
      return;
    }
    const position = this.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    spawnMoteGemDrop(enemy, position);
  }

  processEnemyDefeat(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) {
      this.enemies.splice(index, 1);
    }
    if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
      this.clearEnemyHover();
    }
    if (this.focusedEnemyId === enemy.id) {
      this.clearFocusedEnemy({ silent: true });
    }

    const baseGain =
      (this.levelConfig?.theroPerKill ?? this.levelConfig?.energyPerKill ?? 0) +
      (enemy.reward || 0);
    const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
    this.energy = Math.min(cap, this.energy + baseGain);

    if (this.messageEl) {
      this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${Math.round(
        baseGain,
      )} ${this.theroSymbol}.`;
    }
    this.updateHud();
    this.updateProgress();
    this.dependencies.updateStatusDisplays();

    if (this.audio) {
      this.audio.playSfx('enemyDefeat');
    }

    this.spawnMoteGemFromEnemy(enemy);

    this.dependencies.notifyEnemyDefeated();
  }

  handleVictory() {
    if (this.resolvedOutcome === 'victory') {
      return;
    }
    if (this.audio) {
      this.audio.playSfx('victory');
    }
    this.combatActive = false;
    this.resolvedOutcome = 'victory';
    this.activeWave = null;
    const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
    const reward = this.levelConfig.rewardThero ?? this.levelConfig.rewardEnergy ?? 0;
    this.energy = Math.min(cap, this.energy + reward);
    this.currentWaveNumber = this.baseWaveCount || this.currentWaveNumber;
    this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
    if (this.startButton) {
      this.startButton.disabled = false;
      this.startButton.textContent = 'Run Again';
    }
    if (this.messageEl) {
      const title = this.levelConfig.displayName || 'Defense';
      this.messageEl.textContent = `Victory! ${title} is sealed.`;
    }
    this.updateHud();
    this.updateProgress();
    if (this.onVictory) {
      this.onVictory(this.levelConfig.id, {
        rewardScore: this.levelConfig.rewardScore,
        rewardFlux: this.levelConfig.rewardFlux,
        rewardThero: reward,
        rewardEnergy: this.levelConfig.rewardEnergy,
        towers: this.towers.length,
        lives: this.lives,
        maxWave: this.maxWaveReached,
        startThero: this.levelConfig.startThero,
      });
    }
    const calculateStartingThero = this.dependencies.calculateStartingThero;
    const refreshedStart =
      typeof calculateStartingThero === 'function' ? calculateStartingThero() : 0;
    if (Number.isFinite(refreshedStart)) {
      this.levelConfig.startThero = refreshedStart;
      this.energy = Math.min(cap, Math.max(this.energy, refreshedStart));
      this.updateHud();
    }
    this.dependencies.updateStatusDisplays();
  }

  handleDefeat() {
    if (this.resolvedOutcome === 'defeat') {
      return;
    }
    if (this.audio) {
      this.audio.playSfx('defeat');
    }
    this.combatActive = false;
    this.resolvedOutcome = 'defeat';
    this.activeWave = null;
    const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
    const baseline = this.levelConfig.startThero ?? this.levelConfig.startEnergy ?? 0;
    this.energy = Math.min(cap, Math.max(this.energy, baseline));
    this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
    if (this.startButton) {
      this.startButton.disabled = false;
      this.startButton.textContent = 'Retry Wave';
    }
    if (this.messageEl) {
      const waveLabel = this.maxWaveReached > 0 ? ` at wave ${this.maxWaveReached}` : '';
      this.messageEl.textContent = `Defense collapsed${waveLabel}—recalibrate the anchors and retry.`;
    }
    this.updateHud();
    this.updateProgress();
    this.dependencies.updateStatusDisplays();
    if (this.onDefeat) {
      this.onDefeat(this.levelConfig.id, {
        towers: this.towers.length,
        maxWave: this.maxWaveReached,
      });
    }
  }

  updateHud() {
    if (this.waveEl) {
      if (!this.levelConfig) {
        this.waveEl.textContent = '—';
      } else {
        if (this.isEndlessMode) {
          const displayWave = this.combatActive
            ? this.currentWaveNumber
            : Math.max(1, this.currentWaveNumber || 1);
          this.waveEl.textContent = `Wave ${displayWave}`;
        } else {
          const total = this.levelConfig.waves.length;
          const displayWave = this.combatActive
            ? this.waveIndex + 1
            : Math.min(this.waveIndex + 1, total);
          this.waveEl.textContent = `${displayWave}/${total}`;
        }
      }
    }

    if (this.healthEl) {
      this.healthEl.textContent = this.levelConfig
        ? `${this.lives}/${this.levelConfig.lives}`
        : '—';
    }

    if (this.energyEl) {
      if (!this.levelConfig) {
        this.energyEl.textContent = '—';
      } else if (!Number.isFinite(this.energy)) {
        this.energyEl.textContent = `∞ ${this.theroSymbol}`;
      } else {
        this.energyEl.textContent = `${Math.round(this.energy)} ${this.theroSymbol}`;
      }
    }

    this.updateSpeedButton();
    this.updateAutoAnchorButton();
    refreshTowerLoadoutDisplay();
    this.dependencies.updateStatusDisplays();
  }

  updateProgress() {
    if (!this.progressEl) {
      return;
    }

    if (!this.levelConfig) {
      this.progressEl.textContent = 'No active level.';
      return;
    }

    if (!this.combatActive) {
      if (this.resolvedOutcome === 'victory') {
        const title = this.levelConfig.displayName || 'Defense';
        this.progressEl.textContent = `${title} stabilized—victory sealed.`;
      } else if (this.resolvedOutcome === 'defeat') {
        const waveNote = this.maxWaveReached > 0 ? ` Reached wave ${this.maxWaveReached}.` : '';
        this.progressEl.textContent = `Defense collapsed—rebuild the proof lattice.${waveNote}`;
      } else {
        const remainingMs =
          this.autoWaveEnabled && this.autoStartDeadline
            ? this.autoStartDeadline - Date.now()
            : 0;
        if (remainingMs > 0) {
          const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
          const intro = this.isEndlessMode ? 'Endless mode primed' : 'Wave prep underway';
          this.progressEl.textContent = `${intro}—auto-start in ${seconds}s.`;
        } else {
          this.progressEl.textContent = this.isEndlessMode
            ? 'Endless mode primed—auto-start will trigger after preparations.'
            : 'Wave prep underway.';
        }
      }
      return;
    }

    const total = this.levelConfig.waves.length;
    const remainingInWave = this.activeWave
      ? Math.max(0, this.activeWave.config.count - this.activeWave.spawned)
      : 0;
    const remaining = remainingInWave + this.enemies.length;
    const label = this.levelConfig.waves[this.waveIndex]?.label || 'glyphs';
    if (this.isEndlessMode) {
      this.progressEl.textContent = `Wave ${this.currentWaveNumber} — ${remaining} ${label} remaining.`;
    } else {
      const current = Math.min(this.waveIndex + 1, total);
      this.progressEl.textContent = `Wave ${current}/${total} — ${remaining} ${label} remaining.`;
    }
  }

  getCanvasPosition(normalized) {
    return {
      x: normalized.x * this.renderWidth,
      y: normalized.y * this.renderHeight,
    };
  }

  getPixelsForMeters(meters) {
    const minDimension = Math.min(this.renderWidth, this.renderHeight) || 0;
    return metersToPixels(meters, minDimension); // Translate standardized meters into on-screen pixels using the current viewport.
  }

  getNormalizedFromCanvasPosition(position) {
    if (!position || !this.canvas) {
      return null;
    }
    const width = this.renderWidth || this.canvas.width || 1;
    const height = this.renderHeight || this.canvas.height || 1;
    if (!width || !height) {
      return null;
    }
    const normalized = {
      x: position.x / width,
      y: position.y / height,
    };
    return this.clampNormalized(normalized);
  }

  clampNormalized(normalized) {
    if (!normalized) {
      return null;
    }
    const clamp = (value) => {
      if (!Number.isFinite(value)) {
        return 0.5;
      }
      return Math.min(Math.max(value, 0.04), 0.96);
    };
    return {
      x: clamp(normalized.x),
      y: clamp(normalized.y),
    };
  }

  getCanvasRelativeFromClient(point) {
    if (!this.canvas || !point) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  getViewCenter() {
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const normalized = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
    return {
      x: width * normalized.x,
      y: height * normalized.y,
    };
  }

  setViewCenterFromWorld(world) {
    if (!world) {
      return;
    }
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    if (!width || !height) {
      this.viewCenterNormalized = { x: 0.5, y: 0.5 };
      return;
    }
    const normalized = {
      x: world.x / width,
      y: world.y / height,
    };
    this.viewCenterNormalized = this.clampViewCenterNormalized(normalized);
  }

  clampViewCenterNormalized(normalized) {
    if (!normalized) {
      return { x: 0.5, y: 0.5 };
    }
    const scale = Math.max(this.viewScale || 1, 0.0001);
    const halfWidth = Math.min(0.5, 0.5 / scale);
    const halfHeight = Math.min(0.5, 0.5 / scale);
    const clamp = (value, min, max) => {
      if (min > max) {
        return 0.5;
      }
      return Math.min(Math.max(value, min), max);
    };
    return {
      x: clamp(normalized.x, halfWidth, 1 - halfWidth),
      y: clamp(normalized.y, halfHeight, 1 - halfHeight),
    };
  }

  applyViewConstraints() {
    this.viewCenterNormalized = this.clampViewCenterNormalized(
      this.viewCenterNormalized || { x: 0.5, y: 0.5 },
    );
  }

  screenToWorld(point) {
    if (!point) {
      return null;
    }
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const scale = this.viewScale || 1;
    if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    const center = this.getViewCenter();
    return {
      x: center.x + (point.x - width / 2) / scale,
      y: center.y + (point.y - height / 2) / scale,
    };
  }

  worldToScreen(point) {
    if (!point) {
      return null;
    }
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const scale = this.viewScale || 1;
    if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    const center = this.getViewCenter();
    return {
      x: width / 2 + (point.x - center.x) * scale,
      y: height / 2 + (point.y - center.y) * scale,
    };
  }

  getPointAlongPath(progress) {
    if (!this.pathSegments.length) {
      return { x: 0, y: 0 };
    }

    const target = Math.min(progress, 1) * this.pathLength;
    let traversed = 0;

    for (let index = 0; index < this.pathSegments.length; index += 1) {
      const segment = this.pathSegments[index];
      if (traversed + segment.length >= target) {
        const ratio = segment.length > 0 ? (target - traversed) / segment.length : 0;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
          y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
        };
      }
      traversed += segment.length;
    }

    const lastSegment = this.pathSegments[this.pathSegments.length - 1];
    return lastSegment ? { ...lastSegment.end } : { x: 0, y: 0 };
  }

  getEnemyPosition(enemy) {
    if (!enemy) {
      return { x: 0, y: 0 };
    }

    if (enemy.pathMode === 'direct' && this.pathSegments.length) {
      const startSegment = this.pathSegments[0];
      const endSegment = this.pathSegments[this.pathSegments.length - 1];
      const start = startSegment ? startSegment.start : { x: 0, y: 0 };
      const end = endSegment ? endSegment.end : start;
      const clamped = Math.max(0, Math.min(1, enemy.progress));
      return {
        x: start.x + (end.x - start.x) * clamped,
        y: start.y + (end.y - start.y) * clamped,
      };
    }

    return this.getPointAlongPath(enemy.progress);
  }

  draw() {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const viewCenter = this.getViewCenter();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.viewScale, this.viewScale);
    ctx.translate(-viewCenter.x, -viewCenter.y);

    this.drawFloaters();
    this.drawPath();
    this.drawMoteGems();
    this.drawArcLight();
    this.drawNodes();
    this.drawDeveloperPathMarkers();
    this.drawPlacementPreview();
    this.drawTowers();
    this.drawDeltaSoldiers();
    this.drawEnemies();
    this.drawProjectiles();
    this.drawTowerMenu();
    this.updateEnemyTooltipPosition();
  }

  drawFloaters() {
    if (!this.ctx || !this.floaters.length || !this.levelConfig) {
      return;
    }
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    if (!width || !height) {
      return;
    }
    const minDimension = Math.min(width, height) || 1;
    const connectionWidth = Math.max(0.6, minDimension * 0.0014);

    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.floaterConnections.forEach((connection) => {
      const from = this.floaters[connection.from];
      const to = this.floaters[connection.to];
      if (!from || !to) {
        return;
      }
      const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
      if (alpha <= 0) {
        return;
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = connectionWidth;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    this.floaters.forEach((floater) => {
      const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
      if (opacity <= 0) {
        return;
      }
      let radiusFactor = Number.isFinite(floater.radiusFactor)
        ? floater.radiusFactor
        : null;
      if (!radiusFactor) {
        radiusFactor = this.randomFloaterRadiusFactor();
        floater.radiusFactor = radiusFactor;
      }
      const radius = Math.max(2, radiusFactor * minDimension);
      const strokeWidth = Math.max(0.8, radius * 0.22);
      ctx.beginPath();
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
      ctx.arc(floater.x, floater.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  }

  // Render each mote gem using its sprite when available so drops mirror the inventory art.
  drawMoteGems() {
    if (!this.ctx || !moteGemState.active.length) {
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    moteGemState.active.forEach((gem) => {
      const hue = gem.color?.hue ?? 48;
      const saturation = gem.color?.saturation ?? 68;
      const lightness = gem.color?.lightness ?? 56;
      const moteSize = Number.isFinite(gem.moteSize) ? Math.max(1, gem.moteSize) : Math.max(1, gem.value);
      const size = (10 + moteSize * 4.2) * 0.5; // Shrink the render footprint so battlefield gems appear at half their previous scale.
      const pulse = Math.sin((gem.pulse || 0) * 0.6) * 3.2;
      const rotation = Math.sin((gem.pulse || 0) * 0.35) * 0.45;
      const opacity = Number.isFinite(gem.opacity) ? Math.max(0, Math.min(1, gem.opacity)) : 1;
      const alphaFill = Math.max(0, Math.min(0.9, 0.6 + opacity * 0.3));
      const alphaStroke = Math.max(0, Math.min(0.9, 0.5 + opacity * 0.35));
      const fill = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alphaFill})`;
      const stroke = `hsla(${hue}, ${Math.max(24, saturation - 18)}%, ${Math.max(18, lightness - 28)}%, ${alphaStroke})`;
      const sparkle = `hsla(${hue}, ${Math.max(34, saturation - 22)}%, 92%, ${Math.max(0, opacity * 0.65)})`;
      const sprite = getGemSpriteImage(gem.typeKey);

      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(rotation);
      if (sprite) {
        // Scale the sprite according to mote size so drops stay legible on the battlefield.
        const baseSize = size + pulse;
        const reference = Math.max(1, Math.max(sprite.width || 1, sprite.height || 1));
        const renderSize = baseSize;
        const scale = renderSize / reference;
        const width = (sprite.width || reference) * scale;
        const height = (sprite.height || reference) * scale;
        ctx.globalAlpha = opacity;
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
      } else {
        // Fall back to the square rendering when the sprite has not finished loading yet.
        const squareSize = size + pulse;
        const half = squareSize / 2;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1.2, squareSize * 0.16);
        ctx.beginPath();
        ctx.rect(-half, -half, squareSize, squareSize);
        ctx.fill();
        ctx.stroke();

        const sparkleSize = squareSize * 0.38;
        ctx.fillStyle = sparkle;
        ctx.fillRect(-sparkleSize * 0.5, -sparkleSize * 0.8, sparkleSize, sparkleSize);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  drawPath() {
    if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
      return;
    }
    const ctx = this.ctx;
    const points = this.pathPoints;
    const start = points[0];
    const end = points[points.length - 1];

    const baseGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    baseGradient.addColorStop(0, 'rgba(88, 160, 255, 0.5)');
    baseGradient.addColorStop(0.48, 'rgba(162, 110, 255, 0.48)');
    baseGradient.addColorStop(1, 'rgba(255, 158, 88, 0.5)');

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    this.applyCanvasShadow(ctx, 'rgba(88, 160, 255, 0.2)', 12);
    ctx.moveTo(start.x, start.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      ctx.lineTo(point.x, point.y);
    }
    ctx.strokeStyle = baseGradient;
    ctx.stroke();
    ctx.restore();

    const highlightGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    highlightGradient.addColorStop(0, 'rgba(88, 160, 255, 0.12)');
    highlightGradient.addColorStop(0.52, 'rgba(162, 110, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 158, 88, 0.14)');

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.moveTo(start.x, start.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      ctx.lineTo(point.x, point.y);
    }
    ctx.strokeStyle = highlightGradient;
    ctx.stroke();
    ctx.restore();
  }

  drawArcLight() {
    if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 180, 105, 0.7)';
    ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.18]);
    ctx.lineDashOffset = this.arcOffset;
    ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let index = 1; index < this.pathPoints.length; index += 1) {
      const point = this.pathPoints[index];
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawMindGateSymbol(ctx, position) {
    if (!ctx || !position) {
      return;
    }

    const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
    const baseRadius = dimension ? dimension * 0.035 : 0;
    const radius = Math.max(14, Math.min(24, baseRadius || 18));

    ctx.save();
    ctx.translate(position.x, position.y);

    const glow = ctx.createRadialGradient(0, 0, radius * 0.22, 0, 0, radius);
    glow.addColorStop(0, 'rgba(255, 248, 220, 0.9)');
    glow.addColorStop(0.55, 'rgba(255, 196, 150, 0.35)');
    glow.addColorStop(1, 'rgba(139, 247, 255, 0.18)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius);
    ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    const spriteReady = mindGateSprite?.complete && mindGateSprite.naturalWidth > 0;
    if (spriteReady) {
      // Draw the Aleph-null sprite scaled to the battlefield finale.
      const spriteSize = Math.max(radius * 2.1, 46);
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(mindGateSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      ctx.restore();

      this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.45)', radius * 0.9);
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.6)';
      ctx.lineWidth = Math.max(1.2, radius * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fall back to the legacy geometric rendering until the sprite finishes loading.
      this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.55)', radius * 0.7);
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
      ctx.lineWidth = Math.max(1.4, radius * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, radius * 0.64);
      ctx.lineTo(0, -radius * 0.6);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 228, 120, 0.92)';
      this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius * 0.8);
      ctx.lineWidth = Math.max(1.6, radius * 0.14);
      ctx.beginPath();
      const gateWidth = radius * 0.58;
      const gateBase = radius * 0.62;
      ctx.moveTo(-gateWidth, gateBase);
      ctx.lineTo(-gateWidth, -radius * 0.18);
      ctx.quadraticCurveTo(0, -radius * 0.95, gateWidth, -radius * 0.18);
      ctx.lineTo(gateWidth, gateBase);
      ctx.stroke();
    }

    const gateIntegrity = Math.max(0, Math.floor(this.lives || 0));
    const maxIntegrity = Math.max(
      gateIntegrity,
      Math.floor(this.levelConfig?.lives || gateIntegrity || 1),
    );
    const gateExponentSource = gateIntegrity > 0 ? gateIntegrity : maxIntegrity || 1;
    const gateExponent = this.calculateHealthExponent(gateExponentSource);
    const palette =
      typeof this.getEffectiveMotePalette === 'function'
        ? this.getEffectiveMotePalette()
        : null;
    const paletteStops = resolvePaletteColorStops(palette);
    const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
    if (Array.isArray(paletteStops) && paletteStops.length) {
      const denominator = Math.max(1, paletteStops.length - 1);
      paletteStops.forEach((stop, index) => {
        const offset = Math.max(0, Math.min(1, index / denominator));
        gradient.addColorStop(offset, colorToRgbaString(stop, 1));
      });
    }
    ctx.font = `${Math.round(Math.max(14, radius * 0.82))}px "Space Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = gradient;
    const highlightColor = paletteStops[paletteStops.length - 1] || paletteStops[0];
    this.applyCanvasShadow(ctx, colorToRgbaString(highlightColor, 0.85), Math.max(14, radius * 0.95));
    const exponentOffset = radius * 0.78;
    const exponentX = exponentOffset;
    const exponentY = -exponentOffset * 0.88;
    // Show the core's exponent with the same decimal precision used for enemy glyphs.
    ctx.fillText(gateExponent.toFixed(1), exponentX, exponentY);

    ctx.restore();
  }

  drawNodes() {
    if (!this.ctx || !this.pathSegments.length) {
      return;
    }
    const ctx = this.ctx;
    const startPoint = this.pathPoints.length ? this.pathPoints[0] : this.pathSegments[0].start;
    const endPoint = this.pathPoints.length
      ? this.pathPoints[this.pathPoints.length - 1]
      : this.pathSegments[this.pathSegments.length - 1].end;
    ctx.fillStyle = 'rgba(88, 160, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 10, 0, Math.PI * 2);
    ctx.fill();
    this.drawMindGateSymbol(ctx, endPoint);
  }

  setDeveloperPathMarkers(markers) {
    if (!Array.isArray(markers)) {
      this.developerPathMarkers = [];
      return;
    }

    this.developerPathMarkers = markers
      .map((marker, index) => {
        if (!marker) {
          return null;
        }
        const x = Number(marker.x);
        const y = Number(marker.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }
        return {
          x,
          y,
          label:
            marker.label !== undefined && marker.label !== null
              ? marker.label
              : index + 1,
          active: Boolean(marker.active),
        };
      })
      .filter(Boolean);
  }

  drawDeveloperPathMarkers() {
    if (!this.ctx || !Array.isArray(this.developerPathMarkers) || !this.developerPathMarkers.length) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.font = '12px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.developerPathMarkers.forEach((marker, index) => {
      const radius = marker.active ? 12 : 10;
      ctx.beginPath();
      ctx.fillStyle = marker.active ? 'rgba(18, 26, 44, 0.9)' : 'rgba(12, 16, 28, 0.82)';
      ctx.strokeStyle = marker.active
        ? 'rgba(139, 247, 255, 0.9)'
        : 'rgba(139, 247, 255, 0.55)';
      ctx.lineWidth = marker.active ? 2 : 1.5;
      if (marker.active) {
        this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.3)', 16);
      } else {
        this.clearCanvasShadow(ctx);
      }
      ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const label = marker.label !== undefined && marker.label !== null ? marker.label : index + 1;
      if (label !== undefined && label !== null) {
        ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
        ctx.fillText(String(label), marker.x, marker.y);
      }
    });


    // Restore the canvas state so developer marker styling does not leak into other drawing routines.
    ctx.restore();
  }

  drawPlacementPreview() {
    if (!this.ctx || !this.hoverPlacement || !this.hoverPlacement.position) {
      return;
    }

    const ctx = this.ctx;
    const {
      position,
      range,
      valid,
      merge,
      mergeTarget,
      symbol,
      reason,
      dragging,
      towerType,
      definition,
      tier,
    } = this.hoverPlacement;

    ctx.save();

    const radius = Number.isFinite(range) && range > 0 ? range : Math.min(this.renderWidth, this.renderHeight) * 0.18;
    const fillColor = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(255, 112, 112, 0.16)';
    const strokeColor = valid ? 'rgba(139, 247, 255, 0.85)' : 'rgba(255, 96, 96, 0.9)';

    // Render the projected range circle so players can gauge coverage during placement.
    ctx.beginPath();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = valid ? 2 : 3;
    ctx.arc(position.x, position.y, Math.max(12, radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (merge && mergeTarget) {
      // Highlight the merge target to reinforce that the placement will combine towers.
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 236, 128, 0.85)';
      ctx.beginPath();
      ctx.arc(mergeTarget.x, mergeTarget.y, Math.max(16, (radius || 24) * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const previewDefinition = definition || getTowerDefinition(towerType);
    const previewTower = {
      type: towerType,
      definition: previewDefinition || undefined,
      tier: Number.isFinite(tier) ? tier : previewDefinition?.tier,
      symbol,
    };
    const visuals = getTowerVisualConfig(previewTower) || {};
    const bodyRadius = Math.max(12, Math.min(this.renderWidth, this.renderHeight) * 0.042);
    const bodyStroke = valid
      ? visuals.outerStroke || 'rgba(139, 247, 255, 0.85)'
      : 'rgba(255, 96, 96, 0.85)';
    const bodyFill = valid
      ? visuals.innerFill || 'rgba(12, 16, 28, 0.9)'
      : 'rgba(60, 16, 16, 0.88)';
    const symbolFill = valid
      ? visuals.symbolFill || 'rgba(255, 228, 120, 0.85)'
      : 'rgba(255, 200, 200, 0.92)';

    ctx.save();
    if (valid && visuals.outerShadow?.color) {
      this.applyCanvasShadow(
        ctx,
        visuals.outerShadow.color,
        Number.isFinite(visuals.outerShadow.blur) ? visuals.outerShadow.blur : 18,
      );
    } else {
      this.clearCanvasShadow(ctx);
    }
    ctx.beginPath();
    ctx.fillStyle = bodyFill;
    ctx.strokeStyle = bodyStroke;
    ctx.lineWidth = valid ? 2.4 : 2.6;
    ctx.arc(position.x, position.y, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    if (valid && visuals.symbolShadow?.color) {
      this.applyCanvasShadow(
        ctx,
        visuals.symbolShadow.color,
        Number.isFinite(visuals.symbolShadow.blur) ? visuals.symbolShadow.blur : 18,
      );
    } else {
      this.clearCanvasShadow(ctx);
    }
    const glyph = symbol || '·';
    ctx.font = `${Math.round(bodyRadius * 1.4)}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = symbolFill;
    ctx.fillText(glyph, position.x, position.y);
    ctx.restore();

    if (dragging) {
      // Add a subtle outline while dragging to indicate the pointer anchor.
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.4)';
      ctx.beginPath();
      const anchorRadius = Math.max(bodyRadius * 1.15, bodyRadius + 4, 16);
      ctx.arc(position.x, position.y, anchorRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    if (this.messageEl && reason) {
      // Surface placement feedback in the UI message element for accessibility.
      this.messageEl.textContent = reason;
    }
  }

  drawTowers() {
    if (!this.ctx || !this.towers.length) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();

    const connections = [];
    for (let i = 0; i < this.towers.length; i += 1) {
      const a = this.towers[i];
      if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) {
        continue;
      }
      const rangeA = Number.isFinite(a.range) ? Math.max(0, a.range) : 0;
      for (let j = i + 1; j < this.towers.length; j += 1) {
        const b = this.towers[j];
        if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
          continue;
        }
        const rangeB = Number.isFinite(b.range) ? Math.max(0, b.range) : 0;
        if (rangeA <= 0 || rangeB <= 0) {
          continue;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance)) {
          continue;
        }
        if (distance <= rangeA && distance <= rangeB) {
          connections.push({ from: a, to: b });
        }
      }
    }

    if (connections.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(143, 210, 255, 0.42)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 6]);
      connections.forEach((link) => {
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    this.towers.forEach((tower) => {
      if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
        return;
      }

      const visuals = getTowerVisualConfig(tower) || {};
      const rangeRadius = Number.isFinite(tower.range)
        ? tower.range
        : Math.min(this.renderWidth, this.renderHeight) * 0.22;
      const bodyRadius = Math.max(12, Math.min(this.renderWidth, this.renderHeight) * 0.042);

      // Outline the active coverage radius so players can gauge lattice reach in real time.
      if (Number.isFinite(rangeRadius) && rangeRadius > 0) {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = visuals.rangeStroke || 'rgba(139, 247, 255, 0.2)';
        ctx.setLineDash([8, 6]);
        ctx.arc(tower.x, tower.y, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.save();
      const outerShadow = visuals.outerShadow;
      if (outerShadow?.color) {
        this.applyCanvasShadow(
          ctx,
          outerShadow.color,
          Number.isFinite(outerShadow.blur) ? outerShadow.blur : 18,
        );
      } else {
        this.clearCanvasShadow(ctx);
      }

      ctx.beginPath();
      ctx.fillStyle = visuals.innerFill || 'rgba(12, 16, 28, 0.9)';
      ctx.strokeStyle = visuals.outerStroke || 'rgba(139, 247, 255, 0.75)';
      ctx.lineWidth = 2.4;
      ctx.arc(tower.x, tower.y, bodyRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const symbolColor = visuals.symbolFill || 'rgba(255, 228, 120, 0.92)';
      const symbolShadow = visuals.symbolShadow;
      if (symbolShadow?.color) {
        this.applyCanvasShadow(
          ctx,
          symbolShadow.color,
          Number.isFinite(symbolShadow.blur) ? symbolShadow.blur : 18,
        );
      } else {
        this.clearCanvasShadow(ctx);
      }

      const glyph = tower.symbol || tower.definition?.symbol || '?';
      ctx.fillStyle = symbolColor;
      ctx.font = `${Math.round(bodyRadius * 1.4)}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, tower.x, tower.y);

      if (tower.chain) {
        // Highlight Aleph-linked towers with a secondary ring that pulses with the chain state.
        this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', 20);
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, bodyRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
        this.clearCanvasShadow(ctx);
      }

      if (this.activeTowerMenu?.towerId === tower.id) {
        // Outline the selected lattice so the menu context is clear.
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(139, 247, 255, 0.9)';
        ctx.lineWidth = 2.6;
        ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  /**
   * Render the roaming Delta soldiers as luminous triangles circling the battlefield.
   */
  drawDeltaSoldiers() {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const baseSize = Math.max(12, minDimension * 0.03);

    ctx.save();
    this.towers.forEach((tower) => {
      if (tower.type !== 'delta' || !tower.deltaState?.soldiers?.length) {
        return;
      }
      tower.deltaState.soldiers.forEach((soldier) => {
        if (!Number.isFinite(soldier.x) || !Number.isFinite(soldier.y)) {
          return;
        }
        const size = Number.isFinite(soldier.collisionRadius)
          ? Math.max(8, soldier.collisionRadius)
          : baseSize;
        const angle = Number.isFinite(soldier.heading) ? soldier.heading : -Math.PI / 2;
        const healthRatio = soldier.maxHealth > 0 ? Math.max(0, Math.min(1, soldier.health / soldier.maxHealth)) : 0;
        ctx.save();
        ctx.translate(soldier.x, soldier.y);
        ctx.rotate(angle - Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.6, size * 0.9);
        ctx.lineTo(size * 0.6, size * 0.9);
        ctx.closePath();
        ctx.fillStyle = `rgba(139, 247, 255, ${0.35 + healthRatio * 0.45})`;
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
        ctx.lineWidth = Math.max(1.2, size * 0.12);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = `rgba(12, 16, 26, ${0.45 + (1 - healthRatio) * 0.3})`;
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });
    ctx.restore();
  }

  drawEnemies() {
    if (!this.ctx || !this.enemies.length) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();

    this.enemies.forEach((enemy) => {
      if (!enemy) {
        return;
      }

      const position = this.getEnemyPosition(enemy);
      if (!position) {
        return;
      }

      const metrics = this.getEnemyVisualMetrics(enemy);
      const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
      const exponent = this.calculateHealthExponent(Math.max(1, enemy.hp ?? enemy.maxHp ?? 1));

      ctx.save();
      ctx.translate(position.x, position.y);

      ctx.beginPath();
      ctx.fillStyle = 'rgba(12, 16, 24, 0.88)';
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.arc(0, 0, metrics.ringRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(139, 247, 255, 0.28)';
      ctx.arc(0, 0, metrics.coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.font = `${metrics.symbolSize}px "Cormorant Garamond", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol || '?', 0, 0);

      ctx.font = `700 ${metrics.exponentSize}px "Cormorant Garamond", serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const exponentLabel = exponent.toFixed(1);
      const exponentColor = this.resolveEnemyExponentColor(enemy);
      // Match the outline width to a single CSS pixel so exponents stay crisp on high-DPI displays.
      const pixelRatio = Number.isFinite(this.pixelRatio) && this.pixelRatio > 0 ? this.pixelRatio : 1;
      const outlineWidth = Math.max(1, Math.round(pixelRatio));
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = 'rgba(6, 8, 14, 0.85)';
      ctx.lineWidth = outlineWidth;
      // Display the precise exponent so each glyph telegraphs its ten-power health tier.
      const exponentOffsetX = metrics.ringRadius * 0.94;
      const exponentOffsetY = -metrics.ringRadius * 0.98;
      // Anchor the exponent to the enemy's top-right quadrant so the scientific notation reads cleanly above the glyph.
      // Outline the exponent before filling so it remains legible over bright projectile bursts.
      ctx.strokeText(exponentLabel, exponentOffsetX, exponentOffsetY);
      // Paint the exponent with the threat-informed palette so players grasp incoming danger immediately.
      ctx.fillStyle = exponentColor;
      ctx.fillText(exponentLabel, exponentOffsetX, exponentOffsetY);

      if (this.focusedEnemyId === enemy.id) {
        // Draw a rotating focus marker so players can track the prioritized enemy.
        const markerRadius = metrics.focusRadius || metrics.ringRadius + 8;
        const angle = this.focusMarkerAngle || 0;
        const span = Math.PI / 3;
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, markerRadius, angle, angle + span);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, markerRadius, angle + Math.PI, angle + Math.PI + span);
        ctx.stroke();
      }

      ctx.restore();
    });

    ctx.restore();
  }

  drawProjectiles() {
    if (!this.ctx || !this.projectiles.length) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();

    this.projectiles.forEach((projectile) => {
      if (!projectile) {
        return;
      }

      if (projectile.patternType === 'omegaWave') {
        const position = projectile.position || projectile.origin;
        if (!position) {
          return;
        }

        const radius = Number.isFinite(projectile.parameters?.radius)
          ? projectile.parameters.radius
          : 40;
        const gradient = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius);
        gradient.addColorStop(0, 'rgba(255, 228, 120, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 228, 120, 0)');

        // Render swirling omega waves as glowing motes that fade across their path envelope.
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const source = projectile.source;
      const targetPosition = projectile.target
        ? projectile.target
        : projectile.targetId
        ? (() => {
            const enemy = this.enemies.find((candidate) => candidate.id === projectile.targetId);
            return enemy ? this.getEnemyPosition(enemy) : null;
          })()
        : null;

      if (!source || !targetPosition) {
        return;
      }

      ctx.strokeStyle = 'rgba(139, 247, 255, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(targetPosition.x, targetPosition.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(targetPosition.x, targetPosition.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Paint the active radial tower command menu around the selected lattice.
   */
  drawTowerMenu() {
    if (!this.ctx || !this.activeTowerMenu) {
      return;
    }
    const tower = this.getActiveMenuTower();
    if (!tower) {
      return;
    }
    const geometry = this.getTowerMenuGeometry(tower);
    if (!geometry) {
      return;
    }
    const { options, optionRadius, ringRadius } = geometry;
    const ctx = this.ctx;
    ctx.save();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.35)';
    ctx.lineWidth = Math.max(1.2, optionRadius * 0.14);
    ctx.arc(tower.x, tower.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    options.forEach((option) => {
      const selected = Boolean(option.selected);
      ctx.beginPath();
      ctx.fillStyle = selected ? 'rgba(255, 228, 120, 0.32)' : 'rgba(12, 16, 26, 0.88)';
      ctx.strokeStyle = selected ? 'rgba(255, 228, 120, 0.9)' : 'rgba(139, 247, 255, 0.75)';
      ctx.lineWidth = Math.max(1.4, optionRadius * 0.16);
      ctx.arc(option.center.x, option.center.y, optionRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.font = `${Math.round(optionRadius * 0.95)}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option.icon || '?', option.center.x, option.center.y);
    });

    ctx.restore();
  }
}
