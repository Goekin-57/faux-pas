import type { LevelData, StoneDef } from '../types';

/**
 * 1-2 — LES FLEURS INDISCRÈTES
 * Signature : un danger directionnel (l'éternuement) devient un moyen de déplacement.
 *
 * Règles apprises dans ce niveau :
 *  - une fleur qui te VOIT se concentre (yeux, pollen aspiré, reniflements), inspire, puis éternue ;
 *  - le souffle part toujours du même côté (celui vers lequel la fleur est tournée) ;
 *  - après un éternuement, elle est SONNÉE quelques secondes : elle ne voit plus rien.
 *
 * Déroulé (v0.5, rythme resserré) :
 *  1. Découverte    : une fleur te repousse (sans danger). On passe pendant qu'elle est sonnée.
 *  2. Catapulte     : un fossé trop large. La fleur tournée vers le vide t'envoie… sur des pavés POLIS
 *                     (leçon du 1-1) : il faut continuer à courir à l'atterrissage.
 *  3. Trampoline    : une fleur géante tournée vers le ciel t'envoie sur la corniche.
 *     Faux raccourci : un tronc creux promet un raccourci ; une petite fleur, au fond, renvoie le curieux.
 *  4. Le duel       : la fleur lilas est SOURNOISE. Si tu sautes avant qu'elle ait éternué, elle retient
 *                     son souffle et attend que tu atterrisses. Il faut la faire éternuer d'abord, de loin.
 *  5. L'aspirante   : piège inversé. Une fleur qui INSPIRE : au bord du vide elle t'attire (résiste !),
 *                     mais en plein saut elle te porte de l'autre côté.
 *  6. Le radeau     : chaîne de pièges. Une fleur TIMIDE (elle se cache quand on la regarde) éternue
 *                     dans la voile d'un radeau… à condition qu'on lui tourne le dos.
 *  7. Combo         : la fleur du sol te pousse… droit dans le mur. D'abord la géante, puis le souffle.
 *  8. Porte volante : une petite fleur éternue la porte sur une plateforme en hauteur. Surprise !
 *                     Une dernière géante t'y emmène. (Expert : la plateforme se balance.)
 */

const H = 1000;
const G = 560;

/** Rangée de pavés jointifs (largeur 104, pas 106). */
function row(startLeft: number, top: number, base: number, n: number): StoneDef[] {
  return Array.from({ length: n }, (_, i) => ({ x: startLeft + 52 + i * 106, top, base, kind: 'polished' as const }));
}

