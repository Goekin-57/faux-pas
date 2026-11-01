import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { ensureCanvas } from '../art/textures';
import type { Trap, TrapContext } from '../traps/Trap';
import { paintPumpkin, paintGhost, paintChandelier, paintFrame, paintPortraitNoble, paintBookcase, paintDoor } from './art';
import { addFlame, drawCarvedFace } from './ManorBackdrop';
import { type Kit, staticZone, movingZone, setBodyEnabled, standingOn, hitsCircle, carry, say } from './kit';

// =====================================================================================
// ZONE 1 — LA COUR DES CITROUILLES
// =====================================================================================

/** Corps de citrouille + visage animé, dans un conteneur (roule = rotation). */
class PumpkinSprite {
  readonly root: Phaser.GameObjects.Container;
  readonly face: Phaser.GameObjects.Graphics;
  mood: 'grin' | 'watch' | 'scared' | 'angry' | 'dizzy' = 'grin';
  lookX = 0;
  constructor(scene: Phaser.Scene, x: number, y: number, readonly r: number, depth = DEPTH.traps) {
    const key = ensureCanvas(scene, `mn-pkb-${r}`, () => paintPumpkin(r, r * 3));
    const img = scene.add.image(0, r + 4, key).setOrigin(0.5, 1);
    this.face = scene.add.graphics();
    this.root = scene.add.container(x, y, [img, this.face]).setDepth(depth);
    this.draw();
  }
  draw(): void {
    this.face.clear();
    drawCarvedFace(this.face, 0, 0, this.r, this.mood, this.lookX);
  }
  destroy(): void { this.root.destroy(); }
}

/**
 * Séquence A — les citrouilles curieuses. Trois citrouilles : la première ne bouge pas,
 * la deuxième suit le héros des yeux… et roule vers lui dès qu'il lui tourne le dos.
 * S'il se retourne, elle se fige. Si elle le rattrape : « Bouh ! » (jamais mortel).
 */
export class CuriousPumpkins implements Trap {
  readonly id = 'h-curious';
  private still: PumpkinSprite[] = [];
  private creeper: PumpkinSprite;
  private x: number;
  private readonly x0: number;
  private wiggle = 0;
  private rollSnd = 0;
  private cool = 0;
  private frozenFx = 0;
  private time = 0;

  constructor(private k: Kit, xs: [number, number, number], private groundY: number, private maxX: number) {
    const r = 26;
    this.still.push(new PumpkinSprite(k.scene, xs[0], groundY - r - 4, r, DEPTH.props));
    this.still.push(new PumpkinSprite(k.scene, xs[2], groundY - r - 4, 22, DEPTH.props));
    this.x = this.x0 = xs[1];
    this.creeper = new PumpkinSprite(k.scene, this.x, groundY - r - 4, r, DEPTH.traps);
    this.creeper.mood = 'watch';
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    const c = this.creeper;
    const dx = p.x - this.x;
    c.lookX = Phaser.Math.Clamp(dx / 120, -1, 1);
    if (this.cool > 0) this.cool -= dt;
    if (this.frozenFx > 0) this.frozenFx -= dt;
    const passed = dx > 40 && dx < 520 && p.alive;
    const backTurned = p.facing === 1;
    let moving = false;
    if (passed && this.cool <= 0 && this.x < this.maxX) {
      if (backTurned) {
        // mouvement préparatoire, puis roulement discret
        if (this.wiggle < 0.35) this.wiggle += dt;
        else {
          moving = true;
          const sp = this.k.expert ? 125 : 82;
          this.x = Math.min(this.maxX, this.x + sp * dt);
          c.root.rotation += (sp * dt) / c.r;
          this.rollSnd -= dt;
          if (this.rollSnd <= 0) { this.rollSnd = 0.45; ctx.sfx('roll', this.x, 0.4); }
        }
      } else if (this.wiggle >= 0.35) {
        // il se retourne : elle se fige net, l'air innocent
        this.wiggle = 0;
        this.frozenFx = 0.6;
        ctx.sfx('pop', this.x, 0.5);
      }
    }
    if (!moving && Math.abs(c.root.rotation) > 0.01) c.root.rotation *= 0.8;
    c.mood = this.frozenFx > 0 ? 'scared' : moving ? 'grin' : 'watch';
    const wob = !moving && passed && backTurned && this.wiggle < 0.35 ? Math.sin(this.time * 40) * 2 : 0;
    c.root.setPosition(this.x + wob, this.groundY - c.r - 4);
    c.draw();
    for (const s of this.still) { s.lookX = 0; s.draw(); }
    // rattrapé : « Bouh ! »
    if (moving && hitsCircle(p, this.x, this.groundY - c.r, c.r + 4)) {
      this.cool = 2.5;
      this.wiggle = 0;
      ctx.sfx('boo', this.x);
      say(this.k.scene, this.x, this.groundY - 90, 'Bouh !');
      p.startle();
      p.launch(260, -330, 0.25);
    }
  }

  reset(): void {
    this.x = this.x0;
    this.wiggle = 0;
    this.cool = 0;
    this.creeper.root.rotation = 0;
  }

  destroy(): void {
    this.still.forEach((s) => s.destroy());
    this.creeper.destroy();
  }
}

/**
 * Séquence B — la citrouille roulante. Elle attend sur le muret ; quand le héros approche,
 * elle tremble, dégringole et roule vers lui (on saute par-dessus). Elle rebondit sur la pierre,
 * revient sonnée… et se cale au pied du muret : la marche qui manquait pour l'escalader.
 * Expert : si le héros saute trop tôt, elle accélère (trajectoire inchangée).
 */
export class RollingPumpkin implements Trap {
  readonly id = 'h-roller';
  private s: PumpkinSprite;
  private state: 'idle' | 'wobble' | 'fall' | 'roll' | 'back' | 'stuck' = 'idle';
  private x: number;
  private y: number;
  private vx = 0;
  private vy = 0;
  private t = 0;
  private boosted = false;
  private rollSnd = 0;
  private plat: Phaser.GameObjects.Zone;
  private readonly R = 50;

