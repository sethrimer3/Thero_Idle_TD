# Shin Spire – Translation System

## Overview

The **Shin Spire** is a "Translation" spire where players collect phonemes from defeated enemies and combine them to create increasingly powerful weapon modifiers. The system uses a custom script language with the following hierarchy:

1. **Phonemes** – Single characters/letters from the custom script
2. **Morphemes** – Two phonemes linked together to form pairs
3. **Words** – Two morphemes merged together
4. **Grammar** – Three-word sentences for maximum power

## Danmaku Render (Reverse Bullet Hell)

The **Shin Spire** features a unique "reverse danmaku" gameplay mode called the **Cardinal Warden Simulation**. Instead of controlling a small ship dodging bullets, you play as a powerful boss (the Cardinal Warden) fighting off waves of incoming enemy ships.

### The Cardinal Warden

The **Cardinal Warden** is your player character in this reverse bullet-hell game:

- **Visual Design:** A golden orb at the center surrounded by 8 rotating squares
- **Ring Squares:** Multiple large rotating squares create a layered, ring-like effect around the warden
- **Position:** Fixed near the bottom-center of the screen (approximately 75% down from the top)
- **Health System:** Has a health bar displayed at the bottom center, can be damaged by enemy collisions or when enemies pass through
- **Defense System:** Represented by 5 life lines at the bottom of the screen (each line represents 2 lives: solid → dashed → gone)
- **Script Label:** The warden's name is displayed in ThoughtSpeak script below its position

### Enemy Ships

Enemy ships spawn from the top of the screen and move downward in various patterns:

- **Basic Enemies:** Simple triangular ships that accelerate smoothly toward target points
- **Weaving Enemies:** Ships that follow sine wave patterns while moving downward
- **Ricochet Skimmers:** Diagonal-moving ships with thin trails that bounce off arena walls
- **Boss Ships:** Large, powerful enemies with unique geometries:
  - **Circle Carrier:** Large rotating circle that spawns smaller ships in a radial pattern
  - **Pyramid Boss:** Triangular ship that moves in sudden bursts
  - **Hexagon Fortress:** Massive hexagonal ship with regenerating health shield

### Enemy Trails

All enemy ships leave behind:
- **Inky Trails:** Semi-transparent path trails showing recent positions
- **Smoke Puffs:** Exhaust particles emitted from the ship's rear
- **Trail Physics:** By default, bullets bounce off enemy trails (strategic aiming mechanic)

### Three Weapon Slots

The Cardinal Warden has **three weapon slots**, each with **8 grapheme slots** for customization:

#### Weapon Slot 1 (Left)
- **Symbol:** `⟨`
- **Color:** Cyan (`#7ec8e3`)
- **Description:** "Left bracket weapon - fires toward aim target"
- **Base Stats:** 
  - Fire Rate: 500ms between shots
  - Bullet Speed: 250 px/s
  - Damage: 1.5

#### Weapon Slot 2 (Center)
- **Symbol:** `|`
- **Color:** Golden (`#d4af37`)
- **Description:** "Center line weapon - fires toward aim target"
- **Base Stats:**
  - Fire Rate: 450ms between shots
  - Bullet Speed: 280 px/s
  - Damage: 2.0

#### Weapon Slot 3 (Right)
- **Symbol:** `⟩`
- **Color:** Magenta (`#e377c2`)
- **Description:** "Right bracket weapon - fires toward aim target"
- **Base Stats:**
  - Fire Rate: 550ms between shots
  - Bullet Speed: 230 px/s
  - Damage: 1.8

#### Grapheme Slot System

Each weapon has **8 slots** (indexed 0-7) where graphemes can be placed:
- **Slot 0:** First slot - leftmost position
- **Slot 1-6:** Middle slots
- **Slot 7:** Last slot - rightmost position

Graphemes placed in different slots have different effects based on their slot position. The slot number directly influences the grapheme's behavior, creating a strategic positioning system where placement matters as much as selection.

### ThoughtSpeak Script (Script.png)

The grapheme system uses a custom script language rendered from a sprite sheet located at:
`/assets/sprites/spires/shinSpire/Script.png`

#### Script Layout

The sprite sheet contains **34 unique characters** arranged in a **7×5 grid**:

