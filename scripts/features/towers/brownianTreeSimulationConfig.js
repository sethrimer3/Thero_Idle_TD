/**
 * Brownian Tree Simulation configuration constants.
 * Extracted from brownianTreeSimulation.js to improve maintainability.
 * 
 * This module contains all the tuning constants and default values
 * for the diffusion-limited aggregation (DLA) cluster simulation.
 */

/**
 * Origin position defaults.
 * These control where the initial seed particle is placed.
 */
export const ORIGIN_DEFAULTS = {
  originX: 0.5,                // Horizontal position (0-1, proportion of canvas width)
  originY: 0.5,                // Vertical position (0-1, proportion of canvas height)
};

/**
 * Growth and particle defaults.
 * These control how the brownian tree grows and glows.
 */
export const GROWTH_DEFAULTS = {
  glowRadius: 5,               // Radius of glow effect around each particle (pixels)
  particleLimit: 1800,         // Maximum number of particles in the cluster
  cellSize: 6,                 // Grid cell size for spatial partitioning (pixels)
};

/**
 * Connection animation defaults.
 * These control how new filaments draw outward smoothly from the trunk.
 */
export const CONNECTION_DEFAULTS = {
  connectionGrowthSpeed: 0.12,      // Speed at which connections animate (0-1 per frame)
  connectionSearchRadius: 32,       // Radius to search for nearby particles (pixels)
  maxConnectionNeighbors: 3,        // Maximum number of connections per particle
  pointFlashDuration: 18,           // Duration of flash effect on new particles (frames)
};

/**
 * Walkable mask defaults.
 * These control terrain collision detection if a walkable mask is provided.
 */
export const WALKABLE_MASK_DEFAULTS = {
  walkableScaleX: 1,           // Horizontal scale factor for mask coordinates
  walkableScaleY: 1,           // Vertical scale factor for mask coordinates
};
