# Cron simple Lumen (o2switch)

Le document root `~/lumen.nopuna.fr` reste un **dossier réel** (pas de lien symbolique à configurer).

Le script `scripts/o2switch-cron-publish.sh` utilise la clé SSH GitHub read-only, attend un workflow **push sur main** terminé en succès pour le SHA exact, et ne publie que lorsqu'une nouvelle version est disponible. Il prépare les fichiers en dehors du document root, archive le site public dans `~/lumen-deploy-backups`, copie les assets et restaure l'archive si copie ou vérification HTTP échoue. Il ne modifie jamais Supabase ni les données locales des joueurs. **Il ne s'agit pas d'une publication atomique : un visiteur peut voir des ressources mélangées pendant la copie.** Le script ne garantit pas le rollback d'une panne brutale du serveur ou d'un SIGKILL.

## Test sans publication

Depuis SSH, après merge et réussite du workflow push/main :

```bash
cd ~/lumen-staging
GIT_SSH_COMMAND="ssh -i ~/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes" git pull --ff-only origin main
bash scripts/o2switch-cron-publish.sh --dry-run
```

Contrôler `DRY RUN: ready to deploy ...`. Ne pas activer le cron avant le résultat de ce test.

## Première publication manuelle

```bash
bash ~/lumen-staging/scripts/o2switch-cron-publish.sh --deploy
```

Vérifier `https://lumen.nopuna.fr/`, les badges authentifiés, la PWA et les erreurs réseau. Ne pas effacer localStorage.

## Cron cPanel (après validation de la publication)

Lumen réutilise le transport d'alertes de Nopuna : `~/nopuna-staging/scripts/o2switch-notify.php` et la clé Brevo privée déjà configurée sous `~/nopuna-private/brevo-key`. Il n'envoie **aucun email de succès ni de rétablissement**. À la première erreur réelle il tente un email `[Lumen] Échec de déploiement`; les répétitions restent silencieuses jusqu'à la prochaine publication réussie. Une CI encore en cours (code retour 75) n'est pas considérée comme un échec. Le transport Brevo peut échouer indépendamment ; un moniteur externe serait nécessaire pour surveiller l'arrêt complet du cron.

**Une seule tâche cron Lumen**, toutes les minutes, séparée de celle de Nopuna. Dans cPanel, désactiver toute ancienne tâche Lumen avant de l'ajouter :

```cron
* * * * * /bin/bash /home/yuae0754/lumen-staging/scripts/o2switch-deploy-monitor.sh >> /home/yuae0754/lumen-deploy.log 2>&1
```

Le verrou `flock` empêche les exécutions concurrentes. Le log doit être redirigé dans un fichier pour éviter que cPanel n'envoie un email chaque minute. Une CI non verte ou une panne GitHub empêche le déploiement. Les sauvegardes dans `~/lumen-deploy-backups` s'accumulent et nécessitent une politique de rétention ; ne pas supprimer la dernière archive de reprise. Contrôler périodiquement les logs et le fonctionnement du cron.

## Tester les notifications (sans incident réel)

```bash
printf 'Test de notification Lumen (aucun incident réel).\n' | php ~/nopuna-staging/scripts/o2switch-notify.php '[Lumen] Test alerte'
```

Vérifier la réception de l'email sur la même adresse que les alertes Nopuna. Ne pas afficher la clé Brevo.

## Restauration manuelle d'urgence

Après avoir stoppé le cron, identifier l'archive souhaitée :

```bash
ls -lt ~/lumen-deploy-backups/
```

Inspecter l'archive et restaurer sous supervision avec `tar -xzf` dans le docroot en vérifiant que les fichiers de cette archive correspondent à une version connue. **Ne pas automatiser cette restauration à partir d'un nom d'archive non validé.**
