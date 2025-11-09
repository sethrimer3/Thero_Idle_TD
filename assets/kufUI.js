/**
 * Kuf Spire UI Management
 *
 * Handles shard allocation controls, simulation lifecycle, and post-run
 * summaries for the Kuf Spire.
 */

import {
  getKufAllocations,
  getKufGlyphs,
  getKufHighScore,
  getKufLastResult,
  getKufRemainingShards,
  getKufTotalShards,
  getKufShardsAvailableForUnits,
  calculateKufMarineStats,
  updateKufAllocation,
  resetKufAllocations,
  recordKufBattleOutcome,
  onKufStateChange,
  getKufUnits,
  purchaseKufUnit,
  sellKufUnit,
  KUF_MARINE_BASE_STATS,
  KUF_SNIPER_BASE_STATS,
  KUF_SPLAYER_BASE_STATS,
  KUF_UNIT_COSTS,
} from './kufState.js';

import { KufBattlefieldSimulation } from './kufSimulation.js';

let simulation = null;
let kufElements = {};
let stateChangeUnsubscribe = null;
let runCompleteCallback = null;

function cacheElements() {
  kufElements = {
    shardTotal: document.getElementById('kuf-shards-total'),
    shardRemaining: document.getElementById('kuf-shards-remaining'),
    shardsForUnits: document.getElementById('kuf-shards-for-units'),
    glyphCount: document.getElementById('kuf-glyph-count'),
    highScore: document.getElementById('kuf-high-score'),
    lastResult: document.getElementById('kuf-last-result'),
    statHealth: document.getElementById('kuf-stat-health'),
    statAttack: document.getElementById('kuf-stat-attack'),
    statSpeed: document.getElementById('kuf-stat-speed'),
    allocationInputs: {
      health: document.getElementById('kuf-allocation-health'),
      attack: document.getElementById('kuf-allocation-attack'),
      attackSpeed: document.getElementById('kuf-allocation-speed'),
    },
    allocationValues: {
      health: document.getElementById('kuf-allocation-health-value'),
      attack: document.getElementById('kuf-allocation-attack-value'),
      attackSpeed: document.getElementById('kuf-allocation-speed-value'),
    },
    unitCounts: {
      marines: document.getElementById('kuf-marines-count'),
      snipers: document.getElementById('kuf-snipers-count'),
      splayers: document.getElementById('kuf-splayers-count'),
    },
    unitBuyButtons: {
      marines: document.getElementById('kuf-buy-marine'),
      snipers: document.getElementById('kuf-buy-sniper'),
      splayers: document.getElementById('kuf-buy-splayer'),
    },
    unitSellButtons: {
      marines: document.getElementById('kuf-sell-marine'),
      snipers: document.getElementById('kuf-sell-sniper'),
      splayers: document.getElementById('kuf-sell-splayer'),
    },
    resetButton: document.getElementById('kuf-reset-button'),
    startButton: document.getElementById('kuf-start-button'),
    canvas: document.getElementById('kuf-simulation-canvas'),
    viewport: document.getElementById('kuf-simulation-card'),
    status: document.getElementById('kuf-sim-status'),
    resultPanel: document.getElementById('kuf-result-panel'),
    resultSummary: document.getElementById('kuf-result-summary'),
    resultGlyphs: document.getElementById('kuf-result-glyphs'),
    resultClose: document.getElementById('kuf-result-close'),
  };
}

function bindAllocationInputs() {
  Object.entries(kufElements.allocationInputs).forEach(([stat, input]) => {
    if (!input) {
      return;
    }
    input.max = String(getKufTotalShards());
    input.addEventListener('input', () => {
      const { value, changed } = updateKufAllocation(stat, Number(input.value));
      if (value !== Number(input.value)) {
        input.value = String(value);
      }
      if (changed) {
        updateAllocationDisplay();
      }
    });
  });
}

function bindButtons() {
  if (kufElements.resetButton) {
    kufElements.resetButton.addEventListener('click', () => {
      resetKufAllocations();
      updateAllocationDisplay();
    });
  }
  if (kufElements.startButton) {
    kufElements.startButton.addEventListener('click', () => {
      startSimulation();
    });
  }
  if (kufElements.resultClose) {
    kufElements.resultClose.addEventListener('click', () => {
      hideResultPanel();
    });
  }
  
  // Bind unit purchase buttons
  Object.entries(kufElements.unitBuyButtons).forEach(([unitType, button]) => {
    if (button) {
      button.addEventListener('click', () => {
        purchaseKufUnit(unitType);
        updateUnitDisplay();
      });
    }
  });
  
  // Bind unit sell buttons
  Object.entries(kufElements.unitSellButtons).forEach(([unitType, button]) => {
    if (button) {
      button.addEventListener('click', () => {
        sellKufUnit(unitType);
        updateUnitDisplay();
      });
    }
  });
}

