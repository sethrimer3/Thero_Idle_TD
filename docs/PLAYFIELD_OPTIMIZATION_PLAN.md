# Playfield Performance Optimization Plan

## Status
Created: Build 605
Last Updated: Build 605

## Completed Optimizations
- [x] Cache swarm cloud gradients as offscreen sprites (`EnemyRenderer.js`)
- [x] Add low-resolution (0.75×) playfield tier for auto-graphics fallback

## Remaining Tasks

### P1 — Medium Impact

#### Eliminate temporary `{ x, y }` object allocations in hot loops
- **Files:** `assets/playfield/systems/ProjectileUpdateSystem.js`, `assets/playfield/systems/EnemyUpdateSystem.js`
- **Problem:** Every frame creates dozens of `{ x, y }` objects (e.g., `{ ...targetPosition }`, `{ x: ..., y: ... }`) in projectile collision and enemy movement loops. On low-end devices, this creates GC pressure that causes micro-stutters.
- **Fix:** Use reusable static point objects or write directly into existing position properties. Example:
  ```javascript
  const _tempPoint = { x: 0, y: 0 };
  _tempPoint.x = currentPosition.x + (dx / distance) * travel;
  _tempPoint.y = currentPosition.y + (dy / distance) * travel;
  ```

#### Replace per-entity `ctx.save()`/`ctx.restore()` with manual `setTransform()`
- **Files:** `assets/playfield/render/CanvasRenderer.js` (`drawMoteGems()`), `assets/playfield/render/layers/BackgroundRenderer.js` (`drawSketchesOnContext()`)
- **Problem:** Each save/restore pushes and pops the entire canvas state (transform, clip, styles). With 50+ entities, the state-stack overhead is measurable on mobile.
- **Fix:** Replace with manual transform math:
  ```javascript
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  ctx.setTransform(cos, sin, -sin, cos, gem.x, gem.y);
  ```
  Then restore the camera transform once after the loop.

#### Bucket death particle and swarm cloud draws by color/style
- **Files:** `assets/playfield/render/layers/EnemyRenderer.js` (`drawEnemyDeathParticles()`)
- **Problem:** Each particle changes `fillStyle` and `strokeStyle` individually, causing many canvas state transitions.
- **Fix:** Sort/bucket particles by color, set style once per bucket, draw all particles of that color. The `betSpireDrawSystem.js` already demonstrates this pattern with `drawBuckets`.

#### Replace `Array.filter()` / `Array.map()` with in-place iteration in update loops
- **Files:** `assets/playfield/systems/FloaterSystem.js`, `assets/playfield/systems/EnemyUpdateSystem.js`
- **Problem:** `.map()` and `.filter()` create new arrays every frame (e.g., `this.enemies.filter(...)`, `this.towers.map(...)`), adding GC pressure.
- **Fix:** Pre-allocate reusable arrays or iterate in-place with index variables.

### P2 — Lower Impact

#### Object pool for projectiles and death particles
- **Files:** `assets/playfield/systems/ProjectileUpdateSystem.js`, `assets/playfield/render/layers/EnemyRenderer.js`
- **Problem:** Using `splice()` to remove and `push({...})` to add projectiles/particles causes array resizing and object allocation.
- **Fix:** Use a fixed-size pool with an active count instead of dynamic array operations.

#### Pre-build `Path2D` objects for static/repeated shapes
- **Files:** Various tower renderers, `CanvasRenderer.js`
- **Problem:** Tower outlines, gate symbols, and crystal silhouettes rebuild `beginPath/moveTo/lineTo/closePath` every frame even though their shapes don't change.
- **Fix:** Pre-build as `Path2D` objects and reuse with `ctx.fill(path)` / `ctx.stroke(path)`.

#### Throttle `updateEnemyTooltipPosition()` DOM access
- **Files:** `assets/playfield/render/CanvasRenderer.js`
- **Problem:** Called every frame at the end of `draw()`. Any DOM read/write in the render loop causes layout thrashing on mobile.
- **Fix:** Throttle to every 100–200ms or only when the hovered/focused enemy changes.

#### Cache crystal linear gradients per palette ratio
- **Files:** `assets/playfield/render/CanvasRenderer.js` (`drawDeveloperCrystals()`)
- **Problem:** Creates a `createLinearGradient()` per crystal per frame.
- **Fix:** Cache gradient results keyed on crystal palette ratio and radius (these rarely change).
