// Peintres procéduraux (Canvas 2D) : décors illustrés, terrains, pièges.
// Tout est généré à partir de graines fixes : le rendu est identique à chaque partie.

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

const hex = (n: number, a = 1) =>
  `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ------------------------------------------------------------------ CIEL

export function paintSky(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#bfe6dc');
  g.addColorStop(0.45, '#dff1e2');
  g.addColorStop(0.8, '#fbe9cc');
  g.addColorStop(1, '#f9dcc0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // halo solaire
  const s = ctx.createRadialGradient(w * 0.78, h * 0.08, 10, w * 0.78, h * 0.08, h * 0.9);
  s.addColorStop(0, 'rgba(255,248,214,0.95)');
  s.addColorStop(0.25, 'rgba(255,236,180,0.45)');
  s.addColorStop(1, 'rgba(255,236,180,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h);
  return c;
}

// ------------------------------------------------------- STRUCTURE DE SERRE

export function paintGreenhouse(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const bay = 200;
  for (let x = 0; x < w; x += bay) {
    // vitres légèrement teintées, une sur deux
    ctx.fillStyle = (x / bay) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(190,235,225,0.10)';
    ctx.beginPath();
    ctx.moveTo(x + 8, h);
    ctx.lineTo(x + 8, 210);
    ctx.quadraticCurveTo(x + bay / 2, 40, x + bay - 8, 210);
    ctx.lineTo(x + bay - 8, h);
    ctx.fill();
    // arches métalliques
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, 210);
    ctx.quadraticCurveTo(x + bay / 2, 30, x + bay, 210);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,156,149,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, h);
    ctx.lineTo(x + 4, 212);
    ctx.stroke();
    // traverses et petits carreaux
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 3;
    for (let y = 300; y < h; y += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + bay, y);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + bay / 2, 120);
    ctx.lineTo(x + bay / 2, h);
    ctx.stroke();
    // rosace en haut de l'arche
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + bay / 2, 150, 22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + bay / 2, 150);
      ctx.lineTo(x + bay / 2 + Math.cos(a) * 22, 150 + Math.sin(a) * 22);
      ctx.stroke();
    }
  }
  // poutre horizontale haute
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(0, 22, w, 6);
  return c;
}

// --------------------------------------------------------- FEUILLAGES

function leafShape(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.closePath();
}

function drawMonstera(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, col: string, vein: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  // fentes caractéristiques
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.85 + (i / 6) * Math.PI * 1.7;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.05);
    ctx.lineTo(r * 1.05, -r * 0.09);
    ctx.lineTo(r * 1.05, r * 0.09);
    ctx.lineTo(r * 0.45, r * 0.05);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = vein;
  ctx.lineWidth = Math.max(1.5, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

function drawFrond(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number, bend: number, col: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  const steps = 18;
  let px = 0, py = 0;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const pts: [number, number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = t * len;
    const ny = bend * t * t * len;
    pts.push([nx, ny, Math.atan2(ny - py, nx - px)]);
    ctx.lineTo(nx, ny);
    px = nx; py = ny;
  }
  ctx.stroke();
  pts.forEach(([lx, ly, a], i) => {
    const s = (1 - i / steps) * len * 0.16 + 3;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + side * 1.05);
      leafShape(ctx, s, s * 0.32);
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawBanana(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number, col: string, vein: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  leafShape(ctx, len, len * 0.2);
  ctx.fill();
  ctx.strokeStyle = vein;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    ctx.beginPath();
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * t + 10, -len * 0.16 * Math.sin(t * Math.PI));
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * t + 10, len * 0.16 * Math.sin(t * Math.PI));
    ctx.stroke();
  }
  ctx.restore();
}

function drawPot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, base: number, rim: number) {
  ctx.fillStyle = hex(base);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.38, y + w * 0.75);
  ctx.lineTo(x - w * 0.38, y + w * 0.75);
  ctx.fill();
  ctx.fillStyle = hex(rim);
  roundRect(ctx, x - w * 0.56, y - w * 0.12, w * 1.12, w * 0.18, 5);
  ctx.fill();
}

/** Bande de feuillage répétable. depth 0 = lointain (brumeux), 1 = proche (saturé). */
export function paintFoliage(w: number, h: number, depth: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  const haze = 0xd9efe4;
  const base = [0x6fa88f, 0x5c9580, 0x7db386, 0x4e7a62, 0x3e9e98];
  const col = (i: number, extra = 0) => hex(mix(base[i % base.length], haze, 0.62 - depth * 0.55 + extra));
  const vein = hex(mix(0xc7e3b8, haze, 0.5 - depth * 0.3), 0.7);

  // masse de buissons ronds au sol
  for (let x = -40; x < w + 40; x += 60 + r() * 50) {
    const rr = 50 + r() * 70;
    ctx.fillStyle = col(Math.floor(r() * 5), 0.06);
    ctx.beginPath();
    ctx.arc(x, h - rr * 0.35, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  // plantes en pot, monsteras, bananiers, fougères
  const count = Math.floor(w / 170);
  for (let i = 0; i < count; i++) {
    const x = (i + 0.3 + r() * 0.4) * (w / count);
    const kind = Math.floor(r() * 4);
    const ground = h - 30 - r() * 40;
    if (kind === 0) {
      for (let k = 0; k < 6; k++) {
        const len = 120 + r() * 130;
        drawBanana(ctx, x, ground, len, -Math.PI / 2 + (r() - 0.5) * 1.6, col(k), vein);
      }
    } else if (kind === 1) {
      for (let k = 0; k < 5; k++) {
        const rr = 34 + r() * 30;
        const a = -Math.PI / 2 + (r() - 0.5) * 2;
        const d = 60 + r() * 80;
        ctx.strokeStyle = col(3);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, ground);
        ctx.quadraticCurveTo(x, ground - d * 0.6, x + Math.cos(a) * d, ground + Math.sin(a) * d);
        ctx.stroke();
        drawMonstera(ctx, x + Math.cos(a) * d, ground + Math.sin(a) * d, rr, a + Math.PI / 2, col(k + 1), vein);
      }
    } else if (kind === 2) {
      for (let k = 0; k < 9; k++) {
        drawFrond(ctx, x, ground, 90 + r() * 90, -Math.PI / 2 + (k - 4) * 0.33, (k < 4 ? -1 : 1) * 0.35, col(k % 2 ? 0 : 2));
      }
    } else {
      // grand palmier fin
      ctx.strokeStyle = col(3);
      ctx.lineWidth = 9;
      const top = ground - 220 - r() * 140;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.quadraticCurveTo(x + 30, (ground + top) / 2, x + 10, top);
      ctx.stroke();
      for (let k = 0; k < 8; k++) drawFrond(ctx, x + 10, top, 110 + r() * 60, (k / 8) * Math.PI * 2, 0.4, col(k));
    }
    if (depth > 0.4 && r() > 0.4) {
      drawPot(ctx, x, ground, 60 + r() * 30, mix(0xd48a6a, haze, 0.55 - depth * 0.5), mix(0xf6b89a, haze, 0.5 - depth * 0.5));
    }
  }
  return c;
}

// ------------------------------------------------------- RAYONS / VIGNETTE

export function paintRay(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,245,205,0)');
  g.addColorStop(0.5, 'rgba(255,245,205,1)');
  g.addColorStop(1, 'rgba(255,245,205,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, 0);
  ctx.lineTo(w * 0.65, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-in';
  const f = ctx.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, 'rgba(0,0,0,1)');
  f.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = f;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function paintVignette(w: number, h: number, color = 'rgba(30,60,50,'): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, w * 0.75);
  g.addColorStop(0, color + '0)');
  g.addColorStop(1, color + '0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function paintSoftDot(size: number, color = '#ffffff'): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function paintPetal(): HTMLCanvasElement {
  const [c, ctx] = canvas(16, 10);
  ctx.fillStyle = '#fbe38e';
  ctx.beginPath();
  ctx.ellipse(8, 5, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function paintStar(): HTMLCanvasElement {
  const [c, ctx] = canvas(24, 24);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 2.4 : 11;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
  }
  ctx.fill();
  return c;
}

// ------------------------------------------------------------- TERRAINS

export const GRASS_PAD = 22;

/** Plate-bande illustrée : terre en strates + chapeau de mousse. */
export function paintBed(w: number, h: number, seed: number, opts: { flowers?: boolean } = {}): HTMLCanvasElement {
  const pad = GRASS_PAD;
  const [c, ctx] = canvas(w + 16, h + pad);
  const r = rng(seed);
  const ox = 8;
  ctx.save();
  roundRect(ctx, ox, pad, w, h, [16, 16, 4, 4]);
  ctx.clip();
  const g = ctx.createLinearGradient(0, pad, 0, pad + Math.min(h, 400));
  g.addColorStop(0, '#c08a6a');
  g.addColorStop(0.35, '#9c6650');
  g.addColorStop(1, '#6f4436');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w + 16, h + pad);
  // strates ondulées
  for (let y = pad + 46; y < pad + h; y += 34 + r() * 30) {
    ctx.strokeStyle = `rgba(70,36,28,${0.14 + r() * 0.1})`;
    ctx.lineWidth = 3 + r() * 3;
    ctx.beginPath();
    for (let x = 0; x <= w + 16; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + y) * 5);
    ctx.stroke();
  }
  // cailloux
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = ox + r() * w, y = pad + 26 + r() * (h - 26);
    const s = 2 + r() * 6;
    ctx.fillStyle = r() > 0.5 ? 'rgba(232,196,170,0.45)' : 'rgba(60,32,26,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.7, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // racines
  ctx.strokeStyle = 'rgba(60,34,24,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < w / 90; i++) {
    const x = ox + r() * w;
    ctx.beginPath();
    ctx.moveTo(x, pad + 18);
    ctx.bezierCurveTo(x + 10, pad + 50, x - 14, pad + 70, x + 6, pad + 100 + r() * 50);
    ctx.stroke();
  }
  // ombre portée sous la mousse
  const sh = ctx.createLinearGradient(0, pad + 10, 0, pad + 44);
  sh.addColorStop(0, 'rgba(40,20,14,0.45)');
  sh.addColorStop(1, 'rgba(40,20,14,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, pad + 10, w + 16, 34);
  ctx.restore();

  // chapeau de mousse ondulé (dépasse légèrement sur les côtés)
  const mg = ctx.createLinearGradient(0, pad - 6, 0, pad + 20);
  mg.addColorStop(0, '#b6dc98');
  mg.addColorStop(0.5, '#86b97f');
  mg.addColorStop(1, '#5f9470');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(ox - 4, pad + 18);
  ctx.quadraticCurveTo(ox - 6, pad - 2, ox + 12, pad - 2);
  for (let x = ox + 12; x < ox + w - 12; x += 14) {
    ctx.quadraticCurveTo(x + 7, pad - 6 - r() * 3, x + 14, pad - 2);
  }
  ctx.quadraticCurveTo(ox + w + 6, pad - 2, ox + w + 4, pad + 18);
  for (let x = ox + w; x > ox; x -= 18) {
    ctx.quadraticCurveTo(x - 9, pad + 22 + r() * 8, x - 18, pad + 16 + r() * 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(225,245,190,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox + 8, pad - 1);
  ctx.lineTo(ox + w - 8, pad - 1);
  ctx.stroke();

  // brins d'herbe et petites fleurs
  for (let x = ox + 6; x < ox + w - 6; x += 5 + r() * 9) {
    const hgt = 5 + r() * 13;
    ctx.strokeStyle = r() > 0.5 ? '#6fa27a' : '#9cc98a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 6, pad - hgt * 0.6, x + (r() - 0.5) * 8, pad - hgt);
    ctx.stroke();
    if (opts.flowers !== false && r() > 0.93) {
      ctx.fillStyle = r() > 0.5 ? '#f6b89a' : '#f7d774';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 3, pad - hgt + Math.sin(a) * 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e8846b';
      ctx.beginPath();
      ctx.arc(x, pad - hgt, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** Plafond de terre avec racines pendantes (tunnel). */
export function paintCeiling(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h + 40);
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7a4a3a');
  g.addColorStop(1, '#4f2e26');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, [0, 0, 14, 14]);
  ctx.fill();
  for (let i = 0; i < (w * h) / 700; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(200,150,120,0.25)' : 'rgba(30,14,10,0.3)';
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 1.5 + r() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // racines pendantes
  for (let x = 10; x < w - 10; x += 16 + r() * 30) {
    const len = 10 + r() * 34;
    ctx.strokeStyle = r() > 0.4 ? '#5a3527' : '#8a5a42';
    ctx.lineWidth = 2 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(x, h - 4);
    ctx.bezierCurveTo(x + 6, h + len * 0.3, x - 6, h + len * 0.6, x + (r() - 0.5) * 8, h + len);
    ctx.stroke();
  }
  return c;
}

/** Haie taillée, très haute (infranchissable par le haut). */
export function paintHedge(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w + 20, h);
  const r = rng(seed);
  ctx.fillStyle = '#2f5446';
  roundRect(ctx, 10, 0, w, h, [w / 2, w / 2, 6, 6]);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 6, -4, w + 8, h + 4, [w / 2, w / 2, 8, 8]);
  ctx.clip();
  const shades = ['#3a6553', '#4e7a62', '#5e9a70', '#6fa88f', '#86b97f'];
  for (let i = 0; i < (w * h) / 160; i++) {
    const x = 10 + r() * w;
    const y = r() * h;
    const light = 1 - x / (w + 20); // éclairage venant de gauche
    const idx = Math.min(4, Math.floor(r() * 3 + light * 2.4));
    ctx.fillStyle = shades[idx];
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + r() * 6, 3 + r() * 4, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return c;
}

/** Ronces : zone dangereuse (forme en dents de scie + épines claires). */
export function paintThorns(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  // fond sombre
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(74,33,64,0)');
  g.addColorStop(0.35, 'rgba(74,33,64,0.9)');
  g.addColorStop(1, '#2a1328');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // tiges entremêlées
  for (let i = 0; i < w / 14; i++) {
    const x0 = r() * w;
    const y0 = h - r() * 10;
    const x1 = x0 + (r() - 0.5) * 140;
    const y1 = 14 + r() * (h * 0.5);
    ctx.strokeStyle = r() > 0.5 ? '#6b2d52' : '#4a2140';
    ctx.lineWidth = 3 + r() * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const cx = (x0 + x1) / 2 + (r() - 0.5) * 60;
    ctx.quadraticCurveTo(cx, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    // épines le long de la tige
    for (let t = 0.2; t < 1; t += 0.16) {
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2) + t * t * y1;
      const a = r() * Math.PI * 2;
      ctx.fillStyle = '#f2d3c0';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a + 1.6) * 2.5, py + Math.sin(a + 1.6) * 2.5);
      ctx.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9);
      ctx.lineTo(px + Math.cos(a - 1.6) * 2.5, py + Math.sin(a - 1.6) * 2.5);
      ctx.fill();
    }
  }
  // grosses épines verticales sur le dessus (lecture immédiate du danger)
  for (let x = 6; x < w; x += 18 + r() * 10) {
    const hh = 16 + r() * 14;
    const base = 18 + r() * 8;
    ctx.fillStyle = '#5a2548';
    ctx.beginPath();
    ctx.moveTo(x - 6, base + 6);
    ctx.lineTo(x, base - hh);
    ctx.lineTo(x + 6, base + 6);
    ctx.fill();
    ctx.fillStyle = '#f2d3c0';
    ctx.beginPath();
    ctx.moveTo(x - 2, base - hh + 8);
    ctx.lineTo(x, base - hh);
    ctx.lineTo(x + 2, base - hh + 8);
    ctx.fill();
  }
  // baies
  for (let i = 0; i < w / 60; i++) {
    ctx.fillStyle = '#2a1530';
    ctx.beginPath();
    ctx.arc(r() * w, 30 + r() * (h - 40), 3 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------------------------------------------------------------- PAVÉS

export const STONE_W = 104;
export const STONE_H = 28;

/** Pavé mat : forme organique, texture, mousse. Toujours fiable. */
export function paintStoneMatte(seed: number): HTMLCanvasElement {
  const w = STONE_W, h = STONE_H;
  const [c, ctx] = canvas(w + 8, h + 12);
  const r = rng(seed);
  ctx.translate(4, 6);
  // ombre
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  roundRect(ctx, 2, 6, w - 2, h, 10);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#e2d4bd');
  g.addColorStop(1, '#ad987a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(6, 2);
  for (let x = 6; x < w - 6; x += 12) ctx.lineTo(x + 12, 1 + r() * 2.5);
  ctx.quadraticCurveTo(w + 1, 2, w - 1, h * 0.55);
  ctx.quadraticCurveTo(w - 3, h + 1, w - 14, h);
  for (let x = w - 14; x > 14; x -= 14) ctx.lineTo(x - 14, h - r() * 2.5);
  ctx.quadraticCurveTo(-1, h, 1, h * 0.5);
  ctx.quadraticCurveTo(0, 2, 6, 2);
  ctx.fill();
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(80,60,40,0.2)';
    ctx.beginPath();
    ctx.arc(6 + r() * (w - 12), 4 + r() * (h - 8), 0.8 + r() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // fissure
  ctx.strokeStyle = 'rgba(90,70,50,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const cx = 30 + r() * 40;
  ctx.moveTo(cx, 3);
  ctx.lineTo(cx + 4, 10);
  ctx.lineTo(cx - 2, 17);
  ctx.stroke();
  // mousse dans les coins
  ctx.fillStyle = '#86b97f';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(4 + r() * 18, 2 + r() * 4, 2 + r() * 2.5, 0, Math.PI * 2);
    ctx.arc(w - 22 + r() * 18, 2 + r() * 4, 2 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Pavé "trop poli" : géométrie nette, reflet brillant, teinte froide. */
export function paintStonePolished(): HTMLCanvasElement {
  const w = STONE_W, h = STONE_H;
  const [c, ctx] = canvas(w + 8, h + 12);
  ctx.translate(4, 6);
  ctx.fillStyle = 'rgba(40,40,40,0.2)';
  roundRect(ctx, 2, 6, w - 2, h, 6);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbf8f2');
  g.addColorStop(0.5, '#dfe7e3');
  g.addColorStop(1, '#a9bcb7');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();
  // reflet en biais
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(34, 0);
  ctx.lineTo(18, h);
  ctx.lineTo(-2, h);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(46, 0);
  ctx.lineTo(30, h);
  ctx.lineTo(24, h);
  ctx.fill();
  ctx.restore();
  // liseré net (les pavés polis ont des arêtes parfaites)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, 1.5);
  ctx.lineTo(w - 4, 1.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,110,105,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 6);
  ctx.stroke();
  return c;
}

/** Pilier de pierre (support des pavés mats). */
export function paintPillar(h: number, seed: number): HTMLCanvasElement {
  const w = 58;
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y += 30) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#bba98d');
    g.addColorStop(0.4, '#d6c7ad');
    g.addColorStop(1, '#8f7c62');
    ctx.fillStyle = g;
    roundRect(ctx, 2 + r() * 3, y + 1, w - 6 - r() * 3, 28, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(134,185,127,0.7)';
    if (r() > 0.6) {
      ctx.beginPath();
      ctx.arc(8 + r() * 40, y + 4, 3 + r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** Talus de pierre derrière l'ascenseur (rails visibles). */
export function paintShaft(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(62,40,32,0.55)');
  g.addColorStop(1, 'rgba(40,24,20,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(247,215,116,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(10, h);
  ctx.moveTo(w - 10, 0);
  ctx.lineTo(w - 10, h);
  ctx.stroke();
  return c;
}
