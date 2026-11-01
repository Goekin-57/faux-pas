# Matrice des mécaniques — 40 niveaux

Objectif : vérifier, avant de produire les niveaux, qu'aucun ne recycle une mécanique sous un autre habillage.
Colonne « Ce qui déclenche » = le comportement du joueur que le monde observe. Deux niveaux qui observent
la même chose ET y répondent de la même façon sont des doublons.

Légende intelligence : **R** réagit · **E** exploite une attente · **P** manipule la perception · **C** combine des systèmes · **A** anticipe.

| Niv. | Titre | Ce qui déclenche | Réponse du monde | Int. | Statut |
|---|---|---|---|---|---|
| 1-1 | Le chemin trop poli | Immobilité (hésitation) | Le sol cède, ou sert d'ascenseur si on hésite exprès | R | ✅ jouable |
| 1-2 | Les fleurs indiscrètes | Être regardé longtemps (distance + durée) | Éternuement directionnel = poussée exploitable | R | ✅ jouable |
| 1-3 | La ronde des escargots | Saut à la verticale d'une créature | La créature se rétracte = plateforme temporaire | R | |
| 1-4 | Le parapluie rebelle | Aucun (accumulation de pluie, temps) | Bascule brutale de la géométrie, annoncée par l'inclinaison | R | |
| 1-5 | Les haies susceptibles | Intensité du mouvement (accélération, saut brusque) | Fermeture des haies ; le calme ouvre | R | |
| 1-6 | La fontaine menteuse | Ordre d'utilisation des jets | Trajectoires dictées par l'orientation de la buse, pas par la forme du jet | E | |
| 1-7 | Le nid des raccourcis | Itinéraire apparent du joueur | L'oiseau vole la plateforme visée ; on peut l'attirer pour créer un passage | A | |
| 1-8 | Le Jardinier aux mille bras | Position dans l'arène | Bras/arrosoirs annoncés ; retourner l'arrosage contre lui | C | boss |
| 2-1 | Votre étage, peut-être | Voyants au sol activés | Les ascenseurs suivent les voyants, pas les boutons | E | |
| 2-2 | Bagages incontrôlables | Sens d'approche (poursuite / obstruction) | Valises qui fuient ou s'arrêtent → plateformes mobiles | E | |
| 2-3 | La chambre 404 | Porte empruntée | Topologie non euclidienne, indices par décor et son | P | |
| 2-4 | Le tapis rouge | Position sur la surface | Vitesse variable du tapis, ondulations annonciatrices | E | |
| 2-5 | Service d'étage | Clochettes sonnées | Chariot-automate déplacé, charge instable | C | |
| 2-6 | Le lustre à crédit | Répartition du poids | Lustres liés par poulies (montée/descente couplées) | C | |
| 2-7 | Départ obligatoire | Couloirs déjà empruntés | Fermetures annoncées : planifier un parcours à sens unique | A | |
| 2-8 | Le Concierge Parfait | Déplacements préférés | Il anticipe ; il faut feinter une intention | A | boss |
| 3-1 | Une ombre de vérité | Lecture des projections | Plateformes réelles révélées par les ombres | P | |
| 3-2 | Rideau ! | Timing de traversée | Visibilité changeante, tension du tissu = ouvertures | P | |
| 3-3 | Les faux figurants | Direction du regard du personnage | Silhouettes qui se déplient / deviennent traversables | P | |
| 3-4 | Sous les projecteurs | Couleur de lumière sur l'objet | Propriétés physiques changées (motif + animation, jamais couleur seule) | P | |
| 3-5 | Le décor a deux faces | Rotation provoquée | Faces avant/arrière aux collisions différentes | C | |
| 3-6 | Applaudissements ! | Rythme musical | ⚠ voir note 1 | C | |
| 3-7 | L'entracte impossible | Signaux musicaux | Recomposition complète de la scène, zones fixes repérables | P | |
| 3-8 | Le Marionnettiste | Fils désactivés | Le boss change de stratégie selon les fils restants | C | boss |
| 4-1 | Attraction fatale | Capteurs occupés | Aimants mobiles déplacent les plateformes | C | |
| 4-2 | Le plafond est autorisé | Entrée dans un champ | Gravité locale réorientée | C | |
| 4-3 | Trois secondes de trop | Moment de la capture | Un état physique est figé (pas ralenti) | C | |
| 4-4 | Colis en fuite | Capteurs logistiques | Conteneurs qui cherchent leur destination ; on les réoriente | C | ⚠ note 2 |
| 4-5 | Mon double est idiot | Trajectoire enregistrée | Double qui rejoue en différé | C | |
| 4-6 | Ne touchez à rien | Relâchement d'un interrupteur | Activation au départ, pas à l'appui | E | |
| 4-7 | Livraison express | Décisions rapides | Embranchements qui se ferment selon la vitesse | C | |
| 4-8 | Contrôleur Zéro | Séquences de contrôle | Prédiction exploitable par un défaut | A | boss |
| 5-1 | Je savais que tu sauterais | Moment du saut devant un obstacle | Plateforme déplacée si le timing se répète | A | ⚠ note 3 |
| 5-2 | Un cadeau trop parfait | Choix du bonus séduisant | Modules suivants réorganisés (jamais bloquant) | A | |
| 5-3 | Le montage invisible | Ce qui sort du champ caméra | Le décor change hors champ, raccords visibles | P | |
| 5-4 | Le piège qui démissionne | Se placer « comme prévu » | Le danger refuse d'agir ; on le convainc pour s'en servir | E | |
| 5-5 | Le bouton de secours | Bouton choisi | Câblage visible ≠ convention visuelle | P | |
| 5-6 | L'habitude a un prix | Profil récent (vitesse, anticipation…) | Piège choisi parmi plusieurs réponses, toutes évitables | A | ⚠ note 3 |
| 5-7 | Le niveau qui se corrige | Chemins déjà parcourus | Réécriture derrière le joueur qui OUVRE de nouveaux passages | A | ⚠ note 4 |
| 5-8 | Le Réalisateur | Tout ce qui précède | Contrôle → prédiction → improvisation | A | boss final |

