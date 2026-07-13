// Wave queue system extracted from SimplePlayfield for modular wave queue building,
// scaling, and active-enemy entry generation.
// Handles buildCurrentWaveQueue, buildNextWaveQueue, buildActiveEnemyEntries,
// createWaveState, scaleWaveConfigForCycle, getCycleMultiplierFor, getCycleSpeedScalarFor.

import { formatCombatNumber } from '../utils/formatting.js';

/**
 * Generate formatted entries for the currently active wave queue.
 */
export function buildCurrentWaveQueue() {
  if (!this.levelConfig) {
    return { entries: [] };
  }

  let config = null;
  let spawned = 0;
  let waveLabel = '';
  let waveNumber = this.currentWaveNumber || this.computeWaveNumber(this.waveIndex);

  if (this.activeWave?.config) {
    config = this.activeWave.config;
    spawned = Number.isFinite(this.activeWave.spawned) ? Math.max(0, this.activeWave.spawned) : 0;
    waveLabel = config.label || '';
    waveNumber = this.currentWaveNumber || waveNumber;
  } else {
    const baseConfig = Array.isArray(this.levelConfig.waves)
      ? this.levelConfig.waves[this.waveIndex]
      : null;
    if (!baseConfig) {
      return { entries: [] };
    }
    config = this.scaleWaveConfigForCycle(baseConfig, this.endlessCycle);
    waveLabel = config.label || baseConfig.label || '';
    spawned = 0;
  }

  return {
    entries: this.buildWaveEntries(config, {
      spawned,
      waveNumber,
      label: waveLabel,
      waveIndex: this.waveIndex,
      isCurrent: true,
    }),
  };
}

/**
 * Generate formatted entries for the next wave preview so players can scout ahead.
 */
export function buildNextWaveQueue() {
  if (!this.levelConfig || !Array.isArray(this.levelConfig.waves)) {
    return { entries: [] };
  }
  const waves = this.levelConfig.waves;
  if (!waves.length) {
    return { entries: [] };
  }

  const waveCount = waves.length;
  if (!waveCount) {
    return { entries: [] };
  }

  let nextIndex = Number.isFinite(this.waveIndex) ? this.waveIndex + 1 : 0;
  let cycle = Number.isFinite(this.endlessCycle) ? this.endlessCycle : 0;
  cycle = Math.max(0, cycle);

  if (nextIndex < 0) {
    nextIndex = 0;
  }

  if (nextIndex >= waveCount) {
    if (!this.isEndlessMode) {
      return { entries: [] };
    }
    const cycleJump = Math.floor(nextIndex / waveCount);
    nextIndex %= waveCount;
    cycle += cycleJump;
  }

  const baseConfig = waves[nextIndex];
  if (!baseConfig) {
    return { entries: [] };
  }

  const scaled = this.scaleWaveConfigForCycle(baseConfig, cycle);
  const total = Math.max(1, this.baseWaveCount || waveCount);
  const waveNumber = this.isEndlessMode
    ? cycle * total + nextIndex + 1
    : nextIndex + 1;
  const waveLabel = scaled.label || baseConfig.label || '';

  return {
    entries: this.buildWaveEntries(scaled, {
      spawned: 0,
      waveNumber,
      label: waveLabel,
      waveIndex: nextIndex,
      isCurrent: false,
    }),
  };
}

/**
 * Build formatted entries for all on-screen enemies so the stats panel can update live.
 */
