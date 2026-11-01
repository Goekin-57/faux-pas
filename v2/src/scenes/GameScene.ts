// Scène de jeu : construit un niveau du chapitre à partir de sa fonction (qui dépend du nombre de morts),
// gère le joueur, les pièges, les ennemis, la caméra. À chaque mort, le niveau est reconstruit : la carte change.
// Les pièges se trahissent avant d'agir (tremblement, ombre, son, petite bête) ; le texte n'est qu'un appoint.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT } from '../core/config';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { Player, PW } from '../entities/Player';
import type { CharId } from '../entities/HeroArt';
import { CHAPTER1 } from '../levels/chapter1';
import { G, type Block, type LevelDef } from '../levels/types';
import { buildBlock, drawCracks, Parallax } from '../levels/Terrain';
import { makeFlag } from '../traps/Traps';
import { Butterflies, Critters, FleeDoor, Links, ShyPlatform, Stalactites, Storm, type Ctx, type Trap } from '../traps/Ch1Traps';
import { Megaroc, type Tile } from '../entities/Megaroc';
import { Hints, readable, textStyle } from '../ui/Hints';
import { fadeIn, goTo } from '../ui/Transition';
import { TouchControls } from '../ui/TouchControls';

export interface GameData { level: number; deaths?: number; cp?: { x: number; y: number } | null; coins?: string[]; flags?: string[]; elapsed?: number; deathXs?: number[]; deathPts?: [number, number][]; cause?: string }

interface BlockRt { def: Block; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone | null; body: Phaser.Physics.Arcade.StaticBody | null; state: 'solid' | 'shaking' | 'falling'; t: number; hidden: boolean; tell: number; warned: boolean }
interface SpikeRt { x: number; y: number; w: number; down: boolean; hidden: boolean; range: number; rise: number; imgs: Phaser.GameObjects.Image[]; tufts: Phaser.GameObjects.Image[] }
interface MoverRt { x: number; y: number; w: number; x0: number; y0: number; x1: number; y1: number; speed: number; mode: string; k: number; dir: number; active: boolean; sinkT: number; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone; body: Phaser.Physics.Arcade.StaticBody; fled: boolean }
interface SpringRt { x: number; y: number; power: number; kind: string; used: boolean; img: Phaser.GameObjects.Image; cool: number; deco: Phaser.GameObjects.Graphics | null }
interface SnailRt { img: Phaser.GameObjects.Image; helmet: Phaser.GameObjects.Graphics | null; eye: Phaser.GameObjects.Graphics | null; x: number; y: number; minX: number; maxX: number; vx: number; alive: boolean; possum: boolean; armor: number; wake: number; rush: number; hidden: number }
interface RockRt { x: number; trigger: number; y: number; vy: number; state: 'idle' | 'warn' | 'fall' | 'done'; t: number; delay: number; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; side: number }
interface FlowerRt { x: number; img: Phaser.GameObjects.Image; jaw: Phaser.GameObjects.Graphics; near: number; cool: number; snap: number }
interface CoinRt { img: Phaser.GameObjects.Image; x: number; y: number; got: boolean; key: string; locked: boolean }

export class GameScene extends Phaser.Scene {
  data_!: GameData;
  levelIndex = 0;
  def!: LevelDef;
  player!: Player;
  deaths = 0;
  deathLog: string[] = [];
  hints!: Hints;
  private blocks: BlockRt[] = [];
  private spikes: SpikeRt[] = [];
  private movers: MoverRt[] = [];
  private springs: SpringRt[] = [];
  private snails: SnailRt[] = [];
  private rocks: RockRt[] = [];
  private flowers: FlowerRt[] = [];
  private coins: CoinRt[] = [];
  private traps: Trap[] = [];
  private fleeDoor: FleeDoor | null = null;
  private storm: Storm | null = null;
  private flags: { x: number; y: number; on: boolean; ct: Phaser.GameObjects.Container }[] = [];
  private doorImg!: Phaser.GameObjects.Image;
  private lock: Phaser.GameObjects.Graphics | null = null;
  private cardboard: { img: Phaser.GameObjects.Image; state: 'idle' | 'fooled' | 'bridge' } | null = null;
  private chaser: { img: Phaser.GameObjects.Image; x: number; speed: number; state: 'wait' | 'rumble' | 'roll' | 'stopped'; t: number } | null = null;
  private dark: { rt: Phaser.GameObjects.RenderTexture; lanterns: { x: number; y: number; g: Phaser.GameObjects.Graphics }[]; walker: { x: number; y: number; g: Phaser.GameObjects.Graphics; gone: boolean } | null } | null = null;
  private boss: Megaroc | null = null;
  private bossTiles: Tile[] = [];
  private parallax!: Parallax;
  private sun!: Phaser.GameObjects.Container;
  private sunMouth!: Phaser.GameObjects.Graphics;
  private sunT = 0;
  private checkpoint = { x: 0, y: 0 };
  private persist = new Set<string>();
  private coinKeys = new Set<string>();
  private deathXs: number[] = [];
  private deathPts: [number, number][] = [];
  private hintMarks: { x: number; y: number; text?: string; said: boolean }[] = [];
  private controlsStep = 0;
  private elapsed0 = 0;
  private time0 = 0;
  elapsed = 0;
  private won = false;
  private camX = 0;
  private camY = 0;
  private lookAhead = 0;
  private rockRainT = 0;
  private coinText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;
  private snailText: Phaser.GameObjects.Text | null = null;
  private bannerCt!: Phaser.GameObjects.Container;
  private fx: Record<'dust' | 'chips' | 'spark' | 'leaf', Phaser.GameObjects.Particles.ParticleEmitter> | null = null;
  private debugOn = false;
  private debugText!: Phaser.GameObjects.Text;
  private touch: TouchControls | null = null;

  constructor() { super('Game'); }

