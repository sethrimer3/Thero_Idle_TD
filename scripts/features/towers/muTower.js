/**
 * Mu (μ/Μ) Tower - Fractal Mine Layer
 * 
 * Normal mode (μ): Lays geometric mines rendered as growing polygons
 * Prestige mode (Μ): Uses the same polygon visuals with prestige palette accents
 * 
 * Mechanics:
 * - Places mines randomly within range on the track
 * - Mines charge up through tiers (adding polygon edges)
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
const POLYGON_BASE_SIZE = 0.42; // Size multiplier for the mine polygon visuals (in meters)
const POLYGON_TIER_GROWTH = 1.12; // Growth factor applied per tier for polygon size

/**
 * Convert a tier value into a Roman numeral for the mine label.
 */
function convertToRomanNumeral(value) {
  const romanPairs = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = Math.max(1, Math.floor(value));
  let result = '';

  romanPairs.forEach(([numeric, numeral]) => {
    while (remaining >= numeric) {
      result += numeral;
      remaining -= numeric;
    }
  });

  return result;
}

/**
 * Clamp blueprint-provided tier values to a valid integer (minimum tier 1).
 */
function clampTierValue(rawTier) {
  if (!Number.isFinite(rawTier)) {
    return 1;
  }
  return Math.max(1, Math.round(rawTier));
}

/**
 * Keep all live mines aligned with the latest radius and maximum tier limits.
 */
function synchronizeMinesWithState(state, mineRadiusPixels, maxTier) {
  if (!state?.mines) {
    return;
  }
  const desiredTier = clampTierValue(maxTier);
  state.mines.forEach((mine) => {
    if (!mine) {
      return;
    }
    if (Number.isFinite(mineRadiusPixels) && mineRadiusPixels > 0) {
      mine.radiusPixels = mineRadiusPixels;
    }
    if (mine.targetTier !== desiredTier) {
      const previousTier = mine.targetTier;
      mine.targetTier = desiredTier;
      if (desiredTier > previousTier) {
        // Resume charging toward the higher tier.
        if (mine.tier < desiredTier) {
          mine.armed = false;
        }
      } else if (desiredTier <= mine.tier) {
        // Clamp down to the new maximum and mark armed.
        mine.tier = desiredTier;
        mine.armed = true;
        mine.chargeProgress = 0;
      }
    }
  });
}

/**
 * Enforce the current mine capacity, prioritizing armed and higher-tier mines.
 */
function pruneExcessMines(state) {
  if (!state?.mines) {
    return;
  }
  const limit = Math.max(1, Math.floor(state.maxMines || 0));
  if (state.mines.length <= limit) {
    return;
  }
  const overflow = state.mines.length - limit;
  const removalOrder = state.mines
    .map((mine, index) => ({ mine, index }))
    .sort((a, b) => {
      if (a.mine?.armed !== b.mine?.armed) {
        return a.mine?.armed ? 1 : -1;
      }
      const tierDelta = (a.mine?.tier || 0) - (b.mine?.tier || 0);
      if (tierDelta !== 0) {
        return tierDelta;
      }
      return (a.mine?.chargeProgress || 0) - (b.mine?.chargeProgress || 0);
    })
    .slice(0, overflow)
    .map((entry) => entry.index)
    .sort((a, b) => b - a);

  removalOrder.forEach((index) => {
    state.mines.splice(index, 1);
  });
}

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
      mineRadiusPixels: 0,
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
  const lambdaPowerRaw = calculateTowerEquationResult('lambda') || 0;
  const lambdaPower = Number.isFinite(lambdaPowerRaw) ? Math.max(0, lambdaPowerRaw) : 0;

  // tier = Aleph1
  const aleph1Value = computeTowerVariableValue('mu', 'aleph1', blueprint);
  const maxTier = clampTierValue(aleph1Value);

  // max = 5 + Aleph2
  const aleph2Value = computeTowerVariableValue('mu', 'aleph2', blueprint);
  const maxMines = Math.max(1, 5 + (Number.isFinite(aleph2Value) ? Math.round(aleph2Value) : 0));

  // spd = 0.5 + 0.1 * Aleph3
  const aleph3Value = computeTowerVariableValue('mu', 'aleph3', blueprint);
  const rawPlacementRate = 0.5 + 0.1 * (Number.isFinite(aleph3Value) ? aleph3Value : 0);
  const placementRate =
    Number.isFinite(rawPlacementRate) && rawPlacementRate > 0 ? rawPlacementRate : 0.5;
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rangePixels = Math.max(24, metersToPixels(BASE_RANGE_METERS, minDimension));
  const mineRadiusPixels = metersToPixels(MINE_RADIUS_METERS, minDimension);

  const baseCooldown = placementRate > 0 ? 1 / placementRate : 2;

  state.lambdaPower = lambdaPower;
  state.maxTier = maxTier;
  state.maxMines = maxMines;
  state.placementRate = placementRate;
  state.baseCooldown = baseCooldown;
  state.rangeMeters = BASE_RANGE_METERS;
  state.rangePixels = rangePixels;
  state.mineRadiusPixels = mineRadiusPixels;

  synchronizeMinesWithState(state, mineRadiusPixels, maxTier);
  pruneExcessMines(state);

  // Update tower stats for display
  const maxTierDamage = lambdaPower * (maxTier * 10);
  const normalizedDamage = Number.isFinite(maxTierDamage) ? maxTierDamage : 0;
  tower.baseDamage = normalizedDamage;
  tower.damage = normalizedDamage;
  tower.baseRate = placementRate;
  tower.rate = placementRate;
  tower.baseRange = rangePixels;
  tower.range = rangePixels;

  // Prevent stale cooldowns from soft-locking mine placement when placementRate was invalid.
  if (!Number.isFinite(state.cooldown) || state.cooldown > state.baseCooldown) {
    state.cooldown = 0;
    tower.cooldown = state.cooldown;
  }
}

