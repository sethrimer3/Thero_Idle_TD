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
    // Track the expanded state so the toggle can animate beneath the open tray.
    const activeToggleClass = 'spire-menu-toggle--active';
    // Shared glyph that replaces the hamburger icon while the tray is open.
    const closeIcon = '✕';

    /**
     * Collapse helper that restores a floating menu and its toggle to the hidden state.
     * Ensures duplicate trays close when another spire menu opens.
     * @param {HTMLElement|null} menuElement - The floating menu being collapsed.
     * @param {HTMLElement|null} toggleElement - The associated toggle button.
     * @param {string} openLabelText - The aria-label to restore when closed.
     */
    function collapseMenuForToggle(menuElement, toggleElement, openLabelText = '') {
      if (!menuElement || !toggleElement) {
        return;
      }

      menuElement.classList.remove(visibleClass);
      toggleElement.setAttribute('aria-expanded', 'false');
      toggleElement.classList.remove(activeToggleClass);
      toggleElement.style.setProperty('--floating-menu-offset', '0px');

      const iconElement = toggleElement.querySelector('.spire-menu-toggle-icon');
      if (iconElement) {
        const fallbackIcon = toggleElement.dataset?.defaultIcon || '☰';
        iconElement.textContent = fallbackIcon;
      }

      if (openLabelText) {
        toggleElement.setAttribute('aria-label', openLabelText);
      }
    }

    spireIds.forEach((spireId) => {
      const toggleButton = doc.getElementById(`spire-menu-toggle-${spireId}`);
      const menu = doc.getElementById(`spire-floating-menu-${spireId}`);

      if (toggleButton && menu) {
        const toggleIcon = toggleButton.querySelector('.spire-menu-toggle-icon');
        const defaultIcon = toggleIcon ? toggleIcon.textContent.trim() : '';
        // Persist the open/close labels so screen readers stay in sync with the toggle role swap.
        const openLabel = toggleButton.getAttribute('aria-label') || 'Toggle Spire Navigation';
        const closeLabel = `Close ${spireId.charAt(0).toUpperCase()}${spireId.slice(1)} Spire Navigation`;
        const closeButton = menu.querySelector('.spire-menu-dismiss');

        // Cache defaults before wiring helpers so they remain accessible inside closures.
        toggleButton.dataset.defaultIcon = defaultIcon || '☰';
        toggleButton.dataset.openLabel = openLabel;

        /**
         * Expand helper animates the tray into view and aligns the toggle beneath it.
         */
        const expandMenu = () => {
          menu.classList.add(visibleClass);
          toggleButton.setAttribute('aria-expanded', 'true');
          toggleButton.classList.add(activeToggleClass);
          toggleButton.style.setProperty('--floating-menu-offset', '0px');
          if (toggleIcon) {
            toggleIcon.textContent = closeIcon;
          }
          toggleButton.setAttribute('aria-label', closeLabel);

          requestAnimationFrame(() => {
            const menuHeight = menu.getBoundingClientRect().height;
            const offset = Number.isFinite(menuHeight) ? menuHeight + 16 : 0;
            // Store the measured height so CSS can slide the toggle beneath the tray.
            toggleButton.style.setProperty('--floating-menu-offset', `${offset}px`);
          });
        };

        /**
         * Collapse helper delegates to the shared function and restores the open label.
         */
        const collapseMenu = () => {
          collapseMenuForToggle(menu, toggleButton, openLabel);
        };

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
              const otherOpenLabel = otherToggle.dataset.openLabel || 'Toggle Spire Navigation';
              // Shared collapse path closes any other tray that might still be open.
              collapseMenuForToggle(otherMenu, otherToggle, otherOpenLabel);
            }
          });

          if (isVisible) {
            collapseMenu();
          } else {
            expandMenu();
          }
        });

        if (closeButton) {
          closeButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            // Close control mirrors the toggle so players can dismiss the tray from inside it.
            collapseMenu();
            toggleButton.focus({ preventScroll: true });
          });
        }
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
