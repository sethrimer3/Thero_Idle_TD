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
import { initializeBlueprintContext } from './towerEquations/blueprintContext.js'; // Initialize context for tower blueprints.
import { generateMasterEquationText } from './towerEquations/masterEquationUtils.js';
import { createTowerEquationTooltipSystem } from './towerEquationTooltip.js';
import { createTowerUpgradeOverlayController } from './towerUpgradeOverlayController.js';
import { createTowerBlueprintPresenter } from './towerBlueprintPresenter.js';
import { createTowerVariableDiscoveryManager } from './towerVariableDiscovery.js';
import { createTowerLoadoutController } from './towerLoadoutController.js';
import { createTowerEquipmentBindings } from './towerEquipmentBindings.js';
import { getTowerVisualConfig } from './colorSchemeUtils.js';

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
  towerOrderIndex: new Map(),
  towerPreviousTierMap: new Map(),
  towerLoadoutLimit: 4,
  loadoutState: { selected: ['alpha'] },
  unlockState: { unlocked: new Set(['alpha']) },
  mergeProgress: { mergingLogicUnlocked: false },
  mergingLogicElements: { card: null },
  loadoutElements: { shell: null, container: null, grid: null, note: null, toggle: null },
  // Track the contextual replacement prompt so full-loadout equips can swap slots gracefully.
  loadoutReplacementUi: { container: null, optionsRow: null, anchorButton: null, pendingTowerId: null, outsideHandler: null },
  selectionButtons: new Map(),
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

// Default palette values ensure tower icons remain legible before the active scheme resolves.
const DEFAULT_TOWER_ICON_COLORS = Object.freeze({
  primary: 'rgba(255, 228, 120, 0.85)',
  secondary: 'rgba(8, 9, 14, 0.9)',
  symbol: 'rgba(255, 228, 120, 0.85)',
});

// Cache for loaded SVG content to avoid redundant fetches.
const svgContentCache = new Map();

// Resolve palette-aware colors for a tower icon so Codex palette swaps recolor every glyph chip consistently.
function resolveTowerIconPalette(tower) {
  const visuals = getTowerVisualConfig(tower) || {};
  const primary = visuals.outerStroke || DEFAULT_TOWER_ICON_COLORS.primary;
  const secondary = visuals.innerFill || DEFAULT_TOWER_ICON_COLORS.secondary;
  const symbol = visuals.symbolFill || primary;
  return { primary, secondary, symbol };
}

// Parse color string to extract RGB values for gradient application.
function parseColorToRgb(colorString) {
  if (!colorString) {
    return null;
  }
  
  // Handle rgba format
  const rgbaMatch = colorString.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  
  // Handle hsl format
  const hslMatch = colorString.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1;
    
    // Convert HSL to RGB
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a,
    };
  }
  
  return null;
}

