import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { ensureCanvas } from '../art/textures';
import { paintFlowerHead, paintFlowerFace, PETALS } from '../menu/paintMenu';
import type { Trap, TrapContext } from './Trap';
import { tuning, TUNING } from '../core/Difficulty';

/**
 * Fleur indiscrète — mécanique signature du niveau 1-2.
 *
 * Règles (déterministes, toutes lisibles à l'écran) :
 *  1. OBSERVER : quand le joueur entre dans son champ de vision, la fleur ouvre les yeux et le suit.
 *     Son attention monte d'autant plus vite que le joueur est proche (pétales qui se resserrent,
 *     pollen aspiré vers le visage, petits reniflements).
 *  2. INSPIRER : attention pleine → la tête recule, la fleur inspire (0,65 s, son montant).
 *  3. ÉTERNUER : bourrasque dans une direction FIXE (gauche, droite ou haut), visible par la
 *     position de la tête. Tout ce qui est dans le souffle est propulsé.
 *  4. SONNÉE : quelques secondes les yeux en spirale. Elle ne voit plus rien : c'est la fenêtre.
 */
export type Blow = 'left' | 'right' | 'up';
export type FlowerSize = 'small' | 'normal' | 'giant';

export interface FlowerDef {
  x: number;
  groundY: number;
  blow: Blow;
  size?: FlowerSize;
  palette?: keyof typeof PETALS;
  /** Portée de vision (px depuis la tête). Par défaut : un peu plus que la portée du souffle. */
  view?: number;
  /** Portée du souffle. */
  reach?: number;
  stare?: number;   // s pour remplir l'attention à distance moyenne
  daze?: number;    // s sonnée après un éternuement
  power?: number;   // multiplicateur de la poussée
  /** Hauteur de la zone soufflée (fleurs latérales), par défaut 300. */
  height?: number;
  /**
   * SOURNOISE : si on saute pour esquiver, elle retient son éternuement (joues gonflées)
   * et attend qu'on retombe. Expert : elle retient plus longtemps et les sauts l'excitent.
   */
  sly?: boolean;
  /**
   * ASPIRANTE (piège inversé de la fleur) : au lieu d'éternuer, elle inspire longuement et attire
   * tout ce qui est devant elle. Au sol on peut résister ; en l'air, elle porte loin.
   */
  suck?: boolean;
  /** TIMIDE : se cache quand on la regarde ; ne se concentre que si on lui tourne le dos. */
  shy?: boolean;
  /** false : le souffle ne pousse pas le joueur (il ne gonfle qu'une voile ou une porte). */
  pushPlayer?: boolean;
  /** Champ de vision explicite (monde), à la place du champ par défaut. */
  watch?: { x: number; y: number; w: number; h: number };
  /** Bulle comique quand elle repousse le joueur (faux raccourci…). */
  quip?: string;
  /** Hauteur de la tête au-dessus du sol (par défaut selon la taille). */
  headY?: number;
  /** Timing indépendant de la difficulté (combos réglés au centième entre deux fleurs). */
  steady?: boolean;
}

type State = 'idle' | 'inhale' | 'hold' | 'sneeze' | 'dazed';

const SIZES: Record<FlowerSize, { headY: number; headScale: number; potW: number; potH: number; reach: number; power: number }> = {
  small: { headY: 96, headScale: 0.42, potW: 52, potH: 32, reach: 300, power: 0.62 },
  normal: { headY: 168, headScale: 0.6, potW: 72, potH: 44, reach: 460, power: 1 },
  giant: { headY: 132, headScale: 0.95, potW: 96, potH: 56, reach: 420, power: 1 }
};

const SNEEZE = 0.4;
const SUCK_TIME = 1.3;

