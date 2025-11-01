const STARTUP_LOGO_DURATION_MS = 5000; // 2s fade-in + 1s hold + 2s fade-out.
const STARTUP_OVERLAY_MIN_VISIBLE_MS = 4000; // Guarantee the startup overlay lingers long enough to be seen.
const STARTUP_OVERLAY_FADE_MS = 320;

const startupOverlay = document.getElementById('startup-overlay');
const startupLogo = startupOverlay ? startupOverlay.querySelector('[data-startup-logo]') : null;
const startupLoading = startupOverlay ? startupOverlay.querySelector('[data-startup-loading]') : null;
const startupHint = startupOverlay ? startupOverlay.querySelector('.startup-overlay__hint') : null;
const startupHintDefaultText = startupHint ? startupHint.textContent : '';

let startupLoadingActivated = false;
let startupOverlayFadeHandle = null;
let startupOverlayVisibleAt = null; // Track when the overlay became visible so the minimum duration can be enforced.

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
    startupHint.textContent = 'Summoning motes?';
  }
}

export function initializeStartupOverlay() {
  if (!startupOverlay) {
    return;
  }
  startupOverlay.classList.remove('startup-overlay--hidden');
  startupOverlay.removeAttribute('hidden');
  startupOverlay.setAttribute('aria-hidden', 'false');
  startupOverlayVisibleAt = performance.now(); // Record the reveal timestamp for minimum-duration calculations.

  activateStartupLoadingSpinner();

  if (!startupLogo) {
    return;
  }

  let fallbackTimer = null;

  const finalizeLogo = () => {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    startupLogo.setAttribute('hidden', '');
    activateStartupLoadingSpinner();
  };

  const logoAnimationHandler = () => {
    startupLogo.removeEventListener('animationend', logoAnimationHandler);
    finalizeLogo();
  };

  fallbackTimer = window.setTimeout(() => {
    startupLogo.removeEventListener('animationend', logoAnimationHandler);
    finalizeLogo();
  }, STARTUP_LOGO_DURATION_MS + 120);

  startupLogo.addEventListener('animationend', logoAnimationHandler);
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
