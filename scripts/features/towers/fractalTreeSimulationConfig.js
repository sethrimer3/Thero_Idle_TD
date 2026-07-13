/**
 * Fractal Tree Simulation configuration constants.
 * Extracted from fractalTreeSimulation.js to improve maintainability.
 * 
 * This module contains all the tuning constants and default values
 * for the incremental fractal tree growth simulation.
 */

/**
 * Visual style default values.
 * These control the appearance of the tree branches and leaves.
 */
export const VISUAL_STYLE_DEFAULTS = {
  bgColor: '#0f1116',          // Dark background color
  trunkColor: '#e6e6ea',       // Light ink color for trunk and main branches
  twigColor: '#a2e3f5',        // Soft cyan color for smaller branches/twigs
  leafColor: '#a2e3f5',        // Leaf color (matches twig color by default)
  leafAlpha: 0.3,              // Transparency for leaves (0-1)
  showLeaves: false,           // Whether to show leaves at terminal nodes
  depthColors: null,           // Optional array of colors by depth level
};

/**
 * Growth parameter defaults and constraints.
 * These control how the tree structure develops.
 */
export const GROWTH_PARAMETERS = {
  // Branch factor: number of child branches per parent (2-3)
  branchFactor: {
    default: 2,
    min: 2,
    max: 3,
  },
  // Base spread angle in degrees (5-45)
  baseSpreadDeg: {
    default: 25,
    min: 5,
    max: 45,
  },
  // Length decay: how much shorter child branches are (0.55-0.85)
  lengthDecay: {
    default: 0.7,
    min: 0.55,
    max: 0.85,
  },
  // Maximum depth of tree recursion (6-13)
  maxDepth: {
    default: 9,
    min: 6,
    max: 13,
  },
  // Random angle variation in degrees (0-6)
  angleJitterDeg: {
    default: 3,
    min: 0,
    max: 6,
  },
  // Gravity bend effect strength (0-0.25)
  gravityBend: {
    default: 0.08,
    min: 0,
    max: 0.25,
  },
  // Growth rate: segments added per iteration (1-20)
  growthRate: {
    default: 3,
    min: 1,
    max: 20,
  },
  // Animation speed for segment growth (0.01-0.6)
  growthAnimationSpeed: {
    default: 0.08,
    min: 0.01,
    max: 0.6,
  },
};

/**
 * Rendering style defaults.
 * These control the visual rendering technique and line appearance.
 */
export const RENDERING_DEFAULTS = {
  renderStyle: 'bezier',       // 'straight' or 'bezier' for branch curves
  baseWidth: 8,                // Line width at the base of the tree
  minWidth: 0.5,               // Minimum line width for smallest branches
};

/**
 * Initial tree position and size defaults.
 * These control where the tree starts and its initial dimensions.
 */
export const INITIAL_TREE_DEFAULTS = {
  rootLength: 80,              // Length of the initial root segment
  rootX: 0.5,                  // Horizontal position (0-1, proportion of canvas width)
  rootY: 0.9,                  // Vertical position (0-1, proportion of canvas height)
};

/**
 * Animation effect defaults.
 * These control visual effects during tree growth.
 */
export const ANIMATION_DEFAULTS = {
  haloFrames: 15,              // Duration of halo effect in frames
  enableHalos: true,           // Whether to show halo effects on new growth
};
