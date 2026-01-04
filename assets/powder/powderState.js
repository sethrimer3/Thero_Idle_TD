// Powder configuration and state factory extracted from main.js for clarity.
import { DEFAULT_MOTE_PALETTE, mergeMotePalette } from '../../scripts/features/towers/powderTower.js';

/**
 * Builds the powder configuration, runtime state containers, and DOM placeholders
 * used by the sand/fluid spire systems so main.js no longer owns the bootstrap logic.
 */
export function createPowderStateContext() {
  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
    simulatedDuneGainMax: 3.4,
    wallBaseGapMotes: 5, // Start with walls 5 motes apart
    wallGapPerGlyph: 1, // Walls expand by 1 mote per glyph
    wallMaxGapMotes: 75, // Maximum wall gap of 75 motes
    wallGapViewportRatio: 0.15, // Narrow the tower walls so the visible mote lane is roughly one-fifth of the previous span.
    fluidUnlockSigils: 0, // Sigil rungs no longer gate the Bet Spire Terrarium while glyph costs handle the unlock.
    fluidUnlockGlyphCost: 0, // Aleph glyph tithe required to unlock the Bet Spire Terrarium (temporarily waived).
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetActive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
    simulatedDuneGain: 0,
    wallGlyphsLit: 0,
    glyphsAwarded: 0, // Highest Aleph index already translated into glyph currency.
    fluidGlyphsLit: 0,
    fluidGlyphsAwarded: 0, // Highest Bet index already translated into Bet glyph currency.
    idleMoteBank: 0,
    idleDrainRate: 0,
    pendingMoteDrops: [],
    idleBankHydrated: false, // Tracks whether the active simulation already holds the saved idle motes.
    fluidIdleBank: 0,
    fluidIdleDrainRate: 0,
    pendingFluidDrops: [],
    fluidBankHydrated: false,
    motePalette: mergeMotePalette(DEFAULT_MOTE_PALETTE),
    simulationMode: 'sand',
    wallGapTarget: powderConfig.wallBaseGapMotes,
    modeSwitchPending: false,
    fluidProfileLabel: 'Bet Spire',
    fluidUnlocked: false,
    // Track pointer gestures for the powder basin camera controls.
    viewInteraction: null,
    // Cache the latest camera transform so overlays sync even before the simulation emits.
    viewTransform: null,
    // Track whether Aleph spire camera gestures are enabled from the settings panel.
    alephCameraMode: false,
    // Preserve serialized simulation payloads until the active basin is ready to restore them.
    loadedSimulationState: null,
    loadedFluidState: null,
    // Track whether initial page load restoration has been completed (once per session)
    initialLoadRestored: false,
    fluidInitialLoadRestored: false,
    // Track Bet terrarium fractal leveling progress.
    betTerrarium: {
      levelingMode: false,
      trees: {},
      buttonMenuOpen: false, // Track when button menus are open
      cameraMode: true, // Camera mode always enabled for achievements terrarium
      slimeCount: 0, // Persist terrarium creature counts for Bet spire visuals.
      birdCount: 0, // Persist terrarium creature counts for Bet spire visuals.
    },
  };

  const fluidElements = {
    tabStack: null, // Container that hosts the split spire tab controls.
    powderTabButton: null, // Reference to the mote spire trigger that occupies the top half of the split button.
    tabButton: null,
    panel: null,
    host: null,
    simulationCard: null,
    canvas: null,
    basin: null,
    terrariumLayer: null,
    terrariumStage: null,
    terrariumMedia: null,
    terrariumSky: null,
    terrariumStarsNear: null,
    terrariumStarsFar: null,
    terrariumSun: null,
    terrariumMoon: null,
    floatingIslandSprite: null,
    floatingIslandCollisionSprite: null,
    viewport: null,
    leftWall: null,
    rightWall: null,
    leftHitbox: null,
    rightHitbox: null,
    reservoirValue: null,
    dripRateValue: null,
    statusNote: null,
    returnButton: null,
    cameraModeToggle: null,
    cameraModeStateLabel: null,
    cameraModeHint: null,
    terrainSprite: null,
    terrainCollisionSprite: null, // Offscreen collision silhouette for the Bet terrarium ground.
    wallGlyphColumns: [],
    // Terrarium items dropdown for managing and upgrading items.
    terrariumItemsToggle: null,
    terrariumItemsDropdown: null,
    terrariumItemsEmpty: null,
    terrariumItemsList: null,
  };

  const powderGlyphColumns = [];
  const fluidGlyphColumns = [];

  // Achievements terrarium elements - separate visual from Bet spire terrarium
  const achievementsTerrariumElements = {
    host: null,
    card: null,
    canvas: null,
    basin: null,
    terrariumLayer: null,
    terrariumStage: null,
    terrariumMedia: null,
    terrariumSky: null,
    terrariumStarsNear: null,
    terrariumStarsFar: null,
    terrariumSun: null,
    terrariumMoon: null,
    floatingIslandSprite: null,
    floatingIslandCollisionSprite: null,
    terrainSprite: null,
    terrainCollisionSprite: null,
    viewport: null,
    terrariumItemsToggle: null,
    terrariumItemsDropdown: null,
    terrariumItemsEmpty: null,
    terrariumItemsList: null,
  };

  let powderElementsRef = null;

  // Getter for powder overlay elements that preserves the shared reference used by DOM helpers.
  const getPowderElements = () => powderElementsRef;
  // Setter to update the cached powder element bundle once createPowderDisplaySystem binds the DOM.
  const setPowderElements = (elements) => {
    powderElementsRef = elements;
  };

  return {
    powderConfig,
    powderState,
    fluidElements,
    achievementsTerrariumElements,
    powderGlyphColumns,
    fluidGlyphColumns,
    getPowderElements,
    setPowderElements,
  };
}
