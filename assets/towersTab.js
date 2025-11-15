import {
  MATH_SYMBOL_REGEX,
  renderMathElement,
  isLikelyMathExpression,
  annotateMathText,
  convertMathExpressionToPlainText,
} from '../scripts/core/mathText.js';
import { tokenizeEquationParts } from '../scripts/core/mathTokens.js';
import {
  formatGameNumber,
  formatWholeNumber,
  formatDecimal,
  formatPercentage,
  formatSignedPercentage,
} from '../scripts/core/formatting.js';
import {
  canvasFractionToMeters,
  metersToCanvasFraction,
  DEFAULT_TOWER_DIAMETER_METERS,
} from './gameUnits.js'; // Provide unit conversion helpers so tower data can use meters.
import {
  getCraftedEquipment,
  getEquipmentAssignment,
  getTowerEquipmentId,
  getTowerEquipment,
  assignEquipmentToTower,
  clearTowerEquipment,
  addEquipmentListener as addEquipmentStateListener,
} from './equipment.js';
import { formatCombatNumber } from './playfield/utils/formatting.js'; // Format tower costs with the same notation used in combat messaging.
import { TOWER_EQUATION_BLUEPRINTS as IMPORTED_TOWER_BLUEPRINTS } from './towerEquations/index.js'; // Import tower blueprints from refactored modules.
import { initializeBlueprintContext } from './towerEquations/blueprintContext.js'; // Initialize context for tower blueprints.
import { generateMasterEquationText } from './towerEquations/masterEquationUtils.js';
import { createTowerEquationTooltipSystem } from './towerEquationTooltip.js';
import { createTowerUpgradeOverlayController } from './towerUpgradeOverlayController.js';

// Callback to update status displays when glyphs change. Set via configureTowersTabCallbacks.
let updateStatusDisplaysCallback = null;

/**
 * Configure callback dependencies to avoid circular imports.
 */
export function configureTowersTabCallbacks(callbacks = {}) {
  if (typeof callbacks.updateStatusDisplays === 'function') {
    updateStatusDisplaysCallback = callbacks.updateStatusDisplays;
  }
}

const HAS_POINTER_EVENTS = typeof window !== 'undefined' && 'PointerEvent' in window; // Detect pointer support for tooltip listeners.
const EQUATION_TOOLTIP_MARGIN_PX = 12; // Maintain consistent spacing between the tooltip and the hovered variable.
const EQUATION_TOOLTIP_ID = 'tower-upgrade-equation-tooltip'; // Stable id so aria-describedby wiring stays deterministic.
const TOWER_CARD_SELECTOR = '.card[data-tower-id]'; // Limit tower card queries so loadout buttons stay compact.

const UNIVERSAL_VARIABLE_LIBRARY = new Map([
  [
    'atk',
    {
      symbol: 'Atk',
      name: 'Attack',
      description: 'Base damage dealt per strike.',
      units: 'damage/strike', // Clarify core damage units for tooltips.
    },
  ],
  [
    'm',
    {
      symbol: 'm',
      name: 'Range',
      description: 'Effective reach of the lattice (meters).',
      units: 'meters', // Surface range units for hover tooltips.
    },
  ],
  [
    'spd',
    {
      symbol: 'Spd',
      name: 'Attack Speed',
      description: 'Primary attack cadence measured per second.',
      units: 'shots/second', // Provide explicit cadence units for equation tooltips.
    },
  ],
  [
    'dod',
    {
      symbol: 'Dod',
      name: 'Damage over Distance',
      description: 'Damage contribution that scales with travel distance.',
      units: 'damage/meter', // Highlight distance-scaling units for overlays.
    },
  ],
  [
    'def',
    {
      symbol: 'Def',
      name: 'Defense',
      description: 'Flat protection granted to soldier cohorts.',
      units: 'barrier points', // Communicate defensive units in hover popups.
    },
  ],
  [
    'def%',
    {
      symbol: 'Def%',
      name: 'Defense Percent',
      description: 'Percentage-based defense granted to soldier cohorts.',
      units: 'percent', // Mark percentage-based modifiers for consistency.
    },
  ],
  [
    'atk%',
    {
      symbol: 'Atk%',
      name: 'Attack Percent',
      description: 'Percentage-based increase to attack power.',
      units: 'percent', // Annotate attack percentage modifiers for clarity.
    },
  ],
  [
    'prc',
    {
      symbol: 'Prc',
      name: 'Pierce',
      description: 'How many enemies a projectile can pass through.',
      units: 'targets', // Indicate piercing targets for tooltips.
    },
  ],
  [
    'chn',
    {
      symbol: 'Chn',
      name: 'Chaining',
      description: 'Number of additional targets a strike can arc toward.',
      units: 'targets', // Specify chaining reach count for tooltips.
    },
  ],
  [
    'slw%',
    {
      symbol: 'Slw%',
      name: 'Slow Percent',
      description: 'Percentage-based slow applied to enemies.',
      units: 'percent', // Reinforce slow potency units.
    },
  ],
  [
    'tot',
    {
      symbol: 'Tot',
      name: 'Total',
      description: 'Maximum allied units commanded simultaneously.',
      units: 'units', // Identify population capacity for tooltips.
    },
  ],
]);

// State container for all Towers tab systems.
const FALLBACK_RANGE_FRACTION = 0.24; // Preserve historic gameplay balance when range data is missing.

const towerTabState = {
  towerDefinitions: [],
  towerDefinitionMap: new Map(),
  towerLoadoutLimit: 4,
  loadoutState: { selected: ['alpha'] },
  unlockState: { unlocked: new Set(['alpha']) },
  mergeProgress: { mergingLogicUnlocked: false },
  mergingLogicElements: { card: null },
  loadoutElements: { container: null, grid: null, note: null },
  selectionButtons: new Map(),
  loadoutDrag: { active: false, pointerId: null, towerId: null, element: null },
  renderedLoadoutSignature: null,
  theroSymbol: 'þ',
  towerUpgradeElements: {
    overlay: null,
    panel: null,
    close: null,
    title: null,
    tier: null,
    glyphs: null,
    baseEquation: null,
    baseEquationValues: null,
    variables: null,
    note: null,
    icon: null,
    hideTimeoutId: null,
    hideTransitionHandler: null,
    lastRenderedTowerId: null,
  },
  towerUpgradeState: new Map(),
  towerEquationCache: new Map(),
  towerVariableAnimation: {
    towerId: null,
    variableMap: new Map(),
    variableSpans: new Map(),
    entryPlayed: false,
    shouldPlayEntry: false,
  },
  equationTooltip: {
    element: null, // Cache the tooltip element so we only build it once per session.
    currentTarget: null, // Track which variable currently anchors the tooltip for cleanup.
    hideTimeoutId: null, // Delay hiding briefly to prevent flicker between adjacent variables.
  },
  equipmentUi: {
    slots: new Map(),
    activeTowerId: null,
    unsubscribe: null,
    closeHandlersBound: false,
    documentListenerBound: false,
  },
  activeTowerUpgradeId: null,
  activeTowerUpgradeBaseEquation: '',
  lastTowerUpgradeTrigger: null,
  audioManager: null,
  playfield: null,
  glyphCurrency: 0,
  betGlyphCurrency: 0,
  hideUpgradeMatrix: null,
  renderUpgradeMatrix: null,
  discoveredVariables: new Map(),
  discoveredVariableListeners: new Set(),
  dynamicContext: null,
};

const {
  ensureTooltipElement: ensureEquationTooltipElement,
  buildVariableTooltip: buildEquationVariableTooltip,
  hideTooltip: hideEquationTooltip,
  handlePointerEnter: handleEquationVariablePointerEnter,
  handlePointerLeave: handleEquationVariablePointerLeave,
  handleFocus: handleEquationVariableFocus,
  handleBlur: handleEquationVariableBlur,
} = createTowerEquationTooltipSystem({
  tooltipState: towerTabState.equationTooltip,
  getPanelElement: () => towerTabState.towerUpgradeElements.panel,
  getUniversalVariableMetadata,
  tooltipId: EQUATION_TOOLTIP_ID,
  tooltipMarginPx: EQUATION_TOOLTIP_MARGIN_PX,
});

const towerUpgradeOverlayController = createTowerUpgradeOverlayController({
  towerTabState,
  hasPointerEvents: HAS_POINTER_EVENTS,
  formatters: { formatWholeNumber, formatDecimal, formatGameNumber },
  math: {
    renderMathElement,
    convertMathExpressionToPlainText,
    tokenizeEquationParts,
  },
  tooltip: {
    ensureTooltipElement: ensureEquationTooltipElement,
    buildVariableTooltip: buildEquationVariableTooltip,
    hideTooltip: hideEquationTooltip,
    handlePointerEnter: handleEquationVariablePointerEnter,
    handlePointerLeave: handleEquationVariablePointerLeave,
    handleFocus: handleEquationVariableFocus,
    handleBlur: handleEquationVariableBlur,
  },
  dependencies: {
    ensureTowerUpgradeState,
    getTowerEquationBlueprint,
    getTowerDefinition,
    computeTowerVariableValue,
    calculateTowerVariableUpgradeCost,
    calculateTowerEquationResult,
    invalidateTowerEquationCache,
    buildTowerDynamicContext,
  },
});

