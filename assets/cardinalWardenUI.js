/**
 * Cardinal Warden UI Management
 *
 * Handles the UI integration for the Cardinal Warden reverse danmaku game
 * within the Shin Spire panel.
 */

import { CardinalWardenSimulation } from '../scripts/features/towers/cardinalWardenSimulation.js';
import { formatGameNumber } from '../scripts/core/formatting.js';
import { getShinGlyphs, addShinGlyphs } from './shinState.js';

// Cardinal Warden simulation instance
let cardinalSimulation = null;
let cardinalResizeObserver = null;

// DOM element references
const cardinalElements = {
  canvas: null,
  overlay: null,
  startButton: null,
  resultPanel: null,
  resultScore: null,
  resultHigh: null,
  resultWave: null,
  restartButton: null,
  glyphCount: null,
};

// State persistence key
const CARDINAL_STATE_STORAGE_KEY = 'theroIdle_cardinalWarden';

// High score tracking
let cardinalHighScore = 0;

/**
 * Initialize the Cardinal Warden UI and simulation.
 */
export function initializeCardinalWardenUI() {
  // Cache DOM elements
  cardinalElements.canvas = document.getElementById('shin-cardinal-canvas');
  cardinalElements.overlay = document.getElementById('shin-cardinal-overlay');
  cardinalElements.startButton = document.getElementById('shin-cardinal-start');
  cardinalElements.resultPanel = document.getElementById('shin-cardinal-result');
  cardinalElements.resultScore = document.getElementById('shin-cardinal-result-score');
  cardinalElements.resultHigh = document.getElementById('shin-cardinal-result-high');
  cardinalElements.resultWave = document.getElementById('shin-cardinal-result-wave');
  cardinalElements.restartButton = document.getElementById('shin-cardinal-restart');
  cardinalElements.glyphCount = document.getElementById('shin-glyph-count');

  if (!cardinalElements.canvas) {
    console.warn('Cardinal Warden canvas not found');
    return;
  }

  // Load saved high score
  loadCardinalState();

  // Set up resize observer for responsive canvas
  setupCardinalResizeObserver();

  // Initialize the canvas size
  resizeCardinalCanvas();

  // Create the simulation
  createCardinalSimulation();

  // Bind event handlers
  bindCardinalEvents();

  // Show the start overlay
  showStartOverlay();
}

/**
 * Load persisted Cardinal Warden state.
 */
function loadCardinalState() {
  try {
    const saved = localStorage.getItem(CARDINAL_STATE_STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      cardinalHighScore = state.highScore || 0;
    }
  } catch (error) {
    console.warn('Failed to load Cardinal Warden state:', error);
  }
}

/**
 * Save Cardinal Warden state.
 */
function saveCardinalState() {
  try {
    const state = {
      highScore: cardinalHighScore,
    };
    localStorage.setItem(CARDINAL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save Cardinal Warden state:', error);
  }
}

/**
 * Set up resize observer for the Cardinal viewport.
 */
function setupCardinalResizeObserver() {
  if (cardinalResizeObserver) {
    cardinalResizeObserver.disconnect();
  }

  const viewport = cardinalElements.canvas?.parentElement;
  if (!viewport || typeof ResizeObserver !== 'function') {
    return;
  }

  cardinalResizeObserver = new ResizeObserver(() => {
    resizeCardinalCanvas();
  });

  cardinalResizeObserver.observe(viewport);
}

/**
 * Resize the Cardinal Warden canvas to fill its viewport.
 */
export function resizeCardinalCanvas() {
  const canvas = cardinalElements.canvas;
  if (!canvas) return;

  const viewport = canvas.parentElement;
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);
  const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
  const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Notify the simulation of the resize
    if (cardinalSimulation) {
      cardinalSimulation.resize(targetWidth, targetHeight);
    }
  }
}

/**
 * Create the Cardinal Warden simulation instance.
 */
function createCardinalSimulation() {
  if (!cardinalElements.canvas) return;

  cardinalSimulation = new CardinalWardenSimulation({
    canvas: cardinalElements.canvas,
    highScore: cardinalHighScore,
    onScoreChange: handleScoreChange,
    onHighScoreChange: handleHighScoreChange,
    onWaveChange: handleWaveChange,
    onGameOver: handleGameOver,
    onHealthChange: handleHealthChange,
  });
}

/**
 * Bind event handlers for the Cardinal Warden UI.
 */
function bindCardinalEvents() {
  if (cardinalElements.startButton) {
    cardinalElements.startButton.addEventListener('click', startGame);
  }

  if (cardinalElements.restartButton) {
    cardinalElements.restartButton.addEventListener('click', restartGame);
  }
}

/**
 * Show the start overlay.
 */
