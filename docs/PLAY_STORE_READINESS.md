# Préparation Google Play — #170 et #316

Audit du 22 octobre 2026, base `6dc1a09`. Ce dossier prépare la publication ;
il ne constitue ni une soumission Play Console ni une attestation de conformité.
Les modifications de cette branche ne sont pas encore déployées.

## Décisions confirmées par le propriétaire

- Éditeur : Nopuna, nom commercial de Cédric Valente EI.
- Première publication gratuite, sans publicité, achats ni abonnement.
- Public mixte comprenant des enfants : examiner les exigences Families.
- Hébergement web : o2switch ; identité et progression : Supabase existant.
- Préparer le produit avant le packaging ; aucune conversion Android lancée.

Les coordonnées se trouvent dans `content/legal/publisher.json`. Adresse,
téléphone et détail d'immatriculation restent à valider. Ne pas publier une
adresse personnelle ou un téléphone déduit d'une autre source.

## État vérifié et prochaines preuves

| Domaine | Existant / réalisé dans cette branche | Critère encore ouvert |
|---|---|---|
| Identité | Google et email/mot de passe avec récupération ; même identité Supabase et mêmes contrats de progression | Credentials Android, retour OAuth/deep link, renouvellement et même compte sur PWA/appareil Android |
| Ancien texte de #170 | L'OTP de connexion a été retiré avant ce chantier | Actualiser le périmètre, conserver confirmation/récupération ; ne pas réintroduire l'OTP pour suivre un ancien libellé |
| Compte invité | Progression locale et mécanismes existants de transfert conservés | Recette sur futur conteneur et compte existant, sans doublon ni perte |
| Suppression | Page externe et lien dans l'app pour préparer une demande au contact, sans SDK ni suppression automatique | Vérification et exécution réelle de bout en bout, séparation des autres services, traitement des anciennes copies locales ; voir runbook |
| Vie privée | Audit des données et blocage par défaut des analytics optionnels ; aucune autorisation analytics fournie en production | Pages juridiques finalisées, durées et transferts documentés, traitement des anciennes données |
| Enfants | Aucun SDK publicitaire/achat ajouté ; collecte optionnelle bloquée | Évaluation des SDK/Auth, accompagnement parental, défis/pseudos/feedback/notifications, tranches d'âge effectivement adaptées |
| Monétisation | Modèle gratuit arrêté pour cette première version | Réexaminer avant tout futur achat/publicité ; aucune intégration Billing ni CGV de vente inventée ici |
| Notifications | Web Push et consentement existants dans la PWA | Choisir adaptateur natif/FCM si nécessaire, permission Android, opt-out, réception et deep links dans tous les états |
| Distribution | Aucun projet Android, AAB, signature ni Play Console créé | ID stable validé, AAB signé, clés protégées, tests internes/fermés et déclarations Console |

## Stratégie de conteneur à valider

Capacitor reste un candidat à étudier, conformément à #170. Ne pas ajouter
maintenant un WebView qui se contente de charger le site distant : le gameplay
et ses ressources devraient pouvoir être empaquetés et testés indépendamment
du serveur de pages, avec API Auth/progression existantes.

Avant adoption, produire une décision d'architecture avec preuve sur appareil :
compatibilité des modules ES, fonctionnement du stockage sous l'origine native,
OAuth et URL de retour, bouton Retour, partage, notifications et reprise.
Isoler les dépendances de plateforme à leurs frontières existantes ; les
refactorings généraux restent dans #468. Ne pas réécrire le moteur de jeu.

L'application ID n'est pas choisi automatiquement à partir du domaine : vérifier
sa propriété et son caractère durable. Enregistrer les empreintes de signature
et les redirects autorisés sans placer de clé privée dans le dépôt. Distinguer
versionCode Android, versionName, SHA de code et version du contenu.

Au 22 octobre, la documentation Android indique API cible **36 / Android 16**
pour une nouvelle application mobile. Recontrôler l'exigence à la soumission.
L'app native doit avoir son propre mécanisme de mise à jour : ne pas supposer
que le service worker PWA remplace les mises à jour Play ou certifie un AAB.

