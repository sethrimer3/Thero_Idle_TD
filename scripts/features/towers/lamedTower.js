/**
 * Lamed tower gravity simulation module.
 * Provides an idle physics simulation with orbital mechanics for sparks around a central gravity well.
 */

/**
 * GravitySimulation for the Lamed Spire.
 * 
 * Simulates sparks spawning from random edges, orbiting around a central gravity well,
 * and eventually being absorbed to increase the star's mass.
 */
export class GravitySimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Callbacks
    this.onSparkBankChange = typeof options.onSparkBankChange === 'function' ? options.onSparkBankChange : null;
    this.onStarMassChange = typeof options.onStarMassChange === 'function' ? options.onStarMassChange : null;
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    
    // Physics parameters
    this.gravitationalConstant = 150; // Controls strength of gravity well
    this.starMass = 100; // Initial mass of central star
    this.starRadius = 15; // Visual radius of star
    this.absorptionRadius = 20; // Radius at which sparks are absorbed
    this.maxStarMass = 1000; // Maximum star mass
    
    // Spark management
    this.sparks = [];
    this.sparkBank = 0; // Idle currency
    this.maxSparks = 50; // Maximum number of active sparks
    this.sparkSpawnRate = 1; // Sparks per second
    this.spawnAccumulator = 0;
    this.sparkSpeed = 80; // Initial velocity for spawned sparks
    
    // Trail rendering
    this.trailLength = 30; // Number of trail points to keep
    this.trailFadeRate = 0.02; // How quickly trails fade
    
    // Visual settings
    this.backgroundColor = '#000000'; // Black space
    this.starColor = '#ffffff';
    this.sparkColor = '#8BF7FF'; // Cyan glow
    this.trailColor = '#8BF7FF';
    
    // Animation state
    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;
    
    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }
  }
  
  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }
  
  /**
   * Spawn a new spark from a random edge
   */
  spawnSpark() {
    if (this.sparks.length >= this.maxSparks) return;
    
    // Choose random edge (0=top, 1=right, 2=bottom, 3=left)
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    
    const speed = this.sparkSpeed;
    const angle = Math.random() * Math.PI * 2;
    
    switch (edge) {
      case 0: // Top
        x = Math.random() * this.width;
        y = 0;
        vx = Math.cos(angle) * speed;
        vy = speed * (0.5 + Math.random() * 0.5); // Downward bias
        break;
      case 1: // Right
        x = this.width;
        y = Math.random() * this.height;
        vx = -speed * (0.5 + Math.random() * 0.5); // Leftward bias
        vy = Math.sin(angle) * speed;
        break;
      case 2: // Bottom
        x = Math.random() * this.width;
        y = this.height;
        vx = Math.cos(angle) * speed;
        vy = -speed * (0.5 + Math.random() * 0.5); // Upward bias
        break;
      case 3: // Left
        x = 0;
        y = Math.random() * this.height;
        vx = speed * (0.5 + Math.random() * 0.5); // Rightward bias
        vy = Math.sin(angle) * speed;
        break;
    }
    
    this.sparks.push({
      x,
      y,
      vx,
      vy,
      trail: [], // Array of {x, y, alpha} points
      life: 1.0, // For fade-out effect
    });
  }
  
  /**
   * Update physics for all sparks
   */
  updateSparks(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Spawn new sparks
    this.spawnAccumulator += dt * this.sparkSpawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnSpark();
      this.spawnAccumulator -= 1;
    }
    
    // Update each spark
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      
      // Calculate distance to center
      const dx = this.centerX - spark.x;
      const dy = this.centerY - spark.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      // Check if spark should be absorbed
      if (dist < this.absorptionRadius) {
        // Increase star mass
        const massGain = 1;
        this.starMass = Math.min(this.starMass + massGain, this.maxStarMass);
        this.sparkBank += 1;
        
        if (this.onStarMassChange) {
          this.onStarMassChange(this.starMass);
        }
        if (this.onSparkBankChange) {
          this.onSparkBankChange(this.sparkBank);
        }
        
        // Remove spark
        this.sparks.splice(i, 1);
        continue;
      }
      
      // Calculate gravitational acceleration
      const force = (this.gravitationalConstant * this.starMass) / distSq;
      const ax = (dx / dist) * force;
      const ay = (dy / dist) * force;
      
      // Update velocity
      spark.vx += ax * dt;
      spark.vy += ay * dt;
      
      // Update position
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      
      // Add current position to trail
      spark.trail.push({
        x: spark.x,
        y: spark.y,
        alpha: 1.0,
      });
      
      // Limit trail length
      if (spark.trail.length > this.trailLength) {
        spark.trail.shift();
      }
      
      // Fade trail points
      for (const point of spark.trail) {
        point.alpha = Math.max(0, point.alpha - this.trailFadeRate);
      }
      
      // Remove spark if it goes too far off screen
      const margin = 100;
      if (spark.x < -margin || spark.x > this.width + margin ||
          spark.y < -margin || spark.y > this.height + margin) {
        this.sparks.splice(i, 1);
      }
    }
  }
  
  /**
   * Render the simulation
   */
  render() {
    if (!this.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    
    // Clear with black background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width / dpr, this.height / dpr);
    
    // Draw central star
    const starRadiusScaled = this.starRadius * (1 + (this.starMass / this.maxStarMass) * 0.5);
    const centerXScaled = this.centerX / dpr;
    const centerYScaled = this.centerY / dpr;
    
    // Glow effect for star
    const gradient = ctx.createRadialGradient(
      centerXScaled, centerYScaled, 0,
      centerXScaled, centerYScaled, starRadiusScaled * 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(139, 247, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(139, 247, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, starRadiusScaled * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw core star
    ctx.fillStyle = this.starColor;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, starRadiusScaled, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw absorption radius (faint circle)
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, this.absorptionRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw sparks and trails
    for (const spark of this.sparks) {
      // Draw trail
      if (spark.trail.length > 1) {
        ctx.strokeStyle = this.trailColor;
        ctx.lineWidth = 1.5;
        
        for (let i = 1; i < spark.trail.length; i++) {
          const prev = spark.trail[i - 1];
          const curr = spark.trail[i];
          
          const alpha = curr.alpha * 0.5;
          ctx.globalAlpha = alpha;
          
          ctx.beginPath();
          ctx.moveTo(prev.x / dpr, prev.y / dpr);
          ctx.lineTo(curr.x / dpr, curr.y / dpr);
          ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
      }
      
      // Draw spark
      const sparkX = spark.x / dpr;
      const sparkY = spark.y / dpr;
      
      // Glow effect
      const sparkGradient = ctx.createRadialGradient(
        sparkX, sparkY, 0,
        sparkX, sparkY, 4
      );
      sparkGradient.addColorStop(0, 'rgba(139, 247, 255, 1)');
      sparkGradient.addColorStop(0.5, 'rgba(139, 247, 255, 0.6)');
      sparkGradient.addColorStop(1, 'rgba(139, 247, 255, 0)');
      
      ctx.fillStyle = sparkGradient;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Core spark
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  /**
   * Main animation loop step
   */
  step(timestamp) {
    if (!this.running) return;
    
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }
    
    const deltaTime = Math.min(timestamp - this.lastFrame, 100); // Cap at 100ms
    this.lastFrame = timestamp;
    
    this.updateSparks(deltaTime);
    this.render();
    
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
  }
  
  /**
   * Set the spark spawn rate
   */
  setSparkSpawnRate(rate) {
    this.sparkSpawnRate = Math.max(0, rate);
  }
  
  /**
   * Add sparks to the bank
   */
  addToSparkBank(amount) {
    this.sparkBank += amount;
    if (this.onSparkBankChange) {
      this.onSparkBankChange(this.sparkBank);
    }
  }
  
  /**
   * Get current state for serialization
   */
  getState() {
    return {
      starMass: this.starMass,
      sparkBank: this.sparkBank,
      sparkCount: this.sparks.length,
    };
  }
  
  /**
   * Restore state from serialized data
   */
  setState(state) {
    if (state && typeof state === 'object') {
      if (Number.isFinite(state.starMass)) {
        this.starMass = Math.max(0, Math.min(state.starMass, this.maxStarMass));
      }
      if (Number.isFinite(state.sparkBank)) {
        this.sparkBank = Math.max(0, state.sparkBank);
        if (this.onSparkBankChange) {
          this.onSparkBankChange(this.sparkBank);
        }
      }
    }
  }
}
