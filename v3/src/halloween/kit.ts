import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';
import type { Player } from '../player/Player';
import type { TrapContext } from '../traps/Trap';
import type { ManorAmbience } from './ManorBackdrop';
import type { LevelScriptHost } from '../levels/types';

/** Tout ce dont un mécanisme du manoir a besoin. */
export interface Kit {
  scene: Phaser.Scene;
  ctx: TrapContext;
  player: Player;
  host: LevelScriptHost;
  amb: ManorAmbience | null;
  /** Corps solides à ajouter aux collisions du joueur. */
  solids: Phaser.GameObjects.GameObject[];
  expert: boolean;
}

/** Corps statique (mur, grille, porte). */
export function staticZone(k: Kit, x: number, y: number, w: number, h: number, oneWay = false): Phaser.GameObjects.Zone {
  const z = k.scene.add.zone(x + w / 2, y + h / 2, w, h);
  k.scene.physics.add.existing(z, true);
  if (oneWay) {
    const b = z.body as Phaser.Physics.Arcade.StaticBody;
    b.checkCollision.down = false;
    b.checkCollision.left = false;
    b.checkCollision.right = false;
  }
  k.solids.push(z);
  return z;
}

/** Corps mobile piloté par le script (plateforme, marche, lustre). Position = centre. */
export function movingZone(k: Kit, cx: number, cy: number, w: number, h: number, oneWay = false): Phaser.GameObjects.Zone {
  const z = k.scene.add.zone(cx, cy, w, h);
  k.scene.physics.add.existing(z);
  const b = z.body as Phaser.Physics.Arcade.Body;
  b.setAllowGravity(false);
  b.setImmovable(true);
  b.moves = false;
  if (oneWay) {
    b.checkCollision.down = false;
    b.checkCollision.left = false;
    b.checkCollision.right = false;
  }
  k.solids.push(z);
  return z;
}

export function setBodyEnabled(z: Phaser.GameObjects.Zone, on: boolean): void {
  const b = z.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
  b.enable = on;
}

/** Le joueur se tient-il sur la surface [left, right] à la hauteur top ? */
export function standingOn(p: Player, left: number, right: number, top: number, tol = 8): boolean {
  if (!p.alive) return false;
  const b = p.body;
  if (b.velocity.y < -10) return false;
  return b.right > left + 2 && b.left < right - 2 && b.bottom - top > -4 && b.bottom - top < tol;
}

/** Recouvrement du corps du joueur avec un rectangle (légèrement réduit : on pardonne les frôlements). */
export function hits(p: Player, x: number, y: number, w: number, h: number, shrink = 5): boolean {
  if (!p.alive) return false;
  const b = p.body;
  return b.right - shrink > x && b.left + shrink < x + w && b.bottom - shrink > y && b.top + shrink < y + h;
}

/** Recouvrement avec un disque. */
export function hitsCircle(p: Player, cx: number, cy: number, r: number): boolean {
  if (!p.alive) return false;
  const b = p.body;
  const nx = Phaser.Math.Clamp(cx, b.left + 4, b.right - 4);
  const ny = Phaser.Math.Clamp(cy, b.top + 4, b.bottom - 4);
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

/** Déplace le joueur avec une plateforme qui bouge sous ses pieds. */
export function carry(p: Player, dx: number, dy: number): void {
  if (dx) p.zone.x += dx;
  if (dy) p.zone.y += dy;
}

/** Petite bulle de dialogue (personnages du manoir). */
export function say(scene: Phaser.Scene, x: number, y: number, text: string, color = '#24306a', ms = 1600): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, text, { fontFamily: FONTS.ui, fontSize: '19px', color, fontStyle: '600' }).setOrigin(0.5);
  const w = label.width + 26, h = label.height + 12;
  const g = scene.add.graphics();
  g.fillStyle(0xfffaf0, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.fillTriangle(-7, h / 2 - 1, 7, h / 2 - 1, 0, h / 2 + 9);
  const c = scene.add.container(x, y, [g, label]).setDepth(DEPTH.foreground + 10).setScale(0);
  scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, alpha: 0, y: y - 14, delay: ms, duration: 300, onComplete: () => c.destroy() });
  return c;
}

/** Interpolation lissée vers une cible. */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}
