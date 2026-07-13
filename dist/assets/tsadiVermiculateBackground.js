/**
 * TsadiVermiculateBackground
 *
 * Manages the Tsadi Spire ambient background effect.  Uses the Vermiculate
 * effect (the same visual found in Chapter 1) so that glowing worm-like
 * paths crawl across the viewport, leaving fading trails and bouncing off
 * each other, providing an elegant mathematical ambience behind the
 * particle-fusion simulation.
 *
 * Lifecycle:
 *   - initTsadiVermiculateBackground()  – attach to the panel canvas (call once).
 *   - startTsadiVermiculateBackground() – begin the rAF render loop.
 *   - stopTsadiVermiculateBackground()  – cancel the loop and reset effect state.
 *   - resizeTsadiVermiculateBackground()– resize the canvas to match the panel.
 */

import { createVermiculateEffect } from './playfield/render/VermiculateEffect.js';

// Canvas / context references (resolved from the DOM once).
let _canvas  = null;
let _ctx     = null;

// Effect instance (lazy-created).
let _effect  = null;

// Animation loop state.
let _rafId   = null;
let _running = false;

// ─── Canvas sizing ────────────────────────────────────────────────────────────

/** Resize the canvas to fill the visible tsadi basin. */
function _resizeCanvas() {
  if (!_canvas) return;
  const container = document.getElementById('tsadi-basin');
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
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _effect.update(ts, _canvas.width, _canvas.height);
  _effect.draw(_ctx);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attach the effect to the tsadi vermiculate background canvas.
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export function initTsadiVermiculateBackground() {
  if (_canvas) return; // Already initialized.
  _canvas = document.getElementById('tsadi-vermiculate-bg-canvas');
  if (!_canvas) return;
  _ctx = _canvas.getContext('2d');
  _effect = createVermiculateEffect();
}

/**
 * Start (or resume) the background render loop.
 * Lazily initialises on first call if not yet set up.
 */
export function startTsadiVermiculateBackground() {
  if (!_canvas) initTsadiVermiculateBackground();
  if (!_canvas || _running) return;
  _resizeCanvas();
  _running = true;
  _rafId = requestAnimationFrame(_loop);
}

/**
 * Stop the render loop and reset effect state so re-entry feels fresh.
 */
export function stopTsadiVermiculateBackground() {
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
 * Resize the background canvas to the current tsadi panel dimensions.
 * Call whenever the viewport changes.
 */
export function resizeTsadiVermiculateBackground() {
  _resizeCanvas();
}
