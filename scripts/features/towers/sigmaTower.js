/**
 * Sigma (σ / Σ) Tower – Damage Summation Anchor
 *
 * Core rules:
 * - Allied lattices treat σ as an enemy when it is within their range (handled by the playfield).
 * - σ stores every point of allied damage it receives instead of taking damage.
 * - Attack equation: `Atk = storedDmg`.
 * - Lowercase σ releases the entire stored pool in a single shot and resets the pool.
 * - Prestige Σ keeps accumulating; every discharge copies the current pool without resetting it.
 */

const SIGMA_MAX_STORED_DAMAGE = 1e120; // Prevent runaway values while still allowing astronomical sums.

function clampStoredDamage(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(value, SIGMA_MAX_STORED_DAMAGE));
}

function isPrestigeSigma(tower) {
  if (!tower) {
    return false;
  }
  if (tower.symbol === 'Σ' || tower.definition?.symbol === 'Σ') {
    return true;
  }
  if (tower.prestige || tower.isPrestigeSigma) {
    return true;
  }
  return false;
}

/**
 * Ensure σ towers keep a dedicated accumulator state.
 */
export function ensureSigmaState(playfield, tower) {
  if (!tower || tower.type !== 'sigma') {
    return null;
  }
  if (!tower.sigmaState) {
    tower.sigmaState = {
      storedDamage: 0,
      totalAbsorbed: 0,
      lastRelease: 0,
      prestige: false,
      lastContributorId: null,
    };
  }
  const state = tower.sigmaState;
  state.prestige = isPrestigeSigma(tower);
  state.storedDamage = clampStoredDamage(state.storedDamage || 0);
  state.totalAbsorbed = clampStoredDamage(state.totalAbsorbed || 0);
  tower.damage = state.storedDamage;
  tower.baseDamage = state.storedDamage;
  return state;
}

/**
 * Remove σ metadata when the tower changes form.
 */
export function teardownSigmaTower(playfield, tower) {
  if (!tower || !tower.sigmaState) {
    return;
  }
  delete tower.sigmaState;
}

/**
 * Capture allied damage for σ.
 */
export function absorbSigmaDamage(playfield, tower, damage, { sourceTower } = {}) {
  if (!tower || tower.type !== 'sigma') {
    return 0;
  }
  const state = ensureSigmaState(playfield, tower);
  const absorbed = clampStoredDamage(Number.isFinite(damage) ? damage : 0);
  if (absorbed <= 0) {
    return state.storedDamage;
  }
  state.storedDamage = clampStoredDamage((state.storedDamage || 0) + absorbed);
  state.totalAbsorbed = clampStoredDamage((state.totalAbsorbed || 0) + absorbed);
  state.lastContributorId = sourceTower?.id || null;
  tower.damage = state.storedDamage;
  tower.baseDamage = state.storedDamage;
  return state.storedDamage;
}

/**
 * Release σ shots only when damage is available.
 */
export function updateSigmaTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'sigma') {
    return;
  }
  const state = ensureSigmaState(playfield, tower);
  tower.damage = state.storedDamage;
  tower.baseDamage = state.storedDamage;
  if (!playfield.combatActive) {
    return;
  }
  if (tower.cooldown > 0 || !Number.isFinite(tower.rate) || tower.rate <= 0) {
    return;
  }
  if (state.storedDamage <= 0) {
    return;
  }
  const targetInfo = playfield.findTarget(tower, { includeSigmaTargets: false });
  if (!targetInfo) {
    return;
  }
  tower.cooldown = 1 / tower.rate;
  playfield.fireAtTarget(tower, targetInfo);
}

/**
 * Resolve σ attack damage using the stored pool and prestige flag.
 */
export function resolveSigmaShotDamage(playfield, tower) {
  if (!tower || tower.type !== 'sigma' || !tower.sigmaState) {
    return 0;
  }
  const state = tower.sigmaState;
  const stored = clampStoredDamage(state.storedDamage || 0);
  if (stored <= 0) {
    return 0;
  }
  state.lastRelease = stored;
  if (!state.prestige) {
    state.storedDamage = 0;
  }
  tower.damage = state.storedDamage;
  tower.baseDamage = state.storedDamage;
  return stored;
}
