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
| D4 | 28/11 08:44 | % par constellation | Un **pourcentage total de complétion par constellation** ; **100 % = maîtrisée**. | Un seul % par carte = (quêtes résolues + badges acquis) / (quêtes + badges possibles), arrondi à l'entier inférieur, 100 % réservé à la maîtrise. Ex. : Cassiopée Terminée 74 %, Grande Ourse Maîtrisée 100 %. | Décidé (formule à confirmer) | idem |
| D5 | 28/11 08:44 | Progression de l'aventure | Au niveau de l'aventure, connaître sa **progression globale**, qui ne repose pas que sur les quêtes mais aussi sur les **badges**. | Bandeau Aventure : même formule quêtes + badges sur les totaux du catalogue ; détail des badges en un geste. | Décidé (formule à confirmer) | idem |
| D6 | 28/11 08:44 | Écran pivot | **Mon ciel est l'écran pivot de tout LUMEN** ; tel quel, on croyait que « Mon espace » était le centre. Cliquer sur le logo LUMEN pour revenir à Mon ciel n'est **pas intuitif**. | « Mon ciel » devient le titre de l'écran d'accueil ; Mon espace passe en icône secondaire ; le logo n'est qu'un repère visuel ; l'onglet **Mon ciel** assure le retour. | Décidé | idem |
| D7 | 28/11 08:44 | Notifications | Où s'affiche le compteur de notifications, et comment aller à l'action qui en découle ? | **Cloche en haut à droite** avec compteur (hors partie). Elle ouvre la liste ; chaque ligne mène directement à la demande d'ami, au duel reçu ou à son résultat. Une demande reste comptée jusqu'à la décision, un résultat jusqu'à sa consultation. Réutilise les entrées et compteurs Social (#898). | Proposé, à valider | `sky-review/notifications-390.png`, `duel-390.png` |
| D8 | 28/11 08:44 | Maquettes de référence | **Reprendre les maquettes du ticket** #1083. | Planche 03 : grille d'ensemble et quatre emplacements par quête ; planche 02 : hiérarchie du bandeau Aventure ; planche 01 : en-tête Mon ciel. Noms, chiffres et couleurs illustratifs remplacés par les données et composants actuels. | Décidé | #1083 |
| D9 | 28/11 08:54 | Accès verrouillés | Ajouter au prototype les cas d'**aventures et de quêtes verrouillées**. | Aventure verrouillée consultable avec « **Voir l'accès** », quêtes marquées d'un cadenas ; quête verrouillée par la progression : toucher la ligne révèle le prérequis (Lyre : Q6 demande Q5). Décision d'accès issue du modèle catalogue + droits. | Fait, à valider | `docs/validation/lumen-v2-1081/access-review/` |
| D10 | 28/11 08:54 | Navigation entre aventures | Depuis une constellation, pouvoir **passer d'une aventure à une autre** (ouvert à discussion). | Flèches **en haut**, à côté du nom de l'aventure : ouvrent la première constellation de l'aventure voisine en gardant le filtre « À compléter ». Flèches **en bas** : constellations de l'aventure active. | **Ouvert** (disposition à valider) | `access-review/navigation-aventure-390.png` |
| D11 | 28/11 08:54 | Barre du bas pendant la partie | La barre du bas n'est pas toujours affichée (ex. sous la grille) : volontaire ? | **Oui, volontaire** : elle disparaît pendant la partie, y compris pause et aide, pour laisser la place à la grille ; Retour reste visible en haut. | Proposé, à confirmer | `play-review/` |
| D12 | 28/11 08:58 | Écran de jeu | Affiner la maquette de l'écran où l'on joue ; montrer le **rendu complet attendu**. | Quête 35 (Lyre, grille réelle 7 × 7, frontières de territoire accentuées) : en-tête Retour + Pause ; chrono officiel et compteur de Gardiens **au-dessus** ; Annuler, Effacer, Vérifier +5 s, Indice +15 s **juste en dessous** ; pas de barre de navigation. Tient dès 320 px. Pause, règles, vérification et Défi du jour illustrés. | Proposé, à valider | `docs/validation/lumen-v2-1081/play-review/` |
| D13 | 28/11 09:04 | Passage de relais | Consigner les décisions et les dernières maquettes dans le ticket ; poursuivre le prototype avec Claude. | Ce journal + `LUMEN_V2_HANDOFF.md` ; récapitulatif posté sur #1081 (la mise à jour de Codex a été interrompue). | Décidé | #1081 |

## Arbitrages encore ouverts (jalon 4)

1. **D10** : navigation entre aventures depuis le détail (flèches haut/bas proposées).
2. **Bilan personnel E49** : place dans Mon espace et intérêt d'un bilan sur 7 jours en plus de la semaine du Défi.
3. **Indications de découverte E50** : moment d'affichage, fréquence et persistance.
4. Confirmation des formules de pourcentage (D4/D5) et de la barre du bas masquée en partie (D11).
5. Validation explicite du jalon 4 avant toute intégration dans l'application.

## Hors prototype (rappel #1087)

Bêta privée par compte : interrupteur serveur `ux_preview` (désactivé) + capacité
`ux_v2_preview`, invités exclus, bascule bloquée pendant une tentative. La migration
`20261128150200_lumen_ux_v2_lab_1087.sql` existe sur la branche mais **n'est pas appliquée
en production** (vérifié le 28/11). Aucune activation sans accord du propriétaire.
