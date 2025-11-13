/**
 * Incremental Fractal Tree Simulation
 * 
 * A minimalist, elegant fractal tree that grows one segment at a time.
 * The viewer can watch branches appear sequentially with no harsh lines or busy noise.
 * 
 * Features:
 * - Stepwise growth with configurable growth rate
 * - Gentle color drift by depth (light ink to soft cyan for twigs)
 * - Optional Bézier curves for natural branch curvature
 * - Pressure-like tapering for ink aesthetic
 * - Optional leaves at terminal nodes
 * - Optional gravity bend for natural droop
 * - Seeded noise for organic variation
 * - Pan and zoom support (mouse/touch)
 */

import { addPanZoomToFractal } from './fractalPanZoom.js';

/**
 * Simple seeded random number generator for consistent organic variation.
 * Uses a Linear Congruential Generator (LCG) algorithm.
 */
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Returns a pseudo-random number between 0 and 1.
   */
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Returns a pseudo-random number between min and max.
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }
}

/**
 * Represents a single branch segment in the fractal tree.
 */
class BranchSegment {
  constructor(x, y, angle, length, depth, width, parentId = null, bezierOffset = { x: 0, y: 0 }) {
    this.id = BranchSegment.nextId++;
    this.x = x; // Start x position
    this.y = y; // Start y position
    this.angle = angle; // Angle in radians
    this.length = length; // Length of this segment
    this.depth = depth; // Depth in the tree (0 = root)
    this.width = width; // Line width for this segment
    this.parentId = parentId; // ID of parent segment
    this.endX = x + Math.cos(angle) * length;
    this.endY = y + Math.sin(angle) * length;
    this.hasGrown = false; // Whether this segment has been rendered
    this.age = 0; // Frames since this segment was grown
    this.bezierOffset = bezierOffset; // Cached Bézier control point offset for consistent rendering
  }
}
BranchSegment.nextId = 0;

/**
 * Fractal Tree Simulation - Incremental growth with elegant ink aesthetic.
 */
