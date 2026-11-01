// Scène de jeu : construit un niveau du chapitre à partir de sa fonction (qui dépend du nombre de morts),
// gère le joueur, les pièges, les ennemis, la caméra. À chaque mort, le niveau est reconstruit : la carte change.
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
import { makeFlag, TAUNT_STYLE } from '../traps/Traps';
import { Megaroc, type Tile } from '../entities/Megaroc';
import { fadeIn, goTo } from '../ui/Transition';
import { TouchControls } from '../ui/TouchControls';

export interface GameData { level: number; deaths?: number; cp?: { x: number; y: number } | null; coins?: string[]; flags?: string[]; elapsed?: number; deathXs?: number[] }

interface BlockRt { def: Block; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone | null; body: Phaser.Physics.Arcade.StaticBody | null; state: 'solid' | 'shaking' | 'falling'; t: number; hidden: boolean }
interface SpikeRt { x: number; y: number; w: number; down: boolean; hidden: boolean; range: number; rise: number; imgs: Phaser.GameObjects.Image[]; tufts: Phaser.GameObjects.Image[] }
interface MoverRt { x: number; y: number; w: number; x0: number; y0: number; x1: number; y1: number; speed: number; mode: string; k: number; dir: number; active: boolean; sinkT: number; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone; body: Phaser.Physics.Arcade.StaticBody; fled: boolean }
interface SpringRt { x: number; y: number; power: number; kind: string; used: boolean; img: Phaser.GameObjects.Image; cool: number }
interface SnailRt { img: Phaser.GameObjects.Image; helmet: Phaser.GameObjects.Graphics | null; x: number; minX: number; maxX: number; vx: number; alive: boolean; possum: boolean; armor: number; wake: number; rush: number; hidden: number }
interface RockRt { x: number; trigger: number; y: number; vy: number; state: 'idle' | 'warn' | 'fall' | 'done'; t: number; delay: number; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; side: number }
interface FlowerRt { x: number; img: Phaser.GameObjects.Image; jaw: Phaser.GameObjects.Graphics; near: number; cool: number }
interface CoinRt { img: Phaser.GameObjects.Image; x: number; y: number; got: boolean; key: string }

export class GameScene extends Phaser.Scene {
  data_!: GameData;
  levelIndex = 0;
  def!: LevelDef;
  player!: Player;
  deaths = 0;
  deathLog: string[] = [];
  private blocks: BlockRt[] = [];
  private spikes: SpikeRt[] = [];
  private movers: MoverRt[] = [];
  private springs: SpringRt[] = [];
  private snails: SnailRt[] = [];
  private rocks: RockRt[] = [];
  private flowers: FlowerRt[] = [];
  private coins: CoinRt[] = [];
  private flags: { x: number; y: number; on: boolean; ct: Phaser.GameObjects.Container }[] = [];
  private doorImg!: Phaser.GameObjects.Image;
  private lock: Phaser.GameObjects.Text | null = null;
  private cardboard: { img: Phaser.GameObjects.Image; state: 'idle' | 'fooled' | 'bridge' } | null = null;
  private chaser: { img: Phaser.GameObjects.Image; x: number; speed: number; t: number; paused: number; stopped: boolean; resumed: boolean } | null = null;
  private dark: { rt: Phaser.GameObjects.RenderTexture; lanterns: { x: number; y: number; g: Phaser.GameObjects.Graphics }[]; walker: { x: number; y: number; g: Phaser.GameObjects.Graphics; gone: boolean } | null } | null = null;
  private boss: Megaroc | null = null;
  private bossTiles: Tile[] = [];
  private parallax!: Parallax;
  private sun!: Phaser.GameObjects.Container;
  private sunMouth!: Phaser.GameObjects.Graphics;
  private checkpoint = { x: 0, y: 0 };
  private persist = new Set<string>();
  private coinKeys = new Set<string>();
  private deathXs: number[] = [];
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
  private tauntText!: Phaser.GameObjects.Text;
  private tauntT = 0;
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
    this.blocks = []; this.spikes = []; this.movers = []; this.springs = []; this.snails = []; this.rocks = []; this.flowers = []; this.coins = []; this.flags = [];
    this.cardboard = null; this.chaser = null; this.dark = null; this.boss = null; this.bossTiles = []; this.lock = null; this.snailText = null;
    this.fx = null; this.tauntT = 0; this.debugOn = false; this.won = false; this.deathLog = [];
    this.persist = new Set(this.data_.flags ?? []); this.coinKeys = new Set(this.data_.coins ?? []); this.deathXs = [...(this.data_.deathXs ?? [])];
    this.elapsed0 = this.data_.elapsed ?? 0; this.elapsed = this.elapsed0; this.rockRainT = 2;
    const L = this.def;
    this.physics.world.setBounds(-60, -400, L.width + 120, 1400, true, true, true, false);
    this.cameras.main.setBounds(0, -200, Math.max(W, L.width), 800);
    this.makeFxTextures();
    this.makeSky();

