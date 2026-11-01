import Phaser from 'phaser';
import { LOOK2 } from '../core/Look';
import { PHYSICS, HERO, DEPTH } from '../core/constants';
import type { Controls } from '../core/Controls';

export type Expression = 'smile' | 'open' | 'worried' | 'grin' | 'flat';

interface ScarfPoint { x: number; y: number; px: number; py: number }

/**
 * Le héros : un corps physique invisible (Zone Arcade) + un "rig" visuel animé
 * procéduralement (squash & stretch, pieds, yeux, écharpe simulée).
 * Le visuel ne modifie jamais la hitbox : les déformations restent cosmétiques.
 */
export class Player {
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;

  // rig
  private rig: Phaser.GameObjects.Container;
  private bodyImg: Phaser.GameObjects.Image;
  private faceImg: Phaser.GameObjects.Image;
  private eyeL: Phaser.GameObjects.Image;
  private eyeR: Phaser.GameObjects.Image;
  private mouth: Phaser.GameObjects.Image;
  private band: Phaser.GameObjects.Image;
  private footL: Phaser.GameObjects.Image;
  private footR: Phaser.GameObjects.Image;
  private handL: Phaser.GameObjects.Image;
  private handR: Phaser.GameObjects.Image;
  private scarfGfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private scarf: ScarfPoint[][] = [];

  facing: 1 | -1 = 1;
  grounded = false;
  alive = true;
  frozen = false; // cinématiques (victoire, mort)
  airTime = 0;
  stillTime = 0;
  /** Échelle d'affichage (écran d'accueil). N'affecte jamais la hitbox. */
  visualScale = 1;
  /** Vitesse de marche relative (écran d'accueil : flânerie). Jamais modifiée en jeu. */
  speedScale = 1;
  private halo?: Phaser.GameObjects.Image;
  /** Temps restant d'une propulsion extérieure (bourrasque). */
  private launchT = 0;
  /**
   * Courant d'air extérieur (px/s), posé à chaque frame par un piège (fleur aspirante).
   * Il s'ajoute à la vitesse visée : on dérive si on ne fait rien, on peut toujours lutter.
   */
  windX = 0;
  private nearMissAt = -10;

  private lastGroundedAt = -1000;
  private jumpBufferedAt = -1000;
  private jumping = false;
  private time = 0;
  private runPhase = 0;
  private squash = 0; // >0 écrasé, <0 étiré
  private squashVel = 0;
  private blinkTimer = 2;
  private blinkT = 0;
  private exprOverride: { e: Expression; until: number } | null = null;
  private lookY = 0;
  private stepTimer = 0;
  private lean = 0;

  onJump?: () => void;
  onLand?: (impact: number) => void;
  onStep?: () => void;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.zone = scene.add.zone(x, y, PHYSICS.bodyW, PHYSICS.bodyH);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setMaxVelocityY(PHYSICS.maxFall);
    this.body.setCollideWorldBounds(true);

