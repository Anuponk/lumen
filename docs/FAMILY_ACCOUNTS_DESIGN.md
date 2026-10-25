# Comptes enfants supervisés — préparation #170 / #316

Le 22 octobre 2026, le propriétaire a choisi **un compte enfant avec supervision
parentale et fonctions en ligne adaptées**. Le jeu local seul n'est donc pas
le modèle retenu. Cette décision figure dans le manifeste éditeur. Le présent
document décrit le chantier restant ; aucun compte familial, contrôle parental
ou consentement vérifié n'est encore implémenté ou déployé.

La première publication Play est limitée à la **France**, selon la décision du
propriétaire. Le réglage territorial doit être effectué et vérifié dans Play
Console ; aucune restriction du site PWA ni configuration Console n'a été appliquée.
Toute extension territoriale exige une nouvelle revue des règles et parcours.

Le propriétaire a choisi de **garder l'activation des comptes enfants bloquée**
jusqu'au choix d'une autre méthode de vérification, plutôt qu'une validation
manuelle opérée par lui au lancement. Aucun prestataire payant n'est retenu.
Le manifeste consigne `blocked-pending-verification-method` ; le rapport de
préparation ajoute `children.activationReview`, même si d'autres preuves sont
complétées. Seul un futur changement revu, accompagné des preuves enfant et
des contrôles serveur, pourra lever ce préalable. Ce rapport est local : il
ne constitue pas une restriction d'âge des anciennes inscriptions PWA, dont
le mécanisme d'authentification reste inchangé.

## Contraintes observées dans le produit

Les RPC et les autorités de récompenses sont rattachés à `auth.uid()` ; les
lectures/écritures de profil utilisent aussi un `p_expected_user_id`. La UI
possède un seul profil et une seule tentative actifs. Réutiliser simplement
l'identité du parent pour plusieurs enfants mélangerait leur progression,
leurs reçus et leurs intentions en attente. La restauration doit conserver
ces contrats, y compris après changement de membre sur un appareil partagé.

Auth est partagé avec d'autres applications. Une demande relative à Lumen ne
peut pas déclencher une suppression globale ou une révocation de leurs accès.
Les entrées historiques, les clients anciens, les écritures directes et les
fonctions de maintenance doivent être inclus dans le contrôle d'accès, pas
seulement les nouveaux écrans.

## Architecture candidate à valider avant activation

- Un identifiant de joueur distinct pour chaque enfant ; les récompenses et
  sauvegardes ne sont jamais stockées sous l'identité du parent par commodité.
- Un lien de supervision propre à Lumen, autorisé côté serveur, avec états
  explicites : demande, vérification en cours, actif, suspendu, retiré.
- Le parent dispose de sa propre authentification. La méthode de vérification
  de son autorité reste à qualifier ; vérifier une adresse email seule ne
  prouve ni la majorité ni l'autorité parentale.
- Évaluer un enrôlement enfant piloté par le parent sans email personnel de
  l'enfant. Les jetons de session restent propres au joueur ; aucune clé
  privilégiée ni mot de passe partagé ne sera distribué dans l'application.
- Les capacités autorisées sont déterminées par les preuves serveur actuelles,
  pas par `user_metadata`, un booléen local ou un JWT ancien. Un appel direct
  doit être refusé autant qu'un clic dans l'interface.
- L'absence de preuve, son expiration et son retrait bloquent les capacités
  concernées. L'interface conserve les sauvegardes et intentions sans les
  réattribuer au parent ou à un frère/une sœur.

L'intégration d'une identité enfant doit être expérimentée en environnement
isolé avant de choisir son mécanisme Auth. Ne pas créer des utilisateurs Auth
réels pour tester cette proposition, ni ajouter une migration de production
sans revue du schéma et autorisation de déploiement.

## Parcours et données à minimiser

Prévoir une information compréhensible pour l'enfant et une information pour le
parent. Le parent gère les capacités optionnelles et peut retirer un accord aussi
simplement qu'il l'a donné. Les analytics facultatives restent désactivées ; le
choix d'un compte supervisé ne les autorise pas.

Ne pas demander automatiquement une date de naissance complète ou un document
d'identité : déterminer d'abord les tranches utiles, pays visés, finalités et
moyens proportionnés de vérification. La règle de consentement dépend du pays
et de la base légale ; le seuil français ne définit pas à lui seul le public
Google Play ou les permissions de toutes les fonctions.

Pour la France, lorsque le traitement d'un service en ligne repose sur le
consentement non contractuel, la CNIL distingue le consentement autonome à partir
de 15 ans et l'accord conjoint du mineur de moins de 15 ans et du titulaire de
l'autorité parentale. Ne pas confondre ce seuil avec la majorité du parent ou
une dispense générale des autres règles. Distinguer aussi cette analyse de la
capacité à conclure le contrat et des traitements nécessaires au service.

Les défis devront être évalués séparément : pseudonyme, visibilité des résultats,
partage de lien, signalement et blocage. Aucune activation automatique du social
pour un enfant à partir du simple lien de supervision. Les notifications exigent
une décision distincte, leur désactivation et le traitement des endpoints.
Les messages libres de feedback et leurs pièces/contexte exigent aussi une revue.

## Suppression et retrait de supervision

Retirer une permission n'est pas supprimer le compte. Les demandes de droits de
l'enfant ou du parent doivent être qualifiées avant l'opération. La suppression
Lumen doit inclure lien familial et données enfant, préserver les autres membres
et applications, traiter les copies et empêcher la résurrection depuis une
ancienne session ou outbox. Voir le [runbook](ACCOUNT_DELETION_RUNBOOK.md).

## Preuves nécessaires

1. Recette synthétique : un parent, deux enfants et une identité partagée avec
   une autre application, sans mélange de profil, droits, tentative ou reçu.
2. Refus d'un faux parent, d'une demande expirée/rejouée et d'un autre utilisateur ;
   impossibilité pour l'enfant de s'octroyer lui-même une capacité.
3. Retrait/expiration pendant une session, hors ligne, après restauration,
   changement de membre et appel direct d'un ancien client.
4. Vérification proportionnée de l'âge et de l'autorité, information adaptée,
   preuve/version de chaque accord pertinent et procédure de retrait.
5. Recette sociale/notifications, effacement complet et contrôle des fournisseurs
   sur PWA puis futur paquet Android.

`evidence.childSafety` reste vide jusqu'à ces preuves. Aucun écran neutre d'âge
ou simple défi « réservé aux parents » ne doit être présenté comme preuve
de consentement parental vérifié.

Sources officielles consultées le 22 octobre 2026 :

- [Google Play Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=fr).
- [CNIL : consentement d'un parent](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans).
- [CNIL : vérification proportionnée](https://www.cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee).
- [Supabase : limites de suppression et sessions](https://supabase.com/docs/guides/auth/managing-user-data).
