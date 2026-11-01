// Illustrations des cartes de chapitre (Canvas 2D, peintes à la résolution d'affichage).
// Chaque vignette est cadrée pour sa carte (coins arrondis intégrés : jamais d'étirement).

import { canvas, rng } from '../art/paint';

export const ART_W = 196;
export const ART_H = 132;
const RADIUS = 16;

type Ctx = CanvasRenderingContext2D;

function frame(paint: (ctx: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  const [c, ctx] = canvas(ART_W, ART_H);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, ART_W, ART_H, [RADIUS, RADIUS, 0, 0]);
  ctx.clip();
  paint(ctx, ART_W, ART_H);
  // léger vignettage pour la profondeur
  const v = ctx.createRadialGradient(ART_W / 2, ART_H * 0.45, ART_H * 0.3, ART_W / 2, ART_H * 0.5, ART_W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,20,30,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ART_W, ART_H);
  ctx.restore();
  return c;
}

function leaf(ctx: Ctx, x: number, y: number, a: number, len: number, wid: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.75, wid * 0.8, len * 0.3, wid, 0, 0);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ 1 · La Serre des Évidences

export function paintChapter1Art(): HTMLCanvasElement {
  return frame((ctx, w, h) => {
    const r = rng(11);
    // ciel de verrière
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#c4e9de');
    sky.addColorStop(0.6, '#e8f4e2');
    sky.addColorStop(1, '#fbe2c2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(w * 0.78, h * 0.1, 2, w * 0.78, h * 0.1, h);
    sun.addColorStop(0, 'rgba(255,248,214,0.95)');
    sun.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    // armature de la serre : arches et montants
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (let x = -10; x < w + 40; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, 46);
      ctx.quadraticCurveTo(x + 24, 8, x + 48, 46);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 24, 34, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(w, 70); ctx.stroke();
    // rayons
    ctx.fillStyle = 'rgba(255,246,206,0.35)';
    ctx.beginPath(); ctx.moveTo(w * 0.6, 0); ctx.lineTo(w * 0.72, 0); ctx.lineTo(w * 0.42, h); ctx.lineTo(w * 0.22, h); ctx.fill();
    // fougères et bananiers lointains
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 36 + r() * 10;
      for (let k = 0; k < 6; k++) leaf(ctx, x, h - 26, -Math.PI / 2 + (k - 2.5) * 0.35, 40 + r() * 22, 7, k % 2 ? 'rgba(111,168,143,0.55)' : 'rgba(78,122,98,0.45)');
    }
    // sol
    const soil = ctx.createLinearGradient(0, h - 22, 0, h);
    soil.addColorStop(0, '#6fae74');
    soil.addColorStop(0.3, '#8b5d43');
    soil.addColorStop(1, '#5b3a2a');
    ctx.fillStyle = soil;
    ctx.fillRect(0, h - 22, w, 22);
    // trois pavés polis sur leurs tiges, au-dessus du vide
    ctx.fillStyle = '#4a2140';
    for (let x = 98; x < 176; x += 7) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 3, h - 9); ctx.lineTo(x + 6, h); ctx.fill(); }
    ctx.fillStyle = 'rgba(40,24,20,0.6)';
    ctx.fillRect(96, h - 22, 82, 22);
    ctx.fillStyle = '#4a2140';
    for (let x = 98; x < 176; x += 7) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 3, h - 10); ctx.lineTo(x + 6, h); ctx.fill(); }
    for (const sx of [100, 128, 156]) {
      ctx.strokeStyle = '#5e9a70'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx + 11, h - 30); ctx.lineTo(sx + 10, h); ctx.stroke();
      const g = ctx.createLinearGradient(0, h - 38, 0, h - 30);
      g.addColorStop(0, '#fbf8f2'); g.addColorStop(1, '#a9bcb7');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(sx, h - 38, 23, 8, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(sx + 4, h - 37, 3, 6);
    }
    // la fleur indiscrète (à gauche) qui regarde le héros
    const fx = 44, fy = h - 72;
    ctx.strokeStyle = '#4e7a62'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(fx - 6, h - 22); ctx.quadraticCurveTo(fx - 14, h - 48, fx, fy + 8); ctx.stroke();
    leaf(ctx, fx - 10, h - 42, -2.4, 22, 6, '#5e9a70');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#f6b89a' : '#e8846b';
      ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 12, fy + Math.sin(a) * 12, 9, 4.5, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f7c94e';
    ctx.beginPath(); ctx.arc(fx, fy, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(fx - 2.5, fy - 1, 2.8, 0, Math.PI * 2); ctx.arc(fx + 3.5, fy - 1, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24306a';
    ctx.beginPath(); ctx.arc(fx - 1.6, fy - 0.5, 1.4, 0, Math.PI * 2); ctx.arc(fx + 4.4, fy - 0.5, 1.4, 0, Math.PI * 2); ctx.fill();
    // le héros, de dos à la fleur
    const hx = 74, hy = h - 34;
    ctx.fillStyle = 'rgba(20,30,30,0.2)';
    ctx.beginPath(); ctx.ellipse(hx, h - 21, 10, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24306a';
    ctx.beginPath(); ctx.ellipse(hx, hy, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4eee2';
    ctx.beginPath(); ctx.ellipse(hx + 3, hy - 3, 6.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141b3d';
    ctx.beginPath(); ctx.arc(hx + 1.5, hy - 3.5, 1.3, 0, Math.PI * 2); ctx.arc(hx + 5.5, hy - 3.5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f28c38';
    ctx.fillRect(hx - 10, hy + 2, 20, 3.5);
    ctx.beginPath(); ctx.moveTo(hx - 9, hy + 3); ctx.lineTo(hx - 18, hy + 9); ctx.lineTo(hx - 14, hy + 2); ctx.fill();
    // Dionée suspendue, en haut à droite
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(176, 0); ctx.lineTo(170, 18); ctx.moveTo(176, 0); ctx.lineTo(184, 18); ctx.stroke();
    ctx.fillStyle = '#c86a4e';
    ctx.beginPath(); ctx.moveTo(166, 18); ctx.lineTo(188, 18); ctx.lineTo(184, 28); ctx.lineTo(170, 28); ctx.fill();
    ctx.strokeStyle = '#4e7a62'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(177, 28); ctx.quadraticCurveTo(186, 42, 176, 52); ctx.stroke();
    ctx.fillStyle = '#6fa88f';
    ctx.beginPath(); ctx.ellipse(176, 58, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8846b';
    ctx.beginPath(); ctx.ellipse(176, 58, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(176 + i, 55); ctx.lineTo(177.5 + i, 58); ctx.lineTo(179 + i, 55); ctx.fill(); }
    // premier plan : grandes feuilles qui cadrent
    leaf(ctx, w + 6, h + 4, -2.5, 60, 15, 'rgba(36,71,58,0.85)');
    leaf(ctx, -6, h + 6, -0.75, 52, 13, 'rgba(36,71,58,0.8)');
    // pollen
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255,240,180,${0.4 + r() * 0.5})`;
      ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.8, 0.8 + r() * 1.2, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// ------------------------------------------------------------------ 2 · Le Grand Hôtel Mirage

export function paintChapter2Art(): HTMLCanvasElement {
  return frame((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1f2a55'); g.addColorStop(1, '#3b3f6e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // façade : rangées de fenêtres dorées, certaines éteintes
    const r = rng(23);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 12 + col * 26, y = 14 + row * 26;
        ctx.fillStyle = r() > 0.3 ? 'rgba(217,178,106,0.85)' : 'rgba(80,90,140,0.7)';
        ctx.beginPath(); ctx.roundRect(x, y, 14, 18, [7, 7, 1, 1]); ctx.fill();
      }
    }
    // lustre
    ctx.strokeStyle = '#d9b26a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, 22); ctx.stroke();
    ctx.fillStyle = '#d9b26a';
    ctx.beginPath(); ctx.ellipse(w / 2, 28, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(w / 2 + i * 9, 34, 2.4, 0, Math.PI * 2); ctx.fill(); }
    // tapis rouge et porte-ascenseur
    ctx.fillStyle = '#f6f1e4'; ctx.fillRect(0, h - 30, w, 30);
    ctx.fillStyle = '#c4454f'; ctx.beginPath(); ctx.moveTo(w * 0.35, h); ctx.lineTo(w * 0.45, h - 30); ctx.lineTo(w * 0.55, h - 30); ctx.lineTo(w * 0.65, h); ctx.fill();
    ctx.fillStyle = '#d9b26a'; ctx.beginPath(); ctx.roundRect(w * 0.42, h - 76, w * 0.16, 46, [12, 12, 0, 0]); ctx.fill();
    ctx.fillStyle = '#2a3366'; ctx.fillRect(w * 0.44, h - 70, w * 0.12, 40);
    ctx.fillStyle = '#e8b4b8'; ctx.beginPath(); ctx.arc(w / 2, h - 82, 3, 0, Math.PI * 2); ctx.fill();
  });
}

// ------------------------------------------------------------------ 3 · Le Théâtre des Silhouettes

export function paintChapter3Art(): HTMLCanvasElement {
  return frame((ctx, w, h) => {
    ctx.fillStyle = '#1c2233'; ctx.fillRect(0, 0, w, h);
    // faisceau de projecteur
    const sp = ctx.createRadialGradient(w / 2, h - 30, 4, w / 2, h - 30, 70);
    sp.addColorStop(0, 'rgba(243,230,207,0.75)'); sp.addColorStop(1, 'rgba(243,230,207,0)');
    ctx.fillStyle = sp; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(243,230,207,0.18)';
    ctx.beginPath(); ctx.moveTo(w / 2 - 6, 0); ctx.lineTo(w / 2 + 6, 0); ctx.lineTo(w / 2 + 44, h - 26); ctx.lineTo(w / 2 - 44, h - 26); ctx.fill();
    // rideaux
    for (const side of [0, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side ? w - 10 - i * 11 : 10 + i * 11;
        ctx.fillStyle = i % 2 ? '#7d2536' : '#6b1e2e';
        ctx.beginPath(); ctx.ellipse(x, h / 2, 9, h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#d4a64a'; ctx.fillRect(0, 0, w, 9);
    // scène et silhouette de carton
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#0d1018';
    ctx.beginPath(); ctx.arc(w / 2, h - 66, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(w / 2 - 9, h - 58, 18, 32, 6); ctx.fill();
  });
}

// ------------------------------------------------------------------ 4 · La Station des Anomalies

export function paintChapter4Art(): HTMLCanvasElement {
  return frame((ctx, w, h) => {
    ctx.fillStyle = '#16191e'; ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(244,246,248,${0.2 + r() * 0.6})`; ctx.fillRect(r() * w, r() * h, 1.2, 1.2); }
    // modules suspendus
    const mod = (x: number, y: number, mw: number, mh: number) => {
      ctx.fillStyle = '#2d3138'; ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 4); ctx.fill();
      ctx.strokeStyle = '#3fe0e8'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(63,224,232,0.6)'; ctx.fillRect(x + 4, y + mh / 2 - 1, mw - 8, 2);
    };
    mod(14, 70, 60, 26); mod(86, 44, 44, 60); mod(140, 84, 46, 22);
    // aimant orange
    ctx.strokeStyle = '#f28c38'; ctx.lineWidth = 7; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(108, 24, 12, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(93, 22, 8, 5); ctx.fillRect(115, 22, 8, 5);
    // champ de gravité
    ctx.strokeStyle = 'rgba(63,224,232,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(108, 74, 30 + i * 10, 8 + i * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
  });
}

// ------------------------------------------------------------------ 5 · L'Atelier des Hasards

export function paintChapter5Art(): HTMLCanvasElement {
  return frame((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3b1f5e'); g.addColorStop(1, '#25123d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // engrenages
    const gear = (x: number, y: number, rad: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = i % 2 ? rad : rad * 1.22;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.fillStyle = '#3b1f5e'; ctx.beginPath(); ctx.arc(x, y, rad * 0.35, 0, Math.PI * 2); ctx.fill();
    };
    gear(50, 52, 26, '#f2762e'); gear(96, 84, 18, '#5fd3c6'); gear(150, 46, 30, 'rgba(244,239,230,0.85)');
    // plan technique
    ctx.strokeStyle = 'rgba(95,211,198,0.5)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 14) { ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(244,239,230,0.9)';
    ctx.beginPath(); ctx.moveTo(w - 40, h - 10); ctx.lineTo(w - 20, h - 40); ctx.lineTo(w - 12, h - 34); ctx.lineTo(w - 32, h - 4); ctx.fill();
  });
}

export const CHAPTER_ART = [paintChapter1Art, paintChapter2Art, paintChapter3Art, paintChapter4Art, paintChapter5Art];
