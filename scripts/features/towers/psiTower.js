// ψ tower helper module for merge mechanics that combine enemies into powerful PsiClusters.
import {
  computeTowerVariableValue,
  calculateTowerEquationResult,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

/**
 * Base AoE radius in meters for PsiCluster death explosions.
 * This is multiplied by the aoeRadiusMultiplier from sub-equations.
 */
const BASE_AOE_RADIUS_METERS = 2.0;

/**
 * Default merge speed exponent for cluster speed calculations.
 * This controls how meanSpeed is transformed: speed_cluster = pow(meanSpeed, exponent)
 * Default of 0.5 gives square-root-like scaling.
 */
const DEFAULT_MERGE_SPEED_EXPONENT = 0.5;

/**
 * Ensure ψ towers maintain their merge state and timing information.
 */
export function ensurePsiState(playfield, tower, options = {}) {
  if (!playfield || !tower || tower.type !== 'psi') {
    return null;
  }

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;

  // Read sub-equation parameters for the merge tower
  const mergeCooldownSeconds = Math.max(0.1, computeTowerVariableValue('psi', 'mergeCooldown') || 2.0);
  const maxMergeCount = Math.max(2, Math.floor(computeTowerVariableValue('psi', 'maxMergeCount') || 3));
  const mergeSpeedExponent = Math.max(0.1, computeTowerVariableValue('psi', 'mergeSpeedExponent') || DEFAULT_MERGE_SPEED_EXPONENT);
  const aoeRadiusMultiplier = Math.max(0, computeTowerVariableValue('psi', 'aoeRadiusMultiplier') || 1.0);
  const aoeDamageMultiplier = Math.max(0, computeTowerVariableValue('psi', 'aoeDamageMultiplier') || 1.0);
  const rangeMeters = Math.max(0.5, computeTowerVariableValue('psi', 'rangeMeters') || tower.definition?.range * 10 || 7);
  const allowBossMerges = Boolean(computeTowerVariableValue('psi', 'allowBossMerges'));

  // Convert range from meters to pixels
  const rangePixels = metersToPixels(rangeMeters, minDimension);

  // Update tower properties
  tower.range = rangePixels;
  tower.baseRange = rangePixels;
  tower.damage = 0; // Psi tower doesn't do direct damage
  tower.baseDamage = 0;
  tower.rate = 1; // Not used for merge mechanics but kept for consistency
  tower.baseRate = 1;

  let state = tower.psiState;
  if (!state) {
    state = {
      mergeTimer: 0,
      mergeCooldown: mergeCooldownSeconds,
      maxMergeCount,
      mergeSpeedExponent,
      aoeRadiusMultiplier,
      aoeDamageMultiplier,
      rangeMeters,
      allowBossMerges,
    };
    tower.psiState = state;
  } else {
    // Update state with current sub-equation values
    state.mergeCooldown = mergeCooldownSeconds;
    state.maxMergeCount = maxMergeCount;
    state.mergeSpeedExponent = mergeSpeedExponent;
    state.aoeRadiusMultiplier = aoeRadiusMultiplier;
    state.aoeDamageMultiplier = aoeDamageMultiplier;
    state.rangeMeters = rangeMeters;
    state.allowBossMerges = allowBossMerges;
  }

  return state;
}

/**
 * Clear cached ψ merge state when the tower is removed.
 */
export function teardownPsiTower(playfield, tower) {
  if (!playfield || !tower || !tower.psiState) {
    return;
  }
  tower.psiState = null;
}

/**
 * Update ψ tower merge logic.
 * Collects enemies within range, selects targets based on priority, and merges them into PsiClusters.
 */
export function updatePsiTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'psi') {
    return;
  }

  if (!playfield.combatActive) {
    return;
  }

  // Ensure tower state is initialized
  const state = ensurePsiState(playfield, tower);
  if (!state) {
    return;
  }

  // Update merge timer
  state.mergeTimer += delta;

  // Check if ready to merge
  if (state.mergeTimer < state.mergeCooldown) {
    return;
  }

  // Reset timer
  state.mergeTimer = 0;

  // Collect valid enemies within range
  const validEnemies = [];
  playfield.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }
    
    // Skip PsiClusters (they can't be merged again)
    if (enemy.isPsiCluster) {
      return;
    }

    // Skip bosses if not allowed
    if (enemy.isBoss && !state.allowBossMerges) {
      return;
    }

    // Check if within range
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }

    const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
    if (distance <= tower.range) {
      validEnemies.push({ enemy, position });
    }
  });

  // Need at least 2 enemies to merge
  if (validEnemies.length < 2) {
    return;
  }

  // Select targets based on priority and maxMergeCount
  const targetPriority = tower.targetPriority || 'first';
  let selectedEnemies = selectMergeTargets(validEnemies, targetPriority, state.maxMergeCount);

  // Perform the merge
  performMerge(playfield, tower, selectedEnemies, state);
}

