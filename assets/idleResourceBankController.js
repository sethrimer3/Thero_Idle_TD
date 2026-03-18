'use strict';

/**
 * Factory that manages idle resource banks across all spires (Aleph, Bet,
 * Lamed, Tsadi).  Extracted from main.js to reduce its line count and
 * isolate idle-bank bookkeeping from core game orchestration.
 *
 * @param {object} deps
 * @param {object}   deps.powderState             - Shared powder/spire state.
 * @param {Function} deps.getSandSimulation        - Getter; returns Aleph sand simulation.
 * @param {Function} deps.getPowderSimulation      - Getter; returns active powder simulation.
 * @param {Function} deps.getFluidSimulation       - Getter; returns Bet fluid simulation.
 * @param {Function} deps.schedulePowderBasinSave  - Persist powder basin to storage.
 * @param {Function} deps.updateStatusDisplays     - Refresh HUD counters.
 */
export function createIdleResourceBankController(deps) {
  const {
    powderState,
    getSandSimulation,
    getPowderSimulation,
    getFluidSimulation,
    schedulePowderBasinSave,
    updateStatusDisplays,
  } = deps;

  // ── Aleph mote bank ───────────────────────────────────────────────────

  /** Surface the live idle mote bank so developer controls and HUD panels can sync immediately. */
  function getCurrentIdleMoteBank() {
    const sandSimulation = getSandSimulation();
    const powderSimulation = getPowderSimulation();
    if (powderSimulation === sandSimulation && sandSimulation && Number.isFinite(sandSimulation.idleBank)) {
      const bank = Math.max(0, sandSimulation.idleBank);
      powderState.idleMoteBank = bank;
      powderState.idleBankHydrated = true;
      return bank;
    }
    return Math.max(0, powderState.idleMoteBank || 0);
  }

  /** Provide the active mote dispense rate exposed by the current simulation profile or powder state. */
  function getCurrentMoteDispenseRate() {
    const sandSimulation = getSandSimulation();
    const powderSimulation = getPowderSimulation();
    if (powderSimulation === sandSimulation && sandSimulation && Number.isFinite(sandSimulation.idleDrainRate)) {
      if (sandSimulation.spawnEnabled === false) {
        return 0;
      }
      const idleRate = Math.max(0, sandSimulation.idleDrainRate);
      powderState.idleDrainRate = idleRate;

      // Include ambient fall cadence so the HUD matches the visible mote stream, not just bank conversion throughput.
      let ambientRate = 0;
      const ambientCanFlow =
        Number.isFinite(sandSimulation.idleBank) &&
        sandSimulation.idleBank > 1e-6 &&
        Number.isFinite(sandSimulation.flowOffset) &&
        sandSimulation.flowOffset > 0 &&
        idleRate > 0;
      if (ambientCanFlow) {
        const interval =
          typeof sandSimulation.getSpawnInterval === 'function'
            ? sandSimulation.getSpawnInterval()
            : sandSimulation.baseSpawnInterval;
        if (Number.isFinite(interval) && interval > 0) {
          ambientRate = 1000 / Math.max(16, interval);
        }
      }

      return idleRate + ambientRate;
    }
    return Math.max(0, powderState.idleDrainRate || 0);
  }

  // ── Bet fluid bank (stub) ─────────────────────────────────────────────

  function getCurrentFluidDropBank() {
    return 0;
  }

  /**
   * Deduct Scintillae (fluid idle bank) for interactive Bet Spire upgrades.
   * Stub — returns 0 until the Bet idle bank economy is implemented.
   * @param {number} _amount - Ignored while stub.
   * @returns {number} - Actual Scintillae spent (always 0 while stub)
   */
  function spendFluidSerendipity(_amount) {
    return 0;
  }

  function getCurrentFluidDispenseRate() {
    const fluidSimulationInstance = getFluidSimulation();
    if (fluidSimulationInstance && Number.isFinite(fluidSimulationInstance.idleDrainRate)) {
      const rate = Math.max(0, fluidSimulationInstance.idleDrainRate);
      powderState.fluidIdleDrainRate = rate;
      return rate;
    }
    return Math.max(0, powderState.fluidIdleDrainRate || 0);
  }

  // ── Shared add/get/set helpers ────────────────────────────────────────

  function addIdleMoteBank(amount, options = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const target = options && typeof options === 'object' ? options.target : undefined;
    const sandSimulation = getSandSimulation();
    const powderSimulation = getPowderSimulation();
    const fluidSimulationInstance = getFluidSimulation();
    let targetIsFluid;
    if (target === 'bet') {
      targetIsFluid = true;
    } else if (target === 'aleph') {
      targetIsFluid = false;
    } else {
      targetIsFluid =
        powderSimulation === fluidSimulationInstance ||
        (!powderSimulation && powderState.simulationMode === 'fluid');
    }

    const simulationTarget = targetIsFluid ? fluidSimulationInstance : sandSimulation;

    if (simulationTarget && typeof simulationTarget.addIdleMotes === 'function') {
      simulationTarget.addIdleMotes(amount);
      if (!targetIsFluid) {
        powderState.idleMoteBank = Math.max(0, simulationTarget.idleBank);
        powderState.idleBankHydrated = simulationTarget === powderSimulation;
      }
    } else if (!targetIsFluid) {
      const current = Number.isFinite(powderState.idleMoteBank) ? powderState.idleMoteBank : 0;
      powderState.idleMoteBank = Math.max(0, current + amount);
      powderState.idleBankHydrated = false;
    }

    // Persist idle bank adjustments so offline rewards survive tab closures.
    schedulePowderBasinSave();
    updateStatusDisplays();
  }

  // ── Lamed spark bank ──────────────────────────────────────────────────

  function getLamedSparkBank() {
    return Math.max(0, powderState.lamedSparkBank || 0);
  }

  function setLamedSparkBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    powderState.lamedSparkBank = Math.max(0, amount);
    schedulePowderBasinSave();
    return powderState.lamedSparkBank;
  }

  // ── Tsadi particle bank ───────────────────────────────────────────────

  function getTsadiParticleBank() {
    return Math.max(0, powderState.tsadiParticleBank || 0);
  }

  function setTsadiParticleBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    powderState.tsadiParticleBank = Math.max(0, amount);
    schedulePowderBasinSave();
    return powderState.tsadiParticleBank;
  }

  // ── Pending drop flush ────────────────────────────────────────────────

  function flushPendingMoteDrops() {
    const powderSimulation = getPowderSimulation();
    if (!powderSimulation || typeof powderSimulation.queueDrop !== 'function') {
      return;
    }
    const fluidSimulationInstance = getFluidSimulation();
    const isFluid = powderSimulation === fluidSimulationInstance;
    const pendingDrops = isFluid ? powderState.pendingFluidDrops : powderState.pendingMoteDrops;
    if (pendingDrops.length) {
      pendingDrops.forEach((drop) => {
        const sizeValue = Number.isFinite(drop?.size) ? drop.size : drop;
        if (!Number.isFinite(sizeValue)) {
          return;
        }
        const normalized = Math.max(1, Math.round(sizeValue));
        const payload = drop && typeof drop === 'object' && drop.color && typeof drop.color === 'object'
          ? { size: normalized, color: { ...drop.color } }
          : { size: normalized };
        powderSimulation.queueDrop(payload);
      });
      pendingDrops.length = 0;
    }
    const bankKey = isFluid ? 'fluidIdleBank' : 'idleMoteBank';
    const hydratedKey = isFluid ? 'fluidBankHydrated' : 'idleBankHydrated';
    if (!isFluid) {
      const pendingBank = Math.max(0, Number.isFinite(powderState[bankKey]) ? powderState[bankKey] : 0);
      if (pendingBank > 0) {
        const simulationBank = Number.isFinite(powderSimulation.idleBank)
          ? Math.max(0, powderSimulation.idleBank)
          : 0;
        const shouldInject = !powderState[hydratedKey] || Math.abs(simulationBank - pendingBank) > 0.5;
        if (shouldInject) {
          powderSimulation.addIdleMotes(pendingBank);
          powderState[bankKey] = 0;
        } else {
          powderState[bankKey] = simulationBank;
        }
        powderState[hydratedKey] = true;
      }
    }
    // Flushes change the basin layout, so capture them for the next resume.
    schedulePowderBasinSave();
    updateStatusDisplays();
  }

  return {
    getCurrentIdleMoteBank,
    getCurrentMoteDispenseRate,
    getCurrentFluidDropBank,
    spendFluidSerendipity,
    getCurrentFluidDispenseRate,
    addIdleMoteBank,
    getLamedSparkBank,
    setLamedSparkBank,
    getTsadiParticleBank,
    setTsadiParticleBank,
    flushPendingMoteDrops,
  };
}
