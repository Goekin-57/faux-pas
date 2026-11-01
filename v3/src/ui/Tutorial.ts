import Phaser from 'phaser';
import { FONTS, GAME_W, GAME_H } from '../core/constants';
import { InputInfo, type Device } from '../core/Controls';
import { Audio } from '../core/Audio';

/**
 * Tutoriel des commandes : une barre de verre discrète en bas de l'écran.
 * - icônes du périphérique réellement utilisé (clavier, manette, tactile), mises à jour en direct ;
 * - chaque commande se coche quand le joueur l'a essayée ;
 * - la barre s'efface d'elle-même une fois le déplacement et le saut essayés.
 */
type Row = 'move' | 'jump' | 'interact';

const NAVY = '#24306a';
const CREAM = 0xfff8ea;

export class Tutorial {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private content: Phaser.GameObjects.Container | null = null;
  private device: Device | null = null;
  private keys = '';
  private done: Record<Row, boolean> = { move: false, jump: false, interact: false };
  private checks: Partial<Record<Row, Phaser.GameObjects.Container>> = {};
  private finished = false;
  private closing = false;

  constructor(private scene: Phaser.Scene, private onDone: () => void) {
    InputInfo.reset();
    this.bg = scene.add.graphics();
    this.root = scene.add.container(GAME_W / 2, GAME_H - 58, [this.bg]).setAlpha(0).setDepth(50);
    scene.tweens.add({ targets: this.root, alpha: 1, y: GAME_H - 66, duration: 600, delay: 900, ease: 'Cubic.easeOut' });
    this.rebuild();
  }

  update(): void {
    if (this.finished) return;
    if (InputInfo.device !== this.device || (InputInfo.device === 'keyboard' && InputInfo.keys !== this.keys)) this.rebuild();
    this.mark('move', InputInfo.moved);
    this.mark('jump', InputInfo.jumped);
    if (this.done.move && this.done.jump && !this.closing) {
      this.closing = true;
      this.scene.time.delayedCall(1500, () => this.close());
    }
  }

  private close(): void {
    this.finished = true;
    this.onDone();
    this.scene.tweens.add({
      targets: this.root, alpha: 0, y: this.root.y + 14, duration: 700, ease: 'Cubic.easeIn',
      onComplete: () => this.root.destroy()
    });
  }

  private mark(row: Row, used: boolean): void {
    if (!used || this.done[row]) return;
    this.done[row] = true;
    Audio.sfx('uiHover');
    const c = this.checks[row];
    if (c) {
      this.scene.tweens.add({ targets: c, alpha: 0.5, duration: 300 });
      const tick = c.getByName('tick') as Phaser.GameObjects.Graphics | null;
      if (tick) this.scene.tweens.add({ targets: tick, scale: { from: 0, to: 1 }, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    }
  }

  // ------------------------------------------------------------ construction

  private rebuild(): void {
    this.device = InputInfo.device;
    this.keys = InputInfo.keys;
    this.content?.destroy();
    this.checks = {};
    const s = this.scene;
    // (en tactile, pas de touche d'interaction à l'écran : on ne crée pas la ligne du tout)
    const rows: { id: Row; glyphs: Phaser.GameObjects.Container; label: string; dim?: boolean }[] = [
      { id: 'move', glyphs: this.moveGlyphs(), label: 'Se déplacer' },
      { id: 'jump', glyphs: this.jumpGlyphs(), label: 'Sauter (maintenir = plus haut)' },
      ...(this.device === 'touch' ? [] : [{ id: 'interact' as Row, glyphs: this.interactGlyphs(), label: 'Interagir', dim: true }])
    ];
    const parts: Phaser.GameObjects.Container[] = [];
    let x = 0;
    const gap = 34;
    for (const r of rows) {
      const label = s.add.text(r.glyphs.width + 10, 0, r.label, {
        fontFamily: FONTS.ui, fontSize: '17px', fontStyle: '600', color: '#fff8ea'
      }).setOrigin(0, 0.5);
      const tick = this.drawTick(label.x + label.width + 14, 0);
      const cell = s.add.container(x, 0, [r.glyphs, label, tick]).setAlpha(r.dim ? 0.55 : 1);
      cell.width = label.x + label.width + (this.done[r.id] ? 26 : 0);
      if (this.done[r.id]) { cell.setAlpha(0.5); tick.setScale(1).setAlpha(1); }
      this.checks[r.id] = cell;
      parts.push(cell);
      x += label.x + label.width + gap;
    }
    const total = x - gap;
    parts.forEach((p) => (p.x -= total / 2));
    this.content = s.add.container(0, 0, parts);
    this.root.add(this.content);

    const w = total + 56, h = 54;
    const g = this.bg;
    g.clear();
    g.fillStyle(0x0f2a2a, 0.18);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, h / 2);
    g.fillStyle(0x16302f, 0.68);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(1.5, 0xfff1c9, 0.22);
    g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, h / 2 - 1);
  }