  constructor(private k: Kit, private startX: number, private wallTop: number, private groundY: number, private rockFace: number, private wallFace: number) {
    this.x = startX;
    this.y = wallTop - this.R;
    this.s = new PumpkinSprite(k.scene, this.x, this.y, this.R, DEPTH.traps);
    this.s.mood = 'grin';
    const pw = this.R * 1.7, ph = this.R * 1.8;
    this.plat = staticZone(k, wallFace - this.R - pw / 2, groundY - ph, pw, ph);
    setBodyEnabled(this.plat, false);
  }

  get isPlatform(): boolean { return this.state === 'stuck'; }

  update(dt: number, ctx: TrapContext): void {
    const p = ctx.player;
    this.t += dt;
    const R = this.R;
    switch (this.state) {
      case 'idle':
        this.s.mood = 'grin';
        if (p.alive && p.x > this.rockFace + 10 && p.x < this.wallFace && p.bottom > this.groundY - 40) {
          this.go('wobble');
          ctx.sfx('creak', this.x, 0.6);
          this.s.mood = 'angry';
        }
        break;
      case 'wobble':
        this.s.root.rotation = Math.sin(this.t * 30) * 0.12;
        if (this.t >= (this.k.expert ? 0.5 : 0.75)) {
          this.go('fall');
          this.vx = -200;
          this.vy = -120;
          ctx.sfx('squeak', this.x, 0.5);
        }
        break;
      case 'fall':
        this.vy += 1800 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y >= this.groundY - R) {
          this.y = this.groundY - R;
          this.go('roll');
          this.vx = -(this.k.expert ? 380 : 330);
          ctx.sfx('land', this.x, 1);
          ctx.burst('dust', this.x, this.groundY, 8);
        }
        break;
      case 'roll': {
        // Expert : un saut anticipé (de loin) la fait accélérer, sans changer de trajectoire
        if (this.k.expert && !this.boosted && !p.grounded && p.x < this.x - 220) {
          this.boosted = true;
          this.vx *= 1.3;
          ctx.sfx('squeak', this.x, 0.8);
        }
        this.x += this.vx * dt;
        if (this.x - R <= this.rockFace) {
          this.x = this.rockFace + R;
          this.go('back');
          this.vx = 170;
          ctx.sfx('clonk', this.x);
          ctx.sfx('dazed', this.x, 0.6);
          this.s.mood = 'dizzy';
        }
        break;
      }
      case 'back':
        this.vx = Math.max(70, this.vx - 30 * dt);
        this.x += this.vx * dt;
        if (this.x + R >= this.wallFace) {
          this.x = this.wallFace - R;
          this.go('stuck');
          setBodyEnabled(this.plat, true);
          ctx.sfx('land', this.x, 0.8);
          ctx.burst('dust', this.x, this.groundY, 6);
          say(this.k.scene, this.x, this.groundY - 2 * R - 40, 'Ouille…', '#c4561c');
        }
        break;
      case 'stuck':
        this.s.mood = 'dizzy';
        break;
    }
    if (this.state === 'fall' || this.state === 'roll' || this.state === 'back') {
      this.s.root.rotation += (this.vx * dt) / R;
      this.rollSnd -= dt;
      if (this.rollSnd <= 0) { this.rollSnd = 0.3; ctx.sfx('roll', this.x, Math.min(1, Math.abs(this.vx) / 300)); }
    } else if (this.state === 'stuck') {
      this.s.root.rotation = Phaser.Math.Linear(this.s.root.rotation, 0, Math.min(1, dt * 4));
    }
    this.s.root.setPosition(this.x, this.y);
    this.s.draw();

    // danger : en roulant vers le héros. Au retour, sonnée, elle le bouscule gentiment.
    if ((this.state === 'fall' || this.state === 'roll') && hitsCircle(p, this.x, this.y, R * 0.82)) ctx.kill('prick');
    if (this.state === 'back' && hitsCircle(p, this.x, this.y, R * 0.8) && p.x > this.x) p.launch(240, -420, 0.2);
  }

  private go(s: RollingPumpkin['state']): void {
    this.state = s;
    this.t = 0;
  }

  reset(): void {
    if (this.state === 'stuck') return; // la marche reste en place
    this.state = 'idle';
    this.x = this.startX;
    this.y = this.wallTop - this.R;
    this.vx = this.vy = 0;
    this.boosted = false;
    this.s.root.rotation = 0;
    this.s.root.setPosition(this.x, this.y);
  }

  destroy(): void { this.s.destroy(); }
}

/**
 * Séquence C — la citrouille gardienne. Quand on monte sur le perron, elle pousse un cri ridicule,
 * tombe de son socle… pile sur la dalle qui ouvre la porte du manoir.
 */
export class GuardDoor implements Trap {
  readonly id = 'h-guard';
  private s: PumpkinSprite;
  private door: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Zone;
  private plate: Phaser.GameObjects.Graphics;
  private state: 'watch' | 'fall' | 'open' = 'watch';
  private t = 0;
  opened = false;

  constructor(private k: Kit, private pedX: number, private porchY: number, private doorX: number, private plateX: number) {
    const sc = k.scene;
    const ped = sc.add.graphics().setDepth(DEPTH.props);
    ped.fillStyle(0x4a4670, 1);
    ped.fillRect(pedX - 16, porchY - 60, 32, 60);
    ped.fillStyle(0x6f7690, 1);
    ped.fillRect(pedX - 22, porchY - 66, 44, 10);
    this.plate = sc.add.graphics().setDepth(DEPTH.props);
    this.drawPlate(0);
    const key = ensureCanvas(sc, 'mn-door-main', () => paintDoor('plain', 64, 150));
    this.door = sc.add.image(doorX - 4, porchY + 2, key).setOrigin(0.5, 1).setDepth(DEPTH.props - 1);
    this.body = staticZone(k, doorX - 12, porchY - 170, 24, 170);
    this.s = new PumpkinSprite(sc, pedX, porchY - 66 - 24, 22, DEPTH.traps);
    this.s.mood = 'watch';
  }

  private drawPlate(down: number): void {
    const g = this.plate;
    g.clear();
    g.fillStyle(0xb68a3a, 1);
    g.fillRoundedRect(this.plateX - 22, this.porchY - 6 + down * 4, 44, 6, 2);
  }

