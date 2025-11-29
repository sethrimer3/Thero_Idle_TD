import { getCachedKufMaps, onKufMapsReady } from './kufMapData.js';
import { isLowGraphicsModeActive } from './preferences.js';

// Default map identifier used when the external dataset is unavailable.
const KUF_FALLBACK_MAP_ID = 'forward-bastion';
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


const MARINE_MOVE_SPEED = 70; // Pixels per second.
const MARINE_ACCELERATION = 120; // Pixels per second squared.
const MARINE_RANGE = 160; // Attack range in pixels.
const MARINE_RADIUS = 3.6; // 20% of original 18
const SNIPER_RADIUS = 3.2; // 20% of original 16
const SNIPER_RANGE = 280;
const SPLAYER_RADIUS = 4; // 20% of original 20
const SPLAYER_RANGE = 200;
const TURRET_RADIUS = 2.4; // 20% of original 12
const TURRET_RANGE = 200;
const BIG_TURRET_RADIUS = 4.8; // 2x turret size
const BIG_TURRET_RANGE = 250;
const MELEE_UNIT_RADIUS = 3.2;
const MELEE_UNIT_RANGE = 20;
const MELEE_UNIT_SIGHT_RANGE = 150;
const MELEE_UNIT_SPEED = 60;
const RANGED_UNIT_RADIUS = 3.0;
const RANGED_UNIT_RANGE = 120;
const RANGED_UNIT_SIGHT_RANGE = 180;
const RANGED_UNIT_SPEED = 50;
const BARRACKS_RADIUS = 6;
const MINE_RADIUS = 2;
const MINE_EXPLOSION_RADIUS = 60;
const WALL_RADIUS = 8;
const MARINE_BULLET_SPEED = 360;
const SNIPER_BULLET_SPEED = 500;
const SPLAYER_ROCKET_SPEED = 200;
const TURRET_BULLET_SPEED = 280;
const PLASMA_BULLET_SPEED = 260;
const TRAIL_ALPHA = 0.22;
const LOW_TRAIL_ALPHA = 0.14; // Softer fade for lightweight rendering while preserving trails.
const HIGH_QUALITY_FRAME_BUDGET_MS = 18; // Target frame cost before we start trimming glow work.
const FRAME_COST_SMOOTHING = 0.08; // Exponential smoothing factor for frame time measurements.
const CAMERA_PAN_SPEED = 1.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const SPAWN_AREA_MARGIN = 24; // Margin in pixels from canvas edge for spawn area.
const BULLET_CULLING_MARGIN = 400; // World-space margin for keeping bullets alive during camera movement.

// Grid system: 1 grid unit = 5 * marine diameter = 5 * (2 * MARINE_RADIUS) = 36 pixels
const GRID_UNIT = 5 * (2 * MARINE_RADIUS); // 36 pixels

