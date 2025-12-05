# Shin Spire – Translation System

## Overview

The **Shin Spire** is a "Translation" spire where players collect phonemes from defeated enemies and combine them to create increasingly powerful weapon modifiers. The system uses a custom script language with the following hierarchy:

1. **Phonemes** – Single characters/letters from the custom script
2. **Morphemes** – Two phonemes linked together to form pairs
3. **Words** – Two morphemes merged together
4. **Grammar** – Three-word sentences for maximum power

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

#### Index 0 - Alpha (Fire)
- **Effect:** Modifies bullet shape and damage multiplier based on slot position
- **Slot 0:** Triangle (3 sides), 3× damage
- **Slot 1:** Pentagon (5 sides), 5× damage
- **Slot 2:** Hexagon (6 sides), 6× damage
- **Slot 3+:** Continues pattern (7, 8, 9, 10, 11 sides) with matching damage multipliers

#### Index 1 - Beta (Pierce)
- **Effect:** Increases weapon fire rate based on slot position
- **Slot 0:** 1× (no change)
- **Slot 1:** 2× faster
- **Slot 2:** 3× faster
- **Slot 3+:** Continues pattern (4×, 5×, 6×, etc.)

#### Index 2 - Gamma (Speed)
- **Effect:** Spawns friendly ships that orbit the Cardinal Warden and attack enemies
- **Ship Count:** Inversely proportional to total weapon fire rate (5 / bullets per second)
- **Special Mechanic:** **Deactivates all graphemes to the RIGHT** of its position
  - Example: If placed in slot 3, only slots 0-3 are active; slots 4-7 become inactive
  - This allows strategic positioning for limiting unwanted effects

#### Index 3 - Delta (Ice)
- **Effect:** Regenerates player shields/life over time
- **Formula:** 1 shield recovered over `(slot_number × attack_speed)` seconds
- **Examples:**
  - Slot 2 with 3 bullets/sec = 1 shield over 6 seconds (1/(2×3))
  - Slot 0 with 1 bullet/sec = 1 shield per second (1/(1×1))
  - Slot 4 with 2 bullets/sec = 1 shield over 10 seconds (1/(5×2))
- **Visual:** Reverses life line state progression at bottom of screen (gone → dashed → solid)
- **Note:** Affected by third grapheme deactivation if positioned to the right of it

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