const {
  updateTowerUpgradeGlyphDisplay,
  renderTowerUpgradeOverlay,
  openTowerUpgradeOverlay,
  closeTowerUpgradeOverlay,
  getTowerUpgradeOverlayElement,
  isTowerUpgradeOverlayActive,
  getActiveTowerUpgradeId,
  handleTowerVariableUpgrade,
  handleTowerVariableDowngrade,
  bindTowerUpgradeOverlay,
} = towerUpgradeOverlayController;

export {
  updateTowerUpgradeGlyphDisplay,
  renderTowerUpgradeOverlay,
  openTowerUpgradeOverlay,
  closeTowerUpgradeOverlay,
  getTowerUpgradeOverlayElement,
  isTowerUpgradeOverlayActive,
  getActiveTowerUpgradeId,
  handleTowerVariableUpgrade,
  handleTowerVariableDowngrade,
  bindTowerUpgradeOverlay,
};

const fallbackTowerBlueprints = new Map();

// Ensure tower definitions expose meter-calibrated sizing and range data.
function normalizeTowerDefinition(definition = {}) {
  const clone = { ...definition };
  const explicitDiameter = Number.isFinite(clone.diameterMeters)
    ? Math.max(clone.diameterMeters, 0)
    : null;
  const diameterMeters = explicitDiameter && explicitDiameter > 0
    ? explicitDiameter
    : DEFAULT_TOWER_DIAMETER_METERS;
  clone.diameterMeters = diameterMeters;
  clone.radiusMeters = diameterMeters / 2;

  const explicitRangeMeters = Number.isFinite(clone.rangeMeters) ? clone.rangeMeters : null;
  const fallbackFraction = Number.isFinite(clone.range) ? clone.range : FALLBACK_RANGE_FRACTION;
  const rangeMeters = explicitRangeMeters && explicitRangeMeters > 0
    ? explicitRangeMeters
    : canvasFractionToMeters(fallbackFraction);
  clone.rangeMeters = Math.max(rangeMeters, 0);
  clone.range = metersToCanvasFraction(clone.rangeMeters);
  return clone;
}

export function setTowerDefinitions(definitions = []) {
  const normalizedDefinitions = Array.isArray(definitions)
    ? definitions.map((tower) => normalizeTowerDefinition(tower))
    : []; // Normalize raw tower entries so each one includes meter-aware values.
  towerTabState.towerDefinitions = normalizedDefinitions;
  towerTabState.towerDefinitionMap = new Map(
    towerTabState.towerDefinitions.map((tower) => [tower.id, tower]),
  );
}

export function getTowerDefinitions() {
  return towerTabState.towerDefinitions;
}

export function setTowerLoadoutLimit(limit) {
  if (Number.isFinite(limit) && limit > 0) {
    towerTabState.towerLoadoutLimit = Math.max(1, Math.floor(limit));
  }
}

export function getTowerLoadoutState() {
  return towerTabState.loadoutState;
}

export function getTowerUnlockState() {
  return towerTabState.unlockState;
}

export function getMergeProgressState() {
  return towerTabState.mergeProgress;
}

export function setMergingLogicCard(element) {
  towerTabState.mergingLogicElements.card = element || null;
  updateMergingLogicVisibility();
}

export function setLoadoutElements({ container = null, grid = null, note = null } = {}) {
  towerTabState.loadoutElements.container = container;
  towerTabState.loadoutElements.grid = grid;
  towerTabState.loadoutElements.note = note;
  updateLoadoutNote();
}

export function setAudioManager(manager) {
  towerTabState.audioManager = manager || null;
}

export function setPlayfield(playfield) {
  towerTabState.playfield = playfield || null;
}

export function setGlyphCurrency(value) {
  if (Number.isFinite(value)) {
    towerTabState.glyphCurrency = Math.max(0, Math.floor(value));
    updateTowerUpgradeGlyphDisplay();
    updateStatusDisplaysCallback?.(); // Update tower tab resource summary to reflect glyph changes.
  }
}

export function addGlyphCurrency(delta) {
  if (Number.isFinite(delta)) {
    setGlyphCurrency(towerTabState.glyphCurrency + delta);
  }
}

export function getGlyphCurrency() {
  return towerTabState.glyphCurrency;
}

export function setBetGlyphCurrency(value) {
  if (Number.isFinite(value)) {
    towerTabState.betGlyphCurrency = Math.max(0, Math.floor(value));
    updateTowerUpgradeGlyphDisplay();
    updateStatusDisplaysCallback?.(); // Update tower tab resource summary to reflect Bet glyph changes.
  }
}

export function addBetGlyphCurrency(delta) {
  if (Number.isFinite(delta)) {
    setBetGlyphCurrency(towerTabState.betGlyphCurrency + delta);
  }
}

export function getBetGlyphCurrency() {
  return towerTabState.betGlyphCurrency;
}

export function setTheroSymbol(symbol = 'þ') {
  if (typeof symbol === 'string' && symbol.trim()) {
    towerTabState.theroSymbol = symbol;
  } else {
    towerTabState.theroSymbol = 'þ';
  }
}

export function setHideUpgradeMatrixCallback(callback) {
  towerTabState.hideUpgradeMatrix = typeof callback === 'function' ? callback : null;
}

export function setRenderUpgradeMatrixCallback(callback) {
  towerTabState.renderUpgradeMatrix = typeof callback === 'function' ? callback : null;
}

function updateMergingLogicVisibility() {
  const { mergingLogicElements, mergeProgress } = towerTabState;
  if (!mergingLogicElements.card) {
    return;
  }
  const visible = mergeProgress.mergingLogicUnlocked;
  mergingLogicElements.card.hidden = !visible;
  mergingLogicElements.card.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function setMergingLogicUnlocked(value = true) {
  towerTabState.mergeProgress.mergingLogicUnlocked = Boolean(value);
  updateMergingLogicVisibility();
  if (!towerTabState.mergeProgress.mergingLogicUnlocked) {
    const { hideUpgradeMatrix } = towerTabState;
    if (typeof hideUpgradeMatrix === 'function') {
      hideUpgradeMatrix();
    }
  }
}

function updateLoadoutNote() {
  const { loadoutElements, loadoutState } = towerTabState;
  if (!loadoutElements.note) {
    return;
  }
  if (!loadoutState.selected.length) {
    loadoutElements.note.textContent =
      'Select towers on the Towers tab to prepare up to four glyphs for this defense.';
  } else {
    loadoutElements.note.textContent =
      'Select four towers to bring into the defense. Drag the glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge.';
  }
}

function deriveGlyphRankFromLevel(level, minimum = 1) {
  const normalizedLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  const normalizedMinimum = Number.isFinite(minimum) ? Math.max(1, Math.floor(minimum)) : 1;
  return normalizedMinimum + normalizedLevel;
}

function sanitizeTowerContextEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
  if (!id) {
    return null;
  }
  const type = typeof entry.type === 'string' && entry.type.trim() ? entry.type.trim() : null;
  const x = Number(entry.x);
  const y = Number(entry.y);
  const range = Number(entry.range);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const connections = Array.isArray(entry.connections)
    ? entry.connections.map((value) => (typeof value === 'string' ? value : String(value))).filter(Boolean)
    : [];
  const sources = Array.isArray(entry.sources)
    ? entry.sources.map((value) => (typeof value === 'string' ? value : String(value))).filter(Boolean)
    : [];
  const stats = {};
  const kills = Number(entry.nuKills);
  if (Number.isFinite(kills) && kills >= 0) {
    stats.nuKills = kills;
  }
  const overkillTotal = Number(entry.nuOverkillTotal);
  if (Number.isFinite(overkillTotal) && overkillTotal >= 0) {
    stats.nuOverkillTotal = overkillTotal;
  }
  const normalizedStats = Object.keys(stats).length ? stats : null;
  return {
    id,
    type,
    x,
    y,
    range: Number.isFinite(range) && range > 0 ? range : 0,
    connections,
    sources,
    stats: normalizedStats,
  };
}

/**
 * Construct an adjacency context describing which towers share overlapping range
 * so dynamic equation variables (e.g., connection counts) can be evaluated.
 */
