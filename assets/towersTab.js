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

const UNIVERSAL_VARIABLE_LIBRARY = new Map([
  [
    'atk',
    {
      symbol: 'Atk',
      name: 'Attack',
      description: 'Base damage dealt per strike.',
    },
  ],
  [
    'm',
    {
      symbol: 'm',
      name: 'Range',
      description: 'Effective reach of the lattice (meters).',
    },
  ],
  [
    'spd',
    {
      symbol: 'Spd',
      name: 'Attack Speed',
      description: 'Primary attack cadence measured per second.',
    },
  ],
  [
    'dod',
    {
      symbol: 'Dod',
      name: 'Damage over Distance',
      description: 'Damage contribution that scales with travel distance.',
    },
  ],
  [
    'def',
    {
      symbol: 'Def',
      name: 'Defense',
      description: 'Flat protection granted to soldier cohorts.',
    },
  ],
  [
    'def%',
    {
      symbol: 'Def%',
      name: 'Defense Percent',
      description: 'Percentage-based defense granted to soldier cohorts.',
    },
  ],
  [
    'atk%',
    {
      symbol: 'Atk%',
      name: 'Attack Percent',
      description: 'Percentage-based increase to attack power.',
    },
  ],
  [
    'prc',
    {
      symbol: 'Prc',
      name: 'Pierce',
      description: 'How many enemies a projectile can pass through.',
    },
  ],
  [
    'chn',
    {
      symbol: 'Chn',
      name: 'Chaining',
      description: 'Number of additional targets a strike can arc toward.',
    },
  ],
  [
    'slw%',
    {
      symbol: 'Slw%',
      name: 'Slow Percent',
      description: 'Percentage-based slow applied to enemies.',
    },
  ],
  [
    'tot',
    {
      symbol: 'Tot',
      name: 'Total',
      description: 'Maximum allied units commanded simultaneously.',
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
    goldenEquation: null,
    variables: null,
    note: null,
    icon: null,
    hideTimeoutId: null,
    hideTransitionHandler: null,
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
  hideUpgradeMatrix: null,
  renderUpgradeMatrix: null,
  discoveredVariables: new Map(),
  discoveredVariableListeners: new Set(),
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

function getGlyphSubscriptRank(subscriptIndex = 1) {
  const normalizedIndex = Number.isFinite(subscriptIndex)
    ? Math.max(1, Math.floor(subscriptIndex))
    : 1;
  // Anchor glyph ranks to the Mind Gate so Ψ₁/Ψ₂ mirror its upgrade reservoirs.
  const mindGateBlueprint = getTowerEquationBlueprint('mind-gate');
  ensureTowerUpgradeState('mind-gate', mindGateBlueprint);
  const lifeValue = computeTowerVariableValue('mind-gate', 'life', mindGateBlueprint);
  const recoveryValue = computeTowerVariableValue('mind-gate', 'recovery', mindGateBlueprint);
  const lifeRank = Math.max(1, Number.isFinite(lifeValue) ? lifeValue : 1);
  const recoveryRank = Math.max(1, Number.isFinite(recoveryValue) ? recoveryValue : 1);
  if (normalizedIndex === 1) {
    return lifeRank;
  }
  if (normalizedIndex === 2) {
    return recoveryRank;
  }
  const tailBase = Math.max(lifeRank, recoveryRank);
  return tailBase + (normalizedIndex - 2);
}

const TOWER_EQUATION_BLUEPRINTS = {
  // Model the Mind Gate's two glyph conduits so it can accept upgrades directly.
  'mind-gate': {
    mathSymbol: '\\mathcal{G}_{\\text{Mind}}',
    baseEquation: '\\( \\mathcal{G}_{\\text{Mind}} = 10 \\times \\Psi_{1} + \\frac{\\Psi_{2}}{1 / \\Psi_{1}} \\)',
    variables: [
      {
        key: 'life',
        symbol: 'Ψ₁',
        name: 'Ψ₁ Life Reservoir',
        description: 'Glyph lifeforce braided into the Mind Gate core.',
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} Ψ₁`,
        cost: (level) => Math.max(1, 1 + level),
        getSubEquations({ level, value }) {
          const invested = Math.max(0, Number.isFinite(level) ? level : 0);
          const rank = Math.max(1, Number.isFinite(value) ? value : 1);
          return [`\\( \\Psi_{1} = 1 + ${formatWholeNumber(invested)} = ${formatWholeNumber(rank)} \\)`];
        },
      },
      {
        key: 'recovery',
        symbol: 'Ψ₂',
        name: 'Ψ₂ Recovery Surge',
        description: 'Restorative glyph cadence that rethreads the gate between waves.',
        baseValue: 2,
        step: 1,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} Ψ₂`,
        cost: (level) => Math.max(1, 2 + level),
        getSubEquations({ level, value }) {
          const invested = Math.max(0, Number.isFinite(level) ? level : 0);
          const rank = Math.max(1, Number.isFinite(value) ? value : 2);
          return [`\\( \\Psi_{2} = 2 + ${formatWholeNumber(invested)} = ${formatWholeNumber(rank)} \\)`];
        },
      },
    ],
    computeResult(values) {
      const life = Math.max(1, Number.isFinite(values.life) ? values.life : 1);
      const recovery = Math.max(0, Number.isFinite(values.recovery) ? values.recovery : 0);
      return 10 * life + recovery * life;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = 10 \\times ${formatVariable('life')} + ${formatVariable('recovery')} \\times ${formatVariable('life')} \\)`;
    },
  },
  alpha: {
    mathSymbol: '\\alpha',
    baseEquation: '\\( \\alpha = Atk \\)',
    variables: [
      {
        key: 'atk',
        symbol: 'Atk',
        name: 'Attack',
        description: 'Projectile damage carried by each glyph bullet.',
        baseValue: 5,
        step: 5,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} Atk`,
        cost: (level) => Math.max(1, 1 + level),
      getSubEquations({ level, value }) {
        const glyphRank = Math.max(1, Number.isFinite(level) ? level + 1 : 1);
        const attackValue = formatWholeNumber(Number.isFinite(value) ? value : 0);
        return [`\\( Atk = 5 \\times \\Psi_{1} = 5 \\times ${formatWholeNumber(glyphRank)} = ${attackValue} \\)`];
      },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      return attack;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = ${formatVariable('atk')} \\)`;
    },
  },
  beta: {
    mathSymbol: '\\beta',
    baseEquation: '\\( \\beta : Atk = \\alpha, Rng = \\Psi_{1} \\)',
    variables: [
      {
        key: 'attack',
        symbol: 'Atk',
        name: 'Attack',
        description: 'Direct strike power mirrored from α.',
        reference: 'alpha',
        upgradable: false,
        lockedNote: 'Strengthens exactly as α does.',
        format: (value) => `${formatGameNumber(value)} attack`,
      },
      {
        key: 'range',
        symbol: 'Ψ₁',
        name: 'Range',
        description: 'Baseline reach anchored to the first glyph tier.',
        upgradable: false,
        format: (value) => `${formatWholeNumber(value)} range`,
        getBase: () => getGlyphSubscriptRank(1),
        getSubEquations() {
          const glyphRank = getGlyphSubscriptRank(1);
          return [`\\( \\Psi_{1} = ${formatWholeNumber(glyphRank)} \\)`];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      return attack;
    },
    formatGoldenEquation({ formatVariable }) {
      return `\\( \\beta : Atk = ${formatVariable('attack')}, Rng = ${formatVariable('range')} \\)`;
    },
  },
  gamma: {
    mathSymbol: '\\gamma',
    baseEquation: '\\( \\gamma : Atk = \\beta, Spd = \\Psi_{1}, Rng = \\Psi_{2}, Prc = \\Psi_{3} \\)',
    variables: [
      {
        key: 'attack',
        symbol: 'Atk',
        name: 'Attack',
        description: 'Strike intensity carried forward from β.',
        reference: 'beta',
        upgradable: false,
        lockedNote: 'Bolster β to amplify γ attack.',
        format: (value) => `${formatGameNumber(value)} attack`,
      },
      {
        key: 'attackSpeed',
        symbol: 'Ψ₁',
        name: 'Attack Speed',
        description: 'Cadence keyed to the first glyph subscript.',
        upgradable: false,
        format: (value) => `${formatDecimal(value, 2)} attacks/sec`,
        getBase: () => getGlyphSubscriptRank(1),
        getSubEquations() {
          const glyphRank = getGlyphSubscriptRank(1);
          return [`\\( \\Psi_{1} = ${formatWholeNumber(glyphRank)} \\)`];
        },
      },
      {
        key: 'range',
        symbol: 'Ψ₂',
        name: 'Range',
        description: 'Arc reach tethered to the second glyph subscript.',
        upgradable: false,
        format: (value) => `${formatWholeNumber(value)} range`,
        getBase: () => getGlyphSubscriptRank(2),
        getSubEquations() {
          const glyphRank = getGlyphSubscriptRank(2);
          return [`\\( \\Psi_{2} = ${formatWholeNumber(glyphRank)} \\)`];
        },
      },
      {
        key: 'pierce',
        symbol: 'Ψ₃',
        name: 'Pierce',
        description: 'Piercing depth guided by the third glyph subscript.',
        upgradable: false,
        format: (value) => `${formatWholeNumber(value)} pierce`,
        getBase: () => getGlyphSubscriptRank(3),
        getSubEquations() {
          const glyphRank = getGlyphSubscriptRank(3);
          return [`\\( \\Psi_{3} = ${formatWholeNumber(glyphRank)} \\)`];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      return attack;
    },
    formatGoldenEquation({ formatVariable }) {
      return `\\( \\gamma : Atk = ${formatVariable('attack')}, Spd = ${formatVariable(
        'attackSpeed'
      )}, Rng = ${formatVariable('range')}, Prc = ${formatVariable('pierce')} \\)`;
    },
  },
  delta: {
    mathSymbol: '\\delta',
    baseEquation: '\\( \\delta = \\gamma \\cdot \\ln(\\gamma + 1) \\)',
    variables: [
      {
        key: 'gamma',
        symbol: 'γ',
        name: 'Gamma Cohort',
        description: 'Command strength inherited entirely from γ conductors.',
        reference: 'gamma',
        upgradable: false,
        lockedNote: 'Bolster γ to empower this cohort.',
        format: (value) => formatDecimal(value, 2),
      },
      {
        key: 'tot',
        symbol: 'Tot',
        name: 'Total Cohort',
        description: 'Maximum spectral soldiers δ can field simultaneously.',
        upgradable: false,
        getBase: ({ definition }) => {
          if (Number.isFinite(definition?.tot)) {
            return Math.max(1, Math.round(definition.tot));
          }
          return 5;
        },
        format: (value) => `${formatWholeNumber(value)} soldiers`,
      },
    ],
    computeResult(values) {
      const gammaValue = Math.max(0, Number.isFinite(values.gamma) ? values.gamma : 0);
      const lnComponent = Math.log(gammaValue + 1);
      return gammaValue * lnComponent;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = ${formatVariable('gamma')} \\times \\ln(${formatVariable('gamma')} + 1) \\)`;
    },
  },
  omicron: {
    mathSymbol: 'ο',
    baseEquation: '\\( ο = \\ln(ξ + 1) \\)',
    variables: [
      {
        key: 'xi',
        symbol: 'ξ',
        name: 'Xi Scarcity Flux',
        description: 'Stabilized phasor current inherited from ξ lattices.',
        reference: 'xi',
        upgradable: false,
        lockedNote: 'Tune ξ to channel energy into ο.',
        format: (value) => formatDecimal(value, 2),
      },
    ],
    computeResult(values) {
      const xiValue = Math.max(0, Number.isFinite(values.xi) ? values.xi : 0);
      return Math.log(xiValue + 1);
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = \\ln(${formatVariable('xi')} + 1) \\)`;
    },
  },
  pi: {
    mathSymbol: '\\pi',
    baseEquation: '\\( \\pi = ο^{2} \\)',
    variables: [
      {
        key: 'omicron',
        symbol: 'ο',
        name: 'Omicron Phasor',
        description: 'Squared shockwave amplitude sourced from ο stabilizers.',
        reference: 'omicron',
        upgradable: false,
        lockedNote: 'Channel ο to prime Π with stabilized flux.',
        format: (value) => formatDecimal(value, 2),
      },
    ],
    computeResult(values) {
      const omicronValue = Math.max(0, Number.isFinite(values.omicron) ? values.omicron : 0);
      return omicronValue ** 2;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return `\\( ${formatResult()} = ${formatVariable('omicron')}^{2} \\)`;
    },
  },
};

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

function escapeRegExp(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function escapeCssSelector(value) {
  if (typeof value !== 'string') {
    return '';
  }
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function resetTowerVariableAnimationState() {
  towerTabState.towerVariableAnimation.towerId = null;
  towerTabState.towerVariableAnimation.variableMap = new Map();
  towerTabState.towerVariableAnimation.variableSpans = new Map();
  towerTabState.towerVariableAnimation.entryPlayed = false;
  towerTabState.towerVariableAnimation.shouldPlayEntry = false;
}

function renderTowerUpgradeEquationParts(baseEquationText, blueprint, options = {}) {
  const baseEquationEl = towerTabState.towerUpgradeElements.baseEquation;
  if (!baseEquationEl) {
    return;
  }
  const markDeparted = options.markDeparted === true;
  const resolvedEquation = convertMathExpressionToPlainText(baseEquationText) || baseEquationText || '';
  baseEquationEl.innerHTML = '';

  const upgradableVariables = (blueprint?.variables || []).filter((variable) => variable.upgradable !== false);
  const tokens = tokenizeEquationParts(
    resolvedEquation,
    upgradableVariables.map((variable) => ({
      key: variable.key,
      symbol: variable.symbol || variable.key.toUpperCase(),
    })),
  );

  const fragment = document.createDocumentFragment();
  const spanMap = new Map();

  tokens.forEach((token) => {
    const span = document.createElement('span');
    span.className = 'tower-upgrade-formula-part';
    span.textContent = token.text;

    if (token.variableKey) {
      span.dataset.variable = token.variableKey;
      span.classList.add('tower-upgrade-formula-part--variable');
      if (!spanMap.has(token.variableKey)) {
        spanMap.set(token.variableKey, []);
      }
      spanMap.get(token.variableKey).push(span);
      if (markDeparted) {
        span.classList.add('is-departed');
      }
    }

    fragment.append(span);
  });

  if (!tokens.length) {
    const fallback = document.createElement('span');
    fallback.className = 'tower-upgrade-formula-part';
    fallback.textContent = resolvedEquation;
    fragment.append(fallback);
  }

  baseEquationEl.append(fragment);
  towerTabState.towerVariableAnimation.variableSpans = spanMap;
}

function refreshTowerVariableAnimationState(towerId, blueprint) {
  const spanMap = towerTabState.towerVariableAnimation.variableSpans || new Map();
  const nextMap = new Map();
  const { variables } = towerTabState.towerUpgradeElements;

  if (variables) {
    const upgradableVariables = (blueprint?.variables || []).filter((variable) => variable.upgradable !== false);
    upgradableVariables.forEach((variable) => {
      const key = variable.key;
      const spans = spanMap.get(key) || [];
      const selector = `[data-variable="${escapeCssSelector(key)}"]`;
      const card = variables.querySelector(selector);
      if (spans.length && card) {
        nextMap.set(key, { spans, card, variable });
      }
    });
  }

  towerTabState.towerVariableAnimation.towerId = towerId;
  towerTabState.towerVariableAnimation.variableMap = nextMap;
  towerTabState.towerVariableAnimation.variableSpans = new Map();
}

function syncTowerVariableCardVisibility() {
  const container = towerTabState.towerUpgradeElements.variables;
  if (!container) {
    return;
  }
  const cards = container.querySelectorAll('.tower-upgrade-variable');
  cards.forEach((card, index) => {
    card.style.setProperty('--tower-upgrade-variable-index', index);
    if (towerTabState.towerVariableAnimation.entryPlayed) {
      card.classList.add('is-visible');
    } else {
      card.classList.remove('is-visible');
    }
  });
}

function playTowerVariableFlight(direction = 'enter') {
  const panel = towerTabState.towerUpgradeElements.panel;
  if (!panel) {
    return Promise.resolve();
  }

  const variableMap = towerTabState.towerVariableAnimation.variableMap;
  if (!variableMap || variableMap.size === 0) {
    towerTabState.towerVariableAnimation.entryPlayed = direction === 'enter';
    syncTowerVariableCardVisibility();
    return Promise.resolve();
  }

  const panelRect = panel.getBoundingClientRect();
  const animations = [];
  const clones = [];
  let index = 0;

  variableMap.forEach(({ spans, card }) => {
    const symbolEl = card.querySelector('.tower-upgrade-variable-symbol');
    if (!symbolEl) {
      return;
    }
    const targetRect = symbolEl.getBoundingClientRect();
    const spansToUse = Array.isArray(spans) ? spans : [];

    if (direction === 'enter') {
      card.classList.remove('is-visible');
      card.classList.add('is-incoming');
    } else {
      card.classList.add('is-outgoing');
    }

    spansToUse.forEach((span) => {
      const spanRect = span.getBoundingClientRect();
      const startRect = direction === 'enter' ? spanRect : targetRect;
      const endRect = direction === 'enter' ? targetRect : spanRect;

      const clone = document.createElement('span');
      clone.className = 'tower-upgrade-formula-flight';
      clone.textContent = span.textContent || symbolEl.textContent || '';
      clone.style.left = `${startRect.left - panelRect.left}px`;
      clone.style.top = `${startRect.top - panelRect.top}px`;
      clone.style.width = `${startRect.width}px`;
      clone.style.height = `${startRect.height}px`;

      const deltaX = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
      const deltaY = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

      const keyframes =
        direction === 'enter'
          ? [
              { transform: 'translate3d(0, 0, 0)', opacity: 1 },
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 0 },
            ]
          : [
              { transform: 'translate3d(0, 0, 0)', opacity: 0 },
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
            ];

      panel.append(clone);
      clones.push(clone);

      const animation = clone.animate(keyframes, {
        duration: 560,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        delay: index * 40,
        fill: 'forwards',
      });
      animations.push(animation.finished.catch(() => {}));
      animation.addEventListener('finish', () => {
        clone.remove();
      });

      index += 1;
    });
  });

  if (direction === 'enter') {
    variableMap.forEach(({ spans }) => {
      (spans || []).forEach((span) => {
        span.classList.add('is-departed');
      });
    });
  }

  const finalize = () => {
    clones.forEach((clone) => {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    });

    variableMap.forEach(({ card, spans }) => {
      card.classList.remove('is-incoming', 'is-outgoing');
      if (direction === 'exit') {
        (spans || []).forEach((span) => span.classList.remove('is-departed'));
      }
    });

    towerTabState.towerVariableAnimation.entryPlayed = direction === 'enter';
    syncTowerVariableCardVisibility();
  };

  if (!animations.length) {
    finalize();
    return Promise.resolve();
  }

  return Promise.allSettled(animations).then(() => {
    finalize();
  });
}

function maybePlayTowerVariableEntry() {
  if (!towerTabState.towerVariableAnimation.shouldPlayEntry) {
    syncTowerVariableCardVisibility();
    return;
  }

  towerTabState.towerVariableAnimation.shouldPlayEntry = false;
  requestAnimationFrame(() => {
    playTowerVariableFlight('enter');
  });
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
    if (!isTowerUnlocked(selected[index])) {
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
  items.forEach((item) => {
    const towerId = item.dataset.towerId;
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return;
    }
    const currentCost = towerTabState.playfield
      ? towerTabState.playfield.getCurrentTowerCost(towerId)
      : definition.baseCost;
    const costEl = item.querySelector('.tower-loadout-cost');
    if (costEl) {
      costEl.textContent = `${Math.round(currentCost)} ${towerTabState.theroSymbol}`;
    }
    if (definition && item) {
      const label = `${definition.name} — ${Math.round(currentCost)} ${towerTabState.theroSymbol}`;
      item.setAttribute('aria-label', label); // Surface name and price for assistive tech now that the text label is hidden.
    }
    const affordable = interactive ? towerTabState.playfield.energy >= currentCost : false;
    item.dataset.valid = affordable ? 'true' : 'false';
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
    if (!definition) {
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
    costEl.textContent = '—';

    item.append(artwork, costEl); // Present only the icon with the cost stacked below it to save vertical space.

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

  const label = document.createElement('span');
  label.className = 'tower-equipment-button__label';
  label.textContent = 'Equipment';

  const name = document.createElement('span');
  name.className = 'tower-equipment-button__name';
  name.textContent = 'Empty';

  button.append(icon, label, name);

  const menu = document.createElement('div');
  menu.className = 'tower-equipment-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-hidden', 'true');
  menu.hidden = true;
  menu.dataset.towerEquipmentMenu = towerId;

  const list = document.createElement('ul');
  list.className = 'tower-equipment-menu__list';
  menu.append(list);

  container.append(button, menu);

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
    name,
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
  const cards = document.querySelectorAll('[data-tower-id]');
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
    button.dataset.locked = unlocked ? 'false' : 'true';
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

function getTowerSourceLabel(towerId) {
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return towerId;
  }
  const symbol = typeof definition.symbol === 'string' ? definition.symbol.trim() : '';
  const name = typeof definition.name === 'string' ? definition.name.trim() : towerId;
  return symbol ? `${symbol} ${name}` : name;
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
        lines.push(trimmed);
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

export function updateTowerUpgradeGlyphDisplay() {
  const { glyphs } = towerTabState.towerUpgradeElements;
  if (!glyphs) {
    return;
  }
  const available = Math.max(0, Math.floor(towerTabState.glyphCurrency));
  glyphs.textContent = `Available Glyphs: ${formatWholeNumber(available)}`;
}

function setTowerUpgradeNote(message, tone = '') {
  const { note } = towerTabState.towerUpgradeElements;
  if (!note) {
    return;
  }
  note.textContent = message || '';
  if (tone) {
    note.dataset.tone = tone;
  } else {
    note.removeAttribute('data-tone');
  }
}

function renderTowerUpgradeVariables(towerId, blueprint, values = {}) {
  const { variables } = towerTabState.towerUpgradeElements;
  if (!variables) {
    return;
  }
  const container = variables;
  container.innerHTML = '';
  const blueprintVariables = blueprint?.variables || [];
  const state = ensureTowerUpgradeState(towerId, blueprint);

  if (!blueprintVariables.length) {
    const empty = document.createElement('p');
    empty.className = 'tower-upgrade-variable-note';
    empty.textContent = 'This lattice has no adjustable variables yet.';
    container.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  const mathElements = [];
  blueprintVariables.forEach((variable) => {
    const value = Number.isFinite(values[variable.key]) ? values[variable.key] : 0;
    const level = state.variables?.[variable.key]?.level || 0;
    const item = document.createElement('div');
    item.className = 'tower-upgrade-variable';
    item.setAttribute('role', 'listitem');
    item.dataset.variable = variable.key;
    if (variable.upgradable !== false) {
      item.classList.add('tower-upgrade-variable--upgradable');
    }

    const header = document.createElement('div');
    header.className = 'tower-upgrade-variable-header';

    const symbol = document.createElement('span');
    symbol.className = 'tower-upgrade-variable-symbol';
    symbol.textContent = variable.symbol || variable.key.toUpperCase();
    header.append(symbol);

    const summary = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'tower-upgrade-variable-name';
    name.textContent = variable.name || `Variable ${variable.symbol || variable.key}`;
    summary.append(name);

    if (variable.description) {
      const description = document.createElement('p');
      description.className = 'tower-upgrade-variable-description';
      description.textContent = variable.description;
      summary.append(description);
    }

    header.append(summary);
    item.append(header);

    const subEquationLines = resolveTowerVariableSubEquations(variable, {
      level,
      value,
      variable,
      towerId,
      blueprint,
      values,
      formatValue: () => formatTowerVariableValue(variable, value),
      formatWholeNumber,
      formatDecimal,
      formatGameNumber,
    });

    if (subEquationLines.length) {
      const equations = document.createElement('div');
      equations.className = 'tower-upgrade-variable-equations';
      subEquationLines.forEach((line) => {
        const lineEl = document.createElement('p');
        lineEl.className = 'tower-upgrade-variable-equation-line';
        lineEl.textContent = line;
        equations.append(lineEl);
      });
      item.append(equations);
      mathElements.push(equations);
    }

    const footer = document.createElement('div');
    footer.className = 'tower-upgrade-variable-footer';

    const stats = document.createElement('div');
    stats.className = 'tower-upgrade-variable-stats';

    const valueEl = document.createElement('span');
    valueEl.className = 'tower-upgrade-variable-value';
    valueEl.textContent = formatTowerVariableValue(variable, value);
    stats.append(valueEl);

    const levelEl = document.createElement('span');
    levelEl.className = 'tower-upgrade-variable-level';
    levelEl.textContent = level ? `+${level}` : 'Base';
    stats.append(levelEl);

    footer.append(stats);

    if (variable.upgradable !== false) {
      const cost = calculateTowerVariableUpgradeCost(variable, level);

      const controls = document.createElement('div');
      controls.className = 'tower-upgrade-variable-controls';

      const glyphControl = document.createElement('div');
      glyphControl.className = 'tower-upgrade-variable-glyph-control';

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
      glyphCount.textContent = `${level} Ψ`;
      glyphControl.append(glyphCount);

      const increment = document.createElement('button');
      increment.type = 'button';
      increment.className = 'tower-upgrade-variable-glyph-button tower-upgrade-variable-glyph-button--increase';
      increment.dataset.upgradeVariable = variable.key;
      increment.textContent = '+';
      increment.disabled = towerTabState.glyphCurrency < cost;
      increment.setAttribute('aria-label', `Invest glyph into ${variable.symbol || variable.key}`);
      increment.addEventListener('click', () => handleTowerVariableUpgrade(towerId, variable.key));
      glyphControl.append(increment);

      controls.append(glyphControl);

      const costNote = document.createElement('span');
      costNote.className = 'tower-upgrade-variable-cost';
      costNote.textContent = cost === 1 ? 'Cost: 1 Glyph' : `Cost: ${cost} Glyphs`;
      controls.append(costNote);

      footer.append(controls);
    } else {
      const note = document.createElement('span');
      note.className = 'tower-upgrade-variable-note';
      note.textContent = variable.lockedNote || 'Inherited from allied lattices.';
      footer.append(note);
    }

    item.append(footer);
    fragment.append(item);
  });

  container.append(fragment);
  mathElements.forEach((element) => renderMathElement(element));
  syncTowerVariableCardVisibility();
}
export function renderTowerUpgradeOverlay(towerId, options = {}) {
  const { overlay } = towerTabState.towerUpgradeElements;
  if (!overlay) {
    return;
  }
  const animateEntry = Boolean(options.animateEntry);
  if (animateEntry) {
    towerTabState.towerVariableAnimation.entryPlayed = false;
  }
  towerTabState.towerVariableAnimation.shouldPlayEntry = animateEntry;

  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return;
  }

  const blueprint = options.blueprint || getTowerEquationBlueprint(towerId);
  if (!blueprint) {
    return;
  }

  ensureTowerUpgradeState(towerId, blueprint);

  const baseEquationText =
    typeof options.baseEquationText === 'string' && options.baseEquationText.trim()
      ? options.baseEquationText.trim()
      : towerTabState.activeTowerUpgradeBaseEquation || blueprint.baseEquation || '';
  towerTabState.activeTowerUpgradeBaseEquation = baseEquationText;

  if (towerTabState.towerUpgradeElements.title) {
    const label = `${definition.symbol ? `${definition.symbol} ` : ''}${definition.name || 'Tower'}`.trim();
    towerTabState.towerUpgradeElements.title.textContent = label || 'Tower Equation';
  }

  if (towerTabState.towerUpgradeElements.tier) {
    let tierLabel = '';
    if (typeof definition.tierLabel === 'string' && definition.tierLabel.trim()) {
      tierLabel = definition.tierLabel.trim();
    } else if (Number.isFinite(definition.tier)) {
      tierLabel = `Tier ${definition.tier}`;
    }
    towerTabState.towerUpgradeElements.tier.textContent = tierLabel;
  }

  if (towerTabState.towerUpgradeElements.icon) {
    const iconContainer = towerTabState.towerUpgradeElements.icon;
    iconContainer.innerHTML = '';
    if (definition.icon) {
      const img = document.createElement('img');
      img.src = definition.icon;
      const iconLabel = `${definition.symbol ? `${definition.symbol} ` : ''}${definition.name || 'tower'}`.trim();
      img.alt = iconLabel ? `${iconLabel} icon` : 'Tower icon';
      img.loading = 'lazy';
      img.decoding = 'async';
      iconContainer.hidden = false;
      iconContainer.append(img);
    } else {
      iconContainer.hidden = true;
    }
  }

  if (towerTabState.towerUpgradeElements.baseEquation) {
    renderTowerUpgradeEquationParts(baseEquationText, blueprint, {
      markDeparted: towerTabState.towerVariableAnimation.entryPlayed,
    });
  }

  const values = {};
  (blueprint.variables || []).forEach((variable) => {
    values[variable.key] = computeTowerVariableValue(towerId, variable.key, blueprint);
  });

  let result = 0;
  if (typeof blueprint.computeResult === 'function') {
    result = blueprint.computeResult(values, { definition });
  }
  if (!Number.isFinite(result)) {
    result = 0;
  }

  if (towerTabState.towerUpgradeElements.goldenEquation) {
    const mathSymbol = blueprint.mathSymbol || definition.symbol || towerId;
    const formatVariable = (key) => formatTowerVariableValue(getBlueprintVariable(blueprint, key), values[key]);
    const formatResult = () => formatTowerEquationResultValue(result);
    const goldenEquation =
      typeof blueprint.formatGoldenEquation === 'function'
        ? blueprint.formatGoldenEquation({
            symbol: mathSymbol,
            values,
            result,
            formatVariable,
            formatResult,
          })
        : `\\( ${mathSymbol} = ${formatVariable('damage')} \\times ${formatVariable('rate')} = ${formatResult()} \\)`;
    towerTabState.towerUpgradeElements.goldenEquation.textContent = goldenEquation;
    renderMathElement(towerTabState.towerUpgradeElements.goldenEquation);
  }

  renderTowerUpgradeVariables(towerId, blueprint, values);
  refreshTowerVariableAnimationState(towerId, blueprint);
  updateTowerUpgradeGlyphDisplay();
}

// Cancel any queued hide operations so the overlay can be shown immediately again.
function cancelTowerUpgradeOverlayHide() {
  const { overlay, hideTimeoutId, hideTransitionHandler } = towerTabState.towerUpgradeElements;
  if (typeof window !== 'undefined' && typeof hideTimeoutId === 'number') {
    window.clearTimeout(hideTimeoutId);
  }
  towerTabState.towerUpgradeElements.hideTimeoutId = null;
  if (overlay && typeof hideTransitionHandler === 'function') {
    overlay.removeEventListener('transitionend', hideTransitionHandler);
  }
  towerTabState.towerUpgradeElements.hideTransitionHandler = null;
}

// Reveal the overlay by removing the hidden state before activating its transition.
function showTowerUpgradeOverlayElement(overlay) {
  if (!overlay) {
    return;
  }
  cancelTowerUpgradeOverlayHide();
  overlay.removeAttribute('hidden');
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  } else {
    overlay.classList.add('active');
  }
}

// Schedule the overlay to hide after its fade transition completes.
function scheduleTowerUpgradeOverlayHide(overlay) {
  if (!overlay) {
    return;
  }
  cancelTowerUpgradeOverlayHide();
  overlay.setAttribute('aria-hidden', 'true');

  const finalizeHide = () => {
    cancelTowerUpgradeOverlayHide();
    overlay.hidden = true;
    overlay.setAttribute('hidden', '');
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== overlay) {
      return;
    }
    finalizeHide();
  };

  towerTabState.towerUpgradeElements.hideTransitionHandler = handleTransitionEnd;
  overlay.addEventListener('transitionend', handleTransitionEnd);

  if (typeof window !== 'undefined') {
    towerTabState.towerUpgradeElements.hideTimeoutId = window.setTimeout(finalizeHide, 320);
  }

  overlay.classList.remove('active');
}

export function openTowerUpgradeOverlay(towerId, options = {}) {
  const { overlay } = towerTabState.towerUpgradeElements;
  if (!towerId || !overlay) {
    return;
  }
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return;
  }

  const sourceCard = options.sourceCard || null;
  if (sourceCard) {
    const existingEquation = extractTowerCardEquation(sourceCard);
    if (existingEquation) {
      towerTabState.activeTowerUpgradeBaseEquation = existingEquation;
    }
  }

  towerTabState.activeTowerUpgradeId = towerId;
  towerTabState.lastTowerUpgradeTrigger = options.trigger || null;
  // Reveal the overlay first so MathJax can typeset golden equations reliably.
  showTowerUpgradeOverlayElement(overlay);

  renderTowerUpgradeOverlay(towerId, {
    blueprint: options.blueprint,
    baseEquationText: options.baseEquationText,
    animateEntry: true,
  });
  overlay.focus({ preventScroll: true });
  maybePlayTowerVariableEntry();
}

export function closeTowerUpgradeOverlay() {
  const { overlay } = towerTabState.towerUpgradeElements;
  if (!overlay) {
    return;
  }
  if (!overlay.classList.contains('active')) {
    return;
  }

  playTowerVariableFlight('exit').finally(() => {
    scheduleTowerUpgradeOverlayHide(overlay);
  });

  if (towerTabState.lastTowerUpgradeTrigger && typeof towerTabState.lastTowerUpgradeTrigger.focus === 'function') {
    try {
      towerTabState.lastTowerUpgradeTrigger.focus({ preventScroll: true });
    } catch (error) {
      towerTabState.lastTowerUpgradeTrigger.focus();
    }
  }
  towerTabState.lastTowerUpgradeTrigger = null;
  towerTabState.activeTowerUpgradeId = null;
}

export function getTowerUpgradeOverlayElement() {
  return towerTabState.towerUpgradeElements.overlay || null;
}

export function isTowerUpgradeOverlayActive() {
  const overlay = getTowerUpgradeOverlayElement();
  return Boolean(overlay && overlay.classList.contains('active'));
}

export function getActiveTowerUpgradeId() {
  return towerTabState.activeTowerUpgradeId;
}

export function handleTowerVariableUpgrade(towerId, variableKey) {
  const blueprint = getTowerEquationBlueprint(towerId);
  if (!blueprint) {
    return;
  }
  const variable = getBlueprintVariable(blueprint, variableKey);
  if (!variable || variable.upgradable === false) {
    return;
  }

  const state = ensureTowerUpgradeState(towerId, blueprint);
  const currentLevel = state.variables?.[variableKey]?.level || 0;
  const cost = calculateTowerVariableUpgradeCost(variable, currentLevel);
  const normalizedCost = Math.max(1, cost);

  if (towerTabState.glyphCurrency < normalizedCost) {
    setTowerUpgradeNote('Not enough glyphs to reinforce this variable.', 'warning');
    updateTowerUpgradeGlyphDisplay();
    renderTowerUpgradeOverlay(towerId, { blueprint });
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx?.('error');
    }
    return;
  }

  towerTabState.glyphCurrency -= normalizedCost;
  state.variables[variableKey].level = currentLevel + 1;
  invalidateTowerEquationCache();
  setTowerUpgradeNote(
    `Invested ${normalizedCost} ${normalizedCost === 1 ? 'glyph' : 'glyphs'} into ${variable.symbol}.`,
    'success',
  );
  if (towerTabState.audioManager) {
    towerTabState.audioManager.playSfx?.('upgrade');
  }
  renderTowerUpgradeOverlay(towerId, { blueprint });
}

export function handleTowerVariableDowngrade(towerId, variableKey) {
  const blueprint = getTowerEquationBlueprint(towerId);
  if (!blueprint) {
    return;
  }
  const variable = getBlueprintVariable(blueprint, variableKey);
  if (!variable || variable.upgradable === false) {
    return;
  }

  const state = ensureTowerUpgradeState(towerId, blueprint);
  const currentLevel = state.variables?.[variableKey]?.level || 0;

  if (currentLevel <= 0) {
    setTowerUpgradeNote(`No glyphs invested in ${variable.symbol || variable.key} yet.`, 'warning');
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx?.('error');
    }
    renderTowerUpgradeOverlay(towerId, { blueprint });
    return;
  }

  const nextLevel = currentLevel - 1;
  const refundAmount = Math.max(1, calculateTowerVariableUpgradeCost(variable, nextLevel));

  state.variables[variableKey].level = nextLevel;
  towerTabState.glyphCurrency += refundAmount;
  invalidateTowerEquationCache();

  setTowerUpgradeNote(
    `Withdrew ${refundAmount} ${refundAmount === 1 ? 'glyph' : 'glyphs'} from ${variable.symbol || variable.key}.`,
    'success',
  );

  if (towerTabState.audioManager) {
    towerTabState.audioManager.playSfx?.('towerSell');
  }

  renderTowerUpgradeOverlay(towerId, { blueprint });
}

export function bindTowerUpgradeOverlay() {
  const elements = towerTabState.towerUpgradeElements;
  elements.overlay = document.getElementById('tower-upgrade-overlay');
  if (!elements.overlay) {
    return;
  }
  elements.panel = elements.overlay.querySelector('.tower-upgrade-panel');
  elements.close = elements.overlay.querySelector('[data-tower-upgrade-close]');
  elements.title = document.getElementById('tower-upgrade-title');
  elements.tier = document.getElementById('tower-upgrade-tier');
  elements.glyphs = document.getElementById('tower-upgrade-glyphs');
  elements.baseEquation = document.getElementById('tower-upgrade-base');
  elements.goldenEquation = document.getElementById('tower-upgrade-golden');
  elements.variables = document.getElementById('tower-upgrade-variables');
  elements.note = document.getElementById('tower-upgrade-note');
  elements.icon = document.getElementById('tower-upgrade-icon');

  if (!elements.overlay.hasAttribute('tabindex')) {
    elements.overlay.setAttribute('tabindex', '-1');
  }

  if (elements.close) {
    elements.close.addEventListener('click', () => {
      closeTowerUpgradeOverlay();
    });
  }

  elements.overlay.addEventListener('click', (event) => {
    if (event.target === elements.overlay) {
      closeTowerUpgradeOverlay();
    }
  });
}

export function bindTowerCardUpgradeInteractions() {
  const cards = document.querySelectorAll('[data-tower-id]');
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
  const cards = document.querySelectorAll('[data-tower-id]');
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
  const cards = document.querySelectorAll('[data-tower-id]');
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
    const labelBase = definition ? `${definition.symbol} ${definition.name}`.trim() : towerId;
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

export function annotateTowerCardsWithCost() {
  const cards = document.querySelectorAll('[data-tower-id]');
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
  if (towerTabState.playfield) {
    towerTabState.playfield.setAvailableTowers(towerTabState.loadoutState.selected);
  }
  renderTowerLoadout();
  updateTowerSelectionButtons();
}
