// Bouton de menu : survol, sélection au clavier/manette, état désactivé, petit son.
import Phaser from 'phaser';
import { CSS, COL, FONT } from '../core/config';
import { AudioManager } from '../audio/AudioManager';

export interface ButtonOpts { w?: number; h?: number; size?: number; primary?: boolean; disabled?: boolean; note?: string; icon?: string }

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private noteT: Phaser.GameObjects.Text | null = null;
  readonly w: number;
  readonly h: number;
  focused = false;
  disabled: boolean;
  primary: boolean;
  onPress: () => void;
  private pulse = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onPress: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.w = o.w ?? 260; this.h = o.h ?? 52; this.primary = !!o.primary; this.disabled = !!o.disabled; this.onPress = onPress;
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, o.note ? -6 : -1, (o.icon ? o.icon + '  ' : '') + text, { fontFamily: FONT.display, fontSize: `${o.size ?? 22}px`, color: CSS.ink }).setOrigin(0.5);
    this.add([this.bg, this.label]);
    if (o.note) { this.noteT = scene.add.text(0, 14, o.note, { fontFamily: FONT.body, fontSize: '13px', fontStyle: '800', color: CSS.ink }).setOrigin(0.5).setAlpha(0.75); this.add(this.noteT); }
    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.emit('hoverfocus', this));
    this.on('pointerdown', () => { AudioManager.unlock(); this.press(); });
    this.redraw();
    scene.add.existing(this);
  }

  setFocus(f: boolean): void {
    if (this.focused === f) return;
    this.focused = f;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scale: f ? 1.06 : 1, duration: 140, ease: 'Back.Out' });
    if (f && !this.disabled) AudioManager.play('move');
    this.redraw();
  }
  press(): void {
    if (this.disabled) { AudioManager.play('fake'); this.scene.tweens.add({ targets: this, x: this.x + 6, duration: 50, yoyo: true, repeat: 2 }); return; }
    AudioManager.play('click');
    this.scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true, onComplete: () => this.onPress() });
  }
  private redraw(): void {
    const g = this.bg, w = this.w, h = this.h, r = 14;
    g.clear();
    const fill = this.disabled ? 0x8a86a8 : this.primary ? COL.pink : COL.sun;
    g.fillStyle(COL.ink, 1); g.fillRoundedRect(-w / 2 + 5, -h / 2 + 6, w, h, r);                // ombre décalée
    g.fillStyle(fill, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(0xffffff, this.disabled ? 0.1 : 0.28); g.fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.36, { tl: r - 4, tr: r - 4, bl: 6, br: 6 });
    g.lineStyle(4, COL.ink, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    if (this.focused) { g.lineStyle(4, this.disabled ? 0xcbb8ff : 0xffffff, 1); g.strokeRoundedRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14, r + 6); }
    this.label.setColor(this.disabled ? '#3d3778' : CSS.ink);
  }
  preUpdate(_t: number, dt: number): void {
    if (!this.focused || this.disabled) return;
    this.pulse += dt / 1000;
    this.label.setScale(1 + Math.sin(this.pulse * 6) * 0.02);
  }
}

// Navigation entre boutons par direction (clavier / manette), en choisissant le plus proche dans la direction voulue.
export class ButtonGroup {
  items: Button[] = [];
  index = 0;
  constructor(items: Button[], start = 0) {
    this.items = items; this.index = start;
    items.forEach((b, i) => b.on('hoverfocus', () => this.focus(i)));
    this.focus(start);
  }
  focus(i: number): void { this.index = i; this.items.forEach((b, k) => b.setFocus(k === i)); }
  move(dx: number, dy: number): void {
    const cur = this.items[this.index]; let best = -1, bd = Infinity;
    const p = cur.getWorldTransformMatrix();
    this.items.forEach((b, i) => {
      if (i === this.index || !b.visible) return;
      const q = b.getWorldTransformMatrix(), vx = q.tx - p.tx, vy = q.ty - p.ty, along = vx * dx + vy * dy;
      if (along <= 4) return;
      const d = along + (Math.abs(vx * dy) + Math.abs(vy * dx)) * 2.2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) this.focus(best);
  }
  press(): void { this.items[this.index]?.press(); }
}
