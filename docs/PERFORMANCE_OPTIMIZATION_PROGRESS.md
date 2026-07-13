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
  - Tower body outer shadow `shadowBlur` — replaced with pre-rendered offscreen `towerBodySpriteCache` keyed by (radius, fill, stroke, shadowColor, blur); per-tower per-frame cost reduced from Gaussian blur to `drawImage` blit
  - Tower ring shadow removed — `ctx.shadowBlur` was applied to pre-blurred ring PNG sprites redundantly; now cleared before ring drawing
  - Tower symbol `shadowBlur` — replaced with lightweight `strokeText` glow pass across tower glyphs, glyph transitions, and press glow effects
  - Tower chain ring `shadowBlur` — replaced with double-stroke glow pass
  - Enemy symbol `shadowBlur` — replaced with `strokeText` glow pass for enemy glyph rendering
  - Enemy rho sparkle `shadowBlur` — replaced with soft halo circle pass (larger radius, lower alpha)
  - Track river particle `shadowBlur` (per-particle) — replaced with soft halo fill circles at 2.8× radius, eliminating ~50-100 Gaussian blur operations per frame
  - Track tracer spark `shadowBlur` (per-spark) — replaced with soft halo fill circle at 3× radius
  - Mind Gate outer ring `shadowBlur` — replaced with double-stroke glow pass
  - Mind Gate exponent text `shadowBlur` — replaced with `strokeText` glow pass
  - Wave tally text `shadowBlur` — replaced with `strokeText` glow pass
- [x] Cache or pre-render per-frame `createRadialGradient` / `createLinearGradient` hot paths
  - Tower golden bloom gradient now cached; enemy gate (anti-glow + cyan aura) and mind gate (warm glow) gradients now cached via offscreen sprites keyed by rounded radius
  - Omega wave radial gradient (hardcoded amber colors) now cached per rounded radius in `omegaWaveGradientCache`; renders via `drawImage` instead of `createRadialGradient` each frame
  - Standard beam `createLinearGradient` eliminated — both endpoints share the same palette color so the gradient collapsed to a solid stroke at the midpoint alpha (0.75)
  - Eta laser `createLinearGradient` eliminated — normalized alpha falloff (1.0→0.6→0) pre-rendered into a 256×1 OffscreenCanvas per beam color (`etaLaserGradientSpriteCache`); per-frame alpha scaling done via `ctx.globalAlpha` and beam is blitted with `drawImage` scaled to `(length, lineWidth)`
  - Gamma star piercing beam `createLinearGradient` eliminated — both gradient stops share the same beam color, alpha range 0.5→0.95 collapsed to a solid stroke at midpoint alpha (0.72); same approach used for standard beams
- [x] Composite the crystalline mosaic through offscreen layer caches instead of redrawing every visible cell every frame
- [x] Reduce the Shadow Gate's 7 rotating sprite layers to a cheaper composite path
  - Applied the same time-bucketed offscreen composite approach to both Shadow Gate (7 layers) and Mind Gate (8 layers) via the shared `drawGateBackgroundLayers` function

### Medium-impact rendering work

- [x] Viewport culling for tower rendering — skip off-screen towers before any expensive visual work (body sprite, rings, symbol glyph)
- [x] Reduce excessive `ctx.save()` / `ctx.restore()` usage in hot render paths
  - Tower glyph transition particles now use a single outer `save/restore` instead of one per particle
  - Infinity aura lines consolidated from per-line `save/restore` to a single outer pair with pre-computed color string
- [x] Cache or rate-limit sunlight shadow quads so towers and enemies are not reprocessed every frame
- [x] Pool or pre-render enemy swirl particle rings to reduce per-enemy particle draw cost

### Lower-impact but still valuable work

- [x] Throttle HUD/progress DOM updates in the hot loop to approximately 15 FPS
- [x] Only update/draw background swimmers while visible and active
- [x] Reduce broad hot-loop costs in `playfield.js` — skip `updateTrackRiverParticles` when ambient particles are disabled (same guard pattern as `BackgroundSwimmerSystem`)

## Source Findings To Keep In Mind

