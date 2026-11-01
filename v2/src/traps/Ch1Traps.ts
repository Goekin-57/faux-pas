// Pièges et petites bêtes du chapitre 1. Chaque piège se trahit avant d'agir :
// il tremble, grince, fait tomber des cailloux, projette une ombre, ou une petite bête montre le danger.
import Phaser from 'phaser';
import { COL } from '../core/config';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import type { Player } from '../entities/Player';
import { G, type Block, type LevelDef, type Sensor, type Target } from '../levels/types';
import { buildBlock } from '../levels/Terrain';
import { readable } from '../ui/Hints';

export interface Ctx {
  scene: Phaser.Scene; player: Player; def: LevelDef; deaths: number;
  burst(x: number, y: number, k: 'dust' | 'chips' | 'spark' | 'leaf', n?: number): void;
  shake(ms: number, k: number): void;
  hurt(x: number): void; kill(cause: string): void;
  cue(text: string, x: number, y: number, prio?: number): void;
  collide(zone: Phaser.GameObjects.Zone): void;
  snapFlower(x: number): void;
  unlockCoins(x: number, y: number, r: number): void;
}
export interface Trap { update(dt: number, t: number): void; onJump?(): void }

const solidZone = (c: Ctx, x: number, y: number, w: number, h: number) => {
  const zone = c.scene.add.zone(x + w / 2, y + h / 2, w, h); c.scene.physics.add.existing(zone, true); c.collide(zone);
  return { zone, body: zone.body as Phaser.Physics.Arcade.StaticBody };
};
const strong = () => readable();

// ---------------------------------------------------------------- papillons
// Ils se posent sur les fleurs inoffensives. Celui qui a « eat » va se poser sur une fleur piégée… et se fait croquer.
export class Butterflies implements Trap {
  private list: { g: Phaser.GameObjects.Graphics; hx: number; x: number; y: number; eat?: number; state: 'rest' | 'fly' | 'gone'; ph: number }[] = [];
  constructor(private c: Ctx, defs: { x: number; eat?: number }[]) {
    const cols = [COL.sun, COL.lilac, 0x7fd8ff, 0xff9ec4];
    defs.forEach((d, i) => {
      const g = c.scene.add.graphics().setDepth(11), col = cols[i % cols.length];
      g.fillStyle(COL.outline, 1); g.fillEllipse(-6, -2, 13, 11); g.fillEllipse(6, -2, 13, 11); g.fillEllipse(-4, 5, 9, 7); g.fillEllipse(4, 5, 9, 7);
      g.fillStyle(col, 1); g.fillEllipse(-6, -2, 10, 8); g.fillEllipse(6, -2, 10, 8); g.fillEllipse(-4, 5, 6, 5); g.fillEllipse(4, 5, 6, 5);
      g.fillStyle(COL.outline, 1); g.fillRect(-1, -6, 2, 14);
      this.list.push({ g, hx: d.x, x: d.x, y: G - 34, eat: d.eat, state: 'rest', ph: i * 1.7 });
    });
  }
  update(dt: number, t: number): void {
    const p = this.c.player;
    for (const b of this.list) {
      if (b.state === 'gone') continue;
      if (b.state === 'rest') {
        b.x = b.hx + Math.sin(t * 0.9 + b.ph) * 16; b.y = G - 40 + Math.cos(t * 1.4 + b.ph) * 8;
        b.g.setScale(0.35 + 0.65 * Math.abs(Math.sin(t * 9 + b.ph)), 1);
        if (b.eat != null && p.x > b.eat - 480) b.state = 'fly';
      } else {
        const tx = b.eat!, ty = G - 30, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
        b.x += (dx / d) * 175 * dt; b.y += (dy / d) * 175 * dt + Math.sin(t * 7) * 0.8;
        b.g.setScale(0.3 + 0.7 * Math.abs(Math.sin(t * 16)), 1);
        if (d < 8) { b.state = 'gone'; b.g.setVisible(false); this.c.snapFlower(tx); this.c.burst(tx, G - 34, 'leaf', 8); }
      }
      b.g.setPosition(b.x, b.y).setScale(b.g.scaleX * 1.5, 1.5);
    }
  }
}

