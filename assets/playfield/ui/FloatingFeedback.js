// Floating feedback system for displaying gem collection notifications
// Shows "+N (gem icon)" messages that fade in, move upward, and fade out

import { getGemSpriteImage } from '../../enemies.js';

// Animation configuration
const FLOAT_DURATION_MS = 1500; // Total duration of floating animation
const FLOAT_DISTANCE_PX = 80; // Distance to move upward in pixels
const FADE_IN_DURATION_MS = 200; // Time to fade in
const FADE_OUT_START_MS = 1100; // When to start fading out
const STACK_OFFSET_MS = 400; // Time offset between stacked messages
const STACK_SPACING_PX = 35; // Vertical spacing between stacked messages

/**
 * Create a floating feedback controller for gem collection notifications
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas - The playfield canvas
 * @param {CanvasRenderingContext2D} options.ctx - The canvas context
 * @param {Function} options.getCanvasPosition - Function to convert world coords to canvas coords
 * @returns {Object} Controller with show and update methods
 */
export function createFloatingFeedbackController({ canvas, ctx, getCanvasPosition } = {}) {
  if (!canvas || !ctx || typeof getCanvasPosition !== 'function') {
    return null;
  }

  const activeMessages = [];
  let nextId = 1;

  /**
   * Show a floating feedback message for gem collection
   * @param {Object} options
   * @param {number} options.x - World X coordinate
   * @param {number} options.y - World Y coordinate
   * @param {Array} options.gems - Array of {count, typeKey, typeName, color} objects
   */
  function show({ x, y, gems = [] } = {}) {
    if (!gems || gems.length === 0) {
      return;
    }

    const position = getCanvasPosition({ x, y });
    if (!position) {
      return;
    }

    // Create stacked messages for each gem type
    gems.forEach((gem, index) => {
      if (!gem || !gem.count || gem.count <= 0) {
        return;
      }

      activeMessages.push({
        id: nextId++,
        x: position.x,
        y: position.y,
        count: gem.count,
        typeKey: gem.typeKey,
        typeName: gem.typeName || gem.typeKey,
        color: gem.color || { hue: 48, saturation: 68, lightness: 56 },
        startTime: Date.now() + (index * STACK_OFFSET_MS),
        stackIndex: index,
      });
    });
  }

  /**
   * Update and render all active floating messages
   * @param {number} now - Current timestamp
   */
  function update(now) {
    if (activeMessages.length === 0) {
      return;
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Update and render each message
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const message = activeMessages[i];
      const elapsed = now - message.startTime;

      // Remove expired messages
      if (elapsed >= FLOAT_DURATION_MS) {
        activeMessages.splice(i, 1);
        continue;
      }

      // Skip messages that haven't started yet
      if (elapsed < 0) {
        continue;
      }

      // Calculate animation progress
      const progress = elapsed / FLOAT_DURATION_MS;
      const yOffset = progress * FLOAT_DISTANCE_PX;
      const stackOffset = message.stackIndex * STACK_SPACING_PX;

      // Calculate opacity with fade in and fade out
      let opacity = 1;
      if (elapsed < FADE_IN_DURATION_MS) {
        opacity = elapsed / FADE_IN_DURATION_MS;
      } else if (elapsed > FADE_OUT_START_MS) {
        const fadeOutElapsed = elapsed - FADE_OUT_START_MS;
        const fadeOutDuration = FLOAT_DURATION_MS - FADE_OUT_START_MS;
        opacity = 1 - (fadeOutElapsed / fadeOutDuration);
      }

      // Calculate current position
      const currentY = message.y - yOffset - stackOffset;

      // Draw the message
      drawMessage(message, message.x, currentY, opacity);
    }

    ctx.restore();
  }

  /**
   * Draw a single floating message
   * @param {Object} message - Message data
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   * @param {number} opacity - Opacity (0-1)
   */
  function drawMessage(message, x, y, opacity) {
    const fontSize = 18;
    const iconSize = 20;
    const spacing = 6;

    // Get gem sprite if available
    const sprite = getGemSpriteImage(message.typeKey);

    // Calculate text metrics
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    const text = `+${message.count}`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Calculate total width (text + spacing + icon)
    const totalWidth = textWidth + spacing + iconSize;
    const startX = x - totalWidth / 2;

    // Draw drop shadow for better visibility
    ctx.globalAlpha = opacity * 0.4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, startX + textWidth / 2 + 2, y + 2);

    // Draw text
    ctx.globalAlpha = opacity;
    const hue = message.color?.hue ?? 48;
    const saturation = message.color?.saturation ?? 68;
    const lightness = message.color?.lightness ?? 56;
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${Math.min(95, lightness + 30)}%)`;
    ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${Math.max(20, lightness - 20)}%)`;
    ctx.lineWidth = 3;
    ctx.strokeText(text, startX + textWidth / 2, y);
    ctx.fillText(text, startX + textWidth / 2, y);

    // Draw gem icon
    const iconX = startX + textWidth + spacing;
    const iconY = y;

    ctx.globalAlpha = opacity;
    if (sprite && sprite.complete) {
      ctx.drawImage(
        sprite,
        iconX - iconSize / 2,
        iconY - iconSize / 2,
        iconSize,
        iconSize
      );
    } else {
      // Fallback: draw a diamond shape
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${Math.max(20, lightness - 20)}%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - iconSize / 2);
      ctx.lineTo(iconX + iconSize / 2, iconY);
      ctx.lineTo(iconX, iconY + iconSize / 2);
      ctx.lineTo(iconX - iconSize / 2, iconY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Clear all active messages
   */
  function clear() {
    activeMessages.length = 0;
  }

  return {
    show,
    update,
    clear,
  };
}
