import type Phaser from 'phaser';
import { SVG_ASSETS } from './svg';
import {
  canvas, rng, paintSky, paintGreenhouse, paintFoliage, paintRay, paintVignette,
  paintSoftDot, paintPetal, paintStar, paintStoneMatte, paintStonePolished, paintStoneLift
} from './paint';
import { GAME_W, GAME_H } from '../core/constants';
import { addHiDpiCanvas } from '../core/Display';

/** Rasterise les SVG à haute résolution et les enregistre comme textures Phaser. */
export async function loadSvgTextures(scene: Phaser.Scene): Promise<void> {
  await Promise.all(
    SVG_ASSETS.map(
      (a) =>
        new Promise<void>((resolve) => {
          if (scene.textures.exists(a.key)) return resolve();
          const img = new Image();
          img.onload = () => {
            const [c, ctx] = canvas(a.w, a.h);
            ctx.drawImage(img, 0, 0, a.w, a.h);
            addHiDpiCanvas(scene, a.key, c);
            resolve();
          };
          img.onerror = () => {
            console.warn('SVG invalide :', a.key);
            const [c] = canvas(a.w, a.h);
            addHiDpiCanvas(scene, a.key, c);
            resolve();
          };
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
        })
    )
  );
}

export function ensureCanvas(scene: Phaser.Scene, key: string, painter: () => HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) addHiDpiCanvas(scene, key, painter());
  return key;
}

/** Textures communes à tout le chapitre 1 (décors, particules, pavés). */
export function paintChapter1(scene: Phaser.Scene): void {
  ensureCanvas(scene, 'sky-c1', () => paintSky(GAME_W, GAME_H));
  ensureCanvas(scene, 'greenhouse', () => paintGreenhouse(1600, GAME_H));
  ensureCanvas(scene, 'foliage-far', () => paintFoliage(2400, 420, 0.1, 11));
  ensureCanvas(scene, 'foliage-mid', () => paintFoliage(2400, 520, 0.7, 23));
  ensureCanvas(scene, 'ray', () => paintRay(260, 900));
  ensureCanvas(scene, 'vignette', () => paintVignette(GAME_W, GAME_H));
  ensureCanvas(scene, 'dot', () => paintSoftDot(32));
  ensureCanvas(scene, 'dot-warm', () => paintSoftDot(32, 'rgba(255,236,170,1)'));
  ensureCanvas(scene, 'dot-glow', () => paintSoftDot(128, 'rgba(200,255,220,0.9)'));
  ensureCanvas(scene, 'petal', paintPetal);
  ensureCanvas(scene, 'star', paintStar);
  ensureCanvas(scene, 'stone-polished', paintStonePolished);
  ensureCanvas(scene, 'stone-lift', paintStoneLift);
  for (let i = 0; i < 4; i++) ensureCanvas(scene, `stone-matte-${i}`, () => paintStoneMatte(100 + i * 17));
  ensureCanvas(scene, 'dust', () => {
    const [c, ctx] = canvas(24, 24);
    ctx.fillStyle = 'rgba(255,248,232,0.9)';
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fill();
    return c;
  });
  ensureCanvas(scene, 'decor-bush', paintBush);
  ensureCanvas(scene, 'decor-can', paintCan);
  ensureCanvas(scene, 'decor-lantern', paintLantern);
  ensureCanvas(scene, 'decor-mushrooms', paintMushrooms);
  ensureCanvas(scene, 'decor-fgleaf', paintFgLeaf);
}

// ------------------------------------------------------------- décor

function paintBush(): HTMLCanvasElement {
  const [c, ctx] = canvas(150, 90);
  const r = rng(5);
  const shades = ['#4e7a62', '#5e9a70', '#7db386', '#9cc98a'];
  for (let i = 0; i < 46; i++) {
    const x = 20 + r() * 110, y = 30 + r() * 55;
    ctx.fillStyle = shades[Math.min(3, Math.floor((1 - y / 90) * 3 + r() * 1.5))];
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + r() * 10, 7 + r() * 6, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#f6b89a' : '#fbe38e';
    const x = 30 + r() * 90, y = 26 + r() * 40;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

function paintCan(): HTMLCanvasElement {
  // arrosoir abandonné (clin d'œil au boss du chapitre)
  const [c, ctx] = canvas(110, 80);
  ctx.translate(10, 10);
  const g = ctx.createLinearGradient(0, 0, 60, 0);
  g.addColorStop(0, '#3e9e98');
  g.addColorStop(0.5, '#7fd1c7');
  g.addColorStop(1, '#2e7c77');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(14, 18, 52, 50, 8);
  ctx.fill();
  ctx.strokeStyle = '#2e7c77';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(40, 18, 18, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(64, 50);
  ctx.lineTo(90, 22);
  ctx.stroke();
  ctx.fillStyle = '#f7d774';
  ctx.beginPath();
  ctx.ellipse(91, 20, 6, 9, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(20, 24, 6, 36);
  return c;
}

function paintLantern(): HTMLCanvasElement {
  const [c, ctx] = canvas(60, 130);
  ctx.strokeStyle = '#3a2a24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(30, 70);
  ctx.stroke();
  const glow = ctx.createRadialGradient(30, 96, 2, 30, 96, 30);
  glow.addColorStop(0, 'rgba(255,230,150,0.9)');
  glow.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 66, 60, 64);
  ctx.fillStyle = '#f7d774';
  ctx.beginPath();
  ctx.roundRect(20, 78, 20, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#3a2a24';
  ctx.fillRect(18, 72, 24, 7);
  ctx.fillRect(20, 106, 20, 5);
  return c;
}

function paintMushrooms(): HTMLCanvasElement {
  const [c, ctx] = canvas(120, 80);
  const caps = [[30, 50, 16], [58, 38, 22], [88, 56, 13]];
  for (const [x, y, r] of caps) {
    const glow = ctx.createRadialGradient(x, y, 2, x, y, r * 2.2);
    glow.addColorStop(0, 'rgba(127,209,199,0.55)');
    glow.addColorStop(1, 'rgba(127,209,199,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }
  for (const [x, y, r] of caps) {
    ctx.fillStyle = '#e9f4ee';
    ctx.fillRect(x - r * 0.18, y, r * 0.36, 80 - y);
    ctx.fillStyle = '#7fd1c7';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#d6fff8';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.14, 0, Math.PI * 2);
    ctx.arc(x + r * 0.25, y - r * 0.4, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintFgLeaf(): HTMLCanvasElement {
  // grandes feuilles floues au premier plan (profondeur "diorama")
  const [c, ctx] = canvas(520, 360);
  const r = rng(77);
  const draw = () => {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(120 + r() * 280, 360);
      ctx.rotate(-Math.PI / 2 + (r() - 0.5) * 1.4);
      const len = 200 + r() * 140;
      ctx.fillStyle = i % 2 ? '#1f3d36' : '#29504a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.45, -len * 0.2, len, 0);
      ctx.quadraticCurveTo(len * 0.45, len * 0.2, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  };
  try {
    ctx.filter = 'blur(5px)';
  } catch { /* navigateurs sans filtre canvas : rendu net, acceptable */ }
  draw();
  return c;
}
