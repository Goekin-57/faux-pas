import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';
import { tuning } from '../core/Difficulty';
import type { TrapContext } from './Trap';

export type DoorGag = 'scoot' | 'dodge' | 'fly' | 'none';

export interface DoorOpts {
  /** 'dodge' : limite droite des esquives. */
  maxX?: number;
  /** 'fly' : plateforme où la porte atterrit après l'éternuement. */
  flyTo?: { x: number; groundY: number };
}

const DODGE_LINES = ['Pas si vite !', 'Hop !', 'Raté !', 'Encore ?'];

/**
 * Porte de sortie de la serre (jamais mortelle).
 *
 * 'dodge' (1-1) : elle a deux petits yeux. Si on lui fonce dessus, elle esquive d'un bond.
 *   Si on s'arrête, elle s'inquiète… et revient vers nous sur la pointe des gonds : on la cueille.
 *   Facile : elle abandonne après 3 esquives. Expert : plus sensible, elle esquive aussi les sauts.
 * 'fly' (1-2) : une petite fleur lui éternue dessus, elle s'envole sur une plateforme en hauteur.
 * 'scoot' : ancien gag (recule une fois si on arrive en courant).
 */
export class ExitDoor {
  x: number;
  groundY: number;
  private frame: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private leaf: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Graphics;
  private wings: Phaser.GameObjects.Graphics;
  private group: Phaser.GameObjects.Container;
  private state: 'closed' | 'moving' | 'flying' | 'open' | 'done' = 'closed';
  private scooted = false;
  private time = 0;
  private dodges = 0;
  private readonly baseX: number;
  private lookX = 0;
  private surprised = 0;
  private flown = false;
  /** Plateforme mobile à laquelle la porte est accrochée (porte volante, Expert). */
  private carrier: { x: number } | null = null;
  private carrierPrevX = 0;
  private bubbleObj: Phaser.GameObjects.Container | null = null;

  constructor(
    private scene: Phaser.Scene, x: number, groundY: number, private scootTo: number,
    private onEnter: () => void, readonly gag: DoorGag = 'scoot', private opts: DoorOpts = {}
  ) {
    this.x = this.baseX = x;
    this.groundY = groundY;
    this.wings = scene.add.graphics();
    this.glow = scene.add.image(0, -8, 'door-glow').setOrigin(0.5, 1).setScale(0.5);
    this.leaf = scene.add.image(-30, -8, 'door-leaf').setOrigin(0, 1).setScale(0.5);
    this.frame = scene.add.image(0, 0, 'door-frame').setOrigin(0.5, 1).setScale(0.5);
    this.eyes = scene.add.graphics();
    this.group = scene.add.container(x, groundY + 2, [this.wings, this.glow, this.leaf, this.frame, this.eyes]).setDepth(DEPTH.props);
    this.drawEyes();
  }

  get flying(): boolean { return this.state === 'flying'; }
  get isOpen(): boolean { return this.state === 'open' || this.state === 'done'; }
  get dodgeCount(): number { return this.dodges; }

  /** Accroche la porte à une plateforme mobile (elle suit ses déplacements). */
  attachTo(carrier: { x: number }): void {
    this.carrier = carrier;
    this.carrierPrevX = carrier.x;
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    if (this.surprised > 0) this.surprised -= dt;
    if (this.state === 'moving') this.updateScoot(dt, ctx);
    if (this.state === 'flying') this.updateFlight(dt, ctx);
    if (this.carrier && this.flown && this.state !== 'flying') {
      const d = this.carrier.x - this.carrierPrevX;
      this.x += d;
      this.group.x = this.x;
    }
    if (this.carrier) this.carrierPrevX = this.carrier.x;

    const p = ctx.player;
    const dx = this.x - p.x;
    this.lookX = Phaser.Math.Clamp(-dx / 160, -1, 1);
    this.drawEyes();
    if (!p.alive) return;
    const level = Math.abs(p.bottom - this.groundY) < 30;

    if (this.state === 'closed') {
      if (this.gag === 'dodge') this.updateDodge(dt, ctx, dx);
      else if (this.gag === 'fly') {
        if (this.flown && Math.abs(dx) < 150 && level) this.open(ctx, 'Enfin !');
      } else if (Math.abs(dx) < 150 && level) {
        const fast = Math.abs(p.body.velocity.x) > 210;
        if (this.gag === 'scoot' && fast && !this.scooted && dx > 0) this.scoot(ctx, this.scootTo, 'Pas si vite !');
        else this.open(ctx);
      }
    }
    if (this.state === 'open' && Math.abs(dx) < 20 && level && p.grounded) {
      this.state = 'done';
      this.onEnter();
    }
  }

  // ------------------------------------------------------------------ porte esquiveuse (1-1)

  private creepT = 0;
  private dodgeCD = 0;
  private static readonly HOP = 130;

