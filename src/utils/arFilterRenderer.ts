/**
 * AR Face Filter Canvas Renderers
 * Draws high-resolution vector and graphic props aligned to facial landmarks.
 */

import { ARFilterId, DetectedFace } from '../types/arFilter';

/**
 * Main dispatcher to render an AR filter onto a 2D canvas context.
 * Coordinates are mapped to match canvas width and height.
 */
export function renderARFilterOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  face: DetectedFace,
  filterId: ARFilterId,
  isMirrored = false
) {
  if (filterId === 'none') return;

  const fX = isMirrored ? (1 - face.x) * canvasWidth : face.x * canvasWidth;
  const fY = face.y * canvasHeight;
  const fW = face.width * canvasWidth;
  const fH = face.height * canvasHeight;
  const roll = isMirrored ? -face.rollAngle : face.rollAngle;

  ctx.save();
  ctx.translate(fX, fY);
  ctx.rotate(roll);

  switch (filterId) {
    case 'sunglasses':
      drawSunglasses(ctx, fW, fH);
      break;
    case 'heart-shades':
      drawHeartShades(ctx, fW, fH);
      break;
    case 'cat-ears':
      drawCatEars(ctx, fW, fH);
      break;
    case 'bunny-ears':
      drawBunnyEars(ctx, fW, fH);
      break;
    case 'anime-blush':
      drawAnimeBlush(ctx, fW, fH);
      break;
    case 'party-hat':
      drawPartyHat(ctx, fW, fH);
      break;
    case 'angel-halo':
      drawAngelHalo(ctx, fW, fH);
      break;
    case 'mustache':
      drawMustache(ctx, fW, fH);
      break;
    case 'clown-nose':
      drawClownNose(ctx, fW, fH);
      break;
    default:
      break;
  }

  ctx.restore();
}

/**
 * 1. Retro Black Sunglasses with glossy reflections
 */
function drawSunglasses(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const eyeY = -fH * 0.12;
  const glassesWidth = fW * 0.95;
  const lensWidth = glassesWidth * 0.44;
  const lensHeight = fH * 0.28;
  const bridgeWidth = glassesWidth * 0.12;

  ctx.save();
  ctx.translate(0, eyeY);

  // Frame shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Bridge
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-bridgeWidth / 2, -lensHeight * 0.15, bridgeWidth, lensHeight * 0.2);

  // Top brow bar
  ctx.beginPath();
  ctx.roundRect(-glassesWidth / 2, -lensHeight * 0.4, glassesWidth, lensHeight * 0.25, 4);
  ctx.fill();

  // Left & Right Lenses (Trapezoid / Wayfarer shape)
  const drawLens = (centerX: number) => {
    ctx.save();
    ctx.translate(centerX, 0);

    // Outer frame
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight, [8, 8, 20, 20]);
    ctx.fill();
    ctx.stroke();

    // Dark tint inner lens
    const grad = ctx.createLinearGradient(0, -lensHeight / 2, 0, lensHeight / 2);
    grad.addColorStop(0, '#18181b');
    grad.addColorStop(0.7, '#000000');
    grad.addColorStop(1, '#27272a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-lensWidth / 2 + 3, -lensHeight / 2 + 3, lensWidth - 6, lensHeight - 6, [6, 6, 16, 16]);
    ctx.fill();

    // Glass reflection diagonal glare
    ctx.save();
    ctx.clip();
    const glareGrad = ctx.createLinearGradient(-lensWidth / 2, -lensHeight / 2, lensWidth / 2, lensHeight / 2);
    glareGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.35)');
    glareGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.05)');
    glareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
    glareGrad.addColorStop(0.65, 'transparent');
    ctx.fillStyle = glareGrad;
    ctx.fillRect(-lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight);
    ctx.restore();

    ctx.restore();
  };

  drawLens(-glassesWidth / 2 + lensWidth / 2);
  drawLens(glassesWidth / 2 - lensWidth / 2);

  ctx.restore();
}

/**
 * 2. Heart-Shaped Sunglasses (Cute Y2K Pink)
 */
function drawHeartShades(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const eyeY = -fH * 0.12;
  const span = fW * 0.46;
  const size = fW * 0.42;

  ctx.save();
  ctx.translate(0, eyeY);

  const drawHeart = (cx: number) => {
    ctx.save();
    ctx.translate(cx, 0);

    const s = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.bezierCurveTo(-s * 1.3, -s * 0.3, -s * 1.3, -s * 1.3, 0, -s * 0.6);
    ctx.bezierCurveTo(s * 1.3, -s * 1.3, s * 1.3, -s * 0.3, 0, s * 0.6);
    ctx.closePath();

    // Pink frame
    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.stroke();

    // Inner tint
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, s);
    grad.addColorStop(0, 'rgba(244, 114, 182, 0.85)');
    grad.addColorStop(1, 'rgba(190, 24, 93, 0.95)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Glare
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.5, s * 0.25, s * 0.12, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Center connection bridge
  ctx.strokeStyle = '#db2777';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -size * 0.1, span * 0.2, Math.PI, 0);
  ctx.stroke();

  drawHeart(-span / 2);
  drawHeart(span / 2);

  ctx.restore();
}

