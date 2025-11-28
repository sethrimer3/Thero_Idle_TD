import {
  POWDER_CELL_SIZE_PX,
  clampUnitInterval,
  colorToRgbaString,
  resolvePaletteColorStops,
} from '../scripts/features/towers/powderTower.js';
import { formatAlephLabel, formatBetLabel } from './formatHelpers.js';

/**
 * Factory that bundles DOM helpers used by the powder and Bet Spire Terrarium overlays.
 * @param {Object} options - Dependency injection container for DOM bindings and utilities.
 * @returns {Object} Powder overlay helper functions consumed by main.js.
 */
export function createPowderUiDomHelpers(options = {}) {
  const {
    getPowderElements,
    fluidElements,
    powderGlyphColumns = [],
    fluidGlyphColumns = [],
    moteGemState,
    formatWholeNumber,
    formatGameNumber,
    getMoteGemColor,
    getGemSpriteAssetPath,
  } = options;

  /**
   * Resolve the latest powder panel elements so helpers can gracefully handle early invocations.
   * @returns {Object|null}
   */
  const resolvePowderElements = () => {
    if (typeof getPowderElements === 'function') {
      try {
        return getPowderElements() || null;
      } catch (error) {
        console.warn('Failed to resolve powder elements for UI helper.', error);
      }
    }
    return null;
  };

  // Collect references to the Bet Spire UI so powderDisplay can hydrate the fluid viewport.
  function bindFluidControls() {
    if (!fluidElements || typeof document === 'undefined') {
      return;
    }
    fluidElements.panel = document.getElementById('panel-fluid');
    fluidElements.host = document.getElementById('fluid-simulation-host');
    fluidElements.simulationCard = document.getElementById('fluid-simulation-card');
    fluidElements.canvas = document.getElementById('fluid-canvas');
    fluidElements.basin = document.getElementById('fluid-basin');
    fluidElements.terrariumLayer = document.getElementById('fluid-terrarium-layer');
    fluidElements.terrariumStage = document.getElementById('fluid-terrarium-stage');
    fluidElements.terrariumMedia = document.getElementById('fluid-terrarium-stage-media');
    // Cache terrarium sky layers for the day/night cycle renderer.
    fluidElements.terrariumSky = document.getElementById('fluid-terrarium-sky');
    fluidElements.terrariumStarsNear = document.getElementById('fluid-terrarium-stars-near');
    fluidElements.terrariumStarsFar = document.getElementById('fluid-terrarium-stars-far');
    fluidElements.terrariumSun = document.getElementById('fluid-terrarium-sun');
    fluidElements.terrariumMoon = document.getElementById('fluid-terrarium-moon');
    fluidElements.viewport = document.getElementById('fluid-viewport');
    fluidElements.leftWall = document.getElementById('fluid-wall-left');
    fluidElements.rightWall = document.getElementById('fluid-wall-right');
    fluidElements.leftHitbox = document.getElementById('fluid-wall-hitbox-left');
    fluidElements.rightHitbox = document.getElementById('fluid-wall-hitbox-right');
    fluidElements.reservoirValue = document.getElementById('fluid-reservoir');
    fluidElements.dripRateValue = document.getElementById('fluid-drip-rate');
    fluidElements.statusNote = document.getElementById('fluid-status-note');
    fluidElements.cameraModeToggle = document.getElementById('fluid-camera-mode-toggle');
    fluidElements.cameraModeStateLabel = document.getElementById('fluid-camera-mode-state');
    fluidElements.cameraModeHint = document.getElementById('fluid-camera-mode-hint');
    fluidElements.floatingIslandSprite = document.getElementById('fluid-terrarium-floating-island');
    fluidElements.terrainSprite = document.getElementById('fluid-terrarium-foreground');
    // Reuse the high-fidelity terrain SVG for collision sampling so silhouettes match visuals.
    fluidElements.terrainCollisionSprite =
      document.getElementById('fluid-terrarium-foreground-collision') || fluidElements.terrainSprite;
    fluidElements.happinessTotal = document.getElementById('fluid-happiness-total');
    fluidElements.happinessRate = document.getElementById('fluid-happiness-rate');
    fluidElements.happinessList = document.getElementById('fluid-happiness-list');
    fluidElements.happinessEmpty = document.getElementById('fluid-happiness-empty');
    // Track progress toward the next Bet glyph unlock.
    fluidElements.happinessProgressBar = document.getElementById('fluid-happiness-progress');
    fluidElements.happinessProgressFill = document.getElementById('fluid-happiness-progress-fill');
    fluidElements.happinessProgressLabel = document.getElementById('fluid-happiness-progress-label');
    fluidElements.happinessProgressPrevious = document.getElementById('fluid-happiness-progress-previous');
    fluidElements.happinessProgressNext = document.getElementById('fluid-happiness-progress-next');
    fluidElements.happinessProgressCurrent = document.getElementById('fluid-happiness-progress-current');
    fluidElements.wallGlyphColumns = Array.from(
      document.querySelectorAll('[data-fluid-glyph-column]') || [],
    );
  }

  // Align the Towers tab Mind Gate emblem with the active mote palette so the UI mirrors the canvas exponent glow.
  function applyMindGatePaletteToDom(palette) {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (!root || typeof root.style?.setProperty !== 'function') {
      return;
    }
    const stops = resolvePaletteColorStops(palette);
    if (!Array.isArray(stops) || stops.length === 0) {
      return;
    }

    const denominator = Math.max(1, stops.length - 1);
    const maxAlpha = 0.32;
    const minAlpha = 0.18;
    const gradientParts = [];
    stops.forEach((stop, index) => {
      const offset = denominator === 0 ? 0 : index / denominator;
      const alpha = maxAlpha - (maxAlpha - minAlpha) * offset;
      const color = colorToRgbaString(stop, alpha);
      const percent = Math.round(offset * 100);
      gradientParts.push(`${color} ${percent}%`);
    });
    if (gradientParts.length === 1) {
      gradientParts.push(`${colorToRgbaString(stops[0], minAlpha)} 100%`);
    }

    const gradientValue = `linear-gradient(140deg, ${gradientParts.join(', ')})`;
    root.style.setProperty('--mind-gate-gradient', gradientValue);

    const primaryStop = stops[stops.length - 1];
    const secondaryStop = stops[0];
    root.style.setProperty('--mind-gate-highlight', colorToRgbaString(primaryStop, 0.92));
    root.style.setProperty('--mind-gate-glow-primary', colorToRgbaString(primaryStop, 0.55));
    root.style.setProperty('--mind-gate-icon-glow', colorToRgbaString(primaryStop, 0.55));
    root.style.setProperty('--mind-gate-text-glow', colorToRgbaString(primaryStop, 0.65));
    root.style.setProperty('--mind-gate-glow-secondary', colorToRgbaString(secondaryStop, 0.3));
  }

  // Refresh the mote gem inventory card so collected crystals mirror the latest drop ledger.
  function updateMoteGemInventoryDisplay() {
    if (!moteGemState) {
      return;
    }
    const powderElements = resolvePowderElements();
    const { gemInventoryList, gemInventoryEmpty, craftingButton } = powderElements || {};
    if (!gemInventoryList || !moteGemState.inventory?.entries) {
      return;
    }

    const entries = Array.from(moteGemState.inventory.entries())
      .map(([typeKey, record = {}]) => {
        const label = typeof record.label === 'string' && record.label.trim().length
          ? record.label.trim()
          : typeKey;
        const total = Number.isFinite(record.total) ? Math.max(0, record.total) : 0;
        const count = Number.isFinite(record.count) ? Math.max(0, Math.floor(record.count)) : 0;
        return { typeKey, label, total, count };
      })
      .filter((entry) => entry.total > 0 || entry.count > 0)
      .sort((a, b) => {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.label.localeCompare(b.label);
      });

    gemInventoryList.textContent = '';

    if (!entries.length) {
      gemInventoryList.setAttribute('aria-hidden', 'true');
      gemInventoryList.hidden = true;
      if (gemInventoryEmpty) {
        gemInventoryEmpty.hidden = false;
        gemInventoryEmpty.setAttribute('aria-hidden', 'false');
      }
      if (craftingButton) {
        craftingButton.disabled = false;
        craftingButton.removeAttribute('aria-disabled');
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'powder-gem-inventory__item';
      item.dataset.gemId = entry.typeKey;

      const labelContainer = document.createElement('span');
      labelContainer.className = 'powder-gem-inventory__label';

      const swatch = document.createElement('span');
      swatch.className = 'powder-gem-inventory__swatch';
      const spritePath = typeof getGemSpriteAssetPath === 'function'
        ? getGemSpriteAssetPath(entry.typeKey)
        : null;
      if (spritePath) {
        // Embed the gem sprite so the inventory mirrors the drop art one-to-one.
        swatch.classList.add('powder-gem-inventory__swatch--sprite');
        const spriteImg = document.createElement('img');
        spriteImg.className = 'powder-gem-inventory__sprite';
        spriteImg.decoding = 'async';
        spriteImg.loading = 'lazy';
        spriteImg.alt = '';
        spriteImg.src = spritePath;
        swatch.appendChild(spriteImg);
      } else if (typeof getMoteGemColor === 'function') {
        // Fall back to the procedural color when the sprite asset is unavailable.
        const color = getMoteGemColor(entry.typeKey);
        if (color && typeof swatch.style?.setProperty === 'function') {
          if (Number.isFinite(color.hue)) {
            swatch.style.setProperty('--gem-hue', `${Math.round(color.hue)}`);
          }
          if (Number.isFinite(color.saturation)) {
            swatch.style.setProperty('--gem-saturation', `${Math.round(color.saturation)}%`);
          }
          if (Number.isFinite(color.lightness)) {
            swatch.style.setProperty('--gem-lightness', `${Math.round(color.lightness)}%`);
          }
        }
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'powder-gem-inventory__name';
      nameEl.textContent = entry.label || entry.typeKey;

      labelContainer.appendChild(swatch);
      labelContainer.appendChild(nameEl);

      const countEl = document.createElement('span');
      countEl.className = 'powder-gem-inventory__count';
      const clusterLabel = entry.count === 1 ? 'cluster' : 'clusters';
      const moteLabel = entry.total === 1 ? 'Mote' : 'Motes';
      const formatClusters = typeof formatWholeNumber === 'function'
        ? formatWholeNumber(entry.count)
        : `${entry.count}`;
      const formatMotes = typeof formatGameNumber === 'function'
        ? formatGameNumber(entry.total)
        : `${entry.total}`;
      countEl.textContent = `${formatClusters} ${clusterLabel} · ${formatMotes} ${moteLabel}`;

      item.appendChild(labelContainer);
      item.appendChild(countEl);
      fragment.appendChild(item);
    });

    gemInventoryList.hidden = false;
    gemInventoryList.setAttribute('aria-hidden', 'false');
    gemInventoryList.appendChild(fragment);

    if (gemInventoryEmpty) {
      gemInventoryEmpty.hidden = true;
      gemInventoryEmpty.setAttribute('aria-hidden', 'true');
    }

    if (craftingButton) {
      craftingButton.disabled = false;
      craftingButton.removeAttribute('aria-disabled');
    }
  }

  function createGlyphIndexNormalizer(base, spacing) {
    return (value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.floor((value - base) / spacing);
    };
  }

  // Powder simulation metrics are supplied via the powder tower module.
  function updatePowderGlyphColumns(info = {}) {
    const rows = Number.isFinite(info.rows) && info.rows > 0 ? info.rows : 1;
    const cellSize = Number.isFinite(info.cellSize) && info.cellSize > 0 ? info.cellSize : POWDER_CELL_SIZE_PX;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const highestRawInput = Number.isFinite(info.highestNormalized) ? info.highestNormalized : 0;
    const totalRawInput = Number.isFinite(info.totalNormalized) ? info.totalNormalized : highestRawInput;
    const highestNormalized = Math.max(0, highestRawInput, totalRawInput);
    const GLYPH_SPACING_NORMALIZED = 0.5;
    const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
    const safeRows = Math.max(1, rows);
    const basinHeight = safeRows * cellSize;
    const viewTopNormalized = scrollOffset / safeRows;
    const viewBottomNormalized = (scrollOffset + safeRows) / safeRows;
    const bufferGlyphs = 2;

    const normalizeIndex = createGlyphIndexNormalizer(GLYPH_BASE_NORMALIZED, GLYPH_SPACING_NORMALIZED);

    const rawMinIndex = normalizeIndex(viewTopNormalized);
    const rawMaxIndex = Math.ceil(
      (viewBottomNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED,
    );
    const minIndex = Math.max(0, (Number.isFinite(rawMinIndex) ? rawMinIndex : 0) - bufferGlyphs);
    const maxIndex = Math.max(
      minIndex,
      (Number.isFinite(rawMaxIndex) ? rawMaxIndex : 0) + bufferGlyphs,
    );

    const glyphHeightForIndex = (index) =>
      GLYPH_BASE_NORMALIZED + Math.max(0, index) * GLYPH_SPACING_NORMALIZED;

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          if (index < minIndex || index > maxIndex) {
            column.element.removeChild(glyph);
            column.glyphs.delete(index);
          }
        });

        for (let index = minIndex; index <= maxIndex; index += 1) {
          let glyph = column.glyphs.get(index);
          if (!glyph) {
            glyph = document.createElement('span');
            glyph.className = 'powder-glyph';
            glyph.dataset.alephIndex = String(index);
            column.element.appendChild(glyph);
            column.glyphs.set(index, glyph);
          }
          glyph.textContent = formatAlephLabel(index);
          const glyphNormalized = glyphHeightForIndex(index);
          const relativeRows = glyphNormalized * safeRows - scrollOffset;
          const topPx = basinHeight - relativeRows * cellSize;
          glyph.style.top = `${topPx.toFixed(1)}px`;
          const achieved = highestNormalized >= glyphNormalized;
          glyph.classList.toggle('powder-glyph--achieved', achieved);
        }
      });
    }

    const glyphsLit =
      highestNormalized >= GLYPH_BASE_NORMALIZED
        ? Math.max(
            0,
            Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1,
          )
        : 0;
    const achievedIndex = glyphsLit > 0 ? glyphsLit - 1 : 0;
    const nextIndex = glyphsLit;
    const previousThreshold =
      glyphsLit > 0
        ? GLYPH_BASE_NORMALIZED + (glyphsLit - 1) * GLYPH_SPACING_NORMALIZED
        : 0;
    const nextThreshold = GLYPH_BASE_NORMALIZED + glyphsLit * GLYPH_SPACING_NORMALIZED;
    const span = Math.max(GLYPH_SPACING_NORMALIZED, nextThreshold - previousThreshold);
    const progressFraction = clampUnitInterval((highestNormalized - previousThreshold) / span);
    const remainingToNext = Math.max(0, nextThreshold - highestNormalized);

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          const isTarget = index === nextIndex;
          const glyphNormalized = glyphHeightForIndex(index);
          glyph.classList.toggle('powder-glyph--target', isTarget);
          glyph.classList.toggle('powder-glyph--achieved', highestNormalized >= glyphNormalized);
        });
      });
    }

    return {
      achievedCount: achievedIndex,
      nextIndex,
      highestRaw: highestNormalized,
      glyphsLit,
      progressFraction,
      remainingToNext,
    };
  }

  function removeFluidGlyph(column, index) {
    const glyph = column.glyphs.get(index);
    if (glyph) {
      column.element.removeChild(glyph);
      column.glyphs.delete(index);
    }
  }

  // Bet spire glyphs render on the right wall and share spacing conventions with Aleph glyphs.
  function updateFluidGlyphColumns(info = {}) {
    const rows = Number.isFinite(info.rows) && info.rows > 0 ? info.rows : 1;
    const cellSize = Number.isFinite(info.cellSize) && info.cellSize > 0 ? info.cellSize : POWDER_CELL_SIZE_PX;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const highestRawInput = Number.isFinite(info.highestNormalized) ? info.highestNormalized : 0;
    const totalRawInput = Number.isFinite(info.totalNormalized) ? info.totalNormalized : highestRawInput;
    const highestNormalized = Math.max(0, highestRawInput, totalRawInput);
    const GLYPH_SPACING_NORMALIZED = 0.5;
    const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
    const safeRows = Math.max(1, rows);
    const basinHeight = safeRows * cellSize;
    const viewTopNormalized = scrollOffset / safeRows;
    const viewBottomNormalized = (scrollOffset + safeRows) / safeRows;
    const bufferGlyphs = 2;

    const normalizeIndex = createGlyphIndexNormalizer(GLYPH_BASE_NORMALIZED, GLYPH_SPACING_NORMALIZED);

    const rawMinIndex = normalizeIndex(viewTopNormalized);
    const rawMaxIndex = Math.ceil(
      (viewBottomNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED,
    );
    const minIndex = Math.max(0, (Number.isFinite(rawMinIndex) ? rawMinIndex : 0) - bufferGlyphs);
    const maxIndex = Math.max(
      minIndex,
      (Number.isFinite(rawMaxIndex) ? rawMaxIndex : 0) + bufferGlyphs,
    );

    const glyphHeightForIndex = (index) =>
      GLYPH_BASE_NORMALIZED + Math.max(0, index) * GLYPH_SPACING_NORMALIZED;

    if (fluidGlyphColumns.length) {
      fluidGlyphColumns.forEach((column) => {
        const isLeftWall = column.side === 'left';

        // Only show Bet glyphs on the right wall; left wall should be empty.
        if (isLeftWall) {
          column.glyphs.forEach((_, index) => {
            removeFluidGlyph(column, index);
          });
          return;
        }

        const indicesToDelete = [];
        column.glyphs.forEach((_, index) => {
          if (index < minIndex || index > maxIndex) {
            indicesToDelete.push(index);
          }
        });

        indicesToDelete.forEach((index) => {
          removeFluidGlyph(column, index);
        });

        for (let index = minIndex; index <= maxIndex; index += 1) {
          let glyph = column.glyphs.get(index);
          if (!glyph) {
            glyph = document.createElement('span');
            glyph.className = 'powder-glyph';
            glyph.dataset.betIndex = String(index);
            column.element.appendChild(glyph);
            column.glyphs.set(index, glyph);
          }
          glyph.textContent = formatBetLabel(index);
          const glyphNormalized = glyphHeightForIndex(index);
          const relativeRows = glyphNormalized * safeRows - scrollOffset;
          const topPx = basinHeight - relativeRows * cellSize;
          glyph.style.top = `${topPx.toFixed(1)}px`;
          const achieved = highestNormalized >= glyphNormalized;
          glyph.classList.toggle('powder-glyph--achieved', achieved);
        }
      });
    }

    const glyphsLit =
      highestNormalized >= GLYPH_BASE_NORMALIZED
        ? Math.max(
            0,
            Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1,
          )
        : 0;
    const achievedIndex = glyphsLit > 0 ? glyphsLit - 1 : 0;
    const nextIndex = glyphsLit;
    const previousThreshold =
      glyphsLit > 0
        ? GLYPH_BASE_NORMALIZED + (glyphsLit - 1) * GLYPH_SPACING_NORMALIZED
        : 0;
    const nextThreshold = GLYPH_BASE_NORMALIZED + glyphsLit * GLYPH_SPACING_NORMALIZED;
    const span = Math.max(GLYPH_SPACING_NORMALIZED, nextThreshold - previousThreshold);
    const progressFraction = clampUnitInterval((highestNormalized - previousThreshold) / span);
    const remainingToNext = Math.max(0, nextThreshold - highestNormalized);

    if (fluidGlyphColumns.length) {
      fluidGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          const isTarget = index === nextIndex;
          const glyphNormalized = glyphHeightForIndex(index);
          glyph.classList.toggle('powder-glyph--target', isTarget);
          glyph.classList.toggle('powder-glyph--achieved', highestNormalized >= glyphNormalized);
        });
      });
    }

    return {
      achievedCount: achievedIndex,
      nextIndex,
      highestRaw: highestNormalized,
      glyphsLit,
      progressFraction,
      remainingToNext,
    };
  }

  return {
    bindFluidControls,
    applyMindGatePaletteToDom,
    updateMoteGemInventoryDisplay,
    updatePowderGlyphColumns,
    updateFluidGlyphColumns,
  };
}

export default createPowderUiDomHelpers;
