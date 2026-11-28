# LUMEN V2 · Audit du 28 novembre 2026

## Référence et suivi

- Production Web vérifiée sur [build-info.json](https://lumen.nopuna.fr/build-info.json). Le premier relevé indiquait `1.11.1+821` (`a49aa2c0a6970c64be27762903f4107e3513a915`). Pendant l’audit, la publication est passée à `1.11.1+822` (`73e75850a15ab16dfb76dfa88e9a7223808e052b`). La configuration commerciale, la publication Android et les parcours connectés demandent des preuves distinctes.
- Le SHA de `1.11.1+822` est aussi le départ de la branche (PR #1079). Il apporte le classement exhaustif (#1077/#974), la règle du Défi en une ligne (#1076) et la ventilation de l’activité (#1044). Utiliser ce SHA comme référence pour le candidat V2 et comparer les interfaces à règles et données identiques.
- Les copies IDE couvrent des branches historiques ou complémentaires. Les sujets qui se recoupent sont la boutique et Premium (#1029/#1030), les classements (#974/#1077), le Défi (#1015/#1076) et le cockpit (#1044). Les PR #1066, #1069, #1072, #1074, #1075 et #1079 figurent dans l’historique de départ.
- #1029 et #1030 restent à recetter selon GitHub. #1015 est également à recetter. Son retour du 24/11 signalait 5 à 6 s à l’ouverture et à la fermeture du Défi sur appareil réel. Mesurer ces transitions sur le même appareil avant d’attribuer un gain à la V2. #1034 a du code fusionné (#1053) et reste en cours. #1035, #1036, #1078 et #1080 restent au backlog. #662 est en pause. #886 a reçu la validation du propriétaire pour l’animation dorée et ses commandes.
- #695 a livré la revue de quête. Le passage Safari vers la PWA installée est couvert dans le code par #832 et reste à recetter sur iPhone. La clôture de #793 ne constitue pas une preuve de recette physique. #948 fournit l’échantillonnage réutilisable et #999 suit les limites Supabase Free-first.
- Les trois PNG de [#1083](https://github.com/Anuponk/project-menlu/issues/1083) ont été ouverts. La planche 03 guide la grille d’ensemble et les quatre emplacements par quête. Ses noms, chiffres, états et couleurs illustratifs cèdent la place aux données et composants actuels. La planche 01 sert à la hiérarchie générale. Les écrans intermédiaires des planches 01 et 02 cèdent la place à l’arrivée directe dans Mon ciel, conformément à [l’arbitrage de l’EPIC](https://github.com/Anuponk/project-menlu/issues/1081#issuecomment-7234851272).

## Cartographie et composants à réutiliser

| Domaine | Points d’entrée et autorité |
| --- | --- |
| Démarrage et accès directs | `src/ui/game-screen.js::bootGame` orchestre le Défi, les duels, la restauration, l’accueil, `myChallenges` et `sky`. Examiner aussi auth, retour Stripe, notifications et PWA premier lancement. |
| Mon ciel | `sky-navigation.js`, `contentMapModel`, `canonicalQuestList`, éligibilité `catalogue-access.js`, fiches et tracés `astronomical-reference-svg.js`. La pagination en pages de six est un choix d’affichage V1. Les ciels mixtes et Premium s’appuient sur le même catalogue et leurs droits. |
| Badges et records | `performance.js`, `celestial-progress.js`, `celestial-celebration.js` et les projections de bilan. Les quatre critères sont disponibles dans le modèle actuel. Les compteurs de catégorie et le total s’agrègent sur les quêtes du catalogue. Les records historiques et la maîtrise gardent leur preuve d’origine. |
| Partie et reprise | `attempt-engine.js`, `game-screen.js`, `campaign-resume.js`. Préserver l’ID de tentative, le chrono, les epochs de réinitialisation, les intentions en attente et leur propriétaire. Aucun second moteur. |
| Défi, classements et social | `daily-view.js`, `daily-week.js`, `daily-recaps.js`, `group-ranking.js`, `social-hub.js`, `social-notifications.js`. Réutiliser les classements complets, la mise en avant du podium, les droits et états du Défi. |
| Compte et commerce | `cloud.js`, `game-screen.js`, `play-billing.js`, `stripe-checkout.js`, commandes Supabase. Offres, prix, quotas, fuseau, restauration et droits historiques restent des lectures des autorités existantes. |
| Transverse | `sw.js`, `app-updates.js`, `src/ui/locales/`, `analytics/events.js`, `performance-sampler.js`. Le service worker conserve les actifs et exclut les API privées. Tests navigateur via `scripts/cdp-client.mjs` avec le backend de production bloqué. |

## Coexistence V1/V2 et risques

| Risque | Décision technique et preuve attendue |
| --- | --- |
| Ouverture involontaire | Drapeau serveur privé `ux_preview` désactivé par défaut et capacité `ux_v2_preview` par UUID. Contrôle via `auth.uid()`, invités exclus, aucune entrée URL. Réutiliser la table de drapeaux et les capacités. Tester propriétaire, compte témoin, invité, capacité expirée et kill switch. |
| Réponse tardive après déconnexion | Lier chaque lecture à la session client et à une génération. Invalider sur changement de compte et déconnexion. Garder la préférence d’interface liée au compte et inerte sans réponse serveur positive pour la session actuelle. |
| Désactivation pendant une partie | Bloquer la bascule de préférence pendant les tentatives en cours ou en pause. Une décision de révocation peut prendre effet au prochain point de navigation sûr. Le plateau, la tentative et le chrono utilisent les mêmes objets. |
| Collision avec les entrées spécifiques | Le routeur conserve leur priorité. L’arrivée normale Mon ciel intervient après résolution du contexte. Couvrir première visite, récupération, défi, duel, notifications, restauration, retour paiement et reprise. |
| Petits écrans et zoom | Vue 2 × 5 pour dix constellations à vérifier à 320 × 568, 360 × 640, 390 × 844. Tester 200 % de zoom et agrandissement des caractères. Explorer une présentation adaptée si le zoom empêche de garder les dix cartes lisibles. Flèches et clavier en plus du swipe. |
| Pollution par la QA | Employer une origine et une base isolées, avec données semées, paiement TEST et transports notifications capturés. Les essais métier destructifs restent isolés. Le test propriétaire en production agit sur ses données réelles et peut avoir des effets sociaux ou compétitifs. |
| Mesures et quotas | #1044 possède les agrégats métier et reste réservé au cockpit. Réutiliser consentement, analytics produit et échantillonnage #948. Événements limités aux arrivées, vues, actions de jeu, limites, reprise/abandon, résultats et mesures. Ajouter une variante fermée `v1`/`v2` au contrat de collecte, sans PII ou geste individuel. Traiter PostHog et ses quotas dans #1080. |
| Fidélisation | `Ma semaine` reste dans le Défi. Un bilan personnel éventuel lit les faits du compte, sans utiliser les RPC administratives #1044. #752 met la Série de lumière en pause. La conception n’implique pas sa réactivation. |

## Plan de recette

La [matrice fonctionnelle](LUMEN_V2_MATRIX.md) lie les états de référence aux destinations V2 et aux suites à rejouer. Effectuer les 12 parcours du storyboard et ajouter invité et administrateur/QA. Comparer V1 et V2 avec les mêmes données et les mêmes réglages, enregistrer les captures et le résultat pour chaque ligne.

- Automatiser les états stables avec les suites existantes. Ajouter uniquement les cas manquants pour l’autorisation, la course entre comptes, le rollback, le routage d’arrivée et les nouvelles compositions. Mesurer ouverture à froid/chaud, accès Mon ciel, délai avant jeu, aller/retour Défi, temps de rendu du classement et requêtes/volume. Conserver les échantillons et rapporter médiane et p90 par profil.
- Recette navigateur avec Chromium desktop/mobile, PWA installée, Safari iPhone et Android réel. Vérifier FR/EN/ES, clavier, tailles et focus, gestes, réduction de mouvement, cache initial et actualisation, reconnexion, changement de compte sur un appareil partagé.
- Associer les tests SQL aux migrations candidates sur données synthétiques. Vérifier les quotas avant/après minuit local, achats et restauration en sandbox, les défauts d’autorisation et aucune livraison réelle de notification en QA.
- Avant livraison, vérifier les gates de PR et o2switch pour le même candidat, l’avis du propriétaire sur les maquettes, le retour V2 → V1, l’UUID propriétaire confirmé et un témoin exclu. L’activation production intervient au jalon 6.
- Portée des preuves actuelle : tests Node ciblés exécutés sur `main` pour Mon ciel, retour céleste, détail depuis victoire, classements, Social, semaine, mises à jour et service worker (21 cas). Audit FR/EN sur 2 176 clés. Recette physique, comparatif de performance complet et environnement QA avec paiements restent à établir.
