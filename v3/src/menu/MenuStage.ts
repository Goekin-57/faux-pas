import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H, PHYSICS } from '../core/constants';
import { Audio, type SfxName } from '../core/Audio';
import { Player } from '../player/Player';
import type { Controls } from '../core/Controls';
import { ensureCanvas } from '../art/textures';
import { STONE_W, STONE_H } from '../art/paint';
import { MENU_GROUND as G } from './MenuBackdrop';
import { paintFlowerHead, paintFlowerFace, paintExclaim } from './paintMenu';

/**
 * Scène vivante de l'écran d'accueil : le héros se promène dans un coin de serre
 * et se fait surprendre par trois "pièges" du chapitre 1. Rien n'est mortel ici.
 * Chaque élément réagit aussi au clic (ou au toucher).
 */

const FLOWER_X = 742;
const STONE_X = 978;
const STONE_TOP = G - 50;
const SNAP_X = 1196;
const HERO_SCALE = 1.32;

class Cancelled { }

/** Commandes simulées du héros (même interface que Controls pour Player.update). */
class Puppet {
  left = false;
  right = false;
  jumpHeld = false;
  jumpPressed = false;
  update(): void { }
  consumeJump(): void { }
}

function sfx(name: SfxName, x: number, intensity = 0.7): void {
  Audio.sfx(name, { pan: (x - GAME_W / 2) / (GAME_W * 0.7), intensity });
}

function drawLeaf(g: Phaser.GameObjects.Graphics, x: number, y: number, ang: number, len: number, wid: number, col: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = Math.sin(t * Math.PI) * wid;
    pts.push(new Phaser.Math.Vector2(t * len, -w));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const w = Math.sin(t * Math.PI) * wid * 0.85;
    pts.push(new Phaser.Math.Vector2(t * len, w));
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const p of pts) {
    const px = p.x, py = p.y;
    p.set(x + px * c - py * s, y + px * s + py * c);
  }
  g.fillStyle(col, 1);
  g.fillPoints(pts, true);
}

// ------------------------------------------------------------------ fleur qui éternue

class SneezeFlower {
  readonly head: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Image;
  private stem: Phaser.GameObjects.Graphics;
  private pose = { dx: 0, dy: 0, ang: 0, sc: 1 };
  private busy = false;
  private time = 0;
  onBlast?: () => void;

  constructor(private scene: Phaser.Scene, private x: number) {
    ensureCanvas(scene, 'mf-head', paintFlowerHead);
    (['calm', 'inhale', 'sneeze'] as const).forEach((k) => ensureCanvas(scene, `mf-face-${k}`, () => paintFlowerFace(k)));
    this.stem = scene.add.graphics().setDepth(DEPTH.props);
    this.head = scene.add.image(x, G - 210, 'mf-head').setScale(0.66).setDepth(DEPTH.props + 1);
    this.face = scene.add.image(x, G - 210, 'mf-face-calm').setScale(0.62).setDepth(DEPTH.props + 2);
    this.head.setInteractive({ useHandCursor: true, pixelPerfect: false });
  }

  get isBusy(): boolean { return this.busy; }

  /** Inspiration (annoncée), puis éternuement directionnel vers la droite. */
  sneeze(): Promise<void> {
    if (this.busy) return Promise.resolve();
    this.busy = true;
    const s = this.scene;
    return new Promise((resolve) => {
      sfx('sneezeIn', this.x, 1);
      this.face.setTexture('mf-face-inhale');
      s.tweens.add({ targets: this.pose, dx: -16, dy: -12, ang: -24, sc: 1.08, duration: 900, ease: 'Sine.easeInOut' });
      s.time.delayedCall(950, () => {
        this.face.setTexture('mf-face-sneeze');
        sfx('sneeze', this.x, 1);
        this.onBlast?.();
        s.tweens.add({ targets: this.pose, dx: 26, dy: 4, ang: 28, sc: 0.94, duration: 110, ease: 'Quad.easeOut' });
        s.time.delayedCall(520, () => {
          this.face.setTexture('mf-face-calm');
          s.tweens.add({
            targets: this.pose, dx: 0, dy: 0, ang: 0, sc: 1, duration: 900, ease: 'Elastic.easeOut',
            onComplete: () => { this.busy = false; resolve(); }
          });
        });
      });
    });
  }