export function buildActiveEnemyEntries() {
  if (!Array.isArray(this.enemies) || !this.enemies.length) {
    return [];
  }
  const theroSymbol = this.theroSymbol || 'þ';
  const waveLabel = this.activeWave?.config?.label || '';
  const waveNumber = this.currentWaveNumber || this.computeWaveNumber(this.waveIndex);

  const entries = this.enemies
    .map((enemy) => {
      if (!enemy || !Number.isFinite(enemy.id)) {
        return null;
      }
      const symbol = typeof enemy.symbol === 'string'
        ? enemy.symbol
        : this.resolveEnemySymbol(enemy);
      const label = enemy.label || symbol || 'Glyph';
      const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
      const maxHp = Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : remainingHp;
      const exponent = this.calculateHealthExponent(remainingHp > 0 ? remainingHp : maxHp);
      const maxExponent = this.calculateHealthExponent(maxHp);
      const reward = Number.isFinite(enemy.reward) ? Math.max(0, enemy.reward) : 0;
      const rows = [
        { label: 'Status', value: enemy.isBoss ? 'Boss' : 'Standard' },
        {
          label: 'Current HP',
          value: this.formatEnemyExponentLabel(exponent, remainingHp),
        },
        {
          label: 'Max HP',
          value: this.formatEnemyExponentLabel(maxExponent, maxHp),
        },
        {
          label: 'Reward',
          value: `${formatCombatNumber(reward)} ${theroSymbol}`,
        },
        { label: 'Speed', value: this.formatEnemySpeed(enemy.speed) },
      ];

      if (Number.isFinite(enemy.baseSpeed) && Math.abs(enemy.baseSpeed - enemy.speed) > 0.0001) {
        rows.push({ label: 'Base Speed', value: this.formatEnemySpeed(enemy.baseSpeed) });
      }
      if (Number.isFinite(enemy.gemDropMultiplier)) {
        rows.push({ label: 'Gem Multiplier', value: `×${enemy.gemDropMultiplier.toFixed(2)}` });
      }
      if (Number.isFinite(enemy.moteFactor)) {
        rows.push({ label: 'Mote Yield', value: formatCombatNumber(enemy.moteFactor) });
      }
      if (Number.isFinite(waveNumber)) {
        rows.unshift({ label: 'Wave', value: waveLabel ? `Wave ${waveNumber} · ${waveLabel}` : `Wave ${waveNumber}` });
      }

      const priority = maxHp > 0 ? maxHp : remainingHp;

      return {
        id: enemy.id,
        focusEnemyId: enemy.id,
        priority,
        title: `${symbol} — ${label}`,
        subtitle: waveLabel && Number.isFinite(waveNumber)
          ? `Wave ${waveNumber} · ${waveLabel}`
          : Number.isFinite(waveNumber)
            ? `Wave ${waveNumber}`
            : waveLabel,
        meta: [
          { text: `HP ${this.formatEnemyExponentLabel(exponent, remainingHp)}`, emphasize: true },
          { text: `Reward ${formatCombatNumber(reward)} ${theroSymbol}` },
          { text: `Speed ${this.formatEnemySpeed(enemy.speed)}` },
        ],
        footnote: enemy.isBoss ? 'Boss enemy currently on the field.' : null,
        dialog: {
          title: `${symbol} — ${label}`,
          rows,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return entries.map(({ priority: _priority, ...entry }) => entry);
}

/**
 * Create internal wave state from a wave configuration.
 * Kept for backward compatibility during migration — the CombatStateManager
 * now creates wave states internally.
 */
export function createWaveState(config, options = {}) {
  if (!config) {
    return null;
  }
  const { initialWave = false } = options;
  const multiplier = this.getCycleMultiplier();
  // Apply a 10× health jump per endless cycle while boosting speed by 10% additively.
  const speedScalar = this.getCycleSpeedScalar();
  const resolvedGroups = this.resolveWaveGroups(config);
  const scaledGroups = resolvedGroups.map((group) => ({
    ...group,
    hp: Number.isFinite(group.hp) ? group.hp * multiplier : group.hp,
    speed: Number.isFinite(group.speed) ? group.speed * speedScalar : group.speed,
    reward: Number.isFinite(group.reward) ? group.reward * multiplier : group.reward,
  }));
  const totalMinionCount = scaledGroups.reduce(
    (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
    0,
  );
  const primaryGroup = scaledGroups[0] || null;

  const scaledConfig = {
    ...config,
    enemyGroups: scaledGroups,
    minionCount: totalMinionCount,
    hp: primaryGroup ? primaryGroup.hp : Number.isFinite(config.hp) ? config.hp * multiplier : config.hp,
    speed: primaryGroup ? primaryGroup.speed : Number.isFinite(config.speed) ? config.speed * speedScalar : config.speed,
    reward: primaryGroup
      ? primaryGroup.reward
      : Number.isFinite(config.reward)
        ? config.reward * multiplier
        : config.reward,
  };

  // Mirror the cycle scaling onto any boss variant attached to the wave.
  if (config.boss && typeof config.boss === 'object') {
    const scaledBoss = { ...config.boss };
    if (Number.isFinite(scaledBoss.hp)) {
      scaledBoss.hp *= multiplier;
    }
    if (Number.isFinite(scaledBoss.speed)) {
      scaledBoss.speed *= speedScalar;
    }
    if (Number.isFinite(scaledBoss.reward)) {
      scaledBoss.reward *= multiplier;
    }
    scaledConfig.boss = scaledBoss;
  } else {
    scaledConfig.boss = null;
  }

  const bossCount = scaledConfig.boss ? 1 : 0;
  scaledConfig.count = totalMinionCount + bossCount;

  return {
    config: scaledConfig,
    spawned: 0,
    nextSpawn: initialWave ? this.initialSpawnDelay : 0,
    multiplier,
  };
}

/**
 * Resolve the endless cycle multiplier for an arbitrary cycle value.
 */
export function getCycleMultiplierFor(cycle = this.endlessCycle) {
  if (!this.isEndlessMode) {
    return 1;
  }
  if (!Number.isFinite(cycle)) {
    return this.getCycleMultiplier();
  }
  return 10 ** Math.max(0, cycle);
}

/**
 * Resolve the endless cycle speed scalar for an arbitrary cycle value.
 */
export function getCycleSpeedScalarFor(cycle = this.endlessCycle) {
  if (!this.isEndlessMode) {
    return 1;
  }
  if (!Number.isFinite(cycle)) {
    return this.getCycleSpeedScalar();
  }
  return 1 + Math.max(0, cycle) * 0.1;
}

/**
 * Produce a scaled wave configuration without mutating the original level data.
 */
export function scaleWaveConfigForCycle(waveConfig, cycle = this.endlessCycle) {
  if (!waveConfig) {
    return null;
  }
  const multiplier = this.getCycleMultiplierFor(cycle);
  const speedScalar = this.getCycleSpeedScalarFor(cycle);
  const scaled = { ...waveConfig };
  const resolvedGroups = this.resolveWaveGroups(waveConfig);
  const scaledGroups = resolvedGroups.map((group) => ({
    ...group,
    hp: Number.isFinite(group.hp) ? group.hp * multiplier : group.hp,
    speed: Number.isFinite(group.speed) ? group.speed * speedScalar : group.speed,
    reward: Number.isFinite(group.reward) ? group.reward * multiplier : group.reward,
  }));
  const totalMinions = scaledGroups.reduce(
    (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
    0,
  );
  const primaryGroup = scaledGroups[0] || null;
  scaled.enemyGroups = scaledGroups;
  scaled.minionCount = totalMinions;
  if (primaryGroup) {
    scaled.hp = primaryGroup.hp;
    scaled.speed = primaryGroup.speed;
    scaled.reward = primaryGroup.reward;
    scaled.color = primaryGroup.color;
    scaled.codexId = primaryGroup.codexId;
    scaled.label = primaryGroup.label;
  } else {
    if (Number.isFinite(scaled.hp)) {
      scaled.hp *= multiplier;
    }
    if (Number.isFinite(scaled.speed)) {
      scaled.speed *= speedScalar;
    }
    if (Number.isFinite(scaled.reward)) {
      scaled.reward *= multiplier;
    }
  }
  if (scaled.boss && typeof scaled.boss === 'object') {
    scaled.boss = { ...scaled.boss };
    if (Number.isFinite(scaled.boss.hp)) {
      scaled.boss.hp *= multiplier;
    }
    if (Number.isFinite(scaled.boss.speed)) {
      scaled.boss.speed *= speedScalar;
    }
    if (Number.isFinite(scaled.boss.reward)) {
      scaled.boss.reward *= multiplier;
    }
  }
  scaled.count = totalMinions + (scaled.boss ? 1 : 0);
  return scaled;
}
