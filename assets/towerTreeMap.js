// Tower Tree Map renderer: builds the alternate constellation view for unlocked towers.
import {
  getTowerDefinitions,
  getTowerUnlockState,
  getTowerEquationBlueprint,
  openTowerUpgradeOverlay,
} from './towersTab.js';
import { convertMathExpressionToPlainText } from '../scripts/core/mathText.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const PHYSICS_CONFIG = {
  /** Diameter of the orbit button in pixels (matches CSS width of 55px). */
  nodeDiameter: 55,
  /** Springs try to reach 1.5 × tower diameter per tier of separation. */
  targetLengthMultiplier: 1.5,
  springStrength: 9,
  anchorStrength: 0.35,
  /** Boundary force multiplier that keeps nodes within the map gently. */
  boundaryStrength: 0.4,
  /** Padding multiplier to determine how close nodes can drift to edges. */
  boundaryPaddingMultiplier: 0.9,
  repulsionStrength: 60000,
  damping: 0.94,
  maxDelta: 0.05,
  /** Maximum velocity (in px/s) imparted when flinging a node. */
  maxDragVelocity: 1400,
  /** Normalized translation factor applied to viewport drags to calm scrolling. */
  panTranslationFactor: 0.42,
  /** Strength of the upward tether that keeps the alpha node aligned with the tree top. */
  alphaOrientationStrength: 0.55,
  /** Target vertical ratio that anchors alpha near the upper band of the map. */
  alphaTopNormalized: 0.16,
};

const towerTreeState = {
  toggleButton: null,
  mapContainer: null,
  nodeLayer: null,
  linkLayer: null,
  cardGrid: null,
  // Preserve the randomly generated horizontal offsets while the map is open.
  randomOffsets: new Map(),
  needsRefresh: false,
  nodes: new Map(),
  edges: [],
  animationHandle: null,
  lastTimestamp: null,
  // Stores the current half-width of nodes so bounds and forces respect their size.
  nodeRadius: PHYSICS_CONFIG.nodeDiameter / 2,
  /** Tracks the offset between the viewport container and the node/link layers. */
  linkOrigin: { x: 0, y: 0 },
  /** Tracks the drag interaction currently being performed on the tree. */
  dragState: {
    active: false,
    pointerId: null,
    nodeId: null,
    startPointer: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
    moved: false,
    /** Last pointer sample captured while dragging to calculate fling velocity. */
    lastPointer: { x: 0, y: 0, time: 0 },
    /** Last clamped node position to smooth velocity calculations. */
    lastPosition: { x: 0, y: 0 },
    /** Pointer velocity preserved between move events for fling behavior. */
    velocity: { x: 0, y: 0 },
  },
  // Store the current camera transform so the constellation view supports panning and zooming.
  view: {
    scale: 1,
    minScale: 0.6,
    maxScale: 2.4,
    center: { x: 0.5, y: 0.5 },
    pointer: {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startCenter: { x: 0.5, y: 0.5 },
      moved: false,
    },
    activePointers: new Map(),
    pinchState: null,
    isPinchZooming: false,
  },
  // Prevent background clicks from firing after a pan or pinch gesture completes.
  suppressClick: false,
};

/** Positions a DOM node so its mathematical center matches the physics coordinates. */
function applyNodeDomPosition(node) {
  if (!node?.element) {
    return;
  }
  const halfWidth = (node.size?.width ?? PHYSICS_CONFIG.nodeDiameter) / 2;
  const halfHeight = (node.size?.height ?? PHYSICS_CONFIG.nodeDiameter) / 2;
  node.element.style.left = `${node.position.x - halfWidth}px`;
  node.element.style.top = `${node.position.y - halfHeight}px`;
}

function stopSimulation() {
  if (towerTreeState.animationHandle !== null) {
    cancelAnimationFrame(towerTreeState.animationHandle);
    towerTreeState.animationHandle = null;
  }
  towerTreeState.lastTimestamp = null;
}

// Resolve the current map dimensions so camera transforms have reliable measurements.
function getMapMetrics() {
  const container = towerTreeState.mapContainer;
  const nodeLayer = towerTreeState.nodeLayer;
  if (!container) {
    return {
      viewportWidth: 0,
      viewportHeight: 0,
      worldWidth: 0,
      worldHeight: 0,
      rect: null,
      nodeRect: null,
    };
  }
  const rect = typeof container.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  // Sample both the viewport (visible area) and the physics canvas so panning math stays in sync.
  const nodeRect = typeof nodeLayer?.getBoundingClientRect === 'function'
    ? nodeLayer.getBoundingClientRect()
    : null;
  // Sample the untransformed container bounds so zoom scaling does not inflate viewport math.
  const viewportWidth = container?.clientWidth
    || rect?.width
    || 0;
  const viewportHeight = container?.clientHeight
    || rect?.height
    || 0;
  // Preserve the true constellation canvas size so panning can extend beyond the viewport.
  const worldWidth = nodeLayer?.offsetWidth
    || nodeRect?.width
    || viewportWidth;
  // Mirror the vertical canvas measurement so drag clamps honor the full constellation height.
  const worldHeight = nodeLayer?.offsetHeight
    || nodeRect?.height
    || viewportHeight;
  return {
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
    rect,
    nodeRect,
  };
}

// Clamp the camera center so zoomed views never drift beyond the constellation bounds.
function clampViewCenterNormalized(normalized) {
  if (!normalized) {
    return { x: 0.5, y: 0.5 };
  }
  // Sample the viewport dimensions so drag distance converts into normalized offsets.
  const metrics = getMapMetrics();
  const viewportWidth = Math.max(metrics.viewportWidth || 0, 0);
  const viewportHeight = Math.max(metrics.viewportHeight || 0, 0);
  const worldWidth = Math.max(metrics.worldWidth || 0, 0);
  const worldHeight = Math.max(metrics.worldHeight || 0, 0);
  const scale = Math.max(towerTreeState.view.scale || 1, 0.0001);
  const viewportRatioX = worldWidth > 0 ? viewportWidth / worldWidth : 1;
  const viewportRatioY = worldHeight > 0 ? viewportHeight / worldHeight : 1;
  const halfX = Math.min(0.5, (viewportRatioX / (2 * scale)) || 0.5);
  const halfY = Math.min(0.5, (viewportRatioY / (2 * scale)) || 0.5);
  const clamp = (value, min, max) => {
    if (min > max) {
      return 0.5;
    }
    return Math.min(Math.max(value, min), max);
  };
  return {
    x: clamp(normalized.x, halfX, 1 - halfX),
    y: clamp(normalized.y, halfY, 1 - halfY),
  };
}

