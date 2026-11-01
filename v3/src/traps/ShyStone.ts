import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { STONE_W, STONE_H } from '../art/paint';
import type { Trap, TrapContext } from './Trap';

export interface StoneConfig {
  x: number;          // centre
  top: number;        // surface de marche
  kind: 'matte' | 'polished';
  base: number;       // y où s'ancre la tige / le pilier
  stopDepth?: number; // pavé-ascenseur : s'enfonce de N px puis s'arrête
}

// Réglages du chapitre 1 (identiques pour tous les pavés : la règle doit être apprise une fois).
const HESITATION = 0.45; // s immobile avant le premier signe
const WARN = 0.7;        // durée du tremblement avant que le pavé cède
const RESPAWN = 2.2;
const SINK_SPEED = 95;
const RETURN_SPEED = 130;
const RETURN_DELAY = 1.3;

type State = 'idle' | 'warn' | 'falling' | 'gone' | 'regrow' | 'sinking' | 'held' | 'returning';

/**
 * Pavé "trop poli" — signature du niveau 1-1.
 * Il ne réagit pas au contact mais à l'HÉSITATION : rester immobile dessus
 * le fait vibrer, s'affaisser, puis céder. Continuer à bouger annule la réaction.
 * Variante ascenseur (stopDepth) : il descend jusqu'à une butée visible, puis remonte.
 */