/**
 * 3. Cute Cat Ears + Pink Nose & Whiskers
 */
function drawCatEars(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const headTopY = -fH * 0.52;
  const earW = fW * 0.36;
  const earH = fH * 0.48;
  const earSpacing = fW * 0.32;

  ctx.save();
  ctx.translate(0, headTopY);

  // Draw one ear
  const drawEar = (side: 1 | -1) => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(earSpacing, 0);
    ctx.rotate(0.2);

    // Outer ear
    ctx.beginPath();
    ctx.moveTo(-earW * 0.5, 0);
    ctx.quadraticCurveTo(-earW * 0.1, -earH * 0.9, earW * 0.2, -earH);
    ctx.quadraticCurveTo(earW * 0.6, -earH * 0.6, earW * 0.5, 0);
    ctx.closePath();

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();

    // Inner pink fluff
    ctx.beginPath();
    ctx.moveTo(-earW * 0.25, -earH * 0.05);
    ctx.quadraticCurveTo(0, -earH * 0.7, earW * 0.15, -earH * 0.85);
    ctx.quadraticCurveTo(earW * 0.4, -earH * 0.5, earW * 0.3, -earH * 0.05);
    ctx.closePath();

    const pinkGrad = ctx.createLinearGradient(0, -earH * 0.85, 0, 0);
    pinkGrad.addColorStop(0, '#f472b6');
    pinkGrad.addColorStop(1, '#fda4af');
    ctx.fillStyle = pinkGrad;
    ctx.fill();

    ctx.restore();
  };

  drawEar(-1);
  drawEar(1);

  // Cute Headband arch
  ctx.beginPath();
  ctx.ellipse(0, 5, fW * 0.46, fH * 0.15, 0, Math.PI, 0);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#18181b';
  ctx.stroke();

  ctx.restore();

  // Draw Cute Nose & Whiskers on face
  ctx.save();
  const noseY = fH * 0.04;
  ctx.translate(0, noseY);

  // Pink nose triangle
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(0, fH * 0.06);
  ctx.lineTo(-fW * 0.06, 0);
  ctx.lineTo(fW * 0.06, 0);
  ctx.closePath();
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const drawWhiskers = (side: 1 | -1) => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(fW * 0.1, -fH * 0.01);
    ctx.lineTo(fW * 0.38, -fH * 0.05);
    ctx.moveTo(fW * 0.1, fH * 0.02);
    ctx.lineTo(fW * 0.4, fH * 0.02);
    ctx.moveTo(fW * 0.1, fH * 0.05);
    ctx.lineTo(fW * 0.36, fH * 0.08);
    ctx.stroke();
    ctx.restore();
  };
  drawWhiskers(1);
  drawWhiskers(-1);

  ctx.restore();
}

/**
 * 4. Fluffy Bunny Ears
 */
function drawBunnyEars(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const headTopY = -fH * 0.52;
  const earW = fW * 0.28;
  const earH = fH * 0.85;

  ctx.save();
  ctx.translate(0, headTopY);

  const drawOneBunnyEar = (side: 1 | -1, angle: number) => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(fW * 0.22, 0);
    ctx.rotate(angle);

    // Outer white ear
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -earH / 2, earW / 2, earH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner pastel pink
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.ellipse(0, -earH / 2, earW * 0.3, earH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  drawOneBunnyEar(-1, -0.15);
  drawOneBunnyEar(1, 0.15);

  ctx.restore();
}

/**
 * 5. Anime Manga Blush + Sakura Blossoms
 */
function drawAnimeBlush(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const cheekY = fH * 0.08;
  const cheekX = fW * 0.32;
  const cheekRadius = fW * 0.16;

  ctx.save();
  ctx.translate(0, cheekY);

  const drawCheek = (side: 1 | -1) => {
    ctx.save();
    ctx.translate(side * cheekX, 0);

    // Radial gradient glow
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, cheekRadius);
    grad.addColorStop(0, 'rgba(244, 63, 94, 0.7)');
    grad.addColorStop(0.6, 'rgba(251, 113, 133, 0.35)');
    grad.addColorStop(1, 'rgba(251, 113, 133, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, cheekRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3 Cute Anime Slanted Lines
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.7)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12 - 8, -6);
      ctx.lineTo(i * 12 + 6, 8);
      ctx.stroke();
    }

    ctx.restore();
  };

  drawCheek(-1);
  drawCheek(1);

  // Floating Sparkles above head
  const drawSparkle = (x: number, y: number, r: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.fill();
    ctx.restore();
  };

  drawSparkle(-fW * 0.35, -fH * 0.45, 14);
  drawSparkle(fW * 0.32, -fH * 0.48, 18);
  drawSparkle(fW * 0.05, -fH * 0.55, 12);

  ctx.restore();
}

