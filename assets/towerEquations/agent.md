# Tower Equations Directory - Agent Guide

## Purpose

This directory contains tower equation blueprints extracted from `towersTab.js` for better maintainability and organization. Each file groups related towers logically.

## File Structure

```
assets/towerEquations/
├── index.js              # Aggregates all blueprints, exports TOWER_EQUATION_BLUEPRINTS
├── blueprintContext.js   # Shared context for helper function injection
├── mindGate.js           # Mind Gate special tower
├── basicTowers.js        # Alpha, Beta, Gamma (foundational towers)
├── greekTowers.js        # Delta, Epsilon, Zeta, Eta, Theta, Iota (mid-tier)
├── advancedTowers.js     # Barrel re-export for all advanced towers (late-game)
├── advanced/             # Individual per-tower blueprint files (one file per tower)
│   ├── kappaEquation.js  # κ: tripwire charge damage chain
│   ├── lambdaEquation.js # λ: κ × effective enemy count laser
│   ├── muEquation.js     # μ: fractal mine tiers (λ × tier × 10)
│   ├── nuEquation.js     # ν: μ × (kills+1)^ln(dmgtot/…) beam
│   ├── xiEquation.js     # ξ: ν × chain count exponent
│   ├── omicronEquation.js# ο: δ × ξ triangle soldiers
│   ├── piEquation.js     # π: ο^(|θ|/(100−Bet₁)) rotational beams
│   ├── rhoEquation.js    # ρ: enemy thero yield × range (income)
│   ├── sigmaEquation.js  # σ: stored ally damage discharge
│   ├── tauEquation.js    # τ: spiral atk × internal particles
│   ├── upsilonEquation.js# υ: fleet attack × cadence × size
│   ├── phiEquation.js    # φ: Fibonacci golden-seed spread
│   ├── chiEquation.js    # χ: φ²-powered thrall gate
│   ├── psiEquation.js    # ψ: enemy merge clusters with AoE
│   └── omegaEquation.js  # Ω: HP-slice orbital particles
└── agent.md              # This file
```

## Tower Groupings

### Basic Towers (`basicTowers.js`)
- **alpha** (α): Atk × Spd - The foundational projectile tower
- **beta** (β): Atk × Spd × Rng - Builds on alpha with range scaling
- **gamma** (γ): Atk × Spd × Rng × Prc - Adds piercing mechanics

**Progression**: Alpha → Beta → Gamma introduces players to basic upgrade mechanics and tower connections.

### Greek Towers (`greekTowers.js`)
- **delta** (δ): Logarithmic scaling from gamma
- **epsilon** (ε): Complex multi-variable interactions
- **zeta** (ζ): Advanced connection-based mechanics
- **eta** (η): Specialized tactical tower
- **theta** (θ): Angular/geometric mechanics
- **iota** (ι): Incremental power scaling

**Progression**: Mid-tier towers with more complex formulas and inter-tower dependencies.

### Advanced Towers (`advancedTowers.js` → `advanced/` subdirectory)

`advancedTowers.js` is a barrel re-export file. Each tower lives in its own file under `advanced/`:
- **kappa** (κ): Late-game exponential scaling from γ × β × α tripwires
- **lambda** (λ): κ × effective-enemy-count laser
- **mu** (μ): Fractal mines that charge through tiers (λ × tier × 10)
- **nu** (ν): Kill-count/damage-total powered beams with logarithmic exponent
- **xi** (ξ): Chain-lightning with exponential multi-jump damage
- **omicron** (ο): δ × ξ triangle soldiers
- **pi** (π): Rotational beam lock-on (damage = ο^|θ|/(100−Bet₁))
- **rho** (ρ): Enemy-death thero income multiplier
- **sigma** (σ): Damage bank that discharges stored ally damage
- **tau** (τ): Spiral attack × internal particles
- **upsilon** (υ): Fleet of micro-triangle ships (attack × cadence × size)
- **phi** (φ): Fibonacci golden-seed spread burst
- **chi** (χ): φ²-powered thrall gate (core × hpFrac × speed × thralls)
- **psi** (ψ): Enemy merge into clusters with AoE death explosion
- **omega** (Ω): HP-slice particles orbiting targets

