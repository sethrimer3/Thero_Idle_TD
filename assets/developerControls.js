// Developer control bindings and handlers extracted from the main orchestration layer.
// This module now owns the formatting helpers, DOM bindings, and state mutation
// routines that power the Codex developer panel.

let developerContext = null;

const developerControlElements = {
  container: null,
  fields: {
    moteBank: null,
    moteRate: null,
    startThero: null,
    theroMultiplier: null,
    glyphsAleph: null,
    glyphsBet: null,
    glyphsLamed: null,
    glyphsTsadi: null,
    glyphsShin: null,
    glyphsKuf: null,
    betDropRate: null,
    betDropBank: null,
  },
  toggles: {
    infiniteThero: null,
  },
};

/**
 * Guard helper so exported handlers can safely reference the configured context.
 */
function getContext() {
  return developerContext || {};
}

function isDeveloperModeActive() {
  return Boolean(getContext().isDeveloperModeActive?.());
}

function getPowderSimulation() {
  return getContext().getPowderSimulation?.() || null;
}

function getFluidSimulation() {
  return getContext().getFluidSimulation?.() || null;
}

function getLamedSimulation() {
  return getContext().getLamedSimulation?.() || null;
}

function getTsadiSimulation() {
  return getContext().getTsadiSimulation?.() || null;
}

// Toggle whether all levels should start with infinite Thero for developer sandboxing.
function setDeveloperInfiniteTheroEnabled(active) {
  const context = getContext();
  if (typeof context.setDeveloperInfiniteTheroEnabled === 'function') {
    context.setDeveloperInfiniteTheroEnabled(Boolean(active));
  }
  recordDeveloperAdjustment('infinite-thero', active ? 'enabled' : 'disabled');
}

function recordDeveloperAdjustment(field, value) {
  if (!isDeveloperModeActive()) {
    return;
  }
  const recordPowderEvent = getContext().recordPowderEvent;
  if (typeof recordPowderEvent === 'function') {
    recordPowderEvent('developer-adjust', { field, value });
  }
}

function formatDeveloperInteger(value) {
  if (!Number.isFinite(value)) {
    return '';
  }
  return String(Math.max(0, Math.round(value)));
}

function formatDeveloperFloat(value, precision = 2) {
  if (!Number.isFinite(value)) {
    return '';
  }
  const normalized = Math.max(0, value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(precision);
}

function setDeveloperIdleMoteBank(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, Math.floor(value));
  const simulation = getPowderSimulation();
  if (simulation) {
    simulation.idleBank = normalized;
  }

  const context = getContext();
  const fluidSimulation = getFluidSimulation();
  const powderState = context.powderState;
  const origin = simulation
    ? simulation === fluidSimulation
      ? 'fluid'
      : 'sand'
    : powderState?.simulationMode === 'fluid'
      ? 'fluid'
      : 'sand';

  if (typeof context.handlePowderIdleBankChange === 'function') {
    const idleBankValue = simulation ? simulation.idleBank : normalized;
    context.handlePowderIdleBankChange(idleBankValue, origin);
  }

  recordDeveloperAdjustment('idle-mote-bank', normalized);

  if (typeof context.schedulePowderBasinSave === 'function') {
    context.schedulePowderBasinSave();
  }
  if (typeof context.updatePowderDisplay === 'function') {
    context.updatePowderDisplay();
  }
}

function setDeveloperIdleMoteRate(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, value);
  const simulation = getPowderSimulation();
  if (simulation) {
    simulation.idleDrainRate = normalized;
  }

  const context = getContext();
  const fluidSimulation = getFluidSimulation();
  const powderState = context.powderState;
  if (powderState) {
    if (simulation === fluidSimulation || (!simulation && powderState.simulationMode === 'fluid')) {
      powderState.fluidIdleDrainRate = normalized;
    } else {
      powderState.idleDrainRate = normalized;
    }
  }

  recordDeveloperAdjustment('idle-mote-rate', normalized);

  if (typeof context.schedulePowderBasinSave === 'function') {
    context.schedulePowderBasinSave();
  }
  if (typeof context.updatePowderDisplay === 'function') {
    context.updatePowderDisplay();
  }
}

