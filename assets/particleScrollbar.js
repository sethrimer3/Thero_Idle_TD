// Canvas-based particle scrollbar for mobile touch scrolling on Android.
// Renders a glowing particle "thumb" with orbiting satellite particles along the right edge.
// Holding the thumb expands satellites into a vertical scrollbar track; dragging scrolls the active panel.

import { samplePaletteGradient } from './colorSchemeUtils.js';

// ─── Configuration ────────────────────────────────────────────────────────────

// Diameter (CSS px) of the main thumb particle.
const MAIN_SIZE = 30;

// Satellite diameters in the order they appear outward from the thumb (9 sizes, each used twice).
const SATELLITE_SIZES = [12, 11, 10, 9, 8, 6, 6, 4, 2];

// Total number of satellite particles (2 per size group).
const NUM_SATELLITES = SATELLITE_SIZES.length * 2;

// CSS pixel width of the scrollbar canvas strip.
const CANVAS_CSS_WIDTH = 60;

// Duration in seconds for the expand/collapse transition.
const EXPAND_DURATION = 0.38;

// Pointer movement threshold (CSS px) to distinguish a tap from a drag.
const TAP_THRESHOLD_PX = 9;

// Vertical gap (CSS px) between adjacent satellite centres in linear mode.
const LINEAR_SPACING = 21;

// Padding (CSS px) kept clear at the top and bottom of the scroll track.
const TRACK_PAD = 36;

// Extra orbit radius (CSS px) added to the second copy of each satellite size so paired
// particles sit on distinct rings rather than colliding at the same radius.
const ORBIT_COPY_OFFSET = 3.5;

// Multiplier applied to the particle core radius to determine the outer halo radius.
// A value of 2.6× gives a soft, diffuse bloom that fades smoothly to transparent.
const HALO_RADIUS_MULTIPLIER = 2.6;

// Compression factors for the elliptical swirl orbit.
// Reducing the horizontal axis keeps particles within the narrow canvas strip while
// the vertical axis retains enough depth to look dynamic rather than flat.
const ORBIT_HORIZONTAL_COMPRESSION = 0.6;
const ORBIT_VERTICAL_COMPRESSION = 0.5;

// Instant boost applied to expandProgress when a drag begins without a preceding tap-expand,
// giving immediate visual feedback that the track has activated before the transition finishes.
const DRAG_EXPAND_BOOST = 0.2;

// ─── Module-level state ───────────────────────────────────────────────────────

let canvas = null;
let ctx = null;
let rafHandle = null;
let lastTimestamp = null;

// 0 = fully collapsed (swirling), 1 = fully expanded (linear scrollbar track).
let expandProgress = 0;
let isExpanded = false;

// Pointer-event bookkeeping.
const pointer = {
  active: false,
  id: null,
  startY: 0,
  currentY: 0,
  isDrag: false,
  startScrollRatio: 0,
};

// Current scroll position as a 0–1 ratio.
let scrollRatio = 0;

// The DOM panel that is currently scrollable.
let activePanel = null;

// ─── Satellite definitions ────────────────────────────────────────────────────

// Each entry describes one satellite particle.
// {radius, palettePos, orbitAngle, orbitRadius, orbitSpeed, linearIndex, above}
const satellites = [];

function buildSatellites() {
  satellites.length = 0;
  SATELLITE_SIZES.forEach((size, sizeIndex) => {
    for (let copy = 0; copy < 2; copy++) {
      const globalIndex = sizeIndex * 2 + copy;

      // Distribute palette positions evenly across the full gradient.
      const palettePos = globalIndex / (NUM_SATELLITES - 1);

      // Orbit radius: larger particles orbit closer to the thumb for a denser core cluster.
      const baseOrbitRadius = 12 + (SATELLITE_SIZES.length - sizeIndex) * 2.2;
      const orbitRadius = baseOrbitRadius + copy * ORBIT_COPY_OFFSET;

      // Alternate orbit direction between the two copies of each size.
      const dirSign = copy % 2 === 0 ? 1 : -1;
      const speedMagnitude = 0.55 + (globalIndex % 7) * 0.12;
      const orbitSpeed = speedMagnitude * dirSign;

      // Spread initial angles so particles do not start clumped together.
      const orbitAngle = (Math.PI * 2 * globalIndex) / NUM_SATELLITES;

      satellites.push({
        radius: size / 2,
        palettePos,
        orbitAngle,
        orbitRadius,
        orbitSpeed,
        // In linear mode: position index from the thumb outward (0 = nearest).
        linearIndex: sizeIndex,
        // One copy goes above the thumb, the other below.
        above: copy === 0,
      });
    }
  });
}

