// Cardinal Warden Weapon System
// Weapon firing, mine spawning, and ship management methods extracted from CardinalWardenSimulation (Build 522).
// Functions are called with .call(sim) so 'this' refers to the simulation instance.

import {
  FriendlyShip,
  MathBullet,
} from './CardinalWardenEntities.js';
import {
  GRAPHEME_INDEX,
  SPREAD_CONFIG,
  MASSIVE_BULLET_CONFIG,
  BEAM_CONFIG,
  MINE_CONFIG,
  SWARM_CONFIG,
  RICOCHET_CONFIG,
  HOMING_CONFIG,
  SPLIT_CONFIG,
  CHAIN_CONFIG,
  SIZE_CONFIG,
  DAGESH_CONFIG,
  ORBITAL_CONFIG,
  PULSE_CONFIG,
  SPEED_CONFIG,
  EXPLOSIVE_CONFIG,
  LIFETIME_CONFIG,
  VORTEX_CONFIG,
  CHAOS_CONFIG,
  WEAPON_SLOT_DEFINITIONS,
  WEAPON_SLOT_IDS,
} from '../cardinalWardenConfig.js';
import { Beam } from './BeamSystem.js';
import { Mine } from './MineSystem.js';
import {
  SwarmShip,
  SwarmLaser,
  checkSwarmLaserCollisions as checkSwarmLaserCollisionsSystem,
} from './SwarmSystem.js';

/**
 * Fire a simple bullet from a specific weapon slot toward the aim target.
 * Applies ThoughtSpeak grapheme mechanics if the first grapheme (index 0) is present.
 */
