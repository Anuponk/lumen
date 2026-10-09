# Pilote Lumen sur o2switch — lumen.nopuna.fr

État au 9 octobre 2026 : sous-domaine créé sur o2switch dans `/home/yuae0754/lumen.nopuna.fr`, DNS OVH pointant vers `109.234.164.201`, certificat Let's Encrypt opérationnel, `curl -I https://lumen.nopuna.fr` → HTTP/2 200. **Ce HTTP 200 était la page d'attente o2switch, pas le jeu.**

Objectif : effectuer un premier déploiement de test isolé, sans couper Vercel ni changer les données Supabase. L'issue de suivi est #196.

## Architecture

Lumen est une application statique avec modules ES : `index.html`, `src/`, `content/`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-maskable.svg`. Pas de serveur Node requis pour servir ces fichiers. Supabase reste le backend, et les comptes Google/OTP, la progression et les défis doivent être testés sur la nouvelle origine. **Les sauvegardes anonymes uniquement locales ne migrent pas spontanément depuis le domaine Vercel.**

## Avant le premier test

Dans GitHub, créer une *deploy key* **read-only** pour `Anuponk/lumen`, puis la configurer dans `~/.ssh/lumen_github_pull` sur o2switch. Ne pas réutiliser la clé privée de Nopuna, ne pas la committer.

Le pilote utilise un checkout Git à `/home/yuae0754/lumen-staging` et publie uniquement les fichiers publics dans `/home/yuae0754/lumen.nopuna.fr`. Ne pas publier `.git`, `docs/`, `scripts/`, `supabase/`, ni d'informations privées.

Une fois la clé enregistrée :

```bash
chmod 600 ~/.ssh/lumen_github_pull
GIT_SSH_COMMAND="ssh -i ~/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes" git clone -b main git@github.com:Anuponk/lumen.git ~/lumen-staging
```

Le premier déploiement se fait manuellement, pour le SHA choisi, en lançant :

```bash
LUMEN_VALIDATED_SHA=$(git -C ~/lumen-staging rev-parse HEAD) bash ~/lumen-staging/scripts/o2switch-pilot-publish.sh
```

**Précondition :** sur o2switch, `node` est indisponible. Le contrôle qualité est exécuté par le workflow GitHub `Lumen quality gate` (Node 22). Pour le premier pilote manuel, vérifier que le workflow du SHA exact à déployer est vert puis exécuter `LUMEN_VALIDATED_SHA=$(git rev-parse HEAD) bash scripts/o2switch-pilot-publish.sh` depuis `~/lumen-staging`. Le script refuse le lancement sans le SHA explicitement validé. Ceci n'est pas une preuve automatique du statut CI : avant un déploiement automatique, il faudra vérifier le statut par API ou déployer uniquement des artefacts dont le workflow CI a attesté la réussite.

## Validation pilote (avant CI/CD automatique)

- Vérifier le SHA publié, les ressources `src/` et `content/`, les MIME JS/manifest, l'absence de 404 et d'erreurs console.
- Tester Google OAuth/OTP et les URL de redirection autorisées dans Supabase ; ne pas remplacer l'URL de retour Vercel tant que la production y fonctionne.
- Tester reprise de progression authentifiée, invité neuf (sans écraser les anciens invités), grilles, défis et cockpit.
- Tester installation PWA et renouvellement des caches/service workers sur la nouvelle origine, mobile inclus.
- Inventorier et valider tous les endpoints externes, webhooks et émetteurs de push avant bascule.
- Ne pas mettre en place de cron automatique sans gate CI vérifié, publication de release atomique et rollback testé comme prévu dans #196.
- Ne pas supprimer le projet Vercel Lumen avant décision GO explicite.

## Historique

- Diagnostic o2switch : `ls -ld ~/lumen.nopuna.fr` → dossier existant, `curl -I https://lumen.nopuna.fr` → HTTP/2 200 le 09/10/2026.
- Le script `scripts/o2switch-pilot-publish.sh` prépare un premier pilote **manuel**, en refusant les changements locaux non committés et la branche hors `main`.

## OAuth Google : retour vers l'origine de connexion

Lors du premier test, le compte Google lancé sur `lumen.nopuna.fr` renvoyait vers Vercel : deux parcours `signIn(...)` dans `src/ui/game-screen.js` contenaient l'URL Vercel en dur. Correction : destination calculée à partir de `location.origin`, pour conserver le domaine initiateur (Vercel ou o2switch). Test : `node scripts/oauth-return.test.mjs`, inclus dans GitHub CI. Dans Supabase Authentication > URL Configuration, conserver les deux domaines dans Redirect URLs pendant la transition ; ne pas changer la Site URL Vercel avant la bascule.

**Attention aux sauvegardes :** après retour sur une origine différente, la session et le localStorage ne sont pas identiques. La disparition apparente de progression ne prouve pas une suppression cloud. Vérifier le compte réellement connecté et la synchronisation Supabase avant toute mutation ou reset.

## Sauvetage manuel des invités (phase 1, issue #214)

Un parcours export/import est disponible via le menu compte et `/transfer.html` sur les deux domaines. Depuis **Vercel**, télécharger le fichier JSON local; depuis **o2switch**, l'importer via la même page. Aucune création de compte, aucun transfert réseau, aucune suppression de la source. L'import refuse de remplacer une progression déjà présente sur le domaine cible. Le fichier JSON contient des informations de progression personnelle : à conserver localement et ne pas partager publiquement. Test CI : `node scripts/guest-transfer-tests.mjs`. La PWA et les autres appareils doivent être testés manuellement.

**NO-GO pour la bascule** : cette phase 1 est une sauvegarde manuelle de secours, pas encore le transfert transparent postMessage, la fusion avec les sauvegardes préexistantes ou la couverture de toutes les clés locales. Garder l'ancien domaine accessible et poursuivre #214 avant la migration définitive.