// ---------------------------------------------------------------- coccinelles
// Elles se promènent et sautent par-dessus les sols piégés : regarder où elles ne marchent pas.
export class Critters implements Trap {
  private list: { g: Phaser.GameObjects.Graphics; x: number; y: number; minX: number; maxX: number; vx: number; hop: { x0: number; x1: number; t: number; dur: number } | null }[] = [];
  private danger: Block[];
  constructor(c: Ctx, defs: { x: number; minX: number; maxX: number }[]) {
    this.danger = c.def.blocks.filter((b) => (b.kind === 'fake' || b.kind === 'crumble') && b.y === G);
    for (const d of defs) {
      const g = c.scene.add.graphics().setDepth(9);
      g.fillStyle(COL.outline, 1); g.fillEllipse(0, -6, 18, 13); g.fillCircle(8, -5, 4);
      g.fillStyle(0xe8413c, 1); g.fillEllipse(0, -6, 15, 10);
      g.fillStyle(COL.outline, 1); g.fillRect(-0.5, -11, 1, 10); g.fillCircle(-4, -7, 1.6); g.fillCircle(3, -4, 1.6); g.fillCircle(-3, -3, 1.4);
      this.list.push({ g, x: d.x, y: G, minX: d.minX, maxX: d.maxX, vx: 38, hop: null });
    }
  }
  update(dt: number): void {
    for (const k of this.list) {
      if (k.hop) {
        k.hop.t += dt; const f = Math.min(1, k.hop.t / k.hop.dur);
        k.x = k.hop.x0 + (k.hop.x1 - k.hop.x0) * f; k.y = G - Math.sin(f * Math.PI) * 38;
        if (f >= 1) { k.hop = null; k.y = G; }
      } else {
        const nx = k.x + k.vx * dt;
        const b = this.danger.find((b) => (k.vx > 0 ? k.x < b.x - 6 && nx >= b.x - 6 : k.x > b.x + b.w + 6 && nx <= b.x + b.w + 6));
        if (b) { const x1 = k.vx > 0 ? b.x + b.w + 8 : b.x - 8; k.hop = { x0: k.x, x1, t: 0, dur: Math.abs(x1 - k.x) / 110 }; }
        else { k.x = nx; if (k.x < k.minX || k.x > k.maxX) { k.vx *= -1; k.x = Phaser.Math.Clamp(k.x, k.minX, k.maxX); } }
      }
      k.g.setPosition(k.x, k.y + 1).setScale(k.vx > 0 ? 1 : -1, 1);
    }
  }
}

// ---------------------------------------------------------------- porte qui s'enfuit
// Elle recule un peu (elle a peur), puis part en courant jusqu'à l'arrêt suivant. Au dernier, elle est épuisée.
export class FleeDoor implements Trap {
  x: number; private i: number; private state: 'idle' | 'scared' | 'run' | 'tired' = 'idle'; private t = 0;
  private legs: Phaser.GameObjects.Graphics;
  constructor(private c: Ctx, private img: Phaser.GameObjects.Image, private stops: number[], startAt = 0) {
    this.i = Math.min(startAt, stops.length - 1); this.x = stops[this.i];
    this.legs = c.scene.add.graphics().setDepth(5);
    if (this.i === stops.length - 1) this.state = 'tired';
    img.setX(this.x);
  }
  get ready(): boolean { return this.state === 'tired'; }
  update(dt: number, t: number): void {
    const p = this.c.player, g = this.legs; g.clear();
    this.t += dt;
    if (this.state === 'idle') {
      this.img.setAngle(Math.sin(t * 2) * 1.2);
      if (!p.dead && Math.abs(p.x - this.x) < 175) { this.state = 'scared'; this.t = 0; AudioManager.play('fake'); }
    } else if (this.state === 'scared') {
      // elle recule légèrement en tremblant : c'est l'annonce
      this.img.setX(this.x + Math.min(1, this.t / 0.3) * 14 + Math.sin(t * 70) * 2).setAngle(8);
      if (this.t > 0.32) { this.state = 'run'; this.t = 0; AudioManager.play('whoosh'); }
    } else if (this.state === 'run') {
      const to = this.stops[this.i + 1];
      this.x = Math.min(to, this.x + 430 * dt); this.img.setX(this.x).setAngle(-6 + Math.sin(t * 30) * 4);
      if (Math.floor(this.t * 12) % 2 === 0) this.c.burst(this.x - 30, G, 'dust', 1);
      const k = Math.sin(t * 30) * 9; g.lineStyle(4, COL.outline, 1); g.lineBetween(this.x - 12, G - 6, this.x - 12 + k, G + 2); g.lineBetween(this.x + 12, G - 6, this.x + 12 - k, G + 2);
      if (this.x >= to) { this.i++; this.state = this.i === this.stops.length - 1 ? 'tired' : 'idle'; this.t = 0; if (this.state === 'tired') { this.c.burst(this.x, G - 30, 'dust', 14); AudioManager.play('stomp'); } }
    } else {
      // épuisée : elle halète, elle ne bouge plus
      this.img.setAngle(0).setX(this.x).setScale(this.img.scaleX, (64 / this.img.height) * (1 + Math.sin(t * 9) * 0.03));
      if (Math.floor(t * 2.5) % 3 === 0 && Math.floor(this.t * 60) % 20 === 0) this.c.burst(this.x + 40, G - 50, 'dust', 1);
    }
  }
}

