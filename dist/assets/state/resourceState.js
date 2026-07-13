// Factory for creating the paired resource containers that power the HUD.
/**
 * Builds the base resource containers used by the HUD and autosave systems.
 * Explicit dependencies keep the creation logic isolated from main.js so future
 * refactors can import the containers without pulling in the entire main loop.
 */
export function createResourceStateContainers({
  calculateStartingThero,
  baseScoreRate,
  baseEnergyRate,
  baseFluxRate,
  registerResourceContainers,
}) {
  const startingScore = typeof calculateStartingThero === 'function'
    ? calculateStartingThero()
    : 0;

  const baseResources = {
    score: startingScore,
    scoreRate: baseScoreRate,
    energyRate: baseEnergyRate,
    fluxRate: baseFluxRate,
  };

  const resourceState = {
    score: baseResources.score,
    scoreRate: baseResources.scoreRate,
    energyRate: baseResources.energyRate,
    fluxRate: baseResources.fluxRate,
    running: false,
  };

  if (typeof registerResourceContainers === 'function') {
    registerResourceContainers({ baseResources, resourceState });
  }

  return { baseResources, resourceState };
}
