// Format des niveaux. Chaque niveau est une fonction du nombre de morts : la carte change quand on meurt,
// mais jamais pour devenir arbitrairement plus dure (variantes prévues, indices qui apparaissent).
export const G = 420;   // hauteur du sol de référence

export type BlockKind = 'solid' | 'crumble' | 'fake' | 'invisible' | 'drop' | 'plank';
// crumble : tremble et lâche des cailloux quand on approche, cède quand on reste dessus
// fake : faux sol (on passe à travers) — il miroite légèrement, et les petites bêtes l'évitent
// plank : planche de pont (grince, perd des débris, tombe) ; rot = pourrie (tombe tout de suite, plus sombre)
export interface Block { x: number; y: number; w: number; h: number; kind?: BlockKind; reveal?: boolean; rot?: boolean; delay?: number }
export interface Spike { x: number; y?: number; w: number; dir?: 'up' | 'down'; hidden?: boolean; range?: number }
export interface Mover { x: number; y: number; w: number; mode: 'loop' | 'ride' | 'flee' | 'sink'; to?: [number, number]; speed?: number }
export interface Spring { x: number; y?: number; power: number; kind?: 'normal' | 'lazy' | 'back' | 'cardboard' }
export interface Snail { x: number; minX: number; maxX: number; y?: number; possum?: boolean; armored?: boolean }
export interface Rock { x: number; trigger: number; delay?: number }
export interface Sign { x: number; y?: number; text: string }
export interface Prop { type: 'tree' | 'bush' | 'flower' | 'mushroom' | 'rock' | 'shell'; x: number; y?: number }

// Capteurs reliés par un câble visible à ce qu'ils déclenchent
export interface Sensor { kind: 'eye' | 'button' | 'bigbutton'; x: number; zone?: [number, number]; target: string }
export interface Target { id: string; kind: 'gift' | 'ceilspikes' | 'bridge' | 'gate' | 'trapdoor'; x: number; y?: number; w?: number; h?: number }

export interface LevelDef {
  width: number;
  sky?: 'day' | 'sunset' | 'night' | 'storm';
  start: { x: number; y: number };
  blocks: Block[];
  water?: [number, number][];          // trous remplis d'eau (même effet qu'un trou)
  spikes?: Spike[];
  movers?: Mover[];
  springs?: Spring[];
  snails?: Snail[];
  rocks?: Rock[];
  flowers?: number[];                  // fleurs qui mordent : elles se tournent vers toi et referment leurs pétales avant
  butterflies?: { x: number; eat?: number }[];   // posés sur une fleur inoffensive ; « eat » : il va se faire croquer par la fleur piégée en x
  critters?: { x: number; minX: number; maxX: number }[];   // coccinelles qui sautent par-dessus les sols piégés
  coins?: [number, number][];
  signs?: Sign[];
  props?: Prop[];
  checkpoints?: { x: number; y?: number }[];
  door: { x: number; y?: number; locked?: 'snails' | 'boss' };
  fleeDoor?: number[];                  // la porte s'enfuit d'un arrêt à l'autre ; au dernier, elle est trop fatiguée
  cardboardDoor?: { x: number; bridge: [number, number] };
  chaser?: { x: number; speed: number; trigger: number; stopAt: number };
  shy?: { x: number; y: number; w: number; radius: number }[];   // plateformes timides : elles tremblent si tu es près, plongent si tu sautes
  sensors?: Sensor[];
  targets?: Target[];
  stalactites?: { x: number; y: number; range: number; vib?: number; cue?: string }[];
  dark?: { radius: number; lanterns: [number, number][]; walker?: [number, number] };
  boss?: 'megaroc';
  rockRain?: number;
  controls?: boolean;                   // montre les commandes au début (1-1, premier essai)
  taunt?: string;                       // ce que dit le soleil à l'arrivée (souvent : ce qui a changé)
  hints?: { x: number; y?: number; text?: string }[];   // après 2 morts près de x : un repère lumineux, et un mot quand on approche
}

export interface LevelSpec { id: string; title: string; build(deaths: number): LevelDef }
