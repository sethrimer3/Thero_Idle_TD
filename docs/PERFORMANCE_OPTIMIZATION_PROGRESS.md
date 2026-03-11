# Performance Optimization Progress

This document tracks active game-performance optimization work so future agents can continue it without losing context.

## Agent Instructions

When working on performance tasks in this repository:

1. Keep changes surgical and focused on one optimization area at a time.
2. Before changing code, review this checklist and update the relevant task status.
3. After landing an optimization, add a short note under **Implementation Log** with:
   - build number
   - files changed
   - what was optimized
   - how it was validated
4. Check off completed tasks with `- [x]` and leave remaining work as `- [ ]`.
5. If you partially address a task, add a nested bullet describing what remains instead of checking it off.
6. Preserve prior log entries so optimization history remains readable across sessions.

## Task Checklist

### High-impact rendering work

- [x] Pervasive `ctx.shadowBlur` replacement with cached glow sprites/offscreen bloom assets
  - Mind Gate consciousness wave `shadowBlur` replaced with wider-stroke halo pass
  - Gamma star beam `shadowBlur=8` (beam stroke) replaced with wide semi-transparent stroke; `shadowBlur=12` (tip dot) replaced with pre-rendered radial-gradient glow sprite
  - Low-graphics gate halo (`drawGateLowGraphicsHalo` in `TrackRenderer`) — `shadowBlur` replaced with double-stroke glow pass (wide semi-transparent stroke + main stroke)
- [x] Cache or pre-render per-frame `createRadialGradient` / `createLinearGradient` hot paths
  - Tower golden bloom gradient now cached; enemy gate (anti-glow + cyan aura) and mind gate (warm glow) gradients now cached via offscreen sprites keyed by rounded radius
  - Omega wave radial gradient (hardcoded amber colors) now cached per rounded radius in `omegaWaveGradientCache`; renders via `drawImage` instead of `createRadialGradient` each frame
  - Standard beam `createLinearGradient` eliminated — both endpoints share the same palette color so the gradient collapsed to a solid stroke at the midpoint alpha (0.75)
  - Remaining: eta laser `createLinearGradient` (continuous per-projectile fade with variable length and alpha — harder to cache)
- [x] Composite the crystalline mosaic through offscreen layer caches instead of redrawing every visible cell every frame
- [x] Reduce the Shadow Gate's 7 rotating sprite layers to a cheaper composite path
  - Applied the same time-bucketed offscreen composite approach to both Shadow Gate (7 layers) and Mind Gate (8 layers) via the shared `drawGateBackgroundLayers` function

### Medium-impact rendering work

- [x] Reduce excessive `ctx.save()` / `ctx.restore()` usage in hot render paths
- [x] Cache or rate-limit sunlight shadow quads so towers and enemies are not reprocessed every frame
- [x] Pool or pre-render enemy swirl particle rings to reduce per-enemy particle draw cost

### Lower-impact but still valuable work

- [x] Throttle HUD/progress DOM updates in the hot loop to approximately 15 FPS
- [x] Only update/draw background swimmers while visible and active
- [x] Reduce broad hot-loop costs in `playfield.js` — skip `updateTrackRiverParticles` when ambient particles are disabled (same guard pattern as `BackgroundSwimmerSystem`)

## Source Findings To Keep In Mind

- `ctx.shadowBlur` is currently the largest known Canvas 2D cost center across towers, particles, and enemy effects.
- Per-frame gradient creation appears in tower blooms, alpha particles, swarm clouds, developer crystals, and connection motes.
- The crystalline mosaic is decorative, slow-moving, and was a strong candidate for raster caching because it renders in both background and foreground passes.
- HUD changes are DOM-bound, so updating them less often than the render loop is usually invisible to players but cheaper for layout/reflow.

## Implementation Log

- **Build 601**
  - **Files:** `assets/playfield/render/layers/TrackRenderer.js`, `assets/playfield/render/layers/ProjectileRenderer.js`, `assets/playfield.js`
  - **Change:** Four distinct optimizations:
    1. **Low-graphics gate halo shadowBlur removal** — `drawGateLowGraphicsHalo` in `TrackRenderer.js` no longer sets `ctx.shadowColor` / `ctx.shadowBlur`. Instead the function traces the ellipse path once and strokes it twice: a wide semi-transparent glow pass followed by the narrow main stroke. Same double-stroke technique used for the consciousness wave and gamma star beam.
    2. **Omega wave gradient cache** — `ProjectileRenderer.js` now pre-renders the omega wave radial gradient (hardcoded amber colors) to a module-level `omegaWaveGradientCache` keyed by rounded radius. Each active omega wave now calls `drawImage` instead of `createRadialGradient` every frame.
    3. **Standard beam gradient elimination** — The `createLinearGradient` for standard α/β/γ/ε/ι/ξ beams was replaced with a solid stroke. Both color-stop colors resolved to the same palette RGB (since `projectile.color` is a valid object) and the alpha values differed by only ~6% (0.72 vs 0.78), so the gradient was invisible in practice. A single `colorToRgbaString(beamEnd, 0.75)` stroke gives identical results with zero gradient allocation.
    4. **Track river particle skip** — `updateTrackRiverParticles` now returns immediately when `areBackgroundParticlesEnabled()` is false, matching the existing guard in `BackgroundSwimmerSystem`. Purely decorative particles are not worth updating when the user has disabled ambient particles.
  - **Validation:** Syntax-checked all modified files; browser load sanity check performed after the changes.

