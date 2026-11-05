# Validation initiale du packaging — 4 novembre 2026

Source : PR [#621](https://github.com/Anuponk/lumen/pull/621), sur main
`2209a05eba65f90b027b6a36053b6c84c7670d7e`, avec uniquement les ajouts Android
et leur workflow. Build local depuis une copie isolée ; ses métadonnées VCS
locales ne constituent pas une référence de déploiement de la PWA.

- **8 tests Node passés**, empreintes du wrapper vérifiées, liens locaux des
  guides contrôlés et `git diff --check` sans erreur.
- **Gradle : BUILD SUCCESSFUL**, lint + assembleDebug + bundleDebug +
  bundleRelease, 95 tâches (31 exécutées / 64 à jour), 44 secondes sur le
  dernier passage. Outils : Windows, Zulu JDK 17.0.21, Gradle 8.13, AGP 8.13.2,
  Platform 36 / Build Tools 35.0.0.
- Le cache Windows très long empêchait le démarrage d'AAPT2. Le même binaire
  8.13.2-14304508 fonctionne après copie à un chemin court et utilisation de
  `-Pandroid.aapt2FromMavenOverride=<chemin local>` ; aucune modification du
  compilateur ni du workflow Linux pour ce problème local.
- Lint a conduit à corriger les coins transparents des icônes legacy, ajouter
  le symbole monochrome adaptatif et déclarer les exclusions de sauvegarde du
  wrapper. Pas de suppression globale de diagnostics ; seule la suggestion de
  mise à jour de la version Gradle délibérément épinglée est exclue par chemin.
- Les contrôles locaux des artefacts finaux utilisent bundletool 1.18.2
  (SHA-256 officiel vérifié), apksigner, apkanalyzer, jarsigner et inspection ZIP.
  Les deux AAB passent `validate` ; l'APK a une signature v2 valide ; l'AAB debug
  a une signature JAR valide ; l'AAB release est **non signé**. Aucun `.so`.
- Les manifestes compilés confirment les packages, versionCode 1, versionName
  1.0.0, SDK min 24 / cible 36, lien HTTPS de Lumen, absence de trafic clair,
  INTERNET et permission AndroidX interne protégée par signature. Les outils
  rendent ce dernier enum sous la forme `0x2` ou `0x00000002`.

| Artefact local | SHA-256 | Signature |
|---|---|---|
| `app-debug.apk` | `e623d0e18915e3df62346d8450a41c03eaa17bb1286f458118aa40bf7b792d4a` | Certificat debug réel, package `.debug` |
| `app-debug.aab` | `06824bc9d7f552583ee3846cdad91e0c6b8ca33f2afe36b39fb2362f25be1a17` | Debug |
| `app-release.aab` | `dfefa6800f904cc4942d1b96369e0c5914b1740d156c0a3456203776f539f9fe` | Aucune ; clé d'upload requise pour Play |

Ces empreintes identifient les fichiers locaux de cette recette, pas les futurs
artefacts CI (certificat debug, horodatages et métadonnées VCS peuvent différer).
Les binaires ne sont pas committés dans le dépôt.

**CI :** l'essai initial a identifié le paquet SDK `tools` retiré des dépôts ;
le workflow utilise explicitement `platform-tools`. Les runs suivants sont
restés en file d'attente lors de cette validation locale ; consulter les checks
du dernier SHA de la PR. Aucune CI verte n'est affirmée par cette preuve locale.

**Non exécuté :** appareil physique/émulateur, OAuth réel, réception de push,
mode avion réel, mise à jour Play, signature de publication ou upload Console.
Le domaine répondait 200 pour le manifeste PWA et 404 pour DAL lors du contrôle.
Voir [la matrice physique](TESTING.md) et [les actions propriétaire](PLAY.md).
#170 reste ouverte, à tester ; aucune fusion ni publication de production.
