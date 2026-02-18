/**
 * Wave UI Formatter
 * Handles formatting and display logic for wave information in the UI.
 * Extracted from playfield.js as part of Phase 1.1.5 refactoring (Build 459).
 */

import { getEnemyCodexEntry } from '../../codex.js';
import { formatCombatNumber } from '../utils/formatting.js';

/**
 * Factory function to create a wave UI formatter instance.
 * @param {object} config - Configuration object with state accessors
 * @returns {object} Wave UI formatter instance
 */
export function createWaveUIFormatter(config = {}) {
  // Extract state accessors from config
  const getCurrentWaveNumber = config.currentWaveNumber || (() => 1);
  const getWaveIndex = config.waveIndex || (() => 0);
  const getTheroSymbol = config.theroSymbol || (() => 'þ');

  /**
   * Resolve wave configuration into normalized enemy groups.
   * @param {object} config - Wave configuration
   * @returns {Array} Array of normalized enemy group objects
   */
  function resolveWaveGroups(config = null) {
    if (!config) {
      return [];
    }

    const base = {
      hp: Number.isFinite(config.hp) ? config.hp : 0,
      speed: Number.isFinite(config.speed) ? config.speed : 0,
      reward: Number.isFinite(config.reward) ? config.reward : 0,
      color: config.color || null,
      codexId: config.codexId || null,
      label: config.label || null,
      symbol: config.symbol || null,
    };

    const normalizeGroup = (group = {}) => {
      const count = Number.isFinite(group.count) ? Math.max(0, Math.floor(group.count)) : 0;
      const hp = Number.isFinite(group.hp) ? Math.max(0, group.hp) : base.hp;
      const speed = Number.isFinite(group.speed) ? group.speed : base.speed;
      const reward = Number.isFinite(group.reward) ? group.reward : base.reward;
      return {
        count,
        hp,
        speed,
        reward,
        color: group.color || base.color,
        codexId: group.codexId || base.codexId,
        label: group.label || base.label,
        symbol: group.symbol || base.symbol,
        enemyType: group.enemyType || null,
        interval: Number.isFinite(group.interval) ? group.interval : null,
      };
    };

    let groups = [];
    if (Array.isArray(config.enemyGroups) && config.enemyGroups.length) {
      groups = config.enemyGroups.map((group) => normalizeGroup(group));
    } else {
      const minionCount = Number.isFinite(config.minionCount)
        ? Math.max(0, Math.floor(config.minionCount))
        : Number.isFinite(config.count)
          ? Math.max(0, Math.floor(config.count - (config.boss ? 1 : 0)))
          : 0;
      if (minionCount > 0) {
        groups = [normalizeGroup({ ...config, count: minionCount })];
      }
    }

    return groups.filter((group) => group.count > 0);
  }

  /**
   * Calculate health exponent for scientific notation display.
   * @param {number} hp - Health points value
   * @returns {number} Exponent value
   */
  function calculateHealthExponent(hp) {
    if (!Number.isFinite(hp) || hp <= 0) {
      return 0;
    }
    const clampedHp = Math.max(1, hp);
    const rawExponent = Math.log10(clampedHp);
    // Floor the exponent to the nearest tenth so scientific-notation tiers only advance after surpassing the threshold.
    const flooredExponent = Math.floor(rawExponent * 10) / 10;
    return Number.isFinite(flooredExponent) ? flooredExponent : 0;
  }

  /**
   * Format enemy health with exponent label.
   * @param {number} exponent - Health exponent
   * @param {number} hpValue - Actual HP value
   * @returns {string} Formatted label
   */
  function formatEnemyExponentLabel(exponent, hpValue) {
    const resolvedExponent = Number.isFinite(exponent)
      ? exponent
      : calculateHealthExponent(hpValue);
    const exponentLabel = Number.isFinite(resolvedExponent)
      ? `10^${resolvedExponent.toFixed(1)}`
      : '10^0.0';
    const hpLabel = formatCombatNumber(Math.max(0, hpValue || 0));
    return `${exponentLabel} (${hpLabel})`;
  }

  /**
   * Format an enemy speed value for UI consumption.
   * @param {number} speed - Speed value
   * @returns {string} Formatted speed
   */
  function formatEnemySpeed(speed) {
    if (!Number.isFinite(speed)) {
      return '—';
    }
    return `${Math.max(0, speed).toFixed(3)} path/s`;
  }

  /**
   * Resolve polygon symbol based on number of sides.
   * @param {number} sides - Number of sides
   * @returns {string|null} Polygon symbol or null
   */
  function resolvePolygonSymbol(sides) {
    const normalized = Number.isFinite(sides) ? Math.max(1, Math.floor(sides)) : 0;
    if (normalized >= 6) {
      return '⬢';
    }
    if (normalized === 5) {
      return '⬟';
    }
    if (normalized === 4) {
      return '⬦';
    }
    if (normalized === 3) {
      return '△';
    }
    if (normalized === 2) {
      return '―';
    }
    if (normalized === 1) {
      return '·';
    }
    return null;
  }

  /**
   * Resolve enemy symbol from configuration.
   * @param {object} config - Enemy configuration
   * @returns {string} Enemy symbol
   */
  function resolveEnemySymbol(config = {}) {
    if (config && typeof config.polygonSides !== 'undefined') {
      const polygonSymbol = resolvePolygonSymbol(config.polygonSides);
      if (polygonSymbol) {
        return polygonSymbol;
      }
    }
    if (config && typeof config.symbol === 'string') {
      const trimmed = config.symbol.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (config && typeof config.codexId === 'string') {
      const codexEntry = getEnemyCodexEntry(config.codexId);
      if (codexEntry && typeof codexEntry.symbol === 'string') {
        const trimmed = codexEntry.symbol.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    if (config && typeof config.label === 'string') {
      const trimmed = config.label.trim();
      if (trimmed) {
        return trimmed.charAt(0).toUpperCase();
      }
    }
    return '◈';
  }

  /**
   * Convert a wave configuration into formatted queue entries for UI rendering.
   * @param {object} config - Wave configuration
   * @param {object} options - Display options
   * @returns {Array} Formatted wave entries
   */
  function buildWaveEntries(config, {
    spawned = 0,
    waveNumber = getCurrentWaveNumber(),
    label = '',
    waveIndex = getWaveIndex(),
    isCurrent = false,
  } = {}) {
    if (!config) {
      return [];
    }

    const entries = [];
    const groups = resolveWaveGroups(config);
    const hasBoss = Boolean(config.boss && typeof config.boss === 'object');
    const totalMinionCount = groups.reduce(
      (sum, group) => sum + Math.max(0, Math.floor(group.count || 0)),
      0,
    );
    const totalSpawnCount = totalMinionCount + (hasBoss ? 1 : 0);
    const normalizedSpawned = Number.isFinite(spawned) ? Math.max(0, Math.floor(spawned)) : 0;
    const clampedSpawned = Math.min(normalizedSpawned, totalSpawnCount);
    const spawnedMinions = Math.min(clampedSpawned, totalMinionCount);
    const bossAlreadySpawned = hasBoss && clampedSpawned > totalMinionCount;
    const bossRemaining = hasBoss && !bossAlreadySpawned ? 1 : 0;
    const theroSymbol = getTheroSymbol();

    const resolveEnemyName = (source = {}) => {
      if (source.label) {
        return source.label;
      }
      if (source.codexId) {
        const codex = getEnemyCodexEntry(source.codexId);
        if (codex?.name) {
          return codex.name;
        }
      }
      return 'Glyph';
    };

    const waveSubtitle = () => {
      if (!Number.isFinite(waveNumber)) {
        return label;
      }
      return label ? `Wave ${waveNumber} · ${label}` : `Wave ${waveNumber}`;
    };

    const createDialogRows = (details = {}) => {
      // Determine the total count to display so future waves and bosses show the correct denominator.
      const totalCount = Number.isFinite(details.totalCount)
        ? Math.max(0, Math.floor(details.totalCount))
        : totalSpawnCount;

      return [
        Number.isFinite(waveNumber)
          ? { label: 'Wave', value: String(waveSubtitle()) }
          : null,
        { label: 'Enemy', value: resolveEnemyName(details) },
        {
          label: isCurrent ? 'Remaining' : 'Count',
          value: isCurrent
            ? `${Math.max(0, details.remaining)}/${totalCount}`
            : `${totalCount}`,
        },
        {
          label: 'HP',
          value: formatEnemyExponentLabel(
            calculateHealthExponent(details.hp),
            details.hp,
          ),
        },
        {
          label: 'Reward',
          value: `${formatCombatNumber(Math.max(0, details.reward || 0))} ${theroSymbol}`,
        },
        {
          label: 'Speed',
          value: formatEnemySpeed(details.speed),
        },
        Number.isFinite(details.interval)
          ? { label: 'Spawn Interval', value: `${details.interval.toFixed(2)} s` }
          : null,
          Number.isFinite(config.delay)
            ? { label: 'Wave Delay', value: `${Math.max(0, config.delay).toFixed(2)} s` }
            : null,
      ].filter(Boolean);
    };

    let remainingSpawned = spawnedMinions;

    groups.forEach((group, index) => {
      const groupCount = Math.max(0, Math.floor(group.count || 0));
      if (!groupCount) {
        return;
      }
      const spawnedInGroup = Math.min(groupCount, remainingSpawned);
      remainingSpawned -= spawnedInGroup;
      const remaining = isCurrent ? Math.max(0, groupCount - spawnedInGroup) : groupCount;
      const symbol = resolveEnemySymbol(group);
      const enemyName = resolveEnemyName(group);
      const exponent = calculateHealthExponent(group.hp);
      const hpLabel = formatEnemyExponentLabel(exponent, group.hp);
      const rewardLabel = `${formatCombatNumber(Math.max(0, group.reward || 0))} ${theroSymbol}`;
      const title = `${symbol} — ${enemyName}`;
      entries.push({
        id: `${isCurrent ? 'current' : 'next'}-${waveIndex}-group-${index}`,
        title,
        subtitle: waveSubtitle(),
        meta: [
          {
            text: isCurrent
              ? `Remaining ${remaining}/${groupCount}`
              : `Count ${groupCount}`,
            emphasize: true,
          },
          { text: `HP ${hpLabel}` },
          { text: `Reward ${rewardLabel}` },
          { text: `Speed ${formatEnemySpeed(group.speed)}` },
        ],
        footnote: null,
        dialog: {
          title,
          rows: createDialogRows({
            remaining,
            hp: group.hp,
            reward: group.reward,
            speed: group.speed,
            interval: Number.isFinite(group.interval) ? group.interval : config.interval,
            // Ensure the dialog reflects the exact enemy count for the current group.
            totalCount: groupCount,
          }),
        },
      });
    });

    if (bossRemaining > 0 || (!isCurrent && hasBoss)) {
      const bossConfig = { ...config, ...(config.boss || {}) };
      const symbol = typeof bossConfig.symbol === 'string'
        ? bossConfig.symbol
        : resolveEnemySymbol(bossConfig);
      const bossName = bossConfig.label || `Boss ${resolveEnemyName(config)}`;
      const exponent = calculateHealthExponent(bossConfig.hp);
      const hpLabel = formatEnemyExponentLabel(exponent, bossConfig.hp);
      const rewardLabel = `${formatCombatNumber(Math.max(0, bossConfig.reward || 0))} ${theroSymbol}`;
      const title = `${symbol} — ${bossName}`;
      entries.push({
        id: `${isCurrent ? 'current' : 'next'}-${waveIndex}-boss`,
        title,
        subtitle: waveSubtitle(),
        meta: [
          { text: `Remaining ${bossRemaining}/${bossRemaining || 1}`, emphasize: true },
          { text: `HP ${hpLabel}` },
          { text: `Reward ${rewardLabel}` },
          { text: `Speed ${formatEnemySpeed(bossConfig.speed)}` },
        ],
        footnote: 'Boss enemy spawns at the end of the wave.',
        dialog: {
          title,
          rows: createDialogRows({
            remaining: bossRemaining,
            hp: bossConfig.hp,
            reward: bossConfig.reward,
            speed: bossConfig.speed,
            interval: config.interval,
            // Boss entries always represent a single target regardless of remaining count.
            totalCount: hasBoss ? 1 : bossRemaining,
          }),
        },
      });
    }

    return entries;
  }

  // Return the public API
  return {
    buildWaveEntries,
    resolveWaveGroups,
    calculateHealthExponent,
    formatEnemyExponentLabel,
    formatEnemySpeed,
    resolveEnemySymbol,
    resolvePolygonSymbol,
  };
}
