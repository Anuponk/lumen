# Politique de confidentialité Lumen — projet non publiable en l'état

Version de travail du 22 octobre 2026. Les rubriques « à valider » sont des
blocages de publication, pas des règles déjà exécutées. Rapprocher le texte de
`docs/PRIVACY_AND_LEGAL_AUDIT.md` et du paquet réellement distribué.

La version HTML candidate `/confidentialite.html` est accessible depuis la PWA,
les mentions et la demande de suppression dans cette branche, sans SDK/login.
Elle signale les informations restant à valider et n'est pas déployée. Aucun
statut `evidence.privacyPolicy` ou `evidence.legalPages` n'est validé par sa seule
présence. Le contenu distingue désidentification sociale et anonymisation
irréversible, barrière pseudonymisée et effacement physique des backups.

## Qui est responsable ?

Lumen est édité par **Nopuna — Cédric Valente EI**. Contact pour les données
personnelles : **valente.cedric@gmail.com**. L'adresse et le téléphone communiqués
figurent dans le projet de mentions légales ; les détails d'immatriculation et
les autres rubriques restent à valider avant publication des pages.

## Données utilisées et raison de leur utilisation

- **Jeu sans compte** : la progression et la tentative sont conservées sur
  l'appareil. Le stockage sert également aux réglages, aux caches et à la
  conservation des intentions non encore confirmées. Ne pas effacer ce stockage
  pour résoudre un incident sans avoir préservé ce qui doit l'être.
- **Compte et sauvegarde** : l'email/l'identité du fournisseur, le profil, la
  progression, les performances, les droits et les reçus nécessaires permettent
  la connexion, la restauration et la prévention des doubles opérations.
- **Fonctions choisies** : les défis utilisent notamment un pseudo et des
  résultats ; le feedback contient le message et son contexte ; les notifications
  utilisent une subscription et des préférences. Détailler les fonctions
  effectivement accessibles selon le parcours enfant/parent final.
- **Fiabilité du service** : des diagnostics bornés de version, plateforme et
  état de synchronisation aident à détecter et résoudre les erreurs. Ils ne
  constituent pas une sauvegarde ni une confirmation de victoire.
- **Statistiques optionnelles** : elles restent désactivées dans le candidat
  préparé. L'identifiant fonctionnel existant ne vaut pas consentement ; les
  événements antérieurs à cette modification restent à traiter selon une
  politique de conservation validée.

Bases proposées à confirmer : fourniture du service pour compte/sauvegarde,
traitement des demandes volontaires pour support/défis et base adaptée aux
diagnostics nécessaires. Ne pas présenter le consentement comme une base
universelle ou déduire un accord statistique de la connexion.

## Destinataires et lieux de traitement

Les services existants incluent o2switch, Supabase, les fournisseurs de connexion,
Resend pour les emails transactionnels, les services push du navigateur et les
autres flux de la version web à inventorier. Le code déployé de `lumen-auth-mail`
v14 confirme l'endpoint Resend. Voir `docs/PRIVACY_PROCESSORS.md` pour les sources
primaires, transferts annoncés et paramètres d'offre à vérifier. L'accès
d'administration est limité par capacités ; les secrets d'administration ne
doivent pas être présents dans le client.

La base Supabase a été identifiée en région européenne `eu-central-1`. Cela ne
prouve pas que tous les traitements des fournisseurs, du support ou des CDN
restent en Europe. **À valider avant publication** : entités contractantes,
sous-traitants, flux hors EEE et garanties applicables, ainsi que l'inventaire
réseau du futur AAB. Ne pas déclarer l'absence de partage/collecte sans revue
des définitions Data Safety et des prestataires.

## Durées

La procédure d'effacement Lumen préparée prévoit la suppression des données
fonctionnelles, reçus et copies de récupération du demandeur, avec conservation
de l'identité partagée pour les autres services et des défis sans identité utiles
aux autres participants. Une barrière privée ne contient que type, empreintes
SHA-256 d'identifiants et date. Ces métadonnées restent pseudonymisées ; leur
conservation proposée dure tant que l'identité partagée ou les anciennes copies
peuvent réécrire. Retrait uniquement après revue explicite de réinscription.
**À valider et appliquer avant publication** : cette proposition, ses bases,
l'information au demandeur et les délais des sauvegardes physiques/fournisseurs.
La migration n'est pas encore appliquée ; voir le runbook opérateur.

La suppression automatique actuellement livrée concerne uniquement les
observations techniques d'outbox confirmées depuis plus de 30 jours. Elle ne
supprime ni progression, ni reçus, ni incidents non résolus.

**À définir et mettre en œuvre avant publication** : durées par finalité pour
comptes inactifs, analytics historiques, feedback, défis, endpoints de notification,
autres diagnostics, sauvegardes et exceptions nécessaires. Ne pas affirmer que
toutes les données sont supprimées sous 30 jours.

## Vos choix et droits

Le jeu invité reste accessible sans créer de compte. Les notifications suivent
les choix et permissions du terminal ; les modalités finales de retrait doivent
être expliquées et testées. Les statistiques optionnelles ne disposent pas
d'option de réactivation dans cette préparation familiale.

Les demandes d'accès, rectification, effacement, opposition ou portabilité
applicables peuvent être adressées au contact ci-dessus. L'éditeur peut vérifier
de façon proportionnée la demande et le droit à agir, notamment pour un parent.
La page candidate informe de la réclamation auprès de la CNIL et du délai
de réponse d'un mois, prolongeable de deux mois en fonction de la complexité
ou du nombre des demandes, avec information motivée durant le premier mois.
Référence : [CNIL — droit d'accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces).

La page prévue `/supprimer-compte.html` prépare une demande par email sans
réinstallation. Il faut envoyer le message pour le transmettre. La suppression
elle-même nécessite un traitement vérifié ; elle ne doit pas affecter un autre
service utilisant l'identité partagée. Toute conservation justifiée après
suppression doit être précisée avec sa catégorie, sa base et sa durée.

## Enfants

La cible choisie comprend des enfants. **À valider avant publication** : parcours
parent/enfant, conditions des SDK et fournisseurs, données accessibles aux
participants des défis et mécanismes de protection. Aucun mécanisme parental
vérifié ni conformité Families n'est revendiqué par ce projet de texte.

## Évolutions

La procédure préparée d'accès et de portabilité est décrite dans
[ACCOUNT_RIGHTS_RUNBOOK](../ACCOUNT_RIGHTS_RUNBOOK.md). Elle nécessite une
vérification du demandeur, une revue des données de tiers et une transmission
privée sécurisée. L'export technique n'est ni une copie Auth ni une restauration.
Les [durées proposées](../PRIVACY_RETENTION_PROPOSAL.md) ne sont pas encore
appliquées ; ne pas les présenter comme une rétention en production.

La première version prévue est gratuite, sans publicité ni achats. Ajouter un
SDK, des annonces, un paiement ou un traitement nécessite une nouvelle revue
du texte, des choix utilisateurs et des déclarations de la fiche Store.
