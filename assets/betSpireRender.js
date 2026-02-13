// Bet Spire Particle Physics Render
// Tiered particle system with size merging at generator centers and tier conversion at the forge.

import { moteGemState, resolveGemDefinition } from './enemies.js';

// Pre-calculated Math constants for performance optimization in render loops
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const QUARTER_PI = Math.PI * 0.25;
const PI_OVER_SIX = Math.PI / 6;
const HALF = 0.5; // Pre-calculated reciprocal for multiplication instead of division by 2

// Canvas dimensions matching Aleph Spire render
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 320;

// Particle system configuration
const TRAIL_FADE = 0.15; // Lower = longer trails
const BASE_PARTICLE_SIZE = 0.75; // Base size for small particles (reduced from 1.5 to half size)
const SIZE_MULTIPLIER = 2.5; // Each size tier is 2.5x bigger
const EXTRA_LARGE_SIZE_BONUS = 1.5; // Extra-large particles are 50% larger than large.
const MIN_VELOCITY = 0.312; // Minimum speed to keep particles swirling (30% faster: 0.24 * 1.3 = 0.312)
const MAX_VELOCITY = 2;
const ATTRACTION_STRENGTH = 1.5; // Increased to keep particles within field (was 0.5)
const FORGE_RADIUS = 21; // Radius for forge attraction (30% smaller to tighten the forge well)
const MAX_FORGE_ATTRACTION_DISTANCE = FORGE_RADIUS * 2 * 0.9; // Particles only feel forge gravity when within twice the forge radius (decreased by 10%)
const DISTANCE_SCALE = 0.01; // Scale factor for distance calculations
const FORCE_SCALE = 0.01; // Scale factor for force application
const ORBITAL_FORCE = 0.15; // Increased tangential orbital force strength (was 0.1)
const ORBITAL_RADIUS_MULTIPLIER = 2; // Multiplier for orbital effect radius
const FORGE_REPULSION_DAMPING = 0.6; // Dampen outward push when particles slingshot past the forge
const FORGE_ROTATION_SPEED = 0.01; // Rotation speed for forge triangles (50% slower base spin).
const SPAWNER_GRAVITY_STRENGTH = 1.5; // Gentle attraction strength used by individual spawners.
const SPAWNER_GRAVITY_RANGE_MULTIPLIER = 4; // Spawner gravity now reaches four times its radius for a wider pull
const GENERATOR_CONVERSION_RADIUS = 16.5; // 10% larger radius for generator-centered conversions
const SMALL_TIER_GENERATOR_GRAVITY_STRENGTH = 0.24; // Extremely gentle pull that nudges small particles toward their generator.
const MEDIUM_TIER_FORGE_GRAVITY_STRENGTH = 0.15; // Extremely weak pull that guides medium particles toward the central forge.
const PARTICLE_FACTOR_EXPONENT_INCREMENT = 1e-7; // Each nullstone small-equivalent crunch increases the particle factor exponent.

// Performance optimization configuration
const MAX_PARTICLES = 2000; // Hard limit on total particle count to prevent freezing
const PERFORMANCE_THRESHOLD = 1500; // Start aggressive merging above this count
const MAX_FRAME_TIME_MS = 16; // Target 60fps, skip updates if frame takes longer
const TARGET_FRAME_TIME_MS = 1000 / 60; // Normalize physics updates so taps don't change simulation speed

// User interaction configuration
const INTERACTION_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 10; // Doubled from /20 to /10
const MOUSE_ATTRACTION_STRENGTH = 3.0;
const INTERACTION_FADE_DURATION = 300; // milliseconds for circle fade
const DRAG_RELEASE_STILLNESS_MS = 120; // Time threshold to consider the pointer held still before release.
const DRAG_RELEASE_SPEED_THRESHOLD = 0.02; // Velocity threshold (px/ms) to treat the release as stationary.

// Merge animation configuration
const MERGE_GATHER_SPEED = 10.0; // Faster gather speed so size merges keep up with higher spawn rates
const MERGE_GATHER_THRESHOLD = 2; // Distance threshold to consider particles gathered (pixels)
const MERGE_TIMEOUT_MS = 2000; // Maximum time for merge animation (milliseconds)
const SHOCKWAVE_SPEED = 3.0; // Speed at which shockwave expands
const SHOCKWAVE_MAX_RADIUS = 40; // Maximum shockwave radius
const SHOCKWAVE_DURATION = 500; // milliseconds for shockwave animation
const SHOCKWAVE_PUSH_FORCE = 2.5; // Force applied to nearby particles by shockwave
const SHOCKWAVE_EDGE_THICKNESS = 10; // Thickness of shockwave edge for force application (pixels)

// Forge position at center of canvas (using HALF constant for optimization)
const FORGE_POSITION = { x: CANVAS_WIDTH * HALF, y: CANVAS_HEIGHT * HALF };

// Particle spawner configuration (mini forges for each unlocked particle type)
const SPAWNER_SIZE = 8.8; // Size of spawner forge triangles (10% larger than before)
const SPAWNER_ROTATION_SPEED = 0.01; // Rotation speed for spawner triangles
const SPAWNER_COLOR_BRIGHTNESS_OFFSET = 30; // RGB offset for spawner triangle color variation
const SPAWNER_GRAVITY_RADIUS = SPAWNER_SIZE * SPAWNER_GRAVITY_RANGE_MULTIPLIER * 1.15; // Influence radius for each spawner (increased by 15%)
const GENERATOR_SPRITE_SCALE = 1.75; // Increase generator sprites by 75% for better legibility.
const SPAWNER_SPRITE_SIZE = SPAWNER_SIZE * 2.6 * GENERATOR_SPRITE_SCALE; // Scale generator sprites to match the previous triangle footprint.

// Particle veer behavior configuration (developer-toggleable).
const VEER_ANGLE_MIN_DEG = 0.1; // Minimum veer angle in degrees.
const VEER_ANGLE_MAX_DEG = 1; // Maximum veer angle in degrees.
const VEER_INTERVAL_MIN_MS = 100; // Minimum interval between veer nudges in milliseconds.
const VEER_INTERVAL_MAX_MS = 1000; // Maximum interval between veer nudges in milliseconds.

