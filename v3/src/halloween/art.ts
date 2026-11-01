// Peintres du Manoir des Trouillards (niveau bonus Halloween).
// Même grammaire que le chapitre 1 : volumes doux, contours marine, reflets crème —
// mais en palette nocturne : violet profond, bleu nuit, orange citrouille, vert spectral, jaune bougie.

import { canvas, rng, GRASS_PAD } from '../art/paint';
import { DISPLAY } from '../core/Display';

export const NIGHT = {
  ink: '#1a1533',
  navy: '#24306a',
  violet: '#3b2a5e',
  violetDeep: '#22183d',
  night: '#141a3a',
  stone: '#6f7690',
  stoneLight: '#a3a9c0',
  stoneDark: '#3d4260',
  pumpkin: '#f28c38',
  pumpkinDark: '#c4561c',
  pumpkinLight: '#ffb35c',
  glow: '#ffd36b',
  candle: '#ffe9a8',
  ghost: '#c9ffe8',
  ghostDeep: '#7fe0bd',
  wood: '#6b4a3a',
  woodLight: '#8e6a52',
  woodDark: '#3e2a24',
  moss: '#5d7a5a'
};

/** Résolution réduite pour les grands fonds (mémoire maîtrisée en 4K). */
const BG_RES = () => Math.min(DISPLAY.TEX, 1.5);

const C = (ctx: CanvasRenderingContext2D) => ctx;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function gothicWindowPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // fenêtre en ogive : rectangle surmonté de deux arcs
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w * 0.6);
  ctx.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15);
  ctx.quadraticCurveTo(x + w, y, x + w, y + w * 0.6);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// ================================================================== CIEL & FORÊT

export function paintNightSky(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, BG_RES());
  const r = rng(1031);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#120d2b');
  g.addColorStop(0.45, '#251b4d');
  g.addColorStop(0.8, '#3b2a5e');
  g.addColorStop(1, '#4f3a6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // étoiles
  for (let i = 0; i < 140; i++) {
    const x = r() * w, y = r() * h * 0.6, s = r() * 1.4 + 0.3;
    ctx.fillStyle = `rgba(255,246,220,${0.3 + r() * 0.6})`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  // pleine lune + halo
  const mx = w * 0.74, my = h * 0.24, mr = 74;
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.4);
  halo.addColorStop(0, 'rgba(255,240,200,0.35)');
  halo.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  const mg = ctx.createRadialGradient(mx - 22, my - 22, 10, mx, my, mr);
  mg.addColorStop(0, '#fffbe8');
  mg.addColorStop(0.7, '#f7e9bd');
  mg.addColorStop(1, '#e8d39a');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(190,170,120,0.35)';
  for (const [dx, dy, s] of [[-20, -10, 14], [18, 20, 10], [26, -24, 7], [-8, 30, 8]]) {
    ctx.beginPath(); ctx.arc(mx + dx, my + dy, s, 0, Math.PI * 2); ctx.fill();
  }
  // nuages effilochés devant la lune
  ctx.fillStyle = 'rgba(70,55,110,0.55)';
  for (let i = 0; i < 4; i++) {
    const cy = my + 30 + i * 46, cx = mx - 260 + i * 90;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath(); ctx.ellipse(cx + k * 50, cy + Math.sin(k) * 6, 70, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

/** Silhouettes d'arbres tortueux (forêt sombre), tuilable horizontalement. */
export function paintForest(w: number, h: number, seed: number, near: boolean): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, BG_RES());
  const r = rng(seed);
  const col = near ? '#191231' : '#2c2150';
  const mist = near ? 'rgba(120,110,170,0.0)' : 'rgba(140,130,190,0.22)';
  ctx.fillStyle = col;
  // sol / sous-bois
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h - (near ? 70 : 110) - Math.sin(x * 0.01 + seed) * 18 - r() * 10);
  ctx.lineTo(w, h);
  ctx.fill();
  const tree = (x: number, base: number, th: number, tw: number) => {
    // tronc qui se tord
    ctx.beginPath();
    ctx.moveTo(x - tw, base);
    ctx.bezierCurveTo(x - tw * 0.6, base - th * 0.4, x + tw * 1.2, base - th * 0.6, x + tw * 0.2, base - th);
    ctx.lineTo(x + tw * 0.5, base - th);
    ctx.bezierCurveTo(x + tw * 1.6, base - th * 0.6, x + tw * 0.4, base - th * 0.4, x + tw, base);
    ctx.fill();
    // branches crochues
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let b = 0; b < 6; b++) {
      const t = 0.35 + r() * 0.6, side = r() > 0.5 ? 1 : -1;
      const bx = x + tw * 0.3, by = base - th * t;
      const len = 30 + r() * th * 0.35;
      ctx.lineWidth = Math.max(1.5, tw * 0.35 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      const ex = bx + side * len, ey = by - len * (0.3 + r() * 0.5);
      ctx.quadraticCurveTo(bx + side * len * 0.4, by + 10, ex, ey);
      ctx.stroke();
      // petite griffe au bout
      ctx.lineWidth = Math.max(1, ctx.lineWidth * 0.5);
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + side * 12, ey - 10); ctx.stroke();
    }
  };
  const n = Math.round(w / (near ? 260 : 170));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.3 + r() * 0.4) * (w / n);
    tree(x, h - (near ? 50 : 90), h * (near ? 0.75 : 0.55) * (0.7 + r() * 0.4), near ? 16 + r() * 10 : 9 + r() * 6);
  }
  // brume
  const mg = ctx.createLinearGradient(0, h * 0.55, 0, h);
  mg.addColorStop(0, 'rgba(140,130,190,0)');
  mg.addColorStop(1, mist);
  ctx.fillStyle = mg;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  return c;
}

