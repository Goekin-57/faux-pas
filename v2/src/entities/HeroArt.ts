// Personnages dessinés par le code — PROVISOIRE, en attendant les planches d'images définitives.
// Chaque perso = corps + yeux + pieds séparés, pour pouvoir l'animer (clignement, regard, course, squash & stretch).
import Phaser from 'phaser';
import { COL } from '../core/config';

export const CHARS = [
  { id: 'rosa', name: 'Rosa', col: 0xff4f87 },
  { id: 'tomy', name: 'Tomy', col: 0xff5a3c },
  { id: 'bip', name: 'Bip', col: 0xb8c0d9 },
  { id: 'glagla', name: 'Glagla', col: 0xa8f0ff },
  { id: 'boo', name: 'Boo', col: 0xffffff },
  { id: 'croa', name: 'Croa', col: 0x5fd36b },
  { id: 'pepite', name: 'Pépite', col: 0xffc21a },
] as const;
export type CharId = (typeof CHARS)[number]['id'];

const S = 2;   // les textures sont dessinées en double taille pour rester nettes
const shade = (c: number, k: number) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return (f(r) << 16) | (f(g) << 8) | f(b); };

export function makeHeroTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hero_eye')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const ol = COL.outline;
  for (const c of CHARS) {
    g.clear();
    const w = 30 * S, h = 34 * S, pad = 6 * S, base = c.col, dark = shade(base, -0.22), light = shade(base, 0.45);
    const body = (fill: number, inset = 0) => {
      g.fillStyle(fill, 1);
      const x = pad + inset, y = pad + inset + 4 * S, ww = w - inset * 2, hh = h - 4 * S - inset * 2;
      if (c.id === 'tomy') g.fillEllipse(pad + w / 2, pad + h / 2 + 2 * S, ww, hh);
      else if (c.id === 'boo') { g.fillRoundedRect(x, y, ww, hh - 4 * S, { tl: 14 * S, tr: 14 * S, bl: 0, br: 0 }); for (let i = 0; i < 4; i++) g.fillCircle(x + (i + 0.5) * (ww / 4), y + hh - 5 * S, ww / 8); }
      else if (c.id === 'croa') { g.fillRoundedRect(x, y + 6 * S, ww, hh - 6 * S, 10 * S); g.fillCircle(x + 8 * S, y + 6 * S, 7 * S - inset); g.fillCircle(x + ww - 8 * S, y + 6 * S, 7 * S - inset); }
      else g.fillRoundedRect(x, y, ww, hh, c.id === 'bip' ? 4 * S : 9 * S);
    };
    body(ol, -2.5 * S);        // contour
    body(dark);                // ombre
    body(base, 0);
    // dégradé simple : on redessine la partie haute plus claire
    g.fillStyle(light, 0.55); g.fillEllipse(pad + 9 * S, pad + 12 * S, 8 * S, 12 * S);
    g.fillStyle(dark, 0.6); g.fillRect(pad + 3 * S, pad + h - 6 * S, w - 6 * S, 2 * S);
    // détails propres à chaque perso
    if (c.id === 'tomy') { g.fillStyle(ol, 1); g.fillTriangle(pad + w / 2 - 9 * S, pad + 4 * S, pad + w / 2 + 9 * S, pad + 4 * S, pad + w / 2, pad + 10 * S); g.fillStyle(0x3fae4f, 1); g.fillTriangle(pad + w / 2 - 7 * S, pad + 5 * S, pad + w / 2 + 7 * S, pad + 5 * S, pad + w / 2, pad + 9 * S); }
    if (c.id === 'bip') { g.fillStyle(ol, 1); g.fillRect(pad + w / 2 - 1.5 * S, pad - 4 * S, 3 * S, 9 * S); g.fillStyle(COL.pink, 1); g.fillCircle(pad + w / 2, pad - 4 * S, 3.5 * S); }
    if (c.id === 'glagla') { g.fillStyle(0xffffff, 0.8); g.fillRect(pad + 5 * S, pad + 9 * S, 3 * S, 12 * S); }
    if (c.id === 'pepite') { g.fillStyle(ol, 1); g.fillTriangle(pad + 6 * S, pad + 5 * S, pad + w - 6 * S, pad + 5 * S, pad + w / 2, pad - 5 * S); g.fillStyle(COL.sun, 1); g.fillTriangle(pad + 8 * S, pad + 4 * S, pad + w - 8 * S, pad + 4 * S, pad + w / 2, pad - 3 * S); g.fillStyle(COL.pink, 1); g.fillCircle(pad + w / 2, pad + 1 * S, 1.8 * S); }
    g.generateTexture('hero_' + c.id, w + pad * 2, h + pad * 2);
  }
  g.clear(); g.fillStyle(ol, 1); g.fillEllipse(8 * S, 9 * S, 12 * S, 15 * S); g.fillStyle(0xffffff, 1); g.fillEllipse(8 * S, 9 * S, 9 * S, 12 * S); g.generateTexture('hero_eye', 16 * S, 18 * S);
  g.clear(); g.fillStyle(COL.ink, 1); g.fillCircle(3 * S, 3 * S, 2.6 * S); g.fillStyle(0xffffff, 1); g.fillCircle(2.2 * S, 2 * S, 0.9 * S); g.generateTexture('hero_pupil', 6 * S, 6 * S);
  g.clear(); g.fillStyle(COL.ink, 1); g.fillEllipse(5 * S, 3 * S, 10 * S, 6 * S); g.generateTexture('hero_foot', 10 * S, 6 * S);
  g.clear(); g.lineStyle(2 * S, COL.ink, 1); g.beginPath(); g.arc(4 * S, 1 * S, 3 * S, 0.2, Math.PI - 0.2); g.strokePath(); g.generateTexture('hero_smile', 8 * S, 6 * S);
  g.clear(); g.fillStyle(COL.ink, 1); g.fillEllipse(3 * S, 3.5 * S, 5 * S, 6 * S); g.generateTexture('hero_ooh', 6 * S, 7 * S);
  g.clear(); g.lineStyle(2 * S, COL.ink, 1); g.lineBetween(1 * S, 1 * S, 7 * S, 7 * S); g.lineBetween(7 * S, 1 * S, 1 * S, 7 * S); g.generateTexture('hero_x', 8 * S, 8 * S);
  g.clear(); g.fillStyle(0x000000, 0.22); g.fillEllipse(16 * S, 4 * S, 30 * S, 7 * S); g.generateTexture('hero_shadow', 32 * S, 8 * S);
  // pansement : montre qu'on a pris un coup, sans barre de vie
  g.clear(); g.fillStyle(COL.outline, 1); g.fillRoundedRect(0, 0, 16 * S, 7 * S, 3 * S); g.fillStyle(0xf6d3a8, 1); g.fillRoundedRect(1 * S, 1 * S, 14 * S, 5 * S, 2 * S);
  g.fillStyle(0xe2b384, 1); g.fillRect(6 * S, 1 * S, 4 * S, 5 * S); g.generateTexture('hero_band', 16 * S, 7 * S);
  g.destroy();
}

