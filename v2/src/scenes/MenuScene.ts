// Menu principal vivant : décor animé en parallaxe, logo animé, perso qui vit sa vie, petit piège en arrière-plan.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT } from '../core/config';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { HeroView, type CharId, makeHeroTextures } from '../entities/HeroArt';
import { buildBlock, Parallax } from '../levels/Terrain';
import { Button, ButtonGroup } from '../ui/Button';
import { fadeIn, goTo } from '../ui/Transition';

const GROUND = 470;
let logoShownOnce = false;

export class MenuScene extends Phaser.Scene {
  private parallax!: Parallax;
  private hero!: HeroView;
  private heroVy = 0;
  private heroY = GROUND;
  private nextIdle = 3;
  private group!: ButtonGroup;
  private panel: { ct: Phaser.GameObjects.Container; group: ButtonGroup; onBack: () => void; onSide?: (dx: number) => void } | null = null;
  private letters: Phaser.GameObjects.Text[] = [];
  private tripT = 6;
  private snail!: Phaser.GameObjects.Image;
  private snailX = 760;
  private snailHide = 0;
  private trapSpike!: Phaser.GameObjects.Image;
  private trapT = 5;
  private hint!: Phaser.GameObjects.Text;
  private drift = 0;

  constructor() { super('Menu'); }

