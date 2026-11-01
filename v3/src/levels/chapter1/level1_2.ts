import type { LevelData } from '../types';

/**
 * 1-2 — LES FLEURS INDISCRÈTES
 * Signature : un danger directionnel (l'éternuement) devient un moyen de déplacement.
 *
 * Règles apprises dans ce niveau :
 *  - une fleur qui te VOIT se concentre (yeux, pollen aspiré, reniflements), inspire, puis éternue ;
 *  - le souffle part toujours du même côté (celui vers lequel la fleur est tournée) ;
 *  - après un éternuement, elle est SONNÉE quelques secondes : elle ne voit plus rien.
 *
 * 1. Découverte  : une fleur te repousse (sans danger). Il faut passer pendant qu'elle est sonnée.
 * 2. Catapulte   : un fossé trop large pour sauter. La fleur tournée vers le vide est la solution.
 * 3. Trampoline  : une fleur géante tournée vers le ciel. Sa corolle est un plateau ; elle louche
 *                  vers toi… et t'envoie sur la corniche.
 * 4. Le duel     : en face du fossé, une fleur lilas voit très loin. Si tu traverses sans l'avoir
 *                  fait éternuer d'abord, elle te renvoie dans le vide à l'atterrissage.
 * 5. Final       : la fleur du sol te pousse… droit dans le mur. Il faut d'abord monter sur la
 *                  géante : en l'air, le souffle te porte au-dessus du fossé. Puis un petit portier
 *                  te repousse si tu traînes devant la porte.
 */

const H = 1000;
const G = 560;

export function level1_2(): LevelData {
  return {
    id: '1-2',
    chapter: 1,
    index: 2,
    name: 'Les fleurs indiscrètes',
    signature: 'Un danger directionnel (l’éternuement) devient un moyen de déplacement.',
    width: 6720,
    height: H,
    spawn: { x: 140, y: G - 30 },

    terrain: [
      { x: 0, top: G, w: 1560 },        // 1. découverte + élan de la catapulte
      { x: 1940, top: 640, w: 960 },    // 2. réception (plus basse) + pied du trampoline
      { x: 2900, top: 300, w: 760 },    // 3. corniche haute (le mur fait 340 px : impossible à sauter)
      { x: 3980, top: 300, w: 740 },    // 4. rive de la fleur lilas
      { x: 4720, top: G, w: 520 },      // 5. jardin bas du final
      { x: 5640, top: 470, w: 1080 }    //    corniche de la sortie
    ],

    stones: [],

    thorns: [
      { x: 1560, w: 380, top: 840 },
      { x: 3660, w: 320, top: 840 },
      { x: 5240, w: 400, top: 840 }
    ],

    snappers: [],

    flowers: [
      // 1. tournée vers le joueur qui arrive : elle repousse, puis reste sonnée
      { x: 760, groundY: G, blow: 'left', view: 540, palette: 'peach' },
      // 2. tournée vers le fossé : la catapulte
      { x: 1380, groundY: G, blow: 'right', view: 260, palette: 'sun' },
      // 3. géante tournée vers le ciel : le trampoline
      { x: 2760, groundY: 640, blow: 'up', size: 'giant', palette: 'coral', stare: 0.8 },
      // 4. le duel : A propulse, B (lilas) voit de très loin mais lentement, et reste sonnée longtemps
      { x: 3560, groundY: 300, blow: 'right', view: 280, palette: 'peach' },
      { x: 4140, groundY: 300, blow: 'left', view: 760, reach: 400, stare: 1.6, daze: 3.6, palette: 'lilac' },
      // 5. final : E pousse dans le mur si on est au sol… mais porte loin si on est en l'air
      { x: 5000, groundY: G, blow: 'right', view: 300, height: 420, stare: 1.6, power: 1.2, palette: 'sun' },
      { x: 5150, groundY: G, blow: 'up', size: 'giant', palette: 'coral', stare: 0.7, daze: 1.8 },
      //    le portier, devant la porte
      { x: 6260, groundY: 470, blow: 'left', size: 'small', view: 300, palette: 'coral' }
    ],

    // Un seul point de contrôle : en haut de la corniche, juste avant le duel (la partie qu'on
    // rate le plus). La catapulte et le trampoline, une fois compris, ne sont pas à refaire.
    checkpoints: [{ x: 3020, groundY: 300 }],

    exit: { x: 6440, groundY: 470, scootTo: 6440, gag: 'none' },

    decor: [
      { type: 'can', x: 360, y: G },
      { type: 'bush', x: 1080, y: G },
      { type: 'mushrooms', x: 2080, y: 640 },
      { type: 'bush', x: 2420, y: 640, flip: true },
      { type: 'lantern', x: 3200, y: 120 },
      { type: 'bush', x: 3300, y: 300 },
      { type: 'can', x: 4420, y: 300, flip: true },
      { type: 'bush', x: 4600, y: 300 },
      { type: 'mushrooms', x: 4800, y: G },
      { type: 'bush', x: 5900, y: 470 },
      { type: 'bush', x: 6620, y: 470, flip: true },
      { type: 'fgLeaf', x: 700, y: H },
      { type: 'fgLeaf', x: 2300, y: H, flip: true },
      { type: 'fgLeaf', x: 3900, y: H },
      { type: 'fgLeaf', x: 5400, y: H, flip: true }
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
        id: 'trampoline', area: { x: 1940, w: 960, yMax: 660 }, after: 12,
        at: { x: 2760, y: 380 }, icon: 'up', text: 'Monte sur la grande fleur… et attends', solvedRightOf: 2910
      },
      {
        id: 'duel', area: { x: 2950, w: 710, yMax: 320 }, after: 18,
        at: { x: 4140, y: 120 }, icon: 'eye', text: 'Fais-la éternuer d’abord, de loin', solvedRightOf: 4200
      },
      {
        id: 'combo', area: { x: 4720, w: 520, yMax: 600 }, after: 14,
        at: { x: 5150, y: 300 }, icon: 'up', text: 'D’abord la grande fleur, puis le souffle', solvedRightOf: 5640
      }
    ]
  };
}
