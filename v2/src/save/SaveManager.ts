// Sauvegarde locale versionnée, avec reprise de l'ancienne version du jeu quand elle existe.
export interface LevelRecord { done: boolean; stars: number; bestTime: number | null; deaths: number; coins: number }
export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  totalDeaths: number;
  totalTime: number;
  custom: { char: string; color: string; hat: string; face: string; outfit: string; trail: string; jumpfx: string };
  settings: { master: number; music: number; sfx: number; reduceFx: boolean; shake: boolean; readable: boolean };
  halloween: { candies: number };
  lastLevel: string | null;
  migratedFrom: string | null;
}

const KEY = 'not-so-fast-save-v1';
const OLD_KEY = 'faux-pas-save-v2';

const fresh = (): SaveData => ({
  version: 1,
  levels: {},
  totalDeaths: 0,
  totalTime: 0,
  custom: { char: 'rosa', color: 'base', hat: 'none', face: 'none', outfit: 'none', trail: 'none', jumpfx: 'none' },
  settings: { master: 0.8, music: 0.6, sfx: 0.9, reduceFx: false, shake: true, readable: false },
  halloween: { candies: 0 },
  lastLevel: null,
  migratedFrom: null,
});

function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }

// Ancienne sauvegarde : { levels: { "0": { stars, deaths, time } }, char, hat, … } (indices 0…39)
function migrate(old: Record<string, unknown>): SaveData {
  const s = fresh();
  s.migratedFrom = OLD_KEY;
  const lv = (old.levels ?? {}) as Record<string, { stars?: number; deaths?: number; time?: number; coins?: number }>;
  for (const [i, r] of Object.entries(lv)) {
    const n = Number(i);
    if (!Number.isFinite(n) || n < 0) continue;
    if (n === 40) { s.halloween.candies = Math.max(s.halloween.candies, 1); continue; }   // niveau spécial Halloween
    if (n > 40) continue;
    const id = `${Math.floor(n / 8) + 1}-${(n % 8) + 1}`;
    s.levels[id] = { done: (r.stars ?? 0) > 0, stars: Math.max(0, Math.min(3, r.stars ?? 0)), bestTime: r.time ?? null, deaths: r.deaths ?? 0, coins: r.coins ?? 0 };
    s.totalDeaths += r.deaths ?? 0;
  }
  if (typeof old.char === 'string') s.custom.char = old.char;
  if (typeof old.hat === 'string') s.custom.hat = old.hat;
  if (typeof old.tint === 'string') s.custom.color = old.tint;
  return s;
}

class Saves {
  data: SaveData = fresh();

  load(): SaveData {
    const st = storage();
    try {
      const raw = st?.getItem(KEY);
      if (raw) { const d = JSON.parse(raw) as SaveData; this.data = { ...fresh(), ...d, settings: { ...fresh().settings, ...(d.settings ?? {}) } }; return this.data; }
      const old = st?.getItem(OLD_KEY);
      if (old) { this.data = migrate(JSON.parse(old) as Record<string, unknown>); this.write(); return this.data; }
    } catch { /* sauvegarde illisible : on repart proprement sans écraser l'ancienne */ }
    this.data = fresh();
    return this.data;
  }
  write(): void { try { storage()?.setItem(KEY, JSON.stringify(this.data)); } catch { /* stockage indisponible */ } }
  hasProgress(): boolean { return Object.values(this.data.levels).some((l) => l.done) || this.data.totalDeaths > 0; }
  reset(): void { const keep = this.data.settings; this.data = fresh(); this.data.settings = keep; this.write(); }
  record(id: string, r: { time: number; deaths: number; coins: number; stars: number }): void {
    const cur = this.data.levels[id] ?? { done: false, stars: 0, bestTime: null, deaths: 0, coins: 0 };
    cur.done = true;
    cur.stars = Math.max(cur.stars, r.stars);
    cur.bestTime = cur.bestTime == null ? r.time : Math.min(cur.bestTime, r.time);
    cur.deaths += r.deaths;
    cur.coins = Math.max(cur.coins, r.coins);
    this.data.levels[id] = cur;
    this.data.totalTime += r.time;
    this.data.lastLevel = id;
    this.write();
  }
}

export const SaveManager = new Saves();