- **Rows 0-3 (Indices 0-25):** 26 Letters (A-Z) - These are **collectable graphemes** that drop from enemies and can be equipped to weapons
- **Rows 3-4 (Indices 26-33):** 8 Numbers (1-8) - **NOT collectable**, used for UI display only (weapon slot indicators)

#### Sprite Rendering

Each grapheme character is rendered by:
1. Looking up the character's index (0-34)
2. Calculating its grid position: `row = floor(index / 7)`, `col = index % 7`
3. Drawing the corresponding sprite from Script.png at the calculated grid position
4. Characters are spaced evenly and rendered in golden colors matching the game's aesthetic

#### Character Properties

Each collectable grapheme (indices 0-25) has:
- **Index:** Unique identifier (0-25)
- **Name:** English letter (A-Z)
- **Property:** Gameplay effect type (e.g., "fire", "pierce", "speed")
- **Row/Col:** Position in the sprite sheet grid
- **Collectable:** Boolean flag (always true for indices 0-25)

### Aiming System

Players control where the Cardinal Warden fires by:
- **Click/Tap:** Setting an aim target position on the screen
- **Aim Target Indicator:** A golden crosshair symbol shows where weapons will fire
- **Bullets:** Fire toward the aim target from each active weapon slot

### Visual Rendering

The danmaku render features a clean, minimalist aesthetic:
- **Background:** Pure white (day mode) or dark (`#0f1116` in night mode)
- **Bullets:** Golden glow with geometric shapes based on grapheme configuration
- **Enemy Colors:** Dark ships (basic) or white (night mode) with colored health bars
- **UI Elements:** Scholarly typography using "Cormorant Garamond" font
- **Mathematical Theme:** Greek letters, geometric patterns, and chalk-on-blackboard aesthetic

## Core Mechanics

### Phoneme Collection

- **Drop Source:** Enemies killed in the Cardinal Warden simulation drop phonemes (single script characters)
- **Collection Method:** Player must tap on dropped phonemes to collect them
- **Expiration:** Uncollected phonemes disappear when the Cardinal Warden dies and the gameplay loop restarts
- **Storage:** Collected phonemes are stored in the player's phoneme inventory

### Phoneme Inventory

The phoneme inventory is displayed in two locations:
1. Below the Cardinal Warden spire render
2. Below the weapons box

**Inventory Capacity:** The inventory can hold up to 26 unique grapheme types (A-Z), but players can collect multiple copies of each type.

**Excess Grapheme Bonus:** When a grapheme is equipped to a weapon, the weapon's base attack increases by the total number of that grapheme in the player's inventory. For example:
- Player has 15 of grapheme "A" in inventory
- Player equips "A" to Weapon 1
- Weapon 1's base attack increases by +15 damage

This bonus stacks with all other damage multipliers (level scaling, grapheme effects, etc.).

### Weapon Modification Slots

Players have weapon slots where they can build custom weapons using the translation system:

1. **Base Weapon Slot:** Assign a phoneme to create a basic weapon effect
2. **Modifier Slot:** Add a second phoneme to form a morpheme, modifying the base weapon (e.g., adding burning effect)
3. **Word Slots:** Merge morphemes into words for advanced effects (e.g., homing abilities)
4. **Grammar Slot:** Create three-word sentences for the most powerful combinations

### Effect Stacking

Each level of the translation hierarchy builds upon the previous:

| Level | Components | Example Effect |
|-------|-----------|----------------|
| Phoneme | 1 character | Basic weapon type (projectile, beam, etc.) |
| Morpheme | 2 phonemes | Elemental modifier (burn, freeze, shock) |
| Word | 2 morphemes | Behavior modifier (homing, piercing, bouncing) |
| Grammar | 3 words | Ultimate ability (area burst, chain reaction) |

## Script Characters

The custom script uses unique characters that each represent different weapon properties. Each character carries:

- **Visual glyph:** Distinct symbol for identification
- **Base property:** Primary weapon attribute
- **Modifier role:** How it affects other phonemes when combined

### Grapheme Mechanics (ThoughtSpeak System)

Each grapheme (script character) has unique effects based on its position in a weapon slot:

#### Index 0 - A (Fire)
- **Effect:** Modifies bullet shape and damage multiplier based on slot position
- **Slot 0:** Triangle (3 sides), 3× damage
- **Slot 1:** Pentagon (5 sides), 5× damage
- **Slot 2:** Hexagon (6 sides), 6× damage
- **Slot 3+:** Continues pattern (7, 8, 9, 10, 11 sides) with matching damage multipliers

