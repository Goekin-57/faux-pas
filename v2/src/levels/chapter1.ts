// Chapitre 1 — Le Pré des Mensonges : apprendre à observer.
// Huit niveaux. Chaque piège se trahit avant d'agir (tremblement, ombre, son, petite bête qui montre le danger).
// Après une mort, la carte change selon des variantes prévues : un indice apparaît, un piège se fatigue…
// jamais un piège plus dur juste parce qu'on a appris à l'éviter.
import { G, type Block, type LevelSpec } from './types';

const gnd = (x: number, w: number, kind?: Block['kind'], reveal?: boolean): Block => ({ x, y: G, w, h: 180, kind, reveal });
const plat = (x: number, y: number, w: number, kind?: Block['kind'], reveal?: boolean): Block => ({ x, y, w, h: 30, kind, reveal });

// Sol continu de x0 à x1, avec des morceaux « spéciaux » insérés (faux sol, sol qui s'effondre…)
function ground(x0: number, x1: number, special: { x: number; w: number; kind: Block['kind']; reveal?: boolean }[] = []): Block[] {
  const out: Block[] = []; let x = x0;
  for (const s of [...special].sort((a, b) => a.x - b.x)) {
    if (s.x > x) out.push(gnd(x, s.x - x));
    out.push(gnd(s.x, s.w, s.kind, s.reveal)); x = s.x + s.w;
  }
  if (x1 > x) out.push(gnd(x, x1 - x));
  return out;
}
// pont de planches : n planches de largeur w à partir de x ; « rot » = indices des planches pourries
function planks(x: number, n: number, w = 50, rot: number[] = [], delay?: number): Block[] {
  return Array.from({ length: n }, (_, i) => ({ x: x + i * w, y: G, w, h: 16, kind: 'plank' as const, rot: rot.includes(i), delay: rot.includes(i) ? undefined : delay }));
}

