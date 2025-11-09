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
  calculateKufMarineStats,
  updateKufAllocation,
  resetKufAllocations,
  recordKufBattleOutcome,
  onKufStateChange,
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
  setStatusMessage('Marine advancing toward the encampment…');
  disableAllocationInputs(true);
  const marineStats = calculateKufMarineStats();
  simulation.start({ marineStats });
}

function handleSimulationComplete(result) {
  disableAllocationInputs(false);
  if (kufElements.startButton) {
    kufElements.startButton.disabled = false;
    kufElements.startButton.textContent = 'Start Simulation';
  }
  setStatusMessage(result.victory ? 'Encampment cleared. Gold tallied.' : 'Marine lost. Debrief prepared.');
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
  primeLastResult();
}

/**
 * Refresh UI readouts from the latest state snapshot.
 */
export function updateKufDisplay() {
  updateAllocationDisplay();
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
