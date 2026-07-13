// Centralized builder for advanced spire resource banks.
const DEFAULT_LAMED_STATE = {
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
  // Serialized snapshot of the active gravity simulation so tab switches can resume seamlessly.
  simulationSnapshot: null,
};

const DEFAULT_TSADI_STATE = {
  unlocked: false,
  storySeen: false,
  bindingAgents: 0,
  discoveredMolecules: [],
  stats: {
    totalParticles: 0,
    totalGlyphs: 0,
    highestTier: 0,
  },
  // Serialized snapshot of the particle fusion sandbox for pause/resume flows.
  simulationSnapshot: null,
};

const DEFAULT_GENERIC_STATE = {
  unlocked: false,
  storySeen: false,
};

const DEFAULT_FLUID_STATE = {
  unlocked: false,
  storySeen: false,
  generators: {}, // Particle generators for BET spire upgrade menu
  particleFactorMilestone: 100, // Next milestone for BET glyph awards
  betGlyphsAwarded: 0, // Total BET glyphs awarded from particle factor
  particleFactorExponentBonus: 0, // Nullstone crunches increase the particle factor exponent by tiny increments.
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
    generators: {
      ...(base.generators || {}),
      ...(overrides.generators || {}),
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
    fluid: mergeBranch(DEFAULT_FLUID_STATE, overrides.fluid),
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
