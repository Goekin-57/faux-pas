// Indications du jeu : un seul message à la fois, toujours lisible.
// - « cue » : bulle courte posée près de l'élément concerné (dans le monde), jamais sur le personnage.
// - « mascot » : le soleil moqueur parle, bulle en haut à droite.
// Fond opaque, texte sombre sur fond clair (contraste ~15:1), 24 px (28 px en « Lisibilité renforcée »).
import Phaser from 'phaser';
import { W, H, COL, FONT } from '../core/config';
import { SaveManager } from '../save/SaveManager';

export interface SayOpts { at?: { x: number; y: number }; who?: 'cue' | 'mascot'; prio?: number; dur?: number }
interface Msg { text: string; o: SayOpts }

export const readable = (): boolean => !!SaveManager.data.settings.readable;

// Style de texte partagé (panneaux, bulles) : police sans empattement très grasse, sombre sur clair.
export function textStyle(size = 24, wrap = 420): Phaser.Types.GameObjects.Text.TextStyle {
  const big = readable();
  return { fontFamily: FONT.body, fontStyle: '900', fontSize: `${big ? Math.round(size * 1.18) : size}px`, color: big ? '#000000' : '#1d1a39', align: 'center', wordWrap: { width: big ? wrap * 1.12 : wrap }, maxLines: 2, padding: { top: 2, bottom: 2 } };
}

export class Hints {
  private ct: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private cur: Msg | null = null;
  private queue: Msg | null = null;
  private t = 0;
  private bw = 0;
  private bh = 0;

  constructor(private scene: Phaser.Scene, private playerScreen: () => { x: number; y: number } | null) {
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', textStyle()).setOrigin(0.5);
    this.ct = scene.add.container(0, 0, [this.bg, this.label]).setScrollFactor(0).setDepth(115).setVisible(false);
  }

  get text(): string { return this.cur?.text ?? ''; }

  say(text: string, o: SayOpts = {}): void {
    const m = { text, o: { who: o.at ? 'cue' : 'mascot', prio: 1, ...o } as SayOpts };
    if (this.cur && this.cur.text === text) { this.t = Math.max(this.t, this.dur(m)); if (m.o.at) this.cur.o.at = m.o.at; return; }
    if (this.cur && (m.o.prio ?? 1) < (this.cur.o.prio ?? 1)) { this.queue = m; return; }
    this.show(m);
  }

  private dur(m: Msg): number { const d = m.o.dur ?? 1.6 + m.text.length * 0.045; return readable() ? d * 1.5 : d; }

  private show(m: Msg): void {
    this.cur = m; this.t = this.dur(m);
    const big = readable(), mascot = m.o.who === 'mascot';
    this.label.setStyle(textStyle(mascot ? 22 : 24, mascot ? 400 : 300)).setText(m.text);
    const padX = 16, padY = 10;
    this.bw = Math.ceil(this.label.width + padX * 2); this.bh = Math.ceil(this.label.height + padY * 2);
    const g = this.bg; g.clear();
    g.fillStyle(COL.ink, 1); g.fillRoundedRect(-this.bw / 2 + 3, -this.bh / 2 + 4, this.bw, this.bh, 14);   // ombre
    g.fillStyle(big ? 0xffffff : COL.paper, 1); g.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 14);
    g.lineStyle(big ? 4 : 3, COL.ink, 1); g.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 14);
    // petite pointe vers l'élément (en bas pour les indications, à droite pour le soleil)
    g.fillStyle(big ? 0xffffff : COL.paper, 1);
    if (mascot) { g.fillTriangle(this.bw / 2 - 2, -8, this.bw / 2 - 2, 8, this.bw / 2 + 14, -2); g.lineStyle(big ? 4 : 3, COL.ink, 1); g.lineBetween(this.bw / 2, -8, this.bw / 2 + 14, -2); g.lineBetween(this.bw / 2 + 14, -2, this.bw / 2, 8); }
    else { g.fillTriangle(-9, this.bh / 2 - 2, 9, this.bh / 2 - 2, 0, this.bh / 2 + 12); g.lineStyle(big ? 4 : 3, COL.ink, 1); g.lineBetween(-9, this.bh / 2, 0, this.bh / 2 + 12); g.lineBetween(0, this.bh / 2 + 12, 9, this.bh / 2); }
    this.ct.setVisible(true).setAlpha(1).setScale(0.8);
    this.place();
    this.scene.tweens.add({ targets: this.ct, scale: 1, duration: 150, ease: 'Back.Out' });
  }

  private place(): void {
    if (!this.cur) return;
    const m = this.cur, cam = this.scene.cameras.main, M = 12;
    let x: number, y: number;
    if (m.o.who === 'mascot' || !m.o.at) { x = W - 170 - this.bw / 2; y = 80; }
    else {
      x = m.o.at.x - cam.scrollX; y = m.o.at.y - cam.scrollY - this.bh / 2 - 14;
      // ne jamais cacher le personnage : si la bulle le recouvre, on la remonte au-dessus de lui
      const p = this.playerScreen();
      if (p && Math.abs(p.x - x) < this.bw / 2 + 16 && y + this.bh / 2 > p.y - 46 && y - this.bh / 2 < p.y + 6) y = p.y - 52 - this.bh / 2;
    }
    x = Phaser.Math.Clamp(x, this.bw / 2 + M, W - this.bw / 2 - M);
    y = Phaser.Math.Clamp(y, this.bh / 2 + 54, H - this.bh / 2 - M);   // sous la barre du haut (morts, pièces)
    this.ct.setPosition(Math.round(x), Math.round(y));
  }

  clear(): void { this.cur = null; this.queue = null; this.ct.setVisible(false); }

  update(dt: number): void {
    if (!this.cur) return;
    this.t -= dt; this.place();
    if (this.t < 0.25) this.ct.setAlpha(Math.max(0, this.t / 0.25));
    if (this.t <= 0) {
      this.cur = null; this.ct.setVisible(false);
      if (this.queue) { const q = this.queue; this.queue = null; this.show(q); }
    }
  }
}
