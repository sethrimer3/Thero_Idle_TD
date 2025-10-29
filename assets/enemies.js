// Shared enemy utilities and mote gem state management for Thero Idle.
// Enemy defeats now have a chance to mint crystalline mote gems, each with its own
// rarity tier, palette, and mote payload. This module centralizes the rarity rolls
// so the playfield can focus on orchestration while keeping the powder bridge
// informed about how many motes to dispense when the crystals are collected.

// Encode the diamond sprite as an inline data URI so automated PR tooling can process
// the artwork without bundling a separate binary file.
const DIAMOND_SPRITE_DATA_URI = 'data:image/png;base64,' +
  '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';

// Track mote gem drops, inventory totals, and the upgrade-driven auto collector.
export const moteGemState = {
  active: [],
  nextId: 1,
  inventory: new Map(),
  autoCollectUnlocked: false,
};

// Gem definitions ordered from most common to rarest. Each entry includes the
// base drop probability, mote size multiplier, display palette, and sprite path
// so every system can render the bespoke crystal artwork consistently.
export const GEM_DEFINITIONS = [
  {
    id: 'quartz',
    name: 'Quartz',
    dropChance: 0.1,
    moteSize: 2,
    color: { hue: 18, saturation: 16, lightness: 86 },
    sprite: './sprites/quartz.png', // Provide the quartz sprite so UI elements can mirror the drop art.
  },
  {
    id: 'ruby',
    name: 'Ruby',
    dropChance: 0.01,
    moteSize: 3,
    color: { hue: 350, saturation: 74, lightness: 48 },
    sprite: './sprites/ruby.png', // Supply the ruby sprite for crafting menus and battlefield drops.
  },
  {
    id: 'sunstone',
    name: 'Sunstone',
    dropChance: 0.001,
    moteSize: 4,
    color: { hue: 28, saturation: 78, lightness: 56 },
    sprite: './sprites/sunstone.png', // Reference the sunstone sprite so rarer drops look unique.
  },
  {
    id: 'citrine',
    name: 'Citrine',
    dropChance: 0.0001,
    moteSize: 5,
    color: { hue: 48, saturation: 78, lightness: 60 },
    sprite: './sprites/citrine.png', // Link the citrine sprite to keep inventory icons consistent.
  },
  {
    id: 'emerald',
    name: 'Emerald',
    dropChance: 0.00001,
    moteSize: 6,
    color: { hue: 140, saturation: 64, lightness: 44 },
    sprite: './sprites/emerald.png', // Attach the emerald sprite to highlight its deep green facets.
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    dropChance: 0.000001,
    moteSize: 7,
    color: { hue: 210, saturation: 72, lightness: 52 },
    sprite: './sprites/sapphire.png', // Provide the sapphire sprite for powder logs and loot icons.
  },
  {
    id: 'iolite',
    name: 'Iolite',
    dropChance: 0.0000001,
    moteSize: 8,
    color: { hue: 255, saturation: 52, lightness: 50 },
    sprite: './sprites/iolite.png', // Include the iolite sprite so late-game drops showcase their hue.
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    dropChance: 0.00000001,
    moteSize: 9,
    color: { hue: 280, saturation: 60, lightness: 55 },
    sprite: './sprites/amethyst.png', // Point to the amethyst sprite for the violet-tier presentation.
  },
  {
    id: 'diamond',
    name: 'Diamond',
    dropChance: 0.000000001,
    moteSize: 10,
    color: { hue: 200, saturation: 12, lightness: 92 },
    sprite: DIAMOND_SPRITE_DATA_URI, // Attach the inline diamond sprite so the prismatic tier gleams across the UI.
  },
  {
    id: 'nullstone',
    name: 'Nullstone',
    dropChance: 0.0000000001,
    moteSize: 11,
    color: { hue: 210, saturation: 10, lightness: 14 },
    sprite: './sprites/nullstone.png', // Assign the nullstone sprite so the rarest drop is unmistakable.
  },
];

const GEM_LOOKUP = new Map(GEM_DEFINITIONS.map((gem) => [gem.id, gem]));

// Cache gem sprite elements so repeated lookups reuse the same browser image resource.
const gemSpriteCache = new Map();

