# Accès et portabilité Lumen — procédure préparée

Statut : PR #526 en brouillon, migration non appliquée en production. Ce
parcours opérateur complète la [suppression](ACCOUNT_DELETION_RUNBOOK.md).
Il ne constitue ni un export automatique dans le jeu, ni une restauration.

Extension du 25 octobre : les relations récentes de `policy()` sont incluses
si présentes, notamment les contenus support par rattachement dossier/capture.
Les champs `support_access.actor`, `case_id` et `privacy_owner_id` sont retirés
de l'export pour ne pas remettre l'identité d'un autre opérateur ni une référence
à un dossier tiers. Les autres textes/JSON exigent toujours la
relecture des tiers décrite ci-dessous. Les bornes sont cumulées sur toutes
les catégories ; absence de troncature et lecture seule restent obligatoires.

1. Recevoir la demande au contact de l'éditeur. Préciser le droit et la portée
   demandés. Vérifier proportionnellement le droit à agir ; ne pas demander
   systématiquement une pièce d'identité, ni jamais un mot de passe ou un code.
   Pour un représentant, vérifier aussi son habilitation. La procédure ne
   débloque pas les comptes enfants.
2. Établir l'UID et les acteurs invités réellement rattachés au demandeur dans
   un dossier privé. Ne pas se fier à un identifiant fourni sans vérification.
   L'identité Auth commune et SoldeZen nécessitent un traitement distinct.
3. Après autorisation d'application de la migration et contrôle de version,
   utiliser une session propriétaire dédiée, sans JWT utilisateur. Ouvrir
   `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, puis fixer des délais
   locaux (par exemple `statement_timeout='60s'`, `lock_timeout='5s'`). Appeler
   `lumen_privacy.export_account(uid, acteurs_verifies)` et terminer la
   transaction. Ne pas enregistrer le résultat dans les logs ou le dépôt.
4. L'export JSON couvre les 26 tables de données de la politique d'effacement,
   leurs seules lignes attribuées à ce demandeur et ses éventuelles empreintes
   anti-résurrection. Les règles partagées et la vue dérivée sont exclues.
   Auth, ses secrets et les autres applications sont exclus ; les clés
   cryptographiques des abonnements push sont retirées. Les textes libres,
   profils, reçus, sauvegardes et liens de défi peuvent encore contenir des
   données de tiers ou des informations confidentielles : relire et masquer
   avant communication. Ne jamais transmettre directement le résultat brut.
5. Sélectionner la réponse appropriée au droit exercé : une copie d'accès et
   les informations associées ; pour la portabilité, les données éligibles
   dans un format structuré avec explication des catégories. L'export technique
   n'affirme pas que chaque champ relève juridiquement de la portabilité.
6. Transmettre par un canal privé sécurisé, après vérification du destinataire.
   Si archive chiffrée, communiquer le secret par un canal distinct. Retirer
   les copies de travail après clôture ; conserver seulement la preuve minimale
   de traitement selon la politique adoptée. Ne pas publier d'exemple réel.

Répondre en principe sous un mois ; une prolongation motivée jusqu'à deux mois
supplémentaires doit être annoncée dans le premier mois. Consigner seulement
date, nature, vérification effectuée, version et résultat, sans contenu exporté.
Source : [CNIL, répondre à une demande d'accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces).

## Garde-fous et maintenance

Fonction SECURITY INVOKER, `search_path` vide, accès retiré à PUBLIC, anon,
authenticated et service_role. Elle refuse les transactions modifiables ou
sans instantané stable. Aucun verrou d'effacement, aucune écriture, aucune
table de journal d'export. Les contrôles de schéma et d'acteurs de la procédure
d'effacement restent obligatoires ; une ambiguïté interrompt toute réponse.

Maximum 10 000 lignes, borne réglable uniquement vers le bas, et 8 Mio de
taille JSON source cumulée avant agrégation. Aucun résultat tronqué : au-delà,
examen opérateur et procédure spécifique requise. La taille du fichier sérialisé
inclut aussi son enveloppe. Les refus ne doivent pas journaliser les valeurs.

Les fixtures `account-rights*.sql` couvrent lecture seule, limites, acteurs,
secrets, isolation et accès après effacement. Toute nouvelle table/identité ou
évolution des abonnements push exige une revue des champs et des tests.
Rollback applicatif : aucune donnée à restaurer ; ne pas retirer les gardes
d'effacement existantes. Le retrait éventuel de cette seule fonction relève
d'une migration distincte, jamais d'une suppression du schéma privé.
