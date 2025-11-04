# Documentation Directory - Agent Guide

## Purpose
Design documents and technical guides that describe game systems, progression, and architecture. These docs should be updated when making significant changes to game mechanics.

## Files Overview

### `JAVASCRIPT_MODULE_SYSTEM.md`
**Purpose:** Module organization rules and architectural patterns

**When to update:**
- Adding new directory under `scripts/`
- Creating new module patterns
- Changing import/export conventions
- Restructuring code organization

**Key sections:**
- Directory layout rules
- File naming conventions
- Module responsibilities
- Dependency patterns
- Progressive enhancement strategy

**Read this when:**
- Creating new feature modules
- Organizing code into subdirectories
- Understanding module boundaries
- Planning code structure

### `PLATFORM_SUPPORT.md`
**Purpose:** Cross-platform development guidelines (mobile-first approach)

**When to update:**
- Adding mobile-specific features
- Changing responsive breakpoints
- Updating input handling approaches
- Modifying viewport strategies

**Key sections:**
- Mobile-first philosophy
- Touch vs mouse input
- Responsive design patterns
- Performance considerations
- Native app preparation

**Read this when:**
- Adding UI elements
- Implementing input handlers
- Testing on different devices
- Optimizing for mobile performance

### `PROGRESSION.md`
**Purpose:** Complete game progression system, level descriptions, enemy mechanics

**When to update:**
- Adding new levels or level sets
- Modifying enemy health/behavior
- Changing tower unlock progression
- Adding new gameplay mechanics
- Updating upgrade formulas

**Key sections:**
- Level structure (30 levels, 6 sets)
- Path landmarks and visual rhythm
- Dynamic formula spotlight levels
- Individual level descriptions
- Enemy types and behaviors
- Mathematical progression patterns

**Read this when:**
- Creating new levels
- Balancing difficulty curves
- Understanding enemy mechanics
- Designing tower unlock trees
- Implementing mathematical formulas

### `iota-aleph-upgrades.md`
**Purpose:** Specific design for Iota tower and Aleph chain systems

**When to update:**
- Modifying Iota tower mechanics
- Changing Aleph chain formulas
- Adding new Aleph variants
- Updating upgrade paths for these towers

**Key sections:**
- Iota tower integration mechanics
- Aleph null, one, two, etc. designs
- Cardinality-based upgrade systems
- Special interaction mechanics

**Read this when:**
- Working on Iota or Aleph towers
- Understanding advanced tower mechanics
- Implementing cardinality systems

### `main_refactor_contexts.md`
**Purpose:** Historical context and refactoring notes

**When to update:**
- Completing major refactors
- Documenting architectural decisions
- Recording migration patterns

**Read this when:**
- Understanding why code is structured a certain way
- Planning large refactors
- Researching historical decisions

## Documentation Update Workflow

### When Adding a New Feature

1. **Identify affected docs:**
   - New module? → Update `JAVASCRIPT_MODULE_SYSTEM.md`
   - New level? → Update `PROGRESSION.md`
   - New platform support? → Update `PLATFORM_SUPPORT.md`

2. **Update relevant sections:**
   - Add feature to appropriate section
   - Document formulas and mechanics
   - Include examples if helpful

3. **Keep docs synchronized:**
   - Code changes should match doc descriptions
   - Update docs in same PR as code changes
   - Review docs during code review

### When Modifying Game Balance

1. **Document current state first:**
   - Note existing formulas in comments
   - Reference current values in `PROGRESSION.md`

2. **Update documentation:**
   - Change formula descriptions
   - Update example calculations
   - Note balance implications

3. **Test and verify:**
   - Ensure docs match implementation
   - Verify examples are correct
   - Check cross-references are valid

## Documentation Standards

### Mathematical Formulas
Always use this format:
```markdown
**Formula:** `base × multiplier^level × (1 + bonus)`

Where:
- `base` = starting damage (10-1000 range)
- `multiplier` = growth rate (1.2-2.0 typical)
- `level` = upgrade level (0-10 range)
- `bonus` = percentage bonus from glyphs (0-1)

**Example:**
Level 5 with 20% bonus:
`50 × 1.5^5 × (1 + 0.2) = 456.8 damage`
```

### Level Descriptions
Follow this pattern:
```markdown
### Level N - Name

**Path type:** Geometric description (lemniscate, spiral, etc.)
**Mathematical basis:** Formula or pattern (r² = cos(2θ), Fibonacci, etc.)
**Special mechanics:** Unique gameplay features
**Enemy types:** Primary enemy variants
**Difficulty notes:** What makes this level challenging
```

### Code Examples
Include when helpful:
```markdown
```javascript
/**
 * Example implementation
 */
function calculateDamage(level) {
  return BASE_DAMAGE * Math.pow(1.5, level);
}
```
```

## Cross-Referencing

### From Code to Docs
```javascript
/**
 * Calculate Beta tower damage.
 * 
 * Formula documented in: docs/PROGRESSION.md (Beta Tower section)
 * 
 * @param {number} level - Upgrade level (0-10)
 */
```