## Rapport de préparation et verrou de soumission

```sh
node scripts/play-readiness.mjs
node scripts/play-readiness.mjs --enforce
```

Le premier affiche les blocages. Le second termine avec un code non nul tant
qu'ils existent. Il doit devenir un prérequis de tout futur job de packaging/
publication Play ; aucun tel job n'est créé par ce chantier. Ce contrôle local
ne verrouille pas un compte Play Console externe.

Les entrées `evidence` exigent un statut vérifié, une référence et une date.
Les compléter seulement avec les résultats réels et leur candidat/version,
pas avec une intention ou une simulation présentée comme preuve terrain.
Le rapport reste délibérément bloqué aujourd'hui.

## Recette Android à produire lors du packaging

1. Installer l'AAB distribué par une piste interne et relever version/signature.
2. Tester Retour, clavier, focus, lecteur d'écran, portrait/rotation et tailles.
3. Créer/connecter le compte de test par chaque méthode prévue ; retrouver les
   mêmes acquis sur PWA et Android, sans déduire l'identité d'un simple email.
4. Reprendre après arrière-plan, fermeture forcée, expiration Auth et panne réseau.
5. Vérifier liens de défis, partage natif et notifications ouverte/arrière-plan/fermée.
6. Mettre à jour avec une tentative et une outbox en attente ; conserver les preuves.
7. Demander puis réaliser la suppression d'un compte isolé ; vérifier toutes les
   données concernées, l'autre application intacte et l'absence de résurrection.
8. Vérifier le parcours enfant/parent, le contenu partagé et les permissions.
9. Rapprocher le trafic réel de l'AAB des déclarations Data Safety et de la politique.

L'aperçu de [recette isolée](ISOLATED_VALIDATION_PREVIEW.md) apporte des preuves
UI/PWA et stockage avec RPC simulés. Il ne remplace pas cette recette native.

## Déclarations et fiche Store

Préparer nom Lumen et éditeur Nopuna, descriptions, captures réellement produites,
icône/splash adaptés, catégorie et questionnaire IARC. Ne pas attribuer une
classification d'âge sans questionnaire ; « enfants compris » n'implique pas
que chaque tranche d'âge convienne au jeu. Fournir les URLs publiques finales
de politique et de suppression ainsi que l'accès nécessaire aux réviseurs.

Les drafts juridiques et la matrice de données sont dans
[l'audit confidentialité](PRIVACY_AND_LEGAL_AUDIT.md). Les comptes, contrats
fournisseurs, habilitations Play Console et vérifications d'activité EI restent
des preuves à obtenir, jamais des déclarations remplies automatiquement.

Sources officielles consultées le 22 octobre 2026 :

- [API cible Google Play](https://developer.android.com/google/play/requirements/target-sdk).
- [Exigences de suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Règles de données utilisateur](https://support.google.com/googleplay/android-developer/answer/10144311).
- [Règles Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=fr).

## Validation locale du premier lot — 22 octobre 2026

`npm run test:full` : 30 suites, aucun échec, dont le quality gate complet.
Le navigateur vérifie le parcours de demande à 390 et 1440 px avec une
messagerie simulée : confirmation requise, URL préparée, sauvegarde et tentative
inchangées. Aucun email ni aucune suppression réelle ne sont exécutés.
Les tests analytics couvrent le refus par défaut, l'autorisation explicite,
la révocation et un fournisseur d'autorisation défaillant.

Le premier passage complet avait échoué dans le nouveau pilote de recette :
il attendait les diagnostics du jeu sur une page indépendante. Le pilote
attend maintenant le chargement et le formulaire de cette page. Le passage
complet suivant est vert ; les contrôles existants restent inchangés.

## Décision de clôture

#170 et #316 restent ouvertes : une page de demande, un rapport de préparation
ou une CI verte ne prouvent ni une suppression complète ni la conformité de la
future version Android. La publication Play reste bloquée jusqu'aux preuves
ci-dessus et aux validations juridiques/professionnelles applicables.
