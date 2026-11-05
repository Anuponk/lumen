# Bibliothèques navigateur embarquées

L'application charge ces fichiers locaux avant `src/main.js` : Supabase JS
2.118.0 et QRCode JS 1.0.0. La première version correspond à la version précise
résolue par l'ancienne URL flottante le 22 octobre 2026 ; aucune nouvelle
fonction d'authentification n'est activée par ce changement.

Les URLs exactes de provenance, versions, tailles, empreintes SHA-256 et copies
de licences MIT sont inventoriées dans
[`browser-dependencies.json`](../../content/legal/browser-dependencies.json).
Les bundles upstream sont conservés sans réécriture ; `.gitattributes` empêche
la conversion de leurs fins de ligne. Ne pas les éditer manuellement.
Les espaces de fin de ligne upstream de ces seuls bundles sont conservés aussi
(ils peuvent appartenir à des littéraux dans le JavaScript minifié) ; leurs
empreintes restent vérifiées par la CI. Les sources et documents de Lumen
conservent les contrôles de whitespace habituels.

Une mise à jour exige : version explicite, examen du changelog et des avis de
sécurité, téléchargement de l'artefact et de ses licences, actualisation de
l'inventaire et de la référence HTML, puis tests de dépendances, cache,
authentification simulée et qualité complète. Comparer les éventuelles nouvelles
dépendances/licences avant de valider. Le SHA-256 détecte une modification du
fichier inventorié ; il ne constitue pas une vérification de provenance npm.

`scripts/browser-dependency-tests.mjs` interdit le retour de scripts CDN dans
la page d'entrée et vérifie les artefacts inventoriés. Le test navigateur charge
réellement les bundles locaux, vérifie l'export SDK et génère un QR fictif sans
connexion à un compte. Le worker existant traite `/src/vendor/` comme les
autres assets publics ; il conserve une copie hors ligne après chargement.

Ce lot retire les chargements de scripts depuis jsDelivr et cdnjs du navigateur.
Les requêtes fonctionnelles à Supabase et aux fournisseurs de connexion restent
distinctes. Ni l'intégration locale ni une licence MIT ne démontrent à elles
seules l'adéquation du SDK au parcours enfant ou la conformité Families.