export class ShyStone implements Trap {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  private img: Phaser.GameObjects.Image;
  private support: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  private sparkle?: Phaser.GameObjects.Image;
  private state: State = 'idle';
  private t = 0;
  private offset = 0;     // enfoncement actuel (px)
  private fallVy = 0;
  private sparkleTimer = Math.random() * 3;
  private vacantFor = 0;
  private time = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: StoneConfig, index: number) {
    this.id = `stone-${index}`;
    const { x, top, kind } = cfg;
    const cy = top + STONE_H / 2;

    if (kind === 'matte') {
      const ph = Math.max(10, cfg.base - (top + STONE_H) + 10);
      const key = `pillar-${Math.round(ph)}`;
      this.support = scene.add.image(x, top + STONE_H - 4, key).setOrigin(0.5, 0).setDepth(DEPTH.terrain - 1);
    } else {
      this.support = scene.add.graphics().setDepth(DEPTH.terrain - 1);
    }
    this.img = scene.add
      .image(x, cy, kind === 'matte' ? `stone-matte-${index % 4}` : 'stone-polished')
      .setDepth(DEPTH.terrain + 1);
    if (kind === 'polished') {
      this.sparkle = scene.add.image(x, top + 6, 'star').setDepth(DEPTH.terrain + 2).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
    }

    this.zone = scene.add.zone(x, cy, STONE_W - 2, STONE_H);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.moves = false;
    this.drawSupport();
  }

  get top(): number { return this.cfg.top + this.offset; }

  /** Le joueur se tient-il sur ce pavé ? (test géométrique tolérant) */
  isStoodOn(ctx: TrapContext): boolean {
    const p = ctx.player;
    if (!p.alive || !this.body.enable) return false;
    const pb = p.body;
    if (pb.velocity.y < -10) return false;
    const halfW = STONE_W / 2;
    const overlapX = pb.right > this.cfg.x - halfW + 2 && pb.left < this.cfg.x + halfW - 2;
    const dy = pb.bottom - this.top;
    return overlapX && dy > -4 && dy < 8;
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    if (this.cfg.kind === 'matte') return;
    const standing = this.isStoodOn(ctx);
    const prevOffset = this.offset;
    this.t += dt;

    switch (this.state) {
      case 'idle':
        this.offset = Phaser.Math.Linear(this.offset, 0, Math.min(1, dt * 8));
        if (standing && ctx.player.stillTime > HESITATION) {
          this.enter('warn');
          ctx.sfx('tileWarn', this.cfg.x);
          ctx.player.setExpression('worried', 700);
        }
        break;

      case 'warn': {
        // affaissement progressif : le joueur VOIT et SENT que ça cède
        const k = this.t / WARN;
        this.offset = Math.min(10, k * 10);
        const moving = ctx.player.stillTime < 0.05;
        if (!standing || moving) {
          this.enter('idle'); // on a bougé à temps : le pavé se calme
          break;
        }
        if (this.t >= WARN) {
          if (this.cfg.stopDepth) {
            this.enter('sinking');
            ctx.sfx('tileSink', this.cfg.x);
          } else {
            this.enter('falling');
            this.fallVy = 60;
            ctx.sfx('tileSink', this.cfg.x);
            ctx.burst('leaves', this.cfg.x, this.top + STONE_H, 6);
            ctx.player.setExpression('open', 900);
          }
        }
        break;
      }

      case 'falling':
        this.fallVy += 2400 * dt;
        this.offset += this.fallVy * dt;
        if (this.offset > 6 && this.body.enable) this.body.enable = false;
        if (this.t > 1.1) {
          this.enter('gone');
          this.img.setVisible(false);
          this.sparkle?.setVisible(false);
        }
        break;

      case 'gone':
        if (this.t > RESPAWN && !this.playerOverlapsSlot(ctx)) {
          this.enter('regrow');
          this.offset = 0;
          this.img.setVisible(true).setScale(0.2, 0.2).setAlpha(0);
          this.sparkle?.setVisible(true);
          ctx.sfx('tileRise', this.cfg.x, 0.6);
        }
        break;

      case 'regrow': {
        const k = Math.min(1, this.t / 0.35);
        const e = Phaser.Math.Easing.Back.Out(k);
        this.img.setScale(e, e).setAlpha(k);
        if (k >= 1) {
          this.body.enable = true;
          this.enter('idle');
        }
        break;
      }

      case 'sinking':
        if (standing) this.vacantFor = 0; else this.vacantFor += dt;
        this.offset = Math.min(this.cfg.stopDepth!, this.offset + SINK_SPEED * dt);
        if (this.offset >= this.cfg.stopDepth!) {
          this.enter('held');
          ctx.sfx('land', this.cfg.x, 0.5);
          ctx.burst('dust', this.cfg.x, this.top + STONE_H, 8);
        }
        if (this.vacantFor > RETURN_DELAY) this.enter('returning');
        break;

      case 'held':
        if (standing) this.vacantFor = 0; else this.vacantFor += dt;
        if (this.vacantFor > RETURN_DELAY) {
          this.enter('returning');
          ctx.sfx('tileRise', this.cfg.x, 0.7);
        }
        break;

      case 'returning':
        this.offset = Math.max(0, this.offset - RETURN_SPEED * dt);
        if (standing && ctx.player.stillTime > HESITATION) {
          this.enter('warn');
          ctx.sfx('tileWarn', this.cfg.x);
        } else if (this.offset <= 0) {
          this.enter('idle');
        }
        break;
    }

    // vibration visuelle (pas de la hitbox) pendant l'avertissement
    const shake = this.state === 'warn' ? Math.sin(this.time * 70) * (1 + (this.t / WARN) * 2) : 0;
    const dy = this.offset - prevOffset;

    this.zone.y = this.cfg.top + STONE_H / 2 + this.offset;
    this.img.setPosition(this.cfg.x + shake, this.zone.y);
    if (this.state === 'warn') this.img.setAngle(Math.sin(this.time * 55) * 1.2);
    else this.img.setAngle(0);

    // le joueur suit le pavé quand il descend (pas de décrochage)
    if (standing && dy > 0 && this.body.enable && this.state !== 'falling') {
      ctx.player.zone.y += dy;
    }
    // filet de sécurité : même avec un à-coup de framerate, le joueur ne s'enfonce jamais dans le pavé
    if (this.body.enable && this.state !== 'falling' && this.state !== 'regrow') {
      const p = ctx.player;
      const pb = p.body;
      const half = STONE_W / 2;
      const overX = pb.right > this.cfg.x - half + 2 && pb.left < this.cfg.x + half - 2;
      const sink = pb.bottom - this.top;
      if (p.alive && overX && pb.velocity.y >= 0 && sink > 0.5 && sink < STONE_H * 0.8) {
        p.zone.y -= sink;
        pb.y -= sink;
        pb.velocity.y = 0;
      }
    }

    // scintillement : indice visuel "trop poli"
    if (this.sparkle && this.img.visible) {
      this.sparkleTimer -= dt;
      if (this.sparkleTimer <= 0) {
        this.sparkleTimer = 2.2 + Math.random() * 2.5;
        this.sparkle.setPosition(this.cfg.x - 30 + Math.random() * 60, this.zone.y - STONE_H / 2 + 4);
        this.scene.tweens.add({ targets: this.sparkle, scale: { from: 0, to: 0.7 }, angle: 90, duration: 260, yoyo: true });
      }
      if (this.state !== 'idle') this.sparkle.setScale(0);
    }

    this.drawSupport();
  }

  private playerOverlapsSlot(ctx: TrapContext): boolean {
    const pb = ctx.player.body;
    return pb.right > this.cfg.x - STONE_W / 2 && pb.left < this.cfg.x + STONE_W / 2 &&
      pb.bottom > this.cfg.top - 4 && pb.top < this.cfg.top + STONE_H + 4;
  }

  private enter(s: State): void {
    this.state = s;
    this.t = 0;
  }

  /** Tige végétale (pavés polis) : se courbe quand le pavé s'enfonce, se rompt quand il tombe. */
  private drawSupport(): void {
    if (!(this.support instanceof Phaser.GameObjects.Graphics)) return;
    const g = this.support;
    g.clear();
    const x = this.cfg.x;
    const base = this.cfg.base;
    const topY = this.cfg.top + STONE_H + this.offset - 2;
    const stalkOK = this.state !== 'falling' && this.state !== 'gone';
    const len = base - topY;
    if (stalkOK && len > 4) {
      const bend = (this.offset / Math.max(1, this.cfg.stopDepth ?? 40)) * 14 + 6;
      g.lineStyle(9, 0x5e9a70, 1);
      g.beginPath();
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(x, topY),
        new Phaser.Math.Vector2(x + bend, (topY + base) / 2),
        new Phaser.Math.Vector2(x - 4, base)
      );
      curve.draw(g, 16);
      g.lineStyle(3, 0xb6dc98, 0.8);
      const hl = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(x - 2, topY + 4),
        new Phaser.Math.Vector2(x + bend - 2, (topY + base) / 2),
        new Phaser.Math.Vector2(x - 6, base)
      );
      hl.draw(g, 16);
      // deux petites feuilles le long de la tige
      const leafAt = (t: number, side: number) => {
        const p = curve.getPoint(t);
        g.fillStyle(0x7db386, 1);
        g.fillEllipse(p.x + side * 10, p.y - 3, 20, 8);
      };
      if (len > 60) { leafAt(0.35, 1); leafAt(0.6, -1); }
      // collerette sous le pavé
      g.fillStyle(0x86b97f, 1);
      g.fillEllipse(x, topY + 2, 34, 10);
    } else if (!stalkOK) {
      // tige rompue qui pend
      g.lineStyle(8, 0x5e9a70, 1);
      g.beginPath();
      g.moveTo(x - 4, base);
      g.lineTo(x + 6, base - 40);
      g.lineTo(x + 20, base - 30);
      g.strokePath();
    }
    // butée visible pour l'ascenseur (indice : "ça s'arrête là")
    if (this.cfg.stopDepth) {
      const stopY = this.cfg.top + this.cfg.stopDepth + STONE_H;
      g.fillStyle(0xf7d774, 1);
      g.fillRoundedRect(x - STONE_W / 2 - 12, stopY + 2, 14, 8, 3);
      g.fillRoundedRect(x + STONE_W / 2 - 2, stopY + 2, 14, 8, 3);
    }
  }

  reset(): void {
    this.state = 'idle';
    this.t = 0;
    this.offset = 0;
    this.vacantFor = 0;
    this.body.enable = true;
    this.zone.y = this.cfg.top + STONE_H / 2;
    this.img.setVisible(true).setScale(1).setAlpha(1).setAngle(0).setPosition(this.cfg.x, this.zone.y);
    this.sparkle?.setVisible(true);
    this.drawSupport();
  }

  destroy(): void {
    this.img.destroy();
    this.support.destroy();
    this.sparkle?.destroy();
    this.zone.destroy();
  }
}