export function level1_2(): LevelData {
  return {
    id: '1-2',
    chapter: 1,
    index: 2,
    name: 'Les fleurs indiscrètes',
    signature: 'Un danger directionnel (l’éternuement) devient un moyen de déplacement.',
    width: 8800,
    height: H,
    spawn: { x: 140, y: G - 30 },

    terrain: [
      { x: 0, top: G, w: 1560 },        // 1. découverte + élan de la catapulte
      { x: 2364, top: 640, w: 536 },    // 2. après les pavés polis : pied du trampoline
      { x: 2900, top: 300, w: 760 },    // 3. corniche haute (le mur fait 340 px : impossible à sauter)
      { x: 3980, top: 300, w: 740 },    // 4. rive de la fleur lilas
      { x: 5100, top: 300, w: 600 },    // 5-6. rive de l'aspirante, embarcadère du radeau
      { x: 6280, top: 300, w: 520 },    //      débarcadère
      { x: 6800, top: G, w: 520 },      // 7. jardin bas du combo
      { x: 7720, top: 470, w: 1080 }    // 8. corniche de la sortie
    ],

    // la catapulte atterrit sur des pavés polis : on ne s'y arrête pas
    stones: row(1940, 640, 900, 4),

    thorns: [
      { x: 1560, w: 804, top: 840 },
      { x: 3660, w: 320, top: 840 },
      { x: 4720, w: 380, top: 840 },
      { x: 5700, w: 580, top: 840 },
      { x: 7320, w: 400, top: 840 }
    ],

    snappers: [],

    flowers: [
      // 1. tournée vers le joueur qui arrive : elle repousse, puis reste sonnée
      { x: 760, groundY: G, blow: 'left', view: 540, palette: 'peach' },
      // 2. tournée vers le fossé : la catapulte
      { x: 1380, groundY: G, blow: 'right', view: 260, palette: 'sun' },
      // 3. géante tournée vers le ciel : le trampoline
      { x: 2760, groundY: 640, blow: 'up', size: 'giant', palette: 'coral', stare: 0.8 },
      //    au fond du tronc du faux raccourci
      {
        x: 3332, groundY: 300, blow: 'left', size: 'small', palette: 'lilac', headY: 58, height: 92,
        stare: 0.25, daze: 1.2, watch: { x: 3170, y: 204, w: 190, h: 96 }, quip: 'Raccourci fermé !'
      },
      // 4. le duel : A propulse, B (lilas) voit de très loin, reste sonnée longtemps… et elle est sournoise
      { x: 3560, groundY: 300, blow: 'right', view: 280, palette: 'peach' },
      { x: 4140, groundY: 300, blow: 'left', view: 760, reach: 400, stare: 1.6, daze: 3.6, palette: 'lilac', sly: true },
      // 5. l'aspirante (piège inversé)
      { x: 5230, groundY: 300, blow: 'left', suck: true, view: 640, reach: 570, stare: 1, daze: 2.4, palette: 'sun' },
      // 6. la timide qui gonfle la voile (elle ne pousse pas le joueur)
      {
        x: 5600, groundY: 300, blow: 'right', shy: true, pushPlayer: false, palette: 'coral', tag: 'sail',
        stare: 0.9, daze: 1.2, reach: 300, watch: { x: 5690, y: 120, w: 170, h: 200 }
      },
      // 7. combo : E pousse dans le mur si on est au sol… mais porte loin si on est en l'air
      //    (timing identique dans les deux modes : le combo est réglé au centième)
      { x: 7080, groundY: G, blow: 'right', view: 300, height: 420, stare: 1.6, power: 1.2, palette: 'sun', steady: true },
      { x: 7230, groundY: G, blow: 'up', size: 'giant', palette: 'coral', stare: 0.7, daze: 1.8, steady: true },
      // 8. la porte volante : la petite fleur qui éternue la porte…
      {
        x: 8236, groundY: 470, blow: 'up', size: 'small', palette: 'peach', tag: 'door',
        stare: 0.35, daze: 2.4, watch: { x: 7900, y: 300, w: 330, h: 190 }
      },
      //    … et la géante qui t'emmène jusqu'à elle
      { x: 8380, groundY: 470, blow: 'up', size: 'giant', palette: 'lilac', stare: 0.6, daze: 1.6 }
    ],

    platforms: [
      // plateforme d'arrivée de la porte (Expert : elle se balance)
      { x: 8540, top: 230, w: 220, move: { dx: 80, period: 3.4 }, moveOnly: 'expert' }
    ],

    rafts: [{ x: 5770, top: 300, w: 140, endX: 6210, flower: 'sail' }],

    logs: [{ x: 3160, groundY: 300, w: 220, inner: 96, sign: 'RACCOURCI' }],

    // Un seul point de contrôle (Facile) : en haut de la corniche, juste avant le duel.
    checkpoints: [{ x: 3020, groundY: 300 }],

    exit: { x: 8180, groundY: 470, scootTo: 8180, gag: 'fly', flyTo: { x: 8560, groundY: 230 }, flower: 'door', platform: 0 },

    decor: [
      { type: 'can', x: 360, y: G },
      { type: 'bush', x: 1080, y: G },
      { type: 'mushrooms', x: 2440, y: 640 },
      { type: 'bush', x: 2560, y: 640, flip: true },
      { type: 'lantern', x: 3560, y: 120 },
      { type: 'can', x: 4420, y: 300, flip: true },
      { type: 'bush', x: 4600, y: 300 },
      { type: 'mushrooms', x: 5480, y: 300 },
      { type: 'bush', x: 6420, y: 300, flip: true },
      { type: 'mushrooms', x: 6900, y: G },
      { type: 'bush', x: 7880, y: 470 },
      { type: 'bush', x: 8720, y: 470, flip: true },
      { type: 'fgLeaf', x: 700, y: H },
      { type: 'fgLeaf', x: 2300, y: H, flip: true },
      { type: 'fgLeaf', x: 3900, y: H },
      { type: 'fgLeaf', x: 5400, y: H, flip: true },
      { type: 'fgLeaf', x: 7000, y: H },
      { type: 'fgLeaf', x: 8400, y: H, flip: true }
    ],

    hints: [
      {
        id: 'daze', area: { x: 150, w: 650, yMax: 600 }, after: 14,
        at: { x: 760, y: 330 }, icon: 'eye', text: 'Passe pendant qu’elle est sonnée', solvedRightOf: 830
      },
      {
        id: 'catapult', area: { x: 1000, w: 560, yMax: 600 }, after: 12,
        at: { x: 1480, y: 330 }, icon: 'flower', text: 'Laisse-la te souffler dessus', solvedRightOf: 1940
      },
      {
        id: 'trampoline', area: { x: 2364, w: 536, yMax: 660 }, after: 12,
        at: { x: 2760, y: 380 }, icon: 'up', text: 'Monte sur la grande fleur… et attends', solvedRightOf: 2910
      },
      {
        id: 'duel', area: { x: 2950, w: 710, yMax: 320 }, after: 18,
        at: { x: 4140, y: 120 }, icon: 'eye', text: 'Fais-la éternuer d’abord, de loin', solvedRightOf: 4200
      },
      {
        id: 'suck', area: { x: 4300, w: 420, yMax: 320 }, after: 12,
        at: { x: 4900, y: 120 }, icon: 'flower', text: 'Saute pendant qu’elle aspire', solvedRightOf: 5100
      },
      {
        id: 'shy', area: { x: 5300, w: 560, yMax: 320 }, after: 10,
        at: { x: 5640, y: 110 }, icon: 'eye', text: 'Elle est timide : tourne-lui le dos', solvedRightOf: 6280
      },
      {
        id: 'combo', area: { x: 6800, w: 520, yMax: 600 }, after: 14,
        at: { x: 7230, y: 300 }, icon: 'up', text: 'D’abord la grande fleur, puis le souffle', solvedRightOf: 7720
      },
      {
        id: 'door', area: { x: 7720, w: 1080, yMax: 480 }, after: 12,
        at: { x: 8380, y: 200 }, icon: 'up', text: 'La grande fleur te portera jusqu’à elle', solvedAboveY: 260
      }
    ]
  };
}