  update(dt: number, ctx: TrapContext): void {
    const p = ctx.player;
    this.t += dt;
    this.s.lookX = Phaser.Math.Clamp((p.x - this.pedX) / 120, -1, 1);
    if (this.state === 'watch') {
      this.s.mood = 'watch';
      if (p.alive && p.x > this.pedX - 90 && p.bottom <= this.porchY + 4 && p.grounded) {
        this.state = 'fall';
        this.t = 0;
        this.s.mood = 'scared';
        ctx.sfx('squeak', this.pedX, 1);
        say(this.k.scene, this.pedX, this.porchY - 150, 'Iiiiik !', '#c4561c', 1100);
        p.setExpression('open', 900);
        // chute du socle, droit sur la dalle
        this.k.scene.tweens.add({
          targets: this.s.root, x: this.plateX, duration: 520, ease: 'Linear'
        });
        this.k.scene.tweens.add({
          targets: this.s.root, y: { from: this.s.root.y, to: this.porchY - 30 }, duration: 520, ease: 'Back.easeIn',
          onComplete: () => this.land(ctx)
        });
        this.k.scene.tweens.add({ targets: this.s.root, angle: -200, duration: 520 });
      }
    }
    this.s.draw();
  }

  private land(ctx: TrapContext): void {
    this.state = 'open';
    this.s.mood = 'dizzy';
    this.s.draw();
    this.drawPlate(1);
    ctx.sfx('clonk', this.plateX);
    ctx.burst('dust', this.plateX, this.porchY, 8);
    this.k.scene.time.delayedCall(300, () => {
      ctx.sfx('creak', this.doorX, 1);
      ctx.sfx('gate', this.doorX);
      this.opened = true;
      setBodyEnabled(this.body, false);
      this.k.scene.tweens.add({ targets: this.door, scaleX: 0.12, x: this.door.x + 26, duration: 700, ease: 'Cubic.easeOut' });
      this.k.player.startle();
    });
  }

  reset(): void { /* la porte reste ouverte : c'est un passage */ }
  destroy(): void { this.s.destroy(); this.door.destroy(); this.plate.destroy(); }
}

// =====================================================================================
// ZONE 2 — LE GRAND HALL HANTÉ
// =====================================================================================

/** Fantôme : corps translucide + visage dessiné (expressions). */
class GhostSprite {
  readonly root: Phaser.GameObjects.Container;
  readonly face: Phaser.GameObjects.Graphics;
  readonly img: Phaser.GameObjects.Image;
  mood: 'calm' | 'mean' | 'boo' | 'ouch' | 'party' = 'calm';
  constructor(scene: Phaser.Scene, x: number, y: number, readonly w = 76, readonly h = 70) {
    const key = ensureCanvas(scene, `mn-ghost-${w}`, () => paintGhost(w, h));
    this.img = scene.add.image(0, 0, key);
    this.face = scene.add.graphics();
    this.root = scene.add.container(x, y, [this.img, this.face]).setDepth(DEPTH.traps + 1);
  }
  draw(lookX = 0): void {
    const g = this.face;
    g.clear();
    const lx = lookX * 4;
    g.fillStyle(0x24306a, 1);
    if (this.mood === 'mean') {
      g.fillEllipse(-13 + lx, -8, 9, 12);
      g.fillEllipse(13 + lx, -8, 9, 12);
      g.lineStyle(3, 0x24306a, 1);
      g.lineBetween(-20 + lx, -18, -6 + lx, -13);
      g.lineBetween(20 + lx, -18, 6 + lx, -13);
      g.fillEllipse(lx, 12, 16, 10);
    } else if (this.mood === 'boo') {
      g.fillEllipse(-13 + lx, -9, 10, 14);
      g.fillEllipse(13 + lx, -9, 10, 14);
      g.fillEllipse(lx, 12, 20, 20);
    } else if (this.mood === 'ouch') {
      g.lineStyle(3, 0x24306a, 1);
      for (const s of [-1, 1]) {
        g.lineBetween(s * 13 - 5, -13, s * 13 + 5, -3);
        g.lineBetween(s * 13 + 5, -13, s * 13 - 5, -3);
      }
      g.fillEllipse(0, 12, 14, 8);
    } else {
      g.fillEllipse(-12 + lx, -8, 8, 11);
      g.fillEllipse(12 + lx, -8, 8, 11);
      g.lineStyle(2.5, 0x24306a, 1);
      g.beginPath();
      g.arc(lx, 6, 7, 0.2 * Math.PI, 0.8 * Math.PI);
      g.strokePath();
      if (this.mood === 'party') {
        g.fillStyle(0xf28c38, 1);
        g.fillTriangle(-6, -this.h / 2 + 4, 6, -this.h / 2 + 4, 4, -this.h / 2 - 22);
      }
    }
  }
  destroy(): void { this.root.destroy(); }
}

/**
 * Séquence A — le fantôme portier. Il flotte, translucide (on le traverse). Quand le héros
 * approche, il se prépare à faire peur : il devient opaque… et SOLIDE. C'est le moment de lui
 * sauter dessus pour atteindre le balcon. Puis il fait « Bouh ! » (recul, jamais mortel).
 * Expert : fenêtre de solidité plus courte, toujours annoncée.
 */
export class GhostDoorman implements Trap {
  readonly id = 'h-ghost-door';
  private g: GhostSprite;
  private top: Phaser.GameObjects.Zone;
  private state: 'drift' | 'gather' | 'solid' | 'boo' | 'cool' = 'drift';
  private t = 0;
  private time = 0;
  private x: number;
  private readonly y: number;

