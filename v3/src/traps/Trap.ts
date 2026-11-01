import type Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { SfxName } from '../core/Audio';

export type DeathKind = 'prick' | 'chomp' | 'fall';

/** Ce que la scène met à disposition des pièges (aucune dépendance circulaire). */
export interface TrapContext {
  scene: Phaser.Scene;
  player: Player;
  sfx(name: SfxName, worldX: number, intensity?: number): void;
  kill(kind: DeathKind, source?: Trap): void;
  burst(kind: 'dust' | 'leaves' | 'petals' | 'sparkle', x: number, y: number, count?: number): void;
}

/**
 * Contrat commun à tous les pièges : machine à états déterministe,
 * mise à jour par frame, et remise à zéro complète lors d'une réapparition.
 */
export interface Trap {
  readonly id: string;
  update(dt: number, ctx: TrapContext): void;
  /** Remet le piège dans son état initial (mort du joueur, redémarrage). */
  reset(): void;
  /** Réaction optionnelle lorsque ce piège a tué le joueur (gag visuel). */
  onKilledPlayer?(ctx: TrapContext): void;
  destroy(): void;
}

export function overlaps(a: Phaser.Geom.Rectangle, b: { left: number; right: number; top: number; bottom: number }): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}
