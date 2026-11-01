import Phaser from 'phaser';
import { fitCamera } from '../core/Display';
import { DEPTH, FONTS, GAME_W, GAME_H } from '../core/constants';
import { Audio } from '../core/Audio';
import { Save } from '../core/Save';
import { Button, ButtonList } from '../ui/Button';
import { paintChapter1, ensureCanvas } from '../art/textures';
import { CHAPTERS, LEVELS, LEVEL_ORDER } from '../levels';
import { PadReader } from '../core/Pad';
import { MenuBackdrop, MENU_GROUND } from '../menu/MenuBackdrop';
import { MenuStage } from '../menu/MenuStage';
import { MenuNav } from '../menu/MenuNav';
import { paintLogoNotSo, paintLogoFast, LOGO_RES } from '../menu/paintMenu';
import { CHAPTER_ART, ART_W, ART_H } from '../menu/chapterArt';

/**
 * Écran d'accueil : diorama vivant de la serre.
 * À gauche : le logo et un menu épuré. À droite : une petite scène où le héros
 * se fait surprendre par les pièges du chapitre 1 (tout est cliquable).
 */
export class MenuScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;
  private stage!: MenuStage;
  private nav!: MenuNav;
  private notSo!: Phaser.GameObjects.Image;
  private fast!: Phaser.GameObjects.Image;
  private panel: Phaser.GameObjects.Container | null = null;
  private panelList: ButtonList | null = null;
  private padHint!: Phaser.GameObjects.Container;
  private hintPad = new PadReader();
  private quick = false;
  private leaving = false;

  constructor() {
    super('Menu');
  }

  init(data: { quick?: boolean }): void {
    this.quick = !!data?.quick;
    this.leaving = false;
    this.panel = null;
    this.panelList = null;
  }

  create(): void {
    fitCamera(this);
    paintChapter1(this);
    this.backdrop = new MenuBackdrop(this);
    this.stage = new MenuStage(this, this.quick);
    this.buildLogo();
    this.buildNav();
    this.buildPadHint();

    this.cameras.main.fadeIn(this.quick ? 250 : 700, 20, 40, 36);

    const unlock = () => {
      Audio.unlock();
      Audio.playMusic('menu');
    };
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);
    if (Audio.ctx) Audio.playMusic('menu');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.nav.destroy();
      this.panelList?.destroy();
      this.stage.destroy();
    });
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.backdrop.update(dt);
    this.stage.update(delta);
    this.hintPad.poll(dt);
    const show = this.hintPad.state.connected && !this.leaving;
    if (show !== this.padHint.visible || (show && this.padHint.alpha < 1)) {
      this.padHint.setVisible(true);
      this.padHint.alpha = Phaser.Math.Clamp(this.padHint.alpha + (show ? dt : -dt) * 4, 0, 1);
      if (!show && this.padHint.alpha <= 0) this.padHint.setVisible(false);
    }
  }

  // ------------------------------------------------------------ logo

  private buildLogo(): void {
    ensureCanvas(this, 'logo-notso', paintLogoNotSo);
    ensureCanvas(this, 'logo-fast', paintLogoFast);
    const k = 1 / LOGO_RES;
    this.notSo = this.add.image(0, 0, 'logo-notso').setScale(k).setDepth(DEPTH.vignette + 5);
    this.fast = this.add.image(0, 0, 'logo-fast').setScale(k).setDepth(DEPTH.vignette + 5);
    // "FAST!" : le F s'aligne sur le N de "NOT SO", les traits de vitesse débordent à gauche
    const fastW = this.fast.displayWidth, fastH = this.fast.displayHeight;
    const notW = this.notSo.displayWidth, notH = this.notSo.displayHeight;
    const fastLeft = 34, fastTop = 26 + notH - 30;
    this.fast.setPosition(fastLeft + fastW / 2, fastTop + fastH / 2);
    this.notSo.setPosition(fastLeft + 116 + notW / 2, 28 + notH / 2);

    const notSoY = this.notSo.y, fastY = this.fast.y;
    this.fast.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 20 });
    this.fast.on('pointerdown', () => this.wobbleLogo());

    if (!this.quick) {
      this.notSo.setAlpha(0).setY(notSoY - 26);
      this.fast.setAlpha(0).setScale(k * 1.35);
      this.tweens.add({ targets: this.notSo, alpha: 1, y: notSoY, duration: 520, delay: 180, ease: 'Cubic.easeOut' });
      this.tweens.add({
        targets: this.fast, alpha: 1, scale: k, duration: 420, delay: 420, ease: 'Back.easeOut',
        onStart: () => Audio.sfx('whoosh', { intensity: 0.6 }),
        onComplete: () => {
          Audio.sfx('logoThud');
          this.tweens.add({ targets: this.fast, scaleY: k * 0.93, scaleX: k * 1.04, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
          this.logoDust();
        }
      });
    }
    // respiration très lente + petit "coup de frein" régulier (le titre dit "pas si vite")
    this.tweens.add({ targets: this.notSo, y: notSoY - 3, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 900 });
    this.time.addEvent({
      delay: 6500, loop: true, startAt: 2000, callback: () => {
        if (this.leaving || this.tweens.isTweening(this.fast)) return;
        this.tweens.add({ targets: this.fast, x: this.fast.x + 12, angle: -3, duration: 170, yoyo: true, hold: 520, ease: 'Back.easeOut' });
        this.time.delayedCall(170, () => this.logoDust(0.5));
      }
    });
    void fastY;
  }

  private logoDust(amount = 1): void {
    const b = this.fast.getBounds();
    const p = this.add.particles(0, 0, 'dust', {
      emitting: false, lifespan: 520, speed: { min: 30, max: 120 }, angle: { min: 160, max: 380 },
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.75, end: 0 }, gravityY: -30
    }).setDepth(DEPTH.vignette + 4);
    p.explode(Math.round(10 * amount), b.centerX, b.bottom - 12);
    p.explode(Math.round(6 * amount), b.left + 90, b.bottom - 12);
    this.time.delayedCall(700, () => p.destroy());
  }

  private wobbleLogo(): void {
    if (this.tweens.isTweening(this.fast)) return;
    Audio.unlock();
    Audio.sfx('boing');
    const k = 1 / LOGO_RES;
    this.tweens.add({ targets: this.fast, scaleX: k * 1.08, scaleY: k * 0.9, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.fast, angle: { from: -4, to: 4 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => this.fast.setAngle(0) });
    this.tweens.add({ targets: this.notSo, y: this.notSo.y - 10, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  // ------------------------------------------------------------ menu

  private buildNav(): void {
    const firstOpen = LEVELS.find((l) => l.data && !Save.level(l.id).completed) ?? LEVELS[0];
    const anyDone = LEVEL_ORDER.some((id) => Save.level(id).completed);
    this.nav = new MenuNav(this, 112, 352, 56, [
      { label: anyDone ? 'Continuer' : 'Jouer', primary: true, action: () => this.startLevel(firstOpen.id) },
      { label: 'Chapitres', action: () => this.openChapters() },
      { label: 'Options', action: () => this.openOptions() },
      { label: 'Crédits', action: () => this.openCredits() }
    ]);
    this.nav.onFocus = () => this.stage.lookAtMenu();
    this.nav.focusFirst();
    const rows = this.nav.rows;
    if (this.quick) {
      this.nav.setEnabled(true);
    } else {
      rows.forEach((r, i) => {
        const x = r.x;
        r.setAlpha(0).setX(x - 34);
        this.tweens.add({ targets: r, alpha: i === 0 ? 1 : 0.8, x, duration: 460, delay: 760 + i * 80, ease: 'Cubic.easeOut' });
      });
      this.time.delayedCall(760 + rows.length * 80 + 200, () => { if (!this.panel && !this.leaving) this.nav.setEnabled(true); });
    }
  }

  private buildPadHint(): void {
    const glyph = (x: number, letter: string, col: number, label: string) => {
      const g = this.add.graphics();
      g.fillStyle(col, 1);
      g.fillCircle(x, 0, 11);
      const l = this.add.text(x, 0, letter, { fontFamily: FONTS.ui, fontSize: '14px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
      const t = this.add.text(x + 17, 0, label, { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '500', color: '#24306a' }).setOrigin(0, 0.5);
      return [g, l, t];
    };
    this.padHint = this.add.container(112, MENU_GROUND + 40, [
      ...glyph(0, 'A', 0x4c9a5c, 'Valider'),
      ...glyph(110, 'B', 0xc9541b, 'Retour')
    ]).setDepth(DEPTH.vignette + 5).setAlpha(0).setVisible(false);
    this.padHint.list.forEach((o) => {
      if (o instanceof Phaser.GameObjects.Text && o.text.length > 1) o.setColor('#fff6e0').setShadow(0, 1, 'rgba(20,30,30,0.6)', 4);
    });
  }

  private startLevel(id: string): void {
    if (this.leaving) return;
    this.leaving = true;
    Audio.unlock();
    this.nav.setEnabled(false);
    this.input.enabled = false;
    Audio.sfx('whoosh', { intensity: 1 });
    this.nav.rows.forEach((r, i) => this.tweens.add({ targets: r, x: r.x - 40, alpha: 0, duration: 260, delay: i * 45, ease: 'Cubic.easeIn' }));
    this.tweens.add({ targets: [this.notSo, this.fast], y: '-=30', alpha: 0, duration: 380, delay: 80, ease: 'Cubic.easeIn' });
    this.stage.exit();
    this.time.delayedCall(260, () => {
      this.cameras.main.fadeOut(480, 20, 40, 36);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { levelId: id }));
    });
  }

  /** Les panneaux (inchangés) prennent la main : le menu se met en retrait. */
  private setMainEnabled(on: boolean): void {
    this.nav.setEnabled(on);
    const rows = this.nav.rows;
    this.tweens.add({ targets: [...rows, this.notSo, this.fast], alpha: on ? 1 : 0.35, duration: 220 });
    if (on) this.nav.focusFirst();
  }

  // ------------------------------------------------------------ panneaux

  private openPanel(title: string, w: number, h: number): Phaser.GameObjects.Container {
    this.closePanel();
    this.setMainEnabled(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c1c1f, 0.45).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0d1a22, 0.3);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 28);
    g.fillStyle(0x173640, 0.97);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    g.lineStyle(2, 0x7fd1c7, 0.4);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    const t = this.add.text(0, -h / 2 + 46, title, { fontFamily: FONTS.display, fontSize: '34px', color: '#fff1c9' }).setOrigin(0.5);
    const inner = this.add.container(GAME_W / 2, GAME_H / 2 + 20, [g, t]).setAlpha(0);
    this.tweens.add({ targets: inner, alpha: 1, y: GAME_H / 2, duration: 260, ease: 'Back.easeOut' });
    this.panel = this.add.container(0, 0, [dim, inner]).setDepth(DEPTH.vignette + 10);
    this.tweens.add({ targets: dim, alpha: { from: 0, to: 1 }, duration: 200 });
    const esc = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);
    esc?.once('down', () => this.closePanel());
    return inner;
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.panelList?.destroy();
    this.panelList = null;
    this.panel.destroy();
    this.panel = null;
    this.setMainEnabled(true);
  }

  private openChapters(): void {
    const inner = this.openPanel('Chapitres', 1150, 540);
    const buttons: Button[] = [];
    const cardW = ART_W, cardH = 330, top = -168;
    CHAPTERS.forEach((ch, i) => {
      const cx = -2 * (cardW + 20) + i * (cardW + 20);
      const left = cx - cardW / 2;
      const levels = LEVELS.filter((l) => l.chapter === ch.n);
      const done = levels.filter((l) => Save.level(l.id).completed).length;
      const built = levels.some((l) => l.data);
      // un chapitre s'ouvre quand le boss du précédent est vaincu (le 1 est toujours ouvert)
      const prevBoss = ch.n > 1 ? LEVELS.find((l) => l.chapter === ch.n - 1 && l.index === 8) : undefined;
      const unlocked = ch.n === 1 || (!!prevBoss && Save.level(prevBoss.id).completed);
      const open = unlocked && built;

      const card = this.add.graphics();
      card.fillStyle(0x08181c, 0.35);
      card.fillRoundedRect(left + 3, top + 7, cardW, cardH, 18);
      card.fillStyle(0x10272d, 1);
      card.fillRoundedRect(left, top, cardW, cardH, 18);
      card.lineStyle(1.5, open ? ch.palette[1] : 0x2f4a52, open ? 0.7 : 0.6);
      card.strokeRoundedRect(left, top, cardW, cardH, 18);

      // illustration du chapitre, cadrée pour la carte (jamais étirée)
      const key = ensureCanvas(this, `chapter-art-${ch.n}`, CHAPTER_ART[i]);
      const art = this.add.image(left, top, key).setOrigin(0);
      const items: Phaser.GameObjects.GameObject[] = [card, art];
      if (!open) {
        const veil = this.add.graphics();
        veil.fillStyle(0x0b1a1f, 0.55);
        veil.fillRoundedRect(left, top, cardW, ART_H, { tl: 18, tr: 18, bl: 0, br: 0 });
        veil.fillStyle(0x10272d, 0.92);
        veil.fillCircle(cx, top + ART_H / 2, 24);
        veil.lineStyle(1.5, 0xfff1c9, 0.35);
        veil.strokeCircle(cx, top + ART_H / 2, 24);
        items.push(veil, this.add.image(cx, top + ART_H / 2, 'icon-lock').setScale(0.62).setAlpha(0.9));
      } else {
        // le chapitre ouvert "respire" doucement (liseré lumineux)
        const glow = this.add.graphics();
        glow.lineStyle(3, ch.palette[1], 1);
        glow.strokeRoundedRect(left - 1, top - 1, cardW + 2, cardH + 2, 19);
        glow.setAlpha(0.15);
        this.tweens.add({ targets: glow, alpha: 0.55, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        items.push(glow);
      }

      const tx = left + 16;
      const num = this.add.text(tx, top + ART_H + 14, `CHAPITRE ${ch.n}`, {
        fontFamily: FONTS.ui, fontSize: '13px', fontStyle: '600', color: open ? '#9fc3b8' : '#6f8f8a'
      }).setLetterSpacing(1.5);
      const name = this.add.text(tx, top + ART_H + 34, ch.name, {
        fontFamily: FONTS.ui, fontSize: '19px', fontStyle: '600', color: open ? '#fff6e0' : '#b9c9c4',
        wordWrap: { width: cardW - 30 }, lineSpacing: 2
      });
      // 8 pastilles de progression (la 8e, carrée, = boss)
      const dots = this.add.graphics();
      const dy = top + ART_H + 112;
      for (let k = 0; k < 8; k++) {
        const lx = tx + 6 + k * 21;
        const lv = levels[k];
        const okLv = Save.level(lv.id).completed;
        dots.fillStyle(okLv ? 0xf7d774 : open && lv.data ? 0x7fd1c7 : 0x2f4a52, 1);
        if (k === 7) dots.fillRoundedRect(lx - 6.5, dy - 6.5, 13, 13, 3);
        else dots.fillCircle(lx, dy, 5.5);
      }
      const state = !unlocked
        ? `Verrouillé · finis le chapitre ${ch.n - 1}`
        : !built ? 'En construction' : `${done} / 8 terminés`;
      const prog = this.add.text(tx, dy + 14, state, {
        fontFamily: FONTS.ui, fontSize: '14px', color: open ? '#cfe3dc' : '#6f8f8a', wordWrap: { width: cardW - 30 }
      });
      items.push(num, name, dots, prog);
      inner.add(items);
      if (open) {
        const b = new Button(this, cx, top + cardH - 32, 'Choisir', () => this.openLevels(ch.n), { primary: true, width: 150, height: 42, fontSize: 18 });
        inner.add(b);
        buttons.push(b);
      }
    });
    const back = new Button(this, 0, 222, 'Retour', () => this.closePanel(), { width: 160, height: 44, fontSize: 19 });
    inner.add(back);
    buttons.push(back);
    this.panelList = new ButtonList(this, buttons, () => this.closePanel());
    this.panelList.focusFirst();
  }

  private openLevels(chapter: number): void {
    const ch = CHAPTERS[chapter - 1];
    const inner = this.openPanel(ch.name, 760, 420);
    const levels = LEVELS.filter((l) => l.chapter === chapter);
    const buttons: Button[] = [];
    levels.forEach((lv, i) => {
      const col = i % 4, rowI = Math.floor(i / 4);
      const x = -255 + col * 170, y = -70 + rowI * 120;
      const unlocked = !!lv.data && Save.isUnlocked(lv.id, LEVEL_ORDER);
      const rec = Save.level(lv.id);
      const b = new Button(this, x, y, lv.boss ? `${lv.id} ★` : lv.id, () => this.startLevel(lv.id), {
        width: 130, height: 50, primary: unlocked, disabled: !unlocked, fontSize: 21
      });
      const label = this.add.text(x, y + 40, lv.data ? lv.name : 'Bientôt', {
        fontFamily: FONTS.ui, fontSize: '14px', color: lv.data ? '#cfe3dc' : '#6f8f8a', align: 'center', wordWrap: { width: 150 }
      }).setOrigin(0.5, 0);
      inner.add([b, label]);
      if (rec.completed) inner.add(this.add.image(x + 58, y - 22, 'cp-bloom').setScale(0.22));
      buttons.push(b);
    });
    const back = new Button(this, 0, 168, 'Retour', () => this.openChapters(), { width: 160, height: 44, fontSize: 19 });
    inner.add(back);
    buttons.push(back);
    this.panelList = new ButtonList(this, buttons, () => this.openChapters());
    this.panelList.focusFirst();
  }

  private openOptions(): void {
    const inner = this.openPanel('Options', 520, 540);
    const s = () => Save.settings;
    const pct = (v: number) => `${Math.round(v * 100)} %`;
    const buttons: Button[] = [];

    const slider = (y: number, label: string, get: () => number, set: (v: number) => void) => {
      const l = this.add.text(-200, y, label, { fontFamily: FONTS.ui, fontSize: '20px', color: '#fff6e0' }).setOrigin(0, 0.5);
      const val = this.add.text(110, y, pct(get()), { fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '600', color: '#f7d774' }).setOrigin(0.5);
      const change = (d: number) => { set(Phaser.Math.Clamp(Math.round((get() + d) * 10) / 10, 0, 1)); val.setText(pct(get())); Audio.applySettings(); };
      const minus = new Button(this, 50, y, '−', () => change(-0.1), { width: 44, height: 40 });
      const plus = new Button(this, 170, y, '+', () => change(0.1), { width: 44, height: 40 });
      inner.add([l, val, minus, plus]);
      buttons.push(minus, plus);
    };
    slider(-110, 'Musique', () => s().music, (v) => Save.updateSettings({ music: v }));
    slider(-50, 'Effets sonores', () => s().sfx, (v) => Save.updateSettings({ sfx: v }));

    const muteBtn = new Button(this, 0, 14, s().muted ? 'Son : coupé' : 'Son : activé', () => {
      const m = Audio.toggleMute();
      muteBtn.setText(m ? 'Son : coupé' : 'Son : activé');
    }, { width: 300, height: 46, fontSize: 19 });
    const touchLabel = (v: string) => `Commandes tactiles : ${v === 'auto' ? 'auto' : v === 'on' ? 'oui' : 'non'}`;
    const touchBtn = new Button(this, 0, 72, touchLabel(s().touchControls), () => {
      const order = ['auto', 'on', 'off'] as const;
      const next = order[(order.indexOf(s().touchControls) + 1) % 3];
      Save.updateSettings({ touchControls: next });
      touchBtn.setText(touchLabel(next));
    }, { width: 300, height: 46, fontSize: 19 });
    const qLabel = (q: string) => `Netteté : ${q === 'perf' ? 'économe' : 'maximale'}`;
    const qualityBtn = new Button(this, 0, -166, qLabel(s().quality), () => {
      const next = s().quality === 'perf' ? 'auto' : 'perf';
      Save.updateSettings({ quality: next });
      qualityBtn.setText(qLabel(next) + ' (au redémarrage)');
    }, { width: 360, height: 40, fontSize: 17 });
    inner.add(qualityBtn);
    buttons.push(qualityBtn);
    let armed = false;
    const resetBtn = new Button(this, 0, 130, 'Effacer la progression', () => {
      if (!armed) {
        armed = true;
        resetBtn.setText('Confirmer l’effacement ?');
        this.time.delayedCall(3000, () => { if (armed) { armed = false; resetBtn.setText('Effacer la progression'); } });
      } else {
        armed = false;
        Save.reset();
        resetBtn.setText('Progression effacée');
      }
    }, { width: 300, height: 46, fontSize: 19 });
    const back = new Button(this, 0, 196, 'Retour', () => { this.closePanel(); this.scene.restart({ quick: true }); }, { width: 160, height: 44, fontSize: 19 });
    inner.add([muteBtn, touchBtn, resetBtn, back]);
    buttons.push(muteBtn, touchBtn, resetBtn, back);
    this.panelList = new ButtonList(this, buttons, () => { this.closePanel(); this.scene.restart({ quick: true }); });
    this.panelList.focusFirst();
  }

  private openCredits(): void {
    const inner = this.openPanel('Crédits', 560, 420);
    const lines = [
      'NOT SO FAST! — prototype, chapitre 1',
      '',
      'Conception, direction : Clément',
      'Développement, illustrations, sons : réalisés avec Claude',
      '',
      'Moteur : Phaser 4 (licence MIT)',
      'Polices : Bagel Fat One, Fredoka (SIL Open Font License)',
      'Graphismes SVG/Canvas et sons Web Audio originaux.',
      '',
      'Commandes : ← → ou Q/D · Saut : Espace / Z / ↑',
      'Pause : Échap · Recommencer : R · Muet : M',
      'Manette : stick ou croix · A saut · Start pause · Select recommencer'
    ];
    const t = this.add.text(0, 10, lines.join('\n'), {
      fontFamily: FONTS.ui, fontSize: '17px', color: '#e6f1ec', align: 'center', lineSpacing: 6
    }).setOrigin(0.5);
    const back = new Button(this, 0, 168, 'Retour', () => this.closePanel(), { width: 160, height: 44, fontSize: 19 });
    inner.add([t, back]);
    this.panelList = new ButtonList(this, [back], () => this.closePanel());
    this.panelList.focusFirst();
  }
}