export function buildTowerDynamicContext(options = {}) {
  const collection = [];
  const providedTowers = Array.isArray(options.contextTowers) ? options.contextTowers : [];
  providedTowers.forEach((entry) => {
    const sanitized = sanitizeTowerContextEntry(entry);
    if (sanitized) {
      collection.push(sanitized);
    }
  });

  const targetCandidate = sanitizeTowerContextEntry(options.contextTower);
  if (targetCandidate && !collection.some((tower) => tower.id === targetCandidate.id)) {
    collection.push(targetCandidate);
  }

  const contextTowerId = typeof options.contextTowerId === 'string' && options.contextTowerId.trim()
    ? options.contextTowerId.trim()
    : targetCandidate?.id || null;

  if (!contextTowerId) {
    return null;
  }

  const target = collection.find((tower) => tower.id === contextTowerId);
  if (!target) {
    return null;
  }

  const counts = new Map();
  const idMap = new Map(collection.map((entry) => [entry.id, entry]));
  const explicitSources = Array.isArray(target.sources) ? target.sources : [];
  if (explicitSources.length) {
    explicitSources.forEach((sourceId) => {
      const candidate = idMap.get(sourceId);
      if (!candidate || candidate.id === target.id) {
        return;
      }
      const key = candidate.type || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  } else {
    collection.forEach((candidate) => {
      if (!candidate || candidate.id === target.id) {
        return;
      }
      const dx = candidate.x - target.x;
      const dy = candidate.y - target.y;
      const distance = Math.hypot(dx, dy);
      const targetRange = Number.isFinite(target.range) ? Math.max(0, target.range) : 0;
      const candidateRange = Number.isFinite(candidate.range) ? Math.max(0, candidate.range) : 0;
      if (!Number.isFinite(distance) || distance === 0) {
        if (distance === 0 && candidateRange > 0 && targetRange > 0) {
          const key = candidate.type || 'unknown';
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        return;
      }
      if (distance > targetRange || distance > candidateRange) {
        return;
      }
      const key = candidate.type || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  }

  return {
    towerId: target.id,
    towerType: target.type || null,
    counts,
    stats: target.stats || null,
  };
}

function getDynamicConnectionCount(towerType) {
  if (!towerType) {
    return 0;
  }
  const context = towerTabState.dynamicContext;
  if (!context || !(context.counts instanceof Map)) {
    return 0;
  }
  return context.counts.get(towerType) || 0;
}

/**
 * Temporarily apply a dynamic-context snapshot while evaluating a callback so
 * equation math can query the correct adjacency counts without mutating global state.
 */
export function withTowerDynamicContext(context, evaluator) {
  const previousContext = towerTabState.dynamicContext;
  towerTabState.dynamicContext = context || null;
  try {
    return typeof evaluator === 'function' ? evaluator() : null;
  } finally {
    towerTabState.dynamicContext = previousContext;
  }
}

// Use imported tower blueprints from refactored modules
const TOWER_EQUATION_BLUEPRINTS = IMPORTED_TOWER_BLUEPRINTS;

// Legacy TOWER_EQUATION_BLUEPRINTS definition removed - now imported from ./towerEquations/
// The original definition (lines 520-3086) has been refactored into:
// - ./towerEquations/mindGate.js (mind-gate)
// - ./towerEquations/basicTowers.js (alpha, beta, gamma)
// - ./towerEquations/greekTowers.js (delta, epsilon, zeta, eta, theta, iota)
// - ./towerEquations/advancedTowers.js (kappa, lambda, mu, nu, xi, omicron, pi)
// See ./towerEquations/agent.md for documentation

export function getTowerDefinition(towerId) {
  return towerTabState.towerDefinitionMap.get(towerId) || null;
}

export function getNextTowerId(towerId) {
  const definition = getTowerDefinition(towerId);
  return definition?.nextTierId || null;
}

export function isTowerUnlocked(towerId) {
  return towerTabState.unlockState.unlocked.has(towerId);
}

export function isTowerPlaceable(towerId) {
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return false;
  }
  return definition.placeable !== false;
}

export function unlockTower(towerId, { silent = false } = {}) {
  if (!towerId || !towerTabState.towerDefinitionMap.has(towerId)) {
    return false;
  }
  if (towerTabState.unlockState.unlocked.has(towerId)) {
    if (towerId === 'beta') {
      setMergingLogicUnlocked(true);
    }
    return false;
  }
  towerTabState.unlockState.unlocked.add(towerId);
  discoverTowerVariables(towerId);
  if (typeof document !== 'undefined') {
    // Notify other systems (such as the tower tree map) that unlock visibility should refresh.
    document.dispatchEvent(
      new CustomEvent('tower-unlocked', {
        detail: {
          towerId,
          unlockedTowers: Array.from(towerTabState.unlockState.unlocked),
        },
      }),
    );
  }
  if (towerId === 'beta') {
    setMergingLogicUnlocked(true);
  }
  updateTowerCardVisibility();
  updateTowerSelectionButtons();
  syncLoadoutToPlayfield();
  if (!silent && towerTabState.playfield?.messageEl) {
    const definition = getTowerDefinition(towerId);
    towerTabState.playfield.messageEl.textContent = `${
      definition?.symbol || 'New'
    } lattice discovered—add it to your loadout from the Towers tab.`;
  }
  if (towerTabState.towerUpgradeElements.overlay?.classList.contains('active')) {
    renderTowerUpgradeOverlay(towerId, {});
  }
  if (typeof towerTabState.renderUpgradeMatrix === 'function') {
    towerTabState.renderUpgradeMatrix();
  }
  return true;
}

function createPreviewId(prefix, value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${slug || 'preview'}`;
}

// Additional tower-tab functions continue below.
export function pruneLockedTowersFromLoadout() {
  const selected = towerTabState.loadoutState.selected;
  let changed = false;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const towerId = selected[index];
    if (!isTowerUnlocked(towerId) || !isTowerPlaceable(towerId)) {
      selected.splice(index, 1);
      changed = true;
    }
  }
  return changed;
}

export function refreshTowerLoadoutDisplay() {
  const { grid } = towerTabState.loadoutElements;
  if (!grid) {
    return;
  }
  const interactive = Boolean(towerTabState.playfield && towerTabState.playfield.isInteractiveLevelActive());
  const items = grid.querySelectorAll('.tower-loadout-item');
  const energy = interactive && towerTabState.playfield ? towerTabState.playfield.energy : 0; // Cache the current energy pool so affordability checks remain consistent within this render.
  // Format loadout cost readouts using the combat formatter while guarding against infinite numbers.
  const formatCostLabel = (value) => {
    if (!Number.isFinite(value)) {
      return '∞';
    }
    return formatCombatNumber(Math.max(0, value));
  };
  items.forEach((item) => {
    const towerId = item.dataset.towerId;
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return;
    }
    const anchorCostValue = towerTabState.playfield
      ? towerTabState.playfield.getCurrentTowerCost(towerId)
      : Number.isFinite(definition.baseCost)
      ? definition.baseCost
      : 0;
    const anchorCostLabel = formatCostLabel(anchorCostValue);
    const canAffordAnchor = interactive && energy >= anchorCostValue; // Determine whether the player can currently afford to place this tower.
    const costEl = item.querySelector('.tower-loadout-cost');
    if (costEl) {
      // Surface the current anchoring cost directly beneath the tower icon for quick scanning.
      costEl.textContent = `Anchor: ${anchorCostLabel} ${towerTabState.theroSymbol}`;
      costEl.dataset.affordable = canAffordAnchor ? 'true' : 'false';
    }
    const upgradeCostEl = item.querySelector('.tower-loadout-upgrade-cost');
    const nextTowerId = getNextTowerId(towerId);
    const nextDefinition = nextTowerId ? getTowerDefinition(nextTowerId) : null;
    let upgradeAriaLabel = 'Upgrade unavailable';
    if (upgradeCostEl) {
      if (nextDefinition) {
        const mergeCostValue = towerTabState.playfield
          ? towerTabState.playfield.getCurrentTowerCost(nextTowerId)
          : Number.isFinite(nextDefinition.baseCost)
          ? nextDefinition.baseCost
          : 0;
        const mergeCostLabel = formatCostLabel(mergeCostValue);
        // Highlight the energy required to upgrade into the next tier so players can budget upgrades.
        upgradeCostEl.textContent = `Upgrade: ${mergeCostLabel} ${towerTabState.theroSymbol}`;
        upgradeCostEl.dataset.available = 'true';
        const canAffordUpgrade = interactive && energy >= mergeCostValue; // Determine whether the current energy pool supports the upgrade cost.
        upgradeCostEl.dataset.affordable = canAffordUpgrade ? 'true' : 'false';
        upgradeAriaLabel = `Upgrade ${mergeCostLabel} ${towerTabState.theroSymbol}`;
      } else {
        // Make it clear when no higher tier exists, keeping the layout stable.
        upgradeCostEl.textContent = 'Upgrade: —';
        upgradeCostEl.dataset.available = 'false';
        upgradeCostEl.dataset.affordable = 'false'; // Ensure the glow stays disabled when no upgrade path exists.
        upgradeAriaLabel = 'Upgrade unavailable';
      }
    }
    if (definition && item) {
      const labelParts = [
        definition.name,
        `Anchor ${anchorCostLabel} ${towerTabState.theroSymbol}`,
        upgradeAriaLabel,
      ];
      item.setAttribute('aria-label', labelParts.join(' — ')); // Surface name, base cost, and upgrade cost for screen readers.
    }
    item.dataset.valid = canAffordAnchor ? 'true' : 'false';
    item.dataset.disabled = interactive ? 'false' : 'true';
    item.disabled = !interactive;
  });
}

function renderTowerLoadout() {
  const { grid } = towerTabState.loadoutElements;
  if (!grid) {
    towerTabState.renderedLoadoutSignature = null;
    return;
  }

  const selected = towerTabState.loadoutState.selected;
  const signature = selected.join('|');
  const existingCount = grid.childElementCount;

  if (signature === towerTabState.renderedLoadoutSignature && existingCount === selected.length) {
    refreshTowerLoadoutDisplay();
    updateLoadoutNote();
    return;
  }

  grid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  towerTabState.renderedLoadoutSignature = signature;

  if (!selected.length) {
    updateLoadoutNote();
    return;
  }

  selected.forEach((towerId) => {
    const definition = getTowerDefinition(towerId);
    if (!definition || definition.placeable === false) {
      return;
    }

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tower-loadout-item';
    item.dataset.towerId = towerId;
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-label', definition.name); // Seed an accessible label until the live cost is calculated.

    const artwork = document.createElement('img');
    artwork.className = 'tower-loadout-art';
    if (definition.icon) {
      artwork.src = definition.icon;
      artwork.alt = `${definition.name} sigil`;
      artwork.decoding = 'async';
      artwork.loading = 'lazy';
    } else {
      artwork.alt = '';
      artwork.setAttribute('aria-hidden', 'true');
    }

    const costEl = document.createElement('span');
    costEl.className = 'tower-loadout-cost';
    costEl.textContent = 'Anchor: —'; // Seed the anchor cost label so the slot never flashes empty during initialization.
    costEl.dataset.affordable = 'false'; // Initialize the affordability state so the glow only appears once the player can pay the anchor cost.

    const upgradeCostEl = document.createElement('span');
    upgradeCostEl.className = 'tower-loadout-upgrade-cost';
    upgradeCostEl.dataset.available = 'false';
    upgradeCostEl.dataset.affordable = 'false'; // Initialize the upgrade affordability state to avoid showing the glow prematurely.
    upgradeCostEl.textContent = 'Upgrade: —'; // Seed the upgrade cost line so layout stays stable during updates.

    item.append(artwork, costEl, upgradeCostEl); // Present the icon with both anchor and upgrade costs stacked below it for quick scanning.

    item.addEventListener('pointerdown', (event) => startTowerDrag(event, towerId, item));

    fragment.append(item);
  });

  grid.append(fragment);
  refreshTowerLoadoutDisplay();
  updateLoadoutNote();
}

export function cancelTowerDrag() {
  const drag = towerTabState.loadoutDrag;
  if (!drag.active) {
    return;
  }
  document.removeEventListener('pointermove', handleTowerDragMove);
  document.removeEventListener('pointerup', handleTowerDragEnd);
  document.removeEventListener('pointercancel', handleTowerDragEnd);
  if (drag.element) {
    try {
      drag.element.releasePointerCapture(drag.pointerId);
    } catch (error) {
      // Ignore pointer-capture errors.
    }
    drag.element.removeAttribute('data-state');
  }
  towerTabState.playfield?.finishTowerDrag();
  towerTabState.playfield?.clearPlacementPreview();
  drag.active = false;
  drag.pointerId = null;
  drag.towerId = null;
  drag.element = null;
  refreshTowerLoadoutDisplay();
}

function handleTowerDragMove(event) {
  const drag = towerTabState.loadoutDrag;
  if (!drag.active || event.pointerId !== drag.pointerId) {
    return;
  }
  const element = drag.element;
  if (element) {
    element.dataset.state = 'dragging';
  }
  if (!towerTabState.playfield) {
    return;
  }
  const normalized = towerTabState.playfield.getNormalizedFromEvent(event);
  if (normalized) {
    towerTabState.playfield.previewTowerPlacement(normalized, {
      towerType: drag.towerId,
      dragging: true,
    }); // Maintain a floating preview while the tower is dragged across the battlefield.
  }
}

function finalizeTowerDrag(event) {
  const drag = towerTabState.loadoutDrag;
  if (!drag.active || event.pointerId !== drag.pointerId) {
    return;
  }
  if (drag.element) {
    try {
      drag.element.releasePointerCapture(drag.pointerId);
    } catch (error) {
      // Ignore pointer-capture errors.
    }
    drag.element.removeAttribute('data-state');
  }

  document.removeEventListener('pointermove', handleTowerDragMove);
  document.removeEventListener('pointerup', handleTowerDragEnd);
  document.removeEventListener('pointercancel', handleTowerDragEnd);

  if (towerTabState.playfield) {
    const normalized = towerTabState.playfield.getNormalizedFromEvent(event);
    if (normalized) {
      towerTabState.playfield.completeTowerPlacement(normalized, { towerType: drag.towerId });
    } else {
      towerTabState.playfield.clearPlacementPreview();
    }
    towerTabState.playfield.finishTowerDrag();
  }

  drag.active = false;
  drag.pointerId = null;
  drag.towerId = null;
  drag.element = null;
  refreshTowerLoadoutDisplay();
}

function handleTowerDragEnd(event) {
  finalizeTowerDrag(event);
}

// ---------- Tower equipment slot helpers ----------

const EMPTY_EQUIPMENT_SYMBOL = '∅';

function getEquipmentSlotRecord(towerId) {
  return towerTabState.equipmentUi.slots.get(towerId) || null;
}

function createTowerEquipmentSlot(towerId, card) {
  if (towerTabState.equipmentUi.slots.has(towerId)) {
    return;
  }

  const container = document.createElement('div');
  container.className = 'tower-equipment-slot';
  container.dataset.towerId = towerId;
  container.dataset.menuOpen = 'false';

  const baseLabel = getTowerSourceLabel(towerId);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tower-equipment-button';
  button.dataset.towerEquipmentButton = towerId;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `Select equipment for ${baseLabel}`);
  button.title = `Empty slot for ${baseLabel}`;

  const icon = document.createElement('span');
  icon.className = 'tower-equipment-button__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = EMPTY_EQUIPMENT_SYMBOL;

  button.append(icon);

  const caption = document.createElement('span');
  caption.className = 'tower-equipment-slot__caption';
  caption.textContent = 'Empty';

  const menu = document.createElement('div');
  menu.className = 'tower-equipment-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-hidden', 'true');
  menu.hidden = true;
  menu.dataset.towerEquipmentMenu = towerId;

  const list = document.createElement('ul');
  list.className = 'tower-equipment-menu__list';
  menu.append(list);

  container.append(button, caption, menu);

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTowerEquipmentMenu(towerId);
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTowerEquipmentMenu(towerId);
    }
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeTowerEquipmentMenu({ restoreFocus: true });
    }
  });

  const slotRecord = {
    container,
    button,
    icon,
    name: caption,
    menu,
    list,
    baseLabel,
  };

  towerTabState.equipmentUi.slots.set(towerId, slotRecord);

  const equipButton = card.querySelector('.tower-equip-button');
  if (equipButton && equipButton.parentNode) {
    equipButton.parentNode.insertBefore(container, equipButton);
  } else {
    const footer = card.querySelector('.card-footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(container, footer);
    } else {
      card.append(container);
    }
  }

  updateTowerEquipmentSlot(towerId);
}

function ensureTowerEquipmentSlots() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const towerId = card.dataset.towerId;
    if (!towerId) {
      return;
    }
    createTowerEquipmentSlot(towerId, card);
  });
}

function updateTowerEquipmentSlot(towerId) {
  const slot = getEquipmentSlotRecord(towerId);
  if (!slot) {
    return;
  }
  const equipment = getTowerEquipment(towerId);
  if (equipment) {
    const displaySymbol = equipment.symbol || equipment.name?.charAt(0) || '?';
    slot.container.dataset.filled = 'true';
    slot.icon.textContent = displaySymbol;
    slot.name.textContent = equipment.name;
    slot.button.setAttribute(
      'aria-label',
      `Change equipment for ${slot.baseLabel} (${equipment.name})`,
    );
    slot.button.title = `${equipment.name} equipped to ${slot.baseLabel}`;
  } else {
    slot.container.dataset.filled = 'false';
    slot.icon.textContent = EMPTY_EQUIPMENT_SYMBOL;
    slot.name.textContent = 'Empty';
    slot.button.setAttribute('aria-label', `Select equipment for ${slot.baseLabel}`);
    slot.button.title = `Empty slot for ${slot.baseLabel}`;
  }
}

function createEquipmentMenuButton(towerId, equipment) {
  const item = document.createElement('li');
  item.className = 'tower-equipment-menu__item-wrapper';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tower-equipment-menu__item';
  button.dataset.equipmentOption = equipment ? equipment.id : 'empty';
  button.setAttribute('role', 'option');

  if (!equipment) {
    button.textContent = 'Empty Slot';
    const assignedId = getTowerEquipmentId(towerId);
    button.setAttribute('aria-selected', assignedId ? 'false' : 'true');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearTowerEquipment(towerId);
      closeTowerEquipmentMenu({ restoreFocus: true });
    });
    item.append(button);
    return item;
  }

  const symbol = document.createElement('span');
  symbol.className = 'tower-equipment-menu__symbol';
  symbol.textContent = equipment.symbol || equipment.name?.charAt(0) || '?';
  symbol.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'tower-equipment-menu__label';
  label.textContent = equipment.name;

  button.append(symbol, label);

  const assignmentId = getEquipmentAssignment(equipment.id);
  const assignedHere = assignmentId === towerId;
  button.setAttribute('aria-selected', assignedHere ? 'true' : 'false');

  if (assignmentId && assignmentId !== towerId) {
    const note = document.createElement('span');
    note.className = 'tower-equipment-menu__note';
    note.textContent = `Equipped to ${getTowerSourceLabel(assignmentId)}`;
    button.append(note);
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    assignEquipmentToTower(equipment.id, towerId);
    closeTowerEquipmentMenu({ restoreFocus: true });
  });

  item.append(button);
  return item;
}

function populateTowerEquipmentMenu(towerId) {
  const slot = getEquipmentSlotRecord(towerId);
  if (!slot) {
    return;
  }
  slot.list.innerHTML = '';
  const fragment = document.createDocumentFragment();

  fragment.append(createEquipmentMenuButton(towerId, null));

  const craftedEquipment = getCraftedEquipment();
  if (!craftedEquipment.length) {
    const emptyNote = document.createElement('li');
    emptyNote.className = 'tower-equipment-menu__empty';
    emptyNote.textContent = 'No crafted equipment available.';
    fragment.append(emptyNote);
  } else {
    craftedEquipment.forEach((equipment) => {
      fragment.append(createEquipmentMenuButton(towerId, equipment));
    });
  }

  slot.list.append(fragment);
}

function handleEquipmentPointerDown(event) {
  const activeTowerId = towerTabState.equipmentUi.activeTowerId;
  if (!activeTowerId) {
    return;
  }
  const slot = getEquipmentSlotRecord(activeTowerId);
  if (!slot) {
    closeTowerEquipmentMenu();
    return;
  }
  if (slot.container.contains(event.target)) {
    return;
  }
  closeTowerEquipmentMenu();
}

function handleEquipmentKeyDown(event) {
  if (event.key === 'Escape' || event.key === 'Esc') {
    event.preventDefault();
    closeTowerEquipmentMenu({ restoreFocus: true });
  }
}

function bindEquipmentCloseHandlers() {
  if (towerTabState.equipmentUi.closeHandlersBound) {
    return;
  }
  document.addEventListener('pointerdown', handleEquipmentPointerDown, true);
  document.addEventListener('keydown', handleEquipmentKeyDown, true);
  towerTabState.equipmentUi.closeHandlersBound = true;
}

function unbindEquipmentCloseHandlers() {
  if (!towerTabState.equipmentUi.closeHandlersBound) {
    return;
  }
  document.removeEventListener('pointerdown', handleEquipmentPointerDown, true);
  document.removeEventListener('keydown', handleEquipmentKeyDown, true);
  towerTabState.equipmentUi.closeHandlersBound = false;
}

function openTowerEquipmentMenu(towerId) {
  const slot = getEquipmentSlotRecord(towerId);
  if (!slot) {
    return;
  }
  populateTowerEquipmentMenu(towerId);
  slot.menu.hidden = false;
  slot.menu.setAttribute('aria-hidden', 'false');
  slot.container.dataset.menuOpen = 'true';
  slot.button.setAttribute('aria-expanded', 'true');
  towerTabState.equipmentUi.activeTowerId = towerId;
  bindEquipmentCloseHandlers();

  const firstOption = slot.menu.querySelector('[data-equipment-option]');
  if (firstOption && typeof firstOption.focus === 'function') {
    firstOption.focus({ preventScroll: true });
  }
}

function closeTowerEquipmentMenu({ restoreFocus = false } = {}) {
  const activeTowerId = towerTabState.equipmentUi.activeTowerId;
  if (!activeTowerId) {
    return;
  }
  const slot = getEquipmentSlotRecord(activeTowerId);
  towerTabState.equipmentUi.activeTowerId = null;
  if (slot) {
    slot.menu.hidden = true;
    slot.menu.setAttribute('aria-hidden', 'true');
    slot.container.dataset.menuOpen = 'false';
    slot.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && typeof slot.button.focus === 'function') {
      slot.button.focus({ preventScroll: true });
    }
  }
  unbindEquipmentCloseHandlers();
}

function toggleTowerEquipmentMenu(towerId) {
  if (towerTabState.equipmentUi.activeTowerId === towerId) {
    closeTowerEquipmentMenu({ restoreFocus: true });
    return;
  }
  closeTowerEquipmentMenu();
  openTowerEquipmentMenu(towerId);
}

function handleEquipmentStateUpdate() {
  towerTabState.equipmentUi.slots.forEach((_, towerId) => {
    updateTowerEquipmentSlot(towerId);
  });
  const activeTowerId = towerTabState.equipmentUi.activeTowerId;
  if (activeTowerId) {
    populateTowerEquipmentMenu(activeTowerId);
  }
}

export function startTowerDrag(event, towerId, element) {
  if (!towerTabState.playfield || !towerTabState.playfield.isInteractiveLevelActive()) {
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx('error');
    }
    if (towerTabState.playfield?.messageEl) {
      towerTabState.playfield.messageEl.textContent = 'Enter the defense to lattice towers from your loadout.';
    }
    return;
  }

  cancelTowerDrag();

  const drag = towerTabState.loadoutDrag;
  drag.active = true;
  drag.pointerId = event.pointerId;
  drag.towerId = towerId;
  drag.element = element;
  element.dataset.state = 'dragging';

  towerTabState.playfield.setDraggingTower(towerId);

  try {
    element.setPointerCapture(event.pointerId);
  } catch (error) {
    // Ignore pointer capture errors.
  }

  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  document.addEventListener('pointermove', handleTowerDragMove);
  document.addEventListener('pointerup', handleTowerDragEnd);
  document.addEventListener('pointercancel', handleTowerDragEnd);

  handleTowerDragMove(event);
}

export function updateTowerSelectionButtons() {
  towerTabState.selectionButtons.forEach((button, towerId) => {
    const definition = getTowerDefinition(towerId);
    const selected = towerTabState.loadoutState.selected.includes(towerId);
    const label = definition ? definition.symbol : towerId;
    const unlocked = isTowerUnlocked(towerId);
    const placeable = isTowerPlaceable(towerId);
    button.dataset.locked = unlocked && placeable ? 'false' : 'true';
    if (!placeable) {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      if (definition) {
        button.textContent = `${definition.symbol || 'Static'} anchored`;
        button.title = `${definition.name || 'This lattice'} cannot be placed on the battlefield.`;
      } else {
        button.textContent = 'Unavailable';
        button.title = 'This lattice cannot be placed on the battlefield.';
      }
      return;
    }
    if (!unlocked) {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      if (definition) {
        button.textContent = `Locked ${label}`;
        button.title = `Discover ${definition.name} to unlock this lattice.`;
      } else {
        button.textContent = 'Locked';
      }
      return;
    }

    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.textContent = selected ? `Equipped ${label}` : `Equip ${label}`;
    if (towerTabState.playfield && towerTabState.playfield.isInteractiveLevelActive()) {
      button.disabled = true;
      button.title = 'Leave the active level to adjust your loadout.';
      return;
    }
    const atLimit = !selected && towerTabState.loadoutState.selected.length >= towerTabState.towerLoadoutLimit;
    button.disabled = atLimit;
    button.title = selected
      ? `${definition?.name || 'Tower'} is currently in your loadout.`
      : `Equip ${definition?.name || 'tower'} for this defense.`;
  });
}

export function toggleTowerSelection(towerId) {
  if (!towerTabState.towerDefinitionMap.has(towerId)) {
    return;
  }
  if (!isTowerPlaceable(towerId)) {
    return;
  }
  if (towerTabState.playfield && towerTabState.playfield.isInteractiveLevelActive()) {
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx('error');
    }
    if (towerTabState.loadoutElements.note) {
      towerTabState.loadoutElements.note.textContent = 'Leave the active level to adjust your loadout.';
    }
    updateTowerSelectionButtons();
    return;
  }
  if (!isTowerUnlocked(towerId)) {
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx('error');
    }
    const definition = getTowerDefinition(towerId);
    if (towerTabState.loadoutElements.note && definition) {
      towerTabState.loadoutElements.note.textContent = `Discover ${definition.name} before equipping it.`;
    }
    updateTowerSelectionButtons();
    return;
  }
  const selected = towerTabState.loadoutState.selected;
  const index = selected.indexOf(towerId);
  if (index >= 0) {
    selected.splice(index, 1);
  } else {
    if (selected.length >= towerTabState.towerLoadoutLimit) {
      if (towerTabState.audioManager) {
        towerTabState.audioManager.playSfx('error');
      }
      if (towerTabState.loadoutElements.note) {
        towerTabState.loadoutElements.note.textContent = 'Only four towers can be prepared at once.';
      }
      updateTowerSelectionButtons();
      return;
    }
    selected.push(towerId);
  }
  updateTowerSelectionButtons();
  syncLoadoutToPlayfield();
}
export function getTowerEquationBlueprint(towerId) {
  if (!towerId) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(TOWER_EQUATION_BLUEPRINTS, towerId)) {
    return TOWER_EQUATION_BLUEPRINTS[towerId];
  }
  if (fallbackTowerBlueprints.has(towerId)) {
    return fallbackTowerBlueprints.get(towerId);
  }
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return null;
  }

  const fallbackBlueprint = {
    mathSymbol: definition.symbol ? definition.symbol : towerId,
    baseEquation: `\\( ${definition.symbol || towerId} = X \\times Y \\)`,
    variables: [
      {
        key: 'damage',
        symbol: 'X',
        name: 'Damage',
        description: 'Base strike damage coursing through the lattice.',
        stat: 'damage',
        upgradable: false,
        format: (value) => formatWholeNumber(value),
      },
      {
        key: 'rate',
        symbol: 'Y',
        name: 'Attack Speed',
        description: 'Attacks per second released by the glyph.',
        stat: 'rate',
        upgradable: false,
        format: (value) => formatDecimal(value, 2),
      },
    ],
    computeResult(values) {
      const damage = Number.isFinite(values.damage) ? values.damage : 0;
      const rate = Number.isFinite(values.rate) ? values.rate : 0;
      return damage * rate;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = ${formatVariable('damage')} \\times ${formatVariable('rate')} \\)`;
    },
  };

  fallbackTowerBlueprints.set(towerId, fallbackBlueprint);
  return fallbackBlueprint;
}

function getBlueprintVariable(blueprint, key) {
  if (!blueprint || !key) {
    return null;
  }
  return (blueprint.variables || []).find((variable) => variable.key === key) || null;
}

export function ensureTowerUpgradeState(towerId, blueprint = null) {
  if (!towerId) {
    return { variables: {} };
  }
  const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
  let state = towerTabState.towerUpgradeState.get(towerId);
  if (!state) {
    state = { variables: {} };
    towerTabState.towerUpgradeState.set(towerId, state);
  }
  if (!state.variables) {
    state.variables = {};
  }
  const variables = effectiveBlueprint?.variables || [];
  variables.forEach((variable) => {
    if (!state.variables[variable.key]) {
      state.variables[variable.key] = { level: 0 };
    }
  });
  return state;
}

/**
 * Get a serializable snapshot of all tower upgrade states for persistence.
 */
export function getTowerUpgradeStateSnapshot() {
  const snapshot = {};
  towerTabState.towerUpgradeState.forEach((state, towerId) => {
    if (!state || !state.variables) {
      return;
    }
    const variables = {};
    Object.keys(state.variables).forEach((key) => {
      const variableState = state.variables[key];
      if (variableState && Number.isFinite(variableState.level)) {
        variables[key] = { level: Math.max(0, variableState.level) };
      }
    });
    if (Object.keys(variables).length > 0) {
      snapshot[towerId] = { variables };
    }
  });
  return snapshot;
}

/**
 * Apply a saved tower upgrade state snapshot, restoring glyph allocations.
 */
export function applyTowerUpgradeStateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  Object.keys(snapshot).forEach((towerId) => {
    const savedState = snapshot[towerId];
    if (!savedState || !savedState.variables || typeof savedState.variables !== 'object') {
      return;
    }
    const blueprint = getTowerEquationBlueprint(towerId);
    const state = ensureTowerUpgradeState(towerId, blueprint);
    Object.keys(savedState.variables).forEach((variableKey) => {
      const savedVariable = savedState.variables[variableKey];
      if (savedVariable && Number.isFinite(savedVariable.level) && savedVariable.level > 0) {
        if (!state.variables[variableKey]) {
          state.variables[variableKey] = { level: 0 };
        }
        state.variables[variableKey].level = Math.max(0, savedVariable.level);
      }
    });
  });
}

/**
 * Computes the total number of glyphs invested across all tower variables.
 */
export function calculateInvestedGlyphs() {
  let total = 0;
  towerTabState.towerUpgradeState.forEach((state, towerId) => {
    if (!state || !state.variables) {
      return;
    }
    const blueprint = getTowerEquationBlueprint(towerId);
    Object.entries(state.variables).forEach(([variableKey, variableState]) => {
      const levels = Number.isFinite(variableState?.level) ? Math.max(0, variableState.level) : 0;
      if (levels <= 0) {
        return;
      }
      const variable = getBlueprintVariable(blueprint, variableKey);
      for (let levelIndex = 0; levelIndex < levels; levelIndex += 1) {
        const cost = calculateTowerVariableUpgradeCost(variable, levelIndex);
        total += Math.max(1, cost);
      }
    });
  });
  return total;
}

/**
 * Clears all stored tower upgrade progress and resets available glyph currency.
 */
export function clearTowerUpgradeState() {
  towerTabState.towerUpgradeState.clear();
  towerTabState.glyphCurrency = 0;
  updateTowerUpgradeGlyphDisplay();
}

function normalizeVariableKey(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function getUniversalVariableMetadata(variable) {
  if (!variable) {
    return null;
  }
  const symbolKey = normalizeVariableKey(variable.symbol);
  const keyKey = normalizeVariableKey(variable.key);
  return (
    UNIVERSAL_VARIABLE_LIBRARY.get(symbolKey) || UNIVERSAL_VARIABLE_LIBRARY.get(keyKey) || null
  );
}

function getDiscoveredVariableId(variable) {
  if (!variable) {
    return '';
  }
  const symbol =
    typeof variable.symbol === 'string' && variable.symbol.trim().length > 0
      ? variable.symbol.trim()
      : typeof variable.key === 'string' && variable.key.trim().length > 0
      ? variable.key.trim().toUpperCase()
      : '';
  return normalizeVariableKey(symbol) || normalizeVariableKey(variable.key);
}

/**
 * Compose a tower label that preserves lowercase glyphs without duplication.
 */
function composeTowerDisplayLabel(definition, fallback = '') {
  if (!definition || typeof definition !== 'object') {
    return fallback;
  }
  const symbol = typeof definition.symbol === 'string' ? definition.symbol.trim() : '';
  const name = typeof definition.name === 'string' ? definition.name.trim() : '';
  if (symbol && name) {
    const normalizedSymbol = symbol.normalize('NFKC');
    const normalizedName = name.normalize('NFKC');
    if (normalizedName.startsWith(normalizedSymbol)) {
      return name;
    }
    return `${symbol} ${name}`;
  }
  if (name) {
    return name;
  }
  if (symbol) {
    return symbol;
  }
  return fallback;
}

function getTowerSourceLabel(towerId) {
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return towerId;
  }
  return composeTowerDisplayLabel(definition, towerId);
}

function notifyDiscoveredVariablesChanged() {
  const snapshot = getDiscoveredVariables();
  towerTabState.discoveredVariableListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Failed to notify discovered variable listener', error);
    }
  });
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('tower-variables-changed', {
        detail: { variables: snapshot },
      }),
    );
  }
}

