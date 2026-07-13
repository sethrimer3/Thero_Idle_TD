/**
 * Aleph Null chain management utilities.
 *
 * This module centralizes the math for chaining Aleph Null towers so the
 * gameplay loop can scale to mobile-first inputs while remaining portable to
 * a desktop build. It exposes a tiny registry that tracks the order Aleph Null
 * lattices are placed, calculates their squared totals, and provides upgrade
 * hooks for range (x), attack speed (y), and chain length (z).
 */

export const ALEPH_CHAIN_DEFAULT_UPGRADES = Object.freeze({
  /** Range multiplier applied to each Aleph Null chain hop. */
  x: 1.0,
  /** Attack-speed multiplier applied to the base fire rate. */
  y: 1.0,
  /** Number of enemies struck per firing sequence (minimum 1). */
  z: 3,
});

function clampMultiplier(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function normalizeUpgradeSet(upgrades = {}) {
  return {
    x: clampMultiplier(upgrades.x, ALEPH_CHAIN_DEFAULT_UPGRADES.x),
    y: clampMultiplier(upgrades.y, ALEPH_CHAIN_DEFAULT_UPGRADES.y),
    z: Math.max(1, Math.floor(Number.isFinite(upgrades.z) ? upgrades.z : ALEPH_CHAIN_DEFAULT_UPGRADES.z)),
  };
}

function safeSquare(value) {
  if (!Number.isFinite(value)) {
    return Number.MAX_VALUE;
  }
  const result = value * value;
  if (!Number.isFinite(result)) {
    return Number.MAX_VALUE;
  }
  return Math.min(result, Number.MAX_VALUE);
}

class AlephChainRegistry {
  constructor(options = {}) {
    const { upgrades } = options;
    this.upgrades = normalizeUpgradeSet(upgrades);
    this.towerOrder = [];
    this.states = new Map();
  }

  reset() {
    this.towerOrder = [];
    this.states.clear();
  }

  registerTower(towerId, baseDamage) {
    if (!towerId) {
      return null;
    }
    const index = this.towerOrder.findIndex((entry) => entry.id === towerId);
    const normalizedDamage = Number.isFinite(baseDamage) ? baseDamage : 0;
    if (index >= 0) {
      this.towerOrder[index].baseDamage = normalizedDamage;
    } else {
      this.towerOrder.push({ id: towerId, baseDamage: normalizedDamage });
    }
    this.recomputeTotals();
    return this.states.get(towerId) || null;
  }

  unregisterTower(towerId) {
    if (!towerId) {
      return;
    }
    const index = this.towerOrder.findIndex((entry) => entry.id === towerId);
    if (index >= 0) {
      this.towerOrder.splice(index, 1);
      this.recomputeTotals();
    }
  }

  setUpgrades(upgrades = {}) {
    this.upgrades = normalizeUpgradeSet({ ...this.upgrades, ...upgrades });
    this.recomputeTotals();
  }

  getState(towerId) {
    return towerId ? this.states.get(towerId) || null : null;
  }

  getAllStates() {
    return new Map(this.states);
  }

  getRangeMultiplier() {
    return this.upgrades.x;
  }

  getSpeedMultiplier() {
    return this.upgrades.y;
  }

  getLinkCount() {
    return this.upgrades.z;
  }

  recomputeTotals() {
    const nextStates = new Map();
    let previousTotal = null;

    this.towerOrder.forEach((entry, index) => {
      const baseDamage = Number.isFinite(entry.baseDamage) ? entry.baseDamage : 0;
      const totalDamage = index === 0 ? baseDamage : safeSquare(previousTotal ?? baseDamage);
      const state = {
        towerId: entry.id,
        index,
        baseDamage,
        totalDamage,
        rangeMultiplier: this.upgrades.x,
        speedMultiplier: this.upgrades.y,
        linkCount: this.upgrades.z,
      };
      nextStates.set(entry.id, state);
      previousTotal = totalDamage;
    });

    this.states = nextStates;
  }
}

export function createAlephChainRegistry(options = {}) {
  return new AlephChainRegistry(options);
}

export { AlephChainRegistry };
