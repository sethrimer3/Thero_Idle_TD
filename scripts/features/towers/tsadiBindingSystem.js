// Tsadi tower binding agent and molecule discovery methods extracted from ParticleFusionSimulation.
// Each function is called via .call(this) where `this` is the simulation instance.

import {
  NULL_TIER,
  LEGACY_MOLECULE_RECIPES,
  ADVANCED_MOLECULE_UNLOCK_TIER,
  normalizeTierList,
  sortTierListWithDuplicates,
  hasDuplicateTier,
  toDisplayTier,
  createCombinationIdFromTiers,
  stripCombinationPrefix,
  generateTierCombinations,
} from './tsadiTowerData.js';

/**
 * Retrieve the visual radius used for binding agent placement hit-testing.
 * @returns {number} Binding agent display radius in CSS pixels.
 */
export function getTsadiBindingAgentRadius() {
  return this.bindingAgentRadius || this.nullParticleRadius * 0.7;
}

/**
 * Estimate a binding agent's mass using its display radius as an inertia proxy.
 * @returns {number} Positive mass-like scalar.
 */
export function getTsadiBindingAgentMass() {
  const radius = this.getBindingAgentRadius();
  return Math.max(1, radius * radius);
}

/**
 * Determine the maximum tether reach and minimum rod length for binding agents.
 *
 * Range and rod length scale with the render width so bonds stay visually legible on any viewport size.
 * @returns {number} Rod range in CSS pixels.
 */
export function getTsadiBindingRodRange() {
  return Math.max(0, this.width) / 50;
}

/**
 * Get the available binding agent stock.
 * @returns {number} Non-negative binding agent reserve.
 */
export function getTsadiAvailableBindingAgents() {
  return this.availableBindingAgents;
}

/**
 * Set the available binding agent stock and notify listeners.
 * @param {number} amount - Desired stock value.
 */
export function setTsadiAvailableBindingAgents(amount) {
  const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (normalized === this.availableBindingAgents) {
    return;
  }
  this.availableBindingAgents = normalized;
  if (this.onBindingAgentStockChange) {
    this.onBindingAgentStockChange(normalized);
  }
}

/**
 * Increment the binding agent reserve by a positive or negative delta.
 * @param {number} amount - Amount to add to the stockpile.
 */
export function addTsadiBindingAgents(amount) {
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }
  this.setAvailableBindingAgents(this.availableBindingAgents + amount);
}

/**
 * Update the pending placement preview to mirror pointer movement.
 * @param {{x:number, y:number}|null} position - Canvas-space coordinates.
 */
export function setTsadiBindingAgentPreview(position) {
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    this.bindingAgentPreview = { x: position.x, y: position.y };
  } else {
    this.bindingAgentPreview = null;
  }
}

/**
 * Clear any pending preview once placement succeeds or is cancelled.
 */
export function clearTsadiBindingAgentPreview() {
  this.bindingAgentPreview = null;
}

/**
 * Attempt to place a binding agent at the provided coordinates.
 * Placement fails if stock is empty or overlaps an existing molecule anchor.
 * @param {{x:number, y:number}} position - Canvas-space coordinates.
 * @returns {boolean} Whether the binding agent was placed.
 */
export function placeTsadiBindingAgent(position) {
  if (!position || this.availableBindingAgents < 1) {
    return false;
  }

  const radius = this.getBindingAgentRadius();
  const overlapsExisting = this.bindingAgents.some((agent) => {
    const dx = agent.x - position.x;
    const dy = agent.y - position.y;
    const minDistance = radius * 2;
    return (dx * dx + dy * dy) < (minDistance * minDistance);
  });

  if (overlapsExisting) {
    return false;
  }

  this.bindingAgents.push({
    id: Math.random(),
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    connections: [],
    activeMolecules: [],
    pendingDiscoveries: [],
    awaitingCodexTap: false,
    popTimer: 0,
  });

  this.addBindingAgents(-1);
  this.clearBindingAgentPreview();
  return true;
}

