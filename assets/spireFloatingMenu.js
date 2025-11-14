/**
 * Create a controller responsible for wiring the floating spire menu navigation
 * and keeping the resource counters in sync with live game state.
 * @param {Object} options - Dependency injection object used during wiring.
 * @returns {{ initialize: Function, updateCounts: Function }} Controller API.
 */
export function createSpireFloatingMenuController(options = {}) {
  /**
   * Provide safe fallbacks so unit tests or non-DOM environments can instantiate
   * the controller without crashing when collaborators are unavailable.
   */
  const {
    formatGameNumber = (value) => String(value ?? 0),
    formatWholeNumber = (value) => String(value ?? 0),
    getCurrentIdleMoteBank = () => 0,
    getCurrentFluidDropBank = () => 0,
    getLamedSparkBank = () => 0,
    getTsadiParticleBank = () => 0,
    getShinGlyphs = () => 0,
    getKufGlyphs = () => 0,
    isFluidUnlocked = () => false,
    isLamedUnlocked = () => false,
    isTsadiUnlocked = () => false,
    isShinUnlocked = () => false,
    isKufUnlocked = () => false,
    setActiveTab = () => {},
    playMenuSelectSfx = () => {},
  } = options;

  /**
   * Helper that resolves the global document object only when available so the
   * controller can fail gracefully inside server-side rendering contexts.
   */
  function getDocument() {
    if (typeof document === 'undefined') {
      return null;
    }
    return document;
  }

  /**
   * Attach click handlers to menu entries and toggle buttons so the floating
   * navigation reacts to user interaction.
   */
  function initialize() {
    const doc = getDocument();
    if (!doc) {
      return;
    }

    const menuItems = doc.querySelectorAll('.spire-menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        const targetTab = item.dataset.tab;
        if (!targetTab) {
          return;
        }
        setActiveTab(targetTab);
        playMenuSelectSfx();
      });
    });

    const spireIds = ['powder', 'fluid', 'lamed', 'tsadi', 'shin', 'kuf'];
    const visibleClass = 'spire-floating-menu--visible';
    // Dedicated class keeps toggle buttons hidden while their tray is expanded.
    const toggleHiddenClass = 'spire-menu-toggle--hidden';

    spireIds.forEach((spireId) => {
      const toggleButton = doc.getElementById(`spire-menu-toggle-${spireId}`);
      const closeButton = doc.getElementById(`spire-menu-close-${spireId}`);
      const menu = doc.getElementById(`spire-floating-menu-${spireId}`);

      if (toggleButton && menu) {
        toggleButton.addEventListener('click', () => {
          const isVisible = menu.classList.contains(visibleClass);

          doc.querySelectorAll('.spire-floating-menu').forEach((otherMenu) => {
            if (otherMenu === menu) {
              return;
            }
            otherMenu.classList.remove(visibleClass);
            const otherId = otherMenu.id.replace('spire-floating-menu-', '');
            const otherToggle = doc.getElementById(`spire-menu-toggle-${otherId}`);
            if (otherToggle) {
              otherToggle.setAttribute('aria-expanded', 'false');
              // Ensure previously hidden toggles reappear after another tray closes.
              otherToggle.classList.remove(toggleHiddenClass);
            }
          });

          if (isVisible) {
            menu.classList.remove(visibleClass);
            toggleButton.setAttribute('aria-expanded', 'false');
            // Restore the toggle when collapsing the active tray.
            toggleButton.classList.remove(toggleHiddenClass);
          } else {
            menu.classList.add(visibleClass);
            toggleButton.setAttribute('aria-expanded', 'true');
            // Conceal the toggle while its corresponding tray is open.
            toggleButton.classList.add(toggleHiddenClass);
          }
        });
      }

      if (closeButton && menu) {
        closeButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          menu.classList.remove(visibleClass);
          if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'false');
            // Unhide the toggle when the explicit close control is used.
            toggleButton.classList.remove(toggleHiddenClass);
          }
        });
      }
    });
  }

  /**
   * Refresh text content and visibility for every floating menu counter so the
   * overlay accurately reflects stored resources and unlock states.
   */
  function updateCounts() {
    const doc = getDocument();
    if (!doc) {
      return;
    }

    const bankedMotes = getCurrentIdleMoteBank();
    const bankedDrops = getCurrentFluidDropBank();
    const bankedSparks = getLamedSparkBank();
    const bankedTsadiParticles = getTsadiParticleBank();
    const bankedShinGlyphs = getShinGlyphs();
    const bankedKufGlyphs = getKufGlyphs();

    const moteCountIds = [
      'spire-menu-mote-count',
      'spire-menu-mote-count-fluid',
      'spire-menu-mote-count-lamed',
      'spire-menu-mote-count-tsadi',
      'spire-menu-mote-count-shin',
      'spire-menu-mote-count-kuf',
    ];
    moteCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedMotes);
      }
    });

    const fluidCountIds = [
      'spire-menu-fluid-count',
      'spire-menu-fluid-count-fluid',
      'spire-menu-fluid-count-lamed',
      'spire-menu-fluid-count-tsadi',
      'spire-menu-fluid-count-shin',
      'spire-menu-fluid-count-kuf',
    ];
    fluidCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedDrops);
      }
    });

    const lamedCountIds = [
      'spire-menu-lamed-count',
      'spire-menu-lamed-count-powder',
      'spire-menu-lamed-count-fluid',
      'spire-menu-lamed-count-tsadi',
      'spire-menu-lamed-count-shin',
      'spire-menu-lamed-count-kuf',
    ];
    lamedCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedSparks);
      }
    });

    const lamedReservoir = doc.getElementById('lamed-reservoir');
    if (lamedReservoir) {
      const sparkLabel = formatWholeNumber(Math.floor(bankedSparks));
      lamedReservoir.textContent = `${sparkLabel} Sparks`;
    }

    const tsadiCountIds = [
      'spire-menu-tsadi-count',
      'spire-menu-tsadi-count-powder',
      'spire-menu-tsadi-count-fluid',
      'spire-menu-tsadi-count-lamed',
      'spire-menu-tsadi-count-shin',
      'spire-menu-tsadi-count-kuf',
    ];
    tsadiCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedTsadiParticles);
      }
    });

    const tsadiBankEl = doc.getElementById('tsadi-bank');
    if (tsadiBankEl) {
      const particleLabel = formatWholeNumber(Math.floor(bankedTsadiParticles));
      tsadiBankEl.textContent = `${particleLabel} Particles`;
    }

    const shinCountIds = [
      'spire-menu-shin-count',
      'spire-menu-shin-count-powder',
      'spire-menu-shin-count-fluid',
      'spire-menu-shin-count-lamed',
      'spire-menu-shin-count-tsadi',
      'spire-menu-shin-count-kuf',
    ];
    shinCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedShinGlyphs);
      }
    });

    const kufCountIds = [
      'spire-menu-kuf-count',
      'spire-menu-kuf-count-powder',
      'spire-menu-kuf-count-fluid',
      'spire-menu-kuf-count-lamed',
      'spire-menu-kuf-count-tsadi',
      'spire-menu-kuf-count-shin',
    ];
    kufCountIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.textContent = formatGameNumber(bankedKufGlyphs);
      }
    });

    doc.querySelectorAll('.spire-menu-item--bet').forEach((item) => {
      if (isFluidUnlocked()) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });

    doc.querySelectorAll('.spire-menu-item--lamed').forEach((item) => {
      if (isLamedUnlocked()) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });

    doc.querySelectorAll('.spire-menu-item--tsadi').forEach((item) => {
      if (isTsadiUnlocked()) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });

    doc.querySelectorAll('.spire-menu-item--shin').forEach((item) => {
      if (isShinUnlocked()) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });

    doc.querySelectorAll('.spire-menu-item--kuf').forEach((item) => {
      if (isKufUnlocked()) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });
  }

  return {
    initialize,
    updateCounts,
  };
}
