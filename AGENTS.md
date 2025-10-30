# Thero Idle – Agent Guide

**Live build:** https://sethrimer3.github.io/Thero_Idle_TD/

Welcome to the Thero Idle project. This document provides shared context and
conventions for all AI collaborators working anywhere inside this repository.

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
   highlight special projectiles, unique enemies, or powder effects.
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
2. **Scripts:**  Use descriptive, theme-aligned names (e.g., `SigmaTower`, `PhiEnemy`). Tower-specific logic should be delegated into dedicated `.js` modules (e.g., `scripts/towers/<TowerName>.js`) rather than expanding `playfield.js` beyond core orchestration responsibilities.
3. **Code style:** Include a descriptive comment for each added piece of code.
4. **Assets:** Place new art, fonts, or audio inside appropriately named subfolders
   under `MAIN/`. Document licensing info in an accompanying `README` if required.
5. **Mobile readiness:** Design UI layouts with responsive/touch-friendly controls.
   Verify that new input schemes work for both portrait and landscape if relevant (prioritize portrait).
6. **Glyph variable language:** When the design specifies a variable such as `Glyph1`, interpret it as the
   collectible glyph symbol used for upgrades (rendered as the glyph icon with an index like `𝔊₁`). The
   lowercase form (e.g., `glyph1`) refers to the same glyph symbol with the index styled as a subscript.
   Treat all glyph variables as upgradeable slots within the tower menus.

## Workflow Expectations
- **Branching:** Work on feature branches; keep commits atomic with clear messages.
- **Testing:** Run project checks or custom scripts before submitting major
  changes. Mention any manual playtesting performed on desktop/mobile targets.
- **PR descriptions:** Summarize gameplay effects, math changes, and UI adjustments.
  Highlight new formulas and how they influence balance.

Thank you for contributing to the mystical mathematics of Thero Idle!
