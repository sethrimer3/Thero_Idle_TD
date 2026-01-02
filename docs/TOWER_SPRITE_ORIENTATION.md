# Tower Sprite Orientation Guide

This document describes the orientation conventions for tower projectile and ship sprites in Thero Idle.

## Sprite Orientation Convention

**All tower projectile and ship sprites are oriented with "forward" pointing upward (toward the top of the image).**

This means:
- The sprite's natural "front" or "forward" direction is along the negative Y-axis (up on screen)
- When rendering, sprites must be rotated to match the actual direction of travel
- The base rotation is -90° (or -π/2 radians) from the horizontal axis

## Affected Sprites

### Projectile Sprites (Upward Orientation)

1. **Beta Tower Projectile**
   - File: `assets/sprites/towers/bet/projectiles/betProjectile.png`
   - Type: Particle bullet
   - Base orientation: Pointing upward
   - Rotation: Applied based on trajectory angle

2. **Gamma Tower Projectile**
   - File: `assets/sprites/towers/gamma/projectiles/gammaProjectile.png`
   - Type: Piercing laser particle
   - Base orientation: Pointing upward
   - Rotation: Applied based on trajectory angle

3. **Epsilon Tower Projectile**
   - File: `assets/sprites/towers/epsilon/projectiles/epsilonProjectile.png`
   - Type: Homing needle
   - Base orientation: Pointing upward (needle tip faces up)
   - Rotation: Applied based on trajectory angle to point in direction of travel

### Ship Sprites (Upward Orientation)

4. **Delta Tower Ships**
   - Files: 
     - `assets/sprites/towers/delta/ship1.png`
     - `assets/sprites/towers/delta/ship2.png`
   - Type: Sentry ships
   - Base orientation: Pointing upward
   - Rotation: Applied based on heading angle + π/2 offset

## Implementation Notes

### Rotation Calculations

When rendering sprites that should rotate with their trajectory:
```javascript
// For sprites facing upward, add Math.PI / 2 to align with movement
const heading = Math.atan2(vy, vx);
ctx.rotate(heading + Math.PI / 2);
```

### Non-Rotating Sprites (None Currently)

Previously, epsilon needles were designed to maintain upward orientation, but this has been changed so they now rotate to point in their direction of travel for better visual feedback.

### Delta Ship Example

Delta ships are already correctly implemented in `deltaTower.js`:
```javascript
ctx.rotate(angle + Math.PI / 2);
ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
```

## Migration Notes

- Legacy vector-drawn projectiles may have used different orientation conventions
- When replacing vector graphics with sprites, ensure rotation calculations are updated
- Sprite caching systems must account for the base upward orientation
