// Playfield gameplay class extracted from the main bundle for reuse across entry points.
import { createAlephChainRegistry } from '../scripts/features/towers/alephChain.js';
import { convertMathExpressionToPlainText } from '../scripts/core/mathText.js';
import { formatWholeNumber } from '../scripts/core/formatting.js';
import {
  playTowerPlacementNotes,
} from './audioSystem.js';
import {
  getTowerDefinition,
  getNextTowerId,
  getPreviousTowerId,
  isTowerUnlocked,
  refreshTowerLoadoutDisplay,
  cancelTowerDrag,
  getTowerEquationBlueprint,
  getTowerLoadoutState,
  openTowerUpgradeOverlay,
  calculateTowerEquationResult,
  unlockTower,
} from './towersTab.js';
import {
  moteGemState,
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
  samplePaletteGradient,
} from './colorSchemeUtils.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../scripts/features/towers/powderTower.js';
import { notifyTowerPlaced } from './achievementsTab.js';
import { metersToPixels, ALPHA_BASE_RADIUS_FACTOR } from './gameUnits.js'; // Allow playfield interactions to convert standardized meters into pixels.
import { formatCombatNumber } from './playfield/utils/formatting.js';
import { easeInCubic, easeOutCubic } from './playfield/utils/math.js';
import {
  areDamageNumbersEnabled,
  areWaveKillTalliesEnabled,
  areWaveDamageTalliesEnabled,
} from './preferences.js';
import * as CanvasRenderer from './playfield/render/CanvasRenderer.js';
import {
  PLAYFIELD_VIEW_DRAG_THRESHOLD,
  PLAYFIELD_VIEW_PAN_MARGIN_METERS,
} from './playfield/constants.js';
import * as InputController from './playfield/input/InputController.js';
import * as HudBindings from './playfield/ui/HudBindings.js';
import * as TowerManager from './playfield/managers/TowerManager.js';
import * as DeveloperCrystalManager from './playfield/managers/DeveloperCrystalManager.js';
import * as StatsPanel from './playfieldStatsPanel.js';
import {
  beginPerformanceFrame,
  beginPerformanceSegment,
  beginTowerPerformanceSegment,
  endPerformanceFrame,
} from './performanceMonitor.js';
import {
  determinePreferredOrientation,
  setPreferredOrientation,
  applyContainerOrientationClass,
  cloneNormalizedPoint,
  rotateNormalizedPointClockwise,
  applyLevelOrientation,
} from './playfield/orientationController.js';
import {
  updateAlphaBursts as updateAlphaBurstsHelper,
} from '../scripts/features/towers/alphaTower.js';
import {
  updateBetaBursts as updateBetaBurstsHelper,
} from '../scripts/features/towers/betaTower.js';
import {
  updateGammaBursts as updateGammaBurstsHelper,
} from '../scripts/features/towers/gammaTower.js';
import { updateKappaTower as updateKappaTowerHelper } from '../scripts/features/towers/kappaTower.js';
import { updateLambdaTower as updateLambdaTowerHelper } from '../scripts/features/towers/lambdaTower.js';
import {
  ensureMuState as ensureMuStateHelper,
  updateMuTower as updateMuTowerHelper,
  drawMuMines as drawMuMinesHelper,
  teardownMuTower as teardownMuTowerHelper,
} from '../scripts/features/towers/muTower.js';
import {
  ensureNuState as ensureNuStateHelper,
  updateNuTower as updateNuTowerHelper,
  trackNuKill as trackNuKillHelper,
  spawnNuKillParticle as spawnNuKillParticleHelper,
  drawNuKillParticles as drawNuKillParticlesHelper,
  updateNuBursts as updateNuBurstsHelper,
  teardownNuTower as teardownNuTowerHelper,
} from '../scripts/features/towers/nuTower.js';
import {
  ensureXiState as ensureXiStateHelper,
  updateXiTower as updateXiTowerHelper,
  fireXiChain as fireXiChainHelper,
  drawXiBalls as drawXiBallsHelper,
  teardownXiTower as teardownXiTowerHelper,
} from '../scripts/features/towers/xiTower.js';
import {
  ensureThetaState as ensureThetaStateHelper,
  updateThetaTower as updateThetaTowerHelper,
  teardownThetaTower as teardownThetaTowerHelper,
} from '../scripts/features/towers/thetaTower.js';
import {
  ensureEpsilonState as ensureEpsilonStateHelper,
  updateEpsilonTower as updateEpsilonTowerHelper,
  applyEpsilonHit as applyEpsilonHitHelper,
} from '../scripts/features/towers/epsilonTower.js';
import {
  updateZetaTower as updateZetaTowerHelper,
  applyZetaDamage as applyZetaDamageHelper,
} from '../scripts/features/towers/zetaTower.js';
import {
  updateEtaTower as updateEtaTowerHelper,
  fireEtaLaser as fireEtaLaserHelper,
  applyEtaDamage as applyEtaDamageHelper,
  ETA_MAX_PRESTIGE_MERGES,
} from '../scripts/features/towers/etaTower.js';
import {
  deployDeltaSoldier as deployDeltaSoldierHelper,
  updateDeltaTower as updateDeltaTowerHelper,
} from '../scripts/features/towers/deltaTower.js';
import {
  collectIotaChargeBonus as collectIotaChargeBonusHelper,
} from '../scripts/features/towers/iotaTower.js';
import {
  ensureOmicronState as ensureOmicronStateHelper,
  updateOmicronTower as updateOmicronTowerHelper,
  teardownOmicronTower as teardownOmicronTowerHelper,
} from '../scripts/features/towers/omicronTower.js';
import {
  ensurePiState as ensurePiStateHelper,
  updatePiTower as updatePiTowerHelper,
  teardownPiTower as teardownPiTowerHelper,
} from '../scripts/features/towers/piTower.js';
import {
  updateSigmaTower as updateSigmaTowerHelper,
  absorbSigmaDamage as absorbSigmaDamageHelper,
  resolveSigmaShotDamage as resolveSigmaShotDamageHelper,
} from '../scripts/features/towers/sigmaTower.js';
import {
  ensureChiState as ensureChiStateHelper,
  updateChiTower as updateChiTowerHelper,
  teardownChiTower as teardownChiTowerHelper,
  tryConvertEnemyToChiThrall as tryConvertEnemyToChiThrallHelper,
  updateChiThralls as updateChiThrallsHelper,
  updateChiLightTrails as updateChiLightTrailsHelper,
} from '../scripts/features/towers/chiTower.js';

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
  handleDeveloperMapPlacement: () => false,
  // Allows the playfield to respect the global graphics fidelity toggle.
  isLowGraphicsMode: () => false,
};

let playfieldDependencies = { ...defaultDependencies };

export function configurePlayfieldSystem(options = {}) {
  playfieldDependencies = { ...defaultDependencies, ...options };
}

const TOWER_HOLD_ACTIVATION_MS = 180;
const TOWER_HOLD_CANCEL_DISTANCE_PX = 18;
const TOWER_HOLD_SWIPE_THRESHOLD_PX = 48;
const TOWER_PRESS_GLOW_FADE_MS = 200;
const TOWER_MENU_DOUBLE_TAP_INTERVAL_MS = 320;
const TOWER_MENU_DOUBLE_TAP_DISTANCE_PX = 28;
const DEFAULT_COST_SCRIBBLE_COLORS = {
  start: { r: 139, g: 247, b: 255 },
  end: { r: 255, g: 138, b: 216 },
  glow: { r: 255, g: 255, b: 255 },
};

