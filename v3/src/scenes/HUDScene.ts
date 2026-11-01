import Phaser from 'phaser';
import { fitCamera } from '../core/Display';
import { FONTS, GAME_W, GAME_H } from '../core/constants';
import { Bus, EV, formatTime, type HudStats, type VictoryStats } from '../core/Bus';
import { Audio } from '../core/Audio';
import { Save } from '../core/Save';
import { touchState } from '../core/Controls';
import { PadReader, PAD } from '../core/Pad';
import { Button, ButtonList } from '../ui/Button';
import { Tutorial } from '../ui/Tutorial';
import { levelMeta, nextLevel } from '../levels';
import { TUNING } from '../core/Difficulty';
import { ensureCanvas } from '../art/textures';
import { paintWitchHat } from '../halloween/art';

/** Interface en jeu : discrète, jamais par-dessus les plateformes. */
export class HUDScene extends Phaser.Scene {
  private deathsText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private list: ButtonList | null = null;
  private escKey?: Phaser.Input.Keyboard.Key;
  private paused = false;
  private padReader = new PadReader();
  private tutorial: Tutorial | null = null;

  constructor() {
    super('HUD');
  }

  create(): void {
    fitCamera(this);
    this.overlay = null;
    this.list = null;
    this.paused = false;
    const info = (this.registry.get('levelInfo') as { id: string; name: string; difficulty?: 'easy' | 'expert' }) ?? { id: '1-1', name: '' };
    const diff = info.difficulty ?? Save.difficulty;

    // --- pastille niveau (haut gauche)
    const chip = this.add.graphics();
    chip.fillStyle(0x16302f, 0.72);
    chip.fillRoundedRect(20, 18, 64, 40, 20);
    this.add.text(52, 38, info.id, { fontFamily: FONTS.display, fontSize: '22px', color: '#fff1c9' }).setOrigin(0.5);
    // pastille de difficulté (toujours visible : on sait dans quel mode on joue)
    const dLabel = this.add.text(0, 0, TUNING[diff].label.toUpperCase(), {
      fontFamily: FONTS.ui, fontSize: '14px', fontStyle: '600', color: diff === 'expert' ? '#fff1e6' : '#173640'
    }).setOrigin(0.5).setLetterSpacing(1.2);
    const dw = dLabel.width + 22;
    const dchip = this.add.graphics();
    dLabel.setDepth(1);
    dchip.fillStyle(diff === 'expert' ? 0xc9541b : 0x7fd1c7, 0.92);
    dchip.fillRoundedRect(92, 26, dw, 24, 12);
    dLabel.setPosition(92 + dw / 2, 38);
    const nameX = 92 + dw + 12;
    this.nameText = this.add.text(nameX - 4, 38, info.name, {
      fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '600', color: '#fff8e6'
    }).setOrigin(0, 0.5).setShadow(0, 2, 'rgba(10,30,30,0.45)', 6);
    this.nameText.setAlpha(0);
    this.tweens.add({ targets: this.nameText, alpha: 1, x: nameX, duration: 500, delay: 300 });
    this.tweens.add({ targets: this.nameText, alpha: 0, duration: 800, delay: 4200 });

    // --- morts + temps (haut droite)
    const bar = this.add.graphics();
    bar.fillStyle(0x16302f, 0.72);
    bar.fillRoundedRect(GAME_W - 330, 18, 248, 40, 20);
    this.add.image(GAME_W - 306, 38, 'icon-wilt').setScale(0.6);
    this.deathsText = this.add.text(GAME_W - 286, 38, '0', { fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '600', color: '#fff1c9' }).setOrigin(0, 0.5);
    this.add.image(GAME_W - 220, 38, 'icon-clock').setScale(0.55);
    this.timeText = this.add.text(GAME_W - 200, 38, '0:00.00', { fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '600', color: '#fff1c9' }).setOrigin(0, 0.5);

    const pauseBtn = this.add.container(GAME_W - 46, 38);
    const pg = this.add.graphics();
    pg.fillStyle(0x16302f, 0.72);
    pg.fillCircle(0, 0, 20);
    pauseBtn.add([pg, this.add.image(0, 0, 'icon-pause').setScale(0.6)]);
    pauseBtn.setSize(44, 44).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (!this.overlay) this.requestPause();
    });

    this.buildTouchControls();

    // tutoriel des commandes : uniquement au tout premier niveau joué
    this.tutorial = Save.flag('tutorial') ? null : new Tutorial(this, () => Save.setFlag('tutorial'));

    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);
    this.escKey?.on('down', () => { if (this.paused) this.resume(); });
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.P, false).on('down', () => { if (this.paused) this.resume(); });
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M, false).on('down', () => Audio.toggleMute());

    Bus.on(EV.stats, this.onStats, this);
    Bus.on(EV.pause, this.showPause, this);
    Bus.on(EV.victory, this.showVictory, this);
    Bus.on(EV.checkpoint, this.onCheckpoint, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Bus.off(EV.stats, this.onStats, this);
      Bus.off(EV.pause, this.showPause, this);
      Bus.off(EV.victory, this.showVictory, this);
      Bus.off(EV.checkpoint, this.onCheckpoint, this);
      this.list?.destroy();
      touchState.left = touchState.right = touchState.jump = false;
    });
  }

  update(_t: number, delta: number): void {
    // Start (manette) reprend la partie depuis la pause, comme Échap au clavier
    this.padReader.poll(delta / 1000);
    if (!this.paused) this.tutorial?.update();
    if (this.paused && this.padReader.pressed(PAD.START)) this.resume();
  }

  private onStats(s: HudStats): void {
    this.deathsText.setText(String(s.deaths));
    this.timeText.setText(formatTime(s.timeMs));
  }

  private onCheckpoint(): void {
    const t = this.add.text(GAME_W / 2, GAME_H - 70, 'Point de contrôle', {
      fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '600', color: '#fff8e6'
    }).setOrigin(0.5).setShadow(0, 2, 'rgba(10,30,30,0.5)', 8).setAlpha(0);
    const icon = this.add.image(GAME_W / 2 - t.width / 2 - 22, GAME_H - 70, 'cp-bloom').setScale(0.28).setAlpha(0);
    this.tweens.add({ targets: [t, icon], alpha: 1, y: '-=8', duration: 260 });
    this.tweens.add({ targets: [t, icon], alpha: 0, delay: 1400, duration: 400, onComplete: () => { t.destroy(); icon.destroy(); } });
    this.tweens.add({ targets: icon, angle: 180, duration: 1600 });
  }

  private requestPause(): void {
    // passe par la scène de jeu pour qu'elle se mette en pause proprement
    Bus.emit(EV.pause);
    this.scene.pause('Game');
  }

  // ------------------------------------------------------------ pause

  private showPause(): void {
    if (this.overlay) return;
    this.paused = true;
    this.padReader.swallow(); // le Start qui a mis en pause ne doit pas la refermer aussitôt
    const { panel, add } = this.panel('Pause', 440);
    const muted = Save.settings.muted;
    const cur = Save.difficulty;
    const buttons = [
      new Button(this, 0, -84, 'Reprendre', () => this.resume(), { primary: true }),
      new Button(this, 0, -22, 'Recommencer le niveau', () => { this.close(); Bus.emit(EV.restart); }, { width: 280 }),
      new Button(this, 0, 40, `Difficulté : ${TUNING[cur].label}`, () => this.confirmDifficulty(), { width: 280 }),
      new Button(this, 0, 102, muted ? 'Son : coupé' : 'Son : activé', () => {
        const m = Audio.toggleMute();
        buttons[3].setText(m ? 'Son : coupé' : 'Son : activé');
      }, { width: 280 }),
      new Button(this, 0, 164, 'Menu principal', () => { this.close(); Bus.emit(EV.quit); }, { width: 280 })
    ];
    add(buttons);
    this.list = new ButtonList(this, buttons, () => this.resume());
    this.list.focusFirst();
    void panel;
  }

  /** Changer de difficulté en cours de partie : confirmation, puis le niveau recommence. */
  private confirmDifficulty(): void {
    const next = Save.difficulty === 'easy' ? 'expert' : 'easy';
    this.close();
    this.paused = true;
    const { add } = this.panel('Difficulté', 400);
    const T = TUNING[next];
    const lines = next === 'expert'
      ? 'Pièges plus rapides et plus malins.\nAucun point de contrôle.'
      : 'Pièges lisibles, un point de contrôle.\nMorts illimitées.';
    const body = this.add.text(0, -60, `Passer en ${T.label} ?\n${lines}\n\nLe niveau va recommencer.`, {
      fontFamily: FONTS.ui, fontSize: '18px', color: '#e6f1ec', align: 'center', lineSpacing: 5
    }).setOrigin(0.5);
    const buttons = [
      new Button(this, 0, 74, `Passer en ${T.label}`, () => {
        Save.setDifficulty(next);
        this.close();
        Bus.emit(EV.restart);
      }, { primary: true, width: 280 }),
      new Button(this, 0, 136, 'Annuler', () => { this.close(); this.showPause(); }, { width: 280 })
    ];
    add([body, ...buttons]);
    this.list = new ButtonList(this, buttons, () => { this.close(); this.showPause(); });
    this.list.focusFirst();
  }

  private resume(): void {
    this.close();
    Bus.emit(EV.resume);
  }

  // ------------------------------------------------------------ victoire

  private showVictory(v: VictoryStats): void {
    this.close();
    const meta = levelMeta(v.levelId);
    if (meta && meta.chapter === 0) { this.showBonusVictory(v); return; }
    const next = nextLevel(v.levelId);
    const { add } = this.panel('Serre traversée !', 440, meta?.name);

    const row = (y: number, icon: string, label: string, value: string, highlight = false) => {
      const i = this.add.image(-150, y, icon).setScale(0.62);
      const l = this.add.text(-124, y, label, { fontFamily: FONTS.ui, fontSize: '20px', color: '#cfe3dc' }).setOrigin(0, 0.5);
      const val = this.add.text(160, y, value, {
        fontFamily: FONTS.ui, fontSize: '22px', fontStyle: '600', color: highlight ? '#f7d774' : '#fff8e6'
      }).setOrigin(1, 0.5);
      add([i, l, val]);
    };
    row(-62, 'icon-wilt', 'Morts', String(v.deaths));
    row(-22, 'icon-clock', 'Temps', formatTime(v.timeMs), v.newRecord);
    if (v.newRecord) {
      const badge = this.add.text(0, 14, 'Nouveau record', { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '600', color: '#1c2b4f', backgroundColor: '#f7d774', padding: { x: 10, y: 3 } }).setOrigin(0.5);
      add([badge]);
      this.tweens.add({ targets: badge, scale: { from: 0.6, to: 1 }, duration: 400, ease: 'Back.easeOut' });
    } else if (v.bestTimeMs !== null) {
      add([this.add.text(0, 14, `Record : ${formatTime(v.bestTimeMs)}`, { fontFamily: FONTS.ui, fontSize: '16px', color: '#9fc3b8' }).setOrigin(0.5)]);
    }

    const hasNext = !!next?.data;
    const buttons = [
      new Button(this, 0, 78, hasNext ? 'Niveau suivant' : `${next?.id ?? ''} arrive bientôt`, () => { this.close(); Bus.emit(EV.nextLevel); }, { primary: hasNext, disabled: !hasNext, width: 280 }),
      new Button(this, -72, 142, 'Rejouer', () => { this.close(); Bus.emit(EV.restart); }, { width: 136 }),
      new Button(this, 72, 142, 'Menu', () => { this.close(); Bus.emit(EV.quit); }, { width: 136 })
    ];
    add(buttons);
    this.list = new ButtonList(this, buttons);
    this.list.focusFirst();
  }

  /** Victoire du niveau bonus : écran Halloween (chauves-souris, citrouilles, récompense). */
  private showBonusVictory(v: VictoryStats): void {
    const meta = levelMeta(v.levelId);
    const { add, panel } = this.panel('Manoir traversé !', 480, meta?.name);
    const row = (y: number, icon: string, label: string, value: string, highlight = false) => {
      const i = this.add.image(-150, y, icon).setScale(0.62);
      const l = this.add.text(-124, y, label, { fontFamily: FONTS.ui, fontSize: '20px', color: '#cfe3dc' }).setOrigin(0, 0.5);
      const val = this.add.text(160, y, value, { fontFamily: FONTS.ui, fontSize: '22px', fontStyle: '600', color: highlight ? '#f7d774' : '#fff8e6' }).setOrigin(1, 0.5);
      add([i, l, val]);
    };
    row(-86, 'icon-wilt', 'Morts', String(v.deaths));
    row(-48, 'icon-clock', 'Temps', formatTime(v.timeMs), v.newRecord);
    if (v.newRecord) {
      const badge = this.add.text(0, -14, 'Nouveau record', { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '600', color: '#1c2b4f', backgroundColor: '#f7d774', padding: { x: 10, y: 3 } }).setOrigin(0.5);
      add([badge]);
    }
    // récompense cosmétique (conservée dans la sauvegarde pour la future personnalisation)
    const hat = this.add.image(-120, 26, ensureCanvas(this, 'mn-hat-32', () => paintWitchHat(18))).setScale(1.3);
    const rw = this.add.text(-92, 28, 'Chapeau de sorcière débloqué', { fontFamily: FONTS.ui, fontSize: '17px', fontStyle: '600', color: '#f7b08a' }).setOrigin(0, 0.5);
    const candy = this.add.text(0, 60, Save.flag('h1-candy') ? 'Bonbon secret : trouvé ✓' : 'Bonbon secret : une porte le cache…', { fontFamily: FONTS.ui, fontSize: '15px', color: '#cfc3e8' }).setOrigin(0.5);
    add([rw, candy, hat]);
    this.tweens.add({ targets: hat, angle: { from: -10, to: 10 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const buttons = [
      new Button(this, 0, 118, 'Menu principal', () => { this.close(); Bus.emit(EV.quit); }, { primary: true, width: 280 }),
      new Button(this, 0, 180, 'Rejouer', () => { this.close(); Bus.emit(EV.restart); }, { width: 200 })
    ];
    add(buttons);
    this.list = new ButtonList(this, buttons);
    this.list.focusFirst();
    // animation exclusive : un vol de chauves-souris traverse l'écran, des citrouilles sautillent
    if (this.textures.exists('mn-bat')) {
      for (let i = 0; i < 9; i++) {
        const b = this.add.image(-60 - i * 70, 120 + (i % 3) * 60, 'mn-bat').setScale(0.9 + (i % 2) * 0.4);
        this.tweens.add({ targets: b, scaleY: b.scaleY * 0.35, duration: 100, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: b, x: GAME_W + 120, y: b.y - 60 + (i % 2) * 120, duration: 2600 + i * 140, delay: 200 + i * 90, ease: 'Sine.easeInOut', onComplete: () => b.destroy() });
      }
    }
    if (this.textures.exists('mn-pkb-26')) {
      for (const [x, d] of [[-250, 0], [250, 200]] as const) {
        const pk = this.add.image(x, 214, 'mn-pkb-26').setOrigin(0.5, 1);
        panel.add(pk);
        this.tweens.add({ targets: pk, y: 196, duration: 300, yoyo: true, repeat: -1, delay: d, ease: 'Quad.easeOut' });
      }
    }
  }

  // ------------------------------------------------------------ panneau générique

  private panel(title: string, height: number, subtitle?: string) {
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c1c1f, 0).setOrigin(0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.5, duration: 200 });
    const w = 420;
    const g = this.add.graphics();
    g.fillStyle(0x0d1a22, 0.35);
    g.fillRoundedRect(-w / 2 + 4, -height / 2 + 10, w, height, 26);
    g.fillStyle(0x173640, 0.96);
    g.fillRoundedRect(-w / 2, -height / 2, w, height, 26);
    g.lineStyle(2, 0x7fd1c7, 0.45);
    g.strokeRoundedRect(-w / 2, -height / 2, w, height, 26);
    const t = this.add.text(0, -height / 2 + 46, title, { fontFamily: FONTS.display, fontSize: '34px', color: '#fff1c9' }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [g, t];
    if (subtitle) items.push(this.add.text(0, -height / 2 + 82, subtitle, { fontFamily: FONTS.ui, fontSize: '18px', color: '#9fc3b8' }).setOrigin(0.5));
    const panel = this.add.container(GAME_W / 2, GAME_H / 2 + 30, items).setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, y: GAME_H / 2, duration: 280, ease: 'Back.easeOut' });
    this.overlay = this.add.container(0, 0, [dim, panel]);
    return { panel, add: (objs: Phaser.GameObjects.GameObject[]) => panel.add(objs) };
  }

  private close(): void {
    this.list?.destroy();
    this.list = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.paused = false;
  }

  // ------------------------------------------------------------ tactile

  private buildTouchControls(): void {
    const pref = Save.settings.touchControls;
    const isTouch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
    if (pref === 'off' || (pref === 'auto' && !isTouch)) return;
    this.input.addPointer(2);
    const mk = (x: number, y: number, icon: string, flip: boolean, key: keyof typeof touchState) => {
      const g = this.add.graphics();
      const draw = (on: boolean) => {
        g.clear();
        g.fillStyle(0x16302f, on ? 0.75 : 0.42);
        g.fillCircle(0, 0, 50);
        g.lineStyle(2, 0xfff1c9, on ? 0.8 : 0.35);
        g.strokeCircle(0, 0, 50);
      };
      draw(false);
      const img = this.add.image(0, 0, icon).setScale(0.7).setFlipX(flip);
      const c = this.add.container(x, y, [g, img]).setSize(110, 110).setInteractive();
      const set = (v: boolean) => { touchState[key] = v; draw(v); };
      c.on('pointerdown', () => { Audio.unlock(); set(true); });
      c.on('pointerup', () => set(false));
      c.on('pointerout', () => set(false));
    };
    mk(100, GAME_H - 100, 'icon-arrow', false, 'left');
    mk(230, GAME_H - 100, 'icon-arrow', true, 'right');
    mk(GAME_W - 110, GAME_H - 100, 'icon-jump', false, 'jump');
  }
}
