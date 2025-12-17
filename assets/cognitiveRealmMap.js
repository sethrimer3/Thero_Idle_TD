// Cognitive Realm Territories Map - Visual representation of abstract territory control.
// This module renders an interactive, zoomable map showing player vs enemy territories.

import {
  getTerritories,
  getGridDimensions,
  getTerritoryStats,
  TERRITORY_NEUTRAL,
  TERRITORY_PLAYER,
  TERRITORY_ENEMY,
} from './state/cognitiveRealmState.js';

// Map rendering configuration
const MAP_PADDING = 40;
const BASE_TERRITORY_SIZE = 50;
const TERRITORY_GAP = 8;

// Zoom configuration
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

// Visual configuration
const FONT_FAMILY = 'Cormorant Garamond';
const COLOR_NEURON_WEB = 'rgba(139, 247, 255, 0.12)';
const COLOR_PLAYER_FILL = 'rgba(108, 193, 255, 0.32)';
const COLOR_PLAYER_STROKE = 'rgba(160, 242, 255, 0.95)';
const COLOR_PLAYER_TERRITORY = 'rgba(54, 129, 255, 0.35)';
const COLOR_PLAYER_CONNECTION = 'rgba(160, 242, 255, 0.35)';
const COLOR_ENEMY_FILL = 'rgba(255, 96, 128, 0.32)';
const COLOR_ENEMY_STROKE = 'rgba(255, 70, 110, 0.9)';
const COLOR_ENEMY_TERRITORY = 'rgba(120, 24, 36, 0.45)';
const COLOR_ENEMY_CONNECTION = 'rgba(255, 84, 130, 0.32)';
const COLOR_NEUTRAL_FILL = 'rgba(247, 247, 245, 0.05)';
const COLOR_NEUTRAL_STROKE = 'rgba(247, 247, 245, 0.25)';
const COLOR_BG = '#000000'; // Solid black background
const COLOR_UI_BG = 'rgba(0, 0, 0, 0.85)';
const COLOR_UI_BORDER = 'rgba(139, 247, 255, 0.3)';
const COLOR_TEXT = 'rgba(247, 247, 245, 0.9)';
const COLOR_TEXT_PLAYER = 'rgba(139, 247, 255, 0.9)';
const COLOR_TEXT_ENEMY = 'rgba(255, 125, 235, 0.9)';
const COLOR_TEXT_MUTED = 'rgba(247, 247, 245, 0.6)';
const COLOR_NODE_GLOW = 'rgba(139, 247, 255, 0.5)';
const COLOR_BACKGROUND_BLUE = 'rgba(64, 112, 160, 0.2)';
const COLOR_BACKGROUND_EMBER = 'rgba(120, 40, 60, 0.25)';
const BACKGROUND_NEURON_COUNT = 72;
const FLOATING_LIGHT_COUNT = 56;
const PARALLAX_LAYERS = 7;
const COLOR_PLAYER_GLOW = 'rgba(160, 242, 255, 0.36)';
const COLOR_ENEMY_GLOW = 'rgba(255, 84, 130, 0.36)';
const COLOR_NEUTRAL_GLOW = 'rgba(255, 221, 120, 0.32)';

// Zoom and pan state
let currentZoom = 1.0;
let currentPanX = 0;
let currentPanY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoved = false;

// Canvas and container references
let mapCanvas = null;
let mapContext = null;
let mapContainer = null;
let backgroundWidth = 0;
let backgroundHeight = 0;

// Animation frame reference
let animationFrameId = null;
let lastRenderTimestamp = performance.now ? performance.now() : Date.now();

// Selected node for showing description
let selectedNode = null;
let descriptionModal = null;
let parallaxNeurons = [];
let floatingLights = [];

// Physics state for drifting nodes
let nodePhysicsState = new Map(); // Map<territoryId, { offsetX, offsetY, vx, vy, targetOffsetX, targetOffsetY }>

// Node drift configuration
const NODE_DRIFT_SPEED = 0.0008; // Speed of drift movement
const NODE_DRIFT_RANGE = 12; // Maximum drift distance from center position
const NODE_DRIFT_DAMPING = 0.92; // Velocity damping for smooth motion
const NODE_DRIFT_CHANGE_INTERVAL = 8000; // Time between drift target changes (ms)
const ROPE_SEGMENTS = 5; // Number of segments in each rope connection

