# NOT SO FAST!

Jeu de plateforme « troll » pour navigateur : le sol ment, les panneaux mentent, même la mascotte triche.

- **Jouer** : ouvrir `index.html` dans un navigateur (ou le lien GitHub Pages du dépôt).
- 41 niveaux en 5 chapitres + un niveau spécial Halloween, 3 cœurs, boss à phases.
- Clavier, tactile et manette (Xbox / PlayStation).

## Version 3 (Phaser 4) — développement actuel

Nouvelle version écrite de zéro d'après le « prompt maître » : 5 chapitres × 8 niveaux, direction artistique illustrée, pièges qui observent le joueur.

- **Jouer en ligne** : [goekin-57.github.io/faux-pas/jeu-v3/](https://goekin-57.github.io/faux-pas/jeu-v3/)
- **Code source** : `v3/` (Phaser 4 + TypeScript + Vite) — détails dans [v3/README.md](v3/README.md)
- État : écran d'accueil animé, chapitre 1 en cours (niveau 1-1 « Le chemin trop poli » jouable), clavier, tactile et manette.

## Version 2 (Phaser 4) — essai précédent

Refonte complète dans `v2/` (code TypeScript) et `jeu-v2/` (jeu compilé, jouable sur GitHub Pages). Détails et état d'avancement : [v2/README.md](v2/README.md).

## Fichiers

- `index.html` : le jeu complet (un seul fichier, HTML + JavaScript, dessin sur canvas).
- `outils/robot.js` : test automatique. `node outils/robot.js index.html all` fait jouer un robot sur tous les niveaux et vérifie qu'ils sont tous faisables.

## Graphismes

- **Chapitre 1** : images uniques créées pour le jeu (dossier `images/chapitre-1`), préparées par `outils/habillage/art.py` (détourage, découpe, raccords) et intégrées dans `index.html`.
- L'ennemi escargot vient encore du **New Platformer Pack** de [Kenney](https://kenney.nl/assets/new-platformer-pack) (licence CC0).
- Les autres chapitres gardent le dessin d'origine pour l'instant.
- Dans Paramètres, « Graphismes : nouveaux / classiques » permet de comparer.

## Version Phaser (WebGL)

`phaser/index.html` est le même jeu, avec le moteur **Phaser 3.90** pour l'affichage du chapitre 1 : décor en parallaxe sur deux plans, sol et pics dessinés en WebGL, poussière à l'atterrissage, éclats quand un bloc piégé tombe, étincelles sur les pièces, vignette. La physique et les pièges restent ceux du jeu d'origine. Elle se régénère avec `python3 outils/build-phaser.py`.

## Remarque

Le classement en ligne fonctionne seulement dans la version publiée sur Claude. Ici il s'affiche hors ligne.
