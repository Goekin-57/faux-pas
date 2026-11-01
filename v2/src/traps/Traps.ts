// Pièges troll modulaires. Chacun a : un état de départ, un déclencheur, une animation, une collision,
// un son, un indice visuel, et une remise à zéro (à chaque réapparition).
import Phaser from 'phaser';
import type { TrapDef } from '../levels/level1';
import type { Player } from '../entities/Player';
import { AudioManager } from '../audio/AudioManager';
import { COL, CSS, FONT } from '../core/config';

export interface TrapCtx {
  scene: Phaser.Scene;
  player: Player;
  kill(cause: string): void;
  hurt(fromX: number): void;
  taunt(text: string): void;
  banner(text: string, color: string, sub?: string): void;
  setCheckpoint(x: number, y: number): void;
  deathsNear(x: number, r: number): number;
  shake(ms: number, k: number): void;
  burst(x: number, y: number, kind: 'dust' | 'chips' | 'spark' | 'leaf', n?: number): void;
  addBridge(x: number, y: number, w: number): void;
}
export interface Trap { update(dt: number, t: number): void; reset(afterDeath: boolean): void }

const near = (p: Player, x: number, y: number, rx: number, ry: number) => Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;

// Pics qui changent de place après chaque mort dans leur zone.
class MovingSpikes implements Trap {
  private imgs: Phaser.GameObjects.Image[] = [];
  private idx = 0;
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'movingSpikes' }>) {
    for (let i = 0; i < 2; i++) this.imgs.push(c.scene.add.image(0, d.y, 'spikes').setOrigin(0, 1).setDepth(6));
    this.place();
  }
  private place(): void { const x = this.d.positions[this.idx % this.d.positions.length]; this.imgs.forEach((im, i) => im.setPosition(x + i * (this.d.w / 2), this.d.y).setDisplaySize(this.d.w / 2 + 1, 18)); }
  update(): void {
    const p = this.c.player, x = this.d.positions[this.idx % this.d.positions.length];
    if (p.x + 10 > x + 6 && p.x - 10 < x + this.d.w - 6 && p.y > this.d.y - 16 && p.y <= this.d.y + 4) this.c.kill('spikes');
  }
  reset(afterDeath: boolean): void {
    const p = this.c.player, x0 = Math.min(...this.d.positions) - 150, x1 = Math.max(...this.d.positions) + 150;
    if (afterDeath && p.x > x0 && p.x < x1) {
      this.idx++; this.place();
      this.imgs.forEach((im) => this.c.scene.tweens.add({ targets: im, scaleY: { from: 0, to: im.scaleY }, duration: 260, ease: 'Back.Out' }));
      this.c.taunt('Le piège a déménagé !');
    }
  }
}

// Fleur qui mord si on reste à côté : elle respire en montrant ses dents (indice).
class BiteFlower implements Trap {
  private img: Phaser.GameObjects.Image;
  private jaw: Phaser.GameObjects.Graphics;
  private near = 0;
  private cool = 0;
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'biteFlower' }>) {
    this.img = c.scene.add.image(d.x, d.y + 3, 'flower').setOrigin(0.5, 1).setDisplaySize(34, 38).setDepth(7);
    this.jaw = c.scene.add.graphics().setDepth(8);
  }
  update(dt: number, t: number): void {
    const p = this.c.player, close = near(p, this.d.x, this.d.y, 34, 40);
    this.near = close ? this.near + dt : Math.max(0, this.near - dt * 2);
    this.cool = Math.max(0, this.cool - dt);
    const open = Math.min(1, this.near / 0.45);
    this.img.setScale(this.img.scaleX, this.img.scaleY).setAngle(Math.sin(t * 3) * 4 + (close ? Math.sin(t * 40) * 3 : 0));
    this.jaw.clear();
    const cx = this.d.x, cy = this.d.y - 26;
    // petites dents qui dépassent : on les voit avant qu'elle morde
    this.jaw.fillStyle(0xffffff, 1);
    for (let i = -1; i <= 1; i++) this.jaw.fillTriangle(cx + i * 5 - 2, cy + 2, cx + i * 5 + 2, cy + 2, cx + i * 5, cy + 6 + open * 4);
    if (open >= 1 && this.cool <= 0) {
      this.cool = 1.2; this.near = 0; AudioManager.play('stomp');
      this.c.scene.tweens.add({ targets: this.img, scale: this.img.scale * 1.35, duration: 90, yoyo: true });
      this.c.hurt(this.d.x); this.c.taunt('Elle mord, la fleur.');
    }
  }
  reset(): void { this.near = 0; this.cool = 0; }
}

