import type { LevelData, StoneDef } from '../types';

/**
 * 1-1 — LE CHEMIN TROP POLI
 * Signature : le sol réagit à l'HÉSITATION plutôt qu'au contact.
 *
 * Langage visuel appris dans ce niveau (réutilisé ensuite) :
 *  - pavé MAT, posé sur un pilier de pierre  → fiable, on peut s'y arrêter ;
 *  - pavé POLI (brillant, arêtes nettes, scintille), posé sur une tige → ne pas s'y attarder.
 *
 * Les cinq moments (v0.5) :
 *  1. ACCROCHE (≈ 5 s)  : le PAVÉ FARCEUR au-dessus d'un fossé sans danger. Hésite dessus : il s'enfonce
 *                         en rigolant ; saute : il te catapulte de l'autre côté. Jamais mortel.
 *  2. DÉCOUVERTE         : le chemin trop poli (ne pas s'arrêter), puis la première Dionée : le pavé MAT
 *                         est la bonne place pour attendre.
 *  3. COMBINAISON        : escalier de pavés polis sous une Dionée, puis la DIONÉE MALADROITE : elle vise
 *                         le joueur près d'un bouton… s'il s'écarte, elle tape le bouton et ouvre la grille.
 *  4. PASSAGE DYNAMIQUE  : l'ascenseur à sablier (hésiter EXPRÈS), le tunnel sans s'arrêter, le final rythmé.
 *  5. FINAL HUMORISTIQUE : la porte esquive si on lui fonce dessus ; si on s'arrête, elle revient vers nous.
 *                         Qui la poursuit jusqu'au coin se fait renvoyer devant elle par une petite fleur
 *                         (avant-goût du 1-2).
 *
 * Expert : une Dionée de plus au-dessus du chemin trop poli (attendre sur la terre ferme, puis y aller).
 */

const H = 1000;
const G = 560; // niveau du sol principal

/** Rangée de pavés jointifs (largeur 104, pas 106). */
function row(startLeft: number, top: number, base: number, kinds: ('m' | 'p')[]): StoneDef[] {
  return kinds.map((k, i) => ({
    x: startLeft + 52 + i * 106,
    top,
    base,
    kind: k === 'm' ? 'matte' : 'polished'
  }));
}

