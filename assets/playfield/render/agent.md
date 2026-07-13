# Playfield Render Directory – Agent Guide

This directory contains rendering-related modules for the playfield system.

## Modules

### RenderCoordinator.js (Build 450-453)
**Purpose:** Manages the animation frame loop and frame timing (123 lines).

**Responsibilities:**
- Frame scheduling via `requestAnimationFrame`
- Frame timing calculations (delta time, safeDelta capping)
- Performance monitoring integration (frame markers)
- Frame rate limiting based on user preferences
- FPS counter updates

**Integration Pattern:**
- Factory function with dependency injection
- Configured with `update()`, `draw()`, and `shouldAnimate()` callbacks
- API: `startRenderLoop()`, `stopRenderLoop()`, `isRunning()`

**Example Usage:**
```javascript
const renderCoordinator = createRenderCoordinator({
  update: (delta) => gameState.update(delta),
  draw: () => renderer.draw(),
  shouldAnimate: () => gameState.isActive,
});

renderCoordinator.startRenderLoop();
// ... later ...
renderCoordinator.stopRenderLoop();
```

**Performance Considerations:**
- Maintains existing requestAnimationFrame pattern (zero overhead)
- Frame rate limiting prevents excessive CPU usage
- Delta capping (0.12s max) prevents large time jumps from tab backgrounding
- Performance segments track update vs draw time separately

### CanvasRenderer.js
**Purpose:** Contains all canvas drawing logic for playfield elements.

**Responsibilities:**
- Background rendering (mosaic, path, arc light)
- Tower sprite rendering
- Projectile rendering
- Effect rendering (bursts, particles, damage numbers)
- Enemy rendering
- UI overlay rendering

**Integration:** Used as namespace/module with functions called from SimplePlayfield

### CrystallineMosaic.js
**Purpose:** Manages the animated crystalline background mosaic.

**Responsibilities:**
- Mosaic tile generation and layout
- Animation state management
- Gradient application based on color scheme

**Integration:** Singleton manager accessed via `getCrystallineMosaicManager()`

## Common Patterns

### Performance Monitoring
All render modules should use performance segments when appropriate:
```javascript
const finishSegment = beginPerformanceSegment('render:myfeature');
try {
  // rendering code
} finally {
  finishSegment();
}
```

### Frame Rate Limiting
Frame rate limits are controlled via preferences.js (`getFrameRateLimit()`).
The RenderCoordinator automatically applies this limit to the animation loop.

### Delta Time Capping
Delta time is capped at 0.12 seconds (120ms) to prevent physics instability
from large time jumps when tabs are backgrounded or frames drop.

## When to Read This File
- Implementing new rendering features
- Debugging animation loop issues
- Optimizing render performance
- Adding new performance monitoring segments

## Related Documentation
- `/docs/MONOLITHIC_REFACTORING_PLAN.md` - Phase 1.1.3 extraction details
- `/assets/playfield/agent.md` - Parent playfield system guide
- `/docs/PLATFORM_SUPPORT.md` - Mobile performance targets
