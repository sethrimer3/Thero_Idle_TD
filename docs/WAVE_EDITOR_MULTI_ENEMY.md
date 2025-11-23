# Wave Editor: Multiple Enemy Types Per Wave

## Overview

The wave editor **fully supports multiple enemy types in a single wave**. This feature allows level designers to create more complex and interesting wave compositions.

## Wave String Format

Waves use a compact string format where multiple enemy groups are separated by `+`:

```
[WaveNumber]:[Count1][Type1][HP1]+[Count2][Type2][HP2]/[Interval]/[Delay]/[BossHP]
```

### Example
```
1:10A1e2+5B2e2/1.5
```

This creates Wave 1 with:
- 10 enemies of type A with 100 HP (1e2)
- 5 enemies of type B with 200 HP (2e2)
- Spawn interval of 1.5 seconds

### Complete Example
```json
{
  "waves": "1:8A1.0e2/1.5|2:6B1.5e3+4A1.0e3/1.4|3:8C2.0e4+4B1.5e4/1.3"
}
```

This creates 3 waves:
- **Wave 1**: 8 type A enemies
- **Wave 2**: 6 type B enemies + 4 type A enemies (mixed!)
- **Wave 3**: 8 type C enemies + 4 type B enemies (mixed!)

## Using the Wave Editor UI

### Adding Multiple Enemy Types

1. **Enable Developer Mode** in Options
2. **Enter a level** and access the developer map tools
3. **Click "Add Wave"** to create a new wave
4. **Configure the first enemy type** (count, type, HP)
5. **Click "Add Enemy"** button to add another enemy type to the same wave
6. **Configure additional enemy types** as needed
7. **Click "Export Compact Wave String"** to get the encoded format

### UI Elements

- **Primary enemy row**: The main enemy configuration for each wave
- **"Add Enemy" button**: Adds an additional enemy type to the current wave
- **Additional enemy rows**: Shown below the primary row, with individual controls for count, type, HP
- **Delete button (×)**: Removes an additional enemy type from the wave

## Enemy Type Reference

| Letter | ID | Label | Speed | Color |
|--------|----------|------|-------|-------|
| A | etype | Epsilon Type | 50 | #4a90e2 |
| B | divisor | Divisor | 45 | #e24a4a |
| C | prime | Prime | 55 | #50c878 |
| D | reversal | Reversal | 40 | #9b59b6 |
| E | tunneler | Tunneler | 60 | #f39c12 |
| F | aleph-swarm | Aleph Swarm | 65 | #e91e63 |
| G | partial-wraith | Partial Wraith | 48 | #34495e |
| H | gradient-sapper | Gradient Sapper | 52 | #16a085 |
| I | weierstrass-prism | Weierstrass Prism | 42 | #8e44ad |
| J | planck-shade | Planck Shade | 70 | #2c3e50 |
| K | null-husk | Null Husk | 38 | #95a5a6 |
| L | imaginary-strider | Imaginary Strider | 75 | #3498db |
| M | combination-cohort | Combination Cohort | 44 | #e67e22 |
| N | polygon-splitter | Polygonal Splitter | 58 | #00bfa5 |
| O | derivative-shield | Derivative Shield | 46 | #7f8c8d |

## Design Considerations

### When to Use Multiple Enemy Types

- **Progressive Difficulty**: Mix fast and slow enemies to challenge tower placement
- **Counter Diversity**: Force players to use multiple tower types
- **Visual Interest**: Create more dynamic and varied waves
- **Strategic Depth**: Combine enemies with complementary abilities

### Balance Tips

- Adjust HP values so that total wave difficulty is appropriate
- Consider spawn intervals when mixing enemy speeds
- Test with different tower combinations to ensure viability
- Use the developer map to quickly iterate on wave compositions

## Technical Details

### Encoding/Decoding

- Implemented in `assets/waveEncoder.js`
- `encodeWavesToCompact()` - Converts verbose wave arrays to compact strings
- `parseCompactWaveString()` - Parses compact strings into wave objects
- Round-trip encoding/decoding is fully supported

### Wave Editor UI

- Implemented in `assets/waveEditorUI.js`
- `addWaveEditorRow()` - Creates wave editor rows with support for multiple groups
- `handleAddEnemyGroup()` - Adds additional enemy types to waves
- `createAdditionalGroupRow()` - Creates UI for additional enemy groups

## Example: Level with Mixed Waves

See `assets/data/levels/level-01-epsilon-loop.json` for an example of a level using multiple enemy types per wave.

## Troubleshooting

**Q: The "Add Enemy" button isn't visible**
A: Make sure you're in the wave editor section after enabling developer mode and entering a level with developer map tools active.

**Q: Can I have more than 2 enemy types in one wave?**
A: Yes! You can add as many enemy types as needed. Just keep clicking "Add Enemy".

**Q: Do all enemy types in a wave need the same HP?**
A: No, each enemy type can have its own HP value, allowing for mixed difficulty within a single wave.

**Q: Can I mix enemy types with a boss?**
A: Yes! Enable the boss checkbox and configure the boss HP separately. The boss spawns at the end of the wave.
