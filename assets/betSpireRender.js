// Bet Spire Particle Physics Render
// Simple particle system with three attractors and fading trails

// Canvas dimensions matching Aleph Spire render
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 320;

// Particle system configuration
const NUM_PARTICLES = 150;
const ATTRACTOR_COUNT = 3;
const TRAIL_FADE = 0.15; // Lower = longer trails
const PARTICLE_SIZE = 1; // Reduced from 2 to 1 (half size)
const MAX_VELOCITY = 2;
const ATTRACTION_STRENGTH = 0.5;
const ATTRACTOR_RADIUS = 40;
const DISTANCE_SCALE = 0.01; // Scale factor for distance calculations
const FORCE_SCALE = 0.01; // Scale factor for force application
const ORBITAL_FORCE = 0.1; // Tangential orbital force strength

// User interaction configuration
const INTERACTION_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 20; // 1/20th of simulation diameter
const MOUSE_ATTRACTION_STRENGTH = 3.0; // Stronger attraction for mouse/touch
const INTERACTION_FADE_DURATION = 300; // milliseconds for circle fade

// Attractor positions (distributed in a triangular pattern)
// Each attractor now has a color affinity (0 = blue only, 1 = white only, 2 = shifting only)
const ATTRACTOR_POSITIONS = [
  { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.25, colorAffinity: 0 },  // Top center - Blue particles
  { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.7, colorAffinity: 1 },  // Bottom left - White particles
  { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT * 0.7, colorAffinity: 2 },  // Bottom right - Shifting particles
];

// Particle class with simple physics
class Particle {
  constructor() {
    this.x = Math.random() * CANVAS_WIDTH;
    this.y = Math.random() * CANVAS_HEIGHT;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    
    // Assign particle type: 0 = blue, 1 = white, 2 = shifting color
    const rand = Math.random();
    if (rand < 0.4) {
      this.type = 0; // Blue (40%)
    } else if (rand < 0.7) {
      this.type = 1; // White (30%)
    } else {
      this.type = 2; // Shifting color (30%)
    }
    
    // Assign attractor that matches this particle's color affinity
    this.attractorIndex = this.type;
    
    this.hue = Math.random() * 360; // For shifting color particles
    this.lockedToMouse = false; // Whether particle is locked to mouse/touch
    this.mouseTarget = null; // Target position when locked to mouse
  }

  update(attractors) {
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
      // Normal attractor behavior
      // Get assigned attractor (now color-specific)
      const attractor = attractors[this.attractorIndex];
      
      // Calculate distance and direction to attractor
      const dx = attractor.x - this.x;
      const dy = attractor.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Apply attraction force (inverse square law simplified)
      if (dist > 1) {
        const force = ATTRACTION_STRENGTH / (dist * DISTANCE_SCALE);
        const angle = Math.atan2(dy, dx);
        this.vx += Math.cos(angle) * force * FORCE_SCALE;
        this.vy += Math.sin(angle) * force * FORCE_SCALE;
      }
      
      // Add slight orbital motion around attractor
      if (dist < ATTRACTOR_RADIUS && dist > 5) {
        const tangentAngle = Math.atan2(dy, dx) + Math.PI / 2;
        this.vx += Math.cos(tangentAngle) * ORBITAL_FORCE;
        this.vy += Math.sin(tangentAngle) * ORBITAL_FORCE;
      }
    }
    
    // Limit velocity
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_VELOCITY) {
      this.vx = (this.vx / speed) * MAX_VELOCITY;
      this.vy = (this.vy / speed) * MAX_VELOCITY;
    }
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // Wrap around edges (only when not locked to mouse)
    if (!this.lockedToMouse) {
      if (this.x < 0) this.x += CANVAS_WIDTH;
      if (this.x > CANVAS_WIDTH) this.x -= CANVAS_WIDTH;
      if (this.y < 0) this.y += CANVAS_HEIGHT;
      if (this.y > CANVAS_HEIGHT) this.y -= CANVAS_HEIGHT;
    } else {
      // Clamp to canvas bounds when locked
      if (this.x < 0) this.x = 0;
      if (this.x > CANVAS_WIDTH) this.x = CANVAS_WIDTH;
      if (this.y < 0) this.y = 0;
      if (this.y > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT;
    }
    
    // Update hue for shifting color particles
    if (this.type === 2) {
      this.hue = (this.hue + 1) % 360;
    }
  }

  getColor() {
    switch (this.type) {
      case 0: // Bright blue
        return 'rgba(100, 200, 255, 0.9)';
      case 1: // White
        return 'rgba(255, 255, 255, 0.95)';
      case 2: // Shifting color
        return `hsla(${this.hue}, 100%, 70%, 0.9)`;
      default:
        return 'rgba(255, 255, 255, 0.9)';
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.getColor();
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), PARTICLE_SIZE, PARTICLE_SIZE);
  }
}

// Main render system
export class BetSpireRender {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.particles = [];
    this.attractors = ATTRACTOR_POSITIONS;
    this.animationId = null;
    this.isRunning = false;
    
    // Mouse/touch interaction state
    this.isInteracting = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.interactionCircles = []; // Array of {x, y, radius, alpha, timestamp}
    
    // Bind methods for requestAnimationFrame and event listeners
    this.animate = this.animate.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Set canvas dimensions
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    
    // Initialize particles
    for (let i = 0; i < NUM_PARTICLES; i++) {
      this.particles.push(new Particle());
    }
    
    // Initialize with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Set up event listeners
    this.setupEventListeners();
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
    
    // Draw subtle attractor indicators
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (const attractor of this.attractors) {
      this.ctx.beginPath();
      this.ctx.arc(attractor.x, attractor.y, ATTRACTOR_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
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
    
    // Update and draw particles
    for (const particle of this.particles) {
      particle.update(this.attractors);
      particle.draw(this.ctx);
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  }

  resize() {
    // Canvas maintains fixed dimensions to match Aleph spire
    // The CSS will handle scaling to fit container
  }
}

// Initialize the Bet Spire render
let betSpireRenderInstance = null;

export function initBetSpireRender() {
  const canvas = document.getElementById('bet-spire-canvas');
  if (!canvas) {
    console.warn('Bet Spire canvas element not found');
    return;
  }
  
  if (betSpireRenderInstance) {
    betSpireRenderInstance.stop();
  }
  
  betSpireRenderInstance = new BetSpireRender(canvas);
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
