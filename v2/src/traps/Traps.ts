// Petits éléments partagés : drapeau de sauvegarde et style des messages moqueurs.
import Phaser from 'phaser';
import { COL, CSS, FONT } from '../core/config';

export function makeFlag(scene: Phaser.Scene, x: number, y: number, col: number): Phaser.GameObjects.Container {
  const ct = scene.add.container(x, y).setDepth(6);
  const g = scene.add.graphics();
  g.fillStyle(COL.outline, 1); g.fillRoundedRect(-3, -64, 6, 64, 2);
  g.fillStyle(0xd9d4e6, 1); g.fillRoundedRect(-2, -63, 4, 62, 2);
  g.fillStyle(COL.outline, 1); g.fillCircle(0, -66, 6);
  g.fillStyle(col, 1); g.fillCircle(0, -66, 4);
  const cloth = scene.add.graphics();
  cloth.fillStyle(COL.outline, 1); cloth.fillTriangle(1, -62, 1, -36, 36, -49);
  cloth.fillStyle(col, 1); cloth.fillTriangle(3, -59, 3, -39, 30, -49);
  ct.add([g, cloth]);
  scene.tweens.add({ targets: cloth, scaleX: 0.85, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return ct;
}

export const TAUNT_STYLE = { fontFamily: FONT.display, fontSize: '28px', color: CSS.pink, stroke: CSS.ink, strokeThickness: 6 };