export function level1_1(): LevelData {
  return {
    id: '1-1',
    chapter: 1,
    index: 1,
    name: 'Le chemin trop poli',
    signature: "Le sol réagit à l'hésitation plutôt qu'au simple contact.",
    width: 8620,
    height: H,
    spawn: { x: 150, y: G - 30 },

    terrain: [
      // --- Temps 1
      { x: 0, top: G, w: 660 },
      { x: 660, top: 496, w: 330 },
      { x: 990, top: 680, w: 380 },          // fossé sans danger (on en ressort en sautant)
      { x: 1370, top: G, w: 330 },
      { x: 2340, top: G, w: 520 },
      // --- Temps 2
      { x: 3498, top: G, w: 320 },
      { x: 3650, top: 480, w: 168 },
      { x: 4600, top: 470, w: 500 },
      { x: 5100, top: G, w: 300 },
      // --- Temps 3
      { x: 5400, top: 808, w: 120 },          // fond du puits de l'ascenseur
      { x: 5520, top: 300, w: 160, h: 390, style: 'hedge' },
      { x: 5680, top: G, w: 880, h: 130, style: 'ceiling' },
      { x: 5520, top: 780, w: 520 },          // tunnel
      { x: 6360, top: 780, w: 340 },
      { x: 6700, top: 700, w: 160 },
      { x: 6860, top: 620, w: 160 },
      { x: 7020, top: G, w: 260 },
      { x: 7918, top: G, w: 702 }
    ],

    stones: [
      // accroche : le pavé farceur, au-dessus d'un fossé inoffensif
      { x: 1180, top: 520, kind: 'prank', base: 680 },
      // le "chemin trop poli" : on traverse sans s'arrêter
      ...row(1701, G, 860, ['p', 'p', 'p', 'p', 'p', 'p']),
      // Dionée n°1 : le pavé mat d'avant est la bonne place pour attendre
      ...row(2861, G, 860, ['m', 'p', 'p', 'p', 'm', 'p']),
      // pavés isolés en escalier : hésiter avant de viser le saut suivant = danger
      { x: 3930, top: 520, kind: 'polished', base: 860 },
      { x: 4110, top: 460, kind: 'polished', base: 860 },
      { x: 4290, top: 410, kind: 'polished', base: 860 },
      { x: 4470, top: 410, kind: 'matte', base: 860 },
      // l'ascenseur : il faut hésiter EXPRÈS
      { x: 5458, top: G, kind: 'polished', base: 808, stopDepth: 220 },
      // tunnel : plafond bas, impossible de sauter, il faut marcher sans s'arrêter
      ...row(6041, 780, 900, ['p', 'p', 'p']),
      // final : marche / observation / marche
      ...row(7281, G, 860, ['p', 'p', 'm', 'p', 'p', 'p'])
    ],

    thorns: [
      { x: 1700, w: 640, top: 840 },
      { x: 2860, w: 638, top: 840 },
      { x: 3818, w: 782, top: 840 },
      { x: 6040, w: 320, top: 860 },
      { x: 7280, w: 638, top: 840 }
    ],

    snappers: [
      // Expert : combinaison chemin poli + Dionée (on attend sur la terre ferme, jamais sur un pavé poli)
      { x: 2019, pathY: G, offset: 0.4, only: 'expert' },
      { x: 3125, pathY: G, offset: 0 },
      { x: 4470, pathY: 410, offset: 0.8 },
      // la Dionée maladroite : bouton sous elle, grille de treillage juste après
      { x: 4880, pathY: 470, lure: { leverX: 4880, gate: { x: 4990, top: 190, w: 34, h: 280 } } },
      { x: 7439, pathY: G, offset: 0 },
      { x: 7757, pathY: G, offset: 1.55 }
    ],

    // Un seul point de contrôle (Facile), au milieu : après les escaliers et la Dionée (la partie la plus
    // longue à refaire), avant la haie. Les deux premières parties ne sont jamais à refaire.
    checkpoints: [
      { x: 4720, groundY: 470 }
    ],

    exit: { x: 8150, groundY: G, scootTo: 8340, gag: 'dodge', maxX: 8430 },

    // la petite fleur du coin : renvoie devant la porte celui qui la poursuit trop vite
    flowers: [
      {
        x: 8566, groundY: G, blow: 'left', size: 'small', palette: 'coral', stare: 0.3, daze: 1.4, power: 1.8,
        watch: { x: 8436, y: 380, w: 130, h: 200 }, quip: 'La sortie, c’est par là !'
      }
    ],

    decor: [
      { type: 'can', x: 300, y: G },
      { type: 'bush', x: 520, y: G },
      { type: 'bush', x: 1560, y: G, flip: true },
      { type: 'bush', x: 2700, y: G },
      { type: 'can', x: 3560, y: G, flip: true },
      { type: 'bush', x: 5260, y: G, flip: true },
      { type: 'shaft', x: 5400, y: G, w: 120, h: 248 },
      { type: 'lantern', x: 5800, y: 700 },
      { type: 'mushrooms', x: 5700, y: 780 },
      { type: 'mushrooms', x: 5960, y: 780, flip: true },
      { type: 'lantern', x: 6200, y: 700 },
      { type: 'mushrooms', x: 6480, y: 780 },
      { type: 'bush', x: 6780, y: 700 },
      { type: 'fgLeaf', x: 900, y: H },
      { type: 'fgLeaf', x: 2600, y: H, flip: true },
      { type: 'fgLeaf', x: 4300, y: H },
      { type: 'fgLeaf', x: 7000, y: H, flip: true },
      { type: 'fgLeaf', x: 8500, y: H }
    ],

    darkZones: [{ x: 5520, w: 1040, top: 690, h: 120 }],

    hints: [
      {
        // la grille : la plante doit taper le bouton
        id: 'lure',
        area: { x: 4600, w: 420, yMax: 520 },
        after: 10,
        at: { x: 4880, y: 170 },
        icon: 'eye',
        text: 'Laisse-la viser le bouton… puis écarte-toi',
        solvedRightOf: 5030
      },
      {
        // la haie bloque : il faut rester immobile sur le pavé à sablier pour descendre
        id: 'lift',
        area: { x: 5100, w: 420, yMax: 600 },
        after: 9,
        at: { x: 5440, y: 420 },
        icon: 'wait',
        text: 'Reste immobile sur ce pavé',
        solvedBelowY: 680
      }
    ]
  };
}
