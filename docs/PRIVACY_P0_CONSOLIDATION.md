# Consolidation P0 — audit préalable du 25 octobre 2026

Branche de départ : #526 `f936f95`, main comparé : `e0c7f20` (inclut #593).
Audit du code et des contrats, sans écriture de production. #526 reste en
brouillon. Aucun accord de migration, publication, purge ou effacement réel.

| Fonction | Déjà développée | Correctif nécessaire | Test manquant | Autorisation nécessaire |
|---|---|---|---|---|
| Demande in-app / web | Page indépendante, confirmation, mail préparé | Pas de deuxième parcours ; conserver absence de faux succès | Recette mobile du candidat intégré et traitement opérateur complet | Publication distincte, identité vérifiée pour chaque demande |
| Effacement Lumen | Transaction privée, barrières UID/acteur/clé, refus ambiguïtés | Politique #526 antérieure aux tables diagnostics, commandes récentes et support ; nouvelles colonnes sociales | Chaîne SQL actuelle, installation sans/avec support, rollback, concurrents | Migration puis chaque opération autorisées séparément |
| Auth partagée | Aucune suppression Auth globale | Conserver cette séparation | Ancien JWT et autre application inchangée | Aucune modification Auth autorisée |
| Assistance #593 | Consentement spécifique, copies JSON privées, révocation et purge | Couvrir dossiers, contenus, métadonnées et audit indirect, bloquer nouveaux uploads après effacement | Cas expirés/révoqués, audit sans FK, identité opérateur, course upload/effacement | Installation et activation support non autorisées |
| Droits d'accès | Export privé borné, stable, en lecture seule | Ajouter relations indirectes et masquer l'identité du support tiers | Export/limites après évolution, après effacement | Autorisation opérateur et remise privée après relecture |
| Diagnostics #534 | Opt-in, retrait hors ligne, purge SQL existants | Inclure événements, préférences et budgets individuels dans effacement | Exécution du cron de production non attestée par fixtures | Aucun déclenchement de purge réel |
| Conservation technique | Aperçu et lots confirmés, dates serveur | Réévaluer inventaire actuel ; ne pas inventer de durée juridique | Dernier succès réel du planificateur et rétention fournisseurs | Décision de conservation puis activation distinctes |
| Textes légaux / tiers | Pages candidates, inventaire SDK locaux et fournisseurs | Actualiser flux support/diagnostics et distinguer ancien audit / configuration actuelle | Réseau du build distribué, paramètres fournisseurs, téléphone | Approbation juridique et éditoriale manquante |
| Play / enfants | Matrice et blocages explicites | Actualiser preuves sans attestation globale | Aucun AAB ni recette Android native | Décisions et publication demeurent bloquées |

Les exigences #316, #170, #574, #534, #391 et #398 et les PR #526/#593
sont relues. Treize migrations main ont été ajoutées depuis la base de #526.
L'intégration locale révèle dix conflits : documentation, suites, SQL CI et
ancien placement du coach. Le placement visuel déjà présent dans #526 est
adapté à l'ordinal et à la leçon Auto actuels ; les règles P1, gestes et étapes
de main sont conservés. Aucun changement du moteur ou de la synchronisation.

## État observé, distinct du brief

Lecture des seules métadonnées le 25 octobre : le schéma `lumen_privacy` est
absent. Les cinq tables support sont maintenant présentes, RLS activée, sans
SELECT brut pour anon/authenticated. Le contrôle support est déjà `true` ;
migrations distantes `20261025204857` (vérification privée) et `20261025204916`
(temporary_support). Ce changement extérieur au chantier contredit l'hypothèse
initiale du brief. Aucun réglage modifié ici ; ne pas recopier « non installé »
comme un constat courant, ni attribuer cette activation à ce lot.

`recovery_backups` a toujours RLS désactivée mais aucun SELECT brut joueur/anon ;
aucune exposition directe constatée par ce contrôle de privilèges. Les autres
tables privées observées ont RLS et refusent la lecture brute ; les vues/RPC et
les droits administrateurs nécessitent toujours leur revue spécifique.