// Convert RGB object to hex color for SVG attributes.
function rgbToHex(rgb) {
  if (!rgb) {
    return '#ffffff';
  }
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

// Apply palette colors to an inline SVG element by modifying its internal elements.
function applySvgPaletteColors(svgElement, palette) {
  if (!(svgElement instanceof SVGElement) || !palette) {
    return;
  }

  const primaryRgb = parseColorToRgb(palette.primary);
  const secondaryRgb = parseColorToRgb(palette.secondary);
  const symbolRgb = parseColorToRgb(palette.symbol);

  const primaryHex = rgbToHex(primaryRgb);
  const secondaryHex = rgbToHex(secondaryRgb);
  const symbolHex = rgbToHex(symbolRgb);

  // Update gradient stops if they exist
  const gradientStops = svgElement.querySelectorAll('linearGradient stop, radialGradient stop');
  gradientStops.forEach((stop) => {
    const offset = parseFloat(stop.getAttribute('offset') || 0);
    // Apply gradient from secondary (dark) to primary (light)
    if (offset < 0.5) {
      stop.setAttribute('stop-color', secondaryHex);
      if (secondaryRgb?.a !== undefined && secondaryRgb.a < 1) {
        stop.setAttribute('stop-opacity', String(secondaryRgb.a));
      }
    } else {
      stop.setAttribute('stop-color', primaryHex);
      if (primaryRgb?.a !== undefined && primaryRgb.a < 1) {
        stop.setAttribute('stop-opacity', String(primaryRgb.a));
      }
    }
  });

  // Update circles (background and rings)
  const circles = svgElement.querySelectorAll('circle');
  circles.forEach((circle, index) => {
    if (circle.hasAttribute('fill') && !circle.getAttribute('fill').startsWith('url(')) {
      // Outer circles get secondary color
      if (index === 0) {
        circle.setAttribute('fill', secondaryHex);
      } else {
        // Inner circles get primary color
        circle.setAttribute('fill', primaryHex);
      }
    }
    if (circle.hasAttribute('stroke')) {
      circle.setAttribute('stroke', primaryHex);
    }
  });

  // Update text (tower symbol) with symbol color
  const textElements = svgElement.querySelectorAll('text');
  textElements.forEach((text) => {
    text.setAttribute('fill', symbolHex);
  });

  // Update rectangles (background)
  const rects = svgElement.querySelectorAll('rect');
  rects.forEach((rect) => {
    if (rect.hasAttribute('fill')) {
      rect.setAttribute('fill', secondaryHex);
    }
  });
}

// Load SVG content and apply palette colors.
async function loadAndColorSvg(iconUrl, palette) {
  if (!iconUrl) {
    return null;
  }

  try {
    // Check cache first
    let svgText = svgContentCache.get(iconUrl);
    
    if (!svgText) {
      const response = await fetch(iconUrl);
      if (!response.ok) {
        console.warn(`Failed to load tower icon: ${iconUrl}`);
        return null;
      }
      svgText = await response.text();
      svgContentCache.set(iconUrl, svgText);
    }

    // Parse SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    if (!svgElement) {
      console.warn(`Invalid SVG content: ${iconUrl}`);
      return null;
    }

    // Apply palette colors
    applySvgPaletteColors(svgElement, palette);
    
    return svgElement;
  } catch (error) {
    console.warn(`Error loading tower icon SVG: ${iconUrl}`, error);
    return null;
  }
}

// Apply the active palette colors to a tower icon element.
async function applyPaletteToTowerIconElement(element, tower) {
  if (!(element instanceof HTMLElement) || !tower) {
    return;
  }
  
  const palette = resolveTowerIconPalette(tower);
  element.dataset.towerId = tower.id || element.dataset.towerId || '';

  if (tower.icon) {
    // Load and inject colored SVG
    const svgElement = await loadAndColorSvg(tower.icon, palette);
    if (svgElement) {
      // Clear existing content
      element.innerHTML = '';
      // Make SVG fill the container
      svgElement.setAttribute('width', '100%');
      svgElement.setAttribute('height', '100%');
      element.appendChild(svgElement);
    }
  }
}

// Build a palette-aware tower icon with accessible labeling.
function createTowerIconElement(tower, { className = '', alt = '' } = {}) {
  if (!tower?.icon) {
    return null;
  }
  const icon = document.createElement('span');
  icon.className = ['tower-icon', className].filter(Boolean).join(' ');
  icon.dataset.towerId = tower.id || '';
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', alt || tower.name || tower.id || 'Tower icon');

  // Apply palette asynchronously (will populate the icon)
  applyPaletteToTowerIconElement(icon, tower);
  
  return icon;
}

// Reapply palette colors to all rendered tower icons so Codex palette swaps cascade through the Towers tab.
export function refreshTowerIconPalettes() {
  if (typeof document === 'undefined') {
    return;
  }
  const icons = document.querySelectorAll('.tower-icon[data-tower-id]');
  icons.forEach((icon) => {
    const towerId = icon.dataset.towerId;
    const definition = getTowerDefinition(towerId);
    if (definition) {
      applyPaletteToTowerIconElement(icon, definition);
    }
  });
}

