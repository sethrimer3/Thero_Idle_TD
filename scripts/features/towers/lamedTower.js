/**
 * Lamed tower gravity simulation module.
 * Provides an idle physics simulation with orbital mechanics for stars around a central celestial body.
 * 
 * Features:
 * - Orbital mechanics with central gravity and softening
 * - Mass-based visual tiers (Proto-star through Black Hole)
 * - Drag system with upgradable k parameter
 * - Accretion disk visual effects with dust particles
 * - Trajectory trails colored by velocity
 * - Absorption shock rings
 * - Statistics tracking (mass inflow, absorptions)
 */

/**
 * Mass tier definitions for celestial body evolution.
 * Each tier has distinct visual properties.
 */
const MASS_TIERS = [
  { name: 'Proto-star', threshold: 10, color: '#FF6B6B', glow: 0.3 },
  { name: 'Main Sequence', threshold: 100, color: '#FFD93D', glow: 0.5 },
  { name: 'Blue Giant', threshold: 5000, color: '#6BCF7F', glow: 0.7 },
  { name: 'Red Giant', threshold: 10000, color: '#FF8B94', glow: 0.85 },
  { name: 'Supergiant', threshold: 50000, color: '#FFA07A', glow: 1.0 },
  { name: 'Neutron Star', threshold: 1000000, color: '#B19CD9', glow: 1.2 },
  { name: 'Black Hole', threshold: 10000000, color: '#2D2D2D', glow: 1.5 },
];

/**
 * Deterministic pseudo-random number generator using seed.
 */
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
}

/**
 * GravitySimulation for the Lamed Spire.
 * 
 * Simulates stars spawning at random orbital distances, orbiting around a central celestial body,
 * and eventually being absorbed to increase the central body's mass.
 */
