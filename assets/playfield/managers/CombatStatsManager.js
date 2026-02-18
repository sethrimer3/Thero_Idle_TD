// Combat statistics manager extracted from SimplePlayfield for tracking tower performance and enemy history.
// Manages combat session lifecycle, damage/kill recording, tower summaries, and stats panel updates.

import * as StatsPanel from '../../playfieldStatsPanel.js';

/**
 * Create a factory function that returns combat stats management methods bound to playfield context.
 * @param {Object} config - Configuration object
 * @param {Function} config.getTowers - Function to get current towers array
 * @param {Function} config.buildCurrentWaveQueue - Function to build current wave queue for display
 * @param {Function} config.buildNextWaveQueue - Function to build next wave queue for display
 * @param {Function} config.buildActiveEnemyEntries - Function to build active enemy list
 * @returns {Object} Combat stats manager with methods
 */
export function createCombatStatsManager(config = {}) {
  const {
    getTowers = () => [],
    buildCurrentWaveQueue = () => ({ entries: [] }),
    buildNextWaveQueue = () => ({ entries: [] }),
    buildActiveEnemyEntries = () => [],
  } = config;

  // Internal state
  let combatStats = createCombatStatsContainer();
  let statsPanelEnabled = false;
  let statsDirty = false;
  let statsLastRender = 0;

  /**
   * Create a fresh combat stats container.
   * @returns {Object} Empty stats container
   */
  function createCombatStatsContainer() {
    return {
      active: false,
      elapsed: 0,
      towerInstances: new Map(),
      // Incremental index assigned to each unique placement so summaries can disambiguate duplicates.
      placementCount: 0,
      attackLog: [],
      enemyHistory: [],
    };
  }

  /**
   * Reset combat stats to empty state.
   */
  function resetCombatStats() {
    combatStats = createCombatStatsContainer();
    statsDirty = false;
    statsLastRender = 0;
    if (typeof StatsPanel.resetPanel === 'function') {
      StatsPanel.resetPanel();
    }
  }

  /**
   * Enable or disable stats panel visibility.
   * @param {boolean} enabled - Whether stats panel should be visible
   */
  function setStatsPanelEnabled(enabled) {
    statsPanelEnabled = Boolean(enabled);
    if (typeof StatsPanel.setVisible === 'function') {
      StatsPanel.setVisible(statsPanelEnabled);
    }
    if (statsPanelEnabled) {
      refreshStatsPanel({ force: true });
    }
  }

  /**
   * Ensure a tower has a stats entry in the combat stats.
   * Creates a new entry if it doesn't exist.
   * @param {Object} tower - Tower instance
   * @returns {Object|null} Stats entry for the tower
   */
  function ensureTowerStatsEntry(tower) {
    if (!tower || !tower.id || !combatStats) {
      return null;
    }
    let entry = combatStats.towerInstances.get(tower.id);
    if (!entry) {
      // Assign a unique placement index so identical tower types remain distinguishable in the UI.
      const nextIndex = Number.isFinite(combatStats.placementCount)
        ? combatStats.placementCount + 1
        : 1;
      combatStats.placementCount = nextIndex;
      entry = {
        id: tower.id,
        type: tower.type,
        totalDamage: 0,
        killCount: 0,
        activeTime: 0,
        placementIndex: nextIndex,
        firstPlacedAt: Number.isFinite(combatStats.elapsed)
          ? Math.max(0, combatStats.elapsed)
          : 0,
      };
      combatStats.towerInstances.set(tower.id, entry);
    }
    entry.type = tower.type;
    entry.isActive = true;
    return entry;
  }

  /**
   * Start a combat stats tracking session.
   * Initializes stats for all active towers.
   */
  function startCombatStatsSession() {
    resetCombatStats();
    combatStats.active = true;
    const towers = getTowers();
    if (Array.isArray(towers)) {
      towers.forEach((tower) => ensureTowerStatsEntry(tower));
    }
    scheduleStatsPanelRefresh();
    if (statsPanelEnabled) {
      refreshStatsPanel({ force: true });
    }
  }

  /**
   * Stop the combat stats tracking session.
   */
  function stopCombatStatsSession() {
    if (combatStats) {
      combatStats.active = false;
    }
    scheduleStatsPanelRefresh();
    if (statsPanelEnabled) {
      refreshStatsPanel({ force: true });
    }
  }

  /**
   * Mark stats panel as dirty to trigger refresh on next update.
   */
  function scheduleStatsPanelRefresh() {
    statsDirty = true;
  }

  /**
   * Append an attack log entry for a tower's damage event.
   * Merges consecutive attacks from the same tower type.
   * @param {Object} tower - Tower that dealt damage
   * @param {number} damage - Damage amount
   */
  function appendAttackLogEntry(tower, damage) {
    if (!combatStats || !tower) {
      return;
    }
    const value = Number.isFinite(damage) ? Math.max(0, damage) : 0;
    if (value <= 0) {
      return;
    }
    const log = combatStats.attackLog;
    const maxEntries = 60;
    const last = log[0];
    if (last && last.type === tower.type) {
      last.damage += value;
      last.events = (last.events || 1) + 1;
      last.timestamp = combatStats.elapsed;
      return;
    }
    log.unshift({
      type: tower.type,
      damage: value,
      events: 1,
      timestamp: combatStats.elapsed,
    });
    if (log.length > maxEntries) {
      log.length = maxEntries;
    }
  }

  /**
   * Record a damage event for a tower.
   * Updates tower stats and enemy damage contributors.
   * @param {Object} options - { tower, enemy, damage }
   */
  function recordDamageEvent({ tower, enemy = null, damage = 0 } = {}) {
    if (!tower || !Number.isFinite(damage) || damage <= 0 || !combatStats) {
      return;
    }
    const entry = ensureTowerStatsEntry(tower);
    if (entry) {
      entry.totalDamage = (entry.totalDamage || 0) + damage;
    }
    if (enemy) {
      if (!(enemy.damageContributors instanceof Map)) {
        enemy.damageContributors = new Map();
      }
      const previous = enemy.damageContributors.get(tower.type) || 0;
      enemy.damageContributors.set(tower.type, previous + damage);
    }
    appendAttackLogEntry(tower, damage);
    scheduleStatsPanelRefresh();
  }

  /**
   * Record a kill event for a tower.
   * Increments the tower's kill count.
   * @param {Object} tower - Tower that got the kill
   */
  function recordKillEvent(tower) {
    if (!tower || !combatStats) {
      return;
    }
    const entry = ensureTowerStatsEntry(tower);
    if (!entry) {
      return;
    }
    entry.killCount = (entry.killCount || 0) + 1;
    scheduleStatsPanelRefresh();
  }

  /**
   * Build tower performance summaries sorted by total damage.
   * @returns {Array} Array of tower summary objects
   */
  function buildTowerSummaries() {
    if (!combatStats) {
      return [];
    }
    const summaries = [];
    combatStats.towerInstances.forEach((instance) => {
      if (!instance || !instance.type) {
        return;
      }
      const totalDamage = Number.isFinite(instance.totalDamage) ? Math.max(0, instance.totalDamage) : 0;
      const activeTime = Number.isFinite(instance.activeTime) ? Math.max(0, instance.activeTime) : 0;
      summaries.push({
        id: instance.id,
        type: instance.type,
        totalDamage,
        killCount: Number.isFinite(instance.killCount) ? Math.max(0, instance.killCount) : 0,
        activeTime,
        averageDps: activeTime > 0 ? totalDamage / activeTime : 0,
        isActive: Boolean(instance.isActive),
        placementIndex: Number.isFinite(instance.placementIndex) ? instance.placementIndex : null,
        firstPlacedAt: Number.isFinite(instance.firstPlacedAt) ? instance.firstPlacedAt : 0,
        retiredAt: Number.isFinite(instance.retiredAt) ? instance.retiredAt : null,
      });
    });
    return summaries.sort((a, b) => b.totalDamage - a.totalDamage);
  }

  /**
   * Capture enemy history entry when an enemy is defeated.
   * Records top damage contributors for analytics.
   * @param {Object} enemy - Defeated enemy
   */
  function captureEnemyHistory(enemy) {
    if (!enemy || !combatStats) {
      return;
    }
    const contributors = enemy.damageContributors instanceof Map
      ? Array.from(enemy.damageContributors.entries())
      : [];
    const topContributors = contributors
      .map(([type, amount]) => ({ type, damage: Number.isFinite(amount) ? Math.max(0, amount) : 0 }))
      .filter((entry) => entry.damage > 0)
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 3);
    const historyEntry = {
      id: enemy.id,
      label: enemy.label || enemy.symbol || 'Enemy',
      hp: Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : Math.max(0, enemy.hp || 0),
      topContributors,
      timestamp: combatStats.elapsed,
    };
    combatStats.enemyHistory.unshift(historyEntry);
    const maxEntries = 40;
    if (combatStats.enemyHistory.length > maxEntries) {
      combatStats.enemyHistory.length = maxEntries;
    }
    scheduleStatsPanelRefresh();
  }

  /**
   * Refresh the stats panel with current data.
   * @param {Object} options - { force: boolean }
   */
  function refreshStatsPanel({ force = false } = {}) {
    if (!combatStats) {
      return;
    }
    if (!statsPanelEnabled && !force) {
      statsDirty = false;
      return;
    }
    const summaries = buildTowerSummaries();
    if (typeof StatsPanel.renderTowerSummaries === 'function') {
      StatsPanel.renderTowerSummaries(summaries);
    }
    if (typeof StatsPanel.renderAttackLog === 'function') {
      StatsPanel.renderAttackLog(combatStats.attackLog.slice(0, 40));
    }
    if (typeof StatsPanel.renderEnemyHistory === 'function') {
      StatsPanel.renderEnemyHistory(combatStats.enemyHistory.slice(0, 24));
    }
    if (typeof StatsPanel.renderCurrentWaveQueue === 'function') {
      StatsPanel.renderCurrentWaveQueue(buildCurrentWaveQueue());
    }
    if (typeof StatsPanel.renderNextWaveQueue === 'function') {
      StatsPanel.renderNextWaveQueue(buildNextWaveQueue());
    }
    if (typeof StatsPanel.renderActiveEnemyList === 'function') {
      StatsPanel.renderActiveEnemyList(buildActiveEnemyEntries());
    }
    statsDirty = false;
    statsLastRender = combatStats.elapsed;
  }

  /**
   * Update combat stats elapsed time and tower active times.
   * Called each frame during active combat.
   * @param {number} delta - Time delta in seconds
   */
  function updateCombatStats(delta) {
    if (!combatStats || !combatStats.active) {
      return;
    }
    const step = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    combatStats.elapsed += step;
    const activeIds = new Set();
    const towers = getTowers();
    towers.forEach((tower) => {
      const entry = ensureTowerStatsEntry(tower);
      if (entry) {
        entry.activeTime = (entry.activeTime || 0) + step;
        activeIds.add(tower.id);
      }
    });
    combatStats.towerInstances.forEach((entry, towerId) => {
      if (!activeIds.has(towerId) && entry) {
        entry.isActive = false;
      }
    });
    if (statsPanelEnabled && statsDirty) {
      const elapsedSinceRender = combatStats.elapsed - statsLastRender;
      if (elapsedSinceRender >= 0.25) {
        refreshStatsPanel();
      }
    }
  }

  /**
   * Get the combat stats container (for external access).
   * @returns {Object} Combat stats container
   */
  function getCombatStats() {
    return combatStats;
  }

  /**
   * Get whether stats panel is enabled.
   * @returns {boolean} Stats panel enabled state
   */
  function getStatsPanelEnabled() {
    return statsPanelEnabled;
  }

  return {
    // Lifecycle
    startCombatStatsSession,
    stopCombatStatsSession,
    resetCombatStats,
    updateCombatStats,
    
    // Configuration
    setStatsPanelEnabled,
    getStatsPanelEnabled,
    
    // Event recording
    recordDamageEvent,
    recordKillEvent,
    captureEnemyHistory,
    
    // Data building
    buildTowerSummaries,
    ensureTowerStatsEntry,
    
    // Panel refresh
    refreshStatsPanel,
    scheduleStatsPanelRefresh,
    
    // State access
    getCombatStats,
    createCombatStatsContainer,
  };
}
