/**
 * Cardinal Warden Simulation
 *
 * A "reverse danmaku" game for the Shin Spire. Instead of controlling a ship
 * avoiding bullets, the player is a boss (the Cardinal Warden) fighting off
 * incoming enemy ships.
 *
 * Features:
 * - 3:4 aspect ratio canvas that scales to fit the viewport
 * - Pure white background with minimalist aesthetics
 * - Golden rotating squares around a center orb (the Cardinal Warden)
 * - Enemy ships spawning from top, moving toward bottom
 * - Progressive difficulty scaling (speed, health, damage, variety)
 * - Score tracking with high score persistence
 * - Reset on death with difficulty restart
 *
 * Grapheme System:
 * Each weapon has up to 8 grapheme slots (0-7) where lexemes can be placed to modify behavior.
 * Graphemes are named A-Z (English letters), indices 0-25, with dagesh variants beyond.
 * 
 * - Grapheme 0 (A): ThoughtSpeak - Shape and damage multiplier based on slot
 * - Grapheme 1 (B): Fire rate multiplier based on slot position
 * - Grapheme 2 (C): Spawns friendly ships, deactivates graphemes to the RIGHT
 * - Grapheme 3 (D): Shield regeneration based on slot position and attack speed
 * - Grapheme 4 (E): Lightning movement - straight/zigzag/spiral based on slot
 * - Grapheme 5 (F): Piercing and trail passthrough based on slot position
 * - Grapheme 6 (G): Slow splash damage - expanding wave on hit, deactivates graphemes to the LEFT
 *   - Wave radius: (canvas.width / 10) × (slot + 1)
 *   - Wave damage: 10% of shot damage
 *   - Wave expansion: 3 seconds to reach max radius
 * - Grapheme 7 (H): Weapon targeting - draws target indicator on specific enemies
 *   - Slots 0-3: Target lowest enemy (closest to bottom of render)
 *   - Slots 4-7: Target lowest boss-class enemy
 * - Grapheme 8 (I): Spread bullets - fires multiple bullets in a cone pattern
 *   - Slots 1 and 8 (indices 0,7): +2 extra bullets (3 total)
 *   - Slots 2 and 7 (indices 1,6): +4 extra bullets (5 total)
 *   - Slots 3 and 6 (indices 2,5): +6 extra bullets (7 total)
 *   - Slots 4 and 5 (indices 3,4): +8 extra bullets (9 total)
 * - Grapheme 9 (J): Elemental effects - burning or freezing based on slot position
 *   - Slots 0-3: Burning effect - 5% max health damage per second with red particles
 *   - Slots 4-7: Freeze effect - 0.5 second freeze (ice blue color), refreshes on hit
 * - Grapheme 10 (K): Massive bullet mechanics - slot position determines behavior
 *   - Slots 1-7 (indices 0-6): Fires one massive bullet (20x damage, 20x diameter, 1/10 speed, unlimited pierce, inflicts all effects, 1/20 attack speed)
 *   - Slot 8 (index 7): Simple attack speed increase (10x faster)
 * - Grapheme 11 (L): Continuous beam - deactivates LEFT and RIGHT neighbor graphemes
 *   - Converts bullets into a continuous beam
 *   - Beam damage = tower damage × shots per second
 *   - Applies damage 4 times per second to enemies in contact with beam
 *   - Deactivates graphemes in slots immediately adjacent (left and right)
 * - Grapheme 12 (M): Drifting mines - spawns mines that drift and explode on contact
 *   - Mines released at rate: (shots per second) / 20
 *   - Mines drift slowly in random directions
 *   - On enemy contact: explodes with circular wave
 *   - Explosion diameter: canvas.width / 10
 *   - Explosion damage: 100x base weapon damage
 * - Grapheme 13 (N): Swarm ships - spawns tiny friendly triangles that fire green lasers
 *   - Number of ships: (total graphemes player has) / 10, max 100
 *   - Ships swarm randomly around player's aim target
 *   - Fire green lasers at closest enemy to aim target
 *   - Laser fire rate: weapon attack speed / 10
 *   - Laser damage: weapon damage / 10
 */

import {
  GAME_CONFIG,
  WEAPON_SLOT_IDS,
  WEAPON_SLOT_DEFINITIONS,
  LEGACY_WEAPON_DEFINITIONS,
  VISUAL_CONFIG,
} from './cardinalWardenConfig.js';
import {
  SeededRandom,
  OrbitalSquare,
  RingSquare,
  CardinalWarden,
} from './cardinalWarden/CardinalWardenEntities.js';
import {
  fireWeapon as cwWeaponFireWeapon,
  spawnMine as cwWeaponSpawnMine,
  updateFriendlyShips as cwWeaponUpdateFriendlyShips,
  checkFriendlyShipCollisions as cwWeaponCheckFriendlyShipCollisions,
  updateSwarmShips as cwWeaponUpdateSwarmShips,
  checkSwarmLaserCollisions as cwWeaponCheckSwarmLaserCollisions,
} from './cardinalWarden/CardinalWardenWeaponSystem.js';
import {
  updateDeathAnimation as cwSpawnUpdateDeathAnimation,
  createExplosionParticles as cwSpawnCreateExplosionParticles,
  startRespawnAnimation as cwSpawnStartRespawnAnimation,
  updateRespawnAnimation as cwSpawnUpdateRespawnAnimation,
  getEnemySpawnInterval as cwSpawnGetEnemySpawnInterval,
  spawnEnemy as cwSpawnSpawnEnemy,
  getEnemyTypePool as cwSpawnGetEnemyTypePool,
  getBossSpawnInterval as cwSpawnGetBossSpawnInterval,
  getBossTypePool as cwSpawnGetBossTypePool,
  spawnBoss as cwSpawnSpawnBoss,
  handleWaveBossSpawns as cwSpawnHandleWaveBossSpawns,
  spawnSpecificBoss as cwSpawnSpawnSpecificBoss,
  updateBosses as cwSpawnUpdateBosses,
  spawnShipFromBoss as cwSpawnSpawnShipFromBoss,
  updateEnemies as cwSpawnUpdateEnemies,
} from './cardinalWarden/CardinalWardenSpawnSystem.js';
import {
  tryBounceBulletOffTrails as cwCombatTryBounceBulletOffTrails,
  updateBullets as cwCombatUpdateBullets,
  checkCollisions as cwCombatCheckCollisions,
  checkBeamCollisions as cwCombatCheckBeamCollisions,
  addScore as cwCombatAddScore,
  spawnScorePopup as cwCombatSpawnScorePopup,
  spawnDamageNumber as cwCombatSpawnDamageNumber,
  updateScorePopups as cwCombatUpdateScorePopups,
  updateDamageNumbers as cwCombatUpdateDamageNumbers,
  updateExpandingWaves as cwCombatUpdateExpandingWaves,
  updateMines as cwCombatUpdateMines,
} from './cardinalWarden/CardinalWardenCombatSystem.js';
import {
  renderScriptChar as renderCwScriptChar,
  renderWardenName as renderCwWardenName,
  renderScorePopups as renderCwScorePopups,
  renderDamageNumbers as renderCwDamageNumbers,
  render as renderCwRender,
  renderDeathAnimation as renderCwDeathAnimation,
  renderRespawnAnimation as renderCwRespawnAnimation,
  renderWarden as renderCwWarden,
  renderAimTarget as renderCwAimTarget,
  renderWeaponTargets as renderCwWeaponTargets,
  renderFriendlyShips as renderCwFriendlyShips,
  renderEnemies as renderCwEnemies,
  renderBosses as renderCwBosses,
  renderCircleCarrierBoss as renderCwCircleCarrierBoss,
  renderPyramidBoss as renderCwPyramidBoss,
  renderHexagonFortressBoss as renderCwHexagonFortressBoss,
  renderMegaBoss as renderCwMegaBoss,
  renderUltraBoss as renderCwUltraBoss,
  renderBullets as renderCwBullets,
  renderBeams as renderCwBeams,
  renderExpandingWaves as renderCwExpandingWaves,
  renderMines as renderCwMines,
  renderSwarmShips as renderCwSwarmShips,
  renderSwarmLasers as renderCwSwarmLasers,
  initializeLifeLines as renderCwInitializeLifeLines,
  updateLifeLine as renderCwUpdateLifeLine,
  renderUI as renderCwUI,
} from './cardinalWarden/CardinalWardenRenderer.js';
import {
  applyColorMode as cwSpriteApplyColorMode,
  updateWeaponColors as cwSpriteUpdateWeaponColors,
  shiftHue as cwSpriteShiftHue,
  rebuildTintedGraphemeCache as cwSpriteRebuildTintedGraphemeCache,
  loadGraphemeSprites as cwSpriteLoadGraphemeSprites,
  rebuildSingleTintedGrapheme as cwSpriteRebuildSingleTintedGrapheme,
  loadBulletSprites as cwSpriteLoadBulletSprites,
  loadWardenSprites as cwSpriteLoadWardenSprites,
  loadEnemyShipSprites as cwSpriteLoadEnemyShipSprites,
  loadBossSprites as cwSpriteLoadBossSprites,
} from './cardinalWarden/CardinalWardenSpriteSystem.js';
import {
  getEffectiveGraphemeAssignments as cwCalcGetEffectiveGraphemeAssignments,
  calculateFireRateMultiplier as cwCalcCalculateFireRateMultiplier,
  calculateWeaponAttackSpeed as cwCalcCalculateWeaponAttackSpeed,
  updateShieldRegeneration as cwCalcUpdateShieldRegeneration,
  regenerateShield as cwCalcRegenerateShield,
  updateWeaponTimers as cwCalcUpdateWeaponTimers,
} from './cardinalWarden/CardinalWardenCalculations.js';