### Special Towers (`mindGate.js`)
- **mind-gate** (\wp): Unique tower with special glyph mechanics for life and regeneration

## Architecture Patterns

### Blueprint Context Pattern

To avoid circular dependencies between `towersTab.js` and tower blueprints, we use a shared context pattern:

```javascript
// In tower blueprint files:
import { blueprintContext } from './blueprintContext.js';
const ctx = () => blueprintContext;

// Use helper functions via context:
const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
const alphaValue = ctx().calculateTowerEquationResult('alpha');
```

This allows tower blueprints to access helper functions from `towersTab.js` without creating circular imports.

### Helper Functions Available via Context

- `deriveGlyphRankFromLevel(level, minimum)` - Calculate glyph rank from upgrade level
- `getTowerEquationBlueprint(towerId)` - Get blueprint for another tower
- `ensureTowerUpgradeState(towerId, blueprint)` - Get/create upgrade state
- `calculateTowerEquationResult(towerId, visited)` - Calculate tower's total value
- `getDynamicConnectionCount(towerType)` - Get count of connected towers of a type

## Adding a New Tower

### 1. Choose the Appropriate File

- **Basic mechanics?** → `basicTowers.js`
- **Mid-tier complexity?** → `greekTowers.js`
- **Advanced/late-game?** → Create `advanced/<towerName>Equation.js` and re-export from `advancedTowers.js`
- **Unique special mechanics?** → Create new file (e.g., `specialTowers.js`)

### 2. Define the Blueprint

```javascript
export const newTower = {
  mathSymbol: String.raw`\symbol`,  // LaTeX symbol
  baseEquation: 'Symbol = Formula',  // Master Equation display text
  variables: [
    {
      key: 'variableName',           // Unique key for this variable
      symbol: 'X',                    // Short symbol
      equationSymbol: 'FullName',    // Display name in equations
      glyphLabel: 'ℵ₁',              // Aleph glyph label (if upgradable)
      name: 'Variable Name',          // UI display name
      description: 'What this does',
      baseValue: 10,                  // Starting value (if upgradable)
      step: 5,                        // Increment per level (if upgradable)
      upgradable: true,               // Can player upgrade this?
      format: (value) => `${formatWholeNumber(value)} units`,
      cost: (level) => Math.max(1, 10 + level),  // Glyph cost formula
      
      // For computed variables:
      computeValue({ blueprint, towerId }) {
        // Calculate value from other towers or state
        const otherValue = ctx().calculateTowerEquationResult('otherId');
        return otherValue * 2;
      },
      
      // Display sub-equations for tooltips:
      getSubEquations({ level, value }) {
        const rank = ctx().deriveGlyphRankFromLevel(level, 1);
        return [
          {
            expression: String.raw`\( X = 10 \times \aleph_{1} \)`,
            values: String.raw`\( ${formatWholeNumber(value)} = 10 \times ${formatWholeNumber(rank)} \)`,
          },
        ];
      },
    },
    // ... more variables
  ],
  
  // Calculate final tower result from variable values:
  computeResult(values) {
    const x = Number.isFinite(values.variableName) ? values.variableName : 0;
    return x * 100;  // Your formula here
  },
  
  // Format the equation with actual values:
  formatBaseEquationValues({ values, result, formatComponent }) {
    const x = Number.isFinite(values.variableName) ? values.variableName : 0;
    return `${formatComponent(result)} = ${formatComponent(x)} × 100`;
  },
};
```

### 3. Export in index.js

