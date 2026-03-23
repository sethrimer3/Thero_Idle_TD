// Canvas-based particle scrollbars for mobile touch scrolling on Android.
// Renders glowing particle thumbs with orbiting satellite particles along the viewport edge.
// Holding a thumb expands its satellites into a vertical scrollbar track; dragging scrolls the active panel.

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

// Shorter transition makes particles move into and out of position twice as fast.
const EXPAND_DURATION = 0.19;

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
const HALO_RADIUS_MULTIPLIER = 2.6;

// Compression factors for the elliptical swirl orbit.
const ORBIT_HORIZONTAL_COMPRESSION = 0.6;
const ORBIT_VERTICAL_COMPRESSION = 0.5;

// Instant boost applied to expandProgress when a drag begins without a preceding tap-expand.
const DRAG_EXPAND_BOOST = 0.2;

// Idle particles should be only slightly faded when not actively in use.
const IDLE_ALPHA = 0.8;

// Moving particles leave behind a fiery trail while sliding into or out of position.
const TRAIL_POINT_LIMIT = 14;
const TRAIL_MIN_MOVEMENT = 1.4;
const TRAIL_DECAY_PER_SECOND = 2.6;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildSatellites() {
  const satellites = [];
  SATELLITE_SIZES.forEach((size, sizeIndex) => {
    for (let copy = 0; copy < 2; copy++) {
      const globalIndex = sizeIndex * 2 + copy;
      const palettePos = globalIndex / (NUM_SATELLITES - 1);
      const baseOrbitRadius = 12 + (SATELLITE_SIZES.length - sizeIndex) * 2.2;
      const orbitRadius = baseOrbitRadius + copy * ORBIT_COPY_OFFSET;
      const dirSign = copy % 2 === 0 ? 1 : -1;
      const speedMagnitude = 0.55 + (globalIndex % 7) * 0.12;
      const orbitSpeed = speedMagnitude * dirSign;
      const orbitAngle = (Math.PI * 2 * globalIndex) / NUM_SATELLITES;

      satellites.push({
        radius: size / 2,
        palettePos,
        orbitAngle,
        orbitRadius,
        orbitSpeed,
        linearIndex: sizeIndex,
        above: copy === 0,
        lastX: null,
        lastY: null,
        trail: [],
      });
    }
  });
  return satellites;
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  if (element.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function drawGlowDot(ctx, x, y, radius, color, alpha) {
  const { r, g, b } = color;
  const haloR = radius * HALO_RADIUS_MULTIPLIER;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
  halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
  halo.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.12})`);
  halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  const core = ctx.createRadialGradient(x, y, 0, x, y, radius);
  core.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  core.addColorStop(0.38, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  core.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

function drawFieryTrail(ctx, trail, radius, alpha) {
  if (!Array.isArray(trail) || trail.length < 2) {
    return;
  }

  trail.forEach((point, index) => {
    const progress = (index + 1) / trail.length;
    const warm = {
      r: Math.round(255 - progress * 10),
      g: Math.round(150 - progress * 80),
      b: Math.round(30 + progress * 20),
    };
    drawGlowDot(ctx, point.x, point.y, Math.max(1.2, radius * (0.45 + progress * 0.25)), warm, alpha * point.life * 0.55);
  });
}

function resolveOverlayActive() {
  const overlay = document.getElementById('tower-upgrade-overlay');
  return Boolean(overlay && overlay.classList.contains('active') && overlay.getAttribute('aria-hidden') !== 'true');
}

function createScrollbarInstance({
  id,
  ariaLabel,
  right = 0,
  resolveActiveScrollableElement,
  isVisible,
}) {
  const state = {
    id,
    ariaLabel,
    right,
    resolveActiveScrollableElement,
    isVisible,
    canvas: null,
    ctx: null,
    expandProgress: 0,
    isExpanded: false,
    pointer: {
      active: false,
      id: null,
      startY: 0,
      currentY: 0,
      isDrag: false,
      startScrollRatio: 0,
    },
    scrollRatio: 0,
    activePanel: null,
    satellites: buildSatellites(),
  };

  function refreshActivePanel() {
    state.activePanel = state.resolveActiveScrollableElement();
  }

  function getActivePanelMaxScroll() {
    if (!state.activePanel) {
      return 0;
    }
    return Math.max(0, state.activePanel.scrollHeight - state.activePanel.clientHeight);
  }

  function readScrollRatio() {
    refreshActivePanel();
    if (!state.activePanel) {
      return 0;
    }
    const max = getActivePanelMaxScroll();
    if (max <= 1) {
      return 0;
    }
    return Math.min(1, Math.max(0, state.activePanel.scrollTop / max));
  }

  function applyScrollRatio(ratio) {
    refreshActivePanel();
    if (!state.activePanel) {
      return;
    }
    const max = getActivePanelMaxScroll();
    if (max <= 1) {
      return;
    }
    state.activePanel.scrollTop = ratio * max;
  }

  function resizeCanvas() {
    if (!state.canvas || !state.ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const cssH = window.innerHeight;
    state.canvas.style.height = `${cssH}px`;
    state.canvas.width = Math.round(CANVAS_CSS_WIDTH * dpr);
    state.canvas.height = Math.round(cssH * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateSatelliteTrail(satellite, x, y, dt, shouldLeaveTrail) {
    if (!Number.isFinite(satellite.lastX) || !Number.isFinite(satellite.lastY)) {
      satellite.lastX = x;
      satellite.lastY = y;
    }

    const movement = Math.hypot(x - satellite.lastX, y - satellite.lastY);
    if (shouldLeaveTrail && movement >= TRAIL_MIN_MOVEMENT) {
      satellite.trail.push({ x: satellite.lastX, y: satellite.lastY, life: 1 });
      if (satellite.trail.length > TRAIL_POINT_LIMIT) {
        satellite.trail.shift();
      }
    }

    satellite.trail = satellite.trail.filter((point) => {
      point.life -= dt * TRAIL_DECAY_PER_SECOND;
      return point.life > 0;
    });

    satellite.lastX = x;
    satellite.lastY = y;
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.button !== undefined) {
      return;
    }
    if (!state.isVisible()) {
      return;
    }
    event.preventDefault();
    try {
      state.canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is best-effort.
    }

    state.pointer.active = true;
    state.pointer.id = event.pointerId;
    state.pointer.startY = event.clientY;
    state.pointer.currentY = event.clientY;
    state.pointer.isDrag = false;
    state.isExpanded = true;
    refreshActivePanel();
    state.pointer.startScrollRatio = readScrollRatio();
  }

  function handlePointerMove(event) {
    if (!state.pointer.active || event.pointerId !== state.pointer.id) {
      return;
    }
    event.preventDefault();
    state.pointer.currentY = event.clientY;

    const dy = Math.abs(event.clientY - state.pointer.startY);
    if (dy > TAP_THRESHOLD_PX) {
      state.pointer.isDrag = true;
    }

    if (state.pointer.isDrag) {
      const trackH = window.innerHeight - TRACK_PAD * 2;
      if (trackH <= 0) {
        return;
      }
      const dragDelta = event.clientY - state.pointer.startY;
      const ratioDelta = dragDelta / trackH;
      const newRatio = Math.min(1, Math.max(0, state.pointer.startScrollRatio + ratioDelta));
      applyScrollRatio(newRatio);
      if (!state.isExpanded) {
        state.isExpanded = true;
        state.expandProgress = Math.min(state.expandProgress + DRAG_EXPAND_BOOST, 1);
      }
    }
  }

  function handlePointerUp(event) {
    if (!state.pointer.active || event.pointerId !== state.pointer.id) {
      return;
    }
    event.preventDefault();
    state.pointer.active = false;
    state.pointer.id = null;
    state.pointer.isDrag = false;
    state.isExpanded = false;
  }

  function initialize() {
    if (state.canvas) {
      return;
    }

    state.canvas = document.createElement('canvas');
    state.canvas.id = id;
    state.canvas.setAttribute('aria-hidden', 'true');
    state.canvas.dataset.scrollbarRole = ariaLabel;
    state.canvas.style.cssText = [
      'position: fixed',
      `${right === 0 ? 'right' : 'right'}: ${right}px`,
      'top: 0',
      `width: ${CANVAS_CSS_WIDTH}px`,
      'z-index: 100',
      'pointer-events: auto',
      'touch-action: none',
      'cursor: pointer',
      'opacity: 0',
      'transition: opacity 160ms ease',
    ].join('; ') + ';';

    document.body.appendChild(state.canvas);
    state.ctx = state.canvas.getContext('2d');
    resizeCanvas();

    state.canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    state.canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    state.canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    state.canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });
  }

  function update(dt) {
    const shouldShow = state.isVisible();
    refreshActivePanel();
    const maxScroll = getActivePanelMaxScroll();
    const canScroll = maxScroll > 1;

    if (!shouldShow || !canScroll) {
      state.isExpanded = false;
      state.expandProgress = Math.max(0, state.expandProgress - (dt / EXPAND_DURATION));
      if (state.canvas) {
        state.canvas.style.opacity = '0';
        state.canvas.style.pointerEvents = 'none';
      }
      return;
    }

    if (state.canvas) {
      state.canvas.style.opacity = '1';
      state.canvas.style.pointerEvents = 'auto';
    }

    const transitionSpeed = 1 / EXPAND_DURATION;
    if (state.isExpanded) {
      state.expandProgress = Math.min(1, state.expandProgress + transitionSpeed * dt);
    } else {
      state.expandProgress = Math.max(0, state.expandProgress - transitionSpeed * dt);
    }

    state.scrollRatio = readScrollRatio();
    state.satellites.forEach((satellite) => {
      satellite.orbitAngle += satellite.orbitSpeed * dt;
    });
  }

  function draw() {
    if (!state.canvas || !state.ctx) {
      return;
    }

    const W = CANVAS_CSS_WIDTH;
    const H = window.innerHeight;
    const cx = W / 2;
    const trackH = H - TRACK_PAD * 2;
    const thumbY = TRACK_PAD + trackH * state.scrollRatio;
    const ep = state.expandProgress;
    const inUse = state.pointer.active || ep > 0.02;
    const baseAlpha = inUse ? 1 : IDLE_ALPHA;

    state.ctx.clearRect(0, 0, W, H);

    if (ep > 0.02) {
      const lineColor = samplePaletteGradient(0.5);
      state.ctx.save();
      state.ctx.globalAlpha = ep * 0.28;
      state.ctx.strokeStyle = `rgb(${lineColor.r}, ${lineColor.g}, ${lineColor.b})`;
      state.ctx.lineWidth = 2;
      state.ctx.lineCap = 'round';
      state.ctx.beginPath();
      state.ctx.moveTo(cx, TRACK_PAD);
      state.ctx.lineTo(cx, H - TRACK_PAD);
      state.ctx.stroke();
      state.ctx.restore();
    }

    const thumbColor = samplePaletteGradient(0.5);
    const trailActive = state.pointer.active || (ep > 0.02 && ep < 0.98);

    state.satellites.forEach((satellite) => {
      const orbitX = cx + Math.cos(satellite.orbitAngle) * satellite.orbitRadius * ORBIT_HORIZONTAL_COMPRESSION;
      const orbitY = thumbY + Math.sin(satellite.orbitAngle) * satellite.orbitRadius * ORBIT_VERTICAL_COMPRESSION;
      const offset = (satellite.linearIndex + 1) * LINEAR_SPACING;
      const linearY = satellite.above ? thumbY - offset : thumbY + offset;
      const x = orbitX + (cx - orbitX) * ep;
      const y = orbitY + (linearY - orbitY) * ep;

      updateSatelliteTrail(satellite, x, y, 1 / 60, trailActive);

      if (y < -30 || y > H + 30) {
        return;
      }

      const swirlColor = samplePaletteGradient(satellite.palettePos);
      const r = Math.round(swirlColor.r + (thumbColor.r - swirlColor.r) * ep);
      const g = Math.round(swirlColor.g + (thumbColor.g - swirlColor.g) * ep);
      const b = Math.round(swirlColor.b + (thumbColor.b - swirlColor.b) * ep);
      drawFieryTrail(state.ctx, satellite.trail, satellite.radius, baseAlpha);
      drawGlowDot(state.ctx, x, y, satellite.radius, { r, g, b }, baseAlpha * 0.88);
    });

    drawGlowDot(state.ctx, cx, thumbY, MAIN_SIZE / 2, thumbColor, baseAlpha);
  }

  return {
    initialize,
    resizeCanvas,
    update,
    draw,
    refreshActivePanel: () => {
      refreshActivePanel();
      state.scrollRatio = readScrollRatio();
    },
  };
}

// Prefer the topmost visible scroll container so overlays stay in sync with the correct thumb.
function resolvePrimaryScrollableElement() {
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
      if (!isVisibleElement(element)) {
        continue;
      }
      if (element.closest('#tower-upgrade-overlay.active')) {
        continue;
      }
      return element;
    }
  }

  return null;
}

// Tower upgrade cards get their own scrollbar while the overlay is open.
function resolveTowerCardScrollableElement() {
  const overlay = document.getElementById('tower-upgrade-overlay');
  if (!overlay || !overlay.classList.contains('active')) {
    return null;
  }
  const panel = overlay.querySelector('.tower-upgrade-panel');
  return isVisibleElement(panel) ? panel : null;
}

const scrollbarInstances = [];
let rafHandle = null;
let lastTimestamp = null;

function resizeCanvases() {
  scrollbarInstances.forEach((instance) => instance.resizeCanvas());
}

function frame(timestamp) {
  const dt = lastTimestamp !== null ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0;
  lastTimestamp = timestamp;

  scrollbarInstances.forEach((instance) => {
    instance.update(dt);
    instance.draw();
  });

  rafHandle = requestAnimationFrame(frame);
}

export function notifyParticleScrollbarTabChanged() {
  scrollbarInstances.forEach((instance) => instance.refreshActivePanel());
}

export function initParticleScrollbar() {
  if (typeof document === 'undefined') {
    return;
  }
  if (scrollbarInstances.length) {
    return;
  }

  // The primary scrollbar hides whenever the player is inside a tower card overlay.
  const primaryScrollbar = createScrollbarInstance({
    id: 'particle-scrollbar',
    ariaLabel: 'primary',
    right: 0,
    resolveActiveScrollableElement: resolvePrimaryScrollableElement,
    isVisible: () => !resolveOverlayActive(),
  });

  // The secondary scrollbar appears only for the tower upgrade cards.
  const towerCardScrollbar = createScrollbarInstance({
    id: 'particle-scrollbar-tower-cards',
    ariaLabel: 'tower-cards',
    right: 0,
    resolveActiveScrollableElement: resolveTowerCardScrollableElement,
    isVisible: () => resolveOverlayActive(),
  });

  scrollbarInstances.push(primaryScrollbar, towerCardScrollbar);
  scrollbarInstances.forEach((instance) => instance.initialize());

  window.addEventListener('resize', resizeCanvases, { passive: true });
  rafHandle = requestAnimationFrame(frame);
  notifyParticleScrollbarTabChanged();
}
