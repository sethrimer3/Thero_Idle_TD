/**
 * ShinShapeBackground
 *
 * Manages a very subtle golden/orange shape-overlap glow ambient effect that
 * renders as the background of the Shin Spire panel.  Uses PrologueShapeEffect
 * with a warm gold-orange palette so the overlapping regions produce a faint
 * luminous texture behind the cardinal-warden canvas and spire content.
 *
 * Lifecycle:
 *   - initShinShapeBackground()  – attach to the panel canvas (call once on first
 *                                   tab visit, or lazily on start).
 *   - startShinShapeBackground() – begin the rAF render loop.
 *   - stopShinShapeBackground()  – cancel the loop and reset effect state.
 *   - resizeShinShapeBackground()– resize the canvas to match the panel.
 */

import { createPrologueShapeEffect } from './playfield/render/PrologueShapeEffect.js';

// Canvas / context references (resolved from the DOM once).
let _canvas  = null;
let _ctx     = null;

// Effect instance (lazy-created with golden-orange palette).
let _effect  = null;

// Animation loop state.
let _rafId   = null;
let _running = false;

// ─── Canvas sizing ────────────────────────────────────────────────────────────

/** Resize the canvas to fill the visible shin panel. */
function _resizeCanvas() {
  if (!_canvas) return;
  const panel = document.getElementById('panel-shin');
  if (!panel) return;
  const w = panel.clientWidth  || panel.offsetWidth  || 400;
  const h = panel.clientHeight || panel.offsetHeight || 600;
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
  // Golden-orange palette: subtle warm glow at intersections only.
  _effect = createPrologueShapeEffect({ glowR: 255, glowG: 175, glowB: 30, glowAlpha: 0.05 });
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
