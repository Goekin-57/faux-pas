import type { LevelData, TerrainDef } from '../types';
import { buildManorScript } from '../../halloween/script';
import { H, WIDTH } from '../../halloween/layout';

/**
 * BONUS HALLOWEEN — LE MANOIR DES TROUILLARDS
 * Un manoir qui observe le héros et tente de lui faire peur… avec des occupants très maladroits.
 *
 *  1. La cour des citrouilles   : citrouille curieuse (dos tourné), citrouille roulante qui devient
 *                                 une marche, gardienne qui ouvre la porte en tombant.
 *  2. Le grand hall hanté       : fantôme-portier solide le temps d'un « Bouh », lustre lancé par un
 *                                 fantôme maladroit, escalier farceur.
 *  3. La galerie des portraits  : portrait qui prévient (plancher instable), tableau menteur qui révèle
 *                                 le vrai chemin, bibliothèque vivante. Point de contrôle (Facile).
 *  4. Le couloir des ombres     : plateformes d'ombre solides seulement dans le noir (bougie, lanterne),
 *                                 toile d'araignée qui renvoie vers le haut, combinaison finale.
 *  5. Le couloir interdit       : LE MONSTRE QUI A PEUR DE TOI (fuite, mécanismes déclenchés, cachette).
 *  6. L'antichambre             : trois portes, trois indices (sortie trop accueillante, bougies qui
 *                                 s'éteignent, griffures).
 *  7. La salle de bal           : le Roi Citrouille, battu par ses propres attaques. Sortie dans la forêt.
 */

const t = (x: number, top: number, w: number, style: TerrainDef['style'], h?: number): TerrainDef => ({ x, top, w, style, h });

export function halloween(): LevelData {
  return {
    id: 'H-1',
    theme: 'manor',
    bonus: true,
    script: buildManorScript,
    chapter: 0,
    index: 1,
    name: 'Le Manoir des Trouillards',
    signature: 'Le manoir veut te faire peur… mais ses occupants ont encore plus peur que toi.',
    width: WIDTH,
    height: H,
    spawn: { x: 160, y: 570 },

    terrain: [
      // 1. cour
      t(0, 600, 960, 'stone'),
      t(960, 550, 70, 'stone'),           // la pierre (rebond de la citrouille)
      t(1030, 600, 330, 'stone'),
      t(1360, 380, 80, 'wall'),           // muret infranchissable sans la citrouille
      t(1440, 600, 120, 'stone'),
      t(1560, 540, 150, 'stone'),         // perron
      t(1690, -400, 22, 'wall', 772),     // façade au-dessus de la porte
      // 2. grand hall
      t(1710, 600, 790, 'floor'),
      t(2200, 420, 300, 'floor', 40),     // balcon (atteint en sautant sur le fantôme)
      t(2500, 420, 200, 'floor'),
      t(3300, 420, 360, 'floor'),         // pied de l'escalier farceur
      t(3660, 250, 230, 'floor'),         // coursive
      // 3. galerie
      t(3890, 460, 530, 'floor'),
      t(4420, 580, 100, 'floor'),         // petite fosse sous la latte piégée
      t(4520, 460, 400, 'floor'),
      t(5420, 460, 410, 'floor'),
      t(5830, 230, 560, 'floor'),         // salle sûre (point de contrôle)
      // 4. couloir des ombres
      t(6390, 520, 270, 'floor'),
      t(6660, 680, 280, 'floor'),         // fossé sans danger
      t(6660, 610, 50, 'wall'),
      t(6890, 610, 50, 'wall'),
      t(6940, 520, 200, 'floor'),
      t(7700, 520, 300, 'floor'),
      t(8000, 620, 250, 'wall'),          // sous la toile
      t(8250, 360, 200, 'floor'),
      t(8450, 640, 350, 'wall'),          // sous la seconde toile
      t(8800, 360, 260, 'floor'),
      // 5. couloir interdit
      t(9060, 520, 990, 'floor'),
      t(10350, 520, 250, 'floor'),
      t(10950, 520, 2250, 'floor'),       // jusqu'au bout de l'antichambre
      t(13200, -400, 60, 'wall', 1400),
      // 7. salle de bal + forêt
      t(13260, 560, 2640, 'floor'),
      t(15900, 560, 1160, 'stone'),
      t(17060, -400, 60, 'wall', 1400),
      // salles secrètes (portes A et B)
      t(17900, -400, 60, 'wall', 1400),
      t(17960, 520, 800, 'floor'),
      t(18760, -400, 60, 'wall', 1400),
      t(19000, -400, 60, 'wall', 1400),
      t(19060, 520, 250, 'floor'),
      t(19810, 520, 400, 'floor'),
      t(20210, -400, 60, 'wall', 1400)
    ],

    stones: [],
    snappers: [],

    thorns: [
      { x: 2700, w: 600, top: 860 },
      { x: 4920, w: 500, top: 860 },
      { x: 7140, w: 560, top: 860 },
      { x: 10050, w: 300, top: 860 },
      { x: 10600, w: 350, top: 860 },
      { x: 19310, w: 500, top: 860 }
    ],

    // Facile : un seul point de contrôle, dans la petite salle sûre après la galerie. Aucun en Expert.
    checkpoints: [{ x: 5960, groundY: 230 }],

    exit: { x: 16860, groundY: 560, scootTo: 16860, gag: 'none' },

    decor: [],

    hints: [
      { id: 'h-roll', area: { x: 1030, w: 330, yMax: 640 }, after: 16, at: { x: 1250, y: 300 }, icon: 'eye', text: 'Elle pourrait servir de marche…', solvedAboveY: 400 },
      { id: 'h-ghost', area: { x: 1900, w: 300, yMax: 640 }, after: 14, at: { x: 2100, y: 360 }, icon: 'up', text: 'Saute sur lui quand il devient solide', solvedAboveY: 440 },
      { id: 'h-chand', area: { x: 2500, w: 200, yMax: 440 }, after: 12, at: { x: 2900, y: 250 }, icon: 'wait', text: 'Attends que le lustre se rapproche', solvedRightOf: 3300 },
      { id: 'h-paint', area: { x: 4520, w: 400, yMax: 480 }, after: 14, at: { x: 4720, y: 110 }, icon: 'eye', text: 'Le tableau montre le vrai chemin', solvedRightOf: 5420 },
      { id: 'h-books', area: { x: 5420, w: 410, yMax: 480 }, after: 14, at: { x: 5640, y: 90 }, icon: 'wait', text: 'Les livres actionnent l’étagère', solvedAboveY: 240 },
      { id: 'h-shadow', area: { x: 6390, w: 750, yMax: 700 }, after: 14, at: { x: 6800, y: 260 }, icon: 'eye', text: 'Les ombres ne sont solides que dans le noir', solvedRightOf: 7700 },
      { id: 'h-web', area: { x: 7700, w: 300, yMax: 560 }, after: 12, at: { x: 8125, y: 280 }, icon: 'up', text: 'Laisse-toi tomber dans la toile', solvedRightOf: 8260 },
      { id: 'h-monster', area: { x: 10950, w: 250, yMax: 560 }, after: 12, at: { x: 11100, y: 170 }, icon: 'wait', text: 'Il a peur ! Approche doucement… ou par en haut', solvedRightOf: 11500 },
      { id: 'h-doors', area: { x: 11600, w: 1600, yMax: 560 }, after: 25, at: { x: 12400, y: 110 }, icon: 'eye', text: 'Observe les portes : bougies, griffures…', solvedRightOf: 13300 }
    ]
  };
}