export class FractalTreeSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style
    this.bgColor = options.bgColor || '#0f1116';
    this.trunkColor = options.trunkColor || '#e6e6ea';
    this.twigColor = options.twigColor || '#a2e3f5';
    this.leafColor = options.leafColor || '#a2e3f5';
    this.leafAlpha = options.leafAlpha || 0.3;
    this.showLeaves = options.showLeaves !== undefined ? options.showLeaves : false;

    // Growth parameters
    this.branchFactor = this.clamp(options.branchFactor || 2, 2, 3);
    this.baseSpreadDeg = this.clamp(options.baseSpreadDeg || 25, 5, 45);
    this.lengthDecay = this.clamp(options.lengthDecay || 0.7, 0.55, 0.85);
    this.maxDepth = this.clamp(options.maxDepth || 9, 6, 13);
    this.angleJitterDeg = this.clamp(options.angleJitterDeg || 3, 0, 6);
    this.gravityBend = this.clamp(options.gravityBend || 0.08, 0, 0.25);
    this.growthRate = this.clamp(options.growthRate || 3, 1, 20);

    // Rendering style
    this.renderStyle = options.renderStyle || 'bezier'; // 'straight' or 'bezier'
    this.baseWidth = options.baseWidth || 8;
    this.minWidth = options.minWidth || 0.5;

    // Initial tree parameters
    this.rootLength = options.rootLength || 80;
    this.rootX = options.rootX || 0.5; // Proportion of canvas width
    this.rootY = options.rootY || 0.9; // Proportion of canvas height

    // State
    this.segments = [];
    this.growthQueue = [];
    this.segmentMap = new Map();
    this.isComplete = false;
    this.rng = new SeededRandom(options.seed || Date.now());
    
    // Animation
    this.haloFrames = 15; // How long to show the halo effect

    // Growth control based on allocated resources
    this.targetSegments = 1; // Start with just the root (simple stem)
    this.segmentsGrown = 0; // Count of segments that have been grown

    // Initialize pan and zoom
    this.initPanZoom(this.canvas);

    this.reset();
  }

  /**
   * Clamps a value between min and max.
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Converts degrees to radians.
   */
  degToRad(deg) {
    return deg * Math.PI / 180;
  }

  /**
   * Interpolates between two colors based on a factor (0 to 1).
   * Colors should be in hex format like '#rrggbb'.
   */
  interpolateColor(color1, color2, factor) {
    factor = this.clamp(factor, 0, 1);
    
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Resets the simulation and creates the root segment.
   */
  reset() {
    BranchSegment.nextId = 0;
    this.segments = [];
    this.growthQueue = [];
    this.segmentMap.clear();
    this.isComplete = false;
    this.segmentsGrown = 0;

    if (!this.canvas) return;

    // Create root segment
    const startX = this.canvas.width * this.rootX;
    const startY = this.canvas.height * this.rootY;
    const rootAngle = -Math.PI / 2; // Pointing upward
    const rootWidth = this.baseWidth;

    const root = new BranchSegment(
      startX,
      startY,
      rootAngle,
      this.rootLength,
      0,
      rootWidth,
      null,
      { x: 0, y: 0 } // Root has no curve offset
    );

    this.segments.push(root);
    this.segmentMap.set(root.id, root);
    this.growthQueue.push(root);
  }

  /**
   * Updates the simulation by growing segments from the queue.
   */
  update() {
    // Age all segments for animation purposes
    for (const segment of this.segments) {
      segment.age++;
    }

    // Check if we've reached the target segment count or completed growth
    if (this.segmentsGrown >= this.targetSegments || this.growthQueue.length === 0) {
      if (this.growthQueue.length === 0) {
        this.isComplete = true;
      }
      return;
    }

    // Grow segments up to the target based on allocated resources
    const remaining = this.targetSegments - this.segmentsGrown;
    const segmentsToGrow = Math.min(this.growthRate, this.growthQueue.length, remaining);
    
    for (let i = 0; i < segmentsToGrow; i++) {
      const parent = this.growthQueue.shift();
      parent.hasGrown = true;
      this.segmentsGrown++;

      // Stop growing if we've reached max depth
      if (parent.depth >= this.maxDepth) {
        continue;
      }

      // Generate child segments
      this.spawnChildren(parent);
    }
  }

  /**
   * Spawns child branches from a parent segment.
   */
  spawnChildren(parent) {
    const childDepth = parent.depth + 1;
    const childLength = parent.length * this.lengthDecay;
    const childWidth = Math.max(this.minWidth, parent.width * this.lengthDecay);
    
    const baseSpreadRad = this.degToRad(this.baseSpreadDeg);
    const angleJitterRad = this.degToRad(this.angleJitterDeg);

    // Generate branchFactor children
    for (let i = 0; i < this.branchFactor; i++) {
      // Calculate angle offset from parent
      let angleOffset;
      if (this.branchFactor === 2) {
        // For 2 branches, split left and right
        angleOffset = i === 0 ? -baseSpreadRad : baseSpreadRad;
      } else {
        // For 3 branches, split left, center, right
        angleOffset = (i - 1) * baseSpreadRad;
      }

      // Add jitter for organic variation
      const jitter = this.rng.range(-angleJitterRad, angleJitterRad);
      const childAngle = parent.angle + angleOffset + jitter;

      // Apply gravity bend (adds downward component proportional to depth)
      const gravityAdjustment = this.gravityBend * childDepth * 0.1;

      // Generate consistent Bézier control point offset for this segment
      const bezierOffsetX = (this.rng.next() - 0.5);
      const bezierOffsetY = (this.rng.next() - 0.5);

      const child = new BranchSegment(
        parent.endX,
        parent.endY,
        childAngle + gravityAdjustment,
        childLength,
        childDepth,
        childWidth,
        parent.id,
        { x: bezierOffsetX, y: bezierOffsetY }
      );

      this.segments.push(child);
      this.segmentMap.set(child.id, child);
      this.growthQueue.push(child);
    }
  }

  /**
   * Renders the fractal tree.
   */
  render() {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas with background color
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply pan and zoom transformation
    this.applyPanZoomTransform();

    // Draw all grown segments
    for (const segment of this.segments) {
      if (!segment.hasGrown) continue;

      // Calculate color based on depth
      const depthFactor = segment.depth / this.maxDepth;
      const color = this.interpolateColor(this.trunkColor, this.twigColor, depthFactor);

      // Draw segment
      if (this.renderStyle === 'bezier') {
        this.drawBezierSegment(segment, color);
      } else {
        this.drawStraightSegment(segment, color);
      }

      // Draw halo effect for recently grown segments
      if (segment.age < this.haloFrames) {
        this.drawHalo(segment.endX, segment.endY, segment.width, segment.age);
      }

      // Draw leaf at terminal nodes if enabled
      if (this.showLeaves && segment.depth === this.maxDepth && segment.hasGrown) {
        this.drawLeaf(segment.endX, segment.endY, segment.width);
      }
    }

    // Restore canvas transform
    this.restorePanZoomTransform();
  }

  /**
   * Draws a straight segment with tapered width.
   */
  drawStraightSegment(segment, color) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = segment.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = 0.9;

    this.ctx.beginPath();
    this.ctx.moveTo(segment.x, segment.y);
    this.ctx.lineTo(segment.endX, segment.endY);
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a segment with a subtle Bézier curve for natural appearance.
   */
  drawBezierSegment(segment, color) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = segment.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = 0.9;

    // Calculate control point with slight perpendicular offset using cached values
    const midX = (segment.x + segment.endX) / 2;
    const midY = (segment.y + segment.endY) / 2;
    
    // Perpendicular offset for curve (10% of length) using cached bezierOffset
    const perpAngle = segment.angle + Math.PI / 2;
    const offsetMag = segment.length * 0.1;
    const controlX = midX + Math.cos(perpAngle) * offsetMag * segment.bezierOffset.x;
    const controlY = midY + Math.sin(perpAngle) * offsetMag * segment.bezierOffset.y;

    this.ctx.beginPath();
    this.ctx.moveTo(segment.x, segment.y);
    this.ctx.quadraticCurveTo(controlX, controlY, segment.endX, segment.endY);
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a halo effect at the endpoint of a newly grown segment.
   */
  drawHalo(x, y, width, age) {
    const alpha = (1 - age / this.haloFrames) * 0.4;
    const radius = width * 2;

    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = this.twigColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a leaf as a small circle at a terminal node.
   */
  drawLeaf(x, y, width) {
    const leafRadius = width * 1.5;
    
    this.ctx.globalAlpha = this.leafAlpha;
    this.ctx.fillStyle = this.leafColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, leafRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Resizes the canvas and resets the simulation.
   */
  resize(width, height) {
    if (!this.canvas) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.reset();
  }

  /**
   * Updates configuration and resets the tree.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.maxDepth - Max depth (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls growth progress)
   * @param {number} config.branchFactor - Number of branches per node
   * @param {number} config.baseSpreadDeg - Angle spread between branches
   * @param {number} config.lengthDecay - Length reduction per level
   * @param {number} config.angleJitterDeg - Random angle variation
   * @param {number} config.gravityBend - Downward bend factor
   * @param {number} config.growthRate - Segments to grow per frame
   * @param {string} config.renderStyle - 'straight' or 'bezier'
   * @param {boolean} config.showLeaves - Whether to show leaves
   * @param {number} config.seed - Random seed
   */
  updateConfig(config) {
    let needsReset = false;

    if (config.branchFactor !== undefined) {
      const newFactor = this.clamp(config.branchFactor, 2, 3);
      if (newFactor !== this.branchFactor) {
        this.branchFactor = newFactor;
        needsReset = true;
      }
    }
    if (config.baseSpreadDeg !== undefined) {
      const newSpread = this.clamp(config.baseSpreadDeg, 5, 45);
      if (newSpread !== this.baseSpreadDeg) {
        this.baseSpreadDeg = newSpread;
        needsReset = true;
      }
    }
    if (config.lengthDecay !== undefined) {
      const newDecay = this.clamp(config.lengthDecay, 0.55, 0.85);
      if (newDecay !== this.lengthDecay) {
        this.lengthDecay = newDecay;
        needsReset = true;
      }
    }
    if (config.maxDepth !== undefined) {
      const newDepth = this.clamp(config.maxDepth, 6, 13);
      if (newDepth !== this.maxDepth) {
        this.maxDepth = newDepth;
        needsReset = true;
      }
    }
    if (config.angleJitterDeg !== undefined) {
      this.angleJitterDeg = this.clamp(config.angleJitterDeg, 0, 6);
    }
    if (config.gravityBend !== undefined) {
      this.gravityBend = this.clamp(config.gravityBend, 0, 0.25);
    }
    if (config.growthRate !== undefined) {
      this.growthRate = this.clamp(config.growthRate, 1, 20);
    }
    if (config.renderStyle !== undefined) {
      this.renderStyle = config.renderStyle;
    }
    if (config.showLeaves !== undefined) {
      this.showLeaves = config.showLeaves;
    }
    if (config.seed !== undefined) {
      this.rng = new SeededRandom(config.seed);
      needsReset = true;
    }

    // Update target segments based on allocated resources
    // Calculate maximum possible segments for the tree
    if (config.allocated !== undefined) {
      // Estimate max segments: sum of branchFactor^depth for each depth
      let maxSegments = 1; // Root
      for (let d = 1; d <= this.maxDepth; d++) {
        maxSegments += Math.pow(this.branchFactor, d);
      }
      // Start with 1 segment (root) and grow based on allocation
      const minSegments = 1;
      const required = Math.max(1, 4 + this.maxDepth * 4);
      const progress = Math.min(1, config.allocated / required);
      this.targetSegments = Math.floor(minSegments + (maxSegments - minSegments) * progress);
    }

    if (needsReset) {
      this.reset();
    }
  }
}

// Add pan and zoom functionality to FractalTreeSimulation
addPanZoomToFractal(FractalTreeSimulation.prototype);