/**
 * Resolve minimum playfield dimension for pixel calculations.
 */
/**
 * Resolve minimum playfield dimension for pixel calculations.
 * Caches the last valid dimension to prevent sudden range changes.
 */
let cachedPlayfieldDimension = null;

function resolvePlayfieldMinDimension(playfield) {
  const dimensionCandidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    dimensionCandidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    dimensionCandidates.push(playfield.renderHeight);
  }
  
  if (dimensionCandidates.length) {
    const minDimension = Math.min(...dimensionCandidates);
    cachedPlayfieldDimension = minDimension;
    return minDimension;
  }
  
  // Use cached value if available
  if (cachedPlayfieldDimension !== null && cachedPlayfieldDimension > 0) {
    return cachedPlayfieldDimension;
  }
  
  // Fallback to reasonable default (800px is a common canvas size)
  console.warn('μ tower: playfield dimensions not available, using fallback value of 800px');
  return 800;
}

/**
 * Find a random valid position on the track within tower range.
 */
function findRandomTrackPosition(playfield, tower, rangePixels) {
  // Mu mines must sit on the smoothed path points generated by the playfield.
  const pathPoints = Array.isArray(playfield.pathPoints) ? playfield.pathPoints : null;
  if (!pathPoints || pathPoints.length < 2) {
    return null;
  }
  
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pick a random segment of the path
    const segmentIndex = Math.floor(Math.random() * (pathPoints.length - 1));
    const start = pathPoints[segmentIndex];
    const end = pathPoints[segmentIndex + 1];
    
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
  
  for (let i = 0; i < pathPoints.length; i++) {
    const point = pathPoints[i];
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
  const mineRadiusPixels =
    Number.isFinite(state.mineRadiusPixels) && state.mineRadiusPixels > 0
      ? state.mineRadiusPixels
      : metersToPixels(MINE_RADIUS_METERS, minDimension);
  const targetTier = clampTierValue(state.maxTier);

  const mine = {
    id: `mu-mine-${Date.now()}-${Math.random()}`,
    x: position.x,
    y: position.y,
    tier: 0,
    targetTier,
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
  const desiredTier = clampTierValue(state.maxTier);
  const mineRadius =
    Number.isFinite(state.mineRadiusPixels) && state.mineRadiusPixels > 0
      ? state.mineRadiusPixels
      : null;

  state.mines.forEach((mine, index) => {
    if (!mine) {
      return;
    }

    if (mineRadius) {
      mine.radiusPixels = mineRadius;
    }

    if (mine.targetTier !== desiredTier) {
      mine.targetTier = desiredTier;
      if (mine.tier >= desiredTier) {
        mine.tier = desiredTier;
        mine.armed = true;
        mine.chargeProgress = 0;
      } else {
        mine.armed = false;
      }
    }

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
  
  if (
    state.cooldown <= 0 &&
    state.mines.length < state.maxMines &&
    Number.isFinite(state.baseCooldown)
  ) {
    const mine = placeMine(playfield, tower, state);
    if (mine) {
      state.cooldown = state.baseCooldown;
      tower.cooldown = state.cooldown;
    }
  }
}

/**
 * Draw a polygon-based mine where each tier adds an edge and a Roman numeral label.
 */
function drawPolygonMine(ctx, mine, minDimension, colors) {
  const x = mine.x;
  const y = mine.y;
  const tier = Math.max(0, Math.floor(mine.tier));
  const sides = Math.max(3, tier + 2); // Tier 1 → triangle, Tier 2 → square, etc.
  const tierGrowthSteps = Math.max(0, tier - 1);
  const sizeMeters = POLYGON_BASE_SIZE * Math.pow(POLYGON_TIER_GROWTH, tierGrowthSteps);
  const radiusPixels = metersToPixels(sizeMeters, minDimension);

  const baseAlpha = mine.armed
    ? 0.95
    : 0.55 + 0.35 * Math.min(1, mine.chargeProgress / TIER_CHARGE_TIME);
  const strokeColor = mine.prestige ? colors[0] : colors[1];
  const fillColor = mine.prestige ? colors[2] : colors[0];

  ctx.save();

  // Draw the main polygon shell.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = `rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${baseAlpha})`;
  ctx.fillStyle = `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, ${baseAlpha * 0.4})`;
  ctx.beginPath();

  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = x + radiusPixels * Math.cos(angle);
    const py = y + radiusPixels * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner ring to emphasize charge state.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${baseAlpha * 0.65})`;
  ctx.beginPath();
  ctx.arc(x, y, radiusPixels * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  // Tier indicator in Roman numerals.
  if (tier > 0) {
    const numeral = convertToRomanNumeral(tier);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, baseAlpha + 0.05)})`;
    ctx.font = `${Math.max(12, radiusPixels * 0.8)}px 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numeral, x, y);
  }

  ctx.restore();
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
    drawPolygonMine(ctx, mine, minDimension, colors);
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
