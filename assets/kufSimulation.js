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
  STRUCTURE_CONFIG,
  RENDERING_CONFIG,
  CAMERA_CONFIG,
  GAMEPLAY_CONFIG,
  GRID_UNIT,
  DEFAULT_UNIT_STATS,
  DEFAULT_UNIT_COUNTS,
  TWO_PI,
  KUF_HUD_LAYOUT,
  KUF_CORE_SHIP_COMBAT,
  SPLAYER_BASE_SPIN_SPEED,
  SPLAYER_SPIN_BOOST_MULTIPLIER,
  SPLAYER_SPIN_BOOST_DURATION,
  KUF_TRAINING_CATALOG,
  WORKER_BASE_COST,
  WORKER_COST_INCREMENT,
  KUF_EQUIPPABLE_UNIT_IDS,
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
const MARINE_ACCELERATION = MARINE_CONFIG.ACCELERATION;
const MARINE_RANGE = MARINE_CONFIG.RANGE;
const MARINE_RADIUS = MARINE_CONFIG.RADIUS;
const MARINE_BULLET_SPEED = MARINE_CONFIG.BULLET_SPEED;

const SNIPER_RADIUS = SNIPER_CONFIG.RADIUS;
const SNIPER_RANGE = SNIPER_CONFIG.RANGE;
const SNIPER_BULLET_SPEED = SNIPER_CONFIG.BULLET_SPEED;

const SPLAYER_RADIUS = SPLAYER_CONFIG.RADIUS;
const SPLAYER_RANGE = SPLAYER_CONFIG.RANGE;
const SPLAYER_ROCKET_SPEED = SPLAYER_CONFIG.ROCKET_SPEED;

// Define the piercing laser unit's silhouette and engagement range.
const LASER_RADIUS = LASER_CONFIG.RADIUS;
const LASER_RANGE = LASER_CONFIG.RANGE;
const LASER_BULLET_SPEED = LASER_CONFIG.BULLET_SPEED;
// Define how many total hits a piercing laser beam can register before dissipating.
const LASER_PIERCE_COUNT = 3;

const TURRET_RADIUS = TURRET_CONFIG.RADIUS;
const TURRET_BULLET_SPEED = TURRET_CONFIG.BULLET_SPEED;

const MINE_EXPLOSION_RADIUS = STRUCTURE_CONFIG.MINE_EXPLOSION_RADIUS;

const TRAIL_ALPHA = RENDERING_CONFIG.TRAIL_ALPHA;
const LOW_TRAIL_ALPHA = RENDERING_CONFIG.LOW_TRAIL_ALPHA;
const HIGH_QUALITY_FRAME_BUDGET_MS = RENDERING_CONFIG.HIGH_QUALITY_FRAME_BUDGET_MS;
const FRAME_COST_SMOOTHING = RENDERING_CONFIG.FRAME_COST_SMOOTHING;

const CAMERA_PAN_SPEED = CAMERA_CONFIG.PAN_SPEED;
const MIN_ZOOM = CAMERA_CONFIG.MIN_ZOOM;
const MAX_ZOOM = CAMERA_CONFIG.MAX_ZOOM;