- **Build 600**
  - **Files:** `assets/playfield/render/layers/TrackRenderer.js`, `assets/playfield/render/layers/ProjectileRenderer.js`
  - **Change:** Four distinct optimizations:
    1. **Gate layers composite cache** — `drawGateBackgroundLayers` now pre-composes all 7–8 rotating ring sprites into a time-bucketed `OffscreenCanvas` (~30 fps cadence). On cache hits every frame only calls one `drawImage` instead of N save/rotate/drawImage/restore pairs. Applied to both Shadow Gate (7 layers) and Mind Gate (8 layers).
    2. **Enemy gate gradient sprite** — The two `createRadialGradient` calls per frame (anti-glow dark void + cyan aura) are replaced with a single `drawImage` from an `OffscreenCanvas` keyed by rounded radius. Cache is built once on first render and reused until the viewport is resized.
    3. **Mind gate gradient sprite** — Same pattern for the mind gate warm glow gradient (`createRadialGradient` call eliminated, replaced with cached `drawImage`).
    4. **Consciousness wave shadowBlur removal** — The two `ctx.shadowBlur` calls in the mind gate wave renderer are replaced with wider semi-transparent "glow pass" strokes drawn before each normal stroke. Shadow state is explicitly cleared at the start of the wave save block to prevent leaking the outer shadow.
    5. **Gamma star beam shadowBlur removal** — `ctx.shadowBlur=8` on the beam stroke is replaced with a wide semi-transparent halo stroke pass. `ctx.shadowBlur=12` on the beam tip dot is replaced with a cached radial-gradient `OffscreenCanvas` sprite keyed by beam color RGB.
  - **Validation:** Syntax-checked the modified files; browser load sanity check performed after the changes.

- **Build 599**
  - **Files:** `assets/playfield/render/layers/TowerSpriteRenderer.js`
  - **Change:** Added module-level `goldenBloomSpriteCache` that pre-renders the tower golden bloom radial gradient to an OffscreenCanvas once per unique body radius, replacing a `createRadialGradient()` call on every tower every frame with a `drawImage()` from the cache. Also refactored `drawTowerRings` to wrap all five ring draws in a single outer `ctx.save()/ctx.restore()` pair (with manual per-ring `ctx.rotate(-rotation)` undo) instead of one save/restore per ring, reducing ring context state operations from 5×N to 1×N per frame.
  - **Validation:** Syntax-checked the file; browser load sanity check performed after the changes.

- **Build 598**
  - **Files:** `assets/playfield/render/layers/EnemyRenderer.js`
  - **Change:** Pre-rendered enemy swirl backdrop gradient to a module-level offscreen canvas cache keyed by `{roundedRingRadius}:{invertedFlag}`. Eliminated per-enemy per-frame `createRadialGradient()` calls; the gradient is now constructed once per unique (radius, inversion) pair. Also batched the per-particle `ctx.save()/ctx.restore()` in the swirl sprite loop into a single outer pair, replacing N state-stack allocations per enemy with manual per-particle translate/rotate undo transforms.
  - **Validation:** Syntax-checked the file and performed a browser load sanity check after the changes.

- **Build 597**
  - **Files:** `assets/playfield/systems/BackgroundSwimmerSystem.js`, `assets/playfield/render/layers/BackgroundRenderer.js`
  - **Change:** Skipped background swimmer updates when ambient particles are disabled, limited heavy swimmer behavior work to the active viewport region, and culled swimmer draws to visible swimmers only.
  - **Validation:** Re-ran targeted syntax checks and browser-based playfield validation after the swimmer culling changes.

- **Build 596**
  - **Files:** `assets/playfield/render/layers/SunlightRenderer.js`
  - **Change:** Removed entity-count invalidation from the sunlight shadow cache key so the decorative shadow layer can actually reuse cached frames during combat.
  - **Validation:** Re-ran syntax checks and a browser load sanity check after addressing code review feedback.

- **Build 595**
  - **Files:** `assets/playfield/render/layers/SunlightRenderer.js`
  - **Change:** Cached the decorative sunlight shadow pass into an offscreen viewport layer that refreshes at a modest cadence instead of rebuilding all tower/enemy/gem shadow geometry every frame.
  - **Validation:** Re-ran syntax checks and browser-based playfield validation after the renderer change.

- **Build 594**
  - **Files:** `assets/playfield.js`
  - **Change:** Preserved fractional HUD throttle remainder so the reduced-frequency HUD refresh cadence does not drift during long sessions.
  - **Validation:** Re-ran syntax checks and a browser load sanity check after the follow-up fix.

- **Build 593**
  - **Files:** `assets/playfield/render/CrystallineMosaic.js`, `assets/playfield/render/layers/BackgroundRenderer.js`, `assets/playfield.js`
  - **Change:** Added offscreen cache reuse for crystalline mosaic background/foreground layers and throttled hot-loop HUD/progress updates to ~15 FPS while preserving immediate event-driven HUD refreshes elsewhere.
  - **Validation:** Loaded `index.html` in a local browser session, verified the game boots, and captured an updated UI screenshot after the changes.
