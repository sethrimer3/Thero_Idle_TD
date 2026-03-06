// Kuf Spire Battlefield Renderer
// All canvas draw methods extracted from KufBattlefieldSimulation (Phase 4.1.2, Build 505).
// Functions are called with .call(sim) so 'this' refers to the simulation instance.

import { TWO_PI, KUF_HUD_LAYOUT } from './kufSimulationConfig.js';

// Pre-calculated constant used only in rendering arcs.
const HALF_PI = Math.PI * 0.5;

// Sprite asset paths for the Kuf spire units.
const KUF_SPRITE_PATHS = {
  CORE_SHIP: './assets/sprites/spires/kufSpire/playerShips/coreShipLevel2.png',
  SPLAYER: './assets/sprites/spires/kufSpire/playerShips/splayer.png',
  ENEMY_BOSS: './assets/sprites/spires/kufSpire/enemyShips/enemyBoss1.png',
  BULLET: './assets/sprites/spires/kufSpire/bullets/bullet1.png',
};

// Module-level sprite cache shared across all simulation instances.
const KUF_SPRITE_CACHE = new Map();

// Load and cache a Kuf spire sprite image for canvas rendering.
function getKufSprite(spritePath) {
  if (!spritePath || typeof Image === 'undefined') {
    return null;
  }
  const cached = KUF_SPRITE_CACHE.get(spritePath);
  if (cached && cached.loaded && !cached.error) {
    return cached;
  }
  if (cached && cached.error) {
    return null;
  }
  if (cached) {
    return cached;
  }
  const image = new Image();
  const record = { image, loaded: false, error: false };
  image.addEventListener('load', () => {
    record.loaded = true;
  });
  image.addEventListener('error', () => {
    record.error = true;
  });
  image.src = spritePath;
  KUF_SPRITE_CACHE.set(spritePath, record);
  return record;
}

// Clear the canvas and optionally paint the triangle mosaic background.
export function drawBackground(force = false) {
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
    drawTrianglePattern.call(this);
  }
  ctx.restore();
}

