import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { Trap, TrapContext } from './Trap';

export interface RaftConfig {
  /** Centre de départ. */
  x: number;
  top: number;
  w: number;
  /** Centre d'arrivée (butée contre la rive d'en face). */
  endX: number;
}

/**
 * RADEAU À VOILE — piège en chaîne du 1-2.
 * Une feuille flottante munie d'une voile, posée sur un câble au-dessus des ronces.
 * Il ne bouge pas tout seul : il faut qu'une fleur éternue dans sa voile.
 * Arrivé en butée, il reste là tant qu'on est dessus, puis revient à son point de départ.
 */
export class Raft implements Trap {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  private gfx: Phaser.GameObjects.Graphics;
  private rope: Phaser.GameObjects.Graphics;
  x: number;
  private v = 0;
  private time = 0;
  private sail = 0; // gonflement de la voile (0 → 1)
  private vacant = 0;
  private state: 'rest' | 'sailing' | 'docked' | 'back' = 'rest';
  private onPrev = false;
  /** Nombre de traversées (tests). */
  crossings = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: RaftConfig, index: number) {
    this.id = `raft-${index}`;
    this.x = cfg.x;
    this.rope = scene.add.graphics().setDepth(DEPTH.terrain - 2);
    this.gfx = scene.add.graphics().setDepth(DEPTH.terrain + 2);
    this.zone = scene.add.zone(cfg.x, cfg.top + 9, cfg.w, 18);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.moves = false;
    this.drawRope();
    this.draw();
  }

  /** Une bourrasque gonfle la voile. */
  blow(ctx: TrapContext): void {
    if (this.state === 'docked') return;
    this.state = 'sailing';
    this.v = 640;
    this.sail = 1;
    ctx.sfx('raft', this.x);
    ctx.burst('leaves', this.x - 20, this.cfg.top - 60, 6);
  }

  private standing(ctx: TrapContext): boolean {
    const p = ctx.player;
    if (!p.alive) return false;
    const pb = p.body;
    if (pb.velocity.y < -10) return false;
    const dy = pb.bottom - this.cfg.top;
    return pb.right > this.x - this.cfg.w / 2 + 2 && pb.left < this.x + this.cfg.w / 2 - 2 && dy > -4 && dy < 8;
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const on = this.standing(ctx);
    const prev = this.x;
    switch (this.state) {
      case 'sailing':
        this.v = Math.max(170, this.v - 330 * dt);
        this.x = Math.min(this.cfg.endX, this.x + this.v * dt);
        if (this.x >= this.cfg.endX) {
          this.state = 'docked';
          this.crossings++;
          this.vacant = 0;
          ctx.sfx('clonk', this.x);
          ctx.burst('dust', this.x + this.cfg.w / 2, this.cfg.top + 10, 6);
        }
        break;
      case 'docked':
        if (on) this.vacant = 0; else this.vacant += dt;
        if (this.vacant > 1.4) this.state = 'back';
        break;
      case 'back':
        this.x = Math.max(this.cfg.x, this.x - 150 * dt);
        if (this.x <= this.cfg.x) this.state = 'rest';
        break;
      case 'rest':
        break;
    }
    this.sail = Math.max(0, this.sail - dt * 0.8);
    const dx = this.x - prev;
    this.zone.x = this.x;
    if (on && dx !== 0) ctx.player.zone.x += dx;
    // sauter d'un radeau en marche conserve son élan (sinon il filerait sous nos pieds)
    const p = ctx.player;
    if (this.onPrev && !on && this.state === 'sailing' && p.alive && p.body.velocity.y < -100) {
      p.launch(p.body.velocity.x + this.v, p.body.velocity.y, 0.18);
    }
    this.onPrev = on;
    this.draw();
  }

  private drawRope(): void {
    const g = this.rope;
    g.clear();
    const y = this.cfg.top - 92;
    const x0 = this.cfg.x - 60, x1 = this.cfg.endX + 60;
    g.lineStyle(3, 0x6b4a2c, 0.9);
    g.lineBetween(x0, y, x1, y);
    g.fillStyle(0x8a6238, 1);
    g.fillRect(x0 - 6, y - 4, 8, 120);
    g.fillRect(x1 - 2, y - 4, 8, 120);
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const x = this.x, top = this.cfg.top, w = this.cfg.w;
    const bob = this.state === 'sailing' ? Math.sin(this.time * 14) * 1.5 : Math.sin(this.time * 2) * 1;
    // feuille-radeau
    g.fillStyle(0x1e2a24, 0.18);
    g.fillEllipse(x, top + 20 + bob, w * 0.9, 10);
    g.fillStyle(0x5e9a70, 1);
    g.fillEllipse(x, top + 8 + bob, w + 16, 22);
    g.fillStyle(0x86c08c, 1);
    g.fillEllipse(x, top + 5 + bob, w + 4, 14);
    g.lineStyle(2, 0x3f7356, 0.9);
    g.lineBetween(x - w / 2, top + 6 + bob, x + w / 2, top + 6 + bob);
    // mât + poulie sur le câble
    const mastTop = top - 92;
    g.lineStyle(4, 0x8a6238, 1);
    g.lineBetween(x - 20, top + bob, x - 20, mastTop);
    g.fillStyle(0xf7d774, 1);
    g.fillCircle(x - 20, mastTop, 5);
    // voile (pétale) qui se gonfle sous le souffle
    const belly = 10 + this.sail * 26;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const yy = mastTop + 8 + t * 70;
      pts.push(new Phaser.Math.Vector2(x - 18 + Math.sin(t * Math.PI) * belly, yy));
    }
    pts.push(new Phaser.Math.Vector2(x - 18, top - 14 + bob));
    g.fillStyle(0xfff1c9, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xe8846b, 0.9);
    g.strokePoints(pts, true);
  }

  reset(): void {
    this.x = this.cfg.x;
    this.v = 0;
    this.state = 'rest';
    this.vacant = 0;
    this.onPrev = false;
    this.zone.x = this.x;
    this.draw();
  }

  destroy(): void {
    this.gfx.destroy();
    this.rope.destroy();
    this.zone.destroy();
  }
}