  constructor(private k: Kit, private xMin: number, private xMax: number, y: number) {
    this.x = (xMin + xMax) / 2;
    this.y = y;
    this.g = new GhostSprite(k.scene, this.x, y);
    this.top = movingZone(k, this.x, y - 30, 68, 14, true);
    setBodyEnabled(this.top, false);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const p = ctx.player;
    const near = p.alive && Math.abs(p.x - this.x) < 290 && p.bottom > this.y - 60;
    const W = this.k.expert ? 0.9 : 1.7;
    let alpha = 0.35;
    let bob = Math.sin(this.time * 2.4) * 6;
    switch (this.state) {
      case 'drift':
        this.x = (this.xMin + this.xMax) / 2 + Math.sin(this.time * 0.8) * (this.xMax - this.xMin) / 2;
        this.g.mood = 'calm';
        if (near) { this.go('gather'); ctx.sfx('creak', this.x, 0.4); }
        break;
      case 'gather': {
        const kk = Math.min(1, this.t / (this.k.expert ? 0.5 : 0.7));
        alpha = 0.35 + 0.65 * kk;
        bob *= 1 - kk;
        this.g.mood = 'mean';
        this.g.root.setScale(1 + kk * 0.08);
        if (kk >= 1) { this.go('solid'); setBodyEnabled(this.top, true); }
        break;
      }
      case 'solid':
        alpha = 1;
        bob = Math.sin(this.time * 3) * 1.5;
        this.g.mood = 'mean';
        // dernier tiers : il gonfle (annonce de la fin)
        if (this.t > W * 0.66) this.g.root.setScale(1.08 + Math.sin(this.time * 30) * 0.03);
        if (this.t >= W) {
          setBodyEnabled(this.top, false);
          this.go('boo');
          this.g.mood = 'boo';
          ctx.sfx('boo', this.x);
          const onIt = standingOn(p, this.x - 34, this.x + 34, this.y - 37);
          if (!onIt && p.alive && Math.abs(p.x - this.x) < 150 && p.bottom > this.y - 80) {
            say(this.k.scene, this.x, this.y - 80, 'BOUH !');
            p.startle();
            p.launch(p.x < this.x ? -280 : 280, -260, 0.25);
          }
        }
        break;
      case 'boo':
        alpha = 1 - this.t * 2;
        this.g.root.setScale(1.1 - this.t * 0.2);
        if (this.t >= 0.4) this.go('cool');
        break;
      case 'cool':
        alpha = 0.25;
        this.g.mood = 'calm';
        this.g.root.setScale(1);
        if (this.t >= 1.4) this.go('drift');
        break;
    }
    this.g.root.setPosition(this.x, this.y + bob).setAlpha(Phaser.Math.Clamp(alpha, 0.1, 1));
    this.g.draw(Phaser.Math.Clamp((p.x - this.x) / 100, -1, 1));
    const ty = this.y + bob - 30;
    const dy = ty - this.top.y;
    this.top.setPosition(this.x, ty);
    if (this.state === 'solid' && standingOn(p, this.x - 34, this.x + 34, ty - 7 - dy)) carry(p, 0, dy);
  }

  private go(s: GhostDoorman['state']): void { this.state = s; this.t = 0; }

  reset(): void {
    this.go('drift');
    setBodyEnabled(this.top, false);
    this.g.root.setScale(1);
  }

  destroy(): void { this.g.destroy(); }
}

/**
 * Séquence B — le lustre maladroit. Immobile, il est trop loin des deux bords.
 * Un fantôme fonce sur le héros pour l'effrayer… heurte le lustre et le met en balancement :
 * il devient une plateforme qui passe au ras de chaque bord. Il suffit d'attendre le bon moment.
 */
export class SwingChandelier implements Trap {
  readonly id = 'h-chandelier';
  private img: Phaser.GameObjects.Image;
  private rope: Phaser.GameObjects.Graphics;
  private flames: Phaser.GameObjects.Image[] = [];
  private plat: Phaser.GameObjects.Zone;
  private ghost: GhostSprite;
  private ghostState: 'wait' | 'charge' | 'ouch' | 'gone' = 'wait';
  private gx: number;
  private gy: number;
  private gt = 0;
  private amp = 0;
  private phase = 0;
  private time = 0;
  private px = 0;
  private top = 0;
  swinging = false;
  prevPx = 0;
  private readonly A: number;

  constructor(private k: Kit, private pivotX: number, private pivotY: number, private L: number, ampPx: number, private ghostStart: { x: number; y: number }, private triggerX: number) {
    const sc = k.scene;
    this.A = Math.asin(ampPx / L);
    this.rope = sc.add.graphics().setDepth(DEPTH.traps - 1);
    const key = ensureCanvas(sc, 'mn-chand-swing', () => paintChandelier(130));
    this.img = sc.add.image(pivotX, pivotY + L, key).setOrigin(0.5, 42 / 70).setDepth(DEPTH.traps);
    for (let i = -2; i <= 2; i++) this.flames.push(addFlame(sc, k.amb, pivotX, pivotY + L, 0.75));
    this.plat = movingZone(k, pivotX, pivotY + L + 7, 120, 14, true);
    this.gx = ghostStart.x;
    this.gy = ghostStart.y;
    this.ghost = new GhostSprite(sc, this.gx, this.gy, 64, 58);
    this.place(0);
  }

  private place(theta: number): void {
    this.px = this.pivotX + Math.sin(theta) * this.L;
    this.top = this.pivotY + Math.cos(theta) * this.L;
    this.img.setPosition(this.px, this.top).setRotation(-theta * 0.25);
    this.plat.setPosition(this.px, this.top + 7);
    this.flames.forEach((f, i) => {
      const fx = this.px + (i - 2) * 130 * 0.21;
      f.setPosition(fx, this.top - 22 + 2);
    });
    // les halos suivent aussi
    this.rope.clear();
    this.rope.lineStyle(3, 0x1a1533, 1);
    this.rope.lineBetween(this.pivotX, this.pivotY, this.px, this.top - 36);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    // le fantôme qui voulait faire peur
    this.gt += dt;
    switch (this.ghostState) {
      case 'wait':
        this.ghost.mood = 'calm';
        this.gy = this.ghostStart.y + Math.sin(this.time * 2) * 8;
        if (p.alive && p.x > this.triggerX && p.bottom < this.pivotY + this.L) {
          this.ghostState = 'charge';
          this.gt = 0;
          ctx.sfx('boo', this.gx);
          say(this.k.scene, this.gx, this.gy - 60, 'Bouuuh !');
        }
        break;
      case 'charge':
        this.ghost.mood = 'boo';
        this.gx -= 300 * dt;
        this.gy = Phaser.Math.Linear(this.gy, this.top - 10, Math.min(1, dt * 4));
        if (this.gx <= this.px + 50) {
          // BONG : il percute le lustre
          this.ghostState = 'ouch';
          this.gt = 0;
          this.swinging = true;
          this.phase = Math.PI; // part vers la gauche (vers le héros)
          ctx.sfx('clonk', this.px);
          ctx.sfx('creak', this.px, 1);
          say(this.k.scene, this.gx, this.gy - 60, 'Aïe !');
        }
        break;
      case 'ouch':
        this.ghost.mood = 'ouch';
        this.gx += 120 * dt;
        this.gy -= 160 * dt;
        this.ghost.root.angle += 360 * dt;
        this.ghost.root.setAlpha(Math.max(0, 1 - this.gt * 0.6));
        if (this.gt > 1.7) { this.ghostState = 'gone'; this.ghost.root.setVisible(false); }
        break;
      case 'gone':
        break;
    }
    if (this.ghostState !== 'gone') {
      this.ghost.root.setPosition(this.gx, this.gy);
      this.ghost.draw(-1);
    }

    // pendule (amplitude qui s'installe en douceur)
    const prevX = this.px, prevTop = this.top;
    this.prevPx = prevX;
    let theta = Math.sin(this.time * 0.9) * 0.012;
    if (this.swinging) {
      this.amp = Math.min(this.A, this.amp + dt * this.A * 0.9);
      this.phase += dt * (Math.PI * 2 / 3.2);
      theta = Math.sin(this.phase) * this.amp;
    }
    this.place(theta);
    if (standingOn(p, prevX - 60, prevX + 60, prevTop)) carry(p, this.px - prevX, this.top - prevTop);
  }