function setDeveloperBaseStartThero(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, value);
  const context = getContext();
  if (typeof context.setBaseStartThero === 'function') {
    context.setBaseStartThero(normalized);
  }
  recordDeveloperAdjustment('base-start-thero', normalized);

  if (typeof context.updateLevelCards === 'function') {
    context.updateLevelCards();
  }
  if (typeof context.updatePowderLedger === 'function') {
    context.updatePowderLedger();
  }
  if (typeof context.updateStatusDisplays === 'function') {
    context.updateStatusDisplays();
  }
}

function setDeveloperTheroMultiplier(value) {
  const context = getContext();
  if (value === null || value === undefined) {
    if (typeof context.clearDeveloperTheroMultiplierOverride === 'function') {
      context.clearDeveloperTheroMultiplierOverride();
    }
    recordDeveloperAdjustment('thero-multiplier', 'default');
  } else {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, value);
    if (typeof context.setDeveloperTheroMultiplierOverride === 'function') {
      context.setDeveloperTheroMultiplierOverride(normalized);
    }
    recordDeveloperAdjustment('thero-multiplier', normalized);
  }

  if (typeof context.updateLevelCards === 'function') {
    context.updateLevelCards();
  }
  if (typeof context.updatePowderLedger === 'function') {
    context.updatePowderLedger();
  }
  if (typeof context.updateStatusDisplays === 'function') {
    context.updateStatusDisplays();
  }
}

function setDeveloperGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  if (context.powderState) {
    context.powderState.glyphsAwarded = normalized;
    context.powderState.wallGlyphsLit = normalized;
  }
  if (typeof context.setGlyphCurrency === 'function') {
    context.setGlyphCurrency(normalized);
  }

  const stats = context.gameStats;
  if (stats && typeof stats === 'object') {
    stats.enemiesDefeated = normalized;
    if (stats.towersPlaced > normalized) {
      stats.towersPlaced = normalized;
    }
  }

  recordDeveloperAdjustment('glyphs-aleph', normalized);

  if (typeof context.updateStatusDisplays === 'function') {
    context.updateStatusDisplays();
  }
  if (typeof context.schedulePowderBasinSave === 'function') {
    context.schedulePowderBasinSave();
  }
  refreshDeveloperGlyphProgress();
}

/**
 * Synchronize unlock checks and HUD labels after glyph totals change.
 */
function refreshDeveloperGlyphProgress() {
  const context = getContext();
  if (typeof context.updateStatusDisplays === 'function') {
    context.updateStatusDisplays();
  }
  if (typeof context.updateSpireTabVisibility === 'function') {
    context.updateSpireTabVisibility();
  }
  if (typeof context.checkAndUnlockSpires === 'function') {
    context.checkAndUnlockSpires();
  }
}

/**
 * Override the Bet spire glyph tally and currency supply.
 */
function setDeveloperBetGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();

  if (context.powderState) {
    context.powderState.fluidGlyphsAwarded = normalized;
    context.powderState.fluidGlyphsLit = normalized;
  }
  if (typeof context.setBetGlyphCurrency === 'function') {
    context.setBetGlyphCurrency(normalized);
  }

  recordDeveloperAdjustment('glyphs-bet', normalized);
  refreshDeveloperGlyphProgress();
}

/**
 * Override the Lamed spire spark glyph ledger.
 */
function setDeveloperLamedGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  const lamedState = context.spireResourceState?.lamed;
  if (lamedState) {
    lamedState.stats = {
      ...(lamedState.stats || {}),
      totalAbsorptions: normalized,
      totalMassGained: lamedState.stats?.totalMassGained || 0,
    };
  }
  if (typeof context.setTrackedLamedGlyphs === 'function') {
    context.setTrackedLamedGlyphs(normalized);
  }

  recordDeveloperAdjustment('glyphs-lamed', normalized);
  refreshDeveloperGlyphProgress();
}

/**
 * Override the Tsadi spire glyph harvest totals.
 */
function setDeveloperTsadiGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  const tsadiState = context.spireResourceState?.tsadi;
  if (tsadiState) {
    tsadiState.stats = {
      ...(tsadiState.stats || {}),
      totalGlyphs: normalized,
      totalParticles: normalized,
    };
  }
  if (typeof context.setTrackedTsadiGlyphs === 'function') {
    context.setTrackedTsadiGlyphs(normalized);
  }

  recordDeveloperAdjustment('glyphs-tsadi', normalized);
  refreshDeveloperGlyphProgress();
}

/**
 * Override the Shin spire glyph ledger for fractal progress.
 */
function setDeveloperShinGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  if (typeof context.setShinGlyphs === 'function') {
    context.setShinGlyphs(normalized);
  }
  if (typeof context.setTrackedShinGlyphs === 'function') {
    context.setTrackedShinGlyphs(normalized);
  }
  if (typeof context.updateShinDisplay === 'function') {
    context.updateShinDisplay();
  }

  recordDeveloperAdjustment('glyphs-shin', normalized);
  refreshDeveloperGlyphProgress();
}

/**
 * Override the Kuf spire glyph count from the tactics simulator.
 */
function setDeveloperKufGlyphs(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  if (typeof context.setKufGlyphs === 'function') {
    context.setKufGlyphs(normalized);
  }
  if (typeof context.setTrackedKufGlyphs === 'function') {
    context.setTrackedKufGlyphs(normalized);
  }

  recordDeveloperAdjustment('glyphs-kuf', normalized);
  refreshDeveloperGlyphProgress();
}

function setDeveloperBetDropRate(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, value);
  const fluidSimulation = getFluidSimulation();
  if (fluidSimulation && typeof fluidSimulation.idleDrainRate !== 'undefined') {
    fluidSimulation.idleDrainRate = normalized;
  }

  recordDeveloperAdjustment('betDropRate', normalized);
}

function setDeveloperBetDropBank(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, Math.floor(value));
  const fluidSimulation = getFluidSimulation();
  if (fluidSimulation && typeof fluidSimulation.idleBank !== 'undefined') {
    fluidSimulation.idleBank = normalized;
    if (typeof fluidSimulation.notifyIdleBankChange === 'function') {
      fluidSimulation.notifyIdleBankChange();
    }
  }

  recordDeveloperAdjustment('betDropBank', normalized);
}

function setDeveloperIteronBank(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const context = getContext();
  const addIterons = context.addIterons;
  const getIteronBank = context.getIteronBank;

  if (typeof addIterons === 'function' && typeof getIteronBank === 'function') {
    try {
      addIterons(normalized - getIteronBank());
    } catch (error) {
      console.error('Failed to set iteron bank:', error);
    }
  }

  if (typeof context.updateShinDisplay === 'function') {
    context.updateShinDisplay();
  }

  recordDeveloperAdjustment('iteronBank', normalized);
}

function setDeveloperIterationRate(value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.max(0, value);
  const context = getContext();
  if (typeof context.setIterationRate === 'function') {
    try {
      context.setIterationRate(normalized);
    } catch (error) {
      console.error('Failed to set iteration rate:', error);
    }
  }

  if (typeof context.updateShinDisplay === 'function') {
    context.updateShinDisplay();
  }

  recordDeveloperAdjustment('iterationRate', normalized);
}

function setDeveloperLamedBank(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const lamedSimulation = getLamedSimulation();
  if (lamedSimulation && typeof lamedSimulation.sparkBank !== 'undefined') {
    lamedSimulation.sparkBank = normalized;
  }
  recordDeveloperAdjustment('lamedBank', normalized);
}

function setDeveloperLamedRate(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, value);
  const lamedSimulation = getLamedSimulation();
  if (lamedSimulation && typeof lamedSimulation.sparkSpawnRate !== 'undefined') {
    lamedSimulation.sparkSpawnRate = normalized;
  }
  recordDeveloperAdjustment('lamedRate', normalized);
}

function setDeveloperTsadiBank(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, Math.floor(value));
  const tsadiSimulation = getTsadiSimulation();
  if (tsadiSimulation && typeof tsadiSimulation.particleBank !== 'undefined') {
    tsadiSimulation.particleBank = normalized;
  }
  recordDeveloperAdjustment('tsadiBank', normalized);
}