export function fireWeapon(weaponId) {
  if (!this.warden || !this.canvas) return;
  
  // Safety check: Don't fire if weapon is not purchased
  if (!this.weapons.purchased[weaponId]) {
    return;
  }
  
  const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
  if (!weaponDef) return;
  
  const cx = this.warden.x;
  const cy = this.warden.y;
  const level = this.weapons.levels[weaponId] || 1;
  
  // Set glow state to full when firing (will decay in update loop)
  if (this.weaponGlowState) {
    this.weaponGlowState[weaponId] = 1.0;
  }
  
  // Calculate stats based on level (for future lexeme upgrades)
  let damageMultiplier = 1 + (level - 1) * 0.25;
  const speedMultiplier = 1 + (level - 1) * 0.1;
  
  // Calculate excess grapheme bonus
  // For each equipped grapheme, add bonus damage equal to inventory count
  // Example: If player has 15 of grapheme "A" and A is equipped, add +15 to base damage
  const assignments = this.weaponGraphemeAssignments[weaponId] || [];
  let excessGraphemeBonus = 0;
  for (const assignment of assignments) {
    if (assignment && assignment.index !== undefined) {
      const inventoryCount = this.graphemeInventoryCounts[assignment.index] || 0;
      // Each excess grapheme adds +1 to damage bonus
      excessGraphemeBonus += inventoryCount;
    }
  }
  
  // ThoughtSpeak mechanics: Check for first grapheme (index 0) in any slot
  // Shape and damage multiplier based on slot position
  // Use effective assignments to respect third grapheme deactivation
  let bulletShape = null; // null = circle (default), otherwise number of sides
  const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
  
  // Check for fifth grapheme (index 4 - Epsilon) - Lightning movement behavior
  let epsilonBehavior = null;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === 4) {
      // Fifth grapheme found! Behavior based on slot position
      // Slots 0-2: straight bullets
      // Slots 3-4: zigzag with holds
      // Slots 5-7: spiral outward
      if (slotIndex <= 2) {
        epsilonBehavior = 'straight';
      } else if (slotIndex <= 4) {
        epsilonBehavior = 'zigzag';
      } else {
        epsilonBehavior = 'spiral';
      }
      break; // Only apply the first occurrence
    }
  }
  
  // Check for sixth grapheme (index 5 - Zeta) - Pierce and trail passthrough
  let piercingCount = 0;
  let bounceOnTrails = true; // Default: bullets bounce off trails
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === 5) {
      // Sixth grapheme found! Pierce based on slot position
      // Slot 0 = +1 pierce, slot 1 = +2 pierce, slot 2 = +3 pierce, etc.
      piercingCount = slotIndex + 1;
      // When this grapheme is equipped, bullets pass through enemy trails without bouncing
      bounceOnTrails = false;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme G (index 6) - Slow splash damage wave
  let waveRadius = 0;
  let hasWaveEffect = false;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.G) {
      // Grapheme G found! Wave radius based on slot position
      // Base radius = 1/10th canvas width, multiplied by slot position (1-indexed)
      // Slot 0 = 1x, slot 1 = 2x, slot 2 = 3x, etc.
      const slotMultiplier = slotIndex + 1;
      const baseRadius = this.canvas ? this.canvas.width / 10 : 50;
      waveRadius = baseRadius * slotMultiplier;
      hasWaveEffect = true;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme H (index 7) - Weapon targeting
  let targetedEnemy = null;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.H) {
      // Grapheme H found! Targeting based on slot position
      // Slots 0-3: Target lowest enemy (closest to bottom of render)
      // Slots 4-7: Target lowest boss-class enemy
      if (slotIndex <= 3) {
        // Target lowest enemy (highest y coordinate)
        let lowestEnemy = null;
        let lowestY = -Infinity;
        for (const enemy of this.enemies) {
          if (enemy.y > lowestY) {
            lowestY = enemy.y;
            lowestEnemy = enemy;
          }
        }
        targetedEnemy = lowestEnemy;
      } else {
        // Target lowest boss (highest y coordinate)
        let lowestBoss = null;
        let lowestY = -Infinity;
        for (const boss of this.bosses) {
          if (boss.y > lowestY) {
            lowestY = boss.y;
            lowestBoss = boss;
          }
        }
        targetedEnemy = lowestBoss;
      }
      // Store the targeted enemy for this weapon
      this.weaponTargets[weaponId] = targetedEnemy;
      break; // Only apply the first occurrence
    }
  }
  
  // Clear target if no eighth grapheme is present
  if (targetedEnemy === null) {
    this.weaponTargets[weaponId] = null;
  }
  
  // Check for ninth grapheme (index 8 - I) - Spread bullets
  let spreadBulletCount = 0;
  let spreadAngle = SPREAD_CONFIG.SPREAD_ANGLE;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.I_DAGESH) {
      // Dagesh I found! Extra bullets and wider cone based on slot position.
      if (slotIndex >= 0 && slotIndex < DAGESH_CONFIG.I.SLOT_TO_EXTRA_BULLETS.length) {
        spreadBulletCount = DAGESH_CONFIG.I.SLOT_TO_EXTRA_BULLETS[slotIndex];
      }
      spreadAngle = DAGESH_CONFIG.I.SPREAD_ANGLE;
      break; // Only apply the first occurrence
    }
    if (assignment && assignment.index === GRAPHEME_INDEX.I) {
      // Ninth grapheme found! Extra bullets based on slot position
      // Use lookup table for slot-to-bullet mapping
      if (slotIndex >= 0 && slotIndex < SPREAD_CONFIG.SLOT_TO_EXTRA_BULLETS.length) {
        spreadBulletCount = SPREAD_CONFIG.SLOT_TO_EXTRA_BULLETS[slotIndex];
      }
      break; // Only apply the first occurrence
    }
  }
  
  // Check for tenth grapheme (index 9 - J) - Elemental effects (burning/freezing)
  let elementalEffect = null; // 'burning' or 'freezing'
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.J) {
      // Tenth grapheme found! Effect based on slot position
      // Slots 0-3: Burning effect (5% max health damage per second)
      // Slots 4-7: Freeze effect (0.5 second freeze, ice blue color)
      if (slotIndex <= 3) {
        elementalEffect = 'burning';
      } else {
        elementalEffect = 'freezing';
      }
      break; // Only apply the first occurrence
    }
  }
  
  // Check for eleventh grapheme (index 10 - K) - Massive bullet or speed boost
  let massiveBulletMode = false;
  let massiveBulletSlot = -1;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.K) {
      // Eleventh grapheme found! Mode based on slot position
      // Slots 0-6 (indices 0-6): Massive bullet mode
      // Slot 8 (index 7): Speed boost only (already handled in fire rate calculation)
      if (slotIndex !== 7) {
        massiveBulletMode = true;
        massiveBulletSlot = slotIndex;
      }
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme L (index 11) - Continuous beam
  let beamMode = false;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.L) {
      // Grapheme L found! Beam mode activated
      beamMode = true;
      break; // Only apply the first occurrence
    }
  }
  
  // Note: Grapheme M (mines) spawning is handled separately in updateWeaponTimers()
  // Mines are spawned alongside bullets, not instead of them
  
  // Check for grapheme O (index 14) - Ricochet bullets
  let ricochetBounces = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.O) {
      // Ricochet found! Bounces based on slot position (1-8 bounces)
      ricochetBounces = RICOCHET_CONFIG.SLOT_TO_BOUNCES[slotIndex] || (slotIndex + 1);
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme P (index 15) - Homing missiles
  let homingTurnRate = 0;
  let homingDetectionRadius = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.P_DAGESH) {
      // Dagesh homing found! Stronger turn rate and longer detection radius.
      const turnMultiplier = HOMING_CONFIG.SLOT_TO_TURN_MULTIPLIER[slotIndex] || 1;
      homingTurnRate = HOMING_CONFIG.BASE_TURN_RATE * turnMultiplier * DAGESH_CONFIG.P.TURN_RATE_MULTIPLIER;
      homingDetectionRadius = DAGESH_CONFIG.P.DETECTION_RADIUS;
      break; // Only apply the first occurrence
    }
    if (assignment && assignment.index === GRAPHEME_INDEX.P) {
      // Homing found! Turn rate based on slot position
      const turnMultiplier = HOMING_CONFIG.SLOT_TO_TURN_MULTIPLIER[slotIndex] || 1;
      homingTurnRate = HOMING_CONFIG.BASE_TURN_RATE * turnMultiplier;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme Q (index 16) - Split bullets
  let splitCount = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.Q) {
      // Split found! Split count based on slot position (2-9 splits)
      splitCount = SPLIT_CONFIG.SLOT_TO_SPLIT_COUNT[slotIndex] || (slotIndex + 2);
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme R (index 17) - Chain lightning
  let chainCount = 0;
  let chainRange = 0;
  let chainDamageMultiplier = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.R_DAGESH) {
      // Dagesh chain found! Adds extra jumps and stronger retention.
      const baseChainCount = CHAIN_CONFIG.SLOT_TO_CHAINS[slotIndex] || (slotIndex + 1);
      const baseRange = CHAIN_CONFIG.SLOT_TO_RANGE[slotIndex] || 20;
      chainCount = baseChainCount + DAGESH_CONFIG.R.CHAIN_BONUS;
      chainRange = baseRange * DAGESH_CONFIG.R.RANGE_MULTIPLIER;
      chainDamageMultiplier = DAGESH_CONFIG.R.DAMAGE_MULTIPLIER;
      break; // Only apply the first occurrence
    }
    if (assignment && assignment.index === GRAPHEME_INDEX.R) {
      // Chain found! Chains based on slot position
      chainCount = CHAIN_CONFIG.SLOT_TO_CHAINS[slotIndex] || (slotIndex + 1);
      chainRange = CHAIN_CONFIG.SLOT_TO_RANGE[slotIndex] || 20;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme S (index 18) - Bullet size
  let sizeMultiplier = 1;
  let sizeSpeedMult = 1;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.S_DAGESH) {
      // Dagesh size modifier found! Applies stronger size and speed shifts.
      sizeMultiplier = DAGESH_CONFIG.S.SLOT_TO_SIZE_MULT[slotIndex] || 1;
      sizeSpeedMult = DAGESH_CONFIG.S.SLOT_TO_SPEED_MULT[slotIndex] || 1;
      break; // Only apply the first occurrence
    }
    if (assignment && assignment.index === GRAPHEME_INDEX.S) {
      // Size modifier found!
      sizeMultiplier = SIZE_CONFIG.SLOT_TO_SIZE_MULT[slotIndex] || 1;
      sizeSpeedMult = SIZE_CONFIG.SLOT_TO_SPEED_MULT[slotIndex] || 1;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme T (index 19) - Orbital bullets
  let orbitalCount = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.T) {
      // Orbital found! Orbit count based on slot position
      orbitalCount = ORBITAL_CONFIG.SLOT_TO_ORBITS[slotIndex] || (slotIndex + 1);
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme U (index 20) - Pulse waves
  let pulseRate = 0;
  let pulseRadius = 0;
  let pulseDamageMultiplier = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.U_DAGESH) {
      // Dagesh pulse found! Faster, larger, and harder-hitting pulses.
      pulseRate = (PULSE_CONFIG.SLOT_TO_PULSE_RATE[slotIndex] || (slotIndex + 1)) * DAGESH_CONFIG.U.PULSE_RATE_MULTIPLIER;
      pulseRadius = (PULSE_CONFIG.SLOT_TO_PULSE_RADIUS[slotIndex] || 15) * DAGESH_CONFIG.U.PULSE_RADIUS_MULTIPLIER;
      pulseDamageMultiplier = DAGESH_CONFIG.U.PULSE_DAMAGE_MULTIPLIER;
      break; // Only apply the first occurrence
    }
    if (assignment && assignment.index === GRAPHEME_INDEX.U) {
      // Pulse found! Rate and radius based on slot position
      pulseRate = PULSE_CONFIG.SLOT_TO_PULSE_RATE[slotIndex] || (slotIndex + 1);
      pulseRadius = PULSE_CONFIG.SLOT_TO_PULSE_RADIUS[slotIndex] || 15;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme V (index 21) - Bullet speed
  let bulletSpeedMult = 1;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.V) {
      // Speed modifier found!
      bulletSpeedMult = SPEED_CONFIG.SLOT_TO_SPEED_MULT[slotIndex] || 1;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme W (index 22) - Explosive bullets
  let explosionRadius = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.W) {
      // Explosive found! Radius based on slot position
      explosionRadius = EXPLOSIVE_CONFIG.SLOT_TO_RADIUS[slotIndex] || 20;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme X (index 23) - Bullet lifetime
  let lifetimeMultiplier = 1;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.X) {
      // Lifetime modifier found!
      lifetimeMultiplier = LIFETIME_CONFIG.SLOT_TO_LIFETIME_MULT[slotIndex] || 1;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme Y (index 24) - Vortex bullets
  let vortexRadius = 0;
  let vortexStrength = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.Y) {
      // Vortex found! Radius and strength based on slot position
      vortexRadius = VORTEX_CONFIG.SLOT_TO_PULL_RADIUS[slotIndex] || 10;
      vortexStrength = VORTEX_CONFIG.SLOT_TO_PULL_STRENGTH[slotIndex] || 20;
      break; // Only apply the first occurrence
    }
  }
  
  // Check for grapheme Z (index 25) - Chaos (random effects)
  let chaosEffectCount = 0;
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && assignment.index === GRAPHEME_INDEX.Z) {
      // Chaos found! Number of random effects based on slot position
      chaosEffectCount = CHAOS_CONFIG.SLOT_TO_EFFECT_COUNT[slotIndex] || 2;
      break; // Only apply the first occurrence
    }
  }
  
  for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
    const assignment = effectiveAssignments[slotIndex];
    if (assignment && (assignment.index === GRAPHEME_INDEX.A || assignment.index === GRAPHEME_INDEX.A_DAGESH)) {
      // ThoughtSpeak grapheme found! Apply slot-based mechanics (dagesh adds extra sides + damage).
      // Slot 0 = triangle (3 sides), 3x damage
      // Slot 1 = pentagon (5 sides), 5x damage  
      // Slot 2 = hexagon (6 sides), 6x damage
      // Slot 3+ = continues pattern (7, 8, 9, 10, 11 sides, etc.)
      const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
      let sides = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
      if (assignment.index === GRAPHEME_INDEX.A_DAGESH) {
        // Dagesh A gains additional sides and a damage multiplier.
        sides += DAGESH_CONFIG.A.SHAPE_BONUS;
        damageMultiplier *= sides * DAGESH_CONFIG.A.DAMAGE_MULTIPLIER;
      } else {
        damageMultiplier *= sides; // 3x, 5x, 6x, 7x, 8x, 9x, 10x, 11x, etc.
      }
      bulletShape = sides;
      break; // Only apply the first occurrence
    }
  }

  const resolvedColor = this.resolveBulletColor(weaponDef.color);
  
  // Apply weapon-specific upgrades
  const weaponAttackMult = this.getWeaponAttackMultiplier(weaponId);
  const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);

  const bulletConfig = {
    speed: weaponDef.baseSpeed * speedMultiplier * weaponSpeedMult * bulletSpeedMult * sizeSpeedMult * this.upgrades.bulletSpeed,
    damage: (weaponDef.baseDamage + excessGraphemeBonus) * damageMultiplier * weaponAttackMult * this.upgrades.bulletDamage,
    size: 4 * sizeMultiplier,
    baseColor: weaponDef.color,
    color: resolvedColor,
    pattern: 'straight', // Simple straight pattern
    amplitude: 0, // No wave motion
    frequency: 0,
    level: bulletShape !== null ? bulletShape : level, // Use shape as level for rendering
    maxTrailLength: this.getBulletTrailMaxLength(),
    thoughtSpeakShape: bulletShape, // Custom property for ThoughtSpeak shapes
    epsilonBehavior: epsilonBehavior, // Fifth grapheme behavior
    piercing: piercingCount > 0, // Sixth grapheme - enable piercing
    piercingLimit: piercingCount, // Sixth grapheme - max pierce count based on slot (0 = unlimited)
    bounceOnTrails: bounceOnTrails, // Sixth grapheme - disable trail bouncing when present
    hasWaveEffect: hasWaveEffect, // Seventh grapheme - spawn expanding wave on hit
    waveRadius: waveRadius, // Seventh grapheme - max radius of expanding wave
    elementalEffect: elementalEffect, // Tenth grapheme - burning or freezing effect
    // New grapheme O-Z effects
    ricochetBounces: ricochetBounces, // Grapheme O - number of bounces
    homingTurnRate: homingTurnRate, // Grapheme P - homing turn rate
    homingDetectionRadius: homingDetectionRadius, // Grapheme P - homing detection radius
    splitCount: splitCount, // Grapheme Q - number of splits
    chainCount: chainCount, // Grapheme R - chain lightning count
    chainRange: chainRange, // Grapheme R - chain range
    chainDamageMultiplier: chainDamageMultiplier, // Grapheme R - chain damage retention
    orbitalCount: orbitalCount, // Grapheme T - number of orbits
    pulseRate: pulseRate, // Grapheme U - pulses per second
    pulseRadius: pulseRadius, // Grapheme U - pulse radius
    pulseDamageMultiplier: pulseDamageMultiplier, // Grapheme U - pulse damage retention
    explosionRadius: explosionRadius, // Grapheme W - explosion radius
    lifetimeMultiplier: lifetimeMultiplier, // Grapheme X - lifetime multiplier
    vortexRadius: vortexRadius, // Grapheme Y - vortex pull radius
    vortexStrength: vortexStrength, // Grapheme Y - vortex pull strength
    chaosEffectCount: chaosEffectCount, // Grapheme Z - number of random effects
  };
  
  // Apply massive bullet modifications if grapheme K is in slots 0-6
  if (massiveBulletMode) {
    bulletConfig.damage *= MASSIVE_BULLET_CONFIG.DAMAGE_MULTIPLIER;
    bulletConfig.size *= MASSIVE_BULLET_CONFIG.SIZE_MULTIPLIER;
    bulletConfig.speed /= MASSIVE_BULLET_CONFIG.SPEED_DIVISOR;
    bulletConfig.piercing = true;
    bulletConfig.piercingLimit = 0; // Unlimited pierce
    // The bullet will apply all effects it touches (elemental effects already configured)
    // hasWaveEffect and elementalEffect are preserved from other graphemes
  }

  // Calculate angle toward target
  // Priority: grapheme H target > aim target > straight up
  let baseAngle = -Math.PI / 2; // Default: straight up
  
  // If grapheme H is active and has a valid target, aim at that target
  if (targetedEnemy && targetedEnemy.x !== undefined && targetedEnemy.y !== undefined) {
    const dx = targetedEnemy.x - cx;
    const dy = targetedEnemy.y - (cy - 20); // Account for bullet spawn offset
    baseAngle = Math.atan2(dy, dx);
  } else if (this.aimTarget) {
    // Otherwise use player's aim target
    const dx = this.aimTarget.x - cx;
    const dy = this.aimTarget.y - (cy - 20); // Account for bullet spawn offset
    baseAngle = Math.atan2(dy, dx);
  }
  
  // If beam mode is active, create/update beam instead of spawning bullets
  if (beamMode) {
    // Calculate weapon attack speed for beam damage
    const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
    const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
    
    // Beam damage = tower damage × shots per second
    const beamDamagePerSecond = bulletConfig.damage * attackSpeed;
    
    // Remove existing beam for this weapon (if any)
    this.beams = this.beams.filter(b => b.weaponId !== weaponId);
    
    // Create new beam
    const beam = new Beam(cx, cy - 20, baseAngle, {
      damage: beamDamagePerSecond / BEAM_CONFIG.DAMAGE_TICKS_PER_SECOND,
      damagePerSecond: beamDamagePerSecond,
      color: resolvedColor,
      weaponId: weaponId,
    });
    
    this.beams.push(beam);
    return; // Exit early - no bullets spawned
  }
  
  // Spawn bullets based on spread count (disabled in massive bullet mode)
  if (spreadBulletCount > 0 && !massiveBulletMode) {
    // Spawn multiple bullets in a spread pattern
    // Total bullets = 1 (center) + spreadBulletCount (extras)
    const totalBullets = 1 + spreadBulletCount;
    
    // Calculate spread angle (in radians)
    // Spread out evenly across a cone
    const totalSpreadAngle = spreadAngle;
    const angleStep = totalSpreadAngle / (totalBullets - 1);
    const startAngle = baseAngle - (totalSpreadAngle / 2);
    
    for (let i = 0; i < totalBullets; i++) {
      const bulletAngle = startAngle + (i * angleStep);
      this.bullets.push(new MathBullet(cx, cy - 20, bulletAngle, {
        ...bulletConfig,
        phase: 0,
      }));
    }
  } else {
    // Spawn a single bullet toward the target (or massive bullet in grapheme K mode)
    this.bullets.push(new MathBullet(cx, cy - 20, baseAngle, {
      ...bulletConfig,
      phase: 0,
    }));
  }
}

