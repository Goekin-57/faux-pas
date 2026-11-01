import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { Trap, TrapContext } from './Trap';
import { tuning } from '../core/Difficulty';

export interface SnapperConfig {
  x: number;
  pathY: number;   // surface où marche le joueur sous la plante
  offset?: number; // décalage de phase (s)
  /**
   * Dionée MALADROITE : au lieu d'un rythme, elle se réveille quand on s'approche du bouton
   * posé sous elle, et frappe là où on se trouvait. Si on s'est écarté, elle tape le bouton…
   * qui ouvre la grille. (Expert : elle suit le joueur pendant son réveil.)
   */
  lure?: { leverX: number; gate: { x: number; top: number; w: number; h: number } };
}

// Cycle : repos → réveil (anticipation lisible) → frappe → mastication → remontée
// (repos et réveil dépendent de la difficulté)
const STRIKE = 0.12, HOLD = 0.38, RETRACT = 0.5;

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
  private readonly REST: number;
  private readonly WAKE: number;
  private readonly punishCamping: boolean;
  private campedThisCycle = false;
  /** Position horizontale de la tête (les Dionées maladroites visent). */
  private hx: number;
  private targetX: number;
  private sulk = 0;
  private bonk = 0;
  private stars?: Phaser.GameObjects.Graphics;
  private lever?: Phaser.GameObjects.Graphics;
  private gateGfx?: Phaser.GameObjects.Graphics;
  /** Grille fermée (Dionée maladroite) : collision gérée par la scène. */
  readonly gateZone?: Phaser.GameObjects.Zone;
  gateOpen = false;
  private leverDown = 0;
  private cooldown = 0;
  private locked = false;
  private pulse = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: SnapperConfig, index: number) {
    this.id = `snapper-${index}`;
    const T = tuning();
    this.REST = T.snapperRest;
    this.WAKE = T.snapperWake;
    this.punishCamping = T.snapperPunishCamping;
    this.hx = this.targetX = cfg.x;
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
    this.stars = scene.add.graphics().setDepth(DEPTH.traps + 1);

    if (cfg.lure) {
      const gt = cfg.lure.gate;
      this.lever = scene.add.graphics().setDepth(DEPTH.props);
      this.gateGfx = scene.add.graphics().setDepth(DEPTH.terrain + 3);
      this.gateZone = scene.add.zone(gt.x + gt.w / 2, gt.top + gt.h / 2, gt.w, gt.h);
      scene.physics.add.existing(this.gateZone, true);
      this.drawLever();
      this.drawGate(0);
    }
  }

  private extra: Phaser.GameObjects.GameObject[] = [];

  /** Zone mortelle courante, ou null si la plante est inoffensive. */
  dangerRect(): Phaser.Geom.Rectangle | null {
    if (this.bonk > 0) return null; // assommée sur le bouton : inoffensive
    if (this.phase === 'strike' && this.t > STRIKE * 0.4) return this.rect();
    if (this.phase === 'hold') return this.rect();
    if (this.phase === 'retract' && this.t < 0.12) return this.rect();
    return null;
  }

  private rect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.hx - 46, this.head.y - 36, 92, 72);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.drawStars(dt);
    if (this.chewing > 0) {
      this.chewing -= dt;
      const k = Math.abs(Math.sin(this.time * 18));
      this.setJaw(4 + k * 10);
      this.head.setScale(1 + k * 0.06, 1 - k * 0.04);
      this.drawStalk();
      return;
    }
    if (this.pulse > 0) {
      this.pulse -= dt;
      const k = Math.sin((1 - Math.max(0, this.pulse) / 0.16) * Math.PI);
      this.head.setScale(1 + 0.14 * k, 1 - 0.1 * k);
    } else this.head.setScale(1);

    this.t += dt;
    const prev = this.phase;
    const p = ctx.player;
    if (this.cfg.lure) this.updateLure(dt, ctx);
    else {
      // Expert : si le joueur attend juste à côté (hésitation), elle n'attend pas la fin de son repos.
      if (this.phase === 'rest' && this.punishCamping && !this.campedThisCycle && p.alive && p.grounded) {
        const dx = Math.abs(p.x - this.cfg.x);
        if (dx < 170 && dx > 40 && Math.abs(p.bottom - this.cfg.pathY) < 14 && p.stillTime > 0.3 && this.t < this.REST - 0.3) {
          this.campedThisCycle = true;
          this.t = this.REST - 0.3;
          this.eyes.setTexture('snap-eyes-open'); // elle ouvre un œil : l'indice reste visible
        }
      }
      // machine à états déterministe
      if (this.phase === 'rest' && this.t >= this.REST) this.go('wake');
      else if (this.phase === 'wake' && this.t >= this.WAKE) this.go('strike');
      else if (this.phase === 'strike' && this.t >= STRIKE) this.go('hold');
      else if (this.phase === 'hold' && this.t >= HOLD) this.go('retract');
      else if (this.phase === 'retract' && this.t >= RETRACT) this.go('rest');
    }

    if (prev !== this.phase) {
      if (this.phase === 'wake') {
        ctx.sfx('snapWake', this.cfg.x, 0.8);
        this.eyes.setTexture('snap-eyes-open');
      }
      if (this.phase === 'hold') {
        ctx.sfx('chomp', this.hx);
        ctx.burst('dust', this.hx, this.cfg.pathY, 5);
        this.onBite(ctx);
      }
      if (this.phase === 'rest') {
        this.eyes.setTexture('snap-eyes-closed');
        this.campedThisCycle = false;
      }
    }
    if (this.sulk > 0) this.sulk -= dt;

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
        const k = this.t / this.WAKE;
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
    // vexée d'avoir raté : petit "non non" de la tête
    const sulkX = this.sulk > 0 ? Math.sin(this.sulk * 22) * 7 * Math.min(1, this.sulk) : 0;
    this.head.setPosition(this.hx + shakeX + sulkX, y);
    this.head.setAngle(this.sulk > 0 ? Math.sin(this.sulk * 22) * 6 : 0);
    this.setJaw(jaw);
    // l'ombre au sol désigne la zone exacte qui va être croquée
    this.shadow.setX(this.hx);
    this.shadow.setFillStyle(0x2a1530, shadowA);
    const near = 1 - (y - this.strikeY) / (this.restY - this.strikeY + 30);
    this.shadow.setScale(0.75 + near * 0.35, 1);
    this.drawStalk();
  }

  /** Morsure terminée : a-t-elle raté le joueur ? touché le bouton ? */
  private onBite(ctx: TrapContext): void {
    const p = ctx.player;
    const lure = this.cfg.lure;
    if (lure && !this.gateOpen && Math.abs(this.hx - lure.leverX) < 52) {
      // CLONK : la plante s'assomme sur le bouton… qui ouvre la grille
      this.gateOpen = true;
      this.leverDown = 1;
      this.bonk = 2.2;
      ctx.sfx('clonk', lure.leverX);
      ctx.sfx('dazed', this.hx, 0.7);
      ctx.burst('sparkle', lure.leverX, this.cfg.pathY - 20, 8);
      this.scene.time.delayedCall(260, () => ctx.sfx('gate', lure.gate.x));
      this.openGate();
      if (p.alive) {
        this.scene.time.delayedCall(350, () => { if (p.alive) { p.setExpression('grin', 900); p.happyEyes(800); } });
      }
      return;
    }
    if (!p.alive) return;
    const dx = Math.abs(p.x - this.hx);
    const dy = Math.abs(p.bottom - this.cfg.pathY);
    if (dx < 150 && dy < 90) {
      // ratée de peu : la plante est vexée, le héros a eu chaud
      this.sulk = 0.9;
      this.scene.time.delayedCall(120, () => ctx.sfx('grumble', this.hx));
      if (p.nearMiss()) this.scene.time.delayedCall(380, () => ctx.sfx('phew', p.x));
    }
  }

  /** Dionée maladroite : réveil déclenché par le joueur près du bouton, vise, frappe. */
  private updateLure(dt: number, ctx: TrapContext): void {
    const lure = this.cfg.lure!;
    const p = ctx.player;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.bonk > 0) {
      this.bonk -= dt;
      // assommée sur le bouton : elle reste au sol, puis remonte
      if (this.phase === 'hold') { this.t = Math.min(this.t, HOLD * 0.5); if (this.bonk <= 0) this.go('retract'); }
      return;
    }
    switch (this.phase) {
      case 'rest': {
        this.hx = Phaser.Math.Linear(this.hx, this.cfg.x, Math.min(1, dt * 3));
        const near = p.alive && Math.abs(p.x - lure.leverX) < 64 && Math.abs(p.bottom - this.cfg.pathY) < 14;
        if (near && this.cooldown <= 0) {
          // elle vise le joueur… debout près du bouton (Facile : pile sur le bouton)
          this.targetX = tuning().lureTracks ? p.x : lure.leverX;
          this.locked = false;
          this.go('wake');
        }
        break;
      }
      case 'wake':
        // Facile : elle vise le bouton, là où le joueur se tenait.
        // Expert : elle suit le joueur et ANTICIPE sa course (vise devant lui), puis verrouille sa cible
        // 0,3 s avant de frapper (petit "tic" + sursaut de la tête : le signal pour s'écarter).
        if (tuning().lureTracks && p.alive && !this.locked) {
          const lead = p.body.velocity.x * 0.3;
          this.targetX = Phaser.Math.Clamp(p.x + lead, this.cfg.x - 130, this.cfg.x + 130);
          if (this.t >= this.WAKE - 0.3) {
            this.locked = true;
            ctx.sfx('hourglass', this.hx, 1);
            this.pulse = 0.16;
          }
        }
        this.hx = Phaser.Math.Linear(this.hx, this.targetX, Math.min(1, dt * 9));
        if (this.t >= this.WAKE) this.go('strike');
        break;
      case 'strike':
        if (this.t >= STRIKE) this.go('hold');
        break;
      case 'hold':
        if (this.t >= HOLD) this.go('retract');
        break;
      case 'retract':
        if (this.t >= RETRACT) { this.go('rest'); this.cooldown = 0.8; }
        break;
    }
  }

  private openGate(): void {
    const g = this.cfg.lure!.gate;
    if (this.gateZone) (this.gateZone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    const st = { k: 0 };
    this.scene.tweens.add({ targets: st, k: 1, duration: 700, delay: 220, ease: 'Back.easeIn', onUpdate: () => this.drawGate(st.k) });
    void g;
  }

  private drawLever(): void {
    const g = this.lever;
    if (!g) return;
    g.clear();
    const x = this.cfg.lure!.leverX, y = this.cfg.pathY;
    const press = this.leverDown * 10;
    // socle de laiton + gros champignon-bouton
    g.fillStyle(0x1e2a24, 0.2);
    g.fillEllipse(x, y + 1, 70, 10);
    g.fillStyle(0xb68a3a, 1);
    g.fillRoundedRect(x - 24, y - 12, 48, 12, 4);
    g.fillStyle(0xf7d774, 1);
    g.fillRoundedRect(x - 24, y - 12, 48, 4, 2);
    g.fillStyle(0xe8846b, 1);
    g.fillEllipse(x, y - 22 + press, 46, 22 - press * 0.6);
    g.fillStyle(0xfff1c9, 0.9);
    g.fillCircle(x - 9, y - 26 + press, 3.5);
    g.fillCircle(x + 8, y - 24 + press, 2.5);
    // câble (liane) jusqu'à la grille
    const gx = this.cfg.lure!.gate.x;
    g.lineStyle(3, 0x4e7a62, 0.9);
    g.beginPath();
    g.moveTo(x + 24, y - 6);
    g.lineTo((x + gx) / 2, y - 2);
    g.lineTo(gx, y - 8);
    g.strokePath();
  }

  /** Grille de treillage. k : 0 fermée → 1 remontée. */
  private drawGate(k: number): void {
    const g = this.gateGfx;
    if (!g) return;
    const gt = this.cfg.lure!.gate;
    g.clear();
    const lift = gt.h * 0.92 * k;
    const top = gt.top - lift;
    // montants
    g.fillStyle(0x6b4a2c, 1);
    g.fillRect(gt.x - 8, gt.top - 30, 8, gt.h + 30);
    g.fillRect(gt.x + gt.w, gt.top - 30, 8, gt.h + 30);
    g.fillStyle(0x8a6238, 1);
    g.fillRoundedRect(gt.x - 14, gt.top - 40, gt.w + 28, 14, 5);
    // treillage
    g.lineStyle(5, 0x9a7144, 1);
    const h = gt.h;
    for (let i = 0; i <= 3; i++) g.lineBetween(gt.x + (gt.w * i) / 3, top, gt.x + (gt.w * i) / 3, top + h);
    for (let j = 0; j <= 6; j++) g.lineBetween(gt.x, top + (h * j) / 6, gt.x + gt.w, top + (h * j) / 6);
    // feuilles de lierre
    g.fillStyle(0x5e9a70, 1);
    for (let j = 0; j < 5; j++) g.fillEllipse(gt.x + (j % 2 ? gt.w - 6 : 6), top + 30 + j * (h / 5), 16, 9);
  }

  private drawStars(dt: number): void {
    const g = this.stars;
    if (!g) return;
    g.clear();
    if (this.bonk <= 0 && this.leverDown <= 0) return;
    if (this.leverDown > 0 && this.bonk <= 0) {
      this.leverDown = Math.max(0, this.leverDown - dt * 1.5);
      this.drawLever();
    }
    if (this.bonk <= 0) return;
    // étoiles qui tournent autour de la tête assommée
    for (let i = 0; i < 3; i++) {
      const a = this.time * 5 + (i * Math.PI * 2) / 3;
      const sx = this.head.x + Math.cos(a) * 34, sy = this.head.y - 40 + Math.sin(a) * 9;
      g.fillStyle(0xf7d774, 1);
      g.fillCircle(sx, sy, 5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(sx - 1.5, sy - 1.5, 1.6);
    }
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
    this.sulk = 0;
    this.campedThisCycle = false;
    if (this.cfg.lure) {
      // la Dionée maladroite se rendort ; une grille ouverte le reste (c'est un passage, pas un piège)
      this.phase = 'rest';
      this.t = 0;
      this.bonk = 0;
      this.cooldown = 0.5;
      this.hx = this.targetX = this.cfg.x;
    }
  }

  destroy(): void {
    this.head.destroy();
    this.stalk.destroy();
    this.pot.destroy();
    this.shadow.destroy();
    this.extra.forEach((o) => o.destroy());
    this.stars?.destroy();
    this.lever?.destroy();
    this.gateGfx?.destroy();
    this.gateZone?.destroy();
  }
}
