// Niveau 1-1 « Le Pré des Mensonges » — tranche verticale.
// Coordonnées en pixels du monde ; le sol de référence est à y = 420.
export const G = 420;

export interface Block { x: number; y: number; w: number; h: number; trap?: 'crumble' | 'fakeEnd' }
export interface SpikeDef { x: number; y: number; w: number; hidden?: boolean; range?: number }
export interface Prop { type: 'tree' | 'bush' | 'flower' | 'mushroom' | 'rock' | 'sign'; x: number; y?: number; text?: string }
export type TrapDef =
  | { type: 'movingSpikes'; positions: number[]; y: number; w: number }
  | { type: 'biteFlower'; x: number; y: number }
  | { type: 'lazySpring'; x: number; y: number; power: number }
  | { type: 'fakeCheckpoint'; x: number; y: number; runTo: number }
  | { type: 'fakeVictory'; x: number; y: number; runTo: number }
  | { type: 'invertZone'; x: number; w: number };

export interface LevelDef {
  id: string; world: number; title: string; width: number; height: number;
  start: { x: number; y: number };
  blocks: Block[]; spikes: SpikeDef[]; coins: [number, number][]; props: Prop[];
  enemies: { type: 'snail'; x: number; y: number; minX: number; maxX: number }[];
  checkpoints: { x: number; y: number }[];
  door: { x: number; y: number };
  traps: TrapDef[];
  hints: { x: number; text: string }[];   // taquineries affichées quand on meurt souvent près d'un endroit
}

const B = (x: number, w: number, y = G, h = 540 - y + 60, trap?: Block['trap']): Block => ({ x, y, w, h, trap });

export const LEVEL_1: LevelDef = {
  id: '1-1', world: 1, title: 'Le Pré des Mensonges', width: 4400, height: 600,
  start: { x: 90, y: G },
  blocks: [
    B(-40, 700),                         // départ
    B(780, 340),                         // après le premier trou
    B(1120, 220, G, undefined, 'crumble'),   // faux sol (fissures discrètes)
    { x: 1150, y: 345, w: 160, h: 30 },  // le chemin sûr passe au-dessus
    B(1340, 760),                        // pics cachés + escargot
    B(2100, 360),                        // faux drapeau puis vrai drapeau
    B(2460, 120),                        // ressort
    B(2580, 90, 260, 340),               // haut mur à franchir avec le ressort
    B(2670, 520, 300, 300),              // plateau
    B(3190, 560),                        // zone des pics qui déménagent
    { x: 3260, y: 335, w: 120, h: 30 },
    { x: 3480, y: 330, w: 120, h: 30 },
    B(3750, 650),                        // fausse victoire et vraie sortie
  ],
  spikes: [
    { x: 1690, y: G, w: 70, hidden: true, range: 70 },
    { x: 2900, y: 300, w: 60 },
  ],
  coins: [
    [300, 360], [340, 340], [380, 360], [720, 330], [760, 300], [1180, 308], [1230, 303], [1280, 308],
    [1500, 360], [1960, 300], [2000, 280], [2520, 220], [2620, 180], [2760, 240], [2860, 220],
    [3320, 298], [3540, 292], [3640, 340], [3900, 360], [4040, 360],
  ],
  props: [
    { type: 'tree', x: 140 }, { type: 'sign', x: 260, text: 'Avance, c\'est tout →' }, { type: 'flower', x: 420 }, { type: 'bush', x: 560 },
    { type: 'sign', x: 940, text: 'Sol garanti 100 %' }, { type: 'mushroom', x: 1060 },
    { type: 'tree', x: 1420 }, { type: 'flower', x: 1600 }, { type: 'rock', x: 1880 },
    { type: 'sign', x: 2445, text: 'Saute dessus →' }, { type: 'bush', x: 2300 },
    { type: 'tree', x: 3230 }, { type: 'sign', x: 3820, text: 'Fin du niveau →' }, { type: 'tree', x: 4300 },
  ],
  enemies: [{ type: 'snail', x: 1900, y: G, minX: 1820, maxX: 2060 }],
  checkpoints: [{ x: 2380, y: G }],
  door: { x: 4250, y: G },
  traps: [
    { type: 'fakeCheckpoint', x: 2180, y: G, runTo: 2700 },
    { type: 'lazySpring', x: 2510, y: G, power: 980 },
    { type: 'movingSpikes', positions: [3300, 3420, 3560], y: G, w: 70 },
    { type: 'biteFlower', x: 3700, y: G },
    { type: 'fakeVictory', x: 3990, y: G, runTo: 4250 },
  ],
  hints: [
    { x: 1200, text: 'Les fissures, ce n\'est pas de la déco.' },
    { x: 1700, text: 'L\'herbe qui tremble cache quelque chose.' },
    { x: 3400, text: 'Le piège a déménagé. Il fera pareil la prochaine fois.' },
  ],
};
