// Enemy focus and tooltip system extracted from SimplePlayfield.
// These functions use 'this' (the SimplePlayfield instance) via .call().

import { formatCombatNumber } from '../utils/formatting.js';

// ── Math constants ────────────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;
const PI_TIMES_1_2 = Math.PI * 1.2;

/**
 * Compute visual size metrics for an enemy based on its mote factor and HP exponent.
 * Pure calculation—no side-effects.
 */
export function getEnemyVisualMetrics(enemy) {
  if (!enemy) {
    return {
      scale: 1,
      coreRadius: 9,
      ringRadius: 12,
      focusRadius: 18,
      symbolSize: 17,
      exponentSize: 13,
    };
  }

  const moteFactor = Math.max(1, Number.isFinite(enemy.moteFactor) ? enemy.moteFactor : 1);
  const exponent = Math.max(
    1,
    Number.isFinite(enemy.hpExponent)
      ? enemy.hpExponent
      : this.calculateHealthExponent(
          Number.isFinite(enemy.hp) && enemy.hp > 0 ? enemy.hp : enemy.maxHp,
        ),
  );
  const sizeFactor = Math.max(moteFactor, exponent);
  const growth = Number.isFinite(sizeFactor) && sizeFactor > 0 ? Math.log2(sizeFactor) : 0;
  const clampedGrowth = Math.min(Math.max(growth, 0), 4);
  const scale = 1 + clampedGrowth * 0.2;

  const coreRadius = 9 * scale;
  const ringRadius = 12 * scale;
  const focusRadius = ringRadius + 6 * scale;
  const symbolSize = Math.round(Math.min(34, Math.max(16, 17 * scale)));
  const exponentSize = Math.round(Math.min(22, Math.max(9, 12 * scale * 0.62)));

  return { scale, coreRadius, ringRadius, focusRadius, symbolSize, exponentSize };
}

/**
 * Advance the spinning focus-marker angle by delta seconds.
 */
export function updateFocusIndicator(delta) {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  const focusedEnemy = this.getFocusedEnemy();
  if (!focusedEnemy) {
    this.focusMarkerAngle = 0;
    return;
  }
  const spinSpeed = PI_TIMES_1_2;
  this.focusMarkerAngle = (this.focusMarkerAngle + delta * spinSpeed) % TWO_PI;
}

/**
 * Search all live enemies for one under the given canvas-space position.
 * Iterates back-to-front so the topmost drawn enemy is preferred.
 */
export function findEnemyAt(position) {
  if (!this.enemies.length) {
    return null;
  }
  for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = this.enemies[index];
    const enemyPosition = this.getEnemyPosition(enemy);
    const metrics = this.getEnemyVisualMetrics(enemy);
    const hitRadius = this.getEnemyHitRadius(enemy, metrics);
    const distance = Math.hypot(position.x - enemyPosition.x, position.y - enemyPosition.y);
    if (distance <= hitRadius) {
      return { enemy, position: enemyPosition };
    }
  }
  return null;
}

/**
 * Mark an enemy as hovered and render its tooltip.
 */
export function setEnemyHover(enemy) {
  if (!enemy) {
    this.clearEnemyHover();
    return;
  }
  this.hoverEnemy = { enemyId: enemy.id };
  this.renderEnemyTooltip(enemy);
}

/**
 * Return the currently focused enemy (null if none or if the enemy is dead).
 */
export function getFocusedEnemy() {
  if (!this.focusedEnemyId) {
    return null;
  }
  const enemy = this.getEnemyById(this.focusedEnemyId);
  if (!enemy || enemy.hp <= 0) {
    this.clearFocusedEnemy({ silent: true });
    return null;
  }
  return enemy;
}

/**
 * Lock tower fire onto the given enemy.
 */
export function setFocusedEnemy(enemy, options = {}) {
  if (!enemy) {
    this.clearFocusedEnemy(options);
    return;
  }
  const { silent = false } = options;
  this.focusedEnemyId = enemy.id;
  const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
  const descriptor = enemy.label ? enemy.label : symbol;
  this.focusMarkerAngle = 0;
  if (!silent && this.messageEl) {
    this.messageEl.textContent = `All towers focusing on ${descriptor}.`;
  }
}

