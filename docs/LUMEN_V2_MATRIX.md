# LUMEN V2 · Matrice de non-régression

Première version issue de [l’EPIC #1081](https://github.com/Anuponk/project-menlu/issues/1081#issuecomment-7234892290), des tickets, de la cartographie du code et de la comparaison des SHA. « À recetter » signifie que le parcours V2 reste à exécuter. Les noms de suites renvoient à `scripts/`, avec le suffixe `-tests.mjs` ou à un module de scénario de ce répertoire. Des vérifications ciblées V1 sont consignées dans [l’audit](LUMEN_V2_AUDIT.md).

| État | Fonctionnalité | Écran V1 | Écran V2 et comportement attendu | Issue source | Test associé | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | Accueil, accueil retour et PWA premier lancement | Plateau et accueil conditionnel | Accueil existant, puis Mon ciel à l’ouverture normale | #832, #1082 | first-welcome-browser, pwa-first-open | À recetter |
| E02 | Tutoriel, reprise, relecture et paliers guidés | Coach sur la grille et aide | Coach sur le plateau et relecture depuis Aide | #1084 | learning-browser, onboarding-locale | À recetter |
| E03 | Connexion, inscription, invité, OAuth, récupération et liens d’auth | Compte et liens d’entrée | Compte et mêmes liens prioritaires | #1082 | account-session-browser, guest-account-hydration | À recetter |
| E04 | Progression, localisation du ciel et retour sur la constellation jouée | Mon ciel paginé | Vue d’aventure directe, retour contextuel depuis la victoire | #1083, #985 | sky-navigation-browser, sky-return | À recetter |
| E05 | Swipe aventure, commandes, ciels mixtes et verrouillages | Sélecteurs Mon ciel | Une aventure dans la même vue, navigation tactile et clavier | #292, #1030, #1083 | sky-navigation-browser, owned-adventure-browser | À recetter |
| E06 | Aventure achevée, suivante et offre si verrouillée | Avis d’achèvement | État ou célébration et mêmes commandes | #575, #1086 | celestial-ux-browser | À recetter |
| E07 | Quêtes réelles, état, chrono et badges individuels | Détail Mon ciel / bilan / revue | Lignes alignées, revue/rejeu et états conditionnels conservés | #985, #1083 | sky-navigation-browser, success-sky-detail | À recetter |
| E08 | Fiche, tracé et identité astronomiques | Mon ciel / détail | Accès fiche depuis la constellation | #856 | astronomical-reference-svg, astronomical-rendering-browser | À recetter |
| E09 | À compléter, Quête suivante et maintien du filtre | Mes quêtes et victoire | Détail et victoire dans le même parcours filtré | #985, #784 | sky-navigation-browser, sky-return-browser | À recetter |
| E10 | Reprise, identification de la quête, prochaine éligible | Plateau / Mon ciel | Jouer, Continuer, sélection unique | #1082, #1083 | owned-adventure-browser, offline-owner-resume | À recetter |
| E11 | Grille et gestes, gardiens, gomme, undo, drag et annulation | Plateau | Même plateau sans barre, même échelle et gestes | #1082 | browser, tap-jitter-browser | À recetter |
| E12 | Aides guidées, indices, vérification et pénalités | Plateau | Mêmes commandes et règles, compteur et surcoûts visibles | #1052 | group-hint, hint-assistance-badge-regression | À recetter |
| E13 | Pause, reprise, reset, sortie et abandon du Défi | Menu, masque et confirmations | Mêmes commandes et cycle de tentative | #1082, #1087 | abandon-attempt-browser, menu-pause-browser | À recetter |
| E14 | Victoire, chrono officiel, podium, actions secondaires | Résultat unifié | Résultat et actions existants, aucun doublon | #661, #682 | victory-layout-browser, victory-clock-freeze | À recetter |
| E15 | Nouveau record, comparaison et palier | Bilan de quête | Même record confirmé, même affichage conditionnel | #600 | personal-records-browser, personal-records | À recetter |
| E16 | Constellation terminée, une célébration et partage | Après victoire | Célébration existante et retour | #575 | celestial-ux-browser | À recetter |
| E17 | Constellation maîtrisée, effets et reduced-motion | Mon ciel et célébration | Indicateur texte et effets conservés | #519 | celestial-ux-browser | À recetter |
| E18 | Aventure maîtrisée, accélération et aperçu | Célébration dorée | Même cérémonie et accès | #886 | celestial-ux-browser | À recetter |
| E19 | Défi ouvert/terminé/indisponible et règles | Bandeau et vue Défi | Encart Jouer et Mon ciel, vue commune | #1049, #1076 | daily-challenge-browser | À recetter |
| E20 | Grille commune, essai unique et reprise du Défi | Plateau défi | Mêmes commandes, qualification et isolation de l’aventure | #1015, #1076 | daily-challenge-browser | À recetter |
| E21 | Résultat Défi, état attente et retour Mon ciel | Victoire Défi | Même résultat, rang et retour | #1013 | victory-challenge-browser | À recetter |
| E22 | Ma semaine et raccourcis de consultation | Défi et Social | Ma semaine dans Défi, raccourci Social | #1015 | daily-week, daily-recaps-browser | À recetter |
| E23 | Historique, choix du jour et archives Premium | Historique et offre | Même historique et logique de rejeu archives | #1015, #1030 | daily-recaps-browser | À recetter |
| E24 | Bilan hebdomadaire et célébrations quotidiennes/hebdomadaires | Défi et notifications de bilan | Surfaces de récap existantes | #1015 | daily-recaps, daily-recaps-browser | À recetter |
| E25 | Classement d’aventure, podium, liste complète, ex æquo et swipe | Classement par aventure | Entrée Classements, podium distinct et toutes lignes au dessous | #974, #1077 | ranking, ranking-browser | À recetter |
| E26 | Classement quotidien global/amis et éligibilité | Défi et classements | Défi et entrée Classements | #1015, #1077 | daily-challenge-browser, ranking-client | À recetter |
| E27 | Accueil Social, anonymat et états désactivés | Menu Social | Entrée Social et mêmes sous-vues | #898 | social-hub, social-hub-browser | À recetter |
| E28 | Recherche amis, ajout, liste et retrait | Social / amis | Même parcours et confirmations | #898 | social-friends, social-hub-browser | À recetter |
| E29 | Invitations, actions et réponses | Social / invitations et liens | Mêmes entrées et liens prioritaires | #898 | social-friends, social-hub-browser | À recetter |
| E30 | Création de duel, restrictions et options | Social / défis | Même sélection et droits | #898 | social-challenge-ui, social-hub-browser | À recetter |
| E31 | Duel reçu, acceptation, reprise et refus | Social / défis et liens | Même plateau dédié et lien direct | #898 | social-challenge, social-hub-browser | À recetter |
| E32 | Résultat duel, historique et revanche | Social / défis | Même résultat et actions | #898 | social-challenge-ui, victory-challenge-browser | À recetter |
| E33 | Centre de notifications, non lues, rappels et résultats | Social, liens et compte | Cloche et compteur dans l’en-tête hors jeu, accès conservé depuis Social, ouverture de l’élément précis | #898, #1032, #1034 | social-notifications, daily-push | À recetter |
| E34 | Partage de réussites, invitation et absence de partage du Défi | Victoire et Social | Mêmes droits et points d’accès | #1013, #898 | victory-challenge-browser, social-hub-browser | À recetter |
| E35 | Compte, session, déconnexion et accès boutique | Menu compte | Bouton Compte depuis les vues principales | #959, #1082 | account-session-browser | À recetter |
| E36 | Profil, pseudo, récupération et suppression | Compte / profil | Même parcours compte | #959 | account-email-login, account-deletion-request-journey | À recetter |
| E37 | FR/EN/ES, son et assistance guidée | Compte, Aide et options de jeu | Accès depuis le compte et commandes de jeu existantes | #959 | locale, i18n-es, es-journeys-browser | À recetter |
| E38 | Rappels, préférences et permissions | Compte / notifications | Même contrôle compte et autorisation OS | #1032, #1034 | daily-push | À recetter |
| E39 | Aide, feedback, diagnostics, consentement et assistance temporaire | Compte / aide et assistance | Mêmes parcours et consentements | #959, #948 | beta-feedback-browser, support-session | À recetter |
| E40 | Boutique, offres, prix, prérequis et consentement | Boutique depuis Mon ciel et limites | Compte et limites, composant offres existant | #1029, #1030 | premium-quota, play-billing | À recetter |
| E41 | Limites nouvelles/rejeux, fuseau, minuit et options | Interception de lancement | Même commande et même modale depuis les points d’entrée | #1030 | premium-quota, fixtures/premium-foundation-1030.sql | À recetter |
| E42 | Stripe et Play, achat annulé, refusé, indisponible | Flux commerce et retours associés | Mêmes passerelles et retour dédié | #1029, #1030 | stripe-checkout-client, play-billing | À recetter |
| E43 | Confirmation, attribution des droits et Explorer | Confirmation et Mon ciel | Même preuve et destination du pack acheté | #1030 | purchase-thanks, play-purchase-handler | À recetter |
| E44 | Restauration Play, achats historiques et droits Premium | Compte, boutique et chargeurs | Mêmes reçus, droits et restauration | #1030 | play-billing, fixtures/premium-foundation-1030.sql | À recetter |
| E45 | Hors ligne, actifs, seules quêtes accessibles, file locale | Plateau, entrées et états réseau | Droits hors ligne et reprises identiques, V1 par défaut sans autorisation fraîche | #1087 | offline-network-browser, service-worker-cache | À recetter |
| E46 | Synchronisation, multi-appareil, changements de compte et conflits | Hydratation et lecteurs d’état | Même jeu, mêmes archives et vérification de propriétaire | #1087 | account-session-browser, cloud-pending-victory | À recetter |
| E47 | Erreurs, chargement, résultats en attente et relance | Surfaces contextualisées | Reprendre les messages et commandes de récupération | #1087 | victory-pending-browser, analytics-admin-browser | À recetter |
| E48 | Cooldown, tentatives qualifiantes et limite en cours de rejeu | Plateau, détails, résultats | Même disponibilité et message | #985, #1030 | performance-badge, ranking-client | À recetter |
| E49 | Bilan personnel, rétention et séries | Records, progression, résultats et Défi | Proposition : bilan réutilisant les faits autorisés du compte | #1085, #1044 | personal-records, daily-week ; composition à créer | À recetter |
| E50 | Découverte ponctuelle et dismissible | Tutoriel, jalons et indications ponctuelles | Découverte au retour d’une action pertinente, hors grille | #1084 | first-welcome-browser ; fréquence et persistance à créer | À recetter |
| T01 | Analytics, consentement, limites, identification QA | Collecte, diagnostics et cockpit | Variante par parcours, métriques existantes réutilisées | #1078, #1080, #1044 | analytics, analytics-admin-browser | À recetter |
| T02 | Autorisation, V1 par défaut, déconnexion et kill switch | Configuration et mécanismes privés | Compte › LUMEN Lab, autorisation fraîche par compte | #1087 | contrat SQL et navigateur à créer | À recetter |
| T03 | Accessibilité, responsive et traductions | Toutes surfaces | Focus visible/restauré, clavier, zoom, tailles, libellés FR/EN/ES | #1081 | lumen-dialog-browser, es-journeys-browser ; contrôles V2 à créer | À recetter |
| T04 | Publication et actifs, cache, rechargement différé et PWA | Service worker et mise à jour | Même cycle, code de prototype exclu du paquet | #1087, #948 | service-worker-cache, app-updates | À recetter |
| T05 | Modes directs particuliers, retour Stripe, liens avec provenance, acquisition et campagnes | Démarrage, auth, défis, achat | Priorité conservée avant l’arrivée normale Mon ciel | #898, #1030, #1082 | daily-challenge-browser, account-session-browser, stripe-checkout-client | À recetter |
| T06 | Agrégats de badges, total et complétion | Résumé et détail Mon ciel | Pourcentages de constellation et d’aventure calculés à partir des quêtes et badges. Les quatre compteurs de badges et leur total sont disponibles en détail | #985, #1083 | celestial-ux-browser ; prototype vérifié, assertions intégrées à ajouter | À recetter |

## Parcours de bout en bout

| Profil | Séquence de vérification |
| --- | --- |
| Nouveau | E01 → E02 → E11 → E14 → E04. |
| Invité | E03 → E04 → E10 → E13 → E45, puis liaison de compte et contrôle de conservation. |
| Régulier | E04 → E10 → E14 → prochaine éligible. |
| Collectionneur | E07 → E09 → E48 → E14 → E17. |
| Quotidien | E19 → E20 → E21 → E22 → E23 → E24. |
| Compétitif | E25 → swipe → dernière ligne éligible → E26. |
| Social | E27 → E28 → E29 → E30 → E31 → E32 → E33. |
| Gratuit | E10 → E41 → E40 → retour à une quête éligible. |
| Premium | E40 → E42 → E43 → E11 → archives E23. |
| Acheteur historique | E03 → E44 → E05 → E10, contrôle des droits après restauration. |
| Hors ligne | E10 → E45 → E14 → E47 → reconnexion → E46. |
| Multi-appareil | E03 → E10 → E13 → E46 depuis le second appareil, même état et chrono. |
| Retour après absence | E01 → E03 → E46 → E04 → E10. |
| Administrateur et QA | T02 → E46 → T01, contrôle du témoin et du rollback pendant/entre tentatives. |
