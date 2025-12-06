'use strict';

/**
 * Animate the Bet terrarium sky through a gentle day/night loop with sun and moon arcs.
 * When celestial bodies are not purchased, the sky remains locked in night mode.
 */
export class FluidTerrariumSkyCycle {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.skyElement = options.skyElement || null;
    /** @type {HTMLElement|null} */
    this.sunElement = options.sunElement || null;
    /** @type {HTMLElement|null} */
    this.moonElement = options.moonElement || null;
    /**
     * Host element that shares CSS variables with the terrain sprites and overlays.
     * @type {HTMLElement|null}
     */
    this.stageElement = this.skyElement?.parentElement || null;
    /** @type {number} */
    this.cycleDurationMs = Number.isFinite(options.cycleDurationMs)
      ? Math.max(10000, options.cycleDurationMs)
      : 120000;

    /**
     * Whether the celestial bodies (sun/moon) have been purchased.
     * When false, the sky remains stuck in night mode and the sun/moon are hidden.
     * @type {boolean}
     */
    this.celestialBodiesEnabled = Boolean(options.celestialBodiesEnabled);
    
    /**
     * Whether sun specifically has been purchased.
     * @type {boolean}
     */
    this.sunEnabled = Boolean(options.sunEnabled);
    
    /**
     * Whether moon specifically has been purchased.
     * @type {boolean}
     */
    this.moonEnabled = Boolean(options.moonEnabled);

    this.animationFrame = null;
    this.startTime = null;

    // Night mode state for when celestial bodies are not purchased
    this.nightModeKeyframe = { skyTop: '#0d1c3c', skyBottom: '#060c21', starOpacity: 0.95 };

    this.phaseKeyframes = [
      { t: 0, skyTop: '#dff3ff', skyBottom: '#a4d9ff', starOpacity: 0 },
      { t: 0.55, skyTop: '#ffe5bb', skyBottom: '#ff9b76', starOpacity: 0.08 },
      { t: 0.7, skyTop: '#5d68bf', skyBottom: '#1f3f7c', starOpacity: 0.35 },
      { t: 0.85, skyTop: '#0d1c3c', skyBottom: '#060c21', starOpacity: 0.95 },
      { t: 1, skyTop: '#dff3ff', skyBottom: '#a4d9ff', starOpacity: 0 },
    ];

    this.handleFrame = this.handleFrame.bind(this);

