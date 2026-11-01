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
  quality: 'auto' | 'perf'; // netteté maximale ou économie (appliqué au prochain lancement)
  /** null = pas encore choisi (nouveau joueur : l'écran de choix s'affiche). */
  difficulty: Difficulty | null;
}

export type Difficulty = 'easy' | 'expert';

export interface SaveData {
  version: 1;
  /** Records du mode Facile (clé historique : les anciennes sauvegardes y restent). */
  levels: Record<string, LevelRecord>;
  /** Records du mode Expert, séparés. */
  levelsExpert: Record<string, LevelRecord>;
  totalDeaths: number;
  deathsByDifficulty: Record<Difficulty, number>;
  settings: Settings;
  flags: Record<string, boolean>; // ex. tutoriel déjà vu
}

const KEY = 'not-so-fast/save-v1';

function defaults(): SaveData {
  return {
    version: 1,
    levels: {},
    levelsExpert: {},
    totalDeaths: 0,
    deathsByDifficulty: { easy: 0, expert: 0 },
    settings: { music: 0.55, sfx: 0.8, muted: false, touchControls: 'auto', quality: 'auto', difficulty: null },
    flags: {}
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
          levels: { ...(parsed.levels ?? {}) },
          levelsExpert: { ...(parsed.levelsExpert ?? {}) },
          deathsByDifficulty: { ...d.deathsByDifficulty, ...(parsed.deathsByDifficulty ?? {}) },
          flags: { ...(parsed.flags ?? {}) }
        } as SaveData;
        // Migration (sauvegardes d'avant les modes) : un joueur qui a déjà joué garde sa progression
        // en Facile (l'ancien réglage du jeu) et ne voit PAS l'écran de choix imposé.
        const s = parsed.settings as Partial<Settings> | undefined;
        if (!s || s.difficulty === undefined) {
          const played = Object.keys(this.data.levels).length > 0 || !!this.data.flags.tutorial || this.data.totalDeaths > 0;
          this.data.settings.difficulty = played ? 'easy' : null;
          if (played) this.data.deathsByDifficulty.easy = Math.max(this.data.deathsByDifficulty.easy, this.data.totalDeaths);
          this.persist();
        }
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

  /** Difficulté en cours (Facile tant que le joueur n'a pas choisi). */
  get difficulty(): Difficulty {
    return this.data.settings.difficulty ?? 'easy';
  }

  get difficultyChosen(): boolean {
    return this.data.settings.difficulty !== null;
  }

  setDifficulty(d: Difficulty): void {
    this.data.settings.difficulty = d;
    this.persist();
  }

  private table(d: Difficulty): Record<string, LevelRecord> {
    return d === 'expert' ? this.data.levelsExpert : this.data.levels;
  }

  /** Record du niveau dans une difficulté (par défaut, celle en cours). */
  level(id: string, d: Difficulty = this.difficulty): LevelRecord {
    return this.table(d)[id] ?? { completed: false, bestTimeMs: null, bestDeaths: null };
  }

  /** Terminé dans au moins une difficulté (la progression est commune aux deux modes). */
  completedAny(id: string): boolean {
    return this.level(id, 'easy').completed || this.level(id, 'expert').completed;
  }

  isUnlocked(id: string, order: string[]): boolean {
    const i = order.indexOf(id);
    if (i <= 0) return true;
    return this.completedAny(order[i - 1]);
  }

  deaths(d: Difficulty = this.difficulty): number {
    return this.data.deathsByDifficulty[d] ?? 0;
  }

  addDeath(): void {
    this.data.totalDeaths++;
    this.data.deathsByDifficulty[this.difficulty] = this.deaths() + 1;
    this.persist();
  }

  /** Retourne true si le temps est un nouveau record (dans la difficulté en cours). */
  completeLevel(id: string, timeMs: number, deaths: number): boolean {
    const prev = this.level(id);
    const newBest = prev.bestTimeMs === null || timeMs < prev.bestTimeMs;
    this.table(this.difficulty)[id] = {
      completed: true,
      bestTimeMs: newBest ? timeMs : prev.bestTimeMs,
      bestDeaths: prev.bestDeaths === null ? deaths : Math.min(prev.bestDeaths, deaths)
    };
    this.persist();
    return newBest;
  }

  flag(name: string): boolean {
    return !!this.data.flags[name];
  }

  setFlag(name: string, v = true): void {
    this.data.flags[name] = v;
    this.persist();
  }


  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
  }

  reset(): void {
    // effacer la progression garde les réglages ET la difficulté choisie
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
