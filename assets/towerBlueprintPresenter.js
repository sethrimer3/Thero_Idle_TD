import { TOWER_EQUATION_BLUEPRINTS } from './towerEquations/index.js';

/**
 * Factory responsible for managing tower equation blueprint access, glyph state,
 * and cached equation math independently of the Towers tab UI.
 */
export function createTowerBlueprintPresenter({
  getTowerDefinition,
  getDynamicContext,
  formatters = {},
} = {}) {
  if (typeof getTowerDefinition !== 'function') {
    throw new Error('createTowerBlueprintPresenter requires getTowerDefinition.');
  }

  const resolveDynamicContext = typeof getDynamicContext === 'function' ? getDynamicContext : () => null;
  const formatWholeNumber = typeof formatters.formatWholeNumber === 'function' ? formatters.formatWholeNumber : (value) => String(value ?? 0);
  const formatDecimal = typeof formatters.formatDecimal === 'function' ? formatters.formatDecimal : (value) => String(value ?? 0);

  const fallbackTowerBlueprints = new Map();
  const towerUpgradeState = new Map();
  const towerEquationCache = new Map();

  /** Provide a consistent fallback blueprint when a tower lacks authored data. */
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

  /** Ensure the glyph investment map exists for the requested tower. */
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

  /** Provide a serializable snapshot of all glyph investments. */
  function getTowerUpgradeStateSnapshot() {
    const snapshot = {};
    towerUpgradeState.forEach((state, towerId) => {
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

  /** Restore glyph investments from a serialized snapshot. */
  function applyTowerUpgradeStateSnapshot(snapshot) {
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

  /** Sum the glyph cost invested across every tower variable. */
  function calculateInvestedGlyphs() {
    let total = 0;
    towerUpgradeState.forEach((state, towerId) => {
      if (!state || !state.variables) {
        return;
      }
      const blueprint = getTowerEquationBlueprint(towerId);
      Object.entries(state.variables).forEach(([variableKey, variableState]) => {
        const levels = Number.isFinite(variableState?.level) ? Math.max(0, variableState.level) : 0;
        if (levels <= 0) {
          return;
        }
        const variable = (blueprint?.variables || []).find((entry) => entry.key === variableKey) || null;
        for (let levelIndex = 0; levelIndex < levels; levelIndex += 1) {
          const cost = calculateTowerVariableUpgradeCost(variable, levelIndex);
          total += Math.max(1, cost);
        }
      });
    });
    return total;
  }

  /** Evaluate the cost progression for a single glyph variable. */
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

  /** Resolve a single blueprint variable value with dependency safeguards. */
  function computeTowerVariableValue(towerId, variableKey, blueprint = null, visited = new Set()) {
    if (!towerId || !variableKey) {
      return 0;
    }
    const effectiveBlueprint = blueprint || getTowerEquationBlueprint(towerId);
    const variable = (effectiveBlueprint?.variables || []).find((entry) => entry.key === variableKey) || null;
    if (!variable) {
      return 0;
    }

    if (variable.reference) {
      const referencedValue = calculateTowerEquationResult(variable.reference, visited);
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
          dynamicContext: resolveDynamicContext(),
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

  /** Evaluate the final blueprint result with memoized recursion protection. */
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

  /** Clear cached equation results so future calls recompute fresh values. */
  function invalidateTowerEquationCache() {
    towerEquationCache.clear();
  }

  return {
    getTowerEquationBlueprint,
    ensureTowerUpgradeState,
    getTowerUpgradeStateSnapshot,
    applyTowerUpgradeStateSnapshot,
    calculateInvestedGlyphs,
    calculateTowerVariableUpgradeCost,
    computeTowerVariableValue,
    calculateTowerEquationResult,
    invalidateTowerEquationCache,
  };
}