function discoverTowerVariables(towerId, blueprint = null) {
  if (!towerId) {
    return;
  }
  const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
  if (!effectiveBlueprint) {
    return;
  }
  const variables = effectiveBlueprint.variables || [];
  if (!variables.length) {
    return;
  }

  const sourceLabel = getTowerSourceLabel(towerId);
  let changed = false;

  variables.forEach((variable) => {
    if (!variable) {
      return;
    }
    const id = getDiscoveredVariableId(variable);
    if (!id) {
      return;
    }

    const universal = getUniversalVariableMetadata(variable);
    const symbol = universal?.symbol
      ? universal.symbol
      : typeof variable.symbol === 'string' && variable.symbol.trim().length
      ? variable.symbol.trim()
      : typeof variable.key === 'string' && variable.key.trim().length
      ? variable.key.trim().toUpperCase()
      : id.toUpperCase();
    const name = universal?.name || variable.name || `Variable ${symbol}`;
    const description = universal?.description || variable.description || '';

    let entry = towerTabState.discoveredVariables.get(id);
    if (!entry) {
      entry = {
        id,
        symbol,
        name,
        description,
        sources: new Set(),
      };
      towerTabState.discoveredVariables.set(id, entry);
      changed = true;
    } else {
      if (universal && (entry.symbol !== universal.symbol || entry.name !== universal.name)) {
        entry.symbol = universal.symbol;
        entry.name = universal.name;
        entry.description = universal.description;
        changed = true;
      } else if (!entry.description && description) {
        entry.description = description;
        changed = true;
      }
    }

    if (sourceLabel && !entry.sources.has(sourceLabel)) {
      entry.sources.add(sourceLabel);
      changed = true;
    }
  });

  if (changed) {
    notifyDiscoveredVariablesChanged();
  }
}

