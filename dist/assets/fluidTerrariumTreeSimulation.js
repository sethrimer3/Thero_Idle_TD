// Fluid Terrarium Tree Growth Simulation
// Tree lifecycle, layout, canvas, and simulation methods extracted from FluidTerrariumTrees.
// All functions use .call(this) delegation from the host class.

import { resolveTerrariumDevicePixelRatio } from './fluidTerrariumResolution.js';
import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';
import { FernLSystemSimulation } from '../scripts/features/towers/fernLSystemSimulation.js';
import { FlameFractalSimulation } from '../scripts/features/towers/flameFractalSimulation.js';
import { BrownianTreeSimulation } from '../scripts/features/towers/brownianTreeSimulation.js';
import { DragonCurveSimulation } from '../scripts/features/towers/dragonCurveSimulation.js';
import { KochSnowflakeSimulation } from '../scripts/features/towers/kochSnowflakeSimulation.js';
import { VoronoiSubdivisionSimulation } from '../scripts/features/towers/voronoiSubdivisionSimulation.js';

// Layered palette that transitions from dark bark into vibrant canopies.
const BET_TREE_DEPTH_COLORS = [
  '#26160c',
  '#2f1c0e',
  '#3b2612',
  '#4a2f16',
  '#1f4b29',
  '#245c2f',
  '#2b6d36',
  '#33803f',
];

/**
 * Convert stored serendipity allocations into a terrarium tree level, remaining progress,
 * and the cost of the next level. Shared by the fractal overlay so the UI and simulation
 * stay aligned on level math.
 * @param {number} allocated
 * @returns {{ level: number, progress: number, nextCost: number }}
 */
export function resolveTerrariumTreeLevel(allocated = 0) {
  let remaining = Math.max(0, Math.round(allocated));
  let level = 0;
  let nextCost = 1;
  while (remaining >= nextCost) {
    remaining -= nextCost;
    level += 1;
    nextCost *= 2;
  }
  return { level, progress: remaining, nextCost };
}

/**
 * Lift or nudge anchors so tree roots meet the terrain surfaces marked by the masks.
 * @param {{baseY:number, heightRatio:number, size:'large'|'small', origin?:'ground'|'island'}} anchor
 * @returns {number}
 */
export function getAdjustedBase(anchor) {
  const base = anchor?.baseY || 0;
  const heightRatio = anchor?.heightRatio || 0;

  if (anchor?.origin === 'island') {
    // Raise island anchors slightly so the bonsai crown grows from the plateau instead of the overhang.
    return Math.min(1, base + heightRatio * 0.15);
  }

  if (anchor?.size === 'small') {
    // Lift saplings so their roots sit on the top edge of the placement mask instead of being buried.
    return Math.max(0, base - heightRatio);
  }

  return base;
}

/**
 * Create a stable identifier for a tree anchor so progress persists across reloads.
 */
export function getAnchorKey(anchor) {
  const center = Math.round((anchor?.centerX || 0) * 1000);
  const base = Math.round(((anchor?.rawBaseY ?? anchor?.baseY) || 0) * 1000);
  const width = Math.round((anchor?.widthRatio || 0) * 1000);
  const height = Math.round((anchor?.heightRatio || 0) * 1000);
  return `${anchor?.size || 'tree'}-${center}-${base}-${width}-${height}`;
}

/**
 * Ensure each tree entry tracks a non-negative serendipity allocation.
 */
export function normalizeTreeState(treeId) {
  if (!this.treeState[treeId]) {
    this.treeState[treeId] = { allocated: 0 };
  }
  const allocated = Math.max(0, Math.round(this.treeState[treeId].allocated || 0));
  this.treeState[treeId].allocated = allocated;
  return this.treeState[treeId];
}

/**
 * Resolve the level and remainder toward the next level from total serendipity.
 */
export function computeLevelInfo(allocated) {
  return resolveTerrariumTreeLevel(allocated);
}

/**
 * Sync the fractal growth budget with the allocated serendipity lines.
 */
