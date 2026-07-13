# Features Directory - Agent Guide

## Purpose
Self-contained gameplay systems that extend core functionality. Each feature module implements a specific game mechanic following consistent integration patterns.

## Directory Structure

```
features/
├── towers/        # Individual tower implementations (α, β, γ, etc.)
└── agent.md       # This file
```

## Feature Module Philosophy

### Self-Contained Systems
Each feature should:
- **Export a clear public API** (configuration objects, utility functions)
- **Import only from `core/`** or well-defined sibling modules
- **Avoid cross-feature dependencies** - use event bus for communication
- **Document mathematical formulas** inline with JSDoc comments

### Integration Pattern
Features plug into the main game via imports in `assets/main.js`:
```javascript
import { 
  calculateBetaAttack,
  BETA_BASE_ATTACK 
} from '../scripts/features/towers/betaMath.js';
```

## Tower Features (Most Common)

### Tower Module Structure
Each tower implementation follows this pattern:

**1. Constants Section**
```javascript
// Tower-specific colors, particle behavior, base stats
const ALPHA_PARTICLE_COLORS = [...];
const ALPHA_BASE_DAMAGE = 10;
```

**2. Configuration Object**
```javascript
const ALPHA_PARTICLE_CONFIG = {
  towerType: 'alpha',
  colors: ALPHA_PARTICLE_COLORS,
  behavior: 'swirlBounce',
  // ... all tower parameters
};
```

**3. Utility Functions**
```javascript
/**
 * Calculate alpha tower damage with upgrade multiplier.
 * Formula: baseDamage × (1 + upgradeLevel × 0.1)
 */
export function calculateAlphaDamage(upgradeLevel) {
  return ALPHA_BASE_DAMAGE * (1 + upgradeLevel * 0.1);
}
```

**4. Public Exports**
```javascript
export { 
  ALPHA_PARTICLE_CONFIG,
  calculateAlphaDamage,
  ALPHA_BASE_DAMAGE 
};
```

### Tower Naming Conventions
- **File:** `<greekLetter>Tower.js` (e.g., `alphaTower.js`, `betaTower.js`)
- **Math modules:** `<greekLetter>Math.js` (e.g., `betaMath.js`)
- **Special systems:** `<descriptiveName>.js` (e.g., `alephChain.js`)

### Greek Letter Theme
Towers use Greek alphabet in order of unlock:
- α (Alpha), β (Beta), γ (Gamma), δ (Delta), ε (Epsilon)
- ζ (Zeta), η (Eta), θ (Theta), ι (Iota), κ (Kappa)
- λ (Lambda), μ (Mu), ν (Nu), ξ (Xi), etc.

Aleph series uses Hebrew letters (ℵ₀, ℵ₁, ℵ₂, etc.)

## Common Feature Patterns

### Damage Calculation
Always document the mathematical formula:
```javascript
/**
 * Calculate tower damage after upgrades.
 * 
 * Formula: base × multiplier^level × (1 + bonusPercent)
 * 
 * @param {number} level - Upgrade level (0-10)
 * @param {number} bonusPercent - Additional percentage bonus (0-1)
 * @returns {number} Final damage value
 */
export function calculateDamage(level, bonusPercent = 0) {
  const multiplier = 1.5;
  return BASE_DAMAGE * Math.pow(multiplier, level) * (1 + bonusPercent);
}
```

### Upgrade Systems
Upgrades manipulate mathematical expressions:
- **Linear:** `value = base + (level × increment)`
- **Exponential:** `value = base × multiplier^level`
- **Polynomial:** `value = base × (1 + level)^exponent`
- **Factorial-like:** `value = base × factorialApproximation(level)`

### Particle Systems
Visual effects are configured separately from game logic:
```javascript
const PARTICLE_CONFIG = {
  colors: [...],           // RGB objects
  behavior: 'swirlBounce', // Animation type
  homing: true,            // Target tracking
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.08,    // Timing
};
```

## Integration Points

### With Core
Features import utilities but don't modify them:
```javascript
import { formatGameNumber } from '../../core/formatting.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
```

### With Assets
Main game imports feature modules:
```javascript
// In assets/main.js
import { 
  BETA_BASE_ATTACK,
  calculateBetaAttack 
} from '../scripts/features/towers/betaMath.js';
```

### With Docs
Formula changes must update:
- `docs/PROGRESSION.md` - Upgrade trees and balance
- Tower-specific documentation in comments
- Design documents for new mechanics

## Creating a New Feature

### Step 1: Create Module File
```bash
# For tower features
scripts/features/towers/newTower.js

# For other gameplay systems
scripts/features/newFeature/index.js
```

### Step 2: Define Public API
```javascript
// Configuration and constants
export const NEW_TOWER_CONFIG = { ... };
export const BASE_DAMAGE = 50;

// Calculation functions
export function calculateNewDamage(level) { ... }

// Validation helpers
export function validateNewUpgrade(level) { ... }
```

### Step 3: Document Formulas
```javascript
/**
 * Calculate ξ tower chain reaction damage.
 * 
 * Formula: base × chains^1.5 × (1 + level/10)
 * 
 * Chains scale geometrically: 1 → 2 → 4 → 8
 * Level provides linear bonus: 0-10 range
 * 
 * @param {number} chains - Number of active chain reactions (1-8)
 * @param {number} level - Upgrade level (0-10)
 * @returns {number} Total chain damage
 */
```

### Step 4: Import in Main Game
Add to `assets/main.js` imports:
```javascript
import { 
  NEW_TOWER_CONFIG,
  calculateNewDamage 
} from '../scripts/features/towers/newTower.js';
```

## Common Mistakes to Avoid

❌ **Don't** import from other features directly (use event bus)
❌ **Don't** modify core utilities - extend them instead
❌ **Don't** hardcode values that belong in configuration
❌ **Don't** create circular dependencies between features
❌ **Don't** skip documenting mathematical formulas

✅ **Do** keep modules focused on single responsibility
✅ **Do** export clear, documented public APIs
✅ **Do** use Greek letter theme for tower names
✅ **Do** document all damage/upgrade calculations
✅ **Do** separate particle systems from game logic

## Mathematical Formula Guidelines

### Standard Upgrade Curves
- **Early game towers:** Linear or mild exponential (1.2^level)
- **Mid game towers:** Moderate exponential (1.5^level)
- **Late game towers:** Strong exponential (2^level) or polynomial
- **Endgame towers:** Factorial-like or tetration patterns

### Balance Considerations
When adjusting formulas:
1. Test progression from level 0 to max
2. Compare with adjacent tower tiers
3. Consider idle/offline time scaling
4. Document why formula was chosen
5. Update `docs/PROGRESSION.md`

## Token Efficiency Tips

**For agents reading this:**
- Check `towers/agent.md` for tower-specific patterns
- All tower files follow similar structure - use one as template
- Mathematical formulas are ALWAYS documented in comments
- Configuration objects are consistent across features
- Import paths are relative - follow existing examples
- Greek letter ordering matters for thematic consistency
