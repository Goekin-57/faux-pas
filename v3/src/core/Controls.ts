import Phaser from 'phaser';
import { PadReader, PAD } from './Pad';

// Abstraction des commandes : clavier (AZERTY + QWERTY), manette et tactile.
// Le reste du jeu ne lit que cet objet, jamais les touches directement.

export interface TouchState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export const touchState: TouchState = { left: false, right: false, jump: false };

export class Controls {
  left = false;
  right = false;
  jumpHeld = false;
  jumpPressed = false; // vrai uniquement sur la frame de l'appui
  pausePressed = false;
  restartPressed = false;
  interactPressed = false;

  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prevJump = false;
  readonly pad = new PadReader();

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const map: Record<string, number> = {
        left: K.LEFT, right: K.RIGHT, up: K.UP,
        q: K.Q, a: K.A, d: K.D, z: K.Z, w: K.W,
        space: K.SPACE, e: K.E, esc: K.ESC, p: K.P, r: K.R
      };
      for (const [name, code] of Object.entries(map)) {
        this.keys[name] = kb.addKey(code, true, false);
      }
    }
  }

  update(): void {
    const k = this.keys;
    const down = (n: string) => !!k[n]?.isDown;
    const pad = this.pad;
    pad.poll();
    const p = pad.state;

    this.left = down('left') || down('q') || down('a') || touchState.left || pad.down(PAD.LEFT) || p.x < -0.35;
    this.right = down('right') || down('d') || touchState.right || pad.down(PAD.RIGHT) || p.x > 0.35;
    if (this.left && this.right) {
      this.left = false;
      this.right = false;
    }

    const jump = down('space') || down('up') || down('z') || down('w') || touchState.jump || pad.down(PAD.A) || pad.down(PAD.B);
    this.jumpPressed = jump && !this.prevJump;
    this.jumpHeld = jump;
    this.prevJump = jump;

    const just = (n: string) => (k[n] ? Phaser.Input.Keyboard.JustDown(k[n]) : false);
    this.pausePressed = just('esc') || just('p') || pad.pressed(PAD.START);
    this.restartPressed = just('r') || pad.pressed(PAD.BACK);
    this.interactPressed = just('e') || pad.pressed(PAD.X);
  }

  /** Empêche un saut "fantôme" juste après une reprise ou une réapparition. */
  consumeJump(): void {
    this.prevJump = true;
    this.pad.swallow();
    this.jumpPressed = false;
  }
}
