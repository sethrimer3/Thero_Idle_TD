// Projectile spawn system extracted from SimplePlayfield for modular projectile creation logic.
// Handles spawning supply motes, beta/gamma projectiles, omega waves, and polygon shards.

import { getOmegaWaveVisualConfig, getTowerTierValue } from '../../colorSchemeUtils.js';
import { computeTowerVariableValue, calculateTowerEquationResult } from '../../towersTab.js';
import { metersToPixels } from '../../gameUnits.js';
import { assignRandomShell, resolveEnemyGemDropMultiplier } from '../../enemies.js';

// Preserve β triangle speed constant from playfield.js
const BETA_TRIANGLE_SPEED = 144;
// Preserve γ outbound and star speed constants from playfield.js
const GAMMA_OUTBOUND_SPEED = 260;
const GAMMA_STAR_SPEED = 200;
// Keep γ's impact star compact so the pattern hugs the enemy model.
const GAMMA_STAR_RADIUS_METERS = 0.45;

const TWO_PI = Math.PI * 2;

/**
 * Emit a supply mote traveling between linked lattices.
 */
export function spawnSupplyProjectile(sourceTower, targetTower, options = {}) {
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

// Spawn a β projectile that sticks to enemies, applies slow ticks, and traces a returning triangle.
export function spawnBetaTriangleProjectile(tower, enemy, effectPosition, resolvedDamage, triangleOrientation = 1) {
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
export function spawnGammaStarProjectile(tower, enemy, effectPosition, resolvedDamage) {
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

export function spawnOmegaWave(tower) {
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

// Derive a child enemy from a parent polygonal shard using the configured health and speed multipliers.
export function spawnPolygonShard(parent, options = {}) {
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
