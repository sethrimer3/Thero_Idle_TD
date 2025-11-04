# Scripts Directory - Agent Guide

## Purpose
This directory contains the modular JavaScript architecture for Thero Idle's core systems, organized for clarity and maintainability.

## Directory Structure

```
scripts/
├── core/           # Shared utilities, math helpers, formatting
├── features/       # Self-contained gameplay systems (towers, upgrades)
│   └── towers/    # Individual tower implementations
└── agent.md       # This file
```

## Quick Navigation Rules

**When working on:**
- **Number formatting, mathematical notation** → `core/formatting.js`
- **Math text rendering, equation parsing** → `core/mathText.js`, `core/mathTokens.js`
- **Tower mechanics, damage formulas** → `features/towers/<TowerName>.js`
- **Aleph chain system** → `features/towers/alephChain.js`
- **Beta tower math** → `features/towers/betaMath.js`

## Key Principles

### 1. Module Size Guideline
- Keep files **under 200 lines** when practical
- Split complex systems into focused modules
- Some tower files exceed this due to complexity - prioritize readability

### 2. Import Patterns
All scripts use **ES6 modules** with explicit imports:
```javascript
import { functionName } from '../relative/path.js';
export { publicApi };
```

### 3. Dependencies Flow Inward
- `features/` modules import from `core/`
- Avoid cross-feature imports (use event bus instead)
- Tower modules can import from `core/` and sibling tower utilities

## Common Patterns

### Mathematical Formulas
Document all formulas with inline comments:
```javascript
/**
 * Calculate Beta tower attack damage.
 * Formula: baseDamage * (1 + exponent)^2
 * @param {number} exponent - Current Beta exponent value (0-10)
 * @returns {number} Final attack damage
 */
export function calculateBetaAttack(exponent) {
  const clamped = clampBetaExponent(exponent);
  return BETA_BASE_ATTACK * Math.pow(1 + clamped, 2);
}
```

### Tower Implementation Template
When creating a new tower in `features/towers/`:
1. Import required utilities from `core/`
2. Define tower-specific constants (colors, particle behavior)
3. Export configuration object with all tower parameters
4. Document damage formulas, upgrade paths, and special mechanics
5. Keep particle systems separate from game logic

### Naming Conventions
- **Files:** PascalCase for classes (`TowerManager.js`), camelCase for modules (`betaMath.js`)
- **Towers:** Greek letter + "Tower" (e.g., `alphaTower.js`, `betaTower.js`)
- **Functions:** Descriptive camelCase (e.g., `calculateBetaAttack`, `clampBetaExponent`)
- **Constants:** SCREAMING_SNAKE_CASE (e.g., `BETA_BASE_ATTACK`, `ALPHA_PARTICLE_COLORS`)

## Integration Points

### With Assets
- Towers import from `assets/gameUnits.js` for unit conversion
- Color schemes from `assets/colorSchemeUtils.js`
- Main game loop in `assets/main.js` imports from `scripts/`

### With Docs
- Formula changes should update `docs/PROGRESSION.md`
- New tower types should document upgrade paths
- Module organization follows `docs/JAVASCRIPT_MODULE_SYSTEM.md`

## Common Mistakes to Avoid

❌ **Don't** create circular dependencies between features
❌ **Don't** import entire modules when you need one function
❌ **Don't** hardcode values that belong in tower configuration
❌ **Don't** skip documenting mathematical formulas

✅ **Do** use explicit named imports
✅ **Do** keep tower logic isolated in dedicated files
✅ **Do** document all damage/upgrade calculations
✅ **Do** follow the Greek letter theme for tower names

## Testing Approach

This project has **no automated tests**. Validate changes by:
1. Opening `index.html` in a browser
2. Checking browser console for errors
3. Testing tower placement and upgrade mechanics
4. Verifying mathematical calculations produce expected results
5. Testing on mobile viewport (portrait orientation first)

## Token Efficiency Tips

**For agents reading this:**
- Check this file FIRST when working in `/scripts/`
- Tower implementations follow similar patterns - read one as template
- Mathematical formulas are always documented inline
- Module dependencies are explicit in imports - no hidden globals
- Consult subdirectory agent.md files for deeper context
