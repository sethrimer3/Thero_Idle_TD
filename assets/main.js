import {
  ALEPH_CHAIN_DEFAULT_UPGRADES,
  createAlephChainRegistry,
} from '../scripts/features/towers/alephChain.js';
import {
  MATH_SYMBOL_REGEX,
  renderMathElement,
  isLikelyMathExpression,
  annotateMathText,
  convertMathExpressionToPlainText,
} from '../scripts/core/mathText.js';
import { tokenizeEquationParts } from '../scripts/core/mathTokens.js';
import {
  BETA_BASE_ATTACK,
  BETA_BASE_ATTACK_SPEED,
  BETA_BASE_RANGE,
  clampBetaExponent,
  calculateBetaAttack,
  calculateBetaAttackSpeed,
  calculateBetaRange,
} from '../scripts/features/towers/betaMath.js';
import {
  formatGameNumber,
  formatWholeNumber,
  formatDecimal,
  formatPercentage,
  formatSignedPercentage,
} from '../scripts/core/formatting.js';
// Powder tower palette and simulation helpers.
import {
  DEFAULT_MOTE_PALETTE,
  POWDER_CELL_SIZE_PX,
  PowderSimulation,
  clampUnitInterval,
  colorToRgbaString,
  computeMotePaletteFromTheme,
  mergeMotePalette,
  resolvePaletteColorStops,
} from '../scripts/features/towers/powderTower.js';
import {
  codexState,
  enemyCodexElements,
  setEnemyCodexEntries,
  getEnemyCodexEntries,
  getEnemyCodexEntry,
  renderEnemyCodex,
  registerEnemyEncounter,
  bindCodexControls,
} from './codex.js';

(() => {
  'use strict';

  const alephChainUpgradeState = { ...ALEPH_CHAIN_DEFAULT_UPGRADES };

  const THERO_SYMBOL = 'þ';
  const COMMUNITY_DISCORD_INVITE = 'https://discord.gg/UzqhfsZQ8n'; // Reserved for future placement.

  function resolveBetaExponent(towerId) {
    const exponentValue = computeTowerVariableValue(towerId, 'exponent');
    return clampBetaExponent(exponentValue);
  }

  const TOWER_EQUATION_BLUEPRINTS = {
    alpha: {
      mathSymbol: '\\alpha',
      baseEquation: '\\( \\alpha = 5X \\cdot YZ \\)',
      variables: [
        {
          key: 'damage',
          symbol: 'X',
          name: 'Attack Power',
          description: 'Projectile damage carried by each glyph bullet.',
          baseValue: 1,
          step: 1,
          upgradable: true,
          format: (value) => `${formatWholeNumber(value)} atk`,
          cost: (level) => Math.max(1, 1 + level),
        },
        {
          key: 'rate',
          symbol: 'Y',
          name: 'Primary Attack Speed',
          description: 'Glyph pulses per second channelled through the lattice.',
          baseValue: 1,
          step: 1,
          upgradable: true,
          format: (value) => `${formatWholeNumber(value)} /s`,
          cost: (level) => Math.max(1, 1 + level),
        },
        {
          key: 'tempo',
          symbol: 'Z',
          name: 'Secondary Attack Speed',
          description: 'Echo pulses per second braided into alpha tempo.',
          baseValue: 1,
          step: 1,
          upgradable: true,
          format: (value) => `${formatWholeNumber(value)} /s`,
          cost: (level) => Math.max(1, 1 + level),
        },
      ],
      computeResult(values) {
        const damage = Number.isFinite(values.damage) ? values.damage : 0;
        const rate = Number.isFinite(values.rate) ? values.rate : 0;
        const tempo = Number.isFinite(values.tempo) ? values.tempo : 0;
        return 5 * damage * rate * tempo;
      },
      formatGoldenEquation({ formatVariable, formatResult }) {
        return `\\( ${formatResult()} = 5 \\times ${formatVariable('damage')} \\times ${formatVariable('rate')} \\times ${formatVariable('tempo')} \\)`;
      },
    },
    beta: {
      mathSymbol: '\\beta',
      baseEquation: `\\( \\beta = ${BETA_BASE_ATTACK}^{X} \\cdot \\frac{${BETA_BASE_ATTACK_SPEED}}{X} \\cdot \\frac{${BETA_BASE_RANGE}}{X} \\)`,
      variables: [
        {
          key: 'exponent',
          symbol: 'X',
          name: 'Exponent Harmonic',
          description: 'Raises β damage exponentially while constricting tempo and reach.',
          baseValue: 1,
          step: 1,
          upgradable: true,
          format: (value) => formatWholeNumber(value),
          cost: (level) => Math.max(1, 2 + level),
        },
        {
          key: 'attackPower',
          symbol: 'A',
          name: 'Attack Power',
          description: `Damage per beam pulse derived from ${BETA_BASE_ATTACK}^{X}.`,
          upgradable: false,
          lockedNote: 'Scales exponentially with X upgrades.',
          format: (value) => `${formatGameNumber(value)} attack`,
          getBase: ({ towerId }) => calculateBetaAttack(resolveBetaExponent(towerId)),
        },
        {
          key: 'attackSpeed',
          symbol: 'S',
          name: 'Attack Speed',
          description: `Beams released per second; divided by X to temper the resonance.`,
          upgradable: false,
          lockedNote: 'Divided by the current exponent.',
          format: (value) => `${formatDecimal(value, 2)} attacks/sec`,
          getBase: ({ towerId }) => calculateBetaAttackSpeed(resolveBetaExponent(towerId)),
        },
        {
          key: 'range',
          symbol: 'Λ',
          name: 'Beam Range',
          description: `Effective reach of the lattice after dividing the base ${BETA_BASE_RANGE}.`,
          upgradable: false,
          lockedNote: 'Shrinks as X grows.',
          format: (value) => `${formatDecimal(value, 2)} range`,
          getBase: ({ towerId }) => calculateBetaRange(resolveBetaExponent(towerId)),
        },
      ],
      computeResult(values) {
        const attackPower = Number.isFinite(values.attackPower) ? values.attackPower : 0;
        const attackSpeed = Number.isFinite(values.attackSpeed) ? values.attackSpeed : 0;
        const range = Number.isFinite(values.range) ? values.range : 0;
        return attackPower * attackSpeed * range;
      },
      formatGoldenEquation({ formatVariable, formatResult }) {
        return `\\( ${formatResult()} = ${formatVariable('attackPower')} \\times ${formatVariable('attackSpeed')} \\times ${formatVariable('range')} \\)`;
      },
    },
    gamma: {
      mathSymbol: '\\gamma',
      baseEquation: '\\( \\gamma = \\alpha^{1/2} \\cdot \\beta \\)',
      variables: [
        {
          key: 'alpha',
          symbol: 'α',
          name: 'Alpha Pulse',
          description: 'Inherited burst cadence from α lattices.',
          reference: 'alpha',
          upgradable: false,
          lockedNote: 'Upgrade α to raise this value.',
          format: (value) => formatDecimal(value, 2),
        },
        {
          key: 'beta',
          symbol: 'β',
          name: 'Beta Resonance',
          description: 'Sustained beam resonance carried forward.',
          reference: 'beta',
          upgradable: false,
          lockedNote: 'Upgrade β to amplify this resonance.',
          format: (value) => formatDecimal(value, 2),
        },
      ],
      computeResult(values) {
        const alphaValue = Math.max(0, Number.isFinite(values.alpha) ? values.alpha : 0);
        const betaValue = Math.max(0, Number.isFinite(values.beta) ? values.beta : 0);
        return Math.sqrt(alphaValue) * betaValue;
      },
      formatGoldenEquation({ formatVariable, formatResult }) {
        return `\\( ${formatResult()} = \\sqrt{${formatVariable('alpha')}} \\times ${formatVariable('beta')} \\)`;
      },
    },
    delta: {
      mathSymbol: '\\delta',
      baseEquation: '\\( \\delta = \\gamma \\cdot \\ln(\\beta + 1) \\)',
      variables: [
        {
          key: 'gamma',
          symbol: 'γ',
          name: 'Gamma Cohort',
          description: 'Command strength inherited from γ conductors.',
          reference: 'gamma',
          upgradable: false,
          lockedNote: 'Bolster γ to empower this cohort.',
          format: (value) => formatDecimal(value, 2),
        },
        {
          key: 'beta',
          symbol: 'β',
          name: 'Beta Harmonics',
          description: 'Beam resonance sustaining the summoned legion.',
          reference: 'beta',
          upgradable: false,
          lockedNote: 'Infuse β to widen this harmonic.',
          format: (value) => formatDecimal(value, 2),
        },
      ],
      computeResult(values) {
        const gammaValue = Math.max(0, Number.isFinite(values.gamma) ? values.gamma : 0);
        const betaValue = Math.max(0, Number.isFinite(values.beta) ? values.beta : 0);
        const lnComponent = Math.log(betaValue + 1);
        return gammaValue * lnComponent;
      },
      formatGoldenEquation({ formatVariable, formatResult }) {
        return `\\( ${formatResult()} = ${formatVariable('gamma')} \\times \\ln(${formatVariable('beta')} + 1) \\)`;
      },
    },
  };

  const fallbackTowerBlueprints = new Map();

  const towerUpgradeElements = {
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
  };

  const towerUpgradeState = new Map();
  const towerEquationCache = new Map();

  const towerVariableAnimationState = {
    towerId: null,
    variableMap: new Map(),
    variableSpans: new Map(),
    entryPlayed: false,
    shouldPlayEntry: false,
  };

  function resetTowerVariableAnimationState() {
    towerVariableAnimationState.towerId = null;
    towerVariableAnimationState.variableMap = new Map();
    towerVariableAnimationState.variableSpans = new Map();
    towerVariableAnimationState.entryPlayed = false;
    towerVariableAnimationState.shouldPlayEntry = false;
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

  function renderTowerUpgradeEquationParts(baseEquationText, blueprint, options = {}) {
    if (!towerUpgradeElements.baseEquation) {
      return;
    }

    const markDeparted = options.markDeparted === true;
    const resolvedEquation = convertMathExpressionToPlainText(baseEquationText) || baseEquationText || '';
    const baseEl = towerUpgradeElements.baseEquation;
    baseEl.innerHTML = '';

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

    baseEl.append(fragment);
    towerVariableAnimationState.variableSpans = spanMap;
  }

  function refreshTowerVariableAnimationState(towerId, blueprint) {
    const spanMap = towerVariableAnimationState.variableSpans || new Map();
    const nextMap = new Map();

    if (towerUpgradeElements.variables) {
      const upgradableVariables = (blueprint?.variables || []).filter((variable) => variable.upgradable !== false);
      upgradableVariables.forEach((variable) => {
        const key = variable.key;
        const spans = spanMap.get(key) || [];
        const selector = `[data-variable="${escapeCssSelector(key)}"]`;
        const card = towerUpgradeElements.variables.querySelector(selector);
        if (spans.length && card) {
          nextMap.set(key, { spans, card, variable });
        }
      });
    }

    towerVariableAnimationState.towerId = towerId;
    towerVariableAnimationState.variableMap = nextMap;
    towerVariableAnimationState.variableSpans = new Map();
  }

  function syncTowerVariableCardVisibility() {
    if (!towerUpgradeElements.variables) {
      return;
    }
    const cards = towerUpgradeElements.variables.querySelectorAll('.tower-upgrade-variable');
    cards.forEach((card, index) => {
      card.style.setProperty('--tower-upgrade-variable-index', index);
      if (towerVariableAnimationState.entryPlayed) {
        card.classList.add('is-visible');
      } else {
        card.classList.remove('is-visible');
      }
    });
  }

  function playTowerVariableFlight(direction = 'enter') {
    const panel = towerUpgradeElements.panel;
    if (!panel) {
      return Promise.resolve();
    }

    const variableMap = towerVariableAnimationState.variableMap;
    if (!variableMap || variableMap.size === 0) {
      towerVariableAnimationState.entryPlayed = direction === 'enter';
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

      towerVariableAnimationState.entryPlayed = direction === 'enter';
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
    if (!towerVariableAnimationState.shouldPlayEntry) {
      syncTowerVariableCardVisibility();
      return;
    }

    towerVariableAnimationState.shouldPlayEntry = false;
    requestAnimationFrame(() => {
      playTowerVariableFlight('enter');
    });
  }
  let activeTowerUpgradeId = null;
  let activeTowerUpgradeBaseEquation = '';
  let lastTowerUpgradeTrigger = null;

  function createPreviewId(prefix, value) {
    const slug = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${prefix}-${slug || 'preview'}`;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const GAMEPLAY_CONFIG_RELATIVE_PATH = './data/gameplayConfig.json';
  const GAMEPLAY_CONFIG_URL = new URL(GAMEPLAY_CONFIG_RELATIVE_PATH, import.meta.url);
  const FLUID_SIM_CONFIG_RELATIVE_PATH = './data/towerFluidSimulation.json';
  const FLUID_SIM_CONFIG_URL = new URL(FLUID_SIM_CONFIG_RELATIVE_PATH, import.meta.url);

  function resolveFallbackUrl(relativePath) {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const base = new URL(window.location.href);
      base.hash = '';
      base.search = '';
      return new URL(relativePath.replace(/^\.\//, ''), base).href;
    } catch (error) {
      console.warn('Failed to resolve fallback URL for', relativePath, error);
      return null;
    }
  }

  async function fetchJsonWithFallback(urlPrimary, relativePath) {
    const attempts = [];

    if (urlPrimary) {
      attempts.push(urlPrimary);
    }

    const fallbackHref = resolveFallbackUrl(relativePath);
    if (fallbackHref && !attempts.includes(fallbackHref)) {
      attempts.push(fallbackHref);
    }

    let lastError = null;

    for (const url of attempts) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          lastError = new Error(`Failed to load JSON from ${url}: ${response.status}`);
          continue;
        }
        return response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('JSON fetch failed');
  }
  const EMBEDDED_CONFIG_GLOBAL_KEY = '__THERO_EMBEDDED_GAMEPLAY_CONFIG__';

  function getEmbeddedGameplayConfig() {
    const root =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
        ? self
        : null;

    if (!root) {
      return null;
    }

    const embedded = root[EMBEDDED_CONFIG_GLOBAL_KEY];
    return embedded && typeof embedded === 'object' ? embedded : null;
  }

  async function loadGameplayConfigViaFetch() {
    if (typeof fetch !== 'function') {
      throw new Error('Fetch API is unavailable in this environment.');
    }

    return fetchJsonWithFallback(GAMEPLAY_CONFIG_URL.href, GAMEPLAY_CONFIG_RELATIVE_PATH);
  }

  async function loadGameplayConfigViaModule() {
    try {
      const module = await import(GAMEPLAY_CONFIG_URL.href, { assert: { type: 'json' } });
      if (module && module.default) {
        return module.default;
      }
    } catch (error) {
      throw error;
    }
    return null;
  }

  function normalizeFluidSimulationProfile(data) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const paletteSource =
      data.palette && typeof data.palette === 'object'
        ? data.palette
        : {
            stops: data.stops,
            restAlpha: data.restAlpha,
            freefallAlpha: data.freefallAlpha,
            backgroundTop: data.backgroundTop,
            backgroundBottom: data.backgroundBottom,
          };

    const grainSizes = Array.isArray(data.grainSizes)
      ? data.grainSizes
          .map((size) => {
            const numeric = Number.parseFloat(size);
            return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : null;
          })
          .filter((size) => Number.isFinite(size) && size > 0)
      : [];

    if (!grainSizes.length) {
      grainSizes.push(1, 2);
    }

    return {
      id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : 'fluid',
      label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : 'Fluid Study',
      grainSizes,
      idleDrainRate: Number.isFinite(data.idleDrainRate) ? Math.max(1, data.idleDrainRate) : null,
      baseSpawnInterval: Number.isFinite(data.baseSpawnInterval) ? Math.max(30, data.baseSpawnInterval) : null,
      flowOffset: Number.isFinite(data.flowOffset) ? Math.max(0, data.flowOffset) : null,
      palette: mergeMotePalette(paletteSource || {}),
    };
  }

  async function loadFluidSimulationProfile() {
    if (fluidSimulationProfile) {
      return fluidSimulationProfile;
    }

    if (!fluidSimulationLoadPromise) {
      fluidSimulationLoadPromise = (async () => {
        try {
          if (typeof fetch === 'function') {
            return fetchJsonWithFallback(FLUID_SIM_CONFIG_URL.href, FLUID_SIM_CONFIG_RELATIVE_PATH);
          }
        } catch (error) {
          console.warn('Fluid simulation fetch failed; attempting module import.', error);
        }

        try {
          const module = await import(FLUID_SIM_CONFIG_URL.href, { assert: { type: 'json' } });
          if (module && module.default) {
            return module.default;
          }
        } catch (error) {
          console.error('Fluid simulation profile import failed.', error);
        }

        return null;
      })();
    }

    const rawProfile = await fluidSimulationLoadPromise;
    fluidSimulationLoadPromise = null;
    fluidSimulationProfile = normalizeFluidSimulationProfile(rawProfile);
    return fluidSimulationProfile;
  }

  let gameplayConfigData = null;
  let levelBlueprints = [];
  let towerDefinitions = [];
  let fluidSimulationProfile = null;
  let fluidSimulationLoadPromise = null;
  let towerDefinitionMap = new Map();
  let levelLookup = new Map();
  const levelConfigs = new Map();
  const idleLevelConfigs = new Map();

  const FALLBACK_TOWER_LOADOUT_LIMIT = 4;
  const FALLBACK_BASE_START_THERO = 50;
  const FALLBACK_BASE_CORE_INTEGRITY = 100;

  let TOWER_LOADOUT_LIMIT = FALLBACK_TOWER_LOADOUT_LIMIT;
  let BASE_START_THERO = FALLBACK_BASE_START_THERO;
  let BASE_CORE_INTEGRITY = FALLBACK_BASE_CORE_INTEGRITY;

  const COLOR_SCHEME_STORAGE_KEY = 'thero-idle-color-scheme';

  const defaultTowerVisuals = Object.freeze({
    outerStroke: 'rgba(255, 228, 120, 0.85)',
    outerShadow: null,
    innerFill: 'rgba(8, 9, 14, 0.9)',
    symbolFill: 'rgba(255, 228, 120, 0.85)',
    symbolShadow: null,
    rangeStroke: 'rgba(139, 247, 255, 0.18)',
  });

  const defaultOmegaWaveVisuals = Object.freeze({
    color: 'rgba(255, 228, 120, 0.6)',
    trailColor: 'rgba(139, 247, 255, 0.35)',
    size: 4,
    glowColor: 'rgba(255, 228, 120, 0.75)',
    glowBlur: 24,
  });

  function getTowerTierValue(tower) {
    if (!tower) {
      return 1;
    }
    if (Number.isFinite(tower.tier)) {
      return tower.tier;
    }
    if (Number.isFinite(tower.definition?.tier)) {
      return tower.definition.tier;
    }
    return 1;
  }

  function computeChromaticMetrics(tower) {
    const tier = Math.max(1, getTowerTierValue(tower));
    const clamped = Math.min(tier, 24);
    const ratio = clamped > 1 ? (clamped - 1) / 23 : 0;
    const hue = Math.round(300 * ratio);
    const baseLightness = Math.max(0, Math.min(100, 100 - ratio * 100));
    return { tier, clamped, ratio, hue, baseLightness };
  }

  function computeChromaticTowerVisuals(tower) {
    const { ratio, hue, baseLightness } = computeChromaticMetrics(tower);

    const outerStroke = `hsl(${hue}, 90%, ${Math.max(0, baseLightness)}%)`;
    const innerLightness = Math.max(4, baseLightness * 0.55);
    const innerFill = `hsl(${hue}, 65%, ${innerLightness}%)`;
    const rangeLightness = Math.min(85, baseLightness + 40);
    const rangeOpacity = 0.18 + (1 - ratio) * 0.12;
    const rangeStroke = `hsla(${hue}, 90%, ${rangeLightness}%, ${rangeOpacity.toFixed(2)})`;

    let symbolFill;
    let symbolShadow = null;

    if (baseLightness > 65) {
      symbolFill = 'rgba(18, 18, 26, 0.92)';
      const glowLightness = Math.min(95, baseLightness + 18);
      symbolShadow = {
        color: `hsla(${hue}, 85%, ${glowLightness}%, 0.55)`,
        blur: 10,
      };
    } else {
      const symbolLightness = Math.max(6, baseLightness * 0.5);
      symbolFill = `hsl(${hue}, 90%, ${symbolLightness}%)`;
      if (baseLightness < 35) {
        const glowLightness = Math.min(92, baseLightness + 60);
        symbolShadow = {
          color: `hsla(${hue}, 90%, ${glowLightness}%, 0.95)`,
          blur: 26,
        };
      }
    }

    let outerShadow = null;
    if (baseLightness < 30) {
      const haloLightness = Math.min(90, baseLightness + 55);
      outerShadow = {
        color: `hsla(${hue}, 90%, ${haloLightness}%, 0.65)`,
        blur: 24,
      };
    }

    return {
      outerStroke,
      outerShadow,
      innerFill,
      symbolFill,
      symbolShadow,
      rangeStroke,
    };
  }

  function computeChromaticOmegaWaveVisuals(tower) {
    const { ratio, hue, baseLightness } = computeChromaticMetrics(tower);
    const colorLightness = Math.min(78, baseLightness + 55);
    const colorAlpha = 0.55 + (1 - ratio) * 0.25;
    const color = `hsla(${hue}, 95%, ${colorLightness}%, ${colorAlpha.toFixed(2)})`;
    const trailLightness = Math.min(88, colorLightness + 10);
    const trail = `hsla(${hue}, 90%, ${trailLightness}%, 0.45)`;
    const glowLightness = Math.min(95, colorLightness + 15);
    const glow = `hsla(${hue}, 95%, ${glowLightness}%, 0.9)`;
    const size = 4 + ratio * 3;
    return {
      color,
      trailColor: trail,
      glowColor: glow,
      glowBlur: 30,
      size,
    };
  }

  const colorSchemeDefinitions = [
    {
      id: 'aurora',
      label: 'Aurora',
      className: 'color-scheme-aurora',
      getTowerVisuals() {
        return null;
      },
      getOmegaWaveVisuals() {
        return null;
      },
    },
    {
      id: 'chromatic',
      label: 'Chromatic',
      className: 'color-scheme-chromatic',
      getTowerVisuals: computeChromaticTowerVisuals,
      getOmegaWaveVisuals: computeChromaticOmegaWaveVisuals,
    },
  ];

  const colorSchemeState = {
    index: 0,
    button: null,
  };

  function updateMotePaletteFromTheme() {
    const palette = computeMotePaletteFromTheme();
    powderState.motePalette = palette;
    if (powderSimulation && typeof powderSimulation.setMotePalette === 'function') {
      powderSimulation.setMotePalette(palette);
      powderSimulation.render();
    }
  }

  function getActiveColorScheme() {
    return colorSchemeDefinitions[colorSchemeState.index] || colorSchemeDefinitions[0];
  }

  function getTowerVisualConfig(tower) {
    const base = { ...defaultTowerVisuals };
    const scheme = getActiveColorScheme();
    if (scheme && typeof scheme.getTowerVisuals === 'function') {
      try {
        const override = scheme.getTowerVisuals(tower, { ...base });
        if (override && typeof override === 'object') {
          return { ...base, ...override };
        }
      } catch (error) {
        console.warn('Failed to compute tower visuals', error);
      }
    }
    return base;
  }

  function getOmegaWaveVisualConfig(tower) {
    const base = { ...defaultOmegaWaveVisuals };
    const scheme = getActiveColorScheme();
    if (scheme && typeof scheme.getOmegaWaveVisuals === 'function') {
      try {
        const override = scheme.getOmegaWaveVisuals(tower, { ...base });
        if (override && typeof override === 'object') {
          return { ...base, ...override };
        }
      } catch (error) {
        console.warn('Failed to compute omega wave visuals', error);
      }
    }
    return base;
  }

  function updateColorSchemeButton() {
    const button = colorSchemeState.button;
    if (!button) {
      return;
    }
    const scheme = getActiveColorScheme();
    if (scheme) {
      button.textContent = `Palette · ${scheme.label}`;
      button.setAttribute('aria-label', `Switch color scheme (current: ${scheme.label})`);
    }
  }

  function applyColorScheme() {
    const scheme = getActiveColorScheme();
    const body = document.body;
    if (body) {
      colorSchemeDefinitions.forEach((definition) => {
        if (definition.className) {
          body.classList.toggle(definition.className, definition === scheme);
        }
      });
    }

    updateColorSchemeButton();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme?.id || 'aurora');
      } catch (error) {
        console.warn('Unable to persist color scheme', error);
      }
    }

    updateMotePaletteFromTheme();

    if (playfield) {
      playfield.draw();
    }
  }

  function setColorSchemeById(id) {
    const index = colorSchemeDefinitions.findIndex((scheme) => scheme.id === id);
    if (index < 0) {
      return false;
    }
    colorSchemeState.index = index;
    applyColorScheme();
    return true;
  }

  function cycleColorScheme() {
    if (!colorSchemeDefinitions.length) {
      return;
    }
    colorSchemeState.index = (colorSchemeState.index + 1) % colorSchemeDefinitions.length;
    applyColorScheme();
  }

  function bindColorSchemeButton() {
    const button = document.getElementById('color-scheme-button');
    colorSchemeState.button = button || null;
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      cycleColorScheme();
    });
    updateColorSchemeButton();
  }

  function initializeColorScheme() {
    let applied = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
        if (stored) {
          applied = setColorSchemeById(stored);
        }
      } catch (error) {
        console.warn('Unable to read saved color scheme', error);
      }
    }
    if (!applied) {
      applyColorScheme();
    }
  }

  function getOmegaPatternForTier(tier) {
    const normalized = Number.isFinite(tier) ? Math.max(24, Math.floor(tier)) : 24;
    const stage = Math.max(0, normalized - 24);
    const radius = 60 + stage * 18;
    const loops = 1.6 + stage * 0.45;
    const ratio = 1.8 + stage * 0.28;
    const swirl = 0.8 + stage * 0.18;
    const swirlFrequency = 2.4 + stage * 0.55;
    const envelopePower = 1.1 + stage * 0.12;
    const returnCurve = 0.55 + stage * 0.1;
    const duration = 2 + stage * 0.4;
    const projectileCount = Math.min(22, 10 + stage * 3);
    const baseSize = 4 + stage * 0.45;
    const phaseShift = 0.35 + stage * 0.05;
    return {
      radius,
      loops,
      ratio,
      swirl,
      swirlFrequency,
      envelopePower,
      returnCurve,
      duration,
      projectileCount,
      baseSize,
      phaseShift,
    };
  }

  const towerLoadoutState = {
    selected: ['alpha'],
  };

  const towerUnlockState = {
    unlocked: new Set(['alpha']),
  };

  const mergeProgressState = {
    mergingLogicUnlocked: false,
  };

  const mergingLogicElements = {
    card: null,
  };

  function updateMergingLogicVisibility() {
    if (!mergingLogicElements.card) {
      return;
    }

    const visible = mergeProgressState.mergingLogicUnlocked;
    mergingLogicElements.card.hidden = !visible;
    mergingLogicElements.card.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function setMergingLogicUnlocked(value = true) {
    mergeProgressState.mergingLogicUnlocked = Boolean(value);
    updateMergingLogicVisibility();
    if (!mergeProgressState.mergingLogicUnlocked && upgradeOverlay?.classList.contains('active')) {
      hideUpgradeMatrix();
    }
  }

  function isTowerUnlocked(towerId) {
    return towerUnlockState.unlocked.has(towerId);
  }

  function unlockTower(towerId, { silent = false } = {}) {
    if (!towerId || !towerDefinitionMap.has(towerId)) {
      return false;
    }
    if (towerUnlockState.unlocked.has(towerId)) {
      if (towerId === 'beta') {
        setMergingLogicUnlocked(true);
      }
      return false;
    }
    towerUnlockState.unlocked.add(towerId);
    if (towerId === 'beta') {
      setMergingLogicUnlocked(true);
    }
    updateTowerCardVisibility();
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    if (!silent && playfield?.messageEl) {
      playfield.messageEl.textContent = `${
        getTowerDefinition(towerId)?.symbol || 'New'
      } lattice discovered—add it to your loadout from the Towers tab.`;
    }
    if (upgradeOverlay?.classList.contains('active')) {
      renderUpgradeMatrix();
    }
    return true;
  }

  function getTowerDefinition(towerId) {
    return towerDefinitionMap.get(towerId) || null;
  }

  function getNextTowerId(towerId) {
    const definition = getTowerDefinition(towerId);
    return definition?.nextTierId || null;
  }

  function cloneVectorArray(array) {
    if (!Array.isArray(array)) {
      return [];
    }
    return array
      .map((point) => {
        if (!point || typeof point !== 'object') {
          return null;
        }
        const x = Number(point.x);
        const y = Number(point.y);
        return {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        };
      })
      .filter(Boolean);
  }

  function cloneWaveArray(array) {
    if (!Array.isArray(array)) {
      return [];
    }
    return array.map((wave) => {
      if (!wave || typeof wave !== 'object') {
        return {
          count: 0,
          interval: 1,
          hp: 0,
          speed: 0,
          reward: 0,
        };
      }
      return {
        ...wave,
        count: Number.isFinite(wave.count) ? wave.count : 0,
        interval: Number.isFinite(wave.interval) ? wave.interval : 1,
        hp: Number.isFinite(wave.hp) ? wave.hp : 0,
        speed: Number.isFinite(wave.speed) ? wave.speed : 0,
        reward: Number.isFinite(wave.reward) ? wave.reward : 0,
      };
    });
  }

  function applyGameplayConfig(config = {}) {
    gameplayConfigData = config || {};

    const defaults = gameplayConfigData.defaults || {};

    TOWER_LOADOUT_LIMIT =
      Number.isFinite(defaults.towerLoadoutLimit) && defaults.towerLoadoutLimit > 0
        ? Math.max(1, Math.floor(defaults.towerLoadoutLimit))
        : FALLBACK_TOWER_LOADOUT_LIMIT;

    BASE_START_THERO =
      Number.isFinite(defaults.baseStartThero) && defaults.baseStartThero > 0
        ? defaults.baseStartThero
        : FALLBACK_BASE_START_THERO;

    BASE_CORE_INTEGRITY =
      Number.isFinite(defaults.baseCoreIntegrity) && defaults.baseCoreIntegrity > 0
        ? defaults.baseCoreIntegrity
        : FALLBACK_BASE_CORE_INTEGRITY;

    towerDefinitions = Array.isArray(gameplayConfigData.towers)
      ? gameplayConfigData.towers.map((tower) => ({ ...tower }))
      : [];
    towerDefinitionMap = new Map(towerDefinitions.map((tower) => [tower.id, tower]));

    const loadoutCandidates = Array.isArray(defaults.initialTowerLoadout)
      ? defaults.initialTowerLoadout
      : towerLoadoutState.selected;

    const normalizedLoadout = [];
    loadoutCandidates.forEach((towerId) => {
      if (
        typeof towerId === 'string' &&
        towerDefinitionMap.has(towerId) &&
        !normalizedLoadout.includes(towerId) &&
        normalizedLoadout.length < TOWER_LOADOUT_LIMIT
      ) {
        normalizedLoadout.push(towerId);
      }
    });
    if (!normalizedLoadout.length && towerDefinitions.length) {
      normalizedLoadout.push(towerDefinitions[0].id);
    }
    towerLoadoutState.selected = normalizedLoadout;

    const unlocked = new Set(
      Array.isArray(defaults.initialUnlockedTowers)
        ? defaults.initialUnlockedTowers.filter((towerId) => towerDefinitionMap.has(towerId))
        : [],
    );
    towerLoadoutState.selected.forEach((towerId) => unlocked.add(towerId));
    towerUnlockState.unlocked = unlocked;

    mergeProgressState.mergingLogicUnlocked = towerUnlockState.unlocked.has('beta');

    setEnemyCodexEntries(gameplayConfigData.enemies);

    levelBlueprints = Array.isArray(gameplayConfigData.maps)
      ? gameplayConfigData.maps.map((map) => ({ ...map }))
      : [];
    levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));

    levelConfigs.clear();
    if (Array.isArray(gameplayConfigData.levels)) {
      gameplayConfigData.levels.forEach((level) => {
        if (!level || !level.id) {
          return;
        }
        levelConfigs.set(level.id, {
          ...level,
          waves: cloneWaveArray(level.waves),
          path: cloneVectorArray(level.path),
          autoAnchors: cloneVectorArray(level.autoAnchors),
        });
      });
    }

    interactiveLevelOrder = Array.from(levelConfigs.keys());
    unlockedLevels.clear();
    if (interactiveLevelOrder.length) {
      unlockedLevels.add(interactiveLevelOrder[0]);
    }

    idleLevelConfigs.clear();
    levelBlueprints.forEach((level, index) => {
      if (!level || !level.id || levelConfigs.has(level.id)) {
        return;
      }

      const levelNumber = index + 1;
      const runDuration = 90 + levelNumber * 12;
      const rewardMultiplier = 1 + levelNumber * 0.08;
      const rewardScore = baseResources.scoreRate * (runDuration / 12) * rewardMultiplier;
      const rewardFlux = 45 + levelNumber * 10;
      const rewardThero = 35 + levelNumber * 8;

      idleLevelConfigs.set(level.id, {
        runDuration,
        rewardScore,
        rewardFlux,
        rewardThero,
      });
    });

    Array.from(levelState.keys()).forEach((levelId) => {
      if (!levelLookup.has(levelId)) {
        levelState.delete(levelId);
      }
    });

    generateLevelAchievements();

    return gameplayConfigData;
  }

  function describeLevelAchievementProgress(levelId, shortLabel, longLabel) {
    const state = levelState.get(levelId) || {};
    if (state.completed) {
      return 'Victory sealed · +1 Motes/min secured.';
    }

    const bestWave = Number.isFinite(state.bestWave) ? state.bestWave : 0;
    const label = shortLabel || longLabel || levelId || 'Level';
    if (bestWave > 0) {
      return `Locked — Best wave ${formatWholeNumber(bestWave)}. Seal ${label} to unlock.`;
    }
    return `Locked — Seal ${label} to unlock.`;
  }

  function createLevelAchievementDefinition(levelId, ordinal) {
    const levelConfig = levelConfigs.get(levelId);
    if (!levelConfig || levelConfig.developerOnly) {
      return null;
    }

    const id = `level-${ordinal}`;
    const displayName =
      levelConfig.displayName || levelConfig.title || levelConfig.id || `Level ${ordinal}`;
    const shortLabel = levelConfig.id || displayName;
    const icon = String(ordinal);

    const rewardSegments = [];
    if (Number.isFinite(levelConfig.startThero)) {
      rewardSegments.push(`Start ${formatWholeNumber(levelConfig.startThero)} ${THERO_SYMBOL}.`);
    }
    if (Number.isFinite(levelConfig.rewardFlux)) {
      rewardSegments.push(`Victory awards +${formatGameNumber(levelConfig.rewardFlux)} Motes.`);
    }
    if (Number.isFinite(levelConfig.rewardScore)) {
      rewardSegments.push(`Score bonus ${formatGameNumber(levelConfig.rewardScore)} Σ.`);
    }
    if (Number.isFinite(levelConfig.rewardEnergy)) {
      rewardSegments.push(`Energy bonus +${formatGameNumber(levelConfig.rewardEnergy)} TD.`);
    }

    const rewardSummary = rewardSegments.join(' ');
    const description = `${displayName} — seal ${shortLabel} to claim the idle mote seal. ${rewardSummary}`.trim();

    return {
      id,
      levelId,
      title: displayName,
      subtitle: shortLabel,
      icon,
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      description: `${description} Unlocking adds +${ACHIEVEMENT_REWARD_FLUX} Motes/min to idle reserves.`,
      condition: () => isLevelCompleted(levelId),
      progress: () => describeLevelAchievementProgress(levelId, shortLabel, displayName),
    };
  }

  function generateLevelAchievements() {
    let ordinal = 0;
    const definitions = [];

    interactiveLevelOrder.forEach((levelId) => {
      const candidate = createLevelAchievementDefinition(levelId, ordinal + 1);
      if (!candidate) {
        return;
      }
      ordinal += 1;
      definitions.push(candidate);
    });

    achievementDefinitions = definitions;
    const allowedIds = new Set(definitions.map((definition) => definition.id));
    Array.from(achievementState.keys()).forEach((key) => {
      if (!allowedIds.has(key)) {
        achievementState.delete(key);
      }
    });

    refreshAchievementPowderRate();

    if (achievementGridEl) {
      renderAchievementGrid();
      evaluateAchievements();
      updateResourceRates();
      updatePowderLedger();
    }
  }

  async function ensureGameplayConfigLoaded() {
    if (gameplayConfigData) {
      return gameplayConfigData;
    }

    let lastError = null;

    try {
      const configFromFetch = await loadGameplayConfigViaFetch();
      if (configFromFetch) {
        return applyGameplayConfig(configFromFetch);
      }
    } catch (error) {
      lastError = error;
      console.warn('Primary gameplay-config fetch failed; falling back to alternate loaders.', error);
    }

    const embeddedConfig = getEmbeddedGameplayConfig();
    if (embeddedConfig) {
      return applyGameplayConfig(embeddedConfig);
    }

    try {
      const configFromModule = await loadGameplayConfigViaModule();
      if (configFromModule) {
        return applyGameplayConfig(configFromModule);
      }
    } catch (error) {
      lastError = error;
    }

    console.error('Unable to load gameplay configuration', lastError);
    throw lastError || new Error('Unable to load gameplay configuration');
  }

  const levelState = new Map();
  let interactiveLevelOrder = [];
  const unlockedLevels = new Set();
  const levelSetEntries = [];

  function getCompletedInteractiveLevelCount() {
    let count = 0;
    interactiveLevelOrder.forEach((levelId) => {
      const state = levelState.get(levelId);
      if (state?.completed) {
        count += 1;
      }
    });
    return count;
  }

  function getStartingTheroMultiplier(levelsBeaten = getCompletedInteractiveLevelCount()) {
    const normalized = Number.isFinite(levelsBeaten) ? Math.max(0, levelsBeaten) : 0;
    return 2 ** normalized;
  }

  function calculateStartingThero() {
    return BASE_START_THERO * getStartingTheroMultiplier();
  }

  let tabs = [];
  let activeTabId = 'tower';
  let panels = [];
  function ensureTabCollections() {
    if (!tabs.length) {
      tabs = Array.from(document.querySelectorAll('.tab-button'));
    }
    if (!panels.length) {
      panels = Array.from(document.querySelectorAll('.panel'));
    }
  }
  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;
  let overlay = null;
  let overlayLabel = null;
  let overlayTitle = null;
  let overlayExample = null;
  let overlayPreview = null;
  let overlayPreviewCanvas = null;
  let overlayPreviewLevel = null;
  let previewPlayfield = null;
  let overlayMode = null;
  let overlayDuration = null;
  let overlayRewards = null;
  let overlayLast = null;
  let overlayInstruction = null;
  let overlayRequiresLevelExit = false;
  const levelEditorElements = {
    container: null,
    toggle: null,
    note: null,
    count: null,
    clear: null,
    reset: null,
    exportButton: null,
    output: null,
    status: null,
  };
  const levelEditorState = {
    levelId: null,
    points: [],
    originalPoints: [],
    editing: false,
    draggingIndex: -1,
    pointerId: null,
    canvasListenersAttached: false,
    statusTimeout: null,
  };
  let upgradeOverlay = null;
  let upgradeOverlayButton = null;
  let upgradeOverlayClose = null;
  let upgradeOverlayGrid = null;
  let lastUpgradeTrigger = null;
  const overlayInstructionDefault = 'Tap to enter';
  let activeLevelId = null;
  let pendingLevel = null;
  let activeTabIndex = 0;
  let lastLevelTrigger = null;
  let expandedLevelSet = null;

  const loadoutElements = {
    container: null,
    grid: null,
    note: null,
  };
  let renderedLoadoutSignature = null;

  const towerSelectionButtons = new Map();

  const loadoutDragState = {
    active: false,
    pointerId: null,
    towerId: null,
    element: null,
  };

  function isInteractiveLevel(levelId) {
    return levelConfigs.has(levelId);
  }

  function isSecretLevelId(levelId) {
    return typeof levelId === 'string' && /secret/i.test(levelId);
  }

  function isLevelUnlocked(levelId) {
    if (!levelId) {
      return false;
    }
    if (!isInteractiveLevel(levelId)) {
      return true;
    }
    return unlockedLevels.has(levelId);
  }

  function isLevelCompleted(levelId) {
    if (!levelId) {
      return false;
    }
    const state = levelState.get(levelId);
    return Boolean(state && state.completed);
  }

  function unlockLevel(levelId) {
    if (!levelId || !isInteractiveLevel(levelId)) {
      return;
    }
    if (!unlockedLevels.has(levelId)) {
      unlockedLevels.add(levelId);
    }
  }

  function unlockNextInteractiveLevel(levelId) {
    const index = interactiveLevelOrder.indexOf(levelId);
    if (index < 0) {
      return;
    }
    for (let offset = index + 1; offset < interactiveLevelOrder.length; offset += 1) {
      const nextId = interactiveLevelOrder[offset];
      if (!nextId) {
        continue;
      }
      unlockLevel(nextId);
      if (!isSecretLevelId(nextId)) {
        break;
      }
    }
  }

  function getPreviousInteractiveLevelId(levelId) {
    const index = interactiveLevelOrder.indexOf(levelId);
    if (index <= 0) {
      return null;
    }
    return interactiveLevelOrder[index - 1] || null;
  }

  const developerModeElements = {
    toggle: null,
    note: null,
  };

  const fieldNotesElements = {
    overlay: null,
    closeButton: null,
    openButton: null,
    copy: null,
    pagination: null,
    pages: [],
    pageIndicator: null,
    prevButton: null,
    nextButton: null,
    lastFocus: null,
  };

  const fieldNotesState = {
    currentIndex: 0,
    animating: false,
    touchStart: null,
  };

  const overlayHideStates = new WeakMap();

  function cancelOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    const state = overlayHideStates.get(overlay);
    if (!state) {
      return;
    }

    if (state.transitionHandler) {
      overlay.removeEventListener('transitionend', state.transitionHandler);
    }

    if (state.timeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(state.timeoutId);
    }

    overlayHideStates.delete(overlay);
  }

  function scheduleOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);

    const finalizeHide = () => {
      cancelOverlayHide(overlay);
      overlay.setAttribute('hidden', '');
    };

    const handleTransitionEnd = (event) => {
      if (event && event.target !== overlay) {
        return;
      }
      finalizeHide();
    };

    overlay.addEventListener('transitionend', handleTransitionEnd);

    const timeoutId =
      typeof window !== 'undefined' ? window.setTimeout(finalizeHide, 320) : null;

    overlayHideStates.set(overlay, {
      transitionHandler: handleTransitionEnd,
      timeoutId,
    });
  }

  function revealOverlay(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);
    overlay.removeAttribute('hidden');
  }

  const developerControlElements = {
    container: null,
    fields: {
      moteBank: null,
      moteRate: null,
      startThero: null,
      glyphs: null,
    },
  };

  const developerFieldHandlers = {
    moteBank: setDeveloperIdleMoteBank,
    moteRate: setDeveloperIdleMoteRate,
    startThero: setDeveloperBaseStartThero,
    glyphs: setDeveloperGlyphs,
  };

  let developerModeActive = false;

  let playfield = null;

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

  function recordDeveloperAdjustment(field, value) {
    if (!developerModeActive) {
      return;
    }
    recordPowderEvent('developer-adjust', { field, value });
  }

  function setDeveloperIdleMoteBank(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(value));
    if (powderSimulation) {
      powderSimulation.idleBank = normalized;
    }
    powderState.idleMoteBank = normalized;
    recordDeveloperAdjustment('idle-mote-bank', normalized);
    updatePowderDisplay();
  }

  function setDeveloperIdleMoteRate(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, value);
    if (powderSimulation) {
      powderSimulation.idleDrainRate = normalized;
    }
    powderState.idleDrainRate = normalized;
    recordDeveloperAdjustment('idle-mote-rate', normalized);
    updatePowderDisplay();
  }

  function setDeveloperBaseStartThero(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, value);
    BASE_START_THERO = normalized;
    recordDeveloperAdjustment('base-start-thero', normalized);
    updateLevelCards();
    updatePowderLedger();
    updateStatusDisplays();
  }

  function setDeveloperGlyphs(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(value));
    glyphCurrency = normalized;
    gameStats.enemiesDefeated = normalized;
    if (gameStats.towersPlaced > normalized) {
      gameStats.towersPlaced = normalized;
    }
    recordDeveloperAdjustment('glyphs', normalized);
    updateTowerUpgradeGlyphDisplay();
    updateStatusDisplays();
  }

  function syncDeveloperControlValues() {
    const { fields } = developerControlElements;
    if (!fields) {
      return;
    }
    if (fields.moteBank) {
      fields.moteBank.value = formatDeveloperInteger(getCurrentIdleMoteBank());
    }
    if (fields.moteRate) {
      fields.moteRate.value = formatDeveloperFloat(getCurrentMoteDispenseRate());
    }
    if (fields.startThero) {
      fields.startThero.value = formatDeveloperInteger(BASE_START_THERO);
    }
    if (fields.glyphs) {
      fields.glyphs.value = formatDeveloperInteger(glyphCurrency);
    }
  }

  function updateDeveloperControlsVisibility() {
    const active = developerModeActive;
    const { container, fields } = developerControlElements;
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
    if (active) {
      syncDeveloperControlValues();
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
    if (!developerModeActive) {
      syncDeveloperControlValues();
      return;
    }

    const handler = developerFieldHandlers[field];
    if (!handler) {
      return;
    }

    const parsed = Number.parseFloat(input.value);
    if (!Number.isFinite(parsed)) {
      syncDeveloperControlValues();
      return;
    }

    handler(parsed);
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

    syncDeveloperControlValues();
    updateDeveloperControlsVisibility();
  }

  function getAlephChainUpgrades() {
    return { ...alephChainUpgradeState };
  }

  function updateAlephChainUpgrades(updates = {}) {
    if (!updates || typeof updates !== 'object') {
      return getAlephChainUpgrades();
    }

    const nextState = { ...alephChainUpgradeState };
    if (Number.isFinite(updates.x) && updates.x > 0) {
      nextState.x = updates.x;
    }
    if (Number.isFinite(updates.y) && updates.y > 0) {
      nextState.y = updates.y;
    }
    if (Number.isFinite(updates.z)) {
      nextState.z = Math.max(1, Math.floor(updates.z));
    }

    const changed =
      nextState.x !== alephChainUpgradeState.x ||
      nextState.y !== alephChainUpgradeState.y ||
      nextState.z !== alephChainUpgradeState.z;

    if (!changed) {
      return getAlephChainUpgrades();
    }

    alephChainUpgradeState.x = nextState.x;
    alephChainUpgradeState.y = nextState.y;
    alephChainUpgradeState.z = nextState.z;

    if (playfield?.alephChain) {
      playfield.alephChain.setUpgrades(alephChainUpgradeState);
      playfield.syncAlephChainStats();
    }

    return getAlephChainUpgrades();
  }
  const playfieldElements = {
    container: null,
    canvas: null,
    message: null,
    wave: null,
    health: null,
    energy: null,
    progress: null,
    startButton: null,
    speedButton: null,
    autoAnchorButton: null,
    slots: [],
  };

  const alephSubscriptDigits = {
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

  function toSubscriptNumber(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${normalized}`
      .split('')
      .map((digit) => alephSubscriptDigits[digit] || digit)
      .join('');
  }

  function formatAlephLabel(index) {
    const normalized = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
    return `ℵ${toSubscriptNumber(normalized)}`;
  }

  const gameStats = {
    manualVictories: 0,
    idleVictories: 0,
    towersPlaced: 0,
    maxTowersSimultaneous: 0,
    autoAnchorPlacements: 0,
    powderActions: 0,
    enemiesDefeated: 0,
    idleMillisecondsAccumulated: 0,
    powderSigilsReached: 0,
    highestPowderMultiplier: 1,
  };

  const ACHIEVEMENT_REWARD_FLUX = 1;

  // The audio manifest points to filenames under assets/audio/music and assets/audio/sfx.
  // Drop encoded tracks with the listed names into those folders to activate playback.
  const audioManifest = {
    musicVolume: 0.5,
    sfxVolume: 0.5,
    musicCrossfadeSeconds: 3,
    music: {
      levelSelect: { file: 'level_selection_music.mp3', loop: true, volume: 0.65 },
      levelActive: { file: 'inside_level_music.mp3', loop: true, volume: 0.7 },
      towers: { file: 'towers_music.mp3', loop: true, volume: 0.65 },
      powder: { file: 'mote_screen_music.mp3', loop: true, volume: 0.65 },
      achievements: { file: 'achievements_music.mp3', loop: true, volume: 0.6 },
      codex: { file: 'codex_music.mp3', loop: true, volume: 0.6 },
    },
    sfx: {
      uiConfirm: { file: 'menu_selection_alt.mp3', volume: 0.55, maxConcurrent: 2 },
      uiToggle: { file: 'menu_selection_OLD.mp3', volume: 0.5, maxConcurrent: 2 },
      menuSelect: { file: 'menu_selection.mp3', volume: 0.55, maxConcurrent: 4 },
      towerPlace: { file: 'tower_placement.mp3', volume: 0.7, maxConcurrent: 4 },
      towerMerge: { file: 'tower_merge.mp3', volume: 0.75, maxConcurrent: 2 },
      towerSell: { file: 'tower_merge.mp3', volume: 0.7, maxConcurrent: 2 },
      enterLevel: { file: 'enter_level.mp3', volume: 0.75, maxConcurrent: 2 },
      pageTurn: { file: 'page_turn.mp3', volume: 0.6, maxConcurrent: 2 },
      error: { file: 'error.mp3', volume: 0.8, maxConcurrent: 2 },
      alphaTowerFire: { file: 'alpha_tower_firing.mp3', volume: 0.55, maxConcurrent: 5 },
      noteA: { file: 'note_A.mp3', volume: 0.8, maxConcurrent: 3 },
      noteB: { file: 'note_B.mp3', volume: 0.8, maxConcurrent: 3 },
      noteDSharp: { file: 'note_D#.mp3', volume: 0.8, maxConcurrent: 3 },
      noteFSharp: { file: 'note_F#.mp3', volume: 0.8, maxConcurrent: 3 },
      noteG: { file: 'note_G.mp3', volume: 0.8, maxConcurrent: 3 },
    },
  };

  const TOWER_NOTE_SFX_KEYS = ['noteA', 'noteB', 'noteDSharp', 'noteFSharp', 'noteG'];

  class AudioManager {
    constructor(manifest = {}) {
      this.musicFolder = 'assets/audio/music';
      this.sfxFolder = 'assets/audio/sfx';
      this.musicDefinitions = manifest.music || {};
      this.sfxDefinitions = manifest.sfx || {};
      this.musicVolume = this._clampVolume(manifest.musicVolume, 0.5);
      this.sfxVolume = this._clampVolume(manifest.sfxVolume, 0.5);
      this.musicElements = new Map();
      this.sfxPools = new Map();
      this.currentMusicKey = null;
      this.activeMusicEntry = null;
      this.activeMusicFade = null;
      this.pendingUnlockResolvers = [];
      this.pendingMusicKey = null;
      this.unlocked = false;
      this.musicCrossfadeDuration = Math.max(
        0,
        Number.isFinite(manifest.musicCrossfadeSeconds)
          ? manifest.musicCrossfadeSeconds
          : 3,
      );
      this.musicFadeHandle = null;
      this.musicFadeCanceler = null;
      this.activationElements = typeof WeakSet === 'function' ? new WeakSet() : { add() {}, has() { return false; } };
      this.suspendedMusic = null;

      if (typeof document !== 'undefined') {
        const unlockHandler = () => this.unlock();
        document.addEventListener('pointerdown', unlockHandler, { once: true });
        document.addEventListener('keydown', unlockHandler, { once: true });
      }
    }

    registerActivationElements(elements) {
      if (!Array.isArray(elements)) {
        return;
      }
      elements.forEach((element) => this.registerActivationElement(element));
    }

    registerActivationElement(element) {
      if (!element || (this.activationElements && this.activationElements.has(element))) {
        return;
      }

      const handler = () => {
        this.unlock();
        ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
          element.removeEventListener(eventName, handler);
        });
      };

      ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
        element.addEventListener(eventName, handler);
      });

      if (this.activationElements && typeof this.activationElements.add === 'function') {
        this.activationElements.add(element);
      }
    }

    unlock() {
      if (this.unlocked) {
        return;
      }
      this.unlocked = true;
      while (this.pendingUnlockResolvers.length) {
        const resolve = this.pendingUnlockResolvers.shift();
        if (typeof resolve === 'function') {
          resolve();
        }
      }
    }

    whenUnlocked() {
      if (this.unlocked) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.pendingUnlockResolvers.push(resolve);
      });
    }

    playMusic(key, options = {}) {
      if (!key) {
        return;
      }

      this.suspendedMusic = null;

      const startPlayback = () => {
        const entry = this._ensureMusicEntry(key);
        if (!entry) {
          return;
        }

        const { audio, definition } = entry;
        const loop = typeof options.loop === 'boolean' ? options.loop : definition.loop !== false;
        audio.loop = loop;
        const targetVolume = this._resolveMusicVolume(definition, options.volume);
        const currentKey = this.currentMusicKey;
        const sameTrack = currentKey === key;
        const shouldRestart = Boolean(options.restart) || !sameTrack || audio.paused;

        this._cancelMusicFade({ finalize: true });

        if (shouldRestart) {
          try {
            audio.currentTime = 0;
          } catch (error) {
            audio.src = audio.src;
          }
        }

        const ensurePlayback = () => {
          const playPromise = audio.play();
          if (typeof playPromise?.catch === 'function') {
            playPromise.catch(() => {});
          }
        };

        if (!sameTrack) {
          const previousEntry = currentKey ? this.musicElements.get(currentKey) : null;
          const fromEntry = previousEntry && previousEntry !== entry ? previousEntry : null;

          this.pendingMusicKey = null;
          this.currentMusicKey = key;
          this.activeMusicEntry = entry;

          audio.volume = 0;
          ensurePlayback();

          this._startMusicFade({
            fromEntry,
            toEntry: entry,
            targetVolume,
            durationSeconds:
              typeof options.crossfadeDuration === 'number'
                ? options.crossfadeDuration
                : this.musicCrossfadeDuration,
          });
          return;
        }

        this.pendingMusicKey = null;
        this.currentMusicKey = key;
        this.activeMusicEntry = entry;
        audio.volume = targetVolume;
        ensurePlayback();
      };

      if (!this.unlocked) {
        this.pendingMusicKey = key;
        this.whenUnlocked().then(() => {
          if (this.pendingMusicKey === key) {
            startPlayback();
          }
        });
        return;
      }

      startPlayback();
    }

    stopMusic(key = this.currentMusicKey, options = {}) {
      if (!key) {
        return;
      }
      const entry = this.musicElements.get(key);
      if (!entry) {
        return;
      }
      if (this.currentMusicKey === key) {
        this._cancelMusicFade({ finalize: true });
        this.currentMusicKey = null;
        this.activeMusicEntry = null;
      }
      if (this.suspendedMusic && this.suspendedMusic.key === key) {
        this.suspendedMusic = null;
      }
      entry.audio.pause();
      if (options.reset !== false) {
        try {
          entry.audio.currentTime = 0;
        } catch (error) {
          entry.audio.src = entry.audio.src;
        }
      }
      entry.audio.volume = this._resolveMusicVolume(entry.definition);
    }

    suspendMusic() {
      if (!this.activeMusicEntry || !this.activeMusicEntry.audio || !this.currentMusicKey) {
        this.suspendedMusic = null;
        return;
      }

      const { audio } = this.activeMusicEntry;
      this._cancelMusicFade({ finalize: true });

      let time = 0;
      try {
        time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      } catch (error) {
        time = 0;
      }

      audio.pause();
      this.suspendedMusic = {
        key: this.currentMusicKey,
        time,
        volume: audio.volume,
      };
    }

    resumeSuspendedMusic() {
      if (!this.suspendedMusic || !this.suspendedMusic.key) {
        return;
      }

      const { key, time, volume } = this.suspendedMusic;
      const start = () => {
        const entry = this._ensureMusicEntry(key);
        if (!entry) {
          return;
        }

        const { audio } = entry;

        try {
          audio.currentTime = Number.isFinite(time) ? time : 0;
        } catch (error) {
          audio.src = audio.src;
        }

        const targetVolume = Number.isFinite(volume)
          ? volume
          : this._resolveMusicVolume(entry.definition);

        audio.volume = targetVolume;

        const playPromise = audio.play();
        if (typeof playPromise?.catch === 'function') {
          playPromise.catch(() => {});
        }

        this.currentMusicKey = key;
        this.activeMusicEntry = entry;
      };

      this.suspendedMusic = null;

      if (!this.unlocked) {
        this.pendingMusicKey = key;
        this.whenUnlocked().then(() => {
          if (this.pendingMusicKey === key) {
            start();
          }
        });
        return;
      }

      start();
    }

    playSfx(key, options = {}) {
      if (!key) {
        return;
      }

      const startPlayback = () => {
        const entry = this._ensureSfxEntry(key);
        if (!entry) {
          return;
        }

        const { definition, pool } = entry;
        const index = entry.nextIndex;
        const audio = pool[index];
        entry.nextIndex = (index + 1) % pool.length;

        audio.loop = false;
        audio.volume = this._resolveSfxVolume(definition, options.volume);

        try {
          audio.currentTime = 0;
        } catch (error) {
          audio.src = audio.src;
        }

        const playPromise = audio.play();
        if (typeof playPromise?.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      if (!this.unlocked) {
        this.whenUnlocked().then(() => startPlayback());
        return;
      }

      startPlayback();
    }

    _startMusicFade({ fromEntry = null, toEntry, targetVolume, durationSeconds }) {
      if (!toEntry || !toEntry.audio) {
        return;
      }

      const toAudio = toEntry.audio;
      const resolvedTarget = Number.isFinite(targetVolume)
        ? targetVolume
        : this._resolveMusicVolume(toEntry.definition);
      const durationMs = Math.max(
        0,
        Number.isFinite(durationSeconds) ? durationSeconds : this.musicCrossfadeDuration,
      ) * 1000;

      let fromAudio = fromEntry && fromEntry.audio !== toAudio ? fromEntry.audio : null;
      if (!fromAudio || fromAudio === toAudio) {
        fromAudio = null;
      }

      const fadeState = {
        fromEntry,
        toEntry,
        targetVolume: resolvedTarget,
      };
      this.activeMusicFade = fadeState;

      if (durationMs <= 0) {
        if (fromAudio) {
          fromAudio.volume = 0;
          fromAudio.pause();
          try {
            fromAudio.currentTime = 0;
          } catch (error) {
            fromAudio.src = fromAudio.src;
          }
        }
        toAudio.volume = resolvedTarget;
        this.musicFadeHandle = null;
        this.musicFadeCanceler = null;
        this.activeMusicFade = null;
        return;
      }

      const startTime = this._now();
      const startToVolume = toAudio.volume;
      const startFromVolume = fromAudio ? fromAudio.volume : 0;

      const schedule = typeof requestAnimationFrame === 'function'
        ? (fn) => requestAnimationFrame(fn)
        : (fn) => setTimeout(() => fn(this._now()), 16);
      const cancel = typeof cancelAnimationFrame === 'function'
        ? (id) => cancelAnimationFrame(id)
        : (id) => clearTimeout(id);

      const step = (timestamp) => {
        const now = typeof timestamp === 'number' ? timestamp : this._now();
        const elapsed = now - startTime;
        const progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
        if (fromAudio) {
          fromAudio.volume = startFromVolume * (1 - progress);
        }
        toAudio.volume = startToVolume + (resolvedTarget - startToVolume) * progress;
        if (progress < 1) {
          this.musicFadeHandle = schedule(step);
          this.musicFadeCanceler = cancel;
        } else {
          if (fromAudio) {
            fromAudio.volume = 0;
            fromAudio.pause();
            try {
              fromAudio.currentTime = 0;
            } catch (error) {
              fromAudio.src = fromAudio.src;
            }
          }
          toAudio.volume = resolvedTarget;
          this.musicFadeHandle = null;
          this.musicFadeCanceler = null;
          this.activeMusicFade = null;
        }
      };

      this.musicFadeHandle = schedule(step);
      this.musicFadeCanceler = cancel;
    }

    _cancelMusicFade(options = {}) {
      if (this.musicFadeHandle === null) {
        if (options.finalize && this.activeMusicFade) {
          const { fromEntry, toEntry, targetVolume } = this.activeMusicFade;
          if (fromEntry?.audio && fromEntry.audio !== toEntry?.audio) {
            fromEntry.audio.volume = 0;
            fromEntry.audio.pause();
            try {
              fromEntry.audio.currentTime = 0;
            } catch (error) {
              fromEntry.audio.src = fromEntry.audio.src;
            }
          }
          if (toEntry?.audio) {
            const resolved = Number.isFinite(targetVolume)
              ? targetVolume
              : this._resolveMusicVolume(toEntry.definition);
            toEntry.audio.volume = resolved;
          }
        }
        this.activeMusicFade = null;
        return;
      }
      if (typeof this.musicFadeCanceler === 'function') {
        this.musicFadeCanceler(this.musicFadeHandle);
      }
      this.musicFadeHandle = null;
      this.musicFadeCanceler = null;
      if (options.finalize && this.activeMusicFade) {
        const { fromEntry, toEntry, targetVolume } = this.activeMusicFade;
        if (fromEntry?.audio && fromEntry.audio !== toEntry?.audio) {
          fromEntry.audio.volume = 0;
          fromEntry.audio.pause();
          try {
            fromEntry.audio.currentTime = 0;
          } catch (error) {
            fromEntry.audio.src = fromEntry.audio.src;
          }
        }
        if (toEntry?.audio) {
          const resolved = Number.isFinite(targetVolume)
            ? targetVolume
            : this._resolveMusicVolume(toEntry.definition);
          toEntry.audio.volume = resolved;
        }
      }
      this.activeMusicFade = null;
    }

    _now() {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
      return Date.now();
    }

    _ensureMusicEntry(key) {
      let entry = this.musicElements.get(key);
      if (entry) {
        return entry;
      }

      const definition = this.musicDefinitions[key];
      const source = this._buildSource(definition, this.musicFolder);
      if (!definition || !source) {
        return null;
      }

      const audio = new Audio(source);
      audio.preload = definition.preload || 'auto';
      audio.loop = definition.loop !== false;
      audio.volume = this._resolveMusicVolume(definition);

      entry = { audio, definition };
      this.musicElements.set(key, entry);
      return entry;
    }

    _ensureSfxEntry(key) {
      let entry = this.sfxPools.get(key);
      if (entry) {
        return entry;
      }

      const definition = this.sfxDefinitions[key];
      const source = this._buildSource(definition, this.sfxFolder);
      if (!definition || !source) {
        return null;
      }

      const poolSize = Math.max(1, Math.floor(definition.maxConcurrent || definition.poolSize || 3));
      const pool = [];
      for (let index = 0; index < poolSize; index += 1) {
        const audio = new Audio(source);
        audio.preload = definition.preload || 'auto';
        audio.volume = this._resolveSfxVolume(definition);
        pool.push(audio);
      }

      entry = { definition, pool, nextIndex: 0 };
      this.sfxPools.set(key, entry);
      return entry;
    }

    _buildSource(definition, folder) {
      if (!definition) {
        return null;
      }
      if (definition.src) {
        return definition.src;
      }
      if (definition.file) {
        const sanitizedFolder = folder.endsWith('/') ? folder.slice(0, -1) : folder;
        return `${sanitizedFolder}/${definition.file}`;
      }
      return null;
    }

    _resolveMusicVolume(definition, overrideVolume) {
      const base = typeof overrideVolume === 'number'
        ? overrideVolume
        : typeof definition?.volume === 'number'
          ? definition.volume
          : 1;
      return this._clampVolume(base * this.musicVolume, 0);
    }

    _resolveSfxVolume(definition, overrideVolume) {
      const base = typeof overrideVolume === 'number'
        ? overrideVolume
        : typeof definition?.volume === 'number'
          ? definition.volume
          : 1;
      return this._clampVolume(base * this.sfxVolume, 0);
    }

    setMusicVolume(volume) {
      this.musicVolume = this._clampVolume(volume, this.musicVolume);
      this.musicElements.forEach((entry) => {
        if (!entry || !entry.audio) {
          return;
        }
        entry.audio.volume = this._resolveMusicVolume(entry.definition);
      });
      if (this.activeMusicEntry?.audio) {
        this.activeMusicEntry.audio.volume = this._resolveMusicVolume(
          this.activeMusicEntry.definition,
        );
      }
      return this.musicVolume;
    }

    setSfxVolume(volume) {
      this.sfxVolume = this._clampVolume(volume, this.sfxVolume);
      this.sfxPools.forEach((entry) => {
        if (!entry || !entry.pool) {
          return;
        }
        entry.pool.forEach((audio) => {
          if (audio) {
            audio.volume = this._resolveSfxVolume(entry.definition);
          }
        });
      });
      return this.sfxVolume;
    }

    _clampVolume(value, fallback = 1) {
      const resolved = typeof value === 'number' ? value : fallback;
      if (!Number.isFinite(resolved)) {
        return fallback;
      }
      return Math.min(1, Math.max(0, resolved));
    }
  }

  const AUDIO_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:audio';

  const audioManager = new AudioManager(audioManifest);

  const audioControlElements = {
    musicSlider: null,
    musicValue: null,
    sfxSlider: null,
    sfxValue: null,
  };

  function formatVolumeDisplay(volume) {
    const normalized = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    return `${Math.round(normalized * 100)}%`;
  }

  function getSliderVolume(slider) {
    if (!slider) {
      return 0;
    }
    const raw = Number(slider.value);
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.min(1, Math.max(0, raw / 100));
  }

  function updateVolumeDisplay(kind, volume) {
    const text = formatVolumeDisplay(volume);
    if (kind === 'music' && audioControlElements.musicValue) {
      audioControlElements.musicValue.textContent = text;
    }
    if (kind === 'sfx' && audioControlElements.sfxValue) {
      audioControlElements.sfxValue.textContent = text;
    }
  }

  function syncAudioControlsFromManager() {
    if (!audioManager) {
      return;
    }
    if (audioControlElements.musicSlider) {
      audioControlElements.musicSlider.value = String(
        Math.round(Math.min(1, Math.max(0, audioManager.musicVolume)) * 100),
      );
    }
    if (audioControlElements.sfxSlider) {
      audioControlElements.sfxSlider.value = String(
        Math.round(Math.min(1, Math.max(0, audioManager.sfxVolume)) * 100),
      );
    }
    updateVolumeDisplay('music', audioManager.musicVolume);
    updateVolumeDisplay('sfx', audioManager.sfxVolume);
  }

  function saveAudioSettings() {
    if (!audioManager) {
      return;
    }
    writeStorageJson(AUDIO_SETTINGS_STORAGE_KEY, {
      musicVolume: audioManager.musicVolume,
      sfxVolume: audioManager.sfxVolume,
    });
  }

  function bindAudioControls() {
    audioControlElements.musicSlider = document.getElementById('music-volume');
    audioControlElements.musicValue = document.getElementById('music-volume-value');
    audioControlElements.sfxSlider = document.getElementById('sfx-volume');
    audioControlElements.sfxValue = document.getElementById('sfx-volume-value');

    const attachSlider = (slider, kind, setter) => {
      if (!slider) {
        return;
      }
      const handleInput = () => {
        const volume = getSliderVolume(slider);
        setter(volume);
        updateVolumeDisplay(kind, volume);
      };
      const handleChange = () => {
        const volume = getSliderVolume(slider);
        setter(volume);
        updateVolumeDisplay(kind, volume);
        saveAudioSettings();
      };
      slider.addEventListener('input', handleInput);
      slider.addEventListener('change', handleChange);
    };

    attachSlider(audioControlElements.musicSlider, 'music', (volume) => {
      if (audioManager) {
        audioManager.setMusicVolume(volume);
      }
    });

    attachSlider(audioControlElements.sfxSlider, 'sfx', (volume) => {
      if (audioManager) {
        audioManager.setSfxVolume(volume);
      }
    });

    syncAudioControlsFromManager();

    if (audioManager) {
      const activationElements = [
        audioControlElements.musicSlider,
        audioControlElements.sfxSlider,
      ].filter(Boolean);
      audioManager.registerActivationElements(activationElements);
    }
  }

  function applyStoredAudioSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return;
    }
    if (Number.isFinite(settings.musicVolume) && audioManager) {
      audioManager.setMusicVolume(settings.musicVolume);
    }
    if (Number.isFinite(settings.sfxVolume) && audioManager) {
      audioManager.setSfxVolume(settings.sfxVolume);
    }
  }

  function playTowerPlacementNotes(audio, count = 1) {
    if (!audio || !Number.isFinite(count) || count <= 0) {
      return;
    }
    const keys = Array.isArray(TOWER_NOTE_SFX_KEYS) ? TOWER_NOTE_SFX_KEYS : [];
    if (!keys.length) {
      return;
    }
    const hasScheduler = typeof setTimeout === 'function';
    for (let index = 0; index < count; index += 1) {
      const noteKey = keys[Math.floor(Math.random() * keys.length)];
      if (!noteKey) {
        continue;
      }
      const play = () => audio.playSfx(noteKey);
      if (index > 0 && hasScheduler) {
        setTimeout(play, index * 120);
      } else {
        play();
      }
    }
  }

  function determineMusicKey() {
    const tab = activeTabId || 'tower';
    if (tab === 'tower') {
      const interactive = Boolean(
        playfield &&
          typeof playfield.isInteractiveLevelActive === 'function' &&
          playfield.isInteractiveLevelActive(),
      );
      return interactive ? 'levelActive' : 'levelSelect';
    }
    if (tab === 'towers') {
      return 'towers';
    }
    if (tab === 'powder') {
      return 'powder';
    }
    if (tab === 'achievements') {
      return 'achievements';
    }
    if (tab === 'options') {
      return 'codex';
    }
    return 'levelSelect';
  }

  function refreshTabMusic(options = {}) {
    if (!audioManager) {
      return;
    }
    const key = determineMusicKey();
    if (!key) {
      return;
    }
    audioManager.playMusic(key, options);
  }

  let achievementDefinitions = [];

  const achievementState = new Map();
  const achievementElements = new Map();
  let achievementGridEl = null;
  let activeAchievementId = null;

  const resourceElements = {
    score: null,
    scoreMultiplier: null,
    glyphsTotal: null,
    glyphsUnused: null,
    moteStorage: null,
    dispenseRate: null,
  };

  const baseResources = {
    score: 6.58 * 10 ** 45,
    scoreRate: 2.75 * 10 ** 43,
    energyRate: 575,
    fluxRate: 0,
  };

  const resourceState = {
    score: baseResources.score,
    scoreRate: baseResources.scoreRate,
    energyRate: baseResources.energyRate,
    fluxRate: baseResources.fluxRate,
    running: false,
  };

  let achievementPowderRate = 0;

  let glyphCurrency = 0;

  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
    simulatedDuneGainMax: 3.4,
    wallBaseGapMotes: 10,
    wallGapPerGlyph: 2,
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetActive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
    simulatedDuneGain: 0,
    wallGlyphsLit: 0,
    idleMoteBank: 100,
    idleDrainRate: 1,
    pendingMoteDrops: [],
    motePalette: mergeMotePalette(DEFAULT_MOTE_PALETTE),
    simulationMode: 'sand',
    wallGapTarget: powderConfig.wallBaseGapMotes,
    modeSwitchPending: false,
    fluidProfileLabel: 'Fluid Study',
  };

  let currentPowderBonuses = {
    sandBonus: 0,
    duneBonus: 0,
    crystalBonus: 0,
    totalMultiplier: 1,
  };

  const powderElements = {
    sandfallFormula: null,
    sandfallNote: null,
    sandfallButton: null,
    duneFormula: null,
    duneNote: null,
    duneButton: null,
    crystalFormula: null,
    crystalNote: null,
    crystalButton: null,
    totalMultiplier: null,
    sandBonusValue: null,
    duneBonusValue: null,
    crystalBonusValue: null,
    stockpile: null,
    idleMultiplier: null,
    dispenseRate: null,
    ledgerBaseScore: null,
    ledgerCurrentScore: null,
    ledgerFlux: null,
    ledgerEnergy: null,
    sigilEntries: [],
    logList: null,
    logEmpty: null,
    simulationCanvas: null,
    simulationNote: null,
    basin: null,
    wallMarker: null,
    crestMarker: null,
    wallGlyphColumns: [],
    leftWall: null,
    rightWall: null,
    leftHitbox: null,
    rightHitbox: null,
    modeToggle: null,
  };

  // Powder simulation metrics are supplied via the powder tower module.
  const powderGlyphColumns = [];
  let powderWallMetrics = null;

  function updatePowderGlyphColumns(info = {}) {
    const rows = Number.isFinite(info.rows) && info.rows > 0 ? info.rows : 1;
    const cellSize = Number.isFinite(info.cellSize) && info.cellSize > 0 ? info.cellSize : POWDER_CELL_SIZE_PX;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const highestRawInput = Number.isFinite(info.highestNormalized) ? info.highestNormalized : 0;
    const totalRawInput = Number.isFinite(info.totalNormalized) ? info.totalNormalized : highestRawInput;
    const highestNormalized = Math.max(0, highestRawInput, totalRawInput);
    const GLYPH_SPACING_NORMALIZED = 0.5;
    const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
    const safeRows = Math.max(1, rows);
    const basinHeight = safeRows * cellSize;
    const viewTopNormalized = scrollOffset / safeRows;
    const viewBottomNormalized = (scrollOffset + safeRows) / safeRows;
    const bufferGlyphs = 2;

    const normalizeIndex = (value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.floor((value - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED);
    };

    const rawMinIndex = normalizeIndex(viewTopNormalized);
    const rawMaxIndex = Math.ceil(
      (viewBottomNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED,
    );
    const minIndex = Math.max(0, (Number.isFinite(rawMinIndex) ? rawMinIndex : 0) - bufferGlyphs);
    const maxIndex = Math.max(
      minIndex,
      (Number.isFinite(rawMaxIndex) ? rawMaxIndex : 0) + bufferGlyphs,
    );

    const glyphHeightForIndex = (index) =>
      GLYPH_BASE_NORMALIZED + Math.max(0, index) * GLYPH_SPACING_NORMALIZED;

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          if (index < minIndex || index > maxIndex) {
            column.element.removeChild(glyph);
            column.glyphs.delete(index);
          }
        });

        for (let index = minIndex; index <= maxIndex; index += 1) {
          let glyph = column.glyphs.get(index);
          if (!glyph) {
            glyph = document.createElement('span');
            glyph.className = 'powder-glyph';
            glyph.dataset.alephIndex = String(index);
            column.element.appendChild(glyph);
            column.glyphs.set(index, glyph);
          }
          glyph.textContent = formatAlephLabel(index);
          const glyphNormalized = glyphHeightForIndex(index);
          const relativeRows = glyphNormalized * safeRows - scrollOffset;
          const topPx = basinHeight - relativeRows * cellSize;
          glyph.style.top = `${topPx.toFixed(1)}px`;
          const achieved = highestNormalized >= glyphNormalized;
          glyph.classList.toggle('powder-glyph--achieved', achieved);
        }
      });
    }

    const glyphsLit =
      highestNormalized >= GLYPH_BASE_NORMALIZED
        ? Math.max(
            0,
            Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1,
          )
        : 0;
    const achievedIndex = glyphsLit > 0 ? glyphsLit - 1 : 0;
    const nextIndex = glyphsLit;
    const previousThreshold =
      glyphsLit > 0
        ? GLYPH_BASE_NORMALIZED + (glyphsLit - 1) * GLYPH_SPACING_NORMALIZED
        : 0;
    const nextThreshold = GLYPH_BASE_NORMALIZED + glyphsLit * GLYPH_SPACING_NORMALIZED;
    const span = Math.max(GLYPH_SPACING_NORMALIZED, nextThreshold - previousThreshold);
    const progressFraction = clampUnitInterval((highestNormalized - previousThreshold) / span);
    const remainingToNext = Math.max(0, nextThreshold - highestNormalized);

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          const isTarget = index === nextIndex;
          const glyphNormalized = glyphHeightForIndex(index);
          glyph.classList.toggle('powder-glyph--target', isTarget);
          glyph.classList.toggle('powder-glyph--achieved', highestNormalized >= glyphNormalized);
        });
      });
    }

    return {
      achievedCount: achievedIndex,
      nextIndex,
      highestRaw: highestNormalized,
      glyphsLit,
      progressFraction,
      remainingToNext,
    };
  }

  function syncPowderWallVisuals(metrics) {
    const activeMetrics =
      metrics || powderWallMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    if (!activeMetrics) {
      return;
    }

    const { leftCells, rightCells, gapCells, cellSize } = activeMetrics;
    const leftWidth = Math.max(0, leftCells * cellSize);
    const rightWidth = Math.max(0, rightCells * cellSize);
    const gapWidth = Math.max(0, gapCells * cellSize);

    if (powderElements.leftWall) {
      powderElements.leftWall.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (powderElements.leftHitbox) {
      powderElements.leftHitbox.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (powderElements.rightHitbox) {
      powderElements.rightHitbox.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (powderElements.basin) {
      powderElements.basin.style.setProperty('--powder-gap-width', `${gapWidth.toFixed(1)}px`);
    }
  }

  function updatePowderHitboxVisibility() {
    const metrics = powderWallMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    const showHitboxes = developerModeActive && metrics;
    if (powderElements.leftHitbox) {
      powderElements.leftHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics.leftCells > 0),
      );
    }
    if (powderElements.rightHitbox) {
      powderElements.rightHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics.rightCells > 0),
      );
    }
  }

  function handlePowderWallMetricsChange(metrics) {
    powderWallMetrics = metrics || null;
    syncPowderWallVisuals(metrics || undefined);
    updatePowderHitboxVisibility();
  }

  function updatePowderWallGapFromGlyphs(glyphCount) {
    const normalized = Number.isFinite(glyphCount) ? Math.max(0, glyphCount) : 0;
    const target = powderConfig.wallBaseGapMotes + normalized * powderConfig.wallGapPerGlyph;
    powderState.wallGapTarget = target;
    if (!powderSimulation) {
      return;
    }
    powderSimulation.setWallGapTarget(target);
    powderWallMetrics = powderSimulation.getWallMetrics();
    syncPowderWallVisuals(powderWallMetrics);
    updatePowderHitboxVisibility();
  }

  function updatePowderModeButton() {
    if (!powderElements.modeToggle) {
      return;
    }
    const mode = powderState.simulationMode;
    const fluidLabel = powderState.fluidProfileLabel || 'Fluid Study';
    powderElements.modeToggle.textContent =
      mode === 'fluid' ? 'Return to Powderfall' : `Switch to ${fluidLabel}`;
    powderElements.modeToggle.setAttribute('aria-pressed', mode === 'fluid' ? 'true' : 'false');
  }

  async function applyPowderSimulationMode(mode) {
    if (mode !== 'sand' && mode !== 'fluid') {
      return;
    }
    if (powderState.modeSwitchPending) {
      return;
    }

    powderState.modeSwitchPending = true;
    if (powderElements.modeToggle) {
      powderElements.modeToggle.disabled = true;
    }

    const previousMode = powderState.simulationMode;
    try {
      if (mode === 'fluid') {
        const profile = await loadFluidSimulationProfile();
        if (!profile) {
          throw new Error('Fluid simulation profile unavailable.');
        }
        powderState.fluidProfileLabel = profile.label || powderState.fluidProfileLabel;
        if (powderSimulation) {
          powderSimulation.applyProfile(profile);
          powderState.motePalette = powderSimulation.getEffectiveMotePalette();
          powderState.idleDrainRate = powderSimulation.idleDrainRate;
          powderState.simulationMode = 'fluid';
          updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit || 0);
        } else {
          powderState.simulationMode = 'fluid';
        }
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'fluid', label: profile.label || 'Fluid Study' });
        }
      } else {
        if (powderSimulation) {
          const baseProfile = powderSimulation.getDefaultProfile();
          powderSimulation.applyProfile(baseProfile || undefined);
          powderState.motePalette = powderSimulation.getEffectiveMotePalette();
          powderState.idleDrainRate = powderSimulation.idleDrainRate;
        }
        powderState.simulationMode = 'sand';
        updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit || 0);
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'sand', label: 'Powderfall Study' });
        }
      }
      updateMoteStatsDisplays();
    } catch (error) {
      console.error('Unable to switch simulation mode.', error);
    } finally {
      powderState.modeSwitchPending = false;
      if (powderElements.modeToggle) {
        powderElements.modeToggle.disabled = false;
      }
      updatePowderModeButton();
      syncPowderWallVisuals();
      updatePowderHitboxVisibility();
    }
  }

  async function handlePowderModeToggle() {
    if (powderState.modeSwitchPending) {
      return;
    }
    const nextMode = powderState.simulationMode === 'fluid' ? 'sand' : 'fluid';
    await applyPowderSimulationMode(nextMode);
  }

  let resourceTicker = null;
  let lastResourceTick = 0;

  const powderLog = [];
  const POWDER_LOG_LIMIT = 6;

  const storageKeys = {
    offline: 'glyph-defense-idle:offline',
    powder: 'glyph-defense-idle:powder',
    audio: AUDIO_SETTINGS_STORAGE_KEY,
  };

  let powderCurrency = 0;
  let powderSaveHandle = null;

  const offlineOverlayElements = {
    container: null,
    minutes: null,
    rate: null,
    total: null,
    prompt: null,
  };
  let offlineOverlayAnimating = false;
  let offlineOverlayFadeHandle = null;
  let offlineOverlayPromptHandle = null;
  let offlineOverlayLastFocus = null;
  const OFFLINE_OVERLAY_FADE_MS = 220;
  const OFFLINE_PROMPT_DELAY_MS = 10000;

  let powderBasinPulseTimer = null;

  const idleLevelRuns = new Map();

  let powderSimulation = null;
  let powderBasinObserver = null;

  function queueMoteDrop(size) {
    if (!Number.isFinite(size) || size <= 0) {
      return;
    }
    const normalized = Math.max(1, Math.round(size));
    if (powderSimulation) {
      powderSimulation.queueDrop(normalized);
      return;
    }
    powderState.pendingMoteDrops.push(normalized);
  }

  function addIdleMoteBank(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    if (powderSimulation) {
      powderSimulation.addIdleMotes(amount);
    } else {
      powderState.idleMoteBank = Math.max(0, powderState.idleMoteBank + amount);
    }
    updateStatusDisplays();
  }

  function flushPendingMoteDrops() {
    if (!powderSimulation) {
      return;
    }
    if (powderState.pendingMoteDrops.length) {
      powderState.pendingMoteDrops.forEach((size) => {
        powderSimulation.queueDrop(size);
      });
      powderState.pendingMoteDrops.length = 0;
    }
    if (powderState.idleMoteBank > 0) {
      powderSimulation.addIdleMotes(powderState.idleMoteBank);
      powderState.idleMoteBank = 0;
    }
    updateStatusDisplays();
  }

  class SimplePlayfield {
    constructor(options) {
      this.canvas = options.canvas || null;
      this.container = options.container || null;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.messageEl = options.messageEl || null;
      this.waveEl = options.waveEl || null;
      this.healthEl = options.healthEl || null;
      this.energyEl = options.energyEl || null;
      this.progressEl = options.progressEl || null;
      this.startButton = options.startButton || null;
      this.speedButton = options.speedButton || null;
      this.autoAnchorButton = options.autoAnchorButton || null;
      this.autoWaveCheckbox = options.autoWaveCheckbox || null;
      this.previewOnly = Boolean(options.previewOnly);
      this.speedMultipliers =
        Array.isArray(options.speedMultipliers) && options.speedMultipliers.length
          ? options.speedMultipliers.slice()
          : [1, 1.5, 2, 3];
      this.speedIndex = 0;
      this.speedMultiplier = this.speedMultipliers[this.speedIndex];
      this.slotButtons = Array.isArray(options.slotButtons) ? options.slotButtons : [];
      this.onVictory = typeof options.onVictory === 'function' ? options.onVictory : null;
      this.onDefeat = typeof options.onDefeat === 'function' ? options.onDefeat : null;
      this.onCombatStart =
        typeof options.onCombatStart === 'function' ? options.onCombatStart : null;
      this.audio = options.audioManager || options.audio || null;

      this.levelConfig = null;
      this.levelActive = false;
      this.shouldAnimate = false;
      this.combatActive = false;
      this.resolvedOutcome = null;

      this.renderWidth = this.canvas ? this.canvas.clientWidth : 0;
      this.renderHeight = this.canvas ? this.canvas.clientHeight : 0;
      this.pixelRatio = 1;

      this.arcOffset = 0;
      this.energy = 0;
      this.lives = 0;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;
      this.baseWaveCount = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.isEndlessMode = false;
      this.endlessCycle = 0;
      this.initialSpawnDelay = 0;
      this.autoWaveEnabled = true;
      this.autoStartLeadTime = 5;
      this.autoStartTimer = null;
      this.autoStartDeadline = 0;

      this.pathSegments = [];
      this.pathPoints = [];
      this.pathLength = 0;

      this.slots = new Map();
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.availableTowers = [];
      this.draggingTowerType = null;
      this.dragPreviewOffset = { x: 0, y: -34 };

      this.floaters = [];
      this.floaterConnections = [];
      this.floaterBounds = { width: 0, height: 0 };

      this.alephChain = createAlephChainRegistry({ upgrades: alephChainUpgradeState });

      this.animationId = null;
      this.lastTimestamp = 0;

      this.resizeObserver = null;
      this.resizeHandler = () => this.syncCanvasSize();

      this.towerIdCounter = 0;
      this.hoverPlacement = null;
      this.hoverEnemy = null;
      this.pointerPosition = null;
      this.focusedEnemyId = null;
      this.focusMarkerAngle = 0;
      this.anchorTolerance = 0.06;

      this.viewScale = 1;
      this.minViewScale = 0.75;
      this.maxViewScale = 2.5;
      this.viewCenterNormalized = { x: 0.5, y: 0.5 };

      this.activePointers = new Map();
      this.pinchState = null;
      this.isPinchZooming = false;

      this.pointerMoveHandler = (event) => this.handleCanvasPointerMove(event);
      this.pointerLeaveHandler = () => this.handleCanvasPointerLeave();
      this.pointerClickHandler = (event) => this.handleCanvasClick(event);
      this.pointerDownHandler = (event) => this.handleCanvasPointerDown(event);
      this.pointerUpHandler = (event) => this.handleCanvasPointerUp(event);
      this.wheelHandler = (event) => this.handleCanvasWheel(event);

      this.developerPathMarkers = [];

      this.enemyTooltip = null;
      this.enemyTooltipNameEl = null;
      this.enemyTooltipHpEl = null;

      if (!this.previewOnly) {
        this.registerSlots();
        this.bindStartButton();
        this.bindSpeedButton();
        this.bindAutoAnchorButton();
        this.bindAutoWaveCheckbox();
        this.attachResizeObservers();
        this.attachCanvasInteractions();
        this.createEnemyTooltip();

        this.disableSlots(true);
        this.updateHud();
        this.updateProgress();
        this.updateSpeedButton();
        this.updateAutoAnchorButton();
      }
    }

    registerSlots() {
      this.slotButtons.forEach((button) => {
        const slotId = button.dataset.slotId;
        const x = Number.parseFloat(button.dataset.slotX);
        const y = Number.parseFloat(button.dataset.slotY);
        if (!slotId || Number.isNaN(x) || Number.isNaN(y)) {
          return;
        }
        const slot = {
          id: slotId,
          button,
          normalized: { x, y },
          tower: null,
        };
        this.slots.set(slotId, slot);
        button.addEventListener('click', () => this.handleSlotInteraction(slot));
        button.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleSlotInteraction(slot);
          }
        });
      });
    }

    setAvailableTowers(towerIds = []) {
      if (Array.isArray(towerIds)) {
        this.availableTowers = towerIds.filter(
          (towerId) => getTowerDefinition(towerId) && isTowerUnlocked(towerId),
        );
      } else {
        this.availableTowers = [];
      }
      refreshTowerLoadoutDisplay();
    }

    getActiveTowerCount(towerId) {
      if (!towerId || !Array.isArray(this.towers)) {
        return 0;
      }
      let count = 0;
      for (let index = 0; index < this.towers.length; index += 1) {
        if (this.towers[index]?.type === towerId) {
          count += 1;
        }
      }
      return count;
    }

    getCurrentTowerCost(towerId) {
      const definition = getTowerDefinition(towerId);
      if (!definition) {
        return Number.POSITIVE_INFINITY;
      }
      const activeCount = this.getActiveTowerCount(towerId);
      const exponent = 1 + Math.max(0, activeCount);
      return definition.baseCost ** exponent;
    }

    setDraggingTower(towerId) {
      this.draggingTowerType = towerId;
    }

    finishTowerDrag() {
      this.draggingTowerType = null;
    }

    previewTowerPlacement(normalized, { towerType, dragging = false } = {}) {
      if (!normalized || !towerType) {
        this.clearPlacementPreview();
        return;
      }
      this.updatePlacementPreview(normalized, { towerType, dragging });
    }

    completeTowerPlacement(normalized, { towerType } = {}) {
      if (!towerType) {
        this.clearPlacementPreview();
        return false;
      }

      let targetNormalized = normalized ? { ...normalized } : null;
      if (
        this.hoverPlacement &&
        this.hoverPlacement.towerType === towerType &&
        this.hoverPlacement.dragging &&
        this.hoverPlacement.normalized
      ) {
        targetNormalized = { ...this.hoverPlacement.normalized };
      }

      if (!targetNormalized) {
        this.clearPlacementPreview();
        return false;
      }

      const placed = this.addTowerAt(targetNormalized, { towerType });
      if (placed) {
        this.clearPlacementPreview();
      }
      return placed;
    }

    bindStartButton() {
      if (!this.startButton) {
        return;
      }
      this.startButton.addEventListener('click', () => this.handleStartButton());
    }

    bindSpeedButton() {
      if (!this.speedButton) {
        return;
      }
      this.speedButton.addEventListener('click', () => {
        if (this.audio) {
          this.audio.unlock();
        }
        if (!this.isInteractiveLevelActive()) {
          if (this.messageEl) {
            this.messageEl.textContent =
              'Enter an interactive level to adjust the simulation speed.';
          }
          return;
        }
        this.cycleSpeedMultiplier();
        if (this.audio) {
          this.audio.playSfx('uiToggle');
        }
      });
    }

    bindAutoAnchorButton() {
      if (!this.autoAnchorButton) {
        return;
      }
      this.autoAnchorButton.addEventListener('click', () => {
        if (this.audio) {
          this.audio.unlock();
        }
        if (!this.isInteractiveLevelActive()) {
          if (this.messageEl) {
            this.messageEl.textContent =
              'Enter an interactive level to auto-lattice recommended anchors.';
          }
          return;
        }
        this.autoAnchorTowers();
      });
    }

    bindAutoWaveCheckbox() {
      if (!this.autoWaveCheckbox) {
        return;
      }
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
      this.autoWaveCheckbox.disabled = true;
      this.autoWaveCheckbox.addEventListener('change', () => {
        if (!this.autoWaveCheckbox) {
          return;
        }
        this.autoWaveEnabled = this.autoWaveCheckbox.checked;
        if (!this.levelActive || !this.levelConfig || this.combatActive) {
          if (!this.autoWaveEnabled) {
            this.cancelAutoStart();
          }
          return;
        }
        if (this.autoWaveEnabled) {
          this.scheduleAutoStart({ delay: this.autoStartLeadTime });
        } else {
          this.cancelAutoStart();
          if (this.messageEl) {
            this.messageEl.textContent =
              'Auto-start disabled—commence waves when your lattice is ready.';
          }
        }
      });
    }

    scheduleAutoStart(options = {}) {
      if (
        !this.autoWaveEnabled ||
        !this.levelActive ||
        !this.levelConfig ||
        this.combatActive
      ) {
        return;
      }
      const delay = Number.isFinite(options.delay)
        ? Math.max(0, options.delay)
        : this.autoStartLeadTime;
      this.cancelAutoStart();
      if (typeof window === 'undefined') {
        return;
      }
      this.autoStartDeadline = Date.now() + delay * 1000;
      this.autoStartTimer = window.setTimeout(() => {
        this.autoStartTimer = null;
        this.tryAutoStart();
      }, delay * 1000);
    }

    cancelAutoStart() {
      if (this.autoStartTimer) {
        clearTimeout(this.autoStartTimer);
        this.autoStartTimer = null;
      }
      this.autoStartDeadline = 0;
    }

    tryAutoStart() {
      if (
        !this.autoWaveEnabled ||
        !this.levelActive ||
        !this.levelConfig ||
        this.combatActive
      ) {
        return;
      }
      if (!this.towers.length) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Awaiting lattice placements—auto-start resumes once towers are in place.';
        }
        this.scheduleAutoStart({ delay: 1.5 });
        return;
      }
      this.autoStartDeadline = 0;
      this.handleStartButton();
    }

    attachResizeObservers() {
      if (!this.canvas) {
        return;
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.resizeHandler);
      }
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
        this.resizeObserver.observe(this.canvas);
      }
      this.syncCanvasSize();
    }

    attachCanvasInteractions() {
      if (!this.canvas) {
        return;
      }
      this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
      this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
      this.canvas.addEventListener('pointerleave', this.pointerLeaveHandler);
      this.canvas.addEventListener('click', this.pointerClickHandler);
      this.canvas.addEventListener('pointerup', this.pointerUpHandler);
      this.canvas.addEventListener('pointercancel', this.pointerUpHandler);
      this.canvas.addEventListener('lostpointercapture', this.pointerUpHandler);
      this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    }

    createEnemyTooltip() {
      if (!this.container || this.enemyTooltip) {
        return;
      }

      const tooltip = document.createElement('div');
      tooltip.className = 'enemy-tooltip';

      const nameEl = document.createElement('div');
      nameEl.className = 'enemy-tooltip-name';

      const hpEl = document.createElement('div');
      hpEl.className = 'enemy-tooltip-hp';

      tooltip.append(nameEl, hpEl);
      tooltip.setAttribute('aria-hidden', 'true');

      this.container.appendChild(tooltip);
      this.enemyTooltip = tooltip;
      this.enemyTooltipNameEl = nameEl;
      this.enemyTooltipHpEl = hpEl;
    }

    syncCanvasSize() {
      if (!this.canvas || !this.ctx) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.renderWidth = rect.width || 1;
      this.renderHeight = rect.height || 1;
      this.pixelRatio = ratio;

      this.buildPathGeometry();
      this.updateTowerPositions();
      this.ensureFloatersLayout();
      this.applyViewConstraints();
      this.draw();
    }

    buildPathGeometry() {
      if (
        !this.levelConfig ||
        !Array.isArray(this.levelConfig.path) ||
        this.levelConfig.path.length < 2 ||
        !this.ctx
      ) {
        this.pathSegments = [];
        this.pathPoints = [];
        this.pathLength = 0;
        return;
      }

      const points = this.levelConfig.path.map((node) => ({
        x: node.x * this.renderWidth,
        y: node.y * this.renderHeight,
      }));

      const smoothPoints = this.generateSmoothPathPoints(points, 14);

      const segments = [];
      let totalLength = 0;
      for (let index = 0; index < smoothPoints.length - 1; index += 1) {
        const start = smoothPoints[index];
        const end = smoothPoints[index + 1];
        const length = this.distanceBetween(start, end);
        segments.push({ start, end, length });
        totalLength += length;
      }

      this.pathPoints = smoothPoints;
      this.pathSegments = segments;
      this.pathLength = totalLength || 1;
    }

    computeFloaterCount(width, height) {
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return 0;
      }
      const area = Math.max(0, width * height);
      const base = Math.round(area / 24000);
      return Math.max(18, Math.min(64, base));
    }

    randomFloaterRadiusFactor() {
      return 0.0075 + Math.random() * 0.0045;
    }

    createFloater(width, height) {
      const margin = Math.min(width, height) * 0.08;
      const usableWidth = Math.max(1, width - margin * 2);
      const usableHeight = Math.max(1, height - margin * 2);
      return {
        x: margin + Math.random() * usableWidth,
        y: margin + Math.random() * usableHeight,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        ax: 0,
        ay: 0,
        radiusFactor: this.randomFloaterRadiusFactor(),
        opacity: 0,
        opacityTarget: 0,
      };
    }

    ensureFloatersLayout() {
      const width = this.renderWidth || 0;
      const height = this.renderHeight || 0;

      if (!this.levelConfig || !width || !height) {
        this.floaters = [];
        this.floaterConnections = [];
        this.floaterBounds = { width, height };
        return;
      }

      const previousWidth = this.floaterBounds?.width || width;
      const previousHeight = this.floaterBounds?.height || height;
      const scaleX = previousWidth ? width / previousWidth : 1;
      const scaleY = previousHeight ? height / previousHeight : 1;

      if (this.floaters.length && (scaleX !== 1 || scaleY !== 1)) {
        this.floaters.forEach((floater) => {
          floater.x *= scaleX;
          floater.y *= scaleY;
          floater.vx *= scaleX;
          floater.vy *= scaleY;
        });
      }

      const desired = this.computeFloaterCount(width, height);

      if (!this.floaters.length) {
        this.floaters = [];
      }

      if (this.floaters.length < desired) {
        const needed = desired - this.floaters.length;
        for (let index = 0; index < needed; index += 1) {
          this.floaters.push(this.createFloater(width, height));
        }
      } else if (this.floaters.length > desired) {
        this.floaters.length = desired;
      }

      const safeMargin = Math.min(width, height) * 0.04;
      this.floaters.forEach((floater) => {
        floater.x = Math.min(width - safeMargin, Math.max(safeMargin, floater.x));
        floater.y = Math.min(height - safeMargin, Math.max(safeMargin, floater.y));
        if (!Number.isFinite(floater.vx)) {
          floater.vx = 0;
        }
        if (!Number.isFinite(floater.vy)) {
          floater.vy = 0;
        }
        if (!Number.isFinite(floater.radiusFactor)) {
          floater.radiusFactor = this.randomFloaterRadiusFactor();
        }
        floater.opacity = Number.isFinite(floater.opacity) ? floater.opacity : 0;
        floater.opacityTarget = Number.isFinite(floater.opacityTarget)
          ? floater.opacityTarget
          : 0;
        floater.ax = Number.isFinite(floater.ax) ? floater.ax : 0;
        floater.ay = Number.isFinite(floater.ay) ? floater.ay : 0;
      });

      this.floaterBounds = { width, height };
    }

    generateSmoothPathPoints(points, subdivisions = 12) {
      if (!Array.isArray(points) || points.length < 2) {
        return Array.isArray(points) ? points.slice() : [];
      }

      const smooth = [];
      const steps = Math.max(1, subdivisions);

      for (let index = 0; index < points.length - 1; index += 1) {
        const previous = index > 0 ? points[index - 1] : points[index];
        const current = points[index];
        const next = points[index + 1];
        const afterNext = index + 2 < points.length ? points[index + 2] : next;

        for (let step = 0; step < steps; step += 1) {
          const t = step / steps;
          const x = this.catmullRom(previous.x, current.x, next.x, afterNext.x, t);
          const y = this.catmullRom(previous.y, current.y, next.y, afterNext.y, t);
          const point = { x, y };
          if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], point) > 0.5) {
            smooth.push(point);
          }
        }
      }

      const lastPoint = points[points.length - 1];
      if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], lastPoint) > 0) {
        smooth.push({ ...lastPoint });
      }

      return smooth;
    }

    catmullRom(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        0.5 *
        ((2 * p1) +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
      );
    }

    distanceBetween(a, b) {
      if (!a || !b) {
        return 0;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return Math.hypot(dx, dy);
    }

    ensureLoop() {
      if (this.animationId || !this.shouldAnimate) {
        return;
      }
      this.animationId = requestAnimationFrame((timestamp) => this.tick(timestamp));
    }

    stopLoop() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.lastTimestamp = 0;
    }

    tick(timestamp) {
      if (!this.shouldAnimate) {
        this.animationId = null;
        this.lastTimestamp = 0;
        return;
      }

      const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
      this.lastTimestamp = timestamp;

      const safeDelta = Math.min(delta, 0.12);
      this.update(safeDelta);
      this.draw();

      this.animationId = requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
    }

    enterLevel(level, options = {}) {
      if (!this.container) {
        return;
      }

      const levelId = level?.id;
      const config = levelId ? levelConfigs.get(levelId) : null;
      const isInteractive = Boolean(config);
      const startInEndless = Boolean(options.endlessMode || config?.forceEndlessMode);

      if (this.previewOnly && !isInteractive) {
        this.levelActive = false;
        this.levelConfig = null;
        this.combatActive = false;
        this.shouldAnimate = false;
        this.stopLoop();
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        return;
      }

      this.cancelAutoStart();

      if (!isInteractive) {
        this.levelActive = false;
        this.levelConfig = null;
        this.combatActive = false;
        this.shouldAnimate = false;
        this.isEndlessMode = false;
        this.endlessCycle = 0;
        this.baseWaveCount = 0;
        this.currentWaveNumber = 1;
        this.maxWaveReached = 0;
        this.stopLoop();
        this.disableSlots(true);
        this.enemies = [];
        this.projectiles = [];
        this.towers = [];
        this.energy = 0;
        this.lives = 0;
        if (this.autoWaveCheckbox) {
          this.autoWaveCheckbox.checked = this.autoWaveEnabled;
          this.autoWaveCheckbox.disabled = true;
        }
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.messageEl) {
          this.messageEl.textContent = 'This level preview is not interactive yet.';
        }
        if (this.waveEl) this.waveEl.textContent = '—';
        if (this.healthEl) this.healthEl.textContent = '—';
        if (this.energyEl) this.energyEl.textContent = '—';
        if (this.progressEl) {
          this.progressEl.textContent = 'Select an unlocked level to battle.';
        }
        if (this.startButton) {
          this.startButton.textContent = 'Preview Only';
          this.startButton.disabled = true;
        }
        this.updateSpeedButton();
        this.updateAutoAnchorButton();
        cancelTowerDrag();
        return;
      }

      const clonedConfig = {
        ...config,
        waves: config.waves.map((wave) => ({ ...wave })),
        path: config.path.map((node) => ({ ...node })),
        autoAnchors: Array.isArray(config.autoAnchors)
          ? config.autoAnchors.map((anchor) => ({ ...anchor }))
          : [],
      };

      const forceInfiniteThero = Boolean(config?.infiniteThero);
      if (forceInfiniteThero) {
        clonedConfig.infiniteThero = true;
        clonedConfig.startThero = Number.POSITIVE_INFINITY;
        clonedConfig.theroCap = Number.POSITIVE_INFINITY;
      } else {
        const dynamicStartThero = calculateStartingThero();
        clonedConfig.startThero = Number.isFinite(dynamicStartThero)
          ? dynamicStartThero
          : BASE_START_THERO;
      }
      clonedConfig.forceEndlessMode = Boolean(config?.forceEndlessMode);
      clonedConfig.lives = BASE_CORE_INTEGRITY;

      this.levelActive = true;
      this.levelConfig = clonedConfig;
      this.baseWaveCount = clonedConfig.waves.length;
      this.isEndlessMode = startInEndless;
      this.endlessCycle = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.viewScale = 1;
      this.viewCenterNormalized = { x: 0.5, y: 0.5 };
      this.applyViewConstraints();
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
      if (this.previewOnly) {
        this.combatActive = false;
        this.shouldAnimate = false;
        this.stopLoop();
        this.arcOffset = 0;
        this.enemies = [];
        this.projectiles = [];
        this.towers = [];
        this.hoverPlacement = null;
        this.pointerPosition = null;
        this.syncCanvasSize();
        if (typeof window !== 'undefined') {
          const activeLevelId = this.levelConfig?.id;
          const attemptSync = () => {
            if (!this.previewOnly) {
              return;
            }
            if (!this.levelConfig || this.levelConfig.id !== activeLevelId) {
              return;
            }
            const rect = this.canvas ? this.canvas.getBoundingClientRect() : null;
            if (!rect || rect.width < 2 || rect.height < 2) {
              window.requestAnimationFrame(attemptSync);
              return;
            }
            this.syncCanvasSize();
          };
          window.requestAnimationFrame(attemptSync);
        }
        return;
      }

      this.setAvailableTowers(towerLoadoutState.selected);
      this.shouldAnimate = true;
      this.resetState();
      this.enableSlots();
      this.syncCanvasSize();
      this.ensureLoop();

      if (this.startButton) {
        this.startButton.textContent = 'Commence Wave';
        this.startButton.disabled = false;
      }
      if (this.autoWaveCheckbox) {
        this.autoWaveCheckbox.disabled = false;
        this.autoWaveCheckbox.checked = this.autoWaveEnabled;
      }
      if (this.messageEl) {
        this.messageEl.textContent = this.isEndlessMode
          ? 'Endless defense unlocked—survive as the waves loop.'
          : 'Drag glyph chips from your loadout anywhere on the plane—no fixed anchors required.';
      }
      if (this.progressEl) {
        this.progressEl.textContent = this.isEndlessMode
          ? 'Waves loop infinitely. Each completed cycle multiplies enemy strength ×10.'
          : 'Wave prep underway.';
      }
      if (this.autoWaveEnabled) {
        this.scheduleAutoStart({ delay: this.autoStartLeadTime });
      }
      this.updateHud();
      this.updateProgress();
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }

    leaveLevel() {
      if (this.previewOnly) {
        this.levelActive = false;
        this.levelConfig = null;
        this.combatActive = false;
        this.shouldAnimate = false;
        this.stopLoop();
        this.enemies = [];
        this.projectiles = [];
        this.towers = [];
        this.pathSegments = [];
        this.pathPoints = [];
        this.pathLength = 0;
        this.floaters = [];
        this.floaterConnections = [];
        this.arcOffset = 0;
        this.hoverPlacement = null;
        this.pointerPosition = null;
        this.developerPathMarkers = [];
        this.viewScale = 1;
        this.viewCenterNormalized = { x: 0.5, y: 0.5 };
        this.applyViewConstraints();
        this.activePointers.clear();
        this.pinchState = null;
        this.isPinchZooming = false;
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        return;
      }

      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.cancelAutoStart();
      this.stopLoop();
      this.disableSlots(true);
      this.enemies = [];
      this.projectiles = [];
      this.floaters = [];
      this.floaterConnections = [];
      this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
      this.towers = [];
      this.alephChain.reset();
      this.hoverPlacement = null;
      this.clearFocusedEnemy({ silent: true });
      this.energy = 0;
      this.lives = 0;
      this.resolvedOutcome = null;
      this.arcOffset = 0;
      this.isEndlessMode = false;
      this.endlessCycle = 0;
      this.baseWaveCount = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.setAvailableTowers([]);
      cancelTowerDrag();
      this.viewScale = 1;
      this.viewCenterNormalized = { x: 0.5, y: 0.5 };
      this.applyViewConstraints();
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      if (this.messageEl) {
        this.messageEl.textContent = 'Select a level to command the defense.';
      }
      if (this.waveEl) this.waveEl.textContent = '—';
      if (this.healthEl) this.healthEl.textContent = '—';
      if (this.energyEl) this.energyEl.textContent = '—';
      if (this.progressEl) this.progressEl.textContent = 'No active level.';
      if (this.startButton) {
        this.startButton.textContent = 'Commence Wave';
        this.startButton.disabled = true;
      }
      if (this.autoWaveCheckbox) {
        this.autoWaveCheckbox.checked = this.autoWaveEnabled;
        this.autoWaveCheckbox.disabled = true;
      }
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }

    resetState() {
      if (!this.levelConfig) {
        this.energy = 0;
        this.lives = 0;
      } else {
        this.energy = this.levelConfig.startThero || 0;
        this.lives = this.levelConfig.lives;
      }
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;
      this.towerIdCounter = 0;
      this.arcOffset = 0;
      this.combatActive = false;
      this.resolvedOutcome = null;
      this.endlessCycle = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.enemies = [];
      this.projectiles = [];
      this.floaters = [];
      this.floaterConnections = [];
      this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
      this.towers = [];
      this.alephChain.reset();
      this.hoverPlacement = null;
      this.clearFocusedEnemy({ silent: true });
      this.slots.forEach((slot) => {
        slot.tower = null;
        if (slot.button) {
          slot.button.classList.remove('tower-built');
          slot.button.setAttribute('aria-pressed', 'false');
        }
      });
      this.updateTowerPositions();
      this.updateHud();
      this.updateProgress();
      if (this.startButton) {
        this.startButton.disabled = !this.levelConfig;
      }
      this.updateAutoAnchorButton();
      this.updateSpeedButton();
      refreshTowerLoadoutDisplay();
    }

    enableSlots() {
      this.slots.forEach((slot) => {
        if (slot.button) {
          slot.button.disabled = false;
        }
      });
    }

    disableSlots(clear = false) {
      this.slots.forEach((slot) => {
        if (!slot.button) {
          return;
        }
        slot.button.disabled = true;
        if (clear) {
          slot.tower = null;
          slot.button.classList.remove('tower-built');
          slot.button.setAttribute('aria-pressed', 'false');
        }
      });
    }

    isInteractiveLevelActive() {
      return Boolean(
        this.levelActive && this.levelConfig && levelConfigs.has(this.levelConfig.id),
      );
    }

    formatSpeedMultiplier(value) {
      if (Number.isInteger(value)) {
        return String(value);
      }
      const formatted = value.toFixed(1);
      return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
    }

    cycleSpeedMultiplier() {
      if (!this.speedMultipliers.length) {
        return;
      }
      this.speedIndex = (this.speedIndex + 1) % this.speedMultipliers.length;
      this.speedMultiplier = this.speedMultipliers[this.speedIndex];
      this.updateSpeedButton();
      if (this.messageEl) {
        this.messageEl.textContent = `Simulation speed set to ×${this.formatSpeedMultiplier(
          this.speedMultiplier,
        )}.`;
      }
    }

    updateSpeedButton() {
      if (!this.speedButton) {
        return;
      }
      const label = this.formatSpeedMultiplier(this.speedMultiplier);
      this.speedButton.textContent = `Speed ×${label}`;
      const interactive = this.isInteractiveLevelActive();
      this.speedButton.disabled = !interactive;
      this.speedButton.setAttribute('aria-disabled', interactive ? 'false' : 'true');
      this.speedButton.title = interactive
        ? 'Cycle the manual defense speed multiplier.'
        : 'Simulation speed adjusts during the interactive defense.';
    }

    getAutoAnchorStatus() {
      const anchors = Array.isArray(this.levelConfig?.autoAnchors)
        ? this.levelConfig.autoAnchors
        : [];
      if (!anchors.length) {
        return { total: 0, placed: 0 };
      }
      const tolerance = this.anchorTolerance;
      let placed = 0;
      anchors.forEach((anchor) => {
        const occupied = this.towers.some((tower) => {
          const dx = tower.normalized.x - anchor.x;
          const dy = tower.normalized.y - anchor.y;
          return Math.hypot(dx, dy) <= tolerance;
        });
        if (occupied) {
          placed += 1;
        }
      });
      return { total: anchors.length, placed };
    }

    updateAutoAnchorButton() {
      if (!this.autoAnchorButton) {
        return;
      }

      this.autoAnchorButton.textContent = 'Loadout Placement';
      this.autoAnchorButton.disabled = true;
      this.autoAnchorButton.setAttribute('aria-disabled', 'true');
      this.autoAnchorButton.title = 'Drag towers from the loadout to lattice them on the field.';
    }

    autoAnchorTowers() {
      if (!this.isInteractiveLevelActive()) {
        if (this.audio) {
          this.audio.playSfx('error');
        }
        return;
      }
      const anchors = Array.isArray(this.levelConfig?.autoAnchors)
        ? this.levelConfig.autoAnchors
        : [];
      if (!anchors.length) {
        if (this.messageEl) {
          this.messageEl.textContent = 'No auto-lattice anchors configured for this level yet.';
        }
        return;
      }

      const tolerance = this.anchorTolerance;
      let placed = 0;
      let insufficientEnergy = false;

      for (const anchor of anchors) {
        const occupied = this.towers.some((tower) => {
          const dx = tower.normalized.x - anchor.x;
          const dy = tower.normalized.y - anchor.y;
          return Math.hypot(dx, dy) <= tolerance;
        });
        if (occupied) {
          continue;
        }
        if (this.energy < this.levelConfig.towerCost) {
          insufficientEnergy = true;
          break;
        }
        const success = this.addTowerAt(anchor, { silent: true });
        if (success) {
          placed += 1;
        }
      }

      const { total, placed: nowPlaced } = this.getAutoAnchorStatus();
      const remaining = Math.max(0, total - nowPlaced);

      notifyAutoAnchorUsed(nowPlaced, total);

      if (this.audio && placed > 0) {
        this.audio.playSfx('towerPlace');
        playTowerPlacementNotes(this.audio, placed);
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Auto-lattice is disabled—drag towers from the loadout instead.';
      }
    }

    updateTowerPositions() {
      if (!this.levelConfig) {
        return;
      }
      this.towers.forEach((tower) => {
        const { x, y } = this.getCanvasPosition(tower.normalized);
        tower.x = x;
        tower.y = y;
        const definition = getTowerDefinition(tower.type) || tower.definition;
        const rangeFactor = definition ? definition.range : 0.24;
        tower.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      });
      if (this.hoverPlacement) {
        this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
        const definition = getTowerDefinition(this.hoverPlacement.towerType);
        const rangeFactor = definition ? definition.range : 0.24;
        this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      }
    }

    handleCanvasPointerMove(event) {
      if (!this.levelActive || !this.levelConfig) {
        this.clearPlacementPreview();
        this.pointerPosition = null;
        this.clearEnemyHover();
        return;
      }

      if (event.pointerType === 'touch') {
        this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        if (this.activePointers.size >= 2) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          this.performPinchZoom();
          this.pointerPosition = null;
          this.clearPlacementPreview();
          this.clearEnemyHover();
          return;
        }
      } else {
        this.activePointers.clear();
        this.pinchState = null;
        this.isPinchZooming = false;
      }

      const normalized = this.getNormalizedFromEvent(event);
      if (!normalized) {
        this.clearPlacementPreview();
        this.pointerPosition = null;
        this.clearEnemyHover();
        return;
      }

      this.pointerPosition = normalized;
      const position = this.getCanvasPosition(normalized);
      const hoveredEnemy = this.findEnemyAt(position);
      if (hoveredEnemy) {
        this.setEnemyHover(hoveredEnemy.enemy);
      } else {
        this.clearEnemyHover();
      }
      const hoveredTower = this.findTowerAt(position);
      if (!this.draggingTowerType && hoveredTower) {
        this.hoverPlacement = {
          normalized: { ...hoveredTower.normalized },
          position: { x: hoveredTower.x, y: hoveredTower.y },
          range: hoveredTower.range,
          valid: false,
          target: hoveredTower,
          towerType: hoveredTower.type,
          reason: 'Select to release lattice.',
        };
        if (!this.shouldAnimate) {
          this.draw();
        }
        return;
      }

      const activeType = this.draggingTowerType;
      if (activeType) {
        this.updatePlacementPreview(normalized, {
          towerType: activeType,
          dragging: Boolean(this.draggingTowerType),
        });
      } else {
        this.clearPlacementPreview();
      }

      if (!this.shouldAnimate) {
        this.draw();
      }
    }

    performPinchZoom() {
      const pointers = Array.from(this.activePointers.values());
      if (pointers.length < 2) {
        this.pinchState = null;
        this.isPinchZooming = false;
        return;
      }
      const [first, second] = pointers;
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance) || distance <= 0) {
        return;
      }
      const midpoint = {
        clientX: (first.clientX + second.clientX) / 2,
        clientY: (first.clientY + second.clientY) / 2,
      };
      const anchor = this.getCanvasRelativeFromClient(midpoint);
      if (!anchor) {
        return;
      }
      this.isPinchZooming = true;
      if (!this.pinchState || !Number.isFinite(this.pinchState.startDistance) || this.pinchState.startDistance <= 0) {
        this.pinchState = {
          startDistance: distance,
          startScale: this.viewScale,
        };
        return;
      }
      const baseDistance = this.pinchState.startDistance;
      const baseScale = this.pinchState.startScale || this.viewScale;
      if (!Number.isFinite(baseDistance) || baseDistance <= 0) {
        return;
      }
      const targetScale = (distance / baseDistance) * baseScale;
      this.setZoom(targetScale, anchor);
      this.pinchState.startScale = this.viewScale;
      this.pinchState.startDistance = distance;
    }

    handleCanvasPointerDown(event) {
      if (event.pointerType === 'touch') {
        this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        if (this.activePointers.size < 2) {
          this.pinchState = null;
          this.isPinchZooming = false;
        }
      } else {
        this.activePointers.clear();
        this.pinchState = null;
        this.isPinchZooming = false;
      }
    }

    handleCanvasPointerUp(event) {
      if (event.pointerType === 'touch') {
        this.activePointers.delete(event.pointerId);
        if (this.activePointers.size < 2) {
          this.pinchState = null;
          this.isPinchZooming = false;
        }
      } else {
        this.activePointers.clear();
        this.pinchState = null;
        this.isPinchZooming = false;
      }
    }

    updatePlacementPreview(normalized, options = {}) {
      const { towerType, dragging = false } = options;
      if (!towerType || !normalized) {
        this.hoverPlacement = null;
        return;
      }

      const definition = getTowerDefinition(towerType);
      let placementNormalized = { ...normalized };
      const pointerPosition = this.getCanvasPosition(normalized);

      if (dragging) {
        const offsetX = this.dragPreviewOffset?.x || 0;
        const offsetY = this.dragPreviewOffset?.y || 0;
        const adjustedPosition = {
          x: pointerPosition.x + offsetX,
          y: pointerPosition.y + offsetY,
        };
        const adjustedNormalized = this.getNormalizedFromCanvasPosition(adjustedPosition);
        if (adjustedNormalized) {
          placementNormalized = adjustedNormalized;
        }
      }

      let position = this.getCanvasPosition(placementNormalized);
      const existing = this.findTowerAt(position);
      const merging = Boolean(existing && existing.type === towerType);
      const nextId = merging ? getNextTowerId(towerType) : null;
      const nextDefinition = nextId ? getTowerDefinition(nextId) : null;

      if (merging && existing) {
        position = { x: existing.x, y: existing.y };
        const mergeNormalized = this.getNormalizedFromCanvasPosition(position);
        if (mergeNormalized) {
          placementNormalized = mergeNormalized;
        }
      }

      const validation = merging
        ? { valid: Boolean(nextDefinition), reason: nextDefinition ? '' : 'Peak tier reached.' }
        : this.validatePlacement(placementNormalized, { allowPathOverlap: false });

      if (!merging && validation.position) {
        position = validation.position;
      }

      const baseCost = this.getCurrentTowerCost(towerType);
      const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
      const actionCost = merging ? mergeCost : baseCost;
      const hasFunds = this.energy >= actionCost;

      let valid = validation.valid && hasFunds;
      let reason = '';
      const formattedCost = Math.round(actionCost);
      if (!validation.valid) {
        reason = validation.reason || 'Maintain clearance from the glyph lane.';
      } else if (!hasFunds) {
        const deficit = Math.ceil(actionCost - this.energy);
        if (merging && nextDefinition) {
          reason = `Need ${deficit} ${THERO_SYMBOL} to merge into ${nextDefinition.symbol}.`;
        } else if (definition) {
          reason = `Need ${deficit} ${THERO_SYMBOL} to lattice ${definition.symbol}.`;
        } else {
          reason = `Need ${deficit} ${THERO_SYMBOL} for this lattice.`;
        }
      } else if (merging && nextDefinition) {
        reason = `Merge into ${nextDefinition.symbol} for ${formattedCost} ${THERO_SYMBOL}.`;
      } else if (definition) {
        reason = `Anchor ${definition.symbol} for ${formattedCost} ${THERO_SYMBOL}.`;
      }

      const rangeFactor = definition ? definition.range : 0.24;
      this.hoverPlacement = {
        normalized: { ...placementNormalized },
        position,
        range: Math.min(this.renderWidth, this.renderHeight) * rangeFactor,
        valid,
        reason,
        towerType,
        dragging,
        mergeTarget: merging ? existing : null,
        merge: merging,
        cost: actionCost,
        symbol: definition?.symbol || '·',
      };
    }

    handleCanvasPointerLeave() {
      this.pointerPosition = null;
      this.clearPlacementPreview();
      this.clearEnemyHover();
      this.activePointers.clear();
      this.pinchState = null;
      this.isPinchZooming = false;
    }

    handleCanvasClick(event) {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig) {
        return;
      }

      if (this.isPinchZooming) {
        return;
      }

      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      const normalized = this.getNormalizedFromEvent(event);
      if (!normalized) {
        return;
      }

      const position = this.getCanvasPosition(normalized);
      const enemyTarget = this.findEnemyAt(position);
      if (enemyTarget) {
        this.toggleEnemyFocus(enemyTarget.enemy);
        return;
      }
      const tower = this.findTowerAt(position);
      if (tower) {
        this.sellTower(tower);
        return;
      }
    }

    handleCanvasWheel(event) {
      if (!this.levelActive || !this.levelConfig) {
        return;
      }
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (typeof isFieldNotesOverlayVisible === 'function' && isFieldNotesOverlayVisible()) {
        return;
      }
      const anchor = this.getCanvasRelativeFromClient({ clientX: event.clientX, clientY: event.clientY });
      if (!anchor) {
        return;
      }
      const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      const factor = Math.exp(-delta * 0.0015);
      this.applyZoomFactor(factor, anchor);
    }

    applyZoomFactor(factor, anchor) {
      if (!Number.isFinite(factor) || factor <= 0) {
        return;
      }
      const targetScale = this.viewScale * factor;
      this.setZoom(targetScale, anchor);
    }

    setZoom(targetScale, anchor) {
      if (!Number.isFinite(targetScale)) {
        return false;
      }
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      const screenPoint = anchor || { x: width / 2, y: height / 2 };
      const anchorWorld = this.screenToWorld(screenPoint);
      const clampedScale = Math.min(this.maxViewScale, Math.max(this.minViewScale, targetScale));
      const previousScale = this.viewScale;
      this.viewScale = clampedScale;
      this.applyViewConstraints();
      if (anchorWorld) {
        const offsetX = (screenPoint.x - width / 2) / this.viewScale;
        const offsetY = (screenPoint.y - height / 2) / this.viewScale;
        this.setViewCenterFromWorld({
          x: anchorWorld.x - offsetX,
          y: anchorWorld.y - offsetY,
        });
      } else {
        this.applyViewConstraints();
      }
      this.applyViewConstraints();
      const scaleChanged = Math.abs(previousScale - this.viewScale) > 0.0001;
      this.draw();
      return scaleChanged;
    }

    clearPlacementPreview() {
      if (!this.hoverPlacement) {
        return;
      }
      this.hoverPlacement = null;
      if (!this.shouldAnimate) {
        this.draw();
      }
    }

    clearEnemyHover() {
      this.hoverEnemy = null;
      if (this.enemyTooltip) {
        this.enemyTooltip.dataset.visible = 'false';
        this.enemyTooltip.setAttribute('aria-hidden', 'true');
      }
    }

    getNormalizedFromEvent(event) {
      if (!this.canvas) {
        return null;
      }
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width || this.renderWidth || 0;
      const height = rect.height || this.renderHeight || 0;
      if (!width || !height) {
        return null;
      }
      const relative = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (!Number.isFinite(relative.x) || !Number.isFinite(relative.y)) {
        return null;
      }
      const world = this.screenToWorld(relative);
      if (!world) {
        return null;
      }
      const normalized = {
        x: world.x / (this.renderWidth || width),
        y: world.y / (this.renderHeight || height),
      };
      return this.clampNormalized(normalized);
    }

    findTowerAt(position) {
      const hitRadius = Math.max(18, Math.min(this.renderWidth, this.renderHeight) * 0.045);
      for (let index = this.towers.length - 1; index >= 0; index -= 1) {
        const tower = this.towers[index];
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= hitRadius) {
          return tower;
        }
      }
      return null;
    }

    getEnemyHitRadius(enemy = null, metrics = null) {
      const baseRadius = Math.max(16, Math.min(this.renderWidth, this.renderHeight) * 0.05);
      if (!enemy || !metrics) {
        return baseRadius;
      }
      const { focusRadius = 0, ringRadius = 0 } = metrics;
      return Math.max(baseRadius, focusRadius || ringRadius || baseRadius);
    }

    getEnemyVisualMetrics(enemy) {
      if (!enemy) {
        return {
          scale: 1,
          coreRadius: 9,
          ringRadius: 12,
          focusRadius: 18,
          symbolSize: 17,
          exponentSize: 13,
        };
      }

      const moteFactor = Math.max(1, Number.isFinite(enemy.moteFactor) ? enemy.moteFactor : 1);
      const exponent = Math.max(
        1,
        Number.isFinite(enemy.hpExponent)
          ? enemy.hpExponent
          : this.calculateHealthExponent(
              Number.isFinite(enemy.hp) && enemy.hp > 0 ? enemy.hp : enemy.maxHp,
            ),
      );
      const sizeFactor = Math.max(moteFactor, exponent);
      const growth = Number.isFinite(sizeFactor) && sizeFactor > 0 ? Math.log2(sizeFactor) : 0;
      const clampedGrowth = Math.min(Math.max(growth, 0), 4);
      const scale = 1 + clampedGrowth * 0.2;

      const coreRadius = 9 * scale;
      const ringRadius = 12 * scale;
      const focusRadius = ringRadius + 6 * scale;
      const symbolSize = Math.round(Math.min(34, Math.max(16, 17 * scale)));
      const exponentSize = Math.round(Math.min(26, Math.max(11, 13 * scale * 0.9)));

      return { scale, coreRadius, ringRadius, focusRadius, symbolSize, exponentSize };
    }

    updateFocusIndicator(delta) {
      if (!Number.isFinite(delta) || delta <= 0) {
        return;
      }
      const focusedEnemy = this.getFocusedEnemy();
      if (!focusedEnemy) {
        this.focusMarkerAngle = 0;
        return;
      }
      const spinSpeed = Math.PI * 1.2;
      this.focusMarkerAngle = (this.focusMarkerAngle + delta * spinSpeed) % (Math.PI * 2);
    }

    findEnemyAt(position) {
      if (!this.enemies.length) {
        return null;
      }
      for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = this.enemies[index];
        const enemyPosition = this.getEnemyPosition(enemy);
        const metrics = this.getEnemyVisualMetrics(enemy);
        const hitRadius = this.getEnemyHitRadius(enemy, metrics);
        const distance = Math.hypot(position.x - enemyPosition.x, position.y - enemyPosition.y);
        if (distance <= hitRadius) {
          return { enemy, position: enemyPosition };
        }
      }
      return null;
    }

    setEnemyHover(enemy) {
      if (!enemy) {
        this.clearEnemyHover();
        return;
      }
      this.hoverEnemy = { enemyId: enemy.id };
      this.renderEnemyTooltip(enemy);
    }

    getFocusedEnemy() {
      if (!this.focusedEnemyId) {
        return null;
      }
      const enemy = this.enemies.find((candidate) => candidate?.id === this.focusedEnemyId);
      if (!enemy || enemy.hp <= 0) {
        this.clearFocusedEnemy({ silent: true });
        return null;
      }
      return enemy;
    }

    setFocusedEnemy(enemy, options = {}) {
      if (!enemy) {
        this.clearFocusedEnemy(options);
        return;
      }
      const { silent = false } = options;
      this.focusedEnemyId = enemy.id;
      const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
      const descriptor = enemy.label ? enemy.label : symbol;
      this.focusMarkerAngle = 0;
      if (!silent && this.messageEl) {
        this.messageEl.textContent = `All towers focusing on ${descriptor}.`;
      }
    }

    clearFocusedEnemy(options = {}) {
      const { silent = false } = options;
      if (!this.focusedEnemyId) {
        this.focusMarkerAngle = 0;
        return false;
      }
      this.focusedEnemyId = null;
      this.focusMarkerAngle = 0;
      if (!silent && this.messageEl) {
        this.messageEl.textContent = 'Focus fire cleared—towers resume optimal targeting.';
      }
      return true;
    }

    toggleEnemyFocus(enemy) {
      if (!enemy) {
        this.clearFocusedEnemy();
        return;
      }
      if (this.focusedEnemyId === enemy.id) {
        this.clearFocusedEnemy();
      } else {
        this.setFocusedEnemy(enemy);
      }
    }

    renderEnemyTooltip(enemy) {
      if (!this.enemyTooltip || !this.pointerPosition) {
        this.clearEnemyHover();
        return;
      }

      const pointerCanvas = this.getCanvasPosition(this.pointerPosition);
      const enemyPosition = this.getEnemyPosition(enemy);
      const metrics = this.getEnemyVisualMetrics(enemy);
      const distance = Math.hypot(pointerCanvas.x - enemyPosition.x, pointerCanvas.y - enemyPosition.y);
      if (distance > this.getEnemyHitRadius(enemy, metrics)) {
        this.clearEnemyHover();
        return;
      }

      const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
      const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
      const exponent = this.calculateHealthExponent(remainingHp);
      if (this.enemyTooltipNameEl) {
        this.enemyTooltipNameEl.textContent = `${symbol}^${exponent} — ${enemy.label || 'Glyph'}`;
      }
      if (this.enemyTooltipHpEl) {
        const hpText = formatGameNumber(remainingHp);
        this.enemyTooltipHpEl.textContent = `Remaining HP: 10^${exponent} (${hpText})`;
      }

      const screenPosition = this.worldToScreen(enemyPosition);
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;

      if (
        !screenPosition ||
        screenPosition.x < 0 ||
        screenPosition.y < 0 ||
        screenPosition.x > width ||
        screenPosition.y > height
      ) {
        this.enemyTooltip.dataset.visible = 'false';
        this.enemyTooltip.setAttribute('aria-hidden', 'true');
        return;
      }

      this.enemyTooltip.style.left = `${screenPosition.x}px`;
      this.enemyTooltip.style.top = `${screenPosition.y}px`;
      this.enemyTooltip.dataset.visible = 'true';
      this.enemyTooltip.setAttribute('aria-hidden', 'false');
    }

    updateEnemyTooltipPosition() {
      if (!this.hoverEnemy) {
        return;
      }

      const enemy = this.enemies.find((candidate) => candidate.id === this.hoverEnemy.enemyId);
      if (!enemy || !this.pointerPosition) {
        this.clearEnemyHover();
        return;
      }

      this.renderEnemyTooltip(enemy);
    }

    syncAlephChainStats() {
      if (!this.alephChain) {
        return;
      }

      const states = this.alephChain.getAllStates();
      const rangeMultiplier = this.alephChain.getRangeMultiplier();
      const speedMultiplier = this.alephChain.getSpeedMultiplier();
      const linkCount = this.alephChain.getLinkCount();

      this.towers.forEach((tower) => {
        const baseDamage = Number.isFinite(tower.baseDamage)
          ? tower.baseDamage
          : Number.isFinite(tower.definition?.damage)
          ? tower.definition.damage
          : tower.damage;
        const baseRate = Number.isFinite(tower.baseRate)
          ? tower.baseRate
          : Number.isFinite(tower.definition?.rate)
          ? tower.definition.rate
          : tower.rate;
        const baseRange = Number.isFinite(tower.baseRange)
          ? tower.baseRange
          : Math.min(this.renderWidth, this.renderHeight) * (tower.definition?.range ?? 0.78);

        tower.baseDamage = baseDamage;
        tower.baseRate = baseRate;
        tower.baseRange = baseRange;

        if (tower.type !== 'aleph-null') {
          if (tower.chain) {
            tower.chain = null;
            tower.damage = baseDamage;
            tower.rate = baseRate;
            tower.range = baseRange;
          }
          return;
        }

        const state = states.get(tower.id) || null;
        if (!state) {
          tower.chain = null;
          tower.damage = baseDamage;
          tower.rate = baseRate;
          tower.range = baseRange;
          return;
        }

        tower.chain = {
          index: state.index,
          totalDamage: state.totalDamage,
          rangeMultiplier,
          speedMultiplier,
          linkCount,
        };
        tower.damage = state.totalDamage;
        tower.rate = baseRate * speedMultiplier;
        tower.range = baseRange * rangeMultiplier;
      });
    }

    handleAlephTowerAdded(tower) {
      if (!tower || tower.type !== 'aleph-null' || !this.alephChain) {
        return;
      }
      this.alephChain.registerTower(tower.id, tower.baseDamage);
      this.syncAlephChainStats();
    }

    handleAlephTowerRemoved(tower) {
      if (!tower || tower.type !== 'aleph-null' || !this.alephChain) {
        return;
      }
      this.alephChain.unregisterTower(tower.id);
      this.syncAlephChainStats();
    }

    getTowerEquationScribbleText(towerType) {
      if (!towerType) {
        return '';
      }
      const blueprint = getTowerEquationBlueprint(towerType);
      if (!blueprint || !blueprint.baseEquation) {
        return '';
      }
      return convertMathExpressionToPlainText(blueprint.baseEquation);
    }

    spawnTowerEquationScribble(tower, options = {}) {
      if (!tower || !this.container) {
        return;
      }
      const { towerType = tower.type, silent = false } = options;
      if (silent) {
        return;
      }
      const equationText = this.getTowerEquationScribbleText(towerType);
      if (!equationText) {
        return;
      }
      if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
        return;
      }

      const effect = document.createElement('div');
      effect.className = 'tower-equation-scribble';
      effect.style.left = `${tower.x}px`;
      effect.style.top = `${tower.y}px`;

      const text = document.createElement('span');
      text.className = 'tower-equation-scribble__text';
      text.textContent = equationText;
      effect.append(text);

      const cleanup = () => {
        effect.removeEventListener('animationend', handleAnimationEnd);
        if (effect.parentNode) {
          effect.parentNode.removeChild(effect);
        }
      };

      const handleAnimationEnd = (event) => {
        if (event.target === effect && event.animationName === 'tower-scribble-dissipate') {
          cleanup();
        }
      };

      effect.addEventListener('animationend', handleAnimationEnd);
      this.container.append(effect);

      setTimeout(() => {
        if (effect.parentNode) {
          cleanup();
        }
      }, 2400);
    }

    addTowerAt(normalized, options = {}) {
      const {
        slot = null,
        allowPathOverlap = false,
        silent = false,
        towerType = null,
      } = options;

      if (!this.levelConfig || !normalized) {
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }

      const selectedType = towerType || this.draggingTowerType || this.availableTowers[0];
      const definition = getTowerDefinition(selectedType);
      if (!definition) {
        if (this.messageEl && !silent) {
          this.messageEl.textContent = 'Select a tower from your loadout to lattice it.';
        }
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }

      if (!this.availableTowers.includes(selectedType)) {
        if (this.messageEl && !silent) {
          this.messageEl.textContent = `${definition.symbol} is not prepared in your loadout.`;
        }
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }

      const canvasPosition = this.getCanvasPosition(normalized);
      const existingTower = this.findTowerAt(canvasPosition);
      let placement = { valid: true, position: canvasPosition };
      let mergeTarget = null;
      let nextDefinition = null;
      let merging = false;

      if (existingTower && existingTower.type === selectedType) {
        const nextId = getNextTowerId(selectedType);
        if (!nextId) {
          if (this.messageEl && !silent) {
            this.messageEl.textContent = `${definition.symbol} already resonates at its peak tier.`;
          }
          if (this.audio && !silent) {
            this.audio.playSfx('error');
          }
          return false;
        }
        nextDefinition = getTowerDefinition(nextId);
        mergeTarget = existingTower;
        merging = true;
        placement.position = { x: mergeTarget.x, y: mergeTarget.y };
      } else {
        placement = this.validatePlacement(normalized, { allowPathOverlap });
        if (!placement.valid) {
          if (this.messageEl && placement.reason && !silent) {
            this.messageEl.textContent = placement.reason;
          }
          if (this.audio && !silent) {
            this.audio.playSfx('error');
          }
          return false;
        }
      }

      if (!isTowerUnlocked(selectedType)) {
        unlockTower(selectedType, { silent: true });
      }

      const baseCost = this.getCurrentTowerCost(selectedType);
      const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
      const actionCost = merging ? mergeCost : baseCost;

      if (this.energy < actionCost) {
        const needed = Math.ceil(actionCost - this.energy);
        if (this.messageEl && !silent) {
          if (merging && nextDefinition) {
            this.messageEl.textContent = `Need ${needed} ${THERO_SYMBOL} more to merge into ${nextDefinition.symbol}.`;
          } else {
            this.messageEl.textContent = `Need ${needed} ${THERO_SYMBOL} more to lattice ${definition.symbol}.`;
          }
        }
        if (this.audio && !silent) {
          this.audio.playSfx('error');
        }
        return false;
      }

      this.energy = Math.max(0, this.energy - actionCost);

      if (merging && mergeTarget && nextDefinition) {
        const wasAlephNull = mergeTarget.type === 'aleph-null';
        if (wasAlephNull) {
          this.handleAlephTowerRemoved(mergeTarget);
        }

        const range = Math.min(this.renderWidth, this.renderHeight) * nextDefinition.range;
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
        mergeTarget.chain = null;
        const nextIsAlephNull = nextDefinition.id === 'aleph-null';
        if (nextIsAlephNull) {
          this.handleAlephTowerAdded(mergeTarget);
        } else if (wasAlephNull) {
          this.syncAlephChainStats();
        }
        this.spawnTowerEquationScribble(mergeTarget, {
          towerType: nextDefinition.id,
          silent,
        });
        const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
          ? unlockTower(nextDefinition.id, { silent: true })
          : false;
        if (this.messageEl && !silent) {
          const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
          this.messageEl.textContent = `${definition.symbol} lattices fused into ${nextDefinition.symbol}.${unlockNote}`;
        }
        notifyTowerPlaced(this.towers.length);
        this.updateTowerPositions();
        this.updateHud();
        this.draw();
        refreshTowerLoadoutDisplay();
        updateStatusDisplays();
        if (this.audio && !silent) {
          this.audio.playSfx('towerMerge');
        }
        return true;
      }

      const baseRange = Math.min(this.renderWidth, this.renderHeight) * definition.range;
      const baseDamage = Number.isFinite(definition.damage) ? definition.damage : 0;
      const baseRate = Number.isFinite(definition.rate) ? definition.rate : 1;
      const tower = {
        id: `tower-${(this.towerIdCounter += 1)}`,
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
      };

      this.towers.push(tower);
      this.handleAlephTowerAdded(tower);
      notifyTowerPlaced(this.towers.length);

      if (slot) {
        slot.tower = tower;
        if (slot.button) {
          slot.button.classList.add('tower-built');
          slot.button.setAttribute('aria-pressed', 'true');
        }
      }

      this.hoverPlacement = null;
      if (this.messageEl && !silent) {
        this.messageEl.textContent = `${definition.symbol} lattice anchored—harmonics align.`;
      }
      this.spawnTowerEquationScribble(tower, { towerType: selectedType, silent });
      this.updateHud();
      this.draw();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
      if (this.audio && !silent) {
        this.audio.playSfx('towerPlace');
        playTowerPlacementNotes(this.audio, 1);
      }
      return true;
    }

    sellTower(tower, { slot } = {}) {
      if (!tower) {
        return;
      }

      this.handleAlephTowerRemoved(tower);

      const index = this.towers.indexOf(tower);
      if (index >= 0) {
        this.towers.splice(index, 1);
      }

      const resolvedSlot = slot || tower.slot || null;
      if (resolvedSlot) {
        resolvedSlot.tower = null;
        if (resolvedSlot.button) {
          resolvedSlot.button.classList.remove('tower-built');
          resolvedSlot.button.setAttribute('aria-pressed', 'false');
        }
      }

      if (this.levelConfig) {
        const definition = getTowerDefinition(tower.type);
        const baseRefund = definition ? definition.baseCost : this.getCurrentTowerCost(tower.type);
        const refund = Math.round(baseRefund * 0.5);
        const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
        this.energy = Math.min(cap, this.energy + refund);
        if (this.messageEl) {
          this.messageEl.textContent = `Lattice released—refunded ${refund} ${THERO_SYMBOL}.`;
        }
      }

      this.updateHud();
      this.draw();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
      if (this.audio) {
        this.audio.playSfx('towerSell');
      }
    }

    validatePlacement(normalized, options = {}) {
      const { allowPathOverlap = false } = options;
      if (!this.levelConfig) {
        return { valid: false, reason: 'Activate a level first.' };
      }

      const position = this.getCanvasPosition(normalized);
      const minDimension = Math.min(this.renderWidth, this.renderHeight) || 1;
      const minSpacing = minDimension * 0.12;

      for (let index = 0; index < this.towers.length; index += 1) {
        const tower = this.towers[index];
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance < minSpacing) {
          return { valid: false, reason: 'Too close to another lattice.', position };
        }
      }

      if (!allowPathOverlap) {
        const pathBuffer = minDimension * 0.06;
        const clearance = this.getDistanceToPath(position);
        if (clearance < pathBuffer) {
          return { valid: false, reason: 'Maintain clearance from the glyph lane.', position };
        }
      }

      return { valid: true, position };
    }

    getDistanceToPath(point) {
      if (!this.pathSegments.length) {
        return Infinity;
      }

      let shortest = Infinity;
      for (let index = 0; index < this.pathSegments.length; index += 1) {
        const segment = this.pathSegments[index];
        const distance = this.distancePointToSegment(point, segment.start, segment.end);
        if (distance < shortest) {
          shortest = distance;
        }
      }
      return shortest;
    }

    distancePointToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
      }
      const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
      const clampedT = Math.max(0, Math.min(1, t));
      const projX = start.x + clampedT * dx;
      const projY = start.y + clampedT * dy;
      return Math.hypot(point.x - projX, point.y - projY);
    }

    handleSlotInteraction(slot) {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig) {
        if (this.audio) {
          this.audio.playSfx('error');
        }
        if (this.messageEl) {
          this.messageEl.textContent =
            'Select an unlocked defense, then etch α lattices directly onto the canvas.';
        }
        return;
      }

      if (slot.tower) {
        this.sellTower(slot.tower, { slot });
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Drag a tower chip from the loadout to lattice it here.';
      }
    }

    placeTower(slot) {
      this.addTowerAt(slot?.normalized || null, { slot, allowPathOverlap: true });
    }

    removeTower(slot) {
      this.sellTower(slot?.tower || null, { slot });
    }

    handleStartButton() {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig || this.combatActive) {
        return;
      }
      if (!this.towers.length) {
        if (this.messageEl) {
          this.messageEl.textContent = 'Anchor at least one tower before commencing.';
        }
        return;
      }

      if (this.audio) {
        this.audio.playSfx('uiConfirm');
      }

      this.cancelAutoStart();
      this.combatActive = true;
      this.resolvedOutcome = null;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.enemyIdCounter = 0;
      this.enemies = [];
      this.projectiles = [];
      this.activeWave = this.createWaveState(this.levelConfig.waves[0], { initialWave: true });
      this.lives = this.levelConfig.lives;
      this.markWaveStart();

      if (this.startButton) {
        this.startButton.disabled = true;
        this.startButton.textContent = 'Wave Running';
      }
      if (this.messageEl) {
        this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label} advance.`;
      }
      this.updateHud();
      this.updateProgress();

      if (this.onCombatStart) {
        this.onCombatStart(this.levelConfig.id);
      }
    }

    getCycleMultiplier() {
      return this.isEndlessMode ? 10 ** this.endlessCycle : 1;
    }

    computeWaveNumber(index = this.waveIndex) {
      if (!this.levelConfig) {
        return 0;
      }
      const total = this.baseWaveCount || this.levelConfig.waves.length || 0;
      if (!this.isEndlessMode) {
        return index + 1;
      }
      return this.endlessCycle * total + index + 1;
    }

    markWaveStart() {
      const waveNumber = this.computeWaveNumber();
      this.currentWaveNumber = waveNumber > 0 ? waveNumber : 1;
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
    }

    createWaveState(config, options = {}) {
      if (!config) {
        return null;
      }
      const { initialWave = false } = options;
      const multiplier = this.getCycleMultiplier();
      const scaledHp = Number.isFinite(config.hp) ? config.hp * multiplier : config.hp;
      const scaledSpeed = Number.isFinite(config.speed) ? config.speed * multiplier : config.speed;
      const scaledReward = Number.isFinite(config.reward)
        ? config.reward * multiplier
        : config.reward;
      return {
        config: {
          ...config,
          hp: scaledHp,
          speed: scaledSpeed,
          reward: scaledReward,
        },
        spawned: 0,
        nextSpawn: initialWave ? this.initialSpawnDelay : 0,
        multiplier,
      };
    }

    updateFloaters(delta) {
      if (!this.floaters.length || !this.levelConfig) {
        return;
      }

      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      if (!width || !height) {
        return;
      }

      const dt = Math.max(0, Math.min(delta, 0.05));
      const minDimension = Math.min(width, height);
      if (!minDimension) {
        return;
      }

      const influenceScale = Math.max(0.6, Math.min(1.4, minDimension / 600));
      const pairDistance = minDimension * 0.28;
      const towerInfluence = minDimension * 0.3;
      const nodeInfluence = minDimension * 0.32;
      const enemyInfluence = minDimension * 0.26;
      const edgeMargin = minDimension * 0.12;

      const pairRepelStrength = 18 * influenceScale;
      const towerRepelStrength = 42 * influenceScale;
      const enemyRepelStrength = 46 * influenceScale;
      const edgeRepelStrength = 24 * influenceScale;

      const damping = dt > 0 ? Math.exp(-dt * 1.6) : 1;
      const smoothing = dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
      const maxSpeed = minDimension * 0.6;

      const floaters = this.floaters;
      const connections = [];

      const startPoint = this.pathPoints.length ? this.pathPoints[0] : null;
      const endPoint =
        this.pathPoints.length > 1 ? this.pathPoints[this.pathPoints.length - 1] : startPoint;

      const towerPositions = this.towers.map((tower) => ({ x: tower.x, y: tower.y }));
      const enemyPositions = this.enemies.map((enemy) => this.getEnemyPosition(enemy));

      for (let index = 0; index < floaters.length; index += 1) {
        const floater = floaters[index];
        floater.ax = 0;
        floater.ay = 0;
        floater.opacityTarget = 0;
      }

      for (let i = 0; i < floaters.length - 1; i += 1) {
        const a = floaters[i];
        for (let j = i + 1; j < floaters.length; j += 1) {
          const b = floaters[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (!distance || distance >= pairDistance) {
            continue;
          }
          const proximity = 1 - distance / pairDistance;
          const force = pairRepelStrength * proximity;
          const dirX = dx / distance;
          const dirY = dy / distance;
          a.ax -= dirX * force;
          a.ay -= dirY * force;
          b.ax += dirX * force;
          b.ay += dirY * force;
          const connectionStrength = Math.min(1, proximity);
          connections.push({ from: i, to: j, strength: connectionStrength });
          a.opacityTarget = Math.max(a.opacityTarget, proximity);
          b.opacityTarget = Math.max(b.opacityTarget, proximity);
        }
      }

      floaters.forEach((floater) => {
        if (floater.x < edgeMargin) {
          const proximity = 1 - floater.x / edgeMargin;
          floater.ax += edgeRepelStrength * proximity;
        }
        if (width - floater.x < edgeMargin) {
          const proximity = 1 - (width - floater.x) / edgeMargin;
          floater.ax -= edgeRepelStrength * proximity;
        }
        if (floater.y < edgeMargin) {
          const proximity = 1 - floater.y / edgeMargin;
          floater.ay += edgeRepelStrength * proximity;
        }
        if (height - floater.y < edgeMargin) {
          const proximity = 1 - (height - floater.y) / edgeMargin;
          floater.ay -= edgeRepelStrength * proximity;
        }

        towerPositions.forEach((towerPosition) => {
          const dx = floater.x - towerPosition.x;
          const dy = floater.y - towerPosition.y;
          const distance = Math.hypot(dx, dy);
          if (!distance || distance >= towerInfluence) {
            return;
          }
          const proximity = 1 - distance / towerInfluence;
          const force = towerRepelStrength * proximity;
          floater.ax += (dx / distance) * force;
          floater.ay += (dy / distance) * force;
          floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
        });

        enemyPositions.forEach((enemyPosition) => {
          if (!enemyPosition) {
            return;
          }
          const dx = floater.x - enemyPosition.x;
          const dy = floater.y - enemyPosition.y;
          const distance = Math.hypot(dx, dy);
          if (!distance || distance >= enemyInfluence) {
            return;
          }
          const proximity = 1 - distance / enemyInfluence;
          const force = enemyRepelStrength * proximity;
          floater.ax += (dx / distance) * force;
          floater.ay += (dy / distance) * force;
          floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
        });

        if (startPoint) {
          const dx = floater.x - startPoint.x;
          const dy = floater.y - startPoint.y;
          const distance = Math.hypot(dx, dy);
          if (distance < nodeInfluence) {
            const proximity = 1 - distance / nodeInfluence;
            floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
          }
        }
        if (endPoint && endPoint !== startPoint) {
          const dx = floater.x - endPoint.x;
          const dy = floater.y - endPoint.y;
          const distance = Math.hypot(dx, dy);
          if (distance < nodeInfluence) {
            const proximity = 1 - distance / nodeInfluence;
            floater.opacityTarget = Math.max(floater.opacityTarget, proximity);
          }
        }
      });

      floaters.forEach((floater) => {
        floater.ax = Number.isFinite(floater.ax) ? floater.ax : 0;
        floater.ay = Number.isFinite(floater.ay) ? floater.ay : 0;
        floater.vx = Number.isFinite(floater.vx) ? floater.vx : 0;
        floater.vy = Number.isFinite(floater.vy) ? floater.vy : 0;

        floater.vx = (floater.vx + floater.ax * dt) * damping;
        floater.vy = (floater.vy + floater.ay * dt) * damping;

        const speed = Math.hypot(floater.vx, floater.vy);
        if (speed > maxSpeed && speed > 0) {
          const scale = maxSpeed / speed;
          floater.vx *= scale;
          floater.vy *= scale;
        }

        floater.x += floater.vx * dt;
        floater.y += floater.vy * dt;

        const softMargin = Math.min(width, height) * 0.02;
        floater.x = Math.min(width - softMargin, Math.max(softMargin, floater.x));
        floater.y = Math.min(height - softMargin, Math.max(softMargin, floater.y));

        floater.opacityTarget = Math.min(1, Math.max(0, floater.opacityTarget));
        if (!Number.isFinite(floater.opacity)) {
          floater.opacity = 0;
        }
        const blend = smoothing;
        floater.opacity += (floater.opacityTarget - floater.opacity) * blend;
        floater.opacity = Math.min(1, Math.max(0, floater.opacity));
      });

      this.floaterConnections = connections;
    }

    update(delta) {
      if (!this.levelActive || !this.levelConfig) {
        return;
      }

      const speedDelta = delta * this.speedMultiplier;
      this.updateFloaters(speedDelta);
      this.updateFocusIndicator(speedDelta);

      const arcSpeed = this.levelConfig?.arcSpeed ?? 0.2;
      const pathLength = this.pathLength || 1;
      this.arcOffset -= arcSpeed * speedDelta * pathLength;
      const wrapDistance = pathLength * 1000;
      if (this.arcOffset <= -wrapDistance) {
        this.arcOffset += wrapDistance;
      }

      if (!this.combatActive) {
        this.updateHud();
        this.updateProgress();
        return;
      }

      this.waveTimer += speedDelta;
      this.spawnEnemies();
      this.updateTowers(speedDelta);
      this.updateEnemies(speedDelta);
      this.updateProjectiles(speedDelta);
      this.updateProgress();
      this.updateHud();
    }

    calculateMoteFactor(config) {
      if (!config) {
        return 1;
      }
      if (Number.isFinite(config.moteFactor)) {
        return Math.max(1, Math.round(config.moteFactor));
      }
      const hp = Number.isFinite(config.hp) ? Math.max(1, config.hp) : 60;
      return Math.max(1, Math.round(hp / 60));
    }

    calculateHealthExponent(hp) {
      if (!Number.isFinite(hp) || hp <= 0) {
        return 1;
      }
      const clampedHp = Math.max(1, hp);
      const flooredHp = Math.max(1, Math.floor(clampedHp));
      const exponent = Math.floor(Math.log10(flooredHp)) + 1;
      return Math.max(1, exponent);
    }

    resolveEnemySymbol(config = {}) {
      if (config && typeof config.symbol === 'string') {
        const trimmed = config.symbol.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      if (config && typeof config.codexId === 'string') {
        const codexEntry = getEnemyCodexEntry(config.codexId);
        if (codexEntry && typeof codexEntry.symbol === 'string') {
          const trimmed = codexEntry.symbol.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }
      if (config && typeof config.label === 'string') {
        const trimmed = config.label.trim();
        if (trimmed) {
          return trimmed.charAt(0).toUpperCase();
        }
      }
      return '◈';
    }

    spawnEnemies() {
      if (!this.activeWave || !this.levelConfig) {
        return;
      }

      const { config } = this.activeWave;
      if (!config) {
        return;
      }

      while (
        this.activeWave.spawned < config.count &&
        this.waveTimer >= this.activeWave.nextSpawn
      ) {
        const pathMode = config.pathMode === 'direct' ? 'direct' : 'path';
        const symbol = this.resolveEnemySymbol(config);
        const maxHp = Number.isFinite(config.hp) ? Math.max(1, config.hp) : 1;
        const hpExponent = this.calculateHealthExponent(maxHp);
        const enemy = {
          id: this.enemyIdCounter += 1,
          progress: 0,
          hp: config.hp,
          maxHp: config.hp,
          speed: config.speed,
          reward: config.reward,
          color: config.color,
          label: config.label,
          typeId: config.codexId || null,
          pathMode,
          moteFactor: this.calculateMoteFactor(config),
          symbol,
          hpExponent,
        };
        this.enemies.push(enemy);
        this.activeWave.spawned += 1;
        this.activeWave.nextSpawn += config.interval;
        if (config.codexId) {
          registerEnemyEncounter(config.codexId);
        }
      }
    }

    updateTowers(delta) {
      this.towers.forEach((tower) => {
        tower.cooldown = Math.max(0, tower.cooldown - delta);
        if (!this.combatActive || !this.enemies.length) {
          return;
        }
        if (tower.cooldown > 0) {
          return;
        }
        const targetInfo = this.findTarget(tower);
        if (!targetInfo) {
          return;
        }
        tower.cooldown = 1 / tower.rate;
        this.fireAtTarget(tower, targetInfo);
      });
    }

    findTarget(tower) {
      const focusedEnemy = this.getFocusedEnemy();
      if (focusedEnemy) {
        const position = this.getEnemyPosition(focusedEnemy);
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= tower.range) {
          return { enemy: focusedEnemy, position };
        }
      }
      let selected = null;
      let bestProgress = -Infinity;
      this.enemies.forEach((enemy) => {
        const position = this.getEnemyPosition(enemy);
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= tower.range && enemy.progress > bestProgress) {
          selected = { enemy, position };
          bestProgress = enemy.progress;
        }
      });
      return selected;
    }

    fireAtTarget(tower, targetInfo) {
      if (tower.type === 'aleph-null') {
        this.fireAlephChain(tower, targetInfo);
        return;
      }
      const { enemy } = targetInfo;
      enemy.hp -= tower.damage;
      if (getTowerTierValue(tower) >= 24) {
        this.spawnOmegaWave(tower);
      }
      this.projectiles.push({
        source: { x: tower.x, y: tower.y },
        targetId: enemy.id,
        target: this.getEnemyPosition(enemy),
        lifetime: 0,
        maxLifetime: 0.24,
      });

      if (this.audio) {
        this.audio.playSfx('alphaTowerFire');
      }

      if (enemy.hp <= 0) {
        this.processEnemyDefeat(enemy);
      }
    }

    fireAlephChain(tower, targetInfo) {
      if (!targetInfo || !targetInfo.enemy) {
        return;
      }

      const chainStats =
        tower.chain || (this.alephChain ? this.alephChain.getState(tower.id) : null);
      const totalDamage = Number.isFinite(chainStats?.totalDamage)
        ? chainStats.totalDamage
        : tower.damage;
      const range = Number.isFinite(tower.range)
        ? tower.range
        : Number.isFinite(tower.baseRange)
        ? tower.baseRange
        : 0;
      const maxLinks = Math.max(1, Math.floor(chainStats?.linkCount ?? 1));

      const visited = new Set();
      const chainTargets = [];
      const firstEnemy = targetInfo.enemy;
      const firstPosition = targetInfo.position || this.getEnemyPosition(firstEnemy);
      chainTargets.push({ enemy: firstEnemy, position: firstPosition });
      visited.add(firstEnemy.id);

      let anchorPosition = firstPosition;
      let hopsRemaining = maxLinks - 1;

      while (hopsRemaining > 0 && anchorPosition) {
        let nearest = null;
        let nearestPosition = null;
        let nearestDistance = Infinity;
        this.enemies.forEach((candidate) => {
          if (!candidate || visited.has(candidate.id)) {
            return;
          }
          const candidatePosition = this.getEnemyPosition(candidate);
          const distance = Math.hypot(
            candidatePosition.x - anchorPosition.x,
            candidatePosition.y - anchorPosition.y,
          );
          if (distance <= range && distance < nearestDistance) {
            nearest = candidate;
            nearestPosition = candidatePosition;
            nearestDistance = distance;
          }
        });

        if (!nearest || !nearestPosition) {
          break;
        }

        chainTargets.push({ enemy: nearest, position: nearestPosition });
        visited.add(nearest.id);
        anchorPosition = nearestPosition;
        hopsRemaining -= 1;
      }

      let origin = { x: tower.x, y: tower.y };
      chainTargets.forEach((target) => {
        const enemy = target.enemy;
        enemy.hp -= totalDamage;
        this.projectiles.push({
          source: { ...origin },
          targetId: enemy.id,
          target: target.position,
          lifetime: 0,
          maxLifetime: 0.24,
        });
        if (enemy.hp <= 0) {
          this.processEnemyDefeat(enemy);
        }
        origin = { ...target.position };
      });

      if (getTowerTierValue(tower) >= 24) {
        this.spawnOmegaWave(tower);
      }

      if (this.audio) {
        this.audio.playSfx('alphaTowerFire');
      }
    }

    spawnOmegaWave(tower) {
      if (!tower) {
        return;
      }
      const tier = getTowerTierValue(tower);
      if (!Number.isFinite(tier) || tier < 24) {
        return;
      }
      const origin = { x: tower.x, y: tower.y };
      const pattern = getOmegaPatternForTier(tier);
      const visuals = getOmegaWaveVisualConfig(tower);
      const count = Math.max(6, Math.floor(pattern.projectileCount || 0));
      const baseSize = Math.max(3, visuals.size ?? pattern.baseSize ?? 4);
      const stage = Math.max(0, Math.floor(tier) - 24);
      const jitterStrength = 0.06 + stage * 0.02;
      const maxLifetime = Math.max(0.8, pattern.duration || 2);

      for (let index = 0; index < count; index += 1) {
        const phase = (Math.PI * 2 * index) / count;
        const ratioJitter = Math.sin(phase) * jitterStrength;
        const swirlJitter = Math.cos(phase * 1.5) * jitterStrength * 1.2;
        const radiusJitter = Math.sin(phase * 2) * stage * 4;
        const parameters = {
          ...pattern,
          ratio: pattern.ratio + ratioJitter,
          swirl: pattern.swirl + swirlJitter,
          radius: pattern.radius + radiusJitter,
          phaseShift: pattern.phaseShift + jitterStrength * 0.5,
        };

        this.projectiles.push({
          patternType: 'omegaWave',
          origin,
          position: { ...origin },
          previousPosition: { ...origin },
          lifetime: 0,
          maxLifetime,
          parameters,
          phase,
          color: visuals.color,
          trailColor: visuals.trailColor,
          size: baseSize,
          glowColor: visuals.glowColor,
          glowBlur: visuals.glowBlur,
        });
      }
    }

    updateEnemies(delta) {
      for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = this.enemies[index];
        enemy.progress += enemy.speed * delta;
        if (enemy.progress >= 1) {
          this.enemies.splice(index, 1);
          this.handleEnemyBreach(enemy);
        }
      }

      if (
        this.combatActive &&
        this.activeWave &&
        this.activeWave.spawned >= this.activeWave.config.count &&
        !this.enemies.length
      ) {
        this.advanceWave();
      }
    }

    updateProjectiles(delta) {
      for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = this.projectiles[index];
        projectile.lifetime += delta;

        if (projectile.patternType === 'omegaWave') {
          const maxLifetime = projectile.maxLifetime || 0;
          if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
            this.projectiles.splice(index, 1);
            continue;
          }

          const duration = maxLifetime > 0 ? maxLifetime : 1;
          const progress = Math.max(0, Math.min(1, projectile.lifetime / duration));
          const parameters = projectile.parameters || {};
          const envelopePower = Number.isFinite(parameters.envelopePower)
            ? parameters.envelopePower
            : 1;
          const envelopeBase = Math.sin(Math.PI * progress);
          const envelope = Math.pow(Math.max(0, envelopeBase), envelopePower);
          const loops = Number.isFinite(parameters.loops) ? parameters.loops : 1.5;
          const ratio = Number.isFinite(parameters.ratio) ? parameters.ratio : 1.6;
          const radius = Number.isFinite(parameters.radius) ? parameters.radius : 60;
          const swirlFrequency = Number.isFinite(parameters.swirlFrequency)
            ? parameters.swirlFrequency
            : 2.5;
          const returnCurve = Number.isFinite(parameters.returnCurve)
            ? parameters.returnCurve
            : 0.6;
          const swirlStrength = Number.isFinite(parameters.swirl) ? parameters.swirl : 0.8;
          const phaseShift = Number.isFinite(parameters.phaseShift)
            ? parameters.phaseShift
            : 0.3;
          const baseAngle = projectile.phase || 0;
          const angle = baseAngle + Math.PI * 2 * loops * progress;
          const swirlPhase = progress * Math.PI * swirlFrequency + baseAngle * phaseShift;
          const swirlOffset = Math.sin(swirlPhase) * radius * returnCurve * envelope * swirlStrength;
          const radial = radius * envelope;
          const offsetX = (radial + swirlOffset) * Math.cos(angle);
          const offsetY =
            (radial - swirlOffset) *
            Math.sin(angle * ratio + swirlStrength * Math.sin(angle));

          projectile.previousPosition = projectile.position || { ...projectile.origin };
          projectile.position = {
            x: (projectile.origin?.x || 0) + offsetX,
            y: (projectile.origin?.y || 0) + offsetY,
          };
          continue;
        }

        if (projectile.lifetime >= projectile.maxLifetime) {
          this.projectiles.splice(index, 1);
        }
      }
    }

    advanceWave() {
      if (!this.levelConfig) {
        return;
      }

      if (this.waveIndex + 1 >= this.levelConfig.waves.length) {
        if (this.isEndlessMode) {
          this.endlessCycle += 1;
          this.waveIndex = 0;
          this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
          this.waveTimer = 0;
          this.markWaveStart();
          if (this.messageEl) {
            this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${
              this.activeWave.config.label
            }.`;
          }
          this.updateHud();
          this.updateProgress();
          return;
        }
        this.handleVictory();
        return;
      }

      this.waveIndex += 1;
      this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
      this.waveTimer = 0;
      this.markWaveStart();
      if (this.messageEl) {
        this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label}.`;
      }
      this.updateHud();
      this.updateProgress();
    }

    handleEnemyBreach(enemy) {
      const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
      const fallbackHp = Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : 0;
      const damageSource = remainingHp > 0 ? remainingHp : fallbackHp;
      const damage = Math.max(1, Math.ceil(damageSource || 1));
      this.lives = Math.max(0, this.lives - damage);
      if (this.audio) {
        this.audio.playSfx('enemyBreach');
        const maxLives = Number.isFinite(this.levelConfig?.lives)
          ? Math.max(1, this.levelConfig.lives)
          : null;
        if (maxLives && damage / maxLives > 0.05) {
          this.audio.playSfx('error');
        }
      }
      if (this.messageEl) {
        const label = enemy.label || 'Glyph';
        this.messageEl.textContent = `${label} breached the core—Integrity −${damage}.`;
      }
      if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
        this.clearEnemyHover();
      }
      if (this.focusedEnemyId === enemy.id) {
        this.clearFocusedEnemy({ silent: true });
      }
      if (this.lives <= 0) {
        this.handleDefeat();
      }
      this.updateHud();
      this.updateProgress();
    }

    processEnemyDefeat(enemy) {
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) {
        this.enemies.splice(index, 1);
      }
      if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
        this.clearEnemyHover();
      }
      if (this.focusedEnemyId === enemy.id) {
        this.clearFocusedEnemy({ silent: true });
      }

      const baseGain =
        (this.levelConfig?.theroPerKill ?? this.levelConfig?.energyPerKill ?? 0) +
        (enemy.reward || 0);
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      this.energy = Math.min(cap, this.energy + baseGain);

      if (this.messageEl) {
        this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${Math.round(
          baseGain,
        )} ${THERO_SYMBOL}.`;
      }
      this.updateHud();
      this.updateProgress();
      updateStatusDisplays();

      if (this.audio) {
        this.audio.playSfx('enemyDefeat');
      }

      if (Number.isFinite(enemy.moteFactor) && enemy.moteFactor > 0) {
        queueMoteDrop(enemy.moteFactor);
      }

      notifyEnemyDefeated();
    }

    handleVictory() {
      if (this.resolvedOutcome === 'victory') {
        return;
      }
      if (this.audio) {
        this.audio.playSfx('victory');
      }
      this.combatActive = false;
      this.resolvedOutcome = 'victory';
      this.activeWave = null;
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      const reward = this.levelConfig.rewardThero ?? this.levelConfig.rewardEnergy ?? 0;
      this.energy = Math.min(cap, this.energy + reward);
      this.currentWaveNumber = this.baseWaveCount || this.currentWaveNumber;
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Run Again';
      }
      if (this.messageEl) {
        const title = this.levelConfig.displayName || 'Defense';
        this.messageEl.textContent = `Victory! ${title} is sealed.`;
      }
      this.updateHud();
      this.updateProgress();
      if (this.onVictory) {
        this.onVictory(this.levelConfig.id, {
          rewardScore: this.levelConfig.rewardScore,
          rewardFlux: this.levelConfig.rewardFlux,
          rewardThero: reward,
          rewardEnergy: this.levelConfig.rewardEnergy,
          towers: this.towers.length,
          lives: this.lives,
          maxWave: this.maxWaveReached,
          startThero: this.levelConfig.startThero,
        });
      }
      const refreshedStart = calculateStartingThero();
      if (Number.isFinite(refreshedStart)) {
        this.levelConfig.startThero = refreshedStart;
        this.energy = Math.min(cap, Math.max(this.energy, refreshedStart));
        this.updateHud();
      }
      updateStatusDisplays();
    }

    handleDefeat() {
      if (this.resolvedOutcome === 'defeat') {
        return;
      }
      if (this.audio) {
        this.audio.playSfx('defeat');
      }
      this.combatActive = false;
      this.resolvedOutcome = 'defeat';
      this.activeWave = null;
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      const baseline = this.levelConfig.startThero ?? this.levelConfig.startEnergy ?? 0;
      this.energy = Math.min(cap, Math.max(this.energy, baseline));
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Retry Wave';
      }
      if (this.messageEl) {
        const waveLabel = this.maxWaveReached > 0 ? ` at wave ${this.maxWaveReached}` : '';
        this.messageEl.textContent = `Defense collapsed${waveLabel}—recalibrate the anchors and retry.`;
      }
      this.updateHud();
      this.updateProgress();
      updateStatusDisplays();
      if (this.onDefeat) {
        this.onDefeat(this.levelConfig.id, {
          towers: this.towers.length,
          maxWave: this.maxWaveReached,
        });
      }
    }

    updateHud() {
      if (this.waveEl) {
        if (!this.levelConfig) {
          this.waveEl.textContent = '—';
        } else {
          if (this.isEndlessMode) {
            const displayWave = this.combatActive
              ? this.currentWaveNumber
              : Math.max(1, this.currentWaveNumber || 1);
            this.waveEl.textContent = `Wave ${displayWave}`;
          } else {
            const total = this.levelConfig.waves.length;
            const displayWave = this.combatActive
              ? this.waveIndex + 1
              : Math.min(this.waveIndex + 1, total);
            this.waveEl.textContent = `${displayWave}/${total}`;
          }
        }
      }

      if (this.healthEl) {
        this.healthEl.textContent = this.levelConfig
          ? `${this.lives}/${this.levelConfig.lives}`
          : '—';
      }

      if (this.energyEl) {
        if (!this.levelConfig) {
          this.energyEl.textContent = '—';
        } else if (!Number.isFinite(this.energy)) {
          this.energyEl.textContent = `∞ ${THERO_SYMBOL}`;
        } else {
          this.energyEl.textContent = `${Math.round(this.energy)} ${THERO_SYMBOL}`;
        }
      }

      this.updateSpeedButton();
      this.updateAutoAnchorButton();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
    }

    updateProgress() {
      if (!this.progressEl) {
        return;
      }

      if (!this.levelConfig) {
        this.progressEl.textContent = 'No active level.';
        return;
      }

      if (!this.combatActive) {
        if (this.resolvedOutcome === 'victory') {
          const title = this.levelConfig.displayName || 'Defense';
          this.progressEl.textContent = `${title} stabilized—victory sealed.`;
        } else if (this.resolvedOutcome === 'defeat') {
          const waveNote = this.maxWaveReached > 0 ? ` Reached wave ${this.maxWaveReached}.` : '';
          this.progressEl.textContent = `Defense collapsed—rebuild the proof lattice.${waveNote}`;
        } else {
          const remainingMs =
            this.autoWaveEnabled && this.autoStartDeadline
              ? this.autoStartDeadline - Date.now()
              : 0;
          if (remainingMs > 0) {
            const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
            const intro = this.isEndlessMode ? 'Endless mode primed' : 'Wave prep underway';
            this.progressEl.textContent = `${intro}—auto-start in ${seconds}s.`;
          } else {
            this.progressEl.textContent = this.isEndlessMode
              ? 'Endless mode primed—auto-start will trigger after preparations.'
              : 'Wave prep underway.';
          }
        }
        return;
      }

      const total = this.levelConfig.waves.length;
      const remainingInWave = this.activeWave
        ? Math.max(0, this.activeWave.config.count - this.activeWave.spawned)
        : 0;
      const remaining = remainingInWave + this.enemies.length;
      const label = this.levelConfig.waves[this.waveIndex]?.label || 'glyphs';
      if (this.isEndlessMode) {
        this.progressEl.textContent = `Wave ${this.currentWaveNumber} — ${remaining} ${label} remaining.`;
      } else {
        const current = Math.min(this.waveIndex + 1, total);
        this.progressEl.textContent = `Wave ${current}/${total} — ${remaining} ${label} remaining.`;
      }
    }

    getCanvasPosition(normalized) {
      return {
        x: normalized.x * this.renderWidth,
        y: normalized.y * this.renderHeight,
      };
    }

    getNormalizedFromCanvasPosition(position) {
      if (!position || !this.canvas) {
        return null;
      }
      const width = this.renderWidth || this.canvas.width || 1;
      const height = this.renderHeight || this.canvas.height || 1;
      if (!width || !height) {
        return null;
      }
      const normalized = {
        x: position.x / width,
        y: position.y / height,
      };
      return this.clampNormalized(normalized);
    }

    clampNormalized(normalized) {
      if (!normalized) {
        return null;
      }
      const clamp = (value) => {
        if (!Number.isFinite(value)) {
          return 0.5;
        }
        return Math.min(Math.max(value, 0.04), 0.96);
      };
      return {
        x: clamp(normalized.x),
        y: clamp(normalized.y),
      };
    }

    getCanvasRelativeFromClient(point) {
      if (!this.canvas || !point) {
        return null;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x, y };
    }

    getViewCenter() {
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      const normalized = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
      return {
        x: width * normalized.x,
        y: height * normalized.y,
      };
    }

    setViewCenterFromWorld(world) {
      if (!world) {
        return;
      }
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      if (!width || !height) {
        this.viewCenterNormalized = { x: 0.5, y: 0.5 };
        return;
      }
      const normalized = {
        x: world.x / width,
        y: world.y / height,
      };
      this.viewCenterNormalized = this.clampViewCenterNormalized(normalized);
    }

    clampViewCenterNormalized(normalized) {
      if (!normalized) {
        return { x: 0.5, y: 0.5 };
      }
      const scale = Math.max(this.viewScale || 1, 0.0001);
      const halfWidth = Math.min(0.5, 0.5 / scale);
      const halfHeight = Math.min(0.5, 0.5 / scale);
      const clamp = (value, min, max) => {
        if (min > max) {
          return 0.5;
        }
        return Math.min(Math.max(value, min), max);
      };
      return {
        x: clamp(normalized.x, halfWidth, 1 - halfWidth),
        y: clamp(normalized.y, halfHeight, 1 - halfHeight),
      };
    }

    applyViewConstraints() {
      this.viewCenterNormalized = this.clampViewCenterNormalized(
        this.viewCenterNormalized || { x: 0.5, y: 0.5 },
      );
    }

    screenToWorld(point) {
      if (!point) {
        return null;
      }
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      const scale = this.viewScale || 1;
      if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
      }
      const center = this.getViewCenter();
      return {
        x: center.x + (point.x - width / 2) / scale,
        y: center.y + (point.y - height / 2) / scale,
      };
    }

    worldToScreen(point) {
      if (!point) {
        return null;
      }
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      const scale = this.viewScale || 1;
      if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
      }
      const center = this.getViewCenter();
      return {
        x: width / 2 + (point.x - center.x) * scale,
        y: height / 2 + (point.y - center.y) * scale,
      };
    }

    getPointAlongPath(progress) {
      if (!this.pathSegments.length) {
        return { x: 0, y: 0 };
      }

      const target = Math.min(progress, 1) * this.pathLength;
      let traversed = 0;

      for (let index = 0; index < this.pathSegments.length; index += 1) {
        const segment = this.pathSegments[index];
        if (traversed + segment.length >= target) {
          const ratio = segment.length > 0 ? (target - traversed) / segment.length : 0;
          return {
            x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
            y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
          };
        }
        traversed += segment.length;
      }

      const lastSegment = this.pathSegments[this.pathSegments.length - 1];
      return lastSegment ? { ...lastSegment.end } : { x: 0, y: 0 };
    }

    getEnemyPosition(enemy) {
      if (!enemy) {
        return { x: 0, y: 0 };
      }

      if (enemy.pathMode === 'direct' && this.pathSegments.length) {
        const startSegment = this.pathSegments[0];
        const endSegment = this.pathSegments[this.pathSegments.length - 1];
        const start = startSegment ? startSegment.start : { x: 0, y: 0 };
        const end = endSegment ? endSegment.end : start;
        const clamped = Math.max(0, Math.min(1, enemy.progress));
        return {
          x: start.x + (end.x - start.x) * clamped,
          y: start.y + (end.y - start.y) * clamped,
        };
      }

      return this.getPointAlongPath(enemy.progress);
    }

    draw() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      const viewCenter = this.getViewCenter();
      ctx.translate(width / 2, height / 2);
      ctx.scale(this.viewScale, this.viewScale);
      ctx.translate(-viewCenter.x, -viewCenter.y);

      this.drawFloaters();
      this.drawPath();
      this.drawArcLight();
      this.drawNodes();
      this.drawDeveloperPathMarkers();
      this.drawPlacementPreview();
      this.drawTowers();
      this.drawEnemies();
      this.drawProjectiles();
      this.updateEnemyTooltipPosition();
    }

    drawFloaters() {
      if (!this.ctx || !this.floaters.length || !this.levelConfig) {
        return;
      }
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
      if (!width || !height) {
        return;
      }
      const minDimension = Math.min(width, height) || 1;
      const connectionWidth = Math.max(0.6, minDimension * 0.0014);

      const ctx = this.ctx;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      this.floaterConnections.forEach((connection) => {
        const from = this.floaters[connection.from];
        const to = this.floaters[connection.to];
        if (!from || !to) {
          return;
        }
        const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
        if (alpha <= 0) {
          return;
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = connectionWidth;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });

      this.floaters.forEach((floater) => {
        const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
        if (opacity <= 0) {
          return;
        }
        let radiusFactor = Number.isFinite(floater.radiusFactor)
          ? floater.radiusFactor
          : null;
        if (!radiusFactor) {
          radiusFactor = this.randomFloaterRadiusFactor();
          floater.radiusFactor = radiusFactor;
        }
        const radius = Math.max(2, radiusFactor * minDimension);
        const strokeWidth = Math.max(0.8, radius * 0.22);
        ctx.beginPath();
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
        ctx.arc(floater.x, floater.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.restore();
    }

    drawPath() {
      if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
        return;
      }
      const ctx = this.ctx;
      const points = this.pathPoints;
      const start = points[0];
      const end = points[points.length - 1];

      const baseGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      baseGradient.addColorStop(0, 'rgba(88, 160, 255, 0.5)');
      baseGradient.addColorStop(0.48, 'rgba(162, 110, 255, 0.48)');
      baseGradient.addColorStop(1, 'rgba(255, 158, 88, 0.5)');

      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.shadowColor = 'rgba(88, 160, 255, 0.2)';
      ctx.shadowBlur = 12;
      ctx.moveTo(start.x, start.y);
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = baseGradient;
      ctx.stroke();
      ctx.restore();

      const highlightGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      highlightGradient.addColorStop(0, 'rgba(88, 160, 255, 0.12)');
      highlightGradient.addColorStop(0.52, 'rgba(162, 110, 255, 0.1)');
      highlightGradient.addColorStop(1, 'rgba(255, 158, 88, 0.14)');

      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.moveTo(start.x, start.y);
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = highlightGradient;
      ctx.stroke();
      ctx.restore();
    }

    drawArcLight() {
      if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
        return;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 180, 105, 0.7)';
      ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.18]);
      ctx.lineDashOffset = this.arcOffset;
      ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
      for (let index = 1; index < this.pathPoints.length; index += 1) {
        const point = this.pathPoints[index];
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawMindGateSymbol(ctx, position) {
      if (!ctx || !position) {
        return;
      }

      const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
      const baseRadius = dimension ? dimension * 0.035 : 0;
      const radius = Math.max(14, Math.min(24, baseRadius || 18));

      ctx.save();
      ctx.translate(position.x, position.y);

      const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
      glow.addColorStop(0, 'rgba(255, 248, 220, 0.9)');
      glow.addColorStop(0.6, 'rgba(255, 196, 150, 0.35)');
      glow.addColorStop(1, 'rgba(255, 158, 88, 0.15)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'rgba(255, 196, 150, 0.55)';
      ctx.shadowBlur = radius * 0.9;
      ctx.strokeStyle = 'rgba(255, 158, 88, 0.88)';
      ctx.lineWidth = Math.max(2, radius * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowColor = 'rgba(139, 247, 255, 0.55)';
      ctx.shadowBlur = radius * 0.7;
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
      ctx.lineWidth = Math.max(1.4, radius * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, radius * 0.64);
      ctx.lineTo(0, -radius * 0.6);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 228, 120, 0.92)';
      ctx.shadowColor = 'rgba(255, 228, 120, 0.55)';
      ctx.shadowBlur = radius * 0.8;
      ctx.lineWidth = Math.max(1.6, radius * 0.14);
      ctx.beginPath();
      const gateWidth = radius * 0.58;
      const gateBase = radius * 0.62;
      ctx.moveTo(-gateWidth, gateBase);
      ctx.lineTo(-gateWidth, -radius * 0.18);
      ctx.quadraticCurveTo(0, -radius * 0.95, gateWidth, -radius * 0.18);
      ctx.lineTo(gateWidth, gateBase);
      ctx.stroke();

      const gateIntegrity = Math.max(0, Math.floor(this.lives || 0));
      const maxIntegrity = Math.max(
        gateIntegrity,
        Math.floor(this.levelConfig?.lives || gateIntegrity || 1),
      );
      const gateExponentSource = gateIntegrity > 0 ? gateIntegrity : maxIntegrity || 1;
      const gateExponent = this.calculateHealthExponent(gateExponentSource);
      const palette =
        typeof this.getEffectiveMotePalette === 'function'
          ? this.getEffectiveMotePalette()
          : null;
      const paletteStops = resolvePaletteColorStops(palette);
      const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
      if (Array.isArray(paletteStops) && paletteStops.length) {
        const denominator = Math.max(1, paletteStops.length - 1);
        paletteStops.forEach((stop, index) => {
          const offset = Math.max(0, Math.min(1, index / denominator));
          gradient.addColorStop(offset, colorToRgbaString(stop, 1));
        });
      }
      ctx.font = `${Math.round(Math.max(14, radius * 0.82))}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = gradient;
      const highlightColor = paletteStops[paletteStops.length - 1] || paletteStops[0];
      ctx.shadowColor = colorToRgbaString(highlightColor, 0.85);
      ctx.shadowBlur = Math.max(14, radius * 0.95);
      const exponentOffset = radius * 0.78;
      const exponentX = exponentOffset;
      const exponentY = -exponentOffset * 0.88;
      ctx.fillText(String(gateExponent), exponentX, exponentY);

      ctx.restore();
    }

    drawNodes() {
      if (!this.ctx || !this.pathSegments.length) {
        return;
      }
      const ctx = this.ctx;
      const startPoint = this.pathPoints.length ? this.pathPoints[0] : this.pathSegments[0].start;
      const endPoint = this.pathPoints.length
        ? this.pathPoints[this.pathPoints.length - 1]
        : this.pathSegments[this.pathSegments.length - 1].end;
      ctx.fillStyle = 'rgba(88, 160, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 10, 0, Math.PI * 2);
      ctx.fill();
      this.drawMindGateSymbol(ctx, endPoint);
    }

    setDeveloperPathMarkers(markers) {
      if (!Array.isArray(markers)) {
        this.developerPathMarkers = [];
        return;
      }

      this.developerPathMarkers = markers
        .map((marker, index) => {
          if (!marker) {
            return null;
          }
          const x = Number(marker.x);
          const y = Number(marker.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }
          return {
            x,
            y,
            label:
              marker.label !== undefined && marker.label !== null
                ? marker.label
                : index + 1,
            active: Boolean(marker.active),
          };
        })
        .filter(Boolean);
    }

    drawDeveloperPathMarkers() {
      if (!this.ctx || !Array.isArray(this.developerPathMarkers) || !this.developerPathMarkers.length) {
        return;
      }

      const ctx = this.ctx;
      ctx.save();
      ctx.font = '12px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      this.developerPathMarkers.forEach((marker, index) => {
        const radius = marker.active ? 12 : 10;
        ctx.beginPath();
        ctx.fillStyle = marker.active ? 'rgba(18, 26, 44, 0.9)' : 'rgba(12, 16, 28, 0.82)';
        ctx.strokeStyle = marker.active
          ? 'rgba(139, 247, 255, 0.9)'
          : 'rgba(139, 247, 255, 0.55)';
        ctx.lineWidth = marker.active ? 2 : 1.5;
        if (marker.active) {
          ctx.shadowColor = 'rgba(139, 247, 255, 0.3)';
          ctx.shadowBlur = 16;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0)';
          ctx.shadowBlur = 0;
        }
        ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const label = marker.label !== undefined && marker.label !== null ? marker.label : index + 1;
        if (label !== undefined && label !== null) {
          ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
          ctx.fillText(String(label), marker.x, marker.y);
        }
      });

      ctx.restore();
    }

    drawTowers() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      this.towers.forEach((tower) => {
        const visuals = getTowerVisualConfig(tower);
        ctx.save();
        if (visuals.outerShadow?.color) {
          ctx.shadowColor = visuals.outerShadow.color;
          ctx.shadowBlur = visuals.outerShadow.blur ?? 18;
        }
        ctx.beginPath();
        ctx.strokeStyle = visuals.outerStroke || 'rgba(255, 228, 120, 0.85)';
        ctx.lineWidth = 3;
        ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = visuals.innerFill || 'rgba(8, 9, 14, 0.9)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 10, 0, Math.PI * 2);
        ctx.fill();

        if (tower.symbol) {
          ctx.save();
          if (visuals.symbolShadow?.color) {
            ctx.shadowColor = visuals.symbolShadow.color;
            ctx.shadowBlur = visuals.symbolShadow.blur ?? 20;
            if (typeof visuals.symbolShadow.offsetX === 'number') {
              ctx.shadowOffsetX = visuals.symbolShadow.offsetX;
            }
            if (typeof visuals.symbolShadow.offsetY === 'number') {
              ctx.shadowOffsetY = visuals.symbolShadow.offsetY;
            }
          }
          ctx.fillStyle = visuals.symbolFill || 'rgba(255, 228, 120, 0.85)';
          ctx.font = '18px "Cormorant Garamond", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tower.symbol, tower.x, tower.y);
          ctx.restore();
        }

        if (!this.combatActive) {
          ctx.beginPath();
          ctx.strokeStyle = visuals.rangeStroke || 'rgba(139, 247, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    drawPlacementPreview() {
      if (!this.ctx || !this.hoverPlacement || !this.levelConfig) {
        return;
      }
      const { position, range, valid, dragging, symbol } = this.hoverPlacement;
      const ctx = this.ctx;
      const stroke = valid ? 'rgba(139, 247, 255, 0.7)' : 'rgba(120, 132, 150, 0.6)';
      const fill = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(120, 132, 150, 0.1)';

      const drawX = position.x;
      const drawY = position.y;

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const previewRange = range || Math.min(this.renderWidth, this.renderHeight) * 0.24;
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(position.x, position.y, previewRange, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 18, 0, Math.PI * 2);
      ctx.fill();

      if (symbol) {
        ctx.fillStyle = valid ? 'rgba(255, 228, 120, 0.85)' : 'rgba(190, 190, 200, 0.75)';
        ctx.font = `${dragging ? 20 : 18}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, drawX, drawY);
      }

      if (typeof this.hoverPlacement.cost === 'number') {
        ctx.font = '12px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = valid ? 'rgba(139, 247, 255, 0.75)' : 'rgba(160, 160, 168, 0.6)';
        ctx.fillText(`${Math.round(this.hoverPlacement.cost)} ${THERO_SYMBOL}`, drawX, drawY + 20);
      }
      ctx.restore();
    }

    drawEnemies() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      const focusedEnemy = this.getFocusedEnemy();
      const focusedId = focusedEnemy ? focusedEnemy.id : null;
      const focusAngle = this.focusMarkerAngle;
      this.enemies.forEach((enemy) => {
        const position = this.getEnemyPosition(enemy);
        if (!position) {
          return;
        }
        const rawHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
        const fallbackHp = Number.isFinite(enemy.maxHp) ? Math.max(1, enemy.maxHp) : 1;
        const exponentSource = rawHp > 0 ? rawHp : fallbackHp;
        const exponent = this.calculateHealthExponent(exponentSource);
        enemy.hpExponent = exponent;
        const metrics = this.getEnemyVisualMetrics(enemy);
        const fillColor = enemy.color || 'rgba(139, 247, 255, 0.9)';
        const projectedDamage = Math.max(1, Math.ceil(exponentSource || 1));
        const gateIntegrity = Math.max(1, Math.floor(this.lives || 0) || 1);
        const lethal = projectedDamage >= gateIntegrity;
        const exponentColor = lethal ? '#ff375f' : '#ff8c42';
        const exponentGlow = lethal ? 'rgba(255, 70, 95, 0.9)' : 'rgba(255, 140, 66, 0.85)';

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = fillColor;
        ctx.arc(position.x, position.y, metrics.coreRadius, 0, Math.PI * 2);
        ctx.fill();

        const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = Math.max(2, metrics.scale * 1.8);
        ctx.arc(position.x, position.y, metrics.ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.stroke();

        const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
        if (symbol) {
          ctx.font = `${metrics.symbolSize}px "Cormorant Garamond", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.shadowColor = fillColor;
          ctx.shadowBlur = 6 * metrics.scale;
          ctx.fillText(symbol, position.x, position.y);
        }

        ctx.font = `${metrics.exponentSize}px "Space Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = exponentColor;
        ctx.shadowColor = exponentGlow;
        ctx.shadowBlur = 12 * metrics.scale;
        const exponentOffset = metrics.coreRadius * 0.68;
        const exponentX = position.x + exponentOffset;
        const exponentY = position.y - exponentOffset * 0.8;
        ctx.fillText(String(exponent), exponentX, exponentY);

        if (enemy.id === focusedId) {
          ctx.save();
          ctx.translate(position.x, position.y);
          ctx.rotate(focusAngle);
          ctx.beginPath();
          const sides = 6;
          for (let index = 0; index < sides; index += 1) {
            const angle = (Math.PI * 2 * index) / sides;
            const x = Math.cos(angle) * metrics.focusRadius;
            const y = Math.sin(angle) * metrics.focusRadius;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.lineWidth = Math.max(2.4, 2.4 * metrics.scale);
          ctx.strokeStyle = 'rgba(255, 228, 120, 0.9)';
          ctx.shadowColor = 'rgba(255, 228, 120, 0.55)';
          ctx.shadowBlur = 14 * metrics.scale;
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      });
    }

    drawProjectiles() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      this.projectiles.forEach((projectile) => {
        if (projectile.patternType === 'omegaWave') {
          const duration = projectile.maxLifetime || 1;
          const progress = Math.max(0, Math.min(1, projectile.lifetime / duration));
          const alpha = Math.max(0, 1 - progress ** 1.1);
          const position = projectile.position || projectile.origin;
          if (!position) {
            return;
          }

          ctx.save();
          ctx.globalAlpha = alpha;
          if (projectile.glowColor) {
            ctx.shadowColor = projectile.glowColor;
            const blur = projectile.glowBlur ?? (projectile.size || 4) * 3.2;
            ctx.shadowBlur = blur;
          }
          ctx.fillStyle = projectile.color || 'rgba(255, 228, 120, 0.7)';
          ctx.beginPath();
          ctx.arc(position.x, position.y, projectile.size || 4, 0, Math.PI * 2);
          ctx.fill();

          if (projectile.trailColor && projectile.previousPosition) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = projectile.trailColor;
            ctx.lineWidth = Math.max(1, (projectile.size || 4) * 0.65);
            ctx.beginPath();
            ctx.moveTo(projectile.previousPosition.x, projectile.previousPosition.y);
            ctx.lineTo(position.x, position.y);
            ctx.stroke();
          }
          ctx.restore();
          return;
        }

        const enemy = this.enemies.find((candidate) => candidate.id === projectile.targetId);
        if (enemy) {
          projectile.target = this.getEnemyPosition(enemy);
        }
        const target = projectile.target || projectile.source;
        const alpha = Math.max(0, 1 - projectile.lifetime / projectile.maxLifetime);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(projectile.source.x, projectile.source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  function beginIdleLevelRun(level) {
    if (!level || isInteractiveLevel(level.id)) {
      return;
    }

    const config = idleLevelConfigs.get(level.id);
    if (!config) {
      return;
    }

    if (!idleLevelRuns.has(level.id)) {
      idleLevelRuns.set(level.id, {
        levelId: level.id,
        duration: config.runDuration,
        durationMs: config.runDuration * 1000,
        rewardScore: config.rewardScore,
        rewardFlux: config.rewardFlux,
        rewardEnergy: config.rewardEnergy,
        startTime: null,
        progress: 0,
        remainingMs: config.runDuration * 1000,
      });
    }

    updateIdleLevelDisplay();
  }

  function stopIdleLevelRun(levelId) {
    const runner = idleLevelRuns.get(levelId);
    if (!runner) {
      return;
    }

    idleLevelRuns.delete(levelId);

    const state = levelState.get(levelId);
    if (state) {
      levelState.set(levelId, { ...state, running: false });
    }

    if (levelId === activeLevelId && !isInteractiveLevel(levelId)) {
      updateIdleLevelDisplay();
    }
  }

  function stopAllIdleRuns(exceptId) {
    const levelIds = Array.from(idleLevelRuns.keys());
    levelIds.forEach((levelId) => {
      if (levelId === exceptId) {
        return;
      }
      stopIdleLevelRun(levelId);
    });
  }

  function completeIdleLevelRun(levelId, runner) {
    if (!levelId || isInteractiveLevel(levelId)) {
      return;
    }

    const stats = {
      rewardScore: runner.rewardScore,
      rewardFlux: runner.rewardFlux,
      rewardEnergy: runner.rewardEnergy,
      runDuration: runner.duration,
    };

    handlePlayfieldVictory(levelId, stats);

    if (activeLevelId === levelId) {
      updateIdleLevelDisplay();
    }
  }

  function updateIdleRuns(timestamp) {
    if (!idleLevelRuns.size) {
      if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
        updateIdleLevelDisplay();
      }
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : 0;

    idleLevelRuns.forEach((runner, levelId) => {
      if (runner.startTime === null) {
        runner.startTime = now;
      }

      const elapsed = Math.max(0, now - runner.startTime);
      const total = Math.max(1, runner.durationMs);
      const clampedElapsed = Math.min(elapsed, total);

      runner.progress = clampedElapsed / total;
      runner.remainingMs = Math.max(0, total - clampedElapsed);

      if (elapsed >= total) {
        idleLevelRuns.delete(levelId);
        runner.progress = 1;
        runner.remainingMs = 0;
        completeIdleLevelRun(levelId, runner);
      }
    });

    updateLevelCards();

    if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
      updateIdleLevelDisplay(idleLevelRuns.get(activeLevelId) || null);
    }
  }

  function updateIdleLevelDisplay(activeRunner = null) {
    if (!activeLevelId || isInteractiveLevel(activeLevelId)) {
      return;
    }

    if (!playfieldElements.message || !playfieldElements.progress) {
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId) || {};
    const runner = activeRunner || idleLevelRuns.get(activeLevelId) || null;

    if (!level) {
      return;
    }

    if (runner) {
      const remainingSeconds = Math.ceil(runner.remainingMs / 1000);
      const percent = Math.min(100, Math.max(0, Math.round(runner.progress * 100)));
      playfieldElements.message.textContent = `${level.title} auto-sim running—sigils recalibrating.`;
      playfieldElements.progress.textContent = `Simulation progress: ${percent}% · ${remainingSeconds}s remaining.`;
    } else if (state.running) {
      playfieldElements.message.textContent = `${level.title} is initializing—automated glyphs mobilizing.`;
      playfieldElements.progress.textContent = 'Auto-run preparing to deploy.';
    } else if (state.completed) {
      playfieldElements.message.textContent = `${level.title} sealed—auto-run rewards claimed.`;
      playfieldElements.progress.textContent = 'Simulation complete. Re-enter to rerun the proof.';
    } else {
      playfieldElements.message.textContent = 'Tap the highlighted overlay to begin this automated defense.';
      playfieldElements.progress.textContent = 'Awaiting confirmation.';
    }

    if (playfieldElements.wave) {
      playfieldElements.wave.textContent = '—';
    }
    if (playfieldElements.health) {
      playfieldElements.health.textContent = '—';
    }
    if (playfieldElements.energy) {
      playfieldElements.energy.textContent = '—';
    }

    if (playfieldElements.startButton) {
      if (runner || state.running) {
        playfieldElements.startButton.textContent = runner
          ? 'Auto-run Active'
          : 'Auto-run Initializing';
      } else {
        playfieldElements.startButton.textContent = 'Preview Only';
      }
      playfieldElements.startButton.disabled = true;
    }
  }

  function handlePlayfieldCombatStart(levelId) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: false,
      running: false,
      completed: false,
    };
    const updated = { ...existing, entered: true, running: true };
    levelState.set(levelId, updated);
    activeLevelId = levelId;
    resourceState.running = true;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldVictory(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const alreadyCompleted = Boolean(existing.completed);
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: true,
      bestWave,
      lastResult: { outcome: 'victory', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;

    notifyLevelVictory(levelId);

    if (!alreadyCompleted) {
      if (typeof stats.rewardScore === 'number') {
        resourceState.score += stats.rewardScore;
      }
      if (typeof stats.rewardFlux === 'number') {
        baseResources.fluxRate += stats.rewardFlux;
      }
      if (typeof stats.rewardEnergy === 'number') {
        baseResources.energyRate += stats.rewardEnergy;
      }
      unlockNextInteractiveLevel(levelId);
      updateResourceRates();
      updatePowderLedger();
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldDefeat(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: existing.completed,
      bestWave,
      lastResult: { outcome: 'defeat', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
  }

  const tabHotkeys = new Map([
    ['1', 'tower'],
    ['2', 'towers'],
    ['3', 'powder'],
    ['4', 'achievements'],
    ['5', 'options'],
  ]);

  function isTextInput(element) {
    if (!element) return false;
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    return (
      element.isContentEditable ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select'
    );
  }

  function setActiveTab(target) {
    ensureTabCollections();

    if (!tabs.length || !panels.length) {
      const allTabs = Array.from(document.querySelectorAll('.tab-button'));
      const allPanels = Array.from(document.querySelectorAll('.panel'));

      allTabs.forEach((tab, index) => {
        const isActive = tab.dataset.tab === target;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        if (isActive) {
          activeTabIndex = index;
        }
      });

      allPanels.forEach((panel) => {
        const isActive = panel.dataset.panel === target;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        if (isActive) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      if (!tabs.length) {
        tabs = allTabs;
      }
      if (!panels.length) {
        panels = allPanels;
      }

      const activeTab = allTabs.find((tab) => tab.classList.contains('active'));
      if (activeTab) {
        activeTabId = activeTab.dataset.tab || activeTabId;
        refreshTabMusic();
      }

      return;
    }

    let matchedTab = false;

    tabs.forEach((tab, index) => {
      const isActive = tab.dataset.tab === target;
      if (isActive) {
        tab.classList.add('active');
        tab.setAttribute('aria-pressed', 'true');
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');
        activeTabIndex = index;
        matchedTab = true;
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-pressed', 'false');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === target;
      if (isActive) {
        panel.classList.add('active');
        panel.setAttribute('aria-hidden', 'false');
        panel.removeAttribute('hidden');
      } else {
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('hidden', '');
      }
    });

    if (matchedTab && target === 'tower') {
      updateActiveLevelBanner();
    }

    if (matchedTab) {
      activeTabId = target;
      refreshTabMusic();
    }
  }

  function focusAndActivateTab(index) {
    if (!tabs.length) return;
    const normalizedIndex = ((index % tabs.length) + tabs.length) % tabs.length;
    const targetTab = tabs[normalizedIndex];
    if (!targetTab) return;
    setActiveTab(targetTab.dataset.tab);
    targetTab.focus();
  }

  function collapseLevelSet(element, { focusTrigger = false } = {}) {
    if (!element) {
      return;
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.remove('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'true');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        node.tabIndex = -1;
      });
    }

    if (expandedLevelSet === element) {
      expandedLevelSet = null;
    }
  }

  function expandLevelSet(element) {
    if (!element || element.classList.contains('locked') || element.hidden) {
      return;
    }

    if (expandedLevelSet && expandedLevelSet !== element) {
      collapseLevelSet(expandedLevelSet);
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.add('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'false');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        const levelId = node.dataset.level;
        const unlocked = levelId ? isLevelUnlocked(levelId) : false;
        node.tabIndex = unlocked ? 0 : -1;
      });
    }

    expandedLevelSet = element;
  }

  function handleDocumentPointerDown(event) {
    if (!expandedLevelSet) {
      return;
    }

    if (event && expandedLevelSet.contains(event.target)) {
      return;
    }

    if (event && event.target && event.target.closest('.level-set')) {
      return;
    }

    collapseLevelSet(expandedLevelSet);
    if (audioManager) {
      audioManager.playSfx('menuSelect');
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== 'Escape') {
      return;
    }

    if (!expandedLevelSet) {
      return;
    }

    collapseLevelSet(expandedLevelSet, { focusTrigger: true });
    if (audioManager) {
      audioManager.playSfx('menuSelect');
    }
  }

  function handleGlobalButtonPointerDown(event) {
    if (!event) {
      return;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!target) {
      return;
    }
    const button = target.closest('button');
    if (!button) {
      return;
    }
    if (button.disabled) {
      return;
    }
    const ariaDisabled = button.getAttribute('aria-disabled');
    if (ariaDisabled && ariaDisabled !== 'false') {
      return;
    }
    triggerButtonRipple(button, event);
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('pointerdown', handleGlobalButtonPointerDown);
  document.addEventListener('keydown', handleDocumentKeyDown);

  function triggerButtonRipple(button, event) {
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'button-ripple';

    const maxDimension = Math.max(rect.width, rect.height);
    const size = maxDimension * 1.6;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    let offsetX = rect.width / 2;
    let offsetY = rect.height / 2;
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
    }

    ripple.style.left = `${offsetX}px`;
    ripple.style.top = `${offsetY}px`;

    button.querySelectorAll('.button-ripple').forEach((existing) => existing.remove());
    button.append(ripple);

    ripple.addEventListener(
      'animationend',
      () => {
        ripple.remove();
      },
      { once: true },
    );
  }

  function areSetNormalLevelsCompleted(levels = []) {
    if (!Array.isArray(levels) || levels.length === 0) {
      return true;
    }
    return levels
      .filter((level) => level && !isSecretLevelId(level.id) && isInteractiveLevel(level.id))
      .every((level) => {
        const state = levelState.get(level.id);
        return Boolean(state && state.completed);
      });
  }

  function isInfinityModeUnlocked() {
    if (developerModeActive) {
      return true;
    }
    if (gameStats.manualVictories > 0) {
      return true;
    }
    for (const state of levelState.values()) {
      if (state?.completed) {
        return true;
      }
    }
    return false;
  }

  function updateLevelSetLocks() {
    if (!levelSetEntries.length) {
      return;
    }

    levelSetEntries.forEach((entry, index) => {
      if (!entry || !entry.element || !entry.trigger) {
        return;
      }

      const previous = levelSetEntries[index - 1];
      const unlocked = index === 0 || areSetNormalLevelsCompleted(previous?.levels);

      if (!unlocked && entry.element.classList.contains('expanded')) {
        collapseLevelSet(entry.element);
      }

      entry.element.hidden = false;
      entry.element.setAttribute('aria-hidden', 'false');
      entry.element.classList.toggle('locked', !unlocked);

      entry.trigger.disabled = !unlocked;
      entry.trigger.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if (unlocked) {
        entry.trigger.removeAttribute('tabindex');
        entry.trigger.setAttribute('aria-label', `${entry.name} level set`);
        entry.trigger.title = `${entry.name} level set`;
      } else {
        entry.trigger.setAttribute('tabindex', '-1');
        entry.trigger.setAttribute('aria-label', 'Locked level set');
        entry.trigger.title = 'Locked level set';
      }

      if (entry.titleEl) {
        entry.titleEl.textContent = unlocked ? entry.name : 'LOCKED';
      }

      if (entry.countEl) {
        if (unlocked) {
          const countLabel = entry.levels.length === 1 ? 'level' : 'levels';
          entry.countEl.textContent = `${entry.levels.length} ${countLabel}`;
        } else {
          entry.countEl.textContent = 'LOCKED';
        }
      }
    });
  }

  function buildLevelCards() {
    if (!levelGrid) return;
    expandedLevelSet = null;
    levelGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const groups = new Map();

    levelSetEntries.length = 0;

    levelBlueprints.forEach((level) => {
      if (level.developerOnly && !developerModeActive) {
        return;
      }
      const groupKey = level.set || level.id.split(' - ')[0] || 'Levels';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(level);
    });

    let groupIndex = 0;
    groups.forEach((levels, setName) => {
      if (!levels.length) {
        return;
      }
      const setElement = document.createElement('div');
      setElement.className = 'level-set';
      setElement.dataset.set = setName;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'level-set-trigger';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-disabled', 'false');

      const glyph = document.createElement('span');
      glyph.className = 'level-set-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = '∷';

      const title = document.createElement('span');
      title.className = 'level-set-title';
      title.textContent = setName;

      const count = document.createElement('span');
      count.className = 'level-set-count';
      const countLabel = levels.length === 1 ? 'level' : 'levels';
      count.textContent = `${levels.length} ${countLabel}`;

      trigger.append(glyph, title, count);

      const slug = setName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim() || `set-${groupIndex + 1}`;
      const containerId = `level-set-${slug}-${groupIndex}`;

      const levelsContainer = document.createElement('div');
      levelsContainer.className = 'level-set-levels';
      levelsContainer.id = containerId;
      levelsContainer.setAttribute('role', 'group');
      levelsContainer.setAttribute('aria-hidden', 'true');

      trigger.setAttribute('aria-controls', containerId);
      trigger.addEventListener('click', () => {
        if (setElement.classList.contains('locked') || setElement.hidden) {
          return;
        }
        if (setElement.classList.contains('expanded')) {
          collapseLevelSet(setElement);
        } else {
          expandLevelSet(setElement);
        }
        if (audioManager) {
          audioManager.playSfx('menuSelect');
        }
      });

      levels.forEach((level, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'level-node';
        card.dataset.level = level.id;
        card.setAttribute('aria-pressed', 'false');
        card.setAttribute(
          'aria-label',
          `${level.id}: ${level.title}. Path ${level.path}. Focus ${level.focus}.`,
        );
        card.tabIndex = -1;
        card.style.setProperty('--level-delay', `${index * 40}ms`);
        const pathLabel = typeof level.path === 'string' ? level.path : '—';
        const focusLabel = typeof level.focus === 'string' ? level.focus : '—';
        card.innerHTML = `
          <span class="level-node-core">
            <span class="level-status-pill">New</span>
            <span class="level-id">${level.id}</span>
            <span class="level-node-title">${level.title}</span>
          </span>
          <span class="level-best-wave" aria-hidden="true" hidden>Wave —</span>
          <span class="screen-reader-only level-path">Path ${pathLabel}</span>
          <span class="screen-reader-only level-focus">Focus ${focusLabel}</span>
          <span class="screen-reader-only level-mode">—</span>
          <span class="screen-reader-only level-duration">—</span>
          <span class="screen-reader-only level-rewards">—</span>
          <span class="screen-reader-only level-last-result">No attempts recorded.</span>
          <span class="screen-reader-only level-best-wave-sr">Infinity wave record locked.</span>
        `;
        card.dataset.ariaLabelBase = `${level.id}: ${level.title}. Path ${pathLabel}. Focus ${focusLabel}.`;
        card.addEventListener('click', () => {
          handleLevelSelection(level);
        });
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleLevelSelection(level);
          }
        });
        levelsContainer.append(card);
      });

      levelSetEntries.push({
        name: setName,
        element: setElement,
        trigger,
        titleEl: title,
        countEl: count,
        levels: levels.slice(),
      });

      setElement.append(trigger, levelsContainer);
      fragment.append(setElement);
      groupIndex += 1;
    });

    levelGrid.append(fragment);
    updateLevelSetLocks();
  }

  function handleLevelSelection(level) {
    const state = levelState.get(level.id) || { entered: false, running: false };
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.focus === 'function') {
      lastLevelTrigger = activeElement;
    } else {
      lastLevelTrigger = null;
    }

    if (!isLevelUnlocked(level.id)) {
      const requirementId = getPreviousInteractiveLevelId(level.id);
      const requirement = requirementId ? levelLookup.get(requirementId) : null;
      const requirementLabel = requirement
        ? `${requirement.id} · ${requirement.title}`
        : 'the preceding defense';
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock ${level.id}.`;
      }
      if (audioManager) {
        audioManager.playSfx('error');
      }
      lastLevelTrigger = null;
      return;
    }

    const otherActiveId = activeLevelId && activeLevelId !== level.id ? activeLevelId : null;
    const otherActiveState = otherActiveId ? levelState.get(otherActiveId) : null;
    const requiresExitConfirm = Boolean(
      otherActiveId && (otherActiveState?.running || otherActiveState?.entered),
    );

    if (!state.entered || requiresExitConfirm) {
      pendingLevel = level;
      showLevelOverlay(level, { requireExitConfirm: requiresExitConfirm, exitLevelId: otherActiveId });
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  const PRESET_PREVIEW_PATHS = {
    lemniscate: [
      { x: 0.14, y: 0.52 },
      { x: 0.28, y: 0.28 },
      { x: 0.46, y: 0.2 },
      { x: 0.62, y: 0.3 },
      { x: 0.78, y: 0.5 },
      { x: 0.62, y: 0.7 },
      { x: 0.46, y: 0.8 },
      { x: 0.28, y: 0.72 },
      { x: 0.14, y: 0.48 },
    ],
    spiral: [
      { x: 0.12, y: 0.82 },
      { x: 0.28, y: 0.66 },
      { x: 0.46, y: 0.74 },
      { x: 0.66, y: 0.58 },
      { x: 0.54, y: 0.42 },
      { x: 0.6, y: 0.3 },
      { x: 0.76, y: 0.36 },
      { x: 0.88, y: 0.18 },
    ],
    cascade: [
      { x: 0.12, y: 0.8 },
      { x: 0.24, y: 0.68 },
      { x: 0.32, y: 0.5 },
      { x: 0.44, y: 0.6 },
      { x: 0.56, y: 0.44 },
      { x: 0.68, y: 0.54 },
      { x: 0.8, y: 0.36 },
      { x: 0.9, y: 0.22 },
    ],
    fork: [
      { x: 0.12, y: 0.82 },
      { x: 0.32, y: 0.58 },
      { x: 0.44, y: 0.38 },
      { x: 0.56, y: 0.52 },
      { x: 0.68, y: 0.32 },
      { x: 0.78, y: 0.46 },
      { x: 0.9, y: 0.26 },
    ],
    river: [
      { x: 0.08, y: 0.88 },
      { x: 0.22, y: 0.74 },
      { x: 0.38, y: 0.78 },
      { x: 0.54, y: 0.62 },
      { x: 0.68, y: 0.66 },
      { x: 0.82, y: 0.48 },
      { x: 0.92, y: 0.32 },
      { x: 0.96, y: 0.16 },
    ],
    petals: [
      { x: 0.14, y: 0.82 },
      { x: 0.32, y: 0.68 },
      { x: 0.42, y: 0.5 },
      { x: 0.36, y: 0.34 },
      { x: 0.5, y: 0.24 },
      { x: 0.64, y: 0.34 },
      { x: 0.6, y: 0.54 },
      { x: 0.74, y: 0.7 },
      { x: 0.88, y: 0.56 },
      { x: 0.92, y: 0.36 },
    ],
    lattice: [
      { x: 0.08, y: 0.84 },
      { x: 0.2, y: 0.66 },
      { x: 0.34, y: 0.7 },
      { x: 0.48, y: 0.5 },
      { x: 0.6, y: 0.58 },
      { x: 0.74, y: 0.38 },
      { x: 0.84, y: 0.46 },
      { x: 0.94, y: 0.22 },
    ],
    bridge: [
      { x: 0.08, y: 0.78 },
      { x: 0.26, y: 0.62 },
      { x: 0.4, y: 0.46 },
      { x: 0.54, y: 0.38 },
      { x: 0.7, y: 0.48 },
      { x: 0.82, y: 0.32 },
      { x: 0.94, y: 0.18 },
    ],
  };

  function clampNormalizedCoordinate(value) {
    if (!Number.isFinite(value)) {
      return 0.5;
    }
    return Math.min(0.98, Math.max(0.02, value));
  }

  function buildSeededPreviewPath(seedValue) {
    const seedString = String(seedValue || 'preview');
    let hash = 0;
    for (let index = 0; index < seedString.length; index += 1) {
      hash = (hash * 33 + seedString.charCodeAt(index)) >>> 0;
    }
    let state = hash || 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
    const points = [];
    const segments = 8;
    let x = 0.08 + random() * 0.1;
    let y = 0.2 + random() * 0.6;
    for (let step = 0; step < segments; step += 1) {
      points.push({ x: clampNormalizedCoordinate(x), y: clampNormalizedCoordinate(y) });
      x += 0.1 + random() * 0.12;
      y += (random() - 0.5) * 0.24;
      x = Math.min(0.92, Math.max(0.08, x));
      y = Math.min(0.88, Math.max(0.12, y));
    }
    return points;
  }

  function createProceduralPreviewPath(level) {
    if (!level) {
      return null;
    }
    const descriptor = `${level.path || ''} ${level.focus || ''}`.toLowerCase();
    const matches = [];
    const addMatch = (key) => {
      if (key && PRESET_PREVIEW_PATHS[key] && !matches.includes(key)) {
        matches.push(key);
      }
    };
    if (descriptor.includes('lemniscate') || descriptor.includes('∞') || descriptor.includes('loop')) {
      addMatch('lemniscate');
    }
    if (
      descriptor.includes('spiral') ||
      descriptor.includes('helix') ||
      descriptor.includes('fibonacci') ||
      descriptor.includes('logarithmic')
    ) {
      addMatch('spiral');
    }
    if (descriptor.includes('cascade') || descriptor.includes('step') || descriptor.includes('integral')) {
      addMatch('cascade');
    }
    if (descriptor.includes('fork') || descriptor.includes('dual') || descriptor.includes('twin')) {
      addMatch('fork');
    }
    if (descriptor.includes('river') || descriptor.includes('flow') || descriptor.includes('cardioid')) {
      addMatch('river');
    }
    if (descriptor.includes('petal') || descriptor.includes('modular') || descriptor.includes('bloom')) {
      addMatch('petals');
    }
    if (descriptor.includes('portal') || descriptor.includes('teleport') || descriptor.includes('hidden')) {
      addMatch('lattice');
    }
    if (descriptor.includes('bridge') || descriptor.includes('arch')) {
      addMatch('bridge');
    }
    if (matches.length) {
      const preset = PRESET_PREVIEW_PATHS[matches[0]];
      if (preset) {
        return preset.map((point) => ({ x: point.x, y: point.y }));
      }
    }
    return buildSeededPreviewPath(level.id);
  }

  function getPreviewPointsForLevel(level) {
    if (!level) {
      return null;
    }
    const config = levelConfigs.get(level.id);
    if (config && Array.isArray(config.path) && config.path.length >= 2) {
      return config.path.map((point) => ({ x: point.x, y: point.y }));
    }
    return createProceduralPreviewPath(level);
  }

  function clearOverlayPreview() {
    if (!overlayPreview) {
      return;
    }

    hideLevelEditorPanel();
    overlayPreviewLevel = null;

    if (previewPlayfield) {
      previewPlayfield.leaveLevel();
      previewPlayfield = null;
    }

    overlayPreview.innerHTML = '';
    overlayPreviewCanvas = null;
    overlayPreview.setAttribute('aria-hidden', 'true');
    overlayPreview.hidden = true;
    overlayPreview.classList.remove('overlay-preview--active');
  }

  function setLevelEditorStatus(message, options = {}) {
    if (!levelEditorElements.status) {
      return;
    }

    if (levelEditorState.statusTimeout) {
      clearTimeout(levelEditorState.statusTimeout);
      levelEditorState.statusTimeout = null;
    }

    if (!message) {
      levelEditorElements.status.textContent = '';
      levelEditorElements.status.hidden = true;
      delete levelEditorElements.status.dataset.tone;
      return;
    }

    const tone = options.tone || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 2400;
    levelEditorElements.status.dataset.tone = tone;
    levelEditorElements.status.textContent = message;
    levelEditorElements.status.hidden = false;

    if (duration > 0 && typeof window !== 'undefined') {
      levelEditorState.statusTimeout = window.setTimeout(() => {
        levelEditorState.statusTimeout = null;
        if (levelEditorElements.status) {
          levelEditorElements.status.hidden = true;
        }
      }, duration);
    }
  }

  function endLevelEditorDrag() {
    if (overlayPreviewCanvas && levelEditorState.pointerId !== null) {
      try {
        overlayPreviewCanvas.releasePointerCapture(levelEditorState.pointerId);
      } catch (error) {
        // ignore pointer capture release errors
      }
    }
    levelEditorState.pointerId = null;
    levelEditorState.draggingIndex = -1;
    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
    }
  }

  function detachLevelEditorCanvasListeners() {
    if (!levelEditorState.canvasListenersAttached || !overlayPreviewCanvas) {
      levelEditorState.canvasListenersAttached = false;
      return;
    }

    overlayPreviewCanvas.removeEventListener('pointerdown', handleLevelEditorPointerDown);
    overlayPreviewCanvas.removeEventListener('pointermove', handleLevelEditorPointerMove);
    overlayPreviewCanvas.removeEventListener('pointerup', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('pointercancel', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('lostpointercapture', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('click', handleLevelEditorCanvasClick);
    levelEditorState.canvasListenersAttached = false;
  }

  function hideLevelEditorPanel() {
    endLevelEditorDrag();
    detachLevelEditorCanvasListeners();
    levelEditorState.levelId = null;
    levelEditorState.points = [];
    levelEditorState.originalPoints = [];
    levelEditorState.editing = false;

    if (previewPlayfield) {
      previewPlayfield.setDeveloperPathMarkers([]);
      previewPlayfield.draw();
    }

    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--editing');
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
    }

    if (levelEditorElements.container) {
      levelEditorElements.container.hidden = true;
      levelEditorElements.container.setAttribute('aria-hidden', 'true');
    }

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = true;
      levelEditorElements.toggle.setAttribute('aria-pressed', 'false');
      levelEditorElements.toggle.textContent = 'Enable Editing';
    }

    updateLevelEditorOutput();
    updateLevelEditorUI();
    setLevelEditorStatus('');
  }

  function attachLevelEditorCanvasListeners() {
    if (!overlayPreviewCanvas || levelEditorState.canvasListenersAttached) {
      return;
    }

    overlayPreviewCanvas.addEventListener('pointerdown', handleLevelEditorPointerDown);
    overlayPreviewCanvas.addEventListener('pointermove', handleLevelEditorPointerMove);
    overlayPreviewCanvas.addEventListener('pointerup', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('pointercancel', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('lostpointercapture', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('click', handleLevelEditorCanvasClick);
    levelEditorState.canvasListenersAttached = true;
  }

  function handleLevelEditorCanvasClick(event) {
    if (!levelEditorState.editing) {
      return;
    }
    event.stopPropagation();
  }

  function updateLevelEditorOutput() {
    if (!levelEditorElements.output) {
      return;
    }

    if (!levelEditorState.points.length) {
      levelEditorElements.output.value = '';
      return;
    }

    const formattedPoints = levelEditorState.points.map((point) => ({
      x: Number(clampNormalizedCoordinate(point.x).toFixed(4)),
      y: Number(clampNormalizedCoordinate(point.y).toFixed(4)),
    }));
    levelEditorElements.output.value = JSON.stringify(formattedPoints, null, 2);
  }

  function updateLevelEditorUI() {
    const points = levelEditorState.points;
    if (levelEditorElements.count) {
      const label = points.length === 1 ? 'point' : 'points';
      levelEditorElements.count.textContent = `${points.length} ${label}`;
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.disabled = points.length === 0;
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.disabled = levelEditorState.originalPoints.length === 0;
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.disabled = points.length < 2;
    }
    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = !developerModeActive || !overlayPreviewCanvas;
      levelEditorElements.toggle.textContent = levelEditorState.editing ? 'Disable Editing' : 'Enable Editing';
      levelEditorElements.toggle.setAttribute('aria-pressed', levelEditorState.editing ? 'true' : 'false');
    }
  }

  function refreshLevelEditorMarkers(options = {}) {
    if (!previewPlayfield) {
      return;
    }

    const { redraw = true } = options;

    if (!overlayPreviewCanvas || !levelEditorState.points.length) {
      previewPlayfield.setDeveloperPathMarkers([]);
      if (redraw) {
        previewPlayfield.draw();
      }
      return;
    }

    let width = previewPlayfield.renderWidth || 0;
    let height = previewPlayfield.renderHeight || 0;
    if ((!width || !height) && overlayPreviewCanvas) {
      const rect = overlayPreviewCanvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    if (!width || !height) {
      previewPlayfield.setDeveloperPathMarkers([]);
      if (redraw) {
        previewPlayfield.draw();
      }
      return;
    }

    const markers = levelEditorState.points.map((point, index) => ({
      x: clampNormalizedCoordinate(point.x) * width,
      y: clampNormalizedCoordinate(point.y) * height,
      label: index + 1,
      active: levelEditorState.draggingIndex === index,
    }));
    previewPlayfield.setDeveloperPathMarkers(markers);
    if (redraw) {
      previewPlayfield.draw();
    }
  }

  function applyLevelEditorPoints() {
    if (!previewPlayfield || !previewPlayfield.levelConfig) {
      updateLevelEditorOutput();
      updateLevelEditorUI();
      return;
    }

    const sanitized = levelEditorState.points.map((point) => ({
      x: clampNormalizedCoordinate(point.x),
      y: clampNormalizedCoordinate(point.y),
    }));
    levelEditorState.points = sanitized;
    previewPlayfield.levelConfig.path = sanitized.map((point) => ({ ...point }));
    previewPlayfield.buildPathGeometry();
    refreshLevelEditorMarkers({ redraw: false });
    previewPlayfield.draw();
    updateLevelEditorOutput();
    updateLevelEditorUI();
  }

  function setLevelEditorEditing(active) {
    const enable = Boolean(active && developerModeActive && overlayPreviewCanvas);
    if (!enable) {
      endLevelEditorDrag();
    }
    levelEditorState.editing = enable;
    if (levelEditorElements.container) {
      levelEditorElements.container.classList.toggle('overlay-editor--active', enable);
    }
    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.toggle('overlay-preview__canvas--editing', enable);
      if (!enable) {
        overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
      }
    }
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
  }

  function clearLevelEditorPoints() {
    levelEditorState.points = [];
    levelEditorState.draggingIndex = -1;
    applyLevelEditorPoints();
    setLevelEditorStatus('Cleared all anchors. Click to plot a new path.', { tone: 'warning' });
  }

  function resetLevelEditorPoints() {
    if (!levelEditorState.originalPoints.length) {
      return;
    }
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.draggingIndex = -1;
    applyLevelEditorPoints();
    setLevelEditorStatus('Restored path from level configuration.');
  }

  function configureLevelEditorForLevel(level, config) {
    if (!levelEditorElements.container) {
      return;
    }

    if (!developerModeActive || !level || !config || !Array.isArray(config.path) || config.path.length < 2) {
      hideLevelEditorPanel();
      return;
    }

    levelEditorState.levelId = level.id || null;
    levelEditorState.originalPoints = cloneVectorArray(config.path).map((point) => ({
      x: clampNormalizedCoordinate(point.x),
      y: clampNormalizedCoordinate(point.y),
    }));
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.editing = false;
    levelEditorState.draggingIndex = -1;
    levelEditorState.pointerId = null;

    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--editing');
    }

    attachLevelEditorCanvasListeners();
    applyLevelEditorPoints();

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    setLevelEditorStatus('Developer editor ready—toggle editing to adjust anchors.', { duration: 2000 });
  }

  function syncLevelEditorVisibility() {
    if (!developerModeActive) {
      hideLevelEditorPanel();
      return;
    }

    if (!levelEditorElements.container) {
      return;
    }

    if (!overlayPreviewLevel || !previewPlayfield) {
      return;
    }

    const config = levelConfigs.get(overlayPreviewLevel.id);
    if (!config || !Array.isArray(config.path) || config.path.length < 2) {
      hideLevelEditorPanel();
      return;
    }

    if (levelEditorState.levelId !== overlayPreviewLevel.id) {
      configureLevelEditorForLevel(overlayPreviewLevel, config);
      return;
    }

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
  }

  function handleLevelEditorToggle() {
    if (!developerModeActive) {
      setLevelEditorStatus('Enable developer mode to use the level editor.', { tone: 'warning' });
      return;
    }
    const nextState = !levelEditorState.editing;
    setLevelEditorEditing(nextState);
    if (nextState && !levelEditorState.points.length) {
      setLevelEditorStatus('Click the preview to place your first anchor.');
    } else if (!nextState) {
      setLevelEditorStatus('Editing disabled. Copy the JSON below when ready.');
    }
  }

  function handleLevelEditorClear() {
    clearLevelEditorPoints();
  }

  function handleLevelEditorReset() {
    resetLevelEditorPoints();
  }

  async function handleLevelEditorExport() {
    if (!levelEditorElements.output) {
      return;
    }
    const text = levelEditorElements.output.value.trim();
    if (!text) {
      setLevelEditorStatus('Add at least two anchors before exporting.', { tone: 'warning' });
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setLevelEditorStatus('Copied path JSON to clipboard.');
      } else {
        levelEditorElements.output.focus();
        levelEditorElements.output.select();
        setLevelEditorStatus('Clipboard unavailable—select and copy manually.', { tone: 'warning' });
      }
    } catch (error) {
      console.warn('Level editor failed to copy path', error);
      levelEditorElements.output.focus();
      levelEditorElements.output.select();
      setLevelEditorStatus('Copy failed—select the JSON manually.', { tone: 'error' });
    }
  }

  function getNormalizedPointerPosition(event) {
    if (!overlayPreviewCanvas) {
      return null;
    }
    const rect = overlayPreviewCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const x = clampNormalizedCoordinate((event.clientX - rect.left) / rect.width);
    const y = clampNormalizedCoordinate((event.clientY - rect.top) / rect.height);
    return { x, y };
  }

  function findNearestEditorPoint(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return { index: -1, distance: Infinity };
    }
    let bestIndex = -1;
    let bestDistance = Infinity;
    points.forEach((candidate, index) => {
      const dx = candidate.x - point.x;
      const dy = candidate.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return { index: bestIndex, distance: bestDistance };
  }

  function distanceSquaredToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      const diffX = point.x - start.x;
      const diffY = point.y - start.y;
      return diffX * diffX + diffY * diffY;
    }
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const diffX = point.x - projX;
    const diffY = point.y - projY;
    return diffX * diffX + diffY * diffY;
  }

  function findInsertionIndex(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return 0;
    }
    if (points.length === 1) {
      return 1;
    }
    let bestIndex = points.length;
    let bestDistance = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const distance = distanceSquaredToSegment(point, start, end);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index + 1;
      }
    }
    return bestIndex;
  }

  function handleLevelEditorPointerDown(event) {
    if (!levelEditorState.editing || !overlayPreviewCanvas || event.button !== 0) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }

    const nearest = findNearestEditorPoint(point);
    const removalThreshold = 0.045;
    if (event.shiftKey && nearest.index >= 0 && nearest.distance <= removalThreshold) {
      event.preventDefault();
      event.stopPropagation();
      levelEditorState.points.splice(nearest.index, 1);
      levelEditorState.draggingIndex = -1;
      applyLevelEditorPoints();
      setLevelEditorStatus(`Removed anchor ${nearest.index + 1}.`, { tone: 'warning' });
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectionThreshold = 0.04;
    if (nearest.index >= 0 && nearest.distance <= selectionThreshold) {
      levelEditorState.draggingIndex = nearest.index;
      levelEditorState.pointerId = event.pointerId;
      try {
        overlayPreviewCanvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore pointer capture errors
      }
      overlayPreviewCanvas.classList.add('overlay-preview__canvas--dragging');
      levelEditorState.points[nearest.index] = point;
      applyLevelEditorPoints();
      return;
    }

    const insertionIndex = findInsertionIndex(point);
    levelEditorState.points.splice(insertionIndex, 0, point);
    levelEditorState.draggingIndex = insertionIndex;
    levelEditorState.pointerId = event.pointerId;
    try {
      overlayPreviewCanvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore pointer capture errors
    }
    overlayPreviewCanvas.classList.add('overlay-preview__canvas--dragging');
    applyLevelEditorPoints();
    if (levelEditorState.points.length === 1) {
      setLevelEditorStatus('Anchor placed. Add another anchor to draw the path.');
    }
  }

  function handleLevelEditorPointerMove(event) {
    if (!levelEditorState.editing || levelEditorState.draggingIndex < 0) {
      return;
    }
    if (levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    levelEditorState.points[levelEditorState.draggingIndex] = point;
    applyLevelEditorPoints();
  }

  function handleLevelEditorPointerUp(event) {
    if (event && levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    endLevelEditorDrag();
    refreshLevelEditorMarkers();
    updateLevelEditorUI();
  }

  function initializeLevelEditorElements() {
    levelEditorElements.container = document.getElementById('overlay-level-editor');
    levelEditorElements.toggle = document.getElementById('level-editor-toggle');
    levelEditorElements.note = document.getElementById('level-editor-note');
    levelEditorElements.count = document.getElementById('level-editor-count');
    levelEditorElements.clear = document.getElementById('level-editor-clear');
    levelEditorElements.reset = document.getElementById('level-editor-reset');
    levelEditorElements.exportButton = document.getElementById('level-editor-export');
    levelEditorElements.output = document.getElementById('level-editor-output');
    levelEditorElements.status = document.getElementById('level-editor-status');

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorToggle();
      });
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorClear();
      });
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorReset();
      });
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorExport();
      });
    }

    hideLevelEditorPanel();
  }

  function renderLevelPreview(level) {
    if (!overlayPreview) {
      return;
    }
    clearOverlayPreview();

    overlayPreviewLevel = level || null;

    const config = level ? levelConfigs.get(level.id) : null;
    const hasInteractivePath = Boolean(
      config && Array.isArray(config.path) && config.path.length >= 2,
    );

    if (hasInteractivePath) {
      overlayPreviewCanvas = document.createElement('canvas');
      overlayPreviewCanvas.className = 'overlay-preview__canvas';
      overlayPreviewCanvas.setAttribute(
        'aria-label',
        `${level?.title || 'Defense'} path preview`,
      );
      overlayPreviewCanvas.setAttribute('role', 'img');
      overlayPreview.append(overlayPreviewCanvas);

      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');

      previewPlayfield = new SimplePlayfield({
        canvas: overlayPreviewCanvas,
        container: overlayPreview,
        previewOnly: true,
      });
      previewPlayfield.enterLevel(level, { endlessMode: false });
      previewPlayfield.draw();
      configureLevelEditorForLevel(level, config);
      return;
    }

    const points = getPreviewPointsForLevel(level);
    if (!Array.isArray(points) || points.length < 2) {
      const placeholder = document.createElement('p');
      placeholder.className = 'overlay-preview__empty';
      placeholder.textContent = 'Map preview will unlock once the defense is charted.';
      overlayPreview.append(placeholder);
      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');
      return;
    }

    const viewBoxWidth = 1200;
    const viewBoxHeight = 720;
    const margin = 90;
    const scalePoint = (point) => ({
      x: margin + clampNormalizedCoordinate(point.x) * (viewBoxWidth - margin * 2),
      y: margin + clampNormalizedCoordinate(point.y) * (viewBoxHeight - margin * 2),
    });

    const scaledPoints = points.map((point) =>
      scalePoint({ x: point?.x ?? 0.5, y: point?.y ?? 0.5 }),
    );
    const pathData = scaledPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const gradientId = createPreviewId('preview-gradient', level?.id || 'level');
    const haloId = createPreviewId('preview-halo', level?.id || 'level');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svg.setAttribute('class', 'overlay-preview__svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${level?.title || 'Defense'} path preview`);

    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');
    const stopStart = document.createElementNS(SVG_NS, 'stop');
    stopStart.setAttribute('offset', '0%');
    stopStart.setAttribute('stop-color', '#76bfff');
    stopStart.setAttribute('stop-opacity', '0.85');
    const stopMid = document.createElementNS(SVG_NS, 'stop');
    stopMid.setAttribute('offset', '52%');
    stopMid.setAttribute('stop-color', '#ffe4a0');
    stopMid.setAttribute('stop-opacity', '0.92');
    const stopEnd = document.createElementNS(SVG_NS, 'stop');
    stopEnd.setAttribute('offset', '100%');
    stopEnd.setAttribute('stop-color', '#ffb088');
    stopEnd.setAttribute('stop-opacity', '0.88');
    gradient.append(stopStart, stopMid, stopEnd);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', haloId);
    filter.setAttribute('x', '-25%');
    filter.setAttribute('y', '-25%');
    filter.setAttribute('width', '150%');
    filter.setAttribute('height', '150%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '24');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('result', 'blurred');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mergeBlur = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeBlur.setAttribute('in', 'blurred');
    const mergeSource = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeSource.setAttribute('in', 'SourceGraphic');
    merge.append(mergeBlur, mergeSource);
    filter.append(blur, merge);

    defs.append(gradient, filter);
    svg.append(defs);

    const backdrop = document.createElementNS(SVG_NS, 'rect');
    backdrop.setAttribute('x', '0');
    backdrop.setAttribute('y', '0');
    backdrop.setAttribute('width', viewBoxWidth);
    backdrop.setAttribute('height', viewBoxHeight);
    backdrop.setAttribute('fill', 'rgba(6, 10, 18, 0.96)');
    svg.append(backdrop);

    const frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('x', (margin * 2) / 5);
    frame.setAttribute('y', (margin * 2) / 5);
    frame.setAttribute('width', viewBoxWidth - (margin * 4) / 5);
    frame.setAttribute('height', viewBoxHeight - (margin * 4) / 5);
    frame.setAttribute('rx', '60');
    frame.setAttribute('fill', 'rgba(12, 16, 30, 0.92)');
    frame.setAttribute('stroke', 'rgba(255, 255, 255, 0.06)');
    frame.setAttribute('stroke-width', '8');
    svg.append(frame);

    const field = document.createElementNS(SVG_NS, 'rect');
    field.setAttribute('x', margin);
    field.setAttribute('y', margin);
    field.setAttribute('width', viewBoxWidth - margin * 2);
    field.setAttribute('height', viewBoxHeight - margin * 2);
    field.setAttribute('rx', '48');
    field.setAttribute('fill', 'rgba(18, 24, 42, 0.92)');
    field.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
    field.setAttribute('stroke-width', '6');
    svg.append(field);

    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    gridGroup.setAttribute('stroke-width', '2');
    const gridSpacing = 140;
    for (let x = Math.round(margin); x <= viewBoxWidth - margin; x += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', margin);
      line.setAttribute('x2', x);
      line.setAttribute('y2', viewBoxHeight - margin);
      gridGroup.append(line);
    }
    for (let y = Math.round(margin); y <= viewBoxHeight - margin; y += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', margin);
      line.setAttribute('y1', y);
      line.setAttribute('x2', viewBoxWidth - margin);
      line.setAttribute('y2', y);
      gridGroup.append(line);
    }
    svg.append(gridGroup);

    const basePath = document.createElementNS(SVG_NS, 'path');
    basePath.setAttribute('d', pathData);
    basePath.setAttribute('fill', 'none');
    basePath.setAttribute('stroke', 'rgba(94, 134, 220, 0.28)');
    basePath.setAttribute('stroke-width', '70');
    basePath.setAttribute('stroke-linecap', 'round');
    basePath.setAttribute('stroke-linejoin', 'round');
    svg.append(basePath);

    const lanePath = document.createElementNS(SVG_NS, 'path');
    lanePath.setAttribute('d', pathData);
    lanePath.setAttribute('fill', 'none');
    lanePath.setAttribute('stroke', `url(#${gradientId})`);
    lanePath.setAttribute('stroke-width', '44');
    lanePath.setAttribute('stroke-linecap', 'round');
    lanePath.setAttribute('stroke-linejoin', 'round');
    lanePath.setAttribute('filter', `url(#${haloId})`);
    svg.append(lanePath);

    const anchorsList = Array.isArray(config?.autoAnchors) ? config.autoAnchors : [];
    if (anchorsList.length) {
      const anchorGroup = document.createElementNS(SVG_NS, 'g');
      anchorsList.forEach((anchor) => {
        const scaled = scalePoint({ x: anchor?.x ?? 0.5, y: anchor?.y ?? 0.5 });
        const outer = document.createElementNS(SVG_NS, 'circle');
        outer.setAttribute('cx', scaled.x);
        outer.setAttribute('cy', scaled.y);
        outer.setAttribute('r', '28');
        outer.setAttribute('fill', 'rgba(255, 204, 150, 0.92)');
        outer.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
        outer.setAttribute('stroke-width', '6');
        anchorGroup.append(outer);
        const inner = document.createElementNS(SVG_NS, 'circle');
        inner.setAttribute('cx', scaled.x);
        inner.setAttribute('cy', scaled.y);
        inner.setAttribute('r', '12');
        inner.setAttribute('fill', 'rgba(255, 255, 255, 0.92)');
        anchorGroup.append(inner);
      });
      svg.append(anchorGroup);
    }

    const startPoint = scaledPoints[0];
    const endPoint = scaledPoints[scaledPoints.length - 1];
    const startMarker = document.createElementNS(SVG_NS, 'circle');
    startMarker.setAttribute('cx', startPoint.x);
    startMarker.setAttribute('cy', startPoint.y);
    startMarker.setAttribute('r', '20');
    startMarker.setAttribute('fill', 'rgba(120, 210, 255, 0.95)');
    startMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    startMarker.setAttribute('stroke-width', '5');
    svg.append(startMarker);

    const endMarker = document.createElementNS(SVG_NS, 'circle');
    endMarker.setAttribute('cx', endPoint.x);
    endMarker.setAttribute('cy', endPoint.y);
    endMarker.setAttribute('r', '24');
    endMarker.setAttribute('fill', 'rgba(255, 170, 130, 0.95)');
    endMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    endMarker.setAttribute('stroke-width', '6');
    svg.append(endMarker);

    overlayPreview.append(svg);
    overlayPreview.hidden = false;
    overlayPreview.setAttribute('aria-hidden', 'false');
    overlayPreview.classList.add('overlay-preview--active');
  }

  function showLevelOverlay(level, options = {}) {
    if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
    const { requireExitConfirm = false, exitLevelId = null } = options;
    overlayRequiresLevelExit = Boolean(requireExitConfirm);
    overlayLabel.textContent = level.id;
    overlayTitle.textContent = level.title;
    overlayExample.textContent = level.example;
    renderLevelPreview(level);
    const summary = getLevelSummary(level);
    if (overlayMode) {
      overlayMode.textContent = summary.mode;
    }
    if (overlayDuration) {
      overlayDuration.textContent = summary.duration;
    }
    if (overlayRewards) {
      overlayRewards.textContent = summary.rewards;
    }
    if (overlayLast) {
      const state = levelState.get(level.id) || null;
      const runner = idleLevelRuns.get(level.id) || null;
      overlayLast.textContent = describeLevelLastResult(level, state, runner);
    }
    if (overlayInstruction) {
      if (overlayRequiresLevelExit) {
        const exitLevel = exitLevelId ? levelLookup.get(exitLevelId) : levelLookup.get(activeLevelId);
        const exitLabel = exitLevel ? `${exitLevel.id} · ${exitLevel.title}` : 'the active level';
        overlayInstruction.textContent = `Entering will abandon ${exitLabel}. Tap to confirm.`;
      } else {
        overlayInstruction.textContent = overlayInstructionDefault;
      }
    }
    if (overlay) {
      if (overlayRequiresLevelExit) {
        overlay.setAttribute('data-overlay-mode', 'warning');
      } else {
        overlay.removeAttribute('data-overlay-mode');
      }
    }
    revealOverlay(overlay);
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus();
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  }

  function hideLevelOverlay() {
    if (!overlay) return;
    clearOverlayPreview();
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(overlay);
    overlayRequiresLevelExit = false;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }
    if (overlay) {
      overlay.removeAttribute('data-overlay-mode');
    }
  }

  function cancelPendingLevel() {
    pendingLevel = null;
    hideLevelOverlay();
    if (lastLevelTrigger && typeof lastLevelTrigger.focus === 'function') {
      lastLevelTrigger.focus();
    }
    lastLevelTrigger = null;
  }

  function confirmPendingLevel() {
    if (!pendingLevel) {
      hideLevelOverlay();
      return;
    }

    const levelToStart = pendingLevel;
    pendingLevel = null;
    hideLevelOverlay();
    startLevel(levelToStart);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function startLevel(level) {
    const currentState = levelState.get(level.id) || {
      entered: false,
      running: false,
      completed: false,
    };
    const isInteractive = isInteractiveLevel(level.id);
    const levelConfig = levelConfigs.get(level.id);
    const forceEndlessMode = Boolean(level?.forceEndlessMode || levelConfig?.forceEndlessMode);
    if (isInteractive && !isLevelUnlocked(level.id)) {
      if (playfield?.messageEl) {
        const requiredId = getPreviousInteractiveLevelId(level.id);
        const requiredLevel = requiredId ? levelLookup.get(requiredId) : null;
        const requirementLabel = requiredLevel
          ? `${requiredLevel.id} · ${requiredLevel.title}`
          : 'the previous defense';
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock this path.`;
      }
      return;
    }
    const updatedState = {
      ...currentState,
      entered: true,
      running: !isInteractive,
    };
    levelState.set(level.id, updatedState);

    stopAllIdleRuns(level.id);

    levelState.forEach((state, id) => {
      if (id !== level.id) {
        levelState.set(id, { ...state, running: false });
      }
    });

    activeLevelId = level.id;
    resourceState.running = !isInteractive;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();

    if (playfield) {
      playfield.enterLevel(level, {
        endlessMode: forceEndlessMode || Boolean(updatedState.completed),
      });
    }

    if (isInteractive) {
      if (audioManager) {
        audioManager.playSfx('enterLevel');
      }
      refreshTabMusic({ restart: true });
    } else {
      refreshTabMusic();
    }

    if (!isInteractive) {
      beginIdleLevelRun(level);
    } else {
      updateIdleLevelDisplay();
    }

    updateTowerSelectionButtons();
  }

  function leaveActiveLevel() {
    if (!activeLevelId) return;
    const state = levelState.get(activeLevelId);
    if (state) {
      levelState.set(activeLevelId, { ...state, running: false });
    }
    stopIdleLevelRun(activeLevelId);
    if (playfield) {
      playfield.leaveLevel();
    }
    refreshTabMusic({ restart: true });
    activeLevelId = null;
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    updateTowerSelectionButtons();
  }

  function updateLevelCards() {
    if (!levelGrid) return;
    const infinityUnlockedOverall = isInfinityModeUnlocked();
    levelBlueprints.forEach((level) => {
      const card = levelGrid.querySelector(`[data-level="${level.id}"]`);
      if (!card) return;
      const pill = card.querySelector('.level-status-pill');
      const titleEl = card.querySelector('.level-node-title');
      const pathEl = card.querySelector('.level-path');
      const focusEl = card.querySelector('.level-focus');
      const waveEl = card.querySelector('.level-best-wave');
      const waveSrEl = card.querySelector('.level-best-wave-sr');
      const state = levelState.get(level.id);

      const entered = Boolean(state && state.entered);
      const running = Boolean(state && state.running);
      const completed = Boolean(state && state.completed);
      const unlocked = isLevelUnlocked(level.id);
      const infinityUnlocked = infinityUnlockedOverall;
      const pathLabel = typeof level.path === 'string' ? level.path : '—';
      const focusLabel = typeof level.focus === 'string' ? level.focus : '—';

      const summary = getLevelSummary(level);
      const modeEl = card.querySelector('.level-mode');
      const durationEl = card.querySelector('.level-duration');
      const rewardsEl = card.querySelector('.level-rewards');
      if (modeEl) {
        modeEl.textContent = unlocked ? summary.mode : 'Locked';
      }
      if (durationEl) {
        durationEl.textContent = unlocked ? summary.duration : '—';
      }
      if (rewardsEl) {
        rewardsEl.textContent = unlocked ? summary.rewards : '—';
      }

      const runner = idleLevelRuns.get(level.id) || null;
      const lastResultEl = card.querySelector('.level-last-result');
      if (lastResultEl) {
        if (unlocked) {
          lastResultEl.textContent = describeLevelLastResult(level, state || null, runner);
        } else {
          lastResultEl.textContent = 'Locked until preceding defenses are sealed.';
        }
      }

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.classList.toggle('locked', !unlocked);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');
      card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const parentSet = card.closest('.level-set');
      const setExpanded = Boolean(parentSet && parentSet.classList.contains('expanded'));
      card.tabIndex = unlocked && setExpanded ? 0 : -1;

      if (titleEl) {
        titleEl.textContent = unlocked ? level.title : 'LOCKED';
      }
      if (pathEl) {
        pathEl.textContent = unlocked ? `Path ${pathLabel}` : 'Path details locked.';
      }
      if (focusEl) {
        focusEl.textContent = unlocked ? `Focus ${focusLabel}` : 'Focus details locked.';
      }

      if (pill) {
        let pillVisible = false;
        let pillText = '';
        if (unlocked && !entered) {
          pillText = 'New';
          pillVisible = true;
        } else if (unlocked && running) {
          pillText = 'Running';
          pillVisible = true;
        }

        if (pillVisible) {
          pill.textContent = pillText;
          pill.removeAttribute('hidden');
          pill.setAttribute('aria-hidden', 'false');
        } else {
          pill.textContent = pillText;
          pill.setAttribute('aria-hidden', 'true');
          pill.setAttribute('hidden', '');
        }
      }

      const bestWave = Number.isFinite(state?.bestWave) ? state.bestWave : 0;
      if (waveEl) {
        if (infinityUnlocked) {
          const displayWave = bestWave > 0 ? formatWholeNumber(bestWave) : '—';
          waveEl.textContent = `Wave ${displayWave}`;
          waveEl.removeAttribute('hidden');
          card.classList.add('show-wave');
        } else {
          waveEl.setAttribute('hidden', '');
          card.classList.remove('show-wave');
        }
      }
      if (waveSrEl) {
        if (infinityUnlocked) {
          if (bestWave > 0) {
            waveSrEl.textContent = `Infinity mode best wave ${formatWholeNumber(bestWave)}.`;
          } else {
            waveSrEl.textContent = 'Infinity mode ready—no wave record yet.';
          }
        } else {
          waveSrEl.textContent = 'Infinity wave record locked.';
        }
      }

      const baseLabel = card.dataset.ariaLabelBase || '';
      if (unlocked) {
        const waveLabel = infinityUnlocked
          ? bestWave > 0
            ? ` Best wave reached: ${formatWholeNumber(bestWave)}.`
            : ' Infinity mode available—no wave record yet.'
          : '';
        card.setAttribute('aria-label', `${baseLabel}${waveLabel}`.trim());
      } else {
        card.setAttribute(
          'aria-label',
          `${level.id} locked. Seal the preceding defense to reveal details.`,
        );
      }
    });

    updateLevelSetLocks();
  }

  function updateActiveLevelBanner() {
    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = !activeLevelId;
    }
    if (!activeLevelEl) return;
    if (!activeLevelId) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId);
    if (!level || !state) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    let descriptor = 'Paused';
    if (state.running) {
      descriptor = 'Running';
    } else if (state.completed) {
      descriptor = 'Complete';
    }

    activeLevelEl.textContent = `${level.id} · ${level.title} (${descriptor})`;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (!tabs.length) return;
    if (overlay && overlay.classList.contains('active')) return;
    if (isFieldNotesOverlayVisible()) return;
    if (isTextInput(event.target)) return;

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    event.preventDefault();
    focusAndActivateTab(activeTabIndex + direction);
  });

  document.addEventListener('keydown', (event) => {
    if (!tabs.length) return;
    if (overlay && overlay.classList.contains('active')) return;
    if (isFieldNotesOverlayVisible()) return;
    if (isTextInput(event.target)) return;

    const targetTabId = tabHotkeys.get(event.key);
    if (!targetTabId) return;

    event.preventDefault();
    setActiveTab(targetTabId);
    if (audioManager) {
      audioManager.playSfx('menuSelect');
    }
    const tabToFocus = tabs.find((tab) => tab.dataset.tab === targetTabId);
    if (tabToFocus) {
      tabToFocus.focus();
    }
  });

  function initializeTabs() {
    tabs = Array.from(document.querySelectorAll('.tab-button'));
    panels = Array.from(document.querySelectorAll('.panel'));

    if (!tabs.length || !panels.length) {
      return;
    }

    const existingActiveIndex = tabs.findIndex((tab) => tab.classList.contains('active'));
    activeTabIndex = existingActiveIndex >= 0 ? existingActiveIndex : 0;

    tabs.forEach((tab, index) => {
      if (!tab.getAttribute('type')) {
        tab.setAttribute('type', 'button');
      }

      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        if (!target) {
          return;
        }
        setActiveTab(target);
        if (audioManager) {
          audioManager.playSfx('menuSelect');
        }
        tab.focus();
      });

      tab.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (audioManager) {
            audioManager.playSfx('menuSelect');
          }
          focusAndActivateTab(index);
        }
      });
    });

    panels.forEach((panel) => {
      const isActive = panel.classList.contains('active');
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      if (!isActive) {
        panel.setAttribute('hidden', '');
      }
    });

    const initialTab = tabs[activeTabIndex];
    if (initialTab) {
      setActiveTab(initialTab.dataset.tab);
    }
  }

  function bindOverlayEvents() {
    if (!overlay) return;
    overlay.addEventListener('click', () => {
      confirmPendingLevel();
    });
  }

  function renderUpgradeMatrix() {
    if (!upgradeOverlayGrid) {
      return;
    }

    upgradeOverlayGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    towerDefinitions.forEach((definition) => {
      if (!isTowerUnlocked(definition.id)) {
        return;
      }
      const row = document.createElement('div');
      row.className = 'upgrade-matrix-row';
      row.setAttribute('role', 'listitem');

      const tier = document.createElement('span');
      tier.className = 'upgrade-matrix-tier';
      tier.textContent = `Tier ${definition.tier}`;

      const name = document.createElement('span');
      name.className = 'upgrade-matrix-name';
      const symbol = document.createElement('span');
      symbol.className = 'upgrade-matrix-symbol';
      symbol.textContent = definition.symbol;
      const title = document.createElement('span');
      title.className = 'upgrade-matrix-title';
      const sanitizedName = typeof definition.name === 'string'
        ? definition.name.replace(/tower/gi, '').replace(/\s{2,}/g, ' ').trim()
        : '';
      title.textContent = sanitizedName || definition.name;
      name.append(symbol, document.createTextNode(' '), title);

      const cost = document.createElement('span');
      cost.className = 'upgrade-matrix-cost';
      cost.textContent = `${formatGameNumber(definition.baseCost)} ${THERO_SYMBOL}`;

      const nextTier = document.createElement('span');
      nextTier.className = 'upgrade-matrix-next';
      const nextDefinition = definition.nextTierId
        ? getTowerDefinition(definition.nextTierId)
        : null;
      const nextName = nextDefinition?.name
        ? nextDefinition.name.replace(/tower/gi, '').replace(/\s{2,}/g, ' ').trim()
        : '';
      nextTier.textContent = nextDefinition
        ? `→ ${nextDefinition.symbol} ${nextName || nextDefinition.name}`
        : '→ Final lattice awakened';

      row.append(tier, name, cost, nextTier);
      fragment.append(row);
    });

    upgradeOverlayGrid.append(fragment);
  }

  function showUpgradeMatrix() {
    if (!upgradeOverlay) {
      return;
    }

    revealOverlay(upgradeOverlay);
    renderUpgradeMatrix();
    const activeElement = document.activeElement;
    lastUpgradeTrigger =
      activeElement && typeof activeElement.focus === 'function' ? activeElement : null;

    upgradeOverlay.setAttribute('aria-hidden', 'false');
    if (upgradeOverlayButton) {
      upgradeOverlayButton.setAttribute('aria-expanded', 'true');
    }
    if (!upgradeOverlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        upgradeOverlay.classList.add('active');
      });
    }

    const focusTarget = upgradeOverlayClose || upgradeOverlay.querySelector('.overlay-panel');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (typeof upgradeOverlay.focus === 'function') {
      upgradeOverlay.focus();
    }
  }

  function hideUpgradeMatrix() {
    if (!upgradeOverlay) {
      return;
    }

    upgradeOverlay.classList.remove('active');
    upgradeOverlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(upgradeOverlay);
    if (upgradeOverlayButton) {
      upgradeOverlayButton.setAttribute('aria-expanded', 'false');
    }

    if (lastUpgradeTrigger && typeof lastUpgradeTrigger.focus === 'function') {
      lastUpgradeTrigger.focus();
    }
    lastUpgradeTrigger = null;
  }

  function bindUpgradeMatrix() {
    upgradeOverlayButton = document.getElementById('open-upgrade-matrix');
    upgradeOverlay = document.getElementById('upgrade-matrix-overlay');
    upgradeOverlayGrid = document.getElementById('upgrade-matrix-grid');
    upgradeOverlayClose = upgradeOverlay
      ? upgradeOverlay.querySelector('[data-overlay-close]')
      : null;

    if (upgradeOverlay && !upgradeOverlay.hasAttribute('tabindex')) {
      upgradeOverlay.setAttribute('tabindex', '-1');
    }

    if (upgradeOverlayButton) {
      upgradeOverlayButton.setAttribute('aria-expanded', 'false');
      upgradeOverlayButton.addEventListener('click', () => {
        showUpgradeMatrix();
      });
    }

    if (upgradeOverlayClose) {
      upgradeOverlayClose.addEventListener('click', () => {
        hideUpgradeMatrix();
      });
    }

    if (upgradeOverlay) {
      upgradeOverlay.addEventListener('click', (event) => {
        if (event.target === upgradeOverlay) {
          hideUpgradeMatrix();
        }
      });
    }
  }

  function enablePanelWheelScroll(panel) {
    if (!panel || panel.dataset.scrollAssist === 'true') {
      return;
    }

    panel.dataset.scrollAssist = 'true';
    panel.addEventListener(
      'wheel',
      (event) => {
        if (!event || typeof event.deltaY !== 'number') {
          return;
        }

        if (isFieldNotesOverlayVisible()) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          return;
        }

        const deltaMode = typeof event.deltaMode === 'number' ? event.deltaMode : 0;
        let deltaY = event.deltaY;

        if (deltaMode === 1) {
          const computed = window.getComputedStyle(panel);
          const lineHeight = parseFloat(computed.lineHeight) || 16;
          deltaY *= lineHeight;
        } else if (deltaMode === 2) {
          deltaY *= panel.clientHeight || window.innerHeight || 600;
        }

        if (!deltaY) {
          return;
        }

        const previous = panel.scrollTop;
        panel.scrollTop += deltaY;
        if (panel.scrollTop !== previous) {
          event.preventDefault();
        }
      },
      { passive: false },
    );
  }

  function bindLeaveLevelButton() {
    if (!leaveLevelBtn) return;
    leaveLevelBtn.addEventListener('click', () => {
      leaveActiveLevel();
    });
  }

  function focusLeaveLevelButton() {
    if (leaveLevelBtn && !leaveLevelBtn.disabled && typeof leaveLevelBtn.focus === 'function') {
      leaveLevelBtn.focus();
    }
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '—';
    }
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (minutes && secs) {
      return `${minutes}m ${secs}s`;
    }
    if (minutes) {
      return `${minutes}m`;
    }
    return `${secs}s`;
  }

  function formatRewards(rewardScore, rewardFlux, rewardEnergy) {
    const parts = [];
    if (Number.isFinite(rewardScore)) {
      parts.push(`${formatGameNumber(rewardScore)} Σ`);
    }
    if (Number.isFinite(rewardFlux)) {
      parts.push(`+${Math.round(rewardFlux)} Motes/min`);
    }
    if (Number.isFinite(rewardEnergy)) {
      parts.push(`+${Math.round(rewardEnergy)} TD/s`);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  function formatInteractiveLevelRewards() {
    const levelsBeaten = getCompletedInteractiveLevelCount();
    const multiplier = getStartingTheroMultiplier(levelsBeaten);
    const currentStart = BASE_START_THERO * multiplier;
    const levelLabel = levelsBeaten === 1 ? 'level' : 'levels';
    const beatenText = `Levels beaten: ${levelsBeaten} ${levelLabel}`;
    return `+1 Motes/min · Starting Thero = ${BASE_START_THERO} × 2^(levels beaten) (${beatenText} → ${formatWholeNumber(currentStart)} ${THERO_SYMBOL})`;
  }

  function formatRelativeTime(timestamp) {
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    const diff = Date.now() - timestamp;
    if (!Number.isFinite(diff)) {
      return null;
    }
    if (diff < 0) {
      return 'soon';
    }
    const seconds = Math.round(diff / 1000);
    if (seconds < 5) {
      return 'just now';
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function getLevelSummary(level) {
    if (!level) {
      return { mode: '—', duration: '—', rewards: '—' };
    }
    const interactiveConfig = levelConfigs.get(level.id);
    if (interactiveConfig) {
      const waves = interactiveConfig.waves?.length || 0;
      const endless = Boolean(interactiveConfig.forceEndlessMode);
      return {
        mode: endless ? 'Endless Defense' : 'Active Defense',
        duration: endless ? 'Endless · manual' : waves ? `${waves} waves · manual` : 'Active defense',
        rewards: formatInteractiveLevelRewards(),
      };
    }

    const config = idleLevelConfigs.get(level.id);
    return {
      mode: 'Idle Simulation',
      duration: config
        ? `${formatDuration(config.runDuration)} auto-run`
        : 'Idle simulation',
      rewards: config
        ? formatRewards(config.rewardScore, config.rewardFlux, config.rewardEnergy)
        : '—',
    };
  }

  function describeLevelLastResult(level, state, runner) {
    if (runner) {
      const percent = Math.min(100, Math.max(0, Math.round((runner.progress || 0) * 100)));
      const remainingSeconds = Number.isFinite(runner.remainingMs)
        ? Math.ceil(runner.remainingMs / 1000)
        : null;
      const remainingLabel = remainingSeconds === null
        ? 'Finishing'
        : `${formatDuration(remainingSeconds)} remaining`;
      return `Auto-run ${percent}% · ${remainingLabel}.`;
    }

    if (state?.running) {
      return level && isInteractiveLevel(level.id)
        ? 'Manual defense active.'
        : 'Auto-run initializing.';
    }

    if (!state || !state.lastResult) {
      return 'No attempts recorded.';
    }

    const { outcome, stats = {}, timestamp } = state.lastResult;
    const bestWave = Math.max(state.bestWave || 0, stats.maxWave || 0);
    const relative = formatRelativeTime(timestamp) || 'recently';

    if (outcome === 'victory') {
      const rewardText = formatRewards(stats.rewardScore, stats.rewardFlux, stats.rewardEnergy);
      const segments = [`Victory ${relative}.`];
      if (rewardText && rewardText !== '—') {
        segments.push(`Rewards: ${rewardText}.`);
      }
      if (Number.isFinite(stats.startThero)) {
        segments.push(`Starting Thero now ${formatWholeNumber(stats.startThero)} ${THERO_SYMBOL}.`);
      }
      if (bestWave > 0) {
        segments.push(`Waves cleared: ${bestWave}.`);
      }
      return segments.join(' ');
    }

    if (outcome === 'defeat') {
      return bestWave > 0
        ? `Defense collapsed ${relative}. Reached wave ${bestWave}.`
        : `Defense collapsed ${relative}.`;
    }

    return 'No attempts recorded.';
  }

  function readStorage(key) {
    try {
      return window?.localStorage?.getItem(key) ?? null;
    } catch (error) {
      console.warn('Storage read failed', error);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window?.localStorage?.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('Storage write failed', error);
      return false;
    }
  }

  function readStorageJson(key) {
    const raw = readStorage(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Storage parse failed', error);
      return null;
    }
  }

  function writeStorageJson(key, value) {
    try {
      const payload = JSON.stringify(value);
      return writeStorage(key, payload);
    } catch (error) {
      console.warn('Storage serialization failed', error);
      return false;
    }
  }

  function setActiveAchievement(id) {
    const nextId = id && achievementElements.has(id) && activeAchievementId !== id ? id : null;
    activeAchievementId = nextId;

    achievementElements.forEach((element, elementId) => {
      const expanded = elementId === activeAchievementId;
      if (element.container) {
        element.container.classList.toggle('expanded', expanded);
        element.container.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }
      if (element.detail) {
        element.detail.hidden = !expanded;
      }
    });
  }

  function renderAchievementGrid() {
    if (!achievementGridEl) {
      achievementGridEl = document.getElementById('achievement-grid');
    }
    if (!achievementGridEl) {
      return;
    }

    achievementElements.clear();
    achievementGridEl.innerHTML = '';

    if (!achievementDefinitions.length) {
      achievementGridEl.setAttribute('role', 'list');
      activeAchievementId = null;
      return;
    }

    const fragment = document.createDocumentFragment();

    achievementDefinitions.forEach((definition, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'achievement-tile';
      tile.dataset.achievementId = definition.id;
      tile.setAttribute('role', 'listitem');
      tile.setAttribute('aria-expanded', 'false');
      tile.setAttribute('aria-label', `${definition.title} achievement. Activate to view details.`);
      tile.addEventListener('click', () => {
        setActiveAchievement(definition.id);
      });

      const icon = document.createElement('span');
      icon.className = 'achievement-icon';
      icon.textContent = definition.icon || String(index + 1);
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'achievement-label';
      label.textContent = definition.title;

      const detail = document.createElement('div');
      detail.className = 'achievement-detail';
      detail.hidden = true;

      if (definition.subtitle && definition.subtitle !== definition.title) {
        const subtitle = document.createElement('p');
        subtitle.className = 'achievement-subtitle';
        subtitle.textContent = definition.subtitle;
        detail.append(subtitle);
      }

      if (definition.description) {
        const description = document.createElement('p');
        description.className = 'achievement-description';
        description.textContent = definition.description;
        detail.append(description);
      }

      const status = document.createElement('p');
      status.className = 'achievement-status';
      status.textContent = 'Locked — Seal this level to unlock.';
      detail.append(status);

      tile.append(icon, label, detail);
      fragment.append(tile);

      achievementElements.set(definition.id, {
        container: tile,
        status,
        detail,
      });
    });

    achievementGridEl.setAttribute('role', 'list');
    achievementGridEl.append(fragment);
    setActiveAchievement(null);
  }

  function bindAchievements() {
    renderAchievementGrid();
    evaluateAchievements();
    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();
  }

  function updateAchievementStatus(definition, element, state) {
    if (!definition || !element) {
      return;
    }
    const { container, status } = element;
    if (state?.unlocked) {
      if (container) {
        container.classList.add('achievement-unlocked');
      }
      if (status) {
        status.textContent = 'Unlocked · +1 Motes/min secured.';
      }
      if (container && status) {
        container.setAttribute(
          'aria-label',
          `${definition.title} achievement. ${status.textContent} Activate to view details.`,
        );
      }
      return;
    }

    if (container) {
      container.classList.remove('achievement-unlocked');
    }
    if (status) {
      const progress = typeof definition.progress === 'function'
        ? definition.progress()
        : 'Locked';
      status.textContent = progress.startsWith('Locked')
        ? progress
        : `Locked — ${progress}`;
    }
    if (container && status) {
      container.setAttribute(
        'aria-label',
        `${definition.title} achievement. ${status.textContent} Activate to view details.`,
      );
    }
  }

  function evaluateAchievements() {
    achievementDefinitions.forEach((definition) => {
      const state = achievementState.get(definition.id);
      if (!state?.unlocked && typeof definition.condition === 'function' && definition.condition()) {
        unlockAchievement(definition);
      } else {
        updateAchievementStatus(definition, achievementElements.get(definition.id), state || null);
      }
    });
  }

  function unlockAchievement(definition) {
    if (!definition) {
      return;
    }
    const existing = achievementState.get(definition.id);
    if (existing?.unlocked) {
      updateAchievementStatus(definition, achievementElements.get(definition.id), existing);
      return;
    }

    const state = { unlocked: true, unlockedAt: Date.now() };
    achievementState.set(definition.id, state);

    const element = achievementElements.get(definition.id);
    updateAchievementStatus(definition, element, state);

    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();

    recordPowderEvent('achievement-unlocked', { title: definition.title });
    updateStatusDisplays();
  }

  function getUnlockedAchievementCount() {
    return Array.from(achievementState.values()).filter((state) => state?.unlocked).length;
  }

  function refreshAchievementPowderRate() {
    const unlocked = getUnlockedAchievementCount();
    achievementPowderRate = unlocked * ACHIEVEMENT_REWARD_FLUX;
  }

  function notifyTowerPlaced(activeCount) {
    gameStats.towersPlaced += 1;
    if (Number.isFinite(activeCount)) {
      gameStats.maxTowersSimultaneous = Math.max(gameStats.maxTowersSimultaneous, activeCount);
    }
    evaluateAchievements();
  }

  function updateLoadoutNote() {
    if (!loadoutElements.note) {
      return;
    }
    if (!towerLoadoutState.selected.length) {
      loadoutElements.note.textContent =
        'Select towers on the Towers tab to prepare up to four glyphs for this defense.';
    } else {
      loadoutElements.note.textContent =
        'Select four towers to bring into the defense. Drag the glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge.';
    }
  }

  function pruneLockedTowersFromLoadout() {
    const selected = towerLoadoutState.selected;
    let changed = false;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!isTowerUnlocked(selected[index])) {
        selected.splice(index, 1);
        changed = true;
      }
    }
    return changed;
  }

  function renderTowerLoadout() {
    if (!loadoutElements.grid) {
      renderedLoadoutSignature = null;
      return;
    }

    const selected = towerLoadoutState.selected;
    const signature = selected.join('|');
    const existingCount = loadoutElements.grid.childElementCount;

    if (signature === renderedLoadoutSignature && existingCount === selected.length) {
      refreshTowerLoadoutDisplay();
      updateLoadoutNote();
      return;
    }

    loadoutElements.grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    renderedLoadoutSignature = signature;

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

      const symbol = document.createElement('span');
      symbol.className = 'tower-loadout-symbol';
      symbol.textContent = definition.symbol;

      const label = document.createElement('span');
      label.className = 'tower-loadout-label';
      label.textContent = definition.name;

      const costEl = document.createElement('span');
      costEl.className = 'tower-loadout-cost';
      costEl.textContent = '—';

      item.append(artwork, symbol, label, costEl);

      item.addEventListener('pointerdown', (event) => startTowerDrag(event, towerId, item));

      fragment.append(item);
    });

    loadoutElements.grid.append(fragment);
    refreshTowerLoadoutDisplay();
    updateLoadoutNote();
  }

  function refreshTowerLoadoutDisplay() {
    if (!loadoutElements.grid) {
      return;
    }
    const interactive = Boolean(playfield && playfield.isInteractiveLevelActive());
    const items = loadoutElements.grid.querySelectorAll('.tower-loadout-item');
    items.forEach((item) => {
      const towerId = item.dataset.towerId;
      const definition = getTowerDefinition(towerId);
      if (!definition) {
        return;
      }
      const currentCost = playfield ? playfield.getCurrentTowerCost(towerId) : definition.baseCost;
      const costEl = item.querySelector('.tower-loadout-cost');
      if (costEl) {
        costEl.textContent = `${Math.round(currentCost)} ${THERO_SYMBOL}`;
      }
      const affordable = interactive ? playfield.energy >= currentCost : false;
      item.dataset.valid = affordable ? 'true' : 'false';
      item.dataset.disabled = interactive ? 'false' : 'true';
      item.disabled = !interactive;
    });
  }

  function cancelTowerDrag() {
    if (!loadoutDragState.active) {
      return;
    }
    document.removeEventListener('pointermove', handleTowerDragMove);
    document.removeEventListener('pointerup', handleTowerDragEnd);
    document.removeEventListener('pointercancel', handleTowerDragEnd);
    if (loadoutDragState.element) {
      try {
        loadoutDragState.element.releasePointerCapture(loadoutDragState.pointerId);
      } catch (error) {
        // ignore
      }
      loadoutDragState.element.removeAttribute('data-state');
    }
    playfield?.finishTowerDrag();
    playfield?.clearPlacementPreview();
    loadoutDragState.active = false;
    loadoutDragState.pointerId = null;
    loadoutDragState.towerId = null;
    loadoutDragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  function handleTowerDragMove(event) {
    if (!loadoutDragState.active || event.pointerId !== loadoutDragState.pointerId) {
      return;
    }
    if (!playfield) {
      return;
    }
    const normalized = playfield.getNormalizedFromEvent(event);
    if (!normalized) {
      playfield.clearPlacementPreview();
      return;
    }
    playfield.previewTowerPlacement(normalized, {
      towerType: loadoutDragState.towerId,
      dragging: true,
    });
  }

  function finalizeTowerDrag(event) {
    if (!loadoutDragState.active || event.pointerId !== loadoutDragState.pointerId) {
      return;
    }

    if (loadoutDragState.element) {
      try {
        loadoutDragState.element.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
      loadoutDragState.element.removeAttribute('data-state');
    }

    document.removeEventListener('pointermove', handleTowerDragMove);
    document.removeEventListener('pointerup', handleTowerDragEnd);
    document.removeEventListener('pointercancel', handleTowerDragEnd);

    if (playfield) {
      const normalized = playfield.getNormalizedFromEvent(event);
      if (normalized) {
        playfield.completeTowerPlacement(normalized, { towerType: loadoutDragState.towerId });
      } else {
        playfield.clearPlacementPreview();
      }
      playfield.finishTowerDrag();
    }

    loadoutDragState.active = false;
    loadoutDragState.pointerId = null;
    loadoutDragState.towerId = null;
    loadoutDragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  function handleTowerDragEnd(event) {
    finalizeTowerDrag(event);
  }

  function startTowerDrag(event, towerId, element) {
    if (!playfield || !playfield.isInteractiveLevelActive()) {
      if (audioManager) {
        audioManager.playSfx('error');
      }
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = 'Enter the defense to lattice towers from your loadout.';
      }
      return;
    }

    cancelTowerDrag();

    loadoutDragState.active = true;
    loadoutDragState.pointerId = event.pointerId;
    loadoutDragState.towerId = towerId;
    loadoutDragState.element = element;
    element.dataset.state = 'dragging';

    playfield.setDraggingTower(towerId);

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

  function updateTowerSelectionButtons() {
    towerSelectionButtons.forEach((button, towerId) => {
      const definition = getTowerDefinition(towerId);
      const selected = towerLoadoutState.selected.includes(towerId);
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
      if (playfield && playfield.isInteractiveLevelActive()) {
        button.disabled = true;
        button.title = 'Leave the active level to adjust your loadout.';
        return;
      }
      const atLimit = !selected && towerLoadoutState.selected.length >= TOWER_LOADOUT_LIMIT;
      button.disabled = atLimit;
      button.title = selected
        ? `${definition?.name || 'Tower'} is currently in your loadout.`
        : `Equip ${definition?.name || 'tower'} for this defense.`;
    });
  }

  function toggleTowerSelection(towerId) {
    if (!towerDefinitionMap.has(towerId)) {
      return;
    }
    if (playfield && playfield.isInteractiveLevelActive()) {
      if (audioManager) {
        audioManager.playSfx('error');
      }
      if (loadoutElements.note) {
        loadoutElements.note.textContent = 'Leave the active level to adjust your loadout.';
      }
      updateTowerSelectionButtons();
      return;
    }
    if (!isTowerUnlocked(towerId)) {
      if (audioManager) {
        audioManager.playSfx('error');
      }
      const definition = getTowerDefinition(towerId);
      if (loadoutElements.note && definition) {
        loadoutElements.note.textContent = `Discover ${definition.name} before equipping it.`;
      }
      updateTowerSelectionButtons();
      return;
    }
    const selected = towerLoadoutState.selected;
    const index = selected.indexOf(towerId);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      if (selected.length >= TOWER_LOADOUT_LIMIT) {
        if (audioManager) {
          audioManager.playSfx('error');
        }
        if (loadoutElements.note) {
          loadoutElements.note.textContent = 'Only four towers can be prepared at once.';
        }
        updateTowerSelectionButtons();
        return;
      }
      selected.push(towerId);
    }
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
  }

  function getTowerEquationBlueprint(towerId) {
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

  function ensureTowerUpgradeState(towerId, blueprint = null) {
    if (!towerId) {
      return { variables: {} };
    }
    const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
    let state = towerUpgradeState.get(towerId);
    if (!state) {
      state = { variables: {} };
      towerUpgradeState.set(towerId, state);
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

  function calculateTowerVariableUpgradeCost(variable, level) {
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

  function computeTowerVariableValue(towerId, variableKey, blueprint = null, visited = new Set()) {
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

  function calculateTowerEquationResult(towerId, visited = new Set()) {
    if (!towerId) {
      return 0;
    }
    if (towerEquationCache.has(towerId)) {
      return towerEquationCache.get(towerId);
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
    towerEquationCache.set(towerId, safeResult);
    visited.delete(towerId);
    return safeResult;
  }

  function invalidateTowerEquationCache() {
    towerEquationCache.clear();
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

  function updateTowerUpgradeGlyphDisplay() {
    if (!towerUpgradeElements.glyphs) {
      return;
    }
    const available = Math.max(0, Math.floor(glyphCurrency));
    towerUpgradeElements.glyphs.textContent = `Available Glyphs: ${formatWholeNumber(available)}`;
  }

  function setTowerUpgradeNote(message, tone = '') {
    if (!towerUpgradeElements.note) {
      return;
    }
    towerUpgradeElements.note.textContent = message || '';
    if (tone) {
      towerUpgradeElements.note.dataset.tone = tone;
    } else {
      towerUpgradeElements.note.removeAttribute('data-tone');
    }
  }

  function renderTowerUpgradeVariables(towerId, blueprint, values = {}) {
    if (!towerUpgradeElements.variables) {
      return;
    }
    const container = towerUpgradeElements.variables;
    container.innerHTML = '';
    const variables = blueprint?.variables || [];
    const state = ensureTowerUpgradeState(towerId, blueprint);

    if (!variables.length) {
      const empty = document.createElement('p');
      empty.className = 'tower-upgrade-variable-note';
      empty.textContent = 'This lattice has no adjustable variables yet.';
      container.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    variables.forEach((variable) => {
      const value = Number.isFinite(values[variable.key]) ? values[variable.key] : 0;
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

      const footer = document.createElement('div');
      footer.className = 'tower-upgrade-variable-footer';

      const stats = document.createElement('div');
      stats.className = 'tower-upgrade-variable-stats';

      const valueEl = document.createElement('span');
      valueEl.className = 'tower-upgrade-variable-value';
      valueEl.textContent = formatTowerVariableValue(variable, value);
      stats.append(valueEl);

      const level = state.variables?.[variable.key]?.level || 0;
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
        increment.disabled = glyphCurrency < cost;
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
    syncTowerVariableCardVisibility();
  }

  function renderTowerUpgradeOverlay(towerId, options = {}) {
    if (!towerUpgradeElements.overlay) {
      return;
    }
    const animateEntry = Boolean(options.animateEntry);
    if (animateEntry) {
      towerVariableAnimationState.entryPlayed = false;
    }
    towerVariableAnimationState.shouldPlayEntry = animateEntry;

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
        : activeTowerUpgradeBaseEquation || blueprint.baseEquation || '';
    activeTowerUpgradeBaseEquation = baseEquationText;

    if (towerUpgradeElements.title) {
      const label = `${definition.symbol ? `${definition.symbol} ` : ''}${definition.name || 'Tower'}`.trim();
      towerUpgradeElements.title.textContent = label || 'Tower Equation';
    }

    if (towerUpgradeElements.tier) {
      const tierLabel = Number.isFinite(definition.tier) ? `Tier ${definition.tier}` : '';
      towerUpgradeElements.tier.textContent = tierLabel;
    }

    if (towerUpgradeElements.icon) {
      towerUpgradeElements.icon.innerHTML = '';
      if (definition.icon) {
        const img = document.createElement('img');
        img.src = definition.icon;
        const iconLabel = `${definition.symbol ? `${definition.symbol} ` : ''}${definition.name || 'tower'}`.trim();
        img.alt = iconLabel ? `${iconLabel} icon` : 'Tower icon';
        img.loading = 'lazy';
        img.decoding = 'async';
        towerUpgradeElements.icon.hidden = false;
        towerUpgradeElements.icon.append(img);
      } else {
        towerUpgradeElements.icon.hidden = true;
      }
    }

    if (towerUpgradeElements.baseEquation) {
      renderTowerUpgradeEquationParts(baseEquationText, blueprint, {
        markDeparted: towerVariableAnimationState.entryPlayed,
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

    if (towerUpgradeElements.goldenEquation) {
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
      towerUpgradeElements.goldenEquation.textContent = goldenEquation;
      renderMathElement(towerUpgradeElements.goldenEquation);
    }

    renderTowerUpgradeVariables(towerId, blueprint, values);
    refreshTowerVariableAnimationState(towerId, blueprint);
    updateTowerUpgradeGlyphDisplay();
  }

  function openTowerUpgradeOverlay(towerId, options = {}) {
    if (!towerId || !towerUpgradeElements.overlay) {
      return;
    }
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return;
    }

    activeTowerUpgradeId = towerId;
    invalidateTowerEquationCache();

    const blueprint = getTowerEquationBlueprint(towerId);
    ensureTowerUpgradeState(towerId, blueprint);

    const sourceCard = options.sourceCard || null;
    const baseEquationText =
      blueprint?.baseEquation || (sourceCard ? extractTowerCardEquation(sourceCard) : '') || activeTowerUpgradeBaseEquation;
    activeTowerUpgradeBaseEquation = baseEquationText;

    const trigger = options.trigger && typeof options.trigger.focus === 'function' ? options.trigger : document.activeElement;
    lastTowerUpgradeTrigger = trigger && typeof trigger.focus === 'function' ? trigger : null;

    setTowerUpgradeNote('Invest glyphs to sculpt each variable toward your preferred proof.');

    revealOverlay(towerUpgradeElements.overlay);
    towerUpgradeElements.overlay.setAttribute('aria-hidden', 'false');
    if (!towerUpgradeElements.overlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        towerUpgradeElements.overlay.classList.add('active');
      });
    } else {
      towerUpgradeElements.overlay.classList.add('active');
    }

    renderTowerUpgradeOverlay(towerId, { blueprint, baseEquationText, sourceCard, animateEntry: true });
    maybePlayTowerVariableEntry();

    const focusTarget = towerUpgradeElements.close || towerUpgradeElements.overlay;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }
  }

  function closeTowerUpgradeOverlay() {
    if (!towerUpgradeElements.overlay) {
      return;
    }
    const overlay = towerUpgradeElements.overlay;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    towerVariableAnimationState.shouldPlayEntry = false;

    const finalizeClose = () => {
      scheduleOverlayHide(overlay);
      resetTowerVariableAnimationState();
    };

    playTowerVariableFlight('exit').finally(() => {
      finalizeClose();
    });

    if (lastTowerUpgradeTrigger && typeof lastTowerUpgradeTrigger.focus === 'function') {
      try {
        lastTowerUpgradeTrigger.focus({ preventScroll: true });
      } catch (error) {
        lastTowerUpgradeTrigger.focus();
      }
    }
    lastTowerUpgradeTrigger = null;
    activeTowerUpgradeId = null;
  }

  function handleTowerVariableUpgrade(towerId, variableKey) {
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

    if (glyphCurrency < normalizedCost) {
      setTowerUpgradeNote('Not enough glyphs to reinforce this variable.', 'warning');
      updateTowerUpgradeGlyphDisplay();
      renderTowerUpgradeOverlay(towerId, { blueprint });
      if (audioManager) {
        audioManager.playSfx?.('error');
      }
      return;
    }

    glyphCurrency -= normalizedCost;
    state.variables[variableKey].level = currentLevel + 1;
    invalidateTowerEquationCache();
    setTowerUpgradeNote(
      `Invested ${normalizedCost} ${normalizedCost === 1 ? 'glyph' : 'glyphs'} into ${variable.symbol}.`,
      'success',
    );
    if (audioManager) {
      audioManager.playSfx?.('upgrade');
    }
    renderTowerUpgradeOverlay(towerId, { blueprint });
  }

  function handleTowerVariableDowngrade(towerId, variableKey) {
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
      if (audioManager) {
        audioManager.playSfx?.('error');
      }
      renderTowerUpgradeOverlay(towerId, { blueprint });
      return;
    }

    const nextLevel = currentLevel - 1;
    const refundAmount = Math.max(1, calculateTowerVariableUpgradeCost(variable, nextLevel));

    state.variables[variableKey].level = nextLevel;
    glyphCurrency += refundAmount;
    invalidateTowerEquationCache();

    setTowerUpgradeNote(
      `Withdrew ${refundAmount} ${refundAmount === 1 ? 'glyph' : 'glyphs'} from ${variable.symbol || variable.key}.`,
      'success',
    );

    if (audioManager) {
      audioManager.playSfx?.('towerSell');
    }

    renderTowerUpgradeOverlay(towerId, { blueprint });
  }

  function bindTowerUpgradeOverlay() {
    towerUpgradeElements.overlay = document.getElementById('tower-upgrade-overlay');
    if (!towerUpgradeElements.overlay) {
      return;
    }
    towerUpgradeElements.panel = towerUpgradeElements.overlay.querySelector('.tower-upgrade-panel');
    towerUpgradeElements.close = towerUpgradeElements.overlay.querySelector('[data-tower-upgrade-close]');
    towerUpgradeElements.title = document.getElementById('tower-upgrade-title');
    towerUpgradeElements.tier = document.getElementById('tower-upgrade-tier');
    towerUpgradeElements.glyphs = document.getElementById('tower-upgrade-glyphs');
    towerUpgradeElements.baseEquation = document.getElementById('tower-upgrade-base');
    towerUpgradeElements.goldenEquation = document.getElementById('tower-upgrade-golden');
    towerUpgradeElements.variables = document.getElementById('tower-upgrade-variables');
    towerUpgradeElements.note = document.getElementById('tower-upgrade-note');
    towerUpgradeElements.icon = document.getElementById('tower-upgrade-icon');

    if (!towerUpgradeElements.overlay.hasAttribute('tabindex')) {
      towerUpgradeElements.overlay.setAttribute('tabindex', '-1');
    }

    if (towerUpgradeElements.close) {
      towerUpgradeElements.close.addEventListener('click', () => {
        closeTowerUpgradeOverlay();
      });
    }

    towerUpgradeElements.overlay.addEventListener('click', (event) => {
      if (event.target === towerUpgradeElements.overlay) {
        closeTowerUpgradeOverlay();
      }
    });
  }

  function bindTowerCardUpgradeInteractions() {
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

  function updateTowerCardVisibility() {
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
    });
  }

  function injectTowerCardPreviews() {
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
      const labelBase = definition
        ? `${definition.symbol} ${definition.name}`.trim()
        : towerId;
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

  function annotateTowerCardsWithCost() {
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

      const formattedCost = `${formatGameNumber(definition.baseCost)} ${THERO_SYMBOL}`;
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

  function initializeTowerSelection() {
    const buttons = document.querySelectorAll('[data-tower-toggle]');
    buttons.forEach((button) => {
      const towerId = button.dataset.towerToggle;
      if (!towerId) {
        return;
      }
      towerSelectionButtons.set(towerId, button);
      const definition = getTowerDefinition(towerId);
      if (definition) {
        button.textContent = `Equip ${definition.symbol}`;
      }
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => toggleTowerSelection(towerId));
    });
    updateTowerSelectionButtons();
  }

  function syncLoadoutToPlayfield() {
    pruneLockedTowersFromLoadout();
    if (playfield) {
      playfield.setAvailableTowers(towerLoadoutState.selected);
    }
    renderTowerLoadout();
    updateTowerSelectionButtons();
  }

  function enableDeveloperMode() {
    developerModeActive = true;
    if (developerModeElements.toggle && !developerModeElements.toggle.checked) {
      developerModeElements.toggle.checked = true;
    }

    towerDefinitions.forEach((definition) => {
      unlockTower(definition.id, { silent: true });
    });

    towerLoadoutState.selected = towerDefinitions
      .slice(0, TOWER_LOADOUT_LIMIT)
      .map((definition) => definition.id);

    pruneLockedTowersFromLoadout();

    unlockedLevels.clear();
    interactiveLevelOrder.forEach((levelId) => {
      unlockedLevels.add(levelId);
      const existing = levelState.get(levelId) || {};
      levelState.set(levelId, {
        ...existing,
        entered: true,
        running: false,
        completed: true,
      });
    });

    levelBlueprints.forEach((level) => {
      if (!levelState.has(level.id)) {
        levelState.set(level.id, { entered: true, running: false, completed: true });
      }
    });

    const codexEntries = getEnemyCodexEntries();
    codexState.encounteredEnemies = new Set(codexEntries.map((entry) => entry.id));

    renderEnemyCodex();
    updateLevelCards();
    updateActiveLevelBanner();
    updateTowerCardVisibility();
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    updateStatusDisplays();

    evaluateAchievements();
    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();

    if (developerModeElements.note) {
      developerModeElements.note.hidden = false;
    }

    updateDeveloperControlsVisibility();
    syncDeveloperControlValues();

    syncLevelEditorVisibility();

    if (playfield?.messageEl) {
      playfield.messageEl.textContent =
        'Developer lattice engaged—every tower, level, and codex entry is unlocked.';
    }

    updatePowderHitboxVisibility();
  }

  function disableDeveloperMode() {
    developerModeActive = false;
    if (developerModeElements.toggle && developerModeElements.toggle.checked) {
      developerModeElements.toggle.checked = false;
    }

    towerUnlockState.unlocked = new Set(['alpha']);
    setMergingLogicUnlocked(false);
    towerLoadoutState.selected = ['alpha'];
    pruneLockedTowersFromLoadout();

    codexState.encounteredEnemies = new Set();

    levelState.clear();
    unlockedLevels.clear();
    if (interactiveLevelOrder.length) {
      unlockedLevels.add(interactiveLevelOrder[0]);
    }

    activeLevelId = null;
    pendingLevel = null;
    resourceState.running = false;

    if (playfield) {
      playfield.leaveLevel();
    }

    renderEnemyCodex();
    updateLevelCards();
    updateActiveLevelBanner();
    updateTowerCardVisibility();
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    updateStatusDisplays();

    evaluateAchievements();
    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();

    if (developerModeElements.note) {
      developerModeElements.note.hidden = true;
    }

    updateDeveloperControlsVisibility();

    hideLevelEditorPanel();

    updatePowderHitboxVisibility();
  }

  function bindDeveloperModeToggle() {
    developerModeElements.toggle = document.getElementById('codex-developer-mode');
    developerModeElements.note = document.getElementById('codex-developer-note');

    if (!developerModeElements.toggle) {
      return;
    }

    developerModeElements.toggle.addEventListener('change', (event) => {
      if (event.target.checked) {
        enableDeveloperMode();
      } else {
        disableDeveloperMode();
      }
    });
  }

  function scrollPanelToElement(target, { offset = 16 } = {}) {
    if (!target) {
      return;
    }

    const panel = target.closest('.panel');
    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const desiredTop = targetRect.top - panelRect.top + panel.scrollTop - offset;
      const top = Math.max(0, desiredTop);
      const scrollOptions = { top, behavior: 'smooth' };
      try {
        panel.scrollTo(scrollOptions);
      } catch (error) {
        panel.scrollTop = top;
      }
      return;
    }

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      target.scrollIntoView(true);
    }
  }

  function isFieldNotesOverlayVisible() {
    return Boolean(fieldNotesElements.overlay?.classList.contains('active'));
  }

  function focusFieldNotesElement(element) {
    if (!element || typeof element.focus !== 'function') {
      return;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  function getFieldNotesPages() {
    return Array.isArray(fieldNotesElements.pages) ? fieldNotesElements.pages : [];
  }

  function updateFieldNotesControls() {
    const pages = getFieldNotesPages();
    const total = pages.length;
    const current = Math.max(0, Math.min(total - 1, fieldNotesState.currentIndex));

    if (fieldNotesElements.pageIndicator) {
      const label = total > 0 ? `Page ${current + 1} of ${total}` : 'Page 1 of 1';
      fieldNotesElements.pageIndicator.textContent = label;
      fieldNotesElements.pageIndicator.hidden = total <= 1;
    }

    if (fieldNotesElements.prevButton) {
      fieldNotesElements.prevButton.disabled = current <= 0 || total <= 1;
      fieldNotesElements.prevButton.hidden = total <= 1;
    }

    if (fieldNotesElements.nextButton) {
      fieldNotesElements.nextButton.disabled = current >= total - 1 || total <= 1;
      fieldNotesElements.nextButton.hidden = total <= 1;
    }

    if (fieldNotesElements.pagination) {
      if (total <= 1) {
        fieldNotesElements.pagination.setAttribute('hidden', '');
      } else {
        fieldNotesElements.pagination.removeAttribute('hidden');
      }
    }
  }

  function setFieldNotesPage(targetIndex, options = {}) {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      fieldNotesState.currentIndex = 0;
      updateFieldNotesControls();
      return;
    }

    const clampedIndex = Math.max(0, Math.min(pages.length - 1, targetIndex));
    const immediate = Boolean(options.immediate);
    const currentIndex = Math.max(0, Math.min(pages.length - 1, fieldNotesState.currentIndex));
    const currentPage = pages[currentIndex];
    const nextPage = pages[clampedIndex];

    if (!nextPage) {
      return;
    }

    if (!immediate && clampedIndex !== currentIndex && audioManager) {
      audioManager.playSfx('pageTurn');
    }

    if (immediate) {
      fieldNotesState.animating = false;
      fieldNotesState.currentIndex = clampedIndex;
      pages.forEach((page, index) => {
        const active = index === clampedIndex;
        page.classList.toggle('field-notes-page--active', active);
        page.classList.remove(
          'field-notes-page--enter-forward',
          'field-notes-page--enter-backward',
          'field-notes-page--exit-forward',
          'field-notes-page--exit-backward',
        );
        page.setAttribute('tabindex', active ? '0' : '-1');
        page.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) {
          page.scrollTop = 0;
        }
      });
      updateFieldNotesControls();
      return;
    }

    if (fieldNotesState.animating || clampedIndex === currentIndex) {
      return;
    }

    const direction = Number.isFinite(options.direction)
      ? Math.sign(options.direction)
      : clampedIndex > currentIndex
      ? 1
      : -1;

    fieldNotesState.animating = true;

    const enterClass = direction >= 0 ? 'field-notes-page--enter-forward' : 'field-notes-page--enter-backward';
    const exitClass = direction >= 0 ? 'field-notes-page--exit-forward' : 'field-notes-page--exit-backward';

    if (currentPage && currentPage !== nextPage) {
      currentPage.classList.remove(
        'field-notes-page--enter-forward',
        'field-notes-page--enter-backward',
        'field-notes-page--exit-forward',
        'field-notes-page--exit-backward',
      );
      currentPage.classList.add(exitClass);
      currentPage.setAttribute('aria-hidden', 'true');
      currentPage.setAttribute('tabindex', '-1');
    }

    nextPage.classList.remove(
      'field-notes-page--enter-forward',
      'field-notes-page--enter-backward',
      'field-notes-page--exit-forward',
      'field-notes-page--exit-backward',
    );
    nextPage.classList.add('field-notes-page--active', enterClass);
    nextPage.setAttribute('aria-hidden', 'false');
    nextPage.setAttribute('tabindex', '0');
    nextPage.scrollTop = 0;

    let fallbackHandle = null;

    const finishTransition = (event) => {
      if (event && event.target !== nextPage) {
        return;
      }
      if (event && event.propertyName && event.propertyName !== 'transform') {
        return;
      }
      nextPage.removeEventListener('transitionend', finishTransition);
      if (fallbackHandle) {
        clearTimeout(fallbackHandle);
        fallbackHandle = null;
      }
      nextPage.classList.remove('field-notes-page--enter-forward', 'field-notes-page--enter-backward');
      if (currentPage && currentPage !== nextPage) {
        currentPage.classList.remove(
          'field-notes-page--active',
          'field-notes-page--exit-forward',
          'field-notes-page--exit-backward',
        );
      }
      fieldNotesState.currentIndex = clampedIndex;
      fieldNotesState.animating = false;
      updateFieldNotesControls();
    };

    requestAnimationFrame(() => {
      nextPage.addEventListener('transitionend', finishTransition);
      if (typeof window !== 'undefined') {
        fallbackHandle = window.setTimeout(() => {
          finishTransition();
        }, 420);
      }
      nextPage.classList.remove(enterClass);
    });
  }

  function showNextFieldNotesPage() {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      return;
    }
    const nextIndex = Math.min(pages.length - 1, fieldNotesState.currentIndex + 1);
    setFieldNotesPage(nextIndex, { direction: 1 });
  }

  function showPreviousFieldNotesPage() {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      return;
    }
    const nextIndex = Math.max(0, fieldNotesState.currentIndex - 1);
    setFieldNotesPage(nextIndex, { direction: -1 });
  }

  function handleFieldNotesOverlayKeydown(event) {
    if (!isFieldNotesOverlayVisible()) {
      return;
    }
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextFieldNotesPage();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPreviousFieldNotesPage();
    }
  }

  function handleFieldNotesPointerDown(event) {
    if (!event || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) {
      fieldNotesState.touchStart = null;
      return;
    }
    fieldNotesState.touchStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
    };
  }

  function handleFieldNotesPointerUp(event) {
    const start = fieldNotesState.touchStart;
    fieldNotesState.touchStart = null;
    if (!start || !event || start.pointerId !== event.pointerId || fieldNotesState.animating) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start.time;
    if (Math.abs(dx) < 40) {
      return;
    }
    if (Math.abs(dx) < Math.abs(dy) * 1.2) {
      return;
    }
    if (elapsed > 600) {
      return;
    }
    if (dx < 0) {
      showNextFieldNotesPage();
    } else {
      showPreviousFieldNotesPage();
    }
  }

  function clearFieldNotesPointerTracking() {
    fieldNotesState.touchStart = null;
  }

  function closeFieldNotesOverlay() {
    const { overlay } = fieldNotesElements;
    if (!overlay || !isFieldNotesOverlayVisible()) {
      return;
    }

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');

    scheduleOverlayHide(overlay);
    fieldNotesState.animating = false;
    clearFieldNotesPointerTracking();

    const focusTarget =
      fieldNotesElements.lastFocus && typeof fieldNotesElements.lastFocus.focus === 'function'
        ? fieldNotesElements.lastFocus
        : fieldNotesElements.openButton;

    if (focusTarget) {
      focusFieldNotesElement(focusTarget);
    }

    fieldNotesElements.lastFocus = null;
  }

  function openFieldNotesOverlay() {
    const { overlay, closeButton } = fieldNotesElements;
    if (!overlay || isFieldNotesOverlayVisible()) {
      return;
    }

    fieldNotesElements.lastFocus = document.activeElement;
    revealOverlay(overlay);
    overlay.setAttribute('aria-hidden', 'false');
    fieldNotesState.touchStart = null;
    setFieldNotesPage(0, { immediate: true });

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      if (closeButton) {
        focusFieldNotesElement(closeButton);
      } else {
        focusFieldNotesElement(overlay);
      }
    });
  }

  function initializeFieldNotesOverlay() {
    fieldNotesElements.overlay = document.getElementById('field-notes-overlay');
    fieldNotesElements.closeButton = document.getElementById('field-notes-close');
    fieldNotesElements.copy = document.getElementById('field-notes-copy');
    fieldNotesElements.pagination = document.getElementById('field-notes-pagination');
    fieldNotesElements.pageIndicator = document.getElementById('field-notes-page-indicator');
    fieldNotesElements.prevButton = document.getElementById('field-notes-prev');
    fieldNotesElements.nextButton = document.getElementById('field-notes-next');

    fieldNotesElements.pages = fieldNotesElements.copy
      ? Array.from(fieldNotesElements.copy.querySelectorAll('.field-notes-page'))
      : [];
    fieldNotesState.currentIndex = 0;
    setFieldNotesPage(0, { immediate: true });
    updateFieldNotesControls();

    const { overlay, closeButton } = fieldNotesElements;

    if (overlay) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          closeFieldNotesOverlay();
        }
      });

      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
          event.preventDefault();
          closeFieldNotesOverlay();
          return;
        }
        handleFieldNotesOverlayKeydown(event);
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeFieldNotesOverlay();
      });
    }

    if (fieldNotesElements.prevButton) {
      fieldNotesElements.prevButton.addEventListener('click', () => {
        showPreviousFieldNotesPage();
      });
    }

    if (fieldNotesElements.nextButton) {
      fieldNotesElements.nextButton.addEventListener('click', () => {
        showNextFieldNotesPage();
      });
    }

    if (fieldNotesElements.copy) {
      fieldNotesElements.copy.addEventListener('pointerdown', handleFieldNotesPointerDown, {
        passive: true,
      });
      fieldNotesElements.copy.addEventListener('pointerup', handleFieldNotesPointerUp);
      fieldNotesElements.copy.addEventListener('pointercancel', clearFieldNotesPointerTracking);
      fieldNotesElements.copy.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          clearFieldNotesPointerTracking();
        }
      });
    }
  }

  function notifyAutoAnchorUsed(currentPlaced, totalAnchors) {
    if (!Number.isFinite(currentPlaced)) {
      return;
    }
    const normalizedTotal = Number.isFinite(totalAnchors)
      ? Math.max(0, totalAnchors)
      : Math.max(0, currentPlaced);
    const cappedPlaced = Math.max(0, Math.min(currentPlaced, normalizedTotal));
    gameStats.autoAnchorPlacements = Math.max(gameStats.autoAnchorPlacements, cappedPlaced);
    evaluateAchievements();
  }

  function notifyEnemyDefeated() {
    gameStats.enemiesDefeated += 1;
    evaluateAchievements();
  }

  function notifyLevelVictory(levelId) {
    if (isInteractiveLevel(levelId)) {
      gameStats.manualVictories += 1;
    } else {
      gameStats.idleVictories += 1;
    }
    evaluateAchievements();
  }

  function notifyPowderAction() {
    gameStats.powderActions += 1;
    evaluateAchievements();
  }

  function notifyPowderSigils(count) {
    if (!Number.isFinite(count)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(count));
    gameStats.powderSigilsReached = Math.max(gameStats.powderSigilsReached, normalized);
    glyphCurrency = Math.max(glyphCurrency, normalized);
    updateTowerUpgradeGlyphDisplay();
    if (
      activeTowerUpgradeId &&
      towerUpgradeElements.overlay &&
      towerUpgradeElements.overlay.classList.contains('active')
    ) {
      renderTowerUpgradeOverlay(activeTowerUpgradeId, {});
    }
    updateStatusDisplays();
    evaluateAchievements();
  }

  function notifyPowderMultiplier(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    if (value > gameStats.highestPowderMultiplier) {
      gameStats.highestPowderMultiplier = value;
    }
    evaluateAchievements();
  }

  function handlePowderHeightChange(info) {
    if (!info) {
      return;
    }

    const previousGain = powderState.simulatedDuneGain;
    const normalizedHeight = Number.isFinite(info.normalizedHeight)
      ? Math.max(0, Math.min(1, info.normalizedHeight))
      : 0;
    const clampedGain = Number.isFinite(info.duneGain)
      ? Math.max(0, Math.min(powderConfig.simulatedDuneGainMax, info.duneGain))
      : 0;
    const largestGrain = Number.isFinite(info.largestGrain) ? Math.max(0, info.largestGrain) : 0;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const totalNormalized = Number.isFinite(info.totalNormalized)
      ? Math.max(0, info.totalNormalized)
      : normalizedHeight;
    const crestPosition = Number.isFinite(info.crestPosition)
      ? Math.max(0, Math.min(1, info.crestPosition))
      : 1;
    const cellSize = Number.isFinite(info.cellSize)
      ? Math.max(1, info.cellSize)
      : POWDER_CELL_SIZE_PX;
    const rows = Number.isFinite(info.rows) ? Math.max(1, info.rows) : 1;
    const highestNormalizedRaw = Number.isFinite(info.highestNormalized)
      ? Math.max(0, info.highestNormalized)
      : totalNormalized;
    const highestNormalized = Math.max(0, Math.min(1, highestNormalizedRaw));
    const highestDisplay = formatDecimal(Math.max(0, highestNormalizedRaw), 2);

    powderState.simulatedDuneGain = clampedGain;

    if (powderElements.simulationNote) {
      const crestPercent = formatDecimal(normalizedHeight * 100, 1);
      const crestHeight = formatDecimal(powderState.duneHeight + clampedGain, 2);
      const towerPercent = formatDecimal(totalNormalized * 100, 1);
      const grainLabel = largestGrain ? `${largestGrain}×${largestGrain}` : '—';
      powderElements.simulationNote.textContent =
        `Captured crest: ${crestPercent}% full · tower ascent ${towerPercent}% · dune height h = ${crestHeight} · largest grain ${grainLabel}.`;
    }

    if (powderElements.basin) {
      powderElements.basin.style.setProperty('--powder-crest', normalizedHeight.toFixed(3));
    }

    const wallShiftPx = scrollOffset * cellSize;
    if (powderElements.leftWall) {
      powderElements.leftWall.style.transform = `translateY(${wallShiftPx.toFixed(1)}px)`;
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.transform = `translateY(${wallShiftPx.toFixed(1)}px)`;
    }

    const basinHeight = rows * cellSize;
    if (powderElements.crestMarker) {
      const crestOffset = Math.min(basinHeight, crestPosition * basinHeight);
      powderElements.crestMarker.style.transform = `translateY(${crestOffset.toFixed(1)}px)`;
      powderElements.crestMarker.dataset.height = `Crest ${formatDecimal(normalizedHeight, 2)}`;
    }

    const glyphMetrics = updatePowderGlyphColumns({
      scrollOffset,
      rows,
      cellSize,
      highestNormalized: highestNormalizedRaw,
      totalNormalized,
    });

    if (powderElements.wallMarker) {
      const peakOffset = Math.min(basinHeight, (1 - highestNormalized) * basinHeight);
      powderElements.wallMarker.style.transform = `translateY(${peakOffset.toFixed(1)}px)`;
      if (glyphMetrics) {
        const {
          achievedCount,
          nextIndex,
          highestRaw,
          progressFraction,
          remainingToNext,
        } = glyphMetrics;
        const progressPercent = formatDecimal(Math.min(1, progressFraction) * 100, 1);
        const remaining = formatDecimal(Math.max(0, remainingToNext), 2);
        const currentLabel = glyphMetrics.glyphsLit > 0
          ? formatAlephLabel(Math.max(0, achievedCount))
          : 'Base';
        const nextLabel = formatAlephLabel(Math.max(0, nextIndex));
        powderElements.wallMarker.dataset.height = `${currentLabel} · ${progressPercent}% to ${nextLabel} (Δh ${remaining})`;
      } else {
        powderElements.wallMarker.dataset.height = `Peak ${highestDisplay}`;
      }
    }

    if (glyphMetrics) {
      const { glyphsLit, highestRaw, progressFraction } = glyphMetrics;
      updatePowderWallGapFromGlyphs(glyphsLit);
      if (powderElements.leftWall) {
        powderElements.leftWall.classList.toggle('wall-awake', highestRaw > 0);
      }
      if (powderElements.rightWall) {
        powderElements.rightWall.classList.toggle(
          'wall-awake',
          glyphsLit > 0 || progressFraction >= 0.6,
        );
      }

      if (glyphsLit !== powderState.wallGlyphsLit) {
        powderState.wallGlyphsLit = glyphsLit;
        notifyPowderSigils(glyphsLit);
      }
    }

    if (Math.abs(previousGain - clampedGain) > 0.01) {
      refreshPowderSystems();
    }
  }

  function notifyIdleTime(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      return;
    }
    gameStats.idleMillisecondsAccumulated += elapsedMs;
    const minutes = elapsedMs / 60000;
    const achievementsUnlocked = getUnlockedAchievementCount();
    const levelsBeat = getCompletedInteractiveLevelCount();
    const idleMotes = minutes * achievementsUnlocked * levelsBeat;
    if (idleMotes > 0) {
      addIdleMoteBank(idleMotes);
    }
    evaluateAchievements();
  }

  function calculatePowderBonuses() {
    // Stabilizing the sandfall adds an offset term to Ψ(g) = 2.7 · sin(t), yielding steady grain capture.
    const sandBonus = powderState.sandOffset > 0 ? 0.15 + powderState.sandOffset * 0.03 : 0;
    // Surveying dunes raises h inside Δm = log₂(h + 1); dynamic grains extend h beyond the surveyed base.
    const effectiveDuneHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
    const duneBonus = Math.log2(effectiveDuneHeight + 1) * 0.04;

    const baseCrystalProduct = powderConfig.thetaBase * powderConfig.zetaBase;
    const chargedTheta = powderConfig.thetaBase + powderState.charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + powderState.charges * 0.5;
    // Crystal resonance follows Q = √(θ · ζ); stored charges lift both parameters before release.
    const crystalGain = Math.max(
      0,
      Math.sqrt(chargedTheta * chargedZeta) - Math.sqrt(baseCrystalProduct),
    );
    const crystalBonus = crystalGain * 0.05;

    const totalMultiplier = 1 + sandBonus + duneBonus + crystalBonus;

    return { sandBonus, duneBonus, crystalBonus, totalMultiplier };
  }

  function updatePowderStockpileDisplay() {
    if (powderElements.stockpile) {
      powderElements.stockpile.textContent = `${formatGameNumber(
        powderCurrency,
      )} Motes`;
    }
  }

  function triggerPowderBasinPulse() {
    if (!powderElements.basin) {
      return;
    }
    powderElements.basin.classList.remove('powder-basin--pulse');
    if (powderBasinPulseTimer) {
      clearTimeout(powderBasinPulseTimer);
    }
    // Restarting the animation requires a frame to flush styles.
    requestAnimationFrame(() => {
      if (!powderElements.basin) {
        return;
      }
      powderElements.basin.classList.add('powder-basin--pulse');
      powderBasinPulseTimer = setTimeout(() => {
        if (powderElements.basin) {
          powderElements.basin.classList.remove('powder-basin--pulse');
        }
        powderBasinPulseTimer = null;
      }, 900);
    });
  }

  function savePowderCurrency() {
    if (powderSaveHandle) {
      clearTimeout(powderSaveHandle);
      powderSaveHandle = null;
    }
    writeStorageJson(storageKeys.powder, Math.max(0, powderCurrency));
  }

  function schedulePowderSave() {
    if (powderSaveHandle) {
      return;
    }
    powderSaveHandle = setTimeout(() => {
      powderSaveHandle = null;
      savePowderCurrency();
    }, 1500);
  }

  function loadPersistentState() {
    const storedPowder = readStorageJson(storageKeys.powder);
    if (Number.isFinite(storedPowder)) {
      powderCurrency = Math.max(0, storedPowder);
    }

    const storedAudio = readStorageJson(AUDIO_SETTINGS_STORAGE_KEY);
    if (storedAudio) {
      applyStoredAudioSettings(storedAudio);
      syncAudioControlsFromManager();
    }
  }

  function applyPowderGain(amount, context = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const { source = 'tick', minutes = 0, rate = 0 } = context;
    powderCurrency = Math.max(0, powderCurrency + amount);
    updatePowderStockpileDisplay();
    schedulePowderSave();

    if (source === 'offline') {
      recordPowderEvent('offline-reward', { minutes, rate, powder: amount });
      triggerPowderBasinPulse();
    }

    return amount;
  }

  function bindOfflineOverlayElements() {
    offlineOverlayElements.container = document.getElementById('offline-overlay');
    if (!offlineOverlayElements.container) {
      return;
    }
    offlineOverlayElements.minutes = document.getElementById('offline-minutes');
    offlineOverlayElements.rate = document.getElementById('offline-rate');
    offlineOverlayElements.total = document.getElementById('offline-total');
    offlineOverlayElements.prompt = document.getElementById('offline-prompt');

    offlineOverlayElements.container.addEventListener('pointerdown', (event) => {
      if (offlineOverlayAnimating) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      hideOfflineOverlay();
    });

    offlineOverlayElements.container.addEventListener('keydown', (event) => {
      if (offlineOverlayAnimating) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Escape') {
        event.preventDefault();
        hideOfflineOverlay();
      }
    });
  }

  function clearOfflineOverlayPrompt() {
    if (offlineOverlayPromptHandle) {
      clearTimeout(offlineOverlayPromptHandle);
      offlineOverlayPromptHandle = null;
    }
    if (offlineOverlayElements.prompt) {
      offlineOverlayElements.prompt.classList.remove('offline-overlay__prompt--visible');
    }
  }

  function scheduleOfflineOverlayPrompt() {
    if (!offlineOverlayElements.prompt) {
      return;
    }
    if (offlineOverlayPromptHandle) {
      clearTimeout(offlineOverlayPromptHandle);
      offlineOverlayPromptHandle = null;
    }
    offlineOverlayPromptHandle = setTimeout(() => {
      offlineOverlayPromptHandle = null;
      if (
        offlineOverlayElements.prompt &&
        offlineOverlayElements.container &&
        offlineOverlayElements.container.classList.contains('active')
      ) {
        offlineOverlayElements.prompt.classList.add('offline-overlay__prompt--visible');
      }
    }, OFFLINE_PROMPT_DELAY_MS);
  }

  function animateOfflineNumber(element, target, options = {}) {
    if (!element) {
      return Promise.resolve();
    }

    const settings = {
      duration: 720,
      prefix: '',
      suffix: '',
      format: formatGameNumber,
      ...options,
    };

    const finalValue = Math.max(0, target);

    return new Promise((resolve) => {
      const start = performance.now();

      const step = (timestamp) => {
        const elapsed = timestamp - start;
        const progress = Math.min(1, elapsed / settings.duration);
        const eased = 1 - (1 - progress) ** 3;
        const value = progress >= 1 ? finalValue : finalValue * eased;
        element.textContent = `${settings.prefix}${settings.format(value)}${settings.suffix}`;
        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }
        resolve();
      };

      requestAnimationFrame(step);
    });
  }

  async function showOfflineOverlay(minutes, rate, powder) {
    const container = offlineOverlayElements.container;
    if (!container) {
      return;
    }

    if (offlineOverlayFadeHandle) {
      clearTimeout(offlineOverlayFadeHandle);
      offlineOverlayFadeHandle = null;
    }

    offlineOverlayAnimating = true;
    const activeElement = document.activeElement;
    offlineOverlayLastFocus = activeElement instanceof HTMLElement ? activeElement : null;
    container.removeAttribute('hidden');
    container.classList.add('active');
    container.setAttribute('aria-hidden', 'false');

    clearOfflineOverlayPrompt();

    if (typeof container.focus === 'function') {
      container.focus({ preventScroll: true });
    }

    const { minutes: minutesEl, rate: rateEl, total: totalEl } = offlineOverlayElements;
    if (minutesEl) {
      minutesEl.textContent = '0';
    }
    if (rateEl) {
      rateEl.textContent = '0';
    }
    if (totalEl) {
      totalEl.textContent = '0';
    }

    await animateOfflineNumber(minutesEl, minutes, { format: formatWholeNumber });
    await animateOfflineNumber(rateEl, rate, { format: formatGameNumber });
    await animateOfflineNumber(totalEl, powder, { format: formatGameNumber });

    offlineOverlayAnimating = false;
    scheduleOfflineOverlayPrompt();
  }

  function hideOfflineOverlay() {
    const container = offlineOverlayElements.container;
    if (!container) {
      return;
    }
    clearOfflineOverlayPrompt();
    if (offlineOverlayFadeHandle) {
      clearTimeout(offlineOverlayFadeHandle);
      offlineOverlayFadeHandle = null;
    }
    offlineOverlayAnimating = true;
    container.classList.remove('active');
    container.setAttribute('aria-hidden', 'true');
    offlineOverlayFadeHandle = setTimeout(() => {
      container.setAttribute('hidden', '');
      offlineOverlayFadeHandle = null;
      offlineOverlayAnimating = false;
      if (
        offlineOverlayLastFocus &&
        typeof offlineOverlayLastFocus.focus === 'function' &&
        document.contains(offlineOverlayLastFocus)
      ) {
        offlineOverlayLastFocus.focus({ preventScroll: true });
      }
      offlineOverlayLastFocus = null;
    }, OFFLINE_OVERLAY_FADE_MS);
  }

  function checkOfflineRewards() {
    const savedState = readStorageJson(storageKeys.offline);
    if (!savedState?.timestamp) {
      return;
    }

    const lastActive = Number(savedState.timestamp);
    if (!Number.isFinite(lastActive)) {
      return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - lastActive);
    const minutesAway = Math.floor(elapsedMs / 60000);
    if (minutesAway <= 0) {
      return;
    }

    const storedRate = Number(savedState.powderRate);
    const effectiveRate = Number.isFinite(storedRate) ? Math.max(0, storedRate) : resourceState.fluxRate;
    if (effectiveRate <= 0) {
      return;
    }

    const powderEarned = minutesAway * effectiveRate;
    applyPowderGain(powderEarned, { source: 'offline', minutes: minutesAway, rate: effectiveRate });
    notifyIdleTime(minutesAway * 60000);
    showOfflineOverlay(minutesAway, effectiveRate, powderEarned);
  }

  function markLastActive() {
    savePowderCurrency();
    writeStorageJson(storageKeys.offline, {
      timestamp: Date.now(),
      powderRate: resourceState.fluxRate,
    });
  }

  function getCurrentIdleMoteBank() {
    if (powderSimulation && Number.isFinite(powderSimulation.idleBank)) {
      return Math.max(0, powderSimulation.idleBank);
    }
    if (Number.isFinite(powderState.idleMoteBank)) {
      return Math.max(0, powderState.idleMoteBank);
    }
    return 0;
  }

  function getCurrentMoteDispenseRate() {
    if (powderSimulation && Number.isFinite(powderSimulation.idleDrainRate)) {
      powderState.idleDrainRate = powderSimulation.idleDrainRate;
      return Math.max(0, powderSimulation.idleDrainRate);
    }
    if (Number.isFinite(powderState.idleDrainRate)) {
      return Math.max(0, powderState.idleDrainRate);
    }
    return 0;
  }

  function formatMoteDispenseRate(rate) {
    if (!Number.isFinite(rate)) {
      return '0.00 Motes/sec';
    }
    const safeRate = Math.max(0, rate);
    const formatted = safeRate >= 1
      ? (Number.isInteger(safeRate) ? formatWholeNumber(safeRate) : formatDecimal(safeRate, 2))
      : formatDecimal(safeRate, 2);
    const unit = safeRate === 1 ? 'Mote' : 'Motes';
    return `${formatted} ${unit}/sec`;
  }

  function updateMoteStatsDisplays() {
    const storedMotes = getCurrentIdleMoteBank();
    if (resourceElements.moteStorage) {
      resourceElements.moteStorage.textContent = `${formatGameNumber(storedMotes)} Motes`;
    }

    const dispenseRate = getCurrentMoteDispenseRate();
    const dispenseLabel = formatMoteDispenseRate(dispenseRate);
    if (resourceElements.dispenseRate) {
      resourceElements.dispenseRate.textContent = dispenseLabel;
    }
    if (powderElements.dispenseRate) {
      powderElements.dispenseRate.textContent = dispenseLabel;
    }

    if (powderElements.idleMultiplier) {
      const unlocked = getUnlockedAchievementCount();
      const noun = unlocked === 1 ? 'achievement' : 'achievements';
      powderElements.idleMultiplier.textContent = `${formatWholeNumber(unlocked)} ${noun}`;
    }
  }

  function updateStatusDisplays() {
    if (resourceElements.score) {
      const interactive = Boolean(playfield && playfield.isInteractiveLevelActive());
      const theroValue = interactive ? Math.max(0, Math.round(playfield.energy)) : 0;
      resourceElements.score.textContent = `${theroValue} ${THERO_SYMBOL}`;
    }
    const glyphsCollected = Math.max(0, gameStats.enemiesDefeated);
    const glyphsUnused = Math.max(0, glyphsCollected - gameStats.towersPlaced);

    if (resourceElements.scoreMultiplier) {
      const multiplier = glyphsCollected && glyphsUnused ? glyphsCollected * glyphsUnused : 0;
      const display = multiplier ? `×${formatGameNumber(multiplier)}` : '×0';
      resourceElements.scoreMultiplier.textContent = display;
    }
    if (resourceElements.glyphsTotal) {
      resourceElements.glyphsTotal.textContent = `${formatWholeNumber(glyphsCollected)} Glyphs`;
    }
    if (resourceElements.glyphsUnused) {
      resourceElements.glyphsUnused.textContent = `(${formatWholeNumber(glyphsUnused)} unused)`;
    }
    updateMoteStatsDisplays();
  }

  function updateResourceRates() {
    currentPowderBonuses = calculatePowderBonuses();

    resourceState.scoreRate = baseResources.scoreRate * currentPowderBonuses.totalMultiplier;
    const fluxMultiplier = 1 + currentPowderBonuses.sandBonus + currentPowderBonuses.crystalBonus;
    resourceState.fluxRate = baseResources.fluxRate * fluxMultiplier + achievementPowderRate;
    resourceState.energyRate =
      baseResources.energyRate * (1 + currentPowderBonuses.duneBonus + currentPowderBonuses.crystalBonus * 0.5);

    updateStatusDisplays();
  }

  function handleResourceTick(timestamp) {
    if (!resourceTicker) {
      return;
    }

    const activeBeforeUpdate = idleLevelRuns.size;
    updateIdleRuns(timestamp);

    if (!lastResourceTick) {
      lastResourceTick = timestamp;
    }

    const elapsed = Math.max(0, timestamp - lastResourceTick);
    lastResourceTick = timestamp;

    const effectiveIdleCount = activeBeforeUpdate || idleLevelRuns.size;
    if (effectiveIdleCount) {
      notifyIdleTime(elapsed * effectiveIdleCount);
    }

    const powderGain = resourceState.fluxRate * (elapsed / 60000);
    if (powderGain > 0) {
      applyPowderGain(powderGain);
    }

    if (resourceState.running) {
      const seconds = elapsed / 1000;
      resourceState.score += resourceState.scoreRate * seconds;
    }

    updateStatusDisplays();
    resourceTicker = requestAnimationFrame(handleResourceTick);
  }

  function ensureResourceTicker() {
    if (resourceTicker) {
      return;
    }
    lastResourceTick = 0;
    resourceTicker = requestAnimationFrame(handleResourceTick);
  }

  function bindStatusElements() {
    resourceElements.score = document.getElementById('status-score');
    resourceElements.scoreMultiplier = document.getElementById('status-score-multiplier');
    resourceElements.glyphsTotal = document.getElementById('status-glyphs-total');
    resourceElements.glyphsUnused = document.getElementById('status-glyphs-unused');
    resourceElements.moteStorage = document.getElementById('status-mote-storage');
    resourceElements.dispenseRate = document.getElementById('status-dispense-rate');
    updateStatusDisplays();
  }

  function bindPowderControls() {
    powderElements.sandfallFormula = document.getElementById('powder-sandfall-formula');
    powderElements.sandfallNote = document.getElementById('powder-sandfall-note');
    powderElements.sandfallButton = document.querySelector('[data-powder-action="sandfall"]');

    powderElements.duneFormula = document.getElementById('powder-dune-formula');
    powderElements.duneNote = document.getElementById('powder-dune-note');
    powderElements.duneButton = document.querySelector('[data-powder-action="dune"]');

    powderElements.crystalFormula = document.getElementById('powder-crystal-formula');
    powderElements.crystalNote = document.getElementById('powder-crystal-note');
    powderElements.crystalButton = document.querySelector('[data-powder-action="crystal"]');

    powderElements.simulationCanvas = document.getElementById('powder-canvas');
    powderElements.simulationNote = document.getElementById('powder-simulation-note');
    powderElements.basin = document.getElementById('powder-basin');
    powderElements.leftWall = document.getElementById('powder-wall-left');
    powderElements.rightWall = document.getElementById('powder-wall-right');
    powderElements.leftHitbox = document.getElementById('powder-wall-hitbox-left');
    powderElements.rightHitbox = document.getElementById('powder-wall-hitbox-right');
    powderElements.wallMarker = document.getElementById('powder-wall-marker');
    powderElements.crestMarker = document.getElementById('powder-crest-marker');
    powderElements.wallGlyphColumns = Array.from(
      document.querySelectorAll('[data-powder-glyph-column]'),
    );
    powderGlyphColumns.length = 0;
    powderElements.wallGlyphColumns.forEach((columnEl) => {
      if (!columnEl) {
        return;
      }
      columnEl.innerHTML = '';
      powderGlyphColumns.push({ element: columnEl, glyphs: new Map() });
    });
    updatePowderGlyphColumns({
      rows: 1,
      cellSize: POWDER_CELL_SIZE_PX,
      scrollOffset: 0,
      highestNormalized: 0,
      totalNormalized: 0,
    });

    powderElements.totalMultiplier = document.getElementById('powder-total-multiplier');
    powderElements.sandBonusValue = document.getElementById('powder-sand-bonus');
    powderElements.duneBonusValue = document.getElementById('powder-dune-bonus');
    powderElements.crystalBonusValue = document.getElementById('powder-crystal-bonus');
    powderElements.stockpile = document.getElementById('powder-stockpile');
    powderElements.idleMultiplier = document.getElementById('powder-idle-multiplier');
    powderElements.dispenseRate = document.getElementById('powder-dispense-rate');

    powderElements.ledgerBaseScore = document.getElementById('powder-ledger-base-score');
    powderElements.ledgerCurrentScore = document.getElementById('powder-ledger-current-score');
    powderElements.ledgerFlux = document.getElementById('powder-ledger-flux');
    powderElements.ledgerEnergy = document.getElementById('powder-ledger-energy');

    powderElements.sigilEntries = Array.from(
      document.querySelectorAll('[data-sigil-threshold]'),
    );

    powderElements.logList = document.getElementById('powder-log');
    powderElements.logEmpty = document.getElementById('powder-log-empty');
    powderElements.modeToggle = document.getElementById('powder-mode-toggle');

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.addEventListener('click', toggleSandfallStability);
    }

    if (powderElements.duneButton) {
      powderElements.duneButton.addEventListener('click', surveyRidgeHeight);
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.addEventListener('click', chargeCrystalMatrix);
    }

    if (powderElements.modeToggle) {
      powderElements.modeToggle.addEventListener('click', () => {
        handlePowderModeToggle();
      });
      updatePowderModeButton();
    }

    if (powderElements.simulationCanvas && !powderSimulation) {
      const leftInset = powderElements.leftWall
        ? Math.max(68, powderElements.leftWall.offsetWidth)
        : 68;
      const rightInset = powderElements.rightWall
        ? Math.max(68, powderElements.rightWall.offsetWidth)
        : 68;
      powderSimulation = new PowderSimulation({
        canvas: powderElements.simulationCanvas,
        cellSize: POWDER_CELL_SIZE_PX,
        grainSizes: [1, 2, 3],
        scrollThreshold: 0.75,
        wallInsetLeft: leftInset,
        wallInsetRight: rightInset,
        wallGapCells: powderConfig.wallBaseGapMotes,
        maxDuneGain: powderConfig.simulatedDuneGainMax,
        idleDrainRate: powderState.idleDrainRate,
        motePalette: powderState.motePalette,
        onHeightChange: handlePowderHeightChange,
        onWallMetricsChange: handlePowderWallMetricsChange,
      });
      powderState.idleDrainRate = powderSimulation.idleDrainRate;
      powderSimulation.setFlowOffset(powderState.sandOffset);
      powderSimulation.start();
      if (powderBasinObserver && typeof powderBasinObserver.disconnect === 'function') {
        powderBasinObserver.disconnect();
        powderBasinObserver = null;
      }
      if (typeof ResizeObserver === 'function' && powderElements.basin) {
        powderBasinObserver = new ResizeObserver(() => {
          if (powderSimulation) {
            powderSimulation.handleResize();
          }
        });
        powderBasinObserver.observe(powderElements.basin);
      }
      handlePowderHeightChange(powderSimulation.getStatus());
      updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit || 0);
      syncPowderWallVisuals();
      updatePowderHitboxVisibility();
      flushPendingMoteDrops();
    }

    flushPendingMoteDrops();

    updatePowderStockpileDisplay();
    updateMoteStatsDisplays();
    updatePowderModeButton();
  }

  function updatePowderLedger() {
    if (powderElements.ledgerBaseScore) {
      powderElements.ledgerBaseScore.textContent = `${formatGameNumber(
        baseResources.scoreRate,
      )} Σ/s`;
    }

    if (powderElements.ledgerCurrentScore) {
      powderElements.ledgerCurrentScore.textContent = `${formatGameNumber(
        resourceState.scoreRate,
      )} Σ/s`;
    }

    if (powderElements.ledgerFlux) {
      powderElements.ledgerFlux.textContent = `+${formatGameNumber(
        resourceState.fluxRate,
      )} Motes/min`;
    }

    if (powderElements.ledgerEnergy) {
      powderElements.ledgerEnergy.textContent = `+${formatGameNumber(
        resourceState.energyRate,
      )} TD/s`;
    }
  }

  function updatePowderLogDisplay() {
    if (!powderElements.logList || !powderElements.logEmpty) {
      return;
    }

    powderElements.logList.innerHTML = '';

    if (!powderLog.length) {
      powderElements.logList.setAttribute('hidden', '');
      powderElements.logEmpty.hidden = false;
      return;
    }

    powderElements.logList.removeAttribute('hidden');
    powderElements.logEmpty.hidden = true;

    const fragment = document.createDocumentFragment();
    powderLog.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      fragment.append(item);
    });
    powderElements.logList.append(fragment);
  }

  function recordPowderEvent(type, context = {}) {
    let entry = '';

    switch (type) {
      case 'sand-stabilized': {
        entry = `Sandfall stabilized · Mote bonus ${formatSignedPercentage(
          currentPowderBonuses.sandBonus,
        )}.`;
        break;
      }
      case 'sand-released': {
        entry = 'Sandfall released · Flow returns to natural mote drift.';
        break;
      }
      case 'dune-raise': {
        const { height = powderState.duneHeight } = context;
        const logValue = Math.log2(height + 1);
        entry = `Dune surveyed · h = ${height}, Δm = ${formatDecimal(logValue, 2)}.`;
        break;
      }
      case 'dune-max': {
        entry = 'Dune survey halted · Ridge already at maximum elevation.';
        break;
      }
      case 'crystal-charge': {
        const { charges = powderState.charges } = context;
        entry = `Crystal lattice charged (${charges}/3) · Resonance rising.`;
        break;
      }
      case 'crystal-release': {
        const { pulseBonus = 0 } = context;
        entry = `Crystal pulse released · Σ surged ${formatSignedPercentage(pulseBonus)}.`;
        break;
      }
      case 'achievement-unlocked': {
        const { title = 'Achievement' } = context;
        entry = `${title} seal unlocked · +1 Motes/min secured.`;
        break;
      }
      case 'offline-reward': {
        const { minutes = 0, rate = 0, powder = 0 } = context;
        const minutesLabel = formatWholeNumber(minutes);
        entry = `Idle harvest · ${minutesLabel}m × ${formatGameNumber(rate)} = +${formatGameNumber(
          powder,
        )} Motes.`;
        break;
      }
      case 'developer-adjust': {
        const { field = 'value', value = 0 } = context;
        const fieldLabels = {
          'idle-mote-bank': 'Idle mote bank',
          'idle-mote-rate': 'Idle mote fall rate',
          'base-start-thero': 'Base start þ',
          glyphs: 'Glyph reserves',
        };
        const label = fieldLabels[field] || field;
        entry = `Developer adjusted ${label} → ${formatGameNumber(Number(value) || 0)}.`;
        break;
      }
      case 'mode-switch': {
        const { mode = powderState.simulationMode, label } = context;
        const normalizedMode = mode === 'fluid' ? 'fluid' : 'sand';
        const modeLabel =
          normalizedMode === 'fluid'
            ? label || powderState.fluidProfileLabel || 'Fluid Study'
            : 'Powderfall Study';
        entry = `Simulation mode changed · ${modeLabel} engaged.`;
        break;
      }
      default:
        break;
    }

    if (!entry) {
      return;
    }

    powderLog.unshift(entry);
    if (powderLog.length > POWDER_LOG_LIMIT) {
      powderLog.length = POWDER_LOG_LIMIT;
    }
    updatePowderLogDisplay();
  }

  function toggleSandfallStability() {
    powderState.sandOffset =
      powderState.sandOffset > 0
        ? powderConfig.sandOffsetInactive
        : powderConfig.sandOffsetActive;

    if (powderSimulation) {
      powderSimulation.setFlowOffset(powderState.sandOffset);
    }

    refreshPowderSystems();
    recordPowderEvent(powderState.sandOffset > 0 ? 'sand-stabilized' : 'sand-released');
    notifyPowderAction();
  }

  function surveyRidgeHeight() {
    if (powderState.duneHeight >= powderConfig.duneHeightMax) {
      recordPowderEvent('dune-max');
      return;
    }

    powderState.duneHeight += 1;
    refreshPowderSystems();
    recordPowderEvent('dune-raise', { height: powderState.duneHeight });
    notifyPowderAction();
  }

  function chargeCrystalMatrix() {
    if (powderState.charges < 3) {
      powderState.charges += 1;
      refreshPowderSystems();
      recordPowderEvent('crystal-charge', { charges: powderState.charges });
      notifyPowderAction();
      return;
    }

    const pulseBonus = releaseCrystalPulse(powderState.charges);
    powderState.charges = 0;
    refreshPowderSystems(pulseBonus);
    recordPowderEvent('crystal-release', { pulseBonus });
    notifyPowderAction();
  }

  function releaseCrystalPulse(charges) {
    const chargedTheta = powderConfig.thetaBase + charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + charges * 0.5;
    const resonance = Math.sqrt(chargedTheta * chargedZeta);
    const pulseBonus = resonance * 0.008;

    // Each pulse injects a burst of Σ score proportional to the amplified resonance term.
    resourceState.score += resourceState.score * pulseBonus;
    updateStatusDisplays();

    return pulseBonus;
  }

  function refreshPowderSystems(pulseBonus) {
    updateResourceRates();
    updatePowderDisplay(pulseBonus);
  }

  function updatePowderDisplay(pulseBonus) {
    const totalMultiplier = currentPowderBonuses.totalMultiplier;
    notifyPowderMultiplier(totalMultiplier);

    if (powderElements.totalMultiplier) {
      powderElements.totalMultiplier.textContent = `×${formatDecimal(
        totalMultiplier,
        2,
      )}`;
    }

    if (powderElements.sandBonusValue) {
      powderElements.sandBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.sandBonus,
      );
    }

    if (powderElements.duneBonusValue) {
      powderElements.duneBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.duneBonus,
      );
    }

    if (powderElements.crystalBonusValue) {
      powderElements.crystalBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.crystalBonus,
      );
    }

    if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
      let reached = 0;
      powderElements.sigilEntries.forEach((sigil) => {
        const threshold = Number.parseFloat(sigil.dataset.sigilThreshold);
        if (!Number.isFinite(threshold)) {
          return;
        }
        if (totalMultiplier >= threshold) {
          sigil.classList.add('sigil-reached');
          reached += 1;
        } else {
          sigil.classList.remove('sigil-reached');
        }
      });
      notifyPowderSigils(reached);
    } else {
      notifyPowderSigils(0);
    }

    updatePowderLedger();

    if (powderElements.sandfallFormula) {
      const offset = powderState.sandOffset;
      powderElements.sandfallFormula.textContent =
        offset > 0
          ? `\\( \\Psi(g) = 2.7\\, \\sin(t) + ${formatDecimal(offset, 1)} \\)`
          : '\\( \\Psi(g) = 2.7\\, \\sin(t) \\)';
      renderMathElement(powderElements.sandfallFormula);
    }

    if (powderElements.sandfallNote) {
      const bonusText = formatPercentage(currentPowderBonuses.sandBonus);
      powderElements.sandfallNote.textContent =
        powderState.sandOffset > 0
          ? `Flow stabilized—captured grains grant +${bonusText} Motes.`
          : 'Crest is unstable—Motes drift off the board.';
    }

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.textContent =
        powderState.sandOffset > 0 ? 'Release Flow' : 'Stabilize Flow';
    }

    if (powderElements.duneFormula) {
      const height = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      const logValue = Math.log2(height + 1);
      powderElements.duneFormula.textContent = `\\( \\Delta m = \\log_{2}(${formatDecimal(height, 2)} + 1) = ${formatDecimal(
        logValue,
        2,
      )} \\)`;
      renderMathElement(powderElements.duneFormula);
    }

    if (powderElements.duneNote) {
      const crestHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      powderElements.duneNote.textContent = `Channel bonus: +${formatPercentage(
        currentPowderBonuses.duneBonus,
      )} to energy gain · crest h = ${formatDecimal(crestHeight, 2)}.`;
    }

    if (powderElements.duneButton) {
      const reachedMax = powderState.duneHeight >= powderConfig.duneHeightMax;
      powderElements.duneButton.disabled = reachedMax;
      powderElements.duneButton.textContent = reachedMax ? 'Ridge Surveyed' : 'Survey Ridge';
    }

    if (powderElements.crystalFormula) {
      const charges = powderState.charges;
      const theta = powderConfig.thetaBase + charges * 0.6;
      const zeta = powderConfig.zetaBase + charges * 0.5;
      const root = Math.sqrt(theta * zeta);
      powderElements.crystalFormula.textContent = `\\( Q = \\sqrt{${formatDecimal(theta, 2)} \\cdot ${formatDecimal(
        zeta,
        2,
      )}} = ${formatDecimal(root, 2)} \\)`;
      renderMathElement(powderElements.crystalFormula);
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.textContent =
        powderState.charges < 3
          ? `Crystallize (${powderState.charges}/3)`
          : 'Release Pulse';
    }

    if (powderElements.crystalNote) {
      if (typeof pulseBonus === 'number') {
        powderElements.crystalNote.textContent = `Pulse released! Σ score surged by +${formatPercentage(
          pulseBonus,
        )}.`;
      } else if (powderState.charges >= 3) {
        powderElements.crystalNote.textContent = 'Pulse ready—channel the matrix to unleash stored Σ energy.';
      } else if (currentPowderBonuses.crystalBonus <= 0) {
        powderElements.crystalNote.textContent = 'Crystal resonance is idle—no pulse prepared.';
      } else {
        powderElements.crystalNote.textContent = `Stored resonance grants +${formatPercentage(
          currentPowderBonuses.crystalBonus,
        )} to all rates.`;
      }
    }

    updatePowderStockpileDisplay();
  }

  async function init() {
    levelGrid = document.getElementById('level-grid');
    activeLevelEl = document.getElementById('active-level');
    leaveLevelBtn = document.getElementById('leave-level');
    overlay = document.getElementById('level-overlay');
    if (overlay && !overlay.hasAttribute('tabindex')) {
      overlay.setAttribute('tabindex', '-1');
    }
    overlayLabel = document.getElementById('overlay-level');
    overlayTitle = document.getElementById('overlay-title');
    overlayExample = document.getElementById('overlay-example');
    overlayPreview = document.getElementById('overlay-preview');
    overlayMode = document.getElementById('overlay-mode');
    overlayDuration = document.getElementById('overlay-duration');
    overlayRewards = document.getElementById('overlay-rewards');
    overlayLast = document.getElementById('overlay-last');
    overlayInstruction = overlay ? overlay.querySelector('.overlay-instruction') : null;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }

    initializeLevelEditorElements();

    bindColorSchemeButton();
    initializeColorScheme();
    bindAudioControls();

    const towerPanel = document.getElementById('panel-tower');
    const towersPanel = document.getElementById('panel-towers');
    enablePanelWheelScroll(towerPanel);
    enablePanelWheelScroll(towersPanel);

    playfieldElements.container = document.getElementById('playfield');
    playfieldElements.canvas = document.getElementById('playfield-canvas');
    playfieldElements.message = document.getElementById('playfield-message');
    playfieldElements.wave = document.getElementById('playfield-wave');
    playfieldElements.health = document.getElementById('playfield-health');
    playfieldElements.energy = document.getElementById('playfield-energy');
    playfieldElements.progress = document.getElementById('playfield-progress');
    playfieldElements.startButton = document.getElementById('playfield-start');
    playfieldElements.speedButton = document.getElementById('playfield-speed');
    playfieldElements.autoAnchorButton = document.getElementById('playfield-auto');
    playfieldElements.autoWaveCheckbox = document.getElementById('playfield-auto-wave');
    playfieldElements.slots = Array.from(document.querySelectorAll('.tower-slot'));

    loadoutElements.container = document.getElementById('tower-loadout');
    loadoutElements.grid = document.getElementById('tower-loadout-grid');
    loadoutElements.note = document.getElementById('tower-loadout-note');

    mergingLogicElements.card = document.getElementById('merging-logic-card');

    bindTowerUpgradeOverlay();

    initializeTabs();
    initializeFieldNotesOverlay();
    bindCodexControls({
      setActiveTab,
      openFieldNotesOverlay,
      scrollPanelToElement,
      onOpenButtonReady: (button) => {
        fieldNotesElements.openButton = button;
      },
    });
    try {
      await ensureGameplayConfigLoaded();
    } catch (error) {
      console.error('Thero Idle failed to load gameplay data', error);
      if (playfieldElements.message) {
        playfieldElements.message.textContent =
          'Unable to load gameplay data—refresh the page to retry.';
      }
      return;
    }

    setMergingLogicUnlocked(mergeProgressState.mergingLogicUnlocked);

    enemyCodexElements.list = document.getElementById('enemy-codex-list');
    enemyCodexElements.empty = document.getElementById('enemy-codex-empty');
    enemyCodexElements.note = document.getElementById('enemy-codex-note');
    bindDeveloperModeToggle();
    bindDeveloperControls();
    if (audioManager) {
      const activationElements = [
        playfieldElements.startButton,
        playfieldElements.speedButton,
        playfieldElements.autoAnchorButton,
        playfieldElements.autoWaveCheckbox,
        playfieldElements.canvas,
        ...playfieldElements.slots,
      ].filter(Boolean);
      audioManager.registerActivationElements(activationElements);
    }

    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = true;
    }

    if (playfieldElements.canvas && playfieldElements.container) {
      playfield = new SimplePlayfield({
        canvas: playfieldElements.canvas,
        container: playfieldElements.container,
        messageEl: playfieldElements.message,
        waveEl: playfieldElements.wave,
        healthEl: playfieldElements.health,
        energyEl: playfieldElements.energy,
        progressEl: playfieldElements.progress,
        startButton: playfieldElements.startButton,
        speedButton: playfieldElements.speedButton,
        autoAnchorButton: playfieldElements.autoAnchorButton,
        autoWaveCheckbox: playfieldElements.autoWaveCheckbox,
        slotButtons: playfieldElements.slots,
        audioManager,
        onVictory: handlePlayfieldVictory,
        onDefeat: handlePlayfieldDefeat,
        onCombatStart: handlePlayfieldCombatStart,
      });
      playfield.draw();
    }

    refreshTabMusic({ restart: true });

    bindOfflineOverlayElements();
    loadPersistentState();

    bindStatusElements();
    bindPowderControls();
    bindAchievements();
    updatePowderLogDisplay();
    updateResourceRates();
    updatePowderDisplay();
    checkOfflineRewards();
    markLastActive();
    ensureResourceTicker();

    injectTowerCardPreviews();
    annotateTowerCardsWithCost();
    updateTowerCardVisibility();
    initializeTowerSelection();
    bindTowerCardUpgradeInteractions();
    syncLoadoutToPlayfield();
    renderEnemyCodex();

    buildLevelCards();
    updateLevelCards();
    bindOverlayEvents();
    bindUpgradeMatrix();
    bindLeaveLevelButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      markLastActive();
      if (audioManager && typeof audioManager.suspendMusic === 'function') {
        audioManager.suspendMusic();
      }
      return;
    }
    if (document.visibilityState === 'visible') {
      if (audioManager && typeof audioManager.resumeSuspendedMusic === 'function') {
        audioManager.resumeSuspendedMusic();
      }
      refreshTabMusic();
      checkOfflineRewards();
      markLastActive();
    }
  });

  window.addEventListener('pagehide', markLastActive);
  window.addEventListener('beforeunload', markLastActive);

  document.addEventListener('keydown', (event) => {
    if (towerUpgradeElements.overlay && towerUpgradeElements.overlay.classList.contains('active')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTowerUpgradeOverlay();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === towerUpgradeElements.overlay) {
        event.preventDefault();
        closeTowerUpgradeOverlay();
        return;
      }
    }

    if (upgradeOverlay && upgradeOverlay.classList.contains('active')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideUpgradeMatrix();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === upgradeOverlay) {
        event.preventDefault();
        hideUpgradeMatrix();
        return;
      }
      if (!overlay || !overlay.classList.contains('active')) {
        return;
      }
    }

    if (!overlay) return;
    const hidden = overlay.getAttribute('aria-hidden');
    const isActive = overlay.classList.contains('active');
    if (hidden !== 'false' && !isActive) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPendingLevel();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      confirmPendingLevel();
    }
  });

  const upgradeNamespace =
    (window.theroIdleUpgrades = window.theroIdleUpgrades || window.glyphDefenseUpgrades || {});
  upgradeNamespace.alephChain = {
    get: getAlephChainUpgrades,
    set: updateAlephChainUpgrades,
  };

  window.glyphDefenseUpgrades = upgradeNamespace;

})();
