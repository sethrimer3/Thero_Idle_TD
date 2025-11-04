# Core Utilities - Agent Guide

## Purpose
Core utilities shared across all Thero Idle systems. These modules provide foundational functionality that other parts of the codebase depend on.

## Files in This Directory

### `formatting.js`
**Purpose:** Number formatting for UI display with multiple notation modes

**Key Exports:**
- `formatGameNumber(value, decimals)` - Format numbers with suffixes (K, M, B, etc.)
- `formatWholeNumber(value)` - Format integers with commas
- `formatDecimal(value, places)` - Format decimals to specific precision
- `formatPercentage(value, places)` - Convert to percentage display
- `GAME_NUMBER_NOTATIONS` - Available notation modes (letters, scientific)

**Common Usage:**
```javascript
import { formatGameNumber } from './formatting.js';
const displayDamage = formatGameNumber(12500, 2); // "12.50K"
```

**Notation Modes:**
- `LETTERS`: 1000 → "1K", 1000000 → "1M"
- `SCIENTIFIC`: 1000 → "1.00e3", 1000000 → "1.00e6"

### `mathText.js`
**Purpose:** Parse and render mathematical expressions in UI elements

**Key Exports:**
- `renderMathElement(element)` - Convert math notation to styled HTML
- `isLikelyMathExpression(text)` - Detect if string contains math symbols
- `annotateMathText(text)` - Wrap math expressions in semantic tags
- `convertMathExpressionToPlainText(expr)` - Strip formatting

**Math Symbol Support:**
- Greek letters: α, β, γ, δ, ε, ζ, η, θ, ι, κ, λ, μ, etc.
- Operators: ×, ÷, ±, ≤, ≥, ≠, ∞
- Set theory: ∈, ∉, ⊂, ⊃, ∪, ∩, ∅
- Calculus: ∫, ∂, ∇, ∑, ∏
- Subscripts/superscripts: ₀₁₂₃, ⁰¹²³

**Example:**
```javascript
import { renderMathElement } from './mathText.js';
// <span>Damage: α²</span> → renders with proper styling
renderMathElement(element);
```

### `mathTokens.js`
**Purpose:** Tokenize mathematical equations for parsing and validation

**Key Exports:**
- `tokenizeEquationParts(equation)` - Break equation into semantic tokens

**Token Types:**
- Numbers, operators, variables, functions, grouping symbols
- Used for equation validation in upgrade UI

## When to Use Core Utilities

### Use `formatting.js` when:
- Displaying damage, health, currency, or any numeric stat
- Converting decimal values to percentages
- Formatting large numbers for readability
- Switching between notation modes (preferences system)

### Use `mathText.js` when:
- Rendering tower names with Greek letters
- Displaying upgrade descriptions with formulas
- Creating UI elements that show mathematical expressions
- Converting user-facing text to include proper symbols

### Use `mathTokens.js` when:
- Parsing custom upgrade equations
- Validating mathematical expressions from config
- Building equation editors or formula displays

## Common Patterns

### Format Tower Stats
```javascript
import { formatGameNumber, formatPercentage } from '../../scripts/core/formatting.js';

const dmgDisplay = formatGameNumber(tower.damage, 1);
const rngDisplay = formatGameNumber(tower.range, 0);
const spdDisplay = formatPercentage(tower.attackSpeed / BASE_SPEED, 0);
```

### Render Math Notation
```javascript
import { annotateMathText } from '../../scripts/core/mathText.js';

// In upgrade description
const text = "Increases α damage by β²";
const annotated = annotateMathText(text);
// Returns HTML with proper math styling
```

## Integration Notes

### Dependencies
- Core modules should be **dependency-free** or only depend on other core modules
- Features import from core, not vice versa
- Assets can import from core for utility functions

### Backward Compatibility
- Formatting functions used throughout codebase - changes must be backward compatible
- Math rendering affects all UI text - test thoroughly on mobile
- Notation changes require user preference migration

## Mathematical Conventions

### Number Suffixes
```
1000        → 1K
1,000,000   → 1M
1,000,000,000 → 1B
Follow pattern: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc
```

### Decimal Precision
- **Damage:** 1-2 decimals (`formatGameNumber(dmg, 2)`)
- **Range:** 0 decimals (whole meters)
- **Rates:** 2 decimals for precision
- **Percentages:** 0-2 decimals depending on context

### Formula Documentation Style
Always use this pattern:
```javascript
/**
 * Brief description of what the calculation does.
 * 
 * Formula: mathematical_expression
 * 
 * @param {type} name - Description
 * @returns {type} Description
 */
```

## Common Mistakes to Avoid

❌ **Don't** mix formatting functions - use consistent formatters throughout a feature
❌ **Don't** call `formatGameNumber` on already-formatted strings
❌ **Don't** forget to handle edge cases (zero, negative, infinity, NaN)
❌ **Don't** hardcode decimal places - use appropriate formatter defaults

✅ **Do** use `formatGameNumber` for all large stat displays
✅ **Do** cache formatting results if rendering frequently (e.g., in game loop)
✅ **Do** test formatting with extreme values (very small, very large)
✅ **Do** preserve mathematical symbols in UI text using `mathText.js`

## Token Efficiency Tips

**For agents reading this:**
- These are the **most frequently used** utilities in the codebase
- Import patterns are consistent: named exports, ES6 syntax
- Number formatting follows industry-standard patterns (K/M/B)
- Math text rendering automatically handles Greek letters and symbols
- Check function signatures in code - all params are documented