// Lightweight deterministic jitter so organic lines stay stable per node pair
function organicNoise(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Normalize radius sizing between archetype anchors and emotion satellites
function getNodeRadius(territory) {
  return BASE_TERRITORY_SIZE * (territory.nodeType === 'archetype' ? 0.46 : 0.32);
}

// Build node label from archetype or emotion identity
function getNodeLabel(territory) {
  if (territory.archetype) {
    return territory.archetype.id.split('-')[0].toUpperCase().substring(0, 3);
  }

  if (territory.emotion) {
    return territory.emotion.name.toUpperCase().substring(0, 3);
  }

  return '---';
}

// Initialize physics state for a territory node
function initializeNodePhysics(territory) {
  if (!nodePhysicsState.has(territory.id)) {
    nodePhysicsState.set(territory.id, {
      offsetX: 0,
      offsetY: 0,
      vx: 0,
      vy: 0,
      targetOffsetX: (Math.random() - 0.5) * NODE_DRIFT_RANGE,
      targetOffsetY: (Math.random() - 0.5) * NODE_DRIFT_RANGE,
      lastTargetChange: performance.now ? performance.now() : Date.now(),
    });
  }
}

// Update node physics to create gentle drifting motion
function updateNodePhysics(territory, deltaMs) {
  initializeNodePhysics(territory);
  const physics = nodePhysicsState.get(territory.id);
  const now = performance.now ? performance.now() : Date.now();
  
  // Change drift target periodically
  if (now - physics.lastTargetChange > NODE_DRIFT_CHANGE_INTERVAL) {
    physics.targetOffsetX = (Math.random() - 0.5) * NODE_DRIFT_RANGE * 2;
    physics.targetOffsetY = (Math.random() - 0.5) * NODE_DRIFT_RANGE * 2;
    physics.lastTargetChange = now;
  }
  
  // Apply spring force toward target
  const dx = physics.targetOffsetX - physics.offsetX;
  const dy = physics.targetOffsetY - physics.offsetY;
  
  physics.vx += dx * NODE_DRIFT_SPEED * deltaMs;
  physics.vy += dy * NODE_DRIFT_SPEED * deltaMs;
  
  // Apply damping
  physics.vx *= NODE_DRIFT_DAMPING;
  physics.vy *= NODE_DRIFT_DAMPING;
  
  // Update position
  physics.offsetX += physics.vx * deltaMs * 0.01;
  physics.offsetY += physics.vy * deltaMs * 0.01;
  
  // Clamp to max range
  const distance = Math.sqrt(physics.offsetX ** 2 + physics.offsetY ** 2);
  if (distance > NODE_DRIFT_RANGE) {
    const scale = NODE_DRIFT_RANGE / distance;
    physics.offsetX *= scale;
    physics.offsetY *= scale;
    physics.vx *= 0.5;
    physics.vy *= 0.5;
  }
}

// Get node position with physics offset applied
function getNodePosition(node) {
  const physics = nodePhysicsState.get(node.territory.id);
  if (physics) {
    return {
      x: node.x + physics.offsetX,
      y: node.y + physics.offsetY,
    };
  }
  return { x: node.x, y: node.y };
}

// Seed background neuron wisps and floating lights for parallax depth
function seedBackgroundElements(width, height) {
  parallaxNeurons = Array.from({ length: BACKGROUND_NEURON_COUNT }, (_, index) => {
    const layer = index % PARALLAX_LAYERS;
    const depth = (layer + 1) / PARALLAX_LAYERS;
    return {
      x: Math.random(),
      y: Math.random(),
      depth,
      layer,
      sway: 6 + Math.random() * 14,
      speed: 0.03 + Math.random() * 0.07,
      phase: organicNoise(index + 1) * Math.PI * 2,
    };
  });

  floatingLights = Array.from({ length: FLOATING_LIGHT_COUNT }, (_, index) => {
    const ownershipRoll = Math.random();
    const hue = ownershipRoll < 0.4 ? 'player' : ownershipRoll < 0.8 ? 'enemy' : 'neutral';
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      size: 0.9 + Math.random() * 3.6,
      hue,
      layer: index % PARALLAX_LAYERS,
    };
  });
}

