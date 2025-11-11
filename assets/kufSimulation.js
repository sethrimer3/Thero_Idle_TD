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
const TRAIL_ALPHA = 0.22;
const CAMERA_PAN_SPEED = 1.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

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
  constructor({ canvas, onComplete } = {}) {
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
    const aspectRatio = 640 / 400;
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
    
    const spawnY = this.bounds.height - 48;
    const centerX = this.bounds.width / 2;
    
    // Spawn all purchased marines
    for (let i = 0; i < units.marines; i++) {
      const offsetX = (i - (units.marines - 1) / 2) * 40;
      this.marines.push({
        type: 'marine',
        x: centerX + offsetX,
        y: spawnY,
        vx: 0,
        vy: 0,
        radius: MARINE_RADIUS,
        health: marineStats.health,
        maxHealth: marineStats.health,
        attack: marineStats.attack,
        attackSpeed: Math.max(0.1, marineStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        moveSpeed: MARINE_MOVE_SPEED,
        range: MARINE_RANGE,
      });
    }
    
    // Spawn all purchased snipers
    for (let i = 0; i < units.snipers; i++) {
      const offsetX = (i - (units.snipers - 1) / 2) * 40;
      this.marines.push({
        type: 'sniper',
        x: centerX + offsetX,
        y: spawnY + 30,
        vx: 0,
        vy: 0,
        radius: SNIPER_RADIUS,
        health: sniperStats.health,
        maxHealth: sniperStats.health,
        attack: sniperStats.attack,
        attackSpeed: Math.max(0.1, sniperStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        moveSpeed: MARINE_MOVE_SPEED * 0.8,
        range: SNIPER_RANGE,
      });
    }
    
    // Spawn all purchased splayers
    for (let i = 0; i < units.splayers; i++) {
      const offsetX = (i - (units.splayers - 1) / 2) * 40;
      this.marines.push({
        type: 'splayer',
        x: centerX + offsetX,
        y: spawnY + 60,
        vx: 0,
        vy: 0,
        radius: SPLAYER_RADIUS,
        health: splayerStats.health,
        maxHealth: splayerStats.health,
        attack: splayerStats.attack,
        attackSpeed: Math.max(0.1, splayerStats.attackSpeed),
        cooldown: Math.random() * 0.5,
        moveSpeed: MARINE_MOVE_SPEED * 0.9,
        range: SPLAYER_RANGE,
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
    // Sample map configuration - player spawns at (0,0)
    // This places small turrets north of the player
    const mapConfig = [
      { type: 'small_turret', gridX: 0, gridY: 10, level: 1 },
      { type: 'small_turret', gridX: 2, gridY: 11, level: 1 },
      { type: 'small_turret', gridX: -2, gridY: 12, level: 1 },
      { type: 'big_turret', gridX: 0, gridY: 15, level: 2 },
      { type: 'wall', gridX: -3, gridY: 8, level: 1 },
      { type: 'wall', gridX: 3, gridY: 8, level: 1 },
      { type: 'mine', gridX: 1, gridY: 7, level: 1 },
      { type: 'mine', gridX: -1, gridY: 7, level: 1 },
      { type: 'melee_unit', gridX: -1, gridY: 13, level: 1 },
      { type: 'ranged_unit', gridX: 1, gridY: 13, level: 1 },
      { type: 'melee_barracks', gridX: -4, gridY: 14, level: 1 },
      { type: 'ranged_barracks', gridX: 4, gridY: 14, level: 1 },
    ];

    mapConfig.forEach((enemy) => {
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
          extra: {},
        };
      case 'big_turret':
        return {
          radius: BIG_TURRET_RADIUS,
          health: 20,
          attack: 3,
          attackSpeed: 0.8,
          range: BIG_TURRET_RANGE,
          extra: {},
        };
      case 'wall':
        return {
          radius: WALL_RADIUS,
          health: 50,
          attack: 0,
          attackSpeed: 0,
          range: 0,
          extra: { isWall: true },
        };
      case 'mine':
        return {
          radius: MINE_RADIUS,
          health: 1,
          attack: 5,
          attackSpeed: 0,
          range: 0,
          extra: { isMine: true, explosionRadius: MINE_EXPLOSION_RADIUS },
        };
      case 'melee_unit':
        return {
          radius: MELEE_UNIT_RADIUS,
          health: 8,
          attack: 2,
          attackSpeed: 1.2,
          range: MELEE_UNIT_RANGE,
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
    this.update(dt / 1000);
    this.render();
    if (this.active) {
      requestAnimationFrame(this.step);
    }
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

      // Handle barracks spawning
      if (turret.isBarracks) {
        turret.spawnTimer -= delta;
        if (turret.spawnTimer <= 0 && turret.currentSpawns < turret.maxSpawns) {
          const nearbyMarine = this.findClosestMarine(turret.x, turret.y, turret.spawnRange);
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

      // Handle mobile units
      if (turret.isMobile) {
        const nearbyMarine = this.findClosestMarine(turret.x, turret.y, turret.sightRange);
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
              this.spawnBullet({
                owner: 'turret',
                x: turret.x,
                y: turret.y,
                target: nearbyMarine,
                speed: TURRET_BULLET_SPEED,
                damage: turret.attack,
              });
              turret.cooldown = 1 / turret.attackSpeed;
            }
          }
        }
        return;
      }

      // Handle stationary turrets
      if (turret.attack > 0 && !turret.isWall && !turret.isMine) {
        const target = this.findClosestMarine(turret.x, turret.y, turret.range);
        if (target && turret.cooldown <= 0) {
          this.spawnBullet({
            owner: 'turret',
            x: turret.x,
            y: turret.y + turret.radius,
            target,
            speed: TURRET_BULLET_SPEED,
            damage: turret.attack,
          });
          turret.cooldown = 1 / turret.attackSpeed;
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
            this.goldEarned += 5;
            this.destroyedTurrets += 1;
          }
        }
      } else {
        const hit = this.findHit(this.marines, bullet);
        if (hit && hit.health > 0) {
          hit.health -= bullet.damage;
          bullet.life = 0;
        }
      }
    });
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0 && this.isOnscreen(bullet));
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  spawnBullet({ owner, type, x, y, target, speed, damage, homing = false }) {
    const angle = Math.atan2(target.y - y, target.x - x);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
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
    });
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
    const margin = 40;
    return (
      bullet.x > -margin &&
      bullet.y > -margin &&
      bullet.x < this.bounds.width + margin &&
      bullet.y < this.bounds.height + margin
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
      });
    }
  }

  drawBackground(force = false) {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    if (force) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#050715';
      ctx.fillRect(0, 0, this.bounds.width, this.bounds.height);
      this.drawTrianglePattern();
    } else {
      ctx.globalAlpha = TRAIL_ALPHA;
      ctx.fillStyle = 'rgba(5, 7, 21, 0.6)';
      ctx.fillRect(0, 0, this.bounds.width, this.bounds.height);
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
    
    this.drawBase();
    this.drawTurrets();
    this.drawMarines();
    this.drawBullets();
    this.drawExplosions();
    this.drawHealthBars();
    this.drawLevelIndicators();
    this.drawSelectedEnemyBox();
    
    ctx.restore();
    
    // Draw HUD without camera transform
    this.drawHud();
  }

  drawBase() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(120, 150, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(30, 40, 90, 0)');
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.bounds.width, 120);
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(this.bounds.width, 110);
    ctx.stroke();
    ctx.restore();
  }

  drawMarines() {
    const ctx = this.ctx;
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
      
      ctx.shadowBlur = 24;
      ctx.shadowColor = shadowColor;
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(marine.x, marine.y, marine.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
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
    this.turrets.forEach((turret) => {
      const healthRatio = Math.max(0, turret.health / turret.maxHealth);
      ctx.save();

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
      } else if (turret.type === 'big_turret') {
        mainColor = 'rgba(255, 100, 150, 0.8)';
        shadowColor = 'rgba(255, 80, 130, 0.8)';
        strokeColor = `rgba(255, ${60 + healthRatio * 140}, ${150 + healthRatio * 80}, 0.9)`;
      } else {
        mainColor = 'rgba(255, 150, 210, 0.7)';
        shadowColor = 'rgba(255, 110, 170, 0.8)';
        strokeColor = `rgba(255, ${80 + healthRatio * 120}, 200, 0.9)`;
      }

      ctx.shadowBlur = 18;
      ctx.shadowColor = shadowColor;
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(turret.x, turret.y, turret.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = turret.type === 'big_turret' ? 3 : 2;
      ctx.stroke();
      
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
        color = 'rgba(255, 120, 170, 0.95)';
        shadowColor = 'rgba(255, 120, 170, 0.9)';
        size = 5;
      }
      
      ctx.shadowBlur = 16;
      ctx.shadowColor = shadowColor;
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
    ctx.fillText(`Gold: ${this.goldEarned}`, 20, this.bounds.height - 24);
    ctx.fillText(`Enemies: ${this.turrets.length}`, 20, this.bounds.height - 48);
    ctx.restore();
  }
}
