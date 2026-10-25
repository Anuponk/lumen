# Sécurité des données Play — feuille de préparation

Actualisation technique du 25 octobre :
[matrice de preuves et traitements](PRIVACY_P0_CONSOLIDATION.md).

| Rubrique | Code | Configuration | Test | Non vérifié / décision |
|---|---|---|---|---|
| Compte et progression | Auth, profils, reçus, archives confirmés | Région européenne confirmée ; Auth partagée | Fixtures d'isolation/effacement | Fournisseurs et bases légales à confirmer |
| Diagnostics | Opt-in et retrait hors ligne confirmés | Fonction de purge/cron présents | SQL, client et navigateur synthétiques | Recette physique, contenu résiduel de production non inspecté |
| Assistance privée | Copies filtrées, accord spécifique, audit | Tables privées et contrôle actif observés | Effacement/export/rollback synthétiques | Premier passage cron après installation et validation juridique |
| Analytics facultatives | Refus par défaut dans candidat | Versions publiques non attestées globalement | Régressions candidat | Inventaire réseau complet à confirmer |
| Publicités et achats intégrés | Aucun SDK/flux commercial trouvé dans PWA inspectée | Console non inspectée | Pas de paiement applicable | Aucun ajout ; modèle gratuit à reconfirmer sur paquet final |
| Android, Families et permissions natives | Aucun paquet créé ici | Non applicable à la PWA seule | Non testé | Décisions enfants/Android et soumission bloquées |

Code, configuration et test restent des preuves différentes. Les champs sans
preuve gardent le statut non vérifié ; bases légales et textes nécessitent la
validation appropriée. Aucune déclaration Data Safety n'est envoyée.

État du 22 octobre 2026 ; **aucune déclaration Console envoyée**. Cette matrice
rapproche le code PWA et l'audit de #316 des rubriques à examiner pour le futur
paquet Android. Ce sont des correspondances proposées, pas une certification
de l'AAB ni un formulaire prérempli. La publication reste bloquée.

| Données observées | Rubrique candidate à vérifier dans Console | Usage / caractère à contrôler sur le paquet |
|---|---|---|
| Email, UID Supabase, identité du fournisseur, pseudo | Informations personnelles : adresse e-mail, identifiants utilisateur, nom selon le champ réellement transmis | Compte et restauration ; compte facultatif si le jeu invité demeure effectivement accessible |
| Quêtes, résultats, badges, durées, assistance, droits, intentions confirmées | Activité dans l'application : interactions et autres actions | Jeu connecté, sauvegarde et synchronisation ; ne pas confondre avec les statistiques optionnelles |
| UID/acteur fonctionnel, endpoint et abonnement push | Identifiants de l'appareil ou autres identifiants ; autres rubriques selon contenu de la subscription | Défis, notifications, rapprochement historique ; un identifiant pseudonyme reste une donnée |
| Feedback volontaire, texte et contexte de difficulté | Autres contenus générés par les utilisateurs ; messages si la fonction distribuée le justifie | Support demandé par le joueur ; pas de contenu de grille ajouté par défaut |
| Version, plateforme, état de synchro, catégories d'erreur | Informations et performances des applications : diagnostics | Fiabilité ; distinct des analytics produit. Observation n'est pas une preuve de sauvegarde |
| Événements de session/referral produit | Activité dans l'application si présente dans une version distribuée | Le candidat bloque ces envois par défaut et ne fournit pas d'autorisation. Examiner les autres versions actives avant une réponse globale |
| Données de connexion/logs des hébergeurs, Auth, mail et push | Rubriques à déterminer avec les fournisseurs, y compris IP/identifiants selon les traitements | À qualifier avec contrats, journaux, destinataires et rétention ; la région de la base ne suffit pas |

Pour chaque ligne du formulaire, consigner : collecte réelle, partage au sens
de Google, finalité, choix offert à tous les utilisateurs concernés, traitement
éphémère ou stockage, sécurité du transfert, version testée et preuve réseau.
Une bibliothèque embarquée localement peut toujours contacter un service.
Le statut de sous-traitant ne se déduit pas de son seul nom : qualifier les
contrats avant d'affirmer qu'un transfert est exempté de « partage ».

## Réponses qui exigent encore une preuve

- Ne pas cocher « aucune donnée collectée » : les fonctions connectées
  transmettent des données hors appareil, même sans publicité.
- Ne pas revendiquer un chiffrement de bout en bout. Les API utilisent HTTPS ;
  vérifier l'intégralité des flux du candidat avant d'attester leur protection.
- Une page mailto prouve la préparation d'une demande, pas son traitement.
  La migration d'effacement Lumen est préparée et testée en base jetable ;
  application autorisée, fournisseurs/backups et recette complète restent requis.
- Aucun achat, publicité ou SDK associé ajouté pour cette première version.
  Refaire l'inventaire après tout changement et sur les artefacts réellement actifs.
- La décision France/enfants ne configure pas Console. Activation enfant
  bloquée jusqu'à une méthode parentale validée ; questionnaire d'âge/IARC,
  Families, SDK et permissions encore à rapprocher du paquet final.

## Dossier de preuves à conserver

Référence du candidat et de ses SDK, capture du formulaire Console, capture
réseau expurgée de jetons/données personnelles, permissions du manifeste Android,
URLs publiques finales, résultat du parcours de suppression synthétique,
qualification des destinataires, politique de rétention et revue de cohérence.
Ne jamais déposer de clés, messages privés ou sauvegardes dans ce dossier public.

Procédure officielle à recontrôler à la soumission :
[formulaire Sécurité des données](https://support.google.com/googleplay/android-developer/answer/10787469?hl=fr).
Inventaire source : [audit réel](PRIVACY_AND_LEGAL_AUDIT.md) ; suppression :
[runbook](ACCOUNT_DELETION_RUNBOOK.md). `evidence.dataSafety` demeure non vérifié.