  create(data: GameData): void {
    this.data_ = { ...data, level: data?.level ?? 0 };
    this.levelIndex = Phaser.Math.Clamp(this.data_.level, 0, CHAPTER1.length - 1);
    this.deaths = this.data_.deaths ?? 0;
    this.def = CHAPTER1[this.levelIndex].build(this.deaths);
    this.blocks = []; this.spikes = []; this.movers = []; this.springs = []; this.snails = []; this.rocks = []; this.flowers = []; this.coins = []; this.flags = []; this.traps = [];
    this.cardboard = null; this.chaser = null; this.dark = null; this.boss = null; this.bossTiles = []; this.lock = null; this.snailText = null; this.fleeDoor = null; this.storm = null;
    this.fx = null; this.debugOn = false; this.won = false; this.deathLog = []; this.sunT = 0; this.controlsStep = 0;
    this.persist = new Set(this.data_.flags ?? []); this.coinKeys = new Set(this.data_.coins ?? []); this.deathXs = [...(this.data_.deathXs ?? [])]; this.deathPts = [...(this.data_.deathPts ?? [])];
    this.elapsed0 = this.data_.elapsed ?? 0; this.elapsed = this.elapsed0; this.rockRainT = 2;
    const L = this.def;
    this.physics.world.setBounds(-60, -400, L.width + 120, 1400, true, true, true, false);
    this.cameras.main.setBounds(0, -200, Math.max(W, L.width), 800);
    this.makeFxTextures();
    this.makeSky();

    // eau (même effet qu'un trou, en plus joli)
    for (const [a, b] of L.water ?? []) {
      this.add.rectangle(a, G + 26, b - a, 300, 0x3aa7e0, 0.92).setOrigin(0, 0).setDepth(3);
      const crest = this.add.tileSprite(a, G + 18, b - a, 12, 'fx_wave').setOrigin(0, 0).setDepth(3);
      this.tweens.add({ targets: crest, tilePositionX: 64, duration: 1600, repeat: -1 });
    }
    for (const b of L.blocks) this.addBlock(b);
    this.drawRopes();
    if (L.boss) this.makeBossFloor();
    for (const p of L.props ?? []) this.addProp(p.type, p.x, p.y ?? G);
    for (const s of L.signs ?? []) this.addSign(s.x, s.y ?? G, s.text);
    for (const s of L.spikes ?? []) this.addSpikes(s.x, s.y ?? G, s.w, s.dir === 'down', !!s.hidden, s.range ?? 70);
    for (const m of L.movers ?? []) this.addMover(m.x, m.y, m.w, m.mode, m.to ?? [m.x, m.y], m.speed ?? 80);
    for (const s of L.springs ?? []) this.addSpring(s.x, s.y ?? G, s.power, s.kind ?? 'normal');
    for (const s of L.snails ?? []) this.addSnail(s.x, s.y ?? G, s.minX, s.maxX, !!s.possum, !!s.armored);
    for (const r of L.rocks ?? []) this.addRock(r.x, r.trigger, r.delay ?? 0.6);
    for (const x of L.flowers ?? []) this.flowers.push({ x, near: 0, cool: 0, snap: 0, img: this.add.image(x, G + 3, 'flower').setOrigin(0.5, 1).setDisplaySize(34, 38).setDepth(7), jaw: this.add.graphics().setDepth(8) });
    for (const [x, y] of L.coins ?? []) { const key = `${x},${y}`; if (!this.coinKeys.has(key)) this.coins.push({ img: this.add.image(x, y, 'coin_gold').setDisplaySize(24, 24).setDepth(9), x, y, got: false, key, locked: false }); }
    for (const c of L.checkpoints ?? []) {
      const y = c.y ?? G, on = !!this.data_.cp && Math.abs(this.data_.cp.x - c.x) < 2;
      this.flags.push({ x: c.x, y, on, ct: makeFlag(this, c.x, y, on ? COL.mint : 0xb9b4cc) });
    }
    this.doorImg = this.add.image(L.door.x, (L.door.y ?? G) + 3, 'door').setOrigin(0.5, 1).setDisplaySize(96, 64).setDepth(5);
    if (L.door.locked === 'snails') { this.lock = this.add.graphics().setDepth(6); this.drawLock(L.door.x, (L.door.y ?? G) - 34); }
    if (L.door.locked === 'boss') this.doorImg.setVisible(false);
    if (L.cardboardDoor) {
      const cb = L.cardboardDoor;
      if (this.persist.has('bridge')) this.addBridge(cb.bridge[0], cb.bridge[1] - cb.bridge[0], false);
      else this.cardboard = { img: this.add.image(cb.x, G + 3, 'door').setOrigin(0.5, 1).setDisplaySize(96, 64).setDepth(5), state: 'idle' };
    }

    // joueur
    const char = (SaveManager.data.custom.char || 'rosa') as CharId;
    const sp = this.data_.cp ?? L.start;
    this.player = new Player(this, sp.x, sp.y, char);
    this.checkpoint = { ...sp };
    this.physics.add.collider(this.player.rect, this.blocks.filter((b) => b.zone).map((b) => b.zone!), (_p, z) => this.onBlockHit(z as Phaser.GameObjects.Zone));
    this.physics.add.collider(this.player.rect, this.movers.map((m) => m.zone));
    if (this.bossTiles.length) this.physics.add.collider(this.player.rect, this.bossTiles.map((t) => t.zone));

    // pièges du chapitre (créés après le joueur : ils ont besoin de lui)
    const ctx = this.ctx();
    if (L.critters) this.traps.push(new Critters(ctx, L.critters));
    if (L.butterflies) this.traps.push(new Butterflies(ctx, L.butterflies));
    if (L.fleeDoor) { this.fleeDoor = new FleeDoor(ctx, this.doorImg, L.fleeDoor, this.deaths >= 2 ? 1 : 0); this.traps.push(this.fleeDoor); }
    for (const s of L.shy ?? []) this.traps.push(new ShyPlatform(ctx, s.x, s.y, s.w, s.radius));
    if (L.sensors || L.targets) this.traps.push(new Links(ctx, L.sensors ?? [], L.targets ?? []));
    if (L.stalactites) this.traps.push(new Stalactites(ctx, L.stalactites));
    if (L.sky === 'storm') { this.storm = new Storm(ctx); this.traps.push(this.storm); }

    if (L.chaser) {
      const cx = this.data_.cp && this.data_.cp.x > L.chaser.trigger ? this.data_.cp.x - 650 : L.chaser.x;
      this.chaser = { img: this.add.image(cx, G + 6, 'rock').setOrigin(0.5, 1).setDisplaySize(150, 100).setDepth(16).setVisible(false), x: cx, speed: L.chaser.speed, state: 'wait', t: 0 };
    }
    if (L.dark) this.makeDark(L.dark);
    if (L.boss) this.boss = new Megaroc(this, {
      player: this.player, tiles: this.bossTiles, deaths: this.deaths,
      hurt: (x) => this.hurt(x), banner: (t, c, s) => this.banner(t, c, s), taunt: (t) => this.taunt(t), cue: (t, x, y) => this.cue(t, x, y, 2),
      shake: (ms, k) => this.shake(ms, k), burst: (x, y, k, n) => this.burst(x, y, k, n),
      defeated: () => this.bossDefeated(),
    });
    if (this.boss) [2, 5].forEach((i) => this.boss!.crack(this.bossTiles[i]));

    this.makeHud();
    this.drawDeathMarks();
    this.events.off('landed'); this.events.off('jumped');   // la scène est relancée à chaque mort : pas d'écouteurs en double
    this.events.on('landed', (p: Player, vy: number) => this.burst(p.x, p.y, 'dust', vy > 600 ? 12 : 6));
    this.events.on('jumped', (p: Player) => { this.burst(p.x, p.y, 'dust', 4); for (const tr of this.traps) tr.onJump?.(); if (this.controlsStep === 2) this.controlsStep = 3; });
    this.camX = Phaser.Math.Clamp(this.player.x - W * 0.4, 0, Math.max(0, L.width - W)); this.camY = Phaser.Math.Clamp(this.player.y - 330, -200, 0);
    this.cameras.main.setScroll(this.camX, this.camY);
    this.time0 = this.time.now;
    AudioManager.music('prairie');
    InputManager.swallow();
    if (InputManager.device === 'touch' || (typeof window !== 'undefined' && 'ontouchstart' in window)) this.touch = new TouchControls(this);
    this.input.keyboard?.off('keydown-F2'); this.input.keyboard?.on('keydown-F2', () => this.toggleDebug());
    fadeIn(this, this.deaths ? 140 : 260);
    // à l'arrivée : un seul message du soleil (ce qui a changé, sinon une moquerie sur la dernière mort)
    const quip = this.deathQuip(this.data_.cause);
    const arrival = L.taunt ?? quip;
    if (arrival) this.time.delayedCall(450, () => this.taunt(arrival));
    if (L.controls && this.deaths === 0) this.controlsStep = 1;
    // repères après plusieurs morts au même endroit : une lueur sur le danger, et un mot quand on approche
    for (const h of L.hints ?? []) if (this.deathXs.filter((d) => Math.abs(d - h.x) < 220).length >= 2) this.addHintMark(h.x, h.y ?? G - 10, h.text);
    (window as unknown as { __NSF?: unknown }).__NSF = this;
    this.events.once('shutdown', () => { this.touch?.destroy(); this.touch = null; });
  }

  private ctx(): Ctx {
    return {
      scene: this, player: this.player, def: this.def, deaths: this.deaths,
      burst: (x, y, k, n) => this.burst(x, y, k, n), shake: (ms, k) => this.shake(ms, k),
      hurt: (x) => this.hurt(x), kill: (c) => this.kill(c), cue: (t, x, y, pr) => this.cue(t, x, y, pr),
      collide: (z) => this.physics.add.collider(this.player.rect, z),
      snapFlower: (x) => { const f = this.flowers.find((f) => Math.abs(f.x - x) < 10); if (f) { f.snap = 0.5; AudioManager.play('snap'); } },
      unlockCoins: (x, y, dir) => { for (const c of this.coins) if (Math.abs(c.x - x) < 50 && Math.abs(c.y - y) < 50) { if (dir < 0) { c.locked = true; c.img.setVisible(false); } else if (c.locked) { c.locked = false; c.img.setVisible(true).setY(y); this.tweens.add({ targets: c.img, y: c.y, duration: 400, ease: 'Back.Out' }); } } },
    };
  }