// Static rarity multipliers arranged by archetype difficulty. Higher values
// make crystal drops more common for late-game threats while still allowing the
// most coveted stones to remain appropriately rare.
const ENEMY_GEM_MULTIPLIERS = new Map([
  ['etype', 1],
  ['divisor', 2],
  ['prime', 2.5],
  ['reversal', 3],
  ['tunneler', 3.4],
  ['aleph-swarm', 3.8],
  ['partial-wraith', 4.1],
  ['gradient-sapper', 4.4],
  ['weierstrass-prism', 4.7],
  ['planck-shade', 5],
  ['null-husk', 5.2],
  ['imaginary-strider', 5.4],
  ['combination-cohort', 5.6],
]);

// Radius used when sweeping the battlefield for mote gem pickups.
export const MOTE_GEM_COLLECTION_RADIUS = 48;

let queueMoteDropHandler = null;
let recordPowderEventHandler = null;

// Allow the host application to inject powder logging and queue handlers without creating circular dependencies.
export function configureEnemyHandlers({ queueMoteDrop, recordPowderEvent } = {}) {
  queueMoteDropHandler = typeof queueMoteDrop === 'function' ? queueMoteDrop : null;
  recordPowderEventHandler = typeof recordPowderEvent === 'function' ? recordPowderEvent : null;
}

// Clear any mote gem drops lingering from previous battles.
export function resetActiveMoteGems() {
  moteGemState.active.length = 0;
}

// Resolve the rarity multiplier for an enemy based on explicit overrides or codex id.
export function resolveEnemyGemDropMultiplier(source = {}) {
  if (Number.isFinite(source.gemDropMultiplier)) {
    return Math.max(0, source.gemDropMultiplier);
  }
  if (Number.isFinite(source.rarityMultiplier)) {
    return Math.max(0, source.rarityMultiplier);
  }
  const key = String(source.typeId || source.codexId || source.id || '').toLowerCase();
  if (ENEMY_GEM_MULTIPLIERS.has(key)) {
    return ENEMY_GEM_MULTIPLIERS.get(key);
  }
  const hp = Number.isFinite(source.hp) ? Math.max(1, source.hp) : null;
  if (hp) {
    const inferred = 1 + Math.log10(hp) * 0.12;
    return Math.max(1, inferred);
  }
  return 1;
}

// Roll against the gem hierarchy to determine which crystal, if any, drops.
export function rollGemDropDefinition(enemy = {}, rng = Math.random) {
  const multiplier = resolveEnemyGemDropMultiplier(enemy);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return null;
  }
  const random = typeof rng === 'function' ? rng : Math.random;
  for (let index = GEM_DEFINITIONS.length - 1; index >= 0; index -= 1) {
    const gem = GEM_DEFINITIONS[index];
    const chance = Math.min(0.999, gem.dropChance * multiplier);
    if (chance > 0 && random() < chance) {
      return gem;
    }
  }
  return null;
}

// Resolve the gem definition from the collection for UI lookups.
export function resolveGemDefinition(typeKey) {
  const key = String(typeKey || '').toLowerCase();
  return GEM_LOOKUP.get(key) || null;
}

// Resolve the sprite source path for a gem so UI consumers can render the new artwork.
export function getMoteGemSpriteSource(typeKey) {
  const gem = resolveGemDefinition(typeKey);
  return gem?.sprite || null;
}

// Load and cache the gem sprite image so the playfield can draw textured drops efficiently.
export function getMoteGemSpriteAsset(typeKey) {
  const key = String(typeKey || '').toLowerCase();
  if (gemSpriteCache.has(key)) {
    return gemSpriteCache.get(key);
  }

  const source = getMoteGemSpriteSource(key);
  if (!source || typeof Image === 'undefined') {
    gemSpriteCache.set(key, null);
    return null;
  }

  const image = new Image();
  // Hint the browser to decode the sprite off the main thread when possible.
  if ('decoding' in image) {
    image.decoding = 'async';
  }
  // Request eager loading so rare drops have their art ready before rendering.
  if ('loading' in image) {
    image.loading = 'eager';
  }
  image.src = source;

  const record = {
    image,
    loaded: image.complete,
    errored: false,
  };

  // Track load completion so draw routines can fall back until the sprite is ready.
  image.addEventListener('load', () => {
    record.loaded = true;
  });

  // Flag load failures so consumers can keep using the procedural fallback square.
  image.addEventListener('error', () => {
    record.errored = true;
  });

  gemSpriteCache.set(key, record);
  return record;
}