// Instantiate a blueprint presenter so glyph math and caching live outside the UI wiring.
const {
  getTowerEquationBlueprint,
  ensureTowerUpgradeState,
  getTowerUpgradeStateSnapshot,
  applyTowerUpgradeStateSnapshot,
  calculateInvestedGlyphs,
  calculateTowerVariableUpgradeCost,
  computeTowerVariableValue,
  calculateTowerEquationResult,
  invalidateTowerEquationCache,
  clearTowerUpgradeState,
} = createTowerBlueprintPresenter({
  getTowerDefinition,
  getDynamicContext: () => towerTabState.dynamicContext,
  formatters: { formatWholeNumber, formatDecimal },
});

const {
  getUniversalVariableMetadata,
  discoverTowerVariables,
  getDiscoveredVariables,
  addDiscoveredVariablesListener,
  initializeDiscoveredVariablesFromUnlocks,
} = createTowerVariableDiscoveryManager({
  universalVariableLibrary: UNIVERSAL_VARIABLE_LIBRARY,
  discoveredVariables: towerTabState.discoveredVariables,
  discoveredVariableListeners: towerTabState.discoveredVariableListeners,
  getTowerDefinition,
  getOrderedTowerDefinitions: () =>
    towerTabState.towerDefinitions.length
      ? towerTabState.towerDefinitions
      : Array.from(towerTabState.towerDefinitionMap.values()),
  getTowerOrderIndex: () => towerTabState.towerOrderIndex,
  getTowerEquationBlueprint,
  getDefaultUnlockCollection: () => towerTabState.unlockState?.unlocked,
});

export {
  getTowerEquationBlueprint,
  ensureTowerUpgradeState,
  getTowerUpgradeStateSnapshot,
  applyTowerUpgradeStateSnapshot,
  calculateInvestedGlyphs,
  calculateTowerVariableUpgradeCost,
  computeTowerVariableValue,
  calculateTowerEquationResult,
  invalidateTowerEquationCache,
  clearTowerUpgradeState,
};

export {
  getDiscoveredVariables,
  addDiscoveredVariablesListener,
  initializeDiscoveredVariablesFromUnlocks,
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
  towerTabState.towerOrderIndex = new Map(
    towerTabState.towerDefinitions.map((tower, index) => [tower.id, index]),
  );
  towerTabState.towerPreviousTierMap = new Map();
  towerTabState.towerDefinitions.forEach((tower) => {
    if (tower?.nextTierId && !towerTabState.towerPreviousTierMap.has(tower.nextTierId)) {
      towerTabState.towerPreviousTierMap.set(tower.nextTierId, tower.id);
    }
  });
}

export function getTowerDefinitions() {
  return towerTabState.towerDefinitions;
}

/**
 * Ensure the loadout selection array matches the active slot limit so placeholders can render consistently.
 */
function normalizeLoadoutSlots() {
  const loadoutState = towerTabState.loadoutState;
  if (!Array.isArray(loadoutState.selected)) {
    loadoutState.selected = [];
  }
  const limit = towerTabState.towerLoadoutLimit;
  if (loadoutState.selected.length > limit) {
    loadoutState.selected.length = limit;
  }
  while (loadoutState.selected.length < limit) {
    loadoutState.selected.push(null);
  }
  return loadoutState.selected;
}

/**
 * Count the number of equipped towers ignoring placeholder slots.
 */
function getEquippedLoadoutCount() {
  return normalizeLoadoutSlots().filter((towerId) => typeof towerId === 'string').length;
}

/**
 * Identify the next open slot index so replacement prompts only appear when necessary.
 */
function getNextEmptyLoadoutSlot() {
  return normalizeLoadoutSlots().findIndex((towerId) => !towerId);
}

/**
 * Assign a tower to a specific slot while clearing any duplicate entries elsewhere in the array.
 */
function assignTowerToSlot(slotIndex, towerId) {
  const slots = normalizeLoadoutSlots();
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) {
    return slots;
  }
  const duplicateIndex = slots.findIndex((id, index) => id === towerId && index !== slotIndex);
  if (duplicateIndex !== -1) {
    slots[duplicateIndex] = null;
  }
  slots[slotIndex] = towerId;
  return slots;
}

