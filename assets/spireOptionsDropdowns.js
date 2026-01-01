/**
 * Provide lightweight dropdown behavior for the spire option menus.
 * Each dropdown toggles aria-expanded/aria-hidden states and animates height via inline max-height.
 */
const dropdownRegistry = new Map();

/**
 * Determine if the menu should be displayed inline (at bottom of tab) vs as a popover (over render).
 * Returns true if using footer placement and a footer button is being used.
 */
function shouldUseInlineDisplay(toggles, menu) {
  const placementPreference = document.body?.dataset?.spireOptionsPlacement;
  if (placementPreference !== 'footer') {
    return false;
  }
  // Check if any of the toggles is a footer button
  const hasFooterToggle = toggles.some((toggle) => 
    toggle?.classList?.contains('spire-options-trigger--footer')
  );
  return hasFooterToggle;
}

function syncDropdownState({ menu, toggles, container }, open) {
  if (!menu || !toggles?.length) {
    return;
  }
  const wasOpen = menu.getAttribute('data-open') === 'true';
  menu.setAttribute('data-open', open ? 'true' : 'false');
  menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  toggles.forEach((toggle) => {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  container?.classList.toggle('options-open', open);

  if (open) {
    menu.hidden = false;
    // When using footer placement with footer button, display inline; otherwise use popover width
    const useInline = shouldUseInlineDisplay(toggles, menu);
    menu.style.maxWidth = useInline
      ? '100%'
      : 'min(320px, calc(100vw - 48px))';
    requestAnimationFrame(() => {
      menu.style.maxHeight = `${menu.scrollHeight + 32}px`;
    });
    return;
  }

  menu.style.maxHeight = '0';
  menu.style.maxWidth = '0';
  if (!wasOpen) {
    menu.hidden = true;
    return;
  }
  menu.classList.add('is-collapsing');
  menu.addEventListener(
    'transitionend',
    (event) => {
      if (event.propertyName !== 'max-width') {
        return;
      }
      if (menu.getAttribute('data-open') !== 'false') {
        return;
      }
      menu.hidden = true;
      menu.classList.remove('is-collapsing');
    },
    { once: true },
  );
}

/**
 * Move the menu to the appropriate container based on which button was clicked and placement preference.
 */
function repositionMenuForContext(menu, clickedToggle, toggles) {
  if (!menu || !clickedToggle) {
    return;
  }
  
  const useInline = shouldUseInlineDisplay(toggles, menu);
  const isCornerToggle = clickedToggle.classList.contains('spire-options-trigger--corner');
  const isFooterToggle = clickedToggle.classList.contains('spire-options-trigger--footer');
  
  // If using footer placement with a footer button, move menu to footer card
  if (useInline && isFooterToggle) {
    // Find the footer card that contains the clicked button
    const footerCard = clickedToggle.closest('.spire-options-card, .lamed-spire-options-card, .cognitive-realm-options-wrapper');
    if (footerCard && !footerCard.contains(menu)) {
      // Move the menu into the footer card
      footerCard.appendChild(menu);
      // Remove popover class so it displays inline
      menu.classList.remove('spire-options-menu--popover');
    }
  } else if (isCornerToggle) {
    // If using corner toggle, ensure menu is in popover container
    const popoverContainer = clickedToggle.closest('.spire-options-popover');
    if (popoverContainer && !popoverContainer.contains(menu)) {
      popoverContainer.appendChild(menu);
      // Add popover class for absolute positioning
      if (!menu.classList.contains('spire-options-menu--popover')) {
        menu.classList.add('spire-options-menu--popover');
      }
    }
  }
}

/**
 * Wire up a single spire option dropdown by identifiers.
 * @param {{ toggleId: string, menuId: string, spireId: string, closeOnOutside?: boolean, extraToggleIds?: string[] }} config - DOM ids and a registry key.
 */
export function bindSpireOptionsDropdown(config) {
  const {
    toggleId,
    menuId,
    spireId,
    closeOnOutside,
    extraToggleIds,
  } = config || {};
  const toggle = document.getElementById(toggleId);
  // Resolve optional secondary triggers so multiple buttons can open the same menu.
  const extraToggles = (extraToggleIds || [])
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const menu = document.getElementById(menuId);
  // Track every toggle so open/close state stays in sync for all controls.
  const toggles = [toggle, ...extraToggles].filter(Boolean);
  if (!toggles.length || !menu || !spireId) {
    return null;
  }
  // Use the menu container so overlays stay aligned even when a secondary toggle is used.
  const container = menu.closest(
    '.spire-options-popover, .spire-options-card, .lamed-spire-options-card, .cognitive-realm-options-wrapper',
  );
  const closeButton = menu.querySelector('.spire-options-close');
  let open = false;
  let lastClickedToggle = null;
  syncDropdownState({ menu, toggles, container }, open);
  // Track outside clicks when the menu is configured to behave like a popover.
  const handleOutsideClick = (event) => {
    if (!open) {
      return;
    }
    const target = event.target;
    if (menu.contains(target) || toggles.some((button) => button.contains(target))) {
      return;
    }
    open = false;
    syncDropdownState({ menu, toggles, container }, open);
  };

  toggles.forEach((button) => {
    button.addEventListener('click', (event) => {
      lastClickedToggle = event.currentTarget;
      // Reposition menu based on which button was clicked
      repositionMenuForContext(menu, lastClickedToggle, toggles);
      open = !open;
      syncDropdownState({ menu, toggles, container }, open);
    });
  });
  closeButton?.addEventListener('click', () => {
    if (!open) {
      return;
    }
    open = false;
    syncDropdownState({ menu, toggles, container }, open);
  });
  if (closeOnOutside) {
    // Close the popover when a click lands outside the menu or trigger.
    document.addEventListener('click', handleOutsideClick);
  }
  const controller = {
    close: () => {
      open = false;
      syncDropdownState({ menu, toggles, container }, open);
    },
    isOpen: () => open,
    refresh: () => syncDropdownState({ menu, toggles, container }, open),
  };
  dropdownRegistry.set(spireId, controller);
  return controller;
}

/**
 * Collapse every spire dropdown when switching tabs so menus never linger.
 */
export function closeAllSpireDropdowns() {
  dropdownRegistry.forEach((controller) => {
    controller?.close?.();
  });
}
