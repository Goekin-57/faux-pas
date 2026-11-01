import Phaser from 'phaser';
import { FONTS } from '../core/constants';
import { Audio } from '../core/Audio';
import { PadReader, PAD } from '../core/Pad';

export interface ButtonOpts {
  width?: number;
  height?: number;
  primary?: boolean;
  disabled?: boolean;
  fontSize?: number;
}

/** Bouton en pilule, proportionné, avec survol, focus clavier et retour sonore. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private focused = false;
  readonly disabled: boolean;
  private primary: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    this.bw = opts.width ?? 240;
    this.bh = opts.height ?? 52;
    this.primary = !!opts.primary;
    this.disabled = !!opts.disabled;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 1, text, {
        fontFamily: FONTS.ui,
        fontSize: `${opts.fontSize ?? 22}px`,
        fontStyle: '600',
        color: this.primary ? '#1c2b4f' : '#fff6e0'
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.draw();
    scene.add.existing(this);

    if (!this.disabled) {
      this.setInteractive({ useHandCursor: true });
      this.on('pointerover', () => this.setFocus(true, true));
      this.on('pointerout', () => this.setFocus(false));
      this.on('pointerdown', () => {
        scene.tweens.add({ targets: this, scale: 0.95, duration: 60, yoyo: true });
      });
      this.on('pointerup', () => this.activate());
    }
  }

  activate(): void {
    if (this.disabled) return;
    Audio.unlock();
    Audio.sfx('uiClick');
    this.onClick();
  }

  setFocus(f: boolean, sound = false): void {
    if (this.disabled || this.focused === f) return;
    this.focused = f;
    if (f && sound) Audio.sfx('uiHover');
    this.scene.tweens.add({ targets: this, scale: f ? 1.05 : 1, duration: 120, ease: 'Quad.easeOut' });
    this.draw();
  }

  setText(t: string): void {
    this.label.setText(t);
  }

  private draw(): void {
    const g = this.bg;
    const w = this.bw, h = this.bh;
    g.clear();
    // ombre douce
    g.fillStyle(0x0d1a22, 0.25);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, h / 2);
    if (this.disabled) {
      g.fillStyle(0x3b4a52, 0.55);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      this.label.setAlpha(0.5);
      return;
    }
    if (this.primary) {
      g.fillStyle(this.focused ? 0xffe28a : 0xf7d774, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(-w / 2 + 10, -h / 2 + 5, w - 20, h * 0.3, h * 0.15);
    } else {
      g.fillStyle(this.focused ? 0x2e4f5c : 0x1f3a46, 0.92);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.lineStyle(2, this.focused ? 0x7fd1c7 : 0x5f8f8c, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
  }
}

/**
 * Navigation clavier ET manette dans une liste de boutons.
 * Clavier : flèches / Z S, Entrée ou Espace. Manette : croix ou stick, A pour valider, B pour revenir.
 */
export class ButtonList {
  private index = 0;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private pad = new PadReader();
  private alive = true;

  constructor(private scene: Phaser.Scene, private buttons: Button[], private onBack?: () => void) {
    const first = this.buttons.findIndex((b) => !b.disabled);
    this.index = Math.max(0, first);
    this.pad.swallow();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.pollPad, this);

    const kb = scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const up = [K.UP, K.Z, K.W, K.LEFT].map((k) => kb.addKey(k, false));
    const down = [K.DOWN, K.S, K.RIGHT].map((k) => kb.addKey(k, false));
    const ok = [K.ENTER, K.SPACE].map((k) => kb.addKey(k, false));
    this.keys = [...up, ...down, ...ok];
    up.forEach((k) => k.on('down', () => this.move(-1)));
    down.forEach((k) => k.on('down', () => this.move(1)));
    ok.forEach((k) => k.on('down', () => this.current()?.activate()));
  }

  private pollPad(_t: number, delta: number): void {
    if (!this.alive) return;
    this.pad.poll(delta / 1000);
    if (!this.pad.state.connected) return;
    const n = this.pad.nav();
    const d = n.y !== 0 ? n.y : n.x;
    if (d !== 0) this.move(d);
    if (this.pad.pressed(PAD.A)) this.current()?.activate();
    else if (this.pad.pressed(PAD.B) && this.onBack) {
      Audio.sfx('uiClick');
      this.onBack();
    }
  }

  private current(): Button | undefined {
    return this.buttons[this.index];
  }

  focusFirst(): void {
    this.buttons.forEach((b, i) => b.setFocus(i === this.index));
  }

  private move(d: number): void {
    if (!this.buttons.length) return;
    let i = this.index;
    for (let n = 0; n < this.buttons.length; n++) {
      i = (i + d + this.buttons.length) % this.buttons.length;
      if (!this.buttons[i].disabled) break;
    }
    this.index = i;
    this.buttons.forEach((b, k) => b.setFocus(k === i, k === i));
  }

  destroy(): void {
    this.alive = false;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.pollPad, this);
    this.keys.forEach((k) => k.removeAllListeners());
    this.keys = [];
  }
}
