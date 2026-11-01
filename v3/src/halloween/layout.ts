import type { RoomKind } from './art';

/**
 * Plan du Manoir des Trouillards (coordonnées monde, 1 écran = 1280 px).
 * Partagé par les données du niveau, le décor et le script : une seule source de vérité.
 */
export const H = 1000;

export const Z = {
  courtyard: [0, 1710],
  hall: [1710, 3890],
  gallery: [3890, 6390],
  shadows: [6390, 9060],
  monster: [9060, 11600],
  ante: [11600, 13260],
  ballroom: [13260, 15900],
  forest: [15900, 17060],
  subA: [17900, 18820],
  subB: [19000, 20270]
} as const;

export const WIDTH = 20400;

/** Pièces intérieures : murs peints derrière le jeu. */
export const ROOMS: { x0: number; x1: number; kind: RoomKind; top?: number }[] = [
  { x0: Z.hall[0], x1: Z.hall[1], kind: 'hall' },
  { x0: Z.gallery[0], x1: Z.gallery[1], kind: 'gallery' },
  { x0: Z.shadows[0], x1: Z.shadows[1], kind: 'shadows' },
  { x0: Z.monster[0], x1: Z.monster[1], kind: 'corridor' },
  { x0: Z.ante[0], x1: Z.ante[1], kind: 'ante' },
  { x0: Z.ballroom[0], x1: Z.ballroom[1], kind: 'ballroom' },
  { x0: Z.subA[0] - 60, x1: WIDTH, kind: 'small' }
];

/**
 * Ambiance par zone : teinte (couleur + opacité) et obscurité autour du héros (0 = aucune).
 * Les transitions entre zones sont interpolées sur ~250 px : changement de lumière naturel.
 */
export const AMBIENCE: { x0: number; x1: number; tint: number; tintA: number; dark: number }[] = [
  { x0: Z.courtyard[0], x1: Z.courtyard[1], tint: 0x1c1650, tintA: 0.16, dark: 0.05 },
  { x0: Z.hall[0], x1: Z.hall[1], tint: 0x3a2010, tintA: 0.1, dark: 0.18 },
  { x0: Z.gallery[0], x1: Z.gallery[1], tint: 0x2a1030, tintA: 0.12, dark: 0.24 },
  { x0: Z.shadows[0], x1: Z.shadows[1], tint: 0x0c0c30, tintA: 0.2, dark: 0.5 },
  { x0: Z.monster[0], x1: Z.monster[1], tint: 0x14081e, tintA: 0.2, dark: 0.42 },
  { x0: Z.ante[0], x1: Z.ante[1], tint: 0x1a1030, tintA: 0.12, dark: 0.26 },
  { x0: Z.ballroom[0], x1: Z.ballroom[1], tint: 0x2a1030, tintA: 0.1, dark: 0.18 },
  { x0: Z.forest[0], x1: Z.forest[1], tint: 0x1c1650, tintA: 0.14, dark: 0.08 },
  { x0: Z.subA[0], x1: Z.subA[1], tint: 0x1a1030, tintA: 0.1, dark: 0.22 },
  { x0: Z.subB[0], x1: Z.subB[1], tint: 0x0c0c30, tintA: 0.18, dark: 0.4 }
];

/** Décors muraux posés par le décor (pas de collision). */
export type WallProp =
  | { t: 'window'; x: number; y: number; w: number; h: number; moon?: boolean }
  | { t: 'sconce'; x: number; y: number }
  | { t: 'chandelier'; x: number; y: number; w?: number }
  | { t: 'clock'; x: number; y: number }
  | { t: 'shelf'; x: number; y: number; w: number; h: number }
  | { t: 'tapestry'; x: number; y: number; w: number; h: number; color: number }
  | { t: 'frame'; x: number; y: number; w: number; h: number; scene: 'moon' | 'pumpkin' | 'ghost' }
  | { t: 'column'; x: number; y: number; h: number }
  | { t: 'pumpkin'; x: number; y: number; r: number; lit?: boolean }
  | { t: 'cobweb'; x: number; y: number; flip?: boolean }
  | { t: 'armor'; x: number; y: number };

