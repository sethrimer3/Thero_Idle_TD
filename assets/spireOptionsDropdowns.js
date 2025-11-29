/**
 * Provide lightweight dropdown behavior for the spire option menus.
 * Each dropdown toggles aria-expanded/aria-hidden states and animates height via inline max-height.
 */
const dropdownRegistry = new Map();

function syncDropdownState({ menu, toggle }, open) {
  if (!menu || !toggle) {
    return;
  }
  menu.setAttribute('data-open', open ? 'true' : 'false');
  menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  menu.hidden = !open;
  menu.style.maxHeight = open ? `${menu.scrollHeight + 24}px` : '0';
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/**
 * Wire up a single spire option dropdown by identifiers.
 * @param {{ toggleId: string, menuId: string, spireId: string }} config - DOM ids and a registry key.
 */
export function bindSpireOptionsDropdown(config) {
  const { toggleId, menuId, spireId } = config || {};
  const toggle = document.getElementById(toggleId);
  const menu = document.getElementById(menuId);
  if (!toggle || !menu || !spireId) {
    return null;
  }
  let open = false;
  syncDropdownState({ menu, toggle }, open);

  const toggleHandler = () => {
    open = !open;
    syncDropdownState({ menu, toggle }, open);
  };

  toggle.addEventListener('click', toggleHandler);
  const controller = {
    close: () => {
      open = false;
      syncDropdownState({ menu, toggle }, open);
    },
    isOpen: () => open,
    refresh: () => syncDropdownState({ menu, toggle }, open),
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
