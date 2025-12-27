/**
 * Manual drop controller for the spire viewports.
 * Centralizes the click and keyboard bindings so `main.js` no longer owns the handlers.
 * @param {Object} options - Dependency injection container.
 * @param {() => string} options.getActiveTabId - Returns the currently active tab id.
 * @param {() => any} options.getSandSimulation - Getter for the Aleph sand simulation instance.
 * @param {() => any} options.getFluidSimulation - Getter for the Bet fluid simulation instance.
 * @param {() => any} options.getLamedSimulation - Getter for the Lamed gravity simulation instance.
 * @param {() => any} options.getTsadiSimulation - Getter for the Tsadi binding simulation instance.
 * @param {(spireId: string) => string|null} [options.getSelectedGem] - Resolver for the currently slotted spire gem.
 * @param {(gemId: string) => object|null} [options.consumeGem] - Consumer that decrements a gem from the inventory and returns its definition.
 * @param {(count: number) => void} options.addIterons - Adds iterons to the Shin bank.
 * @returns {{ initializeManualDropHandlers: () => void }} Controller helpers.
 */
export function createManualDropController({
  getActiveTabId,
  getSandSimulation,
  getFluidSimulation,
  getLamedSimulation,
  getTsadiSimulation,
  getSelectedGem,
  consumeGem,
  addIterons,
}) {
  /**
   * Convert a gem palette entry into a normalized RGB payload so all spires can reuse it safely.
   * @param {Object} color - Gem palette color sourced from GEM_DEFINITIONS.
   * @returns {{ css: string, rgb: {r:number,g:number,b:number} }|null} Normalized color payload.
   */
  function normalizeGemColor(color) {
    if (!color || !Number.isFinite(color.hue) || !Number.isFinite(color.saturation) || !Number.isFinite(color.lightness)) {
      return null;
    }

    const h = ((color.hue % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, color.saturation)) / 100;
    const l = Math.max(0, Math.min(100, color.lightness)) / 100;

    // Standard HSL to RGB conversion to keep gradients in sync across spires.
    const hueToRgb = (p, q, t) => {
      let temp = t;
      if (temp < 0) temp += 1;
      if (temp > 1) temp -= 1;
      if (temp < 1 / 6) return p + (q - p) * 6 * temp;
      if (temp < 1 / 2) return q;
      if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hueToRgb(p, q, h / 360 + 1 / 3) * 255);
    const g = Math.round(hueToRgb(p, q, h / 360) * 255);
    const b = Math.round(hueToRgb(p, q, h / 360 - 1 / 3) * 255);

    return {
      css: `rgb(${r}, ${g}, ${b})`,
      rgb: { r, g, b },
    };
  }

  /**
   * Consume the selected gem for a spire and return its definition and normalized color data.
   * @param {string} spireType - Target spire identifier.
   * @returns {{definition: object, color: {css:string,rgb:{r:number,g:number,b:number}}}|null} Resolved gem payload.
   */
  function resolveGemForSpire(spireType) {
    if (typeof getSelectedGem !== 'function' || typeof consumeGem !== 'function') {
      return null;
    }
    const gemId = getSelectedGem(spireType);
    if (!gemId) {
      return null;
    }
    const definition = consumeGem(gemId);
    if (!definition) {
      return null;
    }
    const color = normalizeGemColor(definition.color);
    return { definition, color };
  }

  /**
   * Attach manual drop listeners so each spire can spawn one resource on click or Space.
   * Guards remain inline to mirror the original behavior without altering gameplay.
   */
  function initializeManualDropHandlers() {
    let pointerMoved = false;
    let pointerDownTime = 0;
    const MAX_CLICK_DURATION = 300; // ms
    const MAX_CLICK_MOVEMENT = 5; // px
    let startX = 0;
    let startY = 0;

    const tabForSpire = (spireType) => {
      switch (spireType) {
        case 'aleph':
          return 'powder';
        case 'bet':
          // Route Bet Spire manual drops to the Achievements tab now hosting the terrarium.
          return 'achievements';
        default:
          return spireType;
      }
    };

    const handleManualDrop = (spireType) => {
      if (spireType === 'kuf') {
        return;
      }

      const sandSimulation = getSandSimulation?.();
      const fluidSimulation = getFluidSimulation?.();
      const lamedSimulation = getLamedSimulation?.();
      const tsadiSimulation = getTsadiSimulation?.();

      switch (spireType) {
        case 'aleph':
          if (sandSimulation && typeof sandSimulation.spawnGrain === 'function') {
            const gem = resolveGemForSpire('aleph');
            if (gem) {
              const moteSize = gem.definition.moteSize || sandSimulation.maxDropSize || 1;
              // Spawn a gem-colored mote so Aleph visually echoes the selected crystal.
              sandSimulation.spawnGrain({
                size: moteSize,
                color: gem.color?.rgb,
                source: 'gem',
              });
              break;
            }
            const moteSize = sandSimulation.maxDropSize || 1;
            sandSimulation.spawnGrain({ size: moteSize, source: 'manual' });
          }
          break;
        case 'bet':
          if (fluidSimulation && typeof fluidSimulation.spawnGrain === 'function') {
            const dropSize = fluidSimulation.maxDropSize || 1;
            fluidSimulation.spawnGrain({ size: dropSize, source: 'manual' });
          }
          break;
        case 'lamed':
          if (lamedSimulation && typeof lamedSimulation.spawnStar === 'function') {
            const gem = resolveGemForSpire('lamed');
            if (gem) {
              // Gem tiers map directly to mass multipliers (Quartz=2, Ruby=3, ...).
              const massMultiplier = Math.max(1, gem.definition.moteSize || 1);
              lamedSimulation.spawnStar({
                massMultiplier,
                color: gem.color?.rgb,
              });
              break;
            }
            lamedSimulation.spawnStar();
          }
          break;
        case 'tsadi':
          if (tsadiSimulation && typeof tsadiSimulation.spawnParticle === 'function') {
            const gem = resolveGemForSpire('tsadi');
            if (gem) {
              // Each gem tier pushes the spawn to a higher particle tier while applying shimmer.
              const bonusTierOffset = Math.max(0, (gem.definition.moteSize || 1) - 1);
              tsadiSimulation.spawnParticle({
                tier: -1,
                tierOffset: bonusTierOffset,
                color: gem.color?.css,
                shimmer: true,
              });
              break;
            }
            tsadiSimulation.spawnParticle();
          }
          break;
        case 'shin':
          if (typeof addIterons === 'function') {
            addIterons(1);
          }
          break;
      }
    };

    // Keep a short debounce so duplicate listeners or rapid multi-clicks don't inject
    // multiple manual drops for a single tap. The map tracks the last accepted click per spire.
    const lastDropTimeByType = new Map();
    const MIN_CLICK_INTERVAL_MS = 75;

    const spireTargets = [
      { type: 'aleph', selectors: ['powder-viewport', 'powder-basin', 'powder-canvas'] },
      {
        type: 'bet',
        // Bind manual drops to the Achievements terrarium canvas/basin after the tab move.
        selectors: [
          'achievements-terrarium-viewport',
          'achievements-terrarium-basin',
          'achievements-terrarium-canvas',
        ],
      },
      { type: 'lamed', selectors: ['lamed-basin'] },
      { type: 'tsadi', selectors: ['tsadi-basin'] },
      { type: 'shin', selectors: ['shin-fractal-content'] },
    ];

    spireTargets.forEach(({ type, selectors }) => {
      const uniqueSelectors = Array.from(new Set(selectors));
      uniqueSelectors.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) {
          return;
        }

        const handlePointerDown = (event) => {
          pointerMoved = false;
          pointerDownTime = Date.now();
          startX = event.clientX;
          startY = event.clientY;
        };

        const handlePointerMove = (event) => {
          const dx = Math.abs(event.clientX - startX);
          const dy = Math.abs(event.clientY - startY);
          if (dx > MAX_CLICK_MOVEMENT || dy > MAX_CLICK_MOVEMENT) {
            pointerMoved = true;
          }
        };

        const handleClick = (event) => {
          const duration = Date.now() - pointerDownTime;
          if (pointerMoved || duration >= MAX_CLICK_DURATION) {
            return;
          }

          // Prevent bubbling into parent cards that also grant click rewards so a single tap
          // doesn't trigger multiple mote or drop spawns (e.g., Aleph spire double drops).
          event?.stopPropagation?.();

          const activeTab = getActiveTabId();
          if (activeTab !== tabForSpire(type)) {
            return;
          }

          const lastDropTime = lastDropTimeByType.get(type) || 0;
          if (Date.now() - lastDropTime < MIN_CLICK_INTERVAL_MS) {
            return;
          }

          lastDropTimeByType.set(type, Date.now());

          handleManualDrop(type);
        };

        // Avoid binding duplicate listeners if initialization runs more than once.
        if (element.dataset.manualDropBound === 'true') {
          return;
        }

        element.dataset.manualDropBound = 'true';
        element.addEventListener('pointerdown', handlePointerDown);
        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('click', handleClick);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.code === 'Space') {
        const activeTab = getActiveTabId();
        let spireType = null;

        switch (activeTab) {
          case 'powder':
            spireType = 'aleph';
            break;
          case 'fluid':
            spireType = 'bet';
            break;
          case 'lamed':
            spireType = 'lamed';
            break;
          case 'tsadi':
            spireType = 'tsadi';
            break;
          case 'shin':
            spireType = 'shin';
            break;
          case 'kuf':
            return;
        }

        if (spireType) {
          event.preventDefault();
          handleManualDrop(spireType);
        }
      }
    });
  }

  return {
    initializeManualDropHandlers,
  };
}
