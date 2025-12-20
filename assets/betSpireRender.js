// Bet Spire Particle Physics Render
// Tiered particle system with merging, forging, and a central forge attractor

// Canvas dimensions matching Aleph Spire render
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 320;

// Particle system configuration
const TRAIL_FADE = 0.15; // Lower = longer trails
const BASE_PARTICLE_SIZE = 0.75; // Base size for small particles (reduced from 1.5 to half size)
const SIZE_MULTIPLIER = 2.5; // Each size tier is 2.5x bigger
const BASE_MIN_VELOCITY = 0.24; // Minimum speed to keep particles swirling (20% slower than before)
const MIN_VELOCITY_MULTIPLIERS = [1, 0.8, 0.64]; // Medium and large particles slow by successive 20% steps
const MAX_VELOCITY = 2;
const ATTRACTION_STRENGTH = 1.5; // Increased to keep particles within field (was 0.5)
const FORGE_RADIUS = 30; // Radius for forge attraction
const MAX_FORGE_ATTRACTION_DISTANCE = FORGE_RADIUS * 2; // Particles only feel forge gravity when within twice the forge radius
const DISTANCE_SCALE = 0.01; // Scale factor for distance calculations
const FORCE_SCALE = 0.01; // Scale factor for force application
const ORBITAL_FORCE = 0.15; // Increased tangential orbital force strength (was 0.1)
const ORBITAL_RADIUS_MULTIPLIER = 2; // Multiplier for orbital effect radius
const FORGE_REPULSION_DAMPING = 0.6; // Dampen outward push when particles slingshot past the forge
const FORGE_ROTATION_SPEED = 0.02; // Rotation speed for forge triangles
const SPAWNER_GRAVITY_STRENGTH = 0.75; // Gentle attraction strength used by individual spawners
const SPAWNER_GRAVITY_RANGE_MULTIPLIER = 4; // Spawner gravity now reaches four times its radius for a wider pull

// Shockwave configuration
const SHOCKWAVE_EXPANSION_SPEED = 3; // Pixels per frame
const SHOCKWAVE_MAX_RADIUS = 80; // Maximum shockwave radius before dissipating
const SHOCKWAVE_PUSH_FORCE = 2.5; // Force applied to particles hit by shockwave
const SHOCKWAVE_DURATION = 600; // Milliseconds for shockwave to fully expand and fade

// Pixelation levels downscale the internal render buffer to improve performance on high-DPI displays.
const PIXELATION_SCALES = [1, 0.75, 0.5]; // 0 = crisp, 1 = mild pixelation, 2 = aggressive pixelation

function resolvePixelationScale(level = 0) {
  const index = Math.max(0, Math.min(PIXELATION_SCALES.length - 1, Math.round(level)));
  return PIXELATION_SCALES[index];
}

// User interaction configuration
const INTERACTION_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 10;
const MOUSE_ATTRACTION_STRENGTH = 3.0;
const INTERACTION_FADE_DURATION = 300; // milliseconds for circle fade

// Forge position at center of canvas
const FORGE_POSITION = { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.5 };

// Particle spawner configuration (mini forges for each unlocked particle type)
const SPAWNER_SIZE = 8; // Size of spawner forge triangles (smaller than main forge)
const SPAWNER_ROTATION_SPEED = 0.03; // Rotation speed for spawner triangles
const SPAWNER_COLOR_BRIGHTNESS_OFFSET = 30; // RGB offset for spawner triangle color variation
const SPAWNER_GRAVITY_RADIUS = SPAWNER_SIZE * SPAWNER_GRAVITY_RANGE_MULTIPLIER; // Influence radius for each spawner

// Generator positions: sand at top center (12 o'clock), then 10 more in clockwise circle
// All 11 generators are equidistant from each other on a circle around the forge
const GENERATOR_CIRCLE_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.35; // Circle radius for generators
const SPAWNER_POSITIONS = Array.from({ length: 11 }, (_, i) => {
  // Start at top (12 o'clock = -90 degrees), then proceed clockwise
  const angle = (-Math.PI / 2) + (i * 2 * Math.PI / 11);
  return {
    x: FORGE_POSITION.x + Math.cos(angle) * GENERATOR_CIRCLE_RADIUS,
    y: FORGE_POSITION.y + Math.sin(angle) * GENERATOR_CIRCLE_RADIUS
  };
});

