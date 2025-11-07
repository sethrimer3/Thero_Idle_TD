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

let shinElements = {};
let activeFractalTabId = null;
let updateCallback = null;

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
  allocatedStat.innerHTML = `
    <span class="shin-fractal-stat-label">Iterons Allocated</span>
    <span class="shin-fractal-stat-value">${formatGameNumber(state.allocated)}</span>
  `;
  
  const layersStat = document.createElement('div');
  layersStat.className = 'shin-fractal-stat';
  layersStat.innerHTML = `
    <span class="shin-fractal-stat-label">Layers Completed</span>
    <span class="shin-fractal-stat-value">${state.layersCompleted} / ${fractal.layerThresholds.length}</span>
  `;
  
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
    shinElements.layerProgressBar.style.width = `${progress.percentage}%`;
    shinElements.layerProgressText.textContent = `Layer ${progress.layer + 1}: ${formatGameNumber(progress.current)} / ${formatGameNumber(progress.next)} (${progress.percentage.toFixed(1)}%)`;
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
    shinElements.shinGlyphs.textContent = formatGameNumber(getShinGlyphs());
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
