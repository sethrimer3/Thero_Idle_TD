// Constants used across playfield modules

// Minimum pointer distance before the playfield interprets input as a camera drag.
export const PLAYFIELD_VIEW_DRAG_THRESHOLD = 6;

// Allow the camera to pan beyond the level edges by a fixed 4 meter buffer regardless of zoom.
export const PLAYFIELD_VIEW_PAN_MARGIN_METERS = 4;

// Scale battlefield mote gem rendering relative to the canvas so drop sizes stay consistent across devices.
export const GEM_MOTE_BASE_RATIO = 0.02;

// Preload the Mind Gate sprite so the path finale mirrors the Towers tab art.
export const MIND_GATE_SPRITE_URL = 'assets/images/tower-mind-gate.svg';
export const mindGateSprite = new Image();
mindGateSprite.src = MIND_GATE_SPRITE_URL;
mindGateSprite.decoding = 'async';
mindGateSprite.loading = 'eager';

// Preload the Enemy Gate sprite so the spawn origin echoes the Codex depiction.
export const ENEMY_GATE_SPRITE_URL = 'assets/images/enemy-gate.svg';
export const enemyGateSprite = new Image();
enemyGateSprite.src = ENEMY_GATE_SPRITE_URL;
enemyGateSprite.decoding = 'async';
enemyGateSprite.loading = 'eager';

// Dependency container allows the main module to provide shared helpers without creating circular imports.
export const defaultDependencies = {
  alephChainUpgrades: {},
  theroSymbol: '?',
  calculateStartingThero: () => 0,
  updateStatusDisplays: () => {},
  notifyEnemyDefeated: () => {},
  notifyAutoAnchorUsed: () => {},
  getOmegaPatternForTier: () => [],
  isFieldNotesOverlayVisible: () => false,
  getBaseStartThero: () => 50,
  getBaseCoreIntegrity: () => 100,
  handleDeveloperMapPlacement: () => false,
  // Allows the playfield to respect the global graphics fidelity toggle.
  isLowGraphicsMode: () => false,
};
