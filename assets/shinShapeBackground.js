/**
 * ShinShapeBackground
 *
 * Manages the Shin Spire ambient background effect.  Uses the Substrate
 * crystalline crack effect (the same visual found in Chapter 6) so that
 * elegant city-like geometric lines grow, undraw from the back, and emit
 * tiny white sparks on spawn.  Replaces the previous golden/orange
 * PrologueShapeEffect overlap glow.
 *
 * Lifecycle:
 *   - initShinShapeBackground()  – attach to the panel canvas (call once on first
 *                                   tab visit, or lazily on start).
 *   - startShinShapeBackground() – begin the rAF render loop.
 *   - stopShinShapeBackground()  – cancel the loop and reset effect state.
 *   - resizeShinShapeBackground()– resize the canvas to match the panel.
 */

import { createSubstrateEffect } from './playfield/render/SubstrateEffect.js';
import { getShinVisualSettings } from './shinSpirePreferences.js';

// Canvas / context references (resolved from the DOM once).
let _canvas  = null;
let _ctx     = null;

// Effect instance (lazy-created with Substrate crystalline crack effect).
let _effect  = null;

// Animation loop state.
let _rafId   = null;
let _running = false;

// ─── Frame throttle ───────────────────────────────────────────────────────────
// The substrate background is purely decorative; 30 fps is visually
// indistinguishable from 60 fps but halves the sustained CPU/GPU cost on
// high-refresh-rate displays and lower-end mobile devices.

const _TARGET_FPS         = 30;
const _FRAME_INTERVAL_MS  = 1000 / _TARGET_FPS;
let   _lastRenderTs       = 0;

// ─── Canvas sizing ────────────────────────────────────────────────────────────

/** Resize the canvas to fill the visible shin cardinal viewport. */
function _resizeCanvas() {
  if (!_canvas) return;
  const container = document.getElementById('shin-cardinal-viewport');
  if (!container) return;
  const w = container.clientWidth  || container.offsetWidth  || 400;
  const h = container.clientHeight || container.offsetHeight || 600;
  // Only reallocate backing store when dimensions actually change.
  if (_canvas.width !== w || _canvas.height !== h) {
    _canvas.width  = w;
    _canvas.height = h;
  }
}

// ─── Render loop ─────────────────────────────────────────────────────────────

function _loop(ts) {
  if (!_running) return;
  _rafId = requestAnimationFrame(_loop);
  if (!_ctx || !_canvas || !_canvas.width || !_canvas.height) return;

  // Throttle to _TARGET_FPS – skip rendering frames that arrive too quickly.
  if (ts - _lastRenderTs < _FRAME_INTERVAL_MS) return;
  _lastRenderTs = ts;

  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _effect.update(ts, _canvas.width, _canvas.height);
  _effect.draw(_ctx);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attach the effect to the shin shape background canvas.
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export function initShinShapeBackground() {
  if (_canvas) return; // Already initialised.
  _canvas = document.getElementById('shin-shape-bg-canvas');
  if (!_canvas) return;
  _ctx = _canvas.getContext('2d');
  // Pass the player's chosen graphics quality so the Substrate effect can
  // scale its workload (fewer fronts, less grain deposition) on modest hardware.
  const { graphicsLevel } = getShinVisualSettings();
  _effect = createSubstrateEffect({ quality: graphicsLevel });
}

/**
 * Start (or resume) the background render loop.
 * Lazily initialises on first call if not yet set up.
 */
export function startShinShapeBackground() {
  if (!_canvas) initShinShapeBackground();
  if (!_canvas || _running) return;
  _resizeCanvas();
  _running = true;
  _rafId = requestAnimationFrame(_loop);
}

/**
 * Stop the render loop and reset effect state so re-entry feels fresh.
 */
export function stopShinShapeBackground() {
  _running = false;
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
  if (_effect) {
    _effect.reset();
  }
}

/**
 * Resize the background canvas to the current shin panel dimensions.
 * Call whenever the viewport changes.
 */
export function resizeShinShapeBackground() {
  _resizeCanvas();
}