export function initializeDiscoveredVariablesFromUnlocks(unlockedTowers = []) {
  towerTabState.discoveredVariables = new Map();
  const towerList = Array.isArray(unlockedTowers)
    ? unlockedTowers
    : Array.from(unlockedTowers || []);
  towerList.forEach((towerId) => {
    discoverTowerVariables(towerId);
  });
  notifyDiscoveredVariablesChanged();
}

export function addDiscoveredVariablesListener(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  towerTabState.discoveredVariableListeners.add(listener);
  try {
    listener(getDiscoveredVariables());
  } catch (error) {
    console.warn('Failed to invoke discovered variable listener', error);
  }
  return () => {
    towerTabState.discoveredVariableListeners.delete(listener);
  };
}

export function getDiscoveredVariables() {
  const entries = Array.from(towerTabState.discoveredVariables.values()).map((entry) => ({
    id: entry.id,
    symbol: entry.symbol,
    name: entry.name,
    description: entry.description,
    sources: Array.from(entry.sources).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  }));

  return entries.sort((a, b) =>
    a.symbol.localeCompare(b.symbol, undefined, { sensitivity: 'base' }),
  );
}

export function calculateTowerVariableUpgradeCost(variable, level) {
  if (!variable) {
    return 1;
  }
  if (typeof variable.cost === 'function') {
    const value = variable.cost(level);
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.floor(value));
    }
  } else if (Number.isFinite(variable.cost)) {
    return Math.max(1, Math.floor(variable.cost));
  }
  return Math.max(1, 1 + level);
}

