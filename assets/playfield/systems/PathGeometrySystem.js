/**
 * PathGeometrySystem - Manages path rendering geometry, tunnel segments, and track river particles
 * 
 * Extracted from playfield.js (Build 468) as part of Phase 1.1 refactoring.
 * Consolidates path curve generation, tunnel zone identification, and river particle initialization.
 */

import { getPlayfieldResolutionCap } from '../playfieldPreferences.js';

// Constants
const MAX_PLAYFIELD_DEVICE_PIXEL_RATIO = 1;
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

/**
 * Synchronizes canvas size with container dimensions and rebuilds path geometry.
 * Called on initialization and whenever the canvas is resized.
 */
export function syncCanvasSize() {
  if (!this.canvas || !this.ctx) {
    return;
  }
  const rect = this.canvas.getBoundingClientRect();
  // Clamp the device pixel ratio so the canvas backing store does not balloon on high-resolution devices.
  // Respect the user-selected playfield resolution cap when calculating backing scale.
  const resolutionCap = Math.max(MAX_PLAYFIELD_DEVICE_PIXEL_RATIO, getPlayfieldResolutionCap());
  const ratio = Math.min(window.devicePixelRatio || 1, resolutionCap);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (this.canvas.width !== width || this.canvas.height !== height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
  this.renderWidth = rect.width || 1;
  this.renderHeight = rect.height || 1;
  this.pixelRatio = ratio;

  this.buildPathGeometry();
  this.updateTowerPositions();
  this.ensureFloatersLayout();
  this.applyViewConstraints();
  this.draw();
}

/**
 * Builds path geometry from level configuration, including smooth curve interpolation,
 * segment speed multipliers, and tunnel zone identification.
 */
export function buildPathGeometry() {
  if (
    !this.levelConfig ||
    !Array.isArray(this.levelConfig.path) ||
    !this.ctx
  ) {
    this.pathSegments = [];
    this.pathPoints = [];
    this.pathLength = 0;
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;
    return;
  }

  // Handle radial spawn levels (single center point, no traditional path)
  if (this.levelConfig.radialSpawn && this.levelConfig.centerSpawn && this.levelConfig.path.length === 1) {
    const centerNode = this.levelConfig.path[0];
    const centerPoint = {
      x: centerNode.x * this.renderWidth,
      y: centerNode.y * this.renderHeight,
      speedMultiplier: 1,
      tunnel: false,
    };
    
    // Create a minimal path structure for the center point
    this.pathPoints = [centerPoint];
    this.pathSegments = [];
    // Use nominal length to avoid division by zero in progress calculations
    const RADIAL_SPAWN_NOMINAL_LENGTH = 1;
    this.pathLength = RADIAL_SPAWN_NOMINAL_LENGTH;
    this.tunnelSegments = [];
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;
    return;
  }

  // Normal path handling (2+ points required)
  if (this.levelConfig.path.length < 2) {
    this.pathSegments = [];
    this.pathPoints = [];
    this.pathLength = 0;
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;
    return;
  }

  const points = this.levelConfig.path.map((node) => ({
    x: node.x * this.renderWidth,
    y: node.y * this.renderHeight,
    speedMultiplier: Number.isFinite(node.speedMultiplier) ? node.speedMultiplier : 1,
    tunnel: Boolean(node.tunnel),
  }));

  const smoothPoints = this.generateSmoothPathPoints(points, 14);

  const segments = [];
  let totalLength = 0;
  // Calculate speed multipliers for segments based on interpolation between original path points
  for (let index = 0; index < smoothPoints.length - 1; index += 1) {
    const start = smoothPoints[index];
    const end = smoothPoints[index + 1];
    const length = this.distanceBetween(start, end);
    
    // Find which original path segment this smooth segment corresponds to
    // and interpolate the speed multiplier accordingly
    let speedMultiplier = 1;
    if (Number.isFinite(start.speedMultiplier) && Number.isFinite(end.speedMultiplier)) {
      // Average the speed multipliers at the start and end of this segment
      speedMultiplier = (start.speedMultiplier + end.speedMultiplier) * HALF;
    } else if (Number.isFinite(start.speedMultiplier)) {
      speedMultiplier = start.speedMultiplier;
    } else if (Number.isFinite(end.speedMultiplier)) {
      speedMultiplier = end.speedMultiplier;
    }
    
    // Mark if this segment is inside a tunnel
    const inTunnel = Boolean(start.tunnel && end.tunnel);
    
    segments.push({ start, end, length, speedMultiplier, inTunnel });
    totalLength += length;
  }

  this.pathPoints = smoothPoints;
  this.pathSegments = segments;
  this.pathLength = totalLength || 1;
  
  // Identify tunnel zones: consecutive tunnel segments with fade zones at entry/exit
  this.buildTunnelSegments(smoothPoints);
  
  this.initializeTrackRiverParticles();
}

/**
 * Identifies consecutive tunnel segments and marks entry/exit zones.
 * Creates tunnel segment metadata for rendering alpha fade effects.
 */
export function buildTunnelSegments(points) {
  this.tunnelSegments = [];
  
  if (!Array.isArray(points) || points.length < 2) {
    return;
  }
  
  // Find consecutive tunnel points to identify tunnel zones
  let tunnelStart = null;
  let tunnelStartIndex = -1;
  
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const isTunnel = Boolean(point.tunnel);
    
    if (isTunnel && tunnelStart === null) {
      // Entering a tunnel zone
      tunnelStart = i;
      tunnelStartIndex = i;
    } else if (!isTunnel && tunnelStart !== null) {
      // Exiting a tunnel zone
      const tunnelEnd = i - 1;
      
      // Only create tunnel segment if there are at least 2 points
      if (tunnelEnd >= tunnelStart) {
        this.tunnelSegments.push({
          startIndex: tunnelStart,
          endIndex: tunnelEnd,
          startPoint: points[tunnelStart],
          endPoint: points[tunnelEnd],
        });
      }
      
      tunnelStart = null;
      tunnelStartIndex = -1;
    }
  }
  
  // Handle case where tunnel extends to the end of the path
  if (tunnelStart !== null) {
    const tunnelEnd = points.length - 1;
    if (tunnelEnd >= tunnelStart) {
      this.tunnelSegments.push({
        startIndex: tunnelStart,
        endIndex: tunnelEnd,
        startPoint: points[tunnelStart],
        endPoint: points[tunnelEnd],
      });
    }
  }
}

