import Phaser from 'phaser';
import { fitCamera } from '../core/Display';
import { DEPTH, GAME_W, PHYSICS } from '../core/constants';
import { Controls, touchState } from '../core/Controls';
import { CameraRig, type CameraTarget } from '../core/CameraRig';
import { HintSystem } from '../ui/HintBubble';
import { Audio, type SfxName } from '../core/Audio';
import { Save } from '../core/Save';
import { Bus, EV } from '../core/Bus';
import { Player } from '../player/Player';
import { ShyStone } from '../traps/ShyStone';
import { Snapper } from '../traps/Snapper';
import { Sneezer } from '../traps/Sneezer';
import { Checkpoint } from '../traps/Checkpoint';
import { ExitDoor } from '../traps/ExitDoor';
import { PrankStone } from '../traps/PrankStone';
import { Raft } from '../traps/Raft';
import { LeafPlatform } from '../traps/LeafPlatform';
import { HollowLog } from '../traps/HollowLog';
import { tuning } from '../core/Difficulty';
import type { DeathKind, Trap, TrapContext } from '../traps/Trap';
import { overlaps } from '../traps/Trap';
import type { LevelData } from '../levels/types';
import { levelMeta, nextLevel } from '../levels';
import { ensureCanvas, paintChapter1 } from '../art/textures';
import { buildGreenhouseBackdrop } from '../art/Backdrop';
import { canvas, rng, paintBed, paintHedge, paintCeiling, paintThorns, paintPillar, paintShaft, GRASS_PAD, STONE_H } from '../art/paint';

