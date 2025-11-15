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
  calculateKufUnitStats,
  updateKufAllocation,
  resetKufAllocations,
  recordKufBattleOutcome,
  onKufStateChange,
  getKufUnits,
  getKufUpgrades,
  purchaseKufUnit,
  sellKufUnit,
  allocateKufUpgrade,
  deallocateKufUpgrade,
  getKufShardsSpentOnUpgrades,
  KUF_MARINE_BASE_STATS,
  KUF_SNIPER_BASE_STATS,
  KUF_SPLAYER_BASE_STATS,
  KUF_UNIT_COSTS,
} from './kufState.js';

import { KufBattlefieldSimulation } from './kufSimulation.js';
import {
  getCachedKufMaps,
  loadKufMaps,
  onKufMapsReady,
} from './kufMapData.js';

let simulation = null;
let kufElements = {};
let stateChangeUnsubscribe = null;
let runCompleteCallback = null;
let currentOpenDropdown = null;
let holdTimers = new Map(); // For hold-to-spam functionality
const KUF_FALLBACK_MAP_ID = 'forward-bastion';

let kufMapList = getCachedKufMaps();
let kufMapLookup = new Map(kufMapList.map((map) => [map.id, map]));
let selectedMapId = kufMapList[0]?.id || null;
let removeKufMapListener = null;

/**
 * Synchronize local map caches and refresh the UI when new data arrives.
 * @param {Array<object>} maps - Latest Kuf battlefield definitions.
 */
function applyKufMapData(maps) {
  kufMapList = Array.isArray(maps) ? maps : [];
  kufMapLookup = new Map(kufMapList.map((map) => [map.id, map]));
  if (!selectedMapId && kufMapList[0]) {
    selectedMapId = kufMapList[0].id;
  }
  if (selectedMapId && !kufMapLookup.has(selectedMapId)) {
    selectedMapId = kufMapList[0]?.id || KUF_FALLBACK_MAP_ID;
  }
  if (!selectedMapId) {
    selectedMapId = KUF_FALLBACK_MAP_ID;
  }
  if (simulation && typeof simulation.setAvailableMaps === 'function') {
    simulation.setAvailableMaps(kufMapList);
    if (typeof simulation.setActiveMap === 'function') {
      simulation.setActiveMap(selectedMapId);
    }
  }
  if (kufElements.mapSelect) {
    populateMapSelect();
  }
  updateMapDetails();
}

function cacheElements() {
  kufElements = {
    shardTotal: document.getElementById('kuf-shards-total'),
    shardRemaining: document.getElementById('kuf-shards-remaining'),
    glyphCount: document.getElementById('kuf-glyph-count'),
    highScore: document.getElementById('kuf-high-score'),
    lastResult: document.getElementById('kuf-last-result'),
    startButton: document.getElementById('kuf-start-button'),
    canvas: document.getElementById('kuf-simulation-canvas'),
    simMenu: document.getElementById('kuf-sim-menu'),
    resultPanel: document.getElementById('kuf-result-panel'),
    resultSummary: document.getElementById('kuf-result-summary'),
    resultGlyphs: document.getElementById('kuf-result-glyphs'),
    resultClose: document.getElementById('kuf-result-close'),
    mapSelect: document.getElementById('kuf-map-select'),
    mapDescription: document.getElementById('kuf-map-description'),
    mapDifficulty: document.getElementById('kuf-map-difficulty'),
    mapMechanics: document.getElementById('kuf-map-mechanics'),
    
    // Unit counts
    unitCounts: {
      marines: document.getElementById('kuf-marines-count'),
      snipers: document.getElementById('kuf-snipers-count'),
      splayers: document.getElementById('kuf-splayers-count'),
    },
    
    // Unit total costs
    unitTotalCosts: {
      marines: document.getElementById('kuf-marines-total-cost'),
      snipers: document.getElementById('kuf-snipers-total-cost'),
      splayers: document.getElementById('kuf-splayers-total-cost'),
    },
    
    // Unit upgrade panels
    unitUpgradePanels: {
      marines: document.getElementById('kuf-marines-upgrades'),
      snipers: document.getElementById('kuf-snipers-upgrades'),
      splayers: document.getElementById('kuf-splayers-upgrades'),
    },
    
    // Unit upgrade counts
    unitUpgradeCounts: {
      marines: document.getElementById('kuf-marines-upgrade-count'),
      snipers: document.getElementById('kuf-snipers-upgrade-count'),
      splayers: document.getElementById('kuf-splayers-upgrade-count'),
    },
    
    // Upgrade values
    upgradeValues: {
      marines: {
        health: document.getElementById('kuf-marines-health-upgrade'),
        attack: document.getElementById('kuf-marines-attack-upgrade'),
        attackSpeed: document.getElementById('kuf-marines-speed-upgrade'),
      },
      snipers: {
        health: document.getElementById('kuf-snipers-health-upgrade'),
        attack: document.getElementById('kuf-snipers-attack-upgrade'),
        attackSpeed: document.getElementById('kuf-snipers-speed-upgrade'),
      },
      splayers: {
        health: document.getElementById('kuf-splayers-health-upgrade'),
        attack: document.getElementById('kuf-splayers-attack-upgrade'),
        attackSpeed: document.getElementById('kuf-splayers-speed-upgrade'),
      },
    },
    
    // Codex elements
    codexUnitCounts: {
      marines: document.getElementById('kuf-codex-marines-count'),
      snipers: document.getElementById('kuf-codex-snipers-count'),
      splayers: document.getElementById('kuf-codex-splayers-count'),
    },
    codexUnitStats: {
      marines: {
        health: document.getElementById('kuf-codex-marines-health'),
        attack: document.getElementById('kuf-codex-marines-attack'),
        speed: document.getElementById('kuf-codex-marines-speed'),
      },
      snipers: {
        health: document.getElementById('kuf-codex-snipers-health'),
        attack: document.getElementById('kuf-codex-snipers-attack'),
        speed: document.getElementById('kuf-codex-snipers-speed'),
      },
      splayers: {
        health: document.getElementById('kuf-codex-splayers-health'),
        attack: document.getElementById('kuf-codex-splayers-attack'),
        speed: document.getElementById('kuf-codex-splayers-speed'),
      },
    },
  };
}