// Paint the repeating triangle mosaic pattern over the background.
export function drawTrianglePattern() {
  const ctx = this.ctx;
  const size = 90;
  const halfSize = size * 0.5;
  const doubleSize = size * 2;
  for (let y = -size; y < this.bounds.height + size; y += size) {
    for (let x = -size; x < this.bounds.width + size; x += size) {
      ctx.fillStyle = y % doubleSize === 0 ? 'rgba(20, 30, 70, 0.35)' : 'rgba(10, 15, 40, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x + halfSize, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Composite render: background, camera-transformed world objects, then fixed HUD.
export function render() {
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
  this.drawDrones();
  this.drawBullets();
  this.drawExplosions();
  const skipOverlays = this.shouldSkipOverlays();
  if (!skipOverlays) {
    this.drawHealthBars();
    this.drawLevelIndicators();
    this.drawSelectedEnemyBox();
  }
  
  // Draw waypoint marker if set
  this.drawWaypointMarker();
  // Draw lines from units to their waypoints
  this.drawUnitWaypointLines();

  ctx.restore();

  // Draw selection box and HUD without camera transform
  this.drawSelectionBox();
  this.drawHud();
}

/**
 * Skip overlay-heavy layers intermittently when running in lightweight mode to save GPU/CPU time.
 * @returns {boolean} True when this frame should omit overlays.
 */
export function shouldSkipOverlays() {
  if (this.renderProfile === 'high') {
    return false;
  }
  this.overlaySkipCounter = (this.overlaySkipCounter + 1) % this.overlaySkipInterval;
  return this.overlaySkipCounter !== 0;
}

// Draw all player marines with type-specific colours and a selection ring when focused.
export function drawMarines() {
  const ctx = this.ctx;
  const glowsEnabled = this.glowOverlaysEnabled;
  this.marines.forEach((marine) => {
    const healthRatio = marine.health / marine.maxHealth;
    const isSelected = this.selectionMode === 'specific' && this.selectedUnits.includes(marine);
    ctx.save();
    
    // Draw selection indicator for selected units
    if (isSelected) {
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(marine.x, marine.y, marine.radius + 4, 0, TWO_PI);
      ctx.stroke();
      // Show the selected unit's firing range as a thin halo.
      ctx.strokeStyle = 'rgba(120, 255, 180, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(marine.x, marine.y, marine.range, 0, TWO_PI);
      ctx.stroke();
    }

    // Use the dedicated splayer sprite when available.
    const splayerSprite = marine.type === 'splayer' ? getKufSprite(KUF_SPRITE_PATHS.SPLAYER) : null;
    const useSplayerSprite = marine.type === 'splayer' && splayerSprite && splayerSprite.loaded;
    if (useSplayerSprite) {
      const spriteSize = marine.radius * 6;
      const halfSpriteSize = spriteSize * 0.5;
      const marineGlow = glowsEnabled ? (this.renderProfile === 'light' ? 10 : 24) : 0;
      ctx.save();
      ctx.translate(marine.x, marine.y);
      ctx.rotate(marine.rotation || 0);
      ctx.shadowBlur = marineGlow;
      ctx.shadowColor = glowsEnabled ? 'rgba(255, 66, 180, 0.8)' : 'transparent';
      ctx.drawImage(splayerSprite.image, -halfSpriteSize, -halfSpriteSize, spriteSize, spriteSize);
      ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }
    
    // Different colors for different unit types
    let mainColor, shadowColor;
    if (marine.type === 'sniper') {
      mainColor = 'rgba(255, 200, 100, 0.9)';
      shadowColor = 'rgba(255, 180, 66, 0.8)';
    } else if (marine.type === 'laser') {
      // Piercing lasers glow with sharp teal highlights.
      mainColor = 'rgba(120, 255, 210, 0.9)';
      shadowColor = 'rgba(80, 230, 190, 0.8)';
    } else if (marine.type === 'splayer') {
      mainColor = 'rgba(255, 100, 200, 0.9)';
      shadowColor = 'rgba(255, 66, 180, 0.8)';
    } else if (marine.type === 'worker') {
      // Workers use a softer cyan glow to read as support units.
      mainColor = 'rgba(160, 220, 255, 0.85)';
      shadowColor = 'rgba(90, 180, 220, 0.75)';
    } else {
      mainColor = 'rgba(140, 255, 255, 0.9)';
      shadowColor = 'rgba(66, 224, 255, 0.8)';
    }
    
    const marineGlow = glowsEnabled ? (this.renderProfile === 'light' ? 10 : 24) : 0;
    ctx.shadowBlur = marineGlow;
    ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(marine.x, marine.y, marine.radius, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = this.renderProfile === 'light' ? 2 : 3;
    ctx.strokeStyle = `rgba(${80 + healthRatio * 80}, ${200 + healthRatio * 40}, 255, 0.85)`;
    ctx.stroke();
    ctx.fillStyle = 'rgba(15, 20, 40, 0.65)';
    ctx.beginPath();
    ctx.arc(marine.x, marine.y, marine.radius * 0.5, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  });
}

// Draw all support drones with a teal/cyan glow.
export function drawDrones() {
  const ctx = this.ctx;
  const glowsEnabled = this.glowOverlaysEnabled;
  this.drones.forEach((drone) => {
    const healthRatio = drone.health / drone.maxHealth;
    
    // Drones use a teal/cyan glow to distinguish them from other units
    const mainColor = 'rgba(100, 220, 255, 0.9)';
    const shadowColor = 'rgba(80, 200, 240, 0.8)';
    
    const droneGlow = glowsEnabled ? (this.renderProfile === 'light' ? 8 : 16) : 0;
    ctx.shadowBlur = droneGlow;
    ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(drone.x, drone.y, drone.radius, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = this.renderProfile === 'light' ? 1.5 : 2;
    ctx.strokeStyle = `rgba(${80 + healthRatio * 80}, ${200 + healthRatio * 40}, 255, 0.85)`;
    ctx.stroke();
  });
}

// Draw all enemy turrets with type-specific colours, boss sprites, and selection indicators.
export function drawTurrets() {
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
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin((turret.fieldPulse || 0) * TWO_PI);
      ctx.beginPath();
      ctx.arc(turret.x, turret.y, turret.slowRadius, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    if (turret.isBuffNode && turret.buffRadius) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 120, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(turret.x, turret.y, turret.buffRadius, 0, TWO_PI);
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
    ctx.arc(turret.x, turret.y, turret.radius, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = strokeColor;
    const lineWidth = this.renderProfile === 'light' ? 1.5 : turret.type === 'big_turret' ? 3 : 2;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Overlay the boss ship sprite on designated large turrets.
    const bossSprite = turret.type === 'big_turret' ? getKufSprite(KUF_SPRITE_PATHS.ENEMY_BOSS) : null;
    if (bossSprite && bossSprite.loaded) {
      const spriteSize = turret.radius * 6.5;
      const halfSpriteSize = spriteSize * 0.5;
      ctx.drawImage(
        bossSprite.image,
        turret.x - halfSpriteSize,
        turret.y - halfSpriteSize,
        spriteSize,
        spriteSize
      );
    }

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
      ctx.arc(turret.x, turret.y, turret.radius + 4, 0, TWO_PI);
      ctx.stroke();
      // Add a target reticle to emphasize the focused enemy.
      ctx.strokeStyle = 'rgba(255, 230, 120, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(turret.x - turret.radius - 8, turret.y);
      ctx.lineTo(turret.x - turret.radius - 2, turret.y);
      ctx.moveTo(turret.x + turret.radius + 2, turret.y);
      ctx.lineTo(turret.x + turret.radius + 8, turret.y);
      ctx.moveTo(turret.x, turret.y - turret.radius - 8);
      ctx.lineTo(turret.x, turret.y - turret.radius - 2);
      ctx.moveTo(turret.x, turret.y + turret.radius + 2);
      ctx.lineTo(turret.x, turret.y + turret.radius + 8);
      ctx.stroke();
    }

    ctx.restore();
  });
}

// Draw all active projectiles; uses bullet sprite for player projectiles when loaded.
export function drawBullets() {
  const ctx = this.ctx;
  const glowsEnabled = this.glowOverlaysEnabled;
  // Load the bullet sprite if available.
  const bulletSprite = getKufSprite(KUF_SPRITE_PATHS.BULLET);
  const useBulletSprite = bulletSprite && bulletSprite.loaded && !bulletSprite.error;
  
  this.bullets.forEach((bullet) => {
    let color, shadowColor, size;
    if (bullet.owner === 'marine') {
      if (bullet.type === 'sniper') {
        color = 'rgba(255, 220, 120, 0.95)';
        shadowColor = 'rgba(255, 200, 80, 0.9)';
        size = 6;
      } else if (bullet.type === 'laser') {
        // Tint piercing lasers with a sharp cyan highlight.
        color = 'rgba(120, 255, 220, 0.95)';
        shadowColor = 'rgba(80, 240, 200, 0.9)';
        size = 5;
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
    
    // Draw sprite if available for marine bullets, otherwise draw circle.
    if (useBulletSprite && bullet.owner === 'marine') {
      const spriteSize = size * 2.5;
      const halfSpriteSize = spriteSize * 0.5;
      const bulletGlow = glowsEnabled ? (this.renderProfile === 'light' ? 8 : 16) : 0;
      ctx.shadowBlur = bulletGlow;
      ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
      ctx.drawImage(bulletSprite.image, bullet.x - halfSpriteSize, bullet.y - halfSpriteSize, spriteSize, spriteSize);
    } else {
      const bulletGlow = glowsEnabled ? (this.renderProfile === 'light' ? 8 : 16) : 0;
      ctx.shadowBlur = bulletGlow;
      ctx.shadowColor = glowsEnabled ? shadowColor : 'transparent';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });
}

// Draw health bars above damaged marines and enemy turrets.
export function drawHealthBars() {
  const ctx = this.ctx;
  
  // Draw health bars for damaged marines
  this.marines.forEach((marine) => {
    if (marine.health < marine.maxHealth) {
      const barWidth = marine.radius * 2;
      const halfBarWidth = barWidth * 0.5;
      const barHeight = 3;
      const barY = marine.y - marine.radius - 6;
      const healthRatio = marine.health / marine.maxHealth;
      
      // Background
      ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
      ctx.fillRect(marine.x - halfBarWidth, barY, barWidth, barHeight);
      // Health
      ctx.fillStyle = 'rgba(100, 255, 100, 0.9)';
      ctx.fillRect(marine.x - halfBarWidth, barY, barWidth * healthRatio, barHeight);
    }
  });

  // Draw health bars for damaged enemies
  this.turrets.forEach((turret) => {
    if (turret.health < turret.maxHealth) {
      const barWidth = turret.radius * 2;
      const halfBarWidth = barWidth * 0.5;
      const barHeight = 3;
      const barY = turret.y - turret.radius - 6;
      const healthRatio = turret.health / turret.maxHealth;
      
      // Background
      ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
      ctx.fillRect(turret.x - halfBarWidth, barY, barWidth, barHeight);
      // Health
      ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
      ctx.fillRect(turret.x - halfBarWidth, barY, barWidth * healthRatio, barHeight);
    }
  });
}

// Draw level badges on enemy turrets with level > 1.
export function drawLevelIndicators() {
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

// Draw expanding explosion rings from active mine detonations.
export function drawExplosions() {
  const ctx = this.ctx;
  
  this.explosions.forEach((explosion) => {
    const alpha = explosion.life / explosion.maxLife;
    ctx.strokeStyle = `rgba(255, 150, 50, ${alpha * 0.8})`;
    ctx.fillStyle = `rgba(255, 100, 30, ${alpha * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
  });
}

// Draw a floating stat box above the currently selected enemy.
export function drawSelectedEnemyBox() {
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
  const boxX = enemy.x - boxWidth * 0.5;
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

/**
 * Render the base core that anchors the training toolbar.
 * @param {{ baseCenter: { x: number, y: number }, baseRadius: number }} layout - HUD layout details.
 */
export function drawBaseCore(layout) {
  const ctx = this.ctx;
  const { baseCenter, baseRadius } = layout;
  // Derive hull integrity ratio so the base ring can visualize core ship health.
  const coreShipHealthRatio = this.coreShip
    ? Math.max(0, Math.min(1, this.coreShip.health / this.coreShip.maxHealth))
    : 1;
  
  // Scale the sprite based on level
  const scale = this.coreShip ? this.coreShip.scale : 1.0;
  
  ctx.save();
  const glowRadius = KUF_HUD_LAYOUT.BASE_GLOW_RADIUS * scale;
  const gradient = ctx.createRadialGradient(
    baseCenter.x,
    baseCenter.y,
    baseRadius * 0.2 * scale,
    baseCenter.x,
    baseCenter.y,
    glowRadius
  );
  gradient.addColorStop(0, 'rgba(190, 240, 255, 0.75)');
  gradient.addColorStop(1, 'rgba(40, 80, 140, 0.08)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(baseCenter.x, baseCenter.y, glowRadius, 0, TWO_PI);
  ctx.fill();

  // Draw healing aura if active (level 3+)
  if (this.coreShip && this.coreShip.healingAura > 0) {
    ctx.save();
    const healingGradient = ctx.createRadialGradient(
      baseCenter.x,
      baseCenter.y,
      0,
      baseCenter.x,
      baseCenter.y,
      this.coreShip.healingAuraRadius
    );
    healingGradient.addColorStop(0, 'rgba(100, 255, 150, 0.15)');
    healingGradient.addColorStop(1, 'rgba(100, 255, 150, 0)');
    ctx.fillStyle = healingGradient;
    ctx.beginPath();
    ctx.arc(baseCenter.x, baseCenter.y, this.coreShip.healingAuraRadius, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // Draw the core ship sprite scaled by level (20% per level).
  const coreSprite = getKufSprite(KUF_SPRITE_PATHS.CORE_SHIP);
  if (coreSprite && coreSprite.loaded) {
    const spriteSize = baseRadius * 2.2 * scale;
    const halfSpriteSize = spriteSize * 0.5;
    ctx.drawImage(
      coreSprite.image,
      baseCenter.x - halfSpriteSize,
      baseCenter.y - halfSpriteSize,
      spriteSize,
      spriteSize
    );
  }
  
  // Draw shield if active (level 4+)
  if (this.coreShip && this.coreShip.maxShield > 0 && this.coreShip.shield > 0 && !this.coreShip.shieldBroken) {
    const shieldRatio = this.coreShip.shield / this.coreShip.maxShield;
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.5 + shieldRatio * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      baseCenter.x,
      baseCenter.y,
      (baseRadius + 10) * scale,
      0,
      TWO_PI
    );
    ctx.stroke();
  }

  // Draw the core ship hull integrity arc to reflect remaining health.
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    baseCenter.x,
    baseCenter.y,
    (baseRadius + 3) * scale,
    -HALF_PI,
    -HALF_PI + TWO_PI * coreShipHealthRatio
  );
  ctx.stroke();

  // Render attached cannons around the core ring to visualize cannon upgrades.
  if (this.coreShip && this.coreShip.cannons > 0) {
    const cannonCount = this.coreShip.cannons;
    const orbitRadius = (baseRadius + 6) * scale;
    for (let i = 0; i < cannonCount; i++) {
      const angle = (TWO_PI * i) / cannonCount - HALF_PI;
      const cannonX = baseCenter.x + Math.cos(angle) * orbitRadius;
      const cannonY = baseCenter.y + Math.sin(angle) * orbitRadius;
      ctx.fillStyle = 'rgba(255, 210, 150, 0.9)';
      ctx.beginPath();
      ctx.arc(cannonX, cannonY, 2.6, 0, TWO_PI);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Render the training toolbar with unit slots, costs, and progress fills.
 * @param {{ slots: Array<{ x: number, y: number, size: number, slot: object }> }} layout - HUD layout details.
 */
export function drawTrainingToolbar(layout) {
  const ctx = this.ctx;
  layout.slots.forEach(({ x, y, size, slot }, index) => {
    ctx.save();
    // Pull the live spec for the currently equipped unit in this slot.
    const spec = this.getTrainingSpecForSlot(slot);
    const canAfford = this.goldEarned >= spec.cost;
    const isGlowing = this.glowingToolbarSlotIndex === index;
    
    ctx.fillStyle = 'rgba(10, 15, 35, 0.8)';
    ctx.strokeStyle = isGlowing ? 'rgba(120, 255, 200, 0.9)' : 'rgba(160, 210, 255, 0.6)';
    ctx.lineWidth = isGlowing ? 3 : 2;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x, y, size, size);
    
    // Add a subtle glow effect when the slot is selected
    if (isGlowing) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(120, 255, 200, 0.6)';
      ctx.strokeRect(x, y, size, size);
      ctx.shadowBlur = 0;
    }

    if (slot.isTraining) {
      // Darken the icon area while the unit is training.
      ctx.fillStyle = 'rgba(5, 10, 20, 0.6)';
      ctx.fillRect(x, y, size, size);
      const progress = spec.duration > 0 ? slot.progress / spec.duration : 0;
      ctx.fillStyle = 'rgba(110, 220, 255, 0.35)';
      ctx.fillRect(x, y + size * (1 - progress), size, size * progress);
    }

    ctx.fillStyle = canAfford ? 'rgba(200, 240, 255, 0.95)' : 'rgba(120, 140, 160, 0.7)';
    ctx.font = '700 16px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.icon, x + size / 2, y + size / 2 - 4);

    ctx.font = '600 9px "Space Mono", monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = canAfford ? 'rgba(180, 210, 255, 0.9)' : 'rgba(120, 140, 160, 0.7)';
    ctx.fillText(`${spec.cost}g`, x + size / 2, y + size - 6);
    ctx.restore();
  });
}

// Draw the heads-up display: gold counter, enemy count, base core, and training toolbar.
export function drawHud() {
  const ctx = this.ctx;
  const hudLayout = this.getHudLayout();
  ctx.save();
  ctx.fillStyle = 'rgba(170, 220, 255, 0.92)';
  ctx.font = '600 16px "Space Mono", monospace';
  // Lift HUD text above the training toolbar for readability.
  const hudY = Math.min(this.bounds.height - 24, hudLayout.slots[0].y - 18);
  ctx.fillText(`Gold: ${this.goldEarned}`, 20, hudY);
  ctx.fillText(`Enemies: ${this.turrets.length}`, 20, hudY - 24);
  if (this.currentMap?.name) {
    ctx.font = '600 12px "Space Mono", monospace';
    ctx.fillText(`Map: ${this.currentMap.name}`, 20, hudY - 48);
  }
  // Render the base core and training toolbar above the HUD text.
  drawBaseCore.call(this, hudLayout);
  drawTrainingToolbar.call(this, hudLayout);
  ctx.restore();
}

/**
 * Draw the selection rectangle while dragging.
 */
export function drawSelectionBox() {
  if (!this.selectionBox.active) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  
  const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
  const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
  const minY = Math.min(this.selectionBox.startY, this.selectionBox.endY);
  const maxY = Math.max(this.selectionBox.startY, this.selectionBox.endY);
  
  // Draw selection box fill
  ctx.fillStyle = 'rgba(100, 255, 100, 0.1)';
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  
  // Draw selection box border
  ctx.strokeStyle = 'rgba(100, 255, 100, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  ctx.setLineDash([]);
  
  ctx.restore();
}

/**
 * Draw waypoint marker in the world.
 */
export function drawWaypointMarker() {
  if (!this.attackMoveWaypoint) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  
  const wp = this.attackMoveWaypoint;
  const time = performance.now() / 1000;
  const pulse = Math.sin(time * 4) * 0.3 + 0.7;
  
  // Draw outer circle
  ctx.strokeStyle = `rgba(100, 255, 100, ${pulse * 0.6})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(wp.x, wp.y, 15, 0, TWO_PI);
  ctx.stroke();
  
  // Draw inner circle
  ctx.strokeStyle = `rgba(100, 255, 100, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(wp.x, wp.y, 8, 0, TWO_PI);
  ctx.stroke();
  
  // Draw crosshair
  ctx.strokeStyle = `rgba(100, 255, 100, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wp.x - 12, wp.y);
  ctx.lineTo(wp.x - 4, wp.y);
  ctx.moveTo(wp.x + 4, wp.y);
  ctx.lineTo(wp.x + 12, wp.y);
  ctx.moveTo(wp.x, wp.y - 12);
  ctx.lineTo(wp.x, wp.y - 4);
  ctx.moveTo(wp.x, wp.y + 4);
  ctx.lineTo(wp.x, wp.y + 12);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw lines from units to their individual waypoints to show queued movement.
 */
export function drawUnitWaypointLines() {
  const ctx = this.ctx;
  ctx.save();
  
  // Get the units that should have waypoint lines
  const unitsToShow = this.selectionMode === 'specific' ? this.selectedUnits : this.marines;
  
  unitsToShow.forEach((marine) => {
    // Only draw lines for units that have a waypoint set
    if (!marine.waypoint) {
      return;
    }
    
    const dx = marine.waypoint.x - marine.x;
    const dy = marine.waypoint.y - marine.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only draw lines if the unit is not already at the waypoint
    if (distance > 5) {
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(marine.x, marine.y);
      ctx.lineTo(marine.waypoint.x, marine.waypoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
  
  ctx.restore();
}