type Emitters = Record<'dust' | 'leaves' | 'petals' | 'sparkle', Phaser.GameObjects.Particles.ParticleEmitter>;

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private player!: Player;
  private controls!: Controls;
  private stones: ShyStone[] = [];
  private pranks: PrankStone[] = [];
  private rafts: Raft[] = [];
  private platforms: LeafPlatform[] = [];
  private logs: HollowLog[] = [];
  private snappers: Snapper[] = [];
  private flowers: Sneezer[] = [];
  private traps: Trap[] = [];
  private checkpoints: Checkpoint[] = [];
  private door!: ExitDoor;
  private thornRects: Phaser.Geom.Rectangle[] = [];
  private emitters!: Emitters;
  private ctx!: TrapContext;
  private respawn = { x: 0, y: 0 };
  private deaths = 0;
  private elapsed = 0;
  private finished = false;
  private camRig!: CameraRig;
  private hints: HintSystem | null = null;
  private hedges: Phaser.GameObjects.Image[] = [];
  private rustleT = 0;
  private statsTimer = 0;

  constructor() {
    super('Game');
  }

  init(data: { levelId?: string }): void {
    const meta = levelMeta(data.levelId ?? '1-1');
    this.level = (meta?.data ?? levelMeta('1-1')!.data!)();
    this.stones = [];
    this.pranks = [];
    this.rafts = [];
    this.platforms = [];
    this.logs = [];
    this.snappers = [];
    this.flowers = [];
    this.traps = [];
    this.checkpoints = [];
    this.thornRects = [];
    this.hedges = [];
    this.rustleT = 0;
    this.deaths = 0;
    this.elapsed = 0;
    this.finished = false;
  }

  create(): void {
    fitCamera(this);
    const L = this.level;
    paintChapter1(this);
    this.physics.world.setBounds(0, -400, L.width, L.height + 600);
    this.physics.world.setBoundsCollision(true, true, false, false);

    buildGreenhouseBackdrop(this, L.width, 180);
    this.buildDarkZones();
    this.buildDecor('back');
    const terrain = this.buildTerrain();
    this.buildThorns();

    this.respawn = { ...L.spawn };
    this.player = new Player(this, L.spawn.x, L.spawn.y);
    this.controls = new Controls(this);

    this.emitters = this.buildEmitters();
    this.ctx = {
      scene: this,
      player: this.player,
      sfx: (name, x, intensity) => this.sfx(name, x, intensity),
      kill: (kind, source) => this.kill(kind, source),
      burst: (kind, x, y, count = 8) => this.emitters[kind].explode(count, x, y)
    };

    const T = tuning();
    const keep = (o: { only?: string }) => !o.only || o.only === T.id;

    L.stones.filter(keep).forEach((s, i) => {
      if (s.kind === 'prank') {
        const pr = new PrankStone(this, s, i);
        this.pranks.push(pr);
        this.traps.push(pr);
        return;
      }
      if (s.kind === 'matte') {
        const ph = Math.max(10, s.base - (s.top + STONE_H) + 10);
        ensureCanvas(this, `pillar-${Math.round(ph)}`, () => paintPillar(ph, i));
      }
      const st = new ShyStone(this, s as typeof s & { kind: 'matte' | 'polished' }, i);
      this.stones.push(st);
      this.traps.push(st);
    });
    L.snappers.filter(keep).forEach((s, i) => {
      const sn = new Snapper(this, s, i);
      this.snappers.push(sn);
      this.traps.push(sn);
    });
    const tagged: Record<string, Sneezer> = {};
    (L.flowers ?? []).filter(keep).forEach((f, i) => {
      const fl = new Sneezer(this, f, i);
      this.flowers.push(fl);
      this.traps.push(fl);
      if (f.tag) tagged[f.tag] = fl;
    });
    (L.platforms ?? []).filter(keep).forEach((pd, i) => {
      const move = pd.move && (!pd.moveOnly || pd.moveOnly === T.id) ? pd.move : undefined;
      const pl = new LeafPlatform(this, { ...pd, move }, i);
      this.platforms.push(pl);
      this.traps.push(pl);
    });
    (L.rafts ?? []).forEach((rd, i) => {
      const r = new Raft(this, rd, i);
      this.rafts.push(r);
      this.traps.push(r);
      tagged[rd.flower]?.onSneeze.push(() => r.blow(this.ctx));
    });
    (L.logs ?? []).forEach((ld) => this.logs.push(new HollowLog(this, ld)));
    // Expert : aucun point de contrôle (on recommence au début du niveau)
    if (T.checkpoints) L.checkpoints.forEach((c) => this.checkpoints.push(new Checkpoint(this, c.x, c.groundY)));
    const ex = L.exit;
    this.door = new ExitDoor(this, ex.x, ex.groundY, ex.scootTo, () => this.win(), ex.gag ?? 'scoot', { maxX: ex.maxX, flyTo: ex.flyTo });
    if (ex.flower && tagged[ex.flower]) tagged[ex.flower].onSneeze.push(() => this.door.sneezedOn(this.ctx));
    if (ex.platform !== undefined && this.platforms[ex.platform]) {
      const pl = this.platforms[ex.platform];
      this.door.attachTo(pl);
      this.door.setCarrierStart(pl.cfg.x);
    }
    this.buildDecor('front');

    // collisions
    this.physics.add.collider(this.player.zone, terrain);
    this.physics.add.collider(this.player.zone, [...this.stones.map((s) => s.zone), ...this.pranks.map((s) => s.zone)]);
    const gates = this.snappers.filter((s) => s.gateZone).map((s) => s.gateZone!);
    if (gates.length) this.physics.add.collider(this.player.zone, gates);
    if (this.platforms.length) this.physics.add.collider(this.player.zone, this.platforms.map((p) => p.zone));
    if (this.rafts.length) this.physics.add.collider(this.player.zone, this.rafts.map((r) => r.zone));
    const logSolids = this.logs.flatMap((l) => l.solids);
    if (logSolids.length) this.physics.add.collider(this.player.zone, logSolids);
    if (this.flowers.length) {
      this.physics.add.collider(this.player.zone, this.flowers.map((f) => f.potZone));
      const heads = this.flowers.filter((f) => f.headZone).map((f) => f.headZone!);
      if (heads.length) this.physics.add.collider(this.player.zone, heads);
    }

    // événements du joueur → sons + particules
    this.player.onJump = () => {
      this.sfx('jump', this.player.x);
      this.emitters.dust.explode(5, this.player.x, this.player.bottom);
    };
    this.player.onLand = (k) => {
      this.sfx('land', this.player.x, k);
      this.emitters.dust.explode(Math.round(4 + k * 8), this.player.x, this.player.bottom);
    };
    this.player.onStep = () => this.sfx('step', this.player.x, 0.5);

    // caméra
    const cam = this.cameras.main;
    this.camRig = new CameraRig(cam, L.width, L.height);
    this.camRig.snap(this.camTarget(), 1);
    cam.fadeIn(350, 20, 40, 36);

    const hints = (this.level.hints ?? []).filter(keep).map((h) => ({ ...h, after: h.after * T.hintDelay }));
    this.hints = hints.length ? new HintSystem(this, hints, this.player) : null;

    // interface
    this.registry.set('levelInfo', { id: L.id, name: L.name, difficulty: T.id });
    if (this.scene.isActive('HUD') || this.scene.isPaused('HUD')) this.scene.get('HUD').scene.restart();
    else this.scene.launch('HUD');
    this.scene.bringToTop('HUD');
    Bus.on(EV.resume, this.onResume, this);
    Bus.on(EV.restart, this.onRestart, this);
    Bus.on(EV.quit, this.onQuit, this);
    Bus.on(EV.nextLevel, this.onNext, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    Audio.playMusic('greenhouse');
    Audio.duckMusic(0);

    // points d'accès pour les tests automatisés
    (window as unknown as { __nsf: unknown }).__nsf = {
      scene: this, player: this.player, touch: touchState, flowers: this.flowers, snappers: this.snappers,
      pranks: this.pranks, rafts: this.rafts, platforms: this.platforms, door: this.door, stones: this.stones,
      checkpoints: this.checkpoints, difficulty: T.id
    };
  }

  // ------------------------------------------------------------- boucle

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.controls.update();

    if (this.controls.pausePressed && !this.finished) {
      this.pauseGame();
      return;
    }
    if (this.controls.restartPressed && !this.finished) {
      this.onRestart();
      return;
    }

    this.player.update(delta, this.controls);
    for (const t of this.traps) t.update(dt, this.ctx);
    for (const c of this.checkpoints) {
      if (c.update(dt, this.ctx)) {
        this.respawn = { x: c.spawnX, y: c.spawnY };
        Bus.emit(EV.checkpoint);
      }
    }
    this.door.update(dt, this.ctx);

    if (this.player.alive && !this.finished) {
      this.elapsed += delta;
      this.checkHazards();
    }

    this.hints?.update(dt);
    this.updateHedges(dt);

    // caméra stable (amortie, calée sur le sol) ; figée pendant l'animation de mort
    if (this.player.alive) this.camRig.update(delta, this.camTarget());

    this.statsTimer -= delta;
    if (this.statsTimer <= 0) {
      this.statsTimer = 100;
      Bus.emit(EV.stats, { deaths: this.deaths, timeMs: this.elapsed });
    }
  }

  private checkHazards(): void {
    const pb = this.player.body;
    const r = new Phaser.Geom.Rectangle(pb.x + 4, pb.y + 4, pb.width - 8, pb.height - 6);
    for (const t of this.thornRects) {
      if (Phaser.Geom.Rectangle.Overlaps(r, t)) return this.kill('prick');
    }
    for (const s of this.snappers) {
      const d = s.dangerRect();
      if (d && overlaps(r, d)) return this.kill('chomp', s);
    }
    if (this.player.y > this.level.height + 40) this.kill('fall');
  }

  // ------------------------------------------------------------- mort / réapparition

  private kill(kind: DeathKind, source?: Trap): void {
    if (!this.player.alive || this.finished) return;
    this.deaths++;
    Save.addDeath();
    Bus.emit(EV.stats, { deaths: this.deaths, timeMs: this.elapsed });
    Audio.duckMusic(0.55);
    this.sfx(kind === 'chomp' ? 'deathChomp' : 'deathPrick', this.player.x);
    if (kind === 'prick') this.emitters.sparkle.explode(6, this.player.x, this.player.y - 10);
    const dur = this.player.playDeath(kind);
    source?.onKilledPlayer?.(this.ctx);
    this.time.delayedCall(dur, () => this.doRespawn());
  }

  private doRespawn(): void {
    this.cameras.main.flash(160, 255, 248, 225, false);
    for (const t of this.traps) t.reset();
    this.player.revive(this.respawn.x, this.respawn.y);
    this.camRig.snap(this.camTarget(), this.player.facing);
    this.emitters.dust.explode(10, this.respawn.x, this.respawn.y + PHYSICS.bodyH / 2);
    this.sfx('respawn', this.respawn.x);
    this.controls.consumeJump();
    Audio.duckMusic(0);
  }

  private win(): void {
    this.finished = true;
    const p = this.player;
    p.frozen = true;
    p.body.setVelocityX(0);
    this.sfx('victory', p.x);
    Audio.duckMusic(0.4);
    p.celebrate();
    this.emitters.petals.explode(24, p.x, p.y - 40);
    const id = this.level.id;
    const newRecord = Save.completeLevel(id, this.elapsed, this.deaths);
    this.time.delayedCall(900, () => {
      this.tweens.add({ targets: p.rigContainer, alpha: 0, scale: 0.6, duration: 380 });
      Bus.emit(EV.victory, {
        levelId: id, deaths: this.deaths, timeMs: this.elapsed, newRecord,
        bestTimeMs: Save.level(id).bestTimeMs
      });
    });
  }

  private pauseGame(): void {
    Audio.duckMusic(0.6);
    Bus.emit(EV.pause);
    this.scene.pause();
  }

  private onResume(): void {
    Audio.duckMusic(0);
    this.controls.consumeJump();
    this.scene.resume();
  }

  private onRestart(): void {
    this.scene.resume();
    this.cameras.main.fadeOut(180, 20, 40, 36);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ levelId: this.level.id }));
  }

  private onQuit(): void {
    this.scene.resume();
    this.scene.stop('HUD');
    this.scene.start('Menu');
  }

  private onNext(): void {
    const n = nextLevel(this.level.id);
    if (n?.data) this.scene.restart({ levelId: n.id });
    else this.onQuit();
  }

  /**
   * Les haies "vivent" quand le joueur est près d'elles : elles frémissent et laissent tomber
   * des feuilles vers le bas (le regard suit les feuilles… jusqu'au puits et à l'ascenseur).
   */
  private updateHedges(dt: number): void {
    if (!this.hedges.length || !this.player.alive) return;
    this.rustleT -= dt;
    if (this.rustleT > 0) return;
    this.rustleT = 2.6;
    for (const h of this.hedges) {
      if (Math.abs(h.x - this.player.x) > 520) continue;
      this.tweens.add({ targets: h, scaleX: 1.025, angle: { from: -0.8, to: 0.8 }, duration: 110, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      const left = h.x - h.displayWidth / 2 + 6;
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 140, () => this.dropLeaf(left - 8 + Math.random() * 20, h.y - h.displayHeight * (0.35 + Math.random() * 0.4)));
      }
    }
  }

  private dropLeaf(x: number, y: number): void {
    const leaf = this.add.image(x, y, 'leaf').setScale(0.4).setDepth(DEPTH.fx).setAngle(Math.random() * 360);
    this.tweens.add({
      targets: leaf, y: y + 260 + Math.random() * 60, x: x - 30 + Math.random() * 40, angle: leaf.angle + 300,
      alpha: { from: 1, to: 0 }, duration: 2200, ease: 'Sine.easeIn', onComplete: () => leaf.destroy()
    });
  }

  private cleanup(): void {
    this.hints?.destroy();
    Bus.off(EV.resume, this.onResume, this);
    Bus.off(EV.restart, this.onRestart, this);
    Bus.off(EV.quit, this.onQuit, this);
    Bus.off(EV.nextLevel, this.onNext, this);
    this.traps.forEach((t) => t.destroy());
    this.logs.forEach((l) => l.destroy());
    this.checkpoints.forEach((c) => c.destroy());
    this.door?.destroy();
    this.player?.destroy();
  }

  // ------------------------------------------------------------- utilitaires

  private camTarget(): CameraTarget {
    const b = this.player.body;
    return {
      cx: b.x + b.halfWidth, cy: b.y + b.halfHeight, bottom: b.bottom,
      vx: b.velocity.x, vy: b.velocity.y, grounded: this.player.grounded
    };
  }

  private sfx(name: SfxName, x: number, intensity?: number): void {
    const cam = this.cameras.main;
    const pan = (x - (cam.scrollX + GAME_W / 2)) / (GAME_W * 0.6);
    if (Math.abs(pan) > 1.6) return; // trop loin : inaudible
    Audio.sfx(name, { pan, intensity });
  }

  private buildEmitters(): Emitters {
    const base = { emitting: false } as const;
    const dust = this.add.particles(0, 0, 'dust', {
      ...base, lifespan: 420, speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 },
      scale: { start: 0.55, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: -40
    }).setDepth(DEPTH.fx);
    const leaves = this.add.particles(0, 0, 'leaf', {
      ...base, lifespan: 1100, speed: { min: 60, max: 180 }, angle: { min: 200, max: 340 },
      scale: { start: 0.4, end: 0.25 }, rotate: { min: 0, max: 360 }, gravityY: 600, alpha: { start: 1, end: 0 }
    }).setDepth(DEPTH.fx);
    const petals = this.add.particles(0, 0, 'petal', {
      ...base, lifespan: 1400, speed: { min: 120, max: 300 }, angle: { min: 210, max: 330 },
      scale: { start: 1, end: 0.6 }, rotate: { min: 0, max: 360 }, gravityY: 320, alpha: { start: 1, end: 0 }
    }).setDepth(DEPTH.fx);
    const sparkle = this.add.particles(0, 0, 'star', {
      ...base, lifespan: 500, speed: { min: 80, max: 200 }, scale: { start: 0.6, end: 0 },
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(DEPTH.fx);
    return { dust, leaves, petals, sparkle };
  }

  private buildTerrain(): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    const L = this.level;
    L.terrain.forEach((t, i) => {
      const h = t.h ?? L.height - t.top + 40;
      const style = t.style ?? 'bed';
      if (style === 'hedge') {
        const key = ensureCanvas(this, `hedge-${L.id}-${i}`, () => paintHedge(t.w, h, i * 31));
        // origine en bas : la haie peut frémir depuis sa base
        const img = this.add.image(t.x - 10 + (t.w + 20) / 2, t.top + h, key).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 4);
        this.hedges.push(img);
      } else if (style === 'ceiling') {
        const key = ensureCanvas(this, `ceil-${L.id}-${i}`, () => paintBed(t.w, h, i * 13));
        this.add.image(t.x - 8, t.top - GRASS_PAD, key).setOrigin(0).setDepth(DEPTH.terrain);
        const roots = ensureCanvas(this, `roots-${L.id}-${i}`, () => paintCeiling(t.w, 8, i * 7));
        this.add.image(t.x, t.top + h - 8, roots).setOrigin(0).setDepth(DEPTH.terrain + 1);
      } else {
        const key = ensureCanvas(this, `bed-${L.id}-${i}`, () => paintBed(t.w, h, i * 97 + 3));
        this.add.image(t.x - 8, t.top - GRASS_PAD, key).setOrigin(0).setDepth(DEPTH.terrain);
      }
      const z = this.add.zone(t.x + t.w / 2, t.top + h / 2, t.w, h);
      group.add(z);
    });
    group.refresh();
    return group;
  }

  private buildThorns(): void {
    const L = this.level;
    L.thorns.forEach((t, i) => {
      const h = L.height - t.top + 10;
      const key = ensureCanvas(this, `thorns-${L.id}-${i}`, () => paintThorns(t.w + 20, h, i * 53 + 9));
      this.add.image(t.x - 10, t.top, key).setOrigin(0).setDepth(DEPTH.terrain - 2);
      this.thornRects.push(new Phaser.Geom.Rectangle(t.x, t.top + 22, t.w, h));
    });
  }

  private buildDarkZones(): void {
    const L = this.level;
    (L.darkZones ?? []).forEach((d, i) => {
      const key = ensureCanvas(this, `tunnel-${L.id}-${i}`, () => {
        const [c, ctx] = canvas(d.w, d.h);
        const r = rng(i + 400);
        const g = ctx.createLinearGradient(0, 0, 0, d.h);
        g.addColorStop(0, '#2c1a17');
        g.addColorStop(1, '#3d2620');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, d.w, d.h);
        for (let k = 0; k < d.w / 6; k++) {
          ctx.fillStyle = r() > 0.5 ? 'rgba(160,110,90,0.18)' : 'rgba(10,4,4,0.3)';
          ctx.beginPath();
          ctx.arc(r() * d.w, r() * d.h, 1 + r() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        return c;
      });
      this.add.image(d.x, d.top, key).setOrigin(0).setDepth(DEPTH.backProps - 1);
      // lucioles du tunnel
      this.add.particles(0, 0, 'dot-glow', {
        x: { min: d.x, max: d.x + d.w }, y: { min: d.top + 10, max: d.top + d.h - 20 },
        lifespan: 3000, speedX: { min: -12, max: 12 }, speedY: { min: -8, max: 8 },
        scale: { start: 0.12, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 260,
        blendMode: Phaser.BlendModes.ADD
      }).setDepth(DEPTH.props + 1);
    });
  }

  private buildDecor(layer: 'back' | 'front'): void {
    for (const d of this.level.decor) {
      if (layer === 'back') {
        if (d.type === 'shaft') {
          const key = ensureCanvas(this, `shaft-${d.w}-${d.h}`, () => paintShaft(d.w ?? 120, d.h ?? 240));
          this.add.image(d.x, d.y, key).setOrigin(0).setDepth(DEPTH.backProps);
        }
        if (d.type === 'lantern') {
          const l = this.add.image(d.x, d.y - 10, 'decor-lantern').setOrigin(0.5, 0).setScale(0.8).setDepth(DEPTH.backProps + 1);
          this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        if (d.type === 'mushrooms') {
          const m = this.add.image(d.x, d.y, 'decor-mushrooms').setOrigin(0.5, 1).setScale(0.7).setFlipX(!!d.flip).setDepth(DEPTH.backProps + 1);
          this.tweens.add({ targets: m, alpha: { from: 0.75, to: 1 }, duration: 1600, yoyo: true, repeat: -1 });
        }
        if (d.type === 'can') this.add.image(d.x, d.y + 4, 'decor-can').setOrigin(0.5, 1).setScale(0.75).setFlipX(!!d.flip).setDepth(DEPTH.props - 1);
      } else {
        if (d.type === 'bush') this.add.image(d.x, d.y + 14, 'decor-bush').setOrigin(0.5, 1).setScale(0.8).setFlipX(!!d.flip).setDepth(DEPTH.frontProps);
        if (d.type === 'fgLeaf') {
          this.add.image(d.x * 1.25 - 300, 750, 'decor-fgleaf').setOrigin(0.5, 1).setScrollFactor(1.25, 0)
            .setScale(0.55).setFlipX(!!d.flip).setAlpha(0.8).setDepth(DEPTH.foreground);
        }
      }
    }
  }
}
