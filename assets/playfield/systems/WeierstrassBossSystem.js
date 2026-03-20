// Weierstrass Prism boss encounter system.
// A higher-dimensional fractal boss that intrudes into the 2D battlefield.
// Uses layered oscillations for instability, circular intrusion telegraphs,
// and anchor entities that stabilise the battlefield when destroyed.
//
// The boss uses a Weierstrass-like function for its vulnerability timing:
// f(t) = Σ a^n cos(b^n π t), producing nowhere-differentiable oscillation.

// ─── Tuning constants ─────────────────────────────────────────────────────────
// Weierstrass function parameters for fractal oscillation.
export const WEIERSTRASS_A = 0.7;           // amplitude decay per harmonic (0 < a < 1)
export const WEIERSTRASS_B = 3;             // frequency multiplier per harmonic (odd int > 1)
export const WEIERSTRASS_HARMONICS = 5;     // number of summed harmonics
// Vulnerability window: boss takes full damage when f(t) > threshold.
export const WEIERSTRASS_VULN_THRESHOLD = 0.3;
// Intrusion telegraph timing.
export const INTRUSION_TELEGRAPH_DURATION = 1.8;  // seconds of warning before spike
export const INTRUSION_SPIKE_DURATION = 0.6;       // seconds the spike persists
export const INTRUSION_COOLDOWN = 4.0;             // seconds between intrusion attacks
export const INTRUSION_RADIUS = 0.08;              // normalised playfield radius of telegraph circle
// Anchor configuration.
export const ANCHOR_COUNT = 4;                      // number of anchors in the encounter
export const ANCHOR_HP_FRACTION = 0.15;             // fraction of boss HP per anchor
// Distortion configuration.
export const DISTORTION_GRID_SIZE = 4;              // grid tiles per axis for visual shuffle
export const DISTORTION_MAX_OFFSET = 0.12;          // maximum tile offset (normalised)
// Boss instability visual oscillation layers.
export const INSTABILITY_LAYERS = 3;
export const INSTABILITY_FREQUENCIES = [1.1, 2.7, 4.3]; // Hz for each layer
export const INSTABILITY_AMPLITUDES = [0.015, 0.008, 0.004]; // normalised offset per layer

/**
 * Evaluate the truncated Weierstrass function at time t.
 * Returns a value roughly in [-1, 1] range.
 */
export function weierstrass(t, a = WEIERSTRASS_A, b = WEIERSTRASS_B, n = WEIERSTRASS_HARMONICS) {
  let sum = 0;
  for (let k = 0; k < n; k++) {
    sum += Math.pow(a, k) * Math.cos(Math.pow(b, k) * Math.PI * t);
  }
  return sum;
}

/**
 * Determine if the boss is currently vulnerable based on fractal oscillation.
 * @param {number} t - elapsed time in seconds
 * @returns {{ vulnerable: boolean, value: number }}
 */
export function resolveWeierVulnerability(t) {
  const value = weierstrass(t);
  return {
    vulnerable: value > WEIERSTRASS_VULN_THRESHOLD,
    value,
  };
}

/**
 * Initialise Weierstrass boss state on an enemy.
 */
export function initWeierstrass(enemy) {
  if (!enemy || enemy._weierstrass) {
    return;
  }
  enemy._weierstrass = {
    elapsedTime: 0,
    vulnerable: true,
    fractalValue: 0,
    // Intrusion attack state
    intrusionTimer: INTRUSION_COOLDOWN * 0.5, // start halfway through first cooldown
    intrusionActive: false,
    intrusionTelegraphs: [],     // {x, y, timer, phase: 'telegraph'|'spike'|'done'}
    // Anchor tracking
    anchors: [],                 // {x, y, hp, maxHp, alive, regionIndex}
    anchorsInitialised: false,
    // Distortion state
    distortionIntensity: 1.0,    // 1 = fully distorted, 0 = fully coherent
    distortionGrid: null,        // will be initialised on first update
    // Visual instability offsets (layered oscillation)
    instabilityOffset: { x: 0, y: 0 },
  };
}

/**
 * Initialise anchors around the battlefield.
 * @param {object} enemy - the boss enemy
 * @param {number} bossMaxHp - the boss's max HP for sizing anchor HP
 */
export function initAnchors(enemy, bossMaxHp) {
  if (!enemy || !enemy._weierstrass || enemy._weierstrass.anchorsInitialised) {
    return;
  }
  const anchorHp = bossMaxHp * ANCHOR_HP_FRACTION;
  const anchors = [];
  for (let i = 0; i < ANCHOR_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / ANCHOR_COUNT + Math.PI / 4; // offset by 45°
    anchors.push({
      x: 0.5 + Math.cos(angle) * 0.35,
      y: 0.5 + Math.sin(angle) * 0.35,
      hp: anchorHp,
      maxHp: anchorHp,
      alive: true,
      regionIndex: i,
    });
  }
  enemy._weierstrass.anchors = anchors;
  enemy._weierstrass.anchorsInitialised = true;

  // Initialise distortion grid
  const gridSize = DISTORTION_GRID_SIZE;
  const grid = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      grid.push({
        row, col,
        offsetX: (Math.random() - 0.5) * DISTORTION_MAX_OFFSET * 2,
        offsetY: (Math.random() - 0.5) * DISTORTION_MAX_OFFSET * 2,
        stabilised: false,
        anchorIndex: Math.floor((row * gridSize + col) / (gridSize * gridSize / ANCHOR_COUNT)),
      });
    }
  }
  enemy._weierstrass.distortionGrid = grid;
}

