/**
 * Provide lightweight dropdown behavior for the spire option menus.
 * Each dropdown toggles aria-expanded/aria-hidden states and animates height via inline max-height.
 */
const dropdownRegistry = new Map();

function syncDropdownState({ menu, toggle, container }, open) {
  if (!menu || !toggle) {
    return;
  }
  const wasOpen = menu.getAttribute('data-open') === 'true';
  menu.setAttribute('data-open', open ? 'true' : 'false');
  menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
 * @param {{ toggleId: string, menuId: string, spireId: string, closeOnOutside?: boolean }} config - DOM ids and a registry key.
 */
export function bindSpireOptionsDropdown(config) {
  const { toggleId, menuId, spireId, closeOnOutside } = config || {};
  const toggle = document.getElementById(toggleId);
  const menu = document.getElementById(menuId);
  if (!toggle || !menu || !spireId) {
    return null;
  }
  const container = toggle.closest(
    '.spire-options-card, .lamed-spire-options-card, .cognitive-realm-options-wrapper, .spire-options-popover',
  );
  const closeButton = menu.querySelector('.spire-options-close');
  let open = false;
  syncDropdownState({ menu, toggle, container }, open);
  // Track outside clicks when the menu is configured to behave like a popover.
  const handleOutsideClick = (event) => {
    if (!open) {
      return;
    }
    const target = event.target;
    if (menu.contains(target) || toggle.contains(target)) {
      return;
    }
    open = false;
    syncDropdownState({ menu, toggle, container }, open);
  };

  const toggleHandler = () => {
    open = !open;
    syncDropdownState({ menu, toggle, container }, open);
  };

  toggle.addEventListener('click', toggleHandler);
  closeButton?.addEventListener('click', () => {
    if (!open) {
      return;
    }
    open = false;
    syncDropdownState({ menu, toggle, container }, open);
  });
  if (closeOnOutside) {
    // Close the popover when a click lands outside the menu or trigger.
    document.addEventListener('click', handleOutsideClick);
  }
  const controller = {
    close: () => {
      open = false;
      syncDropdownState({ menu, toggle, container }, open);
    },
    isOpen: () => open,
    refresh: () => syncDropdownState({ menu, toggle, container }, open),
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
