/**
 * CardinalWardenSpawnSystem
 *
 * Spawn, death-animation, and enemy/boss update logic extracted from
 * CardinalWardenSimulation. Every function uses `.call(this, ...)` so that
 * `this` always refers to the simulation instance.
 */

import {
  BOSS_TYPES,
  ENEMY_TYPES,
  ENEMY_SHIP_SPRITES,
  GAME_CONFIG,
  SHIN_BOSS_MINION_SPRITE_URLS,
  resolveBossSpriteForWave,
} from '../cardinalWardenConfig.js';
import {
  EnemyShip,
  RicochetSkimmer,
  CircleCarrierBoss,
  PyramidBoss,
  HexagonFortressBoss,
  MegaBoss,
  UltraBoss,
} from './EnemySystem.js';

// ---------------------------------------------------------------------------
// Death / respawn animations
// ---------------------------------------------------------------------------

export function updateDeathAnimation(deltaTime) {
  const dt = deltaTime / 1000;
  this.deathAnimTimer += deltaTime;
  
  // Phase 1: Shake intensifies (0 - 1000ms)
  if (this.deathAnimTimer < 1000) {
    this.deathShakeIntensity = (this.deathAnimTimer / 1000) * 15;
  }
  // Phase 2: Explosion (1000 - 1500ms)
  else if (this.deathAnimTimer < 1500) {
    if (this.deathExplosionParticles.length === 0) {
      createExplosionParticles.call(this);
    }
    // Update explosion particles
    for (const particle of this.deathExplosionParticles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.alpha = Math.max(0, particle.life / particle.maxLife);
    }
    // Clear all enemies during explosion
    this.enemies = [];
  }
  // Phase 3: Fade out particles and transition to respawn (1500 - 2500ms)
  else if (this.deathAnimTimer < 2500) {
    for (const particle of this.deathExplosionParticles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.alpha = Math.max(0, particle.life / particle.maxLife);
    }
  }
  // Phase 4: Start respawn animation
  else {
    startRespawnAnimation.call(this);
  }
}

/**
 * Create explosion particles for death animation.
 */
export function createExplosionParticles() {
  if (!this.warden) return;
  
  const particleCount = 40;
  for (let i = 0; i < particleCount; i++) {
    const angle = this.rng.range(0, Math.PI * 2);
    const speed = this.rng.range(50, 200);
    this.deathExplosionParticles.push({
      x: this.warden.x,
      y: this.warden.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: this.rng.range(3, 10),
      color: this.rng.next() > 0.5 ? this.wardenCoreColor : this.wardenSquareColor,
      life: this.rng.range(0.5, 1.5),
      maxLife: 1.5,
      alpha: 1,
    });
  }
}

/**
 * Start the respawn animation.
 */
