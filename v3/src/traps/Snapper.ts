import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { Trap, TrapContext } from './Trap';

export interface SnapperConfig {
  x: number;
  pathY: number;   // surface où marche le joueur sous la plante
  offset?: number; // décalage de phase (s)
}

// Cycle : repos → réveil (anticipation lisible) → frappe → mastication → remontée
const REST = 1.5, WAKE = 0.65, STRIKE = 0.12, HOLD = 0.38, RETRACT = 0.5;
const CYCLE = REST + WAKE + STRIKE + HOLD + RETRACT;

/**
 * Dionée suspendue : danger rythmique qui pousse le joueur à S'ARRÊTER pour attendre…
 * c'est précisément ce que les pavés polis exploitent. Le seul indice dont le joueur a
 * besoin (où attendre) est donné par le type de pavé, jamais par un panneau.
 */
export class Snapper implements Trap {
  readonly id: string;
  private head: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Image;
  private lower: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image;
  private stalk: Phaser.GameObjects.Graphics;
  private pot: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private t: number;
  private phase = 'rest';
  private restY: number;
  private strikeY: number;
  private anchorY: number;
  private chewing = 0;
  private time = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: SnapperConfig, index: number) {
    this.id = `snapper-${index}`;
    this.t = cfg.offset ?? 0;
    this.restY = cfg.pathY - 215;
    this.strikeY = cfg.pathY - 34;
    this.anchorY = cfg.pathY - 470;

    this.shadow = scene.add.ellipse(cfg.x, cfg.pathY + 2, 110, 16, 0x2a1530, 0.15).setDepth(DEPTH.terrain + 3);
    this.stalk = scene.add.graphics().setDepth(DEPTH.traps - 1);
    this.pot = scene.add.image(cfg.x, this.anchorY, 'hang-pot').setScale(0.6).setDepth(DEPTH.traps);
    // chaînes du pot suspendu
    const chains = scene.add.graphics().setDepth(DEPTH.traps - 2);
    chains.lineStyle(2, 0xffffff, 0.55);
    chains.lineBetween(cfg.x - 28, this.anchorY - 14, cfg.x, this.anchorY - 420);
    chains.lineBetween(cfg.x + 28, this.anchorY - 14, cfg.x, this.anchorY - 420);
    this.extra.push(chains);

    this.upper = scene.add.image(0, 0, 'snap-jaw').setOrigin(0.5, 0.78).setScale(0.75);
    this.lower = scene.add.image(0, 0, 'snap-jaw').setOrigin(0.5, 0.78).setScale(0.75, -0.75);
    this.eyes = scene.add.image(0, -26, 'snap-eyes-closed').setScale(0.6);
    this.head = scene.add.container(cfg.x, this.restY, [this.lower, this.upper, this.eyes]).setDepth(DEPTH.traps);
  }

  private extra: Phaser.GameObjects.GameObject[] = [];

  /** Zone mortelle courante, ou null si la plante est inoffensive. */
  dangerRect(): Phaser.Geom.Rectangle | null {
    if (this.phase === 'strike' && this.t > STRIKE * 0.4) return this.rect();
    if (this.phase === 'hold') return this.rect();
    if (this.phase === 'retract' && this.t < 0.12) return this.rect();
    return null;
  }

  private rect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.cfg.x - 46, this.head.y - 36, 92, 72);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    if (this.chewing > 0) {
      this.chewing -= dt;
      const k = Math.abs(Math.sin(this.time * 18));
      this.setJaw(4 + k * 10);
      this.head.setScale(1 + k * 0.06, 1 - k * 0.04);
      this.drawStalk();
      return;
    }
    this.head.setScale(1);

    this.t += dt;
    const prev = this.phase;
    // machine à états déterministe
    if (this.phase === 'rest' && this.t >= REST) this.go('wake');
    else if (this.phase === 'wake' && this.t >= WAKE) this.go('strike');
    else if (this.phase === 'strike' && this.t >= STRIKE) this.go('hold');
    else if (this.phase === 'hold' && this.t >= HOLD) this.go('retract');
    else if (this.phase === 'retract' && this.t >= RETRACT) this.go('rest');

    if (prev !== this.phase) {
      if (this.phase === 'wake') {
        ctx.sfx('snapWake', this.cfg.x, 0.8);
        this.eyes.setTexture('snap-eyes-open');
      }
      if (this.phase === 'hold') {
        ctx.sfx('chomp', this.cfg.x);
        ctx.burst('dust', this.cfg.x, this.cfg.pathY, 5);
      }
      if (this.phase === 'rest') this.eyes.setTexture('snap-eyes-closed');
    }

    let y = this.restY;
    let jaw = 8;
    let shakeX = 0;
    let shadowA = 0.12;
    switch (this.phase) {
      case 'rest': {
        y = this.restY + Math.sin(this.time * 1.8) * 4; // respiration endormie
        jaw = 6 + Math.sin(this.time * 1.8) * 2;
        break;
      }
      case 'wake': {
        const k = this.t / WAKE;
        y = this.restY - 26 * Phaser.Math.Easing.Sine.Out(k); // recule pour prendre de l'élan
        jaw = 8 + 34 * Phaser.Math.Easing.Back.Out(Math.min(1, k * 1.4));
        shakeX = Math.sin(this.time * 60) * 2.5 * k;
        shadowA = 0.15 + 0.3 * k;
        break;
      }
      case 'strike': {
        const k = this.t / STRIKE;
        y = Phaser.Math.Linear(this.restY - 26, this.strikeY, Phaser.Math.Easing.Quadratic.In(k));
        jaw = 42 * (1 - k);
        shadowA = 0.5;
        break;
      }
      case 'hold':
        y = this.strikeY + Math.sin(this.t * 40) * 1.5;
        jaw = 0;
        shadowA = 0.5;
        break;
      case 'retract': {
        const k = this.t / RETRACT;
        y = Phaser.Math.Linear(this.strikeY, this.restY, Phaser.Math.Easing.Cubic.InOut(k));
        jaw = 8 * k;
        shadowA = 0.5 - 0.38 * k;
        break;
      }
    }
    this.head.setPosition(this.cfg.x + shakeX, y);
    this.setJaw(jaw);
    // l'ombre au sol désigne la zone exacte qui va être croquée
    this.shadow.setFillStyle(0x2a1530, shadowA);
    const near = 1 - (y - this.strikeY) / (this.restY - this.strikeY + 30);
    this.shadow.setScale(0.75 + near * 0.35, 1);
    this.drawStalk();
  }

  private go(p: string): void {
    this.phase = p;
    this.t = 0;
  }

  private setJaw(deg: number): void {
    const a = Phaser.Math.DegToRad(deg);
    this.upper.setRotation(-a * 0.5);
    this.lower.setRotation(a * 0.5);
    this.upper.y = -4 - deg * 0.35;
    this.lower.y = 4 + deg * 0.35;
    this.eyes.y = this.upper.y - 26;
  }

  private drawStalk(): void {
    const g = this.stalk;
    g.clear();
    const x0 = this.cfg.x, y0 = this.anchorY + 20;
    const x1 = this.head.x, y1 = this.head.y - 30;
    const sway = Math.sin(this.time * 1.3) * 16;
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2(x0 + 30 + sway, y0 + (y1 - y0) * 0.3),
      new Phaser.Math.Vector2(x1 - 30 - sway, y0 + (y1 - y0) * 0.7),
      new Phaser.Math.Vector2(x1, y1)
    );
    g.lineStyle(10, 0x4e7a62, 1);
    curve.draw(g, 24);
    g.lineStyle(3, 0x9cc59a, 0.8);
    curve.draw(g, 24);
    const p = curve.getPoint(0.45);
    g.fillStyle(0x6fa88f, 1);
    g.fillEllipse(p.x + 14, p.y, 30, 11);
  }

  onKilledPlayer(ctx: TrapContext): void {
    // gag : la plante mâchonne… puis recrache une petite feuille
    this.chewing = 0.9;
    this.scene.time.delayedCall(700, () => {
      ctx.sfx('bubble', this.cfg.x);
      const leaf = this.scene.add.image(this.head.x, this.head.y + 20, 'leaf').setDepth(DEPTH.fx).setScale(0.8);
      this.scene.tweens.add({
        targets: leaf, x: leaf.x + 60, y: leaf.y + 130, angle: 400, alpha: 0, duration: 900,
        ease: 'Sine.easeIn', onComplete: () => leaf.destroy()
      });
    });
  }

  reset(): void {
    // le rythme continue (le monde ne "triche" pas en se recalant sur le joueur),
    // mais on sort d'une éventuelle mastication.
    this.chewing = 0;
  }

  destroy(): void {
    this.head.destroy();
    this.stalk.destroy();
    this.pot.destroy();
    this.shadow.destroy();
    this.extra.forEach((o) => o.destroy());
  }
}
