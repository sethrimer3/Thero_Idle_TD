// Tower Orchestration Controller - Extracted from playfield.js (Build 448)
// Manages tower placement, upgrades, removal, and connection management

import {
  getTowerDefinition,
  getNextTowerId,
  getPreviousTowerId,
  isTowerUnlocked,
  unlockTower,
  refreshTowerLoadoutDisplay,
} from '../../../towersTab.js';
import { notifyTowerPlaced } from '../../../achievementsTab.js';
import { formatCombatNumber } from '../../../scripts/core/formatting.js';

/**
 * Creates a tower orchestration controller that handles tower lifecycle operations.
 * This controller is a stateful factory that encapsulates tower placement, upgrade,
 * and connection logic previously embedded in the monolithic SimplePlayfield class.
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.playfield - Reference to parent playfield for canvas operations
 * @param {Object} config.combatState - Combat state manager for energy/resource access
 * @param {Object} config.towerManager - Tower manager for behavior initialization
 * @param {Object} config.audio - Audio manager for sound effects
 * @param {HTMLElement} config.messageEl - Message element for user feedback
 * @param {Object} config.dependencies - Dependencies object with updateStatusDisplays method
 * @param {string} config.theroSymbol - Symbol for energy currency
 * @returns {Object} Tower orchestration controller API
 */
