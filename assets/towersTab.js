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
    baseEquationValues: null,
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
  dynamicContext: null,
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
  return {
    id,
    type,
    x,
    y,
    range: Number.isFinite(range) && range > 0 ? range : 0,
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

  return {
    towerId: target.id,
    towerType: target.type || null,
    counts,
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

const TOWER_EQUATION_BLUEPRINTS = {
  // Model the Mind Gate's two glyph conduits so it can accept upgrades directly.
  'mind-gate': {
    mathSymbol: String.raw`\wp`,
    baseEquation: String.raw`\( \wp = \text{Life} \times \text{Regeneration} \)`,
    variables: [
      {
        key: 'life',
        symbol: 'ℵ₁',
        name: 'ℵ₁ Life Reservoir',
        description: 'Glyph lifeforce braided into the Mind Gate core.',
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} ℵ₁`,
        cost: (level) => Math.max(1, 1 + level),
        getSubEquations({ level, value }) {
          const invested = Math.max(0, Number.isFinite(level) ? level : 0);
          const rank = Math.max(1, Number.isFinite(value) ? value : 1);
          return [
            {
              expression: String.raw`\( \text{Life} \rightarrow 100^{\aleph_{1} / \aleph_{2}} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(rank)} = 1 + ${formatWholeNumber(invested)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'recovery',
        symbol: 'ℵ₂',
        name: 'ℵ₂ Recovery Surge',
        description: 'Restorative glyph cadence that rethreads the gate between waves.',
        baseValue: 2,
        step: 1,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} ℵ₂`,
        cost: (level) => Math.max(1, 2 + level),
        getSubEquations({ level, value }) {
          const invested = Math.max(0, Number.isFinite(level) ? level : 0);
          const rank = Math.max(1, Number.isFinite(value) ? value : 2);
          return [
            {
              expression: String.raw`\( \text{Regeneration} \rightarrow \frac{100 \times \aleph_{2}}{\aleph_{1}} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(rank)} = 2 + ${formatWholeNumber(invested)} \)`,
              variant: 'values',
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const life = Math.max(1, Number.isFinite(values.life) ? values.life : 1);
      const recovery = Math.max(1, Number.isFinite(values.recovery) ? values.recovery : 1);
      return life * recovery;
    },
    formatGoldenEquation({ formatVariable, formatResult }) {
      return String.raw`\( ${formatResult()} = ${formatVariable('life')} \times ${formatVariable('recovery')} \)`;
    },
  },
  alpha: {
    mathSymbol: String.raw`\alpha`,
    baseEquation: 'α = Attack × Speed',
    variables: [
      {
        key: 'atk',
        symbol: 'A',
        equationSymbol: 'Attack',
        name: 'Attack',
        description: 'Projectile damage carried by each glyph bullet.',
        baseValue: 5,
        step: 5,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} Attack`,
        cost: (level) => Math.max(1, 1 + level),
        getSubEquations({ level, value }) {
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const attackValue = Number.isFinite(value) ? value : 0;
          return [
            {
              expression: String.raw`\( \text{Attack} = 5 \times \aleph_{1} \)`,
              values: String.raw`\( ${formatWholeNumber(attackValue)} = 5 \times ${formatWholeNumber(glyphRank)} \)`,
            },
          ];
        },
      },
      {
        key: 'speed',
        symbol: 'S',
        equationSymbol: 'Speed',
        name: 'Speed',
        description: 'Oscillation cadence braided from the second glyph conduit.',
        baseValue: 0.5,
        step: 0.5,
        upgradable: true,
        format: (value) => `${formatDecimal(value, 2)} speed`,
        getSubEquations({ level, value }) {
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const speedValue = Number.isFinite(value) ? value : glyphRank * 0.5;
          return [
            {
              expression: String.raw`\( \text{Speed} = 0.5 \times \aleph_{2} \)`,
              values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 \times ${formatDecimal(glyphRank, 2)} \)`,
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      return attack * speed;
    },
    formatBaseEquationValues({ values, result, formatComponent }) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)}`;
    },
  },
  beta: {
    mathSymbol: String.raw`\beta`,
    baseEquation: 'β = Attack × Speed × Range',
    variables: [
      {
        key: 'attack',
        symbol: 'A',
        equationSymbol: 'Attack',
        name: 'Attack',
        description: 'Direct strike power mirrored from α.',
        upgradable: true,
        format: (value) => `${formatGameNumber(value)} attack`,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const state = ensureTowerUpgradeState(towerId, effectiveBlueprint);
          const level = state.variables?.attack?.level || 0;
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const alphaValue = calculateTowerEquationResult('alpha');
          return alphaValue * glyphRank;
        },
        getSubEquations({ level }) {
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const alphaValue = calculateTowerEquationResult('alpha');
          const attackValue = alphaValue * glyphRank;
          return [
            {
              expression: String.raw`\( \text{Attack} = \alpha \times \aleph_{1} \)`,
              values: String.raw`\( ${formatDecimal(attackValue, 2)} = ${formatDecimal(alphaValue, 2)} \times ${formatWholeNumber(glyphRank)} \)`,
            },
          ];
        },
      },
      {
        key: 'speed',
        symbol: 'S',
        equationSymbol: 'Speed',
        name: 'Speed',
        description: 'Cadence accelerated by neighbouring α lattices.',
        upgradable: false,
        lockedNote: 'Connect α lattices to accelerate β cadence.',
        computeValue() {
          const alphaConnections = getDynamicConnectionCount('alpha');
          return 0.5 + 1.5 * alphaConnections;
        },
        format: (value) => `${formatDecimal(value, 2)} speed`,
        getSubEquations() {
          const alphaConnections = getDynamicConnectionCount('alpha');
          const speedValue = 0.5 + 1.5 * alphaConnections;
          return [
            {
              expression: String.raw`\( \text{Speed} = 0.5 + 1.5 \left( {\color{#8fd2ff}{\alpha_{\beta}}} \right) \)`,
              values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 + 1.5 \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
            },
          ];
        },
      },
      {
        key: 'range',
        symbol: 'R',
        equationSymbol: 'Range',
        name: 'Range',
        description: 'Coverage extended by α lattice entanglement.',
        upgradable: false,
        lockedNote: 'Entangle α lattices to extend β reach.',
        computeValue() {
          return getDynamicConnectionCount('alpha');
        },
        format: (value) => `${formatDecimal(value, 2)} range`,
        getSubEquations() {
          const alphaConnections = getDynamicConnectionCount('alpha');
          return [
            {
              expression: String.raw`\( \text{Range} = 1 \times \left( {\color{#8fd2ff}{\alpha_{\beta}}} \right) \)`,
              values: String.raw`\( ${formatDecimal(alphaConnections, 2)} = 1 \times \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      const range = Number.isFinite(values.range) ? values.range : 0;
      return attack * speed * range;
    },
    formatBaseEquationValues({ values, result, formatComponent }) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      const range = Number.isFinite(values.range) ? values.range : 0;
      return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)} × ${formatComponent(range)}`;
    },
  },
  gamma: {
    mathSymbol: String.raw`\gamma`,
    baseEquation: 'γ = Attack × Speed × Range × Pierce',
    variables: [
      {
        key: 'attack',
        symbol: 'A',
        equationSymbol: 'Attack',
        name: 'Attack',
        description: 'Strike intensity carried forward from β.',
        upgradable: true,
        format: (value) => `${formatGameNumber(value)} attack`,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const state = ensureTowerUpgradeState(towerId, effectiveBlueprint);
          const level = state.variables?.attack?.level || 0;
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const betaValue = calculateTowerEquationResult('beta');
          return betaValue * glyphRank;
        },
        getSubEquations({ level }) {
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const betaValue = calculateTowerEquationResult('beta');
          const attackValue = betaValue * glyphRank;
          return [
            {
              expression: String.raw`\( \text{Attack} = \beta \times \aleph_{1} \)`,
              values: String.raw`\( ${formatDecimal(attackValue, 2)} = ${formatDecimal(betaValue, 2)} \times ${formatWholeNumber(glyphRank)} \)`,
            },
          ];
        },
      },
      {
        key: 'speed',
        symbol: 'S',
        equationSymbol: 'Speed',
        name: 'Speed',
        description: 'Cadence tuned by neighbouring α lattices.',
        upgradable: false,
        lockedNote: 'Link α lattices to accelerate γ cadence.',
        computeValue() {
          const alphaConnections = getDynamicConnectionCount('alpha');
          return 0.5 + 0.25 * alphaConnections;
        },
        format: (value) => `${formatDecimal(value, 2)} speed`,
        getSubEquations() {
          const alphaConnections = getDynamicConnectionCount('alpha');
          const speedValue = 0.5 + 0.25 * alphaConnections;
          return [
            {
              expression: String.raw`\( \text{Speed} = 0.5 + 0.25 \left( {\color{#8fd2ff}{\alpha_{\gamma}}} \right) \)`,
              values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 + 0.25 \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
            },
          ];
        },
      },
      {
        key: 'range',
        symbol: 'R',
        equationSymbol: 'Range',
        name: 'Range',
        description: 'Arc reach extended by neighbouring β conductors.',
        upgradable: false,
        lockedNote: 'Bind β lattices to extend γ reach.',
        computeValue() {
          const betaConnections = getDynamicConnectionCount('beta');
          return 1 + 2 * betaConnections;
        },
        format: (value) => `${formatDecimal(value, 2)} range`,
        getSubEquations() {
          const betaConnections = getDynamicConnectionCount('beta');
          const rangeValue = 1 + 2 * betaConnections;
          return [
            {
              expression: String.raw`\( \text{Range} = 1 + 2 \left( {\color{#8fd2ff}{\beta_{\gamma}}} \right) \)`,
              values: String.raw`\( ${formatDecimal(rangeValue, 2)} = 1 + 2 \left( ${formatWholeNumber(betaConnections)} \right) \)`,
            },
          ];
        },
      },
      {
        key: 'pierce',
        symbol: 'P',
        equationSymbol: 'Pierce',
        name: 'Pierce',
        description: 'Piercing depth braided from the second glyph conduit.',
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => `${formatWholeNumber(value)} pierce`,
        getSubEquations({ level, value }) {
          const glyphRank = deriveGlyphRankFromLevel(level, 1);
          const pierceValue = Number.isFinite(value) ? value : glyphRank;
          return [
            {
              expression: String.raw`\( \text{Pierce} = \aleph_{2} \)`,
              values: String.raw`\( ${formatWholeNumber(pierceValue)} = ${formatWholeNumber(glyphRank)} \)`,
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      const range = Number.isFinite(values.range) ? values.range : 0;
      const pierce = Number.isFinite(values.pierce) ? values.pierce : 0;
      return attack * speed * range * pierce;
    },
    formatBaseEquationValues({ values, result, formatComponent }) {
      const attack = Number.isFinite(values.attack) ? values.attack : 0;
      const speed = Number.isFinite(values.speed) ? values.speed : 0;
      const range = Number.isFinite(values.range) ? values.range : 0;
      const pierce = Number.isFinite(values.pierce) ? values.pierce : 0;
      return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)} × ${formatComponent(range)} × ${formatComponent(pierce)}`;
    },
  },
  delta: {
    mathSymbol: String.raw`\delta`,
    baseEquation: String.raw`\( \delta = \gamma \cdot \ln(\gamma + 1) \)`,
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
  // η tower channels synchronized orbital upgrades that determine laser cadence,
  // alignment thresholds, and range when planets line up.
  eta: {
    mathSymbol: String.raw`\eta`,
    baseEquation: String.raw`\( \text{Eta} = \dots \)`,
    variables: [
      {
        key: 'atk',
        symbol: 'Atk',
        equationSymbol: 'Atk',
        name: 'Atk',
        description: null,
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
          const aleph1 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint),
          );
          const critical = Math.max(
            0,
            computeTowerVariableValue(towerId, 'crt', effectiveBlueprint),
          );
          const base = Math.max(0, gammaValue * aleph1);
          const attack = critical === 0 ? 1 : base ** critical;
          return Number.isFinite(attack) ? attack : 0;
        },
        format: (value) => formatGameNumber(Math.max(0, value)),
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
          const aleph1 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint),
          );
          const critical = Math.max(
            0,
            computeTowerVariableValue(towerId, 'crt', effectiveBlueprint),
          );
          const base = Math.max(0, gammaValue * aleph1);
          const attack = critical === 0 ? 1 : base ** critical;
          return [
            {
              expression: String.raw`\( \text{Atk} = (\Gamma \cdot \aleph_{1})^{\text{Crt}} \)`,
            },
            {
              values: String.raw`\( ${formatGameNumber(attack)} = (${formatDecimal(
                gammaValue,
                2,
              )} \cdot ${formatWholeNumber(aleph1)})^{${formatDecimal(critical, 2)}} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph1',
        symbol: 'ℵ₁',
        equationSymbol: 'ℵ₁',
        name: 'Aleph₁',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        attachedToVariable: 'atk',
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{1} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'crt',
        symbol: 'Crt',
        equationSymbol: 'Crt',
        name: 'Crt',
        description: null,
        baseValue: 1,
        upgradable: false,
        format: (value) => formatDecimal(Math.max(0, value), 2),
        getSubEquations() {
          return [
            {
              expression: String.raw`\( \text{Crt} = \text{OrbitAlign} - 1 \)`,
            },
          ];
        },
      },
      {
        key: 'totRing',
        symbol: 'TotRing',
        equationSymbol: 'TotRing',
        name: 'TotRing',
        description: null,
        baseValue: 2,
        upgradable: false,
        format: (value) => formatWholeNumber(Math.max(0, value)),
        getSubEquations() {
          return [
            {
              expression: String.raw`\( \text{TotRing} = 2 + \eta' \)`,
            },
          ];
        },
      },
      {
        key: 'totOrb',
        symbol: 'TotOrb',
        equationSymbol: 'TotOrb',
        name: 'TotOrb',
        description: null,
        baseValue: 1,
        upgradable: false,
        format: (value) => formatWholeNumber(Math.max(0, value)),
        getSubEquations() {
          return [
            {
              expression: String.raw`\( \text{TotOrb} = \frac{n_{\text{Ring}} (n_{\text{Ring}} - 1)}{2} + 1 \)`,
            },
          ];
        },
      },
      {
        key: 'spdRing',
        symbol: 'SpdRing',
        equationSymbol: 'SpdRing',
        name: 'SpdRing',
        description: null,
        baseValue: 0,
        upgradable: false,
        format: () => '',
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph2 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint),
          );
          const aleph3 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint),
          );
          const aleph4 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint),
          );
          const aleph5 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint),
          );
          const denominator = aleph2 + aleph3 + aleph4 + aleph5;
          const values = [
            {
              expression: String.raw`\( \text{SpdRing1} = \frac{1}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5}} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(1 / denominator, 3)} = \frac{1}{${formatWholeNumber(
                aleph2,
              )} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(aleph4)} + ${formatWholeNumber(
                aleph5,
              )}} \)`,
              variant: 'values',
            },
            {
              expression: String.raw`\( \text{SpdRing2} = \frac{1 + \aleph_{2}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5}} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal((1 + aleph2) / denominator, 3)} = \frac{1 + ${formatWholeNumber(
                aleph2,
              )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
                aleph4,
              )} + ${formatWholeNumber(aleph5)}} \)`,
              variant: 'values',
            },
            {
              expression: String.raw`\( \text{SpdRing3} = \frac{1 + 2 \cdot \aleph_{3}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5}} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal((1 + 2 * aleph3) / denominator, 3)} = \frac{1 + 2 \cdot ${formatWholeNumber(
                aleph3,
              )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
                aleph4,
              )} + ${formatWholeNumber(aleph5)}} \)`,
              variant: 'values',
            },
            {
              expression: String.raw`\( \text{SpdRing4} = \frac{2 + 3 \cdot \aleph_{4}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5}} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal((2 + 3 * aleph4) / denominator, 3)} = \frac{2 + 3 \cdot ${formatWholeNumber(
                aleph4,
              )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
                aleph4,
              )} + ${formatWholeNumber(aleph5)}} \)`,
              variant: 'values',
            },
            {
              expression: String.raw`\( \text{SpdRing5} = \frac{1 + 2^{\aleph_{5}}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5}} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal((1 + 2 ** aleph5) / denominator, 3)} = \frac{1 + 2^{${formatWholeNumber(
                aleph5,
              )}}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
                aleph4,
              )} + ${formatWholeNumber(aleph5)}} \)`,
              variant: 'values',
            },
          ];
          return values;
        },
      },
      {
        key: 'aleph2',
        symbol: 'Aleph2',
        equationSymbol: 'Aleph2',
        name: 'Aleph2',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{2} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph3',
        symbol: 'Aleph3',
        equationSymbol: 'Aleph3',
        name: 'Aleph3',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{3} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph4',
        symbol: 'Aleph4',
        equationSymbol: 'Aleph4',
        name: 'Aleph4',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{4} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph5',
        symbol: 'Aleph5',
        equationSymbol: 'Aleph5',
        name: 'Aleph5',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{5} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'rng',
        symbol: 'Rng',
        equationSymbol: 'Rng',
        name: 'Rng',
        description: null,
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph6 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint),
          );
          const clamped = Math.min(5, aleph6);
          return 5 + clamped;
        },
        format: (value) => formatDecimal(Math.max(0, value), 2),
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph6 = Math.max(
            1,
            computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint),
          );
          const clamped = Math.min(5, aleph6);
          const total = 5 + clamped;
          return [
            {
              expression: String.raw`\( \text{Rng} = 5 + \aleph_{6} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(total, 2)} = 5 + ${formatDecimal(clamped, 2)} \)`,
              variant: 'values',
            },
            {
              expression: String.raw`\( \aleph_{6} \leq 5 \)`,
            },
          ];
        },
      },
      {
        key: 'aleph6',
        symbol: 'Aleph6',
        equationSymbol: 'Aleph6',
        name: 'Aleph6',
        description: null,
        baseValue: 1,
        step: 1,
        upgradable: true,
        maxLevel: 4,
        format: (value) => formatWholeNumber(Math.max(1, value)),
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{6} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      return attack;
    },
    formatGoldenEquation() {
      return String.raw`\( \text{Eta} = \dots \)`;
    },
  },
  // ζ tower channels a double-pendulum equation that references multiple Aleph
  // upgrade threads to determine attack, speed, range, and pendulum count.
  zeta: {
    mathSymbol: String.raw`\zeta`,
    baseEquation: String.raw`\( \zeta = \text{Atk} \times \text{Crt} \times \text{Spd} \times \text{Rng} \times \text{Tot} \)`,
    variables: [
      {
        key: 'aleph1',
        symbol: 'ℵ₁',
        equationSymbol: 'ℵ₁',
        name: 'Aleph₁ Focus',
        description: 'Amplifies ζ’s base damage by threading additional glyph focus.',
        baseValue: 1,
        step: 1,
        upgradable: true,
        attachedToVariable: 'atk',
        format: (value) => `${formatWholeNumber(value)} focus`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank;
          return [
            {
              expression: String.raw`\( \aleph_{1} = 1 + \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph2',
        symbol: 'ℵ₂',
        equationSymbol: 'ℵ₂',
        name: 'Aleph₂ Velocity',
        description: 'Determines revolutions per second for each pendulum tier.',
        baseValue: 0,
        step: 1,
        upgradable: true,
        attachedToVariable: 'spd',
        format: (value) => `${formatWholeNumber(Math.max(0, value))} tempo`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : rank;
          return [
            {
              expression: String.raw`\( \aleph_{2} = \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph3',
        symbol: 'ℵ₃',
        equationSymbol: 'ℵ₃',
        name: 'Aleph₃ Radius',
        description: 'Extends the arm length for the cascading pendulum links.',
        baseValue: 0,
        step: 1,
        upgradable: true,
        maxLevel: 3,
        attachedToVariable: 'rng',
        format: (value) => `${formatWholeNumber(Math.max(0, value))} reach`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : rank;
          return [
            {
              expression: String.raw`\( \aleph_{3} = \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph4',
        symbol: 'ℵ₄',
        equationSymbol: 'ℵ₄',
        name: 'Aleph₄ Cascade',
        description: 'Unlocks additional pendulums trailing from ζ’s core.',
        baseValue: 0,
        step: 1,
        upgradable: true,
        maxLevel: 2,
        attachedToVariable: 'tot',
        cost: (level) => {
          if (level === 0) {
            return 10;
          }
          if (level === 1) {
            return 10;
          }
          return Infinity;
        },
        format: (value) => `${formatWholeNumber(Math.max(0, value))} links`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : rank;
          return [
            {
              expression: String.raw`\( \aleph_{4} = \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph5',
        symbol: 'ℵ₅',
        equationSymbol: 'ℵ₅',
        name: 'Aleph₅ Spark',
        description: 'Feeds critical light into the pendulum strike zone.',
        baseValue: 1,
        step: 0.5,
        upgradable: true,
        attachedToVariable: 'crt',
        format: (value) => `×${formatDecimal(Math.max(0, value), 2)}`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank * 0.5;
          return [
            {
              expression: String.raw`\( \aleph_{5} = 1 + 0.5 \times \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(resolved, 2)} = 1 + 0.5 \times ${formatDecimal(rank, 2)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'aleph6',
        symbol: 'ℵ₆',
        equationSymbol: 'ℵ₆',
        name: 'Aleph₆ Lens',
        description: 'Focuses the pendulum heads for sharper critical impacts.',
        baseValue: 1,
        step: 0.5,
        upgradable: true,
        attachedToVariable: 'crt',
        format: (value) => `×${formatDecimal(Math.max(0, value), 2)}`,
        getSubEquations({ level, value }) {
          const rank = Math.max(0, Number.isFinite(level) ? level : 0);
          const resolved = Number.isFinite(value) ? value : 1 + rank * 0.5;
          return [
            {
              expression: String.raw`\( \aleph_{6} = 1 + 0.5 \times \text{Level} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(resolved, 2)} = 1 + 0.5 \times ${formatDecimal(rank, 2)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'crt',
        symbol: 'Crt',
        equationSymbol: 'Crt',
        name: 'Critical Multiplier',
        description: 'Applies when a pendulum head collides directly with an enemy.',
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph5 = computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint);
          const aleph6 = computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint);
          const product = Math.max(1, aleph5 * aleph6);
          return Number.isFinite(product) ? product : 1;
        },
        format: (value) => `×${formatDecimal(Math.max(1, value), 2)}`,
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph5 = computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint);
          const aleph6 = computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint);
          const product = Math.max(1, aleph5 * aleph6);
          return [
            {
              expression: String.raw`\( \text{Crt} = \aleph_{5} \times \aleph_{6} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(product, 2)} = ${formatDecimal(aleph5, 2)} \times ${formatDecimal(aleph6, 2)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'atk',
        symbol: 'Atk',
        equationSymbol: 'Atk',
        name: 'Attack',
        description: 'Critical strike output woven from γ, ℵ₁, and the Crt multiplier.',
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
          const aleph1 = Math.max(1, computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
          const critical = Math.max(1, computeTowerVariableValue(towerId, 'crt', effectiveBlueprint));
          const attack = gammaValue * critical * aleph1;
          return Number.isFinite(attack) ? attack : 0;
        },
        format: (value) => `${formatGameNumber(Math.max(0, value))} attack`,
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
          const aleph1 = Math.max(1, computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
          const critical = Math.max(1, computeTowerVariableValue(towerId, 'crt', effectiveBlueprint));
          const base = gammaValue * critical;
          const attack = base * aleph1;
          return [
            {
              expression: String.raw`\( \text{Atk} = \Gamma \times \text{Crt} \times \aleph_{1} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(attack, 2)} = ${formatDecimal(gammaValue, 2)} \times ${formatDecimal(critical, 2)} \times ${formatDecimal(aleph1, 2)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'spd',
        symbol: 'Spd',
        equationSymbol: 'Spd',
        name: 'Speed',
        description: 'Revolutions per second of the lead pendulum.',
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph2 = Math.max(0, computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
          const raw = 0.25 + 0.25 * aleph2;
          const clamped = Math.min(7, Math.max(0.25, raw));
          return Number.isFinite(clamped) ? clamped : 0.25;
        },
        format: (value) => `${formatDecimal(Math.max(0, value), 2)} rps`,
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph2 = Math.max(0, computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
          const raw = 0.25 + 0.25 * aleph2;
          const clamped = Math.min(7, Math.max(0.25, raw));
          return [
            {
              expression: String.raw`\( \text{Spd} = \min(7,\; 0.25 + 0.25 \times \aleph_{2}) \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(clamped, 2)} = \min(7,\; 0.25 + 0.25 \times ${formatDecimal(aleph2, 2)}) \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'rng',
        symbol: 'Rng',
        equationSymbol: 'Rng',
        name: 'Range',
        description: 'Normalized arm length shared by each pendulum tier.',
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph3 = Math.max(0, computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
          const result = 1.5 + 0.5 * aleph3;
          return Number.isFinite(result) ? result : 1.5;
        },
        format: (value) => `${formatDecimal(Math.max(0, value), 2)} units`,
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph3 = Math.max(0, computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
          const result = 1.5 + 0.5 * aleph3;
          return [
            {
              expression: String.raw`\( \text{Rng} = 1.5 + 0.5 \times \aleph_{3} \)`,
            },
            {
              values: String.raw`\( ${formatDecimal(result, 2)} = 1.5 + 0.5 \times ${formatDecimal(aleph3, 2)} \)`,
              variant: 'values',
            },
          ];
        },
      },
      {
        key: 'tot',
        symbol: 'Tot',
        equationSymbol: 'Tot',
        name: 'Total Pendulums',
        description: 'Number of cascading pendulums orbiting ζ.',
        upgradable: false,
        computeValue({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph4 = Math.max(0, computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint));
          const clampedAleph4 = Math.min(2, aleph4);
          const total = 2 + clampedAleph4;
          return Number.isFinite(total) ? total : 2;
        },
        format: (value) => `${formatWholeNumber(Math.max(2, Math.round(value)))} pendulums`,
        getSubEquations({ blueprint, towerId }) {
          const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
          const aleph4 = Math.max(0, computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint));
          const clampedAleph4 = Math.min(2, aleph4);
          const total = 2 + clampedAleph4;
          return [
            {
              expression: String.raw`\( \text{Tot} = 2 + \aleph_{4} \)`,
            },
            {
              values: String.raw`\( ${formatWholeNumber(total)} = 2 + ${formatWholeNumber(clampedAleph4)} \)`,
              variant: 'values',
            },
          ];
        },
      },
    ],
    computeResult(values) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      const critical = Number.isFinite(values.crt) ? values.crt : 1;
      const speed = Number.isFinite(values.spd) ? values.spd : 0;
      const range = Number.isFinite(values.rng) ? values.rng : 0;
      const total = Number.isFinite(values.tot) ? values.tot : 0;
      return attack * critical * speed * range * total;
    },
    formatBaseEquationValues({ values, result, formatComponent }) {
      const attack = Number.isFinite(values.atk) ? values.atk : 0;
      const critical = Number.isFinite(values.crt) ? values.crt : 1;
      const speed = Number.isFinite(values.spd) ? values.spd : 0;
      const range = Number.isFinite(values.rng) ? values.rng : 0;
      const total = Number.isFinite(values.tot) ? values.tot : 0;
      return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(critical)} × ${formatComponent(speed)} × ${formatComponent(range)} × ${formatComponent(total)}`;
    },
  },
  omicron: {
    mathSymbol: 'ο',
    baseEquation: String.raw`\( ο = \ln(ξ + 1) \)`,
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
    mathSymbol: String.raw`\pi`,
    baseEquation: String.raw`\( \pi = ο^{2} \)`,
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

const DYNAMIC_EQUATION_PATTERN = /([α-ω]_[α-ω])/gu;
const DYNAMIC_VARIABLE_TOKEN = /^[α-ω]_[α-ω]$/u;

function appendEquationText(target, text) {
  if (!target) {
    return;
  }
  const segments = String(text ?? '').split(DYNAMIC_EQUATION_PATTERN);
  segments.forEach((segment) => {
    if (!segment) {
      return;
    }
    if (DYNAMIC_VARIABLE_TOKEN.test(segment)) {
      const dynamic = document.createElement('span');
      dynamic.classList.add('tower-upgrade-formula-part--dynamic', 'dynamic-variable');
      dynamic.textContent = segment;
      target.append(dynamic);
    } else {
      target.append(document.createTextNode(segment));
    }
  });
}

function appendEquationVariable(target, label) {
  if (!target) {
    return;
  }
  const text = typeof label === 'string' && label.trim() ? label.trim() : '';
  if (!text) {
    appendEquationText(target, label);
    return;
  }
  const [firstChar, ...restChars] = Array.from(text);
  appendEquationText(target, firstChar);
  if (restChars.length) {
    const tail = document.createElement('span');
    tail.className = 'tower-upgrade-formula-part-tail';
    appendEquationText(tail, restChars.join(''));
    target.append(tail);
  }
}

function renderTowerUpgradeEquationParts(baseEquationText, blueprint, options = {}) {
  const baseEquationEl = towerTabState.towerUpgradeElements.baseEquation;
  if (!baseEquationEl) {
    return;
  }
  const markDeparted = options.markDeparted === true;
  const resolvedEquation = convertMathExpressionToPlainText(baseEquationText) || baseEquationText || '';
  baseEquationEl.innerHTML = '';

  const blueprintVariables = Array.isArray(blueprint?.variables) ? blueprint.variables : [];
  const tokens = tokenizeEquationParts(
    resolvedEquation,
    blueprintVariables.map((variable) => ({
      key: variable.key,
      symbol: variable.equationSymbol || variable.symbol || variable.key.toUpperCase(),
    })),
  );

  const fragment = document.createDocumentFragment();
  const spanMap = new Map();

  tokens.forEach((token) => {
    const span = document.createElement('span');
    span.className = 'tower-upgrade-formula-part';
    span.textContent = '';

    if (token.variableKey) {
      span.dataset.variable = token.variableKey;
      span.classList.add('tower-upgrade-formula-part--variable');
      const variable = getBlueprintVariable(blueprint, token.variableKey);
      if (!spanMap.has(token.variableKey)) {
        spanMap.set(token.variableKey, []);
      }
      spanMap.get(token.variableKey).push(span);
      if (markDeparted) {
        span.classList.add('is-departed');
      }
      if (variable && typeof variable.equationSymbol === 'string') {
        appendEquationVariable(span, variable.equationSymbol);
      } else {
        appendEquationText(span, token.text);
      }
    } else {
      appendEquationText(span, token.text);
    }

    fragment.append(span);
  });

  if (!tokens.length) {
    const fallback = document.createElement('span');
    fallback.className = 'tower-upgrade-formula-part';
    appendEquationText(fallback, resolvedEquation);
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
      if (typeof entry.text === 'string' && entry.text.trim()) {
        lines.push({ text: entry.text.trim(), variant: entry.variant === 'values' ? 'values' : 'expression' });
      }
      if (typeof entry.expression === 'string' && entry.expression.trim()) {
        lines.push({ text: entry.expression.trim(), variant: 'expression' });
      }
      if (typeof entry.values === 'string' && entry.values.trim()) {
        lines.push({ text: entry.values.trim(), variant: 'values' });
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
  const attachmentMap = new Map();

  blueprintVariables.forEach((variable) => {
    const parentKey =
      typeof variable.attachedToVariable === 'string' && variable.attachedToVariable.trim()
        ? variable.attachedToVariable.trim()
        : '';
    if (parentKey) {
      if (!attachmentMap.has(parentKey)) {
        attachmentMap.set(parentKey, []);
      }
      attachmentMap.get(parentKey).push(variable);
    }
  });

  blueprintVariables.forEach((variable) => {
    const attachmentParent =
      typeof variable.attachedToVariable === 'string' && variable.attachedToVariable.trim()
        ? variable.attachedToVariable.trim()
        : '';
    if (attachmentParent) {
      return;
    }

    const attachments = attachmentMap.get(variable.key) || [];
    const value = Number.isFinite(values[variable.key]) ? values[variable.key] : 0;
    const level = state.variables?.[variable.key]?.level || 0;

    const item = document.createElement('div');
    item.className = 'tower-upgrade-variable';
    item.setAttribute('role', 'listitem');
    item.dataset.variable = variable.key;
    const hasAttachmentUpgrade = attachments.some((attachment) => attachment.upgradable !== false);
    if (variable.upgradable !== false || hasAttachmentUpgrade) {
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
      dynamicContext: towerTabState.dynamicContext,
    });

    const attachmentDetails = attachments.map((attachment) => {
      const attachmentLevel = state.variables?.[attachment.key]?.level || 0;
      const attachmentValue = Number.isFinite(values[attachment.key]) ? values[attachment.key] : 0;
      const attachmentLines = resolveTowerVariableSubEquations(attachment, {
        level: attachmentLevel,
        value: attachmentValue,
        variable: attachment,
        towerId,
        blueprint,
        values,
        parentVariable: variable,
        formatValue: () => formatTowerVariableValue(attachment, attachmentValue),
        formatWholeNumber,
        formatDecimal,
        formatGameNumber,
        dynamicContext: towerTabState.dynamicContext,
      }).map((entry) => ({ ...entry, attachmentKey: attachment.key }));
      return {
        variable: attachment,
        level: attachmentLevel,
        value: attachmentValue,
        lines: attachmentLines,
      };
    });

    attachmentDetails.forEach((detail) => {
      subEquationLines.push(...detail.lines);
    });

    if (subEquationLines.length) {
      const equations = document.createElement('div');
      equations.className = 'tower-upgrade-variable-equations';
      subEquationLines.forEach((entry) => {
        let text = '';
        let variant = 'expression';
        if (entry && typeof entry === 'object') {
          if (typeof entry.text === 'string') {
            text = entry.text.trim();
            if (entry.variant === 'values') {
              variant = 'values';
            }
          } else if (typeof entry.expression === 'string') {
            text = entry.expression.trim();
          }
          if (!text && typeof entry.values === 'string') {
            text = entry.values.trim();
            variant = 'values';
          }
        } else if (typeof entry === 'string') {
          text = entry.trim();
        }
        if (!text) {
          return;
        }
        const lineEl = document.createElement('p');
        lineEl.className = 'tower-upgrade-variable-equation-line';
        if (variant === 'values') {
          lineEl.classList.add('tower-upgrade-variable-equation-line--values');
        }
        if (entry && typeof entry === 'object' && entry.attachmentKey) {
          lineEl.dataset.attachment = entry.attachmentKey;
          lineEl.classList.add('tower-upgrade-variable-equation-line--attachment');
        }
        lineEl.textContent = text;
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
      const controls = buildVariableGlyphControls(variable, towerId, level);
      footer.append(controls);
    } else if (!attachmentDetails.length) {
      const note = document.createElement('span');
      note.className = 'tower-upgrade-variable-note';
      note.textContent = variable.lockedNote || 'Inherited from allied lattices.';
      footer.append(note);
    }

    if (attachmentDetails.length) {
      const attachmentContainer = document.createElement('div');
      attachmentContainer.className = 'tower-upgrade-variable-attachments';
      attachmentDetails.forEach((detail) => {
        const attachmentVariable = detail.variable;
        const attachmentRow = document.createElement('div');
        attachmentRow.className = 'tower-upgrade-variable-attachment';
        attachmentRow.dataset.attachment = attachmentVariable.key;

        const attachmentLabel = document.createElement('span');
        attachmentLabel.className = 'tower-upgrade-variable-attachment-label';
        attachmentLabel.textContent =
          attachmentVariable.name || attachmentVariable.symbol || attachmentVariable.key.toUpperCase();
        attachmentRow.append(attachmentLabel);

        if (attachmentVariable.upgradable !== false) {
          const attachmentControls = buildVariableGlyphControls(attachmentVariable, towerId, detail.level, {
            asAttachment: true,
          });
          attachmentRow.append(attachmentControls);
        } else {
          const attachmentNote = document.createElement('span');
          attachmentNote.className = 'tower-upgrade-variable-note';
          attachmentNote.textContent =
            attachmentVariable.lockedNote || variable.lockedNote || 'Inherited from allied lattices.';
          attachmentRow.append(attachmentNote);
        }

        attachmentContainer.append(attachmentRow);
      });
      footer.append(attachmentContainer);
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

  if (towerTabState.towerUpgradeElements.baseEquationValues) {
    const baseValuesEl = towerTabState.towerUpgradeElements.baseEquationValues;
    const formatComponent = (value) => {
      if (!Number.isFinite(value)) {
        return '0';
      }
      if (Math.abs(value) >= 1000) {
        return formatGameNumber(value);
      }
      return formatDecimal(value, 2);
    };

    let equationLine = '';
    if (typeof blueprint.formatBaseEquationValues === 'function') {
      try {
        equationLine = blueprint.formatBaseEquationValues({
          values,
          result,
          formatComponent,
        });
      } catch (error) {
        console.warn('Failed to format base equation values', error);
      }
    }

    if (typeof equationLine !== 'string' || !equationLine.trim()) {
      const keys = Object.keys(values);
      if (keys.length) {
        const parts = keys.map((key) => formatComponent(values[key]));
        equationLine = `= ${parts.join(' × ')}`;
        if (Number.isFinite(result)) {
          equationLine += ` = ${formatComponent(result)}`;
        }
      } else if (Number.isFinite(result)) {
        equationLine = `= ${formatComponent(result)}`;
      } else {
        equationLine = '';
      }
    }

    baseValuesEl.textContent = equationLine || '';
    renderMathElement(baseValuesEl);
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

  towerTabState.dynamicContext = buildTowerDynamicContext({
    contextTowerId: options.contextTowerId,
    contextTower: options.contextTower,
    contextTowers: options.contextTowers,
  });
  invalidateTowerEquationCache();

  const sourceCard = options.sourceCard || null;
  if (sourceCard) {
    const existingEquation = extractTowerCardEquation(sourceCard);
    if (existingEquation) {
      towerTabState.activeTowerUpgradeBaseEquation = existingEquation;
    }
  }

  towerTabState.activeTowerUpgradeId = towerId;
  towerTabState.lastTowerUpgradeTrigger = options.trigger || null;
  // Reveal the overlay first so MathJax can typeset updated equations reliably.
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
  towerTabState.dynamicContext = null;
  invalidateTowerEquationCache();
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
  // Prevent investing glyphs when the variable already reached its upgrade ceiling.
  const maxLevel = Number.isFinite(variable.maxLevel) ? Math.max(0, variable.maxLevel) : null;
  if (maxLevel !== null && currentLevel >= maxLevel) {
    setTowerUpgradeNote('This variable has already reached its maximum rank.', 'warning');
    updateTowerUpgradeGlyphDisplay();
    renderTowerUpgradeOverlay(towerId, { blueprint });
    if (towerTabState.audioManager) {
      towerTabState.audioManager.playSfx?.('error');
    }
    return;
  }
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
  elements.baseEquationValues = document.getElementById('tower-upgrade-base-values');
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
  const placeableSelection = towerTabState.loadoutState.selected.filter((towerId) => isTowerPlaceable(towerId));
  if (towerTabState.playfield) {
    towerTabState.playfield.setAvailableTowers(placeableSelection);
  }
  renderTowerLoadout();
  updateTowerSelectionButtons();
}
