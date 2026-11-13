# Audit #560 — étape 1 : cartographie préliminaire (13 novembre 2026)

> Statut : **partiel / lecture seule**. Inspection ciblée de fichiers sur `main` ; ne constitue ni preuve de sûreté globale ni décision d'architecture. Aucune donnée joueur consultée ou modifiée.

## Modules et responsabilités observés

| Composant | Référence code | Rôle constaté |
|---|---|---|
| UI / orchestration | `src/ui/game-screen.js:24-33` | Assemble persistance locale, cloud, compte invité, récupération et réconciliation |
| Persistance locale | `src/persistence/local.js:5` | Fabrique d'accès à la progression locale ; détails des clés et écritures à approfondir |
| API cloud | `src/persistence/cloud.js:3-202` | Appels Supabase : inscription, profil, progression, droits, daily et historique |
| Profil cloud / réconciliation | `src/persistence/cloud-profile.js:28-78,353-595,757-1010` | Validation, backup/restore, comparaison, récupération des succès, initialisation, CAS et réconciliation |
| Réclamation invité | `src/persistence/guest-claim.js:5-35` | Capture puis revendication d'un profil invité avec reçu serveur |
| Sauvegardes de récupération | `src/persistence/cloud-profile.js:653-690` | Snapshot IndexedDB `lumenCloudRecoveryV1` |
| Entretien stockage | `src/persistence/storage-maintenance.js:22-151` | Mesure des quotas et archivage des sauvegardes vers IndexedDB |

## Premiers constats vérifiables

1. Plusieurs mécanismes coexistent : RPC Supabase de progression (`lumen_save_progress`), profil cloud avec CAS (`lumen_cas_profile`), revendication invité (`lumen_claim_guest_profile`) et snapshots locaux. **Coexistence n'est pas preuve de conflit** : il faut tracer l'autorité de chaque type d'acquis.
2. La récupération cloud dispose de fonctions explicites de vérification (`loadVerifiedProfile`), sauvegarde (`backupAndVerifyProfile`) et de réconciliation (`reconcileCompatibleCloudProfiles`). Leur présence ne garantit pas la convergence en conditions de course.
3. La récupération IndexedDB est distincte du quota localStorage, ce qui protège certains cas de saturation ; il reste à vérifier les échecs combinés et l'absence de perte lors des transitions.
4. La revendication invité consulte un reçu serveur après l'appel RPC ; vérifier l'idempotence et le comportement en cas de coupure entre RPC et ACK.

## Étape 2 à poursuivre

- Tracer toutes les écritures et leurs appels depuis l'UI, y compris outbox, badges, records, wallet et droits.
- Relier les incidents #530, #536, #537, #557 aux tests RED/GREEN et aux commits.
- Construire une matrice d'invariants (non-perte, exactement une fois, non-contamination, convergence, quotas, offline).
- Ne recommander aucune refonte avant ces preuves.

## Garde-fous

Audit documentaire uniquement. Aucun correctif métier, migration, backfill, suppression de sauvegarde, accès aux profils réels ou déploiement.

## Incidents historiques — première confrontation aux tickets (étape 2, partielle)

| Ticket | Preuve documentaire | Limite de preuve |
|---|---|---|
| [#530](https://github.com/Anuponk/lumen/issues/530) | Logs du 22/10 : `SIGNED_IN` puis `INITIAL_SESSION`, checkpoint wallet IndexedDB, `cloud_achievements_recovery_blocked`, `profileReady=false` | Blocage observé, **aucune perte définitive démontrée** ; ticket clos, ne prouve pas la guérison de #536 |
| [#536](https://github.com/Anuponk/lumen/issues/536) | PR #543 traite le quota de copie locale ; ticket reste ouvert | Pas de preuve de résolution du conflit wallet/récompenses sur appareil réel |
| [#537](https://github.com/Anuponk/lumen/issues/537) | Quêtes précédemment terminées affichées non jouées et verrouillées ; ticket clos | Ni effacement serveur ni cause commune avec #536 démontrés ; distinguer projection et stockage |
| [#557](https://github.com/Anuponk/lumen/issues/557) | Quête 7 verrouillée après inscription à la quête 6 ; ticket clos « not planned » le 13/11 | La clôture ne démontre pas une correction ; recette multi-appareil et conservation cloud à vérifier |

### Invariants — statut provisoire

- **Non-perte des acquis** : non démontré de bout en bout ; protections de backup et CAS observées.
- **Pas de double récompense** : non démontré de bout en bout ; reçus et mécanismes de revendication présents.
- **Migration invité vers compte** : partiel ; protocole de claim présent, cas #557 historique à vérifier.
- **Convergence multi-appareil** : non démontrée à ce stade.
- **Tolérance aux quotas** : partielle ; archive IndexedDB et PR #543 documentées, cas de double saturation non étudié.
- **Non-contamination entre comptes** : non démontrée ; vérifier contrôles d'identité et générations de session sur toutes les écritures.

**Ne pas confondre « ticket clos » et « invariant prouvé ».** Les éléments ci-dessus sont des constats documentaires, pas des résultats de tests nouvellement exécutés.
