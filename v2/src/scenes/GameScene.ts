// Scène de jeu : construit le niveau, gère le joueur, les pièges, les ennemis, la caméra, la mort et la victoire.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT, HEARTS } from '../core/config';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { Player, PW } from '../entities/Player';
import type { CharId } from '../entities/HeroArt';
import { LEVEL_1, type LevelDef, type Block } from '../levels/level1';
import { buildBlock, drawCracks, Parallax } from '../levels/Terrain';
import { makeTrap, makeFlag, type Trap, type TrapCtx, TAUNT_STYLE } from '../traps/Traps';
import { fadeIn, goTo } from '../ui/Transition';
import { TouchControls } from '../ui/TouchControls';

interface BlockRt { def: Block; ct: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone; body: Phaser.Physics.Arcade.StaticBody; state: 'solid' | 'shaking' | 'falling' | 'gone'; t: number }
interface SpikeRt { x: number; y: number; w: number; hidden: boolean; range: number; rise: number; imgs: Phaser.GameObjects.Image[]; tufts: Phaser.GameObjects.Image[] }
interface CoinRt { img: Phaser.GameObjects.Image; x: number; y: number; got: boolean }
interface SnailRt { img: Phaser.GameObjects.Image; x: number; y: number; minX: number; maxX: number; vx: number; alive: boolean; shellT: number; x0: number }

export class GameScene extends Phaser.Scene {
  level!: LevelDef;
  player!: Player;
  private blocks: BlockRt[] = [];
  private spikes: SpikeRt[] = [];
  private coins: CoinRt[] = [];
  private snails: SnailRt[] = [];
  private traps: Trap[] = [];
  private flags: { x: number; y: number; on: boolean; ct: Phaser.GameObjects.Container }[] = [];
  private parallax!: Parallax;
  private checkpoint = { x: 0, y: 0 };
  deaths = 0;
  deathLog: string[] = [];
  private deathXs: number[] = [];
  private time0 = 0;
  elapsed = 0;
  private won = false;
  private camX = 0;
  private camY = 0;
  private lookAhead = 0;
  // interface
  private hearts: Phaser.GameObjects.Image[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private tauntText!: Phaser.GameObjects.Text;
  private tauntT = 0;
  private bannerCt!: Phaser.GameObjects.Container;
  private fx: Record<'dust' | 'chips' | 'spark' | 'leaf', Phaser.GameObjects.Particles.ParticleEmitter> | null = null;
  private debugOn = false;
  private debugText!: Phaser.GameObjects.Text;
  private touch: TouchControls | null = null;
  private hintShown = new Set<number>();

  constructor() { super('Game'); }

  create(): void {
    this.level = LEVEL_1;
    this.blocks = []; this.spikes = []; this.coins = []; this.snails = []; this.traps = []; this.flags = []; this.hearts = [];
    this.fx = null; this.tauntT = 0; this.debugOn = false;
    this.deaths = 0; this.deathXs = []; this.deathLog = []; this.won = false; this.elapsed = 0; this.hintShown.clear();
    const L = this.level;
    this.physics.world.setBounds(-60, -400, L.width + 120, L.height + 800, true, true, true, false);
    this.cameras.main.setBounds(0, -200, L.width, L.height + 200).setBackgroundColor('#a8e4ff');
    this.makeFxTextures();
    // ciel en dégradé + décor en parallaxe
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-20);
    sky.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xdff3ff, 0xdff3ff, 1); sky.fillRect(0, 0, W, H);
    this.parallax = new Parallax(this, 420, -12);
    this.add.rectangle(0, 420, L.width, 400, 0x10302a, 0.55).setOrigin(0, 0).setDepth(-5);   // fond des trous plus sombre

