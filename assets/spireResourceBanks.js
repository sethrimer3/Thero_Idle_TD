// Spire resource banking helpers extracted from main.js to keep the orchestration file lean.

/**
 * Factory that provides helper functions for managing the individual spire resource banks
 * and reconciling glyph currency derived from powder progression. The returned helpers wrap
 * state mutations with consistent normalization and UI refresh logic so call sites in
 * main.js only need to import a lightweight API surface.
 *
 * @param {Object} options - Dependency injection container.
 * @param {Object} options.spireResourceState - Live state references for each spire.
 * @param {Function} [options.getSpireMenuController] - Lazy getter for the floating spire menu controller.
 * @param {Object} options.powderState - Powder progression state used to reconcile glyph currency.
 * @param {Function} options.calculateInvestedGlyphs - Computes invested glyph totals from tower upgrades.
 * @param {Function} options.setGlyphCurrency - Persists the latest available glyph currency value.
 * @returns {Object} Helper functions for manipulating spire resource banks.
 */
export function createSpireResourceBanks({
  spireResourceState,
  getSpireMenuController,
  powderState,
  calculateInvestedGlyphs,
  setGlyphCurrency,
}) {
  if (!spireResourceState.lamed) {
    spireResourceState.lamed = {};
  }
  if (!spireResourceState.tsadi) {
    spireResourceState.tsadi = {};
  }

  const lamedState = spireResourceState.lamed;
  const tsadiState = spireResourceState.tsadi;

  /**
   * Utility to coerce a numeric input into a non-negative finite value.
   * @param {number} value - Raw numeric value.
   * @returns {number} Normalized value.
   */
  function normalizeBankValue(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  /**
   * Trigger the spire menu to refresh displayed resource counts if supported.
   */
  function updateSpireMenuCounts() {
    const controller = typeof getSpireMenuController === 'function' ? getSpireMenuController() : null;
    if (controller && typeof controller.updateCounts === 'function') {
      controller.updateCounts();
    }
  }

  function getLamedSparkBank() {
    return normalizeBankValue(lamedState.sparkBank);
  }

  function setLamedSparkBank(value) {
    const normalized = normalizeBankValue(value);
    if (normalized === getLamedSparkBank()) {
      return normalized;
    }
    lamedState.sparkBank = normalized;
    updateSpireMenuCounts();
    return normalized;
  }

  function ensureLamedBankSeeded() {
    if (lamedState.unlocked) {
      return;
    }
    lamedState.unlocked = true;
    if (getLamedSparkBank() < 100) {
      setLamedSparkBank(100);
    } else {
      updateSpireMenuCounts();
    }
  }

  function getTsadiParticleBank() {
    return normalizeBankValue(tsadiState.particleBank);
  }

  function setTsadiParticleBank(value) {
    const normalized = normalizeBankValue(value);
    if (normalized === getTsadiParticleBank()) {
      return normalized;
    }
    tsadiState.particleBank = normalized;
    updateSpireMenuCounts();
    return normalized;
  }

  function ensureTsadiBankSeeded() {
    if (tsadiState.unlocked) {
      return;
    }
    tsadiState.unlocked = true;
    if (getTsadiParticleBank() < 100) {
      setTsadiParticleBank(100);
    } else {
      updateSpireMenuCounts();
    }
  }

  function reconcileGlyphCurrencyFromState() {
    const awarded = Number.isFinite(powderState?.glyphsAwarded)
      ? Math.max(0, Math.floor(powderState.glyphsAwarded))
      : 0;
    const invested = Math.max(0, calculateInvestedGlyphs());
    const available = Math.max(0, awarded - invested);
    setGlyphCurrency(available);
    return { awarded, invested, available };
  }

  return {
    getLamedSparkBank,
    setLamedSparkBank,
    ensureLamedBankSeeded,
    getTsadiParticleBank,
    setTsadiParticleBank,
    ensureTsadiBankSeeded,
    reconcileGlyphCurrencyFromState,
  };
}
