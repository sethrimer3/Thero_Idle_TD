# GitHub Copilot Coding Agent Instructions

This file provides configuration and best practices for GitHub Copilot coding agent when working with the Thero Idle project.

## Project Overview

Thero Idle is a mobile-first tower-defense idle game with a mystically mathematical theme. The game is built with vanilla JavaScript, HTML5, and CSS, and is deployed to GitHub Pages.

**Live build:** https://sethrimer3.github.io/Thero_Idle_TD/

## Repository Structure

```
Thero_Idle_TD/
├── .github/              # GitHub configuration and workflows
├── assets/               # Sprites, fonts, styles, and other static assets
├── docs/                 # Design documents and technical guides
├── scripts/              # JavaScript modules organized by responsibility
│   ├── core/            # Core utilities, math helpers, event bus
│   ├── features/        # Self-contained gameplay systems (towers, upgrades)
│   └── ...
├── index.html           # Main entry point for the game
├── AGENTS.md            # Detailed agent collaboration guide (READ THIS FIRST)
└── README files         # Additional documentation
```

## Key Documents to Review

Before making changes, **always** read these documents in order:

1. **AGENTS.md** - Primary collaboration guide with vision, aesthetics, and coding conventions
2. **docs/JAVASCRIPT_MODULE_SYSTEM.md** - Module organization and file structure rules
3. **docs/PLATFORM_SUPPORT.md** - Cross-platform considerations (mobile-first, desktop-ready)
4. **docs/PROGRESSION.md** - Game progression system and upgrade mechanics

## Development Workflow

### Building and Testing

This is a front-end only project with no build step. To test changes:

1. **Local testing:** Open `index.html` in a web browser (or use a local HTTP server)
2. **Manual testing:** Exercise new features by playing through the affected areas
3. **Mobile testing:** Test on mobile viewports (portrait orientation prioritized)
4. **Browser console:** Check for JavaScript errors and warnings

### No Automated Tests

This project does **not** have automated unit or integration tests. Validate changes through:
- Manual gameplay testing
- Browser console inspection
- Visual inspection of UI changes
- Code review

### Linting and Code Quality

There are currently no automated linters configured. Follow these conventions:

- Use consistent JavaScript ES6+ syntax
- Include descriptive comments for complex logic
- Document mathematical formulas inline with JSDoc-style comments
- Keep functions focused and modules under 200 lines

## Code Change Guidelines

### Minimal Changes Philosophy

- Make the **smallest possible changes** to achieve the goal
- Do NOT refactor unrelated code unless fixing a security issue
- Preserve existing working functionality
- Split large changes into focused, reviewable units

### Module Organization

- **New features:** Create in `scripts/features/<name>/` with an `index.js` entry point
- **Core utilities:** Add to appropriate `scripts/core/` module
- **Tower implementations:** Place in `scripts/features/towers/<TowerName>.js`
- **File size limit:** Keep modules under 200 lines; split if approaching this limit

### Naming Conventions

- **Classes:** PascalCase (e.g., `TowerManager.js`)
- **Modules/singletons:** camelCase (e.g., `progressionRegistry.js`)
- **Tower names:** Greek letter theme (e.g., `alphaTower.js`, `betaTower.js`)
- **Variables:** Follow the glyph variable language from AGENTS.md

### Documentation Requirements

When adding or modifying code:

1. **Inline comments:** Document formulas, algorithms, and non-obvious logic
2. **Mathematical formulas:** Use JSDoc-style comments to describe equations
3. **Update design docs:** Reference relevant docs when introducing new mechanics
4. **ASCII diagrams:** Include dependency diagrams for new feature modules

## Theme and Aesthetic Requirements

### Visual Identity

- **Palette:** Monochrome (black, white, subtle gray) with minimal color accents
- **Typography:** Scholarly serif fonts, mathematical chalk-on-blackboard style
- **Icons:** Greek letters, mathematical symbols, geometric constructions
- **Style:** Clean, minimalistic, academically mathematical

### Mathematical Identity

