# Matrice des mécaniques — 40 niveaux

Objectif : vérifier, avant de produire les niveaux, qu'aucun ne recycle une mécanique sous un autre habillage.
Colonne « Ce qui déclenche » = le comportement du joueur que le monde observe. Deux niveaux qui observent
la même chose ET y répondent de la même façon sont des doublons.

Légende intelligence : **R** réagit · **E** exploite une attente · **P** manipule la perception · **C** combine des systèmes · **A** anticipe.

| Niv. | Titre | Ce qui déclenche | Réponse du monde | Int. | Statut |
|---|---|---|---|---|---|
| 1-1 | Le chemin trop poli | Immobilité (hésitation) | Le sol cède, ou sert d'ascenseur si on hésite exprès | R | ✅ jouable |
| 1-2 | Les fleurs indiscrètes | Être regardé longtemps (distance + durée) | Éternuement directionnel = poussée exploitable | R | |
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
