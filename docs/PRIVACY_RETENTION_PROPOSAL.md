# Conservation — proposition précise à adopter avant publication

Version du 22 octobre 2026. Proposition de travail, **aucune nouvelle purge
automatique activée**. Seule la rétention des observations outbox résolues à
30 jours a déjà été livrée. Les délais ci-dessous ne sont pas annoncés comme
appliqués dans la page de confidentialité candidate.

Le [mécanisme opérateur](TECHNICAL_RETENTION_RUNBOOK.md) est maintenant préparé
et testé en base jetable : il reste sans activation ni planification en production.
Pour les [logs et sauvegardes](PRIVACY_LOGS_AND_BACKUPS.md), distinguer objectifs
Nopuna, durées documentées des offres et réglages réellement contrôlés.

| Catégorie / finalité | Proposition et déclencheur | Travail avant adoption |
|---|---|---|
| Compte, progression, droits, reçus et sauvegardes de récupération nécessaires au service | Pendant l'utilisation du compte, puis effacement sur demande vérifiée ; revue annuelle des comptes sans activité depuis 24 mois, sans suppression automatique des acquis | Définir le contact et le traitement des comptes inactifs ; préserver les reçus nécessaires aux reprises et aux opérations en attente |
| Statistiques techniques facultatives explicitement sélectionnées | 90 jours après l'événement ; preuves de victoire/tentative/indices et événements inconnus exclus | Mécanisme borné préparé, pas de purge générale des analytics ; ne pas supprimer les preuves nécessaires au backfill des acquis |
| Retours de support clôturés | 180 jours après clôture explicite, hors conservation motivée | Mécanisme préparé avec date serveur ; dossiers new/reviewed/fixed et privacy_hold préservés ; revue mensuelle des exceptions |
| Défis et participations | Pendant leur usage ; revue des défis sans activité depuis 12 mois ; identité retirée sur demande vérifiée en conservant les autres participants | Définir une date d'activité fiable avant tout nettoyage ; ne pas cascader sur les données d'autres joueurs |
| Abonnement push désactivé | Suppression 90 jours après désactivation | Date serveur et purge bornée préparées ; réactivation protégée ; ne pas utiliser last_seen comme preuve de désactivation. La gestion des endpoints invalides reste distincte |
| Diagnostics non résolus / reprises en attente | Jusqu'à résolution ; revue mensuelle des éléments anciens | Ne pas supprimer les preuves nécessaires à une reprise ; définir un horodatage de résolution pour chaque catégorie |
| Observations outbox résolues | 30 jours après résolution, mécanisme déjà livré | Maintenir la distinction avec progression, reçus et incidents ouverts |
| Barrière après effacement | Tant que les anciens identifiants peuvent réintroduire les données ; revue annuelle de nécessité | Documenter invalidation des anciens clients et réinscription explicite avant toute levée de barrière ; les empreintes restent personnelles pseudonymisées |
| Preuve minimale de demande de droit | 12 mois après clôture proposés, hors litige documenté ; aucune copie intégrale de l'export | Définir l'accès privé et supprimer les exports de travail à la clôture |
| Logs, messages, sauvegardes physiques fournisseurs | Selon l'offre effectivement souscrite et les réglages vérifiés | Relever les délais o2switch/Resend/Supabase, copies locales et support ; ne pas transformer les délais publics d'une offre en preuve du compte Lumen |

L'adoption nécessite une décision datée de l'éditeur, la justification par
finalité, puis les mécanismes correspondants et des tests sur données fictives.
Cette PR ne crée pas de tâche destructive à partir de ce tableau. Toute future
purge devra conserver les acquis, reçus et reprises tant que leur nécessité
fonctionnelle persiste, et prévoir une revue des exceptions sans conservation
indéfinie par défaut.

Références : [CNIL, durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees)
et [preuves fournisseurs](PRIVACY_PROCESSORS.md). Les points externes encore
inconnus figurent dans l'audit ; ce document ne les marque pas validés.