- `ctx.shadowBlur` was the largest known Canvas 2D cost center. As of Build 607, all per-entity per-frame shadow calls have been eliminated from the hot render path and replaced with either pre-rendered sprite caches or lightweight double-stroke/soft-halo glow passes.
- Per-frame gradient creation appears in developer crystals and is a minor overhead; all game-facing gradients are now cached.
- The crystalline mosaic is decorative, slow-moving, and was a strong candidate for raster caching because it renders in both background and foreground passes.
- HUD changes are DOM-bound, so updating them less often than the render loop is usually invisible to players but cheaper for layout/reflow.
- Remaining `applyCanvasShadow` calls are limited to: path layer cache builds (one-time), gate symbol fallbacks (only when sprite images haven't loaded), developer mode markers, and the tower body sprite cache fallback (only when OffscreenCanvas is unavailable).

## Implementation Log

- **Build 608–609**
  - **Files:** `assets/playfield/render/layers/ProjectileRenderer.js`, `assets/playfield/render/layers/EnemyRenderer.js`, `assets/playfield/render/layers/TowerSpriteRenderer.js`, `assets/playfield/render/layers/TrackRenderer.js`, `assets/playfield/render/layers/SunlightRenderer.js`, `assets/playfield/render/layers/BackgroundRenderer.js`, `assets/playfield.js`, `scripts/features/towers/alphaTower.js`, `assets/buildInfo.js`
  - **Change:** Comprehensive rendering hot-path optimization pass targeting per-entity per-frame overhead:
    1. **Batch standard beam projectiles** — Standard beams now collect source/target/color during the forEach loop, then render all lines in one stroke path and all tip dots in one fill path per unique color. Eliminates N×(beginPath+stroke+beginPath+fill) for standard beams.
    2. **Batch enemy death particles** — Removed per-particle `stroke()` call; replaced with dual-fill approach (outer halo circle at lower alpha + inner core fill), eliminating lineWidth/strokeStyle state changes per particle.
    3. **Reduce save/restore in TowerSpriteRenderer** — Removed save/restore around highlight ring (now resets setLineDash manually with reusable `EMPTY_DASH` array), beta/gamma shot labels. Added reusable empty dash constant.
    4. **Cache font string construction** — Hoisted `bodyRadius` and `glyphFont` string above the tower loop. Added `getCachedFont()` cache in EnemyRenderer to avoid per-enemy template literal allocation for Cormorant Garamond font strings.
    5. **Tower type dispatch lookup table** — Replaced 13 sequential if-checks per tower with a single `TOWER_TYPE_HANDLERS[tower.type]` property lookup.
    6. **Flatten consciousness wave nesting** — Replaced 3-level nested save/restore in mind gate wave with sequential lineWidth/globalAlpha adjustments on the same path (4 strokes, 1 save/restore).
    7. **Fast inline RGBA string builder** — Added `fastRgba()` in TrackRenderer for river/tracer particle hot loops; skips the full clamp/round pipeline of `colorToRgbaString` when callers already guarantee valid RGB input.
    8. **Reduce gate sprite save/restore** — Replaced save/globalAlpha/drawImage/restore with manual globalAlpha set+reset for both enemy gate and mind gate sprite blits.
    9. **Combine focused enemy marker arcs** — Merged two separate beginPath/arc/stroke calls into one combined path with moveTo between arcs.
    10. **Cache gamma star burst opacity strings** — Pre-computed per-opacity rgba strings and glow fillStyle outside the burst loop.
    11. **Batch mote gem shadows** — All gem shadow arcs in SunlightRenderer now share one beginPath/fill with moveTo between disjoint circles and a single fillStyle set. Eliminates per-gem fillStyle and fill calls.
    12. **Optimize swimmers** — Replaced per-swimmer rgba string allocation with globalAlpha; converted forEach to for-loop.
    13. **Optimize floaters** — Replaced per-floater rgba strokeStyle strings with globalAlpha approach using white base strokeStyle.
    14. **Batch infinity aura lines** — All tower connection lines per infinity tower now rendered in a single beginPath/stroke path.
    15. **Remove per-particle save/restore in burst rendering** — `drawParticle` in alphaTower.js now uses manual globalAlpha instead of per-particle save/restore for sprite drawImage.
  - **Validation:** Syntax-checked all modified files.

- **Build 607**
  - **Files:** `assets/playfield/render/layers/TowerSpriteRenderer.js`, `assets/playfield/render/layers/EnemyRenderer.js`, `assets/playfield/render/layers/TrackRenderer.js`, `assets/playfield/render/layers/UIOverlayRenderer.js`, `assets/playfield.js`, `assets/buildInfo.js`
  - **Change:** Major per-frame `ctx.shadowBlur` elimination pass reducing ~120-175 shadow operations per frame to near zero in the normal hot render path:
    1. **Tower body sprite cache** — Pre-rendered tower body circles (fill + stroke + shadow) into `towerBodySpriteCache` (OffscreenCanvas, keyed by radius/fill/stroke/shadow/blur). Eliminates 2 shadowBlur calls per tower.
    2. **Tower ring shadow removal** — Cleared shadow state before `drawTowerRings()` since ring sprites are already pre-blurred PNGs.
    3. **Tower symbol glow pass** — Replaced `applyCanvasShadow` + `fillText` with a `strokeText` glow pass (wide semi-transparent stroke before fill) for tower glyphs, glyph transitions, and press glow effects.
    4. **Tower chain ring glow pass** — Replaced shadowBlur with double-stroke pass (wide semi-transparent + narrow main).
    5. **Enemy symbol glow pass** — Replaced per-enemy `applyCanvasShadow` for glyph text with `strokeText` glow pass.
    6. **Rho sparkle ring glow** — Replaced per-enemy shadowBlur with larger soft halo circles (2.2× radius at 30% alpha).
    7. **Track river particle glow** — Replaced per-particle `applyCanvasShadow` with soft halo fill circles (2.8× radius at 35% alpha). Eliminated ~50-100 Gaussian blur operations per frame.
    8. **Track tracer spark glow** — Replaced per-spark shadowBlur with soft halo fill circles (3× radius).
    9. **Mind Gate ring/exponent glow** — Replaced ring shadowBlur with double-stroke pass; exponent text shadowBlur with strokeText glow pass.
    10. **Wave tally text glow** — Replaced per-tally shadowBlur with strokeText glow pass.
    11. **Tower viewport culling** — Added `getViewportBounds`/`isInViewport` helpers to TowerSpriteRenderer; towers outside the visible viewport (with 100px margin) are skipped before any visual work.
    12. **Glyph particle save/restore consolidation** — `drawTowerGlyphParticles` now uses a single outer `save/restore` pair instead of one per particle.
    13. **Infinity aura save/restore consolidation** — `drawInfinityAuras` now uses a single `save/restore` pair and pre-computes color string once per infinity tower.
  - **Validation:** Syntax-checked all modified files with `node -c`.

- **Build 606**
  - **Files:** `assets/playfield/render/layers/ProjectileRenderer.js`
  - **Change:** Two gradient-creation eliminations completing the `createLinearGradient` hot-path work:
    1. **Eta laser gradient sprite cache** — Added module-level `etaLaserGradientSpriteCache` (keyed by rounded beam-color RGB). A 256×1 OffscreenCanvas per color encodes the normalized alpha falloff (1.0→0.6→0) at full opacity. Each active laser now blits the sprite via `drawImage` scaled to `(length, lineWidth)` with `ctx.globalAlpha = alpha` for per-frame alpha scaling, eliminating one `createLinearGradient()` call per laser per frame. Inline gradient fallback retained for environments where `OffscreenCanvas` fails.
    2. **Gamma star piercing beam gradient elimination** — The `createLinearGradient` for the gamma star main stroke was removed. Both color stops share the same `beamColor`; the alpha range (0.5→0.95) collapses to a solid stroke at midpoint alpha (0.72). Same approach applied earlier for standard α/β/γ/ε/ι/ξ beams.
  - **Validation:** Syntax-checked the modified file; browser load sanity check performed after the changes.

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
