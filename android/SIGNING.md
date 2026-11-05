# Signature et association du domaine

Ne jamais committer keystore, clé privée, mot de passe, fichier local.properties,
archives signées ou export privé Console. `.gitignore` est une protection
complémentaire ; les tests contrôlent les sources et la CI n'utilise aucun
secret de publication.

## Développement

Gradle crée normalement `~/.android/debug.keystore` au premier build debug.
La variante utilise **fr.nopuna.lumen.debug**. Lire sa véritable empreinte :

```sh
./gradlew :app:signingReport
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey
```

Le mot de passe standard du keystore debug est `android`, réservé aux tests.
Ne jamais signer une publication Play avec ce certificat. Installer l'APK :

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Sans association web, l'APK se lance avec l'interface du navigateur. Pour tester
la TWA vérifiée, ajouter la véritable empreinte debug et le package `.debug`
au fichier du domaine, après revue du propriétaire. Retirer cette association
de test quand elle n'est plus utile. Ne pas désactiver la vérification Chrome.

## Publication et Play App Signing

Le propriétaire crée/enrôle Lumen dans Play App Signing puis conserve une clé
**d'upload** protégée et sauvegardée, hors dépôt. La clé d'upload signe l'AAB
envoyé ; Google signe les APK distribués avec la clé **de signature de l'app**.
Ces certificats peuvent être différents. Pour les installations Play, publier
dans DAL l'empreinte **App signing key certificate** fournie par Console, pas
seulement l'empreinte de la clé d'upload. En cas de rotation, associer les
certificats applicables aux appareils encore servis.

Créer une clé d'upload via Android Studio ou `keytool` (saisie interactive des
mots de passe, jamais dans l'historique des commandes) :

```sh
keytool -genkeypair -keystore /secure/location/lumen-upload.jks -alias lumen-upload -keyalg RSA -keysize 3072 -validity 10000
```

Fournir au processus de compilation ces quatre variables d'environnement à
partir du gestionnaire de secrets local/CI autorisé :

| Variable | Valeur |
|---|---|
| `LUMEN_UPLOAD_STORE_FILE` | Chemin absolu du keystore hors dépôt |
| `LUMEN_UPLOAD_STORE_PASSWORD` | Mot de passe du keystore |
| `LUMEN_UPLOAD_KEY_ALIAS` | Alias de la clé d'upload |
| `LUMEN_UPLOAD_KEY_PASSWORD` | Mot de passe de la clé |

Un ensemble partiel fait échouer Gradle ; sans ces variables la release reste
non signée, jamais remplacée silencieusement par une signature debug.
Puis `./gradlew :app:bundleRelease` et
`jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab`.
Comparer le certificat à la clé d'upload attendue, puis valider avec bundletool
comme dans la CI. Pour un APK release facultatif : `./gradlew :app:assembleRelease`,
puis `apksigner verify --verbose --print-certs <apk>`.
Ne pas utiliser `tools/verify-artifacts.py` pour une release signée : cet outil
vérifie volontairement les trois artefacts **sans secrets** de la CI.

## Digital Asset Links — génération explicite, publication distincte

L'application contient la déclaration app → site ; le propriétaire doit servir
la déclaration site → app à
`https://lumen.nopuna.fr/.well-known/assetlinks.json`.
Réponse directe **200**, HTTPS valide, **application/json**, aucun login ni
redirection. Aucun fichier vide, certificat factice ou placeholder n'est livré
à cette URL par ce chantier. Aucun déploiement du domaine n'est déclenché.
Le contrôle initial du 4 novembre répondait **404**. Depuis #624, la publication
sert l'association debug de l'APK distribué (workflow 41882238087,
artefact 13350282143) pour `fr.nopuna.lumen.debug`. Son certificat public est
`1F:ED:54:5E:DE:8B:B2:9D:F6:E9:52:FA:90:7D:AD:40:59:CF:BE:34:20:27:77:41:AB:70:47:5D:F2:48:8F:C7`.
Recontrôler la réponse avec `--live` et recetter le même APK ; un nouveau build
debug CI peut utiliser un autre certificat. Conserver les autres associations.
Le certificat Play App Signing de `fr.nopuna.lumen` reste à ajouter séparément.

Depuis `android/`, remplacer les arguments descriptifs par les valeurs réelles :

```sh
node tools/assetlinks.mjs --package fr.nopuna.lumen --fingerprint "$PLAY_APP_SIGNING_SHA256"
node tools/assetlinks.mjs --package fr.nopuna.lumen.debug --fingerprint "$DEBUG_SHA256" --merge dist/assetlinks.json
```

Chaque empreinte doit comprendre 32 octets hexadécimaux séparés par `:`.
Les variables ci-dessus désignent des certificats **publics**, pas des secrets.
L'outil refuse une empreinte absente ou mal formée et fusionne les associations
existantes sans supprimer les autres apps. Si le domaine possède déjà un
fichier, en récupérer une copie contrôlée et la donner à `--merge` dès le
premier appel. Le résultat reste dans `android/dist/assetlinks.json` ignoré par
Git ; faire relire puis publier uniquement ce fichier dans le répertoire
`.well-known` de l'hébergeur. Le build statique web n'est pas modifié ici.
Ne pas écraser un fichier partagé ni déployer tout `android/` sur le site.

Vérification après publication autorisée :

```sh
node tools/assetlinks.mjs --package fr.nopuna.lumen --fingerprint "$PLAY_APP_SIGNING_SHA256" --live
adb shell pm verify-app-links --re-verify fr.nopuna.lumen
adb shell pm get-app-links fr.nopuna.lumen
adb shell am start -a android.intent.action.VIEW -d 'https://lumen.nopuna.fr/' fr.nopuna.lumen
```

Les commandes `pm` ci-dessus s'appliquent à Android 12+ ; pour l'APK debug
remplacer le package par `fr.nopuna.lumen.debug`. Le diagnostic HTTP ne prouve
pas que Chrome a déjà rafraîchi sa vérification ni que l'appareil utilise le
bon certificat. Tester aussi une installation **depuis la piste interne Play**.
Internal App Sharing peut re-signer les builds : relever son certificat si
cette voie est choisie, distincte des pistes de test Play.

Références : [Play App Signing](https://developer.android.com/studio/publish/app-signing),
[DAL](https://developers.google.com/digital-asset-links/v1/getting-started),
[vérification App Links](https://developer.android.com/training/app-links/verify-android-applinks).
