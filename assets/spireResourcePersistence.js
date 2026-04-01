'use strict';

/**
 * Factory that owns serialization and deserialization of advanced spire resource
 * state for the autosave pipeline.  Extracted from main.js to reduce its line
 * count and isolate persistence logic from game orchestration.
 *
 * @param {object} deps
 * @param {object}   deps.spireResourceState     - Mutable spire state container.
 * @param {object}   deps.powderState             - Mutable powder subsystem state.
 * @param {object}   deps.moteGemState            - Mutable mote gem inventory state.
 * @param {Function} deps.getTsadiBindingAgents   - Returns current Tsadi binding agent count.
 * @param {Function} deps.syncTsadiBindingAgents  - Writes a new binding agent count.
 * @param {Function} deps.updateBindingAgentDisplay - Refreshes the Tsadi binding agent HUD.
 * @param {Function} deps.getBetSpireRenderInstance - Returns the active Bet spire render instance.
 * @param {object}   deps.tsadiMoleculeNameGenerator - Name generator for Tsadi molecules.
 * @param {Function} deps.getTowerUpgradeStateSnapshot - Captures tower upgrade variables.
 * @param {Function} deps.applyTowerUpgradeStateSnapshot - Restores tower upgrade variables.
 * @param {Function} deps.getAlephChainUpgrades   - Returns Aleph chain upgrade values.
 * @param {Function} deps.applyAlephChainUpgradeSnapshot - Restores Aleph chain upgrade state.
 * @param {Function} deps.getPlayfield            - Getter for the active playfield instance.
 */
