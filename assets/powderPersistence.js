import { mergeMotePalette as defaultMergeMotePalette } from '../scripts/features/towers/powderTower.js';

/**
 * Create helpers for persisting and restoring the powder basin state.
 *
 * The persistence helpers are intentionally dependency-injected so main.js can
 * provide its mutable powder state container and supporting callbacks without
 * this module importing the entire game orchestrator.
 *
 * @param {Object} options
 * @param {Object} options.powderState - Mutable state container owned by main.js
 * @param {Object} options.powderConfig - Static configuration defaults for the basin
 * @param {Function} [options.mergeMotePalette] - Utility that clones palette definitions
 * @param {Function} [options.applyMindGatePaletteToDom] - Callback that re-applies palette CSS variables
 * @param {Function} [options.updateFluidTabAvailability] - Callback that toggles Fluid tab visibility
 * @param {Function} [options.schedulePowderBasinSave] - Schedules an autosave after restoring state
 * @param {Function} [options.getPowderSimulation] - Returns the active powder simulation instance
 * @param {Function} [options.getFluidSimulation] - Returns the active fluid simulation instance
 * @returns {{ getPowderBasinSnapshot: Function, applyPowderBasinSnapshot: Function }}
 */
export function createPowderPersistence({
  powderState,
  powderConfig,
  mergeMotePalette = defaultMergeMotePalette,
  applyMindGatePaletteToDom,
  updateFluidTabAvailability,
  schedulePowderBasinSave,
  getPowderSimulation,
  getFluidSimulation,
} = {}) {
  if (!powderState || typeof powderState !== 'object') {
    throw new Error('createPowderPersistence requires a powderState object.');
  }
  if (!powderConfig || typeof powderConfig !== 'object') {
    throw new Error('createPowderPersistence requires a powderConfig object.');
  }

  const resolvePowderSimulation =
    typeof getPowderSimulation === 'function' ? getPowderSimulation : () => null;
  const resolveFluidSimulation =
    typeof getFluidSimulation === 'function' ? getFluidSimulation : () => null;
  const mergePalette = typeof mergeMotePalette === 'function' ? mergeMotePalette : defaultMergeMotePalette;
  const applyPaletteToDom = typeof applyMindGatePaletteToDom === 'function' ? applyMindGatePaletteToDom : null;
  const updateFluidTab = typeof updateFluidTabAvailability === 'function' ? updateFluidTabAvailability : null;
  const scheduleBasinSave = typeof schedulePowderBasinSave === 'function' ? schedulePowderBasinSave : null;

  /** Clamp arbitrary numeric input so persistence never records NaN or Infinity. */
  function clampFiniteNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  /** Normalize integer values for storage while enforcing deterministic rounding. */
  function clampFiniteInteger(value, fallback = 0) {
    return Number.isFinite(value) ? Math.round(value) : fallback;
  }

  /** Copy a single mote drop payload into a storage-safe representation. */
  function cloneStoredMoteDrop(drop) {
    if (!drop) {
      return null;
    }
    if (typeof drop === 'object') {
      const size = Math.max(1, clampFiniteInteger(drop.size, 1));
      if (!Number.isFinite(size) || size <= 0) {
        return null;
      }
      const payload = { size };
      if (drop.color && typeof drop.color === 'object') {
        const { r, g, b } = drop.color;
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          payload.color = {
            r: Math.max(0, Math.min(255, Math.round(r))),
            g: Math.max(0, Math.min(255, Math.round(g))),
            b: Math.max(0, Math.min(255, Math.round(b))),
          };
        }
      }
      return payload;
    }
    if (Number.isFinite(drop)) {
      return { size: Math.max(1, Math.round(drop)) };
    }
    return null;
  }

  /** Compose a basin snapshot so autosave can persist mote placement and climb progress. */
  function getPowderBasinSnapshot() {
    const powderSimulation = resolvePowderSimulation() || null;
    const fluidSimulation = resolveFluidSimulation() || null;

    const pendingDrops = Array.isArray(powderState.pendingMoteDrops)
      ? powderState.pendingMoteDrops.map(cloneStoredMoteDrop).filter(Boolean)
      : [];
    const pendingFluidDrops = Array.isArray(powderState.pendingFluidDrops)
      ? powderState.pendingFluidDrops.map(cloneStoredMoteDrop).filter(Boolean)
      : [];
    const palette = mergePalette(powderState.motePalette);

    const liveTransform =
      (powderSimulation && typeof powderSimulation.getViewTransform === 'function'
        ? powderSimulation.getViewTransform()
        : null) || powderState.viewTransform;
    let viewTransform = null;
    if (liveTransform && typeof liveTransform === 'object') {
      const normalizedCenter = liveTransform.normalizedCenter || liveTransform.normalized || {};
      viewTransform = {
        scale: Math.max(0.1, clampFiniteNumber(liveTransform.scale, 1)),
        normalizedCenter: {
          x: clampFiniteNumber(normalizedCenter.x ?? 0.5, 0.5),
          y: clampFiniteNumber(normalizedCenter.y ?? 0.5, 0.5),
        },
      };
    }

    const liveStatus =
      powderSimulation && typeof powderSimulation.getStatus === 'function'
        ? powderSimulation.getStatus()
        : null;
    const fallbackStatus =
      powderState.loadedSimulationState && typeof powderState.loadedSimulationState === 'object'
        ? powderState.loadedSimulationState.heightInfo
        : null;
    const status = liveStatus || fallbackStatus || null;

    const simulationSnapshot =
      powderSimulation && typeof powderSimulation.exportState === 'function'
        ? powderSimulation.exportState()
        : powderState.loadedSimulationState && typeof powderState.loadedSimulationState === 'object'
          ? powderState.loadedSimulationState
          : null;
    const fluidSimulationSnapshot =
      fluidSimulation && typeof fluidSimulation.exportState === 'function'
        ? fluidSimulation.exportState()
        : powderState.loadedFluidState && typeof powderState.loadedFluidState === 'object'
          ? powderState.loadedFluidState
          : null;

    // Calculate current Aleph glyph number from height for accurate restoration.
    const currentGlyphsLit = Number.isFinite(status?.highestNormalized) || Number.isFinite(status?.totalNormalized)
      ? (() => {
          const highestNormalized = Math.max(0, status.highestNormalized ?? status.totalNormalized ?? 0);
          const GLYPH_SPACING_NORMALIZED = 0.5;
          const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
          return highestNormalized >= GLYPH_BASE_NORMALIZED
            ? Math.max(0, Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1)
            : 0;
        })()
      : powderState.wallGlyphsLit;

    const powderSnapshot = {
      sandOffset: Math.max(0, clampFiniteNumber(powderState.sandOffset, powderConfig.sandOffsetActive)),
      duneHeight: Math.max(powderConfig.duneHeightBase, clampFiniteInteger(powderState.duneHeight, powderConfig.duneHeightBase)),
      charges: Math.max(0, clampFiniteInteger(powderState.charges, 0)),
      simulatedDuneGain: Math.max(0, clampFiniteNumber(powderState.simulatedDuneGain, 0)),
      wallGlyphsLit: Math.max(0, Math.max(clampFiniteInteger(powderState.wallGlyphsLit, 0), currentGlyphsLit)),
      glyphsAwarded: Math.max(0, clampFiniteInteger(powderState.glyphsAwarded, 0)),
      fluidGlyphsLit: Math.max(0, clampFiniteInteger(powderState.fluidGlyphsLit, 0)),
      fluidGlyphsAwarded: Math.max(0, clampFiniteInteger(powderState.fluidGlyphsAwarded, 0)),
      idleMoteBank: Math.max(0, clampFiniteNumber(powderState.idleMoteBank, 0)),
      idleDrainRate: Math.max(0, clampFiniteNumber(powderState.idleDrainRate, 0)),
      pendingMoteDrops: pendingDrops,
      fluidIdleBank: Math.max(0, clampFiniteNumber(powderState.fluidIdleBank, 0)),
      fluidIdleDrainRate: Math.max(0, clampFiniteNumber(powderState.fluidIdleDrainRate, 0)),
      pendingFluidDrops,
      motePalette: palette,
      simulationMode: powderState.simulationMode === 'fluid' ? 'fluid' : 'sand',
      wallGapTarget: Number.isFinite(powderState.wallGapTarget)
        ? Math.max(1, Math.round(powderState.wallGapTarget))
        : powderConfig.wallBaseGapMotes,
      modeSwitchPending: Boolean(powderState.modeSwitchPending),
      fluidProfileLabel: typeof powderState.fluidProfileLabel === 'string' ? powderState.fluidProfileLabel : 'Bet Spire',
      fluidUnlocked: Boolean(powderState.fluidUnlocked),
      betHappiness: {
        bank: Math.max(0, clampFiniteNumber(powderState.betHappiness?.bank, 0)),
        producers: {
          slime: Math.max(
            0,
            clampFiniteInteger(
              powderState.betHappiness?.producers?.slime ?? powderState.betHappiness?.producers?.grasshopper,
              0,
            ),
          ),
        },
      },
      // Persist Bet terrarium leveling progress for fractal trees.
      betTerrarium: {
        levelingMode: Boolean(powderState.betTerrarium?.levelingMode),
        celestialBodiesEnabled: Boolean(powderState.betTerrarium?.celestialBodiesEnabled),
        trees: Object.entries(powderState.betTerrarium?.trees || {}).reduce((result, [key, tree]) => {
          const allocated = clampFiniteInteger(tree?.allocated, 0);
          if (allocated >= 0) {
            result[key] = { allocated: Math.max(0, allocated) };
          }
          return result;
        }, {}),
      },
      viewTransform,
      heightInfo: status
        ? {
            normalizedHeight: clampFiniteNumber(status.normalizedHeight, 0),
            duneGain: clampFiniteNumber(status.duneGain, 0),
            totalHeight: Math.max(0, clampFiniteInteger(status.totalHeight ?? 0, 0)),
            highestNormalized: clampFiniteNumber(status.highestNormalized ?? status.totalNormalized ?? 0, 0),
            scrollOffset: Math.max(0, clampFiniteInteger(status.scrollOffset ?? 0, 0)),
            highestTotalHeightCells: Math.max(
              0,
              clampFiniteInteger(status.highestTotalHeightCells ?? status.totalHeight ?? 0, 0),
            ),
          }
        : null,
    };

    return {
      powder: powderSnapshot,
      simulation: simulationSnapshot,
      fluidSimulation: fluidSimulationSnapshot,
    };
  }

  /** Merge a stored basin snapshot back into runtime state during load or resume flows. */
  function applyPowderBasinSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    const base = snapshot.powder || snapshot.state || null;
    if (base && typeof base === 'object') {
      if (Number.isFinite(base.sandOffset)) {
        powderState.sandOffset = Math.max(0, base.sandOffset);
      }
      if (Number.isFinite(base.duneHeight)) {
        powderState.duneHeight = Math.max(powderConfig.duneHeightBase, Math.round(base.duneHeight));
      }
      if (Number.isFinite(base.charges)) {
        powderState.charges = Math.max(0, Math.round(base.charges));
      }
      if (Number.isFinite(base.simulatedDuneGain)) {
        powderState.simulatedDuneGain = Math.max(0, base.simulatedDuneGain);
      }
      if (Number.isFinite(base.wallGlyphsLit)) {
        powderState.wallGlyphsLit = Math.max(0, Math.round(base.wallGlyphsLit));
      }
      if (Number.isFinite(base.glyphsAwarded)) {
        powderState.glyphsAwarded = Math.max(0, Math.round(base.glyphsAwarded));
      }
      if (Number.isFinite(base.fluidGlyphsLit)) {
        powderState.fluidGlyphsLit = Math.max(0, Math.round(base.fluidGlyphsLit));
      }
      if (Number.isFinite(base.fluidGlyphsAwarded)) {
        powderState.fluidGlyphsAwarded = Math.max(0, Math.round(base.fluidGlyphsAwarded));
      }
      if (Number.isFinite(base.idleMoteBank)) {
        powderState.idleMoteBank = Math.max(0, base.idleMoteBank);
        powderState.idleBankHydrated = false;
      }
      if (Number.isFinite(base.idleDrainRate)) {
        powderState.idleDrainRate = Math.max(0, base.idleDrainRate);
      }
      if (Array.isArray(base.pendingMoteDrops)) {
        powderState.pendingMoteDrops = base.pendingMoteDrops.map(cloneStoredMoteDrop).filter(Boolean);
      } else {
        powderState.pendingMoteDrops = [];
      }
      if (Number.isFinite(base.fluidIdleBank)) {
        powderState.fluidIdleBank = Math.max(0, base.fluidIdleBank);
        powderState.fluidBankHydrated = false;
      }
      if (Number.isFinite(base.fluidIdleDrainRate)) {
        powderState.fluidIdleDrainRate = Math.max(0, base.fluidIdleDrainRate);
      }
      if (Array.isArray(base.pendingFluidDrops)) {
        powderState.pendingFluidDrops = base.pendingFluidDrops.map(cloneStoredMoteDrop).filter(Boolean);
      } else {
        powderState.pendingFluidDrops = [];
      }
      if (base.motePalette) {
        powderState.motePalette = mergePalette(base.motePalette);
        if (applyPaletteToDom) {
          applyPaletteToDom(powderState.motePalette);
        }
      }
      if (typeof base.simulationMode === 'string') {
        powderState.simulationMode = base.simulationMode === 'fluid' ? 'fluid' : 'sand';
      }
      if (Number.isFinite(base.wallGapTarget) && base.wallGapTarget > 0) {
        powderState.wallGapTarget = Math.max(1, Math.round(base.wallGapTarget));
      }
      powderState.fluidUnlocked = !!base.fluidUnlocked;
      const incomingHappiness = base.betHappiness || {};
      const happinessState = powderState.betHappiness || { bank: 0, producers: { slime: 0 } };
      happinessState.bank = Math.max(
        0,
        Number.isFinite(incomingHappiness.bank) ? incomingHappiness.bank : happinessState.bank || 0,
      );
      const storedSlimes = incomingHappiness.producers?.slime;
      const legacyGrasshoppers = incomingHappiness.producers?.grasshopper;
      const normalizedSlimes = Number.isFinite(storedSlimes)
        ? Math.max(0, Math.floor(storedSlimes))
        : Number.isFinite(legacyGrasshoppers)
          ? Math.max(0, Math.floor(legacyGrasshoppers))
          : Number.isFinite(happinessState.producers?.slime)
            ? Math.max(0, Math.floor(happinessState.producers.slime))
            : 0;
      happinessState.producers = { ...happinessState.producers, slime: normalizedSlimes };
      powderState.betHappiness = happinessState;
      // Restore Bet terrarium leveling progress for fractal trees.
      const storedTerrarium = base.betTerrarium || {};
      const storedTrees = storedTerrarium.trees && typeof storedTerrarium.trees === 'object' ? storedTerrarium.trees : {};
      powderState.betTerrarium = {
        levelingMode: Boolean(storedTerrarium.levelingMode),
        celestialBodiesEnabled: Boolean(storedTerrarium.celestialBodiesEnabled),
        trees: Object.entries(storedTrees).reduce((result, [key, value]) => {
          const allocated = Number.isFinite(value?.allocated) ? Math.max(0, Math.floor(value.allocated)) : 0;
          result[key] = { allocated };
          return result;
        }, {}),
      };
      if (updateFluidTab) {
        updateFluidTab();
      }
      if (base.viewTransform && typeof base.viewTransform === 'object') {
        const center = base.viewTransform.normalizedCenter || {};
        powderState.viewTransform = {
          scale: Math.max(0.1, clampFiniteNumber(base.viewTransform.scale, 1)),
          normalizedCenter: {
            x: clampFiniteNumber(center.x ?? 0.5, 0.5),
            y: clampFiniteNumber(center.y ?? 0.5, 0.5),
          },
        };
      }
      if (base.heightInfo && typeof base.heightInfo === 'object') {
        if (Number.isFinite(base.heightInfo.duneGain)) {
          powderState.simulatedDuneGain = Math.max(0, base.heightInfo.duneGain);
        }
        if (!powderState.loadedSimulationState) {
          powderState.loadedSimulationState = {};
        }
        powderState.loadedSimulationState.heightInfo = {
          normalizedHeight: Number.isFinite(base.heightInfo.normalizedHeight)
            ? Math.max(0, base.heightInfo.normalizedHeight)
            : 0,
          duneGain: Number.isFinite(base.heightInfo.duneGain) ? Math.max(0, base.heightInfo.duneGain) : 0,
          totalHeight: Number.isFinite(base.heightInfo.totalHeight) ? Math.max(0, base.heightInfo.totalHeight) : 0,
          highestNormalized: Number.isFinite(base.heightInfo.highestNormalized)
            ? Math.max(0, base.heightInfo.highestNormalized)
            : 0,
        };
      }
    }

    const simulationState = snapshot.simulation || snapshot.loadedSimulationState || null;
    if (simulationState && typeof simulationState === 'object') {
      if (
        powderState.loadedSimulationState?.heightInfo &&
        (!simulationState.heightInfo || !Number.isFinite(simulationState.heightInfo.highestNormalized))
      ) {
        simulationState.heightInfo = {
          ...simulationState.heightInfo,
          ...powderState.loadedSimulationState.heightInfo,
        };
      }
      powderState.loadedSimulationState = simulationState;
    }

    const storedFluidState = snapshot.fluidSimulation || snapshot.loadedFluidState || null;
    if (storedFluidState && typeof storedFluidState === 'object') {
      powderState.loadedFluidState = storedFluidState;
    }

    if (scheduleBasinSave) {
      scheduleBasinSave();
    }
  }

  return {
    getPowderBasinSnapshot,
    applyPowderBasinSnapshot,
  };
}