// ---------------------------------------------------------------- plateforme timide
// Elle a des yeux. Quand tu es près, elle tremble et transpire ; si tu sautes, elle plonge… puis remonte, toute rouge,
// et reste sage un moment. Deux solutions : sauter de loin (elle ne te voit pas venir) ou faire semblant d'abord.
export class ShyPlatform implements Trap {
  private y: number; private state: 'calm' | 'nervous' | 'duck' | 'back' | 'blush' = 'calm'; private t = 0;
  private ct: Phaser.GameObjects.Container; private face: Phaser.GameObjects.Graphics; private zone: Phaser.GameObjects.Zone; private body: Phaser.Physics.Arcade.StaticBody;
  constructor(private c: Ctx, private x: number, private y0: number, private w: number, private radius: number) {
    this.y = y0;
    this.ct = buildBlock(c.scene, x, y0, w, 30, {}).setDepth(4);
    this.face = c.scene.add.graphics(); this.ct.add(this.face);
    const s = solidZone(c, x, y0, w, 30); this.zone = s.zone; this.body = s.body;
  }
  private onIt(): boolean { const p = this.c.player; return p.onGround && p.x + 12 > this.x && p.x - 12 < this.x + this.w && Math.abs(p.y - this.y) < 5; }
  private dist(): number { const p = this.c.player; return Math.max(this.x - p.x, p.x - (this.x + this.w), 0); }
  onJump(): void {
    if ((this.state === 'calm' || this.state === 'nervous') && this.dist() < this.radius && !this.onIt()) {
      this.state = 'duck'; this.t = 0; AudioManager.play('whoosh'); this.c.burst(this.x + this.w / 2, this.y + 20, 'leaf', 6);
    }
  }
  update(dt: number, t: number): void {
    this.t += dt;
    const p = this.c.player, near = !p.dead && this.dist() < this.radius && !this.onIt();
    let ox = 0;
    if (this.state === 'calm' && near) this.state = 'nervous';
    if (this.state === 'nervous') { ox = Math.sin(t * 55) * 1.6; if (!near) this.state = 'calm'; }
    if (this.state === 'duck') { this.y = this.y0 + Math.min(1, this.t / 0.16) * 150; if (this.t > 1.05) { this.state = 'back'; this.t = 0; } }
    if (this.state === 'back') { this.y = this.y0 + (1 - Math.min(1, this.t / 0.5)) * 150; if (this.t > 0.5) { this.y = this.y0; this.state = 'blush'; this.t = 0; } }
    if (this.state === 'blush' && this.t > (strong() ? 3.5 : 2.6)) { this.state = 'calm'; this.t = 0; }
    this.ct.setPosition(this.x + ox, this.y); this.zone.setPosition(this.x + this.w / 2, this.y + 15); this.body.updateFromGameObject();
    // visage : yeux qui suivent le joueur, goutte de sueur quand elle est nerveuse, joues roses quand elle a honte
    const f = this.face; f.clear();
    const ex = this.w / 2, lk = Phaser.Math.Clamp((p.x - (this.x + ex)) / 120, -1, 1) * 3, scared = this.state === 'nervous' || this.state === 'duck';
    f.fillStyle(0xffffff, 1); f.fillEllipse(ex - 12, 30, scared ? 12 : 10, scared ? 13 : 9); f.fillEllipse(ex + 12, 30, scared ? 12 : 10, scared ? 13 : 9);
    f.fillStyle(COL.outline, 1); f.fillCircle(ex - 12 + lk, 31, 2.6); f.fillCircle(ex + 12 + lk, 31, 2.6);
    if (scared) { f.fillStyle(0x7fd8ff, 1); f.fillTriangle(ex + 24, 18, ex + 21, 26, ex + 27, 26); f.fillCircle(ex + 24, 26, 3); }
    if (this.state === 'blush') { f.fillStyle(COL.pink, 0.8); f.fillEllipse(ex - 22, 36, 9, 5); f.fillEllipse(ex + 22, 36, 9, 5); }
  }
}

