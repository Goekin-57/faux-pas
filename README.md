# Faux Pas

Jeu de plateforme « troll » pour navigateur : le sol ment, les panneaux mentent, même la mascotte triche.

- **Jouer** : ouvrir `index.html` dans un navigateur (ou le lien GitHub Pages du dépôt).
- 41 niveaux en 5 chapitres + un niveau spécial Halloween, 3 cœurs, boss à phases.
- Clavier, tactile et manette (Xbox / PlayStation).

## Fichiers

- `index.html` : le jeu complet (un seul fichier, HTML + JavaScript, dessin sur canvas).
- `outils/robot.js` : test automatique. `node outils/robot.js index.html all` fait jouer un robot sur tous les niveaux et vérifie qu'ils sont tous faisables.

## Graphismes

Le chapitre 1 utilise les images du **New Platformer Pack** de [Kenney](https://kenney.nl/assets/new-platformer-pack), sous licence CC0 (usage libre, même commercial). Elles sont intégrées dans `index.html` sous forme d'un seul atlas. Les autres chapitres gardent le dessin d'origine pour l'instant.
Dans Paramètres, « Graphismes : nouveaux / classiques » permet de comparer les deux rendus.

## Remarque

Le classement en ligne fonctionne seulement dans la version publiée sur Claude. Ici il s'affiche hors ligne.