/**
 * Find the nearest binding agent anchor to a point within the interaction radius.
 * @param {{x:number, y:number}} position - Canvas coordinates.
 * @param {number} tolerance - Extra padding to widen the selection ring.
 * @returns {Object|null} Matching binding agent or null when none is close enough.
 */
export function findTsadiBindingAgentNear(position, tolerance = 0) {
  const radius = this.getBindingAgentRadius() + tolerance;
  for (const agent of this.bindingAgents) {
    const dx = agent.x - position.x;
    const dy = agent.y - position.y;
    if ((dx * dx + dy * dy) <= radius * radius) {
      return agent;
    }
  }
  return null;
}

/**
 * Disband and remove a placed binding agent, refunding its stock.
 * @param {{x:number, y:number}} position - Canvas coordinates used for hit-testing.
 * @returns {boolean} Whether an agent was removed.
 */
export function disbandTsadiBindingAgentAt(position) {
  if (!position) {
    return false;
  }
  const target = this.findBindingAgentNear(position, 2);
  if (!target) {
    return false;
  }
  if (target.awaitingCodexTap) {
    return false; // Prevent dismantling while a discovery is pending collection.
  }

  this.bindingAgents = this.bindingAgents.filter((agent) => agent.id !== target.id);
  this.addBindingAgents(1);
  this.recalculateMoleculeBonuses();
  return true;
}

/**
 * Normalize a persisted or newly discovered molecule descriptor and apply naming.
 * @param {Object|string} recipe - Molecule recipe payload or identifier.
 * @returns {Object|null} Descriptor containing id, name, tiers, description, and bonus.
 */
export function normalizeTsadiMoleculeDescriptor(recipe) {
  if (!recipe) {
    return null;
  }
  const resolvedId = typeof recipe === 'string' ? recipe : recipe.id || recipe.name;
  const legacyRecipe = LEGACY_MOLECULE_RECIPES.find((entry) => entry.id === resolvedId) || null;
  const merged = typeof recipe === 'object' ? { ...(legacyRecipe || {}), ...recipe } : (legacyRecipe || { id: resolvedId });

  // For loading persisted molecules, preserve tiers as provided (may include duplicates)
  // But for legacy recipes, use normalizeTierList for backward compatibility
  const rawTiers = Array.isArray(merged.tiers) ? merged.tiers : legacyRecipe?.tiers || [];
  // Legacy recipes: from LEGACY_MOLECULE_RECIPES when recipe is a string or has no tiers property
  const isLegacy = Boolean(legacyRecipe && (typeof recipe === 'string' || !recipe.tiers));
  const tiers = isLegacy ? normalizeTierList(rawTiers) : sortTierListWithDuplicates(rawTiers);
  const particleCount = tiers.length;
  // Legacy recipes use old behavior (no duplicates), new recipes allow duplicates
  const generatedId = createCombinationIdFromTiers(tiers, !isLegacy);
  let id = merged.id || merged.name || generatedId || resolvedId || 'molecule';
  if (/^combo-/i.test(id) && generatedId) {
    id = generatedId;
  }
  const tierSequenceLabel = tiers.length ? tiers.map((tier) => toDisplayTier(tier)).join('-') : id;
  const baseName = typeof merged.name === 'string' && merged.name ? merged.name : (legacyRecipe?.name || id);
  const cleanedName = stripCombinationPrefix(baseName) || tierSequenceLabel;
  const description = typeof merged.description === 'string'
    ? merged.description
    : legacyRecipe?.description || 'Recorded in the Alchemy Codex.';
  const descriptor = {
    ...merged,
    id,
    name: cleanedName,
    tiers,
    description,
    particleCount,
    bonus: merged.bonus || legacyRecipe?.bonus || {},
  };

  if (this.assignMoleculeName) {
    const namedDescriptor = this.assignMoleculeName(descriptor);
    if (namedDescriptor) {
      return { ...descriptor, ...namedDescriptor };
    }
  }

  return descriptor;
}

