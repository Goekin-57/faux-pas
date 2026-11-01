import { Save, type Difficulty } from './Save';

/**
 * Réglages par difficulté.
 *
 * FACILE  : les pièges du jeu tels qu'ils ont été conçus — lisibles, un seul point de contrôle.
 * EXPERT  : pas seulement plus rapide. Les pièges observent le joueur : ils anticipent les sauts
 *           (la fleur sournoise retient son éternuement, la porte esquive les sauts), punissent les
 *           hésitations (les Dionées frappent plus tôt si on campe à côté d'elles) et suivent le
 *           joueur (la Dionée maladroite le vise jusqu'au dernier moment). Aucun point de contrôle.
 *
 * Règle commune : un piège Expert reste lisible. Les indices sont plus discrets, jamais absents.
 */
export interface Tuning {
  id: Difficulty;
  label: string;
  /** Pavés polis : immobilité avant le premier signe, puis durée de l'avertissement. */
  stoneHesitation: number;
  stoneWarn: number;
  /** Pavé farceur : s'enfonce dès l'atterrissage (Expert) au lieu d'attendre l'hésitation. */
  prankOnLanding: boolean;
  /** Dionées : repos et réveil (anticipation visible). */
  snapperRest: number;
  snapperWake: number;
  /** Expert : une Dionée frappe plus tôt quand on attend juste à côté d'elle. */
  snapperPunishCamping: boolean;
  /** Dionée maladroite : suit le joueur pendant son réveil (Expert) ou vise l'endroit où il était (Facile). */
  lureTracks: boolean;
  /** Fleurs : multiplicateur du temps d'observation, durée de l'inspiration. */
  flowerStare: number;
  flowerInhale: number;
  /** Fleur sournoise : durée max pendant laquelle elle retient son éternuement si le joueur est en l'air. */
  slyHold: number;
  /** Fleur aspirante : aspiration au sol (doit rester < vitesse de course : on peut toujours résister). */
  suckGround: number;
  /** Porte de 1-1 : vitesse au-delà de laquelle elle esquive ; abandon après N esquives (0 = jamais). */
  doorSpeed: number;
  doorGiveUp: number;
  doorDodgesJumps: boolean;
  /** Porte volante (1-2) : sa plateforme bouge. */
  movingDoorPlatform: boolean;
  checkpoints: boolean;
  /** Les indices contextuels apparaissent plus tard (mais apparaissent). */
  hintDelay: number;
}

export const TUNING: Record<Difficulty, Tuning> = {
  easy: {
    id: 'easy',
    label: 'Facile',
    stoneHesitation: 0.45,
    stoneWarn: 0.7,
    prankOnLanding: false,
    snapperRest: 1.5,
    snapperWake: 0.65,
    snapperPunishCamping: false,
    lureTracks: false,
    flowerStare: 1,
    flowerInhale: 0.65,
    slyHold: 0.25,
    suckGround: 150,
    doorSpeed: 210,
    doorGiveUp: 3,
    doorDodgesJumps: false,
    movingDoorPlatform: false,
    checkpoints: true,
    hintDelay: 1
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    stoneHesitation: 0.32,
    stoneWarn: 0.5,
    prankOnLanding: true,
    snapperRest: 1.2,
    snapperWake: 0.5,
    snapperPunishCamping: true,
    lureTracks: true,
    flowerStare: 0.8,
    flowerInhale: 0.5,
    slyHold: 1.0,
    suckGround: 210,
    doorSpeed: 170,
    doorGiveUp: 0,
    doorDodgesJumps: true,
    movingDoorPlatform: true,
    checkpoints: false,
    hintDelay: 1.6
  }
};

/** Réglages de la difficulté en cours (lus au moment où on en a besoin : un changement s'applique au prochain niveau). */
export function tuning(): Tuning {
  return TUNING[Save.difficulty];
}
