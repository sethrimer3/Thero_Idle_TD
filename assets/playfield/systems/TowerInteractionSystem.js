// Tower interaction system extracted from SimplePlayfield.
// These functions use 'this' (the SimplePlayfield instance) via prototype assignment.

import { convertMathExpressionToPlainText } from '../../../scripts/core/mathText.js';
import {
  getTowerDefinition,
  getNextTowerId,
  getPreviousTowerId,
  getTowerEquationBlueprint,
} from '../../towersTab.js';
import {
  getKappaPreviewParameters as getKappaPreviewParametersHelper,
} from '../../../scripts/features/towers/kappaTower.js';
import { samplePaletteGradient } from '../../colorSchemeUtils.js';
import { colorToRgbaString } from '../../../scripts/features/towers/powderTower.js';
import { formatCombatNumber } from '../utils/formatting.js';

// Vertical pixel offset for upgrade/downgrade/sell indicators shown during tower hold gestures.
const TOWER_HOLD_INDICATOR_OFFSET_PX = 40;
const DEFAULT_COST_SCRIBBLE_COLORS = {
  start: { r: 139, g: 247, b: 255 },
  end: { r: 255, g: 138, b: 216 },
  glow: { r: 255, g: 255, b: 255 },
};

export function retryCurrentWave() {
  if (!this.isInteractiveLevelActive()) {
    if (this.messageEl) {
      this.messageEl.textContent = 'Enter an interactive level to retry the defense.';
    }
    return false;
  }

  if (this.audio) {
    this.audio.unlock();
  }

  if (!this.towers.length) {
    if (this.messageEl) {
      this.messageEl.textContent = 'Anchor at least one tower before retrying the wave.';
    }
    return false;
  }

  this.cancelAutoStart();
  this.combatActive = false;
  this.resolvedOutcome = null;
  this.waveIndex = 0;
  this.waveTimer = 0;
  this.enemyIdCounter = 0;
  this.activeWave = null;
  this.enemies.forEach((enemy) => this.clearEnemySlowEffects(enemy));
  this.enemies = [];
  this.resetChiSystems();
  this.projectiles = [];
  this.resetDamageNumbers();
  this.resetEnemyDeathParticles();
  this.resetWaveTallies();
  this.alphaBursts = [];
  this.betaBursts = [];
  this.gammaBursts = [];
    this.gammaStarBursts = [];
  this.nuBursts = [];
  this.swarmClouds = [];
  this.floaters = [];
  this.floaterConnections = [];
  // Reset ambient swimmers when replaying a wave so the background loop restarts cleanly.
  this.backgroundSwimmers = [];
  this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
  this.currentWaveNumber = 1;
  this.maxWaveReached = 0;

  if (this.startButton) {
    this.startButton.disabled = false;
    this.startButton.textContent = 'Commence Wave';
  }
  if (this.autoWaveCheckbox) {
    this.autoWaveCheckbox.disabled = false;
    this.autoWaveCheckbox.checked = this.autoWaveEnabled;
  }

  this.updateHud();
  this.updateProgress();
  this.updateSpeedButton();
  this.updateAutoAnchorButton();

  if (this.audio) {
    this.audio.playSfx('uiToggle');
  }

  this.handleStartButton();
  return true;
}

