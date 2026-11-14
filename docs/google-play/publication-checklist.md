# Lumen — Préparation publication Google Play

> Document de travail, 14 novembre 2026. Suivi : #170. Ne pas confondre « préparé dans GitHub » et « validé par Google Play Console ».

## Livrables déjà dans le dépôt
- Fiche FR : `docs/google-play/store-listing-fr.md`
- Captures promotionnelles : `docs/google-play/screenshots/01-mon-ciel.png`, `02-gameplay.png`, `03-victoire.png`
- Icône 512 × 512 : `docs/google-play/branding/icon-512.png` (PR #678)
- Bannière 1 024 × 500 : `docs/google-play/branding/feature-graphic-1024x500.png` (PR #678)

**Attention :** les captures sont des maquettes graphiques recréées et non des captures pixel-identiques. Vérifier lisibilité, cohérence avec le jeu réel, conformité et dimensions dans Play Console. La fiche FR contient encore un inventaire historiquement rédigé avant l'import des PNG ; la présente checklist fait foi pour le statut des fichiers.

## Publication : checklist
- [ ] Confirmer l'accès au compte Play Console personnel « nopuna » et la vérification d'identité.
- [ ] Confirmer le package `fr.nopuna.lumen`, le nom et la catégorie du jeu.
- [ ] Importer le bundle release signé (`.aab`) depuis le PC local ; ne jamais committer l'AAB, le keystore ou ses mots de passe.
- [ ] Activer Play App Signing, récupérer l'empreinte SHA-256 **de la clé de signature d'application Google Play** et l'ajouter à `/.well-known/assetlinks.json` pour la TWA ; vérifier l'association domaine/application.
- [ ] Vérifier l'icône, la bannière et les captures directement dans la console.
- [ ] Publier une URL HTTPS accessible de politique de confidentialité, conforme aux données réellement collectées.
- [ ] Fournir les modalités de suppression de compte et des données (dans l'application et via une URL web si exigée), puis tester le parcours.
- [ ] Remplir Data Safety à partir des traitements réellement observés : authentification, profil, progression, analytics/crash éventuels, prestataires, partage, chiffrement, suppression. Ne pas supposer « aucune donnée collectée ».
- [ ] Remplir les déclarations de publicité, accès à l'application, public cible, classification du contenu et éventuelles autres déclarations requises.
- [ ] Valider l'intégration de Google Play Billing **avant de commercialiser** le déblocage numérique des aventures à 4,99 € sur Android ; vérifier les textes de boutique selon l'état réel de cette intégration.
- [ ] Configurer le test fermé et les testeurs selon les exigences affichées par le compte Play Console, puis réaliser la période de test requise.
- [ ] Tester installation Play, ouverture TWA, connexion, achats si disponibles, restauration et suppression de compte.
- [ ] Vérifier les résultats des contrôles et la publication effective dans Play Console.

## CI — politique proposée, à valider séparément
Objectif : éviter les tests applicatifs coûteux sur les PR ne modifiant que `docs/**` et les visuels marketing.

**Ne pas appliquer aveuglément `paths-ignore` à un workflow dont le check est obligatoire dans la protection de `main` : un check ignoré peut rester « Expected/Pending » et bloquer la fusion.**

Approche recommandée :
1. Identifier les noms exacts des checks obligatoires et les workflows associés.
2. Conserver un job de statut stable pour chaque check obligatoire ; faire exécuter les tests lourds conditionnellement selon les chemins modifiés.
3. Déclencher les tests complets pour le code, les scripts, les migrations et les fichiers de configuration CI.
4. Garder un contrôle léger pour les changements purement documentaires (validation des chemins et des métadonnées).
5. Vérifier le comportement sur une PR docs-only et une PR de code avant de généraliser.

Éviter de modifier simultanément les protections de branche et les workflows sans vérification de leur compatibilité.
