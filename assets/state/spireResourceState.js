// Centralized builder for advanced spire resource banks.
const DEFAULT_LAMED_STATE = {
  sparkBank: 0,
  unlocked: false,
  storySeen: false,
  dragLevel: 0,
  starMass: 10,
  upgrades: { starMass: 0 },
  stats: {
    totalAbsorptions: 0,
    totalMassGained: 0,
    starMilestoneReached: 0,
  },
};

const DEFAULT_TSADI_STATE = {
  particleBank: 0,
  unlocked: false,
  storySeen: false,
  bindingAgents: 0,
  discoveredMolecules: [],
  stats: {
    totalParticles: 0,
    totalGlyphs: 0,
    highestTier: 0,
  },
};

const DEFAULT_GENERIC_STATE = {
  unlocked: false,
  storySeen: false,
};

function mergeBranch(base, overrides = {}) {
  return {
    ...base,
    ...overrides,
    upgrades: {
      ...(base.upgrades || {}),
      ...(overrides.upgrades || {}),
    },
    stats: {
      ...(base.stats || {}),
      ...(overrides.stats || {}),
    },
  };
}

/**
 * Produces the shared spire resource container with optional overrides so the
 * playfield can hydrate previously saved state without mutating defaults.
 */
export function createSpireResourceState(overrides = {}) {
  return {
    powder: {
      ...DEFAULT_GENERIC_STATE,
      ...(overrides.powder || {}),
    },
    fluid: {
      ...DEFAULT_GENERIC_STATE,
      ...(overrides.fluid || {}),
    },
    lamed: mergeBranch(DEFAULT_LAMED_STATE, overrides.lamed),
    tsadi: mergeBranch(DEFAULT_TSADI_STATE, overrides.tsadi),
    shin: {
      ...DEFAULT_GENERIC_STATE,
      ...(overrides.shin || {}),
    },
    kuf: {
      ...DEFAULT_GENERIC_STATE,
      ...(overrides.kuf || {}),
    },
  };
}
