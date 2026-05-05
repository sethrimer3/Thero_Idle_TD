// Gamma Star Burst System — extracted from SimplePlayfield (Build 710).
// Manages the animated pentagram star traces that appear on enemies hit by gamma projectiles.
// These functions use 'this' (the SimplePlayfield instance) via .call().

// ── Math constants ──────────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

// ── Tunables ────────────────────────────────────────────────────────────
const GAMMA_STAR_SPEED = 200;
const GAMMA_STAR_SEQUENCE = [0, 2, 4, 1, 3, 0];

/**
 * Advance gamma star burst effects on enemies that were hit by gamma projectiles.
 * Each burst traces a pentagram star pattern centred on the impacted enemy.
 */
export function updateGammaStarBursts(delta) {
  if (!Array.isArray(this.gammaStarBursts) || this.gammaStarBursts.length === 0) {
    return;
  }

  const sequence = GAMMA_STAR_SEQUENCE;

  for (let i = this.gammaStarBursts.length - 1; i >= 0; i--) {
    const burst = this.gammaStarBursts[i];
    burst.lifetime = (burst.lifetime || 0) + delta;
    burst.starElapsed = (burst.starElapsed || 0) + delta;

    // Remove if lifetime exceeded
    if (burst.lifetime >= burst.maxLifetime) {
      this.gammaStarBursts.splice(i, 1);
      continue;
    }

    // Update center to track enemy if it still exists
    const enemy = this.getEnemyById(burst.enemyId);
    if (enemy) {
      const enemyPos = this.getEnemyPosition(enemy);
      if (enemyPos) {
        burst.center = { ...enemyPos };
      }
    }

    // Update star tracing animation
    const edgeIndex = Number.isFinite(burst.starEdgeIndex) ? burst.starEdgeIndex : 0;
    const atEndOfSequence = edgeIndex >= sequence.length - 1;

    if (atEndOfSequence && burst.burstDuration <= 0) {
      this.gammaStarBursts.splice(i, 1);
      continue;
    }

    if (atEndOfSequence && burst.burstDuration > 0 && burst.starElapsed >= burst.burstDuration) {
      this.gammaStarBursts.splice(i, 1);
      continue;
    }

    if (atEndOfSequence && burst.burstDuration > 0) {
      burst.starEdgeIndex = 0;
      burst.starEdgeProgress = 0;
      continue;
    }

    // Calculate star edge distance and progress
    const radius = burst.starRadius || 22;
    const angles = [];
    for (let step = 0; step < 5; step += 1) {
      angles.push(-HALF_PI + (step * TWO_PI) / 5);
    }
    const starPoints = angles.map((angle) => ({
      x: burst.center.x + Math.cos(angle) * radius,
      y: burst.center.y + Math.sin(angle) * radius,
    }));

    const fromIndex = sequence[edgeIndex];
    const toIndex = sequence[edgeIndex + 1];
    const fromPoint = starPoints[fromIndex];
    const toPoint = starPoints[toIndex];

    if (!fromPoint || !toPoint) {
      this.gammaStarBursts.splice(i, 1);
      continue;
    }

    const edgeDistance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y) || 1;
    const starSpeed = burst.starSpeed || GAMMA_STAR_SPEED;
    const edgeDuration = Math.max(0.0001, edgeDistance / Math.max(1, starSpeed));
    const progress = Math.min(1, (burst.starEdgeProgress || 0) + delta / edgeDuration);

    burst.currentPosition = {
      x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
      y: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
    };
    burst.starEdgeProgress = progress;

    if (progress >= 1) {
      burst.starEdgeIndex = edgeIndex + 1;
      burst.starEdgeProgress = 0;
    }
  }
}
