import { BUILD_NUMBER } from './buildInfo.js';

const STARTUP_LOGO_EXIT_MS = 720; // Allow the logo to drift upward and fade before the overlay dismisses.
const STARTUP_OVERLAY_MIN_VISIBLE_MS = 4000; // Guarantee the startup overlay lingers long enough to be seen.
const STARTUP_OVERLAY_FADE_MS = 320;

const startupOverlay = document.getElementById('startup-overlay');
const startupBuildLabel = startupOverlay ? startupOverlay.querySelector('[data-startup-build]') : null;
const startupLogo = startupOverlay ? startupOverlay.querySelector('[data-startup-logo]') : null;
const startupLoading = startupOverlay ? startupOverlay.querySelector('[data-startup-loading]') : null;
const startupHint = startupOverlay ? startupOverlay.querySelector('.startup-overlay__hint') : null;
const startupHintDefaultText = startupHint ? startupHint.textContent : '';

let startupLoadingActivated = false;
let startupOverlayFadeHandle = null;
let startupOverlayVisibleAt = null; // Track when the overlay became visible so the minimum duration can be enforced.
let startupLogoExitHandle = null;
let startupLogoExitPromise = null;

// Surface the active build number so testers can verify which revision is running during the loading sequence.
function renderStartupBuildNumber() {
  if (!startupBuildLabel) {
    return;
  }
  startupBuildLabel.textContent = `Build ${BUILD_NUMBER}`;
}

function activateStartupLoadingSpinner() {
  if (!startupOverlay || !startupLoading) {
    return;
  }
  if (startupLoadingActivated) {
    return;
  }
  startupLoadingActivated = true;
  if (startupLoading.hasAttribute('hidden')) {
    startupLoading.removeAttribute('hidden');
  }
  requestAnimationFrame(() => {
    startupLoading.classList.add('startup-overlay__loading--active');
  });
  if (startupHint) {
    // Replace the interrogative hint with an ellipsis to convey ongoing progress.
    startupHint.textContent = 'Summoning motes…';
  }
}

// Animate the logo off-screen once loading completes so dismissal waits for the full fade-out.
function waitForStartupLogoExit() {
  if (!startupLogo) {
    // Without a logo element, there is no animation to await.
    return Promise.resolve();
  }

  if (startupLogoExitPromise) {
    return startupLogoExitPromise;
  }

  startupLogoExitPromise = new Promise((resolve) => {
    const complete = () => {
      if (startupLogoExitHandle) {
        window.clearTimeout(startupLogoExitHandle);
        startupLogoExitHandle = null;
      }
      startupLogo.removeEventListener('animationend', handleAnimationEnd);
      startupLogoExitPromise = null;
      resolve();
    };

    const handleAnimationEnd = (event) => {
      if (event.target !== startupLogo || event.animationName !== 'startupLogoExit') {
        return;
      }
      complete();
    };

    startupLogo.addEventListener('animationend', handleAnimationEnd);

    // Kick off the upward fade animation on the next frame so the class toggle is composited cleanly.
    requestAnimationFrame(() => {
      startupLogo.classList.add('startup-overlay__logo--exit');
    });

    startupLogoExitHandle = window.setTimeout(() => {
      // Safety net to resolve even if the animationend event is suppressed by reduced motion settings.
      complete();
    }, STARTUP_LOGO_EXIT_MS + 160);
  });

  return startupLogoExitPromise;
}

export function initializeStartupOverlay() {
  if (!startupOverlay) {
    return;
  }
  renderStartupBuildNumber();
  startupOverlay.classList.remove('startup-overlay--hidden');
  startupOverlay.removeAttribute('hidden');
  startupOverlay.setAttribute('aria-hidden', 'false');
  startupOverlayVisibleAt = performance.now(); // Record the reveal timestamp for minimum-duration calculations.

  activateStartupLoadingSpinner();
}

export async function dismissStartupOverlay() {
  if (!startupOverlay) {
    return;
  }

  activateStartupLoadingSpinner();

  if (Number.isFinite(startupOverlayVisibleAt)) {
    const elapsed = performance.now() - startupOverlayVisibleAt;
    if (elapsed < STARTUP_OVERLAY_MIN_VISIBLE_MS) {
      // Wait out the remaining time so the intro animation never flashes too quickly.
      await new Promise((resolve) => {
        window.setTimeout(resolve, STARTUP_OVERLAY_MIN_VISIBLE_MS - elapsed);
      });
    }
  }

  if (startupOverlay.classList.contains('startup-overlay--hidden')) {
    if (!startupOverlay.hasAttribute('hidden')) {
      startupOverlay.setAttribute('hidden', '');
    }
    startupOverlay.setAttribute('aria-hidden', 'true');
    if (startupHint && startupHintDefaultText) {
      startupHint.textContent = startupHintDefaultText;
    }
    startupOverlayVisibleAt = null; // Clear the timestamp once dismissal completes so subsequent calls skip the delay.
    return;
  }

  await waitForStartupLogoExit();

  await new Promise((resolve) => {
    const complete = () => {
      if (startupOverlayFadeHandle) {
        window.clearTimeout(startupOverlayFadeHandle);
        startupOverlayFadeHandle = null;
      }
      startupOverlay.removeEventListener('transitionend', handleTransitionEnd);
      if (!startupOverlay.classList.contains('startup-overlay--hidden')) {
        startupOverlay.classList.add('startup-overlay--hidden');
      }
      startupOverlay.setAttribute('hidden', '');
      startupOverlay.setAttribute('aria-hidden', 'true');
      if (startupHint && startupHintDefaultText) {
        startupHint.textContent = startupHintDefaultText;
      }
      startupOverlayVisibleAt = null; // Reset the visibility marker so retries do not wait unnecessarily.
      resolve();
    };

    const handleTransitionEnd = (event) => {
      if (event.target !== startupOverlay || event.propertyName !== 'opacity') {
        return;
      }
      complete();
    };

    if (startupOverlayFadeHandle) {
      window.clearTimeout(startupOverlayFadeHandle);
      startupOverlayFadeHandle = null;
    }

    startupOverlayFadeHandle = window.setTimeout(() => {
      startupOverlayFadeHandle = null;
      complete();
    }, STARTUP_OVERLAY_FADE_MS + 160);

    startupOverlay.addEventListener('transitionend', handleTransitionEnd);

    requestAnimationFrame(() => {
      startupOverlay.classList.add('startup-overlay--hidden');
      startupOverlay.setAttribute('aria-hidden', 'true');
    });
  });
}

export function resetStartupOverlayHint() {
  if (startupHint && startupHintDefaultText) {
    startupHint.textContent = startupHintDefaultText;
  }
}
