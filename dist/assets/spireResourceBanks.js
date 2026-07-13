// Spire resource banking helpers extracted from main.js to keep the orchestration file lean.

/**
 * Factory that provides helper functions for managing glyph currency reconciliation
 * and spire state management. The idle bank concept has been removed in favor of
 * generation-per-minute mechanics handled by spireIdleGeneration.js.
 *
 * @param {Object} options - Dependency injection container.
 * @param {Object} options.spireResourceState - Live state references for each spire.
 * @param {Function} [options.getSpireMenuController] - Lazy getter for the floating spire menu controller.
 * @param {Object} options.powderState - Powder progression state used to reconcile glyph currency.
 * @param {Function} options.calculateInvestedGlyphs - Computes invested glyph totals from tower upgrades.
 * @param {Function} options.setGlyphCurrency - Persists the latest available glyph currency value.
 * @returns {Object} Helper functions for manipulating spire resources.
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
  if (!spireResourceState.fluid) {
    spireResourceState.fluid = {};
  }

  const lamedState = spireResourceState.lamed;
  const tsadiState = spireResourceState.tsadi;

  /**
   * Trigger the spire menu to refresh displayed resource counts if supported.
   */
  function updateSpireMenuCounts() {
    const controller = typeof getSpireMenuController === 'function' ? getSpireMenuController() : null;
    if (controller && typeof controller.updateCounts === 'function') {
      controller.updateCounts();
    }
  }

  function ensureLamedBankSeeded() {
    if (lamedState.unlocked) {
      return;
    }
    lamedState.unlocked = true;
    updateSpireMenuCounts();
  }

  function ensureTsadiBankSeeded() {
    if (tsadiState.unlocked) {
      return;
    }
    tsadiState.unlocked = true;
    updateSpireMenuCounts();
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

  /**
   * Get the current binding agent count for Tsadi spire.
   * @returns {number} Current binding agent count.
   */
  function getTsadiBindingAgents() {
    return Number.isFinite(tsadiState.bindingAgents)
      ? Math.max(0, Math.floor(tsadiState.bindingAgents))
      : 0;
  }

  /**
   * Set the binding agent count for Tsadi spire.
   * @param {number} value - New binding agent count.
   * @returns {number} Normalized binding agent count.
   */
  function setTsadiBindingAgents(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    tsadiState.bindingAgents = normalized;
    updateSpireMenuCounts();
    return normalized;
  }

  return {
    ensureLamedBankSeeded,
    getTsadiBindingAgents,
    setTsadiBindingAgents,
    ensureTsadiBankSeeded,
    reconcileGlyphCurrencyFromState,
  };
}
