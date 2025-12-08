// Boosts section UI for the achievements tab.
// Provides in-app purchase option and ad-based boost buttons.

import { formatWholeNumber } from '../scripts/core/formatting.js';
import {
  loadMonetizationState,
  getMonetizationState,
  unlockPremium,
  triggerSpireBoost,
  triggerGemBoost,
  getBoostCooldown,
  addMonetizationListener,
} from './state/monetizationState.js';

// Spire display names and symbols
const SPIRE_INFO = [
  { id: 'powder', name: 'Aleph', symbol: 'ℵ' },
  { id: 'fluid', name: 'Bet', symbol: 'בּ' },
  { id: 'lamed', name: 'Lamed', symbol: 'ל' },
  { id: 'tsadi', name: 'Tsadi', symbol: 'צ' },
  { id: 'shin', name: 'Shin', symbol: 'ש' },
  { id: 'kuf', name: 'Kuf', symbol: 'ק' },
];

let boostsContainer = null;
let dropdownContent = null;
let isDropdownOpen = false;
let updateInterval = null;

// Dependencies injected from main
let dependencies = {
  applyIdleTimeToSpire: null,
  grantRandomGems: null,
};

/**
 * Configure dependencies for the boosts section.
 * @param {Object} deps - Dependencies object
 */
export function configureBoostsSection(deps) {
  Object.assign(dependencies, deps);
}

/**
 * Format remaining cooldown time as a human-readable string.
 * @param {number} remainingMs - Remaining time in milliseconds
 * @returns {string} Formatted time string
 */