// ---------------------------------------------------------------- capteurs, câbles et ce qu'ils déclenchent
interface TargetRt { def: Target; anchor: { x: number; y: number }; trigger(): void; update(dt: number, t: number): void }

export class Links implements Trap {
  private targets = new Map<string, TargetRt>();
  private sensors: { def: Sensor; g: Phaser.GameObjects.Graphics; cable: { x: number; y: number }[]; down: boolean; flash: number; cableG: Phaser.GameObjects.Graphics; pulse: Phaser.GameObjects.Arc }[] = [];
  constructor(private c: Ctx, sensors: Sensor[], targets: Target[]) {
    for (const td of targets) this.targets.set(td.id, this.makeTarget(td));
    for (const sd of sensors) {
      const tg = this.targets.get(sd.target); if (!tg) continue;
      const g = c.scene.add.graphics().setDepth(6);
      const sy = G - 3, path = [{ x: sd.x, y: sd.kind === 'eye' ? G - 20 : sy }, { x: sd.x, y: sy }, { x: tg.anchor.x, y: sy }, tg.anchor];
      const cableG = c.scene.add.graphics().setDepth(5);
      const col = sd.kind === 'bigbutton' ? COL.sun : sd.kind === 'eye' ? COL.pink : COL.mint;
      cableG.lineStyle(6, COL.outline, 1); cableG.strokePoints(path as Phaser.Math.Vector2[], false);
      cableG.lineStyle(3, col, 1); cableG.strokePoints(path as Phaser.Math.Vector2[], false);
      if (strong() || c.deaths >= 2) this.c.scene.tweens.add({ targets: cableG, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });
      const pulse = c.scene.add.circle(0, 0, 6, 0xffffff, 1).setDepth(7).setVisible(false).setStrokeStyle(2, col);
      this.sensors.push({ def: sd, g, cable: path, down: false, flash: 0, cableG, pulse });
      if (sd.kind === 'eye' && sd.zone) {
        // le regard de l'œil : un cône translucide qui montre la zone surveillée
        const cone = c.scene.add.graphics().setDepth(2);
        cone.fillStyle(COL.pink, strong() ? 0.28 : 0.18); cone.fillTriangle(sd.x, G - 74, sd.zone[0], G, sd.zone[1], G);
        cone.lineStyle(2, COL.pink, 0.7); cone.lineBetween(sd.x, G - 74, sd.zone[0], G); cone.lineBetween(sd.x, G - 74, sd.zone[1], G);
        cone.lineStyle(4, COL.pink, 0.8); cone.lineBetween(sd.zone[0], G - 2, sd.zone[1], G - 2);
      }
    }
  }
  private send(s: Links['sensors'][number]): void {
    s.flash = 0.5; AudioManager.play('click');
    const tg = this.targets.get(s.def.target)!;
    const pts = s.cable, segs = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)), tot = segs.reduce((a, b) => a + b, 0) || 1;
    const o = { k: 0 }; s.pulse.setVisible(true);
    this.c.scene.tweens.add({ targets: o, k: 1, duration: 160, onUpdate: () => {
      let d = o.k * tot, i = 0; while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
      const a = pts[i], b = pts[i + 1], f = segs[i] ? Math.min(1, d / segs[i]) : 1; s.pulse.setPosition(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    }, onComplete: () => { s.pulse.setVisible(false); tg.trigger(); } });
  }
  onJump(): void {
    const p = this.c.player;
    for (const s of this.sensors) if (s.def.kind === 'eye' && s.def.zone && p.x >= s.def.zone[0] && p.x <= s.def.zone[1]) this.send(s);
  }
  update(dt: number, t: number): void {
    const p = this.c.player;
    for (const s of this.sensors) {
      s.flash = Math.max(0, s.flash - dt);
      const g = s.g; g.clear(); const x = s.def.x;
      if (s.def.kind === 'eye') {
        // totem avec un œil qui suit le joueur ; il devient rouge quand il te voit sauter
        g.fillStyle(COL.outline, 1); g.fillRect(x - 5, G - 64, 10, 64); g.fillStyle(0x8a6a4a, 1); g.fillRect(x - 3, G - 62, 6, 62);
        const inZ = s.def.zone && p.x >= s.def.zone[0] - 40 && p.x <= s.def.zone[1] + 40;
        g.fillStyle(COL.outline, 1); g.fillCircle(x, G - 76, 17); g.fillStyle(s.flash > 0 ? 0xff3355 : 0xffffff, 1); g.fillCircle(x, G - 76, 14);
        const lx = Phaser.Math.Clamp((p.x - x) / 80, -1, 1) * 6, ly = Phaser.Math.Clamp((p.y - 30 - (G - 76)) / 80, -1, 1) * 4;
        if (inZ || s.flash > 0) { g.fillStyle(COL.outline, 1); g.fillCircle(x + lx, G - 76 + ly, 6); }
        else { g.fillStyle(0xd9c7a8, 1); g.fillRect(x - 14, G - 80, 28, 8); g.lineStyle(3, COL.outline, 1); g.lineBetween(x - 13, G - 76, x + 13, G - 76); }   // il dort
      } else {
        const big = s.def.kind === 'bigbutton', w = big ? 60 : 34;
        const on = !p.dead && p.onGround && Math.abs(p.x - x) < w / 2 + 6 && Math.abs(p.y - G) < 4;
        if (on && !s.down) this.send(s);
        s.down = on;
        const hh = on ? 4 : big ? 14 : 9;
        g.fillStyle(COL.outline, 1); g.fillRoundedRect(x - w / 2 - 3, G - hh - 3, w + 6, hh + 6, 6);
        g.fillStyle(big ? COL.sun : 0x9aa0b5, 1); g.fillRoundedRect(x - w / 2, G - hh, w, hh + 2, 5);
        if (big) { g.fillStyle(0xffffff, 0.7); g.fillEllipse(x - 12, G - hh + 4, 14, 4); if (Math.floor(t * 3) % 4 === 0 && Math.floor(t * 60) % 20 === 0) this.c.burst(x + Phaser.Math.Between(-30, 30), G - 20, 'spark', 2); }
      }
    }
    for (const tg of this.targets.values()) tg.update(dt, t);
  }

  private makeTarget(d: Target): TargetRt {
    const c = this.c, sc = c.scene, p = () => c.player;
    if (d.kind === 'gift') {
      // boîte cadeau : elle s'ouvre, sonne, et libère les pièces cachées dedans
      const y = d.y ?? G - 120, g = sc.add.graphics().setDepth(6), lid = sc.add.graphics().setDepth(7);
      g.fillStyle(COL.outline, 1); g.fillRect(d.x - 3, y + 24, 6, G - y - 24); g.fillRoundedRect(d.x - 25, y - 3, 50, 30, 5); g.fillStyle(COL.pink, 1); g.fillRoundedRect(d.x - 22, y, 44, 24, 4); g.fillStyle(COL.sun, 1); g.fillRect(d.x - 4, y, 8, 24);
      lid.fillStyle(COL.outline, 1); lid.fillRoundedRect(-28, -10, 56, 13, 4); lid.fillStyle(COL.pink, 1); lid.fillRoundedRect(-25, -8, 50, 9, 3); lid.fillStyle(COL.sun, 1); lid.fillRect(-4, -8, 8, 9); lid.setPosition(d.x, y);
      sc.time.delayedCall(0, () => c.unlockCoins(d.x, y, -1));   // cache les pièces de la boîte
      let open = false;
      return { def: d, anchor: { x: d.x, y: G - 3 }, update: () => {}, trigger: () => {
        if (open) return; open = true; AudioManager.play('bell'); c.burst(d.x, y - 10, 'spark', 22);
        sc.tweens.add({ targets: lid, y: y - 40, angle: -50, x: d.x - 26, duration: 300, ease: 'Quad.Out' }); c.unlockCoins(d.x, y, 1);
      } };
    }
    if (d.kind === 'ceilspikes') {
      // plafond avec une plaque à pics retenue par des chaînes : elle tombe quand l'œil te voit sauter
      const w = d.w ?? 200, y = d.y ?? 200, h = d.h ?? 40;
      const roof = sc.add.graphics().setDepth(4);
      roof.fillStyle(COL.outline, 1); roof.fillRoundedRect(d.x - 4, y - 4, w + 8, h + 8, 8); roof.fillStyle(0x7a7f98, 1); roof.fillRoundedRect(d.x, y, w, h, 6); roof.fillStyle(0x9aa0b5, 1); for (let i = 10; i < w - 10; i += 34) roof.fillCircle(d.x + i + 6, y + 10, 4);
      const s = solidZone(c, d.x, y, w, h);
      const plate = sc.add.container(d.x, y + h).setDepth(5), pg = sc.add.graphics(), chains = sc.add.graphics().setDepth(4);
      pg.fillStyle(COL.outline, 1); pg.fillRect(0, 0, w, 12); pg.fillStyle(0x5d6178, 1); pg.fillRect(2, 2, w - 4, 8);
      const n = Math.round(w / 34); for (let i = 0; i < n; i++) plate.add(sc.add.image((i * w) / n, 10, 'spikes').setOrigin(0, 0).setFlipY(true).setDisplaySize(w / n + 1, 18));
      plate.addAt(pg, 0);
      let st: 'up' | 'drop' | 'down' | 'rise' = 'up', tt = 0, py = y + h;
      const bottom = G - 30;   // la plaque descend jusqu'à hauteur de tête… et un peu plus
      void s;
      return { def: d, anchor: { x: d.x + w / 2, y: y + h / 2 }, trigger: () => { if (st === 'up') { st = 'drop'; tt = 0; AudioManager.play('trap'); } }, update: (dt) => {
        tt += dt;
        if (st === 'drop') { py = Math.min(bottom, py + 1500 * dt); if (py >= bottom) { st = 'down'; tt = 0; c.shake(140, 0.008); c.burst(d.x + w / 2, G, 'dust', 12); AudioManager.play('stomp'); } }
        else if (st === 'down' && tt > 0.9) { st = 'rise'; }
        else if (st === 'rise') { py = Math.max(y + h, py - 260 * dt); if (py <= y + h) st = 'up'; }
        plate.setY(py);
        chains.clear(); chains.lineStyle(3, COL.outline, 1); for (const cx of [10, w / 2, w - 10]) chains.lineBetween(d.x + cx, y + h, d.x + cx, py);
        const pl = p();
        if (!pl.dead && st !== 'up' && pl.x + 10 > d.x && pl.x - 10 < d.x + w && py + 28 > pl.y - 30 && py < pl.y) c.kill('spikes');
      } };
    }
    if (d.kind === 'bridge') {
      // pont qui se déplie / se replie à chaque saut vu par l'œil
      const w = d.w ?? 300, ct = sc.add.container(d.x, G).setDepth(4), bg = sc.add.graphics();
      for (let x = 0; x < w; x += 30) { bg.fillStyle(COL.outline, 1); bg.fillRoundedRect(x, 0, 30, 18, 3); bg.fillStyle(0xc28a52, 1); bg.fillRoundedRect(x + 2, 2, 26, 14, 2); bg.fillStyle(0x8a5a32, 1); bg.fillRect(x + 4, 8, 22, 2); }
      ct.add(bg); ct.setScale(0.02, 1);
      const s = solidZone(c, d.x, G, w, 18); s.body.enable = false;
      const hinge = sc.add.graphics().setDepth(5); hinge.fillStyle(COL.outline, 1); hinge.fillCircle(d.x, G + 9, 9); hinge.fillStyle(COL.pink, 1); hinge.fillCircle(d.x, G + 9, 5);
      let out = false;
      return { def: d, anchor: { x: d.x, y: G - 3 }, update: () => {}, trigger: () => {
        out = !out; AudioManager.play(out ? 'spring' : 'creak');
        if (out) s.body.enable = true;   // solide tout de suite ; l'animation suit
        sc.tweens.add({ targets: ct, scaleX: out ? 1 : 0.02, duration: out ? 200 : 260, ease: out ? 'Back.Out' : 'Quad.In', onComplete: () => { if (!out) s.body.enable = false; } });
      } };
    }
    if (d.kind === 'gate') {
      // grille fermée : le bon bouton la fait remonter
      const w = d.w ?? 40, h = d.h ?? 170, y = d.y ?? G - h;
      const ct = sc.add.container(d.x, y).setDepth(5), gg = sc.add.graphics(); ct.add(gg);
      gg.fillStyle(COL.outline, 1); gg.fillRect(0, 0, w, h); gg.fillStyle(0x7a7f98, 1); for (let x = 4; x < w - 2; x += 12) gg.fillRect(x, 4, 6, h - 8); gg.fillRect(2, 2, w - 4, 10); gg.fillRect(2, h / 2 - 5, w - 4, 10);
      const s = solidZone(c, d.x, y, w, h); let open = false;
      return { def: d, anchor: { x: d.x + w / 2, y: G - 3 }, update: () => {}, trigger: () => {
        if (open) return; open = true; AudioManager.play('checkpoint'); s.body.enable = false;
        sc.tweens.add({ targets: ct, y: y - h + 16, duration: 700, ease: 'Quad.Out' }); c.burst(d.x + w / 2, G - 10, 'dust', 10);
      } };
    }
    // trappe à charnière : s'ouvre sous tes pieds quelques secondes
    const w = d.w ?? 80, ct = sc.add.container(d.x, G).setDepth(4), hg = sc.add.graphics(); ct.add(hg);
    hg.fillStyle(COL.outline, 1); hg.fillRect(0, 0, w, 22); hg.fillStyle(0xb07a45, 1); hg.fillRect(2, 2, w - 4, 18); hg.fillStyle(0x8a5a32, 1); for (let x = 10; x < w; x += 18) hg.fillRect(x, 2, 3, 18);
    hg.fillStyle(0x5d6178, 1); hg.fillRect(2, 6, 12, 10); hg.fillCircle(6, 11, 4);   // charnière visible
    const s = solidZone(c, d.x, G, w, 22); let busy = false;
    return { def: d, anchor: { x: d.x + 8, y: G + 4 }, update: () => {}, trigger: () => {
      if (busy) return; busy = true; s.body.enable = false; AudioManager.play('trap');
      sc.tweens.add({ targets: ct, angle: 90, duration: 160, ease: 'Quad.In' });
      sc.time.delayedCall(1700, () => { sc.tweens.add({ targets: ct, angle: 0, duration: 300, onComplete: () => { s.body.enable = true; busy = false; } }); });
    } };
  }
}