  reset(): void { /* une fois lancé, le lustre continue (c'est un passage) */ }

  destroy(): void {
    this.img.destroy();
    this.rope.destroy();
    this.ghost.destroy();
    this.flames.forEach((f) => f.destroy());
  }
}

/**
 * Séquence C — l'escalier farceur. Monter trop vite fait réagir les marches (annoncé par un grincement
 * et un frémissement) : l'une descend, une autre se soulève, la dernière se décale. Tomber ramène
 * juste au pied de l'escalier. Expert : les marches réagissent aussi aux hésitations.
 */
export class PrankStairs implements Trap {
  readonly id = 'h-stairs';
  private steps: {
    x0: number; top0: number; x: number; top: number; zone: Phaser.GameObjects.Zone; gfx: Phaser.GameObjects.Graphics;
    react: { dx: number; dy: number }; state: 'rest' | 'warn' | 'moved'; t: number; vacant: number;
  }[] = [];
  private time = 0;

  constructor(private k: Kit, defs: { x: number; top: number; dx: number; dy: number }[]) {
    for (const d of defs) {
      const zone = movingZone(k, d.x, d.top + 10, 84, 20);
      const gfx = k.scene.add.graphics().setDepth(DEPTH.terrain + 2);
      this.steps.push({ x0: d.x, top0: d.top, x: d.x, top: d.top, zone, gfx, react: { dx: d.dx, dy: d.dy }, state: 'rest', t: 0, vacant: 0 });
    }
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    for (const s of this.steps) {
      s.t += dt;
      const on = standingOn(p, s.x - 42, s.x + 42, s.top);
      const fast = Math.abs(p.body.velocity.x) > 200 || p.airTime > 0;
      const hesit = this.k.expert && p.stillTime > 0.5;
      const prevX = s.x, prevTop = s.top;
      if (s.state === 'rest' && on && (fast && s.t > 0.05 || hesit)) {
        s.state = 'warn';
        s.t = 0;
        ctx.sfx('creak', s.x, 0.8);
      } else if (s.state === 'warn' && s.t >= 0.25) {
        s.state = 'moved';
        s.t = 0;
        ctx.sfx('tick', s.x);
      } else if (s.state === 'moved') {
        if (on) s.vacant = 0; else s.vacant += dt;
        if (s.vacant > 2.2) { s.state = 'rest'; s.t = 0; }
      }
      const target = s.state === 'moved' ? { x: s.x0 + s.react.dx, top: s.top0 + s.react.dy } : { x: s.x0, top: s.top0 };
      s.x = Phaser.Math.Linear(s.x, target.x, Math.min(1, dt * 7));
      s.top = Phaser.Math.Linear(s.top, target.top, Math.min(1, dt * 7));
      const shake = s.state === 'warn' ? Math.sin(this.time * 70) * 2 : 0;
      s.zone.setPosition(s.x, s.top + 10);
      if (on) carry(p, s.x - prevX, s.top - prevTop);
      this.drawStep(s.gfx, s.x + shake, s.top);
    }
  }

  private drawStep(g: Phaser.GameObjects.Graphics, x: number, top: number): void {
    g.clear();
    g.fillStyle(0x3e2a24, 1);
    g.fillRect(x - 36, top + 18, 6, 420 - top);
    g.fillRect(x + 30, top + 18, 6, 420 - top);
    g.fillStyle(0x8e6a52, 1);
    g.fillRoundedRect(x - 42, top, 84, 20, 4);
    g.fillStyle(0xc49a72, 1);
    g.fillRect(x - 40, top + 2, 80, 3);
    g.fillStyle(0x3e2a24, 0.5);
    g.fillRect(x - 10, top + 6, 2, 12);
  }

  reset(): void {
    for (const s of this.steps) { s.state = 'rest'; s.x = s.x0; s.top = s.top0; s.zone.setPosition(s.x, s.top + 10); }
  }

  destroy(): void { this.steps.forEach((s) => s.gfx.destroy()); }
}

// =====================================================================================
// ZONE 3 — LA GALERIE DES PORTRAITS
// =====================================================================================

/**
 * Séquence A — le portrait observateur. Ses yeux suivent le héros… puis, après un instant,
 * il regarde avec insistance une latte du plancher (fissurée). Il a l'air menaçant : il essaie d'aider.
 * La latte cède sous les pieds (petite fosse, on en ressort d'un saut) et le portrait pouffe.
 */
export class ObserverPortrait implements Trap {
  readonly id = 'h-observer';
  private eyes: Phaser.GameObjects.Graphics;
  private plankG: Phaser.GameObjects.Graphics;
  private plank: Phaser.GameObjects.Zone;
  private gazeT = 0;
  private look = { x: 0, y: 0 };
  private plankState: 'ok' | 'crack' | 'fall' | 'gone' = 'ok';
  private pt = 0;
  private fallY = 0;
  private fallA = 0;
  private time = 0;