export function updateSimulationTarget(tree) {
  if (!tree?.simulation) {
    return;
  }
  const allocated = Math.max(0, tree.state.allocated || 0);
  const layers = this.computeLevelInfo(allocated).level;
  const fractalType = tree.anchor?.fractalType || 'tree';
  // Route allocations into the appropriate Shin fractal renderer so each store item
  // preserves its unique geometry.

  if (fractalType === 'koch' && typeof tree.simulation.updateConfig === 'function') {
    const snowflakeSize = Math.min(tree.canvas.width, tree.canvas.height) * 0.6;
    tree.simulation.updateConfig({ allocated, iterations: Math.min(6, 3 + layers), initialSize: snowflakeSize });
    return;
  }

  if (fractalType === 'fern' && typeof tree.simulation.updateConfig === 'function') {
    tree.simulation.updateConfig({ allocated, layersCompleted: Math.min(6, layers) });
    return;
  }

  if (fractalType === 'dragon' && typeof tree.simulation.updateConfig === 'function') {
    tree.simulation.updateConfig({ allocated, iterations: Math.min(16, 6 + layers) });
    return;
  }

  if (fractalType === 'voronoi' && typeof tree.simulation.updateConfig === 'function') {
    tree.simulation.updateConfig({ allocated });
    return;
  }

  if (fractalType === 'brownian' && typeof tree.simulation.updateConfig === 'function') {
    tree.simulation.updateConfig({
      allocated,
      originX: (tree.canvas?.width || 0) / 2,
      originY: Math.max(8, (tree.canvas?.height || 0) * 0.05),
    });
    return;
  }

  if (fractalType === 'flame' && typeof tree.simulation.updateConfig === 'function') {
    tree.simulation.updateConfig({ allocated });
    return;
  }

  const growthBudget = Math.min(tree.simulation.maxSegments - 1, allocated);
  tree.simulation.setTargetSegments(1 + growthBudget);
}

/**
 * Build the HUD elements that hover over a tree.
 * Now only shows the level number in "Lv. X" format.
 */
export function createLevelBadge(layout) {
  const badge = document.createElement('div');
  badge.className = 'fluid-tree-level';
  badge.style.left = `${layout.left}px`;
  badge.style.top = `${layout.top - 16}px`;
  badge.style.width = `${layout.width}px`;

  // Simplified label showing only the level number
  const label = document.createElement('div');
  label.className = 'fluid-tree-level__label';
  badge.appendChild(label);

  return { badge, label, fill: null, progressText: null, upgradeButton: null };
}

/**
 * Refresh the level label for a given tree.
 * Shows "Lv. X" format or "MAX" if at maximum practical level.
 */
export function updateTreeBadge(tree) {
  if (!tree?.badge) {
    return;
  }
  const { label } = tree.badge;
  const levelInfo = this.computeLevelInfo(tree.state.allocated || 0);

  // Consider level 20 as "MAX" for display purposes (2^20 = ~1M serendipity)
  const MAX_DISPLAY_LEVEL = 20;
  
  // Show level in "Lv. X" format or "MAX" if at max
  if (label) {
    const levelText = levelInfo.level >= MAX_DISPLAY_LEVEL ? 'MAX' : `Lv. ${levelInfo.level}`;
    label.textContent = levelText;
  }
}

/**
 * Spend serendipity from the upgrade button to push the selected tree forward.
 */
export function handleUpgradeButton(tree, event) {
  if (!tree) {
    return;
  }
  const levelInfo = this.computeLevelInfo(tree.state.allocated || 0);
  const required = Math.max(1, Math.round(levelInfo.nextCost - levelInfo.progress));
  const available = Math.max(0, Math.round(this.getScintillaeBalance()));
  if (!available) {
    return;
  }
  const amount = Math.min(required, available);
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  const point = rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null;
  this.allocateToTree(tree, amount, point, amount > 1);
}

/**
 * Animate a gold ripple where serendipity was applied.
 */
export function spawnRipple(globalPoint, jitter = false) {
  if (!this.overlay || !globalPoint) {
    return;
  }
  const ripple = document.createElement('div');
  ripple.className = 'fluid-tree-ripple';

  const rect = this.overlay.getBoundingClientRect();
  const originX = jitter ? globalPoint.x + (Math.random() - 0.5) * 24 : globalPoint.x;
  const originY = jitter ? globalPoint.y + (Math.random() - 0.5) * 24 : globalPoint.y;
  ripple.style.left = `${originX - rect.left}px`;
  ripple.style.top = `${originY - rect.top}px`;

  this.overlay.appendChild(ripple);
  requestAnimationFrame(() => {
    ripple.classList.add('fluid-tree-ripple--expand');
  });

  ripple.addEventListener('animationend', () => ripple.remove());
}

/**
 * Deduct serendipity and push growth into a specific tree.
 */