export function updatePlacementPreview(normalized, options = {}) {
  const { towerType, dragging = false } = options;
  if (!towerType || !normalized) {
    this.hoverPlacement = null;
    return;
  }

  const definition = getTowerDefinition(towerType);
  let placementNormalized = { ...normalized };
  const pointerPosition = this.getCanvasPosition(normalized);

  if (dragging) {
    const offsetX = this.dragPreviewOffset?.x || 0;
    const dragElevation = this.getPixelsForMeters(2); // Keep tower previews suspended two meters above the pointer.
    const offsetY = (this.dragPreviewOffset?.y || 0) - dragElevation;
    const adjustedPosition = {
      x: pointerPosition.x + offsetX,
      y: pointerPosition.y + offsetY,
    };
    const adjustedNormalized = this.getNormalizedFromCanvasPosition(adjustedPosition);
    if (adjustedNormalized) {
      placementNormalized = adjustedNormalized;
    }
  }

  let position = this.getCanvasPosition(placementNormalized);
  const existing = this.findTowerAt(position);
  const merging = Boolean(existing && existing.type === towerType);
  const nextId = merging ? getNextTowerId(towerType) : null;
  const nextDefinition = nextId ? getTowerDefinition(nextId) : null;

  if (merging && existing) {
    position = { x: existing.x, y: existing.y };
    const mergeNormalized = this.getNormalizedFromCanvasPosition(position);
    if (mergeNormalized) {
      placementNormalized = mergeNormalized;
    }
  }

  const validation = merging
    ? { valid: Boolean(nextDefinition), reason: nextDefinition ? '' : 'Peak tier reached.' }
    : this.validatePlacement(placementNormalized, { allowPathOverlap: false });

  if (!merging && validation.position) {
    position = validation.position;
  }

  const baseCost = this.getCurrentTowerCost(towerType);
  const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
  const actionCost = merging ? mergeCost : baseCost;
  const hasFunds = this.energy >= actionCost;

  let valid = validation.valid && hasFunds;
  let reason = '';
  const formattedCost = formatCombatNumber(Math.max(0, actionCost));
  if (!validation.valid) {
    reason = validation.reason || 'Maintain clearance from the glyph lane.';
  } else if (!hasFunds) {
    const deficit = Math.max(0, actionCost - this.energy);
    const deficitLabel = formatCombatNumber(deficit);
    if (merging && nextDefinition) {
      reason = `Need ${deficitLabel} ${this.theroSymbol} to merge into ${nextDefinition.symbol}.`;
    } else if (definition) {
      reason = `Need ${deficitLabel} ${this.theroSymbol} to lattice ${definition.symbol}.`;
    } else {
      reason = `Need ${deficitLabel} ${this.theroSymbol} for this lattice.`;
    }
  } else if (merging && nextDefinition) {
    reason = `Merge into ${nextDefinition.symbol} for ${formattedCost} ${this.theroSymbol}.`;
  } else if (definition) {
    reason = `Anchor ${definition.symbol} for ${formattedCost} ${this.theroSymbol}.`;
  }

  const rangeFactor = definition ? definition.range : 0.24;
  const kappaPreview = towerType === 'kappa' ? getKappaPreviewParametersHelper(this) : null;
  const previewRange = towerType === 'kappa' && kappaPreview?.rangePixels
    ? kappaPreview.rangePixels
    : Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
  const connections = this.computePlacementConnections(position, {
    towerType,
    range: previewRange,
    mergeTarget: merging ? existing : null,
  });
  this.hoverPlacement = {
    normalized: { ...placementNormalized },
    position,
    range: previewRange,
    valid,
    reason,
    towerType,
    dragging,
    mergeTarget: merging ? existing : null,
    merge: merging,
    cost: actionCost,
    symbol: definition?.symbol || '·',
    definition: definition || null,
    tier: Number.isFinite(definition?.tier) ? definition.tier : null,
    connections,
  };
}

export function spawnTowerUpgradeCostScribble(tower, text = '') {
  if (!tower || !this.container) {
    return null;
  }
  const scribbleText = text || this.getTowerHoldScribbleText(tower);
  if (!scribbleText) {
    return null;
  }
  if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
    return null;
  }
  const effect = document.createElement('div');
  effect.className = 'tower-upgrade-cost-scribble';
  effect.style.left = `${tower.x}px`;
  effect.style.top = `${tower.y}px`;

  const startColor = samplePaletteGradient(0.05) || DEFAULT_COST_SCRIBBLE_COLORS.start;
  const endColor = samplePaletteGradient(0.85) || DEFAULT_COST_SCRIBBLE_COLORS.end;
  const glowColor = samplePaletteGradient(0.5) || DEFAULT_COST_SCRIBBLE_COLORS.glow;
  effect.style.setProperty('--tower-scribble-start', colorToRgbaString(startColor, 1));
  effect.style.setProperty('--tower-scribble-end', colorToRgbaString(endColor, 1));
  effect.style.setProperty('--tower-scribble-shadow', colorToRgbaString(glowColor, 0.65));

  const textEl = document.createElement('span');
  textEl.className = 'tower-upgrade-cost-scribble__text';
  textEl.textContent = scribbleText;
  effect.append(textEl);

  const cleanup = () => {
    effect.removeEventListener('animationend', handleAnimationEnd);
    if (effect.parentNode) {
      effect.parentNode.removeChild(effect);
    }
  };

  const handleAnimationEnd = (animationEvent) => {
    if (
      animationEvent.target === effect &&
      animationEvent.animationName === 'tower-upgrade-cost-scribble-dissipate'
    ) {
      cleanup();
    }
  };

  effect.addEventListener('animationend', handleAnimationEnd);
  this.container.append(effect);

  const timeoutId = setTimeout(() => cleanup(), 2000);
  return () => {
    clearTimeout(timeoutId);
    cleanup();
  };
}

/**
 * Spawn visual triangular indicators above/below tower during hold gesture.
 * Shows upgrade arrow above, and either downgrade arrow or sell symbols below.
 */