export function startRespawnAnimation() {
  this.gamePhase = 'respawn';
  this.respawnAnimTimer = 0;
  this.respawnOpacity = 0;
  this.deathExplosionParticles = [];
  
  // Reset game state but preserve highest wave and score tracking
  this.score = 0;
  this.wave = 0;
  this.difficultyLevel = 0;
  this.enemiesPassedThrough = 0;
  this.initializeLifeLines();
  this.enemies = [];
  this.bullets = [];
  this.bosses = [];
  this.friendlyShips = [];
  this.enemySpawnTimer = 0;
  this.bulletSpawnTimer = 0;
  this.waveTimer = 0;
  this.bossSpawnTimer = 0;
  
  // Reset aim pointer tracking
  this.aimPointerId = null;

  // Reinitialize warden
  this.initWarden();
  this.applyRingColors();
  if (this.warden) {
    this.warden.health = this.warden.maxHealth;
  }
  
  // Notify callbacks
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
 * Update respawn animation (Cardinal Warden fading in).
 */
export function updateRespawnAnimation(deltaTime) {
  this.respawnAnimTimer += deltaTime;
  
  // Fade in over 1.5 seconds
  const fadeDuration = 1500;
  this.respawnOpacity = Math.min(1, this.respawnAnimTimer / fadeDuration);
  
  // Update warden animation even during respawn
  if (this.warden) {
    this.warden.update(deltaTime);
  }
  
  // After fade in complete, resume playing
  if (this.respawnAnimTimer >= fadeDuration + 500) {
    this.gamePhase = 'playing';
    this.respawnOpacity = 1;
  }
}

// ---------------------------------------------------------------------------
// Enemy spawning
// ---------------------------------------------------------------------------

/**
 * Get current enemy spawn interval based on difficulty.
 */
export function getEnemySpawnInterval() {
  const reduction = this.difficultyLevel * 100;
  return Math.max(500, this.baseEnemySpawnInterval - reduction);
}

/**
 * Spawn an enemy based on current difficulty.
 */
export function spawnEnemy() {
  if (!this.canvas) return;

  // Determine enemy type based on difficulty
  const typePool = getEnemyTypePool.call(this);
  const typeKey = typePool[this.rng.int(0, typePool.length - 1)];
  const baseConfig = ENEMY_TYPES[typeKey];

  // Scale stats by difficulty
  const difficultyMultiplier = 1 + this.difficultyLevel * 0.15;
  
  // Additive HP scaling: each wave adds 10% more HP (1.1x, 1.2x, 1.3x... 2x at wave 10, etc.)
  const waveMultiplier = 1 + (this.wave * 0.1);
  
  // Determine if this ship should weave (30% chance for fast/elite types)
  const canWeave = typeKey === 'fast' || typeKey === 'elite';
  const shouldWeave = canWeave && this.rng.next() < 0.3;
  
  const config = {
    ...baseConfig,
    speed: baseConfig.speed * (1 + this.difficultyLevel * 0.1),
    health: Math.ceil(baseConfig.health * waveMultiplier),
    damage: Math.ceil(baseConfig.damage * (1 + this.difficultyLevel * 0.05)),
    scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
    type: typeKey,
    acceleration: baseConfig.speed * 1.5, // Acceleration scales with speed
    weaving: shouldWeave,
    waveAmplitude: shouldWeave ? this.rng.range(20, 50) : 0,
    waveFrequency: shouldWeave ? this.rng.range(0.5, 2) : 0,
    wavePhase: shouldWeave ? this.rng.range(0, Math.PI * 2) : 0,
  };

  // Random x position at top of screen
  const x = this.rng.range(config.size, this.canvas.width - config.size);
  const y = -config.size;

  if (typeKey === 'ricochet') {
    config.initialHeading = this.rng.next() < 0.5 ? Math.PI / 4 : (3 * Math.PI) / 4;
  }

  const ship = typeKey === 'ricochet' ? new RicochetSkimmer(x, y, config) : new EnemyShip(x, y, config);
  ship.color = this.nightMode ? '#ffffff' : ship.baseColor;
  // Set initial target lower on screen for standard ships
  if (ship instanceof EnemyShip && !(ship instanceof RicochetSkimmer)) {
    ship.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
  }
  this.enemies.push(ship);
}

/**
 * Get pool of enemy types available at current difficulty.
 */
export function getEnemyTypePool() {
  const pool = ['basic'];
  if (this.difficultyLevel >= 1) pool.push('fast');
  if (this.difficultyLevel >= 2) pool.push('tank');
  if (this.difficultyLevel >= 3) pool.push('ricochet');
  if (this.difficultyLevel >= 4) pool.push('elite');
  if (this.difficultyLevel >= 5) pool.push('advanced');
  return pool;
}

// ---------------------------------------------------------------------------
// Boss spawning
// ---------------------------------------------------------------------------

/**
 * Get boss spawn interval based on difficulty.
 * Higher difficulty = more frequent boss spawns.
 */
export function getBossSpawnInterval() {
  const reduction = Math.min(
    this.difficultyLevel * GAME_CONFIG.BOSS_SPAWN_INTERVAL_REDUCTION_PER_LEVEL,
    GAME_CONFIG.BOSS_SPAWN_INTERVAL_MAX_REDUCTION
  );
  return Math.max(GAME_CONFIG.BOSS_SPAWN_INTERVAL_MIN, this.baseBossSpawnInterval - reduction);
}

/**
 * Get pool of boss types available at current difficulty.
 */
export function getBossTypePool() {
  const pool = [];
  // Circle Carrier available at minimum boss difficulty
  if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY) pool.push('circleCarrier');
  // Pyramid Boss available at difficulty 5+
  if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY + 2) pool.push('pyramidBoss');
  // Hexagon Fortress available at difficulty 7+
  if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY + 4) pool.push('hexagonFortress');
  return pool.length > 0 ? pool : ['circleCarrier'];
}