  constructor(private k: Kit, private fx: number, private fy: number, private plankX: number, private plankTop: number, private plankW: number) {
    const sc = k.scene;
    const W = 100, Hh = 130;
    sc.add.image(fx - W / 2, fy - Hh / 2, ensureCanvas(sc, 'mn-noble', () => paintPortraitNoble(W, Hh))).setOrigin(0).setDepth(DEPTH.backProps + 1);
    sc.add.image(fx - W / 2 - 12, fy - Hh / 2 - 12, ensureCanvas(sc, `mn-frame-${W}-${Hh}`, () => paintFrame(W, Hh))).setOrigin(0).setDepth(DEPTH.backProps + 2);
    this.eyes = sc.add.graphics().setDepth(DEPTH.backProps + 1.5);
    this.plankG = sc.add.graphics().setDepth(DEPTH.terrain + 2);
    this.plank = movingZone(k, plankX + plankW / 2, plankTop + 10, plankW, 20);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    const W = 100, Hh = 130;
    const ex = [this.fx - W * 0.09, this.fx + W * 0.09], ey = this.fy - Hh / 2 + Hh * 0.45;
    // regarde le héros, puis la latte piégée
    const inView = p.alive && p.x > this.fx - 300 && p.x < this.plankX + 40;
    if (inView) this.gazeT += dt; else this.gazeT = 0;
    const start = this.k.expert ? 1.0 : 0.6;
    const hold = this.k.expert ? 1.2 : 3.2;
    const cycle = start + hold + 1.2;
    const ph = this.gazeT % cycle;
    const warn = inView && this.plankState === 'ok' && ph > start && ph < start + hold;
    let tx: number, ty: number;
    if (warn) {
      const dx = this.plankX + this.plankW / 2 - this.fx, dy = this.plankTop - ey;
      const d = Math.hypot(dx, dy);
      tx = dx / d; ty = dy / d;
      if (ph - dt <= start) ctx.sfx('tick', this.fx, 1);
    } else {
      const dx = p.x - this.fx, dy = p.y - ey;
      const d = Math.max(1, Math.hypot(dx, dy));
      tx = dx / d; ty = dy / d;
    }
    const kk = Math.min(1, dt * 8);
    this.look.x += (tx - this.look.x) * kk;
    this.look.y += (ty - this.look.y) * kk;
    const g = this.eyes;
    g.clear();
    for (const x of ex) {
      g.fillStyle(0x24306a, 1);
      g.fillCircle(x + this.look.x * 3.5, ey + this.look.y * 2, 2.6);
    }
    // sourcils : froncés quand il prévient (il a l'air méchant… il aide)
    g.lineStyle(2, 0x6b5a4a, 1);
    const raise = warn ? Math.sin(this.time * 14) * 2 : 0;
    g.lineBetween(ex[0] - 6, ey - 7 - raise, ex[0] + 5, ey - 5 + (warn ? 2 : 0));
    g.lineBetween(ex[1] + 6, ey - 7 - raise, ex[1] - 5, ey - 5 + (warn ? 2 : 0));

    // la latte
    this.pt += dt;
    const on = standingOn(p, this.plankX, this.plankX + this.plankW, this.plankTop);
    switch (this.plankState) {
      case 'ok':
        if (on) { this.plankState = 'crack'; this.pt = 0; ctx.sfx('crack', this.plankX); }
        break;
      case 'crack':
        if (this.pt >= 0.18) {
          this.plankState = 'fall';
          this.pt = 0;
          setBodyEnabled(this.plank, false);
          ctx.sfx('tileSink', this.plankX, 0.6);
          this.k.scene.time.delayedCall(500, () => { ctx.sfx('giggle', this.fx); say(this.k.scene, this.fx, this.fy - 100, 'Hihi… je l\'avais dit.', '#24306a', 1500); });
        }
        break;
      case 'fall':
        this.fallY += 500 * dt;
        this.fallA += 3 * dt;
        if (this.pt > 0.6) { this.plankState = 'gone'; this.pt = 0; }
        break;
      case 'gone': {
        const pb = p.body;
        const inSlot = pb.right > this.plankX && pb.left < this.plankX + this.plankW && pb.bottom > this.plankTop - 4 && pb.top < this.plankTop + 22;
        if (this.pt > 2.5 && !inSlot) {
          this.plankState = 'ok';
          this.fallY = this.fallA = 0;
          setBodyEnabled(this.plank, true);
          ctx.sfx('tileRise', this.plankX, 0.5);
        }
        break;
      }
    }
    this.drawPlank();
  }

  private drawPlank(): void {
    const g = this.plankG;
    g.clear();
    if (this.plankState === 'gone') return;
    const x = this.plankX, y = this.plankTop + this.fallY, w = this.plankW;
    g.fillStyle(0x8e6a52, 1);
    g.fillRoundedRect(x, y - 6, w, 22, 3);
    g.fillStyle(0xc49a72, 1);
    g.fillRect(x + 2, y - 5, w - 4, 2.5);
    // fissure : visible pour qui regarde (plus marquée en Facile)
    g.lineStyle(this.k.expert ? 1.2 : 2, 0x2c1d18, this.k.expert ? 0.6 : 0.9);
    g.beginPath();
    g.moveTo(x + w * 0.3, y - 5);
    g.lineTo(x + w * 0.42, y + 4);
    g.lineTo(x + w * 0.38, y + 10);
    g.lineTo(x + w * 0.55, y + 15);
    g.strokePath();
    if (this.plankState === 'crack') g.fillStyle(0x000000, 0.2).fillRect(x, y - 6, w, 22);
  }

  reset(): void {
    this.plankState = 'ok';
    this.fallY = this.fallA = 0;
    setBodyEnabled(this.plank, true);
    this.gazeT = 0;
  }

  destroy(): void { this.eyes.destroy(); this.plankG.destroy(); }
}

/**
 * Séquence B — le tableau menteur. Il montre un passage… un peu décalé. Quand on s'en approche
 * (ou qu'on s'arrête devant lui), il s'anime : sa peinture se corrige et les vraies plateformes,
 * presque invisibles dans la pénombre, s'illuminent un moment. Expert : moins longtemps (relançable).
 */
export class LyingPainting implements Trap {
  readonly id = 'h-lying';
  private paint: Phaser.GameObjects.Graphics;
  private platG: Phaser.GameObjects.Graphics;
  private reveal = 0;
  private shown = 0; // 0 = peinture menteuse, 1 = corrigée
  private triggered = false;
  private cooldown = 0;
  private time = 0;
  private readonly PW = 150;
  private readonly PH = 100;