// Ressort paresseux : refuse le premier rebond, marche ensuite.
class LazySpring implements Trap {
  private img: Phaser.GameObjects.Image;
  private tries = 0;
  private cool = 0;
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'lazySpring' }>) {
    this.img = c.scene.add.image(d.x, d.y + 2, 'spring').setOrigin(0.5, 1).setDisplaySize(40, 34).setDepth(7);
  }
  update(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
    const p = this.c.player, b = p.body;
    if (this.cool > 0 || b.velocity.y < 0 || Math.abs(p.x - this.d.x) > 22 || p.y < this.d.y - 34 || p.y > this.d.y + 2) return;
    this.cool = 0.4; this.tries++;
    const lazy = this.tries === 1;
    p.bounce(lazy ? 260 : this.d.power);
    AudioManager.play(lazy ? 'fake' : 'spring');
    this.c.scene.tweens.add({ targets: this.img, scaleY: { from: this.img.scaleY * 0.5, to: this.img.scaleY }, duration: lazy ? 600 : 260, ease: lazy ? 'Sine.Out' : 'Back.Out' });
    if (lazy) this.c.taunt('Boing… (flemme)');
  }
  reset(): void { /* il reste réveillé après le premier essai */ }
}

// Faux drapeau de sauvegarde : il annonce « Sauvegardé ! » puis s'enfuit.
class FakeCheckpoint implements Trap {
  private flag: Phaser.GameObjects.Container;
  private done = false;
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'fakeCheckpoint' }>) {
    this.flag = makeFlag(c.scene, d.x, d.y, COL.sun);
  }
  update(): void {
    if (this.done || !near(this.c.player, this.d.x, this.d.y - 20, 26, 50)) return;
    this.done = true;
    AudioManager.play('checkpoint'); this.c.taunt('Sauvegardé !');
    this.c.scene.time.delayedCall(700, () => {
      AudioManager.play('laugh'); this.c.taunt('… ou pas.');
      this.c.scene.tweens.add({ targets: this.flag, x: this.d.runTo, duration: 1400, ease: 'Quad.In' });
      this.c.scene.tweens.add({ targets: this.flag, y: this.d.y - 16, duration: 120, yoyo: true, repeat: 5 });
    });
  }
  reset(): void { /* le gag ne se joue qu'une fois */ }
}

