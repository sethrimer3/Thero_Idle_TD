/**
 * Shin Spire UI Management
 * 
 * Handles the UI for the Shin Spire, including fractal tabs, iteron display,
 * and layer progress visualization.
 */

import {
  getFractalDefinitions,
  getFractalState,
  getActiveFractalId,
  setActiveFractal,
  getIteronBank,
  getIterationRate,
  getShinGlyphs,
  getLayerProgress,
  allocateIterons
} from './shinState.js';

import { formatGameNumber } from '../scripts/core/formatting.js';
import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';
import { KochSnowflakeSimulation } from '../scripts/features/towers/kochSnowflakeSimulation.js';
import { FernLSystemSimulation } from '../scripts/features/towers/fernLSystemSimulation.js';
import { DragonCurveSimulation } from '../scripts/features/towers/dragonCurveSimulation.js';
import { VoronoiSubdivisionSimulation } from '../scripts/features/towers/voronoiSubdivisionSimulation.js';
import { BrownianTreeSimulation } from '../scripts/features/towers/brownianTreeSimulation.js';
import { FlameFractalSimulation } from '../scripts/features/towers/flameFractalSimulation.js';

let shinElements = {};
let activeFractalTabId = null;
let updateCallback = null;
let fractalSimulations = new Map(); // Store simulation instances keyed by fractal ID
let animationFrameId = null;
let fractalResizeObserver = null;

