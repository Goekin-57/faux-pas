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
  | { type: 'fakeVictory'; x: number; y: number; bridge: [number, number] }
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

// Une seule fois chaque gag, du plus simple au plus vicieux :
// trou → faux sol fissuré → pics cachés → escargot → ressort paresseux → pics qui déménagent → fleur qui mord → fausse sortie en carton.
export const LEVEL_1: LevelDef = {
  id: '1-1', world: 1, title: 'Le Pré des Mensonges', width: 3640, height: 600,
  start: { x: 90, y: G },
  blocks: [
    B(-40, 580),                          // départ, puis un premier trou simple
    B(660, 300),
    B(960, 200, G, undefined, 'crumble'), // faux sol fissuré
    { x: 990, y: 345, w: 150, h: 30 },    // le chemin sûr passe au-dessus
    B(1160, 600),                         // pics cachés puis escargot
    B(1760, 260),                         // drapeau + ressort
    B(2020, 90, 260, 340),                // mur qu'on ne passe qu'avec le ressort
    B(2110, 360, 300, 300),               // plateau
    B(2470, 680),                         // pics qui déménagent, fleur
    B(3280, 360),                         // vraie sortie, après le trou caché par la fausse porte
  ],
  spikes: [{ x: 1420, y: G, w: 50, hidden: true, range: 70 }],
  coins: [
    [380, 360], [600, 320], [1020, 308], [1110, 308], [1600, 330], [1870, 360],
    [2060, 200], [2300, 250], [2700, 330], [2810, 330], [3380, 360],
  ],
  props: [
    { type: 'tree', x: 150 }, { type: 'sign', x: 300, text: 'Avance, c\'est tout →' },
    { type: 'sign', x: 880, text: 'Sol garanti 100 %' },
    { type: 'flower', x: 1680 },
    { type: 'tree', x: 3590 },
  ],
  enemies: [{ type: 'snail', x: 1660, y: G, minX: 1560, maxX: 1730 }],
  checkpoints: [{ x: 1800, y: G }],
  door: { x: 3500, y: G },
  traps: [
    { type: 'lazySpring', x: 1960, y: G, power: 980 },
    { type: 'movingSpikes', positions: [2650, 2760, 2870], y: G, w: 70 },
    { type: 'biteFlower', x: 3000, y: G },
    { type: 'fakeVictory', x: 3110, y: G, bridge: [3130, 3300] },
  ],
  hints: [
    { x: 1000, text: 'Les fissures, ce n\'est pas de la déco.' },
    { x: 1430, text: 'L\'herbe qui tremble cache quelque chose.' },
    { x: 2780, text: 'Le piège a déménagé. Il recommencera.' },
  ],
};
