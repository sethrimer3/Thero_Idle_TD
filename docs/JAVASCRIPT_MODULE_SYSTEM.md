# JavaScript Module Organization

This guide explains how to grow Glyph Defense Idle's JavaScript codebase while keeping
files compact, discoverable, and easy for AI or human collaborators to extend. Follow
these rules whenever you add scripts to the project.

## Directory Layout

Create a top-level `scripts/` directory beside `assets/`, with the following subfolders:

- `scripts/core/` — App shell bootstrapping, shared utilities, math helpers, and the
  event bus.
- `scripts/state/` — Game state management modules, persistence helpers, and data
  models for towers, enemies, resources, and progression.
- `scripts/ui/` — View controllers, DOM bindings, render helpers, and animation hooks.
- `scripts/features/` — Self-contained gameplay systems (e.g., tower upgrades,
  powder bonuses) that plug into `core` and `state` modules via well-defined
  interfaces.
- `scripts/data/` — Static JSON or JS data definitions (level manifests, enemy
  catalogues, upgrade tables). Keep generated files in subdirectories such as
  `scripts/data/generated/`.

Always keep module files under 200 lines. Split features further if they approach this
limit.

## File Naming Conventions

- Use PascalCase for classes (e.g., `TowerManager.js`) and camelCase for singleton
  modules (e.g., `progressionRegistry.js`).
- Include the subsystem prefix when it clarifies the intent, such as
  `ui/TabsController.js` or `state/resourceLedger.js`.
- Co-locate test or demo harnesses next to the module as `<Name>.spec.js` or
  `<Name>.demo.js`.

## Module Responsibilities

Each module should own a single responsibility:

- `core/boot.js`: Entry point that wires DOM ready events, loads the state store, and
  hands control to the UI shell.
- `core/events.js`: Centralized event emitter with typed channels for `game`, `ui`,
  and `telemetry` domains.
- `state/store.js`: Reactive store that exposes `getState()`, `subscribe()`, and
  `dispatch()` functions. Reducers live in `state/reducers/` and are split by domain
  (`progressionReducer`, `resourceReducer`, etc.).
- `ui/panelRegistry.js`: Maintains the map of tab buttons to content sections and
  handles accessibility focus trapping.
- `features/progression/levelSelector.js`: Populates the level grid, uses
  `state/progressionSelector.js` to fetch the active set, and raises `events.emit('ui:levelSelected')`.
- `data/levels.js`: Exports the level taxonomy shown in `docs/PROGRESSION.md` as a
  structured object that the UI renders.

Use dependency arrows that point inward to `core` and `state`. Feature modules may
call into UI modules for rendering but should avoid cross-feature imports. When two
features need to talk, have them publish events through `core/events.js` or share
state through selectors.

## Shared Utility Patterns

- `core/mathUtils.js`: Provide reusable numerical helpers (formatting, growth
  curves, random seeds) to avoid duplicating logic.
- `core/domTools.js`: Wrap DOM queries and templating so features manipulate
  components declaratively.
- `state/selectors/*.js`: Functions that compute derived values (e.g., `selectActiveLevel`) without mutating state.
- `state/actions/*.js`: Action creator modules that encode the math-driven formulas
  mentioned in the design docs.

Always document the formula or algorithm inline with JSDoc-style comments.

## Progressive Enhancement Strategy

1. Start new gameplay or UI work inside a `features/<name>/` folder with an
   `index.js` that exports the public API.
2. Register the feature inside `core/boot.js` by calling its `initialize({ events,
   store })` method.
3. Keep DOM-specific operations inside `ui/` modules. Feature modules should expose
   pure functions where possible for easier testing.
4. When a file approaches 150 lines, identify secondary responsibilities (formatting,
   animation, state mapping) and extract them into helper modules.
5. Update `index.html` to load a single bundle entry point (e.g., `scripts/main.js`)
   that imports the necessary modules. Avoid linking multiple large scripts.

## Documentation Checklist

- Add a short summary to `docs/PROGRESSION.md` or a relevant design note when you
  introduce a new feature module.
- Include an ASCII dependency diagram at the top of each new `features/` folder to
  describe how it connects to `core` and `state`.
- If you remove or merge modules, update this guide so future contributors stay in
  sync.

By following this module system, the JavaScript codebase stays manageable, every file
remains approachable, and AI assistants can reason about individual subsystems without
wading through monolithic scripts.