// Derive a deterministic accent color for a mote gem category.
export function getMoteGemColor(typeKey) {
  const gem = resolveGemDefinition(typeKey);
  if (!gem) {
    return { hue: 48, saturation: 68, lightness: 56 };
  }
  return { ...gem.color };
}

// Spawn a mote gem drop at the supplied battlefield position.
export function spawnMoteGemDrop(enemy, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null;
  }
  const gemDefinition = rollGemDropDefinition(enemy);
  if (!gemDefinition) {
    return null;
  }
  const moteSize = Math.max(1, Math.round(gemDefinition.moteSize || 1));
  const launchDirection = Math.random() < 0.5 ? -1 : 1; // Alternate launch sides so the squares drift away from the lane symmetrically.
  const launchSpeed = 0.12 + Math.random() * 0.08; // Slightly vary the launch impulse so the animation feels organic.
  const gem = {
    id: moteGemState.nextId,
    x: position.x,
    y: position.y,
    value: moteSize,
    typeKey: gemDefinition.id,
    typeLabel: gemDefinition.name,
    pulse: Math.random() * Math.PI * 2,
    color: { ...gemDefinition.color },
    vx: launchDirection * launchSpeed,
    vy: -launchSpeed * (1.2 + Math.random() * 0.6),
    gravity: 0.00045 + Math.random() * 0.0002,
    lifetime: 0,
    opacity: 1,
    moteSize,
  };
  moteGemState.nextId += 1;
  moteGemState.active.push(gem);
  return gem;
}

// Transfer a mote gem into the player's reserves and remove it from the field.
export function collectMoteGemDrop(gem, context = {}) {
  if (!gem) {
    return false;
  }
  const index = moteGemState.active.findIndex((candidate) => candidate && candidate.id === gem.id);
  if (index === -1) {
    return false;
  }
  moteGemState.active.splice(index, 1);

  const record =
    moteGemState.inventory.get(gem.typeKey) ||
    { label: gem.typeLabel, total: 0, count: 0 };
  record.total += gem.value;
  record.count = (record.count || 0) + 1;
  record.label = gem.typeLabel || record.label;
  moteGemState.inventory.set(gem.typeKey, record);

  if (queueMoteDropHandler) {
    queueMoteDropHandler({
      size: gem.value,
      color: gem.color ? { ...gem.color } : null,
    });
  }
  if (recordPowderEventHandler) {
    recordPowderEventHandler('mote-gem-collected', {
      type: gem.typeLabel,
      value: gem.value,
      reason: context.reason || 'manual',
    });
  }
  return true;
}

// Collect any mote gems within a radius of the provided battlefield point.
export function collectMoteGemsWithinRadius(center, radius, context = {}) {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    return 0;
  }
  const effectiveRadius = Number.isFinite(radius) ? Math.max(1, radius) : MOTE_GEM_COLLECTION_RADIUS;
  const radiusSquared = effectiveRadius * effectiveRadius;
  const harvested = moteGemState.active.filter((gem) => {
    const dx = gem.x - center.x;
    const dy = gem.y - center.y;
    return dx * dx + dy * dy <= radiusSquared;
  });
  harvested.forEach((gem) => collectMoteGemDrop(gem, context));
  return harvested.length;
}

// Automatically collect every mote gem currently active on the field.
export function autoCollectActiveMoteGems(reason = 'auto') {
  const pending = [...moteGemState.active];
  pending.forEach((gem) => {
    collectMoteGemDrop(gem, { reason });
  });
  return pending.length;
}

// Update the auto-collect upgrade flag so glyph completions can sweep gems.
export function setMoteGemAutoCollectUnlocked(unlocked) {
  moteGemState.autoCollectUnlocked = Boolean(unlocked);
}
