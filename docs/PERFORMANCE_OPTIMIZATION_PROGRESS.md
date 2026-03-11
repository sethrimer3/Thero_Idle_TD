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

- [ ] Pervasive `ctx.shadowBlur` replacement with cached glow sprites/offscreen bloom assets
- [ ] Cache or pre-render per-frame `createRadialGradient` / `createLinearGradient` hot paths
- [x] Composite the crystalline mosaic through offscreen layer caches instead of redrawing every visible cell every frame
- [ ] Reduce the Shadow Gate's 7 rotating sprite layers to a cheaper composite path

### Medium-impact rendering work

- [ ] Reduce excessive `ctx.save()` / `ctx.restore()` usage in hot render paths
- [ ] Cache or rate-limit sunlight shadow quads so towers and enemies are not reprocessed every frame
- [ ] Pool or pre-render enemy swirl particle rings to reduce per-enemy particle draw cost

### Lower-impact but still valuable work

- [x] Throttle HUD/progress DOM updates in the hot loop to approximately 15 FPS
- [ ] Only update/draw background swimmers while visible and active
- [ ] Reduce broad hot-loop costs in `playfield.js` (for example, skip logic for off-screen content or other oversized update responsibilities)

## Source Findings To Keep In Mind

- `ctx.shadowBlur` is currently the largest known Canvas 2D cost center across towers, particles, and enemy effects.
- Per-frame gradient creation appears in tower blooms, alpha particles, swarm clouds, developer crystals, and connection motes.
- The crystalline mosaic is decorative, slow-moving, and was a strong candidate for raster caching because it renders in both background and foreground passes.
- HUD changes are DOM-bound, so updating them less often than the render loop is usually invisible to players but cheaper for layout/reflow.

## Implementation Log

- **Build 593**
  - **Files:** `assets/playfield/render/CrystallineMosaic.js`, `assets/playfield/render/layers/BackgroundRenderer.js`, `assets/playfield.js`
  - **Change:** Added offscreen cache reuse for crystalline mosaic background/foreground layers and throttled hot-loop HUD/progress updates to ~15 FPS while preserving immediate event-driven HUD refreshes elsewhere.
  - **Validation:** Loaded `index.html` in a local browser session, verified the game boots, and captured an updated UI screenshot after the changes.
