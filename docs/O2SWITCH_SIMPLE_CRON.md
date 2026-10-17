# Publication Lumen : GitHub Actions et cron de secours (o2switch)

## Publication après fusion

Le workflow `deploy-o2switch.yml` attend **Lumen quality gate**, **Cloud
reconciliation matrix** et **Canonical ledger SQL regression** sur le SHA exact
de `main`. Les PR ne déploient jamais. Il appelle ensuite le récepteur HTTPS
signé, attend le résultat du worker et vérifie le SHA public de `build-info.json`.
Le serveur revérifie indépendamment les trois contrôles GitHub, l'appartenance
à main et le refus des retours en arrière. La publication conserve le verrou
partagé avec le cron, les sauvegardes et la restauration sur erreur.
La copie des assets reste non atomique.

L'accès SSH entrant des runners GitHub a expiré avant authentification sur
`distil.o2switch.net:22`, et les jetons API cPanel sont désactivés sur ce compte.
HTTPS remplace donc SSH dans le workflow. Le dépôt Lumen est public : son remote utilise aussi HTTPS, sans clé SSH
ni jeton pour la récupération. Le refus sortant du port 22 est ainsi évité.
Les anciens secrets SSH/API ne sont plus utilisés par GitHub Actions.

## Installation du récepteur HTTPS

1. Après fusion et CI verte, ouvrir le Terminal cPanel puis exécuter :

   ```bash
   (
     set -e
     exec 9>"$HOME/.lumen-cron-publish.lock"
     flock -w 120 9
     cd "$HOME/lumen-staging"
     git remote set-url origin https://github.com/Anuponk/lumen.git
     git pull --ff-only origin main
     bash scripts/o2switch-install-webhook.sh
   )
   ```

   Le sous-shell libère le verrou à la fin. L'installateur est réexécutable et
   conserve le secret existant. Il installe le code PHP et le worker dans
   `~/lumen-private`, droits 700/600, et un simple wrapper public sans secret
   `~/lumen.nopuna.fr/lumen-deploy.php`. PHP 8.1+ avec `exec`, Bash, nohup,
   timeout, Python et les outils du publisher sont nécessaires. Le contexte
   PHP web doit aussi autoriser exec ; le premier appel authentifié le vérifie.

2. Dans le **Gestionnaire de fichiers cPanel**, ouvrir
   `/home/yuae0754/lumen-private/deploy-webhook-secret` et copier les 64 caractères
   dans GitHub → dépôt Lumen → **Settings → Secrets and variables → Actions →
   New repository secret** : `O2SWITCH_DEPLOY_WEBHOOK_SECRET`.
   Ne jamais coller cette valeur dans le chat, les logs ou Git.
   Conserver la variable `O2SWITCH_DEPLOY_ENABLED=true`. Aucune clé API cPanel
   et aucune connexion SSH entrante ne sont nécessaires.

3. Ouvrir **Actions → Deploy Lumen to o2switch → Run workflow → main**.
   Contrôler le succès et le SHA exact de
   https://lumen.nopuna.fr/build-info.json. Tant que ce test réel n'est pas passé,
   l'activation reste en attente. Un simple HTTP 202 signifie « accepté »,
   jamais « déployé ». Le cron toutes les dix minutes reste un secours.

Les modifications ultérieures du récepteur/worker nécessitent de relancer
l'installateur après mise à jour du checkout validé ; les merges ordinaires
de l'application se publient automatiquement sans cette intervention.
Pour désactiver le déclencheur, retirer le wrapper public et passer la variable
GitHub à false. Pour renouveler le secret, remplacer le fichier privé par un
nouveau secret aléatoire hexadécimal de 32 octets et actualiser le secret GitHub.

## Contrat de sécurité et diagnostic

Chaque POST contient uniquement action (deploy/status) et SHA complet. L'en-tête
X-Lumen-Signature contient `sha256=HMAC(secret, timestamp + "\n" + corps brut)` ;
X-Lumen-Timestamp expire après cinq minutes. La comparaison est constante,
les requêtes dépassant 1 Ko et toute commande arbitraire sont rejetées.
Les signatures de déclenchement déjà acceptées ne relancent pas de worker.
Un job en cours pour le même SHA n'est pas lancé une seconde fois.
Le worker a une limite de huit minutes. Ses états et logs restent privés dans
`~/lumen-private/deploy-jobs/SHA.{json,log}`, sans secret ; le statut HTTP
signé ne fournit jamais le contenu des logs. Les reçus anti-rejeu expirés
sont nettoyés à la prochaine demande de publication. Les logs de jobs et
sauvegardes nécessitent une rétention manuelle.

GitHub ne suit aucune redirection du récepteur et ne journalise pas les
signatures. Une requête non authentifiée ne lance aucun processus. Le script
public ne reçoit jamais de chemin, d'option shell ou de clé privée.
Le publisher explicite `--deploy SHA` ignore le cooldown de cinq minutes du
cron et ne choisit jamais un ancien commit de remplacement. Un échec CI,
serveur ou version publique fait échouer le workflow.

## Tests du déploiement

`python3 scripts/o2switch-deploy-tests.py` couvre les trois contrôles du
SHA exact, les PR/forks/branches exclus, le publisher jetable, les retours
en arrière, le dry-run, le cooldown, l'idempotence et le rollback HTTP.
`python3 scripts/o2switch-https-tests.py` lance un vrai serveur PHP jetable :
signature invalide/expirée/future, corps invalide/trop grand, injection shell,
secret absent, statut protégé, lancement du vrai worker sur Linux,
répétition sans double exécution et remontée des échecs. Le client vérifie
les refus HTTP, les redirections interdites et le SHA public discordant.
Ces tests ne touchent ni o2switch, ni secrets réels, ni données joueurs.
Ils sont exécutés dans la quality gate.

## Fonctionnement du cron de secours

Le document root `~/lumen.nopuna.fr` reste un **dossier réel** (pas de lien symbolique à configurer).

Le script `scripts/o2switch-cron-publish.sh` récupère le dépôt depuis son remote GitHub HTTPS public, attend un workflow **push sur main** terminé en succès pour le SHA exact, et ne publie que lorsqu'une nouvelle version est disponible. Il prépare les fichiers en dehors du document root, archive le site public dans `~/lumen-deploy-backups`, copie les assets et restaure l'archive si copie ou vérification HTTP échoue. Il ne modifie jamais Supabase ni les données locales des joueurs. **Il ne s'agit pas d'une publication atomique : un visiteur peut voir des ressources mélangées pendant la copie.** Le script ne garantit pas le rollback d'une panne brutale du serveur ou d'un SIGKILL.

## Test sans publication

Depuis SSH, après merge et réussite du workflow push/main :

```bash
cd ~/lumen-staging
git remote set-url origin https://github.com/Anuponk/lumen.git
git pull --ff-only origin main
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

**Une seule tâche cron Lumen**, toutes les dix minutes, séparée de celle de Nopuna. Conserver la tâche existante comme secours :

```cron
*/10 * * * * /bin/bash /home/yuae0754/lumen-staging/scripts/o2switch-deploy-monitor.sh >> /home/yuae0754/lumen-deploy.log 2>&1
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
