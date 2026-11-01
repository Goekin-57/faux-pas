# NOT SO FAST!

Jeu de plateforme 2D « troll » où le monde observe le joueur et retourne ses habitudes contre lui.
Phaser 4 · TypeScript · Vite · 100 % gratuit (aucun asset externe : illustrations SVG/Canvas et sons Web Audio générés par le code).

## Lancer le jeu

- Jouer en ligne : `jeu-v3/` (GitHub Pages : https://goekin-57.github.io/faux-pas/jeu-v3/)
- Code source : ce dossier `v3/`

```bash
cd v3
npm install
npm run dev      # http://localhost:5173
npm run build    # ../jeu-v3/index.html : le jeu complet en un seul fichier
```

Accès direct à un niveau : `?level=1-1`.

## Commandes

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer | ← → ou Q / D (A / D en QWERTY) | Stick gauche ou croix |
| Sauter (hauteur variable) | Espace, Z, ↑ | A (ou B) |
| Pause / reprendre | Échap ou P | Start (B reprend aussi) |
| Recommencer le niveau | R | Select / Back |
| Menus | ↑ ↓, Entrée | Croix ou stick, A valider, B retour |
| Couper le son | M | |

Sur mobile, des boutons tactiles apparaissent automatiquement (réglable dans Options).
Les manettes (disposition standard : Xbox, PlayStation, Switch Pro, génériques) sont reconnues dès qu'on les branche, partout dans le jeu.

## État actuel

- Architecture complète pour 5 chapitres × 8 niveaux (registre des 40 niveaux, sélection, sauvegarde).
- Direction artistique du chapitre 1 « La Serre des Évidences ».
- **Niveaux 1-1 « Le chemin trop poli » et 1-2 « Les fleurs indiscrètes » entièrement jouables.**
- **Deux difficultés (v0.5)** : Facile (pièges lisibles, 1 point de contrôle) et Expert (pièges plus rapides qui anticipent sauts et hésitations, aucun point de contrôle). Choix au premier lancement, modifiable dans les Options ou en pause ; records séparés. Détails : `docs/MECANIQUES.md`.
- Tutoriel des commandes au premier niveau joué (clavier, manette ou tactile, détecté automatiquement).
- Indices contextuels discrets si le joueur reste bloqué.
- Rendu haute résolution : le canevas suit l'écran (Full HD, 1440p, 4K) et les illustrations sont repeintes à cette résolution (`src/core/Display.ts`).
- Menu, sélection des chapitres, options (volumes, muet, tactile, effacement de sauvegarde), crédits.
- HUD discret, pause, écran de victoire, records en localStorage.

## Architecture

```
src/
  main.ts                 configuration Phaser
  core/
    constants.ts          réglages physiques ("feeling"), palettes, profondeurs
    Controls.ts           clavier AZERTY/QWERTY + manette + tactile
    Audio.ts              sons et musique générative en Web Audio
    Save.ts               sauvegarde localStorage (protégée)
    Bus.ts                événements jeu ↔ interface
    Pad.ts                manette (API Gamepad du navigateur, lecture à fronts)
    CameraRig.ts          caméra stable : amortie, calée sur le sol, sans secousse
    Difficulty.ts         réglages Facile / Expert (comportements des pièges)
  art/
    svg.ts                illustrations SVG (héros, accessoires, porte, plante…)
    paint.ts              peintres Canvas (terrains, décors, pavés, ronces)
    textures.ts           rasterisation + textures du chapitre
    Backdrop.ts           décor en couches (parallaxe, rayons, pollen, vignette)
  player/Player.ts        contrôleur (coyote time, jump buffer, saut variable) + rig animé
  traps/
    Trap.ts               contrat commun : machine à états, reset, gag de mort
    ShyStone.ts           pavé qui réagit à l'hésitation (+ variante ascenseur à sablier)
    PrankStone.ts         pavé farceur à ressort (accroche du 1-1)
    Sneezer.ts            fleur indiscrète : observe, inspire, éternue (+ sournoise, aspirante, timide)
    Snapper.ts            Dionée suspendue (rythmique, ou « maladroite » : bouton + grille)
    Raft.ts               radeau à voile poussé par un éternuement (piège en chaîne)
    LeafPlatform.ts       plateforme-feuille suspendue (mobile en Expert)
    HollowLog.ts          tronc creux du faux raccourci
    Checkpoint.ts         bourgeon qui éclot
    ExitDoor.ts           porte de sortie (esquiveuse au 1-1, volante au 1-2)
  levels/
    types.ts              format de données d'un niveau
    index.ts              registre des 40 niveaux et des 5 chapitres
    chapter1/level1_1.ts  niveau 1-1, composé à la main
    chapter1/level1_2.ts  niveau 1-2
  menu/                   écran d'accueil : décor en parallaxe, logo peint, menu, scène interactive
  scenes/                 Boot, Menu, Game, HUD
  ui/Button.ts            boutons + navigation clavier
docs/MECANIQUES.md        matrice des mécaniques (anti-répétition)
```

### Ajouter un niveau

1. Créer `src/levels/chapterN/levelN_M.ts` qui retourne un `LevelData`.
2. Le référencer dans `BUILT` (`src/levels/index.ts`).
3. Si le niveau introduit une mécanique, créer un piège dans `src/traps/` qui implémente `Trap`.

## Licences

- Phaser : MIT.
- Polices Bagel Fat One et Fredoka : SIL Open Font License (chargées depuis Google Fonts).
- Tout le reste (graphismes, sons, musique) est original et généré par le code du projet.