/**
 * Select which enemies to merge based on target priority.
 * @param {Array} validEnemies - Array of {enemy, position} objects
 * @param {string} targetPriority - 'first', 'strongest', or 'weakest'
 * @param {number} maxMergeCount - Maximum number of enemies to merge
 * @returns {Array} Selected enemies to merge
 */
function selectMergeTargets(validEnemies, targetPriority, maxMergeCount) {
  let sorted = [...validEnemies];

  if (targetPriority === 'first') {
    // Sort by pathProgress descending (furthest along first)
    sorted.sort((a, b) => (b.enemy.progress || 0) - (a.enemy.progress || 0));
  } else if (targetPriority === 'strongest') {
    // Sort by hp descending, break ties by pathProgress
    sorted.sort((a, b) => {
      const hpA = Number.isFinite(a.enemy.hp) ? a.enemy.hp : (a.enemy.maxHp || 0);
      const hpB = Number.isFinite(b.enemy.hp) ? b.enemy.hp : (b.enemy.maxHp || 0);
      if (hpA !== hpB) {
        return hpB - hpA;
      }
      return (b.enemy.progress || 0) - (a.enemy.progress || 0);
    });
  } else if (targetPriority === 'weakest') {
    // Sort by hp ascending, break ties by pathProgress
    sorted.sort((a, b) => {
      const hpA = Number.isFinite(a.enemy.hp) ? a.enemy.hp : (a.enemy.maxHp || 0);
      const hpB = Number.isFinite(b.enemy.hp) ? b.enemy.hp : (b.enemy.maxHp || 0);
      if (hpA !== hpB) {
        return hpA - hpB;
      }
      return (b.enemy.progress || 0) - (a.enemy.progress || 0);
    });
  }

  // Take only maxMergeCount enemies
  return sorted.slice(0, Math.min(maxMergeCount, sorted.length));
}

/**
 * Merge selected enemies into a PsiCluster.
 * @param {Object} playfield - The playfield instance
 * @param {Object} tower - The psi tower
 * @param {Array} selectedEnemies - Array of {enemy, position} objects to merge
 * @param {Object} state - The psi tower state
 */
function performMerge(playfield, tower, selectedEnemies, state) {
  if (!selectedEnemies || selectedEnemies.length < 2) {
    return;
  }

  // Calculate merged properties
  let totalHp = 0;
  let totalSpeed = 0;
  let totalReward = 0;
  let maxProgress = -Infinity;
  let maxProgressPosition = null;

  selectedEnemies.forEach(({ enemy, position }) => {
    totalHp += Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
    totalSpeed += Number.isFinite(enemy.speed) ? Math.max(0, enemy.speed) : 0;
    totalReward += Number.isFinite(enemy.reward) ? Math.max(0, enemy.reward) : 0;
    
    const progress = Number.isFinite(enemy.progress) ? enemy.progress : 0;
    if (progress > maxProgress) {
      maxProgress = progress;
      maxProgressPosition = position;
    }
  });

  const count = selectedEnemies.length;
  const meanSpeed = count > 0 ? totalSpeed / count : 0;

  // Apply merge speed sub-equation
  const clusterSpeed = Math.pow(Math.max(0, meanSpeed), state.mergeSpeedExponent);

  // Remove merged enemies from the field
  selectedEnemies.forEach(({ enemy }) => {
    // Clear any effects on the enemy
    if (typeof playfield.clearEnemySlowEffects === 'function') {
      playfield.clearEnemySlowEffects(enemy);
    }
    if (typeof playfield.clearEnemyDamageAmplifiers === 'function') {
      playfield.clearEnemyDamageAmplifiers(enemy);
    }

    // Remove from enemies array
    const index = playfield.enemies.indexOf(enemy);
    if (index >= 0) {
      playfield.enemies.splice(index, 1);
    }

    // Clear hover/focus if needed
    if (playfield.hoverEnemy && playfield.hoverEnemy.enemyId === enemy.id) {
      if (typeof playfield.clearEnemyHover === 'function') {
        playfield.clearEnemyHover();
      }
    }
    if (playfield.focusedEnemyId === enemy.id) {
      if (typeof playfield.clearFocusedEnemy === 'function') {
        playfield.clearFocusedEnemy({ silent: true });
      }
    }
  });

  // Get reference enemy properties for cluster appearance
  const firstEnemy = selectedEnemies[0].enemy;
  const clusterSymbol = 'Ψ'; // Capital psi for cluster
  const clusterLabel = `Psi Cluster (${count})`;

  // Spawn PsiCluster
  const cluster = {
    id: (playfield.enemyIdCounter += 1),
    progress: maxProgress,
    hp: totalHp,
    maxHp: totalHp,
    speed: clusterSpeed,
    baseSpeed: clusterSpeed,
    reward: totalReward,
    color: firstEnemy.color || '#8B7FFF',
    label: clusterLabel,
    typeId: 'psi-cluster',
    pathMode: firstEnemy.pathMode || 'path',
    moteFactor: firstEnemy.moteFactor || 1,
    symbol: clusterSymbol,
    polygonSides: firstEnemy.polygonSides || 4,
    hpExponent: playfield.calculateHealthExponent ? playfield.calculateHealthExponent(totalHp) : 1,
    gemDropMultiplier: firstEnemy.gemDropMultiplier || 1,
    // Mark as PsiCluster so it won't be merged again
    isPsiCluster: true,
    // Store original HP for AoE damage calculation
    originalHP_cluster: totalHp,
    // Store AoE parameters for death handling
    psiAoeRadiusMultiplier: state.aoeRadiusMultiplier,
    psiAoeDamageMultiplier: state.aoeDamageMultiplier,
  };

  playfield.enemies.push(cluster);

  // Update HUD and stats
  if (typeof playfield.updateHud === 'function') {
    playfield.updateHud();
  }
  if (typeof playfield.scheduleStatsPanelRefresh === 'function') {
    playfield.scheduleStatsPanelRefresh();
  }
}

