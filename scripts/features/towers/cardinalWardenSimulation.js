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
 */

/**
 * Game configuration constants.
 */
const GAME_CONFIG = {
  // Maximum enemies that can pass through before game over
  MAX_ENEMIES_PASSED: 10,
  // Cardinal Warden maximum health
  WARDEN_MAX_HEALTH: 100,
  // Time per wave in milliseconds
  WAVE_DURATION_MS: 15000,
  // Base time between enemy spawns in milliseconds
  BASE_ENEMY_SPAWN_INTERVAL_MS: 2000,
  // Base time between bullet volleys in milliseconds
  BASE_BULLET_INTERVAL_MS: 500,
  // Maximum delta time cap to prevent physics issues (ms)
  MAX_DELTA_TIME_MS: 33,
};

/**
 * Simple seeded random number generator for consistent enemy patterns.
 */
class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

/**
 * Represents a single rotating square in the Cardinal Warden formation.
 */
class OrbitalSquare {
  constructor(index, totalSquares, orbitRadius, rng) {
    this.index = index;
    this.totalSquares = totalSquares;
    this.orbitRadius = orbitRadius;
    this.baseAngle = (index / totalSquares) * Math.PI * 2;
    // Use seeded random for deterministic patterns
    this.rotationSpeed = 0.5 + rng.next() * 1.5;
    this.rotationDirection = rng.next() > 0.5 ? 1 : -1;
    this.selfRotation = 0;
    this.selfRotationSpeed = 1 + rng.next() * 2;
    this.size = 8 + rng.next() * 6;
    this.orbitSpeed = 0.3 + rng.next() * 0.4;
    this.orbitOffset = 0;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.selfRotation += this.selfRotationSpeed * this.rotationDirection * dt;
    this.orbitOffset += this.orbitSpeed * dt;
  }

  getPosition(centerX, centerY) {
    const angle = this.baseAngle + this.orbitOffset;
    return {
      x: centerX + Math.cos(angle) * this.orbitRadius,
      y: centerY + Math.sin(angle) * this.orbitRadius,
    };
  }
}

/**
 * Represents the Cardinal Warden - the player's boss entity.
 */