/**
 * Spawn a mine from a specific weapon slot.
 * Mines drift slowly and explode on contact with enemies.
 */
export function spawnMine(weaponId, { useDagesh = false } = {}) {
  if (!this.warden || !this.canvas) return;
  
  const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
  if (!weaponDef) return;
  
  const cx = this.warden.x;
  const cy = this.warden.y;
  
  // Calculate explosion damage (dagesh mines multiply the base explosion).
  const baseDamage = weaponDef.baseDamage * this.upgrades.bulletDamage;
  const mineDamageMultiplier = useDagesh
    ? MINE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER * DAGESH_CONFIG.M.DAMAGE_MULTIPLIER
    : MINE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER;
  const explosionDamage = baseDamage * mineDamageMultiplier;
  
  // Calculate explosion radius (1/10th canvas width)
  const explosionRadius = this.canvas.width / MINE_CONFIG.EXPLOSION_DIAMETER_DIVISOR;
  
  // Get weapon color
  const color = this.resolveBulletColor(weaponDef.color);
  
  // Create mine at warden position
  const mine = new Mine(cx, cy, {
    size: MINE_CONFIG.MINE_SIZE,
    color: color,
    baseDamage: explosionDamage,
    explosionRadius: explosionRadius,
    weaponId: weaponId,
  });
  
  this.mines.push(mine);
}

