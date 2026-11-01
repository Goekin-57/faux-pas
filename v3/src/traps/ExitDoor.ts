import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';
import type { TrapContext } from './Trap';

/**
 * Porte de sortie de la serre.
 * Gag du niveau (jamais mortel) : si on arrive en courant la première fois,
 * la porte recule d'un bond — « Pas si vite ! ». Au calme, elle s'ouvre.
 * Cohérent avec la leçon du chapitre : le monde réagit à la façon dont on bouge.
 */
export class ExitDoor {
  x: number;
  private frame: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private leaf: Phaser.GameObjects.Image;
  private group: Phaser.GameObjects.Container;
  private state: 'closed' | 'moving' | 'open' | 'done' = 'closed';
  private scooted = false;
  private time = 0;

  constructor(private scene: Phaser.Scene, x: number, readonly groundY: number, private scootTo: number, private onEnter: () => void) {
    this.x = x;
    this.glow = scene.add.image(0, -8, 'door-glow').setOrigin(0.5, 1).setScale(0.5);
    this.leaf = scene.add.image(-30, -8, 'door-leaf').setOrigin(0, 1).setScale(0.5);
    this.frame = scene.add.image(0, 0, 'door-frame').setOrigin(0.5, 1).setScale(0.5);
    this.group = scene.add.container(x, groundY + 2, [this.glow, this.leaf, this.frame]).setDepth(DEPTH.props);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    if (this.state === 'moving') this.updateScoot(dt, ctx);
    const p = ctx.player;
    if (!p.alive) return;
    const dx = this.x - p.x;
    if (this.state === 'closed' && Math.abs(dx) < 150 && Math.abs(p.bottom - this.groundY) < 30) {
      const fast = Math.abs(p.body.velocity.x) > 210;
      if (fast && !this.scooted && dx > 0) this.scoot(ctx);
      else this.open(ctx);
    }
    if (this.state === 'open' && Math.abs(dx) < 18 && Math.abs(p.bottom - this.groundY) < 30) {
      this.state = 'done';
      this.onEnter();
    }
  }

  private scootFrom = 0;
  private scootT = 0;

  private scoot(ctx: TrapContext): void {
    this.scooted = true;
    this.state = 'moving';
    this.scootFrom = this.x;
    this.scootT = 0;
    ctx.sfx('doorScoot', this.x);
    ctx.player.setExpression('open', 900);
    this.bubble('Pas si vite !');
  }

  /** Déplacement du gag, piloté par la boucle de jeu (déterministe). */
  private updateScoot(dt: number, ctx: TrapContext): void {
    const DUR = 0.5;
    this.scootT = Math.min(1, this.scootT + dt / DUR);
    const k = this.scootT;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.x = this.scootFrom + (this.scootTo - this.scootFrom) * e;
    this.group.x = this.x;
    this.group.y = this.groundY + 2 - Math.abs(Math.sin(k * Math.PI * 3)) * 14;
    this.group.angle = Math.sin(k * Math.PI * 6) * 4;
    if (k >= 1) {
      this.group.y = this.groundY + 2;
      this.group.angle = 0;
      this.state = 'closed';
      ctx.burst('dust', this.x, this.groundY, 6);
    }
  }

  private open(ctx: TrapContext): void {
    this.state = 'open';
    ctx.sfx('doorOpen', this.x);
    if (!this.scooted) this.bubble('Entrez donc.');
    this.scene.tweens.add({ targets: this.leaf, scaleX: 0.04, duration: 420, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.6, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
  }

  private bubble(text: string): void {
    const s = this.scene;
    const label = s.add.text(0, 0, text, { fontFamily: FONTS.ui, fontSize: '20px', color: '#24306a', fontStyle: '600' }).setOrigin(0.5);
    const w = label.width + 28, h = label.height + 14;
    const g = s.add.graphics();
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillTriangle(-8, h / 2 - 1, 8, h / 2 - 1, -2, h / 2 + 10);
    const c = s.add.container(this.group.x, this.groundY - 150, [g, label]).setDepth(DEPTH.fx).setScale(0);
    s.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: c, alpha: 0, y: c.y - 16, delay: 1500, duration: 300, onComplete: () => c.destroy() });
    // la bulle suit la porte si elle se déplace
    const follow = s.time.addEvent({ delay: 16, repeat: 110, callback: () => { if (c.active) c.x = this.group.x; } });
    void follow;
  }

  reset(): void {
    // la porte garde sa position (elle a déjà fait sa blague) mais se referme si besoin
    if (this.state === 'done') return;
  }

  destroy(): void {
    this.group.destroy();
  }
}