// Clamp pan offsets so the map cannot drift too far off-screen
function clampPanToBounds() {
  if (!mapCanvas) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = mapCanvas.width / dpr;
  const height = mapCanvas.height / dpr;

  const gridDims = getGridDimensions();
  const totalWidth = gridDims.width * (BASE_TERRITORY_SIZE + TERRITORY_GAP);
  const totalHeight = gridDims.height * (BASE_TERRITORY_SIZE + TERRITORY_GAP);

  const mapWidth = totalWidth * currentZoom;
  const mapHeight = totalHeight * currentZoom;
  const panMargin = MAP_PADDING + 40;

  const maxPanX = Math.max(0, (mapWidth - width) / 2 + panMargin);
  const maxPanY = Math.max(0, (mapHeight - height) / 2 + panMargin);

  currentPanX = Math.min(maxPanX, Math.max(-maxPanX, currentPanX));
  currentPanY = Math.min(maxPanY, Math.max(-maxPanY, currentPanY));
}

/**
 * Initialize the cognitive realm map with container and canvas elements.
 * @param {HTMLElement} container - The container element for the map
 * @param {HTMLCanvasElement} canvas - The canvas element for rendering
 */
export function initializeCognitiveRealmMap(container, canvas) {
  mapContainer = container;
  mapCanvas = canvas;
  
  if (!mapCanvas) {
    console.warn('Cognitive realm map canvas not found');
    return;
  }
  
  mapContext = mapCanvas.getContext('2d');
  
  // Set up canvas size
  resizeCanvas();
  
  // Create description modal
  createDescriptionModal();
  
  // Bind interaction handlers
  bindMapInteractions();
  
  // Start render loop
  startRenderLoop();
}

/**
 * Resize canvas to match container dimensions
 */