class CardinalWarden {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.health = 100;
    this.maxHealth = 100;
    this.coreRadius = 16;
    this.orbitalSquares = [];
    this.rng = rng;
    this.initOrbitalSquares();
  }

  initOrbitalSquares() {
    this.orbitalSquares = [];
    const squareCount = 8;
    const orbitRadius = 35;
    for (let i = 0; i < squareCount; i++) {
      this.orbitalSquares.push(new OrbitalSquare(i, squareCount, orbitRadius, this.rng));
    }
  }

  update(deltaTime) {
    for (const square of this.orbitalSquares) {
      square.update(deltaTime);
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  reset() {
    this.health = this.maxHealth;
    this.initOrbitalSquares();
  }
}

/**
 * Represents an enemy ship attacking the Cardinal Warden.
 */
class EnemyShip {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.speed = config.speed || 50;
    this.health = config.health || 1;
    this.maxHealth = this.health;
    this.damage = config.damage || 1;
    this.size = config.size || 8;
    this.type = config.type || 'basic';
    this.scoreValue = config.scoreValue || 10;
    this.color = config.color || '#333';
  }

  update(deltaTime, targetY) {
    const dt = deltaTime / 1000;
    this.y += this.speed * dt;
    return this.y > targetY;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
}

/**
 * Represents a bullet fired by the Cardinal Warden.
 */
class Bullet {
  constructor(x, y, angle, config = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = config.speed || 200;
    this.damage = config.damage || 1;
    this.size = config.size || 4;
    this.color = config.color || '#d4af37';
    this.piercing = config.piercing || false;
    this.hitEnemies = new Set();
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }

  isOffscreen(width, height) {
    return this.x < -this.size || this.x > width + this.size ||
           this.y < -this.size || this.y > height + this.size;
  }
}

/**
 * Enemy type configurations for different difficulty tiers.
 */
const ENEMY_TYPES = {
  basic: {
    speed: 40,
    health: 1,
    damage: 5,
    size: 8,
    scoreValue: 10,
    color: '#666',
  },
  fast: {
    speed: 80,
    health: 1,
    damage: 3,
    size: 6,
    scoreValue: 15,
    color: '#888',
  },
  tank: {
    speed: 25,
    health: 3,
    damage: 10,
    size: 12,
    scoreValue: 25,
    color: '#444',
  },
  elite: {
    speed: 50,
    health: 5,
    damage: 15,
    size: 10,
    scoreValue: 50,
    color: '#222',
  },
};

/**
 * Main Cardinal Warden reverse danmaku simulation.
 */
export class CardinalWardenSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style - pure white background, minimalist
    this.bgColor = '#ffffff';
    this.wardenCoreColor = '#d4af37'; // Golden
    this.wardenSquareColor = '#c9a227'; // Slightly darker gold
    this.bulletColor = '#d4af37';

    // Game state
    this.running = false;
    this.paused = false;
    this.score = 0;
    this.highScore = options.highScore || 0;
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.maxEnemiesPassedThrough = GAME_CONFIG.MAX_ENEMIES_PASSED;
    this.damageThreshold = GAME_CONFIG.WARDEN_MAX_HEALTH;

    // Game objects
    this.warden = null;
    this.enemies = [];
    this.bullets = [];

    // Timing
    this.lastFrameTime = 0;
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.waveDuration = GAME_CONFIG.WAVE_DURATION_MS;

    // Spawn rates (adjusted by difficulty)
    this.baseEnemySpawnInterval = GAME_CONFIG.BASE_ENEMY_SPAWN_INTERVAL_MS;
    this.baseBulletInterval = GAME_CONFIG.BASE_BULLET_INTERVAL_MS;

    // RNG
    this.rng = new SeededRandom(options.seed || Date.now());

    // Callbacks
    this.onScoreChange = options.onScoreChange || null;
    this.onHighScoreChange = options.onHighScoreChange || null;
    this.onWaveChange = options.onWaveChange || null;
    this.onGameOver = options.onGameOver || null;
    this.onHealthChange = options.onHealthChange || null;

    // Upgrade state (for future expansion)
    this.upgrades = {
      bulletDamage: 1,
      bulletSpeed: 1,
      bulletCount: 1,
      fireRate: 1,
      patterns: ['radial'], // Unlocked patterns
    };

    // Animation frame handle
    this.animationFrameId = null;

    this.initialize();
  }

  initialize() {
    if (!this.canvas) return;
    this.initWarden();
  }

  initWarden() {
    if (!this.canvas) return;
    // Position warden in lower third of canvas (boss position in danmaku)
    const x = this.canvas.width / 2;
    const y = this.canvas.height * 0.75;
    this.warden = new CardinalWarden(x, y, this.rng);
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
   * Reset the game to initial state.
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
    this.enemies = [];
    this.bullets = [];
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;

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
      this.update(deltaTime);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update game state.
   */
  update(deltaTime) {
    // Update wave timer
    this.waveTimer += deltaTime;
    if (this.waveTimer >= this.waveDuration) {
      this.waveTimer = 0;
      this.wave++;
      this.difficultyLevel = Math.floor(this.wave / 3);
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

    // Fire bullets
    this.bulletSpawnTimer += deltaTime;
    const bulletInterval = this.getBulletInterval();
    if (this.bulletSpawnTimer >= bulletInterval) {
      this.bulletSpawnTimer = 0;
      this.fireBullets();
    }

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update bullets
    this.updateBullets(deltaTime);

    // Check collisions
    this.checkCollisions();

    // Check game over conditions
    this.checkGameOver();
  }

  /**
   * Get current enemy spawn interval based on difficulty.
   */
  getEnemySpawnInterval() {
    const reduction = this.difficultyLevel * 100;
    return Math.max(500, this.baseEnemySpawnInterval - reduction);
  }

  /**
   * Get current bullet interval based on upgrades.
   */
  getBulletInterval() {
    return Math.max(100, this.baseBulletInterval / this.upgrades.fireRate);
  }

  /**
   * Spawn an enemy based on current difficulty.
   */
  spawnEnemy() {
    if (!this.canvas) return;

    // Determine enemy type based on difficulty
    const typePool = this.getEnemyTypePool();
    const typeKey = typePool[this.rng.int(0, typePool.length - 1)];
    const baseConfig = ENEMY_TYPES[typeKey];

    // Scale stats by difficulty
    const difficultyMultiplier = 1 + this.difficultyLevel * 0.15;
    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + this.difficultyLevel * 0.1),
      health: Math.ceil(baseConfig.health * difficultyMultiplier),
      damage: Math.ceil(baseConfig.damage * (1 + this.difficultyLevel * 0.05)),
      scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
      type: typeKey,
    };

    // Random x position at top of screen
    const x = this.rng.range(config.size, this.canvas.width - config.size);
    const y = -config.size;

    this.enemies.push(new EnemyShip(x, y, config));
  }

  /**
   * Get pool of enemy types available at current difficulty.
   */
  getEnemyTypePool() {
    const pool = ['basic'];
    if (this.difficultyLevel >= 1) pool.push('fast');
    if (this.difficultyLevel >= 2) pool.push('tank');
    if (this.difficultyLevel >= 4) pool.push('elite');
    return pool;
  }

  /**
   * Fire bullets from the Cardinal Warden.
   */
  fireBullets() {
    if (!this.warden || !this.canvas) return;

    const bulletConfig = {
      speed: 200 * this.upgrades.bulletSpeed,
      damage: this.upgrades.bulletDamage,
      size: 4,
      color: this.bulletColor,
    };

    // Fire based on current pattern
    const pattern = this.upgrades.patterns[0] || 'radial';
    this.firePattern(pattern, bulletConfig);
  }

  /**
   * Fire bullets in a specific pattern.
   */
  firePattern(pattern, config) {
    const cx = this.warden.x;
    const cy = this.warden.y;
    const bulletCount = 4 + this.upgrades.bulletCount * 2;

    switch (pattern) {
      case 'radial': {
        // Fire in a circle pattern (spread around cardinal directions, mostly upward)
        for (let i = 0; i < bulletCount; i++) {
          const spread = Math.PI * 0.8; // 144 degrees spread (mostly upward)
          const baseAngle = -Math.PI / 2; // Pointing up
          const angleOffset = (i / (bulletCount - 1) - 0.5) * spread;
          const angle = baseAngle + angleOffset;
          this.bullets.push(new Bullet(cx, cy - 20, angle, config));
        }
        break;
      }
      case 'spiral': {
        // Spiral pattern
        const time = performance.now() / 1000;
        for (let i = 0; i < bulletCount; i++) {
          const angle = -Math.PI / 2 + (i / bulletCount) * Math.PI * 2 + time * 2;
          this.bullets.push(new Bullet(cx, cy - 20, angle, config));
        }
        break;
      }
      case 'focused': {
        // Focused burst toward top
        for (let i = 0; i < bulletCount; i++) {
          const spread = Math.PI * 0.3;
          const angle = -Math.PI / 2 + (this.rng.next() - 0.5) * spread;
          this.bullets.push(new Bullet(cx, cy - 20, angle, config));
        }
        break;
      }
      default: {
        // Default single shot
        this.bullets.push(new Bullet(cx, cy - 20, -Math.PI / 2, config));
      }
    }
  }

  /**
   * Update all enemies.
   */
  updateEnemies(deltaTime) {
    if (!this.canvas) return;

    const bottomY = this.canvas.height + 20;
    const toRemove = [];

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const passedThrough = enemy.update(deltaTime, bottomY);

      if (passedThrough) {
        this.enemiesPassedThrough++;
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

  /**
   * Update all bullets.
   */
  updateBullets(deltaTime) {
    if (!this.canvas) return;

    const toRemove = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.update(deltaTime);

      if (bullet.isOffscreen(this.canvas.width, this.canvas.height)) {
        toRemove.push(i);
      }
    }

    // Remove offscreen bullets
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bullets.splice(toRemove[i], 1);
    }
  }

  /**
   * Check collisions between bullets and enemies.
   */
  checkCollisions() {
    const bulletsToRemove = new Set();
    const enemiesToRemove = new Set();

    for (let bi = 0; bi < this.bullets.length; bi++) {
      const bullet = this.bullets[bi];
      if (bulletsToRemove.has(bi)) continue;

      for (let ei = 0; ei < this.enemies.length; ei++) {
        const enemy = this.enemies[ei];
        if (enemiesToRemove.has(ei)) continue;
        if (bullet.hitEnemies.has(ei)) continue;

        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const collisionDist = bullet.size + enemy.size;

        if (dist < collisionDist) {
          const killed = enemy.takeDamage(bullet.damage);

          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
          }

          if (bullet.piercing) {
            bullet.hitEnemies.add(ei);
          } else {
            bulletsToRemove.add(bi);
            break;
          }
        }
      }
    }

    // Remove destroyed entities
    const bulletIndices = Array.from(bulletsToRemove).sort((a, b) => b - a);
    for (const i of bulletIndices) {
      this.bullets.splice(i, 1);
    }

    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }
  }

  /**
   * Add score and notify listeners.
   */
  addScore(amount) {
    this.score += amount;
    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
  }

  /**
   * Check if game over conditions are met.
   */
  checkGameOver() {
    const gameOver = this.enemiesPassedThrough >= this.maxEnemiesPassedThrough ||
                     (this.warden && this.warden.health <= 0);

    if (gameOver) {
      if (this.onGameOver) {
        this.onGameOver({
          score: this.score,
          highScore: this.highScore,
          wave: this.wave,
          isNewHighScore: this.score > this.highScore,
        });
      }

      // Reset the game (difficulty restarts)
      this.reset();
    }
  }

  /**
   * Render the game.
   */
  render() {
    if (!this.ctx || !this.canvas) return;

    // Clear with white background
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Cardinal Warden
    this.renderWarden();

    // Draw enemies
    this.renderEnemies();

    // Draw bullets
    this.renderBullets();

    // Draw UI overlays
    this.renderUI();
  }

  /**
   * Render the Cardinal Warden.
   */
  renderWarden() {
    if (!this.warden || !this.ctx) return;

    const ctx = this.ctx;
    const warden = this.warden;

    // Draw orbital squares
    ctx.fillStyle = this.wardenSquareColor;
    for (const square of warden.orbitalSquares) {
      const pos = square.getPosition(warden.x, warden.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(square.selfRotation);

      const halfSize = square.size / 2;
      ctx.fillRect(-halfSize, -halfSize, square.size, square.size);

      ctx.restore();
    }

    // Draw core orb
    ctx.beginPath();
    ctx.arc(warden.x, warden.y, warden.coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.wardenCoreColor;
    ctx.fill();

    // Draw inner highlight
    ctx.beginPath();
    ctx.arc(warden.x - 4, warden.y - 4, warden.coreRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
  }

  /**
   * Render all enemies.
   */
  renderEnemies() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    for (const enemy of this.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Draw enemy ship as a simple triangle pointing down
      ctx.beginPath();
      ctx.moveTo(0, enemy.size);
      ctx.lineTo(-enemy.size * 0.7, -enemy.size * 0.5);
      ctx.lineTo(enemy.size * 0.7, -enemy.size * 0.5);
      ctx.closePath();

      ctx.fillStyle = enemy.color;
      ctx.fill();

      // Health bar for multi-hit enemies
      if (enemy.maxHealth > 1) {
        const healthPercent = enemy.health / enemy.maxHealth;
        const barWidth = enemy.size * 1.5;
        const barHeight = 2;
        const barY = -enemy.size - 4;

        ctx.fillStyle = '#ddd';
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        ctx.fillStyle = '#666';
        ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
      }

      ctx.restore();
    }
  }

  /**
   * Render all bullets.
   */
  renderBullets() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
      ctx.fillStyle = bullet.color;
      ctx.fill();
    }
  }

  /**
   * Render UI elements.
   */
  renderUI() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const padding = 10;

    // Set font for UI
    ctx.font = '14px "Cormorant Garamond", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Score display (top left)
    ctx.fillStyle = '#333';
    ctx.fillText(`Score: ${this.score}`, padding, padding);
    ctx.fillText(`High Score: ${this.highScore}`, padding, padding + 18);

    // Wave display (top right)
    ctx.textAlign = 'right';
    ctx.fillText(`Wave: ${this.wave + 1}`, this.canvas.width - padding, padding);

    // Health bar (bottom center)
    if (this.warden) {
      const barWidth = 120;
      const barHeight = 8;
      const barX = (this.canvas.width - barWidth) / 2;
      const barY = this.canvas.height - padding - barHeight;
      const healthPercent = this.warden.health / this.warden.maxHealth;

      // Background
      ctx.fillStyle = '#eee';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Health
      ctx.fillStyle = this.wardenCoreColor;
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

      // Border
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Enemies passed through indicator (bottom left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#666';
    ctx.fillText(
      `Ships Passed: ${this.enemiesPassedThrough}/${this.maxEnemiesPassedThrough}`,
      padding,
      this.canvas.height - padding
    );
  }

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
      wave: this.wave,
      difficultyLevel: this.difficultyLevel,
      upgrades: { ...this.upgrades },
    };
  }

  /**
   * Restore game state.
   */
  setState(state) {
    if (state.highScore !== undefined) {
      this.highScore = state.highScore;
    }
    if (state.upgrades) {
      this.upgrades = { ...this.upgrades, ...state.upgrades };
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
}
