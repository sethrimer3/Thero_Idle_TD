/**
 * Mu (μ/Μ) Tower - Fractal Mine Layer
 * 
 * Normal mode (μ): Lays Sierpinski triangle fractal mines
 * Prestige mode (Μ): Lays Apollonian gasket fractal circle mines
 * 
 * Mechanics:
 * - Places mines randomly within range on the track
 * - Mines charge up through tiers (adding fractal layers)
 * - Each tier multiplies damage by 10×
 * - Max tier determined by Aleph1 upgrade
 * - Max concurrent mines: 5 + Aleph2
 * - Mine placement speed: 0.5 + 0.1 × Aleph3 mines/second
 * - Range: fixed 3 meters
 * - Damage: λ × (tier × 10)
 */

import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Constants
const BASE_RANGE_METERS = 3;
const TIER_CHARGE_TIME = 2.0; // Seconds to advance one tier
const MINE_RADIUS_METERS = 0.3; // Visual size of the mine center
const TRIANGLE_BASE_SIZE = 0.4; // Size multiplier for Sierpinski triangles (in meters)
const CIRCLE_BASE_SIZE = 0.35; // Size multiplier for Apollonian circles (in meters)

/**
 * Ensure mu tower state is initialized.
 */
function ensureMuStateInternal(playfield, tower) {
  if (!tower.muState) {
    tower.muState = {
      mines: [], // Array of mine objects
      cooldown: 0,
      rangeMeters: BASE_RANGE_METERS,
      rangePixels: 0,
      maxMines: 5,
      placementRate: 0.5, // mines per second
      baseCooldown: 2.0,
      maxTier: 1,
      lambdaPower: 0,
    };
  }
  return tower.muState;
}

/**
 * Refresh mu tower parameters from equations.
 */
function refreshMuParameters(playfield, tower, state) {
  const blueprint = getTowerEquationBlueprint('mu');
  
  // Get lambda power for damage calculation
  const lambdaPower = Math.max(0, calculateTowerEquationResult('lambda') || 0);
  
  // tier = Aleph1
  const aleph1Value = computeTowerVariableValue('mu', 'aleph1', blueprint);
  const maxTier = Number.isFinite(aleph1Value) && aleph1Value > 0 ? Math.round(aleph1Value) : 1;
  
  // max = 5 + Aleph2
  const aleph2Value = computeTowerVariableValue('mu', 'aleph2', blueprint);
  const maxMines = 5 + (Number.isFinite(aleph2Value) ? Math.round(aleph2Value) : 0);
  
  // spd = 0.5 + 0.1 * Aleph3
  const aleph3Value = computeTowerVariableValue('mu', 'aleph3', blueprint);
  const placementRate = 0.5 + 0.1 * (Number.isFinite(aleph3Value) ? aleph3Value : 0);
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rangePixels = Math.max(24, metersToPixels(BASE_RANGE_METERS, minDimension));
  
  const baseCooldown = placementRate > 0 ? 1 / placementRate : Infinity;
  
  state.lambdaPower = lambdaPower;
  state.maxTier = maxTier;
  state.maxMines = maxMines;
  state.placementRate = placementRate;
  state.baseCooldown = baseCooldown;
  state.rangeMeters = BASE_RANGE_METERS;
  state.rangePixels = rangePixels;
  
  // Update tower stats for display
  tower.baseDamage = lambdaPower;
  tower.damage = lambdaPower;
  tower.baseRate = placementRate;
  tower.rate = placementRate;
  tower.baseRange = rangePixels;
  tower.range = rangePixels;
}

/**
 * Resolve minimum playfield dimension for pixel calculations.
 */
function resolvePlayfieldMinDimension(playfield) {
  const dimensionCandidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    dimensionCandidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    dimensionCandidates.push(playfield.renderHeight);
  }
  if (!dimensionCandidates.length) {
    return 1;
  }
  return Math.min(...dimensionCandidates);
}

/**
 * Find a random valid position on the track within tower range.
 */
function findRandomTrackPosition(playfield, tower, rangePixels) {
  if (!playfield.path || !Array.isArray(playfield.path) || playfield.path.length < 2) {
    return null;
  }
  
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pick a random segment of the path
    const segmentIndex = Math.floor(Math.random() * (playfield.path.length - 1));
    const start = playfield.path[segmentIndex];
    const end = playfield.path[segmentIndex + 1];
    
    // Interpolate along the segment
    const t = Math.random();
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    
    // Check if within range of tower
    const dx = x - tower.x;
    const dy = y - tower.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= rangePixels) {
      return { x, y, segmentIndex, t };
    }
  }
  
  // Fallback: find closest point on path to tower
  let closestPoint = null;
  let closestDist = Infinity;
  
  for (let i = 0; i < playfield.path.length; i++) {
    const point = playfield.path[i];
    const dx = point.x - tower.x;
    const dy = point.y - tower.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < closestDist && dist <= rangePixels) {
      closestDist = dist;
      closestPoint = { x: point.x, y: point.y, segmentIndex: i, t: 0 };
    }
  }
  
  return closestPoint;
}

