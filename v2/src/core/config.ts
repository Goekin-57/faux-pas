// Réglages partagés par tout le jeu.
export const W = 960;
export const H = 540;

// Physique reprise du jeu d'origine (réglée pendant 14 versions de tests).
export const PHYS = {
  gravity: 1800,
  jump: 620,
  speed: 260,
  accelGround: 2600,
  accelAir: 1500,
  decelGround: 3200,
  decelAir: 900,
  maxFall: 900,
  jumpCut: 0.45,      // relâcher le saut coupe la montée
  coyote: 0.09,
  buffer: 0.12,
  coyoteTouch: 0.12,
  bufferTouch: 0.16,
} as const;

export const HEARTS = 3;
export const INVULN = 1.4;

export const COL = {
  ink: 0x1d1a39,
  ink2: 0x3d3778,
  outline: 0x38374a,
  sun: 0xffd23f,
  pink: 0xff4f87,
  mint: 0x21c4a8,
  lilac: 0xcbb8ff,
  paper: 0xfff3c4,
  sky: 0xa8e4ff,
} as const;
export const CSS = {
  ink: '#1d1a39',
  outline: '#38374a',
  sun: '#ffd23f',
  pink: '#ff4f87',
  mint: '#21c4a8',
  paper: '#fff3c4',
  wood: '#3a2416',
} as const;

export const FONT = { display: 'Bungee, "Arial Black", system-ui, sans-serif', body: 'Nunito, system-ui, sans-serif' } as const;
