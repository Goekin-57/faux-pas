import type Phaser from 'phaser';
import type { FlowerDef } from '../traps/Sneezer';
import type { Trap, TrapContext } from '../traps/Trap';
import type { Player } from '../player/Player';
import type { Difficulty } from '../core/Save';

/** Élément réservé à une difficulté (absent sinon). */
export interface OnlyIn { only?: Difficulty }

// Format de données d'un niveau. Chaque niveau est composé à la main :
// aucune génération aléatoire d'obstacles.

export interface TerrainDef {
  x: number;
  top: number;
  w: number;
  h?: number;          // par défaut : jusqu'au bas du monde
  /** 'stone' (pavés extérieurs), 'floor' (parquet), 'wall' (maçonnerie) : thème manoir. */
  style?: 'bed' | 'hedge' | 'ceiling' | 'stone' | 'floor' | 'wall';
}

export interface StoneDef extends OnlyIn {
  x: number;           // centre
  top: number;
  /** 'prank' : pavé farceur (ressort, accroche du 1-1). */
  kind: 'matte' | 'polished' | 'prank';
  base: number;        // ancrage de la tige / du pilier
  stopDepth?: number;
}

export interface ThornsDef { x: number; w: number; top: number }
export interface SnapperDef extends OnlyIn {
  x: number;
  pathY: number;
  offset?: number;
  /** Dionée maladroite : bouton sous elle, grille qu'il ouvre. */
  lure?: { leverX: number; gate: { x: number; top: number; w: number; h: number } };
}

export interface PlatformDef extends OnlyIn {
  x: number; top: number; w: number;
  /** Oscillation (Expert seulement si moveOnly = 'expert'). */
  move?: { dx: number; period: number };
  moveOnly?: Difficulty;
}

export interface RaftDef { x: number; top: number; w: number; endX: number; /** tag de la fleur qui gonfle la voile */ flower: string }
export interface LogDef { x: number; groundY: number; w: number; inner: number; sign?: string }
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
export interface HintDef extends OnlyIn {
  id: string;
  area: { x: number; w: number; yMax: number }; // zone où l'on considère le joueur "bloqué"
  after: number;                                 // secondes cumulées dans la zone
  at: { x: number; y: number };                  // ancrage de la bulle (monde)
  icon: 'wait' | 'up' | 'flower' | 'eye';
  text: string;
  solvedBelowY?: number;                         // résolu dès que le joueur passe sous cette hauteur
  solvedRightOf?: number;                        // … ou à droite de cette position
  solvedAboveY?: number;                         // … ou au-dessus de cette hauteur
}

/** Ce que la scène de jeu met à disposition d'un script de niveau (niveaux scénarisés). */
export interface LevelScriptHost {
  scene: Phaser.Scene;
  ctx: TrapContext;
  player: Player;
  level: LevelData;
  /** Éclairage du thème (manoir), si présent. */
  ambience?: unknown;
  /** Téléporte le joueur (fondu court si fade), recale la caméra. */
  teleport(x: number, y: number, fade?: boolean): void;
}

/** Script de niveau : mécanismes et événements propres à un niveau. */
export interface LevelScript {
  traps: Trap[];
  /** Corps statiques ou mobiles avec lesquels le joueur entre en collision. */
  solids: Phaser.GameObjects.GameObject[];
  update(dt: number): void;
  /** Appelé après chaque réapparition (les pièges ont déjà été remis à zéro). */
  onRespawn(): void;
  destroy(): void;
}

export interface LevelData {
  id: string;
  /** Thème visuel et sonore (par défaut : la serre). */
  theme?: 'greenhouse' | 'manor';
  /** Niveau bonus, hors des 40 niveaux principaux. */
  bonus?: boolean;
  script?: (host: LevelScriptHost) => LevelScript;
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
  flowers?: (FlowerDef & OnlyIn & { tag?: string })[];
  platforms?: PlatformDef[];
  rafts?: RaftDef[];
  logs?: LogDef[];
  /** Mode Facile uniquement (le mode Expert n'a aucun point de contrôle). */
  checkpoints: CheckpointDef[];
  /**
   * gag 'dodge' : la porte esquive si on lui fonce dessus (1-1).
   * gag 'fly'   : une fleur (tag `flower`) l'envoie sur une plateforme (index `platform`).
   */
  exit: {
    x: number; groundY: number; scootTo: number; gag?: 'scoot' | 'dodge' | 'fly' | 'none';
    maxX?: number;
    flyTo?: { x: number; groundY: number };
    flower?: string;
    platform?: number;
  };
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
