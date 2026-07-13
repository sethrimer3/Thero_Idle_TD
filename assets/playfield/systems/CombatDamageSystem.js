// Combat Damage System — extracted from SimplePlayfield (Build 710).
// Handles damage calculation, mitigation, special enemy mechanics, and debuff tracking.
// These functions use 'this' (the SimplePlayfield instance) via .call().

import {
  trackNuKill as trackNuKillHelper,
  spawnNuKillParticle as spawnNuKillParticleHelper,
} from '../../../scripts/features/towers/nuTower.js';
import { projectIotaPhaseDamage } from './IotaPhaseProjectionSystem.js';

// ── Constants ───────────────────────────────────────────────────────────
const DERIVATIVE_SHIELD_SYMBOL = '∂';
const DEBUFF_ICON_SYMBOLS = {
  iota: 'ι',
  rho: 'ρ',
  theta: 'θ',
  'derivative-shield': DERIVATIVE_SHIELD_SYMBOL,
};
const PRIME_HIT_LIST = [2, 3, 5, 7, 11, 13, 17];

/**
 * Compute the additive damage multiplier from all amplifiers on an enemy.
 */
export function computeEnemyDamageMultiplier(enemy) {
  if (!enemy) {
    return 1;
  }
  let additive = 0;
  if (enemy.damageAmplifiers instanceof Map) {
    enemy.damageAmplifiers.forEach((effect) => {
      if (!effect) {
        return;
      }
      const strength = Number.isFinite(effect.strength) ? Math.max(0, effect.strength) : 0;
      additive += strength;
    });
  }
  return Math.max(0, 1 + additive);
}

/**
 * Apply mitigation from derivative shield carriers before other multipliers modify the strike.
 * When attackType is 'melee', shields are bypassed entirely (universal melee-vs-shield rule).
 */
export function applyDerivativeShieldMitigation(enemy, baseDamage, { attackType } = {}) {
  // Melee attacks bypass all shield layers and apply damage directly to health.
  if (attackType === 'melee') {
    return baseDamage;
  }
  if (!enemy || !enemy.derivativeShield || !Number.isFinite(baseDamage) || baseDamage <= 0) {
    return baseDamage;
  }
  const effect = enemy.derivativeShield;
  if (!effect.active) {
    return baseDamage;
  }
  if (effect.mode === 'sqrt') {
    return Math.max(0, Math.sqrt(baseDamage));
  }
  const stack = Number.isFinite(effect.stack) && effect.stack >= 0 ? effect.stack : 0;
  const mitigation = Math.pow(0.5, stack + 1);
  effect.stack = stack + 1;
  return Math.max(0, baseDamage * mitigation);
}

/**
 * Track when a debuff first lands on an enemy so the renderer can order icons chronologically.
 */
export function registerEnemyDebuff(enemy, type) {
  if (!enemy || !type) {
    return;
  }
  if (!Array.isArray(enemy.debuffIndicators)) {
    enemy.debuffIndicators = [];
  }
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const existing = enemy.debuffIndicators.find((entry) => entry?.type === type);
  if (existing) {
    existing.lastSeen = now;
    return;
  }
  enemy.debuffIndicators.push({ type, appliedAt: now, lastSeen: now });
}

/**
 * Provide ordered debuff metadata to the renderer with pre-resolved glyphs for each effect.
 */
export function getEnemyDebuffIndicators(enemy) {
  if (!enemy) {
    return [];
  }
  const activeTypes = this.resolveActiveDebuffTypes(enemy);
  const entries = this.syncEnemyDebuffIndicators(enemy, activeTypes);
  return entries.map((entry) => ({
    type: entry.type,
    symbol: DEBUFF_ICON_SYMBOLS[entry.type] || entry.type?.[0] || '·',
  }));
}

/**
 * Apply damage to an enemy after accounting for shields, amplifiers, directional saturation,
 * and special enemy mechanics (Prime-Counter, Imaginary Strider, Quantum Tunneler, etc.).
 */