/**
 * Seed discovered molecule registries from persisted payloads.
 * @param {Array} entries - Stored molecule entries.
 */
export function seedTsadiDiscoveredMolecules(entries) {
  if (!Array.isArray(entries)) {
    return;
  }
  entries.forEach((entry) => {
    const descriptor = this.normalizeMoleculeDescriptor(entry);
    if (descriptor) {
      this.discoveredMolecules.add(descriptor.id);
      this.discoveredMoleculeEntries.set(descriptor.id, descriptor);
    }
  });
}

/**
 * Record a newly completed molecule and return the enriched descriptor.
 * @param {Object} recipe - Molecule recipe that just completed.
 * @returns {Object|null} Descriptor saved to the discovery ledger.
 */
export function recordTsadiDiscoveredMolecule(recipe) {
  const descriptor = this.normalizeMoleculeDescriptor(recipe);
  if (!descriptor || (descriptor.particleCount || 0) < 2) {
    return null;
  }
  this.discoveredMolecules.add(descriptor.id);
  this.discoveredMoleculeEntries.set(descriptor.id, descriptor);
  return descriptor;
}

export function finalizeTsadiMoleculeDiscovery(descriptor) {
  if (!descriptor) {
    return false;
  }
  const recorded = this.recordDiscoveredMolecule(descriptor);
  if (recorded && this.onMoleculeDiscovered) {
    this.onMoleculeDiscovered(recorded);
  }
  return Boolean(recorded);
}

export function queueTsadiPendingMolecule(agent, descriptor) {
  if (!agent || !descriptor) {
    return;
  }
  agent.pendingDiscoveries = Array.isArray(agent.pendingDiscoveries) ? agent.pendingDiscoveries : [];
  agent.pendingDiscoveries.push(descriptor);
  agent.awaitingCodexTap = true;
  agent.popTimer = Math.max(agent.popTimer || 0, 0.6);
  this.pendingMoleculeIds.add(descriptor.id);
}

export function processTsadiPendingMolecules(agent) {
  if (!agent || !Array.isArray(agent.pendingDiscoveries) || !agent.pendingDiscoveries.length) {
    return false;
  }
  let discoveredNew = false;
  while (agent.pendingDiscoveries.length) {
    const descriptor = agent.pendingDiscoveries.shift();
    if (!descriptor) {
      continue;
    }
    this.pendingMoleculeIds.delete(descriptor.id);
    if (this.finalizeMoleculeDiscovery(descriptor)) {
      discoveredNew = true;
    }
  }
  agent.pendingDiscoveries = [];
  agent.awaitingCodexTap = false;
  // Trigger explosion effect when manually collecting new discoveries
  this.popBindingAgent(agent, discoveredNew);
  return discoveredNew;
}

export function collectTsadiPendingMoleculesAt(position) {
  if (!position) {
    return false;
  }
  const agent = this.findBindingAgentNear(position, 2);
  if (!agent || !agent.awaitingCodexTap) {
    return false;
  }
  return this.processPendingMolecules(agent);
}

export function flushTsadiPendingMolecules() {
  for (const agent of this.bindingAgents) {
    if (agent?.pendingDiscoveries?.length) {
      this.processPendingMolecules(agent);
    }
  }
}

/**
 * Check whether advanced molecule rules are unlocked via particle progression.
 * Advanced molecules allow duplicate particle tiers bound through layered Waals anchors.
 * @returns {boolean} True once the advanced molecule unlock tier is reached.
 */
export function areTsadiAdvancedMoleculesUnlocked() {
  if (!this.advancedMoleculesUnlocked && this.highestTierReached >= ADVANCED_MOLECULE_UNLOCK_TIER) {
    this.advancedMoleculesUnlocked = true;
  }
  return this.advancedMoleculesUnlocked;
}

