import { getCachedKufMaps, onKufMapsReady } from './kufMapData.js';
import { isLowGraphicsModeActive } from './preferences.js';
import { getKufEnemyBaseStats } from './kufEnemyDefinitions.js';
import {
  KUF_FALLBACK_MAP_ID,
  MARINE_CONFIG,
  SNIPER_CONFIG,
  SPLAYER_CONFIG,
  LASER_CONFIG,
  TURRET_CONFIG,
  RENDERING_CONFIG,
  CAMERA_CONFIG,
  GAMEPLAY_CONFIG,
  GRID_UNIT,
  DEFAULT_UNIT_STATS,
  DEFAULT_UNIT_COUNTS,
  TWO_PI,
  SPLAYER_BASE_SPIN_SPEED,
  KUF_TRAINING_SLOTS,
} from './kufSimulationConfig.js';
// All canvas draw methods live in the companion renderer module.
import {
  drawBackground as kufDrawBackground,
  drawTrianglePattern as kufDrawTrianglePattern,
  render as kufRender,
  shouldSkipOverlays as kufShouldSkipOverlays,
  drawMarines as kufDrawMarines,
  drawDrones as kufDrawDrones,
  drawTurrets as kufDrawTurrets,
  drawBullets as kufDrawBullets,
  drawHealthBars as kufDrawHealthBars,
  drawLevelIndicators as kufDrawLevelIndicators,
  drawExplosions as kufDrawExplosions,
  drawSelectedEnemyBox as kufDrawSelectedEnemyBox,
  drawBaseCore as kufDrawBaseCore,
  drawTrainingToolbar as kufDrawTrainingToolbar,
  drawHud as kufDrawHud,
  drawSelectionBox as kufDrawSelectionBox,
  drawWaypointMarker as kufDrawWaypointMarker,
  drawUnitWaypointLines as kufDrawUnitWaypointLines,
} from './kufRenderer.js';
// All combat update and targeting methods live in the companion combat system module.
import {
  steerUnitToward as kufSteerUnitToward,
  decelerateUnit as kufDecelerateUnit,
  updateMarines as kufUpdateMarines,
  updateCoreShip as kufUpdateCoreShip,
  updateDrones as kufUpdateDrones,
  updateTurrets as kufUpdateTurrets,
  triggerMineExplosion as kufTriggerMineExplosion,
  updateExplosions as kufUpdateExplosions,
  updateBullets as kufUpdateBullets,
  spawnBullet as kufSpawnBullet,
  fireTurret as kufFireTurret,
  getTurretAttackModifier as kufGetTurretAttackModifier,
  handleSupportDrone as kufHandleSupportDrone,
  findDamagedTurret as kufFindDamagedTurret,
  applyBulletEffects as kufApplyBulletEffects,
  updateMarineStatus as kufUpdateMarineStatus,
  getFieldSlowMultiplier as kufGetFieldSlowMultiplier,
  findClosestTurret as kufFindClosestTurret,
  findClosestMarine as kufFindClosestMarine,
  findClosestPlayerTarget as kufFindClosestPlayerTarget,
  findHit as kufFindHit,
  isOnscreen as kufIsOnscreen,
} from './kufCombatSystem.js';
// All camera/input control methods live in the companion input controller module.
import {
  resize as kufResize,
  getEffectiveDevicePixelRatio as kufGetEffectiveDevicePixelRatio,
  attachCameraControls as kufAttachCameraControls,
  detachCameraControls as kufDetachCameraControls,
  handleMouseDown as kufHandleMouseDown,
  handleMouseMove as kufHandleMouseMove,
  handleMouseUp as kufHandleMouseUp,
  handleWheel as kufHandleWheel,
  handleClick as kufHandleClick,
  handleTouchStart as kufHandleTouchStart,
  handleTouchMove as kufHandleTouchMove,
  handleTouchEnd as kufHandleTouchEnd,
  canvasToWorld as kufCanvasToWorld,
  findEnemyAtPoint as kufFindEnemyAtPoint,
  handleCommandTap as kufHandleCommandTap,
  issueTargetCommand as kufIssueTargetCommand,
  completeSelection as kufCompleteSelection,
  setAttackMoveWaypoint as kufSetAttackMoveWaypoint,
  getFormationWaypoints as kufGetFormationWaypoints,
  getFocusedEnemy as kufGetFocusedEnemy,
} from './kufInputController.js';
// All HUD layout, toolbar, training queue, and core ship init methods live in the companion training system module.
import {
  getHudLayout as kufTrainingGetHudLayout,
  getToolbarSlotIndex as kufTrainingGetToolbarSlotIndex,
  getTrainingSpecForSlot as kufTrainingGetTrainingSpecForSlot,
  cycleToolbarSlotUnit as kufTrainingCycleToolbarSlotUnit,
  clearToolbarGlow as kufTrainingClearToolbarGlow,
  handleToolbarTap as kufTrainingHandleToolbarTap,
  tryStartTraining as kufTrainingTryStartTraining,
  updateTraining as kufTrainingUpdateTraining,
  spawnTrainedUnit as kufTrainingSpawnTrainedUnit,
  getBaseWorldPosition as kufTrainingGetBaseWorldPosition,
  initializeCoreShip as kufTrainingInitializeCoreShip,
} from './kufTrainingSystem.js';
// Mirror the latest loaded map data so new simulation instances can start in sync.
let sharedAvailableKufMaps = getCachedKufMaps();
let sharedDefaultKufMapId = sharedAvailableKufMaps[0]?.id || KUF_FALLBACK_MAP_ID;

