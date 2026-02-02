# Foundry Production Menu - Visual Design

## Menu Layout

```
┌─────────────────────────────────────────────┐
│         Foundry Production Menu             │
│                                             │
│            Foundry II                       │
│                                             │
│         Sun: 1250                           │
│                                             │
│                                             │
│          ┌──────────────┐                   │
│          │  Upgrade to  │                   │
│          │    III       │  ← Top Button    │
│          │  (1000 sun)  │                   │
│          └──────────────┘                   │
│                                             │
│ ┌──────────────┐  ┌─────┐  ┌──────────────┐│
│ │ Structures   │  │ ⚒️  │  │  Starlings   ││
│ │     II       │  │     │  │     II       ││
│ │  (800 sun)   │  │     │  │  (800 sun)   ││
│ └──────────────┘  └─────┘  └──────────────┘│
│  ← Left Button   Center      Right Button →│
│                                             │
│          ┌──────────────┐                   │
│          │Solar Mirror  │  ← Bottom Button │
│          │  (300 sun)   │                   │
│          └──────────────┘                   │
│                                             │
│          ┌──────────────┐                   │
│          │    Close     │                   │
│          └──────────────┘                   │
└─────────────────────────────────────────────┘
```

## Button States

### Enabled Button (Cyan gradient)
```
┌──────────────┐
│ Structures I │  ← Bright, hoverable
│  (200 sun)   │  ← Shows cost
└──────────────┘
```

### Disabled Button (Insufficient funds)
```
┌──────────────┐
│ Structures I │  ← Faded (40% opacity)
│  (200 sun)   │  ← Not clickable
└──────────────┘
```

### Disabled Button (Max level reached)
```
┌──────────────┐
│ Structures   │  ← Shows current level
│     III      │  ← No cost shown
└──────────────┘
```

### Disabled Button (Requires foundry upgrade)
```
┌──────────────┐
│ Structures   │  ← Faded (40% opacity)
│      0       │  ← Shows tier 0
└──────────────┘
     ↓
Tooltip: "Requires Foundry II"
```

## Color Scheme

- **Background**: Dark gray (`var(--bg-alt)`) with blur
- **Overlay**: Black with 75% opacity
- **Top Button**: Cyan gradient (`rgba(139, 247, 255, 0.1)`)
- **Left/Right Buttons**: Pink gradient (`rgba(255, 125, 235, 0.1)`)
- **Bottom Button**: Yellow gradient (`rgba(255, 228, 120, 0.1)`)
- **Center Icon**: Yellow gradient with orange border
- **Text**: White (`var(--text)`)
- **Muted Text**: Gray (`var(--muted)`)

## Foundry Icon in Terrarium

```
┌────────────────────────────────────┐
│  Terrarium View                    │
│                                    │
│          ⚒️  ← Clickable foundry   │
│         /  \                       │
│        /    \                      │
│  ~~~~~~~~~~~~~~~~~~~~~  ← Ground   │
│                                    │
└────────────────────────────────────┘
```

**Properties:**
- Size: 48px × 48px
- Background: Orange glow with transparency
- Border: Orange (`rgba(255, 140, 0, 0.6)`)
- Hover: Scales to 1.1x, brighter glow
- Position: Absolute, placed at normalized coordinates

## Upgrade Progression Visual

```
Foundry Level I
├─ Structures Tier 0 → Can upgrade to Tier 1 (200 sun)
├─ Starlings Tier 0 → Can upgrade to Tier 1 (200 sun)
└─ Foundry Upgrade → Level II (500 sun)

Foundry Level II
├─ Structures Tier 1 → Can upgrade to Tier 2 (400 sun)
├─ Starlings Tier 1 → Can upgrade to Tier 2 (400 sun)
└─ Foundry Upgrade → Level III (1000 sun)

Foundry Level III (MAX)
├─ Structures Tier 2 → Can upgrade to Tier 3 (800 sun)
└─ Starlings Tier 2 → Can upgrade to Tier 3 (800 sun)
```

## Roman Numeral Display

| Level | Display |
|-------|---------|
| 0     | —       |
| 1     | I       |
| 2     | II      |
| 3     | III     |

## Responsive Design

### Desktop (> 768px)
- Buttons: 120px × 120px
- Grid gap: 12px
- Font size: 14px

### Mobile (≤ 768px)
- Buttons: 100px × 100px
- Grid gap: 8px
- Font size: 12px
- Foundry icon: 40px × 40px

## Animation & Interactions

1. **Menu Open**: Fade in with scale from 0.9 to 1.0 (180ms)
2. **Button Hover**: Scale to 1.05x, brighten background
3. **Button Click**: Scale to 0.95x, then spring back
4. **Upgrade Success**: Brief flash, update text smoothly
5. **Close**: Fade out with scale to 0.9 (180ms)

## Accessibility

- Menu has `role="dialog"` and `aria-modal="true"`
- All buttons have clear labels
- Close button can be triggered with Escape key
- Sun balance is read by screen readers
- Disabled buttons have tooltip explaining why