export function computeTowerVariableValue(towerId, variableKey, blueprint = null, visited = new Set()) {
  if (!towerId || !variableKey) {
    return 0;
  }
  const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
  const variable = getBlueprintVariable(effectiveBlueprint, variableKey);
  if (!variable) {
    return 0;
  }

  if (variable.reference) {
    const referencedId = variable.reference;
    const referencedValue = calculateTowerEquationResult(referencedId, visited);
    if (!Number.isFinite(referencedValue)) {
      return 0;
    }
    if (typeof variable.transform === 'function') {
      return variable.transform(referencedValue);
    }
    if (Number.isFinite(variable.exponent)) {
      return referencedValue ** variable.exponent;
    }
    return referencedValue;
  }

  const definition = getTowerDefinition(towerId);

  if (typeof variable.computeValue === 'function') {
    try {
      const computedValue = variable.computeValue({
        definition,
        towerId,
        blueprint: effectiveBlueprint,
        dynamicContext: towerTabState.dynamicContext,
      });
      if (Number.isFinite(computedValue)) {
        return computedValue;
      }
    } catch (error) {
      console.warn('Failed to evaluate custom tower variable computeValue', error);
    }
  }

  let baseValue = 0;
  if (typeof variable.getBase === 'function') {
    baseValue = variable.getBase({ definition, towerId });
  } else if (variable.stat && Number.isFinite(definition?.[variable.stat])) {
    baseValue = definition[variable.stat];
  } else if (Number.isFinite(variable.baseValue)) {
    baseValue = variable.baseValue;
  }

  if (!Number.isFinite(baseValue)) {
    baseValue = 0;
  }

  const state = ensureTowerUpgradeState(towerId, effectiveBlueprint);
  const level = state.variables?.[variableKey]?.level || 0;
  if (variable.upgradable === false) {
    return baseValue;
  }

  const step =
    typeof variable.getStep === 'function'
      ? variable.getStep(level, { definition, towerId })
      : Number.isFinite(variable.step)
      ? variable.step
      : 0;

  return baseValue + level * step;
}