onKufMapsReady((maps) => {
  sharedAvailableKufMaps = Array.isArray(maps) ? maps : [];
  sharedDefaultKufMapId = sharedAvailableKufMaps[0]?.id || KUF_FALLBACK_MAP_ID;
});

/**
 * Kuf Spire Battlefield Simulation
 *
 * Drives the lightweight RTS-style encounter used to resolve Kuf Spire runs.
 * Marines advance north toward entrenched turrets, trading projectiles until
 * either side is defeated.
 */

// All configuration constants now imported from kufSimulationConfig.js
// Legacy constant names mapped to new config structure for backward compatibility
const MARINE_MOVE_SPEED = MARINE_CONFIG.MOVE_SPEED;
const MARINE_RANGE = MARINE_CONFIG.RANGE;
const MARINE_RADIUS = MARINE_CONFIG.RADIUS;

const SNIPER_RADIUS = SNIPER_CONFIG.RADIUS;
const SNIPER_RANGE = SNIPER_CONFIG.RANGE;

const SPLAYER_RADIUS = SPLAYER_CONFIG.RADIUS;
const SPLAYER_RANGE = SPLAYER_CONFIG.RANGE;

// Define the piercing laser unit's silhouette and engagement range.
const LASER_RADIUS = LASER_CONFIG.RADIUS;
const LASER_RANGE = LASER_CONFIG.RANGE;

const TURRET_RADIUS = TURRET_CONFIG.RADIUS;

const TRAIL_ALPHA = RENDERING_CONFIG.TRAIL_ALPHA;
const LOW_TRAIL_ALPHA = RENDERING_CONFIG.LOW_TRAIL_ALPHA;
const HIGH_QUALITY_FRAME_BUDGET_MS = RENDERING_CONFIG.HIGH_QUALITY_FRAME_BUDGET_MS;
const FRAME_COST_SMOOTHING = RENDERING_CONFIG.FRAME_COST_SMOOTHING;

const CAMERA_PAN_SPEED = CAMERA_CONFIG.PAN_SPEED;
const MIN_ZOOM = CAMERA_CONFIG.MIN_ZOOM;
const MAX_ZOOM = CAMERA_CONFIG.MAX_ZOOM;

const SPAWN_AREA_MARGIN = GAMEPLAY_CONFIG.SPAWN_AREA_MARGIN;

/**
 * @typedef {Object} KufSimulationConfig
 * @property {{ health: number, attack: number, attackSpeed: number }} marineStats - Calculated statline.
 * @property {{ health: number, attack: number, attackSpeed: number }} [laserStats] - Piercing laser statline.
 */

