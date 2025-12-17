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
const COLOR_NEURON_WEB = 'rgba(139, 247, 255, 0.15)';
const COLOR_PLAYER_FILL = 'rgba(139, 247, 255, 0.3)';
const COLOR_PLAYER_STROKE = 'rgba(139, 247, 255, 0.9)';
const COLOR_ENEMY_FILL = 'rgba(255, 125, 235, 0.3)';
const COLOR_ENEMY_STROKE = 'rgba(255, 125, 235, 0.9)';
const COLOR_NEUTRAL_FILL = 'rgba(247, 247, 245, 0.08)';
const COLOR_NEUTRAL_STROKE = 'rgba(247, 247, 245, 0.3)';
const COLOR_BG = '#000000'; // Solid black background
const COLOR_UI_BG = 'rgba(0, 0, 0, 0.85)';
const COLOR_UI_BORDER = 'rgba(139, 247, 255, 0.3)';
const COLOR_TEXT = 'rgba(247, 247, 245, 0.9)';
const COLOR_TEXT_PLAYER = 'rgba(139, 247, 255, 0.9)';
const COLOR_TEXT_ENEMY = 'rgba(255, 125, 235, 0.9)';
const COLOR_TEXT_MUTED = 'rgba(247, 247, 245, 0.6)';
const COLOR_NODE_GLOW = 'rgba(139, 247, 255, 0.5)';

// Zoom and pan state
let currentZoom = 1.0;
let currentPanX = 0;
let currentPanY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerStartX = 0;
let pointerStartY = 0;

// Canvas and container references
let mapCanvas = null;
let mapContext = null;
let mapContainer = null;

// Animation frame reference
let animationFrameId = null;

