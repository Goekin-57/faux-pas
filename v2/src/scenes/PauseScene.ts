// Pause par-dessus le jeu : reprendre, recommencer, menu. Clavier, manette, souris, tactile.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT } from '../core/config';
import { InputManager } from '../input/InputManager';
import { Button, ButtonGroup } from '../ui/Button';

export class PauseScene extends Phaser.Scene {
  private group!: ButtonGroup;
  constructor() { super('Pause'); }
  create(): void {
    InputManager.swallow();
    this.add.rectangle(0, 0, W, H, COL.ink, 0.62).setOrigin(0, 0).setInteractive();
    this.add.text(W / 2, 150, 'PAUSE', { fontFamily: FONT.display, fontSize: '52px', color: CSS.sun, stroke: CSS.ink, strokeThickness: 10 }).setOrigin(0.5);
    const resume = () => { this.scene.resume('Game'); this.scene.stop(); InputManager.swallow(); };
    const items = [
      new Button(this, W / 2, 250, 'Reprendre', resume, { primary: true }),
      new Button(this, W / 2, 316, 'Recommencer le niveau', () => { const lv = (this.scene.get('Game') as unknown as { levelIndex: number }).levelIndex ?? 0; this.scene.start('Game', { level: lv }); }, { w: 330 }),
      new Button(this, W / 2, 382, 'Menu principal', () => { this.scene.stop('Game'); this.scene.start('Menu'); }),
    ];
    this.group = new ButtonGroup(items, 0);
    this.events.off('update');   // la scène est relancée à chaque pause : un seul écouteur
    this.events.on('update', () => {
      const nav = InputManager.nav(); if (nav) this.group.move(nav.x, nav.y);
      if (InputManager.pressed('confirm')) this.group.press();
      if (InputManager.pressed('pause') || InputManager.pressed('back')) resume();
    });
  }
}