  headPos(): { x: number; y: number } { return { x: this.head.x, y: this.head.y }; }

  update(dt: number, heroX: number): void {
    this.time += dt;
    // la fleur suit le héros du regard quand elle est au repos
    const look = this.busy ? 0 : Phaser.Math.Clamp((heroX - this.x) / 40, -8, 10);
    const sway = Math.sin(this.time * 1.4) * 2.5;
    const hx = this.x + 10 + this.pose.dx + sway;
    const hy = G - 210 + this.pose.dy + Math.sin(this.time * 2.1) * 2;
    const ang = this.pose.ang + look + sway * 0.6;
    this.head.setPosition(hx, hy).setAngle(ang * 0.6).setScale(0.66 * this.pose.sc, 0.66 * (2 - this.pose.sc));
    this.face.setPosition(hx + Math.sin((ang * Math.PI) / 180) * 4, hy + 1).setAngle(ang * 0.35).setScale(0.62 * this.pose.sc);

    const g = this.stem;
    g.clear();
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(this.x, G + 4),
      new Phaser.Math.Vector2(this.x - 18, G - 80),
      new Phaser.Math.Vector2(hx + 20 - this.pose.dx, hy + 90),
      new Phaser.Math.Vector2(hx, hy + 24)
    );
    g.lineStyle(10, 0x4e7a62, 1);
    curve.draw(g, 24);
    g.lineStyle(3, 0x9cc59a, 0.85);
    curve.draw(g, 24);
    const p1 = curve.getPoint(0.32), p2 = curve.getPoint(0.55);
    drawLeaf(g, p1.x, p1.y, -2.6 + sway * 0.02, 62, 15, 0x5e9a70);
    drawLeaf(g, p2.x, p2.y, -0.55 - sway * 0.02, 54, 13, 0x6fae7a);
    // petit pot de terre cuite
    g.fillStyle(0xb7694f, 1);
    g.fillRoundedRect(this.x - 34, G - 30, 68, 34, { tl: 6, tr: 6, bl: 12, br: 12 });
    g.fillStyle(0xd48a6a, 1);
    g.fillRoundedRect(this.x - 40, G - 38, 80, 14, 6);
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(this.x - 36, G - 35, 72, 3);
  }
}

// ------------------------------------------------------------------ pavé poli

class MenuStone {
  readonly img: Phaser.GameObjects.Image;
  readonly zone: Phaser.GameObjects.Zone;
  private stalk: Phaser.GameObjects.Graphics;
  private sparkle: Phaser.GameObjects.Image;
  state: 'idle' | 'warn' | 'sink' | 'gone' = 'idle';
  private t = 0;
  private time = 0;
  private sparkleT = 1.5;
  onWarn?: () => void;

  constructor(private scene: Phaser.Scene) {
    this.stalk = scene.add.graphics().setDepth(DEPTH.terrain + 1);
    this.img = scene.add.image(STONE_X, STONE_TOP + STONE_H / 2, 'stone-polished').setDepth(DEPTH.terrain + 2);
    this.sparkle = scene.add.image(STONE_X, STONE_TOP + 5, 'star').setDepth(DEPTH.terrain + 3).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
    this.zone = scene.add.zone(STONE_X, STONE_TOP + STONE_H / 2, STONE_W - 4, STONE_H);
    scene.physics.add.existing(this.zone, true);
    this.img.setInteractive({ useHandCursor: true });
  }

  trigger(): void {
    if (this.state !== 'idle') return;
    this.state = 'warn';
    this.t = 0;
    sfx('tileWarn', STONE_X, 0.8);
    this.onWarn?.();
  }

