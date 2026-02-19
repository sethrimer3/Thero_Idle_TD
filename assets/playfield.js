// Playfield gameplay class extracted from the main bundle for reuse across entry points.
import {
  calculateInfinityExponent,
  getInfinityRange,
  getTowersInInfinityRange,
  applyInfinityBonus,
  INFINITY_PARTICLE_CONFIG,
} from '../scripts/features/towers/infinityTower.js';
import { convertMathExpressionToPlainText } from '../scripts/core/mathText.js';
import {
  playTowerPlacementNotes,
  playTowerFireSound,
} from './audioSystem.js';
import {
  getTowerDefinition,
  getNextTowerId,
  getPreviousTowerId,
  getTowerDefinitions,
  isTowerUnlocked,
  isTowerPlaceable,
  refreshTowerLoadoutDisplay,
  cancelTowerDrag,
  getTowerEquationBlueprint,
  getTowerLoadoutState,
  openTowerUpgradeOverlay,
  calculateTowerEquationResult,
  computeTowerVariableValue,
  unlockTower,
} from './towersTab.js';
import {
  moteGemState,
  collectMoteGemDrop,
  spawnMoteGemDrop,
  resetActiveMoteGems,
  resolveEnemyGemDropMultiplier,
  getGemSpriteImage,
  updateGemSuctionAnimations,
  assignRandomShell,
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
import { areDamageNumbersEnabled, getDamageNumberMode, DAMAGE_NUMBER_MODES, getFrameRateLimit, updateFpsCounter } from './preferences.js';
import * as CanvasRenderer from './playfield/render/CanvasRenderer.js';
import { getCrystallineMosaicManager } from './playfield/render/CrystallineMosaic.js';
import { createRenderCoordinator } from './playfield/render/RenderCoordinator.js';
import {
  PLAYFIELD_VIEW_DRAG_THRESHOLD,
  PLAYFIELD_VIEW_PAN_MARGIN_METERS,
} from './playfield/constants.js';
import * as InputController from './playfield/input/InputController.js';
import * as GestureController from './playfield/input/GestureController.js';
import { TOWER_HOLD_ACTIVATION_MS } from './playfield/input/GestureController.js';
import * as FloaterSystem from './playfield/systems/FloaterSystem.js';
import * as BackgroundSwimmerSystem from './playfield/systems/BackgroundSwimmerSystem.js';
import * as ProjectileUpdateSystem from './playfield/systems/ProjectileUpdateSystem.js';
import * as VisualEffectsSystem from './playfield/systems/VisualEffectsSystem.js';
import * as PathGeometrySystem from './playfield/systems/PathGeometrySystem.js';
import { createConnectionSystem } from './playfield/systems/ConnectionSystem.js';
import * as HudBindings from './playfield/ui/HudBindings.js';
import { WaveTallyOverlayManager } from './playfield/ui/WaveTallyOverlays.js';
import * as TowerSelectionWheel from './playfield/ui/TowerSelectionWheel.js';
import { createFloatingFeedbackController } from './playfield/ui/FloatingFeedback.js';
import * as TowerManager from './playfield/managers/TowerManager.js';
import { createCombatStateManager } from './playfield/managers/CombatStateManager.js';
import { createCombatStatsManager } from './playfield/managers/CombatStatsManager.js';
import { createLevelLifecycleManager } from './playfield/managers/LevelLifecycleManager.js';
import { createTowerOrchestrationController } from './playfield/controllers/TowerOrchestrationController.js';
import { createDeveloperToolsService } from './playfield/services/DeveloperToolsService.js';
import { createWaveUIFormatter } from './playfield/ui/WaveUIFormatter.js';
import { createTowerMenuSystem } from './playfield/ui/TowerMenuSystem.js';
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
// Offset radial spawns beyond the playfield so they begin off-screen even at max zoom out.
const RADIAL_SPAWN_OFFSCREEN_MARGIN = 0.08;
import {
  updateAlphaBursts as updateAlphaBurstsHelper,
} from '../scripts/features/towers/alphaTower.js';
import {
  updateBetaBursts as updateBetaBurstsHelper,
} from '../scripts/features/towers/betaTower.js';
import {
  updateGammaBursts as updateGammaBurstsHelper,
} from '../scripts/features/towers/gammaTower.js';
import {
  getKappaPreviewParameters as getKappaPreviewParametersHelper,
  updateKappaTower as updateKappaTowerHelper,
} from '../scripts/features/towers/kappaTower.js';
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
  clearNuCachedDimensions as clearNuCachedDimensionsHelper,
  applyNuPiercingDamage as applyNuPiercingDamageHelper,
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
import {
  ensureTauState as ensureTauStateHelper,
  updateTauTower as updateTauTowerHelper,
  spawnTauProjectile as spawnTauProjectileHelper,
  teardownTauTower as teardownTauTowerHelper,
} from '../scripts/features/towers/tauTower.js';
import {
  ensureUpsilonState as ensureUpsilonStateHelper,
  teardownUpsilonTower as teardownUpsilonTowerHelper,
  updateUpsilonTower as updateUpsilonTowerHelper,
} from '../scripts/features/towers/upsilonTower.js';
import {
  ensurePhiState as ensurePhiStateHelper,
  updatePhiTower as updatePhiTowerHelper,
  teardownPhiTower as teardownPhiTowerHelper,
  triggerPhiBurst as triggerPhiBurstHelper,
} from '../scripts/features/towers/phiTower.js';
import {
  ensurePsiState as ensurePsiStateHelper,
  updatePsiTower as updatePsiTowerHelper,
  teardownPsiTower as teardownPsiTowerHelper,
  triggerPsiClusterAoE as triggerPsiClusterAoEHelper,
} from '../scripts/features/towers/psiTower.js';
import {
  ensureOmegaState as ensureOmegaStateHelper,
  updateOmegaTower as updateOmegaTowerHelper,
  teardownOmegaTower as teardownOmegaTowerHelper,
  drawOmegaParticles as drawOmegaParticlesHelper,
} from '../scripts/features/towers/omegaTower.js';
import {
  getPlayfieldResolutionCap,
  PLAYFIELD_RESOLUTION_EVENT,
} from './playfield/playfieldPreferences.js';

// Limit the backing resolution for the playfield canvas to keep GPU memory usage stable on dense displays.
const MAX_PLAYFIELD_DEVICE_PIXEL_RATIO = 1;

// Dependency container allows the main module to provide shared helpers without creating circular imports.
const defaultDependencies = {
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
  // Allow the playfield to bypass currency caps when developer tools are toggled on.
  isDeveloperModeActive: () => false,
  // Let developer controls grant infinite Thero at the start of every level when enabled.
  isDeveloperInfiniteTheroEnabled: () => false,
  // Allows the playfield to respect the global graphics fidelity toggle.
  isLowGraphicsMode: () => false,
};

let playfieldDependencies = { ...defaultDependencies };

export function configurePlayfieldSystem(options = {}) {
  playfieldDependencies = { ...defaultDependencies, ...options };
}

const TOWER_HOLD_INDICATOR_OFFSET_PX = 40;
const TOWER_PRESS_GLOW_FADE_MS = 200;
const DEFAULT_COST_SCRIBBLE_COLORS = {
  start: { r: 139, g: 247, b: 255 },
  end: { r: 255, g: 138, b: 216 },
  glow: { r: 255, g: 255, b: 255 },
};
// Promotion/demotion glyph effects borrow these tuning constants so both gestures feel distinct yet cohesive.
const TOWER_GLYPH_NEW_SYMBOL_DELAY_MS = 120;
const TOWER_GLYPH_NEW_SYMBOL_FADE_MS = 420;
const TOWER_GLYPH_FLASH_DURATION_MS = 520;
const TOWER_GLYPH_FLASH_HOLD_MS = 160;
const TOWER_GLYPH_FROM_SYMBOL_FADE_MS = 260;
const TOWER_GLYPH_MIN_PARTICLES = 14;
const TOWER_GLYPH_MAX_PARTICLES = 28;
const DEFAULT_PROMOTION_VECTOR = { x: 0, y: -1 };
const DEFAULT_DEMOTION_VECTOR = { x: 0, y: 1 };

// Rho debuff visuals should linger briefly so the sparkle ring can be noticed as enemies leave the field.
const RHO_SPARKLE_LINGER_SECONDS = 0.9;
const DERIVATIVE_SHIELD_SYMBOL = '∂';
const DERIVATIVE_SHIELD_RADIUS_SCALE = 4.2;
const DERIVATIVE_SHIELD_MIN_RADIUS = 96;
const DERIVATIVE_SHIELD_LINGER_MS = 160;
const DEFAULT_POLYGON_SIDES = 6;
const POLYGON_SPLIT_COUNT = 2;
const DEBUFF_ICON_SYMBOLS = {
  iota: 'ι',
  rho: 'ρ',
  theta: 'θ',
  'derivative-shield': DERIVATIVE_SHIELD_SYMBOL,
};
/**
 * Standardized Hitbox System
 * 
 * All projectiles and enemies use meter-based hitbox radii that scale consistently
 * with viewport size. This ensures collision detection stays accurate across devices.
 * 
 * Projectile Hitbox: 0.3m diameter (0.15m radius) ≈ 11px mobile, 23px tablet
 * Enemy Hitbox: 0.4m diameter (0.2m radius) ≈ 15px mobile, 31px tablet
 * 
 * Collision occurs when: distance <= (projectileRadius + enemyRadius)
 * 
 * Usage:
 * - Projectiles: Set hitRadius using playfield.getStandardShotHitRadius()
 * - Enemies: hitRadius calculated via playfield.getEnemyHitRadius(enemy, metrics)
 * - Both methods convert meters to pixels using the viewport's minimum dimension
 */
// Normalize α/β/γ projectile hitboxes to a 0.3 meter diameter so collision checks stay consistent across view sizes.
const STANDARD_SHOT_RADIUS_METERS = 0.15;
// Standardize enemy hitboxes using a 0.4 meter diameter circle for consistent collision detection.
const STANDARD_ENEMY_RADIUS_METERS = 0.2;
// Preserve β triangle proportions when reflecting shots back to the tower.
const EQUILATERAL_TRIANGLE_HEIGHT_RATIO = Math.sqrt(3) / 2;
// Pre-calculated constants for performance optimization in tight render loops
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const PI_OVER_6 = Math.PI / 6;
const PI_TIMES_1_2 = Math.PI * 1.2;
const HALF = 0.5;
// Tunables for the β sticking sequence and slow effect cadence.
const BETA_STICK_HIT_COUNT = 3;
const BETA_STICK_HIT_INTERVAL = 0.18;
const BETA_SLOW_DURATION_SECONDS = 0.5;
const BETA_TRIANGLE_SPEED = 144;
// Tunables for the γ piercing/star/return sequence.
const GAMMA_OUTBOUND_SPEED = 260;
const GAMMA_STAR_SPEED = 200;
const GAMMA_RETURN_SPEED = 260;
const GAMMA_STAR_HIT_COUNT = 5;
// Keep γ's impact star compact so the pattern hugs the enemy model.
const GAMMA_STAR_RADIUS_METERS = 0.45;
const GAMMA_STAR_SEQUENCE = [0, 2, 4, 1, 3, 0];

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
    // Rebuild the canvas backing store when the resolution preference changes.
    this.handleResolutionChange = () => {
      this.syncCanvasSize();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(PLAYFIELD_RESOLUTION_EVENT, this.handleResolutionChange);
    }

    this.arcOffset = 0;
    // Combat state manager will be initialized when levelConfig is set
    this.combatStateManager = null;
    // Tower orchestration controller will be initialized when levelConfig is set
    this.towerOrchestrationController = null;
    // Track baseline gate defense so breach previews can factor in mitigation.
    this.gateDefense = 0;
    this.initialSpawnDelay = 0;
    this.autoWaveEnabled = true;
    this.autoStartLeadTime = 5;
    this.autoStartTimer = null;
    this.autoStartDeadline = 0;
    // Track the most recent endless checkpoint so defeat screens can offer a retry.
    this.endlessCheckpoint = null;
    this.endlessCheckpointUsed = false;
    this.autoWaveEnabled = true;
    this.autoStartLeadTime = 5;
    this.autoStartTimer = null;
    this.autoStartDeadline = 0;
    // Track the most recent endless checkpoint so defeat screens can offer a retry.
    this.endlessCheckpoint = null;
    this.endlessCheckpointUsed = false;

    // Combat stats manager will be initialized after needed methods are available
    this.combatStatsManager = null;

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
    // Track tunnel segments for path fading and enemy invulnerability
    this.tunnelSegments = [];
    // Store both the ambient river particles and the luminous tracer sparks.
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;

    this.slots = new Map();
    this.towers = [];
    this.projectiles = [];
    this.damageNumbers = [];
    this.damageNumberIdCounter = 0;
    // Track collapsing enemy fragments so defeat bursts can animate after removal.
    this.enemyDeathParticles = [];
    // Queue knockback requests so the renderer knows when swirl rings should react to hits.
    this.enemySwirlImpacts = [];
    // Maintain per-tower particle burst queues so α/β/γ/ν visuals can update independently.
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
      this.gammaStarBursts = [];
    this.gammaStarBursts = []; // Track star burst effects on enemies hit by gamma projectiles
    this.nuBursts = [];
    // Track swarm clouds from stored shot particles
    this.swarmClouds = [];
    this.chiThralls = [];
    this.chiLightTrails = [];
    this.chiThrallIdCounter = 0;
    this.availableTowers = [];
    this.draggingTowerType = null;
    this.dragPreviewOffset = { x: 0, y: 0 }; // Allow callers to nudge the preview in addition to the standardized elevation.

    // Track which lattice menu is active so clicks open option rings instead of instant selling.
    this.activeTowerMenu = null;
    // Store a short-lived closing animation snapshot so the radial menu can gracefully dissipate.
    this.towerMenuExitAnimation = null;
    // Provide stable identifiers for Delta soldiers as they spawn from multiple towers.
    this.deltaSoldierIdCounter = 0;

    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { width: 0, height: 0 };
    // Keep a cloud of background swimmers so the lattice circles feel alive.
    this.backgroundSwimmers = [];
    this.swimmerBounds = { width: 0, height: 0 };

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
      towerType: null,
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

    // Keep wave tally overlays in a dedicated controller so the main class only delegates updates and resets.
    this.waveTallyOverlays = new WaveTallyOverlayManager({
      isPreviewMode: () => this.previewOnly,
      getContext: () => this.ctx,
      getTowerById: (towerId) => this.getTowerById(towerId),
      resolveTowerBodyRadius: (tower) => this.resolveTowerBodyRadius(tower),
    });
    this.waveTallyLabels = this.waveTallyOverlays.getEntries();

    // Infinity towers are tracked separately for their aura effects
    this.infinityTowers = [];

    // Initialize render coordinator to manage animation frame loop
    this.renderCoordinator = createRenderCoordinator({
      update: (delta) => this.update(delta),
      draw: () => this.draw(),
      shouldAnimate: () => this.shouldAnimate,
    });

    this.resizeObserver = null;
    this.resizeHandler = () => this.syncCanvasSize();

    this.towerIdCounter = 0;
    this.hoverPlacement = null;
    this.hoverEnemy = null;
    this.pointerPosition = null;
    this.focusedEnemyId = null;
    this.focusedCellId = null; // Track focused Voronoi/Delaunay cell
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
    // Remember when the view should stay anchored because a tower hold gesture is active.
    this.viewPanLockPointerId = null;
    // Remember when a drag gesture should block the follow-up click event.
    this.suppressNextCanvasClick = false;
    this.towerHoldState = {
      pointerId: null,
      towerId: null,
      startClientX: 0,
      startClientY: 0,
      lastClientY: 0,
      activationClientX: 0,
      activationClientY: 0,
      holdTimeoutId: null,
      holdActivated: false,
      scribbleCleanup: null,
      indicatorsCleanup: null,
      actionTriggered: null,
      pointerType: null,
      swipeStepPixels: 0,
      appliedSteps: 0,
    };
    this.towerSelectionWheel = {
      container: null,
      towers: [],
      activeIndex: 0,
      towerId: null,
      wheelHandler: null,
      outsideClickHandler: null,
      justReleasedPointerId: null,
      releaseTimestamp: 0,
      // Track the drag gesture state for stepwise tower selection scrolling.
      dragState: null,
    };
    this.towerTapState = {
      lastTowerId: null,
      lastTapTime: 0,
      lastTapPosition: null,
    };
    // Maintain glow state for pressed towers so pointer interactions can animate highlights.
    this.towerPressHighlights = new Map();
    this.towerPressPointerMap = new Map();
    // Track glyph transitions so promote/demote gestures can render bespoke particle flashes.
    this.towerGlyphTransitions = new Map();

    this.developerPathMarkers = [];
    // Developer tools service handles crystals and developer towers
    this.developerTools = null; // Created after needed methods are available

    // Level lifecycle manager handles level entry/exit
    this.lifecycleManager = null; // Created after needed methods are available

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
      this.initializeFloatingFeedback();

      this.disableSlots(true);
      this.updateHud();
      this.updateProgress();
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }
    
    // Initialize lifecycle manager after all methods are available
    this.lifecycleManager = createLevelLifecycleManager({ playfield: this });
    
    // Initialize combat stats manager after all methods are available
    this.combatStatsManager = createCombatStatsManager({
      getTowers: () => this.towers,
      buildCurrentWaveQueue: () => this.buildCurrentWaveQueue(),
      buildNextWaveQueue: () => this.buildNextWaveQueue(),
      buildActiveEnemyEntries: () => this.buildActiveEnemyEntries(),
    });
    
    // Initialize tower menu system after all methods are available
    this.towerMenuSystem = createTowerMenuSystem(this);
    
    // Initialize connection system for lattice particles and supply seeds
    this.connectionSystem = createConnectionSystem(this);
  }

  // Property getter for backward compatibility - combatStats is now managed by combatStatsManager
  get combatStats() {
    return this.combatStatsManager ? this.combatStatsManager.getCombatStats() : null;
  }

  get statsPanelEnabled() {
    return this.combatStatsManager ? this.combatStatsManager.getStatsPanelEnabled() : false;
  }

  set statsPanelEnabled(value) {
    if (this.combatStatsManager) {
      this.combatStatsManager.setStatsPanelEnabled(value);
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

  // Reset wave tally overlays so the scribble queue can start fresh.
  resetWaveTallies() {
    this.waveTallyOverlays.reset();
  }

  // Remove existing wave tally overlays, optionally by type, when preferences change.
  clearWaveTallies({ type = null } = {}) {
    this.waveTallyOverlays.clear({ type });
  }

  // Spawn wave tally overlays for every active lattice once a wave concludes.
  spawnWaveCompletionTallies() {
    this.waveTallyOverlays.spawnWaveCompletionTallies({
      combatStats: this.combatStats,
      towers: this.towers,
    });
  }

  // Advance the scribble/erase animation cycle for each active wave tally overlay.
  updateWaveTallies(delta) {
    this.waveTallyOverlays.update(delta);
  }

  /**
   * Normalize the enemy group definitions for a wave configuration.
   * @param {Object} config - Raw wave configuration
   * @returns {Array} Sanitized enemy group list
   */
  // Delegate to wave formatter
  resolveWaveGroups(config = null) {
    return this.waveFormatter ? this.waveFormatter.resolveWaveGroups(config) : [];
  }

  /**
   * Convert a wave configuration into formatted queue entries for UI rendering.
   * Delegates to WaveUIFormatter.
   */
  buildWaveEntries(config, options = {}) {
    return this.waveFormatter ? this.waveFormatter.buildWaveEntries(config, options) : [];
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

  /**
   * Calculate the net thero delta for swapping the active tower into a target lattice.
   */
  getTowerSelectionCostDelta({ targetDefinition = null, sourceTower = null } = {}) {
    if (!targetDefinition) {
      return 0;
    }
    if (!sourceTower) {
      return this.getCurrentTowerCost(targetDefinition.id);
    }

    if (targetDefinition.id === 'sell') {
      // Surface the full refund amount so the UI can treat selling as a negative cost option.
      return -Math.max(0, this.calculateTowerSellRefund(sourceTower));
    }

    const history = this.ensureTowerCostHistory(sourceTower);
    const refundAmount = history.length ? history[history.length - 1] : this.getCurrentTowerCost(sourceTower.type);
    const targetCost = this.getCurrentTowerCost(targetDefinition.id);
    if (!Number.isFinite(targetCost) || !Number.isFinite(refundAmount)) {
      return targetCost;
    }
    return targetCost - refundAmount;
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

  initializeFloatingFeedback() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    this.floatingFeedback = createFloatingFeedbackController({
      canvas: this.canvas,
      ctx: this.ctx,
      getCanvasPosition: (worldPos) => {
        return worldPos; // Gems are already in canvas coordinates
      },
    });
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
      this.backgroundSwimmers = [];
      this.swimmerBounds = { width, height };
      return;
    }

    const previousWidth = this.floaterBounds?.width || width;
    const previousHeight = this.floaterBounds?.height || height;
    const scaleX = previousWidth ? width / previousWidth : 1;
    const scaleY = previousHeight ? height / previousHeight : 1;
    const previousSwimmerWidth = this.swimmerBounds?.width || width;
    const previousSwimmerHeight = this.swimmerBounds?.height || height;
    const swimmerScaleX = previousSwimmerWidth ? width / previousSwimmerWidth : scaleX;
    const swimmerScaleY = previousSwimmerHeight ? height / previousSwimmerHeight : scaleY;

    if (this.floaters.length && (scaleX !== 1 || scaleY !== 1)) {
      this.floaters.forEach((floater) => {
        floater.x *= scaleX;
        floater.y *= scaleY;
        floater.vx *= scaleX;
        floater.vy *= scaleY;
      });
    }

    if (this.backgroundSwimmers.length && (swimmerScaleX !== 1 || swimmerScaleY !== 1)) {
      this.backgroundSwimmers.forEach((swimmer) => {
        swimmer.x *= swimmerScaleX;
        swimmer.y *= swimmerScaleY;
        swimmer.vx *= swimmerScaleX;
        swimmer.vy *= swimmerScaleY;
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

    const desiredSwimmers = this.computeSwimmerCount(width, height);
    if (!this.backgroundSwimmers.length) {
      this.backgroundSwimmers = [];
    }

    if (this.backgroundSwimmers.length < desiredSwimmers) {
      const needed = desiredSwimmers - this.backgroundSwimmers.length;
      for (let index = 0; index < needed; index += 1) {
        this.backgroundSwimmers.push(this.createBackgroundSwimmer(width, height));
      }
    } else if (this.backgroundSwimmers.length > desiredSwimmers) {
      this.backgroundSwimmers.length = desiredSwimmers;
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

    this.backgroundSwimmers.forEach((swimmer) => {
      swimmer.x = Math.min(width - safeMargin, Math.max(safeMargin, swimmer.x));
      swimmer.y = Math.min(height - safeMargin, Math.max(safeMargin, swimmer.y));
      swimmer.vx = Number.isFinite(swimmer.vx) ? swimmer.vx : 0;
      swimmer.vy = Number.isFinite(swimmer.vy) ? swimmer.vy : 0;
      swimmer.ax = Number.isFinite(swimmer.ax) ? swimmer.ax : 0;
      swimmer.ay = Number.isFinite(swimmer.ay) ? swimmer.ay : 0;
      swimmer.flicker = Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0;
      swimmer.sizeScale = Number.isFinite(swimmer.sizeScale) ? swimmer.sizeScale : 1;
    });

    this.floaterBounds = { width, height };
    this.swimmerBounds = { width, height };
  }

  ensureLoop() {
    this.renderCoordinator.startRenderLoop();
  }

  stopLoop() {
    this.renderCoordinator.stopRenderLoop();
  }

  enterLevel(level, options = {}) {
    return this.lifecycleManager.enterLevel(level, options);
  }

  getEnergyCap() {
    return this.lifecycleManager.getEnergyCap();
  }

  leaveLevel() {
    return this.lifecycleManager.leaveLevel();
  }

  resetState() {
    if (!this.levelConfig) {
      // When no level is loaded, reset to null state
      if (this.combatStateManager) {
        this.combatStateManager.reset();
      }
      this.gateDefense = 0;
    } else {
      // Initialize manager if it doesn't exist
      if (!this.combatStateManager) {
        this.combatStateManager = createCombatStateManager({
          levelConfig: this.levelConfig,
          audio: this.audio,
          onVictory: this.onVictory,
          onDefeat: this.onDefeat,
          onCombatStart: this.onCombatStart,
          recordKillEvent: (towerId) => this.recordKillEvent(towerId),
          tryConvertEnemyToChiThrall: (enemy, context) => this.tryConvertEnemyToChiThrall(enemy, context),
          triggerPsiClusterAoE: (enemy) => this.triggerPsiClusterAoE(enemy),
          notifyEnemyDeath: (enemy) => this.notifyEnemyDeath(enemy),
        });
      } else {
        this.combatStateManager.reset();
      }
      // Initialize tower orchestration controller if it doesn't exist
      if (!this.towerOrchestrationController) {
        this.towerOrchestrationController = createTowerOrchestrationController({
          playfield: this,
          combatState: this.combatStateManager,
          towerManager: TowerManager,
          audio: this.audio,
          messageEl: this.messageEl,
          dependencies: this.dependencies,
          theroSymbol: this.theroSymbol,
        });
      }
      // Normalize any gate defense value supplied by the level configuration.
      const configuredDefense = Number.isFinite(this.levelConfig.gateDefense)
        ? this.levelConfig.gateDefense
        : Number.isFinite(this.levelConfig.coreDefense)
        ? this.levelConfig.coreDefense
        : 0;
      this.gateDefense = Math.max(0, configuredDefense);
    }
    this.towerIdCounter = 0;
    this.arcOffset = 0;
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetEnemyDeathParticles();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
      this.gammaStarBursts = [];
    this.nuBursts = [];
    this.swarmClouds = [];
    this.floaters = [];
    this.floaterConnections = [];
    // Reset ambient swimmers whenever the battlefield is rebuilt for a new run.
    this.backgroundSwimmers = [];
    this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    if (this.towerGlyphTransitions) {
      this.towerGlyphTransitions.clear();
    }
    this.towers = [];
    this.infinityTowers = [];
    this.towerConnectionMap.clear();
    this.towerConnectionSources.clear();
    this.connectionEffects = [];
    this.clearConnectionDragState();
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

  loadLevelCrystals() {
    // Clear any existing developer crystals
    if (typeof this.clearDeveloperCrystals === 'function') {
      this.clearDeveloperCrystals({ silent: true });
    }
    
    // Load crystals from level config if present
    if (!this.levelConfig || !Array.isArray(this.levelConfig.crystals)) {
      return;
    }
    
    this.levelConfig.crystals.forEach((crystalConfig) => {
      if (!crystalConfig || typeof crystalConfig.x !== 'number' || typeof crystalConfig.y !== 'number') {
        return;
      }
      
      const normalized = { x: crystalConfig.x, y: crystalConfig.y };
      const options = {
        integrity: crystalConfig.integrity,
        thero: crystalConfig.thero || 0,
        theroMultiplier: crystalConfig.theroMultiplier || 0,
      };
      
      if (typeof this.addDeveloperCrystal === 'function') {
        this.addDeveloperCrystal(normalized, options);
      }
    });
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
    this.resetEnemyDeathParticles();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
      this.gammaStarBursts = [];
    this.nuBursts = [];
    this.swarmClouds = [];
    this.floaters = [];
    this.floaterConnections = [];
    // Reset ambient swimmers when replaying a wave so the background loop restarts cleanly.
    this.backgroundSwimmers = [];
    this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
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
      if (tower.type === 'omega') {
        this.ensureOmegaState(tower);
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
      } else if (this.hoverPlacement.towerType === 'kappa') {
        const kappaPreview = getKappaPreviewParametersHelper(this);
        const rangeFactor = definition ? definition.range : 0.24;
        const fallbackRange = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
        this.hoverPlacement.range = kappaPreview?.rangePixels || fallbackRange;
      } else {
        const rangeFactor = definition ? definition.range : 0.24;
        this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      }
      this.hoverPlacement.connections = this.computePlacementConnections(
        this.hoverPlacement.position,
        {
          towerType: this.hoverPlacement.towerType,
          range: this.hoverPlacement.range,
          mergeTarget: this.hoverPlacement.mergeTarget,
        },
      );
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

  /**
   * Build a list of valid κ tripwire previews so the placement overlay can render connections.
   */
  computePlacementConnections(position, { towerType, range, mergeTarget } = {}) {
    const connections = [];
    if (!position || !towerType || !Number.isFinite(range) || range <= 0) {
      return connections;
    }

    if (towerType === 'kappa') {
      this.towers?.forEach?.((candidate) => {
        if (!candidate || candidate.id === mergeTarget?.id) {
          return;
        }
        const dx = candidate.x - position.x;
        const dy = candidate.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (Number.isFinite(distance) && distance > 0 && distance <= range) {
          connections.push({
            from: { ...position },
            to: { x: candidate.x, y: candidate.y },
            kappaPair: candidate.type === 'kappa',
          });
        }
      });
      return connections;
    }

    this.towers?.forEach?.((candidate) => {
      if (!candidate || candidate.type !== 'kappa') {
        return;
      }
      this.ensureKappaState(candidate);
      const connectionRange = Math.max(0, candidate.kappaState?.rangePixels || candidate.range || 0);
      const dx = position.x - candidate.x;
      const dy = position.y - candidate.y;
      const distance = Math.hypot(dx, dy);
      if (Number.isFinite(distance) && distance > 0 && distance <= connectionRange) {
        connections.push({
          from: { x: candidate.x, y: candidate.y },
          to: { ...position },
          kappaPair: true,
        });
      }
    });

    return connections;
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
    const kappaPreview = towerType === 'kappa' ? getKappaPreviewParametersHelper(this) : null;
    const previewRange = towerType === 'kappa' && kappaPreview?.rangePixels
      ? kappaPreview.rangePixels
      : Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
    const connections = this.computePlacementConnections(position, {
      towerType,
      range: previewRange,
      mergeTarget: merging ? existing : null,
    });
    this.hoverPlacement = {
      normalized: { ...placementNormalized },
      position,
      range: previewRange,
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
      connections,
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
    const minDimension = Math.max(1, Math.min(this.renderWidth || 0, this.renderHeight || 0));
    const standardRadius = metersToPixels(STANDARD_ENEMY_RADIUS_METERS, minDimension);
    const baseRadius = Math.max(12, standardRadius);
    if (!enemy || !metrics) {
      return baseRadius;
    }
    const { focusRadius = 0, ringRadius = 0 } = metrics;
    return Math.max(baseRadius, focusRadius || ringRadius || baseRadius);
  }

  // Standardize α/β/γ projectile hitboxes using a shared 0.3 m diameter circle.
  getStandardShotHitRadius() {
    const minDimension = Math.max(1, Math.min(this.renderWidth || 0, this.renderHeight || 0));
    const radiusPixels = metersToPixels(STANDARD_SHOT_RADIUS_METERS, minDimension);
    return Math.max(2, radiusPixels);
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
    return `Swipe ↑ to upgrade (${this.theroSymbol}${costLabel}) · Swipe ↓ to demote`;
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

  /**
   * Spawn visual triangular indicators above/below tower during hold gesture.
   * Shows upgrade arrow above, and either downgrade arrow or sell symbols below.
   */
  spawnTowerHoldIndicators(tower) {
    if (!tower || !this.container) {
      return null;
    }
    if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return null;
    }

    const indicators = [];
    const cleanupFunctions = [];

    // Always show upgrade indicator above tower (unless at max tier)
    const nextId = getNextTowerId(tower.type);
    if (nextId) {
      const upgradeIndicator = document.createElement('div');
      upgradeIndicator.className = 'tower-hold-indicator tower-hold-indicator--upgrade';
      upgradeIndicator.style.left = `${tower.x}px`;
      upgradeIndicator.style.top = `${tower.y - TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
      
      const startColor = samplePaletteGradient(0.15) || { r: 139, g: 247, b: 255 };
      upgradeIndicator.style.setProperty('--indicator-color', colorToRgbaString(startColor, 0.85));
      
      this.container.append(upgradeIndicator);
      indicators.push(upgradeIndicator);
    }

    // Show downgrade indicator below tower, or sell indicator if at alpha tier
    const previousId = getPreviousTowerId(tower.type);
    const isAlphaTower = !previousId; // Alpha is the lowest tier with no previous tier
    
    if (isAlphaTower) {
      // Show sell indicator ($ and Þ symbols)
      const sellIndicator = document.createElement('div');
      sellIndicator.className = 'tower-hold-indicator tower-hold-indicator--sell';
      sellIndicator.style.left = `${tower.x}px`;
      sellIndicator.style.top = `${tower.y + TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
      sellIndicator.textContent = `$${this.theroSymbol}`;
      
      const sellColor = samplePaletteGradient(0.75) || { r: 255, g: 200, b: 80 };
      sellIndicator.style.setProperty('--indicator-color', colorToRgbaString(sellColor, 0.95));
      
      this.container.append(sellIndicator);
      indicators.push(sellIndicator);
    } else {
      // Show downgrade indicator
      const downgradeIndicator = document.createElement('div');
      downgradeIndicator.className = 'tower-hold-indicator tower-hold-indicator--downgrade';
      downgradeIndicator.style.left = `${tower.x}px`;
      downgradeIndicator.style.top = `${tower.y + TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
      
      const endColor = samplePaletteGradient(0.85) || { r: 255, g: 138, b: 216 };
      downgradeIndicator.style.setProperty('--indicator-color', colorToRgbaString(endColor, 0.85));
      
      this.container.append(downgradeIndicator);
      indicators.push(downgradeIndicator);
    }

    // Create cleanup function to remove all indicators
    const cleanup = () => {
      indicators.forEach(indicator => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      });
    };

    return cleanup;
  }

  /**
   * Schedule a glyph transition animation so promotions/demotions feel tactile.
   */
  queueTowerGlyphTransition(
    tower,
    { fromSymbol = '', toSymbol = '', mode = 'promote', swipeVector = null } = {},
  ) {
    if (!tower?.id || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return;
    }
    if (!this.towerGlyphTransitions) {
      this.towerGlyphTransitions = new Map();
    }
    const fallbackDirection = mode === 'demote' ? DEFAULT_DEMOTION_VECTOR : DEFAULT_PROMOTION_VECTOR;
    const { direction, magnitude } = this.normalizeSwipeVector(swipeVector, fallbackDirection);
    const now = this.getCurrentTimestamp();
    const strengthRatio = Math.min(1.35, Math.max(0.65, 0.45 + magnitude / 90));
    const entry = {
      towerId: tower.id,
      startedAt: now,
      mode,
      fromSymbol: typeof fromSymbol === 'string' ? fromSymbol : '',
      toSymbol: typeof toSymbol === 'string' ? toSymbol : '',
      direction,
      swipeStrength: magnitude,
      strengthRatio,
      newSymbolDelay: TOWER_GLYPH_NEW_SYMBOL_DELAY_MS,
      newSymbolFade: TOWER_GLYPH_NEW_SYMBOL_FADE_MS,
      flashDuration: TOWER_GLYPH_FLASH_DURATION_MS,
      flashHold: TOWER_GLYPH_FLASH_HOLD_MS,
      fromSymbolFade: TOWER_GLYPH_FROM_SYMBOL_FADE_MS,
    };
    entry.particles = this.buildTowerGlyphParticles(entry);
    const longestParticle = entry.particles.reduce(
      (max, particle) => Math.max(max, (particle.delay || 0) + (particle.duration || 0)),
      0,
    );
    entry.totalDuration =
      Math.max(
        entry.flashDuration + entry.flashHold + 120,
        entry.newSymbolDelay + entry.newSymbolFade,
        entry.fromSymbolFade + 90,
        longestParticle,
      ) + 60;
    this.towerGlyphTransitions.set(tower.id, entry);
  }

  /**
   * Generate particle descriptors that trail the departing glyph.
   */
  buildTowerGlyphParticles(entry = {}) {
    const baseRadius = Math.max(12, Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR);
    const ratio = Number.isFinite(entry.strengthRatio) ? Math.max(0.65, entry.strengthRatio) : 1;
    const normalized = Math.min(1, ratio / 1.35);
    const particleCount = Math.max(
      TOWER_GLYPH_MIN_PARTICLES,
      Math.round(TOWER_GLYPH_MIN_PARTICLES + (TOWER_GLYPH_MAX_PARTICLES - TOWER_GLYPH_MIN_PARTICLES) * normalized),
    );
    const particles = [];
    for (let index = 0; index < particleCount; index += 1) {
      const duration = 360 + Math.random() * 360;
      particles.push({
        delay: Math.random() * 90,
        duration,
        maxDistance: baseRadius * (0.85 + Math.random() * 1.25) * ratio,
        lateral: baseRadius * 0.35 * (Math.random() - 0.5) * ratio,
        offsetX: (Math.random() - 0.5) * baseRadius * 0.3,
        offsetY: (Math.random() - 0.5) * baseRadius * 0.3,
        size: Math.max(1.5, baseRadius * 0.08) * (0.6 + Math.random() * 0.9),
        alpha: 0.65 + Math.random() * 0.3,
        hueShift: Math.random(),
      });
    }
    return particles;
  }

  /**
   * Normalize swipe vectors so the renderer knows which way particles should depart.
   */
  normalizeSwipeVector(vector, fallbackDirection = DEFAULT_PROMOTION_VECTOR) {
    const fallback = fallbackDirection || DEFAULT_PROMOTION_VECTOR;
    const fallbackLength = Math.hypot(fallback.x || 0, fallback.y || 0) || 1;
    const fallbackNormalized = { x: (fallback.x || 0) / fallbackLength, y: (fallback.y || 0) / fallbackLength };
    if (!vector || (!Number.isFinite(vector.x) && !Number.isFinite(vector.y))) {
      return { direction: fallbackNormalized, magnitude: 0 };
    }
    const dx = Number.isFinite(vector.x) ? vector.x : 0;
    const dy = Number.isFinite(vector.y) ? vector.y : 0;
    const length = Math.hypot(dx, dy);
    if (!length) {
      return { direction: fallbackNormalized, magnitude: 0 };
    }
    return { direction: { x: dx / length, y: dy / length }, magnitude: length };
  }

  /**
   * Advance glyph transitions and retire finished entries.
   */
  updateTowerGlyphTransitions() {
    if (!this.towerGlyphTransitions || this.towerGlyphTransitions.size === 0) {
      return;
    }
    const now = this.getCurrentTimestamp();
    const expired = [];
    this.towerGlyphTransitions.forEach((entry, towerId) => {
      if (!entry) {
        expired.push(towerId);
        return;
      }
      const elapsed = now - (entry.startedAt || 0);
      entry.elapsed = elapsed;
      const cap = Number.isFinite(entry.totalDuration) ? entry.totalDuration : 600;
      if (elapsed >= cap) {
        expired.push(towerId);
      }
    });
    expired.forEach((towerId) => this.towerGlyphTransitions.delete(towerId));
  }

  /**
   * Initiate tower hold tracking so the selection wheel can open after a long press.
   */
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
    this.towerHoldState.lastClientY = event.clientY;
    this.towerHoldState.activationClientX = event.clientX;
    this.towerHoldState.activationClientY = event.clientY;
    this.towerHoldState.pointerType = event.pointerType || 'mouse';
    this.towerHoldState.holdActivated = false;
    this.towerHoldState.actionTriggered = null;
    this.towerHoldState.appliedSteps = 0;
    const stepPixels = this.getPixelsForMeters(2);
    this.towerHoldState.swipeStepPixels = Math.max(1, Number.isFinite(stepPixels) ? stepPixels : 1);
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
    
    // Tower hold gesture is disabled - no action is taken when holding a placed tower
    
    if (this.connectionDragState.pointerId === state.pointerId) {
      this.clearConnectionDragState();
    }
    if (this.deltaCommandDragState.pointerId === state.pointerId) {
      this.clearDeltaCommandDragState();
    }
    this.viewPanLockPointerId = state.pointerId;
    if (this.viewDragState.pointerId === state.pointerId) {
      this.viewDragState.pointerId = null;
      this.viewDragState.isDragging = false;
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

  commitTowerHoldUpgrade(options = {}) {
    if (!this.towerHoldState?.towerId) {
      return false;
    }
    const tower = this.getTowerById(this.towerHoldState.towerId);
    if (!tower) {
      return false;
    }
    const upgraded = this.upgradeTowerTier(tower, { swipeVector: options?.swipeVector || null });
    if (upgraded) {
      this.suppressNextCanvasClick = true;
      this.resetTowerTapState();
    }
    return upgraded;
  }

  commitTowerHoldDemotion(options = {}) {
    if (!this.towerHoldState?.towerId) {
      return false;
    }
    const tower = this.getTowerById(this.towerHoldState.towerId);
    if (!tower) {
      return false;
    }
    const demoted = this.demoteTowerTier(tower, { swipeVector: options?.swipeVector || null });
    if (demoted) {
      this.suppressNextCanvasClick = true;
      this.resetTowerTapState();
    }
    return demoted;
  }

  /**
   * Locate the currently selected tower so option clicks can mutate its settings.
   */
  getActiveMenuTower() {
    return this.towerMenuSystem ? this.towerMenuSystem.getActiveMenuTower() : null;
  }

  /**
   * Present the radial command menu for the supplied tower.
   */
  openTowerMenu(tower, options = {}) {
    if (this.towerMenuSystem) {
      this.towerMenuSystem.openTowerMenu(tower, options);
    }
  }

  /**
   * Hide any open radial tower menu.
   */
  closeTowerMenu() {
    if (this.towerMenuSystem) {
      this.towerMenuSystem.closeTowerMenu();
    }
  }

  /**
   * Generate option metadata for the active tower menu.
   */
  buildTowerMenuOptions(tower) {
    return this.towerMenuSystem ? this.towerMenuSystem.buildTowerMenuOptions(tower) : [];
  }

  /**
   * Compute the world-space layout for the radial menu options.
   */
  getTowerMenuGeometry(tower) {
    return this.towerMenuSystem ? this.towerMenuSystem.getTowerMenuGeometry(tower) : null;
  }

  /**
   * Handle clicks on the radial tower command menu.
   */
  handleTowerMenuClick(position) {
    return this.towerMenuSystem ? this.towerMenuSystem.handleTowerMenuClick(position) : false;
  }

  /**
   * Apply the effect of a selected tower option.
   */
  executeTowerMenuOption(tower, option) {
    if (this.towerMenuSystem) {
      this.towerMenuSystem.executeTowerMenuOption(tower, option);
    }
  }

  /**
   * Allow the player to mark a manual target for sentry mode Delta soldiers.
   */
  handleTowerMenuEnemySelection(tower, enemy) {
    return this.towerMenuSystem ? this.towerMenuSystem.handleTowerMenuEnemySelection(tower, enemy) : false;
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
   * Apply ρ sparkles to enemies within range so the debuff ring and icon bar update together.
   */
  updateRhoTower(tower, delta) {
    if (!tower || tower.type !== 'rho' || !this.combatActive) {
      return;
    }
    const radius = Math.max(0, Number.isFinite(tower.range) ? tower.range : 0);
    if (!(radius > 0)) {
      return;
    }
    const radiusSq = radius * radius;
    const refreshAmount = RHO_SPARKLE_LINGER_SECONDS + Math.max(0, Number.isFinite(delta) ? delta : 0);

    this.enemies.forEach((enemy) => {
      if (!enemy) {
        return;
      }
      const position = this.getEnemyPosition(enemy);
      if (!position) {
        return;
      }
      const dx = position.x - tower.x;
      const dy = position.y - tower.y;
      if (dx * dx + dy * dy > radiusSq) {
        return;
      }
      const existing = Number.isFinite(enemy.rhoSparkleTimer) ? enemy.rhoSparkleTimer : 0;
      enemy.rhoSparkleTimer = Math.max(existing, refreshAmount);
      this.registerEnemyDebuff(enemy, 'rho');
    });
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
   * Ensure ν burst state stays initialized so piercing lasers can render cleanly.
   */
  ensureNuState(tower) {
    return TowerManager.ensureNuState.call(this, tower);
  }

  /**
   * Emit ν piercing laser bursts using the shared particle animation stack.
   */
  spawnNuAttackBurst(tower, targetInfo, options = {}) {
    return TowerManager.spawnNuAttackBurst.call(this, tower, targetInfo, options);
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
   * Keep ο track-hold anchors in sync with the glyph lane.
   */
  updateOmicronAnchors(tower) {
    return TowerManager.updateOmicronAnchors.call(this, tower);
  }

  /**
   * Assign an ο track-hold anchor from player drag gestures.
   */
  assignOmicronTrackHoldAnchor(tower, anchor) {
    return TowerManager.assignOmicronTrackHoldAnchor.call(this, tower, anchor);
  }

  /**
   * Update π tower laser merge mechanics and animations.
   */
  updatePiTower(tower, delta) {
    updatePiTowerHelper(this, tower, delta);
  }

  /**
   * Update τ tower spiral projectiles.
   */
  updateTauTower(tower, delta) {
    updateTauTowerHelper(this, tower, delta);
  }

  /**
   * Ensure φ state exists so sunflower seed generation stays in sync with range.
   */
  ensurePhiState(tower) {
    return TowerManager.ensurePhiState.call(this, tower);
  }

  /**
   * Clear cached φ seed data when the lattice retunes or is removed.
   */
  teardownPhiTower(tower) {
    return TowerManager.teardownPhiTower.call(this, tower);
  }

  /**
   * Update φ sunflower seed logic and burst behavior.
   */
  updatePhiTower(tower, delta) {
    updatePhiTowerHelper(this, tower, delta);
  }

  /**
   * Trigger φ burst - launch all seeds simultaneously.
   */
  triggerPhiBurst(tower) {
    triggerPhiBurstHelper(this, tower);
  }

  /**
   * Update ψ merge logic for combining enemies.
   */
  updatePsiTower(tower, delta) {
    updatePsiTowerHelper(this, tower, delta);
  }

  updateOmegaTower(tower, delta) {
    updateOmegaTowerHelper(this, tower, delta);
  }

  /**
   * Ensure Ω tower state is initialized with orbital particles.
   */
  ensureOmegaState(tower) {
    return TowerManager.ensureOmegaState.call(this, tower);
  }

  /**
   * Clean up Ω tower state when tower is removed or changed.
   */
  teardownOmegaTower(tower) {
    return TowerManager.teardownOmegaTower.call(this, tower);
  }

  /**
   * Trigger Psi cluster AoE effect on death.
   */
  triggerPsiClusterAoE(cluster, deathPosition) {
    triggerPsiClusterAoEHelper(this, cluster, deathPosition);
  }

  /**
   * Update υ fleet logic and targeting.
   */
  updateUpsilonTower(tower, delta) {
    updateUpsilonTowerHelper(this, tower, delta);
  }

  /**
   * Keep υ track-hold anchors in sync with the glyph lane.
   */
  updateUpsilonAnchors(tower) {
    return TowerManager.updateUpsilonAnchors.call(this, tower);
  }

  /**
   * Assign a υ fly-by anchor from player drag gestures.
   */
  assignUpsilonTrackHoldAnchor(tower, anchor) {
    return TowerManager.assignUpsilonTrackHoldAnchor.call(this, tower, anchor);
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
   * Clear τ-specific caches when the tower is sold or retuned.
   */
  teardownTauTower(tower) {
    teardownTauTowerHelper(this, tower);
  }

  /**
   * Ensure υ ships have their state container before rendering or updates.
   */
  ensureUpsilonState(tower) {
    return ensureUpsilonStateHelper(this, tower);
  }

  /**
   * Clear υ caches when the lattice is removed.
   */
  teardownUpsilonTower(tower) {
    teardownUpsilonTowerHelper(this, tower);
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
   * Ensure τ state stays initialized so spirals animate smoothly.
   */
  ensureTauState(tower) {
    return ensureTauStateHelper(this, tower);
  }

  /**
   * Clear σ-specific caches when the tower is sold or retuned.
   */
  teardownSigmaTower(tower) {
    return TowerManager.teardownSigmaTower.call(this, tower);
  }

  /**
   * Ensure ψ tower has its merge state container before updates.
   */
  ensurePsiState(tower) {
    return ensurePsiStateHelper(this, tower);
  }

  teardownPsiTower(tower) {
    teardownPsiTowerHelper(this, tower);
  }

  /**
   * Spawn a τ spiral projectile toward the current target.
   */
  spawnTauProjectile(tower, targetInfo) {
    spawnTauProjectileHelper(this, tower, targetInfo);
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
    const spinSpeed = PI_TIMES_1_2;
    this.focusMarkerAngle = (this.focusMarkerAngle + delta * spinSpeed) % TWO_PI;
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

  /**
   * Find a Voronoi/Delaunay cell at the given position.
   */
  findCellAt(position) {
    if (!position) {
      return null;
    }
    const mosaicManager = getCrystallineMosaicManager();
    if (!mosaicManager) {
      return null;
    }
    return mosaicManager.findCellAt(position);
  }

  /**
   * Toggle focus on a Voronoi/Delaunay cell.
   */
  toggleCellFocus(cell) {
    if (!cell) {
      this.clearFocusedCell();
      return;
    }
    if (this.focusedCellId === cell.id) {
      this.clearFocusedCell();
    } else {
      this.setFocusedCell(cell);
    }
  }

  /**
   * Set focused cell.
   */
  setFocusedCell(cell) {
    if (!cell) {
      this.clearFocusedCell();
      return;
    }
    this.focusedCellId = cell.id;
  }

  /**
   * Clear focused cell.
   */
  clearFocusedCell() {
    this.focusedCellId = null;
  }

  /**
   * Get the currently focused cell.
   */
  getFocusedCell() {
    if (!this.focusedCellId) {
      return null;
    }
    const mosaicManager = getCrystallineMosaicManager();
    if (!mosaicManager) {
      return null;
    }
    return mosaicManager.getCellById(this.focusedCellId);
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

    // Gracefully skip over any cleared enemy slots so tooltip updates never crash the render loop.
    const enemy = this.enemies.find((candidate) => candidate?.id === this.hoverEnemy.enemyId);
    if (!enemy || !this.pointerPosition) {
      this.clearEnemyHover();
      return;
    }

    this.renderEnemyTooltip(enemy);
  }

  /**
   * Apply infinity tower bonuses to all towers within range.
   * Infinity towers provide an exponential damage boost based on total tower count.
   */
  applyInfinityBonuses() {
    if (this.infinityTowers.length === 0) {
      return;
    }

    // Calculate the exponent based on player's unspent thero (money)
    const unspentThero = Math.max(1, Number.isFinite(this.energy) ? this.energy : 1);
    const exponent = calculateInfinityExponent(unspentThero);

    // For each infinity tower, apply bonuses to towers in range
    this.infinityTowers.forEach((infinityTower) => {
      const towersInRange = getTowersInInfinityRange(
        infinityTower,
        this.towers,
        (x1, y1, x2, y2) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          return Math.sqrt(dx * dx + dy * dy) / metersToPixels(1);
        }
      );

      // Apply bonus to each tower in range
      towersInRange.forEach((tower) => {
        if (tower.type === 'infinity') {
          return; // Don't boost itself
        }

        // Store original damage if not already stored
        if (!Number.isFinite(tower.baseDamageBeforeInfinity)) {
          tower.baseDamageBeforeInfinity = tower.damage || tower.baseDamage || 0;
        }

        // Get the base multiplier from infinity tower equation
        const infinityBlueprint = getTowerEquationBlueprint('infinity');
        let baseMultiplier = Math.E; // Default to Euler's number
        if (infinityBlueprint) {
          const multiplierValue = computeTowerVariableValue('infinity', 'bonusMultiplier', infinityBlueprint);
          baseMultiplier = Number.isFinite(multiplierValue) && multiplierValue > 0 ? multiplierValue : Math.E;
        }

        // Apply the infinity bonus
        const boostedDamage = applyInfinityBonus(
          tower.baseDamageBeforeInfinity,
          exponent,
          baseMultiplier
        );
        tower.damage = boostedDamage;

        // Mark this tower as affected by infinity for visual effects
        if (!tower.infinityAffected) {
          tower.infinityAffected = [];
        }
        if (!tower.infinityAffected.includes(infinityTower.id)) {
          tower.infinityAffected.push(infinityTower.id);
        }
      });
    });
  }

  handleInfinityTowerAdded(tower) {
    if (!tower || tower.type !== 'infinity') {
      return;
    }
    this.infinityTowers.push(tower);
    this.applyInfinityBonuses();
  }

  handleInfinityTowerRemoved(tower) {
    if (!tower || tower.type !== 'infinity') {
      return;
    }
    const index = this.infinityTowers.findIndex((t) => t.id === tower.id);
    if (index >= 0) {
      this.infinityTowers.splice(index, 1);
    }

    // Reset all tower damages affected by this infinity tower
    this.towers.forEach((t) => {
      if (t.infinityAffected && t.infinityAffected.includes(tower.id)) {
        t.infinityAffected = t.infinityAffected.filter((id) => id !== tower.id);
        if (t.infinityAffected.length === 0 && Number.isFinite(t.baseDamageBeforeInfinity)) {
          t.damage = t.baseDamageBeforeInfinity;
          delete t.baseDamageBeforeInfinity;
          delete t.infinityAffected;
        }
      }
    });

    // Reapply remaining infinity bonuses
    this.applyInfinityBonuses();
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
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.addTowerAt(normalized, options);
    }
    return false;
  }

  /**
   * Promote a lattice to its next tier while mirroring the merge flow’s cost and unlock handling.
   */
  upgradeTowerTier(
    tower,
    { silent = false, expectedNextId = null, quotedCost = null, swipeVector = null } = {},
  ) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.upgradeTowerTier(tower, { silent, expectedNextId, quotedCost, swipeVector });
    }
    return false;
  }

  demoteTowerTier(tower, { silent = false, swipeVector = null } = {}) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.demoteTowerTier(tower, { silent, swipeVector });
    }
    return false;
  }

  sellTower(tower, { slot, silent = false } = {}) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.sellTower(tower, { slot, silent });
    }
  }

  /**
   * Retrieve a lattice reference by identifier.
   */
  getTowerById(towerId) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.getTowerById(towerId);
    }
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
      towerType: null,
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
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.areTowersConnectionCompatible(source, target);
    }
    return false;
  }

  /**
   * Remove every connection touching the provided lattice.
   */
  removeAllConnectionsForTower(tower) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.removeAllConnectionsForTower(tower);
    }
  }

  /**
   * Register a directed resource link between two lattices.
   */
  addTowerConnection(source, target) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.addTowerConnection(source, target);
    }
    return false;
  }

  /**
   * Tear down an existing resource link between two lattices.
   */
  removeTowerConnection(source, target) {
    // Delegate to TowerOrchestrationController
    if (this.towerOrchestrationController) {
      return this.towerOrchestrationController.removeTowerConnection(source, target);
    }
    return false;
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
    const towerLabel = tower.type === 'omicron'
      ? 'ο wing'
      : tower.type === 'upsilon'
        ? 'υ flight'
        : 'Δ cohort';
    dragState.currentPosition = position ? { x: position.x, y: position.y } : null;
    if (!position) {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
      }
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
      dragState.trackDistance = Infinity;
      return;
    }

    const projection = this.getClosestPointOnPath(position);
    if (!projection?.point) {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
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
        this.messageEl.textContent = `Release to anchor the ${towerLabel} to the glyph lane.`;
      }
      dragState.anchorAvailable = true;
    } else {
      if (dragState.anchorAvailable && this.messageEl) {
        this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
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
    let assigned = false;
    if (tower.type === 'omicron') {
      assigned = this.assignOmicronTrackHoldAnchor(tower, anchor);
    } else if (tower.type === 'upsilon') {
      assigned = this.assignUpsilonTrackHoldAnchor(tower, anchor);
    } else {
      assigned = this.assignDeltaTrackHoldAnchor(tower, anchor);
    }
    if (assigned) {
      if (this.audio && typeof this.audio.playSfx === 'function') {
        this.audio.playSfx('uiConfirm');
      }
      if (this.messageEl) {
        const towerLabel = tower.type === 'omicron'
          ? 'ο wing anchor locked to the glyph lane.'
          : tower.type === 'upsilon'
            ? 'υ flight path locked to the glyph lane.'
            : 'Δ cohort orbit anchored to the glyph lane.';
        this.messageEl.textContent = towerLabel;
      }
      if (!this.shouldAnimate) {
        this.draw();
      }
    }
    return assigned;
  }

  // ========================================================================
  // Connection System - Delegated to ConnectionSystem
  // ========================================================================

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

    // Check for Voronoi/Delaunay cell overlap
    const cellAtPosition = this.findCellAt(position);
    if (cellAtPosition && !cellAtPosition.isDestroyed) {
      return { valid: false, reason: 'Cannot place tower on crystalline formation.', position };
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
    let normalized = angle % TWO_PI;
    if (normalized < 0) {
      normalized += TWO_PI;
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
      diff = Math.abs(diff - TWO_PI);
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
    if (!this.levelActive || !this.levelConfig || !this.combatStateManager) {
      return;
    }
    if (this.combatStateManager.isCombatActive()) {
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
    
    // Start combat through the manager
    this.combatStateManager.startCombat({
      startingWaveIndex: 0,
      startingLives: this.levelConfig.lives,
      startingEnergy: this.levelConfig.startThero || 0,
      endless: this.startInEndlessMode || false,
      endlessCycleStart: 0,
      initialSpawnDelay: this.initialSpawnDelay,
    });
    
    // Reset non-combat-state systems
    this.resetChiSystems();
    this.projectiles = [];
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
      this.gammaStarBursts = [];
    this.gammaStarBursts = [];
    this.nuBursts = [];
    this.swarmClouds = [];
    this.startCombatStatsSession();

    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = 'Wave Running';
    }
    if (this.messageEl) {
      const activeWave = this.combatStateManager.getCurrentWave();
      const waveNumber = this.combatStateManager.getWaveNumber();
      this.messageEl.textContent = `Wave ${waveNumber} — ${activeWave.config.label} advance.`;
    }
    this.updateHud();
    this.updateProgress();
  }

  // Delegate to combat state manager for combat state properties
  get enemies() {
    return this.combatStateManager ? this.combatStateManager.getEnemies() : [];
  }
  
  set enemies(value) {
    // Allow direct assignment in preview mode or when manager doesn't exist
    if (!this.combatStateManager) {
      // No-op when no manager exists (preview mode)
      return;
    }
  }
  
  get energy() {
    return this.combatStateManager ? this.combatStateManager.getEnergy() : 0;
  }
  
  set energy(value) {
    if (this.combatStateManager) {
      this.combatStateManager.setEnergy(value);
    }
  }
  
  get lives() {
    return this.combatStateManager ? this.combatStateManager.getLives() : 0;
  }
  
  set lives(value) {
    if (this.combatStateManager) {
      this.combatStateManager.setLives(value);
    }
  }
  
  get waveIndex() {
    return this.combatStateManager ? this.combatStateManager.getWaveIndex() : 0;
  }

  set waveIndex(value) {
    // No-op setter for backward compatibility. The combat manager owns this state.
  }
  
  get waveTimer() {
    return this.combatStateManager ? this.combatStateManager.getWaveTimer() : 0;
  }
  
  get activeWave() {
    return this.combatStateManager ? this.combatStateManager.getCurrentWave() : null;
  }

  set activeWave(value) {
    // No-op setter for backward compatibility. The combat manager owns this state.
  }
  
  get currentWaveNumber() {
    return this.combatStateManager ? this.combatStateManager.getWaveNumber() : 1;
  }

  set currentWaveNumber(value) {
    // No-op setter for backward compatibility. The combat manager owns this state.
  }
  
  get maxWaveReached() {
    return this.combatStateManager ? this.combatStateManager.getMaxWaveReached() : 0;
  }

  set maxWaveReached(value) {
    // No-op setter for backward compatibility. The combat manager owns this state.
  }
  
  get isEndlessMode() {
    return this.combatStateManager ? this.combatStateManager.isEndless() : false;
  }
  
  get endlessCycle() {
    return this.combatStateManager ? this.combatStateManager.getEndlessCycle() : 0;
  }
  
  get combatActive() {
    return this.combatStateManager ? this.combatStateManager.isCombatActive() : false;
  }
  
  set combatActive(value) {
    if (this.combatStateManager) {
      this.combatStateManager.setCombatActive(value);
    }
  }
  
  get resolvedOutcome() {
    return this.combatStateManager ? this.combatStateManager.getOutcome() : null;
  }

  set resolvedOutcome(value) {
    // The combat state manager owns the outcome state.
    // Setting this directly is a no-op, but we allow it for backward compatibility
    // with code that sets this.resolvedOutcome = 'victory' or 'defeat'.
    // The manager should have already set the outcome through its own logic.
  }

  // ==================== TowerOrchestrationController Property Delegation ====================
  // Property delegation pattern: Provide getters/setters that forward to the tower orchestration controller
  // to maintain backward compatibility while extracting state management.
  
  get towers() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.towers : [];
  }
  
  set towers(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.towers = value;
    }
  }
  
  get infinityTowers() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.infinityTowers : [];
  }
  
  set infinityTowers(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.infinityTowers = value;
    }
  }
  
  get towerIdCounter() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.towerIdCounter : 0;
  }
  
  set towerIdCounter(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.towerIdCounter = value;
    }
  }
  
  get towerConnectionMap() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.towerConnectionMap : new Map();
  }
  
  set towerConnectionMap(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.towerConnectionMap = value;
    }
  }
  
  get towerConnectionSources() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.towerConnectionSources : new Map();
  }
  
  set towerConnectionSources(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.towerConnectionSources = value;
    }
  }
  
  get towerGlyphTransitions() {
    return this.towerOrchestrationController ? this.towerOrchestrationController.towerGlyphTransitions : new Map();
  }
  
  set towerGlyphTransitions(value) {
    if (this.towerOrchestrationController) {
      this.towerOrchestrationController.towerGlyphTransitions = value;
    }
  }
  
  get baseWaveCount() {
    return this.levelConfig?.waves?.length || 0;
  }

  // ==================== DeveloperToolsService Property Delegation ====================
  // Property delegation pattern: Provide getters/setters that forward to the developer tools service
  // to maintain backward compatibility while extracting developer-only functionality.
  
  get developerCrystals() {
    return this.developerTools ? this.developerTools.crystals : [];
  }
  
  get crystalShards() {
    return this.developerTools ? this.developerTools.shards : [];
  }
  
  get crystalIdCounter() {
    return this.developerTools ? this.developerTools.crystalIdCounter : 0;
  }
  
  get focusedCrystalId() {
    return this.developerTools ? this.developerTools.focusedCrystalId : null;
  }
  
  // Crystal management methods
  getCrystalRadius(crystal) {
    return this.developerTools ? this.developerTools.getCrystalRadius(crystal) : 0;
  }
  
  getCrystalPosition(crystal) {
    return this.developerTools ? this.developerTools.getCrystalPosition(crystal) : null;
  }
  
  addDeveloperCrystal(normalized, options = {}) {
    return this.developerTools ? this.developerTools.addDeveloperCrystal(normalized, options) : false;
  }
  
  clearDeveloperCrystals(options = {}) {
    return this.developerTools ? this.developerTools.clearDeveloperCrystals(options) : 0;
  }
  
  getFocusedCrystal() {
    return this.developerTools ? this.developerTools.getFocusedCrystal() : null;
  }
  
  setFocusedCrystal(crystal, options = {}) {
    if (this.developerTools) {
      this.developerTools.setFocusedCrystal(crystal, options);
    }
  }
  
  clearFocusedCrystal(options = {}) {
    return this.developerTools ? this.developerTools.clearFocusedCrystal(options) : false;
  }
  
  toggleCrystalFocus(crystal) {
    if (this.developerTools) {
      this.developerTools.toggleCrystalFocus(crystal);
    }
  }
  
  findCrystalAt(position) {
    return this.developerTools ? this.developerTools.findCrystalAt(position) : null;
  }
  
  createCrystalFracture(crystal, options = {}) {
    if (this.developerTools) {
      this.developerTools.createCrystalFracture(crystal, options);
    }
  }
  
  spawnCrystalShards(origin, baseRadius, options = {}) {
    if (this.developerTools) {
      this.developerTools.spawnCrystalShards(origin, baseRadius, options);
    }
  }
  
  applyCrystalHit(crystal, damage, options = {}) {
    if (this.developerTools) {
      this.developerTools.applyCrystalHit(crystal, damage, options);
    }
  }
  
  updateCrystals(delta) {
    if (this.developerTools) {
      this.developerTools.updateCrystals(delta);
    }
  }
  
  removeDeveloperCrystal(crystalId) {
    return this.developerTools ? this.developerTools.removeDeveloperCrystal(crystalId) : false;
  }
  
  // Developer tower management methods
  addDeveloperTower(normalized, options = {}) {
    return this.developerTools ? this.developerTools.addDeveloperTower(normalized, options) : false;
  }
  
  clearDeveloperTowers(options = {}) {
    return this.developerTools ? this.developerTools.clearDeveloperTowers(options) : 0;
  }
  
  findDeveloperTowerAt(position) {
    return this.developerTools ? this.developerTools.findDeveloperTowerAt(position) : null;
  }
  
  removeDeveloperTower(towerId) {
    return this.developerTools ? this.developerTools.removeDeveloperTower(towerId) : false;
  }

  getCycleMultiplier() {
    return this.combatStateManager
      ? this.combatStateManager.getCycleMultiplier()
      : 1;
  }

  // Derive an additive 10% speed scalar for each endless cycle to keep pacing approachable.
  getCycleSpeedScalar() {
    return this.combatStateManager
      ? this.combatStateManager.getCycleSpeedScalar()
      : 1;
  }

  computeWaveNumber(index) {
    return this.combatStateManager
      ? this.combatStateManager.computeWaveNumber(index)
      : 0;
  }

  markWaveStart() {
    // This method is no longer needed as the manager handles wave start marking
    // Keep it for compatibility but delegate to manager
    if (this.combatStateManager) {
      // Manager handles this internally
    }
  }

  createWaveState(config, options = {}) {
    // This method is no longer needed as the manager creates wave states internally
    // Keep it for backward compatibility during migration
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
  // Delegate to wave formatter
  formatEnemyExponentLabel(exponent, hpValue) {
    return this.waveFormatter 
      ? this.waveFormatter.formatEnemyExponentLabel(exponent, hpValue)
      : '10^0.0 (0)';
  }

  /**
   * Format an enemy speed value for UI consumption using consistent units.
   * Delegates to WaveUIFormatter.
   */
  formatEnemySpeed(speed) {
    return this.waveFormatter 
      ? this.waveFormatter.formatEnemySpeed(speed)
      : '—';
  }

  updateTrackRiverParticles(delta) {
    if (!Array.isArray(this.trackRiverParticles) || !this.trackRiverParticles.length) {
      return;
    }

    const dt = Math.max(0, Math.min(delta, 0.08));
    this.trackRiverPulse = Number.isFinite(this.trackRiverPulse) ? this.trackRiverPulse : 0;
    this.trackRiverPulse += dt * 0.6;
    const fullTurn = TWO_PI;
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
      // Update crystalline background mosaic
      const mosaicManager = getCrystallineMosaicManager();
      if (mosaicManager) {
        mosaicManager.update(speedDelta * 1000); // Convert to milliseconds for animation
      }
      // Drift ambient swimmers before the wider floater network updates.
      this.updateBackgroundSwimmers(speedDelta);
      this.updateFloaters(speedDelta);
      this.updateTrackRiverParticles(speedDelta);
      this.updateFocusIndicator(speedDelta);
      this.updateAlphaBursts(speedDelta);
      this.updateBetaBursts(speedDelta);
      this.updateGammaBursts(speedDelta);
      this.updateGammaStarBursts(speedDelta);
      this.updateNuBursts(speedDelta);
      this.updateCrystals(speedDelta);
      this.updateConnectionParticles(speedDelta);
      this.updateSwarmClouds(speedDelta);
      this.updateTowerGlyphTransitions(speedDelta);
      this.updateDamageNumbers(speedDelta);
      // Advance collapse shards so fallen enemies leave a brief, graceful trail.
      this.updateEnemyDeathParticles(speedDelta);
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

    // Update enemies and spawn logic only while combat is active
    if (this.combatActive) {
      // Group enemy spawning and marching updates to weigh pathfinding cost.
      const finishEnemySegment = beginPerformanceSegment('update:enemies');
      try {
        this.spawnEnemies(speedDelta);
        this.updateEnemies(speedDelta);
        this.updateChiThralls(speedDelta);
        this.updateChiLightTrails(speedDelta);
      } finally {
        finishEnemySegment();
      }
    }

    // Keep unique tower behaviors alive even while waves are paused or after victory.
    // Keep a tower bucket active so idle behaviors and maintenance are tracked.
    const finishTowerSegment = beginPerformanceSegment('update:towers');
    try {
      if (this.combatActive) {
        this.updateTowers(speedDelta);
      } else {
        // When combat is paused or finished, only update towers with special maintenance needs
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
      }
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

  // Delegate to wave formatter
  calculateHealthExponent(hp) {
    return this.waveFormatter 
      ? this.waveFormatter.calculateHealthExponent(hp)
      : 0;
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

  resolvePolygonSides(config = {}) {
    if (Number.isFinite(config.polygonSides)) {
      return Math.max(1, Math.floor(config.polygonSides));
    }
    if (config && typeof config.codexId === 'string' && config.codexId === 'polygon-splitter') {
      return DEFAULT_POLYGON_SIDES;
    }
    return null;
  }

  // Delegate to wave formatter
  resolvePolygonSymbol(sides) {
    return this.waveFormatter 
      ? this.waveFormatter.resolvePolygonSymbol(sides)
      : null;
  }

  resolveNextPolygonSides(currentSides) {
    const normalized = Number.isFinite(currentSides) ? Math.max(1, Math.floor(currentSides)) : 0;
    if (normalized <= 1) {
      return 0;
    }
    return normalized - 1;
  }

  // Delegate to wave formatter
  resolveEnemySymbol(config = {}) {
    return this.waveFormatter 
      ? this.waveFormatter.resolveEnemySymbol(config)
      : '◈';
  }

  spawnEnemies(delta) {
    if (!this.combatStateManager || !this.levelConfig) {
      return;
    }
    
    // Delegate to combat state manager for spawning
    const spawnContext = {
      pathPoints: this.pathPoints,
      radialSpawn: this.levelConfig.radialSpawn && this.levelConfig.centerSpawn,
      registerEnemy: (enemy) => {
        // Enhance enemy with playfield-specific properties
        const polygonSides = this.resolvePolygonSides(enemy);
        const symbol = this.resolveEnemySymbol({ ...enemy, polygonSides });
        const maxHp = Number.isFinite(enemy.hp) ? Math.max(1, enemy.hp) : 1;
        const hpExponent = this.calculateHealthExponent(maxHp);
        const gemDropMultiplier = resolveEnemyGemDropMultiplier(enemy);
        
        Object.assign(enemy, {
          progress: 0,
          baseSpeed: enemy.speed,
          moteFactor: this.calculateMoteFactor(enemy),
          symbol,
          polygonSides,
          hpExponent,
          gemDropMultiplier,
        });
        
        // Handle radial spawn positioning
        if (spawnContext.radialSpawn) {
          const edge = Math.floor(Math.random() * 4);
          const offset = Math.random();
          const spawnMargin = RADIAL_SPAWN_OFFSCREEN_MARGIN;
          
          let spawnX, spawnY;
          if (edge === 0) {
            spawnX = offset;
            spawnY = -spawnMargin;
          } else if (edge === 1) {
            spawnX = 1 + spawnMargin;
            spawnY = offset;
          } else if (edge === 2) {
            spawnX = offset;
            spawnY = 1 + spawnMargin;
          } else {
            spawnX = -spawnMargin;
            spawnY = offset;
          }
          
          enemy.radialSpawnX = spawnX;
          enemy.radialSpawnY = spawnY;
          enemy.pathMode = 'direct';
        }
        
        this.scheduleStatsPanelRefresh();
      },
    };
    
    this.combatStateManager.spawnEnemies(delta, spawnContext);
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
        if (tower.type === 'rho') {
          this.updateRhoTower(tower, delta);
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
        if (tower.type === 'tau') {
          this.updateTauTower(tower, delta);
        }
        if (tower.type === 'upsilon') {
          this.updateUpsilonTower(tower, delta);
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
        if (tower.type === 'phi') {
          this.updatePhiTower(tower, delta);
        }
        if (tower.type === 'psi') {
          this.updatePsiTower(tower, delta);
          return;
        }
        if (tower.type === 'omega') {
          this.updateOmegaTower(tower, delta);
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
   * Update gamma star burst effects on enemies that were hit by gamma projectiles.
   */
  updateGammaStarBursts(delta) {
    if (!Array.isArray(this.gammaStarBursts) || this.gammaStarBursts.length === 0) {
      return;
    }
    
    const sequence = GAMMA_STAR_SEQUENCE;
    
    for (let i = this.gammaStarBursts.length - 1; i >= 0; i--) {
      const burst = this.gammaStarBursts[i];
      burst.lifetime = (burst.lifetime || 0) + delta;
      burst.starElapsed = (burst.starElapsed || 0) + delta;
      
      // Remove if lifetime exceeded
      if (burst.lifetime >= burst.maxLifetime) {
        this.gammaStarBursts.splice(i, 1);
        continue;
      }
      
      // Update center to track enemy if it still exists
      const enemy = this.enemies.find(e => e && e.id === burst.enemyId);
      if (enemy) {
        const enemyPos = this.getEnemyPosition(enemy);
        if (enemyPos) {
          burst.center = { ...enemyPos };
        }
      }
      
      // Update star tracing animation
      const edgeIndex = Number.isFinite(burst.starEdgeIndex) ? burst.starEdgeIndex : 0;
      const atEndOfSequence = edgeIndex >= sequence.length - 1;
      
      if (atEndOfSequence && burst.burstDuration <= 0) {
        this.gammaStarBursts.splice(i, 1);
        continue;
      }
      
      if (atEndOfSequence && burst.burstDuration > 0 && burst.starElapsed >= burst.burstDuration) {
        this.gammaStarBursts.splice(i, 1);
        continue;
      }
      
      if (atEndOfSequence && burst.burstDuration > 0) {
        burst.starEdgeIndex = 0;
        burst.starEdgeProgress = 0;
        continue;
      }
      
      // Calculate star edge distance and progress
      const radius = burst.starRadius || 22;
      const angles = [];
      for (let step = 0; step < 5; step += 1) {
        angles.push(-HALF_PI + (step * TWO_PI) / 5);
      }
      const starPoints = angles.map((angle) => ({
        x: burst.center.x + Math.cos(angle) * radius,
        y: burst.center.y + Math.sin(angle) * radius,
      }));
      
      const fromIndex = sequence[edgeIndex];
      const toIndex = sequence[edgeIndex + 1];
      const fromPoint = starPoints[fromIndex];
      const toPoint = starPoints[toIndex];
      
      if (!fromPoint || !toPoint) {
        this.gammaStarBursts.splice(i, 1);
        continue;
      }
      
      const edgeDistance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y) || 1;
      const starSpeed = burst.starSpeed || GAMMA_STAR_SPEED;
      const edgeDuration = Math.max(0.0001, edgeDistance / Math.max(1, starSpeed));
      const progress = Math.min(1, (burst.starEdgeProgress || 0) + delta / edgeDuration);
      
      burst.currentPosition = {
        x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
        y: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
      };
      burst.starEdgeProgress = progress;
      
      if (progress >= 1) {
        burst.starEdgeIndex = edgeIndex + 1;
        burst.starEdgeProgress = 0;
      }
    }
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
    let bestStrength = priority === 'weakest' ? Infinity : -Infinity;
    this.enemies.forEach((enemy) => {
      // Skip any cleared enemy slots so null placeholders don't break targeting.
      if (!enemy) {
        return;
      }
      const position = this.getEnemyPosition(enemy);
      if (!position) {
        return;
      }
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
      if (priority === 'weakest') {
        const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
        if (strength < bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
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

  // Apply mitigation from derivative shield carriers before other multipliers modify the strike.
  applyDerivativeShieldMitigation(enemy, baseDamage) {
    if (!enemy || !enemy.derivativeShield || !Number.isFinite(baseDamage) || baseDamage <= 0) {
      return baseDamage;
    }
    const effect = enemy.derivativeShield;
    if (!effect.active) {
      return baseDamage;
    }
    if (effect.mode === 'sqrt') {
      return Math.max(0, Math.sqrt(baseDamage));
    }
    const stack = Number.isFinite(effect.stack) && effect.stack >= 0 ? effect.stack : 0;
    const mitigation = Math.pow(0.5, stack + 1);
    effect.stack = stack + 1;
    return Math.max(0, baseDamage * mitigation);
  }

  /**
   * Track when a debuff first lands on an enemy so the renderer can order icons chronologically.
   */
  registerEnemyDebuff(enemy, type) {
    if (!enemy || !type) {
      return;
    }
    if (!Array.isArray(enemy.debuffIndicators)) {
      enemy.debuffIndicators = [];
    }
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const existing = enemy.debuffIndicators.find((entry) => entry?.type === type);
    if (existing) {
      existing.lastSeen = now;
      return;
    }
    enemy.debuffIndicators.push({ type, appliedAt: now, lastSeen: now });
  }

  /**
   * Resolve which debuffs are active on an enemy so visual indicators stay in sync with game logic.
   */
  resolveActiveDebuffTypes(enemy) {
    const activeTypes = [];
    if (!enemy) {
      return activeTypes;
    }

    const amplifierActive =
      (enemy.damageAmplifiers instanceof Map && enemy.damageAmplifiers.size > 0) ||
      (enemy.damageAmplifiers && typeof enemy.damageAmplifiers === 'object' &&
        Object.keys(enemy.damageAmplifiers).length > 0) ||
      (Number.isFinite(enemy.iotaInversionTimer) && enemy.iotaInversionTimer > 0);
    if (amplifierActive) {
      activeTypes.push('iota');
    }

    const slowEffects = enemy.slowEffects;
    const thetaActive = slowEffects instanceof Map
      ? Array.from(slowEffects.values()).some((effect) => effect?.type === 'theta')
      : slowEffects && typeof slowEffects === 'object'
        ? Object.values(slowEffects).some((effect) => effect?.type === 'theta')
        : false;
    if (thetaActive) {
      activeTypes.push('theta');
    }

    if (Number.isFinite(enemy.rhoSparkleTimer) && enemy.rhoSparkleTimer > 0) {
      activeTypes.push('rho');
    }

    if (enemy.derivativeShield && enemy.derivativeShield.active) {
      activeTypes.push('derivative-shield');
    }

    return activeTypes;
  }

  /**
   * Ensure the debuff indicator list only includes active effects while preserving first-seen order.
   */
  syncEnemyDebuffIndicators(enemy, activeTypes = []) {
    if (!enemy) {
      return [];
    }
    if (!Array.isArray(enemy.debuffIndicators)) {
      enemy.debuffIndicators = [];
    }
    const activeSet = new Set(activeTypes);
    enemy.debuffIndicators = enemy.debuffIndicators.filter(
      (entry) => entry && activeSet.has(entry.type),
    );
    if (!activeSet.size) {
      return enemy.debuffIndicators;
    }
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    activeTypes.forEach((type) => {
      const existing = enemy.debuffIndicators.find((entry) => entry?.type === type);
      if (existing) {
        existing.lastSeen = now;
        return;
      }
      enemy.debuffIndicators.push({ type, appliedAt: now, lastSeen: now });
    });
    enemy.debuffIndicators.sort((a, b) => (a?.appliedAt || 0) - (b?.appliedAt || 0));
    return enemy.debuffIndicators;
  }

  /**
   * Provide ordered debuff metadata to the renderer with pre-resolved glyphs for each effect.
   */
  getEnemyDebuffIndicators(enemy) {
    if (!enemy) {
      return [];
    }
    const activeTypes = this.resolveActiveDebuffTypes(enemy);
    const entries = this.syncEnemyDebuffIndicators(enemy, activeTypes);
    return entries.map((entry) => ({
      type: entry.type,
      symbol: DEBUFF_ICON_SYMBOLS[entry.type] || entry.type?.[0] || '·',
    }));
  }

  applyDamageToEnemy(enemy, baseDamage, { sourceTower } = {}) {
    if (!enemy || !Number.isFinite(baseDamage) || baseDamage <= 0) {
      return 0;
    }
    
    // Check if enemy is in a tunnel - if so, they cannot take damage
    const tunnelState = this.getEnemyTunnelState(enemy);
    if (tunnelState.inTunnel) {
      // Enemy is in a tunnel, show "Miss" instead of damage
      this.spawnMissText(enemy);
      return 0;
    }
    
    const mitigatedBase = this.applyDerivativeShieldMitigation(enemy, baseDamage);
    const multiplier = this.computeEnemyDamageMultiplier(enemy);
    const applied = mitigatedBase * multiplier;
    const hpBefore = Number.isFinite(enemy.hp) ? enemy.hp : 0;
    if (Number.isFinite(enemy.hp)) {
      enemy.hp -= applied;
    } else {
      enemy.hp = -applied;
    }
    if (sourceTower) {
      this.recordDamageEvent({ tower: sourceTower, enemy, damage: applied });
    }
    // Pass through pre-hit HP so the renderer can scale the damage number impact.
    this.spawnDamageNumber(enemy, applied, { sourceTower, enemyHpBefore: hpBefore });
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

  // Helper to create a damage projectile with travel time for towers that use particle bursts
  createParticleDamageProjectile(tower, enemy, effectPosition, resolvedDamage, baseTravelSpeed) {
    if (!tower || !enemy || !resolvedDamage || resolvedDamage <= 0) {
      return;
    }
    if (!Number.isFinite(baseTravelSpeed) || baseTravelSpeed <= 0) {
      baseTravelSpeed = 300; // Default fallback speed
    }
    const sourcePosition = { x: tower.x, y: tower.y };
    const targetPosition = effectPosition || sourcePosition;
    const travelDistance = Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.y - sourcePosition.y);
    const travelTime = Math.max(0.08, travelDistance / baseTravelSpeed);
    const maxLifetime = Math.max(0.24, travelTime);
    this.projectiles.push({
      source: sourcePosition,
      targetId: enemy.id,
      target: targetPosition,
      lifetime: 0,
      maxLifetime,
      travelTime,
      damage: resolvedDamage,
      towerId: tower.id,
      hitRadius: this.getStandardShotHitRadius(),
    });
  }

  // Alternate β triangle shots so successive returns mirror across the firing line.
  resolveNextBetaTriangleOrientation(tower) {
    if (!tower) {
      return 1;
    }
    const lastOrientation = Number.isFinite(tower.nextBetaTriangleOrientation)
      ? tower.nextBetaTriangleOrientation
      : 1;
    const orientation = lastOrientation === -1 ? -1 : 1;
    tower.nextBetaTriangleOrientation = orientation * -1;
    return orientation;
  }

  // Apply the β slow formula while a triangle bolt is attached to an enemy.
  applyBetaStickSlow(enemy, tower, glyphRank = 0) {
    if (!enemy || !tower) {
      return;
    }
    const bet1 = Math.max(0, Number.isFinite(glyphRank) ? glyphRank : 0);
    const slowPercent = Math.min(60, 20 + 2 * bet1);
    const multiplier = Math.max(0, 1 - slowPercent / 100);
    const slwTime = computeTowerVariableValue('beta', 'slwTime');
    const slowDurationSeconds = Number.isFinite(slwTime)
      ? Math.max(0, slwTime)
      : BETA_SLOW_DURATION_SECONDS;
    const expiresAt =
      (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) /
      1000 +
      slowDurationSeconds;
    if (!(enemy.slowEffects instanceof Map)) {
      enemy.slowEffects = new Map();
    }
    enemy.slowEffects.set(tower.id, {
      type: 'beta',
      multiplier,
      slowPercent,
      expiresAt,
    });
  }

  // Spawn a β projectile that sticks to enemies, applies slow ticks, and traces a returning triangle.
  spawnBetaTriangleProjectile(tower, enemy, effectPosition, resolvedDamage, triangleOrientation = 1) {
    if (!tower || !enemy || !resolvedDamage || resolvedDamage <= 0) {
      return;
    }
    const attackValue = computeTowerVariableValue('beta', 'attack');
    const alphaValue = Math.max(1e-6, calculateTowerEquationResult('alpha'));
    const bet1 = Math.max(0, attackValue / alphaValue);
    this.projectiles.push({
      patternType: 'betaTriangle',
      towerId: tower.id,
      damage: resolvedDamage,
      position: { x: tower.x, y: tower.y },
      previousPosition: { x: tower.x, y: tower.y },
      origin: { x: tower.x, y: tower.y },
      targetId: enemy.id,
      targetPosition: effectPosition || { x: tower.x, y: tower.y },
      hitRadius: this.getStandardShotHitRadius(),
      speed: BETA_TRIANGLE_SPEED,
      phase: 'seek',
      bet1,
      lifetime: 0,
      maxLifetime: 10,
      triangleOrientation: Number.isFinite(triangleOrientation)
        ? Math.sign(triangleOrientation) || 1
        : 1,
    });
  }

  // Spawn a γ projectile that shoots straight to the screen edge, piercing all enemies and spawning star bursts on each hit.
  spawnGammaStarProjectile(tower, enemy, effectPosition, resolvedDamage) {
    if (!tower || !resolvedDamage || resolvedDamage <= 0) {
      return;
    }
    
    // Calculate direction from tower to target (or enemy position if available)
    const targetPos = effectPosition || (enemy ? this.getEnemyPosition(enemy) : null);
    if (!targetPos) {
      return;
    }
    
    const dx = targetPos.x - tower.x;
    const dy = targetPos.y - tower.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 0.1) {
      return; // No valid direction
    }
    
    // Calculate direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Calculate screen edge position in this direction
    const renderWidth = this.renderWidth || 800;
    const renderHeight = this.renderHeight || 600;
    
    // Find intersection with screen edges
    let endX, endY;
    const tX = dirX > 0 ? (renderWidth - tower.x) / dirX : (0 - tower.x) / dirX;
    const tY = dirY > 0 ? (renderHeight - tower.y) / dirY : (0 - tower.y) / dirY;
    const t = Math.min(Math.abs(tX), Math.abs(tY));
    
    endX = tower.x + dirX * t;
    endY = tower.y + dirY * t;
    
    // Allow the pentagram orbit to persist based on the Brst glyph allocation.
    const burstDuration = Math.max(0, computeTowerVariableValue('gamma', 'brst'));
    const beamLength = Math.hypot(endX - tower.x, endY - tower.y);
    const travelTime = beamLength / GAMMA_OUTBOUND_SPEED;
    const maxLifetime = Math.max(travelTime + 1, burstDuration + travelTime + 1);
    const minDimension = Math.max(1, Math.min(this.renderWidth || 0, this.renderHeight || 0));
    const starRadius = metersToPixels(GAMMA_STAR_RADIUS_METERS, minDimension);
    
    this.projectiles.push({
      patternType: 'gammaStar',
      towerId: tower.id,
      damage: resolvedDamage,
      position: { x: tower.x, y: tower.y },
      previousPosition: { x: tower.x, y: tower.y },
      origin: { x: tower.x, y: tower.y },
      targetPosition: { x: endX, y: endY },
      direction: { x: dirX, y: dirY },
      hitRadius: this.getStandardShotHitRadius(),
      outboundSpeed: GAMMA_OUTBOUND_SPEED,
      starSpeed: GAMMA_STAR_SPEED,
      starRadius: Math.max(12, starRadius),
      starBurstDuration: burstDuration,
      phase: 'outbound',
      hitEnemies: new Set(), // Track all enemies hit for piercing
      enemyBursts: new Map(), // Track star burst state for each enemy hit
      maxLifetime,
    });
  }

  emitTowerAttackVisuals(tower, targetInfo = {}) {
    if (!tower) {
      return;
    }
    const enemy = targetInfo.enemy || null;
    const crystal = targetInfo.crystal || null;
    const resolvedDamage = Number.isFinite(targetInfo.damage) ? Math.max(0, targetInfo.damage) : 0;
    const effectPosition =
      targetInfo.position ||
      (enemy ? this.getEnemyPosition(enemy) : crystal ? this.getCrystalPosition(crystal) : null);
    if (tower.type === 'alpha') {
      this.spawnAlphaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
      // Create a projectile for damage application when particles reach target
      this.createParticleDamageProjectile(tower, enemy, effectPosition, resolvedDamage, 300);
    } else if (tower.type === 'beta') {
      // Keep visuals and hitbox traversal aligned while alternating the return side.
      const triangleOrientation = this.resolveNextBetaTriangleOrientation(tower);
      const betaOptions = enemy
        ? { enemyId: enemy.id, triangleOrientation }
        : { triangleOrientation };
      this.spawnBetaAttackBurst(tower, { enemy, position: effectPosition }, betaOptions);
      // Launch a sticky triangle projectile that slows, multi-hits, and returns to the tower.
      this.spawnBetaTriangleProjectile(tower, enemy, effectPosition, resolvedDamage, triangleOrientation);
    } else if (tower.type === 'gamma') {
      this.spawnGammaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
      // Launch a piercing pentagram projectile that multi-hits on a return arc.
      this.spawnGammaStarProjectile(tower, enemy, effectPosition, resolvedDamage);
    } else if (tower.type === 'nu') {
      this.spawnNuAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    } else {
      const sourcePosition = { x: tower.x, y: tower.y };
      const targetPosition = effectPosition || sourcePosition;
      const hasPendingHit = enemy && resolvedDamage > 0;
      // Track a simple projectile travel time so damage is applied on impact instead of immediately on firing.
      const baseTravelSpeed = 520;
      const travelDistance = hasPendingHit
        ? Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.y - sourcePosition.y)
        : 0;
      const travelTime = hasPendingHit ? Math.max(0.08, travelDistance / baseTravelSpeed) : 0;
      const maxLifetime = hasPendingHit ? Math.max(0.24, travelTime) : 0.24;

      this.projectiles.push({
        source: sourcePosition,
        targetId: enemy ? enemy.id : null,
        targetCrystalId: crystal ? crystal.id : null,
        target: targetPosition,
        lifetime: 0,
        maxLifetime,
        travelTime,
        damage: hasPendingHit ? resolvedDamage : 0,
        towerId: tower.id,
        hitRadius: this.getStandardShotHitRadius(),
      });
    }
    if ((tower.type === 'beta' || tower.type === 'gamma' || tower.type === 'nu')) {
      this.triggerQueuedSwirlLaunches(tower, effectPosition, enemy);
    }
    if (getTowerTierValue(tower) >= 24) {
      this.spawnOmegaWave(tower);
    }
    if (this.audio) {
      playTowerFireSound(this.audio, tower.type);
    }
  }

  fireAtTarget(tower, targetInfo) {
    if (tower.type === 'delta') {
      this.deployDeltaSoldier(tower, targetInfo);
      return;
    }
    if (tower.type === 'infinity') {
      // Infinity tower doesn't attack directly, it provides aura bonuses
      return;
    }
    if (tower.type === 'xi') {
      this.fireXiChain(tower, targetInfo);
      return;
    }
    if (tower.type === 'tau') {
      this.spawnTauProjectile(tower, targetInfo);
      return;
    }
    if (tower.type === 'iota') {
      this.fireIotaPulse(tower, targetInfo);
      return;
    }
    if (tower.type === 'phi') {
      this.triggerPhiBurst(tower);
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
    // Nu tower uses a piercing laser that damages all enemies along the beam path
    if (tower.type === 'nu') {
      const start = { x: tower.x, y: tower.y };
      // Calculate the direction from tower to target
      const dx = attackPosition.x - tower.x;
      const dy = attackPosition.y - tower.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        // Extend the beam to the tower's range (or beyond target if target is closer)
        const rangePixels = Number.isFinite(tower.range) ? tower.range : 200;
        const beamLength = Math.max(distance, rangePixels);
        const dirX = dx / distance;
        const dirY = dy / distance;
        const end = {
          x: tower.x + dirX * beamLength,
          y: tower.y + dirY * beamLength,
        };
        // Apply piercing damage to all enemies along the beam
        applyNuPiercingDamageHelper(this, tower, start, end, damage);
      } else {
        // Fallback: if target is at tower position, just damage the target
        this.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
      }
      this.emitTowerAttackVisuals(tower, { enemy, position: attackPosition });
      return;
    }
    this.emitTowerAttackVisuals(tower, { enemy, position: attackPosition, damage });
  }

  /**
   * Legacy method removed - aleph chain towers have been replaced by the infinity tower.
   * The infinity tower provides aura bonuses instead of chain attacks.
   */

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
    // Scale the omega wave motes down to a tenth of their previous footprint to keep the effect readable.
    const scaledSize = (visuals.size ?? pattern.baseSize ?? 4) * 0.1;
    const baseSize = Math.max(0.3, scaledSize);
    const stage = Math.max(0, Math.floor(tier) - 24);
    const jitterStrength = 0.06 + stage * 0.02;
    const maxLifetime = Math.max(0.8, pattern.duration || 2);

    for (let index = 0; index < count; index += 1) {
      const phase = (TWO_PI * index) / count;
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
    const nowSeconds =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now() / 1000
        : Date.now() / 1000;
    const slowEffects = enemy.slowEffects;
    if (slowEffects instanceof Map) {
      let multiplier = 1;
      const stale = [];
      slowEffects.forEach((effect, key) => {
        if (!effect || !Number.isFinite(effect.multiplier)) {
          stale.push(key);
          return;
        }
        const expired = Number.isFinite(effect.expiresAt) && effect.expiresAt <= nowSeconds;
        if (expired) {
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
      const expired = Number.isFinite(effect.expiresAt) && effect.expiresAt <= nowSeconds;
      if (expired) {
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
    this.syncEnemyDebuffIndicators(enemy, this.resolveActiveDebuffTypes(enemy));
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
    this.syncEnemyDebuffIndicators(enemy, this.resolveActiveDebuffTypes(enemy));
  }

  // Apply stun effect to an enemy from stored shots
  applyStunEffect(enemy, duration, sourceId = 'stored_shots') {
    if (!enemy || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const nowSeconds = (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()) / 1000;
    const expiresAt = nowSeconds + duration;
    if (!(enemy.stunEffects instanceof Map)) {
      enemy.stunEffects = new Map();
    }
    const existing = enemy.stunEffects.get(sourceId);
    // Extend the stun duration if we're already stunned
    if (existing && Number.isFinite(existing.expiresAt)) {
      enemy.stunEffects.set(sourceId, {
        expiresAt: Math.max(existing.expiresAt, expiresAt),
      });
    } else {
      enemy.stunEffects.set(sourceId, { expiresAt });
    }
  }

  // Check if enemy is stunned and return the stun status
  isEnemyStunned(enemy) {
    if (!enemy || !(enemy.stunEffects instanceof Map)) {
      return false;
    }
    const nowSeconds = (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()) / 1000;
    const stale = [];
    let isStunned = false;
    enemy.stunEffects.forEach((effect, key) => {
      if (!effect || !Number.isFinite(effect.expiresAt)) {
        stale.push(key);
        return;
      }
      if (effect.expiresAt <= nowSeconds) {
        stale.push(key);
        return;
      }
      isStunned = true;
    });
    stale.forEach((key) => enemy.stunEffects.delete(key));
    if (enemy.stunEffects.size === 0) {
      delete enemy.stunEffects;
    }
    return isStunned;
  }

  // Clear all stun effects from an enemy
  clearEnemyStunEffects(enemy) {
    if (!enemy) {
      return;
    }
    if (enemy.stunEffects instanceof Map) {
      enemy.stunEffects.clear();
    }
    delete enemy.stunEffects;
  }

  updateEnemies(delta) {
    this.updateDerivativeShieldStates(delta);
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      // Guard against stray null slots so a missing enemy can't halt the animation loop mid-wave.
      if (!enemy) {
        this.enemies.splice(index, 1);
        continue;
      }
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
      if (Number.isFinite(enemy.rhoSparkleTimer)) {
        enemy.rhoSparkleTimer = Math.max(0, enemy.rhoSparkleTimer - delta);
        if (enemy.rhoSparkleTimer <= 0) {
          delete enemy.rhoSparkleTimer;
        }
      }
      const activeDebuffs = this.resolveActiveDebuffTypes(enemy);
      this.syncEnemyDebuffIndicators(enemy, activeDebuffs);
      const baseSpeed = Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : 0;
      const speedMultiplier = this.resolveEnemySlowMultiplier(enemy);
      const pathSpeedMultiplier = this.getPathSpeedMultiplierAtProgress(enemy.progress);
      const mapSpeedMultiplier = Number.isFinite(this.levelConfig?.mapSpeedMultiplier) 
        ? this.levelConfig.mapSpeedMultiplier 
        : 1;
      // Apply stun - stunned enemies cannot move
      const stunMultiplier = this.isEnemyStunned(enemy) ? 0 : 1;
      const effectiveSpeed = Math.max(0, baseSpeed * speedMultiplier * pathSpeedMultiplier * mapSpeedMultiplier * stunMultiplier);
      enemy.speed = effectiveSpeed;
      enemy.progress += enemy.speed * delta;
      if (enemy.progress >= 1) {
        this.clearEnemySlowEffects(enemy);
        this.enemies.splice(index, 1);
        this.handleEnemyBreach(enemy);
      }
    }
  }

  // Maintain derivative shield coverage so the mitigation state follows the projector as it marches down the path.
  updateDerivativeShieldStates(delta) {
    if (!Array.isArray(this.enemies) || !this.enemies.length) {
      return;
    }
    const shielders = this.enemies.filter((enemy) => enemy && enemy.typeId === 'derivative-shield');
    if (!shielders.length) {
      this.enemies.forEach((enemy) => {
        if (enemy && enemy.derivativeShield) {
          delete enemy.derivativeShield;
        }
      });
      return;
    }

    const activeTargets = new Set();
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    shielders.forEach((shielder) => {
      const sourcePosition = this.getEnemyPosition(shielder);
      if (!sourcePosition) {
        return;
      }
      const metrics = this.getEnemyVisualMetrics(shielder);
      const baseRadius = Math.max(12, metrics?.focusRadius || metrics?.ringRadius || 0);
      const radius = Math.max(DERIVATIVE_SHIELD_MIN_RADIUS, baseRadius * DERIVATIVE_SHIELD_RADIUS_SCALE);

      this.enemies.forEach((target) => {
        if (!target) {
          return;
        }
        const position = this.getEnemyPosition(target);
        if (!position) {
          return;
        }
        const distance = Math.hypot(position.x - sourcePosition.x, position.y - sourcePosition.y);
        if (distance > radius) {
          return;
        }
        const effect = target.derivativeShield || { stack: 0 };
        if (!Number.isFinite(effect.stack) || effect.stack < 0) {
          effect.stack = 0;
        }
        effect.mode = shielder?.isBoss ? 'sqrt' : 'halve';
        effect.lastSeen = now;
        effect.active = true;
        effect.sourceId = shielder?.id || null;
        target.derivativeShield = effect;
        if (Number.isFinite(target.id)) {
          activeTargets.add(target.id);
        }
      });
    });

    this.enemies.forEach((enemy) => {
      if (!enemy || !enemy.derivativeShield) {
        return;
      }
      const recentlyShielded =
        (Number.isFinite(enemy.id) && activeTargets.has(enemy.id)) ||
        (enemy.derivativeShield.lastSeen && now - enemy.derivativeShield.lastSeen <= DERIVATIVE_SHIELD_LINGER_MS);
      if (!recentlyShielded) {
        delete enemy.derivativeShield;
      }
    });
  }


  // Update mote gem flight so squares drift away from the lane before entering the mote tower.
  updateMoteGems(delta) {
    if (!moteGemState.active.length || !Number.isFinite(delta)) {
      return;
    }

    // Update gem suction animations and collect completed gems
    const collectedGems = updateGemSuctionAnimations(delta);
    
    // Show floating feedback for collected gems
    if (collectedGems.length > 0 && this.floatingFeedback) {
      // Group by collection point and show feedback
      const byTarget = new Map();
      collectedGems.forEach((gem) => {
        const key = `${gem.targetX},${gem.targetY}`;
        if (!byTarget.has(key)) {
          byTarget.set(key, {
            x: gem.targetX,
            y: gem.targetY,
            gems: [],
          });
        }
        byTarget.get(key).gems.push(gem);
      });

      byTarget.forEach((group) => {
        this.floatingFeedback.show({
          x: group.x,
          y: group.y,
          gems: group.gems,
        });
      });
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
      // Skip gems that are being sucked toward a target
      if (gem.suction && gem.suction.active) {
        return;
      }

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
      this.handleInfinityTowerRemoved(tower);
    });
    this.towers = [];
    this.infinityTowers = [];
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
      this.handleInfinityTowerAdded(tower);
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
    this.shouldAnimate = true;
    this.ensureLoop();

    // Reset non-combat-state systems
    this.resetChiSystems();
    this.projectiles = [];
    this.resetDamageNumbers();
    this.resetEnemyDeathParticles();
    this.resetWaveTallies();
    this.alphaBursts = [];
    this.betaBursts = [];
    this.gammaBursts = [];
      this.gammaStarBursts = [];
    this.nuBursts = [];
    this.swarmClouds = [];
    this.floaters = [];
    this.floaterConnections = [];
    // Refresh ambient swimmers so checkpoint restores regenerate the soft background motion.
    this.backgroundSwimmers = [];
    this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
    
    // Restore combat state through the manager
    if (this.combatStateManager) {
      this.combatStateManager.startCombat({
        startingWaveIndex: targetIndex,
        startingLives: Number.isFinite(snapshot.lives) ? snapshot.lives : this.levelConfig.lives,
        startingEnergy: Number.isFinite(snapshot.energy) ? snapshot.energy : 0,
        endless: true,
        endlessCycleStart: Math.max(0, Number(snapshot.endlessCycle) || 0),
        initialSpawnDelay: 0,
      });
    }
    
    this.autoWaveEnabled = snapshot.autoWaveEnabled ?? this.autoWaveEnabled;
    if (this.autoWaveCheckbox) {
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
    }
    if (Array.isArray(snapshot.availableTowers)) {
      this.availableTowers = snapshot.availableTowers.slice();
    }

    this.infinityTowers = [];
    this.restoreTowersFromCheckpoint(snapshot.towers);

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

    return true;
  }

  advanceWave() {
    if (!this.levelConfig || !this.combatStateManager) {
      return;
    }

    // Surface end-of-wave tallies before the next wave (or victory) begins.
    this.spawnWaveCompletionTallies();

    // For endless checkpoint capture
    if (this.isEndlessMode && this.waveIndex + 1 >= this.levelConfig.waves.length) {
      this.captureEndlessCheckpoint();
    }

    // Delegate wave advancement to the combat state manager
    this.combatStateManager.advanceWave();

    // Update UI to reflect the new wave
    if (this.messageEl && this.activeWave) {
      this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${
        this.activeWave.config.label
      }.`;
    }
    this.updateHud();
    this.updateProgress();
    // Refresh the queue previews so the wave change is reflected immediately.
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
    
    // First, handle playfield-specific defeat logic
    // Trigger PsiCluster AoE if this is a Psi cluster
    if (enemy.isPsiCluster) {
      this.triggerPsiClusterAoE(enemy, defeatPosition);
    }
    
    // Emit a burst of collapse motes before removing the enemy from active lists.
    this.spawnEnemyDeathParticles(enemy);
    this.captureEnemyHistory(enemy);
    this.clearEnemySlowEffects(enemy);
    this.clearEnemyDamageAmplifiers(enemy);
    
    if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
      this.clearEnemyHover();
    }
    if (this.focusedEnemyId === enemy.id) {
      this.clearFocusedEnemy({ silent: true });
    }

    this.handlePolygonSplitOnDefeat(enemy);

    const baseGain =
      (this.levelConfig?.theroPerKill ?? this.levelConfig?.energyPerKill ?? 0) +
      (enemy.reward || 0);
    const cap = this.getEnergyCap();
    this.energy = Math.min(cap, this.energy + baseGain);

    if (this.messageEl) {
      const gainLabel = formatCombatNumber(baseGain);
      this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${gainLabel} ${this.theroSymbol}.`;
    }
    
    // Spawn mote gem drops
    this.spawnMoteGemFromEnemy(enemy);

    // Now delegate to combat state manager to handle enemy removal and wave progression
    if (this.combatStateManager) {
      const deathContext = {
        spawnDeathParticles: () => {}, // Already handled above
        dropGems: () => {}, // Already handled above
      };
      this.combatStateManager.handleEnemyDeath(enemy, deathContext);
    }
    
    this.updateHud();
    this.updateProgress();
    this.dependencies.updateStatusDisplays();

    if (this.audio) {
      this.audio.playSfx('enemyDefeat');
    }

    this.dependencies.notifyEnemyDefeated();
    // Remove the defeated enemy from the live lists immediately.
    this.scheduleStatsPanelRefresh();
  }

  // Spawn progressively simpler polygon shards when a polygonal splitter collapses.
  handlePolygonSplitOnDefeat(enemy) {
    if (!enemy || enemy.typeId !== 'polygon-splitter') {
      return;
    }
    const currentSides = Number.isFinite(enemy.polygonSides)
      ? Math.max(1, Math.floor(enemy.polygonSides))
      : DEFAULT_POLYGON_SIDES;
    const nextSides = this.resolveNextPolygonSides(currentSides);
    if (nextSides <= 0) {
      return;
    }
    const hpMultiplier = enemy?.isBoss ? 0.5 : 0.1;
    const speedMultiplier = enemy?.isBoss ? 0.5 : 1.1;

    for (let shardIndex = 0; shardIndex < POLYGON_SPLIT_COUNT; shardIndex += 1) {
      const offset = shardIndex === 0 ? -0.004 : 0.004;
      this.spawnPolygonShard(enemy, {
        polygonSides: nextSides,
        hpMultiplier,
        speedMultiplier,
        progressOffset: offset,
      });
    }
  }

  // Derive a child enemy from a parent polygonal shard using the configured health and speed multipliers.
  spawnPolygonShard(parent, options = {}) {
    if (!parent) {
      return null;
    }
    const nextSides = Number.isFinite(options.polygonSides)
      ? Math.max(1, Math.floor(options.polygonSides))
      : this.resolveNextPolygonSides(parent.polygonSides);
    if (!nextSides) {
      return null;
    }
    const hpBase = Number.isFinite(parent.maxHp) ? parent.maxHp : parent.hp;
    const baseSpeed = Number.isFinite(parent.baseSpeed) ? parent.baseSpeed : parent.speed;
    const hpMultiplier = Number.isFinite(options.hpMultiplier) ? options.hpMultiplier : 0.1;
    const speedMultiplier = Number.isFinite(options.speedMultiplier) ? options.speedMultiplier : 1;
    const shardHp = Math.max(1, hpBase * hpMultiplier);
    const shardSpeed = Math.max(0, baseSpeed * speedMultiplier);
    const rewardRatio = hpBase > 0 && Number.isFinite(parent.reward) ? parent.reward / hpBase : 0.1;
    const shardReward = Math.max(0, shardHp * rewardRatio);
    const progressOffset = Number.isFinite(options.progressOffset) ? options.progressOffset : 0;
    const shardProgress = Math.min(0.999, Math.max(0, (parent.progress || 0) + progressOffset));
    const shardConfig = {
      hp: shardHp,
      speed: shardSpeed,
      reward: shardReward,
      color: parent.color,
      label: parent.label,
      codexId: parent.typeId || parent.codexId || null,
      pathMode: parent.pathMode,
      polygonSides: nextSides,
    };
    const symbol = this.resolveEnemySymbol({ ...shardConfig, polygonSides: nextSides });
    const shard = {
      id: this.enemyIdCounter += 1,
      progress: shardProgress,
      hp: shardHp,
      maxHp: shardHp,
      speed: shardSpeed,
      baseSpeed: shardSpeed,
      reward: shardReward,
      color: parent.color,
      label: parent.label,
      typeId: parent.typeId || parent.codexId || null,
      pathMode: parent.pathMode,
      moteFactor: this.calculateMoteFactor(shardConfig),
      symbol,
      polygonSides: nextSides,
      hpExponent: this.calculateHealthExponent(shardHp),
      gemDropMultiplier: resolveEnemyGemDropMultiplier(shardConfig),
    };
    if (parent.isBoss) {
      shard.isBoss = true;
    }
    assignRandomShell(shard);
    this.enemies.push(shard);
    this.scheduleStatsPanelRefresh();
    return shard;
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
    const cap = this.getEnergyCap();
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
    const cap = this.getEnergyCap();
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
    // Calculate the half-viewport size in normalized coordinates (0-1 space)
    const halfWidth = 0.5 / scale;
    const halfHeight = 0.5 / scale;
    
    // Allow camera to move right up to the edges when zoomed in
    // The camera center can be as close to the edge as halfWidth/halfHeight
    // This ensures the viewport edge aligns with the playfield boundary
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
      x: center.x + (point.x - width * HALF) / scale,
      y: center.y + (point.y - height * HALF) / scale,
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
      x: width * HALF + (point.x - center.x) * scale,
      y: height * HALF + (point.y - center.y) * scale,
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

  /**
   * Get the path speed multiplier at a given progress point.
   * Returns the speed multiplier of the segment the enemy is currently on.
   */
  getPathSpeedMultiplierAtProgress(progress) {
    if (!this.pathSegments.length) {
      return 1;
    }

    const target = Math.min(progress, 1) * this.pathLength;
    let traversed = 0;

    for (let index = 0; index < this.pathSegments.length; index += 1) {
      const segment = this.pathSegments[index];
      if (traversed + segment.length >= target) {
        // Interpolate speed multiplier within the segment based on position
        const distanceIntoSegment = target - traversed;
        const t = segment.length > 0 ? distanceIntoSegment / segment.length : 0;
        
        const startSpeed = Number.isFinite(segment.start.speedMultiplier) ? segment.start.speedMultiplier : 1;
        const endSpeed = Number.isFinite(segment.end.speedMultiplier) ? segment.end.speedMultiplier : 1;
        
        return startSpeed + (endSpeed - startSpeed) * t;
      }
      traversed += segment.length;
    }

    // Default to the last point's speed if no segment found
    const lastSegment = this.pathSegments[this.pathSegments.length - 1];
    if (lastSegment && lastSegment.end && Number.isFinite(lastSegment.end.speedMultiplier)) {
      return lastSegment.end.speedMultiplier;
    }
    return 1;
  }

  /**
   * Check if an enemy is currently in a tunnel and get tunnel opacity info
   * Returns { inTunnel: boolean, opacity: number, isFadeZone: boolean }
   */
  getEnemyTunnelState(enemy) {
    if (!enemy || !this.tunnelSegments.length || !this.pathPoints.length) {
      return { inTunnel: false, opacity: 1, isFadeZone: false };
    }

    const progress = Number.isFinite(enemy.progress) ? enemy.progress : 0;
    const targetDistance = progress * this.pathLength;
    let traversed = 0;

    // Find which segment the enemy is on
    for (let i = 0; i < this.pathSegments.length; i += 1) {
      const segment = this.pathSegments[i];
      const segmentEnd = traversed + segment.length;
      
      if (targetDistance <= segmentEnd) {
        // Enemy is on this segment - check if it's in a tunnel
        if (segment.inTunnel) {
          // Find which tunnel zone this segment belongs to
          for (const tunnel of this.tunnelSegments) {
            // Check if this segment falls within the tunnel zone
            // Guard against zero pathLength
            if (this.pathLength <= 0) {
              continue;
            }
            const segmentProgress = traversed / this.pathLength;
            const segmentEndProgress = segmentEnd / this.pathLength;
            const tunnelStartProgress = this.getProgressAtPointIndex(tunnel.startIndex);
            const tunnelEndProgress = this.getProgressAtPointIndex(tunnel.endIndex);
            
            if (segmentProgress >= tunnelStartProgress && segmentEndProgress <= tunnelEndProgress) {
              // Enemy is in this tunnel - calculate opacity based on position
              const distanceIntoSegment = targetDistance - traversed;
              const segmentRatio = segment.length > 0 ? distanceIntoSegment / segment.length : 0;
              
              // Define fade zones: first 20% and last 20% of tunnel
              const FADE_ZONE_RATIO = 0.2;
              const tunnelLength = tunnelEndProgress - tunnelStartProgress;
              
              // Guard against zero-length tunnels
              if (!Number.isFinite(tunnelLength) || tunnelLength <= 0) {
                return { inTunnel: true, opacity: 0, isFadeZone: false };
              }
              
              const progressInTunnel = (progress - tunnelStartProgress) / tunnelLength;
              
              let opacity = 0; // Default to invisible in tunnel
              let isFadeZone = false;
              
              if (progressInTunnel < FADE_ZONE_RATIO) {
                // Entry fade zone - fade from 1 to 0
                opacity = 1 - (progressInTunnel / FADE_ZONE_RATIO);
                isFadeZone = true;
              } else if (progressInTunnel > (1 - FADE_ZONE_RATIO)) {
                // Exit fade zone - fade from 0 to 1
                opacity = (progressInTunnel - (1 - FADE_ZONE_RATIO)) / FADE_ZONE_RATIO;
                isFadeZone = true;
              }
              
              return { inTunnel: true, opacity, isFadeZone };
            }
          }
        }
        break;
      }
      
      traversed = segmentEnd;
    }

    return { inTunnel: false, opacity: 1, isFadeZone: false };
  }

  /**
   * Get the progress (0-1) at a specific path point index
   */
  getProgressAtPointIndex(pointIndex) {
    if (!this.pathPoints.length || pointIndex < 0 || pointIndex >= this.pathPoints.length) {
      return 0;
    }
    
    let distance = 0;
    for (let i = 0; i < pointIndex && i < this.pathSegments.length; i += 1) {
      distance += this.pathSegments[i].length;
    }
    
    return this.pathLength > 0 ? distance / this.pathLength : 0;
  }

  getEnemyPosition(enemy) {
    if (!enemy) {
      return { x: 0, y: 0 };
    }

    // Handle radial spawn enemies (spawn from edges, move to center)
    if (enemy.radialSpawnX !== undefined && enemy.radialSpawnY !== undefined && this.levelConfig?.centerSpawn) {
      // Get center position (should be at path[0] for radial levels)
      const center = this.levelConfig.path && this.levelConfig.path.length > 0
        ? { x: this.levelConfig.path[0].x * this.renderWidth, y: this.levelConfig.path[0].y * this.renderHeight }
        : { x: this.renderWidth * 0.5, y: this.renderHeight * 0.5 };
      
      const start = {
        x: enemy.radialSpawnX * this.renderWidth,
        y: enemy.radialSpawnY * this.renderHeight
      };
      
      const clamped = Math.max(0, Math.min(1, enemy.progress));
      return {
        x: start.x + (center.x - start.x) * clamped,
        y: start.y + (center.y - start.y) * clamped,
      };
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

  drawCrystallineMosaic() {
    return CanvasRenderer.drawCrystallineMosaic.call(this);
  }

  drawSketches() {
    return CanvasRenderer.drawSketches.call(this);
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

  setDeveloperPathMarkers(markers, options = {}) {
    if (!Array.isArray(markers)) {
      this.developerPathMarkers = [];
      this.developerMapSpeedMultiplier = null;
      return;
    }

    // Store the map speed multiplier for display on the canvas
    if (Number.isFinite(options.mapSpeedMultiplier)) {
      this.developerMapSpeedMultiplier = options.mapSpeedMultiplier;
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
        const speedMultiplier = Number.isFinite(marker.speedMultiplier) ? marker.speedMultiplier : 1;
        return {
          x,
          y,
          label:
            marker.label !== undefined && marker.label !== null
              ? marker.label
              : index + 1,
          active: Boolean(marker.active),
          speedMultiplier,
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
   * Draw golden lines from infinity towers to all towers within their range.
   * Called after drawTowers to overlay the aura effect.
   */
  drawInfinityAuras() {
    if (!this.ctx || this.infinityTowers.length === 0) {
      return;
    }

    const ctx = this.ctx;
    const totalTowerCount = this.towers.length;

    this.infinityTowers.forEach((infinityTower) => {
      // Get all towers within range
      const towersInRange = getTowersInInfinityRange(
        infinityTower,
        this.towers,
        (x1, y1, x2, y2) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          return Math.sqrt(dx * dx + dy * dy) / metersToPixels(1);
        }
      );

      // Draw golden lines to each tower in range
      towersInRange.forEach((tower) => {
        if (tower.type === 'infinity') {
          return; // Don't draw line to itself
        }

        // Pulsing effect based on time
        const time = (this.gameTime || 0) * 0.001; // Convert to seconds
        const pulse = 0.3 + 0.3 * Math.sin(time * INFINITY_PARTICLE_CONFIG.pulseSpeed);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(infinityTower.x, infinityTower.y);
        ctx.lineTo(tower.x, tower.y);

        // Golden color with pulsing alpha
        const alpha = INFINITY_PARTICLE_CONFIG.lineColor.a * (0.4 + pulse);
        ctx.strokeStyle = `rgba(${INFINITY_PARTICLE_CONFIG.lineColor.r}, ${INFINITY_PARTICLE_CONFIG.lineColor.g}, ${INFINITY_PARTICLE_CONFIG.lineColor.b}, ${alpha})`;
        ctx.lineWidth = INFINITY_PARTICLE_CONFIG.lineWidth;
        ctx.stroke();
        ctx.restore();
      });

      // Draw range circle around infinity tower (subtle)
      const rangePixels = getInfinityRange() * metersToPixels(1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(infinityTower.x, infinityTower.y, rangePixels, 0, TWO_PI);
      ctx.strokeStyle = `rgba(${INFINITY_PARTICLE_CONFIG.lineColor.r}, ${INFINITY_PARTICLE_CONFIG.lineColor.g}, ${INFINITY_PARTICLE_CONFIG.lineColor.b}, 0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
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

  // Render particle fragments from defeated enemies so the battlefield reflects recent combat.
  drawEnemyDeathParticles() {
    return CanvasRenderer.drawEnemyDeathParticles.call(this);
  }

  drawSwarmClouds() {
    return CanvasRenderer.drawSwarmClouds.call(this);
  }

  drawDamageNumbers() {
    return CanvasRenderer.drawDamageNumbers.call(this);
  }

  drawFloatingFeedback() {
    return CanvasRenderer.drawFloatingFeedback.call(this);
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

  /**
   * Render gamma star burst effects on enemies hit by gamma projectiles.
   */
  drawGammaStarBursts() {
    return CanvasRenderer.drawGammaStarBursts.call(this);
  }

  drawNuBursts() {
    return CanvasRenderer.drawNuBursts.call(this);
  }

  /**
   * Render Ω particle orbits around targeted enemies.
   */
  drawOmegaParticles() {
    return CanvasRenderer.drawOmegaParticles.call(this);
  }

  /**
   * Paint the active radial tower command menu around the selected lattice.
   */
  drawTowerMenu() {
    return CanvasRenderer.drawTowerMenu.call(this);
  }
}

Object.assign(SimplePlayfield.prototype, TowerSelectionWheel);

// Gesture detection and tower interaction methods
Object.assign(SimplePlayfield.prototype, {
  getCurrentTimestamp: GestureController.getCurrentTimestamp,
  resetTowerTapState: GestureController.resetTowerTapState,
  registerTowerTap: GestureController.registerTowerTap,
  toggleTowerMenuFromTap: GestureController.toggleTowerMenuFromTap,
  updateTowerHoldGesture: GestureController.updateTowerHoldGesture,
  cancelTowerHoldGesture: GestureController.cancelTowerHoldGesture,
  handleTowerPointerPress: GestureController.handleTowerPointerPress,
  handleTowerPointerRelease: GestureController.handleTowerPointerRelease,
});

// Floater particle system methods
Object.assign(SimplePlayfield.prototype, {
  updateFloaters: FloaterSystem.updateFloaters,
});

// Background swimmer system methods
Object.assign(SimplePlayfield.prototype, {
  updateBackgroundSwimmers: BackgroundSwimmerSystem.updateBackgroundSwimmers,
  createBackgroundSwimmer: BackgroundSwimmerSystem.createBackgroundSwimmer,
  computeSwimmerCount: BackgroundSwimmerSystem.computeSwimmerCount,
});

// Projectile update system methods
Object.assign(SimplePlayfield.prototype, {
  updateProjectiles: ProjectileUpdateSystem.updateProjectiles,
});

// Visual effects system methods (damage numbers, particles, PSI effects)
Object.assign(SimplePlayfield.prototype, {
  areDamageNumbersActive: VisualEffectsSystem.areDamageNumbersActive,
  resolveDamageNumberDirection: VisualEffectsSystem.resolveDamageNumberDirection,
  spawnDamageNumber: VisualEffectsSystem.spawnDamageNumber,
  spawnMissText: VisualEffectsSystem.spawnMissText,
  updateDamageNumbers: VisualEffectsSystem.updateDamageNumbers,
  resetDamageNumbers: VisualEffectsSystem.resetDamageNumbers,
  clearDamageNumbers: VisualEffectsSystem.clearDamageNumbers,
  recordEnemySwirlImpact: VisualEffectsSystem.recordEnemySwirlImpact,
  spawnEnemyDeathParticles: VisualEffectsSystem.spawnEnemyDeathParticles,
  updateEnemyDeathParticles: VisualEffectsSystem.updateEnemyDeathParticles,
  resetEnemyDeathParticles: VisualEffectsSystem.resetEnemyDeathParticles,
  spawnPsiMergeEffect: VisualEffectsSystem.spawnPsiMergeEffect,
  spawnPsiAoeEffect: VisualEffectsSystem.spawnPsiAoeEffect,
});

// Path geometry system methods (path curves, tunnels, river particles)
Object.assign(SimplePlayfield.prototype, {
  syncCanvasSize: PathGeometrySystem.syncCanvasSize,
  buildPathGeometry: PathGeometrySystem.buildPathGeometry,
  buildTunnelSegments: PathGeometrySystem.buildTunnelSegments,
  initializeTrackRiverParticles: PathGeometrySystem.initializeTrackRiverParticles,
  generateSmoothPathPoints: PathGeometrySystem.generateSmoothPathPoints,
  catmullRom: PathGeometrySystem.catmullRom,
  distanceBetween: PathGeometrySystem.distanceBetween,
});

// Combat stats manager methods (wrap manager calls for delegation)
Object.assign(SimplePlayfield.prototype, {
  resetCombatStats() {
    if (this.combatStatsManager) {
      this.combatStatsManager.resetCombatStats();
    }
  },
  startCombatStatsSession() {
    if (this.combatStatsManager) {
      this.combatStatsManager.startCombatStatsSession();
    }
  },
  stopCombatStatsSession() {
    if (this.combatStatsManager) {
      this.combatStatsManager.stopCombatStatsSession();
    }
  },
  updateCombatStats(delta) {
    if (this.combatStatsManager) {
      this.combatStatsManager.updateCombatStats(delta);
    }
  },
  recordDamageEvent(options) {
    if (this.combatStatsManager) {
      this.combatStatsManager.recordDamageEvent(options);
    }
  },
  recordKillEvent(tower) {
    if (this.combatStatsManager) {
      this.combatStatsManager.recordKillEvent(tower);
    }
  },
  captureEnemyHistory(enemy) {
    if (this.combatStatsManager) {
      this.combatStatsManager.captureEnemyHistory(enemy);
    }
  },
  buildTowerSummaries() {
    return this.combatStatsManager ? this.combatStatsManager.buildTowerSummaries() : [];
  },
  refreshStatsPanel(options) {
    if (this.combatStatsManager) {
      this.combatStatsManager.refreshStatsPanel(options);
    }
  },
  scheduleStatsPanelRefresh() {
    if (this.combatStatsManager) {
      this.combatStatsManager.scheduleStatsPanelRefresh();
    }
  },
  ensureTowerStatsEntry(tower) {
    return this.combatStatsManager ? this.combatStatsManager.ensureTowerStatsEntry(tower) : null;
  },
});

Object.assign(SimplePlayfield.prototype, {
  determinePreferredOrientation,
  setPreferredOrientation,
  applyContainerOrientationClass,
  cloneNormalizedPoint,
  rotateNormalizedPointClockwise,
  applyLevelOrientation,
});

// Connection System delegations
Object.assign(SimplePlayfield.prototype, {
  updateConnectionParticles: function(delta) {
    return this.connectionSystem ? this.connectionSystem.updateConnectionParticles(delta) : undefined;
  },
  syncTowerConnectionParticles: function(tower, type, desiredCount) {
    return this.connectionSystem ? this.connectionSystem.syncTowerConnectionParticles(tower, type, desiredCount) : undefined;
  },
  createConnectionParticle: function(tower, type, options) {
    return this.connectionSystem ? this.connectionSystem.createConnectionParticle(tower, type, options) : null;
  },
  resolveTowerBodyRadius: function(tower) {
    return this.connectionSystem ? this.connectionSystem.resolveTowerBodyRadius(tower) : 12;
  },
  updateConnectionOrbitParticle: function(particle, step) {
    return this.connectionSystem ? this.connectionSystem.updateConnectionOrbitParticle(particle, step) : undefined;
  },
  updateConnectionArriveParticle: function(tower, particle, step) {
    return this.connectionSystem ? this.connectionSystem.updateConnectionArriveParticle(tower, particle, step) : undefined;
  },
  updateConnectionLaunchParticle: function(particle, step) {
    return this.connectionSystem ? this.connectionSystem.updateConnectionLaunchParticle(particle, step) : undefined;
  },
  updateConnectionSwarmParticle: function(particle, step) {
    return this.connectionSystem ? this.connectionSystem.updateConnectionSwarmParticle(particle, step) : undefined;
  },
  processSwarmParticleHits: function(tower, particles) {
    return this.connectionSystem ? this.connectionSystem.processSwarmParticleHits(tower, particles) : undefined;
  },
  resolveConnectionOrbitAnchor: function(tower, particle) {
    return this.connectionSystem ? this.connectionSystem.resolveConnectionOrbitAnchor(tower, particle) : null;
  },
  resolveConnectionOrbitPosition: function(tower, particle, bodyRadius) {
    return this.connectionSystem ? this.connectionSystem.resolveConnectionOrbitPosition(tower, particle, bodyRadius) : null;
  },
  queueTowerSwirlLaunch: function(tower, type, count) {
    return this.connectionSystem ? this.connectionSystem.queueTowerSwirlLaunch(tower, type, count) : undefined;
  },
  triggerQueuedSwirlLaunches: function(tower, targetPosition, targetEnemy) {
    return this.connectionSystem ? this.connectionSystem.triggerQueuedSwirlLaunches(tower, targetPosition, targetEnemy) : undefined;
  },
  launchTowerConnectionParticles: function(tower, entries, targetPosition, targetEnemy) {
    return this.connectionSystem ? this.connectionSystem.launchTowerConnectionParticles(tower, entries, targetPosition, targetEnemy) : undefined;
  },
  createSupplySeeds: function(source, target, payload) {
    return this.connectionSystem ? this.connectionSystem.createSupplySeeds(source, target, payload) : [];
  },
  updateSupplySeeds: function(projectile) {
    return this.connectionSystem ? this.connectionSystem.updateSupplySeeds(projectile) : undefined;
  },
  transferSupplySeedsToOrbit: function(tower, projectile) {
    return this.connectionSystem ? this.connectionSystem.transferSupplySeedsToOrbit(tower, projectile) : undefined;
  },
  updateSwarmClouds: function(delta) {
    return this.connectionSystem ? this.connectionSystem.updateSwarmClouds(delta) : undefined;
  },
  createConnectionEffect: function(source, target) {
    return this.connectionSystem ? this.connectionSystem.createConnectionEffect(source, target) : null;
  },
});
