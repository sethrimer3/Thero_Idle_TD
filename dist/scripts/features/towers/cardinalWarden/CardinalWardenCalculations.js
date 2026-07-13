/**
 * CardinalWardenCalculations
 *
 * Grapheme assignment resolution, fire rate / attack speed calculation,
 * shield regeneration, and weapon timer update logic extracted from
 * CardinalWardenSimulation. Every function uses `.call(this, ...)`
 * so that `this` always refers to the simulation instance.
 */

import {
  GRAPHEME_INDEX,
  MASSIVE_BULLET_CONFIG,
  MINE_CONFIG,
  DAGESH_CONFIG,
  GAME_CONFIG,
  WEAPON_SLOT_DEFINITIONS,
} from '../cardinalWardenConfig.js';

/**
 * Apply grapheme deactivation rules (C, G, L) and return the effective slot array.
 * @param {Array} assignments - Raw grapheme assignments for a weapon
 * @returns {Array} Effective assignments after deactivation rules are applied
 */
export function getEffectiveGraphemeAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

  // Find the first occurrence of grapheme G (index 6)
  let seventhGraphemeSlot = -1;
  for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
    const assignment = assignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.G) {
      seventhGraphemeSlot = slotIndex;
      break;
    }
  }

  // If grapheme G found, deactivate everything to the LEFT
  if (seventhGraphemeSlot !== -1) {
    // Return assignments from grapheme G's slot to the end
    return assignments.slice(seventhGraphemeSlot);
  }

  // Find the first occurrence of grapheme C (index 2)
  let thirdGraphemeSlot = -1;
  for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
    const assignment = assignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.C) {
      thirdGraphemeSlot = slotIndex;
      break;
    }
  }

  // If third grapheme found, deactivate everything to the RIGHT
  if (thirdGraphemeSlot !== -1) {
    return assignments.slice(0, thirdGraphemeSlot + 1);
  }

  // Find all occurrences of grapheme L (index 11) and deactivate adjacent slots
  const graphemeLSlots = [];
  for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
    const assignment = assignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.L) {
      graphemeLSlots.push(slotIndex);
    }
  }

  // If grapheme L found, create a copy with adjacent slots nullified
  // Note: If multiple L graphemes are adjacent, the L graphemes themselves remain active
  // while their respective neighbors are nullified (e.g., L in slots 3 and 4 deactivates 2 and 5)
  if (graphemeLSlots.length > 0) {
    const effectiveAssignments = [...assignments];
    for (const lSlot of graphemeLSlots) {
      // Deactivate left neighbor (slot - 1)
      if (lSlot > 0) {
        effectiveAssignments[lSlot - 1] = null;
      }
      // Deactivate right neighbor (slot + 1)
      if (lSlot < effectiveAssignments.length - 1) {
        effectiveAssignments[lSlot + 1] = null;
      }
    }
    return effectiveAssignments;
  }

  // If no deactivation graphemes found, all assignments are active
  return assignments;
}

/**
 * Calculate fire rate multiplier from second grapheme (index 1) and grapheme K (index 10).
 * @param {Array} effectiveAssignments - The effective grapheme assignments for a weapon
 * @returns {number} Fire rate multiplier (1 = no change, 2 = 2x faster, etc.)
 */
export function calculateFireRateMultiplier(effectiveAssignments) {
  let baseMultiplier = 1;

  // Check for grapheme B (index 1) - fire rate based on slot
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === 1) {
      // Second grapheme found! Fire rate multiplier based on slot position
      // Slot 0 = 1x (no change), Slot 1 = 2x faster, Slot 2 = 3x faster, etc.
      baseMultiplier = slotIndex + 1;
      break;
    }
  }

  // Check for grapheme K (index 10) - massive bullet or speed boost
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.K) {
      if (slotIndex === 7) {
        // Slot 8 (index 7): Speed boost mode - 10x attack speed
        baseMultiplier *= MASSIVE_BULLET_CONFIG.SPEED_BOOST_MULTIPLIER;
      } else {
        // Slots 1-7 (indices 0-6): Massive bullet mode - 1/20 attack speed
        baseMultiplier /= MASSIVE_BULLET_CONFIG.ATTACK_SPEED_DIVISOR;
      }
      break;
    }
  }

  return baseMultiplier;
}

/**
 * Calculate weapon attack speed (bullets per second) for a weapon.
 * @param {Object} weaponDef - The weapon definition
 * @param {number} fireRateMultiplier - Fire rate multiplier from graphemes
 * @returns {number} Attack speed in bullets per second
 */
export function calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier) {
  const fireInterval = weaponDef.baseFireRate / fireRateMultiplier;
  return 1000 / fireInterval; // bullets per second
}

/**
 * Update shield regeneration based on fourth grapheme (index 3 - delta).
 * Formula: 1 shield recovered over (slot_number × weapon_attack_speed) seconds
 * where attack_speed is bullets per second for that weapon.
 */