/**
 * Create a normalized descriptor for a freeform molecule combination.
 * Now supports duplicate tiers to allow molecules like [alpha, beta, alpha].
 * @param {Array<number>} tiers - Tier list (may contain duplicates).
 * @returns {Object|null} Molecule descriptor with id and particle count.
 */
export function createTsadiCombinationDescriptor(tiers = []) {
  const sorted = sortTierListWithDuplicates(tiers);
  if (sorted.length < 2) {
    return null;
  }
  const id = createCombinationIdFromTiers(sorted, true);
  if (!id) {
    // Invalid molecule (e.g., insufficient particles or lacks variety)
    return null;
  }
  return this.normalizeMoleculeDescriptor({
    id,
    tiers: sorted,
    particleCount: sorted.length,
  });
}

/**
 * Recompute global molecule bonuses from all active bindings.
 */
export function recalculateTsadiMoleculeBonuses() {
  const nextBonuses = { spawnRateBonus: 0, repellingShift: 0 };
  for (const agent of this.bindingAgents) {
    for (const moleculeId of agent.activeMolecules || []) {
      const recipe = this.discoveredMoleculeEntries.get(moleculeId);
      if (!recipe || !recipe.bonus) {
        continue;
      }
      if (Number.isFinite(recipe.bonus.spawnRateBonus)) {
        nextBonuses.spawnRateBonus += recipe.bonus.spawnRateBonus;
      }
      if (Number.isFinite(recipe.bonus.repellingShift)) {
        nextBonuses.repellingShift += recipe.bonus.repellingShift;
      }
    }
  }
  this.moleculeBonuses = nextBonuses;
}

/**
 * Release all bonds on a binding agent after a successful discovery.
 * @param {Object} agent - Binding agent whose connections should be cleared.
 * @param {boolean} withExplosion - Whether to create an explosion effect and remove the agent.
 */
export function popTsadiBindingAgent(agent, withExplosion = false) {
  if (!agent) {
    return;
  }
  const particleMap = new Map(this.particles.map((particle) => [particle.id, particle]));
  
  if (withExplosion) {
    // Create explosion effect at the binding agent's location
    const explosionRadius = this.getBindingAgentRadius() * 4;
    if (this.visualSettings.renderFusionEffects) {
      this.fusionEffects.push(
        { x: agent.x, y: agent.y, radius: explosionRadius, alpha: 1, type: 'flash' },
        { x: agent.x, y: agent.y, radius: explosionRadius * 0.7, alpha: 0.8, type: 'ring' },
      );
    }
    
    // Free particles with stronger outward momentum
    agent.connections.forEach((connection) => {
      const particle = particleMap.get(connection.particleId);
      if (particle) {
        const dx = particle.x - agent.x;
        const dy = particle.y - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        // Push particles outward from the explosion center
        particle.vx += nx * 0.8;
        particle.vy += ny * 0.8;
      }
    });
    
    // Remove the binding agent from the simulation
    if (agent.id !== null && agent.id !== undefined) {
      const agentIndex = this.bindingAgents.findIndex((a) => a.id === agent.id);
      if (agentIndex !== -1) {
        this.bindingAgents.splice(agentIndex, 1);
      }
    }
    // Don't refund the agent when it explodes with a discovery
  } else {
    // Standard pop without explosion - just release particles gently
    agent.connections.forEach((connection) => {
      const particle = particleMap.get(connection.particleId);
      if (particle) {
        // Nudge attached particles apart so the release is visible.
        particle.vx += (Math.random() - 0.5) * 0.4;
        particle.vy += (Math.random() - 0.5) * 0.4;
      }
    });
    agent.connections = [];
    agent.activeMolecules = [];
    agent.pendingDiscoveries = [];
    agent.awaitingCodexTap = false;
    agent.popTimer = Math.max(agent.popTimer || 0, 0.6);
  }
}

/**
 * Randomly connect binding agents to nearby particles with non-positive repelling force
 * and resolve molecule formation state.
 * @param {number} dt - Delta time in seconds.
 */
