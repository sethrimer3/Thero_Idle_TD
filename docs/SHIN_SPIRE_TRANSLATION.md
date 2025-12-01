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
