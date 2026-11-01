// Contrôleur du joueur : physique Arcade + coyote time, saut mémorisé, saut variable, cœurs et invulnérabilité.
import Phaser from 'phaser';
import { PHYS, HEARTS, INVULN } from '../core/config';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { HeroView, type CharId } from './HeroArt';

export const PW = 24, PH = 30;

export class Player {
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.Physics.Arcade.Body;
  view: HeroView;
  hp = HEARTS;
  invuln = 0;
  hurtT = 0;
  coyote = 0;
  buffer = 0;
  face = 1;
  wasGround = true;
  dead = false;
  frozen = false;
  inverted = false;          // commandes inversées (machine à états gérée par la scène)
  springBoost = 0;
  private lastVy = 0;
  private touch = false;

  constructor(private scene: Phaser.Scene, x: number, y: number, char: CharId) {
    this.rect = scene.add.rectangle(x, y, PW, PH, 0xff00ff, 0).setOrigin(0.5, 1);
    scene.physics.add.existing(this.rect);
    this.body = this.rect.body as Phaser.Physics.Arcade.Body;
    this.body.setMaxVelocity(PHYS.speed * 3, PHYS.maxFall);
    this.view = new HeroView(scene, x, y, char).setDepth(20);
  }

  get x(): number { return this.rect.x; }
  get y(): number { return this.rect.y; }   // y = bas des pieds
  get onGround(): boolean { return this.body.blocked.down || this.body.touching.down; }

  respawn(x: number, y: number): void {
    this.rect.setPosition(x, y); this.body.reset(x, y); this.body.setVelocity(0, 0);
    this.hp = HEARTS; this.invuln = 0.6; this.dead = false; this.frozen = false; this.hurtT = 0; this.buffer = 0; this.coyote = 0; this.inverted = false;
    this.view.setVisible(true).setAlpha(1); this.view.mood = 'normal'; this.view.punch(0.7, 1.3);
  }

  update(dt: number): void {
    this.touch = InputManager.device === 'touch';
    const b = this.body;
    if (this.dead) { this.view.setPosition(this.rect.x, this.rect.y); return; }
    this.invuln = Math.max(0, this.invuln - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    let L = InputManager.held('left'), R = InputManager.held('right');
    if (this.inverted) [L, R] = [R, L];
    if (this.frozen) { L = R = false; }
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    const ground = this.onGround;
    // horizontal : accélération rapide au sol, contrôle réduit en l'air, le choc d'un coup garde la main
    const target = dir * PHYS.speed, accel = dir ? (ground ? PHYS.accelGround : PHYS.accelAir) : (ground ? PHYS.decelGround : PHYS.decelAir);
    const k = this.hurtT > 0 ? 0.35 : 1;
    const vx = b.velocity.x, dv = target - vx, step = accel * dt * k;
    b.setVelocityX(Math.abs(dv) <= step ? target : vx + Math.sign(dv) * step);
    if (dir) this.face = dir;
    // saut
    this.coyote = ground ? (this.touch ? PHYS.coyoteTouch : PHYS.coyote) : Math.max(0, this.coyote - dt);
    if (InputManager.pressed('jump') && !this.frozen) this.buffer = this.touch ? PHYS.bufferTouch : PHYS.buffer;
    else this.buffer = Math.max(0, this.buffer - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      b.setVelocityY(-PHYS.jump); this.buffer = 0; this.coyote = 0;
      AudioManager.play('jump'); this.view.punch(0.78, 1.25); this.scene.events.emit('jumped', this);
    }
    if (InputManager.released('jump') && b.velocity.y < 0 && this.springBoost <= 0) b.setVelocityY(b.velocity.y * PHYS.jumpCut);
    this.springBoost = Math.max(0, this.springBoost - dt);
    // atterrissage
    if (ground && !this.wasGround && this.lastVy > 260) { this.view.punch(1.28, 0.74); AudioManager.play('land'); this.scene.events.emit('landed', this, this.lastVy); }
    this.wasGround = ground; this.lastVy = b.velocity.y;
    // vue
    this.view.face = this.face;
    this.view.setPosition(this.rect.x, this.rect.y);
    this.view.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 14) % 2 ? 0.35 : 1);
    if (this.hurtT <= 0 && this.view.mood === 'hurt') this.view.mood = 'normal';
    this.view.tick(dt, { run: Math.abs(b.velocity.x) > 30, air: !ground, vy: b.velocity.y, speed: Math.abs(b.velocity.x) });
  }

  // un coup qui retire un cœur ; renvoie true si c'était le dernier
  hurt(fromX: number): boolean {
    if (this.invuln > 0 || this.dead) return false;
    this.hp--; this.invuln = INVULN; this.hurtT = 0.35; this.view.mood = 'hurt';
    this.body.setVelocity(Math.sign(this.x - fromX || 1) * 220, -320);
    AudioManager.play('hurt'); this.view.punch(1.3, 0.7);
    return this.hp <= 0;
  }
  bounce(v: number): void { this.body.setVelocityY(-v); this.springBoost = 0.25; this.coyote = 0; this.view.punch(0.7, 1.35); }
}
