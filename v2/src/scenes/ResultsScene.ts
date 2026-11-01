// Écran de résultats : temps, morts, pièces, étoiles qui tombent une à une.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT } from '../core/config';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { Button, ButtonGroup } from '../ui/Button';
import { fadeIn, goTo } from '../ui/Transition';

interface Res { id: string; title: string; time: number; deaths: number; coins: number; total: number; stars: number }

export class ResultsScene extends Phaser.Scene {
  private group!: ButtonGroup;
  private ready = 0;
  constructor() { super('Results'); }
  create(r: Res): void {
    AudioManager.music('results');
    const bg = this.add.graphics(); bg.fillGradientStyle(0x2a2560, 0x2a2560, 0x1d1a39, 0x1d1a39, 1); bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const s = this.add.circle(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 0xffffff, 0.5); this.tweens.add({ targets: s, alpha: 0.1, duration: 800 + Math.random() * 1500, yoyo: true, repeat: -1 }); }
    this.add.text(W / 2, 62, 'NIVEAU TERMINÉ', { fontFamily: FONT.display, fontSize: '40px', color: CSS.sun, stroke: CSS.ink, strokeThickness: 10 }).setOrigin(0.5);
    this.add.text(W / 2, 104, `${r.id} · ${r.title}`, { fontFamily: FONT.body, fontSize: '18px', fontStyle: '800', color: CSS.paper }).setOrigin(0.5);
    // étoiles
    const labels = ['Fini', '3 morts max', 'Toutes les pièces'];
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 130, got = i < 1 ? true : i === 1 ? r.deaths <= 3 : r.coins === r.total;
      const st = this.add.text(x, 178, '★', { fontFamily: FONT.display, fontSize: '72px', color: got ? CSS.sun : '#4a4570', stroke: CSS.ink, strokeThickness: 8 }).setOrigin(0.5).setScale(got ? 0 : 1);
      this.add.text(x, 226, labels[i], { fontFamily: FONT.body, fontSize: '14px', fontStyle: '800', color: got ? CSS.paper : '#8a86a8' }).setOrigin(0.5);
      if (got) this.tweens.add({ targets: st, scale: 1, angle: { from: -40, to: 0 }, delay: 300 + i * 280, duration: 380, ease: 'Back.Out', onStart: () => AudioManager.play('coin') });
    }
    const t = Math.round(r.time * 10) / 10, m = Math.floor(t / 60), s = (t % 60).toFixed(1).padStart(4, '0');
    const rows = [['Temps', `${m}:${s}`], ['Morts', String(r.deaths)], ['Pièces', `${r.coins} / ${r.total}`]];
    const panel = this.add.graphics(); panel.fillStyle(COL.ink2, 0.8); panel.fillRoundedRect(W / 2 - 200, 254, 400, 112, 16);
    rows.forEach(([k, v], i) => {
      this.add.text(W / 2 - 170, 276 + i * 32, k, { fontFamily: FONT.body, fontSize: '20px', fontStyle: '800', color: CSS.paper });
      this.add.text(W / 2 + 170, 276 + i * 32, v, { fontFamily: FONT.display, fontSize: '20px', color: CSS.sun }).setOrigin(1, 0);
    });
    const items = [
      new Button(this, W / 2 - 230, 430, 'Rejouer', () => goTo(this, 'Game'), { w: 200 }),
      new Button(this, W / 2, 430, 'Menu', () => goTo(this, 'Menu'), { w: 200, primary: true }),
      new Button(this, W / 2 + 230, 430, 'Niveau 1-2', () => {}, { w: 200, disabled: true, note: 'en construction' }),
    ];
    this.group = new ButtonGroup(items, 1);
    this.add.text(W / 2, 500, 'Espace, Entrée ou Ⓐ pour continuer', { fontFamily: FONT.body, fontSize: '14px', fontStyle: '800', color: CSS.paper }).setOrigin(0.5).setAlpha(0.7);
    this.ready = this.time.now + 600;   // évite de valider avec la touche de saut encore enfoncée
    InputManager.swallow();
    fadeIn(this);
  }
  update(): void {
    const nav = InputManager.nav(); if (nav) this.group.move(nav.x, nav.y);
    if (this.time.now > this.ready && InputManager.pressed('confirm')) this.group.press();
  }
}