function showStartOverlay() {
  if (cardinalElements.overlay) {
    cardinalElements.overlay.hidden = false;
  }
  if (cardinalElements.resultPanel) {
    cardinalElements.resultPanel.hidden = true;
  }
}

/**
 * Hide all overlays and show the game.
 */
function hideOverlays() {
  if (cardinalElements.overlay) {
    cardinalElements.overlay.hidden = true;
  }
  if (cardinalElements.resultPanel) {
    cardinalElements.resultPanel.hidden = true;
  }
}

/**
 * Show the result panel.
 */
function showResultPanel(data) {
  if (cardinalElements.overlay) {
    cardinalElements.overlay.hidden = true;
  }
  if (cardinalElements.resultPanel) {
    cardinalElements.resultPanel.hidden = false;

    if (cardinalElements.resultScore) {
      cardinalElements.resultScore.textContent = `Score: ${formatGameNumber(data.score)}`;
    }
    if (cardinalElements.resultHigh) {
      const label = data.isNewHighScore ? '★ New High Score: ' : 'High Score: ';
      cardinalElements.resultHigh.textContent = label + formatGameNumber(data.highScore);
    }
    if (cardinalElements.resultWave) {
      cardinalElements.resultWave.textContent = `Waves Survived: ${data.wave}`;
    }
  }
}

/**
 * Start the game.
 */
function startGame() {
  if (!cardinalSimulation) {
    createCardinalSimulation();
  }

  hideOverlays();
  cardinalSimulation.reset();
  cardinalSimulation.start();
}

/**
 * Restart the game after game over.
 */
function restartGame() {
  hideOverlays();
  if (cardinalSimulation) {
    cardinalSimulation.reset();
    cardinalSimulation.start();
  }
}

/**
 * Stop the Cardinal Warden simulation.
 */
export function stopCardinalSimulation() {
  if (cardinalSimulation) {
    cardinalSimulation.stop();
  }
}

/**
 * Handle score changes.
 */
function handleScoreChange(score) {
  // Score is displayed in the canvas UI, no external element needed
}

/**
 * Handle high score changes.
 */
function handleHighScoreChange(highScore) {
  cardinalHighScore = highScore;
  saveCardinalState();

  // Award Shin glyphs based on high score milestones
  // 1 glyph per 100 points of high score
  // Track glyphs earned from Cardinal Warden separately to avoid conflicts with other glyph sources
  const glyphsFromHighScore = Math.floor(highScore / 100);
  const previousGlyphsFromHighScore = Math.floor((highScore - 100) / 100);
  
  // Only award new glyphs when crossing a 100-point threshold
  if (glyphsFromHighScore > previousGlyphsFromHighScore && glyphsFromHighScore > 0) {
    addShinGlyphs(1);
    updateGlyphDisplay();
  }
}

/**
 * Handle wave changes.
 */
function handleWaveChange(wave) {
  // Wave is displayed in the canvas UI
}

/**
 * Handle game over.
 */
function handleGameOver(data) {
  // Update high score tracking
  if (data.isNewHighScore) {
    cardinalHighScore = data.highScore;
    saveCardinalState();
  }

  // Show result panel after a short delay
  setTimeout(() => {
    showResultPanel({
      score: data.score,
      highScore: cardinalHighScore,
      wave: data.wave,
      isNewHighScore: data.isNewHighScore,
    });
  }, 500);
}

/**
 * Handle health changes.
 */
function handleHealthChange(health, maxHealth) {
  // Health bar is rendered in the canvas UI
}

/**
 * Update the glyph count display.
 */
function updateGlyphDisplay() {
  if (cardinalElements.glyphCount) {
    const glyphs = getShinGlyphs();
    cardinalElements.glyphCount.textContent = `${formatGameNumber(glyphs)} ש`;
  }
}

/**
 * Get the current Cardinal Warden state for persistence.
 */
export function getCardinalWardenState() {
  return {
    highScore: cardinalHighScore,
  };
}

/**
 * Restore Cardinal Warden state.
 */
export function setCardinalWardenState(state) {
  if (state?.highScore !== undefined) {
    cardinalHighScore = state.highScore;
    if (cardinalSimulation) {
      cardinalSimulation.setHighScore(cardinalHighScore);
    }
  }
}

/**
 * Check if the Cardinal Warden simulation is running.
 */
export function isCardinalSimulationRunning() {
  return cardinalSimulation?.running || false;
}

/**
 * Clean up resources.
 */
export function cleanupCardinalWarden() {
  if (cardinalSimulation) {
    cardinalSimulation.stop();
    cardinalSimulation = null;
  }

  if (cardinalResizeObserver) {
    cardinalResizeObserver.disconnect();
    cardinalResizeObserver = null;
  }
}
