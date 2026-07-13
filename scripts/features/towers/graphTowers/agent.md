# Graph Towers — Agent Guide

## Overview
The `graphTowers/` directory implements the Mathematical Test Tower Arsenal:
four experimental graph-based towers sharing a common framework.

## Architecture

### Shared Framework
- **GlyphEquation.js** — Glyph-driven equation system with symbolic/numeric display
- **GraphTowerBase.js** — Base class: glyph management, point pool, renderer, equation registry
- **GraphPointPool.js** — Object-pooled point storage with sweep-remove lifecycle
- **GraphRenderer.js** — Cached grid rendering + batched point drawing
- **EquationDisplay.js** — UI helper for rendering equations in DOM or on canvas

### Tower Implementations
| Tower | File | Identity |
|-------|------|----------|
| Regression | `RegressionTower.js` | Least-squares beam attacks |
| Density Collapse | `DensityCollapseTower.js` | Heatmap → explosion |
| Orbital Collapse | `OrbitalCollapseTower.js` | Radial energy → two-stage implosion |
| Polynomial Engine | `PolynomialEngineTower.js` | Polynomial curve weaponisation |

### Tower Data Definitions
Located in `/assets/data/towers/`:
- `regression.js`, `density-collapse.js`, `orbital-collapse.js`, `polynomial-engine.js`

## Glyph System
Six tiers (ascending rarity): Aleph (ℵ) → Bet (בּ) → Lamed (ל) → Tsadi (צ) → Shin (ש) → Kuf (ק)

### Tier Behaviors
| Tier | Role |
|------|------|
| Aleph | Small additive increases |
| Bet | Medium additive + mild mechanics |
| Lamed | Multipliers + major stat increases |
| Tsadi | Behavioral transformations |
| Shin | Multi-stage effects |
| Kuf | Capstone mechanics |

## Key Patterns

### Adding a New Equation
```javascript
this._myEq = new GlyphEquation('MyValue', [
  { coefficient: 10, glyph: null },      // constant
  { coefficient: 2,  glyph: 'Aleph' },   // linear glyph term
  { coefficient: 0.5, glyph: 'Lamed', op: 'floor' }, // floor operation
], { min: 1, floor: true });
this.equations.set('MyValue', this._myEq);
```

### Creating a New Graph Tower
1. Extend `GraphTowerBase`
2. Override `_buildEquations()` to add glyph equations
3. Override `_onTick(dt, now)` for per-frame logic
4. Override `_drawOverlay(ctx, toPixel, radius, scale, cx, cy, now)` for rendering
5. Add tower data in `/assets/data/towers/`
6. Register in `/assets/data/towers/index.js`

## Performance Notes
- Points use object pooling (no GC churn)
- Grid is cached to offscreen canvas (rebuilt only on radius change)
- Heatmap uses Float32Array (pre-allocated)
- Polynomial fitting uses Gaussian elimination (O(n·d²))