  heroOn(hero: Player): boolean {
    const b = hero.body;
    return (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable && b.right > STONE_X - STONE_W / 2 + 4 && b.left < STONE_X + STONE_W / 2 - 4 && Math.abs(b.bottom - STONE_TOP) < 4;
  }

  update(dt: number, hero: Player): void {
    this.time += dt;
    this.t += dt;
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody;
    // même règle qu'en jeu : on s'arrête dessus, il tremble
    if (this.state === 'idle' && this.heroOn(hero) && hero.stillTime > 0.55) this.trigger();
    let dx = 0, dy = 0, ang = 0;
    if (this.state === 'warn') {
      const k = this.t / 0.75;
      dx = Math.sin(this.time * 70) * (1 + k * 2.5);
      ang = Math.sin(this.time * 55) * 1.5;
      dy = k * 6;
      if (this.t >= 0.75) {
        this.state = 'sink';
        this.t = 0;
        body.enable = false;
        sfx('tileSink', STONE_X, 0.7);
      }
    } else if (this.state === 'sink') {
      const k = Math.min(1, this.t / 0.5);
      dy = 6 + k * k * 60;
      this.img.setAlpha(1 - k);
      if (k >= 1) { this.state = 'gone'; this.t = 0; }
    } else if (this.state === 'gone') {
      dy = 0;
      this.img.setAlpha(0);
      if (this.t > 1.5 && !this.overlapsHero(hero)) {
        this.state = 'idle';
        this.t = 0;
        body.enable = true;
        this.img.setAlpha(1).setScale(0.2);
        this.scene.tweens.add({ targets: this.img, scale: 1, duration: 380, ease: 'Back.easeOut' });
        sfx('tileRise', STONE_X, 0.6);
      }
    }
    this.img.setPosition(STONE_X + dx, STONE_TOP + STONE_H / 2 + dy).setAngle(ang);

    // scintillement : l'indice "trop poli"
    this.sparkleT -= dt;
    if (this.sparkleT <= 0 && this.state === 'idle') {
      this.sparkleT = 2 + Math.random() * 2;
      this.sparkle.setPosition(STONE_X - 34 + Math.random() * 68, STONE_TOP + 5);
      this.scene.tweens.add({ targets: this.sparkle, scale: { from: 0, to: 0.7 }, angle: 90, duration: 260, yoyo: true });
    }

    const g = this.stalk;
    g.clear();
    if (this.state !== 'gone' && this.state !== 'sink') {
      const top = STONE_TOP + STONE_H + dy - 2;
      g.lineStyle(8, 0x5e9a70, 1);
      g.lineBetween(STONE_X, top, STONE_X - 3, G + 4);
      g.fillStyle(0x86b97f, 1);
      g.fillEllipse(STONE_X, top + 2, 34, 9);
    } else {
      g.lineStyle(7, 0x5e9a70, 1);
      g.lineBetween(STONE_X - 3, G + 4, STONE_X + 5, G - 10);
    }
  }

  private overlapsHero(hero: Player): boolean {
    const b = hero.body;
    return b.right > STONE_X - STONE_W / 2 && b.left < STONE_X + STONE_W / 2 && b.bottom > STONE_TOP - 2;
  }
}

// ------------------------------------------------------------------ Dionée suspendue

class MenuSnapper {
  readonly head: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Image;
  private lower: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image;
  private stalk: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  phase: 'rest' | 'wake' | 'strike' | 'hold' | 'chew' | 'retract' = 'rest';
  private t = 0;
  private time = 0;
  private readonly potY = 96;
  private readonly restY = 318;
  private readonly strikeY = G - 40;
  onWake?: () => void;