    // sols
    for (const b of L.blocks) this.addBlock(b);
    // décor
    for (const p of L.props) this.addProp(p.type, p.x, p.y ?? 420, p.text);
    // pics
    for (const s of L.spikes) this.addSpikes(s.x, s.y, s.w, !!s.hidden, s.range ?? 70);
    // pièces
    for (const [x, y] of L.coins) this.coins.push({ img: this.add.image(x, y, 'coin_gold').setDisplaySize(24, 24).setDepth(9), x, y, got: false });
    // escargots
    for (const e of L.enemies) this.snails.push({ img: this.add.image(e.x, e.y, 'snail_walk_a').setOrigin(0.5, 1).setDepth(9), x: e.x, x0: e.x, y: e.y, minX: e.minX, maxX: e.maxX, vx: -45, alive: true, shellT: 0 });
    // drapeaux de sauvegarde
    for (const c of L.checkpoints) this.flags.push({ ...c, on: false, ct: makeFlag(this, c.x, c.y, 0xb9b4cc) });
    // sortie
    this.add.image(L.door.x, L.door.y + 3, 'door').setOrigin(0.5, 1).setDisplaySize(96, 64).setDepth(5);

    // joueur
    const char = (SaveManager.data.custom.char || 'rosa') as CharId;
    this.player = new Player(this, L.start.x, L.start.y, char);
    this.checkpoint = { ...L.start };
    this.physics.add.collider(this.player.rect, this.blocks.map((b) => b.zone));

    // pièges
    const ctx: TrapCtx = {
      scene: this, player: this.player,
      kill: (c) => this.kill(c), hurt: (x) => this.hurt(x), taunt: (t) => this.taunt(t), banner: (t, c, s) => this.banner(t, c, s),
      setCheckpoint: (x, y) => { this.checkpoint = { x, y }; }, deathsNear: (x, r) => this.deathXs.filter((d) => Math.abs(d - x) < r).length,
      shake: (ms, k) => this.shake(ms, k), burst: (x, y, k, n) => this.burst(x, y, k, n),
    };
    for (const t of L.traps) this.traps.push(makeTrap(ctx, t));

