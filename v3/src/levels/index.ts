import type { ChapterMeta, LevelMeta } from './types';
import { level1_1 } from './chapter1/level1_1';
import { level1_2 } from './chapter1/level1_2';

export const CHAPTERS: ChapterMeta[] = [
  { n: 1, name: 'La Serre des Évidences', palette: [0x8fb59a, 0x7fd1c7, 0xf6b89a, 0xf7d774] },
  { n: 2, name: 'Le Grand Hôtel Mirage', palette: [0x1f2a55, 0xd9b26a, 0xe8b4b8, 0xf6f1e4] },
  { n: 3, name: 'Le Théâtre des Silhouettes', palette: [0x6b1e2e, 0xf3e6cf, 0x1c2233, 0xd4a64a] },
  { n: 4, name: 'La Station des Anomalies', palette: [0x2d3138, 0x3fe0e8, 0xf28c38, 0xf4f6f8] },
  { n: 5, name: "L'Atelier des Hasards", palette: [0x3b1f5e, 0xf2762e, 0xf4efe6, 0x5fd3c6] }
];

const NAMES: string[][] = [
  ['Le chemin trop poli', 'Les fleurs indiscrètes', 'La ronde des escargots', 'Le parapluie rebelle',
    'Les haies susceptibles', 'La fontaine menteuse', 'Le nid des raccourcis', 'Le Jardinier aux mille bras'],
  ['Votre étage, peut-être', 'Bagages incontrôlables', 'La chambre 404', 'Le tapis rouge',
    "Service d'étage", 'Le lustre à crédit', 'Départ obligatoire', 'Le Concierge Parfait'],
  ['Une ombre de vérité', 'Rideau !', 'Les faux figurants', 'Sous les projecteurs',
    'Le décor a deux faces', 'Applaudissements !', "L'entracte impossible", 'Le Marionnettiste'],
  ['Attraction fatale', 'Le plafond est autorisé', 'Trois secondes de trop', 'Colis en fuite',
    'Mon double est idiot', 'Ne touchez à rien', 'Livraison express', 'Contrôleur Zéro'],
  ['Je savais que tu sauterais', 'Un cadeau trop parfait', 'Le montage invisible', 'Le piège qui démissionne',
    'Le bouton de secours', "L'habitude a un prix", 'Le niveau qui se corrige', 'Le Réalisateur']
];

const BUILT: Record<string, LevelMeta['data']> = {
  '1-1': level1_1,
  '1-2': level1_2
};

export const LEVELS: LevelMeta[] = NAMES.flatMap((names, ci) =>
  names.map((name, li) => {
    const id = `${ci + 1}-${li + 1}`;
    return { id, chapter: ci + 1, index: li + 1, name, boss: li === 7, data: BUILT[id] };
  })
);

export const LEVEL_ORDER = LEVELS.map((l) => l.id);

export function levelMeta(id: string): LevelMeta | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelMeta | undefined {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