All gameplay elements should embrace a "mystically mathematical" aesthetic:

- Towers use Greek letter names (α, β, γ, δ, ε, ζ, η, θ, ι, κ, λ)
- Upgrades manipulate mathematical expressions (exponents, multipliers, factorials)
- Enemy progression follows mathematical patterns (primes, Fibonacci)
- UI elements display equations and mathematical notation

### Glyph Variable Language

When designs specify variables like `Glyph1`:
- `Glyph1` = collectible glyph symbol with icon rendering (e.g., `𝔊₁`)
- `glyph1` = same symbol with subscript styling
- All glyphs are upgradeable slots within tower menus

## Mobile-First Development

### Platform Priorities

1. **Primary:** iOS and Android mobile browsers (portrait orientation)
2. **Secondary:** Desktop browsers (landscape)
3. **Future:** Native mobile apps

### Mobile Considerations

- Use responsive layouts (flexbox, CSS grid, rem-based sizing)
- Design for touch input (adequate tap targets, swipe gestures)
- Test portrait orientation first, then landscape
- Keep input abstracted (touch/mouse/keyboard handlers in UI layer)
- Avoid mobile-only optimizations that break desktop portability

## Security and Quality

### Security Guidelines

- **No secrets:** Never commit credentials, API keys, or tokens
- **Client-side only:** This is a static site; no backend to secure
- **External dependencies:** Minimize third-party scripts; audit when adding
- **User data:** Any localStorage usage must be documented

### Code Review Expectations

Before finalizing changes:

1. Review all modified files
2. Check browser console for errors
3. Test on mobile viewport (portrait)
4. Verify mathematical formulas are correct
5. Ensure theme/aesthetic consistency
6. Update relevant documentation

## Common Tasks

### Adding a New Tower

1. Create `scripts/features/towers/<TowerName>.js`
2. Follow the mathematical theme (use Greek letters)
3. Document damage formulas and upgrade paths
4. Register in tower selection UI
5. Update design docs with formula tables
6. Test upgrade math progression

### Adding UI Elements

1. Use existing font families (Cormorant Garamond, Great Vibes, Space Mono)
2. Maintain monochrome palette
3. Include mathematical notation where appropriate
4. Test on mobile viewport first
5. Ensure touch-friendly sizes (44×44px minimum)

### Modifying Game Balance

1. Document existing formulas before changing
2. Use inline comments to explain new math
3. Test progression curves manually
4. Update relevant design docs (docs/PROGRESSION.md)
5. Consider idle/offline implications

## Git and Version Control

### Branch Protection

- Main branch: `main` (protected)
- Feature branches: Use descriptive names (e.g., `feature/sigma-tower-upgrade`)
- Copilot branches: Prefixed with `copilot/`

### Commit Messages

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Summarize gameplay/formula changes in detail

### Pull Request Guidelines

- **Title:** Clear summary of what changed
- **Description:** 
  - Explain the problem solved
  - Describe gameplay/UI/formula changes
  - Note any math formula modifications
  - Include testing performed
- **Review:** All PRs require human approval before merge

## Getting Help

### Documentation Hierarchy

1. **AGENTS.md** - Start here for all collaboration guidelines
2. **docs/** - Technical implementation details
3. **This file** - Copilot-specific best practices
4. **Code comments** - Inline documentation for specific logic

### When Stuck

- Review existing tower implementations for patterns
- Check `scripts/core/` for reusable utilities
- Read relevant docs before asking for guidance
- Test changes incrementally and iteratively

## Success Criteria

Changes are successful when they:

1. ✅ Accomplish the stated goal with minimal code changes
2. ✅ Maintain the mathematical/scholarly aesthetic
3. ✅ Work on mobile viewports (portrait orientation)
4. ✅ Include appropriate inline documentation
5. ✅ Don't break existing functionality
6. ✅ Follow module organization conventions
7. ✅ Are manually tested and verified

---

**Remember:** Read AGENTS.md for detailed vision, conventions, and workflow expectations. This file supplements those guidelines with Copilot-specific instructions.
