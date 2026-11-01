import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { TrapContext } from './Trap';

/** Point de contrôle : un bourgeon en pot qui éclot quand on le touche. */
export class Checkpoint {
  active = false;
  private pot: Phaser.GameObjects.Image;
  private stem: Phaser.GameObjects.Graphics;
  private bud: Phaser.GameObjects.Image;
  private bloom: Phaser.GameObjects.Image;
  private time = Math.random() * 5;

  constructor(private scene: Phaser.Scene, readonly x: number, readonly groundY: number) {
    this.pot = scene.add.image(x, groundY, 'cp-pot').setOrigin(0.5, 1).setScale(0.5).setDepth(DEPTH.props);
    this.stem = scene.add.graphics().setDepth(DEPTH.props - 0.1);
    this.bud = scene.add.image(x, groundY - 70, 'cp-bud').setScale(0.55).setDepth(DEPTH.props);
    this.bloom = scene.add.image(x, groundY - 74, 'cp-bloom').setScale(0).setDepth(DEPTH.props);
    this.drawStem(0);
  }

  get spawnX(): number { return this.x + 30; }
  get spawnY(): number { return this.groundY - 30; }

  update(dt: number, ctx: TrapContext): boolean {
    this.time += dt;
    const sway = Math.sin(this.time * 2) * 3;
    this.drawStem(sway);
    this.bud.setPosition(this.x + sway, this.groundY - 70);
    this.bloom.setPosition(this.x + sway, this.groundY - 74).setAngle(sway * 2);
    if (this.active) return false;
    const p = ctx.player.body;
    if (Math.abs(ctx.player.x - this.x) < 40 && p.bottom > this.groundY - 120 && p.top < this.groundY) {
      this.activate(ctx);
      return true;
    }
    return false;
  }

  private activate(ctx: TrapContext): void {
    this.active = true;
    ctx.sfx('checkpoint', this.x);
    ctx.burst('petals', this.x, this.groundY - 74, 14);
    ctx.player.setExpression('grin', 700);
    this.scene.tweens.add({ targets: this.bud, scale: 0, duration: 140 });
    this.scene.tweens.add({ targets: this.bloom, scale: 0.62, angle: 180, duration: 520, ease: 'Back.easeOut', delay: 80 });
  }

  private drawStem(sway: number): void {
    const g = this.stem;
    g.clear();
    g.lineStyle(5, 0x5e9a70, 1);
    g.beginPath();
    g.moveTo(this.x, this.groundY - 36);
    g.lineTo(this.x + sway, this.groundY - 64);
    g.strokePath();
    g.fillStyle(0x7db386, 1);
    g.fillEllipse(this.x - 10 + sway * 0.5, this.groundY - 48, 18, 7);
  }

  destroy(): void {
    this.pot.destroy();
    this.stem.destroy();
    this.bud.destroy();
    this.bloom.destroy();
  }
}
