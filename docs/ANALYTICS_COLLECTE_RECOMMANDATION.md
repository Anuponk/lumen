# Collecte publique d'événements produit : recommandation (#708)

Statut : **recommandation à arbitrer**, 21/11/2026. **Rien n'est activé.**
L'activation reste une décision explicite du propriétaire, à prendre avec la confidentialité (#316) et la politique de conservation ([PRIVACY_RETENTION_PROPOSAL](PRIVACY_RETENTION_PROPOSAL.md)).
Ce document ne constitue pas un avis juridique.

## 1. Situation actuelle

- La collecte d'événements produit (`trackLumenEvent` → `lumen.analytics_events`) est **désactivée en public** par `analyticsAllowed()`. Seules arrivent les sessions où elle est autorisée (QA, tests et environnements approuvés).
- Analytics reste utile sans elle, grâce aux **sources serveur** : reçus de quêtes (#727), défis, Défi du jour, santé de synchronisation, outbox et diagnostics. Ce sont les données qui font la progression et la sauvegarde, pas de la télémétrie.
- Ce qui manque **uniquement** à cause de la collecte désactivée :
  - le tunnel d'acquisition par canal (ouverture → quête 1 → première réussite) ;
  - la rétention J+1/J+7 des **invités** ;
  - les vues d'écrans (ciel, classements) et les abandons explicites des invités.

## 2. Intérêt attendu

| Question | Aujourd'hui | Avec collecte autorisée |
|---|---|---|
| D'où viennent les nouveaux joueurs ? | Non mesurable (échantillon de test) | Ouvertures et quête 1 par canal UTM (#759) |
| Les partages et vidéos amènent-ils des joueurs actifs ? | Non mesurable | Activation par canal, avec dénominateurs |
| Les invités reviennent-ils ? | Comptes seulement (reçus) | J+1/J+7 globaux sur identifiant pseudonyme |
| Quêtes abandonnées par les invités | Reçus seulement (réussites) | Débuts, aides et abandons explicites |

La rétention **par canal** resterait non mesurable par conception : aucun identifiant de campagne persistant. C'est voulu, et cela ne doit pas changer sans un nouvel arbitrage.

## 3. Données qui seraient collectées (schéma existant, pas d'ajout)

- **Événements** déjà instrumentés : `app_opened` (avec `acquisition_channel` limité à la liste autorisée), `attempt_started`, `attempt_completed`, `attempt_abandoned`, compteurs d'aides portés par ces tentatives, `share_result`, vues du Défi du jour regroupées dans l'enveloppe `app_opened`.
- **Identifiants** : `lumenAnonymousIdV1` (aléatoire, local, pseudonyme) et une session de 30 minutes ; `user_id` seulement pour un compte connecté.
- **Contexte** : version, plateforme, `traffic_type`.
- **Jamais collecté** : email, texte libre, URL complète, référent, identifiant de défi, sauvegarde. Les requêtes Analytics ne restituent que des agrégats.

## 4. Consentement et RGPD : options à arbitrer

| Option | Principe | Avantages | Risques / prérequis |
|---|---|---|---|
| A. Statu quo | Collecte désactivée | Aucun traitement supplémentaire | Acquisition et rétention des invités inconnues |
| B. Consentement explicite (opt-in) | Bandeau ou réglage « Aider à améliorer Lumen », refus par défaut | Base juridique claire, réversible | Échantillon biaisé et réduit ; texte et retrait à concevoir ; registre (#316) |
| C. Mesure d'audience exemptée | Collecte minimale strictement limitée à la mesure d'audience, sans consentement | Mesure plus complète | Conditions de l'exemption CNIL à **vérifier juridiquement** (finalité strictement limitée, agrégats, pas de recoupement, durées). Information et droit d'opposition à fournir. Plus exigeant à documenter |

**Recommandation** : l'**option B**, dans un premier temps, limitée à la liste d'événements ci-dessus.
- Le dispositif existant le permet sans nouvelle infrastructure : `analyticsAllowed()` dépendrait du choix du joueur.
- Pour un jeu familial (#316, mineurs), un refus par défaut est le choix le plus prudent.
- L'option C ne devrait être étudiée qu'après un avis juridique.

## 5. Coût, volume et conservation

- **Volume** : hypothèse de charge de #708, 10 000 joueurs × 20 événements par jour ≈ 6 millions de lignes par mois. Avec un opt-in, prévoir une fraction de ce volume.
- **Taille** : environ 0,5 à 1 Ko par ligne avec index. À 6 millions de lignes par mois, cela représente 3 à 6 Go par mois, à comparer au quota du plan Supabase.
- **Conservation** : **90 jours** pour les « statistiques facultatives », déjà approuvés le 2/11 ; agrégats conservés au-delà.
  - Prérequis bloquant : vérifier que la purge est **active** avant l'activation.
  - Les interactions de partage ont déjà une purge à 90 jours.
- **Performance** : les RPC d'Analytics sont bornées par période et ne renvoient que des agrégats. Au-delà d'environ 1 million de lignes, ajouter une table d'agrégats journaliers alimentée par une tâche planifiée (Lot D bis).
- **Transport** : file locale bornée, envoi asynchrone, abandon plutôt que blocage. La sauvegarde n'est jamais retardée.

## 6. Avant toute activation (liste de contrôle)

1. Décision écrite du propriétaire (option et périmètre).
2. Texte d'information, réglage de consentement et retrait (si option B), traduits FR/EN.
3. Purge à 90 jours active et testée, registre #316 mis à jour.
4. Marquage `traffic_source` des exécutions CI (complément du 18/11) pour exclure fiablement les tests.
5. Recette : visites taguées UTM, refus, retrait et hors ligne, sans double comptage.
