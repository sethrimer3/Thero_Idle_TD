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
import {
  VISUAL_STYLE_DEFAULTS,
  GROWTH_PARAMETERS,
  RENDERING_DEFAULTS,
  INITIAL_TREE_DEFAULTS,
  ANIMATION_DEFAULTS,
} from './fractalTreeSimulationConfig.js';

// Pre-calculated constants for performance optimization
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const DEG_TO_RAD = Math.PI / 180;
const MAX_COLOR_CACHE_SIZE = 1000; // Limit color interpolation cache to prevent memory issues

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
    this.hasGrown = false; // Whether this segment has fully grown
    this.isGrowing = false; // Whether the segment tip is currently extending
    this.growthProgress = 0; // 0 to 1 progress for animated growth
    this.age = 0; // Frames since this segment finished growing
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
    this.bgColor = options.bgColor || VISUAL_STYLE_DEFAULTS.bgColor;
    this.trunkColor = options.trunkColor || VISUAL_STYLE_DEFAULTS.trunkColor;
    this.twigColor = options.twigColor || VISUAL_STYLE_DEFAULTS.twigColor;
    this.leafColor = options.leafColor || VISUAL_STYLE_DEFAULTS.leafColor;
    this.leafAlpha = options.leafAlpha || VISUAL_STYLE_DEFAULTS.leafAlpha;
    this.showLeaves = options.showLeaves !== undefined ? options.showLeaves : VISUAL_STYLE_DEFAULTS.showLeaves;
    this.depthColors = Array.isArray(options.depthColors) ? options.depthColors : VISUAL_STYLE_DEFAULTS.depthColors;

    // Growth parameters
    this.branchFactor = this.clamp(
      options.branchFactor || GROWTH_PARAMETERS.branchFactor.default,
      GROWTH_PARAMETERS.branchFactor.min,
      GROWTH_PARAMETERS.branchFactor.max
    );
    this.baseSpreadDeg = this.clamp(
      options.baseSpreadDeg || GROWTH_PARAMETERS.baseSpreadDeg.default,
      GROWTH_PARAMETERS.baseSpreadDeg.min,
      GROWTH_PARAMETERS.baseSpreadDeg.max
    );
    this.lengthDecay = this.clamp(
      options.lengthDecay || GROWTH_PARAMETERS.lengthDecay.default,
      GROWTH_PARAMETERS.lengthDecay.min,
      GROWTH_PARAMETERS.lengthDecay.max
    );
    this.maxDepth = this.clamp(
      options.maxDepth || GROWTH_PARAMETERS.maxDepth.default,
      GROWTH_PARAMETERS.maxDepth.min,
      GROWTH_PARAMETERS.maxDepth.max
    );
    this.angleJitterDeg = this.clamp(
      options.angleJitterDeg || GROWTH_PARAMETERS.angleJitterDeg.default,
      GROWTH_PARAMETERS.angleJitterDeg.min,
      GROWTH_PARAMETERS.angleJitterDeg.max
    );
    this.gravityBend = this.clamp(
      options.gravityBend || GROWTH_PARAMETERS.gravityBend.default,
      GROWTH_PARAMETERS.gravityBend.min,
      GROWTH_PARAMETERS.gravityBend.max
    );
    this.growthRate = this.clamp(
      options.growthRate || GROWTH_PARAMETERS.growthRate.default,
      GROWTH_PARAMETERS.growthRate.min,
      GROWTH_PARAMETERS.growthRate.max
    );
    this.growthAnimationSpeed = this.clamp(
      options.growthAnimationSpeed || GROWTH_PARAMETERS.growthAnimationSpeed.default,
      GROWTH_PARAMETERS.growthAnimationSpeed.min,
      GROWTH_PARAMETERS.growthAnimationSpeed.max
    );

    // Rendering style
    this.renderStyle = options.renderStyle || RENDERING_DEFAULTS.renderStyle;
    this.baseWidth = options.baseWidth || RENDERING_DEFAULTS.baseWidth;
    this.minWidth = options.minWidth || RENDERING_DEFAULTS.minWidth;

    // Initial tree parameters
    this.rootLength = options.rootLength || INITIAL_TREE_DEFAULTS.rootLength;
    this.rootX = options.rootX || INITIAL_TREE_DEFAULTS.rootX;
    this.rootY = options.rootY || INITIAL_TREE_DEFAULTS.rootY;

    // State
    this.segments = [];
    this.growthQueue = [];
    this.segmentMap = new Map();
    this.isComplete = false;
    this.rng = new SeededRandom(options.seed || Date.now());
    
    // Animation
    this.haloFrames = ANIMATION_DEFAULTS.haloFrames;
    this.enableHalos = options.enableHalos !== undefined ? Boolean(options.enableHalos) : ANIMATION_DEFAULTS.enableHalos;

    // Growth control based on allocated resources
    this.targetSegments = 1; // Start with just the root (simple stem)
    this.segmentsGrown = 0; // Count of segments that have been grown
    this.maxSegments = this.computeMaxSegments();

    // Color interpolation cache for performance
    this.colorCache = new Map();

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
   * Converts degrees to radians using pre-calculated constant.
   */
  degToRad(deg) {
    return deg * DEG_TO_RAD;
  }

  /**
   * Interpolates between two colors based on a factor (0 to 1).
   * Colors should be in hex format like '#rrggbb'.
   * Cached for performance when called repeatedly with the same inputs.
   */
  interpolateColor(color1, color2, factor) {
    factor = this.clamp(factor, 0, 1);
    
    // Create cache key from the two colors and rounded factor (to limit cache size)
    // Use higher precision (1000) to reduce visible banding in smooth color transitions
    const roundedFactor = Math.floor(factor * 1000) * 0.001;
    const cacheKey = `${color1}|${color2}|${roundedFactor}`;
    
    // Check cache first
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey);
    }
    
    // Parse colors only once
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
    
    const result = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    // Store in cache (limit cache size to prevent memory issues)
    if (this.colorCache.size < MAX_COLOR_CACHE_SIZE) {
      this.colorCache.set(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Resolve the stroke color for a given depth, honoring explicit depth palettes when present.
   * @param {number} depth
   * @returns {string}
   */
  getDepthColor(depth) {
    if (Array.isArray(this.depthColors) && this.depthColors.length) {
      const clampedDepth = Math.max(0, Math.min(depth, this.depthColors.length - 1));
      return this.depthColors[clampedDepth];
    }

    const depthFactor = depth / this.maxDepth;
    return this.interpolateColor(this.trunkColor, this.twigColor, depthFactor);
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
    this.maxSegments = this.computeMaxSegments();
    this.colorCache.clear(); // Clear color cache on reset

    if (!this.canvas) return;

    // Create root segment
    const startX = this.canvas.width * this.rootX;
    const startY = this.canvas.height * this.rootY;
    const rootAngle = -HALF_PI; // Pointing upward
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
   * Calculate the maximum number of segments this tree can ever grow.
   * @returns {number}
   */
  computeMaxSegments() {
    let maxSegments = 1; // Root
    for (let depth = 1; depth <= this.maxDepth; depth++) {
      maxSegments += Math.pow(this.branchFactor, depth);
    }
    return maxSegments;
  }

  /**
   * Set the number of segments the simulation should eventually grow.
   * @param {number} count
   */
  setTargetSegments(count) {
    if (!Number.isFinite(count)) {
      return;
    }
    this.targetSegments = Math.max(1, Math.min(this.maxSegments, Math.round(count)));
  }

  /**
   * Increment the growth budget by a number of segments (lines).
   * @param {number} count
   */
  addGrowthSegments(count) {
    if (!Number.isFinite(count) || count === 0) {
      return;
    }
    this.setTargetSegments(this.targetSegments + count);
  }

  /**
   * Updates the simulation by growing segments from the queue.
   */
  update() {
    let activeGrowth = false;

    // Animate growth progress and age fully grown segments.
    for (const segment of this.segments) {
      if (segment.isGrowing && segment.growthProgress < 1) {
        segment.growthProgress = Math.min(1, segment.growthProgress + this.growthAnimationSpeed);
        if (segment.growthProgress < 1) {
          activeGrowth = true;
        } else if (!segment.hasGrown) {
          // Segment finished growing; allow children to spawn on the next frame.
          segment.hasGrown = true;
          segment.isGrowing = false;
          segment.age = 0;

          if (segment.depth < this.maxDepth) {
            this.spawnChildren(segment);
          }
        }
      }

      if (segment.hasGrown) {
        segment.age++;
      }
    }

    if (this.segmentsGrown >= this.targetSegments) {
      this.isComplete = this.growthQueue.length === 0 && !activeGrowth;
      return;
    }

    // Grow segments up to the target based on allocated resources
    const remaining = this.targetSegments - this.segmentsGrown;
    const segmentsToGrow = Math.min(this.growthRate, this.growthQueue.length, remaining);

    for (let i = 0; i < segmentsToGrow; i++) {
      const segment = this.growthQueue.shift();
      segment.isGrowing = true;
      segment.growthProgress = 0;
      segment.age = 0;
      this.segmentsGrown++;
      activeGrowth = true;
    }

    this.isComplete = this.growthQueue.length === 0 && !activeGrowth;
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
      const progress = segment.hasGrown ? 1 : segment.growthProgress;
      if (progress <= 0) continue;

      // Calculate color based on depth
      const color = this.getDepthColor(segment.depth);

      // Draw segment
      if (this.renderStyle === 'bezier') {
        this.drawBezierSegment(segment, color, progress);
      } else {
        this.drawStraightSegment(segment, color, progress);
      }

      const tipX = segment.x + (segment.endX - segment.x) * progress;
      const tipY = segment.y + (segment.endY - segment.y) * progress;

      // Draw halo effect for recently grown segments
      if (this.enableHalos) {
        if (segment.hasGrown && segment.age < this.haloFrames) {
          this.drawHalo(tipX, tipY, segment.width, segment.age);
        } else if (segment.isGrowing && progress < 1) {
          // Keep the growth tip glowing while the branch extends.
          const glowAge = Math.round((1 - progress) * this.haloFrames * 0.5);
          this.drawHalo(tipX, tipY, segment.width, glowAge);
        }
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
  drawStraightSegment(segment, color, progress = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = segment.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = 0.9;

    const clamped = this.clamp(progress, 0, 1);
    const endX = segment.x + (segment.endX - segment.x) * clamped;
    const endY = segment.y + (segment.endY - segment.y) * clamped;

    this.ctx.beginPath();
    this.ctx.moveTo(segment.x, segment.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a segment with a subtle Bézier curve for natural appearance.
   */
  drawBezierSegment(segment, color, progress = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = segment.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = 0.9;

    // Calculate control point with slight perpendicular offset using cached values
    const midX = (segment.x + segment.endX) * 0.5;
    const midY = (segment.y + segment.endY) * 0.5;

    // Perpendicular offset for curve (10% of length) using cached bezierOffset
    const perpAngle = segment.angle + HALF_PI;
    const offsetMag = segment.length * 0.1;
    const controlX = midX + Math.cos(perpAngle) * offsetMag * segment.bezierOffset.x;
    const controlY = midY + Math.sin(perpAngle) * offsetMag * segment.bezierOffset.y;

    const clamped = this.clamp(progress, 0, 1);
    if (clamped < 1) {
      // Use De Casteljau's algorithm to draw a partial quadratic Bézier segment.
      const p0x = segment.x;
      const p0y = segment.y;
      const p1x = controlX;
      const p1y = controlY;
      const p2x = segment.endX;
      const p2y = segment.endY;

      const q0x = p0x + (p1x - p0x) * clamped;
      const q0y = p0y + (p1y - p0y) * clamped;
      const q1x = p1x + (p2x - p1x) * clamped;
      const q1y = p1y + (p2y - p1y) * clamped;
      const rx = q0x + (q1x - q0x) * clamped;
      const ry = q0y + (q1y - q0y) * clamped;

      this.ctx.beginPath();
      this.ctx.moveTo(p0x, p0y);
      this.ctx.quadraticCurveTo(q0x, q0y, rx, ry);
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(segment.x, segment.y);
      this.ctx.quadraticCurveTo(controlX, controlY, segment.endX, segment.endY);
    }
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
    this.ctx.arc(x, y, radius, 0, TWO_PI);
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
    this.ctx.arc(x, y, leafRadius, 0, TWO_PI);
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
   * @param {Array<string>} config.depthColors - Optional explicit palette keyed by depth
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
      this.renderStyle = config.renderStyle === 'straight' ? 'straight' : 'bezier';
    }
    if (config.showLeaves !== undefined) {
      this.showLeaves = Boolean(config.showLeaves);
    }
    if (config.depthColors !== undefined) {
      this.depthColors = Array.isArray(config.depthColors) ? config.depthColors : null;
    }
    if (config.seed !== undefined) {
      this.rng = new SeededRandom(config.seed);
      needsReset = true;
    }

    // Recalculate the maximum attainable segments whenever structure inputs change.
    this.maxSegments = this.computeMaxSegments();

    // Update target segments based on allocated resources
    // Calculate maximum possible segments for the tree
    if (config.allocated !== undefined) {
      // Start with 1 segment (root) and grow based on allocation
      const minSegments = 1;
      const required = Math.max(1, 4 + this.maxDepth * 4);
      const progress = Math.min(1, config.allocated / required);
      this.setTargetSegments(minSegments + (this.maxSegments - minSegments) * progress);
    }

    if (needsReset) {
      this.reset();
    }
  }
}

// Add pan and zoom functionality to FractalTreeSimulation
addPanZoomToFractal(FractalTreeSimulation.prototype);
