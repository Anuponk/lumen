# Plan de séparation Lumen Auth — audit des dépendances (2026-10-11)

**Statut : préparation uniquement. Aucun déploiement, aucune migration, aucun changement SoldeZen.**

## Objectif et contrainte non négociable

Faire envoyer les OTP Lumen par `auth@nopuna.fr` sans modifier le flux déjà fonctionnel de SoldeZen. L'envoi manuel via Resend a été reçu, mais il ne prouve pas encore l'intégration à Supabase Auth.

## État actuel vérifié

- `src/persistence/cloud.js` utilise `supabase.auth.signInWithOtp({options:{shouldCreateUser,emailRedirectTo}})`, `verifyOtp(...type:'email')` et `signInWithOAuth({provider:'google'})`.
- La restauration de profil et la synchronisation des progrès dépendent de la session et de l'ID utilisateur Supabase.
- Le projet Supabase partagé `tjdjlavmusmncuszhsuw` contient les données métier Lumen sous `lumen`.
- Analyse *lecture seule* du catalogue PostgreSQL (2026-10-11) : les tables `lumen.users`, `profiles`, `progress`, `daily_progress`, `engagement_state`, `entitlements`, `profile_snapshots`, `internal_capabilities` portent `user_id uuid` avec FK vers `auth.users(id)` et `ON DELETE CASCADE`. Plusieurs autres tables (analytics, difficulty ratings, feedback, historical performance et social challenges/participations) ont des références à `auth.users(id)` avec `ON DELETE SET NULL`.
- Ne surtout pas supprimer des comptes Auth existants : la cascade effacerait des données de jeu.

## Point bloquant technique

Créer un Auth Supabase distinct sans migrer les données métier n'est **pas** un simple changement de clé/URL. Les jetons JWT de la nouvelle instance, les `auth.uid()`, les RLS/RPC et les contraintes FK de l'ancienne instance ne fonctionneront pas automatiquement ensemble. Même en conservant des UUID identiques, l'ancienne API n'accepte pas automatiquement les jetons émis par la nouvelle instance.

## Option recommandée à étudier en priorité

Migrer **l'identité et les données Lumen seulement** dans un projet isolé lorsque les prérequis de quota, sauvegarde, données et scripts de migration auront été validés. Garder SoldeZen entièrement sur le projet actuel.

### Plan en phases et points d'arrêt

1. **Inventaire lecture seule** : tables, schémas, RLS, RPC, triggers, storage, identités Google/email, rôles et clés externes ; cartographier `auth.users.id` et chaque clé étrangère métier ; vérifier les comptes et sauvegardes sans exporter de données personnelles dans Git.
2. **Environnement de recette isolé** : projet distinct (attention : quota Free actuel occupé), migrations SQL revues, Google OAuth callback, SMTP/Resend dédié à Lumen, redirections `lumen.nopuna.fr` exclusivement.
3. **Migration répétable** : réaliser l'export chiffré privé et les imports des comptes et données Lumen, conserver les correspondances d'identifiants et relations ; évaluer la faisabilité de continuité d'identité OTP/Google et les parcours de reconnexion. Ne pas stocker secrets, emails de joueurs, tokens ou exports dans Git.
4. **Tests E2E sans bascule** : nouvel invité, compte email, Google, migration d'un compte ancien, reprise de progression/badges/éclats/achats/défis, comptes multiples et sur plusieurs appareils ; erreurs réseau, expiration OTP, redirections, RLS, restauration.
5. **Bascule avec accord explicite** : export final cohérent, gel temporaire des écritures si requis, bascule Lumen uniquement, observation, rollback incluant les écritures effectuées après bascule. SoldeZen ne change jamais de configuration.
6. **Nettoyage différé** : seulement après période de stabilité et procédure de restauration testée ; interdiction de supprimer les anciens comptes Auth tant que les FK cascades existent.

## Hypothèses à confirmer

- Quelle cible d'hébergement Auth est disponible au regard du quota Supabase Free actuel ? Ne pas libérer de projet existant sans accord.
- Réconcilier OAuth Google et comptes email existants ; vérifier les limitations d'export/import Auth (hash, identités, sessions).
- Vérifier si les profils snapshot, achats et défis ont d'autres références indirectes.
- Valider la méthode de migration et de retour arrière avant toute implémentation effective.

## Critères d'acceptation de la future PR technique

- Emails Lumen par `auth@nopuna.fr` avec code OTP réellement vérifiable et redirection Lumen uniquement.
- SoldeZen : flux, expéditeur, utilisateurs, DNS, hooks et templates strictement inchangés.
- Aucun compte ou progression Lumen perdu ; égalité des données et conservation des autorisations vérifiées.
- CI, matrice E2E et procédure de rollback réussies.
