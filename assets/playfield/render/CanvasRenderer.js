import { ALPHA_BASE_RADIUS_FACTOR } from '../../gameUnits.js';
import { getTowerVisualConfig, samplePaletteGradient } from '../../colorSchemeUtils.js';
import { getTowerDefinition } from '../../towersTab.js';
import { moteGemState, getGemSpriteImage } from '../../enemies.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../scripts/features/towers/powderTower.js';
import {
  drawAlphaBursts as drawAlphaBurstsHelper,
} from '../../../scripts/features/towers/alphaTower.js';
import { drawBetaBursts as drawBetaBurstsHelper } from '../../../scripts/features/towers/betaTower.js';
import { drawGammaBursts as drawGammaBurstsHelper } from '../../../scripts/features/towers/gammaTower.js';
import { drawKappaTripwires as drawKappaTripwiresHelper } from '../../../scripts/features/towers/kappaTower.js';
import { drawLambdaLasers as drawLambdaLasersHelper } from '../../../scripts/features/towers/lambdaTower.js';
import { drawMuMines as drawMuMinesHelper } from '../../../scripts/features/towers/muTower.js';
import { drawZetaPendulums as drawZetaPendulumsHelper } from '../../../scripts/features/towers/zetaTower.js';
import { drawEtaOrbits as drawEtaOrbitsHelper } from '../../../scripts/features/towers/etaTower.js';
import { drawDeltaSoldiers as drawDeltaSoldiersHelper } from '../../../scripts/features/towers/deltaTower.js';
import { drawThetaContours as drawThetaContoursHelper } from '../../../scripts/features/towers/thetaTower.js';

import { normalizeProjectileColor, drawConnectionMoteGlow } from '../utils/rendering.js';

const MIND_GATE_SPRITE_URL = 'assets/images/tower-mind-gate.svg';
const mindGateSprite = new Image();
mindGateSprite.src = MIND_GATE_SPRITE_URL;
mindGateSprite.decoding = 'async';
mindGateSprite.loading = 'eager';

const ENEMY_GATE_SPRITE_URL = 'assets/images/enemy-gate.svg';
const enemyGateSprite = new Image();
enemyGateSprite.src = ENEMY_GATE_SPRITE_URL;
enemyGateSprite.decoding = 'async';
enemyGateSprite.loading = 'eager';

const GEM_MOTE_BASE_RATIO = 0.02;

function applyCanvasShadow(ctx, color, blur) {
  if (!ctx) {
    return;
  }
  if (this.isLowGraphicsMode()) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = 0;
    return;
  }
  ctx.shadowColor = color || 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = Number.isFinite(blur) ? blur : 0;
}

function clearCanvasShadow(ctx) {
  if (!ctx) {
    return;
  }
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
}