// Wave tally overlay styling keeps kill/damage scribbles cohesive with the math aesthetic.
const WAVE_TALLY_FONT_FAMILY = '"Petrona", "Cormorant Garamond", serif';
const WAVE_TALLY_KILL_COLOR = { r: 255, g: 228, b: 150 };
const WAVE_TALLY_DAMAGE_COLOR = { r: 139, g: 247, b: 255 };
const WAVE_TALLY_SHADOW_COLOR = { r: 6, g: 8, b: 14 };
const WAVE_TALLY_SCRIBBLE_DURATION = 0.28;
const WAVE_TALLY_HOLD_DURATION = 0.5;
const WAVE_TALLY_ERASE_DURATION = 0.4;
const WAVE_TALLY_KILL_PADDING = 18;
const WAVE_TALLY_DAMAGE_PADDING = 24;
const WAVE_TALLY_KILL_FONT_SIZE = 17;
const WAVE_TALLY_DAMAGE_FONT_SIZE = 16;

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

    this.combatStats = this.createCombatStatsContainer();
    this.statsPanelEnabled = false;
    this.statsDirty = false;
    this.statsLastRender = 0;

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
    // Store both the ambient river particles and the luminous tracer sparks.
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;

    this.slots = new Map();
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.damageNumbers = [];
    this.damageNumberIdCounter = 0;
    // Queue knockback requests so the renderer knows when swirl rings should react to hits.
    this.enemySwirlImpacts = [];
    // Maintain per-tower particle burst queues so α/β/γ/ν visuals can update independently.
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
    this.nuBursts = [];
    this.chiThralls = [];
    this.chiLightTrails = [];
    this.chiThrallIdCounter = 0;
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

    // Track explicit lattice connections so only linked towers share resources.
    this.towerConnectionMap = new Map(); // sourceId -> targetId
    this.towerConnectionSources = new Map(); // targetId -> Set<sourceId>
    this.connectionEffects = [];
    this.connectionDragState = {
      pointerId: null,
      originTowerId: null,
      startPosition: null,
      currentPosition: null,
      active: false,
      hasMoved: false,
      highlightEntries: [],
      hoverEntry: null,
    };
    this.deltaCommandDragState = {
      pointerId: null,
      towerId: null,
      startPosition: null,
      currentPosition: null,
      startNormalized: null,
      currentNormalized: null,
      active: false,
      hasMoved: false,
      trackAnchor: null,
      trackDistance: Infinity,
      anchorAvailable: false,
    };

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
    this.towerHoldState = {
      pointerId: null,
      towerId: null,
      startClientX: 0,
      startClientY: 0,
      holdTimeoutId: null,
      holdActivated: false,
      scribbleCleanup: null,
      actionTriggered: null,
      pointerType: null,
    };
    this.towerTapState = {
      lastTowerId: null,
      lastTapTime: 0,
      lastTapPosition: null,
    };
    // Maintain glow state for pressed towers so pointer interactions can animate highlights.
    this.towerPressHighlights = new Map();
    this.towerPressPointerMap = new Map();

    this.developerPathMarkers = [];
    // Developer crystals are sandbox obstacles that towers can chip away during testing.
    this.developerCrystals = [];
    this.crystalShards = [];
    this.crystalIdCounter = 0;
    this.focusedCrystalId = null;


    this.enemyTooltip = null;
    this.enemyTooltipNameEl = null;
    this.enemyTooltipHpEl = null;

    if (typeof StatsPanel.setInteractionHandlers === 'function') {
      // Allow the stats surface to request focus changes or pop-up refreshes when an entry is clicked.
      StatsPanel.setInteractionHandlers({
        focusEnemy: (enemyId) => this.focusEnemyById(enemyId),
        clearEnemyFocus: () => this.clearFocusedEnemy({ silent: true }),
      });
    }

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

  createCombatStatsContainer() {
    return {
      active: false,
      elapsed: 0,
      towerInstances: new Map(),
      // Incremental index assigned to each unique placement so summaries can disambiguate duplicates.
      placementCount: 0,
      attackLog: [],
      enemyHistory: [],
    };
  }

  resetCombatStats() {
    this.combatStats = this.createCombatStatsContainer();
    this.statsDirty = false;
    this.statsLastRender = 0;
    if (typeof StatsPanel.resetPanel === 'function') {
      StatsPanel.resetPanel();
    }
  }

  resetChiSystems() {
    if (Array.isArray(this.chiThralls)) {
      this.chiThralls.length = 0;
    } else {
      this.chiThralls = [];
    }
    if (Array.isArray(this.chiLightTrails)) {
      this.chiLightTrails.length = 0;
    } else {
      this.chiLightTrails = [];
    }
  }

  resetDamageNumbers() {
    if (Array.isArray(this.damageNumbers)) {
      this.damageNumbers.length = 0;
    } else {
      this.damageNumbers = [];
    }
    this.damageNumberIdCounter = 0;
  }

  clearDamageNumbers() {
    this.resetDamageNumbers();
  }

  // Reset wave tally overlays so the scribble queue can start fresh.
  resetWaveTallies() {
    if (Array.isArray(this.waveTallyLabels)) {
      this.waveTallyLabels.length = 0;
    } else {
      this.waveTallyLabels = [];
    }
    this.waveTallyIdCounter = 0;
  }

  // Remove existing wave tally overlays, optionally by type, when preferences change.
  clearWaveTallies({ type = null } = {}) {
    if (!Array.isArray(this.waveTallyLabels) || !this.waveTallyLabels.length) {
      this.waveTallyLabels = [];
      return;
    }
    if (!type) {
      this.waveTallyLabels.length = 0;
      return;
    }
    this.waveTallyLabels = this.waveTallyLabels.filter((entry) => entry && entry.type !== type);
  }

  areDamageNumbersActive() {
    if (this.previewOnly) {
      return false;
    }
    return areDamageNumbersEnabled();
  }

  // Wave kill tallies should only render during live combat and when enabled.
  areWaveKillTalliesActive() {
    if (this.previewOnly) {
      return false;
    }
    return areWaveKillTalliesEnabled();
  }

  // Wave damage tallies should only render during live combat and when enabled.
  areWaveDamageTalliesActive() {
    if (this.previewOnly) {
      return false;
    }
    return areWaveDamageTalliesEnabled();
  }

  resolveDamageNumberDirection(enemyPosition, sourceTower) {
    const fallbackAngle = Math.random() * Math.PI * 2;
    if (sourceTower && Number.isFinite(sourceTower.x) && Number.isFinite(sourceTower.y)) {
      const dx = enemyPosition.x - sourceTower.x;
      const dy = enemyPosition.y - sourceTower.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001) {
        const jitter = (Math.random() - 0.5) * (Math.PI / 6);
        const cos = Math.cos(jitter);
        const sin = Math.sin(jitter);
        const nx = dx / distance;
        const ny = dy / distance;
        const jitteredX = nx * cos - ny * sin;
        const jitteredY = nx * sin + ny * cos;
        const magnitude = Math.hypot(jitteredX, jitteredY) || 1;
        return { x: jitteredX / magnitude, y: jitteredY / magnitude };
      }
    }
    return { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
  }

  spawnDamageNumber(enemy, damage, { sourceTower } = {}) {
    if (!this.areDamageNumbersActive() || !enemy || !Number.isFinite(damage) || damage <= 0) {
      return;
    }
    const enemyPosition = this.getEnemyPosition(enemy);
    if (!enemyPosition) {
      return;
    }
    const label = formatCombatNumber(damage);
    if (!label) {
      return;
    }
    const metrics = this.getEnemyVisualMetrics(enemy);
    const direction = this.resolveDamageNumberDirection(enemyPosition, sourceTower);
    const offsetDistance = (metrics?.ringRadius || 12) + 6;
    const spawnPosition = {
      x: enemyPosition.x + direction.x * offsetDistance,
      y: enemyPosition.y + direction.y * offsetDistance,
    };
    const gradientSample = samplePaletteGradient(Math.random());
    const magnitude = Math.max(0, Math.log10(Math.max(1, damage)));
    const fontSize = Math.min(28, 16 + magnitude * 2.6);
    const initialSpeed = 110 + Math.random() * 45;
    const entry = {
      id: (this.damageNumberIdCounter += 1),
      position: spawnPosition,
      velocity: {
        x: direction.x * initialSpeed,
        y: direction.y * (initialSpeed * 0.85),
      },
      text: label,
      color: gradientSample,
      fontSize,
      elapsed: 0,
      lifetime: 1.15,
      alpha: 1,
    };
    this.damageNumbers.push(entry);
    const maxEntries = 90;
    if (this.damageNumbers.length > maxEntries) {
      this.damageNumbers.splice(0, this.damageNumbers.length - maxEntries);
    }
  }

  // Queue a swirl knockback entry so the renderer can fan particles away from the hit.
  recordEnemySwirlImpact(enemy, { sourcePosition, damageApplied, enemyHpBefore } = {}) {
    if (!enemy) {
      return;
    }
    const enemyPosition = this.getEnemyPosition(enemy);
    if (!enemyPosition) {
      return;
    }
    const queue = Array.isArray(this.enemySwirlImpacts) ? this.enemySwirlImpacts : (this.enemySwirlImpacts = []);
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    let direction = null;
    if (sourcePosition && Number.isFinite(sourcePosition.x) && Number.isFinite(sourcePosition.y)) {
      direction = {
        x: enemyPosition.x - sourcePosition.x,
        y: enemyPosition.y - sourcePosition.y,
      };
    }
    if (!direction) {
      const fallbackAngle = Math.random() * Math.PI * 2;
      direction = { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
    }
    const magnitude = Math.hypot(direction.x, direction.y) || 1;
    const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
    const baseStrength = Number.isFinite(damageApplied) && Number.isFinite(enemyHpBefore) && enemyHpBefore > 0
      ? damageApplied / enemyHpBefore
      : 1;
    const strength = Math.max(0.45, Math.min(1.35, baseStrength));
    queue.push({ enemy, direction: normalized, strength, timestamp: now });
    const maxQueueEntries = 120;
    if (queue.length > maxQueueEntries) {
      queue.splice(0, queue.length - maxQueueEntries);
    }
  }

  updateDamageNumbers(delta) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }
    if (!Array.isArray(this.damageNumbers) || !this.damageNumbers.length) {
      return;
    }
    if (!this.areDamageNumbersActive()) {
      this.resetDamageNumbers();
      return;
    }
    const damping = 7.5;
    for (let index = this.damageNumbers.length - 1; index >= 0; index -= 1) {
      const entry = this.damageNumbers[index];
      if (!entry) {
        this.damageNumbers.splice(index, 1);
        continue;
      }
      entry.elapsed += delta;
      if (entry.elapsed >= entry.lifetime) {
        this.damageNumbers.splice(index, 1);
        continue;
      }
      const drag = Math.max(0, 1 - damping * delta);
      entry.velocity.x *= drag;
      entry.velocity.y *= drag;
      if (Math.abs(entry.velocity.x) < 1) {
        entry.velocity.x = 0;
      }
      if (Math.abs(entry.velocity.y) < 1) {
        entry.velocity.y = 0;
      }
      entry.position.x += entry.velocity.x * delta;
      entry.position.y += entry.velocity.y * delta;
      const fadeStart = entry.lifetime * 0.55;
      if (entry.elapsed <= fadeStart) {
        entry.alpha = 1;
      } else {
        const fadeDuration = Math.max(entry.lifetime - fadeStart, 0.001);
        const fadeProgress = (entry.elapsed - fadeStart) / fadeDuration;
        entry.alpha = Math.max(0, 1 - fadeProgress);
      }
      if (entry.alpha <= 0.01) {
        this.damageNumbers.splice(index, 1);
      }
    }
  }

  // Measure tally label width so scribble clips feel natural even on mobile canvases.
  measureWaveTallyLabelWidth(label, font, fontSize = 16) {
    if (!label) {
      return 0;
    }
    if (!this.ctx || typeof this.ctx.measureText !== 'function') {
      const fallbackSize = Number.isFinite(fontSize) ? fontSize : 16;
      return label.length * fallbackSize * 0.55;
    }
    this.ctx.save();
    this.ctx.font = font;
    const metrics = this.ctx.measureText(label);
    this.ctx.restore();
    return metrics.width;
  }

  // Build a wave tally overlay entry for the requested tower and statistic type.
  createWaveTallyEntry(tower, { type, label }) {
    if (!tower || !tower.id || !label) {
      return null;
    }
    const fontSize = type === 'kills' ? WAVE_TALLY_KILL_FONT_SIZE : WAVE_TALLY_DAMAGE_FONT_SIZE;
    const font = `600 ${fontSize}px ${WAVE_TALLY_FONT_FAMILY}`;
    const color = type === 'kills' ? WAVE_TALLY_KILL_COLOR : WAVE_TALLY_DAMAGE_COLOR;
    const padding = type === 'kills' ? WAVE_TALLY_KILL_PADDING : WAVE_TALLY_DAMAGE_PADDING;
    const entry = {
      id: `wave-tally-${(this.waveTallyIdCounter += 1)}`,
      towerId: tower.id,
      type,
      label,
      font,
      fontSize,
      color,
      strokeColor: WAVE_TALLY_SHADOW_COLOR,
      shadowColor: WAVE_TALLY_SHADOW_COLOR,
      shadowBlur: 10,
      padding,
      direction: type === 'kills' ? 'above' : 'below',
      scribbleDuration: WAVE_TALLY_SCRIBBLE_DURATION,
      holdDuration: WAVE_TALLY_HOLD_DURATION,
      eraseDuration: WAVE_TALLY_ERASE_DURATION,
      totalDuration:
        WAVE_TALLY_SCRIBBLE_DURATION + WAVE_TALLY_HOLD_DURATION + WAVE_TALLY_ERASE_DURATION,
      elapsed: 0,
      revealProgress: 0,
      eraseProgress: 0,
      alpha: 0,
      position: { x: tower.x, y: tower.y },
    };
    entry.textWidth = this.measureWaveTallyLabelWidth(label, font, fontSize);
    return entry;
  }

  // Spawn wave tally overlays for every active lattice once a wave concludes.
  spawnWaveCompletionTallies() {
    if (
      this.previewOnly ||
      !this.combatStats ||
      !this.combatStats.active ||
      !(this.combatStats.towerInstances instanceof Map)
    ) {
      return;
    }
    const showKills = this.areWaveKillTalliesActive();
    const showDamage = this.areWaveDamageTalliesActive();
    if (!showKills && !showDamage) {
      return;
    }
    if (!Array.isArray(this.towers) || !this.towers.length) {
      return;
    }
    if (!Array.isArray(this.waveTallyLabels)) {
      this.waveTallyLabels = [];
    }
    this.towers.forEach((tower) => {
      if (!tower?.id) {
        return;
      }
      const statsEntry = this.combatStats.towerInstances.get(tower.id);
      if (!statsEntry) {
        return;
      }
      if (showKills) {
        const kills = Number.isFinite(statsEntry.killCount) ? statsEntry.killCount : 0;
        if (kills > 0) {
          const killLabel = `Kills · ${formatWholeNumber(kills)}`;
          const entry = this.createWaveTallyEntry(tower, { type: 'kills', label: killLabel });
          if (entry) {
            this.waveTallyLabels.push(entry);
          }
        }
      }
      if (showDamage) {
        const totalDamage = Number.isFinite(statsEntry.totalDamage) ? statsEntry.totalDamage : 0;
        if (totalDamage > 0) {
          const damageLabel = `Damage · ${formatCombatNumber(totalDamage)}`;
          const entry = this.createWaveTallyEntry(tower, { type: 'damage', label: damageLabel });
          if (entry) {
            this.waveTallyLabels.push(entry);
          }
        }
      }
    });
  }

  // Advance the scribble/erase animation cycle for each active wave tally overlay.
  updateWaveTallies(delta) {
    if (!Array.isArray(this.waveTallyLabels) || !this.waveTallyLabels.length) {
      return;
    }
    const step = Math.max(0, delta);
    const survivors = [];
    this.waveTallyLabels.forEach((entry) => {
      if (!entry) {
        return;
      }
      entry.elapsed = (entry.elapsed || 0) + step;
      const totalDuration = entry.totalDuration
        || entry.scribbleDuration + entry.holdDuration + entry.eraseDuration;
      if (entry.elapsed >= totalDuration) {
        return;
      }
      let alpha = 1;
      let revealProgress = 1;
      let eraseProgress = 0;
      entry.isErasing = false;
      if (entry.elapsed <= entry.scribbleDuration) {
        const progress = entry.scribbleDuration > 0
          ? Math.min(1, entry.elapsed / entry.scribbleDuration)
          : 1;
        revealProgress = easeOutCubic(progress);
        alpha = Math.min(1, revealProgress + 0.15);
      } else if (entry.elapsed <= entry.scribbleDuration + entry.holdDuration) {
        revealProgress = 1;
        alpha = 1;
      } else {
        const eraseElapsed = entry.elapsed - (entry.scribbleDuration + entry.holdDuration);
        const ratio = entry.eraseDuration > 0 ? Math.min(1, eraseElapsed / entry.eraseDuration) : 1;
        eraseProgress = easeInCubic(ratio);
        alpha = Math.max(0, 1 - eraseProgress);
        entry.isErasing = true;
      }
      entry.revealProgress = revealProgress;
      entry.eraseProgress = eraseProgress;
      entry.alpha = alpha;
      const tower = this.getTowerById(entry.towerId);
      if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
        return;
      }
      const padding = Number.isFinite(entry.padding) ? entry.padding : WAVE_TALLY_DAMAGE_PADDING;
      const bodyRadius = this.resolveTowerBodyRadius(tower);
      const offset = bodyRadius + padding;
      const direction = entry.direction === 'above' ? -1 : 1;
      entry.position = {
        x: tower.x,
        y: tower.y + direction * offset,
      };
      if (alpha <= 0.02) {
        return;
      }
      survivors.push(entry);
    });
    this.waveTallyLabels = survivors;
  }

  setStatsPanelEnabled(enabled) {
    this.statsPanelEnabled = Boolean(enabled);
    if (typeof StatsPanel.setVisible === 'function') {
      StatsPanel.setVisible(this.statsPanelEnabled);
    }
    if (this.statsPanelEnabled) {
      this.refreshStatsPanel({ force: true });
    }
  }

  ensureTowerStatsEntry(tower) {
    if (!tower || !tower.id || !this.combatStats) {
      return null;
    }
    let entry = this.combatStats.towerInstances.get(tower.id);
    if (!entry) {
      // Assign a unique placement index so identical tower types remain distinguishable in the UI.
      const nextIndex = Number.isFinite(this.combatStats.placementCount)
        ? this.combatStats.placementCount + 1
        : 1;
      this.combatStats.placementCount = nextIndex;
      entry = {
        id: tower.id,
        type: tower.type,
        totalDamage: 0,
        killCount: 0,
        activeTime: 0,
        placementIndex: nextIndex,
        firstPlacedAt: Number.isFinite(this.combatStats.elapsed)
          ? Math.max(0, this.combatStats.elapsed)
          : 0,
      };
      this.combatStats.towerInstances.set(tower.id, entry);
    }
    entry.type = tower.type;
    entry.isActive = true;
    return entry;
  }

  startCombatStatsSession() {
    this.resetCombatStats();
    this.combatStats.active = true;
    if (Array.isArray(this.towers)) {
      this.towers.forEach((tower) => this.ensureTowerStatsEntry(tower));
    }
    this.scheduleStatsPanelRefresh();
    if (this.statsPanelEnabled) {
      this.refreshStatsPanel({ force: true });
    }
  }

  stopCombatStatsSession() {
    if (this.combatStats) {
      this.combatStats.active = false;
    }
    this.scheduleStatsPanelRefresh();
    if (this.statsPanelEnabled) {
      this.refreshStatsPanel({ force: true });
    }
  }

  scheduleStatsPanelRefresh() {
    this.statsDirty = true;
  }

  appendAttackLogEntry(tower, damage) {
    if (!this.combatStats || !tower) {
      return;
    }
    const value = Number.isFinite(damage) ? Math.max(0, damage) : 0;
    if (value <= 0) {
      return;
    }
    const log = this.combatStats.attackLog;
    const maxEntries = 60;
    const last = log[0];
    if (last && last.type === tower.type) {
      last.damage += value;
      last.events = (last.events || 1) + 1;
      last.timestamp = this.combatStats.elapsed;
      return;
    }
    log.unshift({
      type: tower.type,
      damage: value,
      events: 1,
      timestamp: this.combatStats.elapsed,
    });
    if (log.length > maxEntries) {
      log.length = maxEntries;
    }
  }

  recordDamageEvent({ tower, enemy = null, damage = 0 } = {}) {
    if (!tower || !Number.isFinite(damage) || damage <= 0 || !this.combatStats) {
      return;
    }
    const entry = this.ensureTowerStatsEntry(tower);
    if (entry) {
      entry.totalDamage = (entry.totalDamage || 0) + damage;
    }
    if (enemy) {
      if (!(enemy.damageContributors instanceof Map)) {
        enemy.damageContributors = new Map();
      }
      const previous = enemy.damageContributors.get(tower.type) || 0;
      enemy.damageContributors.set(tower.type, previous + damage);
    }
    this.appendAttackLogEntry(tower, damage);
    this.scheduleStatsPanelRefresh();
  }

  // Track kill counts per tower so wave tallies and analytics stay in sync.
  recordKillEvent(tower) {
    if (!tower || !this.combatStats) {
      return;
    }
    const entry = this.ensureTowerStatsEntry(tower);
    if (!entry) {
      return;
    }
    entry.killCount = (entry.killCount || 0) + 1;
    this.scheduleStatsPanelRefresh();
  }

  buildTowerSummaries() {
    if (!this.combatStats) {
      return [];
    }
    const summaries = [];
    this.combatStats.towerInstances.forEach((instance) => {
      if (!instance || !instance.type) {
        return;
      }
      const totalDamage = Number.isFinite(instance.totalDamage) ? Math.max(0, instance.totalDamage) : 0;
      const activeTime = Number.isFinite(instance.activeTime) ? Math.max(0, instance.activeTime) : 0;
      summaries.push({
        id: instance.id,
        type: instance.type,
        totalDamage,
        killCount: Number.isFinite(instance.killCount) ? Math.max(0, instance.killCount) : 0,
        activeTime,
        averageDps: activeTime > 0 ? totalDamage / activeTime : 0,
        isActive: Boolean(instance.isActive),
        placementIndex: Number.isFinite(instance.placementIndex) ? instance.placementIndex : null,
        firstPlacedAt: Number.isFinite(instance.firstPlacedAt) ? instance.firstPlacedAt : 0,
        retiredAt: Number.isFinite(instance.retiredAt) ? instance.retiredAt : null,
      });
    });
    return summaries.sort((a, b) => b.totalDamage - a.totalDamage);
  }

  /**
   * Normalize the enemy group definitions for a wave configuration.
   * @param {Object} config - Raw wave configuration
   * @returns {Array} Sanitized enemy group list
   */
  resolveWaveGroups(config = null) {
    if (!config) {
      return [];
    }

    const base = {
      hp: Number.isFinite(config.hp) ? config.hp : 0,
      speed: Number.isFinite(config.speed) ? config.speed : 0,
      reward: Number.isFinite(config.reward) ? config.reward : 0,
      color: config.color || null,
      codexId: config.codexId || null,
      label: config.label || null,
      symbol: config.symbol || null,
    };

    const normalizeGroup = (group = {}) => {
      const count = Number.isFinite(group.count) ? Math.max(0, Math.floor(group.count)) : 0;
      const hp = Number.isFinite(group.hp) ? Math.max(0, group.hp) : base.hp;
      const speed = Number.isFinite(group.speed) ? group.speed : base.speed;
      const reward = Number.isFinite(group.reward) ? group.reward : base.reward;
      return {
        count,
        hp,
        speed,
        reward,
        color: group.color || base.color,
        codexId: group.codexId || base.codexId,
        label: group.label || base.label,
        symbol: group.symbol || base.symbol,
        enemyType: group.enemyType || null,
        interval: Number.isFinite(group.interval) ? group.interval : null,
      };
    };

    let groups = [];
    if (Array.isArray(config.enemyGroups) && config.enemyGroups.length) {
      groups = config.enemyGroups.map((group) => normalizeGroup(group));
    } else {
      const minionCount = Number.isFinite(config.minionCount)
        ? Math.max(0, Math.floor(config.minionCount))
        : Number.isFinite(config.count)
          ? Math.max(0, Math.floor(config.count - (config.boss ? 1 : 0)))
          : 0;
      if (minionCount > 0) {
        groups = [normalizeGroup({ ...config, count: minionCount })];
      }
    }

    return groups.filter((group) => group.count > 0);
  }

  /**
   * Convert a wave configuration into formatted queue entries for UI rendering.
   */
  buildWaveEntries(config, {
    spawned = 0,
    waveNumber = this.currentWaveNumber,
    label = '',
    waveIndex = this.waveIndex,
    isCurrent = false,
  } = {}) {
    if (!config) {
      return [];
    }

    const entries = [];
    const groups = this.resolveWaveGroups(config);
    const hasBoss = Boolean(config.boss && typeof config.boss === 'object');
    const totalMinionCount = groups.reduce(
      (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
      0,
    );
    const totalSpawnCount = totalMinionCount + (hasBoss ? 1 : 0);
    const normalizedSpawned = Number.isFinite(spawned) ? Math.max(0, Math.floor(spawned)) : 0;
    const clampedSpawned = Math.min(normalizedSpawned, totalSpawnCount);
    const spawnedMinions = Math.min(clampedSpawned, totalMinionCount);
    const bossAlreadySpawned = hasBoss && clampedSpawned > totalMinionCount;
    const bossRemaining = hasBoss && !bossAlreadySpawned ? 1 : 0;
    const theroSymbol = this.theroSymbol || 'þ';

    const resolveEnemyName = (source = {}) => {
      if (source.label) {
        return source.label;
      }
      if (source.codexId) {
        const codex = getEnemyCodexEntry(source.codexId);
        if (codex?.name) {
          return codex.name;
        }
      }
      return 'Glyph';
    };

    const waveSubtitle = () => {
      if (!Number.isFinite(waveNumber)) {
        return label;
      }
      return label ? `Wave ${waveNumber} · ${label}` : `Wave ${waveNumber}`;
    };

    const createDialogRows = (details = {}) => {
      // Determine the total count to display so future waves and bosses show the correct denominator.
      const totalCount = Number.isFinite(details.totalCount)
        ? Math.max(0, Math.floor(details.totalCount))
        : totalSpawnCount;

      return [
        Number.isFinite(waveNumber)
          ? { label: 'Wave', value: String(waveSubtitle()) }
          : null,
        { label: 'Enemy', value: resolveEnemyName(details) },
        {
          label: isCurrent ? 'Remaining' : 'Count',
          value: isCurrent
            ? `${Math.max(0, details.remaining)}/${totalCount}`
            : `${totalCount}`,
        },
        {
          label: 'HP',
          value: this.formatEnemyExponentLabel(
            this.calculateHealthExponent(details.hp),
            details.hp,
          ),
        },
        {
          label: 'Reward',
          value: `${formatCombatNumber(Math.max(0, details.reward || 0))} ${theroSymbol}`,
        },
        {
          label: 'Speed',
          value: this.formatEnemySpeed(details.speed),
        },
        Number.isFinite(details.interval)
          ? { label: 'Spawn Interval', value: `${details.interval.toFixed(2)} s` }
          : null,
          Number.isFinite(config.delay)
            ? { label: 'Wave Delay', value: `${Math.max(0, config.delay).toFixed(2)} s` }
            : null,
      ].filter(Boolean);
    };

    let remainingSpawned = spawnedMinions;

    groups.forEach((group, index) => {
      const groupCount = Math.max(0, Math.floor(group.count || 0));
      if (!groupCount) {
        return;
      }
      const spawnedInGroup = Math.min(groupCount, remainingSpawned);
      remainingSpawned -= spawnedInGroup;
      const remaining = isCurrent ? Math.max(0, groupCount - spawnedInGroup) : groupCount;
      const symbol = this.resolveEnemySymbol(group);
      const enemyName = resolveEnemyName(group);
      const exponent = this.calculateHealthExponent(group.hp);
      const hpLabel = this.formatEnemyExponentLabel(exponent, group.hp);
      const rewardLabel = `${formatCombatNumber(Math.max(0, group.reward || 0))} ${theroSymbol}`;
      const title = `${symbol} — ${enemyName}`;
      entries.push({
        id: `${isCurrent ? 'current' : 'next'}-${waveIndex}-group-${index}`,
        title,
        subtitle: waveSubtitle(),
        meta: [
          {
            text: isCurrent
              ? `Remaining ${remaining}/${groupCount}`
              : `Count ${groupCount}`,
            emphasize: true,
          },
          { text: `HP ${hpLabel}` },
          { text: `Reward ${rewardLabel}` },
          { text: `Speed ${this.formatEnemySpeed(group.speed)}` },
        ],
        footnote: null,
        dialog: {
          title,
          rows: createDialogRows({
            remaining,
            hp: group.hp,
            reward: group.reward,
            speed: group.speed,
            interval: Number.isFinite(group.interval) ? group.interval : config.interval,
            // Ensure the dialog reflects the exact enemy count for the current group.
            totalCount: groupCount,
          }),
        },
      });
    });

    if (bossRemaining > 0 || (!isCurrent && hasBoss)) {
      const bossConfig = { ...config, ...(config.boss || {}) };
      const symbol = typeof bossConfig.symbol === 'string'
        ? bossConfig.symbol
        : this.resolveEnemySymbol(bossConfig);
      const bossName = bossConfig.label || `Boss ${resolveEnemyName(config)}`;
      const exponent = this.calculateHealthExponent(bossConfig.hp);
      const hpLabel = this.formatEnemyExponentLabel(exponent, bossConfig.hp);
      const rewardLabel = `${formatCombatNumber(Math.max(0, bossConfig.reward || 0))} ${theroSymbol}`;
      const title = `${symbol} — ${bossName}`;
      entries.push({
        id: `${isCurrent ? 'current' : 'next'}-${waveIndex}-boss`,
        title,
        subtitle: waveSubtitle(),
        meta: [
          { text: `Remaining ${bossRemaining}/${bossRemaining || 1}`, emphasize: true },
          { text: `HP ${hpLabel}` },
          { text: `Reward ${rewardLabel}` },
          { text: `Speed ${this.formatEnemySpeed(bossConfig.speed)}` },
        ],
        footnote: 'Boss enemy spawns at the end of the wave.',
        dialog: {
          title,
          rows: createDialogRows({
            remaining: bossRemaining,
            hp: bossConfig.hp,
            reward: bossConfig.reward,
            speed: bossConfig.speed,
            interval: config.interval,
            // Boss entries always represent a single target regardless of remaining count.
            totalCount: hasBoss ? 1 : bossRemaining,
          }),
        },
      });
    }

    return entries;
  }

  /**
   * Generate formatted entries for the currently active wave queue.
   */
  buildCurrentWaveQueue() {
    if (!this.levelConfig) {
      return { entries: [] };
    }

    let config = null;
    let spawned = 0;
    let waveLabel = '';
    let waveNumber = this.currentWaveNumber || this.computeWaveNumber(this.waveIndex);

    if (this.activeWave?.config) {
      config = this.activeWave.config;
      spawned = Number.isFinite(this.activeWave.spawned) ? Math.max(0, this.activeWave.spawned) : 0;
      waveLabel = config.label || '';
      waveNumber = this.currentWaveNumber || waveNumber;
    } else {
      const baseConfig = Array.isArray(this.levelConfig.waves)
        ? this.levelConfig.waves[this.waveIndex]
        : null;
      if (!baseConfig) {
        return { entries: [] };
      }
      config = this.scaleWaveConfigForCycle(baseConfig, this.endlessCycle);
      waveLabel = config.label || baseConfig.label || '';
      spawned = 0;
    }

    return {
      entries: this.buildWaveEntries(config, {
        spawned,
        waveNumber,
        label: waveLabel,
        waveIndex: this.waveIndex,
        isCurrent: true,
      }),
    };
  }

  /**
   * Generate formatted entries for the next wave preview so players can scout ahead.
   */
  buildNextWaveQueue() {
    if (!this.levelConfig || !Array.isArray(this.levelConfig.waves)) {
      return { entries: [] };
    }
    const waves = this.levelConfig.waves;
    if (!waves.length) {
      return { entries: [] };
    }

    const waveCount = waves.length;
    if (!waveCount) {
      return { entries: [] };
    }

    let nextIndex = Number.isFinite(this.waveIndex) ? this.waveIndex + 1 : 0;
    let cycle = Number.isFinite(this.endlessCycle) ? this.endlessCycle : 0;
    cycle = Math.max(0, cycle);

    if (nextIndex < 0) {
      nextIndex = 0;
    }

    if (nextIndex >= waveCount) {
      if (!this.isEndlessMode) {
        return { entries: [] };
      }
      const cycleJump = Math.floor(nextIndex / waveCount);
      nextIndex %= waveCount;
      cycle += cycleJump;
    }

    const baseConfig = waves[nextIndex];
    if (!baseConfig) {
      return { entries: [] };
    }

    const scaled = this.scaleWaveConfigForCycle(baseConfig, cycle);
    const total = Math.max(1, this.baseWaveCount || waveCount);
    const waveNumber = this.isEndlessMode
      ? cycle * total + nextIndex + 1
      : nextIndex + 1;
    const waveLabel = scaled.label || baseConfig.label || '';

    return {
      entries: this.buildWaveEntries(scaled, {
        spawned: 0,
        waveNumber,
        label: waveLabel,
        waveIndex: nextIndex,
        isCurrent: false,
      }),
    };
  }

  /**
   * Build formatted entries for all on-screen enemies so the stats panel can update live.
   */
  buildActiveEnemyEntries() {
    if (!Array.isArray(this.enemies) || !this.enemies.length) {
      return [];
    }
    const theroSymbol = this.theroSymbol || 'þ';
    const waveLabel = this.activeWave?.config?.label || '';
    const waveNumber = this.currentWaveNumber || this.computeWaveNumber(this.waveIndex);

    const entries = this.enemies
      .map((enemy) => {
        if (!enemy || !Number.isFinite(enemy.id)) {
          return null;
        }
        const symbol = typeof enemy.symbol === 'string'
          ? enemy.symbol
          : this.resolveEnemySymbol(enemy);
        const label = enemy.label || symbol || 'Glyph';
        const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
        const maxHp = Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : remainingHp;
        const exponent = this.calculateHealthExponent(remainingHp > 0 ? remainingHp : maxHp);
        const maxExponent = this.calculateHealthExponent(maxHp);
        const reward = Number.isFinite(enemy.reward) ? Math.max(0, enemy.reward) : 0;
        const rows = [
          { label: 'Status', value: enemy.isBoss ? 'Boss' : 'Standard' },
          {
            label: 'Current HP',
            value: this.formatEnemyExponentLabel(exponent, remainingHp),
          },
          {
            label: 'Max HP',
            value: this.formatEnemyExponentLabel(maxExponent, maxHp),
          },
          {
            label: 'Reward',
            value: `${formatCombatNumber(reward)} ${theroSymbol}`,
          },
          { label: 'Speed', value: this.formatEnemySpeed(enemy.speed) },
        ];

        if (Number.isFinite(enemy.baseSpeed) && Math.abs(enemy.baseSpeed - enemy.speed) > 0.0001) {
          rows.push({ label: 'Base Speed', value: this.formatEnemySpeed(enemy.baseSpeed) });
        }
        if (Number.isFinite(enemy.gemDropMultiplier)) {
          rows.push({ label: 'Gem Multiplier', value: `×${enemy.gemDropMultiplier.toFixed(2)}` });
        }
        if (Number.isFinite(enemy.moteFactor)) {
          rows.push({ label: 'Mote Yield', value: formatCombatNumber(enemy.moteFactor) });
        }
        if (Number.isFinite(waveNumber)) {
          rows.unshift({ label: 'Wave', value: waveLabel ? `Wave ${waveNumber} · ${waveLabel}` : `Wave ${waveNumber}` });
        }

        const priority = maxHp > 0 ? maxHp : remainingHp;

        return {
          id: enemy.id,
          focusEnemyId: enemy.id,
          priority,
          title: `${symbol} — ${label}`,
          subtitle: waveLabel && Number.isFinite(waveNumber)
            ? `Wave ${waveNumber} · ${waveLabel}`
            : Number.isFinite(waveNumber)
              ? `Wave ${waveNumber}`
              : waveLabel,
          meta: [
            { text: `HP ${this.formatEnemyExponentLabel(exponent, remainingHp)}`, emphasize: true },
            { text: `Reward ${formatCombatNumber(reward)} ${theroSymbol}` },
            { text: `Speed ${this.formatEnemySpeed(enemy.speed)}` },
          ],
          footnote: enemy.isBoss ? 'Boss enemy currently on the field.' : null,
          dialog: {
            title: `${symbol} — ${label}`,
            rows,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return entries.map(({ priority, ...entry }) => entry);
  }

  captureEnemyHistory(enemy) {
    if (!enemy || !this.combatStats) {
      return;
    }
    const contributors = enemy.damageContributors instanceof Map
      ? Array.from(enemy.damageContributors.entries())
      : [];
    const topContributors = contributors
      .map(([type, amount]) => ({ type, damage: Number.isFinite(amount) ? Math.max(0, amount) : 0 }))
      .filter((entry) => entry.damage > 0)
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 3);
    const historyEntry = {
      id: enemy.id,
      label: enemy.label || enemy.symbol || 'Enemy',
      hp: Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : Math.max(0, enemy.hp || 0),
      topContributors,
      timestamp: this.combatStats.elapsed,
    };
    this.combatStats.enemyHistory.unshift(historyEntry);
    const maxEntries = 40;
    if (this.combatStats.enemyHistory.length > maxEntries) {
      this.combatStats.enemyHistory.length = maxEntries;
    }
    this.scheduleStatsPanelRefresh();
  }

  refreshStatsPanel({ force = false } = {}) {
    if (!this.combatStats) {
      return;
    }
    if (!this.statsPanelEnabled && !force) {
      this.statsDirty = false;
      return;
    }
    const summaries = this.buildTowerSummaries();
    if (typeof StatsPanel.renderTowerSummaries === 'function') {
      StatsPanel.renderTowerSummaries(summaries);
    }
    if (typeof StatsPanel.renderAttackLog === 'function') {
      StatsPanel.renderAttackLog(this.combatStats.attackLog.slice(0, 40));
    }
    if (typeof StatsPanel.renderEnemyHistory === 'function') {
      StatsPanel.renderEnemyHistory(this.combatStats.enemyHistory.slice(0, 24));
    }
    if (typeof StatsPanel.renderCurrentWaveQueue === 'function') {
      StatsPanel.renderCurrentWaveQueue(this.buildCurrentWaveQueue());
    }
    if (typeof StatsPanel.renderNextWaveQueue === 'function') {
      StatsPanel.renderNextWaveQueue(this.buildNextWaveQueue());
    }
    if (typeof StatsPanel.renderActiveEnemyList === 'function') {
      StatsPanel.renderActiveEnemyList(this.buildActiveEnemyEntries());
    }
    this.statsDirty = false;
    this.statsLastRender = this.combatStats.elapsed;
  }

  updateCombatStats(delta) {
    if (!this.combatStats || !this.combatStats.active) {
      return;
    }
    const step = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.combatStats.elapsed += step;
    const activeIds = new Set();
    this.towers.forEach((tower) => {
      const entry = this.ensureTowerStatsEntry(tower);
      if (entry) {
        entry.activeTime = (entry.activeTime || 0) + step;
        activeIds.add(tower.id);
      }
    });
    this.combatStats.towerInstances.forEach((entry, towerId) => {
      if (!activeIds.has(towerId) && entry) {
        entry.isActive = false;
      }
    });
    if (this.statsPanelEnabled && this.statsDirty) {
      const elapsedSinceRender = this.combatStats.elapsed - this.statsLastRender;
      if (elapsedSinceRender >= 0.25) {
        this.refreshStatsPanel();
      }
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

  // Applies a canvas shadow when high graphics fidelity is active.
  applyCanvasShadow(ctx, color, blur) {
    return CanvasRenderer.applyCanvasShadow.call(this, ctx, color, blur);
  }

  // Clears active canvas shadow configuration regardless of the fidelity mode.
  clearCanvasShadow(ctx) {
    return CanvasRenderer.clearCanvasShadow.call(this, ctx);
  }

  registerSlots() {
    return HudBindings.registerSlots.call(this);
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

  ensureTowerCostHistory(tower) {
    if (!tower) {
      return [];
    }
    if (!Array.isArray(tower.costHistory)) {
      tower.costHistory = [];
    }
    if (tower.costHistory.length === 0 && tower.costHistoryInitialized !== true) {
      this.reconstructTowerCostHistory(tower);
    }
    return tower.costHistory;
  }

  reconstructTowerCostHistory(tower) {
    if (!tower) {
      return [];
    }
    const history = [];
    const visited = new Set();
    let cursorId = tower.type || null;
    while (cursorId && !visited.has(cursorId)) {
      visited.add(cursorId);
      const definition = getTowerDefinition(cursorId);
      if (!definition) {
        break;
      }
      const baseCost = Number.isFinite(definition.baseCost) ? Math.max(0, definition.baseCost) : 0;
      if (baseCost > 0) {
        history.unshift(baseCost);
      }
      cursorId = getPreviousTowerId(cursorId);
    }
    tower.costHistory = history;
    tower.costHistoryInitialized = true;
    return tower.costHistory;
  }

  recordTowerCost(tower, amount) {
    if (!tower || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const history = this.ensureTowerCostHistory(tower);
    history.push(Math.max(0, amount));
    tower.costHistoryInitialized = true;
  }

  calculateTowerSellRefund(tower) {
    if (!tower) {
      return 0;
    }
    const history = this.ensureTowerCostHistory(tower);
    if (!history.length) {
      const fallback = getTowerDefinition(tower.type)?.baseCost ?? this.getCurrentTowerCost(tower.type);
      return Math.max(0, Number.isFinite(fallback) ? fallback : 0);
    }
    return history.reduce((total, entry) => (Number.isFinite(entry) ? total + entry : total), 0);
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
    return HudBindings.bindStartButton.call(this);
  }

  bindSpeedButton() {
    return HudBindings.bindSpeedButton.call(this);
  }

  bindAutoAnchorButton() {
    return HudBindings.bindAutoAnchorButton.call(this);
  }

  bindAutoWaveCheckbox() {
    return HudBindings.bindAutoWaveCheckbox.call(this);
  }

  scheduleAutoStart(options = {}) {
    return HudBindings.scheduleAutoStart.call(this, options);
  }

  cancelAutoStart() {
    return HudBindings.cancelAutoStart.call(this);
  }

  tryAutoStart() {
    return HudBindings.tryAutoStart.call(this);
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
    return InputController.attachCanvasInteractions.call(this);
  }

  createEnemyTooltip() {
    return HudBindings.createEnemyTooltip.call(this);
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
      this.trackRiverParticles = [];
      this.trackRiverTracerParticles = [];
      this.trackRiverPulse = 0;
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
    this.initializeTrackRiverParticles();
  }

  initializeTrackRiverParticles() {
    if (!this.pathSegments.length || !Number.isFinite(this.pathLength) || this.pathLength <= 0) {
      this.trackRiverParticles = [];
      this.trackRiverTracerParticles = [];
      this.trackRiverPulse = 0;
      return;
    }

    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const baseCount = Math.round(this.pathLength / Math.max(28, minDimension * 0.35));
    const particleCount = Math.max(36, Math.min(160, baseCount));
    const createParticle = () => ({
      progress: Math.random(),
      speed: 0.045 + Math.random() * 0.05,
      radius: 0.7 + Math.random() * 1.2,
      offset: (Math.random() - 0.5) * 0.8,
      offsetTarget: (Math.random() - 0.5) * 0.8,
      driftRate: 0.5 + Math.random() * 0.9,
      driftTimer: 0.6 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.6 + Math.random() * 1.3,
    });

    // Generate a smaller band of tracer sparks that accelerate along the river track.
    const createTracerParticle = () => ({
      progress: Math.random(),
      speed: 0.12 + Math.random() * 0.08,
      offset: (Math.random() - 0.5) * 0.3,
      offsetTarget: (Math.random() - 0.5) * 0.3,
      driftRate: 2 + Math.random() * 2.2,
      driftTimer: 0.25 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 1.6 + Math.random() * 1.4,
    });

    this.trackRiverParticles = Array.from({ length: particleCount }, createParticle);
    const tracerCount = Math.max(10, Math.round(particleCount * 0.25));
    this.trackRiverTracerParticles = Array.from({ length: tracerCount }, createTracerParticle);
    this.trackRiverPulse = 0;
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
    // Wrap the frame lifecycle with performance markers so diagnostics can attribute work.
    beginPerformanceFrame();
    try {
      const finishUpdateSegment = beginPerformanceSegment('update');
      try {
        this.update(safeDelta);
      } finally {
        finishUpdateSegment();
      }
      const finishDrawSegment = beginPerformanceSegment('draw');
      try {
        this.draw();
      } finally {
        finishDrawSegment();
      }
    } finally {
      endPerformanceFrame();
    }

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

    this.clearDeveloperCrystals({ silent: true });

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
      this.resetCombatStats();
      this.setStatsPanelEnabled(false);
      this.disableSlots(true);
      this.enemies = [];
      this.resetChiSystems();
      this.projectiles = [];
      this.resetDamageNumbers();
      this.resetWaveTallies();
      this.alphaBursts = [];
      this.betaBursts = [];
      this.gammaBursts = [];
    this.nuBursts = [];
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
      this.resetChiSystems();
      this.projectiles = [];
      this.resetDamageNumbers();
      this.resetWaveTallies();
      this.alphaBursts = [];
      this.betaBursts = [];
      this.gammaBursts = [];
    this.nuBursts = [];
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
      this.resetChiSystems();
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
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetWaveTallies();
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
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
    this.nuBursts = [];
    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    this.towers = [];
    this.towerConnectionMap.clear();
    this.towerConnectionSources.clear();
    this.connectionEffects = [];
    this.clearConnectionDragState();
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
    this.scheduleStatsPanelRefresh();
    this.refreshStatsPanel({ force: true });
    refreshTowerLoadoutDisplay();
  }

  enableSlots() {
    return HudBindings.enableSlots.call(this);
  }

  disableSlots(clear = false) {
    return HudBindings.disableSlots.call(this, clear);
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
    return HudBindings.updateSpeedButton.call(this);
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
    return HudBindings.updateAutoAnchorButton.call(this);
  }

  autoAnchorTowers() {
    return HudBindings.autoAnchorTowers.call(this);
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
    this.enemies.forEach((enemy) => this.clearEnemySlowEffects(enemy));
    this.enemies = [];
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
    this.nuBursts = [];
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
      if (tower.type === 'alpha') {
        this.ensureAlphaState(tower);
      }
      if (tower.type === 'beta') {
        this.ensureBetaState(tower);
      }
      if (tower.type === 'gamma') {
        this.ensureGammaState(tower);
      }
      if (tower.type === 'kappa') {
        this.ensureKappaState(tower);
      }
      if (tower.type === 'iota') {
        this.ensureIotaState(tower);
      }
      if (tower.type === 'chi') {
        this.ensureChiState(tower);
      }
      if (tower.type === 'zeta') {
        // Keep ζ pendulum geometry aligned with the tower's new coordinates.
        this.ensureZetaState(tower);
      } else if (tower.type === 'xi') {
        // Initialize ξ chaining mechanics.
        this.ensureXiState(tower);
      } else if (tower.type === 'omicron') {
        // Initialize ο soldier unit mechanics.
        this.ensureOmicronState(tower);
      } else {
        const rangeFactor = definition ? definition.range : 0.24;
        if (tower.type !== 'iota' && tower.type !== 'kappa') {
          tower.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
        }
        if (tower.type === 'delta') {
          this.updateDeltaAnchors(tower);
        }
        if (tower.type === 'theta') {
          this.ensureThetaState(tower);
        }
      }
    });
    if (this.hoverPlacement) {
      this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
      const definition = getTowerDefinition(this.hoverPlacement.towerType);
      if (this.hoverPlacement.towerType === 'zeta') {
        // Simulate ζ’s metrics so the placement preview reflects pendulum reach.
        const baseRangeFactor = definition ? definition.range : 0.3;
        const baseRange = Math.min(this.renderWidth, this.renderHeight) * baseRangeFactor;
        const previewTower = {
          id: 'zeta-preview',
          type: 'zeta',
          definition: definition || null,
          normalized: { ...this.hoverPlacement.normalized },
          x: this.hoverPlacement.position.x,
          y: this.hoverPlacement.position.y,
          range: baseRange,
          baseRange,
          baseDamage: 0,
          baseRate: 0,
        };
        this.ensureZetaState(previewTower);
        this.hoverPlacement.range = Number.isFinite(previewTower.range)
          ? previewTower.range
          : baseRange;
      } else {
        const rangeFactor = definition ? definition.range : 0.24;
        this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      }
    }
  }

  handleCanvasPointerMove(event) {
    return InputController.handleCanvasPointerMove.call(this, event);
  }

  performPinchZoom() {
    return InputController.performPinchZoom.call(this);
  }

  handleCanvasPointerDown(event) {
    return InputController.handleCanvasPointerDown.call(this, event);
  }

  handleCanvasPointerUp(event) {
    return InputController.handleCanvasPointerUp.call(this, event);
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
    const formattedCost = formatCombatNumber(Math.max(0, actionCost));
    if (!validation.valid) {
      reason = validation.reason || 'Maintain clearance from the glyph lane.';
    } else if (!hasFunds) {
      const deficit = Math.max(0, actionCost - this.energy);
      const deficitLabel = formatCombatNumber(deficit);
      if (merging && nextDefinition) {
        reason = `Need ${deficitLabel} ${this.theroSymbol} to merge into ${nextDefinition.symbol}.`;
      } else if (definition) {
        reason = `Need ${deficitLabel} ${this.theroSymbol} to lattice ${definition.symbol}.`;
      } else {
        reason = `Need ${deficitLabel} ${this.theroSymbol} for this lattice.`;
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
    return InputController.handleCanvasPointerLeave.call(this);
  }

  // Attempt to gather any mote gems located near the pointer position.
  collectMoteGemsNear(position) {
    return InputController.collectMoteGemsNear.call(this, position);
  }

  handleCanvasClick(event) {
    return InputController.handleCanvasClick.call(this, event);
  }

  handleCanvasWheel(event) {
    return InputController.handleCanvasWheel.call(this, event);
  }

  applyZoomFactor(factor, anchor) {
    return InputController.applyZoomFactor.call(this, factor, anchor);
  }

  setZoom(targetScale, anchor) {
    return InputController.setZoom.call(this, targetScale, anchor);
  }

  clearPlacementPreview() {
    return InputController.clearPlacementPreview.call(this);
  }

  clearEnemyHover() {
    return InputController.clearEnemyHover.call(this);
  }

  getNormalizedFromEvent(event) {
    return InputController.getNormalizedFromEvent.call(this, event);
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

  getTowerHoldScribbleText(tower) {
    if (!tower) {
      return '';
    }
    const nextId = getNextTowerId(tower.type);
    if (!nextId) {
      return 'Peak tier · Swipe ↓ to demote';
    }
    const nextCost = this.getCurrentTowerCost(nextId);
    const costLabel = formatCombatNumber(Math.max(0, Number.isFinite(nextCost) ? nextCost : 0));
    return `Upgrade · ${this.theroSymbol}${costLabel} · Swipe ↓ to demote`;
  }

  spawnTowerUpgradeCostScribble(tower, text = '') {
    if (!tower || !this.container) {
      return null;
    }
    const scribbleText = text || this.getTowerHoldScribbleText(tower);
    if (!scribbleText) {
      return null;
    }
    if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return null;
    }
    const effect = document.createElement('div');
    effect.className = 'tower-upgrade-cost-scribble';
    effect.style.left = `${tower.x}px`;
    effect.style.top = `${tower.y}px`;

    const startColor = samplePaletteGradient(0.05) || DEFAULT_COST_SCRIBBLE_COLORS.start;
    const endColor = samplePaletteGradient(0.85) || DEFAULT_COST_SCRIBBLE_COLORS.end;
    const glowColor = samplePaletteGradient(0.5) || DEFAULT_COST_SCRIBBLE_COLORS.glow;
    effect.style.setProperty('--tower-scribble-start', colorToRgbaString(startColor, 1));
    effect.style.setProperty('--tower-scribble-end', colorToRgbaString(endColor, 1));
    effect.style.setProperty('--tower-scribble-shadow', colorToRgbaString(glowColor, 0.65));

    const textEl = document.createElement('span');
    textEl.className = 'tower-upgrade-cost-scribble__text';
    textEl.textContent = scribbleText;
    effect.append(textEl);

    const cleanup = () => {
      effect.removeEventListener('animationend', handleAnimationEnd);
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    };

    const handleAnimationEnd = (animationEvent) => {
      if (
        animationEvent.target === effect &&
        animationEvent.animationName === 'tower-upgrade-cost-scribble-dissipate'
      ) {
        cleanup();
      }
    };

    effect.addEventListener('animationend', handleAnimationEnd);
    this.container.append(effect);

    const timeoutId = setTimeout(() => cleanup(), 2000);
    return () => {
      clearTimeout(timeoutId);
      cleanup();
    };
  }

  beginTowerHoldGesture(tower, event) {
    if (!tower || !event || !this.towerHoldState) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    if (this.towerHoldState.pointerId && this.towerHoldState.pointerId !== event.pointerId) {
      this.cancelTowerHoldGesture();
    }
    this.cancelTowerHoldGesture();
    this.towerHoldState.pointerId = event.pointerId;
    this.towerHoldState.towerId = tower.id;
    this.towerHoldState.startClientX = event.clientX;
    this.towerHoldState.startClientY = event.clientY;
    this.towerHoldState.pointerType = event.pointerType || 'mouse';
    this.towerHoldState.holdActivated = false;
    this.towerHoldState.actionTriggered = null;
    this.towerHoldState.holdTimeoutId = setTimeout(
      () => this.activateTowerHoldGesture(),
      TOWER_HOLD_ACTIVATION_MS,
    );
  }

  activateTowerHoldGesture() {
    const state = this.towerHoldState;
    if (!state?.pointerId || !state.towerId) {
      return;
    }
    state.holdTimeoutId = null;
    const tower = this.getTowerById(state.towerId);
    if (!tower) {
      this.cancelTowerHoldGesture();
      return;
    }
    state.holdActivated = true;
    this.resetTowerTapState();
    this.suppressNextCanvasClick = true;
    state.scribbleCleanup = this.spawnTowerUpgradeCostScribble(tower);
    if (this.connectionDragState.pointerId === state.pointerId) {
      this.clearConnectionDragState();
    }
    if (this.deltaCommandDragState.pointerId === state.pointerId) {
      this.clearDeltaCommandDragState();
    }
  }

  updateTowerHoldGesture(event) {
    const state = this.towerHoldState;
    if (!state?.pointerId || state.pointerId !== event.pointerId) {
      return;
    }
    if (!Number.isFinite(state.startClientX) || !Number.isFinite(state.startClientY)) {
      return;
    }
    const dx = event.clientX - state.startClientX;
    const dy = event.clientY - state.startClientY;
    const distance = Math.hypot(dx, dy);
    if (!state.holdActivated) {
      if (distance >= TOWER_HOLD_CANCEL_DISTANCE_PX) {
        this.cancelTowerHoldGesture({ pointerId: event.pointerId });
      }
      return;
    }
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (state.actionTriggered) {
      return;
    }
    if (dy <= -TOWER_HOLD_SWIPE_THRESHOLD_PX) {
      const upgraded = this.commitTowerHoldUpgrade();
      if (upgraded) {
        state.actionTriggered = 'upgrade';
        this.cancelTowerHoldGesture();
      }
      return;
    }
    if (dy >= TOWER_HOLD_SWIPE_THRESHOLD_PX) {
      const demoted = this.commitTowerHoldDemotion();
      if (demoted) {
        state.actionTriggered = 'demote';
        this.cancelTowerHoldGesture();
      }
    }
  }

  cancelTowerHoldGesture({ pointerId = null } = {}) {
    if (!this.towerHoldState) {
      return;
    }
    const state = this.towerHoldState;
    if (pointerId && state.pointerId && pointerId !== state.pointerId) {
      return;
    }
    if (state.holdTimeoutId) {
      clearTimeout(state.holdTimeoutId);
    }
    if (typeof state.scribbleCleanup === 'function') {
      state.scribbleCleanup();
    }
    state.pointerId = null;
    state.towerId = null;
    state.startClientX = 0;
    state.startClientY = 0;
    state.holdTimeoutId = null;
    state.holdActivated = false;
    state.scribbleCleanup = null;
    state.actionTriggered = null;
    state.pointerType = null;
  }

  /**
   * Returns a monotonic timestamp so press glow easing stays frame-rate independent.
   */
  getCurrentTimestamp() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /**
   * Track pointer presses on a tower so the renderer can animate a palette-matched glow.
   */
  handleTowerPointerPress(tower, event) {
    if (!tower?.id || !event || !this.towerPressHighlights || !this.towerPressPointerMap) {
      return;
    }
    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
    const now = this.getCurrentTimestamp();
    let entry = this.towerPressHighlights.get(tower.id);
    if (!entry) {
      entry = {
        intensity: 0,
        target: 0,
        lastTimestamp: now,
        pointerIds: new Set(),
      };
      this.towerPressHighlights.set(tower.id, entry);
    }
    entry.target = 1;
    entry.lastTimestamp = now;
    if (!entry.pointerIds) {
      entry.pointerIds = new Set();
    }
    if (pointerId !== null) {
      entry.pointerIds.add(pointerId);
      this.towerPressPointerMap.set(pointerId, tower.id);
    }
    if (!this.shouldAnimate) {
      this.draw();
    }
  }

  /**
   * Release a tower press glow either for a specific pointer or every active pointer.
   */
  handleTowerPointerRelease(pointerId = null) {
    if (!this.towerPressHighlights || !this.towerPressPointerMap) {
      return;
    }
    const now = this.getCurrentTimestamp();
    const finalizeEntry = (towerId, activePointerId = null) => {
      const entry = this.towerPressHighlights.get(towerId);
      if (!entry) {
        return;
      }
      if (entry.pointerIds && activePointerId !== null) {
        entry.pointerIds.delete(activePointerId);
      } else if (entry.pointerIds && activePointerId === null) {
        entry.pointerIds.clear();
      }
      entry.lastTimestamp = now;
      if (!entry.pointerIds || entry.pointerIds.size === 0) {
        entry.target = 0;
      }
    };

    if (typeof pointerId !== 'number') {
      this.towerPressPointerMap.forEach((towerId, activePointerId) => {
        finalizeEntry(towerId, activePointerId);
      });
      this.towerPressPointerMap.clear();
      if (!this.shouldAnimate) {
        this.draw();
      }
      return;
    }

    const towerId = this.towerPressPointerMap.get(pointerId);
    if (!towerId) {
      return;
    }
    this.towerPressPointerMap.delete(pointerId);
    finalizeEntry(towerId, pointerId);
    if (!this.shouldAnimate) {
      this.draw();
    }
  }

  /**
   * Resolve the current glow intensity for a tower press entry using eased transitions.
   */
  getTowerPressGlowIntensity(towerId) {
    if (!towerId || !this.towerPressHighlights) {
      return 0;
    }
    const entry = this.towerPressHighlights.get(towerId);
    if (!entry) {
      return 0;
    }
    const now = this.getCurrentTimestamp();
    const last = Number.isFinite(entry.lastTimestamp) ? entry.lastTimestamp : now;
    const elapsed = Math.max(0, now - last);
    entry.lastTimestamp = now;
    const duration = Math.max(16, TOWER_PRESS_GLOW_FADE_MS);
    const delta = duration > 0 ? elapsed / duration : 1;
    if (!Number.isFinite(entry.intensity)) {
      entry.intensity = 0;
    }
    const target = entry.target ?? 0;
    if (target > entry.intensity) {
      entry.intensity = Math.min(target, entry.intensity + delta);
    } else if (target < entry.intensity) {
      entry.intensity = Math.max(target, entry.intensity - delta);
    }
    const intensity = Math.max(0, Math.min(1, entry.intensity));
    if (intensity <= 0 && (!entry.pointerIds || entry.pointerIds.size === 0) && target <= 0) {
      this.towerPressHighlights.delete(towerId);
    } else {
      entry.intensity = intensity;
    }
    return intensity;
  }

  commitTowerHoldUpgrade() {
    if (!this.towerHoldState?.towerId) {
      return false;
    }
    const tower = this.getTowerById(this.towerHoldState.towerId);
    if (!tower) {
      return false;
    }
    const upgraded = this.upgradeTowerTier(tower);
    if (upgraded) {
      this.suppressNextCanvasClick = true;
      this.resetTowerTapState();
    }
    return upgraded;
  }

  commitTowerHoldDemotion() {
    if (!this.towerHoldState?.towerId) {
      return false;
    }
    const tower = this.getTowerById(this.towerHoldState.towerId);
    if (!tower) {
      return false;
    }
    const demoted = this.demoteTowerTier(tower);
    if (demoted) {
      this.suppressNextCanvasClick = true;
      this.resetTowerTapState();
    }
    return demoted;
  }

  /**
   * Clear any pending tower tap tracking so the next tap starts a fresh sequence.
   */
  resetTowerTapState() {
    if (!this.towerTapState) {
      this.towerTapState = {
        lastTowerId: null,
        lastTapTime: 0,
        lastTapPosition: null,
      };
      return;
    }
    this.towerTapState.lastTowerId = null;
    this.towerTapState.lastTapTime = 0;
    this.towerTapState.lastTapPosition = null;
  }

  /**
   * Register a tap on a tower and return true when it qualifies as a double tap.
   */
  registerTowerTap(tower, position, event = null) {
    if (!tower?.id || !position) {
      this.resetTowerTapState();
      return false;
    }
    const x = Number.isFinite(position.x) ? position.x : null;
    const y = Number.isFinite(position.y) ? position.y : null;
    if (x === null || y === null) {
      this.resetTowerTapState();
      return false;
    }
    if (!this.towerTapState) {
      this.resetTowerTapState();
    }
    const state = this.towerTapState;
    const now =
      Number.isFinite(event?.timeStamp)
        ? event.timeStamp
        : typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const previousTime = Number.isFinite(state.lastTapTime) ? state.lastTapTime : 0;
    const elapsed = now - previousTime;
    const isSameTower = state.lastTowerId === tower.id;
    const withinTime = isSameTower && elapsed >= 0 && elapsed <= TOWER_MENU_DOUBLE_TAP_INTERVAL_MS;
    let withinDistance = false;
    if (isSameTower && state.lastTapPosition) {
      const dx = x - state.lastTapPosition.x;
      const dy = y - state.lastTapPosition.y;
      const distance = Math.hypot(dx, dy);
      withinDistance = Number.isFinite(distance) && distance <= TOWER_MENU_DOUBLE_TAP_DISTANCE_PX;
    }
    if (withinTime && withinDistance) {
      this.resetTowerTapState();
      return true;
    }
    state.lastTowerId = tower.id;
    state.lastTapTime = now;
    state.lastTapPosition = { x, y };
    return false;
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
    const nextId = getNextTowerId(tower.type);
    const nextDefinition = nextId ? getTowerDefinition(nextId) : null;
    const upgradeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
    const upgradeAffordable = nextDefinition ? this.energy >= upgradeCost : false;
    const upgradeCostLabel = nextDefinition
      ? `${formatCombatNumber(Math.max(0, upgradeCost))} ${this.theroSymbol}`
      : '—';
    // Surface an upgrade command that mirrors the merge flow and displays the next tier cost inside the radial lattice.
    options.push({
      id: 'upgrade',
      type: 'upgrade',
      icon: nextDefinition?.symbol || '·',
      label: nextDefinition ? `Upgrade to ${nextDefinition.symbol}` : 'Upgrade unavailable',
      costLabel: upgradeCostLabel,
      disabled: !nextDefinition || !upgradeAffordable,
      upgradeCost,
      nextTowerId: nextDefinition?.id || null,
    });
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
    if (option.type === 'upgrade') {
      // Route upgrade taps through the merge routine so single-tower ascensions mirror drag-and-drop merges.
      this.upgradeTowerTier(tower, {
        silent: Boolean(option.silent),
        expectedNextId: option.nextTowerId || null,
        quotedCost: Number.isFinite(option.upgradeCost) ? option.upgradeCost : null,
      });
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
            connections: candidate?.linkTargetId ? [candidate.linkTargetId] : [],
            sources: candidate?.linkSources instanceof Set ? Array.from(candidate.linkSources) : [],
            nuKills: candidate?.nuState?.kills,
            nuOverkillTotal: candidate?.nuState?.overkillDamageTotal,
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
            connections: tower.linkTargetId ? [tower.linkTargetId] : [],
            sources: tower.linkSources instanceof Set ? Array.from(tower.linkSources) : [],
            nuKills: tower?.nuState?.kills,
            nuOverkillTotal: tower?.nuState?.overkillDamageTotal,
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
  /**
   * Evaluate ζ’s upgrade-driven math by temporarily mirroring the Towers tab
   * dynamic-context logic. This keeps battlefield stats in sync with the
   * upgrade overlay without duplicating the underlying formulas.
   */
  evaluateZetaMetrics(tower) {
    return TowerManager.evaluateZetaMetrics.call(this, tower);
  }

  /**
   * Clear cached α particle data when the tower departs or retunes.
   */
  teardownAlphaTower(tower) {
    return TowerManager.teardownAlphaTower.call(this, tower);
  }

  /**
   * Ensure α towers keep their particle calibration in sync with canvas scale.
   */
  ensureAlphaState(tower) {
    return TowerManager.ensureAlphaState.call(this, tower);
  }

  /**
   * Emit α particle swarms whenever the lattice releases an attack.
   */
  spawnAlphaAttackBurst(tower, targetInfo, options = {}) {
    return TowerManager.spawnAlphaAttackBurst.call(this, tower, targetInfo, options);
  }

  /**
   * Clear cached β particle data when the lattice retunes or is removed.
   */
  teardownBetaTower(tower) {
    return TowerManager.teardownBetaTower.call(this, tower);
  }

  /**
   * Keep β tower particle scaling aligned with the active canvas resolution.
   */
  ensureBetaState(tower) {
    return TowerManager.ensureBetaState.call(this, tower);
  }

  /**
   * Emit β particle bursts using the shared lattice particle system.
   */
  spawnBetaAttackBurst(tower, targetInfo, options = {}) {
    return TowerManager.spawnBetaAttackBurst.call(this, tower, targetInfo, options);
  }

  /**
   * Clear cached γ particle data when the lattice retunes or leaves the field.
   */
  teardownGammaTower(tower) {
    return TowerManager.teardownGammaTower.call(this, tower);
  }

  /**
   * Maintain γ particle scaling so laser visuals stay anchored to the field.
   */
  ensureGammaState(tower) {
    return TowerManager.ensureGammaState.call(this, tower);
  }

  /**
   * Emit γ piercing laser bursts that reuse the shared particle animation stack.
   */
  spawnGammaAttackBurst(tower, targetInfo, options = {}) {
    return TowerManager.spawnGammaAttackBurst.call(this, tower, targetInfo, options);
  }

  spawnNuAttackBurst(tower, targetInfo, options = {}) {
    return TowerManager.spawnNuAttackBurst.call(this, tower, targetInfo, options);
  }

  /**
   * Clear cached κ tripwire data when the lattice retunes or leaves the field.
   */
  teardownKappaTower(tower) {
    return TowerManager.teardownKappaTower.call(this, tower);
  }

  /**
   * Ensure κ tripwire state stays synchronized with the battlefield layout.
   */
  ensureKappaState(tower) {
    return TowerManager.ensureKappaState.call(this, tower);
  }

  /**
   * Clear cached θ field data when the lattice retunes or is dismantled.
   */
  teardownThetaTower(tower) {
    return TowerManager.teardownThetaTower.call(this, tower);
  }

  /**
   * Maintain θ slow field state so range and potency stay synchronized.
   */
  ensureThetaState(tower) {
    return TowerManager.ensureThetaState.call(this, tower);
  }

  /**
   * Clear cached λ beam data when the lattice retunes or is dismantled.
   */
  teardownLambdaTower(tower) {
    return TowerManager.teardownLambdaTower.call(this, tower);
  }

  /**
   * Ensure λ laser state stays synchronized with upgrades and canvas scale.
   */
  ensureLambdaState(tower) {
    return TowerManager.ensureLambdaState.call(this, tower);
  }

  /**
   * Update θ slow field efficacy and apply slow stacks to nearby enemies.
   */
  updateThetaTower(tower, delta) {
    updateThetaTowerHelper(this, tower, delta);
  }

  /**
   * Evolve κ tripwire charge, manage collisions, and refresh linked targets.
   */
  updateKappaTower(tower, delta) {
    updateKappaTowerHelper(this, tower, delta);
  }

  /**
   * Fire λ piercing lasers, scale damage with enemy density, and animate dissipation.
   */
  updateLambdaTower(tower, delta) {
    updateLambdaTowerHelper(this, tower, delta);
  }

  /**
   * Place and charge μ fractal mines on the track, scaling damage with tier.
   */
  updateMuTower(tower, delta) {
    updateMuTowerHelper(this, tower, delta);
  }

  /**
   * Clear cached μ mine data when the tower is removed or reset.
   */
  teardownMuTower(tower) {
    return TowerManager.teardownMuTower.call(this, tower);
  }

  /**
   * Update ν tower kill tracking and particle effects.
   */
  updateNuTower(tower, delta) {
    updateNuTowerHelper(this, tower, delta);
  }

  /**
   * Clear cached ν tower data when the tower is removed or reset.
   */
  teardownNuTower(tower) {
    teardownNuTowerHelper(this, tower);
  }

  /**
   * Update ξ tower chaining ball mechanics and animations.
   */
  updateXiTower(tower, delta) {
    updateXiTowerHelper(this, tower, delta);
  }

  /**
   * Ensure ξ tower state is initialized and parameters are refreshed.
   */
  ensureXiState(tower) {
    return ensureXiStateHelper(this, tower);
  }

  /**
   * Update ο tower soldier unit mechanics and animations.
   */
  updateOmicronTower(tower, delta) {
    updateOmicronTowerHelper(this, tower, delta);
  }

  /**
   * Ensure ο tower state is initialized and parameters are refreshed.
   */
  ensureOmicronState(tower) {
    return ensureOmicronStateHelper(this, tower);
  }

  /**
   * Update π tower laser merge mechanics and animations.
   */
  updatePiTower(tower, delta) {
    updatePiTowerHelper(this, tower, delta);
  }

  /**
   * Ensure π tower state is initialized and parameters are refreshed.
   */
  ensurePiState(tower) {
    return ensurePiStateHelper(this, tower);
  }

  /**
   * Fire ξ tower chain attack at target enemy.
   */
  fireXiChain(tower, targetInfo) {
    return fireXiChainHelper(this, tower, targetInfo);
  }

  /**
   * Clear cached ξ tower data when the tower is removed or reset.
   */
  teardownXiTower(tower) {
    teardownXiTowerHelper(this, tower);
  }

  /**
   * Clear cached ο tower data when the tower is removed or reset.
   */
  teardownOmicronTower(tower) {
    teardownOmicronTowerHelper(this, tower);
  }

  /**
   * Clear cached π tower data when the tower is removed or reset.
   */
  teardownPiTower(tower) {
    teardownPiTowerHelper(this, tower);
  }

  /**
   * Convert stored σ damage into a discharge when conditions are met.
   */
  updateSigmaTower(tower, delta) {
    updateSigmaTowerHelper(this, tower, delta);
  }

  /**
   * Ensure σ state exists so allied fire has a reservoir.
   */
  ensureSigmaState(tower) {
    return TowerManager.ensureSigmaState.call(this, tower);
  }

  /**
   * Clear σ-specific caches when the tower is sold or retuned.
   */
  teardownSigmaTower(tower) {
    return TowerManager.teardownSigmaTower.call(this, tower);
  }

  /**
   * Ensure χ state remains initialized so thrall conversions stay responsive.
   */
  ensureChiState(tower) {
    return ensureChiStateHelper(this, tower);
  }

  /**
   * Clear χ caches and associated thralls when the tower departs the lattice.
   */
  teardownChiTower(tower) {
    teardownChiTowerHelper(this, tower);
  }

  /**
   * Attempt to convert a fallen enemy into a Chi thrall.
   */
  tryConvertEnemyToChiThrall(enemy, options = {}) {
    return tryConvertEnemyToChiThrallHelper(this, enemy, options);
  }

  /**
   * Maintain χ aura pulses and conversion state.
   */
  updateChiTower(tower, delta) {
    updateChiTowerHelper(this, tower, delta);
  }

  /**
   * Advance live Chi thralls along the track.
   */
  updateChiThralls(delta) {
    updateChiThrallsHelper(this, delta);
  }

  /**
   * Animate Chi light trails traveling between anchors.
   */
  updateChiLightTrails(delta) {
    updateChiLightTrailsHelper(this, delta);
  }

  /**
   * Feed allied damage into σ's accumulator.
   */
  absorbSigmaDamage(tower, damage, options = {}) {
    return absorbSigmaDamageHelper(this, tower, damage, options);
  }

  /**
   * Ensure μ mine state stays synchronized with upgrades and canvas scale.
   */
  ensureMuState(tower) {
    return TowerManager.ensureMuState.call(this, tower);
  }

  /**
   * Clear cached ζ pendulum data when the tower is removed or retuned.
   */
  teardownZetaTower(tower) {
    return TowerManager.teardownZetaTower.call(this, tower);
  }

  /**
   * Ensure ζ towers maintain their double-pendulum state and derived stats.
   */
  ensureZetaState(tower) {
    return TowerManager.ensureZetaState.call(this, tower);
  }

  /**
   * Clear cached η orbital data when the tower is removed or retuned.
   */
  teardownEtaTower(tower) {
    return TowerManager.teardownEtaTower.call(this, tower);
  }

  /**
   * Ensure η towers maintain their orbital ring state and derived stats.
   */
  ensureEtaState(tower, options = {}) {
    return TowerManager.ensureEtaState.call(this, tower, options);
  }

  /**
   * Merge η towers to unfold rings and handle prestige transitions.
   */
  mergeEtaTower(tower, { silent = false } = {}) {
    return TowerManager.mergeEtaTower.call(this, tower, { silent });
  }

  applyTowerBehaviorDefaults(tower) {
    return TowerManager.applyTowerBehaviorDefaults.call(this, tower);
  }

  /**
   * Create or update the Delta state container so soldiers can be simulated.
   */
  ensureDeltaState(tower) {
    return TowerManager.ensureDeltaState.call(this, tower);
  }

  /**
   * Update Delta soldier stance and anchor points when the player changes modes.
   */
  configureDeltaBehavior(tower, mode) {
    return TowerManager.configureDeltaBehavior.call(this, tower, mode);
  }

  /**
   * Remove any lingering Delta data once a tower is dismantled or upgraded away.
   */
  teardownDeltaTower(tower) {
    return TowerManager.teardownDeltaTower.call(this, tower);
  }

  /**
   * Keep the cached track-hold anchor aligned with the latest path layout.
   */
  updateDeltaAnchors(tower) {
    return TowerManager.updateDeltaAnchors.call(this, tower);
  }

  /**
   * Clear any manual Delta target.
   */
  clearTowerManualTarget(tower) {
    return TowerManager.clearTowerManualTarget.call(this, tower);
  }

  /**
   * Retrieve the live enemy chosen for manual Delta focus.
   */
  getTowerManualTarget(tower) {
    return TowerManager.getTowerManualTarget.call(this, tower);
  }

  assignDeltaTrackHoldAnchor(tower, anchor) {
    return TowerManager.assignDeltaTrackHoldAnchor.call(this, tower, anchor);
  }

  /**
   * Ensure ι towers keep their splash metrics synchronized with active links.
   */
  ensureIotaState(tower) {
    return TowerManager.ensureIotaState.call(this, tower);
  }

  /**
   * Clear cached ι state when dismantled or retuned.
   */
  teardownIotaTower(tower) {
    TowerManager.teardownIotaTower.call(this, tower);
  }

  /**
   * Trigger Iota's area pulse using precomputed splash state.
   */
  fireIotaPulse(tower, targetInfo = {}) {
    TowerManager.fireIotaPulse.call(this, tower, targetInfo);
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

  /**
   * Programmatically focus the requested enemy so stats panel selections highlight the target.
   */
  focusEnemyById(enemyId) {
    if (!Number.isFinite(enemyId)) {
      return false;
    }
    const enemy = this.enemies.find((candidate) => candidate?.id === enemyId);
    if (!enemy) {
      this.clearFocusedEnemy({ silent: true });
      return false;
    }
    this.setFocusedEnemy(enemy, { silent: true });
    return true;
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
      const hpText = formatCombatNumber(remainingHp);
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
    let mergeCost = 0;

    if (existingTower && existingTower.type === selectedType) {
      if (selectedType === 'eta') {
        if (existingTower.isPrestigeEta) {
          if (this.messageEl && !silent) {
            this.messageEl.textContent = 'Η lattice already crowned—no further fusion possible.';
          }
          if (this.audio && !silent) {
            this.audio.playSfx('error');
          }
          return false;
        }
        mergeTarget = existingTower;
        merging = true;
        placement.position = { x: mergeTarget.x, y: mergeTarget.y };
        mergeCost = this.getCurrentTowerCost(selectedType);
      } else {
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
        mergeCost = this.getCurrentTowerCost(nextDefinition.id);
      }
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
    if (!merging && nextDefinition) {
      mergeCost = this.getCurrentTowerCost(nextDefinition.id);
    }
    const actionCost = merging ? mergeCost : baseCost;

    if (this.energy < actionCost) {
      const needed = Math.max(0, actionCost - this.energy);
      const neededLabel = formatCombatNumber(needed);
      if (this.messageEl && !silent) {
        if (merging && nextDefinition) {
          this.messageEl.textContent = `Need ${neededLabel} ${this.theroSymbol} more to merge into ${nextDefinition.symbol}.`;
        } else {
          this.messageEl.textContent = `Need ${neededLabel} ${this.theroSymbol} more to lattice ${definition.symbol}.`;
        }
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    this.energy = Math.max(0, this.energy - actionCost);

    if (merging && mergeTarget && selectedType === 'eta') {
      const merged = this.mergeEtaTower(mergeTarget, { silent });
      if (merged) {
        // Clear the placement preview so η fusions do not leave a ghost icon tethered to the pointer.
        this.clearPlacementPreview();
        notifyTowerPlaced(this.towers.length);
        return true;
      }
      const cap = this.levelConfig?.theroCap ?? this.levelConfig?.energyCap ?? Infinity;
      this.energy = Math.min(cap, this.energy + actionCost);
      return false;
    }

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
      if (this.combatStats?.active) {
        this.ensureTowerStatsEntry(mergeTarget);
        this.scheduleStatsPanelRefresh();
      }
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
      this.recordTowerCost(mergeTarget, mergeCost);
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
      // Clear the placement preview so successful tier merges do not keep the placement reticle active.
      this.clearPlacementPreview();
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
      // Track η merge progress so the lattice can unfold additional rings.
      etaPrime: 0,
      // Flag prestige status when η ascends into Η.
      isPrestigeEta: false,
      linkTargetId: null,
      linkSources: new Set(),
      storedAlphaShots: 0,
      storedBetaShots: 0,
      storedAlphaSwirl: 0,
      storedBetaSwirl: 0,
      storedGammaShots: 0,
      connectionParticles: [],
      costHistory: [],
      costHistoryInitialized: true,
    };

    this.applyTowerBehaviorDefaults(tower);
    this.towers.push(tower);
    this.recordTowerCost(tower, actionCost);
    this.handleAlephTowerAdded(tower);
    notifyTowerPlaced(this.towers.length);
    if (this.combatStats?.active) {
      this.ensureTowerStatsEntry(tower);
      this.scheduleStatsPanelRefresh();
    }

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

  /**
   * Promote a lattice to its next tier while mirroring the merge flow’s cost and unlock handling.
   */
  upgradeTowerTier(tower, { silent = false, expectedNextId = null, quotedCost = null } = {}) {
    if (!tower) {
      return false;
    }

    const nextId = expectedNextId || getNextTowerId(tower.type);
    const nextDefinition = nextId ? getTowerDefinition(nextId) : null;
    if (!nextDefinition) {
      if (this.messageEl && !silent) {
        this.messageEl.textContent = 'Peak lattice tier reached—further upgrades unavailable.';
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const cost = Number.isFinite(quotedCost) ? quotedCost : this.getCurrentTowerCost(nextDefinition.id);
    if (this.energy < cost) {
      if (this.messageEl && !silent) {
        const deficit = Math.max(0, cost - this.energy);
        const deficitLabel = formatCombatNumber(deficit);
        this.messageEl.textContent = `Need ${deficitLabel} ${this.theroSymbol} more to merge into ${nextDefinition.symbol}.`;
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    this.energy = Math.max(0, this.energy - cost);
    this.recordTowerCost(tower, cost);

    const previousSymbol = tower.symbol || tower.definition?.symbol || 'Tower';
    const wasAlephNull = tower.type === 'aleph-null';
    if (wasAlephNull) {
      this.handleAlephTowerRemoved(tower);
    }

    const range = Math.min(this.renderWidth, this.renderHeight) * nextDefinition.range;
    const baseDamage = Number.isFinite(nextDefinition.damage) ? nextDefinition.damage : 0;
    const baseRate = Number.isFinite(nextDefinition.rate) ? nextDefinition.rate : 1;

    tower.type = nextDefinition.id;
    tower.definition = nextDefinition;
    tower.symbol = nextDefinition.symbol;
    tower.tier = nextDefinition.tier;
    tower.damage = baseDamage;
    tower.rate = baseRate;
    tower.range = range;
    tower.baseDamage = baseDamage;
    tower.baseRate = baseRate;
    tower.baseRange = range;
    tower.cooldown = 0;
    tower.chain = null;

    this.applyTowerBehaviorDefaults(tower);

    const nextIsAlephNull = nextDefinition.id === 'aleph-null';
    if (nextIsAlephNull) {
      this.handleAlephTowerAdded(tower);
    } else if (wasAlephNull) {
      this.syncAlephChainStats();
    }

    this.spawnTowerEquationScribble(tower, { towerType: nextDefinition.id, silent });
    const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
      ? unlockTower(nextDefinition.id, { silent: true })
      : false;

    if (this.messageEl && !silent) {
      const costLabel = formatCombatNumber(Math.max(0, cost));
      const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
      this.messageEl.textContent = `${previousSymbol} lattice ascended into ${nextDefinition.symbol} for ${costLabel} ${this.theroSymbol}.${unlockNote}`;
    }

    notifyTowerPlaced(this.towers.length);
    this.updateHud();
    this.draw();
    refreshTowerLoadoutDisplay();
    this.dependencies.updateStatusDisplays();
    if (this.audio && !silent) {
      this.audio.playSfx('towerMerge');
    }

    this.openTowerMenu(tower, { silent: true });
    return true;
  }

  demoteTowerTier(tower, { silent = false } = {}) {
    if (!tower) {
      return false;
    }

    const previousId = getPreviousTowerId(tower.type);
    if (!previousId) {
      if (this.messageEl && !silent) {
        this.messageEl.textContent = 'Base lattice tier cannot be demoted further.';
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const previousDefinition = getTowerDefinition(previousId);
    if (!previousDefinition) {
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const history = this.ensureTowerCostHistory(tower);
    const removedCost = history.length ? history.pop() : null;
    const currentCost = Number.isFinite(removedCost) ? removedCost : this.getCurrentTowerCost(tower.type);
    const charge = this.getCurrentTowerCost(previousDefinition.id);
    const cap = this.levelConfig?.theroCap ?? this.levelConfig?.energyCap ?? Infinity;
    const refundAmount = Math.max(0, Number.isFinite(currentCost) ? currentCost : 0);
    const cappedEnergy = Math.min(cap, this.energy + refundAmount);

    if (cappedEnergy < charge) {
      if (removedCost !== null && removedCost !== undefined) {
        history.push(removedCost);
      }
      if (this.messageEl && !silent) {
        const deficit = Math.max(0, charge - cappedEnergy);
        const deficitLabel = formatCombatNumber(deficit);
        this.messageEl.textContent = `Need ${deficitLabel} ${this.theroSymbol} more to stabilize a demotion.`;
      }
      if (this.audio && !silent) {
        this.audio.playSfx('error');
      }
      return false;
    }

    const chargeAmount = Math.max(0, Number.isFinite(charge) ? charge : 0);
    this.energy = Math.max(0, cappedEnergy - chargeAmount);
    if (history.length) {
      history[history.length - 1] = chargeAmount;
    } else if (chargeAmount > 0) {
      history.push(chargeAmount);
    }
    tower.costHistoryInitialized = true;

    const previousSymbol = tower.symbol || tower.definition?.symbol || 'Tower';
    const wasAlephNull = tower.type === 'aleph-null';
    if (wasAlephNull) {
      this.handleAlephTowerRemoved(tower);
    }

    const range = Math.min(this.renderWidth, this.renderHeight) * previousDefinition.range;
    const baseDamage = Number.isFinite(previousDefinition.damage) ? previousDefinition.damage : 0;
    const baseRate = Number.isFinite(previousDefinition.rate) ? previousDefinition.rate : 1;

    tower.type = previousDefinition.id;
    tower.definition = previousDefinition;
    tower.symbol = previousDefinition.symbol;
    tower.tier = previousDefinition.tier;
    tower.damage = baseDamage;
    tower.rate = baseRate;
    tower.range = range;
    tower.baseDamage = baseDamage;
    tower.baseRate = baseRate;
    tower.baseRange = range;
    tower.cooldown = 0;
    tower.chain = null;

    this.applyTowerBehaviorDefaults(tower);

    const nextIsAlephNull = previousDefinition.id === 'aleph-null';
    if (nextIsAlephNull) {
      this.handleAlephTowerAdded(tower);
    } else if (wasAlephNull) {
      this.syncAlephChainStats();
    }

    this.spawnTowerEquationScribble(tower, { towerType: previousDefinition.id, silent });

    if (this.messageEl && !silent) {
      const refundLabel = formatCombatNumber(refundAmount);
      const chargeLabel = formatCombatNumber(chargeAmount);
      this.messageEl.textContent = `${previousSymbol} lattice relaxed into ${previousDefinition.symbol}—refunded ${refundLabel} ${this.theroSymbol} and spent ${chargeLabel} ${this.theroSymbol}.`;
    }

    notifyTowerPlaced(this.towers.length);
    this.updateHud();
    this.draw();
    refreshTowerLoadoutDisplay();
    this.dependencies.updateStatusDisplays();
    if (this.combatStats?.active) {
      this.scheduleStatsPanelRefresh();
    }
    if (this.audio && !silent) {
      this.audio.playSfx('towerSell');
    }

    this.openTowerMenu(tower, { silent: true });
    return true;
  }

  sellTower(tower, { slot } = {}) {
    if (!tower) {
      return;
    }

    if (this.towerHoldState?.towerId === tower.id) {
      this.cancelTowerHoldGesture();
    }

    this.removeAllConnectionsForTower(tower);

    if (this.activeTowerMenu?.towerId === tower.id) {
      this.closeTowerMenu();
    }

    this.teardownAlphaTower(tower);
    this.teardownBetaTower(tower);
    this.teardownGammaTower(tower);
    this.teardownKappaTower(tower);
    this.teardownLambdaTower(tower);
    this.teardownMuTower(tower);
    this.teardownNuTower(tower);
    this.teardownIotaTower(tower);
    this.teardownDeltaTower(tower);
    this.teardownZetaTower(tower);
    this.teardownEtaTower(tower);
    this.teardownXiTower(tower);
    this.teardownOmicronTower(tower);
    this.teardownPiTower(tower);
    this.teardownSigmaTower(tower);
    this.handleAlephTowerRemoved(tower);

    const index = this.towers.indexOf(tower);
    if (index >= 0) {
      this.towers.splice(index, 1);
    }
    if (this.combatStats?.towerInstances instanceof Map) {
      // Flag the stats entry as retired immediately so the panel reflects the change before the next tick.
      const entry = this.combatStats.towerInstances.get(tower.id);
      if (entry) {
        entry.isActive = false;
        entry.retiredAt = Number.isFinite(this.combatStats.elapsed)
          ? Math.max(0, this.combatStats.elapsed)
          : 0;
      }
    }
    if (this.combatStats?.active) {
      this.scheduleStatsPanelRefresh();
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
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      const refund = Math.max(0, this.calculateTowerSellRefund(tower));
      this.energy = Math.min(cap, this.energy + refund);
      if (this.messageEl) {
        const refundLabel = formatCombatNumber(refund);
        this.messageEl.textContent = `Lattice dissolved—refunded ${refundLabel} ${this.theroSymbol}.`;
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

  /**
   * Retrieve a lattice reference by identifier.
   */
  getTowerById(towerId) {
    if (!towerId) {
      return null;
    }
    return this.towers.find((candidate) => candidate?.id === towerId) || null;
  }

  /**
   * Reset the active connection drag state back to an idle configuration.
   */
  clearConnectionDragState() {
    this.connectionDragState = {
      pointerId: null,
      originTowerId: null,
      startPosition: null,
      currentPosition: null,
      active: false,
      hasMoved: false,
      highlightEntries: [],
      hoverEntry: null,
    };
  }

  clearDeltaCommandDragState() {
    this.deltaCommandDragState = {
      pointerId: null,
      towerId: null,
      startPosition: null,
      currentPosition: null,
      startNormalized: null,
      currentNormalized: null,
      active: false,
      hasMoved: false,
      trackAnchor: null,
      trackDistance: Infinity,
      anchorAvailable: false,
    };
  }

  /**
   * Evaluate whether two towers can share a connection based on tier rules and range.
   */
  areTowersConnectionCompatible(source, target) {
    if (!source || !target || source.id === target.id) {
      return false;
    }
    const pairingKey = `${source.type}->${target.type}`;
    const allowedPairings = ['alpha->beta', 'beta->gamma', 'alpha->iota', 'beta->iota', 'gamma->iota'];
    if (!allowedPairings.includes(pairingKey)) {
      return false;
    }
    const sourceRange = Number.isFinite(source.range) ? Math.max(0, source.range) : 0;
    const targetRange = Number.isFinite(target.range) ? Math.max(0, target.range) : 0;
    if (!sourceRange || !targetRange) {
      return false;
    }
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance)) {
      return false;
    }
    return distance <= sourceRange && distance <= targetRange;
  }

  /**
   * Remove every connection touching the provided lattice.
   */
  removeAllConnectionsForTower(tower) {
    if (!tower) {
      return;
    }
    if (tower.linkTargetId) {
      this.removeTowerConnection(tower.id, tower.linkTargetId);
    }
    const incoming = this.towerConnectionSources.get(tower.id);
    if (incoming && incoming.size) {
      Array.from(incoming).forEach((sourceId) => {
        this.removeTowerConnection(sourceId, tower.id);
      });
    }
    tower.linkSources?.clear?.();
  }

  /**
   * Register a directed resource link between two lattices.
   */
  addTowerConnection(source, target) {
    const resolvedSource = typeof source === 'string' ? this.getTowerById(source) : source;
    const resolvedTarget = typeof target === 'string' ? this.getTowerById(target) : target;
    if (!this.areTowersConnectionCompatible(resolvedSource, resolvedTarget)) {
      return false;
    }
    if (resolvedSource.linkTargetId === resolvedTarget.id) {
      return true;
    }
    if (resolvedSource.linkTargetId && resolvedSource.linkTargetId !== resolvedTarget.id) {
      this.removeTowerConnection(resolvedSource.id, resolvedSource.linkTargetId);
    }
    this.towerConnectionMap.set(resolvedSource.id, resolvedTarget.id);
    resolvedSource.linkTargetId = resolvedTarget.id;
    if (!resolvedTarget.linkSources) {
      resolvedTarget.linkSources = new Set();
    }
    resolvedTarget.linkSources.add(resolvedSource.id);
    if (!this.towerConnectionSources.has(resolvedTarget.id)) {
      this.towerConnectionSources.set(resolvedTarget.id, new Set());
    }
    this.towerConnectionSources.get(resolvedTarget.id).add(resolvedSource.id);
    resolvedSource.cooldown = 0;
    if (resolvedTarget.type === 'beta') {
      this.ensureBetaState(resolvedTarget);
    } else if (resolvedTarget.type === 'gamma') {
      this.ensureGammaState(resolvedTarget);
    } else if (resolvedTarget.type === 'iota') {
      this.ensureIotaState(resolvedTarget);
    }
    return true;
  }

  /**
   * Tear down an existing resource link between two lattices.
   */
  removeTowerConnection(source, target) {
    const resolvedSource = typeof source === 'string' ? this.getTowerById(source) : source;
    const resolvedTarget = typeof target === 'string' ? this.getTowerById(target) : target;
    if (!resolvedSource || !resolvedTarget) {
      return false;
    }
    if (resolvedSource.linkTargetId !== resolvedTarget.id) {
      return false;
    }
    this.towerConnectionMap.delete(resolvedSource.id);
    resolvedSource.linkTargetId = null;
    resolvedSource.cooldown = 0;
    if (resolvedTarget.linkSources instanceof Set) {
      resolvedTarget.linkSources.delete(resolvedSource.id);
    }
    const sourceSet = this.towerConnectionSources.get(resolvedTarget.id);
    if (sourceSet) {
      sourceSet.delete(resolvedSource.id);
      if (!sourceSet.size) {
        this.towerConnectionSources.delete(resolvedTarget.id);
      }
    }
    if (resolvedTarget.type === 'beta') {
      this.ensureBetaState(resolvedTarget);
    } else if (resolvedTarget.type === 'gamma') {
      this.ensureGammaState(resolvedTarget);
    } else if (resolvedTarget.type === 'iota') {
      this.ensureIotaState(resolvedTarget);
    }
    return true;
  }

  /**
   * Refresh connection drag highlights so compatible towers glow while the cursor moves.
   */
  updateConnectionDragHighlights(position) {
    const dragState = this.connectionDragState;
    if (!dragState || !dragState.originTowerId) {
      return;
    }
    const origin = this.getTowerById(dragState.originTowerId);
    if (!origin) {
      this.clearConnectionDragState();
      return;
    }
    const entries = [];
    if (origin.linkTargetId) {
      entries.push({
        action: 'disconnect',
        sourceId: origin.id,
        targetId: origin.linkTargetId,
        towerId: origin.linkTargetId,
        role: 'existingTarget',
      });
    }
    if (origin.linkSources instanceof Set) {
      origin.linkSources.forEach((sourceId) => {
        entries.push({
          action: 'disconnect',
          sourceId,
          targetId: origin.id,
          towerId: sourceId,
          role: 'linkedSource',
        });
      });
    }
    this.towers.forEach((candidate) => {
      if (!candidate || candidate.id === origin.id) {
        return;
      }
      if (this.areTowersConnectionCompatible(origin, candidate)) {
        entries.push({
          action: 'connect',
          sourceId: origin.id,
          targetId: candidate.id,
          towerId: candidate.id,
          role: 'candidate',
        });
      }
    });
    dragState.highlightEntries = entries;
    dragState.hoverEntry = this.resolveConnectionHoverEntry(entries, position);
  }

  /**
   * Select the highlight entry the pointer is currently hovering.
   */
  resolveConnectionHoverEntry(entries, position) {
    if (!Array.isArray(entries) || !entries.length || !position) {
      return null;
    }
    const hoverRadius = Math.max(18, Math.min(this.renderWidth || 0, this.renderHeight || 0) * 0.045);
    let best = null;
    let bestDistance = Infinity;
    entries.forEach((entry) => {
      const tower = this.getTowerById(entry.towerId);
      if (!tower) {
        return;
      }
      const dx = position.x - tower.x;
      const dy = position.y - tower.y;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance)) {
        return;
      }
      if (distance <= hoverRadius && distance < bestDistance) {
        best = entry;
        bestDistance = distance;
      }
    });
    return best;
  }

  updateDeltaCommandDrag(position) {
    const dragState = this.deltaCommandDragState;
    if (!dragState || !dragState.towerId) {
      return;
    }
    const tower = this.getTowerById(dragState.towerId);
    if (!tower) {
      this.clearDeltaCommandDragState();
      return;
    }
    dragState.currentPosition = position ? { x: position.x, y: position.y } : null;
    if (!position) {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = 'Drag onto the glyph lane to position the Δ cohort.';
      }
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
      dragState.trackDistance = Infinity;
      return;
    }

    const projection = this.getClosestPointOnPath(position);
    if (!projection?.point) {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = 'Drag onto the glyph lane to position the Δ cohort.';
      }
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
      dragState.trackDistance = Infinity;
      return;
    }

    const distance = Math.hypot(position.x - projection.point.x, position.y - projection.point.y);
    dragState.trackDistance = distance;
    const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
    const tolerance = Math.max(24, minDimension * 0.05);
    const withinTrack = Number.isFinite(distance) && distance <= tolerance;
    if (withinTrack) {
      dragState.trackAnchor = {
        point: { x: projection.point.x, y: projection.point.y },
        progress: Number.isFinite(projection.progress)
          ? Math.max(0, Math.min(1, projection.progress))
          : 0,
      };
      if (!dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = 'Release to anchor Δ cohort to the glyph lane.';
      }
      dragState.anchorAvailable = true;
    } else {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = 'Drag onto the glyph lane to position the Δ cohort.';
      }
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
    }
  }

  commitDeltaCommandDrag() {
    const dragState = this.deltaCommandDragState;
    if (!dragState?.towerId || !dragState.trackAnchor) {
      return false;
    }
    const tower = this.getTowerById(dragState.towerId);
    if (!tower) {
      return false;
    }
    const anchor = {
      x: dragState.trackAnchor.point.x,
      y: dragState.trackAnchor.point.y,
      progress: dragState.trackAnchor.progress,
    };
    const assigned = this.assignDeltaTrackHoldAnchor(tower, anchor);
    if (assigned) {
      if (this.audio && typeof this.audio.playSfx === 'function') {
        this.audio.playSfx('uiConfirm');
      }
      if (this.messageEl) {
        this.messageEl.textContent = 'Δ cohort orbit anchored to the glyph lane.';
      }
      if (!this.shouldAnimate) {
        this.draw();
      }
    }
    return assigned;
  }

  /**
   * Animate swirling supply motes around lattices based on stored shot counts.
   */
  updateConnectionParticles(delta) {
    const step = Math.max(0, delta);
    this.towers.forEach((tower) => {
      if (!tower) {
        return;
      }
      const desiredAlpha = Math.max(0, Math.floor(tower.storedAlphaSwirl || 0));
      const desiredBeta = Math.max(0, Math.floor(tower.storedBetaSwirl || 0));
      this.syncTowerConnectionParticles(tower, 'alpha', desiredAlpha);
      this.syncTowerConnectionParticles(tower, 'beta', desiredBeta);
      if (!Array.isArray(tower.connectionParticles)) {
        return;
      }
      const particles = tower.connectionParticles.filter((particle) => particle && particle.state !== 'done');
      particles.forEach((particle) => {
        if (particle.state === 'launch') {
          this.updateConnectionLaunchParticle(particle, step);
          return;
        }
        if (particle.state === 'arrive') {
          this.updateConnectionArriveParticle(tower, particle, step);
          return;
        }
        this.updateConnectionOrbitParticle(particle, step);
      });
      tower.connectionParticles = particles.filter((particle) => particle && particle.state !== 'done');
    });

    const activeKeys = new Set();
    this.towerConnectionMap.forEach((targetId, sourceId) => {
      activeKeys.add(`${sourceId}->${targetId}`);
      const existing = this.connectionEffects.find((effect) => effect.key === `${sourceId}->${targetId}`);
      if (!existing) {
        const source = this.getTowerById(sourceId);
        const target = this.getTowerById(targetId);
        if (source && target) {
          this.connectionEffects.push(this.createConnectionEffect(source, target));
        }
      }
    });
    this.connectionEffects = this.connectionEffects.filter((effect) => {
      if (!effect || !activeKeys.has(effect.key)) {
        return false;
      }
      const source = this.getTowerById(effect.sourceId);
      const target = this.getTowerById(effect.targetId);
      if (!source || !target) {
        return false;
      }
      effect.source = source;
      effect.target = target;
      effect.particles.forEach((particle) => {
        particle.progress = (particle.progress || 0) + (particle.speed || 0.35) * step;
        if (particle.progress >= 1) {
          particle.progress -= 1;
        }
      });
      return true;
    });
  }

  /**
   * Ensure a tower maintains the desired number of swirling motes per resource type.
   */
  syncTowerConnectionParticles(tower, type, desiredCount) {
    if (!tower) {
      return;
    }
    if (!Array.isArray(tower.connectionParticles)) {
      tower.connectionParticles = [];
    }
    const particles = tower.connectionParticles.filter(
      (particle) => particle.type === type && particle.state !== 'done',
    );
    const activeParticles = particles.filter((particle) => particle.state === 'orbit' || particle.state === 'arrive');
    if (activeParticles.length > desiredCount) {
      let toCull = activeParticles.length - desiredCount;
      // Drop the newest orbiters first so capped towers keep their existing motes.
      for (let index = tower.connectionParticles.length - 1; index >= 0 && toCull > 0; index -= 1) {
        const particle = tower.connectionParticles[index];
        if (!particle || particle.type !== type) {
          continue;
        }
        if (particle.state === 'launch' || particle.state === 'done') {
          continue;
        }
        if (particle.state === 'orbit' || particle.state === 'arrive') {
          tower.connectionParticles.splice(index, 1);
          toCull -= 1;
        }
      }
      return;
    }
    if (activeParticles.length < desiredCount) {
      const toAdd = Math.min(desiredCount - activeParticles.length, 60);
      for (let index = 0; index < toAdd; index += 1) {
        tower.connectionParticles.push(
          this.createConnectionParticle(tower, type, { state: 'arrive' }),
        );
      }
    }
  }

  /**
   * Create a fresh swirling mote configuration for a lattice.
   */
  createConnectionParticle(tower, type, options = {}) {
    const baseRange = Number.isFinite(tower.range) ? Math.max(20, tower.range * 0.06) : 24;
    const bodyRadius = this.resolveTowerBodyRadius(tower);
    const defaultOrbit = bodyRadius + 6 + baseRange;
    const orbitRadius = Number.isFinite(options.orbitRadius)
      ? options.orbitRadius
      : defaultOrbit + Math.random() * baseRange * 0.35;
    const particle = {
      type,
      angle: Number.isFinite(options.angle) ? options.angle : Math.random() * Math.PI * 2,
      speed: Number.isFinite(options.speed) ? options.speed : 1.6 + Math.random() * 0.7,
      distance: orbitRadius - (bodyRadius + 6),
      orbitRadius,
      size: Number.isFinite(options.size) ? options.size : type === 'beta' ? 3.4 : 2.6,
      pulse: Math.random() * Math.PI * 2,
      state: options.state || 'orbit',
    };
    if (particle.state === 'arrive') {
      const startPosition = options.startPosition || { x: tower.x, y: tower.y };
      particle.position = { ...startPosition };
      particle.arriveStart = { ...startPosition };
      particle.arriveDuration = Number.isFinite(options.arriveDuration)
        ? options.arriveDuration
        : 0.32 + Math.random() * 0.12;
      particle.arriveTime = 0;
    }
    return particle;
  }

  /**
   * Resolve the baseline body radius so orbit math can stay consistent across render scales.
   */
  resolveTowerBodyRadius(tower) {
    const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
    const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
    const minDimension = width > 0 && height > 0 ? Math.min(width, height) : Math.max(width, height);
    const scale = Math.max(1, minDimension);
    return Math.max(12, scale * ALPHA_BASE_RADIUS_FACTOR);
  }

  /**
   * Keep idle orbit particles spinning in sync with tower cadence.
   */
  updateConnectionOrbitParticle(particle, step) {
    particle.angle = (particle.angle || 0) + (particle.speed || 1) * step;
    particle.pulse = (particle.pulse || 0) + step;
  }

  /**
   * Blend arriving motes from supply shots into the standard orbit radius.
   */
  updateConnectionArriveParticle(tower, particle, step) {
    particle.arriveTime = (particle.arriveTime || 0) + step;
    const duration = Number.isFinite(particle.arriveDuration) ? particle.arriveDuration : 0.32;
    const progress = duration > 0 ? Math.min(1, particle.arriveTime / duration) : 1;
    const eased = easeOutCubic(progress);
    const start = particle.arriveStart || { x: tower.x, y: tower.y };
    const target = this.resolveConnectionOrbitAnchor(tower, particle);
    particle.position = {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    };
    particle.pulse = (particle.pulse || 0) + step;
    if (progress >= 1) {
      particle.state = 'orbit';
      particle.position = null;
      particle.arriveStart = null;
      particle.arriveTime = 0;
    }
  }

  /**
   * Propel spent motes toward their target so stored shots visually discharge.
   */
  updateConnectionLaunchParticle(particle, step) {
    particle.launchTime = (particle.launchTime || 0) + step;
    const duration = Number.isFinite(particle.launchDuration) ? particle.launchDuration : 0.28;
    const progress = duration > 0 ? Math.min(1, particle.launchTime / duration) : 1;
    const eased = easeInCubic(progress);
    const start = particle.launchStart || particle.position || { x: 0, y: 0 };
    const target = particle.targetPosition || start;
    particle.position = {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    };
    particle.pulse = (particle.pulse || 0) + step * 1.5;
    if (progress >= 1) {
      particle.state = 'done';
    }
  }

  /**
   * Compute the stable orbit anchor without the animated pulse offset.
   */
  resolveConnectionOrbitAnchor(tower, particle) {
    if (!tower || !particle) {
      return null;
    }
    const bodyRadius = this.resolveTowerBodyRadius(tower);
    const orbitRadius = Number.isFinite(particle.orbitRadius)
      ? particle.orbitRadius
      : bodyRadius + 6 + (particle.distance || 18);
    const angle = particle.angle || 0;
    return {
      x: tower.x + Math.cos(angle) * orbitRadius,
      y: tower.y + Math.sin(angle) * orbitRadius,
    };
  }

  /**
   * Resolve the animated orbit position including the pulsing offset.
   */
  resolveConnectionOrbitPosition(tower, particle, bodyRadius) {
    if (!tower || !particle) {
      return null;
    }
    const baseRadius = Number.isFinite(bodyRadius) ? bodyRadius : this.resolveTowerBodyRadius(tower);
    const orbitRadius = Number.isFinite(particle.orbitRadius)
      ? particle.orbitRadius
      : baseRadius + 6 + (particle.distance || 18);
    const angle = particle.angle || 0;
    const pulse = Math.sin((particle.pulse || 0) * 2) * 2.2;
    const offset = orbitRadius + pulse;
    return {
      x: tower.x + Math.cos(angle) * offset,
      y: tower.y + Math.sin(angle) * offset,
    };
  }

  /**
   * Queue a swirl launch so we can animate the motes once the tower fires.
   */
  queueTowerSwirlLaunch(tower, type, count) {
    if (!tower || !type || !Number.isFinite(count) || count <= 0) {
      return;
    }
    if (!Array.isArray(tower.pendingSwirlLaunches)) {
      tower.pendingSwirlLaunches = [];
    }
    const existing = tower.pendingSwirlLaunches.find((entry) => entry.type === type);
    if (existing) {
      existing.count += count;
    } else {
      tower.pendingSwirlLaunches.push({ type, count });
    }
  }

  /**
   * Trigger any queued swirl launches toward the resolved attack position.
   */
  triggerQueuedSwirlLaunches(tower, targetPosition) {
    if (!tower || !Array.isArray(tower.pendingSwirlLaunches) || !tower.pendingSwirlLaunches.length) {
      return;
    }
    if (!targetPosition) {
      tower.pendingSwirlLaunches = [];
      return;
    }
    this.launchTowerConnectionParticles(tower, tower.pendingSwirlLaunches, targetPosition);
    tower.pendingSwirlLaunches = [];
  }

  /**
   * Convert orbiting motes into travelling bursts aimed at the provided target.
   */
  launchTowerConnectionParticles(tower, entries, targetPosition) {
    if (!tower || !Array.isArray(tower.connectionParticles) || !Array.isArray(entries) || !targetPosition) {
      return;
    }
    entries.forEach((entry) => {
      let remaining = Math.max(0, Math.floor(entry?.count || 0));
      if (remaining <= 0) {
        return;
      }
      tower.connectionParticles.forEach((particle) => {
        if (remaining <= 0 || !particle || particle.type !== entry.type) {
          return;
        }
        if (particle.state === 'launch') {
          return;
        }
        if (particle.state === 'orbit' || particle.state === 'arrive') {
          const startPosition =
            particle.state === 'arrive' && particle.position
              ? { ...particle.position }
              : this.resolveConnectionOrbitPosition(tower, particle);
          if (!startPosition) {
            return;
          }
          particle.state = 'launch';
          particle.launchStart = startPosition;
          particle.position = { ...startPosition };
          particle.targetPosition = { ...targetPosition };
          particle.launchTime = 0;
          particle.launchDuration = 0.28 + Math.random() * 0.14;
          remaining -= 1;
        }
      });
    });
  }

  /**
   * Seed supply projectiles with motes that can blend into orbit upon arrival.
   */
  createSupplySeeds(source, target, payload = {}) {
    if (!source || !target) {
      return [];
    }
    const seeds = [];
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const appendSeeds = (count, type) => {
      for (let index = 0; index < count; index += 1) {
        seeds.push({
          type,
          progressOffset: Math.random() * 0.18 + (index / Math.max(1, count)) * 0.1,
          perpendicular: (Math.random() - 0.5) * 10,
          phaseOffset: Math.random() * Math.PI * 2,
          sway: 3 + Math.random() * 2,
          size: type === 'beta' ? 2.8 : 2.2,
        });
      }
    };

    if (payload.type === 'alpha') {
      appendSeeds(3, 'alpha');
    } else if (payload.type === 'beta') {
      appendSeeds(3, 'beta');
      const alphaShots = Math.max(0, Math.floor(payload.alphaShots || 0));
      if (alphaShots > 0) {
        appendSeeds(Math.min(3 * alphaShots, 12), 'alpha');
      }
    } else if (payload.type === 'gamma') {
      appendSeeds(4, 'beta');
      const betaShots = Math.max(0, Math.floor(payload.betaShots || 0));
      if (betaShots > 0) {
        appendSeeds(Math.min(3 * betaShots, 12), 'beta');
      }
      const alphaShots = Math.max(0, Math.floor(payload.alphaShots || 0));
      if (alphaShots > 0) {
        appendSeeds(Math.min(3 * alphaShots, 12), 'alpha');
      }
    }

    seeds.forEach((seed) => {
      seed.position = { ...source };
    });

    return seeds;
  }

  /**
   * Update supply seed positions so they trail the projectile during flight.
   */
  updateSupplySeeds(projectile) {
    if (!projectile || !Array.isArray(projectile.seeds) || !projectile.seeds.length) {
      return;
    }
    const { source, target } = projectile;
    if (!source || !target) {
      return;
    }
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const px = -ny;
    const py = nx;
    const baseProgress = Math.max(0, projectile.progress || 0);
    projectile.seeds.forEach((seed) => {
      if (!seed) {
        return;
      }
      const offsetProgress = Math.max(0, Math.min(1, baseProgress + (seed.progressOffset || 0)));
      const eased = easeOutCubic(offsetProgress);
      const baseX = source.x + dx * eased;
      const baseY = source.y + dy * eased;
      const sway = Math.sin(baseProgress * 8 + (seed.phaseOffset || 0)) * (seed.sway || 3);
      const lateral = (seed.perpendicular || 0) + sway;
      seed.position = {
        x: baseX + px * lateral,
        y: baseY + py * lateral,
      };
    });
  }

  /**
   * Convert supply projectile seeds into arriving orbit motes at the destination tower.
   */
  transferSupplySeedsToOrbit(tower, projectile) {
    if (!tower || !projectile || !Array.isArray(projectile.seeds) || !projectile.seeds.length) {
      return;
    }
    if (!Array.isArray(tower.connectionParticles)) {
      tower.connectionParticles = [];
    }
    const bodyRadius = this.resolveTowerBodyRadius(tower);
    const desiredSwirlCounts = {
      alpha: Math.max(0, Math.floor(tower.storedAlphaSwirl || 0)),
      beta: Math.max(0, Math.floor(tower.storedBetaSwirl || 0)),
    };
    const activeSwirlCounts = { alpha: 0, beta: 0 };
    tower.connectionParticles.forEach((particle) => {
      if (!particle || (particle.type !== 'alpha' && particle.type !== 'beta')) {
        return;
      }
      if (particle.state === 'orbit' || particle.state === 'arrive') {
        activeSwirlCounts[particle.type] += 1;
      }
    });
    projectile.seeds.forEach((seed) => {
      if (!seed) {
        return;
      }
      const type = seed.type === 'beta' ? 'beta' : 'alpha';
      if (activeSwirlCounts[type] >= desiredSwirlCounts[type]) {
        // Ignore surplus arrivals once the tower already displays the target swirl count.
        return;
      }
      const startPosition = seed.position || projectile.target || { x: tower.x, y: tower.y };
      const angle = Math.atan2(startPosition.y - tower.y, startPosition.x - tower.x);
      const orbitRadius = bodyRadius + 6 + Math.random() * Math.max(18, Number.isFinite(tower.range) ? tower.range * 0.06 : 24);
      const particle = this.createConnectionParticle(tower, type, {
        state: 'arrive',
        startPosition,
        angle,
        orbitRadius,
        arriveDuration: 0.28 + Math.random() * 0.12,
        size: seed.size,
      });
      tower.connectionParticles.push(particle);
      activeSwirlCounts[type] += 1;
    });
  }

  /**
   * Initialize a connection link effect between two lattices.
   */
  createConnectionEffect(source, target) {
    return {
      key: `${source.id}->${target.id}`,
      sourceId: source.id,
      targetId: target.id,
      source,
      target,
      particles: Array.from({ length: 3 }, () => ({
        progress: Math.random(),
        speed: 0.35 + Math.random() * 0.25,
      })),
    };
  }

  /**
   * Render swirling supply motes around a lattice.
   */
  drawTowerConnectionParticles(ctx, tower, bodyRadius) {
    return CanvasRenderer.drawTowerConnectionParticles.call(this, ctx, tower, bodyRadius);
  }

  /**
   * Render flowing motes along each established connection link.
   */
  drawConnectionEffects(ctx) {
    return CanvasRenderer.drawConnectionEffects.call(this, ctx);
  }

  validatePlacement(normalized, options = {}) {
    const { allowPathOverlap = false } = options;
    if (!this.levelConfig) {
      return { valid: false, reason: 'Activate a level first.' };
    }

    const position = this.getCanvasPosition(normalized);
    const minDimension = Math.min(this.renderWidth, this.renderHeight) || 1;
    const towerBodyRadius = this.resolveTowerBodyRadius();
    // Require at least a full body diameter plus a small buffer so lattices do not visually overlap.
    const minSpacing = Math.max(towerBodyRadius * 2.1, 24);

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

  getPositionAlongPath(progress) {
    if (!this.pathSegments.length || !Number.isFinite(this.pathLength) || this.pathLength <= 0) {
      return null;
    }

    const clamped = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const targetDistance = clamped * this.pathLength;
    let traversed = 0;

    for (let index = 0; index < this.pathSegments.length; index += 1) {
      const segment = this.pathSegments[index];
      const length = Number.isFinite(segment.length)
        ? segment.length
        : this.distanceBetween(segment.start, segment.end);
      if (!length) {
        continue;
      }
      const next = traversed + length;
      if (targetDistance <= next || index === this.pathSegments.length - 1) {
        const ratio = Math.max(0, Math.min(1, (targetDistance - traversed) / length));
        const x = segment.start.x + (segment.end.x - segment.start.x) * ratio;
        const y = segment.start.y + (segment.end.y - segment.start.y) * ratio;
        const tangent = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
        return { x, y, tangent };
      }
      traversed = next;
    }

    const fallbackSegment = this.pathSegments[this.pathSegments.length - 1];
    if (!fallbackSegment) {
      return null;
    }
    const tangent = Math.atan2(
      fallbackSegment.end.y - fallbackSegment.start.y,
      fallbackSegment.end.x - fallbackSegment.start.x,
    );
    return { x: fallbackSegment.end.x, y: fallbackSegment.end.y, tangent };
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
   * Normalize an angle into the [0, 2π) range for consistent orbital math.
   */
  normalizeAngle(angle) {
    if (!Number.isFinite(angle)) {
      return 0;
    }
    let normalized = angle % (Math.PI * 2);
    if (normalized < 0) {
      normalized += Math.PI * 2;
    }
    return normalized;
  }

  /**
   * Measure the smallest angular difference between two radians values.
   */
  angularDifference(a, b) {
    const angleA = this.normalizeAngle(a);
    const angleB = this.normalizeAngle(b);
    let diff = Math.abs(angleA - angleB);
    if (diff > Math.PI) {
      diff = Math.abs(diff - Math.PI * 2);
    }
    return diff;
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
    this.resetChiSystems();
    this.projectiles = [];
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
    this.nuBursts = [];
    this.activeWave = this.createWaveState(this.levelConfig.waves[0], { initialWave: true });
    this.lives = this.levelConfig.lives;
    this.markWaveStart();
    this.startCombatStatsSession();

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

  // Derive an additive 10% speed scalar for each endless cycle to keep pacing approachable.
  getCycleSpeedScalar() {
    return this.isEndlessMode ? 1 + this.endlessCycle * 0.1 : 1;
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
    // Apply a 10× health jump per endless cycle while boosting speed by 10% additively.
    const speedScalar = this.getCycleSpeedScalar();
    const resolvedGroups = this.resolveWaveGroups(config);
    const scaledGroups = resolvedGroups.map((group) => ({
      ...group,
      hp: Number.isFinite(group.hp) ? group.hp * multiplier : group.hp,
      speed: Number.isFinite(group.speed) ? group.speed * speedScalar : group.speed,
      reward: Number.isFinite(group.reward) ? group.reward * multiplier : group.reward,
    }));
    const totalMinionCount = scaledGroups.reduce(
      (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
      0,
    );
    const primaryGroup = scaledGroups[0] || null;

    const scaledConfig = {
      ...config,
      enemyGroups: scaledGroups,
      minionCount: totalMinionCount,
      hp: primaryGroup ? primaryGroup.hp : Number.isFinite(config.hp) ? config.hp * multiplier : config.hp,
      speed: primaryGroup ? primaryGroup.speed : Number.isFinite(config.speed) ? config.speed * speedScalar : config.speed,
      reward: primaryGroup
        ? primaryGroup.reward
        : Number.isFinite(config.reward)
          ? config.reward * multiplier
          : config.reward,
    };

    // Mirror the cycle scaling onto any boss variant attached to the wave.
    if (config.boss && typeof config.boss === 'object') {
      const scaledBoss = { ...config.boss };
      if (Number.isFinite(scaledBoss.hp)) {
        scaledBoss.hp *= multiplier;
      }
      if (Number.isFinite(scaledBoss.speed)) {
        scaledBoss.speed *= speedScalar;
      }
      if (Number.isFinite(scaledBoss.reward)) {
        scaledBoss.reward *= multiplier;
      }
      scaledConfig.boss = scaledBoss;
    } else {
      scaledConfig.boss = null;
    }

    const bossCount = scaledConfig.boss ? 1 : 0;
    scaledConfig.count = totalMinionCount + bossCount;

    return {
      config: scaledConfig,
      spawned: 0,
      nextSpawn: initialWave ? this.initialSpawnDelay : 0,
      multiplier,
    };
  }

  /**
   * Resolve the endless cycle multiplier for an arbitrary cycle value.
   */
  getCycleMultiplierFor(cycle = this.endlessCycle) {
    if (!this.isEndlessMode) {
      return 1;
    }
    if (!Number.isFinite(cycle)) {
      return this.getCycleMultiplier();
    }
    return 10 ** Math.max(0, cycle);
  }

  /**
   * Resolve the endless cycle speed scalar for an arbitrary cycle value.
   */
  getCycleSpeedScalarFor(cycle = this.endlessCycle) {
    if (!this.isEndlessMode) {
      return 1;
    }
    if (!Number.isFinite(cycle)) {
      return this.getCycleSpeedScalar();
    }
    return 1 + Math.max(0, cycle) * 0.1;
  }

  /**
   * Produce a scaled wave configuration without mutating the original level data.
   */
  scaleWaveConfigForCycle(waveConfig, cycle = this.endlessCycle) {
    if (!waveConfig) {
      return null;
    }
    const multiplier = this.getCycleMultiplierFor(cycle);
    const speedScalar = this.getCycleSpeedScalarFor(cycle);
    const scaled = { ...waveConfig };
    const resolvedGroups = this.resolveWaveGroups(waveConfig);
    const scaledGroups = resolvedGroups.map((group) => ({
      ...group,
      hp: Number.isFinite(group.hp) ? group.hp * multiplier : group.hp,
      speed: Number.isFinite(group.speed) ? group.speed * speedScalar : group.speed,
      reward: Number.isFinite(group.reward) ? group.reward * multiplier : group.reward,
    }));
    const totalMinions = scaledGroups.reduce(
      (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
      0,
    );
    const primaryGroup = scaledGroups[0] || null;
    scaled.enemyGroups = scaledGroups;
    scaled.minionCount = totalMinions;
    if (primaryGroup) {
      scaled.hp = primaryGroup.hp;
      scaled.speed = primaryGroup.speed;
      scaled.reward = primaryGroup.reward;
      scaled.color = primaryGroup.color;
      scaled.codexId = primaryGroup.codexId;
      scaled.label = primaryGroup.label;
    } else {
      if (Number.isFinite(scaled.hp)) {
        scaled.hp *= multiplier;
      }
      if (Number.isFinite(scaled.speed)) {
        scaled.speed *= speedScalar;
      }
      if (Number.isFinite(scaled.reward)) {
        scaled.reward *= multiplier;
      }
    }
    if (scaled.boss && typeof scaled.boss === 'object') {
      scaled.boss = { ...scaled.boss };
      if (Number.isFinite(scaled.boss.hp)) {
        scaled.boss.hp *= multiplier;
      }
      if (Number.isFinite(scaled.boss.speed)) {
        scaled.boss.speed *= speedScalar;
      }
      if (Number.isFinite(scaled.boss.reward)) {
        scaled.boss.reward *= multiplier;
      }
    }
    scaled.count = totalMinions + (scaled.boss ? 1 : 0);
    return scaled;
  }

  /**
   * Present an exponent label alongside a formatted HP total for stats displays.
   */
  formatEnemyExponentLabel(exponent, hpValue) {
    const resolvedExponent = Number.isFinite(exponent)
      ? exponent
      : this.calculateHealthExponent(hpValue);
    const exponentLabel = Number.isFinite(resolvedExponent)
      ? `10^${resolvedExponent.toFixed(1)}`
      : '10^0.0';
    const hpLabel = formatCombatNumber(Math.max(0, hpValue || 0));
    return `${exponentLabel} (${hpLabel})`;
  }

  /**
   * Format an enemy speed value for UI consumption using consistent units.
   */
  formatEnemySpeed(speed) {
    if (!Number.isFinite(speed)) {
      return '—';
    }
    return `${Math.max(0, speed).toFixed(3)} path/s`;
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

  updateTrackRiverParticles(delta) {
    if (!Array.isArray(this.trackRiverParticles) || !this.trackRiverParticles.length) {
      return;
    }

    const dt = Math.max(0, Math.min(delta, 0.08));
    this.trackRiverPulse = Number.isFinite(this.trackRiverPulse) ? this.trackRiverPulse : 0;
    this.trackRiverPulse += dt * 0.6;
    const fullTurn = Math.PI * 2;
    if (this.trackRiverPulse >= fullTurn) {
      this.trackRiverPulse -= fullTurn;
    }

    const wrapProgress = (value) => {
      if (value > 1) {
        return value - 1;
      }
      if (value < 0) {
        return value + 1;
      }
      return value;
    };

    this.trackRiverParticles.forEach((particle) => {
      if (!particle) {
        return;
      }
      const speed = Number.isFinite(particle.speed) ? particle.speed : 0.05;
      const progress = Number.isFinite(particle.progress) ? particle.progress : Math.random();
      particle.progress = wrapProgress(progress + speed * dt);

      const phaseSpeed = Number.isFinite(particle.phaseSpeed) ? particle.phaseSpeed : 1;
      const nextPhase = (Number.isFinite(particle.phase) ? particle.phase : 0) + phaseSpeed * dt;
      particle.phase = nextPhase % fullTurn;

      const driftTimer = Number.isFinite(particle.driftTimer) ? particle.driftTimer : 0;
      particle.driftTimer = driftTimer - dt;
      if (particle.driftTimer <= 0) {
        particle.offsetTarget = (Math.random() - 0.5) * 0.8;
        particle.driftTimer = 0.6 + Math.random() * 1.3;
      }

      const driftRate = Number.isFinite(particle.driftRate) ? particle.driftRate : 0.6;
      const easing = Math.min(1, dt * driftRate);
      const offset = Number.isFinite(particle.offset) ? particle.offset : 0;
      const target = Number.isFinite(particle.offsetTarget) ? particle.offsetTarget : 0;
      particle.offset = offset + (target - offset) * easing;
    });

    if (Array.isArray(this.trackRiverTracerParticles) && this.trackRiverTracerParticles.length) {
      this.trackRiverTracerParticles.forEach((particle) => {
        if (!particle) {
          return;
        }
        const speed = Number.isFinite(particle.speed) ? particle.speed : 0.14;
        const progress = Number.isFinite(particle.progress) ? particle.progress : Math.random();
        particle.progress = wrapProgress(progress + speed * dt);

        const phaseSpeed = Number.isFinite(particle.phaseSpeed) ? particle.phaseSpeed : 1.6;
        const nextPhase = (Number.isFinite(particle.phase) ? particle.phase : 0) + phaseSpeed * dt;
        particle.phase = nextPhase % fullTurn;

        const driftTimer = Number.isFinite(particle.driftTimer) ? particle.driftTimer : 0;
        particle.driftTimer = driftTimer - dt;
        if (particle.driftTimer <= 0) {
          particle.offsetTarget = (Math.random() - 0.5) * 0.3;
          particle.driftTimer = 0.25 + Math.random() * 0.5;
        }

        const driftRate = Number.isFinite(particle.driftRate) ? particle.driftRate : 2.4;
        const easing = Math.min(1, dt * driftRate);
        const offset = Number.isFinite(particle.offset) ? particle.offset : 0;
        const target = Number.isFinite(particle.offsetTarget) ? particle.offsetTarget : 0;
        particle.offset = offset + (target - offset) * easing;
      });
    }
  }

  update(delta) {
    if (!this.levelActive || !this.levelConfig) {
      return;
    }

    const speedDelta = delta * this.speedMultiplier;
    // Attribute stat upkeep costs so the codex can surface non-combat drains.
    const finishStatSegment = beginPerformanceSegment('update:stats');
    try {
      this.updateCombatStats(speedDelta);
    } finally {
      finishStatSegment();
    }

    // Measure passive ambient effects (particles, floaters, connections) as a single bucket.
    const finishAmbientSegment = beginPerformanceSegment('update:ambient');
    try {
      this.updateFloaters(speedDelta);
      this.updateTrackRiverParticles(speedDelta);
      this.updateFocusIndicator(speedDelta);
      this.updateAlphaBursts(speedDelta);
      this.updateBetaBursts(speedDelta);
      this.updateGammaBursts(speedDelta);
      this.updateNuBursts(speedDelta);
      this.updateCrystals(speedDelta);
      this.updateConnectionParticles(speedDelta);
      this.updateDamageNumbers(speedDelta);
      this.updateWaveTallies(speedDelta);
    } finally {
      finishAmbientSegment();
    }

    const arcSpeed = this.levelConfig?.arcSpeed ?? 0.2;
    const pathLength = this.pathLength || 1;
    this.arcOffset -= arcSpeed * speedDelta * pathLength;
    const wrapDistance = pathLength * 1000;
    if (this.arcOffset <= -wrapDistance) {
      this.arcOffset += wrapDistance;
    }

    if (!this.combatActive) {
      // Keep unique tower behaviors alive even while waves are paused.
      // Keep a tower bucket active even when waves are paused so idle behaviors are tracked.
      const finishMaintenanceSegment = beginPerformanceSegment('update:towers');
      try {
        this.towers.forEach((tower) => {
          if (tower.type === 'zeta') {
            this.updateZetaTower(tower, speedDelta);
            return;
          }
          if (tower.type === 'eta') {
            this.updateEtaTower(tower, speedDelta);
            return;
          }
          if (tower.type === 'lambda') {
            this.updateLambdaTower(tower, speedDelta);
            return;
          }
          if (tower.type !== 'delta') {
            return;
          }
          tower.cooldown = Math.max(0, tower.cooldown - speedDelta);
          this.updateDeltaTower(tower, speedDelta);
        });
      } finally {
        finishMaintenanceSegment();
      }
      // Record HUD/progress refresh time for the paused state separately.
      const finishHudSegment = beginPerformanceSegment('update:hud');
      try {
        this.updateHud();
        this.updateProgress();
      } finally {
        finishHudSegment();
      }
      return;
    }

    this.waveTimer += speedDelta;
    // Group enemy spawning and marching updates to weigh pathfinding cost.
    const finishEnemySegment = beginPerformanceSegment('update:enemies');
    try {
      this.spawnEnemies();
      this.updateEnemies(speedDelta);
      this.updateChiThralls(speedDelta);
      this.updateChiLightTrails(speedDelta);
    } finally {
      finishEnemySegment();
    }

    // Track the live tower loop while combat is active.
    const finishTowerSegment = beginPerformanceSegment('update:towers');
    try {
      this.updateTowers(speedDelta);
    } finally {
      finishTowerSegment();
    }

    // Monitor projectile simulations separately so beam-heavy builds are visible.
    const finishProjectileSegment = beginPerformanceSegment('update:projectiles');
    try {
      this.updateProjectiles(speedDelta);
    } finally {
      finishProjectileSegment();
    }

    // Keep mote animation costs visible when drops flood the field.
    const finishMoteSegment = beginPerformanceSegment('update:motes');
    try {
      // Animate mote gems so they pulse gently while waiting to be collected.
      this.updateMoteGems(speedDelta);
    } finally {
      finishMoteSegment();
    }

    // Track HUD refresh costs while combat is active.
    const finishHudSegment = beginPerformanceSegment('update:hud');
    try {
      this.updateProgress();
      this.updateHud();
    } finally {
      finishHudSegment();
    }
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

    const groups = this.resolveWaveGroups(config);
    const hasBoss = Boolean(config.boss && typeof config.boss === 'object');
    const totalMinionCount = groups.reduce(
      (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
      0,
    );
    const totalSpawnCount = totalMinionCount + (hasBoss ? 1 : 0);

    while (
      this.activeWave.spawned < totalSpawnCount &&
      this.waveTimer >= this.activeWave.nextSpawn
    ) {
      const spawnIndex = this.activeWave.spawned;
      const spawningBoss = hasBoss && spawnIndex >= totalMinionCount;
      let sourceConfig = null;

      if (spawningBoss) {
        sourceConfig = { ...config, ...(config.boss || {}) };
      } else {
        let remainingIndex = spawnIndex;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
          const group = groups[groupIndex];
          const groupCount = Math.max(0, Math.floor(group.count || 0));
          if (remainingIndex < groupCount) {
            sourceConfig = group;
            break;
          }
          remainingIndex -= groupCount;
        }
        if (!sourceConfig) {
          // No suitable group found; treat minions as fully spawned and continue to boss if present.
          this.activeWave.spawned = totalMinionCount;
          continue;
        }
      }

      const spawnConfig = {
        ...config,
        ...sourceConfig,
      };
      delete spawnConfig.enemyGroups;
      delete spawnConfig.minionCount;

      const interval = Number.isFinite(sourceConfig.interval)
        ? sourceConfig.interval
        : Number.isFinite(config.interval)
          ? config.interval
          : 1.5;
      spawnConfig.interval = interval;
      spawnConfig.hp = Number.isFinite(sourceConfig.hp) ? sourceConfig.hp : config.hp;
      spawnConfig.speed = Number.isFinite(sourceConfig.speed) ? sourceConfig.speed : config.speed;
      spawnConfig.reward = Number.isFinite(sourceConfig.reward) ? sourceConfig.reward : config.reward;
      spawnConfig.color = sourceConfig.color || config.color;
      spawnConfig.label = sourceConfig.label || config.label;
      spawnConfig.codexId = sourceConfig.codexId || config.codexId || null;

      const pathMode = (spawnConfig.pathMode === 'direct' ? 'direct' : 'path');
      const symbol = this.resolveEnemySymbol(spawnConfig);
      const maxHp = Number.isFinite(spawnConfig.hp) ? Math.max(1, spawnConfig.hp) : 1;
      const hpExponent = this.calculateHealthExponent(maxHp);
      const gemDropMultiplier = resolveEnemyGemDropMultiplier(spawnConfig);
      const enemy = {
        id: this.enemyIdCounter += 1,
        progress: 0,
        hp: spawnConfig.hp,
        maxHp: spawnConfig.hp,
        speed: spawnConfig.speed,
        baseSpeed: spawnConfig.speed,
        reward: spawnConfig.reward,
        color: spawnConfig.color,
        label: spawnConfig.label,
        typeId: spawnConfig.codexId || null,
        pathMode,
        moteFactor: this.calculateMoteFactor(spawnConfig),
        symbol,
        hpExponent,
        gemDropMultiplier,
      };
      if (spawningBoss) {
        enemy.isBoss = true;
      }
      this.enemies.push(enemy);
      this.activeWave.spawned += 1;
      this.activeWave.nextSpawn += interval;
      this.scheduleStatsPanelRefresh();
      if (spawnConfig.codexId) {
        registerEnemyEncounter(spawnConfig.codexId);
      }
    }
  }

  updateTowers(delta) {
    this.towers.forEach((tower) => {
      // Attribute work to the active tower type before branching into its custom logic.
      const finishTowerSample = beginTowerPerformanceSegment(tower?.type || 'unknown');
      try {
        tower.cooldown = Math.max(0, tower.cooldown - delta);
        if (tower.linkTargetId) {
          this.updateConnectionSupplier(tower, delta);
          return;
        }
        if (tower.type === 'zeta') {
          this.updateZetaTower(tower, delta);
          return;
        }
        if (tower.type === 'eta') {
          this.updateEtaTower(tower, delta);
          return;
        }
        if (tower.type === 'delta') {
          this.updateDeltaTower(tower, delta);
          return;
        }
        if (tower.type === 'epsilon') {
          this.updateEpsilonTower(tower, delta);
          return;
        }
        if (tower.type === 'theta') {
          this.updateThetaTower(tower, delta);
          return;
        }
        if (tower.type === 'kappa') {
          this.updateKappaTower(tower, delta);
          return;
        }
        if (tower.type === 'lambda') {
          this.updateLambdaTower(tower, delta);
          return;
        }
        if (tower.type === 'mu') {
          this.updateMuTower(tower, delta);
          return;
        }
        if (tower.type === 'nu') {
          this.updateNuTower(tower, delta);
        }
        if (tower.type === 'xi') {
          this.updateXiTower(tower, delta);
        }
        if (tower.type === 'omicron') {
          this.updateOmicronTower(tower, delta);
          return;
        }
        if (tower.type === 'pi') {
          this.updatePiTower(tower, delta);
          return;
        }
        if (tower.type === 'sigma') {
          this.updateSigmaTower(tower, delta);
          return;
        }
        if (tower.type === 'chi') {
          this.updateChiTower(tower, delta);
          return;
        }
        if (!this.combatActive) {
          return;
        }
        if (tower.cooldown > 0) {
          return;
        }
        const targetInfo = this.findTarget(tower, { includeSigmaTargets: tower.type !== 'sigma' });
        if (!targetInfo) {
          return;
        }
        tower.cooldown = 1 / tower.rate;
        this.fireAtTarget(tower, targetInfo);
      } finally {
        finishTowerSample();
      }
    });
  }

  /**
   * Route a connected lattice's cadence into its downstream partner instead of enemies.
   */
  updateConnectionSupplier(tower, delta) {
    if (!tower || !tower.linkTargetId) {
      return;
    }
    const target = this.getTowerById(tower.linkTargetId);
    if (!target) {
      this.removeTowerConnection(tower.id, tower.linkTargetId);
      return;
    }
    if (!this.combatActive) {
      return;
    }
    if (tower.cooldown > 0) {
      return;
    }
    const rate = Number.isFinite(tower.rate) ? Math.max(0, tower.rate) : 0;
    if (rate <= 0) {
      tower.cooldown = 0;
      return;
    }
    const baseCooldown = 1 / Math.max(0.0001, rate);
    if (tower.type === 'alpha' && target.type === 'beta') {
      this.spawnSupplyProjectile(tower, target, { payload: { type: 'alpha' } });
      tower.cooldown = baseCooldown;
      return;
    }
    if (tower.type === 'beta' && target.type === 'gamma') {
      const payload = {
        type: 'beta',
        alphaShots: Math.max(0, tower.storedAlphaShots || 0),
      };
      tower.storedAlphaShots = 0;
      tower.storedAlphaSwirl = 0;
      this.spawnSupplyProjectile(tower, target, { payload });
      tower.cooldown = baseCooldown;
      return;
    }
    if (tower.type === 'alpha' && target.type === 'iota') {
      this.spawnSupplyProjectile(tower, target, { payload: { type: 'alpha' } });
      tower.cooldown = baseCooldown;
      return;
    }
    if (tower.type === 'beta' && target.type === 'iota') {
      const payload = {
        type: 'beta',
        alphaShots: Math.max(0, tower.storedAlphaShots || 0),
      };
      tower.storedAlphaShots = 0;
      tower.storedAlphaSwirl = 0;
      this.spawnSupplyProjectile(tower, target, { payload });
      tower.cooldown = baseCooldown;
      return;
    }
    if (tower.type === 'gamma' && target.type === 'iota') {
      const payload = {
        type: 'gamma',
        alphaShots: Math.max(0, tower.storedAlphaShots || 0),
        betaShots: Math.max(0, tower.storedBetaShots || 0),
      };
      tower.storedAlphaShots = 0;
      tower.storedBetaShots = 0;
      tower.storedAlphaSwirl = 0;
      tower.storedBetaSwirl = 0;
      this.spawnSupplyProjectile(tower, target, { payload });
      tower.cooldown = baseCooldown;
      return;
    }
    this.removeTowerConnection(tower.id, target.id);
  }

  /**
   * Advance Delta soldier timers, spawn replacements, and manage cohort AI.
   */
  updateDeltaTower(tower, delta) {
    updateDeltaTowerHelper(this, tower, delta);
  }

  updateEpsilonTower(tower, delta) {
    updateEpsilonTowerHelper(this, tower, delta);
  }

  /**
   * Advance α particle bursts so energy motes stay synchronized with attack timing.
   */
  updateAlphaBursts(delta) {
    updateAlphaBurstsHelper(this, delta);
  }

  /**
   * Advance β particle bursts so exponent beams stay visually coherent.
   */
  updateBetaBursts(delta) {
    updateBetaBurstsHelper(this, delta);
  }

  /**
   * Advance γ particle bursts so piercing lasers animate smoothly.
   */
  updateGammaBursts(delta) {
    updateGammaBurstsHelper(this, delta);
  }

  /**
   * Advance ν particle bursts so kill-tracking lasers animate smoothly.
   */
  updateNuBursts(delta) {
    updateNuBurstsHelper(this, delta);
  }

  /**
   * Advance ζ pendulum physics, maintain trail history, and apply collision damage.
   */
  updateZetaTower(tower, delta) {
    updateZetaTowerHelper(this, tower, delta);
  }

  /**
   * Advance η orbital motion, maintain trails, and trigger alignment lasers.
   */
  updateEtaTower(tower, delta) {
    updateEtaTowerHelper(this, tower, delta);
  }

  /**
   * Emit an η laser and apply damage to enemies along its beam.
   */
  fireEtaLaser(tower, state, { angle = 0, orbitAlign = 2, damage = 0 } = {}) {
    fireEtaLaserHelper(this, tower, state, { angle, orbitAlign, damage });
  }

  /**
   * Apply η laser damage and remove defeated enemies from play.
   */
  applyEtaDamage(enemy, damage) {
    applyEtaDamageHelper(this, enemy, damage);
  }

  /**
   * Apply ζ damage and cleanly remove defeated enemies from the playfield.
   */
  applyZetaDamage(enemy, damage) {
    applyZetaDamageHelper(this, enemy, damage);
  }

  /**
   * Spawn a fresh Delta soldier, optionally primed with a target assignment.
   */
  deployDeltaSoldier(tower, targetInfo = null) {
    deployDeltaSoldierHelper(this, tower, targetInfo);
  }

  findTarget(tower, options = {}) {
    if (!tower) {
      return null;
    }
    const includeSigmaTargets = options.includeSigmaTargets !== false;
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

    const focusedCrystal = this.getFocusedCrystal();
    if (focusedCrystal) {
      const crystalPosition = this.getCrystalPosition(focusedCrystal);
      if (crystalPosition) {
        const crystalDistance = Math.hypot(crystalPosition.x - tower.x, crystalPosition.y - tower.y);
        if (crystalDistance <= tower.range) {
          return { crystal: focusedCrystal, position: crystalPosition };
        }
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
    if (selected) {
      return selected;
    }
    if (includeSigmaTargets) {
      return this.findSigmaFriendlyTarget(tower);
    }
    return null;
  }

  /**
   * Locate the nearest σ lattice within range so idle towers can feed it.
   */
  findSigmaFriendlyTarget(tower) {
    if (!tower || tower.type === 'sigma') {
      return null;
    }
    const range = Number.isFinite(tower.range) ? tower.range : 0;
    if (range <= 0) {
      return null;
    }
    let selected = null;
    let nearest = Infinity;
    this.towers.forEach((candidate) => {
      if (!candidate || candidate.type !== 'sigma' || candidate.id === tower.id) {
        return;
      }
      const distance = Math.hypot(candidate.x - tower.x, candidate.y - tower.y);
      if (distance > range) {
        return;
      }
      if (distance < nearest) {
        selected = { sigma: candidate, position: { x: candidate.x, y: candidate.y } };
        nearest = distance;
      }
    });
    return selected;
  }

  /**
   * Emit a supply mote traveling between linked lattices.
   */
  spawnSupplyProjectile(sourceTower, targetTower, options = {}) {
    if (!sourceTower || !targetTower) {
      return;
    }
    const payload = options.payload || {};
    const sourcePosition = { x: sourceTower.x, y: sourceTower.y };
    const targetPosition = { x: targetTower.x, y: targetTower.y };
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const distance = Math.hypot(dx, dy) || 1;
    const projectile = {
      patternType: 'supply',
      sourceId: sourceTower.id,
      targetTowerId: targetTower.id,
      source: sourcePosition,
      target: targetPosition,
      currentPosition: { ...sourcePosition },
      distance,
      speed: Number.isFinite(options.speed) ? options.speed : 260,
      progress: 0,
      payload,
    };
    projectile.seeds = this.createSupplySeeds(sourcePosition, targetPosition, payload);
    if (payload.type === 'beta') {
      projectile.color = { r: 255, g: 214, b: 112 };
    } else if (payload.type === 'gamma') {
      projectile.color = { r: 180, g: 240, b: 255 };
    } else {
      projectile.color = { r: 255, g: 138, b: 216 };
    }
    this.projectiles.push(projectile);
  }

  /**
   * Apply a delivered supply shot to its destination lattice.
   */
  handleSupplyImpact(projectile) {
    if (!projectile || !projectile.targetTowerId) {
      return;
    }
    const target = this.getTowerById(projectile.targetTowerId);
    if (!target) {
      return;
    }
    const payload = projectile.payload || {};
    if (payload.type === 'alpha') {
      target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + 1);
      target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + 3);
      this.transferSupplySeedsToOrbit(target, projectile);
      return;
    }
    if (payload.type === 'beta') {
      target.storedBetaShots = Math.min(999, (target.storedBetaShots || 0) + 1);
      target.storedBetaSwirl = Math.min(30, (target.storedBetaSwirl || 0) + 3);
      const alphaShots = Math.max(0, payload.alphaShots || 0);
      if (alphaShots > 0) {
        target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + alphaShots);
        target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + alphaShots * 3);
      }
      this.transferSupplySeedsToOrbit(target, projectile);
      return;
    }
    if (payload.type === 'gamma') {
      target.storedGammaShots = Math.min(999, (target.storedGammaShots || 0) + 1);
      const betaShots = Math.max(0, payload.betaShots || 0);
      if (betaShots > 0) {
        target.storedBetaShots = Math.min(999, (target.storedBetaShots || 0) + betaShots);
        target.storedBetaSwirl = Math.min(30, (target.storedBetaSwirl || 0) + betaShots * 3);
      }
      const alphaShots = Math.max(0, payload.alphaShots || 0);
      if (alphaShots > 0) {
        target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + alphaShots);
        target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + alphaShots * 3);
      }
      this.transferSupplySeedsToOrbit(target, projectile);
    }
  }

  resolveTowerShotDamage(tower) {
    if (!tower) {
      return 0;
    }
    let damage = Number.isFinite(tower.damage) ? tower.damage : 0;
    if (tower.type === 'sigma') {
      return resolveSigmaShotDamageHelper(this, tower);
    }
    if (tower.type === 'beta') {
      const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
      if (alphaShots > 0) {
        const alphaValue = calculateTowerEquationResult('alpha');
        damage += alphaValue * alphaShots;
        const swirlCount = Math.max(0, Math.floor(tower.storedAlphaSwirl || alphaShots * 3));
        this.queueTowerSwirlLaunch(tower, 'alpha', swirlCount);
        tower.storedAlphaShots = 0;
        tower.storedAlphaSwirl = 0;
      }
    } else if (tower.type === 'gamma') {
      const betaShots = Math.max(0, tower.storedBetaShots || 0);
      const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
      if (betaShots > 0 || alphaShots > 0) {
        const betaValue = calculateTowerEquationResult('beta');
        const alphaValue = calculateTowerEquationResult('alpha');
        damage += betaValue * betaShots + alphaValue * alphaShots;
        const betaSwirlCount = Math.max(0, Math.floor(tower.storedBetaSwirl || betaShots * 3));
        const alphaSwirlCount = Math.max(0, Math.floor(tower.storedAlphaSwirl || alphaShots * 3));
        this.queueTowerSwirlLaunch(tower, 'beta', betaSwirlCount);
        this.queueTowerSwirlLaunch(tower, 'alpha', alphaSwirlCount);
        tower.storedBetaShots = 0;
        tower.storedAlphaShots = 0;
        tower.storedBetaSwirl = 0;
        tower.storedAlphaSwirl = 0;
      }
    } else if (tower.type === 'iota') {
      const betaShots = Math.max(0, tower.storedBetaShots || 0);
      const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
      if (betaShots > 0 || alphaShots > 0) {
        const betaValue = calculateTowerEquationResult('beta');
        const alphaValue = calculateTowerEquationResult('alpha');
        damage += betaValue * betaShots + alphaValue * alphaShots;
        tower.storedBetaShots = 0;
        tower.storedAlphaShots = 0;
        tower.storedBetaSwirl = 0;
        tower.storedAlphaSwirl = 0;
      }
      const gammaBonus = collectIotaChargeBonusHelper(tower);
      if (gammaBonus > 0) {
        damage += gammaBonus;
      }
    }
    return damage;
  }

  computeEnemyDamageMultiplier(enemy) {
    if (!enemy) {
      return 1;
    }
    let additive = 0;
    if (enemy.damageAmplifiers instanceof Map) {
      enemy.damageAmplifiers.forEach((effect) => {
        if (!effect) {
          return;
        }
        const strength = Number.isFinite(effect.strength) ? Math.max(0, effect.strength) : 0;
        additive += strength;
      });
    }
    return Math.max(0, 1 + additive);
  }

  applyDamageToEnemy(enemy, baseDamage, { sourceTower } = {}) {
    if (!enemy || !Number.isFinite(baseDamage) || baseDamage <= 0) {
      return 0;
    }
    const multiplier = this.computeEnemyDamageMultiplier(enemy);
    const applied = baseDamage * multiplier;
    const hpBefore = Number.isFinite(enemy.hp) ? enemy.hp : 0;
    if (Number.isFinite(enemy.hp)) {
      enemy.hp -= applied;
    } else {
      enemy.hp = -applied;
    }
    if (sourceTower) {
      this.recordDamageEvent({ tower: sourceTower, enemy, damage: applied });
    }
    this.spawnDamageNumber(enemy, applied, { sourceTower });
    // Capture the hit vector so the swirl renderer can push particles along the impact path.
    const sourcePosition =
      sourceTower && Number.isFinite(sourceTower.x) && Number.isFinite(sourceTower.y)
        ? { x: sourceTower.x, y: sourceTower.y }
        : null;
    this.recordEnemySwirlImpact(enemy, { sourcePosition, damageApplied: applied, enemyHpBefore: hpBefore });
    if (enemy.hp <= 0) {
      // Track kill and overkill damage for Nu towers
      if (sourceTower && sourceTower.type === 'nu') {
        const overkillDamage = Math.max(0, applied - hpBefore);
        trackNuKillHelper(sourceTower, overkillDamage);

        // Spawn kill particle at enemy position
        const enemyPos = this.getEnemyPosition(enemy);
        if (enemyPos) {
          spawnNuKillParticleHelper(this, sourceTower, enemyPos);
        }
      }
      if (sourceTower) {
        this.recordKillEvent(sourceTower);
      }
      this.processEnemyDefeat(enemy);
    }
    return applied;
  }

  emitTowerAttackVisuals(tower, targetInfo = {}) {
    if (!tower) {
      return;
    }
    const enemy = targetInfo.enemy || null;
    const crystal = targetInfo.crystal || null;
    const effectPosition =
      targetInfo.position ||
      (enemy ? this.getEnemyPosition(enemy) : crystal ? this.getCrystalPosition(crystal) : null);
    if (tower.type === 'alpha') {
      this.spawnAlphaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    } else if (tower.type === 'beta') {
      this.spawnBetaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    } else if (tower.type === 'gamma') {
      this.spawnGammaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    } else if (tower.type === 'nu') {
      this.spawnNuAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    } else {
      this.projectiles.push({
        source: { x: tower.x, y: tower.y },
        targetId: enemy ? enemy.id : null,
        targetCrystalId: crystal ? crystal.id : null,
        target: effectPosition,
        lifetime: 0,
        maxLifetime: 0.24,
      });
    }
    if ((tower.type === 'beta' || tower.type === 'gamma' || tower.type === 'nu')) {
      this.triggerQueuedSwirlLaunches(tower, effectPosition);
    }
    if (getTowerTierValue(tower) >= 24) {
      this.spawnOmegaWave(tower);
    }
    if (this.audio) {
      this.audio.playSfx('alphaTowerFire');
    }
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
    if (tower.type === 'xi') {
      this.fireXiChain(tower, targetInfo);
      return;
    }
    if (tower.type === 'iota') {
      this.fireIotaPulse(tower, targetInfo);
      return;
    }
    if (!targetInfo) {
      return;
    }
    const enemy = targetInfo.enemy || null;
    const crystal = targetInfo.crystal || null;
    const sigmaTower = targetInfo.sigma || null;
    const attackPosition =
      targetInfo.position ||
      (enemy
        ? this.getEnemyPosition(enemy)
        : crystal
        ? this.getCrystalPosition(crystal)
        : sigmaTower
        ? { x: sigmaTower.x, y: sigmaTower.y }
        : null);
    const damage = this.resolveTowerShotDamage(tower);
    if (crystal) {
      this.emitTowerAttackVisuals(tower, { crystal, position: attackPosition });
      this.applyCrystalHit(crystal, damage, { position: attackPosition });
      return;
    }
    if (sigmaTower) {
      this.absorbSigmaDamage(sigmaTower, damage, { sourceTower: tower });
      this.emitTowerAttackVisuals(tower, { position: attackPosition });
      return;
    }
    if (!enemy) {
      return;
    }
    this.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
    this.emitTowerAttackVisuals(tower, { enemy, position: attackPosition });
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
      this.applyDamageToEnemy(enemy, totalDamage, { sourceTower: tower });
      this.projectiles.push({
        source: { ...origin },
        targetId: enemy.id,
        target: target.position,
        lifetime: 0,
        maxLifetime: 0.24,
      });
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

  resolveEnemySlowMultiplier(enemy) {
    if (!enemy) {
      return 1;
    }
    const slowEffects = enemy.slowEffects;
    if (slowEffects instanceof Map) {
      let multiplier = 1;
      const stale = [];
      slowEffects.forEach((effect, key) => {
        if (!effect || !Number.isFinite(effect.multiplier)) {
          stale.push(key);
          return;
        }
        const clamped = Math.max(0, Math.min(1, effect.multiplier));
        multiplier = Math.min(multiplier, clamped);
      });
      stale.forEach((key) => slowEffects.delete(key));
      if (slowEffects.size === 0) {
        delete enemy.slowEffects;
      }
      return multiplier;
    }
    if (!slowEffects || typeof slowEffects !== 'object') {
      return 1;
    }
    let multiplier = 1;
    Object.keys(slowEffects).forEach((key) => {
      const effect = slowEffects[key];
      if (!effect || !Number.isFinite(effect.multiplier)) {
        delete slowEffects[key];
        return;
      }
      const clamped = Math.max(0, Math.min(1, effect.multiplier));
      multiplier = Math.min(multiplier, clamped);
    });
    if (!Object.keys(slowEffects).length) {
      delete enemy.slowEffects;
    }
    return multiplier;
  }

  clearEnemySlowEffects(enemy) {
    if (!enemy) {
      return;
    }
    const slowEffects = enemy.slowEffects;
    if (slowEffects instanceof Map) {
      slowEffects.forEach((_, towerId) => {
        const tower = this.getTowerById(towerId);
        if (tower?.thetaState?.enemyTimers instanceof Map) {
          tower.thetaState.enemyTimers.delete(enemy.id);
        }
      });
      slowEffects.clear();
    } else if (slowEffects && typeof slowEffects === 'object') {
      Object.keys(slowEffects).forEach((towerId) => {
        const tower = this.getTowerById(towerId);
        if (tower?.thetaState?.enemyTimers instanceof Map) {
          tower.thetaState.enemyTimers.delete(enemy.id);
        }
      });
    }
    delete enemy.slowEffects;
  }

  clearEnemyDamageAmplifiers(enemy) {
    if (!enemy) {
      return;
    }
    if (enemy.damageAmplifiers instanceof Map) {
      enemy.damageAmplifiers.clear();
    } else if (enemy.damageAmplifiers && typeof enemy.damageAmplifiers === 'object') {
      Object.keys(enemy.damageAmplifiers).forEach((key) => {
        delete enemy.damageAmplifiers[key];
      });
    }
    delete enemy.damageAmplifiers;
    delete enemy.iotaInversionTimer;
  }

  updateEnemies(delta) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (!Number.isFinite(enemy.baseSpeed)) {
        enemy.baseSpeed = Number.isFinite(enemy.speed) ? enemy.speed : 0;
      }
      if (enemy.damageAmplifiers instanceof Map) {
        const expired = [];
        enemy.damageAmplifiers.forEach((effect, key) => {
          if (!effect) {
            expired.push(key);
            return;
          }
          if (Number.isFinite(effect.remaining)) {
            effect.remaining -= delta;
            if (effect.remaining <= 0) {
              expired.push(key);
            }
          }
        });
        expired.forEach((key) => enemy.damageAmplifiers.delete(key));
        if (enemy.damageAmplifiers.size === 0) {
          delete enemy.damageAmplifiers;
        }
      }
      if (Number.isFinite(enemy.iotaInversionTimer)) {
        enemy.iotaInversionTimer = Math.max(0, enemy.iotaInversionTimer - delta);
        if (enemy.iotaInversionTimer <= 0) {
          delete enemy.iotaInversionTimer;
        }
      }
      const baseSpeed = Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : 0;
      const speedMultiplier = this.resolveEnemySlowMultiplier(enemy);
      const effectiveSpeed = Math.max(0, baseSpeed * speedMultiplier);
      enemy.speed = effectiveSpeed;
      enemy.progress += enemy.speed * delta;
      if (enemy.progress >= 1) {
        this.clearEnemySlowEffects(enemy);
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
    // Compute squared distance from a point to a line segment so we can catch fast projectiles that would otherwise tunnel past an enemy between frames.
    const distanceSquaredToSegment = (point, start, end) => {
      if (!point || !start || !end) {
        return Infinity;
      }
      const abx = end.x - start.x;
      const aby = end.y - start.y;
      const abLengthSquared = abx * abx + aby * aby;
      if (abLengthSquared <= 0) {
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        return dx * dx + dy * dy;
      }
      const apx = point.x - start.x;
      const apy = point.y - start.y;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLengthSquared));
      const closestX = start.x + abx * t;
      const closestY = start.y + aby * t;
      const dx = point.x - closestX;
      const dy = point.y - closestY;
      return dx * dx + dy * dy;
    };

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.lifetime += delta;

      if (projectile.patternType === 'supply') {
        const distance = Number.isFinite(projectile.distance) ? Math.max(1, projectile.distance) : 1;
        const speed = Number.isFinite(projectile.speed) ? Math.max(10, projectile.speed) : 260;
        const increment = (speed * delta) / distance;
        projectile.progress = (projectile.progress || 0) + increment;
        if (projectile.source && projectile.target) {
          const clamped = Math.min(1, projectile.progress || 0);
          projectile.currentPosition = {
            x: projectile.source.x + (projectile.target.x - projectile.source.x) * clamped,
            y: projectile.source.y + (projectile.target.y - projectile.source.y) * clamped,
          };
          this.updateSupplySeeds(projectile);
        }
        if (projectile.progress >= 1) {
          this.handleSupplyImpact(projectile);
          this.projectiles.splice(index, 1);
        }
        continue;
      }

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

      if (projectile.patternType === 'etaLaser') {
        const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.18;
        if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
          this.projectiles.splice(index, 1);
          continue;
        }
        const progress = maxLifetime > 0 ? projectile.lifetime / maxLifetime : 1;
        projectile.alpha = Math.max(0, 1 - progress);
        continue;
      }

      if (projectile.patternType === 'iotaPulse') {
        const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.32;
        if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
          this.projectiles.splice(index, 1);
        }
        continue;
      }

      if (projectile.patternType === 'epsilonNeedle') {
        // Extend the lifetime window when a needle embeds itself in a target.
        const recordedLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 3.5;
        let allowedLifetime = recordedLifetime;
        if (projectile.attachedToEnemyId) {
          const attachStart = Number.isFinite(projectile.attachStartTime)
            ? projectile.attachStartTime
            : (projectile.attachStartTime = projectile.lifetime);
          const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
          const extendedLifetime = attachStart + stickDuration;
          if (!Number.isFinite(projectile.maxLifetime) || projectile.maxLifetime < extendedLifetime) {
            projectile.maxLifetime = extendedLifetime;
          }
          allowedLifetime = projectile.maxLifetime;
        }
        if (allowedLifetime > 0 && projectile.lifetime >= allowedLifetime) {
          this.projectiles.splice(index, 1);
          continue;
        }

        const targetEnemyId = projectile.attachedToEnemyId || projectile.enemyId;
        const enemy = this.enemies.find((candidate) => candidate && candidate.id === targetEnemyId);
        if (!enemy) {
          this.projectiles.splice(index, 1);
          continue;
        }
        const position = this.getEnemyPosition(enemy);
        if (!position) {
          this.projectiles.splice(index, 1);
          continue;
        }

        if (projectile.attachedToEnemyId) {
          // Stick to the enemy and drift with its movement while fading out.
          const offset = projectile.attachOffset || { x: 0, y: 0 };
          const previous = projectile.position
            ? { ...projectile.position }
            : { x: position.x + offset.x, y: position.y + offset.y };
          projectile.previousPosition = previous;
          projectile.position = { x: position.x + offset.x, y: position.y + offset.y };
          projectile.velocity = { x: 0, y: 0 };
          const attachStart = Number.isFinite(projectile.attachStartTime)
            ? projectile.attachStartTime
            : (projectile.attachStartTime = projectile.lifetime);
          const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
          const elapsed = Math.max(0, projectile.lifetime - attachStart);
          const progress = stickDuration > 0 ? Math.min(1, elapsed / stickDuration) : 1;
          projectile.alpha = Math.max(0, 1 - progress);
          if (elapsed >= stickDuration) {
            this.projectiles.splice(index, 1);
          }
          continue;
        }

        const px = projectile.position?.x ?? projectile.origin?.x ?? 0;
        const py = projectile.position?.y ?? projectile.origin?.y ?? 0;
        const dx = position.x - px;
        const dy = position.y - py;
        const distance = Math.hypot(dx, dy) || 1;
        const nx = dx / distance;
        const ny = dy / distance;
        const speed = Math.max(60, Number.isFinite(projectile.speed) ? projectile.speed : 280);
        const vx = projectile.velocity?.x ?? nx * speed;
        const vy = projectile.velocity?.y ?? ny * speed;
        // steer towards target
        const desiredVx = nx * speed;
        const desiredVy = ny * speed;
        const dvx = desiredVx - vx;
        const dvy = desiredVy - vy;
        const dmag = Math.hypot(dvx, dvy);
        const maxTurn =
          Math.max(0, Number.isFinite(projectile.turnRate) ? projectile.turnRate : Math.PI * 2) * delta * speed /
          Math.max(1, speed);
        let nextVx = vx;
        let nextVy = vy;
        if (dmag > maxTurn && dmag > 0) {
          const blend = maxTurn / dmag;
          nextVx = vx + dvx * blend;
          nextVy = vy + dvy * blend;
        } else {
          nextVx = desiredVx;
          nextVy = desiredVy;
        }
        const stepX = nextVx * delta;
        const stepY = nextVy * delta;
        projectile.previousPosition = { x: px, y: py };
        projectile.position = { x: px + stepX, y: py + stepY };
        projectile.velocity = { x: nextVx, y: nextVy };

        // collision with enemy
        const metrics = this.getEnemyVisualMetrics(enemy);
        const enemyRadius = this.getEnemyHitRadius(enemy, metrics);
        const hitRadius = Math.max(2, Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : 6);
        const combinedRadius = enemyRadius + hitRadius;
        const currentSeparation = Math.hypot(projectile.position.x - position.x, projectile.position.y - position.y);
        let didHit = currentSeparation <= combinedRadius;

        if (!didHit) {
          const previous = projectile.previousPosition || { x: px, y: py };
          const segmentDistanceSquared = distanceSquaredToSegment(position, previous, projectile.position);
          if (segmentDistanceSquared <= combinedRadius * combinedRadius) {
            didHit = true;
          }
        }

        if (didHit) {
          // find source tower for stacking
          const tower = this.towers.find((t) => t && t.id === projectile.towerId);
          let stacks = 0;
          if (tower) {
            stacks = applyEpsilonHitHelper(this, tower, enemy.id) || 0;
          }
          // Atk = (NumHits)^2, where stacks is NumHits after applying this hit
          const totalDamage = Math.max(0, stacks * stacks);
          this.applyDamageToEnemy(enemy, totalDamage, { sourceTower: tower || null });
          const enemyStillActive = this.enemies.some((candidate) => candidate && candidate.id === enemy.id);
          if (!enemyStillActive) {
            this.projectiles.splice(index, 1);
            continue;
          }
          // Convert the projectile into an embedded thorn instead of despawning immediately.
          projectile.attachedToEnemyId = enemy.id;
          projectile.attachOffset = {
            x: projectile.position.x - position.x,
            y: projectile.position.y - position.y,
          };
          projectile.attachStartTime = projectile.lifetime;
          const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
          projectile.maxLifetime = projectile.attachStartTime + stickDuration;
          projectile.alpha = 1;
          projectile.velocity = { x: 0, y: 0 };
          continue;
        }
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
      id: tower.id,
      type: tower.type,
      normalized: this.cloneNormalizedPoint(tower.normalized),
      targetPriority: tower.targetPriority || 'first',
      behaviorMode: tower.behaviorMode || null,
      // Preserve η lattice progression so restored checkpoints maintain unlocked rings and prestige state.
      etaPrime: tower.type === 'eta' && Number.isFinite(tower.etaPrime) ? tower.etaPrime : null,
      isPrestigeEta: tower.type === 'eta' ? Boolean(tower.isPrestigeEta) : null,
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
      linkTargetId: tower.linkTargetId || null,
      linkSources: tower.linkSources instanceof Set ? Array.from(tower.linkSources) : [],
      storedAlphaShots: Number.isFinite(tower.storedAlphaShots) ? tower.storedAlphaShots : 0,
      storedBetaShots: Number.isFinite(tower.storedBetaShots) ? tower.storedBetaShots : 0,
      storedAlphaSwirl: Number.isFinite(tower.storedAlphaSwirl) ? tower.storedAlphaSwirl : 0,
      storedBetaSwirl: Number.isFinite(tower.storedBetaSwirl) ? tower.storedBetaSwirl : 0,
      storedGammaShots: Number.isFinite(tower.storedGammaShots) ? tower.storedGammaShots : 0,
      sigmaStoredDamage:
        tower.type === 'sigma' && Number.isFinite(tower.sigmaState?.storedDamage)
          ? tower.sigmaState.storedDamage
          : null,
      sigmaTotalAbsorbed:
        tower.type === 'sigma' && Number.isFinite(tower.sigmaState?.totalAbsorbed)
          ? tower.sigmaState.totalAbsorbed
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
    this.towerConnectionMap.clear();
    this.towerConnectionSources.clear();
    this.connectionEffects = [];
    this.clearConnectionDragState();
    this.slots.forEach((slot) => {
      slot.tower = null;
      if (slot.button) {
        slot.button.classList.remove('tower-built');
        slot.button.setAttribute('aria-pressed', 'false');
      }
    });
    this.towerIdCounter = 0;

    const restoredTowerMap = new Map();

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
      let towerId = typeof snapshot.id === 'string' && snapshot.id.trim() ? snapshot.id.trim() : null;
      if (towerId) {
        const match = towerId.match(/tower-(\d+)/);
        if (match) {
          const numeric = Number(match[1]);
          if (Number.isFinite(numeric)) {
            this.towerIdCounter = Math.max(this.towerIdCounter, numeric);
          }
        }
      } else {
        this.towerIdCounter += 1;
        towerId = `tower-${this.towerIdCounter}`;
      }
      const tower = {
        id: towerId,
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
      tower.linkTargetId = null;
      tower.linkSources = new Set();
      tower.storedAlphaShots = 0;
      tower.storedBetaShots = 0;
      tower.storedAlphaSwirl = 0;
      tower.storedBetaSwirl = 0;
      tower.storedGammaShots = 0;
      tower.connectionParticles = [];
      if (Number.isFinite(snapshot.storedAlphaShots)) {
        tower.storedAlphaShots = Math.max(0, Math.floor(snapshot.storedAlphaShots));
      }
      if (Number.isFinite(snapshot.storedBetaShots)) {
        tower.storedBetaShots = Math.max(0, Math.floor(snapshot.storedBetaShots));
      }
      if (Number.isFinite(snapshot.storedAlphaSwirl)) {
        tower.storedAlphaSwirl = Math.max(0, Math.floor(snapshot.storedAlphaSwirl));
      }
      if (Number.isFinite(snapshot.storedBetaSwirl)) {
        tower.storedBetaSwirl = Math.max(0, Math.floor(snapshot.storedBetaSwirl));
      }
      if (Number.isFinite(snapshot.storedGammaShots)) {
        tower.storedGammaShots = Math.max(0, Math.floor(snapshot.storedGammaShots));
      }
      if (tower.type === 'eta') {
        // Restore η lattice metadata before behavior defaults so orbital rings rebuild with the correct configuration.
        const rawPrime = Number.isFinite(snapshot.etaPrime) ? snapshot.etaPrime : 0;
        tower.etaPrime = Math.max(0, Math.min(rawPrime, ETA_MAX_PRESTIGE_MERGES));
        tower.isPrestigeEta = snapshot.isPrestigeEta ? true : tower.etaPrime >= ETA_MAX_PRESTIGE_MERGES;
      }
      if (tower.type === 'sigma') {
        const sigmaState = this.ensureSigmaState(tower);
        if (sigmaState) {
          sigmaState.storedDamage = 0;
          sigmaState.totalAbsorbed = 0;
          const restoredDamage = Number.isFinite(snapshot.sigmaStoredDamage)
            ? Math.max(0, snapshot.sigmaStoredDamage)
            : 0;
          if (restoredDamage > 0) {
            absorbSigmaDamageHelper(this, tower, restoredDamage);
          }
          if (Number.isFinite(snapshot.sigmaTotalAbsorbed)) {
            sigmaState.totalAbsorbed = Math.max(
              sigmaState.totalAbsorbed,
              Math.max(0, snapshot.sigmaTotalAbsorbed),
            );
          }
          tower.damage = sigmaState.storedDamage;
          tower.baseDamage = sigmaState.storedDamage;
        }
      }
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
      restoredTowerMap.set(tower.id, tower);
      this.handleAlephTowerAdded(tower);
    });

    snapshots.forEach((snapshot) => {
      if (!snapshot || !snapshot.id || !snapshot.linkTargetId) {
        return;
      }
      const source = restoredTowerMap.get(snapshot.id);
      const target = restoredTowerMap.get(snapshot.linkTargetId);
      if (source && target) {
        this.addTowerConnection(source, target);
      }
    });

    snapshots.forEach((snapshot) => {
      if (!snapshot || !snapshot.id || !Array.isArray(snapshot.linkSources)) {
        return;
      }
      const target = restoredTowerMap.get(snapshot.id);
      if (!target) {
        return;
      }
      snapshot.linkSources.forEach((sourceId) => {
        const source = restoredTowerMap.get(sourceId);
        if (source && source !== target) {
          this.addTowerConnection(source, target);
        }
      });
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
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
    this.nuBursts = [];
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

    // Surface end-of-wave tallies before the next wave (or victory) begins.
    this.spawnWaveCompletionTallies();

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
        // Refresh the queue previews so the endless cycle rollover is reflected immediately.
        this.scheduleStatsPanelRefresh();
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
    // Update wave previews for the newly activated wave.
    this.scheduleStatsPanelRefresh();
  }

  handleEnemyBreach(enemy) {
    this.clearEnemySlowEffects(enemy);
    this.clearEnemyDamageAmplifiers(enemy);
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
    // Ensure the queue updates once the breached enemy is removed.
    this.scheduleStatsPanelRefresh();
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
    const defeatPosition = this.getEnemyPosition(enemy);
    this.tryConvertEnemyToChiThrall(enemy, { position: defeatPosition });
    this.captureEnemyHistory(enemy);
    this.clearEnemySlowEffects(enemy);
    this.clearEnemyDamageAmplifiers(enemy);
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
      const gainLabel = formatCombatNumber(baseGain);
      this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${gainLabel} ${this.theroSymbol}.`;
    }
    this.updateHud();
    this.updateProgress();
    this.dependencies.updateStatusDisplays();

    if (this.audio) {
      this.audio.playSfx('enemyDefeat');
    }

    this.spawnMoteGemFromEnemy(enemy);

    this.dependencies.notifyEnemyDefeated();
    // Remove the defeated enemy from the live lists immediately.
    this.scheduleStatsPanelRefresh();
  }

  handleVictory() {
    if (this.resolvedOutcome === 'victory') {
      return;
    }
    if (this.audio) {
      this.audio.playSfx('victory');
    }
    this.combatActive = false;
    this.stopCombatStatsSession();
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
    this.stopCombatStatsSession();
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
    return HudBindings.updateHud.call(this);
  }

  updateProgress() {
    return HudBindings.updateProgress.call(this);
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
    const width =
      this.renderWidth ||
      (this.canvas ? this.canvas.clientWidth || this.canvas.width || 0 : 0);
    const height =
      this.renderHeight ||
      (this.canvas ? this.canvas.clientHeight || this.canvas.height || 0 : 0);
    const minDimension = width && height ? Math.min(width, height) : 0;
    const marginPixels =
      minDimension > 0 && PLAYFIELD_VIEW_PAN_MARGIN_METERS > 0
        ? metersToPixels(PLAYFIELD_VIEW_PAN_MARGIN_METERS, minDimension)
        : 0;
    const marginNormalizedX = width > 0 ? Math.max(0, marginPixels / width) : 0;
    const marginNormalizedY = height > 0 ? Math.max(0, marginPixels / height) : 0;
    const clamp = (value, min, max) => {
      if (min > max) {
        return 0.5;
      }
      return Math.min(Math.max(value, min), max);
    };
    return {
      x: clamp(normalized.x, halfWidth - marginNormalizedX, 1 - halfWidth + marginNormalizedX),
      y: clamp(normalized.y, halfHeight - marginNormalizedY, 1 - halfHeight + marginNormalizedY),
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
    return CanvasRenderer.draw.call(this);
  }

  drawFloaters() {
    return CanvasRenderer.drawFloaters.call(this);
  }

  // Render each mote gem using its sprite when available so drops mirror the inventory art.
  drawMoteGems() {
    return CanvasRenderer.drawMoteGems.call(this);
  }

  drawPath() {
    return CanvasRenderer.drawPath.call(this);
  }

  drawArcLight() {
    return CanvasRenderer.drawArcLight.call(this);
  }

  drawDeltaCommandPreview() {
    return CanvasRenderer.drawDeltaCommandPreview.call(this);
  }

  // Render the enemy spawn gate using the dedicated sprite with a fallback glyph ring.
  drawEnemyGateSymbol(ctx, position) {
    return CanvasRenderer.drawEnemyGateSymbol.call(this, ctx, position);
  }

  drawMindGateSymbol(ctx, position) {
    return CanvasRenderer.drawMindGateSymbol.call(this, ctx, position);
  }

  drawNodes() {
    return CanvasRenderer.drawNodes.call(this);
  }

  drawChiThralls() {
    return CanvasRenderer.drawChiThralls.call(this);
  }

  drawChiLightTrails() {
    return CanvasRenderer.drawChiLightTrails.call(this);
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
    return CanvasRenderer.drawDeveloperPathMarkers.call(this);
  }

  // Render developer crystals and their shard debris above the lane.
  drawDeveloperCrystals() {
    return CanvasRenderer.drawDeveloperCrystals.call(this);
  }

  drawPlacementPreview() {
    return CanvasRenderer.drawPlacementPreview.call(this);
  }

  drawTowers() {
    return CanvasRenderer.drawTowers.call(this);
  }

  /**
   * Render ζ pendulum arms and trails so the battlefield reflects their orbit.
   */
  drawZetaPendulums(tower) {
    return CanvasRenderer.drawZetaPendulums.call(this, tower);
  }

  /**
   * Render η orbital rings and trailing motes for the planetary lattice.
   */
  drawEtaOrbits(tower) {
    return CanvasRenderer.drawEtaOrbits.call(this, tower);
  }

  /**
   * Render the roaming Delta soldiers as luminous triangles circling the battlefield.
   */
  drawDeltaSoldiers() {
    return CanvasRenderer.drawDeltaSoldiers.call(this);
  }

  /**
   * Render the Omicron soldier units as equilateral triangles with swirling shield particles.
   */
  drawOmicronUnits() {
    return CanvasRenderer.drawOmicronUnits.call(this);
  }

  drawEnemies() {
    return CanvasRenderer.drawEnemies.call(this);
  }

  drawDamageNumbers() {
    return CanvasRenderer.drawDamageNumbers.call(this);
  }

  drawWaveTallies() {
    return CanvasRenderer.drawWaveTallies.call(this);
  }

  drawProjectiles() {
    return CanvasRenderer.drawProjectiles.call(this);
  }

  /**
   * Render α particle bursts as soft-glow motes swirling around the lattice.
   */
  drawAlphaBursts() {
    return CanvasRenderer.drawAlphaBursts.call(this);
  }

  /**
   * Render β particle bursts to visualize mirrored exponential energy.
   */
  drawBetaBursts() {
    return CanvasRenderer.drawBetaBursts.call(this);
  }

  /**
   * Render γ particle bursts so piercing lasers remain visible in combat.
   */
  drawGammaBursts() {
    return CanvasRenderer.drawGammaBursts.call(this);
  }

  drawNuBursts() {
    return CanvasRenderer.drawNuBursts.call(this);
  }

  /**
   * Paint the active radial tower command menu around the selected lattice.
   */
  drawTowerMenu() {
    return CanvasRenderer.drawTowerMenu.call(this);
  }
}

Object.assign(SimplePlayfield.prototype, DeveloperCrystalManager);

Object.assign(SimplePlayfield.prototype, {
  determinePreferredOrientation,
  setPreferredOrientation,
  applyContainerOrientationClass,
  cloneNormalizedPoint,
  rotateNormalizedPointClockwise,
  applyLevelOrientation,
});
