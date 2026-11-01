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
│   ├── levels/           Terrain (sols, parallaxe), level1 (données du niveau)
│   ├── traps/            pièges modulaires
│   ├── ui/               boutons, transitions, commandes tactiles
│   └── scenes/           Boot, Menu, Game, Pause, Results
└── tests/
```

## État d'avancement (phase 2 : tranche verticale)

Fait et vérifié par les tests :

- Menu principal vivant : ciel, rayons de soleil, deux plans de parallaxe, fleurs et arbre qui bougent, oiseaux, papillons, escargot qui se cache quand un pic sort, perso animé (respiration, clignement, regard, petit saut, surprise), logo animé dont le « F » trébuche.
- Boutons : Continuer/Jouer, Nouvelle partie (avec confirmation), Paramètres (volumes, réduction des effets, tremblements), Statistiques. Souris, clavier, manette, tactile.
- Niveau 1-1 complet et court (≈ 3 600 px) : pas de barre de vie affichée, mais un ennemi ne tue pas d'un coup (3 coups ; un pansement apparaît sur le perso à chaque coup), invulnérabilité 1,4 s, drapeau de sauvegarde, pièces, écran de résultats avec étoiles, sauvegarde.
- Un gag différent à chaque étape, sans répétition : trou → faux sol fissuré → pics cachés (l'herbe tremble) → escargot → ressort paresseux → pics qui déménagent après une mort → fleur qui mord → fausse sortie en carton qui tombe et devient un pont. Zone de commandes inversées prête (machine à états avec hystérésis), gardée pour un autre niveau.
- Physique d'origine : gravité 1800, saut 620, vitesse 260, coyote time, saut mémorisé, saut variable.
- Pause (Échap / Start), recommencer (R / Y), conseils après plusieurs morts au même endroit.

Pas encore fait :

- Carte du monde, personnalisation (boutons affichés « bientôt », désactivés).
- Niveaux 1-2 à 5-8, boss, Halloween.
- Persos et soleil : dessinés par le code en attendant les images définitives. L'escargot vient du pack Kenney (CC0).