export function spawnTowerHoldIndicators(tower) {
  if (!tower || !this.container) {
    return null;
  }
  if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
    return null;
  }

  const indicators = [];
  const cleanupFunctions = [];

  // Always show upgrade indicator above tower (unless at max tier)
  const nextId = getNextTowerId(tower.type);
  if (nextId) {
    const upgradeIndicator = document.createElement('div');
    upgradeIndicator.className = 'tower-hold-indicator tower-hold-indicator--upgrade';
    upgradeIndicator.style.left = `${tower.x}px`;
    upgradeIndicator.style.top = `${tower.y - TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
    
    const startColor = samplePaletteGradient(0.15) || { r: 139, g: 247, b: 255 };
    upgradeIndicator.style.setProperty('--indicator-color', colorToRgbaString(startColor, 0.85));
    
    this.container.append(upgradeIndicator);
    indicators.push(upgradeIndicator);
  }

  // Show downgrade indicator below tower, or sell indicator if at alpha tier
  const previousId = getPreviousTowerId(tower.type);
  const isAlphaTower = !previousId; // Alpha is the lowest tier with no previous tier
  
  if (isAlphaTower) {
    // Show sell indicator ($ and Þ symbols)
    const sellIndicator = document.createElement('div');
    sellIndicator.className = 'tower-hold-indicator tower-hold-indicator--sell';
    sellIndicator.style.left = `${tower.x}px`;
    sellIndicator.style.top = `${tower.y + TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
    sellIndicator.textContent = `$${this.theroSymbol}`;
    
    const sellColor = samplePaletteGradient(0.75) || { r: 255, g: 200, b: 80 };
    sellIndicator.style.setProperty('--indicator-color', colorToRgbaString(sellColor, 0.95));
    
    this.container.append(sellIndicator);
    indicators.push(sellIndicator);
  } else {
    // Show downgrade indicator
    const downgradeIndicator = document.createElement('div');
    downgradeIndicator.className = 'tower-hold-indicator tower-hold-indicator--downgrade';
    downgradeIndicator.style.left = `${tower.x}px`;
    downgradeIndicator.style.top = `${tower.y + TOWER_HOLD_INDICATOR_OFFSET_PX}px`;
    
    const endColor = samplePaletteGradient(0.85) || { r: 255, g: 138, b: 216 };
    downgradeIndicator.style.setProperty('--indicator-color', colorToRgbaString(endColor, 0.85));
    
    this.container.append(downgradeIndicator);
    indicators.push(downgradeIndicator);
  }

  // Create cleanup function to remove all indicators
  const cleanup = () => {
    indicators.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
  };

  return cleanup;
}

export function spawnTowerEquationScribble(tower, options = {}) {
  if (!tower || !this.container) {
    return;
  }
  const { towerType = tower.type, silent = false } = options;
  if (silent) {
    return;
  }
  const equationText = this.getTowerEquationScribbleText(towerType);
  if (!equationText) {
    return;
  }
  if (!Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
    return;
  }

  const effect = document.createElement('div');
  effect.className = 'tower-equation-scribble';
  effect.style.left = `${tower.x}px`;
  effect.style.top = `${tower.y}px`;

  const text = document.createElement('span');
  text.className = 'tower-equation-scribble__text';
  text.textContent = equationText;
  effect.append(text);

  const cleanup = () => {
    effect.removeEventListener('animationend', handleAnimationEnd);
    if (effect.parentNode) {
      effect.parentNode.removeChild(effect);
    }
  };

  const handleAnimationEnd = (event) => {
    if (event.target === effect && event.animationName === 'tower-scribble-dissipate') {
      cleanup();
    }
  };

  effect.addEventListener('animationend', handleAnimationEnd);
  this.container.append(effect);

  setTimeout(() => {
    if (effect.parentNode) {
      cleanup();
    }
  }, 2400);
}

export function validatePlacement(normalized, options = {}) {
  const { allowPathOverlap = false } = options;
  if (!this.levelConfig) {
    return { valid: false, reason: 'Activate a level first.' };
  }

  const position = this.getCanvasPosition(normalized);
  const minDimension = Math.min(this.renderWidth, this.renderHeight) || 1;
  const towerBodyRadius = this.resolveTowerBodyRadius();
  // Require at least a full body diameter plus a small buffer so lattices do not visually overlap.
  const minSpacing = Math.max(towerBodyRadius * 2.1, 24);

  for (let index = 0; index < this.towers.length; index += 1) {
    const tower = this.towers[index];
    const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
    if (distance < minSpacing) {
      return { valid: false, reason: 'Too close to another lattice.', position };
    }
  }

  if (!allowPathOverlap) {
    const pathBuffer = minDimension * 0.06;
    const clearance = this.getDistanceToPath(position);
    if (clearance < pathBuffer) {
      return { valid: false, reason: 'Maintain clearance from the glyph lane.', position };
    }
  }

  // Check for Voronoi/Delaunay cell overlap
  const cellAtPosition = this.findCellAt(position);
  if (cellAtPosition && !cellAtPosition.isDestroyed) {
    return { valid: false, reason: 'Cannot place tower on crystalline formation.', position };
  }

  return { valid: true, position };
}
