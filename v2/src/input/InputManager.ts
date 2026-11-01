// Entrées centralisées : clavier, manette (API Gamepad standard) et boutons tactiles.
// Chaque action expose « held » (maintenue) et « pressed » (vient d'être appuyée cette image).
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'confirm' | 'back' | 'pause' | 'restart';
export type Device = 'keyboard' | 'gamepad' | 'touch';

const KEYS: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA', 'KeyQ'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW', 'KeyZ'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
  confirm: ['Enter', 'Space', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
};
const ACTIONS = Object.keys(KEYS) as Action[];

class Input {
  private keys = new Set<string>();
  private tapped = new Set<string>();   // touches appuyées puis relâchées entre deux images : on ne les perd pas
  private touch = new Set<Action>();
  private now = new Map<Action, boolean>();
  private prev = new Map<Action, boolean>();
  private padPrev: boolean[] = [];
  private repeatT = 0;
  private navBlocked = false;   // après un changement d'écran, une direction encore maintenue ne compte pas
  device: Device = 'keyboard';
  padName = '';
  private listeners: ((d: Device) => void)[] = [];

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.tapped.add(e.code); this.setDevice('keyboard');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.touch.clear(); });
    window.addEventListener('pointerdown', (e) => this.setDevice(e.pointerType === 'touch' ? 'touch' : 'keyboard'), true);
    window.addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
  }

  onDevice(fn: (d: Device) => void): () => void { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  private setDevice(d: Device): void { if (this.device !== d) { this.device = d; this.listeners.forEach((f) => f(d)); } }

  setTouch(a: Action, on: boolean): void { if (on) this.touch.add(a); else this.touch.delete(a); }
  clearTouch(): void { this.touch.clear(); }

  // à appeler une fois par image, avant la logique du jeu
  update(dt: number): void {
    this.prev = new Map(this.now);
    const pad = this.readPad();
    for (const a of ACTIONS) {
      const k = KEYS[a].some((c) => this.keys.has(c) || this.tapped.has(c));
      this.now.set(a, k || this.touch.has(a) || pad.has(a));
    }
    this.tapped.clear();
    this.repeatT -= dt;
  }

  private readPad(): Set<Action> {
    const out = new Set<Action>();
    let gp: Gamepad | null = null;
    try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected) { gp = g; break; } } catch { /* pas de manette */ }
    if (!gp) { this.padName = ''; return out; }
    this.padName = gp.id;
    const b = (i: number) => !!gp!.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    if (ax < -0.45 || b(14)) out.add('left');
    if (ax > 0.45 || b(15)) out.add('right');
    if (ay < -0.6 || b(12)) out.add('up');
    if (ay > 0.6 || b(13)) out.add('down');
    if (b(0)) { out.add('jump'); out.add('confirm'); }
    if (b(1)) out.add('back');
    if (b(9)) out.add('pause');
    if (b(3) || b(8)) out.add('restart');
    const any = gp.buttons.map((x) => x.pressed);
    if (any.some((p, i) => p && !this.padPrev[i]) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) this.setDevice('gamepad');
    this.padPrev = any;
    return out;
  }

  held(a: Action): boolean { return !!this.now.get(a); }
  pressed(a: Action): boolean { return !!this.now.get(a) && !this.prev.get(a); }
  released(a: Action): boolean { return !this.now.get(a) && !!this.prev.get(a); }

  // direction de navigation dans les menus, avec répétition quand on maintient
  nav(): { x: number; y: number } | null {
    const d = { x: (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0), y: (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0) };
    if (!d.x && !d.y) { this.navBlocked = false; return null; }
    if (this.navBlocked) return null;
    const fresh = this.pressed('left') || this.pressed('right') || this.pressed('up') || this.pressed('down');
    if (fresh) { this.repeatT = 0.38; return d; }
    if (this.repeatT <= 0) { this.repeatT = 0.13; return d; }
    return null;
  }

  // oublie les touches en cours (évite qu'une touche maintenue valide l'écran suivant)
  swallow(): void { this.prev = new Map(this.now); for (const a of ACTIONS) this.prev.set(a, true); this.navBlocked = true; }
}

export const InputManager = new Input();
