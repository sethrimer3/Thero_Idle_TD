// Manage crafted equipment records and tower socket assignments with persistence helpers.
export const EQUIPMENT_STORAGE_KEY = 'glyph-defense-idle:equipment';

// Local cache of crafted equipment and their tower assignments.
const equipmentState = {
  crafted: new Map(),
  assignmentByEquipment: new Map(),
  assignmentByTower: new Map(),
  listeners: new Set(),
  initialized: false,
};

// Serialize the crafted equipment payload for storage.
function serializeEquipmentState() {
  return {
    crafted: Array.from(equipmentState.crafted.values()),
    assignments: Array.from(equipmentState.assignmentByEquipment.entries()).map(
      ([equipmentId, towerId]) => ({ equipmentId, towerId }),
    ),
  };
}

// Attempt to read the persisted equipment state from localStorage.
function readStoredEquipmentState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored equipment state.', error);
    return null;
  }
}

// Persist the current crafted equipment payload for future sessions.
function writeStoredEquipmentState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(serializeEquipmentState()));
  } catch (error) {
    console.warn('Failed to persist equipment state.', error);
  }
}

// Broadcast state changes to any subscribed listeners and to the DOM event bus.
function notifyEquipmentListeners() {
  const snapshot = getEquipmentStateSnapshot();
  equipmentState.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Failed to notify equipment listener.', error);
    }
  });
  if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
    document.dispatchEvent(
      new CustomEvent('equipment-state-changed', {
        detail: snapshot,
      }),
    );
  }
}

// Normalize crafted equipment entries so downstream UIs receive predictable data.
function normalizeEquipmentEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) {
    return null;
  }
  const name =
    typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name.trim() : 'Equipment';
  const type = typeof entry.type === 'string' ? entry.type.trim() : '';
  const description = '';
  const symbol = typeof entry.symbol === 'string' ? entry.symbol.trim() : '';
  const rarity = typeof entry.rarity === 'string' ? entry.rarity.trim().toLowerCase() : 'common';
  return {
    id,
    name,
    type,
    description,
    symbol,
    rarity,
  };
}

// Apply tower assignments from storage, discarding references to unknown equipment IDs.
function applyStoredAssignments(assignments) {
  equipmentState.assignmentByEquipment.clear();
  equipmentState.assignmentByTower.clear();
  if (!Array.isArray(assignments)) {
    return false;
  }
  let changed = false;
  assignments.forEach((record) => {
    if (!record || typeof record !== 'object') {
      return;
    }
    const equipmentId = typeof record.equipmentId === 'string' ? record.equipmentId.trim() : '';
    const towerId = typeof record.towerId === 'string' ? record.towerId.trim() : '';
    if (!equipmentId || !towerId || !equipmentState.crafted.has(equipmentId)) {
      return;
    }
    equipmentState.assignmentByEquipment.set(equipmentId, towerId);
    equipmentState.assignmentByTower.set(towerId, equipmentId);
    changed = true;
  });
  return changed;
}

// Ensure invalid assignments are purged whenever the crafted list changes.
function reconcileAssignmentsWithCraftedList() {
  let changed = false;
  equipmentState.assignmentByEquipment.forEach((towerId, equipmentId) => {
    if (!equipmentState.crafted.has(equipmentId)) {
      equipmentState.assignmentByEquipment.delete(equipmentId);
      if (towerId) {
        equipmentState.assignmentByTower.delete(towerId);
      }
      changed = true;
    }
  });
  equipmentState.assignmentByTower.forEach((equipmentId, towerId) => {
    if (!equipmentState.crafted.has(equipmentId)) {
      equipmentState.assignmentByTower.delete(towerId);
      changed = true;
    }
  });
  return changed;
}

// Generate a snapshot describing crafted equipment and their tower bindings.
export function getEquipmentStateSnapshot() {
  return {
    crafted: getCraftedEquipment(),
    assignments: Array.from(equipmentState.assignmentByEquipment.entries()).map(
      ([equipmentId, towerId]) => ({ equipmentId, towerId }),
    ),
  };
}

// Initialize the equipment subsystem by hydrating storage and optional seeds.
export function initializeEquipmentState(initialEquipment = []) {
  if (equipmentState.initialized) {
    return;
  }
  equipmentState.initialized = true;

  const stored = readStoredEquipmentState();
  const craftedEntries = new Map();
  const seeds = Array.isArray(initialEquipment) ? initialEquipment : [];
  seeds.forEach((entry) => {
    const normalized = normalizeEquipmentEntry(entry);
    if (normalized) {
      craftedEntries.set(normalized.id, normalized);
    }
  });

  if (stored && Array.isArray(stored.crafted)) {
    stored.crafted.forEach((entry) => {
      const normalized = normalizeEquipmentEntry(entry);
      if (!normalized) {
        return;
      }
      craftedEntries.set(normalized.id, normalized);
    });
  }

  equipmentState.crafted = craftedEntries;
  const applied = applyStoredAssignments(stored?.assignments);
  const reconciled = reconcileAssignmentsWithCraftedList();
  if (craftedEntries.size || applied || reconciled) {
    notifyEquipmentListeners();
  }
}

