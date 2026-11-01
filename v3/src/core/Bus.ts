import Phaser from 'phaser';

/** Bus d'événements entre la scène de jeu et l'interface (HUD). */
export const Bus = new Phaser.Events.EventEmitter();

export interface HudStats {
  deaths: number;
  timeMs: number;
}

export interface VictoryStats {
  levelId: string;
  deaths: number;
  timeMs: number;
  newRecord: boolean;
  bestTimeMs: number | null;
}

export const EV = {
  stats: 'hud:stats',
  levelStart: 'hud:levelStart',
  checkpoint: 'hud:checkpoint',
  pause: 'hud:pause',
  resume: 'game:resume',
  restart: 'game:restart',
  quit: 'game:quit',
  victory: 'hud:victory',
  nextLevel: 'game:next'
} as const;

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
