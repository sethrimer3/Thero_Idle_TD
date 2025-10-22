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
  ];

  const levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));
  const levelState = new Map();

  let tabs = [];
  let panels = [];
  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;
  let overlay = null;
  let overlayLabel = null;
  let overlayTitle = null;
  let overlayExample = null;
  let activeLevelId = null;
  let pendingLevel = null;
  let activeTabIndex = 0;
  let lastLevelTrigger = null;

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

  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetInactive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
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
  };

  let resourceTicker = null;
  let lastResourceTick = 0;

  const powderLog = [];
  const POWDER_LOG_LIMIT = 6;

  const idleLevelRuns = new Map();

  const firstLevelConfig = {
    id: 'Conjecture - 1',
    displayName: 'Lemniscate Hypothesis',
    startEnergy: 140,
    energyCap: 360,
    energyPerKill: 18,
    passiveEnergyPerSecond: 8,
    lives: 5,
    towerCost: 60,
    tower: {
      damage: 28,
      rate: 1.25,
      range: 0.24,
    },
    waves: [
      {
        label: 'E glyphs',
        count: 6,
        interval: 1.6,
        hp: 85,
        speed: 0.082,
        reward: 12,
        color: 'rgba(139, 247, 255, 0.9)',
      },
      {
        label: 'divisor scouts',
        count: 4,
        interval: 1.9,
        hp: 130,
        speed: 0.09,
        reward: 18,
        color: 'rgba(255, 125, 235, 0.92)',
      },
      {
        label: 'prime counters',
        count: 2,
        interval: 2.4,
        hp: 220,
        speed: 0.085,
        reward: 26,
        color: 'rgba(255, 228, 120, 0.95)',
      },
    ],
    rewardScore: 1.6 * 10 ** 44,
    rewardFlux: 45,
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
  };

  const idleLevelConfigs = new Map();

  levelBlueprints.forEach((level, index) => {
    if (level.id === firstLevelConfig.id) {
      return;
    }

    const levelNumber = index + 1;
    const runDuration = 90 + levelNumber * 12;
    const rewardMultiplier = 1 + levelNumber * 0.08;

    const rewardScore =
      baseResources.scoreRate * (runDuration / 12) * rewardMultiplier;
    const rewardFlux = 45 + levelNumber * 10;
    const rewardEnergy = 35 + levelNumber * 8;

    idleLevelConfigs.set(level.id, {
      runDuration,
      rewardScore,
      rewardFlux,
      rewardEnergy,
    });
  });

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
      this.slotButtons = Array.isArray(options.slotButtons) ? options.slotButtons : [];
      this.onVictory = typeof options.onVictory === 'function' ? options.onVictory : null;
      this.onDefeat = typeof options.onDefeat === 'function' ? options.onDefeat : null;
      this.onCombatStart =
        typeof options.onCombatStart === 'function' ? options.onCombatStart : null;

      this.levelConfig = null;
      this.levelActive = false;
      this.shouldAnimate = false;
      this.combatActive = false;
      this.resolvedOutcome = null;

      this.renderWidth = this.canvas ? this.canvas.clientWidth : 0;
      this.renderHeight = this.canvas ? this.canvas.clientHeight : 0;
      this.pixelRatio = 1;

      this.arcPhase = 0;
      this.energy = 0;
      this.lives = 0;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;

      this.pathSegments = [];
      this.pathLength = 0;

      this.slots = new Map();
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];

      this.animationId = null;
      this.lastTimestamp = 0;

      this.resizeObserver = null;
      this.resizeHandler = () => this.syncCanvasSize();

      this.towerIdCounter = 0;
      this.hoverPlacement = null;

      this.pointerMoveHandler = (event) => this.handleCanvasPointerMove(event);
      this.pointerLeaveHandler = () => this.clearPlacementPreview();
      this.pointerClickHandler = (event) => this.handleCanvasClick(event);

      this.registerSlots();
      this.bindStartButton();
      this.attachResizeObservers();
      this.attachCanvasInteractions();

      this.disableSlots(true);
      this.updateHud();
      this.updateProgress();
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

    bindStartButton() {
      if (!this.startButton) {
        return;
      }
      this.startButton.addEventListener('click', () => this.handleStartButton());
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

    enterLevel(level) {
      if (!this.container) {
        return;
      }

      if (!level || level.id !== firstLevelConfig.id) {
        this.levelActive = false;
        this.levelConfig = null;
        this.combatActive = false;
        this.shouldAnimate = false;
        this.stopLoop();
        this.disableSlots(true);
        this.enemies = [];
        this.projectiles = [];
        this.towers = [];
        this.energy = 0;
        this.lives = 0;
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
          this.progressEl.textContent = 'Select Lemniscate Hypothesis to battle.';
        }
        if (this.startButton) {
          this.startButton.textContent = 'Preview Only';
          this.startButton.disabled = true;
        }
        return;
      }

      this.levelActive = true;
      this.levelConfig = firstLevelConfig;
      this.shouldAnimate = true;
      this.resetState();
      this.enableSlots();
      this.syncCanvasSize();
      this.ensureLoop();

      if (this.startButton) {
        this.startButton.textContent = 'Commence Wave';
        this.startButton.disabled = false;
      }
      if (this.messageEl) {
        this.messageEl.textContent =
          'Sketch α lattices anywhere with adequate space—the anchors are merely suggested glyphs.';
      }
      if (this.progressEl) {
        this.progressEl.textContent = 'Wave prep underway.';
      }
      this.updateHud();
      this.updateProgress();
    }

    leaveLevel() {
      this.levelActive = false;
      this.levelConfig = null;
      this.combatActive = false;
      this.shouldAnimate = false;
      this.stopLoop();
      this.disableSlots(true);
      this.enemies = [];
      this.projectiles = [];
      this.towers = [];
      this.hoverPlacement = null;
      this.energy = 0;
      this.lives = 0;
      this.resolvedOutcome = null;
      this.arcPhase = 0;
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
    }

    resetState() {
      if (!this.levelConfig) {
        this.energy = 0;
        this.lives = 0;
      } else {
        this.energy = this.levelConfig.startEnergy;
        this.lives = this.levelConfig.lives;
      }
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.activeWave = null;
      this.enemyIdCounter = 0;
      this.towerIdCounter = 0;
      this.arcPhase = 0;
      this.combatActive = false;
      this.resolvedOutcome = null;
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

    updateTowerPositions() {
      if (!this.levelConfig) {
        return;
      }
      const baseRange = Math.min(this.renderWidth, this.renderHeight) * this.levelConfig.tower.range;
      this.towers.forEach((tower) => {
        const { x, y } = this.getCanvasPosition(tower.normalized);
        tower.x = x;
        tower.y = y;
        tower.range = baseRange;
      });
      if (this.hoverPlacement) {
        this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
        this.hoverPlacement.range = baseRange;
      }
    }

    handleCanvasPointerMove(event) {
      if (!this.levelActive || !this.levelConfig) {
        this.clearPlacementPreview();
        return;
      }

      const normalized = this.getNormalizedFromEvent(event);
      if (!normalized) {
        this.clearPlacementPreview();
        return;
      }

      const baseRange = Math.min(this.renderWidth, this.renderHeight) * this.levelConfig.tower.range;
      const position = this.getCanvasPosition(normalized);
      const hoveredTower = this.findTowerAt(position);

      if (hoveredTower) {
        this.hoverPlacement = {
          normalized: { ...hoveredTower.normalized },
          position: { x: hoveredTower.x, y: hoveredTower.y },
          range: baseRange,
          valid: false,
          target: hoveredTower,
          reason: 'Select to release lattice.',
        };
      } else {
        const validation = this.validatePlacement(normalized, { allowPathOverlap: false });
        const energyReady = this.energy >= this.levelConfig.towerCost;
        this.hoverPlacement = {
          normalized,
          position,
          range: baseRange,
          valid: energyReady && validation.valid,
          reason: energyReady ? validation.reason : 'Need additional energy.',
        };
      }

      if (!this.shouldAnimate) {
        this.draw();
      }
    }

    handleCanvasClick(event) {
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

      this.addTowerAt(normalized);
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

    addTowerAt(normalized, options = {}) {
      if (!this.levelConfig || !normalized) {
        return;
      }

      if (this.energy < this.levelConfig.towerCost) {
        const needed = Math.ceil(this.levelConfig.towerCost - this.energy);
        if (this.messageEl) {
          this.messageEl.textContent = `Need ${needed} Ξ more to lattice an α tower.`;
        }
        return;
      }

      const placement = this.validatePlacement(normalized, options);
      if (!placement.valid) {
        if (this.messageEl && placement.reason) {
          this.messageEl.textContent = placement.reason;
        }
        return;
      }

      const baseRange = Math.min(this.renderWidth, this.renderHeight) * this.levelConfig.tower.range;
      const tower = {
        id: `tower-${(this.towerIdCounter += 1)}`,
        normalized: { ...normalized },
        x: placement.position.x,
        y: placement.position.y,
        range: baseRange,
        damage: this.levelConfig.tower.damage,
        rate: this.levelConfig.tower.rate,
        cooldown: 0,
        slot: options.slot || null,
      };

      this.towers.push(tower);

      if (options.slot) {
        options.slot.tower = tower;
        if (options.slot.button) {
          options.slot.button.classList.add('tower-built');
          options.slot.button.setAttribute('aria-pressed', 'true');
        }
      }

      this.energy = Math.max(0, this.energy - this.levelConfig.towerCost);
      this.hoverPlacement = null;
      if (this.messageEl) {
        this.messageEl.textContent = 'α lattice anchored—harmonics align.';
      }
      this.updateHud();
      this.draw();
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
        const refund = Math.round(this.levelConfig.towerCost * 0.7);
        this.energy = Math.min(this.levelConfig.energyCap, this.energy + refund);
        if (this.messageEl) {
          this.messageEl.textContent = `Lattice released—refunded ${refund} Ξ.`;
        }
      }

      this.updateHud();
      this.draw();
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
          return { valid: false, reason: 'Too close to another α lattice.', position };
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
      if (!this.levelActive || !this.levelConfig) {
        if (this.messageEl) {
          this.messageEl.textContent =
            'Select Lemniscate Hypothesis, then etch α lattices directly onto the canvas.';
        }
        return;
      }

      if (slot.tower) {
        this.sellTower(slot.tower, { slot });
        return;
      }

      if (this.energy < this.levelConfig.towerCost) {
        const needed = Math.ceil(this.levelConfig.towerCost - this.energy);
        if (this.messageEl) {
          this.messageEl.textContent = `Need ${needed} Ξ more to lattice an α tower.`;
        }
        return;
      }

      this.addTowerAt(slot.normalized, { slot, allowPathOverlap: true });
    }

    placeTower(slot) {
      this.addTowerAt(slot?.normalized || null, { slot, allowPathOverlap: true });
    }

    removeTower(slot) {
      this.sellTower(slot?.tower || null, { slot });
    }

    handleStartButton() {
      if (!this.levelActive || !this.levelConfig || this.combatActive) {
        return;
      }
      if (!this.towers.length) {
        if (this.messageEl) {
          this.messageEl.textContent = 'Anchor at least one α tower before commencing.';
        }
        return;
      }

      this.combatActive = true;
      this.resolvedOutcome = null;
      this.waveIndex = 0;
      this.waveTimer = 0;
      this.enemyIdCounter = 0;
      this.enemies = [];
      this.projectiles = [];
      this.activeWave = this.createWaveState(this.levelConfig.waves[0]);
      this.lives = this.levelConfig.lives;

      if (this.startButton) {
        this.startButton.disabled = true;
        this.startButton.textContent = 'Wave Running';
      }
      if (this.messageEl) {
        this.messageEl.textContent = `Wave 1 — ${this.activeWave.config.label} advance.`;
      }
      this.updateHud();
      this.updateProgress();

      if (this.onCombatStart) {
        this.onCombatStart(this.levelConfig.id);
      }
    }

    createWaveState(config) {
      return {
        config,
        spawned: 0,
        nextSpawn: 0,
      };
    }

    update(delta) {
      if (!this.levelActive || !this.levelConfig) {
        return;
      }

      this.arcPhase = (this.arcPhase + delta * (this.levelConfig.arcSpeed || 0.2)) % 1;

      if (!this.combatActive) {
        this.energy = Math.min(
          this.levelConfig.energyCap,
          this.energy + this.levelConfig.passiveEnergyPerSecond * delta,
        );
        this.updateHud();
        this.updateProgress();
        return;
      }

      this.waveTimer += delta;
      this.spawnEnemies();
      this.updateTowers(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
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
        };
        this.enemies.push(enemy);
        this.activeWave.spawned += 1;
        this.activeWave.nextSpawn += config.interval;
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
        this.handleVictory();
        return;
      }

      this.waveIndex += 1;
      this.activeWave = this.createWaveState(this.levelConfig.waves[this.waveIndex]);
      this.waveTimer = 0;
      if (this.messageEl) {
        this.messageEl.textContent = `Wave ${this.waveIndex + 1} — ${this.activeWave.config.label}.`;
      }
      this.updateHud();
      this.updateProgress();
    }

    handleEnemyBreach(enemy) {
      this.lives = Math.max(0, this.lives - 1);
      if (this.messageEl) {
        this.messageEl.textContent = `${enemy.label || 'Glyph'} breached the core!`;
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

      const energyGain = (this.levelConfig?.energyPerKill || 0) + (enemy.reward || 0);
      this.energy = Math.min(this.levelConfig.energyCap, this.energy + energyGain);

      if (this.messageEl) {
        this.messageEl.textContent = `${enemy.label || 'Glyph'} collapsed · +${Math.round(
          energyGain,
        )} Ξ.`;
      }
      this.updateHud();
      this.updateProgress();
    }

    handleVictory() {
      if (this.resolvedOutcome === 'victory') {
        return;
      }
      this.combatActive = false;
      this.resolvedOutcome = 'victory';
      this.activeWave = null;
      this.energy = Math.min(
        this.levelConfig.energyCap,
        this.energy + (this.levelConfig.rewardEnergy || 0),
      );
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Run Again';
      }
      if (this.messageEl) {
        this.messageEl.textContent = 'Victory! The lemniscate is sealed.';
      }
      this.updateHud();
      this.updateProgress();
      if (this.onVictory) {
        this.onVictory(this.levelConfig.id, {
          rewardScore: this.levelConfig.rewardScore,
          rewardFlux: this.levelConfig.rewardFlux,
          rewardEnergy: this.levelConfig.rewardEnergy,
          towers: this.towers.length,
          lives: this.lives,
        });
      }
    }

    handleDefeat() {
      if (this.resolvedOutcome === 'defeat') {
        return;
      }
      this.combatActive = false;
      this.resolvedOutcome = 'defeat';
      this.activeWave = null;
      this.energy = Math.min(
        this.levelConfig.energyCap,
        Math.max(this.energy, this.levelConfig.startEnergy),
      );
      if (this.startButton) {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Retry Wave';
      }
      if (this.messageEl) {
        this.messageEl.textContent = 'Defense collapsed—recalibrate the anchors and retry.';
      }
      this.updateHud();
      this.updateProgress();
      if (this.onDefeat) {
        this.onDefeat(this.levelConfig.id, { towers: this.towers.length });
      }
    }

    updateHud() {
      if (this.waveEl) {
        if (!this.levelConfig) {
          this.waveEl.textContent = '—';
        } else {
          const total = this.levelConfig.waves.length;
          const displayWave = this.combatActive
            ? this.waveIndex + 1
            : Math.min(this.waveIndex + 1, total);
          this.waveEl.textContent = `${displayWave}/${total}`;
        }
      }

      if (this.healthEl) {
        this.healthEl.textContent = this.levelConfig
          ? `${this.lives}/${this.levelConfig.lives}`
          : '—';
      }

      if (this.energyEl) {
        this.energyEl.textContent = this.levelConfig
          ? `${Math.round(this.energy)} Ξ`
          : '—';
      }
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
          this.progressEl.textContent = 'Victory sealed—glyph flux stabilized.';
        } else if (this.resolvedOutcome === 'defeat') {
          this.progressEl.textContent = 'Defense collapsed—rebuild the proof lattice.';
        } else {
          this.progressEl.textContent = 'Wave prep underway.';
        }
        return;
      }

      const total = this.levelConfig.waves.length;
      const current = Math.min(this.waveIndex + 1, total);
      const remainingInWave = this.activeWave
        ? Math.max(0, this.activeWave.config.count - this.activeWave.spawned)
        : 0;
      const remaining = remainingInWave + this.enemies.length;
      const label = this.levelConfig.waves[this.waveIndex]?.label || 'glyphs';
      this.progressEl.textContent = `Wave ${current}/${total} — ${remaining} ${label} remaining.`;
    }

    getCanvasPosition(normalized) {
      return {
        x: normalized.x * this.renderWidth,
        y: normalized.y * this.renderHeight,
      };
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
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.7)';
      ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.16]);
      ctx.lineDashOffset = -this.arcPhase * this.pathLength;
      ctx.moveTo(this.pathSegments[0].start.x, this.pathSegments[0].start.y);
      this.pathSegments.forEach((segment) => {
        ctx.lineTo(segment.end.x, segment.end.y);
      });
      ctx.stroke();
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
      const { position, range, valid } = this.hoverPlacement;
      const ctx = this.ctx;
      const stroke = valid ? 'rgba(139, 247, 255, 0.7)' : 'rgba(255, 108, 140, 0.75)';
      const fill = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(255, 108, 140, 0.14)';

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(position.x, position.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const previewRange = range || Math.min(this.renderWidth, this.renderHeight) * this.levelConfig.tower.range;
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.arc(position.x, position.y, previewRange, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(position.x, position.y, 18, 0, Math.PI * 2);
      ctx.fill();
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
    if (!level || level.id === firstLevelConfig.id) {
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

    if (levelId === activeLevelId && levelId !== firstLevelConfig.id) {
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
    if (!levelId || levelId === firstLevelConfig.id) {
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
      if (activeLevelId && activeLevelId !== firstLevelConfig.id) {
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

    if (activeLevelId && activeLevelId !== firstLevelConfig.id) {
      updateIdleLevelDisplay(idleLevelRuns.get(activeLevelId) || null);
    }
  }

  function updateIdleLevelDisplay(activeRunner = null) {
    if (!activeLevelId || activeLevelId === firstLevelConfig.id) {
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
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: true,
      lastResult: { outcome: 'victory', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;

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
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: existing.completed,
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

    if (!state.entered) {
      pendingLevel = level;
      showLevelOverlay(level);
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function showLevelOverlay(level) {
    if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
    overlayLabel.textContent = level.id;
    overlayTitle.textContent = level.title;
    overlayExample.textContent = level.example;
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
    const isInteractive = level.id === firstLevelConfig.id;
    const updatedState = { ...currentState, entered: true, running: !isInteractive ? true : false };
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
      playfield.enterLevel(level);
    }

    if (!isInteractive) {
      beginIdleLevelRun(level);
    } else {
      updateIdleLevelDisplay();
    }
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

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');

      if (!entered) {
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

  function calculatePowderBonuses() {
    // Stabilizing the sandfall adds an offset term to Ψ(g) = 2.7 · sin(t), yielding steady grain capture.
    const sandBonus = powderState.sandOffset > 0 ? 0.15 + powderState.sandOffset * 0.03 : 0;
    // Surveying dunes raises h inside Δm = log₂(h + 1), boosting energy conduits.
    const duneBonus = Math.log2(powderState.duneHeight + 1) * 0.04;

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
      resourceElements.score.textContent = formatGameNumber(resourceState.score);
    }
    if (resourceElements.energy) {
      resourceElements.energy.textContent = `+${formatGameNumber(resourceState.energyRate)} TD/s`;
    }
    if (resourceElements.flux) {
      resourceElements.flux.textContent = `+${formatGameNumber(resourceState.fluxRate)} Powder/min`;
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

    updateIdleRuns(timestamp);

    if (!lastResourceTick) {
      lastResourceTick = timestamp;
    }

    const elapsed = Math.max(0, timestamp - lastResourceTick);
    lastResourceTick = timestamp;

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

    refreshPowderSystems();
    recordPowderEvent(powderState.sandOffset > 0 ? 'sand-stabilized' : 'sand-released');
  }

  function surveyRidgeHeight() {
    if (powderState.duneHeight >= powderConfig.duneHeightMax) {
      recordPowderEvent('dune-max');
      return;
    }

    powderState.duneHeight += 1;
    refreshPowderSystems();
    recordPowderEvent('dune-raise', { height: powderState.duneHeight });
  }

  function chargeCrystalMatrix() {
    if (powderState.charges < 3) {
      powderState.charges += 1;
      refreshPowderSystems();
      recordPowderEvent('crystal-charge', { charges: powderState.charges });
      return;
    }

    const pulseBonus = releaseCrystalPulse(powderState.charges);
    powderState.charges = 0;
    refreshPowderSystems(pulseBonus);
    recordPowderEvent('crystal-release', { pulseBonus });
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
    if (powderElements.totalMultiplier) {
      powderElements.totalMultiplier.textContent = `×${formatDecimal(
        currentPowderBonuses.totalMultiplier,
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
      const total = currentPowderBonuses.totalMultiplier;
      powderElements.sigilEntries.forEach((sigil) => {
        const threshold = Number.parseFloat(sigil.dataset.sigilThreshold);
        if (!Number.isFinite(threshold)) {
          return;
        }
        if (total >= threshold) {
          sigil.classList.add('sigil-reached');
        } else {
          sigil.classList.remove('sigil-reached');
        }
      });
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
      const height = powderState.duneHeight;
      const logValue = Math.log2(height + 1);
      powderElements.duneFormula.textContent = `Δm = log₂(${height} + 1) = ${formatDecimal(
        logValue,
        2,
      )}`;
    }

    if (powderElements.duneNote) {
      powderElements.duneNote.textContent = `Channel bonus: +${formatPercentage(
        currentPowderBonuses.duneBonus,
      )} to energy gain.`;
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

    playfieldElements.container = document.getElementById('playfield');
    playfieldElements.canvas = document.getElementById('playfield-canvas');
    playfieldElements.message = document.getElementById('playfield-message');
    playfieldElements.wave = document.getElementById('playfield-wave');
    playfieldElements.health = document.getElementById('playfield-health');
    playfieldElements.energy = document.getElementById('playfield-energy');
    playfieldElements.progress = document.getElementById('playfield-progress');
    playfieldElements.startButton = document.getElementById('playfield-start');
    playfieldElements.slots = Array.from(document.querySelectorAll('.tower-slot'));

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
        slotButtons: playfieldElements.slots,
        onVictory: handlePlayfieldVictory,
        onDefeat: handlePlayfieldDefeat,
        onCombatStart: handlePlayfieldCombatStart,
      });
    }

    bindStatusElements();
    bindPowderControls();
    updatePowderLogDisplay();
    updateResourceRates();
    updatePowderDisplay();
    ensureResourceTicker();

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