const FRACTAL_RENDER_HANDLERS = new Map([
  ['tree', {
    create: (canvas, fractal, state) => new FractalTreeSimulation({
      canvas,
      ...fractal.config,
      maxDepth: Math.min(fractal.config?.maxDepth || 9, 6 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        maxDepth: Math.min(fractal.config?.maxDepth || 9, 6 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['koch', {
    create: (canvas, fractal, state) => new KochSnowflakeSimulation({
      canvas,
      ...fractal.config,
      iterations: Math.min(fractal.config?.iterations || 4, 2 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        iterations: Math.min(fractal.config?.iterations || 4, 2 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['fern', {
    create: (canvas, fractal, state) => {
      const simulation = new FernLSystemSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        segmentLength: fractal.config?.segmentLength || 5,
        layersCompleted: state?.layersCompleted || 0,
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        segmentLength: fractal.config?.segmentLength || 5,
        layersCompleted: state?.layersCompleted || 0,
        allocated: state?.allocated || 0
      });
    }
  }],
  ['dragon', {
    create: (canvas, fractal, state) => new DragonCurveSimulation({
      canvas,
      ...fractal.config,
      iterations: Math.min(fractal.config?.iterations || 10, 6 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        iterations: Math.min(fractal.config?.iterations || 10, 6 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['voronoi', {
    create: (canvas, fractal, state) => {
      const simulation = new VoronoiSubdivisionSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
    }
  }],
  ['brownian', {
    create: (canvas, fractal, state) => {
      const simulation = new BrownianTreeSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
    }
  }],
  ['flame', {
    create: (canvas, fractal, state) => {
      const simulation = new FlameFractalSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0,
        samplesPerIteron: fractal.config?.samplesPerIteron || 8000
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0,
        samplesPerIteron: fractal.config?.samplesPerIteron || 8000
      });
    }
  }]
]);

/**
 * Initialize the Shin Spire UI
 */
export function initializeShinUI() {
  // Cache DOM elements
  shinElements = {
    iteronBank: document.getElementById('shin-iteron-bank'),
    iterationRate: document.getElementById('shin-iteration-rate'),
    shinGlyphs: document.getElementById('shin-glyph-count'),
    fractalTabs: document.getElementById('shin-fractal-tabs'),
    fractalContent: document.getElementById('shin-fractal-content'),
    fractalDetails: document.getElementById('shin-fractal-details'),
    layerProgress: document.getElementById('shin-layer-progress'),
    layerProgressBar: document.getElementById('shin-layer-progress-bar'),
    layerProgressText: document.getElementById('shin-layer-progress-text')
  };

  // Observe layout changes so fractal canvases can follow the responsive container size.
  if (!fractalResizeObserver && typeof ResizeObserver === 'function' && shinElements.fractalContent) {
    fractalResizeObserver = new ResizeObserver(() => {
      resizeShinFractalCanvases();
    });
    fractalResizeObserver.observe(shinElements.fractalContent);
  }

  renderFractalTabs();
  selectFractalTab(getActiveFractalId());
  updateShinDisplay();
  
  // Start animation loop for fractal rendering
  startAnimationLoop();
}

/**
 * Set a callback to be invoked when the UI needs to trigger an update
 */
export function setShinUIUpdateCallback(callback) {
  updateCallback = callback;
}

/**
 * Render the fractal tabs
 */
function renderFractalTabs() {
  const fractals = getFractalDefinitions();
  const tabsContainer = shinElements.fractalTabs;
  
  if (!tabsContainer) {
    return;
  }
  
  tabsContainer.innerHTML = '';
  
  fractals.forEach(fractal => {
    const state = getFractalState(fractal.id);
    if (!state) {
      return;
    }
    
    const tab = document.createElement('button');
    tab.className = 'shin-fractal-tab';
    tab.dataset.fractalId = fractal.id;
    tab.type = 'button';
    
    if (!state.unlocked) {
      tab.classList.add('shin-fractal-tab--locked');
      tab.disabled = true;
    }
    
    if (fractal.id === activeFractalTabId) {
      tab.classList.add('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.setAttribute('aria-selected', 'false');
    }
    
    const tabName = document.createElement('span');
    tabName.className = 'shin-fractal-tab-name';
    tabName.textContent = fractal.name;
    
    const tabLayers = document.createElement('span');
    tabLayers.className = 'shin-fractal-tab-layers';
    tabLayers.textContent = state.unlocked 
      ? `Layer ${state.layersCompleted}`
      : 'Locked';
    
    const tabIterons = document.createElement('span');
    tabIterons.className = 'shin-fractal-tab-iterons';
    tabIterons.textContent = state.unlocked && state.allocated > 0
      ? `${formatGameNumber(state.allocated)} ℸ`
      : '';
    
    tab.appendChild(tabName);
    tab.appendChild(tabLayers);
    tab.appendChild(tabIterons);
    
    if (state.unlocked) {
      tab.addEventListener('click', () => {
        selectFractalTab(fractal.id);
        if (updateCallback) {
          updateCallback();
        }
      });
    }
    
    tabsContainer.appendChild(tab);
  });
}

/**
 * Select a fractal tab and update the UI
 */
function selectFractalTab(fractalId) {
  const fractals = getFractalDefinitions();
  const fractal = fractals.find(f => f.id === fractalId);
  const state = getFractalState(fractalId);
  
  if (!fractal || !state || !state.unlocked) {
    return;
  }
  
  // Update active tab ID
  activeFractalTabId = fractalId;
  setActiveFractal(fractalId);
  
  // Update tab button states
  const tabs = document.querySelectorAll('.shin-fractal-tab');
  tabs.forEach(tab => {
    if (tab.dataset.fractalId === fractalId) {
      tab.classList.add('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.classList.remove('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'false');
    }
  });
  
  // Update content area
  renderFractalContent(fractal, state);
  updateLayerProgress(fractalId);
}

/**
 * Render the content for the selected fractal
 */
function renderFractalContent(fractal, state) {
  const contentContainer = shinElements.fractalContent;
  const detailsContainer = shinElements.fractalDetails;
  
  if (!contentContainer) {
    return;
  }
  
  // Clear any existing simulation for this fractal since we're recreating the canvas
  if (fractalSimulations.has(fractal.id)) {
    fractalSimulations.delete(fractal.id);
  }
  
  contentContainer.innerHTML = '';
  
  // Add canvas for fractal visualization (in the content area)
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'shin-fractal-canvas-wrapper';
  
  const canvas = document.createElement('canvas');
  canvas.id = `shin-fractal-canvas-${fractal.id}`;
  canvas.className = 'shin-fractal-canvas';
  canvas.width = 240;
  canvas.height = 360;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${fractal.name} visualization`);
  
  canvasWrapper.appendChild(canvas);
  contentContainer.appendChild(canvasWrapper);
  
  // Add click handler to allocate 1 Iteron when clicking the fractal
  canvas.addEventListener('click', () => {
    allocateIterons(fractal.id, 1);
    if (updateCallback) {
      updateCallback();
    }
  });
  
  // Render fractal details below the Layer Progress bar
  if (detailsContainer) {
    detailsContainer.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'shin-fractal-header';
    
    const title = document.createElement('h3');
    title.className = 'shin-fractal-title';
    title.textContent = fractal.name;
    
    const description = document.createElement('p');
    description.className = 'shin-fractal-description';
    description.textContent = fractal.description;
    
    const stats = document.createElement('div');
    stats.className = 'shin-fractal-stats';
    
    const allocatedStat = document.createElement('div');
    allocatedStat.className = 'shin-fractal-stat';
    const allocatedLabel = document.createElement('span');
    allocatedLabel.className = 'shin-fractal-stat-label';
    allocatedLabel.textContent = 'Iterons Allocated';
    const allocatedValue = document.createElement('span');
    allocatedValue.className = 'shin-fractal-stat-value';
    allocatedValue.textContent = formatGameNumber(state.allocated);
    allocatedStat.appendChild(allocatedLabel);
    allocatedStat.appendChild(allocatedValue);
    
    const layersStat = document.createElement('div');
    layersStat.className = 'shin-fractal-stat';
    const layersLabel = document.createElement('span');
    layersLabel.className = 'shin-fractal-stat-label';
    layersLabel.textContent = 'Layers Completed';
    const layersValue = document.createElement('span');
    layersValue.className = 'shin-fractal-stat-value';
    layersValue.textContent = `${state.layersCompleted} / ${fractal.layerThresholds.length}`;
    layersStat.appendChild(layersLabel);
    layersStat.appendChild(layersValue);
    
    stats.appendChild(allocatedStat);
    stats.appendChild(layersStat);
    
    header.appendChild(title);
    header.appendChild(description);
    header.appendChild(stats);
    
    detailsContainer.appendChild(header);
  }

  resizeShinFractalCanvases();

  // Add zoom controls
  let userZoom = 1.0;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3.0;
  
  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.1;
    userZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, userZoom + delta));
  }, { passive: false });
  
  // Touch zoom (pinch)
  let lastTouchDistance = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });
  
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && lastTouchDistance) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const delta = (distance - lastTouchDistance) / 100;
      userZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, userZoom + delta));
      lastTouchDistance = distance;
    }
  }, { passive: false });
  
  canvas.addEventListener('touchend', () => {
    lastTouchDistance = null;
  }, { passive: true });
  
  // Store user zoom on canvas for use in rendering
  canvas.dataset.userZoom = userZoom.toString();
  canvas.addEventListener('wheel', () => {
    canvas.dataset.userZoom = userZoom.toString();
  });
  canvas.addEventListener('touchmove', () => {
    canvas.dataset.userZoom = userZoom.toString();
  });
  
  // Create fractal simulation after canvas is in DOM
  requestAnimationFrame(() => {
    if (FRACTAL_RENDER_HANDLERS.has(fractal.renderType)) {
      getOrCreateFractalSimulation(fractal);
    }
  });
}

/**
 * Resize all active Shin fractal canvases to match their responsive wrappers.
 */
export function resizeShinFractalCanvases() {
  if (!shinElements.fractalContent) {
    return;
  }

  const wrappers = shinElements.fractalContent.querySelectorAll('.shin-fractal-canvas-wrapper');
  const dpr = window.devicePixelRatio || 1;

  wrappers.forEach((wrapper) => {
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
    const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const fractalId = canvas.id.replace('shin-fractal-canvas-', '');
      const simulation = fractalSimulations.get(fractalId);
      if (simulation) {
        if (typeof simulation.resize === 'function') {
          simulation.resize(targetWidth, targetHeight);
        } else if (typeof simulation.reset === 'function') {
          simulation.reset();
        }
      }
    }
  });
}

/**
 * Update the layer progress display
 */
function updateLayerProgress(fractalId) {
  const progress = getLayerProgress(fractalId);
  
  if (!progress || !shinElements.layerProgressBar || !shinElements.layerProgressText) {
    return;
  }
  
  if (progress.complete) {
    shinElements.layerProgressBar.style.width = '100%';
    shinElements.layerProgressText.textContent = 'All layers complete!';
  } else {
    const percentage = Number.isFinite(progress.percentage) ? progress.percentage : 0;
    shinElements.layerProgressBar.style.width = `${percentage}%`;
    shinElements.layerProgressText.textContent = `Layer ${progress.layer + 1}: ${formatGameNumber(progress.current)} / ${formatGameNumber(progress.next)} (${percentage.toFixed(1)}%)`;
  }
}

/**
 * Update all Shin display elements
 */
export function updateShinDisplay() {
  // Update resource displays
  if (shinElements.iteronBank) {
    shinElements.iteronBank.textContent = formatGameNumber(getIteronBank());
  }
  
  if (shinElements.iterationRate) {
    shinElements.iterationRate.textContent = `${getIterationRate().toFixed(2)}/sec`;
  }
  
  if (shinElements.shinGlyphs) {
    shinElements.shinGlyphs.textContent = `${formatGameNumber(getShinGlyphs())} ש`;
  }
  
  // Update active fractal progress
  if (activeFractalTabId) {
    updateLayerProgress(activeFractalTabId);
  }
  
  // Update tab displays
  const tabs = document.querySelectorAll('.shin-fractal-tab');
  tabs.forEach(tab => {
    const fractalId = tab.dataset.fractalId;
    const state = getFractalState(fractalId);
    if (state && state.unlocked) {
      const layersElement = tab.querySelector('.shin-fractal-tab-layers');
      if (layersElement) {
        layersElement.textContent = `Layer ${state.layersCompleted}`;
      }
      const iteronsElement = tab.querySelector('.shin-fractal-tab-iterons');
      if (iteronsElement) {
        iteronsElement.textContent = state.allocated > 0
          ? `${formatGameNumber(state.allocated)} ℸ`
          : '';
      }
    }
  });
}

/**
 * Refresh the fractal tabs (used when unlocks occur)
 */
export function refreshFractalTabs() {
  renderFractalTabs();
  if (activeFractalTabId) {
    selectFractalTab(activeFractalTabId);
  }
}

/**
 * Create or get a fractal simulation for a given fractal
 */
function getOrCreateFractalSimulation(fractal) {
  const handler = FRACTAL_RENDER_HANDLERS.get(fractal.renderType);
  if (!handler) {
    return null;
  }

  if (fractalSimulations.has(fractal.id)) {
    const existingSimulation = fractalSimulations.get(fractal.id);
    if (handler.update) {
      handler.update(existingSimulation, fractal, getFractalState(fractal.id));
    }
    return existingSimulation;
  }

  const canvas = document.getElementById(`shin-fractal-canvas-${fractal.id}`);
  if (!canvas) {
    return null;
  }

  if (fractal.config?.width) {
    canvas.width = fractal.config.width;
  }
  if (fractal.config?.height) {
    canvas.height = fractal.config.height;
  }

  const state = getFractalState(fractal.id);
  const simulation = handler.create(canvas, fractal, state);
  fractalSimulations.set(fractal.id, simulation);
  return simulation;
}

/**
 * Start the animation loop for fractal rendering
 */
function startAnimationLoop() {
  if (animationFrameId) {
    return; // Already running
  }
  
  function animate() {
    // Update and render active fractal
    if (activeFractalTabId) {
      const fractal = getFractalDefinitions().find(f => f.id === activeFractalTabId);
      if (fractal && FRACTAL_RENDER_HANDLERS.has(fractal.renderType)) {
        const simulation = getOrCreateFractalSimulation(fractal);
        if (simulation) {
          simulation.update();
          simulation.render();
        }
      }
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Stop the animation loop
 */
export function stopAnimationLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Update fractal simulation parameters based on layer progress
 */
export function updateFractalSimulation() {
  if (!activeFractalTabId) {
    return;
  }
  
  const fractal = getFractalDefinitions().find(f => f.id === activeFractalTabId);
  const state = getFractalState(activeFractalTabId);
  
  if (!fractal || !state) {
    return;
  }
  
  const simulation = fractalSimulations.get(activeFractalTabId);
  const handler = FRACTAL_RENDER_HANDLERS.get(fractal.renderType);

  if (simulation && handler && handler.update) {
    handler.update(simulation, fractal, state);
  }
}
