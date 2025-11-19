# Bet Spire Sprite Guide

This guide summarizes the layered Bet Spire sprite set inside `assets/sprites/spires/betSpire/` and how each asset should be interpreted by the rendering and gameplay systems.

## Sprite Layers and Intent
- **Cave Background (`Cave-Background.svg`)** – Rendered furthest back. Treated as distant scenery with no collision while staying crisp at any zoom.
- **Terrain (`Terrain.svg`)** – Primary, fully solid collision surface. Almost all entities collide with terrain and cannot pass through it.
- **Floating Island (`Floating-Island.png`)** – Additional solid terrain suspended above the main ground. Behaves like terrain for collision and placement.
- **Caves (`Cave-1.png` … `Cave-5.png`)** – Solid-color masks that mark cave interiors. Use these masks to anchor spawn zones or scripted events for each cave pocket.
- **Tunnels (`Tunnels.png`)** – Solid-color mask indicating tunnel passages and navigation hints.
- **Placement Blocks (mask accents)** – Small blocks of flat color embedded in the masks that mark where interactive elements (spawns, props, collectibles) should align.

## Fluids and Environmental FX
- **Water (`Water.png`)** – Solid-color mask that marks where water belongs. Render the water at ~50% opacity with simple fluid physics and a subtle surface ripple.
- **Magma (`Magma.png`)** – Animated red/dark-red flow that sits at the bottom of the scene and casts a red glow onto the terrain above it.

## Rendering Order
Use this baseline stack (back to front) when composing the Bet Spire vista:
1. Cave background
2. Magma glow (when present)
3. Water mask and ripples
4. Floating island
5. Main terrain
6. Creatures/effects and UI overlays

## Spawn Anchors
- Cave masks define usable interior bounds. For example, the Delta slimes currently spawn inside the Cave 4 and Cave 5 masks:
  - **Cave 4 mask window:** `x=225–465`, `y=1076–1274` in the 1024×1536 sprite space (≈21.97–45.4% X, 70.05–82.94% Y).
  - **Cave 5 mask window:** `x=540–850`, `y=1064–1269` in the same space (≈52.73–83.01% X, 69.27–82.55% Y).
  - Normalize coordinates against the rendered terrain bounds so spawn areas remain correct as the viewport scales.

## Collision Strategy for Interactive Elements
- **Avoid per-frame SVG hit tests.** The main terrain art lives in `Terrain.svg` (3000×4000 viewBox) and contains hundreds of vector paths; walking those paths for collision every frame would be CPU-heavy on mobile GPUs.【F:assets/sprites/spires/betSpire/Terrain.svg†L1-L40】【71b8df†L1-L2】
- **Use the baked collision mask.** The terrarium already preloads `terrain-collision.png` alongside the SVG; sample that raster silhouette for ground checks, decal placement, and pathfinding to keep lookups O(1) per pixel rather than O(number of SVG paths).【F:index.html†L1790-L1807】
- **Map decorative reactions to the mask.** When attaching grass sways, fractal tree roots, Delta slime ground checks, or growing crystal anchors, derive their world positions from the collision mask (or a downscaled version) and cache the results so the simulation never queries SVG geometry directly.
- **Keep updates batched.** If those elements need to react to terrain (e.g., slime bounce or crystal growth), batch collision samples per tick (or per chunk) and reuse results for multiple entities to avoid redundant reads.

## Migration Notes
- Legacy Bet landscape sprites (`bet_landscape.png`, `bet_landscape_background.png`) and the layered gradient “water” overlay have been removed from the terrarium. Use the new Terrain/Floating-Island/Cave-Background art stack instead.
