/**
 * Shin Fractal Tree — Terrarium Achievement Object
 * 
 * A minimalist, elegant fractal tree that grows incrementally with an ink-like aesthetic.
 * This module integrates the FractalTreeSimulation as a decorative reward object
 * placed in the player's achievements terrarium, not as a combat tower.
 */

import { FractalTreeSimulation } from './fractalTreeSimulation.js';

/**
 * Creates and manages a fractal tree simulation instance for the Shin terrarium object.
 * 
 * @param {Object} config - Configuration object loaded from shinFractalTree.json
 * @param {HTMLCanvasElement} canvas - Canvas element for rendering
 * @returns {Object} Terrarium object interface with update and render methods
 */
export function createShinTower(config, canvas) {
  // Initialize the fractal tree simulation with config
  const simulation = new FractalTreeSimulation({
    canvas: canvas,
    branchFactor: config.branchFactor || 2,
    baseSpreadDeg: config.baseSpreadDeg || 25,
    lengthDecay: config.lengthDecay || 0.7,
    maxDepth: config.maxDepth || 9,
    angleJitterDeg: config.angleJitterDeg || 3,
    gravityBend: config.gravityBend || 0.08,
    growthRate: config.growthRate || 3,
    renderStyle: config.renderStyle || 'bezier',
    showLeaves: config.showLeaves || false,
    bgColor: config.bgColor || '#0f1116',
    trunkColor: config.trunkColor || '#e6e6ea',
    twigColor: config.twigColor || '#a2e3f5',
    leafColor: config.leafColor || '#a2e3f5',
    leafAlpha: config.leafAlpha || 0.3,
    baseWidth: config.baseWidth || 8,
    minWidth: config.minWidth || 0.5,
    rootLength: config.rootLength || 80,
    rootX: config.rootX || 0.5,
    rootY: config.rootY || 0.9,
  });

  return {
    simulation,
    
    /**
     * Updates the fractal tree growth animation.
     */
    update() {
      simulation.update();
    },

    /**
     * Renders the current state of the fractal tree.
     */
    render() {
      simulation.render();
    },

    /**
     * Resets the tree to its initial state.
     */
    reset() {
      simulation.reset();
    },

    /**
     * Updates the simulation configuration and resets the tree.
     * 
     * @param {Object} newConfig - New configuration values
     */
    updateConfig(newConfig) {
      simulation.updateConfig(newConfig);
    },

    /**
     * Resizes the canvas and resets the simulation.
     * 
     * @param {number} width - New canvas width
     * @param {number} height - New canvas height
     */
    resize(width, height) {
      simulation.resize(width, height);
    },

    /**
     * Returns true if the tree has finished growing.
     */
    isComplete() {
      return simulation.isComplete;
    }
  };
}

/**
 * Loads the Shin fractal tree terrarium configuration from JSON.
 * 
 * @returns {Promise<Object>} Configuration object
 */
export async function loadShinConfig() {
  try {
    const response = await fetch('/assets/data/shinFractalTree.json');
    if (!response.ok) {
      throw new Error(`Failed to load Shin config: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading Shin configuration:', error);
    // Return default configuration
    return {
      id: 'shin-fractal-tree',
      branchFactor: 2,
      baseSpreadDeg: 25,
      lengthDecay: 0.7,
      maxDepth: 9,
      angleJitterDeg: 3,
      gravityBend: 0.08,
      growthRate: 3,
      renderStyle: 'bezier',
      showLeaves: false,
      bgColor: '#0f1116',
      trunkColor: '#e6e6ea',
      twigColor: '#a2e3f5',
      leafColor: '#a2e3f5',
      leafAlpha: 0.3,
      baseWidth: 8,
      minWidth: 0.5,
      rootLength: 80,
      rootX: 0.5,
      rootY: 0.9,
    };
  }
}
