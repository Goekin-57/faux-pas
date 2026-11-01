import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { STONE_W, STONE_H } from '../art/paint';
import type { Trap, TrapContext } from './Trap';
import { tuning } from '../core/Difficulty';

export interface StoneConfig {
  x: number;          // centre
  top: number;        // surface de marche
  kind: 'matte' | 'polished';
  base: number;       // y où s'ancre la tige / le pilier
  stopDepth?: number; // pavé-ascenseur : s'enfonce de N px puis s'arrête
}

// Réglages du chapitre 1 (identiques pour tous les pavés : la règle doit être apprise une fois).
// Hésitation et avertissement dépendent de la difficulté (voir core/Difficulty).
const RESPAWN = 2.2;
const SINK_SPEED = 95;
const RETURN_SPEED = 130;
const RETURN_DELAY = 1.3;
const LIFT_WAIT = 1.1;  // s d'immobilité sur l'ascenseur avant qu'il ne descende

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
  /** Pavé-ascenseur : progression du sablier (0 → 1) avant la descente. */
  private sand = 0;
  private lastTick = 0;
  private glass?: Phaser.GameObjects.Graphics;
  /** Vrai dès que l'ascenseur a été utilisé une fois (pour l'indice contextuel). */
  used = false;
  private readonly HESITATION: number;
  private readonly WARN: number;

  constructor(private scene: Phaser.Scene, readonly cfg: StoneConfig, index: number) {
    this.id = `stone-${index}`;
    this.HESITATION = tuning().stoneHesitation;
    this.WARN = tuning().stoneWarn;
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
      .image(x, cy, kind === 'matte' ? `stone-matte-${index % 4}` : cfg.stopDepth ? 'stone-lift' : 'stone-polished')
      .setDepth(DEPTH.terrain + 1);
    if (kind === 'polished') {
      this.sparkle = scene.add.image(x, top + 6, 'star').setDepth(DEPTH.terrain + 2).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
    }

    if (cfg.stopDepth) this.glass = scene.add.graphics().setDepth(DEPTH.terrain + 2);
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
        if (this.cfg.stopDepth) {
          // Ascenseur : PAS de tremblement (ce serait le signal "danger" appris juste avant).
          // Le sablier de la plaque s'écoule tant qu'on reste immobile, se remplit si on bouge.
          const still = standing && ctx.player.stillTime > 0.12;
          this.sand = Phaser.Math.Clamp(this.sand + (still ? dt / LIFT_WAIT : -dt * 2.5), 0, 1);
          if (still && this.sand - this.lastTick >= 0.25) {
            this.lastTick = this.sand;
            ctx.sfx('hourglass', this.cfg.x, this.sand);
          }
          if (!still && this.sand < this.lastTick) this.lastTick = Math.floor(this.sand * 4) / 4;
          if (this.sand >= 1) {
            this.enter('sinking');
            this.used = true;
            ctx.sfx('liftStart', this.cfg.x);
            ctx.player.setExpression('grin', 900);
          }
          break;
        }
        if (standing && ctx.player.stillTime > this.HESITATION) {
          this.enter('warn');
          ctx.sfx('tileWarn', this.cfg.x);
          ctx.player.setExpression('worried', 700);
        }
        break;

      case 'warn': {
        // affaissement progressif : le joueur VOIT et SENT que ça cède
        const k = this.t / this.WARN;
        this.offset = Math.min(10, k * 10);
        const moving = ctx.player.stillTime < 0.05;
        if (!standing || moving) {
          this.enter('idle'); // on a bougé à temps : le pavé se calme
          break;
        }
        if (this.t >= this.WARN) {
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
        this.offset = Math.min(this.cfg.stopDepth!, this.offset + SINK_SPEED * Math.min(1, 0.25 + this.t * 1.5) * dt);
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
        if (!this.cfg.stopDepth && standing && ctx.player.stillTime > this.HESITATION) {
          this.enter('warn');
          ctx.sfx('tileWarn', this.cfg.x);
        } else if (this.offset <= 0) {
          this.enter('idle');
          this.sand = 0;
          this.lastTick = 0;
        }
        break;
    }

    // vibration visuelle (pas de la hitbox) pendant l'avertissement
    const shake = this.state === 'warn' ? Math.sin(this.time * 70) * (1 + (this.t / this.WARN) * 2) : 0;
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

  private drawHourglass(): void {
    const g = this.glass;
    if (!g) return;
    g.clear();
    const x = this.cfg.x - 10, y = this.zone.y;
    const k = this.state === 'idle' ? this.sand : 1;
    // verre
    g.lineStyle(1.6, 0x6b4a14, 0.95);
    g.strokeTriangle(x - 6, y - 7, x + 6, y - 7, x, y);
    g.strokeTriangle(x - 6, y + 7, x + 6, y + 7, x, y);
    // sable du haut (diminue) et du bas (augmente)
    g.fillStyle(0xfff1c9, 1);
    const top = 1 - k;
    if (top > 0.02) g.fillTriangle(x - 5 * top, y - 1 - 5 * top, x + 5 * top, y - 1 - 5 * top, x, y - 1);
    if (k > 0.02) g.fillRect(x - 5 * k, y + 6 - 5 * k, 10 * k, 5 * k);
    if (k > 0.02 && k < 1) g.fillRect(x - 0.6, y - 1, 1.2, 7);
  }

  /** Tige végétale (pavés polis) : se courbe quand le pavé s'enfonce, se rompt quand il tombe. */
  private drawSupport(): void {
    this.drawHourglass();
    if (!(this.support instanceof Phaser.GameObjects.Graphics)) return;
    if (this.cfg.stopDepth) { this.drawSpring(this.support); return; }
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

  /** Ascenseur : vrille végétale en ressort (indice : "ça monte et ça descend"). */
  private drawSpring(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    const x = this.cfg.x, base = this.cfg.base;
    const top = this.cfg.top + STONE_H + this.offset - 2;
    const len = Math.max(6, base - top);
    const coils = 7;
    const amp = 14 - Math.min(8, this.offset / 30);
    g.lineStyle(5, 0x5e9a70, 1);
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const px = x + Math.sin(t * Math.PI * 2 * coils) * amp;
      const py = top + t * len;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(2, 0xb6dc98, 0.8);
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const px = x - 1 + Math.sin(t * Math.PI * 2 * coils) * amp;
      const py = top + t * len - 1;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.fillStyle(0x86b97f, 1);
    g.fillEllipse(x, top + 2, 34, 10);
    // butées de laiton visibles en bas du puits : "ça s'arrête là"
    const stopY = this.cfg.top + this.cfg.stopDepth! + STONE_H;
    g.fillStyle(0xf7d774, 1);
    g.fillRoundedRect(x - STONE_W / 2 - 12, stopY + 2, 14, 8, 3);
    g.fillRoundedRect(x + STONE_W / 2 - 2, stopY + 2, 14, 8, 3);
  }

  reset(): void {
    this.sand = 0;
    this.lastTick = 0;
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
    this.glass?.destroy();
    this.zone.destroy();
  }
}