export type Mood = 'normal' | 'happy' | 'hurt' | 'surprise';

// Vue animée d'un personnage. Le point d'ancrage est au milieu des pieds.
export class HeroView extends Phaser.GameObjects.Container {
  private body_: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[] = [];
  private pupils: Phaser.GameObjects.Image[] = [];
  private feet: Phaser.GameObjects.Image[] = [];
  private mouth: Phaser.GameObjects.Image;
  private bands: Phaser.GameObjects.Image[] = [];
  private xs: Phaser.GameObjects.Image[] = [];
  private inner: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  char: CharId;
  face = 1;
  private blinkT = 2;
  private blinkLeft = 0;
  private lookX = 0;
  private lookY = 0;
  mood: Mood = 'normal';
  runPhase = 0;
  squash = { x: 1, y: 1 };

  constructor(scene: Phaser.Scene, x: number, y: number, char: CharId) {
    super(scene, x, y);
    makeHeroTextures(scene);
    this.char = char;
    this.shadow = scene.add.image(0, 1, 'hero_shadow').setScale(1 / S).setAlpha(0.9);
    this.inner = scene.add.container(0, 0);
    this.feet = [-7, 7].map((fx) => scene.add.image(fx, -2, 'hero_foot').setScale(1 / S));
    this.body_ = scene.add.image(0, -21, 'hero_' + char).setScale(1 / S);
    const ey = char === 'croa' ? -32 : char === 'tomy' ? -24 : -26;
    this.eyes = [-6, 6].map((ex) => scene.add.image(ex, ey, 'hero_eye').setScale(1 / S));
    this.pupils = [-6, 6].map((ex) => scene.add.image(ex, ey, 'hero_pupil').setScale(1 / S));
    this.xs = [-6, 6].map((ex) => scene.add.image(ex, ey, 'hero_x').setScale(1 / S).setVisible(false));
    this.mouth = scene.add.image(1, ey + 10, 'hero_smile').setScale(1 / S).setVisible(false);
    this.bands = [scene.add.image(-6, -12, 'hero_band').setScale(1 / S).setAngle(-30).setVisible(false), scene.add.image(7, -33, 'hero_band').setScale(1 / S).setAngle(25).setVisible(false)];
    this.inner.add([...this.feet, this.body_, ...this.eyes, ...this.pupils, ...this.xs, this.mouth, ...this.bands]);
    this.add([this.shadow, this.inner]);
    scene.add.existing(this);
  }

