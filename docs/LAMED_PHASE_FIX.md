# Lamed Spire Phase Transition Fix

## Issue Description

When the sun transitions from one phase to another in the Lamed spire, users reported that "the view goes wack and zoomed in, then becomes normal a second later."

## Root Cause Analysis

### The Problem

The issue was in the sun rendering logic in `scripts/features/towers/lamedTower.js`. The code used an `if/else if/else` chain to determine which rendering method to use:

```javascript
// OLD CODE (BUGGY)
if (this.spritesLoaded && this.sprites.sunPhases.length > 0) {
  const sunSprite = this.sprites.sunPhases[sunPhaseIndex];
  if (sunSprite && sunSprite.complete) {
    // Draw sprite
  }
  // If sprite not complete, nothing is drawn!
} else if (this.surfaceCanvas) {
  // Draw procedural texture (never reached if spritesLoaded is true)
} else {
  // Draw solid color (never reached if spritesLoaded is true)
}
```

### Why This Caused the Bug

1. When sprites finish loading, `spritesLoaded` becomes `true`
2. On tier transitions, the code tries to render the new phase's sprite
3. If that specific sprite isn't `complete` yet (still decoding), the render is skipped
4. The `else if` blocks are never reached because `spritesLoaded` is already `true`
5. Result: The sun disappears for a frame or two, creating a visual glitch

### Why SVG Sprites Can Be "Loaded" But Not "Complete"

SVG images go through multiple stages:
1. **Download**: File is retrieved from server
2. **Parse**: SVG markup is parsed
3. **Decode**: Vector graphics are rasterized for rendering
4. **Complete**: Image is ready to draw

The `Image.complete` property is only `true` after ALL stages finish. For large or complex SVGs, stage 3 can take time, even if stages 1-2 completed quickly.

## The Fix

Changed from `if/else if/else` to sequential `if` checks with a tracking flag:

```javascript
// NEW CODE (FIXED)
let sunSpriteDrawn = false;

// Try sprite first
if (this.spritesLoaded && this.sprites.sunPhases.length > 0) {
  const sunSprite = this.sprites.sunPhases[sunPhaseIndex];
  if (sunSprite && sunSprite.complete) {
    // Draw sprite
    sunSpriteDrawn = true;
  }
}

// Fallback to procedural texture if sprite wasn't drawn
if (!sunSpriteDrawn && this.surfaceCanvas) {
  // Draw procedural texture
  sunSpriteDrawn = true;
}

// Final fallback to solid color
if (!sunSpriteDrawn) {
  // Draw solid color
}
```

### Benefits

1. **Always renders something**: The sun is never blank
2. **Graceful degradation**: Falls back through rendering options smoothly
3. **No visual glitches**: Tier transitions are seamless
4. **Performance safe**: No extra overhead when sprites are ready

## Testing

To verify the fix:

1. Navigate to the Lamed spire
2. Rapidly increase sun mass to trigger multiple tier transitions
3. Watch for smooth phase changes with no visual glitches
4. Test on slow connections (browser dev tools throttling) to simulate slow sprite loading
5. Test on high-DPR devices (Retina displays) where sprite decoding might be slower

## Related Code

- `scripts/features/towers/lamedTower.js` - Main simulation and rendering logic
- `assets/sprites/spires/lamedSpire/sunPhases/` - SVG sprite files for sun phases
- Tier definitions: `MASS_TIERS` array (lines 19-27)
- Diameter scaling: `TIER_DIAMETER_PERCENTAGES` array (line 33)

## Future Improvements

Consider these enhancements:

1. **Preload and decode sprites**: Use `Image.decode()` API to force decoding before marking as ready
2. **Blend between phases**: Crossfade from old to new sprite during transitions
3. **Cache rendered sprites**: Pre-render sprites to offscreen canvases for instant drawing
4. **Monitor sprite decode time**: Add telemetry to track how often fallbacks are used

## Commit History

- Initial fix: Added `sunSpriteDrawn` flag and sequential checks
- Commit SHA: 74bc791
- PR: copilot/fix-sun-phase-view-bug
