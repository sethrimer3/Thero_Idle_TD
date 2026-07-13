# Enemy Reference

Every enemy type now tracks a boss counterpart that behaves differently in a way that makes the encounter significantly harder. Bosses inherit their base archetype but modify speed, health, or mitigation rules to push defenses harder than standard waves.

## Polygonal Splitter (Polygon-Splitter)

- **Symbol:** Polygon glyph that reflects its current side count (⬢ hexagon → ⬟ pentagon → ⬦ diamond → △ triangle → ― line → · dot).
- **Behavior:** On defeat the splitter fractures into two children with one fewer side than the parent, encouraging wide coverage to finish the entire chain.
- **Scaling:**
  - Standard shards spawn with 10% of the parent tier’s health and 110% of its speed.
  - Boss shards instead spawn with 50% of the parent tier’s health and 50% of its speed, preserving pressure while slowing the rush.

## Derivative Shield (Derivative-Shield)

- **Symbol:** ∂ (partial derivative) crest that marks both the projector and affected allies via a shield status icon.
- **Behavior:** Allies (and the projector) inside the aegis gain a cumulative shield; each hit taken while shielded is halved again, compounding mitigation until the effect falls off.
- **Boss Effect:** Boss projectors transform incoming strikes by taking the square root of the damage instead of stacking half multipliers, heavily blunting burst volleys.
- **Counterplay:** Break the projector quickly or focus unshielded targets; time burst damage between shield refresh ticks before the derivative compounds too far.
