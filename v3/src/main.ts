import Phaser from 'phaser';
import { GAME_W, GAME_H, PHYSICS } from './core/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
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

(window as unknown as { __game: Phaser.Game }).__game = game;
