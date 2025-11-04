# Towers Directory - Agent Guide

## Purpose
Individual tower implementations for Thero Idle's Greek-letter-themed defense system. Each tower has unique mechanics, particle effects, and mathematical upgrade formulas.

## Existing Towers

### Current Implementation Status

**Basic Towers (α-λ series):**
- `alphaTower.js` - α tower: Swirl bounce particles, basic damage
- `betaTower.js` - β tower: Exponential damage scaling
- `gammaTower.js` - γ tower: Gamma ray piercing attacks
- `deltaTower.js` - δ tower: Delta force area effects
- `epsilonTower.js` - ε tower: Epsilon precision targeting
- `zetaTower.js` - ζ tower: Zeta chain reactions
- `etaTower.js` - η tower: Eta efficiency bonuses
- `thetaTower.js` - θ tower: Theta angle-based mechanics
- `iotaTower.js` - ι tower: Iota integration over time
- `kappaTower.js` - κ tower: Kappa critical strike system
- `lambdaTower.js` - λ tower: Lambda lambda calculus mechanics

**Special Towers:**
- `alephChain.js` - Aleph (ℵ) series: Cardinality-based tower system
- `fluidTower.js` - Fluid dynamics simulation tower
- `powderTower.js` - Powder game integration tower

**Math Modules:**
- `betaMath.js` - Dedicated math utilities for β tower calculations

## Tower Implementation Template

### File Structure
Every tower file should follow this structure:

```javascript
// 1. IMPORTS
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import { formatGameNumber } from '../../core/formatting.js';

// 2. CONSTANTS
const TOWER_PARTICLE_COLORS = [
  { r: 255, g: 138, b: 216 }, // Primary color
  { r: 138, g: 247, b: 255 }, // Secondary color
];

const BASE_DAMAGE = 10;
const BASE_RANGE = 5; // meters
const BASE_ATTACK_SPEED = 1.0; // attacks per second

// 3. UTILITY FUNCTIONS
/**
 * Calculate tower damage with upgrade scaling.
 * Formula: base × (1 + level × 0.15)^2
 */
function calculateDamage(level) {
  return BASE_DAMAGE * Math.pow(1 + level * 0.15, 2);
}

// 4. CONFIGURATION OBJECT
const TOWER_PARTICLE_CONFIG = {
  towerType: 'towerName',
  stateKey: 'towerNameState',
  burstListKey: 'towerNameBursts',
  idPrefix: 'towerName',
  colors: TOWER_PARTICLE_COLORS,
  behavior: 'swirlBounce', // or 'homing', 'beam', 'aoe'
  homing: true,
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.08,
  // Additional tower-specific parameters
};

// 5. EXPORTS
export {
  TOWER_PARTICLE_CONFIG,
  BASE_DAMAGE,
  BASE_RANGE,
  BASE_ATTACK_SPEED,
  calculateDamage,
};
```

## Damage Formula Patterns

### Linear Growth
```javascript
/**
 * Formula: base + (level × increment)
 * Use for: Early game towers, predictable scaling
 */
damage = BASE_DAMAGE + (level * 5);
```

### Exponential Growth
```javascript
/**
 * Formula: base × multiplier^level
 * Use for: Mid to late game towers, rapid scaling
 */
damage = BASE_DAMAGE * Math.pow(1.5, level);
```

### Polynomial Growth
```javascript
/**
 * Formula: base × (1 + level)^exponent
 * Use for: Smooth curves, balanced mid-game
 */
damage = BASE_DAMAGE * Math.pow(1 + level, 2);
```

### Compound Growth
```javascript
/**
 * Formula: base × multiplier^level × (1 + bonusPercent)
 * Use for: Multi-upgrade systems, synergy mechanics
 */
damage = BASE_DAMAGE * Math.pow(1.5, level) * (1 + glyphBonus);
```

## Particle Behavior Types

### `swirlBounce`
Particles spiral out and bounce toward target
- Use for: α tower, basic energy projectiles
- Visual: Smooth curves, ethereal feel

### `homing`
Direct target tracking with slight arc
- Use for: Precision towers, guided projectiles
- Visual: Straight lines with gentle curves

### `beam`
Continuous laser-like effect
- Use for: γ tower, piercing attacks
- Visual: Sustained connection, no travel time

### `aoe` (Area of Effect)
Expanding circle from impact point
- Use for: δ tower, splash damage
- Visual: Expanding rings, radial effects

### `chain`
Bounces between multiple targets
- Use for: ζ tower, chain reactions
- Visual: Lightning-like connections

## Upgrade Systems

### Glyph Slots
Towers have upgradeable glyph slots:
```javascript
/**
 * Glyph1, Glyph2, Glyph3 = Collectible upgrade slots
 * Each glyph adds specific bonus (damage, speed, range)
 * Rendered as: 𝔊₁, 𝔊₂, 𝔊₃
 */
const glyphBonuses = {
  glyph1: damageMultiplier,  // e.g., 1.2x damage
  glyph2: rangeBonus,        // e.g., +2 meters
  glyph3: speedBonus,        // e.g., +0.3 attacks/sec
};
```

### Upgrade Branches
Many towers have branching upgrades:
```javascript
/**
 * Path A: Damage focus - exponential damage scaling
 * Path B: Utility focus - range and attack speed
 * Path C: Special - unique mechanic enhancement
 */
```

## Mathematical Conventions

### Tower Stats Ranges
- **Damage:** 10-1000 base range, scales to millions with upgrades
- **Range:** 3-15 meters typical, 20+ for snipers
- **Attack Speed:** 0.5-3.0 attacks per second
- **Cost:** Follow Fibonacci-like progression for balance

