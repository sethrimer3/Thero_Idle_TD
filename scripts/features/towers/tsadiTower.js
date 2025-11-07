/**
 * Tsadi tower particle fusion simulation module.
 * Provides an idle physics simulation with particle collisions and tier-based fusion.
 * 
 * Particles bounce around in 2D space. When two particles of the same tier collide,
 * they fuse into a single particle of tier+1, conserving momentum and mass.
 * The highest tier reached determines the number of Tsadi glyphs earned.
 */

/**
 * Ordered list of Greek letter metadata for tier naming.
 * Each entry contains the capitalized English name and its lowercase glyph.
 */
const GREEK_TIER_SEQUENCE = [
  { name: 'Alpha', letter: 'α' },
  { name: 'Beta', letter: 'β' },
  { name: 'Gamma', letter: 'γ' },
  { name: 'Delta', letter: 'δ' },
  { name: 'Epsilon', letter: 'ε' },
  { name: 'Zeta', letter: 'ζ' },
  { name: 'Eta', letter: 'η' },
  { name: 'Theta', letter: 'θ' },
  { name: 'Iota', letter: 'ι' },
  { name: 'Kappa', letter: 'κ' },
  { name: 'Lambda', letter: 'λ' },
  { name: 'Mu', letter: 'μ' },
  { name: 'Nu', letter: 'ν' },
  { name: 'Xi', letter: 'ξ' },
  { name: 'Omicron', letter: 'ο' },
  { name: 'Pi', letter: 'π' },
  { name: 'Rho', letter: 'ρ' },
  { name: 'Sigma', letter: 'σ' },
  { name: 'Tau', letter: 'τ' },
  { name: 'Upsilon', letter: 'υ' },
  { name: 'Phi', letter: 'φ' },
  { name: 'Chi', letter: 'χ' },
  { name: 'Psi', letter: 'ψ' },
  { name: 'Omega', letter: 'ω' },
];

/**
 * Convert tier to a color using a perceptually uniform gradient from cool to warm.
 * @param {number} tier - The particle tier (0-based)
 * @returns {string} CSS color string
 */