function ensureSimulationInstance() {
  if (simulation || !kufElements.canvas) {
    return;
  }
  simulation = new KufBattlefieldSimulation({
    canvas: kufElements.canvas,
    onComplete: (result) => {
      handleSimulationComplete(result);
    },
  });
  simulation.resize();
  window.addEventListener('resize', () => simulation.resize());
}

function startSimulation() {
  ensureSimulationInstance();
  if (!simulation || simulation.active) {
    return;
  }
  hideResultPanel();
  if (kufElements.startButton) {
    kufElements.startButton.disabled = true;
    kufElements.startButton.textContent = 'Running…';
  }
  setStatusMessage('Units advancing toward the encampment…');
  disableAllocationInputs(true);
  disableUnitButtons(true);
  
  const allocations = getKufAllocations();
  const marineStats = calculateKufMarineStats(allocations);
  
  // Calculate sniper and splayer stats with same shard bonuses
  const sniperStats = {
    health: KUF_SNIPER_BASE_STATS.health + allocations.health * 2,
    attack: KUF_SNIPER_BASE_STATS.attack + allocations.attack * 0.5,
    attackSpeed: KUF_SNIPER_BASE_STATS.attackSpeed + allocations.attackSpeed * 0.1,
  };
  
  const splayerStats = {
    health: KUF_SPLAYER_BASE_STATS.health + allocations.health * 2,
    attack: KUF_SPLAYER_BASE_STATS.attack + allocations.attack * 0.5,
    attackSpeed: KUF_SPLAYER_BASE_STATS.attackSpeed + allocations.attackSpeed * 0.1,
  };
  
  const units = getKufUnits();
  simulation.start({ marineStats, sniperStats, splayerStats, units });
}

function handleSimulationComplete(result) {
  disableAllocationInputs(false);
  disableUnitButtons(false);
  if (kufElements.startButton) {
    kufElements.startButton.disabled = false;
    kufElements.startButton.textContent = 'Start Simulation';
  }
  setStatusMessage(result.victory ? 'Encampment cleared. Gold tallied.' : 'Units lost. Debrief prepared.');
  const outcome = recordKufBattleOutcome(result);
  updateAllocationDisplay();
  renderResultPanel(result, outcome);
  if (typeof runCompleteCallback === 'function') {
    runCompleteCallback({ result, outcome });
  }
}

function setStatusMessage(message) {
  if (kufElements.status) {
    kufElements.status.textContent = message;
  }
}

function disableAllocationInputs(disabled) {
  Object.values(kufElements.allocationInputs).forEach((input) => {
    if (input) {
      input.disabled = disabled;
    }
  });
  if (kufElements.resetButton) {
    kufElements.resetButton.disabled = disabled;
  }
}

function disableUnitButtons(disabled) {
  Object.values(kufElements.unitBuyButtons).forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
  Object.values(kufElements.unitSellButtons).forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
}

function updateUnitDisplay() {
  const units = getKufUnits();
  const available = getKufShardsAvailableForUnits();
  
  // Update unit counts
  Object.entries(kufElements.unitCounts).forEach(([unitType, element]) => {
    if (element) {
      element.textContent = String(units[unitType]);
    }
  });
  
  // Update buy button states
  Object.entries(kufElements.unitBuyButtons).forEach(([unitType, button]) => {
    if (button) {
      const cost = KUF_UNIT_COSTS[unitType];
      button.disabled = available < cost;
    }
  });
  
  // Update sell button states
  Object.entries(kufElements.unitSellButtons).forEach(([unitType, button]) => {
    if (button) {
      button.disabled = units[unitType] <= 0;
    }
  });
  
  // Update shards available for units display
  if (kufElements.shardsForUnits) {
    kufElements.shardsForUnits.textContent = String(available);
  }
  
  renderLedger();
}

