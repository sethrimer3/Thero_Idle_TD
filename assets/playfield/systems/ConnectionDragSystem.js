// Connection and Delta command drag system extracted from SimplePlayfield (Build 710).
// These functions use 'this' (the SimplePlayfield instance) via .call().

/**
 * Refresh connection drag highlights so compatible towers glow while the cursor moves.
 */
export function updateConnectionDragHighlights(position) {
  const dragState = this.connectionDragState;
  if (!dragState || !dragState.originTowerId) {
    return;
  }
  const origin = this.getTowerById(dragState.originTowerId);
  if (!origin) {
    this.clearConnectionDragState();
    return;
  }
  const entries = [];
  if (origin.linkTargetId) {
    entries.push({
      action: 'disconnect',
      sourceId: origin.id,
      targetId: origin.linkTargetId,
      towerId: origin.linkTargetId,
      role: 'existingTarget',
    });
  }
  if (origin.linkSources instanceof Set) {
    origin.linkSources.forEach((sourceId) => {
      entries.push({
        action: 'disconnect',
        sourceId,
        targetId: origin.id,
        towerId: sourceId,
        role: 'linkedSource',
      });
    });
  }
  this.towers.forEach((candidate) => {
    if (!candidate || candidate.id === origin.id) {
      return;
    }
    if (this.areTowersConnectionCompatible(origin, candidate)) {
      entries.push({
        action: 'connect',
        sourceId: origin.id,
        targetId: candidate.id,
        towerId: candidate.id,
        role: 'candidate',
      });
    }
  });
  dragState.highlightEntries = entries;
  dragState.hoverEntry = resolveConnectionHoverEntry.call(this, entries, position);
}

/**
 * Select the highlight entry the pointer is currently hovering.
 */
export function resolveConnectionHoverEntry(entries, position) {
  if (!Array.isArray(entries) || !entries.length || !position) {
    return null;
  }
  const hoverRadius = Math.max(18, Math.min(this.renderWidth || 0, this.renderHeight || 0) * 0.045);
  let best = null;
  let bestDistance = Infinity;
  entries.forEach((entry) => {
    const tower = this.getTowerById(entry.towerId);
    if (!tower) {
      return;
    }
    const dx = position.x - tower.x;
    const dy = position.y - tower.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance)) {
      return;
    }
    if (distance <= hoverRadius && distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Update the delta / omicron / upsilon command drag state as the pointer moves.
 */
export function updateDeltaCommandDrag(position) {
  const dragState = this.deltaCommandDragState;
  if (!dragState || !dragState.towerId) {
    return;
  }
  const tower = this.getTowerById(dragState.towerId);
  if (!tower) {
    this.clearDeltaCommandDragState();
    return;
  }
  const towerLabel = tower.type === 'omicron'
    ? 'ο wing'
    : tower.type === 'upsilon'
      ? 'υ flight'
      : 'Δ cohort';
  dragState.currentPosition = position ? { x: position.x, y: position.y } : null;
  if (!position) {
    if (dragState.anchorAvailable && this.messageEl) {
      this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
    }
    dragState.trackAnchor = null;
    dragState.anchorAvailable = false;
    dragState.trackDistance = Infinity;
    return;
  }

  const projection = this.getClosestPointOnPath(position);
  if (!projection?.point) {
    if (dragState.anchorAvailable && this.messageEl) {
      this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
    }
    dragState.trackAnchor = null;
    dragState.anchorAvailable = false;
    dragState.trackDistance = Infinity;
    return;
  }

  const distance = Math.hypot(position.x - projection.point.x, position.y - projection.point.y);
  dragState.trackDistance = distance;
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const tolerance = Math.max(24, minDimension * 0.05);
  const withinTrack = Number.isFinite(distance) && distance <= tolerance;
  if (withinTrack) {
    dragState.trackAnchor = {
      point: { x: projection.point.x, y: projection.point.y },
      progress: Number.isFinite(projection.progress)
        ? Math.max(0, Math.min(1, projection.progress))
        : 0,
    };
    if (!dragState.anchorAvailable && this.messageEl) {
      this.messageEl.textContent = `Release to anchor the ${towerLabel} to the glyph lane.`;
    }
    dragState.anchorAvailable = true;
  } else {
    if (dragState.anchorAvailable && this.messageEl) {
      this.messageEl.textContent = `Drag onto the glyph lane to position the ${towerLabel}.`;
    }
    dragState.trackAnchor = null;
    dragState.anchorAvailable = false;
  }
}

/**
 * Commit the current delta/omicron/upsilon command drag by assigning the selected anchor.
 */
export function commitDeltaCommandDrag() {
  const dragState = this.deltaCommandDragState;
  if (!dragState?.towerId || !dragState.trackAnchor) {
    return false;
  }
  const tower = this.getTowerById(dragState.towerId);
  if (!tower) {
    return false;
  }
  const anchor = {
    x: dragState.trackAnchor.point.x,
    y: dragState.trackAnchor.point.y,
    progress: dragState.trackAnchor.progress,
  };
  let assigned = false;
  if (tower.type === 'omicron') {
    assigned = this.assignOmicronTrackHoldAnchor(tower, anchor);
  } else if (tower.type === 'upsilon') {
    assigned = this.assignUpsilonTrackHoldAnchor(tower, anchor);
  } else {
    assigned = this.assignDeltaTrackHoldAnchor(tower, anchor);
  }
  if (assigned) {
    if (this.audio && typeof this.audio.playSfx === 'function') {
      this.audio.playSfx('uiConfirm');
    }
    if (this.messageEl) {
      const towerLabel = tower.type === 'omicron'
        ? 'ο wing anchor locked to the glyph lane.'
        : tower.type === 'upsilon'
          ? 'υ flight path locked to the glyph lane.'
          : 'Δ cohort orbit anchored to the glyph lane.';
      this.messageEl.textContent = towerLabel;
    }
    if (!this.shouldAnimate) {
      this.draw();
    }
  }
  return assigned;
}
