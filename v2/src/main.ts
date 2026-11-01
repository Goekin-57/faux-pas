// Point d'entrée : configuration de Phaser et des scènes.
import Phaser from 'phaser';
import '@fontsource/bungee/400.css';
import '@fontsource/nunito/800.css';
import { W, H, PHYS } from './core/config';
import { InputManager } from './input/InputManager';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,           // WebGL, avec repli Canvas si besoin
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1d1a39',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYS.gravity }, debug: false, tileBias: 24 } },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 4 },
  scene: [BootScene, MenuScene, GameScene, PauseScene, ResultsScene],
});

// une seule lecture des entrées par image, avant toutes les scènes
let gameTime = 0;   // temps de jeu cumulé (utile aux tests automatiques)
game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => { gameTime += delta; InputManager.update(Math.min(0.05, delta / 1000)); });
(window as unknown as { __GT: () => number }).__GT = () => gameTime;
(window as unknown as { __GAME?: Phaser.Game }).__GAME = game;
