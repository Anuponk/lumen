# Publication Lumen : GitHub Actions et cron de secours (o2switch)

## Publication après fusion

`.github/workflows/deploy-o2switch.yml` démarre après la réussite de **Lumen
quality gate** sur `main`, puis attend également **Cloud reconciliation matrix**
et **Canonical ledger SQL regression** pour le SHA exact. Il autorise
temporairement l'IP du runner via l'API cPanel, se connecte avec une clé dédiée,
publie le SHA validé et vérifie `build-info.json`. Les PR ne déploient jamais.
La variable `O2SWITCH_DEPLOY_ENABLED=true` active ce workflow une fois les
secrets installés. Un bouton **Run workflow** permet de relancer la publication
de `main` après configuration ou après un échec réseau.

La publication explicite `--deploy SHA` ne passe pas par le délai de cinq
minutes du cron et ne choisit jamais un ancien commit de remplacement. Le
serveur vérifie indépendamment les trois contrôles GitHub, le rattachement à
`main`, l'absence de retour en arrière et le verrou partagé avec le cron.
Les sauvegardes/restaurations existantes restent actives. Comme auparavant,
la copie du site n'est pas atomique.

## Configuration initiale

Connexion retrouvée dans le mail de bienvenue o2switch :
`distil.o2switch.net`, utilisateur `yuae0754`, port SSH `22`.
L'API de pare-feu utilise HTTPS sur le port `2083`.

1. Après fusion de cette modification, ouvrir le **Terminal cPanel** et mettre
   à jour le checkout propre, puis installer le dispatcher privé :

   ```bash
   cd ~/lumen-staging
   GIT_SSH_COMMAND="ssh -i ~/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes" git pull --ff-only origin main
   install -d -m 700 ~/lumen-private ~/.ssh
   install -m 700 scripts/o2switch-ssh-deploy.sh ~/lumen-private/lumen-ssh-deploy.sh
   ```

2. Créer une clé **dédiée à Lumen**, par exemple sur son ordinateur avec
   `ssh-keygen -t ed25519 -f lumen-actions -N ''`. Ajouter la clé publique
   (`lumen-actions.pub`) à `~/.ssh/authorized_keys` sur o2switch, précédée de :

   ```text
   restrict,command="/bin/bash /home/yuae0754/lumen-private/lumen-ssh-deploy.sh" ssh-ed25519 CLE_PUBLIQUE commentaire
   ```

   Conserver les autres clés ; appliquer `chmod 600 ~/.ssh/authorized_keys`.
   Cette clé accepte uniquement `deploy SHA`, sans shell interactif ni transfert
   arbitraire. La clé GitHub read-only déjà présente sur o2switch reste distincte.

3. Dans cPanel, créer un **jeton d'API** dédié à l'autorisation SSH. Dans
   GitHub → dépôt Lumen → Settings → Secrets and variables → Actions, ajouter :

   | Type | Nom | Valeur |
   |---|---|---|
   | Secret | `CPANEL_API_TOKEN` | Jeton cPanel |
   | Secret | `O2SWITCH_SSH_PRIVATE_KEY` | Contenu de la clé privée dédiée |
   | Secret | `O2SWITCH_SSH_KNOWN_HOSTS` | Clé publique du serveur, vérifiée |
   | Variable | `CPANEL_SERVER` | `distil.o2switch.net` (valeur par défaut) |
   | Variable | `CPANEL_USERNAME` | `yuae0754` (valeur par défaut) |
   | Variable | `O2SWITCH_DEPLOY_ENABLED` | `true` après configuration |

   `known_hosts` doit contenir `distil.o2switch.net ssh-ed25519 CLE_DU_SERVEUR`
   (ou le type de clé réellement fourni). Récupérer et vérifier cette clé
   auprès du serveur/support o2switch ; ne pas désactiver le contrôle SSH.
   Ne jamais transmettre les secrets dans une issue, un chat ou Git.
   Si un environnement GitHub `production` existe déjà, vérifier qu'il autorise
   `main` et qu'aucune approbation manuelle n'y retarde le déploiement voulu.

4. Lancer **Deploy Lumen to o2switch → Run workflow → main**. Vérifier le succès
   de la publication et le SHA exact dans `https://lumen.nopuna.fr/build-info.json`.
   Tant que cette vérification réelle n'est pas passée, considérer l'activation
   comme en attente. Le cron toutes les dix minutes peut rester en secours.

L'autorisation temporaire préserve les exceptions SSH existantes. Le nettoyage
ne retire que les directions ajoutées par ce runner ; il ne vide jamais la
liste blanche du compte. Un échec de nettoyage est signalé dans GitHub.
Documentation API : https://faq.o2switch.fr/cpanel/outils/exception-parefeu/

## Tests du déploiement

`python3 scripts/o2switch-deploy-tests.py` couvre la sélection des contrôles
du SHA exact, les réponses manquantes/échouées, PR/forks/branches exclus, les
commandes SSH rejetées et, sur Linux, la publication dans un dossier jetable,
le contournement du délai du cron, le refus des retours en arrière, la répétition,
le dry-run et la restauration après une mauvaise version HTTP. Ces tests
n'utilisent ni secrets ni serveur o2switch. Ils sont exécutés dans la quality gate.

## Fonctionnement du cron de secours

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