export function setTowerLoadoutLimit(limit) {
  if (Number.isFinite(limit) && limit > 0) {
    towerTabState.towerLoadoutLimit = Math.max(1, Math.floor(limit));
    normalizeLoadoutSlots();
  }
}

export function getTowerLoadoutState() {
  return towerTabState.loadoutState;
}

/**
 * Surface a normalized view of the loadout slots for UI consumers like the playfield tray.
 */
export function getLoadoutSlots() {
  return normalizeLoadoutSlots();
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
  const prestige = entry.prestige === true;
  // Surface σ state so tower cards can describe stored and lifetime absorption math.
  const sigmaState = typeof entry.sigmaState === 'object' && entry.sigmaState ? entry.sigmaState : null;
  const storedDamage = Number(
    Number.isFinite(entry.sigmaStoredDamage)
      ? entry.sigmaStoredDamage
      : sigmaState?.storedDamage ?? entry.storedDamage,
  );
  if (Number.isFinite(storedDamage) && storedDamage >= 0) {
    stats.sigmaStoredDamage = storedDamage;
  }
  const totalAbsorbed = Number(
    Number.isFinite(entry.sigmaTotalAbsorbed)
      ? entry.sigmaTotalAbsorbed
      : sigmaState?.totalAbsorbed ?? entry.totalAbsorbed,
  );
  if (Number.isFinite(totalAbsorbed) && totalAbsorbed >= 0) {
    stats.sigmaTotalAbsorbed = totalAbsorbed;
  }
  const lastRelease = Number(
    Number.isFinite(entry.sigmaLastRelease)
      ? entry.sigmaLastRelease
      : sigmaState?.lastRelease ?? entry.lastRelease,
  );
  if (Number.isFinite(lastRelease) && lastRelease >= 0) {
    stats.sigmaLastRelease = lastRelease;
  }
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
    prestige,
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
      if (!Number.isFinite(distance)) {
        return;
      }
      // Treat towers as adjacent when either range overlaps so beta/γ style
      // mechanics can count nearby allies even if their radii differ.
      const overlapsTarget = targetRange > 0 && distance <= targetRange;
      const overlapsCandidate = candidateRange > 0 && distance <= candidateRange;
      if (!overlapsTarget && !overlapsCandidate) {
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
    prestige: target.prestige === true,
    unspentThero:
      Number.isFinite(options.unspentThero) && options.unspentThero >= 0
        ? options.unspentThero
        : null,
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

export function getTowerDefinition(towerId) {
  return towerTabState.towerDefinitionMap.get(towerId) || null;
}

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
  if (definition) {
    return composeTowerDisplayLabel(definition, towerId || 'tower');
  }
  if (typeof towerId === 'string' && towerId.trim()) {
    return towerId.trim();
  }
  return 'tower';
}

export function getNextTowerId(towerId) {
  const definition = getTowerDefinition(towerId);
  return definition?.nextTierId || null;
}

export function getPreviousTowerId(towerId) {
  if (!towerId) {
    return null;
  }
  return towerTabState.towerPreviousTierMap.get(towerId) || null;
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

const {
  setLoadoutElements,
  pruneLockedTowersFromLoadout,
  refreshTowerLoadoutDisplay,
  renderTowerLoadout,
  startTowerDrag,
  cancelTowerDrag,
} = createTowerLoadoutController({
  getLoadoutState: () => towerTabState.loadoutState,
  getLoadoutElements: () => towerTabState.loadoutElements,
  getLoadoutSlots,
  getLoadoutLimit: () => towerTabState.towerLoadoutLimit,
  getTowerDefinitions,
  getTowerDefinition,
  getNextTowerId,
  isTowerUnlocked,
  isTowerPlaceable,
  getTheroSymbol: () => towerTabState.theroSymbol,
  getPlayfield: () => towerTabState.playfield,
  getAudioManager: () => towerTabState.audioManager,
  formatCombatNumber,
  createTowerIconElement,
  syncLoadoutToPlayfield,
});

export { setLoadoutElements, pruneLockedTowersFromLoadout, refreshTowerLoadoutDisplay, startTowerDrag, cancelTowerDrag };

const { initializeTowerEquipmentInterface, getEquipmentSlotRecord } = createTowerEquipmentBindings({
  equipmentUiState: towerTabState.equipmentUi,
  towerCardSelector: TOWER_CARD_SELECTOR,
  getTowerSourceLabel,
  getTowerEquipment,
  getTowerEquipmentId,
  getCraftedEquipment,
  getEquipmentAssignment,
  assignEquipmentToTower,
  clearTowerEquipment,
  addEquipmentStateListener,
});

export { initializeTowerEquipmentInterface };

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
export function updateTowerSelectionButtons() {
  towerTabState.selectionButtons.forEach((button, towerId) => {
    const definition = getTowerDefinition(towerId);
    const selected = normalizeLoadoutSlots().includes(towerId);
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
    const atLimit = !selected && getNextEmptyLoadoutSlot() === -1;
    button.disabled = false;
    button.dataset.loadoutFull = atLimit ? 'true' : 'false';
    button.title = selected
      ? `${definition?.name || 'Tower'} is currently in your loadout.`
      : atLimit
        ? 'Loadout full—choose a tower to replace.'
        : `Equip ${definition?.name || 'tower'} for this defense.`;
  });
}

// Remove any existing replacement prompt so new interactions always start clean.
function hideLoadoutReplacementPrompt() {
  const { loadoutReplacementUi } = towerTabState;
  if (loadoutReplacementUi.outsideHandler) {
    document.removeEventListener('pointerdown', loadoutReplacementUi.outsideHandler, { passive: true });
  }
  if (loadoutReplacementUi.container?.parentNode) {
    loadoutReplacementUi.container.remove();
  }
  loadoutReplacementUi.container = null;
  loadoutReplacementUi.optionsRow = null;
  loadoutReplacementUi.anchorButton = null;
  loadoutReplacementUi.pendingTowerId = null;
  loadoutReplacementUi.outsideHandler = null;
}

// Build the popup that lets players pick which equipped tower to replace when the loadout is full.
function showLoadoutReplacementPrompt(targetTowerId, anchorButton) {
  if (!(anchorButton instanceof HTMLElement)) {
    hideLoadoutReplacementPrompt();
    return;
  }
  const { loadoutReplacementUi } = towerTabState;
  const selected = normalizeLoadoutSlots().filter((towerId) => towerId);
  if (!Array.isArray(selected) || selected.length < 1) {
    hideLoadoutReplacementPrompt();
    return;
  }

  const container = document.createElement('div');
  container.className = 'tower-replace-popup';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', 'Select a tower to replace');

  const title = document.createElement('p');
  title.className = 'tower-replace-popup__title';
  title.textContent = 'Replace which tower?';
  container.append(title);

  const optionsRow = document.createElement('div');
  optionsRow.className = 'tower-replace-popup__options';
  container.append(optionsRow);

  selected.forEach((currentTowerId) => {
    const definition = getTowerDefinition(currentTowerId);
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'tower-replace-popup__option';
    option.dataset.towerId = currentTowerId;
    option.title = `Replace ${definition?.name || currentTowerId}`;
    option.setAttribute('aria-label', `Replace ${definition?.name || currentTowerId}`);

    if (definition?.icon) {
      const icon = createTowerIconElement(definition, {
        className: 'tower-replace-popup__icon',
        alt: `${definition.name || currentTowerId} icon`,
      });
      if (icon) {
        option.append(icon);
      }
    }

    const label = document.createElement('span');
    label.className = 'tower-replace-popup__option-label';
    label.textContent = definition?.symbol || definition?.name || currentTowerId;
    option.append(label);

    option.addEventListener('click', () => {
      replaceTowerInLoadout(currentTowerId, targetTowerId);
    });
    optionsRow.append(option);
  });

  hideLoadoutReplacementPrompt();
  anchorButton.insertAdjacentElement('afterend', container);
  loadoutReplacementUi.container = container;
  loadoutReplacementUi.optionsRow = optionsRow;
  loadoutReplacementUi.anchorButton = anchorButton;
  loadoutReplacementUi.pendingTowerId = targetTowerId;
  loadoutReplacementUi.outsideHandler = (event) => {
    if (!container.contains(event.target) && !anchorButton.contains(event.target)) {
      hideLoadoutReplacementPrompt();
    }
  };
  document.addEventListener('pointerdown', loadoutReplacementUi.outsideHandler, { passive: true });
}

// Swap a tower in the loadout for the requested replacement and refresh the downstream UI.
function replaceTowerInLoadout(towerIdToRemove, towerIdToAdd) {
  const selected = normalizeLoadoutSlots();
  if (!Array.isArray(selected)) {
    return;
  }
  const index = selected.indexOf(towerIdToRemove);
  if (index === -1) {
    return;
  }
  assignTowerToSlot(index, towerIdToAdd);
  hideLoadoutReplacementPrompt();
  syncLoadoutToPlayfield();
}

export function toggleTowerSelection(towerId, { anchorButton = null } = {}) {
  if (!towerTabState.towerDefinitionMap.has(towerId)) {
    return;
  }
  hideLoadoutReplacementPrompt();
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
  const selected = normalizeLoadoutSlots();
  const index = selected.indexOf(towerId);
  if (index >= 0) {
    selected[index] = null;
  } else {
    const emptyIndex = getNextEmptyLoadoutSlot();
    if (emptyIndex === -1) {
      showLoadoutReplacementPrompt(towerId, anchorButton);
      if (towerTabState.loadoutElements.note) {
        towerTabState.loadoutElements.note.textContent = 'Loadout full—select a glyph to replace.';
      }
      updateTowerSelectionButtons();
      return;
    }
    assignTowerToSlot(emptyIndex, towerId);
  }
  updateTowerSelectionButtons();
  syncLoadoutToPlayfield();
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

function getVariableCurrencyKey(variable) {
  return variable?.glyphCurrency === 'bet' ? 'bet' : 'aleph';
}

function getCurrencyMeta(currencyKey = 'aleph') {
  if (currencyKey === 'bet') {
    return { singular: 'Bet glyph', plural: 'Bet glyphs', short: 'Bet Glyphs', symbol: 'בּ' };
  }
  return { singular: 'glyph', plural: 'glyphs', short: 'Glyphs', symbol: 'ℵ' };
}

function getAvailableCurrency(currencyKey = 'aleph') {
  const balance = currencyKey === 'bet' ? towerTabState.betGlyphCurrency : towerTabState.glyphCurrency;
  return Math.max(0, Math.floor(balance || 0));
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
  const currencyKey = getVariableCurrencyKey(variable);
  const currencyMeta = getCurrencyMeta(currencyKey);
  const availableGlyphs = getAvailableCurrency(currencyKey);

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
  increment.disabled = availableGlyphs < cost || reachedMax;
  increment.setAttribute('aria-label', `Invest glyph into ${variable.symbol || variable.key}`);
  increment.addEventListener('click', () => handleTowerVariableUpgrade(towerId, variable.key));
  glyphControl.append(increment);

  controls.append(glyphControl);

  const costNote = document.createElement('span');
  costNote.className = 'tower-upgrade-variable-cost';
  const costLabel = cost === 1 ? currencyMeta.singular : currencyMeta.plural;
  costNote.textContent = `COST: ${cost} ${costLabel.toUpperCase()}`;
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
    const labelBase = composeTowerDisplayLabel(definition, towerId);
    const icon = createTowerIconElement(definition, {
      className: 'tower-preview__icon',
      alt: `${labelBase} placement preview`,
    });
    if (!icon) {
      return;
    }
    preview.append(icon);
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
    // Pass the button as an anchor so replacement prompts can position beneath the trigger.
    button.addEventListener('click', () => toggleTowerSelection(towerId, { anchorButton: button }));
  });
  updateTowerSelectionButtons();
}

export function syncLoadoutToPlayfield() {
  // Clear any replacement prompt before mutating the loadout so UI mirrors the new state.
  hideLoadoutReplacementPrompt();
  normalizeLoadoutSlots();
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
