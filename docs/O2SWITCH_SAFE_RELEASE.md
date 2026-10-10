# Lumen / o2switch: publication sécurisée (non activée)

## Situation actuelle

Le dossier public `~/lumen.nopuna.fr` est actuellement un **vrai répertoire**, utilisé par le pilote manuel. Ne **pas** ajouter `--activate` dans cPanel tant que la conversion contrôlée du document-root en lien symbolique n'a pas été effectuée et testée. Ne pas déplacer ce répertoire pendant que les joueurs utilisent l'application.

## Prérequis du nouveau script

- Git, OpenSSH, curl, python3, flock et utilitaires Linux GNU disponibles sur o2switch ; vérifier dans SSH.
- Checkout propre `~/lumen-staging` sur `main`, deploy key read-only `~/.ssh/lumen_github_pull`.
- Repo GitHub public accessible par API (ou adapter l'authentification API, sans mettre de jeton dans le dépôt).
- GitHub Actions `Lumen quality gate` déclenché par **push sur main**, conclusion `success` pour le SHA complet exact.
- Nouveau répertoire non-public `~/lumen-releases` (pas dans le docroot).
- Ne pas changer le domaine racine `nopuna.fr`, le projet Vercel, ni Supabase.

## Préparation sans risque

```bash
cd ~/lumen-staging
bash scripts/o2switch-safe-release.sh --prepare
```

Cette commande récupère la branche distante, exige une CI verte, prépare `~/lumen-releases/<sha>/` sans modifier `~/lumen.nopuna.fr`. L'appel échoue si la CI est en attente, échouée ou si GitHub est inaccessible.

On peut tester son comportement manuellement, puis éventuellement créer un cron **en mode préparation uniquement** :

```cron
*/5 * * * * /bin/bash /home/yuae0754/lumen-staging/scripts/o2switch-safe-release.sh --prepare >> /home/yuae0754/lumen-release.log 2>&1
```

Ne pas activer ce cron avant validation de ses dépendances, permissions et comportement sur l'hébergement réel. Il ne publie rien.

## Activation automatique (étape distincte nécessitant validation)

Le script ne sait activer une release que si `~/lumen.nopuna.fr` est déjà un **lien symbolique** pointant vers une release sous `~/lumen-releases/`. Pour passer du répertoire actuel à un tel lien sans perdre les fichiers, il faudra convenir d'une courte fenêtre d'intervention, capturer une sauvegarde complète du docroot, confirmer la prise en charge des symlinks par Apache/cPanel, tester le changement de cible et revenir en arrière en cas d'échec. **La procédure de bootstrap du symlink n'est volontairement pas automatisée ici.**

Une fois ce bootstrap fait, `--activate` effectue un changement atomique du symlink et conserve toutes les releases précédentes :

```bash
bash ~/lumen-staging/scripts/o2switch-safe-release.sh --activate
```

Pour remettre une release existante après un incident :

```bash
bash ~/lumen-staging/scripts/o2switch-safe-release.sh --rollback SHA_COMPLET_DE_40_CARACTERES
```

Note : rollback des **fichiers statiques** uniquement, pas de base Supabase ni stockage navigateur. Ne pas utiliser le cron `--activate` tant que la restauration des profils #223/#235, les caches PWA, la santé HTTP et le rollback ne sont pas confirmés.

## Sécurité

Le script verrouille les exécutions concurrentes avec `flock`, refuse les changements locaux, n'exporte que les assets statiques, refuse de publier sans CI vérifiée, ne touche pas aux données Supabase et ne supprime pas les releases. Après activation, le script effectue un contrôle HTTP élémentaire et revient automatiquement au symlink précédent si ce contrôle échoue. Ce contrôle ne prouve pas que les fonctionnalités et la progression fonctionnent. Avant activation automatique, ajouter une alerte opérationnelle en cas d'échec et vérifier les parcours réels.