const SPAWN_AREA_MARGIN = GAMEPLAY_CONFIG.SPAWN_AREA_MARGIN;
const BULLET_CULLING_MARGIN = GAMEPLAY_CONFIG.BULLET_CULLING_MARGIN;

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
  resize() {
    if (!this.canvas) {
      return;
    }
    const parent = this.canvas.parentElement;
    if (!parent) {
      return;
    }
    // Derive canvas size from viewport bounds while preserving the battlefield aspect ratio.
    // Fixed 3:4 aspect ratio (width:height) for consistency with Aleph and Bet Spires.
    const aspectRatio = 3 / 4;
    const parentWidth = parent.clientWidth || 640;
    const viewportWidth = typeof window.innerWidth === 'number' ? Math.max(1, window.innerWidth - 48) : parentWidth;
    const viewportHeight = typeof window.innerHeight === 'number' ? Math.max(240, window.innerHeight - 260) : parentWidth / aspectRatio;
    // Limit horizontal growth when the viewport height becomes the constraining dimension.
    const maxWidthByHeight = Math.max(240, viewportHeight * aspectRatio);
    const width = Math.min(parentWidth, viewportWidth, maxWidthByHeight);
    const height = width / aspectRatio;
    const dpr = this.getEffectiveDevicePixelRatio();
    this.pixelRatio = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.bounds = { width, height };
      this.drawBackground(true);
    }
  }

  /**
   * Clamp the canvas resolution to keep the Kuf encounter playable on high-DPI hardware.
   * @returns {number} Effective device pixel ratio for rendering
   */
  getEffectiveDevicePixelRatio() {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = Number.isFinite(this.maxDevicePixelRatio) ? this.maxDevicePixelRatio : rawDpr;
    return Math.max(1, Math.min(rawDpr, cap));
  }

  /**
   * Attach camera control event listeners.
   */
  attachCameraControls() {
    if (!this.canvas) {
      return;
    }
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd);
  }

  /**
   * Remove camera control event listeners.
   */
  detachCameraControls() {
    if (!this.canvas) {
      return;
    }
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
  }

  handleMouseDown(e) {
    this.dragStartTime = performance.now();
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    this.selectionBox.startX = canvasX;
    this.selectionBox.startY = canvasY;
    this.selectionBox.endX = canvasX;
    this.selectionBox.endY = canvasY;
    this.selectionBox.active = false; // Will activate if drag continues
    
    // Also prepare camera drag in case it becomes a pan
    this.cameraDrag.startX = e.clientX;
    this.cameraDrag.startY = e.clientY;
    this.cameraDrag.camStartX = this.camera.x;
    this.cameraDrag.camStartY = this.camera.y;
  }

  handleMouseMove(e) {
    const elapsed = performance.now() - this.dragStartTime;
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // If we've been dragging for more than threshold, it's a selection drag
    if (elapsed > this.dragThreshold) {
      this.selectionBox.active = true;
      this.selectionBox.endX = canvasX;
      this.selectionBox.endY = canvasY;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  handleMouseUp(e) {
    const elapsed = performance.now() - this.dragStartTime;
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    if (this.selectionBox.active) {
      // Complete selection - select units in the box
      this.completeSelection();
      this.selectionBox.active = false;
      this.canvas.style.cursor = 'grab';
    } else if (elapsed < this.dragThreshold) {
      // Consume taps that land on the training toolbar before issuing commands.
      if (this.handleToolbarTap(canvasX, canvasY)) {
        this.cameraDrag.active = false;
        this.canvas.style.cursor = 'grab';
        return;
      }
      // It was a tap/click - issue attack-move command or handle double-tap
      const now = performance.now();
      const isDoubleTap = (now - this.lastTapTime) < this.doubleTapThreshold;
      this.lastTapTime = now;
      
      if (isDoubleTap) {
        // Double-tap: deselect all units and return to "all units" mode
        this.selectedUnits = [];
        this.selectionMode = 'all';
        this.attackMoveWaypoint = null;
        // Clear targeted enemies when resetting the selection state.
        this.selectedEnemy = null;
      } else {
        // Single tap: issue a contextual command (target or move).
        this.handleCommandTap(canvasX, canvasY);
      }
    }
    
    this.cameraDrag.active = false;
    this.canvas.style.cursor = 'grab';
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.zoom * zoomDelta));
  }

  handleClick(e) {
    // This is now mostly handled by handleMouseUp to detect taps vs drags
    // Keep this for compatibility but the main logic is in handleMouseUp
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.dragStartTime = performance.now();
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = touch.clientX - rect.left;
      const canvasY = touch.clientY - rect.top;
      
      this.selectionBox.startX = canvasX;
      this.selectionBox.startY = canvasY;
      this.selectionBox.endX = canvasX;
      this.selectionBox.endY = canvasY;
      this.selectionBox.active = false;
      
      this.cameraDrag.startX = touch.clientX;
      this.cameraDrag.startY = touch.clientY;
      this.cameraDrag.camStartX = this.camera.x;
      this.cameraDrag.camStartY = this.camera.y;
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const elapsed = performance.now() - this.dragStartTime;
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = touch.clientX - rect.left;
      const canvasY = touch.clientY - rect.top;
      
      if (elapsed > this.dragThreshold) {
        this.selectionBox.active = true;
        this.selectionBox.endX = canvasX;
        this.selectionBox.endY = canvasY;
      }
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    const elapsed = performance.now() - this.dragStartTime;
    
    if (this.selectionBox.active) {
      this.completeSelection();
      this.selectionBox.active = false;
    } else if (elapsed < this.dragThreshold && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = touch.clientX - rect.left;
      const canvasY = touch.clientY - rect.top;
      // Consume taps that land on the training toolbar before issuing commands.
      if (this.handleToolbarTap(canvasX, canvasY)) {
        return;
      }
      
      const now = performance.now();
      const isDoubleTap = (now - this.lastTapTime) < this.doubleTapThreshold;
      this.lastTapTime = now;
      
      if (isDoubleTap) {
        this.selectedUnits = [];
        this.selectionMode = 'all';
        this.attackMoveWaypoint = null;
        // Clear targeted enemies when resetting the selection state.
        this.selectedEnemy = null;
      } else {
        // Single tap: issue a contextual command (target or move).
        this.handleCommandTap(canvasX, canvasY);
      }
    }
  }

  /**
   * Convert a canvas-space coordinate to world-space coordinates.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {{ x: number, y: number }} World coordinates.
   */
  canvasToWorld(canvasX, canvasY) {
    return {
      x: (canvasX - this.bounds.width / 2) / this.camera.zoom + this.bounds.width / 2 + this.camera.x,
      y: (canvasY - this.bounds.height / 2) / this.camera.zoom + this.bounds.height / 2 + this.camera.y,
    };
  }

  /**
   * Resolve a turret/enemy under the tap point in world space.
   * @param {number} worldX - X coordinate in world space.
   * @param {number} worldY - Y coordinate in world space.
   * @returns {object|null} Targeted enemy or null.
   */
  findEnemyAtPoint(worldX, worldY) {
    const hit = this.turrets.find((turret) => {
      const dx = turret.x - worldX;
      const dy = turret.y - worldY;
      const radius = (turret.radius || TURRET_RADIUS) + 6;
      return dx * dx + dy * dy <= radius * radius;
    });
    return hit || null;
  }

  /**
   * Handle tap-based commands to target enemies or set move destinations.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   */
  handleCommandTap(canvasX, canvasY) {
    // Clear toolbar glow when clicking elsewhere in the battlefield.
    this.clearToolbarGlow();
    
    const { x: worldX, y: worldY } = this.canvasToWorld(canvasX, canvasY);
    const enemy = this.findEnemyAtPoint(worldX, worldY);
    if (enemy) {
      this.issueTargetCommand(enemy);
      return;
    }
    // Clear any enemy focus before issuing a movement command.
    this.selectedEnemy = null;
    this.setAttackMoveWaypoint(worldX, worldY);
  }

  /**
   * Send a focused attack command on a tapped enemy.
   * @param {object} enemy - Enemy unit or structure to focus.
   */
  issueTargetCommand(enemy) {
    this.selectedEnemy = enemy;
    // Clear any stored waypoints so units commit to the new focus target.
    this.attackMoveWaypoint = null;
    this.marines.forEach((marine) => {
      marine.waypoint = null;
    });
  }

  /**
   * Complete selection by finding all units within the selection rectangle.
   */
  completeSelection() {
    const rect = this.canvas.getBoundingClientRect();
    
    // Convert selection box canvas coordinates to world coordinates
    const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
    const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
    const minY = Math.min(this.selectionBox.startY, this.selectionBox.endY);
    const maxY = Math.max(this.selectionBox.startY, this.selectionBox.endY);
    
    // Select all marines within the box
    this.selectedUnits = this.marines.filter((marine) => {
      // Convert marine world position to canvas coordinates
      const screenX = (marine.x - this.camera.x - this.bounds.width / 2) * this.camera.zoom + this.bounds.width / 2;
      const screenY = (marine.y - this.camera.y - this.bounds.height / 2) * this.camera.zoom + this.bounds.height / 2;
      
      return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    });
    
    if (this.selectedUnits.length > 0) {
      this.selectionMode = 'specific';
    } else {
      this.selectionMode = 'all';
    }
  }

  /**
   * Set attack-move waypoint for units.
   */
  setAttackMoveWaypoint(worldX, worldY) {
    this.attackMoveWaypoint = { x: worldX, y: worldY };
    
    // Assign waypoint to selected units or all units
    const unitsToCommand = this.selectionMode === 'specific' ? this.selectedUnits : this.marines;
    // Build a compact formation so each unit gets a unique waypoint with diameter spacing.
    const formationAssignments = this.getFormationWaypoints(unitsToCommand, worldX, worldY);
    unitsToCommand.forEach((marine, index) => {
      // Apply the formation slot to the unit waypoint for group movement.
      marine.waypoint = formationAssignments[index] || { x: worldX, y: worldY };
    });
  }

  /**
   * Generate formation waypoints centered on the target with diameter gaps between units.
   * 
   * Units are arranged in a lattice grid where each unit is spaced 1 diameter apart (edge-to-edge).
   * For example, if units are 1 meter in diameter, the center-to-center spacing will be 2 meters,
   * resulting in 1 meter of clearance between unit edges so they never overlap.
   * 
   * @param {Array<object>} units - Units that should be arranged into the formation.
   * @param {number} targetX - Formation center X coordinate.
   * @param {number} targetY - Formation center Y coordinate.
   * @returns {Array<{x: number, y: number}>} Array of world-space waypoints per unit.
   */
  getFormationWaypoints(units, targetX, targetY) {
    // Return a single waypoint when there are no units to arrange.
    if (!units.length) {
      return [{ x: targetX, y: targetY }];
    }
    // Use the largest unit radius to guarantee enough spacing for mixed unit sizes.
    const maxRadius = Math.max(...units.map((unit) => unit.radius || MARINE_RADIUS));
    // Spacing calculation: To keep units 1 diameter apart (edge-to-edge), the center-to-center
    // distance must be 2 diameters = 4 radii. This ensures no unit will overlap during movement.
    const diameter = maxRadius * 2;
    const spacing = diameter * 2;  // Center-to-center distance = 2 diameters
    // Calculate a near-square grid for even distribution around the center.
    const columns = Math.ceil(Math.sqrt(units.length));
    const rows = Math.ceil(units.length / columns);
    // Precompute centered offsets to keep the formation anchored to the command point.
    const offsetXStart = -((columns - 1) * spacing) / 2;
    const offsetYStart = -((rows - 1) * spacing) / 2;

    return units.map((_, index) => {
      // Map the unit index to a row/column slot in the formation grid.
      const row = Math.floor(index / columns);
      const column = index % columns;
      const offsetX = offsetXStart + column * spacing;
      const offsetY = offsetYStart + row * spacing;
      // Center each waypoint on the commanded location.
      return { x: targetX + offsetX, y: targetY + offsetY };
    });
  }

  /**
   * Resolve the currently focused enemy and clear invalid references.
   * @returns {object|null} Focused enemy or null when none is active.
   */
  getFocusedEnemy() {
    if (!this.selectedEnemy) {
      return null;
    }
    if (this.selectedEnemy.health <= 0 || !this.turrets.includes(this.selectedEnemy)) {
      this.selectedEnemy = null;
      return null;
    }
    return this.selectedEnemy;
  }

  /**
   * Accelerate a unit toward a target point, returning true when close enough to stop.
   * @param {object} marine - Unit to move.
   * @param {number} targetX - Desired x coordinate in world space.
   * @param {number} targetY - Desired y coordinate in world space.
   * @param {number} delta - Delta time in seconds.
   * @returns {boolean} True when the unit is within the stopping threshold.
   */
  steerUnitToward(marine, targetX, targetY, delta) {
    const dx = targetX - marine.x;
    const dy = targetY - marine.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 5) {
      marine.vx = 0;
      marine.vy = 0;
      return true;
    }
    const targetVx = (dx / dist) * marine.moveSpeed;
    const targetVy = (dy / dist) * marine.moveSpeed;
    const acceleration = MARINE_ACCELERATION * delta;

    if (marine.vx < targetVx) {
      marine.vx = Math.min(targetVx, marine.vx + acceleration);
    } else if (marine.vx > targetVx) {
      marine.vx = Math.max(targetVx, marine.vx - acceleration);
    }

    if (marine.vy < targetVy) {
      marine.vy = Math.min(targetVy, marine.vy + acceleration);
    } else if (marine.vy > targetVy) {
      marine.vy = Math.max(targetVy, marine.vy - acceleration);
    }
    return false;
  }

  /**
   * Ease a unit's velocity back to zero.
   * @param {object} marine - Unit to decelerate.
   * @param {number} delta - Delta time in seconds.
   */
  decelerateUnit(marine, delta) {
    const deceleration = MARINE_ACCELERATION * delta;
    if (Math.abs(marine.vy) > deceleration) {
      marine.vy += marine.vy > 0 ? -deceleration : deceleration;
    } else {
      marine.vy = 0;
    }
    if (Math.abs(marine.vx) > deceleration) {
      marine.vx += marine.vx > 0 ? -deceleration : deceleration;
    } else {
      marine.vx = 0;
    }
  }

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
  getHudLayout() {
    const { TOOLBAR_SLOT_SIZE, TOOLBAR_SLOT_GAP, TOOLBAR_BOTTOM_PADDING, BASE_RADIUS, BASE_TO_TOOLBAR_GAP } = KUF_HUD_LAYOUT;
    const toolbarWidth = TOOLBAR_SLOT_SIZE * this.trainingSlots.length + TOOLBAR_SLOT_GAP * (this.trainingSlots.length - 1);
    const toolbarX = (this.bounds.width - toolbarWidth) / 2;
    const toolbarY = this.bounds.height - TOOLBAR_BOTTOM_PADDING - TOOLBAR_SLOT_SIZE;
    // Anchor the base core just above the toolbar so it feels docked to the player interface.
    const baseCenter = {
      x: this.bounds.width / 2,
      y: toolbarY - BASE_TO_TOOLBAR_GAP - BASE_RADIUS,
    };
    const slots = this.trainingSlots.map((slot, index) => ({
      x: toolbarX + index * (TOOLBAR_SLOT_SIZE + TOOLBAR_SLOT_GAP),
      y: toolbarY,
      size: TOOLBAR_SLOT_SIZE,
      slot,
    }));
    return { baseCenter, baseRadius: BASE_RADIUS, slots };
  }

  /**
   * Convert a HUD-space point into a toolbar slot index if tapped.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {number|null} Toolbar slot index when hit, otherwise null.
   */
  getToolbarSlotIndex(canvasX, canvasY) {
    const { slots } = this.getHudLayout();
    const hitSlot = slots.find((slot) =>
      canvasX >= slot.x &&
      canvasX <= slot.x + slot.size &&
      canvasY >= slot.y &&
      canvasY <= slot.y + slot.size
    );
    return hitSlot ? slots.indexOf(hitSlot) : null;
  }

  /**
   * Resolve the current unit spec for a toolbar slot.
   * Handles dynamic worker cost calculation: cost = WORKER_BASE_COST + (workerCount * WORKER_COST_INCREMENT).
   * @param {object} slot - Toolbar slot payload.
   * @returns {{ id: string, label: string, icon: string, cost: number, duration: number }} Unit spec.
   */
  getTrainingSpecForSlot(slot) {
    const baseSpec = KUF_TRAINING_CATALOG[slot?.unitId] || KUF_TRAINING_CATALOG.worker;
    // If this is a worker slot, calculate dynamic cost based on current worker count.
    if (baseSpec.id === 'worker') {
      const workerCost = WORKER_BASE_COST + (this.workerCount * WORKER_COST_INCREMENT);
      return { ...baseSpec, cost: workerCost };
    }
    return baseSpec;
  }

  /**
   * Cycle the equipped unit for a customizable toolbar slot.
   * @param {number} slotIndex - Index of the toolbar slot to update.
   */
  cycleToolbarSlotUnit(slotIndex) {
    const slot = this.trainingSlots[slotIndex];
    if (!slot || !slot.equipable || slot.isTraining) {
      return;
    }
    const currentIndex = KUF_EQUIPPABLE_UNIT_IDS.indexOf(slot.unitId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % KUF_EQUIPPABLE_UNIT_IDS.length : 0;
    const nextUnitId = KUF_EQUIPPABLE_UNIT_IDS[nextIndex];
    slot.unitId = nextUnitId;
  }

  /**
   * Clear the glowing state for the toolbar slots.
   */
  clearToolbarGlow() {
    this.glowingToolbarSlotIndex = null;
  }

  /**
   * Handle taps that land on the training toolbar.
   * @param {number} canvasX - X coordinate within the canvas.
   * @param {number} canvasY - Y coordinate within the canvas.
   * @returns {boolean} True when the tap was consumed by the toolbar.
   */
  handleToolbarTap(canvasX, canvasY) {
    const slotIndex = this.getToolbarSlotIndex(canvasX, canvasY);
    if (slotIndex === null) {
      return false;
    }
    const now = performance.now();
    const isDoubleTap = this.lastToolbarTap.slotIndex === slotIndex &&
      (now - this.lastToolbarTap.time) < this.doubleTapThreshold;
    if (isDoubleTap) {
      // Clear pending single-tap actions so double-tap starts training immediately.
      if (this.toolbarTapTimer) {
        clearTimeout(this.toolbarTapTimer);
        this.toolbarTapTimer = null;
        this.pendingToolbarSlotIndex = null;
      }
      // Clear the glow state when double-tapping to start training.
      this.clearToolbarGlow();
      this.lastToolbarTap = { time: 0, slotIndex: null };
      this.tryStartTraining(slotIndex);
      return true;
    }
    // Single tap: just make the slot glow (indicate selection).
    this.lastToolbarTap = { time: now, slotIndex };
    this.glowingToolbarSlotIndex = slotIndex;
    // No need to schedule anything - the glow is just visual feedback.
    return true;
  }

  /**
   * Start training a unit from the toolbar if the player can afford it.
   * @param {number} slotIndex - Index of the toolbar slot to train from.
   */
  tryStartTraining(slotIndex) {
    if (!this.active) {
      return;
    }
    const slot = this.trainingSlots[slotIndex];
    if (!slot || slot.isTraining) {
      return;
    }
    // Resolve the currently equipped unit for this slot before spending gold.
    const spec = this.getTrainingSpecForSlot(slot);
    if (this.goldEarned < spec.cost) {
      return;
    }
    // Deduct gold immediately so remaining gold is always spendable elsewhere.
    this.goldEarned = Math.max(0, this.goldEarned - spec.cost);
    slot.isTraining = true;
    slot.progress = 0;
  }

  /**
   * Update training timers and spawn completed units at the base.
   * @param {number} delta - Delta time in seconds.
   */
  updateTraining(delta) {
    this.trainingSlots.forEach((slot) => {
      if (!slot.isTraining) {
        return;
      }
      // Pull the equipped unit spec so progress and spawn timing match the icon.
      const spec = this.getTrainingSpecForSlot(slot);
      slot.progress = Math.min(spec.duration, slot.progress + delta);
      if (slot.progress >= spec.duration) {
        slot.isTraining = false;
        slot.progress = 0;
        this.spawnTrainedUnit(spec.id);
      }
    });
  }

  /**
   * Spawn a trained unit at the base core exit.
   * Workers increase income per kill instead of spawning a combat unit.
   * @param {string} unitType - Unit archetype identifier.
   */
  spawnTrainedUnit(unitType) {
    // Workers increase income per kill by 1 and increment worker count.
    if (unitType === 'worker') {
      this.workerCount += 1;
      this.baseIncomePerKill += 1;
      return;
    }
    // Spawn combat units normally.
    const stats = this.unitStats[unitType] || this.unitStats.marine;
    const { x, y } = this.getBaseWorldPosition();
    const jitter = 14;
    const spawnX = x + (Math.random() - 0.5) * jitter;
    const spawnY = y + (Math.random() - 0.5) * jitter;
    this.createPlayerUnit(unitType, stats, spawnX, spawnY);
  }

  /**
   * Calculate the base core position in world coordinates for spawning units.
   * @returns {{ x: number, y: number }} World position of the base.
   */
  getBaseWorldPosition() {
    const { baseCenter } = this.getHudLayout();
    return {
      x: (baseCenter.x - this.bounds.width / 2) / this.camera.zoom + this.bounds.width / 2 + this.camera.x,
      y: (baseCenter.y - this.bounds.height / 2) / this.camera.zoom + this.bounds.height / 2 + this.camera.y,
    };
  }

  /**
   * Initialize the core ship hull integrity and cannon mounts for a new simulation.
   * @param {{ health: number, cannons: number, hullRepair: number, healingAura: number, shield: number, droneRate: number, droneHealth: number, droneDamage: number, level: number, scale: number }} coreShipStats - Derived core ship stats.
   */
  initializeCoreShip(coreShipStats) {
    const { baseRadius } = this.getHudLayout();
    const basePosition = this.getBaseWorldPosition();
    // Anchor the core ship to the HUD base so it stays docked to the toolbar.
    this.coreShip = {
      x: basePosition.x,
      y: basePosition.y,
      radius: baseRadius * KUF_CORE_SHIP_COMBAT.CORE_COLLISION_SCALE * (coreShipStats.scale || 1.0),
      health: Math.max(1, coreShipStats.health),
      maxHealth: Math.max(1, coreShipStats.health),
      cannons: Math.max(0, Math.floor(coreShipStats.cannons || 0)),
      cannonCooldown: 0,
      // Hull repair regeneration (HP per second)
      hullRepair: coreShipStats.hullRepair || 0,
      hullRepairCooldown: 0,
      // Healing aura
      healingAura: coreShipStats.healingAura || 0,
      healingAuraRadius: 150, // Radius for healing aura
      healingAuraCooldown: 0,
      // Shield system
      maxShield: coreShipStats.shield > 0 ? coreShipStats.shield * 50 : 0, // 50 HP per upgrade
      shield: 0, // Starts at 0, needs to regenerate
      shieldRegenRate: coreShipStats.shield > 0 ? 5 + coreShipStats.shield * 2 : 0, // 5 + 2 per upgrade
      shieldRegenDelay: 3, // Delay after taking damage
      shieldRegenTimer: 0,
      shieldBroken: false,
      // Drone spawning
      droneSpawnRate: coreShipStats.droneRate > 0 ? Math.max(0.5, 5 - coreShipStats.droneRate * 0.5) : 0, // Spawn every N seconds
      droneSpawnTimer: 0,
      droneHealth: 10 + coreShipStats.droneHealth * 5, // 10 base + 5 per upgrade
      droneDamage: 1 + coreShipStats.droneDamage * 0.5, // 1 base + 0.5 per upgrade
      // Level and visual scale
      level: coreShipStats.level || 1,
      scale: coreShipStats.scale || 1.0,
    };
    // Track spawned drones separately
    this.drones = [];
  }

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

  updateMarines(delta) {
    const focusedEnemy = this.getFocusedEnemy();
    this.marines.forEach((marine) => {
      this.updateMarineStatus(marine, delta);
      if (marine.health <= 0) {
        return;
      }
      // Animate splayer rotation continuously, with optional boost after firing.
      if (marine.type === 'splayer') {
        const boostedSpin = marine.rotationBoostTimer > 0 ? SPLAYER_SPIN_BOOST_MULTIPLIER : 1;
        marine.rotationBoostTimer = Math.max(0, marine.rotationBoostTimer - delta);
        marine.rotation = (marine.rotation + marine.rotationSpeed * boostedSpin * delta) % TWO_PI;
      }
      marine.cooldown = Math.max(0, marine.cooldown - delta);
      // Prioritize the focused enemy when one is set, only firing when it is in range.
      let target = null;
      if (focusedEnemy) {
        const dx = focusedEnemy.x - marine.x;
        const dy = focusedEnemy.y - marine.y;
        if (dx * dx + dy * dy <= marine.range * marine.range) {
          target = focusedEnemy;
        }
      } else {
        // Otherwise scan for the nearest target in range.
        target = this.findClosestTurret(marine.x, marine.y, marine.range);
      }
      
      // Check if unit has a waypoint and hasn't reached it yet
      const hasWaypoint = marine.waypoint && 
        (Math.abs(marine.x - marine.waypoint.x) > 5 || Math.abs(marine.y - marine.waypoint.y) > 5);
      
      // Fire at target if in range
      if (target && marine.cooldown <= 0) {
        if (marine.type === 'splayer') {
          // Launch a randomized ring of homing rockets toward the focused or nearest enemy.
          const rocketCount = 8;
          const rocketDamage = marine.attack * 0.25;
          for (let i = 0; i < rocketCount; i++) {
            const launchAngle = Math.random() * TWO_PI;
            this.spawnBullet({
              owner: 'marine',
              type: 'splayer',
              x: marine.x,
              y: marine.y - marine.radius,
              target,
              speed: SPLAYER_ROCKET_SPEED,
              damage: rocketDamage,
              homing: true,
              angle: launchAngle,
            });
          }
          // Boost splayer spin rate briefly after firing.
          marine.rotationBoostTimer = SPLAYER_SPIN_BOOST_DURATION;
        } else if (marine.type === 'laser') {
          // Fire a piercing laser bolt that can slice through multiple turrets.
          this.spawnBullet({
            owner: 'marine',
            type: 'laser',
            x: marine.x,
            y: marine.y - marine.radius,
            target,
            speed: LASER_BULLET_SPEED,
            damage: marine.attack,
            homing: false,
            pierce: LASER_PIERCE_COUNT,
          });
        } else {
          // Fire a single projectile for non-splayer units.
          this.spawnBullet({
            owner: 'marine',
            type: marine.type,
            x: marine.x,
            y: marine.y - marine.radius,
            target,
            speed: marine.type === 'sniper' ? SNIPER_BULLET_SPEED : MARINE_BULLET_SPEED,
            damage: marine.attack,
            homing: false,
          });
        }

        marine.cooldown = 1 / marine.attackSpeed;
      }
      
      // Handle movement independently of firing
      if (focusedEnemy && !hasWaypoint) {
        // Move toward the focused enemy while holding at max firing distance.
        const dx = focusedEnemy.x - marine.x;
        const dy = focusedEnemy.y - marine.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredDistance = Math.max(0, marine.range - this.targetHoldBuffer);
        const deltaDistance = dist - desiredDistance;
        const holdTolerance = this.targetHoldBuffer;
        if (Math.abs(deltaDistance) > holdTolerance) {
          // Navigate to the stand-off point that keeps the unit at optimal range.
          const standOffX = focusedEnemy.x - (dx / dist) * desiredDistance;
          const standOffY = focusedEnemy.y - (dy / dist) * desiredDistance;
          this.steerUnitToward(marine, standOffX, standOffY, delta);
        } else {
          // Hold position at max range until the target moves.
          this.decelerateUnit(marine, delta);
        }
      } else if (hasWaypoint) {
        // Move toward waypoint (attack-move behavior) - continue even if firing.
        const reached = this.steerUnitToward(marine, marine.waypoint.x, marine.waypoint.y, delta);
        if (reached) {
          // Reached waypoint - clear it and stop.
          marine.waypoint = null;
        }
      } else {
        // No waypoint, default behavior: accelerate forward (negative y is up)
        const targetVy = -marine.moveSpeed;
        const acceleration = MARINE_ACCELERATION * delta;
        if (marine.vy > targetVy) {
          marine.vy = Math.max(targetVy, marine.vy - acceleration);
        } else if (marine.vy < targetVy) {
          marine.vy = Math.min(targetVy, marine.vy + acceleration);
        }
        
        // Decelerate x velocity to 0 when moving in default mode
        const deceleration = MARINE_ACCELERATION * delta;
        if (Math.abs(marine.vx) > deceleration) {
          marine.vx += marine.vx > 0 ? -deceleration : deceleration;
        } else {
          marine.vx = 0;
        }
      }
      
      // Apply velocity
      marine.x += marine.vx * delta;
      marine.y += marine.vy * delta;
    });
    this.marines = this.marines.filter((marine) => marine.health > 0 && marine.y + marine.radius > -40);
  }

  /**
   * Update core ship position, hull integrity, and cannon firing cadence.
   * @param {number} delta - Delta time in seconds.
   */
  updateCoreShip(delta) {
    if (!this.coreShip) {
      return;
    }
    // Keep the core ship anchored to the HUD base even as the camera pans.
    const basePosition = this.getBaseWorldPosition();
    this.coreShip.x = basePosition.x;
    this.coreShip.y = basePosition.y;
    
    // Hull repair regeneration (level 2+)
    if (this.coreShip.hullRepair > 0 && this.coreShip.health < this.coreShip.maxHealth) {
      this.coreShip.hullRepairCooldown = Math.max(0, this.coreShip.hullRepairCooldown - delta);
      if (this.coreShip.hullRepairCooldown <= 0) {
        const repairAmount = this.coreShip.hullRepair * delta; // HP per second
        this.coreShip.health = Math.min(this.coreShip.maxHealth, this.coreShip.health + repairAmount);
        this.coreShip.hullRepairCooldown = 0.1; // Check every 0.1 seconds
      }
    }
    
    // Healing aura (level 3+)
    if (this.coreShip.healingAura > 0) {
      this.coreShip.healingAuraCooldown = Math.max(0, this.coreShip.healingAuraCooldown - delta);
      if (this.coreShip.healingAuraCooldown <= 0) {
        const healAmount = this.coreShip.healingAura * 0.1; // HP per tick
        this.marines.forEach((marine) => {
          const dx = marine.x - this.coreShip.x;
          const dy = marine.y - this.coreShip.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= this.coreShip.healingAuraRadius && marine.health < marine.maxHealth) {
            marine.health = Math.min(marine.maxHealth, marine.health + healAmount);
          }
        });
        this.coreShip.healingAuraCooldown = 0.1; // Heal every 0.1 seconds
      }
    }
    
    // Shield regeneration (level 4+)
    if (this.coreShip.maxShield > 0) {
      if (this.coreShip.shieldBroken) {
        // Shield needs to fully regenerate before coming back online
        this.coreShip.shieldRegenTimer += delta;
        if (this.coreShip.shieldRegenTimer >= this.coreShip.shieldRegenDelay) {
          this.coreShip.shield = Math.min(this.coreShip.maxShield, this.coreShip.shield + this.coreShip.shieldRegenRate * delta);
          if (this.coreShip.shield >= this.coreShip.maxShield) {
            this.coreShip.shield = this.coreShip.maxShield;
            this.coreShip.shieldBroken = false;
          }
        }
      } else if (this.coreShip.shield < this.coreShip.maxShield) {
        // Shield regenerates when not broken
        this.coreShip.shieldRegenTimer += delta;
        if (this.coreShip.shieldRegenTimer >= this.coreShip.shieldRegenDelay) {
          this.coreShip.shield = Math.min(this.coreShip.maxShield, this.coreShip.shield + this.coreShip.shieldRegenRate * delta);
        }
      }
    }
    
    // Drone spawning (level 5+)
    if (this.coreShip.droneSpawnRate > 0) {
      this.coreShip.droneSpawnTimer += delta;
      if (this.coreShip.droneSpawnTimer >= this.coreShip.droneSpawnRate) {
        this.coreShip.droneSpawnTimer = 0;
        // Spawn a drone near the core ship
        const angle = Math.random() * TWO_PI;
        const spawnDist = this.coreShip.radius + 15;
        const droneX = this.coreShip.x + Math.cos(angle) * spawnDist;
        const droneY = this.coreShip.y + Math.sin(angle) * spawnDist;
        this.drones.push({
          x: droneX,
          y: droneY,
          vx: 0,
          vy: 0,
          radius: 4,
          health: this.coreShip.droneHealth,
          maxHealth: this.coreShip.droneHealth,
          attack: this.coreShip.droneDamage,
          attackSpeed: 1.5,
          cooldown: 0,
          moveSpeed: 80,
          range: 120,
        });
      }
    }
    
    // Update drones
    this.updateDrones(delta);
    
    if (this.coreShip.health <= 0) {
      return;
    }
    if (this.coreShip.cannons <= 0) {
      return;
    }
    this.coreShip.cannonCooldown = Math.max(0, this.coreShip.cannonCooldown - delta);
    if (this.coreShip.cannonCooldown > 0) {
      return;
    }
    const target = this.findClosestTurret(
      this.coreShip.x,
      this.coreShip.y,
      KUF_CORE_SHIP_COMBAT.CANNON_RANGE
    );
    if (!target) {
      return;
    }
    const totalCannons = this.coreShip.cannons;
    const spread = KUF_CORE_SHIP_COMBAT.CANNON_SPREAD_RADIANS;
    for (let i = 0; i < totalCannons; i++) {
      const lerp = totalCannons > 1 ? (i / (totalCannons - 1)) - 0.5 : 0;
      const angleOffset = spread * lerp;
      const heading = Math.atan2(target.y - this.coreShip.y, target.x - this.coreShip.x) + angleOffset;
      // Core ship cannon fire behaves like turret shots, but scales with cannon count.
      this.spawnBullet({
        owner: 'coreShip',
        type: 'coreShip',
        x: this.coreShip.x,
        y: this.coreShip.y,
        target,
        speed: KUF_CORE_SHIP_COMBAT.CANNON_PROJECTILE_SPEED,
        damage: KUF_CORE_SHIP_COMBAT.CANNON_DAMAGE,
        angle: heading,
      });
    }
    this.coreShip.cannonCooldown = 1 / KUF_CORE_SHIP_COMBAT.CANNON_ATTACK_SPEED;
  }
  
  /**
   * Update drone AI and combat behavior.
   * @param {number} delta - Delta time in seconds.
   */
  updateDrones(delta) {
    this.drones.forEach((drone) => {
      drone.cooldown = Math.max(0, drone.cooldown - delta);
      
      // Find closest enemy
      const target = this.findClosestTurret(drone.x, drone.y, Infinity);
      if (!target) {
        return;
      }
      
      const dx = target.x - drone.x;
      const dy = target.y - drone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > drone.range) {
        // Move toward enemy
        const moveX = (dx / dist) * drone.moveSpeed * delta;
        const moveY = (dy / dist) * drone.moveSpeed * delta;
        drone.x += moveX;
        drone.y += moveY;
      } else {
        // In range - attack
        if (drone.cooldown <= 0) {
          this.spawnBullet({
            owner: 'marine',
            type: 'drone',
            x: drone.x,
            y: drone.y,
            target,
            speed: MARINE_BULLET_SPEED,
            damage: drone.attack,
          });
          drone.cooldown = 1 / drone.attackSpeed;
        }
      }
    });
    
    // Remove dead drones
    this.drones = this.drones.filter((drone) => drone.health > 0);
  }

  updateTurrets(delta) {
    this.turrets.forEach((turret) => {
      turret.cooldown = Math.max(0, turret.cooldown - delta);
      if (turret.fieldPulse !== undefined) {
        turret.fieldPulse = (turret.fieldPulse + delta) % 1.5;
      }
      if (turret.healVisualTimer !== undefined) {
        turret.healVisualTimer = Math.max(0, turret.healVisualTimer - delta);
      }

      // Handle barracks spawning
      if (turret.isBarracks) {
        turret.spawnTimer -= delta;
        if (turret.spawnTimer <= 0 && turret.currentSpawns < turret.maxSpawns) {
          // Check if barracks is under attack or if any player targets are nearby.
          const isUnderAttack = turret.health < turret.maxHealth;
          const nearbyPlayerTarget = this.findClosestPlayerTarget(
            turret.x,
            turret.y,
            isUnderAttack ? Infinity : turret.spawnRange
          );
          if (nearbyPlayerTarget) {
            // Spawn a unit near the barracks
            const angle = Math.random() * TWO_PI;
            const dist = turret.radius + 10;
            const spawnX = turret.x + Math.cos(angle) * dist;
            const spawnY = turret.y + Math.sin(angle) * dist;
            this.createEnemy(turret.spawnType, spawnX, spawnY, turret.level);
            turret.currentSpawns++;
            turret.spawnTimer = turret.spawnCooldown;
          }
        }
        return;
      }

      if (turret.isSupport) {
        this.handleSupportDrone(turret, delta);
        return;
      }

      // Handle mobile units - always pursue the closest player-controlled target.
      if (turret.isMobile) {
        const nearbyPlayerTarget = this.findClosestPlayerTarget(turret.x, turret.y, Infinity);
        if (nearbyPlayerTarget) {
          // Move toward the marine if out of attack range
          const dx = nearbyPlayerTarget.x - turret.x;
          const dy = nearbyPlayerTarget.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > turret.range) {
            // Move toward marine
            const moveX = (dx / dist) * turret.moveSpeed * delta;
            const moveY = (dy / dist) * turret.moveSpeed * delta;
            turret.x += moveX;
            turret.y += moveY;
          } else {
            // In range - attack
            if (turret.cooldown <= 0 && turret.attack > 0) {
              this.fireTurret(turret, nearbyPlayerTarget);
            }
          }
        }
        return;
      }

      // Handle stationary turrets
      if (turret.attack > 0 && !turret.isWall && !turret.isMine) {
        const target = this.findClosestPlayerTarget(turret.x, turret.y, turret.range);
        if (target && turret.cooldown <= 0) {
          this.fireTurret(turret, target);
        }
      }
    });

    // Remove dead enemies, but check for mine explosions first
    this.turrets = this.turrets.filter((turret) => {
      if (turret.health <= 0) {
        // Trigger mine explosion
        if (turret.isMine) {
          this.triggerMineExplosion(turret);
        }
        return false;
      }
      return true;
    });
  }

  triggerMineExplosion(mine) {
    // Damage all units (both player and enemy) within explosion radius
    const explosionRadius = mine.explosionRadius || MINE_EXPLOSION_RADIUS;
    
    // Damage marines
    this.marines.forEach((marine) => {
      const dx = marine.x - mine.x;
      const dy = marine.y - mine.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= explosionRadius) {
        marine.health -= mine.attack * mine.level;
      }
    });

    // Damage enemies
    this.turrets.forEach((turret) => {
      const dx = turret.x - mine.x;
      const dy = turret.y - mine.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= explosionRadius) {
        turret.health -= mine.attack * mine.level;
      }
    });

    // Add visual explosion effect
    this.explosions.push({
      x: mine.x,
      y: mine.y,
      radius: 0,
      maxRadius: explosionRadius,
      life: 0.5,
      maxLife: 0.5,
    });
  }

  updateExplosions(delta) {
    this.explosions.forEach((explosion) => {
      explosion.life -= delta;
      const progress = 1 - (explosion.life / explosion.maxLife);
      explosion.radius = explosion.maxRadius * progress;
    });
    this.explosions = this.explosions.filter((explosion) => explosion.life > 0);
  }

  updateBullets(delta) {
    this.bullets.forEach((bullet) => {
      // Heat-seeking logic for splayer rockets
      if (bullet.homing && bullet.target && bullet.target.health > 0) {
        const dx = bullet.target.x - bullet.x;
        const dy = bullet.target.y - bullet.y;
        const angle = Math.atan2(dy, dx);
        const turnRate = 3.0; // Radians per second
        const currentAngle = Math.atan2(bullet.vy, bullet.vx);
        let angleDiff = angle - currentAngle;
        
        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= TWO_PI;
        while (angleDiff < -Math.PI) angleDiff += TWO_PI;
        
        const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * delta);
        const newAngle = currentAngle + turnAmount;
        
        bullet.vx = Math.cos(newAngle) * bullet.speed;
        bullet.vy = Math.sin(newAngle) * bullet.speed;
      }
      
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;
      
      if (bullet.owner === 'marine' || bullet.owner === 'coreShip') {
        const hit = this.findHit(this.turrets, bullet);
        if (hit && hit.health > 0) {
          hit.health -= bullet.damage;
          // Track the hit so piercing rounds do not repeatedly strike the same target.
          if (bullet.hitTargets) {
            bullet.hitTargets.add(hit);
          }
          // Remove non-piercing bullets immediately, otherwise decrement remaining pierces.
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
            if (bullet.pierce <= 0) {
              bullet.life = 0;
            }
          } else {
            bullet.life = 0;
          }
          if (hit.health <= 0) {
            // Base reward from enemy's configured value, plus income per kill bonus (1 + workers).
            const enemyGoldValue = typeof hit.goldValue === 'number' ? hit.goldValue : 5;
            const reward = enemyGoldValue + this.baseIncomePerKill;
            this.goldEarned += reward;
            this.destroyedTurrets += 1;
          }
        }
      } else {
        const hit = this.findHit(this.marines, bullet);
        if (hit && hit.health > 0) {
          hit.health -= bullet.damage;
          if (bullet.effects) {
            this.applyBulletEffects(hit, bullet.effects);
          }
          bullet.life = 0;
        } else {
          // Check for drone hits
          const droneHit = this.findHit(this.drones, bullet);
          if (droneHit && droneHit.health > 0) {
            droneHit.health -= bullet.damage;
            bullet.life = 0;
          } else if (this.coreShip && this.coreShip.health > 0) {
            // Allow enemy projectiles to damage the core ship hull when marines are absent.
            const dx = this.coreShip.x - bullet.x;
            const dy = this.coreShip.y - bullet.y;
            const radius = this.coreShip.radius || MARINE_RADIUS;
            if (dx * dx + dy * dy <= radius * radius) {
              // Check for shield first
              if (this.coreShip.shield > 0 && !this.coreShip.shieldBroken) {
                this.coreShip.shield -= bullet.damage;
                if (this.coreShip.shield <= 0) {
                  this.coreShip.shield = 0;
                  this.coreShip.shieldBroken = true;
                  this.coreShip.shieldRegenTimer = 0;
                }
              } else {
                this.coreShip.health -= bullet.damage;
              }
              // Reset shield regen timer on hit
              this.coreShip.shieldRegenTimer = 0;
              bullet.life = 0;
            }
          }
        }
      }
    });
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0 && this.isOnscreen(bullet));
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  spawnBullet({ owner, type, x, y, target, speed, damage, homing = false, angle = null, effects = null, pierce = 0 }) {
    const heading = angle !== null ? angle : Math.atan2(target.y - y, target.x - x);
    const vx = Math.cos(heading) * speed;
    const vy = Math.sin(heading) * speed;
    // Initialize hit tracking when bullets are allowed to pierce through multiple targets.
    const hitTargets = pierce > 0 ? new Set() : null;
    this.bullets.push({
      owner,
      type: type || 'marine',
      x,
      y,
      vx,
      vy,
      damage,
      life: 2.5,
      homing,
      target: homing ? target : null,
      speed,
      effects,
      // Store remaining pierce count so lasers can keep traveling after impacts.
      pierce,
      hitTargets,
    });
  }

  fireTurret(turret, target) {
    const modifiers = this.getTurretAttackModifier(turret);
    const projectileSpeed = turret.projectileSpeed || TURRET_BULLET_SPEED;
    const damagePerShot = turret.attack * modifiers.damageMultiplier;
    const attackSpeed = Math.max(0.1, turret.attackSpeed * modifiers.attackSpeedMultiplier);
    const shots = turret.multiShot || 1;
    const spread = turret.spreadAngle || 0;
    const baseAngle = Math.atan2(target.y - turret.y, target.x - turret.x);

    for (let i = 0; i < shots; i++) {
      const lerp = shots > 1 ? (i / (shots - 1)) - 0.5 : 0;
      const angleOffset = spread * lerp;
      this.spawnBullet({
        owner: 'turret',
        type: turret.type,
        x: turret.x,
        y: turret.y + (turret.radius || 0),
        target,
        speed: projectileSpeed,
        damage: damagePerShot,
        angle: baseAngle + angleOffset,
        effects: turret.projectileEffects || null,
      });
    }

    turret.cooldown = 1 / attackSpeed;
  }

  getTurretAttackModifier(turret) {
    let attackSpeedMultiplier = 1;
    let damageMultiplier = 1;
    this.turrets.forEach((node) => {
      if (node === turret || !node.isBuffNode) {
        return;
      }
      const dx = node.x - turret.x;
      const dy = node.y - turret.y;
      const distanceSq = dx * dx + dy * dy;
      const radius = node.buffRadius || 0;
      if (radius > 0 && distanceSq <= radius * radius) {
        if (node.attackSpeedMultiplier) {
          attackSpeedMultiplier *= node.attackSpeedMultiplier;
        }
        if (node.damageMultiplier) {
          damageMultiplier *= node.damageMultiplier;
        }
      }
    });
    return { attackSpeedMultiplier, damageMultiplier };
  }

  handleSupportDrone(drone, delta) {
    const target = this.findDamagedTurret(drone.x, drone.y, drone.sightRange, drone);
    if (!target) {
      return;
    }

    const dx = target.x - drone.x;
    const dy = target.y - drone.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    if (distance > (drone.healRange || 80)) {
      const moveX = (dx / distance) * drone.moveSpeed * delta;
      const moveY = (dy / distance) * drone.moveSpeed * delta;
      drone.x += moveX;
      drone.y += moveY;
      drone.activeHealTarget = null;
    } else {
      const healAmount = (drone.healPerSecond || 4) * delta;
      target.health = Math.min(target.maxHealth, target.health + healAmount);
      drone.healVisualTimer = 0.25;
      drone.activeHealTarget = { x: target.x, y: target.y };
    }
  }

  findDamagedTurret(x, y, range, exclude) {
    let closest = null;
    let bestDist = range * range;
    this.turrets.forEach((turret) => {
      if (turret === exclude || turret.health >= turret.maxHealth) {
        return;
      }
      const dx = turret.x - x;
      const dy = turret.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDist) {
        closest = turret;
        bestDist = distSq;
      }
    });
    return closest;
  }

  applyBulletEffects(target, effects) {
    if (!effects) {
      return;
    }
    if (!target.statusEffects) {
      target.statusEffects = [];
    }
    if (effects.type === 'burn') {
      target.statusEffects.push({
        type: 'burn',
        damagePerSecond: effects.damagePerSecond || 1,
        remaining: effects.duration || 2,
      });
    }
    if (effects.type === 'slow') {
      target.statusEffects.push({
        type: 'slow',
        multiplier: Math.max(0.1, effects.multiplier || 0.5),
        remaining: effects.duration || 2,
      });
    }
  }

  updateMarineStatus(marine, delta) {
    if (!marine.statusEffects) {
      marine.statusEffects = [];
    }
    const remainingEffects = [];
    let slowMultiplier = 1;

    marine.statusEffects.forEach((effect) => {
      effect.remaining -= delta;
      if (effect.type === 'burn') {
        marine.health -= (effect.damagePerSecond || 0) * delta;
      }
      if (effect.type === 'slow') {
        slowMultiplier *= Math.max(0.1, effect.multiplier || 1);
      }
      if (effect.remaining > 0) {
        remainingEffects.push(effect);
      }
    });

    marine.statusEffects = remainingEffects;

    const fieldMultiplier = this.getFieldSlowMultiplier(marine);
    const combinedMultiplier = Math.max(0.2, slowMultiplier * fieldMultiplier);
    marine.moveSpeed = marine.baseMoveSpeed * combinedMultiplier;
  }

  getFieldSlowMultiplier(marine) {
    let multiplier = 1;
    this.turrets.forEach((turret) => {
      if (!turret.isStasisField) {
        return;
      }
      const dx = turret.x - marine.x;
      const dy = turret.y - marine.y;
      const radius = turret.slowRadius || 0;
      if (radius <= 0) {
        return;
      }
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= radius * radius) {
        multiplier *= 1 - Math.min(0.9, turret.slowAmount || 0.3);
      }
    });
    return Math.max(0.2, multiplier);
  }

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

  findClosestTurret(x, y, range) {
    // If there's a selected enemy and it's in range, prioritize it
    if (this.selectedEnemy && this.selectedEnemy.health > 0) {
      const dx = this.selectedEnemy.x - x;
      const dy = this.selectedEnemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= range * range) {
        return this.selectedEnemy;
      }
    }

    let closest = null;
    let bestDist = range * range;
    this.turrets.forEach((turret) => {
      const dx = turret.x - x;
      const dy = turret.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDist) {
        closest = turret;
        bestDist = distSq;
      }
    });
    return closest;
  }

  findClosestMarine(x, y, range) {
    let closest = null;
    let bestDist = range * range;
    this.marines.forEach((marine) => {
      const dx = marine.x - x;
      const dy = marine.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDist) {
        closest = marine;
        bestDist = distSq;
      }
    });
    return closest;
  }

  /**
   * Find the closest player-controlled target, including marines, drones, and the core ship hull.
   * @param {number} x - X coordinate in world space.
   * @param {number} y - Y coordinate in world space.
   * @param {number} range - Targeting range in pixels.
   * @returns {object|null} Closest target in range.
   */
  findClosestPlayerTarget(x, y, range) {
    let closest = this.findClosestMarine(x, y, range);
    let bestDist = closest ? ((closest.x - x) ** 2 + (closest.y - y) ** 2) : range * range;
    
    // Check drones
    this.drones.forEach((drone) => {
      const dx = drone.x - x;
      const dy = drone.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDist) {
        closest = drone;
        bestDist = distSq;
      }
    });
    
    // Check core ship
    if (this.coreShip && this.coreShip.health > 0) {
      const dx = this.coreShip.x - x;
      const dy = this.coreShip.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDist) {
        closest = this.coreShip;
        bestDist = distSq;
      }
    }
    return closest;
  }

  findHit(targets, bullet) {
    return targets.find((target) => {
      if (bullet.hitTargets && bullet.hitTargets.has(target)) {
        return false;
      }
      const dx = target.x - bullet.x;
      const dy = target.y - bullet.y;
      const radius = target.radius || MARINE_RADIUS;
      return dx * dx + dy * dy <= radius * radius;
    }) || null;
  }

  isOnscreen(bullet) {
    // Use a larger margin in world space to prevent bullets from disappearing prematurely.
    // Account for camera movement by using the visible area in world coordinates.
    const viewLeft = this.camera.x - BULLET_CULLING_MARGIN;
    const viewRight = this.camera.x + this.bounds.width / this.camera.zoom + BULLET_CULLING_MARGIN;
    const viewTop = this.camera.y - BULLET_CULLING_MARGIN;
    const viewBottom = this.camera.y + this.bounds.height / this.camera.zoom + BULLET_CULLING_MARGIN;
    return (
      bullet.x > viewLeft &&
      bullet.x < viewRight &&
      bullet.y > viewTop &&
      bullet.y < viewBottom
    );
  }

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
