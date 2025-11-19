# Thero Idle – Agent Guide

**Live build:** https://sethrimer3.github.io/Thero_Idle_TD/

Welcome to the Thero Idle project. This document provides shared context and
conventions for all AI collaborators working anywhere inside this repository.

## Quick Start for Agents

**New to this project?** Read this file first, then navigate to context-specific agent.md files:

- **Working in `/scripts/`?** → Read `/scripts/agent.md` for module organization
- **Creating/modifying towers?** → Read `/scripts/features/towers/agent.md` for tower patterns
- **Working with core utilities?** → Read `/scripts/core/agent.md` for formatting and math text
- **Modifying main game loop?** → Read `/assets/agent.md` for integration patterns
- **Working on playfield systems?** → Read `/assets/playfield/agent.md` for subsystem architecture
- **Updating documentation?** → Read `/docs/agent.md` for documentation standards

**Key architectural docs:**
- `/docs/JAVASCRIPT_MODULE_SYSTEM.md` - Module organization rules
- `/docs/PROGRESSION.md` - Game progression, levels, formulas
- `/docs/PLATFORM_SUPPORT.md` - Mobile-first development approach
- `.github/copilot-instructions.md` - GitHub Copilot specific guidelines

**Quick Navigation Rules:**
- Number formatting → `scripts/core/formatting.js`
- Math text rendering → `scripts/core/mathText.js`
- Tower formulas → `scripts/features/towers/<TowerName>.js`
- Game configuration → `assets/configuration.js`
- Main orchestration → `assets/main.js`

## Vision Snapshot
- **Platform targets:** iOS and Android builds 
- **Core loop:** A tower-defense idle hybrid inspired by titles such as *The Tower*,
  *Exponential Idle*, and *The Powder Game*.
- **Mathematical identity:** Gameplay, upgrades, and narrative should lean into a
  "mystically mathematical" aesthetic. Enemies, towers, and UI elements should use
  Greek letters, mathematical symbols, and textbook-style or chalk on blackboard script fonts.
- **Powder-side mode:** Falling-sand mini activities grant bonuses (e.g., grains of sand
  per enemy kill, sand-dune height scaling income multipliers).
- **Upgrade philosophy:** Many upgrades manipulate math expressions (e.g., exponents,
  multipliers, factorial-like growth) that cascade into gameplay modifiers such as
  projectile count, damage curves, spawn rates, or idle income.

## Aesthetic Guidelines
1. **Palette:** Prefer monochrome (black, white, subtle gray). Use color sparingly to
   highlight special projectiles, unique enemies, or powder effects. The currently selected color palette is the one chosen in the Codex, and each palette defines a gradient that propagates through many visual elements.
2. **Typography:** Favor elegant, scholarly serif or script fonts reminiscent of
   mathematics lecture notes or chalk on blackboard writing. When adding UI labels, ensure they harmonize with the
   theme.
3. **Iconography:** Reference mathematical symbols, geometric constructions, and Greek
   letters for visual motifs. Keep silhouettes clean and minimalistic.

## Gameplay & Systems Notes
- **Tower mechanics:** Towers should have upgrade branches tied to mathematical
  operators (addition, multiplication, exponentiation, etc.). Changes to towers should
  clearly state how formulas affect outcomes.
- **Enemy progression:** Enemy waves should escalate using math-driven patterns (e.g.,
  prime-number spawns, Fibonacci-based health scaling) where practical.
- **Powder bonuses:** Any sand/powder subsystem should feed back into the main loop via
  calculable modifiers. Document new formulas inline when implemented.
- **Idle features:** Persist idle gains with clear math-driven rules (e.g., integrals
  over offline time, logarithmic diminishing returns) and document them.

## Collaboration Conventions
1. **Documentation:** Whenever introducing a new formula or mechanic, leave inline
   comments or docstrings describing the equation and its impact. Use Markdown tables in
   README-like docs when summarizing upgrade trees.
2. **Scripts:**  Use descriptive, theme-aligned names (e.g., `SigmaTower`, `PhiEnemy`). Tower-specific logic should be delegated into dedicated `.js` modules (e.g., `scripts/features/towers/<TowerName>.js`) rather than expanding `playfield.js` beyond core orchestration responsibilities.
3. **Code style:** Include a descriptive comment for each added piece of code.
4. **Assets:** Place new art, fonts, or audio inside appropriately named subfolders
   under `MAIN/`. Document licensing info in an accompanying `README` if required.
5. **Mobile readiness:** Design UI layouts with responsive/touch-friendly controls.
   Verify that new input schemes work for both portrait and landscape if relevant (prioritize portrait).
6. **Glyph variable language:** When the design specifies a variable such as `Glyph1`, interpret it as the
   collectible glyph symbol used for upgrades (rendered as the glyph icon with an index like `𝔊₁`). The
   lowercase form (e.g., `glyph1`) refers to the same glyph symbol with the index styled as a subscript.
   Treat all glyph variables as upgradeable slots within the tower menus.
7. **Build numbering:** Increment the build number in `assets/buildInfo.js` by `+1` for every committed change and lead your change reports with the updated build number.

## Workflow Expectations
- **Branching:** Work on feature branches; keep commits atomic with clear messages.
- **Testing:** Run project checks or custom scripts before submitting major
  changes. Mention any manual playtesting performed on desktop/mobile targets.
- **PR descriptions:** Summarize gameplay effects, math changes, and UI adjustments.
  Highlight new formulas and how they influence balance.

## Agent.md File System

This repository uses a distributed agent.md system for context-specific guidance:

**Root level:**
- `/AGENTS.md` (this file) - Project vision, aesthetics, general conventions

**Directory-specific guides:**
- `/scripts/agent.md` - Module organization, import patterns
- `/scripts/core/agent.md` - Core utilities (formatting, math text, tokens)
- `/scripts/features/agent.md` - Feature module patterns
- `/scripts/features/towers/agent.md` - Tower implementation details
- `/assets/agent.md` - Main game integration, UI systems
- `/assets/playfield/agent.md` - Playfield subsystem architecture
- `/docs/agent.md` - Documentation standards and update workflow

**Token efficiency strategy:**
Each agent.md file is optimized for its scope:
- **Quick reference patterns** from existing code
- **Common pitfalls** specific to that area
- **Import path examples** with correct relative paths
- **When to read** guidelines for efficient navigation
- **Integration points** with other systems

**How to use:**
1. Read root `/AGENTS.md` for project vision and theme
2. Navigate to specific agent.md for detailed context
3. Follow patterns and avoid documented mistakes
4. Update agent.md when adding new patterns or conventions

Thank you for contributing to the mystical mathematics of Thero Idle!
