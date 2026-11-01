import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { Audio } from '../core/Audio';
import { ensureCanvas } from '../art/textures';
import type { Trap, TrapContext } from '../traps/Trap';
import { paintPumpkin, paintCrown, paintCurtain, paintThrone, paintChandelier, paintGrate } from './art';
import { addFlame, drawCarvedFace, MDEPTH } from './ManorBackdrop';
import { type Kit, staticZone, movingZone, setBodyEnabled, standingOn, hits, hitsCircle, say } from './kit';

export interface ArenaLayout {
  x0: number; x1: number; floorY: number; bossX: number;
  crack: number;
  shadow: { x: number; top: number; w: number }[];
  ledge: { x: number; top: number; w: number }; lever: number;
  dais: { x: number; top: number; w: number };
  exitGate: number; exitLever: number;
}

const SW0 = 1.15, SW1 = 1.95;

type Phase = 'asleep' | 'wake' | 'p1' | 'p2' | 'p3' | 'defeat' | 'done';

interface Minion { x: number; vx: number; r: number; bounced: boolean; c: Phaser.GameObjects.Container; face: Phaser.GameObjects.Graphics; alive: boolean }

/**
 * MINI-BOSS — LE ROI CITROUILLE. On le bat avec ses propres attaques.
 *  Phase 1 : citrouilles roulantes (on saute) + coup de tige vertical qui vise le héros.
 *            Attirer le coup sur la dalle fissurée révèle un mécanisme : l'activer retire les ronces.
 *  Phase 2 : il éteint la lumière ; des plateformes d'ombre apparaissent. Son regard balaie la salle
 *            (annoncé) et les dissout. En haut, un levier fait tomber le lustre (annoncé) : adieu couronne.
 *  Phase 3 : il panique et bondit sur le héros (cible et zone d'impact affichées). L'attirer sur l'estrade
 *            du trône : l'impact décroche le grand rideau. Sa tête roule… et ouvre la sortie.
 * Facile : attaques espacées, annonces longues. Expert : enchaînements et combinaisons, toujours annoncés.
 */
export class PumpkinKing implements Trap {
  readonly id = 'h-boss';
  phase: Phase = 'asleep';
  private st = '';
  private t = 0;
  private time = 0;
  private x: number;
  private y: number;
  private readonly R = 140;
  private body: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Graphics;
  private crown: Phaser.GameObjects.Image;
  private vines: Phaser.GameObjects.Graphics;
  private stalk: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private beam: Phaser.GameObjects.Graphics;
  private crackG: Phaser.GameObjects.Graphics;
  private shadowG: Phaser.GameObjects.Graphics;
  private leverG: Phaser.GameObjects.Graphics;
  private chand: Phaser.GameObjects.Image;
  private curtain: Phaser.GameObjects.Image;
  private head?: Phaser.GameObjects.Container;
  private gate: Phaser.GameObjects.Image;
  private gateZone: Phaser.GameObjects.Zone;
  private shadowZones: Phaser.GameObjects.Zone[] = [];
  private shadowLit: boolean[] = [];
  private minions: Minion[] = [];
  private mood: 'grin' | 'angry' | 'oops' | 'panic' | 'dizzy' = 'grin';
  // état des mécanismes
  crackBroken = false;
  gearDone = false;
  crownOn = true;
  private gearT = 0;
  private aimX = 0;
  private locked = false;
  private slams = 0;
  private hops = 0;
  private beamA = 0;
  private beamDir = 1;
  private beamOn = false;
  private leverPulled = false;
  private hopFrom = { x: 0, y: 0 };
  private hopTo = { x: 0, y: 0 };
  private bossDepth = DEPTH.backProps + 3;

