(() => {
  'use strict';

  const levelBlueprints = [
    {
      id: 'Conjecture - 1',
      title: 'Lemniscate Hypothesis',
      path: '∞ loop traced from r² = cos(2θ); mirrored spawn lanes cross twice.',
      focus: 'Early E glyphs surge with divisor scouts—tempo control is vital.',
      example:
        "Goldbach’s Conjecture: Every even integer greater than 2 is the sum of two primes.",
    },
    {
      id: 'Conjecture - 2',
      title: 'Collatz Cascade',
      path: 'Stepwise descent generated from the 3n + 1 map with teleport risers.',
      focus: 'Hit-count enemies appear on odd nodes; summon glyph soldiers to stall.',
      example:
        'Collatz Conjecture: Iterate n → n/2 or 3n + 1 and every positive integer reaches 1.',
    },
    {
      id: 'Conjecture - 3',
      title: 'Riemann Helix',
      path: 'Logarithmic spiral with harmonic bulges keyed to ζ(s) zero estimates.',
      focus: 'Divisor elites flank wave bosses—Ω previews excel at splash slows.',
      example:
        'Riemann Hypothesis: Every nontrivial zero of ζ(s) lies on the line Re(s) = 1/2.',
    },
    {
      id: 'Conjecture - 4',
      title: 'Twin Prime Fork',
      path: 'Dual lattice rails linked by prime gaps; enemies swap lanes unpredictably.',
      focus: 'Prime counters demand rapid-fire towers—γ chaining resets their count.',
      example:
        'Twin Prime Conjecture: Infinitely many primes p exist such that p + 2 is prime.',
    },
    {
      id: 'Conjecture - 5',
      title: 'Birch Flow',
      path: 'Cardioid river influenced by elliptic curve rank gradients.',
      focus: 'Reversal sentinels join late waves—δ soldiers can flip them to your side.',
      example:
        'Birch and Swinnerton-Dyer Conjecture: Rational points of elliptic curves link to L-series behavior.',
    },
    {
      id: 'Corollary - 6',
      title: 'Derivative Bloom',
      path: 'Petal loops bloom where f′(x) = 0 across mirrored cardioids and saddle petals.',
      focus: 'Flux bursts alternate with brittle shards—steady α lattices prevent overflow collapses.',
      example:
        "Rolle's Corollary: If f(a) = f(b) for differentiable f, some c in (a, b) satisfies f′(c) = 0.",
    },
    {
      id: 'Corollary - 7',
      title: 'Integral Cascade',
      path: 'Stepped integrator ramps descend in quantized slopes shaped by accumulated area.',
      focus: 'Energy leeches drift down ramps—δ summons keep Δ energy above zero.',
      example:
        'Fundamental Corollary: Integrating a derivative recovers the original function up to constants.',
    },
    {
      id: 'Corollary - 8',
      title: 'Fibonacci Turnabout',
      path: 'Interleaved golden spirals shift radius on Fibonacci indices and teleport pads.',
      focus: 'Prime counters spawn on Fibonacci junctions—γ conductors reset their tally.',
      example:
        'Binet Corollary: Fₙ = (φⁿ − ψⁿ)/√5 gives the closed form of Fibonacci growth.',
    },
    {
      id: 'Corollary - 9',
      title: 'Euler Bridge',
      path: 'Bridge arcs obey planar graph constraints; parity lanes swap over Euler gaps.',
      focus: 'Divisors guard the bridges—β beams must stay coherent to pierce.',
      example:
        'Euler Characteristic Corollary: For planar graphs, F = E − V + 2 limits feasible crossings.',
    },
    {
      id: 'Corollary - 10',
      title: 'Modular Bloom',
      path: 'Modular roses rotate through residue-locked petals with congruence gate warps.',
      focus: 'Reversal sentinels invert on residue gates—δ rallies convert them mid-arc.',
      example:
        'Chinese Remainder Corollary: Congruence systems share synchronized solutions modulo their product.',
    },
  ];

  const enemyCodexEntries = [
    {
      id: 'etype',
      name: 'E-Type Glyphs',
      description:
        'Core foes labeled by trailing zeros. E₁ carries one hit point, while E₃ arrives with 10³ life. Their waves scale logarithmically between sets.',
    },
    {
      id: 'divisor',
      name: 'Divisors',
      description:
        'Glyphs that punish high DPS. Damage taken equals 1 / DPS, so precision tuning and debuff towers are key.',
    },
    {
      id: 'prime',
      name: 'Prime Counters',
      description:
        'Resistant husks that require a fixed number of hits regardless of damage dealt—perfect sparring partners for swarm summoners.',
    },
    {
      id: 'reversal',
      name: 'Reversal Sentinels',
      description:
        'Vanguard units that, when defeated, sprint backward along the path. Capture them to fight for you with inverted health totals.',
    },
  ];

  const enemyCodexMap = new Map(enemyCodexEntries.map((entry) => [entry.id, entry]));

  const codexState = {
    encounteredEnemies: new Set(),
  };

  const TOWER_LOADOUT_LIMIT = 4;

  const towerDefinitions = [
    {
      id: 'alpha',
      symbol: 'α',
      name: 'Alpha Tower',
      tier: 1,
      baseCost: 10,
      damage: 28,
      rate: 1.25,
      range: 0.24,
      icon: 'assets/images/tower-alpha.svg',
      nextTierId: 'beta',
    },
    {
      id: 'beta',
      symbol: 'β',
      name: 'Beta Tower',
      tier: 2,
      baseCost: 100,
      damage: 48,
      rate: 1.1,
      range: 0.26,
      icon: 'assets/images/tower-beta.svg',
      nextTierId: 'gamma',
    },
    {
      id: 'gamma',
      symbol: 'γ',
      name: 'Gamma Tower',
      tier: 3,
      baseCost: 1000,
      damage: 72,
      rate: 1.2,
      range: 0.28,
      icon: 'assets/images/tower-gamma.svg',
      nextTierId: 'delta',
    },
    {
      id: 'delta',
      symbol: 'δ',
      name: 'Delta Tower',
      tier: 4,
      baseCost: 10000,
      damage: 56,
      rate: 0.95,
      range: 0.22,
      icon: 'assets/images/tower-delta.svg',
      nextTierId: 'epsilon',
    },
    {
      id: 'epsilon',
      symbol: 'ε',
      name: 'Epsilon Tower',
      tier: 5,
      baseCost: 50000,
      damage: 44,
      rate: 1.4,
      range: 0.26,
      icon: 'assets/images/tower-epsilon.svg',
      nextTierId: 'zeta',
    },
    {
      id: 'zeta',
      symbol: 'ζ',
      name: 'Zeta Tower',
      tier: 6,
      baseCost: 250000,
      damage: 68,
      rate: 1.3,
      range: 0.3,
      icon: 'assets/images/tower-zeta.svg',
      nextTierId: 'eta',
    },
    {
      id: 'eta',
      symbol: 'η',
      name: 'Eta Tower',
      tier: 7,
      baseCost: 1000000,
      damage: 96,
      rate: 1.1,
      range: 0.32,
      icon: 'assets/images/tower-eta.svg',
      nextTierId: 'theta',
    },
    {
      id: 'theta',
      symbol: 'θ',
      name: 'Theta Tower',
      tier: 8,
      baseCost: 4000000,
      damage: 132,
      rate: 0.98,
      range: 0.34,
      icon: 'assets/images/tower-theta.svg',
      nextTierId: 'omega',
    },
    {
      id: 'omega',
      symbol: 'Ω',
      name: 'Omega Tower',
      tier: 9,
      baseCost: 15000000,
      damage: 180,
      rate: 0.9,
      range: 0.36,
      icon: 'assets/images/tower-omega.svg',
      nextTierId: 'iota',
    },
    {
      id: 'iota',
      symbol: 'ι',
      name: 'Iota Tower',
      tier: 10,
      baseCost: 60000000,
      damage: 240,
      rate: 0.85,
      range: 0.38,
      icon: 'assets/images/tower-iota.svg',
      nextTierId: 'kappa',
    },
    {
      id: 'kappa',
      symbol: 'κ',
      name: 'Kappa Tower',
      tier: 11,
      baseCost: 200000000,
      damage: 320,
      rate: 0.8,
      range: 0.4,
      icon: 'assets/images/tower-kappa.svg',
      nextTierId: 'lambda',
    },
    {
      id: 'lambda',
      symbol: 'λ',
      name: 'Lambda Tower',
      tier: 12,
      baseCost: 700000000,
      damage: 420,
      rate: 0.75,
      range: 0.42,
      icon: 'assets/images/tower-lambda.svg',
      nextTierId: null,
    },
  ];

  const towerDefinitionMap = new Map(towerDefinitions.map((tower) => [tower.id, tower]));

  const towerLoadoutState = {
    selected: ['alpha'],
  };

  const towerUnlockState = {
    unlocked: new Set(['alpha']),
  };

  function isTowerUnlocked(towerId) {
    return towerUnlockState.unlocked.has(towerId);
  }

  function unlockTower(towerId, { silent = false } = {}) {
    if (!towerId || !towerDefinitionMap.has(towerId)) {
      return false;
    }
    if (towerUnlockState.unlocked.has(towerId)) {
      return false;
    }
    towerUnlockState.unlocked.add(towerId);
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    if (!silent && playfield?.messageEl) {
      playfield.messageEl.textContent = `${
        getTowerDefinition(towerId)?.symbol || 'New'
      } lattice discovered—add it to your loadout from the Towers tab.`;
    }
    return true;
  }

  function getTowerDefinition(towerId) {
    return towerDefinitionMap.get(towerId) || null;
  }

  function getNextTowerId(towerId) {
    const definition = getTowerDefinition(towerId);
    return definition?.nextTierId || null;
  }

  const levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));
  const levelState = new Map();
  const interactiveLevelOrder = Array.from(levelConfigs.keys());
  const unlockedLevels = new Set([firstLevelConfig.id]);

  let tabs = [];
  let panels = [];
  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;
  let overlay = null;
  let overlayLabel = null;
  let overlayTitle = null;
  let overlayExample = null;
  let overlayMode = null;
  let overlayDuration = null;
  let overlayRewards = null;
  let overlayLast = null;
  let overlayInstruction = null;
  let overlayRequiresLevelExit = false;
  const overlayInstructionDefault = 'Tap to enter';
  let activeLevelId = null;
  let pendingLevel = null;
  let activeTabIndex = 0;
  let lastLevelTrigger = null;

  const loadoutElements = {
    container: null,
    grid: null,
    note: null,
  };
  let renderedLoadoutSignature = null;

  const towerSelectionButtons = new Map();

  const loadoutDragState = {
    active: false,
    pointerId: null,
    towerId: null,
    element: null,
  };

  function isInteractiveLevel(levelId) {
    return levelConfigs.has(levelId);
  }

  function isLevelUnlocked(levelId) {
    if (!levelId) {
      return false;
    }
    if (!isInteractiveLevel(levelId)) {
      return true;
    }
    return unlockedLevels.has(levelId);
  }

  function unlockLevel(levelId) {
    if (!levelId || !isInteractiveLevel(levelId)) {
      return;
    }
    if (!unlockedLevels.has(levelId)) {
      unlockedLevels.add(levelId);
    }
  }

  function unlockNextInteractiveLevel(levelId) {
    const index = interactiveLevelOrder.indexOf(levelId);
    if (index < 0) {
      return;
    }
    const nextId = interactiveLevelOrder[index + 1];
    if (nextId) {
      unlockLevel(nextId);
    }
  }

  function getPreviousInteractiveLevelId(levelId) {
    const index = interactiveLevelOrder.indexOf(levelId);
    if (index <= 0) {
      return null;
    }
    return interactiveLevelOrder[index - 1] || null;
  }

  const enemyCodexElements = {
    list: null,
    empty: null,
    note: null,
  };

  let playfield = null;
  const playfieldElements = {
    container: null,
    canvas: null,
    message: null,
    wave: null,
    health: null,
    energy: null,
    progress: null,
    startButton: null,
    speedButton: null,
    autoAnchorButton: null,
    slots: [],
  };

  const numberSuffixes = [
    '',
    'K',
    'M',
    'B',
    'T',
    'Qa',
    'Qi',
    'Sx',
    'Sp',
    'Oc',
    'No',
    'De',
    'UDe',
    'DDe',
    'TDe',
    'QDe',
  ];

  const gameStats = {
    manualVictories: 0,
    idleVictories: 0,
    towersPlaced: 0,
    maxTowersSimultaneous: 0,
    autoAnchorPlacements: 0,
    powderActions: 0,
    enemiesDefeated: 0,
    idleMillisecondsAccumulated: 0,
    powderSigilsReached: 0,
    highestPowderMultiplier: 1,
  };

  const ACHIEVEMENT_REWARD_FLUX = 1;

  // The audio manifest points to filenames under assets/audio/music and assets/audio/sfx.
  // Drop encoded tracks with the listed names into those folders to activate playback.
  const audioManifest = {
    musicVolume: 0.6,
    sfxVolume: 0.85,
    music: {
      menu: { file: 'menu_theme.ogg', loop: true, volume: 0.55 },
      preparation: { file: 'lemniscate_preparation.ogg', loop: true, volume: 0.65 },
      combat: { file: 'lemniscate_combat.ogg', loop: true, volume: 0.75 },
    },
    sfx: {
      uiConfirm: { file: 'ui_confirm.wav', volume: 0.45, maxConcurrent: 2 },
      uiToggle: { file: 'ui_toggle.wav', volume: 0.4, maxConcurrent: 2 },
      towerPlace: { file: 'tower_placement.mp3', volume: 0.7, maxConcurrent: 4 },
      towerSell: { file: 'tower_sell.wav', volume: 0.6, maxConcurrent: 2 },
      projectile: { file: 'projectile_launch.wav', volume: 0.45, maxConcurrent: 6 },
      enemyDefeat: { file: 'enemy_defeat.wav', volume: 0.65, maxConcurrent: 4 },
      enemyBreach: { file: 'enemy_breach.wav', volume: 0.75, maxConcurrent: 2 },
      victory: { file: 'victory_sting.wav', volume: 0.8, maxConcurrent: 1 },
      defeat: { file: 'defeat_sting.wav', volume: 0.8, maxConcurrent: 1 },
      alphaTowerFire: { file: 'alpha_tower_firing.mp3', volume: 0.55, maxConcurrent: 5 },
    },
  };

  class AudioManager {
    constructor(manifest = {}) {
      this.musicFolder = 'assets/audio/music';
      this.sfxFolder = 'assets/audio/sfx';
      this.musicDefinitions = manifest.music || {};
      this.sfxDefinitions = manifest.sfx || {};
      this.musicVolume = this._clampVolume(manifest.musicVolume, 0.5);
      this.sfxVolume = this._clampVolume(manifest.sfxVolume, 0.8);
      this.musicElements = new Map();
      this.sfxPools = new Map();
      this.currentMusicKey = null;
      this.pendingUnlockResolvers = [];
      this.pendingMusicKey = null;
      this.unlocked = false;
      this.activationElements = typeof WeakSet === 'function' ? new WeakSet() : { add() {}, has() { return false; } };

      if (typeof document !== 'undefined') {
        const unlockHandler = () => this.unlock();
        document.addEventListener('pointerdown', unlockHandler, { once: true });
        document.addEventListener('keydown', unlockHandler, { once: true });
      }
    }

    registerActivationElements(elements) {
      if (!Array.isArray(elements)) {
        return;
      }
      elements.forEach((element) => this.registerActivationElement(element));
    }

    registerActivationElement(element) {
      if (!element || (this.activationElements && this.activationElements.has(element))) {
        return;
      }

      const handler = () => {
        this.unlock();
        ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
          element.removeEventListener(eventName, handler);
        });
      };

      ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
        element.addEventListener(eventName, handler);
      });

      if (this.activationElements && typeof this.activationElements.add === 'function') {
        this.activationElements.add(element);
      }
    }

    unlock() {
      if (this.unlocked) {
        return;
      }
      this.unlocked = true;
      while (this.pendingUnlockResolvers.length) {
        const resolve = this.pendingUnlockResolvers.shift();
        if (typeof resolve === 'function') {
          resolve();
        }
      }
    }

    whenUnlocked() {
      if (this.unlocked) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.pendingUnlockResolvers.push(resolve);
      });
    }

    playMusic(key, options = {}) {
      if (!key) {
        return;
      }

      const startPlayback = () => {
        const entry = this._ensureMusicEntry(key);
        if (!entry) {
          return;
        }

        const { audio, definition } = entry;
        const restart = options.restart || this.currentMusicKey !== key;
        const loop = typeof options.loop === 'boolean' ? options.loop : definition.loop !== false;
        audio.loop = loop;
        audio.volume = this._resolveMusicVolume(definition, options.volume);

        if (restart) {
          try {
            audio.currentTime = 0;
          } catch (error) {
            audio.src = audio.src;
          }
        }

        if (this.currentMusicKey && this.currentMusicKey !== key) {
          this.stopMusic(this.currentMusicKey);
        }

        this.currentMusicKey = key;
        this.pendingMusicKey = null;
        const playPromise = audio.play();
        if (typeof playPromise?.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      if (!this.unlocked) {
        this.pendingMusicKey = key;
        this.whenUnlocked().then(() => {
          if (this.pendingMusicKey === key) {
            startPlayback();
          }
        });
        return;
      }

      startPlayback();
    }

    stopMusic(key = this.currentMusicKey, options = {}) {
      if (!key) {
        return;
      }
      const entry = this.musicElements.get(key);
      if (!entry) {
        return;
      }
      entry.audio.pause();
      if (options.reset !== false) {
        try {
          entry.audio.currentTime = 0;
        } catch (error) {
          entry.audio.src = entry.audio.src;
        }
      }
      if (this.currentMusicKey === key) {
        this.currentMusicKey = null;
      }
    }

    playSfx(key, options = {}) {
      if (!key) {
        return;
      }

      const startPlayback = () => {
        const entry = this._ensureSfxEntry(key);
        if (!entry) {
          return;
        }

        const { definition, pool } = entry;
        const index = entry.nextIndex;
        const audio = pool[index];
        entry.nextIndex = (index + 1) % pool.length;

        audio.loop = false;
        audio.volume = this._resolveSfxVolume(definition, options.volume);

        try {
          audio.currentTime = 0;
        } catch (error) {
          audio.src = audio.src;
        }

        const playPromise = audio.play();
        if (typeof playPromise?.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      if (!this.unlocked) {
        this.whenUnlocked().then(() => startPlayback());
        return;
      }

      startPlayback();
    }

    _ensureMusicEntry(key) {
      let entry = this.musicElements.get(key);
      if (entry) {
        return entry;
      }

      const definition = this.musicDefinitions[key];
      const source = this._buildSource(definition, this.musicFolder);
      if (!definition || !source) {
        return null;
      }

      const audio = new Audio(source);
      audio.preload = definition.preload || 'auto';
      audio.loop = definition.loop !== false;
      audio.volume = this._resolveMusicVolume(definition);

      entry = { audio, definition };
      this.musicElements.set(key, entry);
      return entry;
    }

    _ensureSfxEntry(key) {
      let entry = this.sfxPools.get(key);
      if (entry) {
        return entry;
      }

      const definition = this.sfxDefinitions[key];
      const source = this._buildSource(definition, this.sfxFolder);
      if (!definition || !source) {
        return null;
      }

      const poolSize = Math.max(1, Math.floor(definition.maxConcurrent || definition.poolSize || 3));
      const pool = [];
      for (let index = 0; index < poolSize; index += 1) {
        const audio = new Audio(source);
        audio.preload = definition.preload || 'auto';
        audio.volume = this._resolveSfxVolume(definition);
        pool.push(audio);
      }

      entry = { definition, pool, nextIndex: 0 };
      this.sfxPools.set(key, entry);
      return entry;
    }

    _buildSource(definition, folder) {
      if (!definition) {
        return null;
      }
      if (definition.src) {
        return definition.src;
      }
      if (definition.file) {
        const sanitizedFolder = folder.endsWith('/') ? folder.slice(0, -1) : folder;
        return `${sanitizedFolder}/${definition.file}`;
      }
      return null;
    }

    _resolveMusicVolume(definition, overrideVolume) {
      const base = typeof overrideVolume === 'number'
        ? overrideVolume
        : typeof definition?.volume === 'number'
          ? definition.volume
          : 1;
      return this._clampVolume(base * this.musicVolume, 0);
    }

    _resolveSfxVolume(definition, overrideVolume) {
      const base = typeof overrideVolume === 'number'
        ? overrideVolume
        : typeof definition?.volume === 'number'
          ? definition.volume
          : 1;
      return this._clampVolume(base * this.sfxVolume, 0);
    }

    _clampVolume(value, fallback = 1) {
      const resolved = typeof value === 'number' ? value : fallback;
      if (!Number.isFinite(resolved)) {
        return fallback;
      }
      return Math.min(1, Math.max(0, resolved));
    }
  }

  const audioManager = new AudioManager(audioManifest);

  const achievementDefinitions = [
    {
      id: 'first-orbit',
      title: 'First Orbit',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.manualVictories >= 1,
      progress: () => {
        const sealed = Math.min(gameStats.manualVictories, 1);
        return `Progress: ${sealed}/1 victories sealed.`;
      },
    },
    {
      id: 'circle-seer',
      title: 'Circle Seer',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.maxTowersSimultaneous >= 3,
      progress: () => {
        const towers = Math.min(gameStats.maxTowersSimultaneous, 3);
        return `Progress: ${towers}/3 towers sustained.`;
      },
    },
    {
      id: 'series-summoner',
      title: 'Series Summoner',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.highestPowderMultiplier >= 1.25,
      progress: () => {
        const current = Math.min(gameStats.highestPowderMultiplier, 1.25);
        return `Progress: ×${formatDecimal(current, 2)} / ×1.25 multiplier.`;
      },
    },
    {
      id: 'zero-hunter',
      title: 'Zero Hunter',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.enemiesDefeated >= 30,
      progress: () => {
        const defeated = Math.min(gameStats.enemiesDefeated, 30);
        return `Progress: ${defeated}/30 glyphs defeated.`;
      },
    },
    {
      id: 'golden-mentor',
      title: 'Golden Mentor',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.autoAnchorPlacements >= 4,
      progress: () => {
        const placements = Math.min(gameStats.autoAnchorPlacements, 4);
        return `Progress: ${placements}/4 anchors harmonized.`;
      },
    },
    {
      id: 'powder-archivist',
      title: 'Powder Archivist',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.powderSigilsReached >= 3,
      progress: () => {
        const sigils = Math.min(gameStats.powderSigilsReached, 3);
        return `Progress: ${sigils}/3 sigils illuminated.`;
      },
    },
    {
      id: 'keystone-keeper',
      title: 'Keystone Keeper',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.idleVictories >= 1,
      progress: () => {
        const victories = Math.min(gameStats.idleVictories, 1);
        return `Progress: ${victories}/1 auto-run sealed.`;
      },
    },
    {
      id: 'temporal-sifter',
      title: 'Temporal Sifter',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX,
      condition: () => gameStats.idleMillisecondsAccumulated >= 600000,
      progress: () => {
        const seconds = Math.min(gameStats.idleMillisecondsAccumulated / 1000, 600);
        return `Progress: ${formatDuration(seconds)} / 10m idle.`;
      },
    },
  ];

  const achievementState = new Map();
  const achievementElements = new Map();

  const resourceElements = {
    score: null,
    energy: null,
    flux: null,
  };

  const baseResources = {
    score: 6.58 * 10 ** 45,
    scoreRate: 2.75 * 10 ** 43,
    energyRate: 575,
    fluxRate: 375,
  };

  const resourceState = {
    score: baseResources.score,
    scoreRate: baseResources.scoreRate,
    energyRate: baseResources.energyRate,
    fluxRate: baseResources.fluxRate,
    running: false,
  };

  let glyphCurrency = 0;

  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
    simulatedDuneGainMax: 3.4,
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetActive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
    simulatedDuneGain: 0,
    wallGlyphsLit: 0,
  };

  let currentPowderBonuses = {
    sandBonus: 0,
    duneBonus: 0,
    crystalBonus: 0,
    totalMultiplier: 1,
  };

  const powderElements = {
    sandfallFormula: null,
    sandfallNote: null,
    sandfallButton: null,
    duneFormula: null,
    duneNote: null,
    duneButton: null,
    crystalFormula: null,
    crystalNote: null,
    crystalButton: null,
    totalMultiplier: null,
    sandBonusValue: null,
    duneBonusValue: null,
    crystalBonusValue: null,
    ledgerBaseScore: null,
    ledgerCurrentScore: null,
    ledgerFlux: null,
    ledgerEnergy: null,
    sigilEntries: [],
    logList: null,
    logEmpty: null,
    simulationCanvas: null,
    simulationNote: null,
    basin: null,
    wallMarker: null,
    wallGlyphs: [],
    leftWall: null,
    rightWall: null,
  };

  let resourceTicker = null;
  let lastResourceTick = 0;

  const powderLog = [];
  const POWDER_LOG_LIMIT = 6;

  const idleLevelRuns = new Map();

  let powderSimulation = null;

  const firstLevelConfig = {
    id: 'Conjecture - 1',
    displayName: 'Lemniscate Hypothesis',
    startThero: 140,
    theroCap: 360,
    theroPerKill: 18,
    passiveTheroPerSecond: 8,
    lives: 5,
    waves: [
      {
        label: 'E glyphs',
        count: 6,
        interval: 1.6,
        hp: 85,
        speed: 0.082,
        reward: 12,
        color: 'rgba(139, 247, 255, 0.9)',
        codexId: 'etype',
      },
      {
        label: 'divisor scouts',
        count: 4,
        interval: 1.9,
        hp: 130,
        speed: 0.09,
        reward: 18,
        color: 'rgba(255, 125, 235, 0.92)',
        codexId: 'divisor',
      },
      {
        label: 'prime counters',
        count: 2,
        interval: 2.4,
        hp: 220,
        speed: 0.085,
        reward: 26,
        color: 'rgba(255, 228, 120, 0.95)',
        codexId: 'prime',
      },
    ],
    rewardScore: 1.6 * 10 ** 44,
    rewardFlux: 45,
    rewardThero: 35,
    rewardEnergy: 35,
    arcSpeed: 0.22,
    path: [
      { x: 0.06, y: 0.86 },
      { x: 0.2, y: 0.68 },
      { x: 0.32, y: 0.46 },
      { x: 0.44, y: 0.32 },
      { x: 0.56, y: 0.38 },
      { x: 0.68, y: 0.64 },
      { x: 0.8, y: 0.46 },
      { x: 0.9, y: 0.18 },
    ],
    autoAnchors: [
      { x: 0.24, y: 0.68 },
      { x: 0.44, y: 0.36 },
      { x: 0.62, y: 0.7 },
      { x: 0.78, y: 0.38 },
    ],
  };

  const levelTwoConfig = {
    id: 'Conjecture - 2',
    displayName: 'Collatz Cascade',
    startThero: 180,
    theroCap: 420,
    theroPerKill: 22,
    passiveTheroPerSecond: 10,
    lives: 5,
    waves: [
      {
        label: 'cascade sparks',
        count: 7,
        interval: 1.5,
        hp: 110,
        speed: 0.09,
        reward: 14,
        color: 'rgba(144, 206, 255, 0.9)',
        codexId: 'etype',
      },
      {
        label: 'odd sentries',
        count: 5,
        interval: 1.8,
        hp: 190,
        speed: 0.1,
        reward: 22,
        color: 'rgba(255, 150, 245, 0.92)',
        codexId: 'divisor',
      },
      {
        label: 'collatz elites',
        count: 4,
        interval: 2.2,
        hp: 260,
        speed: 0.11,
        reward: 30,
        color: 'rgba(255, 198, 120, 0.95)',
        codexId: 'prime',
      },
      {
        label: 'hailstone predators',
        count: 2,
        interval: 2.8,
        hp: 420,
        speed: 0.105,
        reward: 40,
        color: 'rgba(255, 102, 154, 0.95)',
        codexId: 'reversal',
      },
    ],
    rewardScore: 2.4 * 10 ** 44,
    rewardFlux: 60,
    rewardThero: 46,
    rewardEnergy: 46,
    arcSpeed: 0.24,
    path: [
      { x: 0.06, y: 0.86 },
      { x: 0.16, y: 0.7 },
      { x: 0.26, y: 0.58 },
      { x: 0.36, y: 0.64 },
      { x: 0.46, y: 0.46 },
      { x: 0.56, y: 0.28 },
      { x: 0.68, y: 0.34 },
      { x: 0.78, y: 0.52 },
      { x: 0.88, y: 0.38 },
      { x: 0.94, y: 0.16 },
    ],
    autoAnchors: [
      { x: 0.2, y: 0.68 },
      { x: 0.34, y: 0.54 },
      { x: 0.54, y: 0.34 },
      { x: 0.74, y: 0.5 },
    ],
  };

  const levelThreeConfig = {
    id: 'Conjecture - 3',
    displayName: 'Riemann Helix',
    startThero: 210,
    theroCap: 480,
    theroPerKill: 24,
    passiveTheroPerSecond: 11,
    lives: 6,
    waves: [
      {
        label: 'ζ scouts',
        count: 8,
        interval: 1.4,
        hp: 150,
        speed: 0.085,
        reward: 18,
        color: 'rgba(130, 235, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'harmonic drifters',
        count: 5,
        interval: 1.7,
        hp: 240,
        speed: 0.095,
        reward: 24,
        color: 'rgba(255, 170, 235, 0.92)',
        codexId: 'divisor',
      },
      {
        label: 'zero phantoms',
        count: 4,
        interval: 2.1,
        hp: 360,
        speed: 0.1,
        reward: 34,
        color: 'rgba(255, 210, 140, 0.95)',
        codexId: 'prime',
      },
      {
        label: 'helical wardens',
        count: 3,
        interval: 2.5,
        hp: 520,
        speed: 0.11,
        reward: 46,
        color: 'rgba(255, 120, 190, 0.95)',
        codexId: 'reversal',
      },
    ],
    rewardScore: 3.2 * 10 ** 44,
    rewardFlux: 72,
    rewardThero: 54,
    rewardEnergy: 54,
    arcSpeed: 0.26,
    path: [
      { x: 0.08, y: 0.9 },
      { x: 0.2, y: 0.72 },
      { x: 0.32, y: 0.58 },
      { x: 0.44, y: 0.5 },
      { x: 0.52, y: 0.6 },
      { x: 0.62, y: 0.78 },
      { x: 0.74, y: 0.64 },
      { x: 0.84, y: 0.44 },
      { x: 0.92, y: 0.26 },
      { x: 0.96, y: 0.12 },
    ],
    autoAnchors: [
      { x: 0.22, y: 0.68 },
      { x: 0.4, y: 0.52 },
      { x: 0.58, y: 0.68 },
      { x: 0.78, y: 0.46 },
    ],
  };

  const levelFourConfig = {
    id: 'Conjecture - 4',
    displayName: 'Twin Prime Fork',
    startThero: 240,
    theroCap: 520,
    theroPerKill: 28,
    passiveTheroPerSecond: 12,
    lives: 6,
    waves: [
      {
        label: 'twin outriders',
        count: 8,
        interval: 1.3,
        hp: 180,
        speed: 0.09,
        reward: 20,
        color: 'rgba(140, 240, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'gap stalkers',
        count: 6,
        interval: 1.6,
        hp: 280,
        speed: 0.105,
        reward: 28,
        color: 'rgba(255, 155, 240, 0.93)',
        codexId: 'divisor',
      },
      {
        label: 'prime twisters',
        count: 4,
        interval: 2,
        hp: 420,
        speed: 0.12,
        reward: 38,
        color: 'rgba(255, 210, 130, 0.96)',
        codexId: 'prime',
      },
      {
        label: 'forked vanguards',
        count: 3,
        interval: 2.6,
        hp: 640,
        speed: 0.13,
        reward: 52,
        color: 'rgba(255, 110, 170, 0.96)',
        codexId: 'reversal',
      },
      {
        label: 'lane shifters',
        count: 2,
        interval: 3,
        hp: 820,
        speed: 0.135,
        reward: 60,
        color: 'rgba(180, 255, 170, 0.96)',
        codexId: 'prime',
      },
    ],
    rewardScore: 4.4 * 10 ** 44,
    rewardFlux: 86,
    rewardThero: 62,
    rewardEnergy: 62,
    arcSpeed: 0.28,
    path: [
      { x: 0.06, y: 0.88 },
      { x: 0.18, y: 0.7 },
      { x: 0.3, y: 0.78 },
      { x: 0.42, y: 0.58 },
      { x: 0.52, y: 0.36 },
      { x: 0.64, y: 0.5 },
      { x: 0.76, y: 0.7 },
      { x: 0.88, y: 0.48 },
      { x: 0.94, y: 0.26 },
      { x: 0.88, y: 0.1 },
    ],
    autoAnchors: [
      { x: 0.2, y: 0.74 },
      { x: 0.38, y: 0.6 },
      { x: 0.58, y: 0.42 },
      { x: 0.76, y: 0.62 },
    ],
  };

  const levelFiveConfig = {
    id: 'Conjecture - 5',
    displayName: 'Birch Flow',
    startThero: 280,
    theroCap: 600,
    theroPerKill: 32,
    passiveTheroPerSecond: 14,
    lives: 7,
    waves: [
      {
        label: 'birch scouts',
        count: 9,
        interval: 1.2,
        hp: 220,
        speed: 0.09,
        reward: 24,
        color: 'rgba(150, 240, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'elliptic couriers',
        count: 7,
        interval: 1.5,
        hp: 340,
        speed: 0.11,
        reward: 32,
        color: 'rgba(255, 160, 235, 0.93)',
        codexId: 'divisor',
      },
      {
        label: 'rank guardians',
        count: 5,
        interval: 1.9,
        hp: 520,
        speed: 0.12,
        reward: 44,
        color: 'rgba(255, 210, 150, 0.96)',
        codexId: 'prime',
      },
      {
        label: 'river sentries',
        count: 4,
        interval: 2.3,
        hp: 760,
        speed: 0.13,
        reward: 58,
        color: 'rgba(255, 130, 190, 0.96)',
        codexId: 'reversal',
      },
      {
        label: 'swinnerton lords',
        count: 2,
        interval: 2.9,
        hp: 1100,
        speed: 0.135,
        reward: 72,
        color: 'rgba(200, 255, 190, 0.96)',
        codexId: 'prime',
      },
    ],
    rewardScore: 6 * 10 ** 44,
    rewardFlux: 102,
    rewardThero: 70,
    rewardEnergy: 70,
    arcSpeed: 0.3,
    path: [
      { x: 0.08, y: 0.92 },
      { x: 0.18, y: 0.78 },
      { x: 0.26, y: 0.62 },
      { x: 0.38, y: 0.5 },
      { x: 0.5, y: 0.38 },
      { x: 0.62, y: 0.44 },
      { x: 0.74, y: 0.64 },
      { x: 0.84, y: 0.54 },
      { x: 0.92, y: 0.32 },
      { x: 0.96, y: 0.16 },
    ],
    autoAnchors: [
      { x: 0.22, y: 0.76 },
      { x: 0.36, y: 0.56 },
      { x: 0.56, y: 0.44 },
      { x: 0.76, y: 0.6 },
    ],
  };

  // Critical points bloom at intervals mirroring f′(x) = 0 solutions for a fourth-degree polynomial.
  const levelSixConfig = {
    id: 'Corollary - 6',
    displayName: 'Derivative Bloom',
    startThero: 340,
    theroCap: 720,
    theroPerKill: 36,
    passiveTheroPerSecond: 16,
    lives: 7,
    waves: [
      {
        label: 'petal sparks',
        count: 10,
        interval: 1.1,
        hp: 260,
        speed: 0.095,
        reward: 28,
        color: 'rgba(158, 236, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'slope wardens',
        count: 7,
        interval: 1.4,
        hp: 380,
        speed: 0.11,
        reward: 38,
        color: 'rgba(255, 165, 240, 0.93)',
        codexId: 'divisor',
      },
      {
        label: 'turning sentries',
        count: 6,
        interval: 1.9,
        hp: 580,
        speed: 0.12,
        reward: 52,
        color: 'rgba(255, 214, 160, 0.96)',
        codexId: 'prime',
      },
      {
        label: 'critical blooms',
        count: 4,
        interval: 2.4,
        hp: 860,
        speed: 0.135,
        reward: 68,
        color: 'rgba(255, 136, 192, 0.96)',
        codexId: 'reversal',
      },
      {
        label: 'saddle avatars',
        count: 2,
        interval: 3,
        hp: 1280,
        speed: 0.14,
        reward: 86,
        color: 'rgba(206, 255, 188, 0.96)',
        codexId: 'prime',
      },
    ],
    rewardScore: 8.2 * 10 ** 44,
    rewardFlux: 118,
    rewardThero: 78,
    rewardEnergy: 78,
    arcSpeed: 0.3,
    path: [
      { x: 0.08, y: 0.94 },
      { x: 0.18, y: 0.82 },
      { x: 0.28, y: 0.68 },
      { x: 0.38, y: 0.54 },
      { x: 0.5, y: 0.62 },
      { x: 0.6, y: 0.8 },
      { x: 0.72, y: 0.66 },
      { x: 0.82, y: 0.48 },
      { x: 0.9, y: 0.3 },
      { x: 0.96, y: 0.12 },
    ],
    autoAnchors: [
      { x: 0.22, y: 0.78 },
      { x: 0.4, y: 0.58 },
      { x: 0.58, y: 0.74 },
      { x: 0.76, y: 0.52 },
    ],
  };

  // Integral Cascade ramps rewards using trapezoidal approximations of accumulated area.
  const levelSevenConfig = {
    id: 'Corollary - 7',
    displayName: 'Integral Cascade',
    startThero: 380,
    theroCap: 800,
    theroPerKill: 40,
    passiveTheroPerSecond: 18,
    lives: 8,
    waves: [
      {
        label: 'quantized drips',
        count: 11,
        interval: 1.05,
        hp: 300,
        speed: 0.1,
        reward: 32,
        color: 'rgba(162, 240, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'accumulator scouts',
        count: 8,
        interval: 1.35,
        hp: 440,
        speed: 0.115,
        reward: 42,
        color: 'rgba(255, 170, 242, 0.93)',
        codexId: 'divisor',
      },
      {
        label: 'area wardens',
        count: 6,
        interval: 1.8,
        hp: 660,
        speed: 0.125,
        reward: 60,
        color: 'rgba(255, 218, 170, 0.96)',
        codexId: 'prime',
      },
      {
        label: 'leech integrals',
        count: 4,
        interval: 2.3,
        hp: 960,
        speed: 0.14,
        reward: 78,
        color: 'rgba(255, 140, 198, 0.96)',
        codexId: 'reversal',
      },
      {
        label: 'constant phantoms',
        count: 3,
        interval: 2.9,
        hp: 1380,
        speed: 0.145,
        reward: 96,
        color: 'rgba(214, 255, 190, 0.96)',
        codexId: 'prime',
      },
    ],
    rewardScore: 10.1 * 10 ** 44,
    rewardFlux: 136,
    rewardThero: 88,
    rewardEnergy: 88,
    arcSpeed: 0.32,
    path: [
      { x: 0.06, y: 0.92 },
      { x: 0.16, y: 0.78 },
      { x: 0.26, y: 0.66 },
      { x: 0.36, y: 0.74 },
      { x: 0.46, y: 0.58 },
      { x: 0.56, y: 0.44 },
      { x: 0.68, y: 0.5 },
      { x: 0.78, y: 0.68 },
      { x: 0.88, y: 0.5 },
      { x: 0.94, y: 0.28 },
      { x: 0.9, y: 0.12 },
    ],
    autoAnchors: [
      { x: 0.2, y: 0.8 },
      { x: 0.36, y: 0.64 },
      { x: 0.54, y: 0.48 },
      { x: 0.74, y: 0.64 },
    ],
  };

  // Fibonacci lane swaps follow Fₙ proportions, forcing repositioning on golden-ratio beats.
  const levelEightConfig = {
    id: 'Corollary - 8',
    displayName: 'Fibonacci Turnabout',
    startThero: 420,
    theroCap: 880,
    theroPerKill: 44,
    passiveTheroPerSecond: 20,
    lives: 8,
    waves: [
      {
        label: 'spiral runners',
        count: 12,
        interval: 1,
        hp: 340,
        speed: 0.105,
        reward: 36,
        color: 'rgba(168, 242, 255, 0.92)',
        codexId: 'etype',
      },
      {
        label: 'phi drifters',
        count: 9,
        interval: 1.3,
        hp: 500,
        speed: 0.12,
        reward: 48,
        color: 'rgba(255, 176, 244, 0.93)',
        codexId: 'divisor',
      },
      {
        label: 'junction sentries',
        count: 7,
        interval: 1.7,
        hp: 760,
        speed: 0.13,
        reward: 66,
        color: 'rgba(255, 222, 180, 0.96)',
        codexId: 'prime',
      },
      {
        label: 'golden wardens',
        count: 5,
        interval: 2.2,
        hp: 1100,
        speed: 0.145,
        reward: 90,
        color: 'rgba(255, 144, 205, 0.96)',
        codexId: 'reversal',
      },
      {
        label: 'turnabout paragons',
        count: 3,
        interval: 2.8,
        hp: 1640,
        speed: 0.15,
        reward: 110,
        color: 'rgba(222, 255, 196, 0.96)',
        codexId: 'prime',
      },
    ],
    rewardScore: 12.4 * 10 ** 44,
    rewardFlux: 158,
    rewardThero: 98,
    rewardEnergy: 98,
    arcSpeed: 0.34,
    path: [
      { x: 0.08, y: 0.96 },
      { x: 0.18, y: 0.84 },
      { x: 0.3, y: 0.74 },
      { x: 0.38, y: 0.86 },
      { x: 0.48, y: 0.7 },
      { x: 0.6, y: 0.54 },
      { x: 0.72, y: 0.62 },
      { x: 0.82, y: 0.8 },
      { x: 0.9, y: 0.62 },
      { x: 0.96, y: 0.36 },
      { x: 0.92, y: 0.16 },
    ],
    autoAnchors: [
      { x: 0.22, y: 0.82 },
      { x: 0.4, y: 0.72 },
      { x: 0.58, y: 0.56 },
      { x: 0.78, y: 0.7 },
    ],
  };

  const levelConfigs = new Map(
    [
      firstLevelConfig,
      levelTwoConfig,
      levelThreeConfig,
      levelFourConfig,
      levelFiveConfig,
      levelSixConfig,
      levelSevenConfig,
      levelEightConfig,
    ].map((config) => [config.id, config]),
  );

  const idleLevelConfigs = new Map();

  levelBlueprints.forEach((level, index) => {
    if (levelConfigs.has(level.id)) {
      return;
    }

    const levelNumber = index + 1;
    const runDuration = 90 + levelNumber * 12;
    const rewardMultiplier = 1 + levelNumber * 0.08;

    const rewardScore =
      baseResources.scoreRate * (runDuration / 12) * rewardMultiplier;
    const rewardFlux = 45 + levelNumber * 10;
    const rewardThero = 35 + levelNumber * 8;

    idleLevelConfigs.set(level.id, {
      runDuration,
      rewardScore,
      rewardFlux,
      rewardThero,
      rewardEnergy: rewardThero,
    });
  });

  class PowderSimulation {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.cellSize = Math.max(1, Math.round(options.cellSize || 1));
      this.grainSizes = Array.isArray(options.grainSizes)
        ? options.grainSizes.filter((size) => Number.isFinite(size) && size >= 1)
        : [1, 2, 3];
      if (!this.grainSizes.length) {
        this.grainSizes = [1, 2, 3];
      }
      this.grainSizes.sort((a, b) => a - b);

      this.maxDuneGain = Number.isFinite(options.maxDuneGain)
        ? Math.max(0, options.maxDuneGain)
        : 3;
      this.maxGrainsBase = options.maxGrains && options.maxGrains > 0 ? options.maxGrains : 1600;
      this.maxGrains = this.maxGrainsBase;
      this.baseSpawnInterval = options.baseSpawnInterval && options.baseSpawnInterval > 0
        ? options.baseSpawnInterval
        : 180;

      this.onHeightChange = typeof options.onHeightChange === 'function' ? options.onHeightChange : null;

      this.width = 0;
      this.height = 0;
      this.cols = 0;
      this.rows = 0;
      this.grid = [];
      this.grains = [];
      this.heightInfo = { normalizedHeight: 0, duneGain: 0, largestGrain: 0 };

      this.scrollThreshold = Number.isFinite(options.scrollThreshold)
        ? Math.max(0.2, Math.min(0.95, options.scrollThreshold))
        : 0.75;
      this.scrollOffsetCells = 0;
      this.highestTotalHeightCells = 0;

      this.wallInsetLeftPx = Number.isFinite(options.wallInsetLeft) ? Math.max(0, options.wallInsetLeft) : 0;
      this.wallInsetRightPx = Number.isFinite(options.wallInsetRight) ? Math.max(0, options.wallInsetRight) : 0;
      this.wallInsetLeftCells = 0;
      this.wallInsetRightCells = 0;

      this.spawnTimer = 0;
      this.lastFrame = 0;
      this.loopHandle = null;
      this.running = false;
      this.nextId = 1;
      this.stabilized = true;
      this.flowOffset = 0;

      this.handleFrame = this.handleFrame.bind(this);
      this.handleResize = this.handleResize.bind(this);

      if (this.ctx) {
        this.configureCanvas();
      }
    }

    handleResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }
      const previousRunning = this.running;
      this.configureCanvas();
      if (!previousRunning) {
        this.render();
        this.updateHeightFromGrains(true);
      }
    }

    configureCanvas() {
      if (!this.canvas || !this.ctx) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const attrWidth = Number.parseFloat(this.canvas.getAttribute('width')) || 0;
      const attrHeight = Number.parseFloat(this.canvas.getAttribute('height')) || 0;
      const displayWidth = Math.max(200, this.canvas.clientWidth || attrWidth || 240);
      const displayHeight = Math.max(260, this.canvas.clientHeight || attrHeight || 320);

      this.canvas.width = Math.max(1, Math.floor(displayWidth * ratio));
      this.canvas.height = Math.max(1, Math.floor(displayHeight * ratio));
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(ratio, ratio);

      this.width = displayWidth;
      this.height = displayHeight;
      this.cols = Math.max(4, Math.floor(this.width / this.cellSize));
      this.rows = Math.max(4, Math.floor(this.height / this.cellSize));

      const dynamicCapacity = Math.floor((this.cols * this.rows) / 3);
      this.maxGrains = Math.max(this.maxGrainsBase, dynamicCapacity);

      this.wallInsetLeftCells = Math.max(0, Math.round(this.wallInsetLeftPx / this.cellSize));
      this.wallInsetRightCells = Math.max(0, Math.round(this.wallInsetRightPx / this.cellSize));
      const maxInset = Math.max(0, this.cols - 6);
      const insetTotal = this.wallInsetLeftCells + this.wallInsetRightCells;
      if (insetTotal > maxInset && insetTotal > 0) {
        const scale = maxInset / insetTotal;
        this.wallInsetLeftCells = Math.floor(this.wallInsetLeftCells * scale);
        this.wallInsetRightCells = Math.floor(this.wallInsetRightCells * scale);
      }

      this.reset();
    }

    reset() {
      this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
      this.applyWallMask();
      this.grains = [];
      this.spawnTimer = 0;
      this.lastFrame = 0;
      this.scrollOffsetCells = 0;
      this.highestTotalHeightCells = 0;
      this.heightInfo = { normalizedHeight: 0, duneGain: 0, largestGrain: 0 };
      this.notifyHeightChange(this.heightInfo, true);
    }

    applyWallMask() {
      if (!this.grid.length) {
        return;
      }
      const leftBound = Math.min(this.cols, this.wallInsetLeftCells);
      const rightStart = Math.max(leftBound, this.cols - this.wallInsetRightCells);
      for (let row = 0; row < this.grid.length; row += 1) {
        const gridRow = this.grid[row];
        for (let col = 0; col < leftBound; col += 1) {
          gridRow[col] = -1;
        }
        for (let col = rightStart; col < this.cols; col += 1) {
          gridRow[col] = -1;
        }
      }
    }

    clearGridPreserveWalls() {
      if (!this.grid.length) {
        return;
      }
      for (let row = 0; row < this.grid.length; row += 1) {
        const gridRow = this.grid[row];
        for (let col = 0; col < this.cols; col += 1) {
          if (gridRow[col] !== -1) {
            gridRow[col] = 0;
          }
        }
      }
    }

    populateGridFromGrains() {
      if (!this.grid.length) {
        return;
      }
      for (const grain of this.grains) {
        if (grain.freefall) {
          grain.inGrid = false;
          continue;
        }
        if (grain.y >= this.rows || grain.y + grain.size <= 0) {
          grain.inGrid = false;
          continue;
        }
        this.fillCells(grain);
        grain.inGrid = true;
      }
    }

    start() {
      if (!this.ctx || this.running) {
        return;
      }
      this.running = true;
      this.lastFrame = 0;
      this.loopHandle = requestAnimationFrame(this.handleFrame);
      window.addEventListener('resize', this.handleResize);
    }

    stop() {
      if (!this.running) {
        return;
      }
      this.running = false;
      if (this.loopHandle) {
        cancelAnimationFrame(this.loopHandle);
        this.loopHandle = null;
      }
      window.removeEventListener('resize', this.handleResize);
    }

    handleFrame(timestamp) {
      if (!this.running) {
        return;
      }
      if (!this.lastFrame) {
        this.lastFrame = timestamp;
      }
      const delta = Math.min(100, Math.max(0, timestamp - this.lastFrame));
      this.lastFrame = timestamp;
      this.update(delta);
      this.loopHandle = requestAnimationFrame(this.handleFrame);
    }

    update(delta) {
      if (!this.ctx) {
        return;
      }

      this.spawnTimer += delta;
      const spawnInterval = this.getSpawnInterval();
      if (this.spawnTimer >= spawnInterval && this.grains.length < this.maxGrains) {
        this.spawnTimer -= spawnInterval;
        this.spawnGrain();
      }

      const iterations = Math.max(1, Math.min(4, Math.round(delta / 16)));
      for (let i = 0; i < iterations; i += 1) {
        this.updateGrains();
      }

      this.updateHeightFromGrains();
      this.render();
    }

    getSpawnInterval() {
      if (!this.stabilized) {
        return this.baseSpawnInterval * 1.25;
      }
      return this.baseSpawnInterval / Math.max(0.6, 1 + this.flowOffset * 0.45);
    }

    spawnGrain() {
      if (!this.cols || !this.rows) {
        return;
      }
      const size = this.chooseGrainSize();
      const minX = this.wallInsetLeftCells;
      const maxX = Math.max(minX, this.cols - this.wallInsetRightCells - size);
      const center = Math.floor((minX + maxX) / 2);
      const scatter = Math.max(1, Math.floor((maxX - minX) / 6));
      const offset = Math.floor(Math.random() * (scatter * 2 + 1)) - scatter;
      const startX = Math.min(maxX, Math.max(minX, center - Math.floor(size / 2) + offset));

      const grain = {
        id: this.nextId,
        x: startX,
        y: -size,
        size,
        bias: Math.random() < 0.5 ? -1 : 1,
        shade: 195 - size * 5 + Math.floor(Math.random() * 12),
        freefall: !this.stabilized,
        inGrid: false,
        resting: false,
      };

      this.nextId += 1;
      this.grains.push(grain);
    }

    chooseGrainSize() {
      if (this.grainSizes.length === 1) {
        return this.grainSizes[0];
      }
      const weights = this.grainSizes.map((size) => 1 / Math.max(1, size - 1));
      const totalWeight = weights.reduce((sum, value) => sum + value, 0);
      let pick = Math.random() * totalWeight;
      for (let i = 0; i < this.grainSizes.length; i += 1) {
        pick -= weights[i];
        if (pick <= 0) {
          return this.grainSizes[i];
        }
      }
      return this.grainSizes[this.grainSizes.length - 1];
    }

    updateGrains() {
      if (!this.grains.length) {
        return;
      }

      const survivors = [];
      const freefallSpeed = this.stabilized ? 2 : 3;

      this.grains.sort((a, b) => b.y + b.size - (a.y + a.size));

      for (const grain of this.grains) {
        if (!this.stabilized || grain.freefall) {
          grain.freefall = true;
          grain.inGrid = false;
          grain.resting = false;
          grain.y += freefallSpeed;
          if (grain.y * this.cellSize > this.height + grain.size * this.cellSize) {
            continue;
          }
          survivors.push(grain);
          continue;
        }

        if (grain.y < 0) {
          grain.y += 1;
          grain.resting = false;
          survivors.push(grain);
          continue;
        }

        if (grain.inGrid) {
          this.clearCells(grain);
        }

        let moved = false;

        if (this.canPlace(grain.x, grain.y + 1, grain.size)) {
          grain.y += 1;
          moved = true;
        } else {
          const preferred = grain.bias;
          const alternate = -preferred;
          if (this.canPlace(grain.x + preferred, grain.y + 1, grain.size)) {
            grain.x += preferred;
            grain.y += 1;
            moved = true;
          } else if (this.canPlace(grain.x + alternate, grain.y + 1, grain.size)) {
            grain.x += alternate;
            grain.y += 1;
            moved = true;
          } else {
            const slump = this.getSlumpDirection(grain);
            if (slump && this.canPlace(grain.x + slump, grain.y, grain.size)) {
              grain.x += slump;
              moved = true;
            }
          }
        }

        if (grain.y > this.rows - grain.size) {
          grain.y = this.rows - grain.size;
        }

        this.fillCells(grain);
        grain.inGrid = true;
        grain.resting = !moved;
        survivors.push(grain);
      }

      this.grains = survivors;
      this.applyScrollIfNeeded();
    }

    applyScrollIfNeeded() {
      if (!this.grains.length) {
        return;
      }

      const threshold = Math.max(0.2, Math.min(0.95, this.scrollThreshold));
      const targetTopRow = Math.max(0, Math.floor(this.rows * (1 - threshold)));
      if (targetTopRow <= 0) {
        return;
      }

      let highestTop = this.rows;
      for (const grain of this.grains) {
        if (!grain.inGrid || grain.freefall || !grain.resting) {
          continue;
        }
        highestTop = Math.min(highestTop, grain.y);
      }

      if (highestTop >= this.rows || highestTop > targetTopRow) {
        return;
      }

      const shift = Math.max(0, targetTopRow - highestTop);
      if (!shift) {
        return;
      }

      this.scrollOffsetCells += shift;
      this.clearGridPreserveWalls();

      const shifted = [];
      for (const grain of this.grains) {
        grain.y += shift;
        if (grain.y >= this.rows) {
          continue;
        }
        grain.inGrid = false;
        shifted.push(grain);
      }

      this.grains = shifted;
      this.populateGridFromGrains();
    }

    canPlace(x, y, size) {
      if (x < 0 || y < 0 || x + size > this.cols || y + size > this.rows) {
        return false;
      }
      for (let row = 0; row < size; row += 1) {
        const gridRow = this.grid[y + row];
        for (let col = 0; col < size; col += 1) {
          if (gridRow[x + col]) {
            return false;
          }
        }
      }
      return true;
    }

    clearCells(grain) {
      if (!grain.inGrid) {
        return;
      }
      for (let row = 0; row < grain.size; row += 1) {
        const y = grain.y + row;
        if (y < 0 || y >= this.rows) {
          continue;
        }
        const gridRow = this.grid[y];
        for (let col = 0; col < grain.size; col += 1) {
          const x = grain.x + col;
          if (x < 0 || x >= this.cols) {
            continue;
          }
          if (gridRow[x] === grain.id) {
            gridRow[x] = 0;
          }
        }
      }
      grain.inGrid = false;
    }

    fillCells(grain) {
      for (let row = 0; row < grain.size; row += 1) {
        const y = grain.y + row;
        if (y < 0 || y >= this.rows) {
          continue;
        }
        const gridRow = this.grid[y];
        for (let col = 0; col < grain.size; col += 1) {
          const x = grain.x + col;
          if (x < 0 || x >= this.cols) {
            continue;
          }
          gridRow[x] = grain.id;
        }
      }
    }

    getSupportDepth(column, startRow) {
      if (column < 0 || column >= this.cols) {
        return 0;
      }
      let depth = 0;
      for (let row = startRow; row < this.rows; row += 1) {
        if (this.grid[row][column]) {
          break;
        }
        depth += 1;
      }
      return depth;
    }

    getAggregateDepth(startColumn, startRow, size) {
      if (startColumn < 0 || startColumn + size > this.cols) {
        return 0;
      }
      let total = 0;
      for (let offset = 0; offset < size; offset += 1) {
        total += this.getSupportDepth(startColumn + offset, startRow);
      }
      return total / Math.max(1, size);
    }

    getSlumpDirection(grain) {
      const bottom = grain.y + grain.size;
      if (bottom >= this.rows) {
        return 0;
      }

      const leftDepth = this.getAggregateDepth(grain.x - 1, bottom, Math.min(grain.size, this.cols));
      const rightDepth = this.getAggregateDepth(grain.x + grain.size, bottom, Math.min(grain.size, this.cols));

      if (leftDepth > rightDepth + 0.6) {
        return -1;
      }
      if (rightDepth > leftDepth + 0.6) {
        return 1;
      }
      return 0;
    }

    updateHeightFromGrains(force = false) {
      if (!this.rows) {
        return;
      }

      if (!this.grains.length) {
        this.highestTotalHeightCells = Math.max(this.highestTotalHeightCells, this.scrollOffsetCells);
        const totalNormalized = this.scrollOffsetCells / this.rows;
        const info = {
          normalizedHeight: 0,
          duneGain: Math.min(this.maxDuneGain, totalNormalized * this.maxDuneGain),
          largestGrain: 0,
          scrollOffset: this.scrollOffsetCells,
          visibleHeight: 0,
          totalHeight: this.scrollOffsetCells,
          totalNormalized,
          crestPosition: 1,
          rows: this.rows,
          cols: this.cols,
          cellSize: this.cellSize,
          highestNormalized: this.highestTotalHeightCells / this.rows,
        };
        this.notifyHeightChange(info, force);
        return;
      }

      let highestTop = this.rows;
      let largest = 0;
      let restingFound = false;
      for (const grain of this.grains) {
        if (!grain.inGrid || grain.freefall || !grain.resting || grain.y < 0) {
          continue;
        }
        restingFound = true;
        highestTop = Math.min(highestTop, grain.y);
        largest = Math.max(largest, grain.size);
      }

      let visibleHeight = 0;
      let crestPosition = 1;
      if (restingFound && highestTop < this.rows) {
        visibleHeight = Math.max(0, this.rows - highestTop);
        crestPosition = Math.max(0, Math.min(1, highestTop / this.rows));
      }

      const totalHeight = this.scrollOffsetCells + visibleHeight;
      this.highestTotalHeightCells = Math.max(this.highestTotalHeightCells, totalHeight);

      const normalized = Math.min(1, visibleHeight / this.rows);
      const totalNormalized = totalHeight / this.rows;
      const duneGain = Math.min(this.maxDuneGain, totalNormalized * this.maxDuneGain);

      const info = {
        normalizedHeight: normalized,
        duneGain,
        largestGrain: largest,
        scrollOffset: this.scrollOffsetCells,
        visibleHeight,
        totalHeight,
        totalNormalized,
        crestPosition,
        rows: this.rows,
        cols: this.cols,
        cellSize: this.cellSize,
        highestNormalized: this.highestTotalHeightCells / this.rows,
      };

      this.notifyHeightChange(info, force);
    }

    notifyHeightChange(info, force = false) {
      if (!info) {
        return;
      }
      const previous =
        this.heightInfo ||
        {
          normalizedHeight: 0,
          duneGain: 0,
          largestGrain: 0,
          scrollOffset: 0,
          totalHeight: 0,
        };
      const heightDiff = Math.abs(previous.normalizedHeight - info.normalizedHeight);
      const gainDiff = Math.abs(previous.duneGain - info.duneGain);
      const sizeChanged = previous.largestGrain !== info.largestGrain;
      const offsetChanged = previous.scrollOffset !== info.scrollOffset;
      const totalChanged = previous.totalHeight !== info.totalHeight;
      this.heightInfo = info;
      if (
        this.onHeightChange &&
        (force || heightDiff > 0.01 || gainDiff > 0.01 || sizeChanged || offsetChanged || totalChanged)
      ) {
        this.onHeightChange(info);
      }
    }

    render() {
      if (!this.ctx) {
        return;
      }

      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, '#0f1018');
      gradient.addColorStop(1, '#171a27');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.fillRect(0, 0, 2, this.height);
      this.ctx.fillRect(this.width - 2, 0, 2, this.height);
      this.ctx.fillRect(0, this.height - 2, this.width, 2);

      const cellSizePx = this.cellSize;
      for (const grain of this.grains) {
        const px = grain.x * cellSizePx;
        const py = grain.y * cellSizePx;
        const sizePx = grain.size * cellSizePx;

        if (py >= this.height || px >= this.width || py + sizePx <= 0) {
          continue;
        }

        const alpha = grain.freefall ? 0.55 : 0.9;
        let fillColor = `rgba(216, 216, 216, ${alpha})`;

        if (grain.size <= 2) {
          const warmAlpha = grain.size === 1 ? alpha : alpha * 0.95;
          fillColor = `rgba(255, 222, 89, ${warmAlpha})`;
        } else if (grain.size >= 4) {
          const coolTone = 190 - Math.min(40, grain.size * 6);
          fillColor = `rgba(${coolTone}, ${coolTone}, ${coolTone}, ${alpha})`;
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(px, py, sizePx, sizePx);
      }
    }

    setFlowOffset(offset) {
      const normalized = Number.isFinite(offset) ? Math.max(0, offset) : 0;
      const stabilized = normalized > 0;
      this.flowOffset = normalized;

      if (stabilized === this.stabilized) {
        this.stabilized = stabilized;
        if (!stabilized) {
          this.releaseAllGrains();
        }
        return;
      }

      this.stabilized = stabilized;
      if (!this.stabilized) {
        this.releaseAllGrains();
      }
    }

    releaseAllGrains() {
      this.clearGridPreserveWalls();
      this.grains.forEach((grain) => {
        grain.freefall = true;
        grain.inGrid = false;
        grain.resting = false;
      });
      this.scrollOffsetCells = 0;
      this.highestTotalHeightCells = 0;
      this.updateHeightFromGrains(true);
    }

    getStatus() {
      return this.heightInfo;
    }
  }

  class SimplePlayfield {
    constructor(options) {
      this.canvas = options.canvas || null;
      this.container = options.container || null;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.messageEl = options.messageEl || null;
      this.waveEl = options.waveEl || null;
      this.healthEl = options.healthEl || null;
      this.energyEl = options.energyEl || null;
      this.progressEl = options.progressEl || null;
      this.startButton = options.startButton || null;
      this.speedButton = options.speedButton || null;
      this.autoAnchorButton = options.autoAnchorButton || null;
      this.autoWaveCheckbox = options.autoWaveCheckbox || null;
      this.speedMultipliers =
        Array.isArray(options.speedMultipliers) && options.speedMultipliers.length
          ? options.speedMultipliers.slice()
          : [1, 1.5, 2, 3];
      this.speedIndex = 0;
      this.speedMultiplier = this.speedMultipliers[this.speedIndex];
      this.slotButtons = Array.isArray(options.slotButtons) ? options.slotButtons : [];
      this.onVictory = typeof options.onVictory === 'function' ? options.onVictory : null;
      this.onDefeat = typeof options.onDefeat === 'function' ? options.onDefeat : null;
      this.onCombatStart =
        typeof options.onCombatStart === 'function' ? options.onCombatStart : null;
      this.audio = options.audioManager || options.audio || null;

      this.levelConfig = null;
      this.levelActive = false;
      this.shouldAnimate = false;
      this.combatActive = false;
      this.resolvedOutcome = null;

      this.renderWidth = this.canvas ? this.canvas.clientWidth : 0;
      this.renderHeight = this.canvas ? this.canvas.clientHeight : 0;
      this.pixelRatio = 1;

      this.arcOffset = 0;
      this.energy = 0;
      this.lives = 0;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;
      this.baseWaveCount = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.isEndlessMode = false;
      this.endlessCycle = 0;
      this.initialSpawnDelay = 0;
      this.autoWaveEnabled = true;
      this.autoStartLeadTime = 5;
      this.autoStartTimer = null;
      this.autoStartDeadline = 0;

      this.pathSegments = [];
      this.pathLength = 0;

      this.slots = new Map();
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.availableTowers = [];
      this.draggingTowerType = null;
      this.dragPreviewOffset = { x: 0, y: -34 };

      this.animationId = null;
      this.lastTimestamp = 0;

      this.resizeObserver = null;
      this.resizeHandler = () => this.syncCanvasSize();

      this.towerIdCounter = 0;
      this.hoverPlacement = null;
      this.hoverEnemy = null;
      this.pointerPosition = null;
      this.anchorTolerance = 0.06;

      this.pointerMoveHandler = (event) => this.handleCanvasPointerMove(event);
      this.pointerLeaveHandler = () => this.handleCanvasPointerLeave();
      this.pointerClickHandler = (event) => this.handleCanvasClick(event);

      this.enemyTooltip = null;
      this.enemyTooltipNameEl = null;
      this.enemyTooltipHpEl = null;

      this.registerSlots();
      this.bindStartButton();
      this.bindSpeedButton();
      this.bindAutoAnchorButton();
      this.bindAutoWaveCheckbox();
      this.attachResizeObservers();
      this.attachCanvasInteractions();
      this.createEnemyTooltip();

      this.disableSlots(true);
      this.updateHud();
      this.updateProgress();
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }

    registerSlots() {
      this.slotButtons.forEach((button) => {
        const slotId = button.dataset.slotId;
        const x = Number.parseFloat(button.dataset.slotX);
        const y = Number.parseFloat(button.dataset.slotY);
        if (!slotId || Number.isNaN(x) || Number.isNaN(y)) {
          return;
        }
        const slot = {
          id: slotId,
          button,
          normalized: { x, y },
          tower: null,
        };
        this.slots.set(slotId, slot);
        button.addEventListener('click', () => this.handleSlotInteraction(slot));
        button.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleSlotInteraction(slot);
          }
        });
      });
    }

    setAvailableTowers(towerIds = []) {
      if (Array.isArray(towerIds)) {
        this.availableTowers = towerIds.filter(
          (towerId) => getTowerDefinition(towerId) && isTowerUnlocked(towerId),
        );
      } else {
        this.availableTowers = [];
      }
      refreshTowerLoadoutDisplay();
    }

    getActiveTowerCount(towerId) {
      if (!towerId || !Array.isArray(this.towers)) {
        return 0;
      }
      let count = 0;
      for (let index = 0; index < this.towers.length; index += 1) {
        if (this.towers[index]?.type === towerId) {
          count += 1;
        }
      }
      return count;
    }

    getCurrentTowerCost(towerId) {
      const definition = getTowerDefinition(towerId);
      if (!definition) {
        return Number.POSITIVE_INFINITY;
      }
      const activeCount = this.getActiveTowerCount(towerId);
      const exponent = 1 + Math.max(0, activeCount);
      return definition.baseCost ** exponent;
    }

    setDraggingTower(towerId) {
      this.draggingTowerType = towerId;
    }

    finishTowerDrag() {
      this.draggingTowerType = null;
    }

    previewTowerPlacement(normalized, { towerType, dragging = false } = {}) {
      if (!normalized || !towerType) {
        this.clearPlacementPreview();
        return;
      }
      this.updatePlacementPreview(normalized, { towerType, dragging });
    }

    completeTowerPlacement(normalized, { towerType } = {}) {
      if (!towerType) {
        this.clearPlacementPreview();
        return false;
      }

      let targetNormalized = normalized ? { ...normalized } : null;
      if (
        this.hoverPlacement &&
        this.hoverPlacement.towerType === towerType &&
        this.hoverPlacement.dragging &&
        this.hoverPlacement.normalized
      ) {
        targetNormalized = { ...this.hoverPlacement.normalized };
      }

      if (!targetNormalized) {
        this.clearPlacementPreview();
        return false;
      }

      const placed = this.addTowerAt(targetNormalized, { towerType });
      if (placed) {
        this.clearPlacementPreview();
      }
      return placed;
    }

    bindStartButton() {
      if (!this.startButton) {
        return;
      }
      this.startButton.addEventListener('click', () => this.handleStartButton());
    }

    bindSpeedButton() {
      if (!this.speedButton) {
        return;
      }
      this.speedButton.addEventListener('click', () => {
        if (this.audio) {
          this.audio.unlock();
        }
        if (!this.isInteractiveLevelActive()) {
          if (this.messageEl) {
            this.messageEl.textContent =
              'Enter an interactive level to adjust the simulation speed.';
          }
          return;
        }
        this.cycleSpeedMultiplier();
        if (this.audio) {
          this.audio.playSfx('uiToggle');
        }
      });
    }

    bindAutoAnchorButton() {
      if (!this.autoAnchorButton) {
        return;
      }
      this.autoAnchorButton.addEventListener('click', () => {
        if (this.audio) {
          this.audio.unlock();
        }
        if (!this.isInteractiveLevelActive()) {
          if (this.messageEl) {
            this.messageEl.textContent =
              'Enter an interactive level to auto-lattice recommended anchors.';
          }
          return;
        }
        this.autoAnchorTowers();
      });
    }

    bindAutoWaveCheckbox() {
      if (!this.autoWaveCheckbox) {
        return;
      }
      this.autoWaveCheckbox.checked = this.autoWaveEnabled;
      this.autoWaveCheckbox.disabled = true;
      this.autoWaveCheckbox.addEventListener('change', () => {
        if (!this.autoWaveCheckbox) {
          return;
        }
        this.autoWaveEnabled = this.autoWaveCheckbox.checked;
        if (!this.levelActive || !this.levelConfig || this.combatActive) {
          if (!this.autoWaveEnabled) {
            this.cancelAutoStart();
          }
          return;
        }
        if (this.autoWaveEnabled) {
          this.scheduleAutoStart({ delay: this.autoStartLeadTime });
        } else {
          this.cancelAutoStart();
          if (this.messageEl) {
            this.messageEl.textContent =
              'Auto-start disabled—commence waves when your lattice is ready.';
          }
        }
      });
    }

    scheduleAutoStart(options = {}) {
      if (
        !this.autoWaveEnabled ||
        !this.levelActive ||
        !this.levelConfig ||
        this.combatActive
      ) {
        return;
      }
      const delay = Number.isFinite(options.delay)
        ? Math.max(0, options.delay)
        : this.autoStartLeadTime;
      this.cancelAutoStart();
      if (typeof window === 'undefined') {
        return;
      }
      this.autoStartDeadline = Date.now() + delay * 1000;
      this.autoStartTimer = window.setTimeout(() => {
        this.autoStartTimer = null;
        this.tryAutoStart();
      }, delay * 1000);
    }

    cancelAutoStart() {
      if (this.autoStartTimer) {
        clearTimeout(this.autoStartTimer);
        this.autoStartTimer = null;
      }
      this.autoStartDeadline = 0;
    }

    tryAutoStart() {
      if (
        !this.autoWaveEnabled ||
        !this.levelActive ||
        !this.levelConfig ||
        this.combatActive
      ) {
        return;
      }
      if (!this.towers.length) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Awaiting lattice placements—auto-start resumes once towers are in place.';
        }
        this.scheduleAutoStart({ delay: 1.5 });
        return;
      }
      this.autoStartDeadline = 0;
      this.handleStartButton();
    }

    attachResizeObservers() {
      if (!this.canvas) {
        return;
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.resizeHandler);
      }
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
        this.resizeObserver.observe(this.canvas);
      }
      this.syncCanvasSize();
    }

    attachCanvasInteractions() {
      if (!this.canvas) {
        return;
      }
      this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
      this.canvas.addEventListener('pointerleave', this.pointerLeaveHandler);
      this.canvas.addEventListener('click', this.pointerClickHandler);
    }

    createEnemyTooltip() {
      if (!this.container || this.enemyTooltip) {
        return;
      }

      const tooltip = document.createElement('div');
      tooltip.className = 'enemy-tooltip';

      const nameEl = document.createElement('div');
      nameEl.className = 'enemy-tooltip-name';

      const hpEl = document.createElement('div');
      hpEl.className = 'enemy-tooltip-hp';

      tooltip.append(nameEl, hpEl);
      tooltip.setAttribute('aria-hidden', 'true');

      this.container.appendChild(tooltip);
      this.enemyTooltip = tooltip;
      this.enemyTooltipNameEl = nameEl;
      this.enemyTooltipHpEl = hpEl;
    }

    syncCanvasSize() {
      if (!this.canvas || !this.ctx) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.renderWidth = rect.width || 1;
      this.renderHeight = rect.height || 1;
      this.pixelRatio = ratio;

      this.buildPathGeometry();
      this.updateTowerPositions();
      this.draw();
    }

    buildPathGeometry() {
      if (!this.levelConfig || !this.levelConfig.path || !this.ctx) {
        this.pathSegments = [];
        this.pathLength = 0;
        return;
      }

      const points = this.levelConfig.path.map((node) => ({
        x: node.x * this.renderWidth,
        y: node.y * this.renderHeight,
      }));

      const segments = [];
      let totalLength = 0;
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        segments.push({ start, end, length });
        totalLength += length;
      }

      this.pathSegments = segments;
      this.pathLength = totalLength || 1;
    }

    ensureLoop() {
      if (this.animationId || !this.shouldAnimate) {
        return;
      }
      this.animationId = requestAnimationFrame((timestamp) => this.tick(timestamp));
    }

    stopLoop() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.lastTimestamp = 0;
    }

    tick(timestamp) {
      if (!this.shouldAnimate) {
        this.animationId = null;
        this.lastTimestamp = 0;
        return;
      }

      const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
      this.lastTimestamp = timestamp;

      const safeDelta = Math.min(delta, 0.12);
      this.update(safeDelta);
      this.draw();

      this.animationId = requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
    }

    enterLevel(level, options = {}) {
      if (!this.container) {
        return;
      }

      const levelId = level?.id;
      const config = levelId ? levelConfigs.get(levelId) : null;
      const isInteractive = Boolean(config);
      const endlessMode = Boolean(options.endlessMode);

      if (this.audio) {
        const track = isInteractive ? 'preparation' : 'menu';
        this.audio.playMusic(track, { restart: isInteractive });
      }

      this.cancelAutoStart();

      if (!isInteractive) {
        this.levelActive = false;
        this.levelConfig = null;
        this.combatActive = false;
        this.shouldAnimate = false;
        this.isEndlessMode = false;
        this.endlessCycle = 0;
        this.baseWaveCount = 0;
        this.currentWaveNumber = 1;
        this.maxWaveReached = 0;
        this.stopLoop();
        this.disableSlots(true);
        this.enemies = [];
        this.projectiles = [];
        this.towers = [];
        this.energy = 0;
        this.lives = 0;
        if (this.autoWaveCheckbox) {
          this.autoWaveCheckbox.checked = this.autoWaveEnabled;
          this.autoWaveCheckbox.disabled = true;
        }
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.messageEl) {
          this.messageEl.textContent = 'This level preview is not interactive yet.';
        }
        if (this.waveEl) this.waveEl.textContent = '—';
        if (this.healthEl) this.healthEl.textContent = '—';
        if (this.energyEl) this.energyEl.textContent = '—';
        if (this.progressEl) {
          this.progressEl.textContent = 'Select an unlocked level to battle.';
        }
        if (this.startButton) {
          this.startButton.textContent = 'Preview Only';
          this.startButton.disabled = true;
        }
        this.updateSpeedButton();
        this.updateAutoAnchorButton();
        cancelTowerDrag();
        return;
      }

      const clonedConfig = {
        ...config,
        waves: config.waves.map((wave) => ({ ...wave })),
        path: config.path.map((node) => ({ ...node })),
        autoAnchors: Array.isArray(config.autoAnchors)
          ? config.autoAnchors.map((anchor) => ({ ...anchor }))
          : [],
      };

      this.levelActive = true;
      this.levelConfig = clonedConfig;
      this.baseWaveCount = clonedConfig.waves.length;
      this.isEndlessMode = endlessMode;
      this.endlessCycle = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.setAvailableTowers(towerLoadoutState.selected);
      this.shouldAnimate = true;
      this.resetState();
      this.enableSlots();
      this.syncCanvasSize();
      this.ensureLoop();

      if (this.startButton) {
        this.startButton.textContent = 'Commence Wave';
        this.startButton.disabled = false;
      }
      if (this.autoWaveCheckbox) {
        this.autoWaveCheckbox.disabled = false;
        this.autoWaveCheckbox.checked = this.autoWaveEnabled;
      }
      if (this.messageEl) {
        this.messageEl.textContent = this.isEndlessMode
          ? 'Endless defense unlocked—survive as the waves loop.'
          : 'Drag glyph chips from your loadout anywhere on the plane—no fixed anchors required.';
      }
      if (this.progressEl) {
        this.progressEl.textContent = this.isEndlessMode
          ? 'Waves loop infinitely. Each completed cycle multiplies enemy strength ×10.'
          : 'Wave prep underway.';
      }
      if (this.autoWaveEnabled) {
        this.scheduleAutoStart({ delay: this.autoStartLeadTime });
      }
      this.updateHud();
      this.updateProgress();
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }

    leaveLevel() {
      if (this.audio) {
        this.audio.playMusic('menu');
      }
      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.cancelAutoStart();
      this.stopLoop();
      this.disableSlots(true);
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.hoverPlacement = null;
      this.energy = 0;
      this.lives = 0;
      this.resolvedOutcome = null;
      this.arcOffset = 0;
      this.isEndlessMode = false;
      this.endlessCycle = 0;
      this.baseWaveCount = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.setAvailableTowers([]);
      cancelTowerDrag();
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      if (this.messageEl) {
        this.messageEl.textContent = 'Select a level to command the defense.';
      }
      if (this.waveEl) this.waveEl.textContent = '—';
      if (this.healthEl) this.healthEl.textContent = '—';
      if (this.energyEl) this.energyEl.textContent = '—';
      if (this.progressEl) this.progressEl.textContent = 'No active level.';
      if (this.startButton) {
        this.startButton.textContent = 'Commence Wave';
        this.startButton.disabled = true;
      }
      if (this.autoWaveCheckbox) {
        this.autoWaveCheckbox.checked = this.autoWaveEnabled;
        this.autoWaveCheckbox.disabled = true;
      }
      this.updateSpeedButton();
      this.updateAutoAnchorButton();
    }

    resetState() {
      if (!this.levelConfig) {
        this.energy = 0;
        this.lives = 0;
      } else {
        this.energy = this.levelConfig.startThero || 0;
        this.lives = this.levelConfig.lives;
      }
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;
      this.towerIdCounter = 0;
      this.arcOffset = 0;
      this.combatActive = false;
      this.resolvedOutcome = null;
      this.endlessCycle = 0;
      this.currentWaveNumber = 1;
      this.maxWaveReached = 0;
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.hoverPlacement = null;
      this.slots.forEach((slot) => {
        slot.tower = null;
        if (slot.button) {
          slot.button.classList.remove('tower-built');
          slot.button.setAttribute('aria-pressed', 'false');
        }
      });
      this.updateTowerPositions();
      this.updateHud();
      this.updateProgress();
      if (this.startButton) {
        this.startButton.disabled = !this.levelConfig;
      }
      this.updateAutoAnchorButton();
      this.updateSpeedButton();
      refreshTowerLoadoutDisplay();
    }

    enableSlots() {
      this.slots.forEach((slot) => {
        if (slot.button) {
          slot.button.disabled = false;
        }
      });
    }

    disableSlots(clear = false) {
      this.slots.forEach((slot) => {
        if (!slot.button) {
          return;
        }
        slot.button.disabled = true;
        if (clear) {
          slot.tower = null;
          slot.button.classList.remove('tower-built');
          slot.button.setAttribute('aria-pressed', 'false');
        }
      });
    }

    isInteractiveLevelActive() {
      return Boolean(
        this.levelActive && this.levelConfig && levelConfigs.has(this.levelConfig.id),
      );
    }

    formatSpeedMultiplier(value) {
      if (Number.isInteger(value)) {
        return String(value);
      }
      const formatted = value.toFixed(1);
      return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
    }

    cycleSpeedMultiplier() {
      if (!this.speedMultipliers.length) {
        return;
      }
      this.speedIndex = (this.speedIndex + 1) % this.speedMultipliers.length;
      this.speedMultiplier = this.speedMultipliers[this.speedIndex];
      this.updateSpeedButton();
      if (this.messageEl) {
        this.messageEl.textContent = `Simulation speed set to ×${this.formatSpeedMultiplier(
          this.speedMultiplier,
        )}.`;
      }
    }

    updateSpeedButton() {
      if (!this.speedButton) {
        return;
      }
      const label = this.formatSpeedMultiplier(this.speedMultiplier);
      this.speedButton.textContent = `Speed ×${label}`;
      const interactive = this.isInteractiveLevelActive();
      this.speedButton.disabled = !interactive;
      this.speedButton.setAttribute('aria-disabled', interactive ? 'false' : 'true');
      this.speedButton.title = interactive
        ? 'Cycle the manual defense speed multiplier.'
        : 'Simulation speed adjusts during the interactive defense.';
    }

    getAutoAnchorStatus() {
      const anchors = Array.isArray(this.levelConfig?.autoAnchors)
        ? this.levelConfig.autoAnchors
        : [];
      if (!anchors.length) {
        return { total: 0, placed: 0 };
      }
      const tolerance = this.anchorTolerance;
      let placed = 0;
      anchors.forEach((anchor) => {
        const occupied = this.towers.some((tower) => {
          const dx = tower.normalized.x - anchor.x;
          const dy = tower.normalized.y - anchor.y;
          return Math.hypot(dx, dy) <= tolerance;
        });
        if (occupied) {
          placed += 1;
        }
      });
      return { total: anchors.length, placed };
    }

    updateAutoAnchorButton() {
      if (!this.autoAnchorButton) {
        return;
      }

      this.autoAnchorButton.textContent = 'Loadout Placement';
      this.autoAnchorButton.disabled = true;
      this.autoAnchorButton.setAttribute('aria-disabled', 'true');
      this.autoAnchorButton.title = 'Drag towers from the loadout to lattice them on the field.';
    }

    autoAnchorTowers() {
      if (!this.isInteractiveLevelActive()) {
        return;
      }
      const anchors = Array.isArray(this.levelConfig?.autoAnchors)
        ? this.levelConfig.autoAnchors
        : [];
      if (!anchors.length) {
        if (this.messageEl) {
          this.messageEl.textContent = 'No auto-lattice anchors configured for this level yet.';
        }
        return;
      }

      const tolerance = this.anchorTolerance;
      let placed = 0;
      let insufficientEnergy = false;

      for (const anchor of anchors) {
        const occupied = this.towers.some((tower) => {
          const dx = tower.normalized.x - anchor.x;
          const dy = tower.normalized.y - anchor.y;
          return Math.hypot(dx, dy) <= tolerance;
        });
        if (occupied) {
          continue;
        }
        if (this.energy < this.levelConfig.towerCost) {
          insufficientEnergy = true;
          break;
        }
        const success = this.addTowerAt(anchor, { silent: true });
        if (success) {
          placed += 1;
        }
      }

      const { total, placed: nowPlaced } = this.getAutoAnchorStatus();
      const remaining = Math.max(0, total - nowPlaced);

      notifyAutoAnchorUsed(nowPlaced, total);

      if (this.audio && placed > 0) {
        this.audio.playSfx('towerPlace');
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Auto-lattice is disabled—drag towers from the loadout instead.';
      }
    }

    updateTowerPositions() {
      if (!this.levelConfig) {
        return;
      }
      this.towers.forEach((tower) => {
        const { x, y } = this.getCanvasPosition(tower.normalized);
        tower.x = x;
        tower.y = y;
        const definition = getTowerDefinition(tower.type) || tower.definition;
        const rangeFactor = definition ? definition.range : 0.24;
        tower.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      });
      if (this.hoverPlacement) {
        this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
        const definition = getTowerDefinition(this.hoverPlacement.towerType);
        const rangeFactor = definition ? definition.range : 0.24;
        this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      }
    }

    handleCanvasPointerMove(event) {
      if (!this.levelActive || !this.levelConfig) {
        this.clearPlacementPreview();
        this.pointerPosition = null;
        this.clearEnemyHover();
        return;
      }

      const normalized = this.getNormalizedFromEvent(event);
      if (!normalized) {
        this.clearPlacementPreview();
        this.pointerPosition = null;
        this.clearEnemyHover();
        return;
      }

      this.pointerPosition = normalized;
      const position = this.getCanvasPosition(normalized);
      const hoveredEnemy = this.findEnemyAt(position);
      if (hoveredEnemy) {
        this.setEnemyHover(hoveredEnemy.enemy);
      } else {
        this.clearEnemyHover();
      }
      const hoveredTower = this.findTowerAt(position);
      if (!this.draggingTowerType && hoveredTower) {
        this.hoverPlacement = {
          normalized: { ...hoveredTower.normalized },
          position: { x: hoveredTower.x, y: hoveredTower.y },
          range: hoveredTower.range,
          valid: false,
          target: hoveredTower,
          towerType: hoveredTower.type,
          reason: 'Select to release lattice.',
        };
        if (!this.shouldAnimate) {
          this.draw();
        }
        return;
      }

      const activeType = this.draggingTowerType;
      if (activeType) {
        this.updatePlacementPreview(normalized, {
          towerType: activeType,
          dragging: Boolean(this.draggingTowerType),
        });
      } else {
        this.clearPlacementPreview();
      }

      if (!this.shouldAnimate) {
        this.draw();
      }
    }

    updatePlacementPreview(normalized, options = {}) {
      const { towerType, dragging = false } = options;
      if (!towerType || !normalized) {
        this.hoverPlacement = null;
        return;
      }

      const definition = getTowerDefinition(towerType);
      let placementNormalized = { ...normalized };
      const pointerPosition = this.getCanvasPosition(normalized);

      if (dragging) {
        const offsetX = this.dragPreviewOffset?.x || 0;
        const offsetY = this.dragPreviewOffset?.y || 0;
        const adjustedPosition = {
          x: pointerPosition.x + offsetX,
          y: pointerPosition.y + offsetY,
        };
        const adjustedNormalized = this.getNormalizedFromCanvasPosition(adjustedPosition);
        if (adjustedNormalized) {
          placementNormalized = adjustedNormalized;
        }
      }

      let position = this.getCanvasPosition(placementNormalized);
      const existing = this.findTowerAt(position);
      const merging = Boolean(existing && existing.type === towerType);
      const nextId = merging ? getNextTowerId(towerType) : null;
      const nextDefinition = nextId ? getTowerDefinition(nextId) : null;

      if (merging && existing) {
        position = { x: existing.x, y: existing.y };
        const mergeNormalized = this.getNormalizedFromCanvasPosition(position);
        if (mergeNormalized) {
          placementNormalized = mergeNormalized;
        }
      }

      const validation = merging
        ? { valid: Boolean(nextDefinition), reason: nextDefinition ? '' : 'Peak tier reached.' }
        : this.validatePlacement(placementNormalized, { allowPathOverlap: false });

      if (!merging && validation.position) {
        position = validation.position;
      }

      const baseCost = this.getCurrentTowerCost(towerType);
      const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
      const actionCost = merging ? Math.max(baseCost, mergeCost) : baseCost;
      const hasFunds = this.energy >= actionCost;

      let valid = validation.valid && hasFunds;
      let reason = '';
      const formattedCost = Math.round(actionCost);
      if (!validation.valid) {
        reason = validation.reason || 'Maintain clearance from the glyph lane.';
      } else if (!hasFunds) {
        const deficit = Math.ceil(actionCost - this.energy);
        if (merging && nextDefinition) {
          reason = `Need ${deficit} Th to merge into ${nextDefinition.symbol}.`;
        } else if (definition) {
          reason = `Need ${deficit} Th to lattice ${definition.symbol}.`;
        } else {
          reason = `Need ${deficit} Th for this lattice.`;
        }
      } else if (merging && nextDefinition) {
        reason = `Merge into ${nextDefinition.symbol} for ${formattedCost} Th.`;
      } else if (definition) {
        reason = `Anchor ${definition.symbol} for ${formattedCost} Th.`;
      }

      const rangeFactor = definition ? definition.range : 0.24;
      this.hoverPlacement = {
        normalized: { ...placementNormalized },
        position,
        range: Math.min(this.renderWidth, this.renderHeight) * rangeFactor,
        valid,
        reason,
        towerType,
        dragging,
        mergeTarget: merging ? existing : null,
        merge: merging,
        cost: actionCost,
        symbol: definition?.symbol || '·',
      };
    }

    handleCanvasPointerLeave() {
      this.pointerPosition = null;
      this.clearPlacementPreview();
      this.clearEnemyHover();
    }

    handleCanvasClick(event) {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig) {
        return;
      }

      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      const normalized = this.getNormalizedFromEvent(event);
      if (!normalized) {
        return;
      }

      const position = this.getCanvasPosition(normalized);
      const tower = this.findTowerAt(position);
      if (tower) {
        this.sellTower(tower);
        return;
      }
    }

    clearPlacementPreview() {
      if (!this.hoverPlacement) {
        return;
      }
      this.hoverPlacement = null;
      if (!this.shouldAnimate) {
        this.draw();
      }
    }

    clearEnemyHover() {
      this.hoverEnemy = null;
      if (this.enemyTooltip) {
        this.enemyTooltip.dataset.visible = 'false';
        this.enemyTooltip.setAttribute('aria-hidden', 'true');
      }
    }

    getNormalizedFromEvent(event) {
      if (!this.canvas) {
        return null;
      }
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width || this.renderWidth;
      const height = rect.height || this.renderHeight;
      if (!width || !height) {
        return null;
      }
      const x = (event.clientX - rect.left) / width;
      const y = (event.clientY - rect.top) / height;
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return null;
      }
      const clamp = (value) => Math.min(Math.max(value, 0.04), 0.96);
      return { x: clamp(x), y: clamp(y) };
    }

    findTowerAt(position) {
      const hitRadius = Math.max(18, Math.min(this.renderWidth, this.renderHeight) * 0.045);
      for (let index = this.towers.length - 1; index >= 0; index -= 1) {
        const tower = this.towers[index];
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= hitRadius) {
          return tower;
        }
      }
      return null;
    }

    getEnemyHitRadius() {
      return Math.max(16, Math.min(this.renderWidth, this.renderHeight) * 0.05);
    }

    findEnemyAt(position) {
      if (!this.enemies.length) {
        return null;
      }
      const hitRadius = this.getEnemyHitRadius();
      for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = this.enemies[index];
        const enemyPosition = this.getPointAlongPath(enemy.progress);
        const distance = Math.hypot(position.x - enemyPosition.x, position.y - enemyPosition.y);
        if (distance <= hitRadius) {
          return { enemy, position: enemyPosition };
        }
      }
      return null;
    }

    setEnemyHover(enemy) {
      if (!enemy) {
        this.clearEnemyHover();
        return;
      }
      this.hoverEnemy = { enemyId: enemy.id };
      this.renderEnemyTooltip(enemy);
    }

    renderEnemyTooltip(enemy) {
      if (!this.enemyTooltip || !this.pointerPosition) {
        this.clearEnemyHover();
        return;
      }

      const pointerCanvas = this.getCanvasPosition(this.pointerPosition);
      const enemyPosition = this.getPointAlongPath(enemy.progress);
      const distance = Math.hypot(pointerCanvas.x - enemyPosition.x, pointerCanvas.y - enemyPosition.y);
      if (distance > this.getEnemyHitRadius()) {
        this.clearEnemyHover();
        return;
      }

      if (this.enemyTooltipNameEl) {
        this.enemyTooltipNameEl.textContent = enemy.label || 'Glyph';
      }
      if (this.enemyTooltipHpEl) {
        this.enemyTooltipHpEl.textContent = `Total HP: ${formatGameNumber(enemy.maxHp)}`;
      }

      const xPercent = this.renderWidth ? (enemyPosition.x / this.renderWidth) * 100 : 0;
      const yPercent = this.renderHeight ? (enemyPosition.y / this.renderHeight) * 100 : 0;

      this.enemyTooltip.style.left = `${xPercent}%`;
      this.enemyTooltip.style.top = `${yPercent}%`;
      this.enemyTooltip.dataset.visible = 'true';
      this.enemyTooltip.setAttribute('aria-hidden', 'false');
    }

    updateEnemyTooltipPosition() {
      if (!this.hoverEnemy) {
        return;
      }

      const enemy = this.enemies.find((candidate) => candidate.id === this.hoverEnemy.enemyId);
      if (!enemy || !this.pointerPosition) {
        this.clearEnemyHover();
        return;
      }

      this.renderEnemyTooltip(enemy);
    }

    addTowerAt(normalized, options = {}) {
      if (!this.levelConfig || !normalized) {
        return false;
      }

      const {
        slot = null,
        allowPathOverlap = false,
        silent = false,
        towerType = null,
      } = options;

      const selectedType = towerType || this.draggingTowerType || this.availableTowers[0];
      const definition = getTowerDefinition(selectedType);
      if (!definition) {
        if (this.messageEl && !silent) {
          this.messageEl.textContent = 'Select a tower from your loadout to lattice it.';
        }
        return false;
      }

      if (!this.availableTowers.includes(selectedType)) {
        if (this.messageEl && !silent) {
          this.messageEl.textContent = `${definition.symbol} is not prepared in your loadout.`;
        }
        return false;
      }

      const canvasPosition = this.getCanvasPosition(normalized);
      const existingTower = this.findTowerAt(canvasPosition);
      let placement = { valid: true, position: canvasPosition };
      let mergeTarget = null;
      let nextDefinition = null;
      let merging = false;

      if (existingTower && existingTower.type === selectedType) {
        const nextId = getNextTowerId(selectedType);
        if (!nextId) {
          if (this.messageEl && !silent) {
            this.messageEl.textContent = `${definition.symbol} already resonates at its peak tier.`;
          }
          return false;
        }
        nextDefinition = getTowerDefinition(nextId);
        mergeTarget = existingTower;
        merging = true;
        placement.position = { x: mergeTarget.x, y: mergeTarget.y };
      } else {
        placement = this.validatePlacement(normalized, { allowPathOverlap });
        if (!placement.valid) {
          if (this.messageEl && placement.reason && !silent) {
            this.messageEl.textContent = placement.reason;
          }
          return false;
        }
      }

      if (!isTowerUnlocked(selectedType)) {
        unlockTower(selectedType, { silent: true });
      }

      const baseCost = this.getCurrentTowerCost(selectedType);
      const mergeCost = nextDefinition ? this.getCurrentTowerCost(nextDefinition.id) : 0;
      const actionCost = merging ? Math.max(baseCost, mergeCost) : baseCost;

      if (this.energy < actionCost) {
        const needed = Math.ceil(actionCost - this.energy);
        if (this.messageEl && !silent) {
          this.messageEl.textContent = `Need ${needed} Th more to lattice ${definition.symbol}.`;
        }
        return false;
      }

      this.energy = Math.max(0, this.energy - actionCost);

      if (merging && mergeTarget && nextDefinition) {
        const range = Math.min(this.renderWidth, this.renderHeight) * nextDefinition.range;
        mergeTarget.type = nextDefinition.id;
        mergeTarget.definition = nextDefinition;
        mergeTarget.symbol = nextDefinition.symbol;
        mergeTarget.tier = nextDefinition.tier;
        mergeTarget.damage = nextDefinition.damage;
        mergeTarget.rate = nextDefinition.rate;
        mergeTarget.range = range;
        mergeTarget.cooldown = 0;
        const newlyUnlocked = !isTowerUnlocked(nextDefinition.id)
          ? unlockTower(nextDefinition.id, { silent: true })
          : false;
        if (this.messageEl && !silent) {
          const unlockNote = newlyUnlocked ? ` ${nextDefinition.symbol} is now available in your loadout.` : '';
          this.messageEl.textContent = `${definition.symbol} lattices fused into ${nextDefinition.symbol}.${unlockNote}`;
        }
        notifyTowerPlaced(this.towers.length);
        this.updateTowerPositions();
        this.updateHud();
        this.draw();
        refreshTowerLoadoutDisplay();
        updateStatusDisplays();
        return true;
      }

      const range = Math.min(this.renderWidth, this.renderHeight) * definition.range;
      const tower = {
        id: `tower-${(this.towerIdCounter += 1)}`,
        type: selectedType,
        definition,
        symbol: definition.symbol,
        tier: definition.tier,
        normalized: { ...normalized },
        x: placement.position.x,
        y: placement.position.y,
        range,
        damage: definition.damage,
        rate: definition.rate,
        cooldown: 0,
        slot,
      };

      this.towers.push(tower);
      notifyTowerPlaced(this.towers.length);

      if (slot) {
        slot.tower = tower;
        if (slot.button) {
          slot.button.classList.add('tower-built');
          slot.button.setAttribute('aria-pressed', 'true');
        }
      }

      this.hoverPlacement = null;
      if (this.messageEl && !silent) {
        this.messageEl.textContent = `${definition.symbol} lattice anchored—harmonics align.`;
      }
      this.updateHud();
      this.draw();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
      if (this.audio && !silent) {
        this.audio.playSfx('towerPlace');
      }
      return true;
    }

    sellTower(tower, { slot } = {}) {
      if (!tower) {
        return;
      }

      const index = this.towers.indexOf(tower);
      if (index >= 0) {
        this.towers.splice(index, 1);
      }

      const resolvedSlot = slot || tower.slot || null;
      if (resolvedSlot) {
        resolvedSlot.tower = null;
        if (resolvedSlot.button) {
          resolvedSlot.button.classList.remove('tower-built');
          resolvedSlot.button.setAttribute('aria-pressed', 'false');
        }
      }

      if (this.levelConfig) {
        const definition = getTowerDefinition(tower.type);
        const baseRefund = definition ? definition.baseCost : this.getCurrentTowerCost(tower.type);
        const refund = Math.round(baseRefund * 0.5);
        const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
        this.energy = Math.min(cap, this.energy + refund);
        if (this.messageEl) {
          this.messageEl.textContent = `Lattice released—refunded ${refund} Th.`;
        }
      }

      this.updateHud();
      this.draw();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
      if (this.audio) {
        this.audio.playSfx('towerSell');
      }
    }

    validatePlacement(normalized, options = {}) {
      const { allowPathOverlap = false } = options;
      if (!this.levelConfig) {
        return { valid: false, reason: 'Activate a level first.' };
      }

      const position = this.getCanvasPosition(normalized);
      const minDimension = Math.min(this.renderWidth, this.renderHeight) || 1;
      const minSpacing = minDimension * 0.12;

      for (let index = 0; index < this.towers.length; index += 1) {
        const tower = this.towers[index];
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance < minSpacing) {
          return { valid: false, reason: 'Too close to another lattice.', position };
        }
      }

      if (!allowPathOverlap) {
        const pathBuffer = minDimension * 0.06;
        const clearance = this.getDistanceToPath(position);
        if (clearance < pathBuffer) {
          return { valid: false, reason: 'Maintain clearance from the glyph lane.', position };
        }
      }

      return { valid: true, position };
    }

    getDistanceToPath(point) {
      if (!this.pathSegments.length) {
        return Infinity;
      }

      let shortest = Infinity;
      for (let index = 0; index < this.pathSegments.length; index += 1) {
        const segment = this.pathSegments[index];
        const distance = this.distancePointToSegment(point, segment.start, segment.end);
        if (distance < shortest) {
          shortest = distance;
        }
      }
      return shortest;
    }

    distancePointToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
      }
      const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
      const clampedT = Math.max(0, Math.min(1, t));
      const projX = start.x + clampedT * dx;
      const projY = start.y + clampedT * dy;
      return Math.hypot(point.x - projX, point.y - projY);
    }

    handleSlotInteraction(slot) {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Select an unlocked defense, then etch α lattices directly onto the canvas.';
        }
        return;
      }

      if (slot.tower) {
        this.sellTower(slot.tower, { slot });
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Drag a tower chip from the loadout to lattice it here.';
      }
    }

    placeTower(slot) {
      this.addTowerAt(slot?.normalized || null, { slot, allowPathOverlap: true });
    }

    removeTower(slot) {
      this.sellTower(slot?.tower || null, { slot });
    }

    handleStartButton() {
      if (this.audio) {
        this.audio.unlock();
      }
      if (!this.levelActive || !this.levelConfig || this.combatActive) {
        return;
      }
      if (!this.towers.length) {
        if (this.messageEl) {
          this.messageEl.textContent = 'Anchor at least one tower before commencing.';
        }
        return;
      }

      if (this.audio) {
        this.audio.playSfx('uiConfirm');
        this.audio.playMusic('combat', { restart: true });
      }

      this.cancelAutoStart();
      this.combatActive = true;
      this.resolvedOutcome = null;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.enemyIdCounter = 0;
      this.enemies = [];
      this.projectiles = [];
      this.activeWave = this.createWaveState(this.levelConfig.waves[0], { initialWave: true });
      this.lives = this.levelConfig.lives;
      this.markWaveStart();

      if (this.startButton) {
        this.startButton.disabled = true;
        this.startButton.textContent = 'Wave Running';
      }
      if (this.messageEl) {
        this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label} advance.`;
      }
      this.updateHud();
      this.updateProgress();

      if (this.onCombatStart) {
        this.onCombatStart(this.levelConfig.id);
      }
    }

    getCycleMultiplier() {
      return this.isEndlessMode ? 10 ** this.endlessCycle : 1;
    }

    computeWaveNumber(index = this.waveIndex) {
      if (!this.levelConfig) {
        return 0;
      }
      const total = this.baseWaveCount || this.levelConfig.waves.length || 0;
      if (!this.isEndlessMode) {
        return index + 1;
      }
      return this.endlessCycle * total + index + 1;
    }

    markWaveStart() {
      const waveNumber = this.computeWaveNumber();
      this.currentWaveNumber = waveNumber > 0 ? waveNumber : 1;
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
    }

    createWaveState(config, options = {}) {
      if (!config) {
        return null;
      }
      const { initialWave = false } = options;
      const multiplier = this.getCycleMultiplier();
      const scaledHp = Number.isFinite(config.hp) ? config.hp * multiplier : config.hp;
      const scaledSpeed = Number.isFinite(config.speed) ? config.speed * multiplier : config.speed;
      const scaledReward = Number.isFinite(config.reward)
        ? config.reward * multiplier
        : config.reward;
      return {
        config: {
          ...config,
          hp: scaledHp,
          speed: scaledSpeed,
          reward: scaledReward,
        },
        spawned: 0,
        nextSpawn: initialWave ? this.initialSpawnDelay : 0,
        multiplier,
      };
    }

    update(delta) {
      if (!this.levelActive || !this.levelConfig) {
        return;
      }

      const speedDelta = delta * this.speedMultiplier;

      const arcSpeed = this.levelConfig?.arcSpeed ?? 0.2;
      const pathLength = this.pathLength || 1;
      this.arcOffset -= arcSpeed * speedDelta * pathLength;
      const wrapDistance = pathLength * 1000;
      if (this.arcOffset <= -wrapDistance) {
        this.arcOffset += wrapDistance;
      }

      if (!this.combatActive) {
        const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
        const passiveRate = this.levelConfig.passiveTheroPerSecond ?? 0;
        this.energy = Math.min(cap, this.energy + passiveRate * speedDelta);
        this.updateHud();
        this.updateProgress();
        return;
      }

      this.waveTimer += speedDelta;
      this.spawnEnemies();
      this.updateTowers(speedDelta);
      this.updateEnemies(speedDelta);
      this.updateProjectiles(speedDelta);
      this.updateProgress();
      this.updateHud();
    }

    spawnEnemies() {
      if (!this.activeWave || !this.levelConfig) {
        return;
      }

      const { config } = this.activeWave;
      if (!config) {
        return;
      }

      while (
        this.activeWave.spawned < config.count &&
        this.waveTimer >= this.activeWave.nextSpawn
      ) {
        const enemy = {
          id: this.enemyIdCounter += 1,
          progress: 0,
          hp: config.hp,
          maxHp: config.hp,
          speed: config.speed,
          reward: config.reward,
          color: config.color,
          label: config.label,
          typeId: config.codexId || null,
        };
        this.enemies.push(enemy);
        this.activeWave.spawned += 1;
        this.activeWave.nextSpawn += config.interval;
        if (config.codexId) {
          registerEnemyEncounter(config.codexId);
        }
      }
    }

    updateTowers(delta) {
      this.towers.forEach((tower) => {
        tower.cooldown = Math.max(0, tower.cooldown - delta);
        if (!this.combatActive || !this.enemies.length) {
          return;
        }
        if (tower.cooldown > 0) {
          return;
        }
        const targetInfo = this.findTarget(tower);
        if (!targetInfo) {
          return;
        }
        tower.cooldown = 1 / tower.rate;
        this.fireAtTarget(tower, targetInfo);
      });
    }

    findTarget(tower) {
      let selected = null;
      let bestProgress = -Infinity;
      this.enemies.forEach((enemy) => {
        const position = this.getPointAlongPath(enemy.progress);
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= tower.range && enemy.progress > bestProgress) {
          selected = { enemy, position };
          bestProgress = enemy.progress;
        }
      });
      return selected;
    }

    fireAtTarget(tower, targetInfo) {
      const { enemy } = targetInfo;
      enemy.hp -= tower.damage;
      this.projectiles.push({
        source: { x: tower.x, y: tower.y },
        targetId: enemy.id,
        target: this.getPointAlongPath(enemy.progress),
        lifetime: 0,
        maxLifetime: 0.24,
      });

      if (this.audio) {
        this.audio.playSfx('alphaTowerFire');
      }

      if (enemy.hp <= 0) {
        this.processEnemyDefeat(enemy);
      }
    }

    updateEnemies(delta) {
      for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = this.enemies[index];
        enemy.progress += enemy.speed * delta;
        if (enemy.progress >= 1) {
          this.enemies.splice(index, 1);
          this.handleEnemyBreach(enemy);
        }
      }

      if (
        this.combatActive &&
        this.activeWave &&
        this.activeWave.spawned >= this.activeWave.config.count &&
        !this.enemies.length
      ) {
        this.advanceWave();
      }
    }

    updateProjectiles(delta) {
      for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = this.projectiles[index];
        projectile.lifetime += delta;
        if (projectile.lifetime >= projectile.maxLifetime) {
          this.projectiles.splice(index, 1);
        }
      }
    }

    advanceWave() {
      if (!this.levelConfig) {
        return;
      }

      if (this.waveIndex + 1 >= this.levelConfig.waves.length) {
        if (this.isEndlessMode) {
          this.endlessCycle += 1;
          this.waveIndex = 0;
          this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
          this.waveTimer = 0;
          this.markWaveStart();
          if (this.messageEl) {
            this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${
              this.activeWave.config.label
            }.`;
          }
          this.updateHud();
          this.updateProgress();
          return;
        }
        this.handleVictory();
        return;
      }

      this.waveIndex += 1;
      this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
      this.waveTimer = 0;
      this.markWaveStart();
      if (this.messageEl) {
        this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label}.`;
      }
      this.updateHud();
      this.updateProgress();
    }

    handleEnemyBreach(enemy) {
      this.lives = Math.max(0, this.lives - 1);
      if (this.audio) {
        this.audio.playSfx('enemyBreach');
      }
      if (this.messageEl) {
        this.messageEl.textContent = `${enemy.label || 'Glyph'} breached the core!`;
      }
      if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
        this.clearEnemyHover();
      }
      if (this.lives <= 0) {
        this.handleDefeat();
      }
      this.updateHud();
      this.updateProgress();
    }

    processEnemyDefeat(enemy) {
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) {
        this.enemies.splice(index, 1);
      }
      if (this.hoverEnemy && this.hoverEnemy.enemyId === enemy.id) {
        this.clearEnemyHover();
      }

      const baseGain =
        (this.levelConfig?.theroPerKill ?? this.levelConfig?.energyPerKill ?? 0) +
        (enemy.reward || 0);
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      this.energy = Math.min(cap, this.energy + baseGain);

      if (this.messageEl) {
        this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${Math.round(
          baseGain,
        )} Th.`;
      }
      this.updateHud();
      this.updateProgress();
      updateStatusDisplays();

      if (this.audio) {
        this.audio.playSfx('enemyDefeat');
      }

      notifyEnemyDefeated();
    }

    handleVictory() {
      if (this.resolvedOutcome === 'victory') {
        return;
      }
      if (this.audio) {
        this.audio.playSfx('victory');
        this.audio.playMusic('preparation', { restart: true });
      }
      this.combatActive = false;
      this.resolvedOutcome = 'victory';
      this.activeWave = null;
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      const reward = this.levelConfig.rewardThero ?? this.levelConfig.rewardEnergy ?? 0;
      this.energy = Math.min(cap, this.energy + reward);
      this.currentWaveNumber = this.baseWaveCount || this.currentWaveNumber;
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Run Again';
      }
      if (this.messageEl) {
        const title = this.levelConfig.displayName || 'Defense';
        this.messageEl.textContent = `Victory! ${title} is sealed.`;
      }
      this.updateHud();
      this.updateProgress();
      if (this.onVictory) {
        this.onVictory(this.levelConfig.id, {
          rewardScore: this.levelConfig.rewardScore,
          rewardFlux: this.levelConfig.rewardFlux,
          rewardThero: reward,
          rewardEnergy: this.levelConfig.rewardEnergy,
          towers: this.towers.length,
          lives: this.lives,
          maxWave: this.maxWaveReached,
        });
      }
      updateStatusDisplays();
    }

    handleDefeat() {
      if (this.resolvedOutcome === 'defeat') {
        return;
      }
      if (this.audio) {
        this.audio.playSfx('defeat');
        this.audio.playMusic('preparation', { restart: true });
      }
      this.combatActive = false;
      this.resolvedOutcome = 'defeat';
      this.activeWave = null;
      const cap = this.levelConfig.theroCap ?? this.levelConfig.energyCap ?? Infinity;
      const baseline = this.levelConfig.startThero ?? this.levelConfig.startEnergy ?? 0;
      this.energy = Math.min(cap, Math.max(this.energy, baseline));
      this.maxWaveReached = Math.max(this.maxWaveReached, this.currentWaveNumber);
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Retry Wave';
      }
      if (this.messageEl) {
        const waveLabel = this.maxWaveReached > 0 ? ` at wave ${this.maxWaveReached}` : '';
        this.messageEl.textContent = `Defense collapsed${waveLabel}—recalibrate the anchors and retry.`;
      }
      this.updateHud();
      this.updateProgress();
      updateStatusDisplays();
      if (this.onDefeat) {
        this.onDefeat(this.levelConfig.id, {
          towers: this.towers.length,
          maxWave: this.maxWaveReached,
        });
      }
    }

    updateHud() {
      if (this.waveEl) {
        if (!this.levelConfig) {
          this.waveEl.textContent = '—';
        } else {
          if (this.isEndlessMode) {
            const displayWave = this.combatActive
              ? this.currentWaveNumber
              : Math.max(1, this.currentWaveNumber || 1);
            this.waveEl.textContent = `Wave ${displayWave}`;
          } else {
            const total = this.levelConfig.waves.length;
            const displayWave = this.combatActive
              ? this.waveIndex + 1
              : Math.min(this.waveIndex + 1, total);
            this.waveEl.textContent = `${displayWave}/${total}`;
          }
        }
      }

      if (this.healthEl) {
        this.healthEl.textContent = this.levelConfig
          ? `${this.lives}/${this.levelConfig.lives}`
          : '—';
      }

      if (this.energyEl) {
        this.energyEl.textContent = this.levelConfig
          ? `${Math.round(this.energy)} Th`
          : '—';
      }

      this.updateSpeedButton();
      this.updateAutoAnchorButton();
      refreshTowerLoadoutDisplay();
      updateStatusDisplays();
    }

    updateProgress() {
      if (!this.progressEl) {
        return;
      }

      if (!this.levelConfig) {
        this.progressEl.textContent = 'No active level.';
        return;
      }

      if (!this.combatActive) {
        if (this.resolvedOutcome === 'victory') {
          const title = this.levelConfig.displayName || 'Defense';
          this.progressEl.textContent = `${title} stabilized—victory sealed.`;
        } else if (this.resolvedOutcome === 'defeat') {
          const waveNote = this.maxWaveReached > 0 ? ` Reached wave ${this.maxWaveReached}.` : '';
          this.progressEl.textContent = `Defense collapsed—rebuild the proof lattice.${waveNote}`;
        } else {
          const remainingMs =
            this.autoWaveEnabled && this.autoStartDeadline
              ? this.autoStartDeadline - Date.now()
              : 0;
          if (remainingMs > 0) {
            const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
            const intro = this.isEndlessMode ? 'Endless mode primed' : 'Wave prep underway';
            this.progressEl.textContent = `${intro}—auto-start in ${seconds}s.`;
          } else {
            this.progressEl.textContent = this.isEndlessMode
              ? 'Endless mode primed—auto-start will trigger after preparations.'
              : 'Wave prep underway.';
          }
        }
        return;
      }

      const total = this.levelConfig.waves.length;
      const remainingInWave = this.activeWave
        ? Math.max(0, this.activeWave.config.count - this.activeWave.spawned)
        : 0;
      const remaining = remainingInWave + this.enemies.length;
      const label = this.levelConfig.waves[this.waveIndex]?.label || 'glyphs';
      if (this.isEndlessMode) {
        this.progressEl.textContent = `Wave ${this.currentWaveNumber} — ${remaining} ${label} remaining.`;
      } else {
        const current = Math.min(this.waveIndex + 1, total);
        this.progressEl.textContent = `Wave ${current}/${total} — ${remaining} ${label} remaining.`;
      }
    }

    getCanvasPosition(normalized) {
      return {
        x: normalized.x * this.renderWidth,
        y: normalized.y * this.renderHeight,
      };
    }

    getNormalizedFromCanvasPosition(position) {
      if (!position || !this.canvas) {
        return null;
      }
      const width = this.renderWidth || this.canvas.width || 1;
      const height = this.renderHeight || this.canvas.height || 1;
      if (!width || !height) {
        return null;
      }
      const clamp = (value) => Math.min(Math.max(value, 0.04), 0.96);
      const x = clamp(position.x / width);
      const y = clamp(position.y / height);
      return { x, y };
    }

    getPointAlongPath(progress) {
      if (!this.pathSegments.length) {
        return { x: 0, y: 0 };
      }

      const target = Math.min(progress, 1) * this.pathLength;
      let traversed = 0;

      for (let index = 0; index < this.pathSegments.length; index += 1) {
        const segment = this.pathSegments[index];
        if (traversed + segment.length >= target) {
          const ratio = segment.length > 0 ? (target - traversed) / segment.length : 0;
          return {
            x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
            y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
          };
        }
        traversed += segment.length;
      }

      const lastSegment = this.pathSegments[this.pathSegments.length - 1];
      return lastSegment ? { ...lastSegment.end } : { x: 0, y: 0 };
    }

    draw() {
      if (!this.ctx) {
        return;
      }
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

      this.drawPath();
      this.drawArcLight();
      this.drawNodes();
      this.drawPlacementPreview();
      this.drawTowers();
      this.drawEnemies();
      this.drawProjectiles();
      this.updateEnemyTooltipPosition();
    }

    drawPath() {
      if (!this.ctx || !this.pathSegments.length) {
        return;
      }
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
      ctx.moveTo(this.pathSegments[0].start.x, this.pathSegments[0].start.y);
      this.pathSegments.forEach((segment) => {
        ctx.lineTo(segment.end.x, segment.end.y);
      });
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.pathSegments[0].start.x, this.pathSegments[0].start.y);
      this.pathSegments.forEach((segment) => {
        ctx.lineTo(segment.end.x, segment.end.y);
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 125, 235, 0.6)';
      ctx.stroke();
    }

    drawArcLight() {
      if (!this.ctx || !this.pathSegments.length) {
        return;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.7)';
      ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.16]);
      ctx.lineDashOffset = this.arcOffset;
      ctx.moveTo(this.pathSegments[0].start.x, this.pathSegments[0].start.y);
      this.pathSegments.forEach((segment) => {
        ctx.lineTo(segment.end.x, segment.end.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    drawNodes() {
      if (!this.ctx || !this.pathSegments.length) {
        return;
      }
      const ctx = this.ctx;
      const start = this.pathSegments[0].start;
      const end = this.pathSegments[this.pathSegments.length - 1].end;
      ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(start.x, start.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 228, 120, 0.9)';
      ctx.beginPath();
      ctx.arc(end.x, end.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTowers() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      this.towers.forEach((tower) => {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
        ctx.lineWidth = 3;
        ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(8, 9, 14, 0.9)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 10, 0, Math.PI * 2);
        ctx.fill();

        if (tower.symbol) {
          ctx.fillStyle = 'rgba(255, 228, 120, 0.85)';
          ctx.font = '18px "Cormorant Garamond", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tower.symbol, tower.x, tower.y);
        }

        if (!this.combatActive) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(139, 247, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    drawPlacementPreview() {
      if (!this.ctx || !this.hoverPlacement || !this.levelConfig) {
        return;
      }
      const { position, range, valid, dragging, symbol } = this.hoverPlacement;
      const ctx = this.ctx;
      const stroke = valid ? 'rgba(139, 247, 255, 0.7)' : 'rgba(120, 132, 150, 0.6)';
      const fill = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(120, 132, 150, 0.1)';

      const drawX = position.x;
      const drawY = position.y;

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const previewRange = range || Math.min(this.renderWidth, this.renderHeight) * 0.24;
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(position.x, position.y, previewRange, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 18, 0, Math.PI * 2);
      ctx.fill();

      if (symbol) {
        ctx.fillStyle = valid ? 'rgba(255, 228, 120, 0.85)' : 'rgba(190, 190, 200, 0.75)';
        ctx.font = `${dragging ? 20 : 18}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, drawX, drawY);
      }

      if (typeof this.hoverPlacement.cost === 'number') {
        ctx.font = '12px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = valid ? 'rgba(139, 247, 255, 0.75)' : 'rgba(160, 160, 168, 0.6)';
        ctx.fillText(`${Math.round(this.hoverPlacement.cost)} Th`, drawX, drawY + 20);
      }
      ctx.restore();
    }

    drawEnemies() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      this.enemies.forEach((enemy) => {
        const position = this.getPointAlongPath(enemy.progress);
        ctx.beginPath();
        ctx.fillStyle = enemy.color || 'rgba(139, 247, 255, 0.9)';
        ctx.arc(position.x, position.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        ctx.arc(
          position.x,
          position.y,
          12,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * ratio,
        );
        ctx.stroke();
      });
    }

    drawProjectiles() {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      this.projectiles.forEach((projectile) => {
        const enemy = this.enemies.find((candidate) => candidate.id === projectile.targetId);
        if (enemy) {
          projectile.target = this.getPointAlongPath(enemy.progress);
        }
        const target = projectile.target || projectile.source;
        const alpha = Math.max(0, 1 - projectile.lifetime / projectile.maxLifetime);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(projectile.source.x, projectile.source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  }

  function beginIdleLevelRun(level) {
    if (!level || isInteractiveLevel(level.id)) {
      return;
    }

    const config = idleLevelConfigs.get(level.id);
    if (!config) {
      return;
    }

    if (!idleLevelRuns.has(level.id)) {
      idleLevelRuns.set(level.id, {
        levelId: level.id,
        duration: config.runDuration,
        durationMs: config.runDuration * 1000,
        rewardScore: config.rewardScore,
        rewardFlux: config.rewardFlux,
        rewardEnergy: config.rewardEnergy,
        startTime: null,
        progress: 0,
        remainingMs: config.runDuration * 1000,
      });
    }

    updateIdleLevelDisplay();
  }

  function stopIdleLevelRun(levelId) {
    const runner = idleLevelRuns.get(levelId);
    if (!runner) {
      return;
    }

    idleLevelRuns.delete(levelId);

    const state = levelState.get(levelId);
    if (state) {
      levelState.set(levelId, { ...state, running: false });
    }

    if (levelId === activeLevelId && !isInteractiveLevel(levelId)) {
      updateIdleLevelDisplay();
    }
  }

  function stopAllIdleRuns(exceptId) {
    const levelIds = Array.from(idleLevelRuns.keys());
    levelIds.forEach((levelId) => {
      if (levelId === exceptId) {
        return;
      }
      stopIdleLevelRun(levelId);
    });
  }

  function completeIdleLevelRun(levelId, runner) {
    if (!levelId || isInteractiveLevel(levelId)) {
      return;
    }

    const stats = {
      rewardScore: runner.rewardScore,
      rewardFlux: runner.rewardFlux,
      rewardEnergy: runner.rewardEnergy,
      runDuration: runner.duration,
    };

    handlePlayfieldVictory(levelId, stats);

    if (activeLevelId === levelId) {
      updateIdleLevelDisplay();
    }
  }

  function updateIdleRuns(timestamp) {
    if (!idleLevelRuns.size) {
      if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
        updateIdleLevelDisplay();
      }
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : 0;

    idleLevelRuns.forEach((runner, levelId) => {
      if (runner.startTime === null) {
        runner.startTime = now;
      }

      const elapsed = Math.max(0, now - runner.startTime);
      const total = Math.max(1, runner.durationMs);
      const clampedElapsed = Math.min(elapsed, total);

      runner.progress = clampedElapsed / total;
      runner.remainingMs = Math.max(0, total - clampedElapsed);

      if (elapsed >= total) {
        idleLevelRuns.delete(levelId);
        runner.progress = 1;
        runner.remainingMs = 0;
        completeIdleLevelRun(levelId, runner);
      }
    });

    updateLevelCards();

    if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
      updateIdleLevelDisplay(idleLevelRuns.get(activeLevelId) || null);
    }
  }

  function updateIdleLevelDisplay(activeRunner = null) {
    if (!activeLevelId || isInteractiveLevel(activeLevelId)) {
      return;
    }

    if (!playfieldElements.message || !playfieldElements.progress) {
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId) || {};
    const runner = activeRunner || idleLevelRuns.get(activeLevelId) || null;

    if (!level) {
      return;
    }

    if (runner) {
      const remainingSeconds = Math.ceil(runner.remainingMs / 1000);
      const percent = Math.min(100, Math.max(0, Math.round(runner.progress * 100)));
      playfieldElements.message.textContent = `${level.title} auto-sim running—sigils recalibrating.`;
      playfieldElements.progress.textContent = `Simulation progress: ${percent}% · ${remainingSeconds}s remaining.`;
    } else if (state.running) {
      playfieldElements.message.textContent = `${level.title} is initializing—automated glyphs mobilizing.`;
      playfieldElements.progress.textContent = 'Auto-run preparing to deploy.';
    } else if (state.completed) {
      playfieldElements.message.textContent = `${level.title} sealed—auto-run rewards claimed.`;
      playfieldElements.progress.textContent = 'Simulation complete. Re-enter to rerun the proof.';
    } else {
      playfieldElements.message.textContent = 'Tap the highlighted overlay to begin this automated defense.';
      playfieldElements.progress.textContent = 'Awaiting confirmation.';
    }

    if (playfieldElements.wave) {
      playfieldElements.wave.textContent = '—';
    }
    if (playfieldElements.health) {
      playfieldElements.health.textContent = '—';
    }
    if (playfieldElements.energy) {
      playfieldElements.energy.textContent = '—';
    }

    if (playfieldElements.startButton) {
      if (runner || state.running) {
        playfieldElements.startButton.textContent = runner
          ? 'Auto-run Active'
          : 'Auto-run Initializing';
      } else {
        playfieldElements.startButton.textContent = 'Preview Only';
      }
      playfieldElements.startButton.disabled = true;
    }
  }

  function handlePlayfieldCombatStart(levelId) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: false,
      running: false,
      completed: false,
    };
    const updated = { ...existing, entered: true, running: true };
    levelState.set(levelId, updated);
    activeLevelId = levelId;
    resourceState.running = true;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldVictory(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const alreadyCompleted = Boolean(existing.completed);
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: true,
      bestWave,
      lastResult: { outcome: 'victory', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;

    notifyLevelVictory(levelId);

    if (!alreadyCompleted) {
      if (typeof stats.rewardScore === 'number') {
        resourceState.score += stats.rewardScore;
      }
      if (typeof stats.rewardFlux === 'number') {
        baseResources.fluxRate += stats.rewardFlux;
      }
      if (typeof stats.rewardEnergy === 'number') {
        baseResources.energyRate += stats.rewardEnergy;
      }
      unlockNextInteractiveLevel(levelId);
      updateResourceRates();
      updatePowderLedger();
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldDefeat(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: existing.completed,
      bestWave,
      lastResult: { outcome: 'defeat', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
  }

  const tabHotkeys = new Map([
    ['1', 'tower'],
    ['2', 'towers'],
    ['3', 'powder'],
    ['4', 'achievements'],
    ['5', 'options'],
  ]);

  function isTextInput(element) {
    if (!element) return false;
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    return (
      element.isContentEditable ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select'
    );
  }

  function setActiveTab(target) {
    if (!tabs.length || !panels.length) return;

    let matchedTab = false;

    tabs.forEach((tab, index) => {
      const isActive = tab.dataset.tab === target;
      if (isActive) {
        tab.classList.add('active');
        tab.setAttribute('aria-pressed', 'true');
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');
        activeTabIndex = index;
        matchedTab = true;
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-pressed', 'false');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === target;
      if (isActive) {
        panel.classList.add('active');
        panel.setAttribute('aria-hidden', 'false');
        panel.removeAttribute('hidden');
      } else {
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('hidden', '');
      }
    });

    if (matchedTab && target === 'tower') {
      updateActiveLevelBanner();
    }
  }

  function focusAndActivateTab(index) {
    if (!tabs.length) return;
    const normalizedIndex = ((index % tabs.length) + tabs.length) % tabs.length;
    const targetTab = tabs[normalizedIndex];
    if (!targetTab) return;
    setActiveTab(targetTab.dataset.tab);
    targetTab.focus();
  }

  function buildLevelCards() {
    if (!levelGrid) return;
    const fragment = document.createDocumentFragment();

    levelBlueprints.forEach((level) => {
      const card = document.createElement('article');
      card.className = 'level-card';
      card.dataset.level = level.id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `${level.id}: ${level.title}`);
      card.innerHTML = `
        <header>
          <span class="level-id">${level.id}</span>
          <h3>${level.title}</h3>
        </header>
        <p class="level-path"><strong>Path:</strong> ${level.path}</p>
        <p class="level-hazard"><strong>Focus:</strong> ${level.focus}</p>
        <p class="level-status-pill">New</p>
        <dl class="level-metrics">
          <div>
            <dt>Mode</dt>
            <dd class="level-mode">—</dd>
          </div>
          <div>
            <dt>Run Length</dt>
            <dd class="level-duration">—</dd>
          </div>
          <div>
            <dt>Rewards</dt>
            <dd class="level-rewards">—</dd>
          </div>
        </dl>
        <p class="level-last-result">No attempts recorded.</p>
      `;
      card.addEventListener('click', () => handleLevelSelection(level));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleLevelSelection(level);
        }
      });
      fragment.append(card);
    });

    levelGrid.append(fragment);
  }

  function handleLevelSelection(level) {
    const state = levelState.get(level.id) || { entered: false, running: false };
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.focus === 'function') {
      lastLevelTrigger = activeElement;
    } else {
      lastLevelTrigger = null;
    }

    if (!isLevelUnlocked(level.id)) {
      const requirementId = getPreviousInteractiveLevelId(level.id);
      const requirement = requirementId ? levelLookup.get(requirementId) : null;
      const requirementLabel = requirement
        ? `${requirement.id} · ${requirement.title}`
        : 'the preceding defense';
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock ${level.id}.`;
      }
      lastLevelTrigger = null;
      return;
    }

    const otherActiveId = activeLevelId && activeLevelId !== level.id ? activeLevelId : null;
    const otherActiveState = otherActiveId ? levelState.get(otherActiveId) : null;
    const requiresExitConfirm = Boolean(
      otherActiveId && (otherActiveState?.running || otherActiveState?.entered),
    );

    if (!state.entered || requiresExitConfirm) {
      pendingLevel = level;
      showLevelOverlay(level, { requireExitConfirm: requiresExitConfirm, exitLevelId: otherActiveId });
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function showLevelOverlay(level, options = {}) {
    if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
    const { requireExitConfirm = false, exitLevelId = null } = options;
    overlayRequiresLevelExit = Boolean(requireExitConfirm);
    overlayLabel.textContent = level.id;
    overlayTitle.textContent = level.title;
    overlayExample.textContent = level.example;
    const summary = getLevelSummary(level);
    if (overlayMode) {
      overlayMode.textContent = summary.mode;
    }
    if (overlayDuration) {
      overlayDuration.textContent = summary.duration;
    }
    if (overlayRewards) {
      overlayRewards.textContent = summary.rewards;
    }
    if (overlayLast) {
      const state = levelState.get(level.id) || null;
      const runner = idleLevelRuns.get(level.id) || null;
      overlayLast.textContent = describeLevelLastResult(level, state, runner);
    }
    if (overlayInstruction) {
      if (overlayRequiresLevelExit) {
        const exitLevel = exitLevelId ? levelLookup.get(exitLevelId) : levelLookup.get(activeLevelId);
        const exitLabel = exitLevel ? `${exitLevel.id} · ${exitLevel.title}` : 'the active level';
        overlayInstruction.textContent = `Entering will abandon ${exitLabel}. Tap to confirm.`;
      } else {
        overlayInstruction.textContent = overlayInstructionDefault;
      }
    }
    if (overlay) {
      if (overlayRequiresLevelExit) {
        overlay.setAttribute('data-overlay-mode', 'warning');
      } else {
        overlay.removeAttribute('data-overlay-mode');
      }
    }
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus();
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  }

  function hideLevelOverlay() {
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlayRequiresLevelExit = false;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }
    if (overlay) {
      overlay.removeAttribute('data-overlay-mode');
    }
  }

  function cancelPendingLevel() {
    pendingLevel = null;
    hideLevelOverlay();
    if (lastLevelTrigger && typeof lastLevelTrigger.focus === 'function') {
      lastLevelTrigger.focus();
    }
    lastLevelTrigger = null;
  }

  function confirmPendingLevel() {
    if (!pendingLevel) {
      hideLevelOverlay();
      return;
    }

    const levelToStart = pendingLevel;
    pendingLevel = null;
    hideLevelOverlay();
    startLevel(levelToStart);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function startLevel(level) {
    const currentState = levelState.get(level.id) || {
      entered: false,
      running: false,
      completed: false,
    };
    const isInteractive = isInteractiveLevel(level.id);
    if (isInteractive && !isLevelUnlocked(level.id)) {
      if (playfield?.messageEl) {
        const requiredId = getPreviousInteractiveLevelId(level.id);
        const requiredLevel = requiredId ? levelLookup.get(requiredId) : null;
        const requirementLabel = requiredLevel
          ? `${requiredLevel.id} · ${requiredLevel.title}`
          : 'the previous defense';
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock this path.`;
      }
      return;
    }
    const updatedState = {
      ...currentState,
      entered: true,
      running: !isInteractive,
    };
    levelState.set(level.id, updatedState);

    stopAllIdleRuns(level.id);

    levelState.forEach((state, id) => {
      if (id !== level.id) {
        levelState.set(id, { ...state, running: false });
      }
    });

    activeLevelId = level.id;
    resourceState.running = !isInteractive;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();

    if (playfield) {
      playfield.enterLevel(level, { endlessMode: Boolean(updatedState.completed) });
    }

    if (!isInteractive) {
      beginIdleLevelRun(level);
    } else {
      updateIdleLevelDisplay();
    }

    updateTowerSelectionButtons();
  }

  function leaveActiveLevel() {
    if (!activeLevelId) return;
    const state = levelState.get(activeLevelId);
    if (state) {
      levelState.set(activeLevelId, { ...state, running: false });
    }
    stopIdleLevelRun(activeLevelId);
    if (playfield) {
      playfield.leaveLevel();
    }
    activeLevelId = null;
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    updateTowerSelectionButtons();
  }

  function updateLevelCards() {
    if (!levelGrid) return;
    levelBlueprints.forEach((level) => {
      const card = levelGrid.querySelector(`[data-level="${level.id}"]`);
      if (!card) return;
      const pill = card.querySelector('.level-status-pill');
      const state = levelState.get(level.id);

      const entered = Boolean(state && state.entered);
      const running = Boolean(state && state.running);
      const completed = Boolean(state && state.completed);
      const unlocked = isLevelUnlocked(level.id);

      const summary = getLevelSummary(level);
      const modeEl = card.querySelector('.level-mode');
      const durationEl = card.querySelector('.level-duration');
      const rewardsEl = card.querySelector('.level-rewards');
      if (modeEl) {
        modeEl.textContent = summary.mode;
      }
      if (durationEl) {
        durationEl.textContent = summary.duration;
      }
      if (rewardsEl) {
        rewardsEl.textContent = summary.rewards;
      }

      const runner = idleLevelRuns.get(level.id) || null;
      const lastResultEl = card.querySelector('.level-last-result');
      if (lastResultEl) {
        lastResultEl.textContent = describeLevelLastResult(level, state || null, runner);
      }

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.classList.toggle('locked', !unlocked);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');
      card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      card.tabIndex = unlocked ? 0 : -1;

      if (!unlocked) {
        pill.textContent = 'Locked';
      } else if (!entered) {
        pill.textContent = 'New';
      } else if (running) {
        pill.textContent = 'Running';
      } else if (completed) {
        pill.textContent = 'Complete';
      } else {
        pill.textContent = 'Ready';
      }
    });
  }

  function updateActiveLevelBanner() {
    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = !activeLevelId;
    }
    if (!activeLevelEl) return;
    if (!activeLevelId) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId);
    if (!level || !state) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    let descriptor = 'Paused';
    if (state.running) {
      descriptor = 'Running';
    } else if (state.completed) {
      descriptor = 'Complete';
    }

    activeLevelEl.textContent = `${level.id} · ${level.title} (${descriptor})`;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (!tabs.length) return;
    if (overlay && overlay.classList.contains('active')) return;
    if (isTextInput(event.target)) return;

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    event.preventDefault();
    focusAndActivateTab(activeTabIndex + direction);
  });

  document.addEventListener('keydown', (event) => {
    if (!tabs.length) return;
    if (overlay && overlay.classList.contains('active')) return;
    if (isTextInput(event.target)) return;

    const targetTabId = tabHotkeys.get(event.key);
    if (!targetTabId) return;

    event.preventDefault();
    setActiveTab(targetTabId);
    const tabToFocus = tabs.find((tab) => tab.dataset.tab === targetTabId);
    if (tabToFocus) {
      tabToFocus.focus();
    }
  });

  function initializeTabs() {
    tabs = Array.from(document.querySelectorAll('.tab-button'));
    panels = Array.from(document.querySelectorAll('.panel'));

    if (!tabs.length || !panels.length) {
      return;
    }

    const existingActiveIndex = tabs.findIndex((tab) => tab.classList.contains('active'));
    activeTabIndex = existingActiveIndex >= 0 ? existingActiveIndex : 0;

    tabs.forEach((tab, index) => {
      if (!tab.getAttribute('type')) {
        tab.setAttribute('type', 'button');
      }

      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        if (!target) {
          return;
        }
        setActiveTab(target);
        tab.focus();
      });

      tab.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          focusAndActivateTab(index);
        }
      });
    });

    panels.forEach((panel) => {
      const isActive = panel.classList.contains('active');
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      if (!isActive) {
        panel.setAttribute('hidden', '');
      }
    });

    const initialTab = tabs[activeTabIndex];
    if (initialTab) {
      setActiveTab(initialTab.dataset.tab);
    }
  }

  function bindOverlayEvents() {
    if (!overlay) return;
    overlay.addEventListener('click', () => {
      confirmPendingLevel();
    });
  }

  function bindLeaveLevelButton() {
    if (!leaveLevelBtn) return;
    leaveLevelBtn.addEventListener('click', () => {
      leaveActiveLevel();
    });
  }

  function focusLeaveLevelButton() {
    if (leaveLevelBtn && !leaveLevelBtn.disabled && typeof leaveLevelBtn.focus === 'function') {
      leaveLevelBtn.focus();
    }
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '—';
    }
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (minutes && secs) {
      return `${minutes}m ${secs}s`;
    }
    if (minutes) {
      return `${minutes}m`;
    }
    return `${secs}s`;
  }

  function formatRewards(rewardScore, rewardFlux, rewardEnergy) {
    const parts = [];
    if (Number.isFinite(rewardScore)) {
      parts.push(`${formatGameNumber(rewardScore)} Σ`);
    }
    if (Number.isFinite(rewardFlux)) {
      parts.push(`+${Math.round(rewardFlux)} Powder/min`);
    }
    if (Number.isFinite(rewardEnergy)) {
      parts.push(`+${Math.round(rewardEnergy)} TD/s`);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  function formatRelativeTime(timestamp) {
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    const diff = Date.now() - timestamp;
    if (!Number.isFinite(diff)) {
      return null;
    }
    if (diff < 0) {
      return 'soon';
    }
    const seconds = Math.round(diff / 1000);
    if (seconds < 5) {
      return 'just now';
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function getLevelSummary(level) {
    if (!level) {
      return { mode: '—', duration: '—', rewards: '—' };
    }
    const interactiveConfig = levelConfigs.get(level.id);
    if (interactiveConfig) {
      const waves = interactiveConfig.waves?.length || 0;
      return {
        mode: 'Active Defense',
        duration: waves ? `${waves} waves · manual` : 'Active defense',
        rewards: formatRewards(
          interactiveConfig.rewardScore,
          interactiveConfig.rewardFlux,
          interactiveConfig.rewardEnergy,
        ),
      };
    }

    const config = idleLevelConfigs.get(level.id);
    return {
      mode: 'Idle Simulation',
      duration: config
        ? `${formatDuration(config.runDuration)} auto-run`
        : 'Idle simulation',
      rewards: config
        ? formatRewards(config.rewardScore, config.rewardFlux, config.rewardEnergy)
        : '—',
    };
  }

  function describeLevelLastResult(level, state, runner) {
    if (runner) {
      const percent = Math.min(100, Math.max(0, Math.round((runner.progress || 0) * 100)));
      const remainingSeconds = Number.isFinite(runner.remainingMs)
        ? Math.ceil(runner.remainingMs / 1000)
        : null;
      const remainingLabel = remainingSeconds === null
        ? 'Finishing'
        : `${formatDuration(remainingSeconds)} remaining`;
      return `Auto-run ${percent}% · ${remainingLabel}.`;
    }

    if (state?.running) {
      return level && isInteractiveLevel(level.id)
        ? 'Manual defense active.'
        : 'Auto-run initializing.';
    }

    if (!state || !state.lastResult) {
      return 'No attempts recorded.';
    }

    const { outcome, stats = {}, timestamp } = state.lastResult;
    const bestWave = Math.max(state.bestWave || 0, stats.maxWave || 0);
    const relative = formatRelativeTime(timestamp) || 'recently';

    if (outcome === 'victory') {
      const rewardText = formatRewards(stats.rewardScore, stats.rewardFlux, stats.rewardEnergy);
      const base =
        rewardText && rewardText !== '—'
          ? `Victory ${relative}. Rewards: ${rewardText}.`
          : `Victory ${relative}.`;
      return bestWave > 0 ? `${base} Waves cleared: ${bestWave}.` : base;
    }

    if (outcome === 'defeat') {
      return bestWave > 0
        ? `Defense collapsed ${relative}. Reached wave ${bestWave}.`
        : `Defense collapsed ${relative}.`;
    }

    return 'No attempts recorded.';
  }

  function formatGameNumber(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }

    const absolute = Math.abs(value);
    if (absolute < 1) {
      return value.toFixed(2);
    }

    const tier = Math.min(
      Math.floor(Math.log10(absolute) / 3),
      numberSuffixes.length - 1,
    );
    const scaled = value / 10 ** (tier * 3);
    const precision = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const formatted = scaled.toFixed(precision);
    const suffix = numberSuffixes[tier];
    return suffix ? `${formatted} ${suffix}` : formatted;
  }

  function formatDecimal(value, digits = 2) {
    if (!Number.isFinite(value)) {
      return '0.00';
    }
    return value.toFixed(digits);
  }

  function formatPercentage(value) {
    const percent = value * 100;
    const digits = Math.abs(percent) >= 10 ? 1 : 2;
    return `${percent.toFixed(digits)}%`;
  }

  function formatSignedPercentage(value) {
    const percent = value * 100;
    const digits = Math.abs(percent) >= 10 ? 1 : 2;
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(digits)}%`;
  }

  function bindAchievements() {
    achievementElements.clear();
    const items = document.querySelectorAll('[data-achievement-id]');
    items.forEach((item) => {
      const id = item.getAttribute('data-achievement-id');
      if (!id) {
        return;
      }
      const status = item.querySelector('.achievement-status');
      achievementElements.set(id, { container: item, status });
    });
    evaluateAchievements();
  }

  function updateAchievementStatus(definition, element, state) {
    if (!definition || !element) {
      return;
    }
    const { container, status } = element;
    if (state?.unlocked) {
      if (container) {
        container.classList.add('achievement-unlocked');
      }
      if (status) {
        status.textContent = 'Unlocked · +1 powder/min secured.';
      }
      return;
    }

    if (container) {
      container.classList.remove('achievement-unlocked');
    }
    if (status) {
      const progress = typeof definition.progress === 'function'
        ? definition.progress()
        : 'Locked';
      status.textContent = progress.startsWith('Locked')
        ? progress
        : `Locked — ${progress}`;
    }
  }

  function evaluateAchievements() {
    achievementDefinitions.forEach((definition) => {
      const state = achievementState.get(definition.id);
      if (!state?.unlocked && typeof definition.condition === 'function' && definition.condition()) {
        unlockAchievement(definition);
      } else {
        updateAchievementStatus(definition, achievementElements.get(definition.id), state || null);
      }
    });
  }

  function unlockAchievement(definition) {
    if (!definition) {
      return;
    }
    const existing = achievementState.get(definition.id);
    if (existing?.unlocked) {
      updateAchievementStatus(definition, achievementElements.get(definition.id), existing);
      return;
    }

    const state = { unlocked: true, unlockedAt: Date.now() };
    achievementState.set(definition.id, state);

    const element = achievementElements.get(definition.id);
    updateAchievementStatus(definition, element, state);

    const fluxReward = Number.isFinite(definition.rewardFlux) ? definition.rewardFlux : 0;
    if (fluxReward) {
      baseResources.fluxRate += fluxReward;
      updateResourceRates();
      updatePowderLedger();
    }

    recordPowderEvent('achievement-unlocked', { title: definition.title });
    updateStatusDisplays();
  }

  function notifyTowerPlaced(activeCount) {
    gameStats.towersPlaced += 1;
    if (Number.isFinite(activeCount)) {
      gameStats.maxTowersSimultaneous = Math.max(gameStats.maxTowersSimultaneous, activeCount);
    }
    evaluateAchievements();
  }

  function updateLoadoutNote() {
    if (!loadoutElements.note) {
      return;
    }
    if (!towerLoadoutState.selected.length) {
      loadoutElements.note.textContent =
        'Select towers on the Towers tab to prepare up to four glyphs for this defense.';
    } else {
      loadoutElements.note.textContent =
        'Select four towers to bring into the defense. Drag the glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge.';
    }
  }

  function pruneLockedTowersFromLoadout() {
    const selected = towerLoadoutState.selected;
    let changed = false;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!isTowerUnlocked(selected[index])) {
        selected.splice(index, 1);
        changed = true;
      }
    }
    return changed;
  }

  function renderTowerLoadout() {
    if (!loadoutElements.grid) {
      renderedLoadoutSignature = null;
      return;
    }

    const selected = towerLoadoutState.selected;
    const signature = selected.join('|');
    const existingCount = loadoutElements.grid.childElementCount;

    if (signature === renderedLoadoutSignature && existingCount === selected.length) {
      refreshTowerLoadoutDisplay();
      updateLoadoutNote();
      return;
    }

    loadoutElements.grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    renderedLoadoutSignature = signature;

    if (!selected.length) {
      updateLoadoutNote();
      return;
    }

    selected.forEach((towerId) => {
      const definition = getTowerDefinition(towerId);
      if (!definition) {
        return;
      }

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tower-loadout-item';
      item.dataset.towerId = towerId;
      item.setAttribute('role', 'listitem');

      const artwork = document.createElement('img');
      artwork.className = 'tower-loadout-art';
      if (definition.icon) {
        artwork.src = definition.icon;
        artwork.alt = `${definition.name} sigil`;
        artwork.decoding = 'async';
        artwork.loading = 'lazy';
      } else {
        artwork.alt = '';
        artwork.setAttribute('aria-hidden', 'true');
      }

      const symbol = document.createElement('span');
      symbol.className = 'tower-loadout-symbol';
      symbol.textContent = definition.symbol;

      const label = document.createElement('span');
      label.className = 'tower-loadout-label';
      label.textContent = definition.name;

      const costEl = document.createElement('span');
      costEl.className = 'tower-loadout-cost';
      costEl.textContent = '—';

      item.append(artwork, symbol, label, costEl);

      item.addEventListener('pointerdown', (event) => startTowerDrag(event, towerId, item));

      fragment.append(item);
    });

    loadoutElements.grid.append(fragment);
    refreshTowerLoadoutDisplay();
    updateLoadoutNote();
  }

  function refreshTowerLoadoutDisplay() {
    if (!loadoutElements.grid) {
      return;
    }
    const interactive = Boolean(playfield && playfield.isInteractiveLevelActive());
    const items = loadoutElements.grid.querySelectorAll('.tower-loadout-item');
    items.forEach((item) => {
      const towerId = item.dataset.towerId;
      const definition = getTowerDefinition(towerId);
      if (!definition) {
        return;
      }
      const currentCost = playfield ? playfield.getCurrentTowerCost(towerId) : definition.baseCost;
      const costEl = item.querySelector('.tower-loadout-cost');
      if (costEl) {
        costEl.textContent = `${Math.round(currentCost)} Th`;
      }
      const affordable = interactive ? playfield.energy >= currentCost : false;
      item.dataset.valid = affordable ? 'true' : 'false';
      item.dataset.disabled = interactive ? 'false' : 'true';
      item.disabled = !interactive;
    });
  }

  function cancelTowerDrag() {
    if (!loadoutDragState.active) {
      return;
    }
    document.removeEventListener('pointermove', handleTowerDragMove);
    document.removeEventListener('pointerup', handleTowerDragEnd);
    document.removeEventListener('pointercancel', handleTowerDragEnd);
    if (loadoutDragState.element) {
      try {
        loadoutDragState.element.releasePointerCapture(loadoutDragState.pointerId);
      } catch (error) {
        // ignore
      }
      loadoutDragState.element.removeAttribute('data-state');
    }
    playfield?.finishTowerDrag();
    playfield?.clearPlacementPreview();
    loadoutDragState.active = false;
    loadoutDragState.pointerId = null;
    loadoutDragState.towerId = null;
    loadoutDragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  function handleTowerDragMove(event) {
    if (!loadoutDragState.active || event.pointerId !== loadoutDragState.pointerId) {
      return;
    }
    if (!playfield) {
      return;
    }
    const normalized = playfield.getNormalizedFromEvent(event);
    if (!normalized) {
      playfield.clearPlacementPreview();
      return;
    }
    playfield.previewTowerPlacement(normalized, {
      towerType: loadoutDragState.towerId,
      dragging: true,
    });
  }

  function finalizeTowerDrag(event) {
    if (!loadoutDragState.active || event.pointerId !== loadoutDragState.pointerId) {
      return;
    }

    if (loadoutDragState.element) {
      try {
        loadoutDragState.element.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
      loadoutDragState.element.removeAttribute('data-state');
    }

    document.removeEventListener('pointermove', handleTowerDragMove);
    document.removeEventListener('pointerup', handleTowerDragEnd);
    document.removeEventListener('pointercancel', handleTowerDragEnd);

    if (playfield) {
      const normalized = playfield.getNormalizedFromEvent(event);
      if (normalized) {
        playfield.completeTowerPlacement(normalized, { towerType: loadoutDragState.towerId });
      } else {
        playfield.clearPlacementPreview();
      }
      playfield.finishTowerDrag();
    }

    loadoutDragState.active = false;
    loadoutDragState.pointerId = null;
    loadoutDragState.towerId = null;
    loadoutDragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  function handleTowerDragEnd(event) {
    finalizeTowerDrag(event);
  }

  function startTowerDrag(event, towerId, element) {
    if (!playfield || !playfield.isInteractiveLevelActive()) {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = 'Enter the defense to lattice towers from your loadout.';
      }
      return;
    }

    cancelTowerDrag();

    loadoutDragState.active = true;
    loadoutDragState.pointerId = event.pointerId;
    loadoutDragState.towerId = towerId;
    loadoutDragState.element = element;
    element.dataset.state = 'dragging';

    playfield.setDraggingTower(towerId);

    try {
      element.setPointerCapture(event.pointerId);
    } catch (error) {
      // Ignore pointer capture errors.
    }

    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    document.addEventListener('pointermove', handleTowerDragMove);
    document.addEventListener('pointerup', handleTowerDragEnd);
    document.addEventListener('pointercancel', handleTowerDragEnd);

    handleTowerDragMove(event);
  }

  function updateTowerSelectionButtons() {
    towerSelectionButtons.forEach((button, towerId) => {
      const definition = getTowerDefinition(towerId);
      const selected = towerLoadoutState.selected.includes(towerId);
      const label = definition ? definition.symbol : towerId;
      const unlocked = isTowerUnlocked(towerId);
      button.dataset.locked = unlocked ? 'false' : 'true';
      if (!unlocked) {
        button.disabled = true;
        button.setAttribute('aria-pressed', 'false');
        if (definition) {
          button.textContent = `Locked ${label}`;
          button.title = `Discover ${definition.name} to unlock this lattice.`;
        } else {
          button.textContent = 'Locked';
        }
        return;
      }

      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.textContent = selected ? `Equipped ${label}` : `Equip ${label}`;
      if (playfield && playfield.isInteractiveLevelActive()) {
        button.disabled = true;
        button.title = 'Leave the active level to adjust your loadout.';
        return;
      }
      const atLimit = !selected && towerLoadoutState.selected.length >= TOWER_LOADOUT_LIMIT;
      button.disabled = atLimit;
      button.title = selected
        ? `${definition?.name || 'Tower'} is currently in your loadout.`
        : `Equip ${definition?.name || 'tower'} for this defense.`;
    });
  }

  function toggleTowerSelection(towerId) {
    if (!towerDefinitionMap.has(towerId)) {
      return;
    }
    if (playfield && playfield.isInteractiveLevelActive()) {
      if (loadoutElements.note) {
        loadoutElements.note.textContent = 'Leave the active level to adjust your loadout.';
      }
      updateTowerSelectionButtons();
      return;
    }
    if (!isTowerUnlocked(towerId)) {
      const definition = getTowerDefinition(towerId);
      if (loadoutElements.note && definition) {
        loadoutElements.note.textContent = `Discover ${definition.name} before equipping it.`;
      }
      updateTowerSelectionButtons();
      return;
    }
    const selected = towerLoadoutState.selected;
    const index = selected.indexOf(towerId);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      if (selected.length >= TOWER_LOADOUT_LIMIT) {
        if (loadoutElements.note) {
          loadoutElements.note.textContent = 'Only four towers can be prepared at once.';
        }
        updateTowerSelectionButtons();
        return;
      }
      selected.push(towerId);
    }
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
  }

  function initializeTowerSelection() {
    const buttons = document.querySelectorAll('[data-tower-toggle]');
    buttons.forEach((button) => {
      const towerId = button.dataset.towerToggle;
      if (!towerId) {
        return;
      }
      towerSelectionButtons.set(towerId, button);
      const definition = getTowerDefinition(towerId);
      if (definition) {
        button.textContent = `Equip ${definition.symbol}`;
      }
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => toggleTowerSelection(towerId));
    });
    updateTowerSelectionButtons();
  }

  function syncLoadoutToPlayfield() {
    pruneLockedTowersFromLoadout();
    if (playfield) {
      playfield.setAvailableTowers(towerLoadoutState.selected);
    }
    renderTowerLoadout();
    updateTowerSelectionButtons();
  }

  function renderEnemyCodex() {
    if (!enemyCodexElements.list) {
      return;
    }

    const encountered = Array.from(codexState.encounteredEnemies)
      .map((id) => enemyCodexMap.get(id))
      .filter(Boolean);

    enemyCodexElements.list.innerHTML = '';

    if (enemyCodexElements.note) {
      enemyCodexElements.note.hidden = encountered.length > 0 ? true : false;
    }

    if (!encountered.length) {
      if (enemyCodexElements.empty) {
        enemyCodexElements.empty.hidden = false;
      }
      enemyCodexElements.list.setAttribute('hidden', '');
      return;
    }

    enemyCodexElements.list.removeAttribute('hidden');
    if (enemyCodexElements.empty) {
      enemyCodexElements.empty.hidden = true;
    }

    const fragment = document.createDocumentFragment();
    encountered.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'card enemy-card';
      card.setAttribute('role', 'listitem');

      const title = document.createElement('h3');
      title.textContent = entry.name;

      const description = document.createElement('p');
      description.textContent = entry.description;

      card.append(title, description);
      fragment.append(card);
    });

    enemyCodexElements.list.append(fragment);
  }

  function registerEnemyEncounter(enemyId) {
    if (!enemyId || codexState.encounteredEnemies.has(enemyId)) {
      return;
    }
    if (!enemyCodexMap.has(enemyId)) {
      return;
    }
    codexState.encounteredEnemies.add(enemyId);
    renderEnemyCodex();
  }

  function notifyAutoAnchorUsed(currentPlaced, totalAnchors) {
    if (!Number.isFinite(currentPlaced)) {
      return;
    }
    const normalizedTotal = Number.isFinite(totalAnchors)
      ? Math.max(0, totalAnchors)
      : Math.max(0, currentPlaced);
    const cappedPlaced = Math.max(0, Math.min(currentPlaced, normalizedTotal));
    gameStats.autoAnchorPlacements = Math.max(gameStats.autoAnchorPlacements, cappedPlaced);
    evaluateAchievements();
  }

  function notifyEnemyDefeated() {
    gameStats.enemiesDefeated += 1;
    evaluateAchievements();
  }

  function notifyLevelVictory(levelId) {
    if (isInteractiveLevel(levelId)) {
      gameStats.manualVictories += 1;
    } else {
      gameStats.idleVictories += 1;
    }
    evaluateAchievements();
  }

  function notifyPowderAction() {
    gameStats.powderActions += 1;
    evaluateAchievements();
  }

  function notifyPowderSigils(count) {
    if (!Number.isFinite(count)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(count));
    gameStats.powderSigilsReached = Math.max(gameStats.powderSigilsReached, normalized);
    glyphCurrency = Math.max(glyphCurrency, normalized);
    updateStatusDisplays();
    evaluateAchievements();
  }

  function notifyPowderMultiplier(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    if (value > gameStats.highestPowderMultiplier) {
      gameStats.highestPowderMultiplier = value;
    }
    evaluateAchievements();
  }

  function handlePowderHeightChange(info) {
    if (!info) {
      return;
    }

    const previousGain = powderState.simulatedDuneGain;
    const normalizedHeight = Number.isFinite(info.normalizedHeight)
      ? Math.max(0, Math.min(1, info.normalizedHeight))
      : 0;
    const clampedGain = Number.isFinite(info.duneGain)
      ? Math.max(0, Math.min(powderConfig.simulatedDuneGainMax, info.duneGain))
      : 0;
    const largestGrain = Number.isFinite(info.largestGrain) ? Math.max(0, info.largestGrain) : 0;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const totalNormalized = Number.isFinite(info.totalNormalized)
      ? Math.max(0, info.totalNormalized)
      : normalizedHeight;
    const crestPosition = Number.isFinite(info.crestPosition)
      ? Math.max(0, Math.min(1, info.crestPosition))
      : 1;
    const cellSize = Number.isFinite(info.cellSize) ? Math.max(1, info.cellSize) : 1;
    const rows = Number.isFinite(info.rows) ? Math.max(1, info.rows) : 1;
    const highestNormalizedRaw = Number.isFinite(info.highestNormalized)
      ? Math.max(0, info.highestNormalized)
      : totalNormalized;
    const highestNormalized = Math.max(0, Math.min(1, highestNormalizedRaw));
    const highestDisplay = formatDecimal(Math.max(0, highestNormalizedRaw), 2);

    powderState.simulatedDuneGain = clampedGain;

    if (powderElements.simulationNote) {
      const crestPercent = formatDecimal(normalizedHeight * 100, 1);
      const crestHeight = formatDecimal(powderState.duneHeight + clampedGain, 2);
      const towerPercent = formatDecimal(totalNormalized * 100, 1);
      const grainLabel = largestGrain ? `${largestGrain}×${largestGrain}` : '—';
      powderElements.simulationNote.textContent =
        `Captured crest: ${crestPercent}% full · tower ascent ${towerPercent}% · dune height h = ${crestHeight} · largest grain ${grainLabel}.`;
    }

    if (powderElements.basin) {
      powderElements.basin.style.setProperty('--powder-crest', normalizedHeight.toFixed(3));
    }

    const wallShiftPx = scrollOffset * cellSize;
    if (powderElements.leftWall) {
      powderElements.leftWall.style.transform = `translateY(${wallShiftPx.toFixed(1)}px)`;
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.transform = `translateY(${wallShiftPx.toFixed(1)}px)`;
    }

    const basinHeight = rows * cellSize;
    if (powderElements.crestMarker) {
      const crestOffset = Math.min(basinHeight, crestPosition * basinHeight);
      powderElements.crestMarker.style.transform = `translateY(${crestOffset.toFixed(1)}px)`;
      powderElements.crestMarker.dataset.height = `Crest ${formatDecimal(normalizedHeight, 2)}`;
    }

    if (powderElements.wallMarker) {
      const peakOffset = Math.min(basinHeight, (1 - highestNormalized) * basinHeight);
      powderElements.wallMarker.style.transform = `translateY(${peakOffset.toFixed(1)}px)`;
      powderElements.wallMarker.dataset.height = `Peak ${highestDisplay}`;
    }

    if (powderElements.wallGlyphs && powderElements.wallGlyphs.length) {
      let litGlyphs = 0;
      let leftAwake = false;
      let rightAwake = false;

      powderElements.wallGlyphs.forEach((glyph) => {
        const threshold = Number.parseFloat(glyph.dataset.heightThreshold);
        const isLit = Number.isFinite(threshold) && normalizedHeight >= threshold;
        glyph.classList.toggle('glowing', isLit);
        if (isLit) {
          litGlyphs += 1;
          if (glyph.dataset.wall === 'right') {
            rightAwake = true;
          } else {
            leftAwake = true;
          }
        }
      });

      if (powderElements.leftWall) {
        powderElements.leftWall.classList.toggle('wall-awake', leftAwake);
      }
      if (powderElements.rightWall) {
        powderElements.rightWall.classList.toggle('wall-awake', rightAwake);
      }

      if (litGlyphs !== powderState.wallGlyphsLit) {
        powderState.wallGlyphsLit = litGlyphs;
        notifyPowderSigils(litGlyphs);
      }
    }

    if (Math.abs(previousGain - clampedGain) > 0.01) {
      refreshPowderSystems();
    }
  }

  function notifyIdleTime(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      return;
    }
    gameStats.idleMillisecondsAccumulated += elapsedMs;
    evaluateAchievements();
  }

  function calculatePowderBonuses() {
    // Stabilizing the sandfall adds an offset term to Ψ(g) = 2.7 · sin(t), yielding steady grain capture.
    const sandBonus = powderState.sandOffset > 0 ? 0.15 + powderState.sandOffset * 0.03 : 0;
    // Surveying dunes raises h inside Δm = log₂(h + 1); dynamic grains extend h beyond the surveyed base.
    const effectiveDuneHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
    const duneBonus = Math.log2(effectiveDuneHeight + 1) * 0.04;

    const baseCrystalProduct = powderConfig.thetaBase * powderConfig.zetaBase;
    const chargedTheta = powderConfig.thetaBase + powderState.charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + powderState.charges * 0.5;
    // Crystal resonance follows Q = √(θ · ζ); stored charges lift both parameters before release.
    const crystalGain = Math.max(
      0,
      Math.sqrt(chargedTheta * chargedZeta) - Math.sqrt(baseCrystalProduct),
    );
    const crystalBonus = crystalGain * 0.05;

    const totalMultiplier = 1 + sandBonus + duneBonus + crystalBonus;

    return { sandBonus, duneBonus, crystalBonus, totalMultiplier };
  }

  function updateStatusDisplays() {
    if (resourceElements.score) {
      const interactive = Boolean(playfield && playfield.isInteractiveLevelActive());
      const theroValue = interactive ? Math.max(0, Math.round(playfield.energy)) : 0;
      const idleScore = formatGameNumber(resourceState.score);
      resourceElements.score.textContent = `${theroValue} Th · Σ ${idleScore}`;
    }
    if (resourceElements.energy) {
      const energyRate = formatGameNumber(resourceState.energyRate);
      resourceElements.energy.textContent = `${glyphCurrency} Glyphs · +${energyRate} TD/s`;
    }
    if (resourceElements.flux) {
      const unlocked = Array.from(achievementState.values()).filter((state) => state?.unlocked).length;
      const fluxRate = formatGameNumber(resourceState.fluxRate);
      resourceElements.flux.textContent = `${unlocked} Ach · +${fluxRate} Powder/min`;
    }
  }

  function updateResourceRates() {
    currentPowderBonuses = calculatePowderBonuses();

    resourceState.scoreRate = baseResources.scoreRate * currentPowderBonuses.totalMultiplier;
    resourceState.fluxRate =
      baseResources.fluxRate * (1 + currentPowderBonuses.sandBonus + currentPowderBonuses.crystalBonus);
    resourceState.energyRate =
      baseResources.energyRate * (1 + currentPowderBonuses.duneBonus + currentPowderBonuses.crystalBonus * 0.5);

    updateStatusDisplays();
  }

  function handleResourceTick(timestamp) {
    if (!resourceTicker) {
      return;
    }

    const activeBeforeUpdate = idleLevelRuns.size;
    updateIdleRuns(timestamp);

    if (!lastResourceTick) {
      lastResourceTick = timestamp;
    }

    const elapsed = Math.max(0, timestamp - lastResourceTick);
    lastResourceTick = timestamp;

    const effectiveIdleCount = activeBeforeUpdate || idleLevelRuns.size;
    if (effectiveIdleCount) {
      notifyIdleTime(elapsed * effectiveIdleCount);
    }

    if (resourceState.running) {
      const seconds = elapsed / 1000;
      resourceState.score += resourceState.scoreRate * seconds;
    }

    updateStatusDisplays();
    resourceTicker = requestAnimationFrame(handleResourceTick);
  }

  function ensureResourceTicker() {
    if (resourceTicker) {
      return;
    }
    lastResourceTick = 0;
    resourceTicker = requestAnimationFrame(handleResourceTick);
  }

  function bindStatusElements() {
    resourceElements.score = document.getElementById('status-score');
    resourceElements.energy = document.getElementById('status-energy');
    resourceElements.flux = document.getElementById('status-flux');
    updateStatusDisplays();
  }

  function bindPowderControls() {
    powderElements.sandfallFormula = document.getElementById('powder-sandfall-formula');
    powderElements.sandfallNote = document.getElementById('powder-sandfall-note');
    powderElements.sandfallButton = document.querySelector('[data-powder-action="sandfall"]');

    powderElements.duneFormula = document.getElementById('powder-dune-formula');
    powderElements.duneNote = document.getElementById('powder-dune-note');
    powderElements.duneButton = document.querySelector('[data-powder-action="dune"]');

    powderElements.crystalFormula = document.getElementById('powder-crystal-formula');
    powderElements.crystalNote = document.getElementById('powder-crystal-note');
    powderElements.crystalButton = document.querySelector('[data-powder-action="crystal"]');

    powderElements.simulationCanvas = document.getElementById('powder-canvas');
    powderElements.simulationNote = document.getElementById('powder-simulation-note');
    powderElements.basin = document.getElementById('powder-basin');
    powderElements.leftWall = document.getElementById('powder-wall-left');
    powderElements.rightWall = document.getElementById('powder-wall-right');
    powderElements.wallMarker = document.getElementById('powder-wall-marker');
    powderElements.crestMarker = document.getElementById('powder-crest-marker');
    powderElements.wallGlyphs = Array.from(
      document.querySelectorAll('[data-powder-glyph]'),
    );

    powderElements.totalMultiplier = document.getElementById('powder-total-multiplier');
    powderElements.sandBonusValue = document.getElementById('powder-sand-bonus');
    powderElements.duneBonusValue = document.getElementById('powder-dune-bonus');
    powderElements.crystalBonusValue = document.getElementById('powder-crystal-bonus');

    powderElements.ledgerBaseScore = document.getElementById('powder-ledger-base-score');
    powderElements.ledgerCurrentScore = document.getElementById('powder-ledger-current-score');
    powderElements.ledgerFlux = document.getElementById('powder-ledger-flux');
    powderElements.ledgerEnergy = document.getElementById('powder-ledger-energy');

    powderElements.sigilEntries = Array.from(
      document.querySelectorAll('[data-sigil-threshold]'),
    );

    powderElements.logList = document.getElementById('powder-log');
    powderElements.logEmpty = document.getElementById('powder-log-empty');

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.addEventListener('click', toggleSandfallStability);
    }

    if (powderElements.duneButton) {
      powderElements.duneButton.addEventListener('click', surveyRidgeHeight);
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.addEventListener('click', chargeCrystalMatrix);
    }

    if (powderElements.simulationCanvas && !powderSimulation) {
      const leftInset = powderElements.leftWall
        ? Math.max(68, powderElements.leftWall.offsetWidth)
        : 68;
      const rightInset = powderElements.rightWall
        ? Math.max(68, powderElements.rightWall.offsetWidth)
        : 68;
      powderSimulation = new PowderSimulation({
        canvas: powderElements.simulationCanvas,
        cellSize: 1,
        grainSizes: [1, 2, 3],
        scrollThreshold: 0.75,
        wallInsetLeft: leftInset,
        wallInsetRight: rightInset,
        maxDuneGain: powderConfig.simulatedDuneGainMax,
        onHeightChange: handlePowderHeightChange,
      });
      powderSimulation.setFlowOffset(powderState.sandOffset);
      powderSimulation.start();
      handlePowderHeightChange(powderSimulation.getStatus());
    }
  }

  function updatePowderLedger() {
    if (powderElements.ledgerBaseScore) {
      powderElements.ledgerBaseScore.textContent = `${formatGameNumber(
        baseResources.scoreRate,
      )} Σ/s`;
    }

    if (powderElements.ledgerCurrentScore) {
      powderElements.ledgerCurrentScore.textContent = `${formatGameNumber(
        resourceState.scoreRate,
      )} Σ/s`;
    }

    if (powderElements.ledgerFlux) {
      powderElements.ledgerFlux.textContent = `+${formatGameNumber(
        resourceState.fluxRate,
      )} Powder/min`;
    }

    if (powderElements.ledgerEnergy) {
      powderElements.ledgerEnergy.textContent = `+${formatGameNumber(
        resourceState.energyRate,
      )} TD/s`;
    }
  }

  function updatePowderLogDisplay() {
    if (!powderElements.logList || !powderElements.logEmpty) {
      return;
    }

    powderElements.logList.innerHTML = '';

    if (!powderLog.length) {
      powderElements.logList.setAttribute('hidden', '');
      powderElements.logEmpty.hidden = false;
      return;
    }

    powderElements.logList.removeAttribute('hidden');
    powderElements.logEmpty.hidden = true;

    const fragment = document.createDocumentFragment();
    powderLog.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      fragment.append(item);
    });
    powderElements.logList.append(fragment);
  }

  function recordPowderEvent(type, context = {}) {
    let entry = '';

    switch (type) {
      case 'sand-stabilized': {
        entry = `Sandfall stabilized · Powder bonus ${formatSignedPercentage(
          currentPowderBonuses.sandBonus,
        )}.`;
        break;
      }
      case 'sand-released': {
        entry = 'Sandfall released · Flow returns to natural drift.';
        break;
      }
      case 'dune-raise': {
        const { height = powderState.duneHeight } = context;
        const logValue = Math.log2(height + 1);
        entry = `Dune surveyed · h = ${height}, Δm = ${formatDecimal(logValue, 2)}.`;
        break;
      }
      case 'dune-max': {
        entry = 'Dune survey halted · Ridge already at maximum elevation.';
        break;
      }
      case 'crystal-charge': {
        const { charges = powderState.charges } = context;
        entry = `Crystal lattice charged (${charges}/3) · Resonance rising.`;
        break;
      }
      case 'crystal-release': {
        const { pulseBonus = 0 } = context;
        entry = `Crystal pulse released · Σ surged ${formatSignedPercentage(pulseBonus)}.`;
        break;
      }
      case 'achievement-unlocked': {
        const { title = 'Achievement' } = context;
        entry = `${title} seal unlocked · +1 powder/min secured.`;
        break;
      }
      default:
        break;
    }

    if (!entry) {
      return;
    }

    powderLog.unshift(entry);
    if (powderLog.length > POWDER_LOG_LIMIT) {
      powderLog.length = POWDER_LOG_LIMIT;
    }
    updatePowderLogDisplay();
  }

  function toggleSandfallStability() {
    powderState.sandOffset =
      powderState.sandOffset > 0
        ? powderConfig.sandOffsetInactive
        : powderConfig.sandOffsetActive;

    if (powderSimulation) {
      powderSimulation.setFlowOffset(powderState.sandOffset);
    }

    refreshPowderSystems();
    recordPowderEvent(powderState.sandOffset > 0 ? 'sand-stabilized' : 'sand-released');
    notifyPowderAction();
  }

  function surveyRidgeHeight() {
    if (powderState.duneHeight >= powderConfig.duneHeightMax) {
      recordPowderEvent('dune-max');
      return;
    }

    powderState.duneHeight += 1;
    refreshPowderSystems();
    recordPowderEvent('dune-raise', { height: powderState.duneHeight });
    notifyPowderAction();
  }

  function chargeCrystalMatrix() {
    if (powderState.charges < 3) {
      powderState.charges += 1;
      refreshPowderSystems();
      recordPowderEvent('crystal-charge', { charges: powderState.charges });
      notifyPowderAction();
      return;
    }

    const pulseBonus = releaseCrystalPulse(powderState.charges);
    powderState.charges = 0;
    refreshPowderSystems(pulseBonus);
    recordPowderEvent('crystal-release', { pulseBonus });
    notifyPowderAction();
  }

  function releaseCrystalPulse(charges) {
    const chargedTheta = powderConfig.thetaBase + charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + charges * 0.5;
    const resonance = Math.sqrt(chargedTheta * chargedZeta);
    const pulseBonus = resonance * 0.008;

    // Each pulse injects a burst of Σ score proportional to the amplified resonance term.
    resourceState.score += resourceState.score * pulseBonus;
    updateStatusDisplays();

    return pulseBonus;
  }

  function refreshPowderSystems(pulseBonus) {
    updateResourceRates();
    updatePowderDisplay(pulseBonus);
  }

  function updatePowderDisplay(pulseBonus) {
    const totalMultiplier = currentPowderBonuses.totalMultiplier;
    notifyPowderMultiplier(totalMultiplier);

    if (powderElements.totalMultiplier) {
      powderElements.totalMultiplier.textContent = `×${formatDecimal(
        totalMultiplier,
        2,
      )}`;
    }

    if (powderElements.sandBonusValue) {
      powderElements.sandBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.sandBonus,
      );
    }

    if (powderElements.duneBonusValue) {
      powderElements.duneBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.duneBonus,
      );
    }

    if (powderElements.crystalBonusValue) {
      powderElements.crystalBonusValue.textContent = formatSignedPercentage(
        currentPowderBonuses.crystalBonus,
      );
    }

    if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
      let reached = 0;
      powderElements.sigilEntries.forEach((sigil) => {
        const threshold = Number.parseFloat(sigil.dataset.sigilThreshold);
        if (!Number.isFinite(threshold)) {
          return;
        }
        if (totalMultiplier >= threshold) {
          sigil.classList.add('sigil-reached');
          reached += 1;
        } else {
          sigil.classList.remove('sigil-reached');
        }
      });
      notifyPowderSigils(reached);
    } else {
      notifyPowderSigils(0);
    }

    updatePowderLedger();

    if (powderElements.sandfallFormula) {
      const offset = powderState.sandOffset;
      powderElements.sandfallFormula.textContent =
        offset > 0
          ? `Ψ(g) = 2.7 · sin(t) + ${formatDecimal(offset, 1)}`
          : 'Ψ(g) = 2.7 · sin(t)';
    }

    if (powderElements.sandfallNote) {
      const bonusText = formatPercentage(currentPowderBonuses.sandBonus);
      powderElements.sandfallNote.textContent =
        powderState.sandOffset > 0
          ? `Flow stabilized—captured grains grant +${bonusText} powder.`
          : 'Crest is unstable—powder drifts off the board.';
    }

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.textContent =
        powderState.sandOffset > 0 ? 'Release Flow' : 'Stabilize Flow';
    }

    if (powderElements.duneFormula) {
      const height = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      const logValue = Math.log2(height + 1);
      powderElements.duneFormula.textContent = `Δm = log₂(${formatDecimal(height, 2)} + 1) = ${formatDecimal(
        logValue,
        2,
      )}`;
    }

    if (powderElements.duneNote) {
      const crestHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      powderElements.duneNote.textContent = `Channel bonus: +${formatPercentage(
        currentPowderBonuses.duneBonus,
      )} to energy gain · crest h = ${formatDecimal(crestHeight, 2)}.`;
    }

    if (powderElements.duneButton) {
      const reachedMax = powderState.duneHeight >= powderConfig.duneHeightMax;
      powderElements.duneButton.disabled = reachedMax;
      powderElements.duneButton.textContent = reachedMax ? 'Ridge Surveyed' : 'Survey Ridge';
    }

    if (powderElements.crystalFormula) {
      const charges = powderState.charges;
      const theta = powderConfig.thetaBase + charges * 0.6;
      const zeta = powderConfig.zetaBase + charges * 0.5;
      const root = Math.sqrt(theta * zeta);
      powderElements.crystalFormula.textContent = `Q = √(${formatDecimal(theta, 2)} · ${formatDecimal(
        zeta,
        2,
      )}) = ${formatDecimal(root, 2)}`;
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.textContent =
        powderState.charges < 3
          ? `Crystallize (${powderState.charges}/3)`
          : 'Release Pulse';
    }

    if (powderElements.crystalNote) {
      if (typeof pulseBonus === 'number') {
        powderElements.crystalNote.textContent = `Pulse released! Σ score surged by +${formatPercentage(
          pulseBonus,
        )}.`;
      } else if (powderState.charges >= 3) {
        powderElements.crystalNote.textContent = 'Pulse ready—channel the matrix to unleash stored Σ energy.';
      } else if (currentPowderBonuses.crystalBonus <= 0) {
        powderElements.crystalNote.textContent = 'Crystal resonance is idle—no pulse prepared.';
      } else {
        powderElements.crystalNote.textContent = `Stored resonance grants +${formatPercentage(
          currentPowderBonuses.crystalBonus,
        )} to all rates.`;
      }
    }
  }

  function init() {
    levelGrid = document.getElementById('level-grid');
    activeLevelEl = document.getElementById('active-level');
    leaveLevelBtn = document.getElementById('leave-level');
    overlay = document.getElementById('level-overlay');
    if (overlay && !overlay.hasAttribute('tabindex')) {
      overlay.setAttribute('tabindex', '-1');
    }
    overlayLabel = document.getElementById('overlay-level');
    overlayTitle = document.getElementById('overlay-title');
    overlayExample = document.getElementById('overlay-example');
    overlayMode = document.getElementById('overlay-mode');
    overlayDuration = document.getElementById('overlay-duration');
    overlayRewards = document.getElementById('overlay-rewards');
    overlayLast = document.getElementById('overlay-last');
    overlayInstruction = overlay ? overlay.querySelector('.overlay-instruction') : null;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }

    playfieldElements.container = document.getElementById('playfield');
    playfieldElements.canvas = document.getElementById('playfield-canvas');
    playfieldElements.message = document.getElementById('playfield-message');
    playfieldElements.wave = document.getElementById('playfield-wave');
    playfieldElements.health = document.getElementById('playfield-health');
    playfieldElements.energy = document.getElementById('playfield-energy');
    playfieldElements.progress = document.getElementById('playfield-progress');
    playfieldElements.startButton = document.getElementById('playfield-start');
    playfieldElements.speedButton = document.getElementById('playfield-speed');
    playfieldElements.autoAnchorButton = document.getElementById('playfield-auto');
    playfieldElements.autoWaveCheckbox = document.getElementById('playfield-auto-wave');
    playfieldElements.slots = Array.from(document.querySelectorAll('.tower-slot'));

    loadoutElements.container = document.getElementById('tower-loadout');
    loadoutElements.grid = document.getElementById('tower-loadout-grid');
    loadoutElements.note = document.getElementById('tower-loadout-note');

    enemyCodexElements.list = document.getElementById('enemy-codex-list');
    enemyCodexElements.empty = document.getElementById('enemy-codex-empty');
    enemyCodexElements.note = document.getElementById('enemy-codex-note');
    if (audioManager) {
      const activationElements = [
        playfieldElements.startButton,
        playfieldElements.speedButton,
        playfieldElements.autoAnchorButton,
        playfieldElements.autoWaveCheckbox,
        playfieldElements.canvas,
        ...playfieldElements.slots,
      ].filter(Boolean);
      audioManager.registerActivationElements(activationElements);
    }

    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = true;
    }

    if (playfieldElements.canvas && playfieldElements.container) {
      playfield = new SimplePlayfield({
        canvas: playfieldElements.canvas,
        container: playfieldElements.container,
        messageEl: playfieldElements.message,
        waveEl: playfieldElements.wave,
        healthEl: playfieldElements.health,
        energyEl: playfieldElements.energy,
        progressEl: playfieldElements.progress,
        startButton: playfieldElements.startButton,
        speedButton: playfieldElements.speedButton,
        autoAnchorButton: playfieldElements.autoAnchorButton,
        autoWaveCheckbox: playfieldElements.autoWaveCheckbox,
        slotButtons: playfieldElements.slots,
        audioManager,
        onVictory: handlePlayfieldVictory,
        onDefeat: handlePlayfieldDefeat,
        onCombatStart: handlePlayfieldCombatStart,
      });
    }

    audioManager.playMusic('menu');

    bindStatusElements();
    bindPowderControls();
    bindAchievements();
    updatePowderLogDisplay();
    updateResourceRates();
    updatePowderDisplay();
    ensureResourceTicker();

    initializeTowerSelection();
    syncLoadoutToPlayfield();
    renderEnemyCodex();

    initializeTabs();
    buildLevelCards();
    updateLevelCards();
    bindOverlayEvents();
    bindLeaveLevelButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay) return;
    const hidden = overlay.getAttribute('aria-hidden');
    const isActive = overlay.classList.contains('active');
    if (hidden !== 'false' && !isActive) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPendingLevel();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      confirmPendingLevel();
    }
  });

})();
