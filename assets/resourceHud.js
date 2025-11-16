/**
 * Resource HUD module encapsulates DOM bindings and display refresh logic for top-level
 * resource counters (Thero multiplier, glyph currencies, mote/Serendipity badges, etc.).
 *
 * The previous implementation lived inside `assets/main.js` and contributed to the file's
 * growth.  Extracting the logic into this factory keeps `main.js` focused on orchestration
 * while preserving shared state through dependency injection.
 */
export function createResourceHud({
  formatGameNumber,
  formatWholeNumber,
  getStartingTheroMultiplier,
  getGlyphCurrency,
  getBetGlyphCurrency,
  getShinGlyphs,
  getKufGlyphs,
  getCurrentIdleMoteBank,
  getCurrentFluidDropBank,
  powderState,
  spireResourceState,
  spireMenuController,
}) {
  const resourceElements = {
    theroMultiplier: null,
    glyphsAlephTotal: null,
    glyphsAlephUnused: null,
    glyphsBetTotal: null,
    glyphsBetUnused: null,
    glyphsLamedTotal: null,
    glyphsLamedUnused: null,
    glyphsTsadiTotal: null,
    glyphsTsadiUnused: null,
    glyphsShinTotal: null,
    glyphsShinUnused: null,
    glyphsKufTotal: null,
    glyphsKufUnused: null,
    tabGlyphBadge: null,
    tabMoteBadge: null,
    tabFluidBadge: null,
  };

  const trackedGlyphs = {
    lamed: 0,
    tsadi: 0,
    shin: 0,
    kuf: 0,
  };

  const statusRefreshCallbacks = new Set();

  /**
   * Cache DOM references for the resource panels so updates are limited to text swaps.
   */
  function bindStatusElements() {
    resourceElements.theroMultiplier = document.getElementById('level-thero-multiplier');
    resourceElements.glyphsAlephTotal = document.getElementById('tower-glyphs-aleph-total');
    resourceElements.glyphsAlephUnused = document.getElementById('tower-glyphs-aleph-unused');
    resourceElements.glyphsBetTotal = document.getElementById('tower-glyphs-bet-total');
    resourceElements.glyphsBetUnused = document.getElementById('tower-glyphs-bet-unused');
    resourceElements.glyphsLamedTotal = document.getElementById('tower-glyphs-lamed-total');
    resourceElements.glyphsLamedUnused = document.getElementById('tower-glyphs-lamed-unused');
    resourceElements.glyphsTsadiTotal = document.getElementById('tower-glyphs-tsadi-total');
    resourceElements.glyphsTsadiUnused = document.getElementById('tower-glyphs-tsadi-unused');
    resourceElements.glyphsShinTotal = document.getElementById('tower-glyphs-shin-total');
    resourceElements.glyphsShinUnused = document.getElementById('tower-glyphs-shin-unused');
    resourceElements.glyphsKufTotal = document.getElementById('tower-glyphs-kuf-total');
    resourceElements.glyphsKufUnused = document.getElementById('tower-glyphs-kuf-unused');
    resourceElements.tabGlyphBadge = document.getElementById('tab-glyph-badge');
    resourceElements.tabMoteBadge = document.getElementById('tab-mote-badge');
    resourceElements.tabFluidBadge = document.getElementById('tab-fluid-badge');
    updateStatusDisplays();
  }

  /**
   * Refresh resource HUD values based on the latest game state snapshots.
   */
  function updateStatusDisplays() {
    const theroMultiplier = getStartingTheroMultiplier();
    if (resourceElements.theroMultiplier) {
      const multiplierLabel = formatGameNumber(theroMultiplier);
      resourceElements.theroMultiplier.textContent = `×${multiplierLabel}`;
      resourceElements.theroMultiplier.setAttribute('aria-label', `Thero multiplier ×${multiplierLabel}`);
    }

    const totalAlephGlyphs = Math.max(0, Math.floor(powderState.glyphsAwarded || 0));
    const unusedAlephGlyphs = Math.max(0, Math.floor(getGlyphCurrency())) || 0;
    if (resourceElements.glyphsAlephTotal) {
      resourceElements.glyphsAlephTotal.textContent = `${formatWholeNumber(totalAlephGlyphs)} ℵ`;
    }
    if (resourceElements.glyphsAlephUnused) {
      if (unusedAlephGlyphs > 0) {
        resourceElements.glyphsAlephUnused.textContent = `${formatWholeNumber(unusedAlephGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsAlephUnused.textContent = '';
      }
    }

    const totalBetGlyphs = Math.max(0, Math.floor(getBetGlyphCurrency()));
    const unusedBetGlyphs = totalBetGlyphs;
    if (resourceElements.glyphsBetTotal) {
      resourceElements.glyphsBetTotal.textContent = `${formatWholeNumber(totalBetGlyphs)} בּ`;
    }
    if (resourceElements.glyphsBetUnused) {
      if (unusedBetGlyphs > 0) {
        resourceElements.glyphsBetUnused.textContent = `${formatWholeNumber(unusedBetGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsBetUnused.textContent = '';
      }
    }

    const totalLamedGlyphs = Math.max(
      0,
      Math.floor(spireResourceState.lamed?.stats?.totalAbsorptions || 0),
    );
    if (resourceElements.glyphsLamedTotal) {
      resourceElements.glyphsLamedTotal.textContent = `${formatWholeNumber(totalLamedGlyphs)} ל`;
    }
    if (resourceElements.glyphsLamedUnused) {
      if (totalLamedGlyphs > 0) {
        resourceElements.glyphsLamedUnused.textContent = `${formatWholeNumber(totalLamedGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsLamedUnused.textContent = '';
      }
    }

    const tsadiStats = spireResourceState.tsadi?.stats || {};
    const totalTsadiGlyphs = Math.max(
      0,
      Math.floor(
        Number.isFinite(tsadiStats.totalGlyphs)
          ? tsadiStats.totalGlyphs
          : tsadiStats.totalParticles || 0,
      ),
    );
    if (resourceElements.glyphsTsadiTotal) {
      resourceElements.glyphsTsadiTotal.textContent = `${formatWholeNumber(totalTsadiGlyphs)} צ`;
    }
    if (resourceElements.glyphsTsadiUnused) {
      if (totalTsadiGlyphs > 0) {
        resourceElements.glyphsTsadiUnused.textContent = `${formatWholeNumber(totalTsadiGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsTsadiUnused.textContent = '';
      }
    }

    const totalShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
    if (resourceElements.glyphsShinTotal) {
      resourceElements.glyphsShinTotal.textContent = `${formatWholeNumber(totalShinGlyphs)} ש`;
    }
    if (resourceElements.glyphsShinUnused) {
      if (totalShinGlyphs > 0) {
        resourceElements.glyphsShinUnused.textContent = `${formatWholeNumber(totalShinGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsShinUnused.textContent = '';
      }
    }

    const totalKufGlyphs = Math.max(0, Math.floor(getKufGlyphs()));
    if (resourceElements.glyphsKufTotal) {
      resourceElements.glyphsKufTotal.textContent = `${formatWholeNumber(totalKufGlyphs)} ק`;
    }
    if (resourceElements.glyphsKufUnused) {
      if (totalKufGlyphs > 0) {
        resourceElements.glyphsKufUnused.textContent = `${formatWholeNumber(totalKufGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsKufUnused.textContent = '';
      }
    }

    if (resourceElements.tabGlyphBadge) {
      const tabGlyphLabel = formatWholeNumber(unusedAlephGlyphs);
      resourceElements.tabGlyphBadge.textContent = tabGlyphLabel;
      resourceElements.tabGlyphBadge.setAttribute('aria-label', `${tabGlyphLabel} unused Aleph glyphs`);
      if (unusedAlephGlyphs > 0) {
        resourceElements.tabGlyphBadge.removeAttribute('hidden');
        resourceElements.tabGlyphBadge.setAttribute('aria-hidden', 'false');
      } else {
        resourceElements.tabGlyphBadge.setAttribute('hidden', '');
        resourceElements.tabGlyphBadge.setAttribute('aria-hidden', 'true');
      }
    }

    const bankedMotes = getCurrentIdleMoteBank();
    if (resourceElements.tabMoteBadge) {
      const tabStoredLabel = formatGameNumber(bankedMotes);
      resourceElements.tabMoteBadge.textContent = tabStoredLabel;
      resourceElements.tabMoteBadge.setAttribute('aria-label', `${tabStoredLabel} motes in bank`);
      resourceElements.tabMoteBadge.removeAttribute('hidden');
      resourceElements.tabMoteBadge.setAttribute('aria-hidden', 'false');
    }

    const bankedDrops = getCurrentFluidDropBank();
    if (resourceElements.tabFluidBadge) {
      const tabStoredLabel = formatGameNumber(bankedDrops);
      resourceElements.tabFluidBadge.textContent = tabStoredLabel;
      resourceElements.tabFluidBadge.setAttribute('aria-label', `${tabStoredLabel} Serendipity in reserve`);
      if (powderState.fluidUnlocked) {
        resourceElements.tabFluidBadge.removeAttribute('hidden');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'false');
      } else {
        resourceElements.tabFluidBadge.setAttribute('hidden', '');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'true');
      }
    }

    statusRefreshCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Resource HUD status refresh callback failed', error);
      }
    });

    if (spireMenuController && typeof spireMenuController.updateCounts === 'function') {
      spireMenuController.updateCounts();
    }
  }

  /**
   * Register a callback that should run after each status refresh. Used for powder HUD sync.
   * @param {Function} callback
   */
  function registerStatusRefreshCallback(callback) {
    if (typeof callback === 'function') {
      statusRefreshCallbacks.add(callback);
    }
  }

  function setTrackedGlyphCount(key, value) {
    const normalized = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    trackedGlyphs[key] = normalized;
    return normalized;
  }

  function getTrackedGlyphCount(key) {
    return trackedGlyphs[key];
  }

  return {
    resourceElements,
    bindStatusElements,
    updateStatusDisplays,
    registerStatusRefreshCallback,
    getTrackedLamedGlyphs: () => getTrackedGlyphCount('lamed'),
    setTrackedLamedGlyphs: (value) => setTrackedGlyphCount('lamed', value),
    getTrackedTsadiGlyphs: () => getTrackedGlyphCount('tsadi'),
    setTrackedTsadiGlyphs: (value) => setTrackedGlyphCount('tsadi', value),
    getTrackedShinGlyphs: () => getTrackedGlyphCount('shin'),
    setTrackedShinGlyphs: (value) => setTrackedGlyphCount('shin', value),
    getTrackedKufGlyphs: () => getTrackedGlyphCount('kuf'),
    setTrackedKufGlyphs: (value) => setTrackedGlyphCount('kuf', value),
  };
}
