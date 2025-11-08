/**
 * Julia Set Cloud Fractal Simulation
 * 
 * Implements a Julia set fractal using the formula:
 * z_{n+1} = z_n^4 - c, where c = (2 + 3i) / 6
 * 
 * This creates organic, cloud-like formations through escape-time iteration.
 * The grayscale coloring is based on how quickly points escape to infinity.
 * 
 * Features:
 * - Configurable zoom and center position
 * - Smooth grayscale gradient mapping
 * - Optimized escape-time algorithm
 * - Compatible with Shin UI framework
 */

/**
 * Julia Cloud Fractal Simulation - Cloud-like patterns via Julia set iteration.
 */
export class JuliaCloudSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style
    this.bgColor = options.bgColor || '#0f1116';

    // Julia set parameters
    this.maxIterations = this.clamp(options.maxIterations || 100, 10, 500);
    this.zoom = options.zoom || 1.5;
    this.centerX = options.centerX || 0;
    this.centerY = options.centerY || 0;

    // Complex constant c = (2 + 3i) / 6
    this.cReal = 2.0 / 6.0; // 0.333...
    this.cImag = 3.0 / 6.0; // 0.5

    // Escape radius (standard for Julia sets)
    this.escapeRadius = 2.0;
    this.escapeRadiusSquared = this.escapeRadius * this.escapeRadius;

    // Canvas dimensions
    this.width = this.canvas ? this.canvas.width : 240;
    this.height = this.canvas ? this.canvas.height : 320;

    // Image data for rendering
    this.imageData = null;
    this.needsRerender = true;
  }

  /**
   * Clamps a value between min and max.
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Computes z^4 for a complex number z = (zReal, zImag).
   * Returns {real, imag} components of z^4.
   * 
   * Formula: z^4 = (a + bi)^4
   * First compute z^2 = (a^2 - b^2) + (2ab)i
   * Then compute (z^2)^2
   */
  complexPower4(zReal, zImag) {
    // z^2
    const z2Real = zReal * zReal - zImag * zImag;
    const z2Imag = 2 * zReal * zImag;
    
    // (z^2)^2 = z^4
    const z4Real = z2Real * z2Real - z2Imag * z2Imag;
    const z4Imag = 2 * z2Real * z2Imag;
    
    return { real: z4Real, imag: z4Imag };
  }

  /**
   * Performs Julia set iteration for a single point in the complex plane.
   * Returns the iteration count (0 to maxIterations).
   * 
   * Algorithm:
   * - Start with z0 = (x + yi)
   * - Iterate: z_{n+1} = z_n^4 - c
   * - Stop when |z| > escapeRadius or max iterations reached
   * 
   * @param {number} x0 - Real component of initial z
   * @param {number} y0 - Imaginary component of initial z
   * @returns {number} Iteration count before escape
   */
  juliaIteration(x0, y0) {
    let zReal = x0;
    let zImag = y0;
    
    for (let i = 0; i < this.maxIterations; i++) {
      // Check escape condition: |z|^2 > escapeRadius^2
      const magnitudeSquared = zReal * zReal + zImag * zImag;
      if (magnitudeSquared > this.escapeRadiusSquared) {
        return i;
      }
      
      // z_{n+1} = z_n^4 - c
      const z4 = this.complexPower4(zReal, zImag);
      zReal = z4.real - this.cReal;
      zImag = z4.imag - this.cImag;
    }
    
    // Point didn't escape
    return this.maxIterations;
  }

  /**
   * Maps iteration count to a grayscale color value (0-255).
   * Uses smooth gradient for aesthetic appeal.
   * 
   * @param {number} iterations - Iteration count
   * @returns {number} Grayscale value (0-255)
   */
  iterationToGrayscale(iterations) {
    if (iterations >= this.maxIterations) {
      // Points in the set are black
      return 0;
    }
    
    // Smooth gradient mapping
    // Logarithmic scaling for better visual distribution
    const t = Math.log(iterations + 1) / Math.log(this.maxIterations + 1);
    return Math.floor(t * 255);
  }

  /**
   * Maps canvas pixel coordinates to complex plane coordinates.
   * 
   * @param {number} px - Pixel x coordinate
   * @param {number} py - Pixel y coordinate
   * @returns {{real: number, imag: number}} Complex plane coordinates
   */
  pixelToComplex(px, py) {
    // Map pixel coordinates to [-2, 2] range with zoom and center
    const real = this.centerX + (px / this.width - 0.5) * (4.0 / this.zoom);
    const imag = this.centerY + (py / this.height - 0.5) * (4.0 / this.zoom);
    return { real, imag };
  }

  /**
   * Renders the Julia set fractal to the canvas.
   * Computes the fractal for all pixels and displays with grayscale coloring.
   */
  render() {
    if (!this.ctx || !this.canvas) return;

    // Only rerender if parameters changed
    if (!this.needsRerender && this.imageData) {
      this.ctx.putImageData(this.imageData, 0, 0);
      return;
    }

    // Create image data buffer
    this.imageData = this.ctx.createImageData(this.width, this.height);
    const data = this.imageData.data;

    // Compute Julia set for each pixel
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        // Map pixel to complex plane
        const { real, imag } = this.pixelToComplex(px, py);
        
        // Compute iteration count
        const iterations = this.juliaIteration(real, imag);
        
        // Convert to grayscale color
        const gray = this.iterationToGrayscale(iterations);
        
        // Set pixel in image data (RGBA format)
        const index = (py * this.width + px) * 4;
        data[index] = gray;         // Red
        data[index + 1] = gray;     // Green
        data[index + 2] = gray;     // Blue
        data[index + 3] = 255;      // Alpha (fully opaque)
      }
    }

    // Draw to canvas
    this.ctx.putImageData(this.imageData, 0, 0);
    this.needsRerender = false;
  }

  /**
   * Update method for animation loop compatibility.
   * Julia sets are static, so this is a no-op.
   */
  update() {
    // Julia set is static, no animation needed
  }

  /**
   * Resizes the canvas and triggers a rerender.
   */
  resize(width, height) {
    if (!this.canvas) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.needsRerender = true;
  }

  /**
   * Updates configuration and triggers a rerender.
   */
  updateConfig(config) {
    let changed = false;
    
    if (config.maxIterations !== undefined) {
      this.maxIterations = this.clamp(config.maxIterations, 10, 500);
      changed = true;
    }
    if (config.zoom !== undefined) {
      this.zoom = config.zoom;
      changed = true;
    }
    if (config.centerX !== undefined) {
      this.centerX = config.centerX;
      changed = true;
    }
    if (config.centerY !== undefined) {
      this.centerY = config.centerY;
      changed = true;
    }

    if (changed) {
      this.needsRerender = true;
    }
  }
}