function setDeveloperTsadiRate(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(0, value);
  const tsadiSimulation = getTsadiSimulation();
  if (tsadiSimulation && typeof tsadiSimulation.spawnRate !== 'undefined') {
    tsadiSimulation.spawnRate = normalized;
  }
  recordDeveloperAdjustment('tsadiRate', normalized);
}

const developerFieldHandlers = {
  moteBank: setDeveloperIdleMoteBank,
  moteRate: setDeveloperIdleMoteRate,
  startThero: setDeveloperBaseStartThero,
  theroMultiplier: setDeveloperTheroMultiplier,
  glyphsAleph: setDeveloperGlyphs,
  glyphsBet: setDeveloperBetGlyphs,
  glyphsLamed: setDeveloperLamedGlyphs,
  glyphsTsadi: setDeveloperTsadiGlyphs,
  glyphsShin: setDeveloperShinGlyphs,
  glyphsKuf: setDeveloperKufGlyphs,
  betDropRate: setDeveloperBetDropRate,
  betDropBank: setDeveloperBetDropBank,
  iteronBank: setDeveloperIteronBank,
  iterationRate: setDeveloperIterationRate,
  lamedBank: setDeveloperLamedBank,
  lamedRate: setDeveloperLamedRate,
  tsadiBank: setDeveloperTsadiBank,
  tsadiRate: setDeveloperTsadiRate,
};

function syncDeveloperControlValues() {
  const { fields, toggles } = developerControlElements;
  if (!fields) {
    return;
  }

  const context = getContext();

  if (fields.moteBank && typeof context.getCurrentIdleMoteBank === 'function') {
    fields.moteBank.value = formatDeveloperInteger(context.getCurrentIdleMoteBank());
  }
  if (fields.moteRate && typeof context.getCurrentMoteDispenseRate === 'function') {
    fields.moteRate.value = formatDeveloperFloat(context.getCurrentMoteDispenseRate());
  }
  if (fields.startThero && typeof context.getBaseStartThero === 'function') {
    fields.startThero.value = formatDeveloperInteger(context.getBaseStartThero());
  }
  if (fields.theroMultiplier) {
    const override = typeof context.getDeveloperTheroMultiplierOverride === 'function'
      ? context.getDeveloperTheroMultiplierOverride()
      : null;
    const baseMultiplier = typeof context.getBaseStartingTheroMultiplier === 'function'
      ? context.getBaseStartingTheroMultiplier()
      : null;
    fields.theroMultiplier.placeholder = formatDeveloperFloat(baseMultiplier, 2);
    fields.theroMultiplier.value = Number.isFinite(override) && override >= 0
      ? formatDeveloperFloat(override, 2)
      : '';
  }
  if (fields.glyphsAleph && context.powderState) {
    fields.glyphsAleph.value = formatDeveloperInteger(context.powderState.glyphsAwarded);
  }
  if (fields.glyphsBet && context.powderState) {
    fields.glyphsBet.value = formatDeveloperInteger(context.powderState.fluidGlyphsAwarded);
  }
  const lamedStats = context.spireResourceState?.lamed?.stats;
  if (fields.glyphsLamed) {
    fields.glyphsLamed.value = formatDeveloperInteger(lamedStats?.totalAbsorptions);
  }
  const tsadiStats = context.spireResourceState?.tsadi?.stats;
  if (fields.glyphsTsadi) {
    const tsadiGlyphs = Number.isFinite(tsadiStats?.totalGlyphs)
      ? tsadiStats.totalGlyphs
      : tsadiStats?.totalParticles;
    fields.glyphsTsadi.value = formatDeveloperInteger(tsadiGlyphs);
  }
  if (fields.glyphsShin && typeof context.getShinGlyphs === 'function') {
    fields.glyphsShin.value = formatDeveloperInteger(context.getShinGlyphs());
  }
  if (fields.glyphsKuf && typeof context.getKufGlyphs === 'function') {
    fields.glyphsKuf.value = formatDeveloperInteger(context.getKufGlyphs());
  }

  if (toggles?.infiniteThero) {
    const infiniteTheroActive = typeof context.isDeveloperInfiniteTheroEnabled === 'function'
      ? context.isDeveloperInfiniteTheroEnabled()
      : false;
    toggles.infiniteThero.checked = Boolean(infiniteTheroActive);
  }

  const fluidSimulation = getFluidSimulation();
  if (fields.betDropRate && fluidSimulation) {
    fields.betDropRate.value = formatDeveloperFloat(fluidSimulation.idleDrainRate || 0, 2);
  }
  if (fields.betDropBank && fluidSimulation) {
    fields.betDropBank.value = formatDeveloperInteger(fluidSimulation.idleBank || 0);
  }
}