function drawTowerConnectionParticles(ctx, tower, bodyRadius) {
  if (!ctx || !tower) {
    return;
  }
  const particles = Array.isArray(tower.connectionParticles) ? tower.connectionParticles : [];
  if (!particles.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((particle) => {
    if (!particle || particle.state === 'done') {
      return;
    }
    const baseColor = particle.type === 'beta'
      ? { r: 255, g: 214, b: 112 }
      : { r: 255, g: 138, b: 216 };
    const color = normalizeProjectileColor(baseColor, 1);
    const size = particle.size || 2.6;
    let position = null;
    if (particle.state === 'launch' || particle.state === 'arrive') {
      position = particle.position || this.resolveConnectionOrbitAnchor(tower, particle);
    } else {
      position = this.resolveConnectionOrbitPosition(tower, particle, bodyRadius);
    }
    if (!position) {
      return;
    }
    drawConnectionMoteGlow(
      ctx,
      position.x,
      position.y,
      size,
      color,
      particle.state === 'launch' ? 0.9 : 0.85,
    );
  });
  ctx.restore();
}

function drawConnectionEffects(ctx) {
  if (!ctx || !Array.isArray(this.connectionEffects) || !this.connectionEffects.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  this.connectionEffects.forEach((effect) => {
    const source = effect.source || this.getTowerById(effect.sourceId);
    const target = effect.target || this.getTowerById(effect.targetId);
    if (!source || !target) {
      return;
    }
    const baseColor = source.type === 'beta'
      ? { r: 255, g: 214, b: 112 }
      : { r: 255, g: 138, b: 216 };
    const color = normalizeProjectileColor(baseColor, 1);
    effect.particles.forEach((particle) => {
      const progress = Math.max(0, Math.min(1, particle.progress || 0));
      const x = source.x + (target.x - source.x) * progress;
      const y = source.y + (target.y - source.y) * progress;
      drawConnectionMoteGlow(ctx, x, y, 3.2, color, 0.7);
    });
  });
  ctx.restore();
}

function draw() {
  if (!this.ctx) {
    return;
  }
  const ctx = this.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const viewCenter = this.getViewCenter();
  ctx.translate(width / 2, height / 2);
  ctx.scale(this.viewScale, this.viewScale);
  ctx.translate(-viewCenter.x, -viewCenter.y);

  this.drawFloaters();
  this.drawPath();
  this.drawDeltaCommandPreview();
  this.drawMoteGems();
  this.drawArcLight();
  this.drawDeveloperCrystals();
  this.drawNodes();
  this.drawDeveloperPathMarkers();
  this.drawPlacementPreview();
  this.drawTowers();
  this.drawDeltaSoldiers();
  this.drawEnemies();
  this.drawProjectiles();
  this.drawTowerMenu();
  this.updateEnemyTooltipPosition();
}

function drawFloaters() {
  if (!this.ctx || !this.floaters.length || !this.levelConfig) {
    return;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }
  const minDimension = Math.min(width, height) || 1;
  const connectionWidth = Math.max(0.6, minDimension * 0.0014);

  const ctx = this.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  this.floaterConnections.forEach((connection) => {
    const from = this.floaters[connection.from];
    const to = this.floaters[connection.to];
    if (!from || !to) {
      return;
    }
    const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
    if (alpha <= 0) {
      return;
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = connectionWidth;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  this.floaters.forEach((floater) => {
    const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
    if (opacity <= 0) {
      return;
    }
    let radiusFactor = Number.isFinite(floater.radiusFactor)
      ? floater.radiusFactor
      : null;
    if (!radiusFactor) {
      radiusFactor = this.randomFloaterRadiusFactor();
      floater.radiusFactor = radiusFactor;
    }
    const radius = Math.max(2, radiusFactor * minDimension);
    const strokeWidth = Math.max(0.8, radius * 0.22);
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
    ctx.arc(floater.x, floater.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawMoteGems() {
  if (!this.ctx || !moteGemState.active.length) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const dimensionCandidates = [];
  if (Number.isFinite(width) && width > 0) {
    dimensionCandidates.push(width);
  }
  if (Number.isFinite(height) && height > 0) {
    dimensionCandidates.push(height);
  }
  const minDimension = Math.max(
    1,
    dimensionCandidates.length ? Math.min(...dimensionCandidates) : 320,
  );
  const moteUnit = Math.max(6, minDimension * GEM_MOTE_BASE_RATIO);
  const pulseMagnitude = moteUnit * 0.35;

  moteGemState.active.forEach((gem) => {
    const hue = gem.color?.hue ?? 48;
    const saturation = gem.color?.saturation ?? 68;
    const lightness = gem.color?.lightness ?? 56;
    const moteSize = Number.isFinite(gem.moteSize) ? Math.max(1, gem.moteSize) : Math.max(1, gem.value);
    const size = moteSize * moteUnit;
    const pulse = Math.sin((gem.pulse || 0) * 0.6) * pulseMagnitude;
    const rotation = Math.sin((gem.pulse || 0) * 0.35) * 0.45;
    const opacity = Number.isFinite(gem.opacity) ? Math.max(0, Math.min(1, gem.opacity)) : 1;
    const alphaFill = Math.max(0, Math.min(0.9, 0.6 + opacity * 0.3));
    const alphaStroke = Math.max(0, Math.min(0.9, 0.5 + opacity * 0.35));
    const fill = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alphaFill})`;
    const stroke = `hsla(${hue}, ${Math.max(24, saturation - 18)}%, ${Math.max(18, lightness - 28)}%, ${alphaStroke})`;
    const sparkle = `hsla(${hue}, ${Math.max(34, saturation - 22)}%, 92%, ${Math.max(0, opacity * 0.65)})`;
    const sprite = getGemSpriteImage(gem.typeKey);

    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(rotation);
    if (sprite) {
      const baseSize = Math.max(moteUnit * 0.6, size + pulse);
      const reference = Math.max(1, Math.max(sprite.width || 1, sprite.height || 1));
      const renderSize = baseSize;
      const scale = renderSize / reference;
      const spriteWidth = (sprite.width || reference) * scale;
      const spriteHeight = (sprite.height || reference) * scale;
      ctx.globalAlpha = opacity;
      ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    } else {
      const squareSize = Math.max(moteUnit * 0.6, size + pulse);
      const half = squareSize / 2;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(moteUnit * 0.12, 1.2);
      ctx.beginPath();
      ctx.rect(-half, -half, squareSize, squareSize);
      ctx.fill();
      ctx.stroke();

      const sparkleSize = Math.max(moteUnit * 0.3, squareSize * 0.38);
      ctx.fillStyle = sparkle;
      ctx.fillRect(-sparkleSize * 0.5, -sparkleSize * 0.8, sparkleSize, sparkleSize);
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawPath() {
  if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
    return;
  }
  const ctx = this.ctx;
  const points = this.pathPoints;
  const start = points[0];
  const end = points[points.length - 1];

  const baseGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  baseGradient.addColorStop(0, 'rgba(88, 160, 255, 0.5)');
  baseGradient.addColorStop(0.48, 'rgba(162, 110, 255, 0.48)');
  baseGradient.addColorStop(1, 'rgba(255, 158, 88, 0.5)');

  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  this.applyCanvasShadow(ctx, 'rgba(88, 160, 255, 0.2)', 12);
  ctx.moveTo(start.x, start.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = baseGradient;
  ctx.stroke();
  ctx.restore();

  const highlightGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  highlightGradient.addColorStop(0, 'rgba(88, 160, 255, 0.12)');
  highlightGradient.addColorStop(0.52, 'rgba(162, 110, 255, 0.1)');
  highlightGradient.addColorStop(1, 'rgba(255, 158, 88, 0.14)');

  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.moveTo(start.x, start.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = highlightGradient;
  ctx.stroke();
  ctx.restore();
}

function drawArcLight() {
  if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 180, 105, 0.7)';
  ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.18]);
  ctx.lineDashOffset = this.arcOffset;
  ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
  for (let index = 1; index < this.pathPoints.length; index += 1) {
    const point = this.pathPoints[index];
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDeltaCommandPreview() {
  if (!this.ctx) {
    return;
  }
  const dragState = this.deltaCommandDragState;
  if (!dragState || !dragState.pointerId || !dragState.active) {
    return;
  }
  const tower = this.getTowerById(dragState.towerId);
  if (!tower) {
    return;
  }

  const ctx = this.ctx;
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const anchorRadius = Math.max(22, minDimension * 0.06);
  const target = dragState.trackAnchor?.point || dragState.currentPosition;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (target) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = dragState.trackAnchor
      ? 'rgba(139, 247, 255, 0.68)'
      : 'rgba(139, 247, 255, 0.38)';
    ctx.lineWidth = Math.max(1.6, anchorRadius * 0.1);
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (dragState.trackAnchor?.point) {
    const anchor = dragState.trackAnchor.point;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(139, 247, 255, 0.16)';
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
    ctx.lineWidth = Math.max(2.4, anchorRadius * 0.14);
    ctx.arc(anchor.x, anchor.y, anchorRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (target) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.42)';
    ctx.lineWidth = Math.max(1.2, anchorRadius * 0.08);
    ctx.setLineDash([4, 4]);
    ctx.arc(target.x, target.y, anchorRadius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawEnemyGateSymbol(ctx, position) {
  if (!ctx || !position) {
    return;
  }

  const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = dimension ? dimension * 0.028 : 0;
  const baseSize = Math.max(12, Math.min(20, baseRadius || 16));
  const radius = baseSize * 2;

  ctx.save();
  ctx.translate(position.x, position.y);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.2);
  glow.addColorStop(0, 'rgba(74, 240, 255, 0.42)');
  glow.addColorStop(1, 'rgba(15, 27, 63, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
  ctx.fill();

  const spriteReady = enemyGateSprite?.complete && enemyGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2, 40) * 2;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(enemyGateSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    ctx.restore();
  } else {
    this.applyCanvasShadow(ctx, 'rgba(74, 240, 255, 0.6)', radius * 0.6);
    ctx.strokeStyle = 'rgba(202, 245, 255, 0.8)';
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, -radius * 0.1);
    ctx.quadraticCurveTo(0, -radius * 0.8, radius * 0.72, -radius * 0.1);
    ctx.quadraticCurveTo(0, radius * 0.6, -radius * 0.72, -radius * 0.1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMindGateSymbol(ctx, position) {
  if (!ctx || !position) {
    return;
  }

  const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = dimension ? dimension * 0.035 : 0;
  const baseSize = Math.max(14, Math.min(24, baseRadius || 18));
  const radius = baseSize * 2;

  ctx.save();
  ctx.translate(position.x, position.y);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.22, 0, 0, radius);
  glow.addColorStop(0, 'rgba(255, 248, 220, 0.9)');
  glow.addColorStop(0.55, 'rgba(255, 196, 150, 0.35)');
  glow.addColorStop(1, 'rgba(139, 247, 255, 0.18)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius);
  ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  const spriteReady = mindGateSprite?.complete && mindGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2.1, 46) * 2;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(mindGateSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    ctx.restore();
  } else {
    this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.55)', radius * 0.7);
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
    ctx.lineWidth = Math.max(1.4, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.64);
    ctx.lineTo(0, -radius * 0.6);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 228, 120, 0.92)';
    this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius * 0.8);
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    ctx.beginPath();
    const gateWidth = radius * 0.58;
    const gateBase = radius * 0.62;
    ctx.moveTo(-gateWidth, gateBase);
    ctx.lineTo(-gateWidth, -radius * 0.18);
    ctx.quadraticCurveTo(0, -radius * 0.95, gateWidth, -radius * 0.18);
    ctx.lineTo(gateWidth, gateBase);
    ctx.stroke();
  }

  const gateIntegrity = Math.max(0, Math.floor(this.lives || 0));
  const maxIntegrity = Math.max(
    gateIntegrity,
    Math.floor(this.levelConfig?.lives || gateIntegrity || 1),
  );
  const gateExponentSource = gateIntegrity > 0 ? gateIntegrity : maxIntegrity || 1;
  const gateExponent = this.calculateHealthExponent(gateExponentSource);
  const palette =
    typeof this.getEffectiveMotePalette === 'function'
      ? this.getEffectiveMotePalette()
      : null;
  const paletteStops = resolvePaletteColorStops(palette);
  const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
  if (Array.isArray(paletteStops) && paletteStops.length) {
    const denominator = Math.max(1, paletteStops.length - 1);
    paletteStops.forEach((stop, index) => {
      const offset = Math.max(0, Math.min(1, index / denominator));
      gradient.addColorStop(offset, colorToRgbaString(stop, 1));
    });
  }
  ctx.font = `${Math.round(Math.max(14, radius * 0.82))}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = gradient;
  const highlightColor = paletteStops[paletteStops.length - 1] || paletteStops[0];
  this.applyCanvasShadow(ctx, colorToRgbaString(highlightColor, 0.85), Math.max(14, radius * 0.95));
  const exponentOffset = radius * 0.78;
  const exponentX = exponentOffset;
  const exponentY = -exponentOffset * 0.88;
  ctx.fillText(gateExponent.toFixed(1), exponentX, exponentY);

  ctx.restore();
}

function drawNodes() {
  if (!this.ctx || !this.pathSegments.length) {
    return;
  }
  const ctx = this.ctx;
  const startPoint = this.pathPoints.length ? this.pathPoints[0] : this.pathSegments[0].start;
  const endPoint = this.pathPoints.length
    ? this.pathPoints[this.pathPoints.length - 1]
    : this.pathSegments[this.pathSegments.length - 1].end;
  this.drawEnemyGateSymbol(ctx, startPoint);
  this.drawMindGateSymbol(ctx, endPoint);
}

function drawDeveloperPathMarkers() {
  if (!this.ctx || !Array.isArray(this.developerPathMarkers) || !this.developerPathMarkers.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.font = '12px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  this.developerPathMarkers.forEach((marker, index) => {
    const radius = marker.active ? 12 : 10;
    ctx.beginPath();
    ctx.fillStyle = marker.active ? 'rgba(18, 26, 44, 0.9)' : 'rgba(12, 16, 28, 0.82)';
    ctx.strokeStyle = marker.active
      ? 'rgba(139, 247, 255, 0.9)'
      : 'rgba(139, 247, 255, 0.55)';
    ctx.lineWidth = marker.active ? 2 : 1.5;
    if (marker.active) {
      this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.3)', 16);
    } else {
      this.clearCanvasShadow(ctx);
    }
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const label = marker.label !== undefined && marker.label !== null ? marker.label : index + 1;
    if (label !== undefined && label !== null) {
      ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.fillText(String(label), marker.x, marker.y);
    }
  });

  ctx.restore();
}

function drawDeveloperCrystals() {
  if (!this.ctx) {
    return;
  }
  const ctx = this.ctx;
  if (this.developerCrystals.length) {
    ctx.save();
    this.developerCrystals.forEach((crystal) => {
      if (!crystal) {
        return;
      }
      const position = this.getCrystalPosition(crystal);
      const radius = this.getCrystalRadius(crystal);
      if (!position || radius <= 0) {
        return;
      }
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(crystal.orientation || 0);
      const outline = Array.isArray(crystal.outline) && crystal.outline.length
        ? crystal.outline
        : [1, 1, 1, 1, 1, 1];
      ctx.beginPath();
      outline.forEach((scale, index) => {
        const ratio = index / outline.length;
        const angle = ratio * Math.PI * 2;
        const radial = radius * (0.72 + scale * 0.28);
        const x = Math.cos(angle) * radial;
        const y = Math.sin(angle) * radial;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      const baseColor = samplePaletteGradient(crystal.paletteRatio ?? 0.5) || { r: 160, g: 220, b: 255 };
      const highlightColor = samplePaletteGradient(Math.min(1, (crystal.paletteRatio ?? 0.5) + 0.18)) || baseColor;
      const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
      gradient.addColorStop(0, colorToRgbaString(baseColor, 0.88));
      gradient.addColorStop(1, colorToRgbaString(highlightColor, 0.82));
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineWidth = Math.max(2, radius * 0.08);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
      if (Array.isArray(crystal.fractures)) {
        crystal.fractures.forEach((fracture) => {
          if (!fracture) {
            return;
          }
          const width = Number.isFinite(fracture.width) ? fracture.width : 0.6;
          const depth = Number.isFinite(fracture.depth) ? fracture.depth : 0.4;
          const progress = Number.isFinite(fracture.progress) ? fracture.progress : 0;
          const jagged = Array.isArray(fracture.jagged) && fracture.jagged.length
            ? fracture.jagged
            : [1, 0.7, 0.85, 0.7, 1];
          const segments = Math.max(3, jagged.length - 1);
          const outerRadius = radius * 0.98;
          ctx.save();
          const anchor = Number.isFinite(fracture.angle) ? fracture.angle : 0;
          ctx.rotate(anchor);
          ctx.beginPath();
          for (let index = 0; index <= segments; index += 1) {
            const t = index / segments;
            const angle = (t - 0.5) * width;
            const x = Math.cos(angle) * outerRadius;
            const y = Math.sin(angle) * outerRadius;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          for (let index = segments; index >= 0; index -= 1) {
            const t = index / segments;
            const angle = (t - 0.5) * width;
            const jaggedScale = jagged[index] ?? 1;
            const inset = Math.min(0.9, depth * progress * jaggedScale);
            const radial = outerRadius * (1 - inset);
            const x = Math.cos(angle) * radial;
            const y = Math.sin(angle) * radial;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(8, 12, 24, 0.9)';
          ctx.fill();
          ctx.restore();
        });
      }
      if (this.focusedCrystalId === crystal.id) {
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  if (this.crystalShards.length) {
    ctx.save();
    this.crystalShards.forEach((shard) => {
      if (!shard) {
        return;
      }
      const lifeRatio = shard.maxLife ? Math.max(0, 1 - shard.life / shard.maxLife) : 1;
      const shardColor = colorToRgbaString(shard.color || { r: 188, g: 236, b: 255 }, lifeRatio);
      ctx.save();
      ctx.translate(shard.x || 0, shard.y || 0);
      ctx.rotate(shard.rotation || 0);
      ctx.fillStyle = shardColor;
      const size = Math.max(2, shard.size || 5);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.4);
      ctx.lineTo(size * 0.6, 0);
      ctx.lineTo(0, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
}

function drawPlacementPreview() {
  if (!this.ctx || !this.hoverPlacement || !this.hoverPlacement.position) {
    return;
  }

  const ctx = this.ctx;
  const {
    position,
    range,
    valid,
    merge,
    mergeTarget,
    symbol,
    reason,
    dragging,
    towerType,
    definition,
    tier,
  } = this.hoverPlacement;

  ctx.save();

  const radius = Number.isFinite(range) && range > 0
    ? range
    : Math.min(this.renderWidth, this.renderHeight) * 0.18;
  const fillColor = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(255, 112, 112, 0.16)';
  const strokeColor = valid ? 'rgba(139, 247, 255, 0.85)' : 'rgba(255, 96, 96, 0.9)';

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = valid ? 2 : 3;
  ctx.arc(position.x, position.y, Math.max(12, radius), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (merge && mergeTarget) {
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 236, 128, 0.85)';
    ctx.beginPath();
    ctx.arc(mergeTarget.x, mergeTarget.y, Math.max(16, (radius || 24) * 0.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const previewDefinition = definition || getTowerDefinition(towerType);
  const previewTower = {
    type: towerType,
    definition: previewDefinition || undefined,
    tier: Number.isFinite(tier) ? tier : previewDefinition?.tier,
    symbol,
  };
  const visuals = getTowerVisualConfig(previewTower) || {};
  const bodyRadius = Math.max(
    12,
    Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR,
  );
  const bodyStroke = valid
    ? visuals.outerStroke || 'rgba(139, 247, 255, 0.85)'
    : 'rgba(255, 96, 96, 0.85)';
  const bodyFill = valid
    ? visuals.innerFill || 'rgba(12, 16, 28, 0.9)'
    : 'rgba(60, 16, 16, 0.88)';
  const symbolFill = valid
    ? visuals.symbolFill || 'rgba(255, 228, 120, 0.85)'
    : 'rgba(255, 200, 200, 0.92)';

  ctx.save();
  if (valid && visuals.outerShadow?.color) {
    this.applyCanvasShadow(
      ctx,
      visuals.outerShadow.color,
      Number.isFinite(visuals.outerShadow.blur) ? visuals.outerShadow.blur : 18,
    );
  } else {
    this.clearCanvasShadow(ctx);
  }
  ctx.beginPath();
  ctx.fillStyle = bodyFill;
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = valid ? 2.4 : 2.6;
  ctx.arc(position.x, position.y, bodyRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  if (valid && visuals.symbolShadow?.color) {
    this.applyCanvasShadow(
      ctx,
      visuals.symbolShadow.color,
      Number.isFinite(visuals.symbolShadow.blur) ? visuals.symbolShadow.blur : 18,
    );
  } else {
    this.clearCanvasShadow(ctx);
  }
  const glyph = symbol || '?';
  ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = symbolFill;
  ctx.fillText(glyph, position.x, position.y);
  ctx.restore();

  if (dragging) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.4)';
    ctx.beginPath();
    const anchorRadius = Math.max(bodyRadius * 1.15, bodyRadius + 4, 16);
    ctx.arc(position.x, position.y, anchorRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (this.messageEl && reason) {
    this.messageEl.textContent = reason;
  }
}

function drawTowers() {
  if (!this.ctx || !this.towers.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  this.drawConnectionEffects(ctx);

  const activeDrag = this.connectionDragState.active ? this.connectionDragState : null;
  const highlightEntries = activeDrag && Array.isArray(activeDrag.highlightEntries)
    ? activeDrag.highlightEntries
    : [];
  const highlightMap = new Map();
  highlightEntries.forEach((entry) => {
    if (!highlightMap.has(entry.towerId)) {
      highlightMap.set(entry.towerId, entry);
    }
  });
  const hoveredHighlight = activeDrag ? activeDrag.hoverEntry : null;

  this.towers.forEach((tower) => {
    if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return;
    }

    const visuals = getTowerVisualConfig(tower) || {};
    const rangeRadius = Number.isFinite(tower.range)
      ? tower.range
      : Math.min(this.renderWidth, this.renderHeight) * 0.22;
    const bodyRadius = Math.max(
      12,
      Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR,
    );

    const highlightEntry = highlightMap.get(tower.id) || null;
    if (highlightEntry) {
      ctx.save();
      const isHovered = hoveredHighlight && hoveredHighlight.towerId === tower.id;
      const strokeColor = highlightEntry.action === 'connect'
        ? isHovered
          ? 'rgba(139, 247, 255, 0.85)'
          : 'rgba(139, 247, 255, 0.45)'
        : isHovered
        ? 'rgba(255, 214, 112, 0.85)'
        : 'rgba(255, 214, 112, 0.45)';
      ctx.lineWidth = isHovered ? 3.2 : 2;
      ctx.strokeStyle = strokeColor;
      ctx.setLineDash([isHovered ? 6 : 4, isHovered ? 6 : 8]);
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (Number.isFinite(rangeRadius) && rangeRadius > 0) {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = visuals.rangeStroke || 'rgba(139, 247, 255, 0.2)';
      ctx.setLineDash([8, 6]);
      ctx.arc(tower.x, tower.y, rangeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (tower.type === 'theta') {
      drawThetaContoursHelper(this, tower);
    }

    if (tower.type === 'zeta') {
      this.drawZetaPendulums(tower);
    }
    if (tower.type === 'eta') {
      this.drawEtaOrbits(tower);
    }
    if (tower.type === 'kappa') {
      drawKappaTripwiresHelper(this, tower);
    }
    if (tower.type === 'lambda') {
      drawLambdaLasersHelper(this, tower);
    }
    if (tower.type === 'mu') {
      drawMuMinesHelper(this, tower);
    }

    ctx.save();
    const outerShadow = visuals.outerShadow;
    if (outerShadow?.color) {
      this.applyCanvasShadow(
        ctx,
        outerShadow.color,
        Number.isFinite(outerShadow.blur) ? outerShadow.blur : 18,
      );
    } else {
      this.clearCanvasShadow(ctx);
    }

    ctx.beginPath();
    ctx.fillStyle = visuals.innerFill || 'rgba(12, 16, 28, 0.9)';
    ctx.strokeStyle = visuals.outerStroke || 'rgba(139, 247, 255, 0.75)';
    ctx.lineWidth = 2.4;
    ctx.arc(tower.x, tower.y, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    this.drawTowerConnectionParticles(ctx, tower, bodyRadius);

    const symbolColor = visuals.symbolFill || 'rgba(255, 228, 120, 0.92)';
    const symbolShadow = visuals.symbolShadow;
    if (symbolShadow?.color) {
      this.applyCanvasShadow(
        ctx,
        symbolShadow.color,
        Number.isFinite(symbolShadow.blur) ? symbolShadow.blur : 18,
      );
    } else {
      this.clearCanvasShadow(ctx);
    }

    const glyph = tower.symbol || tower.definition?.symbol || '?';
    ctx.fillStyle = symbolColor;
    ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, tower.x, tower.y);

    if (tower.type === 'beta') {
      const alphaShots = Math.max(0, Math.floor(tower.storedAlphaShots || 0));
      if (alphaShots > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.round(bodyRadius * 0.75)}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`? ? ${alphaShots}`, tower.x, tower.y + bodyRadius + 6);
        ctx.restore();
      }
    } else if (tower.type === 'gamma') {
      const betaShots = Math.max(0, Math.floor(tower.storedBetaShots || 0));
      const alphaShots = Math.max(0, Math.floor(tower.storedAlphaShots || 0));
      if (betaShots > 0 || alphaShots > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.round(bodyRadius * 0.7)}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let labelY = tower.y + bodyRadius + 6;
        if (betaShots > 0) {
          ctx.fillText(`? ? ${betaShots}`, tower.x, labelY);
          labelY += Math.round(bodyRadius * 0.7) + 4;
        }
        if (alphaShots > 0) {
          ctx.fillText(`? ? ${alphaShots}`, tower.x, labelY);
        }
        ctx.restore();
      }
    }

    if (tower.chain) {
      this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', 20);
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, bodyRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      this.clearCanvasShadow(ctx);
    }

    if (this.activeTowerMenu?.towerId === tower.id) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.lineWidth = 2.6;
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function drawZetaPendulums(tower) {
  drawZetaPendulumsHelper(this, tower);
}

function drawEtaOrbits(tower) {
  drawEtaOrbitsHelper(this, tower);
}

function drawDeltaSoldiers() {
  drawDeltaSoldiersHelper(this);
}

function drawEnemies() {
  if (!this.ctx || !this.enemies.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  this.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }

    const position = this.getEnemyPosition(enemy);
    if (!position) {
      return;
    }

    const metrics = this.getEnemyVisualMetrics(enemy);
    const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
    const exponent = this.calculateHealthExponent(Math.max(1, enemy.hp ?? enemy.maxHp ?? 1));

    ctx.save();
    ctx.translate(position.x, position.y);

    const inversionActive = Number.isFinite(enemy.iotaInversionTimer) && enemy.iotaInversionTimer > 0;
    const ringFillStyle = inversionActive ? 'rgba(240, 244, 255, 0.88)' : 'rgba(12, 16, 24, 0.88)';
    const ringStrokeStyle = inversionActive ? 'rgba(12, 16, 24, 0.55)' : 'rgba(139, 247, 255, 0.45)';
    const coreFillStyle = inversionActive ? 'rgba(12, 18, 28, 0.42)' : 'rgba(139, 247, 255, 0.28)';
    const symbolFillStyle = inversionActive ? 'rgba(16, 20, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)';
    const exponentFillStyle = inversionActive
      ? 'rgba(24, 34, 46, 0.9)'
      : this.resolveEnemyExponentColor(enemy);
    const exponentStrokeStyle = inversionActive ? 'rgba(236, 240, 248, 0.85)' : 'rgba(6, 8, 14, 0.85)';

    ctx.beginPath();
    ctx.fillStyle = ringFillStyle;
    ctx.strokeStyle = ringStrokeStyle;
    ctx.lineWidth = 2;
    ctx.arc(0, 0, metrics.ringRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = coreFillStyle;
    ctx.arc(0, 0, metrics.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = symbolFillStyle;
    ctx.font = `${metrics.symbolSize}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol || '?', 0, 0);

    ctx.font = `700 ${metrics.exponentSize}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const exponentLabel = exponent.toFixed(1);
    const pixelRatio = Number.isFinite(this.pixelRatio) && this.pixelRatio > 0 ? this.pixelRatio : 1;
    const outlineWidth = Math.max(1, Math.round(pixelRatio));
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = exponentStrokeStyle;
    ctx.lineWidth = outlineWidth;
    const exponentOffsetX = metrics.ringRadius * 0.94;
    const exponentOffsetY = -metrics.ringRadius * 0.98;
    ctx.strokeText(exponentLabel, exponentOffsetX, exponentOffsetY);
    ctx.fillStyle = exponentFillStyle;
    ctx.fillText(exponentLabel, exponentOffsetX, exponentOffsetY);

    if (this.focusedEnemyId === enemy.id) {
      const markerRadius = metrics.focusRadius || metrics.ringRadius + 8;
      const angle = this.focusMarkerAngle || 0;
      const span = Math.PI / 3;
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, markerRadius, angle, angle + span);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, markerRadius, angle + Math.PI, angle + Math.PI + span);
      ctx.stroke();
    }

    ctx.restore();
  });

  ctx.restore();
}

function drawProjectiles() {
  if (!this.ctx) {
    return;
  }

  const ctx = this.ctx;
  if (this.projectiles.length) {
    ctx.save();
  }

  this.projectiles.forEach((projectile) => {
    if (!projectile) {
      return;
    }

    if (projectile.patternType === 'supply') {
      const position = projectile.currentPosition || projectile.target || projectile.source;
      if (!position) {
        return;
      }
      const seeds = Array.isArray(projectile.seeds) ? projectile.seeds : [];
      if (seeds.length) {
        seeds.forEach((seed) => {
          if (!seed || !seed.position) {
            return;
          }
          const baseColor = seed.type === 'beta'
            ? { r: 255, g: 214, b: 112 }
            : { r: 255, g: 138, b: 216 };
          const glowColor = normalizeProjectileColor(baseColor, 1);
          const size = Number.isFinite(seed.size) ? seed.size : 2.2;
          ctx.fillStyle = colorToRgbaString(glowColor, 0.85);
          ctx.beginPath();
          ctx.arc(seed.position.x, seed.position.y, size, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        const color = normalizeProjectileColor(projectile.color, 1);
        ctx.fillStyle = colorToRgbaString(color, 0.85);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (projectile.patternType === 'omegaWave') {
      const position = projectile.position || projectile.origin;
      if (!position) {
        return;
      }

      const radius = Number.isFinite(projectile.parameters?.radius)
        ? projectile.parameters.radius
        : 40;
      const gradient = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius);
      gradient.addColorStop(0, 'rgba(255, 228, 120, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 228, 120, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (projectile.patternType === 'etaLaser') {
      const origin = projectile.origin;
      if (!origin) {
        return;
      }
      const angle = Number.isFinite(projectile.angle) ? projectile.angle : 0;
      const length = Number.isFinite(projectile.length) ? projectile.length : 0;
      if (length <= 0) {
        return;
      }
      const width = Math.max(2, Number.isFinite(projectile.width) ? projectile.width : 8);
      const alpha = Number.isFinite(projectile.alpha) ? Math.max(0, Math.min(1, projectile.alpha)) : 1;
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(angle);
      const beamColor = normalizeProjectileColor(projectile.color, 1);
      const gradient = ctx.createLinearGradient(0, 0, length, 0);
      gradient.addColorStop(0, colorToRgbaString(beamColor, alpha));
      gradient.addColorStop(0.6, colorToRgbaString(beamColor, alpha * 0.6));
      gradient.addColorStop(1, colorToRgbaString(beamColor, 0));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (projectile.patternType === 'iotaPulse') {
      const origin = projectile.origin;
      if (!origin) {
        return;
      }
      const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.32;
      const progress = Math.max(0, Math.min(1, projectile.lifetime / maxLifetime));
      const baseRadius = Number.isFinite(projectile.radius) ? projectile.radius : 60;
      const currentRadius = baseRadius * (0.4 + 0.6 * progress);
      const color = normalizeProjectileColor(projectile.color || { r: 180, g: 240, b: 255 }, 1);
      const alpha = Math.max(0, 0.55 * (1 - progress));
      ctx.save();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = colorToRgbaString(color, alpha);
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (projectile.patternType === 'epsilonNeedle') {
      const position = projectile.position || projectile.origin;
      if (!position) {
        return;
      }
      const prev = projectile.previousPosition || position;
      const heading = Math.atan2((position.y - prev.y) || 0.0001, (position.x - prev.x) || 0.0001);
      const length = 10;
      const width = 1.2;
      // Fade embedded thorns by honoring the projectile alpha computed in the simulation.
      const alpha = Number.isFinite(projectile.alpha) ? Math.max(0, Math.min(1, projectile.alpha)) : 1;
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(heading);
      ctx.fillStyle = `rgba(139, 247, 255, ${0.85 * alpha})`;
      ctx.strokeStyle = `rgba(12, 16, 26, ${0.9 * alpha})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(length, 0);
      ctx.lineTo(-length * 0.6, width);
      ctx.lineTo(-length * 0.6, -width);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    const source = projectile.source;
    const targetPosition = projectile.target
      ? projectile.target
      : projectile.targetId
      ? (() => {
          const enemy = this.enemies.find((candidate) => candidate.id === projectile.targetId);
          return enemy ? this.getEnemyPosition(enemy) : null;
        })()
      : projectile.targetCrystalId
      ? (() => {
          const crystal = this.developerCrystals.find((entry) => entry?.id === projectile.targetCrystalId);
          return crystal ? this.getCrystalPosition(crystal) : null;
        })()
      : null;

    if (!source || !targetPosition) {
      return;
    }

    const beamStart = normalizeProjectileColor(projectile.color, 0);
    const beamEnd = normalizeProjectileColor(projectile.color, 1);
    const beamGradient = ctx.createLinearGradient(source.x, source.y, targetPosition.x, targetPosition.y);
    beamGradient.addColorStop(0, colorToRgbaString(beamStart, 0.72));
    beamGradient.addColorStop(1, colorToRgbaString(beamEnd, 0.78));
    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(targetPosition.x, targetPosition.y);
    ctx.stroke();

    ctx.fillStyle = colorToRgbaString(beamEnd, 0.9);
    ctx.beginPath();
    ctx.arc(targetPosition.x, targetPosition.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (this.projectiles.length) {
    ctx.restore();
  }

  this.drawBetaBursts();
  this.drawAlphaBursts();
  this.drawGammaBursts();
}

function drawAlphaBursts() {
  drawAlphaBurstsHelper(this);
}

function drawBetaBursts() {
  drawBetaBurstsHelper(this);
}

function drawGammaBursts() {
  drawGammaBurstsHelper(this);
}

function drawTowerMenu() {
  if (!this.ctx || !this.activeTowerMenu) {
    return;
  }
  const tower = this.getActiveMenuTower();
  if (!tower) {
    return;
  }
  const geometry = this.getTowerMenuGeometry(tower);
  if (!geometry) {
    return;
  }
  const { options, optionRadius, ringRadius } = geometry;
  const ctx = this.ctx;
  ctx.save();

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(139, 247, 255, 0.35)';
  ctx.lineWidth = Math.max(1.2, optionRadius * 0.14);
  ctx.arc(tower.x, tower.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  options.forEach((option) => {
    const selected = Boolean(option.selected);
    const disabled = Boolean(option.disabled);
    ctx.beginPath();
    const baseFill = selected ? 'rgba(255, 228, 120, 0.32)' : 'rgba(12, 16, 26, 0.88)';
    const disabledFill = 'rgba(12, 16, 26, 0.5)';
    const baseStroke = selected ? 'rgba(255, 228, 120, 0.9)' : 'rgba(139, 247, 255, 0.75)';
    const disabledStroke = 'rgba(139, 247, 255, 0.35)';
    ctx.fillStyle = disabled ? disabledFill : baseFill;
    ctx.strokeStyle = disabled ? disabledStroke : baseStroke;
    ctx.lineWidth = Math.max(1.4, optionRadius * 0.16);
    ctx.arc(option.center.x, option.center.y, optionRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const hasCostLabel = typeof option.costLabel === 'string' && option.costLabel.length > 0;
    const iconFontSize = Math.round(optionRadius * (hasCostLabel ? 0.82 : 0.95));
    const iconY = hasCostLabel ? option.center.y - optionRadius * 0.25 : option.center.y;
    ctx.fillStyle = disabled ? 'rgba(230, 234, 241, 0.42)' : 'rgba(255, 255, 255, 0.92)';
    ctx.font = `${iconFontSize}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(option.icon || '?', option.center.x, iconY);

    if (hasCostLabel) {
      // Present the upgrade cost beneath the icon so players can budget merges directly from the lattice.
      const costFontSize = Math.max(10, Math.round(optionRadius * 0.45));
      ctx.fillStyle = disabled ? 'rgba(210, 216, 226, 0.38)' : 'rgba(210, 216, 226, 0.82)';
      ctx.font = `${costFontSize}px "Cormorant Garamond", serif`;
      ctx.textBaseline = 'top';
      const costY = iconY + optionRadius * 0.4;
      ctx.fillText(option.costLabel, option.center.x, costY);
    }
  });

  ctx.restore();
}

export {
  applyCanvasShadow,
  clearCanvasShadow,
  drawTowerConnectionParticles,
  drawConnectionEffects,
  draw,
  drawFloaters,
  drawMoteGems,
  drawPath,
  drawDeltaCommandPreview,
  drawArcLight,
  drawEnemyGateSymbol,
  drawMindGateSymbol,
  drawNodes,
  drawDeveloperPathMarkers,
  drawDeveloperCrystals,
  drawPlacementPreview,
  drawTowers,
  drawZetaPendulums,
  drawEtaOrbits,
  drawDeltaSoldiers,
  drawEnemies,
  drawProjectiles,
  drawAlphaBursts,
  drawBetaBursts,
  drawGammaBursts,
  drawTowerMenu,
};

