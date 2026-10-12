# Audit Analytics #261 — Supabase Free (11/10/2026)

## Mesures en lecture seule
- `lumen.analytics_events`: 53 619 événements, 37 658 624 octets table + index + TOAST.
- Heap: 18 423 808 octets; index: 19 193 856 octets.
- Top 3 événements : puzzle_start 25 999, session_start 13 307, puzzle_complete 7 907 (88 % environ).
- Intervalle 02/10 au 11/10 : aucune rétention à 30 ou 90 jours ne peut réduire sensiblement la base maintenant.
- 4 347 identifiants anonymes distincts / 2 utilisateurs identifiés : ne pas confondre avec joueurs humains (QA et tests).

## Index redondants identifiés (à examiner, PAS à supprimer automatiquement)

| Index candidat | Octets | idx_scan observés | Index de couverture existant |
|---|---:|---:|---|
| analytics_events_anon_idx | 4 939 776 | 8 | analytics_events_anonymous_occurred_idx : 4 915 200 octets, 193 022 scans |
| analytics_events_occurred_idx | 1 220 608 | 2 | analytics_events_occurred_at_idx : 1 220 608 octets, 140 scans |

Potentiel brut **6 160 384 octets (~5,9 MiB)**, sans extrapoler mécaniquement à la taille finale du projet. Les statistiques `idx_scan` peuvent être réinitialisées et ne prouvent pas l'inutilité d'un index. Les deux couples ont des définitions de colonnes identiques dans `pg_indexes`; contrôler malgré tout contrainte, unicité, plans et requêtes du cockpit avant suppression.

### Requête d'audit non destructive

```sql
SELECT s.indexrelname, s.idx_scan, pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size, i.indexdef
FROM pg_stat_user_indexes AS s
JOIN pg_indexes AS i
  ON i.schemaname = s.schemaname
 AND i.tablename = s.relname
 AND i.indexname = s.indexrelname
WHERE s.schemaname = 'lumen'
  AND s.relname = 'analytics_events'
ORDER BY pg_relation_size(s.indexrelid) DESC;
```

### Séquence sécurisée avant nettoyage
1. Comparer `pg_get_indexdef`, `pg_index.indisunique`, `indisprimary`, `indpred`, `indisvalid` et les dépendances de contraintes.
2. Inspecter EXPLAIN (ANALYZE, BUFFERS) sur requêtes représentatives cockpit/acteurs/DAU/WAU, sur environnement de test.
3. Envisager `DROP INDEX CONCURRENTLY` pour **les deux seuls index candidats**, dans des opérations séparées hors transaction, avec monitoring. **Ne rien exécuter tant que les validations ne sont pas faites.**
4. Préparer le rollback `CREATE INDEX CONCURRENTLY` avec le DDL exact avant changement.
5. Mesurer le volume réel libéré, la latence et les écritures.

### Suite nécessaire pour 10 000 joueurs
Limiter la télémétrie inutile à la source ; mesurer les vrais utilisateurs (exclure robots/QA), les événements par session et l'egress ; définir agrégats et rétention après vérification des métriques du cockpit ; ne jamais appliquer une purge aux tables de progression, achats ou entitlement.

**Ce document n'exécute aucune modification SQL et ne modifie aucune donnée de joueur.**