  constructor(private scene: Phaser.Scene) {
    const x = SNAP_X;
    const chains = scene.add.graphics().setDepth(DEPTH.traps - 2);
    chains.lineStyle(2, 0xffffff, 0.6);
    chains.lineBetween(x - 28, this.potY - 14, x, -10);
    chains.lineBetween(x + 28, this.potY - 14, x, -10);
    scene.add.image(x, this.potY, 'hang-pot').setScale(0.62).setDepth(DEPTH.traps);
    this.shadow = scene.add.ellipse(x, G + 2, 110, 14, 0x2a1530, 0.1).setDepth(DEPTH.terrain + 3);
    this.stalk = scene.add.graphics().setDepth(DEPTH.traps - 1);
    this.upper = scene.add.image(0, 0, 'snap-jaw').setOrigin(0.5, 0.78).setScale(0.75);
    this.lower = scene.add.image(0, 0, 'snap-jaw').setOrigin(0.5, 0.78).setScale(0.75, -0.75);
    this.eyes = scene.add.image(0, -26, 'snap-eyes-closed').setScale(0.6);
    this.head = scene.add.container(x, this.restY, [this.lower, this.upper, this.eyes]).setDepth(DEPTH.traps);
    this.head.setSize(110, 90).setInteractive({ useHandCursor: true });
  }

  trigger(): void {
    if (this.phase !== 'rest') return;
    this.go('wake');
    this.eyes.setTexture('snap-eyes-open');
    sfx('snapWake', SNAP_X, 0.8);
    this.onWake?.();
  }

  private go(p: MenuSnapper['phase']): void { this.phase = p; this.t = 0; }

  update(dt: number): void {
    this.time += dt;
    this.t += dt;
    let y = this.restY, jaw = 8, shake = 0, shadowA = 0.1;
    switch (this.phase) {
      case 'rest':
        y = this.restY + Math.sin(this.time * 1.8) * 4;
        jaw = 6 + Math.sin(this.time * 1.8) * 2;
        break;
      case 'wake': {
        const k = Math.min(1, this.t / 0.65);
        y = this.restY - 24 * Phaser.Math.Easing.Sine.Out(k);
        jaw = 8 + 34 * Phaser.Math.Easing.Back.Out(Math.min(1, k * 1.4));
        shake = Math.sin(this.time * 60) * 2.5 * k;
        shadowA = 0.12 + 0.25 * k;
        if (this.t >= 0.65) this.go('strike');
        break;
      }
      case 'strike': {
        const k = Math.min(1, this.t / 0.12);
        y = Phaser.Math.Linear(this.restY - 24, this.strikeY, k * k);
        jaw = 42 * (1 - k);
        shadowA = 0.4;
        if (this.t >= 0.12) {
          this.go('hold');
          sfx('chomp', SNAP_X, 0.8);
        }
        break;
      }
      case 'hold':
        y = this.strikeY;
        jaw = 0;
        shadowA = 0.4;
        if (this.t >= 0.3) this.go('chew');
        break;
      case 'chew': {
        y = this.strikeY;
        const c = Math.abs(Math.sin(this.time * 18));
        jaw = 3 + c * 9;
        this.head.setScale(1 + c * 0.05, 1 - c * 0.04);
        shadowA = 0.4;
        if (this.t >= 0.7) { this.go('retract'); this.head.setScale(1); }
        break;
      }
      case 'retract': {
        const k = Math.min(1, this.t / 0.6);
        y = Phaser.Math.Linear(this.strikeY, this.restY, Phaser.Math.Easing.Cubic.InOut(k));
        jaw = 8 * k;
        shadowA = 0.4 - 0.3 * k;
        if (k >= 1) { this.go('rest'); this.eyes.setTexture('snap-eyes-closed'); }
        break;
      }
    }
    this.head.setPosition(SNAP_X + shake, y);
    const a = Phaser.Math.DegToRad(jaw);
    this.upper.setRotation(-a * 0.5);
    this.lower.setRotation(a * 0.5);
    this.upper.y = -4 - jaw * 0.35;
    this.lower.y = 4 + jaw * 0.35;
    this.eyes.y = this.upper.y - 26;
    this.shadow.setFillStyle(0x2a1530, shadowA);

    const g = this.stalk;
    g.clear();
    const sway = Math.sin(this.time * 1.3) * 14;
    const x0 = SNAP_X, y0 = this.potY + 22, x1 = this.head.x, y1 = y - 30;
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2(x0 + 26 + sway, y0 + (y1 - y0) * 0.3),
      new Phaser.Math.Vector2(x1 - 26 - sway, y0 + (y1 - y0) * 0.7),
      new Phaser.Math.Vector2(x1, y1)
    );
    g.lineStyle(10, 0x4e7a62, 1);
    curve.draw(g, 24);
    g.lineStyle(3, 0x9cc59a, 0.8);
    curve.draw(g, 24);
    const p = curve.getPoint(0.45);
    drawLeaf(g, p.x, p.y, -0.2, 34, 9, 0x6fa88f);
  }
}