export function updateTsadiBindingAgents(dt) {
  if (!this.bindingAgents.length) {
    this.moleculeBonuses = { spawnRateBonus: 0, repellingShift: 0 };
    return;
  }

  const bindingRadius = this.getBindingAgentRadius();
  const bindingMass = this.getBindingAgentMass();
  const bindingRepellingForce = this.baseRepellingForce * 0.5;
  const connectionRange = this.getBindingRodRange(); // Bond reach tied to viewport width.
  const minimumBondLength = connectionRange; // Rods stretch to at least this length when tethered.

  const particleMap = new Map();
  for (const particle of this.particles) {
    particleMap.set(particle.id, particle);
  }

  for (const agent of this.bindingAgents) {
    agent.radius = bindingRadius;
    agent.repellingForce = bindingRepellingForce;

    if (agent.awaitingCodexTap) {
      continue;
    }

    // Remove stale or now-repulsive connections.
    agent.connections = agent.connections.filter((connection) => {
      const target = particleMap.get(connection.particleId);
      if (!target || target.tier <= NULL_TIER) {
        return false;
      }

      // Preserve the latest distance so the render step can draw a taut bond to moving particles.
      connection.bondLength = Math.max(
        minimumBondLength,
        Math.hypot(target.x - agent.x, target.y - agent.y),
      );
      return true;
    });

    const connectedIds = new Set(agent.connections.map((connection) => connection.particleId));

    const nearbyBodies = this.quadtree ? this.quadtree.retrieve(agent) : this.particles;

    // If a Waals particle bumps into an eligible target, immediately stabilize it with a bond
    // and resolve the overlap so the contact is visible instead of passing through.
    for (const target of nearbyBodies) {
      if (target.id === agent.id) continue;
      if (target.isBindingAgent) continue;
      const isNullParticle = target.tier <= NULL_TIER;

      const dx = target.x - agent.x;
      const dy = target.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const minDistance = bindingRadius + target.radius;

      if (distance <= Math.max(connectionRange, minDistance)) {
        // Null particles cannot form bonds, but still collide to keep the chamber physical.
        // Allow duplicate tiers - only check that we haven't already connected this specific particle
        if (!isNullParticle && !connectedIds.has(target.id)) {
          const bondLength = Math.max(
            minimumBondLength,
            minDistance,
            Math.hypot(target.x - agent.x, target.y - agent.y),
          );
          agent.connections.push({
            particleId: target.id,
            tier: target.tier,
            bondLength,
          });
          connectedIds.add(target.id);
        }
      }
    }

    // Stochastically attempt one new connection per frame to keep molecule creation organic.
    const shouldAttemptBond = Math.random() < Math.min(0.6, dt * 3);
    if (shouldAttemptBond) {
      const eligibleCandidates = nearbyBodies.filter((particle) => {
        if (particle.id === agent.id) return false;
        if (particle.isBindingAgent) return false;
        if (particle.tier <= NULL_TIER) return false;
        // Allow duplicate tiers - only check that we haven't already connected this specific particle
        if (connectedIds.has(particle.id)) return false;

        const dx = particle.x - agent.x;
        const dy = particle.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = Math.max(connectionRange, particle.radius + this.getBindingAgentRadius());
        return distance <= maxDistance;
      });

      if (eligibleCandidates.length) {
        const target = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
        const bondLength = Math.max(
          minimumBondLength,
          Math.hypot(target.x - agent.x, target.y - agent.y),
        );
        agent.connections.push({
          particleId: target.id,
          tier: target.tier,
          bondLength,
        });
      }
    }

    // Resolve molecule completion and discovery based on tier combinations.
    // Preserve duplicate tiers only when advanced molecules have been unlocked.
    const advancedMoleculesUnlocked = this.areAdvancedMoleculesUnlocked();
    const tiersPresent = advancedMoleculesUnlocked
      ? sortTierListWithDuplicates(agent.connections.map((connection) => connection.tier))
      : normalizeTierList(agent.connections.map((connection) => connection.tier));
    const combinations = tiersPresent.length >= 2 ? generateTierCombinations(tiersPresent) : [];
    agent.activeMolecules = [];
    let discoveredNewMolecule = false;
    let queuedManualDiscovery = false;
    for (const combo of combinations) {
      const descriptor = this.createCombinationDescriptor(combo);
      if (!descriptor) {
        continue;
      }
      const isAdvancedCombo = hasDuplicateTier(descriptor.tiers);
      if (isAdvancedCombo && !advancedMoleculesUnlocked) {
        continue;
      }
      agent.activeMolecules.push(descriptor.id);
      const alreadyRecorded = this.discoveredMolecules.has(descriptor.id);
      const pendingRecording = this.pendingMoleculeIds.has(descriptor.id);
      if (alreadyRecorded || pendingRecording) {
        continue;
      }
      this.queuePendingMolecule(agent, descriptor);
      discoveredNewMolecule = true;
      queuedManualDiscovery = true;
    }

    // Immediately process queued discoveries so the explosion, knockback, and codex entry
    // happen without requiring a manual tap even before advanced molecules unlock.
    if (queuedManualDiscovery) {
      const processed = this.processPendingMolecules(agent);
      if (processed) {
        // Agent is removed during processing, so skip further constraint handling.
        continue;
      }
    }
    // Constrain connected particles to move as if joined by rigid, weightless rods.
    for (const connection of agent.connections) {
      const target = particleMap.get(connection.particleId);
      if (!target) continue;

      const dx = target.x - agent.x;
      const dy = target.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredLength = Math.max(minimumBondLength, connection.bondLength || distance);
      connection.bondLength = desiredLength;

      const nx = dx / distance;
      const ny = dy / distance;

      const targetMass = target.radius * target.radius;
      const totalMass = bindingMass + targetMass;

      // Position correction splits the error proportionally to each body's inertia proxy.
      const separation = distance - desiredLength;
      const agentShift = (separation * targetMass) / totalMass;
      const targetShift = (separation * bindingMass) / totalMass;
      agent.x += nx * agentShift;
      agent.y += ny * agentShift;
      target.x -= nx * targetShift;
      target.y -= ny * targetShift;

      // Velocity correction removes relative motion along the rod so both bodies travel together.
      const relativeSpeed = (agent.vx - target.vx) * nx + (agent.vy - target.vy) * ny;
      const impulse = relativeSpeed;
      agent.vx -= (impulse * nx * targetMass) / totalMass;
      agent.vy -= (impulse * ny * targetMass) / totalMass;
      target.vx += (impulse * nx * bindingMass) / totalMass;
      target.vy += (impulse * ny * bindingMass) / totalMass;
    }
  }

  this.recalculateMoleculeBonuses();
}

/**
 * Retrieve metadata for discovered molecules for UI surfaces.
 * @returns {Array} Array of molecule recipe objects that have been discovered.
 */
export function getTsadiDiscoveredMolecules() {
  const entries = [];
  for (const id of this.discoveredMolecules) {
    const descriptor = this.discoveredMoleculeEntries.get(id)
      || this.normalizeMoleculeDescriptor(id);
    if (descriptor) {
      entries.push(descriptor);
    }
  }
  return entries;
}

/**
 * Check if a binding agent has a valid combination (at least 2 different tier particles).
 * @param {Object} agent - The binding agent to check.
 * @returns {boolean} True if the agent has a valid combination.
 */
export function hasTsadiValidCombination(agent) {
  if (!agent || !Array.isArray(agent.connections)) {
    return false;
  }
  const uniqueTiers = new Set(
    agent.connections
      .filter((connection) => connection && Number.isFinite(connection.tier))
      .map((connection) => connection.tier)
  );
  return uniqueTiers.size >= 2;
}
