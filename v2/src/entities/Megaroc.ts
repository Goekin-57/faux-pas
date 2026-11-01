// Boss du chapitre 1 : Mégaroc, un rocher qui saute sur toi.
// Pour le blesser : le faire atterrir sur une dalle fissurée (il s'enfonce), puis lui sauter sur la tête.
import Phaser from 'phaser';
import { COL, CSS, FONT } from '../core/config';
import { AudioManager } from '../audio/AudioManager';
import type { Player } from './Player';

export interface Tile { x: number; w: number; cracked: boolean; broken: number; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone; body: Phaser.Physics.Arcade.StaticBody; cracks: Phaser.GameObjects.Graphics }
export interface BossCtx {
  player: Player; tiles: Tile[]; deaths: number;
  hurt(fromX: number): void; banner(t: string, c: string, sub?: string): void; taunt(t: string): void; cue(t: string, x: number, y: number): void;
  shake(ms: number, k: number): void; burst(x: number, y: number, k: 'dust' | 'chips' | 'spark', n?: number): void;
  defeated(): void;
}

type State = 'intro' | 'idle' | 'prep' | 'jump' | 'sunk' | 'out' | 'fake' | 'dead';

export class Megaroc {
  ct: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  x = 760; y = -200; vy = 0;
  hp = 3; maxHp = 3; rage = false; revived = false;
  state: State = 'intro';
  private t = 0;
  private from = 0; private to = 0; private jumpT = 0; private jumpDur = 0.9; private combo = 0;
  readonly w = 110; readonly h = 80;
  private sunkTile: Tile | null = null;
  private shadow: Phaser.GameObjects.Ellipse;
  private glowT = 0;
  private glows = new Map<Tile, Phaser.GameObjects.Rectangle>();
  private glow(tl: Tile): Phaser.GameObjects.Rectangle { let r = this.glows.get(tl); if (!r) { r = this.scene.add.rectangle(tl.x + tl.w / 2, 424, tl.w - 10, 16, COL.sun, 1).setDepth(5).setAlpha(0); this.glows.set(tl, r); } return r; }