export function allocateToTree(tree, amount, globalPoint, jitter = false) {
  const normalized = Math.max(1, Math.round(amount));
  const spent = this.spendScintillae(normalized);
  if (!spent) {
    return 0;
  }
  tree.state.allocated = Math.max(0, (tree.state.allocated || 0) + spent);
  this.updateSimulationTarget(tree);
  this.updateTreeBadge(tree);
  this.spawnRipple(globalPoint, jitter);
  this.emitState();
  return spent;
}

export function stopHold() {
  if (this.holdTimer) {
    clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }
  this.activeHold = null;
}

export function continueHold() {
  if (!this.activeHold || !this.levelingMode) {
    return;
  }
  const { tree, point } = this.activeHold;
  const spent = this.allocateToTree(tree, 1, point, true);
  if (!spent) {
    this.stopHold();
    return;
  }
  this.activeHold.rate = Math.min(10, this.activeHold.rate + 1);
  const intervalMs = 1000 / this.activeHold.rate;
  this.holdTimer = setTimeout(() => this.continueHold(), intervalMs);
}

/**
 * Wire pointer handlers so trees can accept serendipity taps.
 */
export function attachTreeInput(tree) {
  if (!tree?.canvas) {
    return;
  }
  const canvas = tree.canvas;

  const handlePointerUp = (event) => {
    if (this.activeHold && this.activeHold.pointerId === event.pointerId) {
      this.stopHold();
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (!this.levelingMode) {
      return;
    }
    if (!this.getScintillaeBalance()) {
      return;
    }
    event.preventDefault();
    this.stopHold();
    const point = { x: event.clientX, y: event.clientY };
    this.allocateToTree(tree, 1, point);
    this.activeHold = { tree, point, rate: 2, pointerId: event.pointerId };
    this.holdTimer = setTimeout(() => this.continueHold(), 240);
    canvas.setPointerCapture(event.pointerId);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    canvas.addEventListener(eventName, handlePointerUp);
  });
}

/**
 * Attach the upgrade button so taps spend serendipity on the specific tree.
 */
export function attachUpgradeButton(tree) {
  if (!tree?.badge?.upgradeButton) {
    return;
  }
  tree.badge.upgradeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.handleUpgradeButton(tree, event);
  });
}

/**
 * Clear existing canvases and rebuild simulations for all anchors.
 */
export function refreshLayout() {
  const anchors = this.getCombinedAnchors();
  if (!this.overlay || !this.treeLayer || !this.badgeLayer || !anchors.length || !this.renderBounds.width || !this.renderBounds.height) {
    return;
  }

  this.stop();
  this.treeLayer.innerHTML = '';
  this.badgeLayer.innerHTML = '';
  this.trees = [];

  anchors.forEach((anchor) => {
    const layout = this.computeLayout(anchor);
    if (!layout) {
      return;
    }
    const canvas = this.createCanvas(layout);
    const simulation = this.buildSimulation(anchor, canvas, layout.visibleHeight || layout.height);
    if (!simulation) {
      return;
    }

    const isEphemeral = Boolean(anchor?.ephemeral);
    const treeId = isEphemeral ? this.getPlacementId(anchor) : this.getAnchorKey(anchor);
    const state = isEphemeral ? this.createEphemeralTreeState(anchor) : this.normalizeTreeState(treeId);
    const badge = isEphemeral ? null : this.createLevelBadge(layout);

    this.treeLayer.appendChild(canvas);
    if (badge) {
      this.badgeLayer.appendChild(badge.badge);
    }

    const tree = { id: treeId, canvas, simulation, frozen: false, state, badge, isEphemeral, anchor };
    this.updateSimulationTarget(tree);
    if (badge) {
      this.updateTreeBadge(tree);
    }
    if (!isEphemeral) {
      this.attachTreeInput(tree);
      this.attachUpgradeButton(tree);
    }

    // Track each tree along with its simulation so we can freeze completed renders later.
    this.trees.push(tree);
  });

  this.syncLevelingMode();
  if (this.trees.length) {
    this.start();
  }
}

/**
 * Calculate canvas size and absolute positioning for a given anchor.
 * @param {{centerX:number, baseY:number, widthRatio:number, heightRatio:number, size:'large'|'small'}} anchor
 */