  constructor(private k: Kit, private A: ArenaLayout) {
    const sc = k.scene;
    this.x = A.bossX;
    this.y = A.floorY;
    // trône, rideau et estrade
    sc.add.image(A.dais.x + A.dais.w / 2, A.dais.top + 2, ensureCanvas(sc, 'mn-throne', () => paintThrone(160, 240))).setOrigin(0.5, 1).setDepth(DEPTH.backProps + 1);
    const rod = sc.add.graphics().setDepth(DEPTH.backProps + 2);
    rod.fillStyle(0xd9a23a, 1);
    rod.fillRect(A.dais.x - 40, 108, A.dais.w + 80, 8);
    this.curtain = sc.add.image(A.dais.x + A.dais.w / 2, 112, ensureCanvas(sc, 'mn-curtain', () => paintCurtain(A.dais.w + 60, 200))).setOrigin(0.5, 0).setDepth(DEPTH.backProps + 2);
    staticZone(k, A.dais.x, A.dais.top, A.dais.w, A.floorY - A.dais.top);
    const dg = sc.add.graphics().setDepth(DEPTH.terrain + 1);
    dg.fillStyle(0x5a1a34, 1);
    dg.fillRect(A.dais.x - 8, A.dais.top, A.dais.w + 16, A.floorY - A.dais.top);
    dg.fillStyle(0xd9a23a, 1);
    dg.fillRect(A.dais.x - 8, A.dais.top, A.dais.w + 16, 6);
    // corniche du levier (toujours solide)
    staticZone(k, A.ledge.x, A.ledge.top, A.ledge.w, 24);
    const lg = sc.add.graphics().setDepth(DEPTH.terrain + 1);
    lg.fillStyle(0x4a4670, 1);
    lg.fillRect(A.ledge.x, A.ledge.top, A.ledge.w, 24);
    lg.fillStyle(0x6f7690, 1);
    lg.fillRect(A.ledge.x, A.ledge.top, A.ledge.w, 5);
    lg.fillStyle(0x3d4260, 1);
    lg.fillRect(A.ledge.x + A.ledge.w / 2 - 14, A.ledge.top + 24, 28, A.floorY - A.ledge.top - 24);
    this.leverG = sc.add.graphics().setDepth(DEPTH.props);
    this.drawLever(0);
    // plateformes d'ombre (phase 2 seulement)
    this.shadowG = sc.add.graphics().setDepth(MDEPTH.glow - 3);
    for (const s of A.shadow) {
      const z = movingZone(k, s.x, s.top + 9, s.w, 18);
      setBodyEnabled(z, false);
      this.shadowZones.push(z);
      this.shadowLit.push(true);
    }
    // grand lustre au-dessus du roi
    this.chand = sc.add.image(A.bossX, 60, ensureCanvas(sc, 'mn-chand-big', () => paintChandelier(300))).setOrigin(0.5, 0).setDepth(DEPTH.backProps + 4);
    const rope = sc.add.graphics().setDepth(DEPTH.backProps + 3);
    rope.lineStyle(3, 0x1a1533, 1);
    rope.lineBetween(A.bossX, -40, A.bossX, 64);
    for (let i = -2; i <= 2; i++) addFlame(sc, k.amb, A.bossX + i * 63, 80, 0.8);
    // dalle fissurée
    this.crackG = sc.add.graphics().setDepth(DEPTH.terrain + 2);
    this.drawCrack();
    // grille de sortie
    this.gate = sc.add.image(A.exitGate + 15, A.floorY, ensureCanvas(sc, 'mn-grate', () => paintGrate(40, 400))).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 2);
    this.gateZone = staticZone(k, A.exitGate, 100, 30, A.floorY - 100);
    // le roi
    this.vines = sc.add.graphics().setDepth(this.bossDepth + 0.5);
    this.body = sc.add.image(this.x, this.y + 6, ensureCanvas(sc, `mn-boss-${this.R}`, () => paintPumpkin(this.R, 9))).setOrigin(0.5, 1).setDepth(this.bossDepth);
    this.face = sc.add.graphics().setDepth(this.bossDepth + 0.2);
    this.crown = sc.add.image(this.x, this.y - this.R * 2 + 10, ensureCanvas(sc, 'mn-crown', () => paintCrown(130))).setOrigin(0.5, 1).setDepth(this.bossDepth + 0.3);
    this.stalk = sc.add.graphics().setDepth(DEPTH.traps + 2);
    this.marks = sc.add.graphics().setDepth(MDEPTH.glow - 1);
    this.beam = sc.add.graphics().setDepth(MDEPTH.glow - 2).setBlendMode(Phaser.BlendModes.ADD);
  }

  get defeated(): boolean { return this.phase === 'defeat' || this.phase === 'done'; }

  private go(st: string): void { this.st = st; this.t = 0; }

  private inArena(ctx: TrapContext): boolean {
    const p = ctx.player;
    return p.alive && p.x > this.A.x0 + 200 && p.x < this.A.x1;
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    this.t += dt;
    const E = this.k.expert;
    const p = ctx.player;
    const A = this.A;
    switch (this.phase) {
      case 'asleep':
        this.mood = 'grin';
        if (this.inArena(ctx)) {
          this.phase = 'wake';
          this.go('');
          Audio.setMood('boss');
          ctx.sfx('laugh', this.x);
          say(this.k.scene, this.x, this.y - this.R * 2 + 20, this.gearDone ? 'Encore toi ?!' : 'Qui ose troubler mon bal ?', '#c4561c', 1800);
        }
        break;
      case 'wake':
        if (this.t > 1.8) {
          this.phase = this.leverPulled ? 'p3' : this.gearDone ? 'p2' : 'p1';
          this.go('start');
          if (this.phase === 'p2') this.enterDark();
        }
        break;
      case 'p1': this.updateP1(dt, ctx, E); break;
      case 'p2': this.updateP2(dt, ctx, E); break;
      case 'p3': this.updateP3(dt, ctx, E); break;
      case 'defeat':
        this.mood = 'dizzy';
        break;
      case 'done':
        break;
    }
    this.updateMinions(dt, ctx);
    // mécanisme révélé par la dalle : il suffit de s'y tenir
    if (this.crackBroken && !this.gearDone) {
      if (p.alive && p.grounded && Math.abs(p.x - A.crack) < 46 && Math.abs(p.bottom - A.floorY) < 6) this.gearT += dt; else this.gearT = 0;
      if (this.gearT > 0.35) this.activateGear(ctx);
    }
    this.render(dt);
  }

  // ---------------------------------------------------------------- phase 1

  private updateP1(dt: number, ctx: TrapContext, E: boolean): void {
    const p = ctx.player;
    switch (this.st) {
      case 'start':
        this.mood = 'grin';
        this.spawnMinion(ctx, -1);
        this.spawnMinion(ctx, 1);
        ctx.sfx('laugh', this.x);
        this.go('rolls');
        break;
      case 'rolls':
        // Expert : il vise pendant que les citrouilles roulent encore (attaque combinée)
        if ((E && this.t > 1.2) || this.minions.every((m) => !m.alive) || this.t > 6) this.startAim();
        break;
      case 'aim': this.updateAim(dt, ctx, E, () => this.afterSlamP1(ctx)); break;
      case 'slam': case 'stuck': case 'retract': this.updateAim(dt, ctx, E, () => this.afterSlamP1(ctx)); break;
      case 'pause':
        if (this.t > (E ? 0.5 : 1.3)) this.go(this.slams % 2 === 1 && E ? 'aimAgain' : 'start');
        break;
      case 'aimAgain':
        this.startAim();
        break;
    }
    void p;
  }

  private startAim(): void {
    this.go('aim');
    this.locked = false;
    this.aimX = this.k.player.x;
    this.mood = 'angry';
  }

  /** Coup de tige : vise le héros, se verrouille (annonce), frappe, reste planté, remonte. */
  private updateAim(dt: number, ctx: TrapContext, E: boolean, done: () => void): void {
    const p = ctx.player;
    const A = this.A;
    const AIM = E ? 0.9 : 1.35;
    if (this.st === 'aim') {
      if (!this.locked) this.aimX = Phaser.Math.Linear(this.aimX, Phaser.Math.Clamp(p.x, A.x0 + 80, A.x1 - 80), Math.min(1, dt * 6));
      if (!this.locked && this.t > AIM - 0.4) { this.locked = true; ctx.sfx('tick', this.aimX, 1); }
      if (this.t >= AIM) { this.go('slam'); }
    } else if (this.st === 'slam') {
      if (this.t >= 0.12) {
        this.go('stuck');
        this.slams++;
        ctx.sfx('slam', this.aimX);
        ctx.burst('dust', this.aimX, A.floorY, 14);
        if (!this.crackBroken && Math.abs(this.aimX - A.crack) < 80) this.breakCrack(ctx);
      }
      if (p.alive && this.t > 0.05 && hits(p, this.aimX - 52, 0, 104, A.floorY)) ctx.kill('prick');
    } else if (this.st === 'stuck') {
      if (p.alive && this.t < 0.12 && hits(p, this.aimX - 52, 0, 104, A.floorY)) ctx.kill('prick');
      if (this.t >= 0.6) this.go('retract');
    } else if (this.st === 'retract') {
      if (this.t >= 0.45) { this.go('pause'); done(); }
    }
  }

  private afterSlamP1(_ctx: TrapContext): void {
    this.mood = this.crackBroken ? 'oops' : 'grin';
    this.go('pause');
    // le roi est vantard… et trop bavard
    if (!this.crackBroken && this.slams % 2 === 1) {
      const lines = ['Raté ! Et ma belle dalle fissurée est intacte !', 'Surtout, ne me fais pas frapper ma dalle fissurée !'];
      say(this.k.scene, this.x, this.y - this.R * 2 + 20, lines[Math.floor(this.slams / 2) % 2], '#c4561c', 1800);
    }
  }

  private breakCrack(ctx: TrapContext): void {
    this.crackBroken = true;
    ctx.sfx('crack', this.A.crack);
    ctx.sfx('chime', this.A.crack);
    ctx.burst('sparkle', this.A.crack, this.A.floorY - 10, 12);
    this.mood = 'oops';
    say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'Oups… pas la dalle !', '#c4561c', 1500);
    this.drawCrack();
  }

  private activateGear(ctx: TrapContext): void {
    this.gearDone = true;
    ctx.sfx('clonk', this.A.crack);
    ctx.sfx('gate', this.A.crack);
    this.drawCrack();
    this.mood = 'angry';
    say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'Mes ronces !!', '#c4561c', 1400);
    this.minions.forEach((m) => this.killMinion(m));
    this.go('trans'); // plus d'attaque pendant la transition
    this.k.scene.time.delayedCall(1200, () => {
      if (this.phase !== 'p1') return;
      say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'Dansons dans le noir…', '#c4561c', 1600);
      this.phase = 'p2';
      this.go('start');
      this.enterDark();
    });
  }

  // ---------------------------------------------------------------- phase 2

  private enterDark(): void {
    if (this.k.amb) this.k.amb.extraDark = this.k.expert ? 0.5 : 0.44;
    this.k.ctx.sfx('candle', this.x, 1);
    this.beamA = -1.2;
    this.beamDir = 1;
  }

  private updateP2(dt: number, ctx: TrapContext, E: boolean): void {
    const p = ctx.player;
    const A = this.A;
    // plateformes d'ombre : solides dans le noir, sauf là où passe le regard du roi
    for (let i = 0; i < A.shadow.length; i++) {
      const s = A.shadow[i];
      const lit = this.beamOn && this.beamCovers(s.x, s.top);
      this.shadowLit[i] = lit;
      setBodyEnabled(this.shadowZones[i], !lit);
    }
    const IDLE = E ? 1.1 : 1.7, TEL = E ? 0.6 : 0.95, SWEEP = E ? 1.0 : 1.6;
    switch (this.st) {
      case 'start':
        this.mood = 'grin';
        this.beamOn = false;
        if (this.t > IDLE) { this.go('tele'); ctx.sfx('creak', this.x, 0.6); }
        break;
      case 'tele':
        // annonce : ses yeux s'illuminent, une ligne montre d'où part le regard
        if (this.t < dt * 1.5 && !this.tauntP2) { this.tauntP2 = true; say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'Personne n\'atteindra mon levier, là-haut !', '#c4561c', 1800); }
        this.mood = 'angry';
        if (this.t > TEL) { this.go('sweep'); this.beamOn = true; ctx.sfx('teleport', this.x, 1); }
        break;
      case 'sweep': {
        const a0 = SW0, a1 = SW1; // balaie les plateformes d'ombre (0 = vers le bas, π/2 = vers la droite)
        const k = Math.min(1, this.t / SWEEP);
        this.beamA = this.beamDir > 0 ? Phaser.Math.Linear(a0, a1, k) : Phaser.Math.Linear(a1, a0, k);
        if (k >= 1) {
          this.beamOn = false;
          this.beamDir *= -1;
          // Expert : attaque combinée, un coup de tige si le héros traîne au sol
          if (E && p.alive && p.bottom > A.floorY - 6) { this.locked = false; this.aimX = p.x; this.go('aim'); this.p2Aiming = true; }
          else this.go('start');
        }
        break;
      }
      case 'aim': case 'slam': case 'stuck': case 'retract':
        this.updateAim(dt, ctx, E, () => { this.p2Aiming = false; this.go('start'); });
        break;
      case 'pause':
        this.go('start');
        break;
      case 'chand': {
        // le lustre tremble (annonce 1,2 s), puis tombe sur le roi
        this.chand.x = this.A.bossX + Math.sin(this.time * 40) * 4;
        if (Math.random() < 0.3) ctx.burst('dust', this.A.bossX + (Math.random() - 0.5) * 200, 90, 1);
        if (this.t > 1.2) {
          this.go('chandFall');
          this.k.scene.tweens.add({
            targets: this.chand, y: this.y - this.R * 2 - 20, angle: 12, duration: 420, ease: 'Quad.easeIn',
            onComplete: () => this.crownOff(ctx)
          });
        }
        break;
      }
      case 'chandFall':
        break;
    }
    // le levier en haut
    if (!this.leverPulled && p.alive && Math.abs(p.x - A.lever) < 30 && Math.abs(p.bottom - A.ledge.top) < 8) {
      this.leverPulled = true;
      this.beamOn = false;
      ctx.sfx('clonk', A.lever);
      ctx.sfx('creak', this.x, 1);
      this.drawLever(1);
      this.go('chand');
      this.mood = 'oops';
      say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'Hé… ce lustre est à moi !', '#c4561c', 1300);
    }
  }

  private p2Aiming = false;
  private tauntP2 = false;
  private tauntP3 = false;

  private beamCovers(x: number, top: number): boolean {
    const ex = this.x, ey = this.y - this.R * 1.1;
    const a = Math.atan2(x - ex, top - ey);
    const d = Math.hypot(x - ex, top - ey);
    return Math.abs(a - this.beamA) < 0.12 + Math.atan2(55, d);
  }

  private crownOff(ctx: TrapContext): void {
    this.crownOn = false;
    ctx.sfx('slam', this.x);
    ctx.sfx('sting', this.x);
    ctx.burst('sparkle', this.x, this.y - this.R * 2, 16);
    this.k.scene.tweens.add({ targets: this.crown, x: this.x - 260, y: this.A.floorY, angle: -400, duration: 900, ease: 'Quad.easeOut' });
    this.k.scene.tweens.add({ targets: this.chand, alpha: 0, delay: 600, duration: 500 });
    say(this.k.scene, this.x, this.y - this.R * 2 + 20, 'MA COURONNE !!', '#c4561c', 1500);
    if (this.k.amb) this.k.amb.extraDark = 0;
    for (let i = 0; i < this.shadowZones.length; i++) setBodyEnabled(this.shadowZones[i], false);
    this.k.scene.time.delayedCall(1500, () => {
      if (this.phase !== 'p2') return;
      this.phase = 'p3';
      this.go('rest');
      this.hops = 0;
    });
  }

  // ---------------------------------------------------------------- phase 3

  private updateP3(dt: number, ctx: TrapContext, E: boolean): void {
    const p = ctx.player;
    const A = this.A;
    this.mood = 'panic';
    if (!this.tauntP3) { this.tauntP3 = true; say(this.k.scene, this.x, this.y - this.R * 2 - 60, 'Je vais t\'écraser… mais pas sur mon trône !', '#c4561c', 2000); }
    switch (this.st) {
      case 'rest':
        if (this.t > (E ? 0.45 : 0.9)) {
          this.go('crouch');
          this.hopFrom = { x: this.x, y: this.y };
          const tx = Phaser.Math.Clamp(p.x, A.x0 + 200, A.dais.x + A.dais.w - 40);
          const onDais = tx > A.dais.x - 10 && tx < A.dais.x + A.dais.w + 10;
          this.hopTo = { x: onDais ? A.dais.x + A.dais.w / 2 : tx, y: onDais ? A.dais.top : A.floorY };
          ctx.sfx('creak', this.x, 0.7);
        }
        break;
      case 'crouch': {
        const CR = E ? (this.hops % 3 === 2 ? 0.45 : 0.6) : 0.95;
        if (this.t >= CR) { this.go('air'); ctx.sfx('whoosh', this.x, 1); ctx.sfx('squeak', this.x, 0.6); }
        break;
      }
      case 'air': {
        const DUR = 0.75;
        const k = Math.min(1, this.t / DUR);
        this.x = Phaser.Math.Linear(this.hopFrom.x, this.hopTo.x, k);
        this.y = Phaser.Math.Linear(this.hopFrom.y, this.hopTo.y, k) - Math.sin(k * Math.PI) * 300;
        if (k >= 1) this.land(ctx);
        break;
      }
      case 'land':
        if (this.t > 0.3) {
          this.hops++;
          // désordonné mais réglé : une citrouille roulante tous les deux bonds
          if (this.hops % 2 === 0) this.spawnMinion(ctx, p.x < this.x ? -1 : 1);
          this.go(E && this.hops % 3 === 2 ? 'crouchAgain' : 'rest');
        }
        break;
      case 'crouchAgain':
        this.go('rest');
        this.t = 10;
        break;
    }
  }

  private land(ctx: TrapContext): void {
    const p = ctx.player;
    const A = this.A;
    this.x = this.hopTo.x;
    this.y = this.hopTo.y;
    ctx.sfx('slam', this.x);
    ctx.burst('dust', this.x, this.y, 18);
    this.go('land');
    // impact : zone affichée pendant l'accroupissement
    if (p.alive && Math.abs(p.x - this.x) < 125 && p.bottom > this.y - 160) ctx.kill('prick');
    if (this.y === A.dais.top) this.defeat(ctx);
  }

  private defeat(ctx: TrapContext): void {
    this.phase = 'defeat';
    this.minions.forEach((m) => this.killMinion(m));
    Audio.setMood('normal');
    ctx.sfx('creak', this.x, 1);
    // le rideau se décroche et recouvre le roi
    this.k.scene.tweens.add({
      targets: this.curtain, y: this.A.dais.top - 200 * 1.35 + 6, scaleY: 1.35, scaleX: 1.15, duration: 600, ease: 'Bounce.easeOut',
      onComplete: () => {
        ctx.sfx('book', this.x);
        this.curtain.setDepth(DEPTH.traps + 3);
        // une bosse remue sous le rideau
        this.k.scene.tweens.add({ targets: this.curtain, scaleX: 1.2, duration: 160, yoyo: true, repeat: 5 });
        this.body.setVisible(false);
        this.face.setVisible(false);
        this.vines.setVisible(false);
        say(this.k.scene, this.x, this.A.dais.top - 300, 'Mmmh ! Mmmmh !!', '#c4561c', 1400);
        // la tête s'échappe… et roule jusqu'au levier de la sortie
        this.k.scene.time.delayedCall(800, () => this.rollHead(ctx));
      }
    });
  }

  private rollHead(ctx: TrapContext): void {
    const sc = this.k.scene;
    const img = sc.add.image(0, 0, ensureCanvas(sc, 'mn-pkb-40', () => paintPumpkin(40, 120))).setOrigin(0.5, 0.62);
    const face = sc.add.graphics();
    drawCarvedFace(face, 0, 0, 40, 'dizzy');
    this.head = sc.add.container(this.x, this.A.dais.top - 40, [img, face]).setDepth(DEPTH.traps);
    ctx.sfx('pop', this.x);
    say(sc, this.x, this.A.dais.top - 120, 'Pouf !', '#c4561c', 900);
    sc.tweens.add({ targets: this.head, x: this.A.exitLever - 30, duration: 1300, ease: 'Quad.easeIn' });
    sc.tweens.add({ targets: this.head, y: this.A.floorY - 40, duration: 500, ease: 'Bounce.easeOut' });
    sc.tweens.add({
      targets: this.head, angle: 720, duration: 1300, onComplete: () => {
        ctx.sfx('clonk', this.A.exitLever);
        ctx.sfx('gate', this.A.exitGate);
        setBodyEnabled(this.gateZone, false);
        sc.tweens.add({ targets: this.gate, y: this.A.floorY - 360, duration: 900, ease: 'Cubic.easeInOut' });
        say(sc, this.A.exitLever - 30, this.A.floorY - 120, 'Ouille…', '#c4561c', 1200);
        this.phase = 'done';
        if (this.k.amb) this.k.amb.extraDark = 0;
      }
    });
  }

  // ---------------------------------------------------------------- citrouilles roulantes

  private spawnMinion(ctx: TrapContext, dir: number): void {
    if (this.minions.filter((m) => m.alive).length >= 2) return;
    const r = 24;
    const img = this.k.scene.add.image(0, r + 4, ensureCanvas(this.k.scene, `mn-pkb-${r}`, () => paintPumpkin(r, r * 3))).setOrigin(0.5, 1);
    const face = this.k.scene.add.graphics();
    drawCarvedFace(face, 0, 0, r, 'angry');
    const c = this.k.scene.add.container(this.x + dir * (this.R * 0.6), this.A.floorY - r - 4, [img, face]).setDepth(DEPTH.traps);
    const sp = this.k.expert ? 330 : 255;
    this.minions.push({ x: c.x, vx: dir * sp, r, bounced: false, c, face, alive: true });
    ctx.sfx('pop', c.x);
  }

  private killMinion(m: Minion): void {
    if (!m.alive) return;
    m.alive = false;
    this.k.scene.tweens.add({ targets: m.c, alpha: 0, scale: 0.3, duration: 250, onComplete: () => m.c.destroy() });
  }

  private updateMinions(dt: number, ctx: TrapContext): void {
    const A = this.A;
    for (const m of this.minions) {
      if (!m.alive) continue;
      m.x += m.vx * dt;
      if (!m.bounced && (m.x < A.x0 + 70 || m.x > A.dais.x - 30)) {
        m.bounced = true;
        m.vx = -m.vx;
        ctx.sfx('boing', m.x, 0.6);
      }
      // retour au roi : elle disparaît dans un « plop »
      if (m.bounced && Math.abs(m.x - this.x) < 30) this.killMinion(m);
      m.c.x = m.x;
      m.c.rotation += (m.vx * dt) / m.r;
      if (hitsCircle(ctx.player, m.x, A.floorY - m.r, m.r * 0.85)) ctx.kill('prick');
    }
    this.minions = this.minions.filter((m) => m.alive || m.c.active);
  }

  // ---------------------------------------------------------------- rendu

  private drawCrack(): void {
    const g = this.crackG;
    const x = this.A.crack, y = this.A.floorY;
    g.clear();
    if (!this.crackBroken) {
      g.fillStyle(0x8f8aa8, 1);
      g.fillRect(x - 60, y - 4, 120, 8);
      g.lineStyle(2, 0x1a1533, 0.9);
      g.beginPath();
      g.moveTo(x - 40, y - 3); g.lineTo(x - 10, y + 2); g.lineTo(x + 6, y - 2); g.lineTo(x + 40, y + 3);
      g.moveTo(x - 10, y + 2); g.lineTo(x - 18, y + 5);
      g.strokePath();
      return;
    }
    // mécanisme révélé : un engrenage doré, bien visible
    g.fillStyle(0x1a1533, 1);
    g.fillRect(x - 60, y - 4, 120, 8);
    g.fillStyle(this.gearDone ? 0x7fe0bd : 0xd9a23a, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (this.gearDone ? 0.4 : 0);
      g.fillRect(x + Math.cos(a) * 28 - 5, y - 2 + Math.sin(a) * 6 - 3, 10, 6);
    }
    g.fillEllipse(x, y - 1, 56, 10);
    g.fillStyle(0x1a1533, 1);
    g.fillEllipse(x, y - 1, 14, 4);
  }

  private drawLever(down: number): void {
    const g = this.leverG;
    g.clear();
    const x = this.A.lever, y = this.A.ledge.top;
    g.fillStyle(0x3d4260, 1);
    g.fillRoundedRect(x - 12, y - 14, 24, 14, 4);
    g.lineStyle(5, 0xd9a23a, 1);
    const a = -Math.PI / 2 - 0.7 + down * 1.4;
    g.lineBetween(x, y - 8, x + Math.cos(a) * 34, y - 8 + Math.sin(a) * 34);
    g.fillStyle(0xe8846b, 1);
    g.fillCircle(x + Math.cos(a) * 34, y - 8 + Math.sin(a) * 34, 6);
  }

  private render(dt: number): void {
    const R = this.R;
    const crouch = this.phase === 'p3' && this.st === 'crouch' ? Math.min(1, this.t * 3) : 0;
    const breathe = this.phase === 'asleep' ? Math.sin(this.time * 1.5) * 0.02 : Math.sin(this.time * 3) * 0.015;
    const panicShake = this.phase === 'p3' ? Math.sin(this.time * 35) * 2 : 0;
    this.body.setVisible(this.phase !== 'defeat' && this.phase !== 'done' ? true : this.body.visible);
    this.body.setPosition(this.x + panicShake, this.y + 6).setScale(1 + crouch * 0.12, 1 - crouch * 0.16 + breathe);
    const fy = this.y - R * (1 - crouch * 0.15);
    if (this.crownOn) this.crown.setPosition(this.x + panicShake, this.y - R * 2 * (1 - crouch * 0.16) + 14);
    const f = this.face;
    f.clear();
    if (this.body.visible) {
      const mood = this.phase === 'asleep' ? 'grin' : this.mood === 'panic' ? 'scared' : this.mood === 'oops' ? 'scared' : this.mood === 'dizzy' ? 'dizzy' : this.mood === 'angry' ? 'angry' : 'grin';
      const lx = Phaser.Math.Clamp((this.k.player.x - this.x) / 300, -1, 1);
      drawCarvedFace(f, this.x + panicShake, fy, R * 0.9, mood, lx);
      if (this.phase === 'asleep') {
        f.fillStyle(0x3a1a08, 0.8);
        f.fillRect(this.x - R * 0.5, fy - R * 0.2, R * 1.0, R * 0.12); // paupières lourdes
      }
      if (this.mood === 'panic') {
        f.fillStyle(0xbfe8ff, 1);
        f.fillCircle(this.x + R * 0.8, fy - R * 0.6 + ((this.time * 80) % 40), 8);
        f.fillCircle(this.x - R * 0.85, fy - R * 0.5 + ((this.time * 70 + 20) % 40), 6);
      }
      if (this.phase === 'p2' && (this.st === 'tele' || this.st === 'sweep')) {
        f.fillStyle(0xfff3c0, 1);
        f.fillCircle(this.x - R * 0.3, fy - R * 0.11, R * 0.1);
        f.fillCircle(this.x + R * 0.3, fy - R * 0.11, R * 0.1);
      }
    }
    // ronces protectrices (phase 1)
    const v = this.vines;
    v.clear();
    if (!this.gearDone && this.body.visible) {
      v.lineStyle(6, 0x3a5a3a, 1);
      for (let i = 0; i < 3; i++) {
        v.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
          const rr = R * (1.08 + i * 0.07) + Math.sin(a * 6 + this.time * 2 + i) * 6;
          v.lineTo(this.x + Math.cos(a) * rr, this.y - R + Math.sin(a) * rr * 0.9);
        }
        v.strokePath();
      }
      v.fillStyle(0x8a3a3a, 1);
      for (let a = 0; a < Math.PI * 2; a += 0.45) v.fillTriangle(
        this.x + Math.cos(a) * R * 1.12, this.y - R + Math.sin(a) * R * 1.0,
        this.x + Math.cos(a + 0.08) * R * 1.3, this.y - R + Math.sin(a + 0.08) * R * 1.15,
        this.x + Math.cos(a + 0.16) * R * 1.12, this.y - R + Math.sin(a + 0.16) * R * 1.0
      );
    }
    // tige d'attaque + marqueurs d'impact
    const s = this.stalk;
    s.clear();
    const m = this.marks;
    m.clear();
    const aiming = ['aim', 'slam', 'stuck', 'retract'].includes(this.st) && (this.phase === 'p1' || this.phase === 'p2');
    if (aiming) {
      const A = this.A;
      let tipY: number;
      if (this.st === 'aim') tipY = 120 - Math.min(1, this.t * 3) * 40;
      else if (this.st === 'slam') tipY = Phaser.Math.Linear(80, A.floorY - 10, Math.min(1, this.t / 0.12));
      else if (this.st === 'stuck') tipY = A.floorY - 10;
      else tipY = Phaser.Math.Linear(A.floorY - 10, 80, Math.min(1, this.t / 0.45));
      const sx = this.x + R * 0.7, sy = this.y - R * 1.4;
      s.lineStyle(18, 0x3a5a3a, 1);
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(sx, sy), new Phaser.Math.Vector2(sx + 60, sy - 300),
        new Phaser.Math.Vector2(this.aimX, Math.min(tipY, 60) - 140), new Phaser.Math.Vector2(this.aimX, tipY)
      );
      curve.draw(s, 30);
      s.lineStyle(6, 0x6f8f4a, 1);
      curve.draw(s, 30);
      s.fillStyle(0x6f8f4a, 1);
      s.fillEllipse(this.aimX, tipY + 4, 70, 28);
      // ombre au sol : la zone exacte qui va être frappée (rouge quand c'est verrouillé)
      if (this.st === 'aim') {
        const pulse = 0.5 + Math.sin(this.time * 18) * 0.25;
        m.fillStyle(this.locked ? 0xff5a4a : 0xffd36b, this.locked ? 0.55 : 0.3 * pulse + 0.15);
        m.fillEllipse(this.aimX, A.floorY - 2, 104, 18);
        m.lineStyle(2, this.locked ? 0xff5a4a : 0xffd36b, 0.8);
        m.strokeEllipse(this.aimX, A.floorY - 2, 104 + (1 - Math.min(1, this.t)) * 60, 18);
      }
    }
    if (this.phase === 'p3' && (this.st === 'crouch' || this.st === 'air')) {
      m.fillStyle(0xff5a4a, 0.35 + Math.sin(this.time * 16) * 0.12);
      m.fillEllipse(this.hopTo.x, this.hopTo.y - 2, 250, 26);
      m.lineStyle(3, 0xff5a4a, 0.85);
      m.strokeEllipse(this.hopTo.x, this.hopTo.y - 2, 250, 26);
    }
    // regard balayant (phase 2) : annonce + faisceau
    const b = this.beam;
    b.clear();
    if (this.phase === 'p2') {
      const ex = this.x, ey = this.y - R * 1.1;
      if (this.st === 'tele') {
        const a0 = this.beamDir > 0 ? SW0 : SW1;
        b.lineStyle(3, 0xfff3c0, 0.35 + Math.sin(this.time * 20) * 0.2);
        b.lineBetween(ex, ey, ex + Math.sin(a0) * 900, ey + Math.cos(a0) * 900);
      }
      if (this.beamOn) {
        const L = 1100;
        b.fillStyle(0xfff3c0, 0.28);
        b.fillTriangle(ex, ey, ex + Math.sin(this.beamA - 0.12) * L, ey + Math.cos(this.beamA - 0.12) * L, ex + Math.sin(this.beamA + 0.12) * L, ey + Math.cos(this.beamA + 0.12) * L);
      }
    }
    // plateformes d'ombre
    const sg = this.shadowG;
    sg.clear();
    if (this.phase === 'p2' && !this.leverPulled) {
      this.A.shadow.forEach((p, i) => {
        const lit = this.shadowLit[i];
        sg.fillStyle(0x2a1a4a, lit ? 0.15 : 0.95);
        sg.fillRoundedRect(p.x - p.w / 2, p.top, p.w, 18, 6);
        sg.lineStyle(2, lit ? 0xffd36b : 0x9a7ad6, lit ? 0.4 : 0.95);
        sg.strokeRoundedRect(p.x - p.w / 2, p.top, p.w, 18, 6);
      });
    }
    void dt;
  }

  reset(): void {
    this.minions.forEach((m) => this.killMinion(m));
    this.locked = false;
    if (this.defeated) return;
    if (this.k.expert) {
      // Expert : tout recommence
      this.crackBroken = false;
      this.gearDone = false;
      this.leverPulled = false;
      this.crownOn = true;
      this.crown.setPosition(this.A.bossX, this.A.floorY - this.R * 2 + 10).setAngle(0);
      this.chand.setPosition(this.A.bossX, 60).setAngle(0).setAlpha(1);
      this.drawLever(0);
      this.drawCrack();
    } else if (this.leverPulled && this.crownOn) {
      // le lustre était en train de tomber : on termine proprement
      this.crownOn = false;
      this.crown.setVisible(false);
      this.chand.setAlpha(0);
    }
    if (this.k.amb) this.k.amb.extraDark = 0;
    this.shadowZones.forEach((z) => setBodyEnabled(z, false));
    this.beamOn = false;
    this.x = this.A.bossX;
    this.y = this.A.floorY;
    this.phase = 'asleep';
    this.go('');
    Audio.setMood('normal');
  }

  destroy(): void {
    [this.body, this.face, this.crown, this.vines, this.stalk, this.marks, this.beam, this.crackG, this.shadowG, this.leverG, this.chand, this.curtain, this.gate]
      .forEach((o) => o.destroy());
    this.head?.destroy();
    this.minions.forEach((m) => m.c.destroy());
    void standingOn;
  }
}