export class KufBattlefieldSimulation {
  /**
   * @param {object} options - Simulation configuration.
   * @param {HTMLCanvasElement} options.canvas - Target canvas element.
   * @param {(result: { goldEarned: number, victory: boolean, destroyedTurrets: number }) => void} [options.onComplete]
   *   Completion callback fired when the encounter resolves.
   */
  constructor({ canvas, onComplete, maps } = {}) {
    this.canvas = canvas || null;
    this.onComplete = typeof onComplete === 'function' ? onComplete : null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.active = false;
    this.lastTimestamp = 0;
    this.marines = [];
    this.turrets = [];
    this.bullets = [];
    this.explosions = [];
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
    // Track worker count for escalating costs and income bonuses.
    this.workerCount = 0;
    // Track base income per kill (starts at 1, increases by 1 per worker).
    this.baseIncomePerKill = 1;
    this.bounds = { width: this.canvas?.width || 640, height: this.canvas?.height || 360 };
    this.pixelRatio = 1;
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.cameraDrag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };
    this.selectedEnemy = null;
    // Unit selection and attack-move state
    this.selectedUnits = []; // Array of selected marine units
    this.selectionMode = 'all'; // 'all' or 'specific'
    this.selectionBox = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };
    this.dragStartTime = 0;
    this.dragThreshold = 150; // ms to distinguish tap from drag
    this.lastTapTime = 0;
    this.doubleTapThreshold = 300; // ms for double-tap detection
    this.attackMoveWaypoint = null; // {x, y} target for attack-move
    // Track how close units should hold to a focus target when manually commanded.
    this.targetHoldBuffer = 6;
    // Track runtime rendering profile so we can gracefully downshift on slower devices without losing glow aesthetics.
    this.renderProfile = isLowGraphicsModeActive() ? 'light' : 'high';
    this.smoothedFrameCost = 12;
    this.overlaySkipInterval = this.renderProfile === 'light' ? 2 : 1;
    this.overlaySkipCounter = 0;
    this.userRenderMode = 'auto';
    this.glowOverlaysEnabled = true;
    // Track the training toolbar slots for the Kuf base interface.
    this.trainingSlots = KUF_TRAINING_SLOTS.map((slot) => ({
      ...slot,
      isTraining: false,
      progress: 0,
    }));
    // Track the core ship hull integrity and cannon mounts during active simulations.
    this.coreShip = null;
    // Track the last tapped toolbar slot for double-tap training input.
    this.lastToolbarTap = { time: 0, slotIndex: null };
    // Track deferred toolbar taps so single taps can equip slots without blocking double taps.
    this.toolbarTapTimer = null;
    // Track which toolbar slot is pending a single-tap equip swap.
    this.pendingToolbarSlotIndex = null;
    // Track which toolbar slot is currently glowing (single tap without double-tap).
    this.glowingToolbarSlotIndex = null;
    // Cache the latest unit statlines for on-demand training spawns.
    this.unitStats = {
      worker: { ...DEFAULT_UNIT_STATS.MARINE },
      marine: { ...DEFAULT_UNIT_STATS.MARINE },
      sniper: { ...DEFAULT_UNIT_STATS.SNIPER },
      splayer: { ...DEFAULT_UNIT_STATS.SPLAYER },
      // Cache piercing laser statlines for training spawns.
      laser: { ...DEFAULT_UNIT_STATS.LASER },
    };
    // Protect the canvas resolution from running wild on high-DPI displays.
    this.maxDevicePixelRatio = this.renderProfile === 'light' ? 1.1 : 1.5;
    const providedMaps = Array.isArray(maps) ? maps : null;
    this.availableMaps = providedMaps && providedMaps.length
      ? providedMaps.map((map) => ({ ...map }))
      : sharedAvailableKufMaps.map((map) => ({ ...map }));
    this.defaultMapId = this.availableMaps[0]?.id || sharedDefaultKufMapId;
    this.activeMapId = this.defaultMapId;
    this.currentMap = this.getMapById(this.activeMapId);
    this.step = this.step.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  /**
   * Resize the canvas to fit its container while respecting device pixel ratio.
   */
  resize() { return kufResize.call(this); }

  /**
   * Clamp the canvas resolution to keep the Kuf encounter playable on high-DPI hardware.
   * @returns {number} Effective device pixel ratio for rendering
   */
  getEffectiveDevicePixelRatio() { return kufGetEffectiveDevicePixelRatio.call(this); }

  /** Attach camera control event listeners. */
  attachCameraControls() { return kufAttachCameraControls.call(this); }

  /** Remove camera control event listeners. */
  detachCameraControls() { return kufDetachCameraControls.call(this); }

  handleMouseDown(e) { return kufHandleMouseDown.call(this, e); }
  handleMouseMove(e) { return kufHandleMouseMove.call(this, e); }
  handleMouseUp(e) { return kufHandleMouseUp.call(this, e); }
  handleWheel(e) { return kufHandleWheel.call(this, e); }
  handleClick(e) { return kufHandleClick.call(this, e); }
  handleTouchStart(e) { return kufHandleTouchStart.call(this, e); }
  handleTouchMove(e) { return kufHandleTouchMove.call(this, e); }
  handleTouchEnd(e) { return kufHandleTouchEnd.call(this, e); }

  /**
   * Convert a canvas-space coordinate to world-space coordinates.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {{ x: number, y: number }} World coordinates.
   */
  canvasToWorld(canvasX, canvasY) { return kufCanvasToWorld.call(this, canvasX, canvasY); }

  /**
   * Resolve a turret/enemy under the tap point in world space.
   * @param {number} worldX - X coordinate in world space.
   * @param {number} worldY - Y coordinate in world space.
   * @returns {object|null} Targeted enemy or null.
   */
  findEnemyAtPoint(worldX, worldY) { return kufFindEnemyAtPoint.call(this, worldX, worldY); }

  /**
   * Handle tap-based commands to target enemies or set move destinations.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   */
  handleCommandTap(canvasX, canvasY) { return kufHandleCommandTap.call(this, canvasX, canvasY); }

  /**
   * Send a focused attack command on a tapped enemy.
   * @param {object} enemy - Enemy unit or structure to focus.
   */
  issueTargetCommand(enemy) { return kufIssueTargetCommand.call(this, enemy); }

  /** Complete selection by finding all units within the selection rectangle. */
  completeSelection() { return kufCompleteSelection.call(this); }

  /** Set attack-move waypoint for units. */
  setAttackMoveWaypoint(worldX, worldY) { return kufSetAttackMoveWaypoint.call(this, worldX, worldY); }

  /**
   * Generate formation waypoints centered on the target with diameter gaps between units.
   * @param {Array<object>} units - Units that should be arranged into the formation.
   * @param {number} targetX - Formation center X coordinate.
   * @param {number} targetY - Formation center Y coordinate.
   * @returns {Array<{x: number, y: number}>} Array of world-space waypoints per unit.
   */
  getFormationWaypoints(units, targetX, targetY) { return kufGetFormationWaypoints.call(this, units, targetX, targetY); }

  /**
   * Resolve the currently focused enemy and clear invalid references.
   * @returns {object|null} Focused enemy or null when none is active.
   */
  getFocusedEnemy() { return kufGetFocusedEnemy.call(this); }

  /**
   * Accelerate a unit toward a target point, returning true when close enough to stop.
   * @param {object} marine - Unit to move.
   * @param {number} targetX - Desired x coordinate in world space.
   * @param {number} targetY - Desired y coordinate in world space.
   * @param {number} delta - Delta time in seconds.
   * @returns {boolean} True when the unit is within the stopping threshold.
   */
  steerUnitToward(marine, targetX, targetY, delta) { return kufSteerUnitToward.call(this, marine, targetX, targetY, delta); }

  /**
   * Ease a unit's velocity back to zero.
   * @param {object} marine - Unit to decelerate.
   * @param {number} delta - Delta time in seconds.
   */
  decelerateUnit(marine, delta) { kufDecelerateUnit.call(this, marine, delta); }

  /**
   * Convert grid coordinates to pixel coordinates.
   * Grid origin (0, 0) is at player spawn position.
   * Positive Y goes north (up), positive X goes east (right).
   * @param {number} gridX - X coordinate in grid units
   * @param {number} gridY - Y coordinate in grid units
   * @returns {{x: number, y: number}} Pixel coordinates
   */
  gridToPixels(gridX, gridY) {
    const centerX = this.bounds.width / 2;
    const spawnY = this.bounds.height - 48;
    
    return {
      x: centerX + gridX * GRID_UNIT,
      y: spawnY - gridY * GRID_UNIT, // Subtract because Y increases upward in grid but downward in pixels
    };
  }

  /**
   * Spawn a new player-controlled unit with the correct statline and movement profile.
   * @param {string} type - Unit archetype key.
   * @param {{ health: number, attack: number, attackSpeed: number }} stats - Base stats for the unit.
   * @param {number} x - Spawn X coordinate in world space.
   * @param {number} y - Spawn Y coordinate in world space.
   */
  createPlayerUnit(type, stats, x, y) {
    // Align unit sizing and movement presets to the unit archetype configuration.
    let radius = MARINE_RADIUS;
    let moveSpeed = MARINE_MOVE_SPEED;
    let range = MARINE_RANGE;
    // Seed splayer rotation so each ship animates with a unique idle orientation.
    let rotation = 0;
    // Assign the baseline spin rate only to splayer units.
    let rotationSpeed = 0;
    if (type === 'sniper') {
      radius = SNIPER_RADIUS;
      moveSpeed = MARINE_MOVE_SPEED * 0.8;
      range = SNIPER_RANGE;
    } else if (type === 'splayer') {
      radius = SPLAYER_RADIUS;
      moveSpeed = MARINE_MOVE_SPEED * 0.9;
      range = SPLAYER_RANGE;
      rotation = Math.random() * TWO_PI;
      rotationSpeed = SPLAYER_BASE_SPIN_SPEED;
    } else if (type === 'laser') {
      // Tune piercing lasers to sit between marines and snipers.
      radius = LASER_RADIUS;
      moveSpeed = MARINE_MOVE_SPEED * 0.85;
      range = LASER_RANGE;
    }
    this.marines.push({
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      health: stats.health,
      maxHealth: stats.health,
      attack: stats.attack,
      attackSpeed: Math.max(0.1, stats.attackSpeed),
      cooldown: Math.random() * 0.5,
      baseMoveSpeed: moveSpeed,
      moveSpeed,
      range,
      statusEffects: [],
      rotation,
      rotationSpeed,
      // Track the remaining duration of the boosted spin after each splayer attack.
      rotationBoostTimer: 0,
    });
  }

  /**
   * Begin a new simulation with the provided marine stats and unit counts.
   * @param {KufSimulationConfig} config - Simulation setup payload.
   */
  start(config) {
    if (!this.ctx) {
      return;
    }
    this.reset();
    const marineStats = config?.marineStats || DEFAULT_UNIT_STATS.MARINE;
    const sniperStats = config?.sniperStats || DEFAULT_UNIT_STATS.SNIPER;
    const splayerStats = config?.splayerStats || DEFAULT_UNIT_STATS.SPLAYER;
    // Resolve piercing laser stats for the new Kuf unit.
    const laserStats = config?.laserStats || DEFAULT_UNIT_STATS.LASER;
    // Resolve core ship stats so hull integrity and cannons stay in sync with shard upgrades.
    const coreShipStats = config?.coreShipStats || { health: 120, cannons: 0 };
    const units = config?.units || DEFAULT_UNIT_COUNTS;
    const requestedMap = config?.mapId || this.defaultMapId;
    this.setActiveMap(requestedMap);
    // Reset overlay pacing so each run begins with full HUD fidelity before auto-throttling.
    this.overlaySkipCounter = 0;
    // Cache active unit stats for training spawns during the encounter.
    this.unitStats = {
      worker: { ...marineStats },
      marine: { ...marineStats },
      sniper: { ...sniperStats },
      splayer: { ...splayerStats },
      // Keep laser statlines available for training spawns.
      laser: { ...laserStats },
    };
    // Initialize the core ship anchor so turrets can target its hull integrity.
    this.initializeCoreShip(coreShipStats);

    // Player units spawn randomly within the bottom half of the render area.
    const spawnYMin = this.bounds.height / 2;
    const spawnYMax = this.bounds.height - SPAWN_AREA_MARGIN;
    const spawnXMin = SPAWN_AREA_MARGIN;
    const spawnXMax = this.bounds.width - SPAWN_AREA_MARGIN;
    
    // Spawn all purchased marines at random positions in bottom half.
    for (let i = 0; i < units.marines; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.createPlayerUnit('marine', marineStats, randomX, randomY);
    }
    
    // Spawn all purchased snipers at random positions in bottom half.
    for (let i = 0; i < units.snipers; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.createPlayerUnit('sniper', sniperStats, randomX, randomY);
    }
    
    // Spawn all purchased splayers at random positions in bottom half.
    for (let i = 0; i < units.splayers; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.createPlayerUnit('splayer', splayerStats, randomX, randomY);
    }

    // Spawn all purchased piercing lasers at random positions in bottom half.
    for (let i = 0; i < units.lasers; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.createPlayerUnit('laser', laserStats, randomX, randomY);
    }
    
    this.buildTurrets();
    this.attachCameraControls();
    this.canvas.style.cursor = 'grab';
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.active = true;
    // Calculate starting gold: 10 gold per level (based on highest turret level in map).
    const highestEnemyLevel = this.turrets.reduce((max, turret) => Math.max(max, turret.level || 1), 1);
    this.goldEarned = highestEnemyLevel * 10;
    this.destroyedTurrets = 0;
    // Reset worker count and income per kill at the start of each simulation.
    this.workerCount = 0;
    this.baseIncomePerKill = 1;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.step);
  }

  /**
   * Stop the simulation and clear scheduled frames.
   */
  stop() {
    this.active = false;
    this.detachCameraControls();
    if (this.canvas) {
      this.canvas.style.cursor = 'default';
    }
  }

  /**
   * Build the HUD layout for the base core and training toolbar.
   * @returns {{ baseCenter: { x: number, y: number }, baseRadius: number, slots: Array<{ x: number, y: number, size: number }> }}
   */
  getHudLayout() { return kufTrainingGetHudLayout.call(this); }

  /**
   * Convert a HUD-space point into a toolbar slot index if tapped.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {number|null} Toolbar slot index when hit, otherwise null.
   */
  getToolbarSlotIndex(canvasX, canvasY) { return kufTrainingGetToolbarSlotIndex.call(this, canvasX, canvasY); }

  /**
   * Resolve the current unit spec for a toolbar slot.
   * Handles dynamic worker cost calculation: cost = WORKER_BASE_COST + (workerCount * WORKER_COST_INCREMENT).
   * @param {object} slot - Toolbar slot payload.
   * @returns {{ id: string, label: string, icon: string, cost: number, duration: number }} Unit spec.
   */
  getTrainingSpecForSlot(slot) { return kufTrainingGetTrainingSpecForSlot.call(this, slot); }

  /**
   * Cycle the equipped unit for a customizable toolbar slot.
   * @param {number} slotIndex - Index of the toolbar slot to update.
   */
  cycleToolbarSlotUnit(slotIndex) { return kufTrainingCycleToolbarSlotUnit.call(this, slotIndex); }

  /**
   * Clear the glowing state for the toolbar slots.
   */
  clearToolbarGlow() { return kufTrainingClearToolbarGlow.call(this); }

  /**
   * Handle taps that land on the training toolbar.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {boolean} True when the tap was consumed by the toolbar.
   */
  handleToolbarTap(canvasX, canvasY) { return kufTrainingHandleToolbarTap.call(this, canvasX, canvasY); }

  /**
   * Start training a unit from the toolbar if the player can afford it.
   * @param {number} slotIndex - Index of the toolbar slot to train from.
   */
  tryStartTraining(slotIndex) { return kufTrainingTryStartTraining.call(this, slotIndex); }

  /**
   * Update training timers and spawn completed units at the base.
   * @param {number} delta - Delta time in seconds.
   */
  updateTraining(delta) { return kufTrainingUpdateTraining.call(this, delta); }

  /**
   * Spawn a trained unit at the base core exit.
   * Workers increase income per kill instead of spawning a combat unit.
   * @param {string} unitType - Unit archetype identifier.
   */
  spawnTrainedUnit(unitType) { return kufTrainingSpawnTrainedUnit.call(this, unitType); }

  /**
   * Calculate the base core position in world coordinates for spawning units.
   * @returns {{ x: number, y: number }} World position of the base.
   */
  getBaseWorldPosition() { return kufTrainingGetBaseWorldPosition.call(this); }

  /**
   * Initialize the core ship hull integrity and cannon mounts for a new simulation.
   * @param {{ health: number, cannons: number, hullRepair: number, healingAura: number, shield: number, droneRate: number, droneHealth: number, droneDamage: number, level: number, scale: number }} coreShipStats - Derived core ship stats.
   */
  initializeCoreShip(coreShipStats) { return kufTrainingInitializeCoreShip.call(this, coreShipStats); }

  /**
   * Resume a paused simulation without resetting game state.
   * Used when returning to the Kuf tab after the simulation was paused.
   */
  resume() {
    if (this.active) {
      return; // Already running
    }
    // Only resume if there's an active battle in progress.
    // A battle is considered active when either marines (player units) OR turrets (enemies) exist.
    // Both being empty means no battle was started, or the battle has already concluded.
    if (this.marines.length === 0 && this.turrets.length === 0) {
      return; // No battle in progress to resume
    }
    this.active = true;
    this.attachCameraControls();
    if (this.canvas) {
      this.canvas.style.cursor = 'grab';
    }
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.step);
  }

  reset() {
    this.marines = [];
    this.turrets = [];
    this.bullets = [];
    this.explosions = [];
    this.drones = [];
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
    // Reset worker count and income per kill when resetting the simulation.
    this.workerCount = 0;
    this.baseIncomePerKill = 1;
    this.selectedEnemy = null;
    // Clear core ship state so fresh runs rehydrate hull integrity correctly.
    this.coreShip = null;
    // Reset any in-flight training so new simulations start with a clean toolbar.
    this.trainingSlots.forEach((slot) => {
      slot.isTraining = false;
      slot.progress = 0;
    });
    // Clear any pending toolbar tap timers so equips don't bleed into new runs.
    if (this.toolbarTapTimer) {
      clearTimeout(this.toolbarTapTimer);
      this.toolbarTapTimer = null;
      this.pendingToolbarSlotIndex = null;
    }
    // Clear the glowing toolbar slot state.
    this.clearToolbarGlow();
    this.drawBackground(true);
  }

  buildTurrets() {
    // Populate the battlefield using the currently selected map layout.
    const layout = Array.isArray(this.currentMap?.layout) ? this.currentMap.layout : [];

    layout.forEach((enemy) => {
      const pos = this.gridToPixels(enemy.gridX, enemy.gridY);
      this.createEnemy(enemy.type, pos.x, pos.y, enemy.level);
    });
  }

  createEnemy(type, x, y, level = 1) {
    const baseStats = this.getEnemyBaseStats(type);
    if (!baseStats) {
      console.warn(`Unknown enemy type: ${type}`);
      return;
    }

    const enemy = {
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: baseStats.radius,
      health: baseStats.health * level,
      maxHealth: baseStats.health * level,
      attack: baseStats.attack * level,
      attackSpeed: baseStats.attackSpeed,
      cooldown: 0,
      range: baseStats.range,
      level,
      // Preserve per-enemy reward information so structures can offer higher payouts.
      goldValue: typeof baseStats.goldValue === 'number' ? baseStats.goldValue : 5,
      ...baseStats.extra,
    };

    this.turrets.push(enemy);
  }

  getEnemyBaseStats(type) {
    // Pull the latest enemy baseline from the shared definition catalog.
    return getKufEnemyBaseStats(type);
  }

  step(timestamp) {
    if (!this.active) {
      return;
    }
    const dt = Math.min(64, timestamp - this.lastTimestamp || 16);
    this.lastTimestamp = timestamp;
    const delta = dt / 1000;

    const frameStart = performance.now();
    this.update(delta);
    this.render();
    this.updateRenderProfile(performance.now() - frameStart);
    if (this.active) {
      requestAnimationFrame(this.step);
    }
  }

  /**
   * Adapt rendering detail based on recent frame costs to keep simulation fluid on weaker hardware.
   * @param {number} frameCostMs - Combined update+render duration for the last frame.
   */
  updateRenderProfile(frameCostMs) {
    const previousProfile = this.renderProfile;
    const forceLightProfile = this.userRenderMode === 'minimal' || isLowGraphicsModeActive();
    if (forceLightProfile) {
      // Honor explicit performance mode and the global low graphics preference.
      this.renderProfile = 'light';
      this.overlaySkipInterval = 2;
    } else if (this.userRenderMode === 'cinematic') {
      this.renderProfile = 'high';
      this.overlaySkipInterval = 1;
    } else {
      this.smoothedFrameCost = (1 - FRAME_COST_SMOOTHING) * this.smoothedFrameCost + FRAME_COST_SMOOTHING * frameCostMs;
      const shouldDownshift = this.smoothedFrameCost > HIGH_QUALITY_FRAME_BUDGET_MS;
      this.renderProfile = shouldDownshift ? 'light' : 'high';
      this.overlaySkipInterval = shouldDownshift ? 2 : 1;
    }

    // Reduce canvas resolution when shifting into a lighter render profile to keep frame times healthy.
    const targetMaxDpr = this.renderProfile === 'light' ? 1.1 : 1.5;
    const resolutionChanged = targetMaxDpr !== this.maxDevicePixelRatio;
    this.maxDevicePixelRatio = targetMaxDpr;
    if (resolutionChanged || previousProfile !== this.renderProfile) {
      this.resize();
    }
  }

  /**
   * Apply player-driven visual preferences like glow overlays and fixed render modes.
   * @param {{ renderMode?: 'auto' | 'minimal' | 'cinematic', glowOverlays?: boolean }} settings - Visual toggles.
   */
  setVisualSettings(settings = {}) {
    if (settings.renderMode) {
      this.userRenderMode = settings.renderMode;
    }
    if (typeof settings.glowOverlays === 'boolean') {
      this.glowOverlaysEnabled = settings.glowOverlays;
    }
    this.updateRenderProfile(this.smoothedFrameCost);
  }

  update(delta) {
    // Advance base training queues alongside unit, turret, and projectile updates.
    this.updateTraining(delta);
    this.updateMarines(delta);
    // Fire core ship cannons and keep the hull anchored to the HUD base.
    this.updateCoreShip(delta);
    this.updateTurrets(delta);
    this.updateBullets(delta);
    this.updateExplosions(delta);
    this.updateCamera(delta);
    this.checkVictoryConditions();
  }

  updateCamera(delta) {
    // If not dragging, follow the forward-most (lowest y) marine
    if (!this.cameraDrag.active && this.marines.length > 0) {
      let forwardMost = this.marines[0];
      this.marines.forEach((marine) => {
        if (marine.y < forwardMost.y) {
          forwardMost = marine;
        }
      });
      
      // Smoothly move camera to follow the forward-most unit
      const targetX = forwardMost.x - this.bounds.width / 2 / this.camera.zoom;
      const targetY = forwardMost.y - this.bounds.height / 2 / this.camera.zoom;
      const smoothing = 2.0;
      
      this.camera.x += (targetX - this.camera.x) * smoothing * delta;
      this.camera.y += (targetY - this.camera.y) * smoothing * delta;
    }
  }

  updateMarines(delta) { kufUpdateMarines.call(this, delta); }

  /**
   * Update core ship position, hull integrity, and cannon firing cadence.
   * @param {number} delta - Delta time in seconds.
   */
  updateCoreShip(delta) { kufUpdateCoreShip.call(this, delta); }
  
  /**
   * Update drone AI and combat behavior.
   * @param {number} delta - Delta time in seconds.
   */
  updateDrones(delta) { kufUpdateDrones.call(this, delta); }

  updateTurrets(delta) { kufUpdateTurrets.call(this, delta); }

  triggerMineExplosion(mine) { kufTriggerMineExplosion.call(this, mine); }

  updateExplosions(delta) { kufUpdateExplosions.call(this, delta); }

  updateBullets(delta) { kufUpdateBullets.call(this, delta); }

  spawnBullet({ owner, type, x, y, target, speed, damage, homing = false, angle = null, effects = null, pierce = 0 }) { kufSpawnBullet.call(this, { owner, type, x, y, target, speed, damage, homing, angle, effects, pierce }); }

  fireTurret(turret, target) { kufFireTurret.call(this, turret, target); }

  getTurretAttackModifier(turret) { return kufGetTurretAttackModifier.call(this, turret); }

  handleSupportDrone(drone, delta) { kufHandleSupportDrone.call(this, drone, delta); }

  findDamagedTurret(x, y, range, exclude) { return kufFindDamagedTurret.call(this, x, y, range, exclude); }

  applyBulletEffects(target, effects) { kufApplyBulletEffects.call(this, target, effects); }

  updateMarineStatus(marine, delta) { kufUpdateMarineStatus.call(this, marine, delta); }

  getFieldSlowMultiplier(marine) { return kufGetFieldSlowMultiplier.call(this, marine); }

  getMapById(mapId) {
    if (!mapId) {
      return this.availableMaps[0] || null;
    }
    return this.availableMaps.find((map) => map.id === mapId) || this.availableMaps[0] || null;
  }

  /**
   * Replace the cached map dataset with the supplied collection.
   * @param {Array<object>} maps - Updated battlefield definitions.
   */
  setAvailableMaps(maps) {
    this.availableMaps = Array.isArray(maps) ? maps.map((map) => ({ ...map })) : [];
    this.defaultMapId = this.availableMaps[0]?.id || sharedDefaultKufMapId;
    if (!this.availableMaps.length) {
      this.activeMapId = this.defaultMapId;
      this.currentMap = null;
      return;
    }
    if (!this.activeMapId || !this.getMapById(this.activeMapId)) {
      this.activeMapId = this.defaultMapId;
    }
    this.currentMap = this.getMapById(this.activeMapId);
  }

  /**
   * Update the active map selection, falling back to the default when missing.
   * @param {string} mapId - Requested map identifier.
   */
  setActiveMap(mapId) {
    const nextMap = this.getMapById(mapId);
    if (nextMap) {
      this.activeMapId = nextMap.id;
      this.currentMap = nextMap;
      return;
    }
    this.activeMapId = this.defaultMapId;
    this.currentMap = this.getMapById(this.activeMapId);
  }

  /**
   * Provide the default map identifier so UI components can mirror the selection logic.
   * @returns {string}
   */
  getDefaultMapId() {
    return this.defaultMapId || sharedDefaultKufMapId;
  }

  findClosestTurret(x, y, range) { return kufFindClosestTurret.call(this, x, y, range); }

  findClosestMarine(x, y, range) { return kufFindClosestMarine.call(this, x, y, range); }

  /**
   * Find the closest player-controlled target, including marines, drones, and the core ship hull.
   * @param {number} x - X coordinate in world space.
   * @param {number} y - Y coordinate in world space.
   * @param {number} range - Targeting range in pixels.
   * @returns {object|null} Closest target in range.
   */
  findClosestPlayerTarget(x, y, range) { return kufFindClosestPlayerTarget.call(this, x, y, range); }

  findHit(targets, bullet) { return kufFindHit.call(this, targets, bullet); }

  isOnscreen(bullet) { return kufIsOnscreen.call(this, bullet); }

  checkVictoryConditions() {
    if (this.coreShip && this.coreShip.health <= 0) {
      this.complete(false);
      return;
    }
    if (this.turrets.length <= 0) {
      this.complete(true);
    }
  }

  complete(victory) {
    this.active = false;
    this.render();
    if (this.onComplete) {
      this.onComplete({
        goldEarned: this.goldEarned,
        victory,
        destroyedTurrets: this.destroyedTurrets,
        mapId: this.activeMapId,
      });
    }
  }

  drawBackground(force = false) { kufDrawBackground.call(this, force); }
  drawTrianglePattern() { kufDrawTrianglePattern.call(this); }
  render() { kufRender.call(this); }
  shouldSkipOverlays() { return kufShouldSkipOverlays.call(this); }
  drawMarines() { kufDrawMarines.call(this); }
  drawDrones() { kufDrawDrones.call(this); }
  drawTurrets() { kufDrawTurrets.call(this); }
  drawBullets() { kufDrawBullets.call(this); }
  drawHealthBars() { kufDrawHealthBars.call(this); }
  drawLevelIndicators() { kufDrawLevelIndicators.call(this); }
  drawExplosions() { kufDrawExplosions.call(this); }
  drawSelectedEnemyBox() { kufDrawSelectedEnemyBox.call(this); }

  /**
   * Render the base core that anchors the training toolbar.
   * @param {{ baseCenter: { x: number, y: number }, baseRadius: number }} layout - HUD layout details.
   */
  drawBaseCore(layout) { kufDrawBaseCore.call(this, layout); }

  /**
   * Render the training toolbar with unit slots, costs, and progress fills.
   * @param {{ slots: Array<{ x: number, y: number, size: number, slot: object }> }} layout - HUD layout details.
   */
  drawTrainingToolbar(layout) { kufDrawTrainingToolbar.call(this, layout); }

  drawHud() { kufDrawHud.call(this); }

  /**
   * Draw the selection rectangle while dragging.
   */
  drawSelectionBox() { kufDrawSelectionBox.call(this); }

  /**
   * Draw waypoint marker in the world.
   */
  drawWaypointMarker() { kufDrawWaypointMarker.call(this); }

  /**
   * Draw lines from units to their individual waypoints to show queued movement.
   */
  drawUnitWaypointLines() { kufDrawUnitWaypointLines.call(this); }
}
