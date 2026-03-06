// Mote gem system extracted from SimplePlayfield for modular gem flight and collection logic.
// Handles the per-frame physics update for airborne mote gem drops.

import {
  moteGemState,
  collectMoteGemDrop,
  updateGemSuctionAnimations,
} from '../../enemies.js';
import { metersToPixels } from '../../gameUnits.js';

/**
 * Advance mote gem flight each frame — applies velocity, gravity, fade, and directed
 * launch ballistics, then collects gems that have gone offscreen or expired.
 */
export function updateMoteGems(delta) {
  if (!moteGemState.active.length || !Number.isFinite(delta)) {
    return;
  }

  // Update gem suction animations and collect completed gems
  const collectedGems = updateGemSuctionAnimations(delta);
  
  // Show floating feedback for collected gems
  if (collectedGems.length > 0 && this.floatingFeedback) {
    // Group by collection point and show feedback
    const byTarget = new Map();
    collectedGems.forEach((gem) => {
      const key = `${gem.targetX},${gem.targetY}`;
      if (!byTarget.has(key)) {
        byTarget.set(key, {
          x: gem.targetX,
          y: gem.targetY,
          gems: [],
        });
      }
      byTarget.get(key).gems.push(gem);
    });

    byTarget.forEach((group) => {
      this.floatingFeedback.show({
        x: group.x,
        y: group.y,
        gems: group.gems,
      });
    });
  }

  const step = Math.max(0, delta);
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const minDimension =
    width > 0 && height > 0
      ? Math.max(1, Math.min(width, height))
      : Math.max(1, Math.max(width, height)); // Resolve the active scale so launch distances measured in meters stay accurate after resizes.
  const toCollect = [];

  moteGemState.active.forEach((gem) => {
    // Skip gems that are being sucked toward a target
    if (gem.suction && gem.suction.active) {
      return;
    }

    if (!Number.isFinite(gem.pulse)) {
      gem.pulse = 0;
    }
    gem.pulse += step * 2.4;

    if (!Number.isFinite(gem.lifetime)) {
      gem.lifetime = 0;
    }
    gem.lifetime += step;

    const dt = step;
    if (!Number.isFinite(gem.vx)) {
      gem.vx = (Math.random() - 0.5) * 0.08; // Provide a gentle horizontal drift for legacy gems.
    }
    if (!Number.isFinite(gem.vy)) {
      gem.vy = -0.22; // Default to an upward launch if legacy data is missing.
    }
    const gravity = Number.isFinite(gem.gravity) ? gem.gravity : 0.00045;
    gem.vy += gravity * dt;
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;

    const fadeStart = 720;
    const fadeDuration = 420;
    if (!Number.isFinite(gem.opacity)) {
      gem.opacity = 1;
    }
    if (gem.lifetime > fadeStart) {
      const fadeProgress = Math.min(1, (gem.lifetime - fadeStart) / Math.max(120, fadeDuration));
      gem.opacity = Math.max(0, 1 - fadeProgress);
    }

    const invisible = gem.opacity <= 0.01;

    const launchData = gem.launch;
    const hasDirectedLaunch =
      launchData &&
      Number.isFinite(launchData.distanceMeters) &&
      Number.isFinite(launchData.angle); // Confirm that the gem originated from the new fling system before applying the ballistic override.
    if (hasDirectedLaunch) {
      const travelDistance = metersToPixels(launchData.distanceMeters, minDimension); // Translate the stored travel distance into on-screen pixels each frame.
      launchData.elapsed = (launchData.elapsed || 0) + step;
      const duration = Number.isFinite(launchData.duration) ? Math.max(1, launchData.duration) : 600;
      const progress = Math.min(1, launchData.elapsed / duration); // Convert the elapsed travel time into a normalized flight progress value.
      const directionX = Math.cos(launchData.angle);
      const directionY = Math.sin(launchData.angle);
      const displacement = travelDistance * progress;
      const originX = Number.isFinite(launchData.startX) ? launchData.startX : gem.x;
      const originY = Number.isFinite(launchData.startY) ? launchData.startY : gem.y;
      gem.x = originX + directionX * displacement;
      gem.y = originY + directionY * displacement;

      const offscreenX = width ? gem.x < -64 || gem.x > width + 64 : false;
      const offscreenY = height ? gem.y < -96 || gem.y > height + 96 : gem.y < -96;
      const travelComplete = progress >= 1;
      if (offscreenX || offscreenY || travelComplete || invisible) {
        toCollect.push(gem);
      }
      return;
    }

    const offscreenX = width ? gem.x < -64 || gem.x > width + 64 : false;
    const offscreenY = gem.y < -96 || (height ? gem.y > height + 96 : false);
    const lifetimeExpired = gem.lifetime > 1400;
    if (offscreenX || offscreenY || lifetimeExpired || invisible) {
      toCollect.push(gem);
    }
  });

  if (toCollect.length) {
    toCollect.forEach((gem) => {
      collectMoteGemDrop(gem, { reason: 'flight' });
    });
  }
}