/**
 * 6. Birthday / Party Cone Hat
 */
function drawPartyHat(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const hatBaseY = -fH * 0.48;
  const hatW = fW * 0.48;
  const hatH = fH * 0.75;

  ctx.save();
  ctx.translate(0, hatBaseY);
  ctx.rotate(0.08); // playful slight tilt

  // Cone Path
  ctx.beginPath();
  ctx.moveTo(-hatW / 2, 0);
  ctx.lineTo(0, -hatH);
  ctx.lineTo(hatW / 2, 0);
  ctx.closePath();

  // Striped pattern
  const grad = ctx.createLinearGradient(-hatW / 2, 0, hatW / 2, 0);
  grad.addColorStop(0, '#f59e0b');
  grad.addColorStop(0.25, '#ec4899');
  grad.addColorStop(0.5, '#3b82f6');
  grad.addColorStop(0.75, '#10b981');
  grad.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = grad;
  ctx.fill();

  // Pom-pom on top
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, -hatH, 16, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy rim on bottom
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  const rimCount = 7;
  const step = hatW / rimCount;
  for (let i = 0; i <= rimCount; i++) {
    ctx.beginPath();
    ctx.arc(-hatW / 2 + i * step, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 7. Glowing Angel Halo
 */
function drawAngelHalo(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const haloY = -fH * 0.62;
  const haloW = fW * 0.75;
  const haloH = fH * 0.22;

  ctx.save();
  ctx.translate(0, haloY);

  // Outer Golden Glow
  ctx.shadowColor = 'rgba(250, 204, 21, 0.9)';
  ctx.shadowBlur = 24;

  ctx.beginPath();
  ctx.ellipse(0, 0, haloW / 2, haloH / 2, 0, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fde047';
  ctx.stroke();

  // Bright core
  ctx.beginPath();
  ctx.ellipse(0, 0, haloW / 2, haloH / 2, 0, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.restore();
}

/**
 * 8. Vintage Gentleman Mustache
 */
function drawMustache(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const mouthY = fH * 0.18;
  const stacheW = fW * 0.58;
  const stacheH = fH * 0.18;

  ctx.save();
  ctx.translate(0, mouthY);

  ctx.fillStyle = '#1c1917';
  ctx.strokeStyle = '#0c0a09';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;

  // Curled handlebar mustache path
  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Left curl
  ctx.bezierCurveTo(-stacheW * 0.25, -stacheH * 0.6, -stacheW * 0.45, -stacheH * 0.3, -stacheW * 0.5, -stacheH * 0.5);
  ctx.bezierCurveTo(-stacheW * 0.55, -stacheH * 0.7, -stacheW * 0.48, -stacheH * 0.1, -stacheW * 0.3, stacheH * 0.4);
  ctx.bezierCurveTo(-stacheW * 0.15, stacheH * 0.5, -stacheW * 0.05, stacheH * 0.1, 0, 0);

  // Right curl
  ctx.bezierCurveTo(stacheW * 0.05, stacheH * 0.1, stacheW * 0.15, stacheH * 0.5, stacheW * 0.3, stacheH * 0.4);
  ctx.bezierCurveTo(stacheW * 0.48, -stacheH * 0.1, stacheW * 0.55, -stacheH * 0.7, stacheW * 0.5, -stacheH * 0.5);
  ctx.bezierCurveTo(stacheW * 0.45, -stacheH * 0.3, stacheW * 0.25, -stacheH * 0.6, 0, 0);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * 9. Cute Red Clown Nose
 */
function drawClownNose(ctx: CanvasRenderingContext2D, fW: number, fH: number) {
  const noseY = fH * 0.02;
  const r = fW * 0.14;

  ctx.save();
  ctx.translate(0, noseY);

  // Shiny 3D Red Nose
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#f87171');
  grad.addColorStop(0.3, '#ef4444');
  grad.addColorStop(0.85, '#b91c1c');
  grad.addColorStop(1, '#7f1d1d');

  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(185, 28, 28, 0.6)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // White highlight reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.3, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