export class GravitySimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Callbacks
    this.onSparkBankChange = typeof options.onSparkBankChange === 'function' ? options.onSparkBankChange : null;
    this.onStarMassChange = typeof options.onStarMassChange === 'function' ? options.onStarMassChange : null;
    this.samplePaletteGradient = typeof options.samplePaletteGradient === 'function' ? options.samplePaletteGradient : null;
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    
    // Physics parameters
    this.G = 200; // Gravitational constant
    this.epsilon = 5; // Softening parameter to prevent singularity
    this.starMass = 10; // Initial mass of central star (Proto-star)
    this.dragCoefficient = 0.01; // k parameter for drag (upgradable, starts at 0.01)
    this.dragLevel = 0; // Current drag upgrade level
    this.maxDragLevel = 1000000; // Maximum drag upgrade level
    
    // Upgrades
    this.upgrades = {
      starMass: 0, // Upgrade level for orbiting stars' mass
    };
    
    // Star management (renamed from sparks)
    this.stars = [];
    this.sparkBank = 0; // Idle currency reserve that spawns stars into the simulation
    this.maxStars = 100; // Maximum number of active orbiting stars
    this.sparkSpawnRate = 0; // Stars spawned per second (starts at 0)
    this.spawnAccumulator = 0;
    
    // Spawn parameters for ring spawner
    this.spawnRadiusMin = 60; // Minimum spawn radius (pixels)
    this.spawnRadiusMax = 120; // Maximum spawn radius (pixels)
    this.velocityNoiseFactor = 0.15; // Noise added to circular velocity
    
    // Trail rendering
    this.trailLength = 40; // Number of trail points to keep
    this.trailFadeRate = 0.025; // How quickly trails fade
    
    // Visual effects
    this.backgroundColor = '#000000'; // Black space
    this.shockRings = []; // Absorption shock rings
    this.dustParticles = []; // Accretion disk dust
    this.highGraphics = typeof options.highGraphics === 'boolean' ? options.highGraphics : false;
    this.maxDustParticles = this.highGraphics ? 2000 : 100; // 20x more on high graphics
    this.dustSpawnRate = this.highGraphics ? 100 : 5; // Dust particles per second (20x more on high)
    this.dustAccumulator = 0;
    this.flashEffects = []; // Spawn flash effects
    
    // Statistics tracking
    this.stats = {
      totalAbsorptions: 0,
      totalMassGained: 0,
      lastAbsorptionTime: 0,
      absorptionsPerMinute: 0,
      massInflowPerMinute: 0,
      absorptionHistory: [], // For sparkline
      massHistory: [], // For sparkline
      historyMaxLength: 60, // Keep last 60 samples
    };
    
    // Animation state
    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;
    this.elapsedTime = 0;
    
    // Deterministic RNG
    this.rng = new SeededRandom(options.seed || Date.now());
    
    // Seed the spark bank with any provided initial reserve so UI callbacks hydrate immediately.
    const initialSparkBank = Number.isFinite(options.initialSparkBank) ? options.initialSparkBank : 0;
    this.setSparkBank(initialSparkBank);

    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }
  }
  
  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }
  
  /**
   * Get current mass tier information based on central star mass.
   */
  getCurrentTier() {
    let tier = MASS_TIERS[0];
    let nextTier = MASS_TIERS[1] || null;
    
    for (let i = 0; i < MASS_TIERS.length; i++) {
      if (this.starMass >= MASS_TIERS[i].threshold) {
        tier = MASS_TIERS[i];
        nextTier = MASS_TIERS[i + 1] || null;
      } else {
        break;
      }
    }
    
    // Calculate progress to next tier (0 to 1)
    let progress = 0;
    if (nextTier) {
      const currentThreshold = tier.threshold;
      const nextThreshold = nextTier.threshold;
      progress = Math.min(1, (this.starMass - currentThreshold) / (nextThreshold - currentThreshold));
    }
    
    return { tier, nextTier, progress };
  }
  
  /**
   * Spawn a new star randomly between the central body edge and simulation edge.
   * Uses near-circular orbital velocity.
   */
  spawnStar() {
    if (this.stars.length >= this.maxStars) return false;
    if (this.sparkBank <= 0) return false;

    const dpr = window.devicePixelRatio || 1;
    
    // Calculate central body radius
    const starVisualRadius = Math.max(10, 5 + Math.sqrt(this.starMass / 10) * 3);
    
    // Calculate maximum spawn radius (edge of simulation)
    const maxR = Math.min(this.width, this.height) / (2 * dpr);
    
    // Spawn at random distance between central body edge and simulation edge
    const r = this.rng.range(starVisualRadius, maxR);
    const angle = this.rng.next() * Math.PI * 2;
    
    // Position relative to center (in DPR-scaled coordinates)
    const x = this.centerX + Math.cos(angle) * r;
    const y = this.centerY + Math.sin(angle) * r;
    
    // Calculate circular orbital velocity: v = sqrt(G*M/r)
    const circularSpeed = Math.sqrt((this.G * this.starMass) / r);
    
    // Add velocity noise for spiral effects
    const velocityMultiplier = 1 + this.rng.range(-this.velocityNoiseFactor, this.velocityNoiseFactor);
    const v = circularSpeed * velocityMultiplier;
    
    // Tangential velocity (perpendicular to radius vector)
    const vx = -Math.sin(angle) * v;
    const vy = Math.cos(angle) * v;
    
    // Star mass (affected by star mass upgrade)
    const baseMass = this.rng.range(0.5, 2.0);
    const starMass = baseMass * (1 + this.upgrades.starMass * 0.1);
    
    this.stars.push({
      x,
      y,
      vx,
      vy,
      mass: starMass,
      trail: [], // Array of {x, y, alpha, speed} points
      life: 1.0,
    });
    
    // Add spawn flash effect
    this.flashEffects.push({
      x: x / dpr,
      y: y / dpr,
      radius: 5,
      maxRadius: 20,
      alpha: 1.0,
      duration: 0.3, // seconds
      elapsed: 0,
    });

    // Deduct from the idle bank when a new star is introduced to the simulation.
    this.setSparkBank(this.sparkBank - 1);

    return true;
  }

  /**
   * Spawn dust particles for accretion disk visualization.
   * Particles spawn randomly between the central body edge and simulation edge.
   */
  spawnDustParticles(deltaTime) {
    if (this.dustParticles.length >= this.maxDustParticles) return;
    
    const dt = deltaTime / 1000;
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate central body radius
    const starVisualRadius = Math.max(10, 5 + Math.sqrt(this.starMass / 10) * 3);
    
    // Calculate maximum spawn radius
    const maxR = Math.min(this.width, this.height) / (2 * dpr);
    
    this.dustAccumulator += dt * this.dustSpawnRate;
    while (this.dustAccumulator >= 1 && this.dustParticles.length < this.maxDustParticles) {
      // Spawn randomly between central body edge and simulation edge
      const r = this.rng.range(starVisualRadius, maxR);
      const angle = this.rng.next() * Math.PI * 2;
      
      const x = this.centerX + Math.cos(angle) * r;
      const y = this.centerY + Math.sin(angle) * r;
      
      // Azimuthal velocity with radial inflow
      const azimuthalSpeed = Math.sqrt((this.G * this.starMass) / r) * 0.3;
      const radialSpeed = -2; // Slow inward drift
      
      const vx = -Math.sin(angle) * azimuthalSpeed + Math.cos(angle) * radialSpeed;
      const vy = Math.cos(angle) * azimuthalSpeed + Math.sin(angle) * radialSpeed;
      
      // Sample color from palette gradient
      const gradientPos = this.rng.next(); // Random position in gradient
      let color;
      if (this.samplePaletteGradient) {
        color = this.samplePaletteGradient(gradientPos);
      } else {
        color = { r: 200, g: 200, b: 220 }; // Fallback color
      }
      
      this.dustParticles.push({
        x,
        y,
        vx,
        vy,
        color,
        life: 1.0,
        maxLife: this.rng.range(2, 5), // seconds
        elapsed: 0,
      });
      
      this.dustAccumulator -= 1;
    }
  }
  
  /**
   * Update dust particles.
   */
  updateDustParticles(deltaTime) {
    const dt = deltaTime / 1000;
    const dpr = window.devicePixelRatio || 1;
    
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dust = this.dustParticles[i];
      
      // Update lifetime
      dust.elapsed += dt;
      dust.life = Math.max(0, 1 - dust.elapsed / dust.maxLife);
      
      if (dust.life <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }
      
      // Push dust away from passing stars
      for (const star of this.stars) {
        const dx = dust.x - star.x;
        const dy = dust.y - star.y;
        const distSq = dx * dx + dy * dy;
        const pushRadius = 25;
        
        if (distSq < pushRadius * pushRadius && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const pushStrength = 20;
          dust.vx += (dx / dist) * pushStrength * dt;
          dust.vy += (dy / dist) * pushStrength * dt;
        }
      }
      
      // Apply velocity damping
      dust.vx *= 0.98;
      dust.vy *= 0.98;
      
      // Update position
      dust.x += dust.vx * dt;
      dust.y += dust.vy * dt;
    }
  }
  
  /**
   * Update physics for all orbiting stars.
   */
  updateStars(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    const dpr = window.devicePixelRatio || 1;

    // Spawn new stars
    this.spawnAccumulator += dt * this.sparkSpawnRate;
    while (this.spawnAccumulator >= 1 && this.sparkBank > 0) {
      const spawned = this.spawnStar();
      if (!spawned) {
        break;
      }
      this.spawnAccumulator -= 1;
    }
    
    // Track absorptions for statistics
    let absorbedThisFrame = 0;
    let massGainedThisFrame = 0;
    
    // Update each star
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      
      // Calculate distance to center with softening
      const dx = this.centerX - star.x;
      const dy = this.centerY - star.y;
      const distSq = Math.max(dx * dx + dy * dy, this.epsilon * this.epsilon);
      const dist = Math.sqrt(distSq);
      
      // Get current tier for absorption radius
      const { tier } = this.getCurrentTier();
      const starVisualRadius = Math.max(10, 5 + Math.sqrt(this.starMass / 10) * 3);
      const absorptionRadius = starVisualRadius;
      
      // Check if star should be absorbed (collision detection)
      if (dist < absorptionRadius) {
        // Increase central body mass
        const massGain = star.mass;
        this.starMass += massGain;
        massGainedThisFrame += massGain;
        absorbedThisFrame++;

        if (this.onStarMassChange) {
          this.onStarMassChange(this.starMass);
        }
        
        // Create absorption shock ring
        this.shockRings.push({
          x: this.centerX / dpr,
          y: this.centerY / dpr,
          radius: 0,
          maxRadius: absorptionRadius * 1.5,
          alpha: 1.0,
          duration: 0.8, // seconds
          elapsed: 0,
        });

        // Remove star
        this.stars.splice(i, 1);
        continue;
      }
      
      // Calculate gravitational acceleration: a = -G * M / r^2 * r̂
      const forceMagnitude = (this.G * this.starMass) / distSq;
      const ax = (dx / dist) * forceMagnitude;
      const ay = (dy / dist) * forceMagnitude;
      
      // Apply drag: a_drag = -k * v
      const dragAx = -this.dragCoefficient * star.vx;
      const dragAy = -this.dragCoefficient * star.vy;
      
      // Update velocity
      star.vx += (ax + dragAx) * dt;
      star.vy += (ay + dragAy) * dt;
      
      // Update position
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      
      // Calculate speed for trail coloring
      const speed = Math.sqrt(star.vx * star.vx + star.vy * star.vy);
      
      // Add current position to trail
      star.trail.push({
        x: star.x,
        y: star.y,
        alpha: 1.0,
        speed: speed,
      });
      
      // Limit trail length
      if (star.trail.length > this.trailLength) {
        star.trail.shift();
      }
      
      // Fade trail points
      for (const point of star.trail) {
        point.alpha = Math.max(0, point.alpha - this.trailFadeRate);
      }
    }
    
    // Update statistics
    if (absorbedThisFrame > 0) {
      this.stats.totalAbsorptions += absorbedThisFrame;
      this.stats.totalMassGained += massGainedThisFrame;
      this.stats.lastAbsorptionTime = this.elapsedTime;
    }
    
    // Update absorption and mass history for sparklines (sample every second)
    if (Math.floor(this.elapsedTime) !== Math.floor(this.elapsedTime - dt)) {
      this.stats.absorptionHistory.push(absorbedThisFrame);
      this.stats.massHistory.push(this.starMass);
      
      if (this.stats.absorptionHistory.length > this.stats.historyMaxLength) {
        this.stats.absorptionHistory.shift();
      }
      if (this.stats.massHistory.length > this.stats.historyMaxLength) {
        this.stats.massHistory.shift();
      }
      
      // Calculate rates (per minute)
      const historyDuration = this.stats.absorptionHistory.length; // seconds
      if (historyDuration > 0) {
        const totalAbsorptionsInHistory = this.stats.absorptionHistory.reduce((a, b) => a + b, 0);
        this.stats.absorptionsPerMinute = (totalAbsorptionsInHistory / historyDuration) * 60;
        
        if (this.stats.massHistory.length >= 2) {
          const massGainedInHistory = this.stats.massHistory[this.stats.massHistory.length - 1] - 
                                       this.stats.massHistory[0];
          this.stats.massInflowPerMinute = (massGainedInHistory / historyDuration) * 60;
        }
      }
    }
  }
  
  /**
   * Update visual effects (shock rings, flash effects).
   */
  updateEffects(deltaTime) {
    const dt = deltaTime / 1000;
    
    // Update shock rings
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const ring = this.shockRings[i];
      ring.elapsed += dt;
      
      const progress = ring.elapsed / ring.duration;
      ring.radius = progress * ring.maxRadius;
      ring.alpha = Math.max(0, 1 - progress);
      
      if (progress >= 1) {
        this.shockRings.splice(i, 1);
      }
    }
    
    // Update flash effects
    for (let i = this.flashEffects.length - 1; i >= 0; i--) {
      const flash = this.flashEffects[i];
      flash.elapsed += dt;
      
      const progress = flash.elapsed / flash.duration;
      flash.radius = flash.maxRadius * Math.sin(progress * Math.PI); // Expand then contract
      flash.alpha = Math.max(0, 1 - progress);
      
      if (progress >= 1) {
        this.flashEffects.splice(i, 1);
      }
    }
  }
  
  /**
   * Render the simulation with all visual effects.
   */
  render() {
    if (!this.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    
    // Clear with black background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width / dpr, this.height / dpr);
    
    const centerXScaled = this.centerX / dpr;
    const centerYScaled = this.centerY / dpr;
    
    // Get current tier information
    const { tier, nextTier, progress } = this.getCurrentTier();
    
    // Calculate star visual radius based on mass
    // diameter = star_mass / sqrt(center_mass) (scaled for display)
    const starVisualRadius = Math.max(10, 5 + Math.sqrt(this.starMass / 10) * 3);
    
    // Luminosity increases with progress to next tier (100% to 200%)
    const baseGlowIntensity = Math.max(0.6, tier.glow);
    const glowProgressScale = 1 + progress; // 100% glow at start, 200% at next milestone threshold
    const luminosity = baseGlowIntensity * glowProgressScale;
    
    // Add pulsing effect when absorbing mass (check if recent absorption)
    const timeSinceAbsorption = this.elapsedTime - this.stats.lastAbsorptionTime;
    let pulseScale = 1.0;
    if (timeSinceAbsorption < 0.3) {
      pulseScale = 1.0 + Math.sin((timeSinceAbsorption / 0.3) * Math.PI) * 0.2;
    }
    
    // Parse tier color
    const parseColor = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    
    const tierColor = parseColor(tier.color);
    
    // Draw gravitational lensing effect (fake refraction)
    if (tier.name === 'Black Hole') {
      // Draw event horizon
      const horizonRadius = starVisualRadius * 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerXScaled, centerYScaled, horizonRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw glow effect with tier-based luminosity
    const glowRadius = starVisualRadius * (1.8 + baseGlowIntensity) * glowProgressScale * pulseScale;
    const gradient = ctx.createRadialGradient(
      centerXScaled, centerYScaled, 0,
      centerXScaled, centerYScaled, glowRadius
    );
    gradient.addColorStop(0, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.8 * luminosity})`);
    gradient.addColorStop(0.3, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.5 * luminosity})`);
    gradient.addColorStop(0.6, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.2 * luminosity})`);
    gradient.addColorStop(1, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw core celestial body
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, starVisualRadius * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw accretion jets for high-mass stars
    const spinThreshold = 1000; // Mass threshold for jets
    if (this.starMass > spinThreshold && this.stars.length > 5) {
      const jetLength = 100;
      const jetWidth = 3;
      const jetAlpha = Math.min(0.6, (this.starMass / spinThreshold - 1) * 0.1);
      
      // Draw twin beams along vertical axis
      ctx.strokeStyle = `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${jetAlpha})`;
      ctx.lineWidth = jetWidth;
      
      // Top jet
      ctx.beginPath();
      ctx.moveTo(centerXScaled, centerYScaled);
      ctx.lineTo(centerXScaled, centerYScaled - jetLength);
      ctx.stroke();
      
      // Bottom jet
      ctx.beginPath();
      ctx.moveTo(centerXScaled, centerYScaled);
      ctx.lineTo(centerXScaled, centerYScaled + jetLength);
      ctx.stroke();
    }
    
    // Draw dust particles (accretion disk) with color palette gradient
    for (const dust of this.dustParticles) {
      const dustX = dust.x / dpr;
      const dustY = dust.y / dpr;
      const dustAlpha = dust.life * 0.3;
      
      if (dust.color) {
        ctx.fillStyle = `rgba(${dust.color.r}, ${dust.color.g}, ${dust.color.b}, ${dustAlpha})`;
      } else {
        ctx.fillStyle = `rgba(200, 200, 220, ${dustAlpha})`;
      }
      ctx.beginPath();
      ctx.arc(dustX, dustY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw orbiting stars with trails
    for (const star of this.stars) {
      // Draw trail with color gradient from palette
      if (star.trail.length > 1) {
        ctx.lineWidth = 1.5;
        
        for (let i = 1; i < star.trail.length; i++) {
          const prev = star.trail[i - 1];
          const curr = star.trail[i];
          
          // Color based on speed (slow = lower palette color, fast = upper palette color)
          const normalizedSpeed = Math.min(1, curr.speed / 200);
          
          let slowColor, fastColor;
          if (this.samplePaletteGradient) {
            // Use the color palette gradient
            slowColor = this.samplePaletteGradient(0);
            fastColor = this.samplePaletteGradient(1);
          } else {
            // Fallback to default colors
            slowColor = { r: 100, g: 150, b: 255 }; // Blueish
            fastColor = { r: 255, g: 200, b: 100 }; // Yellowish
          }
          
          const r = Math.floor(slowColor.r + (fastColor.r - slowColor.r) * normalizedSpeed);
          const g = Math.floor(slowColor.g + (fastColor.g - slowColor.g) * normalizedSpeed);
          const b = Math.floor(slowColor.b + (fastColor.b - slowColor.b) * normalizedSpeed);
          
          const alpha = curr.alpha * 0.5;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          
          ctx.beginPath();
          ctx.moveTo(prev.x / dpr, prev.y / dpr);
          ctx.lineTo(curr.x / dpr, curr.y / dpr);
          ctx.stroke();
        }
      }
      
      // Draw star with size based on mass ratio to central body
      const starX = star.x / dpr;
      const starY = star.y / dpr;
      const massRatio = star.mass / this.starMass;
      const starSize = starVisualRadius * massRatio;
      
      // Glow effect
      const starGradient = ctx.createRadialGradient(
        starX, starY, 0,
        starX, starY, starSize * 2
      );
      starGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      starGradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.6)');
      starGradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
      
      ctx.fillStyle = starGradient;
      ctx.beginPath();
      ctx.arc(starX, starY, starSize * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Core star
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw absorption shock rings
    for (const ring of this.shockRings) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw spawn flash effects
    for (const flash of this.flashEffects) {
      const flashGradient = ctx.createRadialGradient(
        flash.x, flash.y, 0,
        flash.x, flash.y, flash.radius
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flash.alpha})`);
      flashGradient.addColorStop(0.5, `rgba(139, 247, 255, ${flash.alpha * 0.5})`);
      flashGradient.addColorStop(1, 'rgba(139, 247, 255, 0)');
      
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  /**
   * Main animation loop step
   */
  step(timestamp) {
    if (!this.running) return;
    
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }
    
    const MAX_FRAME_DELTA_MS = 100; // Prevent physics instability on frame drops
    const deltaTime = Math.min(timestamp - this.lastFrame, MAX_FRAME_DELTA_MS);
    this.lastFrame = timestamp;
    
    // Update elapsed time for statistics
    this.elapsedTime += deltaTime / 1000;
    
    // Update all simulation components
    this.updateStars(deltaTime);
    this.spawnDustParticles(deltaTime);
    this.updateDustParticles(deltaTime);
    this.updateEffects(deltaTime);
    this.render();
    
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
  }
  
  /**
   * Set the star spawn rate
   */
  setSparkSpawnRate(rate) {
    this.sparkSpawnRate = Math.max(0, rate);
  }
  
  /**
   * Add sparks to the bank
   */
  addToSparkBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    this.setSparkBank(this.sparkBank + amount);
  }

  /**
   * Overwrite the spark bank and notify listeners when the value changes.
   * @param {number} amount - New spark reserve value
   */
  setSparkBank(amount) {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (normalized === this.sparkBank) {
      return;
    }
    this.sparkBank = normalized;
    if (this.onSparkBankChange) {
      this.onSparkBankChange(this.sparkBank);
    }
  }
  
  /**
   * Calculate the cost to upgrade drag to the next level.
   * Cost starts at 10 sparks and increases by 10x each level.
   * @returns {number} Cost in sparks
   */
  getDragUpgradeCost() {
    return 10 * Math.pow(10, this.dragLevel);
  }
  
  /**
   * Check if drag can be upgraded.
   * @returns {boolean}
   */
  canUpgradeDrag() {
    return this.dragLevel < this.maxDragLevel && this.sparkBank >= this.getDragUpgradeCost();
  }
  
  /**
   * Upgrade the drag coefficient (k parameter).
   * Increases k by 0.01 per upgrade level (starting at 0.01).
   * @returns {boolean} True if upgrade succeeded
   */
  upgradeDrag() {
    if (!this.canUpgradeDrag()) {
      return false;
    }
    
    const cost = this.getDragUpgradeCost();
    this.setSparkBank(this.sparkBank - cost);
    this.dragLevel++;
    this.dragCoefficient = 0.01 + (this.dragLevel * 0.01);
    
    return true;
  }
  
  /**
   * Calculate the cost to upgrade star mass to the next level.
   * @returns {number} Cost in sparks
   */
  getStarMassUpgradeCost() {
    return 5 * Math.pow(2, this.upgrades.starMass);
  }
  
  /**
   * Check if star mass can be upgraded.
   * @returns {boolean}
   */
  canUpgradeStarMass() {
    return this.sparkBank >= this.getStarMassUpgradeCost();
  }
  
  /**
   * Upgrade the mass of orbiting stars.
   * Increases star mass by 10% per upgrade level.
   * @returns {boolean} True if upgrade succeeded
   */
  upgradeStarMass() {
    if (!this.canUpgradeStarMass()) {
      return false;
    }
    
    const cost = this.getStarMassUpgradeCost();
    this.setSparkBank(this.sparkBank - cost);
    this.upgrades.starMass++;
    
    return true;
  }
  
  /**
   * Get statistics for UI display.
   */
  getStatistics() {
    const { tier, nextTier, progress } = this.getCurrentTier();
    
    return {
      starMass: this.starMass,
      currentTier: tier.name,
      nextTier: nextTier ? nextTier.name : 'MAX',
      progressToNext: progress,
      orbitingStars: this.stars.length,
      absorptionsPerMinute: this.stats.absorptionsPerMinute,
      massInflowPerMinute: this.stats.massInflowPerMinute,
      totalAbsorptions: this.stats.totalAbsorptions,
      dragLevel: this.dragLevel,
      dragCoefficient: this.dragCoefficient,
      nextMilestone: nextTier ? nextTier.threshold : this.starMass,
    };
  }

  /**
   * Get current state for serialization
   */
  getState() {
    return {
      starMass: this.starMass,
      sparkBank: this.sparkBank,
      dragLevel: this.dragLevel,
      dragCoefficient: this.dragCoefficient,
      upgrades: {
        starMass: this.upgrades.starMass,
      },
      stats: {
        totalAbsorptions: this.stats.totalAbsorptions,
        totalMassGained: this.stats.totalMassGained,
      },
    };
  }
  
  /**
   * Restore state from serialized data
   */
  setState(state) {
    if (state && typeof state === 'object') {
      if (Number.isFinite(state.starMass)) {
        this.starMass = Math.max(0, state.starMass);
      }
      if (Number.isFinite(state.sparkBank)) {
        this.setSparkBank(state.sparkBank);
      }
      if (Number.isFinite(state.dragLevel)) {
        this.dragLevel = Math.max(0, Math.min(state.dragLevel, this.maxDragLevel));
        this.dragCoefficient = 0.01 + (this.dragLevel * 0.01);
      }
      if (state.upgrades) {
        if (Number.isFinite(state.upgrades.starMass)) {
          this.upgrades.starMass = Math.max(0, state.upgrades.starMass);
        }
      }
      if (state.stats) {
        if (Number.isFinite(state.stats.totalAbsorptions)) {
          this.stats.totalAbsorptions = state.stats.totalAbsorptions;
        }
        if (Number.isFinite(state.stats.totalMassGained)) {
          this.stats.totalMassGained = state.stats.totalMassGained;
        }
      }
    }
  }
}
