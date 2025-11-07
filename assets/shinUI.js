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
  getLayerProgress
} from './shinState.js';

import { formatGameNumber } from '../scripts/core/formatting.js';
import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';

let shinElements = {};
let activeFractalTabId = null;
let updateCallback = null;
let fractalSimulations = {}; // Store simulation instances keyed by fractal ID
let animationFrameId = null;

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
    layerProgress: document.getElementById('shin-layer-progress'),
    layerProgressBar: document.getElementById('shin-layer-progress-bar'),
    layerProgressText: document.getElementById('shin-layer-progress-text')
  };
  
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
    
    tab.appendChild(tabName);
    tab.appendChild(tabLayers);
    
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
  
  if (!contentContainer) {
    return;
  }
  
  contentContainer.innerHTML = '';
  
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
  
  contentContainer.appendChild(header);
  
  // Add canvas for fractal visualization
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'shin-fractal-canvas-wrapper';
  
  const canvas = document.createElement('canvas');
  canvas.id = `shin-fractal-canvas-${fractal.id}`;
  canvas.className = 'shin-fractal-canvas';
  canvas.width = 240;
  canvas.height = 320;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${fractal.name} visualization`);
  
  canvasWrapper.appendChild(canvas);
  contentContainer.appendChild(canvasWrapper);
  
  // Create fractal simulation after canvas is in DOM
  setTimeout(() => {
    if (fractal.renderType === 'tree') {
      getOrCreateFractalSimulation(fractal);
    }
  }, 0);
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
  if (fractalSimulations[fractal.id]) {
    return fractalSimulations[fractal.id];
  }
  
  // Only create simulation for tree fractal type (others not implemented yet)
  if (fractal.renderType === 'tree') {
    const canvas = document.getElementById(`shin-fractal-canvas-${fractal.id}`);
    if (!canvas) {
      return null;
    }
    
    const simulation = new FractalTreeSimulation({
      canvas: canvas,
      ...fractal.config,
      // Map layers completed to tree depth
      maxDepth: Math.min(fractal.config.maxDepth, 6 + getFractalState(fractal.id).layersCompleted)
    });
    
    fractalSimulations[fractal.id] = simulation;
    return simulation;
  }
  
  return null;
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
      if (fractal && fractal.renderType === 'tree') {
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
  
  const simulation = fractalSimulations[activeFractalTabId];
  if (simulation && fractal.renderType === 'tree') {
    // Update tree depth based on layers completed
    const newMaxDepth = Math.min(fractal.config.maxDepth, 6 + state.layersCompleted);
    simulation.updateConfig({ maxDepth: newMaxDepth });
  }
}
