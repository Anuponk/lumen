# Issue #316 — état réel du lot A (audit du 1er novembre 2026)

**Ne pas réimplémenter l'effacement : le dépôt contient déjà la préparation technique issue de la PR #526.** Le présent fichier est un complément de vérification, pas une seconde politique d'effacement ni une autorisation d'effacer un joueur.

## Implémentation déjà présente dans main

- `supabase/migrations/20261022160212_lumen_account_erasure.sql` : politique privée d'effacement Lumen, barrières anti-résurrection, revue et transaction opérateur ; consulter `docs/ACCOUNT_DELETION_RUNBOOK.md` pour les conditions et dépendances.
- `supabase/migrations/20261022184145_lumen_account_rights_export.sql` : export privé d'accès et portabilité, voir `docs/ACCOUNT_RIGHTS_RUNBOOK.md`.
- `supabase/migrations/20261022192259_lumen_technical_retention.sql` : rétention technique candidate, non automatiquement activée.
- `/supprimer-compte.html`, `/confidentialite.html` et `/mentions-legales.html` : parcours et pages **candidats** ; le formulaire prépare un email, sans suppression automatique ni preuve de traitement.
- Références de tests et décisions : `docs/PRIVACY_P0_CONSOLIDATION.md`, `docs/PRIVACY_RELEASE_CHECKLIST.md`, `docs/TESTING.md` et PR #526.

## Contrôle effectué le 1er novembre

Le projet Supabase partagé est `tjdjlavmusmncuszhsuw` (SoldeZen). Les schémas `lumen`, `lumen_commands` et `lumen_private` sont présents ; `lumen_privacy` est **absent** d'après une requête sur `information_schema.schemata`. Cela confirme que la migration privée d'effacement n'est pas installée dans ce projet au moment du contrôle. Aucune migration ni suppression n'a été exécutée.

## Livraison encore bloquée

1. Vérifier la tête et la fusion effectives de #526 et les fichiers de main ; ne pas dupliquer ses fonctions ou ses triggers.
2. Relire l'inventaire réel des relations, les droits, les changements depuis le 25 octobre et la sauvegarde/restauration ; appliquer les migrations seulement après décision explicite distincte couvrant la production.
3. Effectuer la recette opérateur sur identité fictive dédiée, y compris compte partagé, défis tiers, assistance, diagnostic, anciennes écritures offline, erreurs/rollback et anciens appareils. Ne jamais tester une suppression sur un compte joueur réel sans demande vérifiée.
4. Finaliser les preuves éditeur, fournisseurs, conservation, pages légales, droits des mineurs et Data Safety. Les tests synthétiques ne valent pas validation juridique.

**Statut :** code préparé antérieurement, migration production absente, recette réelle et conformité éditoriale en attente. Issue #316 reste ouverte. Aucun changement de gameplay, onboarding ou synchronisation dans cette PR.

## Compatibility finding

The live `lumen_commands.support_access` table currently has no `privacy_owner_id` column. The prepared migration's `lumen_privacy.install_guards()` intentionally adds and backfills it transactionally. Do not apply this ALTER separately. The schema, migration dependencies, and restoration barriers require isolated integration testing before production installation.


## Production status — 2026-11-01 (supersedes historical status above)

The Lumen-only erasure migration was applied to shared Supabase project `tjdjlavmusmncuszhsuw` after PR #602 was merged. Read-only checks confirmed the private `lumen_privacy` schema, operator `erase_account(uuid,text[],text)` function, 38 erasure guard triggers, and no schema USAGE for `anon`, `authenticated`, or `service_role`. A read-only `review_erasure` with the nil UUID and no actors succeeded. **No real user was erased.** The earlier statement that the migration is absent is historical.

### Operator acceptance checklist

1. Log the incoming request and verify identity and any parental authority proportionately; an email address alone is not proof.
2. Resolve the verified Lumen UUID and linked anonymous actors, avoiding cross-user matching. Never delete shared `auth.users` or SoldeZen data for a Lumen-only request.
3. Run the read-only `lumen_privacy.review_erasure` for that verified UUID and verified actor array. Review table scope, third-party social challenges, support records, pending offline writes and backup obligations.
4. Obtain explicit approval for the exact account and scope. Execute the operator-only `erase_account` with the confirmation string required by its SQL definition. Never run this operation against a real account as a test.
5. Verify result and non-resurrection; separately address vendor copies, backups, sessions and lawful retention. Do not confirm completion until these are checked.

Synthetic PostgreSQL CI tests and a nil-UUID read-only review do not constitute a live end-to-end erasure rehearsal or RGPD/Google Play legal approval. The user-facing form initiates an email request; it does not automatically erase the account. Review Supabase RLS advisor notices separately.
