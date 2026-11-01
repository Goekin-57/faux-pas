// Chapitre 1 — Le Pré des Mensonges. Huit niveaux, chacun avec son idée, et une carte qui change quand on meurt.
import { G, type Block, type LevelDef, type LevelSpec } from './types';

const gnd = (x: number, w: number, kind?: Block['kind'], reveal?: boolean): Block => ({ x, y: G, w, h: 180, kind, reveal });
const plat = (x: number, y: number, w: number, kind?: Block['kind'], reveal?: boolean): Block => ({ x, y, w, h: 30, kind, reveal });
const pick = <T>(d: number, list: T[]): T => list[Math.min(d, list.length - 1)];

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

// Retourne tout le niveau de gauche à droite (niveau 1-7 : il s'inverse à chaque mort)
function mirror(L: LevelDef): LevelDef {
  const W = L.width, fx = (x: number, w = 0) => W - x - w;
  return {
    ...L,
    start: { x: fx(L.start.x), y: L.start.y },
    blocks: L.blocks.map((b) => ({ ...b, x: fx(b.x, b.w) })),
    water: L.water?.map(([a, b]) => [fx(b), fx(a)] as [number, number]),
    spikes: L.spikes?.map((s) => ({ ...s, x: fx(s.x, s.w) })),
    springs: L.springs?.map((s) => ({ ...s, x: fx(s.x) })),
    snails: L.snails?.map((s) => ({ ...s, x: fx(s.x), minX: fx(s.maxX), maxX: fx(s.minX) })),
    rocks: L.rocks?.map((r) => ({ ...r, x: fx(r.x), trigger: fx(r.trigger) })),
    flowers: L.flowers?.map((x) => fx(x)),
    coins: L.coins?.map(([x, y]) => [fx(x), y] as [number, number]),
    signs: L.signs?.map((s) => ({ ...s, x: fx(s.x) })),
    props: L.props?.map((p) => ({ ...p, x: fx(p.x) })),
    checkpoints: L.checkpoints?.map((c) => ({ ...c, x: fx(c.x) })),
    door: { ...L.door, x: fx(L.door.x) },
    hints: L.hints?.map((h) => ({ ...h, x: fx(h.x) })),
  };
}