/** Façade gothique du manoir (fond de la cour) — la porte est un objet de jeu à part. */
export function paintFacade(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, BG_RES());
  const r = rng(77);
  const base = h;
  // tours et pignons
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(0, 260);
    ctx.lineTo(60, 260); ctx.lineTo(60, 140); ctx.lineTo(100, 40); ctx.lineTo(140, 140); ctx.lineTo(140, 260);
    ctx.lineTo(w * 0.42, 260); ctx.lineTo(w * 0.55, 120); ctx.lineTo(w * 0.68, 260);
    ctx.lineTo(w - 120, 260); ctx.lineTo(w - 120, 90); ctx.lineTo(w - 70, -10); ctx.lineTo(w - 20, 90); ctx.lineTo(w - 20, 260);
    ctx.lineTo(w, 260); ctx.lineTo(w, base);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#4a4670');
  g.addColorStop(1, '#2c2848');
  ctx.fillStyle = g;
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  // appareillage de pierres
  ctx.strokeStyle = 'rgba(20,16,40,0.35)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < h; y += 34) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    for (let x = (y / 34) % 2 ? 0 : 36; x < w; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34); ctx.stroke();
    }
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(10,8,30,0.12)';
    ctx.fillRect(r() * w, r() * h, 30 + r() * 40, 28);
  }
  // clair de lune sur l'arête droite
  const lg = ctx.createLinearGradient(w * 0.5, 0, w, 0);
  lg.addColorStop(0, 'rgba(200,190,255,0)');
  lg.addColorStop(1, 'rgba(200,190,255,0.16)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // fenêtres éclairées
  const win = (x: number, y: number, ww: number, hh: number, lit: boolean) => {
    ctx.fillStyle = '#1a1533';
    gothicWindowPath(ctx, x - 6, y - 6, ww + 12, hh + 10);
    ctx.fill();
    const wg = ctx.createLinearGradient(0, y, 0, y + hh);
    wg.addColorStop(0, lit ? '#ffe7a0' : '#3a3460');
    wg.addColorStop(1, lit ? '#f2a64a' : '#272247');
    ctx.fillStyle = wg;
    gothicWindowPath(ctx, x, y, ww, hh);
    ctx.fill();
    ctx.strokeStyle = '#1a1533';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + ww / 2, y - ww * 0.1); ctx.lineTo(x + ww / 2, y + hh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + hh * 0.5); ctx.lineTo(x + ww, y + hh * 0.5); ctx.stroke();
    if (lit) {
      const glow = ctx.createRadialGradient(x + ww / 2, y + hh / 2, 4, x + ww / 2, y + hh / 2, ww * 1.6);
      glow.addColorStop(0, 'rgba(255,200,100,0.35)');
      glow.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - ww * 1.5, y - ww, ww * 4, hh + ww * 2);
    }
  };
  win(84, 170, 32, 60, true);
  win(w * 0.55 - 26, 170, 52, 80, true);
  win(w - 92, 120, 36, 70, false);
  for (let i = 0; i < 4; i++) win(40 + i * (w - 140) / 3, 330, 40, 74, i % 3 !== 1);
  // lierre
  ctx.fillStyle = '#2f4a3a';
  for (let i = 0; i < 160; i++) {
    const t = r();
    const x = 20 + t * 100 + Math.sin(t * 12) * 20, y = base - t * 420;
    ctx.beginPath(); ctx.ellipse(x + r() * 20, y, 7, 4, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// ================================================================== MURS INTÉRIEURS

export type RoomKind = 'hall' | 'gallery' | 'shadows' | 'corridor' | 'ante' | 'ballroom' | 'small';

/** Panneau de mur intérieur (tuile 640 × h), de la plinthe au plafond. */
export function paintRoomWall(kind: RoomKind, w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, BG_RES());
  const r = rng(seed);
  const pal: Record<RoomKind, [string, string, string]> = {
    hall: ['#3c2c55', '#2b1f40', '#5a4378'],
    gallery: ['#4a2440', '#33182d', '#6d3a5c'],
    shadows: ['#24243e', '#17172b', '#34345a'],
    corridor: ['#2a2238', '#1b1626', '#3d3150'],
    ante: ['#2e2a46', '#1e1b31', '#45406a'],
    ballroom: ['#33284e', '#221a36', '#4e3f73'],
    small: ['#35294c', '#241c36', '#4f3e6c']
  };
  const [a, b, hi] = pal[kind];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, b);
  g.addColorStop(0.5, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (kind === 'shadows' || kind === 'ante' || kind === 'corridor') {
    // pierre de taille
    ctx.strokeStyle = 'rgba(8,6,20,0.45)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = (y / 48) % 2 ? 0 : 50; x < w; x += 100) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 48); ctx.stroke(); }
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(Math.floor(r() * 7) * 100 + (r() > 0.5 ? 50 : 0), Math.floor(r() * h / 48) * 48, 98, 46);
    }
  } else {
    // papier peint damassé
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.22;
    for (let y = 20; y < h; y += 70) {
      for (let x = ((y / 70) % 2) * 40; x < w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.quadraticCurveTo(x + 14, y - 4, x, y + 18);
        ctx.quadraticCurveTo(x - 14, y - 4, x, y - 18);
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // lambris
    const wy = h - 300;
    const wg = ctx.createLinearGradient(0, wy, 0, h);
    wg.addColorStop(0, '#4a3328');
    wg.addColorStop(1, '#2c1d18');
    ctx.fillStyle = wg;
    ctx.fillRect(0, wy, w, h - wy);
    ctx.fillStyle = '#6b4a3a';
    ctx.fillRect(0, wy - 8, w, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let x = 20; x < w; x += 106) { rr(ctx, x, wy + 24, 86, 120, 6); ctx.stroke(); }
  }
  // corniche + plafond sombre
  const cg = ctx.createLinearGradient(0, 0, 0, 120);
  cg.addColorStop(0, 'rgba(8,6,18,0.95)');
  cg.addColorStop(1, 'rgba(8,6,18,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, w, 120);
  ctx.fillStyle = 'rgba(255,240,210,0.08)';
  ctx.fillRect(0, 96, w, 4);
  // toiles d'araignée dans un coin
  if (r() > 0.4) {
    ctx.strokeStyle = 'rgba(220,220,240,0.22)';
    ctx.lineWidth = 1;
    const cx = r() > 0.5 ? 0 : w;
    const dir = cx === 0 ? 1 : -1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath(); ctx.moveTo(cx, 100); ctx.lineTo(cx + dir * Math.cos(k * 0.3) * 90, 100 + Math.sin(k * 0.3) * 90); ctx.stroke();
    }
    for (let ring = 1; ring < 5; ring++) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const px = cx + dir * Math.cos(k * 0.3) * ring * 20, py = 100 + Math.sin(k * 0.3) * ring * 20;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  return c;
}

/** Fenêtre gothique intérieure donnant sur la nuit (lune rasante). */
export function paintInteriorWindow(w: number, h: number, moon: boolean): HTMLCanvasElement {
  const [c, ctx] = canvas(w + 24, h + 40);
  const x = 12, y = 30;
  ctx.fillStyle = '#1a1424';
  gothicWindowPath(ctx, x - 10, y - 8, w + 20, h + 14);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#1d2350');
  g.addColorStop(1, '#3e3a78');
  ctx.fillStyle = g;
  gothicWindowPath(ctx, x, y, w, h);
  ctx.fill();
  if (moon) {
    ctx.save();
    gothicWindowPath(ctx, x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#f7ecc4';
    ctx.beginPath(); ctx.arc(x + w * 0.7, y + h * 0.3, w * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16122e';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i <= 8; i++) ctx.lineTo(x + (i / 8) * w, y + h * 0.75 - Math.abs(Math.sin(i * 1.7)) * h * 0.18);
    ctx.lineTo(x + w, y + h);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#120e1e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y - w * 0.12); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, y + (h * k) / 4); ctx.lineTo(x + w, y + (h * k) / 4); ctx.stroke(); }
  // rebord
  ctx.fillStyle = '#5b5674';
  rr(ctx, x - 14, y + h, w + 28, 12, 4);
  ctx.fill();
  return c;
}

// ================================================================== TERRAINS

/**
 * Terrains du manoir. Même convention que paintBed : canevas (w + 16) × (h + GRASS_PAD),
 * la surface de marche est à y = GRASS_PAD.
 */
export function paintManorTerrain(style: string, w: number, h: number, seed: number): HTMLCanvasElement {
  const pad = GRASS_PAD;
  const [c, ctx] = canvas(w + 16, h + pad);
  const r = rng(seed);
  const ox = 8;
  const deep = (from: number) => {
    const d = ctx.createLinearGradient(0, pad + from, 0, pad + from + 260);
    d.addColorStop(0, 'rgba(12,8,24,0)');
    d.addColorStop(1, 'rgba(12,8,24,0.85)');
    ctx.fillStyle = d;
    ctx.fillRect(ox, pad + from, w, h);
  };
  if (style === 'floor') {
    // parquet sur maçonnerie
    ctx.fillStyle = '#2c2238';
    rr(ctx, ox, pad, w, h, [6, 6, 2, 2]);
    ctx.fill();
    ctx.save();
    rr(ctx, ox, pad, w, h, [6, 6, 2, 2]);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let y = pad + 40; y < pad + h; y += 36) {
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); ctx.stroke();
      for (let x = ox + ((y / 36) % 2) * 40; x < ox + w; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 36); ctx.stroke(); }
    }
    deep(30);
    ctx.restore();
    // lames de parquet (le dessus, bien lisible)
    const pg = ctx.createLinearGradient(0, pad - 6, 0, pad + 20);
    pg.addColorStop(0, '#a77d5c');
    pg.addColorStop(1, '#6b4a3a');
    ctx.fillStyle = pg;
    rr(ctx, ox - 4, pad - 6, w + 8, 24, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,18,0.55)';
    ctx.lineWidth = 1.5;
    for (let x = ox + 20 + r() * 30; x < ox + w; x += 60 + r() * 50) { ctx.beginPath(); ctx.moveTo(x, pad - 5); ctx.lineTo(x, pad + 17); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,230,190,0.35)';
    ctx.fillRect(ox - 2, pad - 5, w + 4, 2.5);
    // tapis usé (une bande pourpre par endroits)
    if (w > 300) {
      ctx.fillStyle = 'rgba(120,30,60,0.55)';
      const tx = ox + 40 + r() * (w - 280);
      rr(ctx, tx, pad - 7, Math.min(220, w - 80), 7, 3);
      ctx.fill();
    }
    return c;
  }
  if (style === 'wall') {
    const g = ctx.createLinearGradient(0, pad, 0, pad + h);
    g.addColorStop(0, '#5a5f7c');
    g.addColorStop(1, '#2e3150');
    ctx.fillStyle = g;
    rr(ctx, ox, pad, w, h, 4);
    ctx.fill();
    ctx.save();
    rr(ctx, ox, pad, w, h, 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(10,8,28,0.5)';
    ctx.lineWidth = 2;
    for (let y = pad; y < pad + h; y += 30) {
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); ctx.stroke();
      for (let x = ox + (((y - pad) / 30) % 2) * 22; x < ox + w; x += 44) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(ox, pad, 4, h);
    ctx.restore();
    return c;
  }
  // 'stone' : pavés extérieurs avec mousse
  const g = ctx.createLinearGradient(0, pad, 0, pad + Math.min(h, 400));
  g.addColorStop(0, '#4b4466');
  g.addColorStop(1, '#231d3a');
  ctx.fillStyle = g;
  rr(ctx, ox, pad, w, h, [12, 12, 4, 4]);
  ctx.fill();
  ctx.save();
  rr(ctx, ox, pad, w, h, [12, 12, 4, 4]);
  ctx.clip();
  for (let i = 0; i < (w * Math.min(h, 260)) / 1600; i++) {
    const x = ox + r() * w, y = pad + 26 + r() * Math.min(h - 30, 240);
    const rx = 12 + r() * 16, ry = rx * 0.6;
    ctx.fillStyle = `rgba(${120 + r() * 40},${120 + r() * 30},${160 + r() * 30},0.35)`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  deep(50);
  ctx.restore();
  // pavés du dessus
  for (let x = ox; x < ox + w; x += 34 + r() * 10) {
    const pw = 30 + r() * 10;
    const sg = ctx.createLinearGradient(0, pad - 8, 0, pad + 14);
    sg.addColorStop(0, '#a6a3bd');
    sg.addColorStop(1, '#5e5a7c');
    ctx.fillStyle = sg;
    rr(ctx, x, pad - 7 + r() * 3, Math.min(pw, ox + w - x), 18, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 4, pad - 5, Math.min(pw, ox + w - x) - 8, 2);
  }
  // mousse et herbes sèches
  for (let i = 0; i < w / 18; i++) {
    const x = ox + r() * w;
    ctx.fillStyle = r() > 0.5 ? '#4f6b55' : '#6a5a3a';
    ctx.beginPath(); ctx.ellipse(x, pad - 6, 6 + r() * 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (r() > 0.6) {
      ctx.strokeStyle = '#8a7a4a';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, pad - 6); ctx.lineTo(x + (r() - 0.5) * 6, pad - 16 - r() * 8); ctx.stroke();
    }
  }
  return C(ctx).canvas;
}

/** Fosse à pointes de fer (danger lisible : métal clair sur fond très sombre). */
export function paintSpikes(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(20,14,40,0)');
  g.addColorStop(0.3, 'rgba(20,14,40,0.92)');
  g.addColorStop(1, '#0c0818');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const row = (y: number, sc: number, alpha: number) => {
    for (let x = -4; x < w; x += 18 * sc) {
      const hh = (34 + r() * 14) * sc;
      const sg = ctx.createLinearGradient(x, 0, x + 14 * sc, 0);
      sg.addColorStop(0, `rgba(170,175,205,${alpha})`);
      sg.addColorStop(1, `rgba(70,70,100,${alpha})`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7 * sc, y - hh);
      ctx.lineTo(x + 14 * sc, y);
      ctx.fill();
    }
  };
  row(56, 0.8, 0.55);
  row(70, 1, 0.95);
  ctx.fillStyle = '#2b2440';
  ctx.fillRect(0, 70, w, 8);
  return c;
}

// ================================================================== ACCESSOIRES

/** Citrouille (sans visage : les yeux sont animés à part). */
export function paintPumpkin(rad: number, seed: number, crown = false): HTMLCanvasElement {
  const W = rad * 2 + 24, H = rad * 2 + (crown ? rad * 0.9 : 30);
  const [c, ctx] = canvas(W, H);
  const r = rng(seed);
  const cx = W / 2, cy = H - rad - 4;
  ctx.fillStyle = 'rgba(10,6,20,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, cy + rad * 0.92, rad * 0.9, rad * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  // côtes
  const ribs = 5;
  for (let i = 0; i < ribs; i++) {
    const t = (i - (ribs - 1) / 2) / ((ribs - 1) / 2);
    const rx = rad * (0.5 - Math.abs(t) * 0.12), x = cx + t * rad * 0.52;
    const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, NIGHT.pumpkinDark);
    g.addColorStop(0.45, i === 2 ? NIGHT.pumpkinLight : NIGHT.pumpkin);
    g.addColorStop(1, NIGHT.pumpkinDark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, cy, rx, rad * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,40,10,0.45)';
  ctx.lineWidth = Math.max(1.5, rad * 0.04);
  for (let i = 0; i < ribs - 1; i++) {
    const x = cx + (-0.5 + i / (ribs - 2)) * rad * 0.9;
    ctx.beginPath(); ctx.ellipse(x, cy, rad * 0.06, rad * 0.86, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // reflet de lune
  ctx.fillStyle = 'rgba(255,240,220,0.35)';
  ctx.beginPath(); ctx.ellipse(cx - rad * 0.45, cy - rad * 0.45, rad * 0.16, rad * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
  // tige + feuille
  ctx.fillStyle = '#4f6b3a';
  ctx.beginPath();
  ctx.moveTo(cx - rad * 0.08, cy - rad * 0.82);
  ctx.quadraticCurveTo(cx - rad * 0.02, cy - rad * 1.12, cx + rad * 0.16, cy - rad * 1.14);
  ctx.lineTo(cx + rad * 0.14, cy - rad * 1.02);
  ctx.quadraticCurveTo(cx + rad * 0.06, cy - rad * 0.98, cx + rad * 0.08, cy - rad * 0.8);
  ctx.fill();
  ctx.fillStyle = '#6f8f4a';
  ctx.beginPath(); ctx.ellipse(cx - rad * 0.28, cy - rad * 0.9, rad * 0.22, rad * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
  if (crown) {
    const ky = cy - rad * 1.02;
    const kw = rad * 0.9;
    const kg = ctx.createLinearGradient(0, ky - rad * 0.55, 0, ky);
    kg.addColorStop(0, '#fff1a8');
    kg.addColorStop(1, '#d9a23a');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.moveTo(cx - kw / 2, ky);
    ctx.lineTo(cx - kw / 2, ky - rad * 0.35);
    ctx.lineTo(cx - kw / 4, ky - rad * 0.18);
    ctx.lineTo(cx, ky - rad * 0.55);
    ctx.lineTo(cx + kw / 4, ky - rad * 0.18);
    ctx.lineTo(cx + kw / 2, ky - rad * 0.35);
    ctx.lineTo(cx + kw / 2, ky);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [dx, col] of [[-0.25, '#7fe0bd'], [0, '#e8846b'], [0.25, '#9a7ad6']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx + dx * kw, ky - rad * 0.08, rad * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  }
  void r;
  return c;
}

/** Fantôme (corps ondulé translucide). */
export function paintGhost(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w + 20, h + 20);
  const x0 = 10, y0 = 10;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, 'rgba(235,255,248,0.98)');
  g.addColorStop(0.7, 'rgba(190,250,226,0.9)');
  g.addColorStop(1, 'rgba(127,224,189,0.15)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h * 0.45);
  ctx.quadraticCurveTo(x0, y0, x0 + w / 2, y0);
  ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + h * 0.45);
  ctx.lineTo(x0 + w, y0 + h * 0.85);
  for (let i = 0; i < 4; i++) {
    const xa = x0 + w - (i + 0.5) * (w / 4);
    ctx.quadraticCurveTo(xa, y0 + h * (i % 2 ? 1.02 : 0.78), x0 + w - (i + 1) * (w / 4), y0 + h * 0.9);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,190,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(x0 + w * 0.3, y0 + h * 0.2, w * 0.1, h * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
  return c;
}

/** Lustre en fer forgé (sans flammes : elles sont animées). */
export function paintChandelier(w: number): HTMLCanvasElement {
  const h = 70;
  const [c, ctx] = canvas(w + 20, h);
  const cx = (w + 20) / 2;
  ctx.strokeStyle = '#2a2236';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(cx, 42, w / 2, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8f7a5a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, 41, w / 2, 9, 0, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#2a2236';
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx, 6); ctx.quadraticCurveTo(cx + i * w * 0.12, 20, cx + i * w * 0.22, 40); ctx.stroke(); }
  ctx.fillStyle = '#2a2236';
  ctx.beginPath(); ctx.arc(cx, 8, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 6, 52); ctx.lineTo(cx, 66); ctx.lineTo(cx + 6, 52); ctx.fill();
  // bougies
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * w * 0.21;
    ctx.fillStyle = NIGHT.candle;
    rr(ctx, x - 4, 20, 8, 20, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,160,90,0.6)';
    ctx.fillRect(x + 1, 20, 3, 20);
  }
  return c;
}

/** Cadre doré (le contenu du tableau est dessiné à part). */
export function paintFrame(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w + 24, h + 24);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#f2d27a');
  g.addColorStop(0.5, '#b98a32');
  g.addColorStop(1, '#7a5418');
  ctx.fillStyle = g;
  rr(ctx, 0, 0, w + 24, h + 24, 6);
  ctx.fill();
  ctx.clearRect(12, 12, w, h);
  ctx.strokeStyle = 'rgba(60,30,10,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, w, h);
  ctx.strokeStyle = 'rgba(255,240,200,0.6)';
  ctx.strokeRect(5, 5, w + 14, h + 14);
  for (const [x, y] of [[0, 0], [w + 24, 0], [0, h + 24], [w + 24, h + 24]]) {
    ctx.fillStyle = '#f7e08a';
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Portrait d'un vieux noble (yeux dessinés à part pour qu'ils bougent). */
export function paintPortraitNoble(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const bg = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, h * 0.8);
  bg.addColorStop(0, '#5a4a3a');
  bg.addColorStop(1, '#231a16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // buste
  ctx.fillStyle = '#2c2a4a';
  ctx.beginPath(); ctx.ellipse(w / 2, h * 1.02, w * 0.48, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4eee2';
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.7); ctx.lineTo(w / 2, h * 0.86); ctx.lineTo(w * 0.6, h * 0.7); ctx.fill();
  // visage
  ctx.fillStyle = '#e8c8a8';
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.45, w * 0.24, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  // perruque poudrée
  ctx.fillStyle = '#e6e2f0';
  for (const [dx, dy, s] of [[-0.24, 0.32, 0.12], [0.24, 0.32, 0.12], [-0.26, 0.48, 0.1], [0.26, 0.48, 0.1], [0, 0.22, 0.2]]) {
    ctx.beginPath(); ctx.ellipse(w / 2 + dx * w, h * dy, s * w, s * w * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  // orbites (les yeux sont animés)
  ctx.fillStyle = '#fbf6ea';
  ctx.beginPath(); ctx.ellipse(w * 0.41, h * 0.45, w * 0.06, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.59, h * 0.45, w * 0.06, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  // moustache sévère
  ctx.strokeStyle = '#6b5a4a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.58); ctx.quadraticCurveTo(w / 2, h * 0.54, w * 0.6, h * 0.58); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,210,0.08)';
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Bibliothèque pleine de livres (les livres animés sont à part). */
export function paintBookcase(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  ctx.fillStyle = '#3e2a24';
  rr(ctx, 0, 0, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#5a3d30';
  ctx.fillRect(0, 0, w, 18);
  const cols = ['#8a2d3b', '#2d5a7a', '#5a7a3a', '#7a5a2d', '#4a3a7a', '#a0703a', '#2f6b5e'];
  for (let y = 26; y < h - 20; y += 70) {
    ctx.fillStyle = '#21150f';
    ctx.fillRect(8, y, w - 16, 60);
    let x = 10;
    while (x < w - 18) {
      const bw = 8 + r() * 12, bh = 36 + r() * 22;
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      const tilt = r() > 0.9;
      if (tilt) { ctx.save(); ctx.translate(x, y + 60); ctx.rotate(-0.2); ctx.fillRect(0, -bh, bw, bh); ctx.restore(); }
      else ctx.fillRect(x, y + 60 - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,230,160,0.4)';
      ctx.fillRect(x + 2, y + 60 - bh + 6, bw - 4, 2);
      x += bw + 1;
    }
    ctx.fillStyle = '#5a3d30';
    ctx.fillRect(4, y + 60, w - 8, 10);
  }
  return c;
}

/** Monstre peureux : grosse boule de poils violette, petites cornes, longs bras. */
export function paintMonster(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(404);
  const cx = w / 2;
  ctx.fillStyle = 'rgba(8,6,20,0.3)';
  ctx.beginPath(); ctx.ellipse(cx, h - 8, w * 0.38, 10, 0, 0, Math.PI * 2); ctx.fill();
  // cornes
  ctx.fillStyle = '#e8dcc0';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * w * 0.18, h * 0.2);
    ctx.quadraticCurveTo(cx + s * w * 0.32, h * 0.04, cx + s * w * 0.26, 0);
    ctx.quadraticCurveTo(cx + s * w * 0.24, h * 0.1, cx + s * w * 0.1, h * 0.22);
    ctx.fill();
  }
  // corps poilu
  const g = ctx.createRadialGradient(cx - w * 0.12, h * 0.4, 10, cx, h * 0.55, h * 0.6);
  g.addColorStop(0, '#8a62c4');
  g.addColorStop(1, '#3b2468');
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = (i % 2 ? 1 : 0.93) * (0.45 + r() * 0.02);
    const x = cx + Math.cos(a) * w * rad, y = h * 0.56 + Math.sin(a) * h * 0.44;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.fill();
  // ventre plus clair
  ctx.fillStyle = 'rgba(200,170,240,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, h * 0.72, w * 0.22, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  // pieds
  ctx.fillStyle = '#2c1a50';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * w * 0.2, h - 14, w * 0.12, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  return c;
}

/** Roi Citrouille : citrouille géante (visage animé à part), couronne fournie séparément. */
export function paintBossBody(rad: number): HTMLCanvasElement {
  return paintPumpkin(rad, 9, false);
}

export function paintCrown(w: number): HTMLCanvasElement {
  const h = w * 0.6;
  const [c, ctx] = canvas(w + 8, h + 8);
  const kg = ctx.createLinearGradient(0, 0, 0, h);
  kg.addColorStop(0, '#fff1a8');
  kg.addColorStop(1, '#d9a23a');
  ctx.fillStyle = kg;
  ctx.beginPath();
  ctx.moveTo(4, h + 4);
  ctx.lineTo(4, h * 0.35);
  ctx.lineTo(w * 0.27, h * 0.65);
  ctx.lineTo(w / 2 + 4, 4);
  ctx.lineTo(w * 0.77, h * 0.65);
  ctx.lineTo(w + 4, h * 0.35);
  ctx.lineTo(w + 4, h + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a5a1a';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (const [dx, col] of [[0.25, '#7fe0bd'], [0.5, '#e8846b'], [0.75, '#9a7ad6']] as const) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(4 + dx * w, h * 0.82, w * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Grand rideau de velours (salle de bal). */
export function paintCurtain(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * w, fw = w / 9;
    const g = ctx.createLinearGradient(x, 0, x + fw, 0);
    g.addColorStop(0, '#4a1028');
    g.addColorStop(0.5, '#9a2a4a');
    g.addColorStop(1, '#4a1028');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, fw + 1, h);
  }
  ctx.fillStyle = '#d9a23a';
  for (let x = 6; x < w; x += 18) { ctx.beginPath(); ctx.arc(x, h - 6, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w, 14);
  return c;
}

/** Trône (dossier gothique). */
export function paintThrone(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#3b1f3a';
  gothicWindowPath(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.88);
  ctx.fill();
  ctx.strokeStyle = '#d9a23a';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#7a2a4a';
  gothicWindowPath(ctx, w * 0.24, h * 0.26, w * 0.52, h * 0.6);
  ctx.fill();
  return c;
}

/** Statue de chevalier en pierre (le bras levé devient une marche quand elle pivote). */
export function paintStatue(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#5c6280');
  g.addColorStop(0.5, '#a3a9c0');
  g.addColorStop(1, '#4a4f6c');
  ctx.fillStyle = '#3d4260';
  rr(ctx, w * 0.1, h - 40, w * 0.8, 40, 4);
  ctx.fill();
  ctx.fillStyle = g;
  // corps
  rr(ctx, w * 0.3, h * 0.32, w * 0.4, h * 0.5, 10);
  ctx.fill();
  // tête casquée
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.24, w * 0.16, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3048';
  ctx.fillRect(w * 0.38, h * 0.23, w * 0.24, 4);
  // jambes
  ctx.fillStyle = g;
  rr(ctx, w * 0.32, h * 0.78, w * 0.14, h * 0.14, 4); ctx.fill();
  rr(ctx, w * 0.54, h * 0.78, w * 0.14, h * 0.14, 4); ctx.fill();
  // bouclier
  ctx.fillStyle = '#7a8098';
  ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.42); ctx.lineTo(w * 0.42, h * 0.42); ctx.lineTo(w * 0.33, h * 0.66); ctx.fill();
  return c;
}

/** Armoire minuscule (le monstre s'y cache). */
export function paintWardrobe(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#4a3328';
  rr(ctx, 0, 6, w, h - 6, 6);
  ctx.fill();
  ctx.fillStyle = '#6b4a3a';
  rr(ctx, -2, 0, w + 4, 12, 4);
  ctx.fill();
  ctx.strokeStyle = '#2c1d18';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 16, w / 2 - 7, h - 26);
  ctx.strokeRect(w / 2 + 2, 16, w / 2 - 7, h - 26);
  ctx.fillStyle = '#d9a23a';
  ctx.beginPath(); ctx.arc(w / 2 - 6, h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w / 2 + 6, h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
  return c;
}

/** Petite table ronde de salon. */
export function paintTable(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#6b4a3a';
  rr(ctx, 0, 0, w, 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.3)';
  ctx.fillRect(4, 2, w - 8, 3);
  ctx.fillStyle = '#4a3328';
  ctx.fillRect(w * 0.15, 14, 8, h - 14);
  ctx.fillRect(w * 0.85 - 8, 14, 8, h - 14);
  ctx.fillStyle = '#ffe9a8';
  rr(ctx, w / 2 - 4, -16, 8, 16, 2);
  ctx.fill();
  return c;
}

/** Les trois portes de l'antichambre. */
export function paintDoor(kind: 'exit' | 'plain' | 'scratched', w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w + 40, h + 30);
  const x0 = 20, y0 = 30;
  // encadrement de pierre
  ctx.fillStyle = '#4a4670';
  gothicWindowPath(ctx, x0 - 14, y0 - 10, w + 28, h + 10);
  ctx.fill();
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  if (kind === 'exit') { g.addColorStop(0, '#7a4a2a'); g.addColorStop(1, '#a8703a'); }
  else if (kind === 'plain') { g.addColorStop(0, '#4a3328'); g.addColorStop(1, '#6b4a3a'); }
  else { g.addColorStop(0, '#2c1d24'); g.addColorStop(1, '#4a2a34'); }
  ctx.fillStyle = g;
  gothicWindowPath(ctx, x0, y0, w, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let x = x0 + w / 4; x < x0 + w; x += w / 4) { ctx.beginPath(); ctx.moveTo(x, y0 + 10); ctx.lineTo(x, y0 + h); ctx.stroke(); }
  // ferrures
  ctx.fillStyle = '#2a2236';
  ctx.fillRect(x0, y0 + h * 0.3, w, 6);
  ctx.fillRect(x0, y0 + h * 0.75, w, 6);
  ctx.fillStyle = '#d9a23a';
  ctx.beginPath(); ctx.arc(x0 + w * 0.8, y0 + h * 0.55, 5, 0, Math.PI * 2); ctx.fill();
  if (kind === 'exit') {
    // guirlande de fanions accueillante
    const cols = ['#f28c38', '#7fe0bd', '#f7d774', '#e8846b'];
    for (let i = 0; i < 7; i++) {
      const fx = x0 - 10 + i * ((w + 20) / 6), fy = y0 + 8 + Math.sin((i / 6) * Math.PI) * 14;
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath(); ctx.moveTo(fx - 7, fy); ctx.lineTo(fx + 7, fy); ctx.lineTo(fx, fy + 14); ctx.fill();
    }
  }
  if (kind === 'scratched') {
    // griffures à la base
    ctx.strokeStyle = 'rgba(255,230,200,0.55)';
    ctx.lineWidth = 2.5;
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 3; i++) {
        const sx = x0 + 14 + k * (w - 50) + i * 8;
        ctx.beginPath(); ctx.moveTo(sx, y0 + h - 50); ctx.lineTo(sx + 10, y0 + h - 8); ctx.stroke();
      }
    }
  }
  return c;
}

/** Panneau « SORTIE » lumineux (un peu trop engageant). */
export function paintExitSign(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#2a1a10';
  rr(ctx, 0, 0, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffd36b';
  ctx.lineWidth = 3;
  rr(ctx, 4, 4, w - 8, h - 8, 6);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `600 ${Math.round(h * 0.5)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SORTIE', w / 2, h / 2 + 1);
  return c;
}

/** Araignée suspendue (yeux animés à part). */
export function paintSpider(s: number): HTMLCanvasElement {
  const [c, ctx] = canvas(s * 2.6, s * 2);
  const cx = s * 1.3, cy = s;
  ctx.strokeStyle = '#1a1533';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const kx = cx + side * s * 0.8, ky = cy + Math.sin(a) * s * 0.6 - s * 0.3;
      ctx.quadraticCurveTo(kx, ky - s * 0.4, cx + side * s * 1.2, cy + Math.sin(a) * s * 0.8 + s * 0.3);
      ctx.stroke();
    }
  }
  const g = ctx.createRadialGradient(cx - s * 0.2, cy - s * 0.2, 2, cx, cy, s * 0.6);
  g.addColorStop(0, '#5a4a7a');
  g.addColorStop(1, '#1a1533');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.55, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  return c;
}

/** Chapeau de sorcière (récompense). */
export function paintWitchHat(s: number): HTMLCanvasElement {
  const [c, ctx] = canvas(s * 2, s * 1.6);
  const cx = s;
  ctx.fillStyle = '#2c1f4a';
  ctx.beginPath(); ctx.ellipse(cx, s * 1.35, s * 0.95, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(cx - s * 0.4, 0, cx + s * 0.4, 0);
  g.addColorStop(0, '#3b2a5e');
  g.addColorStop(1, '#5a4290');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.48, s * 1.32);
  ctx.quadraticCurveTo(cx - s * 0.1, s * 0.6, cx + s * 0.45, s * 0.05);
  ctx.quadraticCurveTo(cx + s * 0.12, s * 0.6, cx + s * 0.48, s * 1.32);
  ctx.fill();
  ctx.fillStyle = NIGHT.pumpkin;
  ctx.fillRect(cx - s * 0.47, s * 1.08, s * 0.94, s * 0.16);
  ctx.fillStyle = '#ffd36b';
  rr(ctx, cx - s * 0.1, s * 1.06, s * 0.2, s * 0.2, 3);
  ctx.fill();
  return c;
}

/** Bonbon emballé (bonus de la porte B). */
export function paintCandy(s: number): HTMLCanvasElement {
  const [c, ctx] = canvas(s * 3, s * 1.6);
  const cx = s * 1.5, cy = s * 0.8;
  ctx.fillStyle = '#f28c38';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.5, cy); ctx.lineTo(cx + sd * s * 1.4, cy - s * 0.55); ctx.lineTo(cx + sd * s * 1.4, cy + s * 0.55); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx - s * 0.2, cy - s * 0.2, 2, cx, cy, s * 0.7);
  g.addColorStop(0, '#ffe0a0');
  g.addColorStop(1, '#e8846b');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.62, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9a2a4a';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s * 0.25 - 6, cy - s * 0.5); ctx.lineTo(cx + i * s * 0.25 + 6, cy + s * 0.5); ctx.stroke(); }
  return c;
}

/** Grille de fer (cour et couloir interdit). */
export function paintGrate(w: number, h: number, spikes = true): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h + 20);
  ctx.strokeStyle = '#1a1533';
  ctx.lineWidth = 6;
  for (let x = 6; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, h + 20); ctx.stroke(); }
  ctx.strokeStyle = '#4a4670';
  ctx.lineWidth = 2;
  for (let x = 6; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x - 1.5, 22); ctx.lineTo(x - 1.5, h + 18); ctx.stroke(); }
  ctx.fillStyle = '#1a1533';
  ctx.fillRect(0, 40, w, 8);
  ctx.fillRect(0, h - 20, w, 8);
  if (spikes) for (let x = 6; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x - 6, 22); ctx.lineTo(x, 4); ctx.lineTo(x + 6, 22); ctx.fill(); }
  return c;
}

/** Horloge comtoise (décor animé : le balancier est à part). */
export function paintClock(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#4a3328';
  rr(ctx, w * 0.15, h * 0.2, w * 0.7, h * 0.8, 6);
  ctx.fill();
  ctx.fillStyle = '#6b4a3a';
  gothicWindowPath(ctx, 0, h * 0.06, w, h * 0.26);
  ctx.fill();
  ctx.fillStyle = '#f4eee2';
  ctx.beginPath(); ctx.arc(w / 2, h * 0.2, w * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#24306a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * w * 0.26, h * 0.2 + Math.sin(a) * w * 0.26); ctx.lineTo(w / 2 + Math.cos(a) * w * 0.3, h * 0.2 + Math.sin(a) * w * 0.3); ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.2); ctx.lineTo(w / 2, h * 0.2 - w * 0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.2); ctx.lineTo(w / 2 + w * 0.15, h * 0.2 + w * 0.05); ctx.stroke();
  ctx.fillStyle = '#1a1424';
  rr(ctx, w * 0.3, h * 0.42, w * 0.4, h * 0.46, 6);
  ctx.fill();
  return c;
}

/** Illustration de la carte du menu (le manoir sous la lune). */
export function paintManorCard(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a1340');
  g.addColorStop(1, '#4a2f6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff3c8';
  ctx.beginPath(); ctx.arc(w * 0.78, h * 0.3, h * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,243,200,0.16)';
  ctx.beginPath(); ctx.arc(w * 0.78, h * 0.3, h * 0.3, 0, Math.PI * 2); ctx.fill();
  // manoir
  ctx.fillStyle = '#120d26';
  ctx.beginPath();
  const b = h * 0.86;
  ctx.moveTo(w * 0.18, b); ctx.lineTo(w * 0.18, h * 0.5); ctx.lineTo(w * 0.26, h * 0.22); ctx.lineTo(w * 0.34, h * 0.5);
  ctx.lineTo(w * 0.42, h * 0.5); ctx.lineTo(w * 0.5, h * 0.32); ctx.lineTo(w * 0.58, h * 0.5); ctx.lineTo(w * 0.66, h * 0.5);
  ctx.lineTo(w * 0.66, b);
  ctx.fill();
  ctx.fillStyle = '#ffcf6b';
  for (const [x, y] of [[0.24, 0.56], [0.3, 0.56], [0.47, 0.6], [0.53, 0.6], [0.6, 0.68]]) {
    ctx.fillRect(w * x, h * y, w * 0.025, h * 0.07);
  }
  // sol + citrouilles
  ctx.fillStyle = '#0c0818';
  ctx.fillRect(0, b, w, h - b);
  for (const [x, s] of [[0.1, 0.07], [0.78, 0.09], [0.88, 0.06]]) {
    ctx.fillStyle = NIGHT.pumpkin;
    ctx.beginPath(); ctx.ellipse(w * x, b - h * s * 0.6, h * s, h * s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.moveTo(w * x - h * s * 0.4, b - h * s * 0.8); ctx.lineTo(w * x - h * s * 0.15, b - h * s * 0.8); ctx.lineTo(w * x - h * s * 0.27, b - h * s * 0.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * x + h * s * 0.15, b - h * s * 0.8); ctx.lineTo(w * x + h * s * 0.4, b - h * s * 0.8); ctx.lineTo(w * x + h * s * 0.27, b - h * s * 0.5); ctx.fill();
  }
  // chauves-souris
  ctx.fillStyle = '#0c0818';
  for (const [x, y, s] of [[0.62, 0.18, 1], [0.7, 0.12, 0.7], [0.4, 0.14, 0.8]]) {
    const bx = w * x, by = h * y, k = 8 * s;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - k, by - k, bx - 2 * k, by); ctx.quadraticCurveTo(bx - k, by - k * 0.3, bx, by + k * 0.4);
    ctx.quadraticCurveTo(bx + k, by - k * 0.3, bx + 2 * k, by); ctx.quadraticCurveTo(bx + k, by - k, bx, by); ctx.fill();
  }
  return c;
}

/** Plaque de brume (dégradé horizontal doux). */
export function paintMist(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, 1);
  const r = rng(55);
  for (let i = 0; i < 18; i++) {
    const x = r() * w, y = h * (0.4 + r() * 0.5), rx = 80 + r() * 160, ry = 18 + r() * 24;
    const g = ctx.createRadialGradient(x, y, 4, x, y, rx);
    g.addColorStop(0, 'rgba(190,185,230,0.22)');
    g.addColorStop(1, 'rgba(190,185,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Obscurité avec un trou de lumière doux au centre (suit le héros). */
export function paintDarkness(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h, 0.5);
  const g = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 340);
  g.addColorStop(0, 'rgba(8,5,20,0)');
  g.addColorStop(0.6, 'rgba(8,5,20,0.55)');
  g.addColorStop(1, 'rgba(8,5,20,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Chauve-souris (une image, les ailes sont animées par l'échelle). */
export function paintBat(s: number): HTMLCanvasElement {
  const [c, ctx] = canvas(s * 4, s * 2);
  const cx = s * 2, cy = s;
  ctx.fillStyle = '#120d26';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx - s, cy - s, cx - s * 2, cy - s * 0.2);
  ctx.quadraticCurveTo(cx - s * 1.5, cy, cx - s * 1.2, cy + s * 0.4);
  ctx.quadraticCurveTo(cx - s * 0.8, cy + s * 0.1, cx - s * 0.4, cy + s * 0.5);
  ctx.lineTo(cx, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.4, cy + s * 0.5);
  ctx.quadraticCurveTo(cx + s * 0.8, cy + s * 0.1, cx + s * 1.2, cy + s * 0.4);
  ctx.quadraticCurveTo(cx + s * 1.5, cy, cx + s * 2, cy - s * 0.2);
  ctx.quadraticCurveTo(cx + s, cy - s, cx, cy);
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath(); ctx.arc(cx - s * 0.12, cy + s * 0.05, s * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + s * 0.12, cy + s * 0.05, s * 0.07, 0, Math.PI * 2); ctx.fill();
  return c;
}
