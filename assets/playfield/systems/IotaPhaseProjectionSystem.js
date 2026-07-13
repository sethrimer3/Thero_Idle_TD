/**
 * Iota Phase Projection System
 *
 * Implements complex-plane projection for the Iota tower's Phase Coupling mechanic.
 * When an enemy inside an Iota field receives damage or a status effect, this system
 * projects scaled copies of that effect onto every other enemy in the same field.
 *
 * Conceptual equation: z' = z · φ_c · e^(iθ)
 *   z   = original applied effect
 *   φ_c = phase coupling magnitude
 *   θ   = phase rotation (visual only for now; extensible)
 *   z'  = projected echo effect
 *
 * Recursion guard: projected effects carry an `isPhaseProjection` flag so they cannot
 * trigger another round of projection. This prevents infinite cascading.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum coupling required before projections activate. */
const MIN_COUPLING_THRESHOLD = 0.001;

// ─── Field membership helpers ────────────────────────────────────────────────

/**
 * Collect all Iota towers on the playfield.
 * @param {Object} playfield
 * @returns {Array<Object>} Iota towers with valid state
 */
function getActiveIotaTowers(playfield) {
  const result = [];
  if (!playfield?.towers) return result;
  for (let i = 0; i < playfield.towers.length; i++) {
    const tower = playfield.towers[i];
    if (tower?.type === 'iota' && tower.iotaState && tower.iotaState.phaseCoupling >= MIN_COUPLING_THRESHOLD) {
      result.push(tower);
    }
  }
  return result;
}

/**
 * Check whether an enemy position falls inside a given Iota tower's pulse field.
 * @param {Object} position - {x, y}
 * @param {Object} tower    - Iota tower
 * @returns {boolean}
 */
