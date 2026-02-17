// Extracted render coordinator that manages the animation frame loop and frame timing.
// Responsibilities:
// - Frame scheduling (requestAnimationFrame management)
// - Frame timing calculations (delta, safeDelta)
// - Performance monitoring integration
// - Frame rate limiting based on user preferences

import {
  beginPerformanceFrame,
  beginPerformanceSegment,
  endPerformanceFrame,
} from '../../performanceMonitor.js';
import { getFrameRateLimit, updateFpsCounter } from '../../preferences.js';

/**
 * Factory function to create a render coordinator that manages the animation loop.
 * @param {Object} config - Configuration object
 * @param {Function} config.update - Update function to call each frame with delta time
 * @param {Function} config.draw - Draw function to call each frame for rendering
 * @param {Function} config.shouldAnimate - Function that returns whether animation should continue
 * @returns {Object} Render coordinator API
 */
export function createRenderCoordinator(config) {
  // Validate required configuration
  if (typeof config.update !== 'function') {
    throw new Error('RenderCoordinator requires an update function');
  }
  if (typeof config.draw !== 'function') {
    throw new Error('RenderCoordinator requires a draw function');
  }
  if (typeof config.shouldAnimate !== 'function') {
    throw new Error('RenderCoordinator requires a shouldAnimate function');
  }

  // Internal state
  let animationId = null;
  let lastTimestamp = 0;

  /**
   * Main animation frame tick handler.
   * Calculates delta time, applies frame rate limiting, and calls update/draw.
   */
  function tick(timestamp) {
    if (!config.shouldAnimate()) {
      animationId = null;
      lastTimestamp = 0;
      return;
    }

    // Frame rate limiting: skip frames if running faster than the configured limit.
    const frameRateLimit = getFrameRateLimit();
    const minFrameTime = 1000 / frameRateLimit;
    if (lastTimestamp && timestamp - lastTimestamp < minFrameTime) {
      animationId = requestAnimationFrame(tick);
      return;
    }

    const delta = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    lastTimestamp = timestamp;

    // Cap delta to prevent large time jumps (e.g., from tab being backgrounded)
    const safeDelta = Math.min(delta, 0.12);

    // Wrap the frame lifecycle with performance markers so diagnostics can attribute work.
    beginPerformanceFrame();
    try {
      const finishUpdateSegment = beginPerformanceSegment('update');
      try {
        config.update(safeDelta);
      } finally {
        finishUpdateSegment();
      }
      const finishDrawSegment = beginPerformanceSegment('draw');
      try {
        config.draw();
      } finally {
        finishDrawSegment();
      }
    } finally {
      endPerformanceFrame();
    }

    // Update the FPS counter after the frame completes.
    updateFpsCounter(timestamp);

    animationId = requestAnimationFrame(tick);
  }

  /**
   * Start the render loop if not already running.
   */
  function startRenderLoop() {
    if (animationId || !config.shouldAnimate()) {
      return;
    }
    animationId = requestAnimationFrame(tick);
  }

  /**
   * Stop the render loop and reset timing state.
   */
  function stopRenderLoop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    lastTimestamp = 0;
  }

  /**
   * Check if the render loop is currently active.
   * @returns {boolean} True if animation frame is scheduled
   */
  function isRunning() {
    return animationId !== null;
  }

  /**
   * Get the last calculated delta time (for debugging/diagnostics).
   * @returns {number} Last delta time in seconds
   */
  function getLastDelta() {
    return lastTimestamp ? 0 : 0; // Not tracked persistently in current implementation
  }

  return {
    startRenderLoop,
    stopRenderLoop,
    isRunning,
    getLastDelta,
  };
}