function bindButtons() {
  // Start button
  if (kufElements.startButton) {
    kufElements.startButton.addEventListener('click', () => {
      startSimulation();
    });
  }

  if (kufElements.mapSelect) {
    kufElements.mapSelect.addEventListener('change', (event) => {
      const value = event.target.value;
      selectedMapId = value || kufMapList[0]?.id || null;
      if (!selectedMapId) {
        selectedMapId = simulation?.getDefaultMapId?.() || KUF_FALLBACK_MAP_ID;
      }
      if (simulation && typeof simulation.setActiveMap === 'function') {
        simulation.setActiveMap(selectedMapId);
      }
      updateMapDetails();
    });
  }
  
  // Result close button
  if (kufElements.resultClose) {
    kufElements.resultClose.addEventListener('click', () => {
      hideResultPanel();
    });
  }
  
  // Unit +/- buttons (using event delegation)
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.kuf-unit-btn');
    if (!button) return;
    
    const unitType = button.dataset.unit;
    const action = button.dataset.action;
    
    if (unitType && action) {
      if (action === 'plus') {
        purchaseKufUnit(unitType);
      } else if (action === 'minus') {
        sellKufUnit(unitType);
      }
      updateUnitDisplay();
      updateCodexDisplay();
    }
  });
  
  // Upgrade buttons (toggle dropdown)
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.kuf-unit-upgrade-btn');
    if (!button) return;
    
    const unitType = button.dataset.unit;
    if (unitType && kufElements.unitUpgradePanels[unitType]) {
      toggleUpgradeDropdown(unitType);
    }
  });
  
  // Upgrade +/- buttons (using event delegation)
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.kuf-upgrade-btn');
    if (!button) return;
    
    const unitType = button.dataset.unit;
    const stat = button.dataset.stat;
    const isPlus = button.classList.contains('kuf-upgrade-btn-plus');
    
    if (unitType && stat) {
      if (isPlus) {
        allocateKufUpgrade(unitType, stat);
      } else {
        deallocateKufUpgrade(unitType, stat);
      }
      updateUpgradeDisplay();
      updateCodexDisplay();
    }
  });
}