/**
 * Update friendly ships based on third grapheme (index 2 - gamma) assignments.
 * Spawns ships up to the max count determined by fire rate.
 */
export function updateFriendlyShips(deltaTime) {
  if (!this.warden || !this.canvas) return;
  
  // Count how many weapons have third grapheme (index 2) and calculate total fire rate
  let totalFireRate = 0; // bullets per second
  let hasThirdGrapheme = false;
  let weaponDamage = 1; // Track weapon damage for friendly ships
  
  for (const weaponId of this.weapons.equipped) {
    // Only process grapheme effects for purchased weapons
    if (!this.weapons.purchased[weaponId]) continue;
    
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    
    for (const assignment of effectiveAssignments) {
      if (assignment && assignment.index === 2) {
        hasThirdGrapheme = true;
        
        // Calculate fire rate multiplier and bullets per second for this weapon
        const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
        const bulletsPerSecond = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
        totalFireRate += bulletsPerSecond;
        
        // Get weapon damage (using same calculation as fireWeapon)
        const level = this.weapons.levels[weaponId] || 1;
        let damageMultiplier = 1 + (level - 1) * 0.25;
        
        // Check for first grapheme damage multiplier
        for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
          const a = effectiveAssignments[slotIndex];
          if (a && a.index === 0) {
            const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
            const bulletShape = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
            damageMultiplier *= bulletShape;
            break;
          }
        }
        
        weaponDamage = Math.max(weaponDamage, weaponDef.baseDamage * damageMultiplier * this.upgrades.bulletDamage);
        break; // Only count once per weapon
      }
    }
  }
  
  if (!hasThirdGrapheme || totalFireRate <= 0) {
    // No third grapheme or no fire rate - clear all friendly ships
    this.friendlyShips = [];
    return;
  }
  
  // Calculate max ships: 5 / bullets per second, rounded to nearest whole number
  const maxShips = Math.max(1, Math.round(5 / totalFireRate));
  
  // Spawn ships if we have less than max
  while (this.friendlyShips.length < maxShips) {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = 60;
    const x = this.warden.x + Math.cos(angle) * radius;
    const y = this.warden.y + Math.sin(angle) * radius;
    
    // Assign weapon color based on current ship count to distribute colors across weapons
    const weaponIds = WEAPON_SLOT_IDS;
    const weaponId = weaponIds[this.friendlyShips.length % weaponIds.length];
    const color = WEAPON_SLOT_DEFINITIONS[weaponId].color;
    
    this.friendlyShips.push(new FriendlyShip(x, y, this.warden.x, this.warden.y, weaponDamage, color, this.rng));
  }
  
  // Remove excess ships if max decreased
  while (this.friendlyShips.length > maxShips) {
    this.friendlyShips.pop();
  }
  
  // Update all friendly ships
  for (let i = this.friendlyShips.length - 1; i >= 0; i--) {
    const ship = this.friendlyShips[i];
    ship.update(deltaTime, this.warden, this.enemies, this.canvas.height);
  }
}