  private updateDodge(dt: number, ctx: TrapContext, dx: number): void {
    const p = ctx.player;
    const T = tuning();
    const vx = p.body.velocity.x;
    const near = Math.abs(p.bottom - this.groundY) < 150;
    const fast = vx > T.doorSpeed;
    const leaping = T.doorDodgesJumps && !p.grounded && vx > 60 && dx < 230;
    const maxX = this.opts.maxX ?? this.baseX + 300;
    if (this.dodgeCD > 0) this.dodgeCD -= dt;

    if (dx > 0 && dx < 210 && near && (fast || leaping) && this.dodgeCD <= 0) {
      if (T.doorGiveUp > 0 && this.dodges >= T.doorGiveUp) {
        this.open(ctx, 'Bon… d’accord.');
        return;
      }
      this.dodges++;
      this.surprised = 0.8;
      this.dodgeCD = 0.9;
      if (this.x + ExitDoor.HOP <= maxX) {
        this.scoot(ctx, this.x + ExitDoor.HOP, DODGE_LINES[(this.dodges - 1) % DODGE_LINES.length]);
      } else {
        // acculée : elle se recroqueville (le joueur la dépasse… et la fleur du coin le renvoie)
        ctx.sfx('doorScoot', this.x, 0.6);
        this.bubble('Non non non !');
        this.scene.tweens.add({ targets: this.group, scaleX: 0.86, duration: 90, yoyo: true, repeat: 3 });
      }
      return;
    }
    // le joueur s'arrête : la porte s'inquiète et revient vers lui, à petits pas
    const still = p.grounded && p.stillTime > (T.id === 'expert' ? 0.9 : 0.6);
    if (still && dx > 140 && dx < 640 && this.dodges > 0) {
      this.creepT += dt;
      const step = Math.abs(Math.sin(this.creepT * 9));
      this.x -= 95 * dt;
      this.group.x = this.x;
      this.group.y = this.groundY + 2 - step * 5;
      this.group.angle = Math.sin(this.creepT * 9) * 3;
      if (this.creepT > 0 && Math.floor(this.creepT * 3) !== Math.floor((this.creepT - dt) * 3)) ctx.sfx('step', this.x, 0.7);
      return;
    }
    if (this.creepT > 0) {
      this.creepT = 0;
      this.group.y = this.groundY + 2;
      this.group.angle = 0;
    }
    if (dx > -20 && dx < 150 && Math.abs(p.bottom - this.groundY) < 30 && !fast && p.grounded && vx > -120) {
      this.open(ctx, this.dodges > 0 ? 'Tu m’as eue !' : 'Entrez donc.');
    }
  }

  private scootFrom = 0;
  private scootTarget = 0;
  private scootT = 0;

  private scoot(ctx: TrapContext, to: number, line: string): void {
    this.scooted = true;
    this.state = 'moving';
    this.scootFrom = this.x;
    this.scootTarget = to;
    this.scootT = 0;
    ctx.sfx('doorScoot', this.x);
    ctx.player.setExpression('open', 900);
    this.bubble(line);
  }