// Particle tier definitions matching gem hierarchy
// Sand is the base tier (pale yellow like motes from tower of inspiration)
const PARTICLE_TIERS = [
  {
    id: 'sand',
    name: 'Sand',
    color: { r: 255, g: 215, b: 100 }, // Pale yellow like motes
    glowColor: null, // No special glow
  },
  {
    id: 'quartz',
    name: 'Quartz',
    color: { r: 245, g: 240, b: 235 }, // Light beige/off-white
    glowColor: null,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    color: { r: 220, g: 50, b: 50 }, // Red
    glowColor: null,
  },
  {
    id: 'sunstone',
    name: 'Sunstone',
    color: { r: 255, g: 140, b: 60 }, // Orange
    glowColor: null,
  },
  {
    id: 'citrine',
    name: 'Citrine',
    color: { r: 230, g: 200, b: 80 }, // Yellow
    glowColor: null,
  },
  {
    id: 'emerald',
    name: 'Emerald',
    color: { r: 80, g: 180, b: 100 }, // Green
    glowColor: null,
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    color: { r: 60, g: 120, b: 200 }, // Blue
    glowColor: null,
  },
  {
    id: 'iolite',
    name: 'Iolite',
    color: { r: 100, g: 100, b: 180 }, // Indigo
    glowColor: null,
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    color: { r: 180, g: 100, b: 200 }, // Purple
    glowColor: null,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    color: { r: 240, g: 245, b: 250 }, // Bright white/cyan
    glowColor: null,
  },
  {
    id: 'nullstone',
    name: 'Nullstone',
    color: { r: 30, g: 30, b: 40 }, // Nearly black
    glowColor: { r: 150, g: 100, b: 200 }, // Purple glow
  },
];

// Size tiers: small, medium, large
const SIZE_TIERS = ['small', 'medium', 'large'];
const MERGE_THRESHOLD = 100; // 100 particles merge into 1 of next size

// Particle class with tier and size
class Particle {
  constructor(tierId = 'sand', sizeIndex = 0, spawnPosition = null) {
    // Spawn at generator position if provided, otherwise at random location
    if (spawnPosition) {
      this.x = spawnPosition.x;
      this.y = spawnPosition.y;
    } else {
      this.x = Math.random() * CANVAS_WIDTH;
      this.y = Math.random() * CANVAS_HEIGHT;
    }
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    
    // Tier and size properties
    this.tierId = tierId;
    this.sizeIndex = sizeIndex; // 0 = small, 1 = medium, 2 = large
    
    this.lockedToMouse = false; // Whether particle is locked to mouse/touch
    this.mouseTarget = null; // Target position when locked to mouse
  }

  getTier() {
    return PARTICLE_TIERS.find(t => t.id === this.tierId) || PARTICLE_TIERS[0];
  }

  getSizeName() {
    return SIZE_TIERS[this.sizeIndex] || 'small';
  }

  getSize() {
    // Calculate actual render size
    return BASE_PARTICLE_SIZE * Math.pow(SIZE_MULTIPLIER, this.sizeIndex);
  }

  getMinVelocity() {
    const multiplier = MIN_VELOCITY_MULTIPLIERS[this.sizeIndex] ?? MIN_VELOCITY_MULTIPLIERS[0];
    return BASE_MIN_VELOCITY * multiplier;
  }

