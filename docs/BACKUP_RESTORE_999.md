# Sauvegarde et restauration des données Lumen (#999)

Le plan Supabase Free ne fait aucune sauvegarde automatique. Le workflow **Lumen weekly encrypted backup** (`.github/workflows/lumen-backup.yml`) en tient lieu.

## Fonctionnement du workflow

- **Fréquence** : il tourne chaque dimanche à 02:17 UTC, en dehors des fenêtres de rétention (03:17 à 04:13 UTC). On peut aussi le lancer à la main sur `main`.
- **Contenu de l'export** :
  - les schémas `lumen`, `lumen_commands`, `lumen_privacy`, `lumen_ops` et `lumen_private`, structure et données : progression, reçus, achats, droits, registre d'effacement, fonctions d'exploitation et limites d'envoi de mails ;
  - les tables `auth.users` et `auth.identities`.

  `lumen.analytics_events` est exporté sans ses lignes. C'est de la télémétrie facultative, et ses 116 Mo coûteraient environ 200 Mo d'egress par export.
- **Chiffrement** : l'ensemble est chiffré avec `age`, avec la clé publique `LUMEN_BACKUP_AGE_RECIPIENT`, **avant** tout stockage. Seul le fichier `.age` est conservé, en artefact GitHub pendant 90 jours, soit environ 12 copies.
- **Contrôle de restauration** : chaque export est restauré dans un PostgreSQL 17 jetable. Toute copie de données en échec fait échouer le workflow, de même que toute table restaurée avec moins de lignes que le décompte pris juste avant l'export. Les fonctions et triggers qui dépendent d'objets absents de l'export (RPC `public`, pg_net, vault) peuvent échouer à la restauration : ils se reconstruisent à partir des migrations.
- **Confidentialité des journaux** : ils n'affichent ni ligne, ni décompte, ni identifiant. Ils n'indiquent que les noms de tables et le résultat, et le dépôt est public.
- **Coût** : environ 30 Mo d'egress par export.

## Configuration, une seule fois et par le propriétaire uniquement

1. **Clé de chiffrement**. Exécuter `age-keygen -o lumen-backup-key.txt`. Garder ce fichier **hors ligne**, dans un gestionnaire de mots de passe et sur un support amovible. Sans lui, aucune restauration n'est possible.
2. **Clé publique**. Déclarer la ligne `age1…` comme variable du dépôt : `gh variable set LUMEN_BACKUP_AGE_RECIPIENT --repo Anuponk/lumen`.
3. **Connexion**. Dans Supabase, aller dans **Connect** puis **Session pooler** (port 5432 : les runners GitHub n'ont pas d'IPv6). Récupérer l'URI avec le mot de passe de la base et l'enregistrer comme secret de l'environnement `production` : `gh secret set LUMEN_BACKUP_DATABASE_URL --env production --repo Anuponk/lumen`. Coller la valeur à l'invite, jamais en argument de commande.
4. **Premier test**. Lancer le workflow à la main et vérifier que le contrôle de restauration passe et que l'artefact `.age` est présent.

GitHub suspend les tâches planifiées d'un dépôt public sans activité depuis 60 jours. Il faut alors relancer le workflow à la main.

## Restaurer

À faire sur un poste de confiance, jamais dans un dépôt.

```bash
gh run download <run-id> --repo Anuponk/lumen --dir backup
age -d -i lumen-backup-key.txt -o lumen-backup.tar backup/*/lumen-backup-*.tar.age
tar -xf lumen-backup.tar          # lumen.dump, auth.dump, manifest.txt
```

1. **Cible**. Il faut un projet Supabase neuf, ou une base de recette, auquel on applique d'abord les migrations du dépôt dans l'ordre. Ne jamais restaurer par-dessus une base de production en service.
2. **Comptes**. Restaurer d'abord les comptes, en données seulement, avec `pg_restore --data-only --no-owner --dbname=<cible> auth.dump`.
3. **Données Lumen**. Restaurer ensuite `pg_restore --data-only --no-owner --disable-triggers --dbname=<cible> lumen.dump`. L'option `--disable-triggers` demande un rôle disposant de ce droit. Désactiver les triggers évite de rejouer les gardes d'effacement et les effets de bord pendant l'import.
4. **Contrôles**. Comparer les décomptes avec `manifest.txt` à l'aide de la requête `counts_sql` de `scripts/lumen-backup.sh`. Vérifier ensuite un compte de test, ses achats et sa progression.
5. **Ce que l'export ne couvre pas**. Les secrets Vault, les tâches pg_cron, les Edge Functions et les fichiers Storage n'en font pas partie. Les recréer d'après [RELEASE](RELEASE.md) et [OBSERVABILITY_946](OBSERVABILITY_946.md).

## Tests

`.github/workflows/lumen-backup-script.yml` exécute le script sur une base synthétique (`scripts/fixtures/backup-source.sql`), sans secret ni accès à la production. Il vérifie :

- l'export, la restauration et les décomptes ;
- l'exclusion des lignes d'`analytics_events` ;
- le maintien de la RLS ;
- l'échec du contrôle quand une table manque ;
- l'absence de données personnelles dans les journaux.
