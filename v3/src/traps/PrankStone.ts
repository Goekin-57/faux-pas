import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { STONE_W, STONE_H } from '../art/paint';
import { tuning } from '../core/Difficulty';
import type { Trap, TrapContext } from './Trap';

export interface PrankConfig {
  x: number;
  top: number;
  /** Fond du fossé (la tige-ressort y est ancrée). */
  base: number;
}

/**
 * PAVÉ FARCEUR — l'accroche du 1-1 (premières secondes de jeu, jamais mortel).
 *
 * Il a l'air d'un pavé poli. Si on hésite dessus, il s'enfonce en comprimant sa tige-ressort
 * (et ouvre deux petits yeux rieurs). Si on saute pendant qu'il est comprimé, il se détend
 * d'un coup et propulse le héros par-dessus le fossé. Si on ne fait rien, il descend
 * tranquillement au fond du fossé (sans danger) et remonte quand on en sort.
 *
 * Expert : il n'attend même pas qu'on hésite, il s'enfonce dès qu'on atterrit dessus.
 */
export class PrankStone implements Trap {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  private img: Phaser.GameObjects.Image;
  private spring: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Graphics;
  private state: 'idle' | 'sinking' | 'bottom' | 'fling' | 'returning' = 'idle';
  private t = 0;
  private time = 0;
  private offset = 0;
  private vy = 0;
  private standingPrev = false;
  private vacant = 0;
  private eyes = 0; // 0 → 1 : les yeux s'ouvrent
  private wink = 0;
  private landed = false;
  private readonly maxDepth: number;
  private readonly hesitation: number;
  private readonly onLanding: boolean;
  /** Nombre de propulsions (tests / indice). */
  flings = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: PrankConfig, index: number) {
    this.id = `prank-${index}`;
    this.maxDepth = cfg.base - cfg.top - STONE_H - 6;
    const T = tuning();
    this.hesitation = 0.25;
    this.onLanding = T.prankOnLanding;
    this.spring = scene.add.graphics().setDepth(DEPTH.terrain - 1);
    this.img = scene.add.image(cfg.x, cfg.top + STONE_H / 2, 'stone-polished').setDepth(DEPTH.terrain + 1);
    this.face = scene.add.graphics().setDepth(DEPTH.terrain + 2);
    this.zone = scene.add.zone(cfg.x, cfg.top + STONE_H / 2, STONE_W - 2, STONE_H);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.moves = false;
    this.draw();
  }

  get top(): number { return this.cfg.top + this.offset; }

  private standing(ctx: TrapContext): boolean {
    const p = ctx.player;
    if (!p.alive) return false;
    const pb = p.body;
    if (pb.velocity.y < -10) return false;
    const half = STONE_W / 2;
    const dy = pb.bottom - this.top;
    return pb.right > this.cfg.x - half + 2 && pb.left < this.cfg.x + half - 2 && dy > -4 && dy < 10;
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const p = ctx.player;
    const on = this.standing(ctx);
    // a-t-on sauté depuis le pavé ? (il était sous nos pieds, on monte maintenant)
    const jumpedOff = this.standingPrev && !on && p.alive && p.body.velocity.y < -300;
    const prevOffset = this.offset;

    switch (this.state) {
      case 'idle':
        this.offset = Phaser.Math.Linear(this.offset, 0, Math.min(1, dt * 10));
        if (on && !this.landed) {
          this.landed = true;
          this.offset = 5; // petit "plonk" à l'atterrissage : il est souple
          ctx.sfx('boing', this.cfg.x, 0.5);
          if (this.onLanding) this.go('sinking', ctx);
        }
        if (!on) this.landed = false;
        if (on && p.stillTime > this.hesitation) this.go('sinking', ctx);
        if (jumpedOff && prevOffset > 3) this.fling(ctx, 0.35);
        break;
      case 'sinking':
        this.offset = Math.min(this.maxDepth, this.offset + (this.onLanding ? 95 : 70) * dt);
        if (jumpedOff) this.fling(ctx, Phaser.Math.Clamp(this.offset / 70, 0.55, 1));
        else if (!on && this.t > 0.2) this.go('returning', ctx);
        else if (this.offset >= this.maxDepth) this.go('bottom', ctx);
        break;
      case 'bottom':
        if (jumpedOff) this.fling(ctx, 0.6);
        else if (!on) {
          this.vacant += dt;
          if (this.vacant > 0.8) this.go('returning', ctx);
        } else this.vacant = 0;
        break;
      case 'fling':
        // détente : remonte en dépassant un peu, puis se stabilise
        this.vy += 3200 * dt;
        this.offset += this.vy * dt;
        if (this.offset >= 0 && this.vy > 0) { this.offset = 0; this.go('idle', ctx); }
        break;
      case 'returning':
        this.offset = Math.max(0, this.offset - 120 * dt);
        if (on && p.stillTime > this.hesitation) this.go('sinking', ctx);
        else if (jumpedOff && this.offset > 6) this.fling(ctx, 0.5);
        else if (this.offset <= 0) this.go('idle', ctx);
        break;
    }
    this.standingPrev = on;

    // yeux rieurs : apparaissent quand il s'enfonce, clin d'œil à la détente
    const wantEyes = this.state === 'sinking' || this.state === 'bottom' || this.state === 'fling' || this.wink > 0;
    this.eyes = Phaser.Math.Clamp(this.eyes + (wantEyes ? dt * 6 : -dt * 3), 0, 1);
    if (this.wink > 0) this.wink -= dt;

    // le joueur suit le pavé quand il descend (pas de décrochage)
    const dy = this.offset - prevOffset;
    this.zone.y = this.cfg.top + STONE_H / 2 + this.offset;
    if (on && dy > 0 && this.state !== 'fling') p.zone.y += dy;
    // filet de sécurité : jamais enfoncé dans le pavé
    const pb = p.body;
    const half = STONE_W / 2;
    const sink = pb.bottom - this.top;
    if (p.alive && this.state !== 'fling' && pb.right > this.cfg.x - half + 2 && pb.left < this.cfg.x + half - 2 &&
      pb.velocity.y >= 0 && sink > 0.5 && sink < STONE_H * 0.8) {
      p.zone.y -= sink;
      pb.y -= sink;
      pb.velocity.y = 0;
    }
    this.draw();
  }

  private fling(ctx: TrapContext, k: number): void {
    const p = ctx.player;
    this.flings++;
    this.vy = -900 * k;
    this.state = 'fling';
    this.t = 0;
    this.wink = 0.9;
    // propulsé vers l'avant, bien au-delà du fossé
    p.launch(Math.max(p.body.velocity.x, 300 + 140 * k), -760 - 360 * k, 0.28);
    ctx.sfx('spring', this.cfg.x, k);
    ctx.burst('leaves', this.cfg.x, this.top + STONE_H, 5);
    this.scene.time.delayedCall(200, () => ctx.sfx('giggle', this.cfg.x));
    this.scene.time.delayedCall(450, () => { if (p.alive) { p.setExpression('grin', 900); p.happyEyes(700); } });
  }

  private go(s: PrankStone['state'], ctx: TrapContext): void {
    if (s === 'sinking' && this.state !== 'sinking') {
      ctx.sfx('tileSink', this.cfg.x, 0.5);
      ctx.player.setExpression('worried', 500);
    }
    if (s === 'returning') this.vacant = 0;
    this.state = s;
    this.t = 0;
  }

  private draw(): void {
    const x = this.cfg.x;
    const top = this.top;
    this.img.setPosition(x, top + STONE_H / 2);
    // compression visible : le pavé s'aplatit un peu quand il est tout en bas
    const squash = this.state === 'fling' ? 1 + Math.min(0.12, -this.vy / 6000) : 1;
    this.img.setScale(1 / squash, squash);

    // tige-ressort
    const g = this.spring;
    g.clear();
    const y0 = top + STONE_H - 2, y1 = this.cfg.base;
    const len = Math.max(4, y1 - y0);
    const coils = 6;
    const amp = 10 + Math.min(8, this.offset / 14);
    g.lineStyle(6, 0x5e9a70, 1);
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const px = x + Math.sin(t * Math.PI * 2 * coils) * amp;
      const py = y0 + t * len;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(2, 0xb6dc98, 0.8);
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const px = x - 1 + Math.sin(t * Math.PI * 2 * coils) * amp;
      const py = y0 + t * len - 1;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.fillStyle(0x86b97f, 1);
    g.fillEllipse(x, y0 + 2, 34, 10);

    // petit visage farceur
    const f = this.face;
    f.clear();
    if (this.eyes <= 0.01) return;
    const a = this.eyes;
    const ey = top + STONE_H / 2 - 1;
    f.fillStyle(0x24306a, a);
    if (this.wink > 0) {
      f.lineStyle(3, 0x24306a, a);
      f.lineBetween(x - 18, ey, x - 8, ey - 2);
    } else {
      f.fillEllipse(x - 13, ey, 6, 7 * a);
    }
    f.fillEllipse(x + 13, ey, 6, 7 * a);
    f.lineStyle(2.5, 0x24306a, a);
    f.beginPath();
    f.arc(x, ey + 5, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    f.strokePath();
  }

  reset(): void {
    this.state = 'idle';
    this.t = 0;
    this.offset = 0;
    this.vy = 0;
    this.vacant = 0;
    this.eyes = 0;
    this.wink = 0;
    this.landed = false;
    this.standingPrev = false;
    this.zone.y = this.cfg.top + STONE_H / 2;
    this.draw();
  }

  destroy(): void {
    this.img.destroy();
    this.spring.destroy();
    this.face.destroy();
    this.zone.destroy();
  }
}