/**
 * Update the Weierstrass boss state each frame.
 */
export function updateWeierstrass(enemy, delta) {
  if (!enemy || !enemy._weierstrass) {
    return;
  }
  const state = enemy._weierstrass;
  state.elapsedTime += delta;

  // Update fractal vulnerability
  const vuln = resolveWeierVulnerability(state.elapsedTime);
  state.vulnerable = vuln.vulnerable;
  state.fractalValue = vuln.value;

  // Update visual instability offset (layered deterministic oscillation)
  let ox = 0;
  let oy = 0;
  for (let i = 0; i < INSTABILITY_LAYERS; i++) {
    const freq = INSTABILITY_FREQUENCIES[i] || 1;
    const amp = INSTABILITY_AMPLITUDES[i] || 0.01;
    ox += Math.sin(state.elapsedTime * freq * Math.PI * 2 + i * 1.7) * amp;
    oy += Math.cos(state.elapsedTime * freq * Math.PI * 2 + i * 2.3) * amp;
  }
  // Scale instability by distortion intensity (less distortion = more stable)
  state.instabilityOffset.x = ox * state.distortionIntensity;
  state.instabilityOffset.y = oy * state.distortionIntensity;

  // Update intrusion attack cycle
  state.intrusionTimer += delta;
  if (!state.intrusionActive && state.intrusionTimer >= INTRUSION_COOLDOWN) {
    // Spawn a new intrusion telegraph
    state.intrusionActive = true;
    state.intrusionTimer = 0;
    state.intrusionTelegraphs.push({
      x: 0.2 + Math.random() * 0.6, // random position in central area
      y: 0.2 + Math.random() * 0.6,
      timer: 0,
      phase: 'telegraph',
      radius: INTRUSION_RADIUS,
    });
  }

  // Update existing telegraphs
  for (let i = state.intrusionTelegraphs.length - 1; i >= 0; i--) {
    const tel = state.intrusionTelegraphs[i];
    tel.timer += delta;
    if (tel.phase === 'telegraph' && tel.timer >= INTRUSION_TELEGRAPH_DURATION) {
      tel.phase = 'spike';
      tel.timer = 0;
    } else if (tel.phase === 'spike' && tel.timer >= INTRUSION_SPIKE_DURATION) {
      tel.phase = 'done';
    }
    if (tel.phase === 'done') {
      state.intrusionTelegraphs.splice(i, 1);
      state.intrusionActive = false;
    }
  }

  // Update distortion based on anchor status
  if (state.anchors.length > 0) {
    const aliveCount = state.anchors.filter((a) => a.alive).length;
    const targetIntensity = aliveCount / ANCHOR_COUNT;
    // Smoothly lerp toward target
    state.distortionIntensity += (targetIntensity - state.distortionIntensity) * Math.min(1, delta * 2);

    // Stabilise grid tiles linked to destroyed anchors
    if (state.distortionGrid) {
      state.distortionGrid.forEach((tile) => {
        const anchor = state.anchors[tile.anchorIndex];
        if (anchor && !anchor.alive && !tile.stabilised) {
          tile.stabilised = true;
        }
        if (tile.stabilised) {
          tile.offsetX *= Math.max(0, 1 - delta * 3);
          tile.offsetY *= Math.max(0, 1 - delta * 3);
        }
      });
    }
  }
}

/**
 * Apply damage to the nearest anchor within range of a hit position.
 * @param {object} enemy - the boss
 * @param {object} hitPos - {x, y} in normalised coordinates
 * @param {number} damage - damage amount
 * @returns {boolean} true if an anchor was hit
 */
export function damageAnchor(enemy, hitPos, damage) {
  if (!enemy || !enemy._weierstrass || !hitPos) {
    return false;
  }
  const anchors = enemy._weierstrass.anchors;
  const hitRadius = 0.06; // normalised radius for anchor hit detection
  for (const anchor of anchors) {
    if (!anchor.alive) {
      continue;
    }
    const dist = Math.hypot(anchor.x - hitPos.x, anchor.y - hitPos.y);
    if (dist <= hitRadius) {
      anchor.hp -= damage;
      if (anchor.hp <= 0) {
        anchor.alive = false;
        anchor.hp = 0;
      }
      return true;
    }
  }
  return false;
}