export function computeLayout(anchor) {
  const widthRatio = anchor.size === 'large' ? 0.18 : 0.14;
  const desiredWidth = Math.max(
    this.renderBounds.width * widthRatio,
    anchor.widthRatio * this.renderBounds.width * 10,
  );
  const maxWidth = this.renderBounds.width * 0.4;
  const width = Math.min(Math.max(14, desiredWidth), maxWidth);

  const desiredHeight = width * (anchor.size === 'large' ? 1.9 : 1.6);
  const groundY = this.renderBounds.top + anchor.baseY * this.renderBounds.height;
  const maxHeight = Math.max(10, groundY - this.renderBounds.top);
  // Reserve a small buffer so crowns don't brush against the basin rim.
  const canopyCushion = this.renderBounds.height * 0.04;
  const height = Math.min(desiredHeight + canopyCushion, maxHeight);

  const horizontalPadding = Math.max(16, width * 0.25);
  const verticalPadding = Math.max(12, height * 0.15);
  const paddedWidth = width + horizontalPadding * 2;
  const paddedHeight = height + verticalPadding;

  const left = this.renderBounds.left + anchor.centerX * this.renderBounds.width - paddedWidth / 2;
  const top = groundY - paddedHeight;

  return { left, top, width: paddedWidth, height: paddedHeight, visibleHeight: height };
}

/**
 * Create and position a canvas that will host a fractal tree.
 * @param {{left:number, top:number, width:number, height:number}} layout
 */
export function createCanvas(layout) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fluid-terrarium__tree';

  // Use device pixel ratio with 3x multiplier for crisp rendering at mobile zoom levels.
  // Cap at 6x to avoid excessive memory usage on high-DPI devices.
  const dpr = resolveTerrariumDevicePixelRatio();
  const scaleFactor = Math.min(dpr * 3, 6);

  // Set high-resolution buffer size for crisp rendering.
  canvas.width = Math.round(layout.width * scaleFactor);
  canvas.height = Math.round(layout.height * scaleFactor);

  // Keep CSS display size unchanged.
  canvas.style.left = `${layout.left}px`;
  canvas.style.top = `${layout.top}px`;
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');

  // Scale context so drawing operations use logical coordinates.
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(scaleFactor, scaleFactor);
  }

  return canvas;
}

/**
 * Configure the Shin fractal tree simulation for the given canvas.
 * @param {{size:'large'|'small', fractalType?:string}} anchor
 * @param {HTMLCanvasElement} canvas
 * @param {number} height
 */
export function buildSimulation(anchor, canvas, height) {
  const size = anchor?.size || 'large';
  const type = anchor?.fractalType || 'tree';

  if (type === 'koch') {
    const snowflakeSize = Math.min(canvas.width, canvas.height) * 0.6;
    return new KochSnowflakeSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      lineColor: '#9dd8ff',
      lineWidth: 1.6,
      initialSize: snowflakeSize,
      iterations: 5,
      drawSpeed: 0.02,
    });
  }

  if (type === 'fern') {
    return new FernLSystemSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      palette: 'dark-fern',
      turnAngle: 25,
      segmentLength: Math.max(3, Math.min(10, height * 0.02)),
      segmentGrowthSpeed: 0.09,
    });
  }

  if (type === 'dragon') {
    return new DragonCurveSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      lineStartColor: '#7f9cff',
      lineEndColor: '#ffd29d',
      lineWidth: 1.25,
      segmentLength: Math.max(2, Math.min(6, height * 0.015)),
      iterations: 12,
      drawSpeed: 0.018,
    });
  }

  if (type === 'voronoi') {
    return new VoronoiSubdivisionSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      palette: 'blue-aurora',
      maxCells: 140,
      maxDepth: 5,
      splitDelay: 0.05,
    });
  }

  if (type === 'brownian') {
    return new BrownianTreeSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      particleLimit: 1600,
      glowRadius: 5,
      walkableMask: this.walkableMask,
    });
  }

  if (type === 'flame') {
    return new FlameFractalSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      palette: 'aurora',
      samplesPerIteron: 8000,
      fadeRate: 0.18,
    });
  }

  // Default: Shin fractal tree variant.
  const depth = 7;
  const baseWidth = size === 'large' ? 4 : 3;
  const rootLength = Math.max(16, height * (size === 'large' ? 0.3 : 0.26));

  const simulation = new FractalTreeSimulation({
    canvas,
    bgColor: 'rgba(0, 0, 0, 0)',
    trunkColor: BET_TREE_DEPTH_COLORS[1],
    twigColor: BET_TREE_DEPTH_COLORS[BET_TREE_DEPTH_COLORS.length - 1],
    leafColor: BET_TREE_DEPTH_COLORS[BET_TREE_DEPTH_COLORS.length - 1],
    leafAlpha: 0.3,
    branchFactor: 2,
    baseSpreadDeg: 25,
    lengthDecay: 0.7,
    maxDepth: depth,
    angleJitterDeg: 3,
    gravityBend: 0.08,
    growthRate: size === 'large' ? 3 : 2,
    renderStyle: 'bezier',
    baseWidth,
    minWidth: 0.38,
    rootLength,
    rootX: 0.5,
    rootY: 0.99,
    seed: Math.floor(Math.random() * 100000),
    enableHalos: false,
  });

  simulation.updateConfig({
    maxDepth: depth,
    depthColors: BET_TREE_DEPTH_COLORS,
  });

  return simulation;
}

