/**
 * Spire Idle Application System
 * 
 * Handles the application of idle-time resources to spire simulations.
 * When a player returns after being away, this system converts banked resources
 * into visual simulation effects that make it feel like time actually passed.
 * 
 * Key Features:
 * - Bet spire: Distributes particles across scintilla tiers
 * - Lamed spire: Applies stars as sun mass increase
 * - Tsadi spire: Spawns pre-merged particles using binary decomposition
 */

/**
 * Convert bet spire idle particles into a tier distribution.
 * Splits particles among scintilla tiers: sand (tier 0), quartz (tier 1), ruby (tier 2), etc.
 * 
 * Uses a 100:1 conversion ratio between tiers, so:
 * - 100 sand particles = 1 quartz particle
 * - 100 quartz particles = 1 ruby particle
 * - etc.
 * 
 * @param {number} totalParticles - Total number of particles earned during idle time
 * @returns {Array<{tierId: string, count: number}>} Distribution of particles across tiers
 */
export function distributeBetIdleParticles(totalParticles) {
  if (!Number.isFinite(totalParticles) || totalParticles <= 0) {
    return [];
  }

  // Bet spire tier progression (matching PARTICLE_TIERS in betSpireRender.js)
  const tiers = [
    'sand',     // tier 0
    'quartz',   // tier 1
    'ruby',     // tier 2
    'sunstone', // tier 3
    'citrine',  // tier 4
    'emerald',  // tier 5
    'sapphire', // tier 6
    'amethyst', // tier 7
    'diamond',  // tier 8
    'opal',     // tier 9
    'moonstone' // tier 10
  ];

  const distribution = [];
  let remaining = Math.floor(totalParticles);

  // Convert from highest tier down to ensure we use the 100:1 ratio correctly
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tierThreshold = Math.pow(100, i);
    if (remaining >= tierThreshold) {
      const count = Math.floor(remaining / tierThreshold);
      distribution.unshift({
        tierId: tiers[i],
        tierIndex: i,
        count: count,
      });
      remaining = remaining % tierThreshold;
    }
  }

  return distribution;
}

/**
 * Convert lamed spire idle stars into sun mass increase.
 * 
 * In the lamed spire, stars are absorbed into the sun to increase its mass.
 * During idle time, we calculate how many stars would have been generated,
 * and apply their total mass directly to the sun.
 * 
 * @param {number} idleStars - Number of stars generated during idle time
 * @param {number} starMass - Mass per star (from upgrades)
 * @returns {number} Total mass to add to the sun
 */
export function calculateLamedIdleMassGain(idleStars, starMass = 1) {
  if (!Number.isFinite(idleStars) || idleStars <= 0) {
    return 0;
  }
  if (!Number.isFinite(starMass) || starMass <= 0) {
    return 0;
  }

  return idleStars * starMass;
}

/**
 * Convert tsadi spire idle particles into binary tier distribution.
 * 
 * In the tsadi spire, particles merge when two of the same tier collide.
 * During idle time, we pre-merge particles using binary decomposition.
 * 
 * For example: 259 particles becomes:
 * - 1 tier 7 particle (2^8 = 256) - tierPower 8 adjusts to tier 7 (null is -1)
 * - 1 tier 0 particle (2^1 = 2) - tierPower 1 adjusts to tier 0
 * - 1 tier -1 particle (2^0 = 1) - tierPower 0 adjusts to tier -1 (null tier)
 * 
 * @param {number} totalParticles - Total number of particles earned during idle time
 * @returns {Array<{tier: number, count: number}>} Distribution of particles by tier
 */
export function distributeTsadiIdleParticles(totalParticles) {
  if (!Number.isFinite(totalParticles) || totalParticles <= 0) {
    return [];
  }

  const distribution = [];
  let remaining = Math.floor(totalParticles);
  let tier = 0;

  // Convert to binary representation using powers of 2
  // Start from tier 0 (null tier, represented as -1 in the code) and work up
  while (remaining > 0) {
    // Check if this bit is set in the binary representation
    if (remaining & 1) {
      distribution.push({
        tier: tier - 1, // Adjust for null tier being -1
        tierPower: tier,
        count: 1,
      });
    }
    remaining = remaining >> 1; // Shift right to check next bit
    tier++;
  }

  return distribution;
}

/**
 * Apply bet spire idle particles to the simulation.
 * This function spawns small particles from generators in a distributed manner.
 * 
 * @param {Object} betSpireInstance - The bet spire render instance
 * @param {number} totalParticles - Total particles to apply
 */
export function applyBetIdleParticles(betSpireInstance, totalParticles) {
  if (!betSpireInstance || typeof betSpireInstance.addParticle !== 'function') {
    return;
  }

  const distribution = distributeBetIdleParticles(totalParticles);
  
  // Spawn particles for each tier in the distribution
  // Only spawn small particles (size index 0) as per the problem statement
  for (const entry of distribution) {
    for (let i = 0; i < entry.count; i++) {
      betSpireInstance.addParticle(entry.tierId, 0); // 0 = SMALL_SIZE_INDEX
    }
  }
}

/**
 * Apply lamed spire idle stars to the simulation.
 * This function increases the sun's mass directly.
 * 
 * @param {Object} lamedSimulation - The lamed (gravity) simulation instance
 * @param {number} idleStars - Number of stars generated during idle time
 */
export function applyLamedIdleStars(lamedSimulation, idleStars) {
  if (!lamedSimulation || typeof lamedSimulation.absorbStarImmediately !== 'function') {
    return;
  }

  // Get the current star mass upgrade level
  const starMass = 1 + (lamedSimulation.upgrades?.starMass || 0);
  
  // Calculate total mass gain
  const totalMass = calculateLamedIdleMassGain(idleStars, starMass);
  
  if (totalMass > 0) {
    // Apply mass directly to the sun
    lamedSimulation.absorbStarImmediately(totalMass);
  }
}

/**
 * Apply tsadi spire idle particles to the simulation.
 * This function spawns pre-merged particles at appropriate tiers.
 * 
 * @param {Object} tsadiSimulation - The tsadi (particle fusion) simulation instance
 * @param {number} totalParticles - Total particles to apply
 */
export function applyTsadiIdleParticles(tsadiSimulation, totalParticles) {
  if (!tsadiSimulation || typeof tsadiSimulation.spawnParticle !== 'function') {
    return;
  }

  const distribution = distributeTsadiIdleParticles(totalParticles);
  
  // Spawn particles at their pre-merged tiers
  for (const entry of distribution) {
    for (let i = 0; i < entry.count; i++) {
      tsadiSimulation.spawnParticle(entry.tier);
    }
  }
}