export function calculateTowerEquationResult(towerId, visited = new Set()) {
  if (!towerId) {
    return 0;
  }
  if (towerTabState.towerEquationCache.has(towerId)) {
    return towerTabState.towerEquationCache.get(towerId);
  }
  if (visited.has(towerId)) {
    return 0;
  }
  visited.add(towerId);

  const blueprint = getTowerEquationBlueprint(towerId);
  if (!blueprint) {
    visited.delete(towerId);
    return 0;
  }

  ensureTowerUpgradeState(towerId, blueprint);
  const values = {};
  (blueprint.variables || []).forEach((variable) => {
    values[variable.key] = computeTowerVariableValue(towerId, variable.key, blueprint, visited);
  });

  let result = 0;
  if (typeof blueprint.computeResult === 'function') {
    result = blueprint.computeResult(values, { definition: getTowerDefinition(towerId) });
  } else {
    result = Object.values(values).reduce((total, value) => {
      const contribution = Number.isFinite(value) ? value : 0;
      return total === 0 ? contribution : total * contribution;
    }, 0);
  }

  const safeResult = Number.isFinite(result) ? result : 0;
  towerTabState.towerEquationCache.set(towerId, safeResult);
  visited.delete(towerId);
  return safeResult;
}

export function invalidateTowerEquationCache() {
  towerTabState.towerEquationCache.clear();
}

function formatTowerVariableValue(variable, value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (variable && typeof variable.format === 'function') {
    try {
      const formatted = variable.format(value);
      if (typeof formatted === 'string') {
        return formatted;
      }
    } catch (error) {
      // Ignore formatting errors and fall back to default formatting.
    }
  }
  return Number.isInteger(value) ? formatWholeNumber(value) : formatDecimal(value, 2);
}

const ALEPH_SUBSCRIPT_DIGITS = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
};

