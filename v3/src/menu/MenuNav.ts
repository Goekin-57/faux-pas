import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';
import { Audio } from '../core/Audio';
import { PadReader, PAD } from '../core/Pad';

/**
 * Menu principal "léger" : des mots posés dans le décor plutôt que de gros boutons.
 * Un seul curseur (capsule de verre dépoli) glisse d'une entrée à l'autre.
 * Souris, tactile, clavier (↑ ↓ / Z S, Entrée, Espace) et manette (croix, stick, A).
 */
export interface NavEntry {
  label: string;
  primary?: boolean;
  action: () => void;
}

interface Item {
  root: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  leaf: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Zone;
  entry: NavEntry;
  baseX: number;
}

const ITEM_H = 48;
const NAVY = '#24306a';
const NAVY_FOCUS = '#18214f';
const ORANGE = '#c9541b';

export class MenuNav {
  private items: Item[] = [];
  private cursor: Phaser.GameObjects.Graphics;
  private cur = { y: 0, w: 0, a: 0 };
  private index = 0;
  private enabled = false;
  private pad = new PadReader();
  private keys: Phaser.Input.Keyboard.Key[] = [];
  onFocus?: (i: number) => void;

  constructor(private scene: Phaser.Scene, private x: number, private y0: number, private gap: number, entries: NavEntry[]) {
    this.cursor = scene.add.graphics().setDepth(DEPTH.vignette + 4);
    entries.forEach((entry, i) => {
      const y = y0 + i * gap;
      const text = scene.add.text(0, 0, entry.label, {
        fontFamily: FONTS.ui, fontSize: entry.primary ? '31px' : '26px', fontStyle: '600',
        color: entry.primary ? ORANGE : NAVY
      }).setOrigin(0, 0.5).setShadow(0, 1, 'rgba(255,251,238,0.95)', 10, false, true);
      const leaf = scene.add.graphics();
      this.paintLeaf(leaf, entry.primary ? 0xf28c38 : 0x5e9a70);
      leaf.setPosition(-20, 1).setScale(0);
      const root = scene.add.container(x, y, [leaf, text]).setDepth(DEPTH.vignette + 5);
      const hit = scene.add.zone(x - 34, y, text.width + 110, ITEM_H).setOrigin(0, 0.5).setDepth(DEPTH.vignette + 6)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { if (this.enabled) this.focus(i, true); });
      hit.on('pointerdown', () => { if (this.enabled) { this.focus(i, false); this.activate(); } });
      this.items.push({ root, text, leaf, hit, entry, baseX: x });
    });
    this.cur.y = y0;
    this.cur.w = this.items[0].text.width + 66;

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.poll, this);
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const bind = (codes: number[], fn: () => void) => codes.forEach((c) => {
        const k = kb.addKey(c, false);
        k.on('down', () => { if (this.enabled) fn(); });
        this.keys.push(k);
      });
      bind([K.UP, K.Z, K.W], () => this.move(-1));
      bind([K.DOWN, K.S], () => this.move(1));
      bind([K.ENTER, K.SPACE], () => this.activate());
    }
  }

  get rows(): Phaser.GameObjects.Container[] { return this.items.map((i) => i.root); }

  private paintLeaf(g: Phaser.GameObjects.Graphics, col: number): void {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new Phaser.Math.Vector2(-8 + t * 16, -Math.sin(t * Math.PI) * 6)); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; pts.push(new Phaser.Math.Vector2(-8 + t * 16, Math.sin(t * Math.PI) * 5)); }
    g.fillStyle(col, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1.5, 0xffffff, 0.6);
    g.lineBetween(-6, 0, 6, 0);
    g.setRotation(-0.5);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.pad.swallow();
    this.items.forEach((it) => (on ? it.hit.setInteractive() : it.hit.disableInteractive()));
    this.scene.tweens.add({ targets: this.cur, a: on ? 1 : 0, duration: 200, onUpdate: () => this.drawCursor() });
  }

  /** Focus initial sans son. */
  focusFirst(): void {
    this.focus(0, false, true);
  }

  private focus(i: number, sound: boolean, instant = false): void {
    const changed = i !== this.index;
    this.index = i;
    this.items.forEach((it, k) => {
      const on = k === i;
      this.scene.tweens.add({ targets: it.root, x: it.baseX + (on ? 10 : 0), alpha: on ? 1 : 0.8, duration: instant ? 0 : 200, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: it.leaf, scale: on ? 1 : 0, angle: on ? -28 : -60, duration: instant ? 0 : 260, ease: 'Back.easeOut' });
      if (!it.entry.primary) it.text.setColor(on ? NAVY_FOCUS : NAVY);
    });
    const it = this.items[i];
    this.scene.tweens.add({
      targets: this.cur, y: this.y0 + i * this.gap, w: it.text.width + 66,
      duration: instant ? 0 : 240, ease: 'Cubic.easeOut', onUpdate: () => this.drawCursor()
    });
    this.drawCursor();
    if (changed && sound) Audio.sfx('uiHover');
    if (changed) this.onFocus?.(i);
  }

  private drawCursor(): void {
    const g = this.cursor;
    g.clear();
    if (this.cur.a <= 0.01) return;
    const x = this.x - 36, y = this.cur.y - ITEM_H / 2, w = this.cur.w, h = ITEM_H;
    g.fillStyle(0x1b3a35, 0.08 * this.cur.a);
    g.fillRoundedRect(x + 2, y + 5, w, h, h / 2);
    g.fillStyle(0xfffbf0, 0.7 * this.cur.a);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(1.5, 0xffffff, 0.9 * this.cur.a);
    g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, h / 2 - 1);
    g.fillStyle(0xffffff, 0.45 * this.cur.a);
    g.fillRoundedRect(x + 14, y + 5, w - 28, 6, 3);
  }

  private move(d: number): void {
    const n = this.items.length;
    this.focus((this.index + d + n) % n, true);
  }

  private activate(): void {
    const it = this.items[this.index];
    Audio.unlock();
    Audio.sfx('uiClick');
    this.scene.tweens.add({ targets: it.root, scale: 0.94, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    it.entry.action();
  }

  private poll(_t: number, delta: number): void {
    this.pad.poll(delta / 1000);
    if (!this.enabled || !this.pad.state.connected) return;
    const n = this.pad.nav();
    if (n.y !== 0) this.move(n.y);
    if (this.pad.pressed(PAD.A) || this.pad.pressed(PAD.START)) this.activate();
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.poll, this);
    this.keys.forEach((k) => k.removeAllListeners());
  }
}