export const CHAPTER1: LevelSpec[] = [
  // ---------------------------------------------------------------- 1-1
  {
    id: '1-1', title: 'Avance, c\'est tout',
    build(d) {
      const fake = pick(d, [460, 300, 380]);           // le faux sol change de place à chaque mort
      const spikeX = d % 2 ? 1090 : 1000;               // les pics cachés aussi, une fois sur deux
      return {
        width: 2600, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 700, [{ x: fake, w: 80, kind: 'fake', reveal: d >= 3 }]),
          ...ground(820, 1300),
          plat(1310, 336, 60, 'invisible', d >= 1),     // bloc invisible au-dessus du trou : on s'y cogne la tête
          ...ground(1420, 1940),
          ...ground(2070, 2640),
        ],
        spikes: [{ x: spikeX, w: 50, hidden: true, range: 70 }],
        snails: [{ x: 1720, minX: 1600, maxX: 1880, possum: true }],
        coins: [[250, 360], [640, 340], [760, 320], [1160, 360], [1340, 300], [1700, 330], [2250, 360]],
        signs: [{ x: 400, text: pick(d, ['Aucun piège ici', 'Bon. Ici non plus.', 'Je ne dis plus rien.']) }],
        props: [{ type: 'tree', x: 120 }, { type: 'flower', x: 1500 }, { type: 'tree', x: 2560 }],
        checkpoints: [{ x: 1470 }],
        cardboardDoor: { x: 1900, bridge: [1930, 2080] },
        door: { x: 2450 },
        taunt: d === 0 ? undefined : pick(d - 1, ['Tiens, le sol a changé d\'avis.', 'On a déplacé les meubles.', 'Bon, je t\'aide un peu : regarde bien le sol.']),
        hints: [{ x: 1340, text: 'Il y a quelque chose au-dessus du trou…' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-2
  {
    id: '1-2', title: 'Cours !',
    build(d) {
      const wallShift = d % 2 ? 60 : 0;
      return {
        width: 3600, start: { x: 120, y: G },
        blocks: [
          ...ground(-400, 500),
          ...ground(610, 1100),
          { x: 820 + wallShift, y: 380, w: 40, h: 40 },
          ...ground(1230, 1800),
          { x: 1400 - wallShift, y: 380, w: 40, h: 40 }, { x: 1610, y: 370, w: 40, h: 50 },
          ...ground(1900, 2500, d >= 2 ? [] : [{ x: 2150, w: 120, kind: 'crumble' }]),
          plat(2540, 360, 160), plat(2700, 310, 150),
          ...ground(2860, 3700),
          { x: 3440, y: 220, w: 60, h: 200 },               // le mur où le rocher finit sa course
        ],
        coins: [[555, 320], [1165, 320], [1500, 340], [2210, 340], [2770, 260], [3100, 360]],
        checkpoints: [{ x: 1960 }],
        chaser: { x: -250, speed: d >= 3 ? 215 : 238, delay: 1.6, stopAt: 3380 },
        door: { x: 3330 },
        taunt: d === 0 ? 'Il y a un bruit derrière toi…' : d >= 3 ? 'Il fatigue un peu, profites-en.' : pick(d - 1, ['Les obstacles ont bougé.', 'Le sol tient, cette fois.']),
      };
    },
  },
  // ---------------------------------------------------------------- 1-3
  {
    id: '1-3', title: 'Boing',
    build(d) {
      const odd = d % 2 === 1;
      return {
        width: 2800, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 520),
          plat(560, 250, 200), plat(860, 290, 110),
          ...ground(1010, 1300),
          { x: 1300, y: 230, w: 60, h: 370 },                // grand mur
          ...ground(1360, 1960),
          ...ground(2160, 2860),
        ],
        springs: [
          { x: 440, power: 900, kind: odd ? 'normal' : 'lazy' },
          { x: 1200, power: 1050, kind: odd ? 'lazy' : 'back' },
          // deux ressorts côte à côte : l'un des deux est en carton, et ils échangent leur place à chaque mort
          { x: 1840, power: 1150, kind: odd ? 'cardboard' : 'normal' },
          { x: 1915, power: 1150, kind: odd ? 'normal' : 'cardboard' },
        ],
        coins: [[660, 200], [915, 240], [1330, 170], [1700, 360], [2060, 160], [2400, 360]],
        props: [{ type: 'bush', x: 2700 }],
        checkpoints: [{ x: 1420 }],
        door: { x: 2650 },
        taunt: d === 0 ? undefined : 'Les ressorts ont échangé leurs rôles.',
        hints: [{ x: 1880, text: 'L\'un des deux ressorts est en carton.' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-4
  {
    id: '1-4', title: 'Le lac',
    build(d) {
      return {
        width: 3000, start: { x: 90, y: G },
        blocks: [...ground(-40, 460), plat(880, 360, 100), plat(1400, 300, 100), plat(1950, 350, 100), ...ground(2480, 3040)],
        water: [[460, 2480]],
        movers: [
          { x: 520, y: 380, w: 110, mode: 'loop', to: [760, 380], speed: 80 },
          { x: 1040, y: 380, w: 120, mode: d >= 2 ? 'ride' : 'sink', to: [1450, 380], speed: 110 },
          d >= 2 ? { x: 1700, y: 360, w: 110, mode: 'ride', to: [1700, 360], speed: 0 } : { x: 1620, y: 360, w: 110, mode: d === 1 ? 'loop' : 'flee', to: [1820, 360], speed: d === 1 ? 90 : 260 },
          { x: 2130, y: 380, w: 100, mode: 'loop', to: [2330, 300], speed: 70 },
        ],
        coins: [[640, 330], [930, 310], [1300, 330], [1450, 250], [1720, 300], [2000, 300], [2700, 360]],
        checkpoints: [{ x: 1430, y: 300 }],
        door: { x: 2850 },
        taunt: d === 0 ? undefined : pick(d - 1, ['La plateforme qui fuyait a changé de stratégie.', 'Elles ont réparé leurs flotteurs.']),
        hints: [{ x: 1250, text: 'Celle-ci coule : saute avant.' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-5
  {
    id: '1-5', title: 'L\'invasion',
    build(d) {
      const all = [
        { x: 300, minX: 200, maxX: 560 }, { x: 700, minX: 600, maxX: 1000, possum: true }, { x: 900, minX: 830, maxX: 980 },
        { x: 1200, minX: 1100, maxX: 1500, armored: true }, { x: 1400, minX: 1260, maxX: 1600, possum: true }, { x: 1320, minX: 1260, maxX: 1380 },
      ];
      return {
        width: 1800, start: { x: 80, y: G },
        blocks: [...ground(-40, 1840), plat(420, 330, 140), plat(820, 260, 160), plat(1250, 330, 140)],
        snails: d >= 2 ? all.filter((_, i) => i !== 2 && i !== 5) : all,
        rockRain: d >= 3 ? 5 : 3.2,
        coins: [[490, 280], [900, 210], [1320, 280], [1650, 360]],
        door: { x: 1700, locked: 'snails' },
        taunt: d === 0 ? 'La porte s\'ouvre quand il n\'y a plus d\'escargots.' : d >= 2 ? 'Deux escargots sont partis. Ils avaient piscine.' : 'Attention à ceux qui font les morts.',
      };
    },
  },
  // ---------------------------------------------------------------- 1-6
  {
    id: '1-6', title: 'La nuit',
    build(d) {
      const fake = d % 2 ? 380 : 300;
      return {
        width: 3000, sky: 'night', start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 600, [{ x: fake, w: 80, kind: 'fake', reveal: d >= 3 }]),
          ...ground(720, 1280),
          ...ground(1400, 2100),
          plat(2140, 350, 60),
          ...ground(2260, 3040),
        ],
        spikes: [{ x: d % 2 ? 1130 : 1000, w: 50, hidden: true, range: 70 }, { x: 2600, w: 60 }],
        snails: [{ x: 1750, minX: 1600, maxX: 2000 }],
        coins: [[250, 360], [660, 330], [1100, 360], [1340, 320], [1800, 340], [2170, 300], [2450, 360]],
        checkpoints: [{ x: 1450 }],
        dark: { radius: 110 + Math.min(d, 4) * 22, lanterns: [[250, 330], [1450, 330], [2500, 330]], walker: [1180, 340] },
        door: { x: 2900 },
        taunt: d === 0 ? undefined : 'Tu y vois un peu mieux. Le reste a bougé.',
        hints: [{ x: 1180, text: 'Cette lanterne n\'est pas une lanterne.' }],
      };
    },
  },
  // ---------------------------------------------------------------- 1-7
  {
    id: '1-7', title: 'Tout est faux',
    build(d) {
      const L: LevelDef = {
        width: 3000, start: { x: 90, y: G },
        blocks: [
          ...ground(-40, 460),
          ...ground(580, 1100, [{ x: 760, w: 140, kind: 'crumble', reveal: d >= 2 }]),
          ...ground(1240, 1900),
          plat(1950, 330, 90, 'drop'), plat(2120, 330, 90),
          ...ground(2260, 3040),
        ],
        water: [[1100, 1240]],
        spikes: [{ x: 1500, w: 50, hidden: true, range: 70 }],
        rocks: [{ x: 360, trigger: 250 }, { x: 2400, trigger: 2300 }],
        flowers: [2780],
        coins: [[300, 340], [520, 320], [1170, 300], [1700, 360], [1995, 280], [2165, 280], [2600, 360]],
        signs: [{ x: 200, text: 'Sortie →' }],
        checkpoints: [{ x: 1290 }],
        door: { x: 2900 },
        taunt: d === 0 ? undefined : d % 2 ? 'Tout est à l\'envers. Comme ta chance.' : 'Retour à l\'endroit. Pour l\'instant.',
      };
      return d % 2 ? mirror(L) : L;
    },
  },
  // ---------------------------------------------------------------- 1-8
  {
    id: '1-8', title: 'Mégaroc',
    build(d) {
      return {
        width: 960, sky: 'sunset', start: { x: 100, y: G },
        blocks: [gnd(-40, 1040)],
        boss: 'megaroc',
        door: { x: 860, locked: 'boss' },
        taunt: d === 0 ? 'MÉGAROC arrive.' : d >= 3 ? 'Les dalles fissurées brillent. Indice.' : undefined,
      };
    },
  },
];
