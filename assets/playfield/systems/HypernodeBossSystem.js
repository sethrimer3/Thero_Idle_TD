// Hypernode boss encounter system.
// A network-anchor boss that forms defensive connections to nearby enemies,
// creating a prismatic polygonal shield that blocks projectiles and disables
// towers inside it.
//
// The boss selects up to MAX_CONNECTIONS nearby enemies, computes a convex hull
// polygon from their positions, and uses that hull as an active defense zone.

// ─── Tunable constants (editable without code changes) ──────────────────────
/** Maximum number of enemy connections Hypernode can form. */
export const MAX_CONNECTIONS = 10;
/** Seconds between connection recalculation passes. */
export const CONNECTION_UPDATE_INTERVAL = 0.25;
/** Fill opacity for the defensive polygon (0–1). */
export const POLYGON_OPACITY = 0.20;
/** Whether the polygon blocks projectiles on contact. */
export const PROJECTILE_BLOCKING = true;
/** Whether towers inside the polygon are disabled. */
export const TOWER_DISABLE_ENABLED = true;
/** Minimum number of connections required to form a polygon (need 2 + Hypernode = 3 points). */
const MIN_POLYGON_CONNECTIONS = 2;
/** Range within which Hypernode searches for connectable enemies (normalised playfield fraction). */
export const CONNECTION_RANGE = 0.45;
/** Speed of the prismatic hue cycle in degrees per second. */
const PRISMATIC_HUE_CYCLE_SPEED = 40;
/** Far-future duration (seconds) used to keep towers disabled while inside the polygon. */
const TOWER_DISABLE_DURATION = 999999;
/** Distance threshold (pixels) below which two candidates are considered equidistant
 *  so the sort falls through to path-progress preference. */
const DISTANCE_EQUALITY_THRESHOLD = 1;

// ─── Convex hull (Andrew's monotone chain) ──────────────────────────────────

/**
 * Compute the 2-D convex hull of a set of {x,y} points.
 * Returns hull vertices in counter-clockwise order.
 * Uses Andrew's monotone chain algorithm — O(n log n).
 * @param {Array<{x:number,y:number}>} points
 * @returns {Array<{x:number,y:number}>}
 */
export function computeConvexHull(points) {
  if (!points || points.length < 3) {
    return points ? [...points] : [];
  }
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const n = sorted.length;

  // Cross product of vectors OA and OB where O is origin, A and B are points.
  const cross = (O, A, B) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

  // Build lower hull
  const lower = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  // Build upper hull
  const upper = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ─── Point-in-polygon (ray casting) ─────────────────────────────────────────

/**
 * Test whether a point lies inside a convex polygon.
 * Uses the ray-casting algorithm for robustness with arbitrary simple polygons.
 * @param {{x:number,y:number}} point
 * @param {Array<{x:number,y:number}>} polygon - vertices in order
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) {
    return false;
  }
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if ((yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Segment-polygon intersection ───────────────────────────────────────────

/**
 * Test whether a line segment (p1→p2) intersects a polygon boundary or lies inside it.
 * Used for projectile-polygon collision.
 * @param {{x:number,y:number}} p1
 * @param {{x:number,y:number}} p2
 * @param {Array<{x:number,y:number}>} polygon
 * @returns {boolean}
 */
export function segmentIntersectsPolygon(p1, p2, polygon) {
  if (!p1 || !p2 || !polygon || polygon.length < 3) {
    return false;
  }
  // If either endpoint is inside the polygon, intersection is guaranteed.
  if (pointInPolygon(p1, polygon) || pointInPolygon(p2, polygon)) {
    return true;
  }
  // Check each edge of the polygon for intersection with the segment.
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentsIntersect(p1, p2, polygon[i], polygon[j])) {
      return true;
    }
  }
  return false;
}

/**
 * Test whether two line segments (a1→a2) and (b1→b2) intersect.
 * @returns {boolean}
 */
function segmentsIntersect(a1, a2, b1, b2) {
  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(b1, b2, a1)) return true;
  if (d2 === 0 && onSegment(b1, b2, a2)) return true;
  if (d3 === 0 && onSegment(a1, a2, b1)) return true;
  if (d4 === 0 && onSegment(a1, a2, b2)) return true;
  return false;
}

function direction(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function onSegment(a, b, c) {
  return (
    Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y)
  );
}

// ─── Hypernode state initialisation ─────────────────────────────────────────

/**
 * Initialise Hypernode boss state on an enemy object.
 * Idempotent — will not reinitialise an enemy that already has state.
 * @param {object} enemy - the enemy to attach hypernode state to
 */
