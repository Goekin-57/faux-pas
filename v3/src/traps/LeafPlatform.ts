import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { Trap, TrapContext } from './Trap';

export interface PlatformConfig {
  x: number;      // centre
  top: number;
  w: number;
  /** Oscillation horizontale (amplitude px, période s). */
  move?: { dx: number; period: number };
}

/**
 * Plateforme-feuille suspendue (traversable par en dessous).
 * Peut osciller doucement (porte volante, mode Expert) : elle emporte le joueur… et la porte.
 */
export class LeafPlatform implements Trap {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  private gfx: Phaser.GameObjects.Graphics;
  x: number;
  private time = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: PlatformConfig, index: number) {
    this.id = `leaf-${index}`;
    this.x = cfg.x;
    this.gfx = scene.add.graphics().setDepth(DEPTH.terrain + 1);
    this.zone = scene.add.zone(cfg.x, cfg.top + 8, cfg.w, 16);
    scene.physics.add.existing(this.zone);
    const b = this.zone.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(false);
    b.setImmovable(true);
    b.moves = false;
    b.checkCollision.down = false;
    b.checkCollision.left = false;
    b.checkCollision.right = false;
    this.draw();
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    if (!this.cfg.move) return;
    const prev = this.x;
    this.x = this.cfg.x + Math.sin((this.time / this.cfg.move.period) * Math.PI * 2) * this.cfg.move.dx;
    const d = this.x - prev;
    this.zone.x = this.x;
    const p = ctx.player;
    const pb = p.body;
    const on = p.alive && pb.velocity.y >= -10 && Math.abs(pb.bottom - this.cfg.top) < 8 &&
      pb.right > this.x - this.cfg.w / 2 && pb.left < this.x + this.cfg.w / 2;
    if (on) p.zone.x += d;
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const x = this.x, top = this.cfg.top, w = this.cfg.w;
    // lianes de suspension
    g.lineStyle(3, 0x4e7a62, 0.9);
    g.lineBetween(x - w / 2 + 14, top + 4, x - w / 2 + 30, top - 400);
    g.lineBetween(x + w / 2 - 14, top + 4, x + w / 2 - 30, top - 400);
    // feuille
    g.fillStyle(0x1e2a24, 0.16);
    g.fillEllipse(x, top + 22, w * 0.9, 10);
    g.fillStyle(0x4e8a64, 1);
    g.fillEllipse(x, top + 9, w + 20, 26);
    g.fillStyle(0x7db386, 1);
    g.fillEllipse(x, top + 5, w + 6, 16);
    g.lineStyle(2, 0x3f7356, 0.8);
    g.lineBetween(x - w / 2, top + 6, x + w / 2, top + 6);
    for (let i = -3; i <= 3; i++) g.lineBetween(x + i * (w / 8), top + 6, x + i * (w / 8) + 10, top + 1);
  }

  reset(): void {
    // le mouvement continue (le monde ne se recale pas sur le joueur)
  }

  destroy(): void {
    this.gfx.destroy();
    this.zone.destroy();
  }
}