/**
 * Spawn a boss ship based on current difficulty.
 */
export function spawnBoss(waveNumber = this.wave + 1) {
  if (!this.canvas) return;

  const typePool = getBossTypePool.call(this);
  const typeKey = typePool[this.rng.int(0, typePool.length - 1)];
  const baseConfig = BOSS_TYPES[typeKey];

  // Scale boss stats by difficulty
  const difficultyMultiplier = 1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * GAME_CONFIG.BOSS_DIFFICULTY_SCALE;

  // Multiply base health by wave number (wave is 0-indexed, so wave+1)
  const waveMultiplier = this.wave + 1;

  const config = {
    ...baseConfig,
    speed: baseConfig.speed * (1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * 0.05),
    health: Math.ceil(baseConfig.health * waveMultiplier),
    damage: Math.ceil(baseConfig.damage * difficultyMultiplier),
    scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
  };

  // Random x position at top of screen
  const x = this.rng.range(config.size * 2, this.canvas.width - config.size * 2);
  const y = -config.size;

  let boss;
  switch (typeKey) {
    case 'circleCarrier':
      boss = new CircleCarrierBoss(x, y, config);
      break;
    case 'pyramidBoss':
      boss = new PyramidBoss(x, y, config);
      break;
    case 'hexagonFortress':
      boss = new HexagonFortressBoss(x, y, config);
      break;
    case 'megaBoss':
      boss = new MegaBoss(x, y, config);
      break;
    case 'ultraBoss':
      boss = new UltraBoss(x, y, config);
      break;
    default:
      boss = new CircleCarrierBoss(x, y, config);
  }

  boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
  // Attach wave-based sprite selection so boss visuals match the uploaded Shin sequence.
  const spriteSelection = resolveBossSpriteForWave(waveNumber);
  boss.spriteIndex = spriteSelection.index;
  boss.invertSpriteColors = spriteSelection.invert;
  boss.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
  this.bosses.push(boss);
}

/**
 * Handle wave-based boss spawning rules.
 * Called when a new wave starts.
 */
export function handleWaveBossSpawns() {
  const waveNumber = this.wave + 1; // Convert from 0-indexed to 1-indexed

  // Spawn exactly one milestone boss every 10 waves to match Shin boss cadence.
  if (waveNumber % 10 === 0) {
    spawnBoss.call(this, waveNumber);
  }
}

/**
 * Spawn a specific boss type.
 */
export function spawnSpecificBoss(bossType) {
  if (!this.canvas) return;

  const baseConfig = BOSS_TYPES[bossType];
  if (!baseConfig) {
    console.warn(`Unknown boss type: ${bossType}`);
    return;
  }

  // Scale boss stats by difficulty
  const difficultyMultiplier = 1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * GAME_CONFIG.BOSS_DIFFICULTY_SCALE;

  // Multiply base health by wave number
  const waveMultiplier = this.wave + 1;

  const config = {
    ...baseConfig,
    speed: baseConfig.speed * (1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * 0.05),
    health: Math.ceil(baseConfig.health * waveMultiplier),
    damage: Math.ceil(baseConfig.damage * difficultyMultiplier),
    scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
  };

  // Random x position at top of screen
  const x = this.rng.range(config.size * 2, this.canvas.width - config.size * 2);
  const y = -config.size;

  let boss;
  switch (bossType) {
    case 'circleCarrier':
      boss = new CircleCarrierBoss(x, y, config);
      break;
    case 'pyramidBoss':
      boss = new PyramidBoss(x, y, config);
      break;
    case 'hexagonFortress':
      boss = new HexagonFortressBoss(x, y, config);
      break;
    case 'megaBoss':
      boss = new MegaBoss(x, y, config);
      break;
    case 'ultraBoss':
      boss = new UltraBoss(x, y, config);
      break;
    default:
      boss = new CircleCarrierBoss(x, y, config);
  }

  boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
  boss.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
  this.bosses.push(boss);
}

