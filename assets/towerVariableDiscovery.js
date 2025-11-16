/**
 * Tower Variable Discovery Manager
 * --------------------------------
 * Encapsulates the bookkeeping around which equation variables the player has
 * discovered as they unlock towers. The helper mirrors the inline logic that
 * previously lived inside `towersTab.js`, but now exposes a small factory so
 * the Towers tab can inject its existing state buckets without sharing its
 * entire closure scope.
 */
export function createTowerVariableDiscoveryManager(options = {}) {
  const {
    universalVariableLibrary = new Map(),
    discoveredVariables = new Map(),
    discoveredVariableListeners = new Set(),
    getTowerDefinition = () => null,
    getOrderedTowerDefinitions = () => [],
    getTowerOrderIndex = () => new Map(),
    getTowerEquationBlueprint = () => null,
    getDefaultUnlockCollection = () => null,
  } = options;

  if (!discoveredVariables || typeof discoveredVariables.set !== 'function') {
    throw new Error(
      'createTowerVariableDiscoveryManager requires a Map for discoveredVariables.',
    );
  }
  if (
    !discoveredVariableListeners ||
    typeof discoveredVariableListeners.add !== 'function'
  ) {
    throw new Error(
      'createTowerVariableDiscoveryManager requires a Set for discoveredVariableListeners.',
    );
  }

  const variableLibrary =
    universalVariableLibrary instanceof Map
      ? universalVariableLibrary
      : new Map(Array.isArray(universalVariableLibrary) ? universalVariableLibrary : []);

  function normalizeVariableLibraryKey(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  function resolveVariableLookupKey(variable) {
    if (!variable) {
      return null;
    }
    if (typeof variable === 'string') {
      return normalizeVariableLibraryKey(variable);
    }
    const candidates = [variable.libraryKey, variable.key, variable.symbol, variable.equationSymbol];
    for (const candidate of candidates) {
      const normalized = normalizeVariableLibraryKey(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  function getUniversalVariableMetadata(variableOrKey) {
    const lookupKey = resolveVariableLookupKey(variableOrKey);
    if (!lookupKey) {
      return null;
    }
    return variableLibrary.get(lookupKey) || null;
  }

  function buildDiscoveredVariableId(towerId, variable) {
    if (!towerId || !variable) {
      return null;
    }
    const key = typeof variable.key === 'string' && variable.key.trim() ? variable.key.trim() : null;
    if (key) {
      return `${towerId}::${key}`;
    }
    const libraryKey = resolveVariableLookupKey(variable);
    if (libraryKey) {
      return `${towerId}::${libraryKey}`;
    }
    const symbol =
      typeof variable.symbol === 'string' && variable.symbol.trim()
        ? variable.symbol.trim().toLowerCase()
        : null;
    if (symbol) {
      return `${towerId}::${symbol}`;
    }
    return null;
  }

  function createDiscoveredVariableRecord(towerId, variable, variableId) {
    if (!towerId || !variable || !variableId) {
      return null;
    }
    const definition = getTowerDefinition(towerId);
    const universal = getUniversalVariableMetadata(variable);
    const symbol =
      (typeof variable.symbol === 'string' && variable.symbol.trim()) ||
      (typeof variable.equationSymbol === 'string' && variable.equationSymbol.trim()) ||
      (universal?.symbol && typeof universal.symbol === 'string' ? universal.symbol : '') ||
      (typeof variable.key === 'string' && variable.key.trim() ? variable.key.trim().toUpperCase() : '');
    const name =
      (typeof variable.name === 'string' && variable.name.trim()) ||
      (typeof variable.tooltipName === 'string' && variable.tooltipName.trim()) ||
      (universal?.name && typeof universal.name === 'string' ? universal.name : '') ||
      symbol ||
      'Variable';
    const description =
      (typeof variable.description === 'string' && variable.description.trim()) ||
      (typeof variable.tooltipDescription === 'string' && variable.tooltipDescription.trim()) ||
      (universal?.description && typeof universal.description === 'string' ? universal.description : '') ||
      '';
    const units =
      (typeof variable.units === 'string' && variable.units.trim()) ||
      (universal?.units && typeof universal.units === 'string' ? universal.units : null);
    const towerOrderIndex = getTowerOrderIndex();
    return {
      id: variableId,
      towerId,
      towerName:
        typeof definition?.name === 'string' && definition.name.trim()
          ? definition.name.trim()
          : towerId,
      towerSymbol:
        typeof definition?.symbol === 'string' && definition.symbol.trim()
          ? definition.symbol.trim()
          : towerId,
      towerTier: Number.isFinite(definition?.tier) ? definition.tier : null,
      towerOrder: towerOrderIndex?.get(towerId) ?? Number.MAX_SAFE_INTEGER,
      key: typeof variable.key === 'string' && variable.key.trim() ? variable.key.trim() : null,
      libraryKey: resolveVariableLookupKey(variable),
      symbol,
      name,
      description,
      units,
      glyphLabel:
        typeof variable.glyphLabel === 'string' && variable.glyphLabel.trim()
          ? variable.glyphLabel.trim()
          : null,
    };
  }

  function normalizeTowerIdCollection(source) {
    const normalized = new Set();
    const addValue = (value) => {
      if (typeof value !== 'string') {
        return;
      }
      const trimmed = value.trim();
      if (trimmed) {
        normalized.add(trimmed);
      }
    };
    if (!source) {
      return normalized;
    }
    if (source instanceof Set || Array.isArray(source)) {
      source.forEach(addValue);
      return normalized;
    }
    if (typeof source[Symbol.iterator] === 'function') {
      for (const entry of source) {
        addValue(entry);
      }
      return normalized;
    }
    if (typeof source === 'object') {
      Object.keys(source).forEach(addValue);
    }
    return normalized;
  }

  function getDiscoveredVariablesSnapshot() {
    const entries = Array.from(discoveredVariables.values());
    entries.sort((a, b) => {
      if (a.towerOrder !== b.towerOrder) {
        return a.towerOrder - b.towerOrder;
      }
      if (a.towerId !== b.towerId) {
        return a.towerId.localeCompare(b.towerId);
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return entries.map((entry) => ({ ...entry }));
  }

  function notifyDiscoveredVariableListeners() {
    if (!discoveredVariableListeners.size) {
      return;
    }
    const snapshot = getDiscoveredVariablesSnapshot();
    discoveredVariableListeners.forEach((listener) => {
      if (typeof listener !== 'function') {
        return;
      }
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Discovered variable listener failed.', error);
      }
    });
  }

  function discoverTowerVariables(towerId, { notify = true } = {}) {
    if (!towerId) {
      return false;
    }
    const blueprint = getTowerEquationBlueprint(towerId);
    if (!blueprint || !Array.isArray(blueprint.variables)) {
      return false;
    }
    let changed = false;
    blueprint.variables.forEach((variable) => {
      const variableId = buildDiscoveredVariableId(towerId, variable);
      if (!variableId || discoveredVariables.has(variableId)) {
        return;
      }
      const record = createDiscoveredVariableRecord(towerId, variable, variableId);
      if (!record) {
        return;
      }
      discoveredVariables.set(variableId, record);
      changed = true;
    });
    if (changed && notify) {
      notifyDiscoveredVariableListeners();
    }
    return changed;
  }

  function getDiscoveredVariables() {
    return getDiscoveredVariablesSnapshot();
  }

  function addDiscoveredVariablesListener(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    discoveredVariableListeners.add(listener);
    try {
      listener(getDiscoveredVariables());
    } catch (error) {
      console.warn('Discovered variable listener failed during subscription.', error);
    }
    return () => {
      discoveredVariableListeners.delete(listener);
    };
  }

  function initializeDiscoveredVariablesFromUnlocks(unlockCollection) {
    discoveredVariables.clear();
    const unlocked = normalizeTowerIdCollection(unlockCollection);
    if (!unlocked.size) {
      const fallbackCollection = getDefaultUnlockCollection?.();
      if (fallbackCollection instanceof Set) {
        fallbackCollection.forEach((towerId) => {
          if (typeof towerId === 'string' && towerId.trim()) {
            unlocked.add(towerId.trim());
          }
        });
      }
    }
    const orderedDefinitions = (() => {
      const definitions = getOrderedTowerDefinitions?.();
      if (Array.isArray(definitions) && definitions.length) {
        return definitions;
      }
      return [];
    })();

    if (orderedDefinitions.length) {
      orderedDefinitions.forEach((definition) => {
        if (definition?.id && unlocked.has(definition.id)) {
          discoverTowerVariables(definition.id, { notify: false });
        }
      });
    } else if (unlocked.size) {
      unlocked.forEach((towerId) => {
        discoverTowerVariables(towerId, { notify: false });
      });
    }

    notifyDiscoveredVariableListeners();
  }

  return {
    getUniversalVariableMetadata,
    discoverTowerVariables,
    getDiscoveredVariables,
    addDiscoveredVariablesListener,
    initializeDiscoveredVariablesFromUnlocks,
    buildDiscoveredVariableId,
  };
}