// ─── Scroll helpers ───────────────────────────────────────────────────────────

// Prefer the topmost visible scroll container so overlays like Field Notes and upgrade grids
// stay in sync with the particle thumb instead of falling back to the underlying tab panel.
function resolveActiveScrollableElement() {
  const candidates = [
    '.field-notes-page.field-notes-page--active',
    '.field-notes-list-view:not(.field-notes-view--hidden)',
    '.upgrade-matrix-grid',
    '.panel.active',
  ];

  for (const selector of candidates) {
    const elements = Array.from(document.querySelectorAll(selector));
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      if (element.closest('[hidden], [aria-hidden="true"]')) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      return element;
    }
  }

  return null;
}

// Refresh the reference to whichever scrollable surface is currently visible.
function refreshActivePanel() {
  activePanel = resolveActiveScrollableElement();
}

// Calculate the maximum scroll range for the current panel.
function getActivePanelMaxScroll() {
  if (!activePanel) {
    return 0;
  }
  return Math.max(0, activePanel.scrollHeight - activePanel.clientHeight);
}

// Read the current scroll position as a 0–1 ratio.
function readScrollRatio() {
  refreshActivePanel();
  if (!activePanel) {
    return 0;
  }
  const max = getActivePanelMaxScroll();
  if (max <= 1) {
    return 0;
  }
  return Math.min(1, Math.max(0, activePanel.scrollTop / max));
}

// Set the active panel's scroll position using a 0–1 ratio.
function applyScrollRatio(ratio) {
  refreshActivePanel();
  if (!activePanel) {
    return;
  }
  const max = getActivePanelMaxScroll();
  if (max <= 1) {
    return;
  }
  activePanel.scrollTop = ratio * max;
}

// ─── Canvas resize ────────────────────────────────────────────────────────────

function resizeCanvas() {
  if (!canvas || !ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const cssH = window.innerHeight;

  // Update CSS dimensions.
  canvas.style.height = `${cssH}px`;

  // Update physical pixel dimensions and reset the DPR scale transform.
  canvas.width = Math.round(CANVAS_CSS_WIDTH * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

// Draw a single glowing particle at (x, y) with the given CSS-pixel radius, RGB colour, and opacity.
function drawGlowDot(x, y, radius, color, alpha) {
  const { r, g, b } = color;

  // Outer diffuse halo.
  const haloR = radius * HALO_RADIUS_MULTIPLIER;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
  halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
  halo.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.12})`);
  halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // Bright particle core.
  const core = ctx.createRadialGradient(x, y, 0, x, y, radius);
  core.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  core.addColorStop(0.38, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  core.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

// ─── Animation loop ───────────────────────────────────────────────────────────

function frame(timestamp) {
  if (!canvas || !ctx) {
    rafHandle = null;
    return;
  }

  // Cap dt to 50 ms to avoid jumps after tab-switch pauses.
  const dt = lastTimestamp !== null ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0;
  lastTimestamp = timestamp;

  // Advance expand/collapse transition.
  const transitionSpeed = 1 / EXPAND_DURATION;
  if (isExpanded) {
    expandProgress = Math.min(1, expandProgress + transitionSpeed * dt);
  } else {
    expandProgress = Math.max(0, expandProgress - transitionSpeed * dt);
  }

  // Sync scroll ratio from the active panel every frame.
  scrollRatio = readScrollRatio();

  // Advance satellite orbit angles.
  satellites.forEach((sat) => {
    sat.orbitAngle += sat.orbitSpeed * dt;
  });

  const W = CANVAS_CSS_WIDTH;
  const H = window.innerHeight;
  // Horizontal centre of the canvas where the thumb sits.
  const cx = W / 2;

  // Thumb Y in CSS pixels, clamped within the track.
  const trackH = H - TRACK_PAD * 2;
  const thumbY = TRACK_PAD + trackH * scrollRatio;

  // Clear canvas for this frame.
  ctx.clearRect(0, 0, W, H);

  const ep = expandProgress;

  // Faint track line, visible only while (partially) expanded.
  if (ep > 0.02) {
    const lineColor = samplePaletteGradient(0.5);
    ctx.save();
    ctx.globalAlpha = ep * 0.28;
    ctx.strokeStyle = `rgb(${lineColor.r}, ${lineColor.g}, ${lineColor.b})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, TRACK_PAD);
    ctx.lineTo(cx, H - TRACK_PAD);
    ctx.stroke();
    ctx.restore();
  }

  // Draw satellites, blending between orbit and linear positions.
  const thumbColor = samplePaletteGradient(0.5);
  satellites.forEach((sat) => {
    // Elliptical orbit: compress axes to keep the swirl within the narrow canvas strip.
    const orbitX = cx + Math.cos(sat.orbitAngle) * sat.orbitRadius * ORBIT_HORIZONTAL_COMPRESSION;
    const orbitY = thumbY + Math.sin(sat.orbitAngle) * sat.orbitRadius * ORBIT_VERTICAL_COMPRESSION;

    // Linear target: aligned above or below the thumb.
    const offset = (sat.linearIndex + 1) * LINEAR_SPACING;
    const linearY = sat.above ? thumbY - offset : thumbY + offset;

    // Interpolate between orbit and linear positions.
    const x = orbitX + (cx - orbitX) * ep;
    const y = orbitY + (linearY - orbitY) * ep;

    // Skip particles that have scrolled entirely off-canvas.
    if (y < -30 || y > H + 30) {
      return;
    }

    // Blend palette colour toward thumb colour as the scrollbar expands.
    const swirlColor = samplePaletteGradient(sat.palettePos);
    const r = Math.round(swirlColor.r + (thumbColor.r - swirlColor.r) * ep);
    const g = Math.round(swirlColor.g + (thumbColor.g - swirlColor.g) * ep);
    const b = Math.round(swirlColor.b + (thumbColor.b - swirlColor.b) * ep);

    drawGlowDot(x, y, sat.radius, { r, g, b }, 0.88);
  });

  // Draw the main thumb particle on top.
  drawGlowDot(cx, thumbY, MAIN_SIZE / 2, thumbColor, 1.0);

  rafHandle = requestAnimationFrame(frame);
}

