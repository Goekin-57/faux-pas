// Sauvegarde locale (localStorage). Toutes les lectures/écritures sont protégées :
// le jeu doit fonctionner même si le stockage est indisponible (navigation privée…).

export interface LevelRecord {
  completed: boolean;
  bestTimeMs: number | null;
  bestDeaths: number | null;
}

export interface Settings {
  music: number; // 0..1
  sfx: number;   // 0..1
  muted: boolean;
  touchControls: 'auto' | 'on' | 'off';
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  totalDeaths: number;
  settings: Settings;
}

const KEY = 'not-so-fast/save-v1';

function defaults(): SaveData {
  return {
    version: 1,
    levels: {},
    totalDeaths: 0,
    settings: { music: 0.55, sfx: 0.8, muted: false, touchControls: 'auto' }
  };
}

class SaveStore {
  private data: SaveData = defaults();

  constructor() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const d = defaults();
        this.data = {
          ...d,
          ...parsed,
          settings: { ...d.settings, ...(parsed.settings ?? {}) },
          levels: { ...(parsed.levels ?? {}) }
        } as SaveData;
      }
    } catch {
      this.data = defaults();
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get totalDeaths(): number {
    return this.data.totalDeaths;
  }

  level(id: string): LevelRecord {
    return this.data.levels[id] ?? { completed: false, bestTimeMs: null, bestDeaths: null };
  }

  isUnlocked(id: string, order: string[]): boolean {
    const i = order.indexOf(id);
    if (i <= 0) return true;
    return this.level(order[i - 1]).completed;
  }

  addDeath(): void {
    this.data.totalDeaths++;
    this.persist();
  }

  /** Retourne true si le temps est un nouveau record. */
  completeLevel(id: string, timeMs: number, deaths: number): boolean {
    const prev = this.level(id);
    const newBest = prev.bestTimeMs === null || timeMs < prev.bestTimeMs;
    this.data.levels[id] = {
      completed: true,
      bestTimeMs: newBest ? timeMs : prev.bestTimeMs,
      bestDeaths: prev.bestDeaths === null ? deaths : Math.min(prev.bestDeaths, deaths)
    };
    this.persist();
    return newBest;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
  }

  reset(): void {
    const keepSettings = this.data.settings;
    this.data = defaults();
    this.data.settings = keepSettings;
    this.persist();
  }

  private persist(): void {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* stockage indisponible : on continue sans sauvegarde */
    }
  }
}

export const Save = new SaveStore();