// Apply the stored camera transform to the DOM layers so nodes and links move in sync.
function applyViewTransform() {
  const { viewportWidth, viewportHeight, worldWidth, worldHeight } = getMapMetrics();
  if (!viewportWidth || !viewportHeight || !worldWidth || !worldHeight) {
    return;
  }
  const scale = towerTreeState.view.scale || 1;
  const center = towerTreeState.view.center || { x: 0.5, y: 0.5 };
  const centerWorld = { x: worldWidth * center.x, y: worldHeight * center.y };
  const translateX = viewportWidth / 2 - scale * centerWorld.x;
  const translateY = viewportHeight / 2 - scale * centerWorld.y;
  const transform = `matrix(${scale}, 0, 0, ${scale}, ${translateX}, ${translateY})`;
  if (towerTreeState.nodeLayer) {
    towerTreeState.nodeLayer.style.transformOrigin = '0px 0px';
    towerTreeState.nodeLayer.style.transform = transform;
  }
  if (towerTreeState.linkLayer) {
    towerTreeState.linkLayer.style.transformOrigin = '0px 0px';
    towerTreeState.linkLayer.style.transformBox = 'fill-box';
    towerTreeState.linkLayer.style.transform = transform;
  }
}

// Update the stored camera center using normalized coordinates.
function setViewCenterNormalized(normalized) {
  towerTreeState.view.center = clampViewCenterNormalized(normalized);
  applyViewTransform();
}

// Convert a client coordinate into the constellation's world space.
function getTreeWorldPoint(point) {
  if (!point) {
    return null;
  }
  const metrics = getMapMetrics();
  const { viewportWidth, viewportHeight, worldWidth, worldHeight, rect } = metrics;
  if (!viewportWidth || !viewportHeight || !rect) {
    return null;
  }
  const scale = towerTreeState.view.scale || 1;
  const center = towerTreeState.view.center || { x: 0.5, y: 0.5 };
  const centerWorld = { x: worldWidth * center.x, y: worldHeight * center.y };
  const offsetX = viewportWidth / 2 - scale * centerWorld.x;
  const offsetY = viewportHeight / 2 - scale * centerWorld.y;
  // Compensate for the panel padding so pointer math maps to the world origin.
  const originX = towerTreeState.linkOrigin?.x || 0;
  const originY = towerTreeState.linkOrigin?.y || 0;
  const localX = point.clientX - rect.left - originX;
  const localY = point.clientY - rect.top - originY;
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
    return null;
  }
  const worldX = (localX - offsetX) / scale;
  const worldY = (localY - offsetY) / scale;
  return {
    x: worldX,
    y: worldY,
    normalizedX: worldWidth ? worldX / worldWidth : 0.5,
    normalizedY: worldHeight ? worldY / worldHeight : 0.5,
  };
}

// Adjust the zoom level while keeping an optional anchor point locked under the pointer.
function setTreeZoom(targetScale, anchorPoint = null) {
  if (!Number.isFinite(targetScale)) {
    return;
  }
  const minScale = Number.isFinite(towerTreeState.view.minScale)
    ? towerTreeState.view.minScale
    : 0.6;
  const maxScale = Number.isFinite(towerTreeState.view.maxScale)
    ? towerTreeState.view.maxScale
    : 2.4;
  const clampedScale = Math.min(maxScale, Math.max(minScale, targetScale));
  const metrics = getMapMetrics();
  const {
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
    rect,
  } = metrics;
  towerTreeState.view.scale = clampedScale;
  if (anchorPoint && viewportWidth && viewportHeight && rect) {
    const anchorWorld = getTreeWorldPoint(anchorPoint);
    if (anchorWorld) {
      // Preserve the pointer's world position by removing the static padding offset first.
      const originX = towerTreeState.linkOrigin?.x || 0;
      const originY = towerTreeState.linkOrigin?.y || 0;
      const localX = anchorPoint.clientX - rect.left - originX;
      const localY = anchorPoint.clientY - rect.top - originY;
      const centerWorldX = (viewportWidth / 2 - localX) / clampedScale + anchorWorld.x;
      const centerWorldY = (viewportHeight / 2 - localY) / clampedScale + anchorWorld.y;
      setViewCenterNormalized({
        x: worldWidth ? centerWorldX / worldWidth : 0.5,
        y: worldHeight ? centerWorldY / worldHeight : 0.5,
      });
      return;
    }
  }
  setViewCenterNormalized(towerTreeState.view.center);
}