function toggleUpgradeDropdown(unitType) {
  const panel = kufElements.unitUpgradePanels[unitType];
  if (!panel) return;
  
  // Close currently open dropdown if different
  if (currentOpenDropdown && currentOpenDropdown !== unitType) {
    const oldPanel = kufElements.unitUpgradePanels[currentOpenDropdown];
    if (oldPanel) {
      oldPanel.hidden = true;
    }
  }
  
  // Toggle the clicked dropdown
  panel.hidden = !panel.hidden;
  currentOpenDropdown = panel.hidden ? null : unitType;
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
    maps: kufMapList,
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
  
  // Hide the menu and show the canvas
  if (kufElements.simMenu) {
    kufElements.simMenu.hidden = true;
  }
  
  // Calculate unit stats with upgrades
  const marineStats = calculateKufUnitStats('marines');
  const sniperStats = calculateKufUnitStats('snipers');
  const splayerStats = calculateKufUnitStats('splayers');
  
  const units = getKufUnits();
  const mapId = selectedMapId && kufMapLookup.has(selectedMapId)
    ? selectedMapId
    : simulation?.getDefaultMapId?.() || kufMapList[0]?.id || KUF_FALLBACK_MAP_ID;

  simulation.start({ marineStats, sniperStats, splayerStats, units, mapId });
}

function handleSimulationComplete(result) {
  // Show the menu again
  if (kufElements.simMenu) {
    kufElements.simMenu.hidden = false;
  }
  
  const outcome = recordKufBattleOutcome(result);
  renderLedger();
  renderResultPanel(result, outcome);
  if (typeof runCompleteCallback === 'function') {
    runCompleteCallback({ result, outcome });
  }
}

function updateUnitDisplay() {
  const units = getKufUnits();
  
  // Update unit counts
  Object.entries(kufElements.unitCounts).forEach(([unitType, element]) => {
    if (element) {
      element.textContent = String(units[unitType]);
    }
  });
  
  // Update total costs
  Object.entries(kufElements.unitTotalCosts).forEach(([unitType, element]) => {
    if (element) {
      const cost = KUF_UNIT_COSTS[unitType] * units[unitType];
      element.textContent = String(cost);
    }
  });

  renderLedger();
}

function populateMapSelect() {
  if (!kufElements.mapSelect) {
    return;
  }
  kufElements.mapSelect.innerHTML = '';
  kufMapList.forEach((map) => {
    const option = document.createElement('option');
    option.value = map.id;
    option.textContent = `${map.name}`;
    kufElements.mapSelect.appendChild(option);
  });
  if (selectedMapId && !kufMapLookup.has(selectedMapId)) {
    selectedMapId = kufMapList[0]?.id || null;
  }
  if (selectedMapId) {
    kufElements.mapSelect.value = selectedMapId;
  }
  updateMapDetails();
}

