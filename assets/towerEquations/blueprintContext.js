/**
 * Shared context for tower blueprints.
 * 
 * This module provides a context object that holds helper functions needed by
 * tower blueprints. It avoids circular dependencies by serving as a neutral
 * ground that both towersTab.js and tower blueprint modules can access.
 */

/**
 * Context object that will be populated with helper functions from towersTab.js.
 * Tower blueprints will access these functions through this context.
 */
export const blueprintContext = {
  // These will be set by towersTab.js after module initialization
  deriveGlyphRankFromLevel: null,
  getTowerEquationBlueprint: null,
  ensureTowerUpgradeState: null,
  calculateTowerEquationResult: null,
  getDynamicConnectionCount: null,
};

/**
 * Initialize the blueprint context with helper functions.
 * This should be called from towersTab.js after the helpers are defined.
 */
export function initializeBlueprintContext(helpers) {
  Object.assign(blueprintContext, helpers);
}