  create(): void {
    this.panel = null; this.letters = [];
    makeHeroTextures(this);
    // ciel, rayons de soleil, soleil
    const sky = this.add.graphics().setDepth(-30);
    sky.fillGradientStyle(0x7cc8ff, 0x7cc8ff, 0xe4f6ff, 0xe4f6ff, 1); sky.fillRect(0, 0, W, H);
    const rays = this.add.graphics().setPosition(820, 70).setDepth(-25);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; rays.fillStyle(0xfff6c8, 0.16); rays.fillTriangle(0, 0, Math.cos(a - 0.09) * 700, Math.sin(a - 0.09) * 700, Math.cos(a + 0.09) * 700, Math.sin(a + 0.09) * 700); }
    this.tweens.add({ targets: rays, angle: 360, duration: 90000, repeat: -1 });
    const sun = this.add.graphics().setPosition(820, 70).setDepth(-24);
    sun.fillStyle(0xfff3a8, 0.35); sun.fillCircle(0, 0, 62); sun.fillStyle(COL.outline, 1); sun.fillCircle(0, 0, 44); sun.fillStyle(0xffe066, 1); sun.fillCircle(0, 0, 41);
    sun.fillStyle(COL.outline, 1); sun.fillCircle(-13, -6, 4); sun.fillCircle(13, -6, 4); sun.lineStyle(3, COL.outline, 1); sun.beginPath(); sun.arc(0, 4, 13, 0.3, Math.PI - 0.3); sun.strokePath();
    this.tweens.add({ targets: sun, scale: 1.05, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.parallax = new Parallax(this, GROUND + 6, -20);
    // sol de premier plan avec les vraies tuiles du jeu
    buildBlock(this, -20, GROUND, W + 40, 120, { bottomOpen: true }).setDepth(5);
    const fit = (k: string, x: number, h: number, d = 4) => { const im = this.add.image(x, GROUND + 4, k).setOrigin(0.5, 1).setDepth(d); im.setDisplaySize((h * im.width) / im.height, h); return im; };
    const tree = fit('tree', 70, 140, 3); this.tweens.add({ targets: tree, angle: { from: -1.5, to: 1.5 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    [190, 230, 600, 905].forEach((x, i) => { const f = fit('flower', x, 26 + (i % 2) * 4, 6); this.tweens.add({ targets: f, angle: { from: -8, to: 8 }, duration: 1300 + i * 230, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); });
    fit('bush', 300, 34, 4); fit('mushroom_red', 650, 22, 6); fit('rock', 880, 18, 6);
    // petit piège qui se déclenche en fond : un pic sort sous l'escargot
    this.trapSpike = this.add.image(800, GROUND + 18, 'spikes').setOrigin(0.5, 1).setDisplaySize(40, 18).setDepth(4);
    this.snail = this.add.image(this.snailX, GROUND + 2, 'snail_walk_a').setOrigin(0.5, 1).setDepth(6);
    this.snail.setDisplaySize(44, (44 * this.snail.height) / this.snail.width);
    // oiseaux et papillons
    this.makeCritters();

    // perso choisi
    const char = (SaveManager.data.custom.char || 'rosa') as CharId;
    this.hero = new HeroView(this, 150, GROUND, char).setDepth(7).setScale(1.6);
    this.heroY = GROUND; this.heroVy = 0;

    this.makeLogo();
    this.makeButtons();
    this.hint = this.add.text(W / 2, H - 14, '', { fontFamily: FONT.body, fontSize: '14px', fontStyle: '800', color: CSS.paper, stroke: CSS.ink, strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(40);
    const upd = () => this.hint.setText(InputManager.device === 'gamepad' ? '✚ choisir · Ⓐ valider · Ⓑ retour' : InputManager.device === 'touch' ? '' : 'Flèches : choisir · Entrée ou Espace : valider · Échap : retour');
    upd(); const off = InputManager.onDevice(upd); this.events.once('shutdown', off);
    this.add.text(W - 10, H - 12, 'v2 · tranche verticale', { fontFamily: FONT.body, fontSize: '11px', color: CSS.paper }).setOrigin(1, 1).setAlpha(0.6).setDepth(40);

    AudioManager.music('menu');
    this.input.on('pointerdown', () => AudioManager.unlock());
    fadeIn(this);
    (window as unknown as { __NSF_MENU?: unknown }).__NSF_MENU = this;
  }

  private makeCritters(): void {
    for (let i = 0; i < 3; i++) {
      const b = this.add.graphics().setDepth(-15); b.lineStyle(2.5, COL.outline, 0.8); b.beginPath(); b.moveTo(-7, -3); b.lineTo(0, 0); b.lineTo(7, -3); b.strokePath();
      const y = 120 + i * 26;
      b.setPosition(-40 - i * 70, y);
      this.tweens.add({ targets: b, x: W + 60, duration: 16000 + i * 3000, repeat: -1, delay: i * 2500 });
      this.tweens.add({ targets: b, scaleY: 0.4, duration: 220, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: b, y: y - 14, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    const cols = [0xff4f87, 0xffd23f, 0xcbb8ff];
    for (let i = 0; i < 3; i++) {
      const bf = this.add.graphics().setDepth(8); bf.fillStyle(cols[i], 1); bf.fillEllipse(-4, 0, 8, 6); bf.fillEllipse(4, 0, 8, 6);
      const x0 = 120 + i * 300, y0 = 380 - i * 20;
      bf.setPosition(x0, y0);
      this.tweens.add({ targets: bf, x: x0 + 120, duration: 4200 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: bf, y: y0 - 40, duration: 1700 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: bf, scaleX: 0.3, duration: 140, yoyo: true, repeat: -1 });
    }
  }

  private makeLogo(): void {
    const word = ['N', 'O', 'T', ' ', 'S', 'O', ' ', 'F', 'A', 'S', 'T', '!'];
    const cols = [CSS.sun, CSS.sun, CSS.sun, '', CSS.sun, CSS.sun, '', CSS.pink, CSS.pink, CSS.pink, CSS.pink, CSS.pink];
    const size = 64, gap = 4;
    const widths: number[] = word.map((c) => (c === ' ' ? 22 : 0));
    const temp = word.map((c, i) => (c === ' ' ? null : this.add.text(0, 0, c, { fontFamily: FONT.display, fontSize: `${size}px`, color: cols[i], stroke: CSS.ink, strokeThickness: 10 }).setOrigin(0.5, 1).setShadow(5, 6, CSS.ink, 0, true, true).setDepth(30)));
    temp.forEach((t, i) => { if (t) widths[i] = t.width - 10; });
    const total = widths.reduce((a, b) => a + b + gap, 0);
    let x = W / 2 - total / 2;
    const quick = logoShownOnce || SaveManager.data.settings.reduceFx;
    temp.forEach((t, i) => {
      const cx = x + widths[i] / 2; x += widths[i] + gap;
      if (!t) return;
      t.setPosition(cx, 112);
      this.letters.push(t);
      if (quick) return;
      t.setY(-60).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({ targets: t, y: 112, angle: 0, delay: 80 + i * 55, duration: 520, ease: 'Bounce.Out' });
    });
    if (!quick) this.time.delayedCall(80 + 12 * 55 + 500, () => { this.trip(); this.cameras.main.shake(140, 0.004); });
    logoShownOnce = true;
    const sub = this.add.text(W / 2 + 150, 132, 'It\'s a Trap!', { fontFamily: FONT.display, fontSize: '20px', color: CSS.paper, stroke: CSS.ink, strokeThickness: 6, padding: { top: 10, bottom: 4, left: 4, right: 4 } }).setOrigin(0.5, 0).setDepth(30).setAngle(-3);
    if (!quick) { sub.setScale(0); this.tweens.add({ targets: sub, scale: 1, delay: 900, duration: 300, ease: 'Back.Out' }); }
  }
  // le « F » trébuche puis se rattrape
  private trip(): void {
    const f = this.letters.find((l) => l.text === 'F');
    if (!f) return;
    this.tweens.chain({ targets: f, tweens: [
      { angle: 38, y: 122, duration: 220, ease: 'Quad.In' },
      { angle: -10, y: 108, duration: 180, ease: 'Back.Out' },
      { angle: 0, y: 112, duration: 220, ease: 'Sine.Out' },
    ] });
    AudioManager.play('whoosh');
  }

  private makeButtons(): void {
    const has = SaveManager.hasProgress();
    const cont = new Button(this, W / 2, 210, has ? 'Continuer' : 'Jouer', () => this.play(), { w: 300, h: 60, size: 26, primary: true, note: has ? 'Niveau 1-1 · Le Pré des Mensonges' : undefined });
    const mk = (x: number, y: number, t: string, fn: () => void, o = {}) => new Button(this, x, y, t, fn, { w: 236, h: 46, size: 17, ...o });
    const items = [
      cont,
      mk(W / 2 - 126, 286, 'Nouvelle partie', () => this.newGame()),
      mk(W / 2 + 126, 286, 'Carte du monde', () => {}, { disabled: true, note: 'bientôt' }),
      mk(W / 2 - 126, 346, 'Personnaliser', () => {}, { disabled: true, note: 'bientôt' }),
      mk(W / 2 + 126, 346, 'Paramètres', () => this.openSettings()),
      mk(W / 2, 406, 'Statistiques', () => this.openStats()),
    ];
    items.forEach((b) => b.setDepth(32));
    this.group = new ButtonGroup(items, 0);
  }

  private play(): void { AudioManager.unlock(); goTo(this, 'Game'); }
  private newGame(): void {
    if (!SaveManager.hasProgress()) { this.play(); return; }
    this.openPanel('Nouvelle partie ?', ['Ta progression sera effacée.', 'Tes réglages sont gardés.'], [
      { t: 'Annuler', fn: () => this.closePanel(), primary: false },
      { t: 'Effacer et jouer', fn: () => { SaveManager.reset(); this.closePanel(); this.play(); }, primary: true },
    ], 0);
  }
  private openStats(): void {
    const d = SaveManager.data, lv = Object.values(d.levels), stars = lv.reduce((a, l) => a + l.stars, 0), coins = lv.reduce((a, l) => a + l.coins, 0);
    const t = Math.round(d.totalTime), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    this.openPanel('Statistiques', [
      `Niveaux finis : ${lv.filter((l) => l.done).length} / 40`, `Étoiles : ${stars} / 120`, `Pièces : ${coins}`,
      `Morts : ${d.totalDeaths}`, `Temps de jeu : ${mm} min ${ss} s`, d.migratedFrom ? 'Progression reprise de l\'ancienne version ✓' : '',
    ].filter(Boolean), [{ t: 'Retour', fn: () => this.closePanel(), primary: true }], 0);
  }
  private openSettings(): void {
    const s = SaveManager.data.settings;
    const pct = (v: number) => `${Math.round(v * 100)} %`;
    const rows: { t: () => string; side: (dx: number) => void; press: () => void }[] = [
      { t: () => `Volume général : ${pct(s.master)}`, side: (dx) => { s.master = Phaser.Math.Clamp(s.master + dx * 0.1, 0, 1); }, press: () => { s.master = s.master >= 1 ? 0 : Math.min(1, s.master + 0.1); } },
      { t: () => `Musique : ${pct(s.music)}`, side: (dx) => { s.music = Phaser.Math.Clamp(s.music + dx * 0.1, 0, 1); }, press: () => { s.music = s.music >= 1 ? 0 : Math.min(1, s.music + 0.1); } },
      { t: () => `Effets sonores : ${pct(s.sfx)}`, side: (dx) => { s.sfx = Phaser.Math.Clamp(s.sfx + dx * 0.1, 0, 1); }, press: () => { s.sfx = s.sfx >= 1 ? 0 : Math.min(1, s.sfx + 0.1); } },
      { t: () => `Réduire animations et flashs : ${s.reduceFx ? 'oui' : 'non'}`, side: () => { s.reduceFx = !s.reduceFx; }, press: () => { s.reduceFx = !s.reduceFx; } },
      { t: () => `Tremblements d'écran : ${s.shake ? 'oui' : 'non'}`, side: () => { s.shake = !s.shake; }, press: () => { s.shake = !s.shake; } },
    ];
    const btns: { t: string; fn: () => void; primary: boolean }[] = rows.map((r) => ({ t: r.t(), fn: () => {}, primary: false }));
    btns.push({ t: 'Retour', fn: () => this.closePanel(), primary: true });
    const p = this.openPanel('Paramètres', ['← → pour régler'], btns, 0, 420);
    const refresh = () => { rows.forEach((r, i) => (p.group.items[i].list[1] as Phaser.GameObjects.Text).setText(r.t())); AudioManager.applyVolumes(); SaveManager.write(); AudioManager.play('click'); };
    rows.forEach((r, i) => { p.group.items[i].onPress = () => { r.press(); refresh(); }; });
    p.onSide = (dx) => { const r = rows[p.group.index]; if (r) { r.side(dx); refresh(); } };
  }

  private openPanel(title: string, lines: string[], buttons: { t: string; fn: () => void; primary: boolean }[], focus: number, bw = 260) {
    this.group.items.forEach((b) => b.disableInteractive());
    const ct = this.add.container(0, 0).setDepth(60);
    const scrim = this.add.rectangle(0, 0, W, H, COL.ink, 0.6).setOrigin(0, 0).setInteractive();
    const vertical = buttons.length > 2;
    const ph = 120 + lines.length * 26 + (vertical ? buttons.length * 54 : 70);
    const pw = Math.max(460, bw + 80);
    const bg = this.add.graphics(); bg.fillStyle(COL.ink, 1); bg.fillRoundedRect(W / 2 - pw / 2 + 6, H / 2 - ph / 2 + 7, pw, ph, 20); bg.fillStyle(COL.paper, 1); bg.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20); bg.lineStyle(5, COL.ink, 1); bg.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20);
    const top = H / 2 - ph / 2;
    const tt = this.add.text(W / 2, top + 34, title, { fontFamily: FONT.display, fontSize: '28px', color: CSS.ink }).setOrigin(0.5);
    ct.add([scrim, bg, tt]);
    lines.forEach((l, i) => ct.add(this.add.text(W / 2, top + 76 + i * 26, l, { fontFamily: FONT.body, fontSize: '18px', fontStyle: '800', color: CSS.ink }).setOrigin(0.5)));
    const by0 = top + 96 + lines.length * 26;
    const items = buttons.map((b, i) => {
      const x = vertical ? W / 2 : W / 2 + (i - (buttons.length - 1) / 2) * (bw + 20), y = vertical ? by0 + i * 54 : by0 + 10;
      const btn = new Button(this, x, y, b.t, b.fn, { w: bw, h: 44, size: 15, primary: b.primary });
      ct.add(btn); return btn;
    });
    ct.setAlpha(0).setScale(0.96); this.tweens.add({ targets: ct, alpha: 1, scale: 1, duration: 160, ease: 'Quad.Out' });
    const group = new ButtonGroup(items, focus);
    this.panel = { ct, group, onBack: () => this.closePanel() };
    InputManager.swallow();
    return this.panel;
  }
  private closePanel(): void {
    if (!this.panel) return;
    const ct = this.panel.ct; this.panel = null;
    this.tweens.add({ targets: ct, alpha: 0, duration: 120, onComplete: () => ct.destroy() });
    this.group.items.forEach((b) => b.setInteractive({ useHandCursor: true }));
    InputManager.swallow();
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(0.05, dms / 1000), t = this.time.now / 1000;
    this.drift += dt * 14;
    this.parallax.update(0, 0, this.drift);
    // navigation
    const g = this.panel ? this.panel.group : this.group, nav = InputManager.nav();
    if (nav) { if (this.panel?.onSide && nav.x && !nav.y) this.panel.onSide(nav.x); else g.move(nav.x, nav.y); }
    if (InputManager.pressed('confirm')) { AudioManager.unlock(); g.press(); }
    if (InputManager.pressed('back') && this.panel) this.panel.onBack();
    // logo : un trébuchement de temps en temps
    this.tripT -= dt; if (this.tripT <= 0) { this.tripT = 9 + Math.random() * 6; this.trip(); }
    // perso : petites animations au hasard
    this.nextIdle -= dt;
    const h = this.hero;
    if (this.nextIdle <= 0) {
      this.nextIdle = 4 + Math.random() * 4;
      const r = Math.random();
      if (r < 0.3) { this.heroVy = -420; h.punch(0.75, 1.3); AudioManager.play('jump'); }
      else if (r < 0.55) { h.look(-1, 0); this.time.delayedCall(700, () => h.look(1, -0.5)); this.time.delayedCall(1500, () => h.look(0, 0)); }
      else if (r < 0.75) { this.tweens.chain({ targets: h, tweens: [{ angle: 14, duration: 200, ease: 'Sine.Out' }, { angle: -10, duration: 220 }, { angle: 0, duration: 260, ease: 'Back.Out' }] }); h.mood = 'surprise'; this.time.delayedCall(700, () => { h.mood = 'normal'; }); }
      else { h.mood = 'happy'; this.time.delayedCall(1200, () => { h.mood = 'normal'; }); }
    }
    if (this.heroVy !== 0 || this.heroY < GROUND) {
      this.heroVy += 1800 * dt; this.heroY += this.heroVy * dt;
      if (this.heroY >= GROUND) { this.heroY = GROUND; if (this.heroVy > 200) h.punch(1.25, 0.78); this.heroVy = 0; }
    }
    h.setY(this.heroY);
    h.tick(dt, { run: false, air: this.heroY < GROUND - 1, vy: this.heroVy, speed: 0 });
    // l'escargot avance… le pic sort, il rentre dans sa coquille
    this.trapT -= dt;
    if (this.snailHide > 0) { this.snailHide -= dt; if (this.snailHide <= 0) this.snail.setTexture('snail_walk_a'); }
    else {
      this.snailX -= 22 * dt; if (this.snailX < 560) this.snailX = 960;
      this.snail.setTexture(Math.floor(t * 5) % 2 ? 'snail_walk_a' : 'snail_walk_b');
    }
    this.snail.setX(this.snailX).setDisplaySize(44, (44 * this.snail.height) / this.snail.width);
    if (this.trapT <= 0 && Math.abs(this.snailX - 800) < 30) {
      this.trapT = 8 + Math.random() * 6;
      AudioManager.play('trap');
      this.tweens.chain({ targets: this.trapSpike, tweens: [{ y: GROUND + 2, duration: 90, ease: 'Back.Out' }, { y: GROUND + 2, duration: 900 }, { y: GROUND + 18, duration: 300 }] });
      this.snail.setTexture('snail_shell'); this.snailHide = 1.6;
      h.mood = 'surprise'; h.look(1, 0); this.time.delayedCall(900, () => { h.mood = 'normal'; h.look(0, 0); });
    }
  }
}