function resizeCanvas() {
  if (!mapCanvas || !mapContainer) {
    return;
  }

  const rect = mapContainer.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const width = rect.width || mapContainer.clientWidth || 1;
  const height = rect.height || mapContainer.clientHeight || 1;

  mapCanvas.width = width * dpr;
  mapCanvas.height = height * dpr;
  mapCanvas.style.width = `${width}px`;
  mapCanvas.style.height = `${height}px`;
  backgroundWidth = width;
  backgroundHeight = height;

  if (mapContext) {
    mapContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  seedBackgroundElements(width, height);
  clampPanToBounds();
}

/**
 * Bind mouse and touch interactions for zoom and pan
 */
function bindMapInteractions() {
  if (!mapCanvas) {
    return;
  }
  
  // Pointer down - start dragging
  mapCanvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerMoved = false;
    mapCanvas.style.cursor = 'grabbing';
  });

  // Pointer move - pan the map
  mapCanvas.addEventListener('pointermove', (e) => {
    if (!isDragging) {
      return;
    }

    const deltaX = e.clientX - lastPointerX;
    const deltaY = e.clientY - lastPointerY;

    pointerMoved =
      pointerMoved ||
      Math.abs(e.clientX - pointerStartX) > 4 ||
      Math.abs(e.clientY - pointerStartY) > 4;

    currentPanX += deltaX;
    currentPanY += deltaY;

    clampPanToBounds();

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });
  
  // Pointer up - stop dragging or handle click
  mapCanvas.addEventListener('pointerup', (e) => {
    isDragging = false;
    mapCanvas.style.cursor = 'grab';

    // Only treat as click if pointer didn't move much
    const deltaX = Math.abs(e.clientX - pointerStartX);
    const deltaY = Math.abs(e.clientY - pointerStartY);
    const isClick = deltaX < 5 && deltaY < 5 && !pointerMoved;

    if (isClick) {
      handleNodeClick(e);
    }
  });
  
  // Pointer cancel - stop dragging
  mapCanvas.addEventListener('pointercancel', () => {
    isDragging = false;
    mapCanvas.style.cursor = 'grab';
  });
  
  // Wheel - zoom
  mapCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = currentZoom * zoomDelta;

    // Clamp zoom between configured limits
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    clampPanToBounds();
  }, { passive: false });
  
  // Touch gestures for pinch zoom
  let touchStartDistance = 0;
  let touchStartZoom = 1.0;
  
  mapCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      touchStartZoom = currentZoom;
    }
  });
  
  mapCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const scale = distance / touchStartDistance;
      const newZoom = touchStartZoom * scale;

      // Clamp zoom between configured limits
      currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      clampPanToBounds();
    }
  }, { passive: false });
  
  // Reset zoom and pan with double-click
  mapCanvas.addEventListener('dblclick', () => {
    currentZoom = 1.0;
    currentPanX = 0;
    currentPanY = 0;
    clampPanToBounds();
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
}

/**
 * Start the render loop
 */
function startRenderLoop() {
  if (animationFrameId) {
    return;
  }

  function render(timestamp) {
    const deltaMs = Math.min(64, Math.max(0, timestamp - lastRenderTimestamp));
    lastRenderTimestamp = timestamp;

    renderMap(deltaMs);
    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame((timestamp) => {
    lastRenderTimestamp = timestamp;
    render(timestamp);
  });
}

/**
 * Stop the render loop
 */
export function stopCognitiveRealmMap() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Create a modal element for displaying archetype descriptions
 */
function createDescriptionModal() {
  if (descriptionModal) {
    return; // Already created
  }
  
  descriptionModal = document.createElement('div');
  descriptionModal.className = 'cognitive-realm-modal';
  descriptionModal.hidden = true;
  descriptionModal.innerHTML = `
    <div class="cognitive-realm-modal__backdrop"></div>
    <div class="cognitive-realm-modal__content">
      <button class="cognitive-realm-modal__close" aria-label="Close description">&times;</button>
      <h3 class="cognitive-realm-modal__title"></h3>
      <p class="cognitive-realm-modal__description"></p>
    </div>
  `;
  
  document.body.appendChild(descriptionModal);
  
  // Close modal when clicking backdrop or close button
  const backdrop = descriptionModal.querySelector('.cognitive-realm-modal__backdrop');
  const closeBtn = descriptionModal.querySelector('.cognitive-realm-modal__close');
  
  backdrop.addEventListener('click', closeDescriptionModal);
  closeBtn.addEventListener('click', closeDescriptionModal);
}

/**
 * Close the description modal
 */
function closeDescriptionModal() {
  if (descriptionModal) {
    descriptionModal.hidden = true;
    selectedNode = null;
  }
}

/**
 * Show node description in modal
 */
function showNodeDescription(territory) {
  if (!descriptionModal || !territory) {
    return;
  }

  const isPlayerOwned = territory.owner === TERRITORY_PLAYER;
  const isEnemyOwned = territory.owner === TERRITORY_ENEMY;

  // Determine which version to show for archetypes and emotional nodes
  let displayName = 'Unlabeled Node';
  let displayDescription = 'Neutral drift with no active imprint yet.';

  if (territory.archetype) {
    const archetype = territory.archetype;
    if (isPlayerOwned) {
      displayName = archetype.positive.name;
      displayDescription = archetype.positive.description;
    } else if (isEnemyOwned) {
      displayName = archetype.negative.name;
      displayDescription = archetype.negative.description;
    } else {
      displayName = `${archetype.positive.name} ↔ ${archetype.negative.name}`;
      displayDescription = `Positive: ${archetype.positive.description}\n\nNegative: ${archetype.negative.description}`;
    }
  } else if (territory.emotion) {
    const emotion = territory.emotion;
    const polarityLabel = emotion.polarity === 'positive' ? 'Positive affect' : 'Shadow affect';

    if (isPlayerOwned && emotion.polarity === 'negative') {
      displayName = `${emotion.counterpart} (stabilized from ${emotion.name})`;
      displayDescription = `${polarityLabel}: ${emotion.description}\nCounterpart reclaimed: ${emotion.counterpart}`;
    } else if (isEnemyOwned && emotion.polarity === 'positive') {
      displayName = `${emotion.counterpart} (inverted from ${emotion.name})`;
      displayDescription = `${polarityLabel}: ${emotion.description}\nShadow counterpart: ${emotion.counterpart}`;
    } else {
      displayName = `${emotion.name} ↔ ${emotion.counterpart}`;
      displayDescription = `${polarityLabel}: ${emotion.description}\nCounterpart: ${emotion.counterpart}`;
    }
  }

  const titleEl = descriptionModal.querySelector('.cognitive-realm-modal__title');
  const descEl = descriptionModal.querySelector('.cognitive-realm-modal__description');

  titleEl.textContent = displayName;
  descEl.textContent = displayDescription;

  // Apply styling based on ownership
  const contentEl = descriptionModal.querySelector('.cognitive-realm-modal__content');
  contentEl.classList.remove('modal-player', 'modal-enemy', 'modal-neutral');
  if (isPlayerOwned) {
    contentEl.classList.add('modal-player');
  } else if (isEnemyOwned) {
    contentEl.classList.add('modal-enemy');
  } else {
    contentEl.classList.add('modal-neutral');
  }

  descriptionModal.hidden = false;
  selectedNode = territory;
}

/**
 * Handle click on canvas to detect node selection
 */
function handleNodeClick(e) {
  if (!mapCanvas || !mapContext) {
    return;
  }
  
  const rect = mapCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  const width = mapCanvas.width / (window.devicePixelRatio || 1);
  const height = mapCanvas.height / (window.devicePixelRatio || 1);
  
  // Transform click coordinates to map space
  const centerX = width / 2;
  const centerY = height / 2;
  
  const mapX = (clickX - centerX - currentPanX) / currentZoom;
  const mapY = (clickY - centerY - currentPanY) / currentZoom;
  
  // Get territories and calculate positions
  const territories = getTerritories();
  const gridDims = getGridDimensions();
  
  const totalWidth = gridDims.width * (BASE_TERRITORY_SIZE + TERRITORY_GAP);
  const totalHeight = gridDims.height * (BASE_TERRITORY_SIZE + TERRITORY_GAP);
  const offsetX = -totalWidth / 2;
  const offsetY = -totalHeight / 2;
  
  const nodePositions = buildNodePositions(territories, offsetX, offsetY);

  // Check if click is on any node (using physics-offset positions)
  for (const node of nodePositions) {
    const pos = getNodePosition(node);
    const distance = Math.sqrt((mapX - pos.x) ** 2 + (mapY - pos.y) ** 2);

    if (distance <= node.radius) {
      showNodeDescription(node.territory);
      return;
    }
  }
}

/**
 * Render the cognitive realm map with territories
 */
function renderMap(deltaMs = 16) {
  if (!mapContext || !mapCanvas) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = mapCanvas.width / dpr;
  const height = mapCanvas.height / dpr;

  // Clear canvas with dark background
  mapContext.fillStyle = COLOR_BG;
  mapContext.fillRect(0, 0, width, height);

  renderBackgroundParallax(mapContext, width, height, deltaMs);
  updateFloatingLights(deltaMs, width, height);
  renderFloatingLightsOverlay(mapContext, width, height);

  // Save context state for transformations
  mapContext.save();

  // Apply pan and zoom transformations
  mapContext.translate(currentPanX, currentPanY);
  mapContext.translate(width / 2, height / 2);
  mapContext.scale(currentZoom, currentZoom);

  // Get territories and grid dimensions
  const territories = getTerritories();
  const gridDims = getGridDimensions();

  // Calculate map centering offset
  const totalWidth = gridDims.width * (BASE_TERRITORY_SIZE + TERRITORY_GAP);
  const totalHeight = gridDims.height * (BASE_TERRITORY_SIZE + TERRITORY_GAP);
  const offsetX = -totalWidth / 2;
  const offsetY = -totalHeight / 2;

  const nodePositions = buildNodePositions(territories, offsetX, offsetY);
  
  // Update physics for all nodes
  nodePositions.forEach((node) => {
    updateNodePhysics(node.territory, deltaMs);
  });

  renderTerritoryFields(mapContext, nodePositions);
  renderSoftBodyConnections(mapContext, nodePositions);
  renderSignalSparks(mapContext, nodePositions, deltaMs);

  nodePositions.forEach((node) => {
    renderRealmNode(mapContext, node);
  });

  // Restore context state
  mapContext.restore();

  // Render UI overlay (zoom level, stats)
  renderUIOverlay(mapContext, width, height);
}

// Build node positions so multiple render passes can share a single layout calculation
function buildNodePositions(territories, offsetX, offsetY) {
  return territories.map((territory) => ({
    x: offsetX + territory.x * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2,
    y: offsetY + territory.y * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2,
    radius: getNodeRadius(territory),
    territory,
  }));
}

// Render atmospheric parallax layers with blurred neuron wisps
function renderBackgroundParallax(ctx, width, height, deltaMs) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  parallaxNeurons.forEach((neuron, index) => {
    neuron.phase += neuron.speed * deltaMs * 0.001;
    const parallaxOffset = 0.05 + neuron.layer * 0.01;
    const px = neuron.x * width + currentPanX * parallaxOffset;
    const py = neuron.y * height + currentPanY * parallaxOffset;
    const wobble = Math.sin(neuron.phase * 2) * neuron.sway;
    const radius = 10 * neuron.depth + neuron.layer * 0.8;
    const alpha = 0.14 - neuron.layer * 0.01;

    ctx.filter = `blur(${0.6 + neuron.layer * 0.85}px)`;

    const gradient = ctx.createRadialGradient(
      px,
      py + wobble * 0.1,
      radius * 0.18,
      px,
      py + wobble * 0.1,
      radius * 1.8
    );
    gradient.addColorStop(0, COLOR_BACKGROUND_BLUE);
    gradient.addColorStop(0.45, COLOR_NEURON_WEB);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.globalAlpha = Math.max(0.04, alpha);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py + wobble, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    if (index % 5 === 0) {
      ctx.strokeStyle = COLOR_BACKGROUND_EMBER;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px - wobble * 0.1, py - radius * 0.8);
      ctx.quadraticCurveTo(px + wobble * 0.2, py, px + radius * 0.8, py + wobble * 0.1);
      ctx.stroke();
    }
  });

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Drift floating motes in screen space for mystical ambiance
function updateFloatingLights(deltaMs, width, height) {
  const delta = deltaMs * 0.06;
  floatingLights.forEach((light, index) => {
    light.x += light.vx * delta;
    light.y += light.vy * delta;

    if (light.x < -10) light.x = width + 10;
    if (light.x > width + 10) light.x = -10;
    if (light.y < -10) light.y = height + 10;
    if (light.y > height + 10) light.y = -10;

    if (organicNoise(index + lastRenderTimestamp) > 0.995) {
      light.vx = (Math.random() - 0.5) * 0.12;
      light.vy = (Math.random() - 0.5) * 0.12;
    }
  });
}

// Paint softly glowing floating lights above the map layer
function renderFloatingLightsOverlay(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.32;

  floatingLights.forEach((light) => {
    const parallaxOffset = 0.03 + light.layer * 0.01;
    const px = light.x + currentPanX * parallaxOffset;
    const py = light.y + currentPanY * parallaxOffset;
    const color = light.hue === 'player'
      ? COLOR_PLAYER_GLOW
      : light.hue === 'enemy'
        ? COLOR_ENEMY_GLOW
        : COLOR_NEUTRAL_GLOW;
    const radius = light.size * 6.4;
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

// Render faction territories as blended heat fields and connective tissue
function renderTerritoryFields(ctx, nodePositions) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  nodePositions.forEach((node) => {
    if (node.territory.owner === TERRITORY_NEUTRAL) {
      return;
    }

    // Get actual position with physics offset
    const pos = getNodePosition(node);
    
    const isPlayer = node.territory.owner === TERRITORY_PLAYER;
    const baseRadius = node.radius * 3.2;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, baseRadius * 0.25, pos.x, pos.y, baseRadius);

    if (isPlayer) {
      gradient.addColorStop(0, 'rgba(120, 200, 255, 0.55)');
      gradient.addColorStop(0.45, COLOR_PLAYER_TERRITORY);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 70, 110, 0.55)');
      gradient.addColorStop(0.45, COLOR_ENEMY_TERRITORY);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Blend connective tissue between adjacent same-faction nodes
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      const nodeA = nodePositions[i];
      const nodeB = nodePositions[j];

      if (nodeA.territory.owner === TERRITORY_NEUTRAL || nodeA.territory.owner !== nodeB.territory.owner) {
        continue;
      }

      const dx = nodeA.territory.x - nodeB.territory.x;
      const dy = nodeA.territory.y - nodeB.territory.y;
      const gridDistance = Math.sqrt(dx * dx + dy * dy);
      if (gridDistance > 2.4) {
        continue;
      }

      // Get actual positions with physics offsets
      const posA = getNodePosition(nodeA);
      const posB = getNodePosition(nodeB);
      
      const isPlayer = nodeA.territory.owner === TERRITORY_PLAYER;
      const color = isPlayer ? 'rgba(120, 200, 255, 0.35)' : 'rgba(255, 70, 110, 0.35)';
      const controlSeed = (i + 1) * (j + 3);
      const controlJitter = (organicNoise(controlSeed) - 0.5) * 18;
      const ctrlX = (posA.x + posB.x) / 2 + controlJitter;
      const ctrlY = (posA.y + posB.y) / 2 - controlJitter;

      ctx.strokeStyle = color;
      ctx.lineWidth = (nodeA.radius + nodeB.radius) * 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, posB.x, posB.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Soft-body rope connections that flex and sway as nodes drift
function renderSoftBodyConnections(ctx, nodePositions) {
  ctx.save();
  nodePositions.forEach((node1, i) => {
    nodePositions.forEach((node2, j) => {
      if (i >= j) return;

      const dx = node1.territory.x - node2.territory.x;
      const dy = node1.territory.y - node2.territory.y;
      const gridDistance = Math.sqrt(dx * dx + dy * dy);
      const sharedOwner = node1.territory.owner === node2.territory.owner && node1.territory.owner !== TERRITORY_NEUTRAL;
      const shouldConnect = sharedOwner ? gridDistance <= 3.6 : gridDistance <= 1.8;

      if (!shouldConnect) {
        return;
      }

      const color = sharedOwner
        ? (node1.territory.owner === TERRITORY_PLAYER ? COLOR_PLAYER_CONNECTION : COLOR_ENEMY_CONNECTION)
        : COLOR_NEURON_WEB;

      const intensity = sharedOwner ? 0.9 : 0.5;
      
      // Get actual positions with physics offsets
      const pos1 = getNodePosition(node1);
      const pos2 = getNodePosition(node2);
      
      // Calculate rope physics - simulate a hanging rope with gravity-like sag
      const actualDx = pos2.x - pos1.x;
      const actualDy = pos2.y - pos1.y;
      const actualDistance = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
      
      // Rope sag amount based on distance and a bit of physics seed for variation
      const sagSeed = (i + 7) * (j + 11);
      const sagAmount = actualDistance * 0.15 + organicNoise(sagSeed) * 8;
      
      // Perpendicular direction for sag
      const perpX = -actualDy / actualDistance;
      const perpY = actualDx / actualDistance;
      
      // Draw rope as multiple connected segments for flexibility
      ctx.strokeStyle = color;
      ctx.globalAlpha = intensity;
      ctx.lineWidth = 1.3 + (sharedOwner ? 0.8 : 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      
      // Create rope segments with catenary-like curve
      for (let seg = 1; seg <= ROPE_SEGMENTS; seg++) {
        const t = seg / ROPE_SEGMENTS;
        
        // Parabolic sag - strongest in middle
        const sagFactor = Math.sin(t * Math.PI);
        const sag = sagAmount * sagFactor;
        
        // Interpolate between start and end
        const segX = pos1.x + actualDx * t + perpX * sag;
        const segY = pos1.y + actualDy * t + perpY * sag;
        
        ctx.lineTo(segX, segY);
      }
      
      ctx.stroke();

      // Synapse sparks that hint at signal traffic along the rope
      const synapseCount = sharedOwner ? 3 : 1;
      for (let s = 1; s <= synapseCount; s++) {
        const t = s / (synapseCount + 1);
        const sagFactor = Math.sin(t * Math.PI);
        const sag = sagAmount * sagFactor;
        
        const sx = pos1.x + actualDx * t + perpX * sag;
        const sy = pos1.y + actualDy * t + perpY * sag;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, sharedOwner ? 2.2 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Light pulses orbiting owned nodes to keep the map feeling alive
function renderSignalSparks(ctx, nodePositions, deltaMs) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  nodePositions.forEach((node, index) => {
    const isPlayer = node.territory.owner === TERRITORY_PLAYER;
    const isEnemy = node.territory.owner === TERRITORY_ENEMY;
    const color = isPlayer ? COLOR_PLAYER_STROKE : (isEnemy ? COLOR_ENEMY_STROKE : COLOR_NEURON_WEB);

    // Get actual position with physics offset
    const pos = getNodePosition(node);
    
    const baseOrbit = node.radius * (node.territory.nodeType === 'archetype' ? 1.6 : 1.2);
    const t = ((lastRenderTimestamp + deltaMs) * 0.001 + index * 0.21) % 1;
    const angle = t * Math.PI * 2;
    const sparkX = pos.x + Math.cos(angle) * baseOrbit;
    const sparkY = pos.y + Math.sin(angle) * baseOrbit;

    ctx.fillStyle = color;
    ctx.globalAlpha = isEnemy ? 0.85 : 0.9;
    ctx.shadowColor = color;
    ctx.shadowBlur = isEnemy ? 18 : 12;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Render a single node as a circular neuron-like structure with faction theming
function renderRealmNode(ctx, node) {
  const { territory, radius } = node;
  
  // Get actual position with physics offset
  const pos = getNodePosition(node);
  const x = pos.x;
  const y = pos.y;

  // Determine color based on ownership
  let fillColor, strokeColor, glowColor;
  if (territory.owner === TERRITORY_PLAYER) {
    fillColor = COLOR_PLAYER_FILL;
    strokeColor = COLOR_PLAYER_STROKE;
    glowColor = COLOR_PLAYER_GLOW;
  } else if (territory.owner === TERRITORY_ENEMY) {
    fillColor = COLOR_ENEMY_FILL;
    strokeColor = COLOR_ENEMY_STROKE;
    glowColor = COLOR_ENEMY_GLOW;
  } else {
    fillColor = COLOR_NEUTRAL_FILL;
    strokeColor = COLOR_NEUTRAL_STROKE;
    glowColor = COLOR_NEUTRAL_GLOW;
  }

  // Draw outer glow for captured nodes
  if (glowColor) {
    const glowSeed = (territory.x + 1) * 17 + (territory.y + 1) * 23;
    const glowVariance = 0.75 + organicNoise(glowSeed) * 0.85;
    const baseBlur = territory.nodeType === 'archetype' ? 18 : 12;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = baseBlur * glowVariance;
  }

  // Draw main node circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = territory.nodeType === 'archetype' ? 2.8 : 1.8;
  ctx.stroke();

  // Reset shadow
  ctx.shadowBlur = 0;

  // Draw inner detail circles (neuron nucleus effect)
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  const label = getNodeLabel(territory);
  ctx.fillStyle = strokeColor;
  ctx.font = `bold ${territory.nodeType === 'archetype' ? 14 : 11}px "${FONT_FAMILY}", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

/**
 * Render UI overlay with zoom level and territory stats
 */
function renderUIOverlay(ctx, width, height) {
  const stats = getTerritoryStats();
  
  // Draw semi-transparent background for stats
  ctx.fillStyle = COLOR_UI_BG;
  ctx.fillRect(10, 10, 220, 90);
  
  // Draw border
  ctx.strokeStyle = COLOR_UI_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 220, 90);
  
  // Draw text
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = `14px "${FONT_FAMILY}", serif`;
  
  ctx.fillText('Collective Unconscious', 20, 30);
  
  ctx.font = `12px "${FONT_FAMILY}", serif`;
  ctx.fillStyle = COLOR_TEXT_PLAYER;
  ctx.fillText(`Player: ${stats.player} territories`, 20, 50);
  
  ctx.fillStyle = COLOR_TEXT_ENEMY;
  ctx.fillText(`Enemy: ${stats.enemy} territories`, 20, 68);
  
  ctx.fillStyle = COLOR_TEXT_MUTED;
  ctx.fillText(`Neutral: ${stats.neutral}`, 20, 86);
  
  // Draw zoom indicator
  ctx.fillStyle = COLOR_UI_BG;
  ctx.fillRect(width - 100, height - 40, 90, 30);
  
  ctx.strokeStyle = COLOR_UI_BORDER;
  ctx.strokeRect(width - 100, height - 40, 90, 30);
  
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = `12px "${FONT_FAMILY}", serif`;
  ctx.fillText(`Zoom: ${currentZoom.toFixed(1)}x`, width - 90, height - 20);
}

/**
 * Reset zoom and pan to default
 */
export function resetCognitiveRealmView() {
  currentZoom = 1.0;
  currentPanX = 0;
  currentPanY = 0;
  clampPanToBounds();
}

/**
 * Show the cognitive realm map container
 */
export function showCognitiveRealmMap() {
  if (mapContainer) {
    mapContainer.hidden = false;
    mapContainer.setAttribute('aria-hidden', 'false');
    resizeCanvas();
  }
}

/**
 * Hide the cognitive realm map container
 */
export function hideCognitiveRealmMap() {
  if (mapContainer) {
    mapContainer.hidden = true;
    mapContainer.setAttribute('aria-hidden', 'true');
  }
}
