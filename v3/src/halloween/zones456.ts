import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { Audio } from '../core/Audio';
import { Save } from '../core/Save';
import { ensureCanvas } from '../art/textures';
import type { Trap, TrapContext } from '../traps/Trap';
import {
  paintMonster, paintTable, paintChandelier, paintStatue, paintWardrobe, paintGrate, paintDoor, paintExitSign,
  paintSpider, paintCandy, paintGhost, paintPumpkin
} from './art';
import { addFlame, drawCarvedFace, MDEPTH } from './ManorBackdrop';
import { type Kit, staticZone, movingZone, setBodyEnabled, standingOn, hits, carry, say } from './kit';

// =====================================================================================
// ZONE 4 — LE COULOIR DES OMBRES
// =====================================================================================

interface ShadowPlat { x: number; top: number; w: number; zone: Phaser.GameObjects.Zone; gfx: Phaser.GameObjects.Graphics; lit: boolean; litK: number }

/** Bougie à cycle fixe (allumée / éteinte), avec annonce : la flamme naît ou s'étiole. */
interface Candle { kind: 'candle'; x: number; y: number; r: number; on: number; off: number; t: number; gfx: Phaser.GameObjects.Graphics; halo: Phaser.GameObjects.Image }
/** Lanterne dont le faisceau saute d'une plateforme à l'autre (ordre et rythme fixes). */
interface Lantern {
  kind: 'lantern'; px: number; py: number; seq: number[]; dwell: number; move: number; t: number; i: number;
  angle: number; gfx: Phaser.GameObjects.Graphics; beam: Phaser.GameObjects.Graphics; plats: number[]; away?: number; on?: boolean;
}

/**
 * Plateformes d'ombre : SOLIDES seulement quand aucune lumière ne les touche.
 * Règle unique, montrée avant d'être nécessaire (une bougie au-dessus d'un petit fossé sans danger),
 * puis déclinée : lanterne qui balaie, combinaison avec la toile d'araignée.
 */
export class ShadowSection implements Trap {
  readonly id = 'h-shadows';
  private plats: ShadowPlat[] = [];
  private lights: (Candle | Lantern)[] = [];
  private time = 0;

  constructor(private k: Kit) {}

  addPlatform(x: number, top: number, w: number): number {
    const zone = movingZone(this.k, x, top + 9, w, 18);
    const gfx = this.k.scene.add.graphics().setDepth(MDEPTH.glow - 3);
    this.plats.push({ x, top, w, zone, gfx, lit: false, litK: 0 });
    return this.plats.length - 1;
  }

  addCandle(x: number, y: number, r: number, on: number, off: number, phase = 0): void {
    const gfx = this.k.scene.add.graphics().setDepth(MDEPTH.glow);
    const halo = this.k.scene.add.image(x, y - 10, 'dot-warm').setScale(r / 12).setBlendMode(Phaser.BlendModes.ADD).setDepth(MDEPTH.glow - 2).setAlpha(0);
    this.lights.push({ kind: 'candle', x, y, r, on, off, t: phase, gfx, halo });
  }

  addLantern(px: number, py: number, plats: number[], seq: number[], dwell: number, move: number, away?: number): void {
    const gfx = this.k.scene.add.graphics().setDepth(MDEPTH.glow);
    const beam = this.k.scene.add.graphics().setDepth(MDEPTH.glow - 2).setBlendMode(Phaser.BlendModes.ADD);
    this.lights.push({ kind: 'lantern', px, py, seq, dwell, move, t: 0, i: 0, angle: 0, gfx, beam, plats, away });
  }

  /** Angle (depuis la verticale) sous lequel la lanterne voit une plateforme. */
  private angleTo(l: Lantern, pi: number): number {
    if (pi < 0) return l.away ?? 0.9;
    const p = this.plats[pi];
    return Math.atan2(p.x - l.px, p.top - l.py);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    for (const p of this.plats) p.lit = false;
    for (const l of this.lights) {
      if (l.kind === 'candle') this.updateCandle(l, dt, ctx);
      else this.updateLantern(l, dt);
    }
    const pl = ctx.player;
    for (const p of this.plats) {
      setBodyEnabled(p.zone, !p.lit);
      p.litK += ((p.lit ? 1 : 0) - p.litK) * Math.min(1, dt * 10);
      this.drawPlat(p);
      void pl;
    }
  }

  private updateCandle(c: Candle, dt: number, ctx: TrapContext): void {
    c.t += dt;
    const period = c.on + c.off;
    const ph = c.t % period;
    const lit = ph < c.on;
    // annonce : la flamme s'étiole 0,4 s avant de s'éteindre, une étincelle 0,4 s avant de s'allumer
    let flame = lit ? 1 : 0;
    if (lit && ph > c.on - 0.4) flame = 0.35 + 0.25 * Math.sin(this.time * 40);
    if (!lit && ph > period - 0.4) flame = 0.15 + 0.15 * Math.sin(this.time * 50);
    if (lit && ph < dt * 1.5) ctx.sfx('candle', c.x, 0.6);
    c.halo.setAlpha(lit ? 0.55 : flame * 0.3);
    const g = c.gfx;
    g.clear();
    g.fillStyle(0x2a2236, 1);
    g.fillRect(c.x - 3, c.y, 6, 30);
    g.fillRoundedRect(c.x - 12, c.y + 28, 24, 6, 3);
    g.fillStyle(0xfff0c8, 1);
    g.fillRoundedRect(c.x - 5, c.y - 18, 10, 20, 2);
    if (flame > 0.05) {
      g.fillStyle(0xffd36b, 1);
      g.fillEllipse(c.x, c.y - 26, 8 * flame + 2, 16 * flame + 2);
      g.fillStyle(0xfffbe0, 1);
      g.fillEllipse(c.x, c.y - 24, 3 * flame + 1, 7 * flame + 1);
    }
    if (lit) {
      // cercle de lumière : montre exactement la zone éclairée
      g.lineStyle(2, 0xffd36b, 0.18);
      g.strokeCircle(c.x, c.y - 20, c.r);
      for (const p of this.plats) if (Math.abs(p.x - c.x) < c.r) p.lit = true;
    }
  }