function isInsideIotaField(position, tower) {
  if (!position || !tower) return false;
  const radius = Number.isFinite(tower.iotaState?.rangePixels) ? tower.iotaState.rangePixels : tower.range;
  if (!Number.isFinite(radius) || radius <= 0) return false;
  const dx = position.x - tower.x;
  const dy = position.y - tower.y;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Find all enemies inside a specific Iota tower's field, excluding a given enemy.
 * @param {Object} playfield
 * @param {Object} tower   - Iota tower
 * @param {Object} exclude - Enemy to exclude (the original damage target)
 * @returns {Array<{enemy: Object, position: Object}>}
 */
function getFieldNeighbours(playfield, tower, exclude) {
  const neighbours = [];
  if (!playfield?.enemies) return neighbours;
  for (let i = 0; i < playfield.enemies.length; i++) {
    const enemy = playfield.enemies[i];
    if (!enemy || enemy === exclude || enemy.id === exclude?.id) continue;
    if (enemy.hp <= 0) continue;
    const pos = playfield.getEnemyPosition(enemy);
    if (!pos) continue;
    if (isInsideIotaField(pos, tower)) {
      neighbours.push({ enemy, position: pos });
    }
  }
  return neighbours;
}

// ─── Projection logic ────────────────────────────────────────────────────────

/**
 * Project damage from a hit enemy onto all other enemies in the same Iota field.
 * Called from applyDamageToEnemy after actual damage is resolved.
 *
 * @param {Object} playfield  - The playfield instance (provides applyDamageToEnemy, etc.)
 * @param {Object} enemy      - The enemy that was originally hit
 * @param {number} appliedDmg - The actual damage applied to that enemy (post-mitigation)
 * @param {Object} opts       - { sourceTower, isPhaseProjection }
 */
export function projectIotaPhaseDamage(playfield, enemy, appliedDmg, opts = {}) {
  // ── Recursion guard: never project a projection ──
  if (opts.isPhaseProjection) return;
  if (!playfield || !enemy || !Number.isFinite(appliedDmg) || appliedDmg <= 0) return;

  const enemyPos = playfield.getEnemyPosition(enemy);
  if (!enemyPos) return;

  const iotaTowers = getActiveIotaTowers(playfield);
  if (!iotaTowers.length) return;

  for (let t = 0; t < iotaTowers.length; t++) {
    const tower = iotaTowers[t];
    // Only project if the hit enemy is inside this tower's field.
    if (!isInsideIotaField(enemyPos, tower)) continue;

    const coupling = tower.iotaState.phaseCoupling;
    if (coupling < MIN_COUPLING_THRESHOLD) continue;

    const projectedDamage = appliedDmg * coupling;
    if (projectedDamage <= 0) continue;

    const neighbours = getFieldNeighbours(playfield, tower, enemy);
    if (!neighbours.length) continue;

    // Apply projected damage to each neighbour.
    for (let n = 0; n < neighbours.length; n++) {
      const { enemy: target, position: _position } = neighbours[n];
      if (!target || target.hp <= 0) continue;
      // Apply damage with recursion guard flag.
      playfield.applyDamageToEnemy(target, projectedDamage, {
        sourceTower: opts.sourceTower || null,
        isPhaseProjection: true,
      });
    }

    // Spawn visual feedback for the projection event.
    spawnPhaseProjectionVisuals(playfield, tower, enemy, enemyPos, neighbours);
  }
}

// ─── Visual effect spawning ──────────────────────────────────────────────────

/** Maximum projection visual effects in the pool to avoid allocation pressure. */
const MAX_PHASE_EFFECTS = 60;

/**
 * Spawn lightweight visual effects for a phase projection event.
 * Creates a rotational pulse at the source enemy and arc indicators to neighbours.
 */
function spawnPhaseProjectionVisuals(playfield, tower, sourceEnemy, sourcePos, neighbours) {
  if (!playfield.phaseProjectionEffects) {
    playfield.phaseProjectionEffects = [];
  }

  const effects = playfield.phaseProjectionEffects;
  const now = performance.now();
  const towerPos = { x: tower.x, y: tower.y };

  // Rotational pulse centered on the source enemy.
  effects.push({
    type: 'pulse',
    x: sourcePos.x,
    y: sourcePos.y,
    towerX: towerPos.x,
    towerY: towerPos.y,
    radius: tower.iotaState.rangePixels || tower.range || 60,
    startTime: now,
    duration: 420,
  });

  // Phase arcs from source to each neighbour (max 8 to keep performance).
  const arcCount = Math.min(neighbours.length, 8);
  for (let i = 0; i < arcCount; i++) {
    const { position } = neighbours[i];
    effects.push({
      type: 'arc',
      x0: sourcePos.x,
      y0: sourcePos.y,
      x1: position.x,
      y1: position.y,
      towerX: towerPos.x,
      towerY: towerPos.y,
      startTime: now,
      duration: 350,
    });
  }

  // Trim pool to prevent memory growth.
  if (effects.length > MAX_PHASE_EFFECTS) {
    effects.splice(0, effects.length - MAX_PHASE_EFFECTS);
  }
}

// ─── Visual effect rendering ─────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;

/**
 * Update and render all active phase projection visual effects.
 * Called once per frame from the projectile/effect render pass.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} playfield
 */
export function renderPhaseProjectionEffects(ctx, playfield) {
  if (!playfield?.phaseProjectionEffects?.length) return;

  const effects = playfield.phaseProjectionEffects;
  const now = performance.now();
  let writeIdx = 0;

  ctx.save();

  for (let i = 0; i < effects.length; i++) {
    const fx = effects[i];
    const elapsed = now - fx.startTime;
    if (elapsed >= fx.duration) continue;

    const t = elapsed / fx.duration;

    if (fx.type === 'pulse') {
      drawPhasePulse(ctx, fx, t);
    } else if (fx.type === 'arc') {
      drawPhaseArc(ctx, fx, t);
    }

    // Keep alive effects in the array.
    effects[writeIdx++] = fx;
  }

  effects.length = writeIdx;
  ctx.restore();
}

/**
 * Render a rotational pulse expanding from a source enemy through the Iota field.
 */
function drawPhasePulse(ctx, fx, t) {
  const expandRadius = 12 + 28 * t;
  const alpha = Math.max(0, 0.45 * (1 - t));

  // Outer pulse ring
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, expandRadius, 0, TWO_PI);
  ctx.strokeStyle = `rgba(140, 200, 255, ${alpha})`;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Inner rotating cross (imaginary/real axes)
  const angle = t * Math.PI * 1.5;
  const crossLen = expandRadius * 0.7;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(fx.x - cos * crossLen, fx.y - sin * crossLen);
  ctx.lineTo(fx.x + cos * crossLen, fx.y + sin * crossLen);
  ctx.moveTo(fx.x + sin * crossLen, fx.y - cos * crossLen);
  ctx.lineTo(fx.x - sin * crossLen, fx.y + cos * crossLen);
  ctx.strokeStyle = `rgba(180, 220, 255, ${alpha * 0.6})`;
  ctx.lineWidth = 1.0;
  ctx.stroke();
}

/**
 * Render a curved phase arc from source to target enemy, implying complex rotation.
 */