// ---------------------------------------------------------------- stalactites
// Elles vibrent, perdent des cailloux et leur ombre grandit au sol avant de tomber.
export class Stalactites implements Trap {
  private list: { x: number; y: number; range: number; vib: number; cue?: string; st: 'idle' | 'vib' | 'fall' | 'down'; t: number; py: number; vy: number; g: Phaser.GameObjects.Graphics; shadow: Phaser.GameObjects.Ellipse }[] = [];
  constructor(private c: Ctx, defs: NonNullable<LevelDef['stalactites']>) {
    for (const d of defs) {
      const g = c.scene.add.graphics().setDepth(12);
      g.fillStyle(COL.outline, 1); g.fillTriangle(-14, -2, 14, -2, 0, 44); g.fillStyle(0xa9b0c8, 1); g.fillTriangle(-10, 0, 10, 0, 0, 37); g.fillStyle(0xd8dcef, 1); g.fillTriangle(-6, 0, 0, 0, -1, 26);
      g.setPosition(d.x, d.y);
      const shadow = c.scene.add.ellipse(d.x, G + 2, 6, 4, 0x000000, 0.4).setDepth(8).setVisible(false);
      this.list.push({ ...d, vib: d.vib ?? 0.45, st: 'idle', t: 0, py: d.y, vy: 0, g, shadow });
    }
  }
  update(dt: number, t: number): void {
    const p = this.c.player;
    for (const s of this.list) {
      s.t += dt;
      if (s.st === 'idle') {
        s.g.setAngle(Math.sin(t * 2 + s.x) * 1.5);
        if (!p.dead && Math.abs(p.x - s.x) < s.range) { s.st = 'vib'; s.t = 0; s.shadow.setVisible(true).setDepth(91); s.g.setDepth(91); AudioManager.play('crack'); if (s.cue) this.c.cue(s.cue, s.x, s.y + 60, 2); }
      } else if (s.st === 'vib') {
        s.g.setPosition(s.x + Math.sin(t * 80) * 2, s.y);
        s.shadow.setSize(10 + (s.t / s.vib) * 40, 5 + (s.t / s.vib) * 6);
        if (Math.floor(s.t * 9) !== Math.floor((s.t - dt) * 9)) this.c.burst(s.x, s.y + 6, 'chips', 1);
        if (s.t >= s.vib) { s.st = 'fall'; s.t = 0; s.vy = 200; AudioManager.play('whoosh'); }
      } else if (s.st === 'fall') {
        s.vy += 2600 * dt; s.py += s.vy * dt; s.g.setPosition(s.x, s.py);
        if (!p.dead && Math.abs(p.x - s.x) < 14 + 10 && s.py + 40 > p.y - 30 && s.py < p.y) this.c.kill('spike');
        if (s.py + 30 >= G) { s.py = G - 30; s.st = 'down'; s.g.setPosition(s.x, s.py).setAngle(8); s.shadow.setVisible(false); AudioManager.play('stomp'); this.c.burst(s.x, G, 'chips', 10); this.c.shake(90, 0.005); }
      }
    }
  }
}