  private updateLantern(l: Lantern, dt: number): void {
    l.t += dt;
    const n = l.seq.length;
    const cur = l.seq[l.i % n];
    const next = l.seq[(l.i + 1) % n];
    // retour au début d'une séquence de 3 : la lanterne s'éteint un instant au lieu de balayer
    // (le faisceau ne repasse jamais sur une plateforme où l'on attend)
    const wrap = n > 2 && (l.i % n) === n - 1;
    let a: number;
    let beamOn = true;
    if (l.t < l.dwell) a = this.angleTo(l, cur);
    else {
      const k = Math.min(1, (l.t - l.dwell) / l.move);
      if (wrap) { a = this.angleTo(l, k < 0.5 ? cur : next); beamOn = false; }
      else a = Phaser.Math.Linear(this.angleTo(l, cur), this.angleTo(l, next), Phaser.Math.Easing.Sine.InOut(k));
      if (k >= 1) { l.i++; l.t = 0; }
    }
    l.angle = a;
    l.on = beamOn;
    const cone = 0.13;
    if (beamOn) {
      for (const pi of l.plats) {
        const p = this.plats[pi];
        const d = Math.hypot(p.x - l.px, p.top - l.py);
        const half = Math.atan2(p.w / 2, d);
        if (Math.abs(this.angleTo(l, pi) - a) < cone + half * 0.8) p.lit = true;
      }
    }
    // lanterne qui oscille + faisceau
    const g = l.gfx;
    g.clear();
    g.lineStyle(2, 0x1a1533, 1);
    const hx = l.px + Math.sin(a) * 40, hy = l.py + Math.cos(a) * 40;
    g.lineBetween(l.px, l.py - 200, l.px, l.py);
    g.lineBetween(l.px, l.py, hx, hy);
    g.fillStyle(0x2a2236, 1);
    g.fillRoundedRect(hx - 12, hy - 6, 24, 30, 5);
    g.fillStyle(0xffd36b, 1);
    g.fillRoundedRect(hx - 7, hy, 14, 18, 3);
    const b = l.beam;
    b.clear();
    if (!beamOn) return;
    const len = 520;
    b.fillStyle(0xffd36b, 0.2);
    b.fillTriangle(hx, hy + 10, hx + Math.sin(a - cone) * len, hy + Math.cos(a - cone) * len, hx + Math.sin(a + cone) * len, hy + Math.cos(a + cone) * len);
    b.fillStyle(0xfff0c0, 0.12);
    b.fillTriangle(hx, hy + 10, hx + Math.sin(a - cone * 0.4) * len, hy + Math.cos(a - cone * 0.4) * len, hx + Math.sin(a + cone * 0.4) * len, hy + Math.cos(a + cone * 0.4) * len);
  }

  private drawPlat(p: ShadowPlat): void {
    const g = p.gfx;
    g.clear();
    const k = p.litK;
    const x = p.x - p.w / 2;
    // solide : bloc d'ombre violet profond, liseré spectral (lisible dans le noir)
    g.fillStyle(0x2a1a4a, 0.95 * (1 - k) + 0.12 * k);
    g.fillRoundedRect(x, p.top, p.w, 18, 6);
    g.lineStyle(2, k > 0.5 ? 0xffd36b : 0x9a7ad6, k > 0.5 ? 0.45 : 0.9);
    if (k > 0.5) {
      // éclairée : contour en pointillés (elle n'est plus là)
      for (let i = 0; i < p.w; i += 12) g.lineBetween(x + i, p.top, x + Math.min(p.w, i + 6), p.top);
    } else {
      g.strokeRoundedRect(x, p.top, p.w, 18, 6);
      // volutes d'ombre
      for (let i = 0; i < 3; i++) {
        const wx = x + 12 + i * (p.w - 24) / 2, wy = p.top + 18 + Math.sin(this.time * 3 + i + p.x) * 3;
        g.fillStyle(0x2a1a4a, 0.7);
        g.fillEllipse(wx, wy + 4, 12, 10);
      }
    }
  }

  reset(): void { /* lumières à cycle fixe : rien à remettre à zéro */ }

  destroy(): void {
    this.plats.forEach((p) => p.gfx.destroy());
    for (const l of this.lights) {
      if (l.kind === 'candle') { l.gfx.destroy(); l.halo.destroy(); } else { l.gfx.destroy(); l.beam.destroy(); }
    }
  }
}

/**
 * Toile d'araignée : on tombe dessus, elle s'étire et renvoie vers le haut (jamais mortelle).
 * Variante avec araignée : elle descend au même moment pour faire sursauter le héros —
 * qui la percute en paniquant est repoussé (on retombe dans la toile, on réessaie).
 */
export class SpiderWeb implements Trap {
  readonly id: string;
  private g: Phaser.GameObjects.Graphics;
  private sag = 0;
  private sagV = 0;
  private spider?: Phaser.GameObjects.Container;
  private spT = -1;
  private time = 0;
  private cool = 0;

  constructor(private k: Kit, idx: number, private x0: number, private x1: number, private y: number, private bounce: number, private biasVx: number, private spiderX?: number, private spiderY?: number) {
    this.id = `h-web-${idx}`;
    this.g = k.scene.add.graphics().setDepth(DEPTH.terrain + 3);
    if (spiderX !== undefined) {
      const img = k.scene.add.image(0, 0, ensureCanvas(k.scene, 'mn-spider', () => paintSpider(16)));
      const eyes = k.scene.add.graphics();
      eyes.fillStyle(0xff6b6b, 1);
      for (const [ex, ey] of [[-5, -3], [5, -3], [-2, -6], [2, -6]]) eyes.fillCircle(ex, ey, 1.8);
      this.spider = k.scene.add.container(spiderX, 60, [img, eyes]).setDepth(MDEPTH.glow - 1).setVisible(false);
    }
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    if (this.cool > 0) this.cool -= dt;
    // rebond
    const b = p.body;
    if (p.alive && this.cool <= 0 && b.velocity.y > 50 && b.right > this.x0 && b.left < this.x1 && b.bottom >= this.y - 4 && b.bottom < this.y + 40) {
      this.cool = 0.3;
      this.sagV = 260;
      p.launch(b.velocity.x * 0.4 + this.biasVx, -this.bounce, 0.18);
      ctx.sfx('web', p.x);
      ctx.burst('dust', p.x, this.y, 5);
      if (this.spider && this.spT < 0) this.spT = 0;
    }
    // ressort de la toile
    this.sagV += (-this.sag * 120 - this.sagV * 8) * dt;
    this.sag += this.sagV * dt;
    this.draw(p.x);
    // araignée farceuse
    if (this.spider && this.spT >= 0) {
      this.spT += dt;
      const down = Math.min(1, this.spT / 0.35);
      const up = this.spT > 1.4 ? Math.min(1, (this.spT - 1.4) / 0.4) : 0;
      const y = 60 + (this.spiderY! - 60) * Phaser.Math.Easing.Back.Out(down) * (1 - up);
      this.spider.setVisible(true).setPosition(this.spiderX! + Math.sin(this.time * 4) * 4, y);
      if (this.spT < 0.5) this.spider.setScale(1 + Math.sin(this.spT * 30) * 0.05);
      if (this.spT > 0.05 && this.spT < 0.15) { ctx.sfx('squeak', this.spiderX!, 1.3); }
      if (this.spT < 1.4 && hits(p, this.spiderX! - 16, y - 16, 32, 32, 2)) {
        p.startle();
        p.launch(-260, -160, 0.2);
        ctx.sfx('boo', this.spiderX!);
        this.spT = 1.4;
      }
      if (this.spT > 1.8) { this.spT = -1; this.spider.setVisible(false); }
    }
    if (this.spider && this.spT >= 0) {
      this.g.lineStyle(1, 0xdcdcf0, 0.6);
      this.g.lineBetween(this.spiderX!, 0, this.spider.x, this.spider.y - 10);
    }
  }

