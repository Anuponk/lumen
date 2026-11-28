# LUMEN V2 · Journal des décisions

Source de vérité des arbitrages du propriétaire sur le prototype V2 (#1081, #1083, #1087).
Chaque entrée est datée, liée à sa preuve (prototype, captures) et indique son statut :
**Décidé**, **Proposé** (à valider) ou **Ouvert**. Les agents (Codex, Claude) ajoutent une
entrée à chaque retour du propriétaire, avant de modifier le prototype.

Prototype : `node scripts/serve-lumen-v2-prototype.mjs` puis
http://127.0.0.1:10887/docs/lumen-v2-prototype/. Référence V1 : Web `1.11.1+822`
(`73e75850`) ; la branche intègre `main` à `1.11.1+823` (`10727775`, correctif Premium
remboursé, sans impact UX).

## Décisions

| # | Date | Sujet | Décision / retour propriétaire | Réponse dans le prototype | Statut | Preuve |
|---|---|---|---|---|---|---|
| D1 | 28/11 08:18 | Densité de Mon ciel | « Mon ciel est beaucoup trop dense. » | Mon ciel montre d'abord la progression et l'état des constellations ; les quatre compteurs de badges et le total passent derrière le bouton **Badges** (un geste). Les dix constellations tiennent dès 320 px. | Révisé, à valider | `docs/validation/lumen-v2-1081/navigation-review/` |
| D2 | 28/11 08:18 | Fluidité de la navigation | « Pas convaincu par la fluidité de la navigation proposée. » | « Reprendre » ouvre directement la grille ; le retour d'une fiche retrouve le filtre actif ; le retour du Défi retrouve la même aventure ; Mon ciel et Classements mémorisent chacun leur sélection. | Révisé, à valider | idem |
| D3 | 28/11 08:44 | États des constellations | Distinguer **en un clin d'œil** Maîtrisée, Terminée, En cours, À découvrir, sans alourdir l'écran. | Chaque carte : un **symbole + une couleur + un libellé** (lisible même sans les couleurs). | Décidé | `docs/validation/lumen-v2-1081/sky-review/` |
| D4 | 28/11 08:44 | % par constellation | Un **pourcentage total de complétion par constellation** ; **100 % = maîtrisée**. | Un seul % par carte = (quêtes résolues + badges acquis) / (quêtes + badges possibles), arrondi à l'entier inférieur, 100 % réservé à la maîtrise. Ex. : Cassiopée Terminée 74 %, Grande Ourse Maîtrisée 100 %. | **Décidé** (formule confirmée, D15) | idem |
| D5 | 28/11 08:44 | Progression de l'aventure | Au niveau de l'aventure, connaître sa **progression globale**, qui ne repose pas que sur les quêtes mais aussi sur les **badges**. | Bandeau Aventure : même formule quêtes + badges sur les totaux du catalogue ; détail des badges en un geste. | **Décidé** (formule confirmée, D15) | idem |
| D6 | 28/11 08:44 | Écran pivot | **Mon ciel est l'écran pivot de tout LUMEN** ; tel quel, on croyait que « Mon espace » était le centre. Cliquer sur le logo LUMEN pour revenir à Mon ciel n'est **pas intuitif**. | « Mon ciel » devient le titre de l'écran d'accueil ; Mon espace passe en icône secondaire ; le logo n'est qu'un repère visuel ; l'onglet **Mon ciel** assure le retour. | Décidé | idem |
| D7 | 28/11 08:44 | Notifications | Où s'affiche le compteur de notifications, et comment aller à l'action qui en découle ? | **Cloche en haut à droite** avec compteur (hors partie). Elle ouvre la liste ; chaque ligne mène directement à la demande d'ami, au duel reçu ou à son résultat. Une demande reste comptée jusqu'à la décision, un résultat jusqu'à sa consultation. Réutilise les entrées et compteurs Social (#898). | Proposé, à valider | `sky-review/notifications-390.png`, `duel-390.png` |
| D8 | 28/11 08:44 | Maquettes de référence | **Reprendre les maquettes du ticket** #1083. | Planche 03 : grille d'ensemble et quatre emplacements par quête ; planche 02 : hiérarchie du bandeau Aventure ; planche 01 : en-tête Mon ciel. Noms, chiffres et couleurs illustratifs remplacés par les données et composants actuels. | Décidé | #1083 |
| D9 | 28/11 08:54 | Accès verrouillés | Ajouter au prototype les cas d'**aventures et de quêtes verrouillées**. | Aventure verrouillée : voir D18 (redirection vers la boutique) ; quête verrouillée par la progression : toucher la ligne révèle le prérequis (Lyre : Q6 demande Q5). Décision d'accès issue du modèle catalogue + droits. | Fait, à valider | `docs/validation/lumen-v2-1081/access-review/` |
| D10 | 28/11 08:54 | Navigation entre aventures | Depuis une constellation, pouvoir **passer d'une aventure à une autre** (ouvert à discussion). | Flèches **en haut**, à côté du nom de l'aventure : ouvrent la première constellation de l'aventure voisine en gardant le filtre « À compléter ». Flèches **en bas** : constellations de l'aventure active. | **Décidé** (28/11, arbitrage D14) | `access-review/navigation-aventure-390.png` |
| D11 | 28/11 08:54 | Barre du bas pendant la partie | La barre du bas n'est pas toujours affichée (ex. sous la grille) : volontaire ? | **Oui, volontaire** : elle disparaît pendant la partie, y compris pause et aide, pour laisser la place à la grille ; Retour reste visible en haut. | Proposé, à confirmer | `play-review/` |
| D12 | 28/11 08:58 | Écran de jeu | Affiner la maquette de l'écran où l'on joue ; montrer le **rendu complet attendu**. | Quête 35 (Lyre, grille réelle 7 × 7, frontières de territoire accentuées) : en-tête Retour + Pause ; chrono officiel et compteur de Gardiens **au-dessus** ; Annuler, Effacer, Vérifier +5 s, Indice +15 s **juste en dessous** ; pas de barre de navigation. Tient dès 320 px. Pause, règles, vérification et Défi du jour illustrés. | Proposé, à valider | `docs/validation/lumen-v2-1081/play-review/` |
| D14 | 28/11 | Navigation entre aventures (suite D10) | **Flèches en haut**, à côté du nom de l'aventure (ouvrent sa première constellation, filtre conservé) ; flèches du bas pour les constellations de l'aventure active. | À conserver tel quel dans le prototype. | Décidé | D10 |
| D15 | 28/11 | Formule des pourcentages (D4/D5) | **Quêtes et badges à égalité** : (quêtes résolues + badges acquis) / (quêtes + badges possibles), arrondi inférieur, 100 % = maîtrisée ; même formule pour l'aventure sur les totaux du catalogue. | Inchangé. | Décidé | D4, D5 |
| D16 | 28/11 | Bilan personnel E49 | **Pas maintenant** : « Ma semaine » reste dans le Défi ; un bilan sera réétudié plus tard avec de vraies données d'usage. | Retirer E49 du périmètre du jalon 4 (garder l'état documenté comme différé). | Décidé (différé) | — |
| D17 | 28/11 | Indications de découverte E50 | **Une fois, au premier usage** : bulle discrète et fermable la première fois qu'une fonction devient utile (ex. Badges, cloche, classement), jamais réaffichée. | À illustrer dans le prototype (déclencheurs et persistance par compte). | Décidé, à prototyper | — |
| D18 | 28/11 | Aventure verrouillée | « Quand on veut afficher une aventure verrouillée, il faut **rediriger vers la boutique**. » | Flèches, swipe, carte ou « Voir l'accès » vers une aventure verrouillée ouvrent directement la boutique ; « Continuer gratuitement » ramène à l'aventure d'origine. Remplace l'aventure verrouillée consultable de D9. | Décidé, fait | `shop-review/boutique-aventure-verrouillee-390.png` |
| D19 | 28/11 | Écran boutique | Mettre à jour la boutique du prototype avec **l'écran actuel de la production** (allégé). | E40 rendu par le vrai composant de production (#1029) dans le même cadre que l'app ; l'ancienne capture V1 n'est plus utilisée. | Décidé, fait | idem |
| D20 | 28/11 | Code couleur des états | Le vert de « Terminée » se lit comme le summum alors que c'est « Maîtrisée » ; ouvert à proposition. | **Proposition** : échelle qui s'allume du froid vers le chaud. À découvrir (éteinte, pointillés) < En cours (bleu discret) < Terminée (bleu argenté) < Maîtrisée (**or**, seule teinte chaude, halo, comme la 1re place et les badges). Trait de progression de 2 px par carte. | **Décidé** (validé le 28/11) | `shop-review/mon-ciel-couleurs-390.png` |
| D21 | 28/11 | Bascule Général / Mes amis | Ajouter dans Classements un **toggle Général versus Amis**. | Deux bascules : **Aventure / Défi du jour**, puis **Général / Mes amis** (plus compacte). Elles s'appliquent aux deux classements. À l'intégration, le classement d'aventure « Mes amis » demandera une lecture serveur filtrée sur les amis (n'existe aujourd'hui que pour le Défi). | Décidé, fait | `rankings-review/` |
| D22 | 28/11 | Classement du Défi | Depuis Classements, « Défi » ouvrait un écran qui ne montre pas le classement tel que défini aujourd'hui : **aligner**. | Le Défi affiche le tableau de production (`renderDailyBoard` : podium, « Ta position », participants) avec Général/Mes amis, plus Jouer au Défi et Ma semaine ; « Classements du Défi » (E26) ouvre ce même écran. Le classement d'aventure suit la production : podium, « Ta position », « Voir autour de ma position » (±5), carte masquée quand la liste contient sa ligne. | Décidé, fait | `rankings-review/` |
| D23 | 28/11 | Classement des quêtes | « Où voit-on le classement des quêtes ? » Comme en production, il vit **dans la quête** : écran de victoire et revue d'une quête résolue (toucher la quête dans Mon ciel). Pas d'onglet dédié. | E14 affiche le podium des 3 meilleurs temps officiels (`createPodium`) et « Ta position » hors podium, sous le résultat ; les quatre badges passent sur une ligne compacte. | Fait, à valider | `rankings-review/classement-quete-390.png` |
| D24 | 28/11 | Étoile de la victoire | « Dans l'écran de victoire il manque la partie où on voit la nouvelle étoile s'allumer. » | E14 reprend la révélation de production (#skyReveal) : « NOUVELLE ÉTOILE », « Une nouvelle étoile s'allume », nom de l'étoile, constellation avec l'étoile qui naît puis ses lignes (starBirth, lineBirth), progression « n / total étoiles ». Rejeu ou revue d'une quête résolue : « QUÊTE ACCOMPLIE », constellation déjà allumée, sans animation. | Fait, à valider | prototype E14 |
| D25 | 28/11 | Portée du prototype | Le prototype n'est pas exhaustif ; ce qui n'y figure pas n'est pas oublié. | **Règle** : tout état non refait dans le prototype reste identique à la V1 (voir la matrice : E06, E16, E17, E18…). Tout écran refait doit reprendre chaque élément V1, sauf décision contraire consignée ici. Contrôle de parité ci-dessous. | Décidé | [Contrôle de parité](#contrôle-de-parité-v1--écrans-refaits-2811) |
| D26 | 28/11 | Sons | « Les sons dans réglage. » | Le bouton Sons quitte l'en-tête : réglage dans Mon espace › Langue et son (E37), y compris pendant la partie. | Décidé | E37 |
| D27 | 28/11 | Partager Lumen | « L'icône partager tu la mets dans Mon espace. » | Mon espace › Partager › « Partager Lumen » ouvre la feuille de partage (texte d'invitation de production). | Décidé, fait | E35 |
| D28 | 28/11 | Parité de la victoire | « Comble les manques, globalement sur le proto. » | E14 après victoire : temps final, record (nouveau / égalé / écart), récompenses de production `rewardSlots` (Nouveau / Acquis / manquant), « Maîtrise du premier coup », podium, Quête suivante, ➤ Défier, ↻ Rejouer (nouvelle tentative), « Partager ma réussite » à la fin ou maîtrise d'aventure (#932, aussi sur E06 et E18). La victoire met à jour la progression simulée. Revue d'une quête résolue : inchangée, avec Défier. | Fait, à valider | prototype E14, E06, E18, E35 |
| D29 | 28/11 | Signal du Défi du jour | « Il faut que l'user sache qu'il a un défi à jouer. » | **Pastille dorée sur l'onglet Jouer** tant que le Défi est ouvert et non joué ; **carte Défi** à côté de « Reprendre » dans Mon ciel et Jouer : « À jouer · 1 essai » → Défi ; « Défi joué · temps · rang » → classement du Défi ; « Revient demain » si indisponible. Pas de 5ᵉ onglet (320 px), pas dans la cloche (réservée au social), rappel hors appli = push #1032. Remplace la puce Défi de l'en-tête V1. | Fait, à valider | Panneau Prototype › Défi du jour (3 états) |
| D30 | 28/11 | Règle d'or : pas de défilement | « Le proto ne respecte pas toujours la règle d'or de ne pas devoir scroller. » | Chaque écran tient sans défilement vertical en 360×640 et 390×844 (#705). Contrôle automatisé des 50 états : 18 dépassaient (fiches V1 avec capture, victoire, détail de constellation). Corrigé : captures V1 bornées à la hauteur, victoire compacte (podium compact de production, actions sur deux lignes, liens de storyboard retirés), lignes de quête resserrées sous 700 px. Restant : aucun (la boutique E40 est une modale qui tient à l'écran). | Fait | — |
| D31 | 28/11 | Taille d'une constellation | « Une constellation fera maximum 10 quêtes. » | Plafond de conception : la règle d'or (D30) est vérifiée sur le détail d'une constellation de 10 quêtes en 360×640 ; aucun cas plus long à prévoir. | Décidé | D30 |
| D32 | 28/11 | Mesure V1/V2 | « Pas besoin de la comparaison analytique V1/V2. » | Pas de variante `v1`/`v2` dans le contrat de collecte (retire ce point de l'audit). | Décidé | — |
| D13 | 28/11 09:04 | Passage de relais | Consigner les décisions et les dernières maquettes dans le ticket ; poursuivre le prototype avec Claude. | Ce journal + `LUMEN_V2_HANDOFF.md` ; récapitulatif posté sur #1081 (la mise à jour de Codex a été interrompue). | Décidé | #1081 |

## Contrôle de parité V1 · écrans refaits (28/11)

Méthode : éléments du balisage V1 (`index.html`, `src/ui/game-screen.js`, SHA de départ
`73e75850`) comparés au prototype (`a95738b` + D24). Comparaison de code, pas de recette
à l'écran. **Manque** = élément V1 absent sans décision ; **Déplacé** = présent ailleurs,
sans décision explicite.

| Écran | Élément V1 | Prototype | Écart |
|---|---|---|---|
| Victoire E14 | Temps final + record personnel (`skyRevealTime`, `skyRevealRecord`) | Affichés après la victoire | Comblé (D28) |
| Victoire E14 | Récompenses avec distinction nouveau / déjà acquis (`rewardSlots`, état `new`) | `rewardSlots` de production | Comblé (D28) |
| Victoire E14 | Tuile rang à côté du temps (`skyRevealRank`) | Podium + « Ta position » sous le résultat (D23) | Conforme sur le fond, à valider |
| Victoire E14 | « ➤ Défier » (`skyRevealShare`) | Feuille de partage du défi | Comblé (D28) |
| Victoire E14 | « Partager ma réussite » à la fin ou maîtrise d'aventure (#932) | Victoire concernée, E06, E18 | Comblé (D28) |
| Victoire E14 | « ↻ Rejouer » | Victoire et revue, nouvelle tentative | Comblé (D28) |
| Victoire E14 | Motif du défi remarquable (`successChallengeReason`, « Maîtrise du premier coup ») | Affiché à la maîtrise au premier essai | Comblé (D28) |
| Victoire E14 | « ✦ Mon ciel » | Onglet Mon ciel (barre du bas) | Déplacé, cohérent avec D6 |
| En-tête | « Partager Lumen » (`shareLumen`, `mapShareLumen`) | Mon espace › Partager | Déplacé, décidé (D27) |
| En-tête | Bouton Sons en un geste (`soundToggle`) | Dans Réglages (E37) | Déplacé, décidé (D26) |
| En-tête | Puce « Défi du jour » (`dailyChip`) | Pastille sur Jouer + carte Défi | Remplacé, décidé (D29) |
| Jeu E11 | Pause, Quitter/Abandonner, Règles, Annuler, Effacer, Vérifier, Indice, contrôle guidé | Présents (abandon dans la pause) | Conforme |
| Jeu E11 | Sons pendant la partie | Réglages (E37) | Décidé (D26) |
| Mon ciel E04 | Visite guidée de Mon ciel (`skyTour`) | Non illustrée | À recetter (ordre conservé selon le dossier de conception) |
| Classements E25 | Podium, « Ta position », liste complète, Général/Mes amis du Défi | Alignés sur la production (D21, D22) | Conforme |
| Détail E07 | Quête suivante d'une quête terminée, règles des badges, délai de rejeu (E48) | Présents ou en fiche V1 | Conforme, à recetter |

Tous les écarts relevés sont comblés ou arbitrés (D26–D29).

## Arbitrages encore ouverts (jalon 4)

1. Confirmation de la barre du bas masquée pendant la partie (D11) et de l'écran de jeu (D12) après essai.
2. Validation des révisions D1, D2, D7 et D9 après essai du prototype.
3. Validation explicite du jalon 4 avant toute intégration dans l'application.

Tranchés le 28/11 : D10/D14 (flèches en haut), D4–D5/D15 (quêtes + badges à égalité), E49/D16 (différé), E50/D17 (une fois au premier usage).

## Hors prototype (rappel #1087)

Bêta privée par compte : interrupteur serveur `ux_preview` (désactivé) + capacité
`ux_v2_preview`, invités exclus, bascule bloquée pendant une tentative. La migration
`20261128150200_lumen_ux_v2_lab_1087.sql` existe sur la branche mais **n'est pas appliquée
en production** (vérifié le 28/11). Aucune activation sans accord du propriétaire.