function updateMapDetails() {
  const map = selectedMapId ? kufMapLookup.get(selectedMapId) : kufMapList[0];
  if (kufElements.mapDescription) {
    kufElements.mapDescription.textContent = map?.description || 'Select a battlefield to see its briefing.';
  }
  if (kufElements.mapDifficulty) {
    if (map) {
      const glyphs = typeof map.recommendedGlyphs === 'number' ? ` · ${map.recommendedGlyphs} glyphs` : '';
      kufElements.mapDifficulty.textContent = `${map.difficulty || 'Unknown'}${glyphs}`;
    } else {
      kufElements.mapDifficulty.textContent = '';
    }
  }
  if (kufElements.mapMechanics) {
    kufElements.mapMechanics.innerHTML = '';
    if (map?.mechanics?.length) {
      map.mechanics.forEach((mechanic) => {
        const li = document.createElement('li');
        li.textContent = mechanic;
        kufElements.mapMechanics.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No unique mechanics documented yet.';
      kufElements.mapMechanics.appendChild(li);
    }
  }
}

function updateUpgradeDisplay() {
  const upgrades = getKufUpgrades();
  
  // Update upgrade values
  Object.entries(upgrades).forEach(([unitType, stats]) => {
    if (kufElements.upgradeValues[unitType]) {
      Object.entries(stats).forEach(([stat, value]) => {
        const element = kufElements.upgradeValues[unitType][stat];
        if (element) {
          element.textContent = String(value);
        }
      });
    }
    
    // Update upgrade count badge
    if (kufElements.unitUpgradeCounts[unitType]) {
      const total = stats.health + stats.attack + stats.attackSpeed;
      kufElements.unitUpgradeCounts[unitType].textContent = String(total);
    }
  });
  
  renderLedger();
}

function updateCodexDisplay() {
  const units = getKufUnits();
  
  // Update unit counts in codex
  Object.entries(kufElements.codexUnitCounts).forEach(([unitType, element]) => {
    if (element) {
      element.textContent = String(units[unitType]);
    }
  });
  
  // Update unit stats in codex
  ['marines', 'snipers', 'splayers'].forEach((unitType) => {
    const stats = calculateKufUnitStats(unitType);
    if (kufElements.codexUnitStats[unitType]) {
      if (kufElements.codexUnitStats[unitType].health) {
        kufElements.codexUnitStats[unitType].health.textContent = `${stats.health.toFixed(0)} HP`;
      }
      if (kufElements.codexUnitStats[unitType].attack) {
        kufElements.codexUnitStats[unitType].attack.textContent = `${stats.attack.toFixed(1)} Damage`;
      }
      if (kufElements.codexUnitStats[unitType].speed) {
        kufElements.codexUnitStats[unitType].speed.textContent = `${stats.attackSpeed.toFixed(2)} /s`;
      }
    }
  });
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
  if (event.type === 'init') {
    updateUnitDisplay();
    updateUpgradeDisplay();
    updateCodexDisplay();
  }
  if (event.type === 'units') {
    updateUnitDisplay();
    updateCodexDisplay();
  }
  if (event.type === 'upgrades') {
    updateUpgradeDisplay();
    updateCodexDisplay();
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

// Hold-to-spam functionality
function setupHoldToSpam() {
  let holdTimer = null;
  let spamInterval = null;
  let progressCircle = null;
  
  const startHold = (button, action) => {
    if (button.disabled) return;
    
    // Create progress indicator
    progressCircle = document.createElement('div');
    progressCircle.className = 'kuf-hold-progress';
    progressCircle.style.cssText = `
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      border: 2px solid rgba(120, 200, 255, 0.6);
      border-right-color: transparent;
      animation: kuf-hold-spin 1s linear;
      pointer-events: none;
    `;
    
    // Add CSS animation if not already present
    if (!document.getElementById('kuf-hold-animation')) {
      const style = document.createElement('style');
      style.id = 'kuf-hold-animation';
      style.textContent = `
        @keyframes kuf-hold-spin {
          0% { transform: rotate(0deg); border-right-color: transparent; }
          100% { transform: rotate(360deg); border-right-color: rgba(120, 200, 255, 0.6); }
        }
      `;
      document.head.appendChild(style);
    }
    
    button.style.position = 'relative';
    button.appendChild(progressCircle);
    
    // After 1 second, start spamming
    holdTimer = setTimeout(() => {
      if (progressCircle && progressCircle.parentElement) {
        progressCircle.remove();
      }
      
      spamInterval = setInterval(() => {
        if (button.disabled) {
          stopHold();
          return;
        }
        action();
      }, 100); // Spam every 100ms
    }, 1000);
  };
  
  const stopHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (spamInterval) {
      clearInterval(spamInterval);
      spamInterval = null;
    }
    if (progressCircle && progressCircle.parentElement) {
      progressCircle.remove();
      progressCircle = null;
    }
  };
  
  // Attach to unit buttons
  document.addEventListener('mousedown', (e) => {
    const button = e.target.closest('.kuf-unit-btn, .kuf-upgrade-btn');
    if (!button) return;
    
    const action = () => {
      button.click();
    };
    startHold(button, action);
  });
  
  document.addEventListener('mouseup', stopHold);
  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.kuf-unit-btn, .kuf-upgrade-btn')) {
      stopHold();
    }
  });
  
  // Touch support
  document.addEventListener('touchstart', (e) => {
    const button = e.target.closest('.kuf-unit-btn, .kuf-upgrade-btn');
    if (!button) return;
    
    const action = () => {
      button.click();
    };
    startHold(button, action);
  }, { passive: true });
  
  document.addEventListener('touchend', stopHold, { passive: true });
  document.addEventListener('touchcancel', stopHold, { passive: true });
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
  bindButtons();
  setupHoldToSpam();
  attachStateListener();
  ensureSimulationInstance();
  applyKufMapData(kufMapList);
  if (!removeKufMapListener) {
    removeKufMapListener = onKufMapsReady((maps) => {
      applyKufMapData(maps);
    });
  }
  loadKufMaps().catch((error) => {
    console.error('Failed to load Kuf map data', error);
  });
  updateUnitDisplay();
  updateUpgradeDisplay();
  updateCodexDisplay();
  primeLastResult();
}

/**
 * Refresh UI readouts from the latest state snapshot.
 */
export function updateKufDisplay() {
  updateUnitDisplay();
  updateUpgradeDisplay();
  updateCodexDisplay();
  updateMapDetails();
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
  if (removeKufMapListener) {
    removeKufMapListener();
    removeKufMapListener = null;
  }
}