    this.shadow = scene.add.ellipse(x, y, 40, 9, 0x1e2a24, LOOK2 ? 0.34 : 0.22).setDepth(DEPTH.player - 1);
    // [maquette v2] halo doux derrière le héros : il se détache toujours du décor
    if (LOOK2 && scene.textures.exists('dot-warm')) {
      this.halo = scene.add.image(x, y, 'dot-warm').setScale(2.6).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.player - 2);
    }
    this.scarfGfx = scene.add.graphics().setDepth(DEPTH.player - 0.5);

    const s = 0.5;
    this.footL = scene.add.image(-9, 25, 'hero-foot').setScale(s);
    this.footR = scene.add.image(9, 25, 'hero-foot').setScale(s);
    this.bodyImg = scene.add.image(0, -4, 'hero-body').setScale(s);
    this.band = scene.add.image(0, 10, 'hero-scarf-band').setScale(s);
    this.faceImg = scene.add.image(4, -12, 'hero-face').setScale(s);
    this.eyeL = scene.add.image(-4, -15, 'hero-eye').setScale(s);
    this.eyeR = scene.add.image(10, -15, 'hero-eye').setScale(s);
    this.mouth = scene.add.image(4, -4, 'mouth-smile').setScale(s);
    this.handL = scene.add.image(-24, 6, 'hero-hand').setScale(s).setVisible(false);
    this.handR = scene.add.image(24, 6, 'hero-hand').setScale(s).setVisible(false);

    this.rig = scene.add.container(x, y, [
      this.footL, this.footR, this.bodyImg, this.band, this.faceImg,
      this.eyeL, this.eyeR, this.mouth, this.handL, this.handR
    ]).setDepth(DEPTH.player);

    for (let t = 0; t < 2; t++) {
      const chain: ScarfPoint[] = [];
      for (let i = 0; i < 6; i++) chain.push({ x, y, px: x, py: y });
      this.scarf.push(chain);
    }
  }

  get x(): number { return this.zone.x; }
  get y(): number { return this.zone.y; }
  get bottom(): number { return this.body.bottom; }

  teleport(x: number, y: number): void {
    this.body.reset(x, y);
    this.zone.setPosition(x, y);
    this.rig.setPosition(x, y);
    for (const chain of this.scarf) for (const p of chain) { p.x = p.px = x; p.y = p.py = y; }
    this.airTime = 0;
    this.stillTime = 0;
    this.lastGroundedAt = -1000;
    this.jumpBufferedAt = -1000;
    this.jumping = false;
  }

  setExpression(e: Expression, durationMs: number): void {
    this.exprOverride = { e, until: this.time + durationMs / 1000 };
  }

  setVisible(v: boolean): void {
    this.rig.setVisible(v);
    this.scarfGfx.setVisible(v);
    this.shadow.setVisible(v);
  }

  get rigContainer(): Phaser.GameObjects.Container { return this.rig; }

  // ----------------------------------------------------------- contrôle

  update(dtMs: number, c: Controls): void {
    const dt = Math.min(dtMs, 50) / 1000;
    this.time += dt;
    const b = this.body;

    const wasGrounded = this.grounded;
    this.grounded = b.blocked.down || b.touching.down;
    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.08) {
        const impact = Phaser.Math.Clamp(this.lastFallSpeed / PHYSICS.maxFall, 0.2, 1);
        this.squashVel = 6 + impact * 10;
        this.onLand?.(impact);
      }
      this.lastGroundedAt = this.time;
      this.airTime = 0;
      this.jumping = false;
    } else {
      this.airTime += dt;
    }

    if (this.alive && !this.frozen) {
      // ---- horizontal
      const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      const vx = b.velocity.x;
      const wind = this.windX;
      let target = dir * PHYSICS.runSpeed * this.speedScale + wind;
      let accel: number;
      if (this.launchT > 0) this.launchT -= dt;
      const launched = this.launchT > 0;
      if (dir !== 0) {
        accel = this.grounded ? PHYSICS.groundAccel : PHYSICS.airAccel;
        if (Math.sign(vx) !== dir && Math.abs(vx) > 10) accel *= PHYSICS.turnBoost;
        if (launched) accel *= 0.35; // propulsé : on garde un peu de contrôle, pas tout
        this.facing = dir as 1 | -1;
      } else {
        target = wind;
        accel = this.grounded ? PHYSICS.groundDecel : PHYSICS.airDecel;
        if (wind !== 0) accel = this.grounded ? PHYSICS.groundAccel * 0.5 : PHYSICS.airAccel;
        if (launched) accel = 0;
      }
      // en l'air, une poussée extérieure (bourrasque) n'est pas freinée si on va dans son sens
      const keepMomentum = !this.grounded && Math.abs(vx) > Math.abs(target) && (dir === 0 ? launched : Math.sign(vx) === dir);
      if (!keepMomentum) b.setVelocityX(approach(vx, target, accel * dt));

      // ---- saut (coyote time + buffer + hauteur variable)
      if (c.jumpPressed) this.jumpBufferedAt = this.time;
      const canCoyote = this.time - this.lastGroundedAt <= PHYSICS.coyoteMs / 1000;
      const buffered = this.time - this.jumpBufferedAt <= PHYSICS.jumpBufferMs / 1000;
      if (buffered && (this.grounded || canCoyote) && !this.jumping) {
        b.setVelocityY(-PHYSICS.jumpVelocity);
        this.jumping = true;
        this.grounded = false;
        this.lastGroundedAt = -1000;
        this.jumpBufferedAt = -1000;
        this.squashVel = -14;
        this.onJump?.();
      }
      if (this.jumping && !c.jumpHeld && b.velocity.y < 0) {
        b.setVelocityY(b.velocity.y * PHYSICS.jumpCutFactor);
        this.jumping = false;
      }
    } else if (this.frozen && this.grounded) {
      b.setVelocityX(approach(b.velocity.x, 0, PHYSICS.groundDecel * dt));
    }

    // gravité modulée : flottement à l'apex quand on maintient le saut
    const apex = Math.abs(b.velocity.y) < PHYSICS.apexThreshold && !this.grounded && c.jumpHeld;
    b.setGravityY(apex ? -PHYSICS.gravity * (1 - PHYSICS.apexGravityScale) : 0);

    if (b.velocity.y > 0) this.lastFallSpeed = b.velocity.y;

    // immobilité (utilisée par les pavés "trop polis")
    if (this.grounded && Math.abs(b.velocity.x) < 40) this.stillTime += dt;
    else this.stillTime = 0;

    this.windX = 0; // consommé : le piège le reposera s'il souffle encore
    this.animate(dt);
  }

  private lastFallSpeed = 0;

  // ----------------------------------------------------------- animation

  private animate(dt: number): void {
    const b = this.body;
    const vx = b.velocity.x;
    const vy = b.velocity.y;
    const speed = Math.abs(vx) / PHYSICS.runSpeed;

    // Le visuel suit le corps physique de CETTE image (la zone n'est synchronisée qu'après la scène :
    // la suivre donnait un décalage d'une image, source de tremblement avec la caméra).
    const bx = b.x + b.halfWidth;
    const by = b.y + b.halfHeight;
    const vs = this.visualScale;
    this.rig.setPosition(bx, by - (PHYSICS.bodyH / 2) * (vs - 1));

    // ressort du squash & stretch
    const k = 220, damp = 16;
    this.squashVel += (-k * this.squash - damp * this.squashVel) * dt;
    this.squash += this.squashVel * dt;
    let stretch = this.squash * 0.02;
    if (!this.grounded) stretch += Phaser.Math.Clamp(-vy / 3000, -0.12, 0.12);
    const breathe = this.grounded && speed < 0.1 ? Math.sin(this.time * 3.2) * 0.025 : 0;
    const sx = 1 + stretch * 0.9 - breathe * 0.5;
    const sy = 1 - stretch + breathe;

    // inclinaison dans la course
    const targetLean = this.grounded ? (vx / PHYSICS.runSpeed) * 0.12 : (vx / PHYSICS.runSpeed) * 0.06;
    this.lean = Phaser.Math.Linear(this.lean, targetLean, Math.min(1, dt * 12));

    // cycle de course
    let bob = 0;
    if (this.grounded && speed > 0.08) {
      this.runPhase += dt * (8 + speed * 10);
      bob = -Math.abs(Math.sin(this.runPhase)) * 3 * speed;
      this.stepTimer -= dt;
      if (Math.sin(this.runPhase) * Math.sin(this.runPhase - dt * 18) < 0 && this.stepTimer <= 0) {
        this.onStep?.();
        this.stepTimer = 0.12;
      }
    } else {
      this.runPhase = Phaser.Math.Linear(this.runPhase, Math.round(this.runPhase / Math.PI) * Math.PI, dt * 10);
    }

    const f = this.facing;
    const parts = [this.bodyImg, this.band, this.faceImg, this.eyeL, this.eyeR, this.mouth];
    // pieds
    if (this.grounded) {
      const sw = Math.sin(this.runPhase) * 8 * Math.min(1, speed * 1.4);
      const lift = Math.max(0, Math.cos(this.runPhase)) * 4 * speed;
      const lift2 = Math.max(0, -Math.cos(this.runPhase)) * 4 * speed;
      this.footL.setPosition(-9 + sw * f, 25 - lift);
      this.footR.setPosition(9 - sw * f, 25 - lift2);
    } else {
      const tuck = vy < 0 ? 4 : -2;
      this.footL.setPosition(-10 - f * 2, 22 - tuck);
      this.footR.setPosition(10 - f * 2, 20 - tuck);
    }

    this.bodyImg.setPosition(0, -4 + bob);
    this.band.setPosition(0, 10 + bob);
    this.faceImg.setPosition(5 * f, -13 + bob);

    // regard : direction + suit la verticale
    this.lookY = Phaser.Math.Linear(this.lookY, Phaser.Math.Clamp(vy / 300, -3, 4), dt * 8);
    const ex = 5 * f + 2 * f * speed;
    this.eyeL.setPosition(ex - 8, -16 + bob + this.lookY);
    this.eyeR.setPosition(ex + 7, -16 + bob + this.lookY);
    this.mouth.setPosition(5 * f + 2 * f * speed, -4 + bob + this.lookY * 0.5);

    // clignement
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkT = 0.13;
      this.blinkTimer = 2 + Math.random() * 3;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    const eyeScaleY = this.blinkT > 0 ? 0.08 : 0.5;

    // expression
    let expr: Expression = 'smile';
    if (!this.grounded && vy > 520) expr = 'worried';
    else if (!this.grounded && vy < -200) expr = 'grin';
    else if (speed > 0.75) expr = 'grin';
    if (this.exprOverride && this.time < this.exprOverride.until) expr = this.exprOverride.e;
    if (this.alive && this.eyeL.texture.key === 'hero-eye') {
      this.eyeL.setScale(0.5, eyeScaleY);
      this.eyeR.setScale(0.5, eyeScaleY);
    }
    if (this.alive) this.mouth.setTexture('mouth-' + expr);

    this.rig.setScale(sx * vs, sy * vs);
    this.rig.setRotation(this.lean);
    void parts;

    // ombre au sol
    this.shadow.setPosition(bx, by + PHYSICS.bodyH / 2 + 1);
    this.halo?.setPosition(bx, by - 4).setVisible(this.rig.visible);
    this.shadow.setVisible(this.grounded && this.rig.visible);
    this.shadow.setScale((1 - Math.abs(this.squash) * 0.01) * vs, vs);

    this.updateScarf(dt);
  }

  private updateScarf(dt: number): void {
    const g = this.scarfGfx;
    g.clear();
    if (!this.rig.visible) return;
    const b = this.body;
    const f = this.facing;
    const anchorX = this.rig.x - f * 22 * this.rig.scaleX;
    const anchorY = this.rig.y + (14 + this.bodyImg.y) * this.rig.scaleY;
    const vs = this.visualScale;
    const seg = 5.2 * vs;
    const gravity = 520;
    const wind = Math.sin(this.time * 2.3) * 30;

    this.scarf.forEach((chain, ci) => {
      chain[0].x = anchorX;
      chain[0].y = anchorY + ci * 3;
      for (let i = 1; i < chain.length; i++) {
        const p = chain[i];
        const vx = (p.x - p.px) * 0.94;
        const vy = (p.y - p.py) * 0.94;
        p.px = p.x;
        p.py = p.y;
        p.x += vx + (-b.velocity.x * 0.5 + wind - f * 40) * dt * dt * 6;
        p.y += vy + (gravity - b.velocity.y * 0.3) * dt * dt;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < chain.length; i++) {
          const a = chain[i - 1], p = chain[i];
          const dx = p.x - a.x, dy = p.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const len = seg * (ci === 0 ? 1 : 0.8);
          const diff = (d - len) / d;
          if (i === 1) { p.x -= dx * diff; p.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; p.x -= dx * diff * 0.5; p.y -= dy * diff * 0.5; }
        }
        chain[0].x = anchorX; chain[0].y = anchorY + ci * 3;
      }

      // ruban effilé
      const left: Phaser.Types.Math.Vector2Like[] = [];
      const right: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < chain.length; i++) {
        const p = chain[i];
        const q = chain[Math.min(chain.length - 1, i + 1)];
        const o = chain[Math.max(0, i - 1)];
        const ang = Math.atan2(q.y - o.y, q.x - o.x) + Math.PI / 2;
        const w = ((1 - i / chain.length) * 3.5 + 3) * vs;
        left.push({ x: p.x + Math.cos(ang) * w, y: p.y + Math.sin(ang) * w });
        right.push({ x: p.x - Math.cos(ang) * w, y: p.y - Math.sin(ang) * w });
      }
      const pts = left.concat(right.reverse());
      g.fillStyle(ci === 0 ? HERO.scarf : HERO.scarfShade, 1);
      g.fillPoints(pts as Phaser.Math.Vector2[], true);
      // franges
      const end = chain[chain.length - 1];
      g.fillStyle(0xffd6a8, 0.9);
      g.fillCircle(end.x, end.y, 2.2 * vs);
    });
  }

  // ----------------------------------------------------------- mises en scène

  /** Animation de mort. Retourne la durée en ms. */
  playDeath(kind: 'prick' | 'chomp' | 'fall'): number {
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.enable = false;
    const scene = this.scene;
    this.eyeL.setTexture('hero-eye-x').setScale(0.5);
    this.eyeR.setTexture('hero-eye-x').setScale(0.5);
    this.mouth.setTexture('mouth-open');

    if (kind === 'chomp') {
      this.setVisible(false);
      return 900;
    }
    if (kind === 'fall') {
      scene.tweens.add({ targets: this.rig, alpha: 0, duration: 300 });
      return 450;
    }
    // piqué : bond vertical comique, vrille, puis chute
    this.handL.setVisible(true).setPosition(-26, -8);
    this.handR.setVisible(true).setPosition(26, -8);
    const startY = this.rig.y;
    scene.tweens.add({
      targets: this.rig,
      y: startY - 110,
      scaleX: 1.15,
      scaleY: 0.9,
      angle: 360 * (this.facing === 1 ? -1 : 1),
      duration: 380,
      ease: 'Quad.easeOut',
      onUpdate: () => this.updateScarf(1 / 60)
    });
    scene.tweens.add({
      targets: this.rig,
      y: startY + 160,
      delay: 380,
      duration: 380,
      ease: 'Quad.easeIn',
      onUpdate: () => this.updateScarf(1 / 60)
    });
    return 820;
  }

  revive(x: number, y: number): void {
    this.launchT = 0;
    this.alive = true;
    this.frozen = false;
    this.body.enable = true;
    this.body.setAllowGravity(true);
    this.teleport(x, y);
    this.rig.setAlpha(1).setAngle(0);
    this.setVisible(true);
    this.handL.setVisible(false);
    this.handR.setVisible(false);
    this.eyeL.setTexture('hero-eye');
    this.eyeR.setTexture('hero-eye');
    this.rig.setScale(0.2, 1.6);
    this.squash = 0;
    this.squashVel = 18;
    this.setExpression('open', 400);
  }

  /**
   * Propulsion par un élément du décor (éternuement d'une fleur).
   * `lock` : durée pendant laquelle la poussée n'est ni freinée ni annulée par les commandes.
   */
  launch(vx: number, vy: number, lock: number): void {
    if (!this.alive) return;
    const b = this.body;
    b.setVelocity(vx, vy);
    this.launchT = lock;
    this.jumping = false;
    this.grounded = false;
    this.lastGroundedAt = -1000;
    this.squashVel = -16;
    this.setExpression('open', 700);
  }

  /** Petit salut de la main (écran d'accueil). */
  wave(): void {
    const f = this.facing;
    const h = f === 1 ? this.handR : this.handL;
    const hx = 25 * f;
    h.setVisible(true).setPosition(hx, -4).setAngle(0);
    this.setExpression('grin', 1300);
    this.happyEyes(1200);
    this.scene.tweens.add({
      targets: h, y: -30, angle: { from: -20 * f, to: 20 * f }, duration: 150, yoyo: true, repeat: 3,
      ease: 'Sine.easeInOut', onComplete: () => h.setVisible(false)
    });
  }

  /** Sursaut de surprise : mains en l'air, yeux ronds. */
  startle(): void {
    this.setExpression('open', 1000);
    this.squashVel = -18;
    for (const [h, x] of [[this.handL, -27], [this.handR, 27]] as const) {
      h.setVisible(true).setPosition(x, 4);
      this.scene.tweens.add({ targets: h, y: -26, duration: 110, yoyo: true, hold: 420, ease: 'Back.easeOut', onComplete: () => h.setVisible(false) });
    }
  }

  /**
   * Frôlé par un piège : goutte de sueur, mine inquiète puis soulagée.
   * Retourne false si la réaction est encore en cours (évite le spam).
   */
  nearMiss(): boolean {
    if (!this.alive || this.time - this.nearMissAt < 1.6) return false;
    this.nearMissAt = this.time;
    this.setExpression('worried', 450);
    this.scene.time.delayedCall(450, () => { if (this.alive) this.setExpression('grin', 600); });
    const drop = this.scene.add.graphics();
    drop.fillStyle(0xbfe8ff, 1);
    drop.fillCircle(0, 0, 4);
    drop.fillTriangle(-4, -1, 4, -1, 0, -9);
    drop.fillStyle(0xffffff, 0.9);
    drop.fillCircle(-1.2, -1, 1.3);
    drop.setPosition(17, -30);
    this.rig.add(drop);
    this.scene.tweens.add({
      targets: drop, x: 24, y: -6, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Quad.easeIn',
      onComplete: () => drop.destroy()
    });
    return true;
  }

  /** Yeux rieurs pendant un moment. */
  happyEyes(ms: number): void {
    if (!this.alive) return;
    this.eyeL.setTexture('hero-eye-happy').setScale(0.5);
    this.eyeR.setTexture('hero-eye-happy').setScale(0.5);
    this.scene.time.delayedCall(ms, () => {
      if (!this.alive || !this.eyeL.active) return;
      this.eyeL.setTexture('hero-eye');
      this.eyeR.setTexture('hero-eye');
    });
  }

  celebrate(): void {
    this.frozen = true;
    this.handL.setVisible(true);
    this.handR.setVisible(true);
    this.eyeL.setTexture('hero-eye-happy').setScale(0.5);
    this.eyeR.setTexture('hero-eye-happy').setScale(0.5);
    this.mouth.setTexture('mouth-grin');
    this.exprOverride = { e: 'grin', until: this.time + 999 };
    this.scene.tweens.add({ targets: this.handL, y: -30, x: -24, duration: 160, yoyo: true, repeat: 3 });
    this.scene.tweens.add({ targets: this.handR, y: -30, x: 24, duration: 160, yoyo: true, repeat: 3, delay: 80 });
    this.body.setVelocityY(-420);
  }

  destroy(): void {
    this.rig.destroy();
    this.scarfGfx.destroy();
    this.shadow.destroy();
    this.halo?.destroy();
    this.zone.destroy();
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}
