// Illustrations propres à l'écran d'accueil (Canvas 2D, graines fixes).
// Même langage que la serre du chapitre 1 : formes douces, dégradés, contours colorés (jamais noirs).

import { canvas, rng } from '../art/paint';
import { FONTS } from '../core/constants';
import { DISPLAY } from '../core/Display';

const NAVY = '#24306a';
const NAVY_DEEP = '#151d47';

// ------------------------------------------------------------------ LOGO

interface WordStyle {
  size: number;            // taille de police (px, à la résolution de peinture)
  stops: [number, string][];
  outline: number;
  depth: number;           // épaisseur de l'extrusion
  skew: number;            // inclinaison vers l'avant
  spacing: number;         // interlettrage
  wobble: number[];        // rotation de chaque lettre (degrés) : un logo vivant, pas une police brute
  lift: number[];          // décalage vertical de chaque lettre
  accent?: { index: number; stops: [number, string][] };
  streaks?: boolean;       // traits de vitesse
}

/** Peint un mot du logo à 2x, avec extrusion, contour, dégradé, reflet et ombre portée. */
function paintWord(text: string, st: WordStyle): HTMLCanvasElement {
  const font = `${st.size}px ${FONTS.display}`;
  const [m, mctx] = canvas(4, 4);
  void m;
  mctx.font = font;
  const chars = [...text];
  const widths = chars.map((c) => mctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + st.spacing * (chars.length - 1);
  const streakW = st.streaks ? st.size * 0.62 : 0;
  const padX = st.outline + st.depth + st.size * 0.12 + streakW;
  const padY = st.outline + st.size * 0.12;
  const capH = st.size * 0.78;
  const W = Math.ceil(total + padX + st.outline + st.depth + st.size * 0.25 + 30);
  const H = Math.ceil(capH + padY * 2 + st.depth + 40);
  const baseY = padY + capH;

  // positions des lettres
  const xs: number[] = [];
  let x = padX;
  for (let i = 0; i < chars.length; i++) {
    xs.push(x);
    x += widths[i] + st.spacing;
  }

  const eachLetter = (ctx: CanvasRenderingContext2D, dy: number, fn: (i: number) => void) => {
    chars.forEach((_, i) => {
      ctx.save();
      const cx = xs[i] + widths[i] / 2;
      ctx.translate(cx, baseY + dy + (st.lift[i] ?? 0));
      ctx.rotate(((st.wobble[i] ?? 0) * Math.PI) / 180);
      ctx.transform(1, 0, -st.skew, 1, 0, 0);
      ctx.translate(-widths[i] / 2, 0);
      fn(i);
      ctx.restore();
    });
  };

  const res = Math.max(2, DISPLAY.TEX);
  const [c, ctx] = canvas(W, H, res);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // traits de vitesse, derrière le mot
  if (st.streaks) {
    const lines = [
      { y: -capH * 0.72, len: streakW * 0.95 },
      { y: -capH * 0.46, len: streakW * 0.7 },
      { y: -capH * 0.2, len: streakW * 0.45 }
    ];
    for (const l of lines) {
      const y = baseY + l.y;
      const x1 = padX - st.size * 0.08;
      const th = st.size * 0.075;
      ctx.lineCap = 'round';
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = th + st.outline * 0.9;
      ctx.beginPath(); ctx.moveTo(x1 - l.len, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = '#ffe9bf';
      ctx.lineWidth = th;
      ctx.beginPath(); ctx.moveTo(x1 - l.len, y); ctx.lineTo(x1, y); ctx.stroke();
    }
  }

  // 1) ombre portée douce sous l'ensemble
  ctx.save();
  ctx.shadowColor = 'rgba(14,26,52,0.32)';
  ctx.shadowBlur = st.size * 0.14;
  ctx.shadowOffsetY = st.size * 0.07;
  ctx.fillStyle = NAVY_DEEP;
  ctx.strokeStyle = NAVY_DEEP;
  ctx.lineWidth = st.outline * 2;
  eachLetter(ctx, st.depth, (i) => { ctx.strokeText(chars[i], 0, 0); ctx.fillText(chars[i], 0, 0); });
  ctx.restore();

  // 2) extrusion (volume) : couches successives, plus sombres vers le bas
  for (let d = st.depth; d >= 1; d--) {
    const k = d / st.depth;
    ctx.fillStyle = k > 0.5 ? NAVY_DEEP : '#1c275a';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = st.outline * 2;
    eachLetter(ctx, d, (i) => { ctx.strokeText(chars[i], 0, 0); ctx.fillText(chars[i], 0, 0); });
  }

  // 3) contour principal
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = st.outline * 2;
  eachLetter(ctx, 0, (i) => ctx.strokeText(chars[i], 0, 0));

  // 4) remplissage en dégradé + reflets, peints sur un calque masqué par les lettres
  const [lc, l] = canvas(W, H, res);
  l.font = font;
  l.lineJoin = 'round';
  const grad = (stops: [number, string][]) => {
    // repère local de la lettre : la ligne de base est en y = 0
    const g = l.createLinearGradient(0, -capH, 0, 0);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  };
  chars.forEach((_, i) => {
    l.fillStyle = grad(st.accent && st.accent.index === i ? st.accent.stops : st.stops);
    eachLetter(l, 0, (k) => { if (k === i) l.fillText(chars[k], 0, 0); });
  });
  l.globalCompositeOperation = 'source-atop';
  // bande brillante sur le haut des lettres
  const hl = l.createLinearGradient(0, baseY - capH, 0, baseY - capH * 0.35);
  hl.addColorStop(0, 'rgba(255,255,255,0.42)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  l.fillStyle = hl;
  l.fillRect(0, 0, W, baseY - capH * 0.35);
  // ombre interne en bas
  const lo = l.createLinearGradient(0, baseY - capH * 0.25, 0, baseY + 4);
  lo.addColorStop(0, 'rgba(120,40,10,0)');
  lo.addColorStop(1, 'rgba(120,40,10,0.18)');
  l.fillStyle = lo;
  l.fillRect(0, baseY - capH * 0.25, W, capH);
  // petite pastille de lumière par lettre
  chars.forEach((_, i) => {
    eachLetter(l, 0, (k) => {
      if (k !== i) return;
      l.fillStyle = 'rgba(255,255,255,0.55)';
      l.beginPath();
      l.ellipse(widths[i] * 0.3, -capH * 0.78, st.size * 0.06, st.size * 0.028, -0.5, 0, Math.PI * 2);
      l.fill();
    });
  });
  ctx.drawImage(lc, 0, 0, W, H);

  // 5) liseré clair intérieur (finition "émail")
  ctx.strokeStyle = 'rgba(255,248,228,0.55)';
  ctx.lineWidth = Math.max(1.5, st.outline * 0.16);
  ctx.globalCompositeOperation = 'source-atop';
  eachLetter(ctx, -st.outline * 0.05, (i) => ctx.strokeText(chars[i], 0, 0));
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export const LOGO_RES = 1; // la haute résolution est gérée par canvas() (core/Display)

export function paintLogoNotSo(): HTMLCanvasElement {
  return paintWord('NOT SO', {
    size: 62 * LOGO_RES,
    stops: [[0, '#fffdf6'], [0.55, '#fff1d2'], [1, '#ffd9a0']],
    outline: 7 * LOGO_RES,
    depth: 6 * LOGO_RES,
    skew: 0.08,
    spacing: 2 * LOGO_RES,
    wobble: [-3, 1, -2, 0, 2, -1],
    lift: [2, -2, 0, 0, -3, 1].map((v) => v * LOGO_RES)
  });
}

export function paintLogoFast(): HTMLCanvasElement {
  return paintWord('FAST!', {
    size: 146 * LOGO_RES,
    stops: [[0, '#ffd27a'], [0.4, '#f8962f'], [1, '#d9561c']],
    outline: 11 * LOGO_RES,
    depth: 11 * LOGO_RES,
    skew: 0.13,
    spacing: -2 * LOGO_RES,
    wobble: [-2, 1.5, -1, 2, 5],
    lift: [0, -4, 2, -2, -6].map((v) => v * LOGO_RES),
    accent: { index: 4, stops: [[0, '#fffdf6'], [0.6, '#ffeccb'], [1, '#ffd08a']] },
    streaks: true
  });
}

// ------------------------------------------------------------------ SOL

/** Sol de l'accueil : bande fine, allée de dalles moussues sur terre sombre. */
export function paintMenuGround(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(77);
  const top = 20; // hauteur de l'herbe au-dessus de la surface

  // terre
  const soil = ctx.createLinearGradient(0, top, 0, h);
  soil.addColorStop(0, '#8b5d43');
  soil.addColorStop(0.35, '#6c4433');
  soil.addColorStop(1, '#3f2a22');
  ctx.fillStyle = soil;
  ctx.fillRect(0, top + 6, w, h - top);
  for (let i = 0; i < w / 5; i++) {
    const y = top + 18 + r() * (h - top - 18);
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,220,190,0.10)' : 'rgba(30,14,8,0.22)';
    ctx.beginPath();
    ctx.ellipse(r() * w, y, 1.5 + r() * 4, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // radicelles
  ctx.strokeStyle = 'rgba(40,22,14,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < w / 90; i++) {
    const x = r() * w;
    ctx.beginPath();
    ctx.moveTo(x, top + 14);
    ctx.bezierCurveTo(x + 10, top + 30, x - 8, top + 44, x + 6 * (r() - 0.5), top + 30 + r() * 40);
    ctx.stroke();
  }

  // bourrelet d'herbe
  const grassG = ctx.createLinearGradient(0, top - 4, 0, top + 18);
  grassG.addColorStop(0, '#9fd08c');
  grassG.addColorStop(0.5, '#6fae74');
  grassG.addColorStop(1, '#4d8a60');
  ctx.fillStyle = grassG;
  ctx.beginPath();
  ctx.moveTo(0, top + 16);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, top + 12 + Math.sin(x * 0.07) * 2 + r() * 4);
  ctx.lineTo(w, top - 2);
  for (let x = w; x >= 0; x -= 10) ctx.lineTo(x, top - 1 + Math.sin(x * 0.05) * 1.5);
  ctx.closePath();
  ctx.fill();

  // dalles plates, à demi enfoncées dans l'herbe (l'allée de la serre)
  for (let x = 10 + r() * 20; x < w - 30; x += 64 + r() * 34) {
    const sw = 46 + r() * 30, sh = 9 + r() * 4;
    const y = top + 2 + r() * 3;
    const sg = ctx.createLinearGradient(0, y - sh / 2, 0, y + sh / 2);
    sg.addColorStop(0, '#ece4d2');
    sg.addColorStop(1, '#bdb29b');
    ctx.fillStyle = 'rgba(40,40,30,0.18)';
    ctx.beginPath(); ctx.ellipse(x + sw / 2, y + 3, sw / 2, sh / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(x + sw / 2, y, sw / 2, sh / 2, (r() - 0.5) * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(x + sw * 0.4, y - sh * 0.18, sw * 0.28, sh * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // mousse sur le bord
    ctx.fillStyle = 'rgba(110,170,110,0.75)';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x + r() * sw, y + sh * 0.3, 2 + r() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // touffes et petites fleurs
  for (let x = 0; x < w; x += 7 + r() * 9) {
    const hgt = 6 + r() * 14;
    ctx.strokeStyle = r() > 0.5 ? '#5e9a70' : '#8cc47f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top + 8);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 6, top + 8 - hgt * 0.6, x + (r() - 0.5) * 9, top + 8 - hgt);
    ctx.stroke();
    if (r() > 0.93) {
      ctx.fillStyle = r() > 0.5 ? '#ffd7a8' : '#ffffff';
      const fy = top + 8 - hgt;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#f7d774';
      ctx.beginPath(); ctx.arc(x, fy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

// ------------------------------------------------------------------ FLEUR QUI ÉTERNUE

export type PetalPalette = { outer: [string, string, string]; inner: [string, string, string] };

export const PETALS: Record<string, PetalPalette> = {
  peach: { outer: ['#e8846b', '#f6b89a', '#c2614c'], inner: ['#f39a7c', '#ffd2b8', '#d9785e'] },
  lilac: { outer: ['#9a7fd1', '#c9b6f2', '#6f58a8'], inner: ['#b39ce6', '#e4d8ff', '#8a72c4'] },
  sun: { outer: ['#e9a93a', '#ffd776', '#b97b1f'], inner: ['#f4c050', '#ffe9a8', '#d6982e'] },
  coral: { outer: ['#d9566b', '#f59aa6', '#a83a4d'], inner: ['#e87586', '#ffc8d0', '#c4566a'] }
};

export function paintFlowerHead(palette: PetalPalette = PETALS.peach): HTMLCanvasElement {
  const S = 180;
  const [c, ctx] = canvas(S, S);
  const cx = S / 2, cy = S / 2;
  const petals = 11;
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + ring * (Math.PI / petals);
      const len = ring === 0 ? 74 : 62;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      const pal = ring === 0 ? palette.outer : palette.inner;
      g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      ctx.fillStyle = g;
      ctx.strokeStyle = pal[2];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.bezierCurveTo(len * 0.35, -20, len * 0.85, -16, len, 0);
      ctx.bezierCurveTo(len * 0.85, 16, len * 0.35, 20, 10, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,230,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(len * 0.8, 0); ctx.stroke();
      ctx.restore();
    }
  }
  return c;
}

/** Cœur de la fleur avec son visage : 'calm' | 'inhale' | 'sneeze'. */
export function paintFlowerFace(kind: 'calm' | 'inhale' | 'sneeze' | 'watch' | 'dazed' | 'shy' | 'puff'): HTMLCanvasElement {
  const S = 96;
  const [c, ctx] = canvas(S, S);
  const cx = S / 2, cy = S / 2;
  const g = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, 44);
  g.addColorStop(0, '#ffe9a0');
  g.addColorStop(0.7, '#f7c94e');
  g.addColorStop(1, '#e0a530');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#b9822a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // grains de pollen
  const r = rng(kind.length * 13);
  ctx.fillStyle = 'rgba(190,120,30,0.35)';
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 22 + r() * 16;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = NAVY;
  ctx.fillStyle = NAVY;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  // joues
  ctx.fillStyle = 'rgba(232,120,100,0.45)';
  ctx.beginPath(); ctx.ellipse(cx - 24, cy + 8, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 24, cy + 8, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = NAVY;
  if (kind === 'calm') {
    ctx.beginPath(); ctx.arc(cx - 13, cy - 6, 5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 13, cy - 6, 5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + 7, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (kind === 'watch') {
    // grands yeux ouverts SANS pupilles : elles sont dessinées à part et suivent le joueur
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - 13, cy - 6, 9, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 13, cy - 6, 9, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 12); ctx.lineTo(cx + 5, cy + 12); ctx.stroke();
  } else if (kind === 'dazed') {
    // yeux en spirale, langue tirée
    ctx.lineWidth = 2.4;
    for (const ex of [-13, 13]) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const rr = 1 + a * 0.55;
        const px = cx + ex + Math.cos(a) * rr, py = cy - 6 + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy + 16, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = '#e8846b';
    ctx.beginPath(); ctx.ellipse(cx + 3, cy + 14, 4, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'shy') {
    // timide : yeux plissés "> <", grosses joues roses, petite bouche gênée
    ctx.fillStyle = 'rgba(240,110,120,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - 22, cy + 6, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 22, cy + 6, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 19, cy - 11); ctx.lineTo(cx - 10, cy - 6); ctx.lineTo(cx - 19, cy - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 19, cy - 11); ctx.lineTo(cx + 10, cy - 6); ctx.lineTo(cx + 19, cy - 1); ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 13); ctx.quadraticCurveTo(cx, cy + 9, cx + 5, cy + 13); ctx.stroke();
  } else if (kind === 'puff') {
    // retient son souffle : joues gonflées, yeux en coin qui guettent
    ctx.fillStyle = 'rgba(232,120,100,0.6)';
    ctx.beginPath(); ctx.ellipse(cx - 21, cy + 8, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 21, cy + 8, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - 13, cy - 7, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 13, cy - 7, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = NAVY;
    ctx.beginPath(); ctx.arc(cx - 9, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 17, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 12); ctx.lineTo(cx + 4, cy + 12); ctx.stroke();
  } else if (kind === 'inhale') {
    // yeux plissés, narines dilatées, bouche qui aspire
    ctx.beginPath(); ctx.moveTo(cx - 19, cy - 9); ctx.lineTo(cx - 8, cy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 19, cy - 9); ctx.lineTo(cx + 8, cy - 5); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // yeux fermés très fort, grande bouche
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 10); ctx.lineTo(cx - 9, cy - 6); ctx.lineTo(cx - 20, cy - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 20, cy - 10); ctx.lineTo(cx + 9, cy - 6); ctx.lineTo(cx + 20, cy - 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8846b';
    ctx.beginPath(); ctx.ellipse(cx, cy + 16, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// ------------------------------------------------------------------ VÉGÉTATION PROCHE

function leafShape(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.75, wid * 0.8, len * 0.3, wid, 0, 0);
}

/** Plan de plantes rapprochées : calatheas rayées, strelitzias, sansevierias, pots et fleurs. */
export function paintNearPlants(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(314);
  const base = h - 4;

  const pot = (x: number, pw: number, ph: number, colA: string, colB: string) => {
    const g = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
    g.addColorStop(0, colB); g.addColorStop(0.4, colA); g.addColorStop(1, colB);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - pw / 2, base - ph);
    ctx.lineTo(x + pw / 2, base - ph);
    ctx.lineTo(x + pw * 0.38, base);
    ctx.lineTo(x - pw * 0.38, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colA;
    ctx.beginPath(); ctx.roundRect(x - pw / 2 - 5, base - ph - 10, pw + 10, 14, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x - pw / 2 - 2, base - ph - 8, pw + 4, 3);
  };

  const calathea = (x: number, y: number, s: number) => {
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32 + (r() - 0.5) * 0.15;
      const len = (70 + r() * 40) * s;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = '#4a7a5e';
      ctx.lineWidth = 3;
      const sx = Math.cos(a) * len * 0.45, sy = Math.sin(a) * len * 0.45;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      const lg = ctx.createLinearGradient(0, -20, 0, 20);
      lg.addColorStop(0, '#5f9d79'); lg.addColorStop(1, '#3f6f58');
      ctx.fillStyle = lg;
      leafShape(ctx, len * 0.75, 20 * s);
      ctx.fill();
      // rayures caractéristiques
      ctx.strokeStyle = 'rgba(200,235,190,0.55)';
      ctx.lineWidth = 2;
      for (let t = 0.15; t < 0.85; t += 0.12) {
        ctx.beginPath(); ctx.moveTo(len * 0.75 * t, 0); ctx.lineTo(len * 0.75 * (t + 0.05), -12 * s * (1 - t)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(len * 0.75 * t, 0); ctx.lineTo(len * 0.75 * (t + 0.05), 12 * s * (1 - t)); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,40,70,0.35)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.75, 0); ctx.stroke();
      ctx.restore();
    }
  };

  const snake = (x: number, s: number) => {
    for (let k = 0; k < 6; k++) {
      const hh = (110 + r() * 90) * s, ww = 13 * s;
      const lean = (k - 2.5) * 6;
      const g = ctx.createLinearGradient(x + lean - ww, 0, x + lean + ww, 0);
      g.addColorStop(0, '#2f5d48'); g.addColorStop(0.5, '#5c9a73'); g.addColorStop(1, '#2f5d48');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + (k - 2.5) * 5 - ww, base - 20);
      ctx.quadraticCurveTo(x + lean - ww * 0.6, base - hh * 0.6, x + lean * 1.6, base - hh);
      ctx.quadraticCurveTo(x + lean + ww * 0.6, base - hh * 0.6, x + (k - 2.5) * 5 + ww, base - 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,220,140,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const strelitzia = (x: number, s: number) => {
    // grandes feuilles en pagaie
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.4;
      const len = (150 + r() * 60) * s;
      ctx.save();
      ctx.translate(x, base - 30);
      ctx.strokeStyle = '#3f6f58'; ctx.lineWidth = 4;
      const sx = Math.cos(a) * len * 0.5, sy = Math.sin(a) * len * 0.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = k % 2 ? '#4f8a68' : '#5f9d79';
      leafShape(ctx, len * 0.6, 24 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(210,240,200,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(len * 0.56, 0); ctx.stroke();
      ctx.restore();
    }
    // fleur "oiseau de paradis"
    const fx = x + 30 * s, fy = base - 150 * s;
    ctx.strokeStyle = '#3f6f58'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 10, base - 30); ctx.quadraticCurveTo(x + 30 * s, base - 90 * s, fx, fy); ctx.stroke();
    ctx.fillStyle = '#3e7c78';
    ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.quadraticCurveTo(fx + 30 * s, fy - 4, fx + 52 * s, fy + 6); ctx.quadraticCurveTo(fx + 20 * s, fy + 10, fx - 6, fy + 6); ctx.fill();
    const petal = (dx: number, dy: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(fx + 14 * s, fy); ctx.quadraticCurveTo(fx + (14 + dx * 0.5) * s, fy + dy * 0.6 * s, fx + (14 + dx) * s, fy + dy * s); ctx.quadraticCurveTo(fx + (20 + dx * 0.4) * s, fy + dy * 0.3 * s, fx + 22 * s, fy); ctx.fill();
    };
    petal(-6, -48, '#f28c38'); petal(8, -54, '#f7a54a'); petal(22, -44, '#f28c38'); petal(28, -30, '#6f7fd6');
  };

  const flowerBush = (x: number, s: number, col: string) => {
    for (let k = 0; k < 22; k++) {
      const a = Math.PI + r() * Math.PI, d = r() * 50 * s;
      ctx.fillStyle = r() > 0.5 ? '#5e9a70' : '#7db386';
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, base - 20 + Math.sin(a) * d * 0.8, 14 * s, 9 * s, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
    for (let k = 0; k < 9; k++) {
      const fx = x + (r() - 0.5) * 80 * s, fy = base - 30 - r() * 46 * s;
      ctx.fillStyle = col;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 4 * s, fy + Math.sin(a) * 4 * s, 3.6 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff1c9';
      ctx.beginPath(); ctx.arc(fx, fy, 2.4 * s, 0, Math.PI * 2); ctx.fill();
    }
  };

  // Composition : discret à gauche (sous le menu), plus riche à droite (la scène)
  flowerBush(70, 0.7, '#ffd2b8');
  calathea(250, base - 26, 0.62);
  pot(250, 58, 40, '#d48a6a', '#a8604a');
  snake(470, 0.6);
  pot(470, 54, 36, '#7fb7c4', '#4f8a98');
  strelitzia(660, 1.0);
  calathea(880, base - 34, 0.9);
  pot(880, 80, 56, '#e9a07a', '#b7694f');
  flowerBush(1060, 1.0, '#f6b89a');
  snake(1190, 0.95);
  pot(1190, 70, 48, '#f2d38a', '#c79a4f');
  strelitzia(1360, 1.1);
  calathea(1500, base - 30, 0.8);
  flowerBush(1640, 0.9, '#fff1c9');
  return c;
}

// ------------------------------------------------------------------ LIERRE, FEUILLAGE DE PREMIER PLAN

export function paintIvy(len: number, seed: number): HTMLCanvasElement {
  const W = 120;
  const [c, ctx] = canvas(W, len + 30);
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let y = 0; y <= len; y += 6) pts.push([W / 2 + Math.sin(y * 0.03 + seed) * 12, y]);
  ctx.strokeStyle = '#4e7a62';
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  for (let i = 2; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    const side = i % 4 === 0 ? 1 : -1;
    const s = 0.6 + (i / pts.length) * 0.5 + r() * 0.3;
    ctx.save();
    ctx.translate(x + side * 6, y);
    ctx.rotate(side * (0.6 + r() * 0.5));
    const g = ctx.createLinearGradient(0, -10 * s, 0, 14 * s);
    g.addColorStop(0, '#8cc47f'); g.addColorStop(1, '#4e8a62');
    ctx.fillStyle = g;
    // feuille en cœur
    ctx.beginPath();
    ctx.moveTo(0, 14 * s);
    ctx.bezierCurveTo(-14 * s, 4 * s, -12 * s, -10 * s, 0, -4 * s);
    ctx.bezierCurveTo(12 * s, -10 * s, 14 * s, 4 * s, 0, 14 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,200,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -3 * s); ctx.lineTo(0, 12 * s); ctx.stroke();
    ctx.restore();
  }
  return c;
}

/** Feuillage sombre et flou du tout premier plan (cadre l'image, jamais devant l'interface). */
export function paintForegroundLeaves(w: number, h: number, seed: number, from: 'bottom' | 'top'): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  ctx.filter = 'blur(1.5px)';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = w * (0.55 + (i / n) * 0.5) + (r() - 0.5) * 20;
    const y = from === 'bottom' ? h + 10 : -10;
    const spread = -0.25 - (i / n) * 1.1; // de "presque vertical" à "vers la gauche"
    const a = from === 'bottom' ? -Math.PI / 2 + spread : Math.PI / 2 - spread;
    const len = (0.55 + r() * 0.35) * Math.min(w, h) * 1.1;
    const wid = len * (0.2 + r() * 0.06);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -wid, 0, wid);
    g.addColorStop(0, i % 2 ? '#1f3d33' : '#24473a');
    g.addColorStop(1, '#132a23');
    ctx.fillStyle = g;
    leafShape(ctx, len, wid);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,140,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
    // nervures
    for (let t = 0.2; t < 0.9; t += 0.14) {
      ctx.beginPath(); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.08), -wid * 0.6 * (1 - t)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.08), wid * 0.6 * (1 - t)); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.filter = 'none';
  // fondu radial depuis le coin : pas de bord coupé net
  ctx.globalCompositeOperation = 'destination-in';
  const cy = from === 'bottom' ? h : 0;
  const m = ctx.createRadialGradient(w, cy, 0, w, cy, Math.max(w, h) * 1.05);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.6, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// ------------------------------------------------------------------ LUMIÈRE, BRUME

/** Halo lumineux derrière le logo et le menu : assure la lisibilité sans panneau. */
export function paintMenuGlow(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createRadialGradient(w * 0.32, h * 0.46, 30, w * 0.32, h * 0.46, w * 0.62);
  g.addColorStop(0, 'rgba(255,250,236,0.62)');
  g.addColorStop(0.55, 'rgba(255,248,230,0.3)');
  g.addColorStop(1, 'rgba(255,248,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function paintMist(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(91);
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = h * (0.45 + r() * 0.35), rad = 60 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(250,255,250,0.32)');
    g.addColorStop(1, 'rgba(250,255,250,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

/** Reflet oblique sur les vitres de la serre. */
export function paintGlint(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const f = ctx.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, 'rgba(0,0,0,0)');
  f.addColorStop(0.3, 'rgba(0,0,0,1)');
  f.addColorStop(0.75, 'rgba(0,0,0,0.6)');
  f.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = f;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Petit point d'exclamation dessiné (bulle de surprise du héros). */
export function paintExclaim(): HTMLCanvasElement {
  const [c, ctx] = canvas(44, 64);
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 6); ctx.lineTo(30, 6); ctx.lineTo(26, 40); ctx.lineTo(18, 40); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(22, 52, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  return c;
}