/**
 * Handle PsiCluster death AoE effect.
 * Called from playfield when a PsiCluster is defeated.
 * @param {Object} playfield - The playfield instance
 * @param {Object} cluster - The dying PsiCluster enemy
 * @param {Object} deathPosition - Position where the cluster died
 */
export function triggerPsiClusterAoE(playfield, cluster, deathPosition) {
  if (!playfield || !cluster || !cluster.isPsiCluster) {
    return;
  }

  if (!deathPosition) {
    return;
  }

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;

  // Get AoE parameters from cluster
  const aoeRadiusMultiplier = Number.isFinite(cluster.psiAoeRadiusMultiplier) 
    ? cluster.psiAoeRadiusMultiplier 
    : 1.0;
  const aoeDamageMultiplier = Number.isFinite(cluster.psiAoeDamageMultiplier)
    ? cluster.psiAoeDamageMultiplier
    : 1.0;
  const originalHP = Number.isFinite(cluster.originalHP_cluster)
    ? cluster.originalHP_cluster
    : cluster.maxHp || 0;

  // Calculate AoE radius in pixels
  const aoeRadiusMeters = BASE_AOE_RADIUS_METERS * aoeRadiusMultiplier;
  const aoeRadiusPixels = metersToPixels(aoeRadiusMeters, minDimension);

  // Calculate AoE damage
  const aoeDamage = originalHP * aoeDamageMultiplier;

  if (aoeDamage <= 0 || aoeRadiusPixels <= 0) {
    return;
  }

  // Apply damage to all enemies in range
  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy === cluster) {
      return;
    }

    const enemyPosition = playfield.getEnemyPosition(enemy);
    if (!enemyPosition) {
      return;
    }

    const distance = Math.hypot(
      enemyPosition.x - deathPosition.x,
      enemyPosition.y - deathPosition.y
    );

    if (distance <= aoeRadiusPixels) {
      // Apply damage
      const beforeHp = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - aoeDamage);

      // Track damage for stats
      if (typeof playfield.trackTowerDamage === 'function') {
        playfield.trackTowerDamage('psi', aoeDamage);
      }

      // Spawn damage number if enabled
      if (typeof playfield.spawnDamageNumber === 'function') {
        playfield.spawnDamageNumber(enemy, aoeDamage, {
          sourceTower: null,
          enemyHpBefore: beforeHp,
        });
      }

      // Record swirl impact if enabled
      if (typeof playfield.recordEnemySwirlImpact === 'function') {
        playfield.recordEnemySwirlImpact(enemy, {
          sourcePosition: deathPosition,
          damageApplied: aoeDamage,
          enemyHpBefore: beforeHp,
        });
      }

      // Check if enemy died from AoE
      if (enemy.hp <= 0 && typeof playfield.processEnemyDefeat === 'function') {
        playfield.processEnemyDefeat(enemy);
      }
    }
  });

  // Spawn visual effect for AoE (optional - can be added later)
  // This would create a visual burst at deathPosition with radius aoeRadiusPixels
}
