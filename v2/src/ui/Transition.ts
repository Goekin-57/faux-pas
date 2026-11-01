// Transitions entre scènes : fondu rapide et non bloquant.
import Phaser from 'phaser';
import { InputManager } from '../input/InputManager';

let busy = false;
export function goTo(from: Phaser.Scene, key: string, data?: object, ms = 260): void {
  if (busy) return;
  busy = true;
  from.cameras.main.fadeOut(ms, 29, 26, 57);
  from.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    busy = false;
    InputManager.swallow();
    from.scene.start(key, data);
  });
}
export function fadeIn(s: Phaser.Scene, ms = 260): void { s.cameras.main.fadeIn(ms, 29, 26, 57); }