### From Docs to Code
```markdown
**Implementation:** See `scripts/features/towers/betaTower.js`

The Beta tower damage formula is calculated in `calculateBetaAttack()`.
```

## Common Documentation Tasks

### Adding a New Tower

Update these sections in `PROGRESSION.md`:

1. **Tower unlock tree** - Add to Greek letter sequence
2. **Tower formulas** - Document damage/range/speed calculations
3. **Upgrade paths** - Describe available upgrades
4. **Special mechanics** - Note unique behaviors

Example:
```markdown
### Mu (μ) Tower

**Unlock level:** 18
**Base cost:** 5000 Θ
**Theme:** Factorial growth mechanics

**Formulas:**
- Damage: `base × (level+1)! / level!` = `base × (level+1)`
- Range: `5 + level × 0.5` meters
- Attack speed: `1.0 + level × 0.1` attacks/sec

**Special ability:** Damage increases factorially when adjacent to
towers of same type (stacking multiplier).
```

### Adding a New Level

Update `PROGRESSION.md`:

1. Add to appropriate set (Conjecture, Corollary, etc.)
2. Describe path geometry and mathematical basis
3. List enemy types and special mechanics
4. Note difficulty considerations

### Documenting a Formula Change

1. **Find old formula in docs**
2. **Update with new formula**
3. **Explain why change was made** (balance, clarity, theme)
4. **Update examples** if present
5. **Check for cross-references** in other docs

Example update:
```markdown
### Beta Tower Damage (Updated 2024)

~~Old formula: `base × level^2`~~

**New formula:** `base × (1 + level)^2`

**Reason:** Old formula had zero damage at level 0, causing confusion.
New formula provides smooth scaling starting from level 0.

**Example:**
- Level 0: `50 × (1 + 0)^2` = 50 damage
- Level 5: `50 × (1 + 5)^2` = 1800 damage
- Level 10: `50 × (1 + 10)^2` = 6050 damage
```

## Documentation Quality Checklist

When updating docs:
- [ ] Mathematical formulas are accurate
- [ ] Examples use realistic values
- [ ] Code references are correct (file paths, function names)
- [ ] Cross-references are valid
- [ ] Formatting is consistent (headings, lists, code blocks)
- [ ] No outdated information remains
- [ ] New sections fit the existing structure
- [ ] Grammar and spelling are correct

## Documentation Hierarchy

**For understanding game design:**
1. Start with `PROGRESSION.md` - Overall progression and level design
2. Then `PLATFORM_SUPPORT.md` - Platform-specific considerations
3. Then `JAVASCRIPT_MODULE_SYSTEM.md` - Code organization

**For implementing features:**
1. Start with `JAVASCRIPT_MODULE_SYSTEM.md` - Where to put code
2. Then `PROGRESSION.md` - Game mechanics and formulas
3. Then specific tower docs if applicable (`iota-aleph-upgrades.md`)

**For balancing gameplay:**
1. Start with `PROGRESSION.md` - Current balance state
2. Update formulas in code
3. Update docs to match code changes

## Common Mistakes to Avoid

❌ **Don't** leave docs out of sync with code
❌ **Don't** forget to update examples when formulas change
❌ **Don't** use vague descriptions ("tower does damage")
❌ **Don't** skip documenting the "why" behind formulas
❌ **Don't** assume readers have context - explain fully

✅ **Do** update docs in the same PR as code changes
✅ **Do** provide concrete examples with numbers
✅ **Do** explain mathematical formulas clearly
✅ **Do** document design rationale
✅ **Do** keep formatting consistent

## Quick Reference: What to Update When

| Change Type | Update These Docs |
|------------|-------------------|
| New tower | `PROGRESSION.md` - tower formulas, unlock tree |
| New level | `PROGRESSION.md` - level set section |
| Tower balance | `PROGRESSION.md` - formula section, examples |
| Enemy behavior | `PROGRESSION.md` - enemy types section |
| New module/directory | `JAVASCRIPT_MODULE_SYSTEM.md` - directory layout |
| Input handling | `PLATFORM_SUPPORT.md` - input patterns |
| Mobile optimization | `PLATFORM_SUPPORT.md` - performance section |
| Iota/Aleph changes | `iota-aleph-upgrades.md` - specific sections |
| Major refactor | `main_refactor_contexts.md` - add context notes |

## Token Efficiency Tips

**For agents reading this:**
- Read `PROGRESSION.md` FIRST for game mechanics understanding
- `JAVASCRIPT_MODULE_SYSTEM.md` tells you where to put new code
- `PLATFORM_SUPPORT.md` explains mobile-first approach
- Formula changes MUST update `PROGRESSION.md` - no exceptions
- New levels MUST be documented in `PROGRESSION.md`
- Examples in docs should use realistic values from actual gameplay
- Documentation update is NOT optional - it's part of the feature
- Check docs/agent.md BEFORE adding new docs to understand structure