```javascript
import { newTower } from './yourFile.js';

export const TOWER_EQUATION_BLUEPRINTS = {
  // ...existing towers
  newTower,  // or 'new-tower': newTower if ID differs from export name
};
```

### 4. Update Documentation

- Add tower to `docs/PROGRESSION.md` with formulas
- Update this agent.md file with the new grouping

## Variable Naming Conventions

### Aleph Symbols (ℵ)
- **ℵ₁, ℵ₂, ℵ₃...** - Glyph upgrade slots
- Used in `glyphLabel` property
- Rendered with subscript digits
- Represent player-invested glyph currency

### Common Variable Keys
- `atk`, `attack` - Damage values
- `spd`, `speed` - Attack rate/cadence
- `range`, `m` - Effective reach
- `pierce` - Penetration depth
- `def`, `defense` - Protective values
- `life`, `recovery` - Sustainability metrics

### Equation Symbols
- **Greek letters** (α, β, γ, δ...) - Tower identifiers
- **LaTeX notation** - Use `String.raw` for backslashes
- **Mathematical operators** - Standard notation (×, +, -, ÷, ^, √, ln, etc.)

## Import/Export Patterns

### Always use ES6 modules:
```javascript
// ✅ Good
import { formatWholeNumber } from '../../scripts/core/formatting.js';
export const towerName = { ... };

// ❌ Bad
const { formatWholeNumber } = require('...');  // No CommonJS
module.exports = { ... };
```

### Import only what you need:
```javascript
// ✅ Good
import { formatWholeNumber, formatDecimal } from '../../scripts/core/formatting.js';

// ❌ Bad (imports everything)
import * as formatting from '../../scripts/core/formatting.js';
```

## Testing Changes

1. **Open `index.html`** in a browser (no build step needed)
2. **Check console** for import errors
3. **Test tower selection** UI in-game
4. **Verify upgrade equations** display correctly
5. **Test calculations** by upgrading towers
6. **Check tower connections** if tower depends on others

## Common Issues

### "Cannot read property of null" in blueprint methods
- **Cause**: `blueprintContext` not initialized yet
- **Solution**: Ensure `towersTab.js` calls `initializeBlueprintContext` on load

### Circular dependency errors
- **Cause**: Importing from `towersTab.js` in blueprint files
- **Solution**: Use `blueprintContext` pattern instead of direct imports

### Tower not appearing in UI
- **Cause**: Not exported in `index.js` or wrong key in TOWER_EQUATION_BLUEPRINTS
- **Solution**: Check export name matches tower ID used elsewhere

### Equation not calculating correctly
- **Cause**: Variable `key` mismatch or wrong `computeValue` formula
- **Solution**: Verify variable keys match between `computeResult` and variable definitions

## Maintenance Guidelines

### When Modifying Blueprints
1. **Keep changes minimal** - Only modify what's necessary
2. **Preserve comments** - Mathematical formulas benefit from explanation
3. **Test thoroughly** - Blueprint changes affect game balance
4. **Update PROGRESSION.md** - Document formula changes

### When Adding New Files
1. **Follow naming convention** - `[category]Towers.js`
2. **Update index.js** - Add imports and exports
3. **Create documentation** - Update this agent.md
4. **Group logically** - Keep related towers together

### When Refactoring
1. **Avoid breaking changes** - Maintain blueprint structure
2. **Keep backwards compatibility** - Existing save files depend on tower IDs
3. **Test all towers** - Changes to shared helpers affect everything
4. **Document architectural changes** - Update this file

## Related Files

- `../towersTab.js` - Main tower UI and state management
- `../../scripts/core/formatting.js` - Number formatting utilities
- `../../scripts/core/mathText.js` - Mathematical text rendering
- `../playfield/` - Tower placement and combat logic
- `docs/PROGRESSION.md` - Game balance and formulas

---

**Questions?** Check `/AGENT_START_HERE.md` for navigation or `/AGENTS.md` for project-wide conventions.