    if (this.skyElement && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      // If celestial bodies are not enabled, apply night mode immediately
      if (!this.celestialBodiesEnabled) {
        this.applyNightMode();
      } else {
        this.applySkyState(0);
      }
      this.start();
    }
  }

  /**
   * Enable the celestial bodies, allowing the day/night cycle to animate.
   */
  enableCelestialBodies() {
    if (this.celestialBodiesEnabled) return;

    this.celestialBodiesEnabled = true;
    // Reset start time so the cycle begins fresh
    this.startTime = null;
  }

  /**
   * Disable the celestial bodies, locking the sky in night mode.
   */
  disableCelestialBodies() {
    this.celestialBodiesEnabled = false;
    this.applyNightMode();
  }

  /**
   * Apply a static night sky state when celestial bodies are not purchased.
   */
  applyNightMode() {
    if (!this.skyElement) return;

    const { skyTop, skyBottom, starOpacity } = this.nightModeKeyframe;
    this.skyElement.style.setProperty('--terrarium-sky-top', skyTop);
    this.skyElement.style.setProperty('--terrarium-sky-bottom', skyBottom);
    this.skyElement.style.setProperty('--terrarium-star-opacity', `${starOpacity}`);

    // Hide sun and moon when in night mode
    if (this.sunElement) {
      this.sunElement.style.opacity = '0';
    }
    if (this.moonElement) {
      this.moonElement.style.opacity = '0';
    }

    this.applyNightBrightness(starOpacity);
  }

  /**
   * Begin the recurring animation loop.
   */
  start() {
    if (this.animationFrame) {
      return;
    }
    this.animationFrame = window.requestAnimationFrame(this.handleFrame);
  }

  /**
   * Halt the animation loop when the terrarium is unmounted.
   */
  stop() {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Render the sky state for the current frame.
   * @param {DOMHighResTimeStamp} timestamp
   */
  handleFrame(timestamp) {
    if (!this.skyElement) {
      return;
    }

    // If celestial bodies are not enabled, maintain night mode
    if (!this.celestialBodiesEnabled) {
      this.applyNightMode();
      this.animationFrame = window.requestAnimationFrame(this.handleFrame);
      return;
    }

    if (!this.startTime) {
      this.startTime = timestamp;
    }
    const elapsed = (timestamp - this.startTime) % this.cycleDurationMs;
    const progress = this.clamp(elapsed / this.cycleDurationMs, 0, 1);

    this.applySkyState(progress);

    this.animationFrame = window.requestAnimationFrame(this.handleFrame);
  }

  /**
   * Apply gradient colors, star opacity, and sun/moon positions for a given cycle progress.
   * @param {number} progress - Normalized cycle progress between 0 and 1.
   */
  applySkyState(progress) {
    const { skyTop, skyBottom, starOpacity } = this.interpolateSkyPalette(progress);
    this.skyElement.style.setProperty('--terrarium-sky-top', skyTop);
    this.skyElement.style.setProperty('--terrarium-sky-bottom', skyBottom);
    this.skyElement.style.setProperty('--terrarium-star-opacity', `${starOpacity}`);

    this.updateSun(progress);
    this.updateMoon(progress);
    this.applyNightBrightness(starOpacity);
  }

  /**
   * Interpolate between palette keyframes to keep the gradient smooth.
   * @param {number} progress
   * @returns {{ skyTop: string, skyBottom: string, starOpacity: number }}
   */
  interpolateSkyPalette(progress) {
    const normalized = progress % 1;
    const frames = this.phaseKeyframes;

    let startFrame = frames[0];
    let endFrame = frames[frames.length - 1];

    for (let index = 0; index < frames.length - 1; index += 1) {
      const current = frames[index];
      const next = frames[index + 1];
      if (normalized >= current.t && normalized <= next.t) {
        startFrame = current;
        endFrame = next;
        break;
      }
    }

    const localProgress = this.computeLocalProgress(normalized, startFrame.t, endFrame.t);
    return {
      skyTop: this.mixHexColors(startFrame.skyTop, endFrame.skyTop, localProgress),
      skyBottom: this.mixHexColors(startFrame.skyBottom, endFrame.skyBottom, localProgress),
      starOpacity: this.mixScalar(startFrame.starOpacity, endFrame.starOpacity, localProgress),
    };
  }

  /**
   * Fade and place the sun along a shallow arc.
   * @param {number} progress
   */
  updateSun(progress) {
    if (!this.sunElement) {
      return;
    }
    // Hide sun if not purchased
    if (!this.sunEnabled) {
      this.sunElement.style.opacity = '0';
      return;
    }
    const sunStart = 0.02;
    const sunEnd = 0.65;
    const sunProgress = this.computeLocalProgress(progress, sunStart, sunEnd);
    const opacityRamp = this.easeInOut(this.fadeEdges(sunProgress));
    this.sunElement.style.opacity = `${opacityRamp}`;

    const { left, top } = this.computeArcPosition(sunProgress);
    this.sunElement.style.left = left;
    this.sunElement.style.top = top;
  }

  /**
   * Fade and place the moon along a mirrored arc.
   * @param {number} progress
   */
  updateMoon(progress) {
    if (!this.moonElement) {
      return;
    }
    // Hide moon if not purchased
    if (!this.moonEnabled) {
      this.moonElement.style.opacity = '0';
      return;
    }
    const moonStart = 0.48;
    const moonEnd = 0.98;
    const moonProgress = this.computeLocalProgress(progress, moonStart, moonEnd);
    const opacityRamp = this.easeInOut(this.fadeEdges(moonProgress));
    this.moonElement.style.opacity = `${opacityRamp}`;

    const { left, top } = this.computeArcPosition(moonProgress);
    this.moonElement.style.left = left;
    this.moonElement.style.top = top;
  }

  /**
   * Keep opacity pinned near zero at the edges of an arc.
   * @param {number} t - Local progress between 0 and 1.
   * @returns {number}
   */
  fadeEdges(t) {
    const entrance = this.smoothstep(0, 0.16, t);
    const exit = 1 - this.smoothstep(0.78, 1, t);
    return this.clamp(entrance * exit, 0, 1);
  }

  /**
   * Ease values so sun and moon opacity changes feel softer.
   * @param {number} t
   * @returns {number}
   */
  easeInOut(t) {
    return this.mixScalar(Math.sin((t * Math.PI) / 2) ** 2, t, 0.2);
  }

  /**
   * Map progress to a shallow sky arc so the sun and moon skim the horizon.
   * @param {number} t - Local progress between 0 and 1.
   * @returns {{ left: string, top: string }}
   */
  computeArcPosition(t) {
    const clamped = this.clamp(t, 0, 1);
    const horizontal = 10 + clamped * 80;
    const altitude = Math.sin(clamped * Math.PI);
    const vertical = 26 - altitude * 12;
    return { left: `${horizontal}%`, top: `${vertical}%` };
  }

  /**
   * Share a night-time brightness scalar with the terrarium so non-glowing sprites dim after dusk.
   * @param {number} starOpacity - Current opacity of the star layer, used as the night proxy.
   */
  applyNightBrightness(starOpacity) {
    if (!this.stageElement || !this.stageElement.style?.setProperty) {
      return;
    }
    const maxNightOpacity = 0.95;
    const maxDimming = 0.5;
    const normalizedNight = this.clamp(starOpacity / maxNightOpacity, 0, 1);
    const brightness = 1 - normalizedNight * maxDimming;
    this.stageElement.style.setProperty('--terrarium-night-brightness', `${brightness}`);
  }

  /**
   * Convert a global progress value to a 0-1 value within a window.
   * @param {number} progress
   * @param {number} start
   * @param {number} end
   * @returns {number}
   */
  computeLocalProgress(progress, start, end) {
    const length = end - start;
    if (length <= 0) {
      return 0;
    }
    return this.clamp((progress - start) / length, 0, 1);
  }

  /**
   * Blend two scalar values.
   * @param {number} from
   * @param {number} to
   * @param {number} t
   * @returns {number}
   */
  mixScalar(from, to, t) {
    const clampedT = this.clamp(t, 0, 1);
    return from + (to - from) * clampedT;
  }

  /**
   * Blend two hex color strings.
   * @param {string} from
   * @param {string} to
   * @param {number} t
   * @returns {string}
   */
  mixHexColors(from, to, t) {
    const start = this.parseHexColor(from);
    const end = this.parseHexColor(to);
    const clampedT = this.clamp(t, 0, 1);
    const r = Math.round(this.mixScalar(start.r, end.r, clampedT));
    const g = Math.round(this.mixScalar(start.g, end.g, clampedT));
    const b = Math.round(this.mixScalar(start.b, end.b, clampedT));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Parse a hex color string into RGB components.
   * @param {string} value
   * @returns {{ r: number, g: number, b: number }}
   */
  parseHexColor(value) {
    const sanitized = typeof value === 'string' ? value.replace('#', '') : '000000';
    const r = parseInt(sanitized.slice(0, 2), 16) || 0;
    const g = parseInt(sanitized.slice(2, 4), 16) || 0;
    const b = parseInt(sanitized.slice(4, 6), 16) || 0;
    return { r, g, b };
  }

  /**
   * Clamp a numeric input between 0 and 1.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  clamp(value, min = 0, max = 1) {
    if (!Number.isFinite(value)) {
      return min;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  /**
   * Smooth edges for fades so phase transitions never feel abrupt.
   * @param {number} edge0
   * @param {number} edge1
   * @param {number} x
   * @returns {number}
   */
  smoothstep(edge0, edge1, x) {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
}
