// Réglages globaux. Tout ce qui touche au "feeling" du personnage est ici,
// pour pouvoir l'ajuster sans fouiller dans le code du contrôleur.

export const GAME_W = 1280;
export const GAME_H = 720;

export const PHYSICS = {
  gravity: 1850,
  maxFall: 940,
  runSpeed: 285,
  groundAccel: 2600,
  groundDecel: 3200,
  airAccel: 1750,
  airDecel: 900,
  turnBoost: 1.6,        // accélère plus fort quand on change de direction
  jumpVelocity: 735,
  jumpCutFactor: 0.42,   // relâcher le saut tôt = saut plus court
  apexGravityScale: 0.6, // petit flottement au sommet du saut (meilleur contrôle)
  apexThreshold: 90,
  coyoteMs: 100,
  jumpBufferMs: 120,
  bodyW: 30,
  bodyH: 44
};

// Palette du chapitre 1 — La Serre des Évidences
export const C1 = {
  skyTop: 0xcfeee4,
  skyBottom: 0xfbe6c6,
  sage: 0x8fb59a,
  sageDeep: 0x4e7a62,
  leafDark: 0x2f5446,
  turquoise: 0x7fd1c7,
  teal: 0x3e9e98,
  peach: 0xf6b89a,
  coral: 0xe8846b,
  sun: 0xf7d774,
  cream: 0xfff1c9,
  plum: 0x4a2140
};

export const HERO = {
  body: 0x24306a,
  face: 0xf4eee2,
  eye: 0x141b3d,
  scarf: 0xf28c38,
  scarfShade: 0xc9611f,
  cheek: 0xf3a08a
};

export const FONTS = {
  display: '"Bagel Fat One", "Fredoka", system-ui, sans-serif',
  ui: '"Fredoka", "Trebuchet MS", system-ui, sans-serif'
};

export const DEPTH = {
  sky: -100,
  far: -80,
  mid: -60,
  near: -40,
  rays: -30,
  backProps: -10,
  terrain: 0,
  props: 5,
  traps: 10,
  player: 20,
  frontProps: 30,
  fx: 40,
  foreground: 60,
  vignette: 90
};