export function initHypernode(enemy) {
  if (!enemy || enemy._hypernode) {
    return;
  }
  enemy._hypernode = {
    /** IDs of currently connected enemies. */
    connectedIds: [],
    /** Cached positions of connected enemies (pixel coords). */
    connectedPositions: [],
    /** Convex hull vertices forming the polygon (pixel coords). */
    hullVertices: [],
    /** Whether a valid polygon is currently active. */
    polygonActive: false,
    /** Timer for periodic connection recalculation. */
    connectionTimer: 0,
    /** Elapsed time for shimmer animation. */
    elapsedTime: 0,
    /** Prismatic hue offset for visual cycling. */
    hueOffset: 0,
    /** IDs of towers currently disabled by the polygon. */
    disabledTowerIds: new Set(),
  };
}

// ─── Connection selection ───────────────────────────────────────────────────

/**
 * Select up to MAX_CONNECTIONS nearby enemies to connect to.
 * Prefers nearest enemies, with a slight preference for enemies ahead on the path.
 * @param {object} enemy - the Hypernode boss
 * @param {Array} allEnemies - all active enemies
 * @param {Function} getPosition - function(enemy) → {x,y} pixel position
 * @returns {Array<number>} array of selected enemy IDs
 */
export function selectConnections(enemy, allEnemies, getPosition) {
  if (!enemy || !allEnemies || !getPosition) {
    return [];
  }
  const bossPos = getPosition(enemy);
  if (!bossPos) {
    return [];
  }

  const candidates = [];
  for (const other of allEnemies) {
    if (!other || other.id === enemy.id) {
      continue;
    }
    const pos = getPosition(other);
    if (!pos) {
      continue;
    }
    const dist = Math.hypot(pos.x - bossPos.x, pos.y - bossPos.y);
    // Use normalised distance (relative to renderWidth) for range check later.
    candidates.push({
      id: other.id,
      dist,
      progress: other.progress || 0,
      pos,
    });
  }

  // Sort by distance first, then prefer enemies ahead on the path (higher progress).
  candidates.sort((a, b) => {
    const distDiff = a.dist - b.dist;
    if (Math.abs(distDiff) > DISTANCE_EQUALITY_THRESHOLD) {
      return distDiff;
    }
    // Prefer enemies ahead of Hypernode on the path
    return b.progress - a.progress;
  });

  return candidates.slice(0, MAX_CONNECTIONS).map((c) => c.id);
}

// ─── Main update ────────────────────────────────────────────────────────────

/**
 * Update Hypernode boss state each frame. Recalculates connections at fixed
 * intervals and rebuilds the convex hull polygon.
 * @param {object} enemy - the Hypernode boss
 * @param {number} delta - seconds since last frame
 * @param {Array} allEnemies - all active enemies
 * @param {Function} getPosition - function(enemy) → {x,y} pixel position
 * @param {Function} getEnemyById - function(id) → enemy or null
 */
export function updateHypernode(enemy, delta, allEnemies, getPosition, getEnemyById) {
  if (!enemy || !enemy._hypernode) {
    return;
  }
  const state = enemy._hypernode;
  state.elapsedTime += delta;
  state.hueOffset = (state.elapsedTime * PRISMATIC_HUE_CYCLE_SPEED) % 360; // slow prismatic hue cycle

  // Purge dead connections immediately
  let connectionsDirty = false;
  for (let i = state.connectedIds.length - 1; i >= 0; i--) {
    const connected = getEnemyById(state.connectedIds[i]);
    if (!connected) {
      state.connectedIds.splice(i, 1);
      connectionsDirty = true;
    }
  }

  // Periodic full recalculation
  state.connectionTimer += delta;
  if (connectionsDirty || state.connectionTimer >= CONNECTION_UPDATE_INTERVAL) {
    state.connectionTimer = 0;
    state.connectedIds = selectConnections(enemy, allEnemies, getPosition);
    connectionsDirty = true;
  }

  // Rebuild positions and hull
  const bossPos = getPosition(enemy);
  if (!bossPos) {
    state.polygonActive = false;
    state.hullVertices = [];
    state.connectedPositions = [];
    return;
  }

  state.connectedPositions = [];
  const hullPoints = [{ x: bossPos.x, y: bossPos.y }];
  for (const id of state.connectedIds) {
    const connected = getEnemyById(id);
    if (!connected) {
      continue;
    }
    const pos = getPosition(connected);
    if (!pos) {
      continue;
    }
    state.connectedPositions.push({ x: pos.x, y: pos.y, id });
    hullPoints.push({ x: pos.x, y: pos.y });
  }

  // Need at least 3 points (Hypernode + 2 enemies) for a polygon
  if (hullPoints.length >= MIN_POLYGON_CONNECTIONS + 1) {
    state.hullVertices = computeConvexHull(hullPoints);
    state.polygonActive = state.hullVertices.length >= 3;
  } else {
    state.hullVertices = [];
    state.polygonActive = false;
  }
}