// Selected node for showing description
let selectedNode = null;
let descriptionModal = null;

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
  
  mapCanvas.width = rect.width * dpr;
  mapCanvas.height = rect.height * dpr;
  mapCanvas.style.width = `${rect.width}px`;
  mapCanvas.style.height = `${rect.height}px`;
  
  if (mapContext) {
    mapContext.scale(dpr, dpr);
  }
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
    mapCanvas.style.cursor = 'grabbing';
  });
  
  // Pointer move - pan the map
  mapCanvas.addEventListener('pointermove', (e) => {
    if (!isDragging) {
      return;
    }
    
    const deltaX = e.clientX - lastPointerX;
    const deltaY = e.clientY - lastPointerY;
    
    currentPanX += deltaX;
    currentPanY += deltaY;
    
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });
  
  // Pointer up - stop dragging or handle click
  mapCanvas.addEventListener('pointerup', (e) => {
    const wasDragging = isDragging;
    isDragging = false;
    mapCanvas.style.cursor = 'grab';
    
    // Only treat as click if pointer didn't move much
    const deltaX = Math.abs(e.clientX - pointerStartX);
    const deltaY = Math.abs(e.clientY - pointerStartY);
    const isClick = deltaX < 5 && deltaY < 5 && !wasDragging;
    
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
    }
  }, { passive: false });
  
  // Reset zoom and pan with double-click
  mapCanvas.addEventListener('dblclick', () => {
    currentZoom = 1.0;
    currentPanX = 0;
    currentPanY = 0;
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
  
  function render() {
    renderMap();
    animationFrameId = requestAnimationFrame(render);
  }
  
  animationFrameId = requestAnimationFrame(render);
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
 * Show archetype description in modal
 */
function showArchetypeDescription(territory) {
  if (!descriptionModal || !territory || !territory.archetype) {
    return;
  }
  
  const archetype = territory.archetype;
  const isPlayerOwned = territory.owner === TERRITORY_PLAYER;
  const isEnemyOwned = territory.owner === TERRITORY_ENEMY;
  
  // Determine which version to show
  let displayName, displayDescription;
  if (isPlayerOwned) {
    displayName = archetype.positive.name;
    displayDescription = archetype.positive.description;
  } else if (isEnemyOwned) {
    displayName = archetype.negative.name;
    displayDescription = archetype.negative.description;
  } else {
    // Neutral - show both
    displayName = `${archetype.positive.name} ↔ ${archetype.negative.name}`;
    displayDescription = `Positive: ${archetype.positive.description}\n\nNegative: ${archetype.negative.description}`;
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
  
  // Check if click is on any node
  for (const territory of territories) {
    const nodeX = offsetX + territory.x * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
    const nodeY = offsetY + territory.y * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
    const nodeRadius = BASE_TERRITORY_SIZE * 0.5;
    
    const distance = Math.sqrt((mapX - nodeX) ** 2 + (mapY - nodeY) ** 2);
    
    if (distance <= nodeRadius) {
      showArchetypeDescription(territory);
      return;
    }
  }
}

/**
 * Render the cognitive realm map with territories
 */
function renderMap() {
  if (!mapContext || !mapCanvas) {
    return;
  }
  
  const width = mapCanvas.width / (window.devicePixelRatio || 1);
  const height = mapCanvas.height / (window.devicePixelRatio || 1);
  
  // Clear canvas with dark background
  mapContext.fillStyle = COLOR_BG;
  mapContext.fillRect(0, 0, width, height);
  
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
  
  // Render neuron-like web connections between nodes
  renderNeuronWeb(mapContext, territories, offsetX, offsetY);
  
  // Render each territory as an archetype node
  territories.forEach((territory) => {
    renderArchetypeNode(mapContext, territory, offsetX, offsetY);
  });
  
  // Restore context state
  mapContext.restore();
  
  // Render UI overlay (zoom level, stats)
  renderUIOverlay(mapContext, width, height);
}

/**
 * Render neuron-like web connections between archetype nodes
 */
function renderNeuronWeb(ctx, territories, offsetX, offsetY) {
  ctx.strokeStyle = COLOR_NEURON_WEB;
  ctx.lineWidth = 1.5;
  
  // Calculate node positions
  const nodePositions = territories.map((territory) => ({
    x: offsetX + territory.x * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2,
    y: offsetY + territory.y * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2,
    territory,
  }));
  
  // Draw connections between adjacent nodes (like a neural network)
  nodePositions.forEach((node1, i) => {
    nodePositions.forEach((node2, j) => {
      if (i >= j) return; // Avoid duplicate lines
      
      const dx = node1.territory.x - node2.territory.x;
      const dy = node1.territory.y - node2.territory.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Connect adjacent nodes and some diagonal connections
      if (distance <= 1.5) {
        ctx.beginPath();
        ctx.moveTo(node1.x, node1.y);
        ctx.lineTo(node2.x, node2.y);
        ctx.stroke();
        
        // Add small circles along the connection to simulate synapses
        const synapseCount = Math.floor(distance * 2);
        for (let s = 1; s <= synapseCount; s++) {
          const t = s / (synapseCount + 1);
          const sx = node1.x + (node2.x - node1.x) * t;
          const sy = node1.y + (node2.y - node1.y) * t;
          
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fillStyle = COLOR_NEURON_WEB;
          ctx.fill();
        }
      }
    });
  });
}

/**
 * Render a single archetype node as a circular neuron-like structure
 */
function renderArchetypeNode(ctx, territory, offsetX, offsetY) {
  const x = offsetX + territory.x * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
  const y = offsetY + territory.y * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
  const radius = BASE_TERRITORY_SIZE * 0.4;
  
  // Determine color based on ownership
  let fillColor, strokeColor, glowColor;
  if (territory.owner === TERRITORY_PLAYER) {
    fillColor = COLOR_PLAYER_FILL;
    strokeColor = COLOR_PLAYER_STROKE;
    glowColor = COLOR_PLAYER_STROKE;
  } else if (territory.owner === TERRITORY_ENEMY) {
    fillColor = COLOR_ENEMY_FILL;
    strokeColor = COLOR_ENEMY_STROKE;
    glowColor = COLOR_ENEMY_STROKE;
  } else {
    fillColor = COLOR_NEUTRAL_FILL;
    strokeColor = COLOR_NEUTRAL_STROKE;
    glowColor = null;
  }
  
  // Draw outer glow for captured nodes
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;
  }
  
  // Draw main node circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Reset shadow
  ctx.shadowBlur = 0;
  
  // Draw inner detail circles (neuron nucleus effect)
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  
  // Add archetype label abbreviation
  if (territory.archetype) {
    const label = territory.archetype.id.split('-')[0].toUpperCase().substring(0, 2);
    ctx.fillStyle = strokeColor;
    ctx.font = `bold 14px "${FONT_FAMILY}", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
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
