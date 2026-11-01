# NOT SO FAST! — version 2 (Phaser 4)

Refonte complète du jeu avec **Phaser 4.2.1**, **TypeScript strict** et **Vite**. L'ancienne version reste intacte à la racine du dépôt.

- Jouer : `jeu-v2/` (lien GitHub Pages : `…/faux-pas/jeu-v2/`)
- Code source : ce dossier `v2/`

## Commandes

```bash
cd v2
npm install
npm run dev        # serveur de développement
npm run build      # vérification TypeScript + compilation vers ../jeu-v2
```

Tests automatiques (Playwright) :

```bash
(cd jeu-v2 && python3 -m http.server 4173) &
node v2/tests/e2e.mjs          # menu, navigation clavier, physique, mort, pause, fin, sauvegarde
node v2/tests/e2e-extra.mjs    # manette émulée, ressort, plateforme, parcours complet par un robot
```

`F2` en jeu affiche les zones de collision et l'état du joueur (position, vitesse, sol, cœurs, morts).

## Organisation

```text
v2/
├── public/assets/        images (provenance dans CREDITS.md)
├── src/
│   ├── core/             réglages partagés (physique, couleurs, polices)
│   ├── input/            InputManager : clavier, manette, tactile
│   ├── save/             SaveManager : sauvegarde versionnée + reprise de l'ancienne
│   ├── audio/            AudioManager : sons et musiques synthétisés
│   ├── entities/         Player (contrôleur), HeroArt (persos animés)
│   ├── levels/           Terrain (sols, parallaxe), chapter1 (8 niveaux), types
│   ├── traps/            Ch1Traps : pièges à indices (papillons, coccinelles, porte qui fuit, plateforme timide, œils et câbles, stalactites, orage)
│   ├── ui/               boutons, transitions, commandes tactiles, Hints (indications lisibles)
│   └── scenes/           Boot, Menu, Game, Pause, Results
└── tests/
```

## État d'avancement (chapitre 1 « Le Pré des Mensonges », refonte game design V2)

Huit niveaux : 1-1 Le sol est ton ami · 1-2 Fleurs de malheur · 1-3 Solide sous garantie · 1-4 Saute, pour voir… ·
1-5 Pont de confiance · 1-6 Rebondissement ! · 1-7 Un ciel piquant · 1-8 Mégaroc.

Principes :

- Le joueur comprend en regardant : chaque piège se trahit avant d'agir (dalle qui tremble et lâche des cailloux,
  fleur qui se tourne et referme ses pétales, ombre qui grandit, planche sombre et trouée, câble visible entre un
  capteur et ce qu'il déclenche, coccinelle qui saute par-dessus le faux sol, papillon croqué sous tes yeux…).
- Texte : une seule bulle à la fois, opaque, sombre sur clair (≈ 15:1), 24 px (28 px en « Lisibilité renforcée »),
  2 lignes max, posée près de l'élément et jamais sur le personnage. Les panneaux ne servent plus qu'aux gags.
- Après une mort : le niveau est reconstruit, un petit fantôme marque l'endroit, le soleil se moque (une phrase),
  et après 2 morts au même endroit un repère lumineux + un mot apparaissent. Les variantes rendent parfois les choses
  plus simples (porte fatiguée, rocher plus lent), jamais arbitrairement plus dures.
- Option « Lisibilité renforcée » (Paramètres) : textes plus grands, fonds blancs, contours épais, messages plus longs,
  indices renforcés.

Tests : `node v2/tests/chapter1.mjs` (robot qui joue les 7 niveaux + scénarios de pièges + boss),
`node v2/tests/shots.mjs <dossier>` (captures de lisibilité).

Pas encore fait : chapitres 2 à 5, carte du monde, personnalisation ; persos, soleil et Mégaroc dessinés par le code
en attendant les images définitives.