  setChar(id: CharId): void {
    this.char = id; this.body_.setTexture('hero_' + id);
    const ey = id === 'croa' ? -32 : id === 'tomy' ? -24 : -26;
    [...this.eyes, ...this.pupils, ...this.xs].forEach((o) => o.setY(ey)); this.mouth.setY(ey + 10);
  }
  // nombre de coups reçus (0, 1 ou 2) : un pansement par coup
  setDamage(n: number): void { this.bands.forEach((b, i) => b.setVisible(i < n)); }
  look(x: number, y: number): void { this.lookX = Phaser.Math.Clamp(x, -1, 1); this.lookY = Phaser.Math.Clamp(y, -1, 1); }

  // st : état de déplacement fourni par le contrôleur (ou le menu)
  tick(dt: number, st: { run: boolean; air: boolean; vy: number; speed: number }): void {
    // clignement
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkLeft = 0.12; this.blinkT = 2 + Math.random() * 3; }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    const hurt = this.mood === 'hurt', sur = this.mood === 'surprise';
    this.eyes.forEach((e) => e.setScale(1 / S, (this.blinkLeft > 0 && !sur ? 0.15 : sur ? 1.2 : 1) / S).setVisible(!hurt));
    const lx = this.lookX || this.face * 0.6, ly = this.lookY || (st.air ? Phaser.Math.Clamp(st.vy / 600, -1, 1) : 0);
    this.pupils.forEach((p, i) => p.setPosition([-6, 6][i] + lx * 2, this.eyes[i].y + ly * 2.5).setVisible(!hurt && this.blinkLeft <= 0).setScale((sur ? 0.7 : 1) / S));
    this.xs.forEach((x) => x.setVisible(hurt));
    this.mouth.setVisible(this.mood !== 'normal').setTexture(this.mood === 'happy' ? 'hero_smile' : 'hero_ooh');
    // pieds : course, saut
    if (st.run && !st.air) this.runPhase += dt * (8 + st.speed / 30);
    const r = this.runPhase;
    this.feet.forEach((f, i) => {
      if (st.air) f.setPosition([-6, 6][i], -1 + (i ? -2 : 1)).setAngle(st.vy < 0 ? -15 * this.face : 10 * this.face);
      else if (st.run) f.setPosition([-7, 7][i] + Math.cos(r + i * Math.PI) * 4, -2 - Math.max(0, Math.sin(r + i * Math.PI)) * 4).setAngle(0);
      else f.setPosition([-7, 7][i], -2).setAngle(0);
    });
    // squash & stretch : retour en douceur vers 1
    this.squash.x += (1 - this.squash.x) * Math.min(1, dt * 12);
    this.squash.y += (1 - this.squash.y) * Math.min(1, dt * 12);
    const bob = !st.air && !st.run ? Math.sin(this.scene.time.now / 380) * 0.025 : st.run && !st.air ? Math.abs(Math.sin(r)) * 0.04 : 0;
    const airStretch = st.air ? Phaser.Math.Clamp(Math.abs(st.vy) / 2600, 0, 0.12) : 0;
    this.inner.setScale(this.face * this.squash.x * (1 - airStretch * 0.6), this.squash.y * (1 + bob + airStretch));
    this.inner.setAngle(st.run && !st.air ? this.face * 4 : 0);
    this.shadow.setVisible(!st.air).setScale((1 / S) * (st.air ? 0.6 : 1), 1 / S);
  }
  punch(sx: number, sy: number): void { this.squash.x = sx; this.squash.y = sy; }
}
