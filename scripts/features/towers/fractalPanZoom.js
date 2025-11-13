/**
 * Fractal Pan and Zoom Mixin
 * 
 * Provides pan and zoom functionality that can be added to any fractal simulation.
 * Supports both mouse (desktop) and touch (mobile) input.
 */

/**
 * Mixin to add pan and zoom capabilities to a fractal simulation class.
 * 
 * Usage:
 *   class MyFractal {
 *     constructor(options) {
 *       // ... existing constructor code ...
 *       this.initPanZoom(this.canvas);
 *     }
 *   }
 *   addPanZoomToFractal(MyFractal.prototype);
 * 
 * @param {Object} proto - Prototype to add pan/zoom methods to
 */
export function addPanZoomToFractal(proto) {
  /**
   * Initialize pan and zoom state and event listeners
   * @param {HTMLCanvasElement} canvas - Canvas element to attach listeners to
   */
  proto.initPanZoom = function(canvas) {
    if (!canvas) return;
    
    // Pan and zoom state
    this.panZoom = {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      minScale: 0.1,
      maxScale: 10,
      isDragging: false,
      lastX: 0,
      lastY: 0,
      touchStartDistance: 0,
    };
    
    // Bind event listeners
    this._boundHandlers = {
      mouseDown: this._handleMouseDown.bind(this),
      mouseMove: this._handleMouseMove.bind(this),
      mouseUp: this._handleMouseUp.bind(this),
      wheel: this._handleWheel.bind(this),
      touchStart: this._handleTouchStart.bind(this),
      touchMove: this._handleTouchMove.bind(this),
      touchEnd: this._handleTouchEnd.bind(this),
    };
    
    canvas.addEventListener('mousedown', this._boundHandlers.mouseDown);
    canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
    canvas.addEventListener('mouseup', this._boundHandlers.mouseUp);
    canvas.addEventListener('mouseleave', this._boundHandlers.mouseUp);
    canvas.addEventListener('wheel', this._boundHandlers.wheel, { passive: false });
    
    canvas.addEventListener('touchstart', this._boundHandlers.touchStart, { passive: false });
    canvas.addEventListener('touchmove', this._boundHandlers.touchMove, { passive: false });
    canvas.addEventListener('touchend', this._boundHandlers.touchEnd);
    canvas.addEventListener('touchcancel', this._boundHandlers.touchEnd);
  };
  
  /**
   * Clean up event listeners
   */
  proto.cleanupPanZoom = function() {
    if (!this.canvas || !this._boundHandlers) return;
    
    this.canvas.removeEventListener('mousedown', this._boundHandlers.mouseDown);
    this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
    this.canvas.removeEventListener('mouseup', this._boundHandlers.mouseUp);
    this.canvas.removeEventListener('mouseleave', this._boundHandlers.mouseUp);
    this.canvas.removeEventListener('wheel', this._boundHandlers.wheel);
    
    this.canvas.removeEventListener('touchstart', this._boundHandlers.touchStart);
    this.canvas.removeEventListener('touchmove', this._boundHandlers.touchMove);
    this.canvas.removeEventListener('touchend', this._boundHandlers.touchEnd);
    this.canvas.removeEventListener('touchcancel', this._boundHandlers.touchEnd);
  };
  
  /**
   * Apply the current pan and zoom transformation to the canvas context
   * Call this at the start of your render method
   */
  proto.applyPanZoomTransform = function() {
    if (!this.ctx || !this.panZoom) return;
    
    this.ctx.save();
    this.ctx.translate(this.panZoom.offsetX, this.panZoom.offsetY);
    this.ctx.scale(this.panZoom.scale, this.panZoom.scale);
  };
  
  /**
   * Restore the canvas context after rendering
   * Call this at the end of your render method
   */
  proto.restorePanZoomTransform = function() {
    if (!this.ctx) return;
    this.ctx.restore();
  };
  
  /**
   * Reset pan and zoom to defaults
   */
  proto.resetPanZoom = function() {
    if (!this.panZoom) return;
    
    this.panZoom.offsetX = 0;
    this.panZoom.offsetY = 0;
    this.panZoom.scale = 1;
  };
  
  // Private mouse event handlers
  proto._handleMouseDown = function(e) {
    if (!this.panZoom) return;
    
    this.panZoom.isDragging = true;
    this.panZoom.lastX = e.clientX;
    this.panZoom.lastY = e.clientY;
    e.preventDefault();
  };
  
  proto._handleMouseMove = function(e) {
    if (!this.panZoom || !this.panZoom.isDragging) return;
    
    const dx = e.clientX - this.panZoom.lastX;
    const dy = e.clientY - this.panZoom.lastY;
    
    this.panZoom.offsetX += dx;
    this.panZoom.offsetY += dy;
    
    this.panZoom.lastX = e.clientX;
    this.panZoom.lastY = e.clientY;
    
    e.preventDefault();
  };
  
  proto._handleMouseUp = function(e) {
    if (!this.panZoom) return;
    this.panZoom.isDragging = false;
  };
  
  proto._handleWheel = function(e) {
    if (!this.panZoom) return;
    
    e.preventDefault();
    
    // Get mouse position relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = this.panZoom.scale * zoomFactor;
    
    // Clamp scale
    if (newScale < this.panZoom.minScale || newScale > this.panZoom.maxScale) {
      return;
    }
    
    // Zoom towards mouse position
    const scaleChange = newScale - this.panZoom.scale;
    this.panZoom.offsetX -= (mouseX - this.panZoom.offsetX) * (scaleChange / this.panZoom.scale);
    this.panZoom.offsetY -= (mouseY - this.panZoom.offsetY) * (scaleChange / this.panZoom.scale);
    this.panZoom.scale = newScale;
  };
  
  // Private touch event handlers
  proto._handleTouchStart = function(e) {
    if (!this.panZoom) return;
    
    if (e.touches.length === 1) {
      // Single touch - start panning
      this.panZoom.isDragging = true;
      this.panZoom.lastX = e.touches[0].clientX;
      this.panZoom.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      this.panZoom.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.panZoom.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
    }
    
    e.preventDefault();
  };
  
  proto._handleTouchMove = function(e) {
    if (!this.panZoom) return;
    
    if (e.touches.length === 1 && this.panZoom.isDragging) {
      // Single touch - pan
      const dx = e.touches[0].clientX - this.panZoom.lastX;
      const dy = e.touches[0].clientY - this.panZoom.lastY;
      
      this.panZoom.offsetX += dx;
      this.panZoom.offsetY += dy;
      
      this.panZoom.lastX = e.touches[0].clientX;
      this.panZoom.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (this.panZoom.touchStartDistance > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
        
        const scaleFactor = distance / this.panZoom.touchStartDistance;
        const newScale = this.panZoom.scale * scaleFactor;
        
        // Clamp scale
        if (newScale >= this.panZoom.minScale && newScale <= this.panZoom.maxScale) {
          const scaleChange = newScale - this.panZoom.scale;
          this.panZoom.offsetX -= (centerX - this.panZoom.offsetX) * (scaleChange / this.panZoom.scale);
          this.panZoom.offsetY -= (centerY - this.panZoom.offsetY) * (scaleChange / this.panZoom.scale);
          this.panZoom.scale = newScale;
        }
      }
      
      this.panZoom.touchStartDistance = distance;
    }
    
    e.preventDefault();
  };
  
  proto._handleTouchEnd = function(e) {
    if (!this.panZoom) return;
    
    if (e.touches.length === 0) {
      this.panZoom.isDragging = false;
      this.panZoom.touchStartDistance = 0;
    } else if (e.touches.length === 1) {
      // Switch back to pan mode
      this.panZoom.isDragging = true;
      this.panZoom.lastX = e.touches[0].clientX;
      this.panZoom.lastY = e.touches[0].clientY;
      this.panZoom.touchStartDistance = 0;
    }
  };
}

/**
 * Helper function to wrap an existing render method with pan/zoom transforms
 * @param {Function} originalRender - The original render method
 * @returns {Function} Wrapped render method
 */
export function wrapRenderWithPanZoom(originalRender) {
  return function(...args) {
    if (this.panZoom && this.ctx) {
      this.applyPanZoomTransform();
      originalRender.apply(this, args);
      this.restorePanZoomTransform();
    } else {
      originalRender.apply(this, args);
    }
  };
}