    this.makeHud();
    this.events.on('landed', (p: Player, vy: number) => this.burst(p.x, p.y, 'dust', vy > 600 ? 12 : 6));
    this.events.on('jumped', (p: Player) => this.burst(p.x, p.y, 'dust', 4));
    this.camX = Phaser.Math.Clamp(this.player.x - W * 0.4, 0, L.width - W); this.camY = 0;
    this.cameras.main.setScroll(this.camX, this.camY);
    this.time0 = this.time.now;
    AudioManager.music('prairie');
    InputManager.swallow();
    if (InputManager.device === 'touch' || (typeof window !== 'undefined' && 'ontouchstart' in window)) this.touch = new TouchControls(this);
    this.input.keyboard?.on('keydown-F2', () => this.toggleDebug());
    fadeIn(this);
    (window as unknown as { __NSF?: unknown }).__NSF = this;
    this.events.once('shutdown', () => { this.touch?.destroy(); this.touch = null; });
  }

  private makeFxTextures(): void {
    if (this.textures.exists('fx_dot')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1); g.fillCircle(6, 6, 6); g.generateTexture('fx_dot', 12, 12); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 5, 5); g.generateTexture('fx_chip', 5, 5); g.clear();
    g.fillStyle(0x5bd35a, 1); g.fillEllipse(5, 3, 10, 6); g.generateTexture('fx_leaf', 10, 6); g.clear();
    g.fillStyle(0x5bd35a, 1); g.fillTriangle(0, 14, 4, 0, 8, 14); g.fillTriangle(6, 14, 11, 2, 14, 14); g.generateTexture('fx_tuft', 14, 14);
    g.destroy();
  }

  // ---------------- construction ----------------
  private addBlock(b: Block): void {
    const L = this.level, touches = (o: Block, side: 'l' | 'r') => o !== b && o.y <= b.y + 1 && o.y + o.h >= b.y + b.h - 1 && (side === 'l' ? Math.abs(o.x + o.w - b.x) < 2 : Math.abs(o.x - b.x - b.w) < 2);
    const nb = { left: L.blocks.some((o) => touches(o, 'l')), right: L.blocks.some((o) => touches(o, 'r')), bottomOpen: b.y + b.h >= L.height - 2 };
    const ct = buildBlock(this, b.x, b.y, b.w, b.h, nb).setDepth(4);
    if (b.trap === 'crumble') drawCracks(this, ct, b.w);
    const zone = this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
    this.physics.add.existing(zone, true);
    this.blocks.push({ def: b, ct, zone, body: zone.body as Phaser.Physics.Arcade.StaticBody, state: 'solid', t: 0 });
  }

  private addProp(type: string, x: number, y: number, text?: string): void {
    const fit = (k: string, h: number, d = 3) => { const img = this.add.image(x, y + 4, k).setOrigin(0.5, 1).setDepth(d); img.setDisplaySize((h * img.width) / img.height, h); return img; };
    if (type === 'tree') { const t = fit('tree', 118, 2); this.tweens.add({ targets: t, angle: { from: -1, to: 1 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    else if (type === 'bush') fit('bush', 32);
    else if (type === 'flower') { const f = fit('flower', 28); this.tweens.add({ targets: f, angle: { from: -6, to: 6 }, duration: 1500 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    else if (type === 'mushroom') fit('mushroom_red', 24);
    else if (type === 'rock') fit('rock', 18);
    else if (type === 'sign' && text) {
      const label = this.add.text(x, 0, text, { fontFamily: FONT.display, fontSize: '11px', color: CSS.wood }).setOrigin(0.5).setDepth(4);
      const img = this.add.image(x, y + 3, 'sign').setOrigin(0.5, 1).setDepth(3);
      const SH = 74, sw = Math.max(86, (label.width + 8) / 0.7 + 12);
      img.setDisplaySize(sw, SH);
      label.setY(y + 3 - SH + (SH * 33.5) / 126 + 1);
    }
  }

  private addSpikes(x: number, y: number, w: number, hidden: boolean, range: number): void {
    const n = Math.max(1, Math.round(w / 34)), tw = w / n, imgs: Phaser.GameObjects.Image[] = [], tufts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) imgs.push(this.add.image(x + i * tw, y, 'spikes').setOrigin(0, 1).setDisplaySize(tw + 1, 18).setDepth(3));
    if (hidden) for (let i = 0; i < 3; i++) tufts.push(this.add.image(x + 10 + i * ((w - 20) / 2), y + 2, 'fx_tuft').setOrigin(0.5, 1).setDepth(6));
    this.spikes.push({ x, y, w, hidden, range, rise: hidden ? 0 : 1, imgs, tufts });
  }

  // ---------------- interface ----------------
  private makeHud(): void {
    for (let i = 0; i < HEARTS; i++) this.hearts.push(this.add.image(30 + i * 34, 30, 'hud_heart').setDisplaySize(30, 27).setScrollFactor(0).setDepth(100));
    const coinIcon = this.add.image(W - 120, 30, 'coin_gold').setDisplaySize(26, 26).setScrollFactor(0).setDepth(100);
    void coinIcon;
    this.coinText = this.add.text(W - 100, 30, '0', { fontFamily: FONT.display, fontSize: '22px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.tauntText = this.add.text(W / 2, 120, '', TAUNT_STYLE).setOrigin(0.5).setScrollFactor(0).setDepth(110).setAlpha(0);
    this.bannerCt = this.add.container(W / 2, H / 2 - 40).setScrollFactor(0).setDepth(120).setVisible(false);
    this.debugText = this.add.text(8, H - 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#000000aa' }).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setVisible(false);
  }
  taunt(t: string): void {
    this.tauntText.setText(t).setAlpha(1).setScale(0.6); this.tauntT = 1.6;
    this.tweens.add({ targets: this.tauntText, scale: 1, duration: 260, ease: 'Back.Out' });
  }
  banner(text: string, color: string, sub?: string): void {
    const c = this.bannerCt; c.removeAll(true).setVisible(true).setScale(0.4).setAlpha(1);
    const bg = this.add.graphics(); bg.fillStyle(COL.ink, 0.92); bg.fillRoundedRect(-250, -56, 500, sub ? 126 : 100, 18); bg.lineStyle(5, Phaser.Display.Color.HexStringToColor(color).color, 1); bg.strokeRoundedRect(-250, -56, 500, sub ? 126 : 100, 18);
    const t = this.add.text(0, -8, text, { fontFamily: FONT.display, fontSize: '40px', color }).setOrigin(0.5);
    c.add([bg, t]);
    if (sub) c.add(this.add.text(0, 40, sub, { fontFamily: FONT.body, fontSize: '18px', fontStyle: '800', color: CSS.paper }).setOrigin(0.5));
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 300, onComplete: () => c.setVisible(false) });
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
    this.fx![kind].explode(n, x, y);
  }

  // ---------------- règles ----------------
  hurt(fromX: number): void { if (this.player.hurt(fromX)) this.kill('hearts'); else { this.shake(120, 0.006); this.refreshHearts(true); } }
  kill(cause: string): void {
    const p = this.player;
    if (p.dead || this.won) return;
    p.dead = true; this.deaths++; this.deathLog.push(`${cause}@${Math.round(p.x)}`); this.deathXs.push(p.x); SaveManager.data.totalDeaths++; SaveManager.write();
    AudioManager.play('die'); this.shake(220, 0.012);
    p.body.setVelocity(0, 0); p.body.enable = false; p.view.mood = 'hurt';
    this.burst(p.x, p.y - 15, 'spark', 14);
    this.tweens.add({ targets: p.view, y: p.view.y - 50, angle: 200 * (p.face || 1), duration: 380, ease: 'Quad.Out', yoyo: false });
    this.tweens.add({ targets: p.view, alpha: 0, delay: 300, duration: 300 });
    const msg = cause === 'pit' ? ['Le vide, ça ne pardonne pas.', 'Ce sol était décoratif.', 'Chute libre !'] : cause === 'spikes' ? ['Ça pique.', 'Aïe.', 'Les pics, c\'est tout piquant.'] : ['Plus de cœurs !', 'K.O.'];
    this.taunt(msg[this.deaths % msg.length]);
    this.time.delayedCall(750, () => this.respawn());
  }
  private respawn(): void {
    const p = this.player;
    p.body.enable = true; p.respawn(this.checkpoint.x, this.checkpoint.y); p.view.setAngle(0);
    for (const b of this.blocks) if (b.def.trap === 'crumble') { b.state = 'solid'; b.ct.setPosition(b.def.x, b.def.y).setAngle(0).setAlpha(1); b.body.enable = true; }
    for (const s of this.spikes) if (s.hidden) s.rise = 0;
    for (const sn of this.snails) { sn.alive = true; sn.x = sn.x0; sn.shellT = 0; sn.img.setVisible(true).setAlpha(1).setAngle(0); }
    this.traps.forEach((t) => t.reset(true));
    this.refreshHearts(false);
    // après plusieurs morts au même endroit, un conseil (une fois)
    for (const h of this.level.hints) {
      const n = this.deathXs.filter((d) => Math.abs(d - h.x) < 260).length;
      if (n >= 3 && !this.hintShown.has(h.x)) { this.hintShown.add(h.x); this.time.delayedCall(400, () => this.taunt(h.text)); }
    }
  }
  private refreshHearts(pop: boolean): void {
    this.hearts.forEach((h, i) => {
      const full = i < this.player.hp; h.setTexture(full ? 'hud_heart' : 'hud_heart_empty').setDisplaySize(30, 27);
      if (pop && i === this.player.hp) this.tweens.add({ targets: h, scale: h.scale * 1.5, duration: 120, yoyo: true });
    });
  }
  private win(): void {
    if (this.won) return;
    this.won = true; const p = this.player; p.frozen = true; p.body.setVelocity(0, p.body.velocity.y); p.view.mood = 'happy';
    AudioManager.play('win'); this.burst(this.level.door.x, this.level.door.y - 40, 'spark', 40);
    this.tweens.add({ targets: p.view, x: this.level.door.x, alpha: 0, scale: 0.6, duration: 600, delay: 200 });
    const coins = this.coins.filter((c) => c.got).length, total = this.coins.length, time = this.elapsed;
    const stars = 1 + (this.deaths <= 3 ? 1 : 0) + (coins === total ? 1 : 0);
    SaveManager.record(this.level.id, { time, deaths: this.deaths, coins, stars });
    this.time.delayedCall(1100, () => goTo(this, 'Results', { id: this.level.id, title: this.level.title, time, deaths: this.deaths, coins, total, stars }));
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
    const dt = Math.min(0.05, dms / 1000), t = this.time.now / 1000, p = this.player, L = this.level;
    if (!this.won) this.elapsed = (this.time.now - this.time0) / 1000;
    if (InputManager.pressed('pause') && !this.won) { this.scene.launch('Pause'); this.scene.pause(); return; }
    if (InputManager.pressed('restart') && !p.dead && !this.won) { this.kill('restart'); }
    p.update(dt);
    if (!p.dead && p.y > L.height + 40) this.kill('pit');

    // sols piégés : tremblent puis tombent
    for (const b of this.blocks) {
      if (b.def.trap !== 'crumble') continue;
      const on = !p.dead && p.onGround && p.x + PW / 2 > b.def.x && p.x - PW / 2 < b.def.x + b.def.w && Math.abs(p.y - b.def.y) < 4;
      if (b.state === 'solid' && on) { b.state = 'shaking'; b.t = 0.42; AudioManager.play('crack'); }
      if (b.state === 'shaking') {
        b.t -= dt; b.ct.setPosition(b.def.x + (Math.random() - 0.5) * 4, b.def.y + (Math.random() - 0.5) * 2);
        if (b.t <= 0) { b.state = 'falling'; b.body.enable = false; AudioManager.play('trap'); this.burst(b.def.x + b.def.w / 2, b.def.y + 4, 'chips', 22); this.shake(160, 0.008); this.tweens.add({ targets: b.ct, y: b.def.y + 400, angle: 6, duration: 900, ease: 'Quad.In' }); }
      }
    }
    // pics (cachés : l'herbe tremble quand on approche, puis ils sortent)
    for (const s of this.spikes) {
      const dx = Math.max(s.x - p.x, p.x - (s.x + s.w), 0);
      if (s.hidden) {
        const wake = !p.dead && dx < s.range && Math.abs(p.y - s.y) < 60;
        s.rise = Phaser.Math.Clamp(s.rise + (wake ? dt * 9 : -dt * 1.5), 0, 1);
        s.tufts.forEach((tf, i) => tf.setAngle(dx < s.range + 110 && s.rise < 0.5 ? Math.sin(t * 30 + i) * 14 : 0).setVisible(s.rise < 0.6));
        if (wake && s.rise > 0 && s.rise < 0.2) AudioManager.play('trap');
      }
      s.imgs.forEach((im) => im.setY(s.y + (1 - s.rise) * 18).setVisible(s.rise > 0.02));
      if (!p.dead && s.rise > 0.5 && p.x + 9 > s.x + 4 && p.x - 9 < s.x + s.w - 4 && p.y > s.y - 16 && p.y <= s.y + 6) this.kill('spikes');
    }
    // pièces
    for (const c of this.coins) {
      if (c.got) continue;
      const sw = Math.abs(Math.cos(t * 3 + c.x * 0.05));
      c.img.setY(c.y + Math.sin(t * 3 + c.x) * 3).setScale(Math.max(0.15, sw) * (24 / c.img.width), 24 / c.img.height);
      if (!p.dead && Math.abs(p.x - c.x) < 22 && Math.abs(p.y - 15 - c.y) < 26) { c.got = true; AudioManager.play('coin'); this.burst(c.x, c.y, 'spark', 10); this.tweens.add({ targets: c.img, y: c.y - 40, alpha: 0, duration: 300, onComplete: () => c.img.setVisible(false) }); }
    }
    this.coinText.setText(`${this.coins.filter((c) => c.got).length}/${this.coins.length}`);
    // escargots : on les écrase en tombant dessus, sinon ils retirent un cœur
    for (const sn of this.snails) {
      if (!sn.alive) continue;
      if (sn.shellT > 0) { sn.shellT -= dt; if (sn.shellT <= 0) sn.img.setTexture('snail_walk_a'); }
      else {
        sn.x += sn.vx * dt; if (sn.x < sn.minX || sn.x > sn.maxX) { sn.vx *= -1; sn.x = Phaser.Math.Clamp(sn.x, sn.minX, sn.maxX); }
        sn.img.setTexture(Math.floor(t * 6) % 2 ? 'snail_walk_a' : 'snail_walk_b').setFlipX(sn.vx > 0);
      }
      sn.img.setPosition(sn.x, sn.y + 2).setDisplaySize(44, (44 * sn.img.height) / sn.img.width);
      if (p.dead || Math.abs(p.x - sn.x) > 30 || p.y < sn.y - 34 || p.y > sn.y + 4) continue;
      if (p.body.velocity.y > 60 && p.y < sn.y - 14) {
        p.bounce(420); AudioManager.play('stomp'); this.burst(sn.x, sn.y - 12, 'dust', 10);
        sn.alive = false; sn.img.setTexture('snail_shell');
        this.tweens.add({ targets: sn.img, y: sn.y + 80, angle: 180, alpha: 0, duration: 700, ease: 'Quad.In' });
      } else this.hurt(sn.x);
    }
    // drapeaux
    for (const f of this.flags) {
      if (f.on || p.dead || Math.abs(p.x - f.x) > 24 || Math.abs(p.y - f.y) > 60) continue;
      f.on = true; this.checkpoint = { x: f.x, y: f.y }; AudioManager.play('checkpoint'); this.taunt('Sauvegardé ! (pour de vrai)');
      f.ct.destroy(); f.ct = makeFlag(this, f.x, f.y, COL.mint); this.burst(f.x, f.y - 60, 'spark', 16);
    }
    // pièges
    for (const tr of this.traps) tr.update(dt, t);
    // sortie
    if (!p.dead && !this.won && Math.abs(p.x - L.door.x) < 22 && Math.abs(p.y - L.door.y) < 30) this.win();

    // caméra : anticipe la direction, suit doucement en vertical
    this.lookAhead += ((p.body.velocity.x !== 0 ? p.face * 90 : p.face * 50) - this.lookAhead) * Math.min(1, dt * 2.5);
    const tx = Phaser.Math.Clamp(p.x - W / 2 + this.lookAhead, 0, L.width - W), ty = Phaser.Math.Clamp(p.y - 330, -200, 0);
    this.camX += (tx - this.camX) * Math.min(1, dt * 6); this.camY += (ty - this.camY) * Math.min(1, dt * 3);
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.parallax.update(this.camX, this.camY);
    // messages
    if (this.tauntT > 0) { this.tauntT -= dt; if (this.tauntT < 0.4) this.tauntText.setAlpha(Math.max(0, this.tauntT / 0.4)); }
    if (this.debugOn) this.debugText.setText(`x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} vx ${p.body.velocity.x.toFixed(0)} vy ${p.body.velocity.y.toFixed(0)} sol ${p.onGround} pv ${p.hp} morts ${this.deaths} inv ${p.inverted}`);
    this.touch?.update();
  }
}