    // eau (même effet qu'un trou, en plus joli)
    for (const [a, b] of L.water ?? []) {
      const w = this.add.rectangle(a, G + 26, b - a, 300, 0x3aa7e0, 0.92).setOrigin(0, 0).setDepth(3);
      const crest = this.add.tileSprite(a, G + 18, b - a, 12, 'fx_wave').setOrigin(0, 0).setDepth(3);
      this.tweens.add({ targets: crest, tilePositionX: 64, duration: 1600, repeat: -1 });
      void w;
    }
    for (const b of L.blocks) this.addBlock(b);
    if (L.boss) this.makeBossFloor();
    for (const p of L.props ?? []) this.addProp(p.type, p.x, p.y ?? G);
    for (const s of L.signs ?? []) this.addSign(s.x, s.y ?? G, s.text);
    for (const s of L.spikes ?? []) this.addSpikes(s.x, s.y ?? G, s.w, s.dir === 'down', !!s.hidden, s.range ?? 70);
    for (const m of L.movers ?? []) this.addMover(m.x, m.y, m.w, m.mode, m.to ?? [m.x, m.y], m.speed ?? 80);
    for (const s of L.springs ?? []) this.springs.push({ x: s.x, y: s.y ?? G, power: s.power, kind: s.kind ?? 'normal', used: false, cool: 0, img: this.add.image(s.x, (s.y ?? G) + 2, 'spring').setOrigin(0.5, 1).setDisplaySize(40, 34).setDepth(7) });
    for (const s of L.snails ?? []) this.addSnail(s.x, s.minX, s.maxX, !!s.possum, !!s.armored);
    for (const r of L.rocks ?? []) this.addRock(r.x, r.trigger, r.delay ?? 0.6);
    for (const x of L.flowers ?? []) this.flowers.push({ x, near: 0, cool: 0, img: this.add.image(x, G + 3, 'flower').setOrigin(0.5, 1).setDisplaySize(34, 38).setDepth(7), jaw: this.add.graphics().setDepth(8) });
    for (const [x, y] of L.coins ?? []) { const key = `${x},${y}`; if (!this.coinKeys.has(key)) this.coins.push({ img: this.add.image(x, y, 'coin_gold').setDisplaySize(24, 24).setDepth(9), x, y, got: false, key }); }
    for (const c of L.checkpoints ?? []) {
      const y = c.y ?? G, on = !!this.data_.cp && Math.abs(this.data_.cp.x - c.x) < 2;
      this.flags.push({ x: c.x, y, on, ct: makeFlag(this, c.x, y, on ? COL.mint : 0xb9b4cc) });
    }
    this.doorImg = this.add.image(L.door.x, (L.door.y ?? G) + 3, 'door').setOrigin(0.5, 1).setDisplaySize(96, 64).setDepth(5);
    if (L.door.locked === 'snails') this.lock = this.add.text(L.door.x, (L.door.y ?? G) - 34, '🔒', { fontSize: '22px' }).setOrigin(0.5).setDepth(6);
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

    if (L.chaser) {
      const cpx = this.data_.cp ? this.data_.cp.x - 650 : L.chaser.x;
      this.chaser = { img: this.add.image(cpx, G + 6, 'rock').setOrigin(0.5, 1).setDisplaySize(150, 100).setDepth(16), x: cpx, speed: L.chaser.speed, t: 0, paused: 0, stopped: false, resumed: !!this.data_.cp };
    }
    if (L.dark) this.makeDark(L.dark);
    if (L.boss) this.boss = new Megaroc(this, {
      player: this.player, tiles: this.bossTiles, deaths: this.deaths,
      hurt: (x) => this.hurt(x), banner: (t, c, s) => this.banner(t, c, s), taunt: (t) => this.taunt(t),
      shake: (ms, k) => this.shake(ms, k), burst: (x, y, k, n) => this.burst(x, y, k, n),
      defeated: () => this.bossDefeated(),
    });
    if (this.boss) [2, 5].forEach((i) => this.boss!.crack(this.bossTiles[i]));

