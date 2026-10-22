# Conservation technique — mécanisme préparé, non activé

Migration candidate : `20261022192259_lumen_technical_retention.sql`.
Aucun cron ni job automatique n'est créé. La PR reste en brouillon et cette
migration n'est pas appliquée en production. Les durées restent une politique
proposée à adopter avant activation ; les réglages fournisseurs sont distincts.

## Périmètre exact

- Statistiques techniques de plus de 90 jours : seulement la liste explicite
  d'événements dans la fonction. Victoires, tentatives, indices, événements
  inconnus, connexions au compte et preuves historiques de jeu sont exclus. Le backfill historique
  peut dépendre d'analytics : ne jamais élargir cette liste sans preuve de
  préservation des acquis. Cela ne prétend pas purger toutes les analytics.
- Retours au statut **closed** depuis plus de 180 jours, sans `privacy_hold`.
  `new`, `reviewed`, `fixed` et les dossiers sous conservation motivée sont
  conservés. Un retour ancien juste clôturé commence son délai à sa clôture.
- Abonnements push désactivés depuis plus de 90 jours. Aucun abonnement actif
  n'est supprimé. Réactivation et réouverture remettent les compteurs à zéro.

Les dates sont fixées par des triggers ; un appel client ne peut pas les
antidater. La migration démarre le délai des anciennes lignes clôturées ou
désactivées à sa propre date, faute de preuve de transition antérieure.
`privacy_hold` est réservé à l'opérateur ; documenter le motif dans le dossier
privé et revoir sa nécessité mensuellement. Les requêtes API ne peuvent pas
lever cette protection, même sous RPC SECURITY DEFINER avec JWT utilisateur.

Comptes, progression, droits, reçus, sauvegardes de récupération, incidents
ouverts, défis et barrière d'effacement ne sont pas purgés par cette fonction.
La rétention outbox à 30 jours déjà livrée reste séparée.

## Exécution après autorisation de production et adoption de la politique

1. Vérifier la version, le catalogue et les dépendances, puis l'accès propriétaire
   en session dédiée sans JWT utilisateur. Revoir les exceptions de conservation.
2. Prévisualiser avec `lumen_privacy.retain_technical_data()`. C'est une lecture
   seule, compatible avec un instantané REPEATABLE READ READ ONLY. Le résultat
   indique au plus 1 000 lignes éligibles par catégorie, pas la taille totale
   de l'historique. Aucun identifiant ni contenu personnel n'est retourné.
3. Pour appliquer, ouvrir une transaction READ COMMITTED avec délais locaux de
   verrou et de requête, puis appeler
   `lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA',1000)`.
   Chaque catégorie est limitée à 1 000 lignes ; les lignes verrouillées sont
   ignorées et pourront être traitées au passage suivant. Ne pas confondre
   absence de lignes supprimées et preuve que toute la base est purgée.
4. Examiner les comptages puis COMMIT ou ROLLBACK. L'opération est atomique :
   une erreur dans une catégorie annule les suppressions précédentes.
5. Une exécution quotidienne éventuelle nécessite une activation explicite
   ultérieure. Le présent chantier n'installe aucun planificateur supplémentaire.

SECURITY INVOKER, `search_path` vide, aucun accès PUBLIC/anon/authenticated/
service_role au schéma et à la fonction. Les trois tables sont verrouillées
contre les modifications concurrentes de contraintes/triggers avant la revue
de dépendances. Les écritures ordinaires restent possibles ; une réactivation
en cours est ignorée via SKIP LOCKED. Les gardes d'effacement existantes restent
actives et la fonction refuse leur dérive ou celle des horloges de rétention.

## Preuves et retour arrière

Fixtures SQL : bornes, aperçu, dates forgées, réouverture/réactivation, dossier
sous conservation, rôles API, rollback et préservation progression/reçus.
La simulation d'ancienneté désactive seulement les nouveaux triggers de date
sur données fictives, puis les réactive avant les tests de purge ; les gardes
d'effacement restent actives. PostgreSQL 17 CI vérifie les vraies connexions
concurrentes dans `technical-retention-concurrency.py`. Aucune recette de
production n'est revendiquée.

Une lecture des conseillers Supabase a porté uniquement sur l'état de
production antérieur. Elle ne valide pas une migration non appliquée et ne
prouve pas l'absence d'alertes existantes. Qualification séparée :
[RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[fonctions accessibles à anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[fonctions accessibles à authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
Le nouvel accès privé est vérifié dans les fixtures sous les trois rôles API ;
aucune politique de production n'a été modifiée pour faire disparaître un avis.

Avant COMMIT, ROLLBACK annule les effets. Après COMMIT, une donnée technique
supprimée n'est pas reconstruite par la fonction ; une restauration éventuelle
doit respecter les effacements intervenus depuis la copie. Pour retirer le
mécanisme, préparer une migration distincte ; ne pas retirer les gardes privées
d'effacement ou effacer le schéma `lumen_privacy`.
