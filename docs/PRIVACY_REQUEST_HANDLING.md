# Demandes RGPD Lumen — registre privé minimal et traitement opérateur

Statut : **procédure documentaire**. Aucun automatisme de suppression, export ou notification n'est activé par ce document. Complète [ACCOUNT_RIGHTS_RUNBOOK.md](ACCOUNT_RIGHTS_RUNBOOK.md) et [ACCOUNT_DELETION_RUNBOOK.md](ACCOUNT_DELETION_RUNBOOK.md). Les informations personnelles ne doivent **jamais** être consignées dans une issue GitHub publique, un commit, un ticket non privé ou un journal applicatif.

## Canal et responsabilité

Le contact publié dans les mentions légales et la politique de confidentialité reçoit les demandes d'accès, rectification, effacement, opposition et portabilité. L'éditeur désigne une personne responsable du suivi. Une demande reçue par un autre canal doit lui être transférée de manière sécurisée, sans diffusion de pièces d'identité. Le canal effectif et la personne habilitée sont à confirmer avant d'annoncer cette procédure comme opérationnelle.

## Registre privé — champs autorisés

Conserver dans un espace privé à accès restreint **une ligne par demande**, sans copie du message, sans export de compte, sans adresse email en clair si un identifiant interne de dossier suffit.

| Champ | Exemple non personnel / règle |
|---|---|
| Référence interne | RGPD-AAAA-0001, sans identité |
| Date de réception | AAAA-MM-JJ |
| Nature de la demande | accès / rectification / effacement / opposition / portabilité / autre |
| Canal de réponse | référence privée, sans secret |
| Vérification du droit à agir | effectuée / complément nécessaire / non nécessaire ; jamais le justificatif lui-même |
| Échéance initiale | un mois à compter de la réception, calcul calendaire et cas particuliers vérifiés |
| État | reçu / vérification / en cours / attente légitime / répondu / clos |
| Prolongation | motif documenté et notification dans le premier mois, si applicable |
| Date et issue de la réponse | AAAA-MM-JJ ; accepté / partiel / refus motivé |
| Trace technique minimale | version/procédure, confirmation vérifiée ; pas de données exportées |
| Clôture et purge du registre | date de clôture, échéance de 12 mois cible, exceptions justifiées |

**Ne pas** créer de tableau de suivi partagé contenant des emails, UID, mots de passe, codes OTP, pièces d'identité, contenu des exports, diagnostics complets ou données de tiers. L'identifiant nécessaire à l'exécution technique est conservé séparément et supprimé dès qu'il n'est plus nécessaire.

## Parcours manuel

1. **Recevoir et dater.** Attribuer une référence privée, identifier le droit invoqué sans exiger de vocabulaire juridique, accuser réception si utile.
2. **Vérifier proportionnellement.** Utiliser d'abord le canal authentifié ou les éléments déjà connus. Demander un justificatif supplémentaire seulement en cas de doute raisonnable, jamais de mot de passe ni de code OTP ; pour un mineur/représentant, vérifier l'habilitation selon le cas.
3. **Qualifier.** Déterminer les données Lumen concernées, les tiers éventuels, les limites et exceptions applicables. L'authentification partagée avec d'autres applications reste hors périmètre de suppression Lumen ; ne jamais toucher à leurs données.
4. **Exécuter seulement un parcours autorisé.** Pour l'accès/portabilité, suivre le runbook opérateur et relire les données de tiers avant communication. Pour l'effacement, ne pas affirmer une suppression réussie sans confirmation E2E et contrôle anti-résurrection (#316). Pour une rectification, vérifier l'impact sur la progression et la synchronisation.
5. **Répondre.** En principe dans un mois ; si une prolongation légalement admissible est nécessaire, en informer le demandeur avec motif dans le premier mois. En cas de refus total ou partiel, expliquer les raisons et les voies de recours pertinentes.
6. **Clore et minimiser.** Effacer les pièces et copies de travail dès qu'elles ne sont plus nécessaires ; ne garder que la preuve minimale pendant **12 mois après clôture** selon la politique cible adoptée, sous réserve d'exception justifiée. Vérifier la purge effective avant de l'affirmer.

## Contrôle mensuel léger

Un opérateur autorisé vérifie les demandes ouvertes, les échéances dans les 7 jours, les prolongations annoncées, les réponses envoyées, les copies de travail à détruire et les lignes du registre arrivées à 12 mois. Ce contrôle est une consigne de travail, **pas une tâche automatisée déployée**. Une revue trimestrielle des droits d'accès au registre et des incidents complète le suivi.

## Limites de publication

Ne pas publier le registre ou les demandes dans le dépôt. Ne pas afficher une suppression « instantanée » ni un export automatique tant que les fonctions n'ont pas été installées, autorisées et testées. Ne pas créer de nouveau service, table ou accès privilégié pour cette simple procédure. Les mentions légales, destinataires, durées et bases juridiques doivent rester cohérents avec les preuves réellement vérifiées.
