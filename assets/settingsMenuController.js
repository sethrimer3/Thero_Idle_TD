'use strict';

/**
 * Shared helper for binding collapsible settings menu panels.
 * Eliminates duplicate expand/collapse/transition logic that was previously
 * copy-pasted for every settings menu section in main.js.
 *
 * @param {Object} options
 * @param {string} options.triggerId - DOM id of the toggle button
 * @param {string} options.menuId    - DOM id of the collapsible panel
 * @returns {{ expand: Function, collapse: Function, isOpen: Function } | null}
 *   Controller for the bound menu, or null if elements were not found.
 */
export function bindCollapsibleMenu({ triggerId, menuId } = {}) {
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  if (!trigger || !menu) {
    return null;
  }

  const setMenuState = (open) => {
    menu.dataset.open = open ? 'true' : 'false';
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const expandMenu = () => {
    menu.hidden = false;
    menu.style.maxHeight = '0px';
    setMenuState(true);
    // Force reflow so the transition animates from 0.
    menu.getBoundingClientRect();
    menu.style.maxHeight = `${menu.scrollHeight}px`;
  };

  const collapseMenu = () => {
    menu.style.maxHeight = `${menu.scrollHeight}px`;
    setMenuState(false);
    // Force reflow so the transition animates from current height.
    menu.getBoundingClientRect();
    menu.style.maxHeight = '0px';
  };

  trigger.addEventListener('click', () => {
    const open = menu.dataset.open === 'true';
    if (open) {
      collapseMenu();
    } else {
      expandMenu();
    }
  });

  menu.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'max-height') {
      return;
    }
    if (menu.dataset.open === 'true') {
      menu.style.maxHeight = 'none';
    } else {
      menu.hidden = true;
    }
  });

  // Start collapsed.
  setMenuState(false);
  menu.hidden = true;
  menu.style.maxHeight = '0px';

  return {
    expand: expandMenu,
    collapse: collapseMenu,
    isOpen: () => menu.dataset.open === 'true',
  };
}