// Fausse sortie en carton : elle annonce la victoire, puis tombe à plat… et sert de pont au-dessus du trou.
class FakeVictory implements Trap {
  private door: Phaser.GameObjects.Image;
  private state: 'idle' | 'fooled' | 'bridge' = 'idle';
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'fakeVictory' }>) {
    this.door = c.scene.add.image(d.x, d.y + 3, 'door').setOrigin(0.5, 1).setDisplaySize(96, 64).setDepth(5);
  }
  update(_dt: number, t: number): void {
    if (this.state !== 'idle') return;
    this.door.setAngle(Math.sin(t * 2.2) * 0.8);   // indice : elle tangue un peu, comme un décor mal fixé
    if (!near(this.c.player, this.d.x, this.d.y - 20, 30, 50)) return;
    this.state = 'fooled';
    const p = this.c.player; p.frozen = true; p.body.setVelocityX(0);
    AudioManager.play('win'); this.c.banner('NIVEAU RÉUSSI !', CSS.sun);
    this.c.scene.time.delayedCall(1300, () => {
      AudioManager.play('fake'); this.c.banner('… OU PAS !', CSS.pink, 'C\'était une porte en carton.');
      p.frozen = false;
      // la porte bascule vers l'avant et devient un pont
      this.door.setOrigin(0.5, 1);
      this.c.scene.tweens.add({ targets: this.door, angle: 90, x: this.d.x + 30, duration: 420, ease: 'Quad.In', onComplete: () => {
        AudioManager.play('stomp'); this.c.shake(120, 0.006); this.c.burst(this.d.bridge[0] + 60, this.d.y, 'dust', 14);
        this.c.scene.tweens.add({ targets: this.door, alpha: 0, duration: 200 });
        this.c.addBridge(this.d.bridge[0], this.d.y, this.d.bridge[1] - this.d.bridge[0]);
        this.state = 'bridge';
      } });
    });
  }
  reset(): void { /* une fois tombée, la porte reste un pont */ }
}

// Zone de commandes inversées : machine à états (entrée, inversion, sortie) sans oscillation à la frontière.
class InvertZone implements Trap {
  private inside = false;
  constructor(private c: TrapCtx, private d: Extract<TrapDef, { type: 'invertZone' }>) {
    c.scene.add.rectangle(d.x, 0, d.w, 600, COL.lilac, 0.16).setOrigin(0, 0).setDepth(1);
  }
  update(): void {
    const p = this.c.player, cx = p.x;
    // hystérésis de 6 px : une touche maintenue ne fait pas rentrer/sortir en boucle
    const now = this.inside ? cx > this.d.x - 6 && cx < this.d.x + this.d.w + 6 : cx > this.d.x + 6 && cx < this.d.x + this.d.w - 6;
    if (now !== this.inside) { this.inside = now; p.inverted = now; this.c.taunt(now ? '⇄ Commandes inversées' : 'Commandes normales'); AudioManager.play('whoosh'); }
  }
  reset(): void { this.inside = false; this.c.player.inverted = false; }
}

export function makeFlag(scene: Phaser.Scene, x: number, y: number, col: number): Phaser.GameObjects.Container {
  const ct = scene.add.container(x, y).setDepth(6);
  const g = scene.add.graphics();
  g.fillStyle(COL.outline, 1); g.fillRoundedRect(-3, -64, 6, 64, 2);
  g.fillStyle(0xd9d4e6, 1); g.fillRoundedRect(-2, -63, 4, 62, 2);
  g.fillStyle(COL.outline, 1); g.fillCircle(0, -66, 6);
  g.fillStyle(col, 1); g.fillCircle(0, -66, 4);
  const cloth = scene.add.graphics();
  cloth.fillStyle(COL.outline, 1); cloth.fillTriangle(1, -62, 1, -36, 36, -49);
  cloth.fillStyle(col, 1); cloth.fillTriangle(3, -59, 3, -39, 30, -49);
  ct.add([g, cloth]);
  scene.tweens.add({ targets: cloth, scaleX: 0.85, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return ct;
}

export function makeTrap(c: TrapCtx, d: TrapDef): Trap {
  switch (d.type) {
    case 'movingSpikes': return new MovingSpikes(c, d);
    case 'biteFlower': return new BiteFlower(c, d);
    case 'lazySpring': return new LazySpring(c, d);
    case 'fakeCheckpoint': return new FakeCheckpoint(c, d);
    case 'fakeVictory': return new FakeVictory(c, d);
    case 'invertZone': return new InvertZone(c, d);
  }
}

export const TAUNT_STYLE = { fontFamily: FONT.display, fontSize: '28px', color: CSS.pink, stroke: CSS.ink, strokeThickness: 6 };
