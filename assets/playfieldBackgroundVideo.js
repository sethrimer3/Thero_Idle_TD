const MENU_BACKGROUND_VIDEO_SELECTOR = '[data-menu-background-video]';

/**
 * Initialize the shared looping menu background so every tab panel inherits the same animated backdrop.
 * Animated WebP files in <img> tags autoplay and loop natively, so this only handles the ready-state
 * reveal to avoid a black flash before the first frame paints.
 */
export function initializePlayfieldBackgroundVideo() {
  const mainStage = document.getElementById('main-stage');
  const img = document.querySelector(MENU_BACKGROUND_VIDEO_SELECTOR);
  if (!mainStage || !img) {
    return null;
  }

  /**
   * Reveal the shared menu animation layer only after image data is available to avoid a black flash on startup.
   */
  const markReady = () => {
    mainStage.dataset.menuBackgroundVideoReady = 'true';
  };

  if (img instanceof HTMLImageElement) {
    // Animated WebP plays automatically; just watch for the load event to reveal the layer.
    if (img.complete && img.naturalWidth > 0) {
      // Already loaded (e.g. browser cache hit).
      markReady();
    } else {
      img.addEventListener('load', markReady, { once: true });
      img.addEventListener('error', markReady, { once: true });
    }
  } else {
    // Fallback: reveal immediately for unexpected element types.
    markReady();
  }

  return {
    destroy() {
      // Nothing to tear down; the <img> autoplay lifecycle is browser-managed.
    },
  };
}
