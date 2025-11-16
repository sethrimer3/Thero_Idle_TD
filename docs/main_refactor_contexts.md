# Main.js Refactor Contexts

This document captures the major logical groupings still embedded in `assets/main.js` that are good candidates for extraction into their own modules. Each proposed module currently exists as a stub file alongside the rest of the `assets/` scripts.

## Gameplay and Simulation Config Loaders
Responsible for fetching gameplay configuration files, handling embedded fallbacks, normalizing the fluid profile, and applying the aggregated configuration to bootstrap towers, levels, and achievements.

## Color-Scheme and Chromatic Styling Utilities
Owns tier-based hue calculations, palette definitions, color scheme cycling, and persistence of the player's selection.

## Tab/Overlay and Level-Preview UI Management
Coordinates tab caching, overlay visibility toggles, level preview wiring, and shared helpers for showing or hiding the various overlays. `assets/levelPreviewRenderer.js` now owns the level overlay preview rendering, including the procedural SVG fallback and developer battlefield reuse hooks that previously lived in `assets/main.js`. The quick battlefield menu (commence/retry/level select/dev tools/stats) has been extracted into `assets/playfieldMenu.js`, which centralizes DOM bindings, confirmation handling, and developer map tool activation.

### Level Overlay Controller
`assets/levelOverlayController.js` now binds the level-entry overlay DOM, confirmation affordances, and status text refreshes. The controller accepts callbacks that surface `getLevelSummary`, describe the last run, and manage exit warnings so `assets/main.js` only tracks pending levels and delegates show/hide responsibilities. It also supplies overlay state to the tab manager and routes preview renderer bindings, trimming another legacy block out of `assets/main.js`.

## Developer Controls and Sandbox Adjustments
`assets/developerControls.js` now owns the developer panel bindings, value formatters, mutation handlers, and visibility toggles
that expose sandbox controls. Remaining developer map tools still live in `assets/main.js` until the overlay/editor plumbing is
extracted.

## Aleph Chain Upgrade State Utilities
`assets/alephUpgradeState.js` now owns the Aleph chain upgrade state, exposing helpers to clone, mutate, reset, and rehydrate upgrades while keeping the playfield synchronized.

## Audio System
Manages the `AudioManager` wiring, slider bindings, audio persistence, activation gating, and contextual music selection for the game's tabs.

## Resource HUD and Powder-Economy State
`assets/resourceHud.js` now encapsulates the resource HUD bindings, status refresh loop, glyph badge tracking, and callback registry that keeps the powder displays in sync. `assets/main.js` only wires the factory with formatting utilities and state references.

## Resource and Spire State Containers
`assets/state/resourceState.js` builds the `baseResources`/`resourceState` pair via `createResourceStateContainers()`, injecting the starting thero calculation, fallback income rates, and `registerResourceContainers()` hook. The factory returns references that other modules can import for tests without touching `main.js`.

`assets/state/spireResourceState.js` exposes `createSpireResourceState()` which clones the Lamed/Tsadi/Shin/Kuf banks (including nested upgrade + stat objects) so saved state can hydrate without mutating shared templates. Main.js now imports the builder instead of declaring the literal inline, reducing another chunk of state setup.

## Spire Bank Management Helpers
`assets/spireResourceBanks.js` encapsulates the Lamed/Tsadi bank normalization logic and glyph currency reconciliation math. Main.js now requests a tiny helper surface for updating bank values rather than defining dozens of inline functions tied to the spire menu controller.

## Offline Overlay & Persistence Plumbing
Handles storage key constants, powder log bookkeeping, offline overlay animation state, and timer coordination for idle rewards.

## Powder Simulation Bridging
Acts as the bridge between the powder simulation and the rest of the game by managing mote drop queues, idle mote banking, powder save throttling, and integration points for the simulation instance.

## Playfield Gameplay Class
Isolates the `Playfield` class definition, its constructor wiring, UI bindings, input handling, geometry calculations, floater animation scaffolding, and tower placement logic.
