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
  
  // Pointer up - stop dragging
  mapCanvas.addEventListener('pointerup', () => {
    isDragging = false;
    mapCanvas.style.cursor = 'grab';
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
    
    // Clamp zoom between 0.5x and 3x
    currentZoom = Math.max(0.5, Math.min(3.0, newZoom));
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
      
      // Clamp zoom between 0.5x and 3x
      currentZoom = Math.max(0.5, Math.min(3.0, newZoom));
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
 * Render the cognitive realm map with territories
 */
function renderMap() {
  if (!mapContext || !mapCanvas) {
    return;
  }
  
  const width = mapCanvas.width / (window.devicePixelRatio || 1);
  const height = mapCanvas.height / (window.devicePixelRatio || 1);
  
  // Clear canvas with dark background
  mapContext.fillStyle = 'rgba(11, 11, 15, 0.95)';
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
  
  // Render grid background pattern (subtle mathematical grid)
  renderGridPattern(mapContext, offsetX, offsetY, totalWidth, totalHeight);
  
  // Render each territory
  territories.forEach((territory) => {
    renderTerritory(mapContext, territory, offsetX, offsetY);
  });
  
  // Restore context state
  mapContext.restore();
  
  // Render UI overlay (zoom level, stats)
  renderUIOverlay(mapContext, width, height);
}

/**
 * Render a subtle mathematical grid pattern in the background
 */
function renderGridPattern(ctx, offsetX, offsetY, width, height) {
  ctx.strokeStyle = 'rgba(139, 247, 255, 0.08)';
  ctx.lineWidth = 0.5;
  
  const gridSpacing = BASE_TERRITORY_SIZE + TERRITORY_GAP;
  
  // Vertical lines
  for (let i = 0; i <= getGridDimensions().width; i++) {
    const x = offsetX + i * gridSpacing;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let i = 0; i <= getGridDimensions().height; i++) {
    const y = offsetY + i * gridSpacing;
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + width, y);
    ctx.stroke();
  }
}

/**
 * Render a single territory with abstract geometric shape
 */
function renderTerritory(ctx, territory, offsetX, offsetY) {
  const x = offsetX + territory.x * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
  const y = offsetY + territory.y * (BASE_TERRITORY_SIZE + TERRITORY_GAP) + BASE_TERRITORY_SIZE / 2;
  const size = BASE_TERRITORY_SIZE * 0.8;
  
  // Determine color based on ownership
  let fillColor, strokeColor;
  if (territory.owner === TERRITORY_PLAYER) {
    fillColor = 'rgba(139, 247, 255, 0.25)';
    strokeColor = 'rgba(139, 247, 255, 0.7)';
  } else if (territory.owner === TERRITORY_ENEMY) {
    fillColor = 'rgba(255, 125, 235, 0.25)';
    strokeColor = 'rgba(255, 125, 235, 0.7)';
  } else {
    fillColor = 'rgba(247, 247, 245, 0.05)';
    strokeColor = 'rgba(247, 247, 245, 0.2)';
  }
  
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  
  // Render different shapes based on shapeType
  ctx.beginPath();
  
  switch (territory.shapeType) {
    case 0: // Circle
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      break;
    
    case 1: // Triangle
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.closePath();
      break;
    
    case 2: // Square
      ctx.rect(x - size / 2, y - size / 2, size, size);
      break;
    
    case 3: // Hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = x + (size / 2) * Math.cos(angle);
        const py = y + (size / 2) * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      break;
  }
  
  ctx.fill();
  ctx.stroke();
  
  // Add subtle glow for non-neutral territories
  if (territory.owner !== TERRITORY_NEUTRAL) {
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

/**
 * Render UI overlay with zoom level and territory stats
 */
function renderUIOverlay(ctx, width, height) {
  const stats = getTerritoryStats();
  
  // Draw semi-transparent background for stats
  ctx.fillStyle = 'rgba(5, 6, 12, 0.85)';
  ctx.fillRect(10, 10, 220, 90);
  
  // Draw border
  ctx.strokeStyle = 'rgba(139, 247, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 220, 90);
  
  // Draw text
  ctx.fillStyle = 'rgba(247, 247, 245, 0.9)';
  ctx.font = '14px "Cormorant Garamond", serif';
  
  ctx.fillText('Cognitive Realm', 20, 30);
  
  ctx.font = '12px "Cormorant Garamond", serif';
  ctx.fillStyle = 'rgba(139, 247, 255, 0.8)';
  ctx.fillText(`Player: ${stats.player} territories`, 20, 50);
  
  ctx.fillStyle = 'rgba(255, 125, 235, 0.8)';
  ctx.fillText(`Enemy: ${stats.enemy} territories`, 20, 68);
  
  ctx.fillStyle = 'rgba(247, 247, 245, 0.6)';
  ctx.fillText(`Neutral: ${stats.neutral}`, 20, 86);
  
  // Draw zoom indicator
  ctx.fillStyle = 'rgba(5, 6, 12, 0.85)';
  ctx.fillRect(width - 100, height - 40, 90, 30);
  
  ctx.strokeStyle = 'rgba(139, 247, 255, 0.3)';
  ctx.strokeRect(width - 100, height - 40, 90, 30);
  
  ctx.fillStyle = 'rgba(247, 247, 245, 0.9)';
  ctx.font = '12px "Cormorant Garamond", serif';
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