function tierToColor(tier) {
  // Map tier to hue: cool (blue) at tier 0 to warm (red/orange) at high tiers
  // Hue range: 240° (blue) → 0° (red) with saturation and lightness adjustments
  const maxTier = 20; // Expected max for color mapping
  const t = Math.min(tier / maxTier, 1);
  
  // Cool to warm: blue (240°) → cyan (180°) → green (120°) → yellow (60°) → orange/red (0-30°)
  const hue = 240 - (t * 240);
  const saturation = 70 + (t * 20); // 70% to 90%
  const lightness = 55 + (t * 10); // 55% to 65%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Simple Quadtree for efficient collision detection (broadphase).
 */
class Quadtree {
  constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
    this.bounds = bounds; // {x, y, width, height}
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }
  
  clear() {
    this.objects = [];
    this.nodes = [];
  }
  
  split() {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    
    this.nodes[0] = new Quadtree(
      { x: x + subWidth, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[1] = new Quadtree(
      { x: x, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[2] = new Quadtree(
      { x: x, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[3] = new Quadtree(
      { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
  }
  
  getIndex(particle) {
    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
    
    const topQuadrant = (particle.y - particle.radius < horizontalMidpoint) && 
                        (particle.y + particle.radius < horizontalMidpoint);
    const bottomQuadrant = (particle.y - particle.radius > horizontalMidpoint);
    
    if (particle.x - particle.radius < verticalMidpoint && 
        particle.x + particle.radius < verticalMidpoint) {
      if (topQuadrant) return 1;
      else if (bottomQuadrant) return 2;
    } else if (particle.x - particle.radius > verticalMidpoint) {
      if (topQuadrant) return 0;
      else if (bottomQuadrant) return 3;
    }
    
    return -1; // Doesn't fit in a quadrant
  }
  
  insert(particle) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        this.nodes[index].insert(particle);
        return;
      }
    }
    
    this.objects.push(particle);
    
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }
      
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }
  
  retrieve(particle) {
    const returnObjects = [];
    
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        returnObjects.push(...this.nodes[index].retrieve(particle));
      } else {
        // Check all quadrants if particle overlaps multiple
        for (const node of this.nodes) {
          returnObjects.push(...node.retrieve(particle));
        }
      }
    }
    
    returnObjects.push(...this.objects);
    return returnObjects;
  }
}

/**
 * ParticleFusionSimulation for the Tsadi Spire.
 * 
 * Simulates particles bouncing in 2D space with elastic collisions.
 * Equal-tier particles fuse into higher tiers, conserving momentum and mass.
 */
export class ParticleFusionSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Callbacks
    this.onTierChange = typeof options.onTierChange === 'function' ? options.onTierChange : null;
    this.onParticleCountChange = typeof options.onParticleCountChange === 'function' ? options.onParticleCountChange : null;
    this.onGlyphChange = typeof options.onGlyphChange === 'function' ? options.onGlyphChange : null;
    this.onParticleBankChange = typeof options.onParticleBankChange === 'function'
      ? options.onParticleBankChange
      : null;
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    
    // Physics parameters
    this.gravity = 0; // No gravity for this simulation
    this.damping = 1.0; // No damping (elastic collisions)
    this.massScaleFactor = 1.5; // k in radius = k * sqrt(mass)
    
    // Particle management
    this.particles = [];
    this.maxParticles = 100;
    this.spawnRate = 2; // Particles per second (consumes particle bank)
    this.spawnAccumulator = 0;
    this.baseMass = 1; // Base mass for tier 0 particles
    this.baseRadius = 5; // Visual base radius (recalculated on resize)
    this.particleBank = 0; // Reserve that feeds the simulation with new particles
    
    // Glyph tracking
    this.highestTierReached = 0; // Tracks the highest tier ever reached
    this.glyphCount = 0; // Number of Tsadi glyphs earned (= highest tier reached)
    
    // Fusion effects
    this.fusionEffects = []; // {x, y, radius, alpha, type: 'flash' | 'ring'}
    
    // Visual settings
    this.backgroundColor = '#0f1116'; // Dark background
    this.glowIntensity = 0.6;
    
    // Animation state
    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;
    
    // Quadtree for collision detection
    this.quadtree = null;
    
    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }

    // Hydrate the simulation with any preloaded particle reserve before seeding the initial swarm.
    const initialParticleBank = Number.isFinite(options.initialParticleBank)
      ? options.initialParticleBank
      : 0;
    this.setParticleBank(initialParticleBank);
    this.spawnInitialParticles();
  }
  
  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Cache CSS pixel size for consistent physics calculations.
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    if (this.ctx) {
      // Reset transform before applying DPR scaling to avoid cumulative scaling.
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }

    // Base radius ensures tier-0 diameter equals 1/50 of simulation width.
    this.baseRadius = (this.width / 100) / this.massScaleFactor;

    // Recalculate radii for existing particles so they stay proportional after resize.
    for (const particle of this.particles) {
      particle.radius = this.getRadiusFromMass(particle.mass);
    }
  }
  
  /**
   * Calculate mass for a given tier.
   * Mass doubles with each tier.
   */
  getMassForTier(tier) {
    return this.baseMass * Math.pow(2, tier);
  }
  
  /**
   * Calculate radius from mass.
   * Formula: radius = k * sqrt(mass)
   */
  getRadiusFromMass(mass) {
    return this.baseRadius * this.massScaleFactor * Math.sqrt(mass);
  }
  
  /**
   * Spawn initial particles to populate the simulation
   */
  spawnInitialParticles() {
    const initialCount = 10;
    for (let i = 0; i < initialCount; i++) {
      if (!this.spawnParticle()) {
        break;
      }
    }
  }
  
  /**
   * Spawn a new particle with random position and velocity
   */
  spawnParticle(tier = 0) {
    if (this.particles.length >= this.maxParticles) return false;
    if (this.particleBank <= 0) return false;

    const mass = this.getMassForTier(tier);
    const radius = this.getRadiusFromMass(mass);
    const tierInfo = getGreekTierInfo(tier);

    // Random position with margin from edges
    const margin = radius * 2;
    const x = margin + Math.random() * (this.width - margin * 2);
    const y = margin + Math.random() * (this.height - margin * 2);
    
    // Random velocity
    const speed = 50 + Math.random() * 100; // pixels per second
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    this.particles.push({
      x,
      y,
      vx,
      vy,
      mass,
      radius,
      tier,
      color: tierToColor(tier),
      label: tierInfo.letter,
      id: Math.random(), // Unique ID for tracking
    });

    // Deduct a particle from the idle bank when it materializes inside the simulation.
    this.setParticleBank(this.particleBank - 1);

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    return true;
  }
  
  /**
   * Update physics for all particles
   */
  updateParticles(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    const canvasWidth = this.width;
    const canvasHeight = this.height;
    
    // Spawn new particles
    this.spawnAccumulator += dt * this.spawnRate;
    while (this.spawnAccumulator >= 1 && this.particles.length < this.maxParticles && this.particleBank > 0) {
      const spawned = this.spawnParticle(0);
      if (!spawned) {
        break;
      }
      this.spawnAccumulator -= 1;
    }
    
    // Update positions
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Wall collisions (elastic)
      if (particle.x - particle.radius < 0) {
        particle.x = particle.radius;
        particle.vx = Math.abs(particle.vx);
      } else if (particle.x + particle.radius > canvasWidth) {
        particle.x = canvasWidth - particle.radius;
        particle.vx = -Math.abs(particle.vx);
      }
      
      if (particle.y - particle.radius < 0) {
        particle.y = particle.radius;
        particle.vy = Math.abs(particle.vy);
      } else if (particle.y + particle.radius > canvasHeight) {
        particle.y = canvasHeight - particle.radius;
        particle.vy = -Math.abs(particle.vy);
      }
    }
    
    // Build quadtree for collision detection
    this.quadtree = new Quadtree({
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
    });
    
    for (const particle of this.particles) {
      this.quadtree.insert(particle);
    }
    
    // Particle-particle collisions and fusion
    this.handleCollisions();
    
    // Update fusion effects
    for (let i = this.fusionEffects.length - 1; i >= 0; i--) {
      const effect = this.fusionEffects[i];
      effect.alpha -= dt * 3; // Fade out over ~0.33 seconds

      if (effect.type === 'ring') {
        effect.radius += dt * 100; // Expand ring
      }

      if (effect.alpha <= 0) {
        this.fusionEffects.splice(i, 1);
      }
    }
  }

  /**
   * Add particles to the idle bank that feeds the simulation.
   * @param {number} amount - Number of particles to add
   */
  addToParticleBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    this.setParticleBank(this.particleBank + amount);
  }

  /**
   * Overwrite the particle bank and notify observers when it changes.
   * @param {number} amount - New particle reserve value
   */
  setParticleBank(amount) {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (normalized === this.particleBank) {
      return;
    }
    this.particleBank = normalized;
    if (this.onParticleBankChange) {
      this.onParticleBankChange(this.particleBank);
    }
  }

  /**
   * Handle particle-particle collisions and fusion
   */
  handleCollisions() {
    const processedPairs = new Set();
    const particlesToRemove = new Set();
    const particlesToAdd = [];
    
    for (let i = 0; i < this.particles.length; i++) {
      const p1 = this.particles[i];
      if (particlesToRemove.has(p1.id)) continue;
      
      const candidates = this.quadtree.retrieve(p1);
      
      for (const p2 of candidates) {
        if (p1.id === p2.id) continue;
        if (particlesToRemove.has(p2.id)) continue;
        
        const pairKey = p1.id < p2.id ? `${p1.id}-${p2.id}` : `${p2.id}-${p1.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // Check for collision
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p1.radius + p2.radius;
        
        if (distSq < minDist * minDist) {
          // Collision detected
          if (p1.tier === p2.tier) {
            // Fusion: same tier particles merge
            const newTier = p1.tier + 1;
            const newMass = p1.mass + p2.mass;
            const newRadius = this.getRadiusFromMass(newMass);
            const newTierInfo = getGreekTierInfo(newTier);
            
            // Conserve momentum: weighted average of velocities
            const newVx = (p1.vx * p1.mass + p2.vx * p2.mass) / newMass;
            const newVy = (p1.vy * p1.mass + p2.vy * p2.mass) / newMass;
            
            // Position at midpoint of contact
            const newX = (p1.x + p2.x) / 2;
            const newY = (p1.y + p2.y) / 2;
            
            // Create new fused particle
            particlesToAdd.push({
              x: newX,
              y: newY,
              vx: newVx,
              vy: newVy,
              mass: newMass,
              radius: newRadius,
              tier: newTier,
              color: tierToColor(newTier),
              label: newTierInfo.letter,
              id: Math.random(),
            });
            
            // Mark old particles for removal
            particlesToRemove.add(p1.id);
            particlesToRemove.add(p2.id);
            
            // Add fusion effects
            this.fusionEffects.push(
              { x: newX, y: newY, radius: newRadius * 1.2, alpha: 1, type: 'flash' },
              { x: newX, y: newY, radius: newRadius, alpha: 0.8, type: 'ring' }
            );
            
            // Update highest tier
            if (newTier > this.highestTierReached) {
              this.highestTierReached = newTier;
              this.glyphCount = newTier;

              if (this.onTierChange) {
                this.onTierChange({
                  tier: newTier,
                  name: newTierInfo.name,
                  letter: newTierInfo.letter,
                });
              }
              if (this.onGlyphChange) {
                this.onGlyphChange(this.glyphCount);
              }
            }
          } else {
            // Elastic collision: different tiers
            this.resolveElasticCollision(p1, p2);
          }
        }
      }
    }
    
    // Remove fused particles
    this.particles = this.particles.filter(p => !particlesToRemove.has(p.id));
    
    // Add new particles
    this.particles.push(...particlesToAdd);
    
    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
  }
  
  /**
   * Resolve elastic collision between two particles
   */
  resolveElasticCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.001) return; // Avoid division by zero
    
    // Normalize collision vector
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Relative velocity
    const dvx = p1.vx - p2.vx;
    const dvy = p1.vy - p2.vy;
    
    // Relative velocity in collision normal direction
    const dvn = dvx * nx + dvy * ny;
    
    // Don't resolve if velocities are separating
    if (dvn > 0) return;
    
    // Collision impulse scalar
    const impulse = 2 * dvn / (p1.mass + p2.mass);
    
    // Apply impulse
    p1.vx -= impulse * p2.mass * nx;
    p1.vy -= impulse * p2.mass * ny;
    p2.vx += impulse * p1.mass * nx;
    p2.vy += impulse * p1.mass * ny;
    
    // Separate particles to prevent overlap
    const overlap = (p1.radius + p2.radius) - dist;
    if (overlap > 0) {
      const separationX = (overlap / 2) * nx;
      const separationY = (overlap / 2) * ny;
      p1.x -= separationX;
      p1.y -= separationY;
      p2.x += separationX;
      p2.y += separationY;
    }
  }
  
  /**
   * Render the simulation
   */
  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    // Clear with dark background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw fusion effects
    for (const effect of this.fusionEffects) {
      if (effect.type === 'flash') {
        // Radial flash
        const gradient = ctx.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${effect.alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(255, 255, 200, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === 'ring') {
        // Expanding ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Draw particles with sub-pixel precision and glow
    for (const particle of this.particles) {
      // Outer glow
      const glowGradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius * 1.5
      );
      
      // Parse color to extract RGB for gradient
      const color = particle.color;
      glowGradient.addColorStop(0, color);
      glowGradient.addColorStop(0.7, color);
      glowGradient.addColorStop(1, this.backgroundColor);
      
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Main particle body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight for 3D effect
      const highlightGradient = ctx.createRadialGradient(
        particle.x - particle.radius * 0.3,
        particle.y - particle.radius * 0.3,
        0,
        particle.x,
        particle.y,
        particle.radius
      );
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = highlightGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();

      // Render the tier glyph in the particle center to reinforce tier identity.
      if (particle.label) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.max(particle.radius * 1.1, 10)}px 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(particle.label, particle.x, particle.y);
      }
    }
  }
  
  /**
   * Animation loop
   */
  loop(timestamp) {
    if (!this.running) return;
    
    const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
    this.lastFrame = timestamp;
    
    this.updateParticles(Math.min(deltaTime, 100)); // Cap delta at 100ms
    this.render();
    
    this.loopHandle = requestAnimationFrame((t) => this.loop(t));
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame((t) => this.loop(t));
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
    if (this.loopHandle !== null) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
  }
  
  /**
   * Get particle count by tier
   */
  getParticleCountByTier() {
    const counts = {};
    for (const particle of this.particles) {
      counts[particle.tier] = (counts[particle.tier] || 0) + 1;
    }
    return counts;
  }
  
  /**
   * Export simulation state for save/load
   */
  exportState() {
    return {
      particles: this.particles.map(p => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        tier: p.tier,
      })),
      highestTierReached: this.highestTierReached,
      glyphCount: this.glyphCount,
      particleBank: this.particleBank,
    };
  }
  
  /**
   * Import simulation state from save
   */
  importState(state) {
    if (!state) return;
    
    this.particles = [];
    if (Array.isArray(state.particles)) {
      for (const p of state.particles) {
        const mass = this.getMassForTier(p.tier);
        const radius = this.getRadiusFromMass(mass);
        const tierInfo = getGreekTierInfo(p.tier);
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          mass,
          radius,
          tier: p.tier,
          color: tierToColor(p.tier),
          label: tierInfo.letter,
          id: Math.random(),
        });
      }
    }
    
    if (typeof state.highestTierReached === 'number') {
      this.highestTierReached = state.highestTierReached;
      this.glyphCount = state.highestTierReached;
    }

    if (Number.isFinite(state.particleBank)) {
      this.setParticleBank(state.particleBank);
    }

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    if (this.onTierChange) {
      const tierInfo = getGreekTierInfo(this.highestTierReached);
      this.onTierChange({
        tier: this.highestTierReached,
        name: tierInfo.name,
        letter: tierInfo.letter,
      });
    }
    if (this.onGlyphChange) {
      this.onGlyphChange(this.glyphCount);
    }
  }
}

/**
 * Retrieve metadata for the provided tier, looping through the Greek sequence if needed.
 * @param {number} tier - Zero-based tier index
 * @returns {{name: string, letter: string}}
 */
function getGreekTierInfo(tier) {
  const safeTier = Math.max(0, Math.floor(tier));
  const sequenceLength = GREEK_TIER_SEQUENCE.length;
  const index = safeTier % sequenceLength;
  const cycle = Math.floor(safeTier / sequenceLength);
  const baseInfo = GREEK_TIER_SEQUENCE[index];

  // Append cycle count to the name for tiers beyond the base sequence.
  const cycleSuffix = cycle > 0 ? ` ${cycle + 1}` : '';

  return {
    name: `${baseInfo.name}${cycleSuffix}`,
    letter: baseInfo.letter,
  };
}

// Export helper utilities for external use
export { tierToColor, getGreekTierInfo };