export const CHAPTER1: LevelSpec[] = [
  // ---------------------------------------------------------------- 1-1 : commandes, première trappe, première porte qui s'enfuit
  {
    id: '1-1', title: 'Le sol est ton ami',
    build(d) {
      return {
        width: 2500, start: { x: 90, y: G }, controls: true,
        blocks: [
          ...ground(-40, 560), { x: 340, y: 380, w: 40, h: 40 },
          ...ground(680, 1180, [{ x: 900, w: 80, kind: 'crumble', reveal: d >= 2 }]),   // la trappe : elle tremble et lâche des cailloux quand on approche
          ...ground(1180, 1650),
          ...ground(1770, 2540),
        ],
        coins: [[250, 360], [620, 330], [940, 330], [1400, 360], [1710, 320], [2100, 360]],
        props: [{ type: 'flower', x: 150 }, { type: 'tree', x: 470 }, { type: 'bush', x: 1100 }, { type: 'rock', x: 2440 }, { type: 'tree', x: 2480 }],
        signs: [{ x: 790, text: 'Sol garanti 100 %' }],
        checkpoints: [{ x: 1240 }],
        door: { x: 2380 }, fleeDoor: [1450, 1900, 2380],
        taunt: d === 2 ? 'La porte a couru toute la nuit. Elle est fatiguée.' : undefined,
        hints: [{ x: 940, y: G - 6, text: 'Saute par-dessus !' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-2 : fleurs piégées, premiers ennemis, courte poursuite
  {
    id: '1-2', title: 'Fleurs de malheur',
    build(d) {
      return {
        width: 3300, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 1560),
          ...ground(1680, 3360),
          { x: 2560, y: 380, w: 40, h: 40 },
          { x: 3150, y: 220, w: 60, h: 200 },               // le mur où le rocher finit sa course
        ],
        props: [{ type: 'flower', x: 230 }, { type: 'flower', x: 430 }, { type: 'flower', x: 880 }, { type: 'flower', x: 2060 }, { type: 'tree', x: 1460 }, { type: 'bush', x: 2420 }],
        butterflies: [{ x: 230 }, { x: 430, eat: 620 }, { x: 880 }, { x: 2060 }],   // l'un d'eux va se faire croquer sous tes yeux
        flowers: [620, 1000, 1220, 2200, 2800],
        snails: [{ x: 1900, minX: 1800, maxX: 1990 }],
        coins: [[430, 330], [800, 340], [1110, 330], [1620, 320], [1900, 330], [2380, 350], [2700, 330]],
        checkpoints: [{ x: 1720 }],
        chaser: { x: 1500, speed: d >= 2 ? 232 : 248, trigger: 2280, stopAt: 3090 },
        door: { x: 3060 },
        taunt: d === 2 ? 'Le rocher a trop mangé. Il roule moins vite.' : undefined,
        hints: [{ x: 1000, y: G - 30, text: 'Saute par-dessus !' }, { x: 2560, y: G - 50, text: 'Ne t\'arrête pas !' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-3 : plateformes fragiles, faux sols, trampolines, plateforme timide
  {
    id: '1-3', title: 'Solide sous garantie',
    build(d) {
      return {
        width: 3000, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 300),
          plat(360, 370, 160, 'crumble'),
          ...ground(620, 1500, [{ x: 800, w: 80, kind: 'fake', reveal: d >= 1 }]),
          { x: 1080, y: 240, w: 60, h: 180 },                // mur : il faut le ressort
          ...ground(1780, 2300),
          plat(2370, 360, 80, 'crumble'),
          ...ground(2560, 3040, [{ x: 2660, w: 80, kind: 'fake', reveal: d >= 2 }]),
        ],
        critters: [{ x: 700, minX: 640, maxX: 990 }, { x: 2600, minX: 2580, maxX: 2820 }],
        springs: [{ x: 1000, power: 980 }],
        shy: [{ x: 1570, y: 380, w: 120, radius: d >= 2 ? 90 : 140 }],
        coins: [[440, 320], [570, 300], [840, 330], [1110, 170], [1630, 330], [2410, 310], [2700, 340]],
        props: [{ type: 'bush', x: 200 }, { type: 'mushroom', x: 1300 }, { type: 'tree', x: 1900 }],
        checkpoints: [{ x: 1830 }],
        door: { x: 2900 },
        taunt: d === 2 ? 'La plateforme timide a pris de l\'assurance.' : undefined,
        hints: [{ x: 840, y: G - 6, text: 'Suis la coccinelle' }, { x: 1630, y: 350, text: 'Fais semblant d\'abord' }, { x: 2700, y: G - 6 }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-4 : pièges qui réagissent aux sauts, interrupteurs trompeurs
  {
    id: '1-4', title: 'Saute, pour voir…',
    build() {
      return {
        width: 3000, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 1000),
          ...ground(1130, 1265), { x: 1265, y: G + 150, w: 70, h: 40 }, ...ground(1335, 1900),
          ...ground(2200, 3040),
        ],
        // 1 : l'œil sans danger (il ouvre un cadeau) ; 2 : l'œil qui fait tomber le plafond ; 3 : l'œil qui plie et déplie le pont
        sensors: [
          { kind: 'eye', x: 250, zone: [170, 420], target: 'gift' },
          { kind: 'eye', x: 640, zone: [720, 920], target: 'roof' },
          { kind: 'bigbutton', x: 1300, target: 'hatch' },
          { kind: 'button', x: 1470, target: 'gate' },
          { kind: 'eye', x: 1820, zone: [1750, 2220], target: 'bridge' },
        ],
        targets: [
          { id: 'gift', kind: 'gift', x: 520, y: 300 },
          { id: 'roof', kind: 'ceilspikes', x: 700, y: 220, w: 220, h: 40 },
          { id: 'hatch', kind: 'trapdoor', x: 1265, w: 70 },
          { id: 'gate', kind: 'gate', x: 1600, h: 170 },
          { id: 'bridge', kind: 'bridge', x: 1900, w: 300 },
        ],
        springs: [{ x: 1300, y: G + 150, power: 1000 }],   // au fond de la trappe : un ressort te renvoie (honteux, mais vivant)
        coins: [[520, 300], [750, 320], [830, 345], [1300, 300], [2050, 330], [2500, 360]],
        props: [{ type: 'bush', x: 120 }, { type: 'flower', x: 1180 }, { type: 'tree', x: 2700 }],
        checkpoints: [{ x: 1690 }],
        door: { x: 2850 },
        hints: [{ x: 810, y: 300, text: 'Ne saute pas sous le plafond' }, { x: 2050, y: G - 20, text: 'Marche, ne saute pas' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-5 : ponts fragiles, plateformes mobiles, timing
  {
    id: '1-5', title: 'Pont de confiance',
    build() {
      return {
        width: 3240, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 420),
          ...planks(420, 8, 50, [], 0.6),
          gnd(820, 140),
          gnd(1380, 120),
          ...planks(1500, 8, 50, [2, 5, 6]),                // planches sombres et trouées : elles cèdent tout de suite
          gnd(1900, 140),
          gnd(2440, 100),
          ...planks(2540, 8, 51, [], 0.45),
          ...ground(2948, 3280),
        ],
        water: [[420, 2948]],
        movers: [
          { x: 1000, y: 400, w: 100, mode: 'loop', to: [1240, 400], speed: 85 },
          { x: 2080, y: 380, w: 110, mode: 'sink', to: [2300, 380], speed: 160 },   // des bulles dessous : elle coule
        ],
        coins: [[620, 360], [1120, 350], [1625, 330], [1800, 330], [2200, 330], [2750, 360]],
        props: [{ type: 'bush', x: 880 }, { type: 'flower', x: 1440 }, { type: 'tree', x: 3150 }],
        checkpoints: [{ x: 1960 }],
        door: { x: 3100 },
        hints: [{ x: 1625, y: G - 10, text: 'Saute les planches sombres' }, { x: 2200, y: 360, text: 'Elle coule : saute vite' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-6 : trampolines, ennemis qui font le mort, parcours de rebonds
  {
    id: '1-6', title: 'Rebondissement !',
    build() {
      return {
        width: 3000, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 1300),
          plat(440, 230, 160),
          { x: 880, y: 240, w: 60, h: 180 },
          plat(1330, 390, 110), plat(1600, 330, 80),
          ...ground(1720, 3040),
          { x: 2100, y: 220, w: 60, h: 200 },
        ],
        springs: [
          { x: 380, power: 900 },
          { x: 790, power: 1000, kind: 'lazy' }, { x: 840, power: 1000 },              // l'un des deux fait la sieste
          { x: 1400, y: 390, power: 850 },
          { x: 1960, power: 1050, kind: 'cardboard' }, { x: 2030, power: 1050 },      // l'un des deux est en carton
        ],
        snails: [{ x: 1150, minX: 1000, maxX: 1280, possum: true }, { x: 2400, minX: 2300, maxX: 2600, possum: true }, { x: 2700, minX: 2640, maxX: 2780, possum: true }],
        props: [{ type: 'shell', x: 1050 }, { type: 'shell', x: 1250 }, { type: 'shell', x: 2500 }, { type: 'tree', x: 200 }, { type: 'bush', x: 1800 }],
        coins: [[520, 190], [910, 150], [1400, 300], [1640, 280], [2130, 140], [2600, 360]],
        checkpoints: [{ x: 1780 }],
        door: { x: 2880 },
        hints: [{ x: 1150, y: G - 40, text: 'Il respire…' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-7 : pics qui tombent, orage, visibilité réduite
  {
    id: '1-7', title: 'Un ciel piquant',
    build(d) {
      const wait = (x: number, cue?: string) => ({ x, y: 190, range: 260, vib: 0.9, cue });
      const fast = (x: number) => ({ x, y: 190, range: 90 });
      return {
        width: 3200, sky: 'storm', start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 900), ...ground(1030, 2000), ...ground(2130, 3240),
          { x: 450, y: 140, w: 420, h: 50 }, { x: 1250, y: 140, w: 560, h: 50 }, { x: 2250, y: 140, w: 600, h: 50 },
        ],
        stalactites: [
          fast(520), wait(680, 'Attends…'), fast(820),
          fast(1300), fast(1420), wait(1560), fast(1700),
          fast(2300), wait(2440), fast(2580), fast(2700), fast(2800),
        ],
        dark: { radius: 210 + Math.min(d, 3) * 30, lanterns: [[300, 330], [1100, 330], [1880, 330], [2950, 330]] },
        coins: [[300, 360], [965, 320], [1450, 360], [1880, 330], [2065, 320], [2500, 360], [3000, 360]],
        checkpoints: [{ x: 1880 }],
        door: { x: 3050 },
        taunt: d === 1 ? 'Les éclairs viendront plus souvent. Regarde les ombres.' : undefined,
        hints: [{ x: 1560, y: G - 10, text: 'Attends…' }, { x: 2440, y: G - 10, text: 'Attends…' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-8 : Mégaroc
  {
    id: '1-8', title: 'Mégaroc',
    build() {
      return {
        width: 960, sky: 'sunset', start: { x: 100, y: G },
        blocks: [gnd(-40, 1040)],
        boss: 'megaroc',
        door: { x: 860, locked: 'boss' },
      };
    },
  },
];