export function createTowerOrchestrationController(config) {
  // Validate required configuration
  if (!config || !config.playfield) {
    throw new Error('TowerOrchestrationController requires playfield in config');
  }

  // State
  let towers = [];
  let infinityTowers = [];
  let towerIdCounter = 0;
  let towerConnectionMap = new Map();
  let towerConnectionSources = new Map();
  let towerGlyphTransitions = new Map();

  // References to external systems
  const playfield = config.playfield;
  const combatState = config.combatState;
  const towerManager = config.towerManager;
  const audio = config.audio;
  const messageEl = config.messageEl;
  const dependencies = config.dependencies;
  const theroSymbol = config.theroSymbol || 'Θ';

  /**
   * Add a tower at the specified normalized position.
   * Handles both new placement and merging with existing towers of the same type.
   * 
   * @param {Object} normalized - Normalized position {x, y}
   * @param {Object} options - Placement options
   * @returns {boolean} True if placement succeeded
   */
  function addTowerAt(normalized, options = {}) {
    const {
      slot = null,
      allowPathOverlap = false,
      silent = false,
      towerType = null,
    } = options;

    if (!playfield.levelConfig || !normalized) {
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const selectedType = towerType || playfield.draggingTowerType || playfield.availableTowers[0];
    const definition = getTowerDefinition(selectedType);
    if (!definition) {
      if (messageEl && !silent) {
        messageEl.textContent = 'Select a tower from your loadout to lattice it.';
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    // Allow autoAnchors with explicit tower types to bypass loadout restrictions
    const isAutoAnchorPlacement = towerType && options.silent;
    if (!isAutoAnchorPlacement && !playfield.availableTowers.includes(selectedType)) {
      if (messageEl && !silent) {
        messageEl.textContent = `${definition.symbol} is not prepared in your loadout.`;
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const canvasPosition = playfield.getCanvasPosition(normalized);
    const existingTower = playfield.findTowerAt(canvasPosition);
    let placement = { valid: true, position: canvasPosition };
    let mergeTarget = null;
    let nextDefinition = null;
    let merging = false;
    let mergeCost = 0;

    if (existingTower && existingTower.type === selectedType) {
      const nextId = getNextTowerId(selectedType);
      if (!nextId) {
        if (messageEl && !silent) {
          messageEl.textContent = `${definition.symbol} already resonates at its peak tier.`;
        }
        if (audio && !silent) {
          audio.playSfx('error');
        }
        return false;
      }
      nextDefinition = getTowerDefinition(nextId);
      if (!nextDefinition) {
        if (messageEl && !silent) {
          messageEl.textContent = `${definition.symbol} upgrade path is unavailable.`;
        }
        if (audio && !silent) {
          audio.playSfx('error');
        }
        return false;
      }
      mergeTarget = existingTower;
      merging = true;
      placement.position = { x: mergeTarget.x, y: mergeTarget.y };
      mergeCost = playfield.getCurrentTowerCost(nextDefinition.id);
    } else {
      placement = playfield.validatePlacement(normalized, { allowPathOverlap });
      if (!placement.valid) {
        if (messageEl && placement.reason && !silent) {
          messageEl.textContent = placement.reason;
        }
        if (audio && !silent) {
          audio.playSfx('error');
        }
        return false;
      }
    }

    if (!isTowerUnlocked(selectedType)) {
      unlockTower(selectedType, { silent: true });
    }

    const baseCost = playfield.getCurrentTowerCost(selectedType);
    if (!merging && nextDefinition) {
      mergeCost = playfield.getCurrentTowerCost(nextDefinition.id);
    }
    const actionCost = merging ? mergeCost : baseCost;

    if (combatState.energy < actionCost) {
      const needed = Math.max(0, actionCost - combatState.energy);
      const neededLabel = formatCombatNumber(needed);
      if (messageEl && !silent) {
        if (merging && nextDefinition) {
          messageEl.textContent = `Need ${neededLabel} ${theroSymbol} more to merge into ${nextDefinition.symbol}.`;
        } else {
          messageEl.textContent = `Need ${neededLabel} ${theroSymbol} more to lattice ${definition.symbol}.`;
        }
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    combatState.energy = Math.max(0, combatState.energy - actionCost);

    if (merging && mergeTarget && nextDefinition) {
      const wasInfinity = mergeTarget.type === 'infinity';
      if (wasInfinity) {
        handleInfinityTowerRemoved(mergeTarget);
      }

      const range = Math.min(playfield.renderWidth, playfield.renderHeight) * nextDefinition.range;
      const baseDamage = Number.isFinite(nextDefinition.damage) ? nextDefinition.damage : 0;
      const baseRate = Number.isFinite(nextDefinition.rate) ? nextDefinition.rate : 1;
      mergeTarget.type = nextDefinition.id;
      mergeTarget.definition = nextDefinition;
      mergeTarget.symbol = nextDefinition.symbol;
      mergeTarget.tier = nextDefinition.tier;
      mergeTarget.damage = baseDamage;
      mergeTarget.rate = baseRate;
      mergeTarget.range = range;
      mergeTarget.baseDamage = baseDamage;
      mergeTarget.baseRate = baseRate;
      mergeTarget.baseRange = range;
      mergeTarget.cooldown = 0;
      playfield.applyTowerBehaviorDefaults(mergeTarget);
      if (playfield.combatStats?.active) {
        playfield.ensureTowerStatsEntry(mergeTarget);
        playfield.scheduleStatsPanelRefresh();
      }
      const nextIsInfinity = nextDefinition.id === 'infinity';
      if (nextIsInfinity) {
        handleInfinityTowerAdded(mergeTarget);
      } else if (wasInfinity) {
        playfield.applyInfinityBonuses();
      }
      playfield.spawnTowerEquationScribble(mergeTarget, {
        towerType: nextDefinition.id,
        silent,
      });
      playfield.recordTowerCost(mergeTarget, mergeCost);
      const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
        ? unlockTower(nextDefinition.id, { silent: true })
        : false;
      if (messageEl && !silent) {
        const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
        messageEl.textContent = `${definition.symbol} lattices fused into ${nextDefinition.symbol}.${unlockNote}`;
      }
      notifyTowerPlaced(towers.length);
      playfield.updateTowerPositions();
      playfield.updateHud();
      playfield.draw();
      refreshTowerLoadoutDisplay();
      dependencies.updateStatusDisplays();
      if (audio && !silent) {
        audio.playSfx('towerMerge');
      }
      // Clear the placement preview so successful tier merges do not keep the placement reticle active.
      playfield.clearPlacementPreview();
      return true;
    }

    const baseRange = Math.min(playfield.renderWidth, playfield.renderHeight) * definition.range;
    const baseDamage = Number.isFinite(definition.damage) ? definition.damage : 0;
    const baseRate = Number.isFinite(definition.rate) ? definition.rate : 1;
    const tower = {
      id: `tower-${(towerIdCounter += 1)}`,
      type: selectedType,
      definition,
      symbol: definition.symbol,
      tier: definition.tier,
      normalized: { ...normalized },
      x: placement.position.x,
      y: placement.position.y,
      range: baseRange,
      damage: baseDamage,
      rate: baseRate,
      baseRange,
      baseDamage,
      baseRate,
      cooldown: 0,
      slot,
      // Track η merge progress so the lattice can unfold additional rings.
      etaPrime: 0,
      // Flag prestige status when η ascends into Η.
      isPrestigeEta: false,
      linkTargetId: null,
      linkSources: new Set(),
      storedAlphaShots: 0,
      storedBetaShots: 0,
      storedAlphaSwirl: 0,
      storedBetaSwirl: 0,
      storedGammaShots: 0,
      connectionParticles: [],
      costHistory: [],
      costHistoryInitialized: true,
    };

    playfield.applyTowerBehaviorDefaults(tower);
    towers.push(tower);
    playfield.recordTowerCost(tower, actionCost);
    handleInfinityTowerAdded(tower);
    notifyTowerPlaced(towers.length);
    if (playfield.combatStats?.active) {
      playfield.ensureTowerStatsEntry(tower);
      playfield.scheduleStatsPanelRefresh();
    }

    if (slot) {
      slot.tower = tower;
      if (slot.button) {
        slot.button.classList.add('tower-built');
        slot.button.setAttribute('aria-pressed', 'true');
      }
    }

    playfield.hoverPlacement = null;
    if (messageEl && !silent) {
      messageEl.textContent = `${definition.symbol} lattice anchored—harmonics align.`;
    }
    playfield.spawnTowerEquationScribble(tower, { towerType: selectedType, silent });
    playfield.updateHud();
    playfield.draw();
    refreshTowerLoadoutDisplay();
    dependencies.updateStatusDisplays();
    if (audio && !silent) {
      audio.playSfx('towerPlace');
      playfield.playTowerPlacementNotes?.(audio, 1);
    }
    return true;
  }

  /**
   * Upgrade a tower to the next tier.
   * 
   * @param {Object} tower - Tower object to upgrade
   * @param {Object} options - Upgrade options
   * @returns {boolean} True if upgrade succeeded
   */
  function upgradeTowerTier(
    tower,
    { silent = false, expectedNextId = null, quotedCost = null, swipeVector = null } = {},
  ) {
    if (!tower) {
      return false;
    }

    const nextId = expectedNextId || getNextTowerId(tower.type);
    const nextDefinition = nextId ? getTowerDefinition(nextId) : null;
    if (!nextDefinition) {
      if (messageEl && !silent) {
        messageEl.textContent = 'Peak lattice tier reached—further upgrades unavailable.';
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const cost = Number.isFinite(quotedCost) ? quotedCost : playfield.getCurrentTowerCost(nextDefinition.id);
    if (combatState.energy < cost) {
      if (messageEl && !silent) {
        const deficit = Math.max(0, cost - combatState.energy);
        const deficitLabel = formatCombatNumber(deficit);
        messageEl.textContent = `Need ${deficitLabel} ${theroSymbol} more to merge into ${nextDefinition.symbol}.`;
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    combatState.energy = Math.max(0, combatState.energy - cost);
    playfield.recordTowerCost(tower, cost);

    const previousSymbol = tower.symbol || tower.definition?.symbol || 'Tower';
    const wasInfinity = tower.type === 'infinity';
    if (wasInfinity) {
      handleInfinityTowerRemoved(tower);
    }

    const range = Math.min(playfield.renderWidth, playfield.renderHeight) * nextDefinition.range;
    const baseDamage = Number.isFinite(nextDefinition.damage) ? nextDefinition.damage : 0;
    const baseRate = Number.isFinite(nextDefinition.rate) ? nextDefinition.rate : 1;

    tower.type = nextDefinition.id;
    tower.definition = nextDefinition;
    tower.symbol = nextDefinition.symbol;
    tower.tier = nextDefinition.tier;
    tower.damage = baseDamage;
    tower.rate = baseRate;
    tower.range = range;
    tower.baseDamage = baseDamage;
    tower.baseRate = baseRate;
    tower.baseRange = range;
    tower.cooldown = 0;

    playfield.applyTowerBehaviorDefaults(tower);

    playfield.queueTowerGlyphTransition(tower, {
      fromSymbol: previousSymbol,
      toSymbol: nextDefinition.symbol,
      mode: 'promote',
      swipeVector,
    });

    const nextIsInfinity = nextDefinition.id === 'infinity';
    if (nextIsInfinity) {
      handleInfinityTowerAdded(tower);
    } else if (wasInfinity) {
      playfield.applyInfinityBonuses();
    }

    playfield.spawnTowerEquationScribble(tower, { towerType: nextDefinition.id, silent });
    const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
      ? unlockTower(nextDefinition.id, { silent: true })
      : false;

    if (messageEl && !silent) {
      const costLabel = formatCombatNumber(Math.max(0, cost));
      const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
      messageEl.textContent = `${previousSymbol} lattice ascended into ${nextDefinition.symbol} for ${costLabel} ${theroSymbol}.${unlockNote}`;
    }

    notifyTowerPlaced(towers.length);
    playfield.updateHud();
    playfield.draw();
    refreshTowerLoadoutDisplay();
    dependencies.updateStatusDisplays();
    if (audio && !silent) {
      audio.playSfx('towerMerge');
    }

    playfield.openTowerMenu(tower, { silent: true });
    return true;
  }

  /**
   * Downgrade a tower to the previous tier.
   * 
   * @param {Object} tower - Tower object to downgrade
   * @param {Object} options - Downgrade options
   * @returns {boolean} True if downgrade succeeded
   */
  function demoteTowerTier(tower, { silent = false, swipeVector = null } = {}) {
    if (!tower) {
      return false;
    }

    const previousId = getPreviousTowerId(tower.type);
    if (!previousId) {
      if (tower.type === 'alpha') {
        sellTower(tower, { silent });
        return true;
      }
      if (messageEl && !silent) {
        messageEl.textContent = 'Base lattice tier cannot be demoted further.';
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const previousDefinition = getTowerDefinition(previousId);
    if (!previousDefinition) {
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const history = playfield.ensureTowerCostHistory(tower);
    const removedCost = history.length ? history.pop() : null;
    const currentCost = Number.isFinite(removedCost) ? removedCost : playfield.getCurrentTowerCost(tower.type);
    const charge = playfield.getCurrentTowerCost(previousDefinition.id);
    const cap = playfield.getEnergyCap();
    const refundAmount = Math.max(0, Number.isFinite(currentCost) ? currentCost : 0);
    const cappedEnergy = Math.min(cap, combatState.energy + refundAmount);

    if (cappedEnergy < charge) {
      if (removedCost !== null && removedCost !== undefined) {
        history.push(removedCost);
      }
      if (messageEl && !silent) {
        const deficit = Math.max(0, charge - cappedEnergy);
        const deficitLabel = formatCombatNumber(deficit);
        messageEl.textContent = `Need ${deficitLabel} ${theroSymbol} more to stabilize a demotion.`;
      }
      if (audio && !silent) {
        audio.playSfx('error');
      }
      return false;
    }

    const chargeAmount = Math.max(0, Number.isFinite(charge) ? charge : 0);
    combatState.energy = Math.max(0, cappedEnergy - chargeAmount);
    if (history.length) {
      history[history.length - 1] = chargeAmount;
    } else if (chargeAmount > 0) {
      history.push(chargeAmount);
    }
    tower.costHistoryInitialized = true;

    const previousSymbol = tower.symbol || tower.definition?.symbol || 'Tower';
    const wasInfinity = tower.type === 'infinity';
    if (wasInfinity) {
      handleInfinityTowerRemoved(tower);
    }

    const range = Math.min(playfield.renderWidth, playfield.renderHeight) * previousDefinition.range;
    const baseDamage = Number.isFinite(previousDefinition.damage) ? previousDefinition.damage : 0;
    const baseRate = Number.isFinite(previousDefinition.rate) ? previousDefinition.rate : 1;

    tower.type = previousDefinition.id;
    tower.definition = previousDefinition;
    tower.symbol = previousDefinition.symbol;
    tower.tier = previousDefinition.tier;
    tower.damage = baseDamage;
    tower.rate = baseRate;
    tower.range = range;
    tower.baseDamage = baseDamage;
    tower.baseRate = baseRate;
    tower.baseRange = range;
    tower.cooldown = 0;

    playfield.applyTowerBehaviorDefaults(tower);

    playfield.queueTowerGlyphTransition(tower, {
      fromSymbol: previousSymbol,
      toSymbol: previousDefinition.symbol,
      mode: 'demote',
      swipeVector,
    });

    const nextIsInfinity = previousDefinition.id === 'infinity';
    if (nextIsInfinity) {
      handleInfinityTowerAdded(tower);
    } else if (wasInfinity) {
      playfield.applyInfinityBonuses();
    }

    playfield.spawnTowerEquationScribble(tower, { towerType: previousDefinition.id, silent });

    if (messageEl && !silent) {
      const refundLabel = formatCombatNumber(refundAmount);
      const chargeLabel = formatCombatNumber(chargeAmount);
      messageEl.textContent = `${previousSymbol} lattice relaxed into ${previousDefinition.symbol}—refunded ${refundLabel} ${theroSymbol} and spent ${chargeLabel} ${theroSymbol}.`;
    }

    notifyTowerPlaced(towers.length);
    playfield.updateHud();
    playfield.draw();
    refreshTowerLoadoutDisplay();
    dependencies.updateStatusDisplays();
    if (playfield.combatStats?.active) {
      playfield.scheduleStatsPanelRefresh();
    }
    if (audio && !silent) {
      audio.playSfx('towerSell');
    }

    playfield.openTowerMenu(tower, { silent: true });
    return true;
  }

  /**
   * Remove a tower and refund its cost.
   * 
   * @param {Object} tower - Tower object to remove
   * @param {Object} options - Removal options
   */
  function sellTower(tower, { slot, silent = false } = {}) {
    if (!tower) {
      return;
    }

    if (playfield.towerHoldState?.towerId === tower.id) {
      playfield.cancelTowerHoldGesture();
    }

    if (towerGlyphTransitions?.size) {
      towerGlyphTransitions.delete(tower.id);
    }

    removeAllConnectionsForTower(tower);

    if (playfield.activeTowerMenu?.towerId === tower.id) {
      playfield.closeTowerMenu();
    }

    // Call tower-specific teardown methods through tower manager
    if (towerManager) {
      towerManager.teardownAlphaTower(tower);
      towerManager.teardownBetaTower(tower);
      towerManager.teardownGammaTower(tower);
      towerManager.teardownKappaTower(tower);
      towerManager.teardownLambdaTower(tower);
      towerManager.teardownMuTower(tower);
      towerManager.teardownNuTower(tower);
      towerManager.teardownIotaTower(tower);
      towerManager.teardownDeltaTower(tower);
      towerManager.teardownZetaTower(tower);
      towerManager.teardownEtaTower(tower);
      towerManager.teardownXiTower(tower);
      towerManager.teardownOmicronTower(tower);
      towerManager.teardownPiTower(tower);
      towerManager.teardownTauTower(tower);
      towerManager.teardownSigmaTower(tower);
      towerManager.teardownPsiTower(tower);
    }
    handleInfinityTowerRemoved(tower);

    const index = towers.indexOf(tower);
    if (index >= 0) {
      towers.splice(index, 1);
    }
    if (playfield.combatStats?.towerInstances instanceof Map) {
      // Flag the stats entry as retired immediately so the panel reflects the change before the next tick.
      const entry = playfield.combatStats.towerInstances.get(tower.id);
      if (entry) {
        entry.isActive = false;
        entry.retiredAt = Number.isFinite(playfield.combatStats.elapsed)
          ? Math.max(0, playfield.combatStats.elapsed)
          : 0;
      }
    }
    if (playfield.combatStats?.active) {
      playfield.scheduleStatsPanelRefresh();
    }

    const resolvedSlot = slot || tower.slot || null;
    if (resolvedSlot) {
      resolvedSlot.tower = null;
      if (resolvedSlot.button) {
        resolvedSlot.button.classList.remove('tower-built');
        resolvedSlot.button.setAttribute('aria-pressed', 'false');
      }
    }

    if (playfield.levelConfig) {
      const cap = playfield.getEnergyCap();
      const refund = Math.max(0, playfield.calculateTowerSellRefund(tower));
      combatState.energy = Math.min(cap, combatState.energy + refund);
      if (messageEl && !silent) {
        const refundLabel = formatCombatNumber(refund);
        messageEl.textContent = `Lattice dissolved—refunded ${refundLabel} ${theroSymbol}.`;
      }
    }

    playfield.updateHud();
    playfield.draw();
    refreshTowerLoadoutDisplay();
    dependencies.updateStatusDisplays();
    if (audio && !silent) {
      audio.playSfx('towerSell');
    }
  }

  /**
   * Retrieve a lattice reference by identifier.
   * 
   * @param {string} towerId - Tower ID to find
   * @returns {Object|null} Tower object or null if not found
   */
  function getTowerById(towerId) {
    if (!towerId) {
      return null;
    }
    return towers.find((candidate) => candidate?.id === towerId) || null;
  }

  /**
   * Check if two towers are compatible for connection.
   * 
   * @param {Object} source - Source tower
   * @param {Object} target - Target tower
   * @returns {boolean} True if towers can be connected
   */
  function areTowersConnectionCompatible(source, target) {
    if (!source || !target || source.id === target.id) {
      return false;
    }
    const pairingKey = `${source.type}->${target.type}`;
    const allowedPairings = ['alpha->beta', 'beta->gamma', 'alpha->iota', 'beta->iota', 'gamma->iota'];
    if (!allowedPairings.includes(pairingKey)) {
      return false;
    }
    const sourceRange = Number.isFinite(source.range) ? Math.max(0, source.range) : 0;
    const targetRange = Number.isFinite(target.range) ? Math.max(0, target.range) : 0;
    if (!sourceRange || !targetRange) {
      return false;
    }
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance)) {
      return false;
    }
    return distance <= sourceRange && distance <= targetRange;
  }

  /**
   * Remove every connection touching the provided lattice.
   * 
   * @param {Object} tower - Tower to remove connections from
   */
  function removeAllConnectionsForTower(tower) {
    if (!tower) {
      return;
    }
    if (tower.linkTargetId) {
      removeTowerConnection(tower.id, tower.linkTargetId);
    }
    const incoming = towerConnectionSources.get(tower.id);
    if (incoming && incoming.size) {
      Array.from(incoming).forEach((sourceId) => {
        removeTowerConnection(sourceId, tower.id);
      });
    }
    tower.linkSources?.clear?.();
  }

  /**
   * Register a directed resource link between two lattices.
   * 
   * @param {Object|string} source - Source tower or tower ID
   * @param {Object|string} target - Target tower or tower ID
   * @returns {boolean} True if connection was added
   */
  function addTowerConnection(source, target) {
    const resolvedSource = typeof source === 'string' ? getTowerById(source) : source;
    const resolvedTarget = typeof target === 'string' ? getTowerById(target) : target;
    if (!areTowersConnectionCompatible(resolvedSource, resolvedTarget)) {
      return false;
    }
    if (resolvedSource.linkTargetId === resolvedTarget.id) {
      return true;
    }
    if (resolvedSource.linkTargetId && resolvedSource.linkTargetId !== resolvedTarget.id) {
      removeTowerConnection(resolvedSource.id, resolvedSource.linkTargetId);
    }
    towerConnectionMap.set(resolvedSource.id, resolvedTarget.id);
    resolvedSource.linkTargetId = resolvedTarget.id;
    if (!resolvedTarget.linkSources) {
      resolvedTarget.linkSources = new Set();
    }
    resolvedTarget.linkSources.add(resolvedSource.id);
    if (!towerConnectionSources.has(resolvedTarget.id)) {
      towerConnectionSources.set(resolvedTarget.id, new Set());
    }
    towerConnectionSources.get(resolvedTarget.id).add(resolvedSource.id);
    resolvedSource.cooldown = 0;
    if (resolvedTarget.type === 'beta') {
      towerManager?.ensureBetaState?.(resolvedTarget);
    } else if (resolvedTarget.type === 'gamma') {
      towerManager?.ensureGammaState?.(resolvedTarget);
    } else if (resolvedTarget.type === 'iota') {
      towerManager?.ensureIotaState?.(resolvedTarget);
    }
    return true;
  }

  /**
   * Tear down an existing resource link between two lattices.
   * 
   * @param {Object|string} source - Source tower or tower ID
   * @param {Object|string} target - Target tower or tower ID
   * @returns {boolean} True if connection was removed
   */
  function removeTowerConnection(source, target) {
    const resolvedSource = typeof source === 'string' ? getTowerById(source) : source;
    const resolvedTarget = typeof target === 'string' ? getTowerById(target) : target;
    if (!resolvedSource || !resolvedTarget) {
      return false;
    }
    if (resolvedSource.linkTargetId !== resolvedTarget.id) {
      return false;
    }
    towerConnectionMap.delete(resolvedSource.id);
    resolvedSource.linkTargetId = null;
    resolvedSource.cooldown = 0;
    if (resolvedTarget.linkSources instanceof Set) {
      resolvedTarget.linkSources.delete(resolvedSource.id);
    }
    const sourceSet = towerConnectionSources.get(resolvedTarget.id);
    if (sourceSet) {
      sourceSet.delete(resolvedSource.id);
      if (!sourceSet.size) {
        towerConnectionSources.delete(resolvedTarget.id);
      }
    }
    if (resolvedTarget.type === 'beta') {
      towerManager?.ensureBetaState?.(resolvedTarget);
    } else if (resolvedTarget.type === 'gamma') {
      towerManager?.ensureGammaState?.(resolvedTarget);
    } else if (resolvedTarget.type === 'iota') {
      towerManager?.ensureIotaState?.(resolvedTarget);
    }
    return true;
  }

  /**
   * Handle infinity tower being added to the playfield.
   * 
   * @param {Object} tower - Tower object
   */
  function handleInfinityTowerAdded(tower) {
    if (tower.type === 'infinity' && !infinityTowers.includes(tower)) {
      infinityTowers.push(tower);
      playfield.applyInfinityBonuses?.();
    }
  }

  /**
   * Handle infinity tower being removed from the playfield.
   * 
   * @param {Object} tower - Tower object
   */
  function handleInfinityTowerRemoved(tower) {
    if (tower.type === 'infinity') {
      const index = infinityTowers.indexOf(tower);
      if (index >= 0) {
        infinityTowers.splice(index, 1);
      }
    }
  }

  // Return the public API
  return {
    // Tower lifecycle
    addTowerAt,
    upgradeTowerTier,
    demoteTowerTier,
    sellTower,
    getTowerById,

    // Tower connections
    areTowersConnectionCompatible,
    removeAllConnectionsForTower,
    addTowerConnection,
    removeTowerConnection,

    // State getters (read-only access)
    get towers() {
      return towers;
    },
    get infinityTowers() {
      return infinityTowers;
    },
    get towerIdCounter() {
      return towerIdCounter;
    },
    get towerConnectionMap() {
      return towerConnectionMap;
    },
    get towerConnectionSources() {
      return towerConnectionSources;
    },
    get towerGlyphTransitions() {
      return towerGlyphTransitions;
    },

    // State setters (for backward compatibility with playfield.js delegation)
    set towers(value) {
      towers = value;
    },
    set infinityTowers(value) {
      infinityTowers = value;
    },
    set towerIdCounter(value) {
      towerIdCounter = value;
    },
    set towerConnectionMap(value) {
      towerConnectionMap = value;
    },
    set towerConnectionSources(value) {
      towerConnectionSources = value;
    },
    set towerGlyphTransitions(value) {
      towerGlyphTransitions = value;
    },
  };
}
