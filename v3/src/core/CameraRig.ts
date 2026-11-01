import type Phaser from 'phaser';

/**
 * Caméra de plateforme stable.
 *  - Amortissement critique (SmoothDamp) indexé sur le temps : aucun rebond, aucun
 *    frétillement quel que soit le framerate.
 *  - Verticale calée sur le SOL où se tient le joueur : un saut ne fait pas bouger l'écran.
 *    La caméra ne suit en l'air que si le joueur tombe sous son dernier appui ou monte trop haut.
 *  - Anticipation horizontale qui ne change de côté que lors d'un déplacement franc
 *    (un demi-tour rapide ne fait pas basculer l'image).
 */
export interface CameraTarget {
  cx: number;
  cy: number;
  bottom: number;
  vx: number;
  vy: number;
  grounded: boolean;
}

const LOOK_AHEAD = 110;
const LOOK_TIME = 0.75;     // s pour que l'anticipation change de côté
const FOLLOW_X_TIME = 0.16;
const FOLLOW_Y_TIME = 0.32;
const FALL_Y_TIME = 0.12;
const FEET_BELOW_CENTER = 40; // les pieds du joueur un peu sous le centre de l'écran

function smoothDamp(cur: number, target: number, vel: { v: number }, time: number, dt: number): number {
  const omega = 2 / Math.max(0.0001, time);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  if ((target - cur > 0) === (out > target)) {
    out = target;
    vel.v = (out - target) / dt;
  }
  return out;
}

export class CameraRig {
  private cx = 0;
  private cy = 0;
  private vx = { v: 0 };
  private vy = { v: 0 };
  private look = 0;
  private lookV = { v: 0 };
  private lookSide = 1;
  private anchorY = 0;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera, private worldW: number, private worldH: number) {}

  /** Place la caméra instantanément (début de niveau, réapparition). */
  snap(t: CameraTarget, facing = 1): void {
    this.lookSide = facing;
    this.look = facing * LOOK_AHEAD;
    this.lookV.v = 0;
    this.vx.v = 0;
    this.vy.v = 0;
    this.anchorY = t.bottom;
    this.cx = t.cx + this.look;
    this.cy = this.anchorY - FEET_BELOW_CENTER;
    this.apply();
  }

  update(dtMs: number, t: CameraTarget): void {
    const dt = Math.min(Math.max(dtMs, 1), 50) / 1000;

    // anticipation : on ne change de côté que si le joueur avance vraiment dans l'autre sens
    if (Math.abs(t.vx) > 150) this.lookSide = Math.sign(t.vx);
    this.look = smoothDamp(this.look, this.lookSide * LOOK_AHEAD, this.lookV, LOOK_TIME, dt);
    this.cx = smoothDamp(this.cx, t.cx + this.look, this.vx, FOLLOW_X_TIME, dt);

    // verticale : calée sur le dernier appui
    const viewH = this.cam.height;
    let yTime = FOLLOW_Y_TIME;
    if (t.grounded) {
      this.anchorY = t.bottom;
    } else if (t.bottom > this.anchorY + 30 && t.vy > 0) {
      this.anchorY = t.bottom; // chute sous le dernier appui : on accompagne
      yTime = FALL_Y_TIME;
    } else {
      const topMargin = this.cy - viewH / 2 + 110;
      if (t.cy < topMargin) this.anchorY += t.cy - topMargin; // monte trop haut : on suit
    }
    this.cy = smoothDamp(this.cy, this.anchorY - FEET_BELOW_CENTER, this.vy, yTime, dt);
    this.apply();
  }

  private apply(): void {
    const w = this.cam.width, h = this.cam.height;
    const sx = Math.min(Math.max(this.cx - w / 2, 0), Math.max(0, this.worldW - w));
    const sy = Math.min(Math.max(this.cy - h / 2, 0), Math.max(0, this.worldH - h));
    // la caméra ne "s'accumule" pas contre un bord du niveau (pas de retard au retour)
    if (sx !== this.cx - w / 2) { this.cx = sx + w / 2; this.vx.v = 0; }
    if (sy !== this.cy - h / 2) { this.cy = sy + h / 2; this.vy.v = 0; }
    this.cam.setScroll(sx, sy);
  }
}