export const WALL_PROPS: WallProp[] = [
  // --- cour
  { t: 'pumpkin', x: 110, y: 600, r: 22, lit: true },
  { t: 'pumpkin', x: 880, y: 600, r: 16, lit: true },
  { t: 'pumpkin', x: 1490, y: 600, r: 18, lit: true },
  // --- grand hall
  { t: 'window', x: 1820, y: 150, w: 90, h: 200, moon: true },
  { t: 'clock', x: 2000, y: 340 },
  { t: 'sconce', x: 1900, y: 380 },
  { t: 'sconce', x: 2380, y: 300 },
  { t: 'window', x: 2600, y: 120, w: 90, h: 200 },
  { t: 'frame', x: 3360, y: 150, w: 90, h: 110, scene: 'pumpkin' },
  { t: 'sconce', x: 3200, y: 300 },
  { t: 'cobweb', x: 1720, y: 90 },
  { t: 'cobweb', x: 3880, y: 90, flip: true },
  { t: 'armor', x: 1780, y: 600 },
  // --- galerie
  { t: 'column', x: 3940, y: 460, h: 360 },
  { t: 'window', x: 4560, y: 110, w: 80, h: 180, moon: true },
  { t: 'column', x: 4930, y: 460, h: 360 },
  { t: 'frame', x: 5110, y: 140, w: 80, h: 100, scene: 'ghost' },
  { t: 'sconce', x: 5470, y: 300 },
  { t: 'column', x: 5830, y: 230, h: 130 },
  { t: 'sconce', x: 6080, y: 140 },
  { t: 'tapestry', x: 6200, y: 110, w: 100, h: 180, color: 0x6d2a4a },
  // --- couloir des ombres
  { t: 'window', x: 6520, y: 160, w: 70, h: 170, moon: true },
  { t: 'window', x: 7020, y: 160, w: 70, h: 170 },
  { t: 'window', x: 7880, y: 160, w: 70, h: 170, moon: true },
  { t: 'cobweb', x: 8000, y: 90 },
  { t: 'window', x: 8900, y: 150, w: 70, h: 150 },
  // --- couloir interdit
  { t: 'sconce', x: 9150, y: 320 },
  { t: 'tapestry', x: 9400, y: 120, w: 120, h: 220, color: 0x3a2a6a },
  { t: 'sconce', x: 10480, y: 320 },
  { t: 'window', x: 11050, y: 150, w: 70, h: 160, moon: true },
  { t: 'cobweb', x: 11590, y: 90, flip: true },
  // --- antichambre
  { t: 'chandelier', x: 12180, y: 130, w: 140 },
  { t: 'chandelier', x: 12630, y: 130, w: 140 },
  { t: 'tapestry', x: 11700, y: 140, w: 110, h: 200, color: 0x6d2a4a },
  { t: 'tapestry', x: 13080, y: 140, w: 110, h: 200, color: 0x2a4a6d },
  // --- salle de bal
  { t: 'window', x: 13420, y: 110, w: 110, h: 260, moon: true },
  { t: 'column', x: 13700, y: 560, h: 470 },
  { t: 'window', x: 14000, y: 110, w: 110, h: 260 },
  { t: 'window', x: 15040, y: 110, w: 110, h: 260, moon: true },
  { t: 'column', x: 15420, y: 560, h: 330 },
  { t: 'pumpkin', x: 13330, y: 560, r: 20, lit: true },
  { t: 'pumpkin', x: 15600, y: 560, r: 18, lit: true },
  // --- forêt (sortie)
  { t: 'pumpkin', x: 16150, y: 560, r: 20, lit: true },
  { t: 'pumpkin', x: 16620, y: 560, r: 16, lit: true },
  // --- salles secrètes
  { t: 'sconce', x: 18060, y: 330 },
  { t: 'sconce', x: 18660, y: 330 },
  { t: 'cobweb', x: 19070, y: 90 },
  { t: 'sconce', x: 19960, y: 330 }
];