// ─── Tower disable check ────────────────────────────────────────────────────

/**
 * Check all towers against the Hypernode polygon. Towers inside the polygon are
 * disabled; towers outside are re-enabled (if they were disabled by Hypernode).
 * @param {object} enemy - the Hypernode boss
 * @param {Array} towers - all placed towers
 */
export function updateTowerDisableStates(enemy, towers) {
  if (!enemy || !enemy._hypernode || !TOWER_DISABLE_ENABLED) {
    return;
  }
  const state = enemy._hypernode;
  const previouslyDisabled = new Set(state.disabledTowerIds);
  state.disabledTowerIds.clear();

  if (!state.polygonActive || !state.hullVertices.length) {
    // No polygon — re-enable any towers we previously disabled.
    for (const towerId of previouslyDisabled) {
      const tower = towers.find((t) => t && t.id === towerId);
      if (tower && tower._hypernodeDisabled) {
        delete tower._hypernodeDisabled;
        // Only clear disabledUntil if it was set by Hypernode
        if (tower._hypernodeDisabledUntil === tower.disabledUntil) {
          delete tower.disabledUntil;
          delete tower._hypernodeDisabledUntil;
        }
      }
    }
    return;
  }

  const hull = state.hullVertices;
  for (const tower of towers) {
    if (!tower) {
      continue;
    }
    const towerPos = { x: tower.x, y: tower.y };
    if (pointInPolygon(towerPos, hull)) {
      // Tower is inside the polygon — disable it.
      state.disabledTowerIds.add(tower.id);
      if (!tower._hypernodeDisabled) {
        tower._hypernodeDisabled = true;
        const farFuture = (typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()) / 1000 + TOWER_DISABLE_DURATION;
        tower.disabledUntil = farFuture;
        tower._hypernodeDisabledUntil = farFuture;
      }
    } else {
      // Tower is outside — re-enable if we were disabling it.
      if (tower._hypernodeDisabled) {
        delete tower._hypernodeDisabled;
        if (tower._hypernodeDisabledUntil === tower.disabledUntil) {
          delete tower.disabledUntil;
          delete tower._hypernodeDisabledUntil;
        }
      }
    }
  }
}

// ─── Projectile blocking ────────────────────────────────────────────────────

/**
 * Check if a projectile path intersects the Hypernode polygon.
 * Returns true if the projectile should be destroyed (blocked by the shield).
 * @param {object} enemy - the Hypernode boss
 * @param {{x:number,y:number}} projStart - projectile previous position
 * @param {{x:number,y:number}} projEnd - projectile current position
 * @returns {boolean}
 */
export function doesProjectileHitPolygon(enemy, projStart, projEnd) {
  if (!PROJECTILE_BLOCKING) {
    return false;
  }
  if (!enemy || !enemy._hypernode || !enemy._hypernode.polygonActive) {
    return false;
  }
  const hull = enemy._hypernode.hullVertices;
  if (!hull || hull.length < 3) {
    return false;
  }
  return segmentIntersectsPolygon(projStart, projEnd, hull);
}

// ─── Cleanup on boss death ──────────────────────────────────────────────────

/**
 * Clean up Hypernode state when the boss dies. Re-enables any towers that were
 * disabled by the polygon.
 * @param {object} enemy - the dying Hypernode boss
 * @param {Array} towers - all placed towers
 */
export function cleanupHypernode(enemy, towers) {
  if (!enemy || !enemy._hypernode) {
    return;
  }
  const state = enemy._hypernode;
  // Re-enable all towers we disabled
  if (towers) {
    for (const towerId of state.disabledTowerIds) {
      const tower = towers.find((t) => t && t.id === towerId);
      if (tower && tower._hypernodeDisabled) {
        delete tower._hypernodeDisabled;
        if (tower._hypernodeDisabledUntil === tower.disabledUntil) {
          delete tower.disabledUntil;
          delete tower._hypernodeDisabledUntil;
        }
      }
    }
  }
  state.disabledTowerIds.clear();
  state.polygonActive = false;
  state.hullVertices = [];
  state.connectedIds = [];
  state.connectedPositions = [];
}
