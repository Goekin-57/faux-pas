// Construction des sols et plateformes à partir des images du chapitre (bouts arrondis, bandeau d'herbe, terre en motif).
import Phaser from 'phaser';
import { COL } from '../core/config';

export const DIRT_SCALE = 0.52;
const TOP_H = 32;
const PF_H = 44;

export interface Neighbours { left?: boolean; right?: boolean; bottomOpen?: boolean }

// Renvoie un conteneur dont l'origine est le coin haut-gauche du bloc.
export function buildBlock(scene: Phaser.Scene, x: number, y: number, w: number, h: number, nb: Neighbours = {}): Phaser.GameObjects.Container {
  const ct = scene.add.container(x, y);
  const tex = (k: string) => scene.textures.get(k).getSourceImage() as HTMLImageElement;
  const row = (L: string, M: string, R: string, yy: number, hh: number) => {
    const k = hh / tex(M).height;
    let wl = nb.left ? 0 : tex(L).width * k, wr = nb.right ? 0 : tex(R).width * k;
    if (wl + wr > w) { const f = w / (wl + wr); wl *= f; wr *= f; }
    if (wl) ct.add(scene.add.image(0, yy, L).setOrigin(0, 0).setDisplaySize(Math.round(wl) + 1, hh));
    const rem = w - Math.round(wl) - Math.round(wr);
    if (rem > 0) {
      const n = Math.max(1, Math.round(rem / (tex(M).width * k)));
      for (let i = 0; i < n; i++) { const xa = Math.round(wl + (rem * i) / n), xb = Math.round(wl + (rem * (i + 1)) / n); ct.add(scene.add.image(xa, yy, M).setOrigin(0, 0).setDisplaySize(xb - xa + 1, hh)); }
    }
    if (wr) ct.add(scene.add.image(w - Math.round(wr), yy, R).setOrigin(0, 0).setDisplaySize(Math.round(wr), hh));
  };
  if (h <= PF_H) { row('pf_l', 'pf_m', 'pf_r', 0, PF_H); return ct; }
  const y1 = TOP_H - 2, bodyH = h - y1;
  const dirt = scene.add.tileSprite(0, y1, w, bodyH, 'dirt').setOrigin(0, 0).setTileScale(DIRT_SCALE);
  dirt.tilePositionX = x / DIRT_SCALE; dirt.tilePositionY = (y + y1) / DIRT_SCALE;   // motif continu d'un bloc à l'autre
  ct.add(dirt);
  const ink = (ix: number, iy: number, iw: number, ih: number) => ct.add(scene.add.rectangle(ix, iy, iw, ih, COL.outline).setOrigin(0, 0));
  if (!nb.left) ink(0, y1, 3, bodyH);
  if (!nb.right) ink(w - 3, y1, 3, bodyH);
  if (!nb.bottomOpen) ink(0, h - 3, w, 3);
  row('top_l', 'top_m', 'top_r', 0, TOP_H);
  return ct;
}

// petites fissures dessinées sur un sol piégé : l'indice visuel d'un faux sol
export function drawCracks(scene: Phaser.Scene, ct: Phaser.GameObjects.Container, w: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(2, COL.outline, 0.55);
  for (let x = 18; x < w - 12; x += 46) {
    g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 6, 44); g.lineTo(x + 2, 54); g.moveTo(x + 6, 44); g.lineTo(x + 14, 48); g.strokePath();
  }
  ct.add(g);
  return g;
}

// Décor de fond en deux couches de parallaxe (lointain + arbres) qui suivent la caméra.
export class Parallax {
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  private farFill: Phaser.GameObjects.Rectangle;
  private midFill: Phaser.GameObjects.Rectangle;
  constructor(scene: Phaser.Scene, private groundY: number, depth = -10) {
    const fs = 0.82, ms = 0.62, ft = scene.textures.get('bg_far').getSourceImage(), mt = scene.textures.get('bg_mid').getSourceImage();
    this.far = scene.add.tileSprite(0, 0, 960 / fs + 4, ft.height, 'bg_far').setOrigin(0, 0).setScale(fs).setScrollFactor(0).setDepth(depth);
    this.farFill = scene.add.rectangle(0, 0, 960, 600, 0x22b268).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    this.mid = scene.add.tileSprite(0, 0, 960 / ms + 4, mt.height, 'bg_mid').setOrigin(0, 0).setScale(ms).setScrollFactor(0).setDepth(depth + 1);
    this.midFill = scene.add.rectangle(0, 0, 960, 600, 0x36c770).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1);
    this.update(0, 0);
  }
  update(camX: number, camY: number, drift = 0): void {
    const oy = -camY * 0.3, fh = this.far.height * this.far.scaleY, mh = this.mid.height * this.mid.scaleY;
    const fy = this.groundY - fh + 24 + oy, my = this.groundY - mh + 34 + oy;
    this.far.setY(fy); this.far.tilePositionX = (camX * 0.12 + drift * 0.3) / this.far.scaleX; this.farFill.setY(fy + fh - 1);
    this.mid.setY(my); this.mid.tilePositionX = (camX * 0.3 + drift) / this.mid.scaleX; this.midFill.setY(my + mh - 1);
  }
}
