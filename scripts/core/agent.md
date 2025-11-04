# Core Utilities – Quick Reference

Shared utilities for number formatting and mathematical text rendering.

## Module Overview

| Module | Purpose | Most Used Functions |
|--------|---------|---------------------|
| `formatting.js` | Number display with notation modes | `formatGameNumber()`, `formatPercentage()` |
| `mathText.js` | Render math expressions in UI | `renderMathElement()`, `annotateMathText()` |
| `mathTokens.js` | Equation parsing/validation | `tokenizeEquationParts()` |

## `formatting.js` Quick Reference

**Key Functions:**
```javascript
formatGameNumber(value, decimals)  // 12500 → "12.50K"
formatWholeNumber(value)           // 1234 → "1,234"
formatPercentage(value, places)    // 0.75 → "75%"
```

**Notation Modes:**
- `LETTERS`: K, M, B, T, Qa, Qi...
- `SCIENTIFIC`: 1.00e3, 1.00e6...

## `mathText.js` Quick Reference

**Key Functions:**
```javascript
renderMathElement(element)         // Style math in DOM element
annotateMathText(text)             // Wrap expressions in tags
isLikelyMathExpression(text)       // Detect math symbols
```

**Supported Symbols:** Greek letters (α,β,γ...), operators (×,÷,±), set theory (∈,∩,∪), calculus (∫,∂,∑)

## Common Usage Patterns

**Display tower stats:**
```javascript
import { formatGameNumber } from './formatting.js';
const dmgDisplay = formatGameNumber(tower.damage, 1);
```

**Render math notation:**
```javascript
import { annotateMathText } from './mathText.js';
const text = annotateMathText("Increases α damage by β²");
```

## Number Formatting Standards

| Stat Type | Format | Example |
|-----------|--------|---------|
| Damage | 1-2 decimals | `formatGameNumber(dmg, 2)` |
| Range | 0 decimals | `formatGameNumber(rng, 0)` |
| Percentages | 0-2 decimals | `formatPercentage(val, 1)` |

## Design Principles

- Core modules are **dependency-free** (or depend only on other core modules)
- Features import from core (never reverse - prevents circular dependencies)
- All formatting is backward-compatible
- Test with edge cases: 0, negative, infinity, NaN