export function updateShieldRegeneration(deltaTime) {
  if (!this.warden || !this.canvas) return;

  const equippedWeapons = this.weapons.equipped || [];
  const dt = deltaTime / 1000; // Convert to seconds

  for (const weaponId of equippedWeapons) {
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) continue;

    // Check if fourth grapheme (index 3) is present in effective assignments
    let fourthGraphemeSlot = -1;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === 3) {
        fourthGraphemeSlot = slotIndex;
        break;
      }
    }

    // Skip if no fourth grapheme found
    if (fourthGraphemeSlot === -1) continue;

    // Calculate weapon's attack speed (bullets per second)
    const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
    const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);

    // Calculate time needed to recover 1 shield
    // Formula: 1 / (slot_number × attack_speed) seconds per shield
    // Slot numbering starts at 1 for formula (slot 0 = 1, slot 1 = 2, etc.)
    const slotNumber = fourthGraphemeSlot + 1;

    // Guard against division by zero
    if (slotNumber <= 0 || attackSpeed <= 0) continue;

    const timePerShield = 1 / (slotNumber * attackSpeed);

    // Initialize accumulator if needed
    const key = `${weaponId}_slot${fourthGraphemeSlot}`;
    if (this.shieldRegenAccumulators[key] === undefined) {
      this.shieldRegenAccumulators[key] = 0;
    }

    // Accumulate time
    this.shieldRegenAccumulators[key] += dt;

    // Check if we've accumulated enough time to recover a shield
    while (this.shieldRegenAccumulators[key] >= timePerShield) {
      this.shieldRegenAccumulators[key] -= timePerShield;
      this.regenerateShield();
    }
  }
}

/**
 * Regenerate one shield/life for the player.
 * Reverses the life line state progression: gone → dashed → solid
 * Priority: Restore dashed to solid before gone to dashed (complete partial healing first)
 */
export function regenerateShield() {
  // First pass: Look for dashed lines to restore to solid (prioritize completing partial healing)
  for (let i = 0; i < this.lifeLines.length; i++) {
    if (this.lifeLines[i].state === 'dashed') {
      this.lifeLines[i].state = 'solid';
      return;
    }
  }

  // Second pass: If no dashed lines, restore a gone line to dashed (start new healing)
  for (let i = 0; i < this.lifeLines.length; i++) {
    if (this.lifeLines[i].state === 'gone') {
      this.lifeLines[i].state = 'dashed';
      return;
    }
  }
}

/**
 * Update weapon timers and fire bullets when ready.
 * All 8 weapon slots are always active.
 */
export function updateWeaponTimers(deltaTime) {
  if (!this.warden || !this.canvas) return;

  // All weapon slots are always active
  const equippedWeapons = this.weapons.equipped || [];

  // Decay glow state smoothly and quickly
  const glowDecayRate = 3.0; // Higher = faster decay
  for (const weaponId of equippedWeapons) {
    if (this.weaponGlowState && this.weaponGlowState[weaponId] > 0) {
      this.weaponGlowState[weaponId] = Math.max(0, this.weaponGlowState[weaponId] - (glowDecayRate * deltaTime / 1000));
    }
  }

  for (const weaponId of equippedWeapons) {
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) continue;

    // Initialize timer if needed
    if (this.weaponTimers[weaponId] === undefined) {
      this.weaponTimers[weaponId] = 0;
    }

    // Calculate fire rate multiplier from second grapheme (index 1)
    // Use effective assignments to respect third grapheme deactivation
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);

    // Apply weapon-specific speed upgrade multiplier
    const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);

    // For weapons that aren't purchased, set fire rate to 60 minutes
    // This effectively prevents them from firing while locked
    const isPurchased = this.weapons.purchased[weaponId];
    const baseFireInterval = isPurchased ? weaponDef.baseFireRate : GAME_CONFIG.LOCKED_WEAPON_FIRE_INTERVAL;

    // Apply fire rate multiplier by dividing the interval (higher multiplier = faster shooting)
    const fireInterval = baseFireInterval / (fireRateMultiplier * weaponSpeedMult);

    this.weaponTimers[weaponId] += deltaTime;

    if (this.weaponTimers[weaponId] >= fireInterval) {
      this.weaponTimers[weaponId] = 0;
      this.fireWeapon(weaponId);
    }

    // Check for grapheme M (index 12) - Mine spawning
    let hasMineGrapheme = false;
    // Track dagesh mine modifiers to boost spawn frequency and damage.
    let useDageshMine = false;
    let mineSpawnDivisor = MINE_CONFIG.SPAWN_RATE_DIVISOR;
    for (const assignment of effectiveAssignments) {
      if (assignment && assignment.index === GRAPHEME_INDEX.M) {
        hasMineGrapheme = true;
        break;
      }
      if (assignment && assignment.index === GRAPHEME_INDEX.M_DAGESH) {
        hasMineGrapheme = true;
        useDageshMine = true;
        mineSpawnDivisor = DAGESH_CONFIG.M.SPAWN_RATE_DIVISOR;
        break;
      }
    }

    if (hasMineGrapheme) {
      // Initialize mine spawn accumulator if needed
      if (this.mineSpawnAccumulators[weaponId] === undefined) {
        this.mineSpawnAccumulators[weaponId] = 0;
      }

      // Calculate mine spawn rate: (shots per second) / 20
      const shotsPerSecond = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
      const mineSpawnRate = shotsPerSecond / mineSpawnDivisor;
      const mineSpawnInterval = 1000 / mineSpawnRate; // Interval in milliseconds

      this.mineSpawnAccumulators[weaponId] += deltaTime;

      if (this.mineSpawnAccumulators[weaponId] >= mineSpawnInterval) {
        this.mineSpawnAccumulators[weaponId] = 0;
        this.spawnMine(weaponId, { useDagesh: useDageshMine });
      }
    }
  }
}