// ------------------------------------------------------------------ papillon

class Butterfly {
  private g: Phaser.GameObjects.Graphics;
  private hit: Phaser.GameObjects.Zone;
  private x = 900;
  private y = 330;
  private vx = 0;
  private vy = 0;
  private target = { x: 900, y: 330 };
  private time = 0;
  private retarget = 0;
  private perch = 0;
  private flee = 0;

  constructor(scene: Phaser.Scene, private perchSpot: () => { x: number; y: number }) {
    this.g = scene.add.graphics().setDepth(DEPTH.frontProps);
    this.hit = scene.add.zone(this.x, this.y, 46, 40).setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', () => {
      this.flee = 1.6;
      this.perch = 0;
      this.target = { x: 640 + Math.random() * 560, y: 80 + Math.random() * 120 };
      sfx('uiHover', this.x, 0.5);
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.retarget -= dt;
    this.flee = Math.max(0, this.flee - dt);
    if (this.perch > 0) {
      this.perch -= dt;
      const p = this.perchSpot();
      this.target = { x: p.x + 6, y: p.y - 56 };
    } else if (this.retarget <= 0) {
      this.retarget = 1.4 + Math.random() * 1.8;
      if (Math.random() < 0.22) this.perch = 2.5 + Math.random() * 2;
      else this.target = { x: 640 + Math.random() * 560, y: 140 + Math.random() * 300 };
    }
    const accel = this.flee > 0 ? 900 : 260;
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * accel * dt + Math.sin(this.time * 7) * 40 * dt;
    this.vy += (dy / d) * accel * dt + Math.cos(this.time * 9) * 60 * dt;
    const max = this.flee > 0 ? 340 : this.perch > 0 && d < 20 ? 30 : 120;
    const v = Math.hypot(this.vx, this.vy);
    if (v > max) { this.vx *= max / v; this.vy *= max / v; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.hit.setPosition(this.x, this.y);

    const perched = this.perch > 0 && d < 14;
    const flap = perched ? 0.55 + Math.sin(this.time * 3) * 0.35 : Math.abs(Math.sin(this.time * (this.flee ? 30 : 18)));
    const g = this.g;
    g.clear();
    const dir = this.vx >= 0 ? 1 : -1;
    const wing = (sy: number, w: number, h: number, col: number) => {
      const ww = w * (0.25 + flap * 0.75);
      g.fillStyle(col, 1);
      g.fillEllipse(this.x - dir * ww * 0.45, this.y + sy, ww, h);
      g.fillEllipse(this.x + dir * ww * 0.45, this.y + sy, ww, h);
    };
    wing(-5, 22, 16, 0xf7d774);
    wing(4, 16, 12, 0xf28c38);
    g.fillStyle(0x24306a, 1);
    g.fillEllipse(this.x, this.y, 4, 16);
    g.lineStyle(1.5, 0x24306a, 1);
    g.lineBetween(this.x, this.y - 7, this.x - 4, this.y - 13);
    g.lineBetween(this.x, this.y - 7, this.x + 4, this.y - 13);
  }
}

// ------------------------------------------------------------------ chorégraphie

export class MenuStage {
  readonly hero: Player;
  private puppet = new Puppet();
  private flower: SneezeFlower;
  private stone: MenuStone;
  private snapper: MenuSnapper;
  private butterfly: Butterfly;
  private glow: Phaser.GameObjects.Image;
  private heroHit: Phaser.GameObjects.Zone;
  private gust: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private gen = 0;
  private clock = 0;
  private waiters: (() => boolean)[] = [];
  private reacting = false;
  private jumpHoldT = 0;
  private exiting = false;
  private nextBeat = 0;

