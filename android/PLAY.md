# Dossier de publication Google Play — Lumen

Préparation du 4 novembre 2026. Aucun upload, aucune fiche publiée ni conformité
juridique acquise. Le packaging peut être testé avant la finalisation du dossier ;
la diffusion Play exige ses propres validations. Ce document complète les
dossiers existants [préparation Play](../docs/PLAY_STORE_READINESS.md),
[fiche](../docs/PLAY_STORE_LISTING_DRAFT.md),
[Data Safety](../docs/PLAY_DATA_SAFETY_WORKSHEET.md) et
[clôture opérationnelle RGPD](../docs/RGPD_RELEASE_CHECKLIST.md).
Si un chemin juridique évolue, rechercher la checklist de #316 avant de
renseigner Console ; ne pas réinterpréter son état depuis une CI Android.

## Compte et configuration — propriétaire

- [ ] Créer/vérifier le compte développeur, identité professionnelle, coordonnées
  publiques et éventuelles obligations de vérification d'appareil/compte selon
  les demandes Console. Valider les accords et la situation du compte.
- [ ] Créer **Lumen**, langue française, type jeu, gratuit ; distribution initiale
  **France**, conformément au choix déjà documenté. Ne pas ouvrir d'autre pays.
- [ ] Confirmer l'ID candidat **fr.nopuna.lumen** avant premier upload ; premier
  versionCode **1**, versionName **1.0.0** (indépendants de la version PWA).
- [ ] Activer Play App Signing, protéger/sauvegarder la clé d'upload et relever
  le certificat de signature **de l'app** ; voir [SIGNING](SIGNING.md).
- [ ] Faire publier et vérifier DAL pour ce package/certificat, puis valider
  App Links et affichage TWA avec une installation issue de Play.
- [ ] Compiler un AAB release signé avec la vraie clé d'upload, contrôler
  signature/empreinte, package, version, SDK et bundletool ; conserver son SHA-256.
- [ ] Examiner App Bundle Explorer, rapport pré-lancement et appareils exclus.
  API cible **36**, minimum **24** dans ce projet. Pas de bibliothèque native
  `.so` dans le contrat CI ; refaire le contrôle 16 Ko si une dépendance native
  est introduite. Aucun motif d'exemption supposé pour un futur SDK.

## Contenu, droits et données — validation indispensable

- [ ] Catégorie proposée : **Jeux de réflexion / Puzzle** ; sélectionner la
  catégorie réellement disponible dans Console et répondre au questionnaire
  IARC. Ne pas attribuer soi-même une classification PEGI.
- [ ] Répondre sur publicité (première version sans publicité), accès à l'app,
  contenu, monétisation et permissions. Si la revue exige un accès connecté,
  fournir au canal privé Console un compte de test et des instructions valides.
- [ ] Public familial/accessibilité : intention éditoriale, pas une certification.
  Choisir les tranches d'âge exactes et vérifier les règles Families. Ne pas
  activer/annoncer de comptes enfants : la décision parentale reste à valider.
- [ ] Permission plateforme : **INTERNET**. AndroidX ajoute la permission interne
  `${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` protégée par
  signature ; le contrat CI vérifie les deux et refuse tout ajout. Le navigateur conserve
  les permissions Web Push ; aucune permission native POST_NOTIFICATIONS ni
  service FCM ajouté. Ne pas affirmer leur fonctionnement avant la recette.
- [ ] Inventorier les flux de la **version web servie au moment de la revue**
  et du wrapper, pas seulement le ZIP AAB. Reprendre la feuille Data Safety :
  identité/email/UID/pseudo, progression/interactions, défis/push, feedback,
  diagnostics et fournisseurs, selon fonctions réellement actives.
- [ ] Qualifier collecte/partage/finalités, données facultatives, conservation,
  transferts et sécurité. Ne pas cocher « aucune collecte » ni promettre de
  chiffrement de bout en bout. Le transport HTTPS n'établit pas toute la conformité.
- [ ] Finaliser/valider la politique et vérifier l'accès public sans login à
  `https://lumen.nopuna.fr/confidentialite.html` ; associer la même URL dans
  Console. La présence d'une page ne vaut pas validation juridique.
- [ ] Vérifier le lien interne et la page externe
  `https://lumen.nopuna.fr/supprimer-compte.html`, puis le traitement complet
  d'une demande sur compte de test suivant #316 (fournisseurs et copies compris).
  Ne pas présenter une demande mail comme preuve d'effacement effectif.
- [ ] Valider support/publication avec l'éditeur : adresse documentée
  `valente.cedric@gmail.com`, site `https://lumen.nopuna.fr/`, identité Nopuna.
  Vérifier mentions légales et coordonnées applicables avant saisie publique.

## Textes proposés (à relire sur le paquet final)

Nom : **Lumen** (limite Console : 30 caractères).

Description courte (70 caractères ; maximum 80) :