  private drawTick(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics({ x, y }).setName('tick').setScale(0).setAlpha(0);
    g.fillStyle(0x7fd1a0, 1);
    g.fillCircle(0, 0, 9);
    g.lineStyle(2.5, 0x16302f, 1);
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(-1, 3.5); g.lineTo(4.5, -3.5);
    g.strokePath();
    return g;
  }

  // ------------------------------------------------------------ icônes

  private keycap(x: number, label: string, w = 30): Phaser.GameObjects.Container {
    const s = this.scene;
    const g = s.add.graphics();
    g.fillStyle(0x0b1a1a, 0.35);
    g.fillRoundedRect(-w / 2, -13, w, 30, 7);
    g.fillStyle(CREAM, 1);
    g.fillRoundedRect(-w / 2, -16, w, 29, 7);
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(-w / 2 + 4, -13, w - 8, 5, 3);
    const t = s.add.text(0, -2, label, { fontFamily: FONTS.ui, fontSize: label.length > 2 ? '13px' : '16px', fontStyle: '600', color: NAVY }).setOrigin(0.5);
    return s.add.container(x + w / 2, 0, [g, t]);
  }

  private padButton(x: number, letter: string, color: number): Phaser.GameObjects.Container {
    const s = this.scene;
    const g = s.add.graphics();
    g.fillStyle(0x0b1a1a, 0.35);
    g.fillCircle(0, 2, 14);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, 14);
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(-3, -6, 14, 6);
    const t = s.add.text(0, 0, letter, { fontFamily: FONTS.ui, fontSize: '15px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
    return s.add.container(x + 14, 0, [g, t]);
  }

  private stick(x: number): Phaser.GameObjects.Container {
    const s = this.scene;
    const g = s.add.graphics();
    g.fillStyle(0x0b1a1a, 0.35);
    g.fillCircle(0, 2, 15);
    g.fillStyle(0x3a4b52, 1);
    g.fillCircle(0, 0, 15);
    g.fillStyle(0x6b7f87, 1);
    g.fillCircle(0, 0, 9);
    g.fillStyle(CREAM, 1);
    g.fillTriangle(-21, 0, -16, -4, -16, 4);
    g.fillTriangle(21, 0, 16, -4, 16, 4);
    return s.add.container(x + 21, 0, [g]);
  }

  private touchIcon(x: number, key: string, flip = false): Phaser.GameObjects.Container {
    const s = this.scene;
    const g = s.add.graphics();
    g.fillStyle(0x16302f, 0.9);
    g.fillCircle(0, 0, 15);
    g.lineStyle(1.5, 0xfff1c9, 0.6);
    g.strokeCircle(0, 0, 15);
    const img = s.add.image(0, 0, key).setScale(0.24).setFlipX(flip);
    return s.add.container(x + 15, 0, [g, img]);
  }

  private group(items: Phaser.GameObjects.Container[], width: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0, items);
    c.width = width;
    return c;
  }

  private moveGlyphs(): Phaser.GameObjects.Container {
    const s = this.scene;
    switch (this.device) {
      case 'gamepad':
        return this.group([this.stick(0)], 42);
      case 'touch':
        return this.group([this.touchIcon(0, 'icon-arrow'), this.touchIcon(36, 'icon-arrow', true)], 66);
      default: {
        if (InputInfo.keys === 'qd') return this.group([this.keycap(0, 'Q'), this.keycap(34, 'D')], 64);
        if (InputInfo.keys === 'ad') return this.group([this.keycap(0, 'A'), this.keycap(34, 'D')], 64);
        // avant toute frappe : flèches ET lettres (AZERTY)
        const or = s.add.text(76, 0, 'ou', { fontFamily: FONTS.ui, fontSize: '14px', color: '#cfe3dc' }).setOrigin(0.5);
        return this.group([this.keycap(0, '←'), this.keycap(34, '→'), s.add.container(0, 0, [or]), this.keycap(96, 'Q'), this.keycap(130, 'D')], 160);
      }
    }
  }

  private jumpGlyphs(): Phaser.GameObjects.Container {
    switch (this.device) {
      case 'gamepad': return this.group([this.padButton(0, 'A', 0x4c9a5c)], 28);
      case 'touch': return this.group([this.touchIcon(0, 'icon-jump')], 30);
      default: return this.group([this.keycap(0, 'Espace', 64)], 64);
    }
  }

  private interactGlyphs(): Phaser.GameObjects.Container {
    return this.device === 'gamepad'
      ? this.group([this.padButton(0, 'X', 0x3d7ec9)], 28)
      : this.group([this.keycap(0, 'E')], 30);
  }

  destroy(): void {
    if (this.root.active) this.root.destroy();
  }
}
