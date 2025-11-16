// Centralized performance instrumentation for playfield subsystems and towers.
const PERFORMANCE_WINDOW = 180; // Track roughly three seconds of frames at 60 fps.
const PUBLISH_INTERVAL_MS = 1200; // Emit codex snapshots at most every ~1.2 seconds.
const MAX_LOG_ENTRIES = 6;
const AUTO_LOW_THRESHOLD_MS = 26; // Trigger dynamic low graphics if frames exceed ~38 fps.
const AUTO_RECOVERY_THRESHOLD_MS = 18; // Restore visuals when the frame cost stabilizes.
const AUTO_LOW_STREAK = 4; // Require ~4 snapshots (≈5 seconds) before toggling low mode.
const AUTO_RECOVERY_STREAK = 6;

const snapshotSubscribers = new Set();
const frameBuffer = [];
const performanceLog = [];
let currentFrame = null;
let lastSnapshotId = 0;
let lastPublishTimestamp = 0;
let latestSnapshot = null;
let pendingEvents = [];

const autoGraphicsConfig = {
  applyGraphicsMode: null,
  getActiveGraphicsMode: null,
  isLowGraphicsModeActive: null,
};

const autoGraphicsState = {
  active: false,
  originalMode: null,
  highLoadStreak: 0,
  lowLoadStreak: 0,
  lastActionTimestamp: null,
};

function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function accumulateDuration(map, label, duration) {
  if (!map || !label || !Number.isFinite(duration)) {
    return;
  }
  const previous = map.get(label) || 0;
  map.set(label, previous + duration);
}

function resetAutoGraphicsState() {
  autoGraphicsState.active = false;
  autoGraphicsState.originalMode = null;
  autoGraphicsState.highLoadStreak = 0;
  autoGraphicsState.lowLoadStreak = 0;
  autoGraphicsState.lastActionTimestamp = null;
}

function recordPerformanceEvent(message) {
  if (typeof message === 'string' && message.trim()) {
    pendingEvents.push(message.trim());
  }
}

function evaluateAutoGraphics(snapshot) {
  const applyGraphicsMode = autoGraphicsConfig.applyGraphicsMode;
  const isLowGraphicsModeActive = autoGraphicsConfig.isLowGraphicsModeActive;
  const getActiveGraphicsMode = autoGraphicsConfig.getActiveGraphicsMode;
  if (typeof applyGraphicsMode !== 'function' || typeof isLowGraphicsModeActive !== 'function') {
    return;
  }

  // If the player manually toggled graphics, clear any pending automation state.
  if (!autoGraphicsState.active && isLowGraphicsModeActive()) {
    autoGraphicsState.originalMode = null;
  }
  if (autoGraphicsState.active && !isLowGraphicsModeActive()) {
    resetAutoGraphicsState();
    return;
  }

  const averageFrameMs = snapshot?.averageFrameMs;
  if (!Number.isFinite(averageFrameMs)) {
    return;
  }

  const underHeavyLoad = averageFrameMs >= AUTO_LOW_THRESHOLD_MS;
  const comfortablyStable = averageFrameMs <= AUTO_RECOVERY_THRESHOLD_MS;

  if (underHeavyLoad) {
    autoGraphicsState.highLoadStreak += 1;
    autoGraphicsState.lowLoadStreak = 0;
  } else {
    autoGraphicsState.highLoadStreak = 0;
    autoGraphicsState.lowLoadStreak += 1;
  }

  if (
    !autoGraphicsState.active &&
    underHeavyLoad &&
    autoGraphicsState.highLoadStreak >= AUTO_LOW_STREAK &&
    !isLowGraphicsModeActive()
  ) {
    const priorMode = typeof getActiveGraphicsMode === 'function' ? getActiveGraphicsMode() : null;
    autoGraphicsState.originalMode = priorMode && priorMode !== 'low' ? priorMode : null;
    try {
      applyGraphicsMode('low', { persist: false });
      autoGraphicsState.active = true;
      autoGraphicsState.lastActionTimestamp = Date.now();
      recordPerformanceEvent('Auto-lowered graphics quality after sustained load.');
    } catch (error) {
      console.warn('Failed to apply automatic low-graphics mode.', error);
      resetAutoGraphicsState();
    }
    return;
  }

  if (
    autoGraphicsState.active &&
    comfortablyStable &&
    autoGraphicsState.lowLoadStreak >= AUTO_RECOVERY_STREAK
  ) {
    const targetMode = autoGraphicsState.originalMode || 'high';
    try {
      applyGraphicsMode(targetMode, { persist: false });
      recordPerformanceEvent('Graphics quality restored after stabilized performance.');
    } catch (error) {
      console.warn('Failed to restore graphics mode after stabilization.', error);
    }
    resetAutoGraphicsState();
  }
}