  private draw(px: number): void {
    const g = this.g;
    g.clear();
    const cx = Phaser.Math.Clamp(px, this.x0 + 30, this.x1 - 30);
    const sag = this.sag;
    g.lineStyle(1.5, 0xe8e8ff, 0.75);
    const pts = 9;
    // fils radiaux
    for (let i = 0; i <= pts; i++) {
      const x = this.x0 + (i / pts) * (this.x1 - this.x0);
      const d = 1 - Math.min(1, Math.abs(x - cx) / ((this.x1 - this.x0) * 0.6));
      g.lineBetween(x, this.y + sag * d, cx, this.y + 26 + sag);
    }
    // fils concentriques
    for (let ring = 0; ring < 3; ring++) {
      g.beginPath();
      for (let i = 0; i <= pts; i++) {
        const x = this.x0 + (i / pts) * (this.x1 - this.x0);
        const d = 1 - Math.min(1, Math.abs(x - cx) / ((this.x1 - this.x0) * 0.6));
        const y = this.y + sag * d + ring * 8 * (1 - Math.abs(i / pts - 0.5));
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
    // ancrages aux murs
    g.lineStyle(2, 0xe8e8ff, 0.6);
    g.lineBetween(this.x0, this.y, this.x0, this.y - 30);
    g.lineBetween(this.x1, this.y, this.x1, this.y - 30);
  }

  reset(): void { this.spT = -1; this.spider?.setVisible(false); this.sag = this.sagV = 0; }
  destroy(): void { this.g.destroy(); this.spider?.destroy(); }
}

// =====================================================================================
// ZONE 5 — LE MONSTRE QUI A PEUR DE TOI
// =====================================================================================

export interface MonsterLayout {
  trigger: number; doorOpenAt: number; doorX: number; floorY: number;
  table: { x: number; land: number; landTop: number }; hole1: [number, number];
  wait1: number; stand: number; chand: { x: number; bridge: [number, number]; top: number }; hole2: [number, number];
  wait2: number; statue: number; balcony: { x: number; top: number; w: number }; arm: { x: number; top: number };
  wardrobe: number; lever: number; grate: number;
}

type MState = 'dormant' | 'approach' | 'reveal' | 'run' | 'wait1' | 'wait2' | 'hiding' | 'wardrobe' | 'done';

/**
 * LE GRAND TROLL. Lumières qui vacillent, pas lourds, silhouette immense derrière une porte…
 * La porte s'ouvre : le monstre découvre le petit héros, pousse un cri ridicule et s'enfuit.
 * Dans sa fuite, il renverse une table (plateforme), décroche un lustre (pont), se cache derrière
 * une statue (qui pivote) et finit par actionner la grille avant de s'enfermer dans une armoire
 * beaucoup trop petite. Lui foncer dessus le fait se cacher trop tôt : on le contourne par le
 * balcon (ou on revient plus calmement). Jamais mortel ; les trous, eux, le sont.
 */
export class ScaredMonster implements Trap {
  readonly id = 'h-monster';
  private st: MState = 'dormant';
  private t = 0;
  private time = 0;
  private body: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Graphics;
  private mon: Phaser.GameObjects.Container;
  private silo: Phaser.GameObjects.Graphics;
  private door: Phaser.GameObjects.Image;
  private table: Phaser.GameObjects.Image;
  private chand: Phaser.GameObjects.Image;
  private chandRope: Phaser.GameObjects.Graphics;
  private stand: Phaser.GameObjects.Graphics;
  private statue: Phaser.GameObjects.Image;
  private armG: Phaser.GameObjects.Graphics;
  private grate: Phaser.GameObjects.Image;
  private leverG: Phaser.GameObjects.Graphics;
  private wardrobe: Phaser.GameObjects.Image;
  private wEyes: Phaser.GameObjects.Graphics;
  private tablePlat: Phaser.GameObjects.Zone;
  private bridge: Phaser.GameObjects.Zone;
  private arm: Phaser.GameObjects.Zone;
  private grateZone: Phaser.GameObjects.Zone;
  private mx: number;
  private my: number;
  private path: { x: number; y: number; jump?: boolean; act?: () => void }[] = [];
  private seg = { from: { x: 0, y: 0 }, t: 0, dur: 0 };
  private after: MState = 'wait1';
  private stompT = 0;
  private scale = 0.6;
  private mood: 'menace' | 'shock' | 'scared' | 'hide' = 'menace';
  private farAway = false;
  private reacted = false;
  tableDown = false;
  bridgeDown = false;
  statueTurned = false;
  grateOpen = false;
  revealed = false;

  constructor(private k: Kit, private L: MonsterLayout) {
    const sc = k.scene;
    const D = DEPTH.props;
    // porte du fond (la silhouette est derrière)
    this.silo = sc.add.graphics().setDepth(DEPTH.backProps + 1);
    this.door = sc.add.image(L.doorX, L.floorY + 2, ensureCanvas(sc, 'mn-door-big', () => paintDoor('scratched', 150, 260))).setOrigin(0.5, 1).setDepth(DEPTH.backProps + 2);
    // table, porte-manteau et lustre, statue, grille, armoire
    this.table = sc.add.image(L.table.x, L.floorY, ensureCanvas(sc, 'mn-table', () => paintTable(90, 54))).setOrigin(0.5, 1).setDepth(D);
    this.stand = sc.add.graphics().setDepth(D);
    this.drawStand(0);
    this.chandRope = sc.add.graphics().setDepth(D);
    this.chand = sc.add.image(L.chand.x, 250, ensureCanvas(sc, 'mn-chand-big', () => paintChandelier(300))).setOrigin(0.5, 0.6).setDepth(D);
    this.statue = sc.add.image(L.statue, L.floorY, ensureCanvas(sc, 'mn-statue', () => paintStatue(110, 230))).setOrigin(0.5, 1).setDepth(D + 2);
    this.armG = sc.add.graphics().setDepth(D + 2);
    this.grate = sc.add.image(L.grate + 15, L.floorY, ensureCanvas(sc, 'mn-grate', () => paintGrate(40, 400))).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 2);
    this.leverG = sc.add.graphics().setDepth(D);
    this.drawLever(0);
    this.wardrobe = sc.add.image(L.wardrobe, L.floorY, ensureCanvas(sc, 'mn-wardrobe', () => paintWardrobe(76, 120))).setOrigin(0.5, 1).setDepth(D);
    this.wEyes = sc.add.graphics().setDepth(D + 1);
    // le monstre
    this.body = sc.add.image(0, 0, ensureCanvas(sc, 'mn-monster', () => paintMonster(190, 210))).setOrigin(0.5, 1);
    this.eyes = sc.add.graphics();
    this.mon = sc.add.container(L.doorX, L.floorY, [this.body, this.eyes]).setDepth(DEPTH.backProps + 1.5).setVisible(false);
    this.mx = L.doorX;
    this.my = L.floorY;
    // balcon du passage secondaire (toujours là, inaccessible sans la statue tournée)
    const bal = L.balcony;
    staticZone(k, bal.x, bal.top, bal.w, 16, true);
    const bg = sc.add.graphics().setDepth(DEPTH.terrain + 1);
    bg.fillStyle(0x5a3d30, 1);
    bg.fillRect(bal.x, bal.top, bal.w, 16);
    bg.fillStyle(0x8e6a52, 1);
    bg.fillRect(bal.x, bal.top, bal.w, 4);
    bg.lineStyle(3, 0x3e2a24, 1);
    for (let x = bal.x + 10; x < bal.x + bal.w; x += 24) bg.lineBetween(x, bal.top, x, bal.top - 34);
    bg.lineBetween(bal.x, bal.top - 34, bal.x + bal.w, bal.top - 34);
    for (let x = bal.x + 40; x < bal.x + bal.w; x += 120) { bg.fillStyle(0x3e2a24, 1); bg.fillRect(x - 6, bal.top + 16, 12, 60); }
    // plateformes révélées par la fuite
    this.tablePlat = staticZone(k, L.table.land - 50, L.table.landTop, 100, 16);
    setBodyEnabled(this.tablePlat, false);
    this.bridge = staticZone(k, L.chand.bridge[0], L.chand.top, L.chand.bridge[1] - L.chand.bridge[0], 14);
    setBodyEnabled(this.bridge, false);
    this.arm = staticZone(k, L.arm.x - 34, L.arm.top, 68, 14);
    setBodyEnabled(this.arm, false);
    this.grateZone = staticZone(k, L.grate, 100, 30, L.floorY - 100);
  }

  private drawStand(tilt: number): void {
    const g = this.stand;
    g.clear();
    const x = this.L.stand, y = this.L.floorY;
    g.save();
    g.lineStyle(6, 0x3e2a24, 1);
    const tx = x + Math.sin(tilt) * 200, ty = y - Math.cos(tilt) * 200;
    g.lineBetween(x, y, tx, ty);
    g.lineBetween(x - 24, y, x + 24, y);
    g.lineStyle(2, 0x8f8aa8, 1);
    // corde du lustre accrochée au porte-manteau
    if (!this.bridgeDown) g.lineBetween(tx, ty, this.L.chand.x - 100, 240);
    g.restore();
  }

  private drawLever(down: number): void {
    const g = this.leverG;
    g.clear();
    const x = this.L.lever, y = 400;
    g.fillStyle(0x4a4670, 1);
    g.fillRoundedRect(x - 12, y - 10, 24, 30, 4);
    g.lineStyle(5, 0xd9a23a, 1);
    const a = -Math.PI / 2 - 0.6 + down * 1.2;
    g.lineBetween(x, y, x + Math.cos(a) * 34, y + Math.sin(a) * 34);
    g.fillStyle(0xe8846b, 1);
    g.fillCircle(x + Math.cos(a) * 34, y + Math.sin(a) * 34, 6);
  }

  private drawEyes(): void {
    const g = this.eyes;
    g.clear();
    const s = this.mood === 'shock' ? 1.5 : this.mood === 'scared' ? 1.15 : 1;
    const ey = -150;
    for (const ex of [-30, 30]) {
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(ex, ey, 30 * s, 36 * s);
      g.lineStyle(3, 0x1a1533, 1);
      g.strokeEllipse(ex, ey, 30 * s, 36 * s);
      g.fillStyle(0x1a1533, 1);
      g.fillCircle(ex + (this.mood === 'scared' ? 6 : 0), ey + 3, this.mood === 'shock' ? 4 : 7);
    }
    if (this.mood !== 'menace') {
      // sourcils inquiets + bouche tremblante
      g.lineStyle(4, 0x1a1533, 1);
      g.lineBetween(-46, ey - 30, -18, ey - 40);
      g.lineBetween(46, ey - 30, 18, ey - 40);
      g.beginPath();
      for (let i = 0; i <= 8; i++) g.lineTo(-22 + i * 5.5, ey + 52 + (i % 2 ? 5 : 0) + Math.sin(this.time * 30) * 1.5);
      g.strokePath();
      // goutte de sueur
      g.fillStyle(0xbfe8ff, 1);
      g.fillCircle(62, ey - 20 + ((this.time * 60) % 30), 5);
    } else {
      g.fillStyle(0xffd36b, 1);
      g.fillCircle(-30, ey + 3, 7);
      g.fillCircle(30, ey + 3, 7);
    }
  }

  /** Programme une course : suite de points (avec sauts), puis l'état d'arrivée. */
  private runTo(points: { x: number; y?: number; jump?: boolean; act?: () => void }[], then: MState): void {
    this.st = 'run';
    this.path = points.map((p) => ({ x: p.x, y: p.y ?? this.L.floorY, jump: p.jump, act: p.act }));
    this.after = then;
    this.nextSeg();
  }

  private nextSeg(): void {
    const p = this.path[0];
    if (!p) { this.st = this.after; this.t = 0; this.onArrive(); return; }
    this.seg.from = { x: this.mx, y: this.my };
    this.seg.t = 0;
    this.seg.dur = p.jump ? 0.6 : Math.max(0.05, Math.abs(p.x - this.mx) / 430);
  }

  private onArrive(): void {
    this.mood = 'scared';
    if (this.st === 'wardrobe') {
      // il se glisse (laborieusement) dans l'armoire minuscule
      this.k.scene.tweens.add({
        targets: this.mon, scaleX: 0.3, scaleY: 0.45, x: this.L.wardrobe, duration: 700, ease: 'Back.easeIn',
        onComplete: () => { this.mon.setVisible(false); this.st = 'done'; this.k.ctx.sfx('squeak', this.L.wardrobe, 1.4); }
      });
      this.k.scene.tweens.add({ targets: this.wardrobe, scaleX: 1.12, scaleY: 0.94, duration: 120, yoyo: true, repeat: 3, delay: 650 });
    }
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const p = ctx.player;
    const L = this.L;
    const E = this.k.expert;
    const R = E ? 420 : 320;
    const FAST = E ? 150 : 200;
    const amb = this.k.amb;
    switch (this.st) {
      case 'dormant':
        if (p.alive && p.x > L.trigger && p.x < L.doorX) {
          this.st = 'approach';
          this.t = 0;
          Audio.setMood('tense');
          if (amb) amb.flicker = 1;
        }
        break;
      case 'approach': {
        // la menace : pas lourds, silhouette qui grandit derrière la vitre de la porte
        this.stompT -= dt;
        if (this.stompT <= 0) {
          this.stompT = 1.05;
          ctx.sfx('stomp', L.doorX, 0.4 + this.scale * 0.6);
          ctx.burst('dust', L.doorX - 200 + Math.random() * 400, 80, 3);
        }
        this.scale = Math.min(1, 0.6 + this.t * 0.12);
        if (p.x > L.doorOpenAt || this.t > 5) {
          this.st = 'reveal';
          this.t = 0;
          ctx.sfx('creak', L.doorX, 1);
          this.k.scene.tweens.add({ targets: this.door, scaleX: 0.1, x: L.doorX - 70, duration: 900, ease: 'Sine.easeInOut' });
        }
        break;
      }
      case 'reveal':
        if (this.t > 0.9 && !this.revealed) {
          // il sort… voit le héros… et panique
          this.revealed = true;
          this.mon.setVisible(true).setDepth(DEPTH.props + 1).setScale(1.25);
          this.mood = 'menace';
          ctx.sfx('stomp', L.doorX, 1);
        }
        if (this.revealed && this.t > 1.35 && this.mood === 'menace') {
          this.mood = 'shock';
          this.mon.setScale(1.25, 1.35);
        }
        if (this.t > 1.9) {
          this.mood = 'scared';
          ctx.sfx('yelp', L.doorX);
          Audio.setMood('normal');
          ctx.sfx('sting', L.doorX);
          if (amb) amb.flicker = 0;
          say(this.k.scene, L.doorX, L.floorY - 300, 'WAAAAAH !', '#5a3a9a', 1200);
          p.startle();
          this.k.scene.time.delayedCall(700, () => { if (p.alive) say(this.k.scene, p.x, p.y - 70, '?!', '#24306a', 900); });
          this.mon.setScale(1);
          this.runTo([
            { x: L.table.x - 40, act: () => this.knockTable(ctx) },
            { x: L.hole1[1] + 70, jump: true },
            { x: L.wait1 }
          ], 'wait1');
        }
        break;
      case 'run': {
        const target = this.path[0];
        this.seg.t += dt;
        const k = Math.min(1, this.seg.t / this.seg.dur);
        this.mx = Phaser.Math.Linear(this.seg.from.x, target.x, k);
        this.my = target.jump ? Phaser.Math.Linear(this.seg.from.y, target.y, k) - Math.sin(k * Math.PI) * 170 : target.y;
        if (k >= 1) {
          this.path.shift();
          target.act?.();
          this.nextSeg();
        }
        break;
      }
      case 'wait1':
        if (p.alive && p.x > L.hole1[0] - 60 && Math.abs(p.x - this.mx) < R && p.x < this.mx) {
          ctx.sfx('squeak', this.mx, 0.8);
          this.runTo([
            { x: L.stand - 30, act: () => this.dropChandelier(ctx) },
            { x: L.hole2[1] + 70, jump: true },
            { x: L.wait2 }
          ], 'wait2');
        }
        break;
      case 'wait2': {
        if (!p.alive) break;
        const d = Math.abs(p.x - this.mx);
        if (d < R && p.x < this.mx && p.x > L.hole2[0]) {
          // Facile : seule une course au sol l'effraie. Expert : il remarque aussi les arrivées en sautant.
          const rushing = p.body.velocity.x > FAST && (E || p.grounded);
          if (rushing) {
            // il panique et se cache trop tôt… derrière la statue (qui pivote)
            ctx.sfx('squeak', this.mx, 1.5);
            say(this.k.scene, this.mx, L.floorY - 250, 'NON NON NON !', '#5a3a9a', 1000);
            this.runTo([{ x: L.statue + 34, act: () => this.turnStatue(ctx) }], 'hiding');
            this.farAway = false;
          } else this.fleeToGrate(ctx);
        }
        break;
      }
      case 'hiding': {
        this.mood = 'hide';
        if (!p.alive) break;
        const d = Math.abs(p.x - this.mx);
        if (d > 520) this.farAway = true;
        const fromAbove = p.bottom < L.balcony.top + 20 && p.x > L.balcony.x;
        const calm = this.farAway && d < R && !(p.grounded && p.body.velocity.x > FAST);
        if (fromAbove || calm) {
          ctx.sfx('squeak', this.mx, 1.2);
          if (fromAbove) say(this.k.scene, this.mx, L.floorY - 260, 'Par en haut ?!', '#5a3a9a', 1000);
          this.fleeToGrate(ctx);
        }
        break;
      }
      case 'done':
        if (!this.reacted && p.alive && p.x > L.wardrobe - 140) {
          this.reacted = true;
          p.setExpression('worried', 1200);
          say(this.k.scene, p.x, p.y - 70, '… Bonne nuit ?', '#24306a', 1600);
        }
        break;
      default:
        break;
    }
    // rendu du monstre
    if (this.mon.visible && this.st !== 'done' && this.st !== 'wardrobe') {
      const runBob = this.st === 'run' ? Math.abs(Math.sin(this.time * 18)) * 8 : 0;
      const tremble = this.st === 'wait1' || this.st === 'wait2' || this.st === 'hiding' ? Math.sin(this.time * 50) * 2 : 0;
      this.mon.setPosition(this.mx + tremble, this.my - runBob);
      this.body.setFlipX(this.st === 'wait1' || this.st === 'wait2');
      if (this.st === 'hiding') this.mon.setDepth(DEPTH.props + 1).setScale(0.92, 0.85);
    }
    this.drawEyes();
    // silhouette derrière la vitre (phase A)
    this.silo.clear();
    if (this.st === 'approach' || (this.st === 'reveal' && !this.revealed)) {
      const s = this.scale;
      this.silo.fillStyle(0x0c0818, 0.85);
      this.silo.fillEllipse(L.doorX, L.floorY - 120 * s, 150 * s, 230 * s);
      this.silo.fillStyle(0xffd36b, 0.95);
      const blink = Math.sin(this.time * 1.7) > 0.96 ? 0.2 : 1;
      this.silo.fillEllipse(L.doorX - 22 * s, L.floorY - 170 * s, 14 * s, 18 * s * blink);
      this.silo.fillEllipse(L.doorX + 22 * s, L.floorY - 170 * s, 14 * s, 18 * s * blink);
    }
    // yeux dans l'armoire
    this.wEyes.clear();
    if (this.st === 'done') {
      const blink = Math.sin(this.time * 1.3) > 0.95;
      this.wEyes.fillStyle(0xffffff, 1);
      this.wEyes.fillEllipse(L.wardrobe - 7, L.floorY - 64, 9, blink ? 2 : 11);
      this.wEyes.fillEllipse(L.wardrobe + 7, L.floorY - 64, 9, blink ? 2 : 11);
      if (!blink) {
        this.wEyes.fillStyle(0x1a1533, 1);
        this.wEyes.fillCircle(L.wardrobe - 7 + (p.x < L.wardrobe ? -2 : 2), L.floorY - 63, 2.5);
        this.wEyes.fillCircle(L.wardrobe + 7 + (p.x < L.wardrobe ? -2 : 2), L.floorY - 63, 2.5);
      }
    }
  }

  private fleeToGrate(ctx: TrapContext): void {
    const L = this.L;
    this.runTo([
      { x: L.lever - 40, act: () => this.pullLever(ctx) },
      { x: L.wardrobe }
    ], 'wardrobe');
  }

  private knockTable(ctx: TrapContext): void {
    if (this.tableDown) return;
    this.tableDown = true;
    ctx.sfx('book', this.L.table.x);
    const L = this.L;
    this.k.scene.tweens.add({
      targets: this.table, x: L.table.land, y: L.table.landTop + 16 + 54, angle: 180, duration: 620, ease: 'Quad.easeIn',
      onComplete: () => {
        this.table.setAngle(180).setOrigin(0.5, 0).setY(L.table.landTop + 2);
        setBodyEnabled(this.tablePlat, true);
        ctx.sfx('land', L.table.land, 1);
        ctx.burst('dust', L.table.land, L.table.landTop, 8);
      }
    });
  }

  private dropChandelier(ctx: TrapContext): void {
    if (this.bridgeDown) return;
    const L = this.L;
    ctx.sfx('creak', L.chand.x, 1);
    // annonce : le porte-manteau bascule, le lustre tangue, puis tombe en travers du trou
    const st = { a: 0 };
    this.k.scene.tweens.add({ targets: st, a: 0.9, duration: 500, onUpdate: () => this.drawStand(st.a) });
    this.k.scene.tweens.add({
      targets: this.chand, y: L.chand.top - 6, angle: 0, duration: 650, delay: 350, ease: 'Bounce.easeOut',
      onStart: () => { this.bridgeDown = true; this.drawStand(0.9); },
      onComplete: () => {
        setBodyEnabled(this.bridge, true);
        ctx.sfx('clonk', L.chand.x);
        ctx.burst('dust', L.chand.x, L.chand.top, 10);
      }
    });
  }

  private turnStatue(ctx: TrapContext): void {
    if (this.statueTurned) return;
    this.statueTurned = true;
    ctx.sfx('creak', this.L.statue, 1);
    this.k.scene.tweens.add({
      targets: this.statue, scaleX: -1, duration: 600, ease: 'Sine.easeInOut',
      onComplete: () => {
        setBodyEnabled(this.arm, true);
        const g = this.armG;
        const a = this.L.arm;
        g.fillStyle(0x7a8098, 1);
        g.fillRoundedRect(a.x - 34, a.top, 68, 14, 5);
        g.fillStyle(0xa3a9c0, 1);
        g.fillRect(a.x - 32, a.top + 1, 64, 3);
        g.fillStyle(0x5c6280, 1);
        g.fillRect(this.L.statue - 6, a.top + 10, 12, 40);
      }
    });
  }

  private pullLever(ctx: TrapContext): void {
    if (this.grateOpen) return;
    this.grateOpen = true;
    ctx.sfx('clonk', this.L.lever);
    const st = { d: 0 };
    this.k.scene.tweens.add({ targets: st, d: 1, duration: 200, onUpdate: () => this.drawLever(st.d) });
    this.k.scene.time.delayedCall(250, () => {
      ctx.sfx('gate', this.L.grate);
      setBodyEnabled(this.grateZone, false);
      this.k.scene.tweens.add({ targets: this.grate, y: this.L.floorY - 360, duration: 900, ease: 'Cubic.easeInOut' });
    });
  }

  reset(): void {
    // la révélation ne se rejoue jamais ; une course interrompue se termine aussitôt
    if (this.st === 'approach') {
      this.st = 'dormant';
      Audio.setMood('normal');
      if (this.k.amb) this.k.amb.flicker = 0;
    }
    if (this.st === 'run') {
      while (this.path.length) { const p = this.path.shift()!; this.mx = p.x; this.my = p.y; p.act?.(); }
      this.st = this.after;
      this.onArrive();
    }
  }

  destroy(): void {
    [this.mon, this.silo, this.door, this.table, this.chand, this.chandRope, this.stand, this.statue, this.armG, this.grate, this.leverG, this.wardrobe, this.wEyes]
      .forEach((o) => o.destroy());
  }
}

// =====================================================================================
// ZONE 6 — L'ANTICHAMBRE DES TROIS PORTES
// =====================================================================================

export interface DoorsLayout {
  floorY: number;
  a: number; b: number; c: number;
  subA: { arrive: number; box: number; floorY: number; x0: number; x1: number };
  subB: { arrive: number; candy: number; exit: number; floorY: number; planks: number[]; plankTop: number };
  arena: { x: number; y: number };
}

/**
 * Trois portes, trois indices :
 *  A « SORTIE » trop accueillante (fanions, panneau lumineux) → salle-surprise d'un fantôme qui,
 *    en sursautant, actionne le plancher-ressort : retour express dans l'antichambre ;
 *  B normale, mais les bougies à côté s'éteignent quand on approche → plancher instable + bonbon bonus ;
 *  C inquiétante (griffures, petite citrouille qui tremble) → la vraie suite, la salle de bal.
 * On entre en restant immobile devant une porte (un sablier se remplit au-dessus).
 */
export class ThreeDoors implements Trap {
  readonly id = 'h-doors';
  private doors: { x: number; img: Phaser.GameObjects.Image; dest: () => void; still: number }[] = [];
  private gauge: Phaser.GameObjects.Graphics;
  private candles: { x: number; y: number; out: boolean; flame: Phaser.GameObjects.Image }[] = [];
  private pk: Phaser.GameObjects.Graphics;
  // salle A
  private ghost: Phaser.GameObjects.Container;
  private ghostFace: Phaser.GameObjects.Graphics;
  private box: Phaser.GameObjects.Graphics;
  private spring: Phaser.GameObjects.Graphics;
  private aState: 'wait' | 'surprise' | 'oops' | 'launch' = 'wait';
  private inRoomT = 0;
  private aT = 0;
  // salle B
  private planks: { x: number; zone: Phaser.GameObjects.Zone; g: Phaser.GameObjects.Graphics; st: 'ok' | 'crack' | 'gone'; t: number }[] = [];
  private candy: Phaser.GameObjects.Image;
  private candyTaken = false;
  private time = 0;
  private busy = 0;