> Des grilles de logique pour éclairer les constellations, à ton rythme.

Description longue (maximum Console 4 000 caractères) :

> Retrouve les étoiles et rallume les constellations dans Lumen, un jeu de
> logique au cœur d'un ciel nocturne.
>
> Observe la grille et place les Gardiens : un par ligne, par colonne et par
> territoire. Deux Gardiens ne doivent jamais se toucher, même en diagonale.
> Croise les indices et avance par déduction pour révéler la solution.
>
> Les premières quêtes accompagnent la découverte des règles. Explore les
> constellations, progresse à ton rythme et rejoue les quêtes pour améliorer
> tes performances. Des aides permettent de mieux comprendre une grille
> lorsque tu en as besoin.
>
> Avec son univers de lumière et ses règles accessibles, Lumen invite à
> prendre le temps de réfléchir, seul ou en famille.
>
> Découvre gratuitement les 100 premières quêtes de Lumen, sans publicité.

La dernière phrase reprend les 100 quêtes gratuites de l'Aventure 1 décidées
le 4 novembre (#170). L'offre future « Débloquer le ciel principal », achat
définitif non consommable au prix public cible France de 4,99 €, couvrira toutes
les aventures principales présentes et futures ; aucun paiement ni verrou
premium n'est activé par ce packaging. Les droits acquis des joueurs restent
protégés. Ne pas annoncer « sans achats intégrés » comme modèle définitif.
Avant soumission, accorder la fiche aux fonctions réellement actives et au prix
localisé fourni par le canal de paiement. Play Billing, droits serveur et
restauration sandbox restent à valider dans leur chantier séparé ; ne pas
implémenter de paiement dans le wrapper. Aucun hors ligne garanti, compte enfant,
promesse de confidentialité ou réception push native annoncé.

## Visuels à produire à partir d'une vraie installation

| Élément | Format/résolution | Contenu attendu / état |
|---|---|---|
| Icône fiche Play | PNG 32 bits, 512 × 512, maximum 1 Mo | Adapter le symbole existant sans badge marketing ; export Play final à fournir |
| Feature graphic | PNG/JPEG, 1024 × 500 | Ciel nocturne et lumière progressive ; composition finale à fournir |
| Téléphone | Au moins 2 captures réelles, JPEG/PNG 24 bits, 320–3840 px par côté, grand côté ≤ 2× petit côté | Prévoir 4–6 captures 1080 × 1920 : accueil/ciel, apprentissage, déduction, constellation révélée, progression, défi si validé |
| Tablettes si distribuées | Captures des formats 7 et 10 pouces demandés par Console ; préparer des rendus réels | Lisibilité grands écrans et orientation ; ne pas agrandir une capture téléphone artificiellement |
| Vidéo | Facultative, URL YouTube conforme | Aucun besoin de vidéo pour cette première préparation |

Conserver les couleurs et symboles existants. Masquer les données personnelles
dans les comptes de test et éviter les captures qui annoncent un état non livré.
Ne pas utiliser une maquette PWA comme preuve Android. Le dossier fournit les
icônes launcher et splash, pas de fausses captures Store.

## Tests internes, fermés et étapes d'envoi

- [ ] Créer une liste de testeurs internes (jusqu'à 100), préparer notes de
  version et lien d'inscription ; un test interne n'est pas une publication
  publique. L'upload et le lancement de piste restent à effectuer par le propriétaire.
- [ ] Installer depuis la piste interne et compléter [TESTING](TESTING.md),
  avec vrai certificat Play, liens, OAuth, reprise, mode avion et notifications.
- [ ] Pour les comptes personnels concernés créés après le 13 novembre 2023 :
  prévoir au moins **12 testeurs inscrits continûment pendant 14 jours** à un
  **test fermé**, puis demander l'accès production ; le test interne ne compte
  pas comme remplacement. Confirmer la règle applicable à ce compte dans Console.
- [ ] Corriger les défauts confirmés dans leurs chantiers respectifs ; rapprocher
  les déclarations du wrapper ET de la version web effectivement servie.
- [ ] Conserver le rapport de recette et les validations juridiques/Families.
  Aucun passage en production sans autorisation explicite distincte.

## Sources officielles à recontrôler au moment de l'upload

Consultées le 4 novembre 2026 :
[API cible](https://developer.android.com/google/play/requirements/target-sdk),
[exigences API Play](https://support.google.com/googleplay/android-developer/answer/11926878),
[16 Ko](https://developer.android.com/guide/practices/page-sizes),
[tests des comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465),
[visuels](https://support.google.com/googleplay/android-developer/answer/9866151),
[Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111),
[Families](https://support.google.com/googleplay/android-developer/answer/9893335).

La documentation API consultée indique API 36 pour les nouvelles soumissions ;
les échéances et rubriques Console évoluent. Ce dossier ne prétend pas avoir
inspecté le compte développeur ni validé ses déclarations administratives.
