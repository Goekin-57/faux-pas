import type { FlowerDef } from '../traps/Sneezer';

// Format de données d'un niveau. Chaque niveau est composé à la main :
// aucune génération aléatoire d'obstacles.

export interface TerrainDef {
  x: number;
  top: number;
  w: number;
  h?: number;          // par défaut : jusqu'au bas du monde
  style?: 'bed' | 'hedge' | 'ceiling';
}

export interface StoneDef {
  x: number;           // centre
  top: number;
  kind: 'matte' | 'polished';
  base: number;        // ancrage de la tige / du pilier
  stopDepth?: number;
}

export interface ThornsDef { x: number; w: number; top: number }
export interface SnapperDef { x: number; pathY: number; offset?: number }
export interface CheckpointDef { x: number; groundY: number }

export interface DecorDef {
  type: 'bush' | 'mushrooms' | 'can' | 'lantern' | 'shaft' | 'fgLeaf';
  x: number;
  y: number;
  w?: number;
  h?: number;
  flip?: boolean;
}

/**
 * Indice contextuel : n'apparaît que si le joueur reste bloqué dans une zone.
 * Jamais affiché d'emblée (le piège garde sa surprise).
 */
export interface HintDef {
  id: string;
  area: { x: number; w: number; yMax: number }; // zone où l'on considère le joueur "bloqué"
  after: number;                                 // secondes cumulées dans la zone
  at: { x: number; y: number };                  // ancrage de la bulle (monde)
  icon: 'wait' | 'up' | 'flower' | 'eye';
  text: string;
  solvedBelowY?: number;                         // résolu dès que le joueur passe sous cette hauteur
  solvedRightOf?: number;                        // … ou à droite de cette position
}

export interface LevelData {
  id: string;
  chapter: number;
  index: number;
  name: string;
  signature: string;   // mécanique signature (affichée dans les docs / crédits de dev)
  width: number;
  height: number;
  spawn: { x: number; y: number };
  terrain: TerrainDef[];
  stones: StoneDef[];
  thorns: ThornsDef[];
  snappers: SnapperDef[];
  flowers?: FlowerDef[];
  checkpoints: CheckpointDef[];
  /** gag 'scoot' : la porte recule si on arrive en courant (1-1). */
  exit: { x: number; groundY: number; scootTo: number; gag?: 'scoot' | 'none' };
  decor: DecorDef[];
  darkZones?: { x: number; w: number; top: number; h: number }[]; // tunnels (assombrissement)
  hints?: HintDef[];
}

export interface LevelMeta {
  id: string;
  chapter: number;
  index: number;
  name: string;
  boss?: boolean;
  data?: () => LevelData; // absent = pas encore construit
}

export interface ChapterMeta {
  n: number;
  name: string;
  palette: number[];
}