/**
 * Initializes ambient river particles that flow along the path.
 * Creates both standard river particles and faster tracer particles.
 */
export function initializeTrackRiverParticles() {
  if (!this.pathSegments.length || !Number.isFinite(this.pathLength) || this.pathLength <= 0) {
    this.trackRiverParticles = [];
    this.trackRiverTracerParticles = [];
    this.trackRiverPulse = 0;
    return;
  }

  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const lowGraphicsEnabled = this.isLowGraphicsMode();
  const performanceScale = lowGraphicsEnabled ? 0.6 : 1;
  // Reduce the river spawn budget on low fidelity so the tracer math stays lightweight on busy boards.
  const baseCount = Math.round(
    (this.pathLength / Math.max(28, minDimension * 0.35)) * performanceScale,
  );
  const particleCount = Math.max(36, Math.min(lowGraphicsEnabled ? 120 : 160, baseCount));
  const createParticle = () => ({
    progress: Math.random(),
    speed: 0.045 + Math.random() * 0.05,
    radius: 0.7 + Math.random() * 1.2,
    offset: (Math.random() - 0.5) * 0.8,
    offsetTarget: (Math.random() - 0.5) * 0.8,
    driftRate: 0.5 + Math.random() * 0.9,
    driftTimer: 0.6 + Math.random() * 1.2,
    phase: Math.random() * TWO_PI,
    phaseSpeed: 0.6 + Math.random() * 1.3,
  });

  // Generate a smaller band of tracer sparks that accelerate along the river track.
  const createTracerParticle = () => ({
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08,
    offset: (Math.random() - 0.5) * 0.3,
    offsetTarget: (Math.random() - 0.5) * 0.3,
    driftRate: 2 + Math.random() * 2.2,
    driftTimer: 0.25 + Math.random() * 0.45,
    phase: Math.random() * TWO_PI,
    phaseSpeed: 1.6 + Math.random() * 1.4,
  });

  this.trackRiverParticles = Array.from({ length: particleCount }, createParticle);
  const tracerCount = lowGraphicsEnabled ? 0 : Math.max(10, Math.round(particleCount * 0.25));
  // Suppress tracer particles entirely in low graphics mode to eliminate the heaviest draw calls.
  this.trackRiverTracerParticles = lowGraphicsEnabled
    ? []
    : Array.from({ length: tracerCount }, createTracerParticle);
  this.trackRiverPulse = 0;
}

/**
 * Generates smooth path points using Catmull-Rom spline interpolation.
 * Interpolates speed multipliers and preserves tunnel properties.
 */
export function generateSmoothPathPoints(points, subdivisions = 12) {
  if (!Array.isArray(points) || points.length < 2) {
    return Array.isArray(points) ? points.slice() : [];
  }

  const smooth = [];
  const steps = Math.max(1, subdivisions);

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = index > 0 ? points[index - 1] : points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = index + 2 < points.length ? points[index + 2] : next;

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const x = this.catmullRom(previous.x, current.x, next.x, afterNext.x, t);
      const y = this.catmullRom(previous.y, current.y, next.y, afterNext.y, t);
      
      // Interpolate speed multiplier between current and next points
      const currentSpeed = Number.isFinite(current.speedMultiplier) ? current.speedMultiplier : 1;
      const nextSpeed = Number.isFinite(next.speedMultiplier) ? next.speedMultiplier : 1;
      const speedMultiplier = currentSpeed + (nextSpeed - currentSpeed) * t;
      
      // Preserve tunnel property - point is in tunnel only if both current and next are tunnels
      const tunnel = Boolean(current.tunnel && next.tunnel);
      
      const point = { x, y, speedMultiplier, tunnel };
      if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], point) > 0.5) {
        smooth.push(point);
      }
    }
  }

  const lastPoint = points[points.length - 1];
  if (!smooth.length || this.distanceBetween(smooth[smooth.length - 1], lastPoint) > 0) {
    const speedMultiplier = Number.isFinite(lastPoint.speedMultiplier) ? lastPoint.speedMultiplier : 1;
    const tunnel = Boolean(lastPoint.tunnel);
    smooth.push({ ...lastPoint, speedMultiplier, tunnel });
  }

  return smooth;
}

/**
 * Catmull-Rom spline interpolation for smooth curve generation.
 * Used by generateSmoothPathPoints to create fluid path curves.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    ((2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Calculates Euclidean distance between two points.
 * Used throughout path geometry calculations.
 */
export function distanceBetween(a, b) {
  if (!a || !b) {
    return 0;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}
