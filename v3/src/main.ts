import Phaser from 'phaser';
import { PHYSICS } from './core/constants';
import { CANVAS_W, CANVAS_H, DISPLAY, patchTextResolution } from './core/Display';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';

patchTextResolution();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  // résolution interne réelle (voir core/Display) ; le monde reste en 1280 × 720 unités
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#1b2b2a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: false
  },
  input: { gamepad: false, activePointers: 3 },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravity },
      fixedStep: false,
      debug: false
    }
  },
  scene: [BootScene, MenuScene, GameScene, HUDScene]
});

(window as unknown as { __game: Phaser.Game; __display: typeof DISPLAY }).__game = game;
(window as unknown as { __display: typeof DISPLAY }).__display = DISPLAY;
