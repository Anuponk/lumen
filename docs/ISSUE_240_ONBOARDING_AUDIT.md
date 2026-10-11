# #240 — Audit du parcours d'apprentissage (quête 1 à 11)

État au 11 octobre 2026. **Audit statique du code ; aucune observation directe de nouveaux joueurs n'a encore été conduite.** Les frictions sont des hypothèses, pas des statistiques d'usage.

| Jalon | Déclencheur dans le code | Interruption / nouveauté | Comportement cible |
| --- | --- | --- | --- |
| Avant la quête 1 | `createTutorial.setupTutorial`, si première visite | Présentation en cinq étapes | L'option **Passer le tutoriel** est visible dès la première étape, choix conservé |
| Quête 1 | `learningQuestActive` et `LEARNING_INTRO` | Coach sur la grille puis gestes guidés | Guidance disponible par défaut, mais contournable par décision explicite du joueur ; résolution obligatoire |
| Quête 2 | `dragLearningStep` | Apprentissage du marquage glissé | Reste disponible ; le choix de quitter l'introduction de quête 1 ne valide pas la quête 2 |
| Quête 3 | `maybeShowBadgeMilestone`, index 2 | Introduction Rapidité | Message court, accès aux détails via Badges |
| À partir de 3 quêtes résolues | `maybeOfferInstall` | Proposition d'installation PWA | Peut apparaître ; vérifier sur appareil réel le moment exact et éviter la superposition avec victoire |
| Quête 5 terminée / avant quête 6 | `accountRequired` / `maybeOfferAccount` | Proposition de compte | Sauvegarde cloud prioritaire ; choix invité/compte et retour à la partie à tester |
| Quête 6 | `maybeShowAutoCrossUnlock` ET `maybeShowBadgeMilestone` (index 5) | Déblocage marquage automatique + présentation badges | **Deux sollicitations au même jalon : reste à regrouper/ordonner après test UX** |
| Quête 8 terminée | `learningSkyDiscoveryRequired`, index 7 | Découverte guidée de Mon ciel | Vrai jalon dans le code (et non fin de quête 2, mentionnée dans d'anciennes docs) |
| Quête 10 | `maybeShowHintEconomyTransition`, index 9 | Fin imminente des indices offerts | Annonce pendant la dernière quête avec indices offerts |
| Quête 11 | `maybeShowAutonomy`, index 10 | Choix du mode de guidance | Ne pas modifier les règles des badges ou les aides existantes |
| Fin d'Aventure | `advanceToNextPuzzle`, `questIsAccessible` | Suite verrouillée | Ouverture de Mon ciel et état verrouillé actuel, sans fausse promesse de déblocage |

## Changements apportés par la PR #304
- Opt-out explicite dès la présentation de la première quête ET sur le coach de la grille ; la grille reste à résoudre par le joueur.
- Préférence mémorisée dans le stockage local (clé distincte pour mode QA), sans altérer les acquis cloud.
- Réduction des explications sur les badges aux règles essentielles ; les règles complètes restent consultables.
- Tutoriel de relecture conservé pour un joueur ayant déjà appris.

## Non vérifié / suivi avant clôture
- **Observations terrain manquantes :** au moins quelques joueurs nouveaux jusqu'à la quête 6, hésitations, compréhension des règles, tutoriels ignorés et envie de poursuivre ; aucune conclusion statistique n'est possible à ce stade.
- **Contrôle empirique mobile/PC manquant :** petits écrans, clavier, rafraîchissement et reprise invités/connectés.
- **Regroupement des pop-ups du jalon quête 6** (déblocage + badges), ordre d'apparition et conflit potentiel avec installation/compte ; décision UX et vérification requises.
- **Fin d'Aventure :** faire valider par de nouveaux joueurs la compréhension du verrouillage et les actions possibles.
- **Documentation obsolète :** certaines descriptions anciennes placent Mon ciel après la quête 2 ; l'implémentation utilise index 7 (fin quête 8). Harmonisation des documents généraux à prévoir, sans changer silencieusement le produit.

La #240 reste ouverte tant que ces éléments ne sont pas tous vérifiés.

## Complément — PR de fluidification #240 (11 octobre 2026)
- Le jalon quête 6 présente badges et déblocage du marquage automatique dans **une seule fenêtre** ; son acquittement conserve les deux marqueurs de découverte. Un joueur ayant déjà vu les badges mais pas le marquage auto garde la fenêtre dédiée.
- La proposition PWA est reportée après 12 quêtes résolues, hors blocage de compte et hors superposition avec les modales du parcours. Si aucune invite native d'installation n'est disponible hors iOS, aucun bouton inopérant n'est montré.
- Les lancements en `display-mode: standalone`, `fullscreen` ou `minimal-ui`, les PWA iOS (`navigator.standalone`), les lancements Android depuis une application (`android-app://`) et les wrappers exposant `window.LUMEN_NATIVE_APP=true` sont considérés comme **déjà installés**.
- L'API facultative `navigator.getInstalledRelatedApps()` est interrogée en amont pour les applications associées déclarées dans le manifeste ; l'association Android / package Play Store réel **reste à configurer au moment de la publication (#170)**. Une page Web ouverte dans un onglet classique ne peut pas garantir la détection d'une autre PWA installée si le navigateur ne l'expose pas.
- La reprise après compte et les observations de nouveaux joueurs demeurent des critères ouverts de #240.