/**
 * Place a new mine at a random track location.
 */
function placeMine(playfield, tower, state) {
  // Check mine limit
  if (state.mines.length >= state.maxMines) {
    return null;
  }
  
  const position = findRandomTrackPosition(playfield, tower, state.rangePixels);
  if (!position) {
    return null;
  }
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const mineRadiusPixels = metersToPixels(MINE_RADIUS_METERS, minDimension);
  
  const mine = {
    id: `mu-mine-${Date.now()}-${Math.random()}`,
    x: position.x,
    y: position.y,
    tier: 0,
    targetTier: state.maxTier,
    chargeProgress: 0,
    radiusPixels: mineRadiusPixels,
    armed: false, // Becomes true when reaching targetTier
    prestige: tower.prestige || false,
  };
  
  state.mines.push(mine);
  return mine;
}

/**
 * Update all mines for a mu tower.
 */
function updateMines(playfield, tower, state, delta) {
  const minesToRemove = [];
  
  state.mines.forEach((mine, index) => {
    // Charge up the mine to its target tier
    if (mine.tier < mine.targetTier) {
      mine.chargeProgress += delta;
      
      if (mine.chargeProgress >= TIER_CHARGE_TIME) {
        mine.tier += 1;
        mine.chargeProgress = 0;
        
        // Update target tier if it changed
        if (mine.targetTier !== state.maxTier) {
          mine.targetTier = state.maxTier;
        }
        
        // Arm the mine when it reaches max tier
        if (mine.tier >= mine.targetTier) {
          mine.armed = true;
        }
      }
    } else if (mine.tier >= mine.targetTier) {
      mine.armed = true;
    }
    
    // Check for enemy collisions if armed
    if (mine.armed && playfield.enemies) {
      playfield.enemies.forEach((enemy) => {
        if (!enemy) return;
        
        const position = playfield.getEnemyPosition(enemy);
        if (!position) return;
        
        const metrics = playfield.getEnemyVisualMetrics(enemy);
        const enemyRadius = Math.max(10, metrics?.ringRadius || 12);
        
        const dx = position.x - mine.x;
        const dy = position.y - mine.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check collision
        if (distance <= mine.radiusPixels + enemyRadius) {
          // Calculate damage: atk = lambda * (tier * 10)
          const damage = state.lambdaPower * (mine.tier * 10);
          
          if (damage > 0) {
            playfield.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
          }
          
          // Mark mine for removal
          minesToRemove.push(index);
        }
      });
    }
  });
  
  // Remove triggered mines (in reverse order to avoid index issues)
  for (let i = minesToRemove.length - 1; i >= 0; i--) {
    state.mines.splice(minesToRemove[i], 1);
  }
}

/**
 * Initialize or refresh mu tower state.
 */
export function ensureMuState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'mu') {
    return null;
  }
  const state = ensureMuStateInternal(playfield, tower);
  refreshMuParameters(playfield, tower, state);
  return state;
}

/**
 * Update mu tower logic.
 */
export function updateMuTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'mu') {
    return;
  }
  
  const state = ensureMuStateInternal(playfield, tower);
  
  // Refresh parameters periodically
  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.recalcTimer <= 0) {
    refreshMuParameters(playfield, tower, state);
    state.recalcTimer = 0.35; // Recalc every 350ms
  }
  
  // Update cooldown for placing new mines
  state.cooldown = Math.max(0, (state.cooldown || 0) - delta);
  tower.cooldown = state.cooldown;
  
  // Update existing mines
  updateMines(playfield, tower, state, delta);
  
  // Place new mines if combat is active and cooldown is ready
  if (!playfield.combatActive) {
    return;
  }
  
  if (state.cooldown <= 0 && state.mines.length < state.maxMines) {
    const mine = placeMine(playfield, tower, state);
    if (mine) {
      state.cooldown = state.baseCooldown;
      tower.cooldown = state.cooldown;
    }
  }
}

/**
 * Draw Sierpinski triangle fractal for a mine.
 */