// Convenience helper to apply a zoom multiplier with optional pointer anchoring.
function applyTreeZoomFactor(factor, anchorPoint = null) {
  if (!Number.isFinite(factor) || factor <= 0) {
    return;
  }
  const nextScale = (towerTreeState.view.scale || 1) * factor;
  setTreeZoom(nextScale, anchorPoint);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEquationText(rawEquation) {
  if (!rawEquation) {
    return '';
  }
  const plain = convertMathExpressionToPlainText(rawEquation) || rawEquation;
  return plain
    .replace(/\\/g, '')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalizes an event timestamp into a numeric value for drag velocity math. */
function resolveTimestamp(event) {
  if (event && Number.isFinite(event.timeStamp)) {
    return event.timeStamp;
  }
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function extractTowerEquation(towerId) {
  const card = document.getElementById('tower-card-grid')?.querySelector(
    `.card[data-tower-id="${towerId}"] .formula-block .formula-line`,
  );
  const text = card?.textContent;
  if (text && text.trim()) {
    return normalizeEquationText(text);
  }
  const blueprint = getTowerEquationBlueprint(towerId);
  if (blueprint?.baseEquation) {
    return normalizeEquationText(blueprint.baseEquation);
  }
  return '';
}

function collectTowerDependencies(equation, towers, currentId) {
  if (!equation) {
    return [];
  }
  const dependencies = new Set();
  const normalized = equation.toLowerCase();
  towers.forEach((definition) => {
    if (!definition || definition.id === currentId) {
      return;
    }
    const symbol = (definition.symbol || '').trim();
    const id = (definition.id || '').trim();
    let referenced = false;
    if (symbol && equation.includes(symbol)) {
      referenced = true;
    }
    if (!referenced && symbol) {
      const asciiSymbol = symbol
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .toLowerCase();
      if (asciiSymbol && normalized.includes(asciiSymbol)) {
        referenced = true;
      }
    }
    if (!referenced && id) {
      const idPattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i');
      if (idPattern.test(normalized)) {
        referenced = true;
      }
    }
    if (referenced) {
      dependencies.add(definition.id);
    }
  });
  return [...dependencies];
}

function clearTreeLayers() {
  stopSimulation();
  towerTreeState.nodes.clear();
  towerTreeState.edges = [];
  towerTreeState.nodeRadius = PHYSICS_CONFIG.nodeDiameter / 2;
  // Reset drag tracking so stale references do not linger between refreshes.
  towerTreeState.dragState.active = false;
  towerTreeState.dragState.pointerId = null;
  towerTreeState.dragState.nodeId = null;
  towerTreeState.dragState.moved = false;
  // Reset the viewport offset cache so pointer math recalculates accurately on rebuild.
  towerTreeState.linkOrigin = { x: 0, y: 0 };
  if (towerTreeState.nodeLayer) {
    towerTreeState.nodeLayer.innerHTML = '';
    towerTreeState.nodeLayer.style.width = '';
    towerTreeState.nodeLayer.style.height = '';
  }
  if (towerTreeState.linkLayer) {
    while (towerTreeState.linkLayer.firstChild) {
      towerTreeState.linkLayer.removeChild(towerTreeState.linkLayer.firstChild);
    }
    towerTreeState.linkLayer.setAttribute('viewBox', '0 0 0 0');
    towerTreeState.linkLayer.removeAttribute('width');
    towerTreeState.linkLayer.removeAttribute('height');
    towerTreeState.linkLayer.style.width = '';
    towerTreeState.linkLayer.style.height = '';
  }
  if (towerTreeState.mapContainer) {
    towerTreeState.mapContainer.style.minHeight = '';
  }
}

function createTreeNode(definition, position, indexInTier) {
  const node = document.createElement('div');
  node.className = 'tower-tree-node';

  const orbit = document.createElement('div');
  orbit.className = 'tower-tree-node-orbit';
  orbit.setAttribute('tabindex', '0');
  orbit.style.setProperty('--tower-float-variance', `${(indexInTier % 3) * 0.6}s`);

  const symbolEl = document.createElement('span');
  symbolEl.className = 'tower-tree-node-symbol';
  if (definition && definition.id === 'mind-gate' && definition.icon) {
    // Use the Mind Gate's rune sprite so the constellation node mirrors the tower finale.
    symbolEl.classList.add('tower-tree-node-symbol--icon');
    const iconEl = document.createElement('img');
    iconEl.className = 'tower-tree-node-icon';
    iconEl.src = definition.icon;
    iconEl.alt = definition.name || 'Mind Gate';
    iconEl.loading = 'lazy';
    iconEl.decoding = 'async';
    symbolEl.append(iconEl);
  } else {
    symbolEl.textContent = definition.symbol || definition.id;
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'tower-tree-node-name';
  nameEl.textContent = definition.name || definition.id;

  const tierEl = document.createElement('span');
  tierEl.className = 'tower-tree-node-tier';
  const tierValue = Number.isFinite(definition.tier) ? definition.tier : '?';
  tierEl.textContent = `Tier ${tierValue}`;

  orbit.append(symbolEl, nameEl, tierEl);
  node.append(orbit);
  return { element: node, orbit, position };
}

function buildTreeLinks(definitions, edges) {
  if (!towerTreeState.linkLayer || !towerTreeState.mapContainer) {
    return [];
  }
  const layerRect = towerTreeState.nodeLayer?.getBoundingClientRect();
  const containerRect = towerTreeState.mapContainer.getBoundingClientRect();
  // Fallback dimensions keep the SVG scalable even before layout settles on first open.
  const width = Math.max(
    1,
    layerRect?.width || containerRect.width || towerTreeState.mapContainer.clientWidth || 0,
  );
  const height = Math.max(
    1,
    layerRect?.height || containerRect.height || towerTreeState.mapContainer.clientHeight || 0,
  );
  towerTreeState.linkLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  towerTreeState.linkLayer.setAttribute('width', String(width));
  towerTreeState.linkLayer.setAttribute('height', String(height));
  towerTreeState.linkLayer.setAttribute('preserveAspectRatio', 'none');
  // Mirror the node layer's physical canvas so link transforms stay pixel-aligned.
  towerTreeState.linkLayer.style.width = `${width}px`;
  towerTreeState.linkLayer.style.height = `${height}px`;
  const offsetX = layerRect && containerRect
    ? layerRect.left - containerRect.left
    : (towerTreeState.nodeLayer?.offsetLeft || 0);
  const offsetY = layerRect && containerRect
    ? layerRect.top - containerRect.top
    : (towerTreeState.nodeLayer?.offsetTop || 0);
  // Store how far the world canvas sits inside the padded container for pointer math.
  towerTreeState.linkOrigin = { x: offsetX, y: offsetY };
  const tierById = new Map();
  definitions.forEach((definition) => {
    const tierValue = Number.isFinite(definition.tier) ? definition.tier : 0;
    tierById.set(definition.id, tierValue);
  });
  const orbitSample = towerTreeState.nodeLayer?.querySelector('.tower-tree-node-orbit');
  const measuredDiameter = orbitSample?.offsetWidth || PHYSICS_CONFIG.nodeDiameter;
  const baseLength = measuredDiameter * PHYSICS_CONFIG.targetLengthMultiplier;

  return edges.map(([fromId, toId]) => {
    const line = document.createElementNS(SVG_NS, 'line');
    line.classList.add('tower-tree-link');
    // Ensure map links remain smooth and rounded for better visibility.
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    towerTreeState.linkLayer.append(line);
    const fromTier = tierById.get(fromId) ?? 0;
    const toTier = tierById.get(toId) ?? 0;
    const tierDistance = Math.max(1, Math.abs(fromTier - toTier));
    return {
      fromId,
      toId,
      element: line,
      targetLength: baseLength * tierDistance,
    };
  });
}

/** Returns the tower card element that corresponds with a given node. */
function getTowerCardElement(towerId) {
  return (
    towerTreeState.cardGrid?.querySelector(`.card[data-tower-id="${towerId}"]`) || null
  );
}

/** Opens the tower upgrade overlay using the data connected to a map node. */
function openTowerOverlayFromTree(towerId, triggerElement) {
  const sourceCard = getTowerCardElement(towerId);
  openTowerUpgradeOverlay(towerId, { sourceCard, trigger: triggerElement });
}

/** Clamps a node position so it stays inside the visible tree canvas. */
function clampNodePosition(x, y) {
  const containerWidth = towerTreeState.nodeLayer?.offsetWidth || 0;
  const containerHeight = towerTreeState.nodeLayer?.offsetHeight || 0;
  const padding = Math.max(
    towerTreeState.nodeRadius,
    PHYSICS_CONFIG.nodeDiameter * PHYSICS_CONFIG.boundaryPaddingMultiplier,
  );
  const minX = padding;
  const maxX = Math.max(padding, containerWidth - padding);
  const minY = padding;
  const maxY = Math.max(padding, containerHeight - padding);
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

/** Updates a node's stored position, anchor, and DOM placement in one step. */
function setNodePosition(node, x, y, options = {}) {
  if (!node) {
    return;
  }
  const { updateAnchor = true, resetVelocity = true } = options;
  node.position.x = x;
  node.position.y = y;
  if (updateAnchor) {
    node.anchor.x = x;
    node.anchor.y = y;
  }
  if (resetVelocity) {
    node.velocity.x = 0;
    node.velocity.y = 0;
  }
  applyNodeDomPosition(node);
}

/** Begins a drag interaction when the player presses a node with the pointer. */
function beginNodeDrag(event, nodeRecord) {
  if (!nodeRecord || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  towerTreeState.dragState.active = true;
  towerTreeState.dragState.pointerId = event.pointerId;
  towerTreeState.dragState.nodeId = nodeRecord.id;
  towerTreeState.dragState.startPointer = { x: event.clientX, y: event.clientY };
  towerTreeState.dragState.startPosition = { ...nodeRecord.position };
  const startWorld = getTreeWorldPoint(event);
  towerTreeState.dragState.startWorld = startWorld
    ? { x: startWorld.x, y: startWorld.y }
    : { ...nodeRecord.position };
  towerTreeState.dragState.moved = false;
  towerTreeState.dragState.lastPointer = {
    x: event.clientX,
    y: event.clientY,
    time: resolveTimestamp(event),
  };
  towerTreeState.dragState.lastPosition = { ...nodeRecord.position };
  towerTreeState.dragState.velocity = { x: 0, y: 0 };
  nodeRecord.velocity.x = 0;
  nodeRecord.velocity.y = 0;
  nodeRecord.orbit.setPointerCapture(event.pointerId);
  nodeRecord.orbit.dataset.dragging = 'true';
}

/** Moves the active node while the pointer is dragged across the tree. */
function handleNodePointerMove(event) {
  const { dragState } = towerTreeState;
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }
  event.preventDefault();
  const nodeRecord = towerTreeState.nodes.get(dragState.nodeId);
  if (!nodeRecord) {
    return;
  }
  const dx = event.clientX - dragState.startPointer.x;
  const dy = event.clientY - dragState.startPointer.y;
  const distance = Math.hypot(dx, dy);
  if (!dragState.moved && distance > 4) {
    dragState.moved = true;
  }
  const pointerWorld = getTreeWorldPoint(event);
  const dxWorld = pointerWorld ? pointerWorld.x - dragState.startWorld.x : dx;
  const dyWorld = pointerWorld ? pointerWorld.y - dragState.startWorld.y : dy;
  const unclampedX = dragState.startPosition.x + dxWorld;
  const unclampedY = dragState.startPosition.y + dyWorld;
  const { x, y } = clampNodePosition(unclampedX, unclampedY);
  setNodePosition(nodeRecord, x, y, { updateAnchor: true, resetVelocity: false });

  const lastPointer =
    dragState.lastPointer || { x: event.clientX, y: event.clientY, time: resolveTimestamp(event) };
  const lastPosition = dragState.lastPosition || { x, y };
  const now = resolveTimestamp(event);
  const dt = Math.max(0, (now - (lastPointer.time || now)) / 1000);
  if (dt > 0) {
    const vx = (x - lastPosition.x) / dt;
    const vy = (y - lastPosition.y) / dt;
    const maxSpeed = PHYSICS_CONFIG.maxDragVelocity;
    // Clamp the fling speed so the constellation never snaps off screen.
    const clampedVx = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
    const clampedVy = Math.max(-maxSpeed, Math.min(maxSpeed, vy));
    dragState.velocity = { x: clampedVx, y: clampedVy };
  }
  dragState.lastPointer = { x: event.clientX, y: event.clientY, time: now };
  dragState.lastPosition = { x, y };
  updateLinkPositions();
}

/** Ends the drag interaction and opens the overlay if no movement occurred. */
function endNodeDrag(event) {
  const { dragState } = towerTreeState;
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }
  const nodeRecord = towerTreeState.nodes.get(dragState.nodeId);
  const movedDuringDrag = dragState.moved;
  const flingVelocity = movedDuringDrag ? { ...dragState.velocity } : { x: 0, y: 0 };
  dragState.active = false;
  dragState.pointerId = null;
  dragState.nodeId = null;
  dragState.moved = false;
  if (nodeRecord) {
    nodeRecord.orbit.releasePointerCapture(event.pointerId);
    nodeRecord.orbit.removeAttribute('data-dragging');
    const clamped = clampNodePosition(nodeRecord.position.x, nodeRecord.position.y);
    setNodePosition(nodeRecord, clamped.x, clamped.y, { updateAnchor: true, resetVelocity: false });
    if (movedDuringDrag) {
      // Apply the preserved pointer velocity so the node keeps gliding after release.
      nodeRecord.velocity.x = flingVelocity.x;
      nodeRecord.velocity.y = flingVelocity.y;
    }
  }
  dragState.velocity = { x: 0, y: 0 };
  dragState.lastPointer = { x: 0, y: 0, time: 0 };
  dragState.lastPosition = { x: 0, y: 0 };
  if (!nodeRecord) {
    return;
  }
  if (!movedDuringDrag) {
    openTowerOverlayFromTree(nodeRecord.id, nodeRecord.orbit);
  }
  if (!towerTreeState.animationHandle) {
    startSimulation();
  }
  updateLinkPositions();
}

/** Cancels a drag interaction if the pointer capture is lost abruptly. */
function cancelNodeDrag(event) {
  if (towerTreeState.dragState.pointerId !== event.pointerId) {
    return;
  }
  const nodeRecord = towerTreeState.nodes.get(towerTreeState.dragState.nodeId);
  towerTreeState.dragState.active = false;
  towerTreeState.dragState.pointerId = null;
  towerTreeState.dragState.nodeId = null;
  towerTreeState.dragState.moved = false;
  towerTreeState.dragState.velocity = { x: 0, y: 0 };
  towerTreeState.dragState.lastPointer = { x: 0, y: 0, time: 0 };
  towerTreeState.dragState.lastPosition = { x: 0, y: 0 };
  if (nodeRecord) {
    try {
      // Release any lingering capture so the cursor state resets cleanly.
      nodeRecord.orbit.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore browsers that throw when the capture is already cleared.
    }
    nodeRecord.orbit.removeAttribute('data-dragging');
  }
  // Re-sync constellation lines when a drag is cancelled mid-gesture.
  updateLinkPositions();
}

// Handle background pointer presses so the player can begin panning the tree view.
function handleTreePointerDown(event) {
  if (!towerTreeState.mapContainer) {
    return;
  }
  if (event.pointerType !== 'touch' && event.button !== 0) {
    return;
  }
  if (event.pointerType === 'touch' && typeof event.preventDefault === 'function') {
    // Stop the browser from hijacking touch gestures so the constellation can pan instead.
    event.preventDefault();
  }
  const view = towerTreeState.view;
  if (event.pointerType === 'touch') {
    view.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (view.activePointers.size >= 2) {
      view.pointer.active = false;
      view.pointer.pointerId = null;
      view.pointer.moved = false;
      view.pinchState = null;
      return;
    }
  }
  view.pointer.active = true;
  view.pointer.pointerId = event.pointerId;
  view.pointer.startX = event.clientX;
  view.pointer.startY = event.clientY;
  view.pointer.startCenter = { ...(view.center || { x: 0.5, y: 0.5 }) };
  view.pointer.moved = false;
  towerTreeState.suppressClick = false;
  if (typeof towerTreeState.mapContainer.setPointerCapture === 'function') {
    try {
      towerTreeState.mapContainer.setPointerCapture(event.pointerId);
    } catch (error) {
      // Ignore pointer capture failures so panning continues smoothly without it.
    }
  }
}

// Translate pointer drags into camera movement across the constellation map.
function handleTreePointerMove(event) {
  const view = towerTreeState.view;
  if (event.pointerType === 'touch') {
    view.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (view.activePointers.size >= 2) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      performTreePinchZoom();
      towerTreeState.suppressClick = true;
      return;
    }
  }
  if (!view.pointer.active || view.pointer.pointerId !== event.pointerId) {
    return;
  }
  const dx = event.clientX - view.pointer.startX;
  const dy = event.clientY - view.pointer.startY;
  const dragDistance = Math.hypot(dx, dy);
  if (!view.pointer.moved && dragDistance > 6) {
    view.pointer.moved = true;
    towerTreeState.suppressClick = true;
  }
  if (!view.pointer.moved) {
    return;
  }
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  // Read the active viewport to translate pixel deltas into constellation movement.
  const metrics = getMapMetrics();
  const width = metrics.viewportWidth;
  const height = metrics.viewportHeight;
  if (!width || !height) {
    return;
  }
  const scale = view.scale || 1;
  const startCenter = view.pointer.startCenter || view.center || { x: 0.5, y: 0.5 };
  const translationFactor = Number.isFinite(PHYSICS_CONFIG.panTranslationFactor)
    ? PHYSICS_CONFIG.panTranslationFactor
    : 1;
  const nextCenter = {
    // Soften pointer translation so short drags produce graceful camera motion.
    x: startCenter.x - (dx / (scale * width)) * translationFactor,
    y: startCenter.y - (dy / (scale * height)) * translationFactor,
  };
  setViewCenterNormalized(nextCenter);
}

// Reset panning state when the background pointer gesture completes.
function handleTreePointerUp(event) {
  const view = towerTreeState.view;
  if (event.pointerType === 'touch') {
    view.activePointers.delete(event.pointerId);
    if (view.activePointers.size < 2) {
      view.pinchState = null;
      view.isPinchZooming = false;
    }
  }
  if (view.pointer.pointerId === event.pointerId) {
    if (view.pointer.moved) {
      towerTreeState.suppressClick = true;
    }
    view.pointer.active = false;
    view.pointer.pointerId = null;
    view.pointer.moved = false;
  }
  if (typeof towerTreeState.mapContainer?.releasePointerCapture === 'function') {
    try {
      towerTreeState.mapContainer.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore release errors so cleanup continues even if capture was not set.
    }
  }
}

// Apply pinch gestures to zoom the tree while keeping the midpoint anchored.
function performTreePinchZoom() {
  const pointers = Array.from(towerTreeState.view.activePointers.values());
  if (pointers.length < 2) {
    towerTreeState.view.pinchState = null;
    towerTreeState.view.isPinchZooming = false;
    return;
  }
  const [first, second] = pointers;
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 0) {
    return;
  }
  const midpoint = {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
  const pinchState = towerTreeState.view.pinchState;
  if (!pinchState || !Number.isFinite(pinchState.startDistance) || pinchState.startDistance <= 0) {
    towerTreeState.view.pinchState = {
      startDistance: distance,
      startScale: towerTreeState.view.scale,
    };
    return;
  }
  const baseDistance = pinchState.startDistance;
  const baseScale = pinchState.startScale || towerTreeState.view.scale || 1;
  if (!Number.isFinite(baseDistance) || baseDistance <= 0) {
    return;
  }
  const targetScale = (distance / baseDistance) * baseScale;
  setTreeZoom(targetScale, midpoint);
  towerTreeState.view.pinchState.startScale = towerTreeState.view.scale;
  towerTreeState.view.pinchState.startDistance = distance;
  towerTreeState.view.isPinchZooming = true;
  towerTreeState.suppressClick = true;
}

// Consume click events that immediately follow a drag or pinch gesture on the map.
function handleTreeClick(event) {
  if (!towerTreeState.suppressClick) {
    return;
  }
  towerTreeState.suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}

// Map scroll wheel input onto zoom adjustments to mirror the playfield controls.
function handleTreeWheel(event) {
  if (!towerTreeState.mapContainer || towerTreeState.mapContainer.hidden) {
    return;
  }
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
  const factor = Math.exp(-delta * 0.0015);
  applyTreeZoomFactor(factor, event);
  towerTreeState.suppressClick = true;
}

/** Allows keyboard users to trigger the upgrade overlay from the constellation. */
function handleNodeKeyDown(event, nodeRecord) {
  if (!nodeRecord) {
    return;
  }
  const key = event.key?.toLowerCase();
  if (key === 'enter' || key === ' ') {
    event.preventDefault();
    openTowerOverlayFromTree(nodeRecord.id, nodeRecord.orbit);
  }
}

function applySpringForces() {
  towerTreeState.edges.forEach((edge) => {
    const nodeA = towerTreeState.nodes.get(edge.fromId);
    const nodeB = towerTreeState.nodes.get(edge.toId);
    if (!nodeA || !nodeB) {
      return;
    }
    const dx = nodeB.position.x - nodeA.position.x;
    const dy = nodeB.position.y - nodeA.position.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const difference = distance - edge.targetLength;
    const strength = PHYSICS_CONFIG.springStrength * difference;
    const forceX = (dx / distance) * strength;
    const forceY = (dy / distance) * strength;
    nodeA.force.x += forceX;
    nodeA.force.y += forceY;
    nodeB.force.x -= forceX;
    nodeB.force.y -= forceY;
  });
}

function applyAnchorForces() {
  towerTreeState.nodes.forEach((node) => {
    const anchorX = node.anchor.x;
    const anchorY = node.anchor.y;
    node.force.x += (anchorX - node.position.x) * PHYSICS_CONFIG.anchorStrength;
    node.force.y += (anchorY - node.position.y) * PHYSICS_CONFIG.anchorStrength;
  });
}

/** Keeps the alpha tower gently oriented near the constellation's crown. */
function applyAlphaOrientationForce() {
  const alphaNode = towerTreeState.nodes.get('alpha');
  if (!alphaNode) {
    return;
  }
  const layerHeight = towerTreeState.nodeLayer?.offsetHeight
    || towerTreeState.mapContainer?.clientHeight
    || 0;
  const targetRatio = Number.isFinite(PHYSICS_CONFIG.alphaTopNormalized)
    ? Math.max(0, PHYSICS_CONFIG.alphaTopNormalized)
    : 0.16;
  const preferredY = layerHeight > 0
    ? Math.min(alphaNode.anchor.y, layerHeight * targetRatio)
    : alphaNode.anchor.y;
  const orientationStrength = Number.isFinite(PHYSICS_CONFIG.alphaOrientationStrength)
    ? PHYSICS_CONFIG.alphaOrientationStrength
    : PHYSICS_CONFIG.anchorStrength;
  const displacement = preferredY - alphaNode.position.y;
  alphaNode.force.y += displacement * orientationStrength;
}

/** Applies a soft push back into the container whenever a node drifts off screen. */
function applyBoundaryForces(containerWidth, containerHeight) {
  const padding = Math.max(
    towerTreeState.nodeRadius,
    PHYSICS_CONFIG.nodeDiameter * PHYSICS_CONFIG.boundaryPaddingMultiplier,
  );
  const minX = padding;
  const maxX = Math.max(padding, containerWidth - padding);
  const minY = padding;
  const maxY = Math.max(padding, containerHeight - padding);
  towerTreeState.nodes.forEach((node) => {
    if (node.position.x < minX) {
      node.force.x += (minX - node.position.x) * PHYSICS_CONFIG.boundaryStrength;
    } else if (node.position.x > maxX) {
      node.force.x -= (node.position.x - maxX) * PHYSICS_CONFIG.boundaryStrength;
    }
    if (node.position.y < minY) {
      node.force.y += (minY - node.position.y) * PHYSICS_CONFIG.boundaryStrength;
    } else if (node.position.y > maxY) {
      node.force.y -= (node.position.y - maxY) * PHYSICS_CONFIG.boundaryStrength;
    }
  });
}

function applyRepulsionForces() {
  const nodeList = [...towerTreeState.nodes.values()];
  for (let i = 0; i < nodeList.length; i += 1) {
    for (let j = i + 1; j < nodeList.length; j += 1) {
      const nodeA = nodeList[i];
      const nodeB = nodeList[j];
      const dx = nodeB.position.x - nodeA.position.x;
      const dy = nodeB.position.y - nodeA.position.y;
      const distanceSq = dx * dx + dy * dy || 0.0001;
      const distance = Math.sqrt(distanceSq);
      // Use the larger physical diameter so circles never overlap visually.
      const minDistance = Math.max(
        PHYSICS_CONFIG.nodeDiameter,
        towerTreeState.nodeRadius * 2,
      );
      const strength = (PHYSICS_CONFIG.repulsionStrength / (distanceSq * Math.max(distance / minDistance, 0.35)));
      const forceX = (dx / distance) * strength;
      const forceY = (dy / distance) * strength;
      nodeA.force.x -= forceX;
      nodeA.force.y -= forceY;
      nodeB.force.x += forceX;
      nodeB.force.y += forceY;
    }
  }
}

function updateLinkPositions() {
  towerTreeState.edges.forEach((edge) => {
    const fromNode = towerTreeState.nodes.get(edge.fromId);
    const toNode = towerTreeState.nodes.get(edge.toId);
    if (!fromNode || !toNode) {
      return;
    }
    edge.element.setAttribute('x1', String(fromNode.position.x));
    edge.element.setAttribute('y1', String(fromNode.position.y));
    edge.element.setAttribute('x2', String(toNode.position.x));
    edge.element.setAttribute('y2', String(toNode.position.y));
  });
}

function stepSimulation(timestamp) {
  if (!towerTreeState.mapContainer || towerTreeState.mapContainer.hidden) {
    stopSimulation();
    return;
  }
  if (!towerTreeState.nodes.size) {
    stopSimulation();
    return;
  }
  if (towerTreeState.lastTimestamp === null) {
    towerTreeState.lastTimestamp = timestamp;
  }
  const deltaMs = timestamp - towerTreeState.lastTimestamp;
  const delta = Math.min(deltaMs / 1000, PHYSICS_CONFIG.maxDelta);
  towerTreeState.lastTimestamp = timestamp;

  const containerWidth = towerTreeState.nodeLayer?.offsetWidth || 0;
  const containerHeight = towerTreeState.nodeLayer?.offsetHeight || 0;

  towerTreeState.nodes.forEach((node) => {
    node.force.x = 0;
    node.force.y = 0;
  });

  applySpringForces();
  applyRepulsionForces();
  applyAnchorForces();
  applyAlphaOrientationForce();
  applyBoundaryForces(containerWidth, containerHeight);

  const draggedNodeId = towerTreeState.dragState.active
    ? towerTreeState.dragState.nodeId
    : null;

  towerTreeState.nodes.forEach((node, nodeId) => {
    if (nodeId === draggedNodeId) {
      // Skip integration for the actively dragged node so pointer control feels precise.
      node.velocity.x = 0;
      node.velocity.y = 0;
      applyNodeDomPosition(node);
      return;
    }
    const accelX = node.force.x;
    const accelY = node.force.y;
    node.velocity.x = (node.velocity.x + accelX * delta) * PHYSICS_CONFIG.damping;
    node.velocity.y = (node.velocity.y + accelY * delta) * PHYSICS_CONFIG.damping;
    node.position.x += node.velocity.x * delta;
    node.position.y += node.velocity.y * delta;
    applyNodeDomPosition(node);
  });

  updateLinkPositions();

  towerTreeState.animationHandle = window.requestAnimationFrame(stepSimulation);
}

function startSimulation() {
  stopSimulation();
  if (!towerTreeState.nodes.size) {
    // Skip scheduling frames until nodes exist to animate.
    return;
  }
  towerTreeState.animationHandle = window.requestAnimationFrame(stepSimulation);
}

function computeNodeLayout(towers) {
  if (!towers.length) {
    return { positions: new Map(), edges: [] };
  }
  const unlockedTiers = new Map();
  towers.forEach((tower) => {
    const tier = Number.isFinite(tower.tier) ? tower.tier : towers.indexOf(tower) + 1;
    if (!unlockedTiers.has(tier)) {
      unlockedTiers.set(tier, []);
    }
    unlockedTiers.get(tier).push(tower);
  });
  const tierOrder = [...unlockedTiers.keys()].sort((a, b) => a - b);
  const mapHeight = Math.max(260, tierOrder.length * 180);
  const paddingBottom = 72;
  const availableHeight = mapHeight - paddingBottom;
  const containerWidth = towerTreeState.nodeLayer?.offsetWidth
    || towerTreeState.mapContainer.clientWidth
    || 600;
  const positions = new Map();
  const equations = new Map();

  tierOrder.forEach((tier, tierIndex) => {
    const group = unlockedTiers.get(tier) || [];
    if (!group.length) {
      return;
    }
    const verticalSpacing = availableHeight / (tierOrder.length + 1);
    const y = Math.max(72, (tierIndex + 1) * verticalSpacing);
    const horizontalPadding = 80;
    const usableWidth = Math.max(200, containerWidth - horizontalPadding * 2);
    const step = group.length > 1 ? usableWidth / (group.length - 1) : 0;
    group.forEach((tower, index) => {
      const baseX = group.length > 1 ? horizontalPadding + index * step : containerWidth / 2;
      // Introduce a gentle horizontal jitter so icons feel organic without drifting off-grid.
      let horizontalVariance = towerTreeState.randomOffsets.get(tower.id);
      if (!Number.isFinite(horizontalVariance)) {
        horizontalVariance = (Math.random() * 2 - 1) * PHYSICS_CONFIG.nodeDiameter;
        towerTreeState.randomOffsets.set(tower.id, horizontalVariance);
      }
      const x = Math.max(
        horizontalPadding,
        Math.min(containerWidth - horizontalPadding, baseX + horizontalVariance),
      );
      positions.set(tower.id, { x, y });
      equations.set(tower.id, extractTowerEquation(tower.id));
    });
  });

  const edges = [];
  const edgeSet = new Set();
  towers.forEach((tower) => {
    const dependencies = collectTowerDependencies(equations.get(tower.id), towers, tower.id);
    dependencies.forEach((dependencyId) => {
      const key = [tower.id, dependencyId].sort().join('::');
      if (!edgeSet.has(key) && positions.has(tower.id) && positions.has(dependencyId)) {
        edgeSet.add(key);
        edges.push([tower.id, dependencyId]);
      }
    });
  });

  const hasMindGate = towers.some((tower) => tower.id === 'mind-gate');
  const hasAlpha = towers.some((tower) => tower.id === 'alpha');
  if (hasMindGate && hasAlpha) {
    // Explicitly anchor the Mind Gate to Alpha so the tree highlights the foundational link.
    const key = ['mind-gate', 'alpha'].sort().join('::');
    if (!edgeSet.has(key) && positions.has('mind-gate') && positions.has('alpha')) {
      edgeSet.add(key);
      edges.push(['mind-gate', 'alpha']);
    }
  }

  if (towerTreeState.nodeLayer) {
    // Resize the physics canvas so the viewport can pan across the entire layout.
    towerTreeState.nodeLayer.style.width = `${Math.max(1, containerWidth)}px`;
    towerTreeState.nodeLayer.style.height = `${Math.max(1, mapHeight)}px`;
  }
  if (towerTreeState.linkLayer) {
    towerTreeState.linkLayer.style.width = `${Math.max(1, containerWidth)}px`;
    towerTreeState.linkLayer.style.height = `${Math.max(1, mapHeight)}px`;
  }

  return { positions, edges };
}

function refreshTreeInternal() {
  if (!towerTreeState.mapContainer || towerTreeState.mapContainer.hidden) {
    towerTreeState.needsRefresh = true;
    return;
  }
  const unlockState = getTowerUnlockState();
  const unlocked = Array.from(unlockState.unlocked || []);
  const definitions = getTowerDefinitions().filter((definition) => unlocked.includes(definition.id));

  clearTreeLayers();
  if (!definitions.length) {
    return;
  }

  const { positions, edges } = computeNodeLayout(definitions);
  const nodes = new Map();
  let indexCounter = 0;
  positions.forEach((position, towerId) => {
    const definition = definitions.find((entry) => entry.id === towerId);
    if (!definition || !towerTreeState.nodeLayer) {
      return;
    }
    const node = createTreeNode(definition, position, indexCounter++);
    towerTreeState.nodeLayer.append(node.element);
    const width = node.element.offsetWidth || PHYSICS_CONFIG.nodeDiameter;
    const height = node.element.offsetHeight || PHYSICS_CONFIG.nodeDiameter;
    const nodeRecord = {
      id: towerId,
      definition,
      element: node.element,
      orbit: node.orbit,
      position: { ...position },
      anchor: { ...position },
      velocity: {
        x: 0,
        y: 0,
      },
      force: { x: 0, y: 0 },
      size: { width, height },
    };
    // Track the largest radius so boundary forces and dragging stay accurate.
    towerTreeState.nodeRadius = Math.max(towerTreeState.nodeRadius, width / 2);
    applyNodeDomPosition(nodeRecord);
    nodes.set(towerId, nodeRecord);
    // Attach pointer and keyboard handlers so players can drag and inspect nodes.
    node.orbit.addEventListener('pointerdown', (event) => beginNodeDrag(event, nodes.get(towerId)));
    node.orbit.addEventListener('pointermove', handleNodePointerMove);
    node.orbit.addEventListener('pointerup', endNodeDrag);
    node.orbit.addEventListener('pointercancel', cancelNodeDrag);
    node.orbit.addEventListener('keydown', (event) => handleNodeKeyDown(event, nodes.get(towerId)));
    node.orbit.addEventListener('click', (event) => {
      // Prevent duplicate focus-triggered clicks after the drag handlers finish.
      event.preventDefault();
    });
  });

  towerTreeState.nodes = nodes;
  towerTreeState.edges = buildTreeLinks(definitions, edges);
  updateLinkPositions();
  towerTreeState.view.center = clampViewCenterNormalized(towerTreeState.view.center);
  applyViewTransform();
  startSimulation();
  towerTreeState.needsRefresh = false;
}

function toggleTreeVisibility(forceOpen = null) {
  if (!towerTreeState.toggleButton || !towerTreeState.mapContainer || !towerTreeState.cardGrid) {
    return;
  }
  const currentlyOpen = !towerTreeState.mapContainer.hidden;
  const nextOpen = forceOpen === null ? !currentlyOpen : Boolean(forceOpen);
  if (!currentlyOpen && nextOpen) {
    // Reset variance on fresh openings so each visit gets a new constellation drift.
    towerTreeState.randomOffsets.clear();
  }
  if (currentlyOpen && !nextOpen) {
    // Release stored offsets when closing so memory stays tidy between sessions.
    towerTreeState.randomOffsets.clear();
  }
  towerTreeState.mapContainer.hidden = !nextOpen;
  towerTreeState.mapContainer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
  towerTreeState.cardGrid.hidden = nextOpen;
  towerTreeState.cardGrid.setAttribute('aria-hidden', nextOpen ? 'true' : 'false');
  towerTreeState.toggleButton.setAttribute('aria-pressed', nextOpen ? 'true' : 'false');
  towerTreeState.toggleButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  const buttonLabel = towerTreeState.toggleButton.querySelector('.tower-tree-map-label');
  if (buttonLabel) {
    // Communicate the current action clearly so players know how to return to cards.
    buttonLabel.textContent = nextOpen ? 'Back to Tower Cards' : 'Tower Tree Map';
  }
  if (towerTreeState.toggleButton) {
    // Keep the button tooltip and announcement aligned with the current view for accessibility.
    towerTreeState.toggleButton.title = nextOpen
      ? 'Return to the tower card menu'
      : 'Open the Tower Tree Map';
    towerTreeState.toggleButton.setAttribute(
      'aria-label',
      nextOpen ? 'Return to the tower card menu' : 'Open the Tower Tree Map',
    );
  }
  if (nextOpen) {
    // Delay the refresh until the next frame so layout metrics are reliable when building links.
    window.requestAnimationFrame(() => {
      refreshTreeInternal();
    });
  } else {
    stopSimulation();
  }
}

function scheduleTreeRefresh() {
  if (towerTreeState.needsRefresh) {
    return;
  }
  towerTreeState.needsRefresh = true;
  if (towerTreeState.mapContainer && !towerTreeState.mapContainer.hidden) {
    window.requestAnimationFrame(() => refreshTreeInternal());
  }
}

export function refreshTowerTreeMap() {
  refreshTreeInternal();
}

export function initializeTowerTreeMap({ toggleButton = null, mapContainer = null, cardGrid = null } = {}) {
  towerTreeState.toggleButton = toggleButton;
  towerTreeState.mapContainer = mapContainer;
  towerTreeState.cardGrid = cardGrid;
  towerTreeState.nodeLayer = mapContainer?.querySelector('[data-tree-node-layer]') || null;
  towerTreeState.linkLayer = mapContainer?.querySelector('svg') || null;

  towerTreeState.view.activePointers = new Map();
  towerTreeState.view.pinchState = null;
  applyViewTransform();

  if (towerTreeState.toggleButton) {
    towerTreeState.toggleButton.addEventListener('click', () => toggleTreeVisibility());
  }

  if (towerTreeState.mapContainer && !towerTreeState.mapContainer.dataset.treeViewBound) {
    towerTreeState.mapContainer.addEventListener('pointerdown', handleTreePointerDown);
    towerTreeState.mapContainer.addEventListener('pointermove', handleTreePointerMove);
    towerTreeState.mapContainer.addEventListener('pointerup', handleTreePointerUp);
    towerTreeState.mapContainer.addEventListener('pointercancel', handleTreePointerUp);
    towerTreeState.mapContainer.addEventListener('lostpointercapture', handleTreePointerUp);
    towerTreeState.mapContainer.addEventListener('wheel', handleTreeWheel, { passive: false });
    towerTreeState.mapContainer.addEventListener('click', handleTreeClick, true);
    towerTreeState.mapContainer.dataset.treeViewBound = 'true';
  }

  document.addEventListener('tower-unlocked', scheduleTreeRefresh);
  window.addEventListener('resize', scheduleTreeRefresh);
  scheduleTreeRefresh();
}
