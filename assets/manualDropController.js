/**
 * Manual drop controller for the spire viewports.
 * Centralizes the click and keyboard bindings so `main.js` no longer owns the handlers.
 * @param {Object} options - Dependency injection container.
 * @param {() => string} options.getActiveTabId - Returns the currently active tab id.
 * @param {() => any} options.getSandSimulation - Getter for the Aleph sand simulation instance.
 * @param {() => any} options.getFluidSimulation - Getter for the Bet fluid simulation instance.
 * @param {() => any} options.getLamedSimulation - Getter for the Lamed gravity simulation instance.
 * @param {() => any} options.getTsadiSimulation - Getter for the Tsadi binding simulation instance.
 * @param {(count: number) => void} options.addIterons - Adds iterons to the Shin bank.
 * @returns {{ initializeManualDropHandlers: () => void }} Controller helpers.
 */
export function createManualDropController({
  getActiveTabId,
  getSandSimulation,
  getFluidSimulation,
  getLamedSimulation,
  getTsadiSimulation,
  addIterons,
}) {
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
          return 'fluid';
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
            lamedSimulation.spawnStar();
          }
          break;
        case 'tsadi':
          if (tsadiSimulation && typeof tsadiSimulation.spawnParticle === 'function') {
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
      { type: 'bet', selectors: ['fluid-viewport', 'fluid-basin', 'fluid-canvas'] },
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