/**
 * Sortie dans la forêt : le monstre peureux réapparaît derrière une fenêtre (toujours terrifié),
 * une petite citrouille tente une dernière intimidation… et trébuche toute seule.
 */
export class Finale implements Trap {
  readonly id = 'h-finale';
  private win: Phaser.GameObjects.Graphics;
  private eyes: Phaser.GameObjects.Graphics;
  private pk: Phaser.GameObjects.Container;
  private pkFace: Phaser.GameObjects.Graphics;
  private winState: 'wait' | 'peek' | 'hide' = 'wait';
  private wt = 0;
  private pkState: 'wait' | 'menace' | 'trip' | 'down' = 'wait';
  private pt = 0;
  private time = 0;

  constructor(private k: Kit, private winX: number, private winY: number, private pkX: number, private floorY: number) {
    const sc = k.scene;
    this.win = sc.add.graphics().setDepth(DEPTH.near + 3);
    const g = this.win;
    g.fillStyle(0x1a1424, 1);
    g.fillRoundedRect(winX - 50, winY - 70, 100, 140, { tl: 50, tr: 50, bl: 4, br: 4 });
    g.fillStyle(0xffcf6b, 1);
    g.fillRoundedRect(winX - 42, winY - 62, 84, 126, { tl: 42, tr: 42, bl: 2, br: 2 });
    this.eyes = sc.add.graphics().setDepth(DEPTH.near + 4);
    const img = sc.add.image(0, 22, ensureCanvas(sc, 'mn-pkb-18', () => paintPumpkin(18, 54))).setOrigin(0.5, 1);
    this.pkFace = sc.add.graphics();
    this.pk = sc.add.container(pkX, floorY - 22, [img, this.pkFace]).setDepth(DEPTH.props);
  }

