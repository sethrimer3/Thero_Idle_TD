// Shared enemy utilities and mote gem state management for Thero Idle.
// Enemy defeats mint mote gems—a special, color-coded currency distinct from idle motes—while this module centralizes drop handling so the main game loop can remain focused on orchestration.

// Track mote gem drops, inventory totals, and the upgrade-driven auto collector.
export const moteGemState = {
  active: [],
  nextId: 1,
  inventory: new Map(),
  autoCollectUnlocked: false,
};

// Curated gem profiles used to rename mote drops and provide thematically aligned colors.
const GEM_PROFILES = [
  { name: 'Sapphire', color: { hue: 210, saturation: 72, lightness: 52 } },
  { name: 'Ruby', color: { hue: 350, saturation: 70, lightness: 48 } },
  { name: 'Emerald', color: { hue: 145, saturation: 60, lightness: 46 } },
  { name: 'Topaz', color: { hue: 35, saturation: 72, lightness: 55 } },
  { name: 'Amethyst', color: { hue: 275, saturation: 58, lightness: 58 } },
  { name: 'Aquamarine', color: { hue: 185, saturation: 54, lightness: 60 } },
  { name: 'Garnet', color: { hue: 5, saturation: 68, lightness: 42 } },
  { name: 'Peridot', color: { hue: 95, saturation: 64, lightness: 52 } },
  { name: 'Citrine', color: { hue: 48, saturation: 70, lightness: 62 } },
  { name: 'Obsidian', color: { hue: 210, saturation: 16, lightness: 18 } },
  { name: 'Pearl', color: { hue: 40, saturation: 20, lightness: 86 } },
  { name: 'Opal', color: { hue: 300, saturation: 36, lightness: 68 } },
  { name: 'Rose Quartz', color: { hue: 340, saturation: 38, lightness: 72 } },
  { name: 'Tanzanite', color: { hue: 250, saturation: 56, lightness: 50 } },
  { name: 'Amber', color: { hue: 30, saturation: 74, lightness: 50 } },
  { name: 'Jade', color: { hue: 120, saturation: 48, lightness: 50 } },
];

// Cache assigned gem profiles so each enemy type keeps a stable name and tint.
const assignedGemProfiles = new Map();

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

// Resolve a stable type key and label for categorizing mote gem drops.
export function resolveMoteGemType(enemy = {}) {
  const rawKey = enemy.typeId || enemy.codexId || enemy.id || enemy.symbol || 'glyph';
  const normalizedKey = String(rawKey).trim().toLowerCase() || 'glyph';
  const label = enemy.label || enemy.name || enemy.symbol || 'Glyph';
  return { key: normalizedKey, label };
}

// Resolve the gem profile assigned to a mote category, ensuring deterministic reuse.
export function resolveMoteGemProfile(typeKey) {
  const key = String(typeKey || 'glyph');
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) & 0xffffffff;
  }
  if (!assignedGemProfiles.has(key)) {
    const profile = GEM_PROFILES[Math.abs(hash) % GEM_PROFILES.length] || GEM_PROFILES[0];
    assignedGemProfiles.set(key, {
      name: profile.name,
      color: { ...profile.color },
    });
  }
  return assignedGemProfiles.get(key);
}

// Derive a deterministic accent color for a mote gem category.
export function getMoteGemColor(typeKey) {
  const profile = resolveMoteGemProfile(typeKey);
  return { ...profile.color };
}

// Spawn a mote gem drop at the supplied battlefield position.
export function spawnMoteGemDrop(enemy, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null;
  }
  const value = Number.isFinite(enemy?.moteFactor) ? Math.max(1, Math.round(enemy.moteFactor)) : 1;
  if (value <= 0) {
    return null;
  }
  const type = resolveMoteGemType(enemy);
  const profile = resolveMoteGemProfile(type.key);
  const gem = {
    id: moteGemState.nextId,
    x: position.x,
    y: position.y,
    value,
    typeKey: type.key,
    typeLabel: profile.name,
    pulse: Math.random() * Math.PI * 2,
    color: { ...profile.color },
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

  const record = moteGemState.inventory.get(gem.typeKey) || { label: gem.typeLabel, total: 0 };
  record.total += gem.value;
  record.label = gem.typeLabel || record.label;
  moteGemState.inventory.set(gem.typeKey, record);

  if (queueMoteDropHandler) {
    queueMoteDropHandler(gem.value);
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
