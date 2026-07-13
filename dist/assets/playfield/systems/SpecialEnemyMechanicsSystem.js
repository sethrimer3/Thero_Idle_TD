// SpecialEnemyMechanicsSystem.js — extracted from playfield.js (Build 714)
// Handles special enemy behavior triggers: relay enemy spawning, quantum-tunnel zone
// creation, tower nullifier disabling, and the relay spawn visual effect.
// All exported functions operate with `this` bound to a SimplePlayfield instance
// via the Object.assign prototype-delegation pattern.

/**
 * Spawn one standard enemy at a relay's current path position.
 * Spawning is one-shot; the relay flag on the calling site prevents infinite recursion.
 */
export function spawnRelayEnemy(relay, spawnTypeId) {
  if (!relay || !spawnTypeId) {
    return;
  }
  const pos = this.getEnemyPosition(relay);
  if (!pos) {
    return;
  }
  // Build a minimal enemy object inheriting from the relay's wave context
  const nextId = (this._nextEnemyId = ((this._nextEnemyId || 0) + 1));
  const spawnEnemy = {
    id: nextId,
    typeId: spawnTypeId,
    codexId: spawnTypeId,
    label: spawnTypeId,
    color: '#4a90e2',
    speed: 50,
    baseSpeed: 50,
    hp: relay.hp > 0 ? Math.max(1, relay.hp * 0.5) : 1,
    maxHp: relay.maxHp > 0 ? Math.max(1, relay.maxHp * 0.5) : 1,
    progress: Math.max(0, relay.progress || 0),
    reward: 0,
    x: pos.x,
    y: pos.y,
    hpExponent: this.calculateHealthExponent ? this.calculateHealthExponent(1) : 0,
    gemDropMultiplier: 1,
    moteFactor: 1,
    symbol: spawnTypeId[0] || 'ε',
    polygonSides: 0,
  };
  this.enemies.push(spawnEnemy);
  this.combatStateManager?.registerEnemy?.(spawnEnemy);
  // Visual feedback: radial pulse at relay position
  if (typeof this.spawnRelaySpawnEffect === 'function') {
    this.spawnRelaySpawnEffect(pos);
  }
  // Debug log — removable without affecting gameplay
  console.log(`[Relay Spawn Triggered] relay id=${relay.id} spawned typeId=${spawnTypeId} at progress=${relay.progress?.toFixed(3)}`);
}

/**
 * Create a 4-second TunnelZone at the enemy's current path position.
 * teleportDistance is 7.5% of total path length (mid-range of 5–10%).
 */
export function createTunnelZone(enemy) {
  if (!enemy) {
    return;
  }
  const pos = this.getEnemyPosition(enemy);
  if (!pos) {
    return;
  }
  if (!Array.isArray(this.tunnelZones)) {
    this.tunnelZones = [];
  }
  const zone = {
    position: { x: pos.x, y: pos.y },
    elapsed: 0,
    teleportDistance: 0.075, // 7.5% of normalised path length
    _teleportedIds: new Set(),
  };
  this.tunnelZones.push(zone);
  // Debug log — removable without affecting gameplay
  console.log(`[Quantum Tunnel Created] at (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}) teleportDist=0.075`);
}

/**
 * Disable a tower for a fixed duration using epoch-second timestamps.
 * Uses tower.disabledUntil so multiple nullifier hits don't stack indefinitely —
 * only extends if the new expiry is later than the existing one.
 */
export function disableTower(tower, durationSeconds) {
  if (!tower || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return;
  }
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()) / 1000;
  const newExpiry = now + durationSeconds;
  // Do not stack: only extend if the new expiry is later than the existing one
  if (Number.isFinite(tower.disabledUntil) && tower.disabledUntil >= newExpiry) {
    return;
  }
  tower.disabledUntil = newExpiry;
  // Visual feedback: show ∅ symbol and darken the tower sprite
  if (!Array.isArray(tower._nullifierEffects)) {
    tower._nullifierEffects = [];
  }
  tower._nullifierEffects.push({ startedAt: now, duration: durationSeconds });
  // Debug log — removable without affecting gameplay
  console.log(`[Nullifier Disabled Tower] tower id=${tower.id} type=${tower.type} for ${durationSeconds}s`);
}

/**
 * Spawn a radial pulse at the relay's position as visual feedback for the relay spawn event.
 * Reuses the existing PSI AoE effect system for visual consistency.
 */
export function spawnRelaySpawnEffect(position) {
  if (!position) {
    return;
  }
  if (typeof this.spawnPsiAoeEffect === 'function') {
    // Reuse the existing radial pulse effect at a small radius
    this.spawnPsiAoeEffect(position, 40);
  }
}
