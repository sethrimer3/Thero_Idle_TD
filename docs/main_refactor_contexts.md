# Main.js Refactor Contexts

This document captures the major logical groupings still embedded in `assets/main.js` that are good candidates for extraction into their own modules. Each proposed module currently exists as a stub file alongside the rest of the `assets/` scripts.

## Gameplay and Simulation Config Loaders
Responsible for fetching gameplay configuration files, handling embedded fallbacks, normalizing the fluid profile, and applying the aggregated configuration to bootstrap towers, levels, and achievements.

## Color-Scheme and Chromatic Styling Utilities
Owns tier-based hue calculations, palette definitions, color scheme cycling, and persistence of the player's selection.

## Tab/Overlay and Level-Preview UI Management
Coordinates tab caching, overlay visibility toggles, level preview wiring, and shared helpers for showing or hiding the various overlays.

## Developer Controls and Sandbox Adjustments
Bundles the developer panel bindings, value formatters, mutation handlers, and visibility toggles that expose sandbox controls.

## Aleph Chain Upgrade State Utilities
Provides upgrade state mutations, formatting helpers, and integration hooks that synchronize Aleph chain upgrades with the playfield.

## Audio System
Manages the `AudioManager` wiring, slider bindings, audio persistence, activation gating, and contextual music selection for the game's tabs.

## Resource HUD and Powder-Economy State
Maintains base resource snapshots, powder configuration/state, UI element caches, and glyph-wall math/visual synchronization routines.

## Offline Overlay & Persistence Plumbing
Handles storage key constants, powder log bookkeeping, offline overlay animation state, and timer coordination for idle rewards.

## Powder Simulation Bridging
Acts as the bridge between the powder simulation and the rest of the game by managing mote drop queues, idle mote banking, powder save throttling, and integration points for the simulation instance.

## Playfield Gameplay Class
Isolates the `Playfield` class definition, its constructor wiring, UI bindings, input handling, geometry calculations, floater animation scaffolding, and tower placement logic.