  constructor(private scene: Phaser.Scene, quick: boolean) {
    const s = scene;
    ensureCanvas(s, 'menu-exclaim', paintExclaim);
    s.physics.world.setBounds(600, -200, 740, GAME_H + 400);
    const floor = s.add.zone(GAME_W / 2, G + 60, GAME_W + 600, 120);
    s.physics.add.existing(floor, true);

    this.flower = new SneezeFlower(s, FLOWER_X);
    this.stone = new MenuStone(s);
    this.snapper = new MenuSnapper(s);

    this.glow = s.add.image(0, 0, 'dot-warm').setScale(3.4).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.player - 2);
    this.hero = new Player(s, quick ? 1080 : 1320, G - PHYSICS.bodyH / 2 - 2);
    this.hero.visualScale = HERO_SCALE;
    this.hero.speedScale = 0.5;
    this.hero.facing = -1;
    s.physics.add.collider(this.hero.zone, floor);
    s.physics.add.collider(this.hero.zone, this.stone.zone);
    this.hero.onJump = () => sfx('jump', this.hero.x, 0.35);
    this.hero.onLand = (k) => { sfx('land', this.hero.x, 0.4 * k); this.dust.explode(4 + Math.round(k * 6), this.hero.x, this.hero.bottom); };

    this.dust = s.add.particles(0, 0, 'dust', {
      emitting: false, lifespan: 420, speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 },
      scale: { start: 0.55, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: -40
    }).setDepth(DEPTH.fx);
    this.gust = s.add.particles(0, 0, 'leaf', {
      emitting: false, lifespan: 1000, speed: { min: 380, max: 720 }, angle: { min: -22, max: 12 },
      scale: { start: 0.42, end: 0.2 }, rotate: { min: 0, max: 360 }, gravityY: 160, alpha: { start: 1, end: 0 }
    }).setDepth(DEPTH.fx);

    this.butterfly = new Butterfly(s, () => this.flower.headPos());

    // --- réactions des pièges (indépendantes du script : elles marchent aussi au clic)
    this.flower.onBlast = () => this.blast();
    this.stone.onWarn = () => { if (this.stone.heroOn(this.hero)) void this.hopOffStone(); };
    this.snapper.onWake = () => { if (Math.abs(this.hero.x - SNAP_X) < 120) void this.dodgeSnapper(); };

    // --- interactions
    this.heroHit = s.add.zone(0, 0, 60, 80).setInteractive({ useHandCursor: true });
    this.heroHit.on('pointerdown', () => this.pokeHero());
    this.flower.head.on('pointerdown', () => this.interrupt(() => this.flower.sneeze(), 2600));
    this.stone.img.on('pointerdown', () => this.stone.trigger());
    this.snapper.head.on('pointerdown', () => this.snapper.trigger());

    void this.run(quick ? 'loop' : 'enter');
  }

  // ---------------------------------------------------------------- boucle

  update(delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.clock += dt;
    this.waiters = this.waiters.filter((w) => !w());

    // petit saut automatique devant un obstacle (le pavé) pendant une promenade
    const b = this.hero.body;
    if (this.jumpHoldT > 0) {
      this.jumpHoldT -= dt;
      if (this.jumpHoldT <= 0) this.puppet.jumpHeld = false;
    }
    if (this.hero.grounded && ((this.puppet.left && b.blocked.left) || (this.puppet.right && b.blocked.right))) this.jump(0.18);

    this.hero.update(delta, this.puppet as unknown as Controls);
    this.puppet.jumpPressed = false;

    this.flower.update(dt, this.hero.x);
    this.stone.update(dt, this.hero);
    this.snapper.update(dt);
    this.butterfly.update(dt);
    this.glow.setPosition(this.hero.x, this.hero.y - 6);
    this.heroHit.setPosition(this.hero.x, this.hero.y - 8);
  }