Le cron `lumen-sync-observations-retention` est actif à `17 3 * * *`.
Dernière exécution : **succeeded, 2026-10-25 03:17:00 UTC**, avant installation
support. La définition actuelle appelle `prune_support` et `prune_diagnostics`.
Cela prouve le fonctionnement antérieur du job, pas encore un passage réel de
sa nouvelle branche support ; aucun lancement manuel de purge dans cet audit.

Rétentions relues dans les fonctions installées : diagnostics reçus depuis plus
de sept jours (lots 20 000), budgets antérieurs à la veille UTC (lots 20 000),
historique de santé résolu de plus de trente jours avec ancre ready ultérieure,
outbox confirmée de plus de trente jours. Support : dossiers plus vieux que six
jours, contenus en cascade ; audit plus vieux que sept jours. Une panne du cron
allonge ces délais ; aucun délai fournisseur ne se déduit de ces fonctions.

## Inventaire consolidé et validation

Ce tableau complète le registre de `PRIVACY_AND_LEGAL_AUDIT.md` et les contrats
dans `PRIVACY_PROCESSORS.md`. « Service » ou « consentement » décrit une piste
à faire valider, pas une base légale adoptée par ce chantier.

| Nature / finalité | Responsable / prestataire ; région | Base à confirmer | Conservation et suppression | Preuve / état |
|---|---|---|---|---|
| Email, UID, sessions / connexion | Éditeur / Supabase Auth partagé, eu-central-1 ; Google selon choix | Service ; règles mineurs à décider | Identité globale conservée pour autres services ; demande distincte si nécessaire | Métadonnées / configuration partielle ; politique à confirmer |
| Profil, acquis, badges, portefeuille, reçus / jeu et restauration | Éditeur / Supabase Database, eu-central-1 | Service | Conservation fonctionnelle à adopter ; effacement Lumen demandé, aucun max de monnaie ni changement de réconciliation | Code + SQL synthétique ; recette opérateur restante |
| Copies de récupération et acquisition, intentions et caches / reprise | Éditeur / base et appareils | Service, nécessité à confirmer | Suppression serveur ciblée ; copies locales des appareils et exports tiers à inventorier | Code/SQL ; autres appareils à confirmer |
| Analytics produit / mesure facultative | Éditeur / Database | Consentement ou exemption à démontrer | Candidat refuse nouveaux envois par défaut ; historique/90 jours techniques seulement sur liste explicite, pas purge globale | Code + tests ; trafic de toutes versions à confirmer |
| Événements diagnostics, budgets / incidents | Éditeur / Database | Opt-in spécifique ; santé minimale distincte | Sept jours et budgets bornés, retrait efface détails ; effacement inclut préférences/budgets individuels, conserve quota global | Code + tests + fonction installée ; recette physique restante |
| Dossiers, copies filtrées, consentements, SHA, références et consultations / assistance | Éditeur / Database privée, aucun bucket Storage support | Consentement #574 distinct | Six/sept jours techniques existants ; effacement supprime copies et logs attribuables avant clés ; pas d'exception sécurité inventée | Code + SQL + métadonnées ; premier cron support à confirmer |
| Défis, participations, pseudos / partage volontaire | Éditeur / Database et destinataires | Service demandé, mineurs à confirmer | Créateur désidentifié, autres participants préservés ; copies destinataires hors contrôle immédiat | SQL ; anonymisation irréversible non revendiquée |
| Feedback, messages / retour volontaire | Éditeur / Database | À confirmer | Candidat : clôture serveur +180 jours hors hold motivé ; effacement ciblé avant perte d'UID | SQL synthétique ; politique non adoptée |
| Endpoint push, clés / rappel volontaire | Éditeur / Database, fournisseur navigateur selon appareil | Choix utilisateur, base à confirmer | Effacement ciblé ; candidat désactivé +90 jours ; export masque clés ; fournisseur à rapprocher | Code/SQL ; livraison native non applicable actuellement |
| Emails transactionnels et journaux / Auth | Éditeur / Resend ; stockage US décrit par fournisseur | Service, garanties transfert à valider | Free déclaré, références historiques 30 jours logs/emails, sept jours backups ; options propres non vérifiées ici | Fonction source ; contrat/options actuels à confirmer |
| Pages, IP et logs / hébergement | Éditeur / o2switch, France selon contrat | Service/sécurité à valider | Offre et rotation exactes inconnues ; proposition 14 jours/6 mois non activée par ce lot | Source/configuration partielle ; décisions bloquantes |
| SDK, CDN, scripts / fonctionnement | Supabase JS et QRCode embarqués dans candidat ; version publique distincte | Selon flux réseau effectifs | Versions et licences figées dans manifeste ; pas de SDK publicitaire/paiement trouvé dans dépendances PWA inspectées | Code + tests ; capture réseau exhaustive/build Android non vérifiés |