/**
 * Release the focus lock so towers resume optimal targeting.
 */
export function clearFocusedEnemy(options = {}) {
  const { silent = false } = options;
  if (!this.focusedEnemyId) {
    this.focusMarkerAngle = 0;
    return false;
  }
  this.focusedEnemyId = null;
  this.focusMarkerAngle = 0;
  if (!silent && this.messageEl) {
    this.messageEl.textContent = 'Focus fire cleared—towers resume optimal targeting.';
  }
  return true;
}

/**
 * Toggle focus fire on the given enemy.
 */
export function toggleEnemyFocus(enemy) {
  if (!enemy) {
    this.clearFocusedEnemy();
    return;
  }
  if (this.focusedEnemyId === enemy.id) {
    this.clearFocusedEnemy();
  } else {
    this.setFocusedEnemy(enemy);
  }
}

/**
 * Programmatically focus the requested enemy so stats panel selections highlight the target.
 */
export function focusEnemyById(enemyId) {
  if (!Number.isFinite(enemyId)) {
    return false;
  }
  const enemy = this.getEnemyById(enemyId);
  if (!enemy) {
    this.clearFocusedEnemy({ silent: true });
    return false;
  }
  this.setFocusedEnemy(enemy, { silent: true });
  return true;
}

/**
 * Render the hover tooltip for the given enemy near the pointer.
 */
export function renderEnemyTooltip(enemy) {
  if (!this.enemyTooltip || !this.pointerPosition) {
    this.clearEnemyHover();
    return;
  }

  const pointerCanvas = this.getCanvasPosition(this.pointerPosition);
  const enemyPosition = this.getEnemyPosition(enemy);
  const metrics = this.getEnemyVisualMetrics(enemy);
  const distance = Math.hypot(pointerCanvas.x - enemyPosition.x, pointerCanvas.y - enemyPosition.y);
  if (distance > this.getEnemyHitRadius(enemy, metrics)) {
    this.clearEnemyHover();
    return;
  }

  const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
  const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
  const exponent = this.calculateHealthExponent(remainingHp);
  if (this.enemyTooltipNameEl) {
    // Surface the decimal exponent in the tooltip so hover details mirror the battlefield indicators.
    this.enemyTooltipNameEl.textContent = `${symbol}^${exponent.toFixed(1)} — ${
      enemy.label || 'Glyph'
    }`;
  }
  if (this.enemyTooltipHpEl) {
    const hpText = formatCombatNumber(remainingHp);
    this.enemyTooltipHpEl.textContent = `Remaining HP: 10^${exponent.toFixed(1)} (${hpText})`;
  }

  const screenPosition = this.worldToScreen(enemyPosition);
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;

  if (
    !screenPosition ||
    screenPosition.x < 0 ||
    screenPosition.y < 0 ||
    screenPosition.x > width ||
    screenPosition.y > height
  ) {
    this.enemyTooltip.dataset.visible = 'false';
    this.enemyTooltip.setAttribute('aria-hidden', 'true');
    return;
  }

  this.enemyTooltip.style.left = `${screenPosition.x}px`;
  this.enemyTooltip.style.top = `${screenPosition.y}px`;
  this.enemyTooltip.dataset.visible = 'true';
  this.enemyTooltip.setAttribute('aria-hidden', 'false');
}

/**
 * Re-render the enemy tooltip for the currently hovered enemy.
 */
export function updateEnemyTooltipPosition() {
  if (!this.hoverEnemy) {
    return;
  }

  // Gracefully skip over any cleared enemy slots so tooltip updates never crash the render loop.
  const enemy = this.getEnemyById(this.hoverEnemy.enemyId);
  if (!enemy || !this.pointerPosition) {
    this.clearEnemyHover();
    return;
  }

  this.renderEnemyTooltip(enemy);
}
