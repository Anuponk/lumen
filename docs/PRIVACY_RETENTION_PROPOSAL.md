# Conservation — proposition précise à adopter avant publication

Version du 22 octobre 2026. Proposition de travail, **aucune nouvelle purge
automatique activée**. Seule la rétention des observations outbox résolues à
30 jours a déjà été livrée. Les délais ci-dessous ne sont pas annoncés comme
appliqués dans la page de confidentialité candidate.

| Catégorie / finalité | Proposition et déclencheur | Travail avant adoption |
|---|---|---|
| Compte, progression, droits, reçus et sauvegardes de récupération nécessaires au service | Pendant l'utilisation du compte, puis effacement sur demande vérifiée ; revue annuelle des comptes sans activité depuis 24 mois, sans suppression automatique des acquis | Définir le contact et le traitement des comptes inactifs ; préserver les reçus nécessaires aux reprises et aux opérations en attente |
| Statistiques historiques facultatives | 90 jours après l'événement, puis suppression ou agrégation réellement anonyme | Vérifier qu'aucun acquis, historique de performance fonctionnel ou diagnostic non résolu ne dépend de ces événements ; analytics facultatives toujours bloquées par défaut |
| Retours de support | 180 jours après réception, prolongés uniquement pour un dossier encore ouvert avec motif documenté | Vérifier les dates disponibles et le statut ; retirer les copies et pièces de travail à la clôture |
| Défis et participations | Pendant leur usage ; revue des défis sans activité depuis 12 mois ; identité retirée sur demande vérifiée en conservant les autres participants | Définir une date d'activité fiable avant tout nettoyage ; ne pas cascader sur les données d'autres joueurs |
| Abonnement push désactivé | Suppression 90 jours après désactivation ; endpoint invalide supprimé dès constat d'invalidité | Vérifier les champs et la gestion du fournisseur ; ne pas utiliser last_seen comme preuve de désactivation |
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
