// Quantum Tunneler projection system.
// The tunneler exists in multiple projected positions simultaneously.
// Only one projection is vulnerable at a time. After N collapses, the enemy
// enters a final collapsed state and can be killed normally.
//
// Design note: projections are purely visual + hit-testing offsets applied to a
// single logical enemy. The enemy still follows one true path position.

// ─── Tuning constants ─────────────────────────────────────────────────────────
// Number of visual projections rendered simultaneously.
export const QUANTUM_PROJECTION_COUNT = 3;
// Number of projection collapses required before the final collapsed phase.
export const QUANTUM_COLLAPSE_THRESHOLD = 3;
// HP fraction per projection layer (each collapse removes this fraction of max HP).
export const QUANTUM_LAYER_HP_FRACTION = 0.2;
// Seconds between active projection switches.
export const QUANTUM_SWITCH_INTERVAL = 2.5;
// Offset distance for projections (normalised playfield units).
export const QUANTUM_PROJECTION_OFFSET = 0.06;
// HP multiplier applied in collapsed (final) phase.
export const QUANTUM_COLLAPSED_HP_SCALE = 0.4;

/**
 * Initialise quantum projection state on a tunneler enemy.
 */
export function initQuantumProjection(enemy) {
  if (!enemy || enemy._quantum) {
    return;
  }
  enemy._quantum = {
    projections: QUANTUM_PROJECTION_COUNT,
    activeIndex: 0,           // which projection is currently vulnerable
    collapses: 0,             // how many projections have been defeated
    collapsed: false,         // true when in final phase
    switchTimer: 0,           // seconds until next active projection switch
    offsets: [],              // {dx, dy} offsets for each projection
  };
  // Generate evenly-spaced angular offsets for projections around the true position.
  const angleStep = (Math.PI * 2) / QUANTUM_PROJECTION_COUNT;
  for (let i = 0; i < QUANTUM_PROJECTION_COUNT; i++) {
    const angle = angleStep * i;
    enemy._quantum.offsets.push({
      dx: Math.cos(angle) * QUANTUM_PROJECTION_OFFSET,
      dy: Math.sin(angle) * QUANTUM_PROJECTION_OFFSET,
    });
  }
}

/**
 * Update quantum projection state each frame.
 * Cycles the active projection index on a timer.
 * @param {object} enemy
 * @param {number} delta - frame time in seconds
 */
export function updateQuantumProjection(enemy, delta) {
  if (!enemy || !enemy._quantum || enemy._quantum.collapsed) {
    return;
  }
  enemy._quantum.switchTimer += delta;
  if (enemy._quantum.switchTimer >= QUANTUM_SWITCH_INTERVAL) {
    enemy._quantum.switchTimer = 0;
    // Cycle to next available projection
    const remaining = enemy._quantum.projections - enemy._quantum.collapses;
    if (remaining > 0) {
      enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
      // Skip collapsed projections
      let safety = enemy._quantum.projections;
      while (enemy._quantum._collapsedIndices &&
             enemy._quantum._collapsedIndices.has(enemy._quantum.activeIndex) &&
             safety-- > 0) {
        enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
      }
    }
  }
}

/**
 * Check if damage should be applied to this tunneler.
 * Returns true if the attack hits the active projection, false for a "phase miss".
 * @param {object} enemy
 * @param {object} hitPos - position the attack is targeting
 * @param {object} truePos - true enemy position on the path
 * @returns {{ hit: boolean, collapse: boolean }}
 */
export function resolveQuantumHit(enemy, _hitPos, _truePos) {
  if (!enemy || !enemy._quantum) {
    return { hit: true, collapse: false };
  }
  if (enemy._quantum.collapsed) {
    return { hit: true, collapse: false };
  }
  // In the projection phase, always allow damage (targeting handles which projection
  // is active). Each time the enemy's HP drops below a layer threshold, trigger collapse.
  return { hit: true, collapse: false };
}

/**
 * Called after damage is applied. Checks if a projection layer should collapse.
 * @param {object} enemy
 * @returns {boolean} true if a collapse just occurred
 */
export function checkQuantumCollapse(enemy) {
  if (!enemy || !enemy._quantum || enemy._quantum.collapsed) {
    return false;
  }
  const maxHp = Number.isFinite(enemy.maxHp) && enemy.maxHp > 0 ? enemy.maxHp : 1;
  const currentHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
  const hpFraction = currentHp / maxHp;
  // Each collapse triggers at evenly spaced HP thresholds
  const nextCollapseAt = 1 - (enemy._quantum.collapses + 1) * QUANTUM_LAYER_HP_FRACTION;
  if (hpFraction <= nextCollapseAt && enemy._quantum.collapses < QUANTUM_COLLAPSE_THRESHOLD) {
    enemy._quantum.collapses++;
    if (!enemy._quantum._collapsedIndices) {
      enemy._quantum._collapsedIndices = new Set();
    }
    enemy._quantum._collapsedIndices.add(enemy._quantum.activeIndex);
    // Cycle to next available projection
    enemy._quantum.switchTimer = 0;
    const remaining = enemy._quantum.projections - enemy._quantum.collapses;
    if (remaining <= 0 || enemy._quantum.collapses >= QUANTUM_COLLAPSE_THRESHOLD) {
      // Enter collapsed phase
      enemy._quantum.collapsed = true;
      // Scale remaining HP for the final phase
      enemy.hp = currentHp * QUANTUM_COLLAPSED_HP_SCALE;
      enemy.maxHp = currentHp * QUANTUM_COLLAPSED_HP_SCALE;
    } else {
      // Switch active to next uncollapsed projection
      enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
      let safety = enemy._quantum.projections;
      while (enemy._quantum._collapsedIndices.has(enemy._quantum.activeIndex) && safety-- > 0) {
        enemy._quantum.activeIndex = (enemy._quantum.activeIndex + 1) % enemy._quantum.projections;
      }
    }
    return true;
  }
  return false;
}
