// Enemy lifecycle system extracted from SimplePlayfield.
// These functions use 'this' (the SimplePlayfield instance) via prototype assignment.

import { resolveEnemyGemDropMultiplier } from '../../enemies.js';
import { formatCombatNumber } from '../utils/formatting.js';

// Offset radial spawns beyond the playfield so they begin off-screen even at max zoom out.
const RADIAL_SPAWN_OFFSCREEN_MARGIN = 0.08;

export function spawnEnemies(delta) {
  if (!this.combatStateManager || !this.levelConfig) {
    return;
  }
  
  // Delegate to combat state manager for spawning
  const spawnContext = {
    pathPoints: this.pathPoints,
    radialSpawn: this.levelConfig.radialSpawn && this.levelConfig.centerSpawn,
    registerEnemy: (enemy) => {
      // Enhance enemy with playfield-specific properties
      const polygonSides = this.resolvePolygonSides(enemy);
      const symbol = this.resolveEnemySymbol({ ...enemy, polygonSides });
      const maxHp = Number.isFinite(enemy.hp) ? Math.max(1, enemy.hp) : 1;
      const hpExponent = this.calculateHealthExponent(maxHp);
      const gemDropMultiplier = resolveEnemyGemDropMultiplier(enemy);
      
      Object.assign(enemy, {
        progress: 0,
        baseSpeed: enemy.speed,
        moteFactor: this.calculateMoteFactor(enemy),
        symbol,
        polygonSides,
        hpExponent,
        gemDropMultiplier,
      });
      
      // Handle radial spawn positioning
      if (spawnContext.radialSpawn) {
        const edge = Math.floor(Math.random() * 4);
        const offset = Math.random();
        const spawnMargin = RADIAL_SPAWN_OFFSCREEN_MARGIN;
        
        let spawnX, spawnY;
        if (edge === 0) {
          spawnX = offset;
          spawnY = -spawnMargin;
        } else if (edge === 1) {
          spawnX = 1 + spawnMargin;
          spawnY = offset;
        } else if (edge === 2) {
          spawnX = offset;
          spawnY = 1 + spawnMargin;
        } else {
          spawnX = -spawnMargin;
          spawnY = offset;
        }
        
        enemy.radialSpawnX = spawnX;
        enemy.radialSpawnY = spawnY;
        enemy.pathMode = 'direct';
      }
      
      this.scheduleStatsPanelRefresh();
    },
  };
  
  this.combatStateManager.spawnEnemies(delta, spawnContext);
}

/**
 * Resolve which debuffs are active on an enemy so visual indicators stay in sync with game logic.
 */
export function resolveActiveDebuffTypes(enemy) {
  const activeTypes = [];
  if (!enemy) {
    return activeTypes;
  }

  const amplifierActive =
    (enemy.damageAmplifiers instanceof Map && enemy.damageAmplifiers.size > 0) ||
    (enemy.damageAmplifiers && typeof enemy.damageAmplifiers === 'object' &&
      Object.keys(enemy.damageAmplifiers).length > 0) ||
    (Number.isFinite(enemy.iotaInversionTimer) && enemy.iotaInversionTimer > 0);
  if (amplifierActive) {
    activeTypes.push('iota');
  }

  const slowEffects = enemy.slowEffects;
  const thetaActive = slowEffects instanceof Map
    ? Array.from(slowEffects.values()).some((effect) => effect?.type === 'theta')
    : slowEffects && typeof slowEffects === 'object'
      ? Object.values(slowEffects).some((effect) => effect?.type === 'theta')
      : false;
  if (thetaActive) {
    activeTypes.push('theta');
  }

  if (Number.isFinite(enemy.rhoSparkleTimer) && enemy.rhoSparkleTimer > 0) {
    activeTypes.push('rho');
  }

  if (enemy.derivativeShield && enemy.derivativeShield.active) {
    activeTypes.push('derivative-shield');
  }

  return activeTypes;
}

/**
 * Ensure the debuff indicator list only includes active effects while preserving first-seen order.
 */
export function syncEnemyDebuffIndicators(enemy, activeTypes = []) {
  if (!enemy) {
    return [];
  }
  if (!Array.isArray(enemy.debuffIndicators)) {
    enemy.debuffIndicators = [];
  }
  const activeSet = new Set(activeTypes);
  enemy.debuffIndicators = enemy.debuffIndicators.filter(
    (entry) => entry && activeSet.has(entry.type),
  );
  if (!activeSet.size) {
    return enemy.debuffIndicators;
  }
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  activeTypes.forEach((type) => {
    const existing = enemy.debuffIndicators.find((entry) => entry?.type === type);
    if (existing) {
      existing.lastSeen = now;
      return;
    }
    enemy.debuffIndicators.push({ type, appliedAt: now, lastSeen: now });
  });
  enemy.debuffIndicators.sort((a, b) => (a?.appliedAt || 0) - (b?.appliedAt || 0));
  return enemy.debuffIndicators;
}

export function handleEnemyBreach(enemy) {
  this.clearEnemySlowEffects(enemy);
  this.clearEnemyDamageAmplifiers(enemy);
  const damage = this.estimateEnemyBreachDamage(enemy);
  this.lives = Math.max(0, this.lives - damage);
  if (this.audio) {
    this.audio.playSfx('enemyBreach');
    const maxLives = Number.isFinite(this.levelConfig?.lives)
      ? Math.max(1, this.levelConfig.lives)
      : null;
    if (maxLives && damage / maxLives > 0.05) {
      this.audio.playSfx('error');
    }
  }
  if (this.messageEl) {
    const label = enemy.label || 'Glyph';
    // Clarify whether a breach actually removed integrity or was fully absorbed by defenses.
    this.messageEl.textContent =
      damage > 0
        ? `${label} breached the core—Integrity −${damage}.`
        : `${label} breached the core, but the gate held firm.`;
  }
  if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
    this.clearEnemyHover();
  }
  if (this.focusedEnemyId === enemy.id) {
    this.clearFocusedEnemy({ silent: true });
  }
  if (this.lives <= 0) {
    this.handleDefeat();
  }
  this.updateHud();
  this.updateProgress();
  // Ensure the queue updates once the breached enemy is removed.
  this.scheduleStatsPanelRefresh();
}