// Configuration constants now imported from cardinalWardenConfig.js

/**
 * Lighten a hex color by blending it toward white.
 */
function lightenHexColor(hex, amount = 0.2) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) {
    return hex;
  }

  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel) => Math.round(channel + (255 - channel) * amount);

  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

// WEAPON_SLOT_IDS, WEAPON_SLOT_DEFINITIONS, LEGACY_WEAPON_DEFINITIONS, and ENEMY_TYPES
// now imported from cardinalWardenConfig.js

/**
 * Get all available weapon slot IDs.
 */
export function getWeaponIds() {
  return Object.keys(WEAPON_SLOT_DEFINITIONS);
}

/**
 * Get weapon slot definition by ID.
 */
export function getWeaponDefinition(weaponId) {
  return WEAPON_SLOT_DEFINITIONS[weaponId] || null;
}

/**
 * Main Cardinal Warden reverse danmaku simulation.
 */
export class CardinalWardenSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style - accept nightMode from options or default to false (light mode)
    this.nightMode = !!options.nightMode;
    this.enemyTrailQuality = options.enemyTrailQuality || 'high';
    this.bulletTrailLength = options.bulletTrailLength || 'long';
    
    // Load colors from config based on mode
    const colorMode = this.nightMode ? VISUAL_CONFIG.NIGHT : VISUAL_CONFIG.DAY;
    this.bgColor = colorMode.BG_COLOR;
    this.wardenCoreColor = colorMode.WARDEN_CORE_COLOR;
    this.wardenSquareColor = colorMode.WARDEN_SQUARE_COLOR;
    this.bulletColor = colorMode.BULLET_COLOR;
    this.ringStrokeColor = colorMode.RING_STROKE_COLOR;
    this.uiTextColor = colorMode.UI_TEXT_COLOR;
    this.enemyTrailColor = colorMode.ENEMY_TRAIL_COLOR;
    this.enemySmokeColor = colorMode.ENEMY_SMOKE_COLOR;
    this.scriptColorDay = options.scriptColorDay || VISUAL_CONFIG.DAY.SCRIPT_COLOR;
    this.scriptColorNight = options.scriptColorNight || VISUAL_CONFIG.NIGHT.SCRIPT_COLOR;
    this.activeScriptColor = this.nightMode ? this.scriptColorNight : this.scriptColorDay;

    // Individual grapheme SVG sprites for Cardinal Warden name display
    // Each grapheme (A-Z) has its own white SVG file that gets colored
    this.graphemeSprites = new Map(); // Map from grapheme index to Image
    this.graphemeSpriteLoaded = new Map(); // Map from grapheme index to boolean
    this.tintedGraphemeCache = new Map(); // Map from grapheme index to colored canvas
    this.loadGraphemeSprites();

    // Bullet sprite artwork for Shin spire projectiles.
    this.bulletSprites = [];
    // Track which bullet sprite images have finished loading.
    this.bulletSpriteLoaded = [];
    // Begin preloading bullet sprites so they can be drawn during render.
    this.loadBulletSprites();
    
    // Warden sprite artwork for new visual style
    this.wardenCoreSprite = null;
    this.wardenCoreLoaded = false;
    this.wardenShardSprites = []; // Array of 37 shard sprites
    this.wardenShardsLoaded = []; // Track loading state of each shard
    this.legacyWardenGraphics = false; // Toggle between sprite and canvas rendering
    this.loadWardenSprites();

    // Enemy ship sprite artwork for 6 difficulty levels plus boss minion variants.
    this.enemyShipSprites = [];
    this.enemyShipSpritesLoaded = [];
    this.loadEnemyShipSprites();

    // Boss sprite artwork and inverted variants for milestone boss waves.
    this.bossSprites = [];
    this.bossSpritesLoaded = [];
    this.invertedBossSpriteCache = [];
    this.loadBossSprites();

    // Game state
    this.running = false;
    this.paused = false;
    this.score = 0;
    this.highScore = options.highScore || 0;
    this.highestWave = options.highestWave || 0; // Track highest wave reached
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.maxEnemiesPassedThrough = GAME_CONFIG.MAX_ENEMIES_PASSED;
    this.damageThreshold = GAME_CONFIG.WARDEN_MAX_HEALTH;
    
    // Life lines visualization (5 lines, each representing 2 lives)
    // States: 'solid' (2 lives), 'dashed' (1 life), 'gone' (0 lives)
    this.initializeLifeLines();

    // Game objects
    this.warden = null;
    this.enemies = [];
    this.bullets = [];
    this.bosses = []; // Boss ships array
    this.friendlyShips = []; // Friendly ships spawned by third grapheme (gamma)
    this.scorePopups = []; // Floating score text when enemies are destroyed
    this.damageNumbers = []; // Floating damage numbers when enemies are hit
    this.expandingWaves = []; // Expanding damage waves spawned by grapheme G (index 6)
    this.beams = []; // Continuous beams from grapheme L (index 11)
    this.mines = []; // Drifting mines from grapheme M (index 12)
    this.swarmShips = []; // Swarm ships from grapheme N (index 13)
    this.swarmLasers = []; // Lasers fired by swarm ships

    // Base health upgrade system (can be upgraded with iterons)
    this.baseHealthLevel = options.baseHealthLevel || 0;
    this.baseHealthUpgradeCost = 50; // Base cost in iterons for first upgrade
    this.baseHealthPerLevel = 10; // Additional health per upgrade level

    // Death and respawn animation state
    this.gamePhase = 'playing'; // 'playing', 'death', 'respawn'
    this.deathAnimTimer = 0;
    this.respawnAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
    this.respawnOpacity = 0;

    // Timing
    this.lastFrameTime = 0;
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.waveDuration = GAME_CONFIG.WAVE_DURATION_MS;
    this.bossSpawnTimer = 0;
    this.baseBossSpawnInterval = 30000; // Base time between boss spawns (30 seconds)

    // Spawn rates (adjusted by difficulty)
    this.baseEnemySpawnInterval = GAME_CONFIG.BASE_ENEMY_SPAWN_INTERVAL_MS;
    this.baseBulletInterval = GAME_CONFIG.BASE_BULLET_INTERVAL_MS;

    // RNG
    this.rng = new SeededRandom(options.seed || Date.now());

    // Game speed control (1x, 2x, 3x)
    this.gameSpeed = 1;
    this.speedButtonHover = false;

    // Callbacks
    this.onScoreChange = options.onScoreChange || null;
    this.onHighScoreChange = options.onHighScoreChange || null;
    this.onWaveChange = options.onWaveChange || null;
    this.onGameOver = options.onGameOver || null;
    this.onHealthChange = options.onHealthChange || null;
    this.onHighestWaveChange = options.onHighestWaveChange || null;
    this.onEnemyKill = options.onEnemyKill || null;
    this.onPostRender = options.onPostRender || null;
    this.onGuaranteedGraphemeDrop = options.onGuaranteedGraphemeDrop || null;

    // Upgrade state (for future expansion)
    this.upgrades = {
      bulletDamage: 1,
      bulletSpeed: 1,
      bulletCount: 1,
      fireRate: 1,
      patterns: ['radial'], // Unlocked patterns
    };

    // Simplified weapon system - slot1 starts purchased, slots 2 and 3 must be purchased
    this.weapons = {
      // Only slot1 is purchased by default, others must be unlocked
      purchased: { slot1: true, slot2: false, slot3: false },
      levels: { slot1: 1, slot2: 1, slot3: 1 }, // Level tracking for future lexeme upgrades
      equipped: ['slot1', 'slot2', 'slot3'], // All 3 weapons always equipped when purchased
    };
    
    // Weapon-specific upgrades (attack and speed levels per weapon)
    this.weaponUpgrades = {
      slot1: { attackLevel: 0, speedLevel: 0 },
      slot2: { attackLevel: 0, speedLevel: 0 },
      slot3: { attackLevel: 0, speedLevel: 0 },
    };
    
    // Maximum number of weapons that can be equipped simultaneously (always 3)
    this.maxEquippedWeapons = 3;
    
    // Weapon-specific timers (each weapon has its own fire rate)
    this.weaponTimers = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon glow state for visual feedback (0 = no glow, 1 = full glow)
    this.weaponGlowState = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon phase state for potential future grapheme phase accumulation
    this.weaponPhases = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon grapheme assignments for dynamic script rendering
    // Each weapon has up to 8 grapheme slots for lexeme placement
    this.weaponGraphemeAssignments = {
      slot1: [],
      slot2: [],
      slot3: [],
    };
    
    // Grapheme inventory counts for excess bonus calculation
    // Maps grapheme index to count in player's inventory
    this.graphemeInventoryCounts = {};
    
    // Weapon target tracking for eighth grapheme (index 7 - theta)
    // Stores the currently targeted enemy for each weapon
    this.weaponTargets = {
      slot1: null,
      slot2: null,
      slot3: null,
    };

    // Shield regeneration tracking for fourth grapheme (index 3 - delta)
    // Tracks accumulated time toward next shield recovery
    this.shieldRegenAccumulators = {};

    // Mine spawn timing for grapheme M (index 12)
    // Tracks accumulated time toward next mine spawn for each weapon
    this.mineSpawnAccumulators = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Aim target for player-controlled weapons (Sine Wave and Convergent Rails)
    // When null, weapons fire straight up; when set, they aim toward this point
    this.aimTarget = null;
    
    // Track active pointer for drag-based aiming
    this.aimPointerId = null;
    
    // Bind input handlers for aiming
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Bind visibility change handler
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    // Animation frame handle
    this.animationFrameId = null;
    
    // Auto-start flag (game starts immediately without menu)
    this.autoStart = options.autoStart !== false;

    // Callback for weapon state changes
    this.onWeaponChange = options.onWeaponChange || null;

    // Apply the initial palette before creating objects.
    this.applyColorMode();

    this.initialize();
    
    // Auto-start the game if autoStart option is true
    if (this.autoStart) {
      this.start();
    }
  }

  /**
   * Update palette values based on day/night render mode.
   */
  applyColorMode() { cwSpriteApplyColorMode.call(this); }

  /**
   * Calculate weapon colors based on a gradient from the universal color palette.
   */
  updateWeaponColors() { cwSpriteUpdateWeaponColors.call(this); }

  /**
   * Shift the hue of an RGB color by a specified amount in degrees.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} degrees - Degrees to shift hue (0-360)
   * @returns {string} Hex color string
   */
  shiftHue(r, g, b, degrees) { return cwSpriteShiftHue.call(this, r, g, b, degrees); }

  /**
   * Create tinted copies of all loaded grapheme sprites so glyphs follow the active palette.
   */
  rebuildTintedGraphemeCache() { cwSpriteRebuildTintedGraphemeCache.call(this); }

  /**
   * Load individual SVG grapheme sprites for the Cardinal Warden name display.
   */
  loadGraphemeSprites() { cwSpriteLoadGraphemeSprites.call(this); }

  /**
   * Create a tinted copy of a single grapheme sprite.
   * @param {number} index - The grapheme index (A-Z plus dagesh variants)
   * @param {Image} img - The loaded image
   */
  rebuildSingleTintedGrapheme(index, img) { cwSpriteRebuildSingleTintedGrapheme.call(this, index, img); }

  /**
   * Load bullet sprites so Shin spire projectiles can render with the uploaded artwork.
   */
  loadBulletSprites() { cwSpriteLoadBulletSprites.call(this); }

  /**
   * Load warden sprite artwork (core and rotating shards).
   */
  loadWardenSprites() { cwSpriteLoadWardenSprites.call(this); }

  /**
   * Load enemy ship sprites for the 6 difficulty levels.
   */
  loadEnemyShipSprites() { cwSpriteLoadEnemyShipSprites.call(this); }

  /**
   * Load milestone boss sprites and prebuild inverted-color variants.
   */
  loadBossSprites() { cwSpriteLoadBossSprites.call(this); }

  /**
   * Render a character from the individual grapheme sprites.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} charIndex - Index of the grapheme (A-Z plus dagesh variants)
   * @param {number} x - X position to render at
   * @param {number} y - Y position to render at
   * @param {number} size - Size to render the character
   */
  renderScriptChar(ctx, charIndex, x, y, size) { renderCwScriptChar.call(this, ctx, charIndex, x, y, size); }

  /**
   * Render the Cardinal Warden's script below the warden.
   * Displays 8 lines of script, one per weapon slot, based on assigned graphemes.
   */
  renderWardenName() { renderCwWardenName.call(this); }

  /**
   * Propagate ring colors to existing warden rings so mode toggles are immediate.
   */
  applyRingColors() {
    if (!this.warden) return;
    for (const ring of this.warden.ringSquares) {
      ring.strokeColor = this.ringStrokeColor;
    }
  }

  initialize() {
    if (!this.canvas) return;
    this.initWarden();
    this.applyRingColors();
    this.attachInputHandlers();
    this.attachVisibilityHandler();
  }

  /**
   * Attach input event handlers for aiming.
   */
  attachInputHandlers() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerUp);
  }

  /**
   * Detach input event handlers.
   */
  detachInputHandlers() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
  }

  /**
   * Attach visibility change handler to re-enable input when tab becomes visible.
   */
  attachVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Detach visibility change handler.
   */
  detachVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle visibility change events - re-attach input handlers when tab becomes visible.
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Re-attach input handlers when tab becomes visible
      this.detachInputHandlers();
      this.attachInputHandlers();
    }
  }

  /**
   * Handle pointer down events for setting aim target.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerDown(event) {
    if (!this.canvas || this.gamePhase !== 'playing') return;
    
    // Track this pointer for drag-based aiming
    this.aimPointerId = event.pointerId;
    
    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Set the aim target
    this.aimTarget = { x, y };
  }

  /**
   * Handle pointer move events for dynamic aim target updating during drag.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerMove(event) {
    // Only update if we're tracking this pointer (started with pointerdown on canvas)
    if (!this.canvas || this.aimPointerId !== event.pointerId || this.gamePhase !== 'playing') return;
    
    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Update the aim target dynamically
    this.aimTarget = { x, y };
  }

  /**
   * Handle pointer up/cancel/leave events to stop tracking aim pointer.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerUp(event) {
    if (this.aimPointerId === event.pointerId) {
      this.aimPointerId = null;
    }
  }

  /**
   * Clear the aim target (weapons will fire straight up).
   */
  clearAimTarget() {
    this.aimTarget = null;
  }

  /**
   * Get the current aim target.
   * @returns {Object|null} The aim target {x, y} or null
   */
  getAimTarget() {
    return this.aimTarget;
  }

  /**
   * Toggle the render palette between day and night variants.
   */
  setNightMode(enabled) {
    this.nightMode = Boolean(enabled);
    this.applyColorMode();
    this.applyRingColors();
    this.refreshEnemyColorsForMode();
    this.refreshBulletColorsForMode();
    this.refreshBossColorsForMode();
  }

  /**
   * Set enemy trail quality setting.
   * @param {string} quality - 'low', 'medium', or 'high'
   */
  setEnemyTrailQuality(quality) {
    const validQualities = ['low', 'medium', 'high'];
    this.enemyTrailQuality = validQualities.includes(quality) ? quality : 'high';
  }

  /**
   * Set bullet trail length setting.
   * @param {string} length - 'none', 'short', 'medium', or 'long'
   */
  setBulletTrailLength(length) {
    const validLengths = ['none', 'short', 'medium', 'long'];
    this.bulletTrailLength = validLengths.includes(length) ? length : 'long';
  }
  
  /**
   * Set legacy warden graphics mode.
   * @param {boolean} enabled - True to use old canvas rendering, false for new sprites
   */
  setLegacyWardenGraphics(enabled) {
    this.legacyWardenGraphics = Boolean(enabled);
  }

  /**
   * Get the max trail length for enemies (always full length for gameplay).
   * @returns {number} Max trail entries
   */
  getEnemyTrailMaxLength() {
    // Trail length is always max for gameplay (collision detection)
    return 28;
  }

  /**
   * Get the max smoke puffs for enemies (always full for gameplay).
   * @returns {number} Max smoke puffs
   */
  getEnemySmokeMaxCount() {
    // Smoke puffs always at max for gameplay
    return 60;
  }
  
  /**
   * Get the enemy trail quality for rendering.
   * @returns {string} Quality level: 'low', 'medium', or 'high'
   */
  getEnemyTrailQuality() {
    return this.enemyTrailQuality || 'high';
  }

  /**
   * Get the max trail length for bullets based on current setting.
   * Bullets now have 4x longer trails by default (40 vs original 10).
   * @returns {number} Max trail entries
   */
  getBulletTrailMaxLength() {
    switch (this.bulletTrailLength) {
      case 'none': return 0;
      case 'short': return 10;
      case 'medium': return 20;
      case 'long': return 40;
      default: return 40;
    }
  }

  /**
   * Keep current enemies aligned with the active color mode.
   */
  refreshEnemyColorsForMode() {
    for (const enemy of this.enemies) {
      enemy.color = this.nightMode ? '#ffffff' : enemy.baseColor;
    }
  }

  /**
   * Keep current bosses aligned with the active color mode.
   */
  refreshBossColorsForMode() {
    for (const boss of this.bosses) {
      boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
    }
  }

  /**
   * Lighten existing bullets when night mode is enabled for consistency.
   */
  refreshBulletColorsForMode() {
    for (const bullet of this.bullets) {
      const sourceColor = bullet.baseColor || bullet.color;
      bullet.color = this.resolveBulletColor(sourceColor);
    }
  }

  /**
   * Resolve an appropriate bullet tint for the active palette.
   */
  resolveBulletColor(baseColor) {
    if (this.nightMode) {
      return lightenHexColor(baseColor || this.bulletColor, 0.35);
    }
    return baseColor || this.bulletColor;
  }

  initWarden() {
    if (!this.canvas) return;
    // Position warden in lower third of canvas (boss position in danmaku)
    const x = this.canvas.width / 2;
    const y = this.canvas.height * 0.75;
    this.warden = new CardinalWarden(x, y, this.rng);
    
    // Apply base health upgrade
    const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
    this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
    this.warden.health = this.warden.maxHealth;
  }

  /**
   * Get the current base health upgrade level.
   */
  getBaseHealthLevel() {
    return this.baseHealthLevel;
  }

  /**
   * Get the cost to upgrade base health to the next level.
   * Cost increases by 50% each level: 50, 75, 112, 168, 252...
   */
  getBaseHealthUpgradeCost() {
    return Math.floor(this.baseHealthUpgradeCost * Math.pow(1.5, this.baseHealthLevel));
  }

  /**
   * Get the current max health (base + upgrades).
   */
  getMaxHealth() {
    return GAME_CONFIG.WARDEN_MAX_HEALTH + this.baseHealthLevel * this.baseHealthPerLevel;
  }

  /**
   * Upgrade base health (call after spending iterons externally).
   * @returns {boolean} True if upgrade was applied
   */
  upgradeBaseHealth() {
    this.baseHealthLevel += 1;
    
    // Apply to current warden if it exists
    if (this.warden) {
      const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
      const oldMaxHealth = this.warden.maxHealth;
      this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
      // Heal by the amount of new health gained from the upgrade
      const healthGained = this.warden.maxHealth - oldMaxHealth;
      this.warden.health = Math.min(this.warden.maxHealth, this.warden.health + healthGained);
      if (this.onHealthChange) {
        this.onHealthChange(this.warden.health, this.warden.maxHealth);
      }
    }
    
    return true;
  }

  /**
   * Set the base health level (for loading saved state).
   * @param {number} level - The level to set
   */
  setBaseHealthLevel(level) {
    this.baseHealthLevel = Math.max(0, Math.floor(level));
    // Apply to current warden if it exists
    if (this.warden) {
      const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
      this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
      this.warden.health = Math.min(this.warden.health, this.warden.maxHealth);
    }
  }

  /**
   * Start the simulation.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the simulation.
   */
  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.detachInputHandlers();
    this.detachVisibilityHandler();
  }

  /**
   * Pause/unpause the simulation.
   */
  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) {
      this.lastFrameTime = performance.now();
    }
  }

  /**
   * Reset the game to initial state. Preserves highest wave for Shin Glyph tracking.
   */
  reset() {
    // Check for high score before resetting
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (this.onHighScoreChange) {
        this.onHighScoreChange(this.highScore);
      }
    }

    this.score = 0;
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.initializeLifeLines();
    this.enemies = [];
    this.bullets = [];
    this.bosses = [];
    this.friendlyShips = [];
    this.expandingWaves = [];
    this.beams = [];
    this.swarmShips = [];
    this.swarmLasers = [];
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.bossSpawnTimer = 0;
    
    // Reset animation state
    this.gamePhase = 'playing';
    this.deathAnimTimer = 0;
    this.respawnAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
    this.respawnOpacity = 1;
    
    // Reset aim pointer tracking
    this.aimPointerId = null;

    if (this.warden) {
      this.warden.reset();
    } else {
      this.initWarden();
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
    if (this.onWaveChange) {
      this.onWaveChange(this.wave);
    }
    if (this.onHealthChange && this.warden) {
      this.onHealthChange(this.warden.health, this.warden.maxHealth);
    }
  }

  /**
   * Main game loop.
   */
  gameLoop() {
    if (!this.running) return;

    const now = performance.now();
    // Cap delta to ~2 frames at 60fps to prevent objects teleporting through each other
    const deltaTime = Math.min(now - this.lastFrameTime, GAME_CONFIG.MAX_DELTA_TIME_MS);
    this.lastFrameTime = now;

    if (!this.paused) {
      // Apply game speed multiplier
      this.update(deltaTime * this.gameSpeed);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update game state.
   */
  update(deltaTime) {
    // Handle different game phases
    switch (this.gamePhase) {
      case 'death':
        this.updateDeathAnimation(deltaTime);
        return;
      case 'respawn':
        this.updateRespawnAnimation(deltaTime);
        return;
      case 'playing':
      default:
        break;
    }

    // Update wave timer
    this.waveTimer += deltaTime;
    if (this.waveTimer >= this.waveDuration) {
      this.waveTimer = 0;
      this.wave++;
      this.difficultyLevel = Math.floor(this.wave / 6);
      
      // Track highest wave reached
      if (this.wave > this.highestWave) {
        this.highestWave = this.wave;
        if (this.onHighestWaveChange) {
          this.onHighestWaveChange(this.highestWave);
        }
      }
      
      // Handle guaranteed grapheme drops every 10 waves (waves 10, 20, 30, etc. up to 260)
      const waveNumber = this.wave + 1; // Convert from 0-indexed to 1-indexed
      if (waveNumber % 10 === 0 && waveNumber <= 260) {
        // Guaranteed grapheme drop for wave milestone
        if (this.onGuaranteedGraphemeDrop) {
          this.onGuaranteedGraphemeDrop(waveNumber);
        }
      }
      
      // Handle wave-based boss spawning rules
      this.handleWaveBossSpawns();
      
      if (this.onWaveChange) {
        this.onWaveChange(this.wave);
      }
    }

    // Update Cardinal Warden
    if (this.warden) {
      this.warden.update(deltaTime);
    }

    // Spawn enemies
    this.enemySpawnTimer += deltaTime;
    const spawnInterval = this.getEnemySpawnInterval();
    if (this.enemySpawnTimer >= spawnInterval) {
      this.enemySpawnTimer = 0;
      this.spawnEnemy();
    }

    // Boss spawning is wave-driven (every 10 waves) so no timer-based spawns run here.

    // Fire bullets for each purchased weapon based on their individual fire rates
    this.updateWeaponTimers(deltaTime);

    // Update friendly ships
    this.updateFriendlyShips(deltaTime);
    
    // Update swarm ships
    this.updateSwarmShips(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update bosses
    this.updateBosses(deltaTime);

    // Update bullets
    this.updateBullets(deltaTime);

    // Check collisions
    this.checkCollisions();
    
    // Check beam collisions
    this.checkBeamCollisions();
    
    // Check friendly ship collisions
    this.checkFriendlyShipCollisions();

    // Update floating score popups
    this.updateScorePopups(deltaTime);

    // Update floating damage numbers
    this.updateDamageNumbers(deltaTime);
    
    // Update expanding waves
    this.updateExpandingWaves(deltaTime);
    
    // Update mines
    this.updateMines(deltaTime);

    // Check game over conditions
    this.checkGameOver();
    
    // Update shield regeneration from fourth grapheme
    this.updateShieldRegeneration(deltaTime);
  }
  
  /**
   * Get the effective grapheme assignments for a weapon slot,
   * applying deactivation mechanics from various graphemes.
   * 
   * Deactivation rules:
   * - Grapheme C (index 2): Deactivates all graphemes to the RIGHT
   * - Grapheme G (index 6): Deactivates all graphemes to the LEFT
   * - Grapheme L (index 11): Deactivates immediate LEFT and RIGHT neighbors
   * 
   * Priority order: G > C > L (if both G and C are present, G takes precedence)
   * 
   * @param {Array} assignments - The raw grapheme assignments for a weapon slot
   * @returns {Array} The effective grapheme assignments after applying deactivation
   */
  getEffectiveGraphemeAssignments(assignments) { return cwCalcGetEffectiveGraphemeAssignments.call(this, assignments); }

  /**
   * Calculate fire rate multiplier from second grapheme (index 1) and grapheme K (index 10) in effective assignments.
   * @param {Array} effectiveAssignments - The effective grapheme assignments for a weapon
   * @returns {number} Fire rate multiplier (1 = no change, 2 = 2x faster, etc.)
   */
  calculateFireRateMultiplier(effectiveAssignments) { return cwCalcCalculateFireRateMultiplier.call(this, effectiveAssignments); }

  /**
   * Calculate weapon attack speed (bullets per second) for a weapon.
   * @param {Object} weaponDef - The weapon definition
   * @param {number} fireRateMultiplier - Fire rate multiplier from graphemes
   * @returns {number} Attack speed in bullets per second
   */
  calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier) { return cwCalcCalculateWeaponAttackSpeed.call(this, weaponDef, fireRateMultiplier); }

  /**
   * Update shield regeneration based on fourth grapheme (index 3 - delta).
   */
  updateShieldRegeneration(deltaTime) { cwCalcUpdateShieldRegeneration.call(this, deltaTime); }

  /**
   * Regenerate one shield/life for the player.
   */
  regenerateShield() { cwCalcRegenerateShield.call(this); }

  /**
   * Update weapon timers and fire bullets when ready.
   */
  updateWeaponTimers(deltaTime) { cwCalcUpdateWeaponTimers.call(this, deltaTime); }
  
  /**
   * Fire a simple bullet from a specific weapon slot toward the aim target.
   * Applies ThoughtSpeak grapheme mechanics if the first grapheme (index 0) is present.
   */
  fireWeapon(weaponId) { cwWeaponFireWeapon.call(this, weaponId); }
  
  /**
   * Spawn a mine from a specific weapon slot.
   * Mines drift slowly and explode on contact with enemies.
   */
  spawnMine(weaponId, opts) { cwWeaponSpawnMine.call(this, weaponId, opts); }
  
  /**
   * Update friendly ships based on third grapheme (index 2 - gamma) assignments.
   * Spawns ships up to the max count determined by fire rate.
   */
  updateFriendlyShips(deltaTime) { cwWeaponUpdateFriendlyShips.call(this, deltaTime); }
  
  /**
   * Check collisions between friendly ships and enemies.
   */
  checkFriendlyShipCollisions() { cwWeaponCheckFriendlyShipCollisions.call(this); }
  
  /**
   * Update swarm ships from grapheme N (index 13).
   * Number of ships = (total graphemes) / 10, max 100.
   */
  updateSwarmShips(deltaTime) { cwWeaponUpdateSwarmShips.call(this, deltaTime); }
  
  /**
   * Check collisions between swarm lasers and enemies.
   * Delegates to extracted WeaponSystem (Build 522).
   */
  checkSwarmLaserCollisions() { cwWeaponCheckSwarmLaserCollisions.call(this); }
  
  /**
   * Update death animation (Cardinal Warden shaking and exploding).
   */
  updateDeathAnimation(deltaTime) { cwSpawnUpdateDeathAnimation.call(this, deltaTime); }
  
  /**
   * Create explosion particles for death animation.
   */
  createExplosionParticles() { cwSpawnCreateExplosionParticles.call(this); }
  
  /**
   * Start the respawn animation.
   */
  startRespawnAnimation() { cwSpawnStartRespawnAnimation.call(this); }
  
  /**
   * Update respawn animation (Cardinal Warden fading in).
   */
  updateRespawnAnimation(deltaTime) { cwSpawnUpdateRespawnAnimation.call(this, deltaTime); }

  /**
   * Get current enemy spawn interval based on difficulty.
   */
  getEnemySpawnInterval() { return cwSpawnGetEnemySpawnInterval.call(this); }

  /**
   * Spawn an enemy based on current difficulty.
   */
  spawnEnemy() { cwSpawnSpawnEnemy.call(this); }

  /**
   * Get pool of enemy types available at current difficulty.
   */
  getEnemyTypePool() { return cwSpawnGetEnemyTypePool.call(this); }

  /**
   * Get boss spawn interval based on difficulty.
   * Higher difficulty = more frequent boss spawns.
   */
  getBossSpawnInterval() { return cwSpawnGetBossSpawnInterval.call(this); }

  /**
   * Get pool of boss types available at current difficulty.
   */
  getBossTypePool() { return cwSpawnGetBossTypePool.call(this); }

  /**
   * Spawn a boss ship based on current difficulty.
   */
  spawnBoss(waveNumber = this.wave + 1) { cwSpawnSpawnBoss.call(this, waveNumber); }

  /**
   * Handle wave-based boss spawning rules.
   * Called when a new wave starts.
   */
  handleWaveBossSpawns() { cwSpawnHandleWaveBossSpawns.call(this); }

  /**
   * Spawn a specific boss type.
   */
  spawnSpecificBoss(bossType) { cwSpawnSpawnSpecificBoss.call(this, bossType); }

  /**
   * Update all boss ships.
   */
  updateBosses(deltaTime) { cwSpawnUpdateBosses.call(this, deltaTime); }

  /**
   * Spawn a small ship from a boss (used by Circle Carrier).
   */
  spawnShipFromBoss(spawnData, boss) { cwSpawnSpawnShipFromBoss.call(this, spawnData, boss); }

  /**
   * Update all enemies.
   */
  updateEnemies(deltaTime) { cwSpawnUpdateEnemies.call(this, deltaTime); }

  /**
   * Bounce a bullet off nearby ship trails when it grazes their wake.
   */
  tryBounceBulletOffTrails(bullet) { return cwCombatTryBounceBulletOffTrails.call(this, bullet); }

  /**
   * Update all bullets.
   */
  updateBullets(deltaTime) { cwCombatUpdateBullets.call(this, deltaTime); }

  /**
   * Check collisions between bullets and enemies.
   */
  checkCollisions() { cwCombatCheckCollisions.call(this); }

  /**
   * Check collisions between beams and enemies.
   * Beams deal damage multiple times per second to all enemies they touch.
   * Delegates to extracted BeamSystem (Build 474).
   */
  checkBeamCollisions() { cwCombatCheckBeamCollisions.call(this); }



  /**
   * Add score and notify listeners.
   */
  addScore(amount) { cwCombatAddScore.call(this, amount); }

  /**
   * Spawn a floating score popup at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} value - Score value to display
   */
  spawnScorePopup(x, y, value) { cwCombatSpawnScorePopup.call(this, x, y, value); }

  /**
   * Spawn a floating damage number at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} damage - Damage value to display
   */
  spawnDamageNumber(x, y, damage) { cwCombatSpawnDamageNumber.call(this, x, y, damage); }

  /**
   * Update all floating score popups.
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  updateScorePopups(deltaTime) { cwCombatUpdateScorePopups.call(this, deltaTime); }

  /**
   * Update all floating damage numbers.
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  updateDamageNumbers(deltaTime) { cwCombatUpdateDamageNumbers.call(this, deltaTime); }

  /**
   * Update expanding waves from seventh grapheme (index 6).
   * Waves expand outward and damage enemies they touch.
   */
  updateExpandingWaves(deltaTime) { cwCombatUpdateExpandingWaves.call(this, deltaTime); }

  /**
   * Update all mines and check for collisions with enemies.
   * Mines explode on contact with enemies, creating expanding damage waves.
   * Delegates to extracted MineSystem (Build 474).
   */
  updateMines(deltaTime) { cwCombatUpdateMines.call(this, deltaTime); }

  /**
   * Render all floating score popups.
   */
  renderScorePopups() { renderCwScorePopups.call(this); }

  /**
   * Render all floating damage numbers.
   */
  renderDamageNumbers() { renderCwDamageNumbers.call(this); }

  /**
   * Check if game over conditions are met.
   */
  checkGameOver() {
    const gameOver = this.enemiesPassedThrough >= this.maxEnemiesPassedThrough ||
                     (this.warden && this.warden.health <= 0);

    if (gameOver && this.gamePhase === 'playing') {
      // Check for new high score before updating
      const isNewHighScore = this.score > this.highScore;
      
      // Update high score before death animation
      if (isNewHighScore) {
        this.highScore = this.score;
        if (this.onHighScoreChange) {
          this.onHighScoreChange(this.highScore);
        }
      }

      if (this.onGameOver) {
        this.onGameOver({
          score: this.score,
          highScore: this.highScore,
          wave: this.wave,
          highestWave: this.highestWave,
          isNewHighScore: isNewHighScore,
        });
      }

      // Start death animation instead of immediate reset
      this.startDeathAnimation();
    }
  }
  
  /**
   * Start the death animation sequence.
   */
  startDeathAnimation() {
    this.gamePhase = 'death';
    this.deathAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
  }

  /**
   * Render the game.
   */
  render() { renderCwRender.call(this); }

  /**
   * Render the death animation.
   */
  renderDeathAnimation() { renderCwDeathAnimation.call(this); }

  /**
   * Render the respawn animation.
   */
  renderRespawnAnimation() { renderCwRespawnAnimation.call(this); }

  /**
   * Render the Cardinal Warden.
   */
  renderWarden() { renderCwWarden.call(this); }

  /**
   * Render the aim target symbol where the player has clicked/tapped.
   */
  renderAimTarget() { renderCwAimTarget.call(this); }

  /**
   * Render target indicators for enemies targeted by the eighth grapheme (Theta).
   */
  renderWeaponTargets() { renderCwWeaponTargets.call(this); }

  /**
   * Render all friendly ships.
   */
  renderFriendlyShips() { renderCwFriendlyShips.call(this); }

  /**
   * Render all enemies.
   */
  renderEnemies() { renderCwEnemies.call(this); }

  /**
   * Render all boss ships with distinctive visuals.
   */
  renderBosses() { renderCwBosses.call(this); }

  /**
   * Render Circle Carrier boss - large rotating circle with inner rings.
   */
  renderCircleCarrierBoss(ctx, boss) { renderCwCircleCarrierBoss.call(this, ctx, boss); }

  /**
   * Render Pyramid boss - rotating triangle with burst indicator.
   */
  renderPyramidBoss(ctx, boss) { renderCwPyramidBoss.call(this, ctx, boss); }

  /**
   * Render Hexagon Fortress boss - large rotating hexagon with shield indicator.
   */
  renderHexagonFortressBoss(ctx, boss) { renderCwHexagonFortressBoss.call(this, ctx, boss); }

  /**
   * Render Mega Boss - enhanced hexagon with larger size.
   */
  renderMegaBoss(ctx, boss) { renderCwMegaBoss.call(this, ctx, boss); }

  /**
   * Render Ultra Boss - largest and most powerful boss with distinctive visual.
   */
  renderUltraBoss(ctx, boss) { renderCwUltraBoss.call(this, ctx, boss); }

  /**
   * Render all bullets.
   */
  renderBullets() { renderCwBullets.call(this); }

  /**
   * Render all beams from grapheme L (index 11).
   */
  renderBeams() { renderCwBeams.call(this); }

  /**
   * Render all expanding waves from the seventh grapheme (index 6).
   */
  renderExpandingWaves() { renderCwExpandingWaves.call(this); }

  /**
   * Render all drifting mines from grapheme M (index 12).
   */
  renderMines() { renderCwMines.call(this); }

  /**
   * Render all swarm ships from grapheme N (index 13).
   */
  renderSwarmShips() { renderCwSwarmShips.call(this); }

  /**
   * Render all swarm lasers from grapheme N (index 13).
   */
  renderSwarmLasers() { renderCwSwarmLasers.call(this); }

  /**
   * Initialize or reset life lines to their default state.
   * @private
   */
  initializeLifeLines() { renderCwInitializeLifeLines.call(this); }

  /**
   * Update life line states when ships pass through.
   * @param {number} count - Number of lives to consume (default: 1)
   */
  updateLifeLine(count = 1) { renderCwUpdateLifeLine.call(this, count); }

  /**
   * Render UI elements.
   */
  renderUI() { renderCwUI.call(this); }

  /**
   * Handle canvas resize.
   */
  resize(width, height) {
    if (!this.canvas) return;

    this.canvas.width = width;
    this.canvas.height = height;

    // Reposition warden
    if (this.warden) {
      this.warden.x = width / 2;
      this.warden.y = height * 0.75;
    }
  }

  /**
   * Get the current game state for persistence.
   */
  getState() {
    return {
      score: this.score,
      highScore: this.highScore,
      highestWave: this.highestWave,
      wave: this.wave,
      difficultyLevel: this.difficultyLevel,
      upgrades: { ...this.upgrades },
      weapons: {
        purchased: { ...this.weapons.purchased },
        levels: { ...this.weapons.levels },
        activeWeaponId: this.weapons.activeWeaponId,
      },
      baseHealthLevel: this.baseHealthLevel,
    };
  }

  /**
   * Restore game state.
   */
  setState(state) {
    if (state.highScore !== undefined) {
      this.highScore = state.highScore;
    }
    if (state.highestWave !== undefined) {
      this.highestWave = state.highestWave;
    }
    if (state.upgrades) {
      this.upgrades = { ...this.upgrades, ...state.upgrades };
    }
    if (state.weapons) {
      this.setWeaponState(state.weapons);
    }
    if (state.baseHealthLevel !== undefined) {
      this.setBaseHealthLevel(state.baseHealthLevel);
    }
  }

  /**
   * Set the high score externally.
   */
  setHighScore(value) {
    if (Number.isFinite(value) && value >= 0) {
      this.highScore = value;
    }
  }
  
  /**
   * Set the highest wave externally.
   */
  setHighestWave(value) {
    if (Number.isFinite(value) && value >= 0) {
      this.highestWave = Math.floor(value);
    }
  }
  
  /**
   * Get the highest wave reached.
   */
  getHighestWave() {
    return this.highestWave;
  }

  /**
   * Apply an upgrade to the Cardinal Warden.
   */
  applyUpgrade(upgradeType, level = 1) {
    switch (upgradeType) {
      case 'bulletDamage':
        this.upgrades.bulletDamage = Math.max(1, level);
        break;
      case 'bulletSpeed':
        this.upgrades.bulletSpeed = Math.max(1, level);
        break;
      case 'bulletCount':
        this.upgrades.bulletCount = Math.max(1, level);
        break;
      case 'fireRate':
        this.upgrades.fireRate = Math.max(1, level);
        break;
      case 'pattern':
        if (level && !this.upgrades.patterns.includes(level)) {
          this.upgrades.patterns.push(level);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Get all available weapon slots with their state.
   * All 3 slots are always active and cannot be purchased/upgraded individually.
   * Later, lexemes can be placed into these slots to modify behavior.
   */
  getAvailableWeapons() {
    const weapons = [];
    for (const weaponId of Object.keys(WEAPON_SLOT_DEFINITIONS)) {
      const def = WEAPON_SLOT_DEFINITIONS[weaponId];
      const isPurchased = this.weapons.purchased[weaponId] || false;
      const level = this.weapons.levels[weaponId] || 1;
      const isEquipped = true; // All slots are always equipped
      const glowIntensity = this.weaponGlowState?.[weaponId] || 0;
      const cooldownProgress = this.weaponTimers?.[weaponId] || 0;
      
      // Calculate actual fire interval considering graphemes and speed upgrades
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
      const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);
      const cooldownTotal = def.baseFireRate / (fireRateMultiplier * weaponSpeedMult);
      
      weapons.push({
        id: weaponId,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        color: def.color,
        cost: 0, // No cost - always available
        isPurchased,
        level,
        maxLevel: 1, // No upgrades yet (lexemes will handle this later)
        canUpgrade: false,
        upgradeCost: null,
        isEquipped,
        canEquip: false,
        canUnequip: false,
        glowIntensity, // 0-1 value for UI glow effect
        cooldownProgress, // Current cooldown timer value (ms)
        cooldownTotal, // Total cooldown duration (ms)
        slotIndex: def.slotIndex,
      });
    }
    return weapons.sort((a, b) => a.slotIndex - b.slotIndex);
  }

  /**
   * Purchase a weapon using score points.
   * @deprecated All 3 weapon slots are always active - no purchase needed
   * @returns {boolean} Always returns false
   */
  purchaseWeapon(weaponId) {
    // All weapon slots are always active - no purchase needed
    return false;
  }

  /**
   * Purchase a weapon without deducting score.
   * @deprecated All 3 weapon slots are always active - no purchase needed
   * @returns {boolean} Always returns false
   */
  purchaseWeaponWithoutCost(weaponId) {
    // All weapon slots are always active - no purchase needed
    return false;
  }

  /**
   * Upgrade a purchased weapon.
   * @deprecated Weapon upgrades will be handled by lexemes in the future
   * @returns {boolean} Always returns false
   */
  upgradeWeapon(weaponId) {
    // Weapon upgrades will be handled by lexemes in the future
    return false;
  }

  /**
   * Upgrade a purchased weapon without deducting score.
   * @deprecated Weapon upgrades will be handled by lexemes in the future
   * @returns {boolean} Always returns false
   */
  upgradeWeaponWithoutCost(weaponId) {
    // Weapon upgrades will be handled by lexemes in the future
    return false;
  }

  /**
   * Apply weapon-specific upgrades (attack and speed levels).
   * @param {string} weaponId - The weapon ID (slot1, slot2, slot3)
   * @param {number} attackLevel - Attack upgrade level
   * @param {number} speedLevel - Speed upgrade level
   */
  applyWeaponUpgrades(weaponId, attackLevel, speedLevel) {
    if (!this.weaponUpgrades[weaponId]) {
      this.weaponUpgrades[weaponId] = { attackLevel: 0, speedLevel: 0 };
    }
    this.weaponUpgrades[weaponId].attackLevel = attackLevel;
    this.weaponUpgrades[weaponId].speedLevel = speedLevel;
  }

  /**
   * Get weapon-specific attack multiplier based on upgrade level.
   * @param {string} weaponId - The weapon ID
   * @returns {number} Attack multiplier (1.0 = no upgrades, increases with level)
   */
  getWeaponAttackMultiplier(weaponId) {
    const attackLevel = this.weaponUpgrades[weaponId]?.attackLevel || 0;
    // Each level adds 10% damage
    return 1 + (attackLevel * 0.1);
  }

  /**
   * Get weapon-specific speed multiplier based on upgrade level.
   * @param {string} weaponId - The weapon ID
   * @returns {number} Speed multiplier (1.0 = no upgrades, increases with level)
   */
  getWeaponSpeedMultiplier(weaponId) {
    const speedLevel = this.weaponUpgrades[weaponId]?.speedLevel || 0;
    // Each level adds 10% fire rate
    return 1 + (speedLevel * 0.1);
  }

  /**
   * Equip a weapon slot.
   * @deprecated All 3 weapon slots are always equipped
   * @returns {boolean} Always returns false
   */
  equipWeapon(weaponId) {
    // All 3 weapon slots are always equipped
    return false;
  }

  /**
   * Unequip a weapon slot.
   * @deprecated All 3 weapon slots are always equipped
   * @returns {boolean} Always returns false
   */
  unequipWeapon(weaponId) {
    // All 3 weapon slots are always equipped
    return false;
  }

  /**
   * Check if a weapon is currently equipped.
   * @param {string} weaponId - The ID of the weapon to check
   * @returns {boolean} True if equipped
   */
  isWeaponEquipped(weaponId) {
    return this.weapons.equipped?.includes(weaponId) || false;
  }

  /**
   * Get the list of currently equipped weapon IDs.
   * @returns {string[]} Array of equipped weapon IDs
   */
  getEquippedWeapons() {
    return [...(this.weapons.equipped || [])];
  }

  /**
   * Get current weapon state for UI.
   */
  getWeaponState() {
    return {
      purchased: { ...this.weapons.purchased },
      levels: { ...this.weapons.levels },
      activeWeaponId: this.weapons.activeWeaponId,
      equipped: [...(this.weapons.equipped || [])],
    };
  }

  /**
   * Set weapon state from persistence.
   */
  setWeaponState(state) {
    if (state?.purchased) {
      this.weapons.purchased = { ...this.weapons.purchased, ...state.purchased };
    }
    
    if (state?.levels) {
      this.weapons.levels = { ...this.weapons.levels, ...state.levels };
    }
    if (state?.activeWeaponId) {
      this.weapons.activeWeaponId = state.activeWeaponId;
    }
    
    // All 3 weapons are in the equipped list, but only fire if purchased
    this.weapons.equipped = [...WEAPON_SLOT_IDS];
    
    // Initialize timers for all equipped weapons
    for (const weaponId of WEAPON_SLOT_IDS) {
      if (!this.weaponTimers[weaponId]) {
        this.weaponTimers[weaponId] = 0;
      }
      if (this.weaponPhases[weaponId] === undefined) {
        this.weaponPhases[weaponId] = 0; // Ensure phase accumulator exists after loading state.
      }
    }
  }

  /**
   * Set weapon grapheme assignments for dynamic script rendering.
   * @param {Object} assignments - Object mapping weapon IDs to arrays of grapheme assignments
   */
  setWeaponGraphemeAssignments(assignments) {
    if (!assignments || typeof assignments !== 'object') return;
    
    // Update assignments for each weapon slot
    for (const weaponId of WEAPON_SLOT_IDS) {
      if (assignments[weaponId]) {
        this.weaponGraphemeAssignments[weaponId] = assignments[weaponId];
      }
    }
  }

  /**
   * Get current weapon grapheme assignments.
   * @returns {Object} Object mapping weapon IDs to arrays of grapheme assignments
   */
  getWeaponGraphemeAssignments() {
    return {
      slot1: [...(this.weaponGraphemeAssignments.slot1 || [])],
      slot2: [...(this.weaponGraphemeAssignments.slot2 || [])],
      slot3: [...(this.weaponGraphemeAssignments.slot3 || [])],
    };
  }

  /**
   * Set grapheme inventory counts for calculating excess grapheme bonus.
   * @param {Object} counts - Map of grapheme index to count
   */
  setGraphemeInventoryCounts(counts) {
    if (!counts || typeof counts !== 'object') {
      this.graphemeInventoryCounts = {};
      return;
    }
    this.graphemeInventoryCounts = { ...counts };
  }
}