function updateAllocationDisplay() {
  const allocations = getKufAllocations();
  Object.entries(kufElements.allocationInputs).forEach(([stat, input]) => {
    if (input) {
      input.value = String(allocations[stat]);
    }
  });
  Object.entries(kufElements.allocationValues).forEach(([stat, label]) => {
    if (label) {
      label.textContent = `${allocations[stat]} Shards`;
    }
  });
  const stats = calculateKufMarineStats(allocations);
  if (kufElements.statHealth) {
    kufElements.statHealth.textContent = `${stats.health.toFixed(0)} HP`;
  }
  if (kufElements.statAttack) {
    kufElements.statAttack.textContent = `${stats.attack.toFixed(1)} Damage`;
  }
  if (kufElements.statSpeed) {
    kufElements.statSpeed.textContent = `${stats.attackSpeed.toFixed(2)} /s`;
  }
  renderLedger();
}

function renderLedger() {
  if (kufElements.shardTotal) {
    kufElements.shardTotal.textContent = String(getKufTotalShards());
  }
  if (kufElements.shardRemaining) {
    kufElements.shardRemaining.textContent = String(getKufRemainingShards());
  }
  if (kufElements.glyphCount) {
    kufElements.glyphCount.textContent = String(getKufGlyphs());
  }
  if (kufElements.highScore) {
    kufElements.highScore.textContent = String(getKufHighScore());
  }
  if (kufElements.lastResult) {
    const last = getKufLastResult();
    if (last) {
      const victoryLabel = last.victory ? 'Victory' : 'Defeat';
      kufElements.lastResult.textContent = `${victoryLabel} · ${last.goldEarned} gold · ${last.destroyedTurrets} turrets`;
    } else {
      kufElements.lastResult.textContent = 'Awaiting first simulation.';
    }
  }
}

function renderResultPanel(result, outcome) {
  if (!kufElements.resultPanel || !kufElements.resultSummary) {
    return;
  }
  kufElements.resultPanel.hidden = false;
  const status = result.victory ? 'Victory' : 'Defeat';
  kufElements.resultSummary.textContent = `${status} · ${result.goldEarned} gold · ${result.destroyedTurrets} turrets destroyed`;
  if (kufElements.resultGlyphs) {
    if (outcome.newHigh) {
      kufElements.resultGlyphs.textContent = `New high score! Kuf glyphs now ${outcome.highScore}. (+${outcome.glyphsAwarded})`;
    } else if (outcome.glyphsAwarded > 0) {
      kufElements.resultGlyphs.textContent = `Glyphs increased by ${outcome.glyphsAwarded}.`;
    } else {
      kufElements.resultGlyphs.textContent = 'No new glyphs earned. Surpass your high score to gain more.';
    }
  }
}

function hideResultPanel() {
  if (kufElements.resultPanel) {
    kufElements.resultPanel.hidden = true;
  }
}

function handleStateChange(event) {
  if (!event || typeof event !== 'object') {
    return;
  }
  if (event.type === 'allocation' || event.type === 'init') {
    updateAllocationDisplay();
    updateUnitDisplay();
  }
  if (event.type === 'units') {
    updateUnitDisplay();
  }
  if (event.type === 'result') {
    renderLedger();
  }
}

function attachStateListener() {
  if (stateChangeUnsubscribe) {
    stateChangeUnsubscribe();
    stateChangeUnsubscribe = null;
  }
  stateChangeUnsubscribe = onKufStateChange(handleStateChange);
}

function primeLastResult() {
  const last = getKufLastResult();
  if (!last && kufElements.lastResult) {
    kufElements.lastResult.textContent = 'Awaiting first simulation.';
  }
}

/**
 * Initialize the Kuf Spire UI.
 * @param {object} options - Optional callbacks.
 * @param {(payload: { result: object, outcome: object }) => void} [options.onRunComplete]
 */
export function initializeKufUI(options = {}) {
  runCompleteCallback = typeof options.onRunComplete === 'function' ? options.onRunComplete : null;
  cacheElements();
  bindAllocationInputs();
  bindButtons();
  attachStateListener();
  ensureSimulationInstance();
  updateAllocationDisplay();
  updateUnitDisplay();
  primeLastResult();
}

/**
 * Refresh UI readouts from the latest state snapshot.
 */
export function updateKufDisplay() {
  updateAllocationDisplay();
  updateUnitDisplay();
  if (simulation) {
    simulation.resize();
  }
}

/**
 * Dispose Kuf UI listeners.
 */
export function teardownKufUI() {
  if (stateChangeUnsubscribe) {
    stateChangeUnsubscribe();
    stateChangeUnsubscribe = null;
  }
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
}