// ---------------------------------------------------------------- orage : pluie et éclairs qui éclairent tout
export class Storm implements Trap {
  flash = 0;
  private next: number; private rect: Phaser.GameObjects.Rectangle;
  constructor(private c: Ctx) {
    const sc = c.scene, low = SaveManager.data.settings.reduceFx;
    if (!sc.textures.exists('fx_rain')) { const g = sc.make.graphics({ x: 0, y: 0 }, false); g.fillStyle(0xbfe0ff, 1); g.fillRect(0, 0, 2, 14); g.generateTexture('fx_rain', 2, 14); g.destroy(); }
    sc.add.particles(0, 0, 'fx_rain', { x: { min: -40, max: 1000 }, y: -20, speedY: { min: 650, max: 820 }, speedX: -90, lifespan: 850, quantity: low ? 1 : 3, frequency: 30, alpha: { start: 0.55, end: 0.25 }, rotate: 6 }).setScrollFactor(0).setDepth(86);
    this.rect = sc.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(95);
    this.next = 2.5;
  }
  update(dt: number): void {
    this.next -= dt; this.flash = Math.max(0, this.flash - dt);
    if (this.next <= 0) {
      this.next = (this.c.deaths >= 1 ? 3 : 4.5) + Math.random() * 2;
      this.flash = 0.55; AudioManager.play('thunder');
      const low = SaveManager.data.settings.reduceFx;
      this.rect.setAlpha(low ? 0.12 : 0.5); this.c.scene.tweens.add({ targets: this.rect, alpha: 0, duration: low ? 500 : 380 });
    }
  }
}