function computeSnapshot() {
  if (!frameBuffer.length) {
    return null;
  }
  const aggregate = {
    totalMs: 0,
    buckets: new Map(),
    towers: new Map(),
  };

  frameBuffer.forEach((frame) => {
    if (!frame) {
      return;
    }
    aggregate.totalMs += frame.totalMs || 0;
    frame.buckets?.forEach((value, label) => {
      accumulateDuration(aggregate.buckets, label, value);
    });
    frame.towers?.forEach((value, label) => {
      accumulateDuration(aggregate.towers, label, value);
    });
  });

  const totalMs = aggregate.totalMs || 0.0001;
  const averageFrameMs = aggregate.totalMs / frameBuffer.length;
  const fps = averageFrameMs > 0 ? 1000 / averageFrameMs : 0;

  const bucketEntries = Array.from(aggregate.buckets.entries()).map(([label, duration]) => ({
    label,
    percent: duration / totalMs,
    averageMs: duration / frameBuffer.length,
  }));
  bucketEntries.sort((a, b) => b.percent - a.percent);

  const towerEntries = Array.from(aggregate.towers.entries()).map(([label, duration]) => ({
    label,
    percent: duration / totalMs,
    averageMs: duration / frameBuffer.length,
  }));
  towerEntries.sort((a, b) => b.percent - a.percent);

  return {
    id: ++lastSnapshotId,
    timestamp: Date.now(),
    averageFrameMs,
    fps,
    buckets: bucketEntries,
    towers: towerEntries,
    autoGraphics: {
      active: autoGraphicsState.active,
      lastActionTimestamp: autoGraphicsState.lastActionTimestamp,
    },
  };
}

function publishSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  const nowTimestamp = Date.now();
  const shouldPublish =
    nowTimestamp - lastPublishTimestamp >= PUBLISH_INTERVAL_MS || pendingEvents.length > 0;
  latestSnapshot = snapshot;

  if (!shouldPublish) {
    return;
  }

  lastPublishTimestamp = nowTimestamp;
  const snapshotWithEvents = {
    ...snapshot,
    events: pendingEvents.length ? pendingEvents.slice() : [],
  };
  pendingEvents = [];

  performanceLog.push(snapshotWithEvents);
  while (performanceLog.length > MAX_LOG_ENTRIES) {
    performanceLog.shift();
  }

  snapshotSubscribers.forEach((handler) => {
    if (typeof handler === 'function') {
      try {
        handler(snapshotWithEvents);
      } catch (error) {
        console.error('Performance snapshot subscriber failed.', error);
      }
    }
  });
}

export function configurePerformanceMonitor(options = {}) {
  const { applyGraphicsMode, getActiveGraphicsMode, isLowGraphicsModeActive } = options;
  autoGraphicsConfig.applyGraphicsMode = typeof applyGraphicsMode === 'function' ? applyGraphicsMode : null;
  autoGraphicsConfig.getActiveGraphicsMode =
    typeof getActiveGraphicsMode === 'function' ? getActiveGraphicsMode : null;
  autoGraphicsConfig.isLowGraphicsModeActive =
    typeof isLowGraphicsModeActive === 'function' ? isLowGraphicsModeActive : null;
}

export function beginPerformanceFrame() {
  currentFrame = {
    startedAt: now(),
    buckets: new Map(),
    towers: new Map(),
    totalMs: 0,
  };
}

export function beginPerformanceSegment(label) {
  if (!currentFrame) {
    return () => {};
  }
  const start = now();
  return () => {
    if (!currentFrame) {
      return;
    }
    const duration = Math.max(0, now() - start);
    accumulateDuration(currentFrame.buckets, label, duration);
  };
}

export function beginTowerPerformanceSegment(towerType) {
  if (!currentFrame) {
    return () => {};
  }
  const normalized = typeof towerType === 'string' && towerType.trim() ? towerType.trim() : 'unknown';
  const start = now();
  return () => {
    if (!currentFrame) {
      return;
    }
    const duration = Math.max(0, now() - start);
    accumulateDuration(currentFrame.towers, normalized, duration);
    accumulateDuration(currentFrame.buckets, 'towers', duration);
  };
}

export function endPerformanceFrame() {
  if (!currentFrame) {
    return;
  }
  currentFrame.totalMs = Math.max(0, now() - currentFrame.startedAt);
  frameBuffer.push(currentFrame);
  while (frameBuffer.length > PERFORMANCE_WINDOW) {
    frameBuffer.shift();
  }
  const snapshot = computeSnapshot();
  currentFrame = null;
  if (!snapshot) {
    return;
  }
  evaluateAutoGraphics(snapshot);
  publishSnapshot(snapshot);
}

export function getPerformanceSnapshotLog() {
  return performanceLog.slice().reverse();
}

export function getLatestPerformanceSnapshot() {
  return latestSnapshot;
}

export function subscribeToPerformanceSnapshots(handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  snapshotSubscribers.add(handler);
  return () => {
    snapshotSubscribers.delete(handler);
  };
}