/**
 * Check collisions between friendly ships and enemies.
 */
export function checkFriendlyShipCollisions() {
  const enemiesToRemove = new Set();
  const bossesToRemove = new Set();
  const shipsToRemove = new Set();
  const killedEnemyPositions = [];
  
  for (let si = 0; si < this.friendlyShips.length; si++) {
    const ship = this.friendlyShips[si];
    if (shipsToRemove.has(si)) continue;
    
    for (let ei = 0; ei < this.enemies.length; ei++) {
      const enemy = this.enemies[ei];
      if (enemiesToRemove.has(ei)) continue;
      
      if (ship.checkCollision(enemy)) {
        // Spawn damage number
        this.spawnDamageNumber(enemy.x, enemy.y, ship.damage);
        
        const killed = enemy.takeDamage(ship.damage);
        
        if (killed) {
          enemiesToRemove.add(ei);
          this.addScore(enemy.scoreValue);
          this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
          killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
        }
        
        // Friendly ships are destroyed on impact
        shipsToRemove.add(si);
        break;
      }
    }
  }
  
  // Also check collisions with bosses
  for (let si = 0; si < this.friendlyShips.length; si++) {
    const ship = this.friendlyShips[si];
    if (shipsToRemove.has(si)) continue;
    
    for (let bi = 0; bi < this.bosses.length; bi++) {
      const boss = this.bosses[bi];
      if (bossesToRemove.has(bi)) continue;
      
      if (ship.checkCollision(boss)) {
        // Spawn damage number
        this.spawnDamageNumber(boss.x, boss.y, ship.damage);
        
        const killed = boss.takeDamage(ship.damage);
        
        if (killed) {
          bossesToRemove.add(bi);
          this.addScore(boss.scoreValue);
          this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
          killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
        }
        
        // Friendly ships are destroyed on impact
        shipsToRemove.add(si);
        break;
      }
    }
  }
  
  // Remove destroyed enemies
  const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
  for (const i of enemyIndices) {
    this.enemies.splice(i, 1);
  }
  
  // Remove destroyed bosses
  const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
  for (const i of bossIndices) {
    this.bosses.splice(i, 1);
  }
  
  // Remove destroyed friendly ships
  const shipIndices = Array.from(shipsToRemove).sort((a, b) => b - a);
  for (const i of shipIndices) {
    this.friendlyShips.splice(i, 1);
  }
  
  // Notify about enemy kills for grapheme drops
  if (this.onEnemyKill && killedEnemyPositions.length > 0) {
    for (const killPos of killedEnemyPositions) {
      this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
    }
  }
}

