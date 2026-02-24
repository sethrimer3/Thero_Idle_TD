// Bet Spire input and event handling extracted from BetSpireRender.
// All functions are standalone exports designed for .call(this) delegation from BetSpireRender.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  INTERACTION_RADIUS,
  DRAG_RELEASE_STILLNESS_MS,
  DRAG_RELEASE_SPEED_THRESHOLD,
  TWO_PI,
} from './betSpireConfig.js';
import { Particle } from './betSpireParticle.js';

export function setupEventListeners() {
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

export function removeEventListeners() {
  this.canvas.removeEventListener('mousedown', this.handlePointerDown);
  this.canvas.removeEventListener('mousemove', this.handlePointerMove);
  this.canvas.removeEventListener('mouseup', this.handlePointerUp);
  this.canvas.removeEventListener('mouseleave', this.handlePointerUp);
  
  this.canvas.removeEventListener('touchstart', this.handlePointerDown);
  this.canvas.removeEventListener('touchmove', this.handlePointerMove);
  this.canvas.removeEventListener('touchend', this.handlePointerUp);
  this.canvas.removeEventListener('touchcancel', this.handlePointerUp);
}

export function getCanvasCoordinates(event) {
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

export function spawnSandParticleAtEdge(tapCoords) {
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

export function handlePointerDown(event) {
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

export function handlePointerMove(event) {
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

export function handlePointerUp(event) {
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
