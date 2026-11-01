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
  checkpoints: CheckpointDef[];
  exit: { x: number; groundY: number; scootTo: number };
  decor: DecorDef[];
  darkZones?: { x: number; w: number; top: number; h: number }[]; // tunnels (assombrissement)
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