## Registre de traitements — bases juridiques à confirmer (2 novembre 2026)

Ce tableau est une **hypothèse de qualification**, pas une déclaration de conformité ni une preuve de déploiement. Une même catégorie peut relever de plusieurs finalités distinctes ; documenter la finalité et le déclencheur avant d'arrêter sa base juridique. L'éditeur doit valider ces choix avant publication.

| Traitement observé/documenté | Finalité | Base envisagée, à valider | État de conservation et preuve manquante |
|---|---|---|---|
| Compte, identifiant, email, connexion et progression synchronisée | Fournir le jeu et retrouver la progression | Exécution du service demandé (art. 6(1)(b) RGPD), sous réserve du parcours réellement proposé | Pas de purge automatique des comptes inactifs confirmée ; suppression #316 non validée E2E |
| Reçus, récompenses, tentatives et sauvegardes de récupération | Garantir les acquis, empêcher les doubles écritures et restaurer le jeu | Exécution du service ; intérêt légitime à examiner pour les traces anti-fraude strictement nécessaires | Conservation fonctionnelle ; ne pas confondre avec les statistiques facultatives |
| Défis entre joueurs | Permettre le partage et le résultat du défi | Exécution de la fonctionnalité demandée ; examiner les données des autres participants | Revue à 12 mois proposée, non automatisée |
| Statistiques facultatives et diagnostics détaillés optionnels | Mesure d'usage et assistance avancée | Consentement distinct, libre et révocable si collecte facultative | Préférence et retrait à vérifier en production ; purge technique 90 jours seulement proposée pour une liste limitée |
| Diagnostics indispensables et sécurité | Corriger les incidents, préserver l'intégrité du service | Intérêt légitime à documenter avec nécessité, minimisation et balance des intérêts | Observations outbox résolues : 30 jours documentés ; ne pas assimiler tous les logs à cette catégorie |
| Retours volontaires et dossiers d'assistance | Répondre aux signalements | Base à qualifier selon le type de demande (service demandé / intérêt légitime) ; accord séparé pour copies privées facultatives | 180 jours après clôture proposés pour les retours ; 6–7 jours décrits pour les copies/support facultatifs, vérifier activation réelle |
| Notifications push | Envoyer les notifications choisies | Base RGPD à justifier par finalité ; permission navigateur distincte de la base RGPD | Désabonnement et purge à 90 jours proposés, non activés |
| Demandes de droits et preuves minimales | Traiter les obligations RGPD | Obligation légale pour la gestion de la demande, conservation des preuves à justifier | 12 mois après clôture proposés, sans archive de l'export complet |
| Barrière anti-résurrection après effacement | Empêcher le retour des données supprimées | Intérêt légitime / obligation de respecter l'effacement à documenter | Empreintes pseudonymisées ; durée non arrêtée, revue annuelle proposée |

### Vérifications bloquantes avant publication

1. Confronter ce registre aux tables et flux réellement **déployés**, aux scripts de nettoyage actifs et aux consentements effectivement présentés ; un code préparé en branche n'est pas une fonctionnalité active.
2. Vérifier pour chaque traitement : données exactes, destinataires, pays/transferts, sous-traitants, durée et justification, accès, droits et contact. Les preuves fournisseurs sont listées dans [PRIVACY_PROCESSORS.md](PRIVACY_PROCESSORS.md).
3. Faire valider par l'éditeur les bases et durées, puis activer/tester séparément les purges autorisées. Ne pas effacer les reçus ou les données d'autres joueurs pour satisfaire un délai théorique.
4. Mettre à jour la page publique `confidentialite.html` **après** ces confirmations ; conserver explicitement les réserves tant qu'elles manquent.
5. Vérifier l'audience incluant des enfants, les modalités de consentement/autorité parentale et les exigences Google Play Families avant toute activation du parcours enfant.

Aucun accès aux données personnelles, aucune purge, aucune modification SQL ou de synchronisation n'a été réalisé pour ce registre.