  private makeFxTextures(): void {
    if (this.textures.exists('fx_dot')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1); g.fillCircle(6, 6, 6); g.generateTexture('fx_dot', 12, 12); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 5, 5); g.generateTexture('fx_chip', 5, 5); g.clear();
    g.fillStyle(0x5bd35a, 1); g.fillEllipse(5, 3, 10, 6); g.generateTexture('fx_leaf', 10, 6); g.clear();
    g.fillStyle(0x5bd35a, 1); g.fillTriangle(0, 14, 4, 0, 8, 14); g.fillTriangle(6, 14, 11, 2, 14, 14); g.generateTexture('fx_tuft', 14, 14); g.clear();
    g.fillStyle(0xbfe9ff, 1); for (let x = 0; x < 64; x += 16) g.fillEllipse(x + 8, 8, 18, 8); g.fillStyle(0x3aa7e0, 1); g.fillRect(0, 8, 64, 4); g.generateTexture('fx_wave', 64, 12);
    g.destroy();
    // halo de lumière (dégradé radial) pour les niveaux sombres
    const c = this.textures.createCanvas('fx_light', 256, 256);
    if (c) { const x = c.getContext(); const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); c.refresh(); }
  }

  // ---------------- décor : ciel, soleil moqueur ----------------
  private makeSky(): void {
    const s = this.def.sky ?? 'day';
    const top = s === 'night' ? 0x141638 : s === 'storm' ? 0x2b2f4a : s === 'sunset' ? 0xff9a6b : 0x8fd3ff;
    const bot = s === 'night' ? 0x3d3778 : s === 'storm' ? 0x5b6283 : s === 'sunset' ? 0xffe0a3 : 0xdff3ff;
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(top, top, bot, bot, 1); sky.fillRect(0, 0, W, H);
    if (s === 'night') for (let i = 0; i < 50; i++) { const st = this.add.circle(Math.random() * W, Math.random() * 240, 1 + Math.random() * 1.5, 0xffffff, 0.8).setScrollFactor(0).setDepth(-29); this.tweens.add({ targets: st, alpha: 0.2, duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1 }); }
    if (s === 'storm') for (let i = 0; i < 6; i++) { const cl = this.add.ellipse(80 + i * 170, 40 + (i % 2) * 30, 260, 70, 0x23263c, 0.9).setScrollFactor(0.1, 0).setDepth(-24); this.tweens.add({ targets: cl, x: cl.x + 30, duration: 4000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    // soleil (ou lune) qui rit quand on meurt, et qui parle
    this.sun = this.add.container(W - 110, 80).setScrollFactor(0).setDepth(-25);
    const g = this.add.graphics();
    const col = s === 'night' || s === 'storm' ? 0xe8e6ff : 0xffe066;
    g.fillStyle(col, 0.3); g.fillCircle(0, 0, 60); g.fillStyle(COL.outline, 1); g.fillCircle(0, 0, 42); g.fillStyle(col, 1); g.fillCircle(0, 0, 39);
    g.fillStyle(COL.outline, 1); g.fillCircle(-12, -6, 4); g.fillCircle(12, -6, 4);
    this.sunMouth = this.add.graphics(); this.drawSunMouth(false);
    this.sun.add([g, this.sunMouth]);
    this.tweens.add({ targets: this.sun, scale: 1.04, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.parallax = new Parallax(this, 420, -22);
    if (s === 'night') { this.parallax.far.setTint(0x5a5e9a); this.parallax.mid.setTint(0x4a4f88); }
    if (s === 'storm') { this.parallax.far.setTint(0x6a7090); this.parallax.mid.setTint(0x5a6080); }
    if (s === 'sunset') { this.parallax.far.setTint(0xffc9a0); this.parallax.mid.setTint(0xffd8b0); }
    this.add.rectangle(0, G, Math.max(W, this.def.width), 400, 0x10302a, 0.55).setOrigin(0, 0).setDepth(-5);
  }
  private drawSunMouth(laugh: boolean): void {
    const g = this.sunMouth; g.clear();
    if (laugh) { g.fillStyle(COL.outline, 1); g.fillEllipse(0, 12, 26, 18); g.fillStyle(COL.pink, 1); g.fillEllipse(0, 16, 14, 7); }
    else { g.lineStyle(3, COL.outline, 1); g.beginPath(); g.arc(0, 4, 13, 0.3, Math.PI - 0.3); g.strokePath(); }
  }
  private sunLaugh(): void {
    this.drawSunMouth(true); AudioManager.play('laugh'); this.sunT = 1.4;
    this.tweens.add({ targets: this.sun, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => { this.sun.setAngle(0); } });
  }

  // ---------------- construction ----------------
  private addBlock(b: Block): void {
    const L = this.def, kind = b.kind ?? 'solid';
    let ct: Phaser.GameObjects.Container;
    if (kind === 'plank') ct = this.makePlank(b);
    else {
      const touches = (o: Block, side: 'l' | 'r') => o !== b && o.kind !== 'fake' && o.kind !== 'plank' && o.y <= b.y + 1 && o.y + o.h >= b.y + b.h - 1 && (side === 'l' ? Math.abs(o.x + o.w - b.x) < 2 : Math.abs(o.x - b.x - b.w) < 2);
      const nb = { left: L.blocks.some((o) => touches(o, 'l')), right: L.blocks.some((o) => touches(o, 'r')), bottomOpen: b.y + b.h >= 598 };
      ct = buildBlock(this, b.x, b.y, b.w, b.h, kind === 'fake' ? { left: true, right: true, bottomOpen: nb.bottomOpen } : nb).setDepth(4);
    }
    if (kind === 'crumble') drawCracks(this, ct, b.w);
    if ((b.reveal || (readable() && kind !== 'invisible' && kind !== 'plank' && kind !== 'solid')) && (kind === 'fake' || kind === 'crumble' || kind === 'drop')) this.dashed(ct, b.w, Math.min(b.h, 60));
    // le faux sol miroite à peine : on le voit si on regarde
    if (kind === 'fake') this.tweens.add({ targets: ct, alpha: 0.78, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    let zone: Phaser.GameObjects.Zone | null = null, body: Phaser.Physics.Arcade.StaticBody | null = null;
    const hidden = kind === 'invisible' && !b.reveal;
    if (hidden) ct.setVisible(false);
    if (kind !== 'fake') {
      const hh = kind === 'plank' ? 16 : b.h;
      zone = this.add.zone(b.x + b.w / 2, b.y + hh / 2, b.w, hh);
      this.physics.add.existing(zone, true);
      body = zone.body as Phaser.Physics.Arcade.StaticBody;
      if (hidden) { body.checkCollision.up = false; body.checkCollision.left = false; body.checkCollision.right = false; }
    }
    this.blocks.push({ def: b, ct, zone, body, state: 'solid', t: 0, hidden, tell: Math.random(), warned: false });
  }
  private makePlank(b: Block): Phaser.GameObjects.Container {
    const ct = this.add.container(b.x, b.y).setDepth(4), g = this.add.graphics(); ct.add(g);
    const rot = !!b.rot, wood = rot ? 0x6b4a32 : 0xc28a52, dark = rot ? 0x3e2a1c : 0x8a5a32;
    g.fillStyle(COL.outline, 1); g.fillRoundedRect(0, 0, b.w - 2, 16, 3);
    g.fillStyle(wood, 1); g.fillRoundedRect(2, 2, b.w - 6, 12, 2);
    g.fillStyle(dark, 1); g.fillRect(6, 7, b.w - 14, 2);
    if (rot) { g.fillStyle(COL.outline, 1); g.fillCircle(b.w * 0.3, 8, 3); g.fillCircle(b.w * 0.65, 6, 2); g.lineStyle(2, COL.outline, 1); g.lineBetween(b.w * 0.45, 2, b.w * 0.55, 14); }
    return ct;
  }
  // cordes des ponts de planches
  private drawRopes(): void {
    const planks = this.def.blocks.filter((b) => b.kind === 'plank').sort((a, b) => a.x - b.x);
    const g = this.add.graphics().setDepth(3);
    let run: Block[] = [];
    const flush = () => {
      if (run.length < 2) { run = []; return; }
      const a = run[0], z = run[run.length - 1], x0 = a.x, x1 = z.x + z.w, sag = Math.min(14, (x1 - x0) / 30);
      for (const yo of [-20, 4]) { g.lineStyle(3, 0x6b4a32, 1); g.beginPath(); for (let i = 0; i <= 20; i++) { const f = i / 20, x = x0 + (x1 - x0) * f, y = a.y + yo + Math.sin(f * Math.PI) * sag; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.strokePath(); }
      for (const p of [x0 - 6, x1 + 2]) { g.fillStyle(COL.outline, 1); g.fillRect(p, a.y - 30, 6, 46); g.fillStyle(0x8a5a32, 1); g.fillRect(p + 1, a.y - 29, 4, 44); }
      run = [];
    };
    for (const p of planks) { const last = run[run.length - 1]; if (last && p.x - (last.x + last.w) > 4) flush(); run.push(p); }
    flush();
  }
  private dashed(ct: Phaser.GameObjects.Container, w: number, h: number): void {
    const g = this.add.graphics(); g.lineStyle(3, COL.pink, 0.9);
    const seg = (x0: number, y0: number, x1: number, y1: number) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 12); for (let i = 0; i < n; i += 2) { const a = i / n, b2 = Math.min(1, (i + 1) / n); g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b2, y0 + (y1 - y0) * b2); } };
    seg(2, 2, w - 2, 2); seg(w - 2, 2, w - 2, h); seg(2, 2, 2, h);
    ct.add(g); this.tweens.add({ targets: g, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
  }
  // bloc invisible : se révèle quand on s'y cogne la tête
  private onBlockHit(z: Phaser.GameObjects.Zone): void {
    const b = this.blocks.find((x) => x.zone === z);
    if (!b || !b.hidden || !this.player.body.blocked.up && !this.player.body.touching.up) return;
    b.hidden = false; b.ct.setVisible(true).setScale(1, 0.4); this.tweens.add({ targets: b.ct, scaleY: 1, duration: 200, ease: 'Back.Out' });
    b.body!.checkCollision.up = true; b.body!.checkCollision.left = true; b.body!.checkCollision.right = true;
    AudioManager.play('stomp'); this.burst(b.def.x + b.def.w / 2, b.def.y + b.def.h, 'dust', 10);
  }
  addBridge(x: number, w: number, anim = true): void {
    const ct = buildBlock(this, x, G, w, 30, {}).setDepth(4);
    const zone = this.add.zone(x + w / 2, G + 15, w, 30); this.physics.add.existing(zone, true);
    if (this.player) this.physics.add.collider(this.player.rect, zone);
    this.blocks.push({ def: { x, y: G, w, h: 30 }, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, state: 'solid', t: 0, hidden: false, tell: 0, warned: false });
    if (anim) { ct.setScale(0.2, 1); this.tweens.add({ targets: ct, scaleX: 1, duration: 260, ease: 'Back.Out' }); }
  }
  private addMover(x: number, y: number, w: number, mode: string, to: [number, number], speed: number): void {
    const ct = buildBlock(this, x, y, w, 30, {}).setDepth(4);
    const zone = this.add.zone(x + w / 2, y + 15, w, 30); this.physics.add.existing(zone, true);
    this.movers.push({ x, y, w, x0: x, y0: y, x1: to[0], y1: to[1], speed, mode, k: 0, dir: 1, active: mode === 'loop', sinkT: 0, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, fled: false });
    // une plateforme qui coule a des bulles dessous : on le voit avant de monter dessus
    if (mode === 'sink') this.time.addEvent({ delay: 700, loop: true, callback: () => { const m = this.movers.find((q) => q.ct === ct); if (m) this.burst(m.x + Phaser.Math.Between(10, w - 10), m.y + 30, 'dust', 2); } });
  }
  private addSpring(x: number, y: number, power: number, kind: string): void {
    const img = this.add.image(x, y + 2, 'spring').setOrigin(0.5, 1).setDisplaySize(40, 34).setDepth(7);
    let deco: Phaser.GameObjects.Graphics | null = null;
    // chaque ressort piégé se reconnaît : endormi, penché, ou en carton
    if (kind === 'lazy') { img.setDisplaySize(40, 24).setTint(0xd8d8e8); }
    if (kind === 'back') { img.setAngle(-24); deco = this.add.graphics().setDepth(8); deco.fillStyle(COL.pink, 1); deco.fillTriangle(x - 30, y - 48, x - 16, y - 56, x - 16, y - 40); deco.fillRect(x - 17, y - 51, 16, 6); }
    if (kind === 'cardboard') { img.setTint(0xc89a5a); deco = this.add.graphics().setDepth(8); deco.fillStyle(0xe8d6a8, 1); deco.fillRect(x - 18, y - 22, 36, 7); deco.lineStyle(2, 0x8a5a32, 1); deco.strokeRect(x - 18, y - 22, 36, 7); }
    this.springs.push({ x, y, power, kind, used: false, cool: 0, img, deco });
  }
  private addSnail(x: number, y: number, minX: number, maxX: number, possum: boolean, armored: boolean): void {
    const img = this.add.image(x, y + 2, possum ? 'snail_shell' : 'snail_walk_a').setOrigin(0.5, 1).setDepth(9);
    let helmet: Phaser.GameObjects.Graphics | null = null, eye: Phaser.GameObjects.Graphics | null = null;
    if (armored) { helmet = this.add.graphics().setDepth(10); helmet.fillStyle(COL.outline, 1); helmet.fillEllipse(0, 0, 34, 20); helmet.fillStyle(0xb8c0d9, 1); helmet.fillEllipse(0, 0, 30, 16); helmet.fillStyle(0xffffff, 0.6); helmet.fillEllipse(-6, -3, 8, 4); }
    if (possum) { eye = this.add.graphics().setDepth(10); eye.fillStyle(COL.outline, 1); eye.fillCircle(0, 0, 6); eye.fillStyle(0xffffff, 1); eye.fillCircle(0, 0, 4.5); eye.fillStyle(COL.outline, 1); eye.fillCircle(1.5, 0.5, 2); eye.setVisible(false); }
    this.snails.push({ img, helmet, eye, x, y, minX, maxX, vx: -45, alive: true, possum, armor: armored ? 1 : 0, wake: 0, rush: 0, hidden: 0 });
  }
  private addRock(x: number, trigger: number, delay: number): void {
    this.rocks.push({ x, trigger, delay, y: -80, vy: 0, state: 'idle', t: 0, img: this.add.image(x, -80, 'rock').setOrigin(0.5, 1).setDisplaySize(52, 34).setDepth(14).setVisible(false), shadow: this.add.ellipse(x, G + 2, 10, 6, 0x000000, 0.35).setDepth(8).setVisible(false), side: Math.sign(x - trigger) || 1 });
  }
  private addProp(type: string, x: number, y: number): void {
    const fit = (k: string, h: number, d = 3) => { const img = this.add.image(x, y + 4, k).setOrigin(0.5, 1).setDepth(d); img.setDisplaySize((h * img.width) / img.height, h); return img; };
    if (type === 'tree') { const t = fit('tree', 118, 2); this.tweens.add({ targets: t, angle: { from: -1, to: 1 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    else if (type === 'bush') fit('bush', 32);
    else if (type === 'flower') { const f = fit('flower', 28); this.tweens.add({ targets: f, angle: { from: -6, to: 6 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    else if (type === 'mushroom') fit('mushroom_red', 24);
    else if (type === 'rock') fit('rock', 18);
    else if (type === 'shell') {
      // coquille vide, à l'envers et fêlée : elle, elle ne bougera jamais
      const s = this.add.image(x, y + 2, 'snail_shell').setOrigin(0.5, 1).setFlipY(true).setTint(0x9c98ad).setDepth(7); s.setDisplaySize(40, (40 * s.height) / s.width);
      const g = this.add.graphics().setDepth(8); g.lineStyle(2, COL.outline, 1); g.lineBetween(x - 4, y - 20, x + 2, y - 10); g.lineBetween(x + 2, y - 10, x - 2, y - 2);
    }
  }
  // panneau en bois : texte sombre sur un cartouche clair, grande police sans empattement, 2 lignes max
  private addSign(x: number, y: number, text: string): void {
    const label = this.add.text(x, 0, text, textStyle(22, 230)).setOrigin(0.5).setDepth(5);
    const bw = Math.max(110, label.width + 30), bh = label.height + 22, top = y - 52 - bh;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(COL.outline, 1); g.fillRect(x - 6, top + bh - 4, 12, y - top - bh + 8); g.fillStyle(0x8a5a32, 1); g.fillRect(x - 4, top + bh - 4, 8, y - top - bh + 6);
    g.fillStyle(COL.outline, 1); g.fillRoundedRect(x - bw / 2 - 4, top - 4, bw + 8, bh + 8, 10);
    g.fillStyle(0xb07a45, 1); g.fillRoundedRect(x - bw / 2, top, bw, bh, 8);
    g.fillStyle(readable() ? 0xffffff : COL.paper, 1); g.fillRoundedRect(x - bw / 2 + 6, top + 6, bw - 12, bh - 12, 6);
    label.setY(top + bh / 2);
  }
  private addSpikes(x: number, y: number, w: number, down: boolean, hidden: boolean, range: number): void {
    const n = Math.max(1, Math.round(w / 34)), tw = w / n, imgs: Phaser.GameObjects.Image[] = [], tufts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) imgs.push(this.add.image(x + i * tw, y, 'spikes').setOrigin(0, down ? 0 : 1).setFlipY(down).setDisplaySize(tw + 1, 18).setDepth(3));
    if (hidden) for (let i = 0; i < 3; i++) tufts.push(this.add.image(x + 6 + i * ((w - 12) / 2), y + 2, 'fx_tuft').setOrigin(0.5, 1).setDepth(6));
    this.spikes.push({ x, y, w, down, hidden, range, rise: hidden ? 0 : 1, imgs, tufts });
  }
  private makeBossFloor(): void {
    for (let i = 0; i < 8; i++) {
      const x = i * 120, ct = buildBlock(this, x, G, 120, 180, { left: i > 0, right: i < 7, bottomOpen: true }).setDepth(4);
      const cracks = this.add.graphics(); ct.add(cracks);
      const zone = this.add.zone(x + 60, G + 90, 120, 180); this.physics.add.existing(zone, true);
      this.bossTiles.push({ x, w: 120, cracked: false, broken: 0, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, cracks });
    }
    for (const x of [-60, 960]) { const z = this.add.zone(x + 30, 0, 60, 1200); this.physics.add.existing(z, true); this.blocks.push({ def: { x, y: -600, w: 60, h: 1200 }, ct: this.add.container(0, 0), zone: z, body: z.body as Phaser.Physics.Arcade.StaticBody, state: 'solid', t: 0, hidden: false, tell: 0, warned: false }); }
  }
  private makeDark(d: NonNullable<LevelDef['dark']>): void {
    const rt = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setScrollFactor(0).setDepth(90);
    const lan = (x: number, y: number) => { const g = this.add.graphics().setDepth(12); g.fillStyle(COL.outline, 1); g.fillRect(-2, 0, 4, G - y); g.fillStyle(0xfff3a8, 1); g.fillCircle(0, 0, 8); g.lineStyle(2, COL.outline, 1); g.strokeCircle(0, 0, 8); g.setPosition(x, y); return g; };
    this.dark = { rt, lanterns: d.lanterns.map(([x, y]) => ({ x, y, g: lan(x, y) })), walker: null };
    if (d.walker) { const g = this.add.graphics().setDepth(12); g.fillStyle(0xfff3a8, 1); g.fillCircle(0, 0, 7); g.setPosition(d.walker[0], d.walker[1]); this.dark.walker = { x: d.walker[0], y: d.walker[1], g, gone: false }; }
  }
  private drawLock(x: number, y: number): void {
    const g = this.lock!; g.clear();
    g.lineStyle(5, COL.outline, 1); g.beginPath(); g.arc(x, y - 6, 9, Math.PI, 0); g.strokePath();
    g.fillStyle(COL.outline, 1); g.fillRoundedRect(x - 14, y - 6, 28, 22, 5); g.fillStyle(COL.sun, 1); g.fillRoundedRect(x - 11, y - 3, 22, 16, 4); g.fillStyle(COL.outline, 1); g.fillCircle(x, y + 4, 3);
  }
  // traces des essais précédents : de petits fantômes là où on est mort
  private drawDeathMarks(): void {
    for (const [x, y] of this.deathPts.slice(-6)) {
      const g = this.add.graphics().setDepth(6).setAlpha(0.55);
      g.fillStyle(0xffffff, 1); g.fillCircle(0, -14, 10); g.fillRect(-10, -14, 20, 12); for (let i = 0; i < 3; i++) g.fillTriangle(-10 + i * 7, -2, -3 + i * 7, -2, -6.5 + i * 7, 4);
      g.fillStyle(COL.outline, 1); g.fillCircle(-4, -15, 2); g.fillCircle(4, -15, 2);
      const yy = Math.min(y, G + 10) - 6; g.setPosition(x, yy);
      this.tweens.add({ targets: g, y: yy - 6, duration: 1200 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }
  private addHintMark(x: number, y: number, text?: string): void {
    const ring = this.add.circle(x, y, 26).setStrokeStyle(4, COL.sun, 1).setDepth(13);
    this.tweens.add({ targets: ring, scale: 1.5, alpha: 0.2, duration: 800, repeat: -1 });
    this.hintMarks.push({ x, y, text, said: false });
  }

  // ---------------- interface ----------------
  private makeHud(): void {
    const big = readable(), sz = big ? 26 : 22;
    this.deathText = this.add.text(18, 16, `☠ ${this.deaths}`, { fontFamily: FONT.display, fontSize: `${sz}px`, color: CSS.paper, stroke: CSS.ink, strokeThickness: 7 }).setScrollFactor(0).setDepth(100);
    this.add.image(W - 120, 32, 'coin_gold').setDisplaySize(28, 28).setScrollFactor(0).setDepth(100);
    this.coinText = this.add.text(W - 100, 32, '0', { fontFamily: FONT.display, fontSize: `${sz}px`, color: CSS.paper, stroke: CSS.ink, strokeThickness: 7 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    if (this.def.door.locked === 'snails') {
      this.add.image(W / 2 - 30, 32, 'snail_walk_a').setDisplaySize(36, 30).setScrollFactor(0).setDepth(100);
      this.snailText = this.add.text(W / 2 - 6, 32, '', { fontFamily: FONT.display, fontSize: `${sz}px`, color: CSS.paper, stroke: CSS.ink, strokeThickness: 7 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    }
    this.hints = new Hints(this, () => this.player ? { x: this.player.x - this.cameras.main.scrollX, y: this.player.y - this.cameras.main.scrollY } : null);
    this.bannerCt = this.add.container(W / 2, H / 2 - 40).setScrollFactor(0).setDepth(120).setVisible(false);
    this.debugText = this.add.text(8, H - 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#000000aa' }).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setVisible(false);
  }
  // le soleil parle (bulle en haut à droite)
  taunt(t: string): void { this.hints.say(t, { who: 'mascot', prio: 1 }); this.drawSunMouth(true); this.sunT = Math.max(this.sunT, 1.2); }
  // indication courte près d'un élément du niveau
  cue(t: string, x: number, y: number, prio = 2): void { this.hints.say(t, { who: 'cue', at: { x, y }, prio }); }
  private deathQuip(cause?: string): string | undefined {
    if (!cause || cause === 'restart') return undefined;
    const msg: Record<string, string[]> = { pit: ['Le vide ne pardonne pas.', 'Chute libre !'], water: ['Plouf.', 'Tu ne sais pas nager ?'], spikes: ['Ça pique.', 'Aïe.'], spike: ['Regarde en l\'air, parfois.', 'Il fallait attendre.'], rock: ['Ça tombe du ciel.'], chaser: ['Écrasé.', 'Il roulait plus vite.'], hearts: ['Trois coups, c\'est trop.', 'K.O.'] };
    const list = msg[cause] ?? ['Raté.'];
    return list[this.deaths % list.length];
  }
  banner(text: string, color: string, sub?: string): void {
    const c = this.bannerCt; c.removeAll(true).setVisible(true).setScale(0.4).setAlpha(1);
    const bh = sub ? 134 : 100, bg = this.add.graphics(); bg.fillStyle(COL.ink, 1); bg.fillRoundedRect(-270, -56, 540, bh, 18); bg.lineStyle(5, Phaser.Display.Color.HexStringToColor(color).color, 1); bg.strokeRoundedRect(-270, -56, 540, bh, 18);
    c.add([bg, this.add.text(0, -8, text, { fontFamily: FONT.display, fontSize: '36px', color, padding: { top: 6 } }).setOrigin(0.5)]);
    if (sub) c.add(this.add.text(0, 44, sub, { fontFamily: FONT.body, fontStyle: '900', fontSize: readable() ? '26px' : '22px', color: '#ffffff' }).setOrigin(0.5));
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: readable() ? 1900 : 1300, duration: 300, onComplete: () => c.setVisible(false) });
    if (!SaveManager.data.settings.reduceFx) this.burst(this.player.x, this.player.y - 40, 'spark', 26);
  }
  shake(ms: number, k: number): void { if (SaveManager.data.settings.shake && !SaveManager.data.settings.reduceFx) this.cameras.main.shake(ms, k); }
  burst(x: number, y: number, kind: 'dust' | 'chips' | 'spark' | 'leaf', n = 8): void {
    if (!this.fx) {
      const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) => this.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(30);
      this.fx = {
        dust: mk('fx_dot', { speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, lifespan: 420, scale: { start: 0.7, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xf6e7cf, gravityY: -60 }),
        chips: mk('fx_chip', { speed: { min: 80, max: 230 }, angle: { min: 200, max: 340 }, lifespan: 900, scale: { start: 1.4, end: 0.6 }, tint: [0xf47b3f, 0xc8582a, 0x4bd25f], gravityY: 900, rotate: { min: 0, max: 360 } }),
        spark: mk('fx_dot', { speed: { min: 60, max: 220 }, angle: { min: 0, max: 360 }, lifespan: 600, scale: { start: 0.5, end: 0 }, tint: [0xffd23f, 0xffffff, 0xff4f87], gravityY: 150, blendMode: 'ADD' }),
        leaf: mk('fx_leaf', { speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, lifespan: 1200, rotate: { min: 0, max: 360 }, gravityY: 120 }),
      };
    }
    if (SaveManager.data.settings.reduceFx) n = Math.ceil(n / 3);
    this.fx[kind].explode(n, x, y);
  }
  // petits cailloux qui tombent sous un sol fragile (indice)
  private pebbles(x: number, y: number, n = 2): void { for (let i = 0; i < n; i++) this.fx ? this.fx.chips.explode(1, x + Phaser.Math.Between(-20, 20), y) : this.burst(x, y, 'chips', 1); }

  // ---------------- règles ----------------
  hurt(fromX: number): void { if (this.player.hurt(fromX)) this.kill('hearts'); else this.shake(120, 0.006); }
  kill(cause: string): void {
    const p = this.player;
    if (p.dead || this.won) return;
    p.dead = true; this.deathLog.push(`${cause}@${Math.round(p.x)}`);
    if (cause !== 'restart') { this.deathXs.push(p.x); this.deathPts.push([Math.round(p.x), Math.round(Math.min(p.y, G + 20))]); }
    SaveManager.data.totalDeaths++; SaveManager.write();
    AudioManager.play('die'); this.shake(220, 0.012); this.sunLaugh();
    p.body.setVelocity(0, 0); p.body.enable = false; p.view.mood = 'hurt';
    this.burst(p.x, p.y - 15, 'spark', 14);
    this.tweens.add({ targets: p.view, y: p.view.y - 50, angle: 200 * (p.face || 1), duration: 380, ease: 'Quad.Out' });
    this.tweens.add({ targets: p.view, alpha: 0, delay: 300, duration: 300 });
    this.deathText.setText(`☠ ${this.deaths + 1}`);
    this.time.delayedCall(750, () => {
      this.cameras.main.fadeOut(140, 29, 26, 57);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({
        level: this.levelIndex, deaths: this.deaths + 1, cp: this.checkpoint.x !== this.def.start.x || this.checkpoint.y !== this.def.start.y ? this.checkpoint : null,
        coins: [...this.coinKeys], flags: [...this.persist], elapsed: this.elapsed, deathXs: this.deathXs, deathPts: this.deathPts, cause,
      } satisfies GameData));
    });
  }
  private win(): void {
    if (this.won) return;
    this.won = true; const p = this.player; p.frozen = true; p.body.setVelocity(0, p.body.velocity.y); p.view.mood = 'happy';
    const dx = this.fleeDoor ? this.fleeDoor.x : this.def.door.x, dy = this.def.door.y ?? G;
    AudioManager.play('win'); this.burst(dx, dy - 40, 'spark', 40);
    this.tweens.add({ targets: p.view, x: dx, alpha: 0, scale: 0.6, duration: 600, delay: 200 });
    const spec = CHAPTER1[this.levelIndex], coins = this.coinKeys.size, total = (this.def.coins ?? []).length, time = this.elapsed;
    const stars = 1 + (this.deaths <= 3 ? 1 : 0) + (coins >= total ? 1 : 0);
    SaveManager.record(spec.id, { time, deaths: this.deaths, coins, stars });
    this.time.delayedCall(1100, () => goTo(this, 'Results', { level: this.levelIndex, id: spec.id, title: spec.title, time, deaths: this.deaths, coins, total, stars }));
  }
  private bossDefeated(): void {
    this.doorImg.setVisible(true).setScale(this.doorImg.scaleX, 0.01);
    this.tweens.add({ targets: this.doorImg, scaleY: 64 / this.doorImg.height, duration: 500, delay: 800, ease: 'Back.Out' });
    this.time.delayedCall(800, () => { this.banner('MÉGAROC EST VAINCU !', CSS.mint, 'Pour de vrai, cette fois.'); this.def.door.locked = undefined; });
  }
  private toggleDebug(): void {
    this.debugOn = !this.debugOn;
    if (this.debugOn && !this.physics.world.debugGraphic) this.physics.world.createDebugGraphic();
    this.physics.world.drawDebug = this.debugOn;
    this.physics.world.debugGraphic?.setVisible(this.debugOn);
    this.debugText.setVisible(this.debugOn);
  }

  // ---------------- boucle ----------------
  update(_t: number, dms: number): void {
    const dt = Math.min(0.1, dms / 1000), t = this.time.now / 1000, p = this.player, L = this.def;
    if (!this.won) this.elapsed = this.elapsed0 + (this.time.now - this.time0) / 1000;
    if (InputManager.pressed('pause') && !this.won) { this.scene.launch('Pause'); this.scene.pause(); return; }
    if (InputManager.pressed('restart') && !p.dead && !this.won) this.kill('restart');
    // plateformes mobiles (avant le joueur, pour le transporter)
    let carry = { dx: 0, dy: 0 };
    for (const m of this.movers) {
      const on = !p.dead && p.onGround && p.x + PW / 2 > m.x && p.x - PW / 2 < m.x + m.w && Math.abs(p.y - m.y) < 4;
      const ox = m.x, oy = m.y;
      if (m.mode === 'loop') {
        const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1; m.k += (m.dir * m.speed * dt) / len;
        if (m.k >= 1 || m.k <= 0) { m.dir *= -1; m.k = Phaser.Math.Clamp(m.k, 0, 1); }
        m.x = m.x0 + (m.x1 - m.x0) * m.k; m.y = m.y0 + (m.y1 - m.y0) * m.k;
      } else if (m.mode === 'ride' || m.mode === 'sink') {
        if (on) m.active = true;
        if (m.active && m.speed > 0) { const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1; m.k = Math.min(1, m.k + (m.speed * dt) / len); m.x = m.x0 + (m.x1 - m.x0) * m.k; m.y = m.y0 + (m.y1 - m.y0) * m.k; }
        if (m.mode === 'sink' && m.active && m.k > 0.4) { m.sinkT += dt; m.y = m.y0 + m.sinkT * 55; if (Math.floor(m.sinkT * 8) !== Math.floor((m.sinkT - dt) * 8)) this.burst(m.x + m.w / 2, m.y + 10, 'dust', 3); }
      } else if (m.mode === 'flee') {
        if (!m.fled && !p.onGround && p.body.velocity.y > -200 && Math.abs(p.x - (m.x + m.w / 2)) < 150 && p.x < m.x + m.w / 2) { m.fled = true; AudioManager.play('whoosh'); }
        if (m.fled) { m.x = Math.min(m.x1, m.x + m.speed * dt); }
      }
      m.ct.setPosition(m.x, m.y); m.zone.setPosition(m.x + m.w / 2, m.y + 15); m.body.updateFromGameObject();
      if (on) carry = { dx: m.x - ox, dy: m.y - oy };
    }
    if (carry.dx || carry.dy) { p.rect.x += carry.dx; p.rect.y += carry.dy; }   // le corps physique suit l'objet à l'image suivante
    p.update(dt);
    if (!p.dead && p.y > 640) this.kill('pit');
    for (const [a, b] of L.water ?? []) if (!p.dead && p.x > a && p.x < b && p.y > G + 30) this.kill('water');

    this.updateGrounds(dt, t);
    // pics
    for (const s of this.spikes) {
      const dx = Math.max(s.x - p.x, p.x - (s.x + s.w), 0);
      if (s.hidden) {
        const wake = !p.dead && dx < s.range && Math.abs(p.y - s.y) < 60;
        const was = s.rise; s.rise = Phaser.Math.Clamp(s.rise + (wake ? dt * 9 : -dt * 1.5), 0, 1);
        s.tufts.forEach((tf, i) => tf.setAngle(dx < s.range + 110 && s.rise < 0.5 ? Math.sin(t * 30 + i) * 14 : 0).setVisible(s.rise < 0.6));
        if (was === 0 && s.rise > 0) AudioManager.play('trap');
      }
      s.imgs.forEach((im) => im.setY(s.down ? s.y - (1 - s.rise) * 18 : s.y + (1 - s.rise) * 18).setVisible(s.rise > 0.02));
      const hit = s.down ? p.y - 30 < s.y + 18 && p.y > s.y : p.y > s.y - 16 && p.y <= s.y + 6;
      if (!p.dead && s.rise > 0.5 && p.x + 9 > s.x + 4 && p.x - 9 < s.x + s.w - 4 && hit) this.kill('spikes');
    }
    this.updateSprings(dt, t);
    // pièces
    for (const c of this.coins) {
      if (c.got || c.locked) continue;
      const sw = Math.abs(Math.cos(t * 3 + c.x * 0.05));
      c.img.setY(c.y + Math.sin(t * 3 + c.x) * 3).setScale(Math.max(0.15, sw) * (24 / c.img.width), 24 / c.img.height);
      if (!p.dead && Math.abs(p.x - c.x) < 22 && Math.abs(p.y - 15 - c.y) < 26) { c.got = true; this.coinKeys.add(c.key); AudioManager.play('coin'); this.burst(c.x, c.y, 'spark', 10); this.tweens.add({ targets: c.img, y: c.y - 40, alpha: 0, duration: 300, onComplete: () => c.img.setVisible(false) }); }
    }
    this.coinText.setText(`${this.coinKeys.size}/${(L.coins ?? []).length}`);
    this.updateSnails(dt, t);
    this.updateRocks(dt);
    this.updateFlowers(dt, t);
    for (const tr of this.traps) tr.update(dt, t);
    // drapeaux
    for (const f of this.flags) {
      if (f.on || p.dead || Math.abs(p.x - f.x) > 24 || Math.abs(p.y - f.y) > 60) continue;
      f.on = true; this.checkpoint = { x: f.x, y: f.y }; AudioManager.play('checkpoint');
      f.ct.destroy(); f.ct = makeFlag(this, f.x, f.y, COL.mint); this.burst(f.x, f.y - 60, 'spark', 16);
    }
    this.updateCardboard(t);
    this.updateChaser(dt);
    if (this.boss) this.boss.update(dt);
    if (this.dark) this.updateDark(dt, t);
    this.updateControls();
    for (const h of this.hintMarks) if (!h.said && h.text && !p.dead && Math.abs(p.x - h.x) < 300) { h.said = true; this.cue(h.text, h.x, h.y - 40, 3); }
    // porte (verrouillée tant qu'il reste des escargots, ou tant que le boss est debout)
    const alive = this.snails.filter((s) => s.alive).length;
    if (this.snailText) this.snailText.setText(`× ${alive}`);
    if (this.lock && !alive) { this.lock.destroy(); this.lock = null; AudioManager.play('checkpoint'); this.burst(L.door.x, G - 40, 'spark', 20); }
    const locked = (L.door.locked === 'snails' && alive > 0) || L.door.locked === 'boss' || (this.fleeDoor !== null && !this.fleeDoor.ready);
    const doorX = this.fleeDoor ? this.fleeDoor.x : L.door.x;
    if (!p.dead && !this.won && !locked && Math.abs(p.x - doorX) < 22 && Math.abs(p.y - (L.door.y ?? G)) < 30) this.win();

    // caméra : anticipe la direction, suit doucement en vertical
    this.lookAhead += ((p.body.velocity.x !== 0 ? p.face * 90 : p.face * 50) - this.lookAhead) * Math.min(1, dt * 2.5);
    const tx = Phaser.Math.Clamp(p.x - W / 2 + this.lookAhead, 0, Math.max(0, L.width - W)), ty = Phaser.Math.Clamp(p.y - 330, -200, 0);
    this.camX += (tx - this.camX) * Math.min(1, dt * 6); this.camY += (ty - this.camY) * Math.min(1, dt * 3);
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.parallax.update(this.camX, this.camY);
    this.hints.update(dt);
    if (this.sunT > 0) { this.sunT -= dt; if (this.sunT <= 0) this.drawSunMouth(false); }
    p.prevY = p.y;
    if (this.debugOn) this.debugText.setText(`x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} vx ${p.body.velocity.x.toFixed(0)} vy ${p.body.velocity.y.toFixed(0)} sol ${p.onGround} coups ${3 - p.hp} morts ${this.deaths}`);
  }

  // commandes montrées au tout début (1-1) : → puis saut, selon l'appareil, et elles disparaissent dès qu'on les a utilisées
  private updateControls(): void {
    const p = this.player, dev = InputManager.device;
    if (this.controlsStep === 1) { this.cue(dev === 'gamepad' ? 'Stick →' : dev === 'touch' ? 'Touche ▶' : 'Flèche →', p.x + 40, p.y - 50, 3); if (p.x > this.def.start.x + 60) this.controlsStep = 2; }
    else if (this.controlsStep === 2 && p.x > 700) { this.controlsStep = 4; this.hints.clear(); }
    else if (this.controlsStep === 2 && p.x > 260) this.cue(dev === 'gamepad' ? 'Saute : Ⓐ' : dev === 'touch' ? 'Saute : ⤒' : 'Saute : Espace', p.x + 60, p.y - 50, 3);
    else if (this.controlsStep === 3) { this.controlsStep = 4; this.hints.clear(); }
  }

  // sols piégés : ils se trahissent quand on approche (tremblement, cailloux, craquements)
  private updateGrounds(dt: number, t: number): void {
    const p = this.player;
    for (const b of this.blocks) {
      const k = b.def.kind;
      if ((k !== 'crumble' && k !== 'drop' && k !== 'plank') || !b.body) continue;
      const on = !p.dead && p.onGround && p.x + PW / 2 > b.def.x && p.x - PW / 2 < b.def.x + b.def.w && Math.abs(p.y - b.def.y) < 4;
      const near = !p.dead && Math.abs(p.x - (b.def.x + b.def.w / 2)) < 230;
      if (b.state === 'solid') {
        // l'annonce : petits frissons réguliers et cailloux qui tombent dessous
        if (near && (k === 'crumble' || (k === 'plank' && b.def.rot))) {
          b.tell += dt;
          const period = k === 'plank' ? 0.55 : 0.9;
          if (b.tell > period) { b.tell = 0; this.pebbles(b.def.x + b.def.w / 2, b.def.y + (k === 'plank' ? 16 : 30), k === 'plank' ? 1 : 2); if (!b.warned) { b.warned = true; AudioManager.play('creak'); } }
          const sh = b.tell < 0.16 ? Math.sin(t * 90) * (k === 'plank' ? 1.5 : 2) : 0;
          b.ct.setPosition(b.def.x + sh, b.def.y);
        }
        if (on) { b.state = 'shaking'; b.t = b.def.delay ?? (k === 'drop' ? 0.12 : k === 'plank' ? (b.def.rot ? 0.1 : 0.6) : 0.42); AudioManager.play(k === 'plank' ? 'creak' : 'crack'); }
      }
      if (b.state === 'shaking') {
        b.t -= dt;
        const sag = k === 'plank' ? Math.min(6, (0.6 - b.t) * 12) : 0;
        b.ct.setPosition(b.def.x + (Math.random() - 0.5) * 4, b.def.y + sag + (Math.random() - 0.5) * 2);
        if (k === 'plank' && Math.random() < 0.2) this.pebbles(b.def.x + b.def.w / 2, b.def.y + 16, 1);
        if (b.t <= 0) {
          b.state = 'falling'; b.body.enable = false; AudioManager.play(k === 'plank' ? 'snap' : 'trap');
          this.burst(b.def.x + b.def.w / 2, b.def.y + 4, 'chips', k === 'plank' ? 8 : 22); if (k !== 'plank') this.shake(160, 0.008);
          this.tweens.add({ targets: b.ct, y: b.def.y + 500, angle: k === 'plank' ? 40 : 6, duration: 900, ease: 'Quad.In' });
        }
      }
    }
  }

  // ressorts (normal, endormi, qui renvoie en arrière, en carton) — chacun a son allure
  private updateSprings(dt: number, t: number): void {
    const p = this.player;
    for (const s of this.springs) {
      s.cool = Math.max(0, s.cool - dt);
      if (s.kind === 'lazy' && Math.floor(t * 1.2 + s.x) !== Math.floor((t - dt) * 1.2 + s.x) && !s.used) {
        const z = this.add.text(s.x + 10, s.y - 30, 'z', { fontFamily: FONT.display, fontSize: '18px', color: '#ffffff', stroke: CSS.ink, strokeThickness: 4 }).setDepth(9);
        this.tweens.add({ targets: z, y: s.y - 70, x: s.x + 24, alpha: 0, duration: 1400, onComplete: () => z.destroy() });
      }
      if (s.cool > 0 || p.dead || p.body.velocity.y < 0 || Math.abs(p.x - s.x) > 22 || p.y < s.y - 34 || p.y > s.y + 2 || (s.kind === 'cardboard' && s.used)) continue;
      s.cool = 0.4; const first = !s.used; s.used = true;
      if (s.kind === 'cardboard') { AudioManager.play('fake'); this.tweens.add({ targets: s.img, scaleY: s.img.scaleY * 0.25, duration: 160 }); s.img.setY(s.y + 2); s.deco?.setVisible(false); this.burst(s.x, s.y - 10, 'chips', 8); continue; }
      if (s.kind === 'lazy' && first) { p.bounce(260); AudioManager.play('fake'); }
      else if (s.kind === 'back' && first) { p.bounce(620); p.body.setVelocityX(-420); AudioManager.play('spring'); }
      else { p.bounce(s.power); AudioManager.play('spring'); }
      this.tweens.add({ targets: s.img, scaleY: { from: s.img.scaleY * 0.5, to: s.img.scaleY }, duration: 260, ease: 'Back.Out' });
    }
  }

  // fleurs piégées : elles se tournent vers toi, referment leurs pétales et tremblent… puis mordent
  private updateFlowers(dt: number, t: number): void {
    const p = this.player;
    for (const f of this.flowers) {
      const dx = p.x - f.x, close = !p.dead && Math.abs(dx) < 46 && p.y > G - 46;
      const watch = !p.dead && Math.abs(dx) < 220;
      f.near = close ? f.near + dt : Math.max(0, f.near - dt * 2); f.cool = Math.max(0, f.cool - dt); f.snap = Math.max(0, f.snap - dt);
      const wind = Math.min(1, f.near / 0.32), shut = Math.max(wind, f.snap > 0 ? 1 : 0, watch ? 0.25 : 0);
      f.img.setAngle((watch ? Phaser.Math.Clamp(dx / 8, -16, 16) : Math.sin(t * 3) * 4) + (close || f.snap > 0 ? Math.sin(t * 50) * 4 : 0));
      f.img.setDisplaySize(34 * (1 - shut * 0.35), 38).setTint(shut > 0.5 ? 0xe9a8ff : 0xffffff);
      f.jaw.clear(); f.jaw.fillStyle(0xffffff, 1); f.jaw.lineStyle(1.5, COL.outline, 1);
      for (let i = -1; i <= 1; i++) { const x0 = f.x + i * 6; f.jaw.fillTriangle(x0 - 3, G - 26, x0 + 3, G - 26, x0, G - 20 + shut * 6); f.jaw.strokeTriangle(x0 - 3, G - 26, x0 + 3, G - 26, x0, G - 20 + shut * 6); }
      if (wind >= 1 && f.cool <= 0) { f.cool = 1.2; f.near = 0; f.snap = 0.4; AudioManager.play('snap'); this.hurt(f.x); }
    }
  }

  private updateSnails(dt: number, t: number): void {
    const p = this.player;
    for (const sn of this.snails) {
      if (!sn.alive) continue;
      const Y = sn.y;
      if (sn.possum && sn.wake <= 0) {
        // il fait le mort… mais il respire, et un œil regarde de temps en temps
        const peek = Math.sin(t * 1.3 + sn.x) > 0.75;
        sn.eye?.setVisible(peek).setPosition(sn.x + (p.x > sn.x ? 10 : -10), Y - 18);
        if (!p.dead && Math.abs(p.x - sn.x) < 70 && Math.abs(p.y - Y) < 60) { sn.wake = 0.35; sn.eye?.setVisible(false); const ex = this.add.text(sn.x, Y - 50, '!', { fontFamily: FONT.display, fontSize: '28px', color: CSS.pink, stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5).setDepth(20); this.tweens.add({ targets: ex, y: Y - 70, alpha: 0, duration: 700, onComplete: () => ex.destroy() }); }
      } else if (sn.possum && sn.wake > 0 && sn.rush === 0) { sn.wake -= dt; if (sn.wake <= 0) { sn.rush = 1.4; sn.possum = false; sn.vx = Math.sign(p.x - sn.x || 1) * 150; AudioManager.play('laugh'); } }
      else if (sn.hidden > 0) { sn.hidden -= dt; }
      else {
        if (sn.rush > 0) { sn.rush -= dt; if (sn.rush <= 0) sn.vx = Math.sign(sn.vx) * 45; }
        sn.x += sn.vx * dt; if (sn.x < sn.minX || sn.x > sn.maxX) { sn.vx *= -1; sn.x = Phaser.Math.Clamp(sn.x, sn.minX, sn.maxX); }
        sn.img.setTexture(Math.floor(t * (sn.rush > 0 ? 14 : 6)) % 2 ? 'snail_walk_a' : 'snail_walk_b').setFlipX(sn.vx > 0);
      }
      const possumIdle = sn.possum && sn.wake <= 0;
      if (sn.hidden > 0 || possumIdle) sn.img.setTexture('snail_shell');
      const breathe = possumIdle ? 1 + Math.sin(t * 4 + sn.x) * 0.05 : 1;
      sn.img.setPosition(sn.x, Y + 2).setDisplaySize(44 * breathe, ((44 * sn.img.height) / sn.img.width) * (2 - breathe));
      sn.helmet?.setPosition(sn.x + (sn.vx > 0 ? 4 : -4), Y - 22);
      if (p.dead || Math.abs(p.x - sn.x) > 30 || p.y < Y - 34 || p.y > Y + 4) continue;
      if (p.prevY <= Y - 18 && p.body.velocity.y >= 0) {
        p.bounce(420); AudioManager.play('stomp'); this.burst(sn.x, Y - 12, 'dust', 10);
        if (sn.armor > 0) { sn.armor--; const h = sn.helmet!; sn.helmet = null; this.tweens.add({ targets: h, y: Y - 120, x: sn.x + 60, angle: 400, alpha: 0, duration: 700, onComplete: () => h.destroy() }); sn.hidden = 0.6; continue; }
        sn.alive = false; sn.img.setTexture('snail_shell'); sn.eye?.destroy();
        this.tweens.add({ targets: sn.img, y: Y + 80, angle: 180, alpha: 0, duration: 700, ease: 'Quad.In' });
      } else if (!possumIdle) this.hurt(sn.x);
    }
  }

  private updateRocks(dt: number): void {
    const p = this.player, L = this.def;
    if (L.rockRain && !p.dead && !this.won) {
      this.rockRainT -= dt;
      if (this.rockRainT <= 0) { this.rockRainT = L.rockRain; const x = Phaser.Math.Clamp(p.x + p.body.velocity.x * 0.5, 40, L.width - 40); this.addRock(x, x, 0.7); const r = this.rocks[this.rocks.length - 1]; r.state = 'warn'; r.t = 0; r.shadow.setVisible(true); }
    }
    for (const r of this.rocks) {
      if (r.state === 'idle') { if (!p.dead && (r.side > 0 ? p.x > r.trigger : p.x < r.trigger)) { r.state = 'warn'; r.t = 0; r.shadow.setVisible(true); AudioManager.play('whoosh'); } continue; }
      if (r.state === 'warn') { r.t += dt; r.shadow.setSize(10 + r.t * 70, 6 + r.t * 8); if (r.t >= r.delay) { r.state = 'fall'; r.y = this.camY - 60; r.vy = 300; r.img.setVisible(true); } }
      else if (r.state === 'fall') {
        r.vy += 2400 * dt; r.y += r.vy * dt; r.img.setPosition(r.x, r.y).setAngle(r.y);
        if (!p.dead && Math.abs(p.x - r.x) < 26 && r.y > p.y - 30 && r.y - 34 < p.y) this.kill('rock');
        if (r.y >= G + 2) { r.state = 'done'; AudioManager.play('stomp'); this.shake(120, 0.006); this.burst(r.x, G, 'chips', 14); r.img.setVisible(false); r.shadow.setVisible(false); }
      }
    }
  }

  private updateCardboard(t: number): void {
    const cb = this.cardboard, p = this.player, d = this.def.cardboardDoor;
    if (!cb || !d || cb.state !== 'idle') return;
    cb.img.setAngle(Math.sin(t * 2.2) * 0.8);   // indice : elle tangue, comme un décor mal fixé
    if (p.dead || Math.abs(p.x - d.x) > 30 || Math.abs(p.y - G) > 50) return;
    cb.state = 'fooled'; p.frozen = true; p.body.setVelocityX(0);
    AudioManager.play('win'); this.banner('NIVEAU RÉUSSI !', CSS.sun);
    this.time.delayedCall(1300, () => {
      AudioManager.play('fake'); this.banner('… OU PAS !', CSS.pink, 'C\'était une porte en carton.');
      p.frozen = false;
      this.tweens.add({ targets: cb.img, angle: 90, x: d.x + 30, duration: 420, ease: 'Quad.In', onComplete: () => {
        AudioManager.play('stomp'); this.shake(120, 0.006); this.burst(d.bridge[0] + 60, G, 'dust', 14);
        this.tweens.add({ targets: cb.img, alpha: 0, duration: 200 });
        this.addBridge(d.bridge[0], d.bridge[1] - d.bridge[0]); this.persist.add('bridge'); cb.state = 'bridge';
      } });
    });
  }

  // rocher qui poursuit : d'abord le sol gronde et de la poussière tombe, ensuite seulement il arrive
  private updateChaser(dt: number): void {
    const c = this.chaser, p = this.player, L = this.def;
    if (!c || !L.chaser || this.won) return;
    c.t += dt;
    if (c.state === 'wait') { if (!p.dead && p.x > L.chaser.trigger) { c.state = 'rumble'; c.t = 0; AudioManager.play('rumble'); this.shake(900, 0.004); } return; }
    if (c.state === 'rumble') {
      if (Math.floor(c.t * 10) !== Math.floor((c.t - dt) * 10)) this.burst(this.camX + Math.random() * W, this.camY + 10, 'chips', 2);
      if (c.t > 0.9) { c.state = 'roll'; c.img.setVisible(true); c.x = Math.min(c.x, this.camX - 120); this.cue('Cours !', p.x + 30, p.y - 60, 3); }
      return;
    }
    if (c.state === 'roll') {
      c.x += c.speed * dt; c.img.setX(c.x).setAngle(c.x * 0.8);
      if (Math.floor(c.x / 40) !== Math.floor((c.x - c.speed * dt) / 40)) this.burst(c.x - 40, G, 'dust', 3);
      if (c.x >= L.chaser.stopAt) { c.state = 'stopped'; AudioManager.play('trap'); this.shake(300, 0.02); this.burst(c.x + 60, G - 40, 'chips', 30); }
      if (!p.dead && Math.abs(p.x - c.x) < 62 && p.y > G - 100) this.kill('chaser');
    }
  }

  private updateDark(dt: number, t: number): void {
    const d = this.dark!, L = this.def.dark!, p = this.player, cam = this.cameras.main;
    if (d.walker && !d.walker.gone) {
      const w = d.walker;
      if (Math.abs(p.x - w.x) < 160) w.x += 70 * dt * Math.sign(w.x - p.x || 1);
      w.g.setPosition(w.x, w.y + Math.sin(t * 3) * 4);
      if (w.x > 1340) { w.gone = true; this.tweens.add({ targets: w.g, alpha: 0, duration: 400 }); }
    }
    // un éclair éclaire tout pendant un instant
    const lit = this.storm ? Math.min(1, this.storm.flash / 0.4) : 0;
    d.rt.clear(); d.rt.fill(0x05030f, (readable() ? 0.82 : 0.92) * (1 - lit * 0.75));
    const hole = (x: number, y: number, r: number) => d.rt.stamp('fx_light', undefined, x - cam.scrollX, y - cam.scrollY, { scale: (r * 2) / 256, blendMode: Phaser.BlendModes.ERASE });
    hole(p.x, p.y - 15, L.radius);
    for (const l of d.lanterns) hole(l.x, l.y, 140 + Math.sin(t * 4 + l.x) * 6);
    if (d.walker && !d.walker.gone) hole(d.walker.x, d.walker.y, 120);
    d.rt.render();
  }
}