  constructor(private k: Kit, private fx: number, private fy: number, private plats: { x: number; top: number; w: number }[], private gap: [number, number]) {
    const sc = k.scene;
    this.paint = sc.add.graphics().setDepth(DEPTH.backProps + 1);
    sc.add.image(fx - this.PW / 2 - 12, fy - this.PH / 2 - 12, ensureCanvas(sc, `mn-frame-${this.PW}-${this.PH}`, () => paintFrame(this.PW, this.PH))).setOrigin(0).setDepth(DEPTH.backProps + 2);
    this.platG = sc.add.graphics().setDepth(DEPTH.terrain + 2);
    for (const pl of plats) staticZone(k, pl.x - pl.w / 2, pl.top, pl.w, 16);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    if (this.cooldown > 0) this.cooldown -= dt;
    const near = p.alive && Math.abs(p.x - this.fx) < 230 && p.grounded;
    if (near && this.reveal <= 0 && this.cooldown <= 0 && (!this.triggered || p.stillTime > 0.45)) {
      this.triggered = true;
      this.reveal = this.k.expert ? 1.6 : 3.6;
      ctx.sfx('chime', this.fx);
    }
    if (this.reveal > 0) {
      this.reveal -= dt;
      if (this.reveal <= 0) this.cooldown = 0.8;
    }
    const target = this.reveal > 0 ? 1 : 0;
    this.shown += (target - this.shown) * Math.min(1, dt * 6);
    this.drawPainting();
    this.drawPlatforms();
  }

  private drawPainting(): void {
    const g = this.paint;
    const x0 = this.fx - this.PW / 2, y0 = this.fy - this.PH / 2;
    g.clear();
    g.fillStyle(0x1d1a38, 1);
    g.fillRect(x0, y0, this.PW, this.PH);
    // le vide du couloir, en miniature
    g.fillStyle(0x0c0818, 1);
    g.fillRect(x0 + this.PW * 0.2, y0 + this.PH * 0.6, this.PW * 0.6, this.PH * 0.4);
    g.fillStyle(0x6b4a3a, 1);
    g.fillRect(x0, y0 + this.PH * 0.6, this.PW * 0.2, 6);
    g.fillRect(x0 + this.PW * 0.8, y0 + this.PH * 0.6, this.PW * 0.2, 6);
    const [gx0, gx1] = this.gap;
    // plateformes peintes : décalées (mensonge) → corrigées pendant l'animation
    const lie = (1 - this.shown) * 14;
    for (const pl of this.plats) {
      const u = (pl.x - gx0) / (gx1 - gx0);
      const v = (pl.top - 460) / 120;
      const px = x0 + this.PW * (0.2 + 0.6 * u) + lie, py = y0 + this.PH * (0.56 + v * 0.3);
      g.fillStyle(this.shown > 0.5 ? 0xffd36b : 0x8e6a52, 1);
      g.fillRect(px - 7, py, 14, 4);
    }
    // l'œil du tableau (il s'anime)
    if (this.shown > 0.05) {
      g.fillStyle(0xffd36b, 0.25 * this.shown + 0.1 * Math.sin(this.time * 8) * this.shown);
      g.fillRect(x0, y0, this.PW, this.PH);
    }
  }

  private drawPlatforms(): void {
    const g = this.platG;
    g.clear();
    const faint = this.k.expert ? 0.1 : 0.2;
    const a = faint + (1 - faint) * this.shown;
    for (const pl of this.plats) {
      g.fillStyle(0x6b4a3a, a);
      g.fillRoundedRect(pl.x - pl.w / 2, pl.top, pl.w, 16, 3);
      g.fillStyle(0xc49a72, a);
      g.fillRect(pl.x - pl.w / 2 + 2, pl.top + 1, pl.w - 4, 2);
      // chaînes de suspension
      g.lineStyle(1.5, 0x8f8aa8, a * 0.8);
      g.lineBetween(pl.x - pl.w / 2 + 8, pl.top, pl.x - pl.w / 2 + 8, pl.top - 200);
      g.lineBetween(pl.x + pl.w / 2 - 8, pl.top, pl.x + pl.w / 2 - 8, pl.top - 200);
      if (this.shown > 0.3) {
        g.lineStyle(2, 0xffd36b, this.shown * 0.8);
        g.strokeRoundedRect(pl.x - pl.w / 2 - 3, pl.top - 3, pl.w + 6, 22, 5);
      }
    }
  }

  reset(): void { this.reveal = 0; this.cooldown = 0; this.triggered = false; }
  destroy(): void { this.paint.destroy(); this.platG.destroy(); }
}

/**
 * Séquence C — la bibliothèque vivante. Régulièrement, un livre glisse hors de l'étagère et
 * actionne la manivelle : la plateforme d'à côté monte vers la corniche, puis redescend.
 * Surprise : un gros grimoire tente de tomber sur le héros… il heurte la manivelle en chemin et
 * la bloque en mode « ascenseur à la demande ». Le piège facilite finalement le passage.
 */
export class LivingBookcase implements Trap {
  readonly id = 'h-bookcase';
  private plat: Phaser.GameObjects.Zone;
  private platG: Phaser.GameObjects.Graphics;
  private book: Phaser.GameObjects.Rectangle;
  private tome: Phaser.GameObjects.Rectangle;
  private crank: Phaser.GameObjects.Graphics;
  private y: number;
  private mode: 'auto' | 'assist' = 'auto';
  private phase: 'low' | 'push' | 'rise' | 'high' | 'lower' = 'low';
  private t = 0;
  private tomeState: 'wait' | 'wobble' | 'fall' | 'done' = 'wait';
  private tt = 0;
  private vacant = 0;
  private onT = 0;
  private assistUp = false;
  private time = 0;