function drawSierpinskiMine(ctx, mine, minDimension, colors) {
  const x = mine.x;
  const y = mine.y;
  const tier = mine.tier;
  const sizeMeters = TRIANGLE_BASE_SIZE * Math.pow(1.3, tier); // Grow with tier
  const sizePixels = metersToPixels(sizeMeters, minDimension);
  
  // Helper to draw a hollow triangle
  function drawHollowTriangle(cx, cy, size, alpha) {
    const h = size * Math.sqrt(3) / 2; // Height of equilateral triangle
    
    ctx.save();
    ctx.strokeStyle = `rgba(${colors[0].r}, ${colors[0].g}, ${colors[0].b}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 2 / 3); // Top vertex
    ctx.lineTo(cx - size / 2, cy + h / 3); // Bottom left
    ctx.lineTo(cx + size / 2, cy + h / 3); // Bottom right
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw base triangle
  const baseAlpha = mine.armed ? 0.9 : 0.5 + 0.4 * (mine.chargeProgress / TIER_CHARGE_TIME);
  drawHollowTriangle(x, y, sizePixels, baseAlpha);
  
  // Draw fractal layers (Sierpinski pattern)
  // Each tier adds inner triangles in the three corners
  if (tier > 0) {
    const layerSizes = [];
    let currentSize = sizePixels;
    
    for (let t = 0; t < tier; t++) {
      currentSize *= 0.5; // Each layer is half the size
      layerSizes.push(currentSize);
    }
    
    layerSizes.forEach((layerSize, layerIndex) => {
      const offset = sizePixels * (0.25 / Math.pow(2, layerIndex));
      const h = sizePixels * Math.sqrt(3) / 2;
      const layerAlpha = baseAlpha * (1 - layerIndex * 0.15);
      
      // Top triangle
      drawHollowTriangle(x, y - h / 3, layerSize, layerAlpha);
      // Bottom left triangle
      drawHollowTriangle(x - sizePixels / 4, y + h / 6, layerSize, layerAlpha);
      // Bottom right triangle
      drawHollowTriangle(x + sizePixels / 4, y + h / 6, layerSize, layerAlpha);
    });
  }
  
  // Draw tier indicator
  if (tier > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha})`;
    ctx.font = `${Math.max(10, sizePixels * 0.3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${tier}`, x, y);
    ctx.restore();
  }
}

/**
 * Draw Apollonian gasket fractal for a prestige mine.
 */
function drawApollonianMine(ctx, mine, minDimension, colors) {
  const x = mine.x;
  const y = mine.y;
  const tier = mine.tier;
  const sizeMeters = CIRCLE_BASE_SIZE * Math.pow(1.3, tier); // Grow with tier
  const sizePixels = metersToPixels(sizeMeters, minDimension);
  
  // Helper to draw a hollow circle
  function drawHollowCircle(cx, cy, radius, alpha, color) {
    ctx.save();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw base circle
  const baseAlpha = mine.armed ? 0.9 : 0.5 + 0.4 * (mine.chargeProgress / TIER_CHARGE_TIME);
  drawHollowCircle(x, y, sizePixels, baseAlpha, colors[0]);
  
  // Draw fractal circles (Apollonian gasket approximation)
  // Each tier adds circles that fit in the gaps
  if (tier > 0) {
    for (let t = 1; t <= tier; t++) {
      const circleRadius = sizePixels * 0.4 / t;
      const layerAlpha = baseAlpha * (1 - t * 0.1);
      const color = colors[t % colors.length];
      
      // Draw 3 circles around the center
      const angleStep = (Math.PI * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const angle = i * angleStep;
        const offset = sizePixels * 0.5;
        const cx = x + Math.cos(angle) * offset;
        const cy = y + Math.sin(angle) * offset;
        drawHollowCircle(cx, cy, circleRadius, layerAlpha, color);
      }
    }
  }
  
  // Draw tier indicator
  if (tier > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha})`;
    ctx.font = `${Math.max(10, sizePixels * 0.35)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${tier}`, x, y);
    ctx.restore();
  }
}

/**
 * Draw all mines for a mu tower.
 */
export function drawMuMines(playfield, tower) {
  if (!playfield?.ctx || !tower?.muState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.muState;
  const mines = Array.isArray(state.mines) ? state.mines : [];
  
  if (!mines.length) {
    return;
  }
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  
  // Get colors from active palette
  const colors = [
    samplePaletteGradient(0.3) || { r: 255, g: 200, b: 100 },
    samplePaletteGradient(0.6) || { r: 100, g: 200, b: 255 },
    samplePaletteGradient(0.9) || { r: 255, g: 100, b: 200 },
  ];
  
  ctx.save();
  
  mines.forEach((mine) => {
    if (mine.prestige) {
      drawApollonianMine(ctx, mine, minDimension, colors);
    } else {
      drawSierpinskiMine(ctx, mine, minDimension, colors);
    }
  });
  
  ctx.restore();
}

/**
 * Clean up mu tower state.
 */
export function teardownMuTower(playfield, tower) {
  if (!tower?.muState) {
    return;
  }
  tower.muState.mines = [];
  tower.muState = null;
}