### Formula Documentation Style
ALWAYS document formulas this way:
```javascript
/**
 * Calculate θ tower angle-based damage bonus.
 * 
 * Formula: base × (1 + sin(angle × π/180))
 * 
 * Angle mechanics:
 * - 0° = base damage (sin(0) = 0)
 * - 90° = 2x damage (sin(90°) = 1)
 * - 180° = base damage (sin(180°) = 0)
 * 
 * @param {number} angle - Projectile angle in degrees (0-360)
 * @returns {number} Damage multiplier (1.0-2.0)
 */
export function calculateAngleDamage(angle) {
  const radians = angle * Math.PI / 180;
  return BASE_DAMAGE * (1 + Math.sin(radians));
}
```

## Color Palette Guidelines

### Particle Colors
Use monochrome or subtle color accents:
```javascript
// Monochrome approach (preferred)
const MONO_COLORS = [
  { r: 240, g: 240, b: 240 }, // Near white
  { r: 80, g: 80, b: 80 },    // Dark gray
];

// Accent approach (for special towers)
const ACCENT_COLORS = [
  { r: 255, g: 138, b: 216 }, // Magenta accent
  { r: 138, g: 247, b: 255 }, // Cyan accent
];
```

### Palette Integration
Respect the active color scheme:
```javascript
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

function resolveTowerColors() {
  const color1 = samplePaletteGradient(0.2); // Sample at 20%
  const color2 = samplePaletteGradient(0.8); // Sample at 80%
  return [color1, color2];
}
```

## Common Tower Patterns

### Beta Tower Example (Reference)
`betaTower.js` + `betaMath.js` demonstrate:
- **Separated math module** for complex calculations
- **Exponent clamping** to prevent overflow
- **Multiple stat calculations** (damage, speed, range)
- **Clear formula documentation**

Study `betaMath.js` for:
```javascript
export function clampBetaExponent(exponent) {
  return Math.max(0, Math.min(10, exponent));
}

export function calculateBetaAttack(exponent) {
  const clamped = clampBetaExponent(exponent);
  return BETA_BASE_ATTACK * Math.pow(1 + clamped, 2);
}
```

### Aleph Chain System (Advanced)
`alephChain.js` shows:
- **Registry pattern** for managing multiple tower variants
- **Cardinality-based mechanics** (infinite set theory)
- **Default upgrade configurations**
- **Complex interconnected systems**

## Integration with Main Game

### Import Pattern
Main game imports tower configs and utilities:
```javascript
// In assets/main.js
import {
  ALPHA_PARTICLE_CONFIG,
  calculateAlphaDamage,
} from '../scripts/features/towers/alphaTower.js';
```

### Registration
Towers register with game systems:
```javascript
// Tower placement system uses PARTICLE_CONFIG
// Damage calculations use exported functions
// Upgrade UI uses stat calculation functions
```

## Creating a New Tower

### Step-by-Step Process

1. **Choose Greek Letter**
   - Follow alphabetical order (α, β, γ, δ...)
   - Or use special series (Aleph, special symbols)

2. **Create File**
   - Name: `<letter>Tower.js` (e.g., `muTower.js`)
   - Location: `scripts/features/towers/`

3. **Define Base Stats**
   ```javascript
   const MU_BASE_DAMAGE = 25;
   const MU_BASE_RANGE = 7;
   const MU_BASE_ATTACK_SPEED = 1.2;
   ```

4. **Design Upgrade Formula**
   ```javascript
   /**
    * Mu tower uses factorial-like growth.
    * Formula: base × (level+1)!/(level!) = base × (level+1)
    */
   function calculateMuDamage(level) {
     return MU_BASE_DAMAGE * (level + 1);
   }
   ```

5. **Configure Particles**
   ```javascript
   const MU_PARTICLE_CONFIG = {
     towerType: 'mu',
     stateKey: 'muState',
     colors: MU_PARTICLE_COLORS,
     behavior: 'homing',
     // ... rest of config
   };
   ```

6. **Export Public API**
   ```javascript
   export {
     MU_PARTICLE_CONFIG,
     MU_BASE_DAMAGE,
     calculateMuDamage,
   };
   ```

7. **Update Documentation**
   - Add formula to `docs/PROGRESSION.md`
   - Document special mechanics in comments
   - Update tower unlock tree if needed

## Common Mistakes to Avoid

❌ **Don't** forget to clamp input values (prevent overflow/underflow)
❌ **Don't** hardcode particle colors without fallback
❌ **Don't** skip documenting complex formulas
❌ **Don't** create cross-tower dependencies (use events instead)
❌ **Don't** forget to export all public functions/constants

✅ **Do** follow the Greek letter naming convention
✅ **Do** document ALL mathematical formulas with examples
✅ **Do** provide fallback colors when palette fails
✅ **Do** separate complex math into dedicated modules (like `betaMath.js`)
✅ **Do** test extreme values (level 0, level max, negative inputs)

## Testing Checklist

When implementing a new tower:
- [ ] Base damage scales appropriately across levels
- [ ] Upgrade formulas don't overflow or produce NaN
- [ ] Particle colors render correctly (test with different palettes)
- [ ] Range visualization matches actual targeting
- [ ] Attack speed animations sync with damage application
- [ ] Glyph bonuses apply correctly
- [ ] Mobile viewport displays tower UI properly
- [ ] Console shows no errors during tower placement/upgrade

## Token Efficiency Tips

**For agents reading this:**
- Use `betaTower.js` and `betaMath.js` as reference templates
- All towers follow same file structure - copy patterns
- Formula documentation is mandatory - never skip
- Particle config objects are consistent across towers
- Import paths are always relative from this directory
- Greek letters must be in proper order (check existing files)
- Mathematical symbols require proper Unicode encoding
- Test formulas with edge cases: 0, 1, max level, negative