/**
 * Update swarm ships from grapheme N (index 13).
 * Number of ships = (total graphemes) / 10, max 100.
 */
export function updateSwarmShips(deltaTime) {
  if (!this.warden || !this.canvas) return;
  
  // Check if any weapon has grapheme N (index 13)
  let hasSwarmGrapheme = false;
  let weaponDamage = 1;
  let weaponFireRate = 500; // Default fire rate in milliseconds
  
  for (const weaponId of this.weapons.equipped) {
    // Only process grapheme effects for purchased weapons
    if (!this.weapons.purchased[weaponId]) continue;
    
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    
    for (const assignment of effectiveAssignments) {
      if (assignment && assignment.index === GRAPHEME_INDEX.N) {
        hasSwarmGrapheme = true;
        
        // Calculate weapon stats
        const level = this.weapons.levels[weaponId] || 1;
        let damageMultiplier = 1 + (level - 1) * 0.25;
        
        // Check for first grapheme damage multiplier
        for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
          const a = effectiveAssignments[slotIndex];
          if (a && a.index === 0) {
            const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
            const bulletShape = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
            damageMultiplier *= bulletShape;
            break;
          }
        }
        
        weaponDamage = Math.max(weaponDamage, weaponDef.baseDamage * damageMultiplier * this.upgrades.bulletDamage);
        
        // Calculate fire rate
        const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
        const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
        weaponFireRate = Math.min(weaponFireRate, 1000 / attackSpeed); // Convert to milliseconds
        
        break; // Only use the first weapon with grapheme N
      }
    }
    
    if (hasSwarmGrapheme) break;
  }
  
  if (!hasSwarmGrapheme) {
    // No swarm grapheme - clear all swarm ships and lasers
    this.swarmShips = [];
    this.swarmLasers = [];
    return;
  }
  
  // Calculate number of swarm ships based on total grapheme count
  let totalGraphemes = 0;
  for (const count of Object.values(this.graphemeInventoryCounts)) {
    totalGraphemes += count;
  }
  
  const maxShips = Math.min(
    Math.floor(totalGraphemes / SWARM_CONFIG.GRAPHEME_COUNT_DIVISOR),
    SWARM_CONFIG.MAX_SWARM_SHIPS
  );
  
  // Default target position (aim target or screen center)
  const targetX = this.aimTarget ? this.aimTarget.x : this.canvas.width / 2;
  const targetY = this.aimTarget ? this.aimTarget.y : this.canvas.height / 4;
  
  // Spawn ships if we have less than max
  while (this.swarmShips.length < maxShips) {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = this.rng.range(0, SWARM_CONFIG.SWARM_RADIUS);
    const x = targetX + Math.cos(angle) * radius;
    const y = targetY + Math.sin(angle) * radius;
    
    // Swarm ships fire at 1/10th weapon attack speed with 1/10th damage
    const swarmDamage = weaponDamage / SWARM_CONFIG.DAMAGE_DIVISOR;
    const swarmFireRate = weaponFireRate * SWARM_CONFIG.FIRE_RATE_DIVISOR;
    
    this.swarmShips.push(new SwarmShip(x, y, targetX, targetY, swarmDamage, swarmFireRate, this.rng));
  }
  
  // Remove excess ships if max decreased
  while (this.swarmShips.length > maxShips) {
    this.swarmShips.pop();
  }
  
  // Update all swarm ships
  for (const ship of this.swarmShips) {
    ship.update(deltaTime, targetX, targetY);
    
    // Check if ship can fire
    if (ship.canFire() && (this.enemies.length > 0 || this.bosses.length > 0)) {
      // Find closest enemy to the aim target
      let closestEnemy = null;
      let closestDist = Infinity;
      
      for (const enemy of this.enemies) {
        const dx = enemy.x - targetX;
        const dy = enemy.y - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      }
      
      for (const boss of this.bosses) {
        const dx = boss.x - targetX;
        const dy = boss.y - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = boss;
        }
      }
      
      // Fire laser at closest enemy
      if (closestEnemy) {
        const laser = new SwarmLaser(ship.x, ship.y, closestEnemy.x, closestEnemy.y, ship.damage, SWARM_CONFIG.LASER_COLOR);
        this.swarmLasers.push(laser);
        ship.resetFireTimer();
      }
    }
  }
  
  // Update swarm lasers
  for (let i = this.swarmLasers.length - 1; i >= 0; i--) {
    const laser = this.swarmLasers[i];
    laser.update(deltaTime);
    
    // Remove if offscreen
    if (laser.isOffscreen(this.canvas.width, this.canvas.height)) {
      this.swarmLasers.splice(i, 1);
    }
  }
  
  // Check laser collisions with enemies
  this.checkSwarmLaserCollisions();
}

/**
 * Check collisions between swarm lasers and enemies.
 * Delegates to extracted SwarmSystem (Build 475).
 */
export function checkSwarmLaserCollisions() {
  const { killedEnemyIndices, killedBossIndices, hitLaserIndices } = checkSwarmLaserCollisionsSystem(
    this.swarmLasers,
    this.enemies,
    this.bosses,
    (target, damage, x, y) => {
      // onDamage callback
      this.spawnDamageNumber(x, y, damage);
    },
    (target, x, y, scoreValue, isBoss) => {
      // onKill callback
      this.addScore(scoreValue);
      this.spawnScorePopup(x, y, scoreValue);
      if (this.onEnemyKill) {
        this.onEnemyKill(x, y, isBoss);
      }
    }
  );

  // Remove killed enemies
  for (const i of killedEnemyIndices) {
    this.enemies.splice(i, 1);
  }

  // Remove killed bosses
  for (const i of killedBossIndices) {
    this.bosses.splice(i, 1);
  }

  // Remove hit lasers
  for (const i of hitLaserIndices) {
    this.swarmLasers.splice(i, 1);
  }
}