function updateDeveloperControlsVisibility() {
  const active = isDeveloperModeActive();
  const { container, fields, toggles } = developerControlElements;
  if (container) {
    container.hidden = !active;
    container.setAttribute('aria-hidden', active ? 'false' : 'true');
  }
  if (fields) {
    Object.values(fields).forEach((input) => {
      if (input) {
        input.disabled = !active;
      }
    });
  }

  if (toggles) {
    Object.values(toggles).forEach((input) => {
      if (input) {
        input.disabled = !active;
      }
    });
  }

  if (active) {
    syncDeveloperControlValues();
  }

  const context = getContext();
  if (typeof context.updateDeveloperMapElementsVisibility === 'function') {
    context.updateDeveloperMapElementsVisibility();
  }
  
  // Update Bet Spire debug controls visibility
  if (typeof context.updateBetSpireDebugControlsVisibility === 'function') {
    context.updateBetSpireDebugControlsVisibility(active);
  }

  // Update Aleph Spire debug controls visibility.
  if (typeof context.updatePowderSpireDebugControlsVisibility === 'function') {
    context.updatePowderSpireDebugControlsVisibility(active);
  }
}

function handleDeveloperFieldCommit(event) {
  const input = event?.target;
  if (!input || !(input instanceof HTMLInputElement)) {
    return;
  }

  const field = input.dataset?.developerField;
  if (!field) {
    return;
  }

  if (!isDeveloperModeActive()) {
    syncDeveloperControlValues();
    return;
  }

  const handler = developerFieldHandlers[field];
  if (!handler) {
    return;
  }

  const rawValue = typeof input.value === 'string' ? input.value.trim() : '';
  if (rawValue === '') {
    handler(null);
    syncDeveloperControlValues();
    return;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    syncDeveloperControlValues();
    return;
  }

  handler(parsed);
  syncDeveloperControlValues();
}

function handleDeveloperToggleChange(event) {
  const input = event?.target;
  if (!input || !(input instanceof HTMLInputElement)) {
    return;
  }

  const toggle = input.dataset?.developerToggle;
  if (!toggle) {
    return;
  }

  if (!isDeveloperModeActive()) {
    syncDeveloperControlValues();
    return;
  }

  if (toggle === 'infiniteThero') {
    setDeveloperInfiniteTheroEnabled(Boolean(input.checked));
  }

  syncDeveloperControlValues();
}

function bindDeveloperControls() {
  developerControlElements.container = document.getElementById('developer-control-panel');
  const inputs = document.querySelectorAll('[data-developer-field]');

  inputs.forEach((input) => {
    const field = input.dataset.developerField;
    if (!field) {
      return;
    }
    developerControlElements.fields[field] = input;
    input.disabled = true;
    input.addEventListener('change', handleDeveloperFieldCommit);
    input.addEventListener('blur', handleDeveloperFieldCommit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleDeveloperFieldCommit(event);
      }
    });
  });

  const toggles = document.querySelectorAll('[data-developer-toggle]');
  toggles.forEach((input) => {
    const field = input.dataset.developerToggle;
    if (!field) {
      return;
    }
    developerControlElements.toggles[field] = input;
    input.disabled = true;
    input.addEventListener('change', handleDeveloperToggleChange);
  });

  syncDeveloperControlValues();
  updateDeveloperControlsVisibility();
}

export function configureDeveloperControls(context = {}) {
  developerContext = context;
}

export {
  bindDeveloperControls,
  syncDeveloperControlValues,
  updateDeveloperControlsVisibility,
  setDeveloperIteronBank,
  setDeveloperIterationRate,
};
