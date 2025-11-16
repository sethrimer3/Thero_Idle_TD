/**
 * Archived Bet Spire implementation stub.
 *
 * The live game is transitioning the Bet Spire into a terrarium simulation,
 * so this file preserves only the original fluid simulation reference while
 * discarding the rest of the Bet-specific UI glue. Future work can wire the
 * terrarium-specific logic around this preserved simulation, or drop it
 * entirely once the new system ships.
 */
import { FluidSimulation } from '../scripts/features/towers/fluidTower.js';

/**
 * Spin up the legacy fluid simulation with minimal defaults.
 *
 * @param {Object} [options] - Optional overrides forwarded to FluidSimulation.
 * @returns {FluidSimulation} Active simulation instance without any of the
 * Bet Spire specific UI scaffolding that previously surrounded it.
 */
export function createOutdatedBetSpireSimulation(options = {}) {
  return new FluidSimulation({
    ...options,
    onHeightChange: typeof options.onHeightChange === 'function'
      ? options.onHeightChange
      : null,
    onIdleBankChange: typeof options.onIdleBankChange === 'function'
      ? options.onIdleBankChange
      : null,
    onWallMetricsChange: typeof options.onWallMetricsChange === 'function'
      ? options.onWallMetricsChange
      : null,
    onViewTransformChange: typeof options.onViewTransformChange === 'function'
      ? options.onViewTransformChange
      : null,
  });
}
