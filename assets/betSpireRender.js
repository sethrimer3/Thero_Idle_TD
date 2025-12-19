// Bet Spire Particle Physics Render
// Simple particle system with three attractors and fading trails

// Canvas dimensions matching Aleph Spire render
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 320;

// Particle system configuration
const NUM_PARTICLES = 150;
const ATTRACTOR_COUNT = 3;
const TRAIL_FADE = 0.15; // Lower = longer trails
const PARTICLE_SIZE = 2;
const MAX_VELOCITY = 2;
const ATTRACTION_STRENGTH = 0.5;
const ATTRACTOR_RADIUS = 40;

// Attractor positions (distributed in a triangular pattern)
const ATTRACTOR_POSITIONS = [
  { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.25 },  // Top center
  { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.7 },  // Bottom left
  { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT * 0.7 },  // Bottom right
];

// Particle class with simple physics
class Particle {
  constructor() {
    this.x = Math.random() * CANVAS_WIDTH;
    this.y = Math.random() * CANVAS_HEIGHT;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.attractorIndex = Math.floor(Math.random() * ATTRACTOR_COUNT);
    
    // Assign particle type: 0 = blue, 1 = white, 2 = shifting color
    const rand = Math.random();
    if (rand < 0.4) {
      this.type = 0; // Blue (40%)
    } else if (rand < 0.7) {
      this.type = 1; // White (30%)
    } else {
      this.type = 2; // Shifting color (30%)
    }
    
    this.hue = Math.random() * 360; // For shifting color particles
  }

  update(attractors) {
    // Get assigned attractor
    const attractor = attractors[this.attractorIndex];
    
    // Calculate distance and direction to attractor
    const dx = attractor.x - this.x;
    const dy = attractor.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Apply attraction force (inverse square law simplified)
    if (dist > 1) {
      const force = ATTRACTION_STRENGTH / (dist * 0.01);
      const angle = Math.atan2(dy, dx);
      this.vx += Math.cos(angle) * force * 0.01;
      this.vy += Math.sin(angle) * force * 0.01;
    }
    
    // Add slight orbital motion around attractor
    if (dist < ATTRACTOR_RADIUS && dist > 5) {
      const tangentAngle = Math.atan2(dy, dx) + Math.PI / 2;
      this.vx += Math.cos(tangentAngle) * 0.1;
      this.vy += Math.sin(tangentAngle) * 0.1;
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
    
    // Wrap around edges
    if (this.x < 0) this.x += CANVAS_WIDTH;
    if (this.x > CANVAS_WIDTH) this.x -= CANVAS_WIDTH;
    if (this.y < 0) this.y += CANVAS_HEIGHT;
    if (this.y > CANVAS_HEIGHT) this.y -= CANVAS_HEIGHT;
    
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
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.particles = [];
    this.attractors = ATTRACTOR_POSITIONS;
    this.animationId = null;
    this.isRunning = false;
    
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
    
    // Update and draw particles
    for (const particle of this.particles) {
      particle.update(this.attractors);
      particle.draw(this.ctx);
    }
    
    this.animationId = requestAnimationFrame(() => this.animate());
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