    this.makeHud();
    this.events.on('landed', (p: Player, vy: number) => this.burst(p.x, p.y, 'dust', vy > 600 ? 12 : 6));
    this.events.on('jumped', (p: Player) => this.burst(p.x, p.y, 'dust', 4));
    this.camX = Phaser.Math.Clamp(this.player.x - W * 0.4, 0, Math.max(0, L.width - W)); this.camY = Phaser.Math.Clamp(this.player.y - 330, -200, 0);
    this.cameras.main.setScroll(this.camX, this.camY);
    this.time0 = this.time.now;
    AudioManager.music('prairie');
    InputManager.swallow();
    if (InputManager.device === 'touch' || (typeof window !== 'undefined' && 'ontouchstart' in window)) this.touch = new TouchControls(this);
    this.input.keyboard?.on('keydown-F2', () => this.toggleDebug());
    fadeIn(this, this.deaths ? 140 : 260);
    if (L.taunt) this.time.delayedCall(350, () => this.taunt(L.taunt!));
    // conseil après plusieurs morts au même endroit
    for (const h of L.hints ?? []) if (this.deathXs.filter((d) => Math.abs(d - h.x) < 260).length >= 3 && !this.persist.has('hint' + h.x)) { this.persist.add('hint' + h.x); this.time.delayedCall(L.taunt ? 2000 : 400, () => this.taunt(h.text)); }
    (window as unknown as { __NSF?: unknown }).__NSF = this;
    this.events.once('shutdown', () => { this.touch?.destroy(); this.touch = null; });
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
    // halo de lumière (dégradé radial) pour les niveaux de nuit
    const c = this.textures.createCanvas('fx_light', 256, 256);
    if (c) { const x = c.getContext(); const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); c.refresh(); }
  }

  // ---------------- décor : ciel, soleil moqueur ----------------
  private makeSky(): void {
    const s = this.def.sky ?? 'day';
    const top = s === 'night' ? 0x141638 : s === 'sunset' ? 0xff9a6b : 0x8fd3ff, bot = s === 'night' ? 0x3d3778 : s === 'sunset' ? 0xffe0a3 : 0xdff3ff;
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(top, top, bot, bot, 1); sky.fillRect(0, 0, W, H);
    if (s === 'night') for (let i = 0; i < 50; i++) { const st = this.add.circle(Math.random() * W, Math.random() * 240, 1 + Math.random() * 1.5, 0xffffff, 0.8).setScrollFactor(0).setDepth(-29); this.tweens.add({ targets: st, alpha: 0.2, duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1 }); }
    // soleil (ou lune) qui rit quand on meurt
    this.sun = this.add.container(W - 110, 80).setScrollFactor(0).setDepth(-25);
    const g = this.add.graphics();
    const col = s === 'night' ? 0xe8e6ff : 0xffe066;
    g.fillStyle(col, 0.3); g.fillCircle(0, 0, 60); g.fillStyle(COL.outline, 1); g.fillCircle(0, 0, 42); g.fillStyle(col, 1); g.fillCircle(0, 0, 39);
    g.fillStyle(COL.outline, 1); g.fillCircle(-12, -6, 4); g.fillCircle(12, -6, 4);
    this.sunMouth = this.add.graphics(); this.drawSunMouth(false);
    this.sun.add([g, this.sunMouth]);
    this.tweens.add({ targets: this.sun, scale: 1.04, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.parallax = new Parallax(this, 420, -22);
    if (s === 'night') { this.parallax.far.setTint(0x5a5e9a); this.parallax.mid.setTint(0x4a4f88); }
    if (s === 'sunset') { this.parallax.far.setTint(0xffc9a0); this.parallax.mid.setTint(0xffd8b0); }
    this.add.rectangle(0, G, Math.max(W, this.def.width), 400, 0x10302a, 0.55).setOrigin(0, 0).setDepth(-5);
  }
  private drawSunMouth(laugh: boolean): void {
    const g = this.sunMouth; g.clear();
    if (laugh) { g.fillStyle(COL.outline, 1); g.fillEllipse(0, 12, 26, 18); g.fillStyle(COL.pink, 1); g.fillEllipse(0, 16, 14, 7); }
    else { g.lineStyle(3, COL.outline, 1); g.beginPath(); g.arc(0, 4, 13, 0.3, Math.PI - 0.3); g.strokePath(); }
  }
  private sunLaugh(): void {
    this.drawSunMouth(true); AudioManager.play('laugh');
    this.tweens.add({ targets: this.sun, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => { this.sun.setAngle(0); } });
  }

  // ---------------- construction ----------------
  private addBlock(b: Block): void {
    const L = this.def, kind = b.kind ?? 'solid';
    const touches = (o: Block, side: 'l' | 'r') => o !== b && o.kind !== 'fake' && o.y <= b.y + 1 && o.y + o.h >= b.y + b.h - 1 && (side === 'l' ? Math.abs(o.x + o.w - b.x) < 2 : Math.abs(o.x - b.x - b.w) < 2);
    const nb = { left: L.blocks.some((o) => touches(o, 'l')), right: L.blocks.some((o) => touches(o, 'r')), bottomOpen: b.y + b.h >= 598 };
    const ct = buildBlock(this, b.x, b.y, b.w, b.h, kind === 'fake' ? { left: true, right: true, bottomOpen: nb.bottomOpen } : nb).setDepth(4);
    if (kind === 'crumble' && (b.reveal ?? true)) drawCracks(this, ct, b.w);
    if (b.reveal && (kind === 'fake' || kind === 'crumble' || kind === 'drop')) this.dashed(ct, b.w, Math.min(b.h, 60));
    let zone: Phaser.GameObjects.Zone | null = null, body: Phaser.Physics.Arcade.StaticBody | null = null;
    const hidden = kind === 'invisible' && !b.reveal;
    if (hidden) ct.setVisible(false);
    if (kind !== 'fake') {
      zone = this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
      this.physics.add.existing(zone, true);
      body = zone.body as Phaser.Physics.Arcade.StaticBody;
      if (hidden) { body.checkCollision.up = false; body.checkCollision.left = false; body.checkCollision.right = false; }
    }
    this.blocks.push({ def: b, ct, zone, body, state: 'solid', t: 0, hidden });
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
    AudioManager.play('stomp'); this.burst(b.def.x + b.def.w / 2, b.def.y + b.def.h, 'dust', 10); this.taunt('Bonk.');
  }
  addBridge(x: number, w: number, anim = true): void {
    const ct = buildBlock(this, x, G, w, 30, {}).setDepth(4);
    const zone = this.add.zone(x + w / 2, G + 15, w, 30); this.physics.add.existing(zone, true);
    if (this.player) this.physics.add.collider(this.player.rect, zone);
    this.blocks.push({ def: { x, y: G, w, h: 30 }, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, state: 'solid', t: 0, hidden: false });
    if (anim) { ct.setScale(0.2, 1); this.tweens.add({ targets: ct, scaleX: 1, duration: 260, ease: 'Back.Out' }); }
  }
  private addMover(x: number, y: number, w: number, mode: string, to: [number, number], speed: number): void {
    const ct = buildBlock(this, x, y, w, 30, {}).setDepth(4);
    const zone = this.add.zone(x + w / 2, y + 15, w, 30); this.physics.add.existing(zone, true);
    this.movers.push({ x, y, w, x0: x, y0: y, x1: to[0], y1: to[1], speed, mode, k: 0, dir: 1, active: mode === 'loop', sinkT: 0, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, fled: false });
  }
  private addSnail(x: number, minX: number, maxX: number, possum: boolean, armored: boolean): void {
    const img = this.add.image(x, G + 2, possum ? 'snail_shell' : 'snail_walk_a').setOrigin(0.5, 1).setDepth(9);
    let helmet: Phaser.GameObjects.Graphics | null = null;
    if (armored) { helmet = this.add.graphics().setDepth(10); helmet.fillStyle(COL.outline, 1); helmet.fillEllipse(0, 0, 34, 20); helmet.fillStyle(0xb8c0d9, 1); helmet.fillEllipse(0, 0, 30, 16); helmet.fillStyle(0xffffff, 0.6); helmet.fillEllipse(-6, -3, 8, 4); }
    this.snails.push({ img, helmet, x, minX, maxX, vx: -45, alive: true, possum, armor: armored ? 1 : 0, wake: 0, rush: 0, hidden: 0 });
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
  }
  private addSign(x: number, y: number, text: string): void {
    const label = this.add.text(x, 0, text, { fontFamily: FONT.display, fontSize: '11px', color: CSS.wood, padding: { top: 4 } }).setOrigin(0.5).setDepth(4);
    const img = this.add.image(x, y + 3, 'sign').setOrigin(0.5, 1).setDepth(3);
    const SH = 74, sw = Math.max(86, (label.width + 8) / 0.7 + 12);
    img.setDisplaySize(sw, SH); label.setY(y + 3 - SH + (SH * 33.5) / 126 + 1);
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
    // murs de l'arène
    for (const x of [-60, 960]) { const z = this.add.zone(x + 30, 0, 60, 1200); this.physics.add.existing(z, true); this.blocks.push({ def: { x, y: -600, w: 60, h: 1200 }, ct: this.add.container(0, 0), zone: z, body: z.body as Phaser.Physics.Arcade.StaticBody, state: 'solid', t: 0, hidden: false }); }
  }
  private makeDark(d: NonNullable<LevelDef['dark']>): void {
    const rt = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setScrollFactor(0).setDepth(90);
    const lan = (x: number, y: number) => { const g = this.add.graphics().setDepth(12); g.fillStyle(COL.outline, 1); g.fillRect(-2, 0, 4, G - y); g.fillStyle(0xfff3a8, 1); g.fillCircle(0, 0, 8); g.lineStyle(2, COL.outline, 1); g.strokeCircle(0, 0, 8); g.setPosition(x, y); return g; };
    this.dark = { rt, lanterns: d.lanterns.map(([x, y]) => ({ x, y, g: lan(x, y) })), walker: null };
    if (d.walker) { const g = this.add.graphics().setDepth(12); g.fillStyle(0xfff3a8, 1); g.fillCircle(0, 0, 7); g.setPosition(d.walker[0], d.walker[1]); this.dark.walker = { x: d.walker[0], y: d.walker[1], g, gone: false }; }
  }

  // ---------------- interface ----------------
  private makeHud(): void {
    this.deathText = this.add.text(18, 18, `☠ ${this.deaths}`, { fontFamily: FONT.display, fontSize: '20px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 6 }).setScrollFactor(0).setDepth(100);
    this.add.image(W - 120, 30, 'coin_gold').setDisplaySize(26, 26).setScrollFactor(0).setDepth(100);
    this.coinText = this.add.text(W - 100, 30, '0', { fontFamily: FONT.display, fontSize: '22px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    if (this.def.door.locked === 'snails') this.snailText = this.add.text(W / 2, 22, '', { fontFamily: FONT.display, fontSize: '18px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.tauntText = this.add.text(W / 2, 120, '', { ...TAUNT_STYLE, padding: { top: 6 }, align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5).setScrollFactor(0).setDepth(110).setAlpha(0);
    this.bannerCt = this.add.container(W / 2, H / 2 - 40).setScrollFactor(0).setDepth(120).setVisible(false);
    this.debugText = this.add.text(8, H - 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#000000aa' }).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setVisible(false);
  }
  taunt(t: string): void {
    this.tauntText.setText(t).setAlpha(1).setScale(0.6); this.tauntT = 1.4 + t.length * 0.03;
    this.tweens.add({ targets: this.tauntText, scale: 1, duration: 260, ease: 'Back.Out' });
  }
  banner(text: string, color: string, sub?: string): void {
    const c = this.bannerCt; c.removeAll(true).setVisible(true).setScale(0.4).setAlpha(1);
    const bg = this.add.graphics(); bg.fillStyle(COL.ink, 0.92); bg.fillRoundedRect(-260, -56, 520, sub ? 126 : 100, 18); bg.lineStyle(5, Phaser.Display.Color.HexStringToColor(color).color, 1); bg.strokeRoundedRect(-260, -56, 520, sub ? 126 : 100, 18);
    c.add([bg, this.add.text(0, -8, text, { fontFamily: FONT.display, fontSize: '36px', color, padding: { top: 6 } }).setOrigin(0.5)]);
    if (sub) c.add(this.add.text(0, 40, sub, { fontFamily: FONT.body, fontSize: '18px', fontStyle: '800', color: CSS.paper }).setOrigin(0.5));
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1150, duration: 300, onComplete: () => c.setVisible(false) });
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

  // ---------------- règles ----------------
  hurt(fromX: number): void { if (this.player.hurt(fromX)) this.kill('hearts'); else { this.shake(120, 0.006); this.taunt(this.player.hp === 1 ? 'Encore un coup et c\'est fini.' : 'Aïe ! Pas loin.'); } }
  kill(cause: string): void {
    const p = this.player;
    if (p.dead || this.won) return;
    p.dead = true; this.deathLog.push(`${cause}@${Math.round(p.x)}`); this.deathXs.push(p.x);
    SaveManager.data.totalDeaths++; SaveManager.write();
    AudioManager.play('die'); this.shake(220, 0.012); this.sunLaugh();
    p.body.setVelocity(0, 0); p.body.enable = false; p.view.mood = 'hurt';
    this.burst(p.x, p.y - 15, 'spark', 14);
    this.tweens.add({ targets: p.view, y: p.view.y - 50, angle: 200 * (p.face || 1), duration: 380, ease: 'Quad.Out' });
    this.tweens.add({ targets: p.view, alpha: 0, delay: 300, duration: 300 });
    const msg: Record<string, string[]> = { pit: ['Le vide, ça ne pardonne pas.', 'Chute libre !'], water: ['Plouf.', 'Tu ne sais pas nager ?'], spikes: ['Ça pique.', 'Aïe.'], rock: ['Ça tombe du ciel.', 'Regarde en l\'air, parfois.'], chaser: ['Écrasé.', 'Il roulait plus vite que toi.'], hearts: ['Trois coups, c\'est trop.', 'K.O.'], restart: ['On recommence.'] };
    const list = msg[cause] ?? ['Raté.'];
    this.taunt(list[this.deaths % list.length]);
    this.deathText.setText(`☠ ${this.deaths + 1}`);
    this.time.delayedCall(800, () => {
      this.cameras.main.fadeOut(140, 29, 26, 57);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({
        level: this.levelIndex, deaths: this.deaths + 1, cp: this.checkpoint.x !== this.def.start.x || this.checkpoint.y !== this.def.start.y ? this.checkpoint : null,
        coins: [...this.coinKeys], flags: [...this.persist], elapsed: this.elapsed, deathXs: this.deathXs,
      } satisfies GameData));
    });
  }
  private win(): void {
    if (this.won) return;
    this.won = true; const p = this.player; p.frozen = true; p.body.setVelocity(0, p.body.velocity.y); p.view.mood = 'happy';
    const d = this.def.door;
    AudioManager.play('win'); this.burst(d.x, (d.y ?? G) - 40, 'spark', 40);
    this.tweens.add({ targets: p.view, x: d.x, alpha: 0, scale: 0.6, duration: 600, delay: 200 });
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
        if (m.mode === 'sink' && m.active && m.k > 0.4) { m.sinkT += dt; m.y = m.y0 + m.sinkT * 55; if (m.sinkT > 0.05 && m.sinkT < 0.1) this.taunt('Elle coule !'); }
      } else if (m.mode === 'flee') {
        // elle s'éloigne quand on lui saute dessus
        if (!m.fled && !p.onGround && p.body.velocity.y > -200 && Math.abs(p.x - (m.x + m.w / 2)) < 150 && p.x < m.x + m.w / 2) { m.fled = true; AudioManager.play('whoosh'); this.taunt('Elle a eu peur.'); }
        if (m.fled) { m.x = Math.min(m.x1, m.x + m.speed * dt); }
      }
      m.ct.setPosition(m.x, m.y); m.zone.setPosition(m.x + m.w / 2, m.y + 15); m.body.updateFromGameObject();
      if (on) carry = { dx: m.x - ox, dy: m.y - oy };
    }
    if (carry.dx || carry.dy) { p.rect.x += carry.dx; p.rect.y += carry.dy; }   // le corps physique suit l'objet à l'image suivante
    p.update(dt);
    if (!p.dead && p.y > 640) this.kill('pit');
    for (const [a, b] of L.water ?? []) if (!p.dead && p.x > a && p.x < b && p.y > G + 30) this.kill('water');

    // sols piégés
    for (const b of this.blocks) {
      const k = b.def.kind;
      if ((k !== 'crumble' && k !== 'drop') || !b.body) continue;
      const on = !p.dead && p.onGround && p.x + PW / 2 > b.def.x && p.x - PW / 2 < b.def.x + b.def.w && Math.abs(p.y - b.def.y) < 4;
      if (b.state === 'solid' && on) { b.state = 'shaking'; b.t = k === 'drop' ? 0.12 : 0.42; AudioManager.play('crack'); }
      if (b.state === 'shaking') {
        b.t -= dt; b.ct.setPosition(b.def.x + (Math.random() - 0.5) * 4, b.def.y + (Math.random() - 0.5) * 2);
        if (b.t <= 0) { b.state = 'falling'; b.body.enable = false; AudioManager.play('trap'); this.burst(b.def.x + b.def.w / 2, b.def.y + 4, 'chips', 22); this.shake(160, 0.008); this.tweens.add({ targets: b.ct, y: b.def.y + 500, angle: 6, duration: 900, ease: 'Quad.In' }); }
      }
    }
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
    // ressorts (normal, paresseux, qui renvoie en arrière, en carton)
    for (const s of this.springs) {
      s.cool = Math.max(0, s.cool - dt);
      if (s.cool > 0 || p.dead || p.body.velocity.y < 0 || Math.abs(p.x - s.x) > 22 || p.y < s.y - 34 || p.y > s.y + 2 || (s.kind === 'cardboard' && s.used)) continue;
      s.cool = 0.4; const first = !s.used; s.used = true;
      if (s.kind === 'cardboard') { AudioManager.play('fake'); this.taunt('Ressort en carton.'); this.tweens.add({ targets: s.img, scaleY: s.img.scaleY * 0.25, duration: 160 }); s.img.setY(s.y + 2); continue; }
      if (s.kind === 'lazy' && first) { p.bounce(260); AudioManager.play('fake'); this.taunt('Boing… (flemme)'); }
      else if (s.kind === 'back' && first) { p.bounce(620); p.body.setVelocityX(-420); AudioManager.play('spring'); this.taunt('Mauvais sens !'); }
      else { p.bounce(s.power); AudioManager.play('spring'); }
      this.tweens.add({ targets: s.img, scaleY: { from: s.img.scaleY * 0.5, to: s.img.scaleY }, duration: 260, ease: 'Back.Out' });
    }
    // pièces
    for (const c of this.coins) {
      if (c.got) continue;
      const sw = Math.abs(Math.cos(t * 3 + c.x * 0.05));
      c.img.setY(c.y + Math.sin(t * 3 + c.x) * 3).setScale(Math.max(0.15, sw) * (24 / c.img.width), 24 / c.img.height);
      if (!p.dead && Math.abs(p.x - c.x) < 22 && Math.abs(p.y - 15 - c.y) < 26) { c.got = true; this.coinKeys.add(c.key); AudioManager.play('coin'); this.burst(c.x, c.y, 'spark', 10); this.tweens.add({ targets: c.img, y: c.y - 40, alpha: 0, duration: 300, onComplete: () => c.img.setVisible(false) }); }
    }
    this.coinText.setText(`${this.coinKeys.size}/${(L.coins ?? []).length}`);
    this.updateSnails(dt, t);
    this.updateRocks(dt);
    // fleurs qui mordent : elles montrent les dents avant
    for (const f of this.flowers) {
      const close = !p.dead && Math.abs(p.x - f.x) < 34 && Math.abs(p.y - G) < 40;
      f.near = close ? f.near + dt : Math.max(0, f.near - dt * 2); f.cool = Math.max(0, f.cool - dt);
      const open = Math.min(1, f.near / 0.45);
      f.img.setAngle(Math.sin(t * 3) * 4 + (close ? Math.sin(t * 40) * 3 : 0));
      f.jaw.clear(); f.jaw.fillStyle(0xffffff, 1);
      for (let i = -1; i <= 1; i++) f.jaw.fillTriangle(f.x + i * 5 - 2, G - 24, f.x + i * 5 + 2, G - 24, f.x + i * 5, G - 20 + open * 4);
      if (open >= 1 && f.cool <= 0) { f.cool = 1.2; f.near = 0; AudioManager.play('stomp'); this.hurt(f.x); this.taunt('Elle mord, la fleur.'); }
    }
    // drapeaux
    for (const f of this.flags) {
      if (f.on || p.dead || Math.abs(p.x - f.x) > 24 || Math.abs(p.y - f.y) > 60) continue;
      f.on = true; this.checkpoint = { x: f.x, y: f.y }; AudioManager.play('checkpoint'); this.taunt('Sauvegardé !');
      f.ct.destroy(); f.ct = makeFlag(this, f.x, f.y, COL.mint); this.burst(f.x, f.y - 60, 'spark', 16);
    }
    this.updateCardboard(t);
    this.updateChaser(dt);
    if (this.boss) this.boss.update(dt);
    if (this.dark) this.updateDark(dt, t);
    // porte (verrouillée tant qu'il reste des escargots, ou tant que le boss est debout)
    const alive = this.snails.filter((s) => s.alive).length;
    if (this.snailText) this.snailText.setText(alive ? `Escargots restants : ${alive}` : 'La porte est ouverte !');
    if (this.lock && !alive) { this.lock.destroy(); this.lock = null; AudioManager.play('checkpoint'); this.burst(L.door.x, G - 40, 'spark', 20); }
    const locked = (L.door.locked === 'snails' && alive > 0) || L.door.locked === 'boss';
    if (!p.dead && !this.won && !locked && Math.abs(p.x - L.door.x) < 22 && Math.abs(p.y - (L.door.y ?? G)) < 30) this.win();

    // caméra : anticipe la direction, suit doucement en vertical
    this.lookAhead += ((p.body.velocity.x !== 0 ? p.face * 90 : p.face * 50) - this.lookAhead) * Math.min(1, dt * 2.5);
    const tx = Phaser.Math.Clamp(p.x - W / 2 + this.lookAhead, 0, Math.max(0, L.width - W)), ty = Phaser.Math.Clamp(p.y - 330, -200, 0);
    this.camX += (tx - this.camX) * Math.min(1, dt * 6); this.camY += (ty - this.camY) * Math.min(1, dt * 3);
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.parallax.update(this.camX, this.camY);
    if (this.tauntT > 0) { this.tauntT -= dt; if (this.tauntT < 0.4) this.tauntText.setAlpha(Math.max(0, this.tauntT / 0.4)); if (this.tauntT <= 0) this.drawSunMouth(false); }
    p.prevY = p.y;
    if (this.debugOn) this.debugText.setText(`x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} vx ${p.body.velocity.x.toFixed(0)} vy ${p.body.velocity.y.toFixed(0)} sol ${p.onGround} coups ${3 - p.hp} morts ${this.deaths}`);
  }

  private updateSnails(dt: number, t: number): void {
    const p = this.player;
    for (const sn of this.snails) {
      if (!sn.alive) continue;
      if (sn.possum && sn.wake <= 0) {
        // il fait le mort… puis se réveille quand on passe à côté
        if (!p.dead && Math.abs(p.x - sn.x) < 70) { sn.wake = 0.35; this.add.text(sn.x, G - 46, '!', { fontFamily: FONT.display, fontSize: '22px', color: CSS.pink, stroke: CSS.ink, strokeThickness: 5 }).setOrigin(0.5).setDepth(20).setData('ttl', 1); }
      } else if (sn.possum && sn.wake > 0 && sn.rush === 0) { sn.wake -= dt; if (sn.wake <= 0) { sn.rush = 1.4; sn.possum = false; sn.vx = Math.sign(p.x - sn.x || 1) * 150; AudioManager.play('laugh'); } }
      else if (sn.hidden > 0) { sn.hidden -= dt; }
      else {
        if (sn.rush > 0) { sn.rush -= dt; if (sn.rush <= 0) sn.vx = Math.sign(sn.vx) * 45; }
        sn.x += sn.vx * dt; if (sn.x < sn.minX || sn.x > sn.maxX) { sn.vx *= -1; sn.x = Phaser.Math.Clamp(sn.x, sn.minX, sn.maxX); }
        sn.img.setTexture(Math.floor(t * (sn.rush > 0 ? 14 : 6)) % 2 ? 'snail_walk_a' : 'snail_walk_b').setFlipX(sn.vx > 0);
      }
      if (sn.hidden > 0 || (sn.possum && sn.wake <= 0)) sn.img.setTexture('snail_shell');
      sn.img.setPosition(sn.x, G + 2).setDisplaySize(44, (44 * sn.img.height) / sn.img.width);
      sn.helmet?.setPosition(sn.x + (sn.vx > 0 ? 4 : -4), G - 22);
      if (p.dead || Math.abs(p.x - sn.x) > 30 || p.y < G - 34 || p.y > G + 4) continue;
      if (p.prevY <= G - 18 && p.body.velocity.y >= 0) {
        p.bounce(420); AudioManager.play('stomp'); this.burst(sn.x, G - 12, 'dust', 10);
        if (sn.armor > 0) { sn.armor--; this.taunt('Il a un casque !'); const h = sn.helmet!; sn.helmet = null; this.tweens.add({ targets: h, y: G - 120, x: sn.x + 60, angle: 400, alpha: 0, duration: 700, onComplete: () => h.destroy() }); sn.hidden = 0.6; continue; }
        sn.alive = false; sn.img.setTexture('snail_shell');
        this.tweens.add({ targets: sn.img, y: G + 80, angle: 180, alpha: 0, duration: 700, ease: 'Quad.In' });
      } else if (!(sn.possum && sn.wake <= 0)) this.hurt(sn.x);
    }
    // les « ! » des escargots qui se réveillent disparaissent
    this.children.list.forEach((o) => { const ttl = o.getData?.('ttl'); if (typeof ttl === 'number') { const n = ttl - 1 / 60; if (n <= 0) o.destroy(); else o.setData('ttl', n); } });
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

  private updateChaser(dt: number): void {
    const c = this.chaser, p = this.player, L = this.def;
    if (!c || !L.chaser) return;
    c.t += dt;
    if (c.t < L.chaser.delay || this.won) return;
    if (c.paused > 0) { c.paused -= dt; if (c.paused <= 0) { c.speed += 26; this.taunt('Il repart. Plus vite.'); AudioManager.play('whoosh'); } return; }
    if (!c.resumed && c.x > 1650) { c.resumed = true; c.paused = 1.3; this.taunt('Il souffle…'); return; }
    if (!c.stopped) {
      c.x += c.speed * dt; c.img.setX(c.x).setAngle(c.x * 0.8);
      if (Math.floor(c.x / 40) !== Math.floor((c.x - c.speed * dt) / 40)) this.burst(c.x - 40, G, 'dust', 3);
      if (c.x >= L.chaser.stopAt) { c.stopped = true; AudioManager.play('trap'); this.shake(300, 0.02); this.burst(c.x + 60, G - 40, 'chips', 30); this.taunt('BOUM. Le mur a gagné.'); }
    }
    if (!p.dead && Math.abs(p.x - c.x) < 62 && p.y > G - 100) this.kill('chaser');
  }

  private updateDark(dt: number, t: number): void {
    const d = this.dark!, L = this.def.dark!, p = this.player, cam = this.cameras.main;
    // la lanterne qui marche : elle recule quand on approche… vers le trou
    if (d.walker && !d.walker.gone) {
      const w = d.walker;
      if (Math.abs(p.x - w.x) < 160) w.x += 70 * dt * Math.sign(w.x - p.x || 1);
      w.g.setPosition(w.x, w.y + Math.sin(t * 3) * 4);
      if (w.x > 1340) { w.gone = true; this.tweens.add({ targets: w.g, alpha: 0, duration: 400 }); }
    }
    d.rt.clear(); d.rt.fill(0x05030f, 0.94);
    const hole = (x: number, y: number, r: number) => d.rt.stamp('fx_light', undefined, x - cam.scrollX, y - cam.scrollY, { scale: (r * 2) / 256, blendMode: Phaser.BlendModes.ERASE });
    hole(p.x, p.y - 15, L.radius);
    for (const l of d.lanterns) hole(l.x, l.y, 140 + Math.sin(t * 4 + l.x) * 6);
    if (d.walker && !d.walker.gone) hole(d.walker.x, d.walker.y, 120);
    d.rt.render();
  }
}