function toAlephSubscript(value) {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${normalized}`
    .split('')
    .map((digit) => ALEPH_SUBSCRIPT_DIGITS[digit] || digit)
    .join('');
}

function formatAlephGlyphLabelFromString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('ℵ')) {
    return trimmed;
  }
  const match = trimmed.match(/aleph\s*(\d+)/i);
  if (match) {
    const index = Number.parseInt(match[1], 10);
    if (Number.isFinite(index)) {
      return `ℵ${toAlephSubscript(index)}`;
    }
  }
  return '';
}

function getVariableGlyphLabel(variable) {
  if (!variable) {
    return 'ℵ';
  }

  if (typeof variable.glyphLabel === 'string' && variable.glyphLabel.trim()) {
    return variable.glyphLabel.trim();
  }

  const candidates = [variable.symbol, variable.equationSymbol, variable.name, variable.key];
  for (const candidate of candidates) {
    const label = formatAlephGlyphLabelFromString(candidate);
    if (label) {
      return label;
    }
  }

  return 'ℵ';
}

function buildVariableGlyphControls(variable, towerId, level, options = {}) {
  const { asAttachment = false } = options;
  const controls = document.createElement('div');
  controls.className = 'tower-upgrade-variable-controls';
  if (asAttachment) {
    controls.classList.add('tower-upgrade-variable-controls--attachment');
  }

  const glyphControl = document.createElement('div');
  glyphControl.className = 'tower-upgrade-variable-glyph-control';
  if (asAttachment) {
    glyphControl.classList.add('tower-upgrade-variable-glyph-control--attachment');
  }

  const cost = calculateTowerVariableUpgradeCost(variable, level);
  const maxLevel =
    Number.isFinite(variable.maxLevel) && variable.maxLevel >= 0 ? Math.floor(variable.maxLevel) : null;
  const reachedMax = maxLevel !== null && level >= maxLevel;

  const decrement = document.createElement('button');
  decrement.type = 'button';
  decrement.className = 'tower-upgrade-variable-glyph-button tower-upgrade-variable-glyph-button--decrease';
  decrement.textContent = '−';
  decrement.disabled = level <= 0;
  decrement.setAttribute('aria-label', `Withdraw glyphs from ${variable.symbol || variable.key}`);
  decrement.addEventListener('click', () => handleTowerVariableDowngrade(towerId, variable.key));
  glyphControl.append(decrement);

  const glyphCount = document.createElement('span');
  glyphCount.className = 'tower-upgrade-variable-glyph-count';
  glyphCount.textContent = `${level} ${getVariableGlyphLabel(variable)}`;
  glyphControl.append(glyphCount);

  const increment = document.createElement('button');
  increment.type = 'button';
  increment.className = 'tower-upgrade-variable-glyph-button tower-upgrade-variable-glyph-button--increase';
  increment.dataset.upgradeVariable = variable.key;
  increment.textContent = '+';
  increment.disabled = towerTabState.glyphCurrency < cost || reachedMax;
  increment.setAttribute('aria-label', `Invest glyph into ${variable.symbol || variable.key}`);
  increment.addEventListener('click', () => handleTowerVariableUpgrade(towerId, variable.key));
  glyphControl.append(increment);

  controls.append(glyphControl);

  const costNote = document.createElement('span');
  costNote.className = 'tower-upgrade-variable-cost';
  costNote.textContent = cost === 1 ? 'COST: 1 GLYPH' : `COST: ${cost} GLYPHS`;
  controls.append(costNote);

  if (maxLevel !== null) {
    const maxNote = document.createElement('span');
    maxNote.className = 'tower-upgrade-variable-max';
    maxNote.textContent = `MAX: ${formatWholeNumber(maxLevel)}`;
    controls.append(maxNote);
  }

  return controls;
}

function resolveTowerVariableSubEquations(variable, context = {}) {
  if (!variable) {
    return [];
  }

  const lines = [];
  const collect = (entry) => {
    if (!entry) {
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((value) => collect(value));
      return;
    }
    if (typeof entry === 'function') {
      try {
        collect(entry(context));
      } catch (error) {
        console.warn('Failed to evaluate tower variable sub-equation', error);
      }
      return;
    }
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed) {
        lines.push({ text: trimmed, variant: 'expression' });
      }
      return;
    }
    if (entry && typeof entry === 'object') {
      const glyphEquation = entry.glyphEquation === true || entry.category === 'glyph';
      if (typeof entry.text === 'string' && entry.text.trim()) {
        lines.push({
          text: entry.text.trim(),
          variant: entry.variant === 'values' ? 'values' : 'expression',
          glyphEquation,
        });
      }
      if (typeof entry.expression === 'string' && entry.expression.trim()) {
        lines.push({ text: entry.expression.trim(), variant: 'expression', glyphEquation });
      }
      if (typeof entry.values === 'string' && entry.values.trim()) {
        lines.push({ text: entry.values.trim(), variant: 'values', glyphEquation });
      }
    }
  };

  if (typeof variable.getSubEquations === 'function') {
    collect(variable.getSubEquations(context));
  }
  collect(variable.subEquations);
  collect(variable.subEquation);
  if (typeof variable.getSubEquation === 'function') {
    collect(variable.getSubEquation(context));
  }

  return lines;
}

function formatTowerEquationResultValue(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value) >= 1000) {
    return formatGameNumber(value);
  }
  return formatDecimal(value, 2);
}

function extractTowerCardEquation(card) {
  if (!(card instanceof HTMLElement)) {
    return '';
  }
  const line = card.querySelector('.formula-block .formula-line');
  if (!line) {
    return '';
  }
  const text = line.textContent || '';
  return text.trim();
}

export function bindTowerCardUpgradeInteractions() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    if (card.dataset.upgradeBound === 'true') {
      return;
    }
    card.dataset.upgradeBound = 'true';

    card.addEventListener('click', (event) => {
      if (event.target.closest('button')) {
        return;
      }
      const towerId = card.dataset.towerId;
      if (!towerId || card.dataset.locked === 'true') {
        return;
      }
      openTowerUpgradeOverlay(towerId, { sourceCard: card, trigger: card });
    });

    card.addEventListener('keydown', (event) => {
      if (event.target !== card) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const towerId = card.dataset.towerId;
        if (!towerId || card.dataset.locked === 'true') {
          return;
        }
        openTowerUpgradeOverlay(towerId, { sourceCard: card, trigger: card });
      }
    });
  });
}
export function updateTowerCardVisibility() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const towerId = card.dataset.towerId;
    if (!towerId) {
      return;
    }
    const unlocked = isTowerUnlocked(towerId);
    card.dataset.locked = unlocked ? 'false' : 'true';
    card.setAttribute('tabindex', unlocked ? '0' : '-1');
    card.hidden = !unlocked;
    if (unlocked) {
      card.style.removeProperty('display');
    } else {
      card.style.display = 'none';
    }
    card.setAttribute('aria-hidden', unlocked ? 'false' : 'true');

    const slot = getEquipmentSlotRecord(towerId);
    if (slot) {
      slot.button.disabled = !unlocked;
      slot.container.dataset.locked = unlocked ? 'false' : 'true';
    }
  });
}

export function injectTowerCardPreviews() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    if (card.querySelector('.tower-preview')) {
      return;
    }
    const towerId = card.dataset.towerId;
    if (!towerId) {
      return;
    }
    const definition = getTowerDefinition(towerId);
    const iconPath = definition?.icon;
    if (!iconPath) {
      return;
    }
    const preview = document.createElement('figure');
    preview.className = 'tower-preview';
    const image = document.createElement('img');
    image.src = iconPath;
    const labelBase = composeTowerDisplayLabel(definition, towerId);
    image.alt = `${labelBase} placement preview`;
    image.loading = 'lazy';
    image.decoding = 'async';
    preview.append(image);
    const header = card.querySelector('.tower-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(preview, header.nextSibling);
    } else {
      card.insertBefore(preview, card.firstChild);
    }
  });
}

export function simplifyTowerCards() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }

    const formulaBlock = card.querySelector('.formula-block');
    if (formulaBlock instanceof HTMLElement) {
      const primaryEquation = formulaBlock.querySelector('.formula-line');
      const allowedNodes = new Set(primaryEquation ? [primaryEquation] : []);
      Array.from(formulaBlock.children).forEach((child) => {
        if (!allowedNodes.has(child)) {
          child.remove();
        }
      });
    }

    card.querySelectorAll('.formula-definition, .formula-line.result, .upgrade-list').forEach((element) => {
      element.remove();
    });
  });
}

export function synchronizeTowerCardMasterEquations() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const towerId = card.dataset.towerId;
    if (!towerId) {
      return;
    }
    const formulaLine = card.querySelector('.formula-block .formula-line');
    if (!formulaLine) {
      return;
    }
    const blueprint = getTowerEquationBlueprint(towerId);
    const definition = getTowerDefinition(towerId);
    if (!blueprint || !definition) {
      return;
    }

    const latexEquation = generateMasterEquationText({
      blueprint,
      definition,
      towerId,
      format: 'latex',
      fallback: typeof blueprint.baseEquation === 'string' ? blueprint.baseEquation : '',
    });

    if (typeof latexEquation !== 'string') {
      return;
    }

    const trimmedEquation = latexEquation.trim();
    if (!trimmedEquation) {
      return;
    }

    const current = (formulaLine.textContent || '').trim();
    if (current === trimmedEquation) {
      return;
    }

    formulaLine.textContent = trimmedEquation;
    renderMathElement(formulaLine);
  });
}

export function annotateTowerCardsWithCost() {
  const cards = document.querySelectorAll(TOWER_CARD_SELECTOR);
  cards.forEach((card) => {
    const towerId = card.dataset.towerId;
    if (!towerId) {
      return;
    }
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return;
    }

    const formattedCost = `${formatGameNumber(definition.baseCost)} ${towerTabState.theroSymbol}`;
    let costEl = card.querySelector('.tower-cost');
    if (!costEl) {
      costEl = document.createElement('p');
      costEl.className = 'tower-cost';
      const label = document.createElement('strong');
      label.textContent = 'Base Cost';
      const value = document.createElement('span');
      value.className = 'tower-cost-value';
      value.textContent = formattedCost;
      costEl.append(label, document.createTextNode(' '), value);

      const footer = card.querySelector('.card-footer');
      if (footer) {
        card.insertBefore(costEl, footer);
      } else {
        card.appendChild(costEl);
      }
    } else {
      const value = costEl.querySelector('.tower-cost-value');
      if (value) {
        value.textContent = formattedCost;
      } else {
        const label = document.createElement('strong');
        label.textContent = 'Base Cost';
        const valueSpan = document.createElement('span');
        valueSpan.className = 'tower-cost-value';
        valueSpan.textContent = formattedCost;
        costEl.innerHTML = '';
        costEl.append(label, document.createTextNode(' '), valueSpan);
      }
    }
  });
}

export function initializeTowerSelection() {
  const buttons = document.querySelectorAll('[data-tower-toggle]');
  buttons.forEach((button) => {
    const towerId = button.dataset.towerToggle;
    if (!towerId) {
      return;
    }
    towerTabState.selectionButtons.set(towerId, button);
    const definition = getTowerDefinition(towerId);
    if (definition) {
      button.textContent = `Equip ${definition.symbol}`;
    }
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => toggleTowerSelection(towerId));
  });
  updateTowerSelectionButtons();
}

export function initializeTowerEquipmentInterface() {
  ensureTowerEquipmentSlots();
  handleEquipmentStateUpdate();
  if (!towerTabState.equipmentUi.unsubscribe) {
    towerTabState.equipmentUi.unsubscribe = addEquipmentStateListener(() => {
      handleEquipmentStateUpdate();
    });
  }
  if (!towerTabState.equipmentUi.documentListenerBound && typeof document !== 'undefined') {
    document.addEventListener('tower-unlocked', () => {
      ensureTowerEquipmentSlots();
      handleEquipmentStateUpdate();
    });
    towerTabState.equipmentUi.documentListenerBound = true;
  }
}

export function syncLoadoutToPlayfield() {
  pruneLockedTowersFromLoadout();
  const placeableSelection = towerTabState.loadoutState.selected.filter((towerId) => isTowerPlaceable(towerId));
  if (towerTabState.playfield) {
    towerTabState.playfield.setAvailableTowers(placeableSelection);
  }
  renderTowerLoadout();
  updateTowerSelectionButtons();
}

// Initialize blueprint context with helper functions so tower blueprints can access them
// This must be done after all the functions are defined
initializeBlueprintContext({
  deriveGlyphRankFromLevel,
  getTowerEquationBlueprint,
  ensureTowerUpgradeState,
  calculateTowerEquationResult,
  getDynamicConnectionCount,
  getTowerDefinition,
  computeTowerVariableValue,
});