// ─── Pointer event handlers ───────────────────────────────────────────────────

function handlePointerDown(event) {
  // Only respond to primary button / first touch.
  if (event.button !== 0 && event.button !== undefined) {
    return;
  }
  event.preventDefault();
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (_) {
    // Pointer capture is best-effort.
  }

  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.startY = event.clientY;
  pointer.currentY = event.clientY;
  pointer.isDrag = false;

  // Expand immediately while the thumb is held so the track behaves like a hold-to-scrub control.
  isExpanded = true;

  // Snapshot scroll position for proportional drag mapping.
  refreshActivePanel();
  pointer.startScrollRatio = readScrollRatio();
}

function handlePointerMove(event) {
  if (!pointer.active || event.pointerId !== pointer.id) {
    return;
  }
  event.preventDefault();
  pointer.currentY = event.clientY;

  const dy = Math.abs(event.clientY - pointer.startY);
  if (dy > TAP_THRESHOLD_PX) {
    pointer.isDrag = true;
  }

  if (pointer.isDrag) {
    // Scroll the active panel proportionally to the drag distance on the track.
    const trackH = window.innerHeight - TRACK_PAD * 2;
    if (trackH <= 0) {
      return;
    }
    const dragDelta = event.clientY - pointer.startY;
    const ratioDelta = dragDelta / trackH;
    const newRatio = Math.min(1, Math.max(0, pointer.startScrollRatio + ratioDelta));
    applyScrollRatio(newRatio);

    // Ensure the track is visible while the user is actively dragging.
    if (!isExpanded) {
      isExpanded = true;
      expandProgress = Math.min(expandProgress + DRAG_EXPAND_BOOST, 1);
    }
  }
}

function handlePointerUp(event) {
  if (!pointer.active || event.pointerId !== pointer.id) {
    return;
  }
  event.preventDefault();

  pointer.active = false;
  pointer.id = null;
  pointer.isDrag = false;

  // Collapse as soon as the hold ends so the scrollbar no longer behaves like a toggle.
  isExpanded = false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Call this when the active tab changes so the scrollbar tracks the new panel.
export function notifyParticleScrollbarTabChanged() {
  refreshActivePanel();
  scrollRatio = readScrollRatio();
}

// Create the canvas, attach it to the document, and start the animation loop.
export function initParticleScrollbar() {
  if (typeof document === 'undefined') {
    return;
  }

  buildSatellites();

  // Create and style the canvas element.
  canvas = document.createElement('canvas');
  canvas.id = 'particle-scrollbar';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position: fixed',
    'right: 0',
    'top: 0',
    `width: ${CANVAS_CSS_WIDTH}px`,
    'z-index: 100',
    'pointer-events: auto',
    'touch-action: none',
    'cursor: pointer',
  ].join('; ') + ';';

  document.body.appendChild(canvas);

  ctx = canvas.getContext('2d');
  resizeCanvas();

  // Pointer event listeners — all non-passive so preventDefault() works on mobile.
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
  canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });

  // Resize canvas when the viewport changes (e.g. virtual keyboard appears on Android).
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Kick off the render loop.
  rafHandle = requestAnimationFrame(frame);

  refreshActivePanel();
}