Les traces de sécurité ne bénéficient ici d'aucune conservation indéfinie
automatique. L'audit support attribuable au compte/cas effacé est supprimé ; les
autres consultations suivent les sept jours existants. Une obligation de
conservation exceptionnelle exige motif, portée, accès restreint et échéance
validés avant exécution, et ne doit pas transformer « partiel » en « terminé ».

## Migration et retour

Écart supplémentaire démontré : #593 pouvait purger un dossier avant son journal.
La migration privée candidate ajoute `support_access.privacy_owner_id`, renseigné
par rattachement serveur au dossier, puis par le trigger sur les consultations.
Ce champ reste privé, suit les sept jours existants et l'effacement individuel,
et est exclu de l'export avec `actor` et `case_id`. Les traces déjà orphelines
sans rattachement récupérable déclenchent
`LUMEN_ERASURE_SUPPORT_AUDIT_REVIEW_REQUIRED` : revue/expiration vérifiée avant
effacement, jamais attribution devinée ou purge globale d'autres joueurs.
L'effacement prend le verrou d'assistance du compte avant les locks de tables.

Les trois migrations de #526 sont encore non installées ; elles sont adaptées
dans cette même PR. **Ne pas modifier le SQL déjà appliqué de #593.** Installer
les dépendances revues avant la politique, puis effacement, export et rétention
candidate (sans cron). Si le support n'existe pas, il est exclu explicitement ;
s'il est installé ensuite, appeler `lumen_privacy.install_guards()` en session
propriétaire dans la même transaction d'installation, puis `review_erasure`,
avant toute activation. Une table/colonne/FK ou garde inconnue bloque l'effacement.
Requalifier ce plan sur le catalogue réel avant toute autorisation de production.

Rollback client : conserver barrières et gardes ; ne jamais réactiver un ancien
writer pour contourner `LUMEN_ACCOUNT_ERASED`. L'effacement commis n'est pas
annulable par un rollback applicatif. Une restauration de backup doit rejouer
les effacements et la barrière la plus récente avant ouverture aux clients.

Réinscription : refus par défaut de l'ancien UID/acteur/clé ; aucun déblocage
automatique. Nouvelle identité et retrait de barrière nécessitent une revue des
anciennes copies pour ne pas recréer les données effacées.

## Références externes vérifiées

Google demande un parcours dans l'application et une ressource web permettant
de demander l'effacement ; une demande préparée ne prouve pas son traitement.
[Exigences Google Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr).
Supabase précise que supprimer un utilisateur ne termine pas immédiatement ses
JWT existants : conserver la barrière Lumen sans toucher aux autres services.
[Gestion des utilisateurs](https://supabase.com/docs/guides/auth/managing-user-data).
Ces références ne constituent pas une validation juridique ni une approbation Play.

## Preuves et décisions restantes

Résultats à compléter après exécution des tests du candidat. Les résultats
historiques de #526 ne valent pas validation de cette intégration. Fournisseurs,
backups physiques, appareils hors ligne, adresse de contact effectivement suivie,
identité du demandeur et réponse réelle restent des contrôles opérationnels.