  // ---------------------------------------------------------------- outils de script

  private sleep(ms: number): Promise<void> {
    const g = this.gen;
    return new Promise((res, rej) => this.scene.time.delayedCall(ms, () => (g === this.gen ? res() : rej(new Cancelled()))));
  }

  private waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
    const g = this.gen;
    const start = this.clock;
    return new Promise((res, rej) => {
      this.waiters.push(() => {
        if (g !== this.gen) { rej(new Cancelled()); return true; }
        if (cond() || (this.clock - start) * 1000 > timeoutMs) { res(); return true; }
        return false;
      });
    });
  }

  /** Rattache une promesse "extérieure" (animation) au script courant : annulable. */
  private track<T>(p: Promise<T>): Promise<T> {
    const g = this.gen;
    return p.then((v) => { if (g !== this.gen) throw new Cancelled(); return v; });
  }

  private release(): void {
    this.puppet.left = this.puppet.right = this.puppet.jumpHeld = false;
  }

  private jump(hold: number): void {
    this.puppet.jumpPressed = true;
    this.puppet.jumpHeld = true;
    this.jumpHoldT = hold;
  }

  private async walkTo(x: number): Promise<void> {
    const dir = Math.sign(x - this.hero.x);
    if (Math.abs(x - this.hero.x) < 8) return;
    this.puppet.left = dir < 0;
    this.puppet.right = dir > 0;
    await this.waitFor(() => (dir > 0 ? this.hero.x >= x : this.hero.x <= x), 7000);
    this.release();
    await this.waitFor(() => this.hero.grounded, 1500);
  }

  private settled(): Promise<void> {
    return this.waitFor(() => !this.reacting && this.hero.grounded && Math.abs(this.hero.body.velocity.x) < 25, 5000);
  }

  private async run(start: 'enter' | 'loop' | 'recover'): Promise<void> {
    this.gen++;
    this.release();
    try {
      if (start === 'enter') {
        await this.sleep(700);
        await this.walkTo(1090);
        await this.sleep(250);
        this.hero.facing = -1;
        this.hero.wave();
        sfx('giggle', this.hero.x, 0.5);
        await this.sleep(1600);
      } else if (start === 'recover') {
        await this.settled();
        await this.sleep(700);
      }
      // les numéros avancent AVANT chaque saynète : après une interruption, on passe à la suivante
      for (;;) {
        const beat = this.nextBeat;
        this.nextBeat = (beat + 1) % 3;
        await this.idle(beat === 0 ? 2200 : 1400);
        if (beat === 0) await this.flowerGag();
        else if (beat === 1) await this.snapperGag();
        else {
          this.hero.facing = -1;
          this.hero.wave();
          sfx('giggle', this.hero.x, 0.4);
          await this.sleep(1500);
        }
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) console.error(e);
    }
  }

  /** Coupe le script, joue une réaction, puis reprend la promenade. */
  private interrupt(fn: () => unknown, resumeAfterMs: number): void {
    if (this.exiting) return;
    this.gen++;
    this.release();
    fn();
    const g = this.gen;
    this.scene.time.delayedCall(resumeAfterMs, () => { if (g === this.gen) void this.run('recover'); });
  }

  // ---------------------------------------------------------------- comportements

  private async idle(ms: number): Promise<void> {
    await this.settled();
    await this.sleep(ms * 0.35);
    this.hero.facing = (this.hero.facing * -1) as 1 | -1; // regarde autour de lui
    await this.sleep(ms * 0.3);
    this.hero.facing = (this.hero.facing * -1) as 1 | -1;
    await this.sleep(ms * 0.35);
  }

  private async flowerGag(): Promise<void> {
    await this.walkTo(850);
    this.hero.facing = -1;
    this.hero.setExpression('smile', 900);
    await this.sleep(600);
    await this.track(this.flower.sneeze());
    await this.settled();
  }

  private async snapperGag(): Promise<void> {
    await this.walkTo(1132);
    this.hero.facing = 1;
    await this.sleep(500);
    this.snapper.trigger();
    await this.waitFor(() => this.snapper.phase === 'retract', 4000);
    await this.settled();
    this.hero.setExpression('flat', 700);
    await this.sleep(800);
  }

  /** Éternuement : le héros devant la fleur est soufflé… souvent droit sur le pavé poli. */
  private blast(): void {
    const fx = FLOWER_X + 70;
    for (let i = 0; i < 3; i++) this.scene.time.delayedCall(i * 60, () => this.gust.explode(5, fx, G - 210 + Math.random() * 30));
    const h = this.hero;
    const dx = h.x - FLOWER_X;
    if (dx > 20 && dx < 340 && h.alive && !this.exiting) {
      this.release();
      h.body.setVelocity(560 * (1 - dx / 600), -520);
      h.startle();
      this.exclaim();
      sfx('whoosh', h.x, 0.8);
    }
  }

  private async hopOffStone(): Promise<void> {
    if (this.reacting || this.exiting) return;
    this.reacting = true;
    const g = ++this.gen; // la réaction prend la main sur le script
    this.release();
    const h = this.hero;
    h.startle();
    this.exclaim();
    await new Promise<void>((r) => this.scene.time.delayedCall(260, () => r()));
    this.puppet.right = true;
    this.jump(0.2);
    await new Promise<void>((r) => this.scene.time.delayedCall(520, () => r()));
    this.release();
    await new Promise<void>((r) => this.waiters.push(() => { if (h.grounded) { r(); return true; } return false; }));
    this.reacting = false;
    if (g === this.gen) void this.run('recover');
  }

  private async dodgeSnapper(): Promise<void> {
    if (this.reacting || this.exiting) return;
    this.reacting = true;
    const h = this.hero;
    await new Promise<void>((r) => this.scene.time.delayedCall(240, () => r()));
    this.release();
    h.startle();
    this.exclaim();
    if (h.grounded) h.body.setVelocity(h.x >= SNAP_X ? 300 : -330, -380);
    await new Promise<void>((r) => this.scene.time.delayedCall(150, () => r()));
    await new Promise<void>((r) => this.waiters.push(() => { if (h.grounded) { r(); return true; } return false; }));
    this.reacting = false;
  }

  private pokeHero(): void {
    if (this.reacting || this.exiting || !this.hero.grounded) return;
    this.interrupt(() => {
      this.jump(0.25);
      this.hero.wave();
      sfx('giggle', this.hero.x, 0.7);
    }, 1600);
  }

  private exclaim(): void {
    const h = this.hero;
    const e = this.scene.add.image(h.x + 4, h.y - 78, 'menu-exclaim').setScale(0).setDepth(DEPTH.fx + 1);
    this.scene.tweens.add({ targets: e, scale: 0.7, y: e.y - 10, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: e, alpha: 0, delay: 650, duration: 220, onComplete: () => e.destroy() });
    sfx('bubble', h.x, 0.6);
  }

  // ---------------------------------------------------------------- appels du menu

  /** Le héros jette un œil vers le menu quand on change de sélection. */
  lookAtMenu(): void {
    if (this.reacting || this.exiting) return;
    const h = this.hero;
    if (h.grounded && !this.puppet.left && !this.puppet.right && Math.abs(h.body.velocity.x) < 20) {
      h.facing = -1;
      h.setExpression('smile', 500);
    }
  }

  /** Départ vers la partie : il file vers la droite. */
  exit(): void {
    this.exiting = true;
    this.gen++;
    this.release();
    this.scene.physics.world.setBounds(600, -200, 1200, GAME_H + 400);
    this.hero.speedScale = 1;
    this.hero.setExpression('grin', 2000);
    this.puppet.right = true;
  }

  destroy(): void {
    this.gen++;
    this.waiters = [];
    this.hero.destroy();
  }
}
