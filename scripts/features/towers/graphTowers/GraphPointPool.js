/**
 * GraphPointPool — high-performance object pool for graph points.
 *
 * Avoids garbage-collection churn when hundreds of points are created and
 * expired every second.  Dead points are recycled via a free-list so the
 * allocator never touches the heap during normal gameplay.
 *
 * Each point stores: { x, y, spawnTime, lifetime, active }
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Initial pool capacity — grown on demand when exhausted. */
const INITIAL_POOL_SIZE = 256;

/** Growth factor when the pool is empty and a new point is requested. */
const GROWTH_FACTOR = 1.5;

// ─── GraphPoint Factory ─────────────────────────────────────────────────────

/** Creates a blank graph point object ready for pooling. */
function _createBlankPoint() {
  return { x: 0, y: 0, spawnTime: 0, lifetime: 0, active: false };
}

// ─── GraphPointPool ─────────────────────────────────────────────────────────

export class GraphPointPool {
  constructor(initialSize = INITIAL_POOL_SIZE) {
    /** @type {Array<Object>} All allocated point objects (active + free). */
    this._pool = [];
    /** @type {Array<Object>} Stack of available (inactive) point objects. */
    this._free = [];
    /** @type {Array<Object>} Currently active points for external iteration. */
    this.active = [];

    this._grow(initialSize);
  }

  /**
   * Acquire a point from the pool, initialising its fields.
   * @param {number} x        - Grid x coordinate.
   * @param {number} y        - Grid y coordinate.
   * @param {number} now      - Current game time in seconds.
   * @param {number} lifetime - Seconds until the point expires.
   * @returns {Object} Activated point reference.
   */
  acquire(x, y, now, lifetime) {
    if (this._free.length === 0) {
      this._grow(Math.ceil(this._pool.length * GROWTH_FACTOR));
    }
    const point = this._free.pop();
    point.x = x;
    point.y = y;
    point.spawnTime = now;
    point.lifetime = lifetime;
    point.active = true;
    this.active.push(point);
    return point;
  }

  /**
   * Sweep expired points back into the free list.
   * Uses a single-pass swap-remove for O(n) performance.
   * @param {number} now - Current game time in seconds.
   */
  sweep(now) {
    let writeIndex = 0;
    for (let i = 0; i < this.active.length; i++) {
      const pt = this.active[i];
      if (now - pt.spawnTime < pt.lifetime) {
        this.active[writeIndex++] = pt;
      } else {
        pt.active = false;
        this._free.push(pt);
      }
    }
    this.active.length = writeIndex;
  }

  /**
   * Release all active points back to the free list immediately.
   */
  releaseAll() {
    for (let i = 0; i < this.active.length; i++) {
      this.active[i].active = false;
      this._free.push(this.active[i]);
    }
    this.active.length = 0;
  }

  /** Number of currently active points. */
  get count() {
    return this.active.length;
  }

  /** Total pool capacity (active + free). */
  get capacity() {
    return this._pool.length;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /** Expand the pool by `amount` blank points. */
  _grow(amount) {
    for (let i = 0; i < amount; i++) {
      const pt = _createBlankPoint();
      this._pool.push(pt);
      this._free.push(pt);
    }
  }
}
