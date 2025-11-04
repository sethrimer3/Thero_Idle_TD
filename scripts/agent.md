# Scripts Directory – Quick Reference

## Purpose
Modular JavaScript architecture for Thero Idle's core systems.

## Structure
```
scripts/
├── core/               # Shared utilities (formatting, mathText)
├── features/towers/   # Tower implementations (α, β, γ, etc.)
└── features/          # Self-contained gameplay systems
```

## Quick Navigation

| Task | File Location |
|------|---------------|
| Number formatting | `core/formatting.js` |
| Math text rendering | `core/mathText.js`, `core/mathTokens.js` |
| Tower mechanics | `features/towers/<TowerName>.js` |
| Tower list | `features/towers/TOWER_INDEX.md` |

**Deep dive:** See `core/agent.md` and `features/towers/agent.md` for detailed patterns.

## Key Principles

1. **Module size:** <200 lines when practical (readability > strict limits)
2. **ES6 modules:** Explicit imports only, no globals
3. **Dependencies:** `features/` → `core/` (one-way flow)
4. **Mathematical formulas:** Always document with JSDoc comments

## Common Patterns

**Formula documentation:**
```javascript
/**
 * Formula: baseDamage * (1 + exponent)^2
 * @param {number} exponent - Current Beta exponent (0-10)
 * @returns {number} Final attack damage
 */
```

**Naming conventions:**
- Classes: `PascalCase.js`
- Modules: `camelCase.js`
- Towers: `<greekLetter>Tower.js`
- Constants: `SCREAMING_SNAKE_CASE`

## Testing
No automated tests. Validate by:
1. Open `index.html` in browser
2. Check console for errors
3. Test on mobile viewport (portrait first)

## Quick Tips
- Check subdirectory `agent.md` files for detailed patterns
- Tower implementations follow similar structure
- Module dependencies explicit in imports
- Follow Greek letter theme for towers
