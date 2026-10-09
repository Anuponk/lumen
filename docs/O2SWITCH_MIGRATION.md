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
bash ~/lumen-staging/scripts/o2switch-pilot-publish.sh
```

**Précondition :** Node.js disponible sur la machine avec les dépendances système nécessaires aux tests ; le script lance `node scripts/quality-gate.mjs` et refuse la publication s'il échoue. Si Node est indisponible sous cPanel, ne pas court-circuiter le test : déplacer sa vérification vers une preuve de CI GitHub et adapter le script avec garde explicite.

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