export class Sneezer implements Trap {
  readonly id: string;
  readonly size: FlowerSize;
  readonly blow: Blow;
  /** Plateforme de la tête (fleur géante tournée vers le ciel). */
  readonly headZone?: Phaser.GameObjects.Zone;
  readonly potZone: Phaser.GameObjects.Zone;
  private head: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Image;
  private pupils: Phaser.GameObjects.Graphics;
  private stem: Phaser.GameObjects.Graphics;
  private pot: Phaser.GameObjects.Graphics;
  private wind: Phaser.GameObjects.Graphics;
  private gust: Phaser.GameObjects.Particles.ParticleEmitter;
  private pollen: Phaser.GameObjects.Particles.ParticleEmitter;
  state: State = 'idle';
  /** 0 → 1 : jauge d'attention (lisible : yeux, pétales, pollen, reniflements). */
  attention = 0;
  private t = 0;
  private time = 0;
  private launched = false;
  private sniffs = 0;
  private look = { x: 0, y: 0 };
  private readonly headX: number;
  private readonly headY: number;
  private readonly reach: number;
  private readonly view: number;
  private readonly stare: number;
  private readonly daze: number;
  private readonly power: number;
  private readonly baseScale: number;
  private readonly INHALE: number;
  private wasGrounded = true;
  private hidden = false;
  private quipped = false;
  /** Appelé à chaque éternuement (radeau à voile, porte volante…). */
  readonly onSneeze: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, readonly cfg: FlowerDef, index: number) {
    this.id = `flower-${index}`;
    this.size = cfg.size ?? 'normal';
    this.blow = cfg.blow;
    const S = SIZES[this.size];
    this.reach = cfg.reach ?? S.reach;
    this.view = cfg.view ?? this.reach + 80;
    const T = cfg.steady ? TUNING.easy : tuning();
    this.stare = (cfg.stare ?? (this.size === 'small' ? 0.9 : 1.15)) * T.flowerStare;
    this.INHALE = cfg.suck ? SUCK_TIME : T.flowerInhale;
    this.daze = cfg.daze ?? 2.6;
    this.power = (cfg.power ?? 1) * S.power;
    this.headX = cfg.x + (this.blow === 'right' ? 10 : this.blow === 'left' ? -10 : 0);
    this.headY = cfg.groundY - (cfg.headY ?? S.headY);
    this.baseScale = S.headScale;

    const pal = cfg.palette ?? 'peach';
    const headKey = ensureCanvas(scene, `fl-head-${pal}`, () => paintFlowerHead(PETALS[pal]));
    (['calm', 'inhale', 'sneeze', 'watch', 'dazed', 'shy', 'puff'] as const).forEach((k) => ensureCanvas(scene, `mf-face-${k}`, () => paintFlowerFace(k)));

    this.wind = scene.add.graphics().setDepth(DEPTH.fx - 1);
    this.stem = scene.add.graphics().setDepth(DEPTH.props);
    this.pot = scene.add.graphics().setDepth(DEPTH.props + 2);
    this.head = scene.add.image(this.headX, this.headY, headKey).setDepth(DEPTH.props + 1);
    this.face = scene.add.image(this.headX, this.headY, 'mf-face-calm').setDepth(DEPTH.props + 2);
    this.pupils = scene.add.graphics().setDepth(DEPTH.props + 3);

    this.drawPot(S.potW, S.potH);
    this.potZone = scene.add.zone(cfg.x, cfg.groundY - S.potH / 2, S.potW, S.potH);
    scene.physics.add.existing(this.potZone, true);

    if (this.blow === 'up') {
      // la corolle d'une fleur géante tournée vers le ciel est un plateau (traversable par en dessous)
      const w = this.size === 'small' ? 56 : 124;
      this.headZone = scene.add.zone(this.headX, this.headY - 6, w, 14);
      scene.physics.add.existing(this.headZone, true);
      const b = this.headZone.body as Phaser.Physics.Arcade.StaticBody;
      b.checkCollision.down = false;
      b.checkCollision.left = false;
      b.checkCollision.right = false;
    }

    const gustAngle = this.blow === 'right' ? { min: -16, max: 12 } : this.blow === 'left' ? { min: 168, max: 196 } : { min: 254, max: 286 };
    this.gust = scene.add.particles(0, 0, 'leaf', {
      emitting: false, lifespan: 900, speed: { min: 420, max: 820 }, angle: gustAngle, scale: { start: 0.42, end: 0.18 },
      rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, gravityY: 120
    }).setDepth(DEPTH.fx);
    // le pollen converge vers le visage de la fleur (elle "renifle" le joueur)
    this.pollen = scene.add.particles(0, 0, 'dot-warm', {
      emitting: false, lifespan: 600, moveToX: this.headX, moveToY: this.headY,
      scale: { start: 0.14, end: 0.04 }, alpha: { start: 0.9, end: 0.2 },
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(DEPTH.props + 4);
  }

  // ---------------------------------------------------------------- géométrie

  /** Zone balayée par le souffle. */
  gustRect(): Phaser.Geom.Rectangle {
    const g = this.cfg.groundY;
    if (this.blow === 'up') return new Phaser.Geom.Rectangle(this.headX - 66, this.headY - 6 - this.reach, 132, this.reach + 14);
    const h = this.cfg.height ?? 300;
    return this.blow === 'right'
      ? new Phaser.Geom.Rectangle(this.headX - 20, g - h, this.reach + 20, h + 16)
      : new Phaser.Geom.Rectangle(this.headX - this.reach, g - h, this.reach + 20, h + 16);
  }

  /** Champ de vision (là où l'attention monte). */
  private viewRect(): Phaser.Geom.Rectangle {
    const g = this.cfg.groundY;
    const w = this.cfg.watch;
    if (w) return new Phaser.Geom.Rectangle(w.x, w.y, w.w, w.h);
    if (this.blow === 'up') return new Phaser.Geom.Rectangle(this.headX - 70, this.headY - 120, 140, 130);
    const h = 360;
    return this.blow === 'right'
      ? new Phaser.Geom.Rectangle(this.headX - 10, g - h, this.view + 10, h + 20)
      : new Phaser.Geom.Rectangle(this.headX - this.view, g - h, this.view + 10, h + 20);
  }

  // ---------------------------------------------------------------- logique

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const p = ctx.player;
    const pb = p.body;
    const px = pb.x + pb.halfWidth, py = pb.y + pb.halfHeight;
    let seen = p.alive && Phaser.Geom.Rectangle.Contains(this.viewRect(), px, py);
    // un saut dans son champ : elle le remarque (la sournoise Expert s'en excite)
    const jumped = this.wasGrounded && !p.grounded && pb.velocity.y < -300;
    this.wasGrounded = p.grounded;

    // la timide ne se concentre que si on lui tourne le dos
    let shyNow = false;
    if (this.cfg.shy && seen) {
      const facingHer = (px < this.headX ? 1 : -1) === p.facing;
      if (facingHer) { seen = false; shyNow = true; }
    }
    if (this.cfg.shy && this.state === 'idle') {
      if (shyNow && !this.hidden && this.attention > 0.05) ctx.sfx('shy', this.headX);
      this.hidden = shyNow;
    }

    switch (this.state) {
      case 'idle': {
        if (seen) {
          const d = Phaser.Math.Distance.Between(this.headX, this.headY, px, py);
          const near = Phaser.Math.Clamp(1.5 - d / Math.max(1, this.view), 0.5, 1.5);
          this.attention = Math.min(1, this.attention + (dt / this.stare) * near);
          if (jumped && this.cfg.sly && tuning().id === 'expert') this.attention = Math.min(1, this.attention + 0.3);
        } else {
          this.attention = Math.max(0, this.attention - dt * (shyNow ? 2.2 : 0.9));
        }
        // petits reniflements : l'indice sonore que la fleur "monte"
        const step = Math.floor(this.attention * 3);
        if (step > this.sniffs && step < 3) {
          this.sniffs = step;
          ctx.sfx('sniff', this.headX, this.attention);
        } else if (step < this.sniffs) this.sniffs = step;
        if (this.attention >= 1) {
          this.go('inhale');
          ctx.sfx(this.cfg.suck ? 'suck' : 'sneezeIn', this.headX, 1);
        }
        break;
      }
      case 'inhale':
        if (this.cfg.suck) this.pull(ctx);
        if (this.t >= this.INHALE) {
          // la sournoise ne gaspille pas son éternuement sur un joueur en l'air
          if (this.cfg.sly && p.alive && !p.grounded && (seen || this.inGust(pb))) {
            this.go('hold');
            break;
          }
          this.release(ctx);
        }
        break;
      case 'hold':
        if ((p.grounded && this.t > 0.05) || !p.alive || this.t >= tuning().slyHold) this.release(ctx);
        break;
      case 'sneeze':
        // le souffle agit pendant ses premiers instants : on peut s'y jeter au dernier moment
        if (!this.launched && this.t < 0.16 && p.alive && this.inGust(pb) && this.cfg.pushPlayer !== false && !this.cfg.suck) {
          this.launched = true;
          this.push(ctx);
        }
        if (this.t >= SNEEZE) {
          // ratée : vexée (sauf l'aspirante, qui a fini de boire son air)
          if (!this.launched && !this.cfg.suck && this.cfg.pushPlayer !== false && p.alive && seen) {
            ctx.sfx('grumble', this.headX);
          }
          this.go('dazed');
          ctx.sfx('dazed', this.headX, 0.6);
        }
        break;
      case 'dazed':
        this.attention = 0;
        if (this.t >= this.daze) {
          this.go('idle');
          this.sniffs = 0;
          this.quipped = false;
        }
        break;
    }

    // regard : les pupilles suivent le joueur (ou le ciel pour la géante)
    const tx = Phaser.Math.Clamp((px - this.headX) / 120, -1, 1);
    const ty = Phaser.Math.Clamp((py - this.headY) / 120, -1, 1);
    const k = Math.min(1, dt * 8);
    this.look.x += ((seen ? tx : 0) - this.look.x) * k;
    this.look.y += ((seen ? ty : 0) - this.look.y) * k;
    this.render();
  }

  private release(ctx: TrapContext): void {
    this.go('sneeze');
    this.launched = false;
    if (this.cfg.suck) {
      ctx.sfx('bubble', this.headX); // "glup"
    } else {
      ctx.sfx('sneeze', this.headX, 1);
      this.burstGust();
    }
    for (const f of this.onSneeze) f();
  }

  /** Aspiration : courant d'air vers la fleur, plus fort en l'air (on peut toujours lutter au sol). */
  private pull(ctx: TrapContext): void {
    const p = ctx.player;
    if (!p.alive || !this.inGust(p.body)) return;
    const dir = this.blow === 'left' ? 1 : -1; // tournée vers la gauche → attire vers la droite
    const k = Math.min(1, this.t / 0.25);
    p.windX = dir * k * (p.grounded ? tuning().suckGround : 560);
    if (Math.random() < 0.25) ctx.burst('leaves', p.x - dir * 30, p.y - 10, 1);
  }

  private inGust(pb: Phaser.Physics.Arcade.Body): boolean {
    const r = this.gustRect();
    return pb.right > r.left && pb.left < r.right && pb.bottom > r.top && pb.top < r.bottom;
  }

  private push(ctx: TrapContext): void {
    const p = ctx.player;
    const pw = this.power;
    if (this.blow === 'up') {
      p.launch(p.body.velocity.x * 0.6, -1180 * pw, 0.22);
    } else {
      const dir = this.blow === 'right' ? 1 : -1;
      // plus on est près, plus ça pousse fort (lisible, et ça récompense le placement)
      const d = Math.abs(p.x - this.headX);
      const near = Phaser.Math.Clamp(1.25 - d / (this.reach * 1.4), 0.6, 1.15);
      p.launch(dir * 880 * pw * near, -380 * pw, 0.42);
    }
    ctx.burst('leaves', p.x, p.y, 6);
    if (this.cfg.quip && !this.quipped) {
      this.quipped = true;
      ctx.sfx('giggle', this.headX);
      this.say(this.cfg.quip);
    }
  }

  private say(text: string): void {
    const sc = this.scene;
    const label = sc.add.text(0, 0, text, { fontFamily: '"Fredoka", system-ui, sans-serif', fontSize: '19px', color: '#24306a', fontStyle: '600' }).setOrigin(0.5);
    const w = label.width + 26, h = label.height + 12;
    const g = sc.add.graphics();
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillTriangle(-6, h / 2 - 1, 8, h / 2 - 1, 2, h / 2 + 9);
    const W = sc.physics.world.bounds.width;
    const bx = Phaser.Math.Clamp(this.headX, w / 2 + 12, W - w / 2 - 12);
    const c = sc.add.container(bx, this.headY - 70, [g, label]).setDepth(DEPTH.fx).setScale(0);
    sc.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: c, alpha: 0, y: c.y - 14, delay: 1700, duration: 300, onComplete: () => c.destroy() });
  }

  private go(s: State): void {
    this.state = s;
    this.t = 0;
  }

  // ---------------------------------------------------------------- rendu

  private burstGust(): void {
    const dir = this.blow;
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 50, () => {
        const ox = dir === 'up' ? (Math.random() - 0.5) * 60 : 0;
        this.gust.explode(5, this.headX + ox, this.headY + (dir === 'up' ? -10 : (Math.random() - 0.5) * 40));
      });
    }
  }

  private render(): void {
    const up = this.blow === 'up';
    const sideDir = this.blow === 'left' ? -1 : 1;
    let dx = 0, dy = 0, ang = 0;
    let sc = 1 - this.attention * 0.1; // les pétales se resserrent quand elle se concentre
    let faceKey = this.attention > 0.08 ? 'mf-face-watch' : 'mf-face-calm';
    const s = this.state;
    if (s === 'inhale' && this.cfg.suck) {
      // aspire : la tête se penche EN AVANT, bouche ouverte
      const k = Math.min(1, this.t / 0.3);
      dx = sideDir * 10 * k + Math.sin(this.time * 30) * 1.5;
      ang = sideDir * 14 * k;
      sc = 1.04 + Math.sin(this.time * 9) * 0.03;
      faceKey = 'mf-face-inhale';
    } else if (s === 'inhale' || s === 'hold') {
      const k = s === 'hold' ? 1 : Phaser.Math.Easing.Sine.InOut(Math.min(1, this.t / this.INHALE));
      dx = -sideDir * 14 * k * (up ? 0 : 1);
      dy = up ? 10 * k : -8 * k;
      ang = up ? 0 : -sideDir * 20 * k;
      sc = 0.9 + 0.14 * k;
      faceKey = 'mf-face-inhale';
      if (s === 'hold') {
        // retient son souffle en guettant le joueur : joues gonflées, petite vibration
        sc = 1.06 + Math.sin(this.time * 26) * 0.025;
        faceKey = 'mf-face-puff';
      }
    } else if (s === 'sneeze' && this.cfg.suck) {
      sc = 1 - Math.min(1, this.t / 0.1) * 0.06;
      faceKey = 'mf-face-calm';
    } else if (s === 'sneeze') {
      const k = Math.min(1, this.t / 0.1);
      dx = up ? 0 : sideDir * 22 * k;
      dy = up ? -16 * k : 4 * k;
      ang = up ? 0 : sideDir * 24 * k;
      sc = 0.94;
      faceKey = 'mf-face-sneeze';
    } else if (s === 'dazed') {
      ang = Math.sin(this.time * 3) * 8;
      dy = 6;
      faceKey = 'mf-face-dazed';
    }
    if (s === 'idle' && this.hidden) {
      // timide : se détourne en rougissant
      faceKey = 'mf-face-shy';
      ang = -sideDir * 18;
      dx = -sideDir * 6;
    }
    const sway = s === 'idle' ? Math.sin(this.time * 1.4 + this.cfg.x) * 2 : 0;
    const hx = this.headX + dx + sway;
    const hy = this.headY + dy;
    const base = this.baseScale;
    if (up) {
      // corolle vue de profil : disque aplati, visage tourné vers le ciel
      this.head.setPosition(hx, hy).setScale(base * sc, base * 0.42 * sc).setAngle(sway * 0.4);
      this.face.setPosition(hx, hy - 2).setScale(base * 0.85, base * 0.4).setAngle(0);
    } else {
      this.head.setPosition(hx, hy).setScale(base * sc).setAngle(ang * 0.6 + sideDir * 6);
      this.face.setPosition(hx + sideDir * 4, hy).setScale(base * 0.9 * sc).setAngle(ang * 0.4);
    }
    this.face.setTexture(faceKey);

    // pupilles (seulement quand elle observe)
    const g = this.pupils;
    g.clear();
    if (faceKey === 'mf-face-watch') {
      const fs = this.face.scaleX, fsy = this.face.scaleY;
      const ex = 13 * fs, ey = -6 * fsy;
      // la géante "louche" vers le haut quand on est sur sa tête
      const lx = up ? 0 : this.look.x * 4 * fs;
      const ly = up ? -4.5 * fsy : this.look.y * 4 * fsy;
      const rad = 3.8 * fs;
      g.fillStyle(0x24306a, 1);
      g.fillCircle(this.face.x - ex + lx + (up ? 2 * fs : 0), this.face.y + ey + ly, rad);
      g.fillCircle(this.face.x + ex + lx - (up ? 2 * fs : 0), this.face.y + ey + ly, rad);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(this.face.x - ex + lx - rad * 0.3, this.face.y + ey + ly - rad * 0.35, rad * 0.35);
      g.fillCircle(this.face.x + ex + lx - rad * 0.3, this.face.y + ey + ly - rad * 0.35, rad * 0.35);
    }

    // pollen aspiré vers le visage, plus dense quand l'attention monte
    if (s === 'idle' && this.attention > 0.25 && Math.random() < this.attention * 0.5) {
      const a = Math.random() * Math.PI * 2;
      const r = 50 + Math.random() * 30;
      const ox = Math.cos(a) * r, oy = Math.sin(a) * r * (up ? 0.4 : 1);
      this.pollen.explode(1, hx + ox, hy + oy);
    }

    this.drawStem(hx, hy, up);
    this.drawWind();
  }

  private drawStem(hx: number, hy: number, up: boolean): void {
    const g = this.stem;
    g.clear();
    const x0 = this.cfg.x, y0 = this.cfg.groundY - SIZES[this.size].potH + 4;
    const thick = this.size === 'giant' ? 14 : this.size === 'small' ? 6 : 10;
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2(x0 - 10, y0 - (y0 - hy) * 0.4),
      new Phaser.Math.Vector2(hx + (up ? 8 : -12), hy + (y0 - hy) * 0.45),
      new Phaser.Math.Vector2(hx, hy + (up ? 4 : 18 * this.baseScale))
    );
    g.lineStyle(thick, 0x4e7a62, 1);
    curve.draw(g, 24);
    g.lineStyle(Math.max(2, thick * 0.3), 0x9cc59a, 0.85);
    curve.draw(g, 24);
    // feuilles le long de la tige
    const leaf = (t: number, side: number, len: number) => {
      const p = curve.getPoint(t);
      const pts: Phaser.Math.Vector2[] = [];
      const a = side < 0 ? Math.PI + 0.5 : -0.5;
      for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new Phaser.Math.Vector2(u * len, -Math.sin(u * Math.PI) * len * 0.28)); }
      for (let i = 8; i >= 0; i--) { const u = i / 8; pts.push(new Phaser.Math.Vector2(u * len, Math.sin(u * Math.PI) * len * 0.22)); }
      const c = Math.cos(a), sn = Math.sin(a);
      g.fillStyle(side < 0 ? 0x5e9a70 : 0x6fae7a, 1);
      g.fillPoints(pts.map((v) => new Phaser.Math.Vector2(p.x + v.x * c - v.y * sn, p.y + v.x * sn + v.y * c)), true);
    };
    const ls = this.size === 'giant' ? 62 : this.size === 'small' ? 26 : 44;
    leaf(0.35, -1, ls);
    leaf(0.6, 1, ls * 0.85);
  }

  private drawPot(w: number, h: number): void {
    const g = this.pot;
    const x = this.cfg.x, gy = this.cfg.groundY;
    g.fillStyle(0x1e2a24, 0.18);
    g.fillEllipse(x, gy + 2, w * 1.1, 10);
    g.fillStyle(0xa8604a, 1);
    g.fillPoints([
      new Phaser.Math.Vector2(x - w / 2, gy - h + 8), new Phaser.Math.Vector2(x + w / 2, gy - h + 8),
      new Phaser.Math.Vector2(x + w * 0.38, gy), new Phaser.Math.Vector2(x - w * 0.38, gy)
    ], true);
    g.fillStyle(0xd48a6a, 1);
    g.fillPoints([
      new Phaser.Math.Vector2(x - w / 2, gy - h + 8), new Phaser.Math.Vector2(x + w * 0.1, gy - h + 8),
      new Phaser.Math.Vector2(x - w * 0.05, gy), new Phaser.Math.Vector2(x - w * 0.38, gy)
    ], true);
    g.fillStyle(0xe9a07a, 1);
    g.fillRoundedRect(x - w / 2 - 5, gy - h, w + 10, 13, 5);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(x - w / 2 - 2, gy - h + 2, w + 4, 3);
    // motif : petite bande turquoise (signe de la serre)
    g.fillStyle(0x7fd1c7, 0.8);
    g.fillRect(x - w * 0.33, gy - h * 0.45, w * 0.66, 3);
  }

  /** Traits de vent pendant l'éternuement : montrent exactement la zone soufflée. */
  private drawWind(): void {
    const g = this.wind;
    g.clear();
    if (this.cfg.suck) {
      if (this.state !== 'inhale') return;
      // traits d'air qui convergent vers la bouche
      const r = this.gustRect();
      const dir = this.blow === 'left' ? -1 : 1;
      g.lineStyle(3, 0xffffff, 0.45);
      for (let i = 0; i < 5; i++) {
        const ph = ((this.time * 1.6 + i * 0.2) % 1);
        const x0 = this.headX + dir * (r.width * (1 - ph));
        const y = this.headY - 40 + i * 24 + (this.headY - (this.headY - 40 + i * 24)) * ph * 0.6;
        g.lineBetween(x0, y, x0 - dir * (50 - ph * 30), y);
      }
      return;
    }
    if (this.state !== 'sneeze') return;
    const k = this.t / SNEEZE;
    const a = 0.55 * (1 - k);
    const r = this.gustRect();
    g.lineStyle(3, 0xffffff, a);
    for (let i = 0; i < 5; i++) {
      if (this.blow === 'up') {
        const x = r.x + 14 + i * ((r.width - 28) / 4);
        const y0 = this.headY - 10 - k * r.height * 0.8;
        g.lineBetween(x, y0, x, y0 - 50 - i * 8);
      } else {
        const y = this.headY - 30 + i * 26;
        const dir = this.blow === 'right' ? 1 : -1;
        const x0 = this.headX + dir * (30 + k * r.width * 0.75);
        g.lineBetween(x0, y, x0 + dir * (60 + i * 10), y);
      }
    }
  }

  reset(): void {
    this.state = 'idle';
    this.t = 0;
    this.attention = 0;
    this.sniffs = 0;
    this.launched = false;
    this.hidden = false;
    this.quipped = false;
  }

  destroy(): void {
    [this.head, this.face, this.pupils, this.stem, this.pot, this.wind, this.gust, this.pollen, this.potZone].forEach((o) => o.destroy());
    this.headZone?.destroy();
  }
}
