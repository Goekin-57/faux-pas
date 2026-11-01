// Format des niveaux. Chaque niveau est une fonction du nombre de morts : la carte change quand on meurt.
export const G = 420;   // hauteur du sol de référence

export type BlockKind = 'solid' | 'crumble' | 'fake' | 'invisible' | 'drop';
export interface Block { x: number; y: number; w: number; h: number; kind?: BlockKind; reveal?: boolean }
export interface Spike { x: number; y?: number; w: number; dir?: 'up' | 'down'; hidden?: boolean; range?: number }
export interface Mover { x: number; y: number; w: number; mode: 'loop' | 'ride' | 'flee' | 'sink'; to?: [number, number]; speed?: number }
export interface Spring { x: number; y?: number; power: number; kind?: 'normal' | 'lazy' | 'back' | 'cardboard' }
export interface Snail { x: number; minX: number; maxX: number; possum?: boolean; armored?: boolean }
export interface Rock { x: number; trigger: number; delay?: number }
export interface Sign { x: number; y?: number; text: string }
export interface Prop { type: 'tree' | 'bush' | 'flower' | 'mushroom' | 'rock'; x: number; y?: number }

export interface LevelDef {
  width: number;
  sky?: 'day' | 'sunset' | 'night';
  start: { x: number; y: number };
  blocks: Block[];
  water?: [number, number][];          // trous remplis d'eau (même effet qu'un trou)
  spikes?: Spike[];
  movers?: Mover[];
  springs?: Spring[];
  snails?: Snail[];
  rocks?: Rock[];
  flowers?: number[];                  // fleurs qui mordent
  coins?: [number, number][];
  signs?: Sign[];
  props?: Prop[];
  checkpoints?: { x: number; y?: number }[];
  door: { x: number; y?: number; locked?: 'snails' | 'boss' };
  cardboardDoor?: { x: number; bridge: [number, number] };
  chaser?: { x: number; speed: number; delay: number; stopAt: number };
  dark?: { radius: number; lanterns: [number, number][]; walker?: [number, number] };
  boss?: 'megaroc';
  rain?: boolean;
  rockRain?: number;                    // une pierre tombe près du joueur toutes les N secondes (avec ombre)
  taunt?: string;                       // message affiché à l'arrivée (souvent : ce qui a changé)
  hints?: { x: number; text: string }[];
}

export interface LevelSpec { id: string; title: string; build(deaths: number): LevelDef }
