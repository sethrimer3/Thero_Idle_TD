# Platform Support Blueprint

Glyph Defense Idle is built as a mobile-first experience, but every new system
must remain portable to an eventual desktop build. Use the following guidance
whenever you touch gameplay, UI, or infrastructure code.

## Shared Architectural Goals

- **One code path per feature.** Route platform-specific quirks through
  configuration rather than branching logic. Modules inside `scripts/` should
  expose platform-agnostic APIs that a desktop renderer can call without
  modification.
- **Input abstraction.** Keep tap, drag, and hover handling in UI/controller
  modules. Desktop builds can map those hooks to mouse and keyboard events
  without rewriting feature math.
- **Responsive layout.** Design components so they scale gracefully between
  portrait mobile screens and wider desktop canvases. Favor flexbox and CSS grid
  with rem-based sizing so the same markup adapts automatically.
- **Performance budgeting.** Use the same update loops for all platforms. Avoid
  mobile-only micro-optimizations that make a desktop build diverge.

## Module Expectations

- Place gameplay math and data transformations in `scripts/core/` or
  `scripts/features/` modules. DOM-specific bindings should live in
  `scripts/ui/`.
- Keep module exports pure where possible. Side effects—audio, DOM mutations,
  or canvas draws—should be triggered by shell code such as `assets/main.js`.
- Document every new module with a top-level comment describing how it supports
  mobile and desktop builds.

## Aleph Null Chain Upgrades

Aleph Null towers now use the dedicated chain registry in
`scripts/features/towers/alephChain.js`. Upgrades expose three variables that
any UI (mobile or desktop) can adjust through
`window.glyphDefenseUpgrades.alephChain`:

| Variable | Symbol | Effect                          | Default |
| -------- | ------ | ------------------------------- | ------- |
| `x`      | Range  | Multiplies chain hop distance   | 1.0     |
| `y`      | Speed  | Multiplies firing cadence       | 1.0     |
| `z`      | Links  | Maximum enemies struck per shot | 3       |

Desktop implementations should use the same interface—no duplicated logic is
necessary. Update docs and UI copy when adding new variables or changing base
values.

## Documentation Checklist

- Note cross-platform considerations in feature PRs.
- Update this blueprint whenever adding a new upgrade surface or platform hook.
- Record any temporary platform-specific workarounds so they can be unified
  before the desktop build ships.