// ---------------------------------------------------------------------------
// Boss / enemy update
// ---------------------------------------------------------------------------

/**
 * Update all boss ships.
 */
export function updateBosses(deltaTime) {
  if (!this.canvas) return;

  const bottomY = this.canvas.height + 20;
  const toRemove = [];

  for (let i = 0; i < this.bosses.length; i++) {
    const boss = this.bosses[i];
    const result = boss.update(deltaTime, bottomY, this.canvas.width, this.canvas.height, this.rng);

    // Handle different return types
    let passedThrough = false;
    let newShips = [];

    if (typeof result === 'object' && result !== null) {
      passedThrough = result.passedThrough;
      newShips = result.newShips || [];
    } else {
      passedThrough = result;
    }

    // Spawn ships from Circle Carrier bosses
    for (const spawnData of newShips) {
      spawnShipFromBoss.call(this, spawnData, boss);
    }

    if (passedThrough) {
      this.enemiesPassedThrough += 2; // Bosses count as 2 ships passing through
      this.updateLifeLine(2); // Consume 2 lives for bosses
      toRemove.push(i);
      // Bosses deal more damage when passing through
      if (this.warden) {
        this.warden.takeDamage(boss.damage);
        if (this.onHealthChange) {
          this.onHealthChange(this.warden.health, this.warden.maxHealth);
        }
      }
    }
  }

  // Remove passed bosses
  for (let i = toRemove.length - 1; i >= 0; i--) {
    this.bosses.splice(toRemove[i], 1);
  }
}

/**
 * Spawn a small ship from a boss (used by Circle Carrier).
 */
export function spawnShipFromBoss(spawnData, boss) {
  if (!this.canvas) return;

  // Create a small, fast ship that launches from the boss position
  const config = {
    speed: 60 + this.difficultyLevel * 5,
    health: 1,
    damage: 3,
    size: 6,
    scoreValue: 5,
    color: '#555',
    type: 'spawned',
    acceleration: 100,
    weaving: false,
  };

  const ship = new EnemyShip(spawnData.x, spawnData.y, config);
  // Randomize between the two boss minion sprites for variety in spawned ships.
  const minionSpriteOffset = this.rng.int(0, SHIN_BOSS_MINION_SPRITE_URLS.length - 1);
  ship.spriteLevel = ENEMY_SHIP_SPRITES.length + minionSpriteOffset + 1;
  ship.color = this.nightMode ? '#ffffff' : ship.baseColor;

  // Give the spawned ship initial velocity in the spawn direction
  const launchSpeed = 40;
  ship.vx = Math.cos(spawnData.angle) * launchSpeed;
  ship.vy = Math.sin(spawnData.angle) * launchSpeed;

  // Set target further down
  ship.targetX = spawnData.x + Math.cos(spawnData.angle) * 100;
  ship.targetY = spawnData.y + Math.sin(spawnData.angle) * 100 + 150;

  this.enemies.push(ship);
}

/**
 * Update all enemies.
 */
export function updateEnemies(deltaTime) {
  if (!this.canvas) return;

  const bottomY = this.canvas.height + 20;
  const toRemove = [];

  for (let i = 0; i < this.enemies.length; i++) {
    const enemy = this.enemies[i];
    const passedThrough = enemy.update(deltaTime, bottomY, this.canvas.width, this.canvas.height, this.rng);

    if (passedThrough) {
      this.enemiesPassedThrough++;
      this.updateLifeLine();
      toRemove.push(i);
      // Enemies passing through also deal damage to warden
      if (this.warden) {
        this.warden.takeDamage(enemy.damage);
        if (this.onHealthChange) {
          this.onHealthChange(this.warden.health, this.warden.maxHealth);
        }
      }
    }
  }

  // Remove passed enemies (reverse order to maintain indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    this.enemies.splice(toRemove[i], 1);
  }
}