## Doublons fonctionnels détectés et corrections proposées

1. **1-2 et 3-6 poussent tous deux le joueur avec de l'air.** Proposition : en 3-6, les applaudissements
   n'envoient plus de souffle ; ils font *sauter les planches de la scène* en rythme (plateformes qui montent sur le temps fort).
   On conserve l'intention (plateforme synchronisée à la musique) sans répéter l'éternuement.
2. **2-2 et 4-4 transforment des objets autonomes en plateformes.** Distinction à garder stricte :
   en 2-2 l'objet réagit à *la façon dont on l'approche* ; en 4-4 il poursuit *une destination* que l'on modifie via les capteurs
   (puzzle de routage, pas de poursuite).
3. **5-1 et 5-6 détectent tous deux une habitude.** 5-1 n'observe qu'une variable (le timing du saut) et y répond toujours de la même
   manière ; 5-6 construit un profil sur plusieurs comportements et choisit entre plusieurs pièges. Le boss 5-8 peut réutiliser les deux.
4. **2-7 et 5-7 modifient le parcours selon le chemin déjà suivi.** 2-7 *ferme* (planification, choix irréversibles annoncés) ;
   5-7 *réécrit et ouvre* (il faut se servir des modifications). Ne jamais faire de 5-7 une simple fuite.

## Contraste volontaire

1-1 (« continue à bouger ») et 1-5 (« ne fonce pas ») observent toutes deux la façon de bouger, mais demandent des
comportements opposés : c'est voulu, 1-5 casse le réflexe appris en 1-1.


## Règles de conception des pièges (« trolls »)

Un bon piège de NOT SO FAST! se comprend **après** l'échec, jamais grâce à un panneau :

