// Boutons tactiles (multitouch) : gauche / droite en bas à gauche, saut en bas à droite, pause en haut.
import Phaser from 'phaser';
import { W, H, COL } from '../core/config';
import { InputManager, type Action } from '../input/InputManager';

export class TouchControls {
  private parts: Phaser.GameObjects.GameObject[] = [];
  constructor(scene: Phaser.Scene) {
    scene.input.addPointer(3);
    const btn = (x: number, y: number, r: number, label: string, act: Action) => {
      const g = scene.add.graphics().setScrollFactor(0).setDepth(150);
      const draw = (on: boolean) => { g.clear(); g.fillStyle(COL.ink, on ? 0.55 : 0.32); g.fillCircle(x, y, r); g.lineStyle(3, 0xffffff, on ? 0.9 : 0.5); g.strokeCircle(x, y, r); };
      draw(false);
      const t = scene.add.text(x, y, label, { fontFamily: 'system-ui', fontSize: `${Math.round(r * 0.8)}px`, color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setAlpha(0.85);
      const z = scene.add.zone(x, y, r * 2.4, r * 2.4).setScrollFactor(0).setDepth(152).setInteractive();
      const set = (on: boolean) => { InputManager.setTouch(act, on); draw(on); };
      z.on('pointerdown', () => set(true)); z.on('pointerup', () => set(false)); z.on('pointerout', () => set(false));
      this.parts.push(g, t, z);
    };
    btn(70, H - 70, 42, '◀', 'left');
    btn(170, H - 70, 42, '▶', 'right');
    btn(W - 80, H - 75, 52, '⤒', 'jump');
    btn(W - 40, 80, 24, '❚❚', 'pause');
  }
  update(): void { /* rien : l'état est tenu par InputManager */ }
  destroy(): void { this.parts.forEach((p) => p.destroy()); InputManager.clearTouch(); }
}