/**
 * Determine whether the underlying fractal simulation still needs animation frames.
 * @param {object|null} simulation
 */
export function isSimulationComplete(simulation) {
  if (!simulation) {
    return true;
  }
  if (typeof simulation.isComplete === 'boolean') {
    return simulation.isComplete;
  }
  if (typeof simulation.getCompletion === 'function') {
    return simulation.getCompletion() >= 1;
  }
  if ('progress' in simulation && 'targetProgress' in simulation) {
    return Number(simulation.progress) >= Number(simulation.targetProgress) - 0.001;
  }
  return false;
}

/**
 * Convert a fully grown fractal tree canvas into a static image to reduce render cost.
 * @param {{canvas: HTMLCanvasElement|HTMLImageElement, simulation: FractalTreeSimulation|null, frozen: boolean}} tree
 */
export function freezeTree(tree) {
  if (!tree || tree.frozen || !(tree.canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const { canvas, simulation } = tree;

  // Ensure the final frame is rendered before capturing the bitmap.
  if (simulation) {
    simulation.render();
  }

  const image = new Image();
  image.className = canvas.className;
  image.style.cssText = canvas.style.cssText;
  // Intrinsic dimensions are encoded in the PNG; CSS styles control display size.
  image.setAttribute('aria-hidden', 'true');
  image.setAttribute('role', 'presentation');
  image.src = canvas.toDataURL('image/png');

  canvas.replaceWith(image);
  tree.canvas = image;
  tree.simulation = null;
  tree.frozen = true;
}

/**
 * Begin the animation loop so branches keep sprouting.
 */
export function start() {
  if (this.running || !this.trees.length) {
    return;
  }
  this.running = true;
  this.animationFrame = requestAnimationFrame(this.handleFrame);
}

/**
 * Stop the animation loop and cancel pending frames.
 */
export function stop() {
  this.running = false;
  if (this.animationFrame) {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }
}

/**
 * Advance growth and render all active trees.
 */
export function handleFrame() {
  if (!this.running) {
    return;
  }

  // Track whether any simulations still need to advance so we can stop once all are frozen.
  let hasActiveSimulation = false;

  this.trees.forEach((tree) => {
    if (!tree?.simulation) {
      return;
    }

    if (!this.isSimulationComplete(tree.simulation)) {
      tree.simulation.update();
      tree.simulation.render();
    }

    if (this.isSimulationComplete(tree.simulation)) {
      // Replace fully grown fractals with a static bitmap to avoid ongoing renders.
      this.freezeTree(tree);
      return;
    }

    hasActiveSimulation = true;
  });

  if (!hasActiveSimulation) {
    this.stop();
    return;
  }

  this.animationFrame = requestAnimationFrame(this.handleFrame);
}

/**
 * Disconnect observers and halt rendering.
 */
export function destroy() {
  this.stop();
  if (this.resizeObserver) {
    try {
      this.resizeObserver.disconnect();
    } catch (error) {
      console.warn('Failed to disconnect terrarium tree resize observer.', error);
    }
  }
  if (this.container) {
    this.container.removeEventListener('pointermove', this.handleContainerPointerMove);
    this.container.removeEventListener('pointerleave', this.handleContainerPointerLeave);
    this.container.removeEventListener('click', this.handleContainerClick);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('betTerrariumMenuClose', this.handleMenuCloseEvent);
    window.removeEventListener('pointermove', this.handleDragPointerMove);
    window.removeEventListener('pointerup', this.handleDragPointerUp);
  }
  this.removeDragGhost();
}