  update(forge, spawners = []) {
    // If locked to mouse, strongly attract to mouse position
    if (this.lockedToMouse && this.mouseTarget) {
      const dx = this.mouseTarget.x - this.x;
      const dy = this.mouseTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 1) {
        const force = MOUSE_ATTRACTION_STRENGTH;
        const angle = Math.atan2(dy, dx);
        this.vx += Math.cos(angle) * force;
        this.vy += Math.sin(angle) * force;
      } else {
        // Very close to target, dampen velocity
        this.vx *= 0.8;
        this.vy *= 0.8;
      }
    } else {
      // Apply gravity from each unlocked spawner within its local field so particles stay near their forge of origin.
      for (const spawner of spawners) {
        const dx = spawner.x - this.x;
        const dy = spawner.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= spawner.range && dist > 0.5) {
          const force = SPAWNER_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE);
          const angle = Math.atan2(dy, dx);
          this.vx += Math.cos(angle) * force * FORCE_SCALE;
          this.vy += Math.sin(angle) * force * FORCE_SCALE;
        }
      }

      // Normal forge attractor behavior
      const dx = forge.x - this.x;
      const dy = forge.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Apply attraction force (inverse square law simplified) only while within the localized forge gravity well
      if (dist <= MAX_FORGE_ATTRACTION_DISTANCE) {
        const angle = Math.atan2(dy, dx);
        if (dist > 1) {
          const force = ATTRACTION_STRENGTH / (dist * DISTANCE_SCALE);
          this.vx += Math.cos(angle) * force * FORCE_SCALE;
          this.vy += Math.sin(angle) * force * FORCE_SCALE;
        }

        // Add slight orbital motion around forge to keep particles swirling
        if (dist < FORGE_RADIUS * ORBITAL_RADIUS_MULTIPLIER) { // Apply orbital force in a wider area
          const tangentAngle = angle + Math.PI / 2;
          this.vx += Math.cos(tangentAngle) * ORBITAL_FORCE;
          this.vy += Math.sin(tangentAngle) * ORBITAL_FORCE;
        }
      }
    }
    
    // Limit velocity
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_VELOCITY) {
      this.vx = (this.vx / speed) * MAX_VELOCITY;
      this.vy = (this.vy / speed) * MAX_VELOCITY;
    }
    
    // Enforce minimum velocity to keep particles always moving
    const minVelocity = this.getMinVelocity();
    if (speed < minVelocity && speed > 0) {
      this.vx = (this.vx / speed) * minVelocity;
      this.vy = (this.vy / speed) * minVelocity;
    } else if (speed === 0) {
      // Give particles a random initial velocity if they're stopped
      const randomAngle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(randomAngle) * minVelocity;
      this.vy = Math.sin(randomAngle) * minVelocity;
    }
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // Keep particles within gravitational field (bounce off canvas bounds instead of wrapping)
    if (!this.lockedToMouse) {
      const bounce = 0.8; // Bounce dampening factor
      
      if (this.x < 0) {
        this.x = 0;
        this.vx = Math.abs(this.vx) * bounce;
      }
      if (this.x > CANVAS_WIDTH) {
        this.x = CANVAS_WIDTH;
        this.vx = -Math.abs(this.vx) * bounce;
      }
      if (this.y < 0) {
        this.y = 0;
        this.vy = Math.abs(this.vy) * bounce;
      }
      if (this.y > CANVAS_HEIGHT) {
        this.y = CANVAS_HEIGHT;
        this.vy = -Math.abs(this.vy) * bounce;
      }
    } else {
      // Clamp to canvas bounds when locked
      if (this.x < 0) this.x = 0;
      if (this.x > CANVAS_WIDTH) this.x = CANVAS_WIDTH;
      if (this.y < 0) this.y = 0;
      if (this.y > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT;
    }
  }

  getColor() {
    const tier = this.getTier();
    const color = tier.color;
    return `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
  }

  draw(ctx) {
    const tier = this.getTier();
    const size = this.getSize();
    
    // Draw particle
    ctx.fillStyle = this.getColor();
    
    // If tier has a glow, add shadow effect
    if (tier.glowColor) {
      ctx.shadowBlur = size * 3;
      ctx.shadowColor = `rgba(${tier.glowColor.r}, ${tier.glowColor.g}, ${tier.glowColor.b}, 0.8)`;
    } else {
      ctx.shadowBlur = 0;
    }
    
    ctx.fillRect(
      Math.floor(this.x - size / 2),
      Math.floor(this.y - size / 2),
      Math.ceil(size),
      Math.ceil(size)
    );
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }
}

// Main render system
export class BetSpireRender {
  constructor(canvas, state = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.particles = [];
    this.forge = FORGE_POSITION;
    this.forgeRotation = 0; // Rotation angle for forge triangles
    this.animationId = null;
    this.isRunning = false;
    this.pixelationLevel = Number.isFinite(state.pixelationLevel) ? state.pixelationLevel : 0;
    this.pixelationScale = resolvePixelationScale(this.pixelationLevel);
    
    // Particle inventory: tracks count by tier (sum of all sizes)
    this.inventory = new Map();
    PARTICLE_TIERS.forEach(tier => {
      this.inventory.set(tier.id, 0);
    });
    
    // Track which particle tiers have been unlocked (spawners appear when unlocked)
    this.unlockedTiers = new Set(['sand']); // Sand is always unlocked
    
    // Spawner rotation tracking
    this.spawnerRotations = new Map();

    // Initialize rotation entries for any tiers that start unlocked so their forge triangles counter-rotate immediately.
    this.unlockedTiers.forEach((tierId) => {
      this.spawnerRotations.set(tierId, Math.random() * Math.PI * 2);
    });
    
    // Particle Factor tracking for BET glyph awards - load from state or use defaults
    this.particleFactorMilestone = Number.isFinite(state.particleFactorMilestone) 
      ? state.particleFactorMilestone 
      : 10; // Start at 10, then 100, 1000, etc.
    this.betGlyphsAwarded = Number.isFinite(state.betGlyphsAwarded)
      ? state.betGlyphsAwarded
      : 0;
    
    // Store state reference for persistence
    this.state = state;
    
    // Mouse/touch interaction state
    this.isInteracting = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.interactionCircles = []; // Array of {x, y, radius, alpha, timestamp}
    
    // Shockwave state for merge effects
    this.shockwaves = []; // Array of {x, y, radius, alpha, timestamp, maxRadius}
    
    // Bind methods for requestAnimationFrame and event listeners
    this.animate = this.animate.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Set canvas dimensions
    this.canvas.style.width = `${CANVAS_WIDTH}px`;
    this.canvas.style.height = `${CANVAS_HEIGHT}px`;
    this.applyPixelationScale();
    
    // Initialize with some sand particles for testing
    for (let i = 0; i < 50; i++) {
      this.addParticle('sand', 0);
    }
    
    // Initialize with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Set up event listeners
    this.setupEventListeners();
  }

  addParticle(tierId, sizeIndex) {
    // Get the generator position for this tier
    const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
    const spawnPosition = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
      ? SPAWNER_POSITIONS[tierIndex] 
      : null;
    
    const particle = new Particle(tierId, sizeIndex, spawnPosition);
    this.particles.push(particle);
    
    // Unlock the tier if it hasn't been unlocked yet
    if (!this.unlockedTiers.has(tierId)) {
      this.unlockedTiers.add(tierId);
      
      // Initialize rotation for the spawner
      if (!this.spawnerRotations.has(tierId)) {
        this.spawnerRotations.set(tierId, Math.random() * Math.PI * 2);
      }
    }
    
    this.updateInventory();
  }

  removeParticle(particle) {
    const index = this.particles.indexOf(particle);
    if (index !== -1) {
      this.particles.splice(index, 1);
      this.updateInventory();
    }
  }

  createShockwave(x, y) {
    // Create a new shockwave at the specified location
    this.shockwaves.push({
      x: x,
      y: y,
      radius: 0,
      alpha: 0.8,
      timestamp: Date.now(),
      maxRadius: SHOCKWAVE_MAX_RADIUS
    });
  }

  updateInventory() {
    // Clear inventory
    this.inventory.forEach((_, key) => {
      this.inventory.set(key, 0);
    });
    
    // Count particles by tier (combining all sizes using conversion rules)
    this.particles.forEach(particle => {
      const tierId = particle.tierId;
      const sizeIndex = particle.sizeIndex;
      
      // Convert to small particle equivalent
      // 1 medium = 100 small, 1 large = 10000 small
      const smallEquivalent = Math.pow(MERGE_THRESHOLD, sizeIndex);
      const currentCount = this.inventory.get(tierId) || 0;
      this.inventory.set(tierId, currentCount + smallEquivalent);
    });
  }

  // Attempt to merge particles of the same tier and size
  attemptMerge() {
    const particlesByTierAndSize = new Map();
    
    // Group particles by tier and size, only including particles within forge influence
    this.particles.forEach(particle => {
      // Check if particle is within forge influence (2x forge radius)
      const dx = this.forge.x - particle.x;
      const dy = this.forge.y - particle.y;
      const distToForge = Math.sqrt(dx * dx + dy * dy);
      
      // Only consider particles within the forge influence for merging
      if (distToForge <= MAX_FORGE_ATTRACTION_DISTANCE) {
        const key = `${particle.tierId}-${particle.sizeIndex}`;
        if (!particlesByTierAndSize.has(key)) {
          particlesByTierAndSize.set(key, []);
        }
        particlesByTierAndSize.get(key).push(particle);
      }
    });
    
    // Check each group for merging
    particlesByTierAndSize.forEach((group, key) => {
      if (group.length >= MERGE_THRESHOLD) {
        const [tierId, sizeIndexStr] = key.split('-');
        const sizeIndex = parseInt(sizeIndexStr);
        
        // Can only merge if not already at max size
        if (sizeIndex < SIZE_TIERS.length - 1) {
          // Calculate center point of particles being merged
          let centerX = 0;
          let centerY = 0;
          for (let i = 0; i < MERGE_THRESHOLD; i++) {
            centerX += group[i].x;
            centerY += group[i].y;
          }
          centerX /= MERGE_THRESHOLD;
          centerY /= MERGE_THRESHOLD;
          
          // Make particles converge at high speed to center point before merging
          for (let i = 0; i < MERGE_THRESHOLD; i++) {
            const particle = group[i];
            const dx = centerX - particle.x;
            const dy = centerY - particle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 1) {
              // High-speed convergence
              const speed = 5; // Fast convergence speed
              particle.vx = (dx / dist) * speed;
              particle.vy = (dy / dist) * speed;
            }
          }
          
          // Create a shockwave at the merge location
          this.createShockwave(centerX, centerY);
          
          // Remove 100 particles
          for (let i = 0; i < MERGE_THRESHOLD; i++) {
            this.removeParticle(group[i]);
          }
          
          // Add 1 particle of next size at the merge location
          const newParticle = new Particle(tierId, sizeIndex + 1, null);
          newParticle.x = centerX;
          newParticle.y = centerY;
          this.particles.push(newParticle);
          this.updateInventory();
        }
      }
    });
  }

  // Forge particles into the next tier
  forgeParticle(particle) {
    const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === particle.tierId);
    
    // Can't forge if already at max tier
    if (tierIndex >= PARTICLE_TIERS.length - 1) {
      return;
    }
    
    const nextTierId = PARTICLE_TIERS[tierIndex + 1].id;
    
    // Forging rules:
    // - 100 small of tier N → 1 small of tier N+1
    // - 1 medium of tier N → 1 small of tier N+1 (since 1 medium = 100 small)
    // - 1 large of tier N → 100 small of tier N+1 (since 1 large = 10000 small = 100 medium)
    
    if (particle.sizeIndex === 0) {
      // Small particle: need 100 to forge
      const smallParticles = this.particles.filter(
        p => p.tierId === particle.tierId && p.sizeIndex === 0
      );
      
      if (smallParticles.length >= MERGE_THRESHOLD) {
        // Remove 100 small particles
        for (let i = 0; i < MERGE_THRESHOLD; i++) {
          this.removeParticle(smallParticles[i]);
        }
        // Add 1 small particle of next tier
        this.addParticle(nextTierId, 0);
      }
    } else if (particle.sizeIndex === 1) {
      // Medium particle: converts to 1 small of next tier
      this.removeParticle(particle);
      this.addParticle(nextTierId, 0);
    } else if (particle.sizeIndex === 2) {
      // Large particle: converts to 100 small of next tier
      this.removeParticle(particle);
      for (let i = 0; i < MERGE_THRESHOLD; i++) {
        this.addParticle(nextTierId, 0);
      }
    }
  }

  setupEventListeners() {
    // Support both mouse and touch events
    this.canvas.addEventListener('mousedown', this.handlePointerDown);
    this.canvas.addEventListener('mousemove', this.handlePointerMove);
    this.canvas.addEventListener('mouseup', this.handlePointerUp);
    this.canvas.addEventListener('mouseleave', this.handlePointerUp);
    
    this.canvas.addEventListener('touchstart', this.handlePointerDown, { passive: false });
    this.canvas.addEventListener('touchmove', this.handlePointerMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handlePointerUp);
    this.canvas.addEventListener('touchcancel', this.handlePointerUp);
  }

  removeEventListeners() {
    this.canvas.removeEventListener('mousedown', this.handlePointerDown);
    this.canvas.removeEventListener('mousemove', this.handlePointerMove);
    this.canvas.removeEventListener('mouseup', this.handlePointerUp);
    this.canvas.removeEventListener('mouseleave', this.handlePointerUp);
    
    this.canvas.removeEventListener('touchstart', this.handlePointerDown);
    this.canvas.removeEventListener('touchmove', this.handlePointerMove);
    this.canvas.removeEventListener('touchend', this.handlePointerUp);
    this.canvas.removeEventListener('touchcancel', this.handlePointerUp);
  }

  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (event.type.startsWith('touch')) {
      if (event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      } else {
        return null;
      }
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // Scale coordinates to canvas space (accounting for CSS scaling)
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  handlePointerDown(event) {
    event.preventDefault();
    
    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;
    
    this.isInteracting = true;
    this.mouseX = coords.x;
    this.mouseY = coords.y;
    
    // Add visual feedback circle
    this.interactionCircles.push({
      x: coords.x,
      y: coords.y,
      radius: INTERACTION_RADIUS,
      alpha: 0.5,
      timestamp: Date.now()
    });
    
    // Find and lock particles within interaction radius
    for (const particle of this.particles) {
      const dx = particle.x - coords.x;
      const dy = particle.y - coords.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= INTERACTION_RADIUS) {
        particle.lockedToMouse = true;
        particle.mouseTarget = { x: coords.x, y: coords.y };
      }
    }
  }

  handlePointerMove(event) {
    if (!this.isInteracting) return;
    
    event.preventDefault();
    
    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;
    
    this.mouseX = coords.x;
    this.mouseY = coords.y;
    
    // Update locked particles' target position
    for (const particle of this.particles) {
      if (particle.lockedToMouse) {
        particle.mouseTarget = { x: coords.x, y: coords.y };
      }
    }
  }

  handlePointerUp(event) {
    if (!this.isInteracting) return;
    
    this.isInteracting = false;
    
    // Release all locked particles
    for (const particle of this.particles) {
      particle.lockedToMouse = false;
      particle.mouseTarget = null;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.removeEventListeners();
  }

  animate() {
    if (!this.isRunning) return;
    
    // Create trail effect by drawing semi-transparent black over the canvas
    this.ctx.fillStyle = `rgba(0, 0, 0, ${TRAIL_FADE})`;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Update forge rotation
    this.forgeRotation += FORGE_ROTATION_SPEED;
    
    // Update spawner rotations so paired triangles spin in opposing directions like the central forge.
    this.spawnerRotations.forEach((rotation, tierId) => {
      this.spawnerRotations.set(tierId, rotation + SPAWNER_ROTATION_SPEED);
    });
    
    // Draw the forge (Star of David with counter-rotating triangles)
    this.drawForge();

    // Draw particle spawners for unlocked tiers
    this.drawSpawners();

    // Gather gravity sources for unlocked spawners so nearby particles feel a local pull.
    const activeSpawners = this.getActiveSpawnerGravityFields();
    
    // Draw and fade interaction circles
    const now = Date.now();
    this.interactionCircles = this.interactionCircles.filter(circle => {
      const elapsed = now - circle.timestamp;
      const progress = elapsed / INTERACTION_FADE_DURATION;
      
      if (progress >= 1) return false; // Remove faded circles
      
      // Draw fading circle
      const alpha = circle.alpha * (1 - progress);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      
      return true; // Keep circle for next frame
    });
    
    // Update and draw shockwaves
    this.shockwaves = this.shockwaves.filter(shockwave => {
      const elapsed = now - shockwave.timestamp;
      const progress = elapsed / SHOCKWAVE_DURATION;
      
      if (progress >= 1) return false; // Remove completed shockwaves
      
      // Expand shockwave radius
      shockwave.radius += SHOCKWAVE_EXPANSION_SPEED;
      
      // Fade out as it expands
      shockwave.alpha = 0.8 * (1 - progress);
      
      // Apply push force to nearby particles
      for (const particle of this.particles) {
        const dx = particle.x - shockwave.x;
        const dy = particle.y - shockwave.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if particle is near the shockwave edge (within a threshold)
        const edgeThreshold = 15; // Pixels from shockwave edge
        if (Math.abs(dist - shockwave.radius) < edgeThreshold && dist > 1) {
          // Push particle away from shockwave center
          const angle = Math.atan2(dy, dx);
          particle.vx += Math.cos(angle) * SHOCKWAVE_PUSH_FORCE;
          particle.vy += Math.sin(angle) * SHOCKWAVE_PUSH_FORCE;
        }
      }
      
      // Draw shockwave ring
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${shockwave.alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      
      return true; // Keep shockwave for next frame
    });
    
    // Update and draw particles
    for (const particle of this.particles) {
      particle.update(this.forge, activeSpawners);
      particle.draw(this.ctx);
    }
    
    // Periodically attempt to merge particles
    if (Math.random() < 0.01) { // 1% chance per frame
      this.attemptMerge();
    }
    
    // Periodically check for particle factor milestones
    if (Math.random() < 0.01) { // 1% chance per frame
      const glyphsAwarded = this.checkParticleFactorMilestone();
      if (glyphsAwarded > 0) {
        // Trigger an event or notification that glyphs were awarded
        const event = new CustomEvent('betGlyphsAwarded', { detail: { count: glyphsAwarded } });
        this.canvas.dispatchEvent(event);
      }
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  }

  drawForge() {
    const ctx = this.ctx;
    const forgeSize = 20; // Size of triangles
    
    ctx.save();
    ctx.translate(this.forge.x, this.forge.y);
    
    // Draw first triangle (pointing up, rotating clockwise)
    ctx.rotate(this.forgeRotation);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -forgeSize);
    ctx.lineTo(forgeSize * Math.cos(Math.PI / 6), forgeSize * Math.sin(Math.PI / 6));
    ctx.lineTo(-forgeSize * Math.cos(Math.PI / 6), forgeSize * Math.sin(Math.PI / 6));
    ctx.closePath();
    ctx.stroke();
    
    // Draw second triangle (pointing down, rotating counter-clockwise)
    ctx.rotate(-this.forgeRotation * 2); // Reset and rotate opposite direction
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, forgeSize);
    ctx.lineTo(forgeSize * Math.cos(Math.PI / 6), -forgeSize * Math.sin(Math.PI / 6));
    ctx.lineTo(-forgeSize * Math.cos(Math.PI / 6), -forgeSize * Math.sin(Math.PI / 6));
    ctx.closePath();
    ctx.stroke();
    
    // Draw center glow
    ctx.rotate(this.forgeRotation); // Rotate back to center
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, forgeSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, forgeSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  drawSpawners() {
    const ctx = this.ctx;
    
    // Draw a mini forge for each unlocked particle tier
    // Each tier is positioned at its corresponding generator position
    this.unlockedTiers.forEach((tierId) => {
      const tier = PARTICLE_TIERS.find(t => t.id === tierId);
      if (!tier) return;
      
      const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
      if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) return; // Safety check
      
      const position = SPAWNER_POSITIONS[tierIndex];
      const rotation = this.spawnerRotations.get(tierId) || 0;
      
      ctx.save();
      ctx.translate(position.x, position.y);
      
      // Create color string from tier color
      const color = tier.color;
      const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
      
      // Draw first triangle (pointing up, rotating clockwise)
      ctx.rotate(rotation);
      ctx.strokeStyle = colorString;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -SPAWNER_SIZE);
      ctx.lineTo(SPAWNER_SIZE * Math.cos(Math.PI / 6), SPAWNER_SIZE * Math.sin(Math.PI / 6));
      ctx.lineTo(-SPAWNER_SIZE * Math.cos(Math.PI / 6), SPAWNER_SIZE * Math.sin(Math.PI / 6));
      ctx.closePath();
      ctx.stroke();
      
      // Draw second triangle (pointing down, rotating counter-clockwise)
      ctx.rotate(-rotation * 2); // Reset and rotate opposite direction
      // Use slightly lighter/darker variant for second triangle
      const lightColorString = `rgba(${Math.min(255, color.r + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.g + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.b + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, 0.6)`;
      ctx.strokeStyle = lightColorString;
      ctx.beginPath();
      ctx.moveTo(0, SPAWNER_SIZE);
      ctx.lineTo(SPAWNER_SIZE * Math.cos(Math.PI / 6), -SPAWNER_SIZE * Math.sin(Math.PI / 6));
      ctx.lineTo(-SPAWNER_SIZE * Math.cos(Math.PI / 6), -SPAWNER_SIZE * Math.sin(Math.PI / 6));
      ctx.closePath();
      ctx.stroke();
      
      // Draw center glow with tier color
      ctx.rotate(rotation); // Rotate back to center
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, SPAWNER_SIZE);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, SPAWNER_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }

  getActiveSpawnerGravityFields() {
    // Collect unlocked spawner positions paired with their gravity reach so particles can orbit their origin tiers.
    const activeSpawners = [];

    this.unlockedTiers.forEach((tierId) => {
      const tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === tierId);
      if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) {
        return;
      }

      const position = SPAWNER_POSITIONS[tierIndex];
      activeSpawners.push({ x: position.x, y: position.y, range: SPAWNER_GRAVITY_RADIUS });
    });

    return activeSpawners;
  }

  resize() {
    // Canvas maintains fixed dimensions to match Aleph spire
    // The CSS will handle scaling to fit container
  }

  getPixelationScale() {
    return this.pixelationScale;
  }

  setPixelationLevel(level = 0) {
    const clamped = Math.max(0, Math.min(PIXELATION_SCALES.length - 1, Math.round(level)));
    this.pixelationLevel = clamped;
    this.pixelationScale = resolvePixelationScale(clamped);
    if (this.state) {
      this.state.pixelationLevel = clamped;
    }
    this.applyPixelationScale();
  }

  applyPixelationScale() {
    const scale = this.getPixelationScale();
    const targetWidth = Math.max(1, Math.floor(CANVAS_WIDTH * scale));
    const targetHeight = Math.max(1, Math.floor(CANVAS_HEIGHT * scale));

    if (this.canvas.width !== targetWidth) {
      this.canvas.width = targetWidth;
    }
    if (this.canvas.height !== targetHeight) {
      this.canvas.height = targetHeight;
    }

    if (this.ctx) {
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  /**
   * Calculate the Particle Factor by multiplying the number of particles from each tier.
   * If a tier has 0 particles, it contributes 1 to avoid zeroing out the entire factor.
   * This is the player's total score in the BET spire.
   */
  calculateParticleFactor() {
    let factor = 1;
    PARTICLE_TIERS.forEach(tier => {
      const count = this.inventory.get(tier.id) || 0;
      // Multiply by the count, but use 1 if count is 0 to avoid zero multiplication
      factor *= (count > 0 ? count : 1);
    });
    return factor;
  }

  /**
   * Check if the particle factor has reached a new milestone and award BET glyphs.
   * Returns the number of glyphs awarded this check (0 if no new milestone reached).
   */
  checkParticleFactorMilestone() {
    const currentFactor = this.calculateParticleFactor();
    let glyphsAwarded = 0;
    
    // Award glyphs for each 10x milestone reached
    while (currentFactor >= this.particleFactorMilestone) {
      glyphsAwarded++;
      this.betGlyphsAwarded++;
      this.particleFactorMilestone *= 10; // Next milestone is 10x higher
    }
    
    // Persist state changes
    if (glyphsAwarded > 0 && this.state) {
      this.state.betGlyphsAwarded = this.betGlyphsAwarded;
      this.state.particleFactorMilestone = this.particleFactorMilestone;
    }
    
    return glyphsAwarded;
  }

  /**
   * Get the current particle factor and milestone progress.
   */
  getParticleFactorStatus() {
    const currentFactor = this.calculateParticleFactor();
    return {
      particleFactor: currentFactor,
      currentMilestone: this.particleFactorMilestone,
      betGlyphsAwarded: this.betGlyphsAwarded,
      progressToNext: currentFactor / this.particleFactorMilestone,
    };
  }

  getInventory() {
    // Return a copy of the inventory map
    return new Map(this.inventory);
  }

  getInventoryDisplay() {
    // Return an array of tier information for display
    return PARTICLE_TIERS.map(tier => ({
      id: tier.id,
      name: tier.name,
      count: this.inventory.get(tier.id) || 0,
    }));
  }
}

// Initialize the Bet Spire render
let betSpireRenderInstance = null;

export function initBetSpireRender(state = {}) {
  const canvas = document.getElementById('bet-spire-canvas');
  if (!canvas) {
    console.warn('Bet Spire canvas element not found');
    return;
  }
  
  if (betSpireRenderInstance) {
    betSpireRenderInstance.stop();
  }
  
  betSpireRenderInstance = new BetSpireRender(canvas, state);
  betSpireRenderInstance.start();
  
  return betSpireRenderInstance;
}

export function stopBetSpireRender() {
  if (betSpireRenderInstance) {
    betSpireRenderInstance.stop();
  }
}

export function resumeBetSpireRender() {
  if (betSpireRenderInstance) {
    betSpireRenderInstance.start();
  }
}

export function getBetSpireRenderInstance() {
  return betSpireRenderInstance;
}

// Export tier definitions for use in other modules
export { PARTICLE_TIERS };