1. **Observable** : chaque piège montre son état (yeux, tremblement, sablier, pollen, son). Rien ne tue sans avoir été visible.
2. **Déterministe** : mêmes actions → même résultat. Aucune part de hasard dans le comportement.
3. **Retournable** : le danger est presque toujours aussi la solution (le pavé qui cède devient un ascenseur ; l'éternuement devient une catapulte).
4. **Une idée neuve par niveau**, déclinée en 3 à 5 situations différentes, sans « sol qui disparaît » ni « pics surprise » recyclés.
5. **Le second piège est le vrai** : la surprise vient souvent d'un élément qu'on croyait déjà compris (la fleur lilas « inoffensive » du 1-2, la fleur du sol qui « aide » mais pousse dans le mur).

Progression de l'intelligence : ch.1 réagit à un comportement simple → ch.2 exploite une habitude → ch.3 trompe la perception →
ch.4 combine plusieurs systèmes → ch.5 observe le joueur et tente de prédire ses décisions.

## Difficultés (v0.5)

| | Facile | Expert |
|---|---|---|
| Points de contrôle | 1 au maximum par niveau | aucun (retour au début du niveau) |
| Pavés polis | 0,45 s d'hésitation + 0,7 s d'avertissement | 0,32 s + 0,5 s |
| Pavé farceur | s'enfonce si on hésite | s'enfonce dès qu'on atterrit |
| Dionées rythmiques | repos 1,5 s, réveil 0,65 s | repos 1,2 s, réveil 0,5 s ; **frappent plus tôt si on attend juste à côté** (hésitation) |
| Dionée maladroite | vise le bouton | **suit le joueur et anticipe sa course**, verrouille sa cible 0,3 s avant (petit « tic ») |
| Fleurs | observation ×1, inspiration 0,65 s | observation ×0,8, inspiration 0,5 s (sauf le combo du 1-2, réglé au centième) |
| Fleur sournoise | retient son éternuement 0,25 s max si on saute | 1 s ; **un saut dans son champ l'excite** |
| Fleur aspirante | aspiration au sol 150 px/s | 210 px/s (toujours < vitesse de course : on peut résister) |
| Porte esquiveuse | esquive au-delà de 210 px/s, abandonne après 3 esquives | 170 px/s, **esquive aussi les sauts**, n'abandonne jamais |
| Porte volante | plateforme fixe | plateforme qui se balance |
| Indices contextuels | après le délai prévu | délai ×1,6 (plus discrets, toujours présents) |
| Combinaison en plus | — | 1-1 : une Dionée au-dessus du chemin trop poli |

Sauvegarde : records (temps, morts) séparés par difficulté ; les déblocages sont communs.
Une ancienne sauvegarde passe en Facile sans écran imposé ; un nouveau joueur choisit au premier lancement.
Changer de difficulté en cours de niveau demande confirmation et recommence le niveau.

## 1-1 « Le chemin trop poli » — les cinq moments (v0.5)

| Moment | Situation | Ce que le joueur apprend |
|---|---|---|
| Accroche (≈ 5 s) | Le **pavé farceur** : il s'enfonce si on hésite, puis catapulte si on saute. Fossé sans danger | Le sol réagit à ce qu'on fait — et c'est drôle, pas punitif |
| Découverte | Chemin de pavés polis, puis Dionée : le pavé MAT est la bonne place pour attendre | Poli = ne pas s'arrêter ; mat = fiable |
| Combinaison | Escalier de pavés polis sous une Dionée, puis la **Dionée maladroite** : elle vise le joueur près d'un bouton… s'il s'écarte, elle tape le bouton et ouvre la grille | Le danger peut devenir l'outil |
| Passage dynamique | Ascenseur à sablier (hésiter EXPRÈS), tunnel, final rythmé | Retourner la règle apprise |
| Final humoristique | La **porte esquiveuse** : elle fuit si on fonce, revient si on s'arrête. Qui la poursuit jusqu'au coin est renvoyé devant elle par une petite fleur (teaser du 1-2) | « Pas si vite ! » |

## 1-2 « Les fleurs indiscrètes » — détail des situations (v0.5)

| Section | Situation | Ce que le joueur apprend |
|---|---|---|
| Découverte | Une fleur tournée vers lui le repousse (sans danger), puis reste sonnée | Le souffle repousse ; la fleur sonnée ne voit rien |
| Catapulte | Fossé trop large ; la fleur projette… sur des **pavés polis** au-dessus des ronces | Se placer dans le souffle ; continuer à courir à l'atterrissage (leçon du 1-1) |
| Trampoline | Fleur géante tournée vers le ciel ; sa corolle est un plateau | Le souffle vers le haut = super-saut |
| Faux raccourci | Un tronc creux « RACCOURCI » ; au fond, une petite fleur renvoie le curieux dehors | On passe par-dessus (détour humoristique, jamais mortel) |
| Duel | La fleur lilas est **sournoise** : si on saute avant qu'elle ait éternué, elle retient son souffle et attend l'atterrissage | L'appâter d'abord, de loin |
| Piège inversé | La **fleur aspirante** inspire au lieu d'éternuer : au bord du vide elle attire (résister), en plein saut elle porte de l'autre côté | Le même danger est utile ou mortel selon le moment |
| Chaîne | La **fleur timide** se cache quand on la regarde ; dos tourné, elle éternue dans la voile d'un **radeau** qui traverse les ronces | Une réaction en déclenche une autre |
| Combo | La fleur du sol pousse dans le mur ; la géante à côté | Monter d'abord, se laisser porter en l'air |
| Porte volante | Une petite fleur éternue la porte sur une plateforme en hauteur ; une dernière géante y emmène le héros | Surprise finale, résolue avec ce qu'on a appris |

Un seul point de contrôle par niveau en Facile, et seulement s'il évite de refaire une longue partie déjà maîtrisée
(1-1 : au milieu, avant la haie ; 1-2 : en haut de la corniche, avant le duel). Aucun en Expert.
