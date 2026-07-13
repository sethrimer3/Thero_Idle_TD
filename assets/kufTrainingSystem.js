// Kuf Training System
// HUD layout, toolbar slot handling, unit training queue, and core ship initialization.
// All functions use .call(this) delegation from KufBattlefieldSimulation.

import {
  KUF_HUD_LAYOUT,
  KUF_TRAINING_CATALOG,
  KUF_EQUIPPABLE_UNIT_IDS,
  KUF_CORE_SHIP_COMBAT,
  WORKER_BASE_COST,
  WORKER_COST_INCREMENT,
} from './kufSimulationConfig.js';

/**
 * Build the HUD layout for the base core and training toolbar.
 * @returns {{ baseCenter: { x: number, y: number }, baseRadius: number, slots: Array<{ x: number, y: number, size: number }> }}
 */
export function getHudLayout() {
  const { TOOLBAR_SLOT_SIZE, TOOLBAR_SLOT_GAP, TOOLBAR_BOTTOM_PADDING, BASE_RADIUS, BASE_TO_TOOLBAR_GAP } = KUF_HUD_LAYOUT;
  const toolbarWidth = TOOLBAR_SLOT_SIZE * this.trainingSlots.length + TOOLBAR_SLOT_GAP * (this.trainingSlots.length - 1);
  const toolbarX = (this.bounds.width - toolbarWidth) / 2;
  const toolbarY = this.bounds.height - TOOLBAR_BOTTOM_PADDING - TOOLBAR_SLOT_SIZE;
  // Anchor the base core just above the toolbar so it feels docked to the player interface.
  const baseCenter = {
    x: this.bounds.width / 2,
    y: toolbarY - BASE_TO_TOOLBAR_GAP - BASE_RADIUS,
  };
  const slots = this.trainingSlots.map((slot, index) => ({
    x: toolbarX + index * (TOOLBAR_SLOT_SIZE + TOOLBAR_SLOT_GAP),
    y: toolbarY,
    size: TOOLBAR_SLOT_SIZE,
    slot,
  }));
  return { baseCenter, baseRadius: BASE_RADIUS, slots };
}

/**
 * Convert a HUD-space point into a toolbar slot index if tapped.
 * @param {number} canvasX - X coordinate within the canvas.
 * @param {number} canvasY - Y coordinate within the canvas.
 * @returns {number|null} Toolbar slot index when hit, otherwise null.
 */
export function getToolbarSlotIndex(canvasX, canvasY) {
  const { slots } = this.getHudLayout();
  const hitSlot = slots.find((slot) =>
    canvasX >= slot.x &&
    canvasX <= slot.x + slot.size &&
    canvasY >= slot.y &&
    canvasY <= slot.y + slot.size
  );
  return hitSlot ? slots.indexOf(hitSlot) : null;
}

/**
 * Resolve the current unit spec for a toolbar slot.
 * Handles dynamic worker cost calculation: cost = WORKER_BASE_COST + (workerCount * WORKER_COST_INCREMENT).
 * @param {object} slot - Toolbar slot payload.
 * @returns {{ id: string, label: string, icon: string, cost: number, duration: number }} Unit spec.
 */
export function getTrainingSpecForSlot(slot) {
  const baseSpec = KUF_TRAINING_CATALOG[slot?.unitId] || KUF_TRAINING_CATALOG.worker;
  // If this is a worker slot, calculate dynamic cost based on current worker count.
  if (baseSpec.id === 'worker') {
    const workerCost = WORKER_BASE_COST + (this.workerCount * WORKER_COST_INCREMENT);
    return { ...baseSpec, cost: workerCost };
  }
  return baseSpec;
}

/**
 * Cycle the equipped unit for a customizable toolbar slot.
 * @param {number} slotIndex - Index of the toolbar slot to update.
 */