export function processEnemyDefeat(enemy) {
  const defeatPosition = this.getEnemyPosition(enemy);
  
  // First, handle playfield-specific defeat logic
  // Trigger PsiCluster AoE if this is a Psi cluster
  if (enemy.isPsiCluster) {
    this.triggerPsiClusterAoE(enemy, defeatPosition);
  }
  
  // Emit a burst of collapse motes before removing the enemy from active lists.
  this.spawnEnemyDeathParticles(enemy);
  this.captureEnemyHistory(enemy);
  this.clearEnemySlowEffects(enemy);
  this.clearEnemyDamageAmplifiers(enemy);
  
  if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
    this.clearEnemyHover();
  }
  if (this.focusedEnemyId === enemy.id) {
    this.clearFocusedEnemy({ silent: true });
  }

  this.handlePolygonSplitOnDefeat(enemy);

  const baseGain =
    (this.levelConfig?.theroPerKill ?? this.levelConfig?.energyPerKill ?? 0) +
    (enemy.reward || 0);
  const cap = this.getEnergyCap();
  this.energy = Math.min(cap, this.energy + baseGain);

  if (this.messageEl) {
    const gainLabel = formatCombatNumber(baseGain);
    this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${gainLabel} ${this.theroSymbol}.`;
  }
  
  // Spawn mote gem drops
  this.spawnMoteGemFromEnemy(enemy);

  // Now delegate to combat state manager to handle enemy removal and wave progression
  if (this.combatStateManager) {
    const deathContext = {
      spawnDeathParticles: () => {}, // Already handled above
      dropGems: () => {}, // Already handled above
    };
    this.combatStateManager.handleEnemyDeath(enemy, deathContext);
  }
  
  this.updateHud();
  this.updateProgress();
  this.dependencies.updateStatusDisplays();

  if (this.audio) {
    this.audio.playSfx('enemyDefeat');
  }

  this.dependencies.notifyEnemyDefeated();
  // Remove the defeated enemy from the live lists immediately.
  this.scheduleStatsPanelRefresh();
}

export function handleVictory() {
  if (this.resolvedOutcome === 'victory') {
    return;
  }
  if (this.audio) {
    this.audio.playSfx('victory');
  }
  this.combatActive = false;
  this.stopCombatStatsSession();
  this.resolvedOutcome = 'victory';
  this.activeWave = null;
  const cap = this.getEnergyCap();
  const reward = this.levelConfig.rewardThero ?? this.levelConfig.rewardEnergy ?? 0;
  this.energy = Math.min(cap, this.energy + reward);
  this.currentWaveNumber = this.baseWaveCount || this.currentWaveNumber;
  this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
  if (this.startButton) {
    this.startButton.disabled = false;
    this.startButton.textContent = 'Run Again';
  }
  if (this.messageEl) {
    const title = this.levelConfig.displayName || 'Defense';
    this.messageEl.textContent = `Victory! ${title} is sealed.`;
  }
  this.updateHud();
  this.updateProgress();
  if (this.onVictory) {
    this.onVictory(this.levelConfig.id, {
      rewardScore: this.levelConfig.rewardScore,
      rewardFlux: this.levelConfig.rewardFlux,
      rewardThero: reward,
      rewardEnergy: this.levelConfig.rewardEnergy,
      towers: this.towers.length,
      lives: this.lives,
      maxWave: this.maxWaveReached,
      startThero: this.levelConfig.startThero,
    });
  }
  const calculateStartingThero = this.dependencies.calculateStartingThero;
  const refreshedStart =
    typeof calculateStartingThero === 'function' ? calculateStartingThero() : 0;
  if (Number.isFinite(refreshedStart)) {
    this.levelConfig.startThero = refreshedStart;
    this.energy = Math.min(cap, Math.max(this.energy, refreshedStart));
    this.updateHud();
  }
  this.dependencies.updateStatusDisplays();
}

export function handleDefeat() {
  if (this.resolvedOutcome === 'defeat') {
    return;
  }
  if (this.audio) {
    this.audio.playSfx('defeat');
  }
  this.combatActive = false;
  this.stopCombatStatsSession();
  this.resolvedOutcome = 'defeat';
  this.activeWave = null;
  const cap = this.getEnergyCap();
  const baseline = this.levelConfig.startThero ?? this.levelConfig.startEnergy ?? 0;
  this.energy = Math.min(cap, Math.max(this.energy, baseline));
  this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
  if (this.startButton) {
    this.startButton.disabled = false;
    this.startButton.textContent = 'Retry Wave';
  }
  if (this.messageEl) {
    const waveLabel = this.maxWaveReached > 0 ? ` at wave ${this.maxWaveReached}` : '';
    this.messageEl.textContent = `Defense collapsed${waveLabel}—recalibrate the anchors and retry.`;
  }
  this.updateHud();
  this.updateProgress();
  this.dependencies.updateStatusDisplays();
  if (this.onDefeat) {
    this.onDefeat(this.levelConfig.id, {
      towers: this.towers.length,
      maxWave: this.maxWaveReached,
    });
  }
}
