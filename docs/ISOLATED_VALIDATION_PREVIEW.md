# Aperçu isolé de recette Lumen

Cet aperçu est un outil de validation à conserver et à maintenir. Il permet de
tester sur un vrai téléphone l'interface, les célébrations, le stockage et la
PWA, avec un compte fictif et un cloud simulé, sans utiliser un compte joueur ni
créer une base Supabase payante. Il complète la CI et les tests PostgreSQL ;
il ne les remplace pas.

## Identité et sources durables

| Élément | Référence vérifiée le 22 octobre 2026 |
|---|---|
| Aperçu privé existant | https://lumen-p0-523-validation.espace-de-tr-8395.chatgpt.site |
| Projet Sites à réutiliser | `appgprj_6ad9b3dc36e08191a915a1d53992ca3f` |
| Recette publiée | **Recette v2**, commit source Sites `3e07114cb951657e3449381594e9a17168a1bebe` |
| Version Sites | `appgprj_6ad9b3dc36e08191a915a1d53992ca3f~appgver_8b7ce2cecc248191b680f97af6590fa5` |
| Déploiement Sites réussi | `appgdep_6ad9bf2825d081919659fd7182e533c4` |
| Code applicatif testé | `65770fab037e611ad6d76f4503e15bc8dc1a5416`, candidat de la [PR #523](https://github.com/Anuponk/lumen/pull/523) |
| Livraison Lumen qui a suivi | `c78c4daeef791deec77d2d7bd39e5497253e862b`, `1.11.1+490` |

Le dépôt source du projet **Sites** conserve le site complet : application sous
`dist/`, fixture, configuration d'isolation et vérificateur. C'est la source de
vérité de l'aperçu publié. Le dépôt Lumen conserve ici le mode opératoire et une
[archive technique de la recette v2](validation/isolated-preview-20261022/README.md).
Les fichiers temporaires d'une ancienne session Codex ne sont pas une dépendance
durable : récupérer le dépôt Sites avec son identifiant, sans recréer le projet.

Le SHA de l'application, le SHA du site et le SHA de livraison sont différents.
La version commerciale affichée dans la page ne suffit pas à identifier la
recette ni les modules chargés. `validation-info.json` conserve le candidat,
`environment: isolated-validation`, `backend: browser-fixture`,
`productionData: false` et `recipeVersion: 2`.

## Ce que fait la simulation

L'application utilise ses modules habituels. Seuls la configuration de backend,
le chargement du SDK, les métadonnées de build et le panneau de recette sont
adaptés dans le paquet séparé ; aucun mode de test n'est activé en production.

- `dist/index.html` remplace le SDK Supabase distant par
  `/src/testing/validation-fixture.js`.
- `dist/src/persistence/config.js` utilise `https://simulated-cloud.invalid`
  et une clé fictive ; aucun secret ni endpoint de production n'est nécessaire.
- La fixture fournit `window.supabase.createClient`, une session fictive et des
  réponses RPC. Elle provient de la fixture existante de
  `scripts/wallet-flow-browser.mjs`, avec persistance du faux serveur entre
  rechargements et contrôles visibles. Les divergences doivent rester expliquées.
- Le faux serveur, ses reçus et son nombre de débits restent dans le navigateur
  du même appareil. Les outbox, tentatives, IndexedDB et caches PWA de
  l'application sont réellement utilisés.

Le compte initial de cette recette est un exemple fixe avec des quêtes déjà
résolues et dix Éclats fictifs, pas un modèle de toutes les campagnes futures.
La fixture ne couvre pas tous les RPC : certaines capacités sont volontairement
déclarées absentes. Ne pas interpréter un retour générique de simulation comme
la preuve qu'un protocole supplémentaire est testé.

### Commandes visibles

Le bandeau doit afficher **Recette v2 · TEST GRATUIT · compte fictif · cloud
simulé**. Ouvrir **Commandes de recette**.

| Commande / indicateur | Utilisation |
|---|---|
| Panne victoire : active/inactive | Force un refus simulé de la commande de victoire, sans couper les autres lectures. Désactiver avant de tester la vraie coupure réseau. |
| Réponse perdue : active/inactive | Simule une réponse perdue après application d'une dépense côté faux serveur ; la reprise doit retrouver le même reçu sans second débit. |
| Résoudre pour la recette | Place la solution via les diagnostics existants ; accélère la recette sans changer la logique normale de victoire. |
| Recharger | Recharge le document, sans effacement du stockage. |
| Éclats affichés / simulés / débits | Compare la vue et l'autorité fictive ; les valeurs ne sont pas un solde joueur réel. |
| Victoires confirmées | Nombre de reçus du faux serveur ; ne doit pas augmenter lors d'une nouvelle victoire réellement hors ligne. |
| Cloud simulé : joignable/injoignable | Résultat du dernier contrôle de transport RPC, pas une surveillance réseau permanente. Le statut de synchronisation applicatif est affiché à côté. |

### Stockage à préserver lors des mises à jour

| Clé ou mécanisme | Propriétaire / rôle |
|---|---|
| `lumenValidationServerV1` | Fixture : profil, reçus et compteurs du serveur fictif |
| `lumenValidationVictoryFailure` | Fixture : état du bouton de panne de victoire |
| `lumenValidationLostReply` | Fixture : état de la simulation de réponse perdue |
| `lumenProgressV1`, `lumenActiveAttemptV1`, outbox et IndexedDB | Application : cache, tentative et intentions durables |
| Service worker et Cache API | Application : ressources publiques pour réouverture hors ligne |

Mettre à jour le site ne doit pas réinitialiser ces données. Pour un test vierge,
préférer un profil de navigateur de test distinct. Ne jamais purger le stockage
d'un joueur réel ni importer sa sauvegarde dans cette fixture.

## Défaut découvert et correction v2

La v1 utilisait seulement `navigator.onLine` avant les RPC fictifs. L'utilisateur
a observé en mode avion, Wi-Fi coupé, des célébrations et un compteur de victoires
confirmées qui augmentait. Le simulateur pouvait donc annoncer un succès sans
transport réseau disponible : cette recette a été refusée comme preuve de reprise.

La reproduction automatique coupe réellement HTTP tout en forçant
`navigator.onLine === true`. Avant correction, le compteur passe de deux à trois
alors que deux reçus seulement sont attendus. C'est un défaut du **simulateur**,
pas la démonstration d'une écriture Supabase hors ligne.

En v2, chaque RPC fictif vérifie d'abord une requête de même origine vers
`/validation-info.json`, avec `cache: no-store`, délai borné à trois secondes et
contrôle de la réponse attendue. Ce chemin racine reste hors du cache de
ressources publiques de `sw.js`. Sans réponse valide, le RPC échoue avant la
mutation simulée. Si le worker évolue, vérifier à nouveau cette exclusion : une
sonde servie depuis un cache recréerait le faux positif.

## Recettes à conserver

Utiliser un compte fictif sur ce site privé. Noter version de recette, candidat,
Android/navigateur, mode installé ou onglet, état des boutons et compteurs avant
et après. Ne pas confondre une animation de victoire avec un reçu confirmé.

1. **Dépense et réponse perdue.** À partir du scénario d'aide prévu par la fixture,
   déclencher une aide payante avec réponse perdue. Vérifier un seul débit,
   reçu retrouvé et solde affiché conforme ; désactiver ensuite le bouton.
2. **Deux victoires avec panne simulée.** Activer Panne victoire, résoudre deux
   quêtes accessibles en continuant normalement. Célébrations visibles, statut
   en attente, aucun nouveau reçu confirmé. Désactiver la panne et recharger :
   les deux intentions doivent être reprises une seule fois.
3. **Vraie coupure réseau.** Recharger en ligne et vérifier Recette v2. Panne
   victoire inactive. Activer le mode avion et couper le Wi-Fi ; résoudre deux
   nouvelles quêtes. Elles restent en attente, sans nouveau reçu confirmé ni
   récompense confirmée. Revenir en ligne et recharger : une confirmation par
   intention, pas de double débit.
4. **Réouverture hors ligne.** Charger en ligne les ressources nécessaires puis
   fermer et rouvrir la PWA hors ligne avec travail en attente. Vérifier
   tentative/intention conservées, pas d'acquittement fictif, puis reprise au
   retour du réseau. Conserver le cas `navigator.onLine` trompeur en automatisation.
5. **Mise à jour de l'aperçu.** Avec travail en attente, publier la version suivante
   sur le même projet. Vérifier nouveau marqueur, modules et stores conservés,
   puis reprise des identités d'origine. Un changement de libellé HTML seul ne
   prouve pas la mise à jour du graphe de modules.

Résultats réellement obtenus le 22 octobre : tests navigateur sur stockage réel,
réponse perdue, deux victoires en attente, réouverture hors ligne, nouvelle victoire
hors ligne, reconnexion sans doublon ; coupure normale et indicateur de connexion
trompeur testés. L'utilisateur a confirmé sur Android **deux victoires en attente
en mode avion, puis confirmées après retour du réseau et rechargement**.
La recette de mise à jour d'une PWA installée n'est pas déduite de ce résultat.

## Récupérer, maintenir et publier

1. Retrouver le projet Sites ci-dessus avec `get_site`. Conserver propriétaire,
   audience privée et identifiant de `.openai/hosting.json`. Ne pas recréer un
   site pour chaque recette. Le lien reste stable tant que son identité est conservée.
2. Obtenir le credential temporaire du **même** dépôt avec
   `create_source_repository_write_credential`. Utiliser le helper Sites
   `scripts/site-workflow.mjs --project-id <identifiant exact>` pour ouvrir le
   checkout. Credentials uniquement en mémoire et via stdin masqué du helper,
   jamais dans les fichiers, commandes, logs ou cette documentation.
3. Choisir et figer le nouveau SHA applicatif. Exporter ses ressources publiques
   depuis Git dans le paquet isolé, réappliquer seulement les adaptations
   décrites plus haut et incrémenter la version de recette si le simulateur change.
   Conserver les identités de données fictives ou documenter leur migration.
4. Exécuter dans le dépôt Sites `node scripts/verify-isolation.mjs`. Relire sa
   couverture : candidat/build cohérents, endpoint et clé fictifs, SDK remplacé,
   absence de base hébergée. Vérifier aussi le transport réel hors ligne, la
   conservation des stores et les assertions de reçus/solde. Un simple bandeau
   visible n'est pas une preuve d'isolation ou de sécurité du simulateur.
5. Vérifier les différences avec le candidat : aucun changement de règles,
   catalogue, persistance ou gardes de production dissimulé dans le paquet de test.
   Tester les différences nécessaires de fixture plutôt que relâcher les assertions.
6. Packager et pousser via le helper Sites, puis publier le commit source exact
   avec `save_version_and_deploy_private`. Conserver la même audience. Suivre
   le statut jusqu'à `succeeded` ; relever candidat, recette, commit source,
   version et déploiement dans le bilan. Aucun nouveau service payant ne fait
   partie de ce processus.
7. Faire charger la nouvelle recette **en ligne** au testeur avant le mode avion.
   Vérifier le marqueur de version ; demander les compteurs si le résultat diverge.
   Ne pas faire répéter une recette identique sans examiner ce qu'elle mesure.

Le générateur initial et le pilote navigateur sont archivés comme références
historiques, pas annoncés comme des commandes portables installées dans Lumen.
Ils ont des hypothèses de répertoires, ports et navigateur ; le générateur initial
attend un SDK encore présent et ne doit pas être relancé aveuglément sur un
paquet déjà isolé. Leur industrialisation est la prochaine amélioration utile.

## Limites et pistes d'enrichissement

| L'outil permet de vérifier | Ce qui exige une autre preuve |
|---|---|
| UI mobile, célébrations, commandes et statut en attente | Compatibilité de tous les RPC et droits RLS réels |
| localStorage, IndexedDB, service worker sur le téléphone testé | Auth réelle, refresh de session et emails |
| Réessais et reçus du serveur fictif, sur un appareil | Transactions/concurrence PostgreSQL et cloud partagé entre appareils |
| Pannes injectées de la fixture | Diagnostic et récupération d'une divergence d'un joueur réel |

Loutre a été déclaré résolu séparément par le propriétaire ; le site de test
n'a ni chargé ni réparé ce compte. Le succès du preview ne remplace pas les
preuves de [récupération et livraison](CLOUD_RECOVERY_391.md).

Améliorations proposées, non encore livrées :

- **Priorité 1 :** générateur portable et idempotent à SHA explicite, pilote
  navigateur versionné comme outil exécutable, manifeste des différences et
  contrôle automatique interdisant toute destination de production.
- **Priorité 1 :** rapport exportable de recette sans tokens ni sauvegarde complète,
  avec versions, compteurs, modes réseau et résultats réellement exécutés.
- **Priorité 2 :** latence, timeout, réponses réordonnées, panne de stockage,
  quota, changement de session et conflits, chaque simulation liée à une
  assertion métier et un test du simulateur lui-même.
- **Priorité 2 :** campagne de mise à jour de PWA avec intentions en attente,
  vue claire du scénario actif et meilleure couverture des RPC canoniques.
- **Plus tard :** cloud partagé de test si un besoin le justifie et qu'une
  solution est explicitement acceptée ; ne pas introduire une dépendance payante
  ou utiliser la base des joueurs pour rendre cette simulation plus réaliste.

Toute évolution doit conserver le compte fictif explicite, l'isolation, l'audience
du site, les preuves exactes et la séparation entre célébration et confirmation.