export function cycleToolbarSlotUnit(slotIndex) {
  const slot = this.trainingSlots[slotIndex];
  if (!slot || !slot.equipable || slot.isTraining) {
    return;
  }
  const currentIndex = KUF_EQUIPPABLE_UNIT_IDS.indexOf(slot.unitId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % KUF_EQUIPPABLE_UNIT_IDS.length : 0;
  const nextUnitId = KUF_EQUIPPABLE_UNIT_IDS[nextIndex];
  slot.unitId = nextUnitId;
}

/**
 * Clear the glowing state for the toolbar slots.
 */
export function clearToolbarGlow() {
  this.glowingToolbarSlotIndex = null;
}

/**
 * Handle taps that land on the training toolbar.
 * @param {number} canvasX - X coordinate within the canvas.
 * @param {number} canvasY - Y coordinate within the canvas.
 * @returns {boolean} True when the tap was consumed by the toolbar.
 */
export function handleToolbarTap(canvasX, canvasY) {
  const slotIndex = this.getToolbarSlotIndex(canvasX, canvasY);
  if (slotIndex === null) {
    return false;
  }
  const now = performance.now();
  const isDoubleTap = this.lastToolbarTap.slotIndex === slotIndex &&
    (now - this.lastToolbarTap.time) < this.doubleTapThreshold;
  if (isDoubleTap) {
    // Clear pending single-tap actions so double-tap starts training immediately.
    if (this.toolbarTapTimer) {
      clearTimeout(this.toolbarTapTimer);
      this.toolbarTapTimer = null;
      this.pendingToolbarSlotIndex = null;
    }
    // Clear the glow state when double-tapping to start training.
    this.clearToolbarGlow();
    this.lastToolbarTap = { time: 0, slotIndex: null };
    this.tryStartTraining(slotIndex);
    return true;
  }
  // Single tap: just make the slot glow (indicate selection).
  this.lastToolbarTap = { time: now, slotIndex };
  this.glowingToolbarSlotIndex = slotIndex;
  // No need to schedule anything - the glow is just visual feedback.
  return true;
}

/**
 * Start training a unit from the toolbar if the player can afford it.
 * @param {number} slotIndex - Index of the toolbar slot to train from.
 */
export function tryStartTraining(slotIndex) {
  if (!this.active) {
    return;
  }
  const slot = this.trainingSlots[slotIndex];
  if (!slot || slot.isTraining) {
    return;
  }
  // Resolve the currently equipped unit for this slot before spending gold.
  const spec = this.getTrainingSpecForSlot(slot);
  if (this.goldEarned < spec.cost) {
    return;
  }
  // Deduct gold immediately so remaining gold is always spendable elsewhere.
  this.goldEarned = Math.max(0, this.goldEarned - spec.cost);
  slot.isTraining = true;
  slot.progress = 0;
}

/**
 * Update training timers and spawn completed units at the base.
 * @param {number} delta - Delta time in seconds.
 */
export function updateTraining(delta) {
  this.trainingSlots.forEach((slot) => {
    if (!slot.isTraining) {
      return;
    }
    // Pull the equipped unit spec so progress and spawn timing match the icon.
    const spec = this.getTrainingSpecForSlot(slot);
    slot.progress = Math.min(spec.duration, slot.progress + delta);
    if (slot.progress >= spec.duration) {
      slot.isTraining = false;
      slot.progress = 0;
      this.spawnTrainedUnit(spec.id);
    }
  });
}

/**
 * Spawn a trained unit at the base core exit.
 * Workers increase income per kill instead of spawning a combat unit.
 * @param {string} unitType - Unit archetype identifier.
 */
export function spawnTrainedUnit(unitType) {
  // Workers increase income per kill by 1 and increment worker count.
  if (unitType === 'worker') {
    this.workerCount += 1;
    this.baseIncomePerKill += 1;
    return;
  }
  // Spawn combat units normally.
  const stats = this.unitStats[unitType] || this.unitStats.marine;
  const { x, y } = this.getBaseWorldPosition();
  const jitter = 14;
  const spawnX = x + (Math.random() - 0.5) * jitter;
  const spawnY = y + (Math.random() - 0.5) * jitter;
  this.createPlayerUnit(unitType, stats, spawnX, spawnY);
}

/**
 * Calculate the base core position in world coordinates for spawning units.
 * @returns {{ x: number, y: number }} World position of the base.
 */
export function getBaseWorldPosition() {
  const { baseCenter } = this.getHudLayout();
  return {
    x: (baseCenter.x - this.bounds.width / 2) / this.camera.zoom + this.bounds.width / 2 + this.camera.x,
    y: (baseCenter.y - this.bounds.height / 2) / this.camera.zoom + this.bounds.height / 2 + this.camera.y,
  };
}

/**
 * Initialize the core ship hull integrity and cannon mounts for a new simulation.
 * @param {{ health: number, cannons: number, hullRepair: number, healingAura: number, shield: number, droneRate: number, droneHealth: number, droneDamage: number, level: number, scale: number }} coreShipStats - Derived core ship stats.
 */
export function initializeCoreShip(coreShipStats) {
  const { baseRadius } = this.getHudLayout();
  const basePosition = this.getBaseWorldPosition();
  // Anchor the core ship to the HUD base so it stays docked to the toolbar.
  this.coreShip = {
    x: basePosition.x,
    y: basePosition.y,
    radius: baseRadius * KUF_CORE_SHIP_COMBAT.CORE_COLLISION_SCALE * (coreShipStats.scale || 1.0),
    health: Math.max(1, coreShipStats.health),
    maxHealth: Math.max(1, coreShipStats.health),
    cannons: Math.max(0, Math.floor(coreShipStats.cannons || 0)),
    cannonCooldown: 0,
    // Hull repair regeneration (HP per second)
    hullRepair: coreShipStats.hullRepair || 0,
    hullRepairCooldown: 0,
    // Healing aura
    healingAura: coreShipStats.healingAura || 0,
    healingAuraRadius: 150, // Radius for healing aura
    healingAuraCooldown: 0,
    // Shield system
    maxShield: coreShipStats.shield > 0 ? coreShipStats.shield * 50 : 0, // 50 HP per upgrade
    shield: 0, // Starts at 0, needs to regenerate
    shieldRegenRate: coreShipStats.shield > 0 ? 5 + coreShipStats.shield * 2 : 0, // 5 + 2 per upgrade
    shieldRegenDelay: 3, // Delay after taking damage
    shieldRegenTimer: 0,
    shieldBroken: false,
    // Drone spawning
    droneSpawnRate: coreShipStats.droneRate > 0 ? Math.max(0.5, 5 - coreShipStats.droneRate * 0.5) : 0, // Spawn every N seconds
    droneSpawnTimer: 0,
    droneHealth: 10 + coreShipStats.droneHealth * 5, // 10 base + 5 per upgrade
    droneDamage: 1 + coreShipStats.droneDamage * 0.5, // 1 base + 0.5 per upgrade
    // Level and visual scale
    level: coreShipStats.level || 1,
    scale: coreShipStats.scale || 1.0,
  };
  // Track spawned drones separately
  this.drones = [];
}