export function applyDamageToEnemy(enemy, baseDamage, { sourceTower, attackType, isPhaseProjection } = {}) {
  if (!enemy || !Number.isFinite(baseDamage) || baseDamage <= 0) {
    return 0;
  }

  // Check if enemy is in a tunnel - if so, they cannot take damage
  const tunnelState = this.getEnemyTunnelState(enemy);
  if (tunnelState.inTunnel) {
    // Enemy is in a tunnel, show "Miss" instead of damage
    this.spawnMissText(enemy);
    return 0;
  }

  // ─── Imaginary Strider: post-hit invulnerability window ────────────────
  // While isInvulnerable is true all incoming damage is ignored entirely.
  if ((enemy.codexId || enemy.typeId) === 'imaginary-strider') {
    if (enemy.isInvulnerable) {
      return 0;
    }
  }

  // ─── Prime-Counter: hit-count-based health — ignore damage magnitude ──
  // Only counts discrete hits; each hit increments currentHitCount by 1.
  if ((enemy.codexId || enemy.typeId) === 'prime') {
    if (!Number.isFinite(enemy.requiredHitCount)) {
      // Initialise hit-count health using a random prime from the module-scope PRIME_HIT_LIST
      const idx = Math.floor(Math.random() * PRIME_HIT_LIST.length);
      enemy.requiredHitCount = PRIME_HIT_LIST[idx];
      enemy.currentHitCount = 0;
    }
    enemy.currentHitCount = (enemy.currentHitCount || 0) + 1;
    // Debug log — removable without affecting gameplay
    console.log(`[Prime Hit Count Updated] id=${enemy.id} hits=${enemy.currentHitCount}/${enemy.requiredHitCount}`);
    if (sourceTower) {
      this.recordDamageEvent({ tower: sourceTower, enemy, damage: 1 });
    }
    if (enemy.currentHitCount >= enemy.requiredHitCount) {
      if (sourceTower) {
        this.recordKillEvent(sourceTower);
      }
      this.processEnemyDefeat(enemy);
    }
    return 1;
  }

  const mitigatedBase = applyDerivativeShieldMitigation.call(this, enemy, baseDamage, { attackType });

  // Directional saturation: enemies with sector-based resistance reduce damage
  // from repeatedly attacked directions. Constants inlined from
  // DirectionalSaturationSystem.js to avoid import in this hot path.
  // ⚠ Keep in sync: DIR_SAT_BUILDUP_PER_HIT (0.12), DIR_SAT_BOSS_BUILDUP_SCALE (0.6)
  let dirSatMultiplier = 1;
  if (enemy._dirSat && sourceTower) {
    const enemyPos = this.getEnemyPosition(enemy);
    const sourcePos = { x: sourceTower.x, y: sourceTower.y };
    if (enemyPos && Number.isFinite(sourcePos.x) && Number.isFinite(sourcePos.y)) {
      const sectors = enemy._dirSat.sectors;
      const sectorCount = sectors.length;
      const dx = sourcePos.x - enemyPos.x;
      const dy = sourcePos.y - enemyPos.y;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      const sectorSize = (Math.PI * 2) / sectorCount;
      const sectorIdx = Math.min(sectorCount - 1, Math.floor(angle / sectorSize));
      dirSatMultiplier = Math.max(0, 1 - sectors[sectorIdx]);
      // Build up resistance: 0.12 normal, 0.12 * 0.6 = 0.072 for bosses
      const buildup = enemy.isBoss ? 0.072 : 0.12;
      sectors[sectorIdx] = Math.min(1.0, sectors[sectorIdx] + buildup);
      enemy._dirSat.totalHits++;
    }
  }

  // Weierstrass Prism: fractal vulnerability window reduces damage outside vulnerable phases.
  const weierMult = (enemy._weierstrass && !enemy._weierstrass.vulnerable) ? 0.15 : 1;

  // Integral Accumulator: damage resistance decreases with path progress.
  // ⚠ Keep in sync: INTEGRAL_MIN_MULTIPLIER (0.05), INTEGRAL_CURVE_POWER (0.8)
  // from IntegralEnemySystem.js. Inlined here to avoid import in the hot damage path.
  let integralMult = 1;
  if ((enemy.codexId || enemy.typeId) === 'integral-accumulator' && Number.isFinite(enemy.progress)) {
    const p = Math.max(0, Math.min(1, enemy.progress));
    integralMult = Math.max(0.05, Math.pow(p, 0.8));
  }

  // Superposition: state 0 has higher damage resistance (0.3x damage taken).
  let superpositionMult = 1;
  if ((enemy.codexId || enemy.typeId) === 'superposition') {
    superpositionMult = enemy.currentState === 0 ? 0.3 : 1.0;
  }

  const multiplier = computeEnemyDamageMultiplier.call(this, enemy);
  const applied = mitigatedBase * multiplier * dirSatMultiplier * weierMult * integralMult * superpositionMult;
  const hpBefore = Number.isFinite(enemy.hp) ? enemy.hp : 0;
  if (Number.isFinite(enemy.hp)) {
    enemy.hp -= applied;
  } else {
    enemy.hp = -applied;
  }

  // ─── Recursive Relay: spawn one additional standard enemy on first hit ─
  if ((enemy.codexId || enemy.typeId) === 'recursive-relay' && !enemy.hasTriggeredRelaySpawn) {
    enemy.hasTriggeredRelaySpawn = true;
    // baseSpawnType can be set by a wave configuration to override the spawned type.
    // It defaults to 'etype' (the basic Epsilon Type enemy) when not explicitly specified.
    const spawnType = enemy.baseSpawnType || 'etype';
    this.spawnRelayEnemy(enemy, spawnType);
  }

  // ─── Imaginary Strider: enter invulnerable state after receiving damage ─
  if ((enemy.codexId || enemy.typeId) === 'imaginary-strider') {
    enemy.isInvulnerable = true;
    enemy.invulnerabilityTimer = 3.0;
  }

  // ─── Quantum-Tunneler: create a TunnelZone on damage ──────────────────
  if ((enemy.codexId || enemy.typeId) === 'quantum-tunneler') {
    this.createTunnelZone(enemy);
  }

  // Quantum Tunneler projection: check if a projection layer should collapse after damage.
  // ⚠ Keep in sync: QUANTUM_LAYER_HP_FRACTION (0.2), QUANTUM_COLLAPSE_THRESHOLD (3),
  // QUANTUM_COLLAPSED_HP_SCALE (0.4) from QuantumProjectionSystem.js.
  if (enemy._quantum && !enemy._quantum.collapsed && Number.isFinite(enemy.maxHp) && enemy.maxHp > 0) {
    const hpFraction = Math.max(0, enemy.hp) / enemy.maxHp;
    const layerFraction = 0.2;
    const collapseThreshold = 3;
    const nextCollapseAt = 1 - (enemy._quantum.collapses + 1) * layerFraction;
    if (hpFraction <= nextCollapseAt && enemy._quantum.collapses < collapseThreshold) {
      enemy._quantum.collapses++;
      if (!enemy._quantum._collapsedIndices) {
        enemy._quantum._collapsedIndices = new Set();
      }
      enemy._quantum._collapsedIndices.add(enemy._quantum.activeIndex);
      enemy._quantum.switchTimer = 0;
      const remaining = enemy._quantum.projections - enemy._quantum.collapses;
      if (remaining <= 0 || enemy._quantum.collapses >= collapseThreshold) {
        enemy._quantum.collapsed = true;
        const collapsedScale = 0.4;
        enemy.hp = Math.max(0, enemy.hp) * collapsedScale;
        enemy.maxHp = Math.max(1, enemy.hp);
      } else {
        enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
        let safety = enemy._quantum.projections;
        while (enemy._quantum._collapsedIndices.has(enemy._quantum.activeIndex) && safety-- > 0) {
          enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
        }
      }
    }
  }

  // ─── Iota Phase Projection: project the applied hit to field neighbours ──
  // Only fires for non-projection hits to prevent recursive cascading.
  if (applied > 0 && !isPhaseProjection) {
    projectIotaPhaseDamage(this, enemy, applied, { sourceTower, isPhaseProjection: false });
  }

  if (sourceTower) {
    this.recordDamageEvent({ tower: sourceTower, enemy, damage: applied });
  }
  // Pass through pre-hit HP so the renderer can scale the damage number impact.
  this.spawnDamageNumber(enemy, applied, { sourceTower, enemyHpBefore: hpBefore });
  // Capture the hit vector so the swirl renderer can push particles along the impact path.
  const sourcePosition =
    sourceTower && Number.isFinite(sourceTower.x) && Number.isFinite(sourceTower.y)
      ? { x: sourceTower.x, y: sourceTower.y }
      : null;
  this.recordEnemySwirlImpact(enemy, { sourcePosition, damageApplied: applied, enemyHpBefore: hpBefore });
  if (enemy.hp <= 0) {
    // Track kill and overkill damage for Nu towers
    if (sourceTower && sourceTower.type === 'nu') {
      const overkillDamage = Math.max(0, applied - hpBefore);
      trackNuKillHelper(sourceTower, overkillDamage);

      // Spawn kill particle at enemy position
      const enemyPos = this.getEnemyPosition(enemy);
      if (enemyPos) {
        spawnNuKillParticleHelper(this, sourceTower, enemyPos);
      }
    }
    // ─── Nullifier: disable the killing tower for 5 seconds ───────────
    if ((enemy.codexId || enemy.typeId) === 'nullifier' && sourceTower) {
      this.disableTower(sourceTower, 5.0);
    }
    if (sourceTower) {
      this.recordKillEvent(sourceTower);
    }
    this.processEnemyDefeat(enemy);
  }
  return applied;
}
