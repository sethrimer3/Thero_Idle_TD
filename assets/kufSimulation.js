/**
 * Kuf Spire Battlefield Simulation
 *
 * Drives the lightweight RTS-style encounter used to resolve Kuf Spire runs.
 * Marines advance north toward entrenched turrets, trading projectiles until
 * either side is defeated.
 */

const MARINE_MOVE_SPEED = 70; // Pixels per second.
const MARINE_RANGE = 160; // Attack range in pixels.
const MARINE_RADIUS = 18;
const TURRET_RADIUS = 12;
const TURRET_RANGE = 200;
const MARINE_BULLET_SPEED = 360;
const TURRET_BULLET_SPEED = 280;
const TRAIL_ALPHA = 0.22;

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
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
    this.bounds = { width: this.canvas?.width || 640, height: this.canvas?.height || 360 };
    this.pixelRatio = 1;
    this.step = this.step.bind(this);
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
    const width = parent.clientWidth || 640;
    const height = Math.max(320, Math.min(width * 0.65, 560));
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
   * Begin a new simulation with the provided marine stats.
   * @param {KufSimulationConfig} config - Simulation setup payload.
   */
  start(config) {
    if (!this.ctx) {
      return;
    }
    this.reset();
    const marineStats = config?.marineStats || { health: 10, attack: 1, attackSpeed: 1 };
    const spawnY = this.bounds.height - 48;
    const spawnX = this.bounds.width / 2;
    const marine = {
      x: spawnX,
      y: spawnY,
      radius: MARINE_RADIUS,
      health: marineStats.health,
      maxHealth: marineStats.health,
      attack: marineStats.attack,
      attackSpeed: Math.max(0.1, marineStats.attackSpeed),
      cooldown: 0,
      moveSpeed: MARINE_MOVE_SPEED,
    };
    this.marines.push(marine);
    this.buildTurrets();
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
  }

  reset() {
    this.marines = [];
    this.turrets = [];
    this.bullets = [];
    this.goldEarned = 0;
    this.destroyedTurrets = 0;
    this.drawBackground(true);
  }

  buildTurrets() {
    const lanes = [
      { x: this.bounds.width * 0.35, y: this.bounds.height * 0.65 },
      { x: this.bounds.width * 0.65, y: this.bounds.height * 0.5 },
      { x: this.bounds.width * 0.5, y: this.bounds.height * 0.3 },
    ];
    lanes.forEach((lane) => {
      this.turrets.push({
        x: lane.x,
        y: lane.y,
        radius: TURRET_RADIUS,
        health: 5,
        maxHealth: 5,
        attack: 1,
        attackSpeed: 1,
        cooldown: 0,
        range: TURRET_RANGE,
      });
    });
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
    this.checkVictoryConditions();
  }

  updateMarines(delta) {
    this.marines.forEach((marine) => {
      marine.y -= marine.moveSpeed * delta;
      marine.cooldown = Math.max(0, marine.cooldown - delta);
      const target = this.findClosestTurret(marine.x, marine.y, MARINE_RANGE);
      if (target && marine.cooldown <= 0) {
        this.spawnBullet({
          owner: 'marine',
          x: marine.x,
          y: marine.y - marine.radius,
          target,
          speed: MARINE_BULLET_SPEED,
          damage: marine.attack,
        });
        marine.cooldown = 1 / marine.attackSpeed;
      }
    });
    this.marines = this.marines.filter((marine) => marine.health > 0 && marine.y + marine.radius > -40);
  }

  updateTurrets(delta) {
    this.turrets.forEach((turret) => {
      turret.cooldown = Math.max(0, turret.cooldown - delta);
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
    });
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  updateBullets(delta) {
    this.bullets.forEach((bullet) => {
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

  spawnBullet({ owner, x, y, target, speed, damage }) {
    const angle = Math.atan2(target.y - y, target.x - x);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.bullets.push({
      owner,
      x,
      y,
      vx,
      vy,
      damage,
      life: 2.5,
    });
  }

  findClosestTurret(x, y, range) {
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
    this.drawBase();
    this.drawTurrets();
    this.drawMarines();
    this.drawBullets();
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
      ctx.shadowBlur = 24;
      ctx.shadowColor = 'rgba(66, 224, 255, 0.8)';
      ctx.fillStyle = 'rgba(140, 255, 255, 0.9)';
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
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255, 110, 170, 0.8)';
      ctx.fillStyle = 'rgba(255, 150, 210, 0.7)';
      ctx.beginPath();
      ctx.arc(turret.x, turret.y, turret.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, ${80 + healthRatio * 120}, 200, 0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  }

  drawBullets() {
    const ctx = this.ctx;
    this.bullets.forEach((bullet) => {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = bullet.owner === 'marine' ? 'rgba(120, 255, 255, 0.9)' : 'rgba(255, 120, 170, 0.9)';
      ctx.fillStyle = bullet.owner === 'marine' ? 'rgba(120, 255, 255, 0.95)' : 'rgba(255, 120, 170, 0.95)';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawHud() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(170, 220, 255, 0.92)';
    ctx.font = '600 16px "Space Mono", monospace';
    ctx.fillText(`Gold: ${this.goldEarned}`, 20, this.bounds.height - 24);
    ctx.fillText(`Turrets: ${this.destroyedTurrets}/3`, 20, this.bounds.height - 48);
    ctx.restore();
  }
}
