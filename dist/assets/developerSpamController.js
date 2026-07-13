// Developer Spam Controller — extracted from main.js (Build 710)
// Manages rapid-fire spawn loops for Lamed and Tsadi spire developer testing.

/**
 * Creates a developer spam controller that handles rapid-fire particle/star spawning
 * for Lamed and Tsadi spire developer-mode testing.
 *
 * @param {Object} config
 * @param {() => boolean} config.isDeveloperModeActive - Returns whether developer mode is enabled.
 * @param {() => Object|null} config.getLamedSimulation - Returns the active Lamed simulation instance.
 * @param {() => Object|null} config.getTsadiSimulation - Returns the active Tsadi simulation instance.
 * @returns {Object} Developer spam controller API
 */
export function createDeveloperSpamController(config) {
  const { isDeveloperModeActive, getLamedSimulation, getTsadiSimulation } = config;

  // ── Lamed spam state ──────────────────────────────────────────────────
  let lamedSpamHandle = null;
  let lamedSpamActive = false;
  let lamedSpamAttached = false;

  // ── Tsadi spam state ──────────────────────────────────────────────────
  let tsadiSpamHandle = null;
  let tsadiSpamActive = false;
  let tsadiSpamAttached = false;

  // ── Lamed helpers ─────────────────────────────────────────────────────

  function stopLamedSpamLoop() {
    lamedSpamActive = false;
    if (lamedSpamHandle) {
      cancelAnimationFrame(lamedSpamHandle);
      lamedSpamHandle = null;
    }
  }

  function runLamedSpawnLoop() {
    if (!lamedSpamActive) {
      stopLamedSpamLoop();
      return;
    }
    const sim = getLamedSimulation();
    if (!isDeveloperModeActive() || !sim || typeof sim.spawnStar !== 'function') {
      stopLamedSpamLoop();
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!sim.spawnStar()) {
        break;
      }
    }

    lamedSpamHandle = window.requestAnimationFrame(() => runLamedSpawnLoop());
  }

  function handleLamedPointerDown(event) {
    const sim = getLamedSimulation();
    if (!isDeveloperModeActive() || !sim || typeof sim.spawnStar !== 'function') {
      return;
    }

    // Capture click position for star spawning
    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (typeof sim.setClickPosition === 'function') {
        sim.setClickPosition(x, y);
      }
    }

    lamedSpamActive = true;
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event?.target?.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (_e) {
        // Ignore pointer capture failures because the gesture can still continue without capture.
      }
    }
    if (!lamedSpamHandle) {
      runLamedSpawnLoop();
    }
  }

  function handleLamedPointerUp(event) {
    if (typeof event?.target?.releasePointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (_e) {
        // Ignore pointer capture failures because cleanup will continue regardless.
      }
    }
    stopLamedSpamLoop();
  }

  function attachLamedSpamTarget(canvas) {
    if (!canvas || lamedSpamAttached) {
      return;
    }
    lamedSpamAttached = true;
    canvas.addEventListener('pointerdown', handleLamedPointerDown);
    canvas.addEventListener('pointerup', handleLamedPointerUp);
    canvas.addEventListener('pointerleave', handleLamedPointerUp);
    canvas.addEventListener('pointercancel', handleLamedPointerUp);
  }

  // ── Tsadi helpers ─────────────────────────────────────────────────────

  function stopTsadiSpamLoop() {
    tsadiSpamActive = false;
    if (tsadiSpamHandle) {
      cancelAnimationFrame(tsadiSpamHandle);
      tsadiSpamHandle = null;
    }
  }

  function runTsadiSpawnLoop() {
    if (!tsadiSpamActive) {
      stopTsadiSpamLoop();
      return;
    }
    const sim = getTsadiSimulation();
    if (!isDeveloperModeActive() || !sim || typeof sim.spawnParticle !== 'function') {
      stopTsadiSpamLoop();
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!sim.spawnParticle()) {
        break;
      }
    }

    tsadiSpamHandle = window.requestAnimationFrame(() => runTsadiSpawnLoop());
  }

  function handleTsadiPointerDown(event) {
    const sim = getTsadiSimulation();
    if (!isDeveloperModeActive() || !sim || typeof sim.spawnParticle !== 'function') {
      return;
    }

    tsadiSpamActive = true;
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event?.target?.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (_e) {
        // Ignore pointer capture failures because the gesture can still continue without capture.
      }
    }
    if (!tsadiSpamHandle) {
      runTsadiSpawnLoop();
    }
  }

  function handleTsadiPointerUp(event) {
    if (typeof event?.target?.releasePointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (_e) {
        // Ignore pointer capture failures because cleanup will continue regardless.
      }
    }
    stopTsadiSpamLoop();
  }

  function attachTsadiSpamTarget(canvas) {
    if (!canvas || tsadiSpamAttached) {
      return;
    }
    tsadiSpamAttached = true;
    canvas.addEventListener('pointerdown', handleTsadiPointerDown);
    canvas.addEventListener('pointerup', handleTsadiPointerUp);
    canvas.addEventListener('pointerleave', handleTsadiPointerUp);
    canvas.addEventListener('pointercancel', handleTsadiPointerUp);
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    stopLamedSpamLoop,
    attachLamedSpamTarget,
    stopTsadiSpamLoop,
    attachTsadiSpamTarget,
  };
}