  constructor(private k: Kit, private D: DoorsLayout) {
    const sc = k.scene;
    const fy = D.floorY;
    const mk = (x: number, kind: 'exit' | 'plain' | 'scratched', dest: () => void) => {
      const img = sc.add.image(x, fy + 2, ensureCanvas(sc, `mn-door-${kind}`, () => paintDoor(kind, 110, 200))).setOrigin(0.5, 1).setDepth(DEPTH.backProps + 2);
      this.doors.push({ x, img, dest, still: 0 });
    };
    mk(D.a, 'exit', () => k.host.teleport(D.subA.arrive, D.subA.floorY - 30));
    mk(D.b, 'plain', () => k.host.teleport(D.subB.arrive, D.subB.floorY - 30));
    mk(D.c, 'scratched', () => k.host.teleport(D.arena.x, D.arena.y));
    // A : panneau lumineux « SORTIE » qui clignote gentiment
    const sign = sc.add.image(D.a, fy - 250, ensureCanvas(sc, 'mn-exit-sign', () => paintExitSign(120, 40))).setDepth(DEPTH.backProps + 3);
    sc.tweens.add({ targets: sign, alpha: 0.75, duration: 600, yoyo: true, repeat: -1 });
    const sg = sc.add.image(D.a, fy - 250, 'dot-warm').setScale(4, 1.6).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(MDEPTH.glow - 1);
    k.amb?.glows.push(sg);
    // B : deux bougies qui s'éteindront
    for (const dx of [-90, 90]) {
      const x = D.b + dx, y = fy - 110;
      const g = sc.add.graphics().setDepth(DEPTH.backProps + 3);
      g.fillStyle(0x2a2236, 1);
      g.fillRect(x - 3, y, 6, 110);
      g.fillRoundedRect(x - 14, y - 2, 28, 6, 3);
      g.fillStyle(0xfff0c8, 1);
      g.fillRoundedRect(x - 5, y - 22, 10, 20, 2);
      this.candles.push({ x, y, out: false, flame: addFlame(sc, k.amb, x, y - 20, 0.9) });
    }
    // C : petite citrouille qui tremble à côté de la porte
    this.pk = sc.add.graphics().setDepth(DEPTH.props);
    sc.add.image(D.c + 90, fy + 4, ensureCanvas(sc, 'mn-pkb-18', () => paintPumpkin(18, 54))).setOrigin(0.5, 1).setDepth(DEPTH.props - 1);
    this.gauge = sc.add.graphics().setDepth(DEPTH.fx);

    // --- salle A : la surprise du fantôme
    const A = D.subA;
    this.spring = sc.add.graphics().setDepth(DEPTH.terrain + 2);
    this.drawSpring(0);
    this.box = sc.add.graphics().setDepth(DEPTH.props);
    this.drawBox(false);
    const gimg = sc.add.image(0, 0, ensureCanvas(sc, 'mn-ghost-60', () => paintGhost(60, 56)));
    this.ghostFace = sc.add.graphics();
    this.ghost = sc.add.container(A.box, A.floorY - 30, [gimg, this.ghostFace]).setDepth(DEPTH.props - 0.5).setVisible(false);
    say; // (bulles créées à la volée)
    // --- salle B : plancher instable + bonbon
    for (const x of D.subB.planks) {
      const zone = movingZone(k, x + 50, D.subB.plankTop + 10, 98, 20);
      const g = sc.add.graphics().setDepth(DEPTH.terrain + 2);
      this.planks.push({ x, zone, g, st: 'ok', t: 0 });
    }
    this.candy = sc.add.image(D.subB.candy, D.subB.floorY - 70, ensureCanvas(sc, 'mn-candy', () => paintCandy(16))).setDepth(DEPTH.props);
    this.candyTaken = Save.flag('h1-candy');
    if (this.candyTaken) this.candy.setAlpha(0.3);
    sc.tweens.add({ targets: this.candy, y: this.candy.y - 10, angle: 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // porte de retour de la salle B
    sc.add.image(D.subB.exit, D.subB.floorY + 2, ensureCanvas(sc, 'mn-door-plain', () => paintDoor('plain', 110, 200))).setOrigin(0.5, 1).setDepth(DEPTH.backProps + 2);
    this.doors.push({ x: D.subB.exit, img: this.candy, dest: () => k.host.teleport(D.b + 60, D.floorY - 30), still: 0 });
  }

  private drawSpring(k: number): void {
    const A = this.D.subA;
    const g = this.spring;
    g.clear();
    g.fillStyle(0x6b4a3a, 1);
    g.fillRect(A.x0 + 60, A.floorY - 8 - k * 30, A.x1 - A.x0 - 120, 10);
    if (k > 0) {
      g.lineStyle(4, 0xa3a9c0, 1);
      for (let x = A.x0 + 100; x < A.x1 - 100; x += 120) {
        g.beginPath();
        for (let i = 0; i <= 8; i++) g.lineTo(x + (i % 2 ? 10 : -10), A.floorY - (i / 8) * k * 30);
        g.strokePath();
      }
    }
  }

  private drawBox(open: boolean): void {
    const A = this.D.subA;
    const g = this.box;
    g.clear();
    const x = A.box, y = A.floorY;
    g.fillStyle(0x7a2a4a, 1);
    g.fillRect(x - 40, y - 60, 80, 60);
    g.fillStyle(0xf7d774, 1);
    g.fillRect(x - 6, y - 60, 12, 60);
    if (!open) {
      g.fillStyle(0x9a3a5a, 1);
      g.fillRect(x - 46, y - 72, 92, 14);
      g.fillStyle(0xf7d774, 1);
      g.fillEllipse(x - 12, y - 80, 22, 12);
      g.fillEllipse(x + 12, y - 80, 22, 12);
    }
    // gros bouton rouge (derrière la boîte)
    g.fillStyle(0x3a3460, 1);
    g.fillRect(x + 54, y - 14, 34, 14);
    g.fillStyle(0xe8546b, 1);
    g.fillEllipse(x + 71, y - 16, 24, 10);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    const D = this.D;
    if (this.busy > 0) this.busy -= dt;
    // B : les bougies s'éteignent une à une quand on approche (indice : danger derrière)
    this.candles.forEach((c, i) => {
      const d = Math.abs(p.x - D.b);
      if (!c.out && p.alive && d < 320 - i * 110 && Math.abs(p.bottom - D.floorY) < 60) {
        c.out = true;
        c.flame.setVisible(false);
        ctx.sfx('candle', c.x, 0.8);
        ctx.burst('dust', c.x, c.y - 26, 3);
      }
    });
    // C : la petite citrouille tremble (elle sait ce qu'il y a derrière)
    this.pk.clear();
    drawCarvedFace(this.pk, D.c + 90 + Math.sin(this.time * 40) * 1.2, D.floorY - 22, 18, 'scared');
    // entrer : rester immobile devant une porte
    this.gauge.clear();
    for (const d of this.doors) {
      const inFront = p.alive && p.grounded && Math.abs(p.x - d.x) < 36 && Math.abs(p.bottom - this.floorAt(d.x)) < 10;
      if (inFront && p.stillTime > 0.1) d.still += dt; else d.still = 0;
      if (d.still > 0) {
        const k = Math.min(1, d.still / 0.6);
        const gy = this.floorAt(d.x) - 230;
        this.gauge.fillStyle(0x16302f, 0.7);
        this.gauge.fillRoundedRect(d.x - 26, gy - 8, 52, 16, 8);
        this.gauge.fillStyle(0xffd36b, 1);
        this.gauge.fillRoundedRect(d.x - 22, gy - 4, 44 * k, 8, 4);
        if (k >= 1 && this.busy <= 0) {
          d.still = 0;
          this.busy = 1;
          ctx.sfx('creak', d.x, 0.8);
          ctx.sfx('teleport', d.x);
          if (d.img !== this.candy) this.k.scene.tweens.add({ targets: d.img, scaleX: 0.85, duration: 120, yoyo: true });
          d.dest();
        }
      }
    }
    this.updateSubA(dt, ctx);
    this.updateSubB(dt, ctx);
  }

  private floorAt(x: number): number {
    if (x > this.D.subB.planks[0] - 400) return this.D.subB.floorY;
    if (x > this.D.subA.x0 - 50 && x < this.D.subA.x1 + 50) return this.D.subA.floorY;
    return this.D.floorY;
  }

  private updateSubA(dt: number, ctx: TrapContext): void {
    const A = this.D.subA;
    const p = ctx.player;
    this.aT += dt;
    const inRoom = p.x > A.x0 && p.x < A.x1;
    const g = this.ghostFace;
    switch (this.aState) {
      case 'wait':
        if (inRoom) this.inRoomT += dt; else this.inRoomT = 0;
        // on avance… ou on attend un peu : la surprise arrive de toute façon (pas de cul-de-sac)
        if (inRoom && p.alive && (p.x > A.arrive + 60 || this.inRoomT > 1.6)) {
          this.aState = 'surprise';
          this.aT = 0;
          this.drawBox(true);
          this.ghost.setVisible(true).setPosition(A.box, A.floorY - 40).setAngle(0).setScale(0.4);
          this.k.scene.tweens.add({ targets: this.ghost, y: A.floorY - 130, scale: 1, duration: 300, ease: 'Back.easeOut' });
          ctx.sfx('pop', A.box);
          ctx.burst('petals', A.box, A.floorY - 80, 20);
          say(this.k.scene, A.box, A.floorY - 210, 'SURPRIIIISE !', '#2a7a5e', 1200);
          p.startle();
        }
        break;
      case 'surprise':
        if (this.aT > 1.0) {
          // il sursaute… de sa propre surprise, et tombe à la renverse sur le bouton
          this.aState = 'oops';
          this.aT = 0;
          say(this.k.scene, A.box, A.floorY - 210, 'Ah ! Oups…', '#2a7a5e', 900);
          this.k.scene.tweens.add({ targets: this.ghost, x: A.box + 71, y: A.floorY - 34, angle: 120, duration: 420, ease: 'Quad.easeIn' });
        }
        break;
      case 'oops':
        if (this.aT > 0.45) {
          this.aState = 'launch';
          this.aT = 0;
          ctx.sfx('clonk', A.box + 71);
          ctx.sfx('spring', A.box, 1);
          this.drawSpring(1);
          if (inRoom && p.alive) p.launch(0, -1250, 0.3);
        }
        break;
      case 'launch':
        if (this.aT > 0.5 && inRoom) {
          this.k.host.teleport(this.D.a + 70, this.D.floorY - 160);
          this.k.scene.time.delayedCall(450, () => { ctx.sfx('boing', this.D.a); say(this.k.scene, this.D.a + 70, this.D.floorY - 120, '… Hein ?', '#24306a', 1000); });
        }
        if (this.aT > 1.2) {
          this.aState = 'wait';
          this.drawSpring(0);
          this.drawBox(false);
          this.ghost.setVisible(false);
        }
        break;
    }
    if (this.ghost.visible) {
      g.clear();
      g.fillStyle(0x24306a, 1);
      g.fillEllipse(-10, -6, 7, this.aState === 'oops' ? 12 : 9);
      g.fillEllipse(10, -6, 7, this.aState === 'oops' ? 12 : 9);
      g.fillEllipse(0, 10, this.aState === 'surprise' ? 18 : 10, this.aState === 'surprise' ? 12 : 10);
      g.fillStyle(0xf28c38, 1);
      g.fillTriangle(-6, -24, 6, -24, 2, -46);
    }
  }

  private updateSubB(dt: number, ctx: TrapContext): void {
    const B = this.D.subB;
    const p = ctx.player;
    const crumble = this.k.expert ? 0.22 : 0.35;
    for (const pl of this.planks) {
      pl.t += dt;
      const on = standingOn(p, pl.x, pl.x + 100, B.plankTop);
      if (pl.st === 'ok' && on) { pl.st = 'crack'; pl.t = 0; ctx.sfx('crack', pl.x + 50); }
      else if (pl.st === 'crack' && pl.t > crumble) { pl.st = 'gone'; pl.t = 0; setBodyEnabled(pl.zone, false); ctx.sfx('tileSink', pl.x + 50, 0.5); ctx.burst('dust', pl.x + 50, B.plankTop, 5); }
      else if (pl.st === 'gone' && pl.t > 2.2) { pl.st = 'ok'; pl.t = 0; setBodyEnabled(pl.zone, true); }
      const g = pl.g;
      g.clear();
      if (pl.st === 'gone') continue;
      const sh = pl.st === 'crack' ? Math.sin(this.time * 60) * 2 : 0;
      g.fillStyle(0x6b4a3a, 1);
      g.fillRoundedRect(pl.x + 1 + sh, B.plankTop - 4, 98, 22, 3);
      g.fillStyle(0xa77d5c, 1);
      g.fillRect(pl.x + 3 + sh, B.plankTop - 3, 94, 3);
      g.lineStyle(1.5, 0x2c1d18, 0.8);
      g.lineBetween(pl.x + 30 + sh, B.plankTop - 3, pl.x + 40 + sh, B.plankTop + 14);
    }
    if (!this.candyTaken && p.alive && Math.abs(p.x - B.candy) < 30 && Math.abs(p.y - (B.floorY - 60)) < 60) {
      this.candyTaken = true;
      Save.setFlag('h1-candy');
      ctx.sfx('checkpoint', B.candy);
      ctx.burst('sparkle', B.candy, B.floorY - 70, 14);
      say(this.k.scene, B.candy, B.floorY - 150, 'Bonbon secret trouvé !', '#c4561c', 1400);
      this.k.scene.tweens.add({ targets: this.candy, alpha: 0.3, scale: 1.4, duration: 300 });
      p.happyEyes(900);
    }
  }

  reset(): void {
    for (const pl of this.planks) { pl.st = 'ok'; pl.t = 0; setBodyEnabled(pl.zone, true); }
    this.aState = 'wait';
    this.drawSpring(0);
    this.drawBox(false);
    this.ghost.setVisible(false);
    this.doors.forEach((d) => (d.still = 0));
  }

  destroy(): void {
    this.gauge.destroy();
    this.pk.destroy();
    this.ghost.destroy();
    this.box.destroy();
    this.spring.destroy();
    this.planks.forEach((p) => p.g.destroy());
    this.candy.destroy();
    void carry;
  }
}