/**
 * @typedef {Object} KufSimulationConfig
 * @property {{ health: number, attack: number, attackSpeed: number }} marineStats - Calculated statline.
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
    this.bounds = { width: this.canvas?.width || 640, height: this.canvas?.height || 360 };
    this.pixelRatio = 1;
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.cameraDrag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };
    this.selectedEnemy = null;
    // Track runtime rendering profile so we can gracefully downshift on slower devices without losing glow aesthetics.
    this.renderProfile = isLowGraphicsModeActive() ? 'light' : 'high';
    this.smoothedFrameCost = 12;
    this.overlaySkipInterval = this.renderProfile === 'light' ? 2 : 1;
    this.overlaySkipCounter = 0;
    this.userRenderMode = 'auto';
    this.glowOverlaysEnabled = true;
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
    const dpr = window.devicePixelRatio || 1;
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
  }

  handleMouseDown(e) {
    this.cameraDrag.active = true;
    this.cameraDrag.startX = e.clientX;
    this.cameraDrag.startY = e.clientY;
    this.cameraDrag.camStartX = this.camera.x;
    this.cameraDrag.camStartY = this.camera.y;
    this.canvas.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    if (!this.cameraDrag.active) {
      return;
    }
    const dx = (e.clientX - this.cameraDrag.startX) * CAMERA_PAN_SPEED;
    const dy = (e.clientY - this.cameraDrag.startY) * CAMERA_PAN_SPEED;
    this.camera.x = this.cameraDrag.camStartX - dx / this.camera.zoom;
    this.camera.y = this.cameraDrag.camStartY - dy / this.camera.zoom;
  }

  handleMouseUp() {
    this.cameraDrag.active = false;
    this.canvas.style.cursor = 'grab';
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.zoom * zoomDelta));
  }

  handleClick(e) {
    // Convert canvas coordinates to world coordinates
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Account for camera transform
    const worldX = (canvasX - this.bounds.width / 2) / this.camera.zoom + this.bounds.width / 2 + this.camera.x;
    const worldY = (canvasY - this.bounds.height / 2) / this.camera.zoom + this.bounds.height / 2 + this.camera.y;
    
    // Check if clicked on any enemy
    let clickedEnemy = null;
    for (const turret of this.turrets) {
      const dx = turret.x - worldX;
      const dy = turret.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= turret.radius) {
        clickedEnemy = turret;
        break;
      }
    }
    
    this.selectedEnemy = clickedEnemy;
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
   * Begin a new simulation with the provided marine stats and unit counts.
   * @param {KufSimulationConfig} config - Simulation setup payload.
   */
  start(config) {
    if (!this.ctx) {
      return;
    }
    this.reset();
    const marineStats = config?.marineStats || { health: 10, attack: 1, attackSpeed: 1 };
    const sniperStats = config?.sniperStats || { health: 8, attack: 2, attackSpeed: 0.5 };
    const splayerStats = config?.splayerStats || { health: 12, attack: 0.8, attackSpeed: 0.7 };
    const units = config?.units || { marines: 1, snipers: 0, splayers: 0 };
    const requestedMap = config?.mapId || this.defaultMapId;
    this.setActiveMap(requestedMap);
    // Reset overlay pacing so each run begins with full HUD fidelity before auto-throttling.
    this.overlaySkipCounter = 0;

    // Player units spawn randomly within the bottom half of the render area.
    const spawnYMin = this.bounds.height / 2;
    const spawnYMax = this.bounds.height - SPAWN_AREA_MARGIN;
    const spawnXMin = SPAWN_AREA_MARGIN;
    const spawnXMax = this.bounds.width - SPAWN_AREA_MARGIN;
    
    // Spawn all purchased marines at random positions in bottom half.
    for (let i = 0; i < units.marines; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.marines.push({
        type: 'marine',
        x: randomX,
        y: randomY,
        vx: 0,
        vy: 0,
        radius: MARINE_RADIUS,
        health: marineStats.health,
        maxHealth: marineStats.health,
        attack: marineStats.attack,
        attackSpeed: Math.max(0.1, marineStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        baseMoveSpeed: MARINE_MOVE_SPEED,
        moveSpeed: MARINE_MOVE_SPEED,
        range: MARINE_RANGE,
        statusEffects: [],
      });
    }
    
    // Spawn all purchased snipers at random positions in bottom half.
    for (let i = 0; i < units.snipers; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.marines.push({
        type: 'sniper',
        x: randomX,
        y: randomY,
        vx: 0,
        vy: 0,
        radius: SNIPER_RADIUS,
        health: sniperStats.health,
        maxHealth: sniperStats.health,
        attack: sniperStats.attack,
        attackSpeed: Math.max(0.1, sniperStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        baseMoveSpeed: MARINE_MOVE_SPEED * 0.8,
        moveSpeed: MARINE_MOVE_SPEED * 0.8,
        range: SNIPER_RANGE,
        statusEffects: [],
      });
    }
    
    // Spawn all purchased splayers at random positions in bottom half.
    for (let i = 0; i < units.splayers; i++) {
      const randomX = spawnXMin + Math.random() * (spawnXMax - spawnXMin);
      const randomY = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      this.marines.push({
        type: 'splayer',
        x: randomX,
        y: randomY,
        vx: 0,
        vy: 0,
        radius: SPLAYER_RADIUS,
        health: splayerStats.health,
        maxHealth: splayerStats.health,
        attack: splayerStats.attack,
        attackSpeed: Math.max(0.1, splayerStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        baseMoveSpeed: MARINE_MOVE_SPEED * 0.9,
        moveSpeed: MARINE_MOVE_SPEED * 0.9,
        range: SPLAYER_RANGE,
        statusEffects: [],
      });
    }
    
    this.buildTurrets();
    this.attachCameraControls();
    this.canvas.style.cursor = 'grab';
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.active = true;
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
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
   * Resume a paused simulation without resetting game state.
   * Used when returning to the Kuf tab after the simulation was paused.
   */
  resume() {
    if (this.active) {
      return; // Already running
    }
    // Only resume if there's an active battle in progress (marines exist)
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
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
    this.selectedEnemy = null;
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
    switch (type) {
      case 'small_turret':
        return {
          radius: TURRET_RADIUS,
          health: 5,
          attack: 1,
          attackSpeed: 1,
          range: TURRET_RANGE,
          goldValue: 6,
          extra: {},
        };
      case 'big_turret':
        return {
          radius: BIG_TURRET_RADIUS,
          health: 20,
          attack: 3,
          attackSpeed: 0.8,
          range: BIG_TURRET_RANGE,
          goldValue: 12,
          extra: {},
        };
      case 'laser_turret':
        return {
          radius: TURRET_RADIUS,
          health: 8,
          attack: 1.8,
          attackSpeed: 1.6,
          range: TURRET_RANGE * 1.1,
          goldValue: 8,
          extra: {},
        };
      case 'wall':
        return {
          radius: WALL_RADIUS,
          health: 50,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 4,
          extra: { isWall: true },
        };
      case 'mine':
        return {
          radius: MINE_RADIUS,
          health: 1,
          attack: 5,
          attackSpeed: 0,
          range: 0,
          goldValue: 5,
          extra: { isMine: true, explosionRadius: MINE_EXPLOSION_RADIUS },
        };
      case 'melee_unit':
        return {
          radius: MELEE_UNIT_RADIUS,
          health: 8,
          attack: 2,
          attackSpeed: 1.2,
          range: MELEE_UNIT_RANGE,
          goldValue: 7,
          extra: {
            isMobile: true,
            moveSpeed: MELEE_UNIT_SPEED,
            sightRange: MELEE_UNIT_SIGHT_RANGE,
          },
        };
      case 'ranged_unit':
        return {
          radius: RANGED_UNIT_RADIUS,
          health: 6,
          attack: 1.5,
          attackSpeed: 0.8,
          range: RANGED_UNIT_RANGE,
          goldValue: 8,
          extra: {
            isMobile: true,
            moveSpeed: RANGED_UNIT_SPEED,
            sightRange: RANGED_UNIT_SIGHT_RANGE,
          },
        };
      case 'melee_barracks':
        return {
          radius: BARRACKS_RADIUS,
          health: 30,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 10,
          extra: {
            isBarracks: true,
            spawnType: 'melee_unit',
            spawnRange: 150,
            spawnCooldown: 5,
            spawnTimer: 0,
            maxSpawns: 3,
            currentSpawns: 0,
          },
        };
      case 'ranged_barracks':
        return {
          radius: BARRACKS_RADIUS,
          health: 30,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 10,
          extra: {
            isBarracks: true,
            spawnType: 'ranged_unit',
            spawnRange: 150,
            spawnCooldown: 5,
            spawnTimer: 0,
            maxSpawns: 3,
            currentSpawns: 0,
          },
        };
      case 'rocket_turret':
        return {
          radius: BIG_TURRET_RADIUS * 0.9,
          health: 16,
          attack: 2.5,
          attackSpeed: 1.1,
          range: BIG_TURRET_RANGE * 1.1,
          goldValue: 11,
          extra: {},
        };
      case 'artillery_turret':
        return {
          radius: BIG_TURRET_RADIUS,
          health: 24,
          attack: 3.5,
          attackSpeed: 0.7,
          range: BIG_TURRET_RANGE * 1.35,
          goldValue: 14,
          extra: {},
        };
      case 'plasma_turret':
        return {
          radius: TURRET_RADIUS,
          health: 10,
          attack: 1.4,
          attackSpeed: 1.4,
          range: TURRET_RANGE * 1.05,
          goldValue: 10,
          extra: {
            projectileSpeed: PLASMA_BULLET_SPEED,
            projectileEffects: {
              type: 'burn',
              damagePerSecond: 2.5,
              duration: 4,
            },
          },
        };
      case 'scatter_turret':
        return {
          radius: BIG_TURRET_RADIUS * 0.85,
          health: 18,
          attack: 1.8,
          attackSpeed: 1.3,
          range: BIG_TURRET_RANGE,
          goldValue: 13,
          extra: {
            multiShot: 3,
            spreadAngle: 18 * (Math.PI / 180),
          },
        };
      case 'support_drone':
        return {
          radius: RANGED_UNIT_RADIUS,
          health: 6,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 9,
          extra: {
            isMobile: true,
            isSupport: true,
            moveSpeed: 85,
            sightRange: 260,
            healRange: 80,
            healPerSecond: 6,
            healVisualTimer: 0,
          },
        };
      case 'stasis_obelisk':
        return {
          radius: BIG_TURRET_RADIUS,
          health: 28,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 11,
          extra: {
            isStructure: true,
            isStasisField: true,
            slowAmount: 0.35,
            slowRadius: 220,
            fieldPulse: 0,
          },
        };
      case 'relay_pylon':
        return {
          radius: BIG_TURRET_RADIUS * 0.75,
          health: 30,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 12,
          extra: {
            isStructure: true,
            isBuffNode: true,
            buffRadius: 240,
            attackSpeedMultiplier: 1.25,
            damageMultiplier: 1.15,
          },
        };
      case 'shield_generator':
        return {
          radius: BIG_TURRET_RADIUS,
          health: 40,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 9,
          extra: { isStructure: true },
        };
      case 'supply_cache':
        return {
          radius: BIG_TURRET_RADIUS * 0.8,
          health: 35,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 12,
          extra: { isStructure: true },
        };
      case 'signal_beacon':
        return {
          radius: BIG_TURRET_RADIUS * 0.7,
          health: 28,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          goldValue: 10,
          extra: { isStructure: true },
        };
      default:
        return null;
    }
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
    const forceLightProfile = this.userRenderMode === 'minimal' || isLowGraphicsModeActive();
    if (forceLightProfile) {
      // Honor explicit performance mode and the global low graphics preference.
      this.renderProfile = 'light';
      this.overlaySkipInterval = 2;
      return;
    }
    if (this.userRenderMode === 'cinematic') {
      this.renderProfile = 'high';
      this.overlaySkipInterval = 1;
      return;
    }
    this.smoothedFrameCost = (1 - FRAME_COST_SMOOTHING) * this.smoothedFrameCost + FRAME_COST_SMOOTHING * frameCostMs;
    const shouldDownshift = this.smoothedFrameCost > HIGH_QUALITY_FRAME_BUDGET_MS;
    this.renderProfile = shouldDownshift ? 'light' : 'high';
    this.overlaySkipInterval = shouldDownshift ? 2 : 1;
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
    this.updateMarines(delta);
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
    this.marines.forEach((marine) => {
      this.updateMarineStatus(marine, delta);
      if (marine.health <= 0) {
        return;
      }
      marine.cooldown = Math.max(0, marine.cooldown - delta);
      const target = this.findClosestTurret(marine.x, marine.y, marine.range);
      
      // Stop and fire if enemy in range, otherwise move forward
      if (target) {
        // Decelerate to a stop
        const deceleration = MARINE_ACCELERATION * delta;
        if (Math.abs(marine.vy) > deceleration) {
          marine.vy += marine.vy > 0 ? -deceleration : deceleration;
        } else {
          marine.vy = 0;
        }
        
        // Fire at target
        if (marine.cooldown <= 0) {
          this.spawnBullet({
            owner: 'marine',
            type: marine.type,
            x: marine.x,
            y: marine.y - marine.radius,
            target,
            speed: marine.type === 'sniper' ? SNIPER_BULLET_SPEED : 
                   marine.type === 'splayer' ? SPLAYER_ROCKET_SPEED : MARINE_BULLET_SPEED,
            damage: marine.attack,
            homing: marine.type === 'splayer',
          });
          
          // Splayer fires multiple rockets
          if (marine.type === 'splayer') {
            for (let i = 0; i < 5; i++) {
              setTimeout(() => {
                if (marine.health > 0) {
                  const currentTarget = this.findClosestTurret(marine.x, marine.y, marine.range);
                  if (currentTarget) {
                    this.spawnBullet({
                      owner: 'marine',
                      type: 'splayer',
                      x: marine.x + (Math.random() - 0.5) * 10,
                      y: marine.y - marine.radius,
                      target: currentTarget,
                      speed: SPLAYER_ROCKET_SPEED,
                      damage: marine.attack * 0.2,
                      homing: true,
                    });
                  }
                }
              }, i * 50);
            }
          }
          
          marine.cooldown = 1 / marine.attackSpeed;
        }
      } else {
        // Accelerate forward (negative y is up)
        const targetVy = -marine.moveSpeed;
        const acceleration = MARINE_ACCELERATION * delta;
        if (marine.vy > targetVy) {
          marine.vy = Math.max(targetVy, marine.vy - acceleration);
        } else if (marine.vy < targetVy) {
          marine.vy = Math.min(targetVy, marine.vy + acceleration);
        }
      }
      
      // Apply velocity
      marine.y += marine.vy * delta;
    });
    this.marines = this.marines.filter((marine) => marine.health > 0 && marine.y + marine.radius > -40);
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
          // Check if barracks is under attack or if any marines are nearby
          const isUnderAttack = turret.health < turret.maxHealth;
          const nearbyMarine = this.findClosestMarine(turret.x, turret.y, isUnderAttack ? Infinity : turret.spawnRange);
          if (nearbyMarine) {
            // Spawn a unit near the barracks
            const angle = Math.random() * Math.PI * 2;
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

      // Handle mobile units - always pursue closest marine
      if (turret.isMobile) {
        const nearbyMarine = this.findClosestMarine(turret.x, turret.y, Infinity);
        if (nearbyMarine) {
          // Move toward the marine if out of attack range
          const dx = nearbyMarine.x - turret.x;
          const dy = nearbyMarine.y - turret.y;
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
              this.fireTurret(turret, nearbyMarine);
            }
          }
        }
        return;
      }

      // Handle stationary turrets
      if (turret.attack > 0 && !turret.isWall && !turret.isMine) {
        const target = this.findClosestMarine(turret.x, turret.y, turret.range);
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
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * delta);
        const newAngle = currentAngle + turnAmount;
        
        bullet.vx = Math.cos(newAngle) * bullet.speed;
        bullet.vy = Math.sin(newAngle) * bullet.speed;
      }
      
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;
      
      if (bullet.owner === 'marine') {
        const hit = this.findHit(this.turrets, bullet);
        if (hit && hit.health > 0) {
          hit.health -= bullet.damage;
          bullet.life = 0;
          if (hit.health <= 0) {
            // Reward players based on the defeated enemy's configured payout.
            const reward = typeof hit.goldValue === 'number' ? hit.goldValue : 5;
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
        }
      }
    });
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0 && this.isOnscreen(bullet));
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  spawnBullet({ owner, type, x, y, target, speed, damage, homing = false, angle = null, effects = null }) {
    const heading = angle !== null ? angle : Math.atan2(target.y - y, target.x - x);
    const vx = Math.cos(heading) * speed;
    const vy = Math.sin(heading) * speed;
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

  findHit(targets, bullet) {
    return targets.find((target) => {
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
    if (this.marines.length <= 0) {
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

  drawBackground(force = false) {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    // Always fully clear the canvas for smooth rendering without trails or "exposure rate" effects.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#050715';
    ctx.fillRect(0, 0, this.bounds.width, this.bounds.height);
    if (force) {
      this.drawTrianglePattern();
    }
    ctx.restore();
  }

  drawTrianglePattern() {
    const ctx = this.ctx;
    const size = 90;
    for (let y = -size; y < this.bounds.height + size; y += size) {
      for (let x = -size; x < this.bounds.width + size; x += size) {
        ctx.fillStyle = y % (size * 2) === 0 ? 'rgba(20, 30, 70, 0.35)' : 'rgba(10, 15, 40, 0.4)';
        ctx.beginPath();
        ctx.moveTo(x, y + size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x + size / 2, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  render() {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    this.drawBackground();
    
    // Apply camera transform for game objects
    ctx.save();
    ctx.translate(this.bounds.width / 2, this.bounds.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.bounds.width / 2 - this.camera.x, -this.bounds.height / 2 - this.camera.y);

    this.drawTurrets();
    this.drawMarines();
    this.drawBullets();
    this.drawExplosions();
    const skipOverlays = this.shouldSkipOverlays();
    if (!skipOverlays) {
      this.drawHealthBars();
      this.drawLevelIndicators();
      this.drawSelectedEnemyBox();
    }

    ctx.restore();

    // Draw HUD without camera transform
    this.drawHud();
  }


  /**
   * Skip overlay-heavy layers intermittently when running in lightweight mode to save GPU/CPU time.
   * @returns {boolean} True when this frame should omit overlays.
   */
  shouldSkipOverlays() {
    if (this.renderProfile === 'high') {
      return false;
    }
    this.overlaySkipCounter = (this.overlaySkipCounter + 1) % this.overlaySkipInterval;
    return this.overlaySkipCounter !== 0;
  }



  drawMarines() {
    const ctx = this.ctx;
    const glowsEnabled = this.glowOverlaysEnabled;
    this.marines.forEach((marine) => {
      const healthRatio = marine.health / marine.maxHealth;
      ctx.save();
      
      // Different colors for different unit types
      let mainColor, shadowColor;
      if (marine.type === 'sniper') {
        mainColor = 'rgba(255, 200, 100, 0.9)';
        shadowColor = 'rgba(255, 180, 66, 0.8)';
      } else if (marine.type === 'splayer') {
        mainColor = 'rgba(255, 100, 200, 0.9)';
        shadowColor = 'rgba(255, 66, 180, 0.8)';
      } else {
        mainColor = 'rgba(140, 255, 255, 0.9)';
        shadowColor = 'rgba(66, 224, 255, 0.8)';
      }
      
      const marineGlow = glowsEnabled ? (this.renderProfile === 'light' ? 10 : 24) : 0;
      ctx.shadowBlur = marineGlow;
      ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(marine.x, marine.y, marine.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = this.renderProfile === 'light' ? 2 : 3;
      ctx.strokeStyle = `rgba(${80 + healthRatio * 80}, ${200 + healthRatio * 40}, 255, 0.85)`;
      ctx.stroke();
      ctx.fillStyle = 'rgba(15, 20, 40, 0.65)';
      ctx.beginPath();
      ctx.arc(marine.x, marine.y, marine.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawTurrets() {
    const ctx = this.ctx;
    const glowsEnabled = this.glowOverlaysEnabled;
    this.turrets.forEach((turret) => {
      const healthRatio = Math.max(0, turret.health / turret.maxHealth);
      ctx.save();

      if (turret.isStasisField && turret.slowRadius) {
        ctx.save();
        const gradient = ctx.createRadialGradient(
          turret.x,
          turret.y,
          turret.slowRadius * 0.1,
          turret.x,
          turret.y,
          turret.slowRadius
        );
        gradient.addColorStop(0, 'rgba(120, 200, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(20, 40, 70, 0)');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin((turret.fieldPulse || 0) * Math.PI * 2);
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, turret.slowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (turret.isBuffNode && turret.buffRadius) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 200, 120, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, turret.buffRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Different colors and styles for different enemy types
      let mainColor, shadowColor, strokeColor;

      if (turret.isWall) {
        mainColor = 'rgba(120, 120, 140, 0.9)';
        shadowColor = 'rgba(80, 80, 100, 0.8)';
        strokeColor = `rgba(${100 + healthRatio * 80}, ${100 + healthRatio * 80}, ${120 + healthRatio * 60}, 0.9)`;
      } else if (turret.isMine) {
        mainColor = 'rgba(255, 100, 50, 0.9)';
        shadowColor = 'rgba(255, 80, 30, 0.8)';
        strokeColor = 'rgba(255, 120, 80, 0.9)';
      } else if (turret.isBarracks) {
        mainColor = 'rgba(180, 100, 200, 0.7)';
        shadowColor = 'rgba(160, 80, 180, 0.8)';
        strokeColor = `rgba(${160 + healthRatio * 60}, ${100 + healthRatio * 100}, 200, 0.9)`;
      } else if (turret.isSupport) {
        mainColor = 'rgba(120, 255, 200, 0.8)';
        shadowColor = 'rgba(80, 220, 180, 0.85)';
        strokeColor = `rgba(120, ${200 + healthRatio * 40}, 210, 0.9)`;
      } else if (turret.isMobile) {
        if (turret.type === 'melee_unit') {
          mainColor = 'rgba(255, 80, 80, 0.8)';
          shadowColor = 'rgba(255, 60, 60, 0.8)';
          strokeColor = `rgba(255, ${80 + healthRatio * 120}, ${80 + healthRatio * 120}, 0.9)`;
        } else {
          mainColor = 'rgba(255, 180, 80, 0.8)';
          shadowColor = 'rgba(255, 160, 60, 0.8)';
          strokeColor = `rgba(255, ${160 + healthRatio * 60}, ${80 + healthRatio * 120}, 0.9)`;
        }
      } else if (turret.type === 'plasma_turret') {
        mainColor = 'rgba(255, 150, 80, 0.82)';
        shadowColor = 'rgba(255, 110, 50, 0.88)';
        strokeColor = `rgba(255, ${100 + healthRatio * 110}, ${80 + healthRatio * 70}, 0.9)`;
      } else if (turret.type === 'scatter_turret') {
        mainColor = 'rgba(255, 210, 140, 0.78)';
        shadowColor = 'rgba(255, 190, 120, 0.85)';
        strokeColor = `rgba(255, ${150 + healthRatio * 80}, ${120 + healthRatio * 80}, 0.92)`;
      } else if (turret.isStructure) {
        // Distinct palette for non-lethal objectives so players can recognize mandatory targets.
        mainColor = 'rgba(130, 200, 255, 0.65)';
        shadowColor = 'rgba(90, 160, 220, 0.7)';
        strokeColor = `rgba(160, ${170 + healthRatio * 60}, 255, 0.85)`;
        if (turret.isStasisField) {
          mainColor = 'rgba(140, 200, 255, 0.72)';
          shadowColor = 'rgba(110, 180, 240, 0.82)';
          strokeColor = `rgba(160, ${190 + healthRatio * 40}, 255, 0.9)`;
        }
        if (turret.isBuffNode) {
          mainColor = 'rgba(255, 200, 130, 0.78)';
          shadowColor = 'rgba(255, 170, 90, 0.85)';
          strokeColor = `rgba(255, ${190 + healthRatio * 40}, ${140 + healthRatio * 60}, 0.92)`;
        }
      } else if (turret.type === 'rocket_turret') {
        // Rocket turrets glow with a saturated magenta hue to highlight their burst damage threat.
        mainColor = 'rgba(255, 120, 200, 0.8)';
        shadowColor = 'rgba(255, 90, 180, 0.85)';
        strokeColor = `rgba(255, ${90 + healthRatio * 120}, ${180 + healthRatio * 40}, 0.9)`;
      } else if (turret.type === 'artillery_turret') {
        // Artillery cannons feel heavier through a deep amber palette.
        mainColor = 'rgba(255, 180, 120, 0.8)';
        shadowColor = 'rgba(255, 150, 90, 0.85)';
        strokeColor = `rgba(255, ${140 + healthRatio * 50}, ${100 + healthRatio * 80}, 0.9)`;
      } else if (turret.type === 'laser_turret') {
        // Laser towers shimmer with icy cyan so players can quickly read their rapid-fire style.
        mainColor = 'rgba(120, 220, 255, 0.8)';
        shadowColor = 'rgba(90, 200, 255, 0.85)';
        strokeColor = `rgba(${120 + healthRatio * 80}, ${200 + healthRatio * 40}, 255, 0.9)`;
      } else if (turret.type === 'big_turret') {
        mainColor = 'rgba(255, 100, 150, 0.8)';
        shadowColor = 'rgba(255, 80, 130, 0.8)';
        strokeColor = `rgba(255, ${60 + healthRatio * 140}, ${150 + healthRatio * 80}, 0.9)`;
      } else {
        mainColor = 'rgba(255, 150, 210, 0.7)';
        shadowColor = 'rgba(255, 110, 170, 0.8)';
        strokeColor = `rgba(255, ${80 + healthRatio * 120}, 200, 0.9)`;
      }

      const turretGlow = glowsEnabled ? (this.renderProfile === 'light' ? 10 : 18) : 0;
      ctx.shadowBlur = turretGlow;
      ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(turret.x, turret.y, turret.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = strokeColor;
      const lineWidth = this.renderProfile === 'light' ? 1.5 : turret.type === 'big_turret' ? 3 : 2;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      if (turret.healVisualTimer > 0 && turret.activeHealTarget) {
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 255, 210, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(turret.x, turret.y);
        ctx.lineTo(turret.activeHealTarget.x, turret.activeHealTarget.y);
        ctx.stroke();
        ctx.restore();
      }

      // Draw selection indicator
      if (turret === this.selectedEnemy) {
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, turret.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  drawBullets() {
    const ctx = this.ctx;
    const glowsEnabled = this.glowOverlaysEnabled;
    this.bullets.forEach((bullet) => {
      ctx.save();
      
      let color, shadowColor, size;
      if (bullet.owner === 'marine') {
        if (bullet.type === 'sniper') {
          color = 'rgba(255, 220, 120, 0.95)';
          shadowColor = 'rgba(255, 200, 80, 0.9)';
          size = 6;
        } else if (bullet.type === 'splayer') {
          color = 'rgba(255, 120, 200, 0.95)';
          shadowColor = 'rgba(255, 80, 180, 0.9)';
          size = 3;
        } else {
          color = 'rgba(120, 255, 255, 0.95)';
          shadowColor = 'rgba(120, 255, 255, 0.9)';
          size = 5;
        }
      } else {
        if (bullet.type === 'plasma_turret') {
          color = 'rgba(255, 140, 90, 0.95)';
          shadowColor = 'rgba(255, 120, 60, 0.9)';
          size = 6;
        } else if (bullet.type === 'scatter_turret') {
          color = 'rgba(255, 210, 140, 0.92)';
          shadowColor = 'rgba(255, 190, 120, 0.85)';
          size = 4;
        } else {
          color = 'rgba(255, 120, 170, 0.95)';
          shadowColor = 'rgba(255, 120, 170, 0.9)';
          size = 5;
        }
      }
      
      const bulletGlow = glowsEnabled ? (this.renderProfile === 'light' ? 8 : 16) : 0;
      ctx.shadowBlur = bulletGlow;
      ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawHealthBars() {
    const ctx = this.ctx;
    
    // Draw health bars for damaged marines
    this.marines.forEach((marine) => {
      if (marine.health < marine.maxHealth) {
        const barWidth = marine.radius * 2;
        const barHeight = 3;
        const barY = marine.y - marine.radius - 6;
        const healthRatio = marine.health / marine.maxHealth;
        
        ctx.save();
        // Background
        ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
        ctx.fillRect(marine.x - barWidth / 2, barY, barWidth, barHeight);
        // Health
        ctx.fillStyle = 'rgba(100, 255, 100, 0.9)';
        ctx.fillRect(marine.x - barWidth / 2, barY, barWidth * healthRatio, barHeight);
        ctx.restore();
      }
    });

    // Draw health bars for damaged enemies
    this.turrets.forEach((turret) => {
      if (turret.health < turret.maxHealth) {
        const barWidth = turret.radius * 2;
        const barHeight = 3;
        const barY = turret.y - turret.radius - 6;
        const healthRatio = turret.health / turret.maxHealth;
        
        ctx.save();
        // Background
        ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
        ctx.fillRect(turret.x - barWidth / 2, barY, barWidth, barHeight);
        // Health
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.fillRect(turret.x - barWidth / 2, barY, barWidth * healthRatio, barHeight);
        ctx.restore();
      }
    });
  }

  drawLevelIndicators() {
    const ctx = this.ctx;
    
    this.turrets.forEach((turret) => {
      if (turret.level > 1) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 100, 0.95)';
        ctx.font = '600 9px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const textX = turret.x + turret.radius;
        const textY = turret.y - turret.radius;
        ctx.fillText(String(turret.level), textX, textY);
        ctx.restore();
      }
    });
  }

  drawExplosions() {
    const ctx = this.ctx;
    
    this.explosions.forEach((explosion) => {
      const alpha = explosion.life / explosion.maxLife;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 150, 50, ${alpha * 0.8})`;
      ctx.fillStyle = `rgba(255, 100, 30, ${alpha * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  drawSelectedEnemyBox() {
    if (!this.selectedEnemy || this.selectedEnemy.health <= 0) {
      this.selectedEnemy = null;
      return;
    }

    const ctx = this.ctx;
    const enemy = this.selectedEnemy;
    
    ctx.save();
    
    // Draw semi-transparent box above the enemy
    const boxWidth = 120;
    const boxHeight = 60;
    const boxX = enemy.x - boxWidth / 2;
    const boxY = enemy.y - enemy.radius - boxHeight - 10;
    
    ctx.fillStyle = 'rgba(20, 20, 40, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 100, 0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Draw enemy stats
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '500 10px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const padding = 5;
    let lineY = boxY + padding;
    const lineHeight = 12;
    
    ctx.fillText(`Type: ${enemy.type}`, boxX + padding, lineY);
    lineY += lineHeight;
    ctx.fillText(`HP: ${Math.ceil(enemy.health)}/${enemy.maxHealth}`, boxX + padding, lineY);
    lineY += lineHeight;
    if (enemy.attack > 0) {
      ctx.fillText(`ATK: ${enemy.attack.toFixed(1)}`, boxX + padding, lineY);
      lineY += lineHeight;
    }
    if (enemy.level > 1) {
      ctx.fillText(`Level: ${enemy.level}`, boxX + padding, lineY);
    }
    
    ctx.restore();
  }

  drawHud() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(170, 220, 255, 0.92)';
    ctx.font = '600 16px "Space Mono", monospace';
    const hudY = this.bounds.height - 24;
    ctx.fillText(`Gold: ${this.goldEarned}`, 20, hudY);
    ctx.fillText(`Enemies: ${this.turrets.length}`, 20, hudY - 24);
    if (this.currentMap?.name) {
      ctx.font = '600 12px "Space Mono", monospace';
      ctx.fillText(`Map: ${this.currentMap.name}`, 20, hudY - 48);
    }
    ctx.restore();
  }
}