  constructor(private k: Kit, private bx: number, private by: number, private bw: number, private bh: number, private px: number, private low: number, private high: number) {
    const sc = k.scene;
    sc.add.image(bx, by, ensureCanvas(sc, `mn-bookcase-${bw}-${bh}`, () => paintBookcase(bw, bh, 31))).setOrigin(0).setDepth(DEPTH.backProps + 2);
    this.book = sc.add.rectangle(bx + bw - 30, by + 26 + 70 + 30, 14, 44, 0x8a2d3b).setDepth(DEPTH.backProps + 3).setStrokeStyle(2, 0x24306a);
    this.tome = sc.add.rectangle(bx + bw * 0.7, by - 16, 46, 30, 0x2d5a7a).setDepth(DEPTH.traps).setStrokeStyle(2, 0x1a1533);
    this.crank = sc.add.graphics().setDepth(DEPTH.backProps + 4);
    this.y = low;
    this.plat = movingZone(k, px, low + 8, 92, 16, true);
    this.platG = sc.add.graphics().setDepth(DEPTH.terrain + 2);
    this.drawCrank(0);
  }

  private drawCrank(a: number): void {
    const g = this.crank;
    g.clear();
    const cx = this.bx + this.bw + 4, cy = this.by + this.bh * 0.6;
    g.fillStyle(0xb68a3a, 1);
    g.fillCircle(cx, cy, 9);
    g.lineStyle(5, 0xd9a23a, 1);
    g.lineBetween(cx, cy, cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    g.fillStyle(0x6b4a3a, 1);
    g.fillCircle(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 5);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const p = ctx.player;
    const prevY = this.y;
    const on = standingOn(p, this.px - 46, this.px + 46, this.y);
    const E = this.k.expert;
    const RISE = 0.9;
    if (this.mode === 'auto') {
      switch (this.phase) {
        case 'low':
          this.y = this.low;
          if (this.t >= (E ? 1.1 : 1.6)) { this.phase = 'push'; this.t = 0; ctx.sfx('book', this.bx + this.bw, 0.6); }
          break;
        case 'push':
          // un livre glisse hors de l'étagère (l'annonce)
          this.book.x = this.bx + this.bw - 30 + Math.min(1, this.t / 0.45) * 26;
          if (this.t >= 0.45) { this.phase = 'rise'; this.t = 0; ctx.sfx('creak', this.px, 0.5); }
          break;
        case 'rise':
          this.y = Phaser.Math.Linear(this.low, this.high, Phaser.Math.Easing.Sine.InOut(Math.min(1, this.t / RISE)));
          if (this.t >= RISE) { this.phase = 'high'; this.t = 0; }
          break;
        case 'high':
          this.y = this.high;
          if (this.t >= (E ? 1.4 : 2.2)) { this.phase = 'lower'; this.t = 0; this.book.x = this.bx + this.bw - 30; }
          break;
        case 'lower':
          this.y = Phaser.Math.Linear(this.high, this.low, Phaser.Math.Easing.Sine.InOut(Math.min(1, this.t / RISE)));
          if (this.t >= RISE) { this.phase = 'low'; this.t = 0; }
          break;
      }
    } else {
      // ascenseur à la demande : monte quand on s'y tient, redescend une seconde après qu'on l'a quitté
      if (on) { this.onT += dt; this.vacant = 0; if (this.onT > 0.25) this.assistUp = true; }
      else { this.onT = 0; this.vacant += dt; if (this.vacant > 1.0) this.assistUp = false; }
      this.y = Phaser.Math.Linear(this.y, this.assistUp ? this.high : this.low, Math.min(1, dt * 2.6));
    }
    this.drawCrank(this.mode === 'assist' ? Math.PI * 0.5 : -0.6 + (this.low - this.y) / (this.low - this.high) * 2.2);
    this.plat.setPosition(this.px, this.y + 8);
    if (on) carry(p, 0, this.y - prevY);
    this.drawPlat();

    // le grimoire farceur
    this.tt += dt;
    const tx0 = this.bx + this.bw * 0.7;
    switch (this.tomeState) {
      case 'wait':
        if (p.alive && p.x > this.bx + 10 && p.x < this.px + 20 && p.grounded && p.bottom > this.low - 10) { this.tomeState = 'wobble'; this.tt = 0; ctx.sfx('creak', tx0, 0.7); }
        break;
      case 'wobble':
        this.tome.setAngle(Math.sin(this.tt * 40) * 8);
        if (this.tt > 0.7) {
          this.tomeState = 'fall';
          this.tt = 0;
          // il vise le héros… mais la manivelle est sur sa route
          this.k.scene.tweens.add({ targets: this.tome, x: this.bx + this.bw + 8, y: this.by + this.bh * 0.6 - 18, angle: 160, duration: 380, ease: 'Quad.easeIn', onComplete: () => this.tomeHits(ctx) });
        }
        break;
      default:
        break;
    }
  }

  private tomeHits(ctx: TrapContext): void {
    this.tomeState = 'done';
    this.mode = 'assist';
    ctx.sfx('clonk', this.bx + this.bw);
    ctx.sfx('book', this.bx + this.bw);
    say(this.k.scene, this.bx + this.bw, this.by - 30, 'Clac !', '#24306a', 900);
    // ricochet : le grimoire retourne sagement sur l'étagère
    this.k.scene.tweens.add({ targets: this.tome, x: this.bx + 40, y: this.by - 16, angle: 360, duration: 600, ease: 'Sine.easeOut' });
    this.k.player.setExpression('grin', 900);
  }

  private drawPlat(): void {
    const g = this.platG;
    g.clear();
    // tablette de bibliothèque suspendue à une chaîne
    g.lineStyle(2, 0x8f8aa8, 0.9);
    g.lineBetween(this.px - 36, this.y, this.px - 36, 80);
    g.lineBetween(this.px + 36, this.y, this.px + 36, 80);
    g.fillStyle(0x5a3d30, 1);
    g.fillRoundedRect(this.px - 46, this.y, 92, 16, 3);
    g.fillStyle(0x8e6a52, 1);
    g.fillRect(this.px - 44, this.y + 1, 88, 3);
    g.fillStyle(0x2d5a7a, 1);
    g.fillRect(this.px - 30, this.y + 6, 8, 10);
    g.fillStyle(0x8a2d3b, 1);
    g.fillRect(this.px + 16, this.y + 6, 8, 10);
  }

  reset(): void {
    if (this.mode === 'auto') { this.phase = 'low'; this.t = 0; this.y = this.low; this.book.x = this.bx + this.bw - 30; }
    if (this.tomeState === 'wobble') { this.tomeState = 'wait'; this.tome.setAngle(0); }
  }

  destroy(): void { this.platG.destroy(); this.book.destroy(); this.tome.destroy(); this.crank.destroy(); }
}