export function createSpireResourcePersistence(deps) {
  const {
    spireResourceState,
    powderState,
    moteGemState,
    getTsadiBindingAgents,
    syncTsadiBindingAgents,
    updateBindingAgentDisplay,
    getBetSpireRenderInstance,
    tsadiMoleculeNameGenerator,
    getTowerUpgradeStateSnapshot,
    applyTowerUpgradeStateSnapshot,
    getAlephChainUpgrades,
    applyAlephChainUpgradeSnapshot,
    getPlayfield,
  } = deps;

  // ── Pure helpers ────────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to a finite non-negative value for persistence payloads.
   * @param {number} value - Raw numeric input from save data.
   * @param {number} fallback - Optional fallback when the input is invalid.
   * @returns {number} Sanitized value.
   */
  function clampPersistedValue(value, fallback = 0) {
    const normalized = Number.isFinite(value) ? value : fallback;
    return Math.max(0, normalized);
  }

  /**
   * Normalize discovered molecule entries so older save payloads that only stored ids still render.
   * @param {Array} molecules - Persisted molecule list.
   * @returns {Array} Sanitized molecule descriptors.
   */
  function normalizePersistedMolecules(molecules) {
    if (!Array.isArray(molecules)) {
      return [];
    }
    return molecules
      .map((entry) => {
        if (!entry) {
          return null;
        }
        if (typeof entry === 'string') {
          return {
            id: entry,
            name: entry,
            tiers: [],
            description: 'Recorded in the Alchemy Codex.',
          };
        }
        if (typeof entry === 'object') {
          const id = entry.id || entry.name || 'molecule';
          const name = typeof entry.name === 'string' ? entry.name : id;
          const tiers = Array.isArray(entry.tiers) ? entry.tiers.filter((tier) => Number.isFinite(tier)) : [];
          const description =
            typeof entry.description === 'string' ? entry.description : 'Recorded in the Alchemy Codex.';
          const particleCount = Number.isFinite(entry.particleCount)
            ? Math.max(0, entry.particleCount)
            : new Set(tiers).size;
          return { ...entry, id, name, tiers, description, particleCount };
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Apply unique randomized names to normalized molecule entries.
   * @param {Array} molecules - Raw persisted molecule descriptors.
   * @returns {Array} Molecule descriptors with guaranteed-unique names.
   */
  function normalizeDiscoveredMolecules(molecules) {
    const normalized = normalizePersistedMolecules(molecules);
    return tsadiMoleculeNameGenerator.normalizeRecipes(normalized);
  }

  // ── Tower upgrade wrappers ─────────────────────────────────────────────

  // Wrapper functions to include alephChainUpgrades in tower upgrade persistence.
  function getTowerUpgradeStateSnapshotWithAleph() {
    const towerSnapshot = getTowerUpgradeStateSnapshot();
    return {
      ...towerSnapshot,
      alephChainUpgrades: getAlephChainUpgrades(),
    };
  }

  function applyTowerUpgradeStateSnapshotWithAleph(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    // Restore tower variable upgrades
    applyTowerUpgradeStateSnapshot(snapshot);
    // Restore alephChainUpgrades if present
    if (snapshot.alephChainUpgrades && typeof snapshot.alephChainUpgrades === 'object') {
      applyAlephChainUpgradeSnapshot(snapshot.alephChainUpgrades, { playfield: getPlayfield() });
    }
  }

  // ── Spire resource snapshot ────────────────────────────────────────────

  /**
   * Compose a persistence-safe snapshot of the advanced spire resource state.
   * @returns {Object} Sanitized spire resource data for autosave.
   */
  function getSpireResourceStateSnapshot() {
    const powderStoryState = spireResourceState.powder || {};
    const fluidStoryState = spireResourceState.fluid || {};
    const lamedState = spireResourceState.lamed || {};
    const tsadiState = spireResourceState.tsadi || {};
    const shinState = spireResourceState.shin || {};
    const kufState = spireResourceState.kuf || {};
    const moteGems = Array.from(moteGemState.inventory.entries()).map(([gemId, record = {}]) => ({
      gemId,
      label: typeof record.label === 'string' ? record.label : gemId,
      total: Number.isFinite(record.total) ? Math.max(0, record.total) : 0,
      count: Number.isFinite(record.count) ? Math.max(0, Math.floor(record.count)) : 0,
    }));

    return {
      powder: {
        unlocked: true,
        storySeen: Boolean(powderStoryState.storySeen),
      },
      fluid: {
        unlocked: Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked),
        storySeen: Boolean(fluidStoryState.storySeen),
        generators: fluidStoryState.generators || {},
        particleFactorMilestone: fluidStoryState.particleFactorMilestone || 100,
        betGlyphsAwarded: fluidStoryState.betGlyphsAwarded || 0,
        particlesByTierAndSize: getBetSpireRenderInstance()?.getParticleStateSnapshot(),
      },
      lamed: {
        unlocked: Boolean(lamedState.unlocked),
        dragLevel: clampPersistedValue(lamedState.dragLevel, 0),
        starMass: Number.isFinite(lamedState.starMass) ? lamedState.starMass : 10,
        storySeen: Boolean(lamedState.storySeen),
        upgrades: {
          starMass: clampPersistedValue(lamedState.upgrades?.starMass, 0),
        },
        stats: {
          totalAbsorptions: clampPersistedValue(lamedState.stats?.totalAbsorptions, 0),
          totalMassGained: clampPersistedValue(lamedState.stats?.totalMassGained, 0),
        },
        simulationSnapshot: lamedState.simulationSnapshot || null,
      },
      tsadi: {
        unlocked: Boolean(tsadiState.unlocked),
        storySeen: Boolean(tsadiState.storySeen),
        bindingAgents: getTsadiBindingAgents(),
        discoveredMolecules: normalizeDiscoveredMolecules(tsadiState.discoveredMolecules),
        stats: {
          totalParticles: clampPersistedValue(tsadiState.stats?.totalParticles, 0),
          totalGlyphs: clampPersistedValue(tsadiState.stats?.totalGlyphs, 0),
          highestTier: clampPersistedValue(tsadiState.stats?.highestTier, 0),
        },
        simulationSnapshot: tsadiState.simulationSnapshot || null,
      },
      shin: {
        unlocked: Boolean(shinState.unlocked),
        storySeen: Boolean(shinState.storySeen),
      },
      kuf: {
        unlocked: Boolean(kufState.unlocked),
        storySeen: Boolean(kufState.storySeen),
      },
      achievements: {
        storySeen: Boolean((spireResourceState.achievements || {}).storySeen),
      },
      moteGems: {
        inventory: moteGems,
        autoCollectUnlocked: Boolean(moteGemState.autoCollectUnlocked),
        autoCollectDelayMs: Number.isFinite(moteGemState.autoCollectDelayMs)
          ? Math.max(0, Math.floor(moteGemState.autoCollectDelayMs))
          : 0,
      },
    };
  }

  /**
   * Hydrate the advanced spire resource state from persisted data while preserving existing references.
   * @param {Object} snapshot - Persisted spire state payload.
   */
  function applySpireResourceStateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    const powderBranch = snapshot.powder || {};
    const fluidBranch = snapshot.fluid || {};
    const lamedBranch = snapshot.lamed || {};
    const tsadiBranch = snapshot.tsadi || {};
    const shinBranch = snapshot.shin || {};
    const kufBranch = snapshot.kuf || {};
    const achievementsBranch = snapshot.achievements || {};
    const moteGemBranch = snapshot.moteGems || {};

    const powderStoryState = spireResourceState.powder || {};
    powderStoryState.storySeen = Boolean(powderBranch.storySeen || powderStoryState.storySeen);
    spireResourceState.powder = powderStoryState;

    const fluidStoryState = spireResourceState.fluid || {};
    fluidStoryState.unlocked = Boolean(fluidBranch.unlocked || fluidStoryState.unlocked);
    fluidStoryState.storySeen = Boolean(fluidBranch.storySeen || fluidStoryState.storySeen);
    fluidStoryState.generators = fluidBranch.generators || fluidStoryState.generators || {};
    fluidStoryState.particleFactorMilestone = fluidBranch.particleFactorMilestone || fluidStoryState.particleFactorMilestone || 100;
    fluidStoryState.betGlyphsAwarded = fluidBranch.betGlyphsAwarded || fluidStoryState.betGlyphsAwarded || 0;
    fluidStoryState.particlesByTierAndSize = fluidBranch.particlesByTierAndSize || fluidStoryState.particlesByTierAndSize || null;
    spireResourceState.fluid = fluidStoryState;
    powderState.fluidUnlocked = Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked);

    const lamedState = spireResourceState.lamed || {};
    lamedState.unlocked = Boolean(lamedBranch.unlocked || lamedState.unlocked);
    lamedState.dragLevel = clampPersistedValue(lamedBranch.dragLevel, lamedState.dragLevel || 0);
    lamedState.starMass = Number.isFinite(lamedBranch.starMass) ? lamedBranch.starMass : lamedState.starMass || 10;
    lamedState.storySeen = Boolean(lamedBranch.storySeen || lamedState.storySeen);
    lamedState.upgrades = {
      ...(lamedState.upgrades || {}),
      starMass: clampPersistedValue(lamedBranch.upgrades?.starMass, lamedState.upgrades?.starMass || 0),
    };
    lamedState.stats = {
      ...(lamedState.stats || {}),
      totalAbsorptions: clampPersistedValue(
        lamedBranch.stats?.totalAbsorptions,
        lamedState.stats?.totalAbsorptions || 0,
      ),
      totalMassGained: clampPersistedValue(lamedBranch.stats?.totalMassGained, lamedState.stats?.totalMassGained || 0),
    };
    lamedState.simulationSnapshot = lamedBranch.simulationSnapshot || lamedState.simulationSnapshot || null;

    const tsadiState = spireResourceState.tsadi || {};
    tsadiState.unlocked = Boolean(tsadiBranch.unlocked || tsadiState.unlocked);
    tsadiState.storySeen = Boolean(tsadiBranch.storySeen || tsadiState.storySeen);
    const bindingStock = clampPersistedValue(tsadiBranch.bindingAgents, getTsadiBindingAgents());
    syncTsadiBindingAgents(bindingStock);
    tsadiState.stats = {
      ...(tsadiState.stats || {}),
      totalParticles: clampPersistedValue(tsadiBranch.stats?.totalParticles, tsadiState.stats?.totalParticles || 0),
      totalGlyphs: clampPersistedValue(tsadiBranch.stats?.totalGlyphs, tsadiState.stats?.totalGlyphs || 0),
      highestTier: clampPersistedValue(tsadiBranch.stats?.highestTier, tsadiState.stats?.highestTier || 0),
    };
    tsadiState.discoveredMolecules = normalizeDiscoveredMolecules(
      tsadiBranch.discoveredMolecules || tsadiState.discoveredMolecules,
    );
    tsadiState.simulationSnapshot = tsadiBranch.simulationSnapshot || tsadiState.simulationSnapshot || null;
    updateBindingAgentDisplay();

    const shinState = spireResourceState.shin || {};
    shinState.unlocked = Boolean(shinBranch.unlocked || shinState.unlocked);
    shinState.storySeen = Boolean(shinBranch.storySeen || shinState.storySeen);

    const kufState = spireResourceState.kuf || {};
    kufState.unlocked = Boolean(kufBranch.unlocked || kufState.unlocked);
    kufState.storySeen = Boolean(kufBranch.storySeen || kufState.storySeen);

    const achievementsState = spireResourceState.achievements || {};
    achievementsState.storySeen = Boolean(achievementsBranch.storySeen || achievementsState.storySeen);
    spireResourceState.achievements = achievementsState;

    moteGemState.inventory.clear();
    if (Array.isArray(moteGemBranch.inventory)) {
      moteGemBranch.inventory.forEach((entry) => {
        const gemId = typeof entry?.gemId === 'string' ? entry.gemId.trim() : '';
        if (!gemId) {
          return;
        }
        moteGemState.inventory.set(gemId, {
          label: typeof entry.label === 'string' && entry.label.trim().length ? entry.label.trim() : gemId,
          total: Number.isFinite(entry.total) ? Math.max(0, entry.total) : 0,
          count: Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count)) : 0,
        });
      });
    }
    moteGemState.autoCollectUnlocked = Boolean(
      moteGemBranch.autoCollectUnlocked || moteGemState.autoCollectUnlocked,
    );
    moteGemState.autoCollectDelayMs = Number.isFinite(moteGemBranch.autoCollectDelayMs)
      ? Math.max(0, Math.floor(moteGemBranch.autoCollectDelayMs))
      : moteGemState.autoCollectDelayMs || 0;
  }

  return {
    clampPersistedValue,
    normalizePersistedMolecules,
    normalizeDiscoveredMolecules,
    getTowerUpgradeStateSnapshotWithAleph,
    applyTowerUpgradeStateSnapshotWithAleph,
    getSpireResourceStateSnapshot,
    applySpireResourceStateSnapshot,
  };
}
