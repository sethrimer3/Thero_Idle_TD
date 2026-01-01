/**
 * Provide lightweight dropdown behavior for the spire option menus.
 * Each dropdown toggles aria-expanded/aria-hidden states and animates height via inline max-height.
 */
const dropdownRegistry = new Map();

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
    // Use a wider max width when the menu renders as a popover instead of inline.
    menu.style.maxWidth = menu.classList.contains('spire-options-menu--popover')
      ? 'min(320px, calc(100vw - 48px))'
      : '100%';
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

  const toggleHandler = () => {
    open = !open;
    syncDropdownState({ menu, toggles, container }, open);
  };

  toggles.forEach((button) => {
    button.addEventListener('click', toggleHandler);
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