  /** Déplacement du gag, piloté par la boucle de jeu (déterministe). */
  private updateScoot(dt: number, ctx: TrapContext): void {
    const DUR = 0.5;
    this.scootT = Math.min(1, this.scootT + dt / DUR);
    const k = this.scootT;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.x = this.scootFrom + (this.scootTarget - this.scootFrom) * e;
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

  // ------------------------------------------------------------------ porte volante (1-2)

  private flyFrom = { x: 0, y: 0 };
  private flyT = 0;

  /** Une fleur vient d'éternuer : si la porte est dans son souffle, elle s'envole. */
  sneezedOn(ctx: TrapContext): void {
    if (this.gag !== 'fly' || this.flown || this.state !== 'closed' || !this.opts.flyTo) return;
    this.flown = true;
    this.state = 'flying';
    this.flyFrom = { x: this.x, y: this.groundY };
    this.flyT = 0;
    this.surprised = 2;
    ctx.sfx('whoosh', this.x, 1);
    this.bubble('Waaah !');
    const p = ctx.player;
    if (p.alive && Math.abs(p.x - this.x) < 700) {
      p.startle();
      this.scene.time.delayedCall(700, () => { if (p.alive) p.setExpression('worried', 900); });
    }
  }

  private updateFlight(dt: number, ctx: TrapContext): void {
    const to = this.opts.flyTo!;
    const DUR = 1.25;
    this.flyT = Math.min(1, this.flyT + dt / DUR);
    const k = this.flyT;
    const tx = this.carrier ? to.x + (this.carrier.x - (this.carrierStart ?? this.carrier.x)) : to.x;
    const e = Phaser.Math.Easing.Sine.InOut(k);
    this.x = this.flyFrom.x + (tx - this.flyFrom.x) * e;
    const yLine = this.flyFrom.y + (to.groundY - this.flyFrom.y) * e;
    const arc = Math.sin(k * Math.PI) * 170;
    this.groundY = to.groundY;
    this.group.setPosition(this.x, yLine - arc + 2);
    this.group.angle = Math.sin(k * Math.PI * 4) * 10 * (1 - k);
    if (Math.floor(k * 8) !== Math.floor((k - dt / DUR) * 8)) ctx.sfx('flap', this.x, 0.6);
    this.drawWings(1 - Math.abs(k - 0.5) * 0.4);
    if (k >= 1) {
      this.state = 'closed';
      this.group.angle = 0;
      this.group.y = to.groundY + 2;
      this.drawWings(0);
      ctx.burst('dust', this.x, to.groundY, 8);
      ctx.sfx('land', this.x, 0.8);
      if (this.carrier) this.carrierPrevX = this.carrier.x;
      this.scene.time.delayedCall(250, () => this.bubble('Par ici !'));
    }
  }

  private carrierStart: number | null = null;

  /** Mémorise la position de départ de la plateforme mobile (pour viser son point d'arrivée). */
  setCarrierStart(x: number): void {
    this.carrierStart = x;
  }

  private drawWings(k: number): void {
    const g = this.wings;
    g.clear();
    if (k <= 0) return;
    const flap = Math.sin(this.time * 28) * 0.6;
    for (const side of [-1, 1]) {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const a = -0.5 - flap * side * 0 + (flap - 0.2);
        const len = 46 * k;
        const xx = side * (36 + t * len);
        const yy = -70 - Math.sin(t * Math.PI) * 18 + t * len * Math.sin(a);
        pts.push(new Phaser.Math.Vector2(xx, yy));
      }
      for (let i = 10; i >= 0; i--) {
        const t = i / 10;
        const len = 46 * k;
        const xx = side * (36 + t * len);
        const yy = -62 + Math.sin(t * Math.PI) * 10 + t * len * Math.sin(flap - 0.2);
        pts.push(new Phaser.Math.Vector2(xx, yy));
      }
      g.fillStyle(0x7db386, 1);
      g.fillPoints(pts, true);
      g.lineStyle(2, 0x4e7a62, 1);
      g.strokePoints(pts, true);
    }
  }

  // ------------------------------------------------------------------ commun

  private open(ctx: TrapContext, line?: string): void {
    this.state = 'open';
    this.creepT = 0;
    this.group.y = this.groundY + 2;
    this.group.angle = 0;
    ctx.sfx('doorOpen', this.x);
    if (line) this.bubble(line);
    else if (!this.scooted) this.bubble('Entrez donc.');
    this.scene.tweens.add({ targets: this.leaf, scaleX: 0.04, duration: 420, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.6, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
  }

  /** Deux petits yeux dans le judas de la porte : ils suivent le joueur. */
  private drawEyes(): void {
    const g = this.eyes;
    g.clear();
    if (this.gag !== 'dodge' && this.gag !== 'fly') return;
    if (this.state === 'open' || this.state === 'done') return;
    const y = -96;
    const big = this.surprised > 0;
    const blink = !big && (this.time % 3.4) < 0.12;
    for (const ex of [-9, 9]) {
      g.fillStyle(0xfffaf0, 1);
      g.fillEllipse(ex, y, big ? 13 : 11, blink ? 2 : big ? 15 : 12);
      if (!blink) {
        g.fillStyle(0x24306a, 1);
        g.fillCircle(ex + this.lookX * 2.5, y + 1, big ? 2.6 : 3.2);
      }
    }
  }

  private bubble(text: string): void {
    const s = this.scene;
    this.bubbleObj?.destroy();
    const label = s.add.text(0, 0, text, { fontFamily: FONTS.ui, fontSize: '20px', color: '#24306a', fontStyle: '600' }).setOrigin(0.5);
    const w = label.width + 28, h = label.height + 14;
    const g = s.add.graphics();
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillTriangle(-8, h / 2 - 1, 8, h / 2 - 1, -2, h / 2 + 10);
    const c = s.add.container(this.group.x, this.group.y - 152, [g, label]).setDepth(DEPTH.fx).setScale(0);
    this.bubbleObj = c;
    s.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: c, alpha: 0, y: '-=16', delay: 1500, duration: 300, onComplete: () => { c.destroy(); if (this.bubbleObj === c) this.bubbleObj = null; } });
    // la bulle suit la porte si elle se déplace
    s.time.addEvent({ delay: 16, repeat: 120, callback: () => { if (c.active) { c.x = this.group.x; if (this.state === 'flying') c.y = this.group.y - 152; } } });
  }

  reset(): void {
    // la porte garde sa position (elle a déjà fait sa blague) mais se calme
    if (this.state === 'done') return;
    this.creepT = 0;
    this.surprised = 0;
  }

  destroy(): void {
    this.bubbleObj?.destroy();
    this.group.destroy();
  }
}