  update(dt: number, ctx: TrapContext): void {
    this.time += dt;
    const p = ctx.player;
    // fenêtre : le monstre jette un œil… et se cache
    this.wt += dt;
    const e = this.eyes;
    e.clear();
    if (this.winState === 'wait' && p.alive && p.x > this.winX - 260 && p.x < this.winX + 600) { this.winState = 'peek'; this.wt = 0; }
    if (this.winState === 'peek') {
      const k = Math.min(1, this.wt / 0.4);
      // silhouette violette qui monte dans l'encadrement
      e.fillStyle(0x3b2468, 1);
      e.fillEllipse(this.winX, this.winY + 64 - k * 50, 80, 90);
      e.fillStyle(0xffffff, 1);
      const big = this.wt > 0.7;
      e.fillEllipse(this.winX - 14, this.winY + 40 - k * 50, big ? 18 : 14, big ? 22 : 16);
      e.fillEllipse(this.winX + 14, this.winY + 40 - k * 50, big ? 18 : 14, big ? 22 : 16);
      e.fillStyle(0x1a1533, 1);
      e.fillCircle(this.winX - 14 + (p.x < this.winX ? -3 : 3), this.winY + 42 - k * 50, 3);
      e.fillCircle(this.winX + 14 + (p.x < this.winX ? -3 : 3), this.winY + 42 - k * 50, 3);
      if (this.wt > 0.7 && this.wt - dt <= 0.7) { ctx.sfx('squeak', this.winX, 1.3); say(this.k.scene, this.winX, this.winY - 100, 'Iiiik ! Encore lui !', '#5a3a9a', 1300); }
      if (this.wt > 1.6) { this.winState = 'hide'; ctx.sfx('pop', this.winX, 0.6); }
    }
    // la petite citrouille
    this.pt += dt;
    this.pkFace.clear();
    switch (this.pkState) {
      case 'wait':
        drawCarvedFace(this.pkFace, 0, 0, 18, 'watch', Phaser.Math.Clamp((p.x - this.pkX) / 100, -1, 1));
        if (p.alive && Math.abs(p.x - this.pkX) < 260) {
          this.pkState = 'menace';
          this.pt = 0;
          say(this.k.scene, this.pkX, this.floorY - 80, 'Grrr !', '#c4561c', 900);
          ctx.sfx('grumble', this.pkX);
        }
        break;
      case 'menace':
        drawCarvedFace(this.pkFace, 0, 0, 18, 'angry');
        this.pk.y = this.floorY - 22 - Math.abs(Math.sin(this.pt * 10)) * 16;
        this.pk.x += (p.x < this.pkX ? -1 : 1) * 70 * dt;
        if (this.pt > 0.9) {
          this.pkState = 'trip';
          this.pt = 0;
          ctx.sfx('squeak', this.pk.x, 1);
          this.k.scene.tweens.add({ targets: this.pk, angle: p.x < this.pk.x ? -100 : 100, y: this.floorY - 18, duration: 350, ease: 'Quad.easeIn' });
        }
        break;
      case 'trip':
        drawCarvedFace(this.pkFace, 0, 0, 18, 'scared');
        if (this.pt > 0.4) {
          this.pkState = 'down';
          ctx.sfx('book', this.pk.x, 0.6);
          ctx.burst('dust', this.pk.x, this.floorY, 6);
          say(this.k.scene, this.pk.x, this.floorY - 70, 'Ouille…', '#c4561c', 1100);
          p.happyEyes(900);
        }
        break;
      case 'down':
        drawCarvedFace(this.pkFace, 0, 0, 18, 'dizzy');
        break;
    }
  }

  reset(): void { /* scène d'adieu : jouée une fois */ }
  destroy(): void { this.win.destroy(); this.eyes.destroy(); this.pk.destroy(); }
}