#### Index 1 - B (Pierce)
- **Effect:** Increases weapon fire rate based on slot position
- **Slot 0:** 1× (no change)
- **Slot 1:** 2× faster
- **Slot 2:** 3× faster
- **Slot 3+:** Continues pattern (4×, 5×, 6×, etc.)

#### Index 2 - C (Speed)
- **Effect:** Spawns friendly ships that orbit the Cardinal Warden and attack enemies
- **Ship Count:** Inversely proportional to total weapon fire rate (5 / bullets per second)
- **Special Mechanic:** **Deactivates all graphemes to the RIGHT** of its position
  - Example: If placed in slot 3, only slots 0-3 are active; slots 4-7 become inactive
  - This allows strategic positioning for limiting unwanted effects

#### Index 3 - D (Ice)
- **Effect:** Regenerates player shields/life over time
- **Formula:** 1 shield recovered over `(slot_number × attack_speed)` seconds
- **Examples:**
  - Slot 1 with 3 bullets/sec = 1 shield over 6 seconds (slot number 2: 1/(2×3))
  - Slot 0 with 1 bullet/sec = 1 shield per second (slot number 1: 1/(1×1))
  - Slot 4 with 2 bullets/sec = 1 shield over 10 seconds (slot number 5: 1/(5×2))
- **Visual:** Reverses life line state progression at bottom of screen (gone → dashed → solid)
- **Note:** Affected by third grapheme deactivation if positioned to the right of it

#### Index 4 - E (Lightning)
- **Effect:** Modifies bullet trajectory based on slot position
- **Slots 0-2 (First Three Slots):**
  - Bullets shoot straight toward the aim target
  - No oscillation or deviation from the direct path
  - Simple, reliable targeting
- **Slots 3-4 (Middle Two Slots):**
  - Bullets move in a zigzag pattern toward random positions
  - Each waypoint: bullet travels straight, holds for 0.5 seconds, then changes direction
  - After 10 waypoint holds, if the bullet still persists, it targets the nearest enemy
  - Creates unpredictable attack patterns that can surprise enemies
- **Slots 5-7 (Last Three Slots):**
  - Bullets spiral outward from the weapon in an expanding pattern
  - Bullets only disappear when they reach the top edge of the render area
  - Creates a defensive spiral screen that can catch enemies at various distances
  - Pattern expands continuously, creating wider coverage over time

#### Index 5 - F (Spread/Pierce)
- **Effect:** Grants piercing ability and trail passthrough based on slot position
- **Pierce Count:**
  - Slot 0: +1 pierce (hits 1 enemy before disappearing)
  - Slot 1: +2 pierce (hits 2 enemies before disappearing)
  - Slot 2: +3 pierce (hits 3 enemies before disappearing)
  - Slot 3-7: Continues pattern (+4, +5, +6, +7, +8 pierce)
- **Special Mechanic: Trail Passthrough**
  - When this grapheme is equipped, bullets **pass through enemy trails** without bouncing off them
  - Normally, bullets bounce off enemy trails to reward strategic aiming
  - With F equipped, bullets ignore trails completely and maintain their trajectory
  - Useful for guaranteed hits through dense enemy formations
- **Strategic Use:**
  - Higher slot positions allow bullets to pierce through multiple enemies
  - Trail passthrough enables direct damage to enemies behind trails
  - Combines well with high damage graphemes for maximum multi-target efficiency

## Implementation Notes

### Drop Mechanics
- Phoneme drops spawn at the defeated enemy's position
- Drops have a visual indicator showing the script character
- Drops persist on screen until:
  - Player taps to collect them
  - Cardinal Warden dies (all uncollected drops removed)

### UI Elements
- Phoneme inventory counter in the resource card
- Phoneme collection grid under the spire render
- Weapon crafting interface in the weapons box

### Persistence
- Collected phonemes are saved to player state
- Weapon configurations persist across sessions
- High scores and wave progress affect phoneme drop rates

## Future Expansions

- Additional phoneme types as players progress
- Rare phoneme variants with enhanced properties
- Phoneme trading or conversion systems
- Advanced grammar patterns for specialized builds