function drawPhaseArc(ctx, fx, t) {
  const alpha = Math.max(0, 0.5 * (1 - t * t));
  const progress = Math.min(1, t * 2.5);

  // Compute control point for a curved arc through the field center.
  const midX = (fx.x0 + fx.x1) * 0.5;
  const midY = (fx.y0 + fx.y1) * 0.5;
  // Offset control point perpendicular to the line, curving toward the tower center.
  const dx = fx.x1 - fx.x0;
  const dy = fx.y1 - fx.y0;
  const perpX = -dy * 0.25;
  const perpY = dx * 0.25;
  // Bias curve toward the Iota tower center for a rotational feel.
  const ctrlX = midX + perpX + (fx.towerX - midX) * 0.15;
  const ctrlY = midY + perpY + (fx.towerY - midY) * 0.15;

  ctx.beginPath();
  ctx.moveTo(fx.x0, fx.y0);

  // Draw partial quadratic bezier based on animation progress.
  if (progress >= 1) {
    ctx.quadraticCurveTo(ctrlX, ctrlY, fx.x1, fx.y1);
  } else {
    // Subdivide bezier at progress point.
    const p = progress;
    const ax = (1 - p) * (1 - p) * fx.x0 + 2 * (1 - p) * p * ctrlX + p * p * fx.x1;
    const ay = (1 - p) * (1 - p) * fx.y0 + 2 * (1 - p) * p * ctrlY + p * p * fx.y1;
    const cx2 = (1 - p) * fx.x0 + p * ctrlX;
    const cy2 = (1 - p) * fx.y0 + p * ctrlY;
    ctx.quadraticCurveTo(cx2, cy2, ax, ay);
  }

  ctx.strokeStyle = `rgba(160, 210, 255, ${alpha})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Small arrowhead / dot at the arc tip.
  if (progress >= 1) {
    const dotAlpha = Math.max(0, 0.6 * (1 - t));
    ctx.beginPath();
    ctx.arc(fx.x1, fx.y1, 2.5, 0, TWO_PI);
    ctx.fillStyle = `rgba(200, 230, 255, ${dotAlpha})`;
    ctx.fill();
  }
}

// ─── Complex-plane field overlay rendering ───────────────────────────────────

/**
 * Render the complex-plane field overlay for all active Iota towers.
 * Draws faint coordinate axes, rotating rings, and tick marks to visually
 * communicate that the field is a region of the complex plane.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} playfield
 * @param {number} time - Current time in seconds for animation
 */
export function renderIotaFieldOverlays(ctx, playfield, time) {
  if (!playfield?.towers) return;

  const towers = playfield.towers;
  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i];
    if (tower?.type !== 'iota' || !tower.iotaState) continue;
    if (tower.iotaState.phaseCoupling < MIN_COUPLING_THRESHOLD) continue;
    drawComplexPlaneField(ctx, tower, time);
  }
}

/**
 * Draw the complex-plane field overlay for a single Iota tower.
 */
function drawComplexPlaneField(ctx, tower, time) {
  const radius = tower.iotaState.rangePixels || tower.range || 60;
  const cx = tower.x;
  const cy = tower.y;
  const coupling = tower.iotaState.phaseCoupling;

  // Base alpha scales slightly with coupling strength.
  const baseAlpha = Math.min(0.18, 0.06 + coupling * 0.04);

  ctx.save();

  // ── Faint Real/Imaginary axes ──
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.strokeStyle = `rgba(140, 200, 255, ${baseAlpha * 0.7})`;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // ── Axis labels: Re / Im ──
  ctx.font = '8px "Latin Modern Math", "CMU Serif", Georgia, serif';
  ctx.fillStyle = `rgba(160, 220, 255, ${baseAlpha})`;
  ctx.fillText('Re', cx + radius - 14, cy - 3);
  ctx.fillText('Im', cx + 3, cy - radius + 10);

  // ── Rotating outer ring ──
  const ringAngle = time * 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TWO_PI);
  ctx.strokeStyle = `rgba(140, 200, 255, ${baseAlpha * 0.5})`;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // ── Rotating inner ring at ~60% radius ──
  const innerRadius = radius * 0.6;
  const innerAngle = -time * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, TWO_PI);
  ctx.strokeStyle = `rgba(160, 210, 255, ${baseAlpha * 0.35})`;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // ── Rotating tick marks around outer ring (8 ticks) ──
  const tickCount = 8;
  const tickLen = 4;
  for (let j = 0; j < tickCount; j++) {
    const a = ringAngle + (j / tickCount) * TWO_PI;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + cos * (radius - tickLen), cy + sin * (radius - tickLen));
    ctx.lineTo(cx + cos * (radius + 1), cy + sin * (radius + 1));
    ctx.strokeStyle = `rgba(180, 230, 255, ${baseAlpha * 0.6})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── Rotating vector indicator (phase arrow) ──
  const vecAngle = innerAngle + time * 0.8;
  const vecLen = innerRadius * 0.85;
  const vx = cx + Math.cos(vecAngle) * vecLen;
  const vy = cy + Math.sin(vecAngle) * vecLen;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(vx, vy);
  ctx.strokeStyle = `rgba(200, 240, 255, ${baseAlpha * 0.5})`;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Small dot at the tip of the phase vector.
  ctx.beginPath();
  ctx.arc(vx, vy, 1.8, 0, TWO_PI);
  ctx.fillStyle = `rgba(200, 240, 255, ${baseAlpha * 0.6})`;
  ctx.fill();

  ctx.restore();
}