function formatCooldown(remainingMs) {
  if (remainingMs <= 0) {
    return 'Ready';
  }
  
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  } else if (minutes > 0) {
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Update button states based on cooldowns.
 */
function updateBoostButtons() {
  if (!boostsContainer) {
    return;
  }
  
  // Update spire boost buttons
  SPIRE_INFO.forEach((spire) => {
    const button = boostsContainer.querySelector(`[data-boost-spire="${spire.id}"]`);
    if (!button) {
      return;
    }
    
    const cooldown = getBoostCooldown(spire.id);
    const statusEl = button.querySelector('.boost-button__status');
    
    if (cooldown.onCooldown) {
      button.disabled = true;
      button.classList.add('boost-button--cooldown');
      if (statusEl) {
        statusEl.textContent = formatCooldown(cooldown.remainingMs);
      }
    } else {
      button.disabled = false;
      button.classList.remove('boost-button--cooldown');
      if (statusEl) {
        statusEl.textContent = 'Ready';
      }
    }
  });
  
  // Update gem boost button
  const gemButton = boostsContainer.querySelector('[data-boost-type="gems"]');
  if (gemButton) {
    const cooldown = getBoostCooldown('gems');
    const statusEl = gemButton.querySelector('.boost-button__status');
    
    if (cooldown.onCooldown) {
      gemButton.disabled = true;
      gemButton.classList.add('boost-button--cooldown');
      if (statusEl) {
        statusEl.textContent = formatCooldown(cooldown.remainingMs);
      }
    } else {
      gemButton.disabled = false;
      gemButton.classList.remove('boost-button--cooldown');
      if (statusEl) {
        statusEl.textContent = 'Ready';
      }
    }
  }
}

/**
 * Handle premium unlock button click.
 */
async function handlePremiumUnlock() {
  const confirmed = window.confirm(
    'This is a mock purchase for $4.99 that would unlock all premium features. Proceed?'
  );
  
  if (!confirmed) {
    return;
  }
  
  unlockPremium();
  
  // Update UI to show unlocked state
  const premiumButton = boostsContainer?.querySelector('[data-action="unlock-premium"]');
  if (premiumButton) {
    premiumButton.disabled = true;
    premiumButton.textContent = '✓ Premium Unlocked';
    premiumButton.classList.add('boost-button--unlocked');
  }
}

/**
 * Handle spire boost button click.
 * @param {string} spireId - ID of the spire
 */
async function handleSpireBoost(spireId) {
  const button = boostsContainer?.querySelector(`[data-boost-spire="${spireId}"]`);
  if (!button) {
    return;
  }
  
  // Disable button during processing
  button.disabled = true;
  const originalText = button.querySelector('.boost-button__label')?.textContent || '';
  const labelEl = button.querySelector('.boost-button__label');
  if (labelEl) {
    labelEl.textContent = 'Watching ad...';
  }
  
  try {
    const result = await triggerSpireBoost(spireId, dependencies.applyIdleTimeToSpire);
    
    if (result.success) {
      if (labelEl) {
        labelEl.textContent = '✓ Boost applied!';
      }
      setTimeout(() => {
        if (labelEl) {
          labelEl.textContent = originalText;
        }
        updateBoostButtons();
      }, 2000);
    } else {
      alert(`Boost failed: ${result.error}`);
      if (labelEl) {
        labelEl.textContent = originalText;
      }
      button.disabled = false;
    }
  } catch (error) {
    console.error('Spire boost error:', error);
    alert('Boost failed. Please try again.');
    if (labelEl) {
      labelEl.textContent = originalText;
    }
    button.disabled = false;
  }
}

/**
 * Handle gem boost button click.
 */
async function handleGemBoost() {
  const button = boostsContainer?.querySelector('[data-boost-type="gems"]');
  if (!button) {
    return;
  }
  
  // Disable button during processing
  button.disabled = true;
  const originalText = button.querySelector('.boost-button__label')?.textContent || '';
  const labelEl = button.querySelector('.boost-button__label');
  if (labelEl) {
    labelEl.textContent = 'Watching ad...';
  }
  
  try {
    const result = await triggerGemBoost(dependencies.grantRandomGems);
    
    if (result.success) {
      if (labelEl) {
        labelEl.textContent = `✓ ${result.gemsGranted || 100} gems granted!`;
      }
      setTimeout(() => {
        if (labelEl) {
          labelEl.textContent = originalText;
        }
        updateBoostButtons();
      }, 2000);
    } else {
      alert(`Boost failed: ${result.error}`);
      if (labelEl) {
        labelEl.textContent = originalText;
      }
      button.disabled = false;
    }
  } catch (error) {
    console.error('Gem boost error:', error);
    alert('Boost failed. Please try again.');
    if (labelEl) {
      labelEl.textContent = originalText;
    }
    button.disabled = false;
  }
}

/**
 * Toggle dropdown visibility.
 */
function toggleDropdown() {
  if (!boostsContainer || !dropdownContent) {
    return;
  }
  
  isDropdownOpen = !isDropdownOpen;
  
  const toggleButton = boostsContainer.querySelector('[data-action="toggle-boosts"]');
  if (toggleButton) {
    toggleButton.setAttribute('aria-expanded', String(isDropdownOpen));
    toggleButton.textContent = isDropdownOpen ? '▼ Boosts - Support the Dev' : '▶ Boosts - Support the Dev';
  }
  
  if (isDropdownOpen) {
    dropdownContent.hidden = false;
    dropdownContent.style.display = 'block';
  } else {
    dropdownContent.hidden = true;
    dropdownContent.style.display = 'none';
  }
}

/**
 * Create the boosts section UI.
 * @returns {HTMLElement} The boosts container element
 */
function createBoostsUI() {
  const container = document.createElement('div');
  container.className = 'boosts-section';
  container.id = 'boosts-section';
  
  // Toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'boosts-toggle action-button';
  toggleButton.type = 'button';
  toggleButton.setAttribute('data-action', 'toggle-boosts');
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.textContent = '▶ Boosts - Support the Dev';
  toggleButton.addEventListener('click', toggleDropdown);
  container.appendChild(toggleButton);
  
  // Dropdown content
  const dropdown = document.createElement('div');
  dropdown.className = 'boosts-dropdown';
  dropdown.hidden = true;
  dropdown.style.display = 'none';
  dropdownContent = dropdown;
  
  // Premium unlock section
  const premiumSection = document.createElement('div');
  premiumSection.className = 'boosts-premium-section';
  
  const state = getMonetizationState();
  
  const premiumButton = document.createElement('button');
  premiumButton.className = 'boost-button boost-button--premium action-button';
  premiumButton.type = 'button';
  premiumButton.setAttribute('data-action', 'unlock-premium');
  
  if (state.premiumUnlocked) {
    premiumButton.disabled = true;
    premiumButton.textContent = '✓ Premium Unlocked';
    premiumButton.classList.add('boost-button--unlocked');
  } else {
    premiumButton.textContent = '🔓 Unlock Everything - $4.99';
    premiumButton.addEventListener('click', handlePremiumUnlock);
  }
  
  premiumSection.appendChild(premiumButton);
  dropdown.appendChild(premiumSection);
  
  // Divider
  const divider = document.createElement('hr');
  divider.className = 'boosts-divider';
  dropdown.appendChild(divider);
  
  // Spire boosts section
  const spireHeader = document.createElement('h4');
  spireHeader.className = 'boosts-section-header';
  spireHeader.textContent = 'Spire Idle Time Boosts';
  dropdown.appendChild(spireHeader);
  
  const spireGrid = document.createElement('div');
  spireGrid.className = 'boosts-grid';
  
  SPIRE_INFO.forEach((spire) => {
    const button = document.createElement('button');
    button.className = 'boost-button boost-button--spire action-button';
    button.type = 'button';
    button.setAttribute('data-boost-spire', spire.id);
    
    const symbol = document.createElement('span');
    symbol.className = 'boost-button__symbol';
    symbol.textContent = spire.symbol;
    symbol.setAttribute('aria-hidden', 'true');
    button.appendChild(symbol);
    
    const label = document.createElement('span');
    label.className = 'boost-button__label';
    label.textContent = `${spire.name}: +2h Idle`;
    button.appendChild(label);
    
    const status = document.createElement('span');
    status.className = 'boost-button__status';
    status.textContent = 'Ready';
    button.appendChild(status);
    
    button.addEventListener('click', () => handleSpireBoost(spire.id));
    spireGrid.appendChild(button);
  });
  
  dropdown.appendChild(spireGrid);
  
  // Gem boost section
  const gemHeader = document.createElement('h4');
  gemHeader.className = 'boosts-section-header';
  gemHeader.textContent = 'Resource Boosts';
  dropdown.appendChild(gemHeader);
  
  const gemButton = document.createElement('button');
  gemButton.className = 'boost-button boost-button--gems action-button';
  gemButton.type = 'button';
  gemButton.setAttribute('data-boost-type', 'gems');
  
  const gemLabel = document.createElement('span');
  gemLabel.className = 'boost-button__label';
  gemLabel.textContent = '💎 100 Random Gems';
  gemButton.appendChild(gemLabel);
  
  const gemStatus = document.createElement('span');
  gemStatus.className = 'boost-button__status';
  gemStatus.textContent = 'Ready';
  gemButton.appendChild(gemStatus);
  
  gemButton.addEventListener('click', handleGemBoost);
  dropdown.appendChild(gemButton);
  
  container.appendChild(dropdown);
  
  return container;
}

/**
 * Initialize the boosts section in the achievements tab.
 */
export function initializeBoostsSection() {
  // Load state from storage
  loadMonetizationState();
  
  // Find achievements panel
  const achievementsPanel = document.getElementById('panel-achievements');
  if (!achievementsPanel) {
    console.warn('Achievements panel not found');
    return;
  }
  
  // Create and insert boosts section at the top
  boostsContainer = createBoostsUI();
  
  // Insert after the header but before the achievement note
  const header = achievementsPanel.querySelector('.panel-header');
  if (header && header.nextSibling) {
    achievementsPanel.insertBefore(boostsContainer, header.nextSibling);
  } else {
    achievementsPanel.insertBefore(boostsContainer, achievementsPanel.firstChild);
  }
  
  // Update button states
  updateBoostButtons();
  
  // Set up periodic updates for cooldown timers
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  updateInterval = setInterval(updateBoostButtons, 1000);
  
  // Listen to state changes
  addMonetizationListener(() => {
    updateBoostButtons();
  });
}

/**
 * Clean up the boosts section.
 */
export function cleanupBoostsSection() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  if (boostsContainer && boostsContainer.parentNode) {
    boostsContainer.parentNode.removeChild(boostsContainer);
  }
  
  boostsContainer = null;
  dropdownContent = null;
  isDropdownOpen = false;
}
