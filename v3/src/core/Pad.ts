// Manette : lecture directe de l'API Gamepad du navigateur (disposition "standard" :
// Xbox, PlayStation, Switch Pro, la plupart des manettes génériques).
// Indépendant des scènes Phaser : une manette branchée en cours de partie est reconnue
// immédiatement, sans devoir appuyer d'abord sur un bouton dans une scène précise.

export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15
} as const;

const DEAD_ZONE = 0.35;

export interface PadState {
  connected: boolean;
  id: string;
  buttons: boolean[];
  x: number; // stick gauche (zone morte appliquée)
  y: number;
}

const EMPTY: PadState = { connected: false, id: '', buttons: [], x: 0, y: 0 };

/** État courant de la première manette connectée (lu une fois par image au plus). */
export function readPad(): PadState {
  let pads: (Gamepad | null)[] = [];
  try {
    pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  } catch {
    return EMPTY; // API refusée (iframe sans permission, etc.)
  }
  const gp = pads.find((p): p is Gamepad => !!p && p.connected);
  if (!gp) return EMPTY;
  const dz = (v: number) => (Math.abs(v) < DEAD_ZONE ? 0 : v);
  return {
    connected: true,
    id: gp.id,
    buttons: gp.buttons.map((b) => b.pressed || b.value > 0.5),
    x: dz(gp.axes[0] ?? 0),
    y: dz(gp.axes[1] ?? 0)
  };
}

/**
 * Lecteur à fronts : chaque consommateur (jeu, menu, pause…) garde son propre historique,
 * ce qui évite qu'un appui pris par un écran déclenche aussi l'écran suivant.
 */
export class PadReader {
  state: PadState = EMPTY;
  private prev: boolean[] = [];
  private prevDir = { x: 0, y: 0 };
  private repeatT = 0;

  /** À appeler une fois par image. dt en secondes. */
  poll(dt = 1 / 60): void {
    this.prev = this.state.buttons.slice();
    this.prevDir = this.dir(this.state);
    this.state = readPad();
    this.repeatT -= dt;
  }

  down(b: number): boolean {
    return !!this.state.buttons[b];
  }

  pressed(b: number): boolean {
    return !!this.state.buttons[b] && !this.prev[b];
  }

  /** Ignore les appuis déjà maintenus (ex. : le bouton A qui vient d'ouvrir cet écran). */
  swallow(): void {
    this.state = readPad();
    this.prev = this.state.buttons.slice();
    this.prevDir = this.dir(this.state);
    this.repeatT = 0.35;
  }

  /** Direction de navigation (croix ou stick), avec répétition quand on maintient. */
  nav(): { x: number; y: number } {
    const d = this.dir(this.state);
    const changed = d.x !== this.prevDir.x || d.y !== this.prevDir.y;
    if (d.x === 0 && d.y === 0) return { x: 0, y: 0 };
    if (changed) {
      this.repeatT = 0.4;
      return d;
    }
    if (this.repeatT <= 0) {
      this.repeatT = 0.14;
      return d;
    }
    return { x: 0, y: 0 };
  }

  private dir(s: PadState): { x: number; y: number } {
    const b = s.buttons;
    let x = (b[PAD.RIGHT] ? 1 : 0) - (b[PAD.LEFT] ? 1 : 0);
    let y = (b[PAD.DOWN] ? 1 : 0) - (b[PAD.UP] ? 1 : 0);
    if (x === 0 && Math.abs(s.x) > 0.6) x = Math.sign(s.x);
    if (y === 0 && Math.abs(s.y) > 0.6) y = Math.sign(s.y);
    return { x, y };
  }
}