// Utility to generate a random number within an inclusive range.
const getRandomInRange = (min, max) => min + Math.random() * (max - min);
// Utility to create a tinted sprite canvas from a monochrome base image.
const createTintedSpriteCanvas = (sourceImage, color, size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const drawSize = size;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(sourceImage, 0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fillRect(0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(sourceImage, 0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
};

// Generator positions: sand at top center (12 o'clock), then 10 more in clockwise circle
// All 11 generators are equidistant from each other on a circle around the forge
const GENERATOR_CIRCLE_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.35; // Circle radius for generators
const SPAWNER_POSITIONS = Array.from({ length: 11 }, (_, i) => {
  // Start at top (12 o'clock = -90 degrees), then proceed clockwise (using pre-calculated constants)
  const angle = -HALF_PI + (i * TWO_PI / 11);
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

// Size tiers: small, medium, large, extra-large.
const SIZE_TIERS = ['small', 'medium', 'large', 'extra-large'];
const SMALL_SIZE_INDEX = 0;
const MEDIUM_SIZE_INDEX = 1;
const LARGE_SIZE_INDEX = 2;
const EXTRA_LARGE_SIZE_INDEX = 3;
const MERGE_THRESHOLD = 100; // 100 particles merge into 1 of next size
const SIZE_SMALL_EQUIVALENTS = [
  1,
  MERGE_THRESHOLD,
  Math.pow(MERGE_THRESHOLD, 2),
  Math.pow(MERGE_THRESHOLD, 3)
]; // Map size index to its small-particle equivalent for nullstone crunch gains.
const SIZE_SCALE_MULTIPLIERS = [
  1.0,
  SIZE_MULTIPLIER,
  SIZE_MULTIPLIER * SIZE_MULTIPLIER,
  SIZE_MULTIPLIER * SIZE_MULTIPLIER * EXTRA_LARGE_SIZE_BONUS
]; // Match size tiers while keeping extra-large at +50% over large.
const SIZE_MIN_VELOCITY_MODIFIERS = [1.0, 0.8, 0.64, 0.15]; // Extra-large keeps a low minimum drift speed.
const SIZE_MAX_VELOCITY_MODIFIERS = [1.0, 0.85, 0.7, 1.6]; // Extra-large can reach high top speeds.
// Force modifiers scale how strongly particles respond to pulls; extra-large is intentionally sluggish.
const SIZE_FORCE_MODIFIERS = [1.0, 0.85, 0.7, 0.12]; // Extra-large resists drag to feel heavy.
const CONVERSION_SPREAD_VELOCITY = 3; // Velocity multiplier for spreading converted particles

// Particle class with tier and size
class Particle {
  constructor(tierId = 'sand', sizeIndex = 0, spawnPosition = null) {
    // Spawn at generator position if provided, otherwise at random location
    if (spawnPosition) {
      const spawnAngle = Math.random() * TWO_PI; // Jitter the spawn angle so particles cluster near the generator center (using pre-calculated constant)
      const spawnRadius = Math.random() * 3; // Keep new particles close to the generator so they stay within its influence.
      this.x = spawnPosition.x + Math.cos(spawnAngle) * spawnRadius;
      this.y = spawnPosition.y + Math.sin(spawnAngle) * spawnRadius;
      this.vx = 0; // Spawn particles at rest so they start centered before gravity nudges them outward.
      this.vy = 0; // Keep initial velocity zero to avoid launching particles outside the generator field.
    } else {
      this.x = Math.random() * CANVAS_WIDTH;
      this.y = Math.random() * CANVAS_HEIGHT;
      this.vx = (Math.random() - 0.5);
      this.vy = (Math.random() - 0.5);
    }
    
    // Tier and size properties
    this.tierId = tierId;
    this.sizeIndex = sizeIndex; // 0 = small, 1 = medium, 2 = large, 3 = extra-large
    
    // Cache tier reference and color strings for performance
    this._tier = PARTICLE_TIERS.find(t => t.id === tierId) || PARTICLE_TIERS[0];
    // Cache the tier index so generator-only speed scaling can reference the tier number.
    this._tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === this._tier.id);
    this._colorString = `rgba(${this._tier.color.r}, ${this._tier.color.g}, ${this._tier.color.b}, 0.9)`;
    this._glowColorString = this._tier.glowColor 
      ? `rgba(${this._tier.glowColor.r}, ${this._tier.glowColor.g}, ${this._tier.glowColor.b}, 0.8)`
      : null;
    this._size = BASE_PARTICLE_SIZE * (SIZE_SCALE_MULTIPLIERS[sizeIndex] || 1.0);
    this._minVelocityModifier = SIZE_MIN_VELOCITY_MODIFIERS[sizeIndex] || 1.0;
    this._maxVelocityModifier = SIZE_MAX_VELOCITY_MODIFIERS[sizeIndex] || 1.0;
    // Cache force scaling so extra-large particles resist pulls with massive inertia.
    this._forceModifier = SIZE_FORCE_MODIFIERS[sizeIndex] || 1.0;
    this._maxVelocity = MAX_VELOCITY * this._maxVelocityModifier;
    this._minVelocity = MIN_VELOCITY * this._minVelocityModifier;

    // Track when this particle should apply its next random veer adjustment.
    this.nextVeerTime = performance.now() + getRandomInRange(VEER_INTERVAL_MIN_MS, VEER_INTERVAL_MAX_MS);
    
    this.lockedToMouse = false; // Whether particle is locked to mouse/touch
    this.mouseTarget = null; // Target position when locked to mouse
    this.merging = false; // Whether particle is being merged
    this.mergeTarget = null; // Target position during merge animation
  }

  getTier() {
    return this._tier;
  }

  getSizeName() {
    return SIZE_TIERS[this.sizeIndex] || 'small';
  }

  getSize() {
    return this._size;
  }

  update(
    forge,
    spawners = [],
    deltaFrameRatio = 1,
    now = Date.now(),
    veerEnabled = false,
    smallTierGravityEnabled = false,
    mediumTierGravityEnabled = false
  ) {
    // Track whether the particle is inside its generator's gravity field for velocity clamping.
    let isInsideGeneratorField = false;
    // Guard against invalid delta ratios so taps can't destabilize the integrator.
    const clampedDelta = Math.max(deltaFrameRatio, 0.01);

    // If particle is merging, fly to merge target at high speed with a swirl effect
    if (this.merging && this.mergeTarget) {
      const dx = this.mergeTarget.x - this.x;
      const dy = this.mergeTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const angle = Math.atan2(dy, dx);
        const gatherSpeed = MERGE_GATHER_SPEED * clampedDelta;
        
        // Add tangential (perpendicular) velocity for swirl effect
        // The swirl gets stronger as particles get closer to the target
        const swirl_strength = 0.3 * (1 - Math.min(dist / 50, 1)); // Stronger when closer
        const tangentAngle = angle + HALF_PI; // Perpendicular to radial direction (using pre-calculated constant)
        
        // Combine radial (toward target) and tangential (swirl) velocities
        this.vx = Math.cos(angle) * gatherSpeed + Math.cos(tangentAngle) * swirl_strength * gatherSpeed;
        this.vy = Math.sin(angle) * gatherSpeed + Math.sin(tangentAngle) * swirl_strength * gatherSpeed;
      } else {
        // Reached target, zero velocity
        this.vx = 0;
        this.vy = 0;
      }
    }
    // If locked to mouse, strongly attract to mouse position
    else if (this.lockedToMouse && this.mouseTarget) {
      const dx = this.mouseTarget.x - this.x;
      const dy = this.mouseTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        // Scale drag attraction so extra-large particles are far harder to pull.
        const force = MOUSE_ATTRACTION_STRENGTH * this._forceModifier;
        const angle = Math.atan2(dy, dx);
        this.vx += Math.cos(angle) * force * clampedDelta;
        this.vy += Math.sin(angle) * force * clampedDelta;
      } else {
        // Very close to target, dampen velocity
        const damping = Math.pow(0.8, clampedDelta);
        this.vx *= damping;
        this.vy *= damping;
      }
    } else {
      // Extra-large particles ignore generator pull so they only drift toward the forge.
      if (this.sizeIndex !== EXTRA_LARGE_SIZE_INDEX) {
        // Apply gravity from each unlocked spawner within its local field so particles stay near their forge of origin.
        for (const spawner of spawners) {
          // Only attract particles to their matching generator tier.
          if (spawner.tierId !== this.tierId) {
            continue;
          }
          const dx = spawner.x - this.x;
          const dy = spawner.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= spawner.range && dist > 0.5) {
            // Record that the particle is inside its generator field so we can cap its top speed there.
            isInsideGeneratorField = true;
            // Scale generator gravity by size so heavier particles accelerate more slowly.
            const force = (SPAWNER_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
            this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
          }

          // Apply an additional, extremely gentle pull for small particles toward their matching generator.
          if (smallTierGravityEnabled && this.sizeIndex === SMALL_SIZE_INDEX && dist > 0.5) {
            // Scale the small-tier gravity nudge by size inertia as well.
            const force = (SMALL_TIER_GENERATOR_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
            this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
          }
        }
      }

      // Normal forge attractor behavior
      const dx = forge.x - this.x;
      const dy = forge.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Apply attraction force (inverse square law simplified) only while within the localized forge gravity well.
      // Let nullstone drift into the forge at any size so single particles can still be crunched.
      const isForgeAttractable = this.sizeIndex >= MEDIUM_SIZE_INDEX || this.tierId === 'nullstone';
      // Extra-large and nullstone particles should feel the forge pull across the entire basin so crunches can trigger reliably.
      const forgeAttractionRange = (this.sizeIndex === EXTRA_LARGE_SIZE_INDEX || this.tierId === 'nullstone')
        ? Number.POSITIVE_INFINITY
        : MAX_FORGE_ATTRACTION_DISTANCE;
      if (isForgeAttractable && dist <= forgeAttractionRange) {
        const angle = Math.atan2(dy, dx);
        if (dist > 1) {
          // Scale forge attraction by size so extra-large particles resist the forge pull.
          const force = (ATTRACTION_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
          this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
          this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
        }
        // Forge now attracts particles toward center like generators do (removed orbital spin behavior)
      }

      // Apply an additional, extremely weak pull for medium particles toward the central forge.
      if (mediumTierGravityEnabled && this.sizeIndex === MEDIUM_SIZE_INDEX && dist > 0.5) {
        const angle = Math.atan2(dy, dx);
        // Scale medium-tier gravity to keep inertia consistent across sizes.
        const force = (MEDIUM_TIER_FORGE_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
        this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
        this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
      }
    }
    
    // Apply a subtle randomized veer to the velocity vector when enabled.
    if (veerEnabled && !this.merging && !this.lockedToMouse && now >= this.nextVeerTime) {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0) {
        const veerDegrees = getRandomInRange(VEER_ANGLE_MIN_DEG, VEER_ANGLE_MAX_DEG);
        const veerAngle = (veerDegrees * Math.PI) / 180;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const rotation = veerAngle * direction;
        const cosTheta = Math.cos(rotation);
        const sinTheta = Math.sin(rotation);
        const rotatedVx = this.vx * cosTheta - this.vy * sinTheta;
        const rotatedVy = this.vx * sinTheta + this.vy * cosTheta;
        this.vx = rotatedVx;
        this.vy = rotatedVy;
      }
      this.nextVeerTime = now + getRandomInRange(VEER_INTERVAL_MIN_MS, VEER_INTERVAL_MAX_MS);
    }

    // Limit velocity with size-based modifier
    const maxVelocity = this._maxVelocity;
    // Match generator-field minimum speed to the particle tier number so each type has constant motion near its own spawner.
    const generatorMinVelocity = this._minVelocity * Math.max(1, this._tierIndex + 1);
    const minVelocity = isInsideGeneratorField ? generatorMinVelocity : this._minVelocity;
    
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    // Clamp speed based on whether the particle is caught in its generator gravity field.
    const generatorMaxVelocity = generatorMinVelocity * 5;
    // Reduce the generator field speed cap by 10% so particles drift more gently near their spawner.
    const generatorVelocityCap = generatorMaxVelocity * 0.9;
    const allowedMaxVelocity = isInsideGeneratorField ? Math.min(maxVelocity, generatorVelocityCap) : maxVelocity;
    if (speed > allowedMaxVelocity) {
      this.vx = (this.vx / speed) * allowedMaxVelocity;
      this.vy = (this.vy / speed) * allowedMaxVelocity;
    }
    
    // Enforce minimum velocity to keep particles always moving
    if (speed < minVelocity && speed > 0) {
      this.vx = (this.vx / speed) * minVelocity;
      this.vy = (this.vy / speed) * minVelocity;
    } else if (speed === 0) {
      // Give particles a random initial velocity if they're stopped
      const randomAngle = Math.random() * TWO_PI; // Use pre-calculated constant
      this.vx = Math.cos(randomAngle) * minVelocity;
      this.vy = Math.sin(randomAngle) * minVelocity;
    }
    
    // Update position
    this.x += this.vx * clampedDelta;
    this.y += this.vy * clampedDelta;
    
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
    return this._colorString;
  }

  // Return a stable key that groups particles by draw style so the renderer can batch fill calls efficiently.
  getDrawStyleKey() {
    return `${this._colorString}|${this._glowColorString || 'no-glow'}|${this._size}`;
  }

  // Provide the cached draw style so the renderer can set canvas state once per bucket instead of per particle.
  getDrawStyle() {
    return {
      colorString: this._colorString,
      glowColorString: this._glowColorString,
      size: this._size,
    };
  }

  // Reset particle velocity to the minimum swirl speed when a drag is released without movement.
  applyMinimumReleaseVelocity() {
    const minVelocity = this._minVelocity;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

    if (speed > 0) {
      this.vx = (this.vx / speed) * minVelocity;
      this.vy = (this.vy / speed) * minVelocity;
    } else {
      const randomAngle = Math.random() * TWO_PI; // Use pre-calculated constant
      this.vx = Math.cos(randomAngle) * minVelocity;
      this.vy = Math.sin(randomAngle) * minVelocity;
    }
  }

  draw(ctx) {
    const size = this._size;
    const halfSize = size * HALF; // Use pre-calculated HALF constant for optimization
    
    // Draw particle
    ctx.fillStyle = this._colorString;
    
    // If tier has a glow, add shadow effect
    if (this._glowColorString) {
      ctx.shadowBlur = size * 3;
      ctx.shadowColor = this._glowColorString;
    } else {
      ctx.shadowBlur = 0;
    }
    
    ctx.fillRect(
      Math.floor(this.x - halfSize),
      Math.floor(this.y - halfSize),
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
    this.lastFrameTime = performance.now(); // Anchor delta time so physics stays frame-rate independent
    
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
    
    // Track generator fade-in animations (tierId -> {startTime, duration})
    this.generatorFadeIns = new Map();
    const GENERATOR_FADE_IN_DURATION = 2000; // 2 seconds fade-in
    this.GENERATOR_FADE_IN_DURATION = GENERATOR_FADE_IN_DURATION;
    
    // Particle Factor tracking for BET glyph awards - load from state or use defaults
    this.particleFactorMilestone = Number.isFinite(state.particleFactorMilestone) 
      ? state.particleFactorMilestone 
      : 100; // Start at 100, then 10,000, 1,000,000, etc.
    this.betGlyphsAwarded = Number.isFinite(state.betGlyphsAwarded)
      ? state.betGlyphsAwarded
      : 0;
    // Track the exponent bonus granted by nullstone crunches so particle factor scales upward over time.
    this.particleFactorExponentBonus = Number.isFinite(state.particleFactorExponentBonus)
      ? state.particleFactorExponentBonus
      : 0;

    // Keep manual interactions enabled for particle gathering visuals while blocking manual spawning.
    this.interactionsEnabled = true;
    
    // Visual settings that control rendering effects
    this.particleTrailsEnabled = true; // Controls whether particles leave trails
    this.forgeGlowEnabled = true; // Controls whether forge and generators have glow effects
    this.smoothRenderingEnabled = true; // Controls whether rendering is smooth (anti-aliased) or pixelated
    this.particleVeerEnabled = true; // Developer toggle for subtle randomized particle veer behavior
    this.smallTierGeneratorGravityEnabled = true; // Developer toggle for extra small particle pull toward generators.
    this.mediumTierForgeGravityEnabled = true; // Developer toggle for extra medium particle pull toward the forge.

    // Load the center forge sprites so the counter-rotating triangles use the authored artwork.
    this.forgeSpriteClockwise = new Image();
    this.forgeSpriteClockwise.src = './assets/sprites/spires/betSpire/forge.png';
    this.forgeSpriteCounterClockwise = new Image();
    this.forgeSpriteCounterClockwise.src = './assets/sprites/spires/betSpire/forge2.png';

    // Cache tinted generator sprites so we only colorize them once per tier.
    this.generatorSpriteCache = new Map();
    this.generatorSpriteSources = new Map();
    // Load generator sprite sources for each tier so they can be tinted and cached on load.
    PARTICLE_TIERS.forEach((tier, index) => {
      const sprite = new Image();
      sprite.src = `./assets/sprites/spires/betSpire/generators/tier${index + 1}.svg`;
      sprite.onload = () => {
        this.cacheGeneratorSpritesForTier(tier.id, sprite);
      };
      this.generatorSpriteSources.set(tier.id, sprite);
    });
    
    // Developer debug flags (only visible when developer mode is active)
    this.particleSpawningEnabled = true; // Controls whether particles can spawn
    this.particleMergingEnabled = true; // Controls whether particles can merge (size increases)
    this.particlePromotionEnabled = true; // Controls whether particles can promote to higher tier
    this.mergeShockwavesEnabled = false; // Controls whether merge shockwaves push nearby particles.
    
    // Store state reference for persistence
    this.state = state;
    
    // Mouse/touch interaction state
    this.isInteracting = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.interactionCircles = []; // Array of {x, y, radius, alpha, timestamp}
    this.lastPointerMoveTime = 0; // Timestamp of the last pointer movement for drag-release velocity checks.
    this.lastPointerPosition = null; // Tracks the last pointer coordinates for drag-release velocity checks.
    this.lastPointerSpeed = 0; // Cached pointer speed for drag-release velocity checks.
    
    // Merge animation state
    this.activeMerges = []; // Array of {particles, targetX, targetY, tierId, sizeIndex, startTime}
    this.shockwaves = []; // Array of {x, y, radius, alpha, timestamp, color}
    
    // Spawn queue for gradual particle restoration on load
    this.spawnQueue = [];
    this.spawnQueueIndex = 0;

    // Track frame progression so merge attempts can throttle themselves between frames.
    this.frameCounter = 0;
    this.mergeCooldownFrames = 0; // Prevents back-to-back merge launches in the same frame
    
    // Forge crunch effect state
    this.forgeValidParticlesTimer = null; // Timestamp when valid particles first entered forge
    this.forgeCrunchActive = false; // Whether crunch animation is active
    this.forgeCrunchProgress = 0; // Progress of crunch animation (0 to 1)
    this.forgeCrunchStartTime = null; // When crunch animation started
    this.forgeCrunchEndTime = null; // When crunch animation ended
    const FORGE_CRUNCH_DURATION = 1000; // Duration of crunch animation in ms
    const FORGE_VALID_WAIT_TIME = 5000; // Wait 5 seconds before crunching
    const FORGE_SPIN_UP_DURATION = 4000; // 4 seconds to spin up before crunch
    const FORGE_SPIN_DOWN_DURATION = 3000; // 3 seconds to slow down after crunch
    this.FORGE_CRUNCH_DURATION = FORGE_CRUNCH_DURATION;
    this.FORGE_VALID_WAIT_TIME = FORGE_VALID_WAIT_TIME;
    this.FORGE_SPIN_UP_DURATION = FORGE_SPIN_UP_DURATION;
    this.FORGE_SPIN_DOWN_DURATION = FORGE_SPIN_DOWN_DURATION;
    
    // Track gems awarded from forge crunches for floating feedback display
    this.crunchGemAwards = []; // Array of {tierId, count, startTime}
    
    // Bind methods for requestAnimationFrame and event listeners
    this.animate = this.animate.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Set canvas dimensions
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    // Initialize with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Restore particles from saved state if available
    if (state.particlesByTierAndSize) {
      this.restoreParticleState(state.particlesByTierAndSize);
    } else {
      // Seed the simulation with a level 1 sand generator so it begins active without user input.
      this.addParticle('sand', SMALL_SIZE_INDEX);
    }

    // Set up event listeners
    this.setupEventListeners();
  }

  addParticle(tierId, sizeIndex) {
    // Skip spawning if disabled via developer controls
    if (!this.particleSpawningEnabled) {
      return;
    }
    
    // Enforce maximum particle limit to prevent freezing
    if (this.particles.length >= MAX_PARTICLES) {
      // Try to consolidate particles instead of adding new ones
      this.enforceParticleLimit();
      // If still at limit after consolidation, don't add
      if (this.particles.length >= MAX_PARTICLES) {
        return;
      }
    }
    
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
        this.spawnerRotations.set(tierId, Math.random() * TWO_PI); // Use pre-calculated constant
      }
      
      // Start fade-in animation for the newly unlocked generator
      this.generatorFadeIns.set(tierId, {
        startTime: Date.now(),
        duration: this.GENERATOR_FADE_IN_DURATION
      });
    }
    
    this.updateInventory();
  }

  // Optional skipInventoryUpdate flag lets batch operations defer expensive recounts until they finish.
  removeParticle(particle, skipInventoryUpdate = false) {
    const index = this.particles.indexOf(particle);
    if (index !== -1) {
      this.particles.splice(index, 1);
      if (!skipInventoryUpdate) {
        this.updateInventory();
      }
    }
  }

  /**
   * Remove a specific number of particles of a given tier.
   * Removes small particles first, then converts medium/large/extra-large if needed.
   * Returns the number of particles actually removed (in small equivalent units).
   */
  removeParticlesByType(tierId, count) {
    let remaining = count;
    const particlesToRemove = new Set();
    
    // First, remove small particles.
    const smallParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === SMALL_SIZE_INDEX);
    const smallToRemove = Math.min(smallParticles.length, remaining);
    for (let i = 0; i < smallToRemove; i++) {
      particlesToRemove.add(smallParticles[i]);
    }
    remaining -= smallToRemove;
    
    // If we need more, convert medium particles (1 medium = 100 small).
    if (remaining > 0) {
      const mediumParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === MEDIUM_SIZE_INDEX);
      while (remaining > 0 && mediumParticles.length > 0) {
        const mediumParticle = mediumParticles.pop();
        particlesToRemove.add(mediumParticle);
        
        // Add back small particles if we removed more than needed
        const mediumValue = MERGE_THRESHOLD; // 100 small
        if (remaining < mediumValue) {
          const changeBack = mediumValue - remaining;
          for (let i = 0; i < changeBack; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= mediumValue;
        }
      }
    }
    
    // If we still need more, convert large particles (1 large = 10000 small).
    if (remaining > 0) {
      const largeParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === LARGE_SIZE_INDEX);
      while (remaining > 0 && largeParticles.length > 0) {
        const largeParticle = largeParticles.pop();
        particlesToRemove.add(largeParticle);
        
        // Add back particles if we removed more than needed
        const largeValue = Math.pow(MERGE_THRESHOLD, 2); // 10000 small
        if (remaining < largeValue) {
          const changeBack = largeValue - remaining;
          // Add back as medium and small particles
          const mediumsToAdd = Math.floor(changeBack / MERGE_THRESHOLD);
          const smallsToAdd = changeBack % MERGE_THRESHOLD;
          for (let i = 0; i < mediumsToAdd; i++) {
            this.addParticle(tierId, MEDIUM_SIZE_INDEX);
          }
          for (let i = 0; i < smallsToAdd; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= largeValue;
        }
      }
    }

    // If we still need more, convert extra-large particles (1 extra-large = 1,000,000 small).
    if (remaining > 0) {
      const extraLargeParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === EXTRA_LARGE_SIZE_INDEX);
      while (remaining > 0 && extraLargeParticles.length > 0) {
        const extraLargeParticle = extraLargeParticles.pop();
        particlesToRemove.add(extraLargeParticle);

        // Add back particles if we removed more than needed.
        const extraLargeValue = Math.pow(MERGE_THRESHOLD, 3); // 1,000,000 small
        if (remaining < extraLargeValue) {
          const changeBack = extraLargeValue - remaining;
          // Add back as large, medium, and small particles.
          const largesToAdd = Math.floor(changeBack / Math.pow(MERGE_THRESHOLD, 2));
          const remainingAfterLarge = changeBack - (largesToAdd * Math.pow(MERGE_THRESHOLD, 2));
          const mediumsToAdd = Math.floor(remainingAfterLarge / MERGE_THRESHOLD);
          const smallsToAdd = remainingAfterLarge - (mediumsToAdd * MERGE_THRESHOLD);
          for (let i = 0; i < largesToAdd; i++) {
            this.addParticle(tierId, LARGE_SIZE_INDEX);
          }
          for (let i = 0; i < mediumsToAdd; i++) {
            this.addParticle(tierId, MEDIUM_SIZE_INDEX);
          }
          for (let i = 0; i < smallsToAdd; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= extraLargeValue;
        }
      }
    }
    
    // Batch remove all marked particles (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }
    
    this.updateInventory();
    return count - remaining; // Return how many we actually removed
  }

  updateInventory() {
    // Clear inventory
    this.inventory.forEach((_, key) => {
      this.inventory.set(key, 0);
    });
    
    // Count particles by tier (combining all sizes using conversion rules).
    this.particles.forEach(particle => {
      const tierId = particle.tierId;
      const sizeIndex = particle.sizeIndex;
      
      // Convert to small particle equivalent.
      // 1 medium = 100 small, 1 large = 10,000 small, 1 extra-large = 1,000,000 small.
      const smallEquivalent = Math.pow(MERGE_THRESHOLD, sizeIndex);
      const currentCount = this.inventory.get(tierId) || 0;
      this.inventory.set(tierId, currentCount + smallEquivalent);
    });
  }

  // Determine whether a new merge can begin without violating the one-at-a-time rule.
  canStartNewMerge() {
    return this.activeMerges.length === 0 && this.mergeCooldownFrames === 0;
  }

  // Select a random subset of particles without mutating the source collection.
  selectRandomParticles(group, count) {
    const pool = group.slice();
    const selected = [];
    const targetCount = Math.min(count, pool.length);

    for (let i = 0; i < targetCount; i++) {
      const index = Math.floor(Math.random() * pool.length);
      selected.push(pool[index]);
      pool.splice(index, 1);
    }

    return selected;
  }

  // Resolve the generator center position for a given particle tier.
  getGeneratorCenterForTier(tierId) {
    const tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === tierId);
    if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) {
      return null;
    }
    return SPAWNER_POSITIONS[tierIndex];
  }

  /**
   * Enforce particle limit by aggressively merging small particles when count is too high.
   * This prevents freezing when there are too many particles.
   */
  enforceParticleLimit() {
    // If under threshold, no action needed
    if (this.particles.length < PERFORMANCE_THRESHOLD) {
      return;
    }

    // Group small particles by tier, only if they are in the generator center.
    const smallParticlesByTier = new Map();
    
    this.particles.forEach(particle => {
      if (particle.sizeIndex === SMALL_SIZE_INDEX && !particle.merging) {
        const generatorCenter = this.getGeneratorCenterForTier(particle.tierId);
        if (!generatorCenter) {
          return;
        }
        const dx = particle.x - generatorCenter.x;
        const dy = particle.y - generatorCenter.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > GENERATOR_CONVERSION_RADIUS * GENERATOR_CONVERSION_RADIUS) {
          return;
        }
        const tierId = particle.tierId;
        if (!smallParticlesByTier.has(tierId)) {
          smallParticlesByTier.set(tierId, []);
        }
        smallParticlesByTier.get(tierId).push(particle);
      }
    });

    // Collect all particles to remove for efficient batch removal
    const particlesToRemove = new Set();

    // Aggressively merge small particles in groups of MERGE_THRESHOLD
    smallParticlesByTier.forEach((group, tierId) => {
      while (group.length >= MERGE_THRESHOLD && this.particles.length > PERFORMANCE_THRESHOLD) {
        // Take MERGE_THRESHOLD particles and convert them instantly to one medium particle
        const particlesToMerge = group.splice(0, MERGE_THRESHOLD);
        
        // Use generator center so size merges only happen at the generator core.
        const generatorCenter = this.getGeneratorCenterForTier(tierId);
        if (!generatorCenter) {
          return;
        }
        
        // Mark particles for batch removal
        particlesToMerge.forEach(p => {
          particlesToRemove.add(p);
        });
        
        // Create one medium particle instantly (no animation)
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
        const spawnPos = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
          ? SPAWNER_POSITIONS[tierIndex] 
          : null;
        
        const mediumParticle = new Particle(tierId, MEDIUM_SIZE_INDEX, spawnPos);
        mediumParticle.x = generatorCenter.x;
        mediumParticle.y = generatorCenter.y;
        this.particles.push(mediumParticle);
      }
    });

    // Batch remove all marked particles (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }

    this.updateInventory();
  }

  // Attempt to merge particles of the same tier and size (100 small → 1 medium, 100 medium → 1 large, 100 large → 1 extra-large)
  // This can happen anywhere on the screen
  attemptMerge() {
    // Skip merging if disabled via developer controls
    if (!this.particleMergingEnabled || !this.canStartNewMerge()) {
      return;
    }

    const particlesByTierAndSize = new Map();

    // Group particles by tier and size, but only when they are within generator centers.
    this.particles.forEach(particle => {
      // Skip particles that are already merging
      if (particle.merging) return;

      // Require the particle to be close to its generator center before merging.
      const generatorCenter = this.getGeneratorCenterForTier(particle.tierId);
      if (!generatorCenter) {
        return;
      }
      const dx = particle.x - generatorCenter.x;
      const dy = particle.y - generatorCenter.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > GENERATOR_CONVERSION_RADIUS * GENERATOR_CONVERSION_RADIUS) {
        return;
      }
      
      const key = `${particle.tierId}-${particle.sizeIndex}`;
      if (!particlesByTierAndSize.has(key)) {
        particlesByTierAndSize.set(key, []);
      }
      particlesByTierAndSize.get(key).push(particle);
    });

    // Identify all eligible merge candidates so one can be chosen at random.
    const mergeCandidates = [];

    // Check each group for merging
    particlesByTierAndSize.forEach((group, key) => {
      if (group.length >= MERGE_THRESHOLD) {
        const [tierId, sizeIndexStr] = key.split('-');
        const sizeIndex = parseInt(sizeIndexStr, 10);

        // Can only merge if not already at max size
        if (sizeIndex < SIZE_TIERS.length - 1) {
          mergeCandidates.push({ tierId, sizeIndex, group });
        }
      }
    });

    if (mergeCandidates.length === 0) {
      return;
    }

    // Pick one candidate group and one random batch within that group to merge this frame.
    const selectedCandidate = mergeCandidates[Math.floor(Math.random() * mergeCandidates.length)];
    const particlesToMerge = this.selectRandomParticles(selectedCandidate.group, MERGE_THRESHOLD);

    // Use the generator center so size merges happen at the generator core.
    const generatorCenter = this.getGeneratorCenterForTier(selectedCandidate.tierId);
    if (!generatorCenter) {
      return;
    }

    // Mark particles as merging and set their target
    particlesToMerge.forEach(p => {
      p.merging = true;
      p.mergeTarget = { x: generatorCenter.x, y: generatorCenter.y };
    });

    // Create a merge animation entry
    this.activeMerges.push({
      particles: particlesToMerge,
      targetX: generatorCenter.x,
      targetY: generatorCenter.y,
      tierId: selectedCandidate.tierId,
      sizeIndex: selectedCandidate.sizeIndex + 1, // Next size tier
      startTime: Date.now()
      // No isTierConversion flag means this is a size merge
    });
  }

  // Attempt to convert extra-large particles to two tiers up at the forge (center).
  // Forge promotions now yield 1 large particle two tiers higher.
  attemptTierConversion() {
    // Skip tier conversion if disabled via developer controls
    if (!this.particlePromotionEnabled || !this.canStartNewMerge()) {
      return;
    }

    // Only allow forge promotions during an active crunch effect so tiers advance on crunches only.
    if (!this.forgeCrunchActive) {
      return;
    }

    const conversionCandidates = [];

    // Group particles by their tier, checking if they're at the forge (center) position.
    PARTICLE_TIERS.forEach((tier, tierIndex) => {
      // Can't convert the last two tiers when we need a two-tier jump.
      if (tierIndex >= PARTICLE_TIERS.length - 2) return;

      // Select the tier two steps above the current tier for forge promotions.
      const nextTier = PARTICLE_TIERS[tierIndex + 2];

      this.particles.forEach(particle => {
        if (particle.tierId !== tier.id || particle.merging) return;

        // Check if particle is within conversion radius of the forge (center)
        const dx = particle.x - this.forge.x;
        const dy = particle.y - this.forge.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= GENERATOR_CONVERSION_RADIUS) {
          if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
            // Always convert into a single large particle for the two-tier forge jump.
            const conversionCount = 1;
            conversionCandidates.push({
              particle,
              nextTierId: nextTier.id,
              conversionCount,
            });
          }
        }
      });
    });

    if (conversionCandidates.length === 0) {
      return;
    }

    // Convert a single candidate so forge promotions also respect the one-at-a-time merge pacing.
    const selectedConversion = conversionCandidates[Math.floor(Math.random() * conversionCandidates.length)];
    const particle = selectedConversion.particle;

    // Mark as merging and attract to forge center
    particle.merging = true;
    particle.mergeTarget = { x: this.forge.x, y: this.forge.y };

    // Create conversion animation
    this.activeMerges.push({
      particles: [particle],
      targetX: this.forge.x,
      targetY: this.forge.y,
      tierId: selectedConversion.nextTierId,
      sizeIndex: LARGE_SIZE_INDEX, // Large particle output for forge jumps.
      startTime: Date.now(),
      isTierConversion: true,
      conversionCount: selectedConversion.conversionCount
    });
  }

  // Check for valid particles in the forge and handle crunch effect
  checkForgeCreunch(now) {
    // Skip if promotion is disabled
    if (!this.particlePromotionEnabled) {
      this.forgeValidParticlesTimer = null;
      return;
    }

    // If crunch is already active, don't check for new valid particles
    if (this.forgeCrunchActive) {
      return;
    }

    // Find extra-large particles within forge radius that can be upgraded.
    const validParticles = [];
    
    PARTICLE_TIERS.forEach((tier, tierIndex) => {
      const isNullstone = tier.id === 'nullstone';
      
      this.particles.forEach(particle => {
        if (particle.tierId !== tier.id || particle.merging) return;
        
        // Only medium, large, and extra-large particles can be upgraded; nullstone can be crunched at any size.
        if (!isNullstone
          && particle.sizeIndex !== MEDIUM_SIZE_INDEX
          && particle.sizeIndex !== LARGE_SIZE_INDEX
          && particle.sizeIndex !== EXTRA_LARGE_SIZE_INDEX) return;
        
        // Check tier conversion limits based on particle size
        if (!isNullstone) {
          if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
            // Extra-large particles jump 2 tiers, so can't convert last two tiers
            if (tierIndex >= PARTICLE_TIERS.length - 2) return;
          } else if (particle.sizeIndex === MEDIUM_SIZE_INDEX || particle.sizeIndex === LARGE_SIZE_INDEX) {
            // Medium/large particles jump 1 tier, so can't convert last tier
            if (tierIndex >= PARTICLE_TIERS.length - 1) return;
          }
        }
        
        // Check if particle is within forge radius
        const dx = particle.x - this.forge.x;
        const dy = particle.y - this.forge.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= FORGE_RADIUS) {
          validParticles.push(particle);
        }
      });
    });

    // If there are valid particles, start or continue the timer
    if (validParticles.length > 0) {
      if (!this.forgeValidParticlesTimer) {
        this.forgeValidParticlesTimer = now;
      } else {
        // Check if 5 seconds have passed
        const elapsed = now - this.forgeValidParticlesTimer;
        if (elapsed >= this.FORGE_VALID_WAIT_TIME) {
          // Start the crunch animation
          this.startForgeCrunch(validParticles, now);
        }
      }
    } else {
      // No valid particles, reset timer
      this.forgeValidParticlesTimer = null;
    }
  }

  // Start the forge crunch animation and mark particles for upgrade
  startForgeCrunch(validParticles, now) {
    this.forgeCrunchActive = true;
    this.forgeCrunchStartTime = now;
    this.forgeCrunchProgress = 0;
    
    // Mark all valid particles for upgrade and attract them to forge center
    validParticles.forEach(particle => {
      particle.merging = true;
      particle.mergeTarget = { x: this.forge.x, y: this.forge.y };
      particle.forgeCrunchParticle = true; // Mark for crunch upgrade
    });
    
    // Reset the timer
    this.forgeValidParticlesTimer = null;
  }

  // Update the forge crunch animation
  updateForgeCrunch(now) {
    if (!this.forgeCrunchActive) return;

    const elapsed = now - this.forgeCrunchStartTime;
    this.forgeCrunchProgress = Math.min(elapsed / this.FORGE_CRUNCH_DURATION, 1);

    // When animation completes, upgrade all marked particles
    if (this.forgeCrunchProgress >= 1) {
      this.completeForgeCrunch();
    }
  }

  // Scale the forge spin through three phases:
  // 1. Spin up for 4 seconds before crunch (when valid particles are present)
  // 2. Maximum speed during crunch (1 second)
  // 3. Spin down for 3 seconds after crunch
  getForgeRotationSpeedMultiplier(now) {
    // Phase 3: Spin-down after crunch completes
    if (this.forgeCrunchEndTime) {
      const timeSinceEnd = now - this.forgeCrunchEndTime;
      if (timeSinceEnd < this.FORGE_SPIN_DOWN_DURATION) {
        // Ease out from 3x back to 1x over 3 seconds
        const progress = timeSinceEnd / this.FORGE_SPIN_DOWN_DURATION;
        const easeOut = 1 - Math.pow(1 - progress, 2); // Quadratic ease-out
        return 3 - (2 * easeOut); // Goes from 3 to 1
      } else {
        // Spin-down complete
        this.forgeCrunchEndTime = null;
        return 1;
      }
    }

    // Phase 2: During crunch - maintain maximum speed
    if (this.forgeCrunchActive) {
      return 3;
    }

    // Phase 1: Spin-up when valid particles are waiting
    if (this.forgeValidParticlesTimer) {
      const elapsed = now - this.forgeValidParticlesTimer;
      // Start spinning up in the last 4 seconds before crunch
      const timeUntilCrunch = this.FORGE_VALID_WAIT_TIME - elapsed;
      if (timeUntilCrunch <= this.FORGE_SPIN_UP_DURATION) {
        // Ease in from 1x to 3x over 4 seconds
        const spinUpElapsed = this.FORGE_SPIN_UP_DURATION - timeUntilCrunch;
        const progress = spinUpElapsed / this.FORGE_SPIN_UP_DURATION;
        const easeIn = progress * progress; // Quadratic ease-in
        return 1 + (2 * easeIn); // Goes from 1 to 3
      }
    }

    // No special state - base speed
    return 1;
  }

  // Translate a particle size into its small-equivalent count for nullstone crunch rewards.
  getSmallEquivalentForSize(sizeIndex) {
    return SIZE_SMALL_EQUIVALENTS[sizeIndex] || 1;
  }

  // Complete the forge crunch and upgrade particles
  completeForgeCrunch() {
    // Find all particles marked for crunch upgrade
    const crunchParticles = this.particles.filter(p => p.forgeCrunchParticle && p.merging);

    // Separate nullstone crunches so they can boost the particle factor exponent.
    const nullstoneParticles = [];
    let nullstoneSmallEquivalent = 0;
    
    // Group by tier for tier conversion
    const particlesByTier = new Map();
    crunchParticles.forEach(particle => {
      if (particle.tierId === 'nullstone') {
        nullstoneParticles.push(particle);
        nullstoneSmallEquivalent += this.getSmallEquivalentForSize(particle.sizeIndex);
        return;
      }
      if (!particlesByTier.has(particle.tierId)) {
        particlesByTier.set(particle.tierId, []);
      }
      particlesByTier.get(particle.tierId).push(particle);
    });

    // Track gems to award for floating feedback
    const gemsToAward = new Map(); // tierId -> count

    // Convert particles based on their size: medium particles jump 1 tier, extra-large jump 2 tiers.
    particlesByTier.forEach((particles, tierId) => {
      const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
      if (tierIndex < 0) return;
      
      particles.forEach(particle => {
        // Determine conversion based on particle size
        let targetTierIndex;
        let outputSizeIndex;
        let targetTierId;
        
        if (particle.sizeIndex === MEDIUM_SIZE_INDEX) {
          // Medium particles: jump 1 tier up and output small particles
          targetTierIndex = tierIndex + 1;
          outputSizeIndex = SMALL_SIZE_INDEX;
          
          // Check if we can upgrade (not at the last tier)
          if (targetTierIndex >= PARTICLE_TIERS.length) return;
          targetTierId = PARTICLE_TIERS[targetTierIndex].id;
        } else if (particle.sizeIndex === LARGE_SIZE_INDEX) {
          // Large particles: jump 1 tier up and output medium particles.
          targetTierIndex = tierIndex + 1;
          outputSizeIndex = MEDIUM_SIZE_INDEX;

          // Check if we can upgrade (not at the last tier)
          if (targetTierIndex >= PARTICLE_TIERS.length) return;
          targetTierId = PARTICLE_TIERS[targetTierIndex].id;
        } else if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
          // Extra-large particles: jump 2 tiers up and output large particles
          targetTierIndex = tierIndex + 2;
          outputSizeIndex = LARGE_SIZE_INDEX;
          
          // Check if we can upgrade (not at the last two tiers)
          if (targetTierIndex >= PARTICLE_TIERS.length) return;
          targetTierId = PARTICLE_TIERS[targetTierIndex].id;
          
          // Award 1 gem per extra-large particle crushed.
          const gemDefinition = resolveGemDefinition(targetTierId);
          
          if (gemDefinition) {
            // Add to player's gem inventory
            const record = moteGemState.inventory.get(targetTierId) || {
              label: gemDefinition.name,
              total: 0,
              count: 0,
            };
            record.total += 1;
            record.count = (record.count || 0) + 1;
            record.label = gemDefinition.name || record.label;
            moteGemState.inventory.set(targetTierId, record);
            
            // Track for floating feedback display
            gemsToAward.set(targetTierId, (gemsToAward.get(targetTierId) || 0) + 1);
          }
        } else {
          // Other sizes should not reach here, but skip them if they do
          return;
        }
        
        // Create conversion animation entry for the tier jump.
        const conversionCount = 1;
        
        this.activeMerges.push({
          particles: [particle],
          targetX: this.forge.x,
          targetY: this.forge.y,
          tierId: targetTierId,
          sizeIndex: outputSizeIndex,
          startTime: Date.now(),
          isTierConversion: true,
          conversionCount: conversionCount
        });
      });
    });

    // Add gem awards to floating feedback queue
    if (gemsToAward.size > 0) {
      const now = Date.now();
      gemsToAward.forEach((count, tierId) => {
        this.crunchGemAwards.push({
          tierId,
          count,
          startTime: now,
        });
      });
    }

    if (nullstoneParticles.length > 0) {
      // Remove nullstone crunch particles since they do not convert into higher tiers.
      this.particles = this.particles.filter(p => !nullstoneParticles.includes(p));
    }

    if (nullstoneSmallEquivalent > 0) {
      // Apply the nullstone exponent gain and persist it to the spire state.
      this.particleFactorExponentBonus += nullstoneSmallEquivalent * PARTICLE_FACTOR_EXPONENT_INCREMENT;
      if (this.state) {
        this.state.particleFactorExponentBonus = this.particleFactorExponentBonus;
      }
    }

    if (nullstoneParticles.length > 0) {
      // Refresh inventory totals so nullstone crunches immediately reflect in the UI.
      this.updateInventory();
    }

    // Reset crunch state and mark end time for spin-down
    this.forgeCrunchActive = false;
    this.forgeCrunchProgress = 0;
    this.forgeCrunchStartTime = null;
    this.forgeCrunchEndTime = Date.now(); // Track when crunch ended for spin-down
  }

  // Draw the forge crunch effect (shrinking circle)
  drawForgeCrunch() {
    if (!this.forgeCrunchActive) return;

    const ctx = this.ctx;
    
    // Calculate current radius (starts at FORGE_RADIUS, shrinks to 0)
    const currentRadius = FORGE_RADIUS * (1 - this.forgeCrunchProgress);
    
    // Calculate alpha (goes from 0 to 0.8 to 0)
    // Peak at middle of animation
    const alphaCurve = Math.sin(this.forgeCrunchProgress * Math.PI);
    const alpha = alphaCurve * 0.8;
    
    // Draw shrinking circle
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.forge.x, this.forge.y, currentRadius, 0, TWO_PI); // Use pre-calculated constant
    ctx.stroke();
    
    // Draw inner glow
    ctx.strokeStyle = `rgba(200, 200, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.forge.x, this.forge.y, currentRadius, 0, TWO_PI); // Use pre-calculated constant
    ctx.stroke();
  }

  // Draw floating gem award notifications in top-left corner
  drawCrunchGemAwards(now) {
    if (!this.crunchGemAwards || this.crunchGemAwards.length === 0) {
      return;
    }

    const ctx = this.ctx;
    const AWARD_DURATION_MS = 2000; // 2 seconds total
    const AWARD_FADE_IN_MS = 200; // Fade in over 200ms
    const AWARD_FADE_OUT_START_MS = 1500; // Start fading out at 1.5s
    const AWARD_FLOAT_DISTANCE = 40; // Float upward 40px
    const AWARD_STACK_SPACING = 30; // Vertical spacing between awards
    const START_X = 20; // Left margin
    const START_Y = 30; // Top margin

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Update and render each award
    for (let i = this.crunchGemAwards.length - 1; i >= 0; i--) {
      const award = this.crunchGemAwards[i];
      const elapsed = now - award.startTime;

      // Remove expired awards
      if (elapsed >= AWARD_DURATION_MS) {
        this.crunchGemAwards.splice(i, 1);
        continue;
      }

      // Calculate animation progress
      const progress = elapsed / AWARD_DURATION_MS;
      const yOffset = progress * AWARD_FLOAT_DISTANCE;
      const stackOffset = i * AWARD_STACK_SPACING;

      // Calculate opacity with fade in and fade out
      let opacity = 1;
      if (elapsed < AWARD_FADE_IN_MS) {
        opacity = elapsed / AWARD_FADE_IN_MS;
      } else if (elapsed > AWARD_FADE_OUT_START_MS) {
        const fadeOutElapsed = elapsed - AWARD_FADE_OUT_START_MS;
        const fadeOutDuration = AWARD_DURATION_MS - AWARD_FADE_OUT_START_MS;
        opacity = 1 - (fadeOutElapsed / fadeOutDuration);
      }

      // Calculate current position
      const currentY = START_Y + stackOffset - yOffset;

      // Get gem definition
      const gemDefinition = resolveGemDefinition(award.tierId);
      if (!gemDefinition) {
        continue;
      }

      // Get tier color for fallback
      const tier = PARTICLE_TIERS.find(t => t.id === award.tierId);
      const color = tier ? tier.color : { r: 255, g: 215, b: 100 };

      // Draw the award text with icon
      const fontSize = 16;
      const iconSize = 18;
      const spacing = 6;

      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      const text = `+${award.count}`;
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;

      // Draw drop shadow for better visibility
      ctx.globalAlpha = opacity * 0.4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(text, START_X + 2, currentY + 2);

      // Draw text
      ctx.globalAlpha = opacity;
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, START_X, currentY);
      ctx.fillText(text, START_X, currentY);

      // Draw gem icon (simple diamond shape as fallback)
      const halfIconSize = iconSize * HALF; // Pre-calculate for optimization
      const iconX = START_X + textWidth + spacing + halfIconSize;
      const iconY = currentY;

      ctx.globalAlpha = opacity;
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - halfIconSize);
      ctx.lineTo(iconX + halfIconSize, iconY);
      ctx.lineTo(iconX, iconY + halfIconSize);
      ctx.lineTo(iconX - halfIconSize, iconY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // Attempt to merge large particles to next tier (performance optimization)
  // When 100 large particles of the same tier exist, convert them to 10 large particles of the next tier
  // This can happen anywhere on the screen to reduce particle count for better performance
  attemptLargeTierMerge() {
    // Skip tier merging if promotion is disabled via developer controls
    if (!this.particlePromotionEnabled || !this.canStartNewMerge()) {
      return;
    }

    const largeParticlesByTier = new Map();

    // Group large particles by tier anywhere on screen
    this.particles.forEach(particle => {
      // Skip particles that are already merging
      if (particle.merging) return;
      
      // Only consider large particles
      if (particle.sizeIndex !== LARGE_SIZE_INDEX) return;
      
      const tierId = particle.tierId;
      if (!largeParticlesByTier.has(tierId)) {
        largeParticlesByTier.set(tierId, []);
      }
      largeParticlesByTier.get(tierId).push(particle);
    });

    const mergeCandidates = [];

    // Check each tier group for bulk conversion and queue up potential merges.
    largeParticlesByTier.forEach((group, tierId) => {
      if (group.length >= MERGE_THRESHOLD) {
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);

        // Can only convert if not already at max tier
        if (tierIndex >= 0 && tierIndex < PARTICLE_TIERS.length - 1) {
          const nextTier = PARTICLE_TIERS[tierIndex + 1];
          mergeCandidates.push({ group, nextTier });
        }
      }
    });

    if (mergeCandidates.length === 0) {
      return;
    }

    // Select one candidate to process this frame so large-tier merges remain serialized.
    const selectedCandidate = mergeCandidates[Math.floor(Math.random() * mergeCandidates.length)];
    const particlesToMerge = this.selectRandomParticles(selectedCandidate.group, MERGE_THRESHOLD);

    // Calculate center point of the particles to merge
    let centerX = 0;
    let centerY = 0;

    particlesToMerge.forEach(p => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= particlesToMerge.length;
    centerY /= particlesToMerge.length;

    // Mark particles as merging and set their target
    particlesToMerge.forEach(p => {
      p.merging = true;
      p.mergeTarget = { x: centerX, y: centerY };
    });

    // Create a merge animation entry that converts 100 large to 10 large of next tier
    this.activeMerges.push({
      particles: particlesToMerge,
      targetX: centerX,
      targetY: centerY,
      tierId: selectedCandidate.nextTier.id,
      sizeIndex: LARGE_SIZE_INDEX, // Large particles
      startTime: Date.now(),
      isTierConversion: true,
      conversionCount: 10 // 10 large particles of next tier
    });
  }

  // Process active merges and check if particles have gathered
  processActiveMerges() {
    const now = Date.now();
    let anyMergeCompleted = false; // Track if any merge completed to defer inventory update
    const particlesToRemove = new Set(); // Collect all particles to remove for efficient batch removal
    
    this.activeMerges = this.activeMerges.filter(merge => {
      // Check if all particles in the merge have reached the target
      const allGathered = merge.particles.every(p => {
        const dx = p.x - merge.targetX;
        const dy = p.y - merge.targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < MERGE_GATHER_THRESHOLD;
      });
      
      if (allGathered || (now - merge.startTime > MERGE_TIMEOUT_MS)) { // Complete after timeout
        // Mark particles for batch removal (much more efficient than removing one by one)
        merge.particles.forEach(p => {
          particlesToRemove.add(p);
        });
        
        // Calculate spawn position once (used by both size merges and tier conversions)
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === merge.tierId);
        const spawnPos = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
          ? SPAWNER_POSITIONS[tierIndex] 
          : null;
        
        // Handle tier conversion differently from size merges
        if (merge.isTierConversion) {
          // Tier conversion: create particles of next tier
          const conversionCount = merge.conversionCount || 1;
          
          // Performance optimization: If we're at high particle count, directly create
          // medium particles instead of 100 small ones
          if (this.particles.length > PERFORMANCE_THRESHOLD && conversionCount === 100) {
            // Create 1 medium particle instead of 100 small particles
            const newParticle = new Particle(merge.tierId, MEDIUM_SIZE_INDEX, spawnPos);
            newParticle.x = merge.targetX;
            newParticle.y = merge.targetY;
            // Add slight random velocity
            newParticle.vx = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
            newParticle.vy = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
            this.particles.push(newParticle);
          } else {
            // Normal behavior: create multiple particles with spread
            // Limit creation if approaching MAX_PARTICLES
            const maxToCreate = Math.min(conversionCount, MAX_PARTICLES - this.particles.length);
            
            for (let i = 0; i < maxToCreate; i++) {
              const newParticle = new Particle(merge.tierId, merge.sizeIndex, spawnPos);
              newParticle.x = merge.targetX;
              newParticle.y = merge.targetY;
              // Add slight random velocity to spread out converted particles
              newParticle.vx = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
              newParticle.vy = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
              this.particles.push(newParticle);
            }
          }
        } else {
          // Size merge: create one particle of next size
          const newParticle = new Particle(merge.tierId, merge.sizeIndex, spawnPos);
          newParticle.x = merge.targetX;
          newParticle.y = merge.targetY;
          this.particles.push(newParticle);
        }
        
        // Unlock the tier if needed
        if (!this.unlockedTiers.has(merge.tierId)) {
          this.unlockedTiers.add(merge.tierId);
          if (!this.spawnerRotations.has(merge.tierId)) {
            this.spawnerRotations.set(merge.tierId, Math.random() * TWO_PI); // Use pre-calculated constant
          }
          
          // Start fade-in animation for the newly unlocked generator
          this.generatorFadeIns.set(merge.tierId, {
            startTime: Date.now(),
            duration: this.GENERATOR_FADE_IN_DURATION
          });
        }
        
        // Mark that a merge completed (defer inventory update until after all merges processed)
        anyMergeCompleted = true;
        
        // Create shockwave for size merges (not for tier conversions)
        // Tier conversions use the "crunch" effect instead
        const tier = PARTICLE_TIERS.find(t => t.id === merge.tierId) || PARTICLE_TIERS[0];
        const isSizeMerge = !merge.isTierConversion;
        if (this.mergeShockwavesEnabled && isSizeMerge) {
          // Emit a shockwave ring for all size merges (small->medium and medium->large)
          this.shockwaves.push({
            x: merge.targetX,
            y: merge.targetY,
            radius: 0,
            alpha: 0.8,
            timestamp: now,
            color: tier.color
          });
        }
        
        // This merge is complete
        return false;
      }
      
      // Keep this merge active
      return true;
    });

    // Batch remove all particles marked for removal (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }

    // Update inventory once after processing all merges (performance optimization)
    if (anyMergeCompleted) {
      // Enforce a one-frame delay before the next merge begins to keep animations serialized.
      this.mergeCooldownFrames = Math.max(this.mergeCooldownFrames, 1);
      this.updateInventory();
    }
  }

  setupEventListeners() {
    if (!this.interactionsEnabled) {
      return;
    }

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

  spawnSandParticleAtEdge(tapCoords) {
    // Determine which edge is closest to the tap location
    const distToTop = tapCoords.y;
    const distToBottom = CANVAS_HEIGHT - tapCoords.y;
    const distToLeft = tapCoords.x;
    const distToRight = CANVAS_WIDTH - tapCoords.x;
    
    const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
    
    let spawnX, spawnY;
    
    if (minDist === distToTop) {
      // Spawn at top edge
      spawnX = tapCoords.x;
      spawnY = 0;
    } else if (minDist === distToBottom) {
      // Spawn at bottom edge
      spawnX = tapCoords.x;
      spawnY = CANVAS_HEIGHT;
    } else if (minDist === distToLeft) {
      // Spawn at left edge
      spawnX = 0;
      spawnY = tapCoords.y;
    } else {
      // Spawn at right edge
      spawnX = CANVAS_WIDTH;
      spawnY = tapCoords.y;
    }
    
    // Create a sand particle at the edge location
    const particle = new Particle('sand', 0, null);
    particle.x = spawnX;
    particle.y = spawnY;
    this.particles.push(particle);
    
    // Unlock sand tier if needed (should already be unlocked, but ensure it)
    if (!this.unlockedTiers.has('sand')) {
      this.unlockedTiers.add('sand');
      if (!this.spawnerRotations.has('sand')) {
        this.spawnerRotations.set('sand', Math.random() * TWO_PI); // Use pre-calculated constant
      }
    }
    
    this.updateInventory();
  }

  handlePointerDown(event) {
    if (!this.interactionsEnabled) return;

    event.preventDefault();

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;
    
    this.isInteracting = true;
    this.mouseX = coords.x;
    this.mouseY = coords.y;
    // Seed pointer movement tracking so release velocity can be clamped.
    this.lastPointerMoveTime = Date.now();
    this.lastPointerPosition = { x: coords.x, y: coords.y };
    this.lastPointerSpeed = 0;
    
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
    if (!this.interactionsEnabled) return;

    if (!this.isInteracting) return;
    
    event.preventDefault();
    
    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;
    
    this.mouseX = coords.x;
    this.mouseY = coords.y;
    // Track pointer velocity so stationary drags can release at minimum speed.
    const now = Date.now();
    if (this.lastPointerPosition) {
      const dx = coords.x - this.lastPointerPosition.x;
      const dy = coords.y - this.lastPointerPosition.y;
      const deltaTime = Math.max(now - this.lastPointerMoveTime, 1);
      this.lastPointerSpeed = Math.sqrt(dx * dx + dy * dy) / deltaTime;
    }
    this.lastPointerMoveTime = now;
    this.lastPointerPosition = { x: coords.x, y: coords.y };
    
    // Update locked particles' target position
    for (const particle of this.particles) {
      if (particle.lockedToMouse) {
        particle.mouseTarget = { x: coords.x, y: coords.y };
      }
    }
  }

  handlePointerUp(event) {
    if (!this.interactionsEnabled) return;

    if (!this.isInteracting) return;
    
    this.isInteracting = false;
    // Detect stationary drags so particles settle to minimum velocity on release.
    const now = Date.now();
    const timeSinceMove = now - this.lastPointerMoveTime;
    const shouldClampRelease = timeSinceMove > DRAG_RELEASE_STILLNESS_MS
      || this.lastPointerSpeed < DRAG_RELEASE_SPEED_THRESHOLD;
    
    // Release all locked particles
    for (const particle of this.particles) {
      if (particle.lockedToMouse && shouldClampRelease) {
        // Clamp velocity so stationary releases don't launch particles at high speed.
        particle.applyMinimumReleaseVelocity();
      }
      particle.lockedToMouse = false;
      particle.mouseTarget = null;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now(); // Reset delta baseline whenever the loop restarts
    this.setupEventListeners(); // Re-attach event listeners when resuming
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

    // Track frame progression so merge attempts can insert a one-frame pause between batches.
    this.frameCounter += 1;
    if (this.mergeCooldownFrames > 0) {
      this.mergeCooldownFrames -= 1; // Count down the inter-merge cooldown
    }

    const frameStartTime = performance.now(); // Track frame start time for performance monitoring
    const deltaTimeMs = Math.min(frameStartTime - this.lastFrameTime, MAX_FRAME_TIME_MS * 4); // Clamp to avoid huge catch-up steps
    const deltaFrameRatio = deltaTimeMs / TARGET_FRAME_TIME_MS || 1; // Scale motion relative to 60fps baseline
    this.lastFrameTime = frameStartTime;
    const now = Date.now(); // Track current time for animations
    
    // Apply smooth rendering setting
    this.ctx.imageSmoothingEnabled = this.smoothRenderingEnabled;
    
    // Create trail effect by drawing semi-transparent black over the canvas
    // If trails are disabled, draw fully opaque black to clear the canvas completely
    const trailFade = this.particleTrailsEnabled ? TRAIL_FADE : 1.0;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${trailFade})`;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Update spawner rotations so paired triangles spin in opposing directions like the central forge.
    this.spawnerRotations.forEach((rotation, tierId) => {
      this.spawnerRotations.set(tierId, rotation + SPAWNER_ROTATION_SPEED * deltaFrameRatio);
    });

    // Check for forge crunch effect (valid particles for 5 seconds)
    this.checkForgeCreunch(now);
    
    // Update forge crunch animation
    this.updateForgeCrunch(now);

    // Accelerate forge spin during crunches so the animation ramps up and down.
    const forgeRotationMultiplier = this.getForgeRotationSpeedMultiplier(now);
    this.forgeRotation += FORGE_ROTATION_SPEED * forgeRotationMultiplier * deltaFrameRatio;
    
    // Draw the forge (Star of David with counter-rotating triangles)
    this.drawForge();
    
    // Draw forge influence ring
    this.drawForgeInfluenceRing();

    // Draw particle spawners for unlocked tiers
    this.drawSpawners();
    
    // Draw forge crunch effect
    this.drawForgeCrunch();
    
    // Draw gem awards from forge crunches
    this.drawCrunchGemAwards(now);

    // Gather gravity sources for unlocked spawners so nearby particles feel a local pull.
    const activeSpawners = this.getActiveSpawnerGravityFields();
    
    // Process spawn queue for gradual particle restoration
    this.processSpawnQueue();
    
    // Process active merges
    this.processActiveMerges();
    
    // Apply shockwave forces and draw shockwaves
    if (this.mergeShockwavesEnabled) {
      // Apply shockwave forces and draw shockwaves while merge bursts are enabled.
      this.shockwaves = this.shockwaves.filter(shockwave => {
      const elapsed = now - shockwave.timestamp;
      const progress = elapsed / SHOCKWAVE_DURATION;
      
      if (progress >= 1) return false; // Remove completed shockwaves
      
      // Expand shockwave radius
      shockwave.radius = SHOCKWAVE_MAX_RADIUS * progress;
      shockwave.alpha = 0.8 * (1 - progress);
      
      // Performance optimization: Calculate maximum distance a particle can be from shockwave
      // to be affected by its force. Includes SHOCKWAVE_EDGE_THICKNESS because particles
      // within this distance from the expanding edge receive push force.
      // Only check particles within this range to avoid O(shockwaves × all_particles).
      const maxEffectDistance = SHOCKWAVE_MAX_RADIUS + SHOCKWAVE_EDGE_THICKNESS;
      
      // Apply push force to nearby particles
      for (const particle of this.particles) {
        // Skip particles that are merging
        if (particle.merging) continue;
        
        const dx = particle.x - shockwave.x;
        const dy = particle.y - shockwave.y;
        
        // Early bailout: Skip particles that are too far from shockwave center
        // This reduces complexity from O(all_particles) to O(nearby_particles)
        const distSquared = dx * dx + dy * dy;
        if (distSquared > maxEffectDistance * maxEffectDistance) continue;
        
        const dist = Math.sqrt(distSquared);
        
        // Apply force if particle is near the expanding shockwave edge
        if (Math.abs(dist - shockwave.radius) < SHOCKWAVE_EDGE_THICKNESS && dist > 0) {
          const angle = Math.atan2(dy, dx);
          const force = SHOCKWAVE_PUSH_FORCE * (1 - progress); // Force diminishes over time
          particle.vx += Math.cos(angle) * force;
          particle.vy += Math.sin(angle) * force;
        }
      }
      
      // Draw shockwave ring
      const color = shockwave.color;
      this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${shockwave.alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, TWO_PI); // Use pre-calculated constant
      this.ctx.stroke();
      
      return true; // Keep shockwave for next frame
      });
    } else if (this.shockwaves.length > 0) {
      // Clear shockwaves immediately when merge bursts are disabled.
      this.shockwaves = [];
    }
    
    // Draw and fade interaction circles
    this.interactionCircles = this.interactionCircles.filter(circle => {
      const elapsed = now - circle.timestamp;
      const progress = elapsed / INTERACTION_FADE_DURATION;
      
      if (progress >= 1) return false; // Remove faded circles
      
      // Draw fading circle
      const alpha = circle.alpha * (1 - progress);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius, 0, TWO_PI); // Use pre-calculated constant
      this.ctx.stroke();
      
      return true; // Keep circle for next frame
    });
    
    // Performance optimization: When particle count is high, reduce update frequency
    const isHighParticleCount = this.particles.length > PERFORMANCE_THRESHOLD;
    const updateInterval = isHighParticleCount ? 2 : 1; // Update every 2nd frame when high
    
    // Bucket particles by draw style so canvas state only changes a handful of times even with thousands of particles.
    const drawBuckets = new Map();

    // Update particles and collect their draw intents
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // When performance is stressed, only update every nth particle per frame
      if (!isHighParticleCount || i % updateInterval === (now % updateInterval)) {
        // Pass developer toggles so particle updates can apply optional gravity behaviors.
        particle.update(
          this.forge,
          activeSpawners,
          deltaFrameRatio,
          now,
          this.particleVeerEnabled,
          this.smallTierGeneratorGravityEnabled,
          this.mediumTierForgeGravityEnabled
        );
      }

      const styleKey = particle.getDrawStyleKey();
      if (!drawBuckets.has(styleKey)) {
        drawBuckets.set(styleKey, { style: particle.getDrawStyle(), positions: [] });
      }

      const bucket = drawBuckets.get(styleKey);
      bucket.positions.push({ x: particle.x, y: particle.y });
    }

    // Draw each bucket in a single fill pass to minimize expensive shadow/style switches.
    this.drawBatchedParticles(drawBuckets);
    
    // Periodically attempt to merge particles (size merging)
    // Increase merge frequency when particle count is high
    const mergeChance = isHighParticleCount ? 0.1 : 0.03; // Faster size merges to keep up with higher spawn rates
    if (Math.random() < mergeChance) {
      this.attemptMerge();
    }
    
    // Periodically attempt tier conversion at generators
    if (Math.random() < 0.01) { // 1% chance per frame
      this.attemptTierConversion();
    }
    
    // Periodically attempt large particle tier merging for performance (100 large → 10 large of next tier)
    // More frequent when particle count is high
    const largeMergeChance = isHighParticleCount ? 0.05 : 0.01;
    if (Math.random() < largeMergeChance) {
      this.attemptLargeTierMerge();
    }
    
    // Enforce particle limit periodically
    if (isHighParticleCount && Math.random() < 0.1) { // 10% chance when high count
      this.enforceParticleLimit();
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
    
    // Track frame time for performance monitoring
    const frameTime = performance.now() - frameStartTime;
    if (frameTime > MAX_FRAME_TIME_MS * 2) {
      // If frame took too long (more than 2x target), log warning
      console.warn(`Bet Spire frame took ${frameTime.toFixed(2)}ms with ${this.particles.length} particles`);
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  }

  // Batch particle draw calls by style so canvas state (fill, shadow) changes happen at most once per tier-size combo.
  drawBatchedParticles(drawBuckets) {
    const ctx = this.ctx;

    drawBuckets.forEach(({ style, positions }) => {
      const halfSize = style.size * HALF; // Use pre-calculated HALF constant
      const drawSize = Math.ceil(style.size);

      ctx.fillStyle = style.colorString;

      if (style.glowColorString) {
        ctx.shadowBlur = style.size * 3;
        ctx.shadowColor = style.glowColorString;
      } else {
        ctx.shadowBlur = 0;
      }

      positions.forEach(({ x, y }) => {
        ctx.fillRect(
          Math.floor(x - halfSize),
          Math.floor(y - halfSize),
          drawSize,
          drawSize
        );
      });
    });

    ctx.shadowBlur = 0; // Reset so later draws are unaffected by any glow buckets.
  }

  // Cache a pair of tinted generator sprites (clockwise/counter) for a tier so coloring happens once.
  cacheGeneratorSpritesForTier(tierId, sourceImage) {
    const tier = PARTICLE_TIERS.find(entry => entry.id === tierId);
    if (!tier) {
      return;
    }

    const baseColor = tier.color;
    const brighterColor = {
      r: Math.min(255, baseColor.r + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
      g: Math.min(255, baseColor.g + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
      b: Math.min(255, baseColor.b + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
    };
    const spriteSize = Math.ceil(SPAWNER_SPRITE_SIZE);

    this.generatorSpriteCache.set(tierId, {
      clockwise: createTintedSpriteCanvas(sourceImage, baseColor, spriteSize),
      counterClockwise: createTintedSpriteCanvas(sourceImage, brighterColor, spriteSize),
      size: spriteSize,
    });
  }

  drawForge() {
    const ctx = this.ctx;
    const forgeSize = 36; // Size of triangles (50% larger so the forge sprites read clearly).
    const forgeSpriteSize = forgeSize * 2; // Scale sprites to match the existing triangle footprint.
    const halfForgeSpriteSize = forgeSpriteSize * HALF; // Pre-calculate half size for optimization
    const forgeSpriteReady = this.forgeSpriteClockwise.complete && this.forgeSpriteClockwise.naturalWidth > 0;
    const forgeCounterSpriteReady = this.forgeSpriteCounterClockwise.complete && this.forgeSpriteCounterClockwise.naturalWidth > 0;
    const forgeSpriteOpacity = 0.5; // Keep the center forge sprites at 50% opacity.
    
    ctx.save();
    ctx.translate(this.forge.x, this.forge.y);
    
    // Draw second triangle first (pointing down, rotating counter-clockwise) - forge2.png renders in back
    ctx.rotate(-this.forgeRotation);
    if (forgeCounterSpriteReady) {
      // Draw the counter-clockwise forge sprite once the image has finished loading.
      ctx.globalAlpha = forgeSpriteOpacity;
      ctx.drawImage(this.forgeSpriteCounterClockwise, -halfForgeSpriteSize, -halfForgeSpriteSize, forgeSpriteSize, forgeSpriteSize);
      ctx.globalAlpha = 1;
    } else {
      // Fallback to vector triangles if the sprite has not loaded yet.
      ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, forgeSize);
      ctx.lineTo(forgeSize * Math.cos(PI_OVER_SIX), -forgeSize * Math.sin(PI_OVER_SIX));
      ctx.lineTo(-forgeSize * Math.cos(PI_OVER_SIX), -forgeSize * Math.sin(PI_OVER_SIX));
      ctx.closePath();
      ctx.stroke();
    }
    
    // Draw first triangle second (pointing up, rotating clockwise) - forge.png renders in front
    ctx.rotate(this.forgeRotation * 2); // Reset and rotate to clockwise position
    if (forgeSpriteReady) {
      // Draw the clockwise forge sprite once the image has finished loading.
      ctx.globalAlpha = forgeSpriteOpacity;
      ctx.drawImage(this.forgeSpriteClockwise, -halfForgeSpriteSize, -halfForgeSpriteSize, forgeSpriteSize, forgeSpriteSize);
      ctx.globalAlpha = 1;
    } else {
      // Fallback to vector triangles if the sprite has not loaded yet.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -forgeSize);
      ctx.lineTo(forgeSize * Math.cos(PI_OVER_SIX), forgeSize * Math.sin(PI_OVER_SIX));
      ctx.lineTo(-forgeSize * Math.cos(PI_OVER_SIX), forgeSize * Math.sin(PI_OVER_SIX));
      ctx.closePath();
      ctx.stroke();
    }
    
    // Draw center glow (only if glow is enabled)
    if (this.forgeGlowEnabled) {
      ctx.rotate(-this.forgeRotation); // Rotate back to center
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, forgeSize);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, forgeSize, 0, TWO_PI); // Use pre-calculated constant
      ctx.fill();
    }
    
    ctx.restore();
  }

  drawForgeInfluenceRing() {
    const ctx = this.ctx;

    // Draw a faint ring at the edge of the forge's influence radius
    ctx.strokeStyle = 'rgba(150, 150, 200, 0.1)'; // Faint bluish-white
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // Dashed line for subtlety
    ctx.beginPath();
    ctx.arc(this.forge.x, this.forge.y, MAX_FORGE_ATTRACTION_DISTANCE, 0, TWO_PI); // Use pre-calculated constant
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid lines
  }

  drawSpawners() {
    const ctx = this.ctx;
    const now = Date.now();
    
    // Draw a mini forge for each unlocked particle tier
    // Each tier is positioned at its corresponding generator position
    this.unlockedTiers.forEach((tierId) => {
      const tier = PARTICLE_TIERS.find(t => t.id === tierId);
      if (!tier) return;
      
      const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
      if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) return; // Safety check
      
      const position = SPAWNER_POSITIONS[tierIndex];
      const rotation = this.spawnerRotations.get(tierId) || 0;
      
      // Calculate fade-in opacity
      let opacity = 1;
      const fadeIn = this.generatorFadeIns.get(tierId);
      if (fadeIn) {
        const elapsed = now - fadeIn.startTime;
        if (elapsed < fadeIn.duration) {
          // Ease-in fade from 0 to 1
          opacity = elapsed / fadeIn.duration;
          opacity = opacity * opacity; // Square for ease-in effect
        } else {
          // Animation complete, remove from tracking
          this.generatorFadeIns.delete(tierId);
        }
      }
      
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.globalAlpha = opacity;
      
      // Create color string from tier color
      const color = tier.color;
      const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;

      // Draw the generator's influence ring to visualize its pull radius.
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, SPAWNER_GRAVITY_RADIUS, 0, TWO_PI); // Use pre-calculated constant
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw cached generator sprites when available so they render as tinted art instead of vectors.
      const spriteSet = this.generatorSpriteCache.get(tierId);
      if (spriteSet) {
        const halfSize = spriteSet.size * HALF; // Use pre-calculated HALF constant
        // Draw first sprite (clockwise spin).
        ctx.rotate(rotation);
        ctx.drawImage(spriteSet.clockwise, -halfSize, -halfSize, spriteSet.size, spriteSet.size);
        // Draw second sprite (counter-clockwise spin).
        ctx.rotate(-rotation * 2);
        ctx.drawImage(spriteSet.counterClockwise, -halfSize, -halfSize, spriteSet.size, spriteSet.size);
      } else {
        // Fallback to vector triangles if the sprite has not loaded yet.
        ctx.rotate(rotation);
        ctx.strokeStyle = colorString;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -SPAWNER_SIZE);
        ctx.lineTo(SPAWNER_SIZE * Math.cos(PI_OVER_SIX), SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
        ctx.lineTo(-SPAWNER_SIZE * Math.cos(PI_OVER_SIX), SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
        ctx.closePath();
        ctx.stroke();
        
        ctx.rotate(-rotation * 2);
        const lightColorString = `rgba(${Math.min(255, color.r + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.g + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.b + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, 0.6)`;
        ctx.strokeStyle = lightColorString;
        ctx.beginPath();
        ctx.moveTo(0, SPAWNER_SIZE);
        ctx.lineTo(SPAWNER_SIZE * Math.cos(PI_OVER_SIX), -SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
        ctx.lineTo(-SPAWNER_SIZE * Math.cos(PI_OVER_SIX), -SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
        ctx.closePath();
        ctx.stroke();
      }
      
      // Draw center glow with tier color (only if glow is enabled)
      if (this.forgeGlowEnabled) {
        ctx.rotate(rotation); // Rotate back to center
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, SPAWNER_SIZE);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, SPAWNER_SIZE, 0, TWO_PI); // Use pre-calculated constant
        ctx.fill();
      }
      
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
      // Tag spawner with tier so only matching particles feel the pull.
      activeSpawners.push({ x: position.x, y: position.y, range: SPAWNER_GRAVITY_RADIUS, tierId });
    });

    return activeSpawners;
  }

  resize() {
    // Canvas maintains fixed dimensions to match Aleph spire
    // The CSS will handle scaling to fit container
  }

  /**
   * Calculate the base particle factor by multiplying the number of particles from each tier.
   * If a tier has 0 particles, it contributes 1 to avoid zeroing out the entire factor.
   */
  calculateBaseParticleFactor() {
    let factor = 1;
    PARTICLE_TIERS.forEach(tier => {
      const count = this.inventory.get(tier.id) || 0;
      // Multiply by the count, but use 1 if count is 0 to avoid zero multiplication.
      factor *= (count > 0 ? count : 1);
    });
    return factor;
  }

  /**
   * Calculate the Particle Factor with the nullstone exponent applied.
   * This is the player's total score in the BET spire.
   */
  calculateParticleFactor() {
    const baseFactor = this.calculateBaseParticleFactor();
    // Apply the exponent bonus to the particle factor for nullstone crunch rewards.
    const exponent = 1 + this.particleFactorExponentBonus;
    return Math.pow(baseFactor, exponent);
  }

  /**
   * Check if the particle factor has reached a new milestone and award BET glyphs.
   * Returns the number of glyphs awarded this check (0 if no new milestone reached).
   */
  checkParticleFactorMilestone() {
    const currentFactor = this.calculateParticleFactor();
    let glyphsAwarded = 0;
    
    // Award glyphs for each 100x milestone reached
    while (currentFactor >= this.particleFactorMilestone) {
      glyphsAwarded++;
      this.betGlyphsAwarded++;
      this.particleFactorMilestone *= 100; // Next milestone is 100x higher
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
    const baseFactor = this.calculateBaseParticleFactor();
    const currentFactor = Math.pow(baseFactor, 1 + this.particleFactorExponentBonus);
    return {
      particleFactor: currentFactor,
      baseFactor,
      currentMilestone: this.particleFactorMilestone,
      betGlyphsAwarded: this.betGlyphsAwarded,
      progressToNext: currentFactor / this.particleFactorMilestone,
      particleFactorExponent: 1 + this.particleFactorExponentBonus,
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

  getInventoryBySize() {
    // Return particle counts broken down by tier and size
    const counts = new Map();
    
    PARTICLE_TIERS.forEach(tier => {
      counts.set(tier.id, {
        small: 0,
        medium: 0,
        large: 0,
        // Track extra-large counts for the new maximum size tier.
        'extra-large': 0
      });
    });
    
    // Count particles by tier and size
    this.particles.forEach(particle => {
      const sizeKey = SIZE_TIERS[particle.sizeIndex];
      const tierCounts = counts.get(particle.tierId);
      if (tierCounts && sizeKey) {
        tierCounts[sizeKey]++;
      }
    });
    
    return counts;
  }

  /**
   * Get a snapshot of the current particle state for saving
   */
  getParticleStateSnapshot() {
    const particlesByTierAndSize = {};
    
    PARTICLE_TIERS.forEach(tier => {
      particlesByTierAndSize[tier.id] = {
        small: 0,
        medium: 0,
        large: 0,
        // Persist extra-large particle counts for Bet spire state saves.
        'extra-large': 0
      };
    });
    
    // Count particles by tier and size
    this.particles.forEach(particle => {
      const sizeKey = SIZE_TIERS[particle.sizeIndex];
      if (particlesByTierAndSize[particle.tierId] && sizeKey) {
        particlesByTierAndSize[particle.tierId][sizeKey]++;
      }
    });
    
    return particlesByTierAndSize;
  }

  /**
   * Restore particles from a saved state snapshot
   * Spawns particles gradually at generators (dehydration)
   */
  restoreParticleState(snapshot) {
    if (!snapshot) return;

    // Clear existing particles
    this.particles = [];

    // Create a queue of particles to spawn
    const spawnQueue = [];

    PARTICLE_TIERS.forEach((tier, tierIndex) => {
      const counts = snapshot[tier.id];
      if (counts) {
        const smallCount = Math.max(0, counts.small || 0);
        const mediumCount = Math.max(0, counts.medium || 0);
        const largeCount = Math.max(0, counts.large || 0);
        // Include extra-large particles so the largest size tier persists across saves.
        const extraLargeCount = Math.max(0, counts['extra-large'] || 0);

        // Normalize stored counts into the largest possible pieces so resumptions start with the chunkiest particles.
        const totalSmallUnits =
          smallCount
          + (mediumCount * MERGE_THRESHOLD)
          + (largeCount * MERGE_THRESHOLD * MERGE_THRESHOLD)
          + (extraLargeCount * Math.pow(MERGE_THRESHOLD, 3));

        const normalizedExtraLarge = Math.floor(totalSmallUnits / Math.pow(MERGE_THRESHOLD, 3));
        const remainingAfterExtraLarge = totalSmallUnits - (normalizedExtraLarge * Math.pow(MERGE_THRESHOLD, 3));
        const normalizedLarge = Math.floor(remainingAfterExtraLarge / (MERGE_THRESHOLD * MERGE_THRESHOLD));
        const remainingAfterLarge = remainingAfterExtraLarge - (normalizedLarge * MERGE_THRESHOLD * MERGE_THRESHOLD);
        const normalizedMedium = Math.floor(remainingAfterLarge / MERGE_THRESHOLD);
        const normalizedSmall = remainingAfterLarge - (normalizedMedium * MERGE_THRESHOLD);

        // Spawn extra-large particles first so the restored swarm stays chunky.
        for (let i = 0; i < normalizedExtraLarge; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: EXTRA_LARGE_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedLarge; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: LARGE_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedMedium; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: MEDIUM_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedSmall; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: SMALL_SIZE_INDEX, tierIndex });
        }
      }
    });

    // Store the spawn queue for gradual spawning
    this.spawnQueue = spawnQueue;
    this.spawnQueueIndex = 0;
  }

  /**
   * Process the spawn queue, spawning one particle per frame
   */
  processSpawnQueue() {
    if (!this.spawnQueue || this.spawnQueueIndex >= this.spawnQueue.length) {
      return;
    }

    const particleData = this.spawnQueue[this.spawnQueueIndex];
    if (particleData) {
      // Spawn exactly one particle per frame to avoid bursts after long idle sessions.
      this.addParticle(particleData.tierId, particleData.sizeIndex);
    }

    this.spawnQueueIndex += 1;

    if (this.spawnQueueIndex >= this.spawnQueue.length) {
      this.spawnQueue = [];
      this.spawnQueueIndex = 0;
    }
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