  constructor(private scene: Phaser.Scene, private c: BossCtx) {
    this.body = scene.add.image(0, 0, 'rock').setOrigin(0.5, 1);
    this.body.setDisplaySize(this.w + 16, this.h + 10);
    this.face = scene.add.graphics();
    this.stars = scene.add.text(0, -this.h - 20, '★ ★', { fontFamily: FONT.display, fontSize: '18px', color: CSS.sun, stroke: CSS.ink, strokeThickness: 4 }).setOrigin(0.5).setVisible(false);
    this.ct = scene.add.container(this.x, this.y, [this.body, this.face, this.stars]).setDepth(15);
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.label = scene.add.text(480, 22, 'MÉGAROC', { fontFamily: FONT.display, fontSize: '18px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.shadow = scene.add.ellipse(0, 422, 20, 8, 0x000000, 0.4).setDepth(9).setVisible(false);
    this.drawFace('angry');
    this.drawBar();
  }

  private drawFace(mood: 'angry' | 'dizzy' | 'happy'): void {
    const g = this.face; g.clear();
    const ey = -this.h * 0.55;
    if (mood === 'dizzy') {
      g.lineStyle(4, COL.ink, 1);
      for (const ex of [-20, 20]) { g.beginPath(); g.arc(ex, ey, 7, 0, Math.PI * 1.6); g.strokePath(); }
      g.fillStyle(COL.ink, 1); g.fillEllipse(0, ey + 22, 16, 10);
      return;
    }
    g.fillStyle(0xffffff, 1); g.fillEllipse(-20, ey, 20, 16); g.fillEllipse(20, ey, 20, 16);
    g.fillStyle(COL.ink, 1); g.fillCircle(-17, ey + 2, 5); g.fillCircle(17, ey + 2, 5);
    g.lineStyle(6, COL.ink, 1);
    if (mood === 'angry') { g.lineBetween(-32, ey - 16, -8, ey - 8); g.lineBetween(32, ey - 16, 8, ey - 8); g.lineBetween(-14, ey + 22, 14, ey + 20); }
    else { g.beginPath(); g.arc(0, ey + 14, 14, 0.2, Math.PI - 0.2); g.strokePath(); }
  }
  private drawBar(): void {
    const g = this.bar; g.clear();
    g.fillStyle(COL.ink, 0.85); g.fillRoundedRect(330, 38, 300, 18, 9);
    const f = Math.max(0, this.hp / this.maxHp);
    g.fillStyle(this.rage ? COL.pink : COL.sun, 1); g.fillRoundedRect(334, 42, Math.max(10, 292 * f), 10, 5);
  }
  private tileAt(x: number): Tile | undefined { return this.c.tiles.find((t) => x >= t.x && x < t.x + t.w); }
  hideHud(): void { this.bar.setVisible(false); this.label.setVisible(false); }

  update(dt: number): void {
    this.t += dt;
    const p = this.c.player, G = 420;
    switch (this.state) {
      case 'intro':
        this.vy += 2000 * dt; this.y += this.vy * dt;
        if (this.y >= G) { this.y = G; this.land(false); this.state = 'idle'; this.t = 0; this.c.banner('MÉGAROC', CSS.sun, 'Le rocher qui saute'); }
        break;
      case 'idle':
        this.body.setScale(this.body.scaleX, (this.h + 10) / this.body.height * (1 + Math.sin(this.t * 6) * 0.03));
        if (this.t > (this.rage ? 0.45 : 0.9)) { this.state = 'prep'; this.t = 0; }
        break;
      case 'prep': // il s'écrase avant de sauter : c'est le signal
        this.ct.setX(this.x + Math.sin(this.t * 60) * 3);
        this.body.setScale(this.body.scaleX * 1, ((this.h + 10) / this.body.height) * (1 - Math.min(0.2, this.t * 0.4)));
        if (this.t > (this.rage ? 0.35 : 0.55)) {
          this.from = this.x; this.to = Phaser.Math.Clamp(p.x, 80, 880); this.jumpT = 0; this.jumpDur = this.rage ? 0.75 : 0.95;
          this.state = 'jump'; AudioManager.play('jump'); this.shadow.setVisible(true).setPosition(this.to, 422);
        }
        break;
      case 'jump': {
        this.jumpT += dt; const k = Math.min(1, this.jumpT / this.jumpDur);
        this.x = this.from + (this.to - this.from) * k; this.y = G - Math.sin(k * Math.PI) * 230;
        this.body.setScale(this.body.scaleX, (this.h + 10) / this.body.height * 1.05);
        this.shadow.setSize(30 + k * 100, 8 + k * 10).setFillStyle(this.tileAt(this.to)?.cracked ? 0xff2255 : 0x000000, 0.25 + k * 0.25);   // ombre d'impact : où il va tomber
        if (k >= 1) { this.y = G; this.shadow.setVisible(false); this.land(true); }
        break;
      }
      case 'sunk':
        if (this.t > (this.rage ? 1.9 : 2.5)) this.popOut();
        break;
      case 'out':
        this.vy += 2000 * dt; this.y += this.vy * dt; this.x += (this.to - this.x) * Math.min(1, dt * 3);
        if (this.y >= G && this.vy > 0) { this.y = G; this.land(false); this.state = 'idle'; this.t = 0; }
        break;
      case 'fake': case 'dead': break;
    }
    if (this.state !== 'prep') this.ct.setX(this.x);
    this.ct.setY(this.y + (this.state === 'sunk' ? 34 : 0));
    this.ct.setScale(this.x < p.x ? 1 : -1, 1);
    // les dalles fissurées respirent la poussière et luisent (plus fort juste après un rebond raté)
    this.glowT = Math.max(0, this.glowT - dt);
    for (const tl of this.c.tiles) if (!tl.cracked) this.glows.get(tl)?.setAlpha(0);
    for (const tl of this.c.tiles) if (tl.cracked) {
      const a = (this.c.deaths >= 3 || this.glowT > 0 ? 0.6 : 0.3) * (0.6 + 0.4 * Math.sin(this.t * 5));
      this.glow(tl).setAlpha(tl.ct.visible ? a : 0);
      if (Math.random() < dt * 1.2) this.c.burst(tl.x + 20 + Math.random() * (tl.w - 40), G + 4, 'dust', 1);
    }
    if (this.rage && this.state !== 'dead' && this.state !== 'fake' && Math.random() < dt * 4) this.c.burst(this.x + (Math.random() - 0.5) * 60, this.y - this.h, 'dust', 1);
    // tuiles cassées qui se reconstruisent
    for (const tl of this.c.tiles) if (tl.broken > 0) { tl.broken -= dt; if (tl.broken <= 0) this.restoreTile(tl); }
    // contacts avec le joueur
    if (p.dead || this.state === 'intro' || this.state === 'fake' || this.state === 'dead') return;
    const top = this.y + (this.state === 'sunk' ? 34 : 0) - this.h, overX = Math.abs(p.x - this.x) < this.w / 2 + 8;
    // on lui tombe dessus : on regarde si les pieds ont franchi le haut de sa tête depuis l'image d'avant
    const crossed = p.body.velocity.y >= 0 && p.prevY <= top + 6 && p.y >= top - 4;
    if (overX && crossed) {
      if (this.state === 'sunk') this.hit();
      else { p.bounce(460); AudioManager.play('stomp'); this.c.burst(p.x, top, 'spark', 8); this.c.cue('Trop dur !', this.x, top - 30); this.glowT = 1.2; }
      return;
    }
    if (!overX || p.y < top - 4 || p.y - 30 > this.y) return;
    if (this.state !== 'sunk') this.c.hurt(this.x);
  }

  private land(fromJump: boolean): void {
    AudioManager.play('stomp'); this.c.shake(200, 0.012); this.c.burst(this.x, 420, 'dust', 18);
    this.body.setScale(this.body.scaleX, (this.h + 10) / this.body.height * 0.8);
    this.scene.tweens.add({ targets: this.body, scaleY: (this.h + 10) / this.body.height, duration: 220, ease: 'Back.Out' });
    if (!fromJump) return;
    const tl = this.tileAt(this.x);
    if (tl && tl.cracked) {
      // la dalle cède : il est coincé, c'est le moment
      tl.cracked = false; tl.cracks.clear(); tl.ct.setVisible(false); this.sunkTile = tl;
      AudioManager.play('trap'); this.c.burst(this.x, 430, 'chips', 26);
      this.state = 'sunk'; this.t = 0; this.drawFace('dizzy'); this.stars.setVisible(true);
      this.c.cue('Il est vulnérable !', this.x, 300);
      return;
    }
    // onde de choc : si tu es au sol tout près, tu prends un coup
    const p = this.c.player;
    if (p.onGround && Math.abs(p.x - this.x) < 150 && !p.dead) this.c.hurt(this.x);
    this.combo++;
    if (this.rage && this.combo % 2 === 1) { this.state = 'prep'; this.t = 0.15; return; }
    this.state = 'idle'; this.t = 0;
  }

  private hit(): void {
    const p = this.c.player;
    p.bounce(560); this.hp--; AudioManager.play('hurt'); this.c.shake(250, 0.016); this.c.burst(this.x, this.y - 40, 'spark', 24);
    this.body.setTint(0xff6688); this.scene.time.delayedCall(180, () => this.body.clearTint());
    if (this.hp === 1 && !this.rage) { this.rage = true; this.body.setTint(0xffb0a0); }
    this.drawBar();
    this.scene.time.delayedCall(200, () => { if (this.rage) this.body.setTint(0xffb0a0); });
    if (this.hp <= 0) { this.defeat(); return; }
    this.popOut();
  }
  private popOut(): void {
    // la dalle où il était coincé redevient normale ; une autre dalle se fissure, loin du joueur (jamais de trou sous les pieds)
    if (this.sunkTile) {
      const old = this.sunkTile; this.sunkTile = null; old.ct.setVisible(true);
      const px = this.c.player.x, cands = this.c.tiles.filter((t) => !t.cracked && t !== old && Math.abs(t.x + t.w / 2 - px) > 180 && t.x > 0 && t.x < 840);
      const nt = cands.sort((a, b) => Math.abs(b.x - px) - Math.abs(a.x - px))[Math.floor(Math.random() * Math.min(2, cands.length))];
      if (nt && this.c.tiles.filter((t) => t.cracked).length < 2) this.crack(nt);
    }
    this.stars.setVisible(false); this.drawFace('angry');
    const free = this.c.tiles.filter((t) => !t.cracked && t.broken <= 0 && Math.abs(t.x + t.w / 2 - this.x) > 150);
    const dest = free.length ? free[Math.floor(Math.random() * free.length)] : this.c.tiles[0];
    this.to = dest.x + dest.w / 2; this.vy = -900; this.state = 'out'; this.t = 0;
  }
  private restoreTile(tl: Tile): void {
    tl.broken = 0; tl.body.enable = true; tl.ct.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: tl.ct, alpha: 1, duration: 300 });
    this.crack(tl);
  }
  crack(tl: Tile): void {
    tl.cracked = true; const g = tl.cracks; g.clear();
    g.lineStyle(4, COL.outline, 1);
    for (let x = 16; x < tl.w - 10; x += 40) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 8, 16); g.lineTo(x + 2, 30); g.moveTo(x + 8, 16); g.lineTo(x + 20, 22); g.strokePath(); }
  }

  private defeat(): void {
    if (!this.revived) {
      // fausse défaite : il s'effondre… puis se reconstitue
      this.state = 'fake'; this.drawFace('dizzy'); this.stars.setVisible(false);
      AudioManager.play('win'); this.c.banner('MÉGAROC EST VAINCU !', CSS.sun);
      this.scene.tweens.add({ targets: this.body, scaleY: 0.2, duration: 500, ease: 'Quad.In' });
      this.c.burst(this.x, this.y - 20, 'chips', 40);
      this.scene.time.delayedCall(1700, () => {
        this.revived = true; this.hp = 1; this.maxHp = 1; this.rage = true; this.drawBar();
        AudioManager.play('fake'); this.c.banner('… OU PAS !', CSS.pink, 'Les cailloux, ça se recolle.');
        this.scene.tweens.add({ targets: this.body, scaleY: (this.h + 10) / this.body.height, duration: 400, ease: 'Back.Out' });
        this.drawFace('angry');
        // les fissures changent de place
        for (const tl of this.c.tiles) { tl.cracked = false; tl.cracks.clear(); }
        const idx = [1, 6]; idx.forEach((i) => { const tl = this.c.tiles[i]; if (tl && tl.broken <= 0) this.crack(tl); });
        this.state = 'idle'; this.t = 0;
      });
      return;
    }
    if (this.sunkTile) { this.sunkTile.ct.setVisible(true); this.sunkTile = null; }
    this.state = 'dead'; AudioManager.play('win'); this.c.shake(400, 0.02);
    this.c.burst(this.x, this.y - 40, 'chips', 60); this.c.burst(this.x, this.y - 40, 'spark', 40);
    this.scene.tweens.add({ targets: this.ct, alpha: 0, scaleY: 0.1, duration: 600 });
    this.hideHud();
    this.c.defeated();
  }
}