// Replace the crafted equipment roster with a fresh list.
export function setCraftedEquipment(list, { persist = true } = {}) {
  const entries = Array.isArray(list) ? list : [];
  const craftedEntries = new Map();
  entries.forEach((entry) => {
    const normalized = normalizeEquipmentEntry(entry);
    if (normalized) {
      craftedEntries.set(normalized.id, normalized);
    }
  });
  let changed = equipmentState.crafted.size !== craftedEntries.size;
  if (!changed) {
    equipmentState.crafted.forEach((current, key) => {
      const next = craftedEntries.get(key);
      if (!next) {
        changed = true;
        return;
      }
      if (
        next.name !== current.name ||
        next.type !== current.type ||
        next.description !== current.description ||
        next.symbol !== current.symbol ||
        next.rarity !== current.rarity
      ) {
        changed = true;
      }
    });
  }
  equipmentState.crafted = craftedEntries;
  const assignmentsChanged = reconcileAssignmentsWithCraftedList();
  if (persist) {
    writeStoredEquipmentState();
  }
  if (changed || assignmentsChanged) {
    notifyEquipmentListeners();
  }
}

// Register a single crafted item without rebuilding the entire list.
export function registerCraftedEquipment(entry, { persist = true } = {}) {
  const normalized = normalizeEquipmentEntry(entry);
  if (!normalized) {
    return false;
  }
  const existing = equipmentState.crafted.get(normalized.id);
  equipmentState.crafted.set(normalized.id, normalized);
  const changed =
    !existing ||
    existing.name !== normalized.name ||
    existing.type !== normalized.type ||
    existing.description !== normalized.description ||
    existing.symbol !== normalized.symbol ||
    existing.rarity !== normalized.rarity;
  if (persist) {
    writeStoredEquipmentState();
  }
  if (changed) {
    notifyEquipmentListeners();
  }
  return true;
}

// Return a sorted array of crafted equipment ready for rendering.
export function getCraftedEquipment() {
  return Array.from(equipmentState.crafted.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

// Retrieve a specific crafted equipment record by ID.
export function getEquipmentRecord(equipmentId) {
  const id = typeof equipmentId === 'string' ? equipmentId.trim() : '';
  if (!id) {
    return null;
  }
  const record = equipmentState.crafted.get(id);
  return record ? { ...record } : null;
}

// Query the tower currently socketing the provided equipment ID.
export function getEquipmentAssignment(equipmentId) {
  const id = typeof equipmentId === 'string' ? equipmentId.trim() : '';
  if (!id) {
    return null;
  }
  return equipmentState.assignmentByEquipment.get(id) || null;
}

// Resolve which equipment ID is assigned to a tower.
export function getTowerEquipmentId(towerId) {
  const id = typeof towerId === 'string' ? towerId.trim() : '';
  if (!id) {
    return null;
  }
  return equipmentState.assignmentByTower.get(id) || null;
}

// Convenience wrapper returning the full equipment record for a tower slot.
export function getTowerEquipment(towerId) {
  const equipmentId = getTowerEquipmentId(towerId);
  if (!equipmentId) {
    return null;
  }
  return getEquipmentRecord(equipmentId);
}

// Assign an equipment record to a tower, automatically clearing conflicting sockets.
export function assignEquipmentToTower(equipmentId, towerId, { persist = true } = {}) {
  const id = typeof equipmentId === 'string' ? equipmentId.trim() : '';
  if (!id || !equipmentState.crafted.has(id)) {
    return false;
  }
  const targetTower = typeof towerId === 'string' && towerId.trim().length > 0 ? towerId.trim() : null;
  const previousTower = equipmentState.assignmentByEquipment.get(id) || null;
  const currentEquipmentOnTower = targetTower ? equipmentState.assignmentByTower.get(targetTower) || null : null;

  if (previousTower === targetTower && currentEquipmentOnTower === id) {
    return false;
  }

  if (previousTower) {
    equipmentState.assignmentByEquipment.delete(id);
    equipmentState.assignmentByTower.delete(previousTower);
  }

  if (targetTower) {
    if (currentEquipmentOnTower && currentEquipmentOnTower !== id) {
      equipmentState.assignmentByEquipment.delete(currentEquipmentOnTower);
    }
    equipmentState.assignmentByTower.set(targetTower, id);
    equipmentState.assignmentByEquipment.set(id, targetTower);
  }

  if (persist) {
    writeStoredEquipmentState();
  }
  notifyEquipmentListeners();
  return true;
}

// Remove any equipment currently socketed into the provided tower.
export function clearTowerEquipment(towerId, { persist = true } = {}) {
  const id = typeof towerId === 'string' ? towerId.trim() : '';
  if (!id) {
    return false;
  }
  const equipmentId = equipmentState.assignmentByTower.get(id);
  if (!equipmentId) {
    return false;
  }
  equipmentState.assignmentByTower.delete(id);
  equipmentState.assignmentByEquipment.delete(equipmentId);
  if (persist) {
    writeStoredEquipmentState();
  }
  notifyEquipmentListeners();
  return true;
}

// Subscribe to equipment state changes; returns an unsubscribe callback.
export function addEquipmentListener(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  equipmentState.listeners.add(listener);
  try {
    listener(getEquipmentStateSnapshot());
  } catch (error) {
    console.warn('Failed to invoke equipment listener immediately.', error);
  }
  return () => {
    equipmentState.listeners.delete(listener);
  };
}
